const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const {propulsionNetworkEvidence,summarize}=require('../scripts/audit-ship-examples.cjs');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx),plain=v=>JSON.parse(JSON.stringify(v)),near=(a,b,message='value')=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=Math.max(1,Math.abs(a),Math.abs(b))*1e-10,`${message}: ${a} != ${b}`);
function fixture(length=142.2,sourceY=155){
 const ship=C.newShip({L:600,W:500,H:320,sec:'rect',plan:'rect',bowW:1,bowH:1,stern:1},'Finite decimal engine contact');
 const core={id:2,k:'engineCore',c:[356-length/2,155,0],d:242,length,dir:[-1,0,0],reactor:1,busFeed:true,propulsionModelVersion:1,ratedInputW:Math.PI*121**2*length*3.4e17,driveProfileId:'standard',machineryGradeId:'standard'};
 const reactor={id:1,k:'gen',c:[433.5,sourceY,0],d:151};ship.parts=[reactor,core];ship.fits=[];ship.armor={hull:0,cit:0};ship.links=[{kind:'power',from:'p1',to:'p2',cap:core.ratedInputW*1.3}];ship.nextId=3;return {ship,core,reactor};
}
function cap(segment,side){const centre=side==='source'?segment.a:segment.b,radius=side==='source'?segment.r0:segment.r1;return [centre,...Array.from({length:32},(_,j)=>C.add(centre,C.add(C.mul(segment.v,Math.cos(j*Math.PI/16)*radius),C.mul(segment.w,Math.sin(j*Math.PI/16)*radius))))];}
function verifiedFeed(f){
 const authored=C.publicJSON(f.ship),network=C.engineTransmission(f.ship),route=network.routes.find(r=>r.to==='p2');assert.ok(route?.ok,'a real conductor connects the installed body');assert.equal(route.limited,false,'the installed conductor carries its complete finite requested capacity');near(route.capacityW,route.requestedCapacityW);
 assert.ok(route.segments.length>0);assert.ok(cap(route.segments[0],'source').every(q=>C.inPart(f.reactor,q)),'the complete initial cap contacts the real reactor solid');assert.ok(cap(route.segments.at(-1),'receiver').every(q=>C.inPart(f.core,q)),'the complete final cap contacts the real engine body');
 const proof=propulsionNetworkEvidence(C,f.ship,network,'electrical');assert.equal(proof.terminalContactFailures.length,0);assert.equal(proof.routes[0].terminalContacts.length,2);assert.equal(proof.independentOutsideSamples,0);assert.equal(proof.independentHardObstacleIds.length,0);assert.equal(proof.independentConduitSurvey.crossings.length,0);near(route.efficiency,Math.exp(-C.ENGINE_FEED_LOSS_PER_M*route.length));assert.equal(C.publicJSON(f.ship),authored,'derived contacts cannot move, resize or rerate saved physical actors');return {network,route,proof};
}

test('decimal engine faces retain a nearby finite input contact across adjacent authored lengths',()=>{
 const boundary=fixture();assert.equal(C.inPart(boundary.core,[356,155,0]),false,'this exact authored boundary reproduces the original 2.84e-14 metre rejection');
 for(const length of [142.2,142.19999999999996,142.20000000000002,142.1151829813805,144.9]){
  const f=fixture(length);
  // A real flat-faced reactor room isolates the decimal receiver-face bug
  // from the separate spherical-source contact correction tested below.
  f.reactor.room=[151,151,151];const {route}=verifiedFeed(f),end=route.segments.at(-1).b;
  assert.ok(Math.abs(end[0]-356)<1e-4,'a decimal rounding error cannot move the contact to the opposite engine face');assert.equal(C.inPart(f.core,end),true);assert.equal(C.resolveEngineSpec(f.core,f.ship).densityFactor,1);
 }
});

test('the actual Imperial source and enlarged engine offset retain full caps and conserve received energy',()=>{
 const f=fixture(142.2,115),{network,route}=verifiedFeed(f),spec=C.resolveEngineSpec(f.core,f.ship),power=C.allocateConnectedPower({sources:[{id:'p1',domain:spec.domain,powerW:C.reactorPower(f.reactor)}],links:network.powerLinks,loads:[{id:'engine:2',port:'p2',domain:spec.domain,kind:'engines',requestedInputW:spec.ratedInputW}],mode:'balanced'}),received=power.granted['engine:2'];
 assert.ok(received>0);assert.ok(power.feedLossW>0);near(power.draw,received+power.feedLossW,'sent power is delivered input plus conductor heat');near(received,route.capacityW*route.efficiency,'the finite conductor loses energy before the receiver');
 const requests=C.buildPropulsionRequests([spec]),result=C.resolvePropulsion(requests,{2:received},1e9),shaft=received*spec.efficiency;
 near(result.wasteHeatW,received*.05,'only real received input becomes engine heat');near(received,shaft+result.wasteHeatW,'received engine power is conserved');near(result.totalThrustN,shaft/spec.shaftWattsPerNewton,'only funded shaft power creates force');near(spec.normalInputW,spec.ratedInputW,'finite contact never raises machinery density');
});

