const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx);

test('the Executor-only bridge and domes are no longer reference assets',()=>{
 for(const id of ['exe_bridge','exe_sensor_port','exe_sensor_stbd'])assert.equal(Object.hasOwn(C.REFERENCE_ASSETS,id),false,id);
});

test('a saved Executor bridge loads as the Imperial-class bridge and domes in the same place',()=>{
 const s=C.newShip({L:2000,W:600,H:400},'Bridge fixture');s.autoHabitation=false;
 const saved=JSON.parse(JSON.stringify(C.serialize(s))),id=saved.nextId;
 saved.parts.push({id,k:'struct',c:[1000,380,0],s:[309.6,402.4,167.8],form:'reference',label:'エグゼクター級 艦橋本体',skinAsset:'exe_bridge',equipmentId:'exeBridge'});
 saved.parts.push({id:id+1,k:'sensor',c:[1008,386,-147],d:105,label:'エグゼクター級 標的追跡ドーム',skinAsset:'exe_sensor_port',equipmentId:'exeSensor'});saved.nextId=id+2;
 const loaded=C.deserialize(saved),bridge=loaded.parts.find(p=>p.id===id),dome=loaded.parts.find(p=>p.id===id+1);
 assert.equal(bridge.skinAsset,'isd_bridge');assert.equal(bridge.equipmentId,'isdBridge');assert.deepEqual(Array.from(bridge.c),[1000,380,0]);
 assert.equal(dome.skinAsset,'isd_sensor_port');assert.equal(dome.equipmentId,'isdSensor');assert.deepEqual(Array.from(dome.c),[1008,386,-147]);
});
