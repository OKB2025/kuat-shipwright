const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),core=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),core,{filename:file});
const {C,R,D}=vm.runInContext('({C:Core,R:Rts,D:YardFleetData.designs})',core),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),plain=x=>JSON.parse(JSON.stringify(x));
function cut(a,b){const i=app.indexOf(a),j=app.indexOf(b,i+1);assert.ok(i>=0&&j>i,a);return app.slice(i,j);}
function fixture(){
 const own=C.fleetUnit('own','cr90',D.cr90.p,0),foe=C.fleetUnit('foe','cr90',D.cr90.p,1);own.side=0;foe.side=1;own.sys=foe.sys=7;own.pos=[0,0,0];foe.pos=[1000000,0,2000000];
 const contact={id:foe.id,sys:7,st:6,cap:0,observed:false,est:[1000,0,2000],err:400,seen:0},w={sensors:true,units:new Map([[own.id,own],[foe.id,foe]]),groups:new Map(),sides:[{id:0,tc:new Map([[foe.id,contact]])}],squads:new Map(),wings:new Map(),missiles:[],ionBolts:[],swShots:[]};
 const voy={w,screen:'tac',fz:1,tac:{sys:7,c:[0,0],mpp:10,fitted:true},sel:{units:[],foe:null},tacWings:[]},picked=[],centered=[];
 const cx=vm.createContext({console,C,R,voy,document:{body:{}},$:()=>({getBoundingClientRect:()=>({width:1000,height:700})}),voyFree:()=>({x0:0,x1:1000,y0:0,y1:700}),voyTapUnit:u=>{picked.push(u.id);return true;},voyRenderSide(){},voyCenterTac:p=>centered.push(p.slice()),voyFitStale:()=>false,voyTacSel:()=>({kind:null}),voySelUnits:()=>[],getComputedStyle:()=>({fontFamily:'sans-serif'}),VC:{bg:'#000',grid:'#111',own:'#fff',foe:'#f00'},performance:{now:()=>0},shipTag:x=>x,voyTagSuffix:()=>'',crewShare:()=>null});
 vm.runInContext(cut('const voyStage =','function voyFoeName(')+cut('function voyTacFit(','// Labels that keep off each other:')+cut('function voyOrderLine(','const voyTagSuffix =')+cut('function voyMapTap(','function voyBindMap(')+cut('function voySidebarClick(','function voyCenterOps('),cx);
 return {cx,own,foe,contact,w,voy,picked,centered,run:s=>vm.runInContext(s,cx)};
}
test('coasting contacts use finite last-known estimates while live, own and sensors-off positions stay current',()=>{
 const f=fixture();assert.equal(f.run('voyContactFix(voy.w.units.get("foe"))'),false);assert.deepEqual(plain(f.run('voyContactPos(voy.w.units.get("foe"))')),f.contact.est);
 f.foe.pos=[-9000000,400,7000000];assert.deepEqual(plain(f.run('voyContactPos(voy.w.units.get("foe"))')),f.contact.est);
 assert.deepEqual(plain(f.run('voyContactPos(voy.w.units.get("own"))')),f.own.pos);
 f.contact.observed=true;f.contact.cap=6;assert.equal(f.run('voyContactFix(voy.w.units.get("foe"))'),true);assert.deepEqual(plain(f.run('voyContactPos(voy.w.units.get("foe"))')),f.foe.pos);
 f.w.sensors=false;f.contact.observed=false;assert.deepEqual(plain(f.run('voyContactPos(voy.w.units.get("foe"))')),f.foe.pos);
});
test('tactical automatic framing cannot follow a hidden ship beyond its retained estimate',()=>{
 const f=fixture();f.run('voyTacFit(1000,700)');const frame=plain(f.voy.tac);assert.ok(frame.mpp<100);
 f.foe.pos=[1e12,1e12,-1e12];f.run('voyTacFit(1000,700)');assert.deepEqual(plain(f.voy.tac),frame);
 f.contact.est=[NaN,Infinity,0];f.run('voyTacFit(1000,700)');assert.ok(f.voy.tac.c.every(Number.isFinite));assert.ok(f.voy.tac.mpp<100);
});
test('actual tactical hit testing and sidebar centering select the retained contact position',()=>{
 const f=fixture();f.run('voyMapTap(600,550)');assert.deepEqual(f.picked,['foe']);
 f.cx.event={target:{closest:()=>({dataset:{vfoe:'foe'}})}};f.run('voySidebarClick(event)');assert.deepEqual(f.centered,[f.contact.est]);
 f.contact.est=null;f.picked.length=0;f.centered.length=0;f.run('voyMapTap(600,550)');f.run('voySidebarClick(event)');assert.deepEqual(f.picked,[]);assert.deepEqual(f.centered,[]);
});
test('attack-order lines end at observed estimates and disappear when no position is known',()=>{
 const f=fixture(),ends=[],ctx={setLineDash(){},beginPath(){},moveTo(){},lineTo:(...p)=>ends.push(p),stroke(){}};f.cx.ctx=ctx;f.cx.project=p=>[p[0],p[2]];f.cx.byId=f.w.units;
 f.run('voyOrderLine(ctx,project,[0,0,0],{type:"attack",target:"foe"},byId,false)');assert.deepEqual(ends,[[f.contact.est[0],f.contact.est[2]]]);
 f.w.sides[0].tc.delete('foe');f.run('voyOrderLine(ctx,project,[0,0,0],{type:"attack",target:"foe"},byId,false)');assert.equal(ends.length,1);
});
test('tactical drawing shows a coasting uncertainty ring and no hidden hull or superweapon arc',()=>{
 const f=fixture(),calls=[],ctx=new Proxy({measureText:s=>({width:String(s).length*6})},{get:(o,k)=>k in o?o[k]:(...args)=>calls.push({k,args})});
 f.cx.ctx=ctx;f.cx.voyLabeler=()=>Object.assign(()=>{}, {block(){}});f.foe.p={...f.foe.p,sw:[{k:'hion',aim:'port'}]};f.foe.sw=[{st:'ready'}];
 vm.runInContext(cut('function voyTacSwArcs(','function voyDrawTac(')+cut('function voyDrawTac(','// ---------- the top bar ----------'),f.cx);
 f.run('voyDrawTac(ctx,1000,700)');const arcs=calls.filter(c=>c.k==='arc');assert.ok(arcs.some(c=>c.args[0]===600&&c.args[1]===550));
 for(const c of calls)for(const n of c.args)if(typeof n==='number')assert.ok(Number.isFinite(n)&&Math.abs(n)<10000,`${c.k}: ${c.args}`);
 assert.equal(f.foe._lab,null);assert.ok(!arcs.some(c=>c.args[2]>100));
});
test('recent beam and expanding-ring events cannot expose a coasting source or target true position',()=>{
 for(const [mode,from,to]of [['pulse','foe','own'],['beam','own','foe'],['ring','foe','own']]){
  const f=fixture(),calls=[],ctx=new Proxy({measureText:s=>({width:String(s).length*6})},{get:(o,k)=>k in o?o[k]:(...args)=>calls.push({k,args})});
  const source=f.w.units.get(from),weapon={id:99,k:mode==='beam'?'sbeam':'hion',axis:[1,0,0],mz:[0,0,0]};source.p={...source.p,sw:[weapon]};source.sw=[{st:'ready',c:1}];
  const origin=plain(C.swMuzzle(source,weapon)),axis=plain(C.swAxis(source,weapon)),distance=1000;
  f.cx.ctx=ctx;f.cx.voyLabeler=()=>Object.assign(()=>{}, {block(){}});f.w.time=.1;f.w.swShots=[{sys:7,from,t:0,i:0,k:weapon.k,mode,to:[to],origin,axis,distance,end:plain(C.add(origin,C.mul(axis,distance)))}];
  vm.runInContext(cut('function voyTacSwArcs(','function voyDrawTac(')+cut('function voyDrawTac(','// ---------- the top bar ----------'),f.cx);
  const drawingBound=mode==='beam'?1000+C.swRange(source,weapon)/f.voy.tac.mpp:10000;
  f.run('voyDrawTac(ctx,1000,700)');for(const c of calls)for(const n of c.args)if(typeof n==='number')assert.ok(Number.isFinite(n)&&Math.abs(n)<drawingBound,`${mode} ${c.k}: ${c.args}`);
  assert.ok(calls.some(c=>['moveTo','lineTo','arc'].includes(c.k)&&c.args[0]===600&&c.args[1]===550));
  if(mode==='beam'){assert.ok(calls.some(c=>c.k==='lineTo'&&c.args[0]===600&&c.args[1]===350),'the actual1000m axis segment is drawn without homing toward a hidden contact');f.foe.pos=[1e12,1e12,-1e12];calls.length=0;f.run('voyDrawTac(ctx,1000,700)');assert.ok(calls.some(c=>c.k==='lineTo'&&c.args[0]===600&&c.args[1]===350),'a hidden true-position change cannot redirect the recorded beam');for(const c of calls)for(const n of c.args)if(typeof n==='number')assert.ok(Number.isFinite(n)&&Math.abs(n)<drawingBound,'hidden positions must not affect drawing beyond the legitimate fixed rangeguide');}
 }
});

