const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const {C,R,D}=vm.runInContext('({C:Core,R:Rts,D:YardFleetData.designs})',cx),plain=x=>JSON.parse(JSON.stringify(x)),near=(a,b)=>assert.ok(Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(b)),`${a} vs ${b}`),finite=c=>assert.ok(Number.isFinite(c.err)&&c.est?.every(Number.isFinite),'a visible contact needs a finite estimate and uncertainty');
function unit(id,side=0,A={nu:1,ir:1,em:1,rad:1}){
 const p=plain(D.cr90.p);p.energyModel={version:1,eta:.75};p.modules=[{k:'reactor',part:1,domain:'main',size:1,share:1},{k:'sensor',part:2,domain:'main',size:1,share:1,powerConnected:true},{k:'engine',part:3,domain:'main',size:1,share:1,powerConnected:true}];p.grid={P:100*C.TT,fixed:0,Dw:0,Ds:0,De:0,domains:[{id:'main',P:100*C.TT,modules:[0,1,2]}]};p.sens={...A};p.heat={v:1,src:[],dis:[],ln:[]};
 const u=C.fleetUnit(id,id,p,side);u.side=side;u.sys=0;u.pos=[side?30000:0,0,0];u.order.emit='low';return u;
}
function scene(A={nu:1,ir:1,em:1,rad:1}){const o=unit('observer',0,A),t=unit('target',1,{nu:0,ir:0,em:0,rad:0});t.ht={band:{nu:1e24,ir:1e24,em:1e24}};const w={sensors:true,time:0,sides:[{id:0,ai:true,tc:new Map()}],units:new Map([[o.id,o],[t.id,t]])};return {w,o,t,scan(time){w.time=time;R.sensorTick(w,0,[o,t]);return w.sides[0].tc.get(t.id);}};}
function hold(s,seconds=30,dt=.25){const stages=[];for(let time=0;time<=seconds+1e-8;time+=dt){const c=s.scan(time);stages.push(c?.st||0);}return stages;}

test('fresh strict ships never invent thermal signatures from rated power or a size estimate',()=>{
 const u=unit('strict');assert.deepEqual(plain(R.unitSig(u)),{nu:0,ir:0,em:0});u.p.grid.P=0;assert.deepEqual(plain(R.unitSig(u)),{nu:0,ir:0,em:0});
 C.heatInit(u);assert.equal(u.ht.band,undefined);assert.deepEqual(plain(R.unitSig(u)),{nu:0,ir:0,em:0});
 const old=unit('legacy');delete old.p.energyModel;const sig=R.unitSig(old);assert.ok(sig.nu>0&&sig.ir>0&&sig.em>0,'old profiles retain their documented fallback until their heat state exists');
});

test('actual processed heat reaches each signature band once and idle capacity or foil deployment adds no heat',()=>{
 function solve(cap,deployed){const u=unit('flow-'+cap+'-'+deployed,0,{nu:0,ir:0,em:0,rad:0});u.order.emit='normal';u.p.foils=[{id:1,T:1,sec:-1}];u.fo={d:[deployed]};u.p.heat={v:1,src:[{k:'hotel',n:'electronics',g:'low',sh:1,st:1e6,m:[],pc:[],sec:-1,sw:-1,gen:-1}],dis:[{n:'sink',k:'hdis',g:'high',cap,m:-1,sec:-1,src:-1,fo:0,cs:.2,sh:0}],ln:[{s:0,d:0,cap:1e6,sec:-1}]};C.heatInit(u);u.ht.t=0;u.ht.e.hotel=100;C.heatTick({time:1},u,1);return u;}
 const stowed=solve(1000,0),open=solve(2000,1);near(stowed.ht.emit,100);near(open.ht.emit,100);assert.deepEqual(plain(R.unitSig(stowed)),plain(stowed.ht.band));assert.deepEqual(plain(R.unitSig(open)),plain(stowed.ht.band));
 const u=unit('idle');C.heatInit(u);C.heatTick({time:1},u,1);assert.deepEqual(plain(R.unitSig(u)),{nu:0,ir:0,em:0});
});

test('blackout removes active radar and stale exhaust while retaining real residual thermal bands',()=>{
 const u=unit('powered');u.order.emit='normal';u.ht={band:{nu:3,ir:5,em:7}};u.pw={eng:1e22};const on=R.unitSig(u);assert.ok(on.ir>5&&on.em>7);
 u.gridState={domains:{main:{trip:10}},local:{}};assert.equal(C.powerFactor(u,'reactor'),0);assert.deepEqual(plain(R.unitSig(u)),{nu:3,ir:5,em:7});
 delete u.ht.band;assert.deepEqual(plain(R.unitSig(u)),{nu:0,ir:0,em:0});
});

