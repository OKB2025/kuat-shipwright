// 2026-11-11 Resizing a hull part: bevels keep their shape (docs/hull-part-scaling-v24.md) and the statistics of the
// object the Worker keeps equal those of a fresh copy (STRUCTURAL_PREFIX reused the old hull's union checkpoint).
const path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(root);
const near=(a,b,t,msg)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${msg}: ${a} != ${b}`);
const volume=T=>{let v=0;for(let i=0;i<T.length;i+=9)v+=(T[i]*(T[i+4]*T[i+8]-T[i+5]*T[i+7])-T[i+1]*(T[i+3]*T[i+8]-T[i+5]*T[i+6])+T[i+2]*(T[i+3]*T[i+7]-T[i+4]*T[i+6]))/6;return v;};

test('doubling a hull with a metre bevel (frigate) or a proportional bevel (destroyer) multiplies its volume by 8',()=>{
 for(const [key,prop] of [['frigate',false],['destroyer',true]]){const s=C.buildDesign(key),h=C.primaryHullPart(s),c0=JSON.parse(JSON.stringify(h.hullData.cuts[0])),v0=volume(C.hullStructureGeometry(s,h).tris);
  assert.equal(!!c0.prop,prop,key);C.setHullStructureDimensions(s,h,h.s.map(v=>v*2));const c=h.hullData.cuts[0];
  near(c.inset,c0.inset*2,1e-12,key+' inset');near(c.slope,c0.slope*2,1e-12,key+' slope');assert.equal(c.prop,c0.prop);
  near(volume(C.hullStructureGeometry(s,h).tris)/v0,8,1e-6,key+' hull volume ratio');}
});

test('after a resize the statistics of the reused object equal those of a fresh copy',()=>{
 for(const key of ['frigate','destroyer']){const w=JSON.parse(C.publicJSON(C.buildDesign(key)));C.syncCompartments(w);C.computeStats(w);
  const h=C.primaryHullPart(w);C.setHullStructureDimensions(w,h,h.s.map(v=>v*1.5));C.syncCompartments(w);
  const f=JSON.parse(C.publicJSON(w));C.syncCompartments(f);const W=C.computeStats(w),F=C.computeStats(f);
  for(const k of ['volume','hullVolume','area','mass'])near(W[k],F[k],1e-9,key+' '+k);}
});
