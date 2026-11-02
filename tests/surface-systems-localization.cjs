const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),cx=vm.createContext({console,navigator:{language:'en-US'}}),jp=/[\u3040-\u30ff\u3400-\u9fff]/;
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/lang-en.js','js/i18n.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const run=code=>vm.runInContext(code,cx);
function translated(source){const out=cx.KSI18n.t(source);assert.doesNotMatch(out,jp,source+' => '+out);return out;}
function translatedHTML(html){for(const text of html.split(/<[^>]*>/))if(text.trim())translated(text);for(const m of html.matchAll(/(?:aria-label|title|placeholder)="([^"]*)"/g))translated(m[1]);}
run(`const C=Core,st={surfaceIds:[],surfaceDraft:{},surfaceFilter:'all',surfacePage:0,tab:'surface'},view={},fleet={mode:'design'},esc=String,num=(v,d)=>d==null?String(v):Number(v).toFixed(d),fMass=v=>String(v)+' t',fW=v=>String(v)+' W';
 let ship=null,S=null;const renderPanel=()=>{},requestDraw=()=>{},toast=()=>{},mutate=(name,fn)=>{fn();return true;};
 function fixture(){ship=C.newShip({L:120,W:60,H:24,plan:'rect',sec:'rect'},'Surface QA');delete ship.surfaces;ship.parts=[];ship.fits=[];st.surfaceIds=[];st.surfaceDraft={};st.surfaceFilter='all';S=null;return C.surfacePatches(ship).filter(p=>p.exposed);}
`);
const a=app.indexOf('// ---------- surface patch editing ----------'),b=app.indexOf('// ---------- multiple selection, copy and paste ----------',a);assert.ok(a>=0&&b>a);run(app.slice(a,b));
const hudA=app.indexOf('function statusFlagsHTML('),hudB=app.indexOf('function trialSelfUpdate(',hudA);assert.ok(hudA>=0&&hudB>hudA);run(app.slice(hudA,hudB));

test('the actual surface editor translates selection and explicit compatibility choices',()=>{
 const tab=app.match(/\['surface',\s*'([^']+)'\]/);assert.ok(tab,'the public Surface tab is present');assert.equal(translated(tab[1]),'Surface');
 run('fixture()');const html=run('surfaceEditorHTML()');translatedHTML(html);
 assert.match(html,/data-surface-action="strict"/);assert.match(html,/data-surface-action="compat"/);assert.match(html,/data-surface-pick=/);
 assert.equal(translated('設備を必要とする設計'),'Explicit Equipment Requirements');assert.equal(translated('旧設計の互換運転'),'Legacy Compatibility Mode');
 assert.match(translated('外面を選ぶ · 0 面選択'),/0 Selected/);
 run('C.enableSurfaceMode(ship,true);ship.surfaces.compatAllowed=false');const strict=run('surfaceEditorHTML()');assert.match(strict,/data-surface-action="compat" disabled/);translatedHTML(strict);
});

test('actual installed surface equipment and battery reports render translated controls and counts',()=>{
 run(`fixture();ship.parts.push({id:ship.nextId++,k:'gen',c:[60,12,0],d:8});const top=C.surfacePatches(ship).find(p=>p.exposed&&p.face==='top');C.setSurfaceConfig(ship,top.id,{armor:{material:'dense',thickness:.3},equipment:{kind:'hdis',count:1,depth:.2},battery:{weapon:'claser',count:2,spacing:1}});st.surfaceIds=[top.id];S=C.computeStats(ship);`);
 const report=run('C.surfaceReport(ship)'),selected=report.patches.find(p=>p.id===run('st.surfaceIds[0]'));assert.ok(selected.installed>0);assert.ok(selected.installedEquipment>0);
 const before=run('JSON.stringify(C.serialize(ship))'),html=run('surfaceEditorHTML()');translatedHTML(html);
 for(const field of ['armor.material','armor.thickness','equipment.kind','equipment.count','equipment.depth','battery.weapon','battery.count','battery.spacing','battery.angle','style.kind','style.depth','style.density','style.seed'])assert.match(html,new RegExp('data-surface-field="'+field.replace('.','\\.')+'"'));
 assert.match(html,/data-surface-report/);assert.match(html,new RegExp(selected.installed+' / '+selected.requested+' 基'));assert.match(html,/砲身総数/);assert.equal(translated('砲身総数'),'Total Barrels');
 const measured=run('S.surface.patches.find(p=>p.id===st.surfaceIds[0])');for(const key of ['maximumTT','sustainedTT','chargeRequested','chargeSupplied','heatGenerated','heatExported','maxEnergy'])assert.ok(Number.isFinite(measured[key]),key);assert.ok(measured.maximumTT>0);
 for(const label of ['稼働可能な砲座','給電要求／供給','最大／持続射撃（ゲーム換算）','選択面の発熱／熱輸送','最大蓄電量（ゲーム換算）'])assert.ok(html.includes(label),label);
 assert.ok(html.includes(measured.maximumTT.toFixed(3)+' / '+measured.sustainedTT.toFixed(3)+' TT/s'));assert.ok(html.includes(measured.chargeRequested+' W / '+measured.chargeSupplied+' W'));
 assert.equal(run('JSON.stringify(C.serialize(ship))'),before,'rendering and translating do not rewrite the blueprint');
});

test('multiple surface values and pending changes translate without applying changes to the design',()=>{
 run(`fixture();const ps=C.surfacePatches(ship).filter(p=>p.exposed&&p.face==='top').slice(0,2);C.setSurfaceConfig(ship,ps[0].id,{armor:{material:'light',thickness:.1}});C.setSurfaceConfig(ship,ps[1].id,{armor:{material:'dense',thickness:.4}});st.surfaceIds=ps.map(p=>p.id);st.surfaceDraft={'battery.count':3};`);
 const before=run('JSON.stringify(C.serialize(ship))'),html=run('surfaceEditorHTML()');translatedHTML(html);
 assert.match(html,/2 面に一括設定/);assert.match(html,/複数の値/);assert.match(html,/未適用の変更があります/);assert.equal(run('JSON.stringify(C.serialize(ship))'),before);
 assert.match(translated('2 面に一括設定'),/2 Surfaces/);assert.equal(translated('複数の値'),'Multiple Values');
});

test('orphaned surface settings and actual placement diagnostics remain understandable in English',()=>{
 run(`fixture();const p=C.surfacePatches(ship).find(p=>p.exposed&&p.face==='top');C.setSurfaceConfig(ship,p.id,{battery:{weapon:'claser',count:256,spacing:1000},equipment:{kind:'hdis',count:1,depth:100}});st.surfaceIds=[p.id];`);
 const report=run('C.surfaceReport(ship)');assert.ok(report.warnings.length>0);for(const warning of report.warnings)translated(warning.text);translatedHTML(run('surfaceEditorHTML()'));
 run(`ship.hull.plan='arrow';C.surfaceSync(ship);st.surfaceIds=C.surfacePatches(ship).filter(p=>p.exposed).slice(0,1).map(p=>p.id);`);
 const html=run('surfaceEditorHTML()');assert.match(html,/未配置の面設定/);translatedHTML(html);
 assert.match(translated('形状変更で面が失われました。設備を移設するか設定を解除してください。'),/Relocate/);
});

test('oversized surface-v1 import errors translate explicit rejections instead of hiding truncated records',()=>{
 const errors=run(`(()=>{
  const base=C.serialize(C.newShip({L:100,W:40,H:20,plan:'rect',sec:'rect'},'Import limit'));
  const cases=[
   {patches:Array.from({length:513},(_,i)=>({id:'hull:top:'+i+':abcdef'}))},
   {patches:[],partitions:Array.from({length:513},(_,i)=>({baseId:'hull:top:'+i+':abcdef',leaves:[{id:'hull:top:'+i+':abcdef/r0',range:[0,0,1,1]}]}))},
   {patches:[],partitions:[{baseId:'hull:top:0:abcdef',leaves:Array.from({length:65},(_,i)=>({id:'hull:top:0:abcdef/r'+i.toString(36),range:[i/65,0,(i+1)/65,1]}))}]}
  ];
  return cases.map(surfaces=>{try{C.deserialize({...base,surfaces:{version:1,mode:'compat',...surfaces}});return null;}catch(e){return e.message;}});
 })()`);
 assert.deepEqual(Array.from(errors),['表面パッチは512件までです','表面分割グループは512件までです','1面の表面分割は64件までです']);
 assert.match(translated(errors[0]),/512 surface patch records/);assert.match(translated(errors[1]),/512 surface partition groups/);assert.match(translated(errors[2]),/64 subdivisions/);
});

test('actual power states distinguish a local trip from a shared grid trip and translate recovery events',()=>{
 const states=run(`(()=>{const u={p:{grid:{P:1e24,domains:[{id:'main',P:1e24,modules:[0]}]},modules:[{name:'表面機材',k:'weapon',domain:'main'}]},gridState:{domains:{main:{load:0,trip:0}},local:{0:4}}};return {powered:C.powerStatus(u),tripped:(u.gridState.domains.main.trip=12,C.powerStatus(u))};})()`);
 assert.equal(states.powered.blackout,false);assert.equal(states.powered.local.length,1);assert.equal(states.tripped.blackout,true);
 for(const status of [states.powered,states.tripped]){for(const domain of status.domains)translated(domain.state);for(const local of status.local){translated(local.state);translated(local.name);}}
 for(const text of ['main：共通電力網が過負荷で保護遮断','表面機材：局所イオン遮断','電力網の保護を解除・再起動','イオンパルス：阻止 2 TT・漏出 0.5 TT'])translated(text);
 assert.match(translated(run('C.PARTS.hion.desc')),/Performance coefficients are game assumptions/);
 for(const expression of ['C.FITS.itl.desc','C.ORDNANCE.itorp.desc'])assert.match(translated(run(expression)),/shared-grid protection/);
});

test('the actual battle HUD distinguishes destruction, power cuts, heat, ion trips, recharge, crew and shield accounting',()=>{
 run(`globalThis.runtimeUnit=(()=>{
  const weapons=Array.from({length:7},(_,i)=>({k:'weapon',name:'Gun '+(i+1),domain:'main',powerConnected:i!==3})),modules=[...weapons,{k:'capacitor',name:'Gun 7 Capacitor',link:6,size:1,domain:'main'}],mounts=weapons.map((m,i)=>({id:i+1,module:i,patch:'qa-patch',capacity:2,boltTT:1,barrels:2,crewNeed:2}));
  const patch={id:'qa-patch',face:'port',host:'hull',area:2880,center:[0,0,-30],normal:[0,0,-1],polygon:[[-60,-12,-30],[60,-12,-30],[60,12,-30],[-60,12,-30]],exposed:true,armor:{material:'standard',thickness:1},fitIds:mounts.map(m=>m.id),partIds:[]};
  const p={len:120,width:60,height:24,hp:100,crewNeed:14,autoCrew:0,modules,grid:{P:1e24,domains:[{id:'main',P:1e24,modules:[0,1,2,3,4,5,6,7]}]},heat:{v:1,src:weapons.map((m,i)=>({k:'weapon',m:[i]})),dis:[],links:[]},surface:{patches:[patch],mounts,devices:[]}};
  const u={p,crew:14,mods:[1,0,1,1,1,1,1,0],shield:100,shieldMax:100,energy:10,surfaceArmor:{'qa-patch':{integrity:.5,load:1}},surfaceBanks:{1:2,2:2,3:2,4:2,5:2,6:0,7:0},gridState:{domains:{main:{load:0,trip:0}},local:{2:5}},ht:{n:7,e:{reactor:0,weapon:0,shield:0,engine:0,hotel:0},lim:{weapon:1},md:[0,0,0,0,2,0,0],lm:[1,1,1,1,1,1,1]}};
  C.shieldReceive(u,{energy:10,ion:10});return u;
 })()`);
 const status=run('C.surfaceBatteryStatus(runtimeUnit)'),html=run('surfaceRuntimeHTML(runtimeUnit)'),before=run('JSON.stringify({mods:runtimeUnit.mods,last:runtimeUnit.lastShieldHit})');
 assert.equal(status.totals.installed,7);assert.equal(status.totals.surviving,6);assert.equal(status.totals.operable,2);assert.equal(status.totals.fireable,1);
 for(const cause of ['破壊','蓄電設備破壊','給電停止','過熱','イオン遮断','再充電中'])assert.ok(status.rows[0].causes.includes(cause),cause);
 for(const selector of ['data-battery-totals','data-battery-cell-status','data-power-local','data-shield-budget','data-surface-armor'])assert.match(html,new RegExp(selector));
 translatedHTML(html);translatedHTML(run('statusFlagsHTML(runtimeUnit)'));assert.match(translated('左舷の砲列 1'),/Battery 1/);assert.match(translated('外面の砲列 1'),/Exterior Surface/);
 assert.equal(run('JSON.stringify({mods:runtimeUnit.mods,last:runtimeUnit.lastShieldHit})'),before);
 run('runtimeUnit.crew=0');const short=run('surfaceRuntimeHTML(runtimeUnit)');assert.match(short,/要員不足/);translatedHTML(short);
 run('runtimeUnit.crew=14;runtimeUnit.gridState.domains.main.trip=12');const dark=run('surfaceRuntimeHTML(runtimeUnit)'),flags=run('statusFlagsHTML(runtimeUnit)');assert.match(dark,/data-power-trips/);assert.match(flags,/共通電力網停止/);translatedHTML(dark);translatedHTML(flags);
 run('C.powerTick(runtimeUnit,13)');assert.equal(run('runtimeUnit.mods[1]'),0,'restarting power does not repair the destroyed mount');assert.doesNotMatch(run('surfaceRuntimeHTML(runtimeUnit)'),/data-power-trips|data-power-local/);translatedHTML(run('surfaceRuntimeHTML(runtimeUnit)'));
 const ledger=run('C.shieldStatus(runtimeUnit).ledger');assert.ok(Math.abs(ledger.incoming-ledger.external-ledger.stored-ledger.heat-ledger.leaked)<1e-9,'processing preserves the recorded shield energy balance');assert.equal(run('runtimeUnit.surfaceArmor["qa-patch"].integrity'),.5,'power recovery cannot repair damaged armor');
});
