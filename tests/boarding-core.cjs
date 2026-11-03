// Boarding (接舷・移乗攻撃, docs/boarding.md): headless battles on the fleet profiles — lock, reel in, forced docking,
// the compartment fight and its three outcomes, the beam's strain and loss, the AI, the result hold and the regiments.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console,navigator:{language:'ja-JP'}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const {Core:C,Rts:R,designs:P}=vm.runInContext('({Core,Rts,designs:YardFleetData.designs})',context);
const designs=Object.values(P).map(d=>({key:d.key,name:d.name,p:d.p,info:d.info}));
const ob=list=>({ctgs:[{name:'第1合同任務群',tgs:[{name:'第11任務群',formation:'abreast',ships:list.map(([k,tr],i)=>({design:k,name:k+i,air:[],troops:tr||0}))}]}]});
const hurt=(u,k,v)=>(u.p.modules||[]).forEach((m,i)=>{if(m.k===k)u.mods[i]=v;});
// Two sides in one system, both holding fire; the target beside the attacker, disabled unless asked otherwise.
function scene(fa,fb,att,tgt,{dist=3000,out=true,shield=0,aiB=true}={}){
 const w=R.createWorld({seed:5,designs,sides:[{faction:fa,ai:false},{faction:fb,ai:aiB}],fleets:[ob([att]),ob([tgt])]});
 const g0=[...w.groups.values()].find(g=>g.side===0),g1=[...w.groups.values()].find(g=>g.side===1);g1.sys=g0.sys;for(const id of g1.units)w.units.get(id).sys=g0.sys;
 const u=w.units.get(g0.units[0]),t=w.units.get(g1.units[0]);for(const sd of w.sides)sd.brain={main:[],det:[],scouts:[],plan:null};
 t.pos=C.add(u.pos,[0,0,dist]);t.velocity=[0,0,0];u.velocity=[0,0,0];u.order={type:'hold',fire:false,power:'auto',aim:'auto'};t.order={...u.order};
 if(out)t.out='テスト';t.shield=shield*t.shieldMax;return {w,u,t};
}
const run=(w,sec,stop)=>{for(let i=0;i<sec/R.TICK;i++){R.tick(w,R.TICK);if(stop&&stop())return true;}return false;};
const log=w=>w.events.filter(e=>e.combat).map(e=>e.text);

test('a Star Destroyer\'s stormtroopers take a disabled CR90: lock, reel in, dock alongside, fight, capture',()=>{
 const {w,u,t}=scene('empire','rebel',['imperial',9700],['cr90',60]);
 assert.equal(R.boardStrain(u,t),0);assert.ok(R.boardOdds(w,u,t,288).odds>2);
 const r=R.orderBoard(w,u.id,t.id,{n:288});assert.ok(r.ok);assert.equal(r.n,288);
 const seen=new Set();assert.ok(run(w,1800,()=>{const i=R.boardInfo(w,u)||R.boardInfo(w,t);if(i)seen.add(i.phase);return t.captured;}));
 for(const p of ['reel','dock','fight'])assert.ok(seen.has(p),p);
 assert.equal(t.side,0);assert.equal(t.origSide,1);assert.ok(t.prisoners>0);assert.ok(t.crew>0&&t.crew<=t.p.crewNeed);
 assert.ok(u.troops<9700&&u.troops>=9700-288);assert.equal(u.troopsSpent,9700-u.troops);assert.equal(u.tractor.wait,0);
 assert.equal(u.tractor?.mode,'tow');assert.equal(w.sides[0].captured,1);assert.equal(w.sides[1].lost,1);
 const d=C.len(C.sub(t.pos,u.pos)),side=(u.p.width||u.p.len*.4)/2+(t.p.width||t.p.len*.4)/2+R.BOARD.gap;assert.ok(Math.abs(d-side)<60,'alongside '+d);
 for(const k of ['強制接舷','突入','制圧','艦橋を制圧'])assert.ok(log(w).some(s=>s.includes(k)),k);
});

test('an undermanned party is thrown back and the survivors return aboard',()=>{
 const {w,u,t}=scene('empire','rebel',['arquitens',100],['nebulonb',75]);
 assert.ok(R.orderBoard(w,u.id,t.id,{n:100}).ok);assert.ok(run(w,2400,()=>!t.boarding&&!u.tractor&&w.time>60));
 assert.ok(!t.captured);assert.equal(t.side,1);assert.ok(u.troops>0&&u.troops<100);assert.ok(log(w).some(s=>s.includes('撃退')));
});

