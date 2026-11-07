const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const G=require('../scripts/update-ship-examples.cjs'),P=require('../scripts/refresh-imperial-layouts.cjs');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),plain=value=>JSON.parse(JSON.stringify(value));
function mergeFixture(){
 const sources={'js/core.js':'recorded-source'},C={DESIGNS:{imperial:{},imperial2:{name:'インペリアルII級'},craft_x:{}},SHIP_SYSTEM_REFIT_KEYS:['imperial','imperial2'],SHIP_EXAMPLES:{craft_x:{craft:true}},FLEET_PROFILE_VERSION:18,COST_MODEL:{version:1},costModelSignature:()=> 'test-price-model'},data={designs:{imperial:{key:'imperial',historical:true,p:{profileVersion:17,catalogOnly:true},model:{profileVersion:17,costSignature:'historical-price-model'}}}},entry={key:'imperial2',name:'インペリアルII級',p:{profileVersion:18,catalogOnly:true},model:{profileVersion:18,costVersion:1,costSignature:'test-price-model',sourceSha256:sources}},patch=G.createPatch(C,{imperial2:entry},sources,'baseline');return {C,sources,data,entry,patch};
}
test('a new selectable stock row requires an explicit generated catalogue addition',()=>{
 const {C,sources,data,patch}=mergeFixture();assert.throws(()=>G.mergePatches(data,[patch],C,sources),/Unknown fleet patch entry/);
 const before=plain(data),next=G.mergePatches(data,[patch],C,sources,{allowNewKeys:['imperial2']});assert.deepEqual(next.designs.imperial,data.designs.imperial);assert.equal(next.designs.imperial.p.profileVersion,17,'retained historical metadata stays17');assert.equal(next.designs.imperial2.name,'インペリアルII級');assert.equal(next.designs.imperial2.p.profileVersion,18,'the newly generated row uses the current derived schema');assert.equal(next.designs.imperial2.p.catalogOnly,true);assert.deepEqual(data,before,'publication cannot mutate its baseline controls');
});
test('catalogue addition permission cannot admit unknown, existing, duplicate, aircraft or ungenerated entries',()=>{
 const {C,sources,data,patch}=mergeFixture();for(const allowNewKeys of ['imperial2',['imperial'],['missing'],['imperial2','imperial2'],['craft_x']])assert.throws(()=>G.mergePatches(data,[patch],C,sources,{allowNewKeys}),/Invalid explicitly approved/);
 assert.throws(()=>G.mergePatches(data,[],C,sources,{allowNewKeys:['imperial2']}),/no generated entry/);const changed=plain(patch);changed.entries.imperial2.model.sourceSha256['js/core.js']='different-source';assert.throws(()=>G.mergePatches(data,[changed],C,sources,{allowNewKeys:['imperial2']}),/Inconsistent/);const stale=plain(patch);stale.entries.imperial2.p.profileVersion=17;stale.entries.imperial2.model.profileVersion=17;assert.throws(()=>G.mergePatches(data,[stale],C,sources,{allowNewKeys:['imperial2']}),/Inconsistent/,'a new18 patch cannot silently reuse a stale17 physical profile');
});
test('a new model metadata seed contains no inherited physics or stale fleet profile',()=>{
 const {C}=mergeFixture(),seed=P.metadataSeed(C,'imperial2');assert.deepEqual(Object.keys(seed).sort(),['faction','key','name','side']);assert.equal(seed.key,'imperial2');assert.equal(seed.faction,'empire');assert.throws(()=>P.metadataSeed(C,'imperial'),/No approved/);
});
test('occupied geometry validation checks both real ungrounded lists and fails closed on missing evidence',()=>{
 const clean={overlapIds:[],floating:0,floatFits:0,ungrounded:{parts:[],fits:[]}};assert.equal(P.occupiedGeometryValid(clean),true);
 for(const changed of [null,{}, {...clean,ungrounded:{parts:[187],fits:[]}}, {...clean,ungrounded:{parts:[],fits:[185]}}, {...clean,ungrounded:[]}, {...clean,floatFits:1}, {...clean,floating:1}, {...clean,overlapIds:[48]}])assert.equal(P.occupiedGeometryValid(changed),false);
});
test('source pose tolerance permits measured sub-picometre projection roundoff and rejects real motion or orientation changes',()=>{
 const before={p:[477.7,188.6664976282591,-255.7],a:0,n:[0,1,0]},after=plain(before);after.p[1]+=9.1e-13;const proof=P.posePreservation(before,after);assert.equal(proof.exactPoseMatch,false);assert.equal(proof.poseUnchanged,true);assert.equal(proof.positionToleranceM,1e-7);after.p[1]+=1e-6;assert.equal(P.posePreservation(before,after).poseUnchanged,false);const rotated=plain(before);rotated.a+=1e-12;assert.equal(P.posePreservation(before,rotated).poseUnchanged,false);rotated.a=0;rotated.n[0]=1e-8;assert.equal(P.posePreservation(before,rotated).poseUnchanged,false);
});
test('the two-model refresh preserves every unrelated catalogue row and engineering digest',()=>{
 const data={designs:{imperial:{old:true},onager:{model:{sourceSha256:{'js/core.js':'historical'}}},venator:{value:3}}},figures={ships:{imperial:{mass:1},onager:{mass:2},venator:{mass:3},fighter:{mass:4}}},keys=['imperial','imperial2'],control=P.controls(data,figures,keys),next=plain(data),nextFigures=plain(figures);next.designs.imperial={fresh:true};next.designs.imperial2={fresh:true};nextFigures.ships.imperial={mass:5};nextFigures.ships.imperial2={mass:6};assert.doesNotThrow(()=>P.assertControls(control,next,nextFigures,keys));next.designs.onager.model.sourceSha256['js/core.js']='new';assert.throws(()=>P.assertControls(control,next,nextFigures,keys),/unselected/);next.designs.onager=data.designs.onager;nextFigures.ships.fighter.mass=10;assert.throws(()=>P.assertControls(control,next,nextFigures,keys),/unselected/);
});
test('both source-stage constructors satisfy the independently archived uploaded layout',()=>{
 const {C}=G.loadRuntime(root),source=P.sourceLayout(root);assert.equal(source.sourceSha256,'914320506d4aee20cda02f3446e6f5e87949cd8292796c22f9b1d8b3c4a2c81b');
 for(const key of ['imperial','imperial2']){const ship=C.SHIP_EXAMPLES[key].build(),proof=P.layoutEvidence(C,ship,source,key,'2300g');for(const field of ['structuralLayoutPreserved','allFittingPosesPreserved','weaponKindsCorrect','nozzleAppearancePreserved'])assert.equal(proof[field],true,key+' '+field);assert.equal(proof.structures.length,26);assert.equal(proof.fits.length,51);}
});
test('the publication layout guard rejects a moved structure, gun, nozzle skin or wrong main battery',()=>{
 const {C}=G.loadRuntime(root),source=P.sourceLayout(root),ship=C.SHIP_EXAMPLES.imperial.build(),verify=()=>P.layoutEvidence(C,ship,source,'imperial','2300g');
 const structure=ship.parts.find(p=>p.k==='struct');structure.c[0]+=.01;assert.equal(verify().structuralLayoutPreserved,false);structure.c[0]-=.01;
 const gun=ship.fits.find(p=>p.id===107),position=gun.p[0];gun.p[0]+=.01;assert.equal(verify().allFittingPosesPreserved,false);gun.p[0]=position;gun.k='oct40';assert.equal(verify().weaponKindsCorrect,false);gun.k='ion';const nozzle=ship.parts.find(p=>p.k==='engine');nozzle.skinAsset='different-bell';assert.equal(verify().nozzleAppearancePreserved,false);
 for(const [field,value]of [['frameFlip',true],['frameForward',[0,0,1]],['localForward',[0,0,1]]]){gun[field]=value;assert.equal(verify().allFittingPosesPreserved,false,field+' cannot silently turn an authored gun');delete gun[field];}
});
