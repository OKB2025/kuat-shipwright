const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),plain=x=>JSON.parse(JSON.stringify(x)),near=(a,b,epsilon=1e-5)=>assert.ok(Math.abs(a-b)<=epsilon,`${a} differs from ${b}`);
function fixture({legacy=false,cut=false}={}){
 const s=C.newShip({L:100,W:100,H:100,assembly:true},'Clipped aviation hatch');Object.assign(s,{parts:[{id:1,k:'struct',form:'box',c:[0,0,0],s:[16,20,10]}],fits:[],hatches:[],links:[],groups:[],nextId:3,detail:0,autoHabitation:false});
 if(cut)s.solidCuts=[C.normalizeSolidCut({id:7,shape:'box',c:[8,0,0],s:[2,40,20],structures:true})];
 let p={id:2,k:'hangar',c:[0,0,0],d:Math.cbrt(4000),room:[20,20,10]};if(!legacy){const solved=C.solvePlacement(s,p,{mode:'clip',hostId:1});assert.equal(solved.ok,true,solved.error);p=solved.part;}s.parts.push(p);C.syncCompartments(s);return {s,p};
}
function verifyEffective(s,p,volume=3200){
 near(C.partVolume(p),volume);near(C.meshVolume(p._clip.tris),volume);near(C.hangarCapacity(p),volume/C.AVIATION_SIZE_VOLUME);assert.equal(C.inPart(p,[9,0,0]),false);assert.equal(C.inPart(p,[0,0,0]),true);near(C.rayPart([30,0,0],[-1,0,0],p).p[0],volume===3000?7:8);
 assert.equal(p._interiorPlacementError,undefined);assert.deepEqual(plain(p.room),[20,20,10]);assert.equal(p.placement.mode,'clip');assert.equal(p.placement.hostId,1);near(C.partVolume(p.placement.requestedGeometry),4000);
 // Compile the real parent apertures and render the real clipped bay. This
 // exercises the next background calculation after a hatch has cut the skin.
 C.hullGeo(s);const g=G.meshParts(s,{}).g,surface=s.hatches.some(h=>h.bay===p.id)?g.hangar:g.interior;assert.ok(surface.ni>0);const xs=[];for(let i=0;i<surface.ni;i++)xs.push(surface.pos[surface.idx[i]*3]);assert.ok(Math.max(...xs)<=8.00001&&Math.min(...xs)>=-8.00001);
}

test('hatch creation, type changes and removal retain the real clipped room and its effective capacity',()=>{
 const {s,p}=fixture();verifyEffective(s,p);for(const mode of ['open','ray','none']){
  const h=C.setAviationSurfaceMode(s,p,'top',mode);C.hullGeo(s);C.syncCompartments(s);verifyEffective(s,p);C.syncCompartments(s);verifyEffective(s,p);
  if(h){assert.ok(C.aviationHatchActive(s,h));assert.ok(C.hatchOpenArea(s,h)>0);const bounds=C.openingBounds(s,h);assert.ok(bounds[0]>=-8&&bounds[3]<=8,'the hatch belongs to the effective bay, not the uncut request');}
 }
});

test('opening and closing an actual sliding hatch does not reclip the usable airspace',()=>{
 const {s,p}=fixture(),h=C.setAviationSurfaceMode(s,p,'top','open');h.motion='slide';for(const open of [0,1,.4,0]){h.open=open;C.hullGeo(s);C.syncCompartments(s);verifyEffective(s,p);near(C.hatchOpenArea(s,h,0),0);assert.ok(C.hatchOpenArea(s,h,1)>0);}
});

test('saving, reloading and restoring the ordinary edit snapshots regenerate the same clipped solid with its hatch',()=>{
 const {s,p}=fixture(),before=plain(C.serialize(s));C.setAviationSurfaceMode(s,p,'top','ray');C.hullGeo(s);C.syncCompartments(s);const after=plain(C.serialize(s));
 for(const saved of [before,after,before,after]){const loaded=C.deserialize(saved),bay=loaded.parts.find(q=>q.id===2);C.syncCompartments(loaded);verifyEffective(loaded,bay);assert.equal(loaded.hatches.filter(h=>h.bay===2).length,saved.hatches.filter(h=>h.bay===2).length);assert.equal(C.publicJSON(bay.placement.requestedGeometry),C.publicJSON(p.placement.requestedGeometry));}
});

