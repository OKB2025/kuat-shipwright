const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const {C,R}=vm.runInContext('({C:Core,R:Rts})',cx);
function profile(native=true){
 const launcher={k:'launcher',fit:2,port:'f2',domain:'main',name:'Launcher',size:1,share:1,at:.5,powerConnected:true,stock:native?6:60,...(native?{missileKind:'cmsl',salvo:1,cycle:1.2,tt:25,launchPowerW:1e15,muzzle:[10,2,3],launchDir:[Math.SQRT1_2,Math.SQRT1_2,0]}:{ion:1})};
 return {name:'Clearance fixture',hp:1e6,D:0,shieldBuffer:0,reserve:0,wCap:0,crewNeed:1,crewMax:1,len:100,width:20,height:10,maxSpeed:0,turnRate:0,accel:0,acc:1,aa:0,gunArcs:[0,0,0,0,0,0],ionArcs:[0,0,0,0,0,0],gunBands:{long:[0,0,0,0,0,0],mid:[0,0,0,0,0,0],close:[0,0,0,0,0,0]},msl:native?25*20/1.2:0,imsl:native?0:80,modules:[{k:'reactor',part:1,port:'p1',domain:'main',size:1,share:1,at:.5},launcher],grid:{P:1e18,Pgen:1e18,Paux:0,fixed:native?1e15:0,cooling:0,De:0,Ds:0,Dw:0,...(native?{fixedLoads:[{id:'f2',port:'f2',domain:'main',weight:1e15}]}:{})}};
}
function battle(native=true){
 const p=profile(native),targetProfile=profile();targetProfile.msl=0;targetProfile.imsl=0;targetProfile.modules=targetProfile.modules.slice(0,1);targetProfile.grid.fixed=0;targetProfile.grid.fixedLoads=[];
 const design=(key,p)=>({key,p,info:{mass:1000,hyper:null,capital:false,sensor:0}}),a=design('clearance-a',p),b=design('clearance-b',targetProfile),w=R.createWorld({mode:'test',sensors:false,convoyMode:false,designs:[a,b],sides:[{faction:'empire',ai:false},{faction:'rebel',ai:false}],fleets:[[{design:a.key}],[{design:b.key}]]});
 const u=[...w.units.values()].find(q=>q.side===0),t=[...w.units.values()].find(q=>q.side===1);t.sys=u.sys;w.groups.get(t.group).sys=u.sys;
 u.pos=[0,1000,0];u.yaw=0;t.pos=[-200,1000,0];u.order={...u.order,type:'attack',target:t.id};t.order={...t.order,type:'hold',fire:false};return {w,u,t};
}

test('a nearby rear target cannot be hit while a native missile is still clearing a forward-pointing tube',()=>{
 const {w,u,t}=battle(),hp=t.hp,integrity=C.fleetIntegrity(t);
 R.battleTick(w,u.sys,.1);u.order.fire=false;
 let missile=w.missiles.find(m=>m.from===u.id);assert.ok(missile,'the round must remain in flight instead of hitting a target behind the tube');const launched=missile;
 assert.equal(u.ammo[1],5,'exactly one physical round leaves the magazine');assert.equal(missile.n,1);assert.ok(missile.launchClearance>0);
 const axis=C.norm(missile.vel);axis.forEach((v,i)=>assert.ok(Math.abs(v-[Math.SQRT1_2,Math.SQRT1_2,0][i])<1e-10,'velocity follows the physical launch axis'));
 assert.ok(missile.pos[0]>missile.launchOrigin[0]&&missile.pos[1]>missile.launchOrigin[1]);
 for(let i=0;i<2;i++){assert.equal(t.hp,hp);assert.equal(C.fleetIntegrity(t),integrity);assert.equal(u.dmgDone,0);assert.equal(missile.hit,undefined);R.battleTick(w,u.sys,.1);missile=w.missiles.find(m=>m.from===u.id);assert.ok(missile);assert.ok(missile.launchClearance>0);}
 assert.equal(t.hp,hp);assert.equal(C.fleetIntegrity(t),integrity);assert.equal(u.dmgDone,0);
 let cleared=false;for(let i=0;i<40&&!u.dmgDone;i++){R.battleTick(w,u.sys,.1);missile=w.missiles.find(m=>m.from===u.id)||launched;if(!(missile.launchClearance>0)){cleared=true;assert.ok(missile.vel[0]<0,'the cleared missile homes back toward its rear target');}}
 assert.ok(cleared,'the physical exit phase ends before homing');assert.ok(u.dmgDone>0,'the cleared missile can eventually reach the target');assert.equal(u.ammo[1],5,'homing does not launch or restore extra rounds');
});

test('legacy ion missiles without a clearance flag retain their immediate close-range impact',()=>{
 const {w,u}=battle(false);R.battleTick(w,u.sys,.1);
 assert.equal(u.ammo[1],52,'the legacy tube retains its eight-round salvo');assert.ok(u.dmgDone>0);assert.equal(w.missiles.filter(m=>m.from===u.id).length,0,'undefined clearance cannot delay old guided missiles');
});
