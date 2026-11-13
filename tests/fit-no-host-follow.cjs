// Stage C of the no-recompute plan (2026-11-13; user decisions 2026-11-12 "親子関係は持たない" and 2026-11-13): a
// fitting (weapon) has no parent. Its world pose is decided only when the user places, moves, seats or slides it;
// a host moved, turned or resized, a reload or a Worker remount keep it and only judge it (supported within
// Core.FIT_SUPPORT_GAP_M, else floating). Deleting the structure under a fitting moves it along its own height
// axis onto the structure below, or leaves it where it is, floating; it is never deleted or re-attached sideways.
const assert=require('node:assert/strict'),path=require('node:path'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),{C}=require('../scripts/update-ship-examples.cjs').loadRuntime(root);
const plain=x=>JSON.parse(C.publicJSON(x)),near=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
function fixture(){const s=C.newShip({L:300,W:200,H:100,assembly:true},'Fit no follow');s.parts=[{id:1,k:'struct',form:'box',c:[100,10,0],s:[200,160,20]}];s.fits=[];s.links=[];s.armor={hull:0,cit:0};s.nextId=2;s.detail=0;return s;}
function place(s,host=1,p=[83,20,23]){const r=C.solveFitPlacement(s,{id:-1,k:'pd',p:[0,0,0],n:[0,1,0],a:2,ped:.3,assetYaw:17,mountMode:'auto'},{mode:'direct',hostId:host,hit:{p,n:[0,1,0]},geometryRevision:0,parentGeometryRevision:0});assert.equal(r.ok,true,r.error);const a=C.acceptFitPlacementResult(s,r);assert.equal(a.ok,true,a.error);return a.fit;}
const pose=f=>plain({p:f.p,n:f.n,a:f.a,tilt:f.tilt??null,frameForward:f.frameForward??null});

for(const [name,edit] of [['moved',h=>{h.c=[105,10,4];}],['turned',h=>{h.yaw=20;}],['resized',h=>{h.s=[200,160,30];}]])
 test(`a host ${name}: the fitting keeps its world pose and record, and is judged where it stands`,()=>{
  const s=fixture(),f=place(s),before=pose(f),record=C.publicJSON(f.placement);edit(s.parts[0]);C.refreshPlacementGeometry(s);C.remount(s,{keepFitPose:true});
  assert.deepEqual(pose(f),before);assert.equal(C.publicJSON(f.placement),record);
  // A reload keeps it as well.
  const L=C.deserialize(structuredClone(C.serialize(s)));C.remount(L,{keepFitPose:true});assert.deepEqual(pose(L.fits[0]),before);
 });

test('the host moved away leaves the fitting floating where it was; moved back, it is supported again',()=>{
 const s=fixture(),f=place(s),before=pose(f);s.parts[0].c=[100,-30,0];C.refreshPlacementGeometry(s);C.remount(s,{keepFitPose:true});assert.deepEqual(pose(f),before);assert.equal(f.float,true);
 s.parts[0].c=[100,10,0];C.refreshPlacementGeometry(s);C.remount(s,{keepFitPose:true});assert.deepEqual(pose(f),before);assert.equal(f.float,false);
});

test('repeated remounts write nothing: no re-cast of the stored position (the Subjugator jitter)',()=>{
 const s=fixture();s.fits.push({id:9,k:'pd',p:[150,20,-40],n:[0,1,0],a:2,ped:.3});C.remount(s,{keepFitPose:true});const once=C.publicJSON(s.fits);for(let i=0;i<3;i++){C.remount(s,{keepFitPose:true});assert.equal(C.publicJSON(s.fits),once);}
 const L=C.deserialize(structuredClone(C.serialize(s)));C.remount(L,{keepFitPose:true});assert.deepEqual(plain(L.fits[0].p),[150,20,-40]);
});

