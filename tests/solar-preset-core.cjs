const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),ctx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
const C=vm.runInContext('Core',ctx),plain=x=>JSON.parse(C.publicJSON(x)),near=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
const insidePoly=(P,x,z)=>{let inP=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const a=P[i],b=P[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inP=!inP;}return inP;};
function panel(key,extra={}){const shape=C.solarPanelPreset(key),ship=C.newShip({L:12,W:8,H:4,assembly:true}),p=C.placePart(ship,'solarPanel',[5,2,4],[3,3*shape.aspect,.08],{...shape,panelFrame:3*shape.frameRatio,panelRib:3*shape.ribRatio,roll:90,...extra},false);return {ship,p,shape};}

test('TIE presets keep their measured aspect, fold roots, and independent editable copies',()=>{
 const ln=C.solarPanelPreset('hex'),tin=C.solarPanelPreset('interceptor'),sa=C.solarPanelPreset('bomber');
 assert.equal(ln.outline.length,6);assert.equal(tin.outline.length,22);assert.equal(sa.outline.length,12);
 near(ln.aspect,8.346/7.24);near(tin.aspect,.9058971264689331);near(sa.aspect,.8027771699044206);
 near(tin.panelFold,-41.43120702403947);near(sa.panelFold,-39.23879566864686);
 near(tin.panelKnee,.35101386995210415);near(sa.panelKnee,.3468970258476385);
 near(tin.panelSparX,2.55/9.12-.5);near(sa.panelSparX,5.49/7.9-.5);
 near(tin.ribRatio,1.05/9.12);near(sa.ribRatio,.56/7.9);
 tin.outline[0][0]=99;assert.notEqual(C.solarPanelPreset('interceptor').outline[0][0],99);
 assert.deepEqual(plain(C.solarPanelPreset('__proto__')),plain(ln));
});

test('the interceptor silhouette has two long forward prongs and an open centre ahead of the support',()=>{
 const {p}=panel('interceptor',{panelFold:0,roll:0}),at=(x,z)=>C.worldStruct(p,[x*p.s[0],0,z*p.s[1]]);
 assert.equal(C.inStruct(p,at(.3,0)),false);assert.equal(C.inStruct(p,at(.1,0)),false);
 assert.equal(C.inStruct(p,at(-.3,0)),true);assert.equal(C.inStruct(p,at(.35,.15)),true);assert.equal(C.inStruct(p,at(.35,-.15)),true);
 assert.equal(C.inStruct(p,at(.3,.45)),false);assert.equal(C.inStruct(p,at(-.25,.45)),true);
});

test('the bomber has a rectangular middle with narrower trapezoidal outer panels',()=>{
 const {p}=panel('bomber',{panelFold:0,roll:0}),at=(x,z)=>C.worldStruct(p,[x*p.s[0],0,z*p.s[1]]);
 assert.equal(C.inStruct(p,at(.49,0)),true);assert.equal(C.inStruct(p,at(-.49,0)),true);
 assert.equal(C.inStruct(p,at(.49,.49)),false);assert.equal(C.inStruct(p,at(.35,.49)),true);
});

test('both bent TIE types turn their tips inward on starboard and mirrored port panels',()=>{
 for(const key of ['interceptor','bomber']){
  const {ship,p}=panel(key),m=C.aeroPanelMesh(p);assert.equal(C.meshTopology(m.f).closed,true);
  const q=C.mirrorPart(p,ship),qm=C.aeroPanelMesh(q),world=(part,v)=>C.worldStruct(part,[v[0]*part.s[0],v[1]*part.s[2],v[2]*part.s[1]]);
  const outer=m.v.filter(v=>Math.abs(v[2])>.3);assert.ok(outer.length>0);for(const v of outer)assert.ok(world(p,v)[2]<p.c[2]);
  for(const v of qm.v.filter(v=>Math.abs(v[2])>.3))assert.ok(world(q,v)[2]>q.c[2]);
  const V=C.partVolume(p);assert.ok(V>0);const saved=C.deserialize(C.serialize(ship)).parts.find(q=>q.id===p.id);near(C.aeroArea(saved),C.aeroArea(p));
 }
});

