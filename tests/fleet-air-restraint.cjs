// User decision 2026-11-19「航空投入を少し抑制的にする。迎撃、直掩用の機体は待機させるのではなく来たら発艦させる。なのでその分の管制枠を残す
// 動きになる」: a fleet keeps part of its air control free. The strike and its escort go up within the rest; the fighters kept
// aboard are launched when enemy craft come within FLEET_AIR.intercept of an own ship.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),F=vm.runInContext('YardFleetData',cx),plain=x=>JSON.parse(JSON.stringify(x));
const profiles={};for(const k of ['craft_tie_ln','craft_tie_sa','craft_xwing','craft_btlb']){const xs=C.buildDesign(k),S=C.computeStats(xs);profiles[k]={p:C.fleetProfile(S,xs.name,xs),liftSpare:Math.max(0,(S.craftSystems?.landingSupport||0)-S.mass)};}
// The strike is ordered here for both sides (posture.strike), so that these cases see the launch, the hatches and the landing;
// when a fleet strikes is the subject of the cases at the end.
function setup(){
 const isd=C.fleetUnit('isd','imperial',plain(F.designs.imperial.p),1),foe=C.fleetUnit('foe','mc75',plain(F.designs.mc75.p),0);isd.pos=[40000,0,0];isd.yaw=Math.PI;foe.pos=[-40000,0,0];
 // 2026-11-20 fixture changed (test triage). These cases were written against the Imperial row stored before the regeneration:
 // air control 6 and mouths passing 1.25 craft a second. The regenerated row carries the user decisions of 2026-11-19 that
 // were already in the code (air control 3: EXAMPLE_AIR_CONTROL; mouths four times as fast: K.launchOpen/launchRay), with which
 // 5 of the 13 cases failed (one craft already out after a quarter second; three groups cannot show "several groups with a
 // reserve"). The cases are about the air command's rules, so the fixture states the control and the mouth rates they need.
 // The real row's figures are checked by the last case of this file (twelve craft out in two to three seconds) and by
 // tests/air-control-stated.cjs. Case 4 slows the MC75's one mouth alike (it must stay the slower of the two); even() below
 // states the same for its two Imperial-class ships.
 isd.p.airCtl=6;for(const m of isd.p.mouths)m.r/=4;isd.p.launch/=4;
 for(const u of [isd,foe])u.order={...u.order,type:'hold',fire:false};
 const B=C.fleetBattle([foe,isd],true);B.seed=5;C.fleetAirSetup(B,[{home:'isd',type:'tie_sa',count:24},{home:'isd',type:'tie_ln',count:48},{home:'foe',type:'ywing',count:12},{home:'foe',type:'xwing',count:12}],profiles,{});B.air.posture[0].strike=B.air.posture[1].strike=true;return {B,isd,foe};
}
const run=(B,s)=>{for(let x=0;x<s;x+=.25)C.fleetTick(B,.25,{});};
const out=(B,team,f=()=>true)=>B.air.squadrons.filter(q=>q.team===team&&q.out&&f(q)).length;
test('the fleet keeps control free: the strike groups go up with their escort in them, the other fighters stay aboard',()=>{
 const {B,isd}=setup(),control=C.fleetAirControl(isd);assert.ok(control>=4,'the ISD directs several groups: '+control);
 C.fleetTick(B,.25,{});
 const mine=B.air.squadrons.filter(q=>q.team===1),strike=mine.filter(q=>q.bomber),rest=mine.filter(q=>!q.bomber),reserve=Math.max(1,Math.min(rest.length,Math.round(control*C.FLEET_AIR.reserveShare)));
 // 2026-11-19 with mixed groups (user decision「航空隊は編制によらず混成して編成できる形にして」) the 24 TIE/sa and 48 TIE/ln are three strike
 // groups of eight bombers and four fighters, and three groups of twelve fighters.
 assert.equal(strike.length,3);assert.equal(rest.length,3);
 assert.equal(out(B,1,q=>q.bomber),Math.min(strike.length,control-reserve),'the strike groups go, within the control not kept back');assert.equal(out(B,1,q=>!q.bomber),0,'no fighter group goes with them: the escort is in the strike groups');
 assert.ok(rest.every(q=>!q.out&&q.members.length===0&&q.mix.length===12),'the fighters kept aboard are not in the battle');
});
// User decision 2026-11-19「使う時に出す、使わない時は着艦させるを徹底させる」: a craft with no use in the air goes back to its ship and comes
// aboard, which frees its squadron's place in the air control.
test('craft with no use in the air land: bombers without stores, fighters with no strike to escort and no enemy craft near',()=>{
 const {B,isd}=setup();run(B,40);/* 36 craft through the ISD's hatches at 1.25 a second */
 const mine=()=>B.units.filter(u=>u.sortie&&u.team===1),sq=B.air.squadrons.filter(q=>q.team===1&&q.out),n0=mine().length,alive=new Map(sq.map(q=>[q,q.members.filter(id=>mine().some(u=>u.id===id)).length]));assert.ok(n0>=24,'the strike and its escort are up: '+n0);
 for(const u of B.units.filter(u=>u.sortie&&u.team===0))u.dead=true;/* no enemy craft near */B.air.squadrons.forEach(q=>{q.queue=[];q.pending=0;});/* and nobody else is on the way out */
 for(const u of mine()){if(u.sortie.bomber)u.sortie.stores=[];u.pos=[isd.pos[0]+200,300,(Math.random()-.5)*200];u.velocity=[0,0,0];}
 for(let t=0;t<1;t+=.25)C.fleetTick(B,.25,{});
 assert.equal(mine().length,0,'all of them are aboard');assert.ok((B.air.log.landed||[])[1]>=n0,'every craft that was up came aboard (and any that came out meanwhile)');
 for(const q of sq.filter(q=>alive.get(q)>0)){assert.equal(q.out,false);assert.equal(q.members.length,0);assert.equal(q.size,alive.get(q),'the squadron keeps its survivors');assert.ok(q.readyAt>B.time,'it is being re-armed');}
 assert.equal(B.air.squadrons.filter(q=>q.team===1&&q.out&&q.members.length>0).length,0,'no place in the air control is held');
});
test('craft in use stay up: bombers with stores and a ship to strike',()=>{
 const {B,isd}=setup();run(B,25);const bombers=B.units.filter(u=>u.sortie?.bomber&&u.team===1);assert.ok(bombers.length&&bombers.every(u=>u.sortie.stores.length>0));
 bombers.forEach((u,i)=>{u.pos=[isd.pos[0]+200,300+(i%4)*60,(i-12)*60];u.velocity=[0,0,0];});
 for(let t=0;t<1;t+=.25)C.fleetTick(B,.25,{});
 assert.ok(bombers.every(u=>!u.sortie.rtb),'they are not sent home with their rounds aboard');assert.equal(B.air.squadrons.filter(q=>q.team===1).reduce((n,q)=>n+q.mix.filter(x=>x.bomber).length,0),0,'and none of them has come aboard');
});
// User decision 2026-11-19「航空機の発艦はちゃんとハッチから出して。ハッチのサイズで発艦速度が決まる」: craft leave by the hangar mouths, each
// mouth at the rate its opening gives (the profile's mouths[].r craft a second).
test('craft come out of the hangar mouths at the rate the mouths give, and appear just outside a mouth',()=>{
 const {B,isd,foe}=setup();for(const m of foe.p.mouths)m.r/=4;foe.p.launch/=4;/* 2026-11-20 as in setup() */const rate=isd.p.mouths.reduce((n,m)=>n+m.r,0);assert.ok(Math.abs(rate-isd.p.launch)<1e-2,'the mouths add up to the ship\'s launch rate');
 C.fleetTick(B,.25,{});assert.equal(B.units.filter(u=>u.sortie&&u.team===1).length,0,'nobody is out after a quarter of a second');
 run(B,2);const n=B.units.filter(u=>u.sortie&&u.team===1).length,T=B.time-.25/* the order is given on the first step */;
 assert.ok(n>=Math.floor(rate*T)-isd.p.mouths.length&&n<=Math.ceil(rate*T)+1,`about ${rate.toFixed(2)} a second: ${n} craft in ${T} s`);
 const slow=B.units.filter(u=>u.sortie&&u.team===0).length,r0=foe.p.mouths.reduce((x,m)=>x+m.r,0);assert.ok(slow<=Math.ceil(r0*T)+1&&slow<n,`the MC75's one mouth passes fewer (${slow} at ${r0.toFixed(2)} a second)`);
 const fresh=C.fleetUnit('isd2','imperial',plain(F.designs.imperial.p),1);for(const m of fresh.p.mouths)m.r/=4;fresh.p.launch/=4;/* 2026-11-20 as in setup() */fresh.pos=[0,0,0];fresh.yaw=0;const B2=C.fleetBattle([fresh,C.fleetUnit('t','cr90',plain(F.designs.cr90.p),0)],true);B2.units[1].pos=[90000,0,0];
 C.fleetAirSetup(B2,[{home:'isd2',type:'tie_sa',count:12}],profiles,{});B2.air.posture[1].strike=true;run(B2,1.25);const c=B2.units.find(u=>u.sortie);assert.ok(c,'the first craft is out');
 const d=Math.min(...fresh.p.mouths.map(m=>C.len(C.sub(c.pos,C.dockLocalToWorld(fresh,m.p)))));assert.ok(d<60,'it appears at a mouth, not beside the ship: '+d.toFixed(1)+' m from the nearest mouth');
});
test('a ship with no mouth the craft fits does not launch them',()=>{
 const {B,isd}=setup();isd.p.mouths=isd.p.mouths.map(m=>({...m,o:[1,1]}));run(B,6);
 assert.equal(B.units.filter(u=>u.sortie&&u.team===1).length,0);assert.equal(out(B,1),0,'and its squadrons hold no air control');
});
test('a squadron that has landed is re-armed and can go up again, bombers too',()=>{
 const {B,isd}=setup();run(B,25);const q=B.air.squadrons.find(x=>x.team===1&&x.bomber);
 for(const u of B.units.filter(u=>u.sortie?.bomber&&u.team===1)){u.sortie.stores=[];u.pos=[isd.pos[0]+200,300,0];u.velocity=[0,0,0];}
 B.air.squadrons.filter(x=>x.team===1).forEach(x=>{x.queue=[];x.pending=0;});for(const u of B.units.filter(u=>u.sortie&&!u.sortie.bomber&&u.team===1)){u.pos=[isd.pos[0]+200,300,400];u.velocity=[0,0,0];}for(const u of B.units.filter(u=>u.sortie&&u.team===0))u.dead=true;run(B,1);
 assert.equal(q.out,false);assert.ok(q.readyAt>B.time);const n=q.size;assert.ok(n>0);
 run(B,C.FLEET_AIR.rearm+C.FLEET_AIR.every+8);
 assert.equal(q.out,true,'it goes up again after '+C.FLEET_AIR.rearm+' s');const again=B.units.filter(u=>q.members.includes(u.id));const bs=again.filter(u=>u.sortie.bomber);assert.ok(bs.length>0&&bs.every(u=>u.sortie.stores.length>0),'the bombers with their rounds');
});
// User decision 2026-11-19「単に始まったら爆撃機で対艦攻撃ではなく、敵が爆撃機を出してきたら対抗で制空機を上げて広域防空、爆撃機の攻撃を阻止したら
// こっちも反撃を出して」: no strike as a matter of course; fighters go up against an enemy strike wherever it is; the counter-strike
// follows when that strike is over.
function even(arrive,first=[false,false]){
 const a=C.fleetUnit('a','imperial',plain(F.designs.imperial.p),0),z=C.fleetUnit('z','imperial',plain(F.designs.imperial.p),1);a.pos=[-45000,0,0];z.pos=[45000,0,0];z.yaw=Math.PI;
 for(const u of [a,z]){u.p.airCtl=6;for(const m of u.p.mouths)m.r/=4;u.p.launch/=4;}/* 2026-11-20 as in setup() */
 for(const u of [a,z])u.order={...u.order,type:'hold',fire:false};const B=C.fleetBattle([a,z],true);B.seed=9;
 C.fleetAirSetup(B,[{home:'a',type:'ywing',count:12},{home:'a',type:'xwing',count:24},{home:'z',type:'tie_sa',count:12},{home:'z',type:'tie_ln',count:36}],profiles,{...(arrive?{arrive}:{}),...(first?{first}:{})});return {B,a,z};
}
test('two fleets of which neither holds it can win with its craft fly no strike',()=>{
 const {B,a,z}=even();run(B,12);
 assert.equal(B.units.filter(u=>u.sortie).length,0,'nobody is in the air');assert.equal(out(B,0)+out(B,1),0);assert.ok(!B.air.posture[0].strike&&!B.air.posture[1].strike);
});
test('an enemy strike brings the fighters up to meet it far out; when it is over the counter-strike goes',()=>{
 const {B,a,z}=even();B.air.posture[0].strike=true;B.air.posture[0].why='ordered here';run(B,20);
 const their=B.units.filter(u=>u.sortie&&u.team===0),bombers=their.filter(u=>u.sortie.bomber);assert.ok(bombers.length>0,'the strike is up');
 assert.ok(bombers.every(u=>C.len(C.sub(u.pos,z.pos))>C.FLEET_AIR.intercept),'and still far from the defending fleet: '+Math.round(Math.min(...bombers.map(u=>C.len(C.sub(u.pos,z.pos))))));
 assert.ok(out(B,1,q=>!q.bomber)>=1,'the defender sends fighters up');assert.equal(out(B,1,q=>q.bomber),0,'and keeps its bombers aboard');assert.ok(!B.air.posture[1].strike);
 const fighters=B.units.filter(u=>u.sortie&&u.team===1&&!u.sortie.bomber);run(B,C.FLEET_AIR.every+.5);
 assert.ok(fighters.some(u=>u.sortie.job==='intercept'&&their.some(q=>q.id===u.order.target&&q.sortie.bomber)),'they are sent at the bombers, 80 km off');
 for(const u of B.units.filter(u=>u.sortie&&u.team===0)){u.sortie.stores=[];}B.air.squadrons.filter(q=>q.team===0).forEach(q=>{q.queue=[];q.pending=0;});/* the strike is spent */
 run(B,C.FLEET_AIR.every+8);
 assert.equal(B.air.posture[1].strike,true);assert.equal(B.air.posture[1].why,'counter');assert.ok(out(B,1,q=>q.bomber)>=1,'the counter-strike goes up');
});
// 「跳躍前から偵察で敵艦隊がいることを認識してるなら、もし跳躍可能な機体であれば前の星系から発艦させておいて艦隊と一緒に跳躍させてついた瞬間に攻撃開始」
test('a fleet that arrives with its craft in the air: the hyperdrive craft are out at once and it strikes; craft without a hyperdrive are not',()=>{
 const {B}=even([true,true]);C.fleetTick(B,.25,{});
 const up0=B.units.filter(u=>u.sortie&&u.team===0),up1=B.units.filter(u=>u.sortie&&u.team===1);
 assert.equal(up0.length,36,'X-wings and Y-wings carry hyperdrives: all 36 are in the air on arrival');assert.equal(B.air.posture[0].why,'arrived');assert.ok(up0.every(u=>!u.dockCorridor),'they did not come out of the hatches');
 assert.ok(up1.length<=2,'TIEs carry none: they come out of the hatches as usual ('+up1.length+' so far)');
 run(B,C.FLEET_AIR.every+1);assert.ok(up0.filter(u=>u.sortie.bomber).every(u=>u.order.type!=='hold'),'the bombers are on their way');
});
// User decision 2026-11-19「爆撃機を先に出すのはむしろ『航空機なら勝てる』と考えている側。なので分離主義対共和国であれば共和国が先に仕掛けるし
// 反乱軍対帝国であれば反乱軍が先に仕掛ける」
test('the side that holds it can win with its craft strikes first: by faction, as given, or by what the craft carry',()=>{
 assert.deepEqual([...C.fleetAirFirst('rebel','empire')],[true,false]);assert.deepEqual([...C.fleetAirFirst('empire','rebel')],[false,true]);
 assert.deepEqual([...C.fleetAirFirst('republic','cis')],[true,false]);assert.deepEqual([...C.fleetAirFirst('cis','republic')],[false,true]);assert.equal(C.fleetAirFirst('empire','cis'),null);
 let f=even(null,C.fleetAirFirst('rebel','empire'));run(f.B,C.FLEET_AIR.every+1);
 assert.equal(f.B.air.posture[0].why,'first');assert.ok(out(f.B,0,q=>q.bomber)>=1,'the Rebel side sends its strike');assert.ok(!f.B.air.posture[1].strike,'the Imperial side does not open with one');
 f=even(null,null);run(f.B,C.FLEET_AIR.every+1);/* not given: the craft's loads decide */
 const w0=C.fleetAirStrikeWeight(f.B.air,0),w1=C.fleetAirStrikeWeight(f.B.air,1);assert.ok(w0>w1&&w1>=0,`X-wings and Y-wings carry more each than TIEs: ${w0.toFixed(3)} against ${w1.toFixed(3)} TT a craft`);
 assert.equal(f.B.air.posture[0].first,true);assert.equal(f.B.air.posture[1].first,false);
});
// User decision 2026-11-19「航空隊は編制によらず混成して編成できる形にして」
test('a group that goes up together can mix craft types: as given, and as made from wings given by type',()=>{
 const isd=C.fleetUnit('isd','imperial',plain(F.designs.imperial.p),1),foe=C.fleetUnit('foe','mc75',plain(F.designs.mc75.p),0);isd.pos=[40000,0,0];foe.pos=[-40000,0,0];const B=C.fleetBattle([foe,isd],true);
 C.fleetAirSetup(B,[{home:'foe',group:[{type:'ywing',count:5},{type:'xwing',count:3},{type:'awing',count:2}]},{home:'isd',type:'tie_sa',count:12},{home:'isd',type:'tie_ln',count:12},{home:'isd',type:'tie_in',count:12}],{...profiles,craft_awing:profiles.craft_xwing&&(()=>{const xs=C.buildDesign('craft_awing'),S=C.computeStats(xs);return {p:C.fleetProfile(S,xs.name,xs),liftSpare:Math.max(0,(S.craftSystems?.landingSupport||0)-S.mass)};})(),craft_tie_in:(()=>{const xs=C.buildDesign('craft_tie_in'),S=C.computeStats(xs);return {p:C.fleetProfile(S,xs.name,xs),liftSpare:Math.max(0,(S.craftSystems?.landingSupport||0)-S.mass)};})()},{first:[true,true]});
 const given=B.air.squadrons.find(q=>q.team===0);assert.equal(given.size,10);assert.equal(given.mix.map(x=>x.type).sort().join(','),'awing,awing,xwing,xwing,xwing,ywing,ywing,ywing,ywing,ywing');assert.equal(given.bomber,true);
 const made=B.air.squadrons.filter(q=>q.team===1);assert.equal(made.length,4,'two strike groups, then the 18 fighters left over as twelve and six');
 assert.equal(made[0].mix.filter(x=>x.bomber).length,8);assert.equal(made[0].mix.filter(x=>!x.bomber).length,4,'eight bombers with four fighters');
 assert.equal(made[1].mix.filter(x=>x.bomber).length,4);assert.equal(made[1].mix.filter(x=>!x.bomber).length,2);
 assert.ok(new Set(made[2].mix.map(x=>x.type)).size===2&&made[2].mix.every(x=>!x.bomber),'the fighters left over fly together, TIE/ln and TIE/in in one group: '+[...new Set(made[2].mix.map(x=>x.type))]);
 run(B,40);const types=new Set(B.units.filter(u=>u.sortie&&u.team===0).map(u=>u.sortie.type));assert.ok(types.has('ywing')&&types.has('xwing')&&types.has('awing'),'the given group flies with all three types: '+[...types]);
 const one=B.units.filter(u=>given.members.includes(u.id));assert.ok(one.some(u=>u.sortie.bomber)&&one.some(u=>!u.sortie.bomber));
});
test('with opts.mixed false the wings fly as squadrons of one type',()=>{
 const isd=C.fleetUnit('isd','imperial',plain(F.designs.imperial.p),1),foe=C.fleetUnit('foe','mc75',plain(F.designs.mc75.p),0);const B=C.fleetBattle([foe,isd],true);
 C.fleetAirSetup(B,[{home:'isd',type:'tie_sa',count:24},{home:'isd',type:'tie_ln',count:12}],profiles,{mixed:false});
 assert.equal(B.air.squadrons.map(q=>[...new Set(q.mix.map(x=>x.type))].join('+')+':'+q.size).join(' '),'tie_sa:12 tie_sa:12 tie_ln:12');
});
// User decision 2026-11-19「もう少し発艦速度を上げて。例えば映画だとインペリアル級のTIEは腹部の開口部ハッチからパラパラと落ちて2〜3秒で12機は発艦できてる」
test('the Imperial class passes twelve craft through its hangar mouths in two to three seconds',()=>{
 assert.equal(C.K.launchOpen,4e-4);assert.equal(C.K.launchRay,2.4e-4);
 const mouths=F.designs.imperial.p.mouths,rate=mouths.reduce((n,m)=>n+m.o[0]*m.o[1]*C.K.launchOpen,0),seconds=12/rate;
 assert.ok(mouths.every(m=>!m.sl),'its mouths are open bays');assert.ok(seconds>=2&&seconds<=3,`twelve craft in ${seconds.toFixed(2)} s at ${rate.toFixed(2)} a second`);
});
