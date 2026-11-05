const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),context,{filename:f});
const C=vm.runInContext('Core',context),plain=x=>JSON.parse(JSON.stringify(x));
function fixture(thermal='high'){
 const s=C.newShip({L:8,W:4,H:2,assembly:true});
 const w=C.placePart(s,'struct',[4,1,3],[2,3,.06],{form:'box',wing:{thermal,foil:true,axis:'x',open:15,stow:0,T:1}},false);
 C.placePart(s,'gen',[4,1,0],.5,{allowOverlap:true},false);
 return {s,w};
}

test('small metric machinery, thin rooms and cutters survive the complete loader',()=>{
 const s=C.newShip({L:100,W:50,H:20});
 assert.ok(C.partLimits(s,'sensor').min<1);
 const p=C.placePart(s,'sensor',[20,10,0],.375,{allowOverlap:true},false);
 const r=C.placePart(s,'battery',[30,10,0],.1,{room:[.2,.3,.025],allowOverlap:true},false);
 const d=C.placePart(s,'hdis',[40,10,0],.05,{allowOverlap:true},false);
 s.solidCuts=[C.normalizeSolidCut({id:s.nextId++,c:[50,10,0],s:[.125,.375,.025]})];
 const restored=C.deserialize(C.serialize(s));
 assert.equal(restored.parts.find(q=>q.id===p.id).d,.375);
 assert.deepEqual(plain(restored.parts.find(q=>q.id===r.id).room),[.2,.3,.025]);
 assert.equal(restored.parts.find(q=>q.id===d.id).d,.05);
 assert.deepEqual(plain(restored.solidCuts[0].s),[.125,.375,.025]);
});

test('the shaped wing itself supplies one surface-sized heat sink without an internal external device',()=>{
 const {s,w}=fixture(),S=C.computeStats(s),d=S.heat.net.dis.filter(d=>d.part===w.id);
 assert.equal(Object.hasOwn(C.PARTS,'hdisx'),false);
 assert.equal(Object.hasOwn(C.DISSIPATORS,'hdisx'),false);
 assert.equal(d.length,1);assert.equal(d[0].k,'wing');assert.equal(d[0].grade,'high');
 assert.equal(d[0].cap,C.wingCap(w,S));assert.ok(d[0].cap>0);
 assert.equal(d[0].cs,C.WING.stowK.wing);
 assert.ok(S.wings[0].capOpen>S.wings[0].capStow);
 assert.equal(S.warnings.some(w=>w.code==='wing-empty'),false);
 const changed=JSON.parse(C.publicJSON(w));changed.s[1]*=2;
 assert.ok(C.wingCap(changed)>C.wingCap(w));
});

test('a low-temperature wing cannot accept reactor waste heat',()=>{
 const {s,w}=fixture('low'),S=C.computeStats(s),N=C.heatNetwork(s,S),di=N.dis.findIndex(d=>d.part===w.id);
 assert.equal(N.dis[di].grade,'low');assert.ok(N.dis[di].cap>0);
 for(const l of N.links.filter(l=>l.d===di))assert.equal(N.src[l.s].grade,'low');
});

test('a sub-cubic-metre wing is a damageable dissipator in a fleet heat profile',()=>{
 const {s,w}=fixture(),S=C.computeStats(s),p=C.fleetProfile(S,s.name,s),mi=p.modules.findIndex(m=>m.part===w.id);
 assert.ok(C.partVolume(w)<1);assert.ok(mi>=0);assert.equal(p.modules[mi].k,'dissipator');
 const d=p.heat.dis.find(d=>d.m===mi);assert.ok(d);assert.equal(d.cap,C.wingCap(w,S));
 const u=C.fleetUnit('wing-test','test',p,0),mods=u.mods.slice();C.heatInit(u);C.allocateShipPower(u,C.fleetSystems(u),{throttle:0,weapons:0,shields:0},10,'balanced');C.heatTick({time:10},u,10);const intact=u.ht.cap;
 u.mods=mods;u.mods[mi]=0;C.heatInit(u);C.allocateShipPower(u,C.fleetSystems(u),{throttle:0,weapons:0,shields:0},10,'balanced');C.heatTick({time:20},u,10);
 assert.ok(u.ht.cap<intact,'destroying the wing removes its heat-rejection capacity');
});

test('a standalone retired external device retains its measured room geometry and linked identity',()=>{
 const s=C.newShip({L:8,W:4,H:2}),o=C.serialize(s);
 o.parts=[{id:1,k:'hdisx',c:[4,1,-3],d:1,room:[2,3,.064],corner:.15,aftWidth:.8,foreWidth:.6,yaw:12,roll:3,label:'saved panel'}];o.nextId=2;
 o.links=[{kind:'heat',from:'p9',to:'p1'}];const before=JSON.stringify(o),loaded=C.deserialize(o),p=loaded.parts[0];
 assert.equal(JSON.stringify(o),before,'loading does not mutate the saved source');
 assert.equal(p.id,1);assert.equal(p.k,'wing');assert.equal(p.form,'chamfer');assert.equal(p.wing.thermal,'high');
 assert.deepEqual(plain(p.s),[2,3,.064]);assert.deepEqual(plain(p.c),[4,1,-3]);assert.equal(p.corner,.15);assert.equal(p.yaw,12);assert.equal(p.roll,3);
 assert.deepEqual(plain(loaded.links),o.links);
 const again=C.deserialize(C.serialize(loaded));assert.deepEqual(plain(again.parts[0].s),plain(p.s));assert.deepEqual(plain(again.parts[0].wing),plain(p.wing));
});

test('legacy nested external devices merge into their host wing and retarget manual heat links',()=>{
 const {s,w}=fixture(),o=C.serialize(s),source=o.parts.find(p=>p.k==='gen');
 o.parts.push({id:10,k:'hdisx',c:plain(w.c),d:.04,label:'old embedded box'});o.nextId=11;
 o.links=[{kind:'heat',from:'p'+source.id,to:'p10'}];
 const loaded=C.deserialize(o);assert.equal(loaded.parts.some(p=>p.k==='hdisx'||p.id===10),false);
 const host=loaded.parts.find(p=>p.id===w.id);assert.deepEqual(plain(host.s),plain(w.s));assert.equal(host.wing.foil,true);
 assert.equal(loaded.links[0].to,'p'+w.id);
 assert.equal(C.computeStats(loaded).heat.net.dis.filter(d=>d.part===w.id).length,1);
});
