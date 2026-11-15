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
// 2026-11-15, user decisions「自動全力運転は外す」「排熱は被弾とも釣り合う」. The fourth case stated automatic full running
// (a ship left to itself ran full while it had a target); it now states the opposite, and a fifth case checks that
// the heat of hits is part of what balanced running balances.
test('a ship left to itself runs balanced: full running only on an order',()=>{
 const r=duel(1,null,20);assert.equal(r.a.order.heat,undefined);assert.equal(C.heatRunMode(r.a),'balance');assert.equal(r.events.length,0);
 assert.equal(C.heatRunMode({order:{},manual:true}),'balance');assert.equal(C.heatRunMode({order:{heat:'full'}}),'full');assert.equal(C.heatRunMode({order:{heat:'full'},manual:true}),'full');
});
test('balanced running counts the heat of hits: a ship taking hits holds back further than its own heat alone asks',()=>{
 const own=duel(.7,'balance',10),k0=own.a.ht.runK;
 const prof=()=>{const p=JSON.parse(JSON.stringify(F.designs.mc80liberty.p));for(const d of p.heat.dis)d.cap*=.7;return p;};
 const a=C.fleetUnit('a','mc80liberty',prof(),0),b=C.fleetUnit('b','mc80liberty',prof(),1);b.pos=[30000,0,0];b.yaw=Math.PI;
 a.order={...a.order,type:'attack',target:'b',fire:true,heat:'balance'};b.order={...b.order,type:'attack',target:'a',fire:true,heat:'balance'};
 const B=C.fleetBattle([a,b],true);B.seed=7;const cap=()=>a.ht.cap||1;
 for(let t=0;t<10;t+=.25){C.fleetTick(B,.25,{});C.shipHeatAdd(a,cap()*.3*.25);}/* hits put in a further 30% of the rejection */
 assert.ok(a.ht.runK<k0-.05,`with hits ${a.ht.runK} against ${k0} without`);
});

// Physics review 2026-11-15 (FAIL on 9233374): hits taken during full running were kept and counted as one step's rate on
// returning to balanced running (the factor fell to nearly 0), and hits mixed into the two-step slope swung the factor
// with each volley. Hit heat is now spread over HEAT.hitTau seconds and taken off the allowance, outside the slope.
// A synthetic ship: 1000 W of rejection, own heat 300 W + 1000 W × the factor, so balanced running settles at
// k = (970 − 300 − hit W) / 1000. Hit heat is fed as joules between steps, as shipHeatAdd does.
const near=(x,y,eps)=>assert.ok(Math.abs(x-y)<=eps,`${x} != ${y} ±${eps}`);
function steps(order,n,hitAt,state){
 const H={dis:[{cap:1000}]},h=state?.h||{cap:1000},u=state?.u||{order:{}},ks=[];u.order.heat=order;
 for(let i=0;i<n;i++){const j=hitAt(i);if(j>0)h.impactRunJ=(h.impactRunJ||0)+j;const k=order==='full'?1:(h.runK??1);C.heatRunThrottle(u,h,H,(300+1000*k)*.25,.25);ks.push(h.runK);}
 return {h,u,ks};
}
test('returning from full running is not driven to the floor by the hits taken while running full',()=>{
 const full=steps('full',40,()=>200*.25),back=steps('balance',4,()=>200*.25,full);
 for(const k of back.ks)assert.ok(k>.35,`factor ${k} just after returning (settles at .47)`);
});
test('hits in volleys every fourth step hold the factor as steady hits of the same mean do',()=>{
 const tail=r=>r.ks.slice(-40),mean=a=>a.reduce((n,x)=>n+x,0)/a.length;
 const steady=tail(steps('balance',240,()=>200*.25)),volley=tail(steps('balance',240,i=>i%4===3?200:0));
 near(mean(steady),.47,.03);near(mean(volley),.47,.03);assert.ok(Math.max(...volley)-Math.min(...volley)<.08,`volley swing ${Math.min(...volley)}–${Math.max(...volley)}`);
});
