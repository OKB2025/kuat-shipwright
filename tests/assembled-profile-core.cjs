const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),plain=x=>JSON.parse(JSON.stringify(x)),near=(a,b,e=.001)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`),vector=(a,b,e)=>a.forEach((v,i)=>near(v,b[i],e));
function fixture(){const s=C.newShip({L:100,W:40,H:20,plan:'rect',sec:'rect'},'Asymmetric assembled profile');s.armor={hull:0,cit:0};s.detail=0;return s;}

test('surface positions and combat modules share the asymmetric physical center',()=>{
 const s=fixture(),p=C.placePart(s,'struct',[140,10,40],[20,10,10],{form:'box'},false);assert.ok(p);
 const f={id:s.nextId++,k:'pd',p:[140,15,40],a:2,ped:0,base:0,low:0,float:false};s.fits.push(f);assert.ok(C.enableSurfaceMode(s).ok);
 const S=C.computeStats(s),profile=C.fleetProfile(S,s.name,s),b=S.bounds,center=[0,1,2].map(i=>(b[i]+b[i+3])/2);assert.ok(center[2]>10,'the geometric center really leaves the original centerline');
 vector(profile.surface.offset,center);const mount=profile.surface.mounts.find(m=>m.id===f.id),module=profile.modules.find(m=>m.fit===f.id);assert.ok(mount&&module);vector(mount.center,f.p.map((v,i)=>v-center[i]));
 near(module.z,Math.max(-1,Math.min(1,(f.p[2]-center[2])/(S.dims[1]/2))),.011);
});

test('physical bounds are recomputed after moving an extension while planned dimensions stay fixed',()=>{
 const s=fixture(),p=C.placePart(s,'struct',[140,10,40],[20,10,10],{form:'box'},false),planned=plain(C.designEnvelope(s));
 const before=C.computeStats(s);vector(before.dims,[150,65,20]);p.c=[220,10,-70];const after=C.computeStats(s);vector(after.dims,[230,95,20]);vector(C.shipDimensions(s),after.dims);assert.deepEqual(plain(C.designEnvelope(s)),planned);
});

test('an editor geometry lock does not retain physical bounds from before a new fitting',()=>{
 const s=fixture();C.hullGeo(s);s._lockedCache=s._cache;const before=C.shipBounds(s);near(before[3],100);
 s.fits.push({id:s.nextId++,k:'pd',p:[150,10,0],a:0,ped:0,base:0,low:0,float:false});const after=C.shipBounds(s),fit=C.fitAABB(s.fits[0]);near(after[3],fit[3]);assert.ok(after[3]>150);near(C.shipDimensions(s)[0],fit[3]);assert.equal(C.isCraft(s),false);delete s._lockedCache;
});

test('real profile11 assembly snapshots refresh stowage and fleet dimensions from the actual model once',()=>{
 const old=JSON.parse(fs.readFileSync(path.join(root,'tests/helpers/design-envelope-profile-v11.json'),'utf8')),before=plain(old);assert.equal(old.profileVersion,11);vector(old.snapshot.dims,[1000,20,105]);
 const current=C.cleanDesignCraft(old.snapshot);assert.ok(current);vector(current.dims,[100,20,10]);near(current.craft.powerProfile.len,100);near(current.craft.powerProfile.width,20);near(current.craft.powerProfile.height,10);assert.equal(current.craft.powerProfile.profileVersion,C.FLEET_PROFILE_VERSION);
 assert.deepEqual(plain(current.blueprint.designEnvelope),{L:1000,W:400,H:200});assert.deepEqual(plain(C.cleanDesignCraft(current)),plain(current));assert.deepEqual(old,before);
});
