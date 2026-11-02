const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const C=vm.runInContext('Core',context),TT=C.TT;
function box(center,size=[200,40,40]){return C.structTriangles({id:1,k:'struct',form:'box',c:center,s:[size[0],size[2],size[1]],taper:0});}
function world(u,p){const c=Math.cos(u.yaw),s=Math.sin(u.yaw);return [u.pos[0]+p[0]*c-p[2]*s,u.pos[1]+p[1],u.pos[2]+p[0]*s+p[2]*c];}
function expected(u,from,to){const d=C.norm(C.sub(to,from)),hit=C.rayTris(u.p.surface.shell,from,d);return hit?.p||null;}
function compare(u,from,to){const a=expected(u,from,to),b=C.surfaceRayHit(u,world(u,from),world(u,to));assert.equal(!!b,!!a);if(a)assert.ok(C.len(C.sub(a,b))<1e-7,`nearest surface differs: ${JSON.stringify(a)} / ${JSON.stringify(b)}`);}
function armed(){
 const modules=[{k:'weapon',fit:1,size:1,share:.5,at:.8,domain:'main',powerConnected:true},{k:'weapon',fit:2,size:1,share:.5,at:.2,domain:'main',powerConnected:true},{k:'reactor',part:3,size:100,share:1,at:.5,domain:'main'}],mount=(id,module,point)=>({id,module,patch:null,cell:null,capacity:10,boltTT:1,center:point,muzzle:point,normal:[1,0,0],arcs:[1,1,1,1,1,1],gun:1,ion:0,power:TT,barrels:1,crewNeed:10,band:'mid',fixed:false});
 const p={name:'Exact query',hp:1000,len:200,width:40,height:40,armorHull:0,D:0,shieldBuffer:1,reserve:1,wCap:20,crewNeed:20,maxSpeed:100,accel:10,turnRate:.1,gunArcs:[2,2,2,2,2,2],ionArcs:[0,0,0,0,0,0],modules,energyModel:{version:1,eta:.75},grid:{P:100*TT,fixed:TT,De:TT,Ds:TT,Dw:2*TT,domains:[{id:'main',P:100*TT,modules:[0,1,2]}]},surface:{version:1,mode:'strict',shell:box([0,0,0]),patches:[],devices:[],mounts:[mount(1,0,[110,10,0]),mount(2,1,[-110,10,0])]}};
 const u=C.fleetUnit('query','query',p),target={id:'target',team:1,p:{len:40,width:20,height:20},pos:[1000,0,0],yaw:0};u.pos=[0,0,0];u.yaw=0;return {u,target,fire:()=>C.fleetFire(u,target,C.len(C.sub(target.pos,u.pos))).gun};
}

test('compiled surface rays give the same nearest hits as exact triangle scans across disconnected solids and poses',()=>{
 const shell=[];for(let i=0;i<32;i++)shell.push(...box([i*80-1240,(i%3-1)*25,(i%5-2)*20],[30,24,20]));
 const u={p:{surface:{shell}},pos:[5000,-20,7000],yaw:.71};let state=91;const random=()=>((state=Math.imul(state,1664525)+1013904223>>>0)/2**32);
 for(let i=0;i<300;i++){const from=[(random()-.5)*3400,(random()-.5)*400,(random()-.5)*500],to=[(random()-.5)*2600,(random()-.5)*80,(random()-.5)*100];compare(u,from,to);}
 for(const [from,to]of [[[1400,0,0],[-1400,0,0]],[[0,400,0],[0,-400,0]],[[0,0,400],[0,0,-400]],[[500,300,10],[500,-300,10]]])compare(u,from,to);
 u.pos=[-9000,100,1200];u.yaw=-1.13;for(let i=0;i<40;i++)compare(u,[1700,(i-20)*3,30],[-1200,0,0]);
});

test('surface query bounds remain conservative at large coordinates and retain sub-metre triangle precision',()=>{
 const base=1e6+.001234,shell=Array.from(box([0,0,0],[20,12,8]),(v,i)=>v+(i%3===0?base:0)),u={p:{surface:{shell}},pos:[0,0,0],yaw:0};
 for(const y of [-5.999,0,5.999])for(const z of [-3.999,0,3.999])compare(u,[base+100,y,z],[base-100,y,z]);
 const hit=C.surfaceRayHit(u,[base+100,0,0],[base,0,0]);assert.ok(Math.abs(hit[0]-(base+10))<1e-8);
});

