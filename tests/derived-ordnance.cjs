// User specification 2026-11-11: craft rounds sized by the user, split into propellant and warhead, with one shared
// density (from the previous 1.0 × 0.2 m, 0.045 t concussion missile) and warhead energy density (user decision:
// matter conversion, 20 Gt TNT per t = 0.02 TT per t).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx),near=(a,b,e=1e-9)=>assert.ok(Math.abs(a-b)<=e*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const RHO=1,EW=.02,COST=50000,body=(D,L,w)=>{const m=RHO*Math.PI/4*D*D*L;return {mass:m,tt:m*w*EW};},dv=p=>Math.log(1/(1-p))/Math.LN2;

test('one shared density and warhead energy density give every specified round its mass and damage',()=>{
 near(C.ORDNANCE_BASIS.density,RHO);near(C.ORDNANCE_BASIS.warheadTTPerT,EW);
 const spec={cmsl:[.5,5,.5],ptorp:[1.5,8,.95],itorp:[1.5,8,.95],bomb:[1,2,.99],ibomb:[1,2,.99]};
 for(const [k,[D,L,w]] of Object.entries(spec)){const o=C.ORDNANCE[k],b=body(D,L,w);assert.deepEqual([...o.dims],[L,D],k);near(o.mass,b.mass);near(o.tt,b.tt);near(o.warheadFraction,w);near(o.warheadMass+o.propellantMass,o.mass);}
 near(C.ORDNANCE.cmsl.mass,Math.PI/4*.25*5);near(C.ORDNANCE.ptorp.mass,Math.PI/4*2.25*8);near(C.ORDNANCE.bomb.mass,Math.PI/4*2);near(C.ORDNANCE.cmsl.tt,.0098174770,1e-8);near(C.ORDNANCE.ptorp.tt,.2686061719,1e-8);near(C.ORDNANCE.bomb.tt,.0311017673,1e-8);
 // expendable rounds: supply cost 50,000 per TT of warhead
 for(const k of ['cmsl','ptorp','itorp','bomb','ibomb','etorp'])near(C.ORDNANCE[k].cost,C.ORDNANCE[k].tt*COST);near(C.ORDNANCE.etorp.mass,Math.PI/4*.09*1.3);
 assert.equal(C.ORDNANCE.itorp.ion,true);assert.equal(C.ORDNANCE.ibomb.ion,true);assert.equal(C.ORDNANCE.ibomb.bomb,true);assert.ok(!C.ORDNANCE.ptorp.ion);
 // The ship-scale rounds use the same basis.
 near(C.SHIP_LAUNCHERS.shipCmsl.rounds.missile.tt,body(7,50,.5).tt);near(C.SHIP_LAUNCHERS.shipCmsl.rounds.torpedo.tt,body(7,50,.95).tt);
});

test('speed and range follow the propellant share; seekers by round',()=>{
 const m=C.ORDNANCE.cmsl,t=C.ORDNANCE.ptorp;assert.equal(m.speed,2000);assert.equal(m.range,10000);near(t.speed,2000*dv(.05));near(t.range,10000*dv(.05));near(C.ORDNANCE.itorp.range,t.range);
 assert.equal(m.seeker,'heat');assert.equal(t.seeker,'mass');assert.equal(C.ORDNANCE.itorp.seeker,'mass');assert.ok(!C.ORDNANCE.bomb.seeker&&!C.ORDNANCE.ibomb.seeker&&!C.ORDNANCE.bomb.guided);
});

test('example bombers: the TIE/sa bay holds one 1 × 2 m bomb; the BTL-B has no bay and hangs eight bombs on four keel pylons',()=>{
 const s=C.buildDesign('craft_tie_sa'),bay=s.parts.find(p=>p.k==='bombBay');assert.ok(bay&&C.bombBayOpen(s,bay));assert.deepEqual([...C.bombBayBox(bay)],[2,1,1]);assert.equal(C.storeCapacity({mount:'bay',box:C.bombBayBox(bay)},'bomb'),1);
 assert.ok(!C.computeStats(s).warnings.some(w=>w.code==='bomb-bay-size'));assert.deepEqual(JSON.parse(JSON.stringify(C.craftOrdnance('tie_sa').map(q=>[q.kind,q.n]))),[['bomb',1],['ptorp',2]]);
 // a bay too small for the bomb is reported instead of silently holding nothing
 Object.assign(bay,{c:[1.03,.36,0],room:[2,.6,.7],d:Math.cbrt(.84)});C.syncCompartments(s);const small=C.computeStats(s);assert.equal(C.bombBayOpen(s,bay),true,'the previous 2 × 0.6 × 0.7 m bay is a usable bay');assert.equal(C.storeCapacity({mount:'bay',box:C.bombBayBox(bay)},'bomb'),0);assert.ok(small.warnings.some(w=>w.code==='bomb-bay-size'),'and it is reported as too small');
 const b=C.buildDesign('craft_btlb');assert.equal(b.parts.filter(p=>p.k==='bombBay').length,0,'no bomb bay (canon)');assert.equal(b.fits.filter(f=>f.k==='cpylon').length,6);assert.equal(b.fits.some(f=>f.float),false);
 const L=C.craftLoadout(b);assert.equal(L.canon,true);// canon 6 torpedoes and 8 bombs; the landing equipment's spare rating (shared by six pylons) leaves no room for a
 // 14.1 t torpedo but carries the eight 1.6 t bombs
 assert.deepEqual(JSON.parse(JSON.stringify(C.craftOrdnance('btlb').map(q=>[q.kind,q.n,q.per,q.stations]))),[['bomb',4,2,2],['bomb',4,2,2]]);
});

test('shipMsl cells hold six craft missiles and fire them with the heat seeker',()=>{
 const d=C.fitSpec({k:'shipMsl'}),spec=C.missileLauncherSpec({k:'shipMsl',p:[0,0,0],a:2});assert.deepEqual([d.fm,d.hm,d.wm],[12,2.25,2.25]);assert.equal(C.storeCapacity(d.store,'cmsl'),6);
 assert.equal(spec.tt,C.ORDNANCE.cmsl.tt);assert.equal(spec.seeker,'heat');const hw=C.launcherCellHardware(12,2.25,2.25);near(d.hardwareMass,hw.mass);near(d.ammoMass,6*C.ORDNANCE.cmsl.mass);near(d.mass,hw.mass+6*C.ORDNANCE.cmsl.mass);near(d.cost,hw.cost);near(d.ammoCost,6*C.ORDNANCE.cmsl.cost);near(hw.mass,118.125*6.13/10.26);
});

test('craft tubes and pylons keep their magazine counts for the new sizes; a bomb bay needs 2 × 1 × 1 m per 1 × 2 m bomb',()=>{
 const cap=(fit,k)=>C.storeCapacity(C.FITS[fit].store,k);
 assert.equal(cap('ctorp','ptorp'),6);assert.equal(cap('ctorp','itorp'),6);assert.equal(cap('ctorp','cmsl'),6);assert.equal(cap('cmsl','cmsl'),6);assert.equal(cap('cmsl','ptorp'),0);
 assert.equal(cap('cpylon','cmsl'),6);assert.equal(cap('cpylon','ptorp'),3);assert.equal(cap('cpylon','bomb'),3);
 assert.equal(C.storeCapacity({mount:'bay',box:[2.4,1.2,.7]},'bomb'),0);assert.equal(C.storeCapacity({mount:'bay',box:[2,1,1]},'bomb'),1);assert.equal(C.storeCapacity({mount:'bay',box:[4,2,1]},'ibomb'),4);
});
