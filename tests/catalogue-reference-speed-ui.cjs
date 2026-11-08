const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
function setup(){const cx=vm.createContext({console}),run=code=>vm.runInContext(code,cx);for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])run(fs.readFileSync(path.join(root,file),'utf8'));run('const C=Core,R=Rts;');assert.equal(run('typeof C.referenceSpeedProfile'),'function','final Core speed overlay API must be present');const a=app.indexOf('function voyExampleDesigns()'),b=app.indexOf('function voyDesign(',a);assert.ok(a>=0&&b>a);run(app.slice(a,b));return{run};}
const plain=value=>JSON.parse(JSON.stringify(value));

test('catalogue profiles apply published sublight speeds on copies without altering authenticated data',()=>{
 const {run}=setup(),before=run('JSON.stringify(YardFleetData)');run('const rows=voyExampleDesigns(),by=new Map(rows.map(d=>[d.key,d]));');
 for(const key of ['imperial','imperial2','venator','cr90','hammerhead','gr75']){
  assert.equal(run(`by.get('${key}').p.mglt`),run(`C.referenceSublightMGLT('${key}')`));assert.equal(run(`by.get('${key}').p.maxSpeed`),run(`C.referenceSublightMGLT('${key}')*C.MGLT.ms`));assert.equal(run(`by.get('${key}').p.speedReference.status`),'published');assert.equal(run(`by.get('${key}').p===YardFleetData.designs['${key}'].p`),false);
 }
 assert.equal(run('JSON.stringify(YardFleetData)'),before);
 const strip=p=>{const q={...p};for(const k of ['maxSpeed','mglt','speedReference','motionResistance','propulsion','grid','accel'])delete q[k];return q;};
 for(const d of plain(run('rows'))){
  const expected=plain(run('C.emptyDesignProfile(YardFleetData.designs['+JSON.stringify(d.key)+'].p)'));assert.deepEqual(strip(d.p),strip(expected),d.key+' non-propulsion engineering fields stay unchanged');
  for(const field of ['P','Pgen','Paux','fixed','cooling','Ds','Dw'])assert.equal(d.p.grid?.[field],expected.grid?.[field],d.key+' source and other consumer '+field);
  assert.equal(d.p.propulsion?.massKg,expected.propulsion?.massKg,d.key+' physical mass');
  for(const list of ['cores','engines']){const actual=d.p.propulsion?.[list]||[],before=expected.propulsion?.[list]||[];assert.equal(actual.length,before.length);for(let i=0;i<actual.length;i++)for(const field of ['id','machineryId','coreId','direction','effectiveMachineryVolumeM3','machineryVolumeM3','machineryShape','machineryLengthM','machineryRadiusM'])assert.deepEqual(actual[i][field],before[i][field],d.key+' '+list+' '+field);}
  if(d.p.motionResistance){assert.equal(d.p.motionResistance.version,run('C.MOTION_RESISTANCE_VERSION'));assert.equal(d.p.motionResistance.referenceSpeedMps,d.p.maxSpeed);assert.ok(d.p.motionResistance.ratePerKg>0);}
 }
});

test('unpublished or custom model speeds retain their previous computed fallback',()=>{
 const {run}=setup();run('const row=voyExampleDesigns().find(d=>d.key==="mc30c"),raw=YardFleetData.designs.mc30c;');assert.equal(run('row.p.speedReference.status'),'assumed');assert.equal(run('row.p.maxSpeed'),run('raw.p.maxSpeed'));assert.equal(run('row.p.mglt'),run('raw.p.mglt'));assert.equal(run('row.p.accel'),run('raw.p.accel'));
});

test('a catalogue ship with no thrust does not acquire motion from a published maximum',()=>{
 const {run}=setup();run('const missing=YardFleetData.designs.imperial.p;missing.accel=0;missing.propulsion={...missing.propulsion,cores:[],engines:[],ratedAccelMps2:0,ratedThrustN:0};const original=JSON.stringify(YardFleetData.designs.imperial),row=voyExampleDesigns().find(d=>d.key==="imperial");');assert.equal(run('row.p.maxSpeed'),0);assert.equal(run('row.p.mglt'),0);assert.equal(run('JSON.stringify(YardFleetData.designs.imperial)'),run('original'));
});

