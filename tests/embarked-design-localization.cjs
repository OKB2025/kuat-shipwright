const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({navigator:{language:'en-US'}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/lang-en.js','js/i18n.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),run=code=>vm.runInContext(code,context),jp=/[\u3040-\u30ff\u3400-\u9fff]/;
function translated(source){const out=context.KSI18n.t(source);assert.doesNotMatch(out,jp,source+' => '+out);return out;}
function translatedHTML(html){
 for(const text of html.split(/<[^>]*>/))if(text.trim())translated(text);
 for(const m of html.matchAll(/(?:label|title|aria-label)="([^"]*)"/g))translated(m[1]);
}
run(`const C=Core,R=Rts,esc=s=>String(s),num=s=>String(s),fCr=s=>s+' cr';
 const ship={name:'設計艦'},voy={saves:[{id:'my-save',name:'Xウイング'}],sel:{wing:'wing'}},voySqLoadHTML=()=>'',voyWingOrderText=()=> '待機';
`);
const a=app.indexOf('function voyEmbarkedSources()'),b=app.indexOf('// ---- the order of battle of one ship',a);
assert.ok(a>=0&&b>a);run(app.slice(a,b));

test('custom design and source labels translate without changing their stored names',()=>{
 const before=run('JSON.stringify({ship,saves:voy.saves})');
 translatedHTML(run('voyEmbarkedDesignOptions({craft:"xwing",design:{name:"Xウイング"}})'));
 translatedHTML(run('voySquadTypeOptions({craft:"xwing"})'));
 assert.equal(run('JSON.stringify({ship,saves:voy.saves})'),before);
 assert.equal(context.KSI18n.t('私の試作艇Ω（編成時の設計）'),'私の試作艇Ω (Assigned Design)');
 assert.equal(context.KSI18n.t('私の試作艇Ω（設計中）'),'私の試作艇Ω (Current Draft)');
 for(const source of ['設計を読み込み中…','設計した機体・小型艦を読み込めません'])translated(source);
});

test('air group, wing and squadron headings stay distinct and retain their numbers',()=>{
 for(const group of [1,3,99])for(const wing of [1,7,99]){
  assert.equal(context.KSI18n.t(`第${group}飛行団`),`Air Group ${group}`);
  assert.equal(context.KSI18n.t(`第${wing}飛行隊`),`Air Wing ${wing}`);
  assert.equal(context.KSI18n.t(`設計艦 第${group}飛行団 第${wing}飛行隊`),`Custom Ship Air Group ${group} / Air Wing ${wing}`);
 }
 assert.equal(context.KSI18n.t('飛行団'),'Air Group');
 assert.equal(context.KSI18n.t('第1合同任務群飛行団'),'CTF-1 Air Group');
 assert.equal(context.KSI18n.t('第12戦闘中隊'),'Fighter Squadron 12');
 translatedHTML(run('voySquadronsHTML([{craft:"xwing",n:12,groupNo:3,wingNo:7},{craft:"tie_ln",n:6,groupNo:4,wingNo:2}],null)'));
});

test('actual assignment guidance explains snapshots, hierarchy and hangar limits in English',()=>{
 const notes=Array.from(app.matchAll(/<p class="note">([^<`\n]+)<\/p>/g),m=>m[1]).filter(text=>/^(飛行団 →|「設計した機体・小型艦」から|格納区画に入っても、出入口)/.test(text));
 assert.equal(notes.length,3,'all three assignment guidance paragraphs are tested');
 const outputs=notes.map(translated);
 assert.match(outputs[0],/air groups, wings, and squadrons/i);
 assert.match(outputs[1],/editing or deleting the source design does not change/i);
 assert.match(outputs[2],/fit through the hangar hatch/i);
});


test('battle lists translate the parent air group, nested wing and its squadrons together',()=>{
 const html=run(`(()=>{
  const squad={id:'sq',name:'第1戦闘中隊',n:4,n0:12,state:'out'};
  const wing={id:'wing',name:'設計艦 第3飛行団 第7飛行隊',home:'carrier',groupNo:3,no:7,phase:'docked',squads:['sq']};
  const world={units:new Map([['carrier',{name:'設計艦'}]]),squads:new Map([['sq',squad]])};
  return voyBattleWingListHTML([wing],world);
 })()`);
 translatedHTML(html);
 assert.match(html,/第3飛行団/);assert.match(html,/第7飛行隊/);assert.match(html,/第1戦闘中隊/);
});
