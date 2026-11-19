// 2026-11-19 Ships' fire that misses its target is shared with their own units near that target (fireStray). A craft took a
// quarter of a ship's share whatever its size (a floor meant for ships): 5.5% of a capital ship's missed fire, which no craft
// survives. In a fleet action 14 of the 16 craft lost were lost that way. A craft now has the share of its own outline (its
// half-size against the target's, squared) and is struck by a whole shot or by none.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),F=vm.runInContext('YardFleetData',cx),plain=x=>JSON.parse(JSON.stringify(x));
const xs=C.buildDesign('craft_tie_ln'),tieP=C.fleetProfile(C.computeStats(xs),xs.name,xs);
function scene(){
 const isd=C.fleetUnit('isd','imperial',plain(F.designs.imperial.p),1),foe=C.fleetUnit('foe','mc80liberty',plain(F.designs.mc80liberty.p),0),mate=C.fleetUnit('mate','arquitens',plain(F.designs.arquitens.p),1),tie=C.fleetUnit('tie','craft_tie_ln',plain(tieP),1);
 isd.pos=[12000,0,0];isd.yaw=Math.PI;foe.pos=[0,0,0];mate.pos=[0,0,700];tie.pos=[0,400,-500];return {isd,foe,mate,tie};
}
test('a craft near the target has the share of its outline, a ship the share it had',()=>{
 const {isd,foe,mate,tie}=scene(),out=C.fireStray([isd,foe,mate,tie],isd,foe,12000),m=out.find(e=>e.x===mate),c=out.find(e=>e.x===tie);
 assert.ok(m&&m.k>.004&&!m.craft,'the friendly ship beside the target keeps its share: '+m?.k);assert.ok(c&&c.craft,'the craft is listed as a craft');
 const half=Math.max(...C.hullHalf(tie.p).filter((v,i)=>i!==1)),want=(half/(foe.p.len*.5))**2;assert.ok(c.k>0&&c.k<=.22*want*1.0001,`its share is its outline's: ${c.k} (at most ${(.22*want).toExponential(2)})`);assert.ok(c.k<m.k/100,'far less than the ship beside it');
});
test('a craft that keeps close to a ship its own side is firing on is not lost to that fire as a matter of course',()=>{
 let lost=0;for(const seed of [3,7,11,19]){const {isd,foe,mate,tie}=scene();for(const x of foe.sec){x.max*=1e6;x.s=x.max;}
  isd.order={...isd.order,type:'attack',target:'foe',fire:true,autoPointDefense:false};foe.order={...foe.order,type:'hold',fire:false,autoPointDefense:false};tie.order={...tie.order,type:'hold',fire:false};
  const B=C.fleetBattle([foe,isd,tie],true);B.seed=seed;for(let t=0;t<30;t+=.25){C.fleetTick(B,.25,{});tie.pos=[0,400,-500];tie.velocity=[0,0,0];}
  if(tie.dead)lost++;}
 assert.ok(lost<=1,'thirty seconds beside the target in four battles: lost in '+lost+' (it was lost in all of them within seconds)');
});
