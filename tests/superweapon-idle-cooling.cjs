// Found 2026-11-15 while checking the trial's stationary targets: a ship charging a superweapon with no target in reach
// (or ordered to hold fire) reserved cooling power for its idle guns only; the charge heat filled the store and the
// ship shut itself down ("熱限界：全艦の電源を即時遮断") about 5 s into a battle. The cooling demand now counts the charge heat.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{test}=require('node:test');
const root=process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),F=vm.runInContext('YardFleetData',cx);
function idle(key,order,dist){const a=C.fleetUnit('me','arquitens',F.designs.arquitens.p,0),b=C.fleetUnit('x1',key,F.designs[key].p,1);a.manual=true;b.pos=[dist,0,0];b.order={...b.order,...order};const B=C.fleetBattle([a,b],true);B.seed=3;let peak=0;for(let t=0;t<30;t+=.25){C.fleetTick(B,.25,{});peak=Math.max(peak,b.ht.qJ/b.ht.capacityJ);}return {b,peak};}
for(const key of ['onager','subjugator'])for(const [name,order,dist] of [['no target in reach',{},60000],['holding fire',{fire:false},8000],['holding fire and superweapons',{fire:false,sw:false},8000]])
 test(`${key}: charging a superweapon with ${name} does not shut the ship down from heat`,()=>{const r=idle(key,order,dist);assert.equal(r.b.out,null,'out: '+r.b.out);assert.ok(r.peak<.5,'store peak '+r.peak);});
