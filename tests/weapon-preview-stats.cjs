const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),{C}=require('../scripts/update-ship-examples.cjs').loadRuntime(root),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(b))*1e-10,`${a} != ${b}`),plain=v=>JSON.parse(JSON.stringify(v));
function fn(name){const start=new RegExp('function '+name+'\\s*\\(').exec(app);assert.ok(start,name);for(let end=app.indexOf('}',start.index);end>=0;end=app.indexOf('}',end+1)){const text=app.slice(start.index,end+1);try{new vm.Script(text);return text;}catch{}}assert.fail(name);}
function ui(){const cx=vm.createContext({C});vm.runInContext(`const T=x=>x,esc=String,fTT=v=>v+' TT',fW=v=>v+' W',num=(v,n=0)=>Number(v).toFixed(n);const ship={surfaces:{mode:'strict'}},st={tab:'edit'},eng={gen:2,statsGen:2};let S=null;${fn('designWeaponOutput')}\n${fn('designWeaponPreviewHTML')}`,cx);return code=>vm.runInContext(code,cx);}

test('40TT and70TT categories use each physical barrel across single, multiple and spherical variants',()=>{
 const run=ui();for(const [output,keys]of [[40,['single40','quad40Ion','twin40Dome','twin40','triple40','oct40']],[70,['refVen','triple70','quad70Side','venSide70']]])for(const k of keys){
  near(C.weaponPreviewStats(k).outputTT,output);near(run('designWeaponOutput({type:"fit",key:'+JSON.stringify(k)+'})'),output);
 }
 assert.notEqual(C.FITS.oct40.tt,40,'the regression distinguishes salvo energy from one physical barrel');
});

test('maximum input and local heat match the existing shot-energy ledger at full sustained cadence',()=>{
 for(const k of ['single40','oct40','refVen','quad40Ion','pd','monCalPD','claser','cturret']){
  const d=C.fitSpec({k}),q=C.weaponChargeSpec({k}),rating=C.weaponPreviewStats(k),energy=C.weaponEnergy(d,q.volleyTT),cycle=d.cycle||C.K.cycle;
  near(rating.maxPowerW,energy.inputJ/cycle);near(rating.maxHeatW,energy.lossJ/cycle);near(rating.traverseDegS,C.weaponTraverseDegS(d));near(rating.rangeM,C.GUN_BANDS[C.fitBand(d)].range);
 }
});

test('displaying a legacy electrical model retains its actual nameplate and waste-heat path',()=>{
 const f={k:'twin40'},rating=C.weaponPreviewStats(f,{strict:false}),d=C.fitSpec(f);near(rating.maxPowerW,d.power);near(rating.maxHeatW,d.power*C.HEAT.waste.weapon);
});

test('scaled weapons, broadside rows and trench aggregates retain per-barrel output but sum mount electricity',()=>{
 const small=C.weaponPreviewStats({k:'single40',scale:2}),single=C.weaponPreviewStats('single40');near(small.outputTT,C.weaponChargeSpec({k:'single40',scale:2}).boltTT);near(small.maxPowerW,single.maxPowerW*8);
 const group=C.weaponPreviewStats({k:'twin40',trenchAggregate:true,aggregateCount:12}),twin=C.weaponPreviewStats('twin40');near(group.outputTT,40);assert.equal(group.barrels,24);near(group.maxPowerW,twin.maxPowerW*12);
 const legacy={k:'broadsideBattery',batteryCaliber:'70TT',batteryGuns:6},row=C.weaponPreviewStats(legacy),migrated=C.weaponChargeSpec(legacy);near(row.outputTT,migrated.boltTT);assert.equal(row.barrels,migrated.barrels);near(row.maxPowerW,C.fitSpec(legacy).power/C.ENERGY_MODEL.eta);
});

