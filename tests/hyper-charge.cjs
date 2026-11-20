// v24 The hyperdrive charges from spare power instead of needing its whole draw at once.
// v27 (user decision 2026-11-17「ハイパードライブは充電をさらに大きくして最高速度70%ルールは無くして自動的に光速の50%まで加速してから突入」)
// The charge is the jump field (10 s of the rated draw Dj) plus the relativistic kinetic energy that takes the hull, and any hull
// it tows, to 0.5c; it fills from all spare power (no Dj cap), limited by fuel and by the reactor heat it makes, and there is no
// sublight speed gate: once charged (and, on the strategic map, aligned) the drive itself bursts to 0.5c and enters.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),FLEET=vm.runInContext('YardFleetData',cx).designs;
const unit=(Dj,P=1e12)=>({p:{grid:{P,Dj},modules:[]},hyperE:0});
const near=(a,b,rel,msg)=>assert.ok(Math.abs(a-b)<=rel*Math.max(Math.abs(a),Math.abs(b),1e-300),`${msg}: ${a} vs ${b}`);
const c=299792458,KE=(1/Math.sqrt(1-.25)-1)*c*c;// (gamma-1)c^2 at 0.5c, J/kg
// A saved example opened like a user's save (computeStats on data/examples/<key>/design.json.gz; buildDesign is much slower).
const saved=key=>{const ship=C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples',key,'design.json.gz'))))),S=C.computeStats(ship);return {ship,S,p:C.fleetProfile(S,key,ship)};};
// The game's own power and heat loop for a ship at rest (fleet battles and the strategic map step 0.25 s).
const idle=(u,dt,t)=>{C.fleetPowerStep(u,C.fleetSystems(u),null,0,dt);C.heatTick({time:t,ev(){}},u,dt);};

test('a drive fills from all the power left after the other loads, up to its full charge',()=>{
 const need=1e9*C.HYPER_CHARGE.seconds;
 const u=unit(1e9);assert.equal(C.hyperChargeNeedJ(u.p),need,'a massless profile keeps the jump field alone: 10 s of Dj');
 assert.equal(C.hyperChargeStep(u,1e12,1e12,1),0,'no spare power, no charge');assert.equal(C.hyperCharged(u),0);
 assert.equal(C.hyperChargeStep(u,1e12,1e12-2.5e8,1),2.5e8,'2.5e8 W spare charges at 2.5e8 W');
 assert.equal(C.hyperChargeStep(u,1e12,0,1),need-2.5e8,'the rated draw no longer caps the rate: 1e12 W spare fills what is left in one step');
 assert.equal(u.hyperE,need);assert.equal(C.hyperCharged(u),1);
 for(let i=0;i<20;i++)assert.equal(C.hyperChargeStep(u,1e12,0,1),0,'a full drive takes nothing more');assert.equal(u.hyperE,need,'a full drive holds its charge');assert.equal(C.hyperCharged(u),1);
});
test('a profile with no hyperdrive needs no charge, whatever its mass; a Dj-less profile with a drive needs the burst',()=>{
 const u=unit(undefined);assert.equal(C.hyperChargeStep(u,1e12,0,1),0);assert.equal(C.hyperCharged(u),1);
 const heavy={p:{grid:{P:1e30},modules:[{k:'engine'}],propulsion:{massKg:1e6}},hyperE:0};
 assert.equal(C.hyperDriveFitted(heavy.p),false);assert.equal(C.hyperChargeNeedJ(heavy.p),0);assert.equal(C.hyperChargeStep(heavy,1e30,0,1),0);assert.equal(C.hyperCharged(heavy),1);
 const old={grid:{P:1e30},modules:[{k:'hyper'}],propulsion:{massKg:1e6}};// a pre-v24 save or the craft catalogue: a drive but no Dj
 assert.equal(C.hyperDriveFitted(old),true);near(C.hyperChargeNeedJ(old),KE*1e6,1e-12,'the kinetic term alone');near(C.hyperChargeNeedJ(old),1.3903791e22,1e-7,'1.39e22 J for 1,000 t');
 const gutted=C.fleetUnit('t','cr90',{...FLEET.cr90.p,grid:{...FLEET.cr90.p.grid,Dj:0},modules:FLEET.cr90.p.modules.filter(m=>m.k!=='hyper')},0);
 assert.equal(C.hyperUnitNeedJ(gutted),0,'a stock hull with the drive taken out needs nothing');assert.equal(C.hyperCharged(gutted),1);
});
test('a dead or unpowered ship does not charge',()=>{
 const dead={...unit(1e9),dead:true};assert.equal(C.hyperChargeStep(dead,1e12,0,1),0);
 const dark=unit(1e9,0);assert.equal(C.hyperChargeStep(dark,0,0,1),0);
 const tripped={p:{grid:{P:1e12,Dj:1e9},modules:[{k:'hyper'}]},hyperE:0,gridState:{local:{0:5}}};// the drive's own feed is ion-tripped
 assert.equal(C.powerFactor(tripped,'hyper'),0);assert.equal(C.hyperChargeStep(tripped,1e12,0,1),0,'an unpowered hyperdrive charges nothing');assert.equal(tripped.hyperE,0);
});
test('ship statistics give the charge time from all spare power for the jump field and the entry burst',()=>{
 const src=fs.readFileSync(path.join(root,'js/core.js'),'utf8');
 assert.match(src,/jumpOK = hyperEffectiveVolume > 0 && jumpRateW > 0/);assert.match(src,/jumpChargeS = jumpOK \? jumpChargeJ\/jumpRateW/);
 assert.match(src,/jumpRateW=jumpSpareW[;,]/,'no Dj cap on the rate');assert.match(src,/jumpChargeJ=hyperEffectiveVolume>0\?HYPER_CHARGE\.seconds\*Dj\+HYPER_ENTRY_KE_PER_KG\*/,'the jump field plus the burst');
 assert.match(src,/Dj:dr\.jump\|\|0/,'the fleet profile carries the jump draw');
});
test('a fleet jump waits for a full drive, then is ready at rest: there is no speed gate',()=>{
 const u={p:{grid:{P:1e12,Dj:1e9},modules:[{k:'hyper'}],hyper:1},hyperE:0,mods:[1],velocity:[0,0,0],yaw:0};
 const empty=C.hyperspaceReadiness(u,[0,0,0],[1,0,0],{requireCharge:true});assert.equal(empty.chargeReady,false);assert.equal(empty.ready,false);
 assert.equal(empty.powerReady,true);assert.equal(empty.reason,'hyper-charging');assert.equal(empty.chargeNeedJ,C.hyperUnitNeedJ(u));
 const loose=C.hyperspaceReadiness(u,[0,0,0],[1,0,0]);assert.equal(loose.chargeReady,true,'callers that do not ask for the charge are unaffected');
 u.hyperE=C.hyperChargeNeedJ(u.p);const full=C.hyperspaceReadiness(u,[0,0,0],[1,0,0],{requireCharge:true});assert.equal(full.chargeReady,true);
 assert.equal(full.ready,true,'charged and at rest: ready (before 2026-11-17 this was "accelerating" until 70% of top speed)');assert.equal(full.reason,null);
 for(const k of ['speedReady','requiredForwardSpeedMps','healthyMaximumSpeedMps','forwardSpeedMps','speedFraction'])assert.equal(k in full,false,k+' is gone with the gate');
 assert.equal(C.hyperspaceReadiness(u,[0,0,0],[1,0,0],{requireCharge:true,load:.2}).ready,true,'a tow load no longer raises a speed requirement');
 const at=deg=>C.hyperspaceReadiness(u,[0,0,0],[Math.cos(deg*Math.PI/180),0,Math.sin(deg*Math.PI/180)],{requireCharge:true,alignWithinRad:C.HYPERSPACE_ALIGN_RAD});
 assert.equal(at(4).reason,null);assert.equal(at(6).reason,'aligning');assert.equal(at(6).ready,false);assert.equal(at(90).headingReady,false);
});
test('fleet departures require the charge and the heading, and spend the charge',()=>{
 const src=fs.readFileSync(path.join(root,'js/core.js'),'utf8');
 assert.match(src,/jumpVector\(w,u\),\{requireCharge:true,alignWithinRad:C\.HYPERSPACE_ALIGN_RAD\}\);units\.push/);
 assert.match(src,/alignWithinRad:C\.HYPERSPACE_ALIGN_RAD\}\)\.ready\)return;u\.hyperBurst=C\.hyperspaceBurstStart\(/);
 assert.match(src,/u\.hyperT = w\.time;u\.hyperE=0;/);assert.match(src,/ship\.hyperE=0;delete ship\.hyperBurst;/);
});
test('light speed, the 0.5c burst and its kinetic energy per kilogram',()=>{
 assert.equal(C.SPEED_OF_LIGHT_MPS,299792458);assert.equal(C.HYPERSPACE_BURST_SPEED_MPS,149896229);assert.equal(C.HYPERSPACE_BURST_SECONDS,1.25);
 near(C.HYPER_ENTRY_KE_PER_KG,KE,1e-12,'(gamma-1)c^2 at 0.5c');near(C.HYPER_ENTRY_KE_PER_KG,1.3903791002e16,1e-10,'1.39e16 J/kg');
 near(C.HYPERSPACE_ALIGN_RAD,5*Math.PI/180,1e-15,'5 degrees');assert.equal(C.HYPERSPACE_ENTRY_SPEED_FRACTION,undefined,'the 70% entry gate is gone');
 near(C.hyperKineticJ(1,1000),5e5,1e-9,'low speed: mv^2/2');assert.equal(C.hyperKineticJ(1,0),0);
 near(C.hyperKineticJ(1,.9*c),(1/Math.sqrt(1-.81)-1)*c*c,1e-12,'high speed: exact');near(C.hyperKineticJ(1e6,C.HYPERSPACE_BURST_SPEED_MPS),KE*1e6,1e-12,'linear in mass');
});
test('a stock ship\'s full charge is 10 s of Dj plus the kinetic energy at 0.5c of its mass, its load and its tow',()=>{
 for(const [key,J] of [['imperial',7.992e26],['venator',1.817e26],['executor',1.414e29],['deathstar',1.526e34]/* regenerated 2026-11-17: 1.09e15 t, class 4 */]/* 2026-11-20 expected values changed (were 7.977e26 / 1.817e26 / 1.413e29 / 1.525e34): the examples were regenerated with repulsorlift rooms for each ship's mass (user instruction 2026-11-19「リパルサーリフトと改めた上で艦の重量分搭載して」, EXAMPLE_PROFILE_VERSION 5), so each ship is 0.08-0.12% heavier and its burst energy with it. Measured on the PR base 1da778b: 7.98272e26 / 1.81588e26 / 1.41268e29 / 1.52454e34; now 7.99151e26 / 1.81749e26 / 1.41380e29 / 1.52642e34 (Dj unchanged). Only the Imperial left the 1e-3 tolerance, which is unchanged; the other three are re-centred on the regenerated rows. */){const p=FLEET[key].p;
  assert.equal(C.hyperDriveFitted(p),true,key);near(C.hyperChargeNeedJ(p),10*p.grid.Dj+KE*p.propulsion.massKg,1e-12,key);near(C.hyperChargeNeedJ(p),J,1e-3,key+' scale');
  assert.ok(KE*p.propulsion.massKg>50*10*p.grid.Dj,key+': the burst is most of the charge');}
 for(const key of ['imperial','venator']){const p=FLEET[key].p,base=C.hyperChargeNeedJ(p);
  near(C.hyperChargeNeedJ(C.loadedShipProfile(p,1000))-base,KE*1e6,1e-6,key+': 1,000 t of load');near(C.hyperChargeNeedJ(p,1e6)-base,KE*1e6,1e-6,key+': extraMassKg');
  const u=C.fleetUnit('a',key,p,0);u.hyperTowKg=FLEET.cr90.p.propulsion.massKg;near(C.hyperUnitNeedJ(u)-base,KE*FLEET.cr90.p.propulsion.massKg,1e-6,key+' towing a CR90');}
});
test('a full charge pays the burst from rest to 0.5c and leaves the jump field; a short store holds the burst and is refunded',()=>{
 const make=()=>({p:{grid:{P:1e12,Dj:1e9},modules:[{k:'hyper'}],propulsion:{massKg:1e3}},hyperE:0,mods:[1],velocity:[0,0,0],yaw:0});
 const u=make(),need=C.hyperUnitNeedJ(u);near(need,1e10+KE*1e3,1e-12,'need');u.hyperE=need;
 const st=C.hyperspaceBurstStart([0,0,0],[1,0,0],1e3);let a;for(let i=0;i<5&&!(a?.complete);i++){a=C.hyperspaceBurstStep(u,st,.25);assert.equal(a.blocked,false,'step '+i);}
 assert.equal(a.complete,true);near(a.velocity[0],C.HYPERSPACE_BURST_SPEED_MPS,1e-12,'0.5c');near(st.spentJ,KE*1e3,1e-12,'the burst drew its kinetic energy');near(u.hyperE,1e10,1e-5,'the jump field is left for the tunnel');
 const v=make();v.hyperE=need/2;const s2=C.hyperspaceBurstStart([0,0,0],[1,0,0],1e3);let b;for(let i=0;i<5;i++){b=C.hyperspaceBurstStep(v,s2,.25);if(b.blocked)break;}
 assert.equal(b.blocked,true);assert.equal(b.reason,'hyper-charging');const held=s2.t;assert.ok(held<C.HYPERSPACE_BURST_SECONDS);assert.equal(C.hyperspaceBurstStep(v,s2,.25).blocked,true);assert.equal(s2.t,held,'a short store does not advance the burst');
 C.hyperspaceBurstRefund(v,s2);near(v.hyperE,need/2,1e-12,'an aborted burst gives back what it drew');assert.equal(s2.spentJ,0);
});
test('a stock hull with a drive but no Dj (CR90) needs the burst term and charges to full at the game step, NaN-safe and below governStart',()=>{
 const p0=FLEET.cr90.p,p={...p0,grid:{...p0.grid,Dj:0}},u=C.fleetUnit('a','cr90',p,0);u.velocity=[0,0,0];u.maneuver=0;u.hyperE=NaN;
 const need=C.hyperUnitNeedJ(u);near(need,KE*p.propulsion.massKg,1e-12,'kinetic term only');
 let n=0,maxFill=0;for(;n<2000&&C.hyperCharged(u)<1;n++){idle(u,.25,n*.25);assert.ok(Number.isFinite(u.hyperE),'hyperE finite at step '+n);const h=C.heatOf(u);maxFill=Math.max(maxFill,h.qJ/h.capacityJ);}
 assert.equal(C.hyperCharged(u),1,'charged within 500 s at rest');assert.equal(u.hyperE,need);assert.ok(n*.25>10,'it takes longer than the old 10 s');
 assert.ok(maxFill<C.HEAT.governStart,`the reactor heat of charging stays governed (${maxFill})`);assert.equal(C.heatOf(u).damageLimit,1,'no heat damage');
});
test('a stock Imperial charges at rest at the game step without heating its store past governStart',()=>{
 const u=C.fleetUnit('a','imperial',FLEET.imperial.p,0);u.velocity=[0,0,0];u.maneuver=0;u.hyperE=0;
 let n=0,maxFill=0;for(;n<2000&&C.hyperCharged(u)<1;n++){idle(u,.25,n*.25);const h=C.heatOf(u);maxFill=Math.max(maxFill,h.qJ/h.capacityJ);}
 assert.equal(C.hyperCharged(u),1);assert.ok(maxFill<C.HEAT.governStart,`fill ${maxFill}`);assert.equal(C.heatOf(u).damageLimit,1);
 const est=C.hyperChargeNeedJ(FLEET.imperial.p)/C.hyperChargeNominalW(FLEET.imperial.p);assert.ok(n*.25<=est*1.25&&n*.25>=est*.5,`charged in ${n*.25} s against the idle-spare estimate ${est} s`);
});
test('charging is booked as reactor generation: its electrical energy, 4% reactor heat and the fuel for both',()=>{
 const u=C.fleetUnit('a','cr90',FLEET.cr90.p,0),h=C.heatOf(u),f=C.shipFuelState(u);
 const g0=h.actualGeneratedElectricalJ||0,r0=h.reactorHeatJ||0,e0=(h.e.reactor||0)+h.reactorE.reduce((n,x)=>n+x,0),f0=f.fuelEnergyJ;
 const J=C.hyperChargeStep(u,1e18,0,1);assert.equal(J,1e18,'1e18 W spare for 1 s');assert.equal(u.hyperE,J);
 near(h.actualGeneratedElectricalJ-g0,J,1e-12,'generated electrical energy');near(h.reactorHeatJ-r0,C.HEAT.waste.reactor*J,1e-12,'reactor heat');assert.equal(C.HEAT.waste.reactor,.04);
 near((h.e.reactor||0)+h.reactorE.reduce((n,x)=>n+x,0)-e0,.04*J,1e-12,'the heat is pending in the reactor ledger for the next solve');
 near(f.fuelEnergyJ-f0,1.04*J,1e-12,'fuel: the energy and its conversion loss');
});
test('charging stops where the fuel runs out',()=>{
 const u=C.fleetUnit('a','cr90',FLEET.cr90.p,0),f=C.shipFuelState(u);f.fuelEnergyJ=f.capacityJ-1.04e18;
 const avail=C.shipFuelAvailableElectricalJ(u);near(avail,1e18,1e-6,'about 1e18 J of electrical energy left');
 const J=C.hyperChargeStep(u,1e21,0,1);near(J,avail,1e-12,'the step charges only what the fuel allows');assert.ok(J<1e21);
 assert.ok(f.overdrawJ<=f.capacityJ*1e-12,'no overdraw');assert.equal(C.shipFuelAvailableElectricalJ(u),0);
 assert.equal(C.hyperChargeStep(u,1e21,0,1),0,'an empty tank charges nothing');
});
test('the reactor heat of charging is governed: a hotter ship charges slower, none at governEnd; a hull that rejects nothing stops at its store\'s room',()=>{
 // One real step at rest and its heat solve first: before any solve the charge may use only the store's room, since no cooling
 // is known to run yet (2026-11-17: an unsolved first 20 s step otherwise charged at full power and blacked a ship out).
 // The charge runs inside the ship's real power step, which reads the heat governor at the start of the step.
 const rate=fill=>{const u=C.fleetUnit('a','cr90',FLEET.cr90.p,0),h=C.heatOf(u);u.velocity=[0,0,0];u.maneuver=0;C.fleetPowerStep(u,C.fleetSystems(u),null,0,1);C.heatTick(null,u,1);u.hyperE=0;h.qJ=fill*h.capacityJ;C.fleetPowerStep(u,C.fleetSystems(u),null,0,1);return {W:u.pw.hyper,spare:Math.max(0,(u.pw.P??u.p.grid.P)-u.pw.draw)};};
 const r=[0,.3,.6,.65].map(rate);assert.ok(r[0].W>0&&r[0].W<=r[0].spare*(1+1e-12),'a cold store: at most the spare');
 for(let i=1;i<r.length;i++){assert.ok(r[i].W>0&&r[i].W<r[i].spare*(1-1e-9),`fill step ${i}: heat-limited, not spare-limited (${r[i].W} of ${r[i].spare})`);assert.ok(r[i].W<r[i-1].W,`hotter charges slower (${r.map(x=>x.W)})`);}
 assert.equal(rate(C.HEAT.governEnd).W,0,'no charge at governEnd');
 const bare={p:{grid:{P:1e30},modules:[{k:'hyper'}],propulsion:{massKg:1e6}},hyperE:0},J=C.hyperChargeStep(bare,1e22,0,1),h=C.heatOf(bare);
 near(J,C.HEAT.governStart*h.capacityJ/C.HEAT.waste.reactor,1e-9,'one step fills the room below governStart with reactor heat');
 C.heatTick(null,bare,1);assert.equal(C.hyperChargeStep(bare,1e22,0,1),0,'and then, with no converters, nothing more');assert.ok(C.hyperCharged(bare)<1);
});
test('design statistics: the charge is the jump field plus the burst at the design mass, filled from the whole spare (A-wing; a TIE/ln has no drive)',()=>{
 const {S,p}=saved('craft_awing');assert.equal(S.jumpOK,true);assert.equal(S.wingMass||0,0,'no wing conduits on this design');
 near(S.jumpChargeJ,10*S.draw.jump+KE*S.mass*1000,1e-9,'jumpChargeJ');near(S.jumpChargeJ,C.hyperChargeNeedJ(p),1e-9,'the same as the fleet profile needs');
 near(S.jumpChargeS,S.jumpChargeJ/S.jumpSpareW,1e-12,'from the whole spare');assert.ok(S.draw.jump<S.jumpSpareW,'Dj is under the spare, so the old rule gave 10 s');assert.ok(S.jumpChargeS>100,`now ${S.jumpChargeS} s`);
 const tie=saved('craft_tie_ln');assert.equal(tie.S.jumpOK,false);assert.equal(tie.S.jumpChargeJ,0);assert.equal(tie.S.jumpChargeS,null);assert.equal(C.hyperChargeNeedJ(tie.p),0);
});
test('design statistics count the whole design mass in the charge, wing conduits and actuators included, as the fleet profile does (X-wing)',()=>{
 const {S,p}=saved('craft_xwing');assert.equal(S.jumpOK,true);assert.ok(S.wingMass>0);near(p.propulsion.massKg,S.mass*1000,1e-12,'the fleet profile carries the whole mass');
 near(S.jumpChargeJ,C.hyperChargeNeedJ(p),1e-9,'design statistics against the charge the craft needs in play');
 near(S.jumpChargeS,C.hyperChargeNeedJ(p)/S.jumpSpareW,1e-9,'charge time');
});
