const path=require('path'),{C}=require(path.resolve('scripts/update-ship-examples.cjs')).loadRuntime(path.resolve('.'));
const raw=require(path.resolve('docs/handoff-2026-11-20/refs/xwing-refit-2026-11-27.json')),u=C.deserialize(JSON.parse(JSON.stringify(raw)));C.syncCompartments(u);
const s=C.buildDesign('craft_xwing');console.log('parts user',u.parts.length,'example',s.parts.length,'tracking guns',s.fits.filter(f=>f.nozzle==='track').length);
const bb=T=>{const b=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];for(let i=0;i<T.length;i+=3)for(let a=0;a<3;a++){b[a]=Math.min(b[a],T[i+a]);b[a+3]=Math.max(b[a+3],T[i+a]);}return b.map(v=>+v.toFixed(4));};
let worst=0;for(const f of s.fits.filter(f=>f.nozzle==='track')){const o=C.fitOrigin(f),fr=C.fitFrameOf(f),lean=C.trackNozzleLean(s,f);
 for(const q of C.trackNozzlePieces(f,lean)){const T=C.structTriangles(q),W=[];for(let i=0;i<T.length;i+=3){for(let a=0;a<3;a++)W.push(o[a]+fr.fw[a]*T[i]+fr.up[a]*T[i+1]+fr.rt[a]*T[i+2]);}
  const side=(f.p[2]>0?'右舷':'左舷')+(f.p[1]>2?'上翼':'下翼'),orig=u.parts.find(p=>(p.label||'').startsWith(side)&&(p.label||'').includes(q.name)),bo=bb(C.structTriangles(orig)),bn=bb(W),d=Math.max(...bo.map((v,i)=>Math.abs(v-bn[i])));worst=Math.max(worst,d);
  console.log(f.id,side,q.name,'roll',q.roll,'orig roll',orig.roll,'| box diff',d.toFixed(5),'| tris',T.length/9,C.structTriangles(orig).length/9);}}
console.log('largest box difference (m):',worst.toFixed(5));
const S=C.computeStats(s),U=C.computeStats(u);console.log('mass example',S.mass,'user design (with structures)',U.mass,'diff',(S.mass-U.mass).toExponential(3),'cost',S.cost,U.cost);const g=C.fitSpec(s.fits.find(f=>f.nozzle==='track'));console.log('gun mass',g.mass,'nozzle',g.nozzleMass,'cost',g.cost,'nozzle',g.nozzleCost);
