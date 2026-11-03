const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test'),{performance}=require('node:perf_hooks');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),plain=x=>JSON.parse(JSON.stringify(x));
function fixture(){
 const cx=vm.createContext({console,performance,setTimeout,clearTimeout,structuredClone});
 for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
 const source=fs.readFileSync(path.join(root,'js/engine.js'),'utf8');vm.runInContext(source.slice(0,source.indexOf('/* Interface-side connection')),cx,{filename:'js/engine.js'});
 const {C,E}=vm.runInContext('({C:Core,E:YardEngine})',cx),pending=[],messages=[];
 const scope={postMessage(m){messages.push(m);const i=pending.findIndex(p=>m.type==='error'?m.id===p.data.id||m.gen===p.data.gen:m.type===p.type&&(p.data.id==null?m.gen===p.data.gen:m.id===p.data.id));if(i<0)return;const p=pending.splice(i,1)[0];m.type==='error'?p.reject(Error(m.message)):p.resolve(m);}};
 E.listenWorker(scope);const request=(data,type)=>new Promise((resolve,reject)=>{pending.push({data,type,resolve,reject});scope.onmessage({data});});
 const ship=C.deserialize(C.serialize(C.newShip({L:600,W:160,H:600,assembly:true},'Area worker integration')));ship.parts=[];ship.fits=[];ship.armor={hull:0,cit:0};ship.detail=0;ship.nextId=1;
 const host=C.placePart(ship,'struct',[300,300,0],[500,100,500],{form:'box'},false);C.placePart(ship,'gen',[300,300,0],8,{},false);C.placePart(ship,'battery',[320,300,0],3,{},false);
 const manual=C.placeFit(ship,'pd',[300,550,0],[0,1,0],0,false);assert.ok(manual.fit,manual.err);
 const patch=C.surfacePatches(ship).find(p=>p.host==='p'+host.id&&p.face==='port');assert.ok(patch?.exposed);
 const result=C.setSurfaceConfig(ship,patch.id,{functionMode:'equipment',allocation:{cooling:100,sensors:0,habitation:0},equipment:{capacityModel:'area-v1',kind:'hdis',depth:2,limit:1},battery:{weapon:'pd',count:2,spacing:1},style:{depth:4,density:0,seed:37}});assert.ok(result.ok,result.why);
 return {C,ship,host,patch,manual:manual.fit,request,messages};
}
function lean(report){for(const row of report.patches){assert.equal(row.cells,undefined);assert.equal(row.triangles,undefined);assert.equal(row.config?.aggregate,undefined);}}
function noAdapters(value){const seen=new WeakSet();function visit(v){if(!v||typeof v!=='object'||seen.has(v)||ArrayBuffer.isView(v))return;seen.add(v);assert.ok(!v._surfaceWorking&&!v._surfaceAdapter,'transient common adapters cannot leak into the editor caches');for(const key of Object.keys(v))visit(v[key]);}visit(value);}

test('real worker uses area capacity beyond the old tile ceiling while preserving native hardware and lean packets',async()=>{
 const {C,ship,host,patch,manual,request,messages}=fixture(),ids=ship.parts.map(p=>p.id),result=await request({type:'update',gen:1,state:C.publicJSON(ship),what:['all'],reset:true,stats:true,statsDelay:0},'stats'),geometry=messages.find(m=>m.type==='geometry'&&m.gen===1),saved=JSON.parse(geometry.state),row=result.stats.surface.patches.find(p=>p.id===patch.id);
 assert.deepEqual(saved.parts.map(p=>p.id),ids);assert.equal(saved.parts.length,3);assert.equal(saved.fits.length,1);assert.equal(saved.fits[0].id,manual.id);assert.ok(saved.parts.every(p=>!p.surfacePatch));assert.ok(saved.fits.every(f=>!f.surfacePatch));
 assert.equal(row.config.equipment.capacityModel,'area-v1');assert.ok(row.volume>patch.exposedArea*2*.90,'a large unobstructed face must retain its usable volume despite the old equipment.limit=1 and256-cell ceiling');assert.ok(row.volume>256*64*2*10);assert.ok(!row.errors.some(e=>/装置数上限/.test(e)));assert.equal(row.installed,2);assert.equal(row.requested,2);
 assert.equal(result.profile.surface.mounts.length,3);assert.ok(result.profile.modules.some(m=>m.part===ids[1]));assert.ok(result.profile.surface.devices.some(d=>d.kind==='hdis'&&d.module>=0));assert.ok(result.profile.modules.some(m=>m.fit===manual.id));assert.equal(C.surfaceDerivedFits(saved).length,2);assert.ok(C.surfaceWorkingShip(saved).parts.length<=9);lean(geometry.surfaceReport);lean(result.stats.surface);noAdapters(geometry.caches);
});

test('worker reload and visual-depth changes reuse identical area resources, gun identities and cached common profiles',async()=>{
 const {C,ship,patch,request,messages}=fixture(),before=await request({type:'update',gen:1,state:C.publicJSON(ship),what:['all'],reset:true,stats:true,statsDelay:0},'stats'),first=messages.find(m=>m.type==='geometry'&&m.gen===1),state=JSON.parse(first.state),ledger=plain(C.surfaceConfig(state,patch.id).aggregate),guns=plain(C.surfaceDerivedFits(state).map(f=>({id:f.id,p:f.p,n:f.n}))),config=state.surfaces.patches.find(p=>p.id===patch.id);
 config.style.depth=14;config.style.density=.8;config.style.seed=83;
 const after=await request({type:'update',gen:2,state:C.publicJSON(state),what:['view'],stats:true,statsDelay:0},'stats'),view=messages.find(m=>m.type==='geometry'&&m.gen===2),saved=JSON.parse(view.state);
 assert.equal(after.stats.mass,before.stats.mass);assert.equal(after.stats.cost,before.stats.cost);assert.deepEqual(plain(C.surfaceConfig(saved,patch.id).aggregate),ledger);assert.deepEqual(plain(C.surfaceDerivedFits(saved).map(f=>({id:f.id,p:f.p,n:f.n}))),guns);assert.equal(C.surfaceConfig(saved,patch.id).style.depth,14);
 assert.deepEqual(plain(after.profile),plain(before.profile),'the worker supplies the same common simulation profile for purely visual edits');noAdapters(view.caches);
 const loaded=C.deserialize(C.serialize(saved)),roundtrip=await request({type:'update',gen:3,state:C.publicJSON(loaded),what:['all'],reset:true,stats:true,statsDelay:0},'stats');assert.equal(roundtrip.stats.cost,before.stats.cost);assert.equal(roundtrip.stats.mass,before.stats.mass);assert.deepEqual(plain(roundtrip.profile),plain(before.profile));
});
