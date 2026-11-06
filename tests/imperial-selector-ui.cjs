const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),plain=v=>JSON.parse(JSON.stringify(v));
function setup(){
 const c=vm.createContext({console,navigator:{language:'en-US'}}),run=s=>vm.runInContext(s,c);
 for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/lang-en.js','js/i18n.js'])run(fs.readFileSync(path.join(root,file),'utf8'));
 run(`const C=Core,CRAFT_OPEN=false,esc=s=>String(s??''),fLen=n=>n+' m';let fleet={source:'imperial2',saves:[]};`);
 function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);run(app.slice(a,b));}
 section('const EXAMPLE_PURPOSE =','const titleState =');section('function titleLoadHTML()', '// Patrol:');section('function fleetOptions()', 'function fleetRoster()');
 return {run,c,section};
}
test('Imperial I and II have exactly one distinct native editor example each',()=>{
 const {run}=setup(),rows=plain(run(`exampleList(false).filter(e=>['imperial','imperial2'].includes(e.key))`));
 assert.deepEqual(rows.map(r=>r.key).sort(),['imperial','imperial2']);
 assert.equal(rows.find(r=>r.key==='imperial').name,'インペリアルI級');assert.equal(rows.find(r=>r.key==='imperial2').name,'インペリアルII級');assert.ok(rows.every(r=>r.side==='銀河帝国'&&r.purpose&&r.len===1600));
 const html=run('titleLoadHTML()');for(const key of ['imperial','imperial2'])assert.equal((html.match(new RegExp('data-title-example="'+key+'"','g'))||[]).length,1,key+' native example button');
 assert.equal(run('exampleList(true).some(e=>e.key==="imperial"||e.key==="imperial2")'),false);
});
test('fleet selection retains separate canonical keys and names for the two Imperial variants',()=>{
 const {run}=setup(),html=run('fleetOptions()');
 assert.match(html,/<option value="imperial" >インペリアルI級<\/option>/);assert.match(html,/<option value="imperial2" selected>インペリアルII級<\/option>/);
 for(const key of ['imperial','imperial2'])assert.equal((html.match(new RegExp('<option value="'+key+'"','g'))||[]).length,1);
 run('fleet.source="imperial"');const changed=run('fleetOptions()');assert.match(changed,/<option value="imperial" selected>/);assert.doesNotMatch(changed,/<option value="imperial2" selected>/);
});
test('native editor example requests preserve the selected variant through the worker boundary',async()=>{
 const {run,section}=setup();run(`const calls=[],messages=[],st={};const showBusyOverlay=()=>{},hideBusyOverlay=()=>{},syncHud=()=>{},autosave=()=>{},toast=s=>messages.push(s);let ship=null,opened=null;const setShip=s=>{ship=s;opened=s;},showTitle=()=>{},YardEngineClient={request:async(kind,payload)=>{calls.push({kind,payload});return{state:JSON.stringify({reference:payload.key,name:C.DESIGNS[payload.key].name})};}};`);
 section('async function openExample(', 'async function fillHangarsRemote(');
 for(const key of ['imperial','imperial2']){const s=await run('openExample('+JSON.stringify(key)+')');assert.equal(s.reference,key);assert.equal(run('opened.reference'),key);}
 assert.deepEqual(plain(run('calls')),[{kind:'build',payload:{key:'imperial'}},{kind:'build',payload:{key:'imperial2'}}]);
});
test('Imperial variant selector and source metadata retain English coverage',()=>{
 const {run}=setup(),texts=plain(run(`['インペリアルI級','インペリアルII級','インペリアルI級｜重砲戦艦','インペリアルII級｜重砲戦艦',EXAMPLE_PURPOSE.imperial2,...Object.values(C.SHIP_EXAMPLES).filter(d=>d.key==='imperial'||d.key==='imperial2').flatMap(d=>[d.name,d.role,d.author,d.note])].filter(Boolean)`));
 for(const text of texts){const translated=run('KSI18n.t('+JSON.stringify(text)+')');assert.doesNotMatch(translated,/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u,text);}
 assert.match(run('KSI18n.t("インペリアルII級｜重砲戦艦")'),/Imperial II-class/);
});
test('modern Imperial metadata suppresses the obsolete model credit without hiding Executor provenance',()=>{
 const {run,section}=setup();run(`let ship={reference:'imperial2'},S=null,st={tab:'hull'},cards=[];const hullEditorShip=()=>({hullSkin:null}),panel={insertAdjacentHTML:(where,html)=>cards.push(html)};`);section('function referencePanel(panel)', 'function referenceStatsHTML()');
 for(const key of ['imperial','imperial2'])for(const tab of ['hull','systems']){run('ship.reference='+JSON.stringify(key)+';st.tab='+JSON.stringify(tab)+';cards=[];referencePanel(panel)');assert.equal(run('cards.length'),0,'registered '+key+' cannot inherit a retired model source');}
 run('ship.reference="executor";st.tab="hull";cards=[];referencePanel(panel)');assert.equal(run('cards.length'),1);assert.match(run('cards[0]'),/参照モデル/);assert.ok(run('cards[0].includes(C.DREADNOUGHT_EXAMPLES.executor.source)'));
});
