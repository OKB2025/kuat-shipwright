// v24 One set of Imperial-class command equipment and the Venator's two bridges, under the user's names.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx);
test('the command catalogue offers each bridge, dome and antenna once',()=>{
 const names=Object.values(C.EQUIPMENT).filter(d=>!d.catalogHidden&&['bridge','support'].includes(d.group)).map(d=>d.name).sort();
 assert.deepEqual(names,['ISD-72x複合センサドーム','分散式艦橋航空','分散式艦橋航行','外装式指向性通信装置','大型統合艦橋'].sort());
 for(const id of ['isdh_bridge','isdh_sensor_port','isdh_sensor_stbd','isdh_mast'])assert.equal(Object.hasOwn(C.REFERENCE_ASSETS,id),false,id);
});
test('saved hammerhead bridge, domes and antenna load as the one Imperial set in place',()=>{
 const ship=C.newShip({L:2000,W:600,H:300},'migration');ship.parts=[];const saved=C.serialize(ship);let id=900;
 for(const [asset,k] of [['isdh_bridge','struct'],['isdh_sensor_port','sensor'],['isdh_sensor_stbd','sensor'],['isdh_mast','sensor']])saved.parts.push(k==='struct'?{id:id++,k,c:[1000,300,0],s:[100,200,60],form:'reference',label:'旧部品',skinAsset:asset,equipmentId:'isdhBridge'}:{id:id++,k,c:[1000,360,0],d:30,label:'旧部品',skinAsset:asset,skinSize:[30,30,30],equipmentId:'isdhSensor'});
 const loaded=C.deserialize(saved),by=a=>loaded.parts.filter(p=>p.skinAsset===a);
 assert.equal(by('isd_bridge').length,1);assert.equal(by('isd_bridge')[0].label,'大型統合艦橋');assert.equal(by('isd_sensor_port')[0].label,'ISD-72x複合センサドーム');assert.equal(by('isd_mast')[0].label,'外装式指向性通信装置');
 assert.deepEqual(Array.from(by('isd_bridge')[0].c),[1000,300,0],'the part keeps its place');
});
