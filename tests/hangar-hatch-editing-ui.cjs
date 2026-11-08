const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
function appFunction(name){
 const start=new RegExp('function '+name+'\\s*\\(').exec(app);assert.ok(start,name+' is an actual editor function');
 for(let end=app.indexOf('}',start.index);end>=0;end=app.indexOf('}',end+1)){const source=app.slice(start.index,end+1);try{new vm.Script(source);return source;}catch{}}
 throw Error('Cannot extract '+name);
}
function fixture(){
 const cx=vm.createContext({console});for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
 vm.runInContext(`const C=Core,G=Gfx;let ship,editorPartsRevision=0,editorMountCache=null;const requestedParts={ship:null,records:new Map()},placementDraftPartCache=new WeakMap();const currentEditorGeometryContext=()=> 'hatch-test';function copyEditorHullCache(){throw Error('A hangar must not compile a hull cache');}\n${['editorPublicKey','editorPartGeometryKey','requestedPart'].map(appFunction).join('\n')}`,cx);
 const {C,G,request,bump}=vm.runInContext('({C,G,request:requestedPart,bump:()=>editorPartsRevision++})',cx),s=C.newShip({L:100,W:100,H:100,assembly:true},'Clipped aviation editor');
 s.parts=[{id:1,k:'struct',form:'box',c:[0,0,0],s:[16,20,10]}];s.fits=[];s.hatches=[];s.links=[];s.groups=[];s.nextId=3;s.detail=0;s.autoHabitation=false;
 const result=C.solvePlacement(s,{id:2,k:'hangar',c:[0,0,0],d:Math.cbrt(4000),room:[20,20,10]},{mode:'clip',hostId:1});assert.equal(result.ok,true,result.error);const p=result.part;s.parts.push(p);cx.inputShip=s;vm.runInContext('ship=inputShip',cx);
 return {C,G,s,p,request,bump};
}
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-5,`${actual} differs from ${expected}`);
function renderedXBounds(r,p){
 // Use the actual renderer with editor authoring caches, where Core deliberately
 // leaves geometry work to the Worker instead of synchronously rebuilding it.
 const model={...r.s,_client:true,parts:r.s.parts.map(q=>q.id===p.id?p:q)},meshes=r.G.meshParts(model,{}).g,geometry=r.s.hatches.some(h=>h.bay===p.id)?meshes.hangar:meshes.interior;
 assert.ok(geometry.ni>0,'the aviation compartment has actual rendered triangles');const xs=[];for(let i=0;i<geometry.ni;i++)xs.push(geometry.pos[geometry.idx[i]*3]);return [Math.min(...xs),Math.max(...xs)];
}

test('adding and changing an aviation hatch preserves the last clipped solid in the actual editor proxy and renderer',()=>{
 const r=fixture(),{C,s,p,request,bump}=r,clip=p._clip;near(C.partVolume(request(p)),3200);assert.deepEqual(renderedXBounds(r,request(p)),[-8,8]);
 for(const mode of ['open','ray','none']){
  C.setAviationSurfaceMode(s,p,'top',mode);bump();const proxy=request(p);assert.equal(proxy._clip,clip,'a hatch setting does not restore the uncut requested room');near(C.partVolume(proxy),3200);assert.equal(C.inPart(proxy,[9,0,0]),false);const hit=C.rayPart([30,0,0],[-1,0,0],proxy);assert.ok(hit);near(hit.p[0],8);assert.deepEqual(renderedXBounds(r,proxy),[-8,8]);
  assert.equal(proxy.placement.mode,'clip');assert.equal(proxy.placement.hostId,1);near(C.partVolume(proxy.placement.requestedGeometry),4000);assert.equal(p._clip,clip,'preview never mutates the source effective solid');
 }
});

test('aviation labels and operating roles retain valid effective geometry while real geometry and host edits discard it',()=>{
 const r=fixture(),{p,C,request,bump}=r,clip=p._clip;request(p);
 for(const update of [()=>p.label='Flight deck',()=>p.airRole='launch',()=>p.aviationSurfaces={top:'ray'}]){update();bump();assert.equal(request(p)._clip,clip);near(C.partVolume(request(p)),3200);}
 for(const edit of [q=>q.c[0]++,q=>q.room[0]++,q=>q.placement.hostId=99,q=>q.placement.mode='preserve-volume',q=>q.placement.requestedGeometry.room[0]++]){
  const x=fixture();x.request(x.p);edit(x.p);x.bump();assert.equal(x.request(x.p)._clip,undefined,'a real authored geometry change cannot reuse old world-space clipping');assert.ok(x.p._clip,'the editable source keeps its previous derived result until the Worker resolves the change');
 }
});

test('a later Worker effective solid replaces the editor cache without changing the requested room',()=>{
 const r=fixture(),{C,s,p,request}=r;request(p);s.parts[0].s[0]=15;const solved=C.solvePlacement(s,p,{mode:'clip',hostId:1});assert.equal(solved.ok,true,solved.error);const replacement=solved.part._clip;p._clip=replacement;
 assert.equal(request(p)._clip,replacement,'derived geometry adoption is independent of public authoring revisions');near(C.partVolume(request(p)),3000);near(C.meshVolume(request(p)._clip.tris),3000);near(C.partVolume(p.placement.requestedGeometry),4000);assert.deepEqual(renderedXBounds(r,request(p)),[-7.5,7.5]);
});

test('a Worker result that now fully contains the room removes the obsolete clipped proxy',()=>{
 const r=fixture(),{C,s,p,request}=r;near(C.partVolume(request(p)),3200);s.parts[0].s[0]=20;const solved=C.solvePlacement(s,p,{mode:'clip',hostId:1});assert.equal(solved.ok,true,solved.error);assert.equal(solved.part._clip,undefined,'the full request now fits without clipping');delete p._clip;
 const proxy=request(p);assert.equal(proxy._clip,undefined,'absence of an authoritative effective clip is also a cache update');near(C.partVolume(proxy),4000);assert.deepEqual(renderedXBounds(r,proxy),[-10,10]);
});

test('new pending placement keeps its full editable request instead of borrowing a previously finalized clip',()=>{
 const r=fixture(),{C,G,s,p,request,bump}=r;request(p);p.placement.pendingGeometry=true;bump();const proxy=request(p);assert.equal(proxy._clip,undefined);assert.equal(proxy._packing,undefined);near(C.partVolume(proxy),4000);
 const g=G.meshPreview(s,[p],[],{requestedPart:request}).preview;assert.ok(g.ni>0);const xs=[];for(let i=0;i<g.ni;i++)xs.push(g.pos[g.idx[i]*3]);near(Math.min(...xs),-10);near(Math.max(...xs),10);assert.ok(p._clip,'pending preview does not destroy the last source cache');
});
