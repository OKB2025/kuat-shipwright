const fs=require('fs'),z=require('zlib'),R=process.argv[2]||'/home/user/kuat-shipwright';
const {C}=require('/home/user/kuat-shipwright/scripts/update-ship-examples.cjs').loadRuntime(R);
const raw=JSON.parse(z.gunzipSync(fs.readFileSync('/home/user/kuat-shipwright/tests/fixtures/sunk-structure-interference-2026-11-12.json.gz')));
console.log('raw parts 14-19',raw.parts.slice(14,20).map(p=>({id:p.id,k:p.k,tw:p.tw})));
const ser=s=>{const o=C.serialize(s);return typeof o==='string'?o:JSON.stringify(o);};
const s=C.deserialize(JSON.parse(JSON.stringify(raw)));
console.log('loaded same ids',s.parts.filter(p=>raw.parts.slice(14,20).some(q=>q.id===p.id)).map(p=>({id:p.id,k:p.k,tw:p.tw})));
const s1=ser(s),s2=ser(C.deserialize(JSON.parse(s1)));
const a=JSON.parse(s1).fits,b=JSON.parse(s2).fits;console.log('fits',a.length,b.length);
let n=0;for(let i=0;i<Math.max(a.length,b.length);i++){if(JSON.stringify(a[i])!==JSON.stringify(b[i])){n++;if(n<=4){const x=a[i]||{},y=b[i]||{};const ks=[...new Set([...Object.keys(x),...Object.keys(y)])].filter(k=>JSON.stringify(x[k])!==JSON.stringify(y[k]));console.log('fit',i,x.id,x.k,ks.map(k=>k+':'+JSON.stringify(x[k])?.slice(0,120)+' -> '+JSON.stringify(y[k])?.slice(0,120)).join(' | '));}}}
console.log('differing fits',n);console.log('A0',JSON.stringify(a[0]).slice(0,900));console.log('B0',JSON.stringify(b[0]).slice(0,900));
// does the fixed point fail without the repulsor parts at all? (repulsors stripped before load as other kinds)
const noR=JSON.parse(JSON.stringify(raw));noR.parts=noR.parts.filter(p=>p.k!=='repulsor');
const t1=ser(C.deserialize(noR)),t2=ser(C.deserialize(JSON.parse(t1)));console.log('stripped-before-load s1==s2',t1===t2,'same as migrated s1',t1===s1);
