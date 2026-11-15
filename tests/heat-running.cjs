// User decision 2026-11-13 / 2026-11-15: 「通常は排熱-熱がほぼ釣り合うように挙動／全力で熱を気にせず動くが50%で警告」, the heat store
// keeps its size. Balanced running holds thrust and weapon charging so the heat made stays within what the ship can
// reject; full running ignores heat until the store is half full, then warns and returns to balanced running.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{test}=require('node:test');
const root=process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),F=vm.runInContext('YardFleetData',cx);
// Two MC80s 30 km apart; scale < 1 cuts every heat converter's capacity (a ship built with too little cooling).
function duel(scale,heat,secs){
 const prof=()=>{const p=JSON.parse(JSON.stringify(F.designs.mc80liberty.p));for(const d of p.heat.dis)d.cap*=scale;return p;};
 const a=C.fleetUnit('a','mc80liberty',prof(),0),b=C.fleetUnit('b','mc80liberty',prof(),1);b.pos=[30000,0,0];b.yaw=Math.PI;
 a.order={...a.order,type:'attack',target:'b',fire:true,...(heat?{heat}:{})};b.order={...b.order,type:'attack',target:'a',fire:true,...(heat?{heat}:{})};
 const B=C.fleetBattle([a,b],true);B.seed=7;let peak=0,over=0,n=0;
 for(let t=0;t<secs;t+=.25){C.fleetTick(B,.25,{});const h=a.ht;peak=Math.max(peak,h.qJ/h.capacityJ);if(t>=20&&h.cap>0){n++;if(h.madeW>h.cap*1.02)over++;}}
 return {a,B,peak,over,n,events:B.events.filter(e=>/全力運転を解除/.test(e.text))};
}
test('balanced running holds the heat made within the rejection capacity of a ship with too little cooling',()=>{
 const r=duel(.7,'balance',90);
 assert.equal(r.a.out,null,'no shutdown: '+r.a.out);assert.ok(r.peak<C.HEAT.limitAt,'the store stays under the limiting band: '+r.peak);
 assert.equal(r.over,0,`heat made within capacity after the first seconds (${r.over}/${r.n} steps over)`);assert.ok(r.a.ht.runK<1,'output is held back: '+r.a.ht.runK);
 assert.equal(r.events.length,0);assert.equal(C.heatRunMode(r.a),'balance');
});
test('full running ignores heat until the store is half full, then warns and returns to balanced running',()=>{
 const r=duel(.7,'full',30);
 assert.ok(r.events.some(e=>e.id==='a'||/MC80/.test(e.text)),'a warning event');assert.equal(r.a.order.heat,'balance','the order returns to balanced');
 assert.ok(r.peak>=C.HEAT.fullWarnAt,'it ran until the warning level: '+r.peak);assert.equal(r.a.out,null);
});
test('a ship with enough cooling is not held back in either mode',()=>{
 for(const m of ['balance','full']){const r=duel(1,m,40);assert.equal(r.a.heatGov.weapon,1,m);assert.equal(r.a.heatGov.engine,1,m);assert.equal(r.events.length,0,m);}
});
test('a ship left to itself runs full while it has a target and the store is low',()=>{
 const r=duel(1,null,20);assert.equal(r.a.order.heat,undefined);assert.equal(C.heatRunMode(r.a),'full');assert.equal(C.heatRunMode({order:{},manual:true}),'balance','a piloted ship is balanced until its captain orders full');
});
