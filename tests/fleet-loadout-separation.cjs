const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js']){let source=fs.readFileSync(path.join(root,file),'utf8');if(file==='js/core.js'){const hook=/^return \{(?=[^\n]*\bCAMPAIGN_FORMAT\b)/gm;assert.equal([...source.matchAll(hook)].length,1,'the private Rts test-export hook must match exactly one return object');source=source.replace(hook,'return {shipRole,');}vm.runInContext(source,context,{filename:file});}
const {C,R,D}=vm.runInContext('({C:Core,R:Rts,D:YardFleetData.designs})',context),plain=v=>JSON.parse(JSON.stringify(v));
function empty(ship){assert.deepEqual(plain(ship.airWings),[]);assert.deepEqual(plain(ship.groundForces),[]);for(const k of ['airWing','air','ground','troops','carried','complement','manifest'])assert.equal(ship[k],undefined,k);for(const p of ship.parts||[]){assert.equal(p.aircraftType,undefined);assert.equal(p.berths,undefined);}}
function capacityShip(){const s=C.newShip({L:100,W:80,H:50,plan:'rect',sec:'rect'},'Empty carrier');s.parts=[{id:1,k:'hangar',c:[50,25,0],room:[40,30,20],d:40,airRole:'mixed',berths:72,aircraftType:'tie_ln'}];s.nextId=2;return s;}

test('all example definitions keep reference complements outside their blueprints and builds stay empty',()=>{
 for(const d of Object.values(C.SHIP_EXAMPLES)){assert.equal(d.airWings,undefined,d.key);assert.equal(d.groundForces,undefined,d.key);}
 for(const key of ['imperial','venator']){const s=C.buildDesign(key);empty(s);assert.ok(s.parts.some(p=>p.k==='hangar'),key);}
 const preset=C.builtinComplement('acclamator');assert.ok(preset.air.length>0&&preset.ground.length>0);preset.air[0].count=0;assert.ok(C.builtinComplement('acclamator').air[0].count>0,'editing a fleet preset copy must not rewrite its source');
});

test('every direct example ship builder returns an empty hull rather than hidden embarked forces',()=>{
 const examples=Object.values(C.SHIP_EXAMPLES).filter(d=>!d.key.startsWith('craft_'));assert.ok(examples.length>=20);
 for(const d of examples){const s=d.build();empty(s);assert.ok(s.parts.length>0,d.key);assert.ok(s.hull.L>0,d.key);if(d.key==='acclamator')assert.ok(C.aviationStatus(s).capacity>0);}
});

test('legacy manifests and hangar berth aliases cannot survive design import or serialization',()=>{
 const s=capacityShip(),raw=plain(C.serialize(s));raw.airWings=[{id:'old',type:'tie_ln',count:72,design:{blueprint:{airWings:[{count:900}]}}}];raw.airWing=[{count:4}];raw.groundForces=[{kind:'troops',count:9000}];raw.ground=[{troops:999}];raw.troops=999;raw.carried=[{key:'craft_xwing'}];raw.manifest={air:[1]};raw.parts[0].berths=72;raw.parts[0].aircraftType='tie_ln';
 const restored=C.deserialize(raw);empty(restored);assert.equal(restored.parts[0].k,'hangar');assert.deepEqual(plain(restored.parts[0].room),[40,30,20]);assert.ok(C.aviationStatus(restored).capacity>0);
 Object.assign(s,{airWings:raw.airWings,groundForces:raw.groundForces,air:raw.airWing,ground:raw.ground,troops:100,carried:raw.carried});empty(C.serialize(s));
});

test('engineering clears stale occupants while preserving physical hangar and troop capacities',()=>{
 const s=capacityShip();s.airWings=[{id:'stale-air',type:'tie_ln',count:72}];s.groundForces=[{id:'stale-ground',kind:'troops',count:9000}];s.troops=9000;
 const stats=C.computeStats(s);empty(s);assert.ok(stats.aviation.capacity>0);assert.equal(stats.aviation.embarkedCount,0);assert.equal(stats.aviation.usedSize,0);assert.ok(stats.troopCapacity>0);assert.equal(stats.ground.troops.embarked,0);assert.equal(stats.ground.rows.length,0);
 const profile=C.fleetProfile(stats,s.name,s);assert.equal(profile.slots,0);assert.equal(profile.embarkedSlots,0);assert.equal(profile.aviationSize,0);assert.equal(profile.airOrd,undefined);
});

test('explicit fleet manifests retain aircraft hierarchy and troops across normalization and world creation',()=>{
 const design=plain(D.venator),air=[{craft:'xwing',n:4,name:'Explicit squadron',groupNo:2,wingNo:3}],ground=[{name:'Explicit troops',battalions:[{companies:[{troops:120,vehicles:{}}]}]}];
 const fleet=R.normalizeFleet({ctgs:[{name:'Combined',tgs:[{name:'Group',ships:[{key:'venator',src:'venator',air,ground}]}]}]});
 const saved=plain(fleet).ctgs[0].tgs[0].ships[0];assert.equal(saved.air[0].n,4);assert.equal(saved.air[0].groupNo,2);assert.equal(saved.air[0].wingNo,3);assert.equal(saved.ground[0].battalions[0].companies[0].troops,120);
 const w=R.createWorld({mode:'test',region:'kuat',seed:13,sensors:false,designs:[design],sides:[{faction:'republic',ai:false},{faction:'empire',ai:false}],fleets:[[{design:'venator',air:saved.air,ground:saved.ground,troops:120}],[]]});
 const u=[...w.units.values()][0];assert.equal(u.troops,120);assert.equal(u.ground[0].battalions[0].companies[0].troops,120);assert.equal(w.squads.size,1);const q=[...w.squads.values()][0];assert.equal(q.n0,4);assert.equal(q.groupNo,2);assert.equal(q.wingNo,3);
});

test('a ship profile or optional historical preset never spawns aircraft or troops without a fleet row',()=>{
 const d=plain(D.venator);assert.ok(d.air.length>0,'fixture includes the historical fleet preset');d.troops=12345;d.ground=[{troops:12345}];
 const profileBefore=plain(d.p),presetBefore=plain({air:d.air,ground:d.ground,troops:d.troops});
 const w=R.createWorld({mode:'test',region:'kuat',seed:13,sensors:false,designs:[d],sides:[{faction:'republic',ai:false},{faction:'empire',ai:false}],fleets:[[{design:'venator'}],[]]});
 assert.equal(w.squads.size,0);assert.equal(w.wings.size,0);const u=[...w.units.values()][0];assert.equal(u.air,0);assert.equal(u.troops,0);assert.equal(u.ground,null);assert.equal(u.p.slots,0);assert.equal(u.p.embarkedSlots,0);assert.equal(u.p.aviationSize,0);assert.equal(u.p.airOrd,undefined);assert.equal(R.shipRole(u),'carrier','an empty physical carrier keeps its capacity-based formation role');assert.deepEqual(plain(d.p),profileBefore,'runtime cleaning must not mutate the reference profile');assert.deepEqual(plain({air:d.air,ground:d.ground,troops:d.troops}),presetBefore,'runtime cleaning must not mutate the optional reference preset');
});

test('legacy fleet troops become visible editable ground rows and cannot reappear after clearing them',()=>{
 const fleet=R.normalizeFleet({ctgs:[{name:'C',tgs:[{name:'T',ships:[{key:'venator',troops:500}]}]}]}),sh=fleet.ctgs[0].tgs[0].ships[0];assert.equal(sh.troops,undefined);assert.equal(sh.ground.reduce((n,r)=>n+R.regimentTotals(r).troops,0),500);
 const d=plain(D.venator),battle=R.battleOrbat(plain(fleet),null,()=>d),row=battle.ctgs[0].tgs[0].ships[0];assert.equal(row.troops,500);assert.equal(row.air.length,0);
 for(const r of sh.ground)for(const b of r.battalions)for(const c of b.companies)c.troops=0;assert.equal(R.battleOrbat(fleet,null,()=>d).ctgs[0].tgs[0].ships[0].troops,0);
 sh.ground=[];sh.troops=500;assert.equal(R.battleOrbat(fleet,null,()=>d).ctgs[0].tgs[0].ships[0].troops,0,'an explicit empty manifest overrides an obsolete scalar');const normalized=R.normalizeFleet(fleet);assert.equal(normalized.ctgs[0].tgs[0].ships[0].troops,undefined);assert.equal(normalized.ctgs[0].tgs[0].ships[0].ground.length,0);
 const w=R.createWorld({mode:'test',region:'kuat',seed:13,sensors:false,designs:[d],sides:[{faction:'republic',ai:false},{faction:'empire',ai:false}],fleets:[R.battleOrbat(normalized,null,()=>d),[]]});assert.equal([...w.units.values()][0].troops,0);
});

test('combat strength counts only currently assigned friendly squadrons rather than a design capacity',()=>{
 const d=plain(D.venator),profile=plain(d.p),core=C.fleetUnit('plain','venator',profile,0),body=C.fleetUnit('body','venator',{...profile,slots:0,embarkedSlots:0,aviationSize:0},0);assert.equal(R.unitStrength(core),R.unitStrength(body));
 const make=n=>R.createWorld({mode:'test',region:'kuat',seed:13,sensors:false,designs:[d],sides:[{faction:'republic',ai:false},{faction:'empire',ai:false}],fleets:[[{design:'venator',air:n?[{craft:'xwing',n}]:[]}],[]]}),emptyWorld=make(0),loaded=make(4),u=[...loaded.units.values()][0],emptyUnit=[...emptyWorld.units.values()][0],s=[...loaded.squads.values()][0],base=R.unitStrength(emptyUnit);
 const per=4*(C.fleetSystems(u).hangar??1);assert.ok(Math.abs(R.unitStrength(u)-base-4*per)<1e-8);s.n=2;assert.ok(Math.abs(R.unitStrength(u)-base-2*per)<1e-8);s.side=1;assert.ok(Math.abs(R.unitStrength(u)-base)<1e-8,'captured ships must not count the old side aircraft');s.side=0;s.state='lost';assert.ok(Math.abs(R.unitStrength(u)-base)<1e-8);assert.equal(R.unitStrength(emptyUnit),base,'separate worlds must not share the unit-to-world association');
});

test('fleet stow calculations still accept explicit manifests without storing them in a hull',()=>{
 const bay={id:1,dims:[100,80,30],capacity:100,connected:true,doors:[[100,30]]},row={id:'fleet-row',kind:'craft',type:'xwing',dims:[12.5,11.6,4.5],size:1,count:4};
 const packed=C.stowLoad([bay],[row],[]);assert.equal(packed.wings[0].embarked,4);assert.equal(packed.wings[0].deployable,4);
 const s=capacityShip();s.airWings=[row];s.groundForces=[{kind:'troops',count:5}];const data=C.serialize(s);empty(data);assert.equal(row.count,4,'design cleaning must not alter an explicit fleet row');
});

test('the fleet editor separates optional presets from ship blueprints and adds empty manual rows',()=>{
 const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),cut=(a,b)=>{const start=app.indexOf(a),end=app.indexOf(b,start+1);assert.ok(start>=0&&end>start);return app.slice(start,end);};
 const cx=vm.createContext({console,C,R,YardFleetData:{designs:D}});vm.runInContext('const out=[];'+cut('function voyExampleDesigns()','function voyDesign('),cx);const ds=vm.runInContext('voyExampleDesigns()',cx);assert.ok(ds.length>0);for(const d of ds){assert.equal(d.air,undefined);assert.equal(d.ground,undefined);assert.ok(d.loadPreset);assert.equal(d.p.slots,0);assert.equal(d.p.embarkedSlots,0);assert.equal(d.p.aviationSize,0);assert.equal(d.p.airOrd,undefined);}
 const prepare=cut('async function voyPrepare(','const voyShort =');assert.doesNotMatch(prepare,/airWings|groundForces/);assert.match(prepare,/loadPreset/);
 const add=cut('async function voyObAddShip(','function voyBindSetup(');assert.match(add,/air:\[\],carried:\[\],ground:\[\],troops:0/);assert.doesNotMatch(add,/voyAutoLoad/);
 const fromCurrent=cut('async function voyOpenWithCurrent(','window.addEventListener(');assert.match(fromCurrent,/air:\[\],carried:\[\],ground:\[\],troops:0/);
});
