const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),c=vm.createContext({console,navigator:{language:'en-US'}}),run=code=>vm.runInContext(code,c),plain=value=>JSON.parse(JSON.stringify(value));
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js','js/lang-en.js','js/i18n.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c,{filename:file});
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);run(app.slice(a,b));}
run(`
const C=Core,T=s=>KSI18n.t(s),notices=[],undoStack=[],st={foilView:null},shot={on:false},voy={orders:false},windowEvents={};
let autosaves=0,draws=0,ship,view=null;
const trial={on:true,paused:false,spectate:false,rts:null,battle:null,foilUnit:null,p:null,asset:null,turrets:[],launchers:[],keys:new Set()};
const actionNode={textContent:''},progressNode={textContent:''},attributes={},control={setAttribute:(key,v)=>attributes[key]=v,querySelector:s=>s==='[data-foil-action]'?actionNode:progressNode};
const hud={hidden:false,innerHTML:'',classList:{remove:()=>{}}};
const document={body:{classList:{remove:()=>{}}},querySelectorAll:s=>s==='[data-foil-control]'?[control]:[],querySelector:()=>null};
const window=globalThis;window.addEventListener=(type,fn)=>(windowEvents[type]||=[]).push(fn);
const $=s=>s==='#trialHud'?hud:null,sourceText=node=>node.textContent,toast=s=>notices.push(s),autosave=()=>autosaves++,requestDraw=()=>draws++;
const msPatrolCollect=()=>null,shotSet=on=>shot.on=on,YardEngineClient={post:()=>{}},fleetPrune=()=>{},renderPanel=()=>{},renderSpecTargets=()=>{},syncHud=()=>{},voyPilotEnd=()=>{},fleetSetMode=()=>{},showTitle=()=>{};
const trialKeyStick=()=>{},voySpectateKey=()=>false;
function trialCommand(cmd){if(cmd==='foil')trialFoilCommand();else throw new Error('unexpected command '+cmd);}
function reset(){
 notices.length=0;undoStack.length=0;autosaves=0;draws=0;st.foilView=null;shot.on=false;voy.orders=false;
 ship=C.newShip({L:30,W:30,H:10,assembly:true});ship.parts.push({id:11,k:'struct',form:'box',c:[10,3,4],s:[4,6,1],wing:{foil:true,axis:'x',pivot:[10,3,1],stow:0,open:90,T:2,feed:1,reinf:0}});
 const foils=[{id:11,n:'Upper S-foil',T:2,sec:0,jam:.3},{id:22,n:'Lower S-foil',T:4,sec:1,jam:.3}];
 const geometry={foils:[{id:11,T:2,axis:'x',pivot:[10,3,1],stow:0,open:90,sg:-1},{id:22,T:4,axis:'x',pivot:[10,2,-1],stow:0,open:45,sg:1}]};
 const turret={id:101,foilId:11,mesh:'foil-gun',pivot:[10,3,4],origin:[12,3,4],axis:[0,1,0],fw:[1,0,0],e2:[0,0,-1],mount:[0,1,0],yaw:.2,clear:true,clearDir:[1,0,0]};
 const launcher={id:201,foilId:11,origin:[11,3,5],axis:[1,0,0]};
 Object.assign(trial,{on:true,paused:false,spectate:false,rts:null,battle:null,foilUnit:null,p:{foils},asset:{design:C.serialize(ship),geometry},turrets:[turret],launchers:[launcher],keys:new Set(),returnTo:null,designCamera:null});
 actionNode.textContent='';progressNode.textContent='';for(const k in attributes)delete attributes[k];
 trialFoilReset();
}
`);
section('function trialAxisMatrix(', 'const trialWrap=');
const multiplyStart=app.indexOf('const spaceAtt=new WeakMap(),m3Mul=');assert.ok(multiplyStart>=0);run(app.slice(multiplyStart,app.indexOf('\n',multiplyStart)));
section('function trialFoilUnit()', 'function trialReset()');
section('function trialStop()', 'function trialAttitude()');
section('function trialCommand(cmd)', '// ---------- star systems ----------');
run('reset();');
function vector(actual,expected){assert.equal(actual.length,expected.length);actual.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<1e-8,`component ${i}: ${v} != ${expected[i]}`));}

test('free flight begins stowed and opens each foil over its own deployment time',()=>{
 run('reset();');assert.deepEqual(plain(run('trialFoilDeployments()')),{11:0,22:0});assert.equal(run('trialFoilTarget()'),0);
 run('trialFoilCommand("open");trialFoilStep(1);');assert.deepEqual(plain(run('trialFoilDeployments()')),{11:.5,22:.25});
 run('trialFoilStep(1);');assert.deepEqual(plain(run('trialFoilDeployments()')),{11:1,22:.5});
 run('trialFoilStep(2);');assert.deepEqual(plain(run('trialFoilDeployments()')),{11:1,22:1});
 assert.equal(run('trialFoilUnit().order.foil'),'open');
});

