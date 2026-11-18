// User decisions 2026-11-17 (ship docking; "戦略マップの入渠命令" was left to do, docs/ship-docking.md) and 2026-11-18
// 「小型機(艦載機)の着艦と艦艇の格納は根本的に同じ」. On the strategic map a ship ordered to dock enters a hangar mouth of a
// ship of its own side that it fits, one ship at a time through a mouth, into hangar room counted in the craft's unit; aboard
// it is a carried ship (rides and jumps with its carrier), is resupplied, and leaves by the carrier's launch. A carrier's
// recall sends its ships to dock; nothing goes aboard at once from a distance.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const {C,R,F}=vm.runInContext('({C:Core,R:Rts,F:YardFleetData})',cx),plain=v=>JSON.parse(JSON.stringify(v));
// A hangar 2.5 km deep behind a mouth on the host's bow face, its opening 1.5 km by 0.8 km (the fixture of tests/ship-dock.cjs).
const MOUTH={hatchId:99,p:[3000,0,0],n:[1,0,0],ax:[0,0,1],o:[1500,800],r:1,in:[1750,0,0],d:1250,sl:0,bs:[2500,1000,1600]};
function world(guests=1,{slots=4000,mouth=MOUTH,enemy=false}={}){
 const hp=plain(F.designs.venator.p);hp.mouths=[plain(mouth)];hp.launch=0;hp.msl=0;hp.modules=hp.modules.filter(m=>m.k!=='launcher');
 const host={key:'dock-host',p:hp,info:{mass:1e7,hyper:1,capital:true,sensor:0,hangarCap:slots}},small={key:'dock-guest',p:plain(F.designs.cr90.p),info:{mass:4e4,hyper:1,capital:false,sensor:0}};
 const w=R.createWorld({mode:'test',sensors:false,convoyMode:false,designs:[host,small],sides:[{faction:'empire',ai:false},{faction:'rebel',ai:false}],fleets:[[{design:host.key},...Array.from({length:guests},()=>({design:small.key}))],enemy?[{design:small.key}]:[]]});
 const us=[...w.units.values()].filter(u=>u.side===0),h=us.find(u=>u.key==='dock-host'),gs=us.filter(u=>u!==h);h.pos=[0,0,0];h.yaw=0;h.velocity=[0,0,0];R.orderUnit(w,h.id,{type:'hold'});
 gs.forEach((g,i)=>{g.pos=[9000+i*600,0,1500+i*900];g.yaw=Math.PI;g.velocity=[0,0,0];});
 // an enemy corvette in the same system, far off and holding: with it there the system is in battle
 const foe=[...w.units.values()].find(u=>u.side===1);if(foe){foe.sys=h.sys;w.groups.get(foe.group).sys=h.sys;foe.pos=[0,0,-40000];foe.velocity=[0,0,0];foe.order={...foe.order,type:'hold',fire:false};}
 return {w,h,gs,foe};
}
const run=(w,seconds,until)=>{for(let t=0;t<seconds;t+=.25){R.tick(w,.25);if(until?.())return t;}return null;};

