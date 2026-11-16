// User decision 2026-11-16「基本的に最高速度の6〜8割が持続的な巡航速度になるように各艦の排熱装置を調整」: refitShipThermal sizes
// the converters so the cruise the ship can hold (shields up, guns idle) is CRUISE_SPEED_TARGET.target of the maximum the game
// shows and flies with (healthyMotionPlan on the combat profile; physics review 2026-11-16).
const path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),{C}=require('../scripts/update-ship-examples.cjs').loadRuntime(root);
test('a refitted example holds a cruise of 60-80% of its shown maximum, measured against healthyMotionPlan',{timeout:600000},()=>{
 const s=C.buildDesign('arquitens'),S=C.computeStats(s),p=C.fleetProfile(S,s.name,s),c=C.shipSustainedCruise(s,S),max=C.healthyMotionPlan(C.reactorSupplyProfile(p)).accelerationMps2;
 assert.ok(Math.abs(c.maxAccelMps2/max-1)<1e-9,'the maximum is the one the game flies with: '+c.maxAccelMps2+' vs '+max);
 assert.ok(c.speedRatio>=C.CRUISE_SPEED_TARGET.low&&c.speedRatio<=C.CRUISE_SPEED_TARGET.high,'cruise ratio '+c.speedRatio);
 assert.ok(c.share>0&&c.share<1,'engine share '+c.share);
 // More converter capacity holds a faster cruise; less a slower one.
 const more=C.shipSustainedCruise(s,S,{capacityW:c.capacityW*1.5}),less=C.shipSustainedCruise(s,S,{capacityW:c.capacityW*.8});
 assert.ok(more.speedRatio>c.speedRatio&&less.speedRatio<c.speedRatio,[less.speedRatio,c.speedRatio,more.speedRatio].join(' < '));
});
