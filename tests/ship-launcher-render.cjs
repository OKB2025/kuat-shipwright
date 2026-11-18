const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js']){let source=fs.readFileSync(path.join(root,f),'utf8');if(f==='js/gfx.js')source=source.replace('return {meshPreview,','return {launcherReferenceSkin,meshPreview,');vm.runInContext(source,cx,{filename:f});}
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),fit=patch=>({id:1,k:'shipMsl',p:[13,7,-23],a:2,ped:0,base:0,low:0,float:false,...patch});
function vertices(g){return Array.from(g.idx.subarray(0,g.ni)).map(k=>Array.from(g.pos.subarray(k*3,k*3+3)));}
test('ship cells are exactly twice the compact pod size and repeat a bounded open housing',()=>{
 const d=C.fitSpec(fit({})),air=C.FITS.cmsl;assert.deepEqual([d.fm,d.hm,d.wm],[air.fm*2,air.hm*2,air.wm*2]);
 const small=G.meshFits({fits:[fit({})]}),large=G.meshFits({fits:[fit({launcherCols:16,launcherRows:16})]});assert.ok(large.ni>small.ni);assert.ok(large.ni/3<5000,'shared grid walls bound procedural geometry');
});
test('yawed and pitched external housing and supports stay inside the physical selectable bounds',()=>{
 for(const a of [0,2,3,4,5])for(const launchYaw of [-137,0,42])for(const launchPitch of [-65,0,45]){
  const f=fit({a,launchYaw,launchPitch,launcherCols:3,launcherRows:2}),g=G.meshFits({fits:[f]}),b=C.fitAABB(f);for(const p of vertices(g))for(let k=0;k<3;k++)assert.ok(p[k]>=b[k]-5e-5&&p[k]<=b[k+3]+5e-5,JSON.stringify({a,launchYaw,launchPitch,k,p,b}));
 }
});
test('every repeated cell mouth is open in the rendered and picked mesh',()=>{
 for(const launcherEmbedded of [false,true]){const f=fit({launcherCols:3,launcherRows:2,launcherEmbedded}),q=C.launcherGeometry(f);assert.equal(q.muzzles.length,6);for(const muzzle of q.muzzles){const hit=G.rayFit(C.add(muzzle,C.mul(q.axis,.2)),C.mul(q.axis,-1),f);assert.ok(hit,'rear panel is selectable');assert.ok(hit.t>2.3,'no front cap may seal the cell mouth');}}
});

function embedded(){const s=C.newShip({L:100,W:60,H:50,assembly:true},'Embedded launch cells');s.parts=[];s.fits=[];s.armor={hull:0,cit:0};s.nextId=1;s.detail=1;const body=C.placePart(s,'struct',[25,7,12],[30,10,14],{form:'box'},false),r=C.placeFit(s,'shipMsl',[40,7,12],[1,0,0],0,false,{launcherCols:3,launcherRows:2,launcherEmbedded:true,localMount:true,tilt:true});assert.equal(r.err,undefined);assert.equal(r.fit.float,false);return{s,body,f:r.fit};}
function triangles(g){return Float32Array.from(vertices(g).flat());}
test('embedded cells cut the actual structure mesh while mount-seat rays retain the original face',()=>{
 const {s,body,f}=embedded(),g=C.launcherGeometry(f),front=C.add(f.p,C.mul(g.axis,2)),back=C.mul(g.axis,-1),original=C.rayEnv(s,front,back,{structOnly:true}),cut=C.rayEnv(s,front,back,{structOnly:true,launcherCuts:true}),parts=G.meshParts(s,{coded:false}),shown=C.rayTris(triangles(parts.g.struct),front,back);
 assert.ok(original&&original.t<2.01);assert.ok(cut&&cut.t>20,'physical ray passes through the new front aperture');assert.ok(shown&&shown.t>20,'production structure triangles contain the same open front');assert.equal(f.host,body.id);assert.equal(C.missileLauncherSpec(f).blocked,false);
});
test('reference skin clipping preserves source UVs around the same physical opening',()=>{
 const {s,body}=embedded(),data={pos:Float32Array.from([40,0,7,40,14,7,40,14,17,40,0,17]),uv:Float32Array.from([0,0,0,1,1,1,1,0]),idx:Uint32Array.from([0,1,2,0,2,3])},clipped=G.launcherReferenceSkin(s,'p'+body.id,data);
 assert.ok(clipped.idx.length>data.idx.length,'the original triangles split around a hole');for(let i=0;i<clipped.pos.length;i+=3){assert.ok(Math.abs(clipped.uv[i/3*2]-(clipped.pos[i+2]-7)/10)<1e-6);assert.ok(Math.abs(clipped.uv[i/3*2+1]-clipped.pos[i+1]/14)<1e-6);}
 assert.equal(C.rayTris(Float32Array.from(Array.from(clipped.idx).flatMap(k=>Array.from(clipped.pos.subarray(k*3,k*3+3)))),[42,7,12],[-1,0,0]),null,'textured source face is truly open');
});
test('production structure holes move and close after embedding is disabled, inactive, or deleted',()=>{
 const {s,f}=embedded(),axis=C.launcherGeometry(f).axis,point=f.p.slice(),depth=p=>{const g=G.meshParts(s,{coded:false}).g.struct;return C.rayTris(triangles(g),C.add(p,C.mul(axis,2)),C.mul(axis,-1))?.t;};
 assert.ok(depth(point)>20);f.p=C.add(point,[0,4,0]);delete f.local;delete f.localNormal;C.mountFit(s,f);const moved=f.p.slice();assert.equal(f.float,false);assert.ok(depth(point)<2.1,'old hole closes after moving');assert.ok(depth(moved)>20,'new hole opens at the moved fitting');
 f.launcherEmbedded=false;C.normalizeFitMount(f);assert.ok(depth(moved)<2.1,'turning off embedding restores the complete host face');
 f.launcherEmbedded=true;C.mountFit(s,f);assert.ok(depth(moved)>20);f.float=true;assert.ok(depth(moved)<2.1,'inactive fitting cannot leave a functioning aperture');
 f.float=false;s.fits=[];assert.ok(depth(moved)<2.1,'deleting the fitting restores its host face');
});