test('TIE/ln uses a horizontal spine and four diagonal spokes while the bent types use offset spars',()=>{
 const ln=panel('hex').p,lines=C.solarPanelBraces(ln);assert.equal(lines.filter(l=>l.kind==='spoke').length,4);assert.equal(lines.filter(l=>l.kind==='spar').length,1);
 const spine=lines.find(l=>l.kind==='spar');near(spine.a[1],0);near(spine.b[1],0);
 for(const key of ['interceptor','bomber']){
  const {p}=panel(key),lines=C.solarPanelBraces(p),spar=lines.filter(l=>l.kind==='spar');assert.equal(lines.some(l=>l.kind==='spoke'),false);assert.equal(spar.length,1);
  for(const e of spar){near(e.a[0],p.panelSparX);near(e.b[0],p.panelSparX);}assert.ok(lines.some(l=>l.kind==='fold'));
  const T=C.aeroPanelRibs({...p,panelFold:0,roll:0});assert.ok(T.length>0);assert.ok(Array.from(T).every(Number.isFinite));
  for(let i=0;i<T.length;i+=9){const q=[0,1,2].map(a=>(T[i+a]+T[i+3+a]+T[i+6+a])/3),l=C.localStruct({...p,roll:0},q),x=l[0]/p.s[0],z=l[2]/p.s[1];
   // The frame's footprint remains on the actual collector, including around the deep notch.
   const eps=1e-6,inside=insidePoly(p.outline,x,z);
   if(!inside)assert.ok(p.outline.some((a,j)=>{const b=p.outline[(j+1)%p.outline.length],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)<eps;}));
  }
 }
});

test('reference bracing metadata survives placement, save/load and a folded editable-mesh conversion',()=>{
 for(const key of ['interceptor','bomber']){
  const {ship,p}=panel(key),baked=C.aeroBake(p);assert.equal(baked.panelBracing,'spar');near(baked.panelSparX,p.panelSparX);
  assert.ok(C.aeroPanelRibs(baked).length>0);assert.equal(C.aeroPanelRibs({...baked,panelBracing:'none'}).length,0);
  const saved=C.serialize(ship);saved.parts=[baked];const q=C.deserialize(saved).parts[0];assert.equal(q.panelBracing,'spar');near(q.panelSparX,p.panelSparX);near(C.aeroArea(q),C.aeroArea(p),1e-4);
 }
});

test('fresh TIE/ln collectors use native bracing while the other stock TIE types retain their separate frames',()=>{
 let count=0;
 for(const key of ['craft_tie_ln','craft_tie_in','craft_tie_sa']){
  const ship=C.buildDesign(key),panels=ship.parts.filter(p=>p.k==='solarPanel'),before=plain(C.serialize(ship).parts.filter(p=>p.k==='struct'));
  for(const p of panels){count++;if(key==='craft_tie_ln'){const shape=C.solarPanelPreset('hex');assert.equal(p.panelBracing,shape.panelBracing);near(p.panelFrame,p.s[0]*shape.frameRatio);near(p.panelRib,p.s[0]*shape.ribRatio);assert.ok(C.aeroPanelRibs(p).length>0);}else{assert.equal(p.panelBracing,'none');assert.equal(p.panelFrame,0);assert.equal(p.panelRib,0);assert.equal(C.aeroPanelRibs(p).length,0);}}
  if(key==='craft_tie_ln'){const saved=C.serialize(ship),loaded=C.deserialize(saved);for(const p of panels){const q=loaded.parts.find(q=>q.id===p.id);for(const field of ['panelBracing','panelFrame','panelRib'])assert.equal(q[field],p[field],field);}assert.deepEqual(plain(C.serialize(loaded).parts.filter(p=>p.k==='struct')),before);continue;}
  const old=C.serialize(ship);for(const p of old.parts.filter(p=>p.k==='solarPanel')){delete p.panelBracing;delete p.panelSparX;p.panelFrame=.06;p.panelRib=.035;}
  const loaded=C.deserialize(old);for(const p of loaded.parts.filter(p=>p.k==='solarPanel')){assert.equal(p.panelBracing,'none',key+' '+p.label);assert.equal(p.panelFrame,0);assert.equal(p.panelRib,0);}
  assert.deepEqual(plain(C.serialize(loaded).parts.filter(p=>p.k==='struct')),before);
 }
 assert.equal(count,14);
 const {ship,p}=panel('interceptor');delete p.label;const loaded=C.deserialize(C.serialize(ship)).parts[0];assert.equal(loaded.panelBracing,'spar');near(loaded.panelSparX,p.panelSparX);
});

