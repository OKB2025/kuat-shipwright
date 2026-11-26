// The ion rule of 2026-11-26 (user decisions 2026-11-25/26; docs/handoff-2026-11-25/next-pr-decisions-2026-11-26.md chapter 2):
// ion spreads from where it lands and is shared; denser parts turn more of it to heat; a part that takes power holds what is left
// against its allowance (53 kt x (feed / the twin point-defence mount's feed)^0.4) and stops for 30 s x (1 + the share over);
// what is held goes to heat at 20 kt/s; a craft's ion gun fires what its compartment gathers in a second.
const path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'));
const KT=C.ION_KT,near=(a,b,rel,msg)=>assert.ok(Math.abs(a-b)<=Math.abs(b)*rel+1e-9,msg+': '+a+' vs '+b);
const PD=C.FITS.pd.power;
function unit(mods){const modules=[...mods,{k:'hull',name:'hull',w:1,size:1,share:1}];const u={p:{len:1000,width:200,height:100,mass:1e6,modules},mods:modules.map(()=>1),secLost:[],secOf:modules.map(()=>0),dead:false};return u;}
const ctx=(time=0,r=.5)=>({time,rand:()=>r,events:[],ev(u,t){this.events.push(t);}});
const gun=(name,at,W,dens)=>({k:'weapon',name,w:1,size:1,at,y:0,z:0,weaponPowerW:W,...(dens?{dens}:{})});

test('the figures',()=>{const R=C.ION_RULE;assert.equal(R.allowKt,53);assert.equal(R.allowExp,.4);assert.equal(R.stopS,30);assert.equal(R.drainKtS,20);assert.equal(R.heatDens,.5);
 near(KT,C.TT*1e-9,1e-12,'a kiloton');near(C.ionRefW(),PD,1e-12,'the reference feed is the twin point-defence mount\'s');
 near(PD*.1*.1/KT,53,.01,'53 kt is a tenth of that mount\'s feed over 0.1 s');});

test('allowance: 53 kt x (feed / reference)^0.4; parts with no feed have none',()=>{
 near(C.ionAllowJ(gun('pd',.5,PD))/KT,53,1e-9,'the point-defence mount itself');
 near(C.ionAllowJ(gun('x',.5,PD*32))/KT,53*4,1e-9,'32 times the feed: 4 times the allowance');
 assert.equal(C.ionAllowJ({k:'reactor',name:'r',size:100}),Infinity);assert.equal(C.ionAllowJ({k:'hull',feedW:1e20}),Infinity);
 near(C.ionAllowJ({k:'sensor',feedW:PD})/KT,53,1e-9,'a part that is not a gun, by its feed');
 const htl=C.ionAllowJ(gun('htl',.5,C.FITS.htl.power))/KT;assert.ok(htl>20000&&htl<80000,'a 70 TT twin heavy turbolaser: tens of megatons ('+htl+' kt)');});

test('stop time: 30 s x (1 + the share over); 10% over is 33 s',()=>{near(C.ionStopSeconds(110,100),33,1e-12,'10% over');near(C.ionStopSeconds(200,100),60,1e-12,'twice');assert.equal(C.ionStopSeconds(100,100),0);assert.equal(C.ionStopSeconds(50,100),0);});

test('denser parts turn more to heat: density / (density + 0.5)',()=>{near(C.ionHeatShare({k:'x',dens:.5}),.5,1e-12,'0.5 t/m3: half');near(C.ionHeatShare({k:'x',dens:1.5}),.75,1e-12,'1.5 t/m3');assert.ok(C.ionHeatShare({k:'weapon'})>C.ionHeatShare({k:'quarters'}));});

test('a hit is shared (the sum is the amount), the nearer part taking more; heat at once plus what is held equals the amount',()=>{
 const u=unit([gun('A',.10,PD*1e6,.5),gun('B',.12,PD*1e6,.5),gun('C',.90,PD*1e6,.5)]),E=1000*KT,c=ctx();
 const rec=C.ionOverloadJ(u,E,{i:0},c);
 near(rec.heatJ+rec.storedJ,E,1e-9,'nothing is made or lost');near(rec.heatJ,E/2,1e-9,'all three are 0.5 t/m3: half is heat at once');
 const J=u.ionSt.J;assert.ok(J[0]>J[1]&&J[1]>J[2],'A (hit) > B (20 m off) > C (800 m off): '+J.map(v=>v/KT));near(J[0]+J[1]+J[2],E/2,1e-9,'held');
 assert.equal(u.ionOff?.length||0,0,'far under these guns\' allowances: nothing stops');near(u.ionLedger.incomingJ,E,1e-12,'ledger');});

test('a point-defence mount stops with one craft ion shot; a main turret does not',()=>{
 const shot=C.craftIonShotTT(1)*C.TT;near(shot/KT,2593,.001,'a 1 m3 compartment: 2,593 kt a shot');
 const u=unit([gun('PD',.5,PD,2.2),gun('MAIN',.5,C.FITS.htl.power,2.2)]),c=ctx(100);C.ionOverloadJ(u,shot,{i:0},c);
 assert.equal(u.mods[0],0,'the point-defence mount is stopped');assert.equal(u.mods[1],1,'the heavy turret beside it is not');
 const held=u.ionSt.J[0],A=C.ionAllowJ(u.p.modules[0]),off=u.ionOff[0];near(off.until-100,30*(1+(held-A)/A),1e-9,'for 30 s x (1 + the share over)');assert.ok(c.events.some(t=>/PD イオンで停止/.test(t)));
 // it comes back as it was when its time is up
 C.ionRecover(u,ctx(off.until-1));assert.equal(u.mods[0],0);const c2=ctx(off.until+1);C.ionRecover(u,c2);assert.equal(u.mods[0],1);assert.ok(c2.events.some(t=>/PD 復旧/.test(t)));});

