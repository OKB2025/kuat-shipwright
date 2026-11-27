const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance:{now:()=>0}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),plain=x=>JSON.parse(JSON.stringify(x));
const craft=()=>{const s=C.newShip({L:12,W:6,H:4,assembly:true},'Ordnance fixture');C.placePart(s,'struct',[6,2,0],[8,3,3],{form:'box'});return s;};

// 2026-11-26 expectation changed (user「パイロンは一つあたりミサイル、魚雷一つ、爆弾は3個で」): was six missiles, three torpedoes or two bombs.
test('a pylon takes one missile, one torpedo or three bombs and is the pylon alone',()=>{
 const st=C.FITS.cpylon.store;assert.equal(C.storeCapacity(st,'cmsl'),1);assert.equal(C.storeCapacity(st,'ptorp'),1);assert.equal(C.storeCapacity(st,'bomb'),3);
 const s=craft(),r=C.placeFit(s,'cpylon',[6,.5,1],[0,-1,0],0,true);assert.ok(r.fit,r.err);
 const b=C.fitAABB(r.fit),d=C.FITS.cpylon;assert.ok(Math.abs((b[4]-b[1])-d.hm)<1e-6,'no stores hang from the design');
 const S=C.computeStats(s),stations=plain(C.craftStations(s,S));assert.deepEqual(stations,[{fit:'cpylon',mount:'wing',count:2}],'a mirrored pair is one station');
});
// 2026-11-23 expectation changed: launch tubes are no longer turned into pylons (user: 「発射管を復活」); the bomb-bay fitting still becomes a compartment.
test('launch tubes load as tubes and old bomb-bay fittings become bomb-bay compartments',()=>{
 assert.notEqual(C.FITS.ctorp.catalogHidden,true);assert.equal(C.FITS.cbomb.catalogHidden,true);
 const s=craft();s.fits.push({id:s.nextId++,k:'ctorp',p:[8,.5,0],a:3,ped:0,base:0,low:0,float:false},{id:s.nextId++,k:'cbomb',p:[5,.5,0],a:3,ped:0,base:0,low:0,float:false});
 const loaded=C.deserialize(plain(C.serialize(s)));
 assert.deepEqual(loaded.fits.map(f=>f.k),['ctorp']);const bay=loaded.parts.find(p=>p.k==='bombBay');assert.ok(bay);assert.deepEqual(plain(bay.room),plain(C.FITS.cbomb.store.box));
 C.syncCompartments(loaded);assert.equal(C.bombBayOpen(loaded,bay),true,'its floor lies on the lower outer wall');
 const S=C.computeStats(loaded);assert.ok(C.craftStations(loaded,S).some(st=>st.mount==='bay'&&st.store?.box));assert.ok(C.craftStations(loaded,S).some(st=>st.fit==='ctorp'&&st.mount==='tube'));
});
// 2026-11-23: a launch tube seated inside the hull by less than its length counts as seated while its mouth is open (user: 「案Bに」).
test('a launch tube sunk into the hull is seated while its mouth is open, and not when it is shut',()=>{
 const open=craft();open.fits.push({id:open.nextId++,k:'ctorp',p:[6,.52,0],n:[0,-1,0],a:3,ped:0,base:0,low:0,localMount:true,placement:{modelVersion:1,mode:'direct'}});
 const a=C.deserialize(plain(C.serialize(open)));C.syncCompartments(a);C.remount(a,{keepFitPose:true});const fa=a.fits.find(f=>f.k==='ctorp');
 assert.equal(!!fa.float,false,'2 cm into the belly, mouth ahead in open space');assert.equal(C.craftMuzzleBlocked(a,fa),false);
 const shut=craft();C.placePart(shut,'struct',[7.1,.4,0],[1,.6,1],{form:'box'});shut.fits.push({id:shut.nextId++,k:'ctorp',p:[6,.52,0],n:[0,-1,0],a:3,ped:0,base:0,low:0,localMount:true,placement:{modelVersion:1,mode:'direct'}});
 const b=C.deserialize(plain(C.serialize(shut)));C.syncCompartments(b);C.remount(b,{keepFitPose:true});assert.equal(b.fits.find(f=>f.k==='ctorp').float,true,'a block across its mouth');
});
test('a bomb bay must lie wholly inside the structures with its floor on the lower skin',()=>{
 const s=craft(),deep=C.placePart(s,'bombBay',[6,2,0],1,{room:[2,.6,.7]});C.syncCompartments(s);
 assert.equal(C.bombBayOpen(s,deep),false,'a bay in the middle of the body has no open floor');
 const S=C.computeStats(s);assert.ok(S.warnings.some(w=>w.code==='bomb-bay'));assert.equal(C.craftStations(s,S).length,0);
});
// 2026-11-23 expectation changed: the stock craft carry their tubes again.
// 2026-11-27: the BTL-B's canon stations are its tubes and pylons (the refit has no bay; CRAFT_LOADOUT.btlb changed to match).
test('stock craft carry their canon loads in tubes and bays',()=>{
 for(const [key,type] of [['craft_xwing','xwing'],['craft_btlb','btlb'],['craft_tie_sa','tie_sa']]){
  const s=C.buildDesign(key),S=C.computeStats(s),L=C.craftLoadout(s);assert.equal(L.canon,true,key);assert.ok(!s.fits.some(f=>f.k==='cbomb'),key);assert.ok(s.fits.some(f=>f.k==='ctorp'),key);
  assert.equal(C.craftStations(s,S).length,C.CRAFT_LOADOUT[type].st.length,key);
 }
});
// 2026-11-23 (regression review): a loadout chosen in the other order of a [tube, bay] craft keeps its bombs in the bay.
// 2026-11-27 test changed (user「Y-wingの爆弾倉は設定資料を見ても見当たらないのでパイロンで代用した」): the refit BTL-B has no bomb bay (its bombs go
// on four pylons, below), so the case is checked on the TIE/sa, whose [tube, bay] stations stand (was the BTL-B).
test('a loadout in the other order keeps its bombs in the bay against the tube station',()=>{
 const L=C.craftLoadout(C.buildDesign('craft_tie_sa'));assert.deepEqual(plain(L.stations.map(s=>s.mount)),['tube','bay']);
 const got=plain(C.craftOrdnance(C.buildDesign('craft_tie_sa'),[{k:'bomb',n:8},{k:'ptorp',n:3}]));assert.equal(got.find(x=>x.kind==='bomb')?.mount,'bay');assert.equal(got.find(x=>x.kind==='ptorp')?.mount,'tube');
});
test('the refit BTL-B carries its canon proton bombs on its pylons: two a pylon, eight in all, with its twelve torpedoes',()=>{
 const s=C.buildDesign('craft_btlb'),L=C.craftLoadout(s);assert.equal(L.canon,true);assert.deepEqual(plain(L.stations.map(x=>x.mount)),['tube','wing','wing']);assert.ok(!s.parts.some(p=>p.k==='bombBay'),'no bomb bay');
 const got=plain(C.craftOrdnance(s,L.load));assert.equal(got.filter(x=>x.kind==='bomb').reduce((n,x)=>n+x.n,0),8);assert.ok(got.filter(x=>x.kind==='bomb').every(x=>x.mount==='wing'));assert.equal(got.find(x=>x.kind==='ptorp')?.n,12);
});
