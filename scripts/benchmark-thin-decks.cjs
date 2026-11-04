const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),{performance}=require('perf_hooks');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..')),out=process.argv[3]&&path.resolve(process.argv[3]);
const files=['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'],source={},cx=vm.createContext({console,performance}),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const t=performance.now();for(const f of files){const text=fs.readFileSync(path.join(root,f),'utf8');source[f]=hash(text);vm.runInContext(text,cx,{filename:f});}const loadMs=performance.now()-t;vm.runInContext('('+makeFixture.toString()+'); globalThis.makeFixture='+makeFixture.toString(),cx);
const results=[];for(const kind of (process.argv[4]?[process.argv[4]]:['box','wedge','stacked','terraces'])){
 const fixtureStart=performance.now(),s=vm.runInContext('makeFixture('+JSON.stringify(kind)+')',cx),C=vm.runInContext('Core',cx),G=vm.runInContext('Gfx',cx),fixtureMs=performance.now()-fixtureStart,publicJSON=C.publicJSON(s),serialized=C.serialize(s);
 const samples=[];let last;
 for(let i=0;i<3;i++){
  const d=C.deserialize(JSON.parse(JSON.stringify(serialized))),loadedBefore=C.publicJSON(d),start=performance.now(),geometry=G.fleetGeometry(d,{center:[0,0,0]}),elapsed=performance.now()-start;
  const meshes=Object.fromEntries(Object.entries(geometry.meshes).filter(([k,m])=>m.geo.ni&&k!=='trialTarget').map(([k,m])=>[k,{vertices:m.geo.n,triangles:m.geo.ni/3,bytes:m.geo.n*(3*m.geo.pos.BYTES_PER_ELEMENT+3*m.geo.nor.BYTES_PER_ELEMENT+2*m.geo.uv.BYTES_PER_ELEMENT+4*m.geo.col.BYTES_PER_ELEMENT)+m.geo.ni*m.geo.idx.BYTES_PER_ELEMENT}]));
  const layers=G.surfaceVisualPlan(d),projectionCounts={};for(const q of layers.flatMap(r=>r.projections||[]))projectionCounts[q.kind]=(projectionCounts[q.kind]||0)+1;
  last={meshes,projectionCounts,totalTriangles:Object.values(meshes).reduce((n,m)=>n+m.triangles,0),totalMeshBytes:Object.values(meshes).reduce((n,m)=>n+m.bytes,0),equipmentFaces:layers.filter(q=>q.config.functionMode==='equipment').length,parts:d.parts.length,fits:d.fits.length,functional:{mass:C.computeStats(d).mass,cost:C.computeStats(d).cost},fixtureStable:C.publicJSON(d)===loadedBefore};samples.push(elapsed);
 }
 const result={kind,fixtureSHA256:hash(publicJSON),fixtureMs,geometryMs:samples,geometryMedianMs:samples.slice().sort((a,b)=>a-b)[1],...last};results.push(result);console.log(JSON.stringify(result));
}
const result={sourceRoot:root,sourcesSHA256:source,node:process.version,loadMs,results,notes:['Three fresh-deserialized geometry builds per fixture in one process; warmed JIT and shared container load can affect timings.','No GPU throughput, frame-rate or full-app startup measurement.','Meshes count used vertex and index ranges, not spare capacity.']};if(out)fs.writeFileSync(out,JSON.stringify(result,null,2));else console.log(JSON.stringify(result,null,2));

function makeFixture(kind) {
 const C=Core;
 const s=C.newShip({L:500,W:250,H:240,assembly:true},'Thin deck QA '+kind);
 s.parts=[];s.fits=[];s.armor={hull:0,cit:0};s.detail=1;
 let wanted;
 if(kind==='box'){
  const p=C.placePart(s,'struct',[200,90,0],[240,80,100],{form:'box'},false);p.paint='#b0b0b0';
  wanted=C.surfacePatches(s).filter(q=>q.host==='p'+p.id&&['port','top'].includes(q.face)&&q.exposed);
 } else if(kind==='wedge'){
  const p=C.placePart(s,'struct',[200,90,0],[240,100,130],{form:'wedge',skin:'plain'},false);p.paint='#b0b0b0';
  const n=C.norm(C.sub(C.worldStruct(p,[100,240,0]),p.c));
  wanted=C.surfacePatches(s).filter(q=>q.host==='p'+p.id&&(C.dot(q.normal,n)>.999||q.face==='port')&&q.exposed);
 } else if(kind==='terraces'){
  for(const [c,z] of [ [[220,50,0],[400,200,55]], [[185,91,0],[280,160,27]], [[160,117,0],[220,125,25]], [[130,141.5,0],[165,95,24]], [[100,166.5,0],[110,68,26]], [[80,192.5,0],[150,90,26]] ]){const p=C.placePart(s,'struct',c,z,{form:'box',skin:'plain'},false);p.paint='#b0b0b0';}
  wanted=C.surfacePatches(s).filter(q=>q.host!=='hull'&&['port','stbd','top'].includes(q.face)&&q.exposed);
 } else if(kind==='stacked'){
  for(const [c,z,form] of [ [[220,50,0],[400,55,200],'wedge'], [[185,91,0],[280,27,160],'box'], [[160,119,0],[220,25,125],'box'], [[130,146,0],[165,24,95],'box'], [[100,173,0],[110,26,68],'box'], [[80,201,0],[150,26,90],'box'] ]){const p=C.placePart(s,'struct',c,z,{form,skin:'plain'},false);p.paint='#b0b0b0';}
  wanted=C.surfacePatches(s).filter(q=>q.host!=='hull'&&['port','stbd','top'].includes(q.face)&&q.exposed);
 } else throw Error(kind);
 if(!wanted.length)throw Error('No fixture faces '+kind);
 const applied=C.setSurfaceConfig(s,wanted.map(q=>q.id),{functionMode:'equipment',allocation:{cooling:40,sensors:30,habitation:30},equipment:{kind:'hdis',depth:1,limit:0},battery:{count:0},style:{kind:'machinery',depth:4,density:.25,seed:37}});
 if(!applied.ok)throw Error(applied.why);
 return s;
}
