// Audit of 2026-11-14 (user request: "他にも古い処理が残ってないか確認して"). Leftovers of the parent / fit model that
// still judged a part against the body it was tapped on, kept a refusal after its cause was gone, or made a weapon
// follow a body. With no parent relation, contact with any body decides, and a user's move is taken as it is.
const assert=require('node:assert/strict'),path=require('node:path'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),{C}=require('../scripts/update-ship-examples.cjs').loadRuntime(root);
const plain=v=>JSON.parse(C.publicJSON(v)),reload=s=>{const L=C.deserialize(structuredClone(C.serialize(s)));C.refreshPlacementGeometry(L);return L;};
const base=()=>{const s=C.newShip({L:300,W:200,H:100,assembly:true},'audit');Object.assign(s,{parts:[{id:1,k:'struct',form:'box',c:[0,0,0],s:[120,80,80]},{id:2,k:'struct',form:'box',c:[0,60,0],s:[40,40,40]},{id:3,k:'struct',form:'box',c:[0,60,30],s:[40,20,40]}],fits:[],hatches:[],links:[],groups:[],nextId:4,autoHabitation:false,detail:0});s.armor={hull:0,cit:0};C.refreshPlacementGeometry(s);return s;};
const pd={id:-1,k:'pd',p:[0,0,0],n:[0,1,0],a:2,ped:.3,assetYaw:17,mountMode:'auto'};

