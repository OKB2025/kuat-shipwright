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

test('Mandator declared battery reaches the requested main/ion salvo with the current PD calibration',()=>{
 const ref=C.SHIP_REFERENCE.mandator2,counts=ref.batteryCounts;assert.deepEqual(JSON.parse(JSON.stringify(counts)),{utl:163,ball720:80,quad175:16,ball175Quad:6,ball175QuadIon:14,pd:160,monCalPD:60});
 const volley=k=>{const d=C.fitSpec({k});return (d.tt||0)+(d.ion||0);},mainAndIon=['utl','ball720','quad175','ball175Quad','ball175QuadIon'].reduce((n,k)=>n+counts[k]*volley(k),0),pd=counts.pd*volley('pd')+counts.monCalPD*volley('monCalPD');
 near(mainAndIon,317520,1e-12);near(mainAndIon,ref.mainIonVolleyTT,1e-12);near(pd,.00005,1e-12);near(pd,ref.pointDefenseVolleyTT,1e-12);near(C.fitSpec({k:'pd'}).boltTT,1e-7,1e-15);assert.equal(C.fitSpec({k:'pd'}).barrels,2);assert.equal(C.fitSpec({k:'monCalPD'}).barrels,3);near(C.fitSpec({k:'monCalPD'}).boltTT,1e-7,1e-15);
 for(const k of ['quad175','ball175Quad','ball175QuadIon']){assert.equal(C.fitSpec({k}).barrels,4);near(C.fitSpec({k}).boltTT,175,1e-12);}assert.equal(C.fitSpec({k:'ball720'}).barrels,1);near(C.fitSpec({k:'ball720'}).boltTT,720,1e-12);
});

test('Mandator II derives its requested output, shield storage and exact complete salvo from physical equipment',()=>{
 const {ship,stats}=mandator(),counts=Object.fromEntries(['utl','ball720','quad175','ball175Quad','ball175QuadIon','pd','monCalPD'].map(k=>[k,ship.fits.filter(f=>f.k===k).length]));
 assert.deepEqual(counts,{utl:163,ball720:80,quad175:16,ball175Quad:6,ball175QuadIon:14,pd:160,monCalPD:60});
 const salvo=f=>(C.fitSpec(f).tt||0)+(C.fitSpec(f).ion||0),mainAndIon=ship.fits.filter(f=>['utl','ball720','quad175','ball175Quad','ball175QuadIon'].includes(f.k)).reduce((n,f)=>n+salvo(f),0),pd=ship.fits.filter(f=>f.k==='pd'||f.k==='monCalPD').reduce((n,f)=>n+salvo(f),0),volley=ship.fits.filter(f=>C.FITS[f.k]?.cat==='w'&&!C.FITS[f.k].msl).reduce((n,f)=>n+salvo(f),0);
 near(mainAndIon,317520,1e-12);near(pd,.00005,1e-12);near(volley,317520.00005,1e-12);near(stats.allGunVolleyTT,317520.00005,1e-12);
 for(const f of ship.fits.filter(f=>f.k==='pd')){near(C.fitSpec(f).boltTT,1e-7,1e-15);assert.equal(C.fitSpec(f).barrels,2);}
 near(stats.power,7.7e26);near(stats.shieldCapacity,7.7e27);near(stats.shieldDissipationW,184034,1e-12);
 const reactors=ship.parts.filter(C.isReactor);assert.equal(reactors.length,2);assert.equal(reactors.find(p=>p.k==='gen').d,420);assert.ok(reactors.find(p=>p.k==='aux').room,'additional output occupies a real internal auxiliary room');
 for(const reactor of reactors)near(C.reactorPower(reactor),C.partVolume(reactor)*C.REACTOR_POWER_DENSITY,1e-12);
 near(ship.shipSystemRefit.baselinePowerW,7.7e26);near(ship.shipSystemRefit.installedPowerW,7.7e26);assert.deepEqual(Array.from(ship.shipSystemRefit.addedReactors),[]);
 assert.ok(ship.fits.filter(f=>['utl','ball720','quad175','ball175Quad','ball175QuadIon','pd','monCalPD'].includes(f.k)).every(f=>!f.float),'all guns have physical hull stations');
 for(const p of ship.parts.filter(p=>p.k==='engine'))assert.equal(stats.info[p.id]?.vent,true,'engine '+p.id+' remains usable');
 assert.ok(!Object.values(stats.info).some(i=>i.overlap),'real source and machinery volumes do not overlap');
 assert.ok(stats.habit>=1,'the added plant and charging rooms leave enough crew accommodation');
 for(const f of ship.fits.filter(f=>['utl','ball720','quad175','ball175Quad','ball175QuadIon','pd','monCalPD'].includes(f.k)))assert.ok((stats.chargeInfo[f.id]?.ratio??1)>=.99999&&!stats.chargeInfo[f.id]?.blocked,'full single-volley storage for gun '+f.id);
});

test('Mandator reactor volume and shield dissipation survive saving without reauthoring a custom design',()=>{
 const {ship,stats}=mandator(),blueprint=JSON.parse(JSON.stringify(C.serialize(ship))),loaded=C.deserialize(blueprint);C.syncCompartments(loaded);const measured=C.shipRefitMeasure(loaded);
 near(measured.power,stats.power);near(measured.shieldCapacity,stats.shieldCapacity);near(measured.shieldDissipationW,184034,1e-12);
 assert.equal(loaded.parts.filter(C.isReactor).length,2);assert.deepEqual(Array.from(loaded.parts.filter(p=>p.k==='shield'),p=>p.shieldDissipationW),Array.from(ship.parts.filter(p=>p.k==='shield'),p=>p.shieldDissipationW));
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