test('a ship ordered to dock goes aboard through the mouth, is resupplied there, and leaves when the carrier launches it',()=>{
 const {w,h,gs:[g]}=world();assert.deepEqual(plain(R.dockCheck(w,g.id,h.id)).ok,true);
 g.crew=Math.round((g.p.crewMax||g.crew)*.5);for(const x of g.sec)x.s=x.max*.4;g.hp=g.sec.reduce((n,x)=>n+x.s,0);const hp0=g.hp,crew0=g.crew;
 assert.equal(R.orderDock(w,g.id,h.id).ok,true);assert.equal(g.order.type,'dock');assert.equal(g.order.target,h.id);
 const used0=R.stowUsed(w,h);const t=run(w,1200,()=>g.status==='carried');assert.ok(t!=null,'aboard within twenty minutes');assert.equal(g.carrier,h.id);assert.ok(t>5,'it flew there: '+t+' s');
 assert.ok(w.events.some(e=>/格納庫に入渠/.test(e.text)),'the event is logged');assert.ok(R.stowUsed(w,h)>used0,'it takes hangar room');assert.equal(h.dockLanes?.[0],undefined,'the lane is free again');
 run(w,240);assert.ok(g.hp>hp0*1.5,'repaired aboard: '+g.hp+' from '+hp0);assert.ok(g.crew>crew0,'crew made up');
 h.pos=[5000,0,0];R.tick(w,.25);assert.ok(Math.abs(g.pos[0]-h.pos[0])<1e-6,'it rides with its carrier');
 assert.equal(R.orderCarried(w,h.id,'launch').n,1);assert.notEqual(g.status,'carried');const local=C.dockWorldToLocal(h,g.pos);assert.ok(local[0]>MOUTH.p[0],'it leaves outside the mouth: '+local[0]);
});

test('an order to dock is refused where the ship cannot enter or there is no room',()=>{
 const {w,h,gs:[g]}=world();assert.equal(R.dockCheck(w,g.id,g.id).ok,false);
 const narrow=world(1,{mouth:{...MOUTH,o:[12,6]}});assert.equal(R.dockCheck(narrow.w,narrow.gs[0].id,narrow.h.id).ok,false,'the opening is too small');assert.equal(R.orderUnit(narrow.w,narrow.gs[0].id,{type:'dock',target:narrow.h.id}),false);
 const need=R.dockCheck(w,g.id,h.id).need;assert.ok(need>1,'a corvette takes more than one craft slot: '+need);
 const full=world(1,{slots:need-1});const r=R.orderDock(full.w,full.gs[0].id,full.h.id);assert.equal(r.ok,false);assert.match(r.why,/空きがありません/);
 const enemy=[...w.units.values()].find(u=>u.side===1);assert.equal(enemy,undefined);assert.equal(R.dockCheck(w,g.id,'nobody').ok,false);
});

test('ships pass a mouth one at a time; the second waits outside until the first is aboard',()=>{
 const {w,h,gs}=world(2);for(const g of gs)assert.equal(R.orderDock(w,g.id,h.id).ok,true);
 let both=false,order=[];run(w,1500,()=>{const inside=gs.filter(g=>g.status!=='carried'&&C.dockState(h,g)?.through);if(inside.length>1)both=true;for(const g of gs)if(g.status==='carried'&&!order.includes(g.id))order.push(g.id);return gs.every(g=>g.status==='carried');});
 assert.ok(gs.every(g=>g.status==='carried'),'both go aboard');assert.equal(both,false,'never two ships past the mouth at once');
});

test('a new order cancels the docking; a lost host ends it',()=>{
 const {w,h,gs:[g]}=world();R.orderDock(w,g.id,h.id);run(w,3);assert.notEqual(g.status,'carried');assert.ok(g.dockLane,'it holds the lane');assert.equal(R.orderUnit(w,g.id,{type:'hold'}),true);assert.equal(g.order.target,undefined);run(w,60);assert.notEqual(g.status,'carried');assert.equal(g.dockLane,undefined);
 const b=world();R.orderDock(b.w,b.gs[0].id,b.h.id);run(b.w,3);b.h.dead=true;run(b.w,1);assert.equal(b.gs[0].order.type,'hold');assert.ok(b.w.events.some(e=>/入渠を中止/.test(e.text)));
});

test('the carrier\'s recall sends its ships to dock instead of taking them aboard at once',()=>{
 const {w,h,gs:[g]}=world();g.carrier=h.id;g.pos=[4500,0,0];/* inside the old 5 km */const r=R.orderCarried(w,h.id,'recover');assert.equal(r.ok,true);assert.equal(r.docking,true);
 assert.notEqual(g.status,'carried','not aboard at once');assert.equal(g.order.type,'dock');const t=run(w,900,()=>g.status==='carried');assert.ok(t!=null&&t>1,'it docks after flying in: '+t);
});

