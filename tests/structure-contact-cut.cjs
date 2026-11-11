const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{test}=require('node:test');
const root=path.resolve(__dirname,'..'),{C}=require('../scripts/update-ship-examples.cjs').loadRuntime(root),plain=q=>JSON.parse(C.publicJSON(q));
const near=(a,b,epsilon=2e-5)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=epsilon,`${a} != ${b}`);
function gable(reflect=false){
 const profile=[[-10,-10],[10,-10],[10,0],[0,10],[-10,0]],world=[-5,5].flatMap(z=>profile.map(([x,y])=>[x,reflect?-y:y,z])),inside=[0,reflect?2:-2,0],faces=[[0,1,2,3,4],[5,6,7,8,9],...profile.map((_,i)=>[i,(i+1)%5,(i+1)%5+5,i+5])];
 const f=faces.map(face=>{const P=face.map(i=>world[i]),n=C.cross(C.sub(P[1],P[0]),C.sub(P[2],P[0])),center=C.mul(P.reduce(C.add,[0,0,0]),1/P.length);return C.dot(n,C.sub(center,inside))>0?face:face.slice().reverse();});
 return{id:1,k:'struct',form:'mesh',c:[0,0,0],s:[20,10,20],mesh:{v:world.map(p=>[p[0]/20,p[1]/20,p[2]/10]),f}};
}
function fixture(parent=gable()){const ship=C.newShip({L:200,W:200,H:100,assembly:true},'Child contact cut');ship.parts=[parent];ship.fits=[];ship.hatches=[];ship.links=[];ship.nextId=2;return ship;}
function ringParent(){
 const outer=[[-20,-20],[20,-20],[20,20],[-20,20]],inner=[[-5,-5],[5,-5],[5,5],[-5,5]],profile=outer.concat(inner),world=[-5,0].flatMap(y=>profile.map(([x,z])=>[x,y,z])),f=[];
 const face=(ids,desired)=>{const P=ids.map(i=>world[i]),normal=C.cross(C.sub(P[1],P[0]),C.sub(P[2],P[0]));f.push(C.dot(normal,desired)>0?ids:ids.slice().reverse());};
 for(let i=0;i<4;i++){const j=(i+1)%4,ox=(outer[i][0]+outer[j][0])/2,oz=(outer[i][1]+outer[j][1])/2,ix=(inner[i][0]+inner[j][0])/2,iz=(inner[i][1]+inner[j][1])/2;face([i,j,j+4,i+4],[0,-1,0]);face([i+8,j+8,j+12,i+12],[0,1,0]);face([i,j,j+8,i+8],[ox,0,oz]);face([i+4,j+4,j+12,i+12],[-ix,0,-iz]);}
 return{id:1,k:'struct',form:'mesh',c:[0,-2.5,0],s:[40,40,5],mesh:{v:world.map(p=>[p[0]/40,(p[1]+2.5)/5,p[2]/40]),f}};
}
const child=(c=[0,10,0],s=[20,10,20])=>({id:-1,k:'struct',form:'box',c:c.slice(),s:s.slice()});
function solve(ship,input=child(),options={}){const parent=ship.parts[0],hit=options.hit||C.rayPart([-5,100,0],[0,-1,0],parent);assert.ok(hit,'fixture must select the actual parent skin');return C.solvePlacement(ship,input,{mode:'horizontal',contactFit:'cut',position:input.c.slice(),parentStructureId:parent.id,hit,...options});}
function closedPositive(part){const T=C.structTriangles(part),vertices=new Map(),faces=[],edges=new Map();let signed=0;const id=p=>{const key=Array.from(p).map(v=>v.toFixed(7)).join(',');if(!vertices.has(key))vertices.set(key,vertices.size);return vertices.get(key);};
 for(let i=0;i<T.length;i+=9){const P=[0,3,6].map(j=>Array.from(T.slice(i+j,i+j+3))),face=P.map(id);assert.equal(new Set(face).size,3);assert.ok(C.len(C.cross(C.sub(P[1],P[0]),C.sub(P[2],P[0])))>1e-9);signed+=C.dot(P[0],C.cross(P[1],P[2]))/6;faces.push(face);for(let j=0;j<3;j++){const a=face[j],b=face[(j+1)%3],key=Math.min(a,b)+':'+Math.max(a,b);if(!edges.has(key))edges.set(key,[]);edges.get(key).push([a,b]);}}
 assert.ok(signed>0,'cut material keeps outward winding');near(signed,C.partVolume(part),.003);assert.equal(C.meshTopology(faces).closed,true);for(const e of edges.values()){assert.equal(e.length,2,'each effective edge is closed');assert.equal(e[0][0],e[1][1],'paired faces have opposite edge directions');}
}

