// 2026-11-23 (user: 「1、2を入れて」; dogfight tests on test/dogfight-ranges-20261123-b): what stands on a craft's panel goes with it,
// a craft's lost manoeuvring units cost it turn, and a craft without a standing field loses the section a shot strikes.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),plain=x=>JSON.parse(JSON.stringify(x));
const prof=k=>{const s=C.buildDesign(k),S=C.computeStats(s);return plain(C.fleetProfile(S,s.name,s));};
test('systems and fittings within a panel part are that panel\'s',()=>{
 const p=prof('craft_tie_in'),m=p.modules,panels=m.filter(x=>x.panel).map(x=>x.part);assert.deepEqual(panels,[100,120]);
 /* 2026-11-27 expectation changed (the user's refit of the craft, KUAT_18_Aircraft_Refit.zip, now the examples' sources: tests/craft-remodel-source.cjs): the user's fixed TIE/in has no torpedo tube; its two pylons stand on the wing panels (was 4 on the panels, 3 with the pod) */assert.equal(m.filter(x=>x.k==='weapon'&&x.panelOwner!=null).length,6,'the four wing guns and the two pylons');assert.equal(m.filter(x=>x.k==='weapon'&&x.panelOwner==null).length,2,'the two chin guns stay with the pod');
 assert.equal(m.filter(x=>x.turnSupport&&x.panelOwner!=null).length,4,'the four wing thrusters');
 const x=prof('craft_xwing');assert.equal(x.modules.some(q=>q.panelOwner!=null),false,'a craft without panels has none');
});
test('a craft turns with the square root of its manoeuvring support still working',()=>{
 const p=prof('craft_tie_in'),u=C.fleetUnit('u','craft_tie_in',p,0);assert.equal(C.craftTurnSupport(u),1);
 const all=p.modules.reduce((n,m)=>n+(m.turnSupport||0),0),wing=p.modules.reduce((n,m)=>n+(m.panelOwner===100&&m.turnSupport?m.turnSupport:0),0);
 p.modules.forEach((m,i)=>{if(m.panelOwner===100)u.mods[i]=0;});assert.ok(Math.abs(C.craftTurnSupport(u)-Math.sqrt(1-wing/all))<1e-12);
});
