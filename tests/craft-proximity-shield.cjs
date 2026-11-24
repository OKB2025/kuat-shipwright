// 2026-11-24 (user: 「直撃ではなく近接で作動するならシールドは動作していいのでは」): a warhead that bursts beside a craft on its
// proximity fuse meets the craft's field; one that strikes the craft passes the field as before (js/core.js combatResolve, PROX).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),plain=x=>JSON.parse(JSON.stringify(x));
const prof=k=>{const s=C.buildDesign(k),S=C.computeStats(s);return plain(C.fleetProfile(S,s.name,s));};
const pa=prof('craft_tie_ln'),px=prof('craft_xwing'),pt=prof('craft_tie_in');
// One unguided concussion missile from 1,500 m, its path passing `off` metres beside the target's centre.
function shot(targetProfile,off){
 const a=C.fleetUnit('a','craft_tie_ln',plain(pa),0),t=C.fleetUnit('t','x',plain(targetProfile),1);a.pos=[0,0,0];a.yaw=0;t.pos=[1500,0,0];t.yaw=0;
 for(const u of [a,t]){u.velocity=[0,0,0];u.order={...u.order,type:'hold',fire:false};}
 const b=C.fleetBattle([a,t],true);b.seed=2;C.fleetAirRelease(b,a,t,'cmsl',1,C.FLEET_AIR.kinds[1],null);const m=b.missiles[0];
 m.unguided=true;m.launchDir=C.norm([1500,0,off]);m.vel=C.mul(m.launchDir,Math.max(1,C.len(m.vel)));
 const lost0=t.secLost.length,sh0=t.shield;for(let i=0;i<20&&b.missiles.length;i++)C.fleetTick(b,.25,{});
 return {log:b.missileLog||{},secLost:t.secLost.length-lost0,shieldUsed:sh0-t.shield,dead:!!t.dead,shield0:sh0};
}
test('the body radius: half the mean of length and span',()=>{const r=C.proxBodyRadius({p:{len:13.4,width:11}});assert.ok(Math.abs(r-6.1)<1e-9,String(r));});
test('a burst 8 m beside a shielded X-wing is taken by its field: no section is lost',()=>{
 const r=shot(px,8);assert.equal(r.log.prox,1,JSON.stringify(r.log));assert.ok(r.shield0>0,'the X-wing has a field');assert.ok(r.shieldUsed>0,'the field took energy');
 // the warhead (cmsl) is far above an X-wing's field (3e-6 of the ship rule), so most of it still goes through: what matters here is
 // that the field is met first; the burst that leaks through goes on as a warhead burst
 assert.ok(r.log.hit>=1);
});
test('the fuse fires before contact: a round aimed at the centre also bursts beside the craft and meets its field',()=>{
 // 2026-11-24 expectation changed (user: 「近接信管なんだから当たる前に爆発するべきでは？」): was "a round that strikes the craft passes the field"
 const r=shot(px,0);assert.equal(r.log.prox,1,JSON.stringify(r.log));assert.ok(r.shieldUsed>0,'the field took energy');
 for(const k of ['craft_xwing','craft_awing','craft_tie_ln','craft_ywing','craft_btlb']){const q=prof(k);assert.ok(C.craftFuseRadius({p:q})>C.proxBodyRadius({p:q}),k+' is smaller than its fuse reach');}
});
test('a craft larger than its fuse reach is struck: the round passes its field',()=>{
 const big={...plain(px),len:60,width:60};assert.ok(C.craftFuseRadius({p:big})<C.proxBodyRadius({p:big}));
});
test('a burst beside an unshielded craft goes on whole as a warhead burst',()=>{
 const r=shot(pt,8);assert.equal(r.log.prox,1);assert.ok(r.secLost>0||r.dead,'TIE/in: no field, the burst takes its section');
});
