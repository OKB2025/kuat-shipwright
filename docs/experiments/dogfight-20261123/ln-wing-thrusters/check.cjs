const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(process.env.KS_TEST_ROOT,f),'utf8').replace('function fragileTieHull(u){','globalThis.probe={shipPowerSources,livePanelTurn,swRatedRejectionW};function fragileTieHull(u){'),cx);
const C=vm.runInContext('Core',cx);

for(const key of ['craft_tie_in','craft_tie_ln']){
 const x=C.buildDesign(key),p=C.fleetProfile(C.computeStats(x),x.name,x);
 if(key==='craft_tie_ln'){
  const parts=x.parts.filter(q=>q.k==='maneuver');
  assert.equal(parts.length,4);
  for(const [panel,ids] of [[100,[272,274]],[120,[273,275]]]){
   const wing=x.groups.find(g=>g.parts.includes(panel));
   for(const id of ids){const q=parts.find(v=>v.id===id);assert.ok(wing.parts.includes(id));assert.equal(x.groups.filter(g=>g.parts.includes(id)).length,1);assert.ok(Math.abs(q.c[2])>3);assert.equal(q.d,0.23);console.log(id,q.label,q.c);}
  }
 }
 const mods=p.modules,panels=mods.map((m,i)=>m.panel?i:-1).filter(i=>i>=0);
 assert.equal(panels.length,2);
 const all=mods.reduce((sum,m)=>sum+(m.k==='hull'?0:m.w),0);
 for(const [side,pi] of panels.entries()){
  const u=C.fleetUnit('unit',key,p,0),o=Object.assign(C.combatIncoming(),{direct:1e-15,shotN:1,shotE:1e-15});
  const rated=cx.probe.swRatedRejectionW(u);const pick=(panels.slice(0,side).reduce((w,i)=>w+mods[i].w,0)+mods[pi].w/2)/all;
  C.combatResolve({rand:()=>pick,time:0,ev(){},sunk(){},out(){}},u,o,0,C.fleetSystems(u));
  assert.equal(u.dead,false);assert.equal(u.mods[pi],0);assert.equal(u.mods[panels[1-side]],1);
  const grid=p.grid.domains.flatMap(d=>d.sources).find(q=>q.moduleIndex===pi);
  const sink=p.heat.dis.find(q=>q.m===pi);assert.ok(grid.P>0&&sink.cap>0);
  const src=cx.probe.shipPowerSources(u).find(q=>q.moduleIndex===pi);assert.equal(src.powerW,0);
  assert.ok(Math.abs(rated-cx.probe.swRatedRejectionW(u)-sink.cap)<sink.cap*1e-8); const guns=mods.filter((m,i)=>x.fits.some(f=>f.id===m.fit&&f.k==='claser')&&u.mods[i]>0);
  const out=mods.filter((m,i)=>m.panelOwner===mods[pi].part&&u.mods[i]===0);
  console.log("live weapon modules", guns.map(m=>[m.fit,m.name]),"detached",out.map(m=>[m.fit,m.part,m.turnSupport]));
  assert.equal(guns.length,key==='craft_tie_in'?4:2);assert.equal(out.filter(m=>m.turnSupport).length,2);
  const total=mods.reduce((n,m)=>n+(m.turnSupport||0),0),lost=out.reduce((n,m)=>n+(m.turnSupport||0),0);
  assert.equal(cx.probe.livePanelTurn(u),total?Math.sqrt(1-lost/total):1);console.log(key,mods[pi].part,'guns',guns.length,'thrusters lost',out.filter(m=>m.turnSupport).length,'turn factor',total?Math.sqrt(1-lost/total):1,'solar W',src.powerW,'removed cooling W',sink.cap);
 }
}
