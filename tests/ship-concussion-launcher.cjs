const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx),plain=v=>JSON.parse(JSON.stringify(v)),near=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<=e*Math.max(1,Math.abs(b)),`${a} != ${b}`);
// A deep structure whose +Z side wall takes the launcher's 50 m compartment.
function fixture(depth=120){const s=C.newShip({L:600,W:240,H:120,assembly:true},'Ship concussion launcher');s.parts=[];s.fits=[];s.nextId=1;s.armor={hull:0,cit:0};const host=C.placePart(s,'struct',[300,60,0],[500,depth*2-40,120],{form:'box'},false);return {s,host,wall:(depth*2-40)/2};}
function placed(s,wall,options={},x=300){const r=C.placeFit(s,'shipCmsl',[x,60,wall],[0,0,1],2,false,options);assert.ok(!r.err,r.err);return r.fit;}
const TYPE=()=>C.SHIP_LAUNCHERS.shipCmsl,VOLUME=50*8.5*8.5/(12*2.25*2.25),TT=27.5625;

test('the 7 × 50 m missile, half propellant and half warhead, takes its mass and damage from the craft concussion missile',()=>{
 const t=TYPE(),o=C.ORDNANCE.cmsl,[L,D]=t.round.dims,density=o.mass/(Math.PI/4*o.dims[1]**2*o.dims[0]),mass=density*Math.PI/4*D*D*L,warhead=mass*t.round.warheadFraction,ttPerWarheadT=C.ORDNANCE_BASIS.warheadTTPerT;assert.equal(ttPerWarheadT,.02,'matter conversion: 20 Gt TNT per t = 0.02 TT/t');near(o.tt,o.warheadMass*.02);
 assert.deepEqual([L,D],[50,7]);assert.equal(t.round.warheadFraction,.5);near(t.round.mass,mass);near(t.round.warheadMass,warhead);near(t.round.propellantMass,mass-warhead);near(t.tt,warhead*ttPerWarheadT);near(t.tt,TT);
 assert.equal(t.cell[0],L,'the 50 m interior depth equals the missile length');near(t.bore,1.1*D);assert.ok(t.bore<t.cell[1]);assert.equal(t.ammoPerCell,1,'one ready missile per tube');
});

test('the ship concussion launcher definition follows the shipMsl per-volume rule',()=>{
 const t=TYPE(),d=C.FITS.shipCmsl,one=C.fitSpec({k:'shipCmsl'});
 assert.equal(d.name,'艦艇用震盪ミサイル発射装置');assert.equal(d.cat,'w');assert.ok(!d.craft);assert.ok(C.isShipLauncher('shipCmsl'));assert.ok(C.isConcussionLauncher('shipCmsl'));assert.equal(C.canonicalWeaponKind('shipCmsl'),'shipCmsl');
 assert.deepEqual(plain(t.cell),[50,8.5,8.5]);assert.deepEqual(plain(t.frame),[3,5]);near(t.bore,7.7);assert.equal(t.ammoPerCell,1);assert.equal(t.tt,TT);assert.equal(t.range,60000);assert.equal(t.embeddedOnly,true);assert.equal(t.tube,'round');
 assert.equal(t.round.dims[0],t.cell[0],'the compartment depth equals the missile length');assert.ok(t.round.dims[1]<t.bore&&t.bore<t.cell[1],'the round fits its bore and the bore its tube pitch');
 near(one.fm,50);near(one.hm,14.5);near(one.wm,18.5);near(d.mass,C.FITS.shipMsl.mass*VOLUME);near(d.cost,C.FITS.shipMsl.cost*VOLUME);near(d.power,C.FITS.shipMsl.power*VOLUME);
 // shipMsl keeps its own cell (12 × 2.25 × 2.25 m since 2026-11-11) and fires the craft missile.
 const old=C.fitSpec({k:'shipMsl',launcherCols:3,launcherRows:2});near(old.fm,12);near(old.wm,6.75);near(old.hm,4.5);assert.equal(old.store.slots,36);assert.equal(C.missileLauncherSpec({k:'shipMsl',p:[0,0,0],a:2,launcherCols:3,launcherRows:2}).tt,C.ORDNANCE.cmsl.tt);
});

