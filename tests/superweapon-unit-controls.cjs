const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');

const root = path.resolve(process.env.KS_TEST_ROOT || path.join(__dirname, '..'));
const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const runtime = vm.createContext({console});
for (const file of ['data/reference.js', 'data/imperial2.js', 'data/fleet.js', 'js/core.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), runtime, {filename: file});
}
const C = vm.runInContext('Core', runtime);
const plain = value => JSON.parse(JSON.stringify(value));
const near = (actual, expected, label = 'value') => assert.ok(
  Number.isFinite(actual) && Math.abs(actual - expected) <= Math.max(1, Math.abs(expected)) * 1e-10,
  `${label}: ${actual} != ${expected}`,
);
function section(start, end) {
  const a = app.indexOf(start), b = app.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, start);
  return app.slice(a, b);
}
function setup(kind = 'sbeam') {
  const context = vm.createContext({C, console, performance: {now: () => 0}});
  const run = source => vm.runInContext(source, context);
  run(`
    const identity = [1,0,0,0,1,0,0,0,1];
    const notices=[], hits=[], trial={}, ship=null, view=null, window=globalThis;
    const tv={add:(a,b,k=1)=>a.map((v,i)=>v+b[i]*k),sub:C.sub,scale:C.mul,dot:C.dot,len:C.len,norm:C.norm,cross:C.cross};
    const trialApply=(M,v)=>[M[0]*v[0]+M[3]*v[1]+M[6]*v[2],M[1]*v[0]+M[4]*v[1]+M[7]*v[2],M[2]*v[0]+M[5]*v[1]+M[8]*v[2]];
    const trialApplyT=(M,v)=>[M[0]*v[0]+M[1]*v[1]+M[2]*v[2],M[3]*v[0]+M[4]*v[1]+M[5]*v[2],M[6]*v[0]+M[7]*v[1]+M[8]*v[2]];
    const trialCol=(M,i)=>M.slice(i*3,i*3+3);
    const toast=s=>notices.push(s),sndUI=()=>{},sndAt=()=>{},sndPick=()=>'',spaceHullPoint=u=>u.pos;
    const spaceWorld=u=>trial.battle?tv.add(trial.battle.O,trialApply(trial.battle.E,u.pos)):u.pos,spaceRotU=(E,u)=>[Math.cos(u.yaw||0),0,Math.sin(u.yaw||0),0,1,0,-Math.sin(u.yaw||0),0,Math.cos(u.yaw||0)];
    const shipTag=String,esc=String,num=String,ja=String,sourceText=n=>n.textContent,trialExplosion=()=>{};
    const TRIAL_PD={radius:{craft:10}},SPACE_RULES={step:.25};
    const trialSystemsUnit=()=>trial.systemsUnit,trialWhere=()=>'',trialCamName=()=>'',trialFoilButtonHTML=()=>'',trialHasFoils=()=>false,trialMissileHudState=()=>({text:''});
    const trialJumpStep=()=>{},escortsStep=()=>{},trialCoasting=()=>false,trialSublight=()=>{},trialHudUpdate=()=>{},spaceCineEnd=()=>{};
    const spaceAirStep=()=>{},spaceRefresh=()=>{},spaceLog=()=>{};
    const menu={children:[],append(el){this.children.push(el);},insertBefore(el){this.append(el);},querySelector(selector){return this.children.find(el=>el.dataset?.th&&selector==='[data-th=\"'+el.dataset.th+'\"]')||null;}};
    const document={getElementById:id=>id==='thMenu'?menu:null,querySelector:()=>null,createElement:tag=>({tagName:tag,dataset:{},innerHTML:'',textContent:''})},$=()=>null;
    const R={alive:u=>!u.dead,orderUnit:(w,id,order)=>Object.assign(w.units.get(id).order,order)};
    const voy={tac:{sys:'alpha'},sel:{units:['ship:one']},w:null};
    const voyTacSel=()=>({kind:'ship',units:[trial.systemsUnit]}),voyRenderSide=()=>{},voyCommon=(xs,fn)=>{const out=xs.map(fn);return out.every(v=>v===out[0])?out[0]:null;};
    function reset(kind='sbeam') {
      const energy=kind==='sbeam'?125000:1000;
      const sw=[0,1].map(i=>({id:10+i,k:kind,aim:kind==='sbeam'?'bow':i?'stbd':'port',mz:[0,0,kind==='sbeam'?(i?20:-20):0],dir:kind==='sbeam'?[1,0,0]:[0,0,i?1:-1],Emax:energy,E:energy,d:100,chargeT:100,chargeW:C.TT*10,efficiency:.8,r:1,rk:'gen',mod:i+1,mode:'beam',Pshare:1}));
      const modules=[{k:'reactor',part:1,port:'p1',size:100,share:1,domain:'main'},...sw.map(w=>({k:'superweapon',part:w.id,port:'p'+w.id,size:1,share:1,domain:'main',powerConnected:true}))];
      const p={name:'Independent fixed weapons',hp:1e6,len:100,width:40,height:30,D:0,shieldBuffer:0,wCap:0,crewNeed:0,crewMax:0,maxSpeed:0,accel:0,turnRate:0,gunArcs:Array(6).fill(0),ionArcs:Array(6).fill(0),modules,sw,energyModel:{version:1,eta:.75},grid:{P:C.TT*100,Pgen:C.TT*100,fixed:0,cooling:0,De:0,Ds:0,Dw:0,domains:[{id:'main',P:C.TT*100,modules:[0,1,2]}]}};
      const u=C.fleetUnit('ship:one','fixture',p);u.manual=true;u.pos=[0,0,0];u.yaw=0;u.team=0;u.sys='alpha';u.order={...u.order,sw:true};u.sw=sw.map(()=>({c:1,st:'ready',t:0,mode:'beam',fireNow:false}));delete u.weaponLedger;
      Object.assign(trial,{on:true,p,battle:null,systemsUnit:u,swSolo:u,swSelect:'all',P:[0,0,0],R:identity.slice(),V:[0,0,0],targets:[],drones:[],asset:{geometry:{targetRadius:10}},fx:[],swfx:[],vbolts:[],gun:{kills:0},launchers:[],powerMode:'balanced',camMode:'ship',gunMode:'free',t:0,paused:false,jump:null});
      notices.length=0;hits.length=0;menu.children=[];voy.w={units:new Map([[u.id,u]])};return u;
    }
  `);
  run(app.match(/const TRIAL_TELEGRAPH=.*?;/)[0]);
  run(section('const GUN_MODES=', 'const trial='));
  for(const line of app.split('\n'))if(line.startsWith('const superweaponEnergyTT=')||line.startsWith('const superweaponEnergyText='))run(line);
  run(section('function superweaponCatalogHTML(S){', 'function engagementCapacityHTML('));
  run(app.match(/^function spaceSync\(\).*$/m)[0]);
  run(section('const trialSwKinds=', 'function spaceSurfaceTurretPose('));
  run(section('function spaceShots(shots){', 'function spaceBolts(dt){'));
  run(section('function spaceStep(dt){', '// v18 Drive glow levels'));
  run(section('function trialHudHTML()', 'function trialBindHud('));
  run(section('function trialCommand(', '// ---------- star systems ----------'));
  run(section('const VOY_SW_STATE =', 'function voyShipRow('));
  run(section('function voySidebarClick(', 'function voyCenterOps('));
  run(`reset(${JSON.stringify(kind)})`);
  return run;
}

