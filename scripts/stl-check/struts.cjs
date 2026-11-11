const fs=require('fs'),path=require('path'),vm=require('vm'),z=require('zlib');
const root=process.argv[2],out=process.argv[3],keys=process.argv.slice(4);
const cx=vm.createContext({console,performance:{now:()=>0}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),res={};
for(const k of keys){
 const j=JSON.parse(z.gunzipSync(fs.readFileSync(path.join(root,'data/examples',k,'design.json.gz'))));const s=C.deserialize(j);
 const shapes=s.parts.filter(C.isShapePart),bb=shapes.map(C.partAABB);
 const all=[0,1,2].map(i=>Math.min(...bb.map(b=>b[i]))).concat([3,4,5].map(i=>Math.max(...bb.map(b=>b[i]))));
 const struts=shapes.filter(p=>/接続支柱/.test(p.label||'')).map(p=>({id:p.id,label:p.label,c:p.c,s:p.s,form:p.form,aabb:C.partAABB(p)}));
 const owners=struts.map(st=>{const name=st.label.replace(/の接続支柱$/,'');return shapes.filter(q=>q.label===name&&!/接続支柱/.test(q.label)).map(q=>({id:q.id,aabb:C.partAABB(q)}))});
 res[k]={hull:s.hull&&{L:s.hull.L,W:s.hull.W,H:s.hull.H},bbox:all,nShapes:shapes.length,struts,owners};
 console.log(k,'bbox',all.map(v=>+v.toFixed(1)).join(','),'struts',struts.length);
}
fs.writeFileSync(out,JSON.stringify(res,null,1));
