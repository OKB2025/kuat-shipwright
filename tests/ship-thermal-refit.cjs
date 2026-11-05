const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),plain=x=>JSON.parse(JSON.stringify(x));
const near=(a,b,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<=Math.max(1,Math.abs(b))*tolerance,`${a} != ${b}`);
function fixture(){
 const ship=C.newShip({L:200,W:80,H:60,plan:'rect',bowW:1,bowH:1,stern:1},'Physical thermal fixture');
 ship.surfaces=C.normalizeSurfaces({mode:'strict',compatAllowed:false,legacyArmor:ship.armor.hull});
 const reactor=C.placePart(ship,'gen',[70,0,0],30),shield=C.placePart(ship,'shield',[110,0,0],12);
 ship.links=[{kind:'power',from:'p'+reactor.id,to:'p'+shield.id,cap:C.shieldLoad(shield)*1.5}];
 return {ship,reactor,shield};
}
function engineFixture(diameter=40){
 const f=fixture();f.reactor.d=diameter;
 const engine=C.placePart(f.ship,'engine',[5,0,25],10,{reactor:f.reactor.id,dir:[-1,0,0],nozzleLength:10,busFeed:true,propulsionModelVersion:C.PROPULSION_MODEL_VERSION,driveProfileId:'standard',machineryGradeId:'advanced',ratedInputW:1e23,machineryLengthM:40,machineryRadiusM:6,machineryOffsetM:5,legacyCoolingInputW:0});
 f.ship.links.push({kind:'power',from:'p'+f.reactor.id,to:'p'+engine.id,cap:1.3e23});return {...f,engine};
}

test('packed rooms can share a bulkhead while real intersecting cell volume is rejected',()=>{
 const packed=(id,boxes,bounds)=>({id,k:'hdis',d:2,c:[1,1,1],_packing:{boxes,bounds}});
 const a=packed(1,[[0,0,0,2,1,2],[0,1,0,1,2,2]],[0,0,0,2,2,2]);
 const b=packed(2,[[1,1,0,2,2,2],[2,0,0,3,2,2]],[1,0,0,3,2,2]);
 assert.equal(C.overlapParts(a,b),false,'a shared face has zero occupied volume');
 b._packing.boxes[0][1]=.99;assert.equal(C.overlapParts(a,b),true,'a 1 cm physical incursion is an overlap');
});

test('a fixed-only load includes hotel waste and the cooling plant own power heat',()=>{
 const {ship}=fixture(),H=1e22,margin=1.15;
 C.refitShipThermal(ship,'hotel-only',{E:0,W:0,S:0,H,margin});
 const meta=ship._shipThermalRefit,fixedWaste=C.HEAT.waste.reactor+C.HEAT.waste.hotel;
 near(meta.requestedCapacityW,margin*fixedWaste*H/(1-margin*fixedWaste*C.HEAT.disPowerK.hdis),1e-8);
 assert.ok(meta.capacityW>H);near(meta.coolingPowerW,meta.capacityW*C.HEAT.disPowerK.hdis);
});

