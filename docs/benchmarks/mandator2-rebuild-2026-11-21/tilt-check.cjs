// Tilt of the Mandator II battery seated to its faces (user instruction 2026-11-21 「面に合わせて傾けて配置するようにして」).
// For every main (utl), secondary (quad175) and point-defence (pd) fitting of the stored example: the tilt from the vertical, the
// angle between the tilt and the normal of the face under the mount (a ray along -tilt from 3 m above it), the angle between the
// tilt and the measured normal of the user's mounts (MAN2_MOUNTS: +Y / -Y for the batteries, the mean of the two nearest bases for
// point defence), and the angle between a mirrored pair's tilts. usage: node tilt-check.cjs <output.json>
const fs=require('fs'),zlib=require('zlib'),path=require('path'),crypto=require('crypto'),root=path.resolve(__dirname,'../../..'),{C}=require(root+'/scripts/update-ship-examples.cjs').loadRuntime(root);
const core=fs.readFileSync(root+'/js/core.js','utf8'),at=core.indexOf('MAN2_MOUNTS=')+12;let i=at,d=0;for(;;i++){if(core[i]==='{')d++;else if(core[i]==='}'&&!--d)break;}const M=JSON.parse(core.slice(at,i+1));
const gz=fs.readFileSync(root+'/data/examples/mandator2/design.json.gz'),raw=zlib.gunzipSync(gz),ship=C.deserialize(JSON.parse(raw));
const nrm=v=>{const l=Math.hypot(...v);return v.map(x=>x/l);},ang=(a,b)=>Math.acos(Math.max(-1,Math.min(1,nrm(a).reduce((s,x,k)=>s+x*nrm(b)[k],0))))*180/Math.PI,r=v=>+v.toFixed(2);
const bases=M.pd.flatMap(p=>Math.abs(p[2])>1?[p,[p[0],p[1],-p[2],p[3],p[4],-p[5]]]:[p]);
const rows=[];for(const f of ship.fits.filter(f=>['utl','quad175','pd'].includes(f.k))){const t=f.tilt||f.n||C.AXES[f.a]||[0,1,0],up=C.AXES[f.a]?.slice()||(t[1]>=0?[0,1,0]:[0,-1,0]);
 const o=f.p.map((v,k)=>v+nrm(t)[k]*3),h=C.rayEnv(ship,o,nrm(t).map(x=>-x),{structOnly:true,maxT:30});let face=null;if(h?.n){face=h.n;if(face.reduce((s,x,k)=>s+x*t[k],0)<0)face=face.map(x=>-x);}
 let src=up;if(f.k==='pd'){const near=bases.map(b=>[Math.hypot(b[0]-f.p[0],b[1]-f.p[1],b[2]-f.p[2]),b]).sort((a,b)=>a[0]-b[0]).slice(0,2);src=nrm(near.reduce((s,[,b])=>s.map((x,k)=>x+b[3+k]),[0,0,0]));}
 const tw=f.tw&&ship.fits.find(q=>q.id===f.tw),twTilt=tw&&(tw.tilt||tw.n);
 rows.push({id:f.id,k:f.k,zone:f.batteryZone,tiltDeg:r(ang(t,up)),tilted:!!f.tilt,mode:f.mountMode,toFaceDeg:face?r(ang(t,face)):null,faceHit:h?(h.kind==='part'?'part '+h.part.id:'hull'):null,gapM:h?r(h.t-3):null,toSourceDeg:r(ang(t,src)),pairDeg:twTilt?r(ang(t,[twTilt[0],twTilt[1],-twTilt[2]])):null});}
const sum=k=>{const R=rows.filter(x=>x.k===k),max=f=>Math.max(...R.map(x=>x[f]??0));return {n:R.length,tilted:R.filter(x=>x.tiltDeg>.5).length,maxTilt:max('tiltDeg'),maxToFace:max('toFaceDeg'),noFace:R.filter(x=>x.toFaceDeg==null).length,maxGap:max('gapM'),minGap:Math.min(...R.map(x=>x.gapM??0)),maxToSource:max('toSourceDeg'),maxPair:max('pairDeg')};};
const out={design:{jsonSha256:crypto.createHash('sha256').update(raw).digest('hex')},coreSha256:crypto.createHash('sha256').update(core).digest('hex'),summary:{utl:sum('utl'),quad175:sum('quad175'),pd:sum('pd')},worstToFace:rows.filter(x=>x.toFaceDeg!=null).sort((a,b)=>b.toFaceDeg-a.toFaceDeg).slice(0,6),worstToSource:rows.slice().sort((a,b)=>b.toSourceDeg-a.toSourceDeg).slice(0,6),rows};
fs.writeFileSync(process.argv[2],JSON.stringify(out,null,1)+'\n');console.log(JSON.stringify(out.summary,null,1));console.log('worst to face',JSON.stringify(out.worstToFace.slice(0,3)));console.log('worst to source',JSON.stringify(out.worstToSource.slice(0,4)));
