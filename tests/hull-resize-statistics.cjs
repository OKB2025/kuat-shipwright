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
  for(const k of ['volume','hullVolume','area','mass','critExpo','vuln','cost','engineVolume','hyperEffectiveVolume'])near(W[k],F[k],1e-9,key+' '+k);}
});

test('a resize at which a bevel or trench would leave the loader range is refused and changes nothing',()=>{
 const cases=[['frigate',[2,1,1],null],['frigate',[1,1,.02],/面取り/],['destroyer',[1,17,1],/面取り/]];
 for(const [key,f,re] of cases){const s=C.buildDesign(key),h=C.primaryHullPart(s),size=[h.s[0]*f[0],h.s[1]*f[1],h.s[2]*f[2]],before=C.publicJSON(s),err=C.hullStructureResizeError(s,h,size);
  if(!re){assert.equal(err,null,key);continue;}assert.match(err,re,key);assert.throws(()=>C.setHullStructureDimensions(s,h,size),re);assert.equal(C.publicJSON(s),before,key+' unchanged');}
 const s=C.buildDesign('frigate'),h=C.primaryHullPart(s);h.hullData.trenches.push({id:990,side:'both',from:.3,to:.6,level:.5,height:300,depth:20,taper:false,chine:true});
 const size=[h.s[0],h.s[1],h.s[2]*2],before=C.publicJSON(s);assert.match(C.hullStructureResizeError(s,h,size),/トレンチ/);assert.throws(()=>C.setHullStructureDimensions(s,h,size),/トレンチ/);assert.equal(C.publicJSON(s),before);
});
test('the editor resize shows the refusal instead of changing the hull',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),app=fs.readFileSync(path.join(__dirname,'..','js/app.js'),'utf8'),m=/function setHullDims\s*\(/.exec(app);let src='';for(let end=app.indexOf('}',m.index);end>=0;end=app.indexOf('}',end+1)){src=app.slice(m.index,end+1);try{new vm.Script(src);break;}catch{}}
 const ship=C.buildDesign('frigate'),part=C.primaryHullPart(ship),notices=[],ctx=vm.createContext({C,ship,notices,toast:t=>notices.push(t),T:x=>x,hullEditorProfile:()=>part.hullProfile,hullEditorPart:()=>part,scaleContents:()=>{},st:{}});vm.runInContext(src,ctx);
 const before=C.publicJSON(ship),res=vm.runInContext(`setHullDims(${part.s[0]},6300,${part.s[2]})`,ctx);
 assert.match(res,/面取り/);assert.match(notices[0],/面取り/);assert.equal(C.publicJSON(ship),before);
});

test('Imperial-class: after a resize the reused object matches a fresh copy in every compartment figure (about 2 min)',()=>{
 // The compartments of the reused object kept their envelope from the previous statistics pass (its surface working
 // copy), so packing after the resize differed slightly from a reload (critExpo -3.5 %, engine volume +8.4 m³).
 const fs=require('node:fs'),zlib=require('node:zlib'),raw=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples/imperial/design.json.gz'))));
 const w=JSON.parse(C.publicJSON(C.deserialize(raw)));C.syncCompartments(w);C.remount(w);C.syncCompartments(w);C.computeStats(w);
 C.setHullStructureDimensions(w,C.primaryHullPart(w),[2200,1183.6,268]);const f=JSON.parse(C.publicJSON(w));
 for(const x of [w,f]){C.syncCompartments(x);C.remount(x);C.syncCompartments(x);}
 const W=C.computeStats(w),F=C.computeStats(f);for(const k of ['volume','area','mass','critExpo','vuln','cost','engineVolume','hyperEffectiveVolume'])near(W[k],F[k],1e-9,'imperial '+k);
});