test('cooling follows the finite plant budget while a real engine and shields compete for its output',()=>{
 const {ship,reactor}=engineFixture(30),power=C.reactorPower(reactor),before=C.computeStats(ship),plantVolume=C.partVolume(reactor);
 C.refitShipThermal(ship,'finite-plant',{stats:before,E:1e23});
 const meta=ship._shipThermalRefit,S=C.computeStats(ship),p=C.craftPowerProfile(ship,S),u=C.fleetUnit('finite','finite',p,0);
 near(meta.sourcePowerW,power);near(C.partVolume(reactor),plantVolume);assert.equal(ship.parts.filter(C.isReactor).length,1);
 const unconstrained=meta.margin*((C.HEAT.waste.reactor+C.HEAT.waste.engine)*1e23+(C.HEAT.waste.reactor+C.HEAT.waste.shield)*before.draw.shields*meta.envelope.shieldFactor+(C.HEAT.waste.reactor+C.HEAT.waste.hotel)*before.draw.hotel)/(1-meta.margin*(C.HEAT.waste.reactor+C.HEAT.waste.hotel)*C.HEAT.disPowerK.hdis);
 assert.ok(meta.capacityW<unconstrained*.9,'unavailable simultaneous nameplate output does not size the coolers');
 for(const pr of Object.values(meta.operatingPresets))assert.ok(pr.inputW<=power*C.POWER_MODES[pr.mode].max*(1+1e-12));
 u.order={...u.order,power:'balanced'};C.heatInit(u);u.ht.t=0;u.ht.last=0;
 for(let i=0;i<60;i++){
  const r=C.allocateShipPower(u,C.fleetSystems(u),{throttle:1,weapons:p.grid.Dw,shields:p.grid.Ds},.5,'balanced');
  assert.ok(r.propulsion.outputRatio>0&&r.propulsion.outputRatio<.8,'finite supply limits the engine while shields retain priority');assert.ok(r.propulsion.power.draw<=power*(1+1e-12));
  C.heatTick({time:(i+1)*.5,ev(){}},u,.5);
 }
 assert.equal(Math.min(...u.ht.lm),1);
});

test('base engineering statistics cannot omit a real superweapon charge from its cooling budget',()=>{
 const ship=C.newShip({L:1000,W:300,H:300,plan:'rect',bowW:1,bowH:1,stern:1},'Superweapon thermal fixture');
 const reactor=C.placePart(ship,'gen',[200,0,0],60),gun=C.placePart(ship,'sbeam',[700,0,0],38.2,{reactor:reactor.id,dir:[1,0,0],length:665.8});
 const stats={draw:{},info:{},warnings:[]};
 C.refitShipThermal(ship,'charge',{stats,E:0,W:0,S:0,H:0});
 assert.equal(stats.superweapons[0].ok,true);assert.ok(stats.superweapons[0].chargeW>0);
 near(ship._shipThermalRefit.requestedInput.superweapons,stats.superweapons[0].chargeW,1e-12);
 assert.ok(ship._shipThermalRefit.capacityW>stats.superweapons[0].chargeW*C.HEAT.waste.sw);
 const paths=ship.links.filter(l=>l.kind==='heat'&&l.from==='p'+gun.id);
 assert.ok(paths.length>=2);assert.ok(paths.every(l=>Number.isFinite(l.cap)&&l.cap>0));
});

test('stock cooling uses retained internal volume, real electric draw and finite source paths',()=>{
 const {ship,reactor,shield}=fixture(),before=C.computeStats(ship),powerLink=plain(ship.links[0]);
 C.refitShipThermal(ship,'test',{E:0,W:0,S:C.shieldLoad(shield)});
 const S=C.computeStats(ship),banks=ship.parts.filter(p=>p.k==='hdis'),meta=ship._shipThermalRefit;
 assert.ok(banks.length>=2);assert.equal(ship.surfaces.mode,'strict');assert.equal(ship.surfaces.compatAllowed,false);
 assert.equal(S.heat.builtin,0);assert.equal(S.heat.legacy,0);assert.equal(S.heat.heat.broken,0);assert.equal(S.heat.power.broken,0);
 assert.equal(Object.values(S.info).some(p=>p.overlap),false);
 assert.ok(S.mass>before.mass);assert.ok(S.dissipatorPower>0);near(S.power,before.power);
 near(meta.capacityW,banks.reduce((n,p)=>n+C.dissipatorCap(p,S),0));
 near(meta.installedVolumeM3,banks.reduce((n,p)=>n+C.partVolume(p),0));
 near(meta.coolingPowerW,S.dissipatorPower);assert.ok(meta.capacityRatio>=.99999);
 assert.deepEqual(plain(ship.links.find(l=>l.kind==='power')),powerLink);
 for(const part of [reactor,shield]){
  const paths=ship.links.filter(l=>l.kind==='heat'&&l.from==='p'+part.id);
  assert.equal(paths.length,banks.length);assert.ok(paths.every(l=>Number.isFinite(l.cap)&&l.cap>0));
 }
 const net=C.heatNetwork(ship,S),evade=C.heatEvaluate(net,'evade');assert.equal(evade.over.length,0);
 // A lost cooler is a real loss of transport capacity; no integral fallback
 // appears to replace it in a strict design.
 const damaged=C.heatEvaluate(net,'evade',net.dis.map(d=>d.k==='hdis'?0:d.cap));assert.ok(damaged.stored>0);
 const oldCount=ship.parts.length;C.refitShipThermal(ship,'test',{E:0,W:0,S:C.shieldLoad(shield)});assert.equal(ship.parts.length,oldCount);
});

