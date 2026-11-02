const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),core=fs.readFileSync(path.join(root,'js/core.js'),'utf8'),context=vm.createContext({navigator:{language:'en-US'}}),run=s=>vm.runInContext(s,context);
for(const file of ['js/lang-en.js','js/i18n.js'])run(fs.readFileSync(path.join(root,file),'utf8'));
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);run(app.slice(a,b));}
run(`const st={part:'wing',structWing:{thermal:'high'},structSize:[2,4,.064],structPitch:0,structRoll:0,surfaceMode:'surface'},ship={parts:[]};
const C={PARTS:{},normalizeWing:w=>({thermal:'high',feed:1,reinf:0,...w})};
const addComp=(k,name,shape,dens,col,group,desc)=>C.PARTS[k]={name,shape,dens,col,group,desc};
const esc=String,num=String,deg=v=>v+'°',fW=v=>v+' W',fMass=v=>v+' t',fPct=v=>(v*100)+'%',fmtM=v=>v+' m',rgb=c=>c.join(',');
const activeEquipment=()=>null,wingFigures=()=>figures,foilPivotControls=()=>'',foilDiagramSVG=()=>'';
const FOIL_AXIS_ROWS=[['x','前後軸（X）']];let figures=null;
`);
const sectionDeclaration=core.match(/^const AERO_WING_SECTION=.*$/m);assert.ok(sectionDeclaration);run(sectionDeclaration[0]+'\nC.AERO_WING_SECTION=AERO_WING_SECTION;');
section('function seg(', 'function silhouette(');
section('function partCard(', 'function fitBtn(');
const surfaceStart=app.indexOf('function surfaceControls('),surfaceEnd=app.indexOf('\nfunction ',surfaceStart+1);
assert.ok(surfaceStart>=0&&surfaceEnd>surfaceStart);run(app.slice(surfaceStart,surfaceEnd));
for(const line of core.matchAll(/^addComp\('(wing|solarPanel)'[^\n]+/gm))run(line[0]);
section('function wingControls(', 'function sensorBandControls(');
const jp=/[\u3040-\u30ff\u3400-\u9fff]/;
function translated(s){const out=context.KSI18n.t(s);assert.doesNotMatch(out,jp,s+' => '+out);return out;}
function htmlTranslated(html){for(const text of html.split(/<[^>]*>/))if(text.trim())translated(text);for(const m of html.matchAll(/(?:title|aria-label)="([^"]*)"/g))translated(m[1]);}

test('actual dedicated wing and solar-panel catalogue cards and every operating mode translate in English',()=>{
 for(const k of ['wing','solarPanel'])htmlTranslated(run(`partCard('${k}',false)`));
 for(const [k,wing] of [['wing',undefined],['wing',{thermal:'high',feed:1,reinf:0}],['wing',{thermal:'low',feed:1,reinf:0}],['solarPanel',{thermal:'high',solar:true,feed:1,reinf:0}],['wing',{thermal:'high',foil:true,axis:'x',stow:0,open:15,T:1,feed:1,reinf:0}]]){
  context.wing=wing;context.partKind=k;
  run(`figures={parts:[],capOpen:125000,capStow:40000,mass:.064,feedMass:.001,reinfMass:0,act:.002,jamAt:.5,solarP:5000,area:6,hits:[]};`);
  const html=run(`wingControls({k:partKind,form:partKind==='wing'?'airfoil':'outline',wing})`);assert.ok(html);htmlTranslated(html);
  assert.doesNotMatch(context.KSI18n.t(html.replace(/<[^>]*>/g,' ')),/wing itself dissipates nothing|No dissipator inside/);
 }
});

test('wing and panel shape editors translate presets, dimensions, frame controls and diagram descriptions',()=>{
 for(const k of ['wing','solarPanel'])for(const form of [k==='wing'?'airfoil':'outline','mesh']){
  context.part={k,form,s:[2,4,.064],panelFold:30,panelKnee:.35};
  htmlTranslated(run('aeroShapeControls(part,true)'));
  run(`st.part='${k}'`);htmlTranslated(run('aeroShapeControls(part,false)'));
 }
 for(const source of ['翼弦・前後長','翼幅・パネル幅','厚さ','パーツの翼形状','固定主翼にする'])translated(source);
 assert.equal(translated('面をタップして主翼（2×4×0.064 m）を据える'),'Tap a surface to place Wing (2×4×0.064 m)');
 assert.equal(translated('面をタップして太陽光パネル（3×4×0.08 m）を据える'),'Tap a surface to place Solar Panel (3×4×0.08 m)');
 for(const source of ['翼形状の頂点','輪郭の編集はパーツの外形と面積に反映します。太陽光パネルでは発電量も変わります。']){assert.ok(app.includes(source));translated(source);}
});

test('fractional size guidance and metric fields retain exact decimal values in English',()=>{
 const note=app.match(/<p class="note">(寸法は小数で入力でき[^<]+)<\/p>/);assert.ok(note);const output=translated(note[1]);assert.match(output,/0\.01 m/);
 const html=run(`metreSlider('eh','高さ',.064,.02,3)`);htmlTranslated(html);
 assert.match(html,/value="0\.064"/);assert.match(html,/step="any"/);assert.equal(translated('0.064 m'),'0.064 m');
});
