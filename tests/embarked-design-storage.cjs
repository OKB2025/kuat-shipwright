const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console}),run=code=>vm.runInContext(code,context);
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])run(fs.readFileSync(path.join(root,file),'utf8'));
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);run(app.slice(a,b));}
run(`const R=Rts,store=new Map(),messages=[],voy={};let storageOK=true;
 const LS={get:k=>store.get(k)||null,set:(k,v)=>{if(!storageOK)return false;store.set(k,v);return true;}};
 const toast=s=>messages.push(s),VOY_CIS_RENAME={};
 function fixture(){
  const s=Core.buildDesign('craft_xwing');s.name='User snapshot';Core.syncCompartments(s);const stats=Core.computeStats(s),design=Core.designCraftSnapshot(s,stats,'save:source');
  const craft=R.registerDesignCraft(design),air=Array.from({length:24},(_,i)=>({craft,design,n:12,name:'Squad '+i,groupNo:2,wingNo:1+Math.floor(i/6)}));
  return {version:1,factions:{rebel:{next:5,ctgs:[{id:'c1',name:'Task force',tgs:[{id:'t1',name:'Group',ships:[{id:'ship1',key:'venator',air}]}]}]}}};
 }
 const first=data=>data.factions.rebel.ctgs[0].tgs[0].ships[0];
`);
section('const ORBAT_KEY =', 'function voyOb(');
test('repeated squadrons share one stored blueprint and restore after the registry is cleared',()=>{
 const result=run(`(()=>{
  const original=fixture(),text=voyOrbatJSON(original),disk=JSON.parse(text),ref=first(disk).air[0].designRef;
  for(const k of Object.keys(R.CRAFT))if(R.CRAFT[k].design)delete R.CRAFT[k];
  store.set(ORBAT_KEY,text);const restored=voyOrbatLoad(),sh=first(restored);
  return {unique:Object.keys(disk.embarkedDesigns).length,rows:sh.air.length,ref,key:sh.air[0].craft,name:R.CRAFT[sh.air[0].craft].blueprint.name,
   group:sh.air[0].groupNo,wing:sh.air[23].wingNo,same:sh.air[0].design===sh.air[23].design,ratio:text.length/JSON.stringify(original).length,original:!!first(original).air[0].design};
 })()`);
 assert.equal(result.unique,1);assert.equal(result.rows,24);assert.equal(result.key,result.ref);assert.equal(result.name,'User snapshot');
 assert.equal(result.group,2);assert.equal(result.wing,4);assert.equal(result.same,true);assert.ok(result.ratio<.15);assert.equal(result.original,true);
});
test('legacy inline snapshots reload and are registered before costs and capacity are displayed',()=>{
 run('const oldFleet=fixture();store.set(ORBAT_KEY,JSON.stringify(oldFleet));');
 assert.equal(run('first(voyOrbatLoad()).air.every(q=>!!R.CRAFT[q.craft]&&!!q.design.blueprint)'),true);
});
test('a storage failure is reported once and a successful save clears the failure state',()=>{
 run('voy.orbat=fixture();messages.length=0;storageOK=false;voyOrbatSave();voyOrbatSave();');
 assert.equal(run('messages.length'),1);assert.equal(run('voy.orbatSaveFailed'),true);
 run('storageOK=true;voyOrbatSave();');assert.equal(run('voy.orbatSaveFailed'),false);
 run('storageOK=false;voyOrbatSave();');assert.equal(run('messages.length'),2);
});
