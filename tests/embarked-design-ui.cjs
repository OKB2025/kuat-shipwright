const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
const helperSource=app.slice(app.indexOf('function voyEmbarkedSources()'),app.indexOf('// ---- the order of battle of one ship (air wing and embarked troops) ----'));
function harness(){
 const c=vm.createContext({console,setTimeout});
 vm.runInContext(`
 const esc=s=>String(s).replace(/[<>\"]/g,c=>({'<':'&lt;','>':'&gt;','"':'&quot;'}[c])),num=v=>String(v),fCr=v=>String(v),voySqLoadHTML=()=>'';
 let ship={name:'Current design'},records=[{id:'fighter',name:'Saved fighter'},{id:'corvette',name:'Saved corvette'}],assetCalls=[],renders=0,saves=0,messages=[],assetJob=null;
 const sh={air:[]},setup={editing:'carrier'},voy={setup,saves:records.slice(),sel:{wing:null}},fleet={saves:[],assets:new Map()},Store={list:async()=>records};
 const R={RULES:{maxSquadSize:72},ROLE_NAME:{fighter:'戦闘機',transport:'輸送機'},CRAFT:{tie_ln:{name:'TIE',role:'fighter',cost:12}},registerDesignCraft:d=>{const k='custom-'+d.name;R.CRAFT[k]={name:d.name,role:'fighter',design:true,snapshot:d};return k;},craftCost:k=>R.CRAFT[k]?.cost||1,WING_PHASE:{docked:'待機'}};
 const C={clamp:(n,lo,hi)=>Math.max(lo,Math.min(n,hi)),designCraftSnapshot:(design,stats,ref)=>({ref,name:design.name,dims:[12,8,4],craft:{role:'fighter',speed:1200,aa:1,strike:12,armor:1},blueprint:design})};
 const voyFindShip=id=>id==='carrier'?{sh}:null,voyOrbatSheet=()=>renders++,voyObChanged=()=>saves++,toast=t=>messages.push(t),voyWingOrderText=()=> '待機';
 const fleetAsset=async source=>{assetCalls.push(source);if(assetJob)return await assetJob;return {design:{name:source},stats:{}};};
 const eventListeners={},eventRoot={addEventListener:(name,fn)=>eventListeners[name]=fn},$=()=>eventRoot,voyEdOb=()=>({});
 `,c);
 vm.runInContext(helperSource,c);
 // Exercise the real setup change handler, stopping before click binding to keep its unrelated dependencies out.
 const start=app.indexOf(" root.addEventListener('change', async e => {",app.indexOf('function voyBindSetup()'));
 const end=app.indexOf(" root.addEventListener('click', async e => {",start);
 assert.ok(start>=0&&end>start);vm.runInContext('const root=eventRoot;\n'+app.slice(start,end),c);
 return {c,run:code=>vm.runInContext(code,c),plain:value=>JSON.parse(JSON.stringify(value))};
}

test('embark catalog offers every saved class plus the current design without preparing assets',()=>{
 const h=harness(),options=h.run('voyEmbarkedDesignOptions(null)');
 assert.match(options,/dsn:save:fighter/);assert.match(options,/dsn:save:corvette/);assert.match(options,/dsn:current/);
 assert.equal(h.run('assetCalls.length'),0);
});

test('adding a saved small ship stores its complete design snapshot and separate group and wing numbers',async()=>{
 const h=harness();h.run("sh.air.push({craft:'tie_ln',n:12,groupNo:3,wingNo:4});");
 assert.equal(await h.run("voyPickEmbarkedDesign('save:corvette')"),true);
 const row=h.plain(h.run('sh.air[1]'));
 assert.equal(row.design.ref,'save:corvette');assert.deepEqual(row.design.blueprint,{name:'save:corvette'});
 assert.equal(row.n,1);assert.equal(row.groupNo,3);assert.equal(row.wingNo,4);assert.equal(h.run('saves'),1);
});

