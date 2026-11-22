// usage: node stats.cjs <code root> <design.json.gz> <out.json>
const zlib=require('zlib'),fs=require('fs'),path=require('path');const root=path.resolve(process.argv[2]);const {C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const s=C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(process.argv[3]))));const S=C.computeStats(s);const o={};for(const k of Object.keys(S))if(typeof S[k]==='number')o[k]=S[k];
const rooms={};for(const p of s.parts)if(p.k==='room'||p.room)rooms[p.sys||p.type||p.k]=(rooms[p.sys||p.type||p.k]||0)+1;o._rooms=rooms;o._parts=s.parts.length;
fs.writeFileSync(process.argv[4],JSON.stringify(o));console.log('ok',process.argv[4]);
