#!/usr/bin/env node
// CPU-only acceptance benchmark. This measures the shared simulation functions;
// it does not measure browser rendering, GPU throughput, or network latency.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{performance}=require('node:perf_hooks'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),args=process.argv.slice(2),option=(key,fallback)=>{const i=args.indexOf(key);return i<0?fallback:args[i+1];};
const progress=args.includes('--progress'),note=message=>{if(progress)process.stderr.write(message+'\n');};
const ships=Math.max(102,Math.min(500,Math.round(Number(option('--ships',110))||110))),count=ships%2?ships+1:ships,ticks=Math.max(2,Math.min(120,Math.round(Number(option('--ticks',20))||20))),dt=.25,output=option('--output',null);
const start=performance.now(),context=vm.createContext({console});let loadedCoreHash=null;
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js']){const source=fs.readFileSync(path.join(root,file),'utf8');if(file==='js/core.js')loadedCoreHash=crypto.createHash('sha256').update(source).digest('hex');vm.runInContext(source,context,{filename:file});}
const C=vm.runInContext('Core',context),loadMs=performance.now()-start,phases={},now=()=>performance.now(),percentile=(a,p)=>a[Math.min(a.length-1,Math.floor((a.length-1)*p))]||0;
function summarize(samples,operationsPerSample=1){const sorted=samples.slice().sort((a,b)=>a-b),total=samples.reduce((a,b)=>a+b,0);return {samples:samples.length,operationsPerSample,totalMs:total,meanMs:total/Math.max(1,samples.length),medianMs:percentile(sorted,.5),p95Ms:percentile(sorted,.95),maxMs:sorted.at(-1)||0,meanPerOperationMs:total/Math.max(1,samples.length*operationsPerSample)};}
function batch(name,rounds,units,action){note(`${name}: ${rounds} batches of ${units.length}`);const samples=[];for(let r=0;r<rounds;r++){const t=now();for(let i=0;i<units.length;i++)action(units[i],i,r);samples.push(now()-t);}phases[name]=summarize(samples,units.length);note(`${name}: ${phases[name].totalMs.toFixed(2)} ms total`);}
function sum(units,get){return units.reduce((n,u)=>n+(get(u)||0),0);}
function close(a,b,label){assert.ok(Math.abs(a-b)<=1e-8*Math.max(1,Math.abs(a),Math.abs(b)),`${label}: ${a} != ${b}`);}
let eventCount=0;
const ctx={time:0,damage:1,rand:()=>.75,ev(){eventCount++;},sunk(){},out(){}};

const designAt=now(),ship=C.newShip({L:240,W:120,H:60,plan:'rect',sec:'rect'},'Surface systems benchmark');
ship.parts=[{id:1,k:'gen',c:[90,25,0],d:35},{id:2,k:'shield',c:[140,25,0],d:5},{id:3,k:'command',c:[165,30,20],d:10,room:[10,10,10]}];ship.fits=[];ship.nextId=4;
C.enableSurfaceMode(ship,true);
const faces=C.surfacePatches(ship).filter(p=>p.host==='hull'&&['top','stbd'].includes(p.face)&&p.id.split(':')[2]==='0');assert.equal(faces.length,2);
for(const face of faces){const result=C.setSurfaceConfig(ship,[face.id],{armor:{material:'standard',thickness:.5},battery:{weapon:'ltl',count:2,spacing:2,angle:0},equipment:{kind:'hdis',count:1,depth:2},style:{kind:'machinery',density:.3,seed:41}});assert.equal(result.ok,true);}
phases.designAndGeneration={totalMs:now()-designAt};
note(`designAndGeneration: ${phases.designAndGeneration.totalMs.toFixed(2)} ms`);
const profileAt=now(),stats=C.computeStats(ship),profile=C.fleetProfile(stats,ship.name,ship);phases.statsAndProfile={totalMs:now()-profileAt};
note(`statsAndProfile: ${phases.statsAndProfile.totalMs.toFixed(2)} ms`);
assert.equal(profile.surface.mounts.length,4);assert.equal(ship.parts.filter(p=>p.surfacePatch).length,2);assert.ok(profile.grid.P>0);assert.ok(profile.surface.mounts.every(m=>profile.modules[m.module]?.powerConnected));
function units(prefix){return Array.from({length:count},(_,i)=>{const team=i<count/2?0:1,row=i%(count/2),u=C.fleetUnit(prefix+i,'surface-benchmark',profile,team);u.pos=[team?4000:-4000,0,(row-(count/2-1)/2)*320];u.yaw=team?Math.PI:0;u.order={type:'hold',fire:true,launch:false,power:'weapons',aim:'auto'};return u;});}
const initAt=now(),powerUnits=units('power-');phases.unitInitialization={totalMs:now()-initAt,ships:count};
for(const u of powerUnits){u.energy=0;u.shield*=.5;u.bank*=.5;}
let poweredCalls=0,firingCalls=0,weaponDrawJ=0,spentTT=0;
batch('sharedPowerAndBattery',ticks,powerUnits,(u,i)=>{const target=powerUnits[(i+count/2)%count],fire=C.fleetFire(u,target,C.len(C.sub(u.pos,target.pos))),systems=C.fleetSystems(u),factor=C.fleetPowerStep(u,systems,target,fire.cost,dt);if(u.pw?.P>0)poweredCalls++;if(factor>0)firingCalls++;weaponDrawJ+=(u.pw?.wpn||0)*dt;spentTT+=u.surfaceLastFire?.spent||0;});
assert.ok(poweredCalls>0&&firingCalls>0&&weaponDrawJ>0,'the power benchmark must perform real charging and firing');
let radiatingCalls=0;
batch('heatTransportAndDissipation',ticks,powerUnits,(u,i,r)=>{ctx.time=(r+1)*dt;C.heatTick(ctx,u,dt);if((u.ht?.emit||0)>0)radiatingCalls++;});
assert.ok(radiatingCalls>0,'the heat benchmark must actually transport and dissipate stored waste');

