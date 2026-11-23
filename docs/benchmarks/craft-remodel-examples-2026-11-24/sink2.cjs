// For each converted launch tube of the 2026-11-24 remodels, starting from the design's pylon position (t_<id>.json), tries
// offsets along the mounting normal from -body height to +body height in 1 cm steps and keeps the seated, open-mouthed
// (not float, craftMuzzleBlocked false) position with the least of the tube body outside the craft's solids
// (insideOriginalEnvelope on a 7×7×7 grid of the body box; ties go to the smaller move). Prints JSON.
// 2026-11-24 (fidelity review): a candidate must also stay out of computeStats' ungrounded.floatingFits (the editor's
// 「どこにも取り付いていない装備」 check, which looks below the mounting point); the first search did not, and the Hyena's
// cmsl #31/#32 and the Vulture's ctorp #23/#24 came out floating. Usage: node sink2.cjs OUT.json [id ...]; the plan is
// limited to the ids given. The pylon positions come from the design files (CRAFT_REMODEL with the tube kinds, t_<id>.json).
const fs=require('fs');const {C}=require('/home/user/kuat-shipwright/scripts/update-ship-examples.cjs').loadRuntime('/home/user/kuat-shipwright');
const src=fs.readFileSync('/home/user/kuat-shipwright/data/imperial2.js','utf8');const i=src.indexOf('const CRAFT_REMODEL=');const R=JSON.parse(src.slice(i+'const CRAFT_REMODEL='.length,src.indexOf(';\n',i)));
const allPlan={arc170:[43,68],ywing:[25,26],tie_sa:[22],btlb:[25,26],hyena:[29,30,31,32],vulture:[23,24,25],v19:[27,28],z95:[31,32]},only=process.argv.slice(3),plan=only.length?Object.fromEntries(only.map(k=>[k,allPlan[k]])):allPlan;
const outside=(s,f)=>{const b=C.fitAABB(f),N=6;let o=0,t=0;for(let a=0;a<=N;a++)for(let j=0;j<=N;j++)for(let l=0;l<=N;l++){t++;if(!C.insideOriginalEnvelope(s,[b[0]+(b[3]-b[0])*a/N,b[1]+(b[4]-b[1])*j/N,b[2]+(b[5]-b[2])*l/N]))o++;}return o/t;};
const out={};
for(const [id,fids] of Object.entries(plan)){out[id]={};const T=JSON.parse(fs.readFileSync(process.env.KS_TUBE_DESIGNS+'/t_'+id+'.json','utf8'));
 for(const fid of fids){const f0=T.fits.find(x=>x.id===fid),n=f0.n||[0,1,0],hm=C.FITS[f0.k].hm;let best=null;
  for(let k=-Math.round(hm*100);k<=Math.round(hm*100);k++){const dd=k/100;const r=JSON.parse(JSON.stringify(R[id]));const f=r.fits.find(x=>x.id===fid);f.p=f0.p.map((v,q)=>v-n[q]*dd);
   const s=C.deserialize(r);C.syncCompartments(s);C.remount(s,{keepFitPose:true});const g=s.fits.find(x=>x.id===fid);
   if(g.float||C.craftMuzzleBlocked(s,g))continue;const o=outside(s,g);if(best&&o>best.outside+1e-9)continue;C.syncCompartments(s);const S=C.computeStats(s);if((S.ungrounded?.floatingFits||[]).some(x=>(x.id??x)===fid))continue;if(!best||o<best.outside-1e-9||Math.abs(o-best.outside)<1e-9&&Math.abs(dd)<Math.abs(best.depth))best={p:f.p.map(v=>+v.toFixed(4)),depth:dd,outside:+o.toFixed(3),n};}
  out[id][fid]=best;console.log(id,fid,f0.k,JSON.stringify(best));}}
fs.writeFileSync(process.argv[2],JSON.stringify(out,null,1));