test('sensor bands keep inverse-square passive and inverse-fourth active range without detecting neutrinos by radar',()=>{
 const sig={nu:1e24,ir:1e24,em:1e24},A={nu:1,ir:1,em:1,rad:1},a=C.sensSNR(sig,1000,A,10000,1),b=C.sensSNR(sig,1000,A,20000,1);for(const k of ['nu','ir','em'])near(a[k]/b[k],4);near(a.rad/b.rad,16);
 const radar=C.sensSNR({nu:1e30,ir:0,em:0},0,{nu:0,ir:0,em:0,rad:1},1000,1);assert.deepEqual(plain(radar),{nu:0,ir:0,em:0,rad:0});assert.equal(C.sensStageCap({nu:1e20,ir:0,em:0,rad:0}),3);
});

test('real contact updates respect dwell and neutrino-only sensing never becomes identified or fire-control locked',()=>{
 const s=scene({nu:1,ir:0,em:0,rad:0}),stages=hold(s);assert.equal(stages[0],0);for(let i=1;i<stages.length;i++)assert.ok(stages[i]-stages[i-1]<=1);assert.equal(Math.max(...stages),3);const c=s.w.sides[0].tc.get(s.t.id);finite(c);assert.equal(R.contactStage(s.w,0,s.t),3);
 const all=scene(),seen=hold(all);assert.equal(Math.max(...seen),6);assert.ok(seen.indexOf(6)>.25,'a strong signal still takes several dwell stages');finite(all.w.sides[0].tc.get(all.t.id));
});

test('lost contacts coast at their last finite estimate, widen uncertainty and expire without following hidden motion',()=>{
 const s=scene();hold(s);let c=s.w.sides[0].tc.get(s.t.id);finite(c);const last=plain(c.est),error=c.err,at=s.w.time;
 s.o.gridState={domains:{main:{trip:100}},local:{}};s.t.ht.band={nu:0,ir:0,em:0};s.t.pos=[1e6,400,90000];
 c=s.scan(at+5);assert.ok(c);finite(c);assert.deepEqual(plain(c.est),last);assert.ok(c.err>error);const wider=c.err;c=s.scan(at+10);finite(c);assert.deepEqual(plain(c.est),last);assert.ok(c.err>=wider);assert.ok(Number.isFinite(c.dist));
 s.scan(at+C.SENS.ttl+5);assert.equal(s.w.sides[0].tc.has(s.t.id),false,'the finite coast is bounded by the existing contact TTL');assert.ok(R.searchOrder(s.w,0,s.o).point?.every(Number.isFinite)||R.searchOrder(s.w,0,s.o).type==='hold');
});

test('restored sensing reacquires a faded contact through the same stages with finite estimates',()=>{
 const s=scene();hold(s);const before=plain(s.w.sides[0].tc.get(s.t.id));s.t.ht.band={nu:0,ir:0,em:0};s.o.gridState={domains:{main:{trip:100}},local:{}};s.scan(36);const lost=s.scan(41);finite(lost);const stage=lost.st;
 C.powerTick(s.o,101);s.t.ht.band={nu:1e24,ir:1e24,em:1e24};s.t.pos=[45000,0,1000];const c=s.scan(46);finite(c);assert.ok(c.st<=stage+1);assert.notDeepEqual(plain(c.est),plain(before.est));for(let time=47;time<=75;time++)s.scan(time);assert.equal(s.w.sides[0].tc.get(s.t.id).st,6);
});

