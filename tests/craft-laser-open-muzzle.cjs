// 2026-11-23 A craft's fixed laser sunk into the hull fires while its muzzle is clear (user: 「航空機のレーザー砲は砲口が開いてるなら
// 撃てるようにして」). The user's TIE/in remodel (docs/handoff-2026-11-20/refs/tie-in-remodel-2026-11-23.json) has its two chin guns
// 0.34 m inside the cockpit pod with a sink of 0.315 m; they had counted as having lost their seat.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),{C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const raw=()=>JSON.parse(fs.readFileSync(path.join(root,'docs/handoff-2026-11-20/refs/tie-in-remodel-2026-11-23.json'),'utf8'));
const load=o=>{const s=C.deserialize(o);C.syncCompartments(s);C.remount(s,{keepFitPose:true});C.syncCompartments(s);return s;};
test('the remodel\'s sunk chin guns are seated: their muzzles are clear',()=>{
 const s=load(raw());for(const id of [404,405]){const f=s.fits.find(q=>q.id===id);assert.equal(f.float,false,'#'+id);assert.equal(C.craftMuzzleBlocked(s,f),false);}
 assert.equal(s.fits.filter(f=>f.float).length,0);const o=JSON.parse(JSON.stringify(C.serialize(s)));assert.equal(o.fits.find(f=>f.id===404).p[1],raw().fits.find(f=>f.id===404).p[1],'the pose is kept');
});
test('a laser buried with its muzzle inside the hull still counts as unseated',()=>{
 const o=raw(),f=o.fits.find(q=>q.id===404);f.p=[3.06,3.51,-.62];/* the middle of the pod: barrel and muzzle inside */const s=load(o);assert.equal(s.fits.find(q=>q.id===404).float,true);
});

test('the TIE/D remodel\'s chin lasers (placed directly, sunk 0.23 m into the pod with their muzzles clear) are seated',()=>{
 const o=JSON.parse(fs.readFileSync(path.join(root,'docs/handoff-2026-11-20/refs/tie-d-remodel-2026-11-23.json'),'utf8')),s=load(o);
 for(const id of [1008,1009])assert.equal(s.fits.find(f=>f.id===id).float,false,'#'+id);assert.equal(s.fits.filter(f=>f.float).length,0);
});
