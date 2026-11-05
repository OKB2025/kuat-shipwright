const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),cx=vm.createContext({console,performance});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx),plain=v=>JSON.parse(JSON.stringify(v));
function setup(){const context=vm.createContext({console,C}),run=s=>vm.runInContext(s,context),section=(start,end)=>{const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);run(app.slice(a,b));};run(`let ship=C.newShip({L:300,W:160,H:100}),st={fit:'monCal34',fitTool:'place',weaponMount:'auto',sel:null},view=null;const curFit=()=>st.fit,toast=()=>{},renderPanel=()=>{},syncHud=()=>{},requestDraw=()=>{};`);section('const PART_KEYS =','const partOffered =');section('function chooseWeaponMount(','function aviationNumbers(');return run;}

test('designer offers each new spherical gun once and omits retired windows and small ion guns',()=>{
 const run=setup(),keys=plain(run('weaponKeys()'));for(const key of ['monCalPD','monCal34','monCal80','monCal200','monCal200Triple','monCal150Ion','quad1Rapid','pd'])assert.equal(keys.filter(k=>k===key).length,1,key);
 for(const key of ['broadsideBattery','ionL','casemate40','casemateMid','casemateLight','casemateIon','casemateIonL'])assert.equal(keys.includes(key),false,key);
});

test('a restored old casemate mounting control cannot recreate the retired window weapon',()=>{
 const run=setup();for(const mode of ['auto','top','bottom','trench','casemate']){run(`st.fit='monCal34';chooseWeaponMount(${JSON.stringify(mode)})`);assert.equal(run('st.fit'),'monCal34');assert.equal(C.FITS[run('st.fit')].asset,'moncal_single34');}
});

test('saved assembly templates canonicalize retired window and light-ion entries before returning to placement',()=>{
 const template={format:'starship-yard-part',v:1,parts:[],fits:[{id:7,k:'broadsideBattery',p:[20,30,40],a:4,batteryCaliber:'70TT',batteryGuns:2,tw:8},{id:8,k:'ionL',p:[20,30,-40],a:5,tw:7}]},before=plain(template),out=C.normalizeAssemblyTemplate(template);assert.deepEqual(template,before);assert.deepEqual(plain(out.fits.map(f=>f.k)),['monCal80','monCal150Ion']);assert.equal(out.fits[0].tw,8);assert.equal(out.fits[1].tw,7);assert.deepEqual(plain(out.fits.map(f=>f.p)),template.fits.map(f=>f.p));assert.deepEqual(plain(C.normalizeAssemblyTemplate(out)),plain(out));
});
