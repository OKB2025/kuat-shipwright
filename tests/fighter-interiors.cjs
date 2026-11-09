const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),plain=x=>JSON.parse(JSON.stringify(x));
const near=(a,b,label,e=1e-9)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(b))*e,`${label}: ${a} != ${b}`);
const fixtures=new Map();function fixture(key){if(!fixtures.has(key)){const ship=C.buildDesign(key),stats=C.computeStats(ship);fixtures.set(key,{ship,stats});}return fixtures.get(key);}
for(const [key,target] of Object.entries(C.CRAFT_INTERIOR_TARGETS))test(`${key}: finite physical plant, complete systems and powered flight survive a 30 second firing run`,()=>{
 const {ship,stats:S}=fixture(key),engines=C.propulsionProfile(ship,S).engines;
 assert.ok(engines.length);for(const e of engines){assert.equal(e.valid,true,JSON.stringify(e.issues));assert.equal(e.available,true,`engine ${e.id}`);assert.equal(e.connected,true);assert.equal(e.outletAvailable,true);assert.notEqual(e.machineryGradeId,'legacy-refit');assert.equal(e.legacyCoolingInputW,0);assert.ok(e.ratedInputW<=e.maxInputW);}
 assert.equal(Object.values(S.info).some(p=>p.overlap),false,'equipment and physical engine feeds must not overlap');
 {const g=S.propulsion.ratedAccelMps2/C.G0;if(g<target.g*(1-1e-6)){assert.ok(g>=target.g*.995,'component-rated acceleration after physical packing: '+g+' of '+target.g);for(const e of engines)assert.ok(e.inputDensityWPerM3>=e.allowedInputDensityWPerM3*(1-1e-6),'a short craft is limited by its drive volume: engine '+e.id);}else near(g,target.g,'component-rated acceleration after physical packing',1e-6);}{const share=S.propulsion.actualInputW/S.propulsion.ratedInputW;assert.ok(Number.isFinite(share)&&share>=0&&share<=.35+1e-9,'default combat input obeys the shared source budget');assert.ok(S.propulsion.outputRatio>=share-1e-9,'thrust per watt improves below the rating');}// engine-density-thermal.md: a drive above its volume's normal rating converts with η=0.95/(1+0.05(x−1)).
 const normal=new Map(engines.map(e=>[e.id,e.normalInputW])),densityWaste=r=>r.engines.reduce((n,e)=>{const x=e.actualInputW/normal.get(e.id);return n+e.actualInputW*(1-.95/(1+.05*Math.max(0,x-1)));},0);near(S.propulsion.wasteHeatW,densityWaste(S.propulsion),'default combat engine waste');
 assert.equal(S.heat.mode,'strict');assert.equal(S.heat.builtin,0);assert.equal(S.heat.legacy,0);const high=S.heat.net.dis.filter(d=>d.part!=null&&d.grade==='high');assert.ok(high.length,'real high-energy dissipators are installed');for(const d of high){const part=ship.parts.find(p=>p.id===d.part);assert.ok(part&&C.partVolume(part)>0,'every cooler belongs to actual paid hardware');assert.ok(C.DISSIPATORS[part.k]||C.isWing(part),'the source is an installed dissipator or cooling wing');assert.ok(Number.isFinite(d.cap)&&d.cap>0);near(d.cap,C.dissipatorCap(part,S),'physical cooling capacity');assert.ok(Number.isFinite(d.power)&&d.power>0,'each high-energy cooler requires finite electrical input');}assert.ok(S.dissipatorPower>0,'cooling uses finite electrical input');assert.ok(S.heat.net.dis.every(d=>d.k!=='integral'&&d.k!=='legacy'&&!d.legacy),'no implicit cooling nodes');
 assert.ok(ship.links.filter(l=>l.kind==='heat').every(l=>Number.isFinite(l.cap)&&l.cap>=0),'finite saved heat transports');
 assert.equal(S.craftSystems.fireK,1);assert.equal(S.craftSystems.turnK,1);assert.equal(S.craftSystems.navReady,true);assert.equal(S.craftSystems.landingReady,true);
 const driveProfile=C.fleetProfile(S,ship.name,ship),drive=C.fleetUnit(key+'-drive',key,driveProfile,0);C.heatInit(drive);C.allocateShipPower(drive,C.fleetSystems(drive),{throttle:1,weapons:0,shields:0},.5,'balanced');assert.ok(drive.propulsion.actualInputW>0&&drive.propulsion.actualThrustN>0&&drive.propulsion.actualAccelMps2>0,'the installed plant powers drive-only flight');for(const source of drive.propulsion.power.sources)assert.ok(source.drawW>=0&&source.drawW<=source.availableW*(1+1e-12),'drive-only power is paid by the finite source');
 const p=C.fleetProfile(S,ship.name,ship),u=C.fleetUnit(key,key,p,0);u.order={...u.order,power:'balanced'};u.maneuver=1;C.heatInit(u);u.ht.t=0;u.ht.last=0;if(u.fo){u.fo.d.fill(1);u.fo.want.fill(1);}
 for(let i=0;i<60;i++){
  // The automatic heat governor (thermal-governor.md) eases thrust and gun charging before the limiting band, as in battle.
  const gov=C.heatGovernor(u),{got,propulsion}=C.allocateShipPower(u,C.fleetSystems(u),{throttle:gov.engine,weapons:p.grid.Dw*gov.weapon,shields:p.grid.Ds},.5,'balanced');
  assert.ok(propulsion.outputRatio>=0&&propulsion.outputRatio<=1+1e-9,'finite shared power bounds propulsion');assert.ok(got.weapons>=0&&got.weapons<=p.grid.Dw*(1+1e-9),'finite shared power bounds guns');assert.ok(got.shields>=0&&got.shields<=p.grid.Ds*(1+1e-9),'finite shared power bounds shields');near(propulsion.wasteHeatW,densityWaste(propulsion),'engine waste');
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

// A saved edit must expose a missing plant rather than creating compatibility cooling.
test('removing a saved fighter cooling bank leaves real thermal shortfall without automatic replacement',()=>{
 const original=C.serialize(fixture('craft_awing').ship),coolers=original.parts.filter(p=>p.k==='hdis');assert.ok(coolers.length);
 original.parts=original.parts.filter(p=>p.k!=='hdis');const loaded=C.deserialize(original),S=C.computeStats(loaded);
 assert.equal(loaded.parts.some(p=>p.k==='hdis'),false);assert.equal(S.heat.mode,'strict');assert.equal(S.heat.builtin,0);assert.equal(S.heat.legacy,0);assert.ok(S.heat.presets.combat.overCount>0);
 assert.ok(S.heat.net.dis.every(d=>d.k!=='integral'&&d.k!=='legacy'&&!d.legacy));
});
