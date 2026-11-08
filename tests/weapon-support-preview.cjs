const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(__dirname,'..'),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
function fn(name){const start=new RegExp('function '+name+'\\s*\\(').exec(app);assert.ok(start,name);for(let i=app.indexOf('}',start.index);i>=0;i=app.indexOf('}',i+1)){const source=app.slice(start.index,i+1);try{new vm.Script(source);return source;}catch{}}assert.fail('complete '+name);}
function listener(prefix){const start=app.indexOf(prefix);assert.ok(start>=0,prefix);for(let i=app.indexOf(');',start);i>=0;i=app.indexOf(');',i+1)){const source=app.slice(start,i+2);try{new vm.Script(source);return source;}catch{}}assert.fail('complete listener');}
const active=g=>Array.from(g.pos.subarray(0,g.n*3));
function setup({deferredFrames=false}={}){
 const context=vm.createContext({console,performance,structuredClone});for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
 const run=code=>vm.runInContext(code,context);run(`
 const C=Core,ship=C.newShip({L:500,W:200,H:80,assembly:true});ship.parts=[];ship.fits=[];
 const st={tab:'mod',fit:'utl',ped:8,pedShape:'trap',pedSize:1.8,weaponMount:'auto',gunYaw:17,gunPitch:0,coded:false};
 const designUI={drawer:true,previewFrame:null,preview:null},canvas={hidden:false,insertAdjacentHTML(){throw Error('Real miniature geometry must render');}};
 const panelHandlers=[],panel={addEventListener(type,fn){if(type==='input')panelHandlers.push(fn);}},outputs=new Map();
 const $=selector=>selector==='#designPartPreview'?canvas:selector==='#panel'?panel:selector.startsWith('#out-')?(outputs.has(selector)?outputs.get(selector):(outputs.set(selector,{textContent:''}),outputs.get(selector))):null;
 const $$=()=>[],blockedHullControl=()=>false,updateHint=()=>{},hullEditorProfile=()=>ship.hull;
 const frames=new Map();let frameId=0;const cancelAnimationFrame=id=>frames.delete(id),requestAnimationFrame=cb=>{const id=++frameId;${deferredFrames?'frames.set(id,cb);':'cb();'}return id;};
 const flushFrames=()=>{for(let i=0;frames.size&&i<10;i++){const batch=[...frames.values()];frames.clear();for(const cb of batch)cb();}if(frames.size)throw Error('Preview frame queue did not settle');};
 let selected=null;const selItem=()=>selected,requestedPart=p=>p,tool=()=>st.tab==='edit'?'edit':'fit',curFit=()=>st.fit,fitPlacementPed=()=>st.ped;
 const fitPedestalAllowed=k=>C.fitHasPedestal(k),shipLauncherPlacementOptions=()=>({});
 const activeEquipment=()=>null,ballTurretCanPitch=()=>false,launcherCanPitch=()=>false,toast=()=>{};
 const FIT_TEMPLATE_KEYS=${app.match(/const FIT_TEMPLATE_KEYS = (\[[^;]+\]);/)[1]};
 const TEMPLATE_SKIP=${app.match(/const TEMPLATE_SKIP = (\[[^;]+\]);/)[1]};
 const userPartFind=()=>null,importResult=()=>null;
 const draws=[];Gfx.Renderer=class {constructor(){this.uploads={};this.cam={};}upload(k,g){this.uploads[k]=g;}draw(){draws.push(this);}dispose(){}};
 `);run(app.match(/^const xfUnion=.*;$/m)[0]);for(const name of ['weaponTiltMode','weaponLocalMount','weaponPlacementNormal','templateFor','activeTemplate','carryToPlace','designUIFitDraft','designUISchedulePreview'])run(fn(name));
 return {run,C:run('C'),G:run('Gfx')};
}
function snapshot(t){t.run('designUISchedulePreview()');assert.equal(t.run('canvas.hidden'),false);assert.ok(t.run('draws.length')>0,'the actual miniature generated render buffers');const renderer=t.run('designUI.preview');assert.ok(Number.isFinite(renderer.cam.r)&&renderer.off.every(Number.isFinite),'the real mounting mode produces a finite preview camera');return renderer;}
function expected(t,changes={}){const f={id:-1,k:'utl',_fit:true,p:[0,0,0],n:[0,1,0],a:2,base:0,ped:8,pedShape:'trap',pedSize:1.8,localMount:false,tilt:[0,1,0],mountMode:'auto',assetYaw:17,...changes},s=t.run('ship');return [t.G.meshFits(s,null,null,[f]),t.G.meshReferenceFits(s,null,[f])];}
function compareMeshes(renderer,meshes){for(const name of ['previewFits','previewRefFits'])assert.ok(active(renderer.uploads[name]).every(Number.isFinite),'all actual '+name+' vertices are finite');assert.deepEqual(active(renderer.uploads.previewFits),active(meshes[0]),'manual support uses the installed fitting geometry');assert.deepEqual(active(renderer.uploads.previewRefFits),active(meshes[1]),'weapon pose uses the installed fitting geometry');}

