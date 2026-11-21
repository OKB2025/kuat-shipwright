// User instruction 2026-11-19/21 for the heavy launcher (cells for the 7 m by 50 m round):「セル間隔と数、並び列は編集可能に」, so it
// fits the Victory-class model's missile covers (13.4 m round, about 18.5 m apart along the hull, 14.9 m between rows), and「蓋が丸い
// ならそのままでいい」(the cells keep their square boxes and round lids) and「間隔を広げた時も装甲を残さなくていい」(an embedded
// launcher is still cut as one box). The spacing is set apart for the columns and the rows, from 12.1 m (cells touching, the size
// measured on the Mandator II's racks) to 100 m; 12.1 m is the default and is not stored, so existing designs are unchanged.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),near=(a,b,m)=>assert.ok(Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(b)),`${m||''} ${a} != ${b}`);
const cell=C.HEAVY_LAUNCHER.cell,fit=o=>({id:9,k:'shipMsl',launcherCols:4,launcherRows:2,launcherHeavy:true,p:[0,0,0],n:[0,1,0],a:2,ped:0,base:0,...o});
const dist=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
test('cells touching is the default: nothing is stored and the launcher is the same as before',()=>{
 assert.equal(cell,12.1);assert.equal(C.HEAVY_LAUNCHER.spacingMax,100);
 const a=fit(),b=fit({launcherColSpacing:12.1,launcherRowSpacing:12.1}),qa=C.shipLauncherConfig(a),qb=C.shipLauncherConfig(b);
 assert.equal(qa.colSpacing,cell);assert.equal(qa.rowSpacing,cell);assert.equal(qa.spaced,undefined);assert.equal(qb.spaced,undefined);
 assert.deepEqual(JSON.parse(JSON.stringify(C.launcherGeometry(a))),JSON.parse(JSON.stringify(C.launcherGeometry(b))),'an explicit 12.1 m is the default');
 assert.equal(JSON.stringify(C.launcherStateKey(a)),JSON.stringify(C.launcherStateKey(b)),'the state key of an unspaced launcher has no spacing in it');
 const d=C.fitSpec(a);near(d.wm,4*cell);near(d.hm,2*cell);
 const g=C.launcherGeometry(a);near(dist(g.muzzles[0],g.muzzles[1]),cell,'neighbouring columns');near(dist(g.muzzles[0],g.muzzles[4]),cell,'neighbouring rows');
 const s=C.newShip({L:900,W:300,H:150},'Spacing default'),h=C.rayEnv(s,[450,400,60],[0,-1,0],{structOnly:true});
 C.placeFit(s,'shipMsl',h.p,h.n,0,false,{launcherCols:4,launcherRows:2,launcherEmbedded:false,launcherHeavy:true,launcherColSpacing:12.1,launcherRowSpacing:12.1});
 const f=s.fits.find(f=>f.k==='shipMsl');assert.ok(!('launcherColSpacing' in f)&&!('launcherRowSpacing' in f),'the default is not stored');
 const saved=C.serialize(s).fits.find(q=>q.k==='shipMsl');assert.ok(!('launcherColSpacing' in saved)&&!('launcherRowSpacing' in saved));
 assert.equal(C.shipLauncherConfig({k:'shipMsl',launcherColSpacing:30}).colSpacing,undefined,'small cells have no spacing');
});
test('the spacing moves the cells apart and widens the body; rounds, mass and cost follow the cell count',()=>{
 const plain=fit(),wide=fit({launcherColSpacing:18.5,launcherRowSpacing:14.9}),q=C.shipLauncherConfig(wide);
 assert.equal(q.spaced,true);assert.equal(q.colSpacing,18.5);assert.equal(q.rowSpacing,14.9);
 const d=C.fitSpec(wide),d0=C.fitSpec(plain);near(d.wm,cell+3*18.5,'width: one cell plus three gaps');near(d.hm,cell+14.9,'height');assert.equal(d.fm,d0.fm);
 near(d.mass,d0.mass);near(d.cost,d0.cost);near(d.power,d0.power);assert.equal(d.store.slots,d0.store.slots);
 const g=C.launcherGeometry(wide);assert.equal(g.muzzles.length,8);near(dist(g.muzzles[0],g.muzzles[1]),18.5,'columns 18.5 m apart');near(dist(g.muzzles[0],g.muzzles[4]),14.9,'rows 14.9 m apart');
 assert.deepEqual([...g.cellSize.slice(1)],[cell,cell],'each cell keeps its 12.1 m size');
 const s0=C.missileLauncherSpec(plain),s1=C.missileLauncherSpec(wide);assert.equal(s1.salvo,s0.salvo);assert.equal(s1.ammo,s0.ammo);near(s1.volleyTT,s0.volleyTT);
 assert.notEqual(JSON.stringify(C.launcherStateKey(wide)),JSON.stringify(C.launcherStateKey(plain)),'the body and its recess are rebuilt when the spacing changes');
 assert.equal(C.shipLauncherConfig(fit({launcherColSpacing:5,launcherRowSpacing:500})).colSpacing,cell,'no closer than touching');
 assert.equal(C.shipLauncherConfig(fit({launcherRowSpacing:500})).rowSpacing,100,'no further than 100 m');
});
test('a placed launcher keeps its spacing through its mirror, a save and a reload',()=>{
 const s=C.newShip({L:900,W:300,H:150},'Spacing ship'),h=C.rayEnv(s,[450,400,60],[0,-1,0],{structOnly:true});
 C.placeFit(s,'shipMsl',h.p,h.n,0,true,{launcherCols:4,launcherRows:2,launcherEmbedded:false,launcherHeavy:true,launcherColSpacing:18.5,launcherRowSpacing:14.9});
 const fits=s.fits.filter(f=>f.k==='shipMsl');assert.ok(fits.length>=1);
 for(const f of fits){assert.equal(f.launcherColSpacing,18.5);assert.equal(f.launcherRowSpacing,14.9);}
 const back=C.deserialize(JSON.parse(JSON.stringify(C.serialize(s)))).fits.filter(f=>f.k==='shipMsl');assert.equal(back.length,fits.length);
 for(const f of back){assert.equal(f.launcherColSpacing,18.5);assert.equal(f.launcherRowSpacing,14.9);near(C.fitSpec(f).wm,cell+3*18.5);}
});
