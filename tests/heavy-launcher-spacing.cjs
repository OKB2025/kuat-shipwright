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
// Heavy cells are set into a structure (embedded only), so the test ships carry one big box structure.
function structShip(name){const s=C.newShip({L:300,W:160,H:120,assembly:true},name);s.parts=[];s.fits=[];s.nextId=1;C.placePart(s,'struct',[150,40,0],[200,160,80],{form:'box'},false);return [s,{p:[150,80,45],n:[0,1,0]}];}
test('cells touching is the default: nothing is stored and the launcher is the same as before',()=>{
 assert.equal(cell,12.1);assert.equal(C.HEAVY_LAUNCHER.spacingMax,100);
 const a=fit(),b=fit({launcherColSpacing:12.1,launcherRowSpacing:12.1}),qa=C.shipLauncherConfig(a),qb=C.shipLauncherConfig(b);
 assert.equal(qa.colSpacing,cell);assert.equal(qa.rowSpacing,cell);assert.equal(qa.spaced,undefined);assert.equal(qb.spaced,undefined);
 assert.deepEqual(JSON.parse(JSON.stringify(C.launcherGeometry(a))),JSON.parse(JSON.stringify(C.launcherGeometry(b))),'an explicit 12.1 m is the default');
 assert.equal(JSON.stringify(C.launcherStateKey(a)),JSON.stringify(C.launcherStateKey(b)),'the state key of an unspaced launcher has no spacing in it');
 const d=C.fitSpec(a);near(d.wm,4*cell);near(d.hm,2*cell);
 const g=C.launcherGeometry(a);near(dist(g.muzzles[0],g.muzzles[1]),cell,'neighbouring columns');near(dist(g.muzzles[0],g.muzzles[4]),cell,'neighbouring rows');
 const [s,h]=structShip('Spacing default');
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
 const [s,h]=structShip('Spacing ship');
 C.placeFit(s,'shipMsl',h.p,h.n,0,true,{launcherCols:4,launcherRows:2,launcherEmbedded:false,launcherHeavy:true,launcherColSpacing:18.5,launcherRowSpacing:14.9});
 const fits=s.fits.filter(f=>f.k==='shipMsl');assert.ok(fits.length>=1);
 for(const f of fits){assert.equal(f.launcherColSpacing,18.5);assert.equal(f.launcherRowSpacing,14.9);}
 const back=C.deserialize(JSON.parse(JSON.stringify(C.serialize(s)))).fits.filter(f=>f.k==='shipMsl');assert.equal(back.length,fits.length);
 for(const f of back){assert.equal(f.launcherColSpacing,18.5);assert.equal(f.launcherRowSpacing,14.9);near(C.fitSpec(f).wm,cell+3*18.5);}
});
// User decisions 2026-11-21:「埋め込み専用で」(heavy cells are set in only),「埋め込みの角度も変更できるようにして。普通の構造物と同じ
// ように回転できる形に」(a turn about the launch direction beside its two angles) and「VLSの蓋は描くだけではなく円柱型のパーツもつけて」
// → asked which form,「表面に出る円柱の蓋」(each lid is a cylinder standing 1 m out of the mouth, part of the launcher's extent).
test('heavy cells are embedded whatever the old file says; small cells keep their choice',()=>{
 assert.equal(C.shipLauncherConfig(fit({launcherEmbedded:false})).embedded,true);assert.equal(C.shipLauncherConfig(fit()).embedded,true);
 assert.equal(C.shipLauncherConfig({k:'shipMsl',launcherEmbedded:false}).embedded,false);assert.equal(C.shipLauncherConfig({k:'shipMsl',launcherEmbedded:true}).embedded,true);
 const [s,h]=structShip('Embedded only');
 C.placeFit(s,'shipMsl',h.p,h.n,0,false,{launcherCols:2,launcherRows:1,launcherEmbedded:false,launcherHeavy:true});assert.equal(s.fits.at(-1).launcherEmbedded,true,'placement sets it in');
});
test('a turn about the launch direction rotates the cells around the launch axis; none is the old launcher',()=>{
 const a=fit({launcherRows:1}),b=fit({launcherRows:1,launchRoll:90}),ga=C.launcherGeometry(a),gb=C.launcherGeometry(b);
 assert.equal(C.shipLauncherConfig(a).roll,undefined);assert.equal(C.shipLauncherConfig(b).roll,90);assert.equal(C.shipLauncherConfig(fit({launchRoll:400})).roll,180);
 const axisA=[...ga.axis],axisB=[...gb.axis];for(let i=0;i<3;i++)near(axisA[i],axisB[i],'the launch direction is kept');
 const rowA=C.sub(ga.muzzles[1],ga.muzzles[0]),rowB=C.sub(gb.muzzles[1],gb.muzzles[0]);near(Math.abs(C.dot(C.norm(rowA),C.norm(rowB))),0,'the row of cells turned a quarter');near(C.len(rowB),cell);
 assert.equal(JSON.stringify(C.launcherStateKey(a)),JSON.stringify(C.launcherStateKey(fit({launcherRows:1,launchRoll:0}))));assert.notEqual(JSON.stringify(C.launcherStateKey(b)),JSON.stringify(C.launcherStateKey(a)));
 const [s,h]=structShip('Roll ship');
 C.placeFit(s,'shipMsl',h.p,h.n,0,true,{launcherCols:2,launcherRows:1,launcherHeavy:true,launchRoll:30});const fits=s.fits.filter(f=>f.k==='shipMsl');
 assert.ok(fits.some(f=>f.launchRoll===30));if(fits.length===2)assert.ok(fits.some(f=>f.launchRoll===-30),'the mirror turns the other way');
 const back=C.deserialize(JSON.parse(JSON.stringify(C.serialize(s)))).fits.filter(f=>f.k==='shipMsl');assert.deepEqual(back.map(f=>f.launchRoll).sort(),fits.map(f=>f.launchRoll).sort());
});
test('each heavy lid is a cylinder standing 1 m out of its mouth, inside the launcher extent',()=>{
 const g=C.launcherGeometry(fit());assert.equal(g.lids.length,8);const L=C.HEAVY_LAUNCHER.lid;assert.equal(L.height,1);
 for(let i=0;i<8;i++){const l=g.lids[i],m=g.muzzles[i];near(C.dot(C.sub(l.top,m),g.axis),1,'1 m out');near(C.dot(C.sub(m,l.base),g.axis),.25,'.25 m in');near(l.radius,.42*cell);
  for(let k=0;k<3;k++)assert.ok(l.top[k]>=g.bounds[k]-1e-9&&l.top[k]<=g.bounds[k+3]+1e-9,'the lid is in the extent');}
 assert.equal(C.launcherGeometry({k:'shipMsl',launcherCols:2,launcherRows:2,p:[0,0,0],n:[0,1,0],a:2}).lids,undefined,'small cells have no lid cylinder');
});