test('the new-weapon miniature carries trapezoid shape, support size, height and heading to the real meshes',()=>{
 const t=setup(),before=t.C.publicJSON(t.run('ship')),renderer=snapshot(t);compareMeshes(renderer,expected(t));assert.equal(t.C.publicJSON(t.run('ship')),before,'preview does not place or mutate a fitting');
});

test('actual weapon mounting modes produce finite fitting frames with vector tilt data',()=>{
 const t=setup(),normal=t.C.norm([.2,.95,.1]);
 for(const mode of ['auto','top','bottom','trench']){
  t.run('st.weaponMount='+JSON.stringify(mode));const draft=t.run('designUIFitDraft({p:[1,2,3],n:'+JSON.stringify(Array.from(normal))+'})');
  assert.notEqual(typeof draft.tilt,'boolean','the fitting tilt is geometry, not the mounting-option flag');
  if(mode==='auto')assert.deepEqual(Array.from(draft.tilt),Array.from(normal),'automatic placement retains the selected face normal');
  const frame=t.C.fitFrameOf(draft);for(const vector of Object.values(frame))if(Array.isArray(vector))assert.ok(vector.every(Number.isFinite),mode+' has a finite fitting frame');
  const mesh=t.G.meshPreview(t.run('ship'),[],[draft]);for(const key of ['previewFits','previewRefFits'])assert.ok(active(mesh[key]).every(Number.isFinite),mode+' has finite weapon and support geometry');
 }
 t.run("st.weaponMount='auto'");const nearAxis=t.run('designUIFitDraft({p:[0,0,0],n:C.norm([.001,1,0])})');assert.equal(nearAxis.tilt,null,'near-axis surfaces retain the existing four-degree snap rule');
});

test('changing round/trapezoid and support size updates the miniature rather than retaining defaults',()=>{
 const t=setup(),first=active(snapshot(t).uploads.previewFits);t.run("st.pedShape='round';st.pedSize=.6");const round=snapshot(t);compareMeshes(round,expected(t,{pedShape:'round',pedSize:.6}));assert.notDeepEqual(active(round.uploads.previewFits),first,'support controls change actual uploaded vertices');
 t.run("st.pedShape='trap';st.pedSize=2.5;st.ped=21");const large=snapshot(t);compareMeshes(large,expected(t,{pedShape:'trap',pedSize:2.5,ped:21}));assert.ok(Math.max(...active(large.uploads.previewFits).filter((_,i)=>i%3===0))>Math.max(...first.filter((_,i)=>i%3===0)),'larger support occupies a larger world-space footprint');
});

test('changing only support size with the same trapezoid and height updates actual miniature vertices',()=>{
 const t=setup();t.run("st.pedShape='trap';st.pedSize=.6;st.ped=8");const before=active(snapshot(t).uploads.previewFits);t.run('st.pedSize=2.5');const after=snapshot(t);compareMeshes(after,expected(t,{pedSize:2.5}));assert.notDeepEqual(active(after.uploads.previewFits),before,'size alone changes the rendered support');
});

