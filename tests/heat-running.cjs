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
 let madeMax=0,run=0,longest=0,sum=0,dmgMin=1;for(let t=0;t<secs;t+=.25){C.fleetTick(B,.25,{});const h=a.ht;peak=Math.max(peak,h.qJ/h.capacityJ);madeMax=Math.max(madeMax,h.madeW||0);dmgMin=Math.min(dmgMin,h.damageLimit??1);if(t>=20&&h.cap>0){n++;sum+=h.madeW/h.cap;if(h.madeW>h.cap*1.02){over++;run++;longest=Math.max(longest,run);}else run=0;}}
 return {a,B,peak,dmgMin,over,n,madeMax,longest,mean:n?sum/n:0,events:B.events.filter(e=>/全力運転を解除/.test(e.text))};
}
// 2026-11-16 PR #112 (converters sized for a 70% sustained cruise): the regenerated MC80's own cooling no longer covers combat, so
// 'enough' and 'too little' cooling are scaled from the heat it actually makes in this duel (measured with ample cooling).
let COMBAT_SCALE=null;function combatScale(){if(COMBAT_SCALE==null){const r=duel(100,'full',30),cap0=F.designs.mc80liberty.p.heat.dis.reduce((a,d)=>a+d.cap,0);COMBAT_SCALE=r.madeMax/cap0;}return COMBAT_SCALE;}
test('balanced running holds the heat made within the rejection capacity of a ship with too little cooling',()=>{
 const r=duel(.7*combatScale(),'balance',90);
 assert.equal(r.a.out,null,'no shutdown: '+r.a.out);assert.ok(r.peak<C.HEAT.limitAt,'the store stays under the limiting band: '+r.peak);assert.equal(r.dmgMin,1,'no thermal damage limit');
 // 2026-11-16 PR #112: with converters sized for the cruise, weapon bursts briefly exceed the rejection before the governor answers;
 // the store takes them. Balanced running holds the heat made within capacity on average and never over it for more than four heat solves (3 s).
 assert.ok(r.mean<=1,`heat made within capacity on average after the first seconds (mean ${r.mean})`);assert.ok(r.longest<=12,`no burst over capacity lasts more than four heat solves (3 s; ${r.longest} steps of .25 s; ${r.over}/${r.n} over)`);assert.ok(r.a.ht.runK<1,'output is held back: '+r.a.ht.runK);
 assert.equal(r.events.length,0);assert.equal(C.heatRunMode(r.a),'balance');
});
test('full running ignores heat until the store is half full, then warns and returns to balanced running',()=>{
 const r=duel(.7,'full',30);
 assert.ok(r.events.some(e=>e.id==='a'||/MC80/.test(e.text)),'a warning event');assert.equal(r.a.order.heat,'balance','the order returns to balanced');
 assert.ok(r.peak>=C.HEAT.fullWarnAt,'it ran until the warning level: '+r.peak);assert.equal(r.a.out,null);
});
test('a ship with enough cooling is not held back in either mode',()=>{
 for(const m of ['balance','full']){const r=duel(2*combatScale(),m,40);assert.equal(r.a.heatGov.weapon,1,m);assert.equal(r.a.heatGov.engine,1,m);assert.equal(r.events.length,0,m);}
});
// 2026-11-15, user decisions「自動全力運転は外す」「排熱は被弾とも釣り合う」. The fourth case stated automatic full running
// (a ship left to itself ran full while it had a target); it now states the opposite, and a fifth case checks that
// the heat of hits is part of what balanced running balances.
test('a ship left to itself runs balanced: full running only on an order',()=>{
 const r=duel(1,null,20);assert.equal(r.a.order.heat,undefined);assert.equal(C.heatRunMode(r.a),'balance');assert.equal(r.events.length,0);
 assert.equal(C.heatRunMode({order:{},manual:true}),'balance');assert.equal(C.heatRunMode({order:{heat:'full'}}),'full');assert.equal(C.heatRunMode({order:{heat:'full'},manual:true}),'full');
});
test('balanced running counts the heat of hits: a ship taking hits holds back further than its own heat alone asks',()=>{
 // 2026-11-16 PR #112: cooling scaled from the duel's combat heat as in the first case; at a fixed .7 of the cruise-sized
 // converters the ship held runK near 0 with or without hits, so the comparison measured nothing.
 // 2026-11-18 (HEAT.waste.weapon .25 → .05, docs/weapon-heat-share.md): the case compared runK after 10 s and passed on
 // 69dc4aa only because the ship with hits had blacked out by then (電源喪失 at 3.75 s, runK reset to 0); before that its
 // runK rose (0.30 → 0.49 → 1.0 against 0.37 without hits), because the hits are held back through the weapon charge's
 // heat budget (the store's room and the allowance less hitW), not through runK. With the lower weapon heat the ship
 // lasts the 10 s and the accident no longer passes. The case now compares what is held back: the mean weapon charging
 // input over the 10 s, with and without the same hits.
 const sc=.7*combatScale();
 const prof=()=>{const p=JSON.parse(JSON.stringify(F.designs.mc80liberty.p));for(const d of p.heat.dis)d.cap*=sc;return p;};
 const charge=hits=>{const a=C.fleetUnit('a','mc80liberty',prof(),0),b=C.fleetUnit('b','mc80liberty',prof(),1);b.pos=[30000,0,0];b.yaw=Math.PI;
  a.order={...a.order,type:'attack',target:'b',fire:true,heat:'balance'};b.order={...b.order,type:'attack',target:'a',fire:true,heat:'balance'};
  const B=C.fleetBattle([a,b],true);B.seed=7;const cap=()=>a.ht.cap||1;let sum=0,n=0;
  for(let t=0;t<10;t+=.25){C.fleetTick(B,.25,{});if(hits)C.shipHeatAdd(a,cap()*.3*.25);/* hits put in a further 30% of the rejection */sum+=(a.pw?.wpn||0)/a.p.grid.P;n++;}
  return sum/n;};
 const own=charge(false),hit=charge(true);
 assert.ok(own>.1,'the ship charges its guns without hits: '+own);assert.ok(hit<own*.8,`weapon charging with hits ${hit} against ${own} without (share of the plant)`);
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
