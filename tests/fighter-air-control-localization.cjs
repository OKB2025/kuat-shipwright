const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),context=vm.createContext({console,navigator:{language:'en-US'}}),jp=/[\u3040-\u30ff\u3400-\u9fff]/;
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/lang-en.js','js/i18n.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const run=code=>vm.runInContext(code,context);
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);run(app.slice(a,b));}
function translated(source){const out=context.KSI18n.t(source);assert.doesNotMatch(out,jp,source+' => '+out);return out;}
function translatedHTML(html){for(const text of html.split(/<[^>]*>/))if(text.trim())translated(text);for(const m of html.matchAll(/(?:aria-label|title)="([^"]*)"/g))translated(m[1]);}
run(`const R=Rts,esc=String,voy={sel:{wing:'one',sys:null},cmd:null,w:null};
 const VOY_RAID_PHASE={back:'ハイパースペースで帰還中'},voySelGroup=()=>null,voySelCtg=()=>null,voyForceTree=()=>'';
 function fixture(){
  const wing={id:'one',name:'Blue Wing',side:0,home:'home',squads:['a','b','c','dead'],order:{type:'auto'},phase:'return',groupNo:1,no:1};
  const w={time:100,units:new Map([['home',{id:'home',name:'Home Carrier',side:0,sys:null}]]),groups:new Map(),wings:new Map([['one',wing],['foe',{id:'foe',name:'Enemy Bombers'}],['strike',{id:'strike',name:'Gold Wing'}]]),squads:new Map(),sector:{systems:[{id:0,name:'Kuat'},{id:1,name:'Corellia'}]}};
  w.squads.set('a',{id:'a',name:'Blue One',n:4,n0:4,state:'return',follow:{phase:'spool',from:0,dest:1}});
  w.squads.set('b',{id:'b',name:'Blue Two',n:3,n0:6,state:'follow',follow:{phase:'back',from:0,dest:1,t1:160}});
  w.squads.set('c',{id:'c',name:'Blue Three',n:2,n0:2,state:'follow',follow:{phase:'wait',from:0,dest:1}});
  w.squads.set('dead',{id:'dead',name:'Blue Four',n:0,n0:4,state:'lost',follow:{phase:'back',from:0,dest:1,t1:900}});
  voy.w=w;return wing;
 }
`);
section('function voyClock(', '\n// ---- tactical map');
section('function voyWingOrderText(', '\n// ---------- input ----------');
section('function voyBattleWingListHTML(', 'function voySetWingMission(');
section('function voyOpsSide(', 'function voyTgOpsCard(');

test('automatic mission labels show interception, superiority, strike escort and anti-ship attack',()=>{
 run('fixture()');
 const cases=[
  ['{type:"cap",airMission:"intercept",airTarget:"foe"}',/Intercept Enemy Bombers/],
  ['{type:"cap",airMission:"intercept",airTarget:"gone"}',/Intercept Enemy Attack Wing/],
  ['{type:"cap",airMission:"superiority"}',/Air Superiority/],
  ['{type:"escort",escortWing:"strike"}',/Escort Gold Wing/],
  ['{type:"escort",escortWing:"gone"}',/Escort Friendly Attack Wing/],
  ['{type:"strike",target:"home"}',/Attack Home Carrier/],
  ['{type:"escort",waiting:true}',/Awaiting an Attack Opportunity/],
  ['null',/Cover Carrier/]
 ];
 for(const [auto,expected]of cases){const text=run(`(()=>{const x=voy.w.wings.get('one');x.auto=${auto};return voyWingOrderText(x);})()`);assert.match(translated(text),expected);}
});

test('explicit missions take precedence over automatic mission descriptions',()=>{
 run('fixture();voy.w.wings.get("one").auto={type:"cap",airMission:"intercept",airTarget:"foe"}');
 for(const [order,expected]of [['{type:"standby"}',/Standby/],['{type:"cap"}',/Air Superiority/],['{type:"escort",target:"home"}',/Home Carrier/],['{type:"strike",target:"home",approach:"bow"}',/Home Carrier/]]){
  const text=run(`(()=>{const x=voy.w.wings.get('one');x.order=${order};return voyWingOrderText(x);})()`);assert.doesNotMatch(text,/自動/);assert.match(translated(text),expected);
 }
});

test('mixed self-withdrawal states display surviving craft, destination and the longest actual travel time',()=>{
 run('fixture()');const text=run('voyWingFollowText(voy.w.wings.get("one"))'),out=translated(text);
 assert.equal(translated(run('voyWingStateText(voy.w.wings.get("one"))')),'Following Carrier');
 assert.match(text,/自力離脱 9 機/);assert.match(out,/9 craft to Corellia/);assert.match(out,/Preparing to Jump/);assert.match(out,/1:00/);assert.match(out,/Waiting for Carrier/);assert.doesNotMatch(out,/13:20/);
 run('for(const s of voy.w.squads.values())s.follow=null');assert.equal(run('voyWingFollowText(voy.w.wings.get("one"))'),'');assert.equal(run('voyWingStateText(voy.w.wings.get("one"))'),run('R.WING_PHASE.return'));
 run('voy.w.squads.get("a").follow={phase:"wait",dest:99}');assert.match(translated(run('voyWingFollowText(voy.w.wings.get("one"))')),/Following Carrier/);
});

test('battle and operations lists keep self-withdrawal status visible while preserving wing orders',()=>{
 run('fixture();voy.w.wings.get("one").order={type:"standby"}');
 const list=run('voyBattleWingListHTML([voy.w.wings.get("one")],voy.w)'),ops=run('voyOpsSide()');
 assert.match(list,/自力離脱 9 機/);assert.match(list,/data-vwingorder="standby" aria-pressed="true"/);translatedHTML(list);
 assert.match(ops,/data-vfollow/);assert.match(ops,/母艦を追う航空機/);assert.match(ops,/自力離脱 9 機/);translatedHTML(ops);
 assert.equal(run('voy.w.wings.get("one").order.type'),'standby');
});

test('self-withdrawal events and tutorial explain equipped and unequipped craft separately',()=>{
 for(const [source,expected]of [
  ['Blue One：自機のハイパードライブで母艦に続いて離脱',/own hyperdrives/],
  ['Blue One がハイパースペースへ（母艦追従・Corelliaまで 2 分）',/2 min to Corellia/],
  ['Blue One が Home Carrier のもとに自力帰還（着艦）',/Home Carrier/],
  ['Blue One（離脱隊）',/Withdrawal Flight/],
  ['Blue Wing 自力離脱 4 機',/4 craft withdrawing independently/]
 ])assert.match(translated(source),expected);
 const text=app.match(/\{title: '飛行隊', text: '([^']+)'/);assert.ok(text);translatedHTML(text[1]);
 const out=translated(text[1]);assert.match(out,/hyperdrives follow a withdrawing carrier/);assert.match(out,/Recall craft without hyperdrives/);assert.match(out,/interception, air superiority, strike escort, or anti-ship attack/);
});
