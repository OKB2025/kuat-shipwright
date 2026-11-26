const fs=require('node:fs'),zlib=require('node:zlib'),path=require('node:path'),vm=require('node:vm');
const root=process.argv[2]||'/home/user/kuat-shipwright';
const saved=()=>JSON.parse(zlib.gunzipSync(fs.readFileSync('/home/user/kuat-shipwright/tests/fixtures/sunk-structure-interference-2026-11-12.json.gz')).toString('utf8'));
function worker(){
 const cx=vm.createContext({console,performance,setTimeout,clearTimeout,structuredClone});
 for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js','js/engine.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
 const {C,E}=vm.runInContext('({C:Core,E:YardEngine})',cx),messages=[],waiters=[];
 const scope={postMessage(message){const packet=structuredClone(message);messages.push(packet);for(const w of waiters.slice())if((packet.type===w.type&&packet.gen===w.gen)||packet.type==='error'){waiters.splice(waiters.indexOf(w),1);packet.type==='error'?w.reject(Error(packet.message)):w.resolve(packet);}}};E.listenWorker(scope);
 const wait=(type,gen)=>new Promise((resolve,reject)=>{const packet=messages.find(m=>m.type===type&&m.gen===gen||m.type==='error');if(packet)packet.type==='error'?reject(Error(packet.message)):resolve(packet);else waiters.push({type,gen,resolve,reject});});
 const send=message=>scope.onmessage({data:structuredClone(message)});
 return {C,send,wait,messages};
}
const update=(f,gen,state,reset=false)=>{f.send({type:'update',gen,designId:'sunk',state,what:reset?['all']:['parts'],reset,statsDelay:0,view:{deferSurfaces:true}});return f.wait('stats',gen);};
const rel=(a,b)=>Math.abs(a-b)/Math.abs(b);
(async()=>{
 const rawText=JSON.stringify(saved());
 const f=worker(),{C}=f;
 const cold=C.deserialize(JSON.parse(rawText)),coldMass=C.computeStats({...cold,_cache:null}).mass;
 console.log('root',root,'coldMass',coldMass,'cold parts',cold.parts.length);
 const out=[];
 const step=async(label,gen,state,reset,expect)=>{const t=Date.now();try{const r=await update(f,gen,state,reset);out.push({label,gen,reset,mass:r.stats.mass,expect,rel:rel(r.stats.mass,expect),ok:rel(r.stats.mass,expect)<=1e-6,provisional:r.provisional,ms:Date.now()-t});}catch(e){out.push({label,gen,error:e.message});}console.log(JSON.stringify(out[out.length-1]));};
 // B1: reset with raw JSON
 await step('B1 reset raw',1,rawText,true,coldMass);
 // B2: reset with publicJSON of the cold load (fresh worker so it's a real reset? same worker with reset=true and different state)
 const pub=C.publicJSON(cold);
 await step('B2 reset publicJSON',2,pub,true,coldMass);
 // B3: patch, one non-structure part moved
 const edited=C.deserialize(JSON.parse(rawText));const target=edited.parts.find(p=>p.id===82);
 target.c[0]+=0.01;const editedPub=C.publicJSON(edited);
 const editedMassDirect=C.computeStats({...edited,_cache:null}).mass;
 console.log('B3 moved part',target.id,target.k,'editedMass cold',editedMassDirect,'publicJSON len',editedPub.length);
 await step('B3 patch moved part',3,editedPub,false,editedMassDirect);
 const e2=C.deserialize(JSON.parse(rawText));e2.parts.find(p=>p.id===82).c[0]+=0.01;e2.parts.find(p=>p.id===82).d=5.5;const e2Mass=C.computeStats({...e2,_cache:null}).mass;console.log('B3b cold mass with d=5.5',e2Mass);
 await step('B3b patch resized part',5,C.publicJSON(e2),false,e2Mass);
 // B4: patch with raw JSON again (old undo entry)
 await step('B4 patch raw',6,rawText,false,coldMass);
 const errors=f.messages.filter(m=>m.type==='error');console.log('error packets',errors.length,errors.map(e=>e.message));
 console.log('message types',JSON.stringify([...new Set(f.messages.map(m=>m.type))]));
 // B2 with a fresh worker too
 const g=worker();try{const r=await update(g,1,pub,true);console.log('B2b fresh worker reset publicJSON mass',r.stats.mass,'rel',rel(r.stats.mass,coldMass));}catch(e){console.log('B2b error',e.message);}
 process.exit(0);
})();
