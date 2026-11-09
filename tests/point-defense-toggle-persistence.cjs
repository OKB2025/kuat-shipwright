const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const {C,R}=vm.runInContext('({C:Core,R:Rts})',cx),copy=value=>JSON.parse(JSON.stringify(value));
function profile(){
 return {profileVersion:C.FLEET_PROFILE_VERSION,name:'Finite configuration carrier',hp:1e9,len:200,width:80,height:60,D:0,shieldBuffer:0,reserve:0,crewNeed:0,crewMax:0,crewCapacity:0,autoCrew:0,wCap:0,aa:0,aaArcs:Array(6).fill(0),gunArcs:Array(6).fill(0),ionArcs:Array(6).fill(0),gunBands:{long:Array(6).fill(0),mid:Array(6).fill(0),close:Array(6).fill(0)},msl:0,imsl:0,slots:0,launch:0,acc:1,maxSpeed:0,turnRate:0,
  modules:[{k:'reactor',part:1,port:'p1',domain:'main',share:1,size:1}],grid:{P:1e18,Pgen:1e18,Paux:0,fixed:0,cooling:0,De:0,Ds:0,Dw:0,domains:[{id:'main',P:1e18,sources:[{moduleIndex:0,P:1e18}],modules:[0]}]},
  propulsion:{version:C.PROPULSION_MODEL_VERSION,inputModelVersion:C.ENGINE_INPUT_MODEL_VERSION,conversionModelVersion:C.ENGINE_CONVERSION_MODEL_VERSION,massKg:1e6,conversionMassKg:1e6,engines:[],ratedThrustN:0,ratedAccelMps2:0,accelerationLimitMps2:0,structuralAccelerationLimitMps2:0,inertialFactor:1}};
}
function tactical(){
 const p=profile(),a=C.fleetUnit('own','own',p,0),b=C.fleetUnit('enemy','enemy',p,1);a.pos=[0,0,0];b.pos=[10000,0,0];const battle=C.fleetBattle([a,b],false);battle.seconds=5;return {p,a,b,battle};
}
function world(){
 const p=profile(),w=R.createWorld({region:'kuat',seed:17,sensors:false,designs:[{key:'test',name:'Finite configuration carrier',p,info:{mass:1000,capital:false,sensor:1}}],sides:[{faction:'rebel',ai:false},{faction:'empire',ai:false}],fleets:[[{design:'test',air:[],ground:[],troops:0},{design:'test',air:[],ground:[],troops:0}],[{design:'test',air:[],ground:[],troops:0}]]});
 const own=[...w.units.values()].filter(u=>u.side===0),enemy=[...w.units.values()].find(u=>u.side===1),group=w.groups.get(own[0].group);return {w,own,enemy,group};
}
const invalid=[null,0,1,'false','true',{},[]];

test('fresh and old units default to automatic defence on without modifying shared design profiles',()=>{
 const f=tactical(),before=copy(f.p);assert.equal(C.automaticPointDefenseEnabled(f.a),true);assert.equal(C.automaticPointDefenseEnabled(f.b),true);
 delete f.a.order.autoPointDefense;assert.equal(C.automaticPointDefenseEnabled(f.a),true,'an omitted field keeps old saves enabled');
 assert.equal(C.setAutomaticPointDefense(f.a,false),true);assert.equal(f.a.order.autoPointDefense,false);assert.equal(C.automaticPointDefenseEnabled(f.a),false);assert.equal(C.automaticPointDefenseEnabled(f.b),true,'a different ship using the same profile is independent');assert.deepEqual(copy(f.p),before);
 assert.equal(C.setAutomaticPointDefense(f.a,true),true);assert.equal(C.automaticPointDefenseEnabled(f.a),true);
});

test('setter rejects nonbooleans and changing the policy preserves paid stores, reload and channel accounting',()=>{
 const {a}=tactical();a.energy=37;a.aaLeft=2;a.aaT=12;a.reload=[.5,2];a.surfaceBanks={2:19};a.dualDefense=true;a.dualTiers=2;a.dualWeights=[1,.5];a.pdAt=11;a.pdOn='old-threat';
 const before=copy(a);for(const value of invalid){assert.equal(C.setAutomaticPointDefense(a,value),false);assert.deepEqual(copy(a),before,'invalid setter is atomic');}
 assert.equal(C.setAutomaticPointDefense(a,false),true);assert.equal(a.dualDefense,false);assert.equal(a.pdOn??null,null);assert.deepEqual(copy(a.reload),[.5,2]);assert.equal(a.energy,37);assert.equal(a.aaLeft,2);assert.equal(a.aaT,12);assert.deepEqual(copy(a.surfaceBanks),{2:19});
 assert.equal(C.setAutomaticPointDefense(a,true),true);assert.equal(a.energy,37);assert.equal(a.aaLeft,2,'an off/on pair cannot refill this step\'s fire-control channels');assert.deepEqual(copy(a.reload),[.5,2]);
});

