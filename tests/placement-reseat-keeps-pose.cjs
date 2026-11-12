// A re-solve without a new tap or drag keeps the user's pose (user report 2026-11-12: 「減り込ませて設置した
// 構造物が何故か勝手に減り込まない位置に動かされる」). Seating on the surface (tilt reset, vertical yaw, a
// legacy-fit bottom put flush on the skin, a surface part aligned to the tangent plane) belongs only to an
// explicit placement. A child sunk into the hull stays sunk, with its roll, when the hull is resized in an
// unrelated direction, cut elsewhere, or the design is reloaded. docs/design-placement-v1.2.md
// 「再計算は姿勢を保つ」.
const assert=require('node:assert/strict'),path=require('node:path'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'));
const reload=s=>C.deserialize(JSON.parse(C.publicJSON(C.serialize(s))));
const near=(a,b,label,eps=1e-6)=>{assert.equal(a.length,b.length,label);a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<=eps,`${label}: [${a}] vs [${b}]`));};
// Place a 16 x 8 x 6 box sunk into the deck (x 95, z = z0, bottom `depth` below the deck) in `mode`. A surface
// part is aligned on its first solve, so it is then sunk by editing its position (a warm, kept-transform re-solve,
// as the 移動 controls do). Optionally roll it with the 左右の傾き control (also a warm re-solve).
function sunk(mode,{contactFit='cut',depth=1,roll=0,z0=0}={}){
 const ship=C.newShip({L:200,W:32,H:32,plan:'cigar',sec:'ellipse'},'sunk '+mode);ship.fits=[];C.ensurePrimaryHull(ship);const hull=ship.parts[0];
 const raw=C.rayPart([95,500,z0],[0,-1,0],hull),hit={p:raw.p,n:C.norm(raw.n)},c=[hit.p[0],hit.p[1]+3-depth,hit.p[2]];
 const request={mode,parentStructureId:hull.id,hostId:hull.id,hit,position:c,placementModelVersion:C.PLACEMENT_MODEL_VERSION,geometryRevision:1};if(mode!=='surface')request.contactFit=contactFit;
 const d=C.preparePlacementDraft(ship,{id:ship.nextId,k:'struct',form:'box',c,s:[16,8,6],yaw:0,pitch:0,roll:0,offsetX:0,offsetZ:0},request);assert.equal(d.ok,true,d.error);
 ship.parts.push(d.part);ship.nextId++;let r=C.refreshPlacementGeometry(ship);assert.equal(r.ok,true,JSON.stringify(r.failed));
 const box=ship.parts.at(-1);if(mode==='surface'||roll){if(mode==='surface')box.c=[box.c[0],hit.p[1]+3-depth,box.c[2]];if(roll)box.roll=roll;ship._cache=null;r=C.refreshPlacementGeometry(ship);assert.equal(r.ok,true,mode+' sunk: '+JSON.stringify(r.failed));}
 assert.ok(box.c[1]-3<hit.p[1]-depth+1e-6,mode+': the bottom is below the deck');return {ship,id:box.id,deck:hit.p[1]};
}
const pose=(s,id)=>{const p=s.parts.find(q=>q.id===id);return {c:p.c.slice(),pitch:p.pitch||0,roll:p.roll||0,yaw:p.yaw||0,normal:p.surfaceNormal?.slice()||null,error:p._placementError||null};};
function checkSteps(label,{ship,id}){
 const before=pose(ship,id),same=(s,step)=>{const now=pose(s,id);assert.equal(now.error,null,`${label} ${step}: ${now.error}`);near(now.c,before.c,`${label} ${step}: position`);for(const k of ['pitch','roll','yaw'])assert.ok(Math.abs(now[k]-before[k])<1e-9,`${label} ${step}: ${k} ${now[k]} vs ${before[k]}`);if(before.normal)near(now.normal,before.normal,`${label} ${step}: surface normal`,1e-9);};
 let s=reload(ship);same(s,'reload');
 // The hull is widened (W 32 -> 36): the deck at z = 0 does not move.
 C.setHullStructureDimensions(s,s.parts[0],[200,36,32]);s._cache=null;C.refreshPlacementGeometry(s);same(s,'hull widened');
 // A hull-only cut far away (bow, x 10..30).
 C.hullOwnSolidCut(s,s.parts[0],{id:s.nextId++,shape:'box',c:[20,16,0],s:[20,40,40],rotation:[0,0,0],mirror:false,structures:false});s._cache=null;C.refreshPlacementGeometry(s);same(s,'hull cut elsewhere');
 s=reload(s);same(s,'reload after the edits');
}
test('a legacy-fit child sunk 1 m stays sunk (no flush re-seat) through reload, hull resize and a cut elsewhere',()=>checkSteps('legacy-fit',sunk('horizontal',{contactFit:'legacy-fit'})));
test('a cut-fit child sunk 1 m stays sunk through reload, hull resize and a cut elsewhere',()=>checkSteps('cut',sunk('horizontal')));
test('a surface-mode child sunk 1 m stays sunk (no tangent-plane re-seat) through reload, hull resize and a cut elsewhere',()=>checkSteps('surface',sunk('surface')));
test('roll -8 / +8 on sunk children is kept through reload, hull resize and a cut elsewhere',()=>{
 // Mirrored, off the centreline: widening the hull moves its skin, not the children (world pose kept).
 checkSteps('roll -8',sunk('horizontal',{roll:-8,z0:-2}));checkSteps('roll +8',sunk('horizontal',{roll:8,z0:2}));
});

