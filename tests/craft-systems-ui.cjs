const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return app.slice(a,b);}
function setup(){const c=vm.createContext({console});vm.runInContext(`
 const C={PARTS:{lifeSupport:{name:'生命維持'},ejectSeat:{name:'射出座席'},navComputer:{name:'航法'},targetComputer:{name:'照準'},maneuver:{name:'姿勢制御'},laserGas:{name:'レーザーガス'},landingGear:{name:'着陸脚'}},COST_CATS:{power:'動力',crew:'乗員'},isCraft:()=>true,clamp:(n,a,b)=>Math.max(a,Math.min(b,n))};
 const num=(n,d=0)=>Number(n).toFixed(d),esc=s=>String(s).replace(/[<>]/g,''),fPct=n=>Math.round(n*100)+'%',fW=n=>n+' W',fCr=n=>n+' cr';
 const ship={parts:[{id:1,k:'cockpit',seats:1},{id:2,k:'laserGas'}]},st={sel:{list:'parts',id:1}},history=[];
 const selItem=()=>ship.parts[0],editSel=fn=>fn(selItem()),mutate=(label,fn)=>{history.push(JSON.stringify(ship));fn();},renderPanel=()=>{};
 const R={craftPrice:()=>({source:'blueprint',total:12000,build:11000,crew:1000,by:{power:11000,crew:1000}})};
 `,c);vm.runInContext(section('const CRAFT_SYSTEM_KEYS=','function renderSpecTargets()'),c);vm.runInContext(section('function voyCraftPriceHTML(','function voySquadronsHTML('),c);return code=>vm.runInContext(code,c);}
test('systems card exposes endurance and equipment without claiming a TIE has a hyperdrive',()=>{
 const run=setup(),html=run(`craftSystemsHTML({craftSystems:{managed:true,crew:1,suitSeats:1,lifeSupportHours:4,ejectionSeats:1,targetRatio:1,maneuverRatio:1,laserGasSeconds:600,power:12,landingReady:true,navReady:true}})`);
 assert.match(html,/4\.0 時間/);assert.match(html,/600\.0 秒の連続射撃/);assert.match(html,/ハイパードライブなし/);assert.match(html,/宇宙服で運用/);assert.doesNotMatch(html,/NaN|undefined/);
});
test('cockpit seats and suit edits persist through the normal undo transaction',()=>{
 const run=setup();assert.match(run('cockpitEquipmentHTML(selItem())'),/data-cockpit-suit/);
 assert.equal(run('editCockpitEquipment({dataset:{cockpitSuit:""},checked:true})'),true);assert.equal(run('selItem().suit'),true);assert.equal(run('history.length'),1);
 run('editCockpitEquipment({dataset:{cockpitSeats:""},value:"3.4"})');assert.equal(run('selItem().seats'),3);
 run('editCockpitEquipment({dataset:{cockpitSeats:""},value:""})');assert.equal(run('history.length'),2);
 run('editCockpitEquipment({dataset:{cockpitSuit:""},checked:false})');assert.equal(run('selItem().suit'),undefined);
 assert.equal(run('JSON.parse(history[0]).parts[0].suit'),undefined);
});
test('price details distinguish measured blueprints, saved designs and equipment estimates',()=>{
 const run=setup();for(const [source,label]of [['blueprint','標準設計図から計算'],['snapshot','保存時の設計から計算'],['estimate','設備構成からの推定']]){
  run(`R.craftPrice=()=>({source:${JSON.stringify(source)},total:12000,build:11000,crew:1000,by:{power:11000,crew:1000}})`);
  const html=run('voyCraftPriceHTML({craft:"xwing"})');assert.match(html,new RegExp(label));assert.match(html,/12000 cr/);assert.match(html,/動力/);assert.match(html,/乗員/);
 }
});
