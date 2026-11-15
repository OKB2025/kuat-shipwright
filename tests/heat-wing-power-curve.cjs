// 2026-11-14 user decision (curve proposed and confirmed: 0.005 at the craft end): a wing discharge surface converts heat
// for less power than the internal converter at a craft's heat and for the same power at a ship's heat.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),near=(a,b,rel=1e-9)=>assert.ok(Math.abs(a-b)<=Math.abs(b)*rel,`${a} != ${b}`);
test('the wing coefficient is 0.005 up to 2e18 W, 0.015 from 2e20 W and a straight line in log10 between',()=>{
 const c=C.HEAT.wingPowerCurve;assert.deepEqual(JSON.parse(JSON.stringify(c)),{lowW:2e18,highW:2e20,low:.005,high:.015});assert.equal(c.high,C.HEAT.disPowerK.hdis,'at ship scale a wing costs what the internal converter costs');
 for(const q of [0,4.4e16,1.4e18,2e18])assert.equal(C.wingPowerK(q),.005);for(const q of [2e20,6e20,1.3e24])assert.equal(C.wingPowerK(q),.015);
 near(C.wingPowerK(2e19),.01);near(C.wingPowerK(2e18*Math.sqrt(10)),.0075);let last=0;for(let e=17;e<=21;e+=.05){const k=C.wingPowerK(10**e);assert.ok(k>=last);last=k;}
 near(C.converterPowerW('wing',1e18,.005),5e15);near(C.converterPowerW('solar',1e18,.005),5e15);near(C.converterPowerW('hdis',1e18,.005),1.5e16,1e-12);near(C.converterPowerW('wing',1e18),1.5e16,1e-12);
});
test('on a small craft the wings draw 0.005 of their rating and the internal converters 0.015; the fleet profile keeps it',()=>{
 for(const key of ['craft_xwing','craft_tie_ln']){const ship=C.buildDesign(key),S=C.computeStats(ship),dis=S.heat.net.dis;const wings=dis.filter(d=>d.k!=='hdis'&&d.power>0),inner=dis.filter(d=>d.k==='hdis'&&d.power>0);assert.ok(wings.length&&inner.length,key);
  assert.ok(S.heat.presets.combat.gen<2e18,key+' is at craft heat');for(const d of wings)near(d.power/d.cap,.005,1e-9);for(const d of inner)near(d.power/d.cap,.015,1e-9);
  const p=C.fleetProfile(S,ship.name,ship),H=C.heatProfile(p);const pw=H.dis.filter(d=>d.k!=='hdis'&&d.power>0&&d.cap>0);assert.ok(pw.length,key+' profile wings');for(const d of pw)near(d.power/d.cap,.005,1e-6);for(const d of H.dis.filter(d=>d.k==='hdis'&&d.power>0&&d.cap>0))near(d.power/d.cap,.015,1e-6);}
});
// Regression review 2026-11-15: an older stored profile that carries no rated input for a converter (power missing or 0)
// falls back to the rating coefficient 0.015 for every kind (the safe side: more power, never less than before).
test('a stored profile without a converter rating falls back to 0.015; a stored rating is kept',()=>{
 const ship=C.buildDesign('craft_xwing'),S=C.computeStats(ship),p=JSON.parse(JSON.stringify(C.fleetProfile(S,ship.name,ship)));
 const kept=C.heatProfile(JSON.parse(JSON.stringify(p))).dis.filter(d=>d.k!=='hdis'&&d.cap>0);assert.ok(kept.length);for(const d of kept)near(d.power/d.cap,.005,1e-6);
 for(const missing of [undefined,0]){const q=JSON.parse(JSON.stringify(p));for(const d of q.heat.dis){if(missing===undefined)delete d.power;else d.power=0;}const H=C.heatProfile(q).dis.filter(d=>d.cap>0);assert.ok(H.length);for(const d of H)near(d.power/d.cap,.015,1e-6);}
});
