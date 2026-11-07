#!/usr/bin/env node
// Small renderer-only PD comparison. Does not build ships or calculate stats.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),sha=v=>crypto.createHash('sha256').update(v).digest('hex'),baselineCommit='c657a2e8caf4b60d9a5ceda0f8382710c986f690',files=['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'],inputs=Object.fromEntries(files.map(f=>[f,fs.readFileSync(path.join(root,f))]));
const before=execFileSync('git',['show',baselineCommit+':js/gfx.js'],{cwd:root}),after=fs.readFileSync(path.join(root,'js/gfx.js'));
assert.equal(sha(before),'700cd51ead1815a05cca8a372540c0511171c72530fb9fd04478b3104f64d3cd');
function measure(code){
 const cx=vm.createContext({console,performance});for(const f of files)vm.runInContext(inputs[f].toString(),cx,{filename:f});vm.runInContext(code.toString(),cx,{filename:'js/gfx.js'});const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),rows=[];
 for(const kind of ['pd','monCalPD']){const id=C.FITS[kind].asset,asset=C.REFERENCE_ASSETS[id],decoded=C.decodeReference(id),original=sha(JSON.stringify(asset)),hashes=[decoded.pos,decoded.uv,decoded.idx].map(a=>sha(Buffer.from(a.buffer,a.byteOffset,a.byteLength))),f={id:1,k:kind,p:[0,0,0],a:2,ped:0,base:0,low:0,float:false,assetYaw:0},r=G.turretRenderAsset(id),g=G.meshReferenceFits({fits:[f]});let activeBytes=0;
  for(const [key,width]of [['pos',3],['nor',3],['uv',2],['col',4],['idx',1]])activeBytes+=(key==='idx'?g.ni:g.n*width)*g[key].BYTES_PER_ELEMENT;
  rows.push({kind,asset:id,triangles:g.ni/3,vertices:g.n,activeBytes,barrels:asset.barrelCenters.length,sourceTriangles:asset.faces,sourceVertices:asset.n,drawFixedTriangles:r.asset.elevationIndexStart/3,closedMuzzleRecessesM:Array.from(asset.barrelCenters,b=>b.muzzleRecessM),cached:G.turretRenderAsset(id)===r});
  assert.equal(sha(JSON.stringify(asset)),original);assert.deepEqual([decoded.pos,decoded.uv,decoded.idx].map(a=>sha(Buffer.from(a.buffer,a.byteOffset,a.byteLength))),hashes);
 }return rows;
}
const previous=measure(before),current=measure(after),rows=current.map((row,i)=>{const old=previous[i];assert.equal(row.kind,old.kind);assert.equal(row.barrels,old.barrels);assert.deepEqual(row.closedMuzzleRecessesM,old.closedMuzzleRecessesM);assert.ok(row.triangles<200);assert.ok(row.triangles<old.triangles);return {kind:row.kind,before:old,after:row,triangleReductionFraction:1-row.triangles/old.triangles,activeBufferReductionFraction:1-row.activeBytes/old.activeBytes};});
for(const f of files)assert.equal(sha(fs.readFileSync(path.join(root,f))),sha(inputs[f]),f+' changed during measurement');assert.equal(sha(fs.readFileSync(path.join(root,'js/gfx.js'))),sha(after));
const report={schemaVersion:1,status:'PASS',measuredAt:new Date().toISOString(),scope:'Actual production Gfx PD meshes only; triangle, vertex and active GPU-buffer counts. No ship build, engineering calculation, timings or FPS claims.',baseline:{commit:baselineCommit,gfxSha256:sha(before)},sourceSha256:{...Object.fromEntries(files.map(f=>[f,sha(inputs[f])])),'js/gfx.js':sha(after)},harness:{path:'scripts/benchmark-point-defense.cjs',sha256:sha(fs.readFileSync(__filename))},sourceModelsUnchanged:true,rows};
const output=path.join(root,'docs/benchmarks/point-defense-minimum-render.json');fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,rows}));