test('a gabled parent cuts only the overlapping child material, retaining its authored roof and world pose',()=>{
 const ship=fixture(),input=child(),before=C.publicJSON(ship),source=C.publicJSON(input),r=solve(ship,input);assert.equal(r.ok,true,r.error);assert.equal(r.contact.connected,true);assert.equal(C.publicJSON(ship),before);assert.equal(C.publicJSON(input),source);
 assert.deepEqual(plain(r.part.c),[0,10,0]);assert.equal(r.part.placement.contactFit,'cut');assert.deepEqual(plain(r.part.placement.requestedGeometry.c),[0,10,0]);near(r.requestedVolume,4000);near(r.effectiveVolume,3000);closedPositive(r.part);
 for(const x of [-8,-4,0,4,8]){const top=C.rayPart([x,100,0],[0,-1,0],r.part),bottom=C.rayPart([x,-30,0],[0,1,0],r.part);assert.ok(top&&bottom);near(top.p[1],20);near(bottom.p[1],10-Math.abs(x));assert.equal(C.inPart(r.part,[x,10-Math.abs(x)-1,0]),false,'the blue overlap is actually removed');assert.equal(C.inPart(r.part,[x,11-Math.abs(x),0]),true);}
});

test('explicit world position wins over a catalogue input center without lifting the requested cut body',()=>{
 const ship=fixture(),input=child([30,40,50]),r=solve(ship,input,{position:[0,10,0]});assert.equal(r.ok,true,r.error);assert.deepEqual(plain(r.part.c),[0,10,0]);assert.deepEqual(plain(input.c),[30,40,50]);near(C.partVolume(r.part),3000);near(C.rayPart([0,100,0],[0,-1,0],r.part).p[1],20);
});

test('finite overhang keeps its requested bottom instead of adding a skirt down to a remote parent skin',()=>{
 const ship=fixture(),r=solve(ship,child([0,10,0],[40,10,20]));assert.equal(r.ok,true,r.error);near(r.requestedVolume,8000);near(r.effectiveVolume,7000);closedPositive(r.part);for(const x of [-15,15]){assert.equal(C.rayPart([x,100,0],[0,-1,0],ship.parts[0]),null);near(C.rayPart([x,-30,0],[0,1,0],r.part).p[1],0);near(C.rayPart([x,100,0],[0,-1,0],r.part).p[1],20);}
});

test('underside contact mirrors the same cut without changing the outer bottom or reversing material normals',()=>{
 const ship=fixture(gable(true)),input=child([0,-10,0]),hit=C.rayPart([-5,-100,0],[0,1,0],ship.parts[0]),r=solve(ship,input,{hit,contactSide:'top'});assert.equal(r.ok,true,r.error);assert.equal(r.part.placement.contactSide,'top');assert.deepEqual(plain(r.part.c),[0,-10,0]);near(C.partVolume(r.part),3000);near(C.rayPart([0,-100,0],[0,1,0],r.part).p[1],-20);near(C.rayPart([0,100,0],[0,-1,0],r.part).p[1],-10);closedPositive(r.part);
});

test('vertical contact cuts the parent-facing side while preserving the upright body and outward face',()=>{
 const parent={...gable(),pitch:-90},ship=fixture(parent),input=child([10,0,0]),hit=C.rayPart([100,-5,0],[-1,0,0],parent),before=C.publicJSON(parent),r=solve(ship,input,{mode:'vertical',contactSide:'aft',hit});assert.equal(r.ok,true,r.error);assert.equal(C.publicJSON(parent),before);assert.deepEqual(plain(r.part.c),[10,0,0]);near(C.partVolume(r.part),3000);const up=C.structFrame(r.part).up;near(up[0],0);near(up[1],1);near(up[2],0);near(C.rayPart([100,1,.1],[-1,0,0],r.part).p[0],20);near(C.rayPart([-100,1,.1],[1,0,0],r.part).p[0],9);closedPositive(r.part);
});

