// Triangles of the Executor's primary hull structure alone (no trench, cuts or other parts), optionally with scaled stations.
const fs=require('fs'),path=require('path');const root=process.argv[2],out=process.argv[3],scales=process.argv[4]?JSON.parse(fs.readFileSync(process.argv[4])):null;
const {C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const src=fs.readFileSync(path.join(root,'js/core.js'),'utf8'),grab=n=>{const i=src.indexOf('const '+n+'=')+n.length+7;let d=0,j=i,open=src[i],close=open==='['?']':'}';for(;j<src.length;j++){if(src[j]===open)d++;else if(src[j]===close){d--;if(!d)break;}}return JSON.parse(src.slice(i,j+1));};
const B=grab('EXECUTOR_BLUEPRINT'),ST=grab('EXECUTOR_WEDGE_STATIONS');
const st=scales?(Array.isArray(scales[0])&&scales[0].length===8?scales:ST.map((r,i)=>{const q=r.slice();q[1]*=scales[i][0];q[2]*=scales[i][1];q[3]=scales[i][2]??q[3];return q;})):ST;
const s=C.newShip({...B.hull,stations:st},'hull');s.fits=[];C.ensurePrimaryHull(s);const h=s.parts.find(p=>C.isShapePart(p));const T=C.structTriangles(h);
fs.writeFileSync(out+'.f32',Buffer.from(new Float32Array(T).buffer));fs.writeFileSync(out+'.json',JSON.stringify({stations:st,H:B.hull.H,W:B.hull.W,L:B.hull.L,tris:T.length/9}));console.log('hull tris',T.length/9,'stations',st.length);