test('physical cooling and wiring survive saving and a 30 second cold full-shield run',()=>{
 const {ship,shield}=fixture();C.refitShipThermal(ship,'test',{E:0,W:0,S:C.shieldLoad(shield)});
 const S=C.computeStats(ship),loaded=C.deserialize(C.serialize(ship)),L=C.computeStats(loaded);
 assert.equal(loaded._shipThermalRefit,undefined);assert.deepEqual(plain(loaded.links),plain(ship.links));near(L.mass,S.mass);near(L.dissipatorPower,S.dissipatorPower);assert.equal(L.heat.builtin,0);
 const p=C.craftPowerProfile(loaded,L),u=C.fleetUnit('thermal','thermal',p,0);u.order={...u.order,power:'balanced'};C.heatInit(u);u.ht.t=0;u.ht.last=0;
 for(let i=0;i<60;i++){
  const r=C.allocateShipPower(u,C.fleetSystems(u),{throttle:0,weapons:0,shields:p.grid.Ds},.5,'balanced');near(r.got.shields,p.grid.Ds);
  C.heatTick({time:(i+1)*.5,ev(){}},u,.5);
 }
 assert.equal(Math.min(...u.ht.lm),1);
});

test('a cooling-dominated hotel load reaches a bounded state and conserves its electrical heat',()=>{
 const {ship}=engineFixture();
 C.refitShipThermal(ship,'cooling-dominated',{E:1e23});
 const S=C.computeStats(ship),p=C.craftPowerProfile(ship,S),u=C.fleetUnit('cooling','cooling',p,0);
 assert.equal(p.propulsion.engines[0].available,true);assert.equal(Object.values(S.info).some(p=>p.overlap),false);
 const normalFixed=p.grid.fixed-p.grid.cooling;assert.ok(p.grid.cooling>normalFixed*3,'cooling heat dominates the ordinary hotel load');
 const hotel=p.heat.src.map((s,i)=>({s,i})).filter(({s})=>s.k==='hotel');assert.ok(hotel.reduce((n,{s})=>n+s.st,0)>p.grid.cooling*C.HEAT.storeS);
 u.order={...u.order,power:'balanced'};u.maneuver=1;C.heatInit(u);u.ht.t=0;u.ht.last=0;
 let previous=0,lastGain=0,minThermal=1;
 for(let i=0;i<240;i++){
  const r=C.allocateShipPower(u,C.fleetSystems(u),{throttle:1,weapons:p.grid.Dw,shields:p.grid.Ds},.5,'balanced');near(r.propulsion.outputRatio,1);
  C.heatTick({time:(i+1)*.5,ev(){}},u,.5);minThermal=Math.min(minThermal,...u.ht.lm);
  if(i===219)previous=hotel.reduce((n,{i})=>n+u.ht.st[i],0);
  if(i===239)lastGain=hotel.reduce((n,{i})=>n+u.ht.st[i],0)-previous;
 }
 assert.equal(minThermal,1);assert.ok(u.ht.cooling.inputJ>normalFixed*120,'the running coolers produce more heat than ordinary hotel equipment');assert.ok(lastGain<u.ht.cooling.lastDraw,'the final ten seconds add less than one second of cooling heat');
 near(u.ht.cooling.heatJ,u.ht.cooling.inputJ,1e-12);near(u.ht.cooling.reactorWasteJ,u.ht.cooling.inputJ*C.HEAT.waste.reactor,1e-12);
 near(u.ht.cooling.inputJ,u.ht.cooling.handledJ*C.HEAT.disPowerK.hdis,1e-12);
});
