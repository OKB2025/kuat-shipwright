const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js']){let source=fs.readFileSync(path.join(root,f),'utf8');if(f==='js/core.js')source=source.replace('function hatchTick(w, dt) {','globalThis.hatchProbe={launchSquad,launchStep,squadHome,hatchTick,opsPlace,mouthsOf,RULES};\nfunction hatchTick(w, dt) {');vm.runInContext(source,cx,{filename:f});}
const {C,R,G,D,P}=vm.runInContext('({C:Core,R:Rts,G:Gfx,D:YardFleetData.designs,P:hatchProbe})',cx),plain=x=>JSON.parse(JSON.stringify(x)),dt=.25;
// A real public carrier world, with two explicit test mouths to isolate door
// scheduling. The operations themselves are production functions, not a model
// of them. These tests do not claim stock-aircraft flight endurance coverage.
function fixture({legacy=false,secondFits=true}={}){
 const design=plain(D.mc80home),w=R.createWorld({mode:'test',region:'kuat',seed:17,designs:[design],sides:[{faction:'rebel',ai:false},{faction:'empire',ai:false}],fleets:[[{design:design.key,air:[{craft:'xwing',n:6,wingNo:1}]}],[]]});
 const u=[...w.units.values()][0],s=[...w.squads.values()][0];u.warp=null;u.velocity=[0,0,0];u.order={type:'hold',fire:false};
 u.p={...u.p,slidingHatches:2,hatchOpenSeconds:4,hatchCloseSeconds:4,mouths:[{hatchId:101,p:[0,20,0],n:[0,1,0],ax:[1,0,0],o:[60,40],r:20,in:[0,0,0],d:10,sl:1},{hatchId:202,p:[0,-20,0],n:[0,-1,0],ax:[1,0,0],o:secondFits?[60,40]:[.1,.1],r:20,in:[0,0,0],d:10,sl:1}]};
 if(legacy)u.p.mouths.forEach(m=>delete m.hatchId);s.state='docked';s.ops=null;s.t=0;u.mq=[];
 return{w,u,s};
}
function frame(f,operation){f.w.time+=dt;if(operation)operation();P.hatchTick(f.w,dt);}
function advance(f,operation,predicate,limit=800){for(let i=0;i<limit&&!predicate();i++)frame(f,operation);assert.ok(predicate(),'operation must complete');}
test('only the selected launch mouth opens and it closes after the final aircraft clears',()=>{
 const f=fixture(),{w,u,s}=f,ids=plain(s.slots);assert.equal(u.hatchOpen,0);
 advance(f,()=>P.launchSquad(w,u,s),()=>s.ops?.k==='launch');assert.equal(u.hatchOpenById[101],1);assert.equal(u.hatchOpenById[202],0);assert.equal(s.ops.m,0);
 const count=s.n;advance(f,()=>P.launchStep(w,s,u),()=>!s.ops);assert.equal(s.n,count);assert.deepEqual(plain(s.slots),ids);
 frame(f);assert.equal(u.hatchTarget,0);assert.ok(u.hatchOpenById[101]<1,'no six-second idle hold');
 advance(f,null,()=>u.hatchOpen===0);assert.equal(s.state,'out');
});
test('cancelled launch preparation and a stale old hatch timestamp cannot hold doors open',()=>{
 const f=fixture();frame(f,()=>P.launchSquad(f.w,f.u,f.s));assert.ok(f.u.hatchOpenById[101]>0);assert.equal(f.s.state,'docked');
 frame(f);assert.equal(f.u.hatchTarget,0);assert.equal(f.u.hatchOpen,0);
 f.u.hatchWant=f.w.time;frame(f);assert.equal(f.u.hatchOpen,0,'legacy timestamp alone is not an active operation');
});
test('landing waits for its own closed door even when another mouth is fully open, then closes after docking',()=>{
 const f=fixture({secondFits:false}),{w,u,s}=f,m=u.p.mouths[0];u.hatchOpen=1;u.hatchOpenById={101:0,202:1};s.state='return';s.landM=0;s.pos=C.add(C.add(u.pos,m.p),C.mul(m.n,P.RULES.gateD));
 frame(f,()=>P.squadHome(w,s,u,dt));assert.equal(s.ops.k,'hold');assert.equal(s.ops.m,0);assert.ok(u.hatchOpenById[101]<1);
 advance(f,()=>P.squadHome(w,s,u,dt),()=>s.state==='docked');assert.equal(s.ops,null);assert.equal(s.n,6);
 frame(f);assert.equal(u.hatchTarget,0);assert.ok(u.hatchOpenById[101]<1);advance(f,null,()=>u.hatchOpen===0);
});
test('simultaneous mouths retain independent traffic and finish without duplicating aircraft',()=>{
 const f=fixture(),{w,u,s}=f,t={...plain(s),id:'second-squad',slots:[100,101,102,103,104,105]};w.squads.set(t.id,t);u.squads.push(t.id);u.hatchOpen=1;u.hatchOpenById={101:1,202:1};
 frame(f,()=>{assert.ok(P.launchSquad(w,u,s));assert.ok(P.launchSquad(w,u,t));});assert.notEqual(s.ops.m,t.ops.m);
 const total=s.n+t.n;advance(f,()=>{if(s.ops)P.launchStep(w,s,u);if(t.ops)P.launchStep(w,t,u);},()=>!s.ops&&!t.ops);
 assert.equal(s.n+t.n,total);assert.equal(new Set([...s.slots,...t.slots]).size,total);frame(f);assert.equal(u.hatchTarget,0);advance(f,null,()=>u.hatchOpen===0);
});
test('recalling a launching squadron preserves its current mouth until the last aircraft clears',()=>{
 const f=fixture(),{w,u,s}=f;advance(f,()=>P.launchSquad(w,u,s),()=>s.ops?.k==='launch');const original=plain(s.ops),wing=w.wings.get(s.wing);
 assert.ok(wing);assert.ok(R.orderWing(w,wing.id,{type:'standby'}));assert.equal(s.state,'return');
 // Even a landing preference for another mouth must not replace active rails.
 s.landM=1;while(s.ops){frame(f,()=>P.squadHome(w,s,u,dt));if(s.ops){assert.equal(s.ops.k,'launch');assert.equal(s.ops.m,original.m);assert.equal(s.ops.t0,original.t0);}}
 assert.equal(s.n,6);assert.equal(s.state,'return');frame(f);assert.equal(u.hatchTarget,0);
});
test('legacy mouths without stable hatch IDs retain timed launch and closing behavior',()=>{
 const f=fixture({legacy:true});advance(f,()=>P.launchSquad(f.w,f.u,f.s),()=>f.s.ops?.k==='launch');assert.equal(f.u.hatchLegacy,true);assert.equal(f.u.hatchOpen,1);
 advance(f,()=>P.launchStep(f.w,f.s,f.u),()=>!f.s.ops);frame(f);assert.equal(f.u.hatchTarget,0);advance(f,null,()=>f.u.hatchOpen===0);
});
test('the abstract fleet clock closes idle doors after combat, disables launch while out, and stops at full deployment',()=>{
 for(const kind of ['peace','disabled','deployed']){
  const profile={...plain(D.cr90.p),slots:6,launch:1,slidingHatches:1,hatchOpenSeconds:4,hatchCloseSeconds:4},u=C.fleetUnit('idle-doors','cr90',profile,0);u.order={...u.order,type:'hold',fire:false,launch:true};u.hatchOpen=1;u.hatchTarget=1;
  if(kind==='disabled')u.out='test-disabled';if(kind==='deployed')u.launched=profile.slots;
  const before=u.launched,b=C.fleetBattle([u],kind!=='peace');for(let i=0;i<20;i++)C.fleetTick(b,.25,{collide:false});
  assert.equal(u.hatchOpen,0,kind+' has no active launch operation');assert.equal(u.hatchTarget,0);assert.equal(u.launched,before);assert.equal(u.queue.length,0);if(kind==='disabled')assert.ok(u.out,'closing doors cannot restore disabled navigation');
 }
});

function geometry(){
 const s=C.newShip({L:200,W:100,H:100,plan:'rect',sec:'rect',bowW:1,bowH:1,stern:1},'Independent aviation doors');s.parts=[];s.fits=[];s.detail=0;s.autoHabitation=false;s.armor={hull:0,cit:0};
 const top=C.placePart(s,'hangar',[70,90,0],40,{room:[40,40,40],allowOverlap:true},false),bottom=C.placePart(s,'hangar',[130,10,0],40,{room:[40,40,40],allowOverlap:true},false),a=C.openBay(s,top,'top','ray'),b=C.openBay(s,bottom,'bottom','open');
 for(const h of [a,b]){h.motion='slide';h.open=0;}C.syncCompartments(s);const stats=C.computeStats(s);return{s,a,b,stats,data:G.fleetGeometry(s)};
}
test('Core mouth IDs match detached rendered door and ray IDs without changing the saved design',()=>{
 const {s,a,b,stats,data}=geometry(),before=C.publicJSON(s),mouths=C.airMouths(s,stats);
 assert.ok(mouths.some(m=>m.hatchId===a.id&&m.sl));assert.ok(mouths.some(m=>m.hatchId===b.id&&m.sl));assert.ok(data.doors.some(d=>d.hatchId===a.id));assert.ok(data.doors.some(d=>d.hatchId===b.id));assert.ok(data.rays.some(r=>r.hatchId===a.id));
 G.fleetGeometry(s);assert.equal(C.publicJSON(s),before,'rendering cannot open or alter the editable blueprint');
});
const I3=[1,0,0,0,1,0,0,0,1],I4=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function renderer(data,compat){
 const calls=[],ctx={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:()=>{}},canvas={width:32,height:64,clientWidth:32,clientHeight:64,getContext:()=>ctx};let r;
 if(compat){r=new G.CompatRenderer(canvas);r.matrices=()=>({VP:I4});r.rasterMesh=(geo,source,alpha,clip,transform)=>{if(geo?.ni)calls.push({name:Object.entries(data.meshes).find(([,m])=>m.geo===geo)?.[0]||source,off:plain(transform.off)});};r.paintLines=()=>{};}
 else{r=Object.create(G.Renderer.prototype);Object.assign(r,{canvas,gl:new Proxy({}, {get:(_,k)=>/^[A-Z_]+$/.test(String(k))?0:()=>{}}),off:[0,0,0],meshes:{},cam:{target:[0,0,0],fov:.72},look:{shadow:false}});r.upload=function(name,geo){this.meshes[name]={geo,count:geo.ni};};r.drawMesh=function(name){if(this.meshes[name]?.count)calls.push({name,off:plain(this.off)});};r.setLights=r.drawLines=r.setPoints=r.drawPoints=()=>{};r.drawRays=(m,names)=>{for(const name of names)if(r.meshes[name]?.count)calls.push({name,off:plain(r.off)});};}
 r.eye=()=>[0,0,1000];r.loadFleet('doors',data);return{r,calls,draw:(u,mode='trial')=>{calls.length=0;const opt={fleet:[u],mode};if(compat)r.draw(opt);else r.drawFleet({VP:I4,eye:r.eye()},opt);return calls;}};
}
for(const compat of [false,true])test(`${compat?'compatibility':'WebGL'} renderer moves only the operating door and resolves old cached mesh IDs`,()=>{
 const {a,b,data}=geometry();for(const oldMetadata of [false,true]){
  const asset={...data,doors:data.doors.map(d=>({...d})),rays:data.rays.map(d=>({...d}))};if(oldMetadata)for(const row of [...asset.doors,...asset.rays])delete row.hatchId;
  const {draw}=renderer(asset,compat),u={key:'doors',pos:[3,4,5],rot:I3,hatchOpen:1,hatchOpenById:{[a.id]:1,[b.id]:0},glow:0},calls=draw(u),door=data.doors.find(d=>d.hatchId===a.id),other=data.doors.find(d=>d.hatchId===b.id),expected=u.pos.slice();expected[door.axis]+=door.side*door.travel;
  assert.deepEqual(calls.find(c=>c.name===door.name).off,expected);assert.deepEqual(calls.find(c=>c.name===other.name).off,u.pos);assert.ok(calls.some(c=>c.name===data.rays[0].name));
  const review=draw(u,'review');assert.deepEqual(review.find(c=>c.name===door.name).off,u.pos);assert.ok(!review.some(c=>c.name===data.rays[0].name));
  u.hatchOpenById={};assert.deepEqual(draw(u).find(c=>c.name===door.name).off,u.pos,'unrequested or missing ID stays closed');delete u.hatchOpenById;assert.deepEqual(draw(u).find(c=>c.name===door.name).off,expected,'old scalar render row remains compatible');
 }
});
test('hatch status describes landing as flight operations and localizes closing progress',()=>{
 const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),ctx=vm.createContext({console,navigator:{language:'en-US'}});
 for(const f of ['js/lang-en.js','js/i18n.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
 const start=app.indexOf('function fleetHatchText('),end=app.indexOf('\nfunction ',start+1);vm.runInContext(app.slice(start,end),ctx);
 const status=(open,target)=>vm.runInContext(`KSI18n.t(fleetHatchText({p:{slidingHatches:2},hatchOpen:${open},hatchTarget:${target}}))`,ctx);
 assert.equal(status(0,0),'Hatches Closed');assert.equal(status(1,1),'Hatches Fully Open · Flight Operations');assert.equal(status(1,0),'Hatches Closing 100%');assert.equal(status(.5,1),'Hatches Opening 50%');
});
