const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const {C,R,D}=vm.runInContext('({C:Core,R:Rts,D:YardFleetData.designs})',cx),plain=x=>JSON.parse(JSON.stringify(x));
function source(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return app.slice(a,b);}
function setup(){const c=vm.createContext({console,C,R});vm.runInContext(`
 const esc=String,num=String,fCr=String,sh={air:[]},messages=[],listeners={},panel={addEventListener:(k,f)=>listeners[k]=f};let sheets=0,saves=0,sides=0;
 const voy={setup:{editing:'carrier'},screen:'setup',sel:{wing:null},cmd:null,w:null},fleet={assets:new Map()},Store={list:async()=>[]};let ship=null;
 const $=()=>panel,voyFindShip=id=>id==='carrier'?{sh}:null,voyOrbatSheet=()=>sheets++,voyObChanged=()=>saves++,voyRenderSide=()=>sides++,toast=x=>messages.push(x),voySqLoadHTML=()=>'',voyWingOrderText=()=>'',voyWeakArc=()=>'bow',voyFoeName=u=>u.name;
 function click(data){const b={dataset:data,closest:()=>null};return listeners.click({target:{closest:s=>s==='button'?b:null},preventDefault:()=>{}});}
 function sideClick(data){const b={dataset:data};voySidebarClick({target:{closest:()=>b}});}
 `,c);for(const [a,b]of [['function voyEmbarkedSources()','// ---- the order of battle of one ship (air wing and embarked troops) ----'],['function voyBindSetup()','// ---------- starting a battle ----------'],['function voySidebarClick(e)','function voyCenterOps('],['function voyTapUnit(','function voyMapTap(']])vm.runInContext(source(a,b),c);vm.runInContext('voyBindSetup()',c);return code=>vm.runInContext(code,c);}
function world(air){const w=R.createWorld({mode:'test',region:'kuat',sensors:false,seed:11,designs:['mc80home','imperial'].map(k=>plain(D[k])),sides:[{faction:'rebel',ai:false},{faction:'empire',ai:false}],fleets:[[{design:'mc80home',air}],[{design:'imperial',air:[]}]]});const home=[...w.units.values()].find(u=>u.side===0),enemy=[...w.units.values()].find(u=>u.side===1);enemy.sys=home.sys;w.groups.get(enemy.group).sys=home.sys;return {w,home,enemy,wings:[...w.wings.values()].filter(x=>x.side===0)};}

test('the real squad copy button retains custom model, count and loadout as independent configuration',async()=>{
 const run=setup();run(`sh.air=[{id:'old-row',craft:'xwing',n:7,name:'Escort',groupNo:2,wingNo:4,load:[{k:'ptorp',n:3}],design:{name:'Player fighter',blueprint:{name:'Original'},craft:{cost:1234}}}];`);
 const before=plain(run('sh.air[0]'));await run("click({sqcopy:'0'})");const copy=plain(run('sh.air[1]'));
 assert.equal(copy.id,undefined);assert.equal(copy.name,'Escort（コピー）');for(const k of ['craft','n','groupNo','wingNo','load','design'])assert.deepEqual(copy[k],before[k],k);
 run("sh.air[1].load[0].n=1;sh.air[1].design.blueprint.name='Changed'");assert.deepEqual(plain(run('sh.air[0]')),before);assert.equal(run('saves'),1);assert.equal(run('sheets'),1);
 await run("click({sqcopy:'0'})");assert.equal(run('new Set(sh.air.map(q=>q.name)).size'),3);
});

