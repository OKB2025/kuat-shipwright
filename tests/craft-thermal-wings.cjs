const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const C=vm.runInContext('Core',context),plain=v=>JSON.parse(C.publicJSON(v)),fixtures=new Map();
const expected={
 craft_arc170:{ids:[9,10,11,12,13,14,15,16],labels:/主翼（|Sフォイル（放熱板）/},
 craft_btlb:{ids:[3,4],labels:/^主翼（ナセル支持）$/},
 craft_hyena:{ids:[3,4,5,6],labels:/^(上翼|下翼)$/},
 craft_v19:{ids:[5,6,7,8,9],labels:/主翼（Sフォイル|腹部Sフォイル/},
 craft_vulture:{ids:[4,5,6,7],labels:/^(上翼|下翼)$/},
 craft_vwing:{ids:[1,2,3,4],labels:/部翼（放熱板）/},
 craft_xwing:{ids:[2,3,16,17],labels:/[上下]翼（Sフォイル）$/},
 craft_z95:{ids:[7,8],labels:/主翼$/}
};
function fixture(key){if(!fixtures.has(key)){const ship=C.buildDesign(key),stats=C.computeStats(ship);fixtures.set(key,{ship,stats});}return fixtures.get(key);}
for(const [key,exp] of Object.entries(expected))test(`${key} uses its original measured main-wing panels as heat-dissipating devices`,()=>{
 const {ship,stats}=fixture(key),raw=C.dedicateAeroParts(C.SHIP_EXAMPLES[key].build()),panels=raw.parts.filter(p=>p.wing?.thermal==='high');
 assert.deepEqual(plain(panels.map(p=>p.id)),exp.ids);
 assert.equal(raw.parts.some(p=>p.k==='hdisx'),false,'there is no external box hidden in a wing');
 for(const p of panels){
  assert.equal(p.k,'wing','each measured main-wing panel is an independent wing catalogue part');
  assert.match(p.label,exp.labels);
  assert.ok(p.s.every(v=>Number.isFinite(v)&&v>0));
  const d=stats.heat.net.dis.filter(d=>d.part===p.id);
  assert.equal(d.length,1,'the physical wing contributes one heat sink');
  assert.equal(d[0].grade,'high');assert.ok(d[0].cap>0&&Number.isFinite(d[0].cap));
  const current=ship.parts.find(q=>q.id===p.id);assert.deepEqual(plain(current),plain(p));
  if(p.tw){const twin=panels.find(q=>q.id===p.tw);assert.ok(twin,'both panels use the direct device model');assert.equal(twin.tw,p.id);assert.deepEqual(plain(twin.s),plain(p.s));}
 }
 const loaded=C.deserialize(C.serialize(ship));
 assert.deepEqual(plain(loaded.parts.filter(p=>p.wing?.thermal==='high')),plain(ship.parts.filter(p=>p.wing?.thermal==='high')),'a save preserves wing geometry, identity and equipment');
});

test('TIE collector panels keep one direct solar-and-heat device without a second thermal layer',()=>{
 for(const [key,count] of [['craft_tie_ln',2],['craft_tie_in',6],['craft_tie_sa',6]]){
  const {ship,stats}=fixture(key),panels=ship.parts.filter(p=>p.wing?.solar);assert.equal(panels.length,count);
  for(const p of panels){assert.equal(p.k,'solarPanel');assert.equal(p.wing.thermal,'high');const ds=stats.heat.net.dis.filter(d=>d.part===p.id);assert.equal(ds.length,1);assert.equal(ds[0].k,'solar');assert.ok(ds[0].cap>0);}
 }
});

test('X-wing heat devices keep the same four S-foil mechanisms and their mounted assemblies',()=>{
 const {ship,stats}=fixture('craft_xwing'),foils=ship.parts.filter(C.isFoil);assert.equal(foils.length,4);
 for(const w of foils){
  assert.equal(w.wing.thermal,'high');assert.equal(w.wing.T,1);assert.equal(w.wing.axis,'x');
  assert.equal(w.wing.members.fits.length,1);assert.ok(w.wing.members.parts.length>=7);
  const M=C.wingMembers(ship,w);assert.ok(M.parts.some(p=>p.k==='engine'));assert.equal(M.fits.length,1);
  const x=stats.wings.find(x=>x.id===w.id);assert.ok(x.capOpen>x.capStow&&x.capStow>0);
  assert.ok(C.foilPose(ship,w,w.wing.stow).parts.some(p=>p.id===w.id));
 }
});

test('wing hubs, weapon housings, markings and A-wing stabilizers remain separate structural pieces',()=>{
 for(const key of Object.keys(C.CRAFT_SYSTEM_RECIPES)){
  const {ship}=fixture(key);
  for(const p of ship.parts.filter(p=>p.k==='struct'&&/翼.*(ハブ|支持|支柱|外枠|砲架|砲身|識別)|駆動部フェアリング|翼端砲ハウジング/.test(p.label||''))){
   if(p.label==='主翼（ナセル支持）')continue;
   assert.equal(p.wing?.thermal,undefined,key+' '+p.label);
  }
 }
 const {ship}=fixture('craft_awing');assert.equal(ship.parts.filter(p=>/安定翼/.test(p.label||'')).length,4);assert.equal(ship.parts.some(p=>p.wing?.thermal),false,'the A-wing broad fuselage is not a separate main-wing part');
});
