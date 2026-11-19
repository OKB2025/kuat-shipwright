const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const {C,R,D}=vm.runInContext('({C:Core,R:Rts,D:YardFleetData.designs})',cx),plain=x=>JSON.parse(JSON.stringify(x));
// 2026-11-19 fixture changed (the expectations about following are unchanged):
// - Units are no longer under manual control: a group with a ship under manual control refuses a jump
//   (js/core.js orderJump: '操艦中の艦があります…').
// - Departures follow the v27 rule (user decision 2026-11-17, docs/hyperspace-auto-entry-v27.md:3,12,52): a full charge,
//   the bow within 5 deg of the jump vector, then the drive's burst to 0.5c, which takes several ticks; craft obey the
//   same rule with their own charge. prime() sets up the carrier as leave() in tests/fighter-hyper-retreat.cjs does,
//   depart() ticks until the group is in transit, and the craft's spool is ticked until it is under way. Charging time
//   itself is covered by tests/hyper-charge.cjs.
function fixture(enemy=false){
 const w=R.createWorld({mode:'test',region:'kuat',sensors:false,seed:37,designs:['mc80home','imperial'].map(k=>plain(D[k])),sides:[{faction:'rebel',ai:false},{faction:'empire',ai:false}],fleets:[[{design:'mc80home',air:[{craft:'xwing',n:4}]}],enemy?[{design:'imperial',air:[]}]:[]]});
 const home=[...w.units.values()].find(u=>u.side===0),wing=[...w.wings.values()][0],s=w.squads.get(wing.squads[0]),g=w.groups.get(home.group),from=home.sys,edge=w.sector.edges[w.sector.systems[from].links[0]],to=edge.a===from?edge.b:edge.a;
 for(const u of w.units.values()){u.manual=false;u.velocity=[0,0,0];u.warp=null;u.jump=null;R.orderUnit(w,u.id,{type:'hold'});}
 return {w,home,wing,s,g,from,to};
}
function airborne(f){Object.assign(f.s,{state:'out',sys:f.from,pos:[-90000,8000,0],h:[-1,0,0],vel:[-2000,0,0],ops:null,t:0,launched:f.w.time});f.wing.phase='on';}
function prime(f,to=f.to){const route=R.routePath(f.w.sector,f.home.sys,to),a=f.w.sector.systems[route.path[0]].pos,b=f.w.sector.systems[route.path[1]].pos;f.home.yaw=Math.atan2(b[1]-a[1],b[0]-a[0]);f.home.velocity=[0,0,0];for(const id of f.g.units){const u=f.w.units.get(id);if(u)u.hyperE=C.hyperChargeNeedJ(u.p);}}
function depart(f,to=f.to){prime(f,to);assert.equal(R.orderJump(f.w,f.g.id,to).ok,true);f.g.spool.t=f.g.spool.need-.25;for(let i=0;i<80&&!f.g.transit;i++)R.tick(f.w,.25);assert.equal(f.home.sys,null);}
function finishSpool(f){f.w.time=Math.max(f.w.time,f.s.follow.go);for(let i=0;i<400&&f.s.follow?.phase==='spool';i++)R.tick(f.w,.25);assert.equal(f.s.follow.phase,'back');assert.equal(f.s.state,'follow');assert.equal(f.s.sys,null);}

test('a faster fighter reaches the actual stop and waits in realspace for the carrier before physically landing',()=>{
 const f=fixture();f.home.info.hyper=5;airborne(f);depart(f);finishSpool(f);
 assert.ok(f.s.follow.t1<f.g.transit.t1);f.w.time=f.s.follow.t1;R.tick(f.w,.25);
 assert.equal(f.s.follow.phase,'wait');assert.equal(f.s.state,'return');assert.equal(f.s.sys,f.to);assert.equal(f.s.n,4);
 f.w.time=f.g.transit.t1;R.tick(f.w,.25);
 assert.equal(f.home.sys,f.to);assert.equal(f.s.follow,null);assert.equal(f.s.sys,f.to);assert.equal(f.s.state,'return');assert.notDeepEqual(plain(f.s.pos),plain(f.home.pos),'returning craft must approach a real hatch rather than teleport aboard');
 for(let i=0;i<1000&&f.s.state!=='docked';i++)R.tick(f.w,.25);
 assert.equal(f.s.state,'docked');assert.equal(f.s.n,4);assert.equal(f.s.lostN||0,0);
});

