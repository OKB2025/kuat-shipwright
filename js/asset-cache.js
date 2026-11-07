/* Verified source downloads and interruptible stock-model preparation. */
const KSAssetCache = (() => {
'use strict';
const W=typeof window==='undefined'?globalThis:window, CACHE='ks-source-assets-v1';
const hex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
async function digest(blob){return hex(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()));}
async function getBlob(url,expected,onBytes=()=>{}){
 let cache=null,key=null;
 if(expected&&W.caches&&W.crypto?.subtle){try{cache=await W.caches.open(CACHE);key=new URL(url,W.KS_ASSET_BASE||W.document?.baseURI||W.location?.href);key.searchParams.set('_ksasset',expected);const hit=await cache.match(key.href);if(hit){const b=await hit.blob();if(await digest(b)===expected){onBytes(b.size);return b;}await cache.delete(key.href);}}catch{cache=null;}}
 const r=await fetch(url,{cache:'no-cache',priority:'low'});if(!r.ok)throw Error(url+' ('+r.status+')');
 const parts=[];if(r.body?.getReader){const reader=r.body.getReader();for(;;){const {done,value}=await reader.read();if(done)break;parts.push(value);onBytes(value.byteLength);}}else{const b=await r.arrayBuffer();parts.push(b);onBytes(b.byteLength);}
 const blob=new Blob(parts,{type:'text/javascript'});if(expected&&W.crypto?.subtle&&await digest(blob)!==expected)throw Error('Source checksum mismatch: '+url);
 if(cache&&key)try{await cache.put(key.href,new Response(blob));for(const old of await cache.keys()){const u=new URL(old.url);if(u.origin===key.origin&&u.pathname===key.pathname&&u.href!==key.href)await cache.delete(old);}}catch{}
 return blob;
}
function preloadAssets({assets,concurrency=2,onProgress=()=>{},fetchAsset=getBlob}){
 const unique=new Map();for(const a of assets||[])if(a?.url&&/^[a-f0-9]{64}$/.test(a.sha256||''))unique.set(a.url+'#'+a.sha256,a);
 const list=[...unique.values()],state={phase:'downloading',total:list.length,ready:0,failed:0};let cursor=0,stopped=false;
 const notify=()=>onProgress({...state});
 const runner=async()=>{while(!stopped&&cursor<list.length){const a=list[cursor++];try{await fetchAsset(a.url,a.sha256);state.ready++;}catch{state.failed++;}notify();}};
 notify();const done=Promise.all(Array.from({length:Math.min(list.length,Math.max(1,concurrency))},runner)).then(()=>{state.phase=stopped?'stopped':'complete';notify();return {...state};});
 return {done,get state(){return {...state};},stop(){stopped=true;state.phase='stopped';notify();}};
}
function createPreloader({keys,createWorker,busy=()=>false,onProgress=()=>{},idleMs=2000,scope=W}){
 const list=[...new Set(keys)].map(key=>({key,trial:false})),done=new Set(),failed=new Set();
 let worker=null,timer=null,monitor=null,inflight=null,token=0,stopped=false,quietUntil=0,serial=0,starting=false;
 const state={phase:'waiting',ready:0,failed:0,total:list.length,current:null};
 const notify=phase=>{state.phase=phase;state.ready=done.size;state.failed=failed.size;onProgress({...state});};
 const blocked=()=>stopped||scope.document?.hidden||busy()||Date.now()<quietUntil;
 const close=()=>{token++;worker?.terminate();worker=null;inflight=null;starting=false;clearInterval(monitor);monitor=null;};
 const schedule=()=>{clearTimeout(timer);if(stopped||!list.length)return;timer=setTimeout(run,Math.max(250,quietUntil-Date.now()));};
 function interrupt(){quietUntil=Date.now()+idleMs;close();notify('waiting');schedule();}
 async function run(){
  timer=null;if(blocked()){schedule();return;}if(worker||starting||!list.length)return;
  const ticket=++token;starting=true;state.current=list[0].key;notify('preparing');
  try{const w=await createWorker();if(ticket!==token||blocked()){w?.terminate();starting=false;schedule();return;}worker=w;starting=false;
   const next=()=>{if(!list.length)return;const item=list[0];state.current=item.key;inflight=++serial;worker.postMessage({type:'fleet',id:inflight,key:item.key,trial:item.trial,prepareOnly:true,silent:true});};
   worker.onmessage=e=>{if(ticket!==token||!inflight||e.data?.id!==inflight)return;const r=e.data,item=list[0];
    if(r.src==='unavailable'||r.type==='fleet'&&!r.cacheSaved){state.lastError=r.src==='unavailable'?'Persistent storage is unavailable':'Completed data could not be saved';close();stopped=true;notify('unavailable');return;}
    if(r.type==='error'){state.lastError=r.message||'Example preparation failed';failed.add(item.key);list.shift();close();notify(list.length?'waiting':'complete');schedule();return;}
    if(r.type!=='fleet')return;
    if(!item.trial){item.trial=true;next();return;}
    done.add(item.key);list.shift();close();state.current=null;notify(list.length?'waiting':'complete');schedule();
   };
   worker.onerror=e=>{if(ticket!==token)return;state.lastError=e?.message||'Background worker failed';failed.add(list.shift().key);close();notify(list.length?'waiting':'complete');schedule();};
   monitor=setInterval(()=>{if(blocked())interrupt();},250);next();
  }catch(error){if(ticket!==token)return;state.lastError=String(error?.message||error);starting=false;failed.add(list.shift().key);close();notify(list.length?'waiting':'complete');schedule();}
 }
 const events=['pointerdown','keydown','wheel','ks-engine-foreground'];for(const e of events)scope.addEventListener?.(e,interrupt,{passive:true});
 const visible=()=>{if(scope.document?.hidden)interrupt();else schedule();};scope.document?.addEventListener('visibilitychange',visible);
 schedule();notify('waiting');return {get state(){return {...state};},interrupt,stop(){stopped=true;clearTimeout(timer);close();for(const e of events)scope.removeEventListener?.(e,interrupt);scope.document?.removeEventListener('visibilitychange',visible);notify('stopped');}};
}
return {getBlob,preloadAssets,createPreloader};
})();
if(typeof window!=='undefined')window.KSAssetCache=KSAssetCache;
if(typeof module!=='undefined')module.exports=KSAssetCache;