// Reviews of 2026-11-18 (physics FAIL, regression UNVERIFIED on 2fdc1cd).
test('a ship that docks during a battle stays aboard and is repaired',()=>{
 const {w,h,gs:[g],foe}=world(1,{enemy:true});g.crew=Math.round((g.p.crewMax||g.crew)*.5);for(const x of g.sec)x.s=x.max*.4;g.hp=g.sec.reduce((n,x)=>n+x.s,0);const hp0=g.hp;
 for(const u of [h,g])u.order={...u.order,fire:false};run(w,5);assert.ok(w.battles.has(h.sys),'the system is in battle');R.orderDock(w,g.id,h.id);
 const t=run(w,600,()=>g.status==='carried');assert.ok(t!=null,'aboard');assert.equal(g.autoLaunch,false);assert.ok(w.battles.has(h.sys),'still in battle');
 for(let i=0;i<120;i++){R.tick(w,.25);assert.equal(g.status,'carried','still aboard at step '+i);}assert.ok(w.battles.has(h.sys));
 assert.ok(g.hp>hp0*1.1,'repaired while the battle goes on: '+g.hp+' from '+hp0);
 assert.equal(R.orderCarried(w,h.id,'launch').n,1,'it leaves on the carrier\'s order');
});

test('a carrier\'s own ship called back by the recall still launches in a battle once the hold is lifted; a ship that docked by order stays',()=>{
 // Physics re-review 2026-11-18: autoLaunch=false on every ship that went aboard also stopped the carrier's own ships.
 const {w,h,gs:[own,guest]}=world(2,{enemy:true});for(const u of [h,own,guest])u.order={...u.order,fire:false};own.carrier=h.id;own.autoLaunch=true;own.pos=[4200,0,0];own.yaw=0;/* facing away: it turns first */
 run(w,5);assert.ok(w.battles.has(h.sys),'the system is in battle');
 assert.equal(R.orderCarried(w,h.id,'recover').ok,true);assert.equal(R.orderDock(w,guest.id,h.id).ok,true);
 assert.ok(run(w,1500,()=>own.status==='carried'&&guest.status==='carried')!=null,'both aboard');assert.equal(own.autoLaunch,true,'the recalled ship keeps its setting');assert.equal(guest.autoLaunch,false);assert.equal(own.order.recall,undefined);
 run(w,5);assert.equal(own.status,'carried','held aboard by the recall (holdCarried)');assert.ok(w.battles.has(h.sys));
 assert.equal(R.orderCarried(w,h.id,'hold').hold,false);R.tick(w,.25);
 assert.notEqual(own.status,'carried','the carrier\'s own ship launches when the hold is lifted');assert.equal(guest.status,'carried','the ship that docked by order stays aboard');
});

test('a docking ship that is disabled, taken in tow, or sets out on a jump gives up the lane and the order',()=>{
 for(const [name,spoil] of [['disabled',g=>{g.out='電源喪失';}],['towed',g=>{g.towedBy='someone';}],['jumping',g=>{g.jump={phase:'spool'};}]]){
  const {w,h,gs}=world(2);for(const g of gs)R.orderDock(w,g.id,h.id);run(w,3);const holder=gs.find(g=>g.dockLane),other=gs.find(g=>g!==holder);assert.ok(holder&&other,name+': one holds the lane');
  spoil(holder);R.tick(w,.25);assert.equal(holder.dockLane,undefined,name+': lane given up');assert.equal(holder.order.type,'hold',name);assert.equal(h.dockLanes[0]===holder.id,false,name);
  holder.out=null;holder.towedBy=null;holder.jump=null;const t=run(w,900,()=>other.status==='carried');assert.ok(t!=null,name+': the other ship gets in');
 }
});

test('a disabled host takes no ship',()=>{const {w,h,gs:[g]}=world();h.out='電源喪失';assert.equal(R.dockCheck(w,g.id,h.id).ok,false);});

