const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx),plain=x=>JSON.parse(JSON.stringify(x)),near=(a,b,e=1e-10)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(b))*e,`${a} != ${b}`),ctx={time:0,damage:1,rand:()=>.9,ev(){},sunk(){},out(){}};
function source(kind='sbeam'){
 const modules=[{k:'reactor',part:1,size:100,share:1,at:.5,domain:'main'},...['left','right'].map((name,i)=>({k:'superweapon',name,part:101+i,size:1,share:.5,at:.8,domain:'main',powerConnected:true}))],sw=[0,1].map(i=>({id:101+i,k:kind,aim:kind==='sbeam'?'bow':i?'stbd':'port',axis:kind==='sbeam'?[1,0,0]:[0,0,i?1:-1],mz:kind==='sbeam'?[10,0,i?5:-5]:[0,0,i?20:-20],Emax:kind==='sbeam'?125000:i?2000:1000,d:kind==='sbeam'?38.2:100,chargeT:100,chargeW:1e22,efficiency:.88,initialCharge:1,r:1,rk:'gen',Pshare:1,mod:i+1}));
 const p={profileVersion:C.FLEET_PROFILE_VERSION,name:'Paid superweapon source',hp:1e6,len:100,width:40,height:20,D:0,shieldBuffer:0,wCap:0,crewNeed:0,crewMax:0,maxSpeed:1000,accel:100,turnRate:.1,modules,sw,energyModel:{version:1,eta:.75},grid:{P:3.6e24,Pgen:3.6e24,fixed:0,cooling:0,De:0,Ds:0,Dw:0,domains:[{id:'main',P:3.6e24,modules:[0,1,2]}]}};
 const u=C.fleetUnit('source','source',p);u.pos=[0,0,0];u.team=0;u.yaw=0;return u;
}
function target(id,pos,team=1){const p={name:id,hp:1e12,len:1000,width:200,height:200,D:0,shieldBuffer:0,wCap:0,crewNeed:0,crewMax:0,maxSpeed:0,accel:0,turnRate:0,modules:[],grid:{P:0,fixed:0,De:0,Ds:0,Dw:0}};const u=C.fleetUnit(id,id,p);u.pos=pos.slice();u.team=team;return u;}
function step(u,dt,all=[],extra={}){const records=new Map(all.filter(t=>t!==u).map(t=>[t.id,C.combatIncoming()])),shots=C.superweaponStep(u,dt,{foes:all.filter(t=>t.team!==u.team),all,bolts:[],ctx,damage:1,inc:id=>records.get(id),...extra});return {shots,records};}
function conserved(u){const l=u.weaponLedger;near(l.initialJ+l.inputJ,l.storedJ+l.emittedJ+l.lossJ+l.releasedJ);}

test('two real 125 PT emitters deliver exactly 250 PT over ten seconds, with no extra pulse or free energy',()=>{
 assert.equal(C.SW_COMBAT.sbeam.E,125000);assert.equal(C.SW_COMBAT.sbeam.beamT,10);assert.equal(C.SW_COMBAT.sbeam.cone,0);
 const u=source(),t=target('on-axis',[10000,0,0]);assert.equal(C.superweaponCommand(u,null).queued,2);const emitted=[0,0];
 for(let i=0;i<40;i++){const r=step(u,.25,[u,t]);assert.equal(r.shots.length,2);for(const sh of r.shots){assert.equal(sh.mode,'beam');near(sh.dur,.25);emitted[sh.i]+=sh.energyTT;}conserved(u);}
 emitted.forEach(E=>near(E,125000));near(u.weaponLedger.emittedJ,250000*C.TT);near(u.weaponLedger.storedJ,0);near(u.weaponLedger.releasedJ,0);assert.ok(u.sw.every(x=>x.st==='cool'));assert.equal(step(u,.25,[u,t]).shots.length,0);
});

test('a target inside the old aiming cone at maximum range is missed by a fixed-axis laser, even when explicitly named',()=>{
 const u=source(),t=target('off-axis',[199000,0,5000]);const command=C.superweaponCommand(u,{indexes:[0]},{to:[t.id],dir:[199000,0,5000]});assert.equal(command.queued,1);
 const {shots,records}=step(u,1,[u,t]);assert.equal(shots.length,1);assert.deepEqual(plain(shots[0].axis),[1,0,0]);assert.deepEqual(plain(shots[0].to),[]);near(shots[0].distance,200000);near(shots[0].energyTT,12500);assert.equal(records.get(t.id).sf,0);assert.equal(u.sw[1].st,'ready');near(u.sw[1].storedJ,125000*C.TT);conserved(u);
});

