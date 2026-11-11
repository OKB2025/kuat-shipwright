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
