const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),cx=vm.createContext({navigator:{language:'en-US'}});
for(const f of ['js/lang-en.js','js/i18n.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const run=s=>vm.runInContext(s,cx),order=app.match(/^const VOY_ORDER = .*;$/m);assert.ok(order);run(order[0]);
function section(a,b){const start=app.indexOf(a),end=app.indexOf(b,start);assert.ok(start>=0&&end>start,a);run(app.slice(start,end));}
section('function voyStateName(','function voyRenderSide(');
section('function voySpectateWhereHTML(','// ---------- penetration records');
const htmlSetter=app.match(/^function setHTML\(.*$/m);assert.ok(htmlSetter);run(htmlSetter[0]);
run(`const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const voy={w:{units:new Map([['target',{name:'Target'}]]),groups:new Map(),squads:new Map(),wings:new Map(),battles:new Map(),sides:[{faction:'republic'}],sector:{systems:[{name:'Test System'}]},time:0},speed:1};
 const u={id:'own',name:'自作艦',side:0,sys:0,group:'g',order:{type:'move'},shield:100,shieldMax:100};voy.w.units.set(u.id,u);
 function state(type,extra={},html=false){u.order={type,...extra};return voyUnitState(u,html);}
 const R={FACTIONS:{republic:{short:'共和国'}},systemUnits:()=>[u],fighting:()=>true},crewShare=()=>null,crewPct=()=>0,voySwBrief=()=>'',voyClock=String,voySpectateHyperText=()=>null,voyWingStateText=()=>"Patrol";
 const sourceText=el=>KSI18n.sourceText(el),trial={battle:{spectate:true,follow:'own',ticker:[]},rts:{w:voy.w,sys:0}};
`);

// Minimal DOM nodes exercise the real localizer's translate=no and source-text
// restoration. The state markup comes from the actual app functions above.
const decode=s=>s.replace(/&(amp|lt|gt|quot|#39);/g,(_,k)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}[k]));
function element(tag='div',attrs={}){
 const e={nodeType:1,tagName:tag.toUpperCase(),childNodes:[],parentElement:null,attrs:{...attrs},
  getAttribute(k){return Object.hasOwn(this.attrs,k)?this.attrs[k]:null;},setAttribute(k,v){this.attrs[k]=String(v);},
  closest(selector){for(let p=this;p;p=p.parentElement)if(selector==='textarea'?p.tagName==='TEXTAREA':p.attrs?.translate==='no'||Object.hasOwn(p.attrs||{},'data-l10n-skip'))return p;return null;},
  querySelectorAll(){return [];},get textContent(){return this.childNodes.map(n=>n.nodeType===3?n.nodeValue:n.textContent).join('');},
  set textContent(value){this.childNodes=[{nodeType:3,nodeValue:String(value),parentElement:this}];},
  set innerHTML(html){this.sourceHTML=String(html);this.childNodes=[];let last=0;const put=value=>{if(value)this.childNodes.push({nodeType:3,nodeValue:decode(value),parentElement:this});};for(const m of String(html).matchAll(/<span translate="no" data-unit-state-name>([\s\S]*?)<\/span>/g)){put(String(html).slice(last,m.index));const span=element('span',{translate:'no','data-unit-state-name':''});span.parentElement=this;span.textContent=decode(m[1]);this.childNodes.push(span);last=m.index+m[0].length;}put(String(html).slice(last));}
 };return e;
}
function localizeHTML(html){const e=element();e.innerHTML=html;cx.KSI18n.localize(e);return e;}
const where=element(),hud={querySelector:s=>s==='[data-sp="where"]'?where:null,querySelectorAll:()=>[]};cx.testHud=hud;run('const $=s=>s==="#trialHud"?testHud:null;');
const t=s=>cx.KSI18n.t(s);

test('actual individual orders translate movement, waiting and course labels in the battle state',()=>{
 assert.equal(t(run('state("move")')),'Individual: Move');
 assert.equal(t(run('state("hold")')),'Individual: Standby');
 assert.equal(t(run('state("course",{hdg:Math.PI/2})')),'Individual: Course 90°');
});

const names=['夕凪','移動','攻撃','Aquila','攻撃：移動','Alpha · 移動','移動 · 牽引中','夕凪 · 拿捕へ接近','Alpha · 拿捕中 37%','<移動> & "護衛"'];
test('actual state HTML protects arbitrary target names without inferring names from status suffixes',()=>{
 for(const name of names)for(const [kind,label]of [['attack','Attack'],['escort','Escort']]){
  cx.targetName=name;run('voy.w.units.get("target").name=targetName;u.tractor=null');
  const html=run(`state(${JSON.stringify(kind)},{target:"target"},true)`),before=run('JSON.stringify([...voy.w.units])'),el=localizeHTML(html);
  assert.equal(el.textContent,`Individual: ${label}: ${name}`);assert.equal(el.childNodes.find(n=>n.nodeType===1)?.textContent,name);assert.equal(run('JSON.stringify([...voy.w.units])'),before);
 }
 assert.doesNotMatch(app,/esc\(voyUnitState\(/,'all actual state-card callers must retain structured names');
});

test('real own tractor status stays outside the protected target name',()=>{
 for(const name of names){cx.targetName=name;run('voy.w.units.get("target").name=targetName;u.tractor={mode:"tow",lock:true}');
  assert.equal(localizeHTML(run('state("escort",{target:"target"},true)')).textContent,`Individual: Escort: ${name} · Towing`);
  run('u.tractor={mode:"capture",lock:true,progress:.37}');
  assert.equal(localizeHTML(run('state("attack",{target:"target"},true)')).textContent,`Individual: Attack: ${name} · Boarding 37%`);
 }run('u.tractor=null');
});

test('the actual spectator HUD setter retains structured names rather than flattening them into text',()=>{
 for(const name of names){cx.targetName=name;run('voy.w.units.get("target").name=targetName;u.tractor=null;state("attack",{target:"target"});voySpectateHudUpdate(true)');cx.KSI18n.localize(where);
  assert.ok(where.sourceHTML.includes('data-unit-state-name'));assert.equal(where.childNodes.find(n=>n.nodeType===1)?.textContent,name);assert.equal(where.textContent,`Republic · Individual: Attack: ${name} · Shields 100%`);
 }
});

test('spectator ship-aircraft-ship switching invalidates the HTML cache before restoring the same ship state',()=>{
 run('voy.w.units.get("target").name="移動 · 牽引中";u.tractor=null;state("attack",{target:"target"});voySpectateHudUpdate(true)');cx.KSI18n.localize(where);const shipText=where.textContent;
 assert.ok(where.childNodes.some(n=>n.nodeType===1));
 run('R.CRAFT={fixture:{short:"Fixture Craft"}};voy.w.wings.set("airwing",{name:"Air Wing"});voy.w.squads.set("squad",{side:0,wing:"airwing",craft:"fixture",n:1,n0:1,name:"Squad"});trial.battle.followSq="squad";voySpectateHudUpdate(true)');cx.KSI18n.localize(where);
 assert.match(where.textContent,/Fixture Craft/);assert.equal(where.childNodes.filter(n=>n.nodeType===1).length,0);
 run('trial.battle.followSq=null;voySpectateHudUpdate(true)');cx.KSI18n.localize(where);
 assert.equal(where.textContent,shipText);assert.equal(where.childNodes.find(n=>n.nodeType===1)?.textContent,'移動 · 牽引中');
});

test('language switching restores the same structured source and leaves user data unchanged',()=>{
 run('voy.w.units.get("target").name="移動 · 牽引中";u.tractor=null');const source=run('state("attack",{target:"target"},true)'),before=run('JSON.stringify({u,targets:[...voy.w.units]})'),el=localizeHTML(source);
 assert.equal(el.textContent,'Individual: Attack: 移動 · 牽引中');
 cx.KSI18n.setLanguage('ja');cx.KSI18n.localize(el);assert.equal(el.textContent,'個別：攻撃：移動 · 牽引中');
 cx.KSI18n.setLanguage('en');cx.KSI18n.localize(el);assert.equal(el.textContent,'Individual: Attack: 移動 · 牽引中');
 assert.equal(run('JSON.stringify({u,targets:[...voy.w.units]})'),before);assert.equal(run('voyUnitState(u)'),'個別：攻撃：移動 · 牽引中');
});

test('actual itinerary and saved-stop UI translate the immediate stop separately from the final destination',()=>{
 section('function navigationPlanHTML(','function gmLegendHTML(');section('function navigationStateHTML(','// ---- operational map ----');section('function voyTgStatus(','function voyTgRow(');
 run(`const navPlan={next:'stop',final:'final',segments:[{},{},{}],stops:['stop','middle','final']},navNames={stop:'Stop System',middle:'Middle System',final:'Final System'};`);
 const translatedHTML=html=>html.split(/<[^>]*>/).filter(s=>s.trim()).map(t).join(' ');
 const plan=run('navigationPlanHTML(navPlan,id=>navNames[id])'),saved=run('navigationStateHTML({final:"final",stop:"stop",waiting:true},id=>navNames[id])');
 for(const html of [plan,saved]){assert.match(html,/data-final-destination="final"/);const text=translatedHTML(html);assert.doesNotMatch(text,/[\u3040-\u30ff\u3400-\u9fff]/);assert.ok(text.includes('Final System'));assert.ok(text.includes('Stop System'));}
 assert.match(translatedHTML(plan),/3 Segments Remaining/);assert.match(translatedHTML(plan),/Mandatory Stops/);assert.match(translatedHTML(saved),/Awaiting Next Jump Order/);
 assert.equal(run('navigationPlanHTML(null,()=>"")'),'');
 const main=translatedHTML(run('navigationPlanHTML({...navPlan,segments:[{}]},id=>navNames[id])'));assert.match(main,/no intermediate stop/);
 run('voy.w.sector.systems[0].name="Stop System"');assert.equal(t(run('voyTgStatus({sys:0,navigation:{waiting:true}})')),'Stop System · Mandatory Stop · Awaiting Next Jump Order');
 assert.equal(t('Start → Stop（2 区間・支線 1） · 必須停止：Stop'),'Start → Stop (2 legs, 1 hyperlanes) · Mandatory Stops: Stop');
 const core=fs.readFileSync(path.join(root,'js/core.js'),'utf8'),raid=core.match(/why:'(途中の必須停止[^']+)'/),arrival=app.match(/msLog\(st,'(必須停止星系に到着[^']+)'/);assert.ok(raid);assert.ok(arrival);
 assert.doesNotMatch(t(raid[1]),/[\u3040-\u30ff\u3400-\u9fff]/);assert.doesNotMatch(t(arrival[1]),/[\u3040-\u30ff\u3400-\u9fff]/);
});

test('the actual strategic sortie button translates restored intermediate stops and final destinations with real formatted durations',()=>{
 section('function navigationPlanHTML(','function gmLegendHTML(');section('function msDur(','function msClock(');section('function msBattlePanel(','function msWait(');
 run(`let sortieIntermediate=true,sortieSeconds=7140;
 const msUI={foe:'f',pick:{}},msFoeInfo=()=>({n:1,caps:0,str:1}),msFoeName=()=>"Enemy Fleet",msSeg=String,msSysName=id=>({start:'Start System',stop:'Stop System',final:'Final System'}[id]||id);
 const voyObTgs=ob=>ob.tgs,msReadyShips=t=>t.ships,msSortieTgs=st=>st.ob.tgs,msSortieEta=()=>sortieSeconds,voyShipsStrength=()=>1,gmSysCardHTML=()=>'',msHereHTML=()=>'',msAt=()=>"start",msJumpSeconds=()=>sortieSeconds,msHyper=()=>2,VOY_SHIP_CAP=150;
 const msSortiePlan=()=>({next:sortieIntermediate?'stop':'final',final:'final',segments:sortieIntermediate?[{},{}]:[{}],stops:sortieIntermediate?['stop','final']:['final']}),sortieState={t:0,foes:[{id:'f',sys:'final',t0:0,until:300000}],ob:{tgs:[{id:'tg',name:'QA Group',ships:[{id:'ship'}]}]}};
 `);
 const before=run('JSON.stringify(sortieState)');
 for(const intermediate of [true,false])for(const seconds of [0,30,1800,7140,216000]){
  run(`sortieIntermediate=${intermediate};sortieSeconds=${seconds}`);const html=run('msBattlePanel(sortieState)'),button=html.match(/<button\b[^>]*data-msn="go"[^>]*>([\s\S]*?)<\/button>/);assert.ok(button,'real strategic go button');
  const prefix=intermediate?'Proceed to the Next Mandatory Stop':'Sail to Final System',duration=t(run('msDur(sortieSeconds)')),expected=prefix+(seconds?` (Current Segment: ${duration})`:'');
  assert.equal(t(button[1]),expected);assert.doesNotMatch(t(button[1]),/[\u3040-\u30ff\u3400-\u9fff]/);
 }
 assert.equal(run('JSON.stringify(sortieState)'),before,'rendering cannot advance a restored pending itinerary');
});
