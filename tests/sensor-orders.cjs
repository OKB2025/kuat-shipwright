const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const {C,R,D}=vm.runInContext('({C:Core,R:Rts,D:YardFleetData.designs})',cx),copy=x=>JSON.parse(JSON.stringify(x)),vectorNear=(a,b)=>{assert.equal(a.length,b.length);a.forEach((n,i)=>assert.ok(Math.abs(n-b[i])<1e-8,`${a} vs ${b}`));};
function fixture(mode,hidden=[45000,0,25000],fix=[14000,0,7000],sensors=true){
 const p=copy(D.cr90.p);Object.assign(p,{name:'Perception gunship',len:200,width:80,height:60,hp:1e9,D:0,shieldBuffer:0,reserve:0,accel:40,maxSpeed:400,turnRate:.05,gunArcs:Array(6).fill(100),ionArcs:Array(6).fill(0),gunBands:{long:Array(6).fill(100),mid:Array(6).fill(0),close:Array(6).fill(0)},aaArcs:Array(6).fill(0),gunBest:100,gunMean:100,gunRateBest:100,gunRateMean:100,ionBest:0,ionMean:0,aa:0,msl:80,imsl:0,slots:0,embarkedSlots:0,aviationSize:0,launch:0,crewNeed:0,crewMax:0,autoCrew:0,wCap:1000,modules:[],grid:{P:C.TT*1000,fixed:0,De:C.TT*10,Ds:0,Dw:C.TT*200},acc:1,sens:{nu:0,ir:0,em:0,rad:0}});for(const k of ['hf','outline','heat','sw','mouths'])delete p[k];
 const w=R.createWorld({region:'kuat',seed:13,sensors,designs:[{key:'test',name:'Test',p,info:{capital:false,sensor:1}}],sides:[{faction:'rebel',ai:false},{faction:'empire',ai:false}],fleets:[[{design:'test',air:[],ground:[],troops:0}],[{design:'test',air:[],ground:[],troops:0}]]}),u=[...w.units.values()].find(u=>u.side===0),t=[...w.units.values()].find(u=>u.side===1),sys=u.sys,g=w.groups.get(u.group);
 for(const group of w.groups.values()){group.sys=sys;group.inbound=null;group.order={type:'hold'};}
 for(const [ship,pos]of [[u,[0,0,0]],[t,hidden]])Object.assign(ship,{sys,pos:pos.slice(),velocity:[0,0,0],yaw:0,warp:null,jump:null,order:{type:'hold',fire:ship===u,power:'balanced',aim:'auto',volley:'stream'}});t.manual=true;
 const attack={type:'attack',target:t.id};if(mode==='individual')u.order={...u.order,...attack};if(mode==='group'){g.order={...attack};u.order.type='group';}if(mode==='auto-individual'){u.order.type='auto';u.auto={...attack};}if(mode==='auto-group'){u.order.type='group';g.order={type:'auto'};g.auto={...attack};}
 const c={id:t.id,sys,st:6,cap:0,observed:false,seen:w.time,at:w.time,since:w.time,next:999,snr:{nu:0,ir:0,em:0,rad:0},est:fix?.slice()??null,err:1000,low:0};w.sides[0].tc=new Map([[t.id,c]]);
 const intent=()=>copy({unit:u.order,group:g.order,unitAuto:u.auto,groupAuto:g.auto}),before=intent();return {w,u,t,g,c,sys,intent,before,tick(n=4){for(let i=0;i<n;i++)R.tick(w,.25);},state(){return {pos:copy(u.pos),velocity:copy(u.velocity),yaw:u.yaw,tf:g.tf?copy({ref:g.tf.ref,vel:g.tf.vel,hdg:g.tf.hdg,dest:g.tf.dest}):null};}};
}

for(const mode of ['individual','group','auto-individual','auto-group'])test(`${mode} attack follows the retained fix instead of a counterfactual hidden enemy position`,()=>{
 const a=fixture(mode,[45000,0,25000]),b=fixture(mode,[-35000,500,-42000]);a.tick();b.tick();vectorNear(a.u.pos,b.u.pos);vectorNear(a.u.velocity,b.u.velocity);assert.ok(C.len(a.u.velocity)>0,'a finite retained fix remains a navigation objective');assert.ok(Math.abs(a.u.yaw-b.u.yaw)<1e-9);if(a.g.tf){vectorNear(a.g.tf.ref,b.g.tf.ref);vectorNear(a.g.tf.dest[a.u.id],b.g.tf.dest[b.u.id]);}
 for(const f of [a,b]){assert.deepEqual(f.intent(),f.before,'reading a perceived order must preserve explicit and cached intent');assert.equal(f.u.lastShot,null);assert.equal(f.u.firingAt,null);assert.equal(f.u.dmgDone,0);assert.equal(f.w.missiles.length,0);assert.equal(R.contactStage(f.w,0,f.t),1);}
});

test('an absent or invalid retained fix holds an explicit attack without mutating it',()=>{
 for(const mode of ['individual','group','auto-individual','auto-group'])for(const fix of [null,[Infinity,0,0]]){const f=fixture(mode,undefined,fix);f.tick();assert.equal(C.len(f.u.velocity),0);vectorNear(f.u.pos,[0,0,0]);assert.deepEqual(f.intent(),f.before);assert.equal(f.u.lastShot,null);assert.equal(f.w.missiles.length,0);}
});

test('reacquisition resumes the original attack while sensor-free sandbox movement keeps its previous behavior',()=>{
 for(const mode of ['individual','group','auto-individual','auto-group']){const f=fixture(mode,[20000,0,0]),legacy=fixture(mode,[20000,0,0],undefined,false);f.tick();assert.equal(f.u.firingAt,null);f.c.observed=true;f.c.cap=6;f.tick(1);assert.equal(f.u.firingAt,f.t.id);assert.ok(f.u.lastShot?.gun>0);assert.deepEqual(f.intent(),f.before);legacy.tick(1);assert.equal(legacy.u.firingAt,legacy.t.id);assert.ok(legacy.u.lastShot?.gun>0);}
});
