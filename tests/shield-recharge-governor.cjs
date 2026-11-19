// 2026-11-17, regression of PR #112 found after the merge: with converters sized for the sustained cruise, the recharge heat of
// a shield under light fire alone exceeded the rejection of four stored designs, and since shields were never governed they
// blacked out in 7-57 s while holding fire (Arquitens 6.75 s, CR90 7.75 s, Republic transport 14.75 s, Hammerhead 56.75 s;
// none on the main before #112). Shield recharging now follows the heat governor like weapon charging.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),F=vm.runInContext('YardFleetData',cx),plain=v=>JSON.parse(JSON.stringify(v));
// The design holds position and holds fire; a CR90 3 km off fires at it for two minutes.
function plinked(key,secs=120){
 const d=F.designs[key],a=C.fleetUnit('a',key,plain(d.p),0),b=C.fleetUnit('b','cr90',plain(F.designs.cr90.p),1);b.pos=[3000+(d.p.len||0),0,0];b.yaw=Math.PI;
 a.order={...a.order,type:'hold',fire:false};b.order={...b.order,type:'hold',fire:true,target:'a'};const B=C.fleetBattle([a,b],true);B.seed=5;let peak=0,governed=1;
 for(let t=0;t<secs;t+=.25){C.fleetTick(B,.25,{});const h=a.ht;if(h?.capacityJ>0)peak=Math.max(peak,h.qJ/h.capacityJ);governed=Math.min(governed,a.heatGov?.shield??1);}
 return {a,B,peak,governed,heatEvent:B.events.some(e=>/熱限界/.test(e.text))};
}
test('the governor reports a shield factor equal to the weapon factor',()=>{
 const unit=fill=>({ht:{online:true,qJ:fill*1e20,capacityJ:1e20}});
 for(const fill of [0,.3,.55,.6,.68,.9]){const g=C.heatGovernor(unit(fill));assert.equal(g.shield,g.weapon,'fill '+fill);}
 assert.equal(C.heatGovernor({}).shield,1);
});
for(const key of ['arquitens','cr90','hammerhead','reptransport'])test(`${key} under light fire stays up: shield recharging is held within its rejection`,()=>{
 const r=plinked(key);
 assert.equal(r.a.out,null,'no shutdown: '+r.a.out);assert.equal(r.heatEvent,false,'no heat-limit event');
 assert.ok(r.peak<C.HEAT.limitAt,'the store stays under the limiting band: '+r.peak);assert.equal(r.a.ht.damageLimit??1,1,'no thermal damage limit');
 // 2026-11-19 expectation changed with the user decision that a full shield buys no power even under fire: a ship whose
 // field stays full under this light fire never heats enough to be governed, so the governor is required only where the
 // store reached the governed band.
 assert.ok(r.governed<1||r.peak<C.HEAT.governStart,'the recharge was governed where the store reached the governed band: '+r.governed+' at peak '+r.peak);
 // A governed recharge is slower, not a failing generator: the field does not decay under this light fire.
 assert.ok(r.a.shield>=.9*r.a.shieldMax,`the field holds (${r.a.shield/r.a.shieldMax})`);
});
test('no stored design is shut down by heat while it holds fire under light fire',()=>{
 for(const key of Object.keys(F.designs)){const r=plinked(key,60);assert.equal(r.heatEvent,false,key+': heat-limit event');assert.equal(r.a.ht?.damageLimit??1,1,key+': thermal damage limit');}
});
