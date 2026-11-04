// v26 strategic AI, supply convoys on request, task force roles and the LH-3210 freighter (docs/strategic-ai.md).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const {R,D}=vm.runInContext('({R:Rts,D:YardFleetData.designs})',cx),plain=x=>JSON.parse(JSON.stringify(x));
const designs=Object.values(D).map(d=>({key:d.key,name:d.name,p:d.p,info:d.info}));
const tf=(role,keys,faction)=>({name:role,role,formation:'abreast',ships:keys.map((k,i)=>({design:k,name:k+i,air:faction?R.defaultAir(D[k].info,faction):[]}))});
function world(o={}){return R.createWorld({seed:3,designs,convoyMode:o.convoy!==false,sides:[{faction:o.fac||'empire',ai:!!o.ai},{faction:o.foe||'rebel',ai:!!o.ai}],
 fleets:[{ctgs:[{name:'A',tgs:o.tgs||[tf('line',['imperial','arquitens']),tf('raid',['arquitens','arquitens'])]}]},{ctgs:[{name:'B',tgs:o.foeTgs||[tf('line',['cr90'])]}]}]});}
const run=(w,s)=>{for(let i=0;i<s*4;i++)R.tick(w,R.TICK);};
// A forward system (not a depot) a few lanes from the side's start, the group moved there leg by leg (lane rule).
function forward(w,g,k=3){const S=w.sector,sd=w.sides[g.side];const far=S.systems.filter(x=>!sd.home.includes(x.id)&&R.routeCost(S,sd.start,x.id)<Infinity).sort((a,b)=>R.routeCost(S,sd.start,a.id)-R.routeCost(S,sd.start,b.id))[k];
 for(let i=0;i<4*7200&&g.sys!==far.id;i++){if(!g.spool&&!g.transit&&g.sys!=null)R.orderJump(w,g.id,far.id);R.tick(w,R.TICK);}assert.equal(g.sys,far.id);return far.id;}
const damage=(w,g,k=.5)=>{for(const id of g.units){const u=w.units.get(id);for(const x of u.sec)x.s=x.max*k;}};
const hull=(w,g)=>g.units.reduce((n,id)=>n+R.unitStruct(w.units.get(id)),0);

test('task force roles travel from the order of battle into the battle; a convoy is not a player role',()=>{
 const w=world(),gs=[...w.groups.values()].filter(g=>g.side===0);assert.deepEqual(gs.map(g=>g.role),['line','raid']);
 const n=R.normalizeScenario({sides:[{fleet:{ctgs:[{tgs:[{role:'recon',ships:[{key:'cr90'}]},{role:'convoy',ships:[{key:'cr90'}]}]}]}}]}),t=n.sides[0].fleet.ctgs[0].tgs;
 assert.equal(t[0].role,'recon');assert.equal(t[1].role,undefined);assert.ok(!('convoy' in R.TF_ROLES));
 assert.deepEqual(Object.keys(R.TF_ROLES),['line','escort','recon','reconf','raid']);
});

test('a convoy on request is sized for the need, follows the lane rule, delivers to the dump and mends the ships',()=>{
 const w=world(),sd=w.sides[0],g=[...w.groups.values()].find(x=>x.side===0&&x.role==='line');assert.ok(sd.supply.convoy);
 const at=forward(w,g);const p0=R.convoyPlan(w,g.id);assert.equal(p0.ok,false);
 damage(w,g);run(w,2);const h0=hull(w,g),p=R.convoyPlan(w,g.id);assert.ok(p.ok,p.why);assert.ok(p.ships.length>=1&&p.escorts.length>=2);
 const r=R.requestConvoy(w,g.id);assert.ok(r.ok);const cv=w.convoys.get(r.id),cg=w.groups.get(cv.gid);assert.ok(cg.units.every(id=>w.units.get(id).convoy));
 assert.equal(R.convoysFor(w,g.id).length,1);
 const seen=new Set();for(let i=0;i<4*7200&&cv.phase==='out';i++){R.tick(w,R.TICK);if(cg.sys!=null)seen.add(cg.sys);}
 assert.notEqual(cv.phase,'out');const plan=R.routeItinerary(w.sector,cv.home,at);for(const s of plan.stops)assert.ok(seen.has(s),'the convoy dropped out at every mandatory stop');
 run(w,900);assert.ok(hull(w,g)>h0+.2,'repairs came from the convoy');
 for(let i=0;i<4*7200&&w.convoys.has(r.id);i++)R.tick(w,R.TICK);assert.ok(!w.convoys.has(r.id)&&!w.groups.has(cv.gid),'it went home and stood down');
});

