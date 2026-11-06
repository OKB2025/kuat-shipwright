const assert=require('node:assert/strict'),{test}=require('node:test');
const {loadRuntime}=require('../scripts/update-ship-examples.cjs');
const {conduitCrossingSurvey,engineBodyIntersectionEvidence,propulsionNetworkEvidence}=require('../scripts/audit-ship-examples.cjs');
const {C}=loadRuntime(require('node:path').resolve(__dirname,'..'));

test('shared engine terminals exempt complete pipe sections, not only their axes',()=>{
 const ship=C.newShip({L:80,W:30,H:30},'Thin engine manifold');
 ship.parts=[{id:1,k:'engineCore',c:[20,15,0],d:20,length:2,dir:[-1,0,0],ratedInputW:1e18,driveProfileId:'standard',machineryGradeId:'advanced'}];
 const network=x=>({routes:[
  {id:'p1>p2',from:'p1',to:'p2',ok:true,radius:.5,segments:[{a:[x,13,0],b:[x,17,0]}]},
  {id:'p1>p3',from:'p1',to:'p3',ok:true,radius:.5,segments:[{a:[x,15,-2],b:[x,15,2]}]}
 ]});
 const outsideWitness=[21.1,15,0];
 assert.equal(C.inPart(ship.parts[0],outsideWitness),false,'the pipe intersection protrudes past the real engine wall');
 assert.equal(conduitCrossingSurvey(C,ship,network(20.8)).crossings.length,1,'axes within the core cannot hide solid pipe overlap outside it');
 assert.equal(conduitCrossingSurvey(C,ship,network(20)).crossings.length,0,'a manifold wholly contained by its engine body is allowed');
});


test('active machinery audit catches thin physical cylinder and reactor intersections',()=>{
 const ship=C.newShip({L:80,W:30,H:30},'Native body intersection');
 const engine=(id,z)=>({id,k:'engine',c:[10,15,z],dir:[-1,0,0],d:6,nozzleLength:4,machineryShape:'cylinder',machineryLengthM:10,machineryRadiusM:3,machineryOffsetM:2,ratedInputW:1e18,driveProfileId:'standard',machineryGradeId:'standard'});
 ship.parts=[engine(1,0),engine(2,5.999)];
 let evidence=engineBodyIntersectionEvidence(C,ship);assert.equal(evidence.bodyIntersections.length,1,'a millimetre overlap must not fall between coarse sample points');assert.ok(Math.abs(evidence.bodyIntersections[0].penetrationM-.001)<1e-9);
 for(const point of evidence.bodyIntersections.map(row=>row.pointM))for(const body of C.engineMachineryPaths(ship))assert.equal(C.inPart(body,point),true);
 ship.parts[1].c[2]=6;evidence=engineBodyIntersectionEvidence(C,ship);assert.equal(evidence.bodyIntersections.length,0,'touching cylinder surfaces have no shared occupied volume');
 ship.parts=[engine(1,0),{id:3,k:'gen',c:[17,15,4.999],d:4}];evidence=engineBodyIntersectionEvidence(C,ship);assert.equal(evidence.deviceIntersections.length,1);assert.ok(Math.abs(evidence.deviceIntersections[0].penetrationM-.001)<1e-9);
 ship.parts[1].c[2]=5;assert.equal(engineBodyIntersectionEvidence(C,ship).deviceIntersections.length,0,'a reactor may touch the body without overlapping it');
});

test('explicit shared engine cores participate in the exact body and reactor intersection audit',()=>{
 const ship=C.newShip({L:80,W:30,H:30},'Explicit shared body intersection'),core=(id,z)=>({id,k:'engineCore',c:[20,15,z],d:6,length:10,dir:[-1,0,0],ratedInputW:1e18,driveProfileId:'standard',machineryGradeId:'advanced'});
 ship.parts=[core(1,0),core(2,5.999)];let evidence=engineBodyIntersectionEvidence(C,ship);assert.equal(evidence.explicitCoreCount,2);assert.equal(evidence.bodyIntersections.length,1);assert.ok(Math.abs(evidence.bodyIntersections[0].penetrationM-.001)<1e-9);for(const p of ship.parts)assert.equal(C.inPart(p,evidence.bodyIntersections[0].pointM),true);
 ship.parts[1].c[2]=6;assert.equal(engineBodyIntersectionEvidence(C,ship).bodyIntersections.length,0);
 ship.parts=[core(1,0),{id:3,k:'gen',c:[20,15,4.999],d:4}];evidence=engineBodyIntersectionEvidence(C,ship);assert.equal(evidence.deviceIntersections.length,1);assert.equal(evidence.deviceIntersections[0].bodyPartId,1);ship.parts[1].c[2]=5;assert.equal(engineBodyIntersectionEvidence(C,ship).deviceIntersections.length,0);
});

