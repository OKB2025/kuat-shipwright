const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const C=vm.runInContext('Core',context),plain=v=>JSON.parse(JSON.stringify(v)),near=(a,b,label)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(b))*1e-9,`${label}: ${a} / ${b}`);
function bareShip(){const s=C.newShip({L:40,W:24,H:20,plan:'rect',sec:'rect'},'Strict thermal fixture');s.parts=[{id:1,k:'gen',c:[30,10,0],d:2},{id:2,k:'pump',c:[30,10,1.6],d:.5}];s.fits=[];s.nextId=3;return s;}
function oldProfile({cooler=true,power=20}={}){
 const modules=[{k:'reactor',part:1,port:'p1',domain:'main',size:1,share:1},{k:'weapon',fit:2,port:'f2',domain:'main',size:1,share:1,powerConnected:true},{k:'dissipator',part:3,port:'p3',domain:'main',size:1,share:1,powerConnected:true}];
 const source=(k,m)=>({k,id:k==='reactor'?'p1':k==='weapon'?'f2':'hotel',n:k,g:k==='hotel'?'low':'high',sh:1,st:1e6,m,pc:[],sec:-1,sw:-1,gen:-1});
 const dis=[{k:'integral',n:'old built-in',g:'high',cap:1e30,m:-1,src:0,sec:-1},{k:'legacy',n:'old automatic superweapon sink',g:'high',cap:1e30,m:-1,src:1,sec:-1}];
 if(cooler)dis.push({k:'hdis',id:'p3',n:'real physical cooler',g:'high',cap:100,...(power===undefined?{}:{power}),m:2,src:-1,sec:-1});
 return {name:'Cached compatibility profile',hp:1e6,len:100,width:30,height:20,D:0,wCap:0,crewNeed:0,crewMax:0,maxSpeed:0,accel:0,modules,grid:{P:1000,fixed:0,cooling:0,De:0,Ds:0,Dw:0,powerPaths:[{from:'p1',to:'p3',cap:100,ok:true}]},heat:{v:1,src:[source('reactor',[0]),source('weapon',[1]),source('hotel',[])],dis,ln:[{s:0,d:0,cap:1e30,sec:-1},{s:1,d:1,cap:1e30,sec:-1},...(cooler?[{s:1,d:2,cap:100,sec:-1}]:[])]}};
}
test('compatibility thermal policy is disabled, including explicit opt-in and old serialized surface modes',()=>{
 assert.equal(C.HEAT.strictOnly,true);assert.ok(Object.values(C.HEAT.integral).every(v=>v===0));assert.equal(C.HEAT.legacySw,0);
 const s=bareShip();assert.equal(C.enableSurfaceMode(s,false,{report:false}).ok,false);
 const raw=C.serialize(s);raw.surfaces={version:3,mode:'compat',compatAllowed:true,patches:[]};const restored=C.deserialize(raw);
 assert.equal(restored.surfaces.mode,'strict');assert.equal(restored.surfaces.compatAllowed,false);assert.equal(C.enableSurfaceMode(restored,false,{report:false}).ok,false);
 const saved=C.serialize(restored);assert.equal(saved.surfaces.mode,'strict');assert.equal(saved.surfaces.compatAllowed,false);
});
test('a design without a surface ledger still has strict heat and no hidden high-grade sink',()=>{
 const s=bareShip();delete s.surfaces;const S=C.computeStats(s);
 assert.equal(S.heat.mode,'strict');assert.equal(S.heat.builtin,0);assert.equal(S.heat.legacy,0);
 assert.equal(S.heat.net.dis.length,0,'2026-11-12: no hull-skin sink');assert.equal(S.heat.skin,0);assert.ok(S.heat.presets.combat.stored>0,'an uncooled active reactor retains its real waste');
 assert.ok(!S.warnings.some(w=>/互換運転|自動割当の散逸/.test(w.text||'')));
});
test('version-one cached networks retain real sinks and finite links while removing integral and automatic sinks',()=>{
 const p=oldProfile(),before=plain(p.heat),H=C.heatProfile(p);
 assert.equal(H.v,5);assert.equal(H.mode,'strict');assert.deepEqual(plain(H.dis.map(d=>d.k)),['hdis']);
 assert.deepEqual(plain(H.ln),[{s:1,d:0,cap:100,sec:-1}]);assert.equal(H.dis[0].m,2);assert.equal(H.dis[0].power,20);assert.deepEqual(plain(p.heat),before,'migration does not rewrite the saved snapshot');
 const alias=oldProfile();alias.heat.links=alias.heat.ln;delete alias.heat.ln;assert.deepEqual(plain(C.heatProfile(alias).src.map(s=>s.id)),plain(alias.heat.src.map(s=>s.id)),'older path spellings preserve source identities');assert.ok(C.heatProfile(alias).src.every(s=>s.st==null),'local thermal stores are retired');assert.equal(C.heatProfile(alias).ln.length,1);
 const unrated=oldProfile();delete unrated.heat.dis[2].power;near(C.heatProfile(unrated).dis[0].power,100*C.HEAT.disPowerK.hdis,'missing old input rating uses the physical catalog coefficient');
 const u=C.fleetUnit('cached','cached',p,0);C.heatInit(u);u.ht.t=0;u.ht.qJ=100;
 C.allocateShipPower(u,C.fleetSystems(u),{throttle:0,weapons:0,shields:0},1,'balanced');C.heatTick({time:1},u,1);
 assert.ok(u.ht.qJ<100,'real cooler can draw finite electricity even when an old grid omitted cooling');assert.ok(u.ht.cooling.inputJ>0);near(u.ht.cooling.heatJ,u.ht.cooling.inputJ,'cooler electrical waste');near(u.ht.cooling.reactorWasteJ,.04*u.ht.cooling.inputJ,'funding reactor waste');
 assert.ok(u.ht.cooling.inputJ<=20&&u.ht.cooling.handledJ<=100);
 near(u.ht.qJ+u.ht.emit,100+u.ht.cooling.inputJ+u.ht.cooling.reactorWasteJ,'stored and emitted heat conserves cooler and reactor input losses');
});
test('removing real cooling or cutting its power cannot revive cached compatibility cooling',()=>{
 for(const mode of ['missing','severed']){
  const p=oldProfile({cooler:mode!=='missing'});if(mode==='severed')p.grid.powerPaths[0].ok=false;
  const u=C.fleetUnit(mode,mode,p,0);C.heatInit(u);u.ht.t=0;u.ht.qJ=100;
  C.allocateShipPower(u,C.fleetSystems(u),{throttle:0,weapons:0,shields:0},1,'balanced');C.heatTick({time:1},u,1);
  near(u.ht.qJ,100,mode+' retained waste');near(u.ht.emit,0,mode+' emitted heat');near(u.ht.cooling?.inputJ||0,0,mode+' cooler input');
 }
});
test('a current-numbered cached network cannot smuggle integral sinks or unbound dissipators into runtime',()=>{
 const p=oldProfile({cooler:false});p.heat.v=3;p.heat.mode='strict';p.heat.dis.push({k:'hdis',cap:1e30,power:0,m:-1,g:'high'});p.heat.ln.push({s:1,d:2,cap:1e30});
 const H=C.heatProfile(p);assert.equal(H.dis.length,0);assert.equal(H.ln.length,0);
});
test('table-only old profiles get no automatic high-grade cooling even for superweapons',()=>{
 const p=oldProfile({cooler:false});delete p.heat;p.modules=p.modules.filter(m=>m.k!=='dissipator');p.sw=[{k:'sbeam',r:1,mod:-1,Pshare:1,chargeT:10}];
 const H=C.heatProfile(p);assert.equal(H.v,5);assert.equal(H.mode,'strict');assert.ok(H.src.some(s=>s.k==='sw'));assert.equal(H.dis.length,0,'2026-11-12: no hull-skin sink');assert.equal(H.ln.length,0);
});
