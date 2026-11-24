// 2026-11-24 deserialize wraps a part's pitch and roll outside ±180 to the same pose instead of clamping them to ±180
// (the user's BTL-A4 remodel stores ring braces at roll 225 and 315, which the clamp turned to 180).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx);
function ship(angles){const s=C.newShip({L:40,W:20,H:10,assembly:true},'Angles');s.parts=[];s.fits=[];s.nextId=1;
 angles.forEach(([pitch,roll],i)=>{const p=C.placePart(s,'struct',[10+i*3,5,0],[1,.6,.1],{form:'box'});p.pitch=pitch;p.roll=roll;});return s;}
// In range (±180 inclusive) a stored angle loads exactly as stored (no float drift; -180 as the vertical mirror writes it).
test('pitch and roll outside ±180 load as the same pose, inside it unchanged; a save and reload keeps them',()=>{
 const cases=[[0,225,-135],[0,315,-45],[0,-180,-180],[0,180,180],[0,30.1,30.1],[0,-179.999999,-179.999999],[0,-200,160],[0,540,180],[0,-8,-8],[0,8,8]];
 const s=ship(cases.map(([p,r])=>[p,r]));const raw=JSON.parse(JSON.stringify(C.serialize(s)));
 raw.parts.forEach((p,i)=>{p.roll=cases[i][1];p.pitch=i===0?370:p.pitch;});
 const a=C.deserialize(JSON.parse(JSON.stringify(raw)));
 a.parts.forEach((p,i)=>assert.strictEqual(p.roll,cases[i][2],'roll '+cases[i][1]));assert.equal(a.parts[0].pitch,10,'pitch 370');
 const b=C.deserialize(JSON.parse(JSON.stringify(C.serialize(a))));assert.deepEqual(b.parts.map(p=>[p.pitch,p.roll]),a.parts.map(p=>[p.pitch,p.roll]),'round trip');
});
test('a non-finite stored angle loads as 0',()=>{
 const raw=JSON.parse(JSON.stringify(C.serialize(ship([[0,0]]))));raw.parts[0].roll='x';raw.parts[0].pitch=null;
 const a=C.deserialize(raw);assert.equal(a.parts[0].roll,0);assert.ok(!a.parts[0].pitch);
});
test('the BTL-A4 example keeps its ring braces turned',()=>{
 const s=C.buildDesign('craft_ywing');assert.deepEqual([60,62,71,73].map(id=>s.parts.find(p=>p.id===id).roll),[-135,-45,-135,-45]);
});
