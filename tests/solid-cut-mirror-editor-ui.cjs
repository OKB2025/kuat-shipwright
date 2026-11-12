// Editor side of mirrored cuts on a hull off the centreline (user decision 2026-11-11, "削りと接続").
// A hull-owned mirrored cut mirrors about its hull's centreline. The cutter overlay and the draft must
// show that mirror half, not the one at world -z, and Apply must keep it there when the scope changes.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),run=s=>vm.runInContext(s,cx);
function section(a,b){const i=app.indexOf(a),j=app.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return app.slice(i,j);}
run(`const C=Core,st={mirror:false,tab:'carve',carveTool:'solid'},notices=[];let ship=null,uploaded=null,cutterOverlayKey='',cutterOwner=null,cutterDrag=null;
const view={upload(name,g){uploaded=g;},setLines(){}};function requestDraw(){}function renderPanel(){}function toast(m){notices.push(m);}function cutterActive(){return true;}
function ensureSolidCutter(){return st.solidCutter;}
function mutate(label,fn){const before=JSON.stringify(C.serialize(ship));const r=fn();if(typeof r==='string'){notices.push(r);return false;}ship._cache=null;return JSON.stringify(C.serialize(ship))!==before;}`);
run(section('function ownedSolidCut(','function resetSolidCutter('));
run(section('function refreshSolidCutterOverlay(','function updateCutterDraft('));
run(section('function applySolidCutter(','function cutterPlanePoint('));

const ID=900;
function setup(){
 const C=run('C'),s=C.newShip({L:200,W:32,H:32,plan:'cigar',sec:'ellipse'},'mirror editor');s.fits=[];C.ensurePrimaryHull(s);
 const hull=s.parts[0],h2=JSON.parse(C.publicJSON(hull));h2.id=s.nextId++;h2.c=[hull.c[0],hull.c[1],hull.c[2]+20];delete h2.primaryHull;h2.label='H2';h2.hullData={...h2.hullData,solidCuts:[],subs:[]};s.parts.push(h2);
 const H2=s.parts.find(q=>q.label==='H2');s.nextId=Math.max(s.nextId,ID+1);
 // In H2's frame z -9..-1 and its mirror +1..+9: world z 11..19 and 21..29.
 H2.hullData.solidCuts.push(C.normalizeSolidCut({id:ID,shape:'box',c:[110,16,-5],s:[20,8,6],rotation:[0,0,0],mirror:true}));s._cache=null;C.refreshPlacementGeometry(s);
 cx.inputShip=s;run("ship=inputShip;st.solidCutEdit=null;st.solidCutter=null;st.cutterHullId=null;st.cutterVisible=true;cutterOverlayKey='';uploaded=null;notices.length=0;");
 return {C,s,H2};
}
// z faces of the boxes the overlay draws (two boxes: four distinct z values), paired as [min,max] per box.
function overlayZ(){
 const g=run('uploaded'),zs=[...new Set(Array.from({length:g.n},(_,i)=>+g.pos[i*3+2].toFixed(3)))].sort((a,b)=>a-b),out=[];
 for(let i=0;i<zs.length;i+=2)out.push([zs[i],zs[i+1]]);return out;
}
const halves=s=>JSON.parse(JSON.stringify(s.solidCuts.map(c=>{const b=run('C').compiledSolidCut(c).instances.map(q=>q.bounds);return b.map(x=>[+x[2].toFixed(3),+x[5].toFixed(3)]);}).flat().sort((a,b)=>a[0]-b[0])));

test('selecting a mirrored hull cut on an off-centre hull: the list names the hull centreline and the overlay draws the mirror half at the hull mirror (z 21..29), not at -z',()=>{
 const {H2}=setup();
 const listed=run('visibleSolidCuts()').find(c=>c.id===ID);assert.equal(listed.hullMirror,H2.id);assert.equal(listed.mirror,true);
 run(`st.solidCutEdit=${ID};st.solidCutter=C.normalizeSolidCut(worldSolidCut(${ID}));refreshSolidCutterOverlay();`);
 assert.equal(run('cutterMirrorHull(st.solidCutter)').id,H2.id);
 assert.deepEqual(overlayZ(),[[11,19],[21,29]]);
 // The primary hull is on the centreline: its mirrored cuts stay a single cut mirrored about z=0.
 assert.equal(run('C.hullMirrorIsWorldMirror(ship.parts[0])'),true);
});