test('a wing copy keeps its own group and copies every squad, with a free wing number and fresh runtime IDs',async()=>{
 const run=setup();run(`sh.air=[{craft:'xwing',n:3,name:'Lead',groupNo:1,wingNo:2,wingName:'Vanguard',load:[{k:'ptorp',n:2}]},{craft:'awing',n:4,name:'Second',groupNo:1,wingNo:2,wingName:'Vanguard'},{craft:'tie_ln',n:2,name:'Other group',groupNo:2,wingNo:2},{craft:'xwing',n:1,name:'Next wing',groupNo:1,wingNo:3}];`);
 await run("click({wingcopy:'1:2'})");const rows=plain(run('sh.air')),copies=rows.filter(q=>q.groupNo===1&&q.wingNo===4);
 assert.equal(rows.length,6);assert.equal(copies.length,2);assert.equal(copies[0].wingName,'Vanguard（コピー）');assert.deepEqual(copies[0].load,[{k:'ptorp',n:2}]);assert.equal(rows.filter(q=>q.groupNo===2).length,1);
 const {w,home,wings}=world(rows);assert.equal(wings.length,4);assert.equal(new Set(home.squads).size,6);assert.equal(w.squads.size,6);assert.ok(wings.some(x=>x.no===4&&x.groupNo===1));
 assert.equal(R.airTotals(rows).n,R.airTotals(rows.slice(0,2).concat(rows.slice(4))).n+7);
});

test('copy limits reject the whole operation without losing rows or overflowing normalized storage',()=>{
 const run=setup();run("sh.air=Array.from({length:400},(_,i)=>({craft:'xwing',n:1,name:'Squad '+i,groupNo:1,wingNo:1}))");assert.equal(run('voyCopySquad(sh,0).ok'),false);assert.equal(run('voyCopyWing(sh,1,1).ok'),false);assert.equal(run('sh.air.length'),400);
 run("sh.air=Array.from({length:99},(_,i)=>({craft:'xwing',n:1,groupNo:1,wingNo:i+1}))");assert.equal(run('voyCopyWing(sh,1,40).ok'),false);assert.equal(run('sh.air.length'),99);
 run("sh.air=[{craft:'xwing',n:1,groupNo:2,wingNo:99}]");assert.equal(run('voyCopyWing(sh,2,99).wingNo'),1);
});

test('copied developed craft keep one model identity through fleet JSON while cost and occupied space grow',()=>{
 const run=setup(),designShip=C.buildDesign('craft_xwing'),stats=C.computeStats(designShip),design=C.designCraftSnapshot(designShip,stats,'save:copy-fixture'),craft=R.registerDesignCraft(design),global=run('globalThis');
 global.row={craft,design,n:2,name:'Player model',groupNo:3,wingNo:5};run('sh.air=[row]');const before=plain(run('sh.air'));assert.equal(run('voyCopyWing(sh,3,5).ok'),true);
 const air=plain(run('sh.air')),fleet={ctgs:[{id:'c1',name:'Carrier group',tgs:[{id:'t1',name:'Carrier task group',formation:'abreast',ships:[{id:'h1',src:'mc80home',name:'Carrier',air}]}]}]},once=R.normalizeFleet(plain(fleet)),twice=R.normalizeFleet(plain(once)),out=twice.ctgs[0].tgs[0].ships[0].air;
 assert.equal(out.length,2);assert.equal(out[0].craft,craft);assert.equal(out[1].craft,craft);assert.deepEqual(plain(out[1].design.blueprint),plain(design.blueprint));
 const info={stow:{bays:[{d:[200,80,40],cap:1000,c:true,doors:[[100,50]]}]}},one=R.shipStow(info,before,[],[]),two=R.shipStow(info,out,[],[]);assert.equal(two.used,one.used*2);assert.equal(two.wings.reduce((n,q)=>n+q.deployable,0),4);
 const cost=rows=>R.fleetCost([{air:rows}],()=>({info:{cost:1000,crew:0}}));assert.equal(cost(out).air,cost(before).air*2);assert.equal(cost(out).total-cost(before).total,cost(before).air);
});

test('the rendered air editor exposes squad and whole-wing copy at the correct hierarchy level',()=>{
 const run=setup();run("sh.air=[{craft:'xwing',n:3,groupNo:1,wingNo:2},{craft:'awing',n:4,groupNo:1,wingNo:2},{craft:'tie_ln',n:2,groupNo:2,wingNo:2}]");const html=run('voySquadronsHTML(sh.air,null)');
 assert.equal((html.match(/data-sqcopy=/g)||[]).length,3);assert.equal((html.match(/data-wingcopy=/g)||[]).length,2);assert.match(html,/data-wingcopy="1:2"/);assert.match(html,/data-wingcopy="2:2"/);
});

