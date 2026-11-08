const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const {C,R}=vm.runInContext('({C:Core,R:Rts})',cx),copy=value=>JSON.parse(JSON.stringify(value)),profiles=new Map();
function installedProfile(k){
 if(!profiles.has(k)){
  const ship=C.newShip({L:500,W:300,H:160,plan:'rect',sec:'rect'},'Point-defence roles');
  ship.parts=[{id:1,k:'gen',d:100,c:[250,80,0]},{id:3,k:'fuel',d:40,c:[100,80,0]}];
  ship.fits=[{id:2,k,p:[250,160,0],a:2,ped:0,base:0,low:0,float:false}];ship.nextId=4;
  const S=C.computeStats(ship);profiles.set(k,{S,p:C.fleetProfile(S,ship.name,ship)});
 }
 return copy(profiles.get(k));
}
function battle(k){
 const {p}=installedProfile(k),w=R.createWorld({region:'kuat',seed:13,sensors:false,designs:[{key:'own',name:'Own',p,info:{capital:false,sensor:1}},{key:'enemy',name:'Enemy',p:copy(p),info:{capital:false,sensor:1}}],sides:[{faction:'rebel',ai:false},{faction:'empire',ai:false}],fleets:[[{design:'own',air:[],ground:[],troops:0}],[{design:'enemy',air:[],ground:[],troops:0}]]});
 const [u,e]=[...w.units.values()],sys=u.sys;
 for(const g of w.groups.values()){g.sys=sys;g.inbound=null;g.order={type:'hold'};}
 for(const x of [u,e])Object.assign(x,{sys,pos:x===u?[0,0,0]:[5000,0,0],yaw:x===u?0:Math.PI,velocity:[0,0,0],warp:null,jump:null,order:{type:'hold',fire:true,power:'balanced',aim:'auto',volley:'stream'}});
 e.manual=true;
 return {w,u,e,sys};
}
function incoming(f){const missile={id:'incoming',sys:f.sys,side:1,from:f.e.id,target:f.u.id,n:8,pos:[4500,0,0],vel:[-220,0,0],s:220,life:45};f.w.missiles.push(missile);return missile;}

test('only the actual twin and spherical point-defence definitions automatically intercept',()=>{
 for(const k of ['pd','monCalPD'])assert.equal(C.weaponRoles(C.FITS[k]).pointDefense,true,k);
 for(const k of ['single40','triple40','refVen','single500MT','single6MT','cturret']){
  assert.ok(C.FITS[k].aa>0,k+' retains its original tracking rating');
  assert.equal(C.weaponRoles(C.FITS[k]).pointDefense,false,k);
  assert.equal(C.weaponRoles(C.FITS[k]).dualPurpose,false,k+' is not reserved for automatic defence');
 }
 assert.equal(C.weaponRoles({tt:1e-12,aa:90,dualPurpose:true}).pointDefense,false,'low yield and fast tracking do not infer a point-defence role');
});

test('installed normal guns retain their output and tracking but contribute no automatic interception profile',()=>{
 for(const k of ['triple40','single500MT','single6MT']){
  const {S,p}=installedProfile(k);assert.equal(S.aa,0,k);assert.ok(S.aaArc.every(v=>v===0),k);assert.equal(p.aa,0,k);assert.equal(p.dualPurpose,undefined,k);
  assert.ok(p.gunArcs.some(v=>v>0),k+' remains a firing weapon');assert.ok(p.modules.some(m=>m.fit===2&&m.k==='weapon'&&!m.pd&&!m.dualPurpose),k);
  assert.equal(p.profileVersion,C.FLEET_PROFILE_VERSION);assert.ok(p.profileVersion>22,'old all-gun interception profiles require a refresh');
 }
});

test('the real RTS missile step leaves missiles alone when only ordinary guns are installed',()=>{
 for(const k of ['triple40','single500MT','single6MT']){
  const f=battle(k),m=incoming(f);R.tick(f.w,.25);
  assert.equal(m.n,8,k+' does not silently use ordinary barrels for defence');assert.equal(f.u.dualDefense,false,k);
  assert.ok(f.u.lastShot?.gun>0,k+' continues shooting its ordinary ship target');
 }
});

test('dedicated point defence still intercepts in the same real RTS missile step',()=>{
 for(const k of ['pd','monCalPD']){
  const {S,p}=installedProfile(k);assert.ok(S.aa>0&&p.dualPurpose?.aa>0);assert.ok(p.modules.some(m=>m.fit===2&&m.pd));
  const f=battle(k),m=incoming(f);R.tick(f.w,.25);assert.equal(f.u.dualDefense,true,k);assert.ok(m.n<8&&m.n>0,k+' retains its normal interception effect');
 }
});