test('an old TIE/ln save retains its separate physical frame without adding native bracing',()=>{
 const {ship,p}=panel('hex',{label:'太陽電池翼',panelBracing:'none',panelFrame:0,panelRib:0});
 const frame=C.placePart(ship,'struct',p.c.slice(),[2,.18,.2],{form:'box',light:true,label:'翼外枠',allowOverlap:true},false);assert.ok(frame);
 const saved=C.serialize(ship),old=saved.parts.find(q=>q.id===p.id);delete old.panelBracing;delete old.panelSparX;old.panelFrame=.06;old.panelRib=.035;
 const original=JSON.stringify(saved),physicalFrames=plain(saved.parts.filter(q=>q.k==='struct')),loaded=C.deserialize(saved),q=loaded.parts.find(q=>q.id===p.id);
 assert.equal(JSON.stringify(saved),original,'reading an old save does not rewrite its source');assert.equal(q.k,'solarPanel');assert.equal(q.panelBracing,'none');assert.equal(q.panelFrame,0);assert.equal(q.panelRib,0);assert.equal(C.aeroPanelRibs(q).length,0);
 for(const field of ['s','outline','c','roll'])assert.deepEqual(plain(q[field]),plain(old[field]),field);
 assert.deepEqual(plain(C.serialize(loaded).parts.filter(q=>q.k==='struct')),physicalFrames);near(C.solarArea(q),C.solarArea(p));
});

test('the interceptor rear collector uses its vertical broad face and keeps the original box bounds',()=>{
 const ship=C.buildDesign('craft_tie_in'),panels=ship.parts.filter(p=>p.label==='翼中央パネル');assert.equal(panels.length,2);
 for(const p of panels){
  near(p.s[0],1.7);near(p.s[1],1.9);near(p.s[2],.44);near(Math.abs(p.roll),90);near(C.solarArea(p),1.7*1.9);
  const expected=[p.c[0]-.85,p.c[1]-.95,p.c[2]-.22,p.c[0]+.85,p.c[1]+.95,p.c[2]+.22],bounds=C.partAABB(p);
  expected.forEach((v,i)=>near(bounds[i],v,1e-6));
  const changed=C.solarPanelPreset('interceptor'),copy={...plain(p),...changed,s:[p.s[0],p.s[0]*changed.aspect,p.s[2]]};near(copy.s[2],.44);
 }
});

test('old unoriented rear collectors reframe on load without moving or reshaping their box',()=>{
 const ship=C.buildDesign('craft_tie_in'),saved=C.serialize(ship),expected=new Map();
 for(const p of saved.parts.filter(p=>p.label==='翼中央パネル')){
  p.s=[1.7,.44,1.9];p.roll=0;delete p.panelBracing;delete p.panelSparX;p.panelFrame=.06;p.panelRib=.035;
  expected.set(p.id,[p.c[0]-.85,p.c[1]-.95,p.c[2]-.22,p.c[0]+.85,p.c[1]+.95,p.c[2]+.22]);
 }
 const before=JSON.stringify(saved),loaded=C.deserialize(saved);assert.equal(JSON.stringify(saved),before);
 for(const p of loaded.parts.filter(p=>p.label==='翼中央パネル')){near(C.solarArea(p),3.23);near(p.s[2],.44);assert.equal(p.panelBracing,'none');C.partAABB(p).forEach((v,i)=>near(v,expected.get(p.id)[i],1e-6));}
 const again=C.deserialize(C.serialize(loaded));for(const p of again.parts.filter(p=>p.label==='翼中央パネル'))near(C.solarArea(p),3.23);
 const custom=plain(saved),p=custom.parts.find(p=>p.label==='翼中央パネル');p.outline=[[-.5,-.5],[.5,-.5],[.2,.5],[-.5,.5]];const kept=C.deserialize(custom).parts.find(q=>q.id===p.id);near(kept.s[1],.44);near(kept.s[2],1.9);near(kept.roll||0,0);
});
