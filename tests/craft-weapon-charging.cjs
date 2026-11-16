// User report 2026-11-16「武装の充電ができない」(a drone craft with one light craft laser): a weapon that needs no charging
// plant got housingCapacity 0 in its combat profile, so its whole charge counted as an internal capacitor that does not
// exist; surfaceCapacitorFactor was 0 (蓄電設備破壊) and the gun never asked for power.
const path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),{C}=require('../scripts/update-ship-examples.cjs').loadRuntime(root);
// Stock craft carry their guns outside surface mounts; the Arquitens' missile launchers are surface mounts without a plant.
const keys=['arquitens'];
test('weapons without a charging plant charge from the plant (capacitor factor 1, power requested)',()=>{
  for(const key of keys){const s=C.buildDesign(key),S=C.computeStats(s),p=C.fleetProfile(S,s.name,s),mounts=(p.surface?.mounts||[]).filter(m=>{const f=s.fits.find(q=>q.id===m.id);return f&&!C.needsCapacitor(f);});
  assert.ok(mounts.length>0,key+' has mounts without a charging plant');
  const u=C.fleetUnit(1,key,p,0);u.energy=0;u.surfaceBanks=Object.fromEntries(p.surface.mounts.map(m=>[m.id,0]));
  for(const m of mounts){assert.equal(m.housingCapacity,undefined,key+' #'+m.id);assert.equal(C.surfaceCapacitorFactor(u,m),1,key+' #'+m.id);assert.notEqual(C.surfaceMountState(u,m).state,'蓄電設備破壊',key);}
}
});
