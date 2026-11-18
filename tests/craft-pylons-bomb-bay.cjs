const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance:{now:()=>0}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),plain=x=>JSON.parse(JSON.stringify(x));
const craft=()=>{const s=C.newShip({L:12,W:6,H:4,assembly:true},'Ordnance fixture');C.placePart(s,'struct',[6,2,0],[8,3,3],{form:'box'});return s;};

test('a pylon takes six missiles, three torpedoes or two bombs and is the pylon alone',()=>{
 const st=C.FITS.cpylon.store;assert.equal(C.storeCapacity(st,'cmsl'),6);assert.equal(C.storeCapacity(st,'ptorp'),3);assert.equal(C.storeCapacity(st,'bomb'),2);
 const s=craft(),r=C.placeFit(s,'cpylon',[6,.5,1],[0,-1,0],0,true);assert.ok(r.fit,r.err);
 const b=C.fitAABB(r.fit),d=C.FITS.cpylon;assert.ok(Math.abs((b[4]-b[1])-d.hm)<1e-6,'no stores hang from the design');
 const S=C.computeStats(s),stations=plain(C.craftStations(s,S));assert.deepEqual(stations,[{fit:'cpylon',mount:'wing',count:2}],'a mirrored pair is one station');
});
test('launch tubes are retired into pylons and old bomb-bay fittings into bomb-bay compartments',()=>{
 assert.equal(C.FITS.ctorp.catalogHidden,true);assert.equal(C.FITS.cbomb.catalogHidden,true);
 const s=craft();s.fits.push({id:s.nextId++,k:'ctorp',p:[8,.5,0],a:3,ped:0,base:0,low:0,float:false},{id:s.nextId++,k:'cbomb',p:[5,.5,0],a:3,ped:0,base:0,low:0,float:false});
 const loaded=C.deserialize(plain(C.serialize(s)));
 assert.deepEqual(loaded.fits.map(f=>f.k),['cpylon']);const bay=loaded.parts.find(p=>p.k==='bombBay');assert.ok(bay);assert.deepEqual(plain(bay.room),plain(C.FITS.cbomb.store.box));
 C.syncCompartments(loaded);assert.equal(C.bombBayOpen(loaded,bay),true,'its floor lies on the lower outer wall');
 const S=C.computeStats(loaded);assert.ok(C.craftStations(loaded,S).some(st=>st.mount==='bay'&&st.store?.box));
});
test('a bomb bay must lie wholly inside the structures with its floor on the lower skin',()=>{
 const s=craft(),deep=C.placePart(s,'bombBay',[6,2,0],1,{room:[2,.6,.7]});C.syncCompartments(s);
 assert.equal(C.bombBayOpen(s,deep),false,'a bay in the middle of the body has no open floor');
 const S=C.computeStats(s);assert.ok(S.warnings.some(w=>w.code==='bomb-bay'));assert.equal(C.craftStations(s,S).length,0);
});
test('stock craft carry their canon loads on pylons and bays',()=>{
 for(const [key,type] of [['craft_xwing','xwing'],['craft_btlb','btlb'],['craft_tie_sa','tie_sa']]){
  const s=C.buildDesign(key),S=C.computeStats(s),L=C.craftLoadout(s);assert.equal(L.canon,true,key);assert.ok(!s.fits.some(f=>['ctorp','cmsl','cbomb'].includes(f.k)),key);
  assert.equal(C.craftStations(s,S).length,C.CRAFT_LOADOUT[type].st.length,key);
 }
});
