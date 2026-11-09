// v24 The hyperdrive charges from spare power instead of needing its whole draw at once.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx);
const unit=(Dj,P=1e12)=>({p:{grid:{P,Dj},modules:[]},hyperE:0});

test('a drive fills only from power left after the other loads, at no more than its rated draw',()=>{
 const need=1e9*C.HYPER_CHARGE.seconds;
 const u=unit(1e9);assert.equal(C.hyperChargeNeedJ(u.p),need);
 assert.equal(C.hyperChargeStep(u,1e12,1e12,1),0,'no spare power, no charge');assert.equal(C.hyperCharged(u),0);
 assert.equal(C.hyperChargeStep(u,1e12,1e12-2.5e8,1),2.5e8,'a quarter of the rated draw spare charges at a quarter rate');
 assert.equal(C.hyperChargeStep(u,1e12,0,1),1e9,'the rated draw caps the charge rate');
 for(let i=0;i<20;i++)C.hyperChargeStep(u,1e12,0,1);assert.equal(u.hyperE,need,'a full drive holds its charge');assert.equal(C.hyperCharged(u),1);
});
test('a profile made before v24 carries no jump draw and counts as charged',()=>{
 const u=unit(undefined);assert.equal(C.hyperChargeStep(u,1e12,0,1),0);assert.equal(C.hyperCharged(u),1);
});
test('a dead or unpowered ship does not charge',()=>{
 const dead={...unit(1e9),dead:true};assert.equal(C.hyperChargeStep(dead,1e12,0,1),0);
 const dark=unit(1e9,0);assert.equal(C.hyperChargeStep(dark,0,0,1),0);
});
test('ship statistics give the charge time from spare power rather than requiring the jump draw at once',()=>{
 const src=fs.readFileSync(path.join(root,'js/core.js'),'utf8');
 assert.match(src,/jumpOK = hyperEffectiveVolume > 0 && jumpRateW > 0/);assert.match(src,/jumpChargeS = jumpOK \? HYPER_CHARGE\.seconds\*Dj\/jumpRateW/);
 assert.match(src,/Dj:dr\.jump\|\|0/,'the fleet profile carries the jump draw');
});
