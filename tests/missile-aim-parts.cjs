// User request 2026-11-16「ミサイルのロックオンはターボレーザー、エンジン、艦橋にもできるように」: in the trial a missile can be aimed at
// the locked ship as a whole or at its turbolasers, engines or bridge (L, or the button by the missile button). It homes on
// the nearest intact module of that kind (its place in the battle profile) and its hit is aimed at that kind.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),cx=vm.createContext({console}),run=code=>vm.runInContext(code,cx);
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
run(`const C=Core,I=[1,0,0,0,1,0,0,0,1],trial={battle:{E:I,extra:new Map(),me:{id:'me',pos:[0,0,0]},result:null},P:[0,0,0],craft:false},SPACE_RULES={damage:1};
 const tv={add:(a,b,k=1)=>a.map((v,i)=>v+k*b[i]),sub:(a,b)=>a.map((v,i)=>v-b[i]),scale:(a,k)=>a.map(v=>v*k),dot:(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),len:a=>Math.hypot(...a),norm:C.norm};
 const trialApply=(M,v)=>[M[0]*v[0]+M[3]*v[1]+M[6]*v[2],M[1]*v[0]+M[4]*v[1]+M[7]*v[2],M[2]*v[0]+M[5]*v[1]+M[8]*v[2]],trialApplyT=(M,v)=>[M[0]*v[0]+M[1]*v[1]+M[2]*v[2],M[3]*v[0]+M[4]*v[1]+M[5]*v[2],M[6]*v[0]+M[7]*v[1]+M[8]*v[2]];
 const spaceWorld=u=>u.pos,spaceRotU=(E,u)=>I,sndAt=()=>{};`);
const plain=v=>v==null?v:JSON.parse(JSON.stringify(v,(k,x)=>typeof x==='number'?Math.round(x*1e6)/1e6:x));
const cut=(a,b)=>{const i=app.indexOf(a),j=app.indexOf(b,i);assert.ok(i>=0&&j>i,a);return app.slice(i,j);};
run(cut('const TRIAL_MSL_AIM=','function trialMissiles('));run(cut('function spaceDamage(','function spaceImpact('));
const mods=[{k:'weapon',at:.2,y:.5,z:.5},{k:'weapon',at:.8,y:.5,z:-.5},{k:'bridge',at:.7,y:1,z:0},{k:'engine',at:.02,y:0,z:0}];
run('globalThis.target='+JSON.stringify({pos:[1000,0,0],rot:[1,0,0,0,1,0,0,0,1],semi:[500,100,200],unit:{id:'t',p:{modules:mods},mods:[1,1,1,1],shield:0}}));
test('the cycle: hull, turbolasers, engines, bridge',()=>{assert.deepEqual(plain(run('TRIAL_MSL_AIM')),['auto','weapon','engine','bridge']);assert.equal(run('TRIAL_MSL_AIM_NAME.weapon'),'ターボレーザー');});
test('a missile homes on the nearest intact module of the chosen kind, at its place on the ship',()=>{
 const near=plain(run('trialAimPart(target,"weapon",[0,0,0])'));assert.deepEqual(near,[-300,50,100],'the bow-ward turret, nearer the launch');
 run('target.unit.mods[0]=0');assert.deepEqual(plain(run('trialAimPart(target,"weapon",[0,0,0])')),[300,50,-100],'a destroyed one is passed over');run('target.unit.mods[0]=1');
 assert.deepEqual(plain(run('trialAimPart(target,"bridge",[0,0,0])')),[200,100,0]);assert.deepEqual(plain(run('trialAimPart(target,"engine",[0,0,0])')),[-480,0,0]);
 assert.equal(run('trialAimPart(target,"auto",[0,0,0])'),null);assert.equal(run('trialAimPart(target,"reactor",[0,0,0])'),null,'no such module');
});
test('the hit is aimed at that kind; exposed kinds (turbolasers, bridge) are struck as the missile was guided onto them',()=>{
 const hit=k=>run(`trial.battle.extra=new Map();spaceDamage(target.unit,10,'missile',null,null,${JSON.stringify(k)});trial.battle.extra.get('t')`);
 const b=hit('bridge');assert.ok(b.aim.bridge>0);assert.ok(!(b.aim.auto>0));assert.ok(b.snipe.bridge>0);
 const e=hit('engine');assert.ok(e.aim.engine>0);assert.ok(!e.snipe?.engine,'engines are not an exposed kind: the aim weights their sections');
 const a=hit(null);assert.ok(a.aim.auto>0);assert.ok(!a.snipe);
});