test('tactical fleet orders validate the toggle before mutating any existing course or fire order',()=>{
 const {a,battle}=tactical();assert.equal(C.fleetOrder(battle,a.id,{type:'hold',autoPointDefense:false}),true);assert.equal(C.automaticPointDefenseEnabled(a),false);
 assert.equal(C.fleetOrder(battle,a.id,{type:'move',point:[20000,0,0],fire:false}),true);assert.equal(C.automaticPointDefenseEnabled(a),false,'a navigation order preserves the policy');const before=copy(a.order);
 for(const value of invalid){assert.equal(C.fleetOrder(battle,a.id,{type:'hold',fire:true,autoPointDefense:value}),false);assert.deepEqual(copy(a.order),before);}
 assert.equal(C.fleetOrder(battle,a.id,{type:'hold',autoPointDefense:true}),true);assert.equal(C.automaticPointDefenseEnabled(a),true);
});

test('individual RTS orders preserve the policy across navigation and reject malformed toggles without mutation',()=>{
 const f=world(),u=f.own[0],sibling=f.own[1];assert.equal(R.orderUnit(f.w,u.id,{autoPointDefense:false}),true);assert.equal(C.automaticPointDefenseEnabled(u),false);assert.equal(C.automaticPointDefenseEnabled(sibling),true);
 assert.equal(R.orderUnit(f.w,u.id,{type:'move',point:[1000,0,0]}),true);assert.equal(C.automaticPointDefenseEnabled(u),false);const before=copy(u.order);
 for(const value of invalid){assert.equal(R.orderUnit(f.w,u.id,{type:'hold',fire:false,autoPointDefense:value}),false);assert.deepEqual(copy(u.order),before);}
 f.w.sides[0].ai=true;assert.equal(R.orderUnit(f.w,u.id,{autoPointDefense:true}),false);assert.deepEqual(copy(u.order),before,'player commands cannot change an AI-controlled ship');
});

test('task-group toggles affect exactly their live ships while invalid values cannot partially change the group',()=>{
 const f=world(),orders=()=>copy({groupOrder:f.group.order,formation:f.group.formation,orders:f.own.map(u=>u.order),enemy:f.enemy.order});
 const original=orders();for(const value of invalid){assert.equal(R.orderGroup(f.w,f.group.id,{formation:'column',type:'hold',fire:false,autoPointDefense:value}),false);assert.deepEqual(orders(),original,'validation must precede formation and per-ship changes');}
 assert.equal(R.orderGroup(f.w,f.group.id,{autoPointDefense:false}),true);assert.ok(f.own.every(u=>C.automaticPointDefenseEnabled(u)===false));assert.equal(C.automaticPointDefenseEnabled(f.enemy),true);
 assert.equal(R.orderGroup(f.w,f.group.id,{type:'hold',power:'weapons'}),true);assert.ok(f.own.every(u=>C.automaticPointDefenseEnabled(u)===false));assert.equal(R.orderGroup(f.w,f.group.id,{autoPointDefense:true}),true);assert.ok(f.own.every(u=>C.automaticPointDefenseEnabled(u)===true));
 const before=orders();f.w.sides[0].ai=true;assert.equal(R.orderGroup(f.w,f.group.id,{autoPointDefense:false}),false);assert.deepEqual(orders(),before);
});

test('real tactical execution clones retain policy and AI order rewrites do not restore interception',()=>{
 const {a,b,battle}=tactical();C.setAutomaticPointDefense(a,false);C.setAutomaticPointDefense(b,false);const before=copy({a:a.order,b:b.order});
 const result=C.fleetCommit(battle);assert.ok(result);assert.deepEqual(copy({a:a.order,b:b.order}),before,'execution does not rewrite the editable plan');
 const nextA=result.units.find(u=>u.id===a.id),nextB=result.units.find(u=>u.id===b.id);assert.notEqual(nextA.order,a.order);assert.equal(nextB.order.type,'attack','the actual tactical AI has replaced its course order');assert.equal(C.automaticPointDefenseEnabled(nextA),false);assert.equal(C.automaticPointDefenseEnabled(nextB),false,'AI keeps the explicitly disabled policy');
 for(const frame of result.frames)for(const u of frame.units)assert.equal(u.autoPointDefense,false,'actual review frames expose the retained policy');
 assert.equal(C.fleetFinish(battle),true);assert.ok(battle.units.every(u=>C.automaticPointDefenseEnabled(u)===false));
});

test('actual tactical result and frame JSON retain booleans without claiming an unavailable world-save API',()=>{
 const f=tactical();C.setAutomaticPointDefense(f.a,false);const result=C.fleetCommit(f.battle),payload=JSON.parse(JSON.stringify(result));
 const off=payload.units.find(u=>u.id===f.a.id),on=payload.units.find(u=>u.id===f.b.id);assert.equal(off.order.autoPointDefense,false);assert.equal(C.automaticPointDefenseEnabled(off),false);assert.equal(C.automaticPointDefenseEnabled(on),true);
 const frame=payload.frames.at(-1);assert.equal(frame.units.find(u=>u.id===f.a.id).autoPointDefense,false);assert.equal(frame.units.find(u=>u.id===f.b.id).autoPointDefense,true);
 off.order.autoPointDefense=true;assert.equal(C.automaticPointDefenseEnabled(result.units.find(u=>u.id===f.a.id)),false,'serialized data is independent from the live result');
});
