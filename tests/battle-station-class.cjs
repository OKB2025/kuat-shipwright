// User request 2026-11-15「サイズ上限無制限の『バトルステーション』の設計項目を追加」. A battle station is a design class with no
// upper size limit; ordinary ships keep their limits (hull 30 km x 10 km x 5 km, structures 30 km, coordinates 60 km).
const assert=require('node:assert/strict'),path=require('node:path'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'));
test('the class exists, has no upper limit and is never chosen by length alone',()=>{
 const c=C.SHIP_CLASSES.find(c=>c.id==='station');assert.ok(c&&c.station&&c.max===Infinity&&c.name==='バトルステーション');
 assert.equal(C.shipClassFor(50000).id,'dreadnought','a long ship is not a station by itself');assert.equal(C.shipClassFor(50000,'station').id,'station');assert.equal(C.shipClassFor(2e7,'station').id,'station');
 assert.equal(C.designLimitsFor('station').length>=1e9,true);assert.equal(C.designLimitsFor('destroyer').length,30000);assert.equal(C.SHIP_LIMITS.coordinate,60000);
});
test('a 160 km and a 2,000 km spherical station keep their size through stats and save / load',()=>{
 for(const L of [160000,2e6]){const s=C.newShip({...C.HULLS.sphere,L,W:L,H:L},'station','station'),S=C.computeStats(s),sphere=4/3*Math.PI*(L/2)**3;
  assert.equal(s.shipClass,'station');assert.equal(JSON.stringify(C.designEnvelope(s)),JSON.stringify({L,W:L,H:L}));assert.equal(S.cls.name,'バトルステーション');assert.ok(S.mass>0&&Number.isFinite(S.mass));
  const back=C.deserialize(JSON.parse(JSON.stringify(C.serialize(s))));assert.equal(back.shipClass,'station');assert.equal(back.hull.L,L);assert.equal(JSON.stringify(C.designEnvelope(back)),JSON.stringify({L,W:L,H:L}));
  const V=C.computeStats(back).hullVolume;assert.ok(Math.abs(V/sphere-1)<.05,`hull volume ${V} against the sphere ${sphere}`);}
});
test('the same hull without the station class is held to the ship limits',()=>{
 const d=JSON.parse(JSON.stringify(C.serialize(C.newShip({...C.HULLS.sphere,L:160000,W:160000,H:160000},'x','station'))));delete d.shipClass;const b=C.deserialize(d);
 assert.equal(b.hull.L,30000);assert.equal(b.hull.W,10000);assert.equal(b.hull.H,5000);
});
