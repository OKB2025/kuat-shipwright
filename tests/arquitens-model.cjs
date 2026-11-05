const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance:{now:()=>0}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const {C,R,D}=vm.runInContext('({C:Core,R:Rts,D:YardFleetData.designs})',cx),plain=v=>JSON.parse(JSON.stringify(v)),near=(a,b,eps=.002)=>assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`);
let built,stats,profile;
const ship=()=>built||(built=C.buildDesign('arquitens'));
function calculated(){const s=ship();stats||=C.computeStats(s);profile||=C.fleetProfile(stats,s.name,s);return {s,S:stats,p:profile};}
const nativeShapes=s=>s.parts.filter(C.isShapePart),solidAt=(s,p)=>C.inHull(s,p)||nativeShapes(s).some(q=>C.inPart(q,p));
// Measure the attached binary STL directly at selected weapon-free X/Z stations.
// This compares physical surfaces rather than trusting recorded target dimensions.
function sourceRoofAt(stations){
 const raw=fs.readFileSync(path.join(root,'assets/source/arquitens.stl')),count=raw.readUInt32LE(80),lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
 for(let t=0;t<count;t++)for(let v=0;v<3;v++)for(let k=0;k<3;k++){const n=raw.readFloatLE(84+t*50+12+v*12+k*4);lo[k]=Math.min(lo[k],n);hi[k]=Math.max(hi[k],n);}
 const scale=325/(hi[1]-lo[1]),mid=(lo[0]+hi[0])/2,out=stations.map(()=>-Infinity);
 for(let t=0;t<count;t++){
  const vertices=[];for(let v=0;v<3;v++){const o=84+t*50+12+v*12,x=raw.readFloatLE(o),y=raw.readFloatLE(o+4),z=raw.readFloatLE(o+8);vertices.push([(hi[1]-y)*scale,(z-lo[2])*scale,(mid-x)*scale]);}
  const [a,b,c]=vertices,den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(den)<1e-10)continue;
  for(let i=0;i<stations.length;i++){const [x,z]=stations[i],u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den,v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den,w=1-u-v;if(Math.min(u,v,w)>=-1e-8)out[i]=Math.max(out[i],u*a[1]+v*b[1]+w*c[1]);}
 }
 return out;
}

test('the supplied STL remains source provenance rather than a required runtime hull',()=>{
 const source=fs.readFileSync(path.join(root,'assets/source/arquitens.stl')),manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/source/arquitens-manifest.json'),'utf8')),sha=crypto.createHash('sha256').update(source).digest('hex');
 assert.equal(sha,'e0c6b655ffe0690dd5ddc835f17fa5caf57e671760307576b20c75792ee8f108');assert.equal(manifest.source_sha256,sha);assert.equal(source.readUInt32LE(80),214690);assert.equal(manifest.source_triangles,214690);
 assert.equal(manifest.gun_mounts.length,4);assert.equal(manifest.removed_gun_triangles,23420);assert.equal(manifest.gun_mounts.reduce((n,m)=>n+m.triangle_count,0),manifest.removed_gun_triangles);
 assert.equal(manifest.removed_bell_triangles,6930);assert.equal(manifest.engine_bores.length,3);assert.equal(manifest.engine_bores.reduce((n,m)=>n+m.removed_triangles,0),manifest.removed_bell_triangles);
 assert.ok(!ship().parts.some(p=>p.skinAsset==='arq_hull'),'the example must work without importing the complete source mesh');
});

test('the 325 m Arquitens is assembled from normal editable hull structures and equipment',()=>{
 const s=ship(),shapes=nativeShapes(s);near(s.hull.L,325,1e-9);near(s.hull.W,144,1);near(s.hull.H,64,1);assert.equal(shapes.length,75,'the measured hull, ridge, machinery pods and swept bridge remain independent editable structures');assert.equal(s.parts.length,94);assert.equal(s.fits.length,17);assert.ok(!shapes.some(p=>/主砲座|支持台/.test(p.label||'')),'turrets sit on existing ship decks without artificial support blocks');
 for(const p of s.parts){assert.ok(C.PARTS[p.k],'each part is an ordinary game part');assert.notEqual(p.form,'reference');assert.notEqual(p.form,'mesh');}
 for(const p of shapes){assert.ok(!p.skinAsset,'the hull cannot depend on an imported asset');assert.ok(Array.isArray(p.c)&&p.c.length===3&&p.c.every(Number.isFinite));assert.ok(Array.isArray(p.s)&&p.s.length===3&&p.s.every(v=>Number.isFinite(v)&&v>0));const triangles=C.structTriangles(p);assert.ok(triangles.length>0);assert.ok(triangles.every(Number.isFinite),'editable parameters generate physical triangles');}
 const bounds=shapes.map(C.partAABB);assert.ok(Math.min(...bounds.map(b=>b[0]))<=1);assert.ok(Math.max(...bounds.map(b=>b[3]))>=324);assert.ok(Math.min(...bounds.map(b=>b[2]))<=-70&&Math.max(...bounds.map(b=>b[5]))>=70,'the three pods retain the broad stern silhouette');assert.ok(Math.max(...bounds.map(b=>b[4]))>=60,'the bridge is a real raised structure');
});

test('physical volume and deck rays preserve the open fork, three separate stern pods and raised bridge',()=>{
 const s=ship(),down=[0,-1,0];
 for(const [p,inside]of [[[300,22,0],false],[[300,22,13],true],[[300,22,-13],true],[[170,22,0],true],[[170,36,17],true],[[250,22,0],true],[[255,22,0],false],[[124,58,0],true],[[124,58,30],false],[[180,50,60],false]])assert.equal(solidAt(s,p),inside,`physical hull at ${p}`);
 for(const x of [260,290,300,315])assert.equal(C.rayEnv(s,[x,100,0],down,{structOnly:true}),null,'the fork gap must not have an invisible hull or roof');
 for(const z of [-13,13]){const h=C.rayEnv(s,[300,100,z],down,{structOnly:true});assert.ok(h,'both fork arms have real selectable decks');assert.ok(h.p[1]>20);}
 for(const z of [-55.4,0,55.4]){assert.equal(solidAt(s,[22,21.8,z]),true,'each stern pod has physical volume');assert.ok(C.rayEnv(s,[22,100,z],down,{structOnly:true}));}
 const aftGaps=sourceRoofAt([[2,-27.7],[2,27.7]]);for(const [i,z]of [-27.7,27.7].entries()){assert.equal(aftGaps[i],-Infinity,'the supplied STL has an actual open aft gap between the pods');assert.equal(solidAt(s,[2,21.8,z]),false,'the three aft pod rings remain distinct');assert.equal(C.rayEnv(s,[2,100,z],down,{structOnly:true}),null);assert.equal(solidAt(s,[22,21.8,z]),true,'the source inter-pod fairings connect the forward cowling bodies');}
 for(const z of [-55.4,0,55.4]){assert.equal(solidAt(s,[7,21.8,z]),false,'the rear structural rings leave an open engine aperture');assert.equal(solidAt(s,[7,35.8,z]),true,'each aperture has a real surrounding cowling wall');const h=C.rayEnv(s,[-20,21.8,z],[1,0,0],{structOnly:true});assert.ok(h&&h.p[0]>=13,'there is no static imported exhaust face across the aperture');}
 const bridge=C.rayEnv(s,[124,100,0],down,{structOnly:true}),body=C.rayEnv(s,[170,100,0],down,{structOnly:true});assert.ok(bridge&&body);assert.ok(body.p[1]>=42&&body.p[1]<=45,'the elevated forward spine preserves the source centreline crown');assert.ok(bridge.p[1]>55&&bridge.p[1]>body.p[1]+10,'the swept bridge rises above the crowned main hull');
});

test('native bridge, crowned centreline, fork and round pods track the actual STL roof measurements',()=>{
 const stations=[[170,0],[205,0],[124,0],[300,13],[300,-13],[22,55.432],[22,-55.432]],measured=sourceRoofAt(stations),s=ship();
 for(let i=0;i<stations.length;i++){const [x,z]=stations[i],h=C.rayEnv(s,[x,100,z],[0,-1,0],{structOnly:true});assert.ok(h&&Number.isFinite(measured[i]),`both source and native hull have a roof at ${x},${z}`);near(h.p[1],measured[i],2);}
});

test('ordinary solid cuts change the actual example structure and can restore its selectable roof',()=>{
 const source=nativeShapes(ship()).sort((a,b)=>C.partAABB(b)[4]-C.partAABB(a)[4])[0],shape=JSON.parse(C.publicJSON(source)),fixture=C.newShip({assembly:true,L:325,W:144,H:64},'Native structure cut fixture');fixture.parts=[shape];
 const down=[0,-1,0],origin=[shape.c[0],C.partAABB(shape)[4]+20,shape.c[2]],first=C.rayEnv(fixture,origin,down,{structOnly:true});assert.ok(first);
 fixture.solidCuts=[{id:1,shape:'box',c:shape.c.slice(),s:[1000,1000,1000],rotation:[0,0,0],mirror:false,structures:true}];
 assert.equal(C.rayEnv(fixture,origin,down,{structOnly:true}),null,'the native structure cannot leave an uncut imported collision surface');
 fixture.solidCuts=[];const restored=C.rayEnv(fixture,origin,down,{structOnly:true});assert.ok(restored);near(restored.t,first.t,.003);
});

test('four independent main batteries form port/starboard pairs on the dorsal and ventral native decks',()=>{
 const s=ship(),guns=s.fits.filter(f=>f.k==='quad500');assert.equal(guns.length,4);assert.equal(s.fits.filter(f=>f.k==='mtl').length,0,'old three-barrel substitute guns are retired in this example');
 const dorsal=guns.filter(f=>C.fitUp(f)[1]>.99),ventral=guns.filter(f=>C.fitUp(f)[1]<-.99);assert.equal(dorsal.length,2);assert.equal(ventral.length,2);
 for(const pair of [dorsal,ventral]){assert.ok(pair.some(f=>f.p[2]>0)&&pair.some(f=>f.p[2]<0));near(pair[0].p[0],pair[1].p[0]);near(pair[0].p[1],pair[1].p[1]);near(pair[0].p[2],-pair[1].p[2]);}
 for(const f of guns){assert.equal(f.float,false);assert.equal(f.ped,0);assert.equal(f.base,0);assert.equal(f.low,0);assert.equal(f.mountOffset,undefined);const expected=f.a===2?[173.2522,32.18,28.4337]:[238.0963,17.88336,24.0026];near(f.p[0],expected[0],.005);near(f.p[1],expected[1],.005);near(Math.abs(f.p[2]),expected[2],.005);assert.ok(C.fitCanRotate(f));near(C.fitSpec(f).tt,2,1e-12);near(C.fitSpec(f).boltTT,.5,1e-12);assert.equal(C.fitSpec(f).barrels,4);const up=C.fitUp(f),hit=C.rayEnv(s,C.add(f.p,C.mul(up,200)),C.mul(up,-1),{structOnly:true});assert.ok(hit,'each independent turret has a physical native mounting face');near(C.dot(C.sub(f.p,hit.p),up),0,.02);}
 assert.equal(guns.reduce((n,f)=>n+C.fitSpec(f).barrels,0),16,'the example carries sixteen physical medium-gun barrels');
});

test('ordinary secondary armament and three independently supplied drives remain functional',()=>{
 const {s,S,p}=calculated();assert.equal(s.fits.filter(f=>f.k==='pd').length,8);assert.equal(s.fits.filter(f=>f.k==='shipMsl').length,4);assert.equal(s.fits.filter(f=>f.k==='trc').length,1);
 assert.ok(s.fits.every(f=>!f.float),'replacing the hull cannot strand the mounted weapons');
 const engines=s.parts.filter(p=>p.k==='engine');assert.equal(engines.length,3);assert.equal(p.propulsion.engines.length,3);
 const internal=s.parts.filter(p=>!C.isShapePart(p)&&!['engine','sensor'].includes(p.k));assert.ok(internal.length>0);
 for(const part of internal){const b=C.partAABB(part);for(const x of [b[0],b[3]])for(const y of [b[1],b[4]])for(const z of [b[2],b[5]])assert.ok(solidAt(s,[x,y,z]),`${part.label||part.k} must fit inside the native hull at ${[x,y,z]}`);}
 assert.equal(new Set(engines.map(e=>e.reactor)).size,3,'each installed drive has an independent supply');
 for(const e of engines){assert.ok(s.parts.some(q=>q.id===e.reactor&&['gen','aux'].includes(q.k)));assert.equal(C.resolveEngineSpec(e,s).valid,true);}
 const launchers=p.modules.filter(m=>m.missileKind==='shipMsl');assert.equal(launchers.length,4);
 for(const m of launchers){assert.equal(m.k,'launcher');assert.equal(m.stock,6);assert.equal(m.tt,25);assert.equal(m.cycle,1.2);assert.equal(p.modules.filter(q=>q.fit===m.fit).length,1);const loads=p.grid.fixedLoads.filter(l=>l.port===m.port);assert.equal(loads.length,1);assert.equal(loads[0].weight,1e15);}
 for(const value of [S.mass,S.cost,p.propulsion.massKg,p.hp])assert.ok(Number.isFinite(value)&&value>0);
 const u=C.fleetUnit('new-arquitens','arquitens',p,0);C.allocateShipPower(u,C.fleetSystems(u),{throttle:1},.25,'balanced');assert.ok(u.propulsion.actualInputW>0);assert.ok(u.propulsion.actualThrustN>0);near(u.propulsion.wasteHeatW/u.propulsion.actualInputW,.05,1e-12);
 const idle=C.fleetUnit('idle-arquitens','arquitens',p,0);C.allocateShipPower(idle,C.fleetSystems(idle),{throttle:0},.25,'balanced');assert.equal(idle.propulsion.actualThrustN,0,'source geometry must not grant free idle propulsion');
});

test('saving and reloading preserves native structure parameters, main guns and independent propulsion fields',()=>{
 const s=ship(),loaded=C.deserialize(C.serialize(s)),twice=C.deserialize(C.serialize(loaded));
 for(const design of [loaded,twice]){assert.equal(design.hull.assembly,s.hull.assembly);assert.ok(!design.parts.some(p=>p.skinAsset==='arq_hull'||p.form==='reference'||p.form==='mesh'));assert.equal(design.fits.filter(f=>f.k==='quad500').length,4);assert.equal(design.fits.filter(f=>f.k==='shipMsl').length,4);assert.equal(design.parts.filter(p=>p.k==='engine').length,3);assert.equal(design.parts.filter(p=>p.k==='engine').every(p=>p.propulsionModelVersion===C.PROPULSION_MODEL_VERSION),true);}
 const structureRows=d=>d.parts.filter(C.isShapePart).map(p=>({id:p.id,k:p.k,c:p.c,s:p.s,form:p.form,loft:p.loft,outline:p.outline}));
 assert.deepEqual(plain(structureRows(loaded)),plain(structureRows(s)));assert.deepEqual(plain(structureRows(twice)),plain(structureRows(loaded)));
 const fields=['id','ratedInputW','driveProfileId','machineryGradeId','machineryLengthM','machineryRadiusM','machineryOffsetM'],rows=d=>d.parts.filter(p=>p.k==='engine').map(p=>Object.fromEntries(fields.map(k=>[k,p[k]])));
 assert.deepEqual(plain(rows(loaded)),plain(rows(s)));assert.deepEqual(plain(rows(twice)),plain(rows(loaded)));
});

test('a normal structure can be moved and resized, and its changed physical surface survives saving',()=>{
 const design=C.deserialize(C.serialize(ship())),shape=design.parts.filter(C.isShapePart).sort((a,b)=>C.partAABB(b)[4]-C.partAABB(a)[4])[0];
 assert.ok(shape&&Array.isArray(shape.c)&&Array.isArray(shape.s));assert.notEqual(shape.form,'reference');assert.notEqual(shape.form,'mesh');
 const down=[0,-1,0],origin=[shape.c[0],C.partAABB(shape)[4]+30,shape.c[2]],before=C.rayPart(origin,down,shape);assert.ok(before,'the selected ordinary superstructure has a real roof');
 const original=ship().parts.find(p=>p.id===shape.id),oldCenter=plain(original.c),oldSize=plain(original.s);
 shape.c=C.add(shape.c,[0,5,0]);shape.s[2]+=2;
 const edited=C.rayPart(origin,down,shape);assert.ok(edited);assert.ok(edited.p[1]>before.p[1]+4,'moving and resizing changes the collision surface, not only its displayed parameters');
 const reloaded=C.deserialize(C.serialize(design)),restored=reloaded.parts.find(p=>p.id===shape.id),hit=C.rayPart(origin,down,restored);assert.ok(hit);
 assert.deepEqual(plain(restored.c),plain(shape.c));assert.deepEqual(plain(restored.s),plain(shape.s));near(hit.p[1],edited.p[1],.002);
 assert.deepEqual(plain(original.c),oldCenter);assert.deepEqual(plain(original.s),oldSize,'editing a saved copy cannot mutate the example');
});

test('the built-in fleet cache matches the native construction and its medium quad main battery',()=>{
 const d=D.arquitens,{s,S,p}=calculated();assert.equal(d.p.profileVersion,C.FLEET_PROFILE_VERSION);assert.ok(d.p.propulsion?.engines?.length===3);
 near(d.p.len,325,.1);near(d.p.width,p.width,.1);near(d.p.height,p.height,.1);near(d.info.mass,S.mass,Math.max(1,S.mass)*1e-8);near(d.info.cost,S.cost,1);
 const names=d.p.modules.filter(m=>m.k==='weapon').map(m=>m.name),short=C.FITS.quad500.short;assert.equal(names.filter(n=>n===short).length,4,'cached battles must not continue using the old three-barrel weapons');
 const info=R.designInfo(S,p);near(d.info.hyper,info.hyper,.01);assert.equal(d.paint,s.paint);assert.equal(d.faction,'empire');
});