test('a fighter completes its first flight then plots another real leg when its carrier jumps again',()=>{
 const f=fixture();f.home.info.hyper=.5;airborne(f);depart(f);finishSpool(f);const firstArrival=f.s.follow.t1;
 f.w.time=f.g.transit.t1;R.tick(f.w,.25);assert.equal(f.home.sys,f.to);assert.ok(firstArrival>f.w.time);
 depart(f,f.from);f.w.time=firstArrival;R.tick(f.w,.25);
 assert.equal(f.s.follow.from,f.to);assert.equal(f.s.follow.dest,f.from);assert.equal(f.s.follow.phase,'spool');assert.equal(f.s.sys,f.to);assert.ok(f.s.follow.go>f.w.time,'a new segment must spend a fresh recharge interval in realspace');
 // (the first leg spent the craft's charge; it is topped up here rather than waiting minutes for spare power)
 f.s.hyperE=C.hyperUnitNeedJ(f.s.drive);if(f.s.drive)f.s.drive.hyperE=f.s.hyperE;f.w.time=f.s.follow.go;for(let i=0;i<400&&f.s.follow?.phase==='spool';i++)R.tick(f.w,.25);assert.equal(f.s.follow.phase,'back');assert.ok(f.s.follow.t1>f.w.time,'the second leg must consume the craft drive travel time');assert.equal(f.s.sys,null);
 f.w.time=Math.max(f.s.follow.t1,f.g.transit?.t1||0);R.tick(f.w,.25);
 assert.equal(f.home.sys,f.from);assert.equal(f.s.sys,f.from);assert.equal(f.s.follow,null);assert.equal(f.s.state,'return');assert.equal(f.s.n,4);
});

test('a disconnected route and a destroyed carrier cannot produce an invalid or immortal following flight',()=>{
 const disconnected=fixture();airborne(disconnected);prime(disconnected);assert.equal(R.orderJump(disconnected.w,disconnected.g.id,disconnected.to).ok,true);
 disconnected.w.sector.paths.clear();disconnected.w.sector.systems[disconnected.from].links=[];disconnected.g.spool.t=disconnected.g.spool.need-.25;for(let i=0;i<80&&!disconnected.g.transit;i++)R.tick(disconnected.w,.25);
 assert.equal(disconnected.s.state,'lost');assert.equal(disconnected.s.n,0);assert.ok(!disconnected.s.follow);
 const destroyed=fixture();airborne(destroyed);depart(destroyed);finishSpool(destroyed);destroyed.home.dead=true;R.tick(destroyed.w,.25);
 assert.equal(destroyed.s.state,'lost');assert.equal(destroyed.s.n,0);assert.equal(destroyed.s.follow,null);
});

test('a carrier withdrawal leaves an already travelling offensive raid under its own raid lifecycle',()=>{
 const f=fixture(true),enemy=[...f.w.units.values()].find(u=>u.side===1);enemy.sys=f.to;f.w.groups.get(enemy.group).sys=f.to;
 assert.equal(R.orderRaid(f.w,f.wing.id,f.to).ok,true);
 for(let i=0;i<2000&&f.wing.raid?.phase==='launch';i++)R.tick(f.w,.25);
 assert.equal(f.wing.raid?.phase,'out');const raid=f.wing.raid,arrival=raid.t1;
 depart(f);assert.equal(f.wing.raid,raid);assert.equal(raid.phase,'out');assert.equal(raid.t1,arrival);assert.equal(f.s.raid,f.wing.id);assert.ok(!f.s.follow);assert.equal(f.s.n,4);
});