test('a linked hatch still rejects a moved room and a failed background recomputation retains the last valid clipped shape',()=>{
 const {s,p}=fixture();C.setAviationSurfaceMode(s,p,'top','open');C.hullGeo(s);C.syncCompartments(s);const source=C.publicJSON(s),moved=C.solvePlacement(s,{...p,c:[0,1,0]},{mode:'clip',hostId:1});assert.equal(moved.ok,false);assert.equal(moved.code,'opening-constraint');assert.equal(C.publicJSON(s),source);
 const clip=p._clip;s.parts=s.parts.filter(q=>q.id!==1);C.syncCompartments(s);assert.equal(p._clip,clip,'failed validation must not restore the full requested body');near(C.partVolume(p),3200);assert.equal(p._interiorPlacementError.code,'host-missing');assert.deepEqual(plain(p.room),[20,20,10]);
});

test('hatchless interior regeneration preserves authored solid cuts in the selected host',()=>{
 const {s,p}=fixture({cut:true});verifyEffective(s,p,3000);C.setAviationSurfaceMode(s,p,'top','open');C.hullGeo(s);C.syncCompartments(s);verifyEffective(s,p,3000);assert.equal(C.inPart(p,[7.5,0,0]),false);
 const loaded=C.deserialize(C.serialize(s)),bay=loaded.parts.find(q=>q.id===2);C.syncCompartments(loaded);verifyEffective(loaded,bay,3000);assert.equal(C.inPart(bay,[7.5,0,0]),false);
});

test('legacy automatically clipped aviation rooms keep the same effective body when a hatch is added or changed',()=>{
 const {s,p}=fixture({legacy:true}),volume=C.partVolume(p);assert.ok(p._clip?.tris.length);assert.ok(volume>3100&&volume<3300);assert.equal(p.placement,undefined);
 for(const mode of ['open','ray','none']){C.setAviationSurfaceMode(s,p,'top',mode);C.hullGeo(s);C.syncCompartments(s);near(C.partVolume(p),volume);assert.equal(p.placement,undefined);assert.deepEqual(plain(p.room),[20,20,10]);assert.equal(C.inPart(p,[9,0,0]),false);}
 const loaded=C.deserialize(C.serialize(s)),bay=loaded.parts.find(q=>q.id===2);C.syncCompartments(loaded);near(C.partVolume(bay),volume);assert.equal(bay.placement,undefined);
});

test('both a legacy root hull and an owned hull retain the clipped aviation room when their real skin is opened',()=>{
 for(const owned of [false,true]){
  const s=C.newShip({L:16,W:20,H:10,plan:'rect',sec:'rect',bowW:1,bowH:1,stern:1},'Root hull bay');s.autoHabitation=false;s.detail=0;const owner=owned?C.ensurePrimaryHull(s):null,input={id:s.nextId++,k:'hangar',c:[8,5,0],room:[20,20,10],d:Math.cbrt(4000)},r=C.solvePlacement(s,input,{mode:'clip',hostId:owner?.id??'hull'});assert.equal(r.ok,true,r.error);s.parts.push(r.part);C.syncCompartments(s);
  const h=C.setAviationSurfaceMode(s,r.part,'top','open');C.hullGeo(s);if(owner)C.structTriangles(owner);C.syncCompartments(s);near(C.partVolume(r.part),3200);assert.equal(r.part._interiorPlacementError,undefined);assert.ok(C.aviationHatchActive(s,h));if(owner){assert.equal(h.hullOwner,owner.id);assert.ok(owner.hullData.hatches.some(q=>q.id===h.hullHatch));}
  const loaded=C.deserialize(C.serialize(s)),bay=loaded.parts.find(q=>q.id===input.id);C.syncCompartments(loaded);near(C.partVolume(bay),3200);near(C.hangarCapacity(bay),3200/C.AVIATION_SIZE_VOLUME);assert.equal(bay._interiorPlacementError,undefined);assert.equal(bay.placement.hostId,owner?.id??'hull');assert.deepEqual(plain(bay.placement.requestedGeometry.room),[20,20,10]);assert.equal(C.inPart(bay,[17,5,0]),false);
 }
});
