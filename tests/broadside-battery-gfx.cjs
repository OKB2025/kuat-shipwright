const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const{C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),plain=x=>JSON.parse(JSON.stringify(x)),near=(a,b,e=.0001)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`),vector=(a,b,e)=>a.forEach((v,i)=>near(v,b[i],e));
const CALIBERS=[['70TT',70,2,1],['40TT',40,2,1],['500GT',.5,6,.2],['200GT',.2,6,.2]],FRAMES=[{a:4,n:[0,0,1]},{a:5,n:[0,0,-1]},{a:0,n:[1,0,0]},{a:1,n:[-1,0,0]},{a:4,n:C.norm([.21,.34,.916])}];
const fitting=(caliber='40TT',guns=2,extra={})=>({id:7,k:'broadsideBattery',p:[100,17,25],a:4,n:[0,0,1],ped:0,base:0,low:0,float:false,localMount:true,batteryCaliber:caliber,batteryGuns:guns,...extra});
function model(f,paint='neutral'){const s=C.newShip({assembly:true,L:200,W:150,H:80},'Black side battery');s.parts=[];s.hatches=[];s.fits=[f];s.detail=0;s.paint=paint;return s;}
function active(g){return Object.fromEntries(['pos','nor','uv','col','idx'].map(k=>[k,Buffer.from(g[k].buffer,g[k].byteOffset,(k==='idx'?g.ni:g.n*(k==='col'?4:k==='uv'?2:3))*g[k].BYTES_PER_ELEMENT)]));}
function equalMeshes(a,b){assert.equal(a.n,b.n);assert.equal(a.ni,b.ni);const A=active(a),B=active(b);for(const k of Object.keys(A))assert.deepEqual(A[k],B[k],k+' geometry bytes');}
const vertex=(g,i)=>Array.from(g.pos.subarray(i*3,i*3+3));
function darkFront(g,p){const T=[];for(let i=0;i<g.ni;i+=3){const ids=Array.from(g.idx.subarray(i,i+3));if(!ids.every(j=>[12,16,20].every((c,k)=>g.col[j*4+k]===c)))continue;const P=ids.map(j=>vertex(g,j));if(!P.every(q=>Math.abs(C.dot(C.sub(q,p.point),p.normal)-(p.depth+p.lip))<.0001))continue;T.push(...P.flat());}return Float32Array.from(T);}

test('one static 36-triangle black window represents every caliber and gun count without external barrels',()=>{
 for(const frame of FRAMES){let baseline;for(const[caliber,,max]of CALIBERS)for(const guns of [1,max])for(const paint of ['neutral','republic','dark','cis']){const f=fitting(caliber,guns,frame),p=C.broadsideBatteryGeometry(f),s=model(f,paint),g=G.meshFits(s),ref=G.meshReferenceFits(s),b=C.fitAABB(f);assert.equal(g.ni,36*3,'only the frame, pane and hood boxes are drawn');assert.equal(ref.ni,0,'no hidden model turret or tube is drawn twice');
   for(let i=0;i<g.n;i++){const q=vertex(g,i),d=C.sub(q,p.point),normal=C.dot(d,p.normal);assert.ok(normal>=-.0001&&normal<=p.depth+p.lip+.0001,'no geometry projects beyond the shallow window plane');assert.ok(Math.abs(C.dot(d,p.u))<=p.width/2+.0001);assert.ok(Math.abs(C.dot(d,p.v))<=p.height/2+.0001);for(let k=0;k<3;k++)assert.ok(q[k]>=b[k]-.0001&&q[k]<=b[k+3]+.0001,'all rendered vertices lie inside the selectable bounds');}
   const T=darkFront(g,p);assert.equal(T.length,18,'two real black front triangles cover the window');if(!baseline)baseline=g;else equalMeshes(baseline,g);
  }}
});

test('every real muzzle lies on the visible black pane and is selectable from the firing side',()=>{
 for(const frame of FRAMES)for(const[caliber,,max]of CALIBERS){const f=fitting(caliber,max,frame),p=C.broadsideBatteryGeometry(f),g=G.meshFits(model(f)),T=darkFront(g,p);assert.equal(p.muzzles.length,max);
  for(const mouth of p.muzzles){const d=C.sub(mouth,p.point);near(C.dot(d,p.normal),p.depth+p.lip);near(C.dot(d,p.v),0);assert.ok(Math.abs(C.dot(d,p.u))<p.width*.35,'every emitter stays inside the actual black pane');const o=C.add(mouth,C.mul(p.normal,10)),dir=C.mul(p.normal,-1),dark=C.rayTris(T,o,dir),pick=G.rayFit(o,dir,f);assert.ok(dark&&pick,'the real visible pane owns each firing point');vector(dark.p,mouth);vector(pick.p,mouth);}
  const outside=C.add(p.point,C.add(C.mul(p.u,p.width/2+.5),C.mul(p.normal,10)));assert.equal(G.rayFit(outside,C.mul(p.normal,-1),f),null,'the surrounding empty wall space does not select the battery');
  const edge=C.add(p.point,C.add(C.mul(p.u,p.width*.425),C.mul(p.normal,10))),pick=G.rayFit(edge,C.mul(p.normal,-1),f);assert.ok(pick,'the armored frame remains selectable');near(C.dot(C.sub(pick.p,p.point),p.normal),p.depth);assert.equal(C.rayTris(T,edge,C.mul(p.normal,-1)),null,'the frame is not incorrectly treated as black glass');
 }
});

test('surface-derived and ordinary side batteries share the same window mesh and diagnostic ranges',()=>{
 for(const[caliber,,guns]of CALIBERS){const base=fitting(caliber,guns),derived={...base,surfacePatch:'p1:side',surfacePoint:base.p.slice()},A=model(base),B=model(derived);equalMeshes(G.meshFits(A),G.meshFits(B));const ranges={};G.meshFits(B,null,ranges);assert.ok(ranges[base.id]?.some(r=>r[2]===108),'the single physical window is registered for editing selection');assert.equal(G.meshReferenceFits(B).ni,0);}
});

test('fleet and manual-trial descriptors retain actual window mouths and dynamic salvo, cadence and power',()=>{
 for(const frame of [FRAMES[0],FRAMES[1],FRAMES[4]])for(const[caliber,boltTT,max,cycle]of CALIBERS)for(const guns of [1,max]){const f=fitting(caliber,guns,frame),s=model(f),p=C.broadsideBatteryGeometry(f),d=C.fitSpec(f),fleet=G.fleetGeometry(s,{trial:true}),t=fleet.turrets.find(t=>t.id===f.id);assert.ok(t);assert.equal(t.broadsideBattery,true);assert.equal(t.barrels,guns);near(t.cycle,cycle,1e-12);near(t.tt,boltTT*guns,1e-12);near(t.power*cycle/C.TT,boltTT*guns,1e-9);near(t.power,d.power,1e-3);assert.ok(Number.isFinite(t.rate)&&t.rate>0,'the separate traverse-speed descriptor remains finite');assert.equal(t.cap,true);assert.equal(t.fixed,false);assert.equal(t.casemate,true);assert.equal(t.mesh,null,'the static wall frame does not acquire an articulated turret mesh');assert.equal(t.bodyMesh,undefined);
  vector(t.pivot,p.mouth);vector(t.origin,p.mouth);vector(t.axis,p.v);vector(t.fw,p.normal);assert.deepEqual(plain(t.muzzles),plain(p.muzzles));assert.notEqual(t.muzzles,p.muzzles);near(t.port.width,p.width);near(t.port.height,p.height);near(t.port.depth,p.depth);assert.equal(fleet.meshes.fits.geo.ni,108);assert.equal(fleet.meshes.refFits.geo.ni,0);
 }
});

test('batteries placed on actual structural and sloped walls render the same flush pane after mounting',()=>{
 for(const orientation of [{},{yaw:31},{pitch:17,roll:13,yaw:23}])for(const sign of [-1,1]){const s=C.newShip({assembly:true,L:240,W:180,H:100},'Mounted structural battery');s.parts=[];s.fits=[];s.hatches=[];s.detail=0;C.placePart(s,'struct',[100,0,0],[120,100,70],{form:'box',...orientation},false);const host=s.parts.find(p=>p.k==='struct'),fr=C.structFrame(host),n=C.mul(fr.rt,sign),wall=C.worldStruct(host,[0,0,sign*host.s[1]/2]),hit=C.rayEnv(s,C.add(wall,C.mul(n,100)),C.mul(n,-1),{structOnly:true});assert.ok(hit?.part&&hit.part.id===host.id,'the placement ray hits the physical structural wall');
  const result=C.placeFit(s,'broadsideBattery',hit.p,hit.n,0,false,{host:host.id,localMount:true,batteryCaliber:'200GT',batteryGuns:6});assert.ok(!result.err,result.err);const f=s.fits.find(f=>f.k==='broadsideBattery');assert.ok(f&&!f.float);assert.equal(f.host,host.id);const p=C.broadsideBatteryGeometry(f),g=G.meshFits(s);vector(p.normal,hit.n);vector(p.wallPoint,hit.p,.001);assert.equal(g.ni,108);for(const mouth of p.muzzles){const pick=G.rayFit(C.add(mouth,C.mul(p.normal,5)),C.mul(p.normal,-1),f);assert.ok(pick);vector(pick.p,mouth);}
 }
});
