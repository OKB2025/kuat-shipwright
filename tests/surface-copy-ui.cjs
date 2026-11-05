const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),run=code=>vm.runInContext(code,context),plain=x=>JSON.parse(JSON.stringify(x));
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);run(app.slice(a,b));}
run(`const C=Core;let ship,clipboard,history=[],messages=[];
 const st={multi:{parts:new Set(),fits:new Set()},pasteMode:'same',xf:{step:20}},publicCopy=x=>JSON.parse(C.publicJSON(x)),clipRead=()=>clipboard,clipWrite=c=>clipboard=c,toast=s=>messages.push(s),sndUI=()=>{},esc=String,fmtM=v=>v+' m';
 const mutate=(label,fn)=>{const old=C.serialize(ship),r=fn();history.push(old);return r===undefined?true:r;};
 const multiItems=()=>({parts:ship.parts.filter(p=>st.multi.parts.has(p.id)),fits:ship.fits.filter(f=>st.multi.fits.has(f.id))});
 const xfDrivers=()=>{const m=multiItems();return ['parts','fits'].flatMap(list=>m[list].map(it=>({list,it,fol:[]})));};
 const xfBox=(list,q)=>list==='parts'?C.partAABB(q):C.fitAABB(q),xfUnion=boxes=>[0,1,2].map(a=>Math.min(...boxes.map(b=>b[a]))).concat([0,1,2].map(a=>Math.max(...boxes.map(b=>b[a+3])))),xfCheck=()=>new Map(),edGroups=()=>[],edLeaves=()=>({parts:[],fits:[]}),edParent=()=>null,seatFit=(f,p,n)=>{f.p=p;f.n=n;};
 function empty(){const s=C.newShip({L:500,W:300,H:150,plan:'rect',sec:'rect'},'Target');s.hull.assembly=true;s.parts=[];s.fits=[];return s;}
 function fixture(){ship=empty();ship.parts=[{id:1,k:'struct',form:'box',c:[70,30,70],s:[60,30,36],taper:0,skin:'service',paint:'#8195ad'}];ship.nextId=2;for(const [face,thickness]of [['port',.7],['top',.2]])if(!C.setStructureFaceArmor(ship,1,face,thickness).ok)throw Error('armor fixture failed');st.multi={parts:new Set([1]),fits:new Set()};st.sel={list:'parts',id:1};history=[];messages=[];}
 function faceArmor(id){return C.structureArmorFaces(ship,id).map(p=>({face:p.face,thickness:p.thickness})).sort((a,b)=>a.face.localeCompare(b.face));}
`);
section('function multiCopy(', 'function multiDelete(');section('function copyWingLinks(', 'function multiPanelHTML(');section('function editDuplicate(', 'function editDelete(');

test('the real clipboard path carries face armor and the original skin through paste and undo/redo snapshots',()=>{
 run('fixture();const source=JSON.stringify(faceArmor(1));multiCopy();clipboard=JSON.parse(JSON.stringify(clipboard));ship=empty();multiPaste();');
 assert.equal(run('ship.parts.length'),1);assert.equal(run('ship.fits.length'),0);assert.equal(run('C.surfaceWorkingShip(ship).parts.filter(p=>p.surfacePatch).length'),0);assert.equal(run('C.surfaceDerivedFits(ship).length'),0);assert.equal(run('history.length'),1);assert.equal(run('JSON.stringify(faceArmor(ship.parts[0].id))===source'),true);assert.equal(run('ship.parts[0].skin'),'service');assert.equal(run('ship.parts[0].paint'),'#8195ad');const armor=plain(run('faceArmor(ship.parts[0].id)')),snapshot=run('C.serialize(ship)');assert.equal(run('ship.surfaces.patches.filter(p=>p.authored).length'),2);
 run('ship=C.deserialize(history[0]);C.surfaceSync(ship)');assert.equal(run('ship.fits.length'),0);assert.equal(run('ship.parts.length'),0);
 context.savedSnapshot=snapshot;run('ship=C.deserialize(savedSnapshot);C.surfaceSync(ship)');assert.deepEqual(plain(run('faceArmor(ship.parts[0].id)')),armor);assert.equal(run('ship.parts[0].skin'),'service');assert.equal(run('ship.parts[0].paint'),'#8195ad');assert.equal(run('C.surfaceDerivedFits(ship).length'),0);
});

test('the real duplicate action copies a selected host and its face armor once without changing the original',()=>{
 run('fixture();const original=C.publicJSON(ship.parts[0]),sourceArmor=JSON.stringify(faceArmor(1));editDuplicate();');
 assert.equal(run('ship.parts.filter(p=>p.k==="struct").length'),2);assert.equal(run('ship.parts.filter(p=>p.surfacePatch).length'),0);assert.equal(run('ship.fits.length'),0);assert.equal(run('C.surfaceWorkingShip(ship).parts.filter(p=>p.surfacePatch).length'),0);assert.equal(run('C.surfaceDerivedFits(ship).length'),0);assert.equal(run('ship.surfaces.patches.filter(p=>p.authored).length'),4);assert.equal(run('new Set(ship.surfaces.patches.map(p=>p.id)).size===ship.surfaces.patches.length'),true);assert.equal(run('history.length'),1);
 assert.equal(run('C.publicJSON(ship.parts.find(p=>p.id===1))===original'),true);assert.equal(run('JSON.stringify(faceArmor(1))===sourceArmor'),true);assert.equal(run('JSON.stringify(faceArmor(ship.parts.find(p=>p.id!==1).id))===sourceArmor'),true);const armor=plain(run('ship.parts.map(p=>faceArmor(p.id))'));run('C.surfaceSync(ship)');assert.deepEqual(plain(run('ship.parts.map(p=>faceArmor(p.id))')),armor);
});

test('surface-capacity rejection happens before paste mutates the design or consumes an undo step',()=>{
 run('fixture();multiCopy();ship=empty();ship.surfaces={version:1,mode:"strict",patches:Array.from({length:C.SURFACE_MAX||512},(_,i)=>({id:"existing"+i}))};const old=JSON.stringify(ship);multiPaste();');
 assert.equal(run('JSON.stringify(ship)===old'),true);assert.equal(run('history.length'),0);assert.equal(run('messages.some(s=>s.includes("表面パッチの上限"))'),true);
});
