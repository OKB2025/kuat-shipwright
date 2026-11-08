const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),context=vm.createContext({console,navigator:{language:'en-US'}});
const manifest=JSON.parse(fs.readFileSync(path.join(root,'index.html'),'utf8').match(/window\.KS_FILES=(\{[^\n]+\});/)[1]);
for(const file of [...manifest.data,manifest.core,'js/lang-en.js','js/i18n.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const run=code=>vm.runInContext(code,context),plain=v=>JSON.parse(JSON.stringify(v));
run(`const C=Core,T=x=>x,fW=v=>v+' W',I18N=KSI18n,num=(v,d=0)=>Number(v).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}),esc=String,storeCapText=()=>'';let ship=C.newShip({L:150,W:50,H:35,sec:'rect',plan:'rect'},'Small-weapon UI');`);
for(const[start,end]of [['const fTT =','const fG ='],['const PART_KEYS =','const partOffered ='],['function fitBtn(','const fmtM ='],['function designWeaponPreviewHTML(','function designUIPlacementHTML(']]){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);run(app.slice(a,b));}
run('function editorCraftDesign(){return !!C.shipClassFor(ship.hull.L,ship.shipClass).craft;}');
const keys=['quad500MT','twin500MT','single500MT','single6MT','twin6MT','sphyrnaTwin500MT'];
test('small naval weapon energy retains MT precision and converts total volleys at the GT boundary',()=>{
 for(const[v,expected]of [[1e-7,'100 kt'],[2e-9,'2 kt'],[4e-9,'4 kt'],[.000006,'6 MT'],[.000012,'12 MT'],[.0005,'500 MT'],[.001,'1 GT'],[.002,'2 GT'],[.2,'200 GT'],[.5,'500 GT'],[1,'1.0 TT']])assert.equal(run('fTT('+v+')'),expected);
});
test('the authoritative corvette family is selectable once on both ship and compact craft catalogs',()=>{
 assert.deepEqual(plain(run('C.CORVETTE_WEAPON_KEYS')),keys);
 for(const length of [150,10]){run('ship.hull.L='+length);const listed=plain(run('weaponKeys()'));for(const key of keys)assert.equal(listed.filter(k=>k===key).length,1,key+' is present once');}
});
test('catalog cards display total volleys while each weapon preview shows its per-barrel rating',()=>{
 const expected={quad500MT:'2 GT',twin500MT:'1 GT',single500MT:'500 MT',single6MT:'6 MT',twin6MT:'12 MT',sphyrnaTwin500MT:'1 GT'};
 for(const key of keys){const html=run('fitBtn('+JSON.stringify(key)+',false,"fit")');assert.ok(html.includes(expected[key]),key+' total volley');assert.doesNotMatch(html,/undefined|NaN/);for(const text of [...html.matchAll(/>([^<>]+)</g)].map(m=>m[1]))assert.doesNotMatch(run('KSI18n.t('+JSON.stringify(text)+')'),/[\u3040-\u30ff\u3400-\u9fff]/,key+' full card');assert.doesNotMatch(run('KSI18n.t(C.FITS['+JSON.stringify(key)+'].name)'),/[\u3040-\u30ff\u3400-\u9fff]/,key+' English name');}
 for(const key of keys){const preview=run('designWeaponPreviewHTML({k:'+JSON.stringify(key)+'})'),bolt=run('C.weaponChargeSpec({k:'+JSON.stringify(key)+'}).boltTT');assert.ok(preview.includes('data-weapon-stat="output" data-value="'+bolt+'"'),key+' per-barrel preview');assert.doesNotMatch(preview,/undefined|NaN/);}
});

test('dedicated PD and aircraft cards show calibrated per-shot units and the removed ion gun stays out of the catalog',()=>{
 const listed=plain(run('weaponKeys()'));assert.equal(listed.includes('cion'),false);
 for(const [key,unit,volley]of [['pd','100 kt','200 kt'],['monCalPD','100 kt','300 kt'],['claser','2 kt','2 kt'],['claserH','2 kt','2 kt'],['cturret','2 kt','4 kt']]){
  const html=run('fitBtn('+JSON.stringify(key)+',false,"fit")');assert.ok(html.includes('1発・1砲身 '+unit));assert.ok(html.includes('一斉射 '+volley));
  for(const field of ['name','short','desc','evidence'])assert.doesNotMatch(run('KSI18n.t(C.FITS['+JSON.stringify(key)+']['+JSON.stringify(field)+'])'),/[\u3040-\u30ff\u3400-\u9fff]/,key+' '+field);
 }
 for(const [key,bolt]of [['pd',1e-7],['monCalPD',1e-7],['claser',2e-9],['cturret',2e-9]]){const preview=run('designWeaponPreviewHTML({k:'+JSON.stringify(key)+'})');assert.ok(preview.includes('data-weapon-stat="output" data-value="'+bolt+'"'));}
});

test('the restored native Venator side gun appears once with 70 TT per barrel and a 140 TT volley',()=>{
 assert.deepEqual(plain(run('C.VENATOR_SIDE_WEAPON_KEYS')),['venSide70']);assert.equal(plain(run('weaponKeys()')).filter(k=>k==='venSide70').length,1);const html=run('fitBtn("venSide70",false,"fit")');assert.match(html,/70TT×2 舷側/);assert.match(html,/1発・1砲身 70 TT/);assert.match(html,/一斉射 140 TT/);assert.doesNotMatch(html,/undefined|NaN/);const preview=run('designWeaponPreviewHTML({k:"venSide70"})');assert.match(preview,/data-weapon-stat="output" data-value="70">70 TT<\/dd>/);for(const field of ['name','short','desc','evidence','rateEvidence'])assert.doesNotMatch(run('KSI18n.t(C.FITS.venSide70['+JSON.stringify(field)+'])'),/[\u3040-\u30ff\u3400-\u9fff]/,field+' translation');
});
