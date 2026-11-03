const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const {C,R,G,D}=vm.runInContext('({C:Core,R:Rts,G:Galaxy,D:YardFleetData.designs})',cx),plain=x=>JSON.parse(JSON.stringify(x));
function fixture(kinds=['branch','branch','branch'],air=false){
 const S=R.makeSector('kuat',13);S.edges=[];S.paths=new Map();S.routes=[{name:'Test route',nodes:Array.from({length:kinds.length+1},(_,i)=>i),pts:[S.systems[0].pos,S.systems[kinds.length].pos],ends:['Start','End']}];for(const s of S.systems)s.links=[];
 kinds.forEach((kind,i)=>{const e={id:i,a:i,b:i+1,len:.1,kind};S.edges.push(e);S.systems[i].links.push(i);S.systems[i+1].links.push(i);});
 const d=plain(D.mc80home),w=R.createWorld({mode:'test',sector:S,seed:13,sensors:false,designs:[d],sides:[{faction:'rebel',ai:false,start:0},{faction:'empire',ai:false,start:kinds.length}],fleets:[[{design:d.key,...(air?{air:[{craft:'xwing',n:4}]}:{})}],[]]}),u=[...w.units.values()][0],g=w.groups.get(u.group);
 // Keep this fixture's group in the graph's named starting node, independent
 // of the sector's historical faction-specific deployment defaults.
 g.sys=0;for(const id of g.units)w.units.get(id).sys=0;g.spool=null;g.transit=null;g.navigation=null;
 return {w,g,u,S};
}
function complete(f,dt=20){let n=0;while((f.g.spool||f.g.transit)&&n++<3000)R.tick(f.w,dt);assert.ok(n<3000);return f.g.sys;}

test('one topology service groups consecutive major edges and isolates every branch edge without mutating the route',()=>{
 const route={path:['a','b','c','d','e','f'],legs:[{len:1,route:'main'},{len:1,route:'main'},{len:1,route:null},{len:1,route:'other'},{len:1,route:'other'}]},before=plain(route),p=C.navigationItinerary(route);
 assert.deepEqual(plain(p.stops),['c','d','f']);assert.deepEqual(plain(p.segments.map(x=>x.path)),[['a','b','c'],['c','d'],['d','e','f']]);assert.equal(p.next,'c');assert.equal(p.final,'f');assert.deepEqual(plain(route),before);
 const mixed=C.navigationItinerary({path:[0,1,2],legs:[{len:1,kind:'branch',route:'stale-major'},{len:1,kind:'trunk'}]});assert.deepEqual(plain(mixed.stops),[1,2],'an explicit native branch cannot inherit a stale major-route label');
 assert.equal(C.navigationItinerary({path:[0,1],legs:[null]}),null);assert.equal(C.navigationItinerary({path:[0,1,2],legs:[{len:1}]}),null);
});

test('native Galaxy and Rts paths share mandatory-stop rules while preserving each original graph',()=>{
 let candidate;for(const a of G.SYSTEMS){for(const b of G.SYSTEMS){const p=G.itinerary(a.key,b.key);if(p?.segments.length>2){candidate={a:a.key,b:b.key,p};break;}}if(candidate)break;}
 assert.ok(candidate);assert.deepEqual(plain(candidate.p),plain(C.navigationItinerary(G.path(candidate.a,candidate.b))));
 const f=fixture(['trunk','trunk','branch','trunk']);assert.deepEqual(plain(R.routeItinerary(f.S,0,4).stops),[2,3,4]);assert.deepEqual(plain(R.routePath(f.S,0,4).path),[0,1,2,3,4]);
});

test('a branch journey arrives in realspace and cannot continue until a new jump command recharges the drive',()=>{
 const f=fixture(),r=R.orderJump(f.w,f.g.id,3);assert.equal(r.ok,true);assert.equal(r.next,1);assert.equal(r.final,3);assert.equal(f.g.spool.dest,1);assert.deepEqual(plain(f.g.navigation.remaining),[2,3]);
 assert.equal(complete(f),1);assert.equal(f.u.sys,1);assert.equal(f.g.navigation.waiting,true);assert.equal(f.g.navigation.final,3);
 R.tick(f.w,500);assert.equal(f.g.sys,1);assert.equal(f.g.spool,null);assert.equal(f.g.transit,null);
 assert.equal(R.orderJump(f.w,f.g.id,3).next,2);assert.equal(f.g.spool.t,0);assert.ok(f.g.spool.need>=8);assert.equal(complete(f),2);assert.equal(R.orderJump(f.w,f.g.id,3).next,3);assert.equal(complete(f),3);assert.equal(f.g.navigation,null);
});

test('an uninterrupted main route passes intermediate systems in one transit, while mixed routes stop at junctions',()=>{
 const main=fixture(['trunk','trunk','trunk']);assert.equal(R.orderJump(main.w,main.g.id,3).next,3);assert.deepEqual(plain(main.g.spool.route.path),[0,1,2,3]);assert.equal(complete(main),3);assert.equal(main.w.events.filter(e=>e.text.includes('に到着')).length,1);
 const mixed=fixture(['trunk','trunk','branch','trunk']);assert.equal(R.orderJump(mixed.w,mixed.g.id,4).next,2);assert.equal(complete(mixed),2);assert.equal(R.orderJump(mixed.w,mixed.g.id,4).next,3);assert.equal(complete(mixed),3);assert.equal(R.orderJump(mixed.w,mixed.g.id,4).next,4);assert.equal(complete(mixed),4);
});

