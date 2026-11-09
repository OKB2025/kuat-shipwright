// v24 Holding fire settles the aim; volleys and manoeuvres throw it off; fire control sets the rate (docs/aim-convergence-v24.md).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance});
for(const f of ['data/reference.js','data/imperial2.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),A=C.AIM_MODEL;
test('holding fire settles the aim toward 1 and a volley throws it off',()=>{
 let a=0;for(let i=0;i<200;i++)a=C.aimAfter(a,{aimRatio:1},.1);assert.ok(a>.99);
 const after=C.aimAfter(a,{aimRatio:1},0,1);assert.ok(Math.abs(after-(a-A.kick))<1e-12);
 assert.ok(C.aimSpread(1)<C.aimSpread(.5)&&C.aimSpread(.5)<C.aimSpread(0));
});
test('more fire control for the guns settles the aim faster, none settles it slowly',()=>{
 const big=C.aimAfter(0,{aimRatio:2},2),mid=C.aimAfter(0,{aimRatio:1},2),none=C.aimAfter(0,{aimRatio:0},2);assert.ok(big>mid&&mid>none&&none>0);
});
test('turning, speeding up and braking throw the aim off',()=>{
 const still=C.aimAfter(.8,{aimRatio:1},1,0,0),turning=C.aimAfter(.8,{aimRatio:1},1,0,C.aimMotion(1,0)),braking=C.aimAfter(.8,{aimRatio:1},1,0,C.aimMotion(0,1));
 assert.ok(turning<still&&braking<still&&turning<.8);
});
test('a settled aim lands more of a battery’s fire than one just thrown off',()=>{
 const u={p:{acc:.7041666666666667,fireControl:true},pos:[0,0,0]},t={p:{len:1600,width:868,height:444},pos:[0,0,30000],yaw:0};
 const settled=C.gunHitChance({...u,aim:1},t,30000,60000,1),thrown=C.gunHitChance({...u,aim:0},t,30000,60000,1);assert.ok(settled>thrown);
});
test('the fleet profile carries the fire-control ratio of its guns',()=>{
 const src=fs.readFileSync(path.join(root,'js/core.js'),'utf8');assert.match(src,/aimRatio:S\.craftSystems&&/);assert.match(src,/u\.aim=aimAfter\(aimBefore,p,dt,/);
});
test('a bridge directs some fire: at least a quarter of the standard ratio, at most a half, on top of fire-control compartments',()=>{
 assert.equal(C.aimFireControlRatio(0,0,10),0);assert.equal(C.aimFireControlRatio(0,100,10),A.bridgeMin);assert.equal(C.aimFireControlRatio(0,1e9,10),A.bridgeMax);
 assert.ok(Math.abs(C.aimFireControlRatio(10000,1e9,10)-(1+A.bridgeMax))<1e-12);
});
