const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});const C=vm.runInContext('Core',cx);
const near=(a,b,msg='')=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(b))*1e-10,`${msg}: ${a} != ${b}`);
const source=(id='reactor',powerW=100,domain='main')=>({id,powerW,maxPowerW:powerW,domain});
const engine=(id,allocationWeight=1,requestedInputW=100,domain='main')=>({id,kind:'engines',port:id,allocationWeight,requestedInputW,domain});
const load=(id,kind,requestedInputW,domain='main')=>({id,kind,port:id,requestedInputW,domain});
const link=(from,to,cap=100,efficiency=1,extra={})=>({from,to,cap,efficiency,...extra});
function conserved(p){near(p.draw,p.delivered+p.feedLossW,'sent watts equal delivered plus losses');near(p.draw,p.sources.reduce((n,s)=>n+s.drawW,0));for(const b of p.engineBudgets||[]){assert.ok(b.drawW<=b.limitW+1e-9);near(b.drawW+b.remainingW,b.limitW);const sent=p.consumers.filter(c=>c.kind==='engines').reduce((n,c)=>n+(p.sourceFunding[c.id]?.[b.sourceId]||0),0);near(sent,b.drawW);}}

test('four engines share a single25percent source budget and full throttle can use the same complete reactor once',()=>{
 const loads=[1,2,3,4].map(id=>engine('engine'+id));for(const [fraction,want]of [[.25,25],[1,100],[0,0]]){const p=C.allocateConnectedPower({sources:[source()],loads,engineBudgetFraction:fraction});near(p.engines,want);for(const e of loads)near(p.granted[e.id],want/4);near(p.engineBudgets[0].drawW,want);conserved(p);}
});
test('physical owner weights split a common source and a request cap releases the unused share',()=>{
 const weighted=C.allocateConnectedPower({sources:[source()],loads:[engine('large',9),engine('small',1)],engineBudgetFraction:1});near(weighted.granted.large,90);near(weighted.granted.small,10);conserved(weighted);
 const capped=C.allocateConnectedPower({sources:[source()],loads:[engine('large',9,10),engine('small',1)],engineBudgetFraction:1});near(capped.granted.large,10);near(capped.granted.small,90);conserved(capped);
});
test('a blocked owner leaves all reachable source watts available to a healthy owner',()=>{
 const p=C.allocateConnectedPower({sources:[source()],loads:[engine('blocked',9),engine('healthy',1)],links:[link('reactor','blocked',0),link('reactor','healthy')],engineBudgetFraction:1});near(p.granted.blocked,0);near(p.granted.healthy,100);conserved(p);
});
test('a finite path cap waterfills the spare budget into the remaining engine instead of reserving its old share',()=>{
 const p=C.allocateConnectedPower({sources:[source()],loads:[engine('large',99),engine('small',1)],links:[link('reactor','large',5),link('reactor','small')],engineBudgetFraction:1});near(p.granted.large,5);near(p.granted.small,95);conserved(p);
});
test('isolated reactors retain separate throttle budgets and unrelated sources do not change a pool allocation',()=>{
 const sources=[source('a',80,'left'),source('b',120,'right'),source('unreachable',1e6,'other')],loads=[engine('a1',3,80,'left'),engine('a2',1,80,'left'),engine('b1',1,120,'right')],links=[link('a','a1',80),link('a','a2',80),link('b','b1',120)];
 const p=C.allocateConnectedPower({sources,loads,links,engineBudgetFraction:.25});near(p.granted.a1,15);near(p.granted.a2,5);near(p.granted.b1,30);near(p.engineBudgets[2].drawW,0);conserved(p);
});
test('feed losses consume the source engine budget in sent watts, with matching per-consumer heat',()=>{
 const p=C.allocateConnectedPower({sources:[source()],loads:[engine('engine')],links:[link('reactor','engine',100,.5)],engineBudgetFraction:.25});near(p.engines,12.5);near(p.feedLossW,12.5);near(p.draw,25);near(p.engineBudgets[0].drawW,25);near(p.sourceFunding.engine.reactor,25);near(p.edgeLosses[0].byConsumer.engine,12.5);conserved(p);
});
test('fixed loads and cooling run first and unused engine allocation remains available to other consumers',()=>{
 const loads=[load('hotel','fixed',10),load('cooler','cooling',20),engine('engine'),load('guns','weapons',100)],sources=[source()],links=loads.map(l=>link('reactor',l.port));
 const full=C.allocateConnectedPower({sources,loads,links,engineBudgetFraction:1});near(full.fixed,10);near(full.cooling,20);near(full.engines,70);near(full.weapons,0);conserved(full);
 const quarter=C.allocateConnectedPower({sources,loads,links,engineBudgetFraction:.25});near(quarter.fixed,10);near(quarter.cooling,20);near(quarter.engines,25);near(quarter.weapons,45);near(quarter.draw,100);conserved(quarter);
});
test('a shared trunk is consumed once by engines and cooling while source engine budgets remain distinct',()=>{
 const loads=[load('cooler','cooling',20),engine('e1'),engine('e2')],links=[link('reactor','trunk',60,1,{capacityGroup:'trunk',groupCap:60}),link('trunk','cooler'),link('trunk','e1'),link('trunk','e2')];
 const p=C.allocateConnectedPower({sources:[source()],loads,links,engineBudgetFraction:1});near(p.cooling,20);near(p.engines,40);near(p.draw,60);conserved(p);
});
test('the source budget follows its effective available output and zero or invalid throttle grants no engine power',()=>{
 const sources=[{...source(),maxPowerW:40}],loads=[engine('engine')];const half=C.allocateConnectedPower({sources,loads,engineBudgetFraction:.5});near(half.engineBudgets[0].limitW,20);near(half.engines,20);
 for(const engineBudgetFraction of [0,-1,NaN,Infinity]){const p=C.allocateConnectedPower({sources,loads,engineBudgetFraction});near(p.engines,0);conserved(p);}const high=C.allocateConnectedPower({sources,loads,engineBudgetFraction:2});near(high.engines,40);conserved(high);
});
test('the legacy allocator without an explicit engine budget retains its direct request behavior',()=>{
 const p=C.allocateConnectedPower({sources:[source()],loads:[load('first','engines',25),load('second','engines',75)]});near(p.engines,100);near(p.granted.first,25);near(p.granted.second,75);assert.equal(p.engineBudgets,undefined);conserved(p);
});
