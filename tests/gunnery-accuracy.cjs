const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const {C,R,D}=vm.runInContext('({C:Core,R:Rts,D:YardFleetData.designs})',cx),copy=x=>JSON.parse(JSON.stringify(x)),near=(a,b,e=1e-9)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
const reference=()=>({...C.GUN_ACCURACY.reference,fireControl:true,modules:[]}),source=p=>({p:p||reference(),pos:[0,0,0],yaw:Math.PI/2}),target=(d=40000,scale=1)=>({p:Object.fromEntries(Object.entries(reference()).map(([k,v])=>[k,['len','width','height'].includes(k)?v*scale:v])),pos:[0,0,d],yaw:0});
function seeded(seed=77){return ()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};}
function rayHitsHull(direction,t,maxRange){
 const semi=[t.p.len/2,t.p.height/2,t.p.width/2],origin=t.pos.map(v=>-v);let a=0,b=0,c=-1;
 for(let i=0;i<3;i++){const x=origin[i]/semi[i],v=direction[i]/semi[i];a+=v*v;b+=2*x*v;c+=x*x;}
 const disc=b*b-4*a*c;if(disc<0)return false;const t0=(-b-Math.sqrt(disc))/(2*a);return t0>=0&&t0<=maxRange;
}
function profile(){const p=copy(D.imperial.p);Object.assign(p,reference(),{name:'Accuracy fixture',hp:1e9,D:0,shieldBuffer:0,reserve:0,accel:0,maxSpeed:0,turnRate:0,gunArcs:Array(6).fill(100),ionArcs:Array(6).fill(0),gunBands:{long:Array(6).fill(100),mid:Array(6).fill(0),close:Array(6).fill(0)},aaArcs:Array(6).fill(0),gunBest:100,gunMean:100,gunRateBest:100,gunRateMean:100,ionBest:0,ionMean:0,aa:0,msl:0,imsl:0,slots:0,embarkedSlots:0,aviationSize:0,launch:0,crewNeed:0,crewMax:0,autoCrew:0,wCap:1000,energyModel:{version:0},grid:{P:C.TT*10000,fixed:0,De:0,Ds:0,Dw:C.TT*100}});for(const k of ['hf','outline','heat','sw','mouths','surface','propulsion'])delete p[k];return p;}

test('normal fire control lands half its fire on a broadside ISD at each nominal battery maximum',()=>{
 for(const band of Object.values(C.GUN_BANDS)){const u=source(),t=target(band.range);near(C.gunHitChance(u,t,band.range,band.range),.5);}
 const measured=target();Object.assign(measured.p,{len:1589.3999996185303,width:868.4000244140625,height:444.016999});assert.ok(Math.abs(C.gunHitChance(source(),measured,40000)-.5)<.003);
});

test('range, projected target size and aspect affect real hit probability, with a hard nominal range limit',()=>{
 const u=source(),max=C.gunHitChance(u,target(),40000);assert.ok(C.gunHitChance(u,target(20000),20000)>.85);assert.ok(C.gunHitChance(u,target(5000),5000)>.999);assert.ok(C.gunHitChance(u,target(40000,.5),40000)<max);assert.ok(C.gunHitChance(u,target(40000,2),40000)>max);
 const bow=target();bow.yaw=Math.PI/2;assert.ok(C.gunHitChance(u,bow,40000)<max);assert.equal(C.gunHitChance(u,target(40001),40001),0);
});

test('absent, damaged or unpowered fire control and poorer sensor quality broaden the same scatter',()=>{
 const t=target(),p=reference(),full=C.gunHitChance(source(p),t,40000),absent=C.gunHitChance(source({...p,fireControl:false}),t,40000),damaged=C.gunHitChance(source(p),t,40000,40000,.2);
 assert.ok(absent<.16&&absent>.13);assert.ok(damaged>absent&&damaged<full);near(C.gunHitChance(source(p),t,40000,40000,0),absent);
 assert.ok(C.gunHitChance(source({...p,acc:p.acc*.6}),t,40000)<full);const legacy={...p,modules:[{k:'fire',share:1,size:10}]};delete legacy.fireControl;const u=source(legacy);u.mods=[1];near(C.gunHitChance(u,t,40000),full);u.mods=[0];near(C.gunHitChance(u,t,40000),absent);
});

