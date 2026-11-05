const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx),near=(a,b,e=1e-5)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
function verify(key,expected){
 const ship=C.buildDesign(key),guns=ship.fits.filter(f=>C.needsCapacitor(f)),counts={};for(const f of guns)counts[f.k]=(counts[f.k]||0)+1;assert.deepEqual(counts,expected,key+' installs the requested independent turret roster');
 const stats=C.computeStats(ship),banks=C.weaponCapacitors(ship);
 for(let i=0;i<guns.length;i++){
  const f=guns[i],d=C.fitSpec(f),charge=stats.chargeInfo[f.id],geometry=C.authoredTurretGeometry(f);assert.equal(f.float,false,key+' '+f.k+' is seated');assert.ok(geometry,key+' '+f.k+' has real authored joints');assert.equal(geometry.muzzles.length,d.barrels,'every barrel has its own firing mouth');
  const up=C.fitUp(f),hit=C.rayEnv(ship,C.add(f.p,C.mul(up,3)),C.mul(up,-1),{maxT:80,structOnly:true});assert.ok(hit,'a structural mounting face lies beneath every turret');near(C.len(C.sub(hit.p,f.p)),0,.03);
  for(const muzzle of geometry.muzzles)assert.equal(C.insideOriginalEnvelope(ship,muzzle),false,key+' '+f.k+' muzzle must clear the hull');
  assert.ok(charge&&charge.ratio>1-1e-6,key+' '+f.k+' has a complete physical firing charge');assert.equal(charge.blocked,false);near(charge.storedTT,Math.max(d.tt||0,d.ion||0));near(charge.storedTT,charge.volume*C.CHARGE_TT_M3);
  if(charge.internalRequired>1e-5){assert.ok(charge.internalVolume>0);assert.ok(banks.some(p=>p.weaponId===f.id&&C.partVolume(p)>0),'housing shortfall has real internal hardware');}
  const a=C.fitAABB(f);for(const g of guns.slice(i+1)){const b=C.fitAABB(g);assert.ok([0,1,2].some(j=>a[j+3]+.25<=b[j]||b[j+3]+.25<=a[j]),key+' neighbouring authored gun models have a physical gap');}
 }
 return {ship,guns,stats,banks};
}
test('ISD has six 175 TT twins, two ion twins, paired quad broadsides, nine triples and twin PD',()=>{
 const {ship}=verify('imperial',{ion:2,stl:6,triple40:9,quad70Side:2,pd:20}),broadside=ship.fits.filter(f=>f.k==='quad70Side');assert.deepEqual(Array.from(broadside,f=>f.a).sort(),[4,5]);near(broadside[0].p[0],broadside[1].p[0]);near(broadside[0].p[2],-broadside[1].p[2]);
 const heavy=ship.fits.filter(f=>f.k==='stl'||f.k==='ion');for(let i=0;i<4;i++)assert.equal(heavy.filter(f=>Math.abs(f.p[0]-(281.76+62.36*i))<.1).length,2,'all eight surveyed heavy wells remain in use');
});
test('Venator preserves eight DBY twins and two medium twins with charged trench singles and distributed PD',()=>{
 const {ship,guns,banks}=verify('venator',{refVen:8,twin40:2,single200:10,pd:28}),singles=guns.filter(f=>f.k==='single200');
 for(const x of [620,710,850,940,1030]){const pair=singles.filter(f=>Math.abs(f.p[0]-x)<1e-5);assert.equal(pair.length,2);assert.deepEqual(Array.from(pair,f=>f.a).sort(),[4,5]);near(pair[0].p[2],-pair[1].p[2]);assert.ok(pair.every(f=>f.batteryZone.endsWith('-trench')&&f.localMount));}
 for(const f of singles){const bank=banks.find(p=>p.weaponId===f.id);assert.ok(bank);for(const room of ship.parts.filter(p=>p.room&&['hangar','service'].includes(p.k)))assert.equal(C.overlapParts(bank,room),false,'aviation decks reserve the real trench charging unit');}
 assert.ok(ship.fits.some(f=>f.k==='pd'&&f.a===2));assert.ok(ship.fits.some(f=>f.k==='pd'&&f.a===3));
});
test('Nebulon B uses exactly three 200 GT twins and five twin PD mounts',()=>{verify('nebulonb',{twin200:3,pd:5});});
test('Acclamator has twelve 200 GT quads and twelve twin PD stations across both brim edges',()=>{
 const {guns}=verify('acclamator',{quad200:12,pd:12}),pd=guns.filter(f=>f.k==='pd');assert.equal(pd.filter(f=>f.p[2]>0).length,6);assert.equal(pd.filter(f=>f.p[2]<0).length,6);assert.ok(Math.max(...pd.map(f=>f.p[0]))>600,'the defensive stations cover the forward brim as well as the stern');
});
