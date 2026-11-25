// 2026-11-25 Where a ship ordered to attack fights is judged from the two ships' own guns, not from a fixed table of
// distances (user「艦隊戦の間合いも実際に判断して自動で決める形に。この辺は航空機と同じ」「艦隊戦は小型艦同士の戦闘も成立するように」).
// The earlier table (6.5-39 km) lay outside every gun of a ship that carries lasers only, and its tie-break (d x 1e-9 TT/s)
// outweighed such a ship's whole fire: two CR90s chose 39 km and could not have hit each other from there.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const C=vm.runInContext('Core',context),six=v=>[v,v,v,v,v,v],TT=4.184e21;
function profile({len=150,laser=0,laserRange=4000,tl=0,hold=0,tlRange=0,charge=1,P=1e30}={}){
 return {name:'Standoff fixture',profileVersion:27,hp:100,D:0,shieldBuffer:0,reserve:0,wCap:0,crewNeed:1,crewMax:1,len,width:len*.3,height:len*.2,maxSpeed:0,turnRate:0,accel:0,acc:1,aa:0,
  gunArcs:six(laser+tl),ionArcs:six(0),gunBands:{long:six(tl),mid:six(0),close:six(laser)},
  gunBandRules:{long:tl>0?[{w:tl,kind:'turbolaser',holdM:hold,rangeM:tlRange,fadeM:0}]:[],mid:[],close:laser>0?[{w:laser,kind:'laser',holdM:0,rangeM:laserRange,fadeM:laserRange/5.6}]:[]},ionRules:[],
  energyModel:{version:1,eta:.95},weaponCharge:charge,modules:[],grid:{P}};
}
const unit=(p,team=0)=>C.fleetUnit('u'+team,'fixture',p,team);
test('two ships of lasers only fight inside their lasers, not at the furthest distance of a table',()=>{
 const a=unit(profile({laser:1e-6})),z=unit(profile({laser:1e-6}),1),d=C.fleetStandoff(a,z),floor=(a.p.len+z.p.len)*.7;
 assert.ok(d>=floor&&d<4000,`stand-off ${d} m lies inside the 4,000 m laser and outside the hulls (${floor} m)`);
 assert.ok(C.bandFireAt(a.p,d)>0,'the ship lands fire from where it chose to fight');
 assert.equal(d,floor,'a laser fades from the muzzle on: equal ships close as far as the hulls allow');
});
test('the distances weighed come from the two ships\' guns',()=>{
 const p=profile({tl:10,hold:30000,tlRange:33000}),q=profile({laser:1e-6,laserRange:5000}),ds=C.fleetStandoffDistances(p,q,210);
 assert.ok(ds.includes(30000),'the distance to which its own turbolaser carries its whole shot');
 assert.ok(ds.some(d=>d>5000&&d<=5200),'just outside the target\'s laser');
 assert.ok(ds.includes(210),'as near as the hulls allow');
 assert.ok(!ds.includes(39000)&&!ds.includes(6500),'no fixed table for a profile that carries its guns\' ranges');
 const old={...profile({tl:10}),gunBandRules:undefined};assert.ok(C.fleetStandoffDistances(old,q,210).includes(39000),'a profile made before the gun rules keeps the earlier table');
});
test('a ship ordered to attack never chooses a distance from which it lands nothing',()=>{
 // Outgunned at every distance it can reach from: the score is below zero everywhere inside its own range and zero outside it.
 const weak=profile({laser:1e-6,laserRange:4000}),strong=profile({tl:100,hold:30000,tlRange:33000,len:1600}),J=C.fleetStandoffJudge(weak,strong,1225);
 assert.ok(J.distance<4000,`chose ${J.distance}`);assert.ok(C.bandFireAt(weak,J.distance)>0);
 assert.ok(J.rows.some(r=>r.mine===0&&r.theirs===0),'a distance out of everyone\'s reach was weighed and passed over');
});
test('a ship that outranges its target stays outside the target\'s guns while its own still carry',()=>{
 const far=profile({tl:10,hold:30000,tlRange:33000,len:300}),near=profile({tl:50,hold:8000,tlRange:11000,len:300}),d=C.fleetStandoffJudge(far,near,420).distance;
 assert.ok(d>11000&&d<=33000,`stand-off ${d} m is outside 11 km and inside 33 km`);
 const back=C.fleetStandoffJudge(near,far,420).distance;assert.ok(back<=11000,`the shorter-ranged ship closes inside its own guns (${back} m)`);
});
test('equal scores: the further distance',()=>{
 // Unopposed, the whole shot arrives anywhere inside the hold: the hit chance alone falls with distance, so the score does too.
 // Two profiles with nothing to choose between distances are made by an unarmed target and a perfect aim at point blank only;
 // the rule is checked on the rows themselves.
 const J=C.fleetStandoffJudge(profile({tl:10,hold:30000,tlRange:33000}),profile({}),210),able=J.rows.filter(r=>r.mine>0),top=Math.max(...able.map(r=>r.score)),scale=Math.max(...J.rows.map(r=>Math.max(r.mine,r.theirs)));
 const ties=able.filter(r=>r.score>=top-scale*2e-6);assert.equal(J.distance,Math.max(...ties.map(r=>r.d)));
});
test('the estimate of fire draws the input of a shot, as the battle does',()=>{
 // 100 TT/s of guns on a grid that can feed 90 TT/s of input: at charge factor 2 the input is 100 x 2 / .95.
 const plain=profile({tl:100,hold:30000,tlRange:33000,P:100*TT}),charged={...plain,weaponCharge:2},a=C.bandFireAt(plain,5000),b=C.bandFireAt(charged,5000);
 assert.ok(a>0&&b>0);assert.ok(Math.abs(b/a-.5)<1e-9,`fire at charge 2 is half the fire at charge 1 on the same grid (${b/a})`);
 const ample={...charged,grid:{P:1e30}},c=C.bandFireAt(ample,5000);assert.ok(c>a,'with power to spare the guns fire at their rate');
});
