const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
function setup(){const cx=vm.createContext({console}),run=code=>vm.runInContext(code,cx);for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])run(fs.readFileSync(path.join(root,file),'utf8'));run('const C=Core,R=Rts;');assert.equal(run('typeof C.referenceSpeedProfile'),'function','final Core speed overlay API must be present');const a=app.indexOf('function voyExampleDesigns()'),b=app.indexOf('function voyDesign(',a);assert.ok(a>=0&&b>a);run(app.slice(a,b));return{run};}
const plain=value=>JSON.parse(JSON.stringify(value));
function commonRate(C,mass){const small=C.ENGINE_CONVERSION.referenceSmallMassKg,large=C.ENGINE_CONVERSION.referenceLargeMassKg,kSmall=3999.1037971899486*C.G0*C.FLEET_RULES.accelScale/2000,kLarge=2972.473437207956*C.G0*C.FLEET_RULES.accelScale/1000,exponent=Math.log(kLarge/kSmall)/Math.log(large/small);return mass>0?kSmall*Math.pow(mass/small,exponent):0;}
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(b))*1e-9,`${a} != ${b}`);

test('catalogue copies use funded terminal speeds and published provenance without altering authenticated data',()=>{
 const {run}=setup(),C=run('C'),before=run('JSON.stringify(YardFleetData)');run('const rows=voyExampleDesigns(),by=new Map(rows.map(d=>[d.key,d]));');
 for(const key of ['imperial','imperial2','venator','cr90','hammerhead','gr75']){
  const p=run(`by.get('${key}').p`),plan=C.healthyMotionPlan(p),rate=commonRate(C,p.propulsion.massKg);near(p.maxSpeed,plan.accelerationMps2*C.FLEET_RULES.accelScale/rate);near(p.mglt,p.maxSpeed/C.MGLT.ms);assert.equal(p.speedReference.mglt,C.referenceSublightMGLT(key));assert.equal(p.speedReference.status,'published');assert.equal(p.speedReference.source,C.sublightReference(key).source);assert.equal(run(`by.get('${key}').p===YardFleetData.designs['${key}'].p`),false);
 }
 assert.equal(run('JSON.stringify(YardFleetData)'),before);
 const strip=p=>{const q={...p};for(const k of ['maxSpeed','mglt','speedReference','motionResistance','propulsion','grid','accel'])delete q[k];return q;};
 for(const d of plain(run('rows'))){
  const expected=plain(run('C.emptyDesignProfile(YardFleetData.designs['+JSON.stringify(d.key)+'].p)'));assert.deepEqual(strip(d.p),strip(expected),d.key+' non-propulsion engineering fields stay unchanged');
  for(const field of ['P','Pgen','Paux','fixed','cooling','Ds','Dw'])assert.equal(d.p.grid?.[field],expected.grid?.[field],d.key+' source and other consumer '+field);
  assert.equal(d.p.propulsion?.massKg,expected.propulsion?.massKg,d.key+' physical mass');
  for(const list of ['cores','engines']){const actual=d.p.propulsion?.[list]||[],before=expected.propulsion?.[list]||[];assert.equal(actual.length,before.length);for(let i=0;i<actual.length;i++)for(const field of ['id','machineryId','coreId','direction','effectiveMachineryVolumeM3','machineryVolumeM3','machineryShape','machineryLengthM','machineryRadiusM'])assert.deepEqual(actual[i][field],before[i][field],d.key+' '+list+' '+field);}
  if(d.p.motionResistance){assert.equal(d.p.motionResistance.version,C.MOTION_RESISTANCE_VERSION);assert.equal(d.p.motionResistance.model,'global-mass-power-law');assert.equal(d.p.motionResistance.referenceSpeedMps,2000);assert.equal(d.p.motionResistance.referenceLargeSpeedMps,1000);near(C.massDragRate(d.p),commonRate(C,d.p.propulsion.massKg));assert.ok(d.p.motionResistance.referenceRatePerS>0);assert.ok(d.p.motionResistance.massExponent>0);}
 }
});

test('unpublished catalogue rows use the same funded equilibrium and ignore obsolete speed hints',()=>{
 const {run}=setup(),C=run('C');run('const raw=YardFleetData.designs.mc30c,first=voyExampleDesigns().find(d=>d.key==="mc30c");raw.p.maxSpeed=9e9;raw.p.mglt=4.5e8;const unchanged=JSON.stringify(raw),row=voyExampleDesigns().find(d=>d.key==="mc30c");');const p=run('row.p'),plan=C.healthyMotionPlan(p);assert.equal(p.speedReference.status,'assumed');assert.equal(p.speedReference.mglt,null);assert.equal(p.speedReference.source,null);near(p.maxSpeed,plan.accelerationMps2*C.FLEET_RULES.accelScale/commonRate(C,p.propulsion.massKg));near(p.mglt,p.maxSpeed/C.MGLT.ms);near(p.maxSpeed,run('first.p.maxSpeed'));assert.notEqual(p.maxSpeed,run('raw.p.maxSpeed'));assert.equal(run('row.p.accel'),run('raw.p.accel'));assert.equal(run('JSON.stringify(raw)'),run('unchanged'));
});

