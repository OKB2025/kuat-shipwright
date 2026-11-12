// Rigid follow through the editor's real history (js/app.js snap / restore / mutate / undo / redo): the editor
// moves the hull in one mutate; the Worker's followed result is adopted as the engine does (public fields, no
// history entry); Undo restores the hull and its children exactly; Redo brings the followed state back; the
// saved design reloads to the same poses.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),run=s=>vm.runInContext(s,cx),C=run('Core');
function section(a,b){const i=app.indexOf(a),j=app.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return app.slice(i,j);}
run(`const C=Core,st={},notices=[],undoStack=[],redoStack=[];let ship=null,S=null,prevS=null,lastOp='';const view=null;
function toast(m){notices.push(m);}function esc(x){return String(x);}function touch(){}function scheduleStats(){}function updateUndo(){}function autosave(){}function sndEdit(){}function sndUI(){}function hideInspect(){}function updateName(){}function previewHistory(){}
function findSel(){return null;}function renderPanel(){}function reconcileSolidCutter(){}`);
run(section('function snap(','function beginDrag('));
run(section('function undo()','function updateUndo()'));

function placeOn(s,parent,x,label,size,lift){const raw=C.rayPart([x,500,0],[0,-1,0],parent),hit={p:raw.p,n:C.norm(raw.n)},c=[hit.p[0],hit.p[1]+lift,hit.p[2]];
 const d=C.preparePlacementDraft(s,{id:s.nextId,k:'struct',form:'box',label,c,s:size,yaw:0,pitch:0,offsetX:0,offsetZ:0},{mode:'horizontal',parentStructureId:parent.id,hostId:parent.id,hit,contactFit:'cut',position:c,placementModelVersion:C.PLACEMENT_MODEL_VERSION,geometryRevision:1});
 assert.equal(d.ok,true,d.error);s.parts.push(d.part);s.nextId++;assert.equal(C.refreshPlacementGeometry(s).failed.length,0);return s.parts.find(q=>q.label===label);}
const state=()=>run('JSON.stringify(C.serialize(ship))'),poses=json=>{const o=typeof json==='string'?JSON.parse(json):json;return ['P','B'].map(l=>o.parts.find(q=>q.label===l).c.map(v=>+v.toFixed(9)));};

for(const [name,op] of [['turn and move',"const h=ship.parts[0];h.yaw=20;h.pitch=5;h.c=[h.c[0]+8,h.c[1],h.c[2]-3];"],['resize L 200 -> 240',"const h=ship.parts[0];C.setHullStructureDimensions(ship,h,[240,h.s[1],h.s[2]]);"]])
 test(`hull ${name}: one Undo step; Undo restores the hull and its children exactly; Redo restores the followed state; the save reloads the same`,()=>{
  const s=C.newShip({L:200,W:32,H:32,plan:'cigar',sec:'ellipse'},'undo follow');s.fits=[];s.saveId='undo-follow';C.ensurePrimaryHull(s);const P=placeOn(s,s.parts[0],90,'P',[16,8,6],1.8);placeOn(s,P,88,'B',[6,6,4],1.2);
  const loaded=C.deserialize(JSON.parse(C.publicJSON(C.serialize(s))));loaded.saveId='undo-follow';cx.input=loaded;run('ship=input;ship._client=true;undoStack.length=0;redoStack.length=0;');
  const worker=C.deserialize(JSON.parse(C.publicJSON(C.serialize(s)))),before=state();
  assert.equal(run(`mutate('hull edit',()=>{${op}},'all')`),true);assert.equal(run('undoStack.length'),1,'one undo step');
  // The Worker follows; the editor adopts the result (public fields of every part, no history entry).
  C.patchShip(worker,JSON.parse(run('C.publicJSON(ship)')));worker._cache=null;const r=C.refreshPlacementGeometry(worker);assert.equal(r.failed.length,0,JSON.stringify(r.failed));
  cx.adopt=JSON.parse(C.publicJSON(worker));run(`for(const it of ship.parts){const next=adopt.parts.find(q=>q.id===it.id);for(const k of Object.keys(it))if(k[0]!=='_')delete it[k];for(const [k,v] of Object.entries(next))if(k[0]!=='_')it[k]=v;}`);
  const adopted=state();assert.notDeepEqual(poses(adopted),poses(before),'children followed');assert.equal(run('undoStack.length'),1,'adoption adds no history');
  run('undo()');assert.equal(state(),before,'Undo restores the hull and the children exactly');
  run('redo()');{const diff=[],walk=(x,y,p)=>{if(JSON.stringify(x)===JSON.stringify(y))return;if(typeof x!=='object'||!x||!y)return diff.push(p+': '+JSON.stringify(x)+' | '+JSON.stringify(y));for(const k of new Set([...Object.keys(x),...Object.keys(y)]))walk(x[k],y[k],p+'.'+k);};walk(JSON.parse(state()),JSON.parse(adopted),'');assert.equal(diff.length,0,'Redo restores the followed state: '+diff.slice(0,6).join(' ; '));}
  const save=run('C.publicJSON(C.serialize(ship))');assert.deepEqual(poses(JSON.parse(C.publicJSON(C.serialize(C.deserialize(JSON.parse(save)))))),poses(adopted),'the save reloads to the same poses');
 });