test('tubes across and rows set the panel, compartment, magazine, mass and cost; limits follow the type',()=>{
 const f={k:'shipCmsl',p:[0,0,0],a:2,launcherCols:6,launcherRows:2},d=C.fitSpec(f),m=C.missileLauncherSpec(f),one=C.FITS.shipCmsl;
 near(d.wm,6*8.5+10);near(d.hm,2*8.5+6);near(d.fm,50);near(d.mass,one.mass*12);near(d.cost,one.cost*12);near(d.power,one.power*12);assert.equal(d.store.slots,12);assert.equal(d.msl,TT*12);
 assert.equal(m.kind,'shipCmsl');assert.equal(m.salvo,12);assert.equal(m.cells,12);assert.equal(m.ammo,12);assert.equal(m.ammoPerCell,1);assert.equal(m.tt,TT);assert.equal(m.volleyTT,TT*12);assert.equal(m.range,60000);assert.equal(m.mount,'vls');
 const q=C.shipLauncherConfig({k:'shipCmsl',launcherCols:99,launcherRows:99,launcherRowRaise:99,launcherEmbedded:false});assert.equal(q.cols,16);assert.equal(q.rows,16);assert.equal(q.raise,20);assert.equal(q.embedded,true,'the panel is always an interior compartment');
 assert.equal(C.shipLauncherConfig({k:'shipMsl',launcherCols:99}).cols,16,'shipMsl keeps its 16-cell limit');
 const g=C.launcherGeometry(f);assert.equal(g.tube,'round');assert.equal(g.muzzles.length,12);assert.deepEqual(plain(g.cellSize),[50,8.5,8.5]);assert.equal(new Set(g.muzzles.map(p=>p.map(v=>v.toFixed(3)).join(','))).size,12);
 const st=C.weaponPreviewStats(f);assert.equal(st.kind,'missile');assert.equal(st.barrels,12);assert.equal(st.outputTT,TT);assert.equal(st.rangeM,60000);
});

test('embedded placement reserves the compartment behind the face panel and survives save/load',()=>{
 const {s,host,wall}=fixture(),f=placed(s,wall,{launcherCols:6,launcherRows:2}),g=C.launcherGeometry(f);
 assert.equal(f.float,false);assert.equal(f.launcherBlocked,false);assert.equal(f.launcherEmbedded,true);assert.equal(f.host,host.id);near(g.axis[2],1);
 assert.ok(g.bodyCenter[2]<wall&&g.bodyCenter[2]>wall-50,'the body sits inside the hull behind the face');near(g.bodyCenter[2],wall-25);
 C.syncCompartments(s);const [cell]=C.missileCells(s);near(cell.requiredVolume,50*23*61);near(C.partVolume(cell),50*23*61);assert.equal(cell.weaponId,f.id);assert.match(cell.label,/震盪ミサイル発射装置/);
 f.launcherRows=3;C.mountFit(s,f);C.syncCompartments(s);near(C.missileCells(s)[0].requiredVolume,50*31.5*61);
 const loaded=C.deserialize(C.serialize(s));C.remount(loaded);const q=loaded.fits.find(x=>x.id===f.id);assert.equal(q.k,'shipCmsl');assert.equal(q.float,false);assert.deepEqual(plain(C.shipLauncherConfig(q)),plain(C.shipLauncherConfig(f)));assert.deepEqual(plain(C.launcherGeometry(q).muzzles),plain(C.launcherGeometry(f).muzzles));
 const thin=fixture(40),bad=C.placeFit(thin.s,'shipCmsl',[300,60,thin.wall],[0,0,1],2,false,{});assert.ok(bad.err||bad.fit?.float,'a structure thinner than the missile cannot hold the compartment');
});

