const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),cx=vm.createContext({console,navigator:{language:'en-US'}}),jp=/[\u3040-\u30ff\u3400-\u9fff]/;
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/lang-en.js','js/i18n.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const run=code=>vm.runInContext(code,cx);
function translated(source){const out=cx.KSI18n.t(source);assert.doesNotMatch(out,jp,source+' => '+out);return out;}
function translatedHTML(html){for(const text of html.split(/<[^>]*>/))if(text.trim())translated(text);for(const m of html.matchAll(/(?:aria-label|title|placeholder)="([^"]*)"/g))translated(m[1]);}
run(`const C=Core,st={surfaceIds:[],surfaceDraft:{},surfaceFilter:'all',surfacePage:0,tab:'surface'},view={},fleet={mode:'design'},esc=String,num=(v,d)=>d==null?String(v):Number(v).toFixed(d),fMass=v=>String(v)+' t',fW=v=>String(v)+' W';
 let ship=null,S=null;const renderPanel=()=>{},requestDraw=()=>{},toast=()=>{},mutate=(name,fn)=>{fn();return true;};
 function fixture(mode='armor',allocation={cooling:34,sensors:33,habitation:33}){
  ship=C.newShip({L:200,W:100,H:80,plan:'rect',sec:'rect'},'English allocation fixture');ship.hull.assembly=true;
  ship.parts=[{id:1,k:'struct',form:'box',c:[80,50,60],s:[80,60,40],taper:0}];ship.fits=[];ship.nextId=2;
  C.enableSurfaceMode(ship,true);const p=C.surfacePatches(ship).find(p=>p.host==='p1'&&p.face==='port');
  const result=C.setSurfaceConfig(ship,p.id,{functionMode:mode,allocation,battery:{weapon:'claser',count:2,spacing:1},equipment:{kind:'hdis',depth:2},armor:{material:'dense',thickness:.3}});if(!result.ok)throw Error(result.why);
  st.surfaceIds=[p.id];st.surfaceDraft={};st.surfaceFilter='all';st.surfacePage=0;S=null;return p;
 }
`);
const begin=app.indexOf('// ---------- surface patch editing ----------'),end=app.indexOf('// ---------- multiple selection, copy and paste ----------',begin);assert.ok(begin>=0&&end>begin);run(app.slice(begin,end));

test('the real armor editor translates the exclusive function choices and physical armor controls',()=>{
 run('fixture()');const before=run('JSON.stringify(C.serialize(ship))'),html=run('surfaceEditorHTML()');translatedHTML(html);
 assert.match(html,/data-surface-field="functionMode"/);assert.match(html,/value="armor"/);assert.match(html,/value="equipment"/);
 assert.match(html,/data-surface-field="armor\.thickness"/);assert.doesNotMatch(html,/data-surface-field="allocation\.|data-surface-field="equipment\.count"|data-surface-field="battery\.count"/);
 assert.equal(translated('装甲面'),'Armor Surface');assert.equal(translated('機材構造面'),'Machinery Structure Surface');assert.equal(run('JSON.stringify(C.serialize(ship))'),before,'English rendering must preserve the blueprint');
});

test('the real equipment editor translates three linked shares, separate gun counts and whole-face resource reports',()=>{
 run("fixture('equipment')");const before=run('JSON.stringify(C.serialize(ship))'),html=run('surfaceEditorHTML()');translatedHTML(html);
 assert.match(html,/data-surface-allocation-total>100%/);assert.match(html,/data-surface-allocation-report/);
 for(const role of ['cooling','sensors','habitation']){assert.match(html,new RegExp('data-surface-field="allocation\\.'+role+'"'));assert.match(html,new RegExp('data-surface-category="'+role+'"'));}
 assert.match(html,/data-surface-field="battery\.count"/);assert.doesNotMatch(html,/data-surface-field="armor\.thickness"|data-surface-field="equipment\.count"|data-surface-field="allocation\.weapons"/);
 const devices=run('C.surfaceWorkingShip(ship).parts.filter(q=>q.surfacePatch&&q.surfacePatch===st.surfaceIds[0]).map(q=>({k:q.k,label:q.label,name:C.PARTS[q.k].name,desc:C.PARTS[q.k].desc}))');
 assert.ok(devices.some(q=>q.k==='sensor'));assert.ok(devices.some(q=>q.k==='habitat'));assert.ok(devices.some(q=>q.k==='hdis'));
 for(const device of devices){translated(device.label);translated(device.name);translated(device.desc);}assert.equal(run('ship.parts.filter(p=>p.surfacePatch).length'),0);assert.match(html,/data-surface-representation="face"/);assert.doesNotMatch(html,/設備の設置数／要求数/);
 const report=run('C.surfaceReport(ship).patches.find(p=>p.id===st.surfaceIds[0])');for(const role of ['cooling','sensors','habitation'])assert.ok(report.categories[role].installed>0,role);assert.equal(report.requested,2);assert.ok(report.installed>0);
 assert.equal(translated('居住容積／居住定員'),'Habitable Volume / Capacity');assert.equal(run('JSON.stringify(C.serialize(ship))'),before,'category reports and translation are read-only');
});

test('pending linked allocation edits translate while retaining the uncommitted design',()=>{
 run("fixture('equipment');st.surfaceDraft={'allocation.cooling':70}");const before=run('JSON.stringify(C.serialize(ship))'),html=run('surfaceEditorHTML()');translatedHTML(html);
 const preview=run('surfaceDraftConfig(C.surfaceConfig(ship,st.surfaceIds[0])).allocation');assert.equal(preview.cooling,70);assert.equal(preview.sensors,15);assert.equal(preview.habitation,15);assert.equal(run('C.surfaceConfig(ship,st.surfaceIds[0]).battery.count'),2);
 assert.match(html,/data-surface-allocation-total>100%/);assert.match(html,/未適用の変更があります/);assert.equal(run('JSON.stringify(C.serialize(ship))'),before);
});

test('mixed equipment shares and mixed face functions keep their distinct English editing states',()=>{
 run(`fixture('equipment');const other=C.surfacePatches(ship).find(p=>p.host==='p1'&&p.face==='stbd');C.setSurfaceConfig(ship,other.id,{functionMode:'equipment',allocation:{cooling:20,sensors:30,habitation:50}});st.surfaceIds.push(other.id);`);
 const mixed=run('surfaceEditorHTML()');translatedHTML(mixed);assert.match(mixed,/複数の値/);assert.match(mixed,/data-surface-allocation-total>100%/);
 run("C.setSurfaceConfig(ship,st.surfaceIds[1],{functionMode:'armor'})");const different=run('surfaceEditorHTML()');translatedHTML(different);assert.match(different,/選択した面の用途が異なります/);assert.doesNotMatch(different,/data-surface-allocation-row=/);
});

test('legacy migration and usable-area capacity diagnostics remain explicit in the English editor',()=>{
 run(`fixture('legacy');C.setSurfaceConfig(ship,st.surfaceIds[0],{battery:{weapon:'claser',count:2,spacing:1},equipment:{kind:'hdis',count:1,depth:2}})`);
 const before=run('JSON.stringify(C.serialize(ship))'),legacy=run('surfaceEditorHTML()');translatedHTML(legacy);
 for(const action of ['convert-armor','convert-equipment'])assert.match(legacy,new RegExp('data-surface-action="'+action+'"'));
 assert.match(legacy,/data-surface-legacy-warning/);assert.match(legacy,/data-surface-legacy/);assert.match(legacy,/data-surface-field="battery\.count"/);assert.equal(run('JSON.stringify(C.serialize(ship))'),before);
 run(`fixture('equipment');ship.parts[0].s=[500,500,100];const p=C.surfacePatches(ship).find(p=>p.host==='p1'&&p.face==='port');C.setSurfaceConfig(ship,p.id,{functionMode:'equipment',allocation:{cooling:100,sensors:0,habitation:0},equipment:{kind:'hdis',depth:2}});st.surfaceIds=[p.id]`);
 const area=run('C.surfaceReport(ship).patches.find(p=>p.id===st.surfaceIds[0])'),warnings=run('C.surfaceReport(ship).warnings');assert.equal(area.config.equipment.capacityModel,'area-v1');assert.ok(area.volume>256*64*2,'a new area-based face must not stop at the former256device limit');assert.ok(warnings.some(w=>w.text==='兵装・既存機材・他の面の占有範囲を保守的に予約しています'));assert.ok(!warnings.some(w=>w.text==='1面の装置数上限により割当の一部が未配置です'));
 for(const warning of warnings)translated(warning.text);translatedHTML(run('surfaceEditorHTML()'));
});

test('real native and cross-face volume conflicts and curved-envelope fit diagnostics translate in the editor',()=>{
 run(`fixture('equipment',{cooling:100,sensors:0,habitation:0});const nativeConflictFace=C.surfacePatches(ship).find(p=>p.id===st.surfaceIds[0]),nativeConflictCell=C.surfaceConfig(ship,nativeConflictFace.id).aggregate.cells.find(r=>!r[3]),nativeConflictVolume=C.surfaceReport(ship).patches.find(p=>p.id===nativeConflictFace.id).volume;ship.parts.push({id:ship.nextId++,k:'command',d:2,room:[2,2,2],c:C.add(nativeConflictCell.slice(4,7),C.mul(nativeConflictFace.u,4.5))});C.surfaceSync(ship)`);
 const native=run('C.surfaceReport(ship).warnings');assert.ok(run('C.surfaceReport(ship).patches.find(p=>p.id===nativeConflictFace.id).volume<nativeConflictVolume'),'the new native room removes usable equipment volume');assert.ok(native.some(w=>w.text==='兵装・既存機材・他の面の占有範囲を保守的に予約しています'));for(const warning of native)translated(warning.text);translatedHTML(run('surfaceEditorHTML()'));
 run(`fixture();ship.parts[0].s=[40,40,4];delete ship.surfaces;C.enableSurfaceMode(ship,true);const faces=C.surfacePatches(ship).filter(p=>p.host==='p1'&&['top','bottom'].includes(p.face));for(const p of faces)C.setSurfaceConfig(ship,p.id,{functionMode:'equipment',allocation:{cooling:100,sensors:0,habitation:0},equipment:{kind:'hdis',depth:3}});st.surfaceIds=faces.map(p=>p.id)`);
 const conflict=run('C.surfaceReport(ship).warnings'),volumes=run('C.surfaceReport(ship).patches.filter(p=>st.surfaceIds.includes(p.id)).map(p=>p.volume)');assert.ok(volumes.some(v=>v>0)&&volumes.some(v=>v===0),'the intersecting opposite face cannot receive a second free equipment slab');assert.ok(conflict.some(w=>w.text==='兵装・既存機材・他の面の占有範囲を保守的に予約しています'));for(const warning of conflict)translated(warning.text);translatedHTML(run('surfaceEditorHTML()'));
 run(`fixture();ship.parts=[{id:1,k:'wing',c:[100,120,0],s:[64,40,6],form:'airfoil',wing:{thermal:'high',foil:true}}];ship.fits=[];delete ship.surfaces;C.enableSurfaceMode(ship,true);const curvedPanel=C.surfacePatches(ship).find(p=>p.host==='p1'&&p.face==='top');C.setSurfaceConfig(ship,curvedPanel.id,{functionMode:'equipment',allocation:{cooling:34,sensors:33,habitation:33},equipment:{kind:'hdis',depth:1}});st.surfaceIds=[curvedPanel.id]`);
 const curved=run('C.surfaceReport(ship).warnings'),curvedRow=run('C.surfaceReport(ship).patches.find(p=>p.id===curvedPanel.id)');assert.ok(curvedRow.volume>0&&curvedRow.volume<curvedRow.exposedArea*curvedRow.config.equipment.depth,'the curved face uses only its actually reserved volume');assert.ok(curved.some(w=>w.text==='形状が複雑なため一部の面積を確保できません。面を分割すると利用範囲を増やせます'));for(const warning of curved)translated(warning.text);translatedHTML(run('surfaceEditorHTML()'));
});