const shieldUnits=units('shield-');let packets=0;
batch('shieldAcceptanceAndProcessing',ticks,shieldUnits,u=>{const energy=Math.max(.001,u.shieldMax*.01),rec=C.shieldReceive(u,{energy,ion:energy*.75},ctx);close(rec.incoming,rec.external+rec.storedDelta+rec.onboardHeat+rec.leaked,'shield packet');C.powerTick(u,dt,ctx);packets++;});
const shieldLedger={incoming:sum(shieldUnits,u=>u.shieldLedger?.incoming),external:sum(shieldUnits,u=>u.shieldLedger?.external),stored:sum(shieldUnits,u=>u.shieldLedger?.stored),heat:sum(shieldUnits,u=>u.shieldLedger?.heat),leaked:sum(shieldUnits,u=>u.shieldLedger?.leaked)};
close(shieldLedger.incoming,shieldLedger.external+shieldLedger.stored+shieldLedger.heat+shieldLedger.leaked,'shield ledger');

const ionUnits=units('ion-'),weaponIndex=profile.modules.findIndex(m=>m.k==='weapon'&&m.powerConnected),domain=profile.grid.domains.find(d=>d.id===(profile.modules[weaponIndex].domain||'main'))||profile.grid.domains[0],base=Math.max(1,domain.P/C.TT*C.ION_MODEL.pulseSeconds),physicalBefore=ionUnits.map(u=>Array.from(u.mods));
assert.ok(weaponIndex>=0);let localTrips=0,gridTrips=0;
batch('localIonCouplingAndDischarge',ticks,ionUnits,u=>{const rec=C.ionOverload(u,base*C.ION_MODEL.localShare*1.2/C.ION_MODEL.coupling,{moduleIndex:weaponIndex},ctx);if(rec.scope==='local')localTrips++;C.powerTick(u,dt,ctx);});assert.ok(localTrips>0);
batch('commonGridIonTrip',1,ionUnits,u=>{const rec=C.ionOverload(u,base*C.ION_MODEL.gridShare*2/C.ION_MODEL.coupling,{moduleIndex:weaponIndex},ctx);if(rec.scope==='grid')gridTrips++;assert.equal(C.powerStatus(u).blackout,true);assert.equal(C.powerFactor(u,'reactor'),0);});assert.equal(gridTrips,count);
batch('protectedGridRestart',1,ionUnits,u=>{C.powerTick(u,181,ctx);assert.equal(C.powerStatus(u).blackout,false);});
ionUnits.forEach((u,i)=>assert.deepEqual(Array.from(u.mods),physicalBefore[i],'protection and restart must not repair or destroy modules'));
const ionLedger={incoming:sum(ionUnits,u=>u.ionLedger?.incoming),external:sum(ionUnits,u=>u.ionLedger?.external),stored:sum(ionUnits,u=>u.ionLedger?.stored),heat:sum(ionUnits,u=>u.ionLedger?.heat)};close(ionLedger.incoming,ionLedger.external+ionLedger.stored+ionLedger.heat,'ion ledger');

const pulseUnits=units('pulse-');pulseUnits.forEach((u,i)=>u.pos=[1000+i*250,0,(i%5-2)*25]);
const pulse={id:'benchmark-pulse',from:'benchmark-source',o:[0,0,0],dir:[1,0,0],x:0,E:base*count*1000,E0:base*count*1000,d:100,hit:[]},pulseAt=now();C.ionBoltsStep([pulse],pulseUnits,12,ctx);phases.expandingIonPulseTraversal={totalMs:now()-pulseAt,ships:count};
const pulseReceived=(pulse.log||[]).reduce((n,h)=>n+h.E,0);assert.ok((pulse.log||[]).length>=3,'an expanding pulse must really intersect several ships');close(pulse.E0,pulse.E+pulseReceived,'pulse energy');