test('a convoy lost on the way takes its cargo with it and the fleet gets fewer repairs',()=>{
 const go=kill=>{const w=world(),sd=w.sides[0],g=[...w.groups.values()].find(x=>x.side===0&&x.role==='line');forward(w,g);damage(w,g);sd.autoConvoy=false;run(w,2);
  const r=R.requestConvoy(w,g.id),cv=w.convoys.get(r.id);if(kill)for(const id of w.groups.get(cv.gid).units){const u=w.units.get(id);if(u.cargo>0){u.out='test';R.orderScuttle(w,u.id);}}
  run(w,5400);return {hull:hull(w,g),lost:sd.supply.lostTotal};};
 const a=go(false),b=go(true);assert.ok(b.lost>0);assert.ok(b.hull<a.hull-.1,`${b.hull} vs ${a.hull}`);
});

test('big deliveries go in the LH-3210 freighter for the Separatists and the Alliance',()=>{
 assert.equal(D.lh3210?.p.gunBest||0,0);assert.ok(D.lh3210.info.cargo>D.lucrehulk.info.cargo||!D.lucrehulk.info.cargo);
 for(const fac of ['cis','rebel']){const keys=fac==='cis'?['providence','providence','recusant','recusant']:['mc80home','mc75','mc75','mc80liberty'];
  const w=world({fac,foe:'empire',tgs:[tf('line',keys,fac)],foeTgs:[tf('line',['gozanti'])]}),sd=w.sides[0],g=[...w.groups.values()].find(x=>x.side===0);forward(w,g,2);
  damage(w,g,.2);for(const q of w.squads.values())if(q.side===0){q.n=0;q.state='lost';}sd.autoConvoy=false;sd.supply.store=sd.supply.storeMax;run(w,2);
  const p=R.convoyPlan(w,g.id);assert.ok(p.ok,p.why);assert.ok(p.ships.includes('lh3210'),fac+': '+p.ships.join('/'));}
});

test('without the convoy designs (or with convoys off) the abstract train still runs, with tunable interdiction',()=>{
 const w=world({convoy:false});assert.equal(w.sides[0].supply.convoy,false);assert.ok(R.SUPPLY.cut>0&&R.SUPPLY.cut<1);
});

test('an outmatched AI side turns to raiding: raiders detached, main body kept together, no endless flight',()=>{
 const w=world({ai:true,fac:'rebel',foe:'empire',tgs:[tf('line',['mc80home','mc75','nebulonb','cr90'],'rebel'),tf('line',['mc75','nebulonb','cr90','cr90'],'rebel'),tf('raid',['mc30c','mc30c','mc30c','cr90'],'rebel')],
  foeTgs:[tf('line',['imperial','imperial','arquitens','arquitens'],'empire'),tf('line',['imperial','imperial','arquitens','dreadnaught'],'empire')]});
 // what the rebels know: the Empire's fleet seen where it is
 const sd=w.sides[0];
 for(const g of w.groups.values())if(g.side===1){const us=g.units.map(id=>w.units.get(id));sd.contacts.set(g.id,{gid:g.id,sys:g.sys,time:0,ships:us.length,strength:us.reduce((n,u)=>n+R.unitStrength(u),0),exact:true});}
 run(w,90);const A=sd.brain;assert.ok(A.own);assert.equal(A.mode,'raid');assert.ok(A.raiders.length>=1);
 const raid=A.raiders.map(id=>w.groups.get(id)).filter(Boolean);assert.ok(raid.some(g=>g.role==='raid'),'the raiding task force raids');
 run(w,3600);const fled=[...A.fled.values()].map(l=>l.length);assert.ok(fled.every(n=>n<=R.AI_PLAN.stand+1));
});

test('an AI group stopped at a branch-line system goes on to its destination by itself',()=>{
 const w=world({ai:true}),S=w.sector,g=[...w.groups.values()].find(x=>x.side===0&&x.role==='line');R.tick(w,R.TICK);const A=w.sides[0].brain;assert.ok(A?.own);A.main=[];A.det=[];A.raiders=[];A.scouts=[];
 let dest=null;for(const x of S.systems){const p=R.routeItinerary(S,g.sys,x.id);if(p?.segments.length>=2){dest=x.id;break;}}assert.ok(dest!=null);
 R.orderJump(w,g.id,dest);for(let i=0;i<4*7200&&g.sys!==dest;i++)R.tick(w,R.TICK);assert.equal(g.sys,dest);assert.equal(g.navigation,null);
});
