const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test'),{performance}=require('node:perf_hooks');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
const plain=x=>JSON.parse(JSON.stringify(x));
function fixture(foil=false){
 const cx=vm.createContext({console,performance,setTimeout,clearTimeout,structuredClone});
 for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
 const source=fs.readFileSync(path.join(root,'js/engine.js'),'utf8');vm.runInContext(source.slice(0,source.indexOf('/* Interface-side connection')),cx,{filename:'js/engine.js'});
 const {C,E}=vm.runInContext('({C:Core,E:YardEngine})',cx),pending=[],messages=[];
 const scope={postMessage(m){messages.push(m);const i=pending.findIndex(p=>m.type==='error'?m.id===p.data.id||m.gen===p.data.gen:m.type===p.type&&(p.data.id==null?m.gen===p.data.gen:m.id===p.data.id));if(i<0)return;const p=pending.splice(i,1)[0];m.type==='error'?p.reject(Error(m.message)):p.resolve(m);}};
 E.listenWorker(scope);const request=(data,type)=>new Promise((resolve,reject)=>{pending.push({data,type,resolve,reject});scope.onmessage({data});});
 let ship=C.deserialize(C.serialize(C.newShip({L:160,W:100,H:80,assembly:true},'Aggregate worker')));ship.parts=[];ship.fits=[];ship.armor={hull:0,cit:0};ship.detail=0;ship.nextId=1;
 let host=C.placePart(ship,foil?'wing':'struct',[80,40,30],[80,40,24],{form:'box',...(foil?{wing:C.normalizeWing({foil:true,axis:'x',open:15,stow:65,T:1,pivot:[80,40,15]})}:{})},false);
 // Use the canonical current wing geometry before applying face settings.
 // Legacy struct+wing bodies intentionally change topology during aero migration.
 if(foil){ship=C.deserialize(C.serialize(ship));host=ship.parts.find(p=>p.id===host.id);}
 const patch=C.surfacePatches(ship).filter(p=>p.host==='p'+host.id&&p.exposed).sort((a,b)=>b.area-a.area)[0];
 assert.ok(C.setSurfaceConfig(ship,patch.id,{functionMode:'equipment',allocation:{cooling:50,sensors:25,habitation:25},equipment:{depth:2,limit:9},battery:{weapon:'pd',count:2,spacing:1}}).ok);
 return {C,ship,host,patch,request,messages};
}
function lean(report){assert.ok(report?.patches.length);for(const p of report.patches){assert.equal(p.cells,undefined);assert.equal(p.triangles,undefined);assert.equal(p.polygon,undefined);assert.equal(p.config?.aggregate,undefined);}}
function near(a,b){assert.equal(a.length,b.length);a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-6,`${a} != ${b}`));}

test('worker geometry and stats return one saved face ledger with lean UI reports and no native adapter leaks',async()=>{
 const {C,ship,host,request,messages}=fixture();
 const geometry=await request({type:'update',gen:1,state:C.publicJSON(ship),what:['all'],reset:true,stats:false},'geometry'),saved=JSON.parse(geometry.state);
 assert.equal(saved.surfaces.version,4);assert.equal(saved.parts.length,1);assert.equal(saved.parts[0].id,host.id);assert.equal(saved.fits.length,0);assert.ok(saved.surfaces.patches.some(p=>p.aggregate?.cells.length));lean(geometry.surfaceReport);
 assert.deepEqual(Object.keys(geometry.caches.items.parts).map(Number),[host.id]);
 assert.equal(geometry.caches.ship._surfaceProjection,undefined);assert.equal(geometry.caches.ship._surfaceData,undefined);assert.equal(geometry.caches.ship._surfaceWorking,undefined);
 const stat=await request({type:'update',gen:2,state:geometry.state,what:[],stats:true,statsDelay:0},'stats');lean(stat.stats.surface);
 const expected=C.computeStats(saved);assert.equal(stat.stats.cost,expected.cost);assert.equal(stat.stats.mass,expected.mass);
 const expectedProfile=C.fleetProfile(expected,saved.name,saved);assert.equal(stat.profile.surface.mounts.length,2);assert.deepEqual(plain(stat.profile),plain(expectedProfile));
 const second=messages.find(m=>m.type==='geometry'&&m.gen===2);assert.equal(JSON.parse(second.state).parts.length,1);assert.equal(second.noop,true);
});

