const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance:{now:()=>0}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx),plain=v=>JSON.parse(JSON.stringify(v)),near=(a,b,e=1e-8)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
function fixture(){const s=C.newShip({L:180,W:100,H:80,assembly:true},'Legacy concussion launchers');s.parts=[];s.fits=[];s.nextId=1;s.armor={hull:0,cit:0};const body=C.placePart(s,'struct',[90,30,0],[150,80,40],{form:'box'},false);return {s,body};}
function raw(fits){const {s}=fixture(),data=plain(C.serialize(s));data.fits=fits;data.nextId=Math.max(2,...fits.map(f=>f.id+1));return data;}
const fit=(id,mount='ext',extra={})=>({id,k:'msl',p:[40+id*15,50,15],a:2,ped:0,base:0,low:0,float:false,...(mount?{mount}:{}),...extra});
const launchers=s=>[...s.fits.filter(f=>C.isConcussionLauncher(f)),...C.surfaceDerivedFits(s).filter(f=>C.isConcussionLauncher(f))];

test('legacy external launchers retain IDs, linked placement and pitch as compact native missile pods',()=>{
 const data=raw([fit(10,'ext',{p:[70,50,15],tw:11,launchPitch:32.5}),fit(11,'ext',{p:[70,50,-15],tw:10,launchPitch:32.5})]),before=plain(data),s=C.deserialize(data);
 assert.deepEqual(data,before,'reading a design leaves the original imported file intact');assert.equal(s.fits.length,2);
 for(const [i,f]of s.fits.entries()){assert.equal(f.k,'cmsl');assert.equal(f.id,before.fits[i].id);assert.equal(f.tw,before.fits[i].tw);assert.deepEqual(plain(f.p),before.fits[i].p);near(C.launcherPitch(f),32.5);assert.equal(C.isSurfaceVLS(f),false);assert.equal(C.missileLauncherSpec(f).ammo,6);}
 const serial=plain(C.serialize(s)),again=C.deserialize(serial),twice=plain(C.serialize(again));assert.deepEqual(twice,serial,'a second load cannot add offsets, magazines or another pod');assert.ok(!JSON.stringify(serial).includes('legacyMissileMount'),'completed migration does not persist a work-in-progress marker');
});

test('old default and explicit VLS migrate into equipment surfaces without duplicating launcher IDs',()=>{
 const source=raw([fit(10,null,{p:[60,50,-14]}),fit(11,'vls',{p:[110,50,14]})]),before=plain(source),s=C.deserialize(source);C.syncCompartments(s);
 assert.deepEqual(source,before);const rows=launchers(s);assert.equal(rows.length,2);assert.deepEqual(rows.map(f=>f.id).sort((a,b)=>a-b),[10,11]);assert.equal(new Set(rows.map(f=>f.id)).size,2);
 assert.equal(s.fits.filter(f=>C.isConcussionLauncher(f)).length,0,'old VLS cannot remain as an external fitting');
 for(const f of rows){assert.equal(f.k,'cmsl');assert.equal(C.isSurfaceVLS(f),true);assert.ok(f.surfacePatch);assert.ok(C.surfaceBatteryGeometry(f).vls);const patch=s.surfaces.patches.find(p=>p.id===f.surfacePatch);assert.ok(patch);assert.equal(patch.functionMode,'equipment');}
 const saved=plain(C.serialize(s)),again=C.deserialize(saved);C.surfaceSync(again);C.surfaceSync(again);const migrated=launchers(again);assert.equal(migrated.length,2);assert.deepEqual(migrated.map(f=>f.id).sort((a,b)=>a-b),[10,11]);assert.deepEqual(plain(C.serialize(again)),saved,'surface migration and recompilation are idempotent');
});