test('an oblique finite feed connects the actual narrow Onager reactor room without changing either body',()=>{
 const f=fixture();Object.assign(f.reactor,{k:'aux',c:[270,65,-165],d:49.220956352647015,room:[170,44,15.942210720176515]});Object.assign(f.core,{c:[263.5308500634046,65.4,-62],d:6.757168642600922,length:6.757168642600922,ratedInputW:82387831550526800000});f.ship.links[0].cap=f.core.ratedInputW*1.3;
 const {route}=verifiedFeed(f);assert.ok(route.length>0);const expectedDensity=f.core.ratedInputW/(Math.PI*(f.core.d/2)**2*f.core.length*C.PROPULSION.referenceInputDensity);near(C.resolveEngineSpec(f.core,f.ship).densityFactor,expectedDensity,'the saved ordinary rating and actual cylindrical volume set density');assert.ok(expectedDensity>1-2e-10&&expectedDensity<=1,'the actual recipe retains its tiny downward rating margin');assert.ok(cap(route.segments[0],'source').every(q=>C.inPart(f.reactor,q)),'the entire tilted first cap lies in the paid finite room, independent of enclosing hull coverage');
});

test('an offset physical nozzle receives a full shaft from a finite outgoing core cap',()=>{
 const f=fixture();f.ship.parts.push({id:3,k:'engine',c:[5,155,200],d:112,nozzleLength:10,dir:[-1,0,0],reactor:1,machineryId:2,nozzleShare:1,busFeed:true,propulsionModelVersion:1});f.ship.nextId=4;
 const network=C.engineDriveRoutes(f.ship),route=network.routes.find(r=>r.from==='p2'&&r.to==='p3');assert.ok(route?.ok);assert.equal(route.limited,false);near(route.capacityW,f.core.ratedInputW*.95,'the real shaft retains the owner output capacity');assert.ok(cap(route.segments[0],'source').every(q=>C.inPart(f.core,q)),'a shaft centre on the core face cannot replace the complete finite outgoing cap');
 const proof=propulsionNetworkEvidence(C,f.ship,network,'mechanical');assert.equal(proof.terminalContactFailures.length,0);assert.equal(proof.routes[0].terminalContacts.length,1);assert.equal(proof.routes[0].terminalContacts[0].side,'source');assert.equal(proof.independentOutsideSamples,0);assert.equal(proof.independentHardObstacleIds.length,0);assert.equal(proof.independentConduitSurvey.crossings.length,0);
});

test('the port correction cannot supply an engine across unoccupied exterior space',()=>{
 const f=fixture();f.ship.hull.assembly=true;f.reactor.c=[550,155,0];const network=C.engineTransmission(f.ship),route=network.routes.find(r=>r.to==='p2');assert.ok(route);assert.equal(route.ok,false);assert.equal(route.capacityW,0);assert.equal(network.parts.length,0);
 const profile=C.propulsionProfile(f.ship,{mass:1e6,aStruct:1e20,inertialSupport:1e6});assert.equal(profile.cores[0].connected,false);const actual=C.solveShipPropulsion(profile,{sources:[{id:'p1',domain:profile.cores[0].domain,powerW:C.reactorPower(f.reactor)}],links:network.powerLinks,throttle:1});assert.equal(actual.power.draw,0);assert.equal(actual.actualInputW,0);assert.equal(actual.actualThrustN,0);
});

test('the independent audit rejects hull-covered missing contacts and a hard object crossing',()=>{
 const f=fixture(),network=C.engineTransmission(f.ship),forged=plain(network),route=forged.routes[0],segment=route.segments.at(-1),end=[356.01,155,0],frame=C.frameAxis(C.sub(end,segment.a));Object.assign(segment,frame,{b:end,l:C.len(C.sub(end,segment.a))});route.path[route.path.length-1]=end;
 const contact=propulsionNetworkEvidence(C,f.ship,forged,'electrical');assert.ok(C.insideOriginalEnvelope(f.ship,end),'hull coverage alone is intentionally present');assert.ok(contact.terminalContactFailures.some(p=>p.side==='receiver'&&p.hostId===2),'a hull-covered centreline cannot substitute for the paid receiving solid');
 // The thin fixed room lies wholly in the two-metre gap between both actual
 // actors. It intersects the conductor but neither the source nor receiver.
 const obstacle={id:3,k:'hdis',c:[357,155,0],d:.5,room:[.5,80,80],autoFit:false};f.ship.parts.push(obstacle);assert.equal(C.overlapParts(obstacle,f.core),false);assert.equal(C.overlapParts(obstacle,f.reactor),false);
 // Keep the exact physical conductor, adding an explicit survey station
 // where it crosses the thin room. The audit's advertised endpoint/midpoint
 // survey is separate from the generator's denser continuous route checks.
 const split=plain(network),crossed=split.routes[0],at=crossed.segments.findIndex(segment=>Math.min(segment.a[0],segment.b[0])<357&&Math.max(segment.a[0],segment.b[0])>357);assert.ok(at>=0);const original=crossed.segments[at],t=(357-original.a[0])/(original.b[0]-original.a[0]),point=C.add(original.a,C.mul(C.sub(original.b,original.a),t)),piece=(a,b)=>({...original,a,b,l:C.len(C.sub(b,a))});crossed.segments.splice(at,1,piece(original.a,point),piece(point,original.b));
 const crossing=propulsionNetworkEvidence(C,f.ship,split,'electrical');assert.ok(crossing.independentHardObstacleIds.includes(3),'the independent finite-radius survey still rejects real equipment crossings');
});


