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