// Changed 2026-11-11 (user decision: any genuine overlap is a contact, in every
// placement mode). A parent ridge piercing the child's opposite skin is still
// never cut through the authored roof and the child is never moved above it,
// but the whole, uncut child now joins the parent by that real overlap (the
// structural union charges the shared volume once). Previously both inputs
// were rejected with minimum-thickness/geometry-volume. A body buried wholly
// inside the parent is still rejected atomically.
test('a parent penetrating the opposite skin keeps the whole child in place (joined by the overlap); a body buried in the parent is rejected atomically',()=>{
 const ship=fixture(),before=C.publicJSON(ship);
 {const input=child([0,4.5,0],[20,10,9]),source=C.publicJSON(input),r=solve(ship,input);assert.equal(r.ok,true,r.code);assert.equal(r.contact.overlap,true);near(C.partVolume(r.part),20*10*9);assert.deepEqual(plain(r.part.c),[0,4.5,0],'not moved above the ridge');assert.equal(C.publicJSON(ship),before);assert.equal(C.publicJSON(input),source);}
 {const input=child([0,-5,0],[5,5,5]),source=C.publicJSON(input),r=solve(ship,input);assert.equal(r.ok,false);assert.ok(['minimum-thickness','geometry-volume','contact-zero'].includes(r.code),r.code+': '+r.error);assert.equal(C.publicJSON(ship),before);assert.equal(C.publicJSON(input),source);}
});

test('cut contact is a saved source contract and regenerates the same closed material after v3 reload',()=>{
 const ship=fixture(),r=solve(ship);assert.equal(r.ok,true,r.error);const accepted=C.acceptPlacementResult(ship,r);assert.equal(accepted.ok,true,accepted.error);const source=plain(accepted.part.placement.requestedGeometry),id=accepted.part.id,saved=plain(C.serialize(ship));assert.equal(saved.v,3);const loaded=C.deserialize(saved),part=loaded.parts.find(p=>p.id===id);assert.ok(part);assert.equal(part.placement.contactFit,'cut');assert.deepEqual(plain(part.placement.requestedGeometry),source);assert.deepEqual(plain(part.c),[0,10,0]);near(C.partVolume(part),3000);assert.equal(C.placementDiagnostics(loaded).find(q=>q.partId===id).connected,true);closedPositive(part);
});

test('height editing grows the top from 40m to 60m while keeping the real cut contact fixed',()=>{
 const ship=fixture(),r=solve(ship,child([0,20,0],[20,10,40]));assert.equal(r.ok,true,r.error);const accepted=C.acceptPlacementResult(ship,r);assert.equal(accepted.ok,true,accepted.error);const part=accepted.part,before=C.publicJSON(ship.parts[0]);near(C.partVolume(part),7000);
 assert.equal(C.resizeStructureHeightAtContact(part,60),true);assert.deepEqual(plain(part.c),[0,30,0]);near(part.s[2],60);const refreshed=C.refreshPlacementGeometry(ship);assert.equal(refreshed.ok,true,JSON.stringify(refreshed.failed));assert.equal(C.publicJSON(ship.parts[0]),before);near(C.partVolume(part),11000);near(C.partVolume(part.placement.requestedGeometry),12000);
 for(const x of [-8,-4,0,4,8]){near(C.rayPart([x,100,0],[0,-1,0],part).p[1],60);near(C.rayPart([x,-30,0],[0,1,0],part).p[1],10-Math.abs(x));}closedPositive(part);
 const loaded=C.deserialize(plain(C.serialize(ship))),saved=loaded.parts.find(p=>p.id===part.id);assert.deepEqual(plain(saved.c),[0,30,0]);near(saved.s[2],60);near(C.partVolume(saved),11000);closedPositive(saved);
});

