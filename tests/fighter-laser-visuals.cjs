const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),core=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),core,{filename:file});
const C=vm.runInContext('Core',core),plain=v=>JSON.parse(JSON.stringify(v));
function section(a,b){const start=app.indexOf(a),end=app.indexOf(b,start+a.length);assert.ok(start>=0&&end>start,a);return app.slice(start,end);}
function setup(){
 const ctx=vm.createContext({console,C,performance:{now:()=>1000}});vm.runInContext(`
 const trial={paused:false,cbolts:[],fx:[]},fleet={assets:new Map()},sounds=[],launches=[];
 const R={CRAFT:{},alive:u=>!!u&&!u.dead,systemUnits:()=>[]};
 const voyCraftModel=k=>k,craftGunPitch=()=>1,sndPick=x=>x,sndAt=(...x)=>sounds.push(x),spaceWorld=u=>u.pos,spaceVel=u=>u.vel||[0,0,0],spaceHullPoint=u=>u.pos;
 const craftShip=u=>({c:u.pos,R:[1,0,0,0,1,0,0,0,1]}),craftOrd=()=>[],craftOrdLaunch=(...args)=>launches.push(args),craftOrdStep=()=>{},voyCraftBoom=()=>{},voyBoltCol=()=>[255,80,60],craftGun=()=>'laser';
 const battle={result:false},cf={f:1,snd:0,ord:[],ghosts:[],runs:[],runT:0,ct:0,sq:new Map()};
 const craft={dims:[12,10,3],aa:1,gun:10,strike:10},q={id:'one',cid:0,craft:'test',pos:[0,0,0],h:[1,0,0],up:[0,1,0],vel:[0,0,60],size:10,alive:true},target={id:'foe',pos:[10000,200,0],vel:[0,0,0],h:[-1,0,0],size:10,alive:true};
 function df(dt,c=craft,a=q,t=target){craftFx(battle,cf,dt,[0,0,0],{df:[{m:[a],fm:[t],c,col:[255,80,60],gun:'laser'}],runs:[],pd:[]});}
 `,ctx);
 for(const [a,b]of [['const tv=','// Rotation about a unit axis'],['function craftVisualGuns(','function voyPilotStep('],['function voyCraftFire(','// v22 Ordnance on its way:']])vm.runInContext(section(a,b),ctx);
 return s=>vm.runInContext(s,ctx);
}
const near=(a,b,eps=1e-8)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`),vec=(a,b)=>a.forEach((v,i)=>near(v,b[i]));

test('custom gun muzzles and fixed axes follow the displayed model frame and its blueprint centre',()=>{
 const run=setup();run("fleet.assets.set('test',{geometry:{center:[100,10,0]}});q.pos=[20,30,40];q.h=[0,0,1];craft.fireArcs=[{fixed:true,dir:[1,0,0],up:[0,1,0],pos:[110,12,3],k:'claser',gun:1,aa:1,cycle:.12}]");
 const g=plain(run("craftVisualGuns(q,craft,'gun')[0]"));vec(g.pos,[17,32,50]);vec(g.dir,[0,0,1]);
 assert.equal(run("craftVisualGunGate(craftVisualGuns(q,craft,'gun')[0],[17,32,1000])"),true);
 assert.equal(run("craftVisualGunGate(craftVisualGuns(q,craft,'gun')[0],[17,32,-1000])"),false);
 assert.equal(run("craftVisualGunGate(craftVisualGuns(q,craft,'gun')[0],[1000,32,50])"),false);
});

test('fixed fighter lasers stream along their barrels, without snapping toward an offset target',()=>{
 const run=setup();run('for(let i=0;i<60;i++)df(1/60)');const bolts=plain(run('trial.cbolts'));
 assert.ok(bolts.length>=15&&bolts.length<=18,`forward nose pair emitted ${bolts.length} rounds in one second`);
 for(const b of bolts)vec(b.vel,[5200,0,60]);
 const other=setup();other('for(let i=0;i<30;i++)df(1/30)');assert.equal(other('trial.cbolts.length'),bolts.length,'cadence is independent of render frame rate');
 assert.ok(new Set(plain(run('trial.cbolts.map(b=>b.life.toFixed(4))'))).size>8,'the rounds form a stream rather than one large volley');
});

test('forward fixed guns do not create sideways or rearward streams, while a real rear-facing mount can fire aft',()=>{
 const run=setup();run('target.pos=[-1000,0,0];for(let i=0;i<30;i++)df(1/30)');assert.equal(run('trial.cbolts.length'),0);
 run('target.pos=[0,0,1000];for(let i=0;i<30;i++)df(1/30)');assert.equal(run('trial.cbolts.length'),0);
 run("craft.fireArcs=[{fixed:true,dir:[-1,0,0],up:[0,1,0],pos:[0,0,0],k:'claser',gun:1,aa:1,cycle:.12}];target.pos=[-10000,0,0];for(let i=0;i<30;i++)df(1/30)");
 assert.ok(run('trial.cbolts.length')>=8);for(const b of plain(run('trial.cbolts')))vec(b.vel,[-5200,0,60]);
});

test('explicitly unarmed craft emit no lasers and empty gas suppresses laser mounts while keeping ion guns',()=>{
 const run=setup();run('craft.fireArcs=[];for(let i=0;i<60;i++)df(1/60)');assert.equal(run('trial.cbolts.length'),0);
 run("craft.systems={managed:true,laserGunShare:.5,laserAaShare:.5};craft.fireArcs=['claser','claserH','cturret','ion','htl','refVen'].map(k=>({fixed:true,dir:[1,0,0],up:[0,1,0],pos:[0,0,0],k,gun:.5,aa:.5}))");
 assert.deepEqual(plain(run("craftVisualGuns(q,craft,'aa',{laserGas:0}).map(g=>g.k)")),['ion','htl','refVen']);
});

test('pausing freezes streams and clocks and resuming cannot release a saved backlog',()=>{
 const run=setup();run('for(let i=0;i<12;i++)df(1/60)');const before=plain(run('({bolts:trial.cbolts,clocks:q.gunClocks,sounds:sounds.length})'));
 run('trial.paused=true;for(let i=0;i<100;i++)df(.1)');assert.deepEqual(plain(run('({bolts:trial.cbolts,clocks:q.gunClocks,sounds:sounds.length})')),before);
 run('trial.paused=false;df(1/60)');assert.ok(run('trial.cbolts.length')<=before.bolts.length+2);
});

test('a recorded pass does not fire after egress and all ordnance events at the same battle tick remain visible',()=>{
 const run=setup();run(`
 R.CRAFT.test=craft;const unit={id:9,pos:[1000,0,0],p:{len:100,width:40,height:20},dead:false};
 const one={id:1,craft:'test',state:'out',dogfight:10,dfFoe:2,strafeT:11,runOn:9,side:0},two={id:2,craft:'test',state:'out',side:1};
 cf.sq.set(1,{list:[q],f:cf.f});cf.sq.set(2,{list:[target],f:cf.f});
 const w={time:10,squads:new Map([[1,one],[2,two]]),units:new Map([[9,unit]]),craftRuns:[{sys:'a',t:10,sq:1,to:9,ord:[]},{sys:'a',t:10,sq:2,to:9,ord:[]}]};
 let observed;craftFx=(b,c,dt,e,jobs)=>{observed=jobs};voyCraftFire(battle,w,'a',cf,.1,[0,0,0]);
 `);
 assert.equal(run('observed.df.length'),1);assert.equal(run('observed.runs.filter(j=>j.fire!==false).length'),1);assert.equal(run('observed.runs.filter(j=>j.fire===false).length'),2,'simultaneous pass events are not lost');
 run("one.state='return';one.strafeT=null;one.runOn=null;w.time=10.25;voyCraftFire(battle,w,'a',cf,.1,[0,0,0])");assert.equal(run('observed.df.length'),0);assert.equal(run('observed.runs.filter(j=>j.fire!==false).length'),0);
});

test('a large nearby formation stays within both the per-frame and total bolt limits',()=>{
 const run=setup();run("const many=Array.from({length:200},(_,i)=>({...q,id:'craft'+i,cid:i,pos:[0,0,i*.1]}));for(let i=0;i<20;i++)craftFx(battle,cf,.1,[0,0,0],{df:[{m:many,fm:[target],c:craft,col:[255,80,60],gun:'laser'}],runs:[],pd:[]})");
 assert.ok(run('trial.cbolts.length')<=1100);assert.ok(run('trial.cbolts.length')>=900);
});

test('laser impact flashes require an actual hull crossing instead of mere bolt expiry',()=>{
 const run=setup();run("const unit={id:1,pos:[0,0,0],p:{len:200,width:80,height:40},dead:false};const hit=craftBoltHullHit(unit,[-200,0,0],[200,0,0]),miss=craftBoltHullHit(unit,[-200,100,0],[200,100,0])");
 assert.ok(run('hit')?.every(Number.isFinite));assert.equal(run('miss'),null);
 run("trial.cbolts=[{pos:[-200,100,0],vel:[4000,0,0],life:.01,hit:unit}];craftFx(battle,cf,.1,[0,0,0],{df:[],runs:[],pd:[]})");assert.equal(run('trial.fx.length'),0);
 run("trial.cbolts=[{pos:[-200,0,0],vel:[4000,0,0],life:.5,hit:unit}];craftFx(battle,cf,.1,[0,0,0],{df:[],runs:[],pd:[]})");assert.equal(run('trial.fx.length'),1);assert.equal(run('trial.cbolts.length'),0);
});