// Children do not follow their parent (user decision 2026-11-12: parts are moved together by multi-selection).
// A child sunk into a structure keeps its world pose when that structure is moved or turned; once the parent no
// longer touches it, it stays where it is and is reported (contact failure, red), never moved.
function stack(){
 const ship=C.newShip({L:200,W:32,H:32,plan:'cigar',sec:'ellipse'},'stack');ship.fits=[];C.ensurePrimaryHull(ship);const hull=ship.parts[0];
 const put=(parent,x,s,depth,label)=>{const raw=C.rayPart([x,500,0],[0,-1,0],parent),hit={p:raw.p,n:C.norm(raw.n)},c=[hit.p[0],hit.p[1]+s[2]/2-depth,hit.p[2]];
  const d=C.preparePlacementDraft(ship,{id:ship.nextId,k:'struct',form:'box',label,c,s,yaw:0,pitch:0,roll:0,offsetX:0,offsetZ:0},{mode:'horizontal',parentStructureId:parent.id,hostId:parent.id,hit,contactFit:'cut',position:c,placementModelVersion:C.PLACEMENT_MODEL_VERSION,geometryRevision:1});
  assert.equal(d.ok,true,d.error);ship.parts.push(d.part);ship.nextId++;const r=C.refreshPlacementGeometry(ship);assert.equal(r.ok,true,label+': '+JSON.stringify(r.failed));return ship.parts.at(-1);};
 const A=put(hull,95,[40,20,6],1,'A'),B=put(A,95,[10,6,4],.5,'B');return {ship,A:A.id,B:B.id};
}
const red=(s,id)=>{const S={warnings:[]};C.groundingStats(s,S);return S.ungrounded.parts.includes(id);};
test('a child keeps its world pose when its parent is moved or turned, and stays connected while they still touch',()=>{
 const {ship,A,B}=stack(),before=pose(ship,B),a=ship.parts.find(p=>p.id===A);
 a.c=[a.c[0]+3,a.c[1],a.c[2]];ship._cache=null;let r=C.refreshPlacementGeometry(ship);
 let now=pose(ship,B);near(now.c,before.c,'A moved 3 m: B not carried');assert.equal(now.error,null,'B still touches A: '+JSON.stringify(r.failed));assert.equal(red(ship,B),false);
 a.yaw=10;ship._cache=null;r=C.refreshPlacementGeometry(ship);now=pose(ship,B);near(now.c,before.c,'A turned 10°: B not carried');assert.ok(Math.abs(now.yaw-before.yaw)<1e-9,'B yaw kept');
 const L=reload(ship);near(pose(L,B).c,before.c,'reload');
});
test('a child whose parent moves away stays where it is and is reported, never moved',()=>{
 // The primary hull is moved 40 m up, away from a box sunk 1 m into its deck. (Moving structure A 40 m along
 // the deck is limited by the move constraint placementConstrainTranslation, so the hull is moved instead.)
 const {ship,id}=sunk('horizontal'),before=pose(ship,id),hull=ship.parts[0];
 hull.c=[hull.c[0],hull.c[1]+40,hull.c[2]];ship._cache=null;const r=C.refreshPlacementGeometry(ship);
 const now=pose(ship,id);near(now.c,before.c,'the child stays where it was');for(const k of ['pitch','roll','yaw'])assert.equal(now[k],before[k],k);
 assert.ok(r.failed.some(f=>f.partId===id),'the child is reported: '+JSON.stringify(r.failed));assert.equal(red(ship,id),true,'red contact warning');
 const L=reload(ship);near(pose(L,id).c,before.c,'reload: still not moved');assert.equal(red(L,id),true,'reload: still reported');
});