test('native slider input updates state before the deferred preview frame, including a size-only input',()=>{
 const t=setup({deferredFrames:true});
 // Run both actual listeners in start() registration order, including the
 // slider's state update and its final deferred preview scheduling.
 t.run(listener("$('#panel').addEventListener('input',e=>{if('designSearch'in e.target.dataset)"));
 t.run(listener("$('#panel').addEventListener('input', e => {if(blockedHullControl(e.target))return;"));
 t.run("st.pedShape='trap';st.pedSize=.6;st.ped=8;designUISchedulePreview();flushFrames()");const before=active(t.run('designUI.preview.uploads.previewFits'));
 t.run("for(const handler of panelHandlers)handler({target:{dataset:{sl:'pedsize'},value:'250',min:'40',max:'250',type:'number'}});flushFrames()");
 assert.equal(t.run('st.pedSize'),2.5);assert.equal(t.run("outputs.get('#out-pedsize').textContent"),'250%');const after=t.run('designUI.preview');compareMeshes(after,expected(t,{pedSize:2.5}));assert.notDeepEqual(active(after.uploads.previewFits),before,'the final native-input frame displays the changed size');
});

test('an edited weapon retains its explicit support and later support edits invalidate miniature geometry',()=>{
 const t=setup();t.run("st.tab='edit';st.sel={list:'fits',id:7};selected={id:7,k:'utl',p:[80,30,-12],n:[0,1,0],a:2,ped:13,base:0,low:0,pedShape:'trap',pedSize:2,assetYaw:31}");let r=snapshot(t),f=t.run('selected'),ship=t.run('ship');compareMeshes(r,[t.G.meshFits(ship,null,null,[f]),t.G.meshReferenceFits(ship,null,[f])]);const before=active(r.uploads.previewFits);t.run("selected.pedShape='round';selected.pedSize=.7;selected.ped=4");r=snapshot(t);f=t.run('selected');compareMeshes(r,[t.G.meshFits(ship,null,null,[f]),t.G.meshReferenceFits(ship,null,[f])]);assert.notDeepEqual(active(r.uploads.previewFits),before);
});

test('copying loads the support controls and subsequent explicit changes override the copied template',()=>{
 const t=setup();t.run("st.tab='edit';st.sel={list:'fits',id:7};selected={id:7,k:'utl',p:[80,30,-12],n:[0,1,0],a:2,ped:8,pedShape:'round',pedSize:.8,assetYaw:49,chargeSalvos:3,chargeScale:1.15};carryToPlace();st.tab='mod'");
 assert.equal(t.run('st.pedShape'),'round');assert.equal(t.run('st.pedSize'),.8);assert.equal(t.run('st.gunYaw'),49);
 compareMeshes(snapshot(t),expected(t,{pedShape:'round',pedSize:.8,assetYaw:49,tilt:undefined,mountMode:'top'}));
 t.run("st.pedShape='trap';st.pedSize=2.4;st.ped=15");compareMeshes(snapshot(t),expected(t,{pedShape:'trap',pedSize:2.4,ped:15,assetYaw:49,tilt:undefined,mountMode:'top'}));
 let draft=t.run('designUIFitDraft({p:[0,0,0],n:[0,1,0]})');assert.equal(draft.pedShape,'trap');assert.equal(draft.pedSize,2.4);assert.equal(draft.chargeSalvos,3);assert.equal(draft.chargeScale,1.15,'unrelated copied settings are preserved');
 t.run("st.pedShape='round';st.pedSize=1");compareMeshes(snapshot(t),expected(t,{pedShape:undefined,pedSize:undefined,assetYaw:49,ped:15,tilt:undefined,mountMode:'top'}));
 draft=t.run('designUIFitDraft({p:[0,0,0],n:[0,1,0]})');assert.equal(Object.hasOwn(draft,'pedShape'),false);assert.equal(Object.hasOwn(draft,'pedSize'),false,'returning controls to their defaults removes old template overrides');
});

test('the preview camera includes the actual large manual support, including geometry outside the weapon body bounds',()=>{
 const t=setup();t.run('st.pedSize=2.5;st.ped=40');const renderer=snapshot(t),all=Object.values(renderer.uploads).filter(g=>g.n>0),points=all.flatMap(active),bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];for(let i=0;i<points.length;i++){const a=i%3;bounds[a]=Math.min(bounds[a],points[i]);bounds[a+3]=Math.max(bounds[a+3],points[i]);}const center=[0,1,2].map(i=>(bounds[i]+bounds[i+3])/2),size=Math.max(1,...[0,1,2].map(i=>bounds[i+3]-bounds[i]));for(let i=0;i<3;i++)assert.ok(Math.abs(renderer.off[i]+center[i])<1e-5,'camera centers the complete actual geometry');assert.ok(Math.abs(renderer.cam.r-size*2.8)<1e-5,'camera fits the complete support extent');
});