test('underside height editing grows downward while retaining the mirrored cut contact',()=>{
 const ship=fixture(gable(true)),hit=C.rayPart([-5,-100,0],[0,1,0],ship.parts[0]),r=solve(ship,child([0,-20,0],[20,10,40]),{hit,contactSide:'top'});assert.equal(r.ok,true,r.error);const accepted=C.acceptPlacementResult(ship,r);assert.equal(accepted.ok,true,accepted.error);const part=accepted.part,before=C.publicJSON(ship.parts[0]);near(C.partVolume(part),7000);
 assert.equal(C.resizeStructureHeightAtContact(part,60),true);assert.deepEqual(plain(part.c),[0,-30,0]);near(part.s[2],60);const refreshed=C.refreshPlacementGeometry(ship);assert.equal(refreshed.ok,true,JSON.stringify(refreshed.failed));assert.equal(C.publicJSON(ship.parts[0]),before);near(C.partVolume(part),11000);near(C.partVolume(part.placement.requestedGeometry),12000);
 for(const x of [-8,-4,0,4,8]){near(C.rayPart([x,-100,0],[0,1,0],part).p[1],-60);near(C.rayPart([x,30,0],[0,-1,0],part).p[1],-10+Math.abs(x));}closedPositive(part);
});

test('dependency refresh clamps a translation away from the parent to the last real contact',()=>{
 const ship=fixture(),r=solve(ship);assert.equal(r.ok,true,r.error);const accepted=C.acceptPlacementResult(ship,r);assert.equal(accepted.ok,true,accepted.error);const part=accepted.part,id=part.id,before=C.publicJSON(ship.parts[0]),size=plain(part.s);part.c=[0,100,0];
 const refreshed=C.refreshPlacementGeometry(ship);assert.equal(refreshed.ok,true,JSON.stringify(refreshed.failed));assert.equal(part.id,id);assert.equal(C.publicJSON(ship.parts[0]),before);assert.deepEqual(plain(part.s),size);near(part.c[0],0);near(part.c[2],0);assert.ok(part.c[1]<20&&part.c[1]>19.98,'a point-only apex contact must remain slightly inside the last valid contact boundary');assert.equal(C.placementDiagnostics(ship).find(q=>q.partId===id).connected,true);assert.deepEqual(plain(part.placement.requestedGeometry.c),plain(part.c));near(C.partVolume(part.placement.requestedGeometry),4000,.003);assert.ok(C.partVolume(part)>0&&C.partVolume(part)<=4000+.003);closedPositive(part);
 const loaded=C.deserialize(plain(C.serialize(ship))),saved=loaded.parts.find(p=>p.id===id);assert.deepEqual(plain(saved.c),plain(part.c));assert.deepEqual(plain(saved.s),size);near(C.partVolume(saved),C.partVolume(part));assert.equal(C.placementDiagnostics(loaded).find(q=>q.partId===id).connected,true);closedPositive(saved);
});

test('dependency refresh stops a lateral drag at the parent edge instead of leaving the child floating',()=>{
 const ship=fixture(),r=solve(ship);assert.equal(r.ok,true,r.error);const accepted=C.acceptPlacementResult(ship,r);assert.equal(accepted.ok,true,accepted.error);const part=accepted.part,id=part.id,before=C.publicJSON(ship.parts[0]),size=plain(part.s);part.c=[100,10,0];
 const refreshed=C.refreshPlacementGeometry(ship);assert.equal(refreshed.ok,true,JSON.stringify(refreshed.failed));assert.equal(part.id,id);assert.equal(C.publicJSON(ship.parts[0]),before);assert.deepEqual(plain(part.s),size);assert.ok(part.c[0]<20&&part.c[0]>19.98,'the finite child must stop before its final edge contact disappears: '+part.c[0]);near(part.c[1],10);near(part.c[2],0);assert.equal(C.placementDiagnostics(ship).find(q=>q.partId===id).connected,true);assert.deepEqual(plain(part.placement.requestedGeometry.c),plain(part.c));near(C.partVolume(part.placement.requestedGeometry),4000,.003);assert.ok(C.partVolume(part)>0&&C.partVolume(part)<=4000+.003);closedPositive(part);
 const loaded=C.deserialize(plain(C.serialize(ship))),saved=loaded.parts.find(p=>p.id===id);assert.deepEqual(plain(saved.c),plain(part.c));near(C.partVolume(saved),C.partVolume(part));assert.equal(C.placementDiagnostics(loaded).find(q=>q.partId===id).connected,true);
});