test('an ion torpedo stops a main turret',()=>{const E=C.airRound('itorp').tt*C.TT,u=unit([gun('MAIN',.5,C.FITS.htl.power,2.2)]);C.ionOverloadJ(u,E,{i:0},ctx());assert.equal(u.mods[0],0,'stopped ('+(E/KT)+' kt against '+(C.ionAllowJ(u.p.modules[0])/KT)+' kt)');});

test('more ion on a stopped part lengthens its stop and never shortens it',()=>{const u=unit([gun('PD',.5,PD,2.2)]);C.ionOverloadJ(u,300*KT,{i:0},ctx(0));const t1=u.ionOff[0].until;C.ionOverloadJ(u,300*KT,{i:0},ctx(1));assert.ok(u.ionOff[0].until>t1);assert.equal(u.ionOff.length,1);});

test('what is held goes to heat at 20 kt a second, one part after another in the order they were charged',()=>{
 const u=unit([gun('A',.1,PD*1e9,.5),gun('B',.9,PD*1e9,.5)]);C.ionOverloadJ(u,100*KT,{i:1},ctx());C.ionOverloadJ(u,100*KT,{i:0},ctx());
 assert.deepEqual(Array.from(u.ionSt.q.slice(0,2)).sort(),[0,1]);const first=u.ionSt.q[0],b0=u.ionSt.J[first],other=u.ionSt.q[1],o0=u.ionSt.J[other],held=C.ionHeldJ(u);
 const out=C.ionDrain(u,1,null);near(out,20*KT,1e-9,'20 kt in one second');near(u.ionSt.J[first],b0-20*KT,1e-9,'from the part charged first');near(u.ionSt.J[other],o0,1e-12,'the next waits');near(C.ionHeldJ(u),held-20*KT,1e-9,'held');
 let n=0;while(u.ionSt.q.length&&n++<1000)C.ionDrain(u,1,null);near(C.ionHeldJ(u),0,1,'all of it ends as heat');near(u.ionLedger.heatJ,200*KT,1e-6,'the ledger\'s heat is everything that arrived');});

test('a unit with no parts list takes it all as heat, as before',()=>{const u={p:{},mods:[]};const r=C.ionOverloadJ(u,5*KT,{},null);near(r.heatJ,5*KT,1e-12,'heat');assert.equal(r.scope,'heat');});

test('the craft ion gun: a fixed gun or a small turret with a charging compartment',()=>{
 near(C.craftIonShotTT(50),.00062*50,1e-12,'at the ships\' least the ships\' rule');near(C.craftIonShotTT(1),.00062*Math.pow(1/50,1.4),1e-12,'below it, (volume / 50)^1.4 of it a cubic metre');
 const laser=C.fitSpec({k:'claser',id:1,p:[0,0,0],boreM:.135,barrelM:2}),ion=C.fitSpec({k:'claser',id:1,p:[0,0,0],boreM:.135,barrelM:2,ionBoxM3:1}),tur=C.fitSpec({k:'cturret',id:2,p:[0,0,0],ionBoxM3:.5});
 assert.ok(laser.tt>0&&!laser.ion);assert.equal(ion.tt,0);near(ion.ion,C.craftIonShotTT(1),1e-12,'one shot = one second of the compartment');assert.equal(ion.cycle,1);assert.equal(ion.gunRule.kind,'ion');
 near(ion.mass-laser.mass,C.CRAFT_ION.boxDensity,1e-9,'the compartment\'s mass');near(ion.cost-laser.cost,C.CRAFT_ION.boxCostM3+C.CRAFT_ION.install,1e-9,'and price');assert.equal(ion.fm,laser.fm,'the gun keeps its body');
 near(tur.ion,C.craftIonShotTT(.5),1e-12,'the turret (SW-4 kind): the volley is what the compartment gathers');assert.equal(tur.tt,0);
 assert.equal(C.fitSpec({k:'claser',id:1,p:[0,0,0],ionBoxM3:99}).ionBoxM3,C.CRAFT_ION.maxBoxM3,'held to the largest compartment');});

test('the earlier ion effects are gone',()=>{for(const k of ['ION_ROUND','ionPowerLoss','ionPowerCut'])assert.equal(C[k],undefined,k);assert.equal(C.BLAST.ionOff,undefined);});

test('ion with no part named lands on the outside of the ship, and on the kind the fire was aimed at',()=>{
 const mk=()=>unit([{k:'reactor',name:'R',w:1e6,size:1e5,at:.5},gun('G',.2,PD*1e9),{k:'sensor',name:'S',w:1,size:10,at:.8,feedW:PD*1e9}]);
 for(const r of [.01,.5,.99]){const u=mk(),rec=C.ionOverloadJ(u,10*KT,{},ctx(0,r));assert.ok(u.ionSt.J[1]>u.ionSt.J[0]||u.ionSt.J[2]>u.ionSt.J[0],'not centred on the reactor inside, however large');}
 const u=mk();C.ionOverloadJ(u,10*KT,{aimKinds:{sensor:1}},ctx(0,.5));assert.ok(u.ionSt.J[2]>u.ionSt.J[1],'aimed at sensors: the sensor holds the most');
 const v=mk();C.ionOverloadJ(v,10*KT,{aimKinds:{weapon:1}},ctx(0,.5));assert.ok(v.ionSt.J[1]>v.ionSt.J[2],'aimed at guns: the gun holds the most');
});
