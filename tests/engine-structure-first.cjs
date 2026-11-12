// Edit latency (user request 2026-11-12): the Worker shows a moved structure before re-deriving the
// compartments and equipment, and a newer edit stops an obsolete calculation at the next phase, so
// that its geometry and statistics are never posted or applied.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');

function setup(){
 const cx=vm.createContext({console,setTimeout,clearTimeout,structuredClone,performance});
 for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js','js/engine.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
 const {C,G,E}=vm.runInContext('({C:Core,G:Gfx,E:YardEngine})',cx);
 const messages=[],waiting=[],hooks=[];
 const scope={postMessage(msg){messages.push(msg);for(const h of hooks.slice())h(msg);for(const w of waiting.slice())if(w.test(msg)){waiting.splice(waiting.indexOf(w),1);w.resolve(msg);}}};
 E.listenWorker(scope);
 const wait=test=>new Promise(resolve=>{const hit=messages.find(test);if(hit)resolve(hit);else waiting.push({test,resolve});});
 const ship=C.newShip({L:120,W:40,H:30,assembly:true},'Structures first');
 ship.parts=[{id:1,k:'struct',form:'box',c:[60,0,0],s:[120,30,40]},{id:2,k:'struct',form:'box',c:[40,19,0],s:[20,8,12]},
  {id:3,k:'cargo',c:[30,0,0],d:8},{id:4,k:'fuel',c:[80,0,8],d:6},{id:5,k:'cargo',c:[40,14,0],d:6}];
 ship.fits=[];ship.hatches=[];ship.nextId=6;ship.detail=0;
 return {C,G,E,ship,messages,hooks,wait,send:data=>scope.onmessage({data:structuredClone(data)})};
}
const state=(C,s)=>C.publicJSON(s);
const view={deferSurfaces:true,structureFirst:true};
const same=(a,b,m)=>{assert.equal(a.length,b.length,m);assert.ok(a.every((v,i)=>v===b[i]),m);};

test('a moved structure is sent as settled structure meshes before compartments, identical to the full meshes',async()=>{
 const {C,ship,messages,wait,send}=setup();
 send({type:'update',gen:1,designId:'d',state:state(C,ship),what:['all'],reset:true,view,statsDelay:0});
 await wait(m=>m.type==='stats'&&m.gen===1);
 ship.parts[1].c=[70,19,0];
 send({type:'update',gen:2,designId:'d',state:state(C,ship),what:['parts'],view,statsDelay:0});
 const stats=await wait(m=>m.type==='stats'&&m.gen===2);
 const order=messages.filter(m=>m.gen===2).map(m=>m.type);
 assert.ok(order.indexOf('structureGeometry')>=0&&order.indexOf('structureGeometry')<order.indexOf('geometry'),'structures first: '+order);
 assert.ok(order.indexOf('geometry')<order.indexOf('stats'));
 const early=messages.find(m=>m.type==='structureGeometry'&&m.gen===2),full=messages.find(m=>m.type==='geometry'&&m.gen===2);
 assert.deepEqual([...early.groups],['struct','plate','refStruct']);
 for(const k of ['struct','plate']){for(const a of ['pos','idx','col'])same(early.geos[k][a],full.geos[k][a],k+'.'+a+' equals the full mesh');}
 for(const [id,list] of Object.entries(early.ranges))assert.deepEqual(list,full.ranges[id].filter(([k])=>early.groups.includes(k)),'ranges of #'+id);
 assert.ok(early.ranges[2],'the moved structure has its range');
 assert.ok(stats.stats);
 // Without the flag (other callers) no early packet is sent.
 ship.parts[1].c=[72,19,0];
 send({type:'update',gen:3,designId:'d',state:state(C,ship),what:['parts'],view:{deferSurfaces:true},statsDelay:0});
 await wait(m=>m.type==='stats'&&m.gen===3);
 assert.equal(messages.some(m=>m.type==='structureGeometry'&&m.gen===3),false);
});

