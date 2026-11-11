// The trial (manual gunnery) aims trench battery groups from their wall: forward is the wall normal and the
// axis is the port's vertical, and the trench arc is tested before the fixed lock that the group's
// embedded/fixed flags would otherwise select. Before this, an abeam target read as 90° of elevation
// from a bow-pointing frame and every trench group stayed silent in the trial.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(root);
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),gfx=fs.readFileSync(path.join(root,'js/gfx.js'),'utf8');
const line=app.split('\n').find(l=>l.startsWith('const trialLimits='));
const trialLimits=new Function('C',line.replace('const trialLimits=','return ')+'')(C);
const n=v=>{const l=Math.hypot(...v);return v.map(x=>x/l)},dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
// The same angles trialTurretState/trialTick use: e2=axis×fw, yaw=atan2(d·e2,d·fw), elevation=asin(d·axis).
function angles(t,d){const e2=cross(t.axis,t.fw);return [Math.atan2(dot(d,e2),dot(d,t.fw)),Math.asin(Math.max(-1,Math.min(1,dot(d,t.axis))))];}
function inArc(t,d){const lim=trialLimits(t),[y,e]=angles(t,n(d));return (lim.yaw==null||Math.abs(y)<=lim.yaw)&&e>=lim.lo&&e<=lim.hi;}
test('gfx builds the trench group descriptor on the wall normal and the port vertical',()=>{
 assert.match(gfx,/pivot:muzzles\[0\]\.slice\(\),axis:across,fw:wall,/);
 assert.match(gfx,/const wall=C\.norm\(f\.n\|\|fr\.up\),along=row\.u\|\|f\.frameForward\|\|C\.norm\(C\.cross\(\[0,1,0\],wall\)\),across=row\.v\|\|C\.norm\(C\.cross\(wall,along\)\);/);
});
test('a starboard trench group reaches abeam and along the wall, and refuses the bow, the far side and steep elevation',()=>{
 const wall=[0,0,1],along=n(cross([0,1,0],wall)),across=n(cross(wall,along)),t={trenchAggregate:true,embedded:true,fixed:true,fw:wall,axis:across};
 assert.deepEqual(across.map(Math.round),[0,1,0]);
 const lim=trialLimits(t);assert.equal(+(lim.yaw*180/Math.PI).toFixed(6),C.TRENCH_BATTERY_ARC.yawDeg);assert.equal(+(lim.hi*180/Math.PI).toFixed(6),C.TRENCH_BATTERY_ARC.pitchDeg);
 assert.ok(inArc(t,[0,0,1]),'abeam');
 assert.ok(inArc(t,[Math.cos(80*Math.PI/180),0,Math.sin(80*Math.PI/180)]),'80° toward the bow from abeam is inside ±85°');
 assert.ok(inArc(t,[0,Math.tan(15*Math.PI/180),1]),'15° above the wall line');
 assert.ok(!inArc(t,[1,0,0]),'dead ahead is outside a wall battery');
 assert.ok(!inArc(t,[0,0,-1]),'the far side is outside');
 assert.ok(!inArc(t,[0,Math.tan(30*Math.PI/180),1]),'30° up is outside ±20°');
});
test('other fixed embedded mounts and pilot guns keep their fixed lock',()=>{
 assert.deepEqual(trialLimits({embedded:true,fixed:true}),{yaw:0,lo:0,hi:0});
 assert.deepEqual(trialLimits({pilot:true,trenchAggregate:true}),{yaw:0,lo:0,hi:0});
});
