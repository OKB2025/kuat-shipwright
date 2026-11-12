const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const {C,R}=vm.runInContext('({C:Core,R:Rts})',cx),near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1e-30,Math.abs(b))*1e-10,`${a} != ${b}`),arc=(k,cycle,dir=[1,0,0],fixed=true)=>({k,cycle,dir,fixed,up:[0,1,0],pos:[0,0,0],gun:1,aa:1});
function squad(name,fireArcs){const key='physical-shot-'+name;R.CRAFT[key]={name:key,role:'fighter',speed:1000,armor:1,crew:1,gun:1e12,strike:1e12,aa:1,fireArcs,systems:{managed:true,laserUnits:4,laserGunShare:1,laserAaShare:1}};return {craft:key,pos:[0,0,0],h:[1,0,0],laserGas:100};}
test('RTS energy counts physical barrels at their per-second output at any installed cadence rather than strategy gun scores',()=>{
 // Spec 2026-11-11: a shot is the per-barrel per-second output over the arc's actual period, so 10 claser shots at
 // 0.1 s are 5 kt each (50 kt/s) and 5 twin cturret volleys at 0.2 s are 2 × 2 kt each (2 × 10 kt/s).
 const s=squad('mixed',[arc('claser',.1),arc('cturret',.2)]),expected=10*(C.CRAFT_LASER_OUTPUT.medium*.1)+5*2*(C.CRAFT_LASER_OUTPUT.light*.2);near(expected,C.CRAFT_LASER_OUTPUT.medium+2*C.CRAFT_LASER_OUTPUT.light);near(R.squadLaserEnergy(s,[1000,0,0],1),expected);R.CRAFT[s.craft].gun=R.CRAFT[s.craft].strike=1e-12;near(R.squadLaserEnergy(s,[1000,0,0],1),expected);near(R.squadLaserEnergy(s,[1000,0,0],2),expected*2);near(R.squadLaserEnergy(s,[-1000,0,0],1),0);
});
test('a fitted aircraft snapshot supplies its real single and twin barrels to RTS energy',()=>{
 const ship=C.newShip({L:20,W:14,H:6,assembly:true},'Fitted battery');ship.parts=[];ship.fits=['claser','claserH','cturret'].map((k,i)=>({id:i+1,k,p:[10,3,i*2-2],a:2,ped:0,base:0,low:0,float:false}));const arcs=C.craftGunMounts(ship,{info:{}}),s=squad('real-mounts',arcs),seconds=1.8;assert.equal(arcs.length,3);const expected=seconds*(C.FITS.claser.boltTT/C.CRAFT_FIRE.cycles.claser+C.FITS.claserH.boltTT/C.CRAFT_FIRE.cycles.claserH+2*C.FITS.cturret.boltTT/C.CRAFT_FIRE.cycles.cturret);near(expected,seconds*(C.CRAFT_LASER_OUTPUT.medium+C.CRAFT_LASER_OUTPUT.heavy+2*C.CRAFT_LASER_OUTPUT.light));near(R.squadLaserEnergy(s,[1000,0,0],seconds),expected);
});
test('empty aircraft gas stops laser shots while a bearing capital ion mount retains its own full energy',()=>{
 const s=squad('gas-ion',[arc('claser',.1),arc('ion',1,[-1,0,0])]);s.laserGas=0;near(R.squadLaserEnergy(s,[1000,0,0],1),0);const aft=R.squadWeaponEnergy(s,[-1000,0,0],2);near(aft.gun,0);near(aft.ion,700);s.laserGas=100;near(R.squadLaserEnergy(s,[1000,0,0],1),10*C.CRAFT_LASER_OUTPUT.medium*.1);near(R.squadWeaponEnergy(s,[1000,0,0],1).ion,0);
});
test('table-only aircraft use the explicitly estimated equipment count without building a stock model',()=>{
 const key=Object.keys(R.CRAFT).find(k=>!C.CRAFT_PRICE_CATALOG.entries[k]&&R.craftPrice(k).bom?.fits?.some(row=>row.k==='claser'&&row.count>0));assert.ok(key);const c=R.CRAFT[key],bom=R.craftPrice(key).bom,count=bom.fits.filter(row=>row.k==='claser').reduce((n,row)=>n+row.count,0),s={craft:key,pos:[0,0,0],h:[1,0,0],laserGas:100},build=C.buildDesign;C.buildDesign=()=>{throw Error('table-only energy cannot build another craft');};try{const energy=R.squadLaserEnergy(s,[1000,0,0],C.CRAFT_FIRE.cycles.claser);near(energy,count*C.FITS.claser.boltTT);c.gun=c.strike=1e20;near(R.squadLaserEnergy(s,[1000,0,0],C.CRAFT_FIRE.cycles.claser),energy);}finally{C.buildDesign=build;}
});
test('an empty or invalid firing interval creates no RTS laser or ion energy',()=>{
 const s=squad('invalid-time',[arc('claser',.1),arc('ion',1)]);for(const seconds of [0,-1,NaN,Infinity]){near(R.squadLaserEnergy(s,[1000,0,0],seconds),0);const energy=R.squadWeaponEnergy(s,[1000,0,0],seconds);near(energy.gun,0);near(energy.ion,0);}
});
