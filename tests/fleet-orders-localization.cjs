const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),context=vm.createContext({console,navigator:{language:'en-US'}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/lang-en.js','js/i18n.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const run=code=>vm.runInContext(code,context),jp=/[\u3040-\u30ff\u3400-\u9fff]/;
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);run(app.slice(a,b));}
function translated(source){const out=context.KSI18n.t(source);assert.doesNotMatch(out,jp,source+' => '+out);return out;}
function translatedHTML(html){for(const text of html.split(/<[^>]*>/))if(text.trim())translated(text);for(const m of html.matchAll(/(?:aria-label|title|placeholder)="([^"]*)"/g))translated(m[1]);}
run(`const C=Core,R=Rts,num=v=>String(v),esc=String,ja=String,rgb=v=>v.join(','),fLen=v=>v+' m',fMass=v=>v+' t',fW=v=>v+' W',fTT=v=>v+' TT',fG=v=>v+' G',fPct=v=>v+'%',fCr=v=>v+' cr';
 const radar=()=>'',bar=()=>'',inspectionHTML=()=>'',craftCombatHTML=()=>'',craftSystemsHTML=()=>'',bandRatesHTML=()=>'',skinFacesHTML=()=>'';
 const voySquadTypeOptions=()=>'<option>X-wing</option>',voySqLoadHTML=()=>'',voyCraftPriceHTML=()=>'',voySquadFitHTML=()=>'';
 const voy={sel:{wing:'wing-a'},cmd:null,tac:{sys:0},w:{units:new Map(),groups:new Map([['ga',{id:'ga',side:0,sys:0,units:[],order:{type:'auto'},formation:'line'}],['gb',{id:'gb',side:0,sys:0,units:[],order:{type:'auto'},formation:'wedge'}]])}};
 const voyShipsTotals=()=>({people:0}),voyFleetCost=()=>({total:0}),voyDisplayName=x=>x.name||'',voyTgHTML=()=>'',voyFormStore=()=>[],voyCtgGroups=c=>c.tgs.map(id=>voy.w.groups.get(id)),voyGroupIn=(g,sys)=>g.sys===sys,voyTgRow=()=>'<li>Task Force</li>',voyDisabledHTML=()=>'',voyOrderButtons=()=>'',voyCommon=(a,fn)=>a.length?fn(a[0]):null,voyFormHTML=()=>'',voyPowerAimHTML=()=>'',voySensHTML=()=>'',voyTractorHTML=()=>'';
 const ship=C.newShip({L:80,W:40,H:20,plan:'rect',sec:'rect'},'Tracking capacity');ship.parts=[];ship.fits=[];
 const before=C.computeStats(ship);ship.parts.push({id:1,k:'sensor',c:[40,11,0],d:2,label:'Tracking sensor'});const after=C.computeStats(ship),profile=C.fleetProfile(after,ship.name,ship);
`);
section('function designAccelerationG(', '// v22 Store stations');

test('the actual design statistics show the same simultaneous engagement capacity used by combat',()=>{
 assert.ok(run('after.aaChannels>before.aaChannels'),'installed tracking equipment must increase the displayed capacity');
 assert.equal(run('profile.aaCh'),run('after.aaChannels'));
 for(const key of ['before','after']){const html=run(`specHTML(${key})`);assert.equal((html.match(/data-aa-capacity/g)||[]).length,1);assert.match(html,new RegExp('<dd>'+run(key+'.aaChannels')+' 枠'));
  const row=html.match(/<div data-aa-capacity>[\s\S]*?<\/div>/);assert.ok(row);translatedHTML(row[0]);
 }
 assert.match(translated('同時交戦数（対空・迎撃）'),/Simultaneous/);assert.equal(translated('12 枠'),'12 Slots');
 assert.match(translated('航空機4機の小隊、またはミサイル8発の斉射で1枠'),/4 craft.*8 missiles/);
});

test('design performance distinguishes planned maximum from the selected operating acceleration',()=>{
 run('const planningStats={...after,propulsion:{accelerationLimitMps2:3700*C.G0},accelG:1295};');
 const html=run('specHTML(planningStats)'),row=html.match(/<div><dt>計画最大加速<\/dt>[\s\S]*?<\/div>/);assert.ok(row);assert.match(row[0],/3700 G/);assert.match(row[0],/実加速 1295 G/);assert.doesNotMatch(row[0],/MGLT/);translatedHTML(row[0]);
 assert.equal(run('designAccelerationG({...after,propulsion:{accelerationLimitMps2:0},accelG:1295})'),0);
});

test('squadron and wing copy controls retain hierarchy and translate their actual rendered labels',()=>{
 section('function voySquadronsHTML(', '// ---- the order of battle of one ship');
 const html=run('voySquadronsHTML([{craft:"xwing",n:12,groupNo:1,wingNo:1},{craft:"tie_ln",n:6,groupNo:1,wingNo:1},{craft:"xwing",n:4,groupNo:2,wingNo:1}],null)');
 assert.equal((html.match(/data-sqcopy=/g)||[]).length,3);assert.equal((html.match(/data-wingcopy=/g)||[]).length,2);assert.match(html,/data-wingcopy="1:1"/);assert.match(html,/data-wingcopy="2:1"/);translatedHTML(html);
 assert.equal(translated('中隊をコピー'),'Copy Squadron');assert.equal(translated('飛行隊をコピー'),'Copy Air Wing');
});

test('copy limits and guidance distinguish costs, hangar capacity and the selected air wing mission',()=>{
 for(const source of ['中隊は400個までです','この飛行団には空いている飛行隊番号がありません','コピーする中隊がありません','この飛行隊の任務'])translated(source);
 const note=app.match(/<p class="note">(中隊や飛行隊をコピーすると、[^<]+)<\/p>/);assert.ok(note,'rendered copy guidance');
 assert.match(translated(note[1]),/Copies also count toward hangar capacity and cost/);
 const legacy=run('R.fleetGroundRows({troops:144})');assert.equal(legacy.length,1);assert.equal(translated(legacy[0].name),'Infantry Unit');
});

test('every battle wing exposes its own translated mission controls and pressed mission state',()=>{
 section('function voyWingMissionButtons(', 'function voySetWingMission(');
 const html=run('voyWingMissionButtons({id:"wing-a",order:{type:"cap"}})');translatedHTML(html);
 for(const type of ['auto','standby','strike','cap','escort'])assert.match(html,new RegExp('data-vwingid="wing-a" data-vwingorder="'+type+'"'));
 assert.match(html,/data-vwingorder="cap" aria-pressed="true"/);assert.equal((html.match(/aria-pressed="true"/g)||[]).length,1);
 assert.equal(run('voyWingMissionButtons({id:"wing-b",raid:{phase:"strike"},order:{type:"strike"}})'),'', 'inter-system raid controls retain their existing command path');
});

test('setup and battle CTG formation controls translate separately from internal task-force formations',()=>{
 section('function voyCtgHTML(', 'function voyTgHTML(');section('function voyCtgTacCard(', 'function voyShipCard(');
 const setup=run('voyCtgHTML({}, {}, {id:"ctg",name:"Combined",formation:"wedge",tgs:[{id:"ga",ships:[]},{id:"gb",ships:[]}]})'),battle=run('voyCtgTacCard({id:"ctg",name:"Combined",formation:"wedge",tgs:["ga","gb"]})');
 translatedHTML(setup);translatedHTML(battle);assert.match(setup,/data-obctgform/);assert.match(battle,/data-vctgform="independent"/);
 for(const key of Object.keys(run('R.FORMATIONS'))){assert.match(setup,new RegExp('<option value="'+key+'"'));assert.match(battle,new RegExp('data-vctgform="'+key+'"'));}
 assert.match(battle,/各任務群の内部陣形/);assert.match(battle,/個別に命令した任務群・艦は、その命令を優先します/);
 assert.equal(run('voy.w.groups.get("ga").formation'),'line');assert.equal(run('voy.w.groups.get("gb").formation'),'wedge');
});