test('reversing a command midway continues smoothly from the current deployment',()=>{
 run('reset();trialFoilCommand("open");trialFoilStep(1);trialFoilCommand();');
 assert.deepEqual(plain(run('trialFoilDeployments()')),{11:.5,22:.25});assert.equal(run('trialFoilTarget()'),0);
 run('trialFoilStep(.5);');assert.deepEqual(plain(run('trialFoilDeployments()')),{11:.25,22:.125});
 run('trialFoilCommand();trialFoilStep(.5);');assert.deepEqual(plain(run('trialFoilDeployments()')),{11:.5,22:.25});
});

test('paused zero-time frames keep their pose while allowing a queued deployment command',()=>{
 run('reset();trial.paused=true;trialFoilCommand("open");trialFoilStep(0);');
 assert.equal(run('trialFoilTarget()'),1);assert.deepEqual(plain(run('trialFoilDeployments()')),{11:0,22:0});
 run('trialFoilStep(0);trial.paused=false;trialFoilStep(.5);');assert.deepEqual(plain(run('trialFoilDeployments()')),{11:.25,22:.125});
});

test('runtime commands and reset leave saved design and undo history untouched, and exit discards local state',()=>{
 run('reset();');const design=run('C.publicJSON(ship)'),asset=run('JSON.stringify(trial.asset.design)');
 run('trialFoilCommand("open");trialFoilStep(1);trialFoilUnit().fo.jam[0]=true;');c.previousUnit=run('trial.foilUnit');
 run('trialFoilReset();');assert.notEqual(run('trial.foilUnit'),c.previousUnit);assert.deepEqual(plain(run('trialFoilDeployments()')),{11:0,22:0});
 assert.deepEqual(plain(run('trial.foilUnit.fo.jam')),[false,false]);
 assert.equal(run('C.publicJSON(ship)'),design);assert.equal(run('JSON.stringify(trial.asset.design)'),asset);assert.equal(run('autosaves'),0);assert.equal(run('undoStack.length'),0);
 run('trialStop();');assert.equal(run('trial.foilUnit'),null);assert.equal(run('trial.asset'),null);assert.equal(run('trial.on'),false);
 run('reset();');assert.notEqual(run('trial.foilUnit'),c.previousUnit);assert.deepEqual(plain(run('trialFoilDeployments()')),{11:0,22:0});
});

test('voyage flight shares the live unit order and does not advance deployment twice',()=>{
 run('reset();trial.battle={me:{p:trial.p,order:{foil:"auto",type:"move",target:99}}};C.foilInit(trial.battle.me);trial.battle.me.fo.d=[.2,.4];trial.rts={};');
 assert.equal(run('trialFoilUnit()'),run('trial.battle.me'));
 run('trialFoilCommand("open");');assert.equal(run('trial.battle.me.order.foil'),'open');assert.equal(run('trial.battle.me.order.target'),99);
 assert.equal(run('trial.foilUnit.order.foil'),'close','unused local fallback must not receive live-unit orders');
 run('C.foilStep(trial.battle.me,.5,()=>trialFoilTarget());');const afterWorld=plain(run('trialFoilDeployments()'));
 run('trialFoilStep(.5);');assert.deepEqual(plain(run('trialFoilDeployments()')),afterWorld);
 run('trial.rts=null;trialFoilStep(.5);');
 vector(plain(run('trial.battle.me.fo.d')),[afterWorld[11]+.25,afterWorld[22]+.125]);
});

test('damage jams preserve the frozen pose, live unit state, and progress status',()=>{
 run('reset();trial.battle={me:{p:trial.p,order:{foil:"close"},sec:[{s:20,max:100},{s:100,max:100}]}};C.foilInit(trial.battle.me);trial.battle.me.fo.d=[.4,.1];trialFoilCommand("open");trialFoilStep(1);');
 assert.equal(run('trial.battle.me.fo.jam[0]'),true);assert.equal(run('trial.battle.me.fo.d[0]'),.4);
 assert.equal(run('trial.battle.me.fo.d[1]'),.35);assert.match(run('trialFoilProgress()'),/固着 1 基/);
 run('trial.battle.me.sec[0].s=100;trialFoilCommand("close");trialFoilStep(1);');assert.equal(run('trial.battle.me.fo.d[0]'),.4);
 assert.equal(run('trial.battle.me.fo.jam[0]'),true);assert.ok(run('notices.some(s=>s.includes("固着"))'));
});

