// 2026-11-27 user「船体構造物にも構造物と同じ塗色が出来るように」: the hull tab offers the structure's paint colour for the hull structure,
// the control names its part (so it paints that hull whatever else is selected), and the hull is drawn in it, its reference skin included.
// Browser evidence (inline engine, real UI: tap → 編集 → 船体の形状加工; red drawn, undo/redo, save round trip, back to standard):
// docs/benchmarks/hull-structure-paint-2026-11-27/.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),gfx=fs.readFileSync(path.join(root,'js/gfx.js'),'utf8'),run=code=>vm.runInContext(code,context);
function fn(name){const a=app.indexOf('function '+name+'('),b=app.indexOf('\nfunction ',a+1);assert.ok(a>=0&&b>a,name);run(app.slice(a,b));}
run('const C=Core,esc=String;');fn('structPaintHTML');
test('the hull structure gets its own paint control, named for it and for its part',()=>{
 const s=run(`(()=>{const s=C.newShip({L:300,W:90,H:50,plan:'arrow',sec:'rect'},'P');C.ensurePrimaryHull(s);return s;})()`),hull=s.parts.find(p=>run('C').isHullStructure(p));
 const html=run('structPaintHTML')(hull);assert.match(html,/船体構造物の塗色/);assert.match(html,new RegExp(`data-partpaint data-partpaint-id="${hull.id}"`));assert.doesNotMatch(html,/data-partpaintclear/,'nothing to clear while unpainted');
 hull.paint='#ff2020';const painted=run('structPaintHTML')(hull);assert.match(painted,/value="#ff2020"/);assert.match(painted,new RegExp(`data-partpaintclear data-partpaint-id="${hull.id}"`));
 assert.match(run('structPaintHTML')({id:7,k:'struct',form:'box'}),/構造物の塗色/);
});
test('the hull tab puts the control beside the hull\'s part editor, and the handlers paint the named part',()=>{
 assert.match(app,/if\(hullPart\)panel\.insertAdjacentHTML\('afterbegin',basePartEditor\(\)\+structPaintHTML\(hullPart\)\);/);
 assert.match(app,/if\('partpaint'in t\.dataset\)\{const id=t\.dataset\.partpaintId;if\(id!=null\)/);assert.match(app,/mutate\(C\.isHullStructure\?\.\(q\)\?'船体構造物の塗色':'構造物の色',\(\)=>paintPartById\(id,t\.value\),'parts'\)/);
 assert.match(app,/else if \('partpaintclear' in d\) \{ const id = d\.partpaintId; if \(id != null\)/);
});
test('the drawing takes the hull\'s paint: its own triangles (as before) and its reference skin',()=>{
 assert.match(gfx,/if\(C\.isHullStructure\?\.\(p\)\)T=renderHullTriangles\(ship,T,p\);hullTriangleMesh\(out\.struct,T,p\.paint\?hex\(p\.paint\)/);
 assert.match(gfx,/refTone\(data\.asset\|\|p\.hullData\.hullSkin\.asset,p\.paint\?hex\(p\.paint\):WHITE\)/);
});
test('the colour is kept in the saved design',()=>{
 const C=run('C'),s=C.newShip({L:300,W:90,H:50,plan:'arrow',sec:'rect'},'P');C.ensurePrimaryHull(s);const h=s.parts.find(p=>C.isHullStructure(p));h.paint='#ff2020';
 const back=C.deserialize(JSON.parse(JSON.stringify(C.serialize(s))));assert.equal(back.parts.find(p=>C.isHullStructure(p)).paint,'#ff2020');
});
test('paintPartById paints the named part, its twin with mirroring on, and clears both; a part that may not be edited is left alone',()=>{
 run(`var st={mirror:true},designEntityEditable=(l,p)=>!p.locked,twinOfItem=(l,p)=>ship.parts.find(q=>q.id===p.tw)||ship.parts.find(q=>q.tw===p.id)||null,ship={parts:[{id:1,k:'struct',form:'hull',tw:2},{id:2,k:'struct',form:'hull'},{id:3,k:'struct',form:'box',locked:true}]};`);fn('paintPartById');
 run('paintPartById(1,"#FF2020")');assert.deepEqual([...run('ship.parts.map(p=>p.paint||null)')],['#ff2020','#ff2020',null]);
 run('st.mirror=false;paintPartById(2,null)');assert.deepEqual([...run('ship.parts.map(p=>p.paint||null)')],['#ff2020',null,null],'without mirroring only the named part');
 run('paintPartById(3,"#00ff00")');assert.equal(run('ship.parts[2].paint'),undefined);
});
