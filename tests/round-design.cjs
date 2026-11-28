// 2026-11-27 Designed rounds (docs/missile-design-spec-2026-11-27.md): warhead, control and main propellant, and core shared by volume;
// control at least 5% of the mass; the presets keep the old rounds' mass and yield.
const assert=require('node:assert/strict'),path=require('node:path'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'));
const near=(a,b,e=1e-9)=>assert.ok(Math.abs(a-b)<=e*Math.max(1,Math.abs(b)),`${a} vs ${b}`);
test('the torpedo preset is the old torpedo: same mass and yield, 90 m/s² of turn, the torpedo\'s turning budget, no main propellant',()=>{
 const t=C.roundDesign(7,50,C.ROUND_DESIGN.presets.torpedo);near(t.mass,C.SHIP_TORPEDO.mass);near(t.tt,C.SHIP_TORPEDO.tt);
 near(t.latAccel,90);near(t.controlDv,600*(1-Math.pow(.8,Math.log(1/6)/Math.log(.8)))/-Math.log(.8),1e-4);assert.equal(t.accelDv,0);assert.equal(t.design.use,'sustain');});
test('the missile preset keeps the old air missile\'s mass and yield and goes from 200 to 1,500 m/s at 650 m/s² at first',()=>{
 const m=C.roundDesign(.12,.9,C.ROUND_DESIGN.presets.missile);near(m.mass,C.AIR_ROUNDS.missile.mass);near(m.tt,C.AIR_ROUNDS.missile.tt);
 near(m.accelDv,1300,1e-4);near(m.accel0,650,2e-3);near(m.latAccel,450);});
test('control is raised to 5% of the mass, from the main propellant and then the warhead; a dense core adds mass',()=>{
 const w=C.roundDesign(.12,.9,{warhead:.6,control:.01,accel:.2,core:.19,coreDensity:'tungsten'});near(w.controlShare,.05);assert.equal(w.design.accel,0);
 assert.ok(w.design.warhead<.6);near(w.design.core,.19);assert.equal(w.design.coreDensity,19.3);
 const V=Math.PI/4*.12*.12*.9;assert.ok(w.mass>V);near(w.coreMass,V*.19*19.3);});
test('a core\'s density is held between iron and tungsten; none means no core',()=>{
 assert.equal(C.roundDesign(1,4,{warhead:.5,control:.1,core:.4,coreDensity:3}).design.coreDensity,7.87);
 assert.equal(C.roundDesign(1,4,{warhead:.5,control:.1,core:.4,coreDensity:40}).design.coreDensity,19.3);
 const n=C.roundDesign(1,4,{warhead:.5,control:.1,core:.4,coreDensity:'none'});assert.equal(n.design.core,0);assert.equal(n.coreMass,0);});
test('lateral acceleration is proportional to the control share: 50% gives the old missile\'s 900 m/s²',()=>{
 near(C.roundDesign(.12,.9,{warhead:.5,control:.5}).latAccel,900);});
test('physics review 2026-11-27: control taken from a dense core is solved for the lighter round (5%, not more); no body, no design',()=>{
 const t=C.roundDesign(.12,.9,{core:1,coreDensity:'tungsten'});near(t.controlShare,.05,1e-9);near(t.design.control+t.design.core,1);
 assert.equal(C.roundDesign(0,1,{}),null);assert.equal(C.roundDesign(1,NaN,{}),null);});
