// Export the triangles of every shape part of an example (game frame, metres) with the part index, for raster comparison.
const fs=require('fs'),path=require('path'),z=require('zlib');const root=process.argv[2],key=process.argv[3],out=process.argv[4];
const {C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const s=process.env.BUILD?C.buildDesign(key):C.deserialize(JSON.parse(z.gunzipSync(fs.readFileSync(path.join(root,'data/examples',key,'design.json.gz')))));
const shapes=s.parts.filter(C.isShapePart);const tris=[],ids=[],meta=[];
shapes.forEach((p,i)=>{let T;try{T=C.structTriangles(p);}catch(e){return;}for(let j=0;j<T.length;j++)tris.push(T[j]);for(let j=0;j<T.length/9;j++)ids.push(i);meta.push({i,id:p.id,label:p.label||'',form:p.form,strut:/接続支柱/.test(p.label||''),aabb:C.partAABB(p)});});
fs.writeFileSync(out+'.f32',Buffer.from(new Float32Array(tris).buffer));fs.writeFileSync(out+'.ids',Buffer.from(new Int32Array(ids).buffer));fs.writeFileSync(out+'.json',JSON.stringify({meta,hull:s.hull&&{L:s.hull.L,W:s.hull.W,H:s.hull.H,assembly:!!s.hull.assembly}}));
console.log('parts',shapes.length,'tris',ids.length);
