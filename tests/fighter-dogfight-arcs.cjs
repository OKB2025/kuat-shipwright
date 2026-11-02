const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),source=fs.readFileSync(path.join(root,'js/core.js'),'utf8'),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const {C,R}=vm.runInContext('({C:Core,R:Rts})',context),start=source.indexOf(' // A squadron fires at one nearby enemy'),end=source.indexOf(' // v25 each squadron',start);
assert.ok(start>0&&end>start);const step=new Function('sq','w','dt','C','CRAFT','RULES','squadLaserK','squadFireArc','TICK',source.slice(start,end)+'\nreturn {loss:Array.from(loss),dfBy,air};');
function craft(key,aa=1,arcs){R.CRAFT[key]={role:'fighter',aa,gun:aa,armor:1,fireArcs:arcs||[{fixed:true,dir:[1,0,0],up:[0,1,0],pos:[0,0,0],gun:aa,aa,cycle:.1}]};return key;}
function squad(id,side,pos,h=[1,0,0],key='nose'){return {id,side,craft:key,pos,h,state:'out',n:1,heat:0};}
function fire(list,wrap,time=10){const gate=wrap||((...args)=>R.squadFireArc(...args));return step(list,{time,sides:[{},{}]},.25,C,R.CRAFT,R.RULES,R.squadLaserK,gate,R.TICK);}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);

test('fixed dogfight damage follows the attacker heading, and merely taking fire does not trigger a victim laser',()=>{
 craft('nose',10);const a=squad('attacker',0,[0,0,0]),b=squad('victim',1,[1000,0,0]),q=fire([a,b]);
 near(q.loss[0],0);near(q.loss[1],R.RULES.dogfight*10*.25);assert.equal(a.dogfight,10);assert.equal(a.dfFoe,b.id);assert.notEqual(b.dogfight,10);assert.equal(b.dfFoe,null);assert.deepEqual(q.dfBy,[null,a.id]);
 const turned=fire([squad('turned',0,[0,0,0],[-1,0,0]),squad('ahead',1,[1000,0,0])]);assert.deepEqual(turned.loss,[0,0]);
});

test('each squadron directs its firepower at one valid enemy and keeps a valid target between ticks',()=>{
 craft('nose',2);craft('unarmed',0);const a=squad('attacker',0,[0,0,0]),nearer=squad('near',1,[900,0,0],[1,0,0],'unarmed'),far=squad('far',1,[1300,0,0],[1,0,0],'unarmed');
 const q=fire([a,nearer,far]);assert.ok(q.loss[1]>0);near(q.loss[2],0);assert.equal(a.dfFoe,'near');
 a.dfFoe='far';const locked=fire([a,nearer,far]);near(locked.loss[1],0);assert.ok(locked.loss[2]>0);assert.equal(a.dfFoe,'far');
});

test('rear and side enemies cannot draw a nose laser, while an in-arc target can replace an invalid old lock',()=>{
 craft('nose',2);craft('unarmed',0);const a=squad('attacker',0,[0,0,0]);a.dfFoe='rear';
 const rows=[a,squad('rear',1,[-100,0,0],[1,0,0],'unarmed'),squad('side',1,[0,0,100],[1,0,0],'unarmed'),squad('front',1,[1000,0,0],[1,0,0],'unarmed')],q=fire(rows);
 assert.deepEqual(q.loss.slice(0,3),[0,0,0]);assert.ok(q.loss[3]>0);assert.equal(a.dfFoe,'front');
});

test('kill-credit source is the strongest actual attacker rather than the victim own outgoing target',()=>{
 craft('light',2);craft('heavy',6);craft('unarmed',0);const a=squad('light',0,[0,0,0],[1,0,0],'light'),b=squad('heavy',0,[0,20,0],[1,0,0],'heavy'),v=squad('victim',1,[1000,0,0],[1,0,0],'unarmed');v.dfFoe='unrelated';
 const q=fire([a,b,v]);near(q.loss[2],R.RULES.dogfight*8*.25);assert.equal(q.dfBy[2],b.id);assert.equal(v.dfFoe,null);
});

test('dense dogfights bound directional queries and do not multiply one battery damage by every nearby enemy',()=>{
 craft('nose',2);craft('unarmed',0);const a=squad('attacker',0,[0,0,0]),rows=[a,...Array.from({length:1200},(_,i)=>squad('enemy'+i,1,[1000,i%7,i%11],[1,0,0],'unarmed'))];let queries=0;
 const q=fire(rows,(...args)=>{queries++;return R.squadFireArc(...args);});assert.ok(queries<=64,queries);assert.equal(q.loss.filter(v=>v>0).length,1);near(q.loss.reduce((x,y)=>x+y,0),R.RULES.dogfight*2*.25);assert.ok(a.dfFoe);
});
