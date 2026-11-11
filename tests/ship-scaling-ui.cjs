// v24 Whole-design scaling in the editor (docs/ship-scaling-v24.md): the Worker computes the scaled design, the editor
// adopts it as one undoable edit, and a design that changed meanwhile is never overwritten.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(__dirname,'..'),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),plain=v=>JSON.parse(JSON.stringify(v));
function fn(name){const start=new RegExp('function '+name+'\\s*\\(').exec(app);assert.ok(start,name);for(let end=app.indexOf('}',start.index);end>=0;end=app.indexOf('}',end+1)){const s=app.slice(start.index,end+1);try{new vm.Script(s);return s;}catch{}}assert.fail(name);}
function setup(){
 const ctx=vm.createContext({console,performance,structuredClone});const run=s=>vm.runInContext(s,ctx);
 for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])run(fs.readFileSync(path.join(root,file),'utf8'));
 run(`const C=Core;let ship=C.newShip({L:400,W:120,H:60,sec:'warship',plan:'wedge'},'Scale UI fixture');const hull=C.ensurePrimaryHull(ship,{newDesign:true});
 {const top=C.rayPart([150,500,0],[0,-1,0],hull),r=C.commitPlacement(ship,{id:-1,k:'struct',form:'box',c:[0,0,0],s:[40,30,20]},{mode:'horizontal',parentStructureId:hull.id,hit:top,contactFit:'cut',position:[150,top.p[1]+10,0]});if(!r.ok)throw Error(r.error);
  C.commitPlacement(ship,{id:-1,k:'cargo',c:[120,25,0],room:[30,10,10],d:Math.cbrt(3000)},{mode:'clip',hostId:hull.id});const side=C.rayPart([200,30,300],[0,0,-1],hull);C.placeFit(ship,'pd',side.p,side.n,0,true);}
 ship=C.deserialize(JSON.parse(JSON.stringify(C.serialize(ship))));ship.saveId='scale-ui';ship._client=true;
 const st={sel:null,multi:{parts:new Set(),fits:new Set()}},eng={gen:7,reset:false,statsGen:0},touches=[],undoStack=[],redoStack=[],requests=[],notices=[],nodes=new Map();let renders=0,lastOp='',dragSnap=null,S=null,prevS=null,view=null,busy=0,editSession=null;
 const $=sel=>{if(!nodes.has(sel))nodes.set(sel,{disabled:false});return nodes.get(sel);},T=x=>x,esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),fLen=m=>(Math.round(m*1000)/1000)+' m';
 const renderPanel=()=>renders++,requestDraw=()=>{},toast=s=>notices.push(s),sndUI=()=>{},sndEdit=()=>{},touch=w=>{touches.push(w);eng.gen++;},scheduleStats=()=>{},autosave=()=>{},refitOnGeometry=()=>{},showBusyOverlay=()=>busy++,hideBusyOverlay=()=>busy--,designUIEditSession=()=>editSession,reconcileSolidCutter=()=>{},previewHistory=()=>{},hideInspect=()=>{},updateName=()=>{},designUISavedDesign=()=>C.serialize(ship),actualShipDimensions=()=>[400,120,80];
 const YardEngineClient={request:(type,payload)=>new Promise((resolve,reject)=>requests.push({type,payload,resolve,reject}))};
 // The Worker's 'op' job: the same public state, Core.scaleShipDesign, then the public result state.
 function work(i=0){const q=requests[i],state=JSON.parse(q.payload.state),result=C.scaleShipDesign(state,...q.payload.args);return {type:'op',result:JSON.parse(JSON.stringify(result)),state:C.publicJSON(state)};}
 `);
 run(app.match(/const shipScaleUI=\{[^\n]+;/)[0]);run(app.match(/const shipScaleWarnKey=[^\n]+;/)[0]);run(app.match(/const SHIP_SCALE_CHOICES=[^\n]+;/)[0]);
 for(const name of ['seg','shipScaleSync','shipScaleReset','shipScaleResync','shipScaleNewWarnings','shipScaleRequest','shipScalePanelHTML','renderShipScaleSheet','shipScaleRefresh','shipScaleSubmit','mutate','snap','newSaveId','restore','findSel','undo','redo','updateUndo'])run(fn(name));
 run('shipScaleSync()');// the card was shown for this design before any input
 return {run};
}
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};

