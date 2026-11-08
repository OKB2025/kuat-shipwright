const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),cx=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx),plain=v=>JSON.parse(JSON.stringify(v)),balls=['monCalPD','monCal34','monCal80','monCal200','monCal200Triple','monCal150Ion'],weapons=[...balls,'pd','quad1Rapid'];
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return app.slice(a,b);}
function setup(){
 const ui=vm.createContext({console,C}),run=code=>vm.runInContext(code,ui);
 run(`let ship=C.newShip({L:500,W:300,H:160,plan:'rect',sec:'rect'},'Mon Calamari UI');
 const st={tab:'arm',fit:'monCal80',fitTool:'place',sel:null,weaponMount:'auto',gunYaw:0,gunPitch:0},notes=[];
 const num=(v,n=0)=>Number(v).toFixed(n),esc=String,fTT=v=>v+' TT',deg=v=>v+'°',fmtM=v=>v+' m',I18N=null,view=null,T=x=>x,fW=v=>v+' W';
 const curFit=()=>st.fit,selItem=()=>st.sel?ship.fits.find(f=>f.id===st.sel.id):null;
 const renderPanel=()=>{},syncHud=()=>{},requestDraw=()=>{},updateHint=()=>{},toast=s=>notes.push(s);
 const fitPairHTML=()=>'',fitPositionSliders=()=>'',fitPedestalControls=()=>'';
 `);
 for(const [a,b]of [['const PART_KEYS =','const partOffered ='],['function seg(','function silhouette('],['function fitBtn(','const fmtM ='],['function baseFitEditor()','function partList('],['function weaponYawControls(','function turretHeadingLines('],['function weaponMountIssue(','function turretCompartmentHTML('],['function weaponMountControls(','function aviationNumbers('],['function designWeaponPreviewHTML(','function designUIPlacementHTML(']])run(section(a,b));
 run('function editorCraftDesign(){return !!C.shipClassFor(ship.hull.L,ship.shipClass).craft;}');
 return run;
}
test('ship and compact-craft catalogs expose all new weapons exactly once and omit retired types',()=>{
 const run=setup();for(const craft of [false,true]){
  if(craft)run('ship.hull.L=10');
  const keys=plain(run('weaponKeys()'));for(const k of weapons)assert.equal(keys.filter(v=>v===k).length,1,k);
  for(const k of ['broadsideBattery','ionL','casemate40','casemateMid','casemateLight','casemateIon','casemateIonL'])assert.equal(keys.includes(k),false,k);
  assert.equal(new Set(keys).size,keys.length);
 }
 for(const k of weapons){const html=run(`fitBtn(${JSON.stringify(k)},false,'fit')`);assert.ok(html.includes(C.FITS[k].name));assert.doesNotMatch(html,/undefined|NaN|data-battery/);}
});
test('all Mon Calamari balls expose independent yaw and pitch in new and selected controls',()=>{
 const run=setup();for(const k of balls){
  run(`st.fit=${JSON.stringify(k)};st.gunYaw=23.5;st.gunPitch=-32.25;st.sel=null`);
  const fresh=run('weaponMountControls()');assert.match(fresh,/data-ball-turret-pitch/);assert.match(fresh,/data-sl="newGunYaw"[^>]*value="23.5"/);assert.match(fresh,/data-sl="newGunPitch"[^>]*value="-32.25"/);assert.doesNotMatch(fresh,/data-weaponmount="casemate"|砲列区画/);
  run(`ship.fits=[{id:7,k:${JSON.stringify(k)},p:[250,160,0],a:2,ped:0,base:0,assetYaw:-57.125,assetPitch:48.5}];st.sel={list:'fits',id:7}`);
  const selected=run('baseFitEditor()');assert.match(selected,/data-sl="gunYaw"[^>]*value="-57.125"/);assert.match(selected,/data-sl="gunPitch"[^>]*value="48.5"/);assert.doesNotMatch(selected,/data-broadside-battery|data-battery-caliber|data-battery-guns/);
 }
 for(const k of ['pd','quad1Rapid']){run(`st.fit=${JSON.stringify(k)};st.sel=null`);assert.doesNotMatch(run('weaponYawControls()'),/data-ball-turret-pitch|newGunPitch/);}
});
test('obsolete mount actions and battery edit events cannot recreate retired compartments',()=>{
 const run=setup();for(const k of weapons){
  run(`st.fit=${JSON.stringify(k)};st.weaponMount='auto';chooseWeaponMount('casemate')`);assert.equal(run('st.fit'),k);assert.equal(run('st.weaponMount'),'auto');
  assert.equal(run("broadsideBatteryControls({k:'broadsideBattery'})"),'');assert.equal(run("changeBroadsideBattery('batteryGuns','6','new')"),false);assert.equal(run('st.fit'),k);
 }
 run("st.fit='monCal80';chooseWeaponMount('trench')");assert.equal(run('st.weaponMount'),'trench');assert.equal(run('st.fit'),'monCal80');
});
test('weapon previews show the actual per-barrel rating for every spherical and rapid-fire family',()=>{
 const run=setup();for(const k of weapons){const html=run('designWeaponPreviewHTML({k:'+JSON.stringify(k)+'})');assert.ok(html.includes('data-weapon-stat="output" data-value="'+C.weaponChargeSpec({k}).boltTT+'"'),k);assert.doesNotMatch(html,/undefined|NaN|武装の威力と出典/);}
});
test('English weapon names, descriptions and evidence translate without Japanese leftovers',()=>{
 const en=vm.createContext({console,navigator:{language:'en-US'}});for(const file of ['js/lang-en.js','js/i18n.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),en,{filename:file});
 const I=en.KSI18n;for(const k of weapons)for(const field of ['name','short','desc','evidence','rateEvidence'])if(C.FITS[k][field])assert.doesNotMatch(I.t(C.FITS[k][field]),/[\u3040-\u30ff\u3400-\u9fff]/,k+' '+field);
});
