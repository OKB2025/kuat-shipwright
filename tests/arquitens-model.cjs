const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance:{now:()=>0}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const {C,R,D}=vm.runInContext('({C:Core,R:Rts,D:YardFleetData.designs})',cx),plain=v=>JSON.parse(JSON.stringify(v)),near=(a,b,eps=.002)=>assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`);
let built,stats,profile;
const ship=()=>built||(built=C.buildDesign('arquitens'));
function calculated(){const s=ship();stats||=C.computeStats(s);profile||=C.fleetProfile(stats,s.name,s);return {s,S:stats,p:profile};}

test('the source provenance and rendered hull exclude the four original static main guns',()=>{
 const source=fs.readFileSync(path.join(root,'assets/source/arquitens.stl')),manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/source/arquitens-manifest.json'),'utf8')),sha=crypto.createHash('sha256').update(source).digest('hex');
 assert.equal(sha,'e0c6b655ffe0690dd5ddc835f17fa5caf57e671760307576b20c75792ee8f108');assert.equal(manifest.source_sha256,sha);assert.equal(source.readUInt32LE(80),214690);assert.equal(manifest.source_triangles,214690);
 assert.equal(manifest.gun_mounts.length,4);assert.equal(manifest.removed_gun_triangles,23420);assert.equal(manifest.gun_mounts.reduce((n,m)=>n+m.triangle_count,0),manifest.removed_gun_triangles);
 assert.equal(manifest.removed_bell_triangles,6930);assert.equal(manifest.engine_bores.length,3);assert.equal(manifest.engine_bores.reduce((n,m)=>n+m.removed_triangles,0),manifest.removed_bell_triangles);
 const a=C.REFERENCE_ASSETS.arq_hull;assert.ok(a);assert.equal(a.faces,184340);assert.equal(a.faces,manifest.render_triangles);assert.equal(a.faces,manifest.source_triangles-manifest.removed_gun_triangles-manifest.removed_bell_triangles,'static guns and exhaust funnels must be removed before rotating fittings and standard bells are added');
 assert.equal(crypto.createHash('sha256').update(Buffer.from(a.data,'base64')).digest('hex'),manifest.packed_sha256);
});

test('the replacement Arquitens is the supplied 325 m hull with an ordinary selectable reference structure',()=>{
 const s=ship();assert.equal(s.hull.assembly,true,'the old approximated station hull must not cover the new STL');near(s.hull.L,325,1e-9);
 const hull=s.parts.filter(p=>p.k==='struct'&&p.form==='reference'&&p.skinAsset==='arq_hull');assert.equal(hull.length,1,'the model is an editable ordinary structure, not a second phantom hull');
 const a=C.REFERENCE_ASSETS.arq_hull;assert.ok(a&&a.n>0&&a.faces>0);assert.ok(a.collider?.length>0,'the shape has a physical closed collider for selection, rooms and mount rays');
 const b=C.refPartBounds(hull[0]);for(const x of b)assert.ok(Number.isFinite(x));near(b[0],0,.02);near(b[3],325,.02);near(b[2],-72.1381,.02);near(b[5],72.1381,.02);near(b[1],0,.02);near(b[4],63.6192,.02);
 assert.ok(C.structTriangles(hull[0]).length>0);assert.ok(!s.parts.some(p=>p.label==='舷側砲座'||p.label==='艦首突起の砲座'),'obsolete measured-model sponsons are replaced with the new model geometry');
});

test('the closed physical hull preserves the bow slot and all three engine cowlings',()=>{
 const hull=ship().parts.find(p=>p.skinAsset==='arq_hull');assert.ok(hull);
 for(const [p,inside]of [[[300,22,0],false],[[170,20,0],true],[[25,21.8,0],true],[[25,21.8,55.9],true],[[25,21.8,-55.9],true],[[180,50,60],false]])assert.equal(C.inPart(hull,p),inside,`physical hull at ${p}`);
});

test('cached reference rays follow translations and solid cuts without retaining the old hull',()=>{
 const source=ship().parts.find(p=>p.skinAsset==='arq_hull'),hull=JSON.parse(C.publicJSON(source)),down=[0,-1,0],origin=[170,100,0];
 const first=C.rayPart(origin,down,hull);assert.ok(first,'the amidships deck must be hittable');near(first.p[0],170);near(first.p[2],0);
 assert.equal(C.rayPart([300,100,0],down,hull),null,'the fork slot has no invisible roof');
 const offset=[700,80,120];hull.c=C.add(hull.c,offset);assert.equal(C.rayPart(origin,down,hull),null,'the warmed BVH must not leave the hull at its old position');
 const movedOrigin=C.add(origin,offset),moved=C.rayPart(movedOrigin,down,hull);assert.ok(moved);near(moved.t,first.t,.003);moved.p.forEach((v,i)=>near(v,first.p[i]+offset[i],.003));
 const cutShip=C.newShip({assembly:true,L:325,W:145,H:64},'Reference ray cut fixture');cutShip.parts=[hull];hull._solidCutShip=cutShip;
 cutShip.solidCuts=[{id:1,shape:'box',c:hull.c.slice(),s:[1000,1000,1000],rotation:[0,0,0],mirror:false,structures:true}];
 assert.equal(C.rayPart(movedOrigin,down,hull),null,'a freshly cut reference must not use the uncut cached tree');
 cutShip.solidCuts=[];const restored=C.rayPart(movedOrigin,down,hull);assert.ok(restored,'removing the cut restores the deck');near(restored.t,first.t,.003);
});

test('the four main batteries are matching port/starboard pairs on the dorsal and ventral source stations',()=>{
 const s=ship(),guns=s.fits.filter(f=>f.k==='quad500');assert.equal(guns.length,4);assert.equal(s.fits.filter(f=>f.k==='mtl').length,0,'old three-barrel substitute guns are retired in this example');
 const dorsal=guns.filter(f=>C.fitUp(f)[1]>.99),ventral=guns.filter(f=>C.fitUp(f)[1]<-.99);assert.equal(dorsal.length,2);assert.equal(ventral.length,2);
 for(const pair of [dorsal,ventral]){assert.ok(pair.some(f=>f.p[2]>0)&&pair.some(f=>f.p[2]<0));near(pair[0].p[0],pair[1].p[0]);near(pair[0].p[1],pair[1].p[1]);near(pair[0].p[2],-pair[1].p[2]);}
 for(const f of guns){assert.equal(f.float,false);assert.ok(C.fitCanRotate(f));near(C.fitSpec(f).tt,2,1e-12);near(C.fitSpec(f).boltTT,.5,1e-12);assert.equal(C.fitSpec(f).barrels,4);}
 assert.equal(guns.reduce((n,f)=>n+C.fitSpec(f).barrels,0),16,'the example carries sixteen physical medium-gun barrels');
});

test('existing secondary armament and the three installed drives remain functional on the new model',()=>{
 const {s,S,p}=calculated();assert.equal(s.fits.filter(f=>f.k==='pd').length,8);assert.equal(s.fits.filter(f=>f.k==='cmsl').length,4);assert.equal(s.fits.filter(f=>f.k==='trc').length,1);
 assert.ok(s.fits.every(f=>!f.float),'replacing the hull cannot strand the mounted weapons');
 const engines=s.parts.filter(p=>p.k==='engine');assert.equal(engines.length,3);assert.equal(p.propulsion.engines.length,3);
 for(const e of engines){assert.ok(s.parts.some(q=>q.id===e.reactor&&['gen','aux'].includes(q.k)));assert.equal(C.resolveEngineSpec(e,s).valid,true);}
 for(const value of [S.mass,S.cost,p.propulsion.massKg,p.hp])assert.ok(Number.isFinite(value)&&value>0);
 const u=C.fleetUnit('new-arquitens','arquitens',p,0);C.allocateShipPower(u,C.fleetSystems(u),{throttle:1},.25,'balanced');assert.ok(u.propulsion.actualInputW>0);assert.ok(u.propulsion.actualThrustN>0);near(u.propulsion.wasteHeatW/u.propulsion.actualInputW,.05,1e-12);
 const idle=C.fleetUnit('idle-arquitens','arquitens',p,0);C.allocateShipPower(idle,C.fleetSystems(idle),{throttle:0},.25,'balanced');assert.equal(idle.propulsion.actualThrustN,0,'source geometry must not grant free idle propulsion');
});

test('saving and reloading preserves the supplied hull, new main guns and independent propulsion fields',()=>{
 const s=ship(),loaded=C.deserialize(C.serialize(s)),twice=C.deserialize(C.serialize(loaded));
 for(const design of [loaded,twice]){assert.equal(design.hull.assembly,true);assert.equal(design.parts.filter(p=>p.skinAsset==='arq_hull').length,1);assert.equal(design.fits.filter(f=>f.k==='quad500').length,4);assert.equal(design.parts.filter(p=>p.k==='engine').length,3);assert.equal(design.parts.filter(p=>p.k==='engine').every(p=>p.propulsionModelVersion===C.PROPULSION_MODEL_VERSION),true);}
 const fields=['id','ratedInputW','driveProfileId','machineryGradeId','machineryLengthM','machineryRadiusM','machineryOffsetM'],rows=d=>d.parts.filter(p=>p.k==='engine').map(p=>Object.fromEntries(fields.map(k=>[k,p[k]])));
 assert.deepEqual(plain(rows(loaded)),plain(rows(s)));assert.deepEqual(plain(rows(twice)),plain(rows(loaded)));
});

test('the built-in fleet cache describes the replacement model and its medium quad main battery',()=>{
 const d=D.arquitens,{s,S,p}=calculated();assert.equal(d.p.profileVersion,C.FLEET_PROFILE_VERSION);assert.ok(d.p.propulsion?.engines?.length===3);
 near(d.p.len,325,.1);near(d.p.width,p.width,.1);near(d.p.height,p.height,.1);near(d.info.mass,S.mass,Math.max(1,S.mass)*1e-8);near(d.info.cost,S.cost,1);
 const names=d.p.modules.filter(m=>m.k==='weapon').map(m=>m.name),short=C.FITS.quad500.short;assert.equal(names.filter(n=>n===short).length,4,'cached battles must not continue using the old three-barrel weapons');
 const info=R.designInfo(S,p);near(d.info.hyper,info.hyper,.01);assert.equal(d.paint,s.paint);assert.equal(d.faction,'empire');
});
