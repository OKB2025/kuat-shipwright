const assert=require('node:assert/strict'),{test}=require('node:test');
const {verificationKeys}=require('../scripts/finalize-ship-example-audit.cjs'),{controls,assertControls,sourcePayload,sourcePayloadEvidence,auxiliaryBetweenEvidence}=require('../scripts/refresh-shared-propulsion.cjs'),{propulsionArchitectureEvidence}=require('../scripts/audit-ship-examples.cjs');
test('a scoped audit names its exact stock subset while the default still requires every stock model',()=>{
 const C={SHIP_SYSTEM_REFIT_KEYS:['venator','imperial','cr90']};assert.deepEqual(verificationKeys(C,{}),['cr90','imperial','venator']);assert.deepEqual(verificationKeys(C,{keys:['imperial']}),['imperial']);
 for(const keys of [[],['imperial','imperial'],['imperial2'],[null],'imperial'])assert.throws(()=>verificationKeys(C,{keys}),/Invalid explicitly scoped/);
});
test('the architecture verifier identifies current and historical ISD nozzle roles without hard-coded IDs',()=>{
 for(const reference of ['imperial','imperial2'])for(const shared of [true,false]){
  const first=shared?51:20,mainIds=shared?[169]:[169,170,171],auxIds=shared?[170,171]:[172,173,174,175],coreIds=[...mainIds,...auxIds],cores=coreIds.map((id,i)=>({id,k:'engineCore',c:[60,0,i<mainIds.length?(i-(mainIds.length-1)/2)*10:(i-mainIds.length-1)*20],d:10})),nozzles=Array.from({length:7},(_,i)=>({id:first+i,k:'engine',label:i<3?'主イオン機関・ベル型ノズル':'上下二段の補助イオン機関',machineryId:i<3?mainIds[shared?0:i]:auxIds[shared?Math.floor((i-3)/2):i-3]})),ship={reference,parts:[{id:15,k:'gen',c:[100,0,0],d:40},...cores,...nozzles]},profile={propulsion:{architectureVersion:2,cores:coreIds.map((id,moduleIndex)=>({id,moduleIndex,available:true})),engines:nozzles.map(p=>({id:p.id,coreModuleIndex:coreIds.indexOf(p.machineryId),shaftModuleIndices:[p.id]}))}};
  const C={propulsionOwners:()=>cores,engineMachineryPaths:()=>[],engineTransmission:()=>({engines:Object.fromEntries(coreIds.map(id=>[id,{connected:true}]))}),engineDriveRoutes:()=>({routes:nozzles.map(p=>({id:'shaft'+p.id,nozzleId:p.id,ok:true,capacityW:1}))}),resolveEngineSpec:()=>({reactorId:15,ratedInputW:1,ratedThrustN:1,maxInputW:1,machineryShape:'cylinder',effectiveMachineryVolumeM3:1,inputDensityWPerM3:1,valid:true}),engineOwner:(p,s)=>s.parts.find(q=>q.id===p.machineryId),integratedEngine:()=>false,partVolume:()=>1,isReactor:p=>p.k==='gen',reactorPower:()=>100,partAABB:p=>p.k==='gen'?[80,-20,-20,120,20,20]:[50,-5,p.c[2]-5,70,5,p.c[2]+5]};
  const out=propulsionArchitectureEvidence(C,ship,profile);assert.deepEqual(out.imperialEngineGroups.primaryNozzleIds,[first,first+1,first+2]);assert.equal(out.imperialEngineGroups.assignmentComplete,true);assert.equal(out.imperialEngineGroups.groupsSeparated,true);assert.equal(out.imperialMainEngine.immediatelyAft,true);assert.equal(out.imperialMainEngine.sharedPrimaryOwner,shared);assert.equal(out.imperialMainEngine.individualPrimaryOwners,!shared);
 }
});
test('only the selected Imperial row and digest can change during a scoped publication',()=>{
 const data={designs:{imperial:{p:{cores:7}},venator:{model:{sourceSha256:{'js/core.js':'older-authenticated-source'}},p:{cores:8}},cr90:{p:{cores:11}}}},figures={ships:{imperial:{mass:100},venator:{mass:50},cr90:{mass:10}}},baseline=controls(data,figures),copy=value=>JSON.parse(JSON.stringify(value));
 const changed=copy(data),nextFigures=copy(figures);changed.designs.imperial.p.cores=3;nextFigures.ships.imperial.mass=99;assert.doesNotThrow(()=>assertControls(baseline,changed,nextFigures));
 changed.designs.venator.model.sourceSha256['js/core.js']='new-source';assert.throws(()=>assertControls(baseline,changed,nextFigures),/unselected/);assert.throws(()=>assertControls(baseline,data,{ships:{...figures.ships,cr90:{mass:11}}}),/unselected/);
});

