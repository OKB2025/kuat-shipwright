const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),plain=x=>JSON.parse(JSON.stringify(x)),near=(a,b,why)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1e-6,Math.abs(b)*1e-7),`${why}: ${a} != ${b}`);
function ship(){const s=C.deserialize(C.serialize(C.newShip({L:360,W:240,H:180,assembly:true,plan:'rect',sec:'rect'},'Structure armor fixture')));s.parts=[];s.fits=[];s.nextId=1;s.armor={hull:0,cit:0};s.detail=0;delete s.surfaces;return s;}
function box(s,c=[180,80,0],size=[48,36,24],options={},mirror=false){const p=C.placePart(s,'struct',c,size,{form:'box',skin:'service',paint:'#425263',bands:[[.1,.2]],...options},mirror);assert.ok(p?.id);return p;}
const faces=(s,p)=>C.surfacePatches(s).filter(q=>q.host==='p'+p.id),record=(s,id)=>s.surfaces.patches.find(q=>q.id===id);
function assertArmorOnly(s){for(const q of s.surfaces?.patches||[]){assert.equal(q.functionMode,'armor');assert.equal(q.equipment?.count||0,0);assert.equal(q.battery?.count||0,0);assert.equal(q.aggregate?.cells?.length||0,0);assert.equal(q.aggregate?.guns?.length||0,0);}assert.equal(C.surfaceDerivedFits(s).length,0);assert.ok(s.parts.every(p=>!p.surfacePatch));assert.ok(s.fits.every(f=>!f.surfacePatch));}
function historical(){
 const s=ship(),host=box(s,[160,80,0],[120,60,40],{yaw:17,pitch:9,roll:6}),manual=C.placePart(s,'sensor',[280,80,60],3,{allowOverlap:true},false),manualFit={id:s.nextId++,k:'pd',p:[285,100,80],a:2,ped:0,base:0,low:0,slope:0,float:true};s.fits.push(manualFit);
 const patches=faces(s,host),equipment=patches.find(q=>q.face==='port'),armor=patches.find(q=>q.face==='top'),legacy=patches.find(q=>q.face==='bottom'),base=id=>plain(C.surfaceConfig(s,id)),row={...base(equipment.id),authored:true,functionMode:'equipment',armor:{material:'dense',thickness:.8},equipment:{kind:'hdis',count:1,depth:1},battery:{weapon:'pd',count:1,spacing:2,angle:0,reversed:false},style:{kind:'machinery',depth:3,density:.5,seed:37},aggregate:{version:1,signature:'old-equipment-ledger',cells:[[4,1,0,0,160,80,-29,2,2,1,0,0,-1,0,160,80,-30,2,2,1,1,4,4,16,.1,.3,'e0','multi',1]],guns:[[5,'pd',170,80,-30,5,0,0,-1,170,80,-30,2,2,.2,0,0,0,0,1,'w0']],requested:1,requestedEquipment:1,errors:[]}};
 const state=plain(C.serialize(s));state.surfaces={version:4,mode:'strict',compatAllowed:true,legacyArmor:0,patches:[row,{...base(armor.id),authored:true,functionMode:'armor',armor:{material:'light',thickness:.65}},{...base(legacy.id),authored:true,functionMode:'legacy',armor:{material:'standard',thickness:.45},equipment:{kind:'hdis',count:1,depth:1},battery:{weapon:'pd',count:1,spacing:2,angle:0,reversed:false},style:{kind:'machinery',depth:2,density:.5,seed:19}}]};
 state.parts.push({id:6,k:'hdis',c:[160,80,-29],d:1,room:[2,2,1],surfaceNormal:[0,0,-1],surfacePatch:equipment.id,surfaceCell:'e0',surfaceRole:'cooling'});state.fits.push({id:7,k:'pd',p:[170,80,-30],a:5,n:[0,0,-1],ped:0,base:0,low:0,slope:0,surfacePatch:equipment.id,surfaceCell:'w0',surfaceRole:'weapons'});state.nextId=8;
 return {state,host:host.id,manual:manual.id,manualFit:manualFit.id,equipment:equipment.id,armor:armor.id,legacy:legacy.id};
}

test('ordinary structures retain their skin and do not create automatic machinery or a separate catalog type',()=>{
 const s=ship(),p=box(s),before=plain(C.serialize(s).parts);assert.equal(C.PARTS.surfaceStruct,undefined);assert.equal(C.isStructuralPart(p),true);assert.equal(C.isStructuralPart({k:'wing'}),false);C.surfaceSync(s);
 const rows=C.structureArmorFaces(s,p);assert.deepEqual(plain(rows.map(q=>q.face).sort()),['aft','bottom','fore','port','stbd','top']);assert.ok(rows.every(q=>q.thickness===0));assert.deepEqual(plain(C.serialize(s).parts),before,'surveying armor cannot change the existing skin, paint, bands or position');assert.equal(C.surfaceDerivedFits(s).length,0);assert.ok(!s.surfaces||s.surfaces.patches.every(q=>q.functionMode==='armor'));
});

