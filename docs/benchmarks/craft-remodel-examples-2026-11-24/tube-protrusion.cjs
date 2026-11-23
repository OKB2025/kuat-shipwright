// How much of each store fitting's body lies outside the craft's solids (tube or pylon), per remodel example.
// usage: node docs/benchmarks/craft-remodel-examples-2026-11-24/tube-protrusion.cjs [root]
const path=require('path'),fs=require('fs'),zlib=require('zlib');const root=process.argv[2]||process.cwd();const {C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
for(const k of ['craft_arc170','craft_btlb','craft_tie_sa','craft_hyena','craft_vulture','craft_v19','craft_z95','craft_ywing']){
 const s=C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples',k,'design.json.gz')))));C.syncCompartments(s);C.remount(s,{keepFitPose:true});C.syncCompartments(s);
 for(const f of s.fits.filter(f=>C.FITS[f.k]?.store)){const b=C.fitAABB(f),N=8;let out=0,tot=0;const up=C.fitUp(f)||[0,1,0];let reach=0;
  for(let i=0;i<=N;i++)for(let j=0;j<=N;j++)for(let l=0;l<=N;l++){const q=[b[0]+(b[3]-b[0])*i/N,b[1]+(b[4]-b[1])*j/N,b[2]+(b[5]-b[2])*l/N];tot++;if(!C.insideOriginalEnvelope(s,q)){out++;const d=(q[0]-f.p[0])*up[0]+(q[1]-f.p[1])*up[1]+(q[2]-f.p[2])*up[2];if(d>reach)reach=d;}}
  const d=C.fitSpec(f);console.log(k,f.k,'#'+f.id,'body',[d.fm,d.wm,d.hm].join('×'),'m; outside the solids',(100*out/tot).toFixed(0)+'%','; reaches',reach.toFixed(2),'m out along its mounting normal; autoSink',(f._autoSink||0).toFixed(3));}}
