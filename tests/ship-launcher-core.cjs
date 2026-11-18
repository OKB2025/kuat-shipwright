const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx),plain=v=>JSON.parse(JSON.stringify(v)),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function fixture(depth=20){const s=C.newShip({L:100,W:60,H:depth,assembly:true},'Ship launcher core');s.parts=[];s.fits=[];s.nextId=1;s.armor={hull:0,cit:0};const host=C.placePart(s,'struct',[50,depth/2,0],[90,60,depth],{form:'box'},false);return{s,host};}
function placed(s,options={},z=0){const r=C.placeFit(s,'shipMsl',[50,s.hull.H,z],[0,1,0],0,false,options);assert.ok(!r.err,r.err);return r.fit;}

test('grid dimensions, volley, physical mass/cost and magazine grow with real cell count',()=>{
 const air=C.FITS.cmsl,one=C.fitSpec({k:'shipMsl'}),f={k:'shipMsl',p:[0,0,0],a:2,launcherCols:3,launcherRows:2},d=C.fitSpec(f),g=C.launcherGeometry(f),m=C.missileLauncherSpec(f);
 // 2026-11-11 user decision: a cell holds the craft missile (0.5 × 5 m): 12 × 2.25 × 2.25 m, six rounds.
 assert.deepEqual([one.fm,one.hm,one.wm],[12,2.25,2.25]);assert.equal(C.storeCapacity(one.store,'cmsl'),6);assert.ok(air.fm<one.fm);near(d.fm,12);near(d.wm,6.75);near(d.hm,4.5);near(d.mass,one.mass*6);near(d.cost,one.cost*6);near(d.power,one.power*6);near(d.msl,C.ORDNANCE.cmsl.tt*6);assert.equal(d.store.slots,36);near(m.tt,C.ORDNANCE.cmsl.tt);near(m.volleyTT,C.ORDNANCE.cmsl.tt*6);assert.equal(m.salvo,6);assert.equal(m.ammo,36);assert.equal(m.ammoPerCell,6);assert.equal(m.cycle,1.2);assert.equal(g.muzzles.length,6);assert.equal(new Set(g.muzzles.map(p=>p.join(','))).size,6);assert.equal(m.range,60000);
 assert.equal(C.canonicalWeaponKind('shipMsl'),'shipMsl');assert.equal(C.canonicalWeaponKind('msl'),'cmsl');assert.equal(C.FITS.msl,C.FITS.cmsl);assert.equal(C.missileLauncherSpec({k:'cmsl',p:[0,0,0],a:2}).range,10000);
});

test('grid normalization bounds physical arrays and persistence rejects nonfinite pose values',()=>{
 const q=C.shipLauncherConfig({launcherCols:999,launcherRows:-5,launchYaw:999,launchPitch:-999,launcherEmbedded:true});assert.deepEqual(plain(q),{cols:16,rows:1,cells:16,embedded:true,yaw:180,pitch:-90});
 const {s}=fixture(),f=placed(s,{launcherCols:2,launcherRows:3,launchYaw:37,launchPitch:25});const loaded=C.deserialize(C.serialize(s)).fits[0];assert.equal(loaded.k,'shipMsl');assert.deepEqual(plain(C.shipLauncherConfig(loaded)),plain(C.shipLauncherConfig(f)));assert.deepEqual(plain(C.launcherGeometry(loaded).muzzles),plain(C.launcherGeometry(f).muzzles));
});

test('embedded cells reserve their real body inside a structure and carve the same physical opening',()=>{
 const {s,host}=fixture(),f=placed(s,{launcherCols:3,launcherRows:2,launcherEmbedded:true}),g=C.launcherGeometry(f);assert.equal(f.host,host.id);assert.equal(f.float,false);assert.equal(f.launcherBlocked,false);assert.equal(g.embedded,true);near(g.origin[1],20.02);assert.ok(g.bodyCenter[1]<20);
 C.syncCompartments(s);const [cell]=C.missileCells(s);near(C.partVolume(cell),12*4.5*6.75);near(cell.requiredVolume,12*4.5*6.75);assert.equal(cell.weaponId,f.id);
 const raw=C.structTriangles(host),cut=C.launcherRecessTriangles(s,host.id,raw),inside=C.add(g.bodyCenter,C.mul(g.axis,.1));assert.ok(C.rayTris(raw,inside,g.axis,10),'unmodified structure contains the wall');assert.equal(C.rayTris(cut,inside,g.axis,10),null,'the front wall is really absent');assert.equal(C.rayEnv(s,inside,g.axis,{maxT:10,structOnly:true,launcherCuts:true}),null,'obstruction rays share the opening');
 f.launcherCols=4;C.mountFit(s,f);C.syncCompartments(s);near(C.missileCells(s)[0].requiredVolume,12*4.5*9);
});

