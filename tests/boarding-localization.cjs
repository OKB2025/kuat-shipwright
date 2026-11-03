// Boarding (接舷・移乗攻撃): every combat-log line, refusal and card string of real boarding actions renders in English.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),context=vm.createContext({console,navigator:{language:'en-US'},performance:{now:()=>0}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/lang-en.js','js/i18n.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const run=code=>vm.runInContext(code,context),jp=/[぀-ヿ㐀-鿿]/;
const {Core:C,Rts:R,designs:P}=run('({Core,Rts,designs:YardFleetData.designs})');context.KSI18n.setLanguage('en');
function translated(source){const out=context.KSI18n.t(source);assert.doesNotMatch(out,jp,source+' => '+out);return out;}
const texts=html=>html.replace(/<[^>]+>/g,'\n').split('\n').map(s=>s.trim()).filter(Boolean);
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);run(app.slice(a,b));}
const designs=Object.values(P).map(d=>({key:d.key,name:d.name,p:d.p,info:d.info}));
const ob=list=>({ctgs:[{name:'TF',tgs:[{name:'TG',formation:'abreast',ships:list.map(([k,tr],i)=>({design:k,name:'S'+k+i,air:[],troops:tr||0}))}]}]});
function scene(fa,fb,att,tgt,{dist=3000,out=true}={}){const w=R.createWorld({seed:5,designs,sides:[{faction:fa,ai:false},{faction:fb,ai:true}],fleets:[ob([att]),ob([tgt])]});
 const g0=[...w.groups.values()].find(g=>g.side===0),g1=[...w.groups.values()].find(g=>g.side===1);g1.sys=g0.sys;for(const id of g1.units)w.units.get(id).sys=g0.sys;
 const u=w.units.get(g0.units[0]),t=w.units.get(g1.units[0]);for(const sd of w.sides)sd.brain={main:[],det:[],scouts:[],plan:null};
 t.pos=C.add(u.pos,[0,0,dist]);u.order={type:'hold',fire:false,power:'auto',aim:'auto'};t.order={...u.order};if(out)t.out='推進停止';t.shield=0;return {w,u,t};}
const tick=(w,s,f)=>{for(let i=0;i<s/R.TICK;i++){R.tick(w,R.TICK);if(f&&f())return;}};

test('the combat log and events of capture, repulse, droid shutdown, sabotage and a slipped beam translate',()=>{
 for(const [a,b,att,tgt,goal,n] of [['empire','rebel',['imperial',9700],['cr90',60],'capture',288],['empire','rebel',['arquitens',100],['nebulonb',75],'capture',100],['republic','cis',['venator',2304],['munificent',0],'capture',2304],['empire','rebel',['imperial',9700],['cr90',60],'sabotage',432]]){
  const {w,u,t}=scene(a,b,att,tgt);R.orderBoard(w,u.id,t.id,{n,goal});tick(w,3000,()=>!u.tractor&&!t.boarding&&w.time>60||t.captured&&w.time>200);
  assert.ok(w.events.some(e=>/移乗/.test(e.text)));for(const e of w.events)translated(e.text);}
 const {w,u,t}=scene('empire','rebel',['arquitens',100],['cr90',60],{out:false,dist:1500});(t.p.modules||[]).forEach((m,i)=>{if(m.k==='shield')t.mods[i]=0;});R.orderBoard(w,u.id,t.id);tick(w,300,()=>!u.tractor);
 assert.match(translated(w.events.find(e=>/振り切られた/.test(e.text)).text),/broke free/);
});

test('refusals, phases and goals translate',()=>{
 const {w,u,t}=scene('empire','rebel',['imperial',9700],['cr90',60],{out:false});t.shield=t.shieldMax;
 assert.match(translated(R.orderBoard(w,u.id,t.id).why),/25%/);translated(R.orderBoard(w,t.id,u.id).why);translated(R.orderBoardRecall(w,u.id).why);
 for(const v of [...Object.values(R.BOARD_PHASE),...Object.values(R.BOARD_GOAL)])translated(v);
});

test('the actual foe-card panel, progress rows and state phrases translate through a whole boarding',()=>{
 run(`var R=Rts,C=Core,esc=s=>String(s),num=v=>Number(v).toLocaleString('en-US'),toast=()=>{},voySelUnits=()=>[],voyTacSel=()=>({}),voyRenderSide=()=>{};var voy={w:null,board:null};`);
 section('// ---- v26 boarding (接舷・移乗攻撃) ----','function voyRenderSide(');section('function voyTowers(','function voyTractorOrder(');
 for(const [fa,fb,att,tgt,at] of [['empire','rebel',['imperial',9700],['cr90',60],[0,20,60,120]],['republic','cis',['venator',2304],['munificent',150000],[0,40,90]],['empire','rebel',['arquitens',0],['cr90',60],[0]]]){
  const {w,u,t}=scene(fa,fb,att,tgt);context.voy.w=w;
  for(const b of [null,{n:'all',goal:'sabotage'},{n:2,goal:'capture'}]){context.voy.board=b;for(const s of texts(run('voyBoardHTML')(t)))translated(s);}
  if(!(u.troops>0)){assert.ok(texts(run('voyBoardHTML')(t)).some(x=>/security crew/.test(translated(x))),'a ship without troops offers its security crew');continue;}
  R.orderBoard(w,u.id,t.id);let last=0;
  for(const s of at){tick(w,s-last);last=s;for(const x of texts(run('voyBoardHTML')(t)+run('voyBoardRows')(u)))translated(x);for(const x of [u,t]){const b=run('voyBoardBrief')(x);if(b)translated('待機'+b);}}
 }
 assert.equal(translated('待機 · 移乗攻撃（艦内戦闘 1/3 区画）'),'Standby · Boarding (Fighting Aboard 1/3 compartments)');
});