test('frozen nested legacy designs canonicalize without mutating their saved copies',()=>{
 const blueprint=raw([fit(10,'ext',{launchPitch:-27})]),container={template:{format:'starship-yard-part',v:1,parts:[],fits:[fit(1,'ext',{launchPitch:44})]},ctgs:[{tgs:[{ships:[{carried:[{design:{blueprint}}]}]}]}]};
 const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};freeze(container);const before=plain(container),out=C.migrateWeaponDesign(container);assert.deepEqual(plain(container),before);
 assert.equal(out.template.fits[0].k,'cmsl');assert.equal(out.ctgs[0].tgs[0].ships[0].carried[0].design.blueprint.fits[0].k,'cmsl');near(out.template.fits[0].launchPitch,44);near(out.ctgs[0].tgs[0].ships[0].carried[0].design.blueprint.fits[0].launchPitch,-27);
});

test('an old VLS whose mounting face is gone remains inactive saved inventory',()=>{
 const source=raw([fit(10,'vls',{p:[400,50,15]})]),s=C.deserialize(source);C.surfaceSync(s);
 const inventory=design=>(C.serialize(design).surfaces?.patches||[]).flatMap(q=>q.aggregate?.guns||[]).filter(r=>r[0]===10);
 assert.equal(inventory(s).length,1,'a missing face cannot silently delete the launcher');assert.equal(inventory(s)[0][1],'cmsl');assert.equal(C.missileCells(s).length,0,'an orphan VLS cannot gain a working magazine');assert.equal(launchers(s).filter(f=>!f.surfaceUnplaced&&!f.float).length,0);
 const saved=plain(C.serialize(s)),again=C.deserialize(saved);C.surfaceSync(again);assert.equal(inventory(again).length,1);assert.deepEqual(plain(C.serialize(again)),saved,'orphan inventory survives an ordinary save/reload unchanged');
});

test('mount-relative pitch survives mirrored templates and repeated design saves',()=>{
 const {s,body}=fixture();for(const [id,z]of [[10,18],[11,-18]])s.fits.push({id,k:'cmsl',p:[90,50,z],a:2,ped:0,base:0,low:0,float:false,launchPitch:-42.25,tw:id===10?11:10});s.nextId=12;
 const template=C.normalizeAssemblyTemplate(plain(C.assemblyCapture(s,{parts:[body.id],fits:[10,11]},{name:'Angled compact launchers'}).template));assert.equal(template.fits.length,2);for(const f of template.fits)near(f.launchPitch,-42.25);
 const dest=C.newShip({L:600,W:400,H:200,assembly:true},'Mirrored missile rack');dest.parts=[];dest.fits=[];dest.armor={hull:0,cit:0};const result=C.assemblyPlace(dest,template,[260,70,100],{mirror:true});assert.equal(result.error,undefined,result.error);assert.equal(dest.fits.length,4);
 for(const f of dest.fits){near(C.launcherPitch(f),-42.25);const g=C.launcherGeometry(f);assert.ok(C.dot(g.axis,C.fitUp(f))<0,'both reflected sides depress relative to their own mounting plane');}
 const saved=plain(C.serialize(dest)),loaded=C.deserialize(saved),twice=C.deserialize(C.serialize(loaded));for(const design of [loaded,twice]){assert.equal(design.fits.length,4);for(const f of design.fits)near(f.launchPitch,-42.25);}assert.deepEqual(plain(C.serialize(twice)),plain(C.serialize(loaded)));
});

test('invalid and extreme angles normalize safely without changing mounting normals',()=>{
 for(const [value,expected]of [[NaN,0],[Infinity,0],[-Infinity,0],['40',0],[1000,90],[-1000,-90],[0,0]]){const f={id:1,k:'cmsl',p:[0,0,0],a:2,ped:0,base:0,low:0,float:false,launchPitch:value},normal=plain(C.fitUp(f));near(C.launcherPitch(f),expected);const g=C.launcherGeometry(f);assert.deepEqual(plain(C.fitUp(f)),normal);for(const v of [...g.bounds,...g.origin,...g.axis])assert.ok(Number.isFinite(v),'invalid UI/import values cannot poison geometry or firing');}
 const data=raw([fit(10,'ext')]),loaded=C.deserialize(data);assert.equal(C.launcherPitch(loaded.fits[0]),0,'old external launchers remain flush until the user changes their angle');
});
