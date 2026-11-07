#!/usr/bin/env node
// Calibrate the common mass-specific heat allowance with actual squad power, fuel, shields and cooling.
const fs=require('fs'),vm=require('vm'),path=require('path'),crypto=require('crypto');
const args=process.argv.slice(2),arg=name=>args.includes(name)?args[args.indexOf(name)+1]:null;
const root=path.resolve(__dirname,'..'),{C,R}=require(root+'/scripts/update-ship-examples.cjs').loadRuntime(root);
const cat=arg('--catalog')?vm.runInNewContext(fs.readFileSync(path.resolve(arg('--catalog')),'utf8')+';CRAFT_PRICE_CATALOG'):C.CRAFT_PRICE_CATALOG;
for(const [key,row]of Object.entries(cat.entries)){C.CRAFT_PRICE_CATALOG.entries[key]=row;R.CRAFT[key].powerProfile=C.cleanCraftPowerProfile(row.powerProfile);}
const profiles={};for(const key of Object.keys(R.CRAFT)){const p=R.craftPowerOf(R.CRAFT[key]);if(p)profiles[key]=p;}
function simulate(key,scenario,q){
 C.HEAT.qAllowJPerKg=q;const p=profiles[key],craft=R.CRAFT[key],s={id:key+scenario,craft:key,n:1,n0:1,side:0,pos:[0,0,0],h:[1,0,0],vel:[0,0,0],state:'out',wing:'calibration',ldg:[],ammo:[],foil:scenario==='cruise'?0:1,weaponDemand:scenario!=='cruise',strafeT:scenario==='cruise'?null:600};
 R.squadPropulsion(s,0,0);if(scenario==='battle-half-shield')s.drive.shield=s.drive.shieldMax*.5;
 const world={time:0,squads:new Map([[s.id,s]]),wings:new Map()},throttle=scenario==='cruise'?.6:.35;let peak=0,firedJ=0,shieldInputJ=0,driveInputJ=0,blackout=false,minimumOutput=1;
 for(let i=0;i<600;i++){world.time=i;s.weaponDemand=scenario!=='cruise'&&s.state==='out';R.squadPropulsion(s,throttle,1);const u=s.drive,h=C.heatStatus(u);peak=Math.max(peak,h.qJ);minimumOutput=Math.min(minimumOutput,h.damageLimit);blackout||=!h.online;firedJ+=Math.max(0,u.pw?.wpn||0);shieldInputJ+=Math.max(0,u.pw?.sh||0);driveInputJ+=Math.max(0,u.pw?.eng||0);R.squadSystemsTick(world,1);}
 const u=s.drive,h=C.heatStatus(u),fuel=C.shipFuelState(u);return {key,scenario,source:p.estimated?'priced-table-estimate':'physical-blueprint',massKg:C.shipHeatMassKg(u),peakJ:peak,fill:peak/(C.shipHeatMassKg(u)*q),endJ:h.qJ,operatingHeatJ:h.operatingHeatJ,rejectedHeatJ:h.rejectedHeatJ,firedElectricalJ:firedJ,shieldInputJ,driveInputJ,coolingInputJ:h.cooling?.inputJ||0,generatedElectricalJ:h.actualGeneratedElectricalJ,fuelConsumedKg:fuel.consumedKg,fuelOverdrawJ:fuel.overdrawJ,minimumOutput,blackout,shieldInitialFraction:scenario==='battle-half-shield'?.5:1,shieldFinalFraction:u.shieldMax>0?u.shield/u.shieldMax:null,laserGasRemaining:s.laserGas,state:s.state};
}
const cases=[];for(const key of Object.keys(profiles).sort())for(const scenario of ['cruise','battle','battle-half-shield'])cases.push([key,scenario]);
const probe=cases.map(([k,m])=>simulate(k,m,1e30));const minimum=Math.max(...probe.map(r=>r.peakJ/(.70*r.massKg))),q=Math.ceil(minimum*1.01/1e9)*1e9;const results=cases.map(([k,m])=>simulate(k,m,q));
const report={format:'whole-vessel-heat-calibration-v1',secondsPerScenario:600,dtSeconds:1,incomingHits:0,cruiseThrottle:.6,battleThrottle:.35,battleShieldInitialFractions:[1,.5],craftCount:Object.keys(profiles).length,minimumQAllowJPerKg:minimum,qAllowJPerKg:q,margin:1.01,probeQAllowJPerKg:1e30,probe,results,profileSha256:crypto.createHash('sha256').update(JSON.stringify(profiles)).digest('hex'),sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(root+'/js/core.js')).digest('hex')};
if(arg('--output'))fs.writeFileSync(path.resolve(arg('--output')),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({q,count:results.length,maxFill:Math.max(...results.map(r=>r.fill)),limiting:results.sort((a,b)=>b.fill-a.fill).slice(0,3),failed:results.filter(r=>r.blackout||r.minimumOutput<1||r.fuelOverdrawJ>1e8).map(r=>r.key+':'+r.scenario)}));