test('deleting the structure under a fitting moves it down its height axis onto the structure below',()=>{
 const s=fixture();s.parts.push({id:2,k:'struct',form:'box',c:[80,26,20],s:[20,20,12]});s.nextId=3;C.refreshPlacementGeometry(s);
 const f=place(s,2,[80,32,20]);assert.equal(f.host,2);const r=C.removeParts(s,[2]);assert.equal(r.ok,true);
 assert.equal(s.fits.length,1,'not deleted');const g=s.fits[0];near(g.p[0],80);near(g.p[2],20);near(g.p[1],20,1e-6);assert.equal(g.host,1);assert.equal(r.removedFits.length,0);
});

test('deleting the structure under a fitting with nothing below leaves it where it is, floating (a warning)',()=>{
 const s=fixture();s.parts.push({id:2,k:'struct',form:'box',c:[260,10,0],s:[40,40,20]});s.nextId=3;C.refreshPlacementGeometry(s);
 const f=place(s,2,[260,20,0]),before=plain(f.p);const r=C.removeParts(s,[2]);assert.equal(r.ok,true);assert.equal(s.fits.length,1,'not deleted');assert.deepEqual(plain(s.fits[0].p),before);
 C.remount(s,{keepFitPose:true});assert.equal(s.fits[0].float,true);assert.deepEqual(plain(s.fits[0].p),before);
});

// Regression review 2026-11-13: a weapon WITHOUT a host (example and legacy fittings) standing on a deleted structure
// drops onto the structure below too; the drop never reaches beyond the removed structure's own depth.
test('deleting the structure under a hostless weapon drops it onto the structure below',()=>{
 const s=fixture();s.parts.push({id:2,k:'struct',form:'box',c:[80,26,20],s:[20,20,12]});s.nextId=3;s.fits.push({id:9,k:'pd',p:[80,32,20],n:[0,1,0],a:2,ped:.3});C.remount(s);
 assert.equal(s.fits[0].host,undefined);const r=C.removeParts(s,[2]);assert.equal(r.ok,true);assert.equal(s.fits.length,1);near(s.fits[0].p[1],20,1e-6);near(s.fits[0].p[0],80);
});
test('a mirrored template keeps the tilt of a sloped non-turret fitting mirrored',()=>{
 const f={id:1,k:'cmsl',p:[10,5,8],n:C.norm([0,1,.3]),tilt:C.norm([0,1,.3]),a:2,placement:{mode:'direct',modelVersion:C.PLACEMENT_MODEL_VERSION}},m=C.assemblyMirrorFit(f);
 if(!C.fitCanRotate(f)){near(m.tilt[2],-f.tilt[2]);near(m.tilt[1],f.tilt[1]);}
});

// Physics review 2026-11-13: a pedestalled gun on a sloped structure keeps no support block when it is left floating,
// and one whose structure sits on another drops onto it and is mounted there.
test('a pedestalled gun left floating by a deletion keeps no support; dropped onto a lower structure it is mounted there',()=>{
 const make=withBase=>{const s=C.newShip({L:300,W:200,H:100,assembly:true},'Pedestal delete');s.parts=withBase?[{id:1,k:'struct',form:'box',c:[100,10,0],s:[200,160,20]}]:[];s.parts.push({id:2,k:'struct',form:'box',c:[100,40,0],s:[60,40,20],pitch:20});s.fits=[];s.links=[];s.armor={hull:0,cit:0};s.nextId=3;s.detail=0;C.refreshPlacementGeometry(s);
  const hit=C.rayPart([100,200,0],[0,-1,0],s.parts.find(p=>p.id===2)),r=C.solveFitPlacement(s,{id:-1,k:'triple70',p:[0,0,0],n:[0,1,0],a:2,ped:2,mountMode:'top'},{mode:'direct',hostId:2,hit:{p:Array.from(hit.p),n:Array.from(hit.n)},geometryRevision:0,parentGeometryRevision:0});assert.equal(r.ok,true,r.error);C.acceptFitPlacementResult(s,r);return s;};
 const a=make(false);assert.ok(a.fits[0].mountSupport,'a support on the slope');C.removeParts(a,[2]);C.remount(a,{keepFitPose:true});assert.equal(a.fits[0].float,true);assert.equal(a.fits[0].mountSupport,undefined);assert.equal(a.fits[0].base,0);assert.equal(a.fits[0].low,0);/* pedVol keeps only the manual pedestal (ped 2) */
 const b=make(true),r=C.removeParts(b,[2]);assert.ok(r.reparented.some(q=>q.list==='fits'),'dropped and mounted');near(b.fits[0].p[1],20,1e-6);assert.equal(b.fits[0].host,1);C.remount(b,{keepFitPose:true});assert.equal(b.fits[0].float,false);
});

