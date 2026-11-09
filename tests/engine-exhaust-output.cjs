const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console,performance:{now:()=>0}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',context),I=[1,0,0,0,1,0,0,0,1],VP=[.001,0,0,0,0,.001,0,0,0,0,.001,0,0,0,0,1];
function physicalGeometry(){
 const s=C.newShip({assembly:true,L:600,W:300,H:200},'Drive output rendering');s.detail=0;s.armor={hull:0,cit:0};s.fits=[];
 s.parts=[{id:1,k:'engine',c:[80,90,15],d:60,dir:[-1,0,0],nozzleLength:23,bodyLength:84,bodyRadius:.46,reactor:2},{id:2,k:'gen',c:[400,90,15],d:50}];s.nextId=3;
 const data=G.fleetGeometry(s);assert.equal(data.glow.length,4,'one real connected and unobstructed nozzle');assert.ok(data.meshes.refEngine.geo.ni>0);assert.ok(data.meshes.nozzle.geo.ni>0);
 return {ship:s,data};
}
function renderer(data){
 const buffers=new Map(),bound=new Map(),uniforms={},calls=[];let next=0,program;
 const methods={createBuffer:()=>({id:++next}),bindBuffer:(target,buffer)=>bound.set(target,buffer),bufferData:(target,value)=>buffers.set(bound.get(target),Array.from(value)),
  useProgram:p=>program=p,uniform1f:(name,value)=>uniforms[name]=value,
  drawElements:(mode,count,type,offset)=>calls.push({program,mode,count,type,offset,index:bound.get('ELEMENT_ARRAY_BUFFER'),emission:uniforms.uEmi}),
  drawArrays:(mode,start,count)=>calls.push({program,mode,start,count,emission:uniforms.uEmi}),isContextLost:()=>false};
 const gl=new Proxy(methods,{get:(o,key)=>key in o?o[key]:String(key)===String(key).toUpperCase()?key:()=>{}}),r=Object.create(G.Renderer.prototype);
 Object.assign(r,{gl,canvas:{height:600,width:800},cam:{target:[0,0,0],fov:.72},off:[3,4,5],meshes:{},lines:{},points:{},u32:true,
  pm:{p:'mesh',u:new Proxy({},{get:(_,key)=>key}),a:{aPos:0,aNor:1,aUv:2,aCol:3}},
  pp:{p:'points',u:new Proxy({},{get:(_,key)=>key}),a:{aPos:0,aCol:1,aSize:2}},
  tex:new Proxy({},{get:(_,key)=>({a:key+'-base',e:key+'-emission'})}),_capturePointDpr:1});
 r.eye=()=>[0,0,1000];const asset=r.loadFleet('physical',data),frame={VP,eye:r.eye()};
 const draw=(glow,extra={})=>{
  calls.length=0;r.drawFleet(frame,{fleet:[{key:'physical',pos:[0,0,0],rot:I,glow,...extra}]});
  const p=r.points.fleetGlow,result={calls:calls.map(call=>({...call})),points:{count:p.count,pos:buffers.get(p.pos).slice(),col:buffers.get(p.col).slice(),size:buffers.get(p.size).slice()}};
  for(const name of ['refEngine','nozzle','gen'])result[name]=result.calls.filter(call=>call.program==='mesh'&&call.index===asset.meshes[name]?.idx);
  return result;
 };
 return {r,asset,draw};
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-4,`${a} != ${b}`);

test('zero delivered drive output draws the real engine casing but submits no propulsion light or plume',()=>{
 const {ship,data}=physicalGeometry(),before=C.publicJSON(ship),{r,asset,draw}=renderer(data),out=draw(0);
 assert.ok(out.refEngine.length>0&&out.nozzle.length>0,'stopped drives retain the same visible casing and nozzle meshes');
 assert.ok(out.refEngine.every(call=>call.emission===0));assert.ok(out.nozzle.every(call=>call.emission===0));
 assert.equal(out.points.count,0);assert.equal(out.points.pos.length,0);assert.equal(out.calls.some(call=>call.program==='points'),false,'there is no stale additive point draw');
 assert.equal(out.refEngine.reduce((sum,call)=>sum+call.count,0),asset.meshes.refEngine.count,'no new or omitted casing triangles');
 assert.equal(C.publicJSON(ship),before,'output rendering does not modify machinery or its physical definition');assert.equal(r.engineK,1,'per-unit lighting state is restored');
});