test('the panel previews the scaled hull, the planned size and the two per-category choices',()=>{
 const {run:r}=setup();r('shipScaleUI.length=600');let html=r('shipScalePanelHTML()');
 assert.match(html,/艦全体の拡大縮小/);assert.match(html,/400 m × 120 m × 60 m → 600 m × 180 m × 90 m/);assert.match(html,/600 m × 180 m × 120 m/,'overall estimate');assert.match(html,/value="1\.5"/);
 assert.match(html,/data-ship-scale-structures="scale" aria-pressed="true"/);assert.match(html,/data-ship-scale-interior="keep" aria-pressed="false"/);assert.doesNotMatch(html,/data-ship-scale-apply disabled/);
 r('shipScaleUI.structures="keep"');html=r('shipScalePanelHTML()');assert.match(html,/data-ship-scale-structures="keep" aria-pressed="true"/);
 r('shipScaleUI.length=40000');html=r('shipScalePanelHTML()');assert.match(html,/data-ship-scale-error/);assert.match(html,/data-ship-scale-apply disabled/);
 r('shipScaleUI.length=null');assert.match(r('shipScalePanelHTML()'),/data-ship-scale-apply disabled/,'an unchanged size has nothing to apply');
});

test('applying adopts the Worker result as one edit, and Undo and Redo restore both designs exactly',async()=>{
 const {run:r}=setup();r('shipScaleUI.length=600;shipScaleUI.interior="keep";var before=C.publicJSON(ship);shipScaleSubmit()');
 assert.equal(r('requests.length'),1);assert.equal(r('requests[0].type'),'op');assert.equal(r('requests[0].payload.op'),'scaleShip');assert.deepEqual(plain(r('requests[0].payload.args')),[{length:600,structures:'scale',interior:'keep'}]);
 assert.equal(r('C.publicJSON(ship)===before'),true,'nothing changes before the Worker answers');assert.equal(r('undoStack.length'),0);assert.equal(r('shipScaleUI.pending!=null'),true);
 r('var packet=work();requests[0].resolve(packet)');await flush();
 assert.equal(r('packet.result.ok'),true,r('JSON.stringify(packet.result.unseated)'));assert.equal(r('undoStack.length'),1);assert.equal(r('lastOp'),'艦全体の拡大縮小');assert.equal(r('shipScaleUI.pending'),null);assert.equal(r('busy'),0);
 assert.equal(r('C.primaryHullPart(ship).s[0]'),600);assert.equal(r('ship.hull.L'),600);assert.equal(r('ship.saveId'),'scale-ui');assert.equal(r('ship._client'),true);
 assert.deepEqual(plain(r('ship.parts.find(p=>p.k==="cargo").room')),[30,10,10],'interior kept its size');assert.equal(r('ship.parts.find(p=>p.k==="struct"&&!C.isHullStructure(p)).s[0]'),60,'structure scaled');
 assert.ok(r('shipScaleUI.report.changed'));assert.match(r('$("#shipScaleSheet").innerHTML'),/data-ship-scale-report/,'the design sheet shows the same card and report');assert.match(r('shipScalePanelHTML()'),/すべての部品と装備を変換後の位置に付け直しました/);
 const scaledState=r('C.publicJSON(ship)');
 r('undo()');assert.equal(r('C.publicJSON(ship)'),r('before'),'Undo restores the original');assert.equal(r('C.primaryHullPart(ship).s[0]'),400);assert.equal(r('redoStack.length'),1);
 // History restores through the ordinary loader, which leaves a fitting's derived mount flag (float:false) to the next mount.
 r('redo()');const bare=t=>JSON.stringify(JSON.parse(t),(k,v)=>k==='float'&&v===false?undefined:v);assert.equal(bare(r('C.publicJSON(ship)')),bare(scaledState),'Redo restores the scaled design');assert.equal(r('undoStack.length'),1);
});

test('a design changed while the Worker computed is not overwritten, and limits refuse before any request',async()=>{
 const {run:r}=setup();r('shipScaleUI.length=800;var before=C.publicJSON(ship);shipScaleSubmit();ship.name="edited meanwhile";eng.gen++;requests[0].resolve(work())');await flush();
 assert.equal(r('undoStack.length'),0);assert.equal(r('C.primaryHullPart(ship).s[0]'),400);assert.match(r('shipScaleUI.error'),/設計が変更されました/);assert.equal(r('shipScaleUI.pending'),null);
 r('shipScaleUI.error="";shipScaleUI.length=40000;shipScaleSubmit()');assert.equal(r('requests.length'),1,'no request past the limits');assert.match(r('shipScaleUI.error'),/上限/);
 r('shipScaleUI.error="";shipScaleUI.length=400');assert.equal(r('shipScaleSubmit()'),false);assert.equal(r('requests.length'),1);
 r('shipScaleUI.length=800;shipScaleSubmit();requests[1].reject(new Error("engine restarted"))');await flush();assert.equal(r('shipScaleUI.error'),'engine restarted');assert.equal(r('undoStack.length'),0);assert.equal(r('busy'),0);
});

