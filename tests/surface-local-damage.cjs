const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});const C=vm.runInContext('Core',cx);
function fixture(){const s=C.newShip({L:240,W:120,H:60,plan:'rect',sec:'rect'},'Point damage');s.parts=[{id:1,k:'gen',c:[100,20,0],d:10}];s.fits=[];s.nextId=2;C.enableSurfaceMode(s,true);return s;}
function unit(s){const S=C.computeStats(s),p=C.fleetProfile(S,s.name,s),u=C.fleetUnit('surface','surface',p,0);u.pos=[0,0,0];u.yaw=0;return u;}
const ctx={time:1,rand:()=>.99,ev(){},out(){},sunk(){}};

test('uneven adjacent patches resolve the containing triangle rather than the closest patch centre',()=>{
 const s=fixture(),p=C.surfacePatches(s).find(p=>p.host==='hull'&&p.face==='top'&&p.id.split(':')[2]==='0'),split=C.surfaceSplit(s,p.id,'u',.1);assert.equal(split.ok,true);C.setSurfaceConfig(s,split.ids[0],{armor:{thickness:8}});C.setSurfaceConfig(s,split.ids[1],{armor:{thickness:0}});const u=unit(s),big=u.p.surface.patches.find(p=>p.id===split.ids[1]),small=u.p.surface.patches.find(p=>p.id===split.ids[0]),boundary=big.polygon.reduce((a,p)=>p[0]<a[0]?p:a,big.polygon[0]),point=[boundary[0]+.02,big.center[1],big.center[2]];
 assert.ok(C.len(C.sub(point,small.center))<C.len(C.sub(point,big.center)),'fixture must defeat centre-nearest matching');assert.equal(C.surfacePatchAt(u,point).id,big.id);assert.equal(C.surfaceHit(ctx,u,point,10),10,'zero-armour patch passes all energy');assert.equal(u.surfaceLastHit.patch,big.id);assert.equal(u.surfaceLastHit.handled,true);
});

test('a surface turret is damaged before its thick backing armour and adjacent mounts remain healthy',()=>{
 const s=fixture(),p=C.surfacePatches(s).find(p=>p.host==='hull'&&p.face==='top'&&p.id.split(':')[2]==='0');C.setSurfaceConfig(s,p.id,{armor:{thickness:8},battery:{weapon:'ltl',count:2,spacing:12}});const u=unit(s),cells=u.p.surface.mounts.filter(m=>m.patch===p.id);assert.equal(cells.length,2);const before=u.mods[cells[1].module],m=u.p.modules[cells[0].module],hp=Math.max(1,m.hits*C.modQ(m,Math.max(1,u.p.hp*C.COMBAT.quantum)));
 // Exercise the actual floating-point exhaustion boundary after partial damage,
 // including the browser-reported health. It must trigger physical destruction.
 const candidates=[.9987624651044931,...Array.from({length:4096},(_,i)=>(i+1)/4099)],health=candidates.find(h=>h-(h*hp)/hp>0);assert.ok(health>0,'fixture exposes a positive arithmetic residual');u.mods[cells[0].module]=health;C.surfaceHit(ctx,u,cells[0].center,health*hp);assert.equal(u.mods[cells[0].module],0);assert.equal(u.mods[cells[1].module],before);assert.ok(u.surfaceLastHit.remaining>=0);const row=C.surfaceBatteryStatus(u).rows.find(r=>r.id===p.id);assert.equal(row.surviving,1);assert.ok(row.cells.find(c=>c.id===cells[0].id).state==='破壊');
});

test('the shared armour load step conserves load plus penetration and zero thickness adds no buffer',()=>{
 const state={load:0,integrity:1};let r=C.armorLayerStep(state,100,70,0);assert.equal(r.penetrated,0);assert.equal(state.load,70);r=C.armorLayerStep(state,100,50,0);assert.equal(r.penetrated,20);assert.equal(state.load,100);assert.ok(state.integrity<1);const zero={load:0,integrity:1};assert.equal(C.armorLayerStep(zero,0,23,0).penetrated,23);assert.equal(zero.load,0);
});

test('a world-space ray retains actual designed surface collision geometry for local hits',()=>{
 const s=fixture(),u=unit(s),point=C.surfaceRayHit(u,[-400,200,0],[0,0,0]);assert.ok(point&&point.every(Number.isFinite));const patch=C.surfacePatchAt(u,point);assert.ok(patch?.exposed);assert.ok(Math.abs(C.len(C.sub(point,[0,0,0])))>1);
});
