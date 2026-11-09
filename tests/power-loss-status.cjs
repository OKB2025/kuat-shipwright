const assert=require('node:assert/strict'),{test}=require('node:test');
const {C,P,near,plain,unit,allocate}=require('./helpers/global-energy-runtime.cjs');
C.HEAT.qAllowJPerKg=1e20;
const main=status=>status.domains.find(d=>d.id==='main');

test('power diagnostics report exhausted physical fuel as unavailable while retaining installed ratings',()=>{
 const u=unit(),fuel=C.shipFuelState(u);fuel.fuelEnergyJ=fuel.capacityJ;const status=C.powerStatus(u);near(C.shipElectricalAvailableW(u),0);near(status.available,0);assert.equal(status.blackout,true);near(main(status).rated,P);near(main(status).available,0);assert.equal(main(status).state,'給電停止');
});
test('power diagnostics use thermal output exactly once and recover with the existing retained ceiling',()=>{
 const u=unit();C.shipHeatAdd(u,C.shipHeatCapacity(u));let status=C.powerStatus(u);near(status.available,0);assert.equal(status.blackout,true);near(main(status).available,0);u.ht.qJ=.8*u.ht.capacityJ;C.powerTick(u,300);status=C.powerStatus(u);near(status.available,.6);near(main(status).available,.6*P);near(main(status).rated,P);assert.equal(status.blackout,false);
});
test('power diagnostics follow actual surviving source damage instead of nominal plant output',()=>{
 const u=unit();u.mods[0]=.5;let status=C.powerStatus(u);near(status.available,.5);near(main(status).available,.5*P);u.mods[0]=0;status=C.powerStatus(u);near(status.available,0);assert.equal(status.blackout,true);near(main(status).rated,P);assert.equal(main(status).state,'給電停止');
});
test('independent solar generation remains visible with exhausted reactor fuel and retains each domain rating',()=>{
 const u=unit();u.p.modules.push({k:'dissipator',part:7,port:'p7',domain:'solar',share:1,size:1,powerConnected:true});u.mods.push(1);u.p.grid.P=1.25*P;u.p.grid.domains.push({id:'solar',P:.25*P,sources:[{moduleIndex:6,P:.25*P}],modules:[6]});const fuel=C.shipFuelState(u);fuel.fuelEnergyJ=fuel.capacityJ;let status=C.powerStatus(u),solar=status.domains.find(d=>d.id==='solar');near(C.shipElectricalAvailableW(u),.25*P);near(status.available,.2);assert.equal(status.blackout,false);near(main(status).rated,P);near(main(status).available,0);assert.equal(main(status).state,'給電停止');near(solar.rated,.25*P);near(solar.available,.25*P);assert.equal(solar.state,'給電中');u.gridState={domains:{solar:{trip:10}},local:{}};status=C.powerStatus(u);near(status.available,0);assert.equal(status.blackout,true);assert.equal(status.domains.find(d=>d.id==='solar').state,'イオン遮断');
});
test('superweapon source reservations do not appear as a power outage or change diagnostic query allocation',()=>{
 const u=unit();u.p.sw=[{k:'sbeam',r:1,rk:'gen',mod:5,chargeW:P,Pshare:1}];u.sw=[{st:'charge',c:0}];allocate(u,{},0);near(u.pw.P,0);const before=plain(u.pw),status=C.powerStatus(u);near(status.available,1);near(main(status).available,P);assert.equal(status.blackout,false);assert.deepEqual(plain(u.pw),before);
});
test('unknown legacy budgets preserve their previous diagnostic fallback',()=>{
 const unknown={p:{modules:[]}};assert.equal(C.shipElectricalAvailableW(unknown),null);const status=C.powerStatus(unknown);near(status.available,1);assert.equal(status.blackout,false);const empty={p:{modules:[],grid:{}}};assert.equal(C.shipElectricalAvailableW(empty),null);const oldEmpty=C.powerStatus(empty);near(oldEmpty.available,0);assert.equal(oldEmpty.blackout,true);
});