test('embedded host links and physical angles survive reload and follow a moved host',()=>{
 const {s,host}=fixture(),f=placed(s,{launcherCols:2,launcherRows:2,launcherEmbedded:true,launchYaw:12,launchPitch:8}),saved=C.deserialize(C.serialize(s));C.remount(saved);const q=saved.fits[0];assert.equal(q.float,false);assert.equal(q.host,host.id);assert.deepEqual(plain(C.shipLauncherConfig(q)),plain(C.shipLauncherConfig(f)));
 const h=saved.parts.find(p=>p.id===q.host),old=q.p.slice();h.c[0]+=7;C.mountFit(saved,q);near(q.p[0],old[0]+7);assert.equal(q.float,false);
 const mirrored=C.assemblyMirrorFit(q);near(mirrored.launchYaw,-q.launchYaw);assert.equal(mirrored.launcherCols,2);assert.equal(mirrored.launcherRows,2);
});

test('a launcher cannot embed a full-depth magazine through a thin wall or fire inward',()=>{
 const thin=fixture(1),bad=C.placeFit(thin.s,'shipMsl',[50,1,0],[0,1,0],0,false,{launcherEmbedded:true});assert.ok(bad.err);assert.equal(thin.s.fits.length,0);
 const {s}=fixture(),inward=C.placeFit(s,'shipMsl',[50,20,0],[0,1,0],0,false,{launcherEmbedded:true,launchYaw:180});assert.ok(inward.err);assert.equal(s.fits.length,0);
});

test('full module metadata and electronic fixed load follow every physical cell',()=>{
 const {s}=fixture(),f=placed(s,{launcherCols:3,launcherRows:2,launcherEmbedded:true}),S=C.computeStats(s),p=C.fleetProfile(S,s.name,s),m=p.modules.find(m=>m.fit===f.id),spec=C.missileLauncherSpec(f);
 assert.equal(m.missileKind,'shipMsl');assert.equal(m.launcherCells,6);assert.equal(m.stock,36);assert.equal(m.salvo,6);near(m.tt,C.ORDNANCE.cmsl.tt);assert.equal(m.missileRange,60000);assert.equal(m.launchMuzzles.length,6);assert.equal(m.launchBlocked,false);near(m.launchPowerW,6*C.FITS.shipMsl.power);near(p.grid.fixedLoads.find(l=>l.port===m.port).weight,6*C.FITS.shipMsl.power);
 const center=C.sub(spec.origin,m.muzzle);m.launchMuzzles.forEach((q,i)=>q.forEach((v,k)=>near(v+center[k],spec.muzzles[i][k])));
});

test('new stock ships convert compact concussion choices before placement while saved player fittings stay compact',()=>{
 const build=()=>{const {s}=fixture();const r=C.placeFit(s,'cmsl',[50,20,0],[0,1,0],0,false);assert.ok(!r.err,r.err);return s;};
 C.registerShipExample({key:'ship_launcher_probe',name:'Stock launcher probe',side:'test',length:100,build});const stock=C.buildDesign('ship_launcher_probe');assert.equal(stock.fits[0].k,'shipMsl');near(C.fitSpec(stock.fits[0]).fm,12);
 const player=build();assert.equal(player.fits[0].k,'cmsl');const loaded=C.deserialize(C.serialize(player));C.remount(loaded);assert.equal(loaded.fits[0].k,'cmsl');near(C.fitSpec(loaded.fits[0]).fm,1.2);
 const direct=C.SHIP_EXAMPLES.ship_launcher_probe.build();assert.equal(direct.fits[0].k,'shipMsl','the registered stock factory also converts before engineering');
});

