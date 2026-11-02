const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const {C,R,D}=vm.runInContext('({C:Core,R:Rts,D:YardFleetData.designs})',cx);
function fixture(){
 const designs=['mc80home','imperial'].map(k=>JSON.parse(JSON.stringify(D[k]))),w=R.createWorld({mode:'test',sensors:false,region:'kuat',seed:13,designs,sides:[{faction:'rebel',ai:false,air:'standard'},{faction:'empire',ai:false,air:'standard'}],fleets:[[{design:'mc80home',air:[{craft:'xwing',n:4,wingNo:1},{craft:'ywing',n:4,wingNo:2},{craft:'awing',n:4,wingNo:3}]}],[{design:'imperial',air:[{craft:'tie_ln',n:4,wingNo:1},{craft:'tie_sa',n:4,wingNo:2}]}]]});
 const home=[...w.units.values()].find(u=>u.side===0),enemy=[...w.units.values()].find(u=>u.side===1),ours=[...w.wings.values()].filter(x=>x.side===0),theirs=[...w.wings.values()].filter(x=>x.side===1);
 enemy.sys=home.sys;w.groups.get(enemy.group).sys=home.sys;home.pos=[-25000,0,-12000];enemy.pos=[50000,0,0];
 for(const u of [home,enemy]){u.manual=true;u.velocity=[0,0,0];u.warp=null;u.jump=null;u.out=false;R.orderUnit(w,u.id,{type:'hold'});}
 for(const s of w.squads.values()){s.sys=home.sys;s.laserGas=null;s.lifeSupport=null;}
 w.timers.ai=1e9;return {C,R,w,home,enemy,ours,theirs};
}
function out(f,wing,pos,h=[1,0,0]){const s=f.w.squads.get(wing.squads[0]);s.state='out';s.ops=null;s.pos=pos.slice();s.h=h.slice();s.vel=C.mul(h,R.CRAFT[s.craft].speed);s.launched=0;wing.phase='on';return s;}
function tick(f,seconds){for(let i=0;i<seconds*4;i++)R.tick(f.w,.25);}

test('automatic fighter interception prioritizes an inbound bomber over a closer passing fighter',()=>{
 const f=fixture(),fighter=f.ours[0],bomber=f.theirs[1];out(f,fighter,[0,1200,0]);out(f,f.theirs[0],[4000,1200,0],[1,0,0]);out(f,bomber,[-3000,1200,-10000],[-1,0,0]);
 R.orderWing(f.w,f.theirs[0].id,{type:'cap',point:[40000,1200,0],radius:15000});R.orderWing(f.w,bomber.id,{type:'strike',target:f.home.id,approach:'bow'});bomber.phase='go';
 R.aiWing(f.w,fighter,f.home);assert.equal(fighter.auto.airMission,'intercept');assert.equal(fighter.auto.airTarget,bomber.id);assert.ok(fighter.auto.point[0]<-3000,'interception leads the incoming flight rather than chasing its old position');
});

test('spare fighter wings split their interception effort between simultaneous incoming attacks',()=>{
 const f=fixture();for(const wing of [f.ours[0],f.ours[2]])out(f,wing,[0,1200,0]);for(const wing of f.theirs){out(f,wing,[-8000,1200,-12000],[-1,0,0]);R.orderWing(f.w,wing.id,{type:'strike',target:f.home.id,approach:'bow'});wing.phase='go';}
 R.aiWing(f.w,f.ours[0],f.home);R.aiWing(f.w,f.ours[2],f.home);assert.equal(f.ours[0].auto.airTarget,f.theirs[1].id);assert.equal(f.ours[2].auto.airTarget,f.theirs[0].id);
});

test('air superiority pursues a distant enemy formation instead of orbiting the mother ship',()=>{
 const f=fixture(),fighter=f.ours[0];out(f,fighter,[0,1400,0]);out(f,f.theirs[0],[32000,1400,9000],[0,0,-1]);R.orderWing(f.w,f.theirs[0].id,{type:'cap',point:[32000,1400,9000],radius:5000});
 R.aiWing(f.w,fighter,f.home);assert.equal(fighter.auto.airMission,'superiority');assert.equal(fighter.auto.airTarget,f.theirs[0].id);assert.ok(fighter.auto.point[0]>30000);assert.ok(fighter.auto.point[2]<9000);
});

