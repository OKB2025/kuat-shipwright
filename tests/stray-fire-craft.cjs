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
// User decision 2026-11-19「そもそも艦隊戦で砲撃が交わされてる部分は避けるように飛行すればいい」: craft keep out of the lanes ships fire along.
test('a strike whose way crosses the line of fire between two other ships goes round it',()=>{
 const profiles={};for(const k of ['craft_xwing','craft_btlb']){const d=C.buildDesign(k),S=C.computeStats(d);profiles[k]={p:C.fleetProfile(S,d.name,d),liftSpare:Math.max(0,(S.craftSystems?.landingSupport||0)-S.mass)};}
 // a fires on z1 along the x axis; the carrier is south of that line and the ship its strike goes for (z2) north of it.
 const a=C.fleetUnit('a','mc80liberty',plain(F.designs.mc80liberty.p),0),z1=C.fleetUnit('z1','imperial',plain(F.designs.imperial.p),1),car=C.fleetUnit('car','mc75',plain(F.designs.mc75.p),0),z2=C.fleetUnit('z2','imperial',plain(F.designs.imperial.p),1);
 a.pos=[-15000,0,0];z1.pos=[15000,0,0];/* 30 km apart: inside their guns' reach */z1.yaw=Math.PI;car.pos=[0,0,-20000];car.yaw=Math.PI/2;z2.pos=[0,0,3000];z2.yaw=-Math.PI/2;/* the carrier stands 20 km off the line: its craft have room to climb over it */
 for(const u of [a,z1,car,z2])for(const x of u.sec){x.max*=1e6;x.s=x.max;}
 a.order={...a.order,type:'hold',target:'z1',fire:true,autoPointDefense:false};z1.order={...z1.order,type:'hold',target:'a',fire:true,autoPointDefense:false};
 for(const u of [car,z2])u.order={...u.order,type:'hold',fire:false,autoPointDefense:false};
 const B=C.fleetBattle([a,car,z1,z2],true);B.seed=4;C.fleetAirSetup(B,[{home:'car',group:[{type:'ywing',count:6},{type:'xwing',count:3}]}],profiles,{arrive:[true,false]});
 // The lanes are read from the battle itself: every ship and the ship it fired at in the step, away from the lane's two ends.
 let near=Infinity,avoided=0,fired=0,crossed=0;const side=new Map(),ships=[a,car,z1,z2];
 for(let t=0;t<120;t+=.25){C.fleetTick(B,.25,{});const lanes=ships.filter(u=>u.firingAt&&ships.some(s=>s.id===u.firingAt)).map(u=>{const z=ships.find(s=>s.id===u.firingAt),L=C.len(C.sub(z.pos,u.pos));return {a:u.pos,d:C.mul(C.sub(z.pos,u.pos),1/L),L};});if(lanes.length)fired++;
  for(const u of B.units.filter(u=>u.sortie&&!u.dead)){if(u.sortie.avoid!=null)avoided++;const s=Math.sign(u.pos[2]);if(side.has(u.id)&&side.get(u.id)<0&&s>0)crossed++;side.set(u.id,s);
   for(const ln of lanes){const r=C.sub(u.pos,ln.a),al=C.dot(r,ln.d);if(al<3000||al>ln.L-3000)continue;near=Math.min(near,C.len(C.sub(r,C.mul(ln.d,al))));}}}
 if(process.env.KS_SHOW)console.error('nearest to a line of fire',Math.round(near),'crossed',crossed,'avoided',avoided,'steps with fire',fired);
 assert.ok(fired>100,'ships were firing at each other while the strike flew: '+fired+' steps');assert.ok(crossed>=6,'the strike went over to the other side: '+crossed+' craft');assert.ok(avoided>0,'it was sent round');
 assert.ok(near>=C.FLEET_AIR.lane*.9,`no craft came nearer a line of fire than ${Math.round(near)} m (the lane is ${C.FLEET_AIR.lane} m)`);
});