test('craft performance separates published speed, source and independent acceleration from calculated assumptions',()=>{
 const {run}=setup(),published=plain(run('C.sublightReference("xwing")')),assumed=plain(run('C.sublightReference("custom")'));
 const cx=vm.createContext({navigator:{language:'en'},ref:published}),ui=code=>vm.runInContext(code,cx);
 for(const file of ['js/lang-en.js','js/i18n.js'])ui(fs.readFileSync(path.join(root,file),'utf8'));
 ui(`const ship={},C={MGLT:{ms:20},craftCombat:()=>craft};let craft={speed:2000,speedReference:ref,accelG:3700,aa:1.25,strike:160,gun:1,armor:1.2,role:'fighter',size:12};const num=n=>String(n),fG=n=>n+' G',fMass=n=>n+' t',esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c])),craftStoresHTML=()=>'';`);
 const a=app.indexOf('function craftCombatHTML('),b=app.indexOf('const CRAFT_SYSTEM_KEYS=',a);assert.ok(a>=0&&b>a);ui(app.slice(a,b));
 let html=ui('craftCombatHTML({mass:12,cls:{role:"fighter"}})');
 assert.match(html,/約 100 MGLT・公表された最高速度/);assert.match(html,/<dt>加速<\/dt><dd>3700 G<small>速度とは別に計算/);assert.ok(html.includes('href="'+published.source+'"'));assert.doesNotMatch(html,/加速 .* から|公式の亜光速性能/);
 const publishedTexts=[...html.matchAll(/>([^<>]+)</g)].map(m=>m[1]);
 cx.ref=assumed;ui('craft={...craft,speed:1234,speedReference:ref}');html=ui('craftCombatHTML({mass:12,cls:{role:"fighter"}})');assert.match(html,/設計から計算した速度（仮定）/);assert.doesNotMatch(html,/<a /);assert.doesNotMatch(html,/公表された最高速度/);
 const assumedTexts=[...html.matchAll(/>([^<>]+)</g)].map(m=>m[1]);
 for(const text of [...publishedTexts,...assumedTexts])assert.doesNotMatch(ui('KSI18n.t('+JSON.stringify(text)+')'),/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u,text);
});

test('current example notes translate nozzle ownership and published speed without restoring obsolete performance claims',()=>{
 const {run}=setup();for(const file of ['js/lang-en.js','js/i18n.js'])run(fs.readFileSync(path.join(root,file),'utf8'));run('KSI18n.setLanguage("en")');
 const keys=['mc30c','mc75','mc80home','mc80liberty','craft_arc170','craft_btlb','craft_hyena','subjugator'],notes={};
 for(const key of keys){const source=run('C.SHIP_EXAMPLES['+JSON.stringify(key)+'].note');notes[key]=run('KSI18n.t('+JSON.stringify(source)+')');assert.doesNotMatch(notes[key],/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u,key);assert.equal(run('C.SHIP_EXAMPLES['+JSON.stringify(key)+'].note'),source);}
 for(const [key,count] of [['mc80home','ten'],['mc80liberty','nine'],['mc75','Twelve']])assert.match(notes[key],new RegExp(count+' propulsion nozzles.*two integrated propulsion engines'));
 assert.match(notes.mc30c,/Four main nozzles.*one integrated propulsion engine; the aft nozzle.*separate propulsion engine/);
 for(const key of ['craft_arc170','craft_btlb','craft_hyena','subjugator']){assert.ok(notes[key].includes('published value of '+run('C.referenceSublightMGLT('+JSON.stringify(key)+')')+' MGLT'),key);assert.match(notes[key],/calculated from the installed engines and completed mass/);}
 assert.doesNotMatch(notes.craft_arc170,/118 MGLT/);assert.doesNotMatch(notes.craft_hyena,/75 MGLT|29 MGLT/);assert.doesNotMatch(notes.subjugator,/66 MGLT/);assert.doesNotMatch(notes.craft_btlb,/corresponding to/);
});
