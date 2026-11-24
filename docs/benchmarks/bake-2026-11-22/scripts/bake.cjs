// Prototype: bake every cut of an example and compare its figures.
const fs=require('fs'),path=require('path'),zlib=require('zlib');const root=process.cwd();const {C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const k=process.argv[2]||'imperial';const raw=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples',k,'design.json.gz'))));
const prep=s=>{C.syncCompartments(s);C.remount(s,{keepFitPose:true});C.syncCompartments(s);return s;};
const fig=s=>{const S=C.computeStats(s);return {mass:S.mass,area:S.area,volume:S.volume,hullVolume:S.hullVolume,Vhang:S.Vhang,launch:S.launch,openA:S.openA,accel:S.maximumAccelMps2,vuln:S.vuln,warnings:(S.warnings||[]).length,hatches:s.hatches.length,parts:s.parts.length,fits:s.fits.length,guns:s.fits.reduce((n,f)=>n+(f.aggregateCount||1),0)};};
const t0=Date.now();const a=prep(C.deserialize(raw)),A=fig(a);const t1=Date.now();
const b=C.deserialize(raw);C.syncCompartments(b);const targets=C.bakeTargets(b).map(p=>p.id);const r=C.bakeAllCuts(b);prep(b);const B=fig(b);const t2=Date.now();
console.log(k,'targets',targets,'report',JSON.stringify({ok:r.ok,parts:r.parts,batteries:r.batteries,failed:r.failed}),'ms',t1-t0,t2-t1);
for(const key of Object.keys(A)){const x=A[key],y=B[key],d=typeof x==='number'&&x?((y/x-1)*100).toFixed(3)+'%':'';console.log(key.padEnd(12),x,y,d);}
const meshes=b.parts.filter(p=>p.form==='mesh'&&r.parts.includes(p.id)).map(p=>({id:p.id,v:p.mesh.v.length,f:p.mesh.f.length,label:p.label}));console.log('baked',JSON.stringify(meshes));
const o=JSON.parse(JSON.stringify(C.serialize(b)));const c=prep(C.deserialize(o));const Cf=fig(c);console.log('reload mass equal',Math.abs(Cf.mass/B.mass-1)<1e-9,'volume',Math.abs(Cf.volume/B.volume-1)<1e-9,'json KB',(JSON.stringify(o).length/1024).toFixed(0),'before KB',(JSON.stringify(raw).length/1024).toFixed(0));
const SA=C.computeStats(a),SB=C.computeStats(b);const keys=Object.keys(SA).filter(k=>/[Mm]ass/.test(k)&&typeof SA[k]==='number'&&Math.abs((SB[k]||0)-SA[k])>1e-6*Math.abs(SA[k]||1));for(const q of keys)console.log('M',q.padEnd(22),SA[q].toExponential(4),(SB[q]||0).toExponential(4));
for(const q of ['massBy','massParts','massBreakdown'])if(SA[q])console.log(q,JSON.stringify(SA[q]).slice(0,600),'\n=>',JSON.stringify(SB[q]).slice(0,600));
console.log('warn after',JSON.stringify((SB.warnings||[]).map(w=>w.text||w)).slice(0,1200));
{const rows=[];for(const q of Object.keys(SA))if(typeof SA[q]==='number'&&typeof SB[q]==='number'&&SA[q]!==0&&Math.abs(SB[q]/SA[q]-1)>2e-4)rows.push([q,SA[q],SB[q],(SB[q]/SA[q]-1)*100]);rows.sort((a,b)=>Math.abs(b[3])-Math.abs(a[3]));for(const r of rows.slice(0,30))console.log('D',r[0].padEnd(26),(+r[1]).toPrecision(6),(+r[2]).toPrecision(6),r[3].toFixed(3)+'%');}
{const ia=SA.info||{},ib=SB.info||{};const fields=new Set();for(const v of Object.values(ia))for(const [k,x] of Object.entries(v||{}))if(typeof x==='number')fields.add(k);console.log('info fields',[...fields].join(','));
 for(const f of ['mass','m','materialMass','V','vol']){let sa=0,sb=0;for(const id of Object.keys(ia)){sa+=ia[id]?.[f]||0;sb+=ib[id]?.[f]||0;}if(sa||sb)console.log('SUM',f,sa.toExponential(5),sb.toExponential(5));}
 const diffs=[];for(const id of Object.keys(ia)){const x=ia[id]?.materialMass||0,y=ib[id]?.materialMass||0;if(Math.abs(x-y)>1)diffs.push([id,x,y]);}diffs.sort((a,b)=>Math.abs(b[2]-b[1])-Math.abs(a[2]-a[1]));console.log('per part materialMass diffs',JSON.stringify(diffs.slice(0,10)));}