test('shared target-coordinate calculation retains the established directional arc weights',()=>{
 const {u,target,fire}=armed();u.p.surface.shell=[];const [a,b]=u.p.surface.mounts;a.arcs=[1,.1,.3,.8,.4,.2];b.arcs=[.2,.9,.7,.1,.3,.6];a.gun=1.7;b.gun=.9;
 for(let i=0;i<150;i++){u.yaw=(i%19-9)*.17;target.pos=[Math.cos(i*.31)*3000,Math.sin(i*.23)*700,Math.sin(i*.31)*3000];const reference=C.fleetArc(u,target,a.arcs)*a.gun+C.fleetArc(u,target,b.arcs)*b.gun;assert.ok(Math.abs(fire()-reference)<1e-12);}
});

test('changing a surface profile or its triangle array invalidates compiled geometry without caching a prior hit',()=>{
 const first=box([0,0,0]),second=box([400,0,0]),u={p:{surface:{shell:first}},pos:[0,0,0],yaw:0};compare(u,[1000,0,0],[0,0,0]);assert.ok(Math.abs(C.surfaceRayHit(u,[1000,0,0],[0,0,0])[0]-100)<1e-8);
 u.p.surface.shell=second;compare(u,[1000,0,0],[0,0,0]);assert.ok(Math.abs(C.surfaceRayHit(u,[1000,0,0],[0,0,0])[0]-500)<1e-8);
 u.p.surface={shell:first};compare(u,[1000,0,0],[0,0,0]);assert.ok(Math.abs(C.surfaceRayHit(u,[1000,0,0],[0,0,0])[0]-100)<1e-8);
 const exposed=C.surfaceRayHit(u,[1000,0,0],[0,0,0]);exposed[0]=-999;assert.ok(Math.abs(C.surfaceRayHit(u,[1000,0,0],[0,0,0])[0]-100)<1e-8,'a caller cannot mutate a stored ray result');
});

test('self-occlusion uses actual geometry and rechecks target direction and replacement geometry',()=>{
 const {u,target,fire}=armed();assert.equal(fire(),1,'only the mount outside the forward face may shoot through this bearing');
 target.pos=[-1000,0,0];assert.equal(fire(),1,'moving the target reverses which mount is screened by the hull');target.pos=[1000,0,0];
 u.p.surface.shell=box([400,0,0]);assert.equal(fire(),0,'a new solid ahead of both muzzles must block the same shot');u.p.surface.shell=box([0,0,0]);assert.equal(fire(),1);
});

test('repeated fire queries immediately reflect physical damage, local ion protection, crew and heat changes',()=>{
 const {u,fire}=armed(),ctx={time:0,rand:()=>.9,ev(){},out(){},sunk(){}};assert.equal(fire(),1);
 u.mods[0]=0;assert.equal(fire(),0);u.mods[0]=1;assert.equal(fire(),1);
 const trip=C.ionOverload(u,2,{moduleIndex:0},ctx);assert.equal(trip.scope,'local');assert.equal(fire(),0);C.powerTick(u,30,ctx);assert.equal(fire(),1);
 u.crew=0;assert.equal(fire(),0);u.crew=20;assert.equal(fire(),1);
 const H=C.heatProfile(u.p),i=H.src.findIndex(s=>s.k==='weapon'&&s.m?.includes(0));assert.ok(i>=0);u.ht.md[i]=3;assert.equal(fire(),0);u.ht.md[i]=0;u.ht.lm[i]=1;assert.equal(fire(),1);
});

test('repeated queries never retain power after disconnection, loss of its actual reactor or a zero-rated domain',()=>{
 const {u,fire}=armed();assert.equal(fire(),1);u.p.modules[0].powerConnected=false;assert.equal(fire(),0);u.p.modules[0].powerConnected=true;assert.equal(fire(),1);
 u.mods[2]=0;assert.equal(fire(),0);u.mods[2]=1;assert.equal(fire(),1);u.p.grid.domains[0].P=0;assert.equal(fire(),0);u.p.grid.domains[0].P=100*TT;assert.equal(fire(),1);
});
