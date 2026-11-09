const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const {C,R,G,D}=vm.runInContext('({C:Core,R:Rts,G:Galaxy,D:YardFleetData.designs})',cx),plain=x=>JSON.parse(JSON.stringify(x));
// A finite synthetic drive craft keeps topology tests independent of stock
// X-wing endurance. Actual allocation, fuel, heat and the 70% gate stay active.
const navigationCraft='navigation-topology-drive';
function navigationCraftProfile(){const massKg=1e6,P=1e18,K=C.engineConversionCoefficient(massKg);return{profileVersion:C.FLEET_PROFILE_VERSION,name:'Finite topology drive',hp:1e12,len:20,width:10,height:5,turnRate:1,D:0,wCap:0,crewNeed:1,crewMax:1,crewCapacity:1,modules:[{k:'reactor',part:1,port:'p1',domain:'main',size:1,share:1},{k:'engine',part:2,port:'p2',domain:'main',size:1,share:1,powerConnected:true},{k:'hyper',part:3,port:'p3',domain:'main',size:1,share:1,powerConnected:true}],grid:{P,Pgen:P,fixed:0,cooling:0,De:P,Ds:0,Dw:0,powerPaths:[{from:'p1',to:'p2',cap:P,ok:true}]},propulsion:{version:C.PROPULSION_MODEL_VERSION,massKg,ratedThrustN:P/K,ratedAccelMps2:P/K/massKg,accelerationLimitMps2:P/K/massKg,engines:[{id:2,machineryId:2,moduleIndex:1,powerNode:'p2',heatNode:'p2',domain:'main',valid:true,available:true,connected:true,outletAvailable:true,driveProfileId:'standard',machineryShape:'cylinder',machineryLengthM:2,machineryRadiusM:1,effectiveMachineryVolumeM3:2*Math.PI,ratedInputW:P,ratedThrustN:P/K,wattsPerNewton:K,direction:[1,0,0],pathCapacityW:P}]},fuel:{version:1,capacityKnown:true,capacityJ:1e23,specificEnergyJPerKg:C.fuelSpecificEnergyJPerKg()}};}
R.CRAFT[navigationCraft]={name:'Finite topology drive',role:'fighter',hyper:1,mass:1000,size:1,dims:[20,10,5],crew:1,armor:1,aa:0,strike:0,speed:C.propulsionTerminalSpeed(navigationCraftProfile()),powerProfile:navigationCraftProfile()};
function fixture(kinds=['branch','branch','branch'],air=false){
 const S=R.makeSector('kuat',13);S.edges=[];S.paths=new Map();S.routes=[{name:'Test route',nodes:Array.from({length:kinds.length+1},(_,i)=>i),pts:[S.systems[0].pos,S.systems[kinds.length].pos],ends:['Start','End']}];for(const s of S.systems)s.links=[];
 kinds.forEach((kind,i)=>{const e={id:i,a:i,b:i+1,len:.1,kind};S.edges.push(e);S.systems[i].links.push(i);S.systems[i+1].links.push(i);});
 const d=plain(D.mc80home),w=R.createWorld({mode:'test',sector:S,seed:13,sensors:false,designs:[d],sides:[{faction:'rebel',ai:false,start:0},{faction:'empire',ai:false,start:kinds.length}],fleets:[[{design:d.key,...(air?{air:[{craft:navigationCraft,n:4}]}:{})}],[]]}),u=[...w.units.values()][0],g=w.groups.get(u.group);
 // Keep this fixture's group in the graph's named starting node, independent
 // of the sector's historical faction-specific deployment defaults.
 g.sys=0;for(const id of g.units)w.units.get(id).sys=0;g.spool=null;g.transit=null;g.navigation=null;
 return {w,g,u,S};
}
function complete(f,dt=20){let n=0;while((f.g.spool||f.g.transit)&&n++<3000)R.tick(f.w,dt);assert.ok(n<3000);return f.g.sys;}

function departCruising(f,dest){
 const route=R.routePath(f.S,f.u.sys,dest),a=f.S.systems[route.path[0]].pos,b=f.S.systems[route.path[1]].pos,dir=C.norm([b[0]-a[0],0,b[1]-a[1]]);
 f.u.yaw=Math.atan2(dir[2],dir[0]);f.u.velocity=C.mul(dir,.95*C.propulsionTerminalSpeed(f.u));C.allocateShipPower(f.u,C.fleetSystems(f.u),{throttle:1},0,'balanced');
 for(const s of f.w.squads.values())if(s.sys===f.u.sys&&['out','return'].includes(s.state)){R.squadPropulsion(s,1,0);const speed=C.propulsionTerminalSpeed(s.drive);assert.ok(speed>0);s.h=dir.slice();s.vel=C.mul(dir,.95*speed);}
 assert.equal(R.orderJump(f.w,f.g.id,dest).ok,true);R.tick(f.w,f.g.spool.need+.1);
 let n=0;while(!f.g.transit&&n++<80)R.tick(f.w,.25);assert.ok(f.g.transit,'the charged, cruising carrier completes real staggered entry');
}

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
 const f=fixture(['branch','branch','branch'],true),s=[...f.w.squads.values()][0];s.state='out';s.sys=0;s.ops=null;s.pos=C.add(f.u.pos,[1000000,0,0]);s.h=[1,0,0];
 departCruising(f,3);assert.equal(s.follow.dest,1);assert.equal(f.g.transit.to,1);
 // The slow flight remains on its first passage while the carrier is ordered
 // onward; following still has to visit node 1 and spend another spool.
 let preparation=0;while(s.follow?.phase==='spool'&&preparation++<800)R.tick(f.w,.25);assert.equal(s.follow.phase,'back','the finite craft completes its actual charged departure');s.follow.t1=f.w.time+100;s.follow.legs.at(-1).t1=s.follow.t1;
 complete(f);assert.equal(f.g.sys,1);departCruising(f,3);assert.equal(f.g.transit.to,2);
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