for(const [phase,trigger]of [['after the structures','structureGeometry'],['between compartments and mounts','syncCompartments'],['during the statistics','computeStats']]){
 test(`a newer edit stops the old one ${phase}; nothing of the old generation is posted afterwards`,async()=>{
  const {C,E,ship,messages,hooks,wait,send}=setup();
  send({type:'update',gen:1,designId:'d',state:state(C,ship),what:['all'],reset:true,view,statsDelay:0});
  await wait(m=>m.type==='stats'&&m.gen===1);
  ship.parts[1].c=[70,19,0];const second=state(C,ship);ship.parts[1].c=[50,19,0];const third=state(C,ship);
  let sentAt=-1;const sendNewer=()=>{if(sentAt>=0)return;sentAt=messages.length;send({type:'update',gen:3,designId:'d',state:third,what:['parts'],view,statsDelay:0});};
  if(trigger==='structureGeometry')hooks.push(m=>{if(m.type==='structureGeometry'&&m.gen===2)sendNewer();});
  else{
   // The real Worker receives the message during the long call and sees it at the next phase boundary.
   const original=C[trigger];let calls=0;C[trigger]=function(...a){const r=original.apply(this,a);if(++calls===1&&trigger==='syncCompartments'||trigger==='computeStats')sendNewer();return r;};
  }
  send({type:'update',gen:2,designId:'d',state:second,what:['parts'],view,statsDelay:0});
  const stats=await wait(m=>m.type==='stats'&&m.gen===3);
  assert.ok(sentAt>=0,'the newer edit was sent mid-calculation');
  const late=messages.slice(sentAt).filter(m=>m.gen===2).map(m=>m.type);
  assert.deepEqual(late,[],'no packet of the superseded generation after the newer edit: '+late);
  assert.equal(messages.some(m=>m.type==='stats'&&m.gen===2),false,'stale statistics are never posted');
  assert.ok(E.abandoned.some(a=>a.gen===2),'the old generation was abandoned');
  // The newer edit's figures are those of a fresh load of its design.
  const fresh=JSON.parse(third);C.refreshPlacementGeometry(fresh);C.syncCompartments(fresh);C.remount(fresh);C.syncCompartments(fresh);
  const cold=C.computeStats(fresh);assert.equal(stats.stats.mass,cold.mass);assert.equal(stats.stats.vol,cold.vol);
  const geometry=messages.find(m=>m.type==='geometry'&&m.gen===3);assert.ok(geometry&&geometry.geos.struct,'the newer edit gets its full geometry');
 });
}

// The editor applies a structures packet only for the current generation, not during a drag and not
// after the full geometry of that generation.
function fn(text,name){const match=new RegExp('function '+name+'\\s*\\(').exec(text);assert.ok(match,name);for(let b=text.indexOf('}',match.index);b>=0;b=text.indexOf('}',b+1)){const code=text.slice(match.index,b+1);try{new vm.Script(code);return code;}catch{}}assert.fail(name);}
test('the editor ignores a stale or superseded structures packet and keeps other groups and ranges',()=>{
 const cx=vm.createContext({});
 vm.runInContext(`let dragSnap=null;const applied=[],cleared=[],shown=[];const eng={gen:5,geoGen:4};const ship={saveId:'d',parts:[]};
  const meshStore={ranges:{1:[['struct',0,6],['interior',0,3]],2:[['engine',0,9]]}};const live={active:false,parts:[],fits:[],hide:{parts:new Set(),fits:new Set()}};
  const C={isShapePart:p=>p.k==='struct'};const applyGeometry=m=>{applied.push(m);meshStore.ranges=m.ranges;return true;};
  const clearPreview=()=>{cleared.push(1);live.active=false;},showPreview=x=>shown.push(x),engineStatus=()=>{},requestDraw=()=>{};`+fn(app,'onEngineStructureGeometry'),cx);
 const run=c=>vm.runInContext(c,cx);
 assert.equal(run(`onEngineStructureGeometry({gen:4,designId:'d',groups:['struct','plate'],geos:{struct:{}},ranges:{}})`),false,'older generation');
 assert.equal(run(`dragSnap={};const r=onEngineStructureGeometry({gen:5,designId:'d',groups:['struct'],geos:{},ranges:{}});dragSnap=null;r`),false,'during a drag');
 assert.equal(run(`onEngineStructureGeometry({gen:5,designId:'other',groups:['struct'],geos:{},ranges:{}})`),false,'another design');
 assert.equal(run('applied.length'),0);
 run(`live.active=true;live.parts=[{id:1,k:'struct'}];live.hide.parts.add(1);`);
 assert.equal(run(`onEngineStructureGeometry({gen:5,designId:'d',groups:['struct','plate'],geos:{struct:{}},ranges:{1:[['struct',0,12]],3:[['plate',0,6]]}})`),true);
 assert.equal(JSON.stringify(run('meshStore.ranges')),JSON.stringify({1:[['interior',0,3],['struct',0,12]],2:[['engine',0,9]],3:[['plate',0,6]]}),'only the structure groups are replaced');
 assert.equal(run('eng.structGen'),5);assert.equal(run('cleared.length'),1,'a structure-only preview is replaced by the settled meshes');
 run('eng.geoGen=5');assert.equal(run(`onEngineStructureGeometry({gen:5,designId:'d',groups:['struct'],geos:{},ranges:{}})`),false,'after the full geometry');
 // A preview that also carries equipment keeps the equipment previewed.
 run(`eng.gen=6;live.active=true;live.parts=[{id:1,k:'struct'},{id:7,k:'gen'}];live.hide.parts=new Set([1,7]);`);
 assert.equal(run(`onEngineStructureGeometry({gen:6,designId:'d',groups:['struct'],geos:{struct:{}},ranges:{}})`),true);
 assert.equal(run('cleared.length'),1);assert.equal(run('JSON.stringify(live.parts.map(p=>p.id))'),'[7]');assert.equal(run('JSON.stringify([...live.hide.parts])'),'[7]');assert.equal(run('shown.length'),1);
});
