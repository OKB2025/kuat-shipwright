const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx),near=(a,b,label='value')=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1e-30,Math.abs(b))*1e-10,`${label}: ${a} != ${b}`);
const corvette=[['quad500MT','cr90_light_quad500mt',4,.0005,'light-turbolaser'],['twin500MT','cr90_light_twin500mt',2,.0005,'light-turbolaser'],['single500MT','cr90_light_single500mt',1,.0005,'light-turbolaser'],['single6MT','cr90_heavy_single6mt',1,.000006,'heavy-laser'],['twin6MT','sphyrna_heavy_twin6mt',2,.000006,'heavy-laser'],['sphyrnaTwin500MT','sphyrna_light_twin500mt',2,.0005,'light-turbolaser']];
function shot(k,barrels,boltTT){const d=C.FITS[k];assert.ok(d,k+' is a current weapon');assert.equal(d.fixedPerBarrelEnergy,true,k+' keeps per-shot energy in every firing path');assert.equal(d.barrels,barrels,k+' actual barrel count');near(d.boltTT,boltTT,k+' per shot per barrel');near(d.tt,barrels*boltTT,k+' one complete salvo');assert.ok(d.cycle>0);near(d.power*d.cycle/C.TT,barrels*boltTT,k+' electrical demand follows actual cadence');const bank=C.weaponChargeSpec({k});assert.equal(bank.barrels,barrels);near(bank.boltTT,boltTT);near(bank.volleyTT,barrels*boltTT);near(bank.targetVolume,barrels*boltTT/C.CHARGE_TT_M3);return d;}

test('dedicated ship point defence fires 100 kt per actual barrel per shot',()=>{
 for(const [k,n]of [['pd',2],['monCalPD',3]]){const d=shot(k,n,1e-7),a=C.REFERENCE_ASSETS[d.asset];assert.equal(C.weaponRoles(d).pointDefense,true);assert.equal(a.barrelCenters.length,n);assert.equal(a.muzzlePoints.length,n);}
});
test('aircraft laser energy is 2 kt per physical barrel at the actual firing cadence',()=>{
 for(const [k,n]of [['claser',1],['claserH',1],['cturret',2]]){const d=shot(k,n,2e-9);assert.equal(d.cycle,C.CRAFT_FIRE.cycles[k]);assert.ok(d.cycle>0&&d.cycle<1);if(k==='cturret'){assert.equal(d.pointDefense,false);assert.equal(C.weaponRoles(d).dualPurpose,true);assert.equal(C.weaponRoles(d).purePointDefense,false);}}
});
test('six native corvette weapons preserve their 500 MT and 6 MT shot energies and remain separate from dedicated PD',()=>{
 assert.deepEqual(Array.from(C.CORVETTE_WEAPON_KEYS),corvette.map(row=>row[0]));for(const [k,asset,n,boltTT,family]of corvette){const d=shot(k,n,boltTT),a=C.REFERENCE_ASSETS[asset];assert.equal(d.asset,asset);assert.ok(a);assert.equal(d.weaponFamily,family);assert.equal(d.catalogHidden,false);assert.equal(C.weaponRoles(d).pointDefense,false,k+' is not recalibrated as a 100 kt PD weapon');assert.equal(C.weaponModelScale(k),1);near(a.boltTT,boltTT);near(a.volleyTT,n*boltTT);assert.equal(a.muzzlePoints.length,n);}
});
test('existing 500 GT guns remain one thousand times the new 500 MT guns per barrel',()=>{
 for(const k of ['single500','quad500']){assert.equal(C.FITS[k].boltTT,.5);near(C.FITS[k].boltTT/C.FITS.single500MT.boltTT,1000);assert.notEqual(C.FITS[k].asset,C.FITS.single500MT.asset);}
});
test('native 6 MT heavy lasers retain anti-ship and anti-aircraft roles without becoming 100 kt dedicated PD',()=>{
 for(const k of ['single6MT','twin6MT']){const d=C.FITS[k],roles=C.weaponRoles(d);assert.equal(d.pointDefense,false);assert.equal(roles.pointDefense,false);assert.equal(roles.dualPurpose,true);assert.equal(roles.purePointDefense,false);assert.ok(d.aa>0&&d.tt>0);near(d.boltTT,6e-6);const ship=C.newShip({L:100,W:60,H:40,plan:'rect',sec:'rect',bowW:1,bowH:1,stern:1},'Dual purpose heavy laser');ship.parts=[{id:1,k:'gen',c:[20,20,0],d:20}];ship.fits=[];ship.nextId=2;const placed=C.placeFit(ship,k,[70,40,0],[0,1,0],0,false);assert.ok(placed.fit,placed.err);const stats=C.computeStats(ship),p=C.fleetProfile(stats,ship.name,ship);assert.ok(p.dualPurpose.aa>0,'the real fleet profile retains the fitted AA battery');assert.ok(p.dualPurpose.gunArcs.some(v=>v>0),'the real fleet profile retains the same battery for ship fire');}
 for(const k of ['quad500MT','twin500MT','single500MT','sphyrnaTwin500MT']){assert.equal(C.weaponRoles(C.FITS[k]).pointDefense,false);assert.equal(C.weaponRoles(C.FITS[k]).dualPurpose,false);near(C.FITS[k].boltTT,.0005);}
});
test('ship ion cannon salvos retain their full original yields',()=>{
 for(const [k,n,boltTT]of [['ion',2,175],['quad40Ion',4,40],['monCal150Ion',1,150]]){const d=C.FITS[k],q=C.weaponChargeSpec({k});assert.equal(d.barrels,n);assert.equal(d.boltTT,boltTT);assert.equal(d.tt,0);assert.equal(d.ion,n*boltTT);assert.equal(q.volleyTT,n*boltTT);assert.equal(q.boltTT,boltTT);assert.equal(C.weaponRoles(d).pointDefense,false);}
});

