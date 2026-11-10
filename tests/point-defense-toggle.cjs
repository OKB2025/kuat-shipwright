const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const {C,R}=vm.runInContext('({C:Core,R:Rts})',context),copy=x=>JSON.parse(JSON.stringify(x)),profiles=new Map();
const near=(a,b,label)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=Math.max(1,Math.abs(b))*1e-9,`${label}: ${a} != ${b}`);
function profile(kind){
 if(!profiles.has(kind)){
  const ship=C.newShip({L:500,W:300,H:160,plan:'rect',sec:'rect'},'Automatic defence control');
  ship.parts=[{id:1,k:'gen',d:100,c:[250,80,0]},{id:3,k:'fuel',d:40,c:[100,80,0]},{id:4,k:'pump',d:21,c:[250,80,-75]}];ship.fits=[{id:2,k:kind,p:[250,160,0],a:2,ped:0,base:0,low:0,float:false}];ship.nextId=5;
  profiles.set(kind,C.fleetProfile(C.computeStats(ship),ship.name,ship));
 }
 return copy(profiles.get(kind));
}
function battle(kind='pd'){
 const p=profile(kind),w=R.createWorld({region:'kuat',seed:13,sensors:false,designs:[{key:'own',name:'Own',p,info:{capital:false,sensor:1}},{key:'enemy',name:'Enemy',p:copy(p),info:{capital:false,sensor:1}}],sides:[{faction:'rebel',ai:false},{faction:'empire',ai:false}],fleets:[[{design:'own',air:[],ground:[],troops:0}],[{design:'enemy',air:[],ground:[],troops:0}]]}),[u,e]=[...w.units.values()],sys=u.sys;
 for(const g of w.groups.values()){g.sys=sys;g.inbound=null;g.order={type:'hold'};}
 for(const x of [u,e])Object.assign(x,{sys,pos:x===u?[0,0,0]:[5000,0,0],yaw:x===u?0:Math.PI,velocity:[0,0,0],warp:null,jump:null,order:{type:'hold',fire:true,power:'balanced',aim:'auto',volley:'stream'}});
 e.manual=true;return {w,u,e,sys};
}
function incoming(f){const m={id:'incoming',sys:f.sys,side:1,from:f.e.id,target:f.u.id,n:8,pos:[4500,0,0],vel:[-220,0,0],s:220,life:45};f.w.missiles.push(m);return m;}

test('OFF stops actual missile interception for both installed PD families without silencing aimed ship fire',()=>{
 for(const kind of ['pd','monCalPD']){
  const f=battle(kind),m=incoming(f);assert.equal(C.setAutomaticPointDefense(f.u,false),true);R.tick(f.w,.25);
  near(m.n,8,kind+' incoming rounds');assert.equal(f.u.dualDefense,false);assert.equal(f.u.aaLeft,undefined,'OFF does not consume an interception channel');
  assert.ok(f.u.lastShot?.gun>0,kind+' remains an aimed weapon');
 }
});
test('reenabling automatic interception uses the existing unit and resumes actual defence on the next step',()=>{
 const f=battle(),m=incoming(f);C.setAutomaticPointDefense(f.u,false);f.u.order.fire=false;R.tick(f.w,.25);near(m.n,8,'disabled interception');
 C.setAutomaticPointDefense(f.u,true);R.tick(f.w,.25);assert.ok(m.n<8&&m.n>0);assert.equal(f.u.dualDefense,true);assert.ok(f.u.aaLeft<f.u.p.aaCh);
});
test('an OFF incoming threat adds no shot, capacitor debit, generation or weapon heat over the same idle ship',()=>{
 const plain=battle(),threatened=battle();for(const f of [plain,threatened]){C.setAutomaticPointDefense(f.u,false);f.u.order.fire=false;}incoming(threatened);
 R.tick(plain.w,.25);R.tick(threatened.w,.25);
 assert.equal(threatened.u.lastShot,null);assert.equal(threatened.u.surfaceLastFire?.spent||0,0);
 near(threatened.u.energy,plain.u.energy,'stored weapon energy');near(threatened.u.pw.wpn,plain.u.pw.wpn,'ordinary idle charging');
 near(threatened.u.ht.actualGeneratedElectricalJ,plain.u.ht.actualGeneratedElectricalJ,'actual generation');near(threatened.u.ht.operatingHeatJ,plain.u.ht.operatingHeatJ,'actual operating heat');
 near(threatened.u.ht.e.weapon||0,plain.u.ht.e.weapon||0,'pending weapon heat');
});
test('OFF point defence can still deliberately attack a small craft through real charge and thermal paths',()=>{
 const f=battle();C.setAutomaticPointDefense(f.u,false);Object.assign(f.e.p,{len:10,width:7,height:6,craft:true});f.e.pos=[1000,0,0];
 assert.equal(R.orderUnit(f.w,f.u.id,{type:'attack',target:f.e.id}),true);const before=f.u.energy;R.tick(f.w,.25);
 assert.equal(f.u.firingAt,f.e.id);assert.ok(f.u.lastShot?.gun>0);assert.equal(f.u.dualDefense,false);
 const charged=(f.u.pw.wpn||0)*.25/C.TT/C.weaponInputFactor(f.u.p);assert.ok(before+charged-f.u.energy>0,'aimed shots spend stored or freshly charged energy');assert.ok(f.u.ht.reactorHeatJ>0,'real reactor generation remains accounted');
});
test('raw restored OFF orders ignore stale diversion in both surface and aggregate aimed-fire queries',()=>{
 for(const surface of [true,false]){
  const p=profile('pd');if(!surface)delete p.surface;const u=C.fleetUnit('restored','restored',p,0),t={pos:[1000,0,0],p:{len:100,width:50,height:20},yaw:0};
  u.order.autoPointDefense=false;u.dualDefense=true;u.dualDivert=copy(p.dualPurpose);u.dualWeights=p.dualPurpose?.tiers?.map(()=>1);assert.ok(C.fleetFire(u,t,1000).gun>0,surface?'surface mount':'aggregate battery');
  near(R.pdToward(u,t.pos,true),0,'active automatic AA');assert.ok(R.pdToward(u,t.pos)>0,'the fitting retains its intrinsic tracking capability');
 }
});
test('the toggle never turns ordinary tracking cannons into automatic point defence',()=>{
 for(const enabled of [false,true]){
  const f=battle('triple40'),m=incoming(f);C.setAutomaticPointDefense(f.u,enabled);R.tick(f.w,.25);near(m.n,8,'ordinary gun interception');assert.equal(f.u.dualDefense,false);assert.ok(f.u.lastShot?.gun>0);
 }
});
