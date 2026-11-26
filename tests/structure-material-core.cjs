const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});const C=vm.runInContext('Core',cx),plain=x=>JSON.parse(JSON.stringify(x)),near=(a,b,why='material budget',eps=1e-6)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(eps,Math.abs(b)*1e-7),`${why}: ${a} != ${b}`);
function ship(){const s=C.deserialize(C.serialize(C.newShip({L:300,W:200,H:160,assembly:true,plan:'rect',sec:'rect'},'Material union')));s.parts=[];s.fits=[];s.nextId=1;s.armor={hull:0,cit:0};s.detail=0;return s;}
function box(s,c=[100,100,0],size=[10,10,10],options={}){const p=C.placePart(s,'struct',c,size,{form:'box',...options},false);assert.ok(p?.id);return p;}

test('three overlapping blocks and a separate block contribute one real envelope and one material bill',()=>{
 // 2026-11-26 expectation changed (the repulsorlift is carried for the mass without a part: user decision 2026-11-26, C.REPULSORLIFT): S.mass was 3000 x structDens -> S.mass less the carried lift's own mass (S.repulsorlift.mass) is 3000 x structDens; S.cost was 3000 x struct cost -> that plus the lift's price (S.repulsorlift.cost = volume x 1 + 3500), in whole credits as S.cost is. The material bill itself is unchanged.
 const s=ship(),parts=[box(s),box(s,[105,100,0]),box(s,[110,100,0]),box(s,[125,100,0])],raw=plain(C.serialize(s).parts),S=C.computeStats(s);near(S.volume,3000);near(S.mass-S.repulsorlift.mass,3000*C.K.structDens);near(S.cost,Math.round(3000*C.PARTS.struct.cost+S.repulsorlift.cost));for(let i=0;i<parts.length;i++){near(C.partVolume(parts[i]),1000);near(S.info[parts[i].id].materialVolume,[1000,500,500,1000][i]);}assert.deepEqual(plain(C.serialize(s).parts),raw);const again=C.computeStats(C.deserialize(C.serialize(s)));near(again.mass,S.mass);near(again.cost,S.cost);near(again.volume,S.volume);
});

// 2026-11-14 user decisions (replaces three tests that required a denser block to own an overlap, and plates and wings
// to keep their full hardware mass inside other material): there is one kind of structure (no light structures, no
// armour plates); every overlap is counted once; a structure owns its overlap with a wing; armour is a surface setting
// weighted by exposed area.
const reload=s=>C.deserialize(plain(C.serialize(s)));
test('a light flag is ignored: coincident blocks count once and the earlier part owns the overlap, in any array order',()=>{
 const s=ship(),first=box(s,[100,100,0],[10,10,10],{light:true}),second=box(s),S=C.computeStats(s),single=ship();box(single);const expected=C.computeStats(single);assert.equal(first.light,undefined,'no light structures');near(S.mass,expected.mass);near(S.hp,expected.hp);near(S.aStruct,expected.aStruct);near(S.info[first.id].materialVolume,1000);near(S.info[second.id].materialVolume,0);s.parts.reverse();const reordered=C.computeStats(s);near(reordered.mass,S.mass);near(reordered.hp,S.hp);near(reordered.cost,S.cost);
 const saved=plain(C.serialize(single));saved.parts[0].light=true;const L=C.deserialize(saved);assert.equal(L.parts[0].light,undefined,'a saved light structure loads as an ordinary structure');near(C.computeStats(L).mass,expected.mass);
});

test('a saved armour plate becomes an ordinary structure with its thickness on its own faces; armour weighs by exposed area',()=>{
 const raw=ship();box(raw,[100,100,0],[10,10,1],{plate:true,plateT:.3});const alone=reload(raw),P=C.computeStats(alone),part=alone.parts[0];
 assert.equal(part.plate,undefined);assert.equal(part.plateT,undefined);assert.ok(!JSON.stringify(C.serialize(alone)).includes('"plate"'),'saved again without a plate');
 const faces=C.structureArmorFaces(alone,part.id);assert.equal(faces.length,6);for(const f of faces)near(f.thickness,.3,'the face takes the plate thickness (base 0)');
 // 2026-11-26 expectation changed (the repulsorlift is carried for the mass without a part: user decision 2026-11-26, C.REPULSORLIFT): P.mass was structure + armour -> P.mass less the carried lift's own mass (P.repulsorlift.mass) is structure + armour.
 near(P.armorMass,240*.3*C.K.armorDens,'armour = exposed area x thickness');near(P.mass-P.repulsorlift.mass,100*C.K.structDens+240*.3*C.K.armorDens,'the body is an ordinary structure');near(P.plateMass||0,0);
 const based=ship();based.armor.hull=.5;box(based,[100,100,0],[10,10,1],{plate:true,plateT:.3});for(const f of C.structureArmorFaces(reload(based),1))near(f.thickness,.8,'the plate thickness is added to the face armour');
 const s=ship();box(s,[100,100,0],[20,20,20]);box(s,[100,100,0],[10,10,1],{plate:true,plateT:.3});const L=reload(s),buried=C.computeStats(L);
 // 2026-11-26 expectation changed (the repulsorlift is carried for the mass without a part: user decision 2026-11-26, C.REPULSORLIFT): buried.mass was 8000 x structDens -> buried.mass less the carried lift's own mass is 8000 x structDens.
 near(buried.mass-buried.repulsorlift.mass,8000*C.K.structDens,'a buried former plate adds neither material nor armour');near(buried.armorMass,0);near(buried.info[2].materialVolume,0);near(buried.volume,8000);
 L.parts[1].c=[150,100,0];C.surfaceSync(L);const exposed=C.computeStats(L);near(exposed.mass,buried.mass+P.mass,'moved outside it weighs what it weighs alone');near(exposed.armorMass,P.armorMass);
 const again=reload(L);near(C.computeStats(again).mass,exposed.mass,'unchanged by save and load');
});