// ---- Stage C high review (2026-11-13) regressions ----
const r3=v=>Array.from(v).map(x=>+x.toFixed(3));
test('a roof added above a kept fitting does not make it float (the seat probe is local)',()=>{
 const s=fixture();C.refreshPlacementGeometry(s);s.fits.push({id:9,k:'pd',p:[100,20,0],n:[0,1,0],a:2,ped:.3});C.remount(s);const f=s.fits[0];assert.equal(f.float,false);
 s.parts.push({id:2,k:'struct',form:'box',c:[100,40,0],s:[30,30,4]});C.refreshPlacementGeometry(s);C.remount(s,{keepFitPose:true});assert.deepEqual(r3(f.p),[100,20,0]);assert.equal(f.float,false);
});
test('an embedded launcher and a reference turret keep their pose on a keep remount when their structure moves',()=>{
 const wall=()=>{const s=C.newShip({L:300,W:200,H:100,assembly:true},'k');s.parts=[{id:1,k:'struct',form:'box',c:[100,30,0],s:[100,60,60]}];s.fits=[];s.links=[];s.armor={hull:0,cit:0};s.nextId=2;s.detail=0;C.refreshPlacementGeometry(s);return s;};
 {const s=wall();s.fits.push({id:5,k:'shipMsl',p:[150,30,0],n:[1,0,0],tilt:[1,0,0],a:0,ped:0,launcherEmbedded:true});C.remount(s);const g=s.fits[0];const p0=r3(g.p);
  s.parts[0].c=[100,30,20];C.refreshPlacementGeometry(s);C.remount(s,{keepFitPose:true});assert.deepEqual(r3(g.p),p0,'embedded launcher does not follow');}
 {const s=wall();s.fits.push({id:7,k:'refVen',p:[100,61,0],a:2,mountAxis:2,mountOffset:1,ped:0});C.remount(s);const g=s.fits[0];assert.equal(g.float,false);assert.deepEqual(r3(g.p),[100,61,0]);
  C.remount(s,{keepFitPose:true});assert.equal(g.float,false,'its own seat supports it');s.parts[0].c=[100,25,0];C.refreshPlacementGeometry(s);C.remount(s,{keepFitPose:true});assert.deepEqual(r3(g.p),[100,61,0],'reference turret does not follow');assert.equal(g.float,true);}
});
for(const roll of [0,12,25])test(`deleting the structure under a fitting drops it onto a sloped surface below (roll ${roll}°)`,()=>{
 const s=fixture();s.parts[0].roll=roll;s.parts.push({id:2,k:'struct',form:'box',c:[100,30,0],s:[60,40,20]});s.nextId=3;C.refreshPlacementGeometry(s);s.fits.push({id:9,k:'pd',p:[100,40,0],n:[0,1,0],a:2,ped:.3});C.remount(s);const f=s.fits[0];
 const r=C.removeParts(s,[2]);assert.ok(r.reparented.some(q=>q.list==='fits'&&q.fitId===9));assert.equal(f.float,false);assert.ok(f.p[1]<25,'it moved down');
 C.refreshPlacementGeometry(s);C.remount(s,{keepFitPose:true});assert.equal(f.float,false,'and stays supported after a reload remount');
});
test('deleting a structure drops a fitting onto the procedural hull below it',()=>{
 const s=C.newShip({L:600,W:400,H:120,plan:'rect',sec:'rect'},'hull');s.parts=[{id:1,k:'struct',form:'box',c:[300,130,0],s:[40,40,20]}];s.fits=[];s.nextId=2;s.detail=0;C.refreshPlacementGeometry(s);
 s.fits.push({id:5,k:'pd',p:[300,140,0],n:[0,1,0],a:2,ped:.3});C.remount(s);C.removeParts(s,[1]);const f=s.fits[0];assert.equal(f.float,false);near(f.p[1],C.rayEnv(s,[300,500,0],[0,-1,0],{}).p[1],1e-6);
});
test('the drop reach is the depth of the structure the fitting stood on, not of other structures deleted with it; a floating fitting keeps no host',()=>{
 for(const bulk of [false,true]){const s=fixture();s.parts[0].c=[200,10,0];s.parts[0].s=[100,160,20];s.parts.push({id:2,k:'struct',form:'box',c:[80,21,20],s:[20,12,2]},{id:4,k:'struct',form:'box',c:[80,-60,20],s:[40,40,10]},{id:3,k:'struct',form:'box',c:[260,10,80],s:[20,20,200]});s.nextId=5;C.refreshPlacementGeometry(s);
  s.fits.push({id:9,k:'pd',p:[80,22,20],n:[0,1,0],a:2,ped:.3,host:2});C.remount(s);C.removeParts(s,bulk?[2,3]:[2]);const f=s.fits[0];assert.deepEqual(r3(f.p),[80,22,20]);assert.equal(f.float,true);assert.equal(f.host,undefined,'no dangling host id');}
});
test('mirroring a ship launcher flips its tilt once (n and tilt agree)',()=>{
 const t=C.norm([0,1,.3]),m=C.assemblyMirrorFit({id:1,k:'shipMsl',p:[10,5,8],n:t.slice(),tilt:t.slice(),a:2});assert.ok(m.tilt[2]<0);assert.deepEqual(r3(m.tilt),r3(m.n));
});

