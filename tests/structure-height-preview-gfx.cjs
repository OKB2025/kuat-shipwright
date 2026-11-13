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

// 2026-11-13 user decision: no fitting. A structure keeps its requested solid (here Y 0..40, sunk 10 m into the
// parent, joined by overlap); there is no derived fitted cache (_placementGeometry). Removed tests (they only covered
// that cache): 'unchanged fitted child keeps the real cut shape in the fallback miniature…' (was Y 10..40),
// 'replacement of derived fitting data rebuilds the fallback mesh…', 'removal of derived fitting data … does not retain
// the old cut mesh'. The two height-edit tests below expected Y 10.. after the Worker fit; they now expect the requested body.

test('height editing previews the new requested body from the same base',()=>{
 const r=fixture(),{C,part,parent}=r,parentBefore=C.publicJSON(parent),parentCache=parent._geom;
 assert.deepEqual(yBounds(preview(r)),[0,40]);assert.equal(C.resizeStructureHeightAtContact(part,100),true);assert.deepEqual(plain(part.c),[0,50,0]);assert.deepEqual(yBounds(preview(r)),[0,100]);assert.equal(C.publicJSON(parent),parentBefore);assert.equal(parent._geom,parentCache);
 const refreshed=C.refreshPlacementGeometry(r.ship);assert.equal(refreshed.ok,true,JSON.stringify(refreshed.failed));assert.deepEqual(yBounds(preview(r)),[0,100],'no fit: the requested body stays');assert.deepEqual(plain(part.c),[0,50,0]);
});

test('a direct dimension edit previews the edited requested body',()=>{
 const r=fixture(),{part}=r;assert.deepEqual(yBounds(preview(r)),[0,40]);part.s[2]=100;part.c[1]=50;assert.deepEqual(yBounds(preview(r)),[0,100]);assert.equal(part._placementGeometry,undefined);
});

test('progressive previews keep an unchanged frame warm and rebuild after an edit',()=>{
 const r=fixture(),{C,part}=r,reads=[],triangles=C.structTriangles,opt={progressive:true,incremental:true,revision:1,budgetMs:1000};C.structTriangles=function(p,...args){if(p.id===part.id)reads.push(1);return triangles.call(this,p,...args);};
 assert.deepEqual(yBounds(preview(r,opt)),[0,40]);const first=reads.length;assert.deepEqual(yBounds(preview(r,opt)),[0,40]);assert.equal(reads.length,first,'the unchanged progressive plan stays warm');
 part.s[2]=60;part.c[1]=30;assert.deepEqual(yBounds(preview({...r},{...opt,revision:2})),[0,60]);
});
