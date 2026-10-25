const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const run=code=>vm.runInContext(code,context);
run(`
function scenario(){
 const designs=['mc80home','imperial'].map(k=>JSON.parse(JSON.stringify(YardFleetData.designs[k])));
 const w=Rts.createWorld({mode:'test',region:'kuat',seed:13,designs,sides:[{faction:'rebel',ai:false},{faction:'empire',ai:false}],fleets:[[{design:'mc80home',air:[{craft:'xwing',n:12}]}],[{design:'imperial'}]]});
 const home=[...w.units.values()].find(u=>u.side===0),enemy=[...w.units.values()].find(u=>u.side===1),wing=[...w.wings.values()][0],edge=w.sector.edges[w.sector.systems[home.sys].links[0]],to=edge.a===home.sys?edge.b:edge.a;
 enemy.sys=to;enemy.pos=[0,0,0];w.groups.get(enemy.group).sys=to;
 for(const u of [home,enemy]){Rts.orderUnit(w,u.id,{type:'hold'});u.velocity=[0,0,0];u.warp=null;}
 return {w,home,enemy,wing,to};
}
function firstMissile(){const a=scenario();Rts.orderRaid(a.w,a.wing.id,a.to);for(let i=0;i<1800;i++){Rts.tick(a.w,.25);const m=a.w.missiles.find(m=>m.side===0&&m.craft);if(m)return {...a,m};}throw new Error('Raid did not fire a missile');}
const craftShip=Core.buildDesign('craft_xwing');Core.syncCompartments(craftShip);Core.remount(craftShip);Core.syncCompartments(craftShip);
const craftStats=Core.computeStats(craftShip),craftSnapshot=Core.craftCombat(craftShip,craftStats);
function normalizeCraft(c){return Core.normalizeAirWings([{id:'test',name:'My wing',type:null,count:12,dims:craftSnapshot.dims,design:{ref:'custom-xwing',name:craftShip.name,craft:c}}])[0].design.craft;}
`);
test('custom craft retains hyperdrive through JSON load and raid registration',()=>{
 const r=run(`(()=>{const c=normalizeCraft(JSON.parse(JSON.stringify(craftSnapshot))),carrier=YardFleetData.designs.mc80home,rows=Core.normalizeAirWings([{id:'test',name:'My wing',type:null,count:12,dims:craftSnapshot.dims,design:{ref:'custom-xwing',name:craftShip.name,craft:c}}]),air=Rts.defaultAir(carrier.info,'rebel',rows),w=Rts.createWorld({mode:'test',region:'kuat',seed:13,designs:[carrier],sides:[{faction:'rebel',ai:false},{faction:'empire',ai:false}],fleets:[[{design:carrier.key,air}],[]]}),home=[...w.units.values()][0],wing=[...w.wings.values()][0],edge=w.sector.edges[w.sector.systems[home.sys].links[0]],to=edge.a===home.sys?edge.b:edge.a;return {expected:craftStats.hyperClass,clean:c.hyper,registered:Rts.CRAFT[air[0].craft].hyper,ok:Rts.raidCheck(w,wing.id,to).ok};})()`);
 assert.equal(r.clean,r.expected);assert.equal(r.registered,r.expected);assert.equal(r.ok,true);
});
test('missing and invalid hyperdrives stay unable to jump',()=>{for(const value of ['undefined','null','0','-1','NaN','Infinity','"1"'])assert.equal(run(`normalizeCraft({...craftSnapshot,hyper:${value}}).hyper`),null);assert.equal(run('Core.craftCombat(craftShip,{...craftStats,jumpOK:false}).hyper'),null);});
test('recalling a raid keeps combat active and resolves fired missiles',()=>{
 const r=run(`(()=>{const a=firstMissile(),id=a.m.id;Rts.orderWing(a.w,a.wing.id,{type:'standby'});Rts.tick(a.w,.25);const active=a.w.battles.has(a.to);for(let i=1;i<160;i++)Rts.tick(a.w,.25);return {active,left:a.w.missiles.some(m=>m.id===id)};})()`);assert.equal(r.active,true);assert.equal(r.left,false);
});
test('a missile progresses after the last raiding squadron leaves',()=>{const r=run(`(()=>{const a=firstMissile(),life=a.m.life,id=a.m.id;for(const s of a.w.squads.values())if(s.side===0&&s.sys===a.to){s.sys=null;s.state='raidBack';}Rts.tick(a.w,.25);const m=a.w.missiles.find(m=>m.id===id);return !m||m.life<life;})()`);assert.equal(r,true);});
test('missiles whose targets leave the system are discarded',()=>{assert.equal(run(`(()=>{const a=firstMissile(),id=a.m.id;a.enemy.sys=null;Rts.tick(a.w,.25);return a.w.missiles.some(m=>m.id===id);})()`),false);});
