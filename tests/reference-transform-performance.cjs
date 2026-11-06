const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});const {C,G}=vm.runInContext('({C:Core,G:Gfx})',context);
const kinds=['utl','stl','ion','pd','quad500','refVen','quad70Side','venSide70','single500','monCal80','monCal150Ion','oct40'];
function fixture(k,i=0){return {id:i+1,k,p:[800.125+i*311,700.25,-134.875+i*13],a:C.FITS[k].wallOnly||C.FITS[k].casemate?5:2,base:0,low:0,ped:0,float:false,assetYaw:37.25,assetPitch:C.isBallTurret(k)?24:0,scale:.85+i*.03,tilt:C.FITS[k].wallOnly||C.FITS[k].casemate?[0,0,-1]:C.norm([.23,1,-.17])};}
function rendered(f){const ship={parts:[],fits:[f],hatches:[]},a=G.meshFits(ship,null,null,[f]),b=G.meshReferenceFits(ship,null,[f]);assert.ok(!a.n||!b.n,'the authored mesh is rendered once');return a.n?a:b;}
function expected(f){const asset=C.REFERENCE_ASSETS[f.skinAsset||C.FITS[f.k].asset],raw=C.decodeReference(f.skinAsset||C.FITS[f.k].asset),pos=new Float32Array(raw.pos.length),normal=new Float32Array(raw.pos.length);
 for(let i=0;i<pos.length;i+=3)pos.set(C.referenceFitPoint(f,Array.from(raw.pos.subarray(i,i+3))),i);
 for(let i=0;i<raw.idx.length;i+=3){const ids=Array.from(raw.idx.subarray(i,i+3)),points=ids.map(k=>Array.from(pos.subarray(k*3,k*3+3))),n=C.cross(C.sub(points[1],points[0]),C.sub(points[2],points[0]));for(const id of ids)for(let a=0;a<3;a++)normal[id*3+a]+=n[a];}
 const packed=new Int8Array(normal.length);for(let i=0;i<normal.length;i+=3){const n=C.norm(Array.from(normal.subarray(i,i+3)));for(let a=0;a<3;a++)packed[i+a]=n[a]*127;}
 if(f.k!=='oct40')for(const part of asset.components||[]){if(part.normalMode==='sphere'){
  const centerN=part.normalCenterM.map((v,k)=>(v-asset.c[k])/asset.size[k]),center=C.referenceFitPoint(f,centerN),up=C.norm(C.sub(C.referenceFitPoint(f,[centerN[0],centerN[1]+1/asset.size[1],centerN[2]]),center)),eps=Math.max(.002,(asset.maxQuantizationErrorM||0)*3);
  for(let i=part.firstVertex;i<part.firstVertex+part.vertices;i++){const v=Array.from(raw.pos.subarray(i*3,i*3+3)),n0=Array.from(packed.subarray(i*3,i*3+3));if(Number.isFinite(part.floorYM)&&Math.abs(v[1]*asset.size[1]+asset.c[1]-part.floorYM)<=eps&&C.dot(n0,up)<-63.5)continue;const n=C.norm(C.sub(C.referenceFitPoint(f,v),center));for(let a=0;a<3;a++)packed[i*3+a]=n[a]*127;}
 }else if(part.normalMode==='ellipsoid'){
  const center=part.normalCenterM,worldCenter=C.referenceFitPoint(f,center.map((v,k)=>(v-asset.c[k])/asset.size[k]));
  for(let i=part.firstVertex;i<part.firstVertex+part.vertices;i++){const gradient=center.map((v,k)=>(raw.pos[i*3+k]*asset.size[k]+asset.c[k]-v)/(part.normalRadiiM[k]**2)),tip=center.map((v,k)=>(v+gradient[k]-asset.c[k])/asset.size[k]),n=C.norm(C.sub(C.referenceFitPoint(f,tip),worldCenter));for(let a=0;a<3;a++)packed[i*3+a]=n[a]*127;}
 }}
 return {asset,raw,pos,nor:packed};
}

test('batched reference transforms preserve every authored vertex, face and curved normal across full poses',()=>{
 for(const [i,k]of kinds.entries())for(const pose of [0,1]){const f=fixture(k,i);if(pose){f.p=[91234.75,-13456.5,45876.125];f.assetYaw=-72.5;f.assetPitch=C.isBallTurret(k)?-8:0;f.scale=1.2;}
  const want=expected(f),mesh=rendered(f);assert.equal(mesh.n,want.asset.n,k+' keeps every authored vertex');assert.equal(mesh.ni,want.raw.idx.length,k+' keeps every authored face');assert.deepEqual(Array.from(mesh.idx.subarray(0,mesh.ni)),Array.from(want.raw.idx),k+' preserves winding and indexing');
  for(let j=0;j<mesh.n*3;j++){const tolerance=Math.max(.000001,Math.abs(want.pos[j])*1.3e-7);assert.ok(Math.abs(mesh.pos[j]-want.pos[j])<=tolerance,k+' vertex '+j);assert.ok(Math.abs(mesh.nor[j]-want.nor[j])<=1,k+' curved/face normal '+j+': '+mesh.nor[j]+' vs '+want.nor[j]);}
 }
});

test('a new720TT fitting resolves its static transform once instead of once per vertex',()=>{
 const f=fixture('utl'),point=C.referenceFitPoint;let calls=0;C.referenceFitPoint=(...args)=>{calls++;return point(...args);};try{const mesh=rendered(f);assert.ok(mesh.n>5000);assert.ok(calls<=8,'only the constant affine basis is resolved for thousands of vertices');}finally{C.referenceFitPoint=point;}
});
