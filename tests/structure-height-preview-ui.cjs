const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
function appFunction(name){
 const start=new RegExp('function '+name+'\\s*\\(').exec(app);assert.ok(start,name);
 for(let end=app.indexOf('}',start.index);end>=0;end=app.indexOf('}',end+1)){const code=app.slice(start.index,end+1);try{new vm.Script(code);return code;}catch{}}
 throw Error('Cannot read '+name);
}
function fixture(){
 const cx=vm.createContext({console,performance});for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
 vm.runInContext(`const C=Core,G=Gfx;let ship,editorPartsRevision=0,editorMountCache=null;const requestedParts={ship:null,records:new Map()},placementDraftPartCache=new WeakMap();const currentEditorGeometryContext=()=> 'same-hull-context';function copyEditorHullCache(){throw Error('Not a native hull');}\n${['editorPublicKey','editorPartGeometryKey','requestedPart'].map(appFunction).join('\n')}`,cx);
 const {C,G,set,request,bump}=vm.runInContext('({C,G,set:s=>ship=s,request:requestedPart,bump:()=>editorPartsRevision++})',cx),ship=C.newShip({L:300,W:100,H:20,assembly:true},'Height editing');
 ship.parts=[{id:1,k:'struct',form:'box',c:[0,0,0],s:[200,100,20]}];ship.fits=[];ship.hatches=[];ship.links=[];ship.groups=[];ship.nextId=2;ship.detail=0;ship.autoHabitation=false;
 const solved=C.solvePlacement(ship,{id:-1,k:'struct',form:'box',c:[0,20,0],s:[20,10,40]},{mode:'horizontal',contactFit:'cut',position:[0,20,0],parentStructureId:1,hit:{p:[0,10,0],n:[0,1,0]}});assert.equal(solved.ok,true,solved.error);const accepted=C.acceptPlacementResult(ship,solved);assert.equal(accepted.ok,true,accepted.error);set(ship);
 return {C,G,ship,part:accepted.part,request,bump};
}
function renderedY(r){const g=r.G.meshPreview(r.ship,[r.part],[],{requestedPart:r.request}).preview;assert.ok(g.ni>0);let min=Infinity,max=-Infinity;for(let i=0;i<g.ni;i++){const y=g.pos[g.idx[i]*3+1];assert.ok(Number.isFinite(y));min=Math.min(min,y);max=Math.max(max,y);}return [min,max];}

// 2026-11-13 user decision: no fitting. The child keeps its requested solid (Y 0..40, sunk 10 m, joined by overlap); there
// is no fitted cache (_placementGeometry). Expectations of Y 10.. (the cut base) became the requested body. Removed tests
// (they only covered the fitted cache): 'an authoritative fitting cache replacement is adopted…', 'a label-only edit
// retains the unchanged fitted solid…'.
test('the real editor proxy and preview grow from the installed base',()=>{
 const r=fixture(),{C,part,request,bump}=r,sourceBefore=C.publicJSON(r.ship.parts[0]);assert.deepEqual(renderedY(r),[0,40]);
 C.resizeStructureHeightAtContact(part,100);bump();const proxy=request(part);/* 2026-11-13 user decision: no fitting; the solve carries the requested solid as the placement geometry */assert.equal(C.placementCachedGeometryInputCurrent(proxy),false,'the 40 m solid of the last solve is not current for the resized body');assert.deepEqual(renderedY(r),[0,100],'requested-height preview replaces the former Y40..70 floating slab');assert.equal(C.publicJSON(r.ship.parts[0]),sourceBefore);
 const result=C.refreshPlacementGeometry(r.ship);assert.equal(result.ok,true,JSON.stringify(result.failed));assert.ok(Math.abs(part._placementGeometry.volume-C.partVolume({...part,_placementGeometry:undefined}))<=1e-6*part._placementGeometry.volume,'the carried solid is the requested one');assert.deepEqual(renderedY(r),[0,100]);
});

test('direct dimension edits clear the detached editor fit while preserving the source last-valid solid',()=>{
 const r=fixture(),{part,request,bump}=r,cache=part._placementGeometry;request(part);part.s[2]=100;part.c[1]=50;bump();assert.equal(request(part)._placementGeometry,undefined);assert.equal(part._placementGeometry,cache);assert.deepEqual(renderedY(r),[0,100]);
});


test('an authoritative fitting cache removal also updates the stable editor proxy',()=>{
 // Stage B (2026-11-13): the fitted solid is public (placement.fittedGeometry); removing it is the authoritative
 // removal now, and the proxy follows it.
 const r=fixture(),{C,part,request,bump}=r,proxy=request(part);delete part._placementGeometry;delete part.placement.fittedGeometry;bump();const now=request(part);assert.equal(now._placementGeometry,undefined);assert.deepEqual(renderedY(r),[0,40]);
});


test('a pending placement edit previews its request and cannot borrow an earlier finalized solid',()=>{
 const r=fixture(),{part,request,bump}=r,geometry=part._placementGeometry;request(part);part.placement.pendingGeometry=true;bump();assert.equal(request(part)._placementGeometry,undefined);assert.equal(part._placementGeometry,geometry);assert.deepEqual(renderedY(r),[0,40]);
});
