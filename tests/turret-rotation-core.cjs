const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const C=vm.runInContext('Core',context),plain=v=>JSON.parse(JSON.stringify(v));
const near=(a,b,eps=1e-8)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`),vec=(a,b)=>a.forEach((v,i)=>near(v,b[i]));
function deck(){const ship=C.newShip({plan:'rect',sec:'rect',L:240,W:180,H:30},'Turret heading');ship.parts=[];ship.fits=[];return ship;}
function fitting(k='ltl',extra={}){return {id:1,k,p:[100,30,25],a:2,ped:2,base:0,low:0,...extra};}

test('all procedural and model turret families share heading eligibility without changing fixed weapons or casemates',()=>{
 const procedural=['pd','ltl','mtl','htl','stl','utl','ion','ionL','triple40','quad200','xx9','nk7','cturret'];
 for(const k of procedural)assert.equal(C.fitCanRotate(k),true,k);
 for(const k of Object.keys(C.FITS)){const d=C.FITS[k];if(d.asset&&!d.casemate)assert.equal(C.fitCanRotate({k}),true,k);if(d.casemate)assert.equal(C.fitCanRotate({k}),false,k);}
 for(const k of ['claser','claserH','cion','ctorp','cmsl','cbomb','cpylon','msl','itl','trc','brS','casemateMid','casemateLight','casemateIon','casemateIonL','unknown'])assert.equal(C.fitCanRotate(k),false,k);
});

test('procedural turret heading turns its full fitting frame on every mount axis and sloped face',()=>{
 for(const a of [0,1,2,3,4,5])for(const tilt of [null,C.norm([.22,.9,.31])]){
  const f=fitting('ltl',{a,...(tilt?{tilt}:{}),assetYaw:90}),base=C.fitFrameOf({...f,assetYaw:0}),turned=C.fitFrameOf(f);
  vec(turned.up,base.up);vec(turned.fw,base.rt);vec(turned.rt,C.mul(base.fw,-1));near(C.len(turned.fw),1);near(C.dot(turned.fw,turned.up),0);
  vec(C.fitOrigin(f),C.fitOrigin({...f,assetYaw:0}));assert.equal(C.fitUp(f),tilt||C.AXES[a]);
 }
 const back=C.fitFrameOf(fitting('cturret',{assetYaw:180}));vec(back.fw,[-1,0,0]);
});

test('reference turret heading remains applied once in the model transform, including authored skins',()=>{
 for(const skinAsset of [undefined,'ven_turret']){
  const f=fitting('refVen',{skinAsset}),base=C.fitFrameOf(f),q=C.referenceFitPoint(f,[.3,.2,.1]),o=C.fitOrigin(f),r=C.referenceFitPoint({...f,assetYaw:90},[.3,.2,.1]),v=C.sub(q,o);
  vec(C.fitFrameOf({...f,assetYaw:90}).fw,base.fw);
  vec(C.sub(r,o),C.add(C.add(C.mul(base.fw,-C.dot(v,base.rt)),C.mul(base.rt,C.dot(v,base.fw))),C.mul(base.up,C.dot(v,base.up))));
 }
});

test('placement applies a chosen turret heading before mounting and stores its opposite on the mirrored instance',()=>{
 for(const k of ['ltl','refVen','cturret']){
  const ship=deck(),hit=C.rayEnv(ship,[120,300,50],[0,-1,0]),r=C.placeFit(ship,k,hit.p,hit.n,1,true,{assetYaw:37.125});
  assert.ok(r.fit,`${k}: ${r.err}`);assert.equal(ship.fits.length,2,k);assert.equal(r.fit.assetYaw,37.125);assert.equal(ship.fits.find(f=>f.id===r.fit.tw).assetYaw,-37.125);
  const loaded=C.deserialize(C.serialize(ship));assert.deepEqual(plain(loaded.fits.map(f=>f.assetYaw)),[37.125,-37.125]);
  const aabb=C.fitAABB(r.fit);assert.ok(aabb.every(Number.isFinite));
 }
 const ship=deck(),hit=C.rayEnv(ship,[120,300,50],[0,-1,0]);assert.equal(C.placeFit(ship,'msl',hit.p,hit.n,1,false,{assetYaw:60}).fit.assetYaw,undefined);
});

test('assembly mirroring reflects heading, sloped mount and side axis while preserving the origin',()=>{
 for(const extra of [{a:2},{a:4},{a:5,mountAxis:4},{a:2,tilt:C.norm([.2,.9,.3]),n:C.norm([.2,.9,.3])}]){
  const f=fitting('ltl',{assetYaw:41.125,...extra}),q=C.assemblyMirrorFit(f),a=C.fitFrameOf(f),b=C.fitFrameOf(q);
  assert.equal(q.assetYaw,-41.125);vec(b.up,C.mirrorP(a.up));vec(b.fw,C.mirrorP(a.fw));vec(C.fitOrigin(q),C.mirrorP(C.fitOrigin(f)));
  const twice=C.assemblyMirrorFit(q);assert.deepEqual(plain(twice),plain(f));
 }
});
