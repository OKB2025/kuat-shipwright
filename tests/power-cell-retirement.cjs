const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx);

test('the power cell is no longer a placeable compartment',()=>{
 assert.equal(Object.hasOwn(C.PARTS,'battery'),false);
});

test('a saved power cell loads as a thermal energy converter with the same ID and size',()=>{
 const s=C.newShip({L:200,W:60,H:40},'Cell fixture');s.autoHabitation=false;
 const saved=JSON.parse(JSON.stringify(C.serialize(s)));
 saved.parts.push({id:saved.nextId,k:'battery',c:[100,20,0],d:8,label:'パワーセル'});saved.nextId++;
 const loaded=C.deserialize(saved),p=loaded.parts.find(q=>q.id===saved.nextId-1);
 assert.ok(p,'the cell keeps its ID');assert.equal(p.k,'hdis');assert.equal(p.d,8);assert.equal(p.label,'熱エネルギー変換装置');
 assert.equal(loaded.retiredCells,1);
 assert.equal(loaded.parts.some(q=>q.k==='battery'),false);
});

test('fleet profiles carry no power-cell reserve',()=>{
 const s=C.newShip({L:200,W:60,H:40},'Profile fixture');const S=C.computeStats(s),p=C.fleetProfile(S,s.name,s);
 assert.ok(!(p.reserve>0));
});
