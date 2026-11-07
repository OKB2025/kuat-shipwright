const assert=require('node:assert/strict'),path=require('node:path'),{test}=require('node:test');
const G=require('../scripts/update-ship-examples.cjs'),P=require('../scripts/refresh-imperial-layouts.cjs'),{C}=G.loadRuntime(path.join(__dirname,'..')),copy=value=>JSON.parse(JSON.stringify(value));
const cases={imperial:60,imperial2:60,arquitens:null,cr90:81,hammerhead:85,mc80home:60,mc80liberty:60,mc75:70,mc30c:null};
function profile(key){return C.referenceSpeedProfile({mglt:58.7,maxSpeed:1174,accel:20,propulsion:{ratedAccelMps2:10000,accelerationLimitMps2:10000,ratedThrustN:2e14,massKg:2e10},grid:{P:1e25},heat:{mode:'strict'},gunArcs:[1,2,3],shieldBuffer:10},key);}
test('all nine fresh profiles use independent published speed literals or explicitly labelled assumptions',()=>{
 for(const [key,expected]of Object.entries(cases)){const p=profile(key),before=copy(p),proof=P.speedEvidence(C,{reference:key},p,key);assert.equal(proof.passed,true,key);assert.equal(proof.expectedMGLT,expected);assert.equal(proof.expectedStatus,expected==null?'assumed':'published');assert.deepEqual(copy(p),before,key+' speed checking cannot mutate physical ledgers');if(expected!=null){assert.equal(proof.actualMGLT,expected);assert.equal(proof.actualMaxSpeedMps,expected*20);}else{assert.equal(proof.profileReference.mglt,null);assert.equal(proof.profileReference.source,null);}}
});
test('the speed publication gate rejects wrong class speeds, fabricated provenance and missing speed APIs',()=>{
 let p=profile('cr90');p.mglt=80;p.maxSpeed=1600;assert.equal(P.speedEvidence(C,{reference:'cr90'},p,'cr90').passed,false);
 p=profile('imperial');p.maxSpeed=1210;assert.equal(P.speedEvidence(C,{reference:'imperial'},p,'imperial').passed,false);p=profile('mc30c');p.speedReference.status='published';p.speedReference.mglt=75;assert.equal(P.speedEvidence(C,{reference:'mc30c'},p,'mc30c').passed,false);
 p=profile('hammerhead');delete p.speedReference;assert.equal(P.speedEvidence(C,{reference:'hammerhead'},p,'hammerhead').passed,false);assert.equal(P.speedEvidence({}, {reference:'hammerhead'},p,'hammerhead').passed,false);
 const wrong={...C,sublightReference:key=>({...C.sublightReference(key),mglt:82}),referenceSpeedProfile:(p,key)=>({...C.referenceSpeedProfile(p,key),mglt:82,maxSpeed:1640})};p=wrong.referenceSpeedProfile(profile('cr90'),'cr90');p.speedReference=wrong.sublightReference('cr90');assert.equal(P.speedEvidence(wrong,{reference:'cr90'},p,'cr90').passed,false,'matching erroneous implementation values cannot replace the independent81MGLT reference');
});
test('a speed overlay cannot change physical thrust, power or heat to make a class speed fit',()=>{
 for(const changed of ['propulsion','grid','heat']){const bad={...C,referenceSpeedProfile:(p,key)=>{const out=copy(C.referenceSpeedProfile(p,key));out[changed]={...out[changed],unexpectedPhysicalChange:1};return out;}};assert.equal(P.speedEvidence(bad,{reference:'imperial'},profile('imperial'),'imperial').gates.overlayPreservesPhysics,false,changed);}
 const mutating={...C,referenceSpeedProfile:(p,key)=>{p.grid.P*=2;return C.referenceSpeedProfile(p,key);}};assert.equal(P.speedEvidence(mutating,{reference:'imperial'},profile('imperial'),'imperial').gates.overlayDoesNotMutateInput,false);
 const stopped=profile('imperial');stopped.accel=0;stopped.propulsion.ratedAccelMps2=stopped.propulsion.accelerationLimitMps2=0;assert.equal(P.speedEvidence(C,{reference:'imperial'},stopped,'imperial').passed,false,'an unpowered design cannot be published as an operable example');
});