test('actual HUD exposes direct per-unit commands and B fires only its selected fixed beam', () => {
  const run = setup();
  const html = run('trialSwMenu();trialHudHTML()+menu.children.map(el=>el.innerHTML).join(\"\")');
  assert.match(html, /data-trial-cmd="swfire:0"/);
  assert.match(html, /data-trial-cmd="swfire:1"/);
  assert.match(html, /data-trial-cmd="swselect:all"/);
  assert.doesNotMatch(html, /ビーム\/パルス|data-trial-cmd="swmode"[^>]*射撃の型|パルス一撃/);
  run('trialCommand("swselect:1");trialCommand("sw")');
  assert.equal(String(run('trial.swSelect')), '1');
  assert.equal(run('trial.swSolo.sw[1].st'), 'beam');
  assert.equal(run('trial.swSolo.sw[0].st'), 'ready');
  assert.equal(run('trial.swSolo.sw[0].c'), 1);
  run('reset();trialCommand("swfire:0")');
  assert.equal(run('trial.swSolo.sw[0].st'), 'beam');
  assert.equal(run('trial.swSolo.sw[1].st'), 'ready');
});

test('the keyboard selector cycles both individual cannons and explicit all-fire emits 250 PT', () => {
  const run = setup();
  run('trialCommand("swnext")');
  assert.equal(String(run('trial.swSelect')), '0');
  run('trialCommand("swnext")');
  assert.equal(String(run('trial.swSelect')), '1');
  run('trialCommand("swnext")');
  assert.equal(run('trial.swSelect'), 'all');
  run('trialCommand("sw");for(let i=0;i<41;i++)trialSwSoloStep(.25)');
  near(run('trial.swSolo.weaponLedger.emittedJ'), 250000 * C.TT, 'two complete 125 PT emissions');
  assert.ok(run('trial.swSolo.weaponLedger.storedJ') <= 250000 * C.TT * 1e-12, 'only floating-point subtraction residue remains');
});

