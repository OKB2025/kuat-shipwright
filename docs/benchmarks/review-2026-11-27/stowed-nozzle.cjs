const root=process.argv[2],path=require('path'),{C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const raw=require(path.join(root,'docs/handoff-2026-11-20/refs/xwing-refit-2026-11-27.json')),u=C.deserialize(JSON.parse(JSON.stringify(raw))),s=C.buildDesign('craft_xwing');
const pts=T=>{const r=[];for(let i=0;i<T.length;i+=3)r.push([T[i],T[i+1],T[i+2]]);return r;},far=(X,Y)=>Math.max(...X.map(x=>Math.min(...Y.map(y=>Math.hypot(x[0]-y[0],x[1]-y[1],x[2]-y[2])))));
let worst=0,n=0;
for(const wing of s.parts.filter(C.isFoil)){const pose=C.foilPose(s,wing,wing.wing.stow),uw=u.parts.find(p=>p.id===wing.id),uframe=C.foilFrame(u,uw);
 for(const pf of pose.fits){const f0=s.fits.find(f=>f.id===(pf._poseOf??pf.id));if(f0?.nozzle!=='track')continue;const o=C.fitOrigin(pf),f00=C.fitFrameOf(f0),up=C.norm(pf.n),fw=f00.fw,rt=C.norm(C.cross(fw,up)),s0=Math.sign(C.dot(rt,f00.rt))||1,fr={fw,up,rt:rt.map(v=>v*s0)};
  for(const q of C.trackNozzlePieces(pf,C.trackNozzleLean(s,f0))){const T=C.structTriangles(q),W=[];for(let i=0;i<T.length;i+=3){const v=[0,1,2].map(a=>o[a]+fr.fw[a]*T[i]+fr.up[a]*T[i+1]+fr.rt[a]*T[i+2]);W.push(v);}
   const side=(f0.p[2]>0?'右舷':'左舷')+(f0.p[1]>2?'上翼':'下翼'),orig=u.parts.find(p=>(p.label||'').startsWith(side)&&(p.label||'').includes(q.name));
   const Q=pts(C.structTriangles(orig)).map(v=>C.foilAt(uframe,uw,v,0));const d=Math.max(far(W,Q),far(Q,W));worst=Math.max(worst,d);n++;
   console.log(f0.id,q.name,'stowed max vertex gap',d.toExponential(2));}}}
console.log('pieces',n,'worst',worst);
