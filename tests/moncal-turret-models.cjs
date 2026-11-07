const drawAsset=k=>G.turretRenderAsset(C.FITS[k]?.asset||k).asset;
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),kinds=['pd','quad1Rapid',...C.MON_CAL_TURRET_KEYS];
const fitting=(k,id=1,extra={})=>({id,k,p:[100,50,0],a:2,ped:0,base:0,low:0,float:false,...extra});
function ship(fits=[]){const s=C.newShip({assembly:true,L:260,W:200,H:100},'Mon Cal model review');s.parts=[];s.fits=fits;s.detail=0;s.armor={hull:0,cit:0};return s;}
const near=(a,b,eps=.005)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);

test('all eight new authored models use complete native geometry and the shared reference paint',()=>{
 for(const k of kinds){const f=fitting(k),s=ship([f]),d=C.FITS[k],a=C.REFERENCE_ASSETS[d.asset],g=G.meshReferenceFits(s),preview=G.meshPreview(s,[],[f]),fleet=G.fleetGeometry(s,{trial:true}),t=fleet.turrets.find(t=>t.id===f.id);
  assert.equal(C.weaponModelScale(k),1,k+' keeps diagram/model physical dimensions');assert.ok(a.faces>0&&a.faces<=5000);
  assert.equal(g.ni,drawAsset(k).faces*3,k+' draws one complete budgeted mesh');assert.equal(G.meshFits(s).ni,0,k+' has no duplicated procedural body');assert.equal(preview.previewRefFits.ni,g.ni);
  for(const j of new Set(g.idx.slice(0,g.ni))){assert.ok([0,1,2].some(c=>g.nor[j*3+c]!==0),k+' used normal');near(g.uv[j*2],.046142578125,1e-10);near(g.uv[j*2+1],.153564453125,1e-10);assert.deepEqual(Array.from(g.col.slice(j*4,j*4+4)),[143,150,155,255]);}
  assert.ok(t?.authored,k+' aims the actual model');assert.equal(fleet.meshes[t.mesh].geo.ni+(fleet.meshes[t.bodyMesh]?.geo.ni||0),g.ni,k+' moving/fixed partitions conserve geometry');
  if(k.startsWith('monCal')){assert.equal(a.elevationIndexStart,0);near(a.bounds[0][1],-a.sphereRadiusM*2/3);near(a.bounds[1][1],a.sphereRadiusM*4/3);near(a.size[1],a.size[2]);}
 }
 const cis=C.REFERENCE_ASSETS[C.FITS.quad1Rapid.asset],anchor=C.REFERENCE_ASSETS[C.FITS.quad500.asset];for(let j=0;j<3;j++)assert.ok(cis.size[j]>=anchor.size[j],'CIS battery is at least as large as quad500 on every axis');
});

test('every complete gun has an unobstructed physical recessed muzzle at its authored firing origin',()=>{
 for(const k of kinds)for(const pose of [{a:2,assetYaw:27},{a:4,assetYaw:-32,assetPitch:k.startsWith('monCal')?24:0}]){const f=fitting(k,1,pose),a=C.REFERENCE_ASSETS[C.FITS[k].asset],g=C.authoredTurretGeometry(f),world=p=>C.referenceFitPoint(f,p.map((n,j)=>(n-a.c[j])/a.size[j]));assert.equal(g.muzzles.length,C.FITS[k].barrels);
  for(const b of a.barrelCenters){const muzzle=world(b.muzzle),fw=C.norm(C.sub(world(C.add(b.muzzle,[1,0,0])),muzzle)),hit=G.rayFit(C.add(muzzle,C.mul(fw,1)),C.mul(fw,-1),f);assert.ok(hit,k+' bore hit');near(hit.t,1+b.muzzleRecessM,Math.max(.004,a.maxQuantizationErrorM*5));}
 }
});

test('retained surface-assigned Mon Cal, twin PD and CIS batteries expose full models and keep moving guns',()=>{
 for(const k of ['monCalPD','monCal80','monCal150Ion','pd','quad1Rapid']){const s=ship(),body=C.placePart(s,'struct',[100,50,0],[160,120,80],{form:'box'},false),patch=C.surfacePatches(s).find(p=>p.host==='p'+body.id&&p.face==='port');assert.ok(patch);
  // Current surface editing is armor-only. Retained inventory and snapshots
  // still carry surface tags, which must not force these guns into wall ports.
  const f=fitting(k,s.nextId++,{p:patch.center.slice(),a:4,tilt:patch.normal.slice(),surfacePatch:patch.id,surfaceCell:'b0',surfaceRole:'weapons',surfacePoint:patch.center.slice(),surfaceFootprint:[C.FITS[k].fm,C.FITS[k].wm],surfaceDepth:1});s.fits.push(f);
  assert.equal(C.surfaceBatteryGeometry(f),null,k+' no retired wall opening');
  const a=C.REFERENCE_ASSETS[C.FITS[k].asset],g=G.meshReferenceFits(s,null,[f]);assert.equal(g.ni,drawAsset(k).faces*3,k+' complete budgeted model');assert.equal(G.meshFits(s,null,null,[f]).ni,0,k+' no wall port copy');assert.ok(C.authoredTurretGeometry(f),k+' authored surface aim');
  const preview=G.meshPreview(s,[],[f]);assert.equal(preview.previewRefFits.ni,drawAsset(k).faces*3,k+' preview body');const fleet=G.fleetGeometry(s,{trial:true}),t=fleet.turrets.find(t=>t.id===f.id);assert.ok(t?.authored&&t.mesh,k+' surface gun animates');assert.equal(t.embedded,false);assert.equal(fleet.meshes[t.mesh].geo.ni+(fleet.meshes[t.bodyMesh]?.geo.ni||0),drawAsset(k).faces*3,k+' surface moving partition');
 }
});