test('dependency refresh permits a deeper valid cut without lifting the child roof back up',()=>{
 const ship=fixture(),r=solve(ship);assert.equal(r.ok,true,r.error);const accepted=C.acceptPlacementResult(ship,r);assert.equal(accepted.ok,true,accepted.error);const part=accepted.part,id=part.id,before=C.publicJSON(ship.parts[0]),size=plain(part.s);part.c=[0,5,0];
 const refreshed=C.refreshPlacementGeometry(ship);assert.equal(refreshed.ok,true,JSON.stringify(refreshed.failed));assert.equal(part.id,id);assert.equal(C.publicJSON(ship.parts[0]),before);assert.deepEqual(plain(part.s),size);assert.deepEqual(plain(part.c),[0,5,0]);assert.deepEqual(plain(part.placement.requestedGeometry.c),[0,5,0]);near(C.partVolume(part.placement.requestedGeometry),4000,.003);near(C.partVolume(part),2000);assert.equal(C.placementDiagnostics(ship).find(q=>q.partId===id).connected,true);for(const x of [-8,-4,0,4,8]){near(C.rayPart([x,100,0],[0,-1,0],part).p[1],15);near(C.rayPart([x,-30,0],[0,1,0],part).p[1],10-Math.abs(x));}closedPositive(part);
 const loaded=C.deserialize(plain(C.serialize(ship))),saved=loaded.parts.find(p=>p.id===id);assert.deepEqual(plain(saved.c),[0,5,0]);near(C.partVolume(saved),2000);closedPositive(saved);
});

test('a translation stops at an opening instead of jumping across it to another valid contact',()=>{
 const parent=ringParent(),ship=fixture(parent),input=child([-10,4,0],[4,4,8]),hit=C.rayPart([-10,100,0],[0,-1,0],parent);near(C.partVolume(parent),7500);closedPositive(parent);const r=solve(ship,input,{hit});assert.equal(r.ok,true,r.error);const accepted=C.acceptPlacementResult(ship,r);assert.equal(accepted.ok,true,accepted.error);const part=accepted.part,before=C.publicJSON(parent),id=part.id;near(C.partVolume(part),128);
 // The destination is supported by the other side of the ring, but the
 // continuous drag first loses all contact over the 10m-wide opening.
 part.c=[10,4,0];const refreshed=C.refreshPlacementGeometry(ship);assert.equal(refreshed.ok,true,JSON.stringify(refreshed.failed));assert.equal(C.publicJSON(parent),before);assert.ok(part.c[0]<-3&&part.c[0]>-3.02,'the child must stop at the first hole edge');near(part.c[1],4);near(part.c[2],0);assert.equal(C.placementDiagnostics(ship).find(q=>q.partId===id).connected,true);assert.deepEqual(plain(part.placement.requestedGeometry.c),plain(part.c));near(C.partVolume(part),128);closedPositive(part);
});

