// User decision 2026-11-16「シールドは艦の周囲に展開される形で、小型機はその中に入り込んで攻撃できる」(asked: craft ion guns too —
// "Ion also skips"; a drawn envelope — "Add a drawn envelope"). The shield stands around the ship as a shell
// (half-dimensions × SHIELD_SHELL.k + m). A craft inside it strikes the ship itself with every weapon, ion guns included;
// from outside, its fire meets the shield. A hit on a shielded ship lights the shell around the impact direction.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),core=fs.readFileSync(path.join(root,'js/core.js'),'utf8'),cx=vm.createContext({console}),run=code=>vm.runInContext(code,cx);
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
run(`const C=Core,I=[1,0,0,0,1,0,0,0,1],trial={battle:{E:I,extra:new Map(),me:{id:'me',pos:[0,0,0]},result:null},P:[0,0,0],craft:false},SPACE_RULES={damage:1};
 const tv={add:(a,b,k=1)=>a.map((v,i)=>v+k*b[i]),sub:(a,b)=>a.map((v,i)=>v-b[i]),scale:(a,k)=>a.map(v=>v*k),dot:(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),len:a=>Math.hypot(...a),norm:C.norm};
 const trialApply=(M,v)=>[M[0]*v[0]+M[3]*v[1]+M[6]*v[2],M[1]*v[0]+M[4]*v[1]+M[7]*v[2],M[2]*v[0]+M[5]*v[1]+M[8]*v[2]],trialApplyT=(M,v)=>[M[0]*v[0]+M[1]*v[1]+M[2]*v[2],M[3]*v[0]+M[4]*v[1]+M[5]*v[2],M[6]*v[0]+M[7]*v[1]+M[8]*v[2]];
 const spaceWorld=u=>u.pos,spaceRotU=(E,u)=>I,sndAt=()=>{};`);
const cut=(a,b)=>{const i=app.indexOf(a),j=app.indexOf(b,i);assert.ok(i>=0&&j>i,a);return app.slice(i,j);};
run(cut('function spaceDamage(','function spaceImpact('));
const ship={id:'t',pos:[0,0,0],shield:1,p:{len:1000,height:200,width:400}};// shell half-axes 620, 140, 260 m
run('globalThis.ship='+JSON.stringify(ship));
const hit=(craft,P,kind)=>run(`trial.craft=${craft};trial.P=${JSON.stringify(P)};trial.battle.extra=new Map();spaceDamage(ship,1,'${kind}',null,null);trial.battle.extra.get('t')`);
test('the shell: the hull half-dimensions × k + m metres',()=>{
 const k=run('SHIELD_SHELL');assert.equal(k.k,1.2);assert.equal(k.m,20);
 assert.equal(run('spaceInShell(ship,[600,0,0])'),true);assert.equal(run('spaceInShell(ship,[640,0,0])'),false);assert.equal(run('spaceInShell(ship,[0,150,0])'),false);
});
test('a craft inside the shell strikes the ship: guns on the hull, ion guns on the ship itself',()=>{
 const g=hit(true,[300,0,0],'bolt');assert.equal(g.direct,1);assert.equal(g.sf,0);assert.equal(g.hull,0);
 const i=hit(true,[300,0,0],'ion');assert.equal(i.ionDirect,1);assert.equal(i.sf,0);assert.equal(i.ion,0);
});
test('from outside the shell a craft fire meets the shield; a ship fire always does',()=>{
 const g=hit(true,[3000,0,0],'bolt');assert.equal(g.direct,0);assert.equal(g.sf,1);
 const i=hit(true,[3000,0,0],'ion');assert.equal(i.ionDirect||0,0);assert.equal(i.ion,1);
 const s=hit(false,[300,0,0],'bolt');assert.equal(s.direct,0);assert.equal(s.sf,1);
});
test('a hit on a shielded ship lights the shell around the impact direction, fading over its life',()=>{
 run(`trial.shellFx=[];spaceShellFlash(ship,[1000,0,0]);`);
 const pts=run('trialShellPoints([0,0,0],0)'),alpha=p=>p[1][3];assert.ok(pts.length>20);
 const near=pts.filter(p=>p[0][0]>500),far=pts.filter(p=>p[0][0]<-500);assert.ok(near.length&&Math.max(...near.map(alpha))>150);assert.ok(!far.length||Math.max(...far.map(alpha))<40);
 for(const p of pts){const q=p[0];assert.ok(Math.abs(Math.hypot(q[0]/620,q[1]/140,q[2]/260)-1)<1e-9,'on the shell');}
 run(`trialShellPoints([0,0,0],${run('SHIELD_SHELL.life')})`);assert.equal(run('trial.shellFx.length'),0,'gone after its life');
});
test('fleet and RTS: a craft attack acts on the ship directly, ion guns included',()=>{
 assert.match(core,/C\.combatAdd\(x,t,s\.pos,\{direct:gun,ionDirect:ion,/);
});
