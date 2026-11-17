// User request 2026-11-16「当たり判定は船の外面に出るように。デススターなどで試したが当たり判定が遠すぎて赤道トレンチに入る前に衝突した」:
// collision and hits use the visible outer surface. A ship's radial map (Core.hullRadialMap, built by the Worker from its
// render meshes) gives the distance from its centre to the outermost surface along each direction; the hull box stays the
// first, coarse check, and ships without a map keep it as before. Maps are used only where the caller asks (the trial):
// a fleet battle or a voyage, whose maps may arrive after it started, keeps the box (Opus/high review 2026-11-16).
const path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'));
const s=C.buildDesign('deathstar'),T=[];for(const p of s.parts){if(p.k==='struct'){p._solidCutShip=s;for(const v of C.structTriangles(p))T.push(v);}else if(p.k==='slaser')for(const v of C.superweaponBodyTriangles(p))T.push(v);}
const b=C.shipBounds(s),center=[(b[0]+b[3])/2,(b[1]+b[4])/2,(b[2]+b[5])/2],map=C.hullRadialMap(Float32Array.from(T),center,160000);
const dir=(lat,lon)=>{const a=lat*Math.PI/180,o=lon*Math.PI/180;return [Math.cos(a)*Math.cos(o),Math.sin(a),Math.cos(a)*Math.sin(o)];};
const ds=()=>({id:'ds',key:'test-deathstar',pos:[0,0,0],yaw:0,velocity:[0,0,0],p:{len:160000,height:160000,width:160000},info:{mass:1e15}});
const craft=pos=>({id:'x',key:'test-craft',pos,yaw:0,velocity:[0,0,0],p:{len:12,height:3,width:11},info:{mass:10}});
test('the map follows the outer surface: the trench floor at the equator, the sphere elsewhere',()=>{
 assert.equal(map.nLon,720);assert.equal(map.nLat,720);
 assert.ok(Math.abs(C.hullRadialAt(map,dir(0,90))-76850)<200,'trench floor (80 km − 3.15 km): '+C.hullRadialAt(map,dir(0,90)));
 assert.ok(Math.abs(C.hullRadialAt(map,dir(10,90))-80100)<300,String(C.hullRadialAt(map,dir(10,90))));
});
test('a craft inside the equatorial trench touches nothing; the box test alone said it did',()=>{
 C.setHullRadial('test-deathstar',map);try{
  const d=dir(0,90),inTrench=craft(d.map(v=>v*78500)),a=ds();
  assert.equal(C.hullRefine(a,inTrench,{depth:1,n:[0,1,0],point:[0,0,0]}),null,'no contact in the trench');
  const out=C.hullCollide([a,inTrench],{radial:true});assert.equal(out.length,0,'hullCollide with maps (the trial): no contact');
  assert.ok(C.hullCollide([ds(),craft(d.map(v=>v*78500))]).length>0,'a caller that does not ask for maps (fleet battle, voyage) keeps the box');
  C.setHullRadial('test-deathstar',null);assert.ok(C.hullCollide([ds(),craft(d.map(v=>v*78500))],{radial:true}).length>0,'without the map the box reports a contact');
 }finally{C.setHullRadial('test-deathstar',null);}
});
test('below the outer surface away from the trench is a contact, pushed out along the surface normal',()=>{
 C.setHullRadial('test-deathstar',map);try{
  const d=dir(10,90),a=ds(),c=craft(d.map(v=>v*79500)),hit=C.hullRefine(a,c,{depth:1,n:[0,1,0],point:[0,0,0]});
  assert.ok(hit&&hit.depth>300&&hit.depth<900,JSON.stringify(hit&&hit.depth));assert.ok(hit.n[0]*d[0]+hit.n[1]*d[1]+hit.n[2]*d[2]>.99,'normal outward');
  assert.equal(C.hullRefine(ds(),craft(d.map(v=>v*81500)),{depth:1,n:[0,1,0],point:[0,0,0]}),null,'outside the surface');
 }finally{C.setHullRadial('test-deathstar',null);}
});
test('ships without a map keep the box contact unchanged',()=>{const c0={depth:5,n:[1,0,0],point:[1,2,3]};assert.equal(C.hullRefine({key:'nomap-a',pos:[0,0,0],p:{len:10}},{key:'nomap-b',pos:[1,0,0],p:{len:10}},c0),c0);});