test('droid crews never surrender: shut down from the bridge, or the stored battle droids throw the boarders back',()=>{
 {const {w,u,t}=scene('republic','cis',['venator',2304],['munificent',0]);R.orderBoard(w,u.id,t.id,{n:2304});
  assert.ok(run(w,3600,()=>t.captured));assert.ok(log(w).some(s=>s.includes('中央制御')));assert.ok(!log(w).some(s=>s.includes('降伏')));}
 {const {w,u,t}=scene('republic','cis',['venator',2304],['munificent',150000]);R.orderBoard(w,u.id,t.id,{n:2304});let woke=0;
  assert.ok(run(w,3600,()=>{if(t.boarding)woke=Math.max(woke,t.boarding.dT);return !t.boarding&&w.time>100&&!u.tractor;}));
  assert.ok(!t.captured);assert.ok(woke>100);assert.ok(!log(w).some(s=>s.includes('降伏')));}
});

test('the lock breaks when the projectors are destroyed mid-docking, or when the target\'s engines overpower them',()=>{
 {const {w,u,t}=scene('empire','rebel',['imperial',9700],['cr90',60],{out:false,shield:.1});hurt(t,'engine',.2);hurt(t,'shield',0);
  assert.ok(R.boardStrain(u,t)<1);assert.ok(R.orderBoard(w,u.id,t.id,{n:288}).ok);run(w,600,()=>u.tractor?.phase==='dock');assert.equal(u.tractor?.phase,'dock');
  (u.p.modules||[]).forEach((m,i)=>{if(m.name===C.FITS.trc.short)u.mods[i]=0;});run(w,5);
  assert.equal(u.tractor,null);assert.ok(!t.towedBy&&!t.captured);assert.equal(u.troops,9700,'the troops waiting go back to their quarters');}
 {const {w,u,t}=scene('empire','rebel',['arquitens',100],['cr90',60],{out:false,shield:.1,dist:1500});hurt(t,'shield',0);
  assert.ok(R.boardStrain(u,t)>1);R.orderBoard(w,u.id,t.id);assert.ok(run(w,600,()=>!u.tractor));assert.ok(log(w).some(s=>s.includes('振り切られた')));}
 {const {w,u,t}=scene('empire','rebel',['imperial',9700],['cr90',60],{out:false,shield:.8});const r=R.orderBoard(w,u.id,t.id);assert.ok(!r.ok);assert.match(r.why,/25%/);}
});

test('sabotage wrecks the systems of the compartments taken and the party withdraws',()=>{
 const {w,u,t}=scene('empire','rebel',['imperial',9700],['cr90',60]);R.orderBoard(w,u.id,t.id,{n:432,goal:'sabotage'});
 assert.ok(run(w,2400,()=>!t.boarding&&!u.tractor&&w.time>60));assert.ok(!t.captured);
 assert.ok((t.p.modules||[]).filter((m,i)=>t.mods[i]<=0&&m.k!=='hull').length>0);assert.ok(u.troops>9700-432);assert.ok(log(w).some(s=>s.includes('破壊工作')));
});

test('the enemy AI boards with troops and a tractor beam; the old 拿捕 order is a boarding with a default party',()=>{
 {const {w,u,t}=scene('rebel','empire',['cr90',60],['imperial',9700],{out:false});u.out='テスト';u.shield=0;w.battles.set(u.sys,{t0:0,log:[]});
  assert.ok(run(w,2400,()=>u.captured));assert.equal(u.side,1);}
 {const {w,u,t}=scene('empire','rebel',['imperial',9700],['cr90',60]);const r=R.orderTractor(w,u.id,'capture',t.id);
  assert.ok(r.ok);assert.equal(r.n%R.COMPANY_TROOPS,0);assert.ok(run(w,1800,()=>t.captured));}
});

test('the battle result waits for a boarding under way, and regiments shrink by the troops spent',()=>{
 const {w,u,t}=scene('empire','rebel',['imperial',9700],['cr90',60]);R.orderBoard(w,u.id,t.id,{n:288});
 for(let i=0;i<4*1800&&!w.result;i++)R.step(w,R.TICK);assert.ok(t.captured&&w.result);assert.equal(w.result.winner,0);
 const g=[R.makeRegiment('empire','第1連隊')],n0=R.regimentTotals(g[0]).troops;R.groundTrim(g,300);assert.equal(R.regimentTotals(g[0]).troops,n0-300);
});