test('mechanical source-cap failures remain visible in the publication audit summary',()=>{
 const f=fixture();f.ship.parts.push({id:3,k:'engine',c:[5,155,200],d:112,nozzleLength:10,dir:[-1,0,0],reactor:1,machineryId:2,nozzleShare:1,busFeed:true,propulsionModelVersion:1});f.ship.nextId=4;
 const electrical=propulsionNetworkEvidence(C,f.ship,C.engineTransmission(f.ship),'electrical'),forged=plain(C.engineDriveRoutes(f.ship)),route=forged.routes[0],first=route.segments[0],point=[356.01,155,0];Object.assign(first,C.frameAxis(C.sub(first.b,point)),{a:point,l:C.len(C.sub(first.b,point))});
 const drivetrain=propulsionNetworkEvidence(C,f.ship,forged,'mechanical');assert.ok(drivetrain.terminalContactFailures.some(contact=>contact.side==='source'&&contact.hostId===2));
 const report=summarize({allKeys:['cap-fixture'],models:[{key:'cap-fixture',engines:[],capacitors:[],fullLoadRun:{},engineTransmission:{...electrical,drivetrain}}]});assert.ok(report.summary.engineDrivetrain.terminalContactFailures.some(contact=>contact.key==='cap-fixture'&&contact.route===route.id&&contact.side==='source'&&contact.hostId===2),'the publisher checks this summary field and cannot lose a mechanical cap failure');
});

test('the independent source audit checks full finite reactor-room caps even inside the hull',()=>{
 const ship=C.newShip({L:100,W:60,H:60,sec:'rect',plan:'rect',bowW:1,bowH:1,stern:1},'Independent finite room source');ship.parts=[{id:1,k:'gen',c:[70,30,0],d:20,room:[20,10,10]},{id:2,k:'engineCore',c:[30,30,0],d:10,length:10,dir:[-1,0,0],reactor:1,busFeed:true,propulsionModelVersion:1,ratedInputW:1e20,driveProfileId:'standard',machineryGradeId:'standard'}];ship.fits=[];ship.links=[];
 const radius=.1,area=Math.PI*radius*radius,make=start=>{const a=[start,30,0],b=[35,30,0],segment={a,b,...C.frameAxis(C.sub(b,a)),l:C.len(C.sub(b,a)),r0:radius,r1:radius},volume=area*segment.l,part={id:-6000000,k:'machinery',transmission:true,sourcePartIds:[1,2],routeId:'p1>p2',segments:[segment],seg:segment,volumeM3:volume},route={id:'p1>p2',from:'p1',to:'p2',engineIds:[2],partId:part.id,ok:true,valid:true,segments:[segment],entrySegments:[],radius,area,length:segment.l,volume,requestedCapacityW:area*C.FEED_FLUX,capacityW:area*C.FEED_FLUX,efficiency:Math.exp(-C.ENGINE_FEED_LOSS_PER_M*segment.l),path:[a,b]};return {routes:[route],parts:[part],engines:{2:{connected:true,capacityW:route.capacityW,routeIds:[route.id]}},flux:C.FEED_FLUX,volume,length:segment.l,massTonnes:volume*C.PARTS.machinery.dens,cost:0};};
 const positive=propulsionNetworkEvidence(C,ship,make(60),'electrical');assert.equal(positive.terminalContactFailures.length,0);assert.equal(positive.routes[0].terminalContacts.length,2);const source=positive.routes[0].terminalContacts.find(c=>c.side==='source');assert.equal(source.hostId,1);assert.equal(source.sampleCount,33);assert.equal(source.verified,true);
 const outside=[59.99,30,0];assert.equal(C.insideOriginalEnvelope(ship,outside),true);assert.equal(C.inPart(ship.parts[0],outside),false);const forged=propulsionNetworkEvidence(C,ship,make(59.99),'electrical');assert.equal(forged.independentOutsideSamples,0,'hull coverage deliberately remains present');assert.ok(forged.terminalContactFailures.some(c=>c.hostId===1&&c.side==='source'&&c.outsideSampleCount===33));assert.equal(forged.routes[0].terminalContacts.find(c=>c.side==='receiver').verified,true,'the real receiver does not mask the absent source');
 const report=summarize({allKeys:['room-source'],models:[{key:'room-source',engines:[],capacitors:[],fullLoadRun:{},engineTransmission:forged}]});assert.ok(report.summary.engineTransmission.terminalContactFailures.some(c=>c.key==='room-source'&&c.side==='source'&&c.hostId===1));
});