test('the fleet profile, statistics and battle volley use one magazine round per tube',()=>{
 const {s,wall}=fixture(),f=placed(s,wall,{launcherCols:6,launcherRows:2}),S=C.computeStats(s),p=C.fleetProfile(S,s.name,s),m=p.modules.find(m=>m.fit===f.id);
 assert.equal(S.mslSalvo,TT*12,'one round per tube caps the 20 s statistic');
 assert.equal(m.k,'launcher');assert.equal(m.missileKind,'shipCmsl');assert.equal(m.launcherCells,12);assert.equal(m.ammoPerCell,1);assert.equal(m.stock,12);assert.equal(m.tt,TT);assert.equal(m.missileRange,60000);assert.equal(m.launchMuzzles.length,12);assert.equal(m.launchBlocked,false);
 // The fixture has no reactor; the real launcher module is carried into a powered battle profile (as in
 // missile-launcher-range).
 const launcher={...m,fit:2,port:'f2',domain:'main',share:1,at:.5,powerConnected:true};
 const profile={name:'Panel fixture',profileVersion:5,hp:1e6,D:0,shieldBuffer:0,reserve:0,wCap:0,crewNeed:1,crewMax:1,len:100,width:20,height:10,maxSpeed:0,turnRate:0,accel:0,acc:1,aa:0,
  gunArcs:[0,0,0,0,0,0],ionArcs:[0,0,0,0,0,0],gunBands:{long:[0,0,0,0,0,0],mid:[0,0,0,0,0,0],close:[0,0,0,0,0,0]},msl:S.mslSalvo,imsl:0,
  modules:[{k:'reactor',part:1,port:'p1',domain:'main',size:1,share:1,at:.5},launcher],grid:{P:1e22,Pgen:1e22,Paux:0,fixed:m.launchPowerW,cooling:0,De:0,Ds:0,Dw:0,fixedLoads:[{id:'f2',port:'f2',domain:'main',weight:m.launchPowerW}]}};
 const make=key=>{const u=C.fleetUnit(key,key,profile,0);return u;},power=u=>C.allocateShipPower(u,C.fleetSystems(u),{throttle:0,weapons:0,shields:0},0,'balanced');
 const u=make('panel');power(u);const first=C.fleetMissileStep(u,.1,true,{distance:30000});assert.equal(first.length,12);assert.ok(first.every(q=>q.kind==='shipCmsl'&&q.tt===TT&&q.n===1&&q.range===60000));assert.equal(new Set(first.map(q=>q.cell)).size,12);assert.equal(u.ammo[1],0);
 let later=[];for(let k=0;k<40;k++){power(u);later.push(...C.fleetMissileStep(u,.1,true,{distance:30000}));}assert.equal(later.length,0,'the tubes hold no reload');
 const far=make('far');power(far);assert.equal(C.fleetMissileStep(far,.1,true,{distance:60000.5}).length,0);assert.equal(far.ammo[1],12);assert.equal(C.missileRange('shipCmsl'),60000);
 // A fleet battle tick launches the whole panel as real missiles toward the target.
 const R=vm.runInContext('Rts',cx),target={...profile,msl:0,modules:profile.modules.slice(0,1),grid:{...profile.grid,fixed:0,fixedLoads:[]}};
 const a={key:'panel-a',p:profile,info:{mass:1000,hyper:null,capital:false,sensor:0}},z={key:'panel-z',p:target,info:{mass:1000,hyper:null,capital:false,sensor:0}},w=R.createWorld({mode:'test',sensors:false,convoyMode:false,designs:[a,z],sides:[{faction:'empire',ai:false},{faction:'rebel',ai:false}],fleets:[[{design:a.key}],[{design:z.key}]]});
 const shooter=[...w.units.values()].find(q=>q.side===0),t=[...w.units.values()].find(q=>q.side===1);t.sys=shooter.sys;w.groups.get(t.group).sys=shooter.sys;shooter.pos=[0,1000,0];shooter.yaw=0;t.pos=[20000,1000,0];shooter.order={...shooter.order,type:'attack',target:t.id};t.order={...t.order,type:'hold',fire:false};
 R.battleTick(w,shooter.sys,.25);const shots=w.missiles.filter(q=>q.from===shooter.id);assert.equal(shots.length,12);assert.ok(shots.every(q=>q.kind==='shipCmsl'&&q.range===60000));assert.equal(shooter.ammo[1],0);
});

