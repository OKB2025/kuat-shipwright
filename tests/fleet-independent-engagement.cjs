const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const {C,R,D}=vm.runInContext('({C:Core,R:Rts,D:YardFleetData.designs})',cx),copy=x=>JSON.parse(JSON.stringify(x));
function profile(){const p=copy(D.imperial.p);Object.assign(p,{name:'Test gunship',len:200,width:80,height:60,hp:1e9,D:0,shieldBuffer:0,reserve:0,accel:40,maxSpeed:400,turnRate:.05,gunArcs:Array(6).fill(100),ionArcs:Array(6).fill(0),gunBands:{long:Array(6).fill(100),mid:Array(6).fill(0),close:Array(6).fill(0)},aaArcs:Array(6).fill(0),gunBest:100,gunMean:100,gunRateBest:100,gunRateMean:100,ionBest:0,ionMean:0,aa:0,msl:0,imsl:0,slots:0,embarkedSlots:0,aviationSize:0,launch:0,crewNeed:0,crewMax:0,autoCrew:0,wCap:1000,modules:[],grid:{P:C.TT*1000,fixed:0,De:C.TT*10,Ds:0,Dw:C.TT*200},acc:1});for(const k of ['hf','outline','heat','sw','mouths'])delete p[k];return p;}
function fixture(n=2,sensors=false){const p=profile(),designs=[{key:'own',name:'Own gunship',p,info:{capital:false,sensor:1}},{key:'enemy',name:'Enemy gunship',p:copy(p),info:{capital:false,sensor:1}}],w=R.createWorld({region:'kuat',seed:13,sensors,designs,sides:[{faction:'rebel',ai:false},{faction:'empire',ai:false}],fleets:[[{design:'own',air:[],ground:[],troops:0},...Array.from({length:n-1},()=>({design:'own',air:[],ground:[],troops:0}))],[{design:'enemy',air:[],ground:[],troops:0},{design:'enemy',air:[],ground:[],troops:0}]]});
 const own=[...w.units.values()].filter(u=>u.side===0),foe=[...w.units.values()].filter(u=>u.side===1),sys=own[0].sys,g=w.groups.get(own[0].group);
 for(const group of w.groups.values()){group.sys=sys;group.inbound=null;group.order={type:'hold'};}
 for(const [i,u]of own.entries()){u.sys=sys;u.pos=[0,0,i?6000:-6000];u.yaw=0;u.velocity=[0,0,0];u.warp=null;u.jump=null;u.order={type:'group',fire:true,power:'balanced',aim:'auto',volley:'stream'};}
 for(const [i,u]of foe.entries()){u.sys=sys;u.pos=[12000,0,i?6000:-6000];u.yaw=Math.PI;u.velocity=[0,0,0];u.warp=null;u.jump=null;u.manual=true;u.order={type:'hold',fire:false,power:'balanced',aim:'auto'};}
 return {w,own,foe,g,sys};
}
const tick=(f,n=1)=>{for(let i=0;i<n;i++)R.tick(f.w,.25);};

test('ships in one automatic task group engage the enemies ahead of their own bows independently',()=>{
 const f=fixture();f.g.order={type:'auto'};tick(f);assert.equal(f.own[0].firingAt,f.foe[0].id);assert.equal(f.own[1].firingAt,f.foe[1].id);assert.ok(f.own.every(u=>u.lastShot?.gun>0));assert.equal(f.own[0].group,f.own[1].group);
});

test('explicit task-group and individual attack orders take precedence over automatic forward targets',()=>{
 const f=fixture();assert.equal(R.orderGroup(f.w,f.g.id,{type:'attack',target:f.foe[1].id}),true);tick(f);assert.ok(f.own.every(u=>u.firingAt===f.foe[1].id));assert.equal(R.orderUnit(f.w,f.own[0].id,{type:'attack',target:f.foe[0].id}),true);tick(f);assert.equal(f.own[0].firingAt,f.foe[0].id);assert.equal(f.own[1].firingAt,f.foe[1].id);
});

test('a combined task group attack remains an explicit target instruction',()=>{
 const f=fixture(),ctg=f.w.ctgs.get(f.g.ctg);assert.equal(R.orderCtg(f.w,ctg.id,{type:'attack',target:f.foe[1].id}),true);tick(f);assert.ok(f.own.every(u=>u.firingAt===f.foe[1].id));
});