test('fixed guns report zero traverse and real projectile launchers use per-round output and native ranges',()=>{
 near(C.weaponPreviewStats('recProw').traverseDegS,0);
 const craft=C.weaponPreviewStats('cmsl'),ship=C.weaponPreviewStats({k:'shipMsl',launcherCols:4,launcherRows:2});near(craft.outputTT,C.ORDNANCE.cmsl.tt);near(craft.rangeM,10000);near(ship.rangeM,60000);near(ship.outputTT,craft.outputTT);near(ship.traverseDegS,0);assert.equal(ship.barrels,8);
 const unknown=C.weaponPreviewStats('ctorp');assert.equal(unknown.outputTT,null);assert.equal(unknown.rangeM,null);assert.equal(unknown.variableReason,'payload');
 const loaded=C.weaponPreviewStats({k:'cpylon',_store:{k:'cmsl',n:2}});near(loaded.outputTT,25);near(loaded.rangeM,10000);
});

test('one, eight and sixteen-cell launchers display the actual packet energy of one round, not the complete salvo',()=>{
 for(const [cols,rows]of [[1,1],[4,2],[4,4]]){
  const f={id:99,k:'shipMsl',launcherCols:cols,launcherRows:rows,p:[0,0,0],n:[0,1,0],a:2,ped:0,base:0},packet=C.missileLauncherSpec(f),rating=C.weaponPreviewStats(f);
  near(rating.outputTT,packet.tt);near(rating.outputTT,25);assert.equal(rating.barrels,packet.cells);near(packet.volleyTT,rating.outputTT*rating.barrels);near(rating.rangeM,packet.range);
 }
 const legacy={id:88,k:'itl',p:[0,0,0],n:[0,1,0],a:2,ped:0,base:0},packet=C.missileLauncherSpec(legacy);near(C.weaponPreviewStats(legacy).outputTT,packet.tt);
});

test('reactor-dependent superweapons show unresolved values until actual current Core results exist',()=>{
 const unknown=C.weaponPreviewStats('hion');assert.equal(unknown.outputTT,null);assert.equal(unknown.rangeM,null);assert.equal(unknown.maxPowerW,null);assert.equal(unknown.maxHeatW,null);
 const sbeam=C.weaponPreviewStats('sbeam');near(sbeam.outputTT,C.SW_COMBAT.sbeam.E);near(sbeam.rangeM,C.SW_COMBAT.sbeam.range);near(sbeam.traverseDegS,0);
 const resolved={k:'hion',Emax:18000,chargeW:8e22,efficiency:.9},ion=C.weaponPreviewStats({k:'hion',d:C.SUPERWEAPONS.hion.d},{superweapon:resolved});near(ion.outputTT,18000);near(ion.rangeM,C.ionReach(18000,C.SUPERWEAPONS.hion.d));near(ion.maxPowerW,8e22);near(ion.maxHeatW,8e21);
});

test('a resolved legacy superweapon displays its actual continuous charging heat and identifies that phase',()=>{
 const chargeW=10*C.TT,resolved={id:2,k:'hion',Emax:100,chargeT:10,chargeW,efficiency:1,r:1,mod:1},profile={name:'Legacy charge',mass:100,len:100,width:40,height:20,hp:100000,modules:[{k:'reactor',part:1,size:1,domain:'main'},{k:'superweapon',part:2,size:1,domain:'main',powerConnected:true}],energyModel:{version:0,eta:C.ENERGY_MODEL.eta},grid:{P:100*C.TT,fixed:0,De:0,Ds:0,Dw:0,domains:[{id:'main',P:100*C.TT,modules:[0,1]}]},sw:[resolved]},u=C.fleetUnit('charge','charge',profile);
 u.sw=[{c:0,st:'charge'}];const duration=2,output=C.superweaponCharge(u,0,duration),rating=C.weaponPreviewStats({id:2,k:'hion'},{strict:false,superweapon:resolved});
 near(output,chargeW*duration);near(rating.maxHeatW,u.ht.esw[0]/duration);near(rating.maxHeatW,C.HEAT.waste.sw*chargeW);assert.equal(rating.heatBasis,'charging');
 const run=ui();run('S={superweapons:[{id:2,k:"hion",Emax:100,chargeW:'+chargeW+',efficiency:1}]};ship.surfaces.mode="legacy"');const html=run('designWeaponPreviewHTML({id:2,k:"hion"})');assert.match(html,/発射時の瞬間発熱は含みません/);assert.ok(html.includes('data-weapon-stat="heat" data-value="'+rating.maxHeatW+'"'));
});