test('fixed beam scanning rejects an off-axis target inside the retired aiming cone', () => {
  const run = setup();
  run('const w=trial.p.sw[0], objects=[{ref:{alive:true,pos:[1000,0,-20]},pos:[1000,0,-20],reach:10,line:10},{ref:{alive:true,pos:[1000,40,-20]},pos:[1000,40,-20],reach:5,line:5}]');
  assert.deepEqual(plain(run('trialSwScan(w,objects).map(s=>s.ok)')), [true, false]);
  run('trial.R=[0,0,1,0,1,0,-1,0,0]');
  assert.equal(run('trialSwScan(w,objects)[0].ok'), false, 'turning the ship, rather than target selection, redirects the weapon');
});

test('one practice beam emits exactly one 125 PT store over ten seconds while its peer stays charged', () => {
  const run = setup();
  run('trialSwSoloFire(trial.swSolo,0)');
  assert.equal(run('trial.swSolo.sw[0].t'), 10);
  run('for(let i=0;i<41;i++)trialSwSoloStep(.25)');
  const ledger = run('trial.swSolo.weaponLedger');
  near(ledger.emittedJ, 125000 * C.TT, 'one cannon emitted energy');
  near(ledger.storedJ, 125000 * C.TT, 'unchosen cannon retains its energy');
  near(ledger.initialJ + ledger.inputJ, ledger.storedJ + ledger.emittedJ + ledger.lossJ + ledger.releasedJ, 'superweapon conservation');
  assert.equal(run('trial.swSolo.sw[1].st'), 'ready');
  assert.equal(run('trial.swSolo.sw[1].c'), 1);
});

test('destroying a practice target cannot shorten the fixed ten-second emission', () => {
  const run = setup();
  run('trial.targets=[{alive:true,pos:[1000,0,-20],vel:[0,0,0]}];trialSwSoloFire(trial.swSolo,0);trialSwSoloStep(.5)');
  assert.equal(run('trial.targets[0].alive'), false);
  assert.equal(run('trial.swSolo.sw[0].st'), 'beam');
  run('trialSwSoloStep(.5)');
  assert.equal(run('trial.swSolo.sw[0].st'), 'beam');
  near(run('trial.swSolo.sw[0].t'), 9);
  run('for(let i=0;i<36;i++)trialSwSoloStep(.25)');
  near(run('trial.swSolo.weaponLedger.emittedJ'), 125000 * C.TT);
});

