const fs=require('fs'),path=require('path'),zlib=require('zlib');const [root,...keys]=process.argv.slice(2);
const {C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
for(const key of keys){const ship=C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples',key,'design.json.gz')))));C.syncCompartments(ship);
for(const p of ship.parts.filter(p=>p._clip)){const T=p._clip.tris;let S=[0,0,0],A=0,tiny=0;for(let i=0;i<T.length;i+=9){const e1=[T[i+3]-T[i],T[i+4]-T[i+1],T[i+5]-T[i+2]],e2=[T[i+6]-T[i],T[i+7]-T[i+1],T[i+8]-T[i+2]],c=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]];for(let j=0;j<3;j++)S[j]+=c[j]/2;const a=Math.hypot(...c)/2;A+=a;if(a<1e-8)tiny++;}
const b=[0,1,2].map(j=>{let m=Infinity,M=-Infinity;for(let i=j;i<T.length;i+=3){m=Math.min(m,T[i]);M=Math.max(M,T[i]);}return [m,M];});
console.log(key,p.id,'tris',T.length/9,'area',A.toPrecision(5),'|sumAreaVec|/area',(Math.hypot(...S)/A).toExponential(2),'tiny',tiny,'box',b.map(([m,M])=>(M-m).toFixed(3)).join('x'));}}