test('fine and coarse updates both end at the same mandatory stop without automatic continuation',()=>{
 for(const dt of [.25,5]){const f=fixture(['trunk','branch','branch']);R.orderJump(f.w,f.g.id,3);assert.equal(complete(f,dt),1);R.tick(f.w,600);assert.equal(f.g.sys,1);assert.equal(f.g.navigation.final,3);assert.equal(f.g.navigation.waiting,true);}
});

test('ETA distinguishes the current segment from remaining travel and an unreachable destination is rejected atomically',()=>{
 const f=fixture(),e=R.jumpEstimate(f.w,f.g.id,3);assert.equal(e.next,1);assert.ok(e.total>e.first);assert.equal(R.etaTo(f.w,f.g.id,3),e.first);
 const before=plain(f.g),r=R.orderJump(f.w,f.g.id,f.S.systems.length-1);assert.equal(r.ok,false);assert.deepEqual(plain(f.g),before);
});

test('legacy full-route spool and in-flight snapshots migrate to the next unpassed stop without moving the ship',()=>{
 const f=fixture(),route=R.routePath(f.S,0,3);f.g.spool={t:3,need:8,dest:3,route,hc:2,trip:R.pathSeconds(route,2)};
 R.normalizeJumpNavigation(f.w,f.g);assert.equal(f.g.spool.dest,1);assert.equal(f.g.spool.t,3);assert.equal(f.g.navigation.final,3);
 f.g.spool=null;f.g.navigation=null;f.g.sys=null;f.u.sys=null;f.w.time=5;f.g.transit={from:0,to:3,path:[0,1,2,3],legs:[{a:0,b:1,t0:0,t1:10},{a:1,b:2,t0:10,t1:20},{a:2,b:3,t0:20,t1:30}],t0:0,t1:30,hc:2};
 const pos=plain(R.groupMapPos(f.w,f.g));R.normalizeJumpNavigation(f.w,f.g);assert.equal(f.g.transit.to,1);assert.equal(f.g.transit.t1,10);assert.equal(f.g.navigation.final,3);assert.deepEqual(plain(R.groupMapPos(f.w,f.g)),pos);
 const saved=plain(f.g);f.g.navigation=null;Object.assign(f.g,saved);assert.equal(R.normalizeJumpNavigation(f.w,f.g).final,3);assert.equal(f.g.transit.to,1);
});

test('carrier-follow craft stop at each actual segment and start a new spool if the carrier has moved on',()=>{
 const f=fixture(['branch','branch','branch'],true),s=[...f.w.squads.values()][0];s.state='out';s.sys=0;s.ops=null;s.pos=C.add(f.u.pos,[10000,0,0]);s.h=[1,0,0];
 R.orderJump(f.w,f.g.id,3);R.tick(f.w,f.g.spool.need+.1);assert.equal(s.follow.dest,1);assert.equal(f.g.transit.to,1);
 // The slow flight remains on its first passage while the carrier is ordered
 // onward; following still has to visit node 1 and spend another spool.
 R.tick(f.w,9);assert.equal(s.follow.phase,'back');s.follow.t1=f.w.time+100;s.follow.legs.at(-1).t1=s.follow.t1;
 complete(f);assert.equal(f.g.sys,1);R.orderJump(f.w,f.g.id,3);R.tick(f.w,f.g.spool.need+.1);assert.equal(f.g.transit.to,2);
 let n=0;while(!(s.follow?.phase==='spool'&&s.follow.from===1)&&n++<1000)R.tick(f.w,.25);
 assert.ok(n<1000);assert.equal(s.sys,1);assert.equal(s.follow.dest,2);assert.ok(s.follow.go>f.w.time);assert.equal(s.state,'return');
});

test('a coarse first update migrates an old in-flight route before advancing past its mandatory stop',()=>{
 const f=fixture();f.g.sys=null;f.u.sys=null;f.w.time=5;f.g.transit={from:0,to:3,path:[0,1,2,3],legs:[{a:0,b:1,t0:0,t1:10},{a:1,b:2,t0:10,t1:20},{a:2,b:3,t0:20,t1:30}],t0:0,t1:30,hc:2};
 R.tick(f.w,20);assert.equal(f.g.sys,1);assert.equal(f.u.sys,1);assert.equal(f.g.navigation.final,3);assert.equal(f.g.navigation.waiting,true);assert.equal(f.g.spool,null);
});

test('cross-system raids cannot bypass a mandatory intermediate stop, while a single continuous segment remains available',()=>{
 const f=fixture(['branch','branch'],true),wing=[...f.w.wings.values()][0],before=plain(wing),r=R.raidCheck(f.w,wing.id,2);assert.equal(r.ok,false);assert.equal(r.stop,1);assert.match(r.why,/必須停止/);assert.deepEqual(plain(wing),before);
 assert.equal(R.raidCheck(f.w,wing.id,1).ok,true);
});