test('the two-key publication preserves every unselected row and digest',()=>{
 const data={designs:{imperial:{value:1},onager:{value:2},venator:{value:3}}},figures={ships:{imperial:{mass:1},onager:{mass:2},venator:{mass:3}}},keys=['imperial','onager'],baseline=controls(data,figures,keys);assert.deepEqual(Object.keys(baseline.catalogue),['venator']);assert.doesNotThrow(()=>assertControls(baseline,{designs:{...data.designs,imperial:{value:4},onager:{value:5}}},{ships:{...figures.ships,imperial:{mass:4},onager:{mass:5}}},keys));assert.throws(()=>assertControls(baseline,{designs:{...data.designs,venator:{value:4}}},figures,keys),/unselected/);
});

test('payload invariants count both main shields and local shields without changing their physical capacities',()=>{
 const C={isReactor:p=>p.k==='gen',reactorPower:p=>p.power,shieldLoad:p=>p.capacity,isSuperweapon:()=>false,partDims:()=>({l:2}),norm:p=>p,add:(a,b)=>a.map((v,i)=>v+b[i]),mul:(a,b)=>a.map(v=>v*b)},ship={parts:[{id:1,k:'gen',power:1e25},{id:2,k:'shield',capacity:9.75e25},{id:3,k:'localShield',capacity:2.5e24},{id:4,k:'engine',label:'main',d:4,dir:[-1,0,0],c:[3,2,0]}]},baseline=sourcePayload(C,ship);assert.equal(baseline.shieldEnergyJ,1e26);assert.equal(sourcePayloadEvidence(C,ship,baseline,'imperial').sourcePayloadPreserved,true);assert.equal(sourcePayloadEvidence(C,ship,baseline,'imperial').referencePayloadValid,true);ship.parts[2].capacity*=2;const changed=sourcePayloadEvidence(C,ship,baseline,'imperial');assert.equal(changed.sourcePayloadPreserved,false);assert.equal(changed.referencePayloadValid,false);
});

test('the Onager payload guard reads the actual combat beam duration and rejects a changed pulse',()=>{
 const C={isReactor:p=>p.k==='gen',reactorPower:p=>p.power,shieldLoad:p=>p.capacity,isSuperweapon:p=>p.k==='sbeam',swEnergyTT:p=>p.energy,superweaponAxis:p=>p.axis,SW_COMBAT:{sbeam:{beamT:10}}},ship={parts:[{id:1,k:'gen',power:3.6e24},{id:2,k:'shield',capacity:3.6e25},...[3,4].map(id=>({id,k:'sbeam',energy:125000,axis:[1,0,0]}))]},baseline=sourcePayload(C,ship);assert.equal(baseline.superweapons[0].beamSeconds,10);assert.equal(sourcePayloadEvidence(C,ship,baseline,'onager').referencePayloadValid,true);C.SW_COMBAT.sbeam.beamT=9;assert.equal(sourcePayloadEvidence(C,ship,baseline,'onager').referencePayloadValid,false);
});

test('auxiliary bodies must lie inside actual main-shaft fans, including bends and finite radii',()=>{
 for(const key of ['imperial','onager']){
  const C={partDims:p=>({l:p.length,rad:p.d/2})},primary=key==='imperial'?'主イオン機関':'主機関',ship={parts:[{id:1,k:'engineCore',c:[300,0,0],d:20,length:20,dir:[-1,0,0]},...[-1,1].map((sign,i)=>({id:2+i,k:'engineCore',c:[200,0,sign*50],d:10,length:20,dir:[-1,0,0]})),...[-1,0,1].map((sign,i)=>({id:10+i,k:'engine',label:primary,c:[0,0,sign*100],machineryId:1})),...[-1,1].map((sign,i)=>({id:20+i,k:'engine',label:'補助',c:[0,0,sign*50],machineryId:2+i}))]},route=(id,points,radius=3)=>({nozzleId:id,radius,segments:points.slice(1).map((b,i)=>({a:points[i],b}))}),center=route(11,[[300,0,0],[0,0,0]]),fan=early=>({routes:[center,...[-1,1].map((sign,i)=>route(10+i*2,[[300,0,sign*8],[early?240:30,0,sign*(early?100:8)],[0,0,sign*100]]))]});
  assert.equal(auxiliaryBetweenEvidence(C,ship,fan(false),key).allAuxiliariesBetweenMainPaths,false,'late outlet spread is not an actual fan around the engines');assert.equal(auxiliaryBetweenEvidence(C,ship,fan(true),key).allAuxiliariesBetweenMainPaths,true);
  const kink={routes:[center,...[-1,1].map((sign,i)=>route(10+i*2,[[300,0,sign*100],[210,0,sign*70],[200,0,sign*55],[190,0,sign*70],[0,0,sign*100]]))]};assert.equal(auxiliaryBetweenEvidence(C,ship,kink,key).allAuxiliariesBetweenMainPaths,false,'an inward bend between the two body caps is checked');
  const narrow={routes:[center,...[-1,1].map((sign,i)=>route(10+i*2,[[300,0,sign*56],[0,0,sign*56]],7))]};assert.equal(auxiliaryBetweenEvidence(C,ship,narrow,key).allAuxiliariesBetweenMainPaths,false,'centreline ordering cannot hide finite housing overlap');
 }
});
