const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),cx=vm.createContext({console}),run=code=>vm.runInContext(code,cx);
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
run(`const C=Core,I=[1,0,0,0,1,0,0,0,1],impacts=[],trial={battle:{b:{units:[]},E:I},vbolts:[],fx:[]},TRIAL_GUN={boltSpeed:4500},SPACE_RULES={step:.25};
 const tv={add:(a,b,k=1)=>a.map((v,i)=>v+k*b[i]),sub:(a,b)=>a.map((v,i)=>v-b[i]),scale:(a,k)=>a.map(v=>v*k),dot:(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),len:a=>Math.hypot(...a),norm:C.norm};
 const trialApplyT=(r,v)=>[r[0]*v[0]+r[3]*v[1]+r[6]*v[2],r[1]*v[0]+r[4]*v[1]+r[7]*v[2],r[2]*v[0]+r[5]*v[1]+r[8]*v[2]],spaceWorld=u=>u.pos,spaceVel=u=>u.velocity||[0,0,0],spaceRotU=(e,u)=>u.rot||I,spaceHullPoint=u=>u.pos;
 const sndAt=()=>{},sndFac=()=>'',sndSalvo=()=>'',sndPick=()=>'',swShotFx=()=>{},spaceImpact=(point,velocity,target)=>impacts.push({point,target});
 const emitterCalls=[],spaceShotEmitter=(a,t,index,ion,sourceFit,sourceMuzzle)=>{emitterCalls.push({index,ion,sourceFit,sourceMuzzle});return {pos:sourceMuzzle||a.pos,dir:[0,0,1],fit:sourceFit??7,cell:'physical-cell',unit:a.id};};
 let seed=77;Math.random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
`);
const a=app.indexOf('function spaceShots('),b=app.indexOf('// ---------- v21.2 small craft',a);assert.ok(a>=0&&b>a);run(app.slice(a,b));

test('production fleet bolts leave their real emitter with shared physical scatter and nominal range lifetime',()=>{
 run(`const p={...C.GUN_ACCURACY.reference,fireControl:true,modules:[]},shooter={id:'a',p,pos:[0,0,0],yaw:0,mods:[],team:0},target={id:'b',p,pos:[0,0,40000],yaw:0};trial.battle.b.units=[shooter,target];spaceShots([{from:'a',to:'b',gun:300,ion:false}]);`);
 const bolts=run('trial.vbolts');assert.equal(bolts.length,6);assert.equal(new Set(bolts.map(b=>JSON.stringify(b.vel))).size,6);for(const bolt of bolts){assert.equal(bolt.pos[2],0);assert.equal(bolt.sourceFit,7);assert.equal(bolt.sourceCell,'physical-cell');assert.equal(bolt.sourceUnit,'a');assert.ok(Math.abs(bolt.life-40000/4500)<1e-9);assert.ok(Math.abs(Math.hypot(...bolt.vel)-4500)<1e-9);}
});

test('visible misses expire without an impact while an intersecting segment flashes without applying damage twice',()=>{
 run(`impacts.length=0;const victim={id:'victim',p:{len:1600,height:444,width:868},pos:[0,0,1000],hp:100,manual:true,shield:0};trial.vbolts=[{pos:[0,0,0],vel:[0,0,4500],life:.3,target:victim},{pos:[2000,0,0],vel:[0,0,4500],life:.3,target:victim}];spaceBolts(.3);`);
 assert.equal(run('impacts.length'),1);assert.equal(run('trial.vbolts.length'),0);assert.equal(run('victim.hp'),100);assert.ok(run('trial.hitFlash')>0);assert.equal(run('impacts[0].target===victim'),true);
});


test('group packets retain their stable fitting and mouth through the RTS visual adapter without emitting the parent aggregate twice',()=>{
 const start=app.indexOf('function voyShotOf('),end=app.indexOf('// v26 Tractor beams',start);assert.ok(start>=0&&end>start);run(app.slice(start,end));
 run(`trial.vbolts=[];emitterCalls.length=0;const packets=[{gun:30,ion:false,sourceFit:31,sourceMuzzle:[10,4,-2],point:[10,4,-2]},{gun:30,ion:true,sourceFit:32,sourceMuzzle:[20,7,2],point:[20,7,2]}];shooter.lastShot={to:'b',gun:60,ion:30,packets};spaceShots([voyShotOf(shooter,0)]);`);
 assert.equal(run('trial.vbolts.length'),2);assert.deepEqual(JSON.parse(JSON.stringify(run('emitterCalls'))),[{index:0,ion:false,sourceFit:31,sourceMuzzle:[10,4,-2]},{index:0,ion:true,sourceFit:32,sourceMuzzle:[20,7,2]}]);assert.deepEqual(JSON.parse(JSON.stringify(run('trial.vbolts.map(b=>({sourceFit:b.sourceFit,pos:b.pos}))'))),[{sourceFit:31,pos:[10,4,-2]},{sourceFit:32,pos:[20,7,2]}]);assert.equal(run('shooter.lastShot.packets.length'),2);
 run(`shooter.lastSalvo={...shooter.lastShot,t:5};var salvo=voyShotOf(shooter,1);`);assert.equal(run('salvo.salvo'),true);assert.equal(run('salvo.packets===shooter.lastSalvo.packets'),true);
});
