const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),start=app.indexOf('// ---------- screenshot mode ----------'),end=app.indexOf('// ---------- 公試:',start);
assert.ok(start>=0&&end>start,'screenshot module must be present');
const moduleSource=app.slice(start,end),localeFiles=['js/lang-en.js','js/i18n.js'].map(file=>({file,source:fs.readFileSync(path.join(root,file),'utf8')}));
function fixture(preference){
 const c=vm.createContext({Blob,console:{error:()=>{}},navigator:{language:'en-US'}}),run=source=>vm.runInContext(source,c);
 c.preference=preference;
 run(`
 const saved=new Map(preference==null?[]:[['yard.shotQuality',String(preference)]]),writes=[],events={},windowEvents={},frames=[],timers=[],cleared=[],downloads=[],encoded=[],urls=[],revoked=[],notices=[],errors=[];
 const LS={get:key=>saved.get(key)??null,set:(key,value)=>{saved.set(key,value);writes.push([key,value]);}};
 const classes=new Set(),bar={innerHTML:'',hidden:true,classList:{remove:name=>classes.delete(name),add:name=>classes.add(name)},matches:()=>false,contains:()=>false,addEventListener:(type,fn)=>(events[type]||=[]).push(fn)};
 const sizeNode={textContent:''},button={setAttribute:()=>{},addEventListener:(type,fn)=>(events['button:'+type]||=[]).push(fn)};
 const saveNode={disabled:false},qualityNode={value:'2'};let barHTML='',barWrites=0;
 Object.defineProperty(bar,'innerHTML',{get:()=>barHTML,set:value=>{barWrites++;barHTML=value;saveNode.disabled=/data-shot="save" disabled/.test(value);const size=value.match(/data-shot-size>([^<]*)</);if(size)sizeNode.textContent=size[1];}});
 bar.querySelector=selector=>selector==='[data-shot="save"]'?saveNode:selector==='[data-shot-size]'?sizeNode:selector==='[data-shot-quality]'?qualityNode:null;
 const $=selector=>selector==='#shotBar'?bar:selector==='#btnShot'?button:selector==='#shotBar [data-shot-size]'?sizeNode:null;
 const document={activeElement:null,body:{classList:{toggle:()=>{}},appendChild:node=>{node.appended=true;}},createElement:tag=>{
  if(createFails)throw new Error('create element failed');
  return {href:'',download:'',click(){if(clickFails)throw new Error('download blocked');downloads.push({href:this.href,name:this.download,appended:this.appended});},remove(){removed++;}};
 }};
 const window=globalThis;window.addEventListener=(type,fn)=>(windowEvents[type]||=[]).push(fn);
 const URL={createObjectURL:blob=>{if(urlFails)throw new Error('URL failed');const url='blob:capture-'+(urls.length+1);urls.push({url,blob});return url;},revokeObjectURL:url=>revoked.push(url)};
 const requestAnimationFrame=fn=>{frames.push(fn);return frames.length;},setTimeout=(fn,ms)=>{timers.push({fn,ms});return timers.length;},clearTimeout=id=>cleared.push(id);
 const T=s=>s,esc=s=>String(s),toast=s=>notices.push(s),requestDraw=()=>drawRequests++,hideInspect=()=>{},clearHover=()=>{},refreshOverlay=()=>{},renderPanel=()=>{};
 const trial={on:false,paused:false,t:42,last:17,fire:true,fireKey:true,asset:{design:{name:'Trial / Vessel'}}},voy={open:false,orders:false},load={on:false},fleet={mode:'design'},renderHealth={lost:false},st={sel:{id:1},hatchA:2};
 let ship={name:'Test / Ship:*?"<>|'},drawRequests=0,captures=0,removed=0,captureFails=false,encodingFails=false,clickFails=false,createFails=false,urlFails=false,resultSize=null,limited=false;
 let view={captureSize(scale){return {width:960*scale,height:540*scale,limited};},capture(scale){
  captures++;if(captureFails)throw new Error('renderer failed');
  const [width,height]=resultSize||[960*scale,540*scale];
  return {width,height,toBlob(callback,mime){encoded.push({width,height,mime});callback(encodingFails?null:new Blob(['PNG'],{type:mime}));}};
 }};
 function quality(value){const target={value:String(value),matches:selector=>selector==='[data-shot-quality]'};for(const fn of events.change||[])fn({target});}
 function flushFrame(){const fn=frames.shift();if(fn)fn(100);}
 function releaseURLs(){for(const t of timers)if(t.ms===60000)t.fn();}
 `);
 run(moduleSource);run('bindShot();');
 return {c,run,plain:source=>JSON.parse(JSON.stringify(run(source))),async save(){const job=run('shotSavePNG()');run('flushFrame();');await job;}};
}

