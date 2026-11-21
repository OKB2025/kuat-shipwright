// 2026-11-21 (user report with a Victory-class design: a navigation computer wholly inside the hull and the castle decks was
// refused with「実寸の0%が配置先からはみ出しています」). Where the region holding a room is the union of several structures, the
// clipped volume can come out slightly larger than the room (the seams are counted twice: +3.9e-6 in that design). Only a
// shortfall means the room leaves the ship. Rooms spanning overlapping, touching and stacked structures are accepted; a room
// that really sticks out is still refused, and the message gives the share without rounding it to 0.
// Note: these small fixtures are accepted by the code before the fix as well (they do not produce the excess); the user's design,
// which does, is not in the repository (user files are not committed). It was checked by hand: #9230 refused before, accepted after.
const path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const {C}=require(path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'),'scripts/update-ship-examples.cjs')).loadRuntime(path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')));
function ship(parts){const s=C.newShip({L:400,W:200,H:200,assembly:true},'Union');s.parts=parts.map((p,i)=>({id:i+1,k:'struct',form:'box',yaw:0,pitch:0,roll:0,...p}));s.fits=[];s.hatches=[];s.links=[];s.groups=[];s.nextId=s.parts.length+1;return C.deserialize({...JSON.parse(C.publicJSON(s)),format:'starship-yard',v:3});}
const room=(c,size)=>({id:-1,k:'navComputer',c,d:Math.max(...size),room:size,placement:{modelVersion:C.PLACEMENT_MODEL_VERSION,mode:'direct'}});
test('a room across the seams of overlapping and stacked structures is accepted',()=>{
 for(const layout of [
  [{c:[100,50,0],s:[200,100,60]},{c:[100,110,0],s:[160,40,40]}],                    // stacked: the second sits 20 m into the first
  [{c:[100,50,0],s:[200,100,60]},{c:[100,50,0],s:[120,80,80]},{c:[100,70,0],s:[60,90,30]}], // three overlapping
  [{c:[60,50,0],s:[120,100,60]},{c:[180,50,0],s:[120,100,60]}]                       // two touching end to end
 ]){const s=ship(layout),r=C.solveInteriorPlacement(s,room([110,62,0],[100,30,20]),{mode:'direct'});assert.equal(r.ok,true,JSON.stringify(layout)+': '+(r.error||''));}
});
test('a room that sticks out is still refused, with its real share',()=>{
 const s=ship([{c:[100,50,0],s:[200,100,60]}]),r=C.solveInteriorPlacement(s,room([100,99.8,0],[40,20,20]),{mode:'direct'});
 assert.equal(r.ok,false);assert.equal(r.code,'fixed-outside');assert.doesNotMatch(r.error,/実寸の0%が/,'the share is not rounded to 0: '+r.error);
});
