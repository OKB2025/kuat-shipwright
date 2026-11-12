const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const C=vm.runInContext('Core',context),plain=value=>JSON.parse(JSON.stringify(value)),near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(b))*1e-10,`${a} differs from ${b}`);
function fixture({cooler=false,power=true,pathCapacity=null}={}){
 const ship=C.newShip({L:40,W:24,H:20,plan:'rect',sec:'rect'},'Thermal readout fixture');
 ship.parts=[...(power?[{id:1,k:'gen',c:[30,10,0],d:2},{id:4,k:'pump',c:[30,10,3],d:.5}]:[]),...(cooler?[{id:2,k:'hdis',c:[20,10,0],d:.6}]:[])];ship.fits=[];ship.nextId=5;
 if(pathCapacity!=null)ship.links=[{kind:'heat',from:'p1',to:'p2',cap:pathCapacity}];
 return {ship,stats:C.computeStats(ship)};
}

test('thermal specifications retain real sink ratings rather than the much smaller present heat flow',()=>{
 const {stats}=fixture({cooler:true}),H=stats.heat,before=C.publicJSON(stats),rates=C.heatReadoutRates(H);
 assert.equal(H.mode,'strict');assert.ok(rates.equipmentMaxHeatW>0);near(rates.rejectionCapacityW,H.disCap+H.skin);
 // 2026-11-12 user decision: the hull skin removes no heat; only the installed converter is represented.
 assert.ok(H.disCap>0);assert.equal(H.skin,0);assert.ok(!H.net.dis.some(d=>d.k==='skin'));
 assert.ok(rates.rejectionCapacityW>H.presets.combat.out,'a lightly loaded sink retains spare rated capacity '); // 2026-11-12: the fixture's 0.2 m hdis (8.4e16 W) cannot take its 1.6e18 W hotel heat once the hull skin (×100 of it) is gone; 0.6 m (2.3e18 W) restores a lightly loaded sink, so the margin is >1× instead of the skin's >100×);
 assert.equal(C.publicJSON(stats),before,'reading a specification does not change operating loads, warnings or heat paths');
});

test('rated total does not turn a missing converter or a limited heat path into usable cooling',()=>{
 for(const options of [{},{cooler:true,pathCapacity:1e6}]){
  const {stats}=fixture(options),H=stats.heat,before=C.publicJSON(stats),rates=C.heatReadoutRates(H);
  // 2026-11-12: without the hull skin a ship with no converter has zero rejection capacity.
  if(!options.cooler)assert.equal(rates.rejectionCapacityW,0);
  assert.ok(H.presets.combat.stored>0,'waste still accumulates when its actual route cannot carry it');
  // no converter: the inspection names the converter volume; converter present but path-limited: add heat paths
  assert.ok(stats.warnings.some(w=>w.code==='heat'&&(options.cooler?/変換能力は足りています。熱輸送路を足してください。/:/熱エネルギー変換装置を約 .+ m³ 追加すると解消します。/).test(w.text)),JSON.stringify(stats.warnings.filter(w=>w.code==='heat').map(w=>w.text)));
  assert.equal(C.publicJSON(stats),before);
 }
});

test('an unpowered installed cooler contributes no powered rejection capacity',()=>{
 const {stats}=fixture({cooler:true,power:false}),H=stats.heat,rates=C.heatReadoutRates(H);
 assert.equal(H.disCap,0);assert.ok(H.dis.some(d=>d.id===2&&d.cap===0));near(rates.rejectionCapacityW,H.skin);
 assert.ok(stats.warnings.some(w=>w.code==='heat'&&/給電経路のない設備/.test(w.text)));
});

test('equipment maxima include overload and preserve independently peaking equipment ratings',()=>{
 // Existing engineering `size` excludes overload. The two devices below
 // also peak at different presets, so a simultaneous-load maximum is not
 // the requested sum of their separate equipment maxima.
 const H={net:{src:[{rated:{cruise:1,max:10,hold:3},size:3},{rated:{cruise:20,max:2,hold:4},size:20}]},disCap:7,skin:8},before=plain(H);
 assert.deepEqual(plain(C.heatReadoutRates(H)),{equipmentMaxHeatW:30,rejectionCapacityW:15});assert.deepEqual(H,before);
});

test('missing, old and invalid thermal caches remain unavailable instead of becoming fabricated zero ratings',()=>{
 for(const H of [null,undefined,{}, {net:{}}, {net:{src:[{rated:{}}]}}, {net:{src:[{rated:{combat:NaN}}]}}, {net:{src:[{rated:{combat:-1}}]}}, {net:{src:[{rated:{combat:Infinity}}]}}]){
  const rates=C.heatReadoutRates(H);assert.equal(rates.equipmentMaxHeatW,null);assert.equal(rates.rejectionCapacityW,null);
 }
 const partial=C.heatReadoutRates({disCap:4,skin:6});assert.equal(partial.equipmentMaxHeatW,null);assert.equal(partial.rejectionCapacityW,10);
 for(const H of [{net:{src:[]},disCap:NaN,skin:1},{net:{src:[]},disCap:1,skin:-1},{net:{src:[]},disCap:1e308,skin:1e308}]){
  const rates=C.heatReadoutRates(H);assert.equal(rates.equipmentMaxHeatW,0);assert.equal(rates.rejectionCapacityW,null);
 }
 assert.equal(C.heatReadoutRates({net:{src:[{rated:{max:1e308}},{rated:{max:1e308}}]},disCap:0,skin:0}).equipmentMaxHeatW,null);
 assert.deepEqual(plain(C.heatReadoutRates({net:{src:[]},disCap:0,skin:0})),{equipmentMaxHeatW:0,rejectionCapacityW:0});
});
