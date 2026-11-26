const fs=require('fs'),z=require('zlib'),R=process.argv[2]||'/home/user/kuat-shipwright';
const {C}=require('/home/user/kuat-shipwright/scripts/update-ship-examples.cjs').loadRuntime(R);
const raw=JSON.parse(z.gunzipSync(fs.readFileSync('/home/user/kuat-shipwright/tests/fixtures/sunk-structure-interference-2026-11-12.json.gz')));
const canon=v=>Array.isArray(v)?v.map(canon):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])])):v;
const ser=s=>{const o=C.serialize(s);return typeof o==='string'?o:JSON.stringify(o);};
const s1=ser(C.deserialize(raw)),s2=ser(C.deserialize(JSON.parse(s1))),s3=ser(C.deserialize(JSON.parse(s2)));
console.log(R,'raw s1==s2',s1===s2,'s2==s3',s2===s3,'canonical s1==s2',JSON.stringify(canon(JSON.parse(s1)))===JSON.stringify(canon(JSON.parse(s2))),'s1 has repulsor',/"k":"repulsor"/.test(s1));