test('the Worker op is wired and the new interface text has English entries',()=>{
 const engine=fs.readFileSync(path.join(root,'js/engine.js'),'utf8');assert.match(engine,/case 'scaleShip': try \{ result = C\.scaleShipDesign\(ship, job\.args\?\.\[0\] \|\| \{\}\);/);
 assert.match(app,/bindShipScale\(\);/);assert.match(app,/function openSheet\(\) \{[^\n]*renderShipScaleSheet\(\); \}/);assert.match(fs.readFileSync(path.join(root,'index.html'),'utf8'),/<section id="shipScaleSheet" data-ship-scale-sheet/);assert.match(app,/shipScalePanelHTML\(\)\);\n  if\(st\.tab==='hull'\)panel\.insertAdjacentHTML\('afterbegin',hullDimsHTML\(\)\);/);
 const locale={};vm.runInNewContext(fs.readFileSync(path.join(root,'js/lang-en.js'),'utf8'),locale);const {terms,messages}=locale.KS_EN;
 for(const key of ['艦全体の拡大縮小','目標の船体長 (m)','倍率','構造物（船体以外）','内部設備','船体と一緒に拡大縮小','大きさを保つ','拡大縮小を適用','拡大縮小を計算中…','艦全体を拡大縮小中…','船体 長さ×幅×高さ','全長×全幅×全高（概算）','大きさを保つ装備','すべての部品と装備を変換後の位置に付け直しました。','設計が変更されました。もう一度適用してください。','船体構造物がない設計は拡大縮小できません','目標の船体長か倍率を正の値で指定してください','大きさは変わりません','拡大縮小後に新しく出た警告','拡大縮小後に新しく出た警告はありません。','全長×全幅×全高（すべて拡大した場合の概算。大きさを保つ部品の分だけ小さくなります）'])assert.ok(terms[key]||messages[key],key);
 for(const key of ['トレンチの寸法が保存できる範囲（高さ 0.1〜500 m・深さ 0.1〜800 m）を外れます{0}','縁の面取りの寸法が保存できる範囲（幅 0〜1000 m・高さ 1〜1000 m）を外れます{0}','外殻の板厚が保存できる範囲（0.02〜60 m）を外れます{0}'])assert.ok(messages[key],key);
 for(const key of ['付け直せなかった部品 {0} 個・装備 {1} 基','拡大縮小しました。付け直せなかった部品・装備が {0} 個あります','艦全体を {0} に拡大縮小しました'])assert.ok(messages[key],key);
});

// Regression review (2026-11-11) follow-ups.
test('a result that is not adopted makes the next update resend the whole design to the Worker',async()=>{
 for(const how of ['changed','failed','rejected','editing']){const {run:r}=setup();r('shipScaleUI.length=600;shipScaleSubmit()');
  if(how==='changed')r('ship.name="edited meanwhile";eng.gen++;requests[0].resolve(work())');
  if(how==='failed')r('requests[0].resolve({type:"op",result:{ok:false,changed:false,error:"failed in the Worker"},state:C.publicJSON(ship)})');
  if(how==='rejected')r('requests[0].reject(new Error("engine restarted"))');
  if(how==='editing')r('editSession={undo:[]};requests[0].resolve(work())');
  await flush();assert.equal(r('undoStack.length'),0,how);assert.equal(r('C.primaryHullPart(ship).s[0]'),400,how);assert.equal(r('eng.reset'),true,how+': full resend');assert.ok(r('touches.includes("all")'),how);
  if(how==='editing')assert.match(r('shipScaleUI.error'),/編集画面/);}
});
test('another design starts with a fresh card, and the overall estimate says when kept parts make it smaller',()=>{
 const {run:r}=setup();r('shipScaleUI.length=600;shipScaleUI.error="x";shipScaleUI.report={changed:true,unseated:{parts:[],fits:[]}};shipScaleUI.structures="keep";shipScalePanelHTML();ship.saveId="another";shipScalePanelHTML()');
 assert.equal(r('shipScaleUI.length'),null);assert.equal(r('shipScaleUI.report'),null);assert.equal(r('shipScaleUI.error'),'');assert.equal(r('shipScaleUI.structures'),'keep','the choice is kept');
 r('shipScaleUI.length=600');assert.match(r('shipScalePanelHTML()'),/すべて拡大した場合の概算/);r('shipScaleUI.structures="scale"');assert.doesNotMatch(r('shipScalePanelHTML()'),/すべて拡大した場合の概算/);
});
test('warnings that appear only after the change are listed once the statistics of the scaled design arrive',async()=>{
 const {run:r}=setup();r('S={warnings:[{lv:"info",text:"兵装の充電速度は機械的な最大連射の 29%。"}]};shipScaleUI.length=600;shipScaleSubmit();requests[0].resolve(work())');await flush();
 assert.doesNotMatch(r('shipScalePanelHTML()'),/data-ship-scale-warnings/,'not before the new statistics');
 r('S={warnings:[{lv:"info",text:"兵装の充電速度は機械的な最大連射の 81%。"},{lv:"warn",text:"慣性制御装置の対応質量が不足しています。"}]};eng.statsGen=eng.gen');
 const html=r('shipScalePanelHTML()');assert.match(html,/拡大縮小後に新しく出た警告/);assert.match(html,/慣性制御装置の対応質量が不足/);assert.doesNotMatch(html,/81%/,'a changed figure is not a new warning');
});
