// 2-5: a structure placed on a parent stays connected when the parent is converted to an editable mesh or its vertices are
// edited away from the contact. The conversion carries the child's stored surface reference to the parent's new mesh
// patch; a face that really disappears is still a repair state (structure-placement-modes.cjs).
const assert=require('node:assert/strict'),path=require('node:path'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')));
const ground=s=>{const st={warnings:[]};C.groundingStats(s,st);return Array.from(st.ungrounded?.parts||[]);};
function setup(){const s=C.newShip({L:300,W:120,H:60,assembly:true},'vertex');const parent={id:1,k:'struct',form:'box',c:[150,20,0],s:[200,80,20],label:'parent'};s.parts=[parent];s.fits=[];s.nextId=2;
 const hit=C.rayPart([150,500,0],[0,-1,0],parent),n=C.norm(hit.n),pv={id:2,k:'struct',form:'box',c:[hit.p[0],hit.p[1]+3.6,hit.p[2]],s:[40,30,12]};
 const d=C.preparePlacementDraft(s,pv,{mode:'horizontal',parentStructureId:1,hostId:1,hit:{p:hit.p,n},contactFit:'cut',position:pv.c.slice(),placementModelVersion:C.PLACEMENT_MODEL_VERSION});assert.equal(d.ok,true,d.error);s.parts.push(d.part);s.nextId=3;C.refreshPlacementGeometry(s);assert.deepEqual(ground(s),[]);return s;}
// The editor converts a structure with Core.convertStructToMesh (js/app.js 'meshconvert').
function toMesh(s,id){const q=s.parts.find(p=>p.id===id);assert.equal(C.convertStructToMesh(s,q),true);C.refreshPlacementGeometry(s);return q;}
function move(s,id,pick,d){const q=s.parts.find(p=>p.id===id),ids=q.mesh.v.map((p,i)=>pick(p)?i:-1).filter(i=>i>=0),r=C.meshMoveVertices(q,ids,d,{mirror:false});assert.ok(!r.error,r.error);q.mesh=r.mesh;C.refitStructMesh(q);C.refreshPlacementGeometry(s);}
const child=s=>s.parts.find(p=>p.id===2);
test('the editor uses the Core conversion',()=>{assert.match(require('node:fs').readFileSync(path.join(path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),'js/app.js'),'utf8'),/C\.convertStructToMesh\(ship,q,mm\)/);});
test('converting the parent to an editable mesh keeps the child connected',()=>{const s=setup();toMesh(s,1);assert.equal(child(s)._placementError||null,null);assert.deepEqual(ground(s),[]);});
test('editing parent vertices away from the contact keeps the child connected, also after saving and loading',()=>{
 const s=setup(),q=toMesh(s,1),xmin=Math.min(...q.mesh.v.map(p=>p[0]));move(s,1,p=>p[0]<xmin+1e-6,[-10,0,0]);
 assert.equal(child(s)._placementError||null,null);assert.deepEqual(ground(s),[]);
 const t=C.deserialize(C.serialize(s));C.refreshPlacementGeometry(t);assert.deepEqual(ground(t),[]);
});
test('lowering the parent bottom keeps the child connected',()=>{const s=setup(),q=toMesh(s,1),ymin=Math.min(...q.mesh.v.map(p=>p[1]));move(s,1,p=>p[1]<ymin+1e-6,[0,-5,0]);assert.deepEqual(ground(s),[]);});
// 2026-11-13 user decision: no fitting. Until then an edit of the child's own vertices re-fitted its base onto the parent
// top. Now the child keeps the shape it was given (its base is sunk 2.4 m into the parent): an edit that keeps an
// overlap stays connected; one that lifts the base clear of the parent is not moved and is reported (contact-zero).
test('editing the child itself keeps its own shape: still overlapping stays connected, lifted clear is reported where it is',()=>{
 const s=setup(),q=toMesh(s,2),top=C.partAABB(s.parts[0])[4],ymin=Math.min(...q.mesh.v.map(p=>p[1]));assert.ok(C.partAABB(child(s))[1]<top-2,'sunk into the parent, not cut');
 move(s,2,p=>p[1]<ymin+1e-6,[0,1,0]);assert.equal(child(s)._placementError||null,null);assert.deepEqual(ground(s),[]);
 const y2=Math.min(...child(s).mesh.v.map(p=>p[1]));move(s,2,p=>p[1]<y2+1e-6,[0,4,0]);assert.ok(Math.abs(C.partAABB(child(s))[1]-(top+2.6))<1e-3,'lifted clear by the edit itself, not re-seated: '+C.partAABB(child(s))[1]);assert.equal(child(s)._placementError,'contact-zero');
});
