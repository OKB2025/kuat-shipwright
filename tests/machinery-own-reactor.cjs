// An engine's machinery may start inside its own reactor but not run past the reactor's centre (user 2026-11-27「TIE/lnとinのエンジンに反応炉が
// めり込んでてもエラーが出てないのはなぜ」). Was: any overlap with the machinery's own reactor passed.
const path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'));
test('a route past its reactor\'s centre overlaps it; one that only starts inside does not',()=>{
 const reactor={id:1,k:'aux',c:[0,0,0],d:1};
 /* the routes stand in as long boxes, as a machinery route is: only their boxes are read */const through={id:-2,k:'struct',form:'box',c:[0,0,0],s:[2,.4,.4]},edge={id:-3,k:'struct',form:'box',c:[.9,0,0],s:[1,.4,.4]};
 const box=q=>C.partAABB(q);assert.ok(box(through)[0]<0&&box(through)[3]>0,'fixture: the first route spans the centre');assert.ok(box(edge)[0]>0&&box(edge)[0]<.5,'fixture: the second starts inside, short of the centre');
 assert.equal(C.machineryPastReactorCentre(through,reactor),true);assert.equal(C.machineryPastReactorCentre(edge,reactor),false);
});
// 2026-11-27 expectation changed (reviews): the TIE/ln example is now built from the user's fixed design (tie_ln-refit-fix-2026-11-27.json),
// whose drives no longer run through its reactor; the case is kept on the design the rule was made for (tie_ln-refit-2026-11-27.json, was
// the example itself), and the example is checked to be clear of it.
test('the TIE/ln design of 2026-11-27 reports its drives in its reactor; the user\'s fixed design, the example now, does not',()=>{
 const raw=JSON.parse(require('node:fs').readFileSync(path.join(process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'),'docs/handoff-2026-11-20/refs/tie_ln-refit-2026-11-27.json'),'utf8')),old=C.deserialize(raw),S=C.computeStats(old);
 assert.ok(S.warnings.some(w=>/干渉しています/.test(w.text||'')),S.warnings.map(w=>w.text).join(' / '));
 for(const key of ['craft_tie_ln','craft_tie_in','craft_hyena']){const F=C.computeStats(C.buildDesign(key));assert.ok(!F.warnings.some(w=>/干渉しています/.test(w.text||'')),key+': '+F.warnings.map(w=>w.text).join(' / '));}
});