test('coincident wings are counted once: the second adds no material',()=>{
 const wings=ship(),first=C.placePart(wings,'wing',[100,100,0],[20,8,.6],{},false);assert.ok(first);const one=C.computeStats(wings),second=C.placePart(wings,'wing',[100,100,0],[20,8,.6],{},false);assert.ok(second);const two=C.computeStats(wings);
 assert.equal(C.PARTS.wing.dens,C.K.structDens,'a wing has the density of a structure');near(two.mass-two.wingMass,one.mass-one.wingMass,'the overlap is counted once');near(two.info[first.id].materialMass,C.partVolume(first)*C.K.structDens);near(two.info[second.id].materialMass,0);assert.ok(one.wingMass>0&&two.wingMass>one.wingMass,'each wing still carries its mechanism mass');near(two.volume,one.volume,'coincident hardware has one outer envelope');
 const mixed=ship(),body=box(mixed,[100,100,0],[20,8,4]),wing=C.placePart(mixed,'wing',[100,100,0],[20,8,.6],{},false),M=C.computeStats(mixed);near(M.info[body.id].materialVolume,640,'the structure owns its overlap with a wing');near(M.info[wing.id].materialVolume,0);
});

// 2026-11-14 user decisions: a hangar or cargo hold is empty space, so its volume inside a structure is not structure
// material; an empty cargo hold weighs like an empty hangar; other rooms do not displace structure; machinery is dense.
test('a hangar or cargo hold inside a structure takes its volume off the structure material; other rooms do not',()=>{
 const mk=rooms=>{const s=C.newShip({L:300,W:200,H:160,assembly:true},'void');Object.assign(s,{parts:[{id:1,k:'struct',form:'box',c:[100,50,0],s:[100,100,100]}],fits:[],hatches:[],links:[],groups:[],nextId:2,autoHabitation:false,detail:0});s.armor={hull:0,cit:0};for(const k of rooms)s.parts.push({id:s.nextId++,k,c:[100,50,0],room:[90,90,90],s:[90,90,90]});const L=C.deserialize(plain(C.serialize(s)));C.syncCompartments(L);return C.computeStats(L);};
 // 2026-11-26 expectation changed (the repulsorlift is carried for the mass without a part: user decision 2026-11-26, C.REPULSORLIFT): solid.mass was 1e6 x structDens -> solid.mass less the carried lift's own mass is that; the same for S.mass on the next line (structure around the bay plus the empty bay).
 const solid=mk([]);near(solid.mass-solid.repulsorlift.mass,1e6*C.K.structDens);
 for(const k of ['hangar','cargo']){const S=mk([k]);near(S.info[1].materialVolume,1e6-729000,k+': the bay volume is not structure');near(S.mass-S.repulsorlift.mass,(1e6-729000)*C.K.structDens+729000*C.PARTS[k].dens,k+': structure around the bay plus the empty bay',1);}
 assert.equal(C.PARTS.cargo.dens,C.PARTS.hangar.dens,'an empty cargo hold weighs like an empty hangar');
 const other=mk(['habitat']);near(other.info[1].materialVolume,1e6,'a habitat does not displace structure');
 assert.deepEqual([C.PARTS.gen.dens,C.PARTS.aux.dens,C.PARTS.engine.dens,C.PARTS.engineCore.dens,C.PARTS.machinery.dens,C.PARTS.hdis.dens,C.PARTS.automation.dens,C.PARTS.firecontrol.dens,C.PARTS.navComputer.dens,C.PARTS.targetComputer.dens,C.PARTS.sensor.dens,C.PARTS.scanner.dens],[1.8,1.8,1.1,1.1,1.1,1,.6,.76,.6,.6,.36,.3],'machinery carries twice its earlier density');
});