test('changing a squadron design retains its size and hierarchy; choosing a stock type removes the snapshot',async()=>{
 const h=harness();h.run("sh.air.push({craft:'tie_ln',n:5,groupNo:2,wingNo:7,load:[1]});");
 await h.run("eventListeners.change({target:{dataset:{sq:'0',sqk:'craft'},value:'dsn:save:corvette',closest:()=>true}})");
 assert.equal(h.run('sh.air[0].n'),5);assert.equal(h.run('sh.air[0].groupNo'),2);assert.equal(h.run('sh.air[0].wingNo'),7);assert.equal(h.run('sh.air[0].load'),undefined);
 await h.run("eventListeners.change({target:{dataset:{sq:'0',sqk:'craft'},value:'tie_ln',closest:()=>true}})");
 assert.equal(h.run('sh.air[0].craft'),'tie_ln');assert.equal(h.run('sh.air[0].design'),undefined);
});

test('deleted sources disappear from the refreshed catalog while an embarked snapshot remains available',async()=>{
 const h=harness();await h.run("voyPickEmbarkedDesign('save:corvette')");
 h.run("records=records.filter(r=>r.id!=='corvette');");await h.run('voyRefreshEmbarkedSources(true)');
 const html=h.run('voyEmbarkedDesignOptions(sh.air[0])');
 assert.doesNotMatch(html,/dsn:save:corvette/);assert.match(html,/編成時の設計/);assert.match(html,/value="custom-save:corvette" selected/);
 assert.equal(await h.run("voyPickEmbarkedDesign('save:corvette')"),false);assert.equal(h.run('sh.air.length'),1);
});

test('an asynchronous selection cannot alter a removed row or another editing session',async()=>{
 const h=harness();h.run("sh.air.push({craft:'tie_ln',n:5});assetJob=new Promise(resolve=>globalThis.finishAsset=resolve);");
 const pending=h.run("voyPickEmbarkedDesign('current',sh.air[0])");
 h.run("sh.air.splice(0,1);finishAsset({design:{name:'Late design'},stats:{}});");
 assert.equal(await pending,false);assert.equal(h.run('sh.air.length'),0);assert.equal(h.run('saves'),0);
});

test('same numbered wings in different groups render separately with hatch and hangar failures visible',()=>{
 const h=harness();h.run("sh.air=[{craft:'tie_ln',n:12,groupNo:1,wingNo:1},{craft:'tie_ln',n:2,groupNo:2,wingNo:1}];");
 const html=h.run('voySquadronsHTML(sh.air,{wings:[{tooLarge:true},{embarked:2,undeployable:2}]})');
 assert.match(html,/第1飛行団/);assert.match(html,/第2飛行団/);assert.equal((html.match(/第1飛行隊/g)||[]).length,2);
 assert.match(html,/data-sqk="groupNo"/);assert.match(html,/入る格納区画なし/);assert.match(html,/発艦不可/);
});

test('changing hierarchy clamps and persists group and wing numbers independently',async()=>{
 const h=harness();h.run("sh.air=[{craft:'tie_ln',n:12,groupNo:1,wingNo:1}];");
 await h.run("eventListeners.change({target:{dataset:{sq:'0',sqk:'groupNo'},value:'999',closest:()=>true}})");
 await h.run("eventListeners.change({target:{dataset:{sq:'0',sqk:'wingNo'},value:'3',closest:()=>true}})");
 assert.equal(h.run('sh.air[0].groupNo'),99);assert.equal(h.run('sh.air[0].wingNo'),3);assert.equal(h.run('saves'),2);
});


test('reselecting the current snapshot cancels a pending replacement design',async()=>{
 const h=harness();await h.run("voyPickEmbarkedDesign('save:corvette')");
 h.run("assetJob=new Promise(resolve=>globalThis.finishAsset=resolve);");
 const pending=h.run("voyPickEmbarkedDesign('current',sh.air[0])");
 await h.run("eventListeners.change({target:{dataset:{sq:'0',sqk:'craft'},value:sh.air[0].craft,closest:()=>true}})");
 h.run("finishAsset({design:{name:'Unwanted replacement'},stats:{}});");
 assert.equal(await pending,false);assert.equal(h.run('sh.air[0].design.name'),'save:corvette');
});