test('real fleet/trial worker derives virtual casemate guns and rigidly poses their mouths without editable gun parts',async()=>{
 const {C,ship,host,request}=fixture(true);C.surfaceSync(ship);
 const fleet=await request({type:'fleet',id:1,design:C.serialize(ship),trial:true},'fleet');
 assert.equal(fleet.design.parts.length,1);assert.equal(fleet.design.fits.length,0);assert.equal(fleet.geometry.turrets.length,2);assert.equal(fleet.profile.surface.mounts.length,2);
 const normalized=C.deserialize(fleet.design),guns=C.surfaceDerivedFits(normalized),wing=normalized.parts.find(p=>p.id===host.id),frame=C.foilFrame(normalized,wing),captured=[],original=C.turretClear;
 C.turretClear=(s,f,dir,ctx)=>{captured.push({s,f,dir});return original(s,f,dir,ctx);};
 const dirs=guns.flatMap(f=>f.n),ids=guns.map(f=>f.id),opened=await request({type:'trialRays',id:2,ids,dirs,foils:{[host.id]:1}},'trialRays');
 assert.equal(opened.ready,true);assert.equal(captured.length,2);for(let i=0;i<2;i++){assert.equal(captured[i].f.id,guns[i].id);near(C.surfaceBatteryGeometry(captured[i].f).mouth,C.surfaceBatteryGeometry(guns[i]).mouth);}
 captured.length=0;const closed=await request({type:'trialRays',id:3,ids,dirs,foils:{[host.id]:0}},'trialRays');assert.equal(closed.ready,true);assert.equal(captured.length,2);
 for(let i=0;i<2;i++){assert.equal(captured[i].f.id,guns[i].id);near(C.surfaceBatteryGeometry(captured[i].f).mouth,C.foilAt(frame,wing,C.surfaceBatteryGeometry(guns[i]).mouth,wing.wing.stow));assert.equal(captured[i].s.parts.length,1);assert.equal(JSON.parse(C.publicJSON(captured[i].s)).fits.length,0);}
 C.turretClear=original;assert.equal(ship.parts.length,1);assert.equal(ship.fits.length,0);assert.deepEqual(plain(ids),plain(fleet.profile.surface.mounts.map(m=>m.id)));
});

test('a view refresh after common stats cannot transfer a transient whole simulation through native compartment caches',async()=>{
 const {C,ship,request,messages}=fixture();ship.parts.push({id:ship.nextId++,k:'battery',c:[80,40,30],d:2});
 await request({type:'update',gen:1,state:C.publicJSON(ship),what:['all'],reset:true,stats:true,statsDelay:0},'stats');
 const first=messages.find(m=>m.type==='geometry'&&m.gen===1),view=await request({type:'update',gen:2,state:first.state,what:['view'],stats:false},'geometry'),seen=new WeakSet(),bad=[];
 function walk(v,path){if(!v||typeof v!=='object'||seen.has(v)||ArrayBuffer.isView(v))return;seen.add(v);if(v._surfaceWorking||v._surfaceAdapter)bad.push(path);if(v instanceof Map)for(const [k,x]of v)walk(x,path+'.'+k);else for(const k of Object.keys(v))walk(v[k],path+'.'+k);}
 walk(view.caches,'cache');assert.deepEqual(bad,[],'cache references must point to the editable ship, not recursively copy its private simulation projection');
 assert.equal(JSON.parse(view.state).parts.length,2);assert.equal(JSON.parse(view.state).fits.length,0);
});
