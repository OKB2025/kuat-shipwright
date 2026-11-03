const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test'),{performance}=require('node:perf_hooks');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),plain=x=>JSON.parse(JSON.stringify(x));
function fixture(){
 const cx=vm.createContext({console,performance,setTimeout,clearTimeout,structuredClone});
 for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
 const source=fs.readFileSync(path.join(root,'js/engine.js'),'utf8');vm.runInContext(source.slice(0,source.indexOf('/* Interface-side connection')),cx,{filename:'js/engine.js'});
 const {C,E}=vm.runInContext('({C:Core,E:YardEngine})',cx),pending=[],messages=[];
 const scope={postMessage(m){messages.push(m);const i=pending.findIndex(p=>m.type==='error'?m.id===p.data.id||m.gen===p.data.gen:m.type===p.type&&(p.data.id==null?m.gen===p.data.gen:m.id===p.data.id));if(i<0)return;const p=pending.splice(i,1)[0];m.type==='error'?p.reject(Error(m.message)):p.resolve(m);}};
 E.listenWorker(scope);const request=(data,type)=>new Promise((resolve,reject)=>{pending.push({data,type,resolve,reject});scope.onmessage({data});});
 const ship=C.newShip({L:180,W:180,H:120,assembly:true},'Exposed surfaces worker');ship.parts=[];ship.fits=[];ship.armor={hull:0,cit:0};ship.detail=0;ship.nextId=1;
 const host=C.placePart(ship,'struct',[60,50,0],[100,40,60],{form:'box'},false),inner=C.placePart(ship,'struct',[45,50,0],[10,10,10],{form:'box'},false),cover=C.placePart(ship,'struct',[95,50,-25],[60,20,80],{form:'box'},false),patch=C.surfacePatches(ship).find(p=>p.host==='p'+host.id&&p.face==='port');
 return {C,ship,host,inner,cover,patch,request,messages};
}
function lean(report){for(const row of report.patches){for(const k of ['triangles','exposedTriangles','polygon','cells'])assert.equal(row[k],undefined,'editor reports must omit '+k);assert.equal(row.config?.aggregate,undefined);}}
function leanCaches(value,seen=new WeakSet()){if(!value||typeof value!=='object'||seen.has(value)||ArrayBuffer.isView(value))return;seen.add(value);for(const [key,v]of Object.entries(value)){if(key==='exposedTriangles')assert.equal(v,undefined,'cached stats must not duplicate the exposure mask packet');else leanCaches(v,seen);}}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);

test('worker geometry and capacity follow the exposed part when a covering structure moves and Undo reloads it',async()=>{
 const {C,ship,inner,cover,patch,request,messages}=fixture();near(patch.exposedArea,3300);assert.equal(C.setSurfaceConfig(ship,patch.id,{functionMode:'equipment',allocation:{cooling:100,sensors:0,habitation:0},equipment:{kind:'hdis',depth:1,capacityModel:'area-v1'},battery:{count:0},style:{depth:3,density:0,seed:21}}).ok,true);
 const native=plain(C.serialize(ship).parts),first=await request({type:'update',gen:1,state:C.publicJSON(ship),what:['all'],reset:true,stats:true,statsDelay:0},'stats'),geometry=messages.find(m=>m.type==='geometry'&&m.gen===1),saved=JSON.parse(geometry.state),row=first.stats.surface.patches.find(p=>p.id===patch.id);
 near(row.exposedArea,3300);near(row.volume,3300);assert.deepEqual(plain(C.serialize(saved).parts),native,'buried source objects remain physical objects');assert.ok(first.stats.surface.patches.filter(p=>p.host==='p'+inner.id).every(p=>!p.exposed&&p.exposedArea===0));lean(geometry.surfaceReport);lean(first.stats.surface);leanCaches(geometry.caches);
 const open=JSON.parse(geometry.state);open.parts.find(p=>p.id===cover.id).c=[95,50,-80];const next=await request({type:'update',gen:2,state:C.publicJSON(open),what:['parts'],stats:true,statsDelay:0},'stats');near(next.stats.surface.patches.find(p=>p.id===patch.id).exposedArea,6000);near(next.stats.surface.patches.find(p=>p.id===patch.id).volume,6000);lean(next.stats.surface);
 const undo=await request({type:'update',gen:3,state:geometry.state,what:['all'],stats:true,statsDelay:0},'stats');near(undo.stats.surface.patches.find(p=>p.id===patch.id).volume,3300);assert.equal(undo.stats.mass,first.stats.mass);assert.equal(undo.stats.cost,first.stats.cost);assert.deepEqual(plain(undo.profile),plain(first.profile));
});

test('background automatic configuration uses exposed candidates without erasing an enclosed source structure',async()=>{
 const {C,ship,inner,request,messages}=fixture(),before=C.publicJSON(ship),result=await request({type:'op',id:1,gen:1,state:before,op:'surfaceAuto',args:[{overwrite:true,allocation:{cooling:100,sensors:0,habitation:0}}]},'op');
 assert.equal(result.result.ok,true);assert.equal(C.publicJSON(ship),before,'worker mutation must not change the caller');const saved=JSON.parse(result.state),byId=new Map(C.surfacePatches(saved).map(p=>[p.id,p]));assert.ok(result.result.ids.length>0);assert.ok(result.result.ids.every(id=>byId.get(id)?.exposed&&byId.get(id).exposedArea>0));assert.ok(result.result.ids.every(id=>!id.startsWith('p'+inner.id+':')));assert.ok(saved.parts.some(p=>p.id===inner.id));near(C.partVolume(saved.parts.find(p=>p.id===inner.id)),1000);
 const stats=await request({type:'update',gen:2,state:result.state,what:['all'],reset:true,stats:true,statsDelay:0},'stats'),geometry=messages.find(m=>m.type==='geometry'&&m.gen===2);lean(stats.stats.surface);lean(geometry.surfaceReport);
});