test('a remembered lock cannot launch tracked missiles or fire guns in the real RTS clock until a current fix returns',()=>{
 const p=plain(D.cr90.p);Object.assign(p,{len:200,width:80,height:60,hp:1e9,D:0,shieldBuffer:0,reserve:0,accel:0,maxSpeed:0,turnRate:.05,gunArcs:Array(6).fill(100),ionArcs:Array(6).fill(0),gunBands:{long:Array(6).fill(100),mid:Array(6).fill(0),close:Array(6).fill(0)},aaArcs:Array(6).fill(0),gunBest:100,gunMean:100,gunRateBest:100,gunRateMean:100,ionBest:0,ionMean:0,aa:0,msl:80,imsl:0,slots:0,embarkedSlots:0,aviationSize:0,launch:0,crewNeed:0,crewMax:0,autoCrew:0,wCap:1000,modules:[],grid:{P:C.TT*1000,fixed:0,De:0,Ds:0,Dw:C.TT*200},acc:1,sens:{nu:0,ir:0,em:0,rad:0}});for(const k of ['hf','outline','heat','sw','mouths'])delete p[k];
 const w=R.createWorld({region:'kuat',seed:13,sensors:true,designs:[{key:'gun',name:'Gunship',p,info:{capital:false,sensor:1}}],sides:[{faction:'rebel',ai:false},{faction:'empire',ai:false}],fleets:[[{design:'gun',air:[],ground:[],troops:0}],[{design:'gun',air:[],ground:[],troops:0}]]}),a=[...w.units.values()].find(u=>u.side===0),t=[...w.units.values()].find(u=>u.side===1),sys=a.sys;
 for(const g of w.groups.values()){g.sys=sys;g.inbound=null;g.order={type:'hold'};}for(const [u,x]of [[a,0],[t,12000]])Object.assign(u,{sys,pos:[x,0,0],velocity:[0,0,0],warp:null,jump:null,order:{type:'hold',fire:u===a,power:'balanced',aim:'auto',volley:'stream'}});t.manual=true;
 const c={id:t.id,sys,st:6,cap:6,observed:false,seen:w.time,at:w.time,since:w.time,next:999,snr:{nu:0,ir:0,em:0,rad:0},est:[12000,0,0],err:100,low:0};w.sides[0].tc=new Map([[t.id,c]]);
 assert.equal(R.contactStage(w,0,t),1);assert.equal(R.contactStage(w,0,a),6);R.tick(w,.25);assert.equal(a.lastShot,null);assert.equal(a.firingAt,null);assert.equal(w.missiles.length,0);assert.equal(c.st,6,'historical confidence is preserved separately');
 c.observed=true;c.cap=2;assert.equal(R.contactStage(w,0,t),2,'a weak current signal cannot inherit old fire control');c.cap=6;R.tick(w,.25);assert.ok(a.lastShot?.gun>0);assert.ok(w.missiles.some(m=>m.from===a.id),'the same hardware fires once current tracking returns');
 c.observed=false;w.sensors=false;assert.equal(R.contactStage(w,0,t),6,'sensor-free sandbox scenarios retain full visibility');
});

test('dead, departed, friendly or observerless contacts are removed rather than retained as enemy tracks',()=>{
 for(const change of [s=>{s.t.dead=true;},s=>{s.t.sys=1;},s=>{s.t.warp={t:0};},s=>{s.t.side=0;}]){const s=scene();hold(s);change(s);s.scan(40);assert.equal(s.w.sides[0].tc.has(s.t.id),false);}
 const s=scene();hold(s);s.w.time=40;R.sensorTick(s.w,0,[s.t]);assert.equal(s.w.sides[0].tc.size,0);
});

test('enumeration order and normal fixed-step choices preserve acquisition outcomes without touching combat randomness',()=>{
 function run(dt,reverse){const s=scene(),randomBefore=s.w.seed;s.w.rand=()=>assert.fail('sensor updates must not draw combat randomness');for(let time=0;time<=30+1e-8;time+=dt){s.w.time=time;R.sensorTick(s.w,0,reverse?[s.t,s.o]:[s.o,s.t]);}const c=s.w.sides[0].tc.get(s.t.id);finite(c);assert.equal(s.w.seed,randomBefore);return plain(c);}
 const a=run(.25,false),b=run(.5,true);assert.equal(a.st,6);assert.equal(b.st,6);near(a.err,b.err);assert.ok(a.est.every(Number.isFinite)&&b.est.every(Number.isFinite));
});

test('equal-distance observers use stable IDs at the observation budget boundary',()=>{
 function scan(reverse){const t=unit('target',1,{nu:0,ir:0,em:0,rad:0});t.ht={band:{nu:1e24,ir:0,em:0}};const obs=Array.from({length:C.SENS.maxObs+1},(_,i)=>{const o=unit('observer-'+String(i).padStart(2,'0'),0,{nu:i===C.SENS.maxObs?100:1,ir:0,em:0,rad:0});o.pos=[0,0,0];return o;}),all=obs.concat(t),w={sensors:true,time:10,sides:[{id:0,ai:true,tc:new Map()}],units:new Map(all.map(u=>[u.id,u]))};R.sensorTick(w,0,reverse?all.slice().reverse():all);return plain(w.sides[0].tc.get(t.id).snr);}
 assert.deepEqual(scan(false),scan(true),'reordering a saved unit map must not choose a different sensor at a tied range');
});
