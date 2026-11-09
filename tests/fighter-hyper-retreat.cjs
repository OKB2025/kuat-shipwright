const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const run=code=>vm.runInContext(code,context);
run(`
function retreatFixture(air=[{craft:'xwing',n:6,wingNo:1},{craft:'tie_ln',n:6,wingNo:1}]){
 const d=JSON.parse(JSON.stringify(YardFleetData.designs.mc80home));
 const w=Rts.createWorld({mode:'test',region:'kuat',seed:17,designs:[d],sides:[{faction:'rebel',ai:false},{faction:'empire',ai:false}],fleets:[[{design:d.key,air}],[]]});
 const home=[...w.units.values()][0],g=w.groups.get(home.group),wing=[...w.wings.values()][0],from=home.sys,edge=w.sector.edges[w.sector.systems[from].links[0]],to=edge.a===from?edge.b:edge.a;
 home.warp=null;home.velocity=[0,0,0];Rts.orderUnit(w,home.id,{type:'hold'});
 for(const s of w.squads.values()){s.state='out';s.pos=[home.pos[0]+1000000,home.pos[1]+5000,home.pos[2]];s.h=[1,0,0];s.vel=[2000,0,0];s.ops=null;s.t=0;}
 return {w,home,g,wing,from,to};
}
function leave(a){
 // Cohort tests begin in a legitimate forward cruise. Physical acceleration
 // from rest is covered by the dedicated hyperspace preparation tests.
 const route=Rts.routePath(a.w.sector,a.home.sys,a.to),from=a.w.sector.systems[route.path[0]].pos,to=a.w.sector.systems[route.path[1]].pos,dir=Core.norm([to[0]-from[0],0,to[1]-from[1]]);
 a.home.yaw=Math.atan2(dir[2],dir[0]);a.home.velocity=Core.mul(dir,.95*Core.propulsionTerminalSpeed(a.home));Core.allocateShipPower(a.home,Core.fleetSystems(a.home),{throttle:1},0,'balanced');
 const r=Rts.orderJump(a.w,a.g.id,a.to);if(!r.ok)throw Error(r.why);a.g.spool.t=a.g.spool.need-.25;
 for(let i=0;i<80&&!a.g.transit;i++)Rts.tick(a.w,.25);
 if(!a.g.transit)throw Error('Cruising carrier did not complete actual jump preparation: '+JSON.stringify(Rts.groupHyperspaceReadiness(a.w,a.g)));
 return a;
}
function advance(a,predicate,limit=2400){for(let i=0;i<limit&&!predicate();i++)Rts.tick(a.w,.25);if(!predicate())throw Error('Timed out at '+a.w.time);}
`);
test('mixed wings let drive-equipped aircraft follow while aircraft without drives are left behind',()=>{
 const r=run(`(()=>{const a=leave(retreatFixture()),x=[...a.w.squads.values()].find(s=>s.craft==='xwing'),tie=[...a.w.squads.values()].find(s=>s.craft==='tie_ln');return {xN:x.n,xState:x.state,phase:x.follow?.phase,sys:x.sys,from:a.from,to:x.follow?.dest,tieN:tie.n,tieState:tie.state,order:a.wing.order.type,raid:!!a.wing.raid};})()`);
 assert.equal(r.xN,6);assert.equal(r.xState,'return');assert.equal(r.phase,'spool');assert.equal(r.sys,r.from);assert.equal(r.tieN,0);assert.equal(r.tieState,'lost');assert.equal(r.order,'auto');assert.equal(r.raid,false);
});
test('self-powered withdrawal follows real lanes at its own drive class and lands through carrier hatches',()=>{
 const r=run(`(()=>{const a=leave(retreatFixture([{craft:'bwing',n:6}])),s=[...a.w.squads.values()][0];advance(a,()=>s.follow?.phase==='back');const f=s.follow,trip=f.t1-f.t0,route=Rts.routePath(a.w.sector,a.from,a.to),expected=Rts.pathSeconds(route,Rts.CRAFT.bwing.hyper),start=Rts.followMapPos(a.w,s),wasAway=s.sys===null&&s.state==='follow';advance(a,()=>s.state==='docked');return {trip,expected,wasAway,startFinite:start.every(Number.isFinite),homeSys:a.home.sys,sys:s.sys,to:a.to,n:s.n,follow:!!s.follow,ops:s.ops,t:s.t};})()`);
 assert.equal(r.trip,r.expected);assert.equal(r.wasAway,true);assert.equal(r.startFinite,true);assert.equal(r.homeSys,r.to);assert.equal(r.sys,r.to);assert.equal(r.n,6);assert.equal(r.follow,false);assert.equal(r.ops,null);assert.ok(r.t>0);
});
for(const kind of ['launch','land'])test(`partial ${kind} preserves aboard aircraft and temporarily splits only the airborne cohort`,()=>{
 const r=run(`(()=>{const a=retreatFixture([{craft:'xwing',n:6}]),s=[...a.w.squads.values()][0],originalId=s.id;s.ammo=s.ammo.map(n=>n/2);const ammo=s.ammo.slice(),gas=s.laserGas;s.ops={k:'${kind}',u:a.home.id,m:0,t0:-22.5,per:10,t1:100,n:6};a.w.time=2.5;leave(a);const child=[...a.w.squads.values()].find(x=>x.followParent===originalId),split={aboard:s.n,flight:child?.n,total:[...a.w.squads.values()].reduce((n,x)=>n+x.n,0),lost:[...a.w.squads.values()].reduce((n,x)=>n+(x.lostN||0),0),separateAmmo:child?.ammo!==s.ammo,ammo:child?.ammo.slice(),gas:child?.laserGas};advance(a,()=>a.w.squads.size===1&&s.state==='docked');return {split,ammo,gas,merged:s.n,n0:s.n0,slots:s.slots.slice(),squads:a.home.squads.length,wingSquads:a.wing.squads.length,hold:!!s.followSplit};})()`);
 assert.equal(r.split.aboard,3);assert.equal(r.split.flight,3);assert.equal(r.split.total,6);assert.equal(r.split.lost,0);assert.equal(r.split.separateAmmo,true);assert.deepEqual(Array.from(r.split.ammo),Array.from(r.ammo));assert.equal(r.split.gas,r.gas);assert.equal(r.merged,6);assert.equal(r.n0,6);assert.equal(new Set(r.slots).size,6);assert.equal(r.squads,1);assert.equal(r.wingSquads,1);assert.equal(r.hold,false);
});
test('canceling the carrier jump never starts an independent fighter departure',()=>{
 const r=run(`(()=>{const a=retreatFixture(),r=Rts.orderJump(a.w,a.g.id,a.to),cancel=Rts.cancelJump(a.w,a.g.id);Rts.tick(a.w,.25);return {ok:r.ok,cancel,sys:a.home.sys,from:a.from,follow:[...a.w.squads.values()].some(s=>s.follow),lost:[...a.w.squads.values()].some(s=>s.state==='lost')};})()`);
 assert.equal(r.ok,true);assert.equal(r.cancel,true);assert.equal(r.sys,r.from);assert.equal(r.follow,false);assert.equal(r.lost,false);
});
test('custom aircraft use their own measured drive while drive-less blueprints cannot follow',()=>{
 const r=run(`(()=>{const base={...Rts.CRAFT.xwing,fireArcs:[{fixed:true,dir:[1,0,0],up:[0,1,0],gun:1,aa:1}]},yes=Rts.registerDesignCraft({ref:'retreat-custom',name:'Custom drive',craft:{...base,hyper:1.75}}),no=Rts.registerDesignCraft({ref:'retreat-no-drive',name:'No drive',craft:{...base,hyper:null}});if(!yes||!no)throw Error('registration');const a=leave(retreatFixture([{craft:yes,n:4,wingNo:1},{craft:no,n:4,wingNo:1}])),sq=[...a.w.squads.values()];return {yes:sq.find(s=>s.craft===yes).follow?.hc,no:sq.find(s=>s.craft===no).state,live:sq.reduce((n,s)=>n+s.n,0)};})()`);
 assert.equal(r.yes,1.75);assert.equal(r.no,'lost');assert.equal(r.live,4);
});
test('the battle continues and point defence can hit fighters while they spool after the last carrier departs',()=>{
 const r=run(`(()=>{const designs=['mc80home','imperial'].map(k=>JSON.parse(JSON.stringify(YardFleetData.designs[k]))),w=Rts.createWorld({mode:'test',region:'kuat',seed:17,designs,sides:[{faction:'rebel',ai:false},{faction:'empire',ai:false}],fleets:[[{design:'mc80home',air:[{craft:'xwing',n:6}]}],[{design:'imperial'}]]}),home=[...w.units.values()].find(u=>u.side===0),enemy=[...w.units.values()].find(u=>u.side===1),g=w.groups.get(home.group),s=[...w.squads.values()][0],from=home.sys,edge=w.sector.edges[w.sector.systems[from].links[0]],to=edge.a===from?edge.b:edge.a;
 home.warp=null;home.velocity=[0,0,0];Rts.orderUnit(w,home.id,{type:'hold'});s.state='out';s.pos=[home.pos[0]+1000000,5000,home.pos[2]];s.h=[1,0,0];s.ops=null;enemy.sys=from;w.groups.get(enemy.group).sys=from;enemy.pos=[s.pos[0],s.pos[1],s.pos[2]+4000];enemy.warp=null;enemy.p={...enemy.p,aa:50,aaArcs:[50,50,50,50,50,50],aaCh:50};Rts.orderUnit(w,enemy.id,{type:'hold'});leave({w,home,g,from,to});return {battle:w.battles.has(from),motherAway:home.sys===null,phase:s.follow?.phase,hurt:s.hurt+(s.lostN||0),fire:s.dogfight===w.time};})()`);
 assert.equal(r.battle,true);assert.equal(r.motherAway,true);assert.equal(r.phase,'spool');assert.ok(r.hurt>0);assert.equal(r.fire,false);
});
test('resupply waits for split cohorts to rejoin and then replaces casualties without reusing reserved aircraft IDs',()=>{
 const r=run(`(()=>{const a=retreatFixture([{craft:'bwing',n:12}]),s=[...a.w.squads.values()][0];s.n=6;s.slots=[0,1,2,3,4,5];s.lostN=6;s.rep=.5;s.ops={k:'launch',u:a.home.id,m:0,t0:-22.5,per:10,t1:100,n:6};a.home.mq=[s.ops.t0+s.ops.n*s.ops.per];a.w.time=2.5;leave(a);const child=[...a.w.squads.values()].find(q=>q.followParent===s.id),childCredit=child.rep;a.g.transit.t1=a.w.time;a.w.sides[0].home=[a.to];a.w.sides[0].supply.rate=1e9;a.w.sides[0].supply.cap=1e9;a.w.timers.sup=0;for(let i=0;i<16;i++)Rts.tick(a.w,.25);const held={n:s.n,credit:s.rep,need:a.home.supplyNeed?.craft};advance(a,()=>a.w.squads.size===1&&s.state==='docked');advance(a,()=>s.n===12);return {held,childCredit,n:s.n,n0:s.n0,unique:new Set(s.slots).size,count:s.slots.length,rep:s.rep};})()`);
 assert.equal(r.held.n,3);assert.equal(r.held.credit,.5);assert.equal(r.held.need,0);assert.equal(r.childCredit,0);assert.equal(r.n,12);assert.equal(r.n0,12);assert.equal(r.count,12);assert.equal(r.unique,12);assert.equal(r.rep,0);
});
