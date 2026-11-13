const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
function fixture(){
 const cx=vm.createContext({console,performance});for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
 const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),ship=C.newShip({L:300,W:100,H:20,assembly:true},'Height preview');
 ship.parts=[{id:1,k:'struct',form:'box',c:[0,0,0],s:[200,100,20]}];ship.fits=[];ship.hatches=[];ship.links=[];ship.groups=[];ship.nextId=2;ship.detail=0;ship.autoHabitation=false;
 const solved=C.solvePlacement(ship,{id:-1,k:'struct',form:'box',c:[0,20,0],s:[20,10,40]},{mode:'horizontal',contactFit:'cut',position:[0,20,0],parentStructureId:1,hit:{p:[0,10,0],n:[0,1,0]}});assert.equal(solved.ok,true,solved.error);const accepted=C.acceptPlacementResult(ship,solved);assert.equal(accepted.ok,true,accepted.error);
 return {C,G,ship,part:accepted.part,parent:ship.parts[0]};
}
function yBounds(geometry){
 let low=Infinity,high=-Infinity;for(let i=0;i<geometry.ni;i+=3){const ids=Array.from(geometry.idx.subarray(i,i+3));if(new Set(ids).size<3)continue;for(const id of ids){const y=geometry.pos[id*3+1];assert.ok(Number.isFinite(y));low=Math.min(low,y);high=Math.max(high,y);}}
 return [low,high];
}
const plain=value=>JSON.parse(JSON.stringify(value)),preview=(r,options={})=>r.G.meshPreview(r.ship,[r.part],[],options).preview;

test('unchanged fitted child keeps the real cut shape in the fallback miniature without its parent in the model',()=>{
 const r=fixture(),{C,G,ship,part}=r,cache=part._placementGeometry,before=C.publicJSON(ship),mini={...ship,parts:[part]};
 assert.equal(C.placementCachedGeometryInputCurrent(part),true);assert.equal(C.placementCachedGeometryCurrent(mini,part),false,'isolated miniature has no parent to validate');assert.deepEqual(yBounds(G.meshPreview(mini,[part],[]).preview),[10,40]);assert.equal(part._placementGeometry,cache);assert.equal(C.publicJSON(ship),before);
});

test('height editing previews the new requested body rather than translating the former fitted slab',()=>{
 const r=fixture(),{C,part,parent}=r,parentBefore=C.publicJSON(parent),parentCache=parent._geom;
 assert.deepEqual(yBounds(preview(r)),[10,40]);assert.equal(C.resizeStructureHeightAtContact(part,100),true);assert.deepEqual(plain(part.c),[0,50,0]);assert.deepEqual(yBounds(preview(r)),[0,100],'the old local fitted solid would incorrectly float at Y40..70');assert.equal(C.publicJSON(parent),parentBefore);assert.equal(parent._geom,parentCache);
 const refreshed=C.refreshPlacementGeometry(r.ship);assert.equal(refreshed.ok,true,JSON.stringify(refreshed.failed));assert.deepEqual(yBounds(preview(r)),[10,100],'the Worker-computed fit restores the actual parent contact');assert.deepEqual(plain(part.c),[0,50,0]);
});

test('a direct dimension edit cannot reuse an old fitted cache even before Core invalidates that source cache',()=>{
 const r=fixture(),{C,part}=r,cache=part._placementGeometry;assert.deepEqual(yBounds(preview(r)),[10,40]);part.s[2]=100;part.c[1]=50;
 assert.equal(part._placementGeometry,cache,'the editor may still retain its last authoritative result');assert.equal(C.placementCachedGeometryInputCurrent(part),false);assert.deepEqual(yBounds(preview(r)),[0,100]);assert.equal(part._placementGeometry,cache,'the renderer does not mutate authoritative geometry');
});

test('replacement of derived fitting data rebuilds the fallback mesh with unchanged public authoring input',()=>{
 const r=fixture(),{C,part}=r,reads=[],triangles=C.structTriangles;C.structTriangles=function(p,...args){if(p.id===part.id)reads.push(p._placementGeometry);return triangles.call(this,p,...args);};
 assert.deepEqual(yBounds(preview(r)),[10,40]);const count=reads.length,before=C.publicJSON(part),replacement={...part._placementGeometry,local:part._placementGeometry.local.slice()};part._placementGeometry=replacement;
 assert.equal(C.publicJSON(part),before);assert.deepEqual(yBounds(preview(r)),[10,40]);assert.ok(reads.length>count,'a changed derived cache is independent of public source keys');assert.ok(reads.slice(count).every(geometry=>geometry===replacement));
});

test('removal of derived fitting data with unchanged public input does not retain the old cut mesh',()=>{
 // Stage B (2026-11-13): the fitted solid is stored with the part (placement.fittedGeometry). Dropping only the
 // private cache rebuilds that same stored solid; dropping the stored record previews the request, never an old mesh.
 const r=fixture(),{C,part}=r;assert.deepEqual(yBounds(preview(r)),[10,40]);const before=C.publicJSON(part);delete part._placementGeometry;assert.equal(C.publicJSON(part),before);assert.deepEqual(yBounds(preview(r)),[10,40]);
 delete part._placementGeometry;delete part.placement.fittedGeometry;assert.deepEqual(yBounds(preview(r)),[0,40]);assert.equal(part._placementGeometry,undefined);
});

test('progressive previews adopt derived-only replacements without rebuilding an unchanged frame',()=>{
 const r=fixture(),{C,part}=r,reads=[],triangles=C.structTriangles,opt={progressive:true,incremental:true,revision:1,budgetMs:1000};C.structTriangles=function(p,...args){if(p.id===part.id)reads.push(p._placementGeometry);return triangles.call(this,p,...args);};
 assert.deepEqual(yBounds(preview(r,opt)),[10,40]);const first=reads.length;assert.deepEqual(yBounds(preview(r,opt)),[10,40]);assert.equal(reads.length,first,'the unchanged progressive plan stays warm');
 const replacement={...part._placementGeometry,local:part._placementGeometry.local.slice()};part._placementGeometry=replacement;assert.deepEqual(yBounds(preview(r,opt)),[10,40]);assert.ok(reads.length>first);assert.ok(reads.slice(first).every(geometry=>geometry===replacement));const rebuilt=reads.length;
 assert.deepEqual(yBounds(preview(r,opt)),[10,40]);assert.equal(reads.length,rebuilt);delete part._placementGeometry;delete part.placement.fittedGeometry;assert.deepEqual(yBounds(preview(r,opt)),[0,40]);
});
