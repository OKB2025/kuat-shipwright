// node gamesection.cjs ROOT KEY AXIS POS U0 U1 V0 V1 STEP OUT  — rasterize shape parts on a plane (AXIS x: plane x=POS, grid z(U),y(V); AXIS z: plane z=POS, grid x(U),y(V))
const fs=require('fs'),path=require('path'),vm=require('vm'),z=require('zlib');
const [root,key,axis,pos,u0,u1,v0,v1,step,out]=process.argv.slice(2);const P=+pos,S=+step;
const cx=vm.createContext({console,performance:{now:()=>0}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext("Core",cx),s=process.env.BUILD?C.buildDesign(key):C.deserialize(JSON.parse(z.gunzipSync(fs.readFileSync(path.join(root,"data/examples",key,"design.json.gz")))));
const shapes=s.parts.filter(C.isShapePart),cells=[];
const near=shapes.filter(p=>{const b=C.partAABB(p);return axis==='x'?(b[0]<=P&&b[3]>=P&&b[2]<=+u1&&b[5]>=+u0&&b[1]<=+v1&&b[4]>=+v0):(b[2]<=P&&b[5]>=P&&b[0]<=+u1&&b[3]>=+u0&&b[1]<=+v1&&b[4]>=+v0)});
for(let u=+u0;u<=+u1;u+=S)for(let v=+v0;v<=+v1;v+=S){const q=axis==='x'?[P,v,u]:[u,v,P];let hit=null;for(const p of near){try{if(C.inPart(p,q)){hit=p;if(/接続支柱/.test(p.label||''))break;}}catch(e){}}if(hit)cells.push([+u.toFixed(2),+v.toFixed(2),/接続支柱/.test(hit.label||'')?1:0,hit.id]);}
const hull=[];if(s.hull&&!s.hull.assembly)for(let u=+u0;u<=+u1;u+=S)for(let v=+v0;v<=+v1;v+=S){const q=axis==='x'?[P,v,u]:[u,v,P];try{if(C.inHull(s,q))hull.push([+u.toFixed(2),+v.toFixed(2)]);}catch(e){}}
fs.writeFileSync(out,JSON.stringify({cells,hull,step:S,parts:near.map(p=>({id:p.id,label:p.label}))}));
