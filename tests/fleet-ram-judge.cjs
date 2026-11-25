// 2026-11-25 Ramming is taken into account (user「ハンマーヘッドはハンマー部分の装甲を厚くして体当たり攻撃も視野に入れて」). A collision already
// hurts each hull by the plating where it is struck (hullImpact). fleetRamJudge says when a ship ordered to attack should
// ram: the blow costs the target at least RAM.margin times what it costs the ship, costs the ship no more than RAM.ownMax of
// its structure, and its guns cannot outrun what the target's field brings back.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const C=vm.runInContext('Core',context),six=v=>[v,v,v,v,v,v];
// Five sections of six faces (fore, aft, the four sides): every face `plate` metres, the bow section's fore face `bow`.
function profile({len=120,plate=.2,bow=plate,gun=0,D=1,speed=1200}={}){const zA=[],zT=[];for(let s=0;s<5;s++)for(let f=0;f<6;f++){zA.push(100);zT.push(s===4&&f===0?bow:plate);}
 return {name:'Ram fixture',profileVersion:28,hp:100,D,shieldBuffer:10,reserve:0,wCap:0,crewNeed:1,crewMax:1,len,width:len*.3,height:len*.25,maxSpeed:speed,turnRate:.2,accel:60,acc:1,aa:0,armorHull:0,zA,zT,
  gunArcs:six(gun),ionArcs:six(0),gunBands:{long:six(gun),mid:six(0),close:six(0)},gunBandRules:{long:gun>0?[{w:gun,kind:'turbolaser',holdM:10000,rangeM:12000,fadeM:0}]:[],mid:[],close:[]},ionRules:[],energyModel:{version:1,eta:.95},weaponCharge:1,modules:[],grid:{P:1e30}};}
// fleetUnit works a profile's top speed out from its propulsion; the fixture has none, so the speed is stated on the unit.
const unit=(p,team=0)=>{const u=C.fleetUnit('u'+team,'fixture',p,team);u.p={...u.p,maxSpeed:p.maxSpeed};return u;};
test('a thick bow against an equal thin hull, with guns that cannot beat its field: ram',()=>{
 const a=unit(profile({bow:2})),z=unit(profile({}),1);assert.equal(C.fleetRamJudge(a,z),true);
 assert.equal(C.fleetRamJudge(z,a),false,'the thin ship does not ram: the blow would cost it as much as its target');
});
test('the same bow does not ram a ship far heavier than itself',()=>{
 const a=unit(profile({bow:2})),big=unit(profile({len:1200}),1);assert.equal(C.fleetRamJudge(a,big),false);
});
test('a ship whose guns outrun the target\'s field shoots instead',()=>{
 const z=unit(profile({D:1}),1),a=unit(profile({bow:2,gun:100}));assert.equal(C.fleetRamJudge(a,z),false);
 const down=unit(profile({}),1);down.shield=0;assert.equal(C.fleetRamJudge(unit(profile({bow:2,gun:1e-9})),down),false,'with the field down any gun decides');
});
test('worn bow plating ends the ramming',()=>{
 const a=unit(profile({bow:2})),z=unit(profile({}),1);assert.equal(C.fleetRamJudge(a,z),true);a.zi=a.zi.map(()=>.05);assert.equal(C.fleetRamJudge(a,z),false);
});
test('the judgement reads characteristics, not the kind of unit, and leaves craft to their own rules',()=>{
 const a=unit(profile({bow:2})),craft=unit({...profile({len:12}),cls:{craft:true}},1);assert.equal(C.fleetRamJudge(a,craft),false);assert.equal(C.fleetRamJudge(craft,a),false);
 const named=unit({...profile({bow:2}),cls:{name:'輸送船',role:'輸送'}});assert.equal(C.fleetRamJudge(named,unit(profile({}),1)),true);
});
test('the Sphyrna example carries thicker plating on its hammer only',()=>{
 const s=C.buildDesign('hammerhead'),hull=s.parts.find(p=>p.skinAsset==='sphyrna_hull'),F=C.structureArmorFaces(s,hull),head=F.filter(q=>q.center[0]>=88),rest=F.filter(q=>q.center[0]<88);
 assert.ok(head.length>0&&rest.length>0);
 for(const q of head)assert.equal(q.thickness,q.face==='fore'?2:q.face==='aft'?.2:.6,`${q.face} at x ${q.center[0].toFixed(1)}`);
 for(const q of rest)assert.equal(q.thickness,.2,`${q.face} at x ${q.center[0].toFixed(1)}`);
 assert.equal(s.parts.filter(p=>C.isStructuralPart(p)).length,1,'no structure is added: the plating is a surface setting');
});
