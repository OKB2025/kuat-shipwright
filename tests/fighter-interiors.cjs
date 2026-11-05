const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),plain=x=>JSON.parse(JSON.stringify(x));
const near=(a,b,label)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(b))*1e-9,`${label}: ${a} != ${b}`);
const fixtures=new Map();function fixture(key){if(!fixtures.has(key)){const ship=C.buildDesign(key),stats=C.computeStats(ship);fixtures.set(key,{ship,stats});}return fixtures.get(key);}
for(const [key,target] of Object.entries(C.CRAFT_INTERIOR_TARGETS))test(`${key}: finite physical plant, complete systems and powered flight survive a 30 second firing run`,()=>{
 const {ship,stats:S}=fixture(key),engines=C.propulsionProfile(ship,S).engines;
 assert.ok(engines.length);for(const e of engines){assert.equal(e.valid,true,JSON.stringify(e.issues));assert.equal(e.available,true,`engine ${e.id}`);assert.equal(e.connected,true);assert.equal(e.outletAvailable,true);assert.notEqual(e.machineryGradeId,'legacy-refit');assert.equal(e.legacyCoolingInputW,0);assert.ok(e.ratedInputW<=e.maxInputW);}
 assert.equal(Object.values(S.info).some(p=>p.overlap),false,'equipment and physical engine feeds must not overlap');
 near(S.propulsion.ratedAccelMps2/C.G0,target.g,'component-rated acceleration');near(S.propulsion.outputRatio,.35,'supplied default combat throttle');
 assert.equal(S.craftSystems.fireK,1);assert.equal(S.craftSystems.turnK,1);assert.equal(S.craftSystems.navReady,true);assert.equal(S.craftSystems.landingReady,true);
 const p=C.fleetProfile(S,ship.name,ship),u=C.fleetUnit(key,key,p,0);u.order={...u.order,power:'balanced'};u.maneuver=1;C.heatInit(u);u.ht.t=0;u.ht.last=0;if(u.fo){u.fo.d.fill(1);u.fo.want.fill(1);}
 for(let i=0;i<60;i++){
  const {got,propulsion}=C.allocateShipPower(u,C.fleetSystems(u),{throttle:1,weapons:p.grid.Dw,shields:p.grid.Ds},.5,'balanced');
  near(propulsion.outputRatio,1,'fully powered propulsion');near(got.weapons,p.grid.Dw,'full gun input');near(got.shields,p.grid.Ds,'full shield input');near(propulsion.wasteHeatW,propulsion.actualInputW*.05,'engine waste');
  for(const source of propulsion.power.sources)assert.ok(source.drawW<=source.availableW*(1+1e-12),'one source cannot be spent twice');
  C.heatTick({time:(i+1)*.5,ev(){}},u,.5);
 }
 assert.equal(Math.min(...u.ht.lm),1,'no immediate thermal limiter during the checked run');
 const loaded=C.deserialize(C.serialize(ship)),L=C.computeStats(loaded);
 near(L.mass,S.mass,'saved physical mass');near(L.power,S.power,'saved reactor power');near(L.propulsion.ratedInputW,S.propulsion.ratedInputW,'saved engine rating');near(L.propulsion.actualInputW,S.propulsion.actualInputW,'saved actual input');
 assert.deepEqual(plain(L.dims),plain(S.dims));assert.deepEqual(plain(loaded.links),plain(ship.links));
});

test('loading a modified fighter preserves its authored machinery and does not refit it again',()=>{
 const original=C.serialize(fixture('craft_awing').ship),engine=original.parts.find(p=>p.k==='engine');engine.ratedInputW*=.5;original.parts=original.parts.filter(p=>p.k!=='navComputer');
 const loaded=C.deserialize(original);near(loaded.parts.find(p=>p.id===engine.id).ratedInputW,engine.ratedInputW,'player engine rating');assert.equal(loaded.parts.some(p=>p.k==='navComputer'),false);assert.equal(loaded.parts.length,original.parts.length);
});