test('normal guns can explicitly target a small craft unit through the ordinary attack order and electrical/thermal path',()=>{
 const f=battle('triple40');Object.assign(f.e.p,{len:10,width:7,height:6,craft:true});f.e.pos=[1000,0,0];
 const initial=f.u.energy;assert.equal(R.orderUnit(f.w,f.u.id,{type:'attack',target:f.e.id}),true);R.tick(f.w,.25);
 assert.equal(f.u.firingAt,f.e.id);assert.ok(f.u.lastShot?.gun>0,'normal aimed fire reaches the small target using the existing hit model');assert.equal(f.u.dualDefense,false);
 assert.ok((f.u.pw?.wpn||0)>0,'the existing power network funds weapon charging');assert.ok(f.u.fuelState.generatedElectricalJ>0,'actual generation consumes installed reactants');
 const drawn=(f.u.pw.wpn||0)*.25/C.TT/C.weaponInputFactor(f.u.p);assert.ok(initial+drawn-f.u.energy>0,'firing spends stored or newly charged weapon energy');
 const h=f.u.ht,weaponHeat=(h.e.weapon||0)+(f.u.p.heat?.src||[]).reduce((sum,source,i)=>sum+(source.k==='weapon'?h.sourceGenerationW?.[i]||0:0),0);
 assert.ok(weaponHeat>0&&h.reactorHeatJ>0,'weapon charging and actual generation follow the existing common thermal path even when exterior cooling sheds the heat');
});

test('explicit ordinary fire still respects range, firing arcs and loss of electrical power',()=>{
 for(const condition of ['range','arc','power']){
  const f=battle('triple40');Object.assign(f.e.p,{len:10,width:7,height:6,craft:true});f.e.pos=[condition==='range'?70000:1000,0,0];
  if(condition==='arc'){f.u.p.gunArcs=Array(6).fill(0);for(const k of Object.keys(f.u.p.gunBands))f.u.p.gunBands[k]=Array(6).fill(0);}
  if(condition==='power'){f.u.energy=0;f.u.p.grid.P=0;for(const d of f.u.p.grid.domains||[]){d.P=0;for(const s of d.sources||[])s.P=0;}for(let i=0;i<f.u.p.modules.length;i++)if(f.u.p.modules[i].k==='reactor')f.u.mods[i]=0;}
  assert.equal(R.orderUnit(f.w,f.u.id,{type:'attack',target:f.e.id}),true);R.tick(f.w,.25);assert.equal(f.u.lastShot,null,condition);
 }
});

test('point-defence interception retains its electrical loss and firing-arc constraints',()=>{
 for(const condition of ['power','arc']){
  const f=battle('pd'),m=incoming(f);
  if(condition==='power'){f.u.energy=0;f.u.p.grid.P=0;for(const d of f.u.p.grid.domains||[]){d.P=0;for(const s of d.sources||[])s.P=0;}for(let i=0;i<f.u.p.modules.length;i++)if(f.u.p.modules[i].k==='reactor')f.u.mods[i]=0;}
  else{f.u.p.aaArcs=Array(6).fill(0);f.u.p.aa=0;f.u.p.dualPurpose.aaArcs=Array(6).fill(0);f.u.p.dualPurpose.aa=0;}
  R.tick(f.w,.25);assert.equal(m.n,8,condition);
 }
});

test('old profiles cannot reuse mixed ordinary-gun AA totals or cached point-defence flags without rebuilding',()=>{
 const {p}=installedProfile('triple40');p.profileVersion=22;p.aa=200;p.aaArcs=Array(6).fill(200);p.dualPurpose={aa:200,aaArcs:Array(6).fill(200),gunArcs:p.gunArcs,gunBands:p.gunBands};
 p.modules=p.modules.map(m=>m.k==='weapon'?{...m,pd:true,dualPurpose:true}:m);
 p.surface={patches:[],mounts:[{id:2,gun:120,ion:0,dualPurpose:true,pd:true}],devices:[]};
 const original=copy(p),u=C.fleetUnit('legacy','legacy',p,0);u.pos=[0,0,0];u.yaw=0;u.side=0;
 assert.equal(u.p.profileVersion,22,'the old snapshot remains identifiable as requiring a rebuild');assert.equal(u.p.aa,0);assert.ok(u.p.aaArcs.every(v=>v===0));assert.equal(u.p.dualPurpose,undefined);
 assert.ok(u.p.modules.filter(m=>m.k==='weapon').every(m=>!m.pd&&!m.dualPurpose));assert.ok(u.p.surface.mounts.every(m=>!m.pd&&!m.dualPurpose));
 assert.equal(C.fleetDefense(u,[{side:1,n:8,pos:[1000,0,0]}]),false);assert.equal(R.pdToward(u,[1000,0,0],true),0);
 assert.deepEqual(copy(u.p.gunArcs),original.gunArcs);assert.deepEqual(copy(u.p.grid),original.grid);assert.deepEqual(copy(p),original,'runtime validation does not rewrite the saved source');
});
