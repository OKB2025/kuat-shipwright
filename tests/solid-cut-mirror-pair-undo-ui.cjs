// Split mirrored cut pairs (a mirrored hull cut on a hull off the centreline, switched to 全体に適用) through
// the editor's real history: js/app.js snap / mutate / restore / undo. Each paired operation (scope switch,
// edit, 取り消す) is one Undo step, and Undo restores exactly the state before. Also the 左右対称 switch
// on a linked half (disabled; Apply never makes a duplicate).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),run=s=>vm.runInContext(s,cx);
function section(a,b){const i=app.indexOf(a),j=app.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return app.slice(i,j);}
run(`const C=Core,CUTTER_NAMES=C.SOLID_CUT_SHAPES,st={mirror:false,tab:'carve',carveTool:'solid',ve:{}},notices=[],undoStack=[],redoStack=[];
let ship=null,S=null,prevS=null,lastOp='',uploaded=null,cutterOverlayKey='',cutterOwner=null,cutterDrag=null;const view=null;
function requestDraw(){}function renderPanel(){}function toast(m){notices.push(m);}function cutterActive(){return true;}function esc(x){return String(x);}
function touch(){}function scheduleStats(){}function updateUndo(){}function autosave(){}function sndEdit(){}function sndUI(){}function hideInspect(){}function updateName(){}function previewHistory(){}
function findSel(){return null;}function cutPresetHTML(){return '';}function vertexPanelHTML(){return '';}function ensureSolidCutter(){return st.solidCutter;}`);
run(section('function snap(','function beginDrag('));
run(section('function undo()','function updateUndo()'));
run(section('function ownedSolidCut(','function resetSolidCutter('));
run(section('function reconcileSolidCutter(','function cutterActive('));
run(section('function cutterNumber(','function syncCutterFields('));
run(section('function applySolidCutter(','function cutterPlanePoint('));

const ID=900;
function setup(){
 const C=run('C'),s=C.newShip({L:200,W:32,H:32,plan:'cigar',sec:'ellipse'},'pair undo');s.fits=[];s.saveId='pair-undo';C.ensurePrimaryHull(s);
 const hull=s.parts[0],h2=JSON.parse(C.publicJSON(hull));h2.id=s.nextId++;h2.c=[hull.c[0],hull.c[1],hull.c[2]+20];delete h2.primaryHull;h2.label='H2';h2.hullData={...h2.hullData,solidCuts:[],subs:[]};s.parts.push(h2);
 const H2=s.parts.find(q=>q.label==='H2');s.nextId=Math.max(s.nextId,ID+1);
 H2.hullData.solidCuts.push(C.normalizeSolidCut({id:ID,shape:'box',c:[110,16,-5],s:[20,8,6],rotation:[0,0,0],mirror:true}));// Loaded through the normal loader, as Undo restores through it.
 cx.inputShip=C.deserialize(JSON.parse(C.publicJSON(C.serialize(s))));run("ship=inputShip;undoStack.length=0;redoStack.length=0;st.solidCutEdit=null;st.solidCutter=null;st.cutterHullId=null;notices.length=0;");
 return {C,H2:()=>run('ship').parts.find(p=>p.label==='H2')};
}
const state=()=>run('JSON.stringify(C.serialize(ship))'),cuts=()=>JSON.parse(run(`JSON.stringify({ship:(ship.solidCuts||[]).map(c=>[c.id,c.mirror]).sort((a,b)=>a[0]-b[0]),hull:ship.parts.find(p=>p.label==='H2').hullData.solidCuts.map(c=>[c.id,c.mirror])})`));
// One operation: exactly one Undo step, and Undo gives back the serialized state from before.
function oneStep(op,label){
 const before=state(),n=run('undoStack.length');run(op);assert.equal(run('undoStack.length'),n+1,label+': one Undo step');assert.notEqual(state(),before,label+': changed');
 run('undo()');assert.equal(state(),before,label+': Undo restores the state before');run('redo()');assert.notEqual(state(),before,label+': Redo again');
}

test('each paired operation is one Undo step and Undo restores serialize exactly: switch to all, edit one half, switch one half back, delete one half (both go)',()=>{
 setup();
 oneStep(`toggleSolidCutScope(${ID})`,'switch to all');assert.deepEqual(cuts(),{ship:[[ID,false],[ID+1,false]],hull:[]});
 assert.equal(run(`C.solidCutMirrorPartner(ship,${ID}).mate.id`),ID+1);
 oneStep(`st.solidCutEdit=${ID};st.solidCutter=C.normalizeSolidCut(worldSolidCut(${ID}));st.solidCutter.c[0]+=4;applySolidCutter()`,'edit one half');
 assert.deepEqual(JSON.parse(run('JSON.stringify(ship.solidCuts.map(c=>+c.c[0].toFixed(6)))')),[114,114],'the other half followed');
 oneStep(`toggleSolidCutScope(${ID+1})`,'switch the other half back');assert.deepEqual(cuts(),{ship:[],hull:[[ID,true]]});
 run('undo()');assert.deepEqual(cuts(),{ship:[[ID,false],[ID+1,false]],hull:[]});
 oneStep(`deleteSolidCut(${ID+1})`,'delete one half');assert.deepEqual(cuts(),{ship:[],hull:[]},'both halves deleted');
});

test('the 左右対称 switch is disabled on a linked half, and Apply with mirror on still leaves exactly the two plain halves',()=>{
 setup();run(`toggleSolidCutScope(${ID})`);
 run(`st.solidCutEdit=${ID};st.solidCutter=C.normalizeSolidCut(worldSolidCut(${ID}));`);
 assert.match(run('solidCutPanelHTML()'),/data-cutter-mirror\s+disabled/,'disabled while linked');
 run(`st.solidCutter.mirror=true;applySolidCutter();`);
 assert.deepEqual(cuts(),{ship:[[ID,false],[ID+1,false]],hull:[]},'no mirrored duplicate');assert.equal(run(`C.solidCutMirrorPartner(ship,${ID}).mate.id`),ID+1);
 // An unlinked cut keeps the switch.
 run(`deleteSolidCut(${ID});st.solidCutEdit=null;st.solidCutter=C.normalizeSolidCut({shape:'box',c:[60,16,0],s:[10,8,6]});`);
 assert.doesNotMatch(run('solidCutPanelHTML()'),/data-cutter-mirror\s+disabled/);
});
