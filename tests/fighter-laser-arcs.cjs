const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const p of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,p),'utf8'),context,{filename:p});
const {C,R}=vm.runInContext('({C:Core,R:Rts})',context),plain=v=>JSON.parse(JSON.stringify(v));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function custom(arcs){const snapshot={name:'Directional craft',dims:[12,9,3],craft:{role:'fighter',speed:2000,aa:1,strike:20,gun:20,armor:1,crew:1,fireArcs:arcs}};return R.registerDesignCraft(snapshot);}
const fixed=(dir,gun=1,aa=gun)=>({fixed:true,dir,up:[0,1,0],gun,aa,cycle:.12});

test('stock and legacy fighter batteries only fire within the forward barrel cone',()=>{
 const s={craft:'tie_ln',pos:[0,0,0],h:[1,0,0]};
 near(R.squadFireArc(s,[1000,0,0]),1);near(R.squadFireArc(s,[1000,80,0]),1);
 for(const point of [[-10,0,0],[0,0,50],[0,50,0],[1000,160,0]])near(R.squadFireArc(s,point),0);
 s.h=[0,0,-1];near(R.squadFireArc(s,[0,0,-1000],'aa'),1);near(R.squadFireArc(s,[1000,0,0],'aa'),0);
});

test('custom fixed directions survive snapshot cleaning and registration and contribute only their installed shares',()=>{
 const key=custom([fixed([1,0,0],.75),fixed([0,0,1],.25)]),s={craft:key,pos:[20,10,-30],h:[1,0,0]};
 assert.ok(key);near(R.squadFireArc(s,[1020,10,-30]),.75);near(R.squadFireArc(s,[20,10,970]),.25);near(R.squadFireArc(s,[-980,10,-30]),0);
 s.h=[0,0,1];near(R.squadFireArc(s,[20,10,970]),.75);near(R.squadFireArc(s,[-980,10,-30]),.25);
 assert.deepEqual(plain(R.CRAFT[key].snapshot.craft.fireArcs.map(a=>a.dir)),[[1,0,0],[0,0,1]]);
});

test('real turrets keep their mounting hemisphere while fixed guns cannot inherit turret coverage',()=>{
 const key=custom([fixed([1,0,0],.6),{fixed:false,dir:[1,0,0],up:[0,1,0],gun:.4,aa:.4}]),s={craft:key,pos:[0,0,0],h:[1,0,0]};
 near(R.squadFireArc(s,[1000,0,0]),1);near(R.squadFireArc(s,[-1000,0,0]),.4);near(R.squadFireArc(s,[0,1000,0]),.4);near(R.squadFireArc(s,[0,-1000,0]),0);
 const unarmed=custom([]);near(R.squadFireArc({...s,craft:unarmed},[1000,0,0]),0);
});

test('a strafing fighter can engage forward hull surfaces without shooting backwards after passing',()=>{
 const target={pos:[0,0,0],yaw:0,p:{len:1600,width:800,height:400}},s={craft:'tie_ln',pos:[900,235,0],h:[-1,0,0]};
 near(R.squadFireArc(s,target.pos),0,'centre lies below the fixed-gun cone');near(R.squadFireArc(s,target),1);
 s.pos=[-950,235,0];near(R.squadFireArc(s,target),0);
 target.yaw=Math.PI/2;s.pos=[0,235,900];s.h=[0,0,-1];near(R.squadFireArc(s,target),1);s.pos=[0,235,-950];near(R.squadFireArc(s,target),0);
});

test('physical muzzle metadata uses each operational fit frame and excludes blocked or floating weapons',()=>{
 const ship=C.newShip({L:12,W:9,H:3,assembly:true},'Mount directions');ship.parts=[];ship.fits=[
  {id:1,k:'claser',p:[9,1,2],a:2,ped:0,base:0},
  {id:2,k:'claserH',p:[9,1,-2],a:0,ped:0,base:0},
  {id:3,k:'cturret',p:[3,2,0],a:2,ped:0,base:0,assetYaw:90},
  {id:4,k:'claser',p:[5,1,2],a:2,ped:0,base:0,float:true},
  {id:5,k:'claser',p:[6,1,2],a:2,ped:0,base:0}
 ];const arcs=C.craftGunMounts(ship,{info:{5:{overlap:true}}});assert.equal(arcs.length,3);
 for(let i=0;i<arcs.length;i++){const f=ship.fits[i],fr=C.fitFrameOf(f);arcs[i].dir.forEach((x,j)=>near(x,fr.fw[j]));assert.ok(arcs[i].pos.every(Number.isFinite));assert.equal(arcs[i].fixed,f.k!=='cturret');}
 near(arcs.reduce((n,a)=>n+a.gun,0),1);near(arcs.reduce((n,a)=>n+a.aa,0),1);
 assert.equal(arcs[0].cycle,C.CRAFT_FIRE.cycles.claser);assert.equal(arcs[1].cycle,C.CRAFT_FIRE.cycles.claserH);
});

