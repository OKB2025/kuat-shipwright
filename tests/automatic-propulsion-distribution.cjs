const assert=require('node:assert/strict'),{test}=require('node:test'),{C,near,plain}=require('./helpers/global-energy-runtime.cjs');
function design(){const s=C.newShip({L:300,W:160,H:120,sec:'rect',plan:'rect',bowW:1,bowH:1,stern:1},'Automatic power feed');s.parts=[{id:1,k:'gen',c:[200,60,0],d:20},{id:3,k:'engine',c:[5,60,0],d:10,nozzleLength:10,reactor:1,dir:[-1,0,0],propulsionModelVersion:1,driveProfileId:'standard',machineryGradeId:'standard',ratedInputW:1e18,machineryLengthM:12,machineryRadiusM:3,machineryOffsetM:5,busFeed:true,legacyCoolingInputW:0}];s.fits=[];s.links=[];s.armor={hull:.01,cit:0};s.nextId=4;return s;}
test('propulsion distribution is not a placeable part; an engine connects automatically without an authored feed',()=>{const s=design();assert.equal(C.PARTS.powerBus,undefined);assert.equal(C.placePart(s,'powerBus',[100,60,0],4),null);const net=C.engineTransmission(s);assert.equal(net.routes.length,1);const r=net.routes[0];assert.equal(r.automatic,true);assert.equal(r.ok,true,r.reason);assert.equal(r.from,'p1');assert.equal(r.to,'p3');near(r.efficiency,Math.exp(-1e-5*r.length));assert.ok(r.length>0);assert.ok(net.parts.every(p=>p.transmission&&p.id<0));assert.equal(s.parts.some(p=>p.k==='powerBus'),false);assert.deepEqual(plain(s.links),[]);});
test('old junction parts and their obsolete links migrate to a derived direct feed without changing the engine',()=>{const s=design(),saved=plain(C.serialize(s)),engine=plain(saved.parts.find(p=>p.id===3));saved.parts.push({id:2,k:'powerBus',c:[100,60,0],d:8,room:[8,8,8]});saved.links=[{kind:'power',from:'p1',to:'p2',cap:6e17},{kind:'power',from:'p2',to:'p3',cap:9e17}];const original=JSON.stringify(saved),loaded=C.deserialize(saved);assert.equal(JSON.stringify(saved),original,'migration does not mutate the supplied save');assert.equal(loaded.parts.some(p=>p.k==='powerBus'),false);assert.equal((loaded.links||[]).length,0);const e=loaded.parts.find(p=>p.id===3);for(const k of ['c','d','ratedInputW','machineryLengthM','machineryRadiusM'])assert.deepEqual(plain(e[k]),plain(engine[k]));assert.equal(C.engineTransmission(loaded).routes[0].ok,true);assert.equal(C.serialize(loaded).parts.some(p=>p.k==='powerBus'),false);});
test('automatic wiring respects explicit disconnection and isolated domains',()=>{const s=design();s.parts[1].reactor=0;assert.equal(C.engineTransmission(s).routes.length,0);delete s.parts[1].reactor;s.parts[1].powerIsolation=true;assert.equal(C.engineTransmission(s).routes.length,0);});


test('automatic power feeds use source distance without blocking or consuming compartment volume',()=>{
 const s=design();s.parts.push({id:4,k:'cargo',c:[100,60,0],d:20,room:[20,20,20],autoFit:false});
 const net=C.engineTransmission(s),r=net.routes[0];assert.equal(r.ok,true);assert.equal(r.model,'source-distance');
 assert.equal(net.parts.length,0);near(net.volume,0);near(net.massTonnes,0);near(net.cost,0);
 assert.equal(r.path,undefined);assert.equal(r.segments,undefined);near(r.efficiency,Math.exp(-1e-5*r.length));
 assert.equal(C.allOccupied(s).some(p=>p.transmission||p.distributedWiring),false);
 assert.equal(s.parts.some(p=>p.transmission||p.k==='powerBus'),false);
});


test('a dangling authored feed cannot suppress the valid automatic reactor connection',()=>{const s=design();s.links=[{kind:'power',from:'p999',to:'p3',cap:1e18}];const net=C.engineTransmission(s);assert.equal(net.routes.length,1);assert.equal(net.routes[0].from,'p1');assert.equal(net.routes[0].automatic,true);assert.equal(net.routes[0].ok,true);});
test('an explicit staged electrical circuit retains its authored capacities in the distance ledger',()=>{
 const s=design();s.parts.push({id:4,k:'battery',c:[100,60,0],d:4,room:[4,4,4],autoFit:false});
 s.links=[{kind:'power',from:'p1',to:'p4',cap:8e17},{kind:'power',from:'p4',to:'p3',cap:6e17}];
 const net=C.engineTransmission(s);assert.equal(net.routes.length,2);
 assert.ok(net.routes.every(r=>r.model==='source-distance'&&r.ok&&!r.automatic));
 for(const r of net.routes){const link=s.links.find(l=>l.from===r.from&&l.to===r.to);near(r.authoredCapacityW,link.cap);assert.ok(r.capacityW<=6e17);near(r.efficiency,Math.exp(-1e-5*r.length));}
 assert.equal(net.parts.length,0);near(net.volume,0);near(net.massTonnes,0);near(net.cost,0);
 assert.equal(C.allOccupied(s).some(p=>p.transmission||p.distributedWiring),false);
});
