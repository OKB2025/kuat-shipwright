const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),context=vm.createContext({console,navigator:{language:'en-US'}});
const manifest=JSON.parse(fs.readFileSync(path.join(root,'index.html'),'utf8').match(/window\.KS_FILES=(\{[^\n]+\});/)[1]);
for(const file of [...manifest.data,manifest.core,'js/lang-en.js','js/i18n.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const run=code=>vm.runInContext(code,context),plain=v=>JSON.parse(JSON.stringify(v));
run(`const C=Core,T=x=>x,fW=v=>v+' W',I18N=KSI18n,num=(v,d=0)=>Number(v).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}),esc=String,storeCapText=()=>'',st={tab:'arm'},selItem=()=>null,curFit=()=>'claser'/* 2026-11-24 the weapon preview's cylinder card for craft lasers (craftLaserHTML) reads these */;let ship=C.newShip({L:150,W:50,H:35,sec:'rect',plan:'rect'},'Small-weapon UI');`);
for(const[start,end]of [['const fTT =','const fG ='],['const PART_KEYS =','const partOffered ='],['function fitBtn(','const fmtM ='],['function craftLaserOptions(','function changeCraftLaser('],['function designWeaponPreviewHTML(','function designUIPlacementHTML(']]){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);run(app.slice(a,b));}
run('function editorCraftDesign(){return !!C.shipClassFor(ship.hull.L,ship.shipClass).craft;}');
const keys=['quad500MT','twin500MT','single500MT','single6MT','twin6MT','sphyrnaTwin500MT'],C_laser=bore=>run('C.laserShotKt('+bore+')/C.KT_PER_TT');
test('small naval weapon energy retains MT precision and converts total volleys at the GT boundary',()=>{
 for(const[v,expected]of [[1e-7,'100 kt'],[2e-9,'2 kt'],[4e-9,'4 kt'],[.000006,'6 MT'],[.000012,'12 MT'],[.0005,'500 MT'],[.001,'1 GT'],[.002,'2 GT'],[.2,'200 GT'],[.5,'500 GT'],[1,'1.0 TT']])assert.equal(run('fTT('+v+')'),expected);
});
test('the authoritative corvette family is selectable once on both ship and compact craft catalogs',()=>{
 assert.deepEqual(plain(run('C.CORVETTE_WEAPON_KEYS')),keys);
 for(const length of [150,10]){run('ship.hull.L='+length);const listed=plain(run('weaponKeys()'));for(const key of keys)assert.equal(listed.filter(k=>k===key).length,1,key+' is present once');}
});
test('catalog cards display total volleys while each weapon preview shows its per-barrel rating',()=>{
 // 2026-11-24 gun rules: the corvette guns are lasers by their drawn bores (279 / 285 / 613 / 117 kt, 658 kt + 1.57 MT, 261 kt a barrel);
 // were 500 MT and 6 MT a barrel (2 GT, 1 GT, 500 MT, 6 MT, 12 MT, 1 GT a volley).
 // 2026-11-25 (user decision): four of them are turbolasers with the decided shot (GUN_RULES.turbolaserShot: quad500MT and twin500MT
 // 200 GT, single6MT 100 MT, sphyrnaTwin500MT 200 MT a barrel), so their volleys are 800 GT, 400 GT, 100 MT and 400 MT; single500MT
 // and twin6MT stay lasers by their drawn bores.
 const expected={quad500MT:'800 GT',twin500MT:'400 GT',single500MT:'613.23 kt',single6MT:'100 MT',twin6MT:'2.22 MT',sphyrnaTwin500MT:'400 MT'};for(const key of keys){const q=JSON.stringify(key),laser=run('C.FITS['+q+'].gunRule.kind')==='laser';assert.equal(laser,run('C.GUN_RULES.turbolaserShot['+q+']')===undefined,key+' is a laser or has a decided turbolaser shot');assert.equal(run('C.needsCapacitor({k:'+q+'})'),!laser,key);
  assert.equal(expected[key],laser?run('fTT(C.FITS['+q+'].gunRule.perBarrel.reduce((n,b)=>n+C.laserShotKt(b.bore),0)/C.KT_PER_TT)'):run('fTT(C.GUN_RULES.turbolaserShot['+q+']*C.FITS['+q+'].barrels)'),key+(laser?' volley by the laser rule':' volley of the decided turbolaser shot'));}
 for(const key of keys){const html=run('fitBtn('+JSON.stringify(key)+',false,"fit")');assert.ok(html.includes(expected[key]),key+' total volley');assert.doesNotMatch(html,/undefined|NaN/);for(const text of [...html.matchAll(/>([^<>]+)</g)].map(m=>m[1]))assert.doesNotMatch(run('KSI18n.t('+JSON.stringify(text)+')'),/[\u3040-\u30ff\u3400-\u9fff]/,key+' full card');assert.doesNotMatch(run('KSI18n.t(C.FITS['+JSON.stringify(key)+'].name)'),/[\u3040-\u30ff\u3400-\u9fff]/,key+' English name');}
 for(const key of keys){const preview=run('designWeaponPreviewHTML({k:'+JSON.stringify(key)+'})'),bolt=run('C.weaponChargeSpec({k:'+JSON.stringify(key)+'}).boltTT');assert.ok(preview.includes('data-weapon-stat="output" data-value="'+bolt+'"'),key+' per-barrel preview');assert.doesNotMatch(preview,/undefined|NaN/);}
});

test('dedicated PD and aircraft cards show calibrated per-shot units and the removed ion gun stays out of the catalog',()=>{
 const listed=plain(run('weaponKeys()'));assert.equal(listed.includes('cion'),false);
 // 2026-11-24 gun rules: a laser's shot is its bore's (pd 0.40 m, monCalPD 0.178 m, craft 0.17 / 0.30 / 0.12 m); were 100 kt and the
 // 6 / 72 / 1.2 kt pulses of the old 0.12-0.18 s periods.
 // 2026-11-25 expectation changed (user「では0.3を800kt、0.05を50ktと扱い0.02まで口径を指定できるように」「面積比例で」; expectation-changes-2026-11-25.md): an aircraft
 // laser's shot is C.craftLaserKt(bore): claser 0.17 m 276.29 kt (was 118.28 kt), claserH 0.30 m 800 kt (was 436 kt), cturret 0.12 m 152 kt a
 // barrel, 304 kt a volley (was 42.88 / 85.76 kt). The ship's point defence (pd, monCalPD: C.laserShotKt) is unchanged.
 for(const [key,unit,volley]of [['pd','800 kt','1.6 MT'],['monCalPD','133.13 kt','399.38 kt'],['claser','118.28 kt','118.28 kt'],['claserH','436 kt','436 kt'],['cturret','42.88 kt','85.76 kt']]/* 2026-11-25, later (user「同じ威力と置き換え」): the types' bores were replaced by those of the same shot, so the cards read as before the yield rule changed (276.29 / 800 / 152 kt held only between the two decisions) */){
  const html=run('fitBtn('+JSON.stringify(key)+',false,"fit")');assert.ok(html.includes('1発・1砲身 '+unit));assert.ok(html.includes('一斉射 '+volley));
  for(const field of ['name','short','desc','evidence'])assert.doesNotMatch(run('KSI18n.t(C.FITS['+JSON.stringify(key)+']['+JSON.stringify(field)+'])'),/[\u3040-\u30ff\u3400-\u9fff]/,key+' '+field);
 }
 for(const [key,bore]of [['pd',.40],['monCalPD',null],['claser',.17],['claserH',.30],['cturret',.12]]){const bolt=run('C.FITS.'+key+'.boltTT'),rule=bore??run('C.FITS.'+key+'.gunRule.boreM');assert.ok(Math.abs(bolt-(run('C.FITS.'+key+'.craft')?run('C.craftLaserKt('+rule+')/C.KT_PER_TT')/* 2026-11-25: the aircraft rule, was C.laserShotKt */:C_laser(rule)))<=1e-12*bolt,key+' shot of its bore');const preview=run('designWeaponPreviewHTML({k:'+JSON.stringify(key)+'})');assert.ok(preview.includes('data-weapon-stat="output" data-value="'+bolt+'"'));}
});

test('the restored native Venator side gun appears once with 70 TT per barrel and a 140 TT volley',()=>{
 assert.deepEqual(plain(run('C.VENATOR_SIDE_WEAPON_KEYS')),['venSide70']);assert.equal(plain(run('weaponKeys()')).filter(k=>k==='venSide70').length,1);const html=run('fitBtn("venSide70",false,"fit")');assert.match(html,/70TT×2 舷側/);assert.match(html,/1発・1砲身 70 TT/);assert.match(html,/一斉射 140 TT/);assert.doesNotMatch(html,/undefined|NaN/);const preview=run('designWeaponPreviewHTML({k:"venSide70"})');assert.match(preview,/data-weapon-stat="output" data-value="70">70 TT<\/dd>/);for(const field of ['name','short','desc','evidence','rateEvidence'])assert.doesNotMatch(run('KSI18n.t(C.FITS.venSide70['+JSON.stringify(field)+'])'),/[\u3040-\u30ff\u3400-\u9fff]/,field+' translation');
});