test('actual craft targeting capacity counts as installed control without applying its existing fireK twice',()=>{
 const t=target(),p=reference(),fireK=.8,equivalent={...p,acc:p.acc*fireK},craft={...equivalent,fireControl:false,systems:{v:1,managed:true,targetCapacity:2,targetDemand:4,targetRatio:.5,fireK}};
 near(C.gunHitChance(source(craft),t,40000),C.gunHitChance(source(equivalent),t,40000));
 const missing={...craft,systems:{...craft.systems,targetCapacity:0,targetRatio:0}};assert.ok(C.gunHitChance(source(missing),t,40000)<C.gunHitChance(source(craft),t,40000));
});

test('seeded physical rays match the analytic hull probability without replacing collision checks with hit dice',()=>{
 const p=reference(),random=seeded(),t=target(),n=20000;let hits=0,sumY=0,sumX=0;
 for(let i=0;i<n;i++){const d=C.gunScatter([0,0,1],p,40000,1,random);near(C.len(d),1,1e-12);sumX+=d[0];sumY+=d[1];if(rayHitsHull(d,t,40000))hits++;}
 assert.ok(Math.abs(hits/n-.5)<.015,`${hits}/${n}`);assert.ok(Math.abs(sumX/n)<.0002&&Math.abs(sumY/n)<.0002,'scatter remains centered on the mechanical barrel direction');
});

test('mixed battery bands retain their raw fire and power demand while weighting their own physical accuracy',()=>{
 const p=profile();p.gunBands.mid.fill(40);p.gunBands.close.fill(20);p.ionArcs.fill(30);const u=source(p),t=target(9000),F=C.fleetFire(u,t,9000),a=range=>C.gunHitChance(u,t,9000,range);
 near(F.gun,160);near(F.ion,30);near(F.gunHit,(100*a(40000)+40*a(22000)+20*a(9000))/160);near(F.ionHit,a(40000));near(F.fall,(F.gun*F.gunHit+F.ion*F.ionHit)/190);near(F.cost,100*C.COMBAT.bandCost.long+40*C.COMBAT.bandCost.mid+20*C.COMBAT.bandCost.close+30);
});

test('surface mounts share the same accuracy and retain their physical firing arcs',()=>{
 const p=profile();p.surface={mounts:[{id:1,module:-1,band:'long',center:[0,0,0],muzzle:[0,0,0],arcs:Array(6).fill(1),gun:100,ion:0,capacity:100,power:100*C.TT,boltTT:1,crewNeed:0}],patches:[],shell:[]};const u=C.fleetUnit('surface','own',p,0),t=target();u.pos=[0,0,0];u.yaw=0;const F=C.surfaceFleetFire(u,t,40000);near(F.gun,100);near(F.gunHit,.5);assert.equal(F.runtime,true);
 p.surface.mounts[0].fixed=true;p.surface.mounts[0].dir=[-1,0,0];near(C.surfaceFleetFire(u,t,40000).gun,0);
});

test('the production tactical and strategic fleet clocks apply the shared 50% law once',()=>{
 const p=profile(),a=C.fleetUnit('own','own',p,0),b=C.fleetUnit('foe','foe',copy(p),1);Object.assign(a,{pos:[0,0,0],yaw:Math.PI/2,order:{type:'hold',fire:true,power:'balanced',aim:'auto',volley:'stream'}});Object.assign(b,{pos:[0,0,40000],yaw:0,manual:true});const battle=C.fleetBattle([a,b],true),shots=C.fleetTick(battle,.25,{collide:false});near(shots.find(s=>s.from===a.id).gun,100*.25*.5,1e-6);
 const w=R.createWorld({region:'kuat',seed:13,sensors:false,designs:[{key:'own',name:'Own',p,info:{capital:false,sensor:1}},{key:'foe',name:'Foe',p:copy(p),info:{capital:false,sensor:1}}],sides:[{faction:'rebel',ai:false},{faction:'empire',ai:false}],fleets:[[{design:'own',air:[],ground:[],troops:0}],[{design:'foe',air:[],ground:[],troops:0}]]}),units=[...w.units.values()],sys=units[0].sys;for(const g of w.groups.values()){g.sys=sys;g.inbound=null;g.order={type:'hold'};}
 for(const [i,u]of units.entries())Object.assign(u,{sys,pos:[0,0,i*40000],yaw:i?0:Math.PI/2,velocity:[0,0,0],warp:null,jump:null,manual:!!i,order:{type:'hold',fire:true,power:'balanced',aim:'auto',volley:'stream'}});R.tick(w,.25);near(units[0].lastShot.gun,100*.25*.5,1e-6);
});
