const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx);
const unit=fill=>({ht:{online:true,qJ:fill*1e20,capacityJ:1e20}});

test('the governor leaves a cool ship at full thrust and fire',()=>{
 for(const fill of [0,.3,.55]){const g=C.heatGovernor(unit(fill));assert.equal(g.engine,1);assert.equal(g.weapon,1);assert.equal(g.active,false);}
});

test('thrust and weapon charging ease off linearly before the limiting band',()=>{
 const mid=C.heatGovernor(unit((.55+.68)/2));assert.ok(Math.abs(mid.weapon-.5)<1e-9);assert.ok(Math.abs(mid.engine-.55)<1e-9);assert.equal(mid.active,true);
 const top=C.heatGovernor(unit(.68));assert.equal(top.weapon,0);assert.ok(Math.abs(top.engine-.1)<1e-12);
 const over=C.heatGovernor(unit(.69));assert.equal(over.weapon,0);assert.ok(Math.abs(over.engine-.1)<1e-12);
});

test('the governor never reaches the band where heat damage begins',()=>{
 assert.ok(C.HEAT.governEnd<C.HEAT.limitAt);
});

test('a ship without heat state or in blackout is not governed',()=>{
 assert.deepEqual({...C.heatGovernor({})},{fill:0,engine:1,weapon:1,active:false});
 assert.equal(C.heatGovernor({ht:{online:false,qJ:9,capacityJ:10}}).active,false);
});