test('1: a sensor moved from its tapped body onto an adjacent body it touches is not red, and stays so through a reload',()=>{
 const s=base(),top=C.rayPart([0,500,0],[0,-1,0],s.parts[1]),r=C.commitPlacement(s,{id:-1,k:'sensor',c:[0,top.p[1]+1,0],d:2},{mode:'direct',parentStructureId:2,hit:{p:Array.from(top.p),n:[0,1,0]}});assert.equal(r.ok,true,r.error);C.refreshPlacementGeometry(s);
 const e=s.parts.find(p=>p.k==='sensor');e.c=[0,e.c[1],30];let f=C.refreshPlacementGeometry(s);assert.deepEqual(plain(e.c),[0,e.c[1],30],'where the user put it');assert.equal(e._placementError,undefined);assert.equal(e.placement.repairRequired,undefined,'nothing is stored');assert.deepEqual(plain(f.failed),[]);
 f=C.refreshPlacementGeometry(s);assert.equal(e._placementError,undefined);const g=reload(s).parts.find(p=>p.k==='sensor');assert.equal(g._placementError,undefined);assert.equal(g.placement.repairReason,undefined);
 // moved to where it touches nothing: red there, with nothing stored; back on a body it works again
 e.c=[0,300,30];f=C.refreshPlacementGeometry(s);assert.equal(e._placementError,'contact-zero');assert.equal(e.placement.repairRequired,undefined);e.c=[0,top.p[1]+1,30];f=C.refreshPlacementGeometry(s);assert.equal(e._placementError,undefined);
});
test('1: a stored contact refusal of exterior equipment is dropped on load and judged afresh',()=>{
 const s=base(),top=C.rayPart([0,500,0],[0,-1,0],s.parts[1]),r=C.commitPlacement(s,{id:-1,k:'sensor',c:[0,top.p[1]+1,0],d:2},{mode:'direct',parentStructureId:2,hit:{p:Array.from(top.p),n:[0,1,0]}});assert.equal(r.ok,true,r.error);C.refreshPlacementGeometry(s);
 const saved=structuredClone(C.serialize(s)),q=saved.parts.find(p=>p.k==='sensor');q.placement.repairRequired=true;q.placement.repairReason='surface-missing';const L=C.deserialize(saved);C.refreshPlacementGeometry(L);const g=L.parts.find(p=>p.k==='sensor');assert.equal(g.placement.repairRequired,undefined);assert.equal(g._placementError,undefined);
});
test('2: a structure refused for interfering with equipment is cleared once the equipment is gone, also after a reload',()=>{
 const s=base(),top=C.rayPart([40,500,0],[0,-1,0],s.parts[0]),r=C.commitPlacement(s,{id:-1,k:'sensor',c:[40,top.p[1]+1,0],d:2},{mode:'direct',parentStructureId:1,hit:{p:Array.from(top.p),n:[0,1,0]}});assert.equal(r.ok,true,r.error);
 const h=C.rayPart([-40,500,0],[0,-1,0],s.parts[0]),c=[-40,h.p[1]+5,0],r2=C.commitPlacement(s,{id:-1,k:'struct',form:'box',c,s:[10,10,10]},{mode:'horizontal',parentStructureId:1,position:c,hit:{p:Array.from(h.p),n:Array.from(h.n)},contactFit:'cut',contactSide:'bottom'});assert.equal(r2.ok,true,r2.error);C.refreshPlacementGeometry(s);
 const b=s.parts.find(p=>p.id===r2.part.id),sensor=s.parts.find(p=>p.k==='sensor');b.c=[40,b.c[1],0];C.refreshPlacementGeometry(s);assert.equal(b._placementError,'placement-interference','over the sensor it is refused');
 C.removeParts(s,[sensor.id]);const f=C.refreshPlacementGeometry(s);assert.equal(b._placementError,undefined);assert.equal(b.placement.repairRequired,undefined);assert.deepEqual(plain(f.failed),[]);const g=reload(s).parts.find(p=>p.id===b.id);assert.equal(g._placementError,undefined);
});
test('3: an anchored weapon whose body is moved away is supported by another structure put under its seat',()=>{
 const s=C.newShip({L:300,W:200,H:100,assembly:true},'audit');s.parts=[{id:1,k:'struct',form:'box',c:[0,0,0],s:[300,200,20]},{id:2,k:'struct',form:'box',c:[0,20,0],s:[40,40,20]},{id:3,k:'struct',form:'box',c:[100,20,0],s:[40,40,20]}];s.fits=[];s.links=[];s.armor={hull:0,cit:0};s.nextId=4;s.detail=0;C.refreshPlacementGeometry(s);
 const a=C.acceptFitPlacementResult(s,C.solveFitPlacement(s,pd,{mode:'direct',hostId:2,hit:{p:[0,30,0],n:[0,1,0]},geometryRevision:0,parentGeometryRevision:0}));assert.equal(a.ok,true,a.error);const f=s.fits[0],p0=JSON.stringify(f.p);C.refreshPlacementGeometry(s);C.remount(s,{keepFitPose:true});assert.equal(f.float,false);
 s.parts[1].c=[-100,20,0];s.parts[2].c=[0,20,0];s._cache=null;C.refreshPlacementGeometry(s);C.remount(s,{keepFitPose:true});assert.equal(f.float,false,'the other structure carries it');assert.equal(JSON.stringify(f.p),p0);
 const L=reload(s);C.remount(L,{keepFitPose:true});assert.equal(L.fits[0].float,false);
 s.parts[2].c=[100,20,0];s._cache=null;C.refreshPlacementGeometry(s);C.remount(s,{keepFitPose:true});assert.equal(f.float,true,'nothing under its seat: floating, where it was');assert.equal(JSON.stringify(f.p),p0);
});
test('4: a new weapon on an ungrounded structure is placed and idle, not refused; it does not follow that structure',()=>{
 const s=C.newShip({L:300,W:200,H:100,assembly:true},'audit');Object.assign(s,{parts:[{id:1,k:'struct',form:'box',c:[0,0,0],s:[120,80,80]}],fits:[],hatches:[],links:[],groups:[],nextId:2,autoHabitation:false,detail:0});s.armor={hull:0,cit:0};C.refreshPlacementGeometry(s);
 const h=C.rayPart([0,500,0],[0,-1,0],s.parts[0]),r=C.commitPlacement(s,{id:-1,k:'struct',form:'box',c:[0,h.p[1]+10,0],s:[40,40,20]},{mode:'horizontal',parentStructureId:1,position:[0,h.p[1]+10,0],hit:{p:Array.from(h.p),n:Array.from(h.n)},contactFit:'cut',contactSide:'bottom'});assert.equal(r.ok,true,r.error);
 const b=s.parts[1];C.refreshPlacementGeometry(s);const y0=b.c[1];b.c=[0,200,0];C.refreshPlacementGeometry(s);assert.equal(b._placementError,'contact-zero','the structure is lifted off: red');
 const top=C.rayPart([0,500,0],[0,-1,0],b),d=C.preparePlacementDraft(s,{...pd,id:s.nextId},{entityKind:'fit',mode:'direct',hostId:b.id,hit:{p:Array.from(top.p),n:[0,1,0]}});assert.equal(d.ok,true,d.error);d.fit.id=s.nextId++;s.fits.push(d.fit);
 let f=C.refreshPlacementGeometry(s);C.remount(s,{keepFitPose:true});const g=s.fits[0];assert.ok(!f.failed.some(q=>q.fitId===g.id),JSON.stringify(f.failed));assert.equal(g.placement.validationFailed,undefined);assert.equal(g.float,true);assert.equal(g._onLoose,true,'idle on the ungrounded structure');
 const p0=JSON.stringify(g.p);b.c=[0,y0,0];s._cache=null;C.refreshPlacementGeometry(s);C.remount(s,{keepFitPose:true});assert.equal(JSON.stringify(g.p),p0,'it did not follow the structure');assert.equal(g.float,true,'left in the air it floats');
});
