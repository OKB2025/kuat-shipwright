const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance:{now:()=>0}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),plain=x=>JSON.parse(JSON.stringify(x)),near=(a,b,t=3e-4)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
const asset=C.REFERENCE_ASSETS.pd_turret_small,manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/source/pd-turret-manifest.json'),'utf8'));
const fitting=extra=>({id:1,k:'pd',p:[41,12,-17],a:2,ped:0,base:0,low:0,float:false,...extra});
function fixture(f){const ship=C.newShip({L:200,W:100,H:50,assembly:true},'FBX turret');ship.parts=[];ship.fits=[f];ship.hatches=[];return ship;}

test('PD uses the supplied complete FBX with reproducible packed geometry and turntable pivot',()=>{
 assert.equal(C.FITS.pd.asset,'pd_turret_small');assert.equal(asset.plainMetal,true);
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'assets/source/turret-small-1.fbx'))).digest('hex'),manifest.source_sha256);
 const packed=Buffer.from(asset.data,'base64');assert.equal(packed.length,manifest.packed_bytes);assert.equal(crypto.createHash('sha256').update(packed).digest('hex'),manifest.packed_sha256);
 assert.equal(asset.n,25049);assert.equal(asset.faces,29060);assert.deepEqual(plain(asset.mount),[0,0,0]);assert.deepEqual(plain(asset.forward),[1,0,0]);
 const d=C.decodeReference('pd_turret_small');assert.equal(d.idx.length,asset.faces*3);assert.equal(d.pos.length,asset.n*3);
 for(const i of d.idx)assert.ok(i<asset.n);for(const p of d.pos)assert.ok(Number.isFinite(p));
 // The source turntable origin differs from the mesh's bounding-box center.
 const f=fitting(),pivot=asset.c.map((v,i)=>-v/asset.size[i]);C.referenceFitPoint(f,pivot).forEach((v,i)=>near(v,C.fitOrigin(f)[i]));
});

test('PD retains every source triangle, sharp-normal split, and ordinary metal material',()=>{
 const f=fitting(),g=G.meshFits(fixture(f)),d=C.decodeReference(C.FITS.pd.asset);
 assert.equal(g.n,asset.n);assert.equal(g.ni,asset.faces*3);assert.deepEqual(Array.from(g.idx.slice(0,g.ni)),Array.from(d.idx));assert.equal(G.meshReferenceFits(fixture(f)).ni,0);
 let hardEdges=0;const normals=new Map();
 for(let i=0;i<g.n;i++){
  const p=Array.from(g.pos.slice(i*3,i*3+3)),n=Array.from(g.nor.slice(i*3,i*3+3)),k=p.join(',');
  const old=normals.get(k);if(old&&old.some((v,j)=>Math.abs(v-n[j])>20))hardEdges++;else normals.set(k,n);
  assert.deepEqual(Array.from(g.col.slice(i*4,i*4+3)),[195,200,205]);near(g.uv[i*2],.25);near(g.uv[i*2+1],.5);
 }
 assert.ok(hardEdges>100,'sharp faces must not be merged into a rounded low-poly turret');
});

test('legacy PD placements and edited poses render in every mounting frame within their actual bounds',()=>{
 const d=C.decodeReference(C.FITS.pd.asset);
 for(const extra of [...Array.from({length:6},(_,a)=>({a,assetYaw:37})),{a:2,tilt:C.norm([.3,1,.2]),assetYaw:121},{a:4,localMount:true,mountAxis:4,assetYaw:15}]){
  const f=fitting(extra),ship=fixture(f),g=G.meshFits(ship),b=C.fitAABB(f);assert.equal(g.ni,asset.faces*3);
  for(let i=0;i<g.n;i++){const p=C.referenceFitPoint(f,Array.from(d.pos.slice(i*3,i*3+3)));for(let j=0;j<3;j++){near(g.pos[i*3+j],p[j]);assert.ok(g.pos[i*3+j]>=b[j]-3e-4&&g.pos[i*3+j]<=b[j+3]+3e-4);}}
 }
 const f=fitting(),ship=fixture(f),before=G.meshFits(ship).pos[0];f.assetYaw=90;assert.notEqual(G.meshFits(ship).pos[0],before,'cached geometry follows a heading edit');
 const preview=G.meshPreview(ship,[],[f]);assert.equal(preview.previewFits.ni,asset.faces*3);assert.equal(preview.previewRefFits.ni,0);
});

test('trial PD traverse reuses the supplied model with the fitting material and its mounting pivot',()=>{
 const f=fitting(),ship=fixture(f),fleet=G.fleetGeometry(ship,{trial:true}),turret=fleet.turrets.find(t=>t.id===f.id);
 assert.ok(turret);assert.equal(turret.mesh,'tur_'+f.id);assert.equal(fleet.meshes[turret.mesh].tex,'fits');assert.equal(fleet.meshes[turret.mesh].geo.ni,asset.faces*3);assert.equal(fleet.meshes.refFits.geo.ni,0);
 turret.pivot.forEach((v,i)=>near(v,C.fitOrigin(f)[i]));
});
