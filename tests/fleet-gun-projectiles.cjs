const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),cx=vm.createContext({console}),run=code=>vm.runInContext(code,cx);
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
run(`const C=Core,I=[1,0,0,0,1,0,0,0,1],impacts=[],trial={battle:{b:{units:[]},E:I},vbolts:[],fx:[]},TRIAL_GUN={boltSpeed:4500},SPACE_RULES={step:.25};
 const tv={add:(a,b,k=1)=>a.map((v,i)=>v+k*b[i]),sub:(a,b)=>a.map((v,i)=>v-b[i]),scale:(a,k)=>a.map(v=>v*k),dot:(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),len:a=>Math.hypot(...a),norm:C.norm};
 const trialApplyT=(r,v)=>[r[0]*v[0]+r[3]*v[1]+r[6]*v[2],r[1]*v[0]+r[4]*v[1]+r[7]*v[2],r[2]*v[0]+r[5]*v[1]+r[8]*v[2]],spaceWorld=u=>u.pos,spaceVel=u=>u.velocity||[0,0,0],spaceRotU=(e,u)=>u.rot||I,spaceHullPoint=u=>u.pos;
 const sndAt=()=>{},sndFac=()=>'',sndSalvo=()=>'',sndPick=()=>'',swShotFx=()=>{},spaceImpact=(point,velocity,target)=>impacts.push({point,target});
 const spaceShotEmitter=a=>({pos:a.pos,dir:[0,0,1],fit:7,cell:'physical-cell',unit:a.id});
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
