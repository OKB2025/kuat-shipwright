const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const {C,R,D}=vm.runInContext('({C:Core,R:Rts,D:YardFleetData.designs})',cx),plain=v=>JSON.parse(JSON.stringify(v)),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
function fixture(formation='column'){
 const fast=plain(D.imperial),slow=plain(D.imperial);fast.key='ctg-fast';slow.key='ctg-slow';fast.p.maxSpeed=1400;slow.p.maxSpeed=700;for(const d of [fast,slow]){d.p.accel=40;d.p.turnRate=.3;}
 const w=R.createWorld({mode:'test',region:'kuat',seed:13,sensors:false,designs:[fast,slow],sides:[{faction:'rebel',ai:false},{faction:'empire',ai:false}],fleets:[{ctgs:[{name:'Joint formation',...(formation?{formation}:{}),tgs:[{name:'First',formation:'wedge',ships:[{design:fast.key},{design:fast.key}]},{name:'Second',formation:'abreast',ships:[{design:slow.key},{design:slow.key}]}]}]},[{design:slow.key}]]});
 const c=[...w.ctgs.values()].find(c=>c.side===0),gs=c.tgs.map(id=>w.groups.get(id));return {w,c,gs};
}
function plans(f,dt=.25){const sys=f.gs[0].sys,us=[...f.w.units.values()].filter(u=>u.sys===sys),byId=new Map(us.map(u=>[u.id,u])),sx=new Map(us.map(u=>[u.id,C.fleetSystems(u)]));return R.groupStations(f.w,sys,us,byId,sx,dt);}
function groupFlag(f,g){return f.w.units.get(g.flag);}

test('joint formation persists through fleet and scenario JSON into the battle order of battle',()=>{
 const ob={ctgs:[{id:'c1',name:'CTG',formation:'wedge',tgs:[{id:'t1',name:'TG',formation:'column',ships:[{id:'s1',src:'imperial',name:'Ship',air:[],ground:[]}]}]}]},fleet=R.normalizeFleet(ob);
 assert.equal(fleet.ctgs[0].formation,'wedge');assert.equal(fleet.ctgs[0].tgs[0].formation,'column');
 const sc=R.normalizeScenario({sides:[{fleet},{fleet:{ctgs:[]}}]});const loaded=R.scenarioFromJSON(R.scenarioJSON(sc));assert.equal(loaded.sides[0].fleet.ctgs[0].formation,'wedge');
 const battle=R.battleOrbat(loaded.sides[0].fleet,null,()=>D.imperial);assert.equal(battle.ctgs[0].formation,'wedge');assert.equal(battle.ctgs[0].tgs[0].formation,'column');
 const invalid=R.normalizeFleet({ctgs:[{formation:'unknown',tgs:[]}]});assert.equal(invalid.ctgs[0].formation,undefined);
});

test('legacy task groups stay independent until a joint formation is explicitly selected',()=>{
 const f=fixture(null);assert.equal(f.c.formation,null);assert.ok(f.gs.every(g=>!g.ctgFollow));
 plans(f);assert.equal(f.c.formState,undefined);
 assert.equal(R.orderCtg(f.w,f.c.id,{ctgFormation:'column'}),true);assert.equal(f.c.formation,'column');assert.ok(f.gs.every(g=>g.ctgFollow));
 assert.deepEqual(plain(f.gs.map(g=>g.formation)),['wedge','abreast']);
 assert.equal(R.orderCtg(f.w,f.c.id,{ctgFormation:'independent'}),true);assert.equal(f.c.formation,null);assert.ok(f.gs.every(g=>!g.ctgFollow));
});

test('initial joint deployment spaces whole task groups along the selected formation without changing their internal shapes',()=>{
 for(const formation of ['column','abreast','wedge']){const f=fixture(formation),a=groupFlag(f,f.gs[0]),b=groupFlag(f,f.gs[1]),forward=[Math.cos(a.yaw),0,Math.sin(a.yaw)],right=[-forward[2],0,forward[0]],d=C.sub(b.pos,a.pos);
  assert.ok(C.len(d)>3000,'task-group centres must not collapse');if(formation==='column'){assert.ok(C.dot(d,forward)<-3000);assert.ok(Math.abs(C.dot(d,right))<1e-5);}else assert.ok(Math.abs(C.dot(d,right))>3000);
  assert.deepEqual(plain(f.gs.map(g=>g.formation)),['wedge','abreast']);for(const g of f.gs){const us=g.units.map(id=>f.w.units.get(id));assert.ok(C.len(C.sub(us[1].pos,us[0].pos))>1000);}
 }
});

test('joint deployment rotates each group footprint and initial velocity onto the common heading',()=>{
 const d=plain(D.imperial),w=R.createWorld({mode:'test',region:'kuat',seed:3,sensors:false,designs:[d],sides:[{faction:'rebel',ai:false},{faction:'empire',ai:false}],fleets:[{ctgs:[{formation:'abreast',tgs:[{formation:'column',deploy:{heading:0,speed:100},ships:[{design:d.key},{design:d.key}]},{formation:'column',deploy:{heading:90,speed:100},ships:[{design:d.key},{design:d.key}]}]}]},[]]});
 const c=[...w.ctgs.values()][0],gs=c.tgs.map(id=>w.groups.get(id)),heading=w.units.get(gs[0].flag).yaw;
 for(const g of gs){const us=g.units.map(id=>w.units.get(id)),fw=[Math.cos(heading),0,Math.sin(heading)],rt=[-fw[2],0,fw[0]],delta=C.sub(us[1].pos,us[0].pos);
  assert.ok(C.dot(delta,fw)<-1000,'each internal column remains astern of its flagship');assert.ok(Math.abs(C.dot(delta,rt))<100);for(const u of us){assert.ok(Math.abs(u.yaw-heading)<1e-8);assert.ok(C.dot(u.velocity,fw)>99);assert.ok(Math.abs(C.dot(u.velocity,rt))<1e-8);}
 }
});

