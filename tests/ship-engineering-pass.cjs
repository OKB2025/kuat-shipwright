const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js']){
 let source=fs.readFileSync(path.join(root,file),'utf8');
 if(file==='js/core.js')source=source.replace('return {BROADSIDE_BATTERY_CALIBERS,','return {baseComputeStats,shipRefitMeasure,BROADSIDE_BATTERY_CALIBERS,').replace('function surfaceAggregateKey(ship){','function surfaceAggregateKey(ship){globalThis.aggregateCalls=(globalThis.aggregateCalls||0)+1;');
 vm.runInContext(source,context,{filename:file});
}
const C=vm.runInContext('Core',context),plain=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
test('engineering prepasses retain physical figures while the final pass surveys firing arcs',()=>{
 const ship=C.newShip({L:200,W:80,H:60,plan:'rect',bowW:1,bowH:1,stern:1},'Engineering pass parity');
 ship._building=true;
 C.placePart(ship,'gen',[70,0,0],20);
 C.placePart(ship,'shield',[110,0,0],8);
 const fit={id:ship.nextId++,k:'pd',p:[150,30,0],n:[0,1,0],a:2,ped:0,base:0,low:0,float:false};
 C.mountFit(ship,fit);ship.fits.push(fit);delete ship._building;
 C.syncCompartments(ship);
 const fast=C.baseComputeStats(ship,{engineeringOnly:true}),full=C.baseComputeStats(ship);
 for(const key of ['mass','power','thrust','crew','cost','aStruct','aEff','shieldP','hyperClass']){assert.notEqual(full[key],undefined,key+' exists');assert.deepEqual(plain(fast[key]),plain(full[key]),key);}
 for(const key of ['dims','draw','chargeInfo','info'])assert.deepEqual(plain(fast[key]),plain(full[key]),key);
 assert.ok(full.fitInfo[fit.id].some(value=>value>0),'the final firing survey remains active');
 assert.ok(fast.fitInfo[fit.id].every(value=>value===0),'the construction prepass omits only the survey');
});
test('capital engineering enters the shared surface model once and retains its physical results',()=>{
 const ship=C.newShip({L:240,W:100,H:80,plan:'rect',bowW:1,bowH:1,stern:1},'Repeated surface lookup regression');
 ship._building=true;C.placePart(ship,'gen',[70,0,0],20);C.placePart(ship,'shield',[110,0,0],8);
 for(let i=0;i<12;i++){const f={id:ship.nextId++,k:'pd',p:[130+(i%6)*16,40,i<6?-25:25],n:[0,1,0],a:2,ped:0,base:0,low:0,float:false};C.mountFit(ship,f);ship.fits.push(f);}
 delete ship._building;ship.surfaces=C.normalizeSurfaces({mode:'strict',armorOnly:1,legacyArmor:.1,patches:[]});C.syncCompartments(ship);
 context.aggregateCalls=0;const repeated=C.baseComputeStats(ship,{engineeringOnly:true}),oldCalls=context.aggregateCalls;
 context.aggregateCalls=0;const measured=C.shipRefitMeasure(ship),newCalls=context.aggregateCalls;
 for(const key of ['mass','power','thrust','crew','cost','aStruct','aEff','shieldP','hyperClass','dims','draw','chargeInfo','info'])assert.deepEqual(plain(measured[key]),plain(repeated[key]),key);
 assert.ok(oldCalls>=ship.fits.length,'the fixture exercises per-turret whole-ship lookups');
 assert.ok(newCalls<oldCalls/2,`${newCalls} lookups after ${oldCalls} per-turret lookups`);
});
