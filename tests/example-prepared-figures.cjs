// 2026-11-27 (user「公試だけでなく艦隊戦も読み込めるように」, after the trial of an Imperial or Venator dropped back to the title on an
// iPhone): an example with surface sections carries its prepared figures (data/examples/<key>/prepared.json.gz: the whole profile and
// the display statistics, worked out by the worker's own steps). The worker uses them in place of the performance calculation while
// the file's model key, display projection and design checksum are current, and they equal what it computes.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function worker({tamper}={}){
 const cx=vm.createContext({console:{log(){},warn(){},error:console.error},setTimeout,clearTimeout,setInterval,clearInterval,structuredClone,performance,URL,Blob,Response,TextDecoder,TextEncoder,DecompressionStream,crypto:globalThis.crypto,
  KS_READ_ASSET:u=>{let b=fs.readFileSync(path.join(root,u));if(tamper&&/prepared/.test(u))b=tamper(b);return new Blob([b]);}});
 for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js','js/engine.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
 const {C,E,data}=vm.runInContext('({C:Core,E:YardEngine,data:YardFleetData})',cx);let computed=0;const cs=C.computeStats;C.computeStats=function(...a){computed++;return cs.apply(this,a);};
 const msgs=[],scope={postMessage(m){msgs.push(m);}};E.listenWorker(scope);
 const fleet=async job=>{const id=msgs.length+1;scope.onmessage({data:{type:'fleet',id,...job}});while(!msgs.some(m=>m.id===id))await new Promise(r=>setTimeout(r,50));return msgs.find(m=>m.id===id);};
 return {C,E,data,fleet,computed:()=>computed};
}
// equal as the worker posts them: numbers exactly (a zero's sign is not kept by JSON)
function same(a,b,p='',out=[]){if(out.length>5)return out;if(a===b)return out;if(typeof a==='number'&&typeof b==='number'){if(!(a===b||Number.isNaN(a)&&Number.isNaN(b)))out.push(p+': '+a+' vs '+b);return out;}
 if(!a||!b||typeof a!=='object'||typeof b!=='object'){out.push(p+': '+String(a).slice(0,30)+' vs '+String(b).slice(0,30));return out;}for(const k of new Set([...Object.keys(a),...Object.keys(b)])){if(a[k]===undefined&&b[k]===undefined)continue;same(a[k],b[k],p+'.'+k,out);}return out;}
test('every catalogue ship with surface sections has its prepared figures, bound to its row and its design',()=>{
 const {C,data}=worker();const surface=Object.entries(data.designs).filter(([,r])=>r.model?.surface);assert.ok(surface.length>=20,'the capital ships: '+surface.length);
 for(const [key,row] of surface){const a=row.model.preparedFigures;assert.ok(a,'prepared figures for '+key);const gz=fs.readFileSync(path.join(root,a.url));assert.equal(sha(gz),a.sha256,key);const raw=zlib.gunzipSync(gz);assert.equal(sha(raw),a.jsonSha256,key);
  const f=JSON.parse(raw);assert.equal(f.format,'ks-example-prepared');assert.equal(f.key,key);assert.equal(f.modelKey,C.profileModelKey(),key+': the current model');assert.equal(f.blueprintSha256,row.model.blueprintSha256,key+': its design');assert.ok(f.profile?.surface?.patches?.length>0&&f.displayStats,key);}
});
test('the worker flies an example on its prepared figures without the performance calculation, and they are what it computes',async()=>{
 const A=worker(),r=await A.fleet({key:'cr90',trial:true});assert.equal(r.type,'fleet');assert.equal(r.profileSrc,'prepared');assert.equal(A.computed(),0,'no performance calculation');assert.ok(r.profile.surface.patches.length>0&&r.stats);
 const B=worker();delete B.data.designs.cr90.model.preparedFigures;const q=await B.fleet({key:'cr90',trial:true});assert.equal(q.profileSrc,'computed');assert.ok(B.computed()>0);
 assert.deepEqual(same(r.profile,q.profile),[],'profile');assert.deepEqual(same(r.stats,q.stats),[],'display statistics');
});
test('prepared figures of another model key are not used: the figures are computed',async()=>{
 // a file of another model key whose checksums are right (data/fleet.js names it) is refused by its key
 const f0=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples/cr90/prepared.json.gz'))));f0.modelKey='stale';const raw=Buffer.from(JSON.stringify(f0)),gz=zlib.gzipSync(raw);
 const T=worker({tamper:()=>gz});Object.assign(T.data.designs.cr90.model.preparedFigures,{sha256:sha(gz),jsonSha256:sha(raw)});
 const r=await T.fleet({key:'cr90',trial:true});assert.equal(r.profileSrc,'computed');assert.ok(T.computed()>0);
 // a changed file fails the checksums
 const U=worker({tamper:b=>Buffer.concat([b,Buffer.from([0])])});const u=await U.fleet({key:'cr90',trial:true});assert.equal(u.profileSrc,'computed');
 const {E}=worker(),f=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples/cr90/prepared.json.gz'))),E.preparedReviver);assert.equal(f.displayStats.heat?.presets?.combat?.limitSeconds,Infinity,'Infinity survives the file');
});
