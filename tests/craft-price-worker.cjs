const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),c=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c,{filename:file});
const run=s=>vm.runInContext(s,c),engine=fs.readFileSync(path.join(root,'js/engine.js'),'utf8');
run('const C=Core,messages=[],post=m=>messages.push(m);');
run(engine.slice(engine.indexOf('function handleCraftPrice('),engine.indexOf('function handleFleet(')));
test('worker repricing uses engineering cost and crew without generating or transferring a mesh',()=>{
 const result=run(`(()=>{const s=C.newShip({L:20,W:10,H:5},'Old design');delete s.systemsVersion;s.parts=[{id:1,k:'cockpit',c:[10,1,0],d:1,seats:1}];s.nextId=2;const input=C.serialize(s),before=JSON.stringify(input);handleCraftPrice({id:7,design:input});const copy=C.deserialize(input);C.syncCompartments(copy);C.remount(copy);C.syncCompartments(copy);const expected=C.designCost(C.computeStats(copy));return {message:messages[0],expected,unchanged:JSON.stringify(input)===before};})()`);
 assert.equal(result.message.type,'craftPrice');assert.equal(result.message.id,7);assert.equal(result.message.price.build,result.expected.build);assert.equal(result.message.price.total,result.expected.total);
 assert.equal(result.message.price.version,run('C.COST_MODEL.version'));assert.equal(result.message.geometry,undefined);assert.equal(result.unchanged,true);
});