test('joint orders preserve individual ship orders and a task-group order detaches only that group',()=>{
 const f=fixture(),individual=f.w.units.get(f.gs[0].units[1]);R.orderUnit(f.w,individual.id,{type:'hold'});
 assert.equal(R.orderCtg(f.w,f.c.id,{type:'course',hdg:0}),true);assert.equal(individual.order.type,'hold');assert.deepEqual(plain(f.gs.map(g=>g.formation)),['wedge','abreast']);assert.ok(f.gs.every(g=>g.ctgFollow));
 let p=plans(f);assert.equal(p.has(individual.id),false);assert.equal(R.ctgFormationInfo(f.w,f.c.id,f.gs[0].sys).groups.length,2);
 R.orderGroup(f.w,f.gs[1].id,{type:'move',point:[50000,0,0]});assert.equal(f.gs[1].ctgFollow,false);plans(f);assert.equal(R.ctgFormationInfo(f.w,f.c.id,f.gs[0].sys).groups.length,1);
 R.orderCtg(f.w,f.c.id,{type:'hold'});assert.ok(f.gs.every(g=>g.ctgFollow));assert.equal(individual.order.type,'hold');
 const previous=plain(f.c);assert.equal(R.orderCtg(f.w,f.c.id,{ctgFormation:'bogus'}),false);assert.deepEqual(plain(f.c),previous);
});

test('the live joint controller tracks separate centres and limits its leader to the slower group',()=>{
 const f=fixture('column');R.orderCtg(f.w,f.c.id,{type:'course',hdg:0});const start=f.gs.map(g=>groupFlag(f,g).pos.slice());
 for(let n=0;n<160;n++)R.tick(f.w,.25);
 const sys=f.gs[0].sys,info=R.ctgFormationInfo(f.w,f.c.id,sys);assert.equal(info.formation,'column');assert.equal(info.groups.length,2);assert.ok(info.speed>0&&info.speed<=700*.85);
 const a=f.gs[0].tf,b=f.gs[1].tf;assert.ok(a&&b);assert.ok(C.len(C.sub(a.ref,b.ref))>3000);assert.ok(C.len(C.sub(groupFlag(f,f.gs[0]).pos,start[0]))>500,'lead group must make way');
 for(const g of f.gs)assert.ok(Object.values(g.tf.dest).every(p=>p.every(Number.isFinite)));
 assert.deepEqual(plain(f.gs.map(g=>g.formation)),['wedge','abreast']);
});

test('groups in another system or in transit do not anchor the current joint controller',()=>{
 const f=fixture(),g=f.gs[1];g.transit={from:g.sys,to:g.sys+1,t:1,T:10};plans(f);assert.deepEqual(plain(R.ctgFormationInfo(f.w,f.c.id,f.gs[0].sys).groups),[f.gs[0].id]);
 delete g.transit;g.sys=f.gs[0].sys+1;for(const id of g.units)f.w.units.get(id).sys=g.sys;plans(f);assert.deepEqual(plain(R.ctgFormationInfo(f.w,f.c.id,f.gs[0].sys).groups),[f.gs[0].id]);
});

test('joint pacing honours the speed selected for the slowest task group',()=>{
 const f=fixture();R.orderCtg(f.w,f.c.id,{type:'course',hdg:0,speed:'slow'});plans(f);const slow=R.ctgFormationInfo(f.w,f.c.id,f.gs[0].sys).speed;assert.ok(slow>0&&slow<=700*.4*.85);
 R.orderGroup(f.w,f.gs[0].id,{speed:'full'});plans(f);assert.ok(R.ctgFormationInfo(f.w,f.c.id,f.gs[0].sys).speed<=700*.4*.85,'a faster group must still pace the slower group');
});

test('setup and battle expose whole-joint formation separately from internal group formation',()=>{
 const start=app.indexOf('function voyCtgHTML('),end=app.indexOf('function voyTgHTML(',start),setup=app.slice(start,end);assert.match(setup,/data-obctgform/);assert.match(setup,/合同任務群全体の陣形/);
 const a=app.indexOf('function voyCtgTacCard('),b=app.indexOf('function voyShipCard(',a),live=app.slice(a,b);assert.match(live,/data-vctgform/);assert.match(live,/各任務群の内部陣形/);assert.match(live,/任務群ごとに独立/);
});

test('the actual fleet duplication action retains the joint formation and each internal formation',()=>{
 const line=app.split('\n').find(line=>line.includes("else if (d.ob === 'ctgdup' && c)"));assert.ok(line);
 const ob={ctgs:[{id:'c1',name:'Joint',formation:'wedge',tgs:[{id:'t1',formation:'column',ships:[{id:'s1',name:'Ship'}]}]}]};
 const ctx=vm.createContext({ob});vm.runInContext("let i=10;const d={ob:'ctgdup'},c=ob.ctgs[0],fac='rebel',voyUid=()=>String(++i),voyCopyShip=(ob,sh)=>({...sh,id:voyUid()});",ctx);vm.runInContext(line.trim().replace(/^else /,''),ctx);
 assert.equal(ob.ctgs.length,2);assert.equal(ob.ctgs[1].formation,'wedge');assert.equal(ob.ctgs[1].tgs[0].formation,'column');assert.notEqual(ob.ctgs[1].id,ob.ctgs[0].id);assert.notEqual(ob.ctgs[1].tgs[0].id,ob.ctgs[0].tgs[0].id);
});
