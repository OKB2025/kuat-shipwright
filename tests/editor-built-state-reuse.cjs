const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test'),{performance}=require('node:perf_hooks');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),helper=app.split('\n').find(line=>line.startsWith('function engineShipState('));
assert.ok(helper,'the editor must serialize worker state separately from its save identity');
function fixture(){
 const cx=vm.createContext({console,performance,setTimeout,clearTimeout,structuredClone,...require('./helpers/example-reader.cjs')(root)});
 for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js','js/engine.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
 vm.runInContext('const C=Core;'+helper,cx);
 const {C,E,state}=vm.runInContext('({C:Core,E:YardEngine,state:engineShipState})',cx),messages=[],waiting=[],sync=[],mount=[];
 const deserialize=C.deserialize,syncCompartments=C.syncCompartments,remount=C.remount;let builtShip;
 // The example opens from its saved design (C.deserialize), never from the authoring tool.
 C.buildDesign=()=>{throw Error('buildDesign must not run when an example is opened');};C.deserialize=(...args)=>(builtShip=deserialize(...args));
 C.syncCompartments=(s,...args)=>{sync.push({ship:s,derive:new Error().stack.includes('deriveState')});return syncCompartments(s,...args);};
 C.remount=(s,...args)=>{mount.push(s);return remount(s,...args);};
 const scope={postMessage(msg){
  if(msg.type==='ready')return;const packet=structuredClone(msg);messages.push(packet);
  for(const w of waiting.slice())if(packet.type==='error'||packet.type===w.type&&(w.id==null?packet.gen===w.gen:packet.id===w.id)){
   waiting.splice(waiting.indexOf(w),1);clearTimeout(w.timer);packet.type==='error'?w.reject(Error(packet.message)):w.resolve(packet);
  }
 }};E.listenWorker(scope);
 const request=(data,type)=>new Promise((resolve,reject)=>{const w={type,id:data.id,gen:data.gen,resolve,reject,timer:setTimeout(()=>reject(Error('No '+type+' response')),10000)};waiting.push(w);scope.onmessage({data});});
 return{C,state,sync,mount,messages,request,get builtShip(){return builtShip;}};
}

test('a newly built example keeps its warmed worker state when the editor assigns a save identity',async()=>{
 const f=fixture(),built=await f.request({type:'build',id:1,key:'craft_tie_ln'},'built'),editor=JSON.parse(built.state);
 editor.saveId='ship-editor-identity';editor._client=true;
 assert.notEqual(f.C.publicJSON(editor),built.state,'the old whole-public-state handshake included the unrelated save ID');
 assert.equal(f.state(editor),built.state,'the actual editor helper must send byte-identical physical state');
 assert.equal(editor.saveId,'ship-editor-identity','serializing engine state retains the editor save destination');
 const parts=f.builtShip.parts.slice();f.sync.length=0;f.mount.length=0;
 const geometry=await f.request({type:'update',gen:1,state:f.state(editor),what:['all'],reset:true,stats:false},'geometry');
 assert.equal(f.sync.filter(c=>c.derive).length,0,'first display must not repeat already settled compartment derivation');
 assert.equal(f.mount.length,0,'first display must not remount the already built example');
 assert.equal(geometry.state,built.state);assert.ok(f.builtShip.parts.every((p,i)=>p===parts[i]),'worker part objects and their warmed caches survive');
 assert.equal(editor.saveId,'ship-editor-identity');
});

test('removing editor identity from worker state does not suppress derivation after a real design change',async()=>{
 const f=fixture(),built=await f.request({type:'build',id:1,key:'craft_tie_ln'},'built'),editor=JSON.parse(built.state);
 editor.saveId='ship-stable-destination';editor._client=true;assert.ok(editor.parts.length);
 const id=editor.parts[0].id;editor.parts[0].c[0]+=2;
 const changed=f.state(editor);assert.notEqual(changed,built.state);
 f.sync.length=0;f.mount.length=0;
 const geometry=await f.request({type:'update',gen:1,state:changed,what:['all'],reset:true,stats:false},'geometry');
 assert.equal(f.sync.filter(c=>c.derive).length,2,'a changed design still derives its compartments');assert.equal(f.mount.length,1);
 assert.ok(f.sync.every(c=>c.ship!==f.builtShip),'the modified state must not reuse the old worker design object');
 assert.equal(JSON.parse(geometry.state).parts.find(p=>p.id===id).c[0],editor.parts[0].c[0]);
 assert.equal(editor.saveId,'ship-stable-destination');
});