test('the beam continues into empty space and follows only an actual ship rotation, never the old target',()=>{
 const u=source(),t=target('moving',[10000,0,0]);C.superweaponCommand(u,{indexes:[0]});let r=step(u,.5,[u,t]);assert.deepEqual(plain(r.shots[0].to),[t.id]);
 t.pos=[10000,0,5000];r=step(u,.5,[u,t]);assert.deepEqual(plain(r.shots[0].to),[]);assert.deepEqual(plain(r.shots[0].axis),[1,0,0]);assert.equal(u.sw[0].st,'beam');
 u.yaw=Math.PI/2;t.pos=[0,0,10000];r=step(u,.5,[u,t]);assert.deepEqual(plain(r.shots[0].to),[t.id]);near(r.shots[0].axis[0],0);near(r.shots[0].axis[2],1);near(u.weaponLedger.emittedJ,18750*C.TT);conserved(u);
});

test('the nearest physical hull blocks the laser, including a friendly hull, while warped and rearward hulls do not',()=>{
 const u=source(),foe=target('enemy',[10000,0,0]),friend=target('friend',[2000,0,0],0),warp=target('warp',[1000,0,0]);warp.warp=true;const back=target('rear',[-1000,0,0]);
 C.superweaponCommand(u,{indexes:[0]});const r=step(u,.5,[u,foe,warp,back,friend]);assert.deepEqual(plain(r.shots[0].to),[friend.id]);assert.ok(r.records.get(friend.id).hull>0);assert.equal(r.records.get(foe.id).sf,0);near(r.shots[0].at[0],1500);conserved(u);
 const auto=source();const none=step(auto,.25,[auto,foe,friend]);assert.equal(none.shots.length,0,'automatic fire does not knowingly shoot a friendly blocker');assert.ok(auto.sw.every(x=>x.st==='ready'));
});

test('a real retained surface gap is not filled by a broad hull box for beam hits',()=>{
 const u=source(),t=target('split target',[10000,0,0]);const rectangle=(z0,z1)=>[-50,-100,z0,-50,100,z0,-50,100,z1,-50,-100,z0,-50,100,z1,-50,-100,z1];t.p.surface={shell:[...rectangle(-100,-20),...rectangle(20,100)]};
 assert.equal(C.swBeamTrace(u,u.p.sw[0],[t]).hit,null);u.pos[2]=-50;const hit=C.swBeamTrace(u,u.p.sw[0],[t]);assert.equal(hit.hit,t);near(hit.point[0],9950);near(hit.localPoint[2],-55);
});

test('the manual flight attitude supplies the actual pitched axis and muzzle and is ignored after leaving manual flight',()=>{
 const u=source();u.manual=true;u.swFrame={origin:[10,20,30],axes:[[0,1,0],[-1,0,0],[0,0,1]]};const t=target('above',[10,10000,25]);
 assert.deepEqual(plain(C.swAxis(u,u.p.sw[0])),[0,1,0]);assert.deepEqual(plain(C.swMuzzle(u,u.p.sw[0])),[10,30,25]);C.superweaponCommand(u,{indexes:[0]});const r=step(u,.5,[u,t]);assert.deepEqual(plain(r.shots[0].to),[t.id]);near(r.shots[0].at[1],9900);
 u.manual=false;assert.deepEqual(plain(C.swAxis(u,u.p.sw[0])),[1,0,0]);assert.deepEqual(plain(C.swMuzzle(u,u.p.sw[0])),[10,0,-5]);
});

test('selected Subjugator emitters discharge independently on an RTS ship without changing its navigation mode',()=>{
 const u=source('hion');u.order={type:'move',point:[1000,0,0],sw:false};const beforeOrder=plain(u.order);const a=C.superweaponCommand(u,{ids:[101]},{free:true,dir:[0,0,-1]});assert.equal(a.queued,1);assert.notEqual(u.manual,true);assert.deepEqual(plain(u.order),beforeOrder);
 let r=step(u,0,[u]);assert.equal(r.shots.length,1);assert.equal(r.shots[0].i,0);assert.equal(u.sw[0].st,'cool');assert.equal(u.sw[1].st,'ready');near(u.sw[1].c,1);near(u.sw[1].storedJ,2000*C.TT);near(u.weaponLedger.emittedJ,1000*C.TT);conserved(u);
 C.superweaponCommand(u,{ids:[102]},{free:true,dir:[0,0,1]});r=step(u,0,[u]);assert.equal(r.shots.length,1);assert.equal(r.shots[0].i,1);near(u.weaponLedger.emittedJ,3000*C.TT);near(u.weaponLedger.storedJ,0);near(C.swChargeRate(u,0),.3);near(C.swChargeRate(u,1),.3);near(C.swPower(u),.3);conserved(u);
});