test('an automatic strike escort actually flies with outbound bombers and answers threats near them',()=>{
 const f=fixture(),fighter=f.ours[0],strike=f.ours[1],s=out(f,fighter,[0,1600,0]);out(f,strike,[20000,1600,0]);R.orderWing(f.w,strike.id,{type:'strike',target:f.enemy.id,approach:'bow'});strike.phase='go';
 for(const wing of [f.ours[2],...f.theirs])R.orderWing(f.w,wing.id,{type:'standby'});
 R.aiWing(f.w,fighter,f.home);assert.equal(fighter.auto.airMission,'strike-escort');assert.equal(fighter.auto.escortWing,strike.id);const start=C.len(C.sub(s.pos,f.home.pos));tick(f,3);
 assert.ok(s.pos[0]>4000,'fighter must move toward the outbound attack, away from its carrier');assert.ok(C.len(C.sub(s.pos,f.home.pos))>start+2000);assert.equal(fighter.auto.escortWing,strike.id);
 out(f,f.theirs[0],[24000,1600,3000],[-1,0,0]);R.orderWing(f.w,f.theirs[0].id,{type:'cap',point:[24000,1600,3000],radius:5000});R.aiWing(f.w,fighter,f.home);assert.equal(fighter.auto.airMission,'intercept');assert.equal(fighter.auto.airTarget,f.theirs[0].id);
});

test('with the air clear an odd-numbered fighter wing attacks a ship, then finishes its pass before changing task',()=>{
 const f=fixture(),fighter=f.ours[0];out(f,fighter,[0,1500,0]);R.aiWing(f.w,fighter,f.home);assert.equal(fighter.auto.type,'strike');assert.equal(fighter.auto.target,f.enemy.id);
 const first=fighter.auto;fighter.phase='run';out(f,f.theirs[1],[-10000,1500,-12000],[-1,0,0]);R.orderWing(f.w,f.theirs[1].id,{type:'strike',target:f.home.id,approach:'bow'});f.theirs[1].phase='go';
 R.aiWing(f.w,fighter,f.home);assert.equal(fighter.auto,first,'a committed moving gun pass must not be interrupted into a hull');fighter.phase='egress';R.aiWing(f.w,fighter,f.home);assert.equal(fighter.auto,first);fighter.phase='go';R.aiWing(f.w,fighter,f.home);assert.equal(fighter.auto.airMission,'intercept');assert.equal(fighter.attackRun,null);
});

test('a departed auto-strike target is replaced by an enemy still in the fighter home system',()=>{
 const f=fixture(),fighter=f.ours[0];out(f,fighter,[0,1500,0]);R.aiWing(f.w,fighter,f.home);assert.equal(fighter.auto.target,f.enemy.id);fighter.phase='run';
 fighter.attackRun={target:f.enemy.id,dir:[1,0,0]};const local={...f.enemy,id:'remaining-local-target',pos:[65000,0,0]};f.w.units.set(local.id,local);f.enemy.sys=null;R.aiWing(f.w,fighter,f.home);assert.equal(fighter.auto.target,local.id);assert.equal(fighter.phase,'go');assert.equal(fighter.attackRun,null);
 f.enemy.sys=f.home.sys;f.enemy.dead=true;R.aiWing(f.w,fighter,f.home);assert.equal(fighter.auto.target,local.id);
});

test('an actual interception closes the range and fires nose guns while both formations keep flying',()=>{
 const f=fixture(),fighter=f.ours[0],foe=f.theirs[1],s=out(f,fighter,[-12000,1800,0]),t=out(f,foe,[12000,1800,0],[-1,0,0]);
 R.orderWing(f.w,foe.id,{type:'strike',target:f.home.id,approach:'bow'});foe.phase='go';for(const wing of f.ours.slice(1))R.orderWing(f.w,wing.id,{type:'standby'});R.orderWing(f.w,f.theirs[0].id,{type:'standby'});
 let shots=0,minRange=Infinity;for(let i=0;i<32;i++){R.tick(f.w,.25);minRange=Math.min(minRange,C.len(C.sub(s.pos,t.pos)));if(s.dogfight===f.w.time){shots++;assert.ok(C.len(s.vel)>R.CRAFT[s.craft].speed*.5);}}
 assert.equal(fighter.auto.airTarget,foe.id);assert.ok(minRange<3500,`closest range ${minRange}`);assert.ok(shots>0,'a forward interception should produce actual heading-gated shots');assert.ok(t.hurt>0||t.n<4);
});

test('an automatic fighter anti-ship sortie skims the hull at speed and returns after its finite passes',()=>{
 const f=fixture(),fighter=f.ours[0];for(const wing of [...f.ours.slice(1),...f.theirs])R.orderWing(f.w,wing.id,{type:'standby'});R.aiWing(f.w,fighter,f.home);
 const ap=R.APPROACH[fighter.auto.approach],s=out(f,fighter,C.add(f.enemy.pos,C.mul(ap,12000+f.enemy.p.len*.6)),C.mul(ap,-1));fighter.phase='go';let shots=0,egress=false,returned=false,passes=0;
 for(let i=0;i<440;i++){R.tick(f.w,.25);passes=Math.max(passes,s.runs||0);if(s.strafeT>f.w.time){shots++;assert.ok(C.len(s.vel)>R.CRAFT[s.craft].speed*.5);}if(fighter.phase==='egress')egress=true;if(s.state==='return'||s.state==='docked')returned=true;}
 assert.ok(shots>0,'automatic ship attacks must produce actual moving gun fire');assert.ok(egress);assert.ok(returned);assert.ok(passes>0);
});