test('Apply on the edited cut with 全体に適用 on keeps both halves at the hull mirror; switching it back joins them into one hull cut again',()=>{
 const {C,s,H2}=setup();
 run(`st.solidCutEdit=${ID};st.solidCutter=C.normalizeSolidCut({...worldSolidCut(${ID}),structures:true});refreshSolidCutterOverlay();`);
 assert.deepEqual(overlayZ(),[[11,19],[21,29]],'the overlay keeps the hull mirror while the switch is on');
 assert.equal(run('applySolidCutter()'),true);
 assert.equal(H2.hullData.solidCuts.length,0);assert.deepEqual(halves(s),[[11,19],[21,29]]);assert.ok(s.solidCuts.every(c=>c.structures&&!c.mirror));
 assert.equal(run('st.solidCutEdit'),ID,'the draft follows the half that kept the id');
 // Edit one half (the one with the new id) back to hull-only: its other half goes with it, and they join
 // into one mirrored hull cut under the original id.
 cx.editId=s.solidCuts.find(c=>c.id!==ID).id;run(`st.solidCutEdit=editId;st.cutterHullId=null;st.solidCutter=C.normalizeSolidCut({...worldSolidCut(editId),structures:false});applySolidCutter();`);
 assert.equal(s.solidCuts.length,0);assert.equal(JSON.stringify(H2.hullData.solidCuts.map(c=>[c.id,c.mirror,c.c.map(v=>+v.toFixed(6))])),JSON.stringify([[ID,true,[110,16,-5]]]));
 assert.equal(run('st.solidCutEdit'),null,'the joined-away id is no longer edited');
});

test('a new mirrored hull-only cut on the off-centre hull: the overlay shows the hull mirror and Apply stores it there; with 全体に適用 on it mirrors about z=0',()=>{
 const {C,s,H2}=setup();H2.hullData.solidCuts=[];s._cache=null;
 run(`st.cutterHullId=${H2.id};st.solidCutter=C.normalizeSolidCut({shape:'box',c:[60,16,15],s:[20,8,6],mirror:true,structures:false});refreshSolidCutterOverlay();`);
 assert.deepEqual(overlayZ(),[[11,19],[21,29]]);
 assert.equal(run('applySolidCutter()'),true);
 const cut=H2.hullData.solidCuts[0];assert.equal(cut.mirror,true);
 const b=C.compiledSolidCut(C.hullWorldSolidCut(H2,C.mirrorSolidCut(cut))).instances[0].bounds;assert.deepEqual([+b[2].toFixed(3),+b[5].toFixed(3)],[21,29],'stored mirror half is where the overlay drew it');
 // A new scope-all mirrored cut is a ship-level cut: its mirror is world z=0, and the overlay says so.
 run(`st.solidCutEdit=null;st.cutterVisible=true;st.solidCutter=C.normalizeSolidCut({shape:'box',c:[140,16,15],s:[20,8,6],mirror:true,structures:true});refreshSolidCutterOverlay();`);
 assert.equal(run('cutterMirrorHull(st.solidCutter)'),null);assert.deepEqual(overlayZ(),[[-19,-11],[11,19]]);
});

test('editing one half of a split mirrored cut edits both: the overlay draws both halves and Apply mirrors the other half about the hull centreline',()=>{
 const {C,s,H2}=setup();C.setSolidCutScope(s,ID,'all');const mate=s.solidCuts.find(c=>c.id!==ID).id;
 const listed=run('visibleSolidCuts()');assert.equal(listed.find(c=>c.id===ID).mirrorPair,mate);assert.equal(listed.find(c=>c.id===mate).mirrorPair,ID);
 run(`st.solidCutEdit=${ID};st.cutterVisible=true;st.solidCutter=C.normalizeSolidCut(worldSolidCut(${ID}));refreshSolidCutterOverlay();`);
 assert.equal(run('cutterMirrorHull(st.solidCutter)').id,H2.id);assert.deepEqual(overlayZ(),[[11,19],[21,29]],'both halves drawn');
 // Move the edited half 2 m outboard (world z 9..17): its partner follows to 23..31.
 run(`st.solidCutter.c[2]-=2;refreshSolidCutterOverlay();`);assert.deepEqual(overlayZ(),[[9,17],[23,31]]);
 assert.equal(run('applySolidCutter()'),true);assert.deepEqual(halves(s),[[9,17],[23,31]]);assert.equal(s.solidCuts.length,2);
 assert.equal(C.solidCutMirrorPartner(s,ID).mate.id,mate,'still a pair after the edit');
 // Turning 全体に適用 off on the edited half brings both back as one mirrored hull cut.
 run(`st.solidCutter=C.normalizeSolidCut({...worldSolidCut(${ID}),structures:false});applySolidCutter();`);
 assert.equal(s.solidCuts.length,0);assert.equal(JSON.stringify(H2.hullData.solidCuts.map(c=>[c.id,c.mirror,c.c.map(v=>+v.toFixed(6))])),JSON.stringify([[ID,true,[110,16,-7]]]));
});
