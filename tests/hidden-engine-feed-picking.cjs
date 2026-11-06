const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),start=app.indexOf('function enginePickParts()'),end=app.indexOf('// ---------- tools ----------',start);
assert.ok(start>0&&end>start);
function fixture(view,stale){
 const loaded=vm.createContext({console});for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),loaded,{filename:file});
 const hidden=vm.runInContext('Gfx.isHiddenEngineFeed',loaded),feed={id:-1,k:'machinery',transmission:true,t:1,entrySegments:[{}]},shaft={id:-2,k:'machinery',drivetrain:true,t:2,entrySegments:[{}]},paths=[feed,shaft],rays=[],ship={parts:[],fits:[]};
 const C={enginePaths:()=>paths,commandCompartments:()=>[],weaponCapacitors:()=>[],missileCells:()=>[],isShapePart:p=>p.k==='struct',rayPart:(o,d,p)=>{rays.push(p.id);return{t:p.t,p:[0,0,0]};}};
 const cx=vm.createContext({C,Gfx:{isHiddenEngineFeed:hidden},ship,st:{view},eng:{ready:true,gen:1,geoGen:1,statsGen:1},enginePickCache:stale?{ship,key:'1:1:1',parts:paths}:null,enginePending:()=>false,editorCanMeshPart:()=>true,editorRayPartMayHit:()=>true,requestedPart:p=>p,visibleAt:()=>true,envHit:()=>null});
 vm.runInContext(app.slice(start,end),cx);return{pick:()=>vm.runInContext('pickRay([0,0,0],[1,0,0],{parts:true,fits:false})',cx),paths,rays};
}
for(const view of ['normal','xray'])for(const stale of [false,true])test(`${view} picking ignores hidden electrical feeds${stale?' from a prior cache':''} and reaches the visible shaft`,()=>{
 const f=fixture(view,stale),before=JSON.stringify(f.paths),hit=f.pick();
 assert.equal(hit?.part?.id,-2,'the nearer invisible conductor must not obscure a mechanical housing');
 assert.equal(f.rays.includes(-1),false,'electrical geometry is never ray-tested');
 assert.ok(f.rays.includes(-2),'the visible mechanical path remains selectable');
 assert.equal(JSON.stringify(f.paths),before,'picking does not change physical conductors or capacities');
});