test('the six local armor thicknesses on a rotated structure survive synchronization and save',()=>{
 const s=ship(),p=box(s,[180,80,45],[48,36,24],{yaw:31,pitch:17,roll:23},true),native=plain(C.serialize(s).parts),thickness={fore:.2,aft:.3,top:1.4,bottom:0,port:.65,stbd:3};assert.ok(p.tw);
 for(const [face,t]of Object.entries(thickness)){const result=C.setStructureFaceArmor(s,p.id,face,t);assert.equal(result.ok,true,result.why);}
 for(const q of C.structureArmorFaces(s,p))near(q.thickness,thickness[q.face],q.face+' uses the part local frame');C.surfaceSync(s);assertArmorOnly(s);assert.deepEqual(plain(C.serialize(s).parts),native);
 const saved=plain(C.serialize(s)),loaded=C.deserialize(plain(saved));C.surfaceSync(loaded);for(const q of C.structureArmorFaces(loaded,p.id))near(q.thickness,thickness[q.face],q.face+' is persisted');assert.deepEqual(plain(C.serialize(loaded)),saved,'repeated armor-only save is stable');
});

test('hidden armor assignments and face identities survive enclosure, reload and separation',()=>{
 const s=ship(),host=box(s,[100,80,0],[40,30,20]);assert.equal(C.setStructureFaceArmor(s,host.id,'port',.27).ok,true);const id=faces(s,host).find(q=>q.face==='port').id;box(s,[100,80,0],[80,60,40]);C.surfaceSync(s);assert.ok(faces(s,host).every(q=>!q.exposed));near(record(s,id).armor.thickness,.27,'buried assignment');
 const loaded=C.deserialize(C.serialize(s)),restored=loaded.parts.find(p=>p.id===host.id);near(C.structureArmorFaces(loaded,restored).find(q=>q.face==='port').thickness,.27,'hidden load');restored.c=[260,80,0];C.surfaceSync(loaded);const face=faces(loaded,restored).find(q=>q.face==='port');assert.equal(face.id,id);assert.equal(face.exposed,true);near(record(loaded,id).armor.thickness,.27,'separation restores the same assignment');assertArmorOnly(loaded);
});

test('a local armor override changes only its own material budget and retains other faces armor',()=>{
 const s=ship();s.armor.hull=.4;const p=box(s),top=faces(s,p).find(q=>q.face==='top'),before=C.computeStats(s);assert.equal(C.setStructureFaceArmor(s,p.id,'top',.7).ok,true);const after=C.computeStats(s);
 for(const q of C.structureArmorFaces(s,p))near(q.thickness,q.face==='top'?.7:.4,q.face+' armor budget');near(after.armorMass-before.armorMass,top.exposedArea*.3*C.K.armorDens,'only the changed face adds armor material');near(after.mass-before.mass,after.armorMass-before.armorMass,'no equipment hardware is created with the override');assertArmorOnly(s);
});

test('old equipment faces become bare armor while authored armor and manual hardware remain',()=>{
 const {state,host,manual,manualFit,equipment,armor,legacy}=historical(),native=plain(state.parts.filter(p=>!p.surfacePatch)),loaded=C.deserialize(plain(state));C.surfaceSync(loaded);assertArmorOnly(loaded);
 near(record(loaded,equipment).armor.thickness,0,'an equipment face becomes armor zero');near(record(loaded,armor).armor.thickness,.65,'an authored armor face keeps its thickness');near(record(loaded,legacy).armor.thickness,.45,'legacy mixed mode keeps its actual authored armor');assert.equal(record(loaded,armor).armor.material,'light');
 assert.ok(loaded.parts.some(p=>p.id===manual));assert.ok(loaded.fits.some(f=>f.id===manualFit));assert.equal(loaded.parts.find(p=>p.id===host).skin,'service');assert.deepEqual(plain(C.serialize(loaded).parts),native,'migration preserves original independent parts and the host skin');assert.equal(loaded.parts.length,2);assert.equal(loaded.fits.length,1);const report=C.surfaceReport(loaded);assert.ok(report.patches.every(q=>q.installedEquipment===0&&q.installed===0));
 const saved=plain(C.serialize(loaded)),again=C.deserialize(plain(saved));C.surfaceSync(again);assertArmorOnly(again);assert.deepEqual(plain(C.serialize(again)),saved,'the clean saved design cannot regenerate deleted face machinery or reuse their identities');
});

test('runtime synchronization also removes historical face ledgers without removing manual installations',()=>{
 const {state,equipment,manual,manualFit}=historical();C.surfaceSync(state);assertArmorOnly(state);near(record(state,equipment).armor.thickness,0,'runtime migration armor');assert.ok(state.parts.some(p=>p.id===manual));assert.ok(state.fits.some(f=>f.id===manualFit));const saved=plain(C.serialize(state));assert.ok(saved.surfaces.patches.every(q=>q.functionMode==='armor'));assert.ok(saved.parts.every(p=>!p.surfacePatch));assert.ok(saved.fits.every(f=>!f.surfacePatch));
});
