const drawAsset=k=>G.turretRenderAsset(C.FITS[k]?.asset||k).asset;
// Legacy black windows now render and aim as physical spherical gunhouses.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const{C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),near=(a,b,e=.001)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
const frames=[{a:2},{a:3},{a:4},{a:5},{a:2,tilt:C.norm([.2,.95,.3])}];
function fixture(frame={},extra={}){const s=C.newShip({assembly:true,L:200,W:150,H:100},'Migrated spherical gun');s.parts=[];s.hatches=[];s.detail=0;s.fits=[C.migrateWeaponFit({id:7,k:'broadsideBattery',p:[100,50,25],ped:0,base:0,low:0,float:false,localMount:true,...frame,...extra})];return s;}

test('every old window draws a real ball with a projecting barrel and selectable geometry on every face',()=>{
 for(const frame of frames){const s=fixture(frame),f=s.fits[0],g=G.meshReferenceFits(s),a=C.REFERENCE_ASSETS[C.fitSpec(f).asset],b=C.fitAABB(f);assert.equal(f.k,'monCal34');assert.equal(g.ni,drawAsset(f.k).faces*3);assert.ok(g.ni>108,'the retired three-box window is gone');assert.equal(G.meshFits(s).ni,0,'native gun is not drawn twice');
  for(let i=0;i<g.n;i++)for(let axis=0;axis<3;axis++)assert.ok(g.pos[i*3+axis]>=b[axis]-.002&&g.pos[i*3+axis]<=b[axis+3]+.002,'selection bounds contain visible geometry');
  const geometry=C.authoredTurretGeometry(f);assert.equal(geometry.muzzles.length,1);const center=geometry.elevationPivot,up=C.fitUp(f),origin=C.add(center,C.mul(up,30));assert.ok(G.rayFit(origin,C.mul(up,-1),f),'the physical ball remains selectable from its mounting hemisphere');
 }
});

test('fleet descriptors use articulated balls and the same physical muzzle as design geometry',()=>{
 for(const frame of frames){const s=fixture(frame,{batteryCaliber:'70TT'}),f=s.fits[0],fleet=G.fleetGeometry(s,{trial:true}),t=fleet.turrets.find(t=>t.id===f.id),g=C.authoredTurretGeometry(f);assert.ok(t);assert.equal(f.k,'monCal80');assert.ok(t.authored);assert.ok(t.mesh||t.bodyMesh);assert.equal(!!t.broadsideBattery,false);assert.equal(t.barrels,1);assert.equal(t.tt,80);assert.equal(t.cycle,1);assert.equal(t.authored.muzzles.length,1);assert.equal(t.cap,true);
  for(let axis=0;axis<3;axis++)near(t.authored.muzzles[0][axis],g.muzzles[0][axis]);
  const aimed=C.aimAuthoredTurret(t.authored,.2,.3);assert.equal(aimed.muzzles.length,1);assert.ok(C.len(C.sub(aimed.muzzles[0],g.muzzles[0]))>.1,'the complete ball and gun can aim away from their saved rest pose');
 }
});