test('beam sprites follow the current muzzle axis even when a named target moves or disappears', () => {
  const run = setup();
  run('const u=trial.systemsUnit,foe={id:"moving",p:{len:50},pos:[1000,400,200],yaw:0};u.sw[0].st="beam";trial.battle={me:u,b:{units:[u,foe]},O:[0,0,0],E:identity.slice()};trial.swfx=[{from:u.id,i:0,k:"sbeam",mode:"beam",to:foe.id,free:false,life:1,max:1,age:0}]');
  let points = plain(run('swFxPoints(.1)'));
  assert.ok(points.length > 40, 'a moved target does not erase or redirect the beam');
  for (const [p] of points) { near(p[1], 0); near(p[2], -20); }
  assert.ok(Math.max(...points.map(([p]) => p[0])) >= C.SW_COMBAT.sbeam.range * .99);
  run('trial.battle.b.units=[trial.systemsUnit]');
  const afterRemoval=plain(run('swFxPoints(.1)'));
  assert.ok(afterRemoval.length>40,'a lost target does not erase a beam still firing');
  for(const [p]of afterRemoval){near(p[1],0);near(p[2],-20);}
  run('trial.R=[0,0,1,0,1,0,-1,0,0]');
  points = plain(run('swFxPoints(.1)'));
  for (const [p] of points) { near(p[0], 20); near(p[1], 0); }
  assert.ok(Math.max(...points.map(([p]) => p[2])) >= C.SW_COMBAT.sbeam.range * .99);
});

test('continuous beam cores use exactly two axis vertices per cannon and survive target loss until reset', () => {
  const run=setup(),range=C.SW_COMBAT.sbeam.range;
  assert.equal(run('trialSwBeamLines().pos.length'),0);
  run('const u=trial.systemsUnit,foe={id:"lost",p:{len:50},pos:[1000,400,200],yaw:0};u.sw[0].st="beam";trial.battle={me:u,b:{units:[u,foe]},O:[0,0,0],E:identity.slice()};trial.swfx=[{from:u.id,i:0,k:"sbeam",mode:"beam",to:foe.id,distance:Infinity,life:1}]');
  assert.deepEqual(plain(run('Array.from(trialSwBeamLines().pos)')),[0,0,-20,range,0,-20]);
  assert.equal(run('trialSwBeamLines().col.length'),8);
  run('foe.dead=true;trial.battle.b.units=[u];trial.R=[0,0,1,0,1,0,-1,0,0]');
  assert.deepEqual(plain(run('Array.from(trialSwBeamLines().pos)')),[20,0,0,20,0,range]);
  run('trial.swfx.push({...trial.swfx[0],i:1})');
  assert.equal(run('trialSwBeamLines().pos.length'),12,'two independently firing cannons need only four line vertices');
  run('trial.swfx[0].life=0');
  assert.equal(run('trialSwBeamLines().pos.length'),6,'an expired effect leaves no stale core');
  run('reset()');
  assert.equal(run('trialSwBeamLines().pos.length'),0,'reset clears all line geometry');
});

test('the actual range guide follows an arbitrary copied cannon axis through the ship rotation', () => {
  const context=vm.createContext({C,performance:{now:()=>0}});
  vm.runInContext(`
    const trialCol=(R,i)=>R.slice(i*3,i*3+3),trialApply=(R,v)=>[R[0]*v[0]+R[3]*v[1]+R[6]*v[2],R[1]*v[0]+R[4]*v[1]+R[7]*v[2],R[2]*v[0]+R[5]*v[1]+R[8]*v[2]];
    const tv={add:(a,b,k=1)=>a.map((v,i)=>v+b[i]*k),sub:C.sub,scale:C.mul,len:C.len};
    const weapon={k:'sbeam',aim:'bow',axis:[0,.6,.8],mz:[5,2,-3]},trial={R:[0,0,1,0,1,0,-1,0,0],swSolo:{p:{sw:[weapon]},sw:[{st:'ready'}]}},view={eye:()=>[-200,100,50]};
  `,context);
  vm.runInContext(section('function trialSwArcPoints()', '// The superweapon line over its button:'),context);
  const inspect=()=>plain(vm.runInContext('({points:trialSwArcPoints(),origin:trialApply(trial.R,weapon.mz),axis:trialApply(trial.R,weapon.axis)})',context));
  for(const axis of [[0,.6,.8],[0,0,-1]]){
    context.nextAxis=axis;vm.runInContext('weapon.axis=nextAxis',context);const guide=inspect();assert.ok(guide.points.length>40);
    let far=0;for(const [point]of guide.points){const v=point.map((n,i)=>n-guide.origin[i]),along=v.reduce((n,q,i)=>n+q*guide.axis[i],0);v.forEach((n,i)=>near(n,guide.axis[i]*along));far=Math.max(far,along);}
    assert.ok(far>C.SW_COMBAT.sbeam.range*.97,'the guide reaches the actual cannon range along its transformed axis');
  }
});