test('S-foil controls appear only for articulated ships and show target action and live progress',()=>{
 run('reset();');assert.match(run('trialFoilButtonHTML()'),/data-trial-cmd="foil"/);assert.match(run('trialFoilButtonHTML("shot")'),/data-shot="foil"/);
 assert.match(run('trialFoilButtonHTML()'),/<kbd>O<\/kbd>/);assert.match(run('trialFoilButtonHTML()'),/Sフォイルを展開/);
 run('trialFoilCommand("open");trialFoilStep(1);trialFoilUpdateControls();');
 assert.match(run('trialFoilButtonHTML()'),/Sフォイルを収納/);assert.equal(run('attributes["aria-pressed"]'),'true');assert.equal(run('progressNode.textContent'),run('trialFoilProgress()'));
 run('trial.spectate=true;');assert.equal(run('trialFoilButtonHTML()'),'');assert.equal(run('trialFoilUnit()'),null);
 run('trial.spectate=false;trial.asset.geometry.foils=[];');assert.equal(run('trialFoilButtonHTML()'),'');
});

test('turret and launcher poses follow the same hinge transform as rendered foils without accumulating rotations',()=>{
 run('reset();');const base=plain(run('trial.turrets[0]._foilBase')),launcher=plain(run('trial.launchers[0]._foilBase'));
 for(const deployment of [1,.25,.25,.75,0,1]){
  c.deployment=deployment;run('trialFoilUnit().fo.d[0]=deployment;trialPoseFoilMounts();');
  const X=run('Gfx.foilTransform(trial.asset.geometry.foils[0],deployment)'),turret=run('trial.turrets[0]'),missile=run('trial.launchers[0]');
  for(const k of ['pivot','origin'])vector(plain(turret[k]),plain(X.point(base[k])));
  for(const k of ['axis','fw','e2','mount'])vector(plain(turret[k]),plain(X.direction(base[k])));
  vector(plain(missile.origin),plain(X.point(launcher.origin)));vector(plain(missile.axis),plain(X.direction(launcher.axis)));
  vector(plain(turret._foilRot),plain(X.rot));vector(plain(turret.rot),plain(run('m3Mul(trialAxisMatrix(trial.turrets[0].axis,trial.turrets[0].yaw),Gfx.foilTransform(trial.asset.geometry.foils[0],deployment).rot)')));
 }
 vector(plain(run('trial.turrets[0].origin')),base.origin);
 run('trial.turrets[0].clear=true;trial.turrets[0].clearDir=[1,0,0];trialPoseFoilMounts();');assert.equal(run('trial.turrets[0].clear'),true);
 run('trialFoilUnit().fo.d[0]=.5;trialPoseFoilMounts();');assert.equal(run('trial.turrets[0].clear'),false);assert.equal(run('trial.turrets[0].clearDir'),null);
});

test('geometry-only foil metadata creates runtime state without modifying its profile',()=>{
 run('reset();delete trial.p.foils;');const before=run('JSON.stringify(trial.p)');
 run('trialFoilReset();trialFoilCommand("open");trialFoilStep(1);');
 assert.deepEqual(plain(run('trialFoilDeployments()')),{11:.5,22:.25});assert.equal(run('JSON.stringify(trial.p)'),before);
 assert.match(run('trialFoilButtonHTML("shot")'),/data-shot="foil"/);
 assert.deepEqual(plain(run('unitFoilDeployments({p:{foils:[{id:22},{id:11}]},fo:{d:[.2,.7]}})')),{11:.7,22:.2});
});

