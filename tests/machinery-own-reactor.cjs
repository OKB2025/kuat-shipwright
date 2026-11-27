// An engine's machinery may start inside its own reactor but not run past the reactor's centre (user 2026-11-27「TIE/lnとinのエンジンに反応炉が
// めり込んでてもエラーが出てないのはなぜ」). Was: any overlap with the machinery's own reactor passed.
const path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'));
test('a route past its reactor\'s centre overlaps it; one that only starts inside does not',()=>{
 const reactor={id:1,k:'aux',c:[0,0,0],d:1};
 /* the routes stand in as round parts: only their boxes are read */const through={id:-2,k:'aux',c:[0,0,0],d:2},edge={id:-3,k:'aux',c:[.9,0,0],d:1};
 const box=q=>C.partAABB(q);assert.ok(box(through)[0]<0&&box(through)[3]>0,'fixture: the first route spans the centre');assert.ok(box(edge)[0]>0&&box(edge)[0]<.5,'fixture: the second starts inside, short of the centre');
 assert.equal(C.machineryPastReactorCentre(through,reactor),true);assert.equal(C.machineryPastReactorCentre(edge,reactor),false);
});
test('the TIE/ln built from the design of 2026-11-27 reports its drives in its reactor',()=>{
 const s=C.buildDesign('craft_tie_ln'),S=C.computeStats(s);assert.ok(S.warnings.some(w=>/干渉しています/.test(w.text||'')),S.warnings.map(w=>w.text).join(' / '));
});
