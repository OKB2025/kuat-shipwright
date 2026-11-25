// 2026-11-25 Save, cache and worker review of the gun-rule change (two findings).
// 1. An aircraft's fixed laser points ahead (user「正面に向けてのみの配置」), but a saved gun that faces astern — the ARC-170's
//    tail guns — keeps facing astern: the rule is for new placements, not a migration that turns saved guns round.
// 2. combatClone copies a unit's pass state deeply: dogfightAim advances pass.dodge in place, so a shallow copy let a
//    commit on the copy move the plan's own dodge on (the same plan committed twice gave two results).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console:{log(){},warn(){},error(){}}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const C=vm.runInContext('Core',context);
const saved=key=>JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples',key,'design.json.gz'))));

test('the ARC-170 tail guns still face astern; its other fixed lasers face ahead',()=>{
  const ship=C.deserialize(saved('craft_arc170')),lasers=ship.fits.filter(f=>C.CRAFT_LASER_GEOMETRY[f.k]&&C.FITS[f.k].fixed);
  const astern=lasers.filter(f=>(f.frameForward||f.localForward)?.[0]<-.5),ahead=lasers.filter(f=>!astern.includes(f));
  assert.equal(astern.length,2,'the saved example has two guns facing astern');assert.ok(ahead.length>=2);
  for(const f of astern)assert.deepEqual(Array.from(C.fitFrameOf(f).fw),[-1,0,0]);
  for(const f of ahead)assert.deepEqual(Array.from(C.fitFrameOf(f).fw),[1,0,0]);
});
test('a fixed laser with no saved facing, or one saved facing sideways, faces ahead',()=>{
  const ship=C.deserialize(saved('craft_arc170')),f=ship.fits.find(q=>C.CRAFT_LASER_GEOMETRY[q.k]&&C.FITS[q.k].fixed);
  for(const facing of [undefined,[0,1,0],[0,0,-1],[1,0,0]]){const g={...f,frameForward:facing,localForward:undefined};assert.deepEqual(Array.from(C.fitFrameOf(g).fw),[1,0,0]);}
});
test('a commit on a copy leaves the plan\'s dodge state where it was',()=>{
  const plan={id:'a',pos:[0,0,0],velocity:[200,0,0],yaw:0,p:{len:12,cls:{craft:true}},pass:{target:'b',phase:'dogfight',side:0}};
  const other={id:'b',pos:[300,0,0],velocity:[-200,0,0],yaw:Math.PI,p:{len:12,cls:{craft:true}}};
  let work={...plan,...C.combatClone(plan)};C.dogfightAim(work,other,work.pass,.1);plan.pass=JSON.parse(JSON.stringify(work.pass));
  assert.ok(plan.pass.dodge,'the merge starts a dodge');const before=JSON.stringify(plan.pass);
  work={...plan,...C.combatClone(plan)};assert.notEqual(work.pass.dodge,plan.pass.dodge);C.dogfightAim(work,other,work.pass,.1);
  assert.equal(JSON.stringify(plan.pass),before);assert.notEqual(JSON.stringify(work.pass),before,'the copy itself moved on');
});
