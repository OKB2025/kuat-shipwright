const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),context=vm.createContext({navigator:{language:'en-US'}}),run=s=>vm.runInContext(s,context);
for(const file of ['js/lang-en.js','js/i18n.js'])run(fs.readFileSync(path.join(root,file),'utf8'));
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);run(app.slice(a,b));}
run(`const st={part:'struct',structWing:{thermal:'high'}},ship={parts:[]};
const esc=String,num=String,deg=v=>v+'°',fW=v=>v+' W',fMass=v=>v+' t',fPct=v=>(v*100)+'%',fmtM=v=>v+' m';
const activeEquipment=()=>null,wingFigures=()=>figures,foilPivotControls=()=>'',foilDiagramSVG=()=>'';
const FOIL_AXIS_ROWS=[['x','前後軸（X）']];let figures=null;
`);
section('function seg(', 'function silhouette(');
section('function wingPresetCard(', 'function selectWingPreset(');
section('function wingControls(', 'function sensorBandControls(');
const jp=/[\u3040-\u30ff\u3400-\u9fff]/;
function translated(s){const out=context.KSI18n.t(s);assert.doesNotMatch(out,jp,s+' => '+out);return out;}
function htmlTranslated(html){for(const text of html.split(/<[^>]*>/))if(text.trim())translated(text);for(const m of html.matchAll(/(?:title|aria-label)="([^"]*)"/g))translated(m[1]);}

test('actual direct-wing palette and every wing mode translate in English',()=>{
 htmlTranslated(run('wingPresetCard()'));
 for(const wing of [undefined,{thermal:'high',feed:1,reinf:0},{thermal:'low',feed:1,reinf:0},{thermal:'high',solar:true,feed:1,reinf:0},{thermal:'high',foil:true,axis:'x',stow:0,open:15,T:1,feed:1,reinf:0}]){
  context.wing=wing;
  run(`figures={parts:[],capOpen:125000,capStow:40000,mass:.064,feedMass:.001,reinfMass:0,act:.002,jamAt:.5,solarP:5000,area:6,hits:[]};`);
  const html=run(`wingControls({k:'struct',form:'box',wing})`);htmlTranslated(html);
  assert.doesNotMatch(context.KSI18n.t(html.replace(/<[^>]*>/g,' ')),/wing itself dissipates nothing|No dissipator inside/);
 }
});

test('new wing actions, equipment labels and creation instructions translate',()=>{
 for(const source of ['構造材','散熱主翼','Sフォイル（散熱主翼）','太陽電池・散熱翼','主翼の散熱方式','散熱主翼にする','太陽電池・散熱翼にする'])translated(source);
 for(const fragment of app.matchAll(/<p class="note">([^<`]*散熱[^<`]*?)<\/p>/g))translated(fragment[1]);
 assert.equal(translated('面をタップして散熱主翼（2×4×0.08 m）を据える'),'Tap a surface to place Radiator Wing (2×4×0.08 m)');
});

test('fractional size guidance and metric fields retain exact decimal values in English',()=>{
 const note=app.match(/<p class="note">(寸法は小数で入力でき[^<]+)<\/p>/);assert.ok(note);const output=translated(note[1]);assert.match(output,/0\.01 m/);
 const html=run(`metreSlider('eh','高さ',.064,.02,3)`);htmlTranslated(html);
 assert.match(html,/value="0\.064"/);assert.match(html,/step="any"/);assert.equal(translated('0.064 m'),'0.064 m');
});