test('contact cutting is rejected for interior rooms, ordinary exterior equipment and surface placement',()=>{
 const parent={id:1,k:'struct',form:'box',c:[0,0,0],s:[120,120,40]},cases=[
  {part:{id:-1,k:'cargo',c:[0,0,0],d:2},request:{mode:'clip',hostId:1}},
  {part:{id:-1,k:'sensor',c:[0,20.92,0],d:2},request:{mode:'direct',parentStructureId:1,hit:{p:[0,20,0],n:[0,1,0]}}},
  {part:child(),request:{mode:'surface',parentStructureId:1,hit:{p:[0,20,0],n:[0,1,0]}}}
 ];
 for(const {part,request} of cases){const ship=fixture(plain(parent)),before=C.publicJSON(ship),source=C.publicJSON(part),baseline=C.solvePlacement(ship,part,request);assert.equal(baseline.ok,true,baseline.error);const rejected=C.solvePlacement(ship,part,{...request,contactFit:'cut'});assert.equal(rejected.ok,false,part.k+' '+request.mode);assert.equal(rejected.code,'contact-fit');assert.equal(C.publicJSON(ship),before);assert.equal(C.publicJSON(part),source);
  const invalid={...plain(baseline.part),id:2};invalid.placement.contactFit='cut';const invalidSource=C.publicJSON(invalid),metadataRejected=C.solvePlacement(ship,invalid,request);assert.equal(metadataRejected.ok,false,part.k+' '+request.mode+' saved metadata');assert.equal(metadataRejected.code,'contact-fit');assert.equal(C.publicJSON(invalid),invalidSource);assert.throws(()=>C.normalizePlacementMetadata(invalid.placement,invalid),/成形方法/);ship.parts.push(invalid);ship.nextId=3;assert.throws(()=>C.serialize(ship),/成形方法/);const saved=plain(C.serialize(fixture(plain(parent))));saved.parts.push(invalid);saved.nextId=3;assert.throws(()=>C.deserialize(saved),/成形方法/);
 }
 const ship=fixture(plain(parent)),input={id:-1,k:'pd',p:[0,0,0],n:[0,1,0],a:2,ped:0,mountMode:'auto'},request={entityKind:'fit',mode:'direct',hostId:1,hit:{p:[0,20,0],n:[0,1,0]}},baseline=C.solvePlacement(ship,input,request);assert.equal(baseline.ok,true,baseline.error);const rejected=C.solvePlacement(ship,input,{...request,contactFit:'cut'});assert.equal(rejected.ok,false);assert.equal(rejected.code,'contact-fit');const invalid={...plain(baseline.fit),id:2};invalid.placement.contactFit='cut';assert.equal(C.solvePlacement(ship,invalid,request).code,'contact-fit');assert.throws(()=>C.normalizePlacementMetadata(invalid.placement,invalid),/成形方法|通常取付/);ship.fits.push(invalid);ship.nextId=3;assert.throws(()=>C.serialize(ship),/成形方法|通常取付/);const saved=plain(C.serialize(fixture(plain(parent))));saved.fits.push(invalid);saved.nextId=3;assert.throws(()=>C.deserialize(saved),/成形方法|通常取付/);
});

test('unpositioned legacy catalog placement and unmarked old saves retain their authored pose and shape',()=>{
 const parent={id:1,k:'struct',form:'box',c:[0,0,0],s:[120,120,40]},ship=fixture(parent),input=child([0,0,0]),source=C.publicJSON(input),hit=C.rayPart([0,100,0],[0,-1,0],parent),r=C.solvePlacement(ship,input,{mode:'horizontal',parentStructureId:1,hit});assert.equal(r.ok,true,r.error);assert.equal(r.part.placement.contactFit,'legacy-fit');assert.equal(C.publicJSON(input),source);assert.deepEqual(plain(r.part.c),[0,30,0]);assert.deepEqual(plain(r.part.s),[20,10,20]);near(C.partVolume(r.part),4000);
 const accepted=C.acceptPlacementResult(ship,r);assert.equal(accepted.ok,true,accepted.error);for(const key of ['contactFit','contactOffset','contactAxis'])delete accepted.part.placement[key];const pose=plain(accepted.part.c),requested=plain(accepted.part.placement.requestedGeometry),saved=plain(C.serialize(ship));assert.equal(saved.parts.find(p=>p.id===accepted.part.id).placement.contactFit,undefined);const loaded=C.deserialize(saved),part=loaded.parts.find(p=>p.id===accepted.part.id);assert.deepEqual(plain(part.c),pose);assert.deepEqual(plain(part.s),[20,10,20]);assert.deepEqual(plain(part.placement.requestedGeometry),requested);near(C.partVolume(part),4000);closedPositive(part);
 const legacy=fixture(plain(parent)),authored={id:2,k:'struct',form:'wedge',c:[2,7,0],s:[12,8,6],yaw:17,pitch:3,roll:2};legacy.parts.push(authored);legacy.nextId=3;const old=C.deserialize(plain(C.serialize(legacy))),unchanged=old.parts.find(p=>p.id===2);assert.equal(unchanged.placement,undefined);for(const key of ['form','c','s','yaw','pitch','roll'])assert.deepEqual(plain(unchanged[key]),plain(authored[key]),key);near(C.partVolume(unchanged),C.partVolume(authored),.003);
});

