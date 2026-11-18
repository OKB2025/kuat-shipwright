// The twin 720 TT turret asked for by the Mandator II plan is the existing capital-family key `utl`
// (docs/capital-turret-family.md). These checks keep that identity usable everywhere a turret is used.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx),plain=v=>JSON.parse(JSON.stringify(v)),near=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<=e*Math.max(1,Math.abs(b)),`${a} != ${b}`);
function fixture(){const s=C.newShip({L:600,W:240,H:120,assembly:true},'Twin 720 fixture');s.parts=[];s.fits=[];s.nextId=1;s.armor={hull:0,cit:0};C.placePart(s,'struct',[300,60,0],[500,200,120],{form:'box'},false);return s;}

test('the twin 720 TT turret is the capital family utl key: 2 barrels × 720 TT, 1 s cycle, 1.5× the 175 TT twin',()=>{
 const d=C.fitSpec({k:'utl'}),twin175=C.fitSpec({k:'stl'});
 assert.equal(d.name,'720TT 2連装超重ターボレーザー');assert.equal(d.short,'720TT 2連装');assert.equal(d.asset,'capital_twin720');
 assert.equal(d.barrels,2);assert.equal(d.boltTT,720);assert.equal(d.cycle,1);assert.equal(d.tt,1440);
 assert.deepEqual([d.fm,d.hm,d.wm],[90,24.75,67.5]);assert.deepEqual([twin175.fm,twin175.wm],[60,45]);near(d.fm/twin175.fm,1.5);near(d.wm/twin175.wm,1.5);
 assert.equal(d.mass,52000);assert.equal(d.cost,6e6);assert.equal(d.crew,60);near(d.power,1440*4.184e21);
 const q=C.weaponChargeSpec({k:'utl'});assert.equal(q.barrels,2);assert.equal(q.boltTT,720);assert.equal(q.volleyTT,1440);
 const st=C.weaponPreviewStats({k:'utl'});assert.equal(st.kind,'energy');assert.equal(st.barrels,2);assert.equal(st.outputTT,720);assert.ok(st.rangeM>0);
 assert.ok(!C.FITS.twin720,'no second key duplicates the existing twin 720 TT turret');
});

test('placement, statistics, fleet profile and save/load carry the twin 720 TT turret',()=>{
 const s=fixture(),r=C.placeFit(s,'utl',[300,120,0],[0,1,0],1,false,{});assert.ok(!r.err,r.err);assert.equal(r.fit.float,false);
 const S=C.computeStats(s);assert.equal(S.allGunVolleyTT,1440);const p=C.fleetProfile(S,s.name,s),m=p.modules.find(q=>q.fit===r.fit.id);assert.equal(m.k,'weapon');assert.equal(m.name,'720TT 2連装');near(m.size,1440,1e-3);assert.equal(m.band,'long');
 const loaded=C.deserialize(C.serialize(s));C.remount(loaded);const q=loaded.fits.find(f=>f.id===r.fit.id);assert.equal(q.k,'utl');assert.equal(q.float,false);assert.deepEqual(plain(q.p),plain(r.fit.p));assert.equal(C.computeStats(loaded).allGunVolleyTT,1440);
});

test('the editor catalogue and English catalog list the twin 720 TT turret',()=>{
 const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),en=fs.readFileSync(path.join(root,'js/lang-en.js'),'utf8');
 assert.match(app,/'ball720','utl'/);for(const term of ['720TT 2連装超重ターボレーザー','720TT 2連装'])assert.ok(en.includes(`"${term}":`),term);
});