test('quarter, half and full actual output increase submitted emission, glow and plume continuously',()=>{
 const {data}=physicalGeometry(),{draw}=renderer(data),levels=[.25,.5,1],out=levels.map(level=>draw(level));
 for(let i=0;i<out.length;i++){
  const f=out[i],level=levels[i];assert.equal(f.points.count,5,'one real nozzle has one glow and four bounded plume points even at quarter output');
  assert.ok(f.refEngine.every(call=>Math.abs(call.emission-level)<1e-9));assert.ok(f.nozzle.every(call=>Math.abs(call.emission-1.875*level)<1e-9));
  assert.ok(f.points.col[3]>0&&f.points.col[7]>0);assert.ok(f.points.size.every(size=>Number.isFinite(size)&&size>0));
  const origin=f.points.pos.slice(0,3),plume=f.points.pos.slice(-3);assert.ok(plume[0]<origin[0],'the plume extends aft at every nonzero output');
  if(i){const old=out[i-1];assert.ok(f.points.col[3]>old.points.col[3]);assert.ok(f.points.col[7]>old.points.col[7]);assert.ok(f.points.size[0]>old.points.size[0]);assert.ok(origin[0]-plume[0]>old.points.pos[0]-old.points.pos.at(-3));assert.deepEqual(f.refEngine.map(call=>call.count),old.refEngine.map(call=>call.count),'changing thrust does not rebuild nozzle polygons');}
 }
 const full=out.at(-1);assert.equal(full.points.col[3],240);near(full.points.size[0],data.glow[3]*5);
});

test('a funded-to-zero transition clears existing point buffers and does not infer output from a command',()=>{
 const {data}=physicalGeometry(),{draw}=renderer(data);assert.equal(draw(1).points.count,5);
 for(const glow of [0,undefined,NaN,Infinity,-1]){
  const out=draw(glow,{throttle:1,engF:1});assert.equal(out.points.count,0);assert.ok(out.refEngine.every(call=>call.emission===0));assert.ok(out.nozzle.every(call=>call.emission===0));
 }
 const high=draw(9);assert.equal(high.points.col[3],240);assert.ok(high.refEngine.every(call=>call.emission===1));
 const wreck=draw(1,{wreck:true});assert.equal(wreck.points.count,0);assert.ok(wreck.refEngine.every(call=>call.emission===0));
});

test('separate ships keep their own funded emission and only the powered ship contributes exhaust points',()=>{
 const {data}=physicalGeometry(),{r,asset}=renderer(data),emissions=[],draw=r.drawMesh;
 r.drawMesh=function(name,...args){if(name==='refEngine')emissions.push({x:this.off[0],output:this.engineK});return draw.call(this,name,...args);};
 r.drawFleet({VP,eye:r.eye()},{fleet:[{key:'physical',pos:[0,0,0],glow:0},{key:'physical',pos:[100,0,0],glow:.5}]});
 assert.deepEqual(emissions,[{x:0,output:0},{x:100,output:.625}]);assert.equal(r.points.fleetGlow.count,5);assert.equal(asset.meshes.refEngine.count,data.meshes.refEngine.geo.ni);
});

test('a moving wing transforms the powered nozzle and its plume without lighting an unpowered wing',()=>{
 const {data}=physicalGeometry(),foil={id:7,pivot:[0,0,0],axis:'z',sg:1,open:0,stow:90,meshes:[],glow:data.glow.slice()};data.foils=[foil];data.glow=[];
 const {draw}=renderer(data),off=draw(0,{foils:{7:.5}});assert.equal(off.points.count,0);
 const on=draw(.25,{foils:{7:.5}}),T=G.foilTransform(foil,.5),origin=T.point(foil.glow.slice(0,3)),aft=T.direction([-1,0,0]);
 on.points.pos.slice(0,3).forEach((value,i)=>near(value,origin[i]-data.center[i]));
 const delta=C.sub(on.points.pos.slice(3,6),on.points.pos.slice(0,3));near(C.dot(C.norm(delta),C.norm(aft)),1);assert.equal(on.points.count,5);
});
