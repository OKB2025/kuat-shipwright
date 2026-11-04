const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx);

function fixture(z=145,room=false){
 const ship=C.newShip({L:600,W:300,H:120,plan:'rect',sec:'rect',bowW:1,bowH:1,stern:1},'Internal facility walls');
 ship.parts=[];ship.fits=[];ship.detail=0;ship.autoHabitation=false;
 const bay=C.placePart(ship,'hangar',[300,60,z],40,{allowOverlap:true,...(room?{room:[40,40,40]}:{})},false);
 C.openBay(ship,bay,'stbd','ray');C.syncCompartments(ship);return {ship,bay};
}
function positions(g){const out=[];for(let i=0;i<g.ni;i++){const k=g.idx[i]*3;out.push(...g.pos.subarray(k,k+3));}return out;}
function digest(g){return ['pos','nor','col','idx'].map(k=>createHash('sha256').update(Buffer.from(g[k].buffer,g[k].byteOffset,(k==='idx'?g.ni:g.n*(k==='col'?4:3))*g[k].BYTES_PER_ELEMENT)).digest('hex'));}
function withinHull(g){for(const v of positions(g).filter((_,i)=>i%3===2))assert.ok(v<=150.001,'internal walls extend beyond the hull side');}

test('legacy cube hangars use the same clipped walls and opening as explicit rectangular rooms',()=>{
 const legacy=fixture(),room=fixture(145,true),source=C.publicJSON(legacy.ship);
 for(const coded of [false,true]){
  const a=G.meshParts(legacy.ship,{coded}),b=G.meshParts(room.ship,{coded});
  assert.ok(legacy.bay._clip?.tris.length>0);assert.equal(legacy.bay.room,undefined,'rendering must preserve legacy requested dimensions');
  assert.ok(a.g.hangar.ni>0,'the usable bay and its opening must remain visible');withinHull(a.g.hangar);
  assert.deepEqual(digest(a.g.hangar),digest(b.g.hangar),'the legacy cube must retain the established clipped-room opening and inner walls');
 }
 assert.equal(C.publicJSON(legacy.ship),source);
});

test('an entirely outside hangar respects its empty clipping mask',()=>{
 const {ship,bay}=fixture(200),source=C.publicJSON(ship),result=G.meshParts(ship,{coded:true});
 assert.equal(bay._clip.tris.length,0);assert.equal(C.partVolume(bay),0);
 assert.equal(result.g.hangar.ni,0,'an empty clipped solid cannot fall back to the requested cube');
 assert.equal(result.ranges[bay.id],undefined);assert.equal(C.publicJSON(ship),source);
});

test('moving and reloading a legacy hangar refreshes clipped walls for design and both fleet renderers',()=>{
 const {ship,bay}=fixture(100);assert.equal(G.meshParts(ship,{coded:false}).g.hangar.ni,36);assert.equal(bay._clip,undefined);
 bay.c[2]=145;withinHull(G.meshParts(ship,{coded:false}).g.hangar);assert.ok(bay._clip);
 bay.c[2]=200;assert.equal(G.meshParts(ship,{coded:false}).g.hangar.ni,0);
 bay.c[2]=145;const model=C.deserialize(C.serialize(ship)),expected=G.meshParts(model,{coded:false}).g.hangar;assert.ok(expected.ni>0);withinHull(expected);
 const webgl={fleetCache:new Map(),loadFleet(key,data){this.fleetCache.set(key,data);return data;}},canvas={width:8,height:8,clientWidth:8,clientHeight:8,getContext:kind=>kind==='2d'?{}:null};
 const assets=[G.fleetGeometry(model),G.Renderer.prototype.prepareFleet.call(webgl,'bay',model),new G.CompatRenderer(canvas).prepareFleet('bay',model)];
 for(const asset of assets){const g=asset.meshes.hangar.geo;withinHull(g);assert.deepEqual(digest(g),digest(expected));}
});

test('live edits leave internal requested solids to the engine while preserving exposed equipment and selection outlines',()=>{
 const {ship,bay}=fixture(),parts=[bay,...['fuel','aux','hyper'].map((k,i)=>({id:100+i,k,c:[300,60,170],d:20})),{id:110,k:'gen',c:[300,60,170],d:20,surfaceRole:'cooling',surfacePatch:'hull:test'}];
 const exposed=['gen','shield','engine'].map((k,i)=>({id:120+i,k,c:[300,60,190],d:12})),source=C.publicJSON(ship),sync=C.syncCompartments;
 C.syncCompartments=()=>{throw new Error('a pointer preview must not synchronously recompute compartment clipping');};
 try{for(const coded of [false,true]){
  const internal=G.meshPreview(ship,parts,[],{coded});assert.equal(internal.preview.ni,0,'requested internal walls must never be uploaded as an exterior preview');assert.equal(internal.previewRef.ni,0);
  const mixed=G.meshPreview(ship,[...parts,...exposed],[],{coded}),external=G.meshPreview(ship,exposed,[],{coded});assert.ok(external.preview.ni>0);assert.deepEqual(digest(mixed.preview),digest(external.preview),'external reactors, shields and engines retain their live solids');
  for(const p of parts){const lines=G.lineSet();lines.part(p,[105,195,220,255]);assert.ok(lines.out().pos.length>0,'requested dimensions must remain available as selection outlines');}
 }}finally{C.syncCompartments=sync;}
 assert.equal(C.publicJSON(ship),source);
});
