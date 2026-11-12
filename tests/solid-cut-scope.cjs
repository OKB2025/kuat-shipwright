// One cut menu (user decisions 2026-11-11, docs/design-placement-v1.2.md "削りと接続"):
// new solid cuts carve every structure they meet (scope 'all', ship.solidCuts), existing hull-owned
// cuts stay hull-only and can be switched per cut, ship-level cuts remove hull material (mass, volume,
// cost), and a cut that overlaps fixed equipment is allowed with a 点検 warning.
const assert=require('node:assert/strict'),path=require('node:path'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'));
const CIGAR={L:200,W:32,H:32,plan:'cigar',sec:'ellipse'};
const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);
const close=(a,b,m,t=1e-6)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${m}: ${a} vs ${b}`);
const vol=T=>{let v=0;for(let i=0;i<T.length;i+=9)v+=(T[i]*(T[i+4]*T[i+8]-T[i+5]*T[i+7])-T[i+1]*(T[i+3]*T[i+8]-T[i+5]*T[i+6])+T[i+2]*(T[i+3]*T[i+7]-T[i+4]*T[i+6]))/6;return v;};
function design(){const s=C.newShip(CIGAR,'cut scope');s.fits=[];C.ensurePrimaryHull(s);return s;}
function withPlate(){
 const s=design(),hull=s.parts[0],raw=C.rayPart([110,500,0],[0,-1,0],hull),hit={p:raw.p,n:C.norm(raw.n)};
 const r=C.commitPlacement(s,{id:-1,k:'struct',form:'box',label:'plate',c:[hit.p[0],hit.p[1]+.6,hit.p[2]],s:[20,10,2],yaw:0,pitch:0},{mode:'horizontal',parentStructureId:hull.id,hit,contactFit:'cut',position:[hit.p[0],hit.p[1]+.6,hit.p[2]]});
 assert.equal(r.ok,true,r.error);C.refreshPlacementGeometry(s);return {s,hull,plate:s.parts.find(p=>p.label==='plate')};
}
const stats=s=>C.computeStats({...s,_cache:null});

test('a ship-level cut removes hull material exactly like the same hull-owned cut (mass, volume, cost)',()=>{
 const a=design(),b=design();
 a.solidCuts.push(C.normalizeSolidCut({id:a.nextId++,shape:'box',c:[30,28,0],s:[10,10,10],structures:true}));
 C.hullOwnSolidCut(b,b.parts[0],{id:b.nextId++,shape:'box',c:[30,28,0],s:[10,10,10],rotation:[0,0,0],mirror:false,structures:false});
 const A=stats(a),B=stats(b),U=stats(design());
 for(const k of ['mass','volume','hullVolume','cost'])close(A[k],B[k],k);
 close(A.costBy.hull,B.costBy.hull,'costBy.hull');close(A.info[1].materialVolume,B.info[1].materialVolume,'hull material volume');close(A.info[1].materialMass,B.info[1].materialMass,'hull material mass');
 assert.ok(A.info[1].materialVolume<U.info[1].materialVolume-100,'the cut really removed hull material');assert.ok(A.costBy.hull<U.costBy.hull,'and its cost');
});

test('a new all-scope cut carves the plate on the hull as well; a hull-only cut leaves it whole',()=>{
 const cut={shape:'box',c:[110,33,0],s:[6,40,40],rotation:[0,0,0],mirror:false};
 const all=withPlate(),only=withPlate(),plateVol=p=>vol(C.structTriangles(p));
 const before=plateVol(all.plate);
 all.s.solidCuts.push(C.normalizeSolidCut({...cut,id:all.s.nextId++,structures:true}));all.s._cache=null;C.refreshPlacementGeometry(all.s);
 C.hullOwnSolidCut(only.s,only.hull,{...cut,id:only.s.nextId++,structures:false});only.s._cache=null;C.refreshPlacementGeometry(only.s);
 assert.equal(C.solidCutScope(all.s,all.s.solidCuts[0].id),'all');assert.equal(C.solidCutScope(only.s,only.hull.hullData.solidCuts[0].id),'hull');
 assert.ok(plateVol(all.plate)<before-60,`the plate is cut through: ${plateVol(all.plate)} < ${before}`);close(plateVol(only.plate),before,'hull-only cut leaves the plate',1e-4);
});

test('switching a cut between hull-only and all keeps its shape and world position and is undoable data',()=>{
 const {s,hull}=withPlate(),id=s.nextId++;C.hullOwnSolidCut(s,hull,{id,shape:'cylinder',c:[60,30,4],s:[6,6,10],rotation:[10,20,30],mirror:true,structures:false});
 const bounds=q=>C.compiledSolidCut(q).instances.map(x=>Array.from(x.bounds,v=>+v.toFixed(6)));
 const world=C.hullWorldSolidCut(hull,hull.hullData.solidCuts[0]),start=bounds(world);
 assert.equal(C.setSolidCutScope(s,id,'all'),true);assert.equal(C.solidCutScope(s,id),'all');assert.equal(hull.hullData.solidCuts.length,0);
 const moved=s.solidCuts.find(c=>c.id===id);assert.equal(moved.structures,true);assert.equal(moved.mirror,true);same(bounds(moved),start,'same world placement');
 assert.equal(C.setSolidCutScope(s,id,'hull'),true);assert.equal(C.solidCutScope(s,id),'hull');assert.equal(s.solidCuts.length,0);same(bounds(C.hullWorldSolidCut(hull,hull.hullData.solidCuts[0])),start,'and back');
 // Saved designs keep their own scope: a hull-owned cut stays hull-only through save and load.
 const L=C.deserialize(JSON.parse(C.publicJSON(C.serialize(s))));assert.equal(C.solidCutScope(L,id),'hull');
});

test('a cut over fixed equipment is allowed and reported in 点検 with a select link; nothing moves',()=>{
 const s=design();const gen=C.placePart(s,'gen',[100,16,0],8,{label:'reactor'});assert.ok(gen,'reactor placed');const before=C.publicJSON(gen);
 const clear=C.solidCutEquipmentHits(s);same(clear,[],'no cut, no hit');
 const id=s.nextId++;s.solidCuts.push(C.normalizeSolidCut({id,shape:'box',c:[100,16,0],s:[6,6,6],structures:true}));s._cache=null;
 const S={warnings:[]};C.groundingStats(s,S);same(S.cutEquipment,[{partId:gen.id,cutIds:[id]}]);
 const w=S.warnings.find(x=>x.code==='cut-equipment');assert.ok(w,'warning');assert.equal(w.lv,'warn');same(w.targets,[{list:'parts',id:gen.id}]);
 assert.ok(s.parts.includes(gen),'not deleted');assert.equal(C.publicJSON(gen),before,'not moved or changed');
 const en=require('node:fs').readFileSync(path.join(__dirname,'..','js/lang-en.js'),'utf8');assert.ok(en.includes(JSON.stringify(w.text.replace(/\d+ 基/,'{0} 基'))),'English text');
 // A hull-owned cut (hull shaping; the executor's engine sockets) is not reported; a cut elsewhere is not either.
 s.solidCuts=[];C.hullOwnSolidCut(s,s.parts[0],{id,shape:'box',c:[100,16,0],s:[6,6,6],rotation:[0,0,0],mirror:false,structures:false});s._cache=null;same(C.solidCutEquipmentHits(s),[]);
 s.parts[0].hullData.solidCuts=[];s.solidCuts.push(C.normalizeSolidCut({id,shape:'box',c:[20,16,0],s:[6,6,6],structures:true}));s._cache=null;same(C.solidCutEquipmentHits(s),[]);
});

test('a ship-level cut through a hull and a half-buried structure subtracts the shared volume once',()=>{
 const build=()=>{const s=design();s.parts.push({id:s.nextId++,k:'struct',form:'box',c:[110,32,0],s:[20,12,10],yaw:0,pitch:0});C.refreshPlacementGeometry(s);return s;};
 const measure=s=>{const S=stats(s),hull=s.parts[0],box=s.parts[1];hull._solidCutShip=s;box._solidCutShip=s;const union=C.structuralMeshVolume(C.structuralJoinBoundary(C.structTriangles(hull),C.structTriangles(box)));return {sum:S.info[hull.id].materialVolume+S.info[box.id].materialVolume,union};};
 const u=measure(build()),b=build();b.solidCuts.push(C.normalizeSolidCut({id:b.nextId++,shape:'box',c:[110,31,0],s:[6,12,40],structures:true}));b._cache=null;C.refreshPlacementGeometry(b);const k=measure(b);
 assert.ok(k.union<u.union-500,'the cut removed material');
 // The counted material equals the union's volume with and without the cut (same small meshing difference).
 assert.ok(Math.abs(u.sum-u.union)<5,`uncut: ${u.sum} vs ${u.union}`);assert.ok(Math.abs(k.sum-k.union)<5,`cut: ${k.sum} vs ${k.union}`);assert.ok(Math.abs((k.sum-k.union)-(u.sum-u.union))<.5,'no extra subtraction from the cut');
});

test('a mirrored hull-owned cut on a hull off the centreline keeps its mirror position when switched to all (and back); the equipment check sees it there',()=>{
 const s=design(),hull=s.parts[0],h2=JSON.parse(C.publicJSON(hull));h2.id=s.nextId++;h2.c=[hull.c[0],hull.c[1],hull.c[2]+20];delete h2.primaryHull;h2.label='H2';h2.hullData={...h2.hullData,solidCuts:[],subs:[]};s.parts.push(h2);s._cache=null;C.refreshPlacementGeometry(s);
 const H2=s.parts.find(q=>q.label==='H2');assert.equal(C.hullMirrorIsWorldMirror(H2),false);assert.equal(C.hullMirrorIsWorldMirror(hull),true);
 // In H2's own frame: z -9..-1 and its mirror z +1..+9, i.e. world z 11..19 and 21..29 (not -29..-21).
 const id=s.nextId++;H2.hullData.solidCuts.push(C.normalizeSolidCut({id,shape:'box',c:[110,16,-5],s:[20,8,6],rotation:[0,0,0],mirror:true,structures:false}));s._cache=null;C.refreshPlacementGeometry(s);
 const reactor={id:s.nextId++,k:'gen',c:[110,16,25],d:4,label:'reactor'};s.parts.push(reactor);s._cache=null;
 // H2's own carved body (the primary hull is cut too once the halves carve every structure).
 const material=()=>{s._cache=null;H2._solidCutShip=s;return vol(C.structTriangles(H2));},before=material();
 assert.equal(C.setSolidCutScope(s,id,'all'),true);assert.equal(H2.hullData.solidCuts.length,0);
 const zs=s.solidCuts.map(c=>{const b=C.compiledSolidCut(c).instances[0].bounds;return [+b[2].toFixed(3),+b[5].toFixed(3),c.mirror];}).sort((a,b)=>a[0]-b[0]);
 same(zs,[[11,19,false],[21,29,false]],'two halves at the hull mirror positions');close(material(),before,'the hull is carved exactly as before',1e-6);
 const hits=C.solidCutEquipmentHits(s);assert.ok(hits.some(h=>h.partId===reactor.id),'the reactor in the mirrored half is reported');
 // And back to hull-only: the two halves are exact mirror halves about H2's centreline, so they join
 // again as the one mirrored cut (the original id), carving the same material. The list does not grow.
 for(const c of s.solidCuts.slice())C.setSolidCutScope(s,c.id,'hull',H2.id);assert.equal(s.solidCuts.length,0);
 same(H2.hullData.solidCuts.map(c=>[c.id,c.mirror,c.c.map(v=>+v.toFixed(6))]),[[id,true,[110,16,-5]]],'one mirrored hull cut again');close(material(),before,'back to hull-only',1e-6);
 // Round trip twice more: still one cut, same id.
 for(let k=0;k<2;k++){C.setSolidCutScope(s,id,'all');for(const c of s.solidCuts.slice())C.setSolidCutScope(s,c.id,'hull',H2.id);}
 same(H2.hullData.solidCuts.map(c=>[c.id,c.mirror]),[[id,true]]);close(material(),before,'after three round trips',1e-6);
});
test('halves join only when they are exact mirror halves on the same hull',()=>{
 const s=design(),hull=s.parts[0],h2=JSON.parse(C.publicJSON(hull));h2.id=s.nextId++;h2.c=[hull.c[0],hull.c[1],hull.c[2]+20];delete h2.primaryHull;h2.label='H2';h2.hullData={...h2.hullData,solidCuts:[],subs:[]};s.parts.push(h2);s._cache=null;C.refreshPlacementGeometry(s);
 const H2=s.parts.find(q=>q.label==='H2'),a={id:s.nextId++,shape:'box',c:[110,16,-5],s:[20,8,6],rotation:[0,0,0]};
 // Not a mirror (size differs): two cuts stay two.
 H2.hullData.solidCuts=[C.normalizeSolidCut(a),C.normalizeSolidCut({...a,id:s.nextId++,c:[110,16,5],s:[20,8,7]})];
 assert.equal(C.mergeHullMirrorHalves(H2,H2.hullData.solidCuts[1].id),H2.hullData.solidCuts[1].id);assert.equal(H2.hullData.solidCuts.length,2);
 // A mirror with its rotation mirrored too (rx, ry flip sign) joins; the lower id stays.
 const r={...a,rotation:[10,20,30]};H2.hullData.solidCuts=[C.normalizeSolidCut({...r,id:50}),C.normalizeSolidCut({...C.mirrorSolidCut(r),id:40})];
 assert.equal(C.mergeHullMirrorHalves(H2,50),40);same(H2.hullData.solidCuts.map(c=>[c.id,c.mirror,c.rotation]),[[40,true,[-10,-20,30]]]);
 // The same rotation on both sides is not a mirror.
 H2.hullData.solidCuts=[C.normalizeSolidCut({...r,id:50}),C.normalizeSolidCut({...r,id:40,c:[110,16,5]})];assert.equal(C.mergeHullMirrorHalves(H2,50),50);assert.equal(H2.hullData.solidCuts.length,2);
});
test('the two halves of a split mirrored cut stay a pair: switching either one back to hull-only takes both and joins them',()=>{
 for(const which of [0,1]){
  const s=design(),hull=s.parts[0],h2=JSON.parse(C.publicJSON(hull));h2.id=s.nextId++;h2.c=[hull.c[0],hull.c[1],hull.c[2]+20];delete h2.primaryHull;h2.label='H2';h2.hullData={...h2.hullData,solidCuts:[],subs:[]};s.parts.push(h2);s._cache=null;C.refreshPlacementGeometry(s);
  const H2=s.parts.find(q=>q.label==='H2'),id=s.nextId++;H2.hullData.solidCuts.push(C.normalizeSolidCut({id,shape:'box',c:[110,16,-5],s:[20,8,6],rotation:[0,0,15],mirror:true}));
  // An unrelated plain ship-level cut that is not a mirror of either half stays where it is.
  const other=C.normalizeSolidCut({id:s.nextId++,shape:'box',c:[60,16,20],s:[10,8,6],structures:true});s.solidCuts.push(other);
  C.setSolidCutScope(s,id,'all');const halves=s.solidCuts.filter(c=>c.id!==other.id);assert.equal(halves.length,2);
  same(C.solidCutMirrorPartner(s,halves[0].id).mate.id,halves[1].id);same(C.solidCutMirrorPartner(s,halves[1].id).mate.id,halves[0].id);assert.equal(C.solidCutMirrorPartner(s,halves[0].id).hull.id,H2.id);
  assert.equal(C.solidCutMirrorPartner(s,other.id),null);
  assert.equal(C.setSolidCutScope(s,halves[which].id,'hull'),true);
  same(s.solidCuts.map(c=>c.id),[other.id],'both halves left the ship-level list; the unrelated cut stayed');
  same(H2.hullData.solidCuts.map(c=>[c.id,c.mirror,c.c.map(v=>+v.toFixed(6)),c.rotation.map(v=>+v.toFixed(6))]),[[id,true,[110,16,-5],[0,0,15]]],'one mirrored hull cut, the original id');
 }
});
// Ships for the pair rules: H2 at z+20 (and optionally H3 at z-20) beside the primary hull.
function twin(withH3=false){
 const s=design(),hull=s.parts[0],add=(dz,label)=>{const h=JSON.parse(C.publicJSON(hull));h.id=s.nextId++;h.c=[hull.c[0],hull.c[1],hull.c[2]+dz];delete h.primaryHull;h.label=label;h.hullData={...h.hullData,solidCuts:[],subs:[]};s.parts.push(h);};
 add(20,'H2');if(withH3)add(-20,'H3');s._cache=null;C.refreshPlacementGeometry(s);return {s,H2:s.parts.find(q=>q.label==='H2'),H3:s.parts.find(q=>q.label==='H3')};
}
const box=(s,c,extra={})=>{const q=C.normalizeSolidCut({id:s.nextId++,shape:'box',c,s:[20,8,6],structures:true,...extra});s.solidCuts.push(q);return q;};
test('pair links are made only when unambiguous: one candidate, mutual, on one hull, and reaching that hull',()=>{
 // One exact mirror pair about H2's centreline (world z 15 and 25): linked.
 {const {s,H2}=twin(true),a=box(s,[110,16,15]),b=box(s,[110,16,25]);const p=C.solidCutMirrorPartner(s,a.id);assert.equal(p.mate.id,b.id);assert.equal(p.hull.id,H2.id);assert.equal(C.solidCutMirrorPartner(s,b.id).mate.id,a.id);}
 // Three candidates (a and two identical mirrors of it): no link for any of them.
 {const {s}=twin(),a=box(s,[110,16,15]),b=box(s,[110,16,25]),c=box(s,[110,16,25]);for(const q of [a,b,c])assert.equal(C.solidCutMirrorPartner(s,q.id),null,'cut '+q.id);
  // and switching one back to hull-only moves only that one.
  C.setSolidCutScope(s,b.id,'hull');assert.equal(s.solidCuts.length,2);}
 // Two unrelated cuts that happen to mirror about H2's centreline (z -15 and 55), but one cuts H3 and the
 // other nothing; H2 is not reached. With a second off-centre hull: no link.
 {const {s}=twin(true),a=box(s,[110,16,-15]),b=box(s,[110,16,55]);assert.equal(C.solidCutMirrorPartner(s,a.id),null);assert.equal(C.solidCutMirrorPartner(s,b.id),null);}
 // Two off-centre hulls on the same centreline (H2 and a copy above it): the pair mirrors about both, so it is ambiguous.
 {const {s,H2}=twin(),h=JSON.parse(C.publicJSON(H2));h.id=s.nextId++;h.c=[H2.c[0],H2.c[1]+40,H2.c[2]];h.label='H2b';s.parts.push(h);s._cache=null;C.refreshPlacementGeometry(s);
  const a=box(s,[110,16,15],{s:[20,8,80]}),b=box(s,[110,16,25],{s:[20,8,80]});assert.equal(C.solidCutMirrorPartner(s,a.id),null,'mirror about two hulls');assert.equal(C.solidCutMirrorPartner(s,a.id,H2.id).mate.id,b.id,'with the hull named it is unambiguous');}
});
test('a split pair is still a pair after serialize and deserialize (1e-6 tolerance)',()=>{
 const {s,H2}=twin(),id=s.nextId++;H2.hullData.solidCuts.push(C.normalizeSolidCut({id,shape:'box',c:[110,16,-5],s:[20,8,6],rotation:[12.5,-7.25,33],mirror:true}));
 C.setSolidCutScope(s,id,'all');const mate=s.solidCuts.find(c=>c.id!==id).id;
 const L=C.deserialize(JSON.parse(C.publicJSON(C.serialize(s))));assert.equal(C.solidCutMirrorPartner(L,id).mate.id,mate);assert.equal(C.solidCutMirrorPartner(L,mate).mate.id,id);
 C.setSolidCutScope(L,mate,'hull');const h=L.parts.find(q=>q.label==='H2');assert.equal(L.solidCuts.length,0);same(h.hullData.solidCuts.map(c=>[c.id,c.mirror]),[[id,true]]);
});
test('on a hull on the centreline two plain cuts that are exact mirrors are not joined (only an off-centre hull split joins back)',()=>{
 const s=design(),hull=s.parts[0],a=C.normalizeSolidCut({id:s.nextId++,shape:'box',c:[110,16,-5],s:[20,8,6]}),b=C.normalizeSolidCut({id:s.nextId++,shape:'box',c:[110,16,5],s:[20,8,6],structures:true});
 hull.hullData.solidCuts.push(a);s.solidCuts.push(b);assert.equal(C.hullMirrorIsWorldMirror(hull),true);
 assert.equal(C.mergeHullMirrorHalves(hull,a.id),a.id);assert.equal(C.solidCutMirrorPartner(s,b.id),null);
 C.setSolidCutScope(s,b.id,'hull',hull.id);same(hull.hullData.solidCuts.map(c=>[c.id,c.mirror]),[[a.id,false],[b.id,false]],'two plain cuts, as the user made them');
});