test('editable arrangements (2×2, 2×4, 4×8) and raised rows set the face, compartment and muzzles',()=>{
 for(const [cols,rows] of [[2,2],[2,4],[4,8]]){const f={k:'shipCmsl',p:[0,0,0],a:2,launcherCols:cols,launcherRows:rows},d=C.fitSpec(f),g=C.launcherGeometry(f);near(d.wm,cols*8.5+10);near(d.hm,rows*8.5+6);assert.equal(g.muzzles.length,cols*rows);assert.equal(C.missileLauncherSpec(f).ammo,cols*rows);}
 const f={k:'shipCmsl',p:[0,0,0],a:2,launcherCols:4,launcherRows:8,launcherRowRaise:2},d=C.fitSpec(f),g=C.launcherGeometry(f);near(d.hm,8*8.5+7*2+6);near(d.wm,44);assert.equal(g.rowRaise,2);
 const ys=[...new Set(g.muzzles.map(p=>C.dot(p,g.bodyFrame.up).toFixed(4)))].map(Number).sort((a,b)=>a-b);assert.equal(ys.length,8);for(let i=1;i<ys.length;i++)near(ys[i]-ys[i-1],10.5);
 const {s,wall}=fixture(),placedFit=placed(s,wall,{launcherCols:2,launcherRows:4,launcherRowRaise:3});assert.equal(placedFit.launcherRowRaise,3);C.syncCompartments(s);near(C.missileCells(s)[0].requiredVolume,50*(4*8.5+3*3+6)*(2*8.5+10));
 const loaded=C.deserialize(C.serialize(s));C.remount(loaded);assert.equal(loaded.fits[0].launcherRowRaise,3);assert.equal(C.shipLauncherConfig({k:'shipMsl',launcherRowRaise:5}).raise,undefined,'shipMsl has no row raise');
});

test('a curved host takes the panel along its local surface direction with level rows',()=>{
 for(const form of ['ellipsoid','cylinder']){const s=C.newShip({L:800,W:400,H:300,assembly:true},'Curved launcher');s.parts=[];s.fits=[];s.nextId=1;s.armor={hull:0,cit:0};const host=C.placePart(s,'struct',[400,150,0],[600,300,300],{form},false);
  const h=C.rayEnv(s,[420,230,400],[0,0,-1],{structOnly:true});assert.ok(h);const r=C.placeFit(s,'shipCmsl',h.p,h.n,2,false,{launcherCols:4,launcherRows:2});assert.ok(!r.err,r.err);const f=r.fit,g=C.launcherGeometry(f);
  assert.equal(f.float,false,form);assert.equal(f.host,host.id);assert.ok(C.dot(g.axis,C.norm(h.n))>.999,'fires along the local normal');assert.ok(Math.abs(g.bodyFrame.rt[1])<1e-6,'rows stay level on the wall');}
});

// A powered battle profile carrying one launcher module (the fixture ship has no reactor).
function battleProfile(m){const launcher={...m,fit:2,port:'f2',domain:'main',share:1,at:.5,powerConnected:true};
 return {name:'Panel fixture',profileVersion:5,hp:1e12,D:0,shieldBuffer:0,reserve:0,wCap:0,crewNeed:1,crewMax:1,len:100,width:20,height:10,maxSpeed:0,turnRate:0,accel:0,acc:1,aa:0,
  gunArcs:[0,0,0,0,0,0],ionArcs:[0,0,0,0,0,0],gunBands:{long:[0,0,0,0,0,0],mid:[0,0,0,0,0,0],close:[0,0,0,0,0,0]},msl:m.tt*m.launcherCells,imsl:0,
  modules:[{k:'reactor',part:1,port:'p1',domain:'main',size:1,share:1,at:.5},launcher],grid:{P:1e22,Pgen:1e22,Paux:0,fixed:m.launchPowerW,cooling:0,De:0,Ds:0,Dw:0,fixedLoads:[{id:'f2',port:'f2',domain:'main',weight:m.launchPowerW}]}};}
