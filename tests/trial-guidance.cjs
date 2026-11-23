// 2026-11-23 Trial guidance for the simulators (user: 「魚雷の誘導は単純追尾、ミサイルの誘導は比例誘導 n_c=N'·v_c·λ̇ … で試験環境に実装して」
// 「とりあえず数式を入れて動かせるようにして、試験は別のAIで空戦を回す形」). Off by default (the game never sets KS_GUIDANCE).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
function runtime(extra={}){const cx=vm.createContext({console:{log(){},warn(){},error:console.error},...extra});for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});return vm.runInContext('Core',cx);}
const prof=C=>{const s=C.buildDesign('craft_tie_ln');return JSON.parse(JSON.stringify(C.fleetProfile(C.computeStats(s),s.name,s)));};
// One round fired along +x at a target 3 km ahead and 1 km to the side, crossing at 200 m/s; returns the round after one step.
function step(C,kind){const P=prof(C),a=C.fleetUnit('a',P.key||'craft_tie_ln',P,0),t=C.fleetUnit('t',P.key||'craft_tie_ln',P,1);a.pos=[0,0,0];t.pos=[3000,0,1000];t.velocity=[0,0,-200];a.velocity=[0,0,0];t.velocity=[0,0,-200];
 const b=C.fleetBattle([a,t],true);const m={id:'m1',salvo:'s',team:0,from:'a',target:'t',n:1,tt:.05,kind,ion:false,range:20000,traveled:0,pos:[0,0,0],vel:[2600,0,0],s:2600,life:30,launchClearance:0,launchDir:[1,0,0]};
 b.missiles=[m];C.fleetTick(b,.05);return b.missiles.find(q=>q.id==='m1')||m;}
test('without the switch neither guidance runs (the game is unchanged)',()=>{const C=runtime();const m=step(C,'cmsl');assert.equal(m.guide,undefined);});
test('a torpedo flies pure pursuit and a missile proportional navigation with KS_GUIDANCE=pn',()=>{
 const C=runtime({KS_GUIDANCE:'pn'});const t=step(C,'itorp');assert.equal(t.guide,'pursuit');
 const m=step(C,'cmsl');assert.equal(m.guide,'pn');assert.ok(m.pnMaxG>0,'a commanded lateral acceleration');
 // n_c = N'·Vc·λ̇ at the first step: r = (3000,0,1000), v_r = (−2600,0,−200)
 const r=[3000,0,1000],vr=[-2600,0,-200],rl=Math.hypot(...r),w=Math.hypot(r[1]*vr[2]-r[2]*vr[1],r[2]*vr[0]-r[0]*vr[2],r[0]*vr[1]-r[1]*vr[0])/(rl*rl),vc=-(r[0]*vr[0]+r[2]*vr[2])/rl;
 const L=m.pnLast;assert.equal(L.N,3);assert.ok(Math.abs(L.accel-L.N*L.vc*L.losRate)<1e-9*L.accel,'n_c = N\'·Vc·λ̇');
 assert.ok(Math.abs(L.vc/vc-1)<.05&&Math.abs(L.losRate/w-1)<.05,`inputs Vc ${L.vc} (≈${vc}), λ̇ ${L.losRate} (≈${w}); the target turns in the same step`);
 const N5=step(runtime({KS_GUIDANCE:'pn',KS_PN_N:5}),'cmsl');assert.ok(Math.abs(N5.pnMaxG/m.pnMaxG-5/3)<1e-6,'N\' scales the command');
});

test('KS_TURN_MASS: a craft turns as its manoeuvring thrusters swing its mass (off by default)',()=>{
 const rate=(C,k)=>{const s=C.buildDesign(k);return C.fleetProfile(C.computeStats(s),s.name,s).turnRate;};
 const off=runtime();assert.equal(rate(off,'craft_tie_ln'),.24,'the present common cap');
 const on=runtime({KS_TURN_MASS:true}),ln=rate(on,'craft_tie_ln'),x=rate(on,'craft_xwing'),y=rate(on,'craft_btlb');
 assert.ok(ln>x&&x>y,`the light TIE turns faster than the X-wing, the Y-wing slower: ${ln} ${x} ${y}`);
 const s=on.buildDesign('craft_xwing'),S=on.computeStats(s),p=on.fleetProfile(S,s.name,s),r=S.craftSystems.maneuverSupport/S.mass;assert.ok(Math.abs(p.turnRate-.24*Math.sqrt(r)*Math.sqrt(12/p.len))<1e-12);
});

test('KS_TURN_VECTOR: a light craft reverses faster when its thrust is pointed off its way (off by default)',()=>{
 const reverse=flags=>{const C=runtime(flags),s=C.buildDesign('craft_tie_ln'),p=JSON.parse(JSON.stringify(C.fleetProfile(C.computeStats(s),s.name,s))),u=C.fleetUnit('a','craft_tie_ln',p,0);u.pos=[0,0,0];u.yaw=0;u.velocity=[400,0,0];const B=C.fleetBattle([u],true);u.order={type:'move',point:[-20000,0,1],dash:true};
  let aoa=false;for(let t=0;t<30;t+=.25){C.fleetTick(B,.25);const x=B.units[0];if(x.aoa!=null)aoa=true;if(x.velocity[0]<0)return {t,aoa};}return {t:Infinity,aoa};};
 const mass=reverse({KS_TURN_MASS:true}),vec=reverse({KS_TURN_MASS:true,KS_TURN_VECTOR:true});
 assert.equal(mass.aoa,false,'the plain model has no angle of attack');assert.equal(vec.aoa,true);assert.ok(vec.t<mass.t,`reversed in ${vec.t} s against ${mass.t} s`);
});