test('O toggles the runtime order in flight and shot mode while focused forms keep the key',()=>{
 run(app.match(/const TRIAL_KEYS=.*?;/)[0]);run(app.match(/const TRIAL_HOLD=.*?;/)[0]);
 const begin=app.indexOf(" window.addEventListener('keydown',e=>",app.indexOf('function bindTrial(){')),finish=app.indexOf('},true);',begin);
 assert.ok(begin>=0&&finish>begin);run(app.slice(begin,finish+'},true);'.length));
 run(`function pressO(tag='canvas',insideShotBar=false,repeat=false,editable=false){
  let prevented=0,stopped=0;
  const target={matches:selector=>selector.split(',').includes(tag),closest:selector=>insideShotBar&&selector==='#shotBar'?{}:null,isContentEditable:editable};
  const e={code:'KeyO',key:'o',target,repeat,preventDefault:()=>prevented++,stopImmediatePropagation:()=>stopped++};for(const fn of windowEvents.keydown||[])fn(e);return {prevented,stopped};
 }reset();`);
 assert.deepEqual(plain(run('pressO()')),{prevented:1,stopped:1});assert.equal(run('trialFoilTarget()'),1);
 assert.deepEqual(plain(run('pressO("canvas",false,true)')),{prevented:1,stopped:1});assert.equal(run('trialFoilTarget()'),1,'key repeat must not oscillate target');
 run('shot.on=true;');assert.deepEqual(plain(run('pressO()')),{prevented:1,stopped:1});assert.equal(run('trialFoilTarget()'),0);
 for(const tag of ['input','textarea','select']){
  c.tag=tag;assert.deepEqual(plain(run('pressO(tag)')),{prevented:0,stopped:0},tag);assert.equal(run('trialFoilTarget()'),0);
 }
 assert.deepEqual(plain(run('pressO("div",false,false,true)')),{prevented:0,stopped:0});
 assert.deepEqual(plain(run('pressO("button",true)')),{prevented:0,stopped:0});assert.equal(run('trialFoilTarget()'),0);
 run(`function pressFoilControl(code){
  let prevented=0,stopped=0;const target={matches:()=>false,closest:selector=>selector==='[data-foil-control]'?control:null};
  const e={code,target,repeat:false,preventDefault:()=>prevented++,stopImmediatePropagation:()=>stopped++};
  for(const fn of windowEvents.keydown||[])fn(e);return {prevented,stopped};
 }shot.on=false;trial.fireKey=false;`);
 for(const code of ['Space','Enter']){
  c.code=code;assert.deepEqual(plain(run('pressFoilControl(code)')),{prevented:0,stopped:0},code);
  assert.equal(run('trial.fireKey'),false);assert.equal(run('trialFoilTarget()'),0,'native activation must not be processed as flight input');
 }
 assert.deepEqual(plain(run('pressFoilControl("KeyO")')),{prevented:1,stopped:1});assert.equal(run('trialFoilTarget()'),1);
});

test('new foil actions, progress, and jam status translate completely in the HUD and screenshot controls',()=>{
 run('reset();KSI18n.setLanguage("en");');const jp=/[\u3040-\u30ff\u3400-\u9fff]/;
 for(const setup of ['','trialFoilCommand("open");trialFoilStep(1);','trialFoilUnit().fo.jam[0]=true;']){
  run(setup);
  for(const kind of ['hud','shot']){
   c.kind=kind;const html=run('trialFoilButtonHTML(kind)');
   for(const text of html.split(/<[^>]*>/).filter(v=>v.trim()))assert.doesNotMatch(c.KSI18n.t(text),jp,text);
   for(const [,text] of html.matchAll(/aria-label="([^"]*)"/g))assert.doesNotMatch(c.KSI18n.t(text),jp,text);
  }
 }
 for(const source of ['この艦にはSフォイルがありません','Sフォイル：展開を指示','Sフォイル：収納を指示'])assert.doesNotMatch(c.KSI18n.t(source),jp,source);
});

test('ray-check requests carry every foil pose and reject stale replies after another wing or asset changes',async()=>{
 section('function trialRays(now)', 'function trialRenderSets()');
 run(`const rayRequests=[];const trialBarrel=t=>t.fw.slice();
 YardEngineClient.request=(type,payload)=>new Promise(resolve=>rayRequests.push({type,payload,resolve}));
 reset();trial.rays={busy:false,last:0};trial.turrets[0].clear=false;trial.turrets[0].clearDir=null;trialRays(100);`);
 assert.equal(run('trial.rays.busy'),true);assert.equal(run('rayRequests[0].type'),'trialRays');
 assert.deepEqual(plain(run('rayRequests[0].payload.foils')),{11:0,22:0});assert.deepEqual(plain(run('rayRequests[0].payload.ids')),[101]);
 assert.equal(run('rayRequests[0].payload.dirs.length'),3);
 // Wing 22 may block a gun carried by wing 11 even though the barrel's own wing has not moved.
 run('trialFoilUnit().fo.d[1]=.5;rayRequests[0].resolve({clear:[true]});');
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(run('trial.turrets[0].clear'),false);assert.equal(run('trial.turrets[0].clearDir'),null);assert.equal(run('trial.rays.busy'),false);
 run('trialRays(200);');assert.deepEqual(plain(run('rayRequests[1].payload.foils')),{11:0,22:.5});
 run('rayRequests[1].resolve({clear:[true]});');await new Promise(resolve=>setImmediate(resolve));
 assert.equal(run('trial.turrets[0].clear'),true);vector(plain(run('trial.turrets[0].clearDir')),plain(run('trial.turrets[0].fw')));
 assert.equal(run('trial.rays.busy'),false);
 run('trial.turrets[0].clear=false;trial.turrets[0].clearDir=null;trialRays(300);trial.asset={...trial.asset};rayRequests[2].resolve({clear:[true]});');
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(run('trial.turrets[0].clear'),false,'a new asset must reject the old asset reply even with equal poses');
 assert.equal(run('trial.turrets[0].clearDir'),null);assert.equal(run('trial.rays.busy'),false);
});