test('preview calculations are read-only and contain no additional balance coefficients',()=>{
 const input={k:'oct40',scale:1.25},before=C.publicJSON(input),weapons=C.publicJSON([C.FITS,C.SW_COMBAT,C.HEAT,C.ENERGY_MODEL]);for(let i=0;i<3;i++)C.weaponPreviewStats(input);assert.equal(C.publicJSON(input),before);assert.equal(C.publicJSON([C.FITS,C.SW_COMBAT,C.HEAT,C.ENERGY_MODEL]),weapons);assert.equal(C.weaponPreviewStats('struct'),null);
 const legacy={k:'broadsideBattery',batteryCaliber:'70TT',batteryGuns:6},saved=C.publicJSON(legacy);C.weaponPreviewStats(legacy);assert.equal(C.publicJSON(legacy),saved,'previewing a retired saved battery must not migrate the live source');
});

test('the actual preview renders all five ratings with per-barrel output and full selected-mount rates',()=>{
 const run=ui(),html=run('designWeaponPreviewHTML({k:"oct40"})'),q=C.weaponPreviewStats('oct40');for(const [field,value]of [['output',40],['traverse',q.traverseDegS],['range',q.rangeM],['power',q.maxPowerW],['heat',q.maxHeatW]])assert.ok(html.includes('data-weapon-stat="'+field+'" data-value="'+value+'"'),field);
 assert.match(html,/1発・1門/);assert.match(html,/武装全体の最大値/);assert.doesNotMatch(html,/undefined|NaN|Infinity|武装の威力と出典/);
});

test('editing a weapon uses its configured scale and stale superweapon stats never masquerade as current',()=>{
 const run=ui(),small=C.weaponPreviewStats({k:'utl',scale:.5}),html=run('designWeaponPreviewHTML({k:"utl",scale:.5})');assert.ok(html.includes('data-weapon-stat="power" data-value="'+small.maxPowerW+'"'));
 run('S={superweapons:[{id:5,k:"hion",Emax:18000,chargeW:8e22,efficiency:.9}]};eng.statsGen=1');const stale=run('designWeaponPreviewHTML({id:5,k:"hion"})');assert.match(stale,/給電元により変化/);assert.match(stale,/data-weapon-stat="power" data-value=""/);
 run('eng.statsGen=2');const current=run('designWeaponPreviewHTML({id:5,k:"hion"})');assert.match(current,/data-weapon-stat="output" data-value="18000"/);assert.match(current,/data-weapon-stat="power" data-value="8e\+22"/);
});

test('the redundant source-table screen is removed while the actual source metadata remains intact',()=>{
 assert.doesNotMatch(app,/function weaponSourcesHTML|weaponSourcesHTML\(/);assert.doesNotMatch(app,/武装の威力と出典/);for(const k of ['single40','refVen','oct40'])assert.ok(C.FITS[k].evidence);assert.ok(C.WEAPON_NOTES.design);
});

test('fresh legacy and strict ships use exactly their actual Core electrical profile without guessing from thermal mode',()=>{
 for(const strict of [false,true]){
  const ship=C.newShip({L:300,W:160,H:120,plan:'rect',sec:'rect',bowW:1,bowH:1,stern:1},'Preview electrical model');if(strict)ship.surfaces=C.normalizeSurfaces({mode:'strict',compatAllowed:false});ship.parts=[];ship.fits=[];C.placePart(ship,'gen',[60,60,0],30);
  const f={id:ship.nextId++,k:'pd',p:[180,120,0],a:2,n:[0,1,0],base:0,ped:0,low:0,float:false};C.mountFit(ship,f);ship.fits.push(f);
  const stats=C.computeStats(ship),profile=C.fleetProfile(stats,ship.name,ship),rating=C.weaponPreviewStats(f,{strict:ship.surfaces?.mode==='strict'});near(rating.maxPowerW,stats.draw.weapons);near(rating.maxPowerW,C.fitSpec(f).power*C.weaponInputFactor(profile));
 }
});
