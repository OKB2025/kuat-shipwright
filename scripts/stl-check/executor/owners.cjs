const fs=require('fs'),path=require('path'),z=require('zlib');const root=process.argv[2],out=process.argv[3];
const {C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const s=process.env.BUILD?C.buildDesign('executor'):C.deserialize(JSON.parse(z.gunzipSync(fs.readFileSync(path.join(root,'data/examples/executor/design.json.gz')))));
const shapes=s.parts.filter(C.isShapePart),struts=shapes.filter(p=>/接続支柱/.test(p.label||''));
const at=(q,skip)=>shapes.filter(p=>p.id!==skip&&!/接続支柱/.test(p.label||'')).filter(p=>{try{return C.inPart(p,q)}catch(e){return false}});
const rows=struts.map(st=>{const a=C.partAABB(st),cx=(a[0]+a[3])/2,cz=(a[2]+a[5])/2;const up=[],dn=[];for(let d=0;d<=12;d+=1){if(!up.length)up.push(...at([cx,a[4]+d,cz],st.id));if(!dn.length)dn.push(...at([cx,a[1]-d,cz],st.id));}
 const inHullTop=C.inHull?.(s,[cx,a[1]-3,cz]);return {id:st.id,label:st.label,aabb:a.map(v=>+v.toFixed(1)),above:up.map(p=>({id:p.id,label:p.label,form:p.form,aabb:C.partAABB(p).map(v=>+v.toFixed(1))})),below:dn.map(p=>({id:p.id,label:p.label,form:p.form,aabb:C.partAABB(p).map(v=>+v.toFixed(1))})),belowHull:!!inHullTop};});
fs.writeFileSync(out,JSON.stringify(rows,null,1));for(const r of rows)console.log(r.id,r.label.replace('の接続支柱',''),'h',(r.aabb[4]-r.aabb[1]).toFixed(0),'above',r.above.map(p=>p.id+':'+p.form+'['+p.aabb[1]+','+p.aabb[4]+']').join(' '),'| below',r.below.map(p=>p.id+':'+p.form+'['+p.aabb[1]+','+p.aabb[4]+']').join(' '));