test('malformed directional snapshots stay finite and bounded and retain an explicitly empty battery',()=>{
 assert.equal(C.cleanCraftFireArcs(null),null);assert.deepEqual(plain(C.cleanCraftFireArcs([])),[]);
 const arcs=C.cleanCraftFireArcs([{fixed:true,dir:[NaN,0,0],gun:1},{fixed:true,dir:[2,0,0],up:[0,0,0],pos:[Infinity,0,0],gun:Infinity,aa:-5,cycle:Infinity}]);
 assert.equal(arcs.length,1);assert.deepEqual(plain(arcs[0].dir),[1,0,0]);assert.deepEqual(plain(arcs[0].up),[0,1,0]);assert.equal(arcs[0].pos,undefined);assert.equal(arcs[0].gun,0);assert.equal(arcs[0].aa,0);assert.ok(Number.isFinite(arcs[0].cycle));
 assert.equal(C.cleanCraftFireArcs(Array.from({length:200},()=>fixed([1,0,0]))).length,128);
 const huge=C.cleanCraftFireArcs([fixed([1.79e308,1.79e308,1.79e308])])[0];near(C.len(huge.dir),1);
 const legacy=C.cleanDesignCraft({name:'Legacy',dims:[12,9,3],craft:{role:'fighter',speed:2000,aa:1,strike:10,armor:1,crew:1}});assert.equal(legacy.craft.fireArcs,undefined);
});

test('a live custom aircraft carries its actual fitted barrel directions into an embarked blueprint snapshot',()=>{
 const ship=C.newShip({L:12,W:9,H:3},'Designed fire axes');ship.parts=[];ship.fits=[{id:1,k:'claser',p:[8,1.5,1],a:2,ped:0,base:0,low:0,float:false},{id:2,k:'claserH',p:[12,0,0],a:0,ped:0,base:0,low:0,float:false}];ship.nextId=3;
 const stats={craft:true,cls:{role:'戦闘機'},accelG:3700,mass:10,crew:1,cost:100,dims:[12,9,3],info:{}},combat=C.craftCombat(ship,stats),snapshot=C.designCraftSnapshot(ship,stats),key=R.registerDesignCraft(snapshot);
 assert.ok(snapshot?.blueprint);assert.ok(key);assert.deepEqual(plain(combat.fireArcs.map(a=>a.dir)),[[1,0,0],[0,1,0]]);assert.deepEqual(plain(R.CRAFT[key].fireArcs),plain(combat.fireArcs));
 const s={craft:key,pos:[0,0,0],h:[1,0,0]};assert.ok(R.squadFireArc(s,[0,1000,0])>0);near(R.squadFireArc(s,[-1000,0,0]),0);
});

test('an exhausted forward laser cannot borrow an aft ion cannon share of damage',()=>{
 const key=custom([{...fixed([1,0,0],.75,.8),k:'claser'},{...fixed([-1,0,0],.25,.2),k:'cion'}]),craft=R.CRAFT[key];craft.systems={managed:true,laserUnits:1,laserGunShare:.6,laserAaShare:.8};
 const s={craft:key,pos:[0,0,0],h:[1,0,0],laserGas:0};
 for(const mode of ['gun','aa']){near(R.squadFireArc(s,[1000,0,0],mode),0);near(R.squadFireArc(s,[-1000,0,0],mode),1);near(R.squadFireArc(s,[-1000,0,0],mode)*R.squadLaserK(s,mode),mode==='aa'?.2:.4);}
 s.laserGas=2;near(R.squadFireArc(s,[1000,0,0]),.75);near(R.squadFireArc(s,[-1000,0,0]),.25);
});

test('gas-starved craft turrets stop while generic and reference guns keep only their own surviving arcs',()=>{
 for(const k of ['htl','refVen']){const key=custom([{fixed:false,dir:[1,0,0],up:[0,1,0],k:'cturret',gun:.4,aa:.5},{...fixed([-1,0,0],.6,.5),k}]);R.CRAFT[key].systems={managed:true,laserUnits:1,laserGunShare:.4,laserAaShare:.5};const s={craft:key,pos:[0,0,0],h:[1,0,0],laserGas:0};
  near(R.squadFireArc(s,[1000,0,0]),0);near(R.squadFireArc(s,[-1000,0,0]),1);near(R.squadFireArc(s,[-1000,0,0])*R.squadLaserK(s),.6);
  near(R.squadFireArc(s,[1000,0,0],'aa'),0);near(R.squadFireArc(s,[-1000,0,0],'aa'),1);near(R.squadFireArc(s,[-1000,0,0],'aa')*R.squadLaserK(s,'aa'),.5);
 }
 const key=custom([{...fixed([1,0,0]),k:'claser'}]);R.CRAFT[key].systems={managed:true,laserUnits:1,laserGunShare:1,laserAaShare:1};const s={craft:key,pos:[0,0,0],h:[1,0,0],laserGas:0};near(R.squadFireArc(s,[1000,0,0]),0);near(R.squadFireArc(s,[1000,0,0],'aa'),0);
});

test('angled gun metadata is byte-stable through cleaning, serialization and a cleared design registry',()=>{
 const raw=[{...fixed([.37,.58,.91]),up:[.23,.67,-.42],pos:[4.125,-.064,3.987],k:'claser'}],clean=C.cleanCraftFireArcs(raw),encoded=JSON.stringify(clean);
 for(let i=0;i<20;i++)assert.equal(JSON.stringify(C.cleanCraftFireArcs(JSON.parse(encoded))),encoded);
 const key=custom(raw);let disk=JSON.parse(JSON.stringify(R.CRAFT[key].snapshot));
 for(let i=0;i<5;i++){delete R.CRAFT[key];const restored=R.registerDesignCraft(disk);assert.equal(restored,key);assert.equal(JSON.stringify(R.CRAFT[restored].snapshot.craft.fireArcs),encoded);disk=JSON.parse(JSON.stringify(R.CRAFT[restored].snapshot));}
});
