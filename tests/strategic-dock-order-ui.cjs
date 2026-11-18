// The strategic map's dock command (docs/ship-docking.md, v28): the order bar offers it for a ship selection, the order
// line names the host, and every text the command can show has an English form. The tap itself (voyTapUnit) and the map
// need a browser and are not covered here.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),context=vm.createContext({console,navigator:{language:'en-US'}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/lang-en.js','js/i18n.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const run=code=>vm.runInContext(code,context),jp=/[぀-ヿ㐀-鿿]/;
function translated(source){const out=context.KSI18n.t(source);assert.doesNotMatch(out,jp,source+' => '+out);return out;}
const fn=name=>{const a=app.indexOf('function '+name+'('),b=app.indexOf('\n}',a)+2;assert.ok(a>=0&&b>a,name);return app.slice(a,b);};
run('const voy={cmd:null,w:{units:new Map([["h",{name:"Carrier"}]])}},esc=String,voyStateName=(a,b)=>a+b,VOY_ORDER={hold:"待機"};'+fn('voyOrderButtons')+app.slice(app.indexOf('function voyOrderText('),app.indexOf('\n',app.indexOf('function voyOrderText('))));
run(app.slice(app.indexOf('const VOY_CMD_HINT = '),app.indexOf('\n',app.indexOf('const VOY_CMD_HINT = '))));

test('the order bar offers Dock for a ship selection only, and the order line names the host',()=>{
 const ship=run("voyOrderButtons('ship','auto')"),tg=run("voyOrderButtons('tg','auto')");
 assert.match(ship,/data-vact="cmd:dock">入渠</);assert.doesNotMatch(tg,/cmd:dock/,'a task group is ordered ship by ship');
 run("voy.cmd={type:'dock'}");assert.match(run("voyOrderButtons('ship','auto')"),/class="btn sm on" data-vact="cmd:dock"/,'the armed command is lit');run('voy.cmd=null');
 assert.equal(run("voyOrderText({type:'dock',target:'h'})"),'入渠：Carrier');assert.ok(run('VOY_CMD_HINT.dock'));
});

test('every text of the dock command has an English form',()=>{
 for(const text of ['入渠',run('VOY_CMD_HINT.dock'),'入渠：','入渠させる艦を選んでから、入渠先の艦をタップしてください','入渠できません','搭載艦を呼び戻す（格納庫へ入渠）','搭載艦 2 隻を呼び戻しました（格納庫へ入渠します）',
  '2 隻がHome Oneへ入渠します','2 隻がHome Oneへ入渠します（入れない艦：入渠先が行動不能です）','入渠先には味方の別の艦を選んでください','同じ星系にいて、ジャンプ中でない艦にだけ入渠できます','入渠先が行動不能です',
  'この艦は命令を受けられません','呼び戻せる搭載艦がいません（別の星系にいるか、航行不能か、格納庫に入れません）'])translated(text);
 // the events and refusals the core writes, with names in them
 const {C,R,F}=run('({C:Core,R:Rts,F:YardFleetData})'),plain=v=>JSON.parse(JSON.stringify(v)),hp=plain(F.designs.venator.p);hp.mouths=[{hatchId:99,p:[3000,0,0],n:[1,0,0],ax:[0,0,1],o:[12,6],r:1,in:[1750,0,0],d:1250,sl:0,bs:[2500,1000,1600]}];
 const host={key:'h',p:hp,info:{mass:1e7,hyper:1,capital:true,sensor:0,hangarCap:10}},small={key:'g',p:plain(F.designs.cr90.p),info:{mass:4e4,hyper:1,capital:false,sensor:0}};
 const w=R.createWorld({mode:'test',sensors:false,convoyMode:false,designs:[host,small],sides:[{faction:'empire',ai:false},{faction:'rebel',ai:false}],fleets:[[{design:'h'},{design:'g'}],[]]}),us=[...w.units.values()],h=us.find(u=>u.key==='h'),g=us.find(u=>u.key==='g');
 h.name='Carrier';g.name='Corvette';translated(R.dockCheck(w,g.id,h.id).why);/* no opening it can pass */
 h.p.mouths[0].o=[1500,800];assert.match(translated(R.dockCheck(w,g.id,h.id).why),/No room/);
 for(const text of ['Corvette：Carrierの格納庫に入渠','Corvette：入渠を中止（入渠先が失われた）','Corvette：入渠を中止（入渠先がいない）','Corvette：入渠を中止（通れる開口がない）','Corvette：入渠を中止（格納庫に空きがない）','Corvette：入渠を中止（航行不能）','Corvette：入渠を中止（牽引されている）','Corvette：入渠を中止（ジャンプに入る）','Corvette：入渠を中止（入渠先が行動不能）','Carrier が搭載艦 2 隻を呼び戻す'])translated(text);
});