function launcherModule(round){const {s,wall}=fixture(),f=placed(s,wall,{launcherCols:2,launcherRows:2,launcherRound:round}),S=C.computeStats(s),p=C.fleetProfile(S,s.name,s);return {f,m:p.modules.find(m=>m.fit===f.id)};}
// Fire one panel at a target of the given mass and return the share of the rounds that found it.
// A numeric mass gives an inert test hull (no emission); a string uses that example's real fleet profile and mass.
function salvoFound(round,massT,distance){
 const R=vm.runInContext('Rts',cx),F=vm.runInContext('YardFleetData',cx),{m}=launcherModule(round),profile=battleProfile(m),example=typeof massT==='string'?F.designs[massT]:null,target=example?example.p:{...profile,msl:0,modules:profile.modules.slice(0,1),grid:{...profile.grid,fixed:0,fixedLoads:[]}};
 const a={key:'panel-a',p:profile,info:{mass:1000,hyper:null,capital:false,sensor:0}},z={key:'panel-z',p:target,info:example?example.info:{mass:massT,hyper:null,capital:false,sensor:0}},w=R.createWorld({mode:'test',sensors:false,convoyMode:false,designs:[a,z],sides:[{faction:'empire',ai:false},{faction:'rebel',ai:false}],fleets:[[{design:a.key}],[{design:z.key}]]});
 const u=[...w.units.values()].find(q=>q.side===0),t=[...w.units.values()].find(q=>q.side===1);t.sys=u.sys;w.groups.get(t.group).sys=u.sys;u.pos=[0,1000,0];u.yaw=0;t.pos=[distance,1000,0];u.order={...u.order,type:'attack',target:t.id};t.order={...t.order,type:'hold',fire:false};
 R.battleTick(w,u.sys,.25);const salvo=w.missiles.filter(q=>q.from===u.id);assert.equal(salvo.length,4);
 for(let i=0;i<400&&salvo.some(q=>q.n>0&&q.life>0);i++)R.battleTick(w,u.sys,.25);
 return {salvo,found:salvo.map(q=>q.found),signature:R.unitSig(t),target:t};
}

test('the long torpedo shares the tube and takes its warhead, speed and range from its 5% propellant',()=>{
 const t=TYPE(),m=t.rounds.missile,q=t.rounds.torpedo,o=C.ORDNANCE.cmsl,ttPerWarheadT=C.ORDNANCE_BASIS.warheadTTPerT,dv=Math.log(1/(1-.05))/Math.log(1/(1-.5));
 assert.deepEqual(plain(q.dims),plain(m.dims));near(q.mass,m.mass);assert.equal(q.warheadFraction,.95);near(q.warheadMass,q.mass*.95);near(q.propellantMass,q.mass*.05);near(q.tt,q.warheadMass*ttPerWarheadT);near(q.tt,52.36875);
 near(q.speed,m.speed*dv,1e-3);near(q.range,m.range*dv,1e-3);assert.equal(m.seeker,'heat');assert.equal(q.seeker,'mass');assert.equal(m.tt,TT);
 const f={k:'shipCmsl',p:[0,0,0],a:2,launcherCols:2,launcherRows:2,launcherRound:'torpedo'},d=C.fitSpec(f),spec=C.missileLauncherSpec(f),st=C.weaponPreviewStats(f);
 assert.equal(d.msl,q.tt*4);assert.equal(spec.tt,q.tt);assert.equal(spec.range,4440);assert.equal(spec.speed,192.4);assert.equal(spec.seeker,'mass');assert.equal(spec.round,'torpedo');assert.equal(spec.ammo,4,'one round per tube');assert.equal(st.outputTT,q.tt);assert.equal(st.rangeM,4440);
 assert.equal(C.shipLauncherConfig({k:'shipCmsl',launcherRound:'bogus'}).round,'missile');assert.equal(C.shipLauncherConfig({k:'shipMsl',launcherRound:'torpedo'}).round,undefined,'shipMsl has no selectable round');
 const {s,wall}=fixture(),r=C.placeFit(s,'shipCmsl',[300,60,wall],[0,0,1],2,false,{launcherCols:2,launcherRows:2,launcherRound:'torpedo'});assert.ok(!r.err,r.err);assert.equal(r.fit.launcherRound,'torpedo');const loaded=C.deserialize(C.serialize(s));C.remount(loaded);assert.equal(loaded.fits[0].launcherRound,'torpedo');assert.equal(C.assemblyMirrorFit(loaded.fits[0]).launcherRound,'torpedo');
 const {m:mod}=launcherModule('torpedo');assert.equal(mod.missileRound,'torpedo');assert.equal(mod.seeker,'mass');assert.equal(mod.missileSpeed,192.4);assert.equal(mod.tt,q.tt);assert.equal(mod.missileRange,4440);
});

