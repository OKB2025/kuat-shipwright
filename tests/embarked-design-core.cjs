const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const C=vm.runInContext('Core',context),plain=x=>JSON.parse(JSON.stringify(x));
const ship=C.newShip({L:80,W:20,H:12},'User corvette');ship.shipClass='corvette';
ship.parts=[{id:1,k:'gen',c:[30,5,0],d:3},{id:2,k:'engine',c:[8,5,0],d:2,dir:[-1,0,0],reactor:1,engineLength:16},{id:3,k:'struct',form:'box',c:[40,5,0],s:[10,8,4],wing:{foil:true,axis:'x',pivot:[40,5,0],open:15,stow:0,T:2}}];
ship.nextId=4;C.syncCompartments(ship);const stats=C.computeStats(ship);
test('a non-aircraft hull uses its real ship engineering figures when embarked',()=>{
 assert.equal(C.isCraft(ship),false);assert.equal(!!stats.craft,false);
 const d=C.designCraftSnapshot(ship,stats,'save:corvette');assert.ok(d?.blueprint);assert.equal(d.craft.speedMode,'ship');
 assert.equal(d.craft.speed,Math.round(C.sublightMGLT(stats.accelG,C.engineDepthRatio(ship))*C.MGLT.ms));
 assert.equal(d.craft.crew,stats.crew);assert.equal(d.craft.cost,Math.round(stats.cost));assert.deepEqual(plain(d.dims),plain(stats.dims));
});
test('armed small ships remain combat craft even when spare hull volume can house troops',()=>{
 const armed={...ship,fits:[{id:5,k:'htl',p:[40,12,0],a:2,base:0,ped:0}]};
 const c=C.craftCombat(armed,{...stats,troopCapacity:1000,alphaTot:50});
 assert.equal(c.role,'fighter');assert.ok(c.gun>=50);
});
test('live and engine-serialized designs produce the same persistent model without nested complements',()=>{
 const live=C.designCraftSnapshot(ship,stats,'save:corvette'),serialized=C.designCraftSnapshot(C.serialize(ship),stats,'save:corvette');
 assert.deepEqual(plain(live),plain(serialized));assert.deepEqual(plain(live.blueprint.airWings),[]);assert.deepEqual(plain(live.blueprint.groundForces),[]);
 assert.equal(live.blueprint.parts.find(p=>p.id===3).wing.pivot[0],40);
 ship.parts[2].c[0]+=1;assert.equal(live.blueprint.parts.find(p=>p.id===3).c[0],40);ship.parts[2].c[0]-=1;
});
test('carrier rows round trip their exact model, dimensions and flight hierarchy',()=>{
 const design=C.designCraftSnapshot(ship,stats,'save:corvette'),before=C.publicJSON(ship);
 const rows=C.normalizeAirWings([{id:'custom',name:'Custom',count:4,design,groupNo:2,wingNo:3}]);
 const carrier=C.newShip({L:500,W:200,H:100},'Carrier');carrier.airWings=rows;
 const restored=C.deserialize(JSON.parse(JSON.stringify(C.serialize(carrier)))).airWings[0];
 assert.ok(restored.design.blueprint);assert.equal(restored.groupNo,2);assert.equal(restored.wingNo,3);assert.equal(restored.count,4);
 assert.deepEqual(plain(restored.dims),plain(design.dims));assert.equal(C.publicJSON(ship),before);
});
test('invalid and cyclic blueprints fail without damaging a valid performance-only legacy snapshot',()=>{
 const d=C.designCraftSnapshot(ship,stats),cycle={...plain(d.blueprint)};cycle.hull={...cycle.hull,loop:cycle};
 assert.equal(C.cleanDesignCraft({...d,blueprint:cycle}).blueprint,undefined);
 assert.equal(C.cleanDesignCraft({...d,blueprint:{format:'unknown'}}).blueprint,undefined);
 assert.ok(C.cleanDesignCraft({name:'Legacy',craft:d.craft}));
 const repaired=C.designCraftSnapshot({...ship,parts:[...ship.parts,{id:5,k:'invalid'}]},stats);
 assert.ok(repaired);assert.equal(repaired.blueprint.parts.some(p=>p.k==='invalid'),false);
});
test('a stored model keeps functional foil membership and uses the same hangar and hatch rules as a standard craft',()=>{
 const d=C.designCraftSnapshot(ship,stats),row={id:'custom',kind:'craft',dims:d.dims,size:C.stowSize(d.dims),count:2};
 const bay={id:1,dims:[200,80,40],capacity:1000,connected:true,doors:[[100,50]]};
 assert.equal(C.stowLoad([bay],[row],[]).wings[0].deployable,2);
 assert.equal(C.stowLoad([{...bay,doors:[[2,1]]}],[row],[]).wings[0].deployable,0);
 assert.equal(C.stowLoad([{...bay,dims:[10,10,10]}],[row],[]).wings[0].tooLarge,true);
});