test('PNG quality defaults to 2x and restores only supported preferences',()=>{
 for(const preference of [undefined,null,'',0,3,8,'invalid'])assert.equal(fixture(preference).run('shot.scale'),2,String(preference));
 for(const preference of [1,2,4,'4'])assert.equal(fixture(preference).run('shot.scale'),Number(preference));
 const f=fixture();f.run('quality(4);');assert.equal(f.run('shot.scale'),4);assert.deepEqual(f.plain('writes'),[['yard.shotQuality','4']]);
 f.run('quality(3);quality("bad");');assert.equal(f.run('shot.scale'),4);assert.equal(f.run('writes.length'),1);
 f.run('shot.busy=true;quality(1);');assert.equal(f.run('shot.scale'),4);assert.equal(f.run('writes.length'),1);
});

test('PNG controls show the selected quality and actual output size, including device limits',()=>{
 const f=fixture(4);f.run('shotBarRender();');
 assert.match(f.run('bar.innerHTML'),/value="4" selected/);assert.match(f.run('bar.innerHTML'),/3840 × 2160 px/);
 assert.match(f.run('bar.innerHTML'),/data-shot="save"/);
 f.run('limited=true;quality(2);');assert.match(f.run('sizeNode.textContent'),/1920 × 1080 px（端末の上限に調整）/);
 f.run('shot.busy=true;shotBarRender();');assert.match(f.run('bar.innerHTML'),/data-shot-quality[^>]*disabled/);assert.match(f.run('bar.innerHTML'),/data-shot="save" disabled/);
});

