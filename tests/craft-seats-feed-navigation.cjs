const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance:{now:()=>0}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),plain=x=>JSON.parse(JSON.stringify(x)),near=(a,b,e=1e-9)=>assert.ok(Math.abs(a-b)<=Math.max(1,Math.abs(b))*e,`${a} != ${b}`);
const box=()=>{const s=C.newShip({L:12,W:6,H:4,assembly:true},'Seat fixture');C.placePart(s,'struct',[6,2,0],[8,3,3],{form:'box'});return s;};

test('reactor output follows its reactant feed; small reactors burn their reactant less completely',()=>{
 const s=C.newShip({L:300,W:160,H:120,sec:'rect',plan:'rect'},'Feed');s.parts=[{id:1,k:'gen',c:[200,60,0],d:20}];s.fits=[];s.nextId=2;
 const rated=C.ratedReactorPower(s.parts[0]),V=C.partVolume(s.parts[0]);
 assert.equal(C.reactantSupplyRatio(s),0);assert.equal(C.computeStats(s).power,0,'no feed equipment, no output');
 s.parts.push({id:2,k:'pump',c:[200,60,30],d:Math.cbrt(V/C.REACTANT_SUPPLY.reactorPerPump/2)});s.nextId=3;
 near(C.reactantSupplyRatio(s),.5,1e-6);near(C.computeStats(s).power,rated*.5,1e-6);
 near(C.reactorBurnEfficiency(20),.5);near(C.reactorBurnEfficiency(600),600/620);assert.ok(C.reactorBurnEfficiency(.1)<.01);
 near(C.reactantBurnEfficiency([20,600]),(20*.5+600*600/620)/620);
});
test('a hyperdrive needs navigation for its class; bridges and astromechs supply it',()=>{
 for(const key of ['craft_awing','craft_xwing','acclamator']){const s=C.buildDesign(key),S=C.computeStats(s);assert.ok(S.navDemand>0,key);near(S.navDemand,1/S.hyperClass);assert.ok(S.navCapacity>=S.navDemand,key);assert.equal(S.jumpOK,true,key);}
 const s=C.buildDesign('craft_xwing');s.parts=s.parts.filter(p=>p.k!=='astromech'&&p.k!=='navComputer');const S=C.computeStats(s);
 assert.equal(S.jumpOK,false);assert.ok(S.warnings.some(w=>w.code==='navigation'));
});
test('crew seats are fixed uncut rooms that count only when wholly inside the structures',()=>{
 const s=box(),a=C.placePart(s,'cockpit',[6,2,0],3,{room:[3,3,3]}),b=C.placePart(s,'cockpit',[9.8,2,0],3);
 assert.deepEqual(plain(a.room),plain(C.COCKPIT_SEAT.room));assert.equal(a.seats,1);
 C.syncCompartments(s);assert.equal(a._clip,undefined);assert.equal(b._clip,undefined,'a seat is never cut');
 assert.equal(C.cockpitSeatFits(a),true);assert.equal(C.cockpitSeatFits(b),false);
 near(C.partVolume(b),C.COCKPIT_SEAT.room.reduce((x,y)=>x*y,1),1e-5);
});
test('old canopies become canopy structures plus one seat per crew member',()=>{
 const s=box();s.parts.push({id:s.nextId++,k:'cockpit',c:[6,2.5,0],d:1.2,seats:2,suit:true});
 const loaded=C.deserialize(plain(C.serialize(s))),seats=loaded.parts.filter(p=>p.k==='cockpit'),shell=loaded.parts.find(p=>p.label==='キャノピー');
 assert.equal(seats.length,2);assert.ok(seats.every(p=>p.seats===1&&p.suit===true&&p.room));assert.ok(shell&&C.isShapePart(shell));
 const again=C.deserialize(plain(C.serialize(loaded)));assert.equal(again.parts.filter(p=>p.k==='cockpit').length,2,'migration runs once');
});
test('droid brains have one size and a droid-flown craft cannot jump',()=>{
 const s=box(),p=C.placePart(s,'droidbrain',[6,2,0],.9);assert.equal(p.d,.34);
 s.parts.push({id:s.nextId++,k:'hyper',c:[4,2,0],d:.5});const S=C.computeStats(s);
 assert.equal(S.droidOnly,true);assert.equal(S.jumpOK,false);assert.ok(S.warnings.some(w=>w.code==='droid-hyperdrive'));
});
test('a fixed laser is a bare barrel that may sink into the hull while its muzzle is clear',()=>{
 const s=box(),top=[6,3.5,0],n=[0,1,0];
 const shallow=C.placeFit(s,'claser',top,n,0,false,{sink:.1});assert.ok(shallow.fit,shallow.err);near(shallow.fit.sink,.1);
 near(C.fitOrigin(shallow.fit)[1],top[1]-.1,1e-6);assert.equal(C.craftMuzzleBlocked(s,shallow.fit),false);
 const b=C.fitAABB(shallow.fit);assert.ok(b[4]-b[1]<C.FITS.claser.wm*.9,'no breech housing above the barrel');
 const t=C.newShip({L:12,W:6,H:4,assembly:true},'Blocked');C.placePart(t,'struct',[6,2,0],[8,3,3],{form:'box'});C.placePart(t,'struct',[9.5,3.4,0],[1,1,1],{form:'box'});
 const blocked=C.placeFit(t,'claser',[7.6,3.5,0],n,0,false,{sink:.3});assert.match(blocked.err||'',/発射口/);
 const loaded=C.deserialize(plain(C.serialize(s)));near(loaded.fits[0].sink,.1);
});
