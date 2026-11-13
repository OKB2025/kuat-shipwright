// A real design-engine Worker (js/engine.js with js/gfx.js and Core) in a vm context, driven through its
// message interface. update() sends one editor update and resolves with the parsed public state it returns.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function designWorker(root,C){
 const context=vm.createContext({Core:C,console:{log(){},warn(){},info(){},error:console.error},setTimeout,clearTimeout,structuredClone,performance});
 vm.runInContext(fs.readFileSync(path.join(root,'js/gfx.js'),'utf8'),context);
 vm.runInContext(fs.readFileSync(path.join(root,'js/engine.js'),'utf8'),context);
 const messages=[],scope={postMessage(m){messages.push(m);}};
 context.scope=scope;vm.runInContext('YardEngine.listenWorker(scope)',context);
 const send=m=>scope.onmessage({data:structuredClone(m)});
 async function wait(type,gen,limit=600000){
  for(let i=0;i<limit;i++){
   const failure=messages.find(m=>m.type==='error');if(failure)throw new Error('Worker error: '+failure.message);
   const reply=messages.find(m=>m.type===type&&m.gen===gen);if(reply){messages.splice(messages.indexOf(reply),1);return reply;}
   await new Promise(r=>setTimeout(r,2));
  }
  throw new Error('Worker reply timeout '+type+'/'+gen);
 }
 let gen=0;
 async function update(state,{reset=false,what=['parts','fits','hatches'],designId='worker-harness'}={}){
  const g=++gen;send({type:'update',gen:g,designId,state:typeof state==='string'?state:JSON.stringify(state),reset,what,stats:false,view:{deferSurfaces:true}});
  // The Worker answers twice: 'geometry' (structures, placements) and then 'surfaceGeometry' (the surface pass,
  // which can rewrite hatches, surfaces and other state). Both answers carry the public state (F3, 2026-11-13).
  const reply=await wait('geometry',g),surface=await wait('surfaceGeometry',g);
  return {reply,state:JSON.parse(reply.state),surfaceReply:surface,surfaceState:surface.state?JSON.parse(surface.state):null};
 }
 return {send,wait,update,context};
}
module.exports={designWorker};
