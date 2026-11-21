const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),cx=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx),plain=value=>JSON.parse(JSON.stringify(value));
// Reuse the existing native editor fixture, adding the geometry-adoption slot
// introduced by the current editor. The tested code is extracted from app.js.
const old=fs.readFileSync(path.join(root,'tests/missile-launcher-ui.cjs'),'utf8'),helpers=old.slice(old.indexOf('function section('),old.indexOf("\ntest("));
const factory=vm.createContext({console,root,app,C,vm,assert});vm.runInContext(helpers+';globalThis.makeFixture=setup;',factory);
const setup=()=>factory.makeFixture();

test('ship launcher palette and controls expose real grid dimensions separately from compact pods',()=>{
 const run=setup();assert.equal(run("weaponKeys().filter(k=>k==='shipMsl').length"),1);assert.equal(run("weaponKeys().filter(k=>k==='cmsl').length"),1);assert.equal(run("weaponKeys().includes('msl')"),false);
 run("st.fit='shipMsl';st.launcherCols=3;st.launcherRows=2;st.launchYaw=24;st.launcherEmbedded=false;");
 const html=run('launcherPitchControls()');for(const id of ['newLauncherCols','newLauncherRows','newLaunchYaw','newLaunchPitch'])assert.ok(html.includes('data-sl="'+id+'"'),id);
 assert.match(html,/構造物に埋め込む/);assert.match(html,/横幅 2\.7 m/);assert.match(html,/高さ 1\.8 m/);assert.match(html,/36 発/);assert.match(html,/max="16"/);
 assert.deepEqual(plain(run('shipLauncherPlacementOptions()')),{launcherCols:3,launcherRows:2,launchYaw:24,launcherEmbedded:false});
});

test('native placement, carried settings and save/load preserve grid and independent pose',()=>{
 const run=setup();run("st.fit='shipMsl';input('newLauncherCols',3);input('newLauncherRows',2);input('newLaunchYaw',24);input('newLaunchPitch',35);install('shipMsl');");
 assert.deepEqual(plain(run('C.shipLauncherConfig(selItem())')),{cols:3,rows:2,cells:6,yaw:24,pitch:35,embedded:false});
 run("carryToPlace();input('newLauncherCols',4);input('newLauncherRows',3);input('newLaunchYaw',-17);input('newLaunchPitch',-20);install('shipMsl',-60,350)");
 const configs=plain(run('C.deserialize(C.serialize(ship)).fits.map(C.shipLauncherConfig)'));assert.equal(configs[0].cols,3);assert.equal(configs[0].rows,2);assert.equal(configs[1].cols,4);assert.equal(configs[1].rows,3);assert.equal(configs[1].yaw,-17);assert.equal(configs[1].pitch,-20);
});

test('editing a mirrored grid and heading is one undoable native drag',()=>{
 const run=setup();run("st.fit='shipMsl';st.mirror=true;st.vmirror=true;input('newLaunchYaw',25);install('shipMsl',70);undoStack.length=0;");assert.equal(run('ship.fits.length'),4);
 run("input('launcherCols',2,false);input('launcherCols',5)");assert.equal(run('undoStack.length'),1);assert.ok(run('ship.fits.every(f=>C.shipLauncherConfig(f).cols===5)'));
 run('undo()');assert.ok(run('ship.fits.every(f=>C.shipLauncherConfig(f).cols===1)'));run('redo()');assert.ok(run('ship.fits.every(f=>C.shipLauncherConfig(f).cols===5)'));
 run("input('launchYaw',40)");assert.deepEqual(plain(run('ship.fits.map(f=>f.launchYaw).sort((a,b)=>a-b)')),[-40,-40,40,40]);
});

test('bulk grid controls leave compact aircraft launchers untouched and reject invalid inputs',()=>{
 const run=setup();run("install('shipMsl',50,150);const first=selItem().id;install('shipMsl',-50,150);const second=selItem().id;install('cmsl',50,350);st.multi.fits=new Set([first,second,selItem().id]);st.sel=null;");
 assert.match(run('launcherPitchControls(null,true)'),/multiLauncherCols/);run("input('multiLauncherCols',4)");assert.equal(run("ship.fits.filter(f=>f.k==='shipMsl'&&f.launcherCols===4).length"),2);assert.equal(run("ship.fits.find(f=>f.k==='cmsl').launcherCols"),undefined);
 const before=plain(run('C.serialize(ship)'));run("input('multiLauncherRows','');input('multiLauncherRows','not a number')");assert.deepEqual(plain(run('C.serialize(ship)')),before);
});

