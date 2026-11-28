// 2026-11-28 (user「A が照準を切って、B の受動誘導の弾を外す判断を試験用に入れて、そしてミサイルを避ける動きと照準された時の反応と同じく本体にも入れて」):
// a craft that locks another drops its lock when a passive anti-radiation round is closing on it and would arrive before its own guided
// round; the passive round, its light gone, flies straight on, and the craft's own radar-guided round loses its guidance with it.
// While a craft guides a radar round it lights the target. A craft reacts only to a craft's lock (not to a ship's tracking).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
function runtime(extra={}){const cx=vm.createContext({console:{log(){},warn(){},error:console.error},...extra});for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});return vm.runInContext('Core',cx);}
function duel(flags){const C=runtime(flags),s=C.buildDesign('craft_xwing'),p=JSON.parse(JSON.stringify(C.fleetProfile(C.computeStats(s),s.name,s))),a=C.fleetUnit('a','craft_xwing',p,0),b=C.fleetUnit('b','craft_xwing',p,1);
 a.pos=[0,0,0];a.yaw=0;a.velocity=[300,0,0];b.pos=[3000,0,0];b.yaw=0;b.velocity=[300,0,0];a.order={type:'hold',fire:false};b.order={type:'hold',fire:false};const B=C.fleetBattle([a,b],true);return {C,a,b,B};}
const passive=(from,to,pos,vel)=>({id:'p',salvo:'s',team:from.team,from:from.id,target:to.id,n:1,tt:.05,kind:'rmsl',ion:false,seekMode:'passive',range:10000,traveled:0,pos,vel,s:Math.hypot(...vel),life:20,launchClearance:0});
test('a passive round closing on the locking craft: it drops its lock, the target is no longer warned, the passive round loses its light',()=>{
 const {C,a,b,B}=duel({});assert.equal(C.craftLockStep(B,a,b,.25,5000),true,'a locks b');assert.equal(b.lockWarn.from,'a');
 // b answers with a passive round at a, 1.5 km off, closing at 1,500 m/s (1 s to go)
 B.missiles=[passive(b,a,[1500,0,0],[-1500,0,0])];B.time+=.25;
 assert.equal(C.craftLockStep(B,a,b,.25,5000),false,'a drops its lock');assert.ok(a.lockOff>B.time);assert.equal(B.lockLog.lockBreak,1);
 B.time+=C.MISSILE_SEEK.warnS+.5;B.missiles=[];assert.equal(C.craftLockStep(B,a,b,.25,5000),true,'the threat gone and the hold over, it locks again');
});
test('it keeps its lock when its own guided round arrives first',()=>{
 const {C,a,b,B}=duel({});C.craftLockStep(B,a,b,.25,5000);
 const own={id:'r',salvo:'s',team:0,from:'a',target:'b',n:1,tt:.05,kind:'rmsl',ion:false,seekMode:'radar',semiActive:true,range:10000,traveled:0,pos:[2900,0,0],vel:[1800,0,0],s:1800,life:20,launchClearance:0};
 B.missiles=[own,passive(b,a,[-6000,0,0],[1500,0,0])/* 6 km behind a, 5 s to go */];B.time+=.25;assert.equal(C.craftLockStep(B,a,b,.25,5000),true,'its round is 0.07 s from b: it holds on');
 B.missiles[0].pos=[-3000,0,0];B.missiles[0].vel=[600,0,0];assert.equal(C.craftLockStep(B,a,b,.25,5000),false,'its round would come after the passive one: it breaks');
});
test('with KS_LOCK_BREAK=false the lock is kept',()=>{
 const {C,a,b,B}=duel({KS_LOCK_BREAK:false});C.craftLockStep(B,a,b,.25,5000);B.missiles=[passive(b,a,[1500,0,0],[-1500,0,0])];B.time+=.25;assert.equal(C.craftLockStep(B,a,b,.25,5000),true);
});
test('a ship\'s tracking does not make a craft turn away; a craft\'s lock does',()=>{
 const {C,a,b,B}=duel({});b.lockWarn={from:'a',at:B.time};assert.ok(C.craftMissileEvade(B,b),'locked by a craft, it reacts');
 b.lockWarn={from:'ship',at:B.time};B.units.push({id:'ship',team:0,pos:[0,0,5000],velocity:[0,0,0],p:{len:150},dead:false});assert.equal(C.craftMissileEvade(B,b),null,'tracked by a ship, it flies on');
});
test('guiding its radar round the craft lights the target; with its lock off the round loses its guidance',()=>{
 const own=()=>({id:'r',salvo:'s',team:0,from:'a',target:'b',n:1,tt:.05,kind:'rmsl',ion:false,seekMode:'radar',semiActive:true,range:10000,traveled:0,pos:[500,0,0],vel:[1800,0,0],s:1800,life:20,launchClearance:0});
 {const {C,b,B}=duel({});delete b.lockWarn;B.missiles=[own()];C.fleetTick(B,.25,{});assert.equal(B.missiles[0]?.unguided,undefined,'still guided');assert.equal(b.lockWarn?.from,'a','the target is lit by its guidance');}
 {const {C,a,B}=duel({});a.lockOff=B.time+3;B.missiles=[own()];C.fleetTick(B,.25,{});assert.equal(B.missiles[0].unguided,true,'its launcher dropped the lock');}
});
