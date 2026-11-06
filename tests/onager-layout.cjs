// Exercise the authored recipe directly: catalogue generation adds propulsion,
// power paths and thermal equipment separately, and has its own replay test.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),ctx=vm.createContext({console,performance:{now:()=>0}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
const C=vm.runInContext('Core',ctx),s=C.SHIP_EXAMPLES.onager.build(),guns=s.parts.filter(p=>p.k==='sbeam'),plain=v=>JSON.parse(JSON.stringify(v)),near=(a,b,e=1e-7)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(b))*e,`${a} != ${b}`);

test('Onager retains its measured exterior and the specified normal armament in mirrored rows',()=>{
 assert.equal(s.hull.L,1288);near(s.hull.W,448.072);assert.equal(guns.length,2);
 assert.deepEqual(Object.fromEntries([...new Set(s.fits.map(f=>f.k))].map(k=>[k,s.fits.filter(f=>f.k===k).length])),{triple40:8,quad200:16,pd:30});
 for(const f of s.fits){assert.equal(f.float,false);assert.ok(s.fits.some(g=>g.k===f.k&&Math.abs(g.p[0]-f.p[0])<.01&&Math.abs(g.p[2]+f.p[2])<.01),'each emplacement has its opposite flank');}
 assert.equal(s.fits.filter(f=>f.k==='triple40'&&f.a===2).length,8);assert.equal(s.fits.filter(f=>f.k==='quad200'&&f.a===2).length,8);assert.equal(s.fits.filter(f=>f.k==='quad200'&&f.a===3).length,8);
 assert.equal(s.fits.filter(f=>f.k==='pd'&&Math.abs(f.p[2])>=150&&f.p[0]>1100).length,14);
 const wing=s.parts.find(p=>p.label==='艦首の横翼'&&p.c[2]>0);near(C.partAABB(wing)[5],387.9,.001);
});

test('the two paid cannon bodies occupy the fork arms and transverse bow wings, leaving the slot open',()=>{
 near(C.partVolume(guns[0]),C.partVolume(guns[1]),1e-8);
 for(const p of guns){const sign=Math.sign(p.c[2]),volume=C.partVolume(p),bounds=C.partAABB(p);assert.ok(volume>4e6&&volume<5e6);assert.ok(volume*C.CHARGE_TT_M3>=125000,'the paid machinery exceeds the ordinary storage volume for its125PT shot');assert.ok(C.partBuildCost(p)>volume*C.PARTS.sbeam.cost*.99);assert.ok(Math.max(Math.abs(bounds[2]),Math.abs(bounds[5]))>380);
  let fork=0,occupiedFork=0,wing=0,occupiedWing=0;
  for(let x=660;x<=1230;x+=30)for(let z=55;z<=180;z+=15)for(let y=42;y<=96;y+=9){const q=[x,y,sign*z];if(C.insideOriginalEnvelope(s,q)){fork++;if(C.inPart(p,q))occupiedFork++;}}
  for(let x=1110;x<=1250;x+=10)for(let z=155;z<=375;z+=20)for(let y=40;y<=96;y+=8){const q=[x,y,sign*z];if(C.insideOriginalEnvelope(s,q)){wing++;if(C.inPart(p,q))occupiedWing++;}}
  assert.ok(occupiedFork/fork>.85,`fork machinery covers ${occupiedFork}/${fork} retained samples`);assert.ok(occupiedWing/wing>.85,`wing machinery covers ${occupiedWing}/${wing} retained samples`);assert.equal(C.inPart(p,[900,64.9,0]),false);
 }
});

test('every non-barrel machinery triangle remains within the original exterior',()=>{
 for(const p of guns){const T=C.superweaponBodyTriangles(p);for(let i=0;i<T.length;i+=9){const q=[0,1,2].map(a=>(T[i+a]+T[i+a+3]+T[i+a+6])/3);if(Math.abs(q[2])<43.05)continue;assert.equal(C.insideOriginalEnvelope(s,q),true,`machinery protrudes through original skin at ${q}`);}}
});

test('main gun machinery has no physical overlap with rooms, engine bodies or normal weapon plants',()=>{
 const occupied=C.allOccupied(s);for(const p of guns)assert.deepEqual(plain(occupied.filter(q=>q!==p&&C.overlapParts(p,q)).map(q=>[q.id,q.k])),[]);
 const rooms=s.parts.filter(p=>!C.isShapePart(p));for(let i=0;i<rooms.length;i++)for(let j=i+1;j<rooms.length;j++)assert.equal(C.overlapParts(rooms[i],rooms[j]),false,`${rooms[i].label} overlaps ${rooms[j].label}`);
 for(const p of s.parts.filter(p=>['hangar','cargo','service'].includes(p.k)))assert.ok(C.partAABB(p)[3]<594.4,'services stay behind the barrel breeches and arm chambers');
});

test('real retained reactor and shield hardware match the Venator without inflating the main cannon feed',()=>{
 const reactors=s.parts.filter(C.isReactor),main=reactors.find(p=>p.k==='gen'),P=reactors.reduce((n,p)=>n+C.reactorPower(p),0);near(P,3.6e24);assert.equal(main.d,95);assert.equal(reactors.filter(p=>p.k==='aux').length,2);assert.ok(C.reactorPower(main)<P*.7);
 const shield=s.parts.filter(p=>p.k==='shield'||p.k==='localShield').reduce((n,p)=>n+C.shieldLoad(p),0);near(shield,3.6e25);
 const S=C.computeStats(s);near(S.draw.shields,2.1742418829854712e23);near(S.shieldCapacity,3.6e25);assert.equal(S.warnings.filter(w=>w.lv==='bad').length,0);assert.ok(S.inertialSupport>S.mass*1.03,'aft inertial cylinders meet the common refit support margin with real machinery');assert.ok(S.integritySupport>S.mass*1.03,'upper-citadel field banks meet the common refit support margin without using the occupied cannon arms');
 const strict={...s,surfaces:{...s.surfaces,mode:'strict'}},stats={warnings:[],info:{}};C.superweaponStats(strict,stats);
 for(const w of stats.superweapons){assert.equal(w.mode,'beam');assert.equal(w.Emax,125000);assert.equal(w.reactor,main.id);assert.ok(w.chargeT>840&&w.chargeT<845,'physical main-reactor feed requires about fourteen minutes');near(w.chargeT*w.chargeW*w.efficiency,w.Emax*C.TT);assert.equal(w.ok,true);}
 assert.ok(stats.superweapons.reduce((n,w)=>n+w.chargeW,0)<=C.reactorPower(main)*.6000001);
});

test('separate central barrel muzzles and full machinery survive saving and copying',()=>{
 const restored=C.deserialize(plain(C.serialize(s)));for(const p of guns){const q=restored.parts.find(q=>q.id===p.id),sg=Math.sign(p.c[2]);near(C.partVolume(q),C.partVolume(p),1e-8);assert.deepEqual(plain(C.superweaponAxis(q)),[1,0,0]);const muzzle=C.superweaponMuzzle(q);near(muzzle[0],1260.2);near(muzzle[1],64.9);near(muzzle[2],sg*23.45);assert.equal(C.superweaponOpen(restored,q),true);}
});
