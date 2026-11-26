const fs=require('fs'),z=require('zlib'),R='/home/user/kuat-shipwright';
const {C}=require(R+'/scripts/update-ship-examples.cjs').loadRuntime(R);
const inputs=[
 ['fixture',()=>JSON.parse(z.gunzipSync(fs.readFileSync(R+'/tests/fixtures/sunk-structure-interference-2026-11-12.json.gz')))],
 ['ywing',()=>JSON.parse(z.gunzipSync(fs.readFileSync(R+'/data/examples/craft_ywing/design.json.gz')))],
 ['btl',()=>JSON.parse(fs.readFileSync(R+'/docs/handoff-2026-11-20/refs/btl-a4-remodel-rev3-2026-11-25.json'))],
];
const ser=s=>{const o=C.serialize(s);return typeof o==='string'?o:JSON.stringify(o);};
// scan any structure for fields that hold a removed id (number, 'p<id>', 'f<id>' strings, arrays thereof)
function scan(obj,ids,path,hits,depth=0){
 if(obj==null||depth>12)return;
 if(Array.isArray(obj)){obj.forEach((v,i)=>scan(v,ids,path+'['+i+']',hits,depth+1));return;}
 if(typeof obj!=='object')return;
 for(const [k,v] of Object.entries(obj)){
  if(k.startsWith('_'))continue;
  const p=path+'.'+k;
  if(typeof v==='number'&&ids.has(v)&&!['c','s','d','w','h','l','r','x','y','z','yaw','pitch','roll','len','size','dim'].includes(k)&&!/^\d+$/.test(k))hits.push(p+'='+v);
  else if(typeof v==='string'&&/^[pf]\d+$/.test(v)&&ids.has(+v.slice(1)))hits.push(p+'='+v);
  else if(Array.isArray(v)&&v.length&&v.every(x=>typeof x==='number')){if(!['c','s','dims','size','pos','rot','col','color','dir','n','normal','off','offset','axis'].includes(k))v.forEach((x,i)=>{if(ids.has(x))hits.push(p+'['+i+']='+x);});}
  else if(typeof v==='object')scan(v,ids,p,hits,depth+1);
 }
}
for(const [name,load] of inputs){
 const raw=load(),before=JSON.stringify(raw);
 const removed=new Set(raw.parts.filter(p=>p.k==='repulsor'||p.k==='landingGear').map(p=>p.id));
 // raw references to the removed ids (to know what had to be cleaned)
 const rawHits=[];for(const key of ['parts','fits','hatches','links','groups','batteries','surfaces'])scan(raw[key],removed,key,rawHits);
 const rawHitsNonSelf=rawHits.filter(h=>!/^parts\[\d+\]\.id=/.test(h));
 const t0=Date.now();const s=C.deserialize(raw);const tLoad=Date.now()-t0;
 const mutated=JSON.stringify(raw)!==before;
 const left=s.parts.filter(p=>p.k==='repulsor'||p.k==='landingGear').map(p=>p.k+p.id);
 const hits=[];for(const key of ['parts','fits','hatches','links','groups','batteries','surfaces'])scan(s[key],removed,key,hits);
 const s1=ser(s),d2=C.deserialize(JSON.parse(s1)),s2=ser(d2),d3=C.deserialize(JSON.parse(s2)),s3=ser(d3);
 const S=C.computeStats({...s,_cache:null});
 console.log(JSON.stringify({name,removed:[...removed],rawRefsToRemoved:rawHitsNonSelf,rawLinks:(raw.links||[]).length,loadedLinks:(s.links||[]).length,rawGroups:(raw.groups||[]).map(g=>g.parts?.length),loadedGroups:(s.groups||[]).map(g=>g.parts?.length),systemsVersionRaw:raw.systemsVersion,systemsVersionLoaded:s.systemsVersion,
  partsRaw:raw.parts.length,partsLoaded:s.parts.length,leftRetired:left,idHitsAfterLoad:hits.filter(h=>!/^parts\[\d+\]\.id=/.test(h)),inputMutated:mutated,
  s1eqs2:s1===s2,s2eqs3:s2===s3,s1len:s1.length,s1HasRetired:/"k":"(repulsor|landingGear)"/.test(s1),
  mass:S.mass,repulsorSupport:S.repulsorSupport,ratio:S.repulsorSupport/S.mass,tLoad}));
 if(s1!==s2){const a=JSON.parse(s1),b=JSON.parse(s2);for(const k of new Set([...Object.keys(a),...Object.keys(b)]))if(JSON.stringify(a[k])!==JSON.stringify(b[k]))console.log('  s1/s2 differ at',k);}
}
