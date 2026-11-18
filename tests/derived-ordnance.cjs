// User specification 2026-11-11: craft rounds sized by the user, split into propellant and warhead, with one shared
// density and warhead energy density (from the previous 1.0 × 0.2 m, 0.045 t, 25 TT concussion missile).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx),near=(a,b,e=1e-9)=>assert.ok(Math.abs(a-b)<=e*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const RHO=.045/(Math.PI/4*.2*.2),EW=25/(.045*.5),body=(D,L,w)=>{const m=RHO*Math.PI/4*D*D*L;return {mass:m,tt:m*w*EW};},dv=p=>Math.log(1/(1-p))/Math.LN2;

test('one shared density and warhead energy density give every specified round its mass and damage',()=>{
 near(C.ORDNANCE_BASIS.density,RHO);near(C.ORDNANCE_BASIS.warheadTTPerT,EW);
 const spec={cmsl:[.5,5,.5],ptorp:[1.5,8,.95],itorp:[1.5,8,.95],bomb:[2,4,.99],ibomb:[2,4,.99]};
 for(const [k,[D,L,w]] of Object.entries(spec)){const o=C.ORDNANCE[k],b=body(D,L,w);assert.deepEqual([...o.dims],[L,D],k);near(o.mass,b.mass);near(o.tt,b.tt);near(o.warheadFraction,w);near(o.warheadMass+o.propellantMass,o.mass);}
 near(C.ORDNANCE.cmsl.tt,781.25);near(C.ORDNANCE.ptorp.tt,21375);near(C.ORDNANCE.bomb.tt,19800);near(C.ORDNANCE.cmsl.mass,1.40625);near(C.ORDNANCE.ptorp.mass,20.25);near(C.ORDNANCE.bomb.mass,18);
 assert.equal(C.ORDNANCE.itorp.ion,true);assert.equal(C.ORDNANCE.ibomb.ion,true);assert.equal(C.ORDNANCE.ibomb.bomb,true);assert.ok(!C.ORDNANCE.ptorp.ion);
 // The ship-scale rounds use the same basis.
 near(C.SHIP_LAUNCHERS.shipCmsl.rounds.missile.tt,body(7,50,.5).tt);near(C.SHIP_LAUNCHERS.shipCmsl.rounds.torpedo.tt,body(7,50,.95).tt);
});

test('speed and range follow the propellant share; seekers by round',()=>{
 const m=C.ORDNANCE.cmsl,t=C.ORDNANCE.ptorp;assert.equal(m.speed,2000);assert.equal(m.range,10000);near(t.speed,2000*dv(.05));near(t.range,10000*dv(.05));near(C.ORDNANCE.itorp.range,t.range);
 assert.equal(m.seeker,'heat');assert.equal(t.seeker,'mass');assert.equal(C.ORDNANCE.itorp.seeker,'mass');assert.ok(!C.ORDNANCE.bomb.seeker&&!C.ORDNANCE.ibomb.seeker&&!C.ORDNANCE.bomb.guided);
});

test('craft tubes and pylons keep their magazine counts for the new sizes; a small bomb bay no longer fits a 2 × 4 m bomb',()=>{
 const cap=(fit,k)=>C.storeCapacity(C.FITS[fit].store,k);
 assert.equal(cap('ctorp','ptorp'),6);assert.equal(cap('ctorp','itorp'),6);assert.equal(cap('ctorp','cmsl'),6);assert.equal(cap('cmsl','cmsl'),6);assert.equal(cap('cmsl','ptorp'),0);
 assert.equal(cap('cpylon','cmsl'),6);assert.equal(cap('cpylon','ptorp'),3);assert.equal(cap('cpylon','bomb'),3);
 assert.equal(C.storeCapacity({mount:'bay',box:[2.4,1.2,.7]},'bomb'),0);assert.equal(C.storeCapacity({mount:'bay',box:[8,4,2]},'bomb'),4);assert.equal(C.storeCapacity({mount:'bay',box:[8,4,2]},'ibomb'),4);
});