test('embedded placement uses the chosen structure normal even with a top-placement mode',()=>{
 const run=setup();run("st.fit='shipMsl';st.weaponMount='top';st.launcherEmbedded=true;");assert.equal(run("weaponTiltMode('shipMsl')"),true);assert.equal(run("weaponLocalMount({})"),true);assert.deepEqual(plain(run("weaponPlacementNormal('shipMsl',[0,0,1])")),[0,0,1]);
});

test('ship grid controls and palette copy translate to English',()=>{
 const run=setup(),lang=vm.createContext({navigator:{language:'en-US'}});for(const f of ['js/lang-en.js','js/i18n.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),lang);run("st.fit='shipMsl';st.launcherCols=3;st.launcherRows=2;");
 for(const html of [run('launcherPitchControls()'),run("shipLauncherControls({k:'shipMsl',launcherCols:2,launcherRows:3},'multiple')")])for(const text of html.split(/<[^>]*>/))if(text.trim())assert.doesNotMatch(lang.KSI18n.t(text),/[\u3040-\u30ff\u3400-\u9fff]/,text);
 assert.doesNotMatch(lang.KSI18n.t(C.FITS.shipMsl.name),/[\u3040-\u30ff\u3400-\u9fff]/);assert.doesNotMatch(lang.KSI18n.t(C.FITS.shipMsl.desc),/[\u3040-\u30ff\u3400-\u9fff]/);
});

test('native world-ray picking sees the rear housing through an open embedded mouth',()=>{
 const run=setup();run("ship=C.newShip({L:100,W:60,H:50,assembly:true},'Native aperture pick');ship.parts=[];ship.fits=[];ship.nextId=1;ship.armor={hull:0,cit:0};const body=C.placePart(ship,'struct',[25,7,12],[30,10,14],{form:'box'},false),f=C.placeFit(ship,'shipMsl',[40,7,12],[1,0,0],0,false,{launcherCols:3,launcherRows:2,launcherEmbedded:true,localMount:true,tilt:true}).fit;ship._geoProxy={};st.view='normal';");
 const gfx=vm.createContext({console,Core:C}); // Production picking reads Gfx.rayFit, not a launcher AABB.
 const source=fs.readFileSync(path.join(root,'js/gfx.js'),'utf8');vm.runInContext(source,gfx);const G=vm.runInContext('Gfx',gfx);
 run('globalThis.__shipUiTestGfx=null;');
 // The fixture exposes only its evaluator; bind a read-only ray bridge via C.
 C.__shipUiRayFit=G.rayFit;run("const Gfx={rayFit:(o,d,f)=>C.__shipUiRayFit(o,d,f)};");const picking=app.slice(app.indexOf('function visibleAt('),app.indexOf('// ---------- tools ----------',app.indexOf('function visibleAt('))),helpersStart=picking.indexOf('const requestedParts ='),helpersEnd=picking.indexOf('function editorRayEnv(');run(picking.slice(0,helpersStart)+picking.slice(helpersEnd));
 const hit=run("(()=>{const q=C.launcherGeometry(f),o=C.add(q.muzzles[0],C.mul(q.axis,2));return pickRay(o,C.mul(q.axis,-1),{parts:false,fits:true});})()");assert.ok(hit.fit);assert.equal(hit.fit.k,'shipMsl');assert.ok(hit.t>4,'picking passes the mouth and reaches the real rear housing');delete C.__shipUiRayFit;
});

// User instruction 2026-11-21「セル間隔と数、並び列は編集可能に」: heavy cells' column and row spacing (12.1 m default, not stored).
test('heavy cells show column and row spacing; placement carries it, an edit is one undo, and 12.1 m is not stored',()=>{
 const run=setup();run("st.fit='shipMsl';st.launcherHeavy=false;");let html=run('launcherPitchControls()');assert.ok(!html.includes('LauncherColSpacing'),'small cells have no spacing');
 run("st.launcherHeavy=true;st.launcherCols=4;st.launcherRows=2;");html=run('launcherPitchControls()');
 for(const id of ['newLauncherColSpacing','newLauncherRowSpacing'])assert.ok(html.includes('data-sl="'+id+'"'),id);
 // 2026-11-21「埋め込み専用で」: no external choice for heavy cells; the turn about the launch direction is offered
 assert.ok(!/data-newlaunchermount="external"/.test(html),'no external mount for heavy cells');assert.match(html,/大型セルは構造物に埋め込みます/);assert.ok(html.includes('data-sl="newLaunchRoll"'));
 run("st.launcherHeavy=false;st.launcherEmbedded=false;changeShipLauncher('launcherHeavy',true,'new')");assert.equal(run('st.launcherEmbedded'),true,'choosing heavy cells sets them in');assert.equal(run("changeShipLauncher('launcherEmbedded','external','new')"),false,'and they cannot be taken out');assert.match(html,/列の間隔/);assert.match(html,/段の間隔/);assert.match(html,/min="12\.1"/);assert.match(html,/max="100"/);
 // (placed with the core: the fixture's tap placement fails on main and the base too, tests 2-4 above)
 run("input('newLauncherColSpacing',18.5);input('newLauncherRowSpacing',14.9);{const h=C.rayEnv(ship,[250,500,60],[0,-1,0],{structOnly:true});C.placeFit(ship,'shipMsl',h.p,h.n,0,false,{launchPitch:0,...shipLauncherPlacementOptions()});st.sel={list:'fits',id:ship.fits.at(-1).id};}");
 assert.equal(run('selItem().launcherColSpacing'),18.5);assert.equal(run('selItem().launcherRowSpacing'),14.9);
 const q=plain(run('C.shipLauncherConfig(selItem())'));assert.equal(q.spaced,true);assert.ok(Math.abs(run('C.fitSpec(selItem()).wm')-(12.1+3*18.5))<1e-9);
 run("undoStack.length=0");run("input('launcherColSpacing',20,false);input('launcherColSpacing',25)");assert.equal(run('undoStack.length'),1);assert.equal(run('selItem().launcherColSpacing'),25);
 run('undo()');assert.equal(run('selItem().launcherColSpacing'),18.5);run('redo()');assert.equal(run('selItem().launcherColSpacing'),25);
 run("input('launcherColSpacing',12.1);input('launcherRowSpacing',3)");assert.equal(run("'launcherColSpacing' in selItem()"),false,'back to touching: nothing stored');assert.equal(run("'launcherRowSpacing' in selItem()"),false,'below 12.1 m is 12.1 m');
 const saved=plain(run('C.deserialize(C.serialize(ship)).fits.map(C.shipLauncherConfig)'));assert.equal(saved[0].colSpacing,12.1);
 // regression review 2026-11-21 (FAIL): the linked mirror twin turns the other way (and back to none)
 assert.deepEqual(plain(run("(()=>{const base={k:'shipMsl',launcherHeavy:true,p:[50,20,10],n:[0,1,0],a:2,ped:0,base:0},from={...base,launchYaw:10,launchRoll:30},to={...base,p:[50,20,-10]},out=[];syncFitTwin(from,to,{z:true});out.push(to.launchRoll,to.launchYaw);syncFitTwin(from,to,{z:true,y:true});out.push(to.launchRoll);delete from.launchRoll;syncFitTwin(from,to,{z:true});out.push('launchRoll' in to);return out;})()")),[-30,-10,30,false]);
 // regression review 2026-11-21: copying a heavy launcher with the default spacing (not stored) resets a spaced one
 assert.deepEqual(plain(run("(()=>{const to={k:'shipMsl',launcherHeavy:true,launcherColSpacing:30,launcherRowSpacing:20},from={k:'shipMsl',launcherHeavy:true,launcherCols:2,launcherRows:1};launcherSpacingFrom(from,to);return ['launcherColSpacing' in to,'launcherRowSpacing' in to];})()")),[false,false]);
 assert.deepEqual(plain(run("(()=>{const to={k:'shipMsl',launcherHeavy:true},from={k:'shipMsl',launcherHeavy:true,launcherColSpacing:18.5};launcherSpacingFrom(from,to);return [to.launcherColSpacing,'launcherRowSpacing' in to];})()")),[18.5,false]);
 assert.equal(run("(()=>{const to={k:'shipMsl',launcherHeavy:true,launcherColSpacing:30};launcherSpacingFrom({k:'shipMsl'},to);return to.launcherColSpacing;})()"),30,'a small-cell source leaves the spacing alone');
});