test('fixed-axis events reveal real ray coordinates only for an observed or owned source',()=>{
 for(const state of ['coasting','unknown-contact','unknown-source','observed','own']){
  const f=fixture(),calls=[],ctx=new Proxy({measureText:s=>({width:String(s).length*6})},{get:(o,k)=>k in o?o[k]:(...args)=>calls.push({k,args,style:o.strokeStyle,width:o.lineWidth})});
  const source=state==='own'?f.own:f.foe,weapon={id:99,k:'sbeam',aim:'bow',axis:[.6,0,.8],mz:[50,0,-20]};source.p={...source.p,sw:[weapon]};source.sw=[{st:'beam',c:0}];
  const origin=plain(C.swMuzzle(source,weapon)),axis=plain(C.swAxis(source,weapon)),end=plain(C.add(origin,C.mul(axis,1000)));
  if(state==='observed'){f.contact.observed=true;f.contact.cap=6;}
  if(state==='unknown-contact')f.w.sides[0].tc.delete('foe');
  f.cx.ctx=ctx;f.cx.voyLabeler=()=>Object.assign(()=>{}, {block(){}});f.w.time=.1;f.w.swShots=[{sys:7,from:state==='unknown-source'?'absent-source':source.id,t:0,i:0,k:'sbeam',mode:'beam',to:['own'],origin,axis,distance:1000,end}];
  vm.runInContext(cut('function voyTacSwArcs(','function voyDrawTac(')+cut('function voyDrawTac(','// ---------- the top bar ----------'),f.cx);
  f.run('voyDrawTac(ctx,1000,700)');const beam=calls.filter(c=>['moveTo','lineTo'].includes(c.k)&&c.width===4&&/^rgba\(255,120,90,/.test(c.style||''));
  if(state==='observed'||state==='own'){
   assert.deepEqual(beam.map(c=>c.k),['moveTo','lineTo'],state+' retains the real beam');
   const project=p=>[500+p[0]/10,350+p[2]/10];assert.deepEqual(beam.map(c=>c.args),[project(origin),project(end)],state+' uses the actual recorded muzzle and axis');
  }else{
   assert.deepEqual(beam,[],state+' suppresses the ray instead of moving it to the retained estimate');
   for(const c of calls)for(const n of c.args)if(typeof n==='number')assert.ok(Number.isFinite(n)&&Math.abs(n)<10000,state+' hidden beam geometry must not enter any canvas operation');
   if(state==='coasting')assert.ok(calls.some(c=>c.k==='arc'&&c.args[0]===600&&c.args[1]===550),'the coasting source keeps only its retained uncertainty ring');
  }
 }
});