test('a concave outline can slide along real support and clamps at its final contact without filling its notch',()=>{
 const parent={id:1,k:'struct',form:'box',c:[0,0,0],s:[120,120,40]},ship=fixture(parent),outline=[[-.5,-.5],[.5,-.5],[.5,0],[0,0],[0,.5],[-.5,.5]],input={...child([0,25,0],[20,20,10]),form:'outline',outline,corner:0,taper:0},hit=C.rayPart([0,100,0],[0,-1,0],parent),r=solve(ship,input,{hit});assert.equal(r.ok,true,r.error);const accepted=C.acceptPlacementResult(ship,r);assert.equal(accepted.ok,true,accepted.error);const part=accepted.part,id=part.id,before=C.publicJSON(parent);near(C.partVolume(part),3000);assert.equal(C.inPart(part,[8,25,8]),false);closedPositive(part);
 part.c=[2,25,0];const short=C.refreshPlacementGeometry(ship);assert.equal(short.ok,true,JSON.stringify(short.failed));assert.deepEqual(plain(part.c),[2,25,0]);near(C.partVolume(part),3000);assert.equal(C.inPart(part,[10,25,8]),false);assert.equal(C.placementDiagnostics(ship).find(q=>q.partId===id).connected,true);
 part.c=[100,25,0];const far=C.refreshPlacementGeometry(ship);assert.equal(far.ok,true,JSON.stringify(far.failed));assert.ok(part.c[0]<70&&part.c[0]>69.98,'the real concave footprint must stop at its last contact: '+part.c[0]);near(part.c[1],25);near(part.c[2],0);assert.equal(C.publicJSON(parent),before);assert.equal(part.form,'outline');assert.deepEqual(plain(part.outline),outline);assert.deepEqual(plain(part.s),[20,20,10]);assert.equal(C.inPart(part,[part.c[0]+8,25,8]),false);near(C.partVolume(part),3000,.003);assert.equal(C.placementDiagnostics(ship).find(q=>q.partId===id).connected,true);closedPositive(part);
 const loaded=C.deserialize(plain(C.serialize(ship))),saved=loaded.parts.find(p=>p.id===id);assert.deepEqual(plain(saved.c),plain(part.c));assert.deepEqual(plain(saved.outline),outline);near(C.partVolume(saved),3000,.003);closedPositive(saved);
});

test('the authenticated Imperial forward center beam cuts a 180x110x60m child at the requested preview pose',()=>{
 const file='assets/source/imperial-ii-user-layout/imperial-ii-upload.json',bytes=fs.readFileSync(path.join(root,file)),manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/source/imperial-ii-user-layout/manifest.json')));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),manifest.sourceSha256);const raw=JSON.parse(bytes),parent=raw.parts.find(p=>p.id===40);assert.equal(parent.label,'艦首中央の縦通装甲 1');const ship=fixture(parent),hit=C.rayPart([1056.12,1000,-2.81],[0,-1,0],parent);assert.ok(hit);const c=C.add(hit.p,[0,18,0]),input=child(c,[180,110,60]),before=C.publicJSON(parent),requested=180*110*60,r=solve(ship,input,{hit});assert.equal(r.ok,true,r.error);assert.equal(C.publicJSON(parent),before);assert.deepEqual(plain(r.part.c),plain(c));near(r.requestedVolume,requested);assert.ok(r.effectiveVolume>0&&r.effectiveVolume<requested);near(C.rayPart([hit.p[0],1000,hit.p[2]],[0,-1,0],r.part).p[1],c[1]+30,.0001);assert.equal(C.inPart(parent,parent.c),true);assert.equal(C.inPart(r.part,parent.c),false);closedPositive(r.part);
});
