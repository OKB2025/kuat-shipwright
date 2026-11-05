const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console}),plain=v=>JSON.parse(JSON.stringify(v));
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js']){
 let source=fs.readFileSync(path.join(root,file),'utf8');
 if(file==='js/core.js')for(const name of ['accBuild','arqBuild','mc30Build']){const hook='build:'+name+'\n';assert.equal(source.split(hook).length,2,name+' staged test hook must be unique');source=source.replace(hook,'build:'+name+',_testBuild:'+name+',_testStation:presetStationPoint\n');}
 vm.runInContext(source,cx,{filename:file});
}
const C=vm.runInContext('Core',cx),near=(a,b,e=1e-5)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
let staged;
function fitted(){return staged||(staged=C.SHIP_EXAMPLES.acclamator._testBuild({stage:'fitted'}));}
function assertMissiles(s){
 const missiles=s.fits.filter(f=>f.k==='cmsl');assert.equal(missiles.length,4,'the reference design needs all four bow launch tubes');
 for(const f of missiles){
  assert.equal(f.float,false);assert.equal(f._onPlate,undefined);assert.equal(C.missileMount(f),'ext');assert.equal(C.fitHasPedestal(f),false);
  for(const k of ['ped','base','low','slope'])near(f[k],0);assert.deepEqual(plain(C.fitOrigin(f)),plain(f.p));
  const roof=C.rayEnv(s,[f.p[0],500,f.p[2]],[0,-1,0],{maxT:1000,structOnly:true});assert.ok(roof);assert.ok(f.p[1]>20,'a column station at Y=0 must first resolve the actual dorsal deck');
  near(C.len(C.sub(roof.p,f.p)),0,.002);assert.ok(!roof.part?.plate);
  assert.ok(missiles.some(g=>g!==f&&Math.abs(g.p[0]-f.p[0])<1e-5&&Math.abs(g.p[2]+f.p[2])<1e-5),'bow launch tubes must remain mirrored pairs');
 }
 return missiles;
}

test('Acclamator station columns install all bow launchers directly on the dorsal hull without lift',()=>{
 const s=fitted();assert.equal(s.fits.filter(f=>f.k==='quad200').length,12);assert.equal(s.fits.filter(f=>f.k==='pd').length,24);assertMissiles(s);
 const before=plain(s.fits.filter(f=>f.k==='cmsl').map(f=>f.p));C.remount(s);assertMissiles(s);assert.deepEqual(plain(s.fits.filter(f=>f.k==='cmsl').map(f=>f.p)),before);
});

test('interactive external launchers retain their local attachment ray beneath an overhang',()=>{
 const s=C.newShip({L:100,W:80,H:70,assembly:true},'Local launcher decks');s.parts=[];s.fits=[];s.nextId=1;
 C.placePart(s,'struct',[50,5,0],[60,60,10],{form:'box'},false);C.placePart(s,'struct',[50,55,0],[60,60,10],{form:'box'},false);
 const at=[50,10,0],f={id:10,k:'msl',p:at.slice(),a:2,ped:0,base:0,low:0,mount:'ext'};C.mountFit(s,f);assert.equal(f.float,false);near(f.p[1],10);near(C.len(C.sub(C.fitOrigin(f),at)),0);
 const outside={...f,id:11,p:[50,-20,0]};C.mountFit(s,outside);assert.equal(outside.float,true,'an off-hull interactive launcher must not jump to a distant deck');near(outside.p[1],-20);
});

test('preset columns resolve dorsal, ventral and beam faces while local mounts, turrets and plate rejection retain their rules',()=>{
 const s=C.newShip({L:100,W:80,H:80,assembly:true},'Preset mount directions');s.parts=[];s.fits=[];s.nextId=1;
 C.placePart(s,'struct',[50,40,0],[60,40,40],{form:'box'},false);C.placePart(s,'gen',[50,90,0],12,{},false);
 const station=C.SHIP_EXAMPLES.acclamator._testStation,center=[50,40,0],surfaces=[[80,40,0],[20,40,0],[50,60,0],[50,20,0],[50,40,20],[50,40,-20]];
 for(let axis=0;axis<6;axis++){
  const p=station(s,'msl',center,axis);near(C.len(C.sub(p,surfaces[axis])),0,.001);
  const f={id:10+axis,k:'msl',p,a:axis,ped:0,base:0,low:0};C.mountFit(s,f);assert.equal(f.float,false);near(C.len(C.sub(f.p,surfaces[axis])),0,.001);for(const k of ['ped','base','low','slope'])near(f[k],0);
 }
 assert.deepEqual(plain(station(s,'msl',center,2,{localMount:true})),center,'an explicit local mount is already a chosen point');
 assert.deepEqual(plain(station(s,'pd',center,2)),center,'turrets retain their own footprint and step checks');
 const missing=[200,40,0];assert.deepEqual(plain(station(s,'msl',missing,2)),missing,'a missing column cannot invent a mounting face');
 C.placePart(s,'struct',[50,75,0],[60,40,1],{form:'box',plate:true,plateT:.1},false);
 const f={id:20,k:'msl',p:station(s,'msl',center,2),a:2,ped:0,base:0,low:0};C.mountFit(s,f);assert.equal(f.float,true);assert.equal(f._onPlate,true,'a preset still rejects physical armor plates');
});

