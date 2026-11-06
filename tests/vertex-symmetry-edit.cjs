const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),plain=x=>JSON.parse(JSON.stringify(x)),run=s=>vm.runInContext(s,cx);
function section(a,b){const i=app.indexOf(a),j=app.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return app.slice(i,j);}
vm.runInContext(`const C=Core,undoStack=[],redoStack=[],st={ve:{mirror:false},sel:null},view=null;let ship,S=null,prevS=null,lastOp='',dragSnap=null,dragLabel='';
function touch(){}function scheduleStats(){}function updateUndo(){}function autosave(){}function sndEdit(){}function sndUI(){}function toast(){}function esc(x){return x;}
function reconcileSolidCutter(){}function hideInspect(){}function updateName(){}function renderPanel(){}function findSel(s){return ship[s.list].find(p=>p.id===s.id);}`,cx);
vm.runInContext(section('function snap(','function updateUndo()'),cx);
vm.runInContext(section('function previewHistory(','// Exterior view skips'),cx);
vm.runInContext(section('function veCommit(','function veUndoLocal('),cx);

function four(tilted=false){
 const s=C.newShip({L:240,W:120,H:80,plan:'rect',sec:'rect'},'Vertex symmetry');s.saveId='vertex-edit';
 const a={id:1,k:'struct',form:'box',c:[100,65,30],s:[24,18,10],yaw:tilted?31:0,pitch:tilted?17:0,roll:tilted?9:0};a.mesh=C.structToMesh(a);a.form='mesh';a.mesh.cellFaces=[0];
 a.wing=C.normalizeWing({foil:true,axis:'x',stow:0,open:20,pivot:[100,65,20]});
 const z=C.mirrorPart(a,s),y=C.vmirrorPart(a,s),yz=C.vmirrorPart(z,s);z.id=2;y.id=3;yz.id=4;
 Object.assign(a,{tw:2,vt:3});Object.assign(z,{tw:1,vt:4});Object.assign(y,{tw:4,vt:1});Object.assign(yz,{tw:3,vt:2});
 s.parts=[a,z,y,yz];s.fits=[];s.nextId=5;return s;
}
function reset(s,id=1){cx.inputShip=s;cx.selectedId=id;run("ship=inputShip;undoStack.length=0;redoStack.length=0;st.sel={list:'parts',id:selectedId};st.ve.mirror=false;");}
function current(){return run('ship');}
function vertices(p){const sc=[p.s[0],p.s[2],p.s[1]];return p.mesh.v.map(v=>Array.from(C.worldStruct(p,v.map((x,a)=>x*sc[a]))));}
function snapshot(s){return s.parts.map(p=>({id:p.id,c:Array.from(p.c),points:vertices(p),wing:plain(p.wing),tw:p.tw,vt:p.vt,cellFaces:plain(p.mesh.cellFaces)}));}
function reflect(s,p,z,y){let q=p;if(y)q=C.vmirrorPoint(s,q);if(z)q=C.mirrorP(q);return q;}
function near(a,b,label,eps=1e-6){assert.equal(a.length,b.length,label);a.forEach((n,i)=>assert.ok(Math.abs(n-b[i])<=eps,`${label}: ${a} != ${b}`));}
function checkPeers(s,before,id){
 const source=s.parts.find(p=>p.id===id),oldSource=before.find(p=>p.id===id),flags={1:[false,false],2:[true,false],3:[false,true],4:[true,true]},sourceFlags=flags[id];
 for(const p of s.parts){if(p.id===id)continue;const [z,y]=flags[p.id].map((v,a)=>v!==sourceFlags[a]),old=before.find(q=>q.id===p.id),offset=C.sub(old.c,reflect(s,oldSource.c,z,y)),want=vertices(source).map(v=>C.add(reflect(s,v,z,y),offset)),actual=vertices(p);
  for(const v of want)assert.ok(actual.some(a=>C.len(C.sub(a,v))<1e-6),`source ${id}, sibling ${p.id}: ${v} must be reflected once`);
  assert.deepEqual(plain(p.wing),old.wing,'editing geometry preserves the sibling hinge and its own metadata');assert.equal(p.tw,old.tw);assert.equal(p.vt,old.vt);assert.deepEqual(plain(p.mesh.cellFaces),old.cellFaces);
 }
}
function edit(id=1,delta=[1,.25,-.5]){cx.editId=id;cx.editDelta=delta;return run("(()=>{const p=ship.parts.find(q=>q.id===editId),sc=[p.s[0],p.s[2],p.s[1]],local=p.mesh.v.map(v=>v.map((n,a)=>n*sc[a]));return veCommit({kind:'struct',p,local},new Map([[0,C.add(local[0],editDelta)]]),'vertex edit');})()");}

test('moving a mesh vertex from any of four linked structures updates all reflected world geometry exactly once',()=>{
 for(const tilted of [false,true])for(const id of [1,2,3,4]){const s=four(tilted),before=snapshot(s);reset(s,id);assert.equal(edit(id),true);checkPeers(current(),before,id);assert.equal(run('undoStack.length'),1);assert.ok(C.len(C.sub(vertices(current().parts.find(p=>p.id===id))[0],before.find(p=>p.id===id).points[0]))>.5);}
});

