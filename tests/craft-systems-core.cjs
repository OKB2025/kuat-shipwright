const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),c=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c,{filename:file});
const C=vm.runInContext('Core',c),plain=x=>JSON.parse(JSON.stringify(x));
function fixture(){const s=C.newShip({L:20,W:12,H:8},'Systems design');s.parts=[{id:1,k:'cockpit',c:[12,3,0],d:1,seats:1},{id:2,k:'gen',c:[16,3,0],d:3}];s.nextId=3;return s;}
function basicStats(s){return {mass:100,power:1e25,draw:{hotel:1e20,ray:0},crew:1,seats:1,accuracy:1,info:{},warnings:[],jumpOK:true,canLand:true};}
function add(s,k,v){const d=Math.cbrt(v);s.parts.push({id:s.nextId++,k,c:[3+s.parts.length*.6,3,1.8],d,room:[d,d,d]});}
test('explicit equipment uses the shared capacity coefficients and cannot stack targeting bonuses',()=>{
 const s=fixture();for(const [k,v]of [['lifeSupport',.05],['ejectSeat',.021],['navComputer',.01],['targetComputer',.02],['maneuver',.2],['landingGear',.5],['laserGas',.02]])add(s,k,v);
 const st=basicStats(s);C.craftSystemsStats(s,st);const a=st.craftSystems;
 assert.ok(a.managed);assert.equal(a.lifeSupportCapacity,1);assert.ok(Math.abs(a.lifeSupportHours-12)<.001);assert.equal(a.ejectionSeats,1);assert.equal(a.navReady,true);assert.equal(a.maneuverRatio,1);assert.equal(a.landingReady,true);
 add(s,'targetComputer',10);C.craftSystemsStats(s,st);assert.equal(st.craftSystems.fireK,1);assert.equal(st.accuracy,1);
});
test('legacy saves retain implicit systems and a new managed design stays managed after equipment removal',()=>{
 const s=fixture(),old=C.serialize(s);delete old.systemsVersion;const legacy=C.deserialize(old),st=basicStats(legacy);C.craftSystemsStats(legacy,st);assert.equal(st.craftSystems.managed,false);assert.equal(st.craftSystems.laserGasSeconds,null);
 add(s,'lifeSupport',.05);s.parts=s.parts.filter(p=>p.k!=='lifeSupport');const loaded=C.deserialize(C.serialize(s)),next=basicStats(loaded);C.craftSystemsStats(loaded,next);assert.equal(next.craftSystems.managed,true);assert.equal(next.craftSystems.lifeSupportHours,0);
});
test('capital ships with integrated controls do not acquire small-craft penalties from the new format flag',()=>{
 const s=C.newShip({L:1200,W:400,H:200},'Capital'),st=basicStats(s);C.craftSystemsStats(s,st);assert.equal(st.craftSystems.managed,false);assert.equal(st.craftSystems.turnK,1);assert.equal(st.accuracy,1);assert.equal(st.jumpOK,true);
 add(s,'maneuver',.2);C.craftSystemsStats(s,st);assert.equal(st.craftSystems.managed,true);
});
test('TIE suit operation and unmanned craft stay distinct from cabin life support',()=>{
 const s=fixture();s.parts[0].suit=true;const copy=C.deserialize(C.serialize(s));assert.equal(copy.parts[0].suit,true);let st=basicStats(copy);C.craftSystemsStats(copy,st);assert.equal(st.craftSystems.suitSeats,1);assert.equal(st.craftSystems.lifeSupportHours,4);
 copy.parts=copy.parts.filter(p=>p.k!=='cockpit');copy.parts.push({id:8,k:'droidbrain',c:[12,3,0],d:.5});st={...basicStats(copy),crew:0,seats:0};C.craftSystemsStats(copy,st);assert.equal(st.craftSystems.crew,0);assert.equal(st.craftSystems.lifeSupportHours,null);
});
test('equipment warnings link to a real part or a valid catalogue item in the editor',()=>{
 const s=fixture();s.parts[0].suit=true;const st=basicStats(s);C.craftSystemsStats(s,st);
 assert.ok(st.warnings.length);
 for(const w of st.warnings)for(const target of w.targets){
  if(target.list)assert.ok(s.parts.some(p=>target.list==='parts'&&p.id===target.id));
  if(target.part)assert.equal(typeof target.part,'string');
 }
});
test('new equipment contributes mass, cost, hotel power and heat exactly once',()=>{
 const s=fixture(),before=C.computeStats(s);add(s,'navComputer',.02);const after=C.computeStats(s),delta=C.craftSystemsPower(s,after.info)-C.craftSystemsPower(fixture(),before.info);
 assert.ok(after.mass>before.mass);assert.ok(after.cost>before.cost);assert.ok(delta>0);assert.ok(Math.abs((after.draw.hotel-before.draw.hotel)-delta)<delta*1e-12);assert.ok(Math.abs(after.draw.systems-delta)<delta*1e-12);
 assert.ok(after.heat.net.src.some(x=>x.k==='hotel'));const a=after.accuracy;C.craftSystemsStats(s,after);assert.equal(after.accuracy,a);
});
test('systems metadata survives a blueprint snapshot and rejects nonfinite capacities',()=>{
 const s=fixture(),st=C.computeStats(s),d=C.designCraftSnapshot(s,st),copy=C.cleanDesignCraft(plain(d));assert.equal(copy.blueprint.systemsVersion,1);assert.ok(copy.craft.systems.managed);
 const clean=C.cleanCraftSystems({...copy.craft.systems,power:Infinity,lifeSupportHours:NaN,turnK:-1,suitSeats:999});assert.equal(clean.power,0);assert.equal(clean.lifeSupportHours,0);assert.equal(clean.turnK,.2);assert.ok(clean.suitSeats<=clean.crew);
});
