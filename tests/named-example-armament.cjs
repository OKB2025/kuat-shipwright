const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),near=(a,b,e=1e-5)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`),renderedShapes=new WeakMap();
const boxesHaveGap=(a,b,gap=.25)=>[0,1,2].some(i=>a[i+3]+gap<=b[i]||b[i+3]+gap<=a[i]);
function renderedShape(f){
 if(renderedShapes.has(f))return renderedShapes.get(f);
 if(!C.REFERENCE_ASSETS[f.skinAsset||C.FITS[f.k]?.asset])return null;
 const ship={parts:[],fits:[f],hatches:[]},bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity],triangles=[];
 // Use the real indexed body, automatic support and manual pedestal meshes.
 for(const g of [G.meshReferenceFits(ship,null,[f]),G.meshFits(ship,null,null,[f])])for(let i=0;i<g.ni;i+=3){
  const b=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
  for(let j=0;j<3;j++)for(let a=0;a<3;a++){const v=g.pos[g.idx[i+j]*3+a];b[a]=Math.min(b[a],v);b[a+3]=Math.max(b[a+3],v);bounds[a]=Math.min(bounds[a],v);bounds[a+3]=Math.max(bounds[a+3],v);}
  triangles.push(b);
 }
 const shape=triangles.length?{bounds,triangles}:null;renderedShapes.set(f,shape);return shape;
}
function modelsHaveGap(f,g){
 if(boxesHaveGap(C.fitAABB(f),C.fitAABB(g)))return true;
 const a=renderedShape(f),b=renderedShape(g);if(!a||!b)return false;
 const contains=(outer,inner)=>[0,1,2].every(i=>outer[i]<=inner[i]&&outer[i+3]>=inner[i+3]);
 // A sufficient narrow check: one complete rendered boundary must clear the
 // other's expanded box. Reject containment; every unresolved pair still fails.
 const outside=(shape,box)=>!contains(shape.bounds,box)&&shape.triangles.every(t=>boxesHaveGap(t,box));
 return outside(a,b.bounds)||outside(b,a.bounds);
}
function verify(key,expected){
 const ship=C.buildDesign(key),guns=ship.fits.filter(f=>C.needsCapacitor(f)),counts={};for(const f of guns)counts[f.k]=(counts[f.k]||0)+1;assert.deepEqual(counts,expected,key+' installs the requested independent turret roster');
 C.syncCompartments(ship);C.remount(ship);C.syncCompartments(ship);
 const stats=C.computeStats(ship),banks=C.weaponCapacitors(ship);
 for(let i=0;i<guns.length;i++){
  const f=guns[i],d=C.fitSpec(f),charge=stats.chargeInfo[f.id],geometry=C.authoredTurretGeometry(f);assert.notEqual(f.float,true,key+' '+f.k+' is seated');assert.ok(geometry,key+' '+f.k+' has real authored joints');assert.equal(geometry.muzzles.length,d.barrels,'every barrel has its own firing mouth');
  const up=C.fitUp(f),hit=C.rayEnv(ship,C.add(f.p,C.mul(up,3)),C.mul(up,-1),{maxT:80,structOnly:true});assert.ok(hit,'a structural mounting face lies beneath every turret');near(C.len(C.sub(hit.p,f.p)),0,.03);
  for(const muzzle of geometry.muzzles)assert.equal(C.insideOriginalEnvelope(ship,muzzle),false,key+' '+f.k+' muzzle must clear the hull');
  assert.ok(charge&&charge.ratio>1-1e-6,key+' '+f.k+' #'+f.id+' has a complete physical firing charge');assert.equal(charge.blocked,false);near(charge.storedTT,Math.max(d.tt||0,d.ion||0));near(charge.storedTT,charge.volume*C.CHARGE_TT_M3);
  if(charge.internalRequired>1e-5){assert.ok(charge.internalVolume>0);assert.ok(banks.some(p=>p.weaponId===f.id&&C.partVolume(p)>0),'housing shortfall has real internal hardware');}
  for(const g of guns.slice(i+1))assert.ok(modelsHaveGap(f,g),key+' neighbouring authored gun models have a physical gap: #'+f.id+' / #'+g.id);
 }
 return {ship,guns,stats,banks};
}
test('the supplied stepped ridge keeps a real rendered gap despite overlapping aggregate boxes',()=>{
 const ship=C.deserialize(JSON.parse(fs.readFileSync(path.join(root,'assets/source/imperial-ii-user-layout/imperial-ii-upload.json'))));
 for(const [a,b]of [[128,129],[129,130]]){const f=ship.fits.find(f=>f.id===a),g=ship.fits.find(f=>f.id===b);assert.equal(boxesHaveGap(C.fitAABB(f),C.fitAABB(g)),false,'the narrow check is exercised');assert.equal(modelsHaveGap(f,g),true,'body, foundation and manual pedestal remain apart');}
});
test('the rendered turret gap check rejects coincident and intersecting gun models',()=>{
 const f={id:1,k:'triple40',p:[100,30,0],a:2,ped:0,base:0,low:0,float:false};
 for(const shift of [0,4]){const g={...f,id:2,p:[100+shift,30,0]};assert.equal(modelsHaveGap(f,g),false,'an unresolved or occupied overlap cannot pass the narrow check');}
});
test('ISD has six 175 TT twins, two ion twins, paired quad broadsides, nine triples and twin PD',()=>{
 const {ship}=verify('imperial',{ion:2,stl:6,triple40:9,quad70Side:2,pd:20}),broadside=ship.fits.filter(f=>f.k==='quad70Side');assert.deepEqual(Array.from(broadside,f=>f.a).sort(),[4,5]);near(broadside[0].p[0],broadside[1].p[0]);near(broadside[0].p[2],-broadside[1].p[2]);
 const heavy=ship.fits.filter(f=>f.k==='stl'||f.k==='ion');for(const x of [292.8,353.9,414.9,477.7])assert.equal(heavy.filter(f=>Math.abs(f.p[0]-x)<.1).length,2,'all eight surveyed heavy wells remain in use');
});
test('Venator preserves eight DBY twins, mounts the two 70TT×2 side guns and charged trench singles, and distributes PD',()=>{
 const {ship,guns,banks}=verify('venator',{refVen:8,venSide70:2,single200:10,pd:28}),singles=guns.filter(f=>f.k==='single200'),side=guns.filter(f=>f.k==='venSide70');
 assert.deepEqual(Array.from(side,f=>f.a).sort(),[4,5]);for(const f of side){near(f.p[0],763,1e-6);assert.ok(f.batteryZone.endsWith('-trench'));}near(side[0].p[2],-side[1].p[2]);
 for(const x of [620,710,850,940,1030]){const pair=singles.filter(f=>Math.abs(f.p[0]-x)<1e-5);assert.equal(pair.length,2);assert.deepEqual(Array.from(pair,f=>f.a).sort(),[4,5]);near(pair[0].p[2],-pair[1].p[2]);assert.ok(pair.every(f=>f.batteryZone.endsWith('-trench')&&f.localMount));}
 for(const f of singles){const bank=banks.find(p=>p.weaponId===f.id);assert.ok(bank);for(const room of ship.parts.filter(p=>p.room&&['hangar','service'].includes(p.k)))assert.equal(C.overlapParts(bank,room),false,'aviation decks reserve the real trench charging unit');}
 assert.ok(ship.fits.some(f=>f.k==='pd'&&f.a===2));assert.ok(ship.fits.some(f=>f.k==='pd'&&f.a===3));
});
test('Nebulon B uses exactly three 200 GT twins and five twin PD mounts',()=>{verify('nebulonb',{twin200:3,pd:5});});
test('Acclamator has twelve 200 GT quads and twelve twin PD stations across both brim edges',()=>{
 const {guns}=verify('acclamator',{quad200:12,pd:12}),pd=guns.filter(f=>f.k==='pd');assert.equal(pd.filter(f=>f.p[2]>0).length,6);assert.equal(pd.filter(f=>f.p[2]<0).length,6);assert.ok(Math.max(...pd.map(f=>f.p[0]))>600,'the defensive stations cover the forward brim as well as the stern');
});