function exteriorEngine(inputW=3.258845612783181e25){
 const ship=C.newShip({L:2000,W:1200,H:800,sec:'rect',plan:'rect',bowW:1,bowH:1,stern:1,bowFree:true,stations:[[0,1,1],[1,1,1]]},'Finite exterior engine contact');
 ship.parts=[{id:1,k:'gen',c:[1000,400,0],d:765.2607082711081},{id:2,k:'engine',c:[-200,400,0],d:210.5088,nozzleLength:105.2544,dir:[-1,0,0],reactor:1,busFeed:true,propulsionModelVersion:1,ratedInputW:inputW,driveProfileId:'standard',machineryGradeId:'advanced',machineryLengthM:121.37048989277311,machineryRadiusM:67.362816,machineryOffsetM:52.6272,legacyCoolingInputW:0}];
 ship.fits=[];ship.nextId=3;ship.links=[{kind:'power',from:'p1',to:'p2',cap:inputW}];assert.equal(C.resolveEngineSpec(ship.parts[1],ship).valid,true);return ship;
}
function entryEvidence(ship){const network=C.engineTransmission(ship);return {network,route:network.routes[0],evidence:propulsionNetworkEvidence(C,ship,network)};}
function assertBodyContact(ship,route){
 const body=C.engineMachineryPaths(ship).find(p=>p.nozzle===2);assert.ok(body);
 for(const entry of route.entrySegments){
  const terminal=entry.b;
  for(let i=0;i<32;i++){const angle=i*Math.PI/16,q=C.add(terminal,C.add(C.mul(entry.v,entry.r1*Math.cos(angle)),C.mul(entry.w,entry.r1*Math.sin(angle))));assert.equal(C.inPart(body,q),true,'the complete connection cap must fit the actual machinery independently of its sleeve');}
 }
}
test('an exterior electrical connector retains full capacity when its complete terminal cap fits',()=>{
 const ship=exteriorEngine(1e23),{network,route,evidence}=entryEvidence(ship);assert.equal(route.ok,true);assert.equal(route.capacityW,1e23);assert.equal(route.limited,false);assert.ok(route.entrySegments.length>0);assertBodyContact(ship,route);assert.equal(evidence.externalEntryFailures.length,0);assert.equal(evidence.independentOutsideSamples,0);assert.ok(network.massTonnes>0&&network.cost>0);
});
test('an oversized exterior connector is derated to a real cap instead of supporting itself',()=>{
 const ship=exteriorEngine(),{network,route,evidence}=entryEvidence(ship);assert.equal(route.ok,true);assert.equal(route.limited,true);assert.ok(route.capacityW>0&&route.capacityW<route.requestedCapacityW);assert.ok(route.radius<67.362816);assertBodyContact(ship,route);assert.equal(evidence.externalEntryFailures.length,0);assert.equal(evidence.independentOutsideSamples,0);assert.equal(evidence.volumeConsistent,true);assert.equal(route.efficiency,Math.exp(-1e-5*route.length));assert.ok(network.massTonnes>0&&network.cost>0);
});
test('hull coverage cannot replace a full electrical contact with the paid integrated body',()=>{
 const ship=exteriorEngine();ship.parts[1].c[0]=200;const {route,evidence}=entryEvidence(ship);assert.equal(route.ok,true);assert.equal(route.limited,true);assert.ok(route.radius<67.362816);assert.equal(route.entrySegments.length,0,'this receiving body is entirely inside the hull');assert.equal(evidence.terminalContactFailures.length,0);assert.equal(evidence.routes[0].terminalContact.sampleCount,33);assert.equal(evidence.routes[0].terminalContact.verified,true);
});
test('a blocked exterior connector cannot invent a terminal or free outside passage',()=>{
 const ship=exteriorEngine();ship.parts.push({id:3,k:'cargo',c:[-10,400,0],d:10,room:[10,4000,4000],autoFit:false});ship.nextId=4;const {network,route,evidence}=entryEvidence(ship);assert.equal(route.ok,false);assert.equal(network.engines[2].connected,false);assert.equal(route.capacityW,0);assert.equal(network.volume,0);assert.equal(network.massTonnes,0);assert.equal(evidence.externalEntryCount,0);
});
test('a nozzle throat on a decimal flat-cap boundary keeps its real mechanical contact',()=>{
 const ship=C.newShip({assembly:true,L:40,W:10,H:7.4},'Decimal nozzle throat');
 ship.parts=[{id:10,k:'struct',form:'box',c:[26.25,3.7,0],s:[27.5,10,7.4]},{id:1,k:'gen',c:[30,3.7,0],d:3},{id:73,k:'engineCore',c:[15.2,3.7,0],d:1.5,length:2,dir:[-1,0,0],reactor:1,busFeed:true,propulsionModelVersion:1,ratedInputW:77547073061210490000,driveProfileId:'standard',machineryGradeId:'advanced',legacyCoolingInputW:0},{id:52,k:'engine',c:[9.98,3.7,0],d:4.4,dir:[-1,0,0],reactor:1,nozzleLength:3.9600000000000004,machineryId:73,propulsionModelVersion:1,nozzleShare:77547073061210490000}];
 ship.fits=[];ship.nextId=74;ship.links=[{kind:'power',from:'p1',to:'p73',cap:77547073061210490000}];
 const nozzle=ship.parts.at(-1),throat=C.sub(nozzle.c,C.mul(C.norm(nozzle.dir),C.partDims(nozzle).l/2));assert.equal(throat[0],11.96);assert.equal(C.inPart(nozzle,throat),false,'this fixture exercises the floating point flat-cap boundary');assert.equal(C.inPart(nozzle,C.add(throat,[-1e-6,0,0])),true);
 const network=C.engineDriveRoutes(ship),route=network.routes.find(r=>r.nozzleId===52);assert.equal(route?.ok,true);const evidence=propulsionNetworkEvidence(C,ship,network,'mechanical');assert.equal(evidence.externalEntryCount,1);assert.equal(evidence.externalEntryFailures.length,0);assert.equal(evidence.independentOutsideSamples,0);
});
function paidBodyGap(){
 const ship=C.newShip({L:300,W:120,H:60,sec:'rect',plan:'rect',bowW:1,bowH:1,stern:1,bowFree:true,stations:[[0,1,1],[1,1,1]]},'Paid exterior machinery contact');
 ship.parts=[{id:1,k:'gen',c:[87,30,0],d:20},{id:2,k:'engine',c:[80,-3,0],d:6,nozzleLength:6,dir:[-1,0,0],reactor:1,busFeed:true,propulsionModelVersion:1,ratedInputW:1e21,driveProfileId:'standard',machineryGradeId:'advanced',machineryLengthM:8,machineryRadiusM:2,machineryOffsetM:3}];ship.fits=[];ship.links=[{kind:'power',from:'p1',to:'p2',cap:1e21}];ship.nextId=3;return ship;
}
test('a short hull-to-paid-machinery seam has real contact caps, loss, mass and cost',()=>{
 const ship=paidBodyGap(),network=C.engineTransmission(ship),route=network.routes[0],evidence=propulsionNetworkEvidence(C,ship,network),body=C.engineMachineryPaths(ship)[0];assert.equal(route.ok,true);assert.equal(route.capacityW,1e21);assert.equal(evidence.externalEntryFailures.length,0);assert.equal(evidence.independentOutsideSamples,0);const entries=route.entrySegments.filter(s=>s.structuralGap);assert.equal(entries.length,1);
 for(const entry of entries){assert.ok(entry.l>0&&entry.l<=Math.max(.5,4*route.radius,Math.min(8,ship.parts[1].d*.5)));assert.deepEqual(JSON.parse(JSON.stringify(entry.anchorComponentIds)),[['hull'],['p2']]);for(const [index,point]of entry.hullContacts.entries())for(let j=0;j<32;j++){const angle=j*Math.PI/16,q=C.add(point,C.add(C.mul(entry.v,entry.r0*Math.cos(angle)),C.mul(entry.w,entry.r0*Math.sin(angle))));assert.equal(index===0?C.insideOriginalEnvelope(ship,q):C.inPart(body,q),true,'each entire cap touches its independently sampled underlying solid');}}
 const near=(a,b)=>assert.ok(Math.abs(a-b)<=Math.max(1,Math.abs(b))*1e-9);near(network.volume,route.area*route.length);near(network.massTonnes,network.volume*C.PARTS.machinery.dens);near(network.cost,network.parts.reduce((n,p)=>n+C.partBuildCost(p),0));assert.ok(network.volume>entries[0].l*route.area&&network.massTonnes>0&&network.cost>0);
 const allocated=C.allocateConnectedPower({sources:[{id:'p1',domain:'main',powerW:C.reactorPower(ship.parts[0])}],links:network.powerLinks,loads:[{id:'engine',kind:'engines',port:'p2',domain:'main',requestedInputW:1e21}],mode:'balanced'});assert.ok(allocated.granted.engine>0);assert.ok(allocated.feedLossW>0);near(allocated.draw,allocated.granted.engine+allocated.feedLossW);near(allocated.granted.engine,allocated.draw*Math.exp(-1e-5*route.length));
});
test('a full outside bulkhead still obstructs a paid-machinery seam',()=>{
 const ship=paidBodyGap();ship.parts.push({id:3,k:'cargo',c:[87,-.5,0],d:10,room:[1000,1000,.1],autoFit:false});ship.nextId=4;const network=C.engineTransmission(ship);assert.equal(network.routes[0].ok,false);assert.equal(network.engines[2].connected,false);assert.equal(network.volume,0);
});
test('a nozzle or its visible casing cannot stand in for paid-machinery gap contact',()=>{
 const ship=paidBodyGap(),real=C.engineTransmission(ship),a=[80,.5,0],b=[80,-1.5,0],frame=C.frameAxis(C.sub(b,a)),radius=.1,entry={a,b,...frame,l:2,r0:radius,r1:radius,exteriorEntry:true,housing:true,structuralGap:true,hullContacts:[a,b],engineId:2,anchorComponentIds:[['hull'],['p2']]},area=Math.PI*radius*radius,volume=area*2;
 assert.equal(C.inPart(ship.parts[1],b),true,'the forged contact does lie in the real nozzle');assert.equal(C.inPart(C.engineMachineryPaths(ship)[0],b),false,'the actual paid machinery is somewhere else');const part={id:-6000000,k:'machinery',transmission:true,sourcePartIds:[1,2],routeId:'p1>p2',segments:[entry],seg:entry,volumeM3:volume},route={id:'p1>p2',from:'p1',to:'p2',engineIds:[2],partId:part.id,ok:true,valid:true,segments:[entry],entrySegments:[entry],radius,area,length:2,volume,requestedCapacityW:area*real.flux,capacityW:area*real.flux,efficiency:Math.exp(-1e-5*2)},fake={routes:[route],parts:[part],engines:{2:{connected:true,capacityW:route.capacityW,routeIds:[route.id]}},flux:real.flux,volume,length:2,massTonnes:volume*C.PARTS.machinery.dens,cost:0},evidence=propulsionNetworkEvidence(C,ship,fake);assert.equal(evidence.externalEntryFailures.length,1);assert.equal(evidence.externalEntryFailures[0].contactsVerified,false);assert.equal(evidence.externalEntryFailures[0].distinctComponentsVerified,false);assert.equal(evidence.externalEntryFailures[0].anchorComponentIds[1].length,0);
});
test('a side-fed exterior body uses its real interior contact instead of an unusable axial turn',()=>{
 const ship=C.newShip({L:1200,W:600,H:300,sec:'rect',plan:'rect',bowW:1,bowH:1,stern:1,bowFree:true,stations:[[0,1,1],[1,1,1]]},'Side-fed paid machinery');
 ship.parts=[{id:1,k:'gen',c:[1000,200,0],d:60},{id:2,k:'engine',c:[200,-10,0],d:12,nozzleLength:12,dir:[-1,0,0],reactor:1,busFeed:true,propulsionModelVersion:1,ratedInputW:3e22,driveProfileId:'standard',machineryGradeId:'advanced',machineryLengthM:12,machineryRadiusM:6,machineryOffsetM:6}];ship.fits=[];ship.links=[{kind:'power',from:'p1',to:'p2',cap:3e22}];ship.nextId=3;
 const original=JSON.stringify(ship.parts),sourceW=C.reactorPower(ship.parts[0]),network=C.engineTransmission(ship),route=network.routes[0],evidence=propulsionNetworkEvidence(C,ship,network);assert.equal(route.ok,true);assert.equal(route.capacityW,3e22);assert.equal(route.limited,false);assert.equal(evidence.terminalContactFailures.length,0);assert.equal(evidence.routes[0].terminalContact.verified,true);assert.equal(evidence.externalEntryFailures.length,0);assert.equal(evidence.independentOutsideSamples,0);assert.ok(route.entrySegments.some(segment=>segment.structuralGap));assert.equal(JSON.stringify(ship.parts),original,'the existing body, nozzle, source and rating remain unchanged');assert.equal(C.reactorPower(ship.parts[0]),sourceW);
 const near=(a,b)=>assert.ok(Math.abs(a-b)<=Math.max(1,Math.abs(b))*1e-9);near(network.volume,route.area*route.length);near(network.massTonnes,network.volume*C.PARTS.machinery.dens);near(network.cost,network.parts.reduce((n,p)=>n+C.partBuildCost(p),0));const allocated=C.allocateConnectedPower({sources:[{id:'p1',domain:'main',powerW:sourceW}],links:network.powerLinks,loads:[{id:'engine',kind:'engines',port:'p2',domain:'main',requestedInputW:3e22}],mode:'balanced'});assert.ok(allocated.granted.engine>0&&allocated.feedLossW>0);near(allocated.draw,allocated.granted.engine+allocated.feedLossW);near(allocated.granted.engine,allocated.draw*Math.exp(-1e-5*route.length));
});
test('a cable detours around a real narrow hull opening between its source and receiver',()=>{
 const ship=C.newShip({L:100,W:100,H:100,sec:'rect',plan:'rect',bowW:1,bowH:1,stern:1,bowFree:true,stations:[[0,1,1],[1,1,1]]},'Midspan hull opening');
 ship.parts=[{id:1,k:'gen',c:[50,90,0],d:20},{id:3,k:'engineCore',c:[50,10,0],d:4,length:8,dir:[0,1,0],reactor:1,busFeed:true,propulsionModelVersion:1,ratedInputW:1e21,driveProfileId:'standard',machineryGradeId:'advanced'}];ship.fits=[];ship.links=[{kind:'power',from:'p1',to:'p3',cap:1e21}];ship.nextId=4;C.ensurePrimaryHull(ship);ship.subs=[{b:[49.8,46.8,-.2,50.2,47.2,.2],structures:true}];
 assert.equal(C.insideOriginalEnvelope(ship,[50,47,0]),false,'the opening removes actual material at the direct path midpoint');const original=JSON.stringify(C.serialize(ship)),network=C.engineTransmission(ship),route=network.routes[0];assert.equal(route.ok,true);assert.equal(route.capacityW,1e21);assert.ok(route.length>66,'the accepted cable must leave the straight line crossing the opening');
 for(const segment of route.segments)for(let station=0;station<=512;station++)for(let spoke=-1;spoke<8;spoke++){const centre=C.add(segment.a,C.mul(segment.u,segment.l*station/512)),angle=spoke*Math.PI/4,q=spoke<0?centre:C.add(centre,C.add(C.mul(segment.v,Math.cos(angle)*route.radius*.999999),C.mul(segment.w,Math.sin(angle)*route.radius*.999999)));assert.equal(C.insideOriginalEnvelope(ship,q),true,'the complete installed cable clears the opening and remains in actual material');}
 const evidence=propulsionNetworkEvidence(C,ship,network);assert.equal(evidence.independentOutsideSamples,0);assert.equal(evidence.externalEntryFailures.length,0);assert.equal(evidence.volumeConsistent,true);assert.equal(JSON.stringify(C.serialize(ship)),original,'the routing correction cannot fill the opening or move its source and receiver');assert.ok(network.massTonnes>0&&network.cost>0);
});
