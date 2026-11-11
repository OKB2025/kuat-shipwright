// v24 Trench batteries traverse ±85° from their wall, other broadside batteries ±65° (docs/trench-battery-arc-v24.md).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance});
for(const f of ['data/reference.js','data/imperial2.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),src=fs.readFileSync(path.join(root,'js/core.js'),'utf8'),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
test('the trench arc is ±85° by ±20°',()=>{assert.equal(C.TRENCH_BATTERY_ARC.yawDeg,85);assert.equal(C.TRENCH_BATTERY_ARC.pitchDeg,20);});
test('fleet combat and the trial give trench batteries the wider arc and keep ±65° for other broadside batteries',()=>{
 assert.match(src,/surfaceBatteryInArc\(\{normal:m\.normal\|\|m\.dir,v:m\.v\},dir,m\.trenchArc\?TRENCH_BATTERY_ARC\.yawDeg:65\)/);
 assert.match(src,/trenchAggregate:false,trenchArc:true,muzzle:points\[i\]/);
 // The trench branch is tested before the generic embedded/fixed lock (a trench group is flagged fixed).
 assert.match(app,/const trialLimits=t=>t\.trenchAggregate&&!t\.pilot\?\{yaw:\(C\.TRENCH_BATTERY_ARC\?\.yawDeg\?\?65\)\*Math\.PI\/180/);
});
