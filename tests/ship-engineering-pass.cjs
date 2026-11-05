const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js']){
 let source=fs.readFileSync(path.join(root,file),'utf8');
 if(file==='js/core.js')source=source.replace('return {BROADSIDE_BATTERY_CALIBERS,','return {baseComputeStats,BROADSIDE_BATTERY_CALIBERS,');
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