test('per-emitter automatic mode can enable just one ion cannon while the other remains ready and charged',()=>{
 const u=source('hion'),t=target('starboard foe',[0,0,1000]);C.superweaponSetAuto(u,null,false);C.superweaponSetAuto(u,{ids:[102]},true);const r=step(u,0,[u,t]);assert.equal(r.shots.length,1);assert.equal(r.shots[0].i,1);assert.equal(u.sw[0].st,'ready');near(u.sw[0].storedJ,1000*C.TT);near(u.sw[0].c,1);conserved(u);
});

test('finish-only battle tails complete an already started ten-second beam without firing or charging its peer',()=>{
 const u=source(),t=target('last enemy',[10000,0,0]);C.superweaponCommand(u,{indexes:[0]});step(u,1,[u,t]);t.dead=true;u.sw[1].hold=false;
 for(let n=0;n<9;n++){const r=step(u,1,[u,t],{finishBeamsOnly:true});assert.equal(r.shots.length,1);assert.equal(r.shots[0].i,0);assert.deepEqual(plain(r.shots[0].to),[]);}
 near(u.weaponLedger.emittedJ,125000*C.TT);assert.equal(u.sw[0].st,'cool');assert.equal(u.sw[1].st,'ready');near(u.sw[1].storedJ,125000*C.TT);conserved(u);
});

test('a pre-existing smaller stored charge never becomes new joules when the beam rating changes',()=>{
 const u=source();u.sw[0].storedJ=50000*C.TT;C.superweaponCommand(u,{indexes:[0]});let emitted=0;for(let i=0;i<10;i++)for(const sh of step(u,1,[u]).shots)emitted+=sh.energyTT;
 near(emitted,50000);near(u.weaponLedger.emittedJ,50000*C.TT);near(u.sw[1].storedJ,125000*C.TT);conserved(u);
});

function worldBeam({result=false,peerCharge=false}={}){
 const R=vm.runInContext('Rts',cx),w=R.createWorld({seed:91,mode:'test',sensors:false,sides:[{faction:'empire',ai:false},{faction:'rebel',ai:false}],fleets:[]}),u=R.makeUnit(w,0,{key:'beam-test',p:source().p,info:{mass:100,crew:0}},'Beam source',null);
 u.sys=0;u.pos=[0,0,0];u.yaw=0;u.order={type:'hold',fire:false,sw:false};u.maneuver=0;
 if(peerCharge){u.sw[1].st='charge';u.sw[1].c=.25;u.sw[1].storedJ=31250*C.TT;}
 C.superweaponCommand(u,{indexes:[0]});step(u,1,[u]);if(result)w.result={winner:0,time:0,reason:'test'};
 return {R,w,u};
}

test('the RTS result clock finishes the physical laser without moving ships, charging peers, or reopening the battle',()=>{
 const {R,w,u}=worldBeam({result:true,peerCharge:true}),result=w.result,position=plain(u.pos),other=plain(u.sw[1]);assert.equal(R.step(w,9),36);
 assert.equal(w.result,result);assert.deepEqual(plain(u.pos),position);assert.deepEqual(plain(u.sw[1]),other);assert.equal(u.sw[0].st,'cool');near(u.weaponLedger.emittedJ,125000*C.TT);near(u.sw[1].storedJ,other.storedJ);near(w.time,9);assert.equal(w.swShots.length,36);assert.ok(w.swShots.every(sh=>sh.i===0&&sh.mode==='beam'));assert.equal(R.step(w,1),0);conserved(u);
});

test('an RTS beam continues after its local battle closes and still hits the nearest physical hull',()=>{
 const {R,w,u}=worldBeam(),t=R.makeUnit(w,0,{key:'friendly-test',p:target('friendly',[0,0,0],0).p,info:{mass:100,crew:0}},'Friendly obstruction',null);t.sys=0;t.pos=[10000,0,0];t.order={type:'hold',fire:false};t.maneuver=0;
 const initial=t.hp;assert.equal(R.step(w,9),36);assert.equal(w.result,null);assert.equal(w.battles.size,0);assert.equal(u.sw[0].st,'cool');assert.equal(u.sw[1].st,'ready');near(u.weaponLedger.emittedJ,125000*C.TT);assert.equal(w.swShots.length,36);assert.ok(w.swShots.every(sh=>sh.to.length===1&&sh.to[0]===t.id));assert.ok(t.hp<initial,'quiet-system hull receives the continuing laser');conserved(u);
});
