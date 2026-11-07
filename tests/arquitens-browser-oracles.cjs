const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),source=fs.readFileSync(path.join(root,'scripts/browser-arquitens-engine.cjs'),'utf8');
function ready(Y){const start=source.indexOf("await page.waitForFunction(()=>{const Y=window.__yard;return Y.ship?.reference==='arquitens'"),end=source.indexOf(',null,{timeout:',start);assert.ok(start>=0&&end>start);return vm.runInNewContext('('+source.slice(start+'await page.waitForFunction('.length,end)+')',{window:{__yard:Y},document:{querySelector:()=>({hidden:true})}})();}
function routes(Y){const start=source.indexOf('const Y=window.__yard,C=Y.C,s=Y.ship,S=Y.stats,v=Y.view(),work=C.surfaceWorkingShip(s)'),end=source.indexOf('const ranges=',start);assert.ok(start>=0&&end>start);return vm.runInNewContext('(()=>{'+source.slice(start,end)+'return {feed,drive};})()',{window:{__yard:Y}});}
const fixture=()=>({ship:{reference:'arquitens'},stats:{},eng:{mode:'worker',gen:5,geoGen:5,statsGen:5,adoptedGen:5,uploading:0},view:()=>({}),C:{surfaceWorkingShip:()=>({}),engineTransmission:()=>{throw Error('No client physics');},engineDriveRoutes:()=>{throw Error('No client physics');}}});

test('native Arquitens readiness waits for current geometry, statistics, adoption and complete GPU uploads',()=>{
 const Y=fixture();assert.equal(ready(Y),true);Y.eng.uploading=1;assert.equal(ready(Y),false);Y.eng.uploading=0;
 for(const key of ['geoGen','statsGen','adoptedGen']){Y.eng[key]=4;assert.equal(ready(Y),false,key);Y.eng[key]=5;}
 Y.eng.mode='inline';assert.equal(ready(Y),false);
});

test('native proof reads current worker routes before legacy caches and rejects stale snapshots',()=>{
 const Y=fixture(),feed={routes:[{id:'feed'}]},drive={routes:[{id:'shaft'}]};Y.ship._editorSnapshot={transmission:feed,drive};Y.ship._editorSnapshotGen=5;Y.C.surfaceWorkingShip=()=>({_engineTransmission:{routes:[]},_engineDriveRoutes:{routes:[]}});
 const result=routes(Y);assert.equal(result.feed,feed);assert.equal(result.drive,drive);Y.ship._editorSnapshotGen=4;assert.throws(()=>routes(Y),/Current-generation worker snapshot/);
});

test('legacy settled route caches remain readable without launching a route solve, while missing data fails',()=>{
 const Y=fixture(),feed={routes:[]},drive={routes:[]};Y.ship._engineTransmission=feed;Y.ship._engineDriveRoutes=drive;
 assert.equal(routes(Y).feed,feed);assert.equal(routes(Y).drive,drive);delete Y.ship._engineDriveRoutes;assert.throws(()=>routes(Y),/refusing a new route solve/);
});

test('the audited six-feed topology requires distinct paid sources and one shaft for each independent nozzle',()=>{
 const {verifyNativeProof}=require('../scripts/browser-arquitens-engine.cjs'),model=JSON.parse(fs.readFileSync(path.join(root,'docs/benchmarks/example-engine-acceleration-refit.json'))).models.find(row=>row.key==='arquitens'),range={count:3,start:0,gpuCount:3,indexed:true},engines=model.propulsionArchitecture.engines;
 const proof={reference:'arquitens',renderer:'webgl',webglError:0,glowPoints:[[],[],[]],catalogueAccelerationG:1800,header:{label:'最大加速',value:'1,800 G'},generation:{gen:1,geo:1,stats:1,adopted:1,uploading:false},routeSnapshot:{gen:1},reactors:[...new Set(model.engineTransmission.routes.map(r=>Number(r.from.slice(1))))].map(id=>({id})),cores:engines.map(e=>({id:e.id,valid:true,outlets:e.nozzleIds,ratedInputW:e.ratedInputW,machineryVolumeM3:e.effectiveBodyVolumeM3,densityFactor:1,ranges:[range]})),nozzles:engines.map(e=>({id:e.nozzleIds[0],machineryId:e.id,vented:true,ranges:[range]})),feed:model.engineTransmission.routes.map(r=>({id:r.id,from:r.from,to:r.to,ok:true,limited:false,capacityW:r.capacityW,requestedCapacityW:r.requestedCapacityW,ranges:[]})),drive:engines.map(e=>({id:'p'+e.id+'>p'+e.nozzleIds[0],from:'p'+e.id,to:'p'+e.nozzleIds[0],ok:true,limited:false,capacityW:10,requestedCapacityW:10,ranges:[range]}))};
 assert.equal(model.engineTransmission.routeCount,6);assert.doesNotThrow(()=>verifyNativeProof(proof,model));
 const reject=change=>{const altered=JSON.parse(JSON.stringify(proof));change(altered);assert.throws(()=>verifyNativeProof(altered,model));};
 reject(p=>p.feed[1]={...p.feed[0]});reject(p=>p.feed[0].from='p9999');reject(p=>p.feed[0].to='p9999');reject(p=>p.feed[0].requestedCapacityW*=2);reject(p=>p.drive[1]={...p.drive[0]});reject(p=>p.drive[0].to='p'+p.nozzles[1].id);reject(p=>p.reactors=p.reactors.filter(r=>'p'+r.id!==p.feed[0].from));reject(p=>p.nozzles[1].machineryId=p.nozzles[0].machineryId);
});
