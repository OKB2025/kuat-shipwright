const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const {C,R,D}=vm.runInContext('({C:Core,R:Rts,D:YardFleetData.designs})',cx),plain=x=>JSON.parse(JSON.stringify(x));
function fixture(faction='empire'){
 const w=R.createWorld({mode:'test',region:'kuat',sensors:false,seed:21,designs:['mc80home','imperial'].map(k=>plain(D[k])),sides:[{faction,ai:false,air:'standard'},{faction:'rebel',ai:false,air:'standard'}],fleets:[[{design:'imperial',air:[{craft:'tie_in',n:4,wingNo:1}]}],[{design:'mc80home',air:[{craft:'ywing',n:4,wingNo:1}]}]]});
 const home=[...w.units.values()].find(u=>u.side===0),enemy=[...w.units.values()].find(u=>u.side===1),wing=[...w.wings.values()].find(x=>x.side===0),foe=[...w.wings.values()].find(x=>x.side===1),s=w.squads.get(wing.squads[0]),es=w.squads.get(foe.squads[0]);
 enemy.sys=home.sys;w.groups.get(enemy.group).sys=home.sys;home.pos=[-20000,0,0];enemy.pos=[22000,0,0];home.yaw=0;enemy.yaw=Math.PI;
 for(const u of [home,enemy]){u.manual=true;u.velocity=[0,0,0];u.warp=null;u.jump=null;u.out=false;R.orderUnit(w,u.id,{type:'hold'});}
 R.orderWing(w,foe.id,{type:'strike',target:home.id,approach:'bow'});foe.phase='go';Object.assign(es,{state:'out',sys:home.sys,pos:[-5000,2000,0],h:[-1,0,0],vel:[-1500,0,0],ops:null,t:0,launched:w.time});
 return {w,home,enemy,wing,foe,s,es};
}
function advance(f,seconds){for(let i=0;i<seconds*4;i++)R.tick(f.w,.25);}

test('the world clock assigns active interception to standard player-controlled wings of every faction',()=>{
 for(const faction of ['empire','rebel','republic','cis']){
  const f=fixture(faction);R.tick(f.w,.25);
  assert.equal(f.wing.order.type,'auto',faction);assert.ok(f.wing.auto,`${faction}: auto must update without an AI-controlled side or shield-strip doctrine`);
  assert.equal(f.wing.auto.airMission,'intercept',faction);assert.equal(f.wing.auto.airTarget,f.foe.id,faction);
 }
});

test('periodic automatic planning preserves explicit standby, CAP, escort and strike missions',()=>{
 for(const type of ['standby','cap','escort','strike']){
  const f=fixture('rebel'),order=type==='cap'?{type,point:[-10000,5000,14000],radius:6000}:type==='escort'?{type,target:f.home.id}:type==='strike'?{type,target:f.enemy.id,approach:'above'}:{type};
  assert.equal(R.orderWing(f.w,f.wing.id,order),true);const before=plain(f.wing.order);advance(f,6);
  assert.deepEqual(plain(f.wing.order),before,type);assert.equal(f.wing.auto??null,null,`${type}: automatic missions must not replace the explicit mission`);
  if(type==='standby'){assert.equal(f.s.state,'docked');assert.equal(f.wing.phase,'docked');}
  else assert.ok(['out','docked'].includes(f.s.state),`${type}: squad must remain available`);
 }
});

test('a carrier jump recalls automatic wings before launch and cancellation lets automatic sorties resume',()=>{
 const f=fixture(),g=f.w.groups.get(f.home.group),edge=f.w.sector.edges[f.w.sector.systems[f.home.sys].links[0]],to=edge.a===f.home.sys?edge.b:edge.a;
 assert.equal(R.orderJump(f.w,g.id,to).ok,true);advance(f,3);
 assert.equal(f.s.state,'docked');assert.equal(f.s.sys,f.home.sys);assert.equal(f.s.n,4);assert.equal(f.wing.recall,true);assert.ok(g.spool);
 assert.equal(R.cancelJump(f.w,g.id),true);advance(f,3);
 assert.equal(g.spool,null);assert.equal(f.wing.recall,false);assert.equal(f.s.state,'out');assert.ok(f.s.ops?.k==='launch'||C.len(f.s.vel)>0,'the squad should resume a real launch after cancellation');
});
