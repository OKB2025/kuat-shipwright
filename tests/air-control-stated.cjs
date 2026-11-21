// User decision 2026-11-19「インペリアル級の艦橋での管制数は3くらいに　ヴェネターの航空艦橋で4に」: these examples state the squadrons they direct in the
// air at once (ship.airControl), in place of the count worked out from their command rooms (6 and 5).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx);
test('the examples state 3 for the Imperial class and 4 for the Venator',()=>{assert.equal(C.EXAMPLE_AIR_CONTROL.imperial,3);assert.equal(C.EXAMPLE_AIR_CONTROL.imperial2,3);assert.equal(C.EXAMPLE_AIR_CONTROL.venator,4);});
test('a design that states its air control has that many, through saving and loading; one that does not is worked out as before',()=>{
 const ship=C.newShip({L:300,W:80,H:40},'Air control'),worked=C.computeStats(ship).airCtl;assert.ok(worked>=1);
 ship.airControl=3;ship._cache=null;assert.equal(C.computeStats(ship).airCtl,3);
 const back=C.deserialize(C.serialize(ship));assert.equal(back.airControl,3);assert.equal(C.computeStats(back).airCtl,3);
 const plain=C.deserialize(C.serialize(C.newShip({L:300,W:80,H:40},'None')));assert.equal(plain.airControl,undefined);assert.equal(C.computeStats(plain).airCtl,worked);
});
test('the built Venator directs four squadrons',()=>{const s=C.buildDesign('venator');assert.equal(s.airControl,4);assert.equal(C.computeStats(s).airCtl,4);});
