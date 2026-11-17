// User decisions 2026-11-17:「速度の出てる艦がその速度を持って避けようとしてて弾も逸れてるのに当たった判定なるのは艦隊戦でも致命的な仕様」
// 「1000m/sで同じ動きをするなら予測位置に撃ち込まれる砲弾が命中する。しかしランダムに動くと予測位置がズレる。500から1000に急加速しても
// 予測位置がズレる、逆も然り。さらに元々照準がバラけるなら逆に動いてもある程度当たるはずだ。つまり期待値は艦そのものではなく空間に持たせるべき」
// The fire arriving now was aimed a time of flight ago at the point the target would reach on its velocity then; the spread is
// about that point in space, and the hit chance is the share of it the hull covers where the ship really is.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),F=vm.runInContext('YardFleetData',cx),plain=v=>JSON.parse(JSON.stringify(v)),DT=.25,RANGE=C.GUN_BANDS.long.range;
const shooter=()=>{const u=C.fleetUnit('a','venator',plain(F.designs.venator.p),0);u.pos=[0,0,0];return u;};
// The target flies `motion` for 20 s and ends at [d,0,0], so every case has the same final geometry.
function chance(key,d,motion){
 const t=C.fleetUnit('b',key,plain(F.designs[key].p),1);t.pos=[d,0,0];t.velocity=[0,0,0];let T=0;
 for(let i=0;i<80;i++){T+=DT;motion(t,T);t.pos=t.pos.map((v,j)=>v+t.velocity[j]*DT);C.observeMotion([t],DT);}
 const shift=t.pos.map((v,j)=>v-[d,0,0][j]);for(const k of t._track)k.pos=k.pos.map((v,j)=>v-shift[j]);t.pos=[d,0,0];
 return C.gunHitChance(shooter(),t,d,RANGE);
}
const still=()=>{},steady=t=>{t.velocity=[0,0,1000];},jump=(t,T)=>{t.velocity=[0,0,T>19.5?1000:500];},brake=(t,T)=>{t.velocity=[0,0,T>19.5?500:1000];};
test('bolts fly at the speed the battles draw, and a ship with no track is judged where it is',()=>{
 assert.equal(C.GUN_BOLT_MPS,4500);const t=C.fleetUnit('b','imperial',plain(F.designs.imperial.p),1);t.pos=[8000,0,0];
 assert.equal(C.gunAimOffset(t,8000),null);const p=C.gunHitChance(shooter(),t,8000,RANGE);assert.ok(p>0&&p<=1);
});
test('a ship holding its velocity sits on the aim point: it is hit exactly as a ship at rest',()=>{
 for(const key of ['cr90','imperial'])for(const d of [3000,8000,15000])assert.equal(chance(key,d,steady),chance(key,d,still),`${key} at ${d} m`);
});
test('a sudden change of speed, up or down, moves a small ship off the aim point',()=>{
 const base=chance('cr90',3000,still);assert.ok(base>.05,'a CR90 at rest 3 km off is hit sometimes: '+base);
 for(const [name,m] of [['500 to 1000 m/s',jump],['1000 to 500 m/s',brake]]){const p=chance('cr90',3000,m);assert.ok(p<base*.25,`${name}: ${p} against ${base}`);}
});
test('the spread still reaches a large ship that has left the aim point',()=>{
 const base=chance('imperial',15000,still),p=chance('imperial',15000,jump);assert.ok(p>0&&p<base,`hit less, but hit: ${p} against ${base}`);
 assert.ok(p>.3,'a Star Destroyer 15 km off is still hit by a good share: '+p);
});
test('weaving wide at long range leaves the aim point entirely; close in the same weave cannot escape the hull',()=>{
 const weave=(t,T)=>{t.velocity=[0,0,Math.floor(T/2)%2?300:-300];};
 // (2026-11-17 physics review: the spread is integrated exactly along each direction, so its far tail still counts)
 const far=chance('imperial',15000,weave),held=chance('imperial',15000,()=>{});assert.ok(far<held*.25,`the weave leaves most of the spread behind: ${far} against ${held}`);assert.ok(chance('imperial',3000,weave)>.9);
});
test('the offset is the miss of a shot led on the old velocity, taken over the time of flight',()=>{
 const t=C.fleetUnit('b','cr90',plain(F.designs.cr90.p),1);t.pos=[9000,0,0];t.velocity=[0,0,0];
 for(let i=0;i<40;i++){t.velocity=[0,0,i<36?0:400];t.pos=t.pos.map((v,j)=>v+t.velocity[j]*DT);C.observeMotion([t],DT);}
 const off=C.gunAimOffset(t,9000);assert.ok(off,'tracked');assert.ok(Math.abs(off[2]-400)<1e-6,'1 s at 400 m/s the gunner did not see: '+off);
 // a shot from close by flew less than a quarter second: it was aimed on the newest reading
 const near=C.gunAimOffset(t,500);assert.ok(Math.abs(near[2])<=400*DT+1e-6,'a short flight sees almost none of it: '+near);
});
test('a small offset changes the chance only a little: no jump from the formula used with no offset',()=>{
 for(const [key,d,yaw] of [['cr90',6000,0],['cr90',6000,Math.PI/2],['cr90',10000,0],['imperial',15000,0]]){
  const t=C.fleetUnit('b',key,plain(F.designs[key].p),1);t.pos=[d,0,0];t.yaw=yaw;t.velocity=[0,0,0];const p0=C.gunHitChance(shooter(),t,d,RANGE);
  t._trackT=10;t._track=[{t:0,pos:[d,0,.001],vel:[0,0,0]}];const p1=C.gunHitChance(shooter(),t,d,RANGE);assert.ok(p0>0,'hit sometimes: '+p0);assert.ok(Math.abs(p1-p0)<=p0*.02+1e-6,`${key} at ${d} m, yaw ${yaw}: ${p0} with no offset, ${p1} with 1 mm`);}
});
test('a ship not observed for more than a step starts a new track',()=>{
 const t=C.fleetUnit('b','cr90',plain(F.designs.cr90.p),1);t.pos=[0,0,0];t.velocity=[100,0,0];C.observeMotion([t],DT,1);C.observeMotion([t],DT,1.25);assert.equal(t._track.length,2);
 t.pos=[5e6,0,0];C.observeMotion([t],DT,900);assert.equal(t._track.length,1,'the old system\'s samples are gone');
});
test('both battle clocks observe the ships\' motion',()=>{
 const src=fs.readFileSync(path.join(root,'js/core.js'),'utf8');
 assert.match(src,/function fleetTick\(b,dt,opts=\{\}\)\{observeMotion\(/);assert.match(src,/C\.observeMotion\(us,dt,w\.time\);/);
});