test('move, hold, course and escort orders keep firing at valid targets without needing to stop',()=>{
 for(const kind of ['move','hold','course','escort']){const f=fixture(1),u=f.own[0];u.velocity=[80,0,0];const order=kind==='move'?{type:'move',point:[30000,0,-6000]}:kind==='course'?{type:'course',hdg:0}:kind==='escort'?{type:'escort',target:f.g.flag}: {type:'hold'};
  if(kind==='escort'){const ally=C.fleetUnit('guard','own',profile(),0);Object.assign(ally,{side:0,sys:f.sys,group:f.g.id,pos:[1000,0,-6000],manual:true});f.w.units.set(ally.id,ally);order.target=ally.id;assert.equal(R.orderUnit(f.w,u.id,order),true);}else if(kind==='course')assert.equal(R.orderGroup(f.w,f.g.id,order),true);else assert.equal(R.orderUnit(f.w,u.id,order),true);
  const before=u.dmgDone;tick(f,3);assert.ok(C.len(u.velocity)>0,kind);assert.ok(u.lastShot?.gun>0,kind);assert.ok(u.dmgDone>before,kind);assert.ok(u.energy>=0,kind);
 }
});

test('forward targets are preferred but real gun arcs and fallback bearings still apply',()=>{
 const f=fixture(1),u=f.own[0];f.foe[1].pos=[-3000,0,-6000];tick(f);assert.equal(u.firingAt,f.foe[0].id,'a nearer rear target must not steal the default forward engagement');
 u.p={...u.p,gunArcs:[0,100,0,0,0,0],gunBands:{long:[0,100,0,0,0,0],mid:Array(6).fill(0),close:Array(6).fill(0)}};tick(f);assert.equal(u.firingAt,f.foe[1].id,'a forward enemy outside every battery arc must not silence a usable aft battery');assert.ok(u.lastShot?.gun>0);
});

test('unknown contacts, targets outside range and empty power do not receive opportunistic fire',()=>{
 const unseen=fixture(1,true);tick(unseen);assert.equal(unseen.own[0].lastShot,null);assert.equal(unseen.own[0].firingAt,null);
 const far=fixture(1);for(const e of far.foe)e.pos[0]=70000;tick(far);assert.equal(far.own[0].lastShot,null);
 const starved=fixture(1),u=starved.own[0];u.p={...u.p,grid:{...u.p.grid,P:0},wCap:0};u.energy=0;const done=u.dmgDone;tick(starved);assert.equal(u.lastShot,null);assert.equal(u.dmgDone,done);assert.equal(u.energy,0);
});

test('ceasefire also stops missile launch and stored energy can fund moving shots while recharge is limited',()=>{
 const stopped=fixture(1),u=stopped.own[0];u.p={...u.p,msl:80};R.orderGroup(stopped.w,stopped.g.id,{type:'move',point:[30000,0,-6000],fire:false});tick(stopped,4);assert.equal(u.lastShot,null);assert.equal(stopped.w.missiles.length,0);
 const f=fixture(1),v=f.own[0];v.p={...v.p,grid:{...v.p.grid,P:C.TT*.01}};v.energy=100;R.orderUnit(f.w,v.id,{type:'move',point:[30000,0,-6000]});const before=v.energy;tick(f);assert.ok(v.lastShot?.gun>0);assert.ok(v.energy<before&&v.energy>=0);assert.ok(C.len(v.velocity)>0);
});

test('legacy tactical fleet battles use per-ship forward targeting and continue fire while moving',()=>{
 const p=profile(),a=C.fleetUnit('a','own',p,0),b=C.fleetUnit('b','enemy',copy(p),1),rear=C.fleetUnit('rear','enemy',copy(p),1);a.pos=[0,0,0];b.pos=[12000,0,0];rear.pos=[-3000,0,0];a.velocity=[80,0,0];a.order={type:'move',point:[30000,0,0],fire:true,power:'balanced',aim:'auto',volley:'stream'};for(const e of [b,rear])e.manual=true;
 const battle=C.fleetBattle([a,b,rear],true),shots=C.fleetTick(battle,.25,{collide:false});assert.equal(a.firingAt,b.id);assert.ok(C.len(a.velocity)>0);assert.ok(shots.some(s=>s.from===a.id&&s.to===b.id&&s.gun>0));
 a.p={...a.p,gunArcs:[0,100,0,0,0,0],gunBands:{long:[0,100,0,0,0,0],mid:Array(6).fill(0),close:Array(6).fill(0)}};const aftShots=C.fleetTick(battle,.25,{collide:false});assert.equal(a.firingAt,rear.id);assert.ok(aftShots.some(s=>s.from===a.id&&s.to===rear.id&&s.gun>0));
});