test('a catalogue ship with no thrust does not acquire motion from a published maximum',()=>{
 const {run}=setup();run('const missing=YardFleetData.designs.imperial.p;missing.accel=0;missing.propulsion={...missing.propulsion,cores:[],engines:[],ratedAccelMps2:0,ratedThrustN:0};const original=JSON.stringify(YardFleetData.designs.imperial),row=voyExampleDesigns().find(d=>d.key==="imperial");');assert.equal(run('row.p.maxSpeed'),0);assert.equal(run('row.p.mglt'),0);assert.equal(run('row.p.speedReference.mglt'),60);assert.equal(run('row.p.grid.P'),run('missing.grid.P'));assert.ok(run('C.massDragRate(row.p)>0'),'a powerless vessel retains the common resistance');assert.equal(run('JSON.stringify(YardFleetData.designs.imperial)'),run('original'));
});

test('craft performance shows funded physical speed and keeps published speeds as calibration references',()=>{
 const {run}=setup(),published=plain(run('C.sublightReference("xwing")')),assumed=plain(run('C.sublightReference("custom")'));
 const cx=vm.createContext({navigator:{language:'en'},ref:published}),ui=code=>vm.runInContext(code,cx);
 for(const file of ['js/lang-en.js','js/i18n.js'])ui(fs.readFileSync(path.join(root,file),'utf8'));
 ui(`const ship={},C={MGLT:{ms:20},craftCombat:()=>craft};let craft={speed:1734,speedReference:ref,accelG:3700,aa:1.25,strike:160,gun:1,armor:1.2,role:'fighter',size:12};const num=n=>String(n),fG=n=>n+' G',fMass=n=>n+' t',esc=s=>String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c])),craftStoresHTML=()=>'';`);
 const a=app.indexOf('function craftCombatHTML('),b=app.indexOf('const CRAFT_SYSTEM_KEYS=',a);assert.ok(a>=0&&b>a);ui(app.slice(a,b));
 let html=ui('craftCombatHTML({mass:12,cls:{role:"fighter"}})');
 assert.match(html,/1734 m\/s/);assert.match(html,/約 87 MGLT・実給電の推力と共通抵抗から計算/);assert.match(html,/公表されたMGLTは校正資料です/);assert.match(html,/<dt>加速<\/dt><dd>3700 G<small>速度とは別に計算/);assert.ok(html.includes('href="'+published.source+'"'));assert.doesNotMatch(html,/加速 .* から|公式の亜光速性能/);
 const publishedTexts=[...html.matchAll(/>([^<>]+)</g)].map(m=>m[1]);
 cx.ref=assumed;ui('craft={...craft,speed:1234,speedReference:ref}');html=ui('craftCombatHTML({mass:12,cls:{role:"fighter"}})');assert.match(html,/1234 m\/s/);assert.match(html,/実給電の推力と共通抵抗から計算/);assert.doesNotMatch(html,/<a /);assert.doesNotMatch(html,/公表された最高速度/);
 const assumedTexts=[...html.matchAll(/>([^<>]+)</g)].map(m=>m[1]);
 for(const text of [...publishedTexts,...assumedTexts])assert.doesNotMatch(ui('KSI18n.t('+JSON.stringify(text)+')'),/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u,text);
});

test('current example notes translate nozzle ownership and published speed without restoring obsolete performance claims',()=>{
 const {run}=setup();for(const file of ['js/lang-en.js','js/i18n.js'])run(fs.readFileSync(path.join(root,file),'utf8'));run('KSI18n.setLanguage("en")');
 const keys=['mc30c','mc75','mc80home','mc80liberty','craft_arc170','craft_btlb','craft_hyena','subjugator','craft_tie_ln'],notes={};
 for(const key of keys){const source=run('C.SHIP_EXAMPLES['+JSON.stringify(key)+'].note');notes[key]=run('KSI18n.t('+JSON.stringify(source)+')');assert.doesNotMatch(notes[key],/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u,key);assert.equal(run('C.SHIP_EXAMPLES['+JSON.stringify(key)+'].note'),source);}
 for(const [key,count] of [['mc80home','ten'],['mc80liberty','nine'],['mc75','Twelve']])assert.match(notes[key],new RegExp(count+' propulsion nozzles.*two integrated propulsion engines'));
 assert.match(notes.mc30c,/Four main nozzles.*one integrated propulsion engine; the aft nozzle.*separate propulsion engine/);
 for(const key of ['craft_arc170','craft_btlb','craft_hyena','subjugator']){assert.ok(notes[key].includes('published value of '+run('C.referenceSublightMGLT('+JSON.stringify(key)+')')+' MGLT'),key);assert.match(notes[key],/calculated from the installed engines and completed mass/);}
 assert.match(notes.craft_tie_ln,/one solar-panel part, one on each side/);assert.match(notes.craft_tie_ln,/0\.08 m/);assert.match(notes.craft_tie_ln,/0\.992 m/);assert.match(notes.craft_tie_ln,/4,100 G/);assert.match(notes.craft_tie_ln,/No separate outer frames, spars, struts, flanges or central hubs are installed/);
 assert.doesNotMatch(notes.craft_arc170,/118 MGLT/);assert.doesNotMatch(notes.craft_hyena,/75 MGLT|29 MGLT/);assert.doesNotMatch(notes.subjugator,/66 MGLT/);assert.doesNotMatch(notes.craft_btlb,/corresponding to/);
});
