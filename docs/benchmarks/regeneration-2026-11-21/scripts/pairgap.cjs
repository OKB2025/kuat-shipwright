// usage: node pairgap.cjs <core root> <key> <pairs json> — aviationConnected under that core, per-axis gap of packed boxes and placed boxes, cells
const zlib=require('zlib'),fs=require('fs'),path=require('path');const [core,k,pj]=process.argv.slice(2);const {C}=require(path.join(core,'scripts/update-ship-examples.cjs')).loadRuntime(core);
const s=C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(`data/examples/${k}/design.json.gz`))));C.computeStats(s);const P=i=>s.parts.find(p=>p.id===i);
const gap=(X,Y)=>[0,1,2].map(q=>+Math.max(X[q]-Y[q+3],Y[q]-X[q+3],0).toFixed(2)),pl=p=>C.partAABB({...p,_packing:null,_clip:null});
for(const [i,j] of JSON.parse(pj)){const a=P(i),b=P(j);console.log(`#${i}-#${j}`,'connected',C.aviationConnected(a,b),'packed gap',gap(C.partAABB(a),C.partAABB(b)),'placed gap',gap(pl(a),pl(b)),'cells',JSON.stringify(a._packing?.cell?.map(x=>+x.toFixed(2))),JSON.stringify(b._packing?.cell?.map(x=>+x.toFixed(2))));}