test('PNG export encodes the captured dimensions and downloads a sanitized .png filename',async()=>{
 const f=fixture(4);f.run('shot.on=true;resultSize=[3200,1800];');
 await f.save();
 assert.equal(f.run('captures'),1);assert.deepEqual(f.plain('encoded'),[{width:3200,height:1800,mime:'image/png'}]);
 const [download]=f.plain('downloads');assert.ok(download.appended);assert.match(download.href,/^blob:capture-/);
 assert.match(download.name,/_3200x1800_\d{4}-\d\d-\d\dT[\d-]+Z\.png$/);
 assert.doesNotMatch(download.name,/[\\/:*?"<>|\u0000-\u001f]/);
 assert.equal(f.run('urls[0].blob.type'),'image/png');assert.equal(f.run('removed'),1);
 assert.equal(f.run('shot.busy'),false);assert.equal(f.run('drawRequests'),1);
 assert.match(f.run('shot.status'),/3200 × 1800/);assert.match(f.run('bar.innerHTML'),/PNGを保存しました/);
 assert.equal(f.run('revoked.length'),0);f.run('releaseURLs();');assert.deepEqual(f.plain('revoked'),[download.href]);
});

test('busy export rejects reentry and does not advance simulation, pause, or firing state',async()=>{
 const f=fixture();f.run('shot.on=true;trial.on=true;trial.paused=true;');
 const before=f.plain('trial'),first=f.run('shotSavePNG()');
 assert.equal(f.run('shot.busy'),true);assert.equal(f.run('captures'),0);
 await f.run('shotSavePNG()');assert.equal(f.run('frames.length'),1);
 f.run('flushFrame();');await first;
 assert.equal(f.run('captures'),1);assert.deepEqual(f.plain('trial'),before);
 assert.match(f.plain('downloads')[0].name,/^Trial _ Vessel_/);
 assert.equal(f.run('shot.busy'),false);
});

test('renderer, PNG, and download failures restore controls and clean temporary download resources',async()=>{
 for(const failure of ['captureFails','encodingFails','clickFails','createFails','urlFails']){
  const f=fixture();f.run('shot.on=true;'+failure+'=true;');await f.save();
  assert.equal(f.run('shot.busy'),false,failure);assert.equal(f.run('downloads.length'),0,failure);
  assert.match(f.run('shot.status'),/画像を保存できませんでした/);assert.doesNotMatch(f.run('bar.innerHTML'),/data-shot="save" disabled/);
  assert.equal(f.run('drawRequests'),1,failure);
  if(['clickFails','createFails'].includes(failure)){
   assert.equal(f.run('urls.length'),1);f.run('releaseURLs();');assert.equal(f.run('revoked.length'),1);
  }else assert.equal(f.run('urls.length'),0);
  if(failure==='clickFails')assert.equal(f.run('removed'),1);
 }
});

test('tactical and voyage maps, context loss, and absent renderers cannot export a stale hidden 3D scene',async()=>{
 for(const setup of ['fleet.mode="tactical";','voy.open=true;','load.on=true;','trial.on=true;voy.open=true;voy.orders=true;','renderHealth.lost=true;','view=null;']){
  const f=fixture();f.run(setup+'shotBarRender();');
  assert.equal(f.run('shotCanSave()'),false,setup);assert.equal(f.run('shotOutputSize()'),null,setup);
  assert.match(f.run('bar.innerHTML'),/data-shot="save" disabled/);await f.run('shotSavePNG()');
  assert.equal(f.run('captures'),0);assert.equal(f.run('frames.length'),0);assert.equal(f.run('shot.busy'),false);
 }
 const f=fixture();f.run('voy.open=true;trial.on=true;');assert.equal(f.run('shotCanSave()'),true,'a running 3D flight remains exportable');
});

test('a map opened before the capture frame prevents a hidden-view download',async()=>{
 const f=fixture();f.run('shot.on=true;');const job=f.run('shotSavePNG()');
 f.run('voy.open=true;flushFrame();');await job;
 assert.equal(f.run('captures'),0);assert.equal(f.run('downloads.length'),0);assert.equal(f.run('shot.busy'),false);
 assert.match(f.run('shot.status'),/画像を保存できませんでした/);
});

test('screenshot controls and status messages have complete English translations',()=>{
 const f=fixture();for(const {file,source} of localeFiles)vm.runInContext(source,f.c,{filename:file});
 f.run('KSI18n.setLanguage("en");');const jp=/[\u3040-\u30ff\u3400-\u9fff]/;
 for(const setup of ['','trial.on=true;','trial.paused=true;','shot.busy=true;','shot.busy=false;limited=true;','trial.on=false;voy.open=true;']){
  f.run(setup+'shotBarRender();');const html=f.run('bar.innerHTML');
  const labels=[...html.split(/<[^>]*>/).filter(t=>t.trim()),...Array.from(html.matchAll(/aria-label="([^"]*)"/g),m=>m[1])];
  for(const label of labels)assert.doesNotMatch(f.c.KSI18n.t(label),jp,label);
 }
 for(const status of ['PNGを保存しました（3200 × 1800 px）。','画像を保存できませんでした。画質を下げて再試行してください。','画質を選んで「PNGで保存」を押すと、高解像度の画像を保存できます（H・Esc で戻る）。'])assert.doesNotMatch(f.c.KSI18n.t(status),jp,status);
});

function installScreenshotKeyboard(f,mode){
 let source;
 if(mode==='trial'){
  const begin=app.indexOf(" window.addEventListener('keydown',e=>",app.indexOf('function bindTrial(){'));
  const finish=app.indexOf('},true);',begin);
  assert.ok(begin>=0&&finish>begin,'trial capture-phase keydown callback must exist');
  source=app.slice(begin,finish+'},true);'.length);
  f.run(app.match(/const TRIAL_KEYS=.*?;/)[0]);
  f.run(app.match(/const TRIAL_HOLD=.*?;/)[0]);
  f.run(`const commands=[];trial.keys=new Set();trial.spectate=false;trial.tele=1;
    function trialKeyStick(){}function voySpectateKey(){return false;}
    function trialCommand(cmd){commands.push(cmd);if(cmd==='tele+')trial.tele++;if(cmd==='tele-')trial.tele--;}`);
 }else{
  const begin=app.indexOf("  window.addEventListener('keydown', e => {\n    if(fleet.mode!=='design'||trial.on)return;");
  const finish=app.indexOf('\n  });',begin);
  assert.ok(begin>=0&&finish>begin,'design keydown callback must exist');
  source=app.slice(begin,finish+'\n  });'.length);
 }
 f.run(source);
 f.run(`function dispatchKey(code,inside,tag='select'){
  let prevented=0,stopped=0;
  const target={matches:selector=>selector.replace(/ /g,'').split(',').includes(tag),closest:selector=>inside&&selector==='#shotBar'?bar:null};
  const event={code,key:code==='Escape'?'Escape':code==='KeyH'?'h':code==='Space'?' ':code,target,ctrlKey:false,metaKey:false,altKey:false,repeat:false,preventDefault:()=>prevented++,stopImmediatePropagation:()=>stopped++};
  for(const fn of windowEvents.keydown||[])fn(event);return {prevented,stopped};
 }`);
}

test('screenshot quality and save controls keep native arrow/Space keys during a flight',()=>{
 const f=fixture();installScreenshotKeyboard(f,'trial');f.run('trial.on=true;trial.fireKey=false;shot.on=true;');
 for(const code of ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight']){
  f.c.code=code;assert.deepEqual(f.plain('dispatchKey(code,true,"select")'),{prevented:0,stopped:0},code);
 }
 assert.equal(f.run('trial.tele'),1);assert.equal(f.run('commands.length'),0);
 assert.deepEqual(f.plain('dispatchKey("Space",true,"button")'),{prevented:0,stopped:0});assert.equal(f.run('trial.fireKey'),false);
 assert.deepEqual(f.plain('dispatchKey("ArrowUp",false,"canvas")'),{prevented:1,stopped:1});
 assert.equal(f.run('trial.tele'),2);assert.deepEqual(f.plain('commands'),['tele+']);
 assert.deepEqual(f.plain('dispatchKey("Space",false,"canvas")'),{prevented:1,stopped:1});assert.equal(f.run('trial.fireKey'),true);
});

test('H and Escape still exit screenshot mode from focused controls in flight and design views',()=>{
 for(const mode of ['trial','design'])for(const code of ['KeyH','Escape']){
  const f=fixture();installScreenshotKeyboard(f,mode);f.run('shot.on=true;trial.on='+(mode==='trial')+';');f.c.code=code;
  const result=f.plain('dispatchKey(code,true,"select")');
  assert.equal(f.run('shot.on'),false,mode+' '+code);assert.equal(result.prevented,1,mode+' '+code);
  if(mode==='trial')assert.equal(result.stopped,1);
 }
 const f=fixture();installScreenshotKeyboard(f,'design');f.run('shot.on=true;');
 assert.deepEqual(f.plain('dispatchKey("ArrowUp",true,"select")'),{prevented:0,stopped:0});
 assert.deepEqual(f.plain('dispatchKey("Space",true,"button")'),{prevented:0,stopped:0});
 assert.equal(f.run('shot.on'),true);
});

test('save availability follows loading and map overlays without rebuilding the focused screenshot bar',()=>{
 const f=fixture();f.run('shot.on=true;load.on=true;shotBarRender();document.activeElement=qualityNode;');
 assert.equal(f.run('saveNode.disabled'),true);assert.match(f.run('sizeNode.textContent'),/画像の保存は3D表示で使えます/);
 const writes=f.run('barWrites'),html=f.run('bar.innerHTML');
 f.run('load.on=false;shotRefreshAvailability();');
 assert.equal(f.run('saveNode.disabled'),false);assert.equal(f.run('sizeNode.textContent'),'1920 × 1080 px');
 f.run('voy.open=true;shotRefreshAvailability();');
 assert.equal(f.run('saveNode.disabled'),true);assert.match(f.run('sizeNode.textContent'),/画像の保存は3D表示で使えます/);
 f.run('voy.open=false;shotRefreshAvailability();');assert.equal(f.run('saveNode.disabled'),false);
 f.run('shot.busy=true;shotRefreshAvailability();');assert.equal(f.run('saveNode.disabled'),true);assert.equal(f.run('shot.busy'),true);
 f.run('load.on=true;shotRefreshAvailability();load.on=false;shotRefreshAvailability();');
 assert.equal(f.run('saveNode.disabled'),true,'busy capture stays disabled after an overlay closes');assert.equal(f.run('shot.busy'),true);
 f.run('shot.busy=false;shotRefreshAvailability();');assert.equal(f.run('saveNode.disabled'),false);
 assert.equal(f.run('barWrites'),writes);assert.equal(f.run('bar.innerHTML'),html);
 assert.equal(f.run('document.activeElement===qualityNode'),true,'the focused native select is preserved');
});