const localUnits=units('local-'),device=profile.surface.devices.find(d=>d.external&&d.kind==='weapon'),hitSamples=[];let damagedModules=0,unhurtGunModules=0;
assert.ok(device);for(const u of localUnits){const t=now();C.surfaceHit(ctx,u,device.center,Math.max(.1,profile.hp*.002),'benchmark');hitSamples.push(now()-t);damagedModules+=u.mods.filter(v=>v<1).length;unhurtGunModules+=profile.modules.filter((m,i)=>m.k==='weapon'&&u.mods[i]===1).length;}
phases.localSurfaceHits=summarize(hitSamples,1);assert.ok(damagedModules>0&&unhurtGunModules>0,'a local hit must damage actual equipment while leaving other guns intact');

const battleUnits=units('battle-'),battle=C.fleetBattle(battleUnits),beforeDefense=sum(battleUnits,u=>u.shield+u.bank),beforeHull=sum(battleUnits,u=>u.hp),battleSamples=[];let shots=0,shotTT=0;
note(`fullSharedBattleTick: ${ticks} steps of ${count} ships`);
for(let step=0;step<ticks;step++){const t=now(),events=C.fleetTick(battle,dt,{collide:false});battleSamples.push(now()-t);shots+=events.filter(s=>s.gun>0).length;shotTT+=events.reduce((n,s)=>n+(s.gun||0),0);if((step+1)%5===0)note(`fullSharedBattleTick: ${step+1}/${ticks}`);}
phases.fullSharedBattleTick=summarize(battleSamples,count);assert.ok(shots>0&&shotTT>0,'the 100+ ship battle must actually fire');
const battleLedgerIncoming=sum(battleUnits,u=>u.shieldLedger?.incoming),afterDefense=sum(battleUnits,u=>u.shield+u.bank),afterHull=sum(battleUnits,u=>u.hp);assert.ok(battleLedgerIncoming>0||afterDefense<beforeDefense||afterHull<beforeHull,'the battle must apply real damage/defence work');

let revision=null;try{revision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();}catch{}
const currentCoreHash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'js/core.js'))).digest('hex');assert.equal(currentCoreHash,loadedCoreHash,'core.js changed during the benchmark; rerun against stable source');
const result={schemaVersion:1,date:new Date().toISOString(),machine:{platform:os.platform(),arch:os.arch(),node:process.version,cpuModel:os.cpus()[0]?.model,logicalCpus:os.cpus().length,memoryGiB:os.totalmem()/2**30},source:{revision,coreSha256:loadedCoreHash,workingTreeMayContainUncommittedChanges:true},configuration:{ships:count,simulationTicks:ticks,simulationSeconds:ticks*dt,fixedStepSeconds:dt,sharedDesignProfiles:1,mountsPerShip:profile.surface.mounts.length,barrelsPerShip:profile.surface.mounts.reduce((n,m)=>n+m.barrels,0),surfaceCoolersPerShip:ship.parts.filter(p=>p.surfacePatch).length,surfacePatchesPerShip:profile.surface.patches.length,physicalDesignParts:ship.parts.length,physicalDesignFits:ship.fits.length,strictThermal:true,collisionsEnabledInFullBattle:false,libraryLoadMs:loadMs},phases,activity:{poweredCalls,firingCalls,weaponDrawJ,spentTT,radiatingCalls,shieldPackets:packets,localTrips,gridTrips,damagedModules,unhurtGunModules,battleShots:shots,battleShotTT:shotTT,battleLedgerIncoming,beforeDefense,afterDefense,beforeHull,afterHull,eventCount},conservation:{shieldTT:shieldLedger,ionTT:ionLedger},scope:{measured:['actual generated surface weapon/cooler/armor design and common profile','shared charging/power/battery work','common heat transport and dissipation','finite shield energy accounting','ion local trips, common-grid propagation and restart','position-based surface equipment damage','110+ ship common fleet battle with actual fire'],notMeasured:['GPU rendering and browser frame rate','Rts strategic sensing, navigation and campaign AI','permanent browser memory growth','multi-design fleets or more than the requested bounded ship count'],notes:['One measured design is reused across ships, as with repeated classes in a real fleet.','Reported samples are CPU wall times in the current container; concurrent activity and JIT can affect them.','The full fleet battle disables ship collisions to isolate the requested weapon, shield, power and heat work.','No rendering quality or camera parameter enters simulation inputs.','Coefficients are game model assumptions, not canon formulae or established neutrino cooling technology.']},status:'PASS'};
result.activity.pulseHits=(pulse.log||[]).length;result.conservation.pulseTT={emitted:pulse.E0,received:pulseReceived,remaining:pulse.E};
const text=JSON.stringify(result,null,2)+'\n';if(output){fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});fs.writeFileSync(output,text);}process.stdout.write(text);