function chargedUnit(k,energy){
 const d=C.FITS[k],output=d.barrels*d.boltTT,power=d.power,p={hp:1e6,len:20,width:10,height:10,D:0,shieldBuffer:0,reserve:0,wCap:output*3,crewNeed:0,crewMax:0,accel:0,maxSpeed:0,turnRate:0,gunArcs:Array(6).fill(0),ionArcs:Array(6).fill(0),modules:[{k:'reactor',part:1,port:'p1',domain:'main',share:1,size:1},{k:'weapon',part:2,port:'p2',domain:'main',share:1,size:1,powerConnected:true}],grid:{P:power*2,Pgen:power*2,fixed:0,cooling:0,De:0,Ds:0,Dw:power,powerPaths:[{from:'p1',to:'p2',cap:power,ok:true}],domains:[{id:'main',P:power*2,sources:[{moduleIndex:0,P:power*2}],modules:[0,1]}]},surface:{mounts:[{id:2,module:1,power,capacity:output*3,gun:output/d.cycle,ion:0,boltTT:d.boltTT,volleyTT:output,barrels:d.barrels,cycle:d.cycle,band:'close',arcs:Array(6).fill(1),muzzle:[0,0,0]}],patches:[],devices:[]}};
 const u=C.fleetUnit('tiny-shot','tiny-shot',p);C.allocateShipPower(u,C.fleetSystems(u),{throttle:0,weapons:power,shields:0},0,'balanced');u.surfaceBanks={2:energy};u.energy=energy;return {u,output};
}
test('tiny physical shots cannot borrow absolute numerical tolerances from an empty or undersupplied bank',()=>{
 for(const k of ['claser','cturret','pd'])for(const fraction of [0,.99,1]){const expected=C.FITS[k].barrels*C.FITS[k].boltTT,{u,output}=chargedUnit(k,expected*fraction),before=u.energy,r=C.surfaceSpend(u,2,output);assert.equal(r.ok,fraction===1,`${k}: ${fraction} of a shot`);near(r.spent,fraction===1?output:0);near(u.energy,fraction===1?0:before);if(r.ok)near(u.surfaceLastFire.gun,output,'spent damage is one shot, not a rate');}
});
test('two stored aircraft salvos fund exactly two actual shots and no third shot',()=>{
 const d=C.FITS.cturret,output=d.barrels*d.boltTT,{u}=chargedUnit('cturret',output*2);for(let i=0;i<2;i++){const r=C.surfaceSpend(u,2,output);assert.equal(r.ok,true);near(r.spent,output);}near(u.energy,0);const third=C.surfaceSpend(u,2,output);assert.equal(third.ok,false);near(third.spent,0);
});

test('sub-shot electrical increments accumulate into exactly one complete 2 kt pulse',()=>{
 const d=C.FITS.claser,{u,output}=chargedUnit('claser',0),dt=d.cycle/8;let total=0;for(let i=0;i<8;i++){C.allocateShipPower(u,C.fleetSystems(u),{throttle:0,weapons:d.power,shields:0,deferHeat:true},dt,'balanced');const accepted=C.surfaceManualCharge(u,d.power,dt);assert.ok(accepted>0,'small valid joule grants are not rounded away');near(accepted,output/8);total+=accepted;}near(total,output);near(u.surfaceBanks[2],output);assert.equal(C.surfaceSpend(u,2,output).ok,true);assert.equal(C.surfaceSpend(u,2,output).ok,false);near(u.energy,0);
});
