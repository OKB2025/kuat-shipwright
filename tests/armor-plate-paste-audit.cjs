// Regression review 2026-11-14: parts pasted from an old clipboard do not pass through deserialize. The editor's paste
// drops `light` and runs Core.convertArmorPlates on the live ship; this checks that conversion on a live ship (a plate
// pushed into ship.parts, as the paste does) and that the editor's paste calls it. Not a browser check.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),plain=x=>JSON.parse(JSON.stringify(x));
test('a plate pushed into a live ship (as a paste does) becomes a structure with its thickness on its faces, once',()=>{
 const s=C.deserialize(C.serialize(C.newShip({L:300,W:200,H:160,assembly:true,plan:'rect',sec:'rect'},'paste')));s.parts=[];s.fits=[];s.nextId=1;s.armor={hull:0,cit:0};s.detail=0;
 C.placePart(s,'struct',[100,100,0],[40,20,40],{form:'box'},false);const before=plain(C.serialize(s));
 const q={id:s.nextId++,k:'struct',form:'box',c:[100,112,0],s:[10,10,4],plate:true,plateT:.3};s.parts.push(q);
 assert.equal(C.convertArmorPlates(s)>0,true);assert.equal(q.plate,undefined);assert.equal(q.plateT,undefined);
 const faces=C.structureArmorFaces(s,q.id);assert.ok(faces.length>0);for(const f of faces)assert.ok(Math.abs(f.thickness-.3)<1e-9,'face '+f.id+' '+f.thickness);
 assert.equal(C.convertArmorPlates(s),0,'a second pass finds no plate and adds nothing');for(const f of C.structureArmorFaces(s,q.id))assert.ok(Math.abs(f.thickness-.3)<1e-9);
 const L=C.deserialize(plain(C.serialize(s)));for(const f of C.structureArmorFaces(L,q.id))assert.ok(Math.abs(f.thickness-.3)<1e-9,'the same after save and reload');
 assert.ok(!JSON.stringify(C.serialize(s)).includes('"plate"'));
 const U=C.deserialize(before);assert.equal(U.parts.length,1,'the state before the paste (Undo snapshot) has no trace of it');assert.equal((U.surfaces?.patches||[]).filter(p=>p.armor?.thickness>0).length,0);
});
test('the editor paste drops light and converts plates on the live ship',()=>{
 const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),a=app.indexOf('個を貼り付け'),b=app.indexOf('remapPlacementCopy',a),body=app.slice(a,b);assert.ok(a>0&&b>a);
 assert.match(body,/if\(l==='parts'\)delete q\.light;/);assert.match(body,/C\.convertArmorPlates\?\.\(ship\);/);
});
