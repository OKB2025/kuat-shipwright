// v24 Whole-design scaling (docs/ship-scaling-v24.md): the hull keeps its shape at the new size, structures and
// interior equipment scale or keep their size by choice, fixed-size equipment keeps its size and is re-seated.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(root);
const plain=x=>JSON.parse(C.publicJSON(x)),K=2200/1600;
const near=(a,b,t=1e-9,msg='')=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${msg} ${a} != ${b}`);
const nearV=(a,b,t=1e-9,msg='')=>{assert.equal(a.length,b.length,msg);a.forEach((v,i)=>near(v,b[i],t,msg+'['+i+']'));};
const imperialSource=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples/imperial/design.json.gz'))));
const imperial=()=>C.deserialize(JSON.parse(JSON.stringify(imperialSource)));
const runs=new Map();
function scaled(structures,interior){const key=structures+'/'+interior;if(!runs.has(key)){const ship=imperial(),report=C.scaleShipDesign(ship,{length:2200,structures,interior,validate:'full',warnings:true});runs.set(key,{ship,report});}return runs.get(key);}
const category=(ship,p)=>{const hull=C.primaryHullPart(ship);if(p===hull)return 'hull';if(C.isShapePart(p))return C.equipmentSpec(p)?'fixed':'structure';return C.placementCapability(p).space==='interior'?'interior':'fixed';};
const LENGTHS=['d','length','ridge','shellThick','offsetX','offsetZ'],VECTORS=['s','room'];
function bounds(T){const b=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];for(let i=0;i<T.length;i+=3)for(let j=0;j<3;j++){b[j]=Math.min(b[j],T[i+j]);b[j+3]=Math.max(b[j+3],T[i+j]);}return b;}
function volume(T){let v=0;for(let i=0;i<T.length;i+=9)v+=(T[i]*(T[i+4]*T[i+8]-T[i+5]*T[i+7])-T[i+1]*(T[i+3]*T[i+8]-T[i+5]*T[i+6])+T[i+2]*(T[i+3]*T[i+7]-T[i+4]*T[i+6]))/6;return v;}
function mirrorPairs(ship){const out=[];for(const list of ['parts','fits'])for(const a of ship[list]){const pa=a.c||a.p;if(!pa||pa[2]<=1e-3)continue;const b=ship[list].find(q=>q!==a&&q.k===a.k&&(q.c||q.p)&&Math.abs((q.c||q.p)[2]+pa[2])<1e-6&&Math.abs((q.c||q.p)[0]-pa[0])<1e-6&&Math.abs((q.c||q.p)[1]-pa[1])<1e-6);if(b)out.push([list,a.id,b.id]);}return out;}

test('Imperial-class to 2,200 m: the hull and every cut, trench and opening keep their shape at the new size',()=>{
 const base=imperial(),{ship,report}=scaled('scale','scale'),h0=C.primaryHullPart(base),h=C.primaryHullPart(ship);
 near(report.factor,K);assert.equal(report.changed,true);assert.equal(report.validated,'full');
 assert.deepEqual(plain(report.unseated),{parts:[],fits:[]},JSON.stringify(report.unseated));
 nearV(h.s,h0.s.map(v=>v*K),1e-12,'hull size');nearV(h.c,h0.c.map(v=>v*K),1e-12,'hull centre');near(h.hullProfile.L,2200,1e-12);near(ship.hull.L,2200,1e-12);
 assert.deepEqual(h.hullProfile.stations,h0.hullProfile.stations,'profile fractions');
 near(h.s[1]/h.s[0],h0.s[1]/h0.s[0],1e-12,'W/L');near(h.s[2]/h.s[0],h0.s[2]/h0.s[0],1e-12,'H/L');
 const d0=h0.hullData,d=h.hullData;assert.ok(d.solidCuts.length>0&&d.trenches.length>0&&d.hatches.length>0);
 d.solidCuts.forEach((q,i)=>{nearV(q.c,d0.solidCuts[i].c.map(v=>v*K),1e-12,'cut c');nearV(q.s,d0.solidCuts[i].s.map(v=>v*K),1e-9,'cut s');assert.deepEqual(q.rotation,d0.solidCuts[i].rotation);assert.deepEqual(q.verts,d0.solidCuts[i].verts);});
 d.trenches.forEach((t,i)=>{near(t.height,d0.trenches[i].height*K);near(t.depth,d0.trenches[i].depth*K);assert.equal(t.from,d0.trenches[i].from);assert.equal(t.to,d0.trenches[i].to);});
 d.hatches.forEach((a,i)=>{nearV(a.a,d0.hatches[i].a.map(v=>v*K),1e-12,'hatch a');nearV(a.b,d0.hatches[i].b.map(v=>v*K),1e-12,'hatch b');near(a.w,d0.hatches[i].w*K);});
 for(const b of ship.hatches.filter(x=>x.hullOwner===h.id)){const o=base.hatches.find(x=>x.id===b.id);nearV(b.a,o.a.map(v=>v*K),1e-9,'public hatch');}
 // Normalised geometry: the cut hull divided by the factor is the original cut hull.
 const T0=C.hullStructureGeometry(base,h0).tris,T=C.hullStructureGeometry(ship,h).tris;
 // The cut solver works with tolerances in metres, so the scaled solid matches to about 1e-4 of the volume.
 near(volume(T),volume(T0)*K**3,1e-4,'hull volume');nearV(bounds(T),bounds(T0).map(v=>v*K),1e-6,'hull bounds');
 nearV(C.designEnvelope(ship)?Object.values(C.designEnvelope(ship)):[],Object.values(C.designEnvelope(base)).map(v=>v*K),1e-12,'planned size');
});

test('structures and interior equipment scale with the hull when asked; positions and sizes follow by the same factor',()=>{
 const base=imperial(),{ship}=scaled('scale','scale');let structures=0,interior=0;
 for(const p of ship.parts){const o=base.parts.find(q=>q.id===p.id),c=category(ship,p);if(c!=='structure'&&c!=='interior')continue;c==='structure'?structures++:interior++;
  nearV(p.c,o.c.map(v=>v*K),1e-9,c+' #'+p.id+' c');for(const k of LENGTHS)if(Number.isFinite(o[k]))near(p[k],o[k]*K,1e-12,c+' #'+p.id+' '+k);for(const k of VECTORS)if(Array.isArray(o[k]))nearV(p[k],o[k].map(v=>v*K),1e-12,c+' #'+p.id+' '+k);
  for(const k of ['outline','loft','taper','corner','deckSlope','wallInset'])assert.deepEqual(p[k],o[k],c+' #'+p.id+' '+k);}
 assert.equal(structures,24);assert.equal(interior,45);
 const tower=ship.parts.find(p=>p.form==='loft'),tower0=base.parts.find(p=>p.id===tower.id);near(volume(C.structTriangles(tower)),volume(C.structTriangles(tower0))*K**3,1e-6,'structure volume');
});

test('fixed-size equipment keeps its size, moves to its scaled position and stays mounted on its host surface',()=>{
 const base=imperial(),{ship}=scaled('scale','scale');let parts=0;
 for(const p of ship.parts){if(category(ship,p)!=='fixed')continue;parts++;const o=base.parts.find(q=>q.id===p.id);for(const k of ['d','s','skinSize','nozzleLength','bodyLength','skinDiameter','skinAnchor'])assert.deepEqual(p[k],o[k],'#'+p.id+' '+k);assert.ok(Math.hypot(...p.c.map((v,i)=>v-o.c[i]))>1,'#'+p.id+' moved');}
 assert.equal(parts,11);
 // Engines keep their row: each stays seated where its thrust axis meets the stern, so height and beam scale.
 for(const p of ship.parts.filter(q=>q.k==='engine')){const o=base.parts.find(q=>q.id===p.id);near(p.c[1],o.c[1]*K,1e-9,'engine y');near(p.c[2],o.c[2]*K,1e-9,'engine z');}
 for(const f of ship.fits){const o=base.fits.find(q=>q.id===f.id);assert.ok(o,'fit #'+f.id);for(const k of ['k','width','height','ped','pedSize','chargeDepth','host','a'])assert.deepEqual(f[k],o[k],'fit #'+f.id+' '+k);assert.equal(f.float,false,'fit #'+f.id+' seated');if(o.local)nearV(f.local,o.local,1e-6,'fit #'+f.id+' local');}
 // On the hull itself a fitting lands exactly on the scaled point of its old mount.
 for(const f of ship.fits.filter(q=>q.host===C.primaryHullPart(ship).id)){const o=base.fits.find(q=>q.id===f.id);nearV(f.p,o.p.map(v=>v*K),1e-6,'hull fit #'+f.id);}
});

test('mirror twins stay mirror images',()=>{
 for(const [s,i] of [['scale','scale'],['keep','keep']]){const base=imperial(),{ship}=scaled(s,i),pairs=mirrorPairs(base);assert.ok(pairs.length>20);
  for(const [list,a,b] of pairs){const A=ship[list].find(q=>q.id===a),B=ship[list].find(q=>q.id===b),pa=A.c||A.p,pb=B.c||B.p;near(pa[0],pb[0],1e-6,list+' '+a+'/'+b+' x');near(pa[1],pb[1],1e-6,list+' '+a+'/'+b+' y');near(pa[2],-pb[2],1e-6,list+' '+a+'/'+b+' z');}
  for(const p of ship.parts){const o=base.parts.find(q=>q.id===p.id);if(Math.abs(o.c[2])<1e-9)near(p.c[2],0,1e-9,s+'/'+i+' centreline #'+p.id);}}
});

test('keeping structures and interior sizes: only positions follow the hull, everything stays seated',()=>{
 const base=imperial(),{ship,report}=scaled('keep','keep');
 assert.deepEqual(plain(report.unseated),{parts:[],fits:[]},JSON.stringify(report.unseated));assert.deepEqual(plain(report.counts.structures),{scaled:0,kept:24});assert.deepEqual(plain(report.counts.interior),{scaled:0,kept:45});
 for(const p of ship.parts){const o=base.parts.find(q=>q.id===p.id),c=category(ship,p);if(c==='hull')continue;for(const k of [...LENGTHS,...VECTORS])assert.deepEqual(p[k],o[k],c+' #'+p.id+' '+k);
  if(c==='interior')nearV(p.c,o.c.map(v=>v*K),1e-9,'interior #'+p.id);}
 // A kept structure moves rigidly with the point it rests on: its offset from that point is unchanged.
 const moved=ship.parts.filter(p=>category(ship,p)==='structure').map(p=>{const o=base.parts.find(q=>q.id===p.id);return p.c.map((v,i)=>v-o.c[i]*K);});assert.ok(moved.some(d=>Math.hypot(...d)>1));
});

// The loader leaves a fitting's derived mount flag (float:false) to the next mount; nothing else may change.
const stable=v=>JSON.stringify(v,(k,x)=>k==='float'&&x===false?undefined:x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(n=>[n,x[n]])):x);
test('save and reload keep the scaled design',()=>{
 const {ship}=scaled('scale','scale'),saved=C.serialize(ship),again=C.deserialize(JSON.parse(JSON.stringify(saved))),resaved=C.serialize(again);
 assert.equal(stable(resaved),stable(saved));assert.equal(JSON.stringify(C.serialize(C.deserialize(JSON.parse(JSON.stringify(resaved))))),JSON.stringify(resaved));near(C.primaryHullPart(again).s[0],2200,1e-12);near(again.hull.L,2200,1e-12);
 assert.equal(again.parts.length,ship.parts.length);assert.equal(again.fits.length,ship.fits.length);
});

function metaFixture(){
 const s=C.newShip({L:400,W:120,H:60,sec:'warship',plan:'wedge'},'scaling metadata fixture'),hull=C.ensurePrimaryHull(s,{newDesign:true}),top=C.rayPart([150,500,0],[0,-1,0],hull);
 let r=C.commitPlacement(s,{id:-1,k:'struct',form:'box',c:[0,0,0],s:[40,30,20]},{mode:'horizontal',parentStructureId:hull.id,hit:top,contactFit:'cut',position:[150,top.p[1]+10,0]});assert.equal(r.ok,true,r.error);const tower=r.part;
 const roof=C.rayPart([150,500,0],[0,-1,0],tower);r=C.commitPlacement(s,{id:-1,k:'sensor',c:[0,0,0],d:6},{mode:'direct',parentStructureId:tower.id,hit:roof,position:[150,roof.p[1]+3,0]});assert.equal(r.ok,true,r.error);
 r=C.commitPlacement(s,{id:-1,k:'cargo',c:[120,25,0],room:[30,10,10],d:Math.cbrt(3000)},{mode:'clip',hostId:hull.id});assert.equal(r.ok,true,r.error);
 const side=C.rayPart([200,30,300],[0,0,-1],hull);C.placeFit(s,'pd',side.p,side.n,0,true);
 return {s,hull,tower,roof,top};
}
test('editor placements: the solver re-seats kept and scaled structures on their scaled contact, children follow',()=>{
 for(const structures of ['scale','keep']){const {s,top,roof}=metaFixture(),tower=s.parts.find(p=>p.k==='struct'&&!C.isHullStructure(p)),sensor=s.parts.find(p=>p.k==='sensor'),cargo=s.parts.find(p=>p.k==='cargo'),k=1.5;
  const report=C.scaleShipDesign(s,{factor:k,structures,interior:'scale',validate:'full'});assert.equal(report.ok,true,JSON.stringify(report.unseated));
  const base=[top.p[0]*k,top.p[1]*k,0],ts=structures==='scale'?k:1;nearV(tower.s,[40,30,20].map(v=>v*ts),1e-9,structures+' tower size');nearV(tower.c,[base[0],base[1]+10*ts,0],1e-6,structures+' tower centre');
  near(sensor.d,6,1e-12,'sensor keeps its size');nearV(sensor.c,[base[0],base[1]+20*ts+3,0],1e-6,structures+' sensor on the tower roof');
  nearV(cargo.c,[120*k,25*k,0],1e-9,'cargo');nearV(cargo.room,[30*k,10*k,10*k],1e-9,'cargo room');nearV(cargo.placement.requestedGeometry.room,cargo.room,1e-9,'requested room');
  assert.ok(C.placementDiagnostics(s).every(d=>d.connected),JSON.stringify(C.placementDiagnostics(s)));
  const [f,g]=s.fits;assert.equal(f.float,false);assert.equal(g.float,false);near(f.p[2],-g.p[2],1e-9,'fit twins');
  void roof;}
});

test('physics follows the scaled geometry through the ordinary statistics',()=>{
 const {s}=metaFixture(),a=C.computeStats(s);C.scaleShipDesign(s,{factor:2,structures:'scale',interior:'scale'});const b=C.computeStats(s);
 // Hull and structure volume is exactly k³ (the stats object is reused, as in the Worker). The surface area is a little
 // under k² because the sensor and the fittings keep their size; mass grows by k³ for scaled parts only.
 near(b.volume/a.volume,8,1e-9,'volume');near(b.area/a.area,4,5e-3,'area');assert.ok(b.mass>a.mass*4&&b.mass<a.mass*8,`mass ${a.mass} -> ${b.mass}`);
});

test('items that the existing checks reject after scaling are reported, not moved or deleted',()=>{
 const s=C.newShip({L:8000,W:2000,H:1000,sec:'rect',plan:'rect',bowW:1,bowH:1,stern:1},'trench fixture');s.parts=[];s.fits=[];s.hatches=[];C.ensurePrimaryHull(s);
 const made=C.configureTrenchArmament(s,{hostId:C.primaryHullPart(s).id,newTrench:{mode:'split',from:.2,to:.8,level:.5,height:400,depth:100,side:'both',taper:false},counts:[{kind:'monCal34',count:10}]});assert.equal(made.ok,true,made.error);
 const fits=s.fits.length,report=C.scaleShipDesign(s,{factor:.01});assert.equal(report.changed,true);assert.equal(s.fits.length,fits,'nothing is deleted');
 assert.ok(report.unseated.fits.length>0,JSON.stringify(report));assert.equal(report.ok,false);assert.ok(report.unseated.fits.every(r=>r.code==='trench-invalid'&&r.label&&r.error));assert.ok(s.fits.every(f=>f.float&&Math.abs(f.p[0])<8000*.01*2),'kept at the scaled position');
});

test('the preview is pure and the limits refuse a factor before anything changes',()=>{
 const ship=imperial(),before=C.publicJSON(ship),p=C.shipScalePreview(ship,{length:2200,structures:'keep'});
 assert.equal(C.publicJSON(ship),before);near(p.factor,K);nearV(p.hull.after,C.primaryHullPart(ship).s.map(v=>v*K));assert.deepEqual(plain(p.options),{structures:'keep',interior:'scale'});assert.equal(p.limitError,null);
 assert.deepEqual(plain(p.counts),{hull:1,structure:24,interior:45,fixed:62});
 assert.match(C.shipScalePreview(ship,{length:40000}).limitError,/上限/);assert.throws(()=>C.scaleShipDesign(ship,{length:40000}),/上限/);assert.equal(C.publicJSON(ship),before);
 assert.throws(()=>C.scaleShipDesign(ship,{factor:0}),/正の値/);assert.equal(C.scaleShipDesign(ship,{factor:1}).changed,false);assert.equal(C.publicJSON(ship),before);
});

// Physics review (2026-11-11) follow-ups.
const K3=K**3,frigate=()=>C.buildDesign('frigate'),destroyer=()=>C.buildDesign('destroyer');
test('bevels keep their shape: inset and slope are metres whether or not they are proportional (also the single-axis resize)',()=>{
 for(const [make,prop] of [[frigate,false],[destroyer,true]]){
  for(const how of ['resize','scale']){const s=make(),h=C.primaryHullPart(s),c0=plain(h.hullData.cuts[0]),v0=volume(C.hullStructureGeometry(s,h).tris);assert.equal(!!c0.prop,prop);
   if(how==='resize')C.setHullStructureDimensions(s,h,h.s.map(v=>v*2));else C.scaleShipDesign(s,{factor:2,validate:false});
   const c=h.hullData.cuts[0];near(c.inset,c0.inset*2,1e-12,how+' inset');near(c.slope,c0.slope*2,1e-12,how+' slope');assert.equal(c.prop,c0.prop);
   near(volume(C.hullStructureGeometry(s,h).tris)/v0,8,1e-6,(prop?'proportional':'metre')+' bevel hull volume, '+how);}
 }
});
const figures=S=>({volume:S.volume,hullVolume:S.hullVolume,area:S.area,mass:S.mass});
test('the statistics of a scaled design do not depend on the path: in memory, reloaded, or computed on the object before scaling',()=>{
 const a=frigate();C.scaleShipDesign(a,{factor:1.5});const A=figures(C.computeStats(a)),B=figures(C.computeStats(C.deserialize({...JSON.parse(C.publicJSON(a)),format:'starship-yard',v:3})));
 for(const k of Object.keys(A))near(A[k],B[k],1e-9,'(a)==(b) '+k);
 // The editor's Worker keeps one object: statistics before the edit used to leave the old hull's union checkpoint
 // (STRUCTURAL_PREFIX), which a resized or scaled hull then resumed from.
 for(const how of ['scale','resize']){const w=JSON.parse(C.publicJSON(frigate()));C.syncCompartments(w);C.computeStats(w);if(how==='scale')C.scaleShipDesign(w,{factor:1.5});else{const h=C.primaryHullPart(w);C.setHullStructureDimensions(w,h,h.s.map(v=>v*1.5));}C.syncCompartments(w);
  const f=JSON.parse(C.publicJSON(w));C.syncCompartments(f);const W=figures(C.computeStats(w)),F=figures(C.computeStats(f));for(const k of Object.keys(W))near(W[k],F[k],1e-9,how+' warm==fresh '+k);}
});
test('user decision: stored power and heat capacities scale by k³ whatever the options; an engine core keeps feed = 1.3 × rated',()=>{
 const base=imperial(),links0=new Map(base.links.map(l=>[l.from+'>'+l.to+':'+l.kind,l]));
 for(const [st,it] of [['scale','scale'],['keep','keep']]){const {ship,report}=scaled(st,it);near(report.capacityFactor,K3,1e-12);let n=0;
  for(const l of ship.links){const o=links0.get(l.from+'>'+l.to+':'+l.kind);if(o&&Number.isFinite(o.cap)){near(l.cap,o.cap*K3,1e-9,st+' link cap');n++;}}assert.ok(n>100,'links checked '+n);
  for(const p of ship.parts){const o=base.parts.find(q=>q.id===p.id);for(const k of ['ratedInputW','feedCapacityW','legacyCoolingInputW','shieldDissipationW'])if(Number.isFinite(o[k]))near(p[k],o[k]*K3,1e-9,st+' #'+p.id+' '+k);
   if(p.k==='engineCore'&&o.feedCapacityW)near(p.feedCapacityW/p.ratedInputW,o.feedCapacityW/o.ratedInputW,1e-12,'feed/rated');}}
});
test('new warnings are returned with the report: none for the scaled ship, support and hangar warnings when the interior keeps its size',()=>{
 const a=scaled('scale','scale').report,b=scaled('keep','keep').report;
 assert.deepEqual(plain(a.warnings.added),[],JSON.stringify(a.warnings));
 const added=b.warnings.added.map(w=>w.text).join('\n');assert.match(added,/慣性制御装置の対応質量が不足/);assert.match(added,/構造維持装置の対応質量が不足/);
});
const towerOf=s=>s.parts.find(p=>p.k==='struct'&&p.form==='box'&&!p.plate);
test('armour thickness is a protection specification: plate thickness and surface armour stay as they are',()=>{
 for(const structures of ['scale','keep']){const {s}=metaFixture(),plate={id:s.nextId++,k:'struct',form:'box',c:[100,64,0],s:[20,20,1],plate:true,plateT:2.5};s.parts.push(plate);
  const id=C.surfacePatches(s).find(p=>p.exposed&&p.id.startsWith('p'+towerOf(s).id+':'))?.id;assert.ok(id,'a tower face');
  assert.notEqual(C.setSurfaceConfig(s,[id],{armor:{thickness:3}}).ok,false);
  C.scaleShipDesign(s,{factor:2,structures,validate:false});assert.equal(plate.plateT,2.5);assert.equal(C.surfaceConfig(s,id).armor.thickness,3);}
});
test('solar wing frame and rib widths (metres) scale with the structures',()=>{
 for(const structures of ['scale','keep']){const {s}=metaFixture(),panel={id:s.nextId++,k:'solarPanel',form:'outline',c:[100,80,40],s:[10,6,.1],outline:[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]],wing:{solar:true},panelFrame:.4,panelRib:.2};s.parts.push(panel);
  C.scaleShipDesign(s,{factor:2,structures,validate:false});const f=structures==='scale'?2:1;near(panel.panelFrame,.4*f);near(panel.panelRib,.2*f);}
});
test('every load-time clamp is checked before anything changes',()=>{
 const cases=[[s=>{C.primaryHullPart(s).hullData.trenches.push({id:900,side:'both',from:.3,to:.6,level:.5,height:300,depth:20});},2,/トレンチ/],
  [s=>{C.primaryHullPart(s).hullData.cuts.push({id:901,side:'both',edge:'top',inset:600,slope:30,from:0,to:1});},2,/面取り/],
  [s=>{towerOf(s).shellThick=40;},2,/板厚/],
  [s=>{towerOf(s).s=[40,30,.03];},.5,/寸法/],
  [s=>{towerOf(s).ridge=600;},2,/稜線/]];
 for(const [edit,factor,re] of cases){const {s}=metaFixture();edit(s);const before=C.publicJSON(s);assert.throws(()=>C.scaleShipDesign(s,{factor}),re);assert.equal(C.publicJSON(s),before);assert.match(C.shipScalePreview(s,{factor}).limitError,re);}
});
test('mirror images are paired across a bucket boundary',()=>{
 const {s}=metaFixture(),x=150+400*1e-4*.5;s.parts.push({id:s.nextId++,k:'sensor',c:[x-1e-9,70,20],d:4},{id:s.nextId++,k:'sensor',c:[x+1e-9,70,-20],d:4});
 const plan=C.shipScalePlan(s,C.primaryHullPart(s),2,{structures:'keep',interior:'scale'}),rows=[...plan.rows.values()].filter(r=>r.item.k==='sensor'&&r.item.d===4);
 assert.equal(rows.length,2);assert.equal(plan.partner.get(rows[0]),rows[1]);
});
test('surface settings stay on the same faces through scaling, saving and reloading',()=>{
 const {s}=metaFixture(),tower=towerOf(s),hullId=C.primaryHullPart(s).id,faces=C.surfacePatches(s).filter(p=>p.exposed);
 const ids=[faces.find(p=>p.id.startsWith('p'+tower.id+':')).id,faces.find(p=>p.id.startsWith('p'+hullId+':')).id];
 const centre=(ship,id)=>{const T=C.surfacePatches(ship).find(p=>p.id===id).triangles;const c=[0,0,0];for(let i=0;i<T.length;i+=3)for(let j=0;j<3;j++)c[j]+=T[i+j]*3/T.length;return c;},c0=ids.map(id=>centre(s,id));
 assert.notEqual(C.setSurfaceConfig(s,ids,{armor:{thickness:4,material:'dense'}}).ok,false);
 C.scaleShipDesign(s,{factor:2,validate:false});const again=C.deserialize(JSON.parse(JSON.stringify(C.serialize(s))));
 ids.forEach((id,i)=>{const q=again.surfaces.patches.find(p=>p.id===id);assert.ok(q,id);assert.equal(q.armor.thickness,4);assert.equal(q.armor.material,'dense');nearV(centre(again,id),c0[i].map(v=>v*2),1e-6,'face '+id);});
});
