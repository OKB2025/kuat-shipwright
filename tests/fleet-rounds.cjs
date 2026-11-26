// Rounds, not an expected value (user 2026-11-26「公試に揃えて確率を出し、命中する砲弾のみを1発1発シミュレーションする」): what the guns fire in a step is
// counted in whole rounds, each hits or misses by the chance the trial's bolts follow (C.gunHitChance), and only the hits are landed.
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'),{C}=require('../scripts/update-ship-examples.cjs').loadRuntime(root);
const rng=seed=>()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
test('whole rounds: the part of a round left over is carried to the next step',()=>{
 const u={},always=()=>0;let landed=0,fired=0;for(let i=0;i<10;i++){const r=C.fleetRounds(u,'gun',3,1,.25,1,always);landed+=r.land*.25;fired+=r.n;assert.equal(r.land*.25,r.hits,'what lands is whole rounds of the shot');assert.equal(r.miss,0);}
 assert.equal(fired,7,'0.75 TT a step at 1 TT a round: 7 rounds in 10 steps');assert.equal(landed,7);assert.ok(Math.abs(u.roundAcc.gun-.5)<1e-9,'half a round is carried');
});
test('each round hits or misses by the chance; nothing lands at chance 0, everything at 1',()=>{
 const zero=C.fleetRounds({},'gun',40,0,.25,1,rng(1));assert.equal(zero.hits,0);assert.equal(zero.land,0);assert.equal(zero.miss*.25,10);
 const one=C.fleetRounds({},'gun',40,1,.25,1,rng(1));assert.equal(one.hits,10);assert.equal(one.miss,0);
 const r=rng(7),u={};let hits=0,n=0;for(let i=0;i<4000;i++){const x=C.fleetRounds(u,'gun',8,.3,.25,1,r);hits+=x.hits;n+=x.n;assert.ok(Number.isInteger(x.hits)&&x.hits<=x.n);}
 assert.equal(n,8000);assert.ok(Math.abs(hits/n-.3)<.02,'over many rounds the share that hits is the chance: '+hits/n);
});
test('many rounds in one step are drawn together and stay within the count',()=>{
 const r=rng(3),u={};let hits=0,n=0;for(let i=0;i<300;i++){const x=C.fleetRounds(u,'gun',4000,.5,.25,1,r);assert.equal(x.n,1000);assert.ok(Number.isInteger(x.hits)&&x.hits>=0&&x.hits<=1000);hits+=x.hits;n+=x.n;}
 assert.ok(Math.abs(hits/n-.5)<.01,'share '+hits/n);assert.ok(C.FLEET_ROUNDS.exact>=32);
});
test('guns and ion guns keep separate counts; a ship with no shot size keeps rate x chance',()=>{
 const u={};C.fleetRounds(u,'gun',1,1,.25,1,()=>0);C.fleetRounds(u,'ion',2,1,.25,1,()=>0);assert.ok(Math.abs(u.roundAcc.gun-.25)<1e-12);assert.ok(Math.abs(u.roundAcc.ion-.5)<1e-12);
 const x=C.fleetRounds({},'gun',10,.4,.25,0,()=>0);assert.equal(x.land,4);assert.equal(x.miss,6);
});
test('both battle clocks land their gunfire through the rounds',()=>{
 const src=fs.readFileSync(path.join(root,'js/core.js'),'utf8');assert.match(src,/rounds=boltTarget\?null:\{gun:fleetRounds\(u,'gun',firedGun,gunHit,dt,fleetShotTT\(u\)/);assert.match(src,/rounds=\{gun:C\.fleetRounds\(u,'gun',/);
 assert.ok(!/\*gunHit,ion=\(F\.runtime/.test(src),'the rate x chance landing is gone from both');
});