test('manual pitch, roll and translated battle frames keep physical and visual muzzle axes identical', () => {
  const run = setup();
  run(`
    const compose=(A,B)=>[...trialApply(A,trialCol(B,0)),...trialApply(A,trialCol(B,1)),...trialApply(A,trialCol(B,2))];
    const rotation=(yaw,pitch,roll)=>compose(
      [Math.cos(yaw),0,Math.sin(yaw),0,1,0,-Math.sin(yaw),0,Math.cos(yaw)],
      compose([Math.cos(pitch),Math.sin(pitch),0,-Math.sin(pitch),Math.cos(pitch),0,0,0,1],
              [1,0,0,0,Math.cos(roll),Math.sin(roll),0,-Math.sin(roll),Math.cos(roll)]));
    const u=trial.systemsUnit,w=u.p.sw[0];
    trial.P=[1600,830,-420];trial.R=rotation(.53,-.41,.62);
    trial.battle={me:u,b:{units:[u]},O:[1200,-300,840],E:rotation(-.8,.24,-.36)};
    spaceSync();const syncedFrame=JSON.stringify(u.swFrame);delete u.swFrame;trialSwSyncFrame();
    const origin=C.swMuzzle(u,w),axis=C.swAxis(u,w),perp=tv.norm(tv.cross(axis,[0,1,0]));
    const on={id:'on-axis',team:1,p:{len:100,width:100,height:100},pos:tv.add(origin,axis,2000),yaw:0};
    const off={id:'named-off-axis',team:1,p:{len:100,width:100,height:100},pos:tv.add(tv.add(origin,axis,1000),perp,400),yaw:0};
    trial.battle.b.units.push(on,off);
  `);
  assert.equal(run('JSON.stringify(u.swFrame)'),run('syncedFrame'), 'normal battle ticks supply the same full attitude as manual fire');
  const physicalOrigin = plain(run('tv.add(trial.battle.O,trialApply(trial.battle.E,C.swMuzzle(u,w)))'));
  const visualOrigin = plain(run('swMuzzleWorld(u,w)'));
  const physicalAxis = plain(run('trialApply(trial.battle.E,C.swAxis(u,w))'));
  const visualAxis = plain(run('swAxisWorld(u,w)'));
  physicalOrigin.forEach((n,i) => near(n,visualOrigin[i],`muzzle coordinate ${i}`));
  physicalAxis.forEach((n,i) => near(n,visualAxis[i],`axis coordinate ${i}`));
  assert.equal(run('C.swBeamTrace(u,w,[off]).hit'), null);
  assert.equal(run('C.swBeamTrace(u,w,[off,on]).hit.id'), 'on-axis');
  assert.equal(run('trialSwRayTrace(w,trialSwObjects()).hit.ref.id'), 'on-axis');
  run(`
    C.superweaponCommand(u,{indexes:[0]},{to:[off.id],free:false,dir:[0,1,0]});
    const shots=C.superweaponStep(u,.25,{foes:[off,on],all:trial.battle.b.units,inc:()=>null,damage:1,sys:C.fleetSystems(u)});
  `);
  assert.deepEqual(plain(run('shots[0].to')), ['on-axis'], 'a named off-axis target cannot redirect the physical beam');
  assert.equal(run('u.sw[1].st'), 'ready');
  const points=plain(run('swShotFx(shots[0],new Map(trial.battle.b.units.map(x=>[x.id,x])));swFxPoints(.1)'));
  assert.ok(points.length > 40);
  const shipPosition=plain(run('trial.P'));
  for(const [p] of points){
    const displacement=p.map((n,i)=>n+shipPosition[i]-visualOrigin[i]);
    const along=displacement.reduce((sum,n,i)=>sum+n*visualAxis[i],0);
    displacement.forEach((n,i)=>near(n,along*visualAxis[i],`sprite axis coordinate ${i}`));
  }
});