test('moving, resizing, disabling and deleting an embedded launcher invalidate its hole and render signatures',()=>{
 const {s,host}=fixture(),f=placed(s,{launcherEmbedded:true}),raw=C.structTriangles(host),first=C.surfaceRenderKey(s),at=[50,19,0],up=[0,1,0];
 assert.equal(C.rayTris(C.launcherRecessTriangles(s,host.id,raw),at,up,2),null);
 f.p[0]+=10;C.mountFit(s,f);near(f.p[0],60);assert.ok(C.rayTris(C.launcherRecessTriangles(s,host.id,raw),at,up,2),'the old aperture closes after moving');assert.equal(C.rayTris(C.launcherRecessTriangles(s,host.id,raw),[60,19,0],up,2),null);assert.notEqual(C.surfaceRenderKey(s),first);
 const moved=C.surfaceRenderKey(s);f.launcherRows=3;C.mountFit(s,f);assert.notEqual(C.surfaceRenderKey(s),moved);const wider=C.surfaceRenderKey(s);f.launchYaw=18;C.mountFit(s,f);assert.notEqual(C.surfaceRenderKey(s),wider);
 f.launcherEmbedded=false;C.mountFit(s,f);assert.ok(C.rayTris(C.launcherRecessTriangles(s,host.id,raw),[60,19,0],up,2),'disabling embedding closes the opening');
 f.launcherEmbedded=true;f.launchYaw=0;f.launchPitch=0;C.mountFit(s,f);assert.equal(C.rayTris(C.launcherRecessTriangles(s,host.id,raw),[60,19,0],up,2),null);C.removeItem(s,'fits',f.id,false);assert.ok(C.rayTris(C.launcherRecessTriangles(s,host.id,raw),[60,19,0],up,2),'deleting the launcher restores the skin');
});

test('mirrored embedded fitting binds to the mirrored structure, never the original host',()=>{
 const {s}=fixture();s.parts=[];s.nextId=1;const host=C.placePart(s,'struct',[50,10,18],[40,20,20],{form:'box'},true),r=C.placeFit(s,'shipMsl',[50,20,18],[0,1,0],0,true,{launcherCols:2,launcherRows:2,launcherEmbedded:true,launchYaw:17});assert.ok(!r.err,r.err);assert.equal(s.fits.length,2);
 const a=s.fits.find(f=>f.p[2]>0),b=s.fits.find(f=>f.p[2]<0);assert.equal(a.host,host.id);assert.equal(b.host,host.tw);near(b.launchYaw,-a.launchYaw);assert.notEqual(a.host,b.host);assert.equal(a.float,false);assert.equal(b.float,false);
});

test('an unsupported external angle stops real firing without spending any cell ammunition',()=>{
 const {s}=fixture(),f=placed(s,{launcherCols:2,launchPitch:-45});assert.equal(f.float,false);assert.equal(f.launcherBlocked,true);const S=C.computeStats(s),p=C.fleetProfile(S,s.name,s),m=p.modules.find(m=>m.fit===f.id);assert.equal(m.launchBlocked,true);
 const profile={...p,heat:null,modules:[{k:'reactor',part:99,port:'p99',domain:'main',size:1,share:1},{...m,domain:'main',powerConnected:true}],grid:{P:1e20,Pgen:1e20,Paux:0,fixed:m.launchPowerW,cooling:0,De:0,Ds:0,Dw:0,fixedLoads:[{id:m.port,port:m.port,domain:'main',weight:m.launchPowerW}]}};
 const u=C.fleetUnit('blocked','blocked',profile,0);C.allocateShipPower(u,C.fleetSystems(u),{throttle:0,weapons:0,shields:0},0,'balanced');assert.ok(u.propulsion.power.granted['fixed:'+m.port]>0,'the electronics are actually powered');const before=u.ammo[1];assert.equal(C.fleetMissileStep(u,.1,true).length,0);assert.equal(u.ammo[1],before);
 const open={...profile,modules:profile.modules.map(q=>({...q,launchBlocked:false}))},control=C.fleetUnit('open','open',open,0);C.allocateShipPower(control,C.fleetSystems(control),{throttle:0,weapons:0,shields:0},0,'balanced');assert.equal(C.fleetMissileStep(control,.1,true).reduce((n,q)=>n+q.n,0),2,'the identical powered launcher fires when its physical block is cleared');assert.equal(control.ammo[1],before-2);
});