// Physics review (2026-11-13): user-placed (anchored) weapons drop like any other onto a sloped structure or the hull.
{
 const place=(S,host,hitPart,k,x)=>{const top=C.rayPart([x,500,0],[0,-1,0],hitPart);const r=C.solveFitPlacement(S,{id:-1,k,p:[0,0,0],n:[0,1,0],a:2,ped:.3},{mode:'direct',hostId:host,hit:{p:Array.from(top.p),n:Array.from(C.norm(top.n))},geometryRevision:0,parentGeometryRevision:0});assert.equal(r.ok,true,r.error);return C.acceptFitPlacementResult(S,r);};
 for(const roll of [0,12])for(const k of ['pd','triple70'])test(`a user-placed ${k} drops onto a structure rolled ${roll}° when the one under it is deleted`,()=>{
  const s=C.newShip({L:300,W:200,H:100,assembly:true},'a');s.parts=[{id:1,k:'struct',form:'box',c:[100,10,0],s:[200,160,20],roll},{id:2,k:'struct',form:'box',c:[100,30,0],s:[60,40,20]}];s.fits=[];s.links=[];s.armor={hull:0,cit:0};s.nextId=10;s.detail=0;
  const S=C.deserialize(JSON.parse(JSON.stringify(C.serialize(s))));C.refreshPlacementGeometry(S);place(S,2,S.parts[1],k,100);const r=C.removeParts(S,[2]),g=S.fits[0];
  assert.ok(r.reparented.some(q=>q.list==='fits'),'dropped');assert.equal(g.float,false);assert.equal(g.host,1);assert.ok(g.p[1]<21,'landed on the lower structure');
  C.refreshPlacementGeometry(S);C.remount(S,{keepFitPose:true});assert.equal(S.fits[0].float,false,'still supported after a load remount');});
 for(const k of ['pd','triple70'])test(`a user-placed ${k} drops onto the procedural hull as an ordinary hull fitting`,()=>{
  const s=C.newShip({L:600,W:400,H:120,plan:'rect',sec:'rect'},'hull');s.parts=[{id:1,k:'struct',form:'box',c:[300,130,0],s:[40,40,20]}];s.fits=[];s.nextId=2;s.detail=0;
  const S=C.deserialize(JSON.parse(JSON.stringify(C.serialize(s))));C.refreshPlacementGeometry(S);place(S,1,S.parts[0],k,300);C.removeParts(S,[1]);const g=S.fits[0];
  assert.equal(g.float,false);near(g.p[1],120,1e-6);assert.equal(g.placement,undefined);C.remount(S,{keepFitPose:true});assert.equal(S.fits[0].float,false);});
}
