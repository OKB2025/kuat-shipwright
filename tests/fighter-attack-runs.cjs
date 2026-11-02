const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
function runtime(){const cx=vm.createContext({console});for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});return vm.runInContext('({C:Core,R:Rts,D:YardFleetData.designs})',cx);}
function fixture(approach='bow',craft='tie_ln'){
 const {C,R,D}=runtime();if(craft==='custom')craft=R.registerDesignCraft({name:'User fighter',dims:[9,7,3],craft:{role:'fighter',speed:1600,aa:1,gun:10,strike:10,armor:1,crew:1,mass:7,cost:10000,stations:[],load:[],fireArcs:[{fixed:true,dir:[1,0,0],up:[0,1,0],pos:[2,0,0],k:'claser',gun:1,aa:1,cycle:.1}]}});
 const designs=['mc80home','imperial'].map(k=>JSON.parse(JSON.stringify(D[k]))),w=R.createWorld({mode:'test',sensors:false,region:'kuat',seed:13,designs,sides:[{faction:'rebel',ai:false},{faction:'empire',ai:false}],fleets:[[{design:'mc80home',air:[{craft,n:4}]}],[{design:'imperial',air:[]}]]});
 const home=[...w.units.values()].find(u=>u.side===0),target=[...w.units.values()].find(u=>u.side===1),wing=[...w.wings.values()].find(x=>x.side===0),s=w.squads.get(wing.squads[0]);
 target.sys=home.sys;w.groups.get(target.group).sys=home.sys;target.pos=[0,0,0];target.yaw=0;home.pos=[-22000,0,-12000];home.yaw=0;
 for(const u of [home,target]){u.manual=true;u.velocity=[0,0,0];u.warp=null;u.jump=null;u.out=false;R.orderUnit(w,u.id,{type:'hold'});}
 R.orderWing(w,wing.id,{type:'strike',target:target.id,approach});wing.phase='go';s.state='out';s.ops=null;s.n=s.n0=4;s.slots=[0,1,2,3];s.t=0;s.runs=0;s.ran=false;s.fired=false;s.laserGas=null;s.lifeSupport=null;
 const ap=R.APPROACH[approach],L=12000+target.p.len*.6;s.pos=ap.map(x=>x*L);s.h=C.norm(C.mul(ap,-1));s.vel=C.mul(s.h,R.CRAFT[craft].speed);s.launched=w.time;
 return {C,R,w,home,target,wing,s};
}
function advance(f,seconds,onTick){for(let i=0;i<seconds*4;i++){f.R.tick(f.w,.25);if(onTick)onTick(f);}}

test('a natural bow attack shoots while moving, passes the hull and returns after a finite gun-only sortie',()=>{
 const f=fixture(),phases=new Set(),passing=[],firing=[];let returned=false;
 advance(f,110,()=>{phases.add(f.wing.phase);if(['run','egress'].includes(f.wing.phase)&&f.s.state==='out')passing.push({p:f.s.pos.slice(),speed:f.C.len(f.s.vel)});if(f.s.strafeT>f.w.time)firing.push({speed:f.C.len(f.s.vel),p:f.s.pos.slice()});if(f.s.state==='return'||f.s.state==='docked')returned=true;});
 assert.ok(phases.has('run')&&phases.has('egress')&&phases.has('return'),[...phases].join(','));assert.ok(firing.length>0,'forward-facing guns should fire on an actual approach');assert.ok(firing.every(x=>x.speed>f.R.CRAFT[f.s.craft].speed*.5),'shots must happen in flight');assert.ok(passing.some(x=>x.p[0]<-f.target.p.len*.5-1500),'the squadron must cross beyond the target');assert.ok(passing.every(x=>x.speed>f.R.CRAFT[f.s.craft].speed*.5),'the approach and breakaway must not park at a waypoint');assert.ok(returned);assert.ok(f.s.dmg>0);
});

test('above and below attack runs leave along the hull on their original safe side',()=>{
 for(const approach of ['above','below']){const f=fixture(approach),side=approach==='below'?-1:1,egress=[];let left=false;
  advance(f,65,()=>{if(f.wing.phase==='egress'){egress.push(f.s.pos.slice());if(f.s.pos[0]<-f.target.p.len*.5-1000)left=true;assert.ok(f.C.len(f.s.vel)>100,'departure must keep flying');}});
  assert.ok(egress.length>0,approach);assert.ok(left,`${approach} must leave aft rather than dive to the opposite side`);assert.ok(egress.every(p=>p[1]*side>0),`${approach} must keep its safe vertical side`);
 }
});

test('an attack that misses its firing window still clears the target and returns',()=>{
 const f=fixture();f.R.CRAFT[f.s.craft]={...f.R.CRAFT[f.s.craft],fireArcs:[]};let returned=false,shots=0;
 advance(f,110,()=>{if(f.s.strafeT>f.w.time)shots++;if(f.s.state==='return'||f.s.state==='docked')returned=true;});
 assert.equal(shots,0,'a craft with no operational barrel cannot fire');assert.equal(f.s.dmg||0,0);assert.ok(returned,'missing a shot must never trap a wing at its target');
});

test('an explicit recall stops firing and docks through the carrier mouth',()=>{
 const f=fixture();advance(f,7);assert.equal(f.R.orderWing(f.w,f.wing.id,{type:'standby'}),true);let docked=false;
 advance(f,120,()=>{assert.ok(!(f.s.state==='out'&&f.s.strafeT>f.w.time),'a recalled squadron must not keep strafing');if(f.s.state==='docked')docked=true;});assert.ok(docked,'returning fighters should enter a real carrier mouth');
});

test('a fighter initially facing exactly away turns around without a zero heading or zero-speed deadlock',()=>{
 const f=fixture();f.s.h=f.C.norm(f.R.APPROACH.bow);f.s.vel=f.C.mul(f.s.h,f.R.CRAFT[f.s.craft].speed);let ran=false;
 advance(f,35,()=>{assert.ok(f.C.len(f.s.h)>.99);if(f.s.state==='out'&&!f.s.ops)assert.ok(f.C.len(f.s.vel)>100);if(f.wing.phase==='run'||f.wing.phase==='egress')ran=true;});assert.ok(ran);
});

test('a user-designed fighter follows a moving target through a stern pass and still returns home',()=>{
 const f=fixture('stern','custom');let crossed=false,returned=false;
 advance(f,120,()=>{f.target.pos[0]+=18.75;if(f.wing.phase==='egress'&&f.s.pos[0]-f.target.pos[0]>f.target.p.len*.5+1500)crossed=true;if(f.s.state==='return'||f.s.state==='docked')returned=true;});
 assert.equal(f.R.CRAFT[f.s.craft].design,true);assert.ok(crossed,'the designed fighter must overtake the moving target and leave beyond its bow');assert.ok(returned);assert.ok(f.s.dmg>0);
});

test('loss of the target ends the attack and loss of its carrier does not strand a hovering attacker',()=>{
 const targetLost=fixture();advance(targetLost,4);targetLost.target.dead=true;advance(targetLost,2);assert.notEqual(targetLost.s.state,'out');assert.ok(!(targetLost.s.strafeT>targetLost.w.time));
 const carrierLost=fixture();advance(carrierLost,4);carrierLost.home.dead=true;advance(carrierLost,2);assert.equal(carrierLost.s.state,'lost');assert.equal(carrierLost.s.n,0);
});