test('seekers: heat finds small ships, mass favours heavy targets',()=>{
 const heat=S=>C.seekerHitChance('heat',{signatureW:S}),mass=M=>C.seekerHitChance('mass',{massT:M});
 near(heat(4.2e20),.95*4.2e20/(4.2e20+1e20));near(mass(1.76e6),.95*1.76e6/(1.76e6+1e6));assert.equal(heat(0),0);assert.equal(mass(0),0);assert.equal(C.seekerHitChance(undefined),1);
 assert.ok(heat(4.2e20)>.75,'a 64 m transport is still found by its emission');assert.ok(mass(5e3)<.01&&mass(4.5e4)<.05,'small ships barely attract a torpedo');assert.ok(mass(5e7)>.9);
 for(const M of [1e3,1e5,1e7,1e9])assert.ok(mass(M*10)>mass(M));
});

test('fleet battle: torpedoes find a heavy target far more often than a light one; missiles follow the heat signature',()=>{
 const light=salvoFound('torpedo',5e3,3000),heavy=salvoFound('torpedo',5e7,3000);
 assert.ok(light.salvo.every(q=>q.seeker==='mass'&&q.top===192.4&&q.range===4440));assert.ok(light.found.every(Number.isFinite)&&heavy.found.every(Number.isFinite),'every torpedo reached its target');
 near(light.found[0],C.seekerHitChance('mass',{massT:5e3}));near(heavy.found[0],C.seekerHitChance('mass',{massT:5e7}));assert.ok(heavy.found[0]>light.found[0]*50);
 // Real example targets: the small Gozanti still radiates enough for the heat seeker; the torpedo barely finds it.
 const small=salvoFound('missile','gozanti',3000),S=small.signature.nu+small.signature.ir,smallTorpedo=salvoFound('torpedo','gozanti',3000);
 assert.ok(small.salvo.every(q=>q.seeker==='heat'&&q.top===2600));assert.ok(S>1e20);near(small.found[0],C.seekerHitChance('heat',{signatureW:S}),1e-3);assert.ok(small.found[0]>.6);
 assert.ok(smallTorpedo.found[0]<.01,'a torpedo rarely finds a 5,000 t ship');assert.ok(small.found[0]>smallTorpedo.found[0]*50);
 const inert=salvoFound('missile',5e3,3000);assert.ok(inert.found.every(f=>f===0),'a target with no emission gives a heat seeker nothing to follow');
 const missile=small;assert.ok(missile.salvo.every(q=>Math.abs(q.hit+q.missed+(q.downed||0)-1)<1e-9),'hits, misses and point-defence kills account for every round');
 const far=salvoFound('torpedo',5e7,4300);assert.ok(far.found.every(Number.isFinite),'within 4.44 km the torpedo still arrives');
});

test('ship launchers are not craft store stations, so the editor specification panel can summarize the ship',()=>{
 for(const k of ['shipMsl','shipCmsl']){const {s,wall}=fixture(),r=C.placeFit(s,k,[300,60,wall],[0,0,1],2,false,{launcherEmbedded:true});assert.ok(!r.err,r.err);const S=C.computeStats(s);assert.deepEqual(plain(C.craftLoadout(s).stations),[]);assert.doesNotThrow(()=>C.craftCombat(s,S,{summaryOnly:true}));}
});

test('the editor catalogue and English catalog list the launcher',()=>{
 const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),en=fs.readFileSync(path.join(root,'js/lang-en.js'),'utf8');
 assert.match(app,/'shipMsl','shipCmsl'/);for(const term of ['艦艇用震盪ミサイル発射装置','震盪ミサイル発射装置','横の発射管数','発射管の段数',C.FITS.shipCmsl.desc])assert.ok(en.includes(`'${term}':`),term);
});
