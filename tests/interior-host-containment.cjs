// Interior equipment has no parent structure (user decision 2026-11-11). It is anchored to the primary
// hull and is valid when its body lies inside the union of the primary hull and the structures attached
// to it, without overlapping other equipment. The tapped face only locates it.
// Regression: report 2026-11-11 (アマンガ): a reactor lying wholly inside primary hull #1 was refused
// because the tapped side structure #2 had been recorded as its host.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(root);
const saved=()=>JSON.parse(fs.readFileSync(path.join(__dirname,'helpers/interior-host-amanga.json'),'utf8'));
const reactor=s=>s.parts.find(p=>p.id===7);

test('the reported design loads with its reactor anchored to the primary hull, valid and producing power',()=>{
 const raw=saved(),before=raw.parts.find(p=>p.id===7);assert.equal(before.placement.hostId,2);assert.equal(before.placement.validationFailed,true);
 // The reduced copy has no reactant supply; add an ordinary supply room in the hull so output is not zero for that reason.
 raw.parts.push({id:8,k:'pump',c:[150,35,0],room:[20,10,10]});raw.nextId=9;
 const s=C.deserialize(raw),q=reactor(s);
 assert.deepEqual(Array.from(q.c),before.c,'the world position is unchanged');assert.equal(q.placement.hostId,1,'anchored to primary hull #1');assert.equal(q.placement.hostSurfaceId,undefined);
 assert.ok(!q.placement.validationFailed&&!q.placement.repairRequired&&!q.placement.pendingGeometry,JSON.stringify(q.placement));
 assert.equal(q._placementError,undefined);assert.equal(q._interiorPlacementError,undefined);assert.equal(C.placementFailureRecord(q),null);
 const S=C.computeStats(s);assert.equal(S.invalidReactorIds,undefined);assert.ok(S.Vgen>0);assert.ok(S.power>0,'power '+S.power);
 assert.ok(!S.warnings.some(w=>/反応炉 #7|配置の計算|配置先/.test(w.text)),S.warnings.map(w=>w.text).join('\n'));
 const again=C.deserialize(JSON.parse(JSON.stringify(C.serialize(s)))),r=reactor(again);assert.equal(r.placement.hostId,1);assert.deepEqual(Array.from(r.c),before.c);assert.ok(!r.placement.validationFailed);
});

test('a reactor that really protrudes from the hull still fails with the existing reason',()=>{
 const s=C.deserialize(saved());
 for(const c of [[53,68,0],[53,43,-30],[400,40,0]]){const r=C.solvePlacement(s,{id:20,k:'gen',c,d:35},{mode:'direct',hostId:2});assert.equal(r.ok,false,String(c));assert.equal(r.code,'fixed-outside');assert.ok(['host-boundary','center-outside','host-outside'].includes(r.detail.reason),r.error);}
});

test('a reactor overlapping fixed equipment still fails as an equipment overlap',()=>{
 const s=C.deserialize(saved()),r=C.solvePlacement(s,{id:20,k:'gen',c:C.add(reactor(s).c,[10,0,0]),d:35},{mode:'direct'});
 assert.equal(r.ok,false);assert.equal(r.code,'fixed-outside');assert.equal(r.detail.reason,'equipment-overlap');assert.deepEqual(Array.from(r.detail.partIds),[7]);
});

function stacked(){
 const s=C.newShip({L:300,W:120,H:60,assembly:true},'Interior union');s.parts=[{id:1,k:'struct',form:'box',c:[150,20,0],s:[300,100,40]}];s.fits=[];s.nextId=2;
 const hit=C.rayPart([60,5000,0],[0,-1,0],s.parts[0]),pv={id:2,k:'struct',form:'box',c:[hit.p[0],hit.p[1]+15,hit.p[2]],s:[120,60,50]};
 const d=C.preparePlacementDraft(s,pv,{mode:'horizontal',parentStructureId:1,hostId:1,hit:{p:hit.p,n:C.norm(hit.n)},contactFit:'cut',position:pv.c.slice(),placementModelVersion:C.PLACEMENT_MODEL_VERSION});assert.equal(d.ok,true,d.error);
 s.parts.push(d.part);s.nextId=3;C.refreshPlacementGeometry(s);assert.equal(s.parts[1]._placementError,undefined);return s;
}

test('equipment spanning the primary hull and an attached structure is valid inside their union',()=>{
 const s=stacked(),ok=C.solvePlacement(s,{id:3,k:'gen',c:[60,40,0],d:10},{mode:'direct',hostId:2});assert.equal(ok.ok,true,ok.error);assert.equal(ok.part.placement.hostId,1);
 const out=C.solvePlacement(s,{id:3,k:'gen',c:[60,40,28],d:10},{mode:'direct'});assert.equal(out.ok,false,'it crosses the attached structure side above the hull deck');assert.equal(out.detail.reason,'host-boundary');
});

test('moving a structure or copying equipment does not drag or re-parent interior equipment',()=>{
 const s=stacked(),r=C.solvePlacement(s,{id:3,k:'gen',c:[200,20,0],d:10},{mode:'direct',hostId:2});assert.equal(r.ok,true,r.error);assert.equal(r.part.placement.hostId,1);s.parts.push(r.part);s.nextId=4;C.refreshPlacementGeometry(s);
 const snapshot=JSON.stringify(C.serialize(s)),q=()=>s.parts.find(p=>p.id===3);
 s.parts[1].c=C.add(s.parts[1].c,[-20,0,0]);s.parts[1].placement.pendingGeometry=true;const moved=C.refreshPlacementGeometry(s);assert.deepEqual(Array.from(moved.failed),[]);C.syncCompartments(s);
 assert.deepEqual(Array.from(q().c),[200,20,0],'the reactor stays where it was placed');assert.equal(q().placement.hostId,1);assert.equal(q()._interiorPlacementError,undefined);
 const back=C.deserialize(JSON.parse(snapshot)),b=back.parts.find(p=>p.id===3);assert.deepEqual(Array.from(b.c),[200,20,0]);assert.equal(b.placement.hostId,1);
 const copy=JSON.parse(C.publicJSON(q()));C.remapPlacementCopy(copy,new Map([[1,9],[2,10]]));assert.equal(copy.placement.hostId,1,'a copy keeps the primary hull anchor and is re-anchored when validated');
});

test('a pending interior part listed before the pending structure that contains it resolves after that structure',()=>{
 const s=C.newShip({L:300,W:120,H:60,assembly:true},'Interior order');s.parts=[{id:1,k:'struct',form:'box',c:[150,20,0],s:[300,100,40]}];s.fits=[];s.nextId=2;
 const hit=C.rayPart([60,5000,0],[0,-1,0],s.parts[0]),pv={id:2,k:'struct',form:'box',c:[hit.p[0],hit.p[1]+15,hit.p[2]],s:[120,60,50]};
 const child=C.preparePlacementDraft(s,pv,{mode:'horizontal',parentStructureId:1,hostId:1,hit:{p:hit.p,n:C.norm(hit.n)},contactFit:'cut',position:pv.c.slice(),placementModelVersion:C.PLACEMENT_MODEL_VERSION});assert.equal(child.ok,true,child.error);
 const gen=C.preparePlacementDraft(s,{id:3,k:'gen',c:[60,62,0],d:10},{mode:'direct',hostId:1,placementModelVersion:C.PLACEMENT_MODEL_VERSION});assert.equal(gen.ok,true,gen.error);
 assert.equal(child.part.placement.pendingGeometry,true);assert.equal(gen.part.placement.pendingGeometry,true);
 s.parts.push(gen.part,child.part);s.nextId=4;const r=C.refreshPlacementGeometry(s);
 assert.deepEqual(Array.from(r.failed),[],JSON.stringify(r.failed));const q=s.parts.find(p=>p.id===3);assert.ok(!q.placement.validationFailed&&!q.placement.pendingGeometry);
});

test('deleting a structure keeps the equipment inside it, flagged as outside; Undo and Redo restore both states',()=>{
 const s=stacked(),r=C.solvePlacement(s,{id:3,k:'gen',c:[60,62,0],d:10},{mode:'direct'});assert.equal(r.ok,true,r.error);s.parts.push(r.part);s.nextId=4;C.refreshPlacementGeometry(s);C.syncCompartments(s);
 const before=JSON.stringify(C.serialize(s)),del=C.removeParts(s,[2]);assert.deepEqual(Array.from(del.removed),[2]);C.syncCompartments(s);
 const q=s.parts.find(p=>p.id===3);assert.ok(q,'the equipment is not deleted');assert.equal(q._interiorPlacementError?.code,'fixed-outside');assert.equal(C.computeStats(s).invalidReactorIds?.[0],3);
 const after=JSON.stringify(C.serialize(s));
 const undo=C.deserialize(JSON.parse(before));C.syncCompartments(undo);assert.equal(undo.parts.length,3);assert.equal(undo.parts.find(p=>p.id===3)._interiorPlacementError,undefined);
 const redo=C.deserialize(JSON.parse(after));C.syncCompartments(redo);assert.equal(redo.parts.find(p=>p.id===2),undefined);assert.equal(redo.parts.find(p=>p.id===3)._interiorPlacementError?.code,'fixed-outside');
});

test('pasted interior equipment is anchored to the target ship primary hull, never a foreign id',()=>{
 const source=stacked(),r=C.solvePlacement(source,{id:3,k:'gen',c:[200,20,0],d:10},{mode:'direct'});assert.equal(r.ok,true,r.error);
 const copy=JSON.parse(C.publicJSON(r.part));copy.placement.hostId=77;copy.id=12;C.remapPlacementCopy(copy,new Map([[1,10],[2,11]]),{detachRoots:true,interiorAnchor:C.interiorAnchorHostId(source)});assert.equal(copy.placement.hostId,1);
 const target=C.newShip({L:100,W:100,H:100,assembly:true},'Paste target');target.parts=[{id:5,k:'struct',form:'box',c:[0,0,0],s:[40,40,40]}];target.fits=[];target.nextId=13;
 const other=JSON.parse(C.publicJSON(r.part));other.id=12;C.remapPlacementCopy(other,new Map(),{detachRoots:true,interiorAnchor:C.interiorAnchorHostId(target)});assert.equal(other.placement.hostId,5);
});

test('a refusal saved while already anchored to the primary hull is re-checked once on load',()=>{
 const raw=saved(),q=raw.parts.find(p=>p.id===7);q.placement.hostId=1;delete q.placement.hostSurfaceId;assert.equal(q.placement.validationFailed,true);
 const s=C.deserialize(raw),p=reactor(s);assert.ok(!p.placement.validationFailed&&!p.placement.repairRequired,JSON.stringify(p.placement));assert.equal(p.placement.hostId,1);
 const out=saved(),o=out.parts.find(p=>p.id===7);o.c=[53,68,0];o.placement.requestedGeometry.c=[53,68,0];o.placement.hostId=1;
 const t=C.deserialize(out);assert.equal(reactor(t).placement.validationFailed,true,'a real protrusion is refused again');
});

// Runs fully once merged with the curved-hull horizontal placement fix (claude/kuat-shipwright-curved-placement-u9sok1);
// without it the side structure itself is refused (surface-missing) and the case is skipped with that reason.
test('equipment spanning a curved primary hull and a structure cut to its side is valid inside their union',t=>{
 const ship=C.newShip({L:1100,W:300,H:300,plan:'cigar',sec:'ellipse'},'new');ship.fits=[];C.ensurePrimaryHull(ship);const hull=ship.parts.find(p=>C.isShapePart(p));
 const hit=C.rayPart([440,hull.c[1],1000],[0,0,-1],hull);assert.ok(hit);const n=C.norm(hit.n),size=[88,75,60],c=C.add(hit.p,[0,size[2]*.3,0]);
 const draft=C.preparePlacementDraft(ship,{id:ship.nextId,k:'struct',form:'box',c,s:size},{mode:'horizontal',parentStructureId:hull.id,hostId:hull.id,hit:{p:hit.p,n},contactFit:'cut',position:c.slice(),placementModelVersion:C.PLACEMENT_MODEL_VERSION});
 assert.equal(draft.ok,true,draft.error);ship.parts.push(draft.part);ship.nextId++;C.refreshPlacementGeometry(ship);const side=ship.parts.at(-1);
 if(side._placementError==='surface-missing')return t.skip('the side structure is refused without the curved-hull placement fix: '+side._placementError);assert.equal(side._placementError,undefined);
 // Centre on the hull skin: half the body is in the hull and half in the side structure.
 const centre=C.add(hit.p,C.mul(n,0)),body={id:ship.nextId,k:'gen',c:centre,d:12};
 assert.ok(C.inPart(hull,C.add(centre,[0,0,-6.5]))&&C.inPart(side,C.add(centre,[0,0,6.5])),'the body really spans both');
 const r=C.solvePlacement(ship,body,{mode:'direct'});assert.equal(r.ok,true,r.error);assert.equal(r.part.placement.hostId,hull.id);
 const out=C.solvePlacement(ship,{...body,c:C.add(centre,[0,size[2]*.5+4,0])},{mode:'direct'});assert.equal(out.ok,false,'above the side structure roof it sticks out');
});
