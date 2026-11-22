// Closedness of each stored face-joined clip: signed volume about two far-apart origins (equal for a closed mesh) and edge-use counts.
const fs=require('fs'),path=require('path'),zlib=require('zlib');const [root,...keys]=process.argv.slice(2);
const {C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const sv=(T,o)=>{let s=0;for(let i=0;i<T.length;i+=9){const a=[T[i]-o[0],T[i+1]-o[1],T[i+2]-o[2]],b=[T[i+3]-o[0],T[i+4]-o[1],T[i+5]-o[2]],c=[T[i+6]-o[0],T[i+7]-o[1],T[i+8]-o[2]];s+=a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]);}return s/6;};
for(const key of keys){const ship=C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples',key,'design.json.gz')))));C.syncCompartments(ship);
for(const p of ship.parts.filter(p=>p._clip)){const T=p._clip.tris,v0=sv(T,[0,0,0]),v1=sv(T,[37,-53,71]);const m=new Map(),k=i=>[T[i],T[i+1],T[i+2]].map(v=>Math.round(v*1e5)).join(',');for(let i=0;i<T.length;i+=9){const v=[k(i),k(i+3),k(i+6)];for(let j=0;j<3;j++){const a=v[j],b=v[(j+1)%3];if(a===b)continue;const e=a<b?a+'|'+b:b+'|'+a;m.set(e,(m.get(e)||0)+1);}}const h={};for(const c of m.values())h[c]=(h[c]||0)+1;
console.log(key,p.id,p.k,'V0',v0.toPrecision(7),'Vshift',v1.toPrecision(7),'rel',((v1-v0)/v0).toExponential(2),'edgeUse',JSON.stringify(h));}}