test('battle victory keeps spending an active beam in empty space and never starts its ready peer', () => {
  const run = setup();
  run(`
    const u=trial.systemsUnit,foe={id:'last-foe',team:1,p:{len:100,width:100,height:100},pos:[1000,0,-20],yaw:0};
    trial.battle={me:u,b:{units:[u,foe],time:.5},O:[0,0,0],E:identity.slice(),cined:true};
    trialSwFire(0);
    C.superweaponStep(u,.5,{foes:[foe],all:[u,foe],inc:()=>null,damage:1,sys:C.fleetSystems(u)});
    foe.dead=true;trial.battle.result={kind:'win'};
    u.sw[1].fireNow={command:true,free:true};
    for(let i=0;i<37;i++)spaceStep(.25);
  `);
  assert.equal(run('u.sw[0].st'), 'beam');
  near(run('u.sw[0].t'), .25);
  assert.equal(run('u.sw[1].st'), 'ready');
  assert.ok(run('trial.swfx.some(x=>x.i===0&&x.mode==="beam")'), 'post-victory steps still renew the drawn beam');
  run('spaceStep(.25)');
  assert.equal(run('u.sw[0].st'), 'cool');
  near(run('u.weaponLedger.emittedJ'),125000*C.TT);
  near(run('u.weaponLedger.storedJ'),125000*C.TT);
  near(run('trial.battle.b.time'),10);
  const emitted=run('u.weaponLedger.emittedJ');
  run('for(let i=0;i<40;i++)spaceStep(.25)');
  near(run('u.weaponLedger.emittedJ'),emitted,'finished battles cannot start additional emissions');
  near(run('u.weaponLedger.inputJ'),0,'finishing a shot cannot recharge a different weapon');
  assert.equal(run('u.sw[1].st'), 'ready');
  assert.equal(run('u.sw[1].c'),1);
});

test('catalogue labels each 125 PT beam and its ten-second combined 250 PT shot without changing ordinary salvo', () => {
  const run = setup();
  run('const stats={superweapons:trial.p.sw,allGunVolleyTT:972.8,alphaTot:972.8,alphaBest:500,ionTot:0},before=JSON.stringify(stats)');
  const html=run('superweaponCatalogHTML(stats)');
  assert.match(html,/125 PT × 2/);
  assert.match(html,/合計 250 PT \/ 10 秒間照射/);
  assert.match(html,/砲軸固定/);
  assert.equal(run('JSON.stringify(stats)'),run('before'),'sustained superweapon energy remains separate from instantaneous ordinary salvo');
});

test('RTS individual-fire row commands one Subjugator cannon and keeps the other ready', () => {
  const run = setup('hion');
  const html = run('voySwHTML([trial.systemsUnit])');
  assert.match(html, /data-vsw="fire:ship%3Aone:0"/);
  assert.match(html, /data-vsw="fire:ship%3Aone:1"/);
  assert.doesNotMatch(html, /mode:pulse/);
  run('trial.systemsUnit.manual=false;voySidebarClick({target:{closest:()=>({dataset:{vsw:"fire:ship%3Aone:1"}})}})');
  run('const u=trial.systemsUnit,foes=[-1,1].map((sg,i)=>({id:"foe"+i,team:1,side:1,p:{len:100,width:100,height:100},pos:[0,0,sg*1000],yaw:0})),bolts=[],shots=C.superweaponStep(u,.25,{foes,all:[u,...foes],bolts,ctx:{time:0,damage:1,rand:()=>.9,ev(){},sunk(){},out(){}},inc:()=>null,sys:C.fleetSystems(u)});');
  assert.deepEqual(plain(run('shots.map(s=>s.i)')), [1]);
  assert.equal(run('trial.systemsUnit.sw[0].st'), 'ready');
  assert.equal(run('trial.systemsUnit.sw[0].c'), 1);
  assert.equal(run('bolts.length'), 1);
  const held=run('voySwHTML([trial.systemsUnit])');
  assert.match(held,/class="btn sm on" data-vsw="hold"/,'aggregate hold indicator follows the actual per-unit firing policy');
  assert.doesNotMatch(held,/class="btn sm on" data-vsw="free"/);
});
