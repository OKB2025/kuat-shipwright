const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console,performance});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js']){
 let source=fs.readFileSync(path.join(root,file),'utf8');
 if(file==='js/core.js')source=source.replace('return {BROADSIDE_BATTERY_CALIBERS,','return {shipRefitMeasure,BROADSIDE_BATTERY_CALIBERS,');
 vm.runInContext(source,context,{filename:file});
}
const C=vm.runInContext('Core',context),near=(a,b,tol=1e-7)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(b))*tol,`${a} != ${b}`);
let built;
function mandator(){if(!built){const ship=C.buildDesign('mandator2'),stats=C.shipRefitMeasure(ship);built={ship,stats};}return built;}

// v24: the example follows the user's design; the ventral keel is filled with 720 TT twins and
// 175 TT quads until no seat remains, 3% short of the requested 120,000 TT (docs/mandator-ii-refit.md).
const COUNTS={utl:61,quad175:38,ion:6},MAIN=['utl','quad175','ion'];
const volleyOf=f=>{const d=C.fitSpec(f);return (d.tt||0)+(d.ion||0);};

test('Mandator declared battery is the user dorsal battery plus the filled ventral keel',()=>{
 const ref=C.SHIP_REFERENCE.mandator2,counts=ref.batteryCounts;assert.deepEqual(JSON.parse(JSON.stringify(counts)),COUNTS);
 const mainAndIon=MAIN.reduce((n,k)=>n+counts[k]*volleyOf({k}),0);near(mainAndIon,116540,1e-12);assert.equal(ref.mainIonVolleyTT,120000);assert.ok(Math.abs(mainAndIon/ref.mainIonVolleyTT-1)<=.035);
 assert.equal(C.fitSpec({k:'quad175'}).barrels,4);near(C.fitSpec({k:'quad175'}).boltTT,175,1e-12);assert.equal(C.fitSpec({k:'utl'}).barrels,2);near(C.fitSpec({k:'utl'}).boltTT,720,1e-12);
});

test('Mandator II derives its requested output, shield storage and salvo from physical equipment',()=>{
 const {ship,stats}=mandator(),counts=Object.fromEntries(MAIN.map(k=>[k,ship.fits.filter(f=>f.k===k).length]));
 assert.deepEqual(counts,COUNTS);assert.equal(ship.fits.filter(f=>f.k==='stl').length,0,'the user 175 TT mounts carry quads');
 const mainAndIon=ship.fits.filter(f=>MAIN.includes(f.k)).reduce((n,f)=>n+volleyOf(f),0);near(mainAndIon,116540,1e-12);
 const below=ship.fits.filter(f=>['utl','quad175'].includes(f.k)&&f.mountMode==='bottom');assert.ok(below.length>=30,'the ventral keel carries guns');
 near(stats.power,7.7e26);near(stats.shieldCapacity,7.7e27);near(stats.shieldDissipationW,184034,1e-12);
 for(const reactor of ship.parts.filter(C.isReactor))near(C.reactorPower(reactor),C.partVolume(reactor)*C.REACTOR_POWER_DENSITY,1e-12);
 assert.ok(ship.fits.filter(f=>C.FITS[f.k]?.cat==='w').every(f=>!f.float),'all guns have physical hull stations');
 for(const p of ship.parts.filter(p=>p.k==='engine'))assert.equal(stats.info[p.id]?.vent,true,'engine '+p.id+' remains usable');
 assert.ok(!Object.values(stats.info).some(i=>i.overlap),'real source and machinery volumes do not overlap');
 for(const f of ship.fits.filter(f=>MAIN.includes(f.k)))assert.ok((stats.chargeInfo[f.id]?.ratio??1)>=.99999&&!stats.chargeInfo[f.id]?.blocked,'full single-volley storage for gun '+f.id);
});

test('Mandator reactor volume and shield dissipation survive saving without reauthoring a custom design',()=>{
 const {ship,stats}=mandator(),blueprint=JSON.parse(JSON.stringify(C.serialize(ship))),loaded=C.deserialize(blueprint);C.syncCompartments(loaded);const measured=C.shipRefitMeasure(loaded);
 near(measured.power,stats.power);near(measured.shieldCapacity,stats.shieldCapacity);near(measured.shieldDissipationW,184034,1e-12);
 assert.equal(loaded.parts.filter(C.isReactor).length,ship.parts.filter(C.isReactor).length);assert.deepEqual(Array.from(loaded.parts.filter(p=>p.k==='shield'),p=>p.shieldDissipationW),Array.from(ship.parts.filter(p=>p.k==='shield'),p=>p.shieldDissipationW));
 const profile=C.fleetProfile(measured,loaded.name,loaded);near(profile.shieldDissipationW,184034,1e-12);near(profile.shieldBuffer*C.TT,7.7e27);
 assert.ok(!Object.values(measured.info).some(i=>i.overlap));
});

test('explicit finite shield dissipation limits transient release independently of shield charge and capacity',()=>{
 const p={name:'dissipation fixture',shieldDissipationW:184034,energyModel:{version:1}},u={p,shield:10,shieldMax:20,shieldTransient:1e-12};
 const original=u.shieldTransient;C.powerTick(u,2);const released=184034*2/C.TT;near(u.shieldLedger.external/released,1,1e-12);near(u.shieldLedger.processed/released,1,1e-12);assert.ok(u.shieldTransient<original);near(u.shieldTransient,original-released,1e-18);assert.equal(u.shield,10);assert.equal(u.shieldMax,20);near(C.shieldStatus(u).dissipationW,184034,1e-12);
 const stopped={p:{...p,shieldDissipationW:0},shieldTransient:1};C.powerTick(stopped,2);assert.equal(stopped.shieldTransient,1);assert.equal(stopped.shieldLedger.external,0);
 const legacy={p:{},shieldTransient:1};C.powerTick(legacy,2);near(legacy.shieldTransient,Math.exp(-2/C.SHIELD_MODEL.processSeconds),1e-12);
});

test('shield processing follows each physical device health, trips and granted input',()=>{
 const make=()=>({p:{shieldDissipationW:1000,grid:{P:100,Ds:100},modules:[{k:'shield',part:1,share:.4,shieldDissipationW:400},{k:'shield',part:2,share:.6,shieldDissipationW:600}]},mods:[1,1],shieldTransient:1e-12,propulsion:{power:{granted:{'shields:0':40,'shields:1':60}}}});
 const run=u=>{C.powerTick(u,1);return u.shieldLedger.external*C.TT;};near(run(make()),1000,1e-12);
 const damaged=make();damaged.mods[0]=0;near(run(damaged),600,1e-12);
 const destroyed=make();destroyed.mods=[0,0];assert.equal(run(destroyed),0);
 const tripped=make();tripped.gridState={domains:{main:{trip:2,load:0}},local:{}};assert.equal(run(tripped),0);
 const disconnected=make();disconnected.p.modules[0].powerConnected=false;near(run(disconnected),600,1e-12);
 const denied=make();denied.propulsion.power.granted={};assert.equal(run(denied),0);
 const partial=make();partial.propulsion.power.granted['shields:0']=20;near(run(partial),800,1e-12);
});