test('Arquitens fitted presets install all four flush prong launchers',()=>{
 const s=C.SHIP_EXAMPLES.arquitens._testBuild({stage:'fitted'}),launchers=s.fits.filter(f=>f.k==='cmsl');assert.equal(launchers.length,4);
 for(const f of launchers){assert.equal(f.float,false);assert.equal(C.missileMount(f),'ext');for(const k of ['ped','base','low','slope'])near(f[k],0);const roof=C.rayEnv(s,[f.p[0],500,f.p[2]],[0,-1,0],{maxT:1000,structOnly:true});assert.ok(roof);near(C.len(C.sub(roof.p,f.p)),0,.002);}
});

test('MC30c presets migrate two flush torpedo tubes into surface VLS and retain six external launchers',()=>{
 const s=C.SHIP_EXAMPLES.mc30c._testBuild({stage:'fitted'}),launchers=s.fits.filter(f=>f.k==='cmsl'),pending=launchers.filter(f=>f.legacyMissileMount==='vls'),external=launchers.filter(f=>!f.legacyMissileMount);assert.equal(launchers.length,8);assert.equal(pending.length,2);assert.equal(external.length,6);assert.ok(external.every(f=>C.missileMount(f)==='ext'));
 const bays=s.fits.filter(f=>f.k==='monCal34'||f.k==='monCal150Ion');assert.equal(bays.length,28);assert.equal(bays.filter(f=>f.k==='monCal34').length,12);assert.equal(bays.filter(f=>f.k==='monCal150Ion').length,16);
 for(let i=0;i<bays.length;i++){
  const f=bays[i],b=C.fitAABB(f);assert.equal(f.float,false);assert.equal(C.fitSpec(f).barrels,1);assert.ok(f.p[0]>=195&&f.p[0]<=368,'the migrated bays remain on the existing head');
  assert.ok(bays.some(g=>g!==f&&Math.abs(g.p[0]-f.p[0])<1e-6&&Math.abs(g.p[2]+f.p[2])<1e-6),'every bay retains a matching opposite-side station');
  for(const g of bays.slice(i+1)){const q=C.fitAABB(g);assert.ok([0,1,2].some(a=>b[a+3]+.49<=q[a]||q[a+3]+.49<=b[a]),'adjacent wall windows retain a physical gap');}
 }
 for(const f of launchers){assert.equal(f.float,false);for(const k of ['ped','base','low','slope'])near(f[k],0);const roof=C.rayEnv(s,[f.p[0],1000,f.p[2]],[0,-1,0],{maxT:2000,structOnly:true});assert.ok(roof);near(C.len(C.sub(roof.p,f.p)),0,.002);}
 const originalIds=launchers.map(f=>f.id).sort((a,b)=>a-b),pendingIds=pending.map(f=>f.id).sort((a,b)=>a-b);
 C.migrateLegacyConcussionVLS(s);
 const native=s.fits.filter(f=>C.isConcussionLauncher(f)),vls=C.surfaceDerivedFits(s).filter(f=>C.isConcussionLauncher(f));
 assert.equal(native.length,6);assert.ok(native.every(f=>C.missileMount(f)==='ext'&&!f.float));assert.equal(vls.length,2);assert.deepEqual(vls.map(f=>f.id).sort((a,b)=>a-b),pendingIds);
 for(const f of vls){assert.ok(C.isSurfaceVLS(f));assert.equal(C.missileMount(f),'vls');assert.equal(f.float,false);assert.equal(f.surfaceUnplaced,false);assert.equal(s.surfaces.patches.find(q=>q.id===f.surfacePatch)?.functionMode,'equipment');}
 const migratedIds=[...native,...vls].map(f=>f.id).sort((a,b)=>a-b);assert.deepEqual(plain(migratedIds),plain(originalIds),'migration retains all eight launcher IDs without replacement or duplication');
 const stats=C.computeStats(s),capacitors=C.weaponCapacitors(s);
 for(const f of bays){assert.ok(capacitors.some(p=>p.weaponId===f.id),'each bay owns actual charging hardware');assert.ok(stats.chargeInfo[f.id].ratio>1-1e-6,'the fitted bay has room for its full firing charge');assert.ok(stats.chargeInfo[f.id].internalVolume>0);}
});

test('the full Acclamator builder and current fleet profile complete with four usable launchers',()=>{
 const s=C.buildDesign('acclamator');assertMissiles(s);assert.equal(s.fits.filter(f=>f.k==='quad200').length,12,'the completed example retains all twelve canonical quad turrets');assert.equal(s.fits.filter(f=>f.k==='pd').length,24,'weapon consolidation does not convert its independent point defenses');assert.deepEqual(plain(s.airWings),[]);assert.deepEqual(plain(s.groundForces),[]);
 const stats=C.computeStats(s),profile=C.fleetProfile(stats,s.name,s);assert.ok(Number.isFinite(stats.mass)&&stats.mass>0);assert.equal(profile.profileVersion,C.FLEET_PROFILE_VERSION);
 const launchers=profile.modules.filter(m=>m.k==='launcher');assert.equal(launchers.length,4);assert.ok(launchers.every(m=>m.stock>0));assert.ok(profile.msl>0);
});
