// A shot that gets through surface armour is recorded for the battle X-ray
// replay (u.hitLog, read by hitcamDraw / voyHitText in js/app.js) and handed
// to ctx.hit, the same as a penetration of the box armour zones. Before this,
// combatResolve's surface path ran combatPenetrate without a record, so ships
// with surface armour (every current example) never produced a replay.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});const C=vm.runInContext('Core',cx);
function fixture(thickness){const s=C.newShip({L:240,W:120,H:60,plan:'rect',sec:'rect'},'Penetration record');s.parts=[{id:1,k:'gen',c:[100,20,0],d:10}];s.fits=[];s.nextId=2;C.enableSurfaceMode(s,true);for(const p of C.surfacePatches(s))C.setSurfaceConfig(s,p.id,{armor:{thickness}});return s;}
function unit(s){const S=C.computeStats(s),p=C.fleetProfile(S,s.name,s),u=C.fleetUnit('target','target',p,0);u.pos=[0,0,0];u.yaw=0;return u;}
function topPoints(u,n,any=false){return u.p.surface.patches.filter(q=>q.exposed&&(any||q.normal[1]>.9)).slice(0,n).map(q=>q.center.slice());}
function shoot(u,points,E){const o=C.combatIncoming();o.direct=E*points.length;o.by.shooter=E*points.length;o.face[4]=1;o.hits=points.map(point=>({point,direct:E}));const calls=[];
 const ctx={time:12.34,damage:1,rand:()=>.5,ev(){},out(){},sunk(){},hit:(v,rec)=>calls.push([v,rec])};C.combatResolve(ctx,u,o,.25,C.fleetSystems(u));return calls;}

test('a shot through surface armour leaves a replay record and calls ctx.hit',()=>{
 const u=unit(fixture(0)),[point]=topPoints(u,1);assert.ok(point,'an exposed top patch');assert.ok(u.p.surface.patches.length>0);assert.equal(u.hitLog.length,0);
 const Q=Math.max(1,u.p.hp*C.COMBAT.quantum),calls=shoot(u,[point],Q*4);
 assert.equal(u.hitLog.length,1,'one penetration recorded');assert.equal(calls.length,1,'ctx.hit called once');
 const rec=u.hitLog[0];assert.equal(calls[0][0],u);assert.equal(calls[0][1],rec);
 // What hitcamDraw / voyHitText / voyClock read.
 assert.equal(rec.face,4,'top face');assert.ok(Number.isInteger(rec.sec)&&rec.sec>=0&&rec.sec<u.sec.length);assert.ok(Array.isArray(rec.path));
 assert.equal(rec.t,12.3);assert.equal(rec.src,'shooter');assert.equal(rec.thick,0);assert.ok(Number.isFinite(rec.integrity)&&rec.integrity>=0&&rec.integrity<=1);
 assert.equal(rec.patch,u.surfaceLastHit.patch);assert.ok(rec.E>0);
});

test('a shot stopped by surface armour leaves no record',()=>{
 const u=unit(fixture(8)),[point]=topPoints(u,1),calls=shoot(u,[point],1);
 assert.equal(u.surfaceLastHit?.handled,true);assert.equal(u.surfaceLastHit.remaining,0,'absorbed');assert.equal(u.hitLog.length,0);assert.equal(calls.length,0);
});

test('at most three penetrations are recorded per resolve and the log keeps the last 24',()=>{
 const u=unit(fixture(0)),pts=topPoints(u,5,true),Q=Math.max(1,u.p.hp*C.COMBAT.quantum);assert.equal(pts.length,5);
 assert.equal(shoot(u,pts,Q).length,3);assert.equal(u.hitLog.length,3);
 for(let i=0;i<10;i++)shoot(u,pts,Q);assert.equal(u.hitLog.length,24);
});

// Box-armour path (no surface patches): the same record, thick from the zone (Z.T).
function boxUnit(){const s=C.newShip({L:240,W:120,H:60,plan:'rect',sec:'rect'},'Box armour');s.parts=[{id:1,k:'gen',c:[100,20,0],d:10},{id:2,k:'gen',c:[120,20,0],d:10},{id:3,k:'gen',c:[140,20,0],d:10}];s.fits=[];s.nextId=4;return unit(s);}
test('a box-armour penetration records thick from the zone, at most three per resolve, one ctx.hit each',()=>{
 const u=boxUnit();assert.ok(!(u.p.surface?.patches?.length),'fixture has no surface patches');
 const Q=Math.max(1,u.p.hp*C.COMBAT.quantum),o=C.combatIncoming();o.direct=Q*200;o.by.shooter=Q*200;o.face[4]=1;o.aim={auto:1};
 const calls=[],ctx={time:3.21,damage:1,rand:()=>.5,ev(){},out(){},sunk(){},hit:(v,rec)=>calls.push([v,rec])};
 C.combatResolve(ctx,u,o,.25,C.fleetSystems(u));
 assert.equal(u.hitLog.length,3,'capped at three records per resolve');assert.equal(calls.length,3,'ctx.hit once per record');
 const Z=C.combatZones(u.p,u.sec.length);
 u.hitLog.forEach((rec,n)=>{assert.equal(calls[n][1],rec);assert.equal(calls[n][0],u);const z=rec.sec*6+rec.face;assert.equal(rec.thick,+Z.T[z].toFixed(2),'thick is the zone plate');assert.ok(rec.integrity>=0&&rec.integrity<=1);assert.equal(rec.t,3.2);assert.equal(rec.src,'shooter');assert.equal(rec.patch,undefined);});
 assert.ok(Z.T.some(t=>t>0),'zones carry a plate thickness');
});

test('a surface remnant too small to reach a module is not recorded',()=>{
 const u=unit(fixture(0)),[point]=topPoints(u,1),Q=Math.max(1,u.p.hp*C.COMBAT.quantum),calls=shoot(u,[point],Q*.01);
 assert.equal(u.surfaceLastHit?.handled,true);assert.ok(u.surfaceLastHit.remaining>0,'it did get through');assert.equal(u.hitLog.length,0);assert.equal(calls.length,0);
});