test('the four-way edit is one real Undo/Redo operation and all geometry and hinges survive public save/load',()=>{
 const s=four(true);reset(s);const before=snapshot(s);assert.equal(edit(),true);const after=snapshot(current()),save=plain(C.serialize(current()));
 run('undo()');for(const p of snapshot(current())){const want=before.find(q=>q.id===p.id);p.points.forEach((v,i)=>near(v,want.points[i],'undo world point'));assert.deepEqual(p.wing,want.wing);}assert.equal(run('undoStack.length'),0);assert.equal(run('redoStack.length'),1);
 run('redo()');for(const p of snapshot(current())){const want=after.find(q=>q.id===p.id);p.points.forEach((v,i)=>near(v,want.points[i],'redo world point'));assert.deepEqual(p.wing,want.wing);}
 const loaded=C.deserialize(save);for(const p of snapshot(loaded)){const want=after.find(q=>q.id===p.id);p.points.forEach((v,i)=>near(v,want.points[i],'save world point'));assert.deepEqual(p.wing,want.wing);assert.equal(p.tw,want.tw);assert.equal(p.vt,want.vt);}
});

test('internally symmetric user-part children retain their placed mirror-plane offsets during a vertex edit',()=>{
 const source=four(true);source.groups=[{id:5,name:'Four foils',parts:[1,2,3,4],fits:[],groups:[]}];source.nextId=6;
 const captured=C.assemblyCapture(source,{parts:[1,2,3,4],fits:[]},{name:'Four foils'});assert.ok(captured.template);const template=C.normalizeAssemblyTemplate(plain(captured.template));
 const target=C.newShip({L:800,W:400,H:200,plan:'rect',sec:'rect'},'Offset assembly');target.parts=[];target.fits=[];target.nextId=1;target.saveId='offset-assembly';const placed=C.assemblyPlace(target,template,[250,140,70]);assert.equal(placed.parts.length,4);assert.ok(placed.groups.length);
 const before=snapshot(target),groups=plain(target.groups),original=plain(source);reset(target);assert.equal(edit(),true);checkPeers(current(),before,1);assert.deepEqual(plain(target.groups),groups);assert.deepEqual(plain(source),original,'editing the instance must not edit its source design');
 for(const p of target.parts){const old=before.find(q=>q.id===p.id);assert.ok(C.len(C.sub(p.c,old.c))<2,'refitting must not move a child onto the hull global mirror plane');}
 const restored=C.deserialize(plain(C.serialize(target)));assert.equal(restored.parts.length,4);checkPeers(restored,before,1);
});

test('following the four meshes keeps face armor configuration and independent foil pivots',()=>{
 const s=four();s.hull.assembly=true;assert.equal(C.enableSurfaceMode(s,true).ok,true);const patch=C.surfacePatches(s).find(p=>p.host==='p1'&&p.face==='top');assert.ok(patch);
 assert.equal(C.setSurfaceConfig(s,patch.id,{armor:{material:'dense',thickness:.1}}).ok,true);
 // Face settings now describe armor only. Physical areas come from the
 // current mesh, while the saved configuration survives vertex editing.
 const config=plain(s.surfaces),settings=o=>{const copy=plain(o);for(const p of copy.patches)delete p.boundArea;return copy;},areas=new Map(C.surfacePatches(s).map(p=>[p.id,p.area])),hinges=s.parts.filter(p=>p.id<=4).map(p=>plain(p.wing));assert.equal(s.parts.filter(p=>p.surfacePatch).length,0);
 reset(s);assert.equal(edit(),true);C.surfaceSync(s);assert.deepEqual(settings(s.surfaces),settings(config));assert.ok(C.surfacePatches(s).some(p=>Math.abs(p.area-areas.get(p.id))>1e-4),'the changed physical face area is recomputed');assert.equal(s.parts.filter(p=>p.surfacePatch).length,0);
 assert.deepEqual(s.parts.filter(p=>p.id<=4).map(p=>plain(p.wing)),hinges);assert.equal(run('undoStack.length'),1);
});

test('self links, duplicate peers and cyclic malformed symmetry links cannot modify the source twice or expand traversal',()=>{
 const s=four();s.parts[0].tw=1;s.parts[0].vt=2;s.parts[1].tw=3;s.parts[1].vt=3;s.parts[2].tw=4;s.parts[2].vt=1;s.parts[3].tw=1;s.parts[3].vt=2;
 const writes=new Map();for(const p of s.parts){let mesh=p.mesh;Object.defineProperty(p,'mesh',{enumerable:true,configurable:true,get:()=>mesh,set:v=>{writes.set(p.id,(writes.get(p.id)||0)+1);mesh=v;}});}
 reset(s);assert.equal(edit(),true);assert.equal(run('undoStack.length'),1);assert.ok(writes.get(1)<=2,'source assignment plus refit only');for(const id of [2,3,4])assert.ok((writes.get(id)||0)<=1,'each peer is assigned at most once');
 assert.ok(run('veSymmetryPeers(ship.parts[0]).length')<=3);assert.equal(new Set(s.parts.map(p=>p.id)).size,4);
});

test('a rejected collapsed-face edit changes no sibling and consumes no Undo step',()=>{
 const s=four();reset(s);const before=plain(C.serialize(s));cx.collapseId=s.parts[0].mesh.f[0][1];
 const result=run("(()=>{const p=ship.parts[0],sc=[p.s[0],p.s[2],p.s[1]],local=p.mesh.v.map(v=>v.map((n,a)=>n*sc[a]));return veCommit({kind:'struct',p,local},new Map([[p.mesh.f[0][0],local[collapseId]]]),'invalid vertex edit');})()");
 assert.equal(result,false);assert.deepEqual(plain(C.serialize(s)),before);assert.equal(run('undoStack.length'),0);
});