test('face armor follows the merged outer skin while hidden assignments survive and restore when separated',()=>{
 // 2026-11-26 expectation changed (the repulsorlift is carried for the mass without a part: user decision 2026-11-26, C.REPULSORLIFT): S.mass was 1500 x structDens + 800 x .2 x armorDens -> S.mass less the carried lift's own mass is that; the two separated boxes' S.cost was single.cost x 2 -> single.cost x 2 less one C.REPULSORLIFT.install (a design pays the 3500 installation once; the per-volume part of the lift's price doubles with the mass).
 const s=ship(),a=box(s);s.armor.hull=.2;assert.equal(C.enableSurfaceMode(s).ok,true);const original=plain(C.serialize(s).surfaces.patches),single=C.computeStats(s),b=box(s);for(const q of original){const copy=plain(q);copy.id=copy.id.replace('p'+a.id+':','p'+b.id+':');s.surfaces.patches.push(copy);}C.surfaceSync(s);let S=C.computeStats(s);near(S.armorMass,single.armorMass,'coincident armor sheets count once');near(S.mass,single.mass);near(S.cost,single.cost);assert.ok(C.surfacePatches(s).filter(p=>p.host==='p'+b.id).every(p=>!p.exposed));assert.ok(s.surfaces.patches.some(q=>q.id.startsWith('p'+b.id+':')&&q.armor.thickness===.2),'hidden assignments remain editable design data');b.c[0]=105;C.surfaceSync(s);S=C.computeStats(s);near(S.armorMass,800*.2*C.K.armorDens,'partial overlap has an800m² outer union');near(S.mass-S.repulsorlift.mass,1500*C.K.structDens+800*.2*C.K.armorDens);b.c[0]=125;C.surfaceSync(s);S=C.computeStats(s);near(S.armorMass,single.armorMass*2);near(S.mass,single.mass*2);near(S.cost,single.cost*2-C.REPULSORLIFT.install);assert.equal(s.parts.length,2);
});

test('rigid rotation and a real small gap do not turn overlapping world bounds into shared material',()=>{
 // 2026-11-26 expectation changed (the repulsorlift is carried for the mass without a part: user decision 2026-11-26, C.REPULSORLIFT): S.mass was 2000 x structDens -> S.mass less the carried lift's own mass is 2000 x structDens (tolerance unchanged).
 const s=ship(),rotation={yaw:31,pitch:17,roll:23},a=box(s,[100,100,0],[10,10,10],rotation),b=box(s,C.worldStruct(a,[10.01,0,0]),[10,10,10],rotation),S=C.computeStats(s);assert.ok(C.partAABB(a).every(Number.isFinite));near(S.mass-S.repulsorlift.mass,2000*C.K.structDens,'rotated airgap keeps both solids',.003);near(S.volume,2000,'rotated gross volume',.003);near(S.info[a.id].materialVolume,1000,'first solid',.003);near(S.info[b.id].materialVolume,1000,'second solid',.003);
});

// Physics review 2026-11-14: the union starts from the hull, so a place inside the hull material belongs to the hull.
// A bay there is not taken off another structure that overlaps the hull at that place (it used to be, a double
// subtraction hidden by the clamp at 0). A bay in the part of the structure outside the hull still is.
test('a bay inside the hull is not taken off a structure that overlaps the hull there; a bay outside the hull is',()=>{
 const mk=at=>{const s=C.deserialize(plain(C.serialize(C.newShip({L:300,W:60,H:40},'void in hull'))));s.autoHabitation=false;s.armor={hull:0,cit:0};const st={id:s.nextId++,k:'struct',form:'box',c:[150,20,0],s:[40,40,40]};s.parts.push(st);let bay=null;if(at){bay={id:s.nextId++,k:'hangar',c:at,room:[20,8,20],s:[20,8,20]};s.parts.push(bay);}const L=C.deserialize(plain(C.serialize(s)));C.syncCompartments(L);const S=C.computeStats(L);return {S,st:S.info[st.id].materialVolume,L,bay};};
 const none=mk(null),inHull=mk([150,8,0]),outside=mk([150,32,0]);
 assert.ok(none.st>1000&&none.st<64000-1000,'the structure is partly inside the hull: '+none.st);
 assert.ok([4.5,8,11.5].every(y=>C.inHull(inHull.L,[150,y,0]))&&![28.5,32,35.5].some(y=>C.inHull(outside.L,[150,y,0])),'the two bay positions are inside and outside the hull');
 near(inHull.st,none.st,'a bay in the hull leaves the overlapping structure as it is',1);
 const off=none.st-outside.st;assert.ok(off>.85*20*8*20&&off<=20*8*20+1,'a bay in the structure outside the hull is taken off it (by sample points): '+off);
});
