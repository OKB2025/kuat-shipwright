// v26 supply convoy block on a task force card and the role selector strings, in Japanese and English.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
function source(name){const i=app.indexOf('\nfunction '+name+'(');assert.ok(i>=0,name);const j=app.indexOf('\n}\n',i);return app.slice(i+1,j+3);}
function setup(){
 const c=vm.createContext({console,navigator:{language:'en-US'}});for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/lang-en.js','js/i18n.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c,{filename:f});
 vm.runInContext(`const C=Core,R=Rts,esc=x=>String(x??''),num=x=>String(x),voyClock=s=>Math.round(s)+'s',voy={w:null};`,c);
 vm.runInContext(source('voyConvoyHTML'),c);return c;}
const jp=/[぀-ヿ㐀-鿿]/;
test('a forward task force card offers a convoy request with what would come, then shows it coming; English has no Japanese left',()=>{
 const c=setup();vm.runInContext(`const D=YardFleetData.designs,designs=Object.values(D).map(d=>({key:d.key,name:d.name,p:d.p,info:d.info}));
  voy.w=R.createWorld({seed:3,designs,sides:[{faction:'empire',ai:false},{faction:'rebel',ai:false}],fleets:[{ctgs:[{name:'A',tgs:[{name:'L',role:'line',ships:[{design:'imperial',name:'I'},{design:'arquitens',name:'A'}]}]}]},{ctgs:[{name:'B',tgs:[{name:'R',ships:[{design:'cr90',name:'C'}]}]}]}]});
  var w=voy.w,sd=w.sides[0],g=[...w.groups.values()].find(x=>x.side===0),S=w.sector;
  var far=S.systems.filter(x=>!sd.home.includes(x.id)&&R.routeCost(S,sd.start,x.id)<Infinity).sort((a,b)=>R.routeCost(S,sd.start,a.id)-R.routeCost(S,sd.start,b.id))[2];
  for(let i=0;i<4*7200&&g.sys!==far.id;i++){if(!g.spool&&!g.transit)R.orderJump(w,g.id,far.id);R.tick(w,R.TICK);}
  for(const id of g.units){const u=w.units.get(id);for(const x of u.sec)x.s=x.max*.5;}g.noAutoConvoy=true;sd.autoConvoy=false;for(let i=0;i<8;i++)R.tick(w,R.TICK);`,c);
 const h1=vm.runInContext('voyConvoyHTML(g)',c);assert.match(h1,/data-vact="convoy"(?![^>]*disabled)/);assert.match(h1,/補給を要請/);assert.match(h1,/自動要請/);
 vm.runInContext('R.requestConvoy(w,g.id)',c);const h2=vm.runInContext('voyConvoyHTML(g)',c);assert.match(h2,/補給船団 1 · 資材 \d+ t · 補給船 \d+ 隻 · 護衛 \d+ 隻 · 到着まで/);
 const T=s=>vm.runInContext('KSI18n.t('+JSON.stringify(s)+')',c);vm.runInContext("KSI18n.setLanguage?.('en')",c);
 for(const html of [h1,h2]){for(const text of html.split(/<[^>]*>/))if(text.trim())assert.doesNotMatch(T(text),jp,text+' => '+T(text));for(const m of html.matchAll(/title="([^"]*)"/g))assert.doesNotMatch(T(m[1]),jp,m[1]);}
 const h3=vm.runInContext('voyConvoyHTML([...w.groups.values()].find(x=>x.convoy))',c);assert.match(h3,/補給船団 · 資材/);for(const text of h3.split(/<[^>]*>/))if(text.trim())assert.doesNotMatch(T(text),jp,text);
});
test('role names and the role selector label translate',()=>{
 const c=setup(),T=s=>vm.runInContext('KSI18n.t('+JSON.stringify(s)+')',c);vm.runInContext("KSI18n.setLanguage?.('en')",c);
 assert.deepEqual(['役割','未指定','主力','護衛','偵察','強行偵察','襲撃'].map(T),['Role','Unassigned','Battle Line','Escort','Reconnaissance','Reconnaissance in Force','Raiding']);
 for(const s of ['反乱同盟：劣勢と判断し、通商破壊と各個撃破に転じる','銀河帝国：戦力の優位を回復し、艦隊決戦に転じる','mc30c-6 襲撃隊 が離脱：次の目標 ケールへ','第1任務群 ほか主力：敵主力を避けて M10-349へ移動','補給船団 2 が サルノールで資材 2678 t を引き渡し','補給船団 3：航路上の敵のため引き返す','ケールの補給集積所を敵に奪われた（資材 300 t）','補給船団 1：フィルからルーメマールへ（第1任務群の自動要請・補給船 1 隻・護衛 6 隻・資材 464 t・到着まで約 46 分）','LH-3210 型ルクレハルク級貨物船','DH-オムニ（代役） 3-2','船団護衛 1-1','補給船 2-1'])
  assert.doesNotMatch(T(s),jp,s+' => '+T(s));
});