test('a battle mission is applied to one selected wing and recall immediately clears its prior firing',()=>{
 const f=world([{craft:'xwing',n:2,groupNo:1,wingNo:1},{craft:'awing',n:2,groupNo:1,wingNo:2}]),[a,b]=f.wings,old=plain(b.order);
 assert.equal(R.orderWing(f.w,a.id,{type:'strike',target:f.enemy.id,approach:'stern'}),true);assert.deepEqual(plain(b.order),old);assert.equal(a.order.target,f.enemy.id);
 const s=f.w.squads.get(a.squads[0]);Object.assign(s,{state:'out',strafeT:100,runOn:f.enemy.id,dogfight:f.w.time,dfFoe:'enemy-squad'});a.attackRun={target:f.enemy.id};
 assert.equal(R.orderWing(f.w,a.id,{type:'standby'}),true);assert.equal(s.state,'return');for(const k of ['strafeT','runOn','dogfight','dfFoe'])assert.equal(s[k],null,k);assert.equal(a.attackRun,null);assert.deepEqual(plain(b.order),old);
});

test('invalid wing mission targets and nonfinite CAP cannot mutate an existing valid order',()=>{
 const f=world([{craft:'xwing',n:2}]),a=f.wings[0];assert.equal(R.orderWing(f.w,a.id,{type:'escort',target:f.home.id}),true);const before=plain(a.order);
 for(const o of [{type:'strike',target:'missing'},{type:'strike',target:f.home.id},{type:'escort',target:f.enemy.id},{type:'cap',point:[0,NaN,0]},{type:'cap',point:[0,0,0],radius:Infinity}]){assert.equal(R.orderWing(f.w,a.id,o),false);assert.deepEqual(plain(a.order),before);}
 const point=[300,0,500];assert.equal(R.orderWing(f.w,a.id,{type:'cap',point,radius:5000}),true);point[0]=999;assert.equal(a.order.point[0],300);
 f.enemy.sys=f.home.sys+1;assert.equal(R.orderWing(f.w,a.id,{type:'strike',target:f.enemy.id}),false);f.enemy.sys=f.home.sys;
 f.enemy.dead=true;assert.equal(R.orderWing(f.w,a.id,{type:'strike',target:f.enemy.id}),false);
});

test('the direct battle-list buttons select the intended wing for a mission without issuing one to its sibling',()=>{
 const run=setup(),f=world([{craft:'xwing',n:2,wingNo:1},{craft:'awing',n:2,wingNo:2}]),[a,b]=f.wings;
 const install=run('globalThis');install.f=f;run('voy.w=f.w');const html=run('voyBattleWingListHTML(f.wings,f.w)');assert.match(html,new RegExp('data-vwingid="'+b.id+'" data-vwingorder="strike"'));
 run(`sideClick({vwingid:${JSON.stringify(b.id)},vwingorder:'strike'})`);assert.equal(run('voy.sel.wing'),b.id);assert.equal(run('voy.cmd.type'),'strike');assert.equal(a.order.type,'auto');assert.equal(b.order.type,'auto');
 run('voyTapUnit(f.enemy)');assert.equal(b.order.type,'strike');assert.equal(b.order.target,f.enemy.id);assert.equal(a.order.type,'auto');assert.equal(run('voy.cmd'),null);
 run(`sideClick({vwingid:${JSON.stringify(b.id)},vwingorder:'standby'})`);assert.equal(b.order.type,'standby');assert.equal(a.order.type,'auto');assert.equal(run('voy.cmd'),null);
 f.w.sides[0].ai=true;run(`sideClick({vwingid:${JSON.stringify(a.id)},vwingorder:'strike'})`);assert.equal(run('voy.sel.wing'),b.id);assert.equal(run('voy.cmd'),null);
});
