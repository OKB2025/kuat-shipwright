const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib'),assert=require('node:assert/strict'),{test}=require('node:test');
const {layoutEvidence,jointEvidence,EXPECTED}=require('../scripts/mandator-layout-evidence.cjs');
const root=path.resolve(__dirname,'..'),cx=vm.createContext({console,performance});for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});const C=vm.runInContext('Core',cx),plain=v=>JSON.parse(JSON.stringify(v));
const archive=process.env.KS_MANDATOR_LAYOUT_BLUEPRINT||path.join(root,'assets/source/mandator-battery-layout-factory-blueprints/mandator2.json.gz');
let native,proof;function current(){if(!native){const bytes=fs.readFileSync(archive);native=JSON.parse(archive.endsWith('.gz')?zlib.gunzipSync(bytes):bytes.toString());
 // v24 The archive carries the retired Executor bridge; survey it as a load gives it today (an Imperial bridge in its place).
 native=plain(C.serialize(C.deserialize(native)));}return native;}function currentProof(){return proof??=(layoutEvidence(C,plain(current())));}
const near=(a,b,eps=1e-8)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=eps,`${a} != ${b}`),damaging=ship=>ship.fits.filter(f=>{const d=C.fitSpec(f);return d.cat==='w'&&!d.msl&&(d.tt||0)+(d.ion||0)>0;}),counts=ship=>Object.fromEntries(Object.entries(damaging(ship).reduce((out,f)=>(out[f.k]=(out[f.k]||0)+1,out),{})).sort());

// These checks keep the archived v23 layout (499 guns, 317,520 TT) verifiable. The v24 example follows
// the user's design instead; tests/mandator-example-refit.cjs covers it.
test('the archived v23 Mandator combines the batteries without changing main/ion or per-barrel PD energy',()=>{
 let mainIon=0,pointDefence=0,defenceBarrels=0;for(const [k,n]of Object.entries(EXPECTED)){const s=C.fitSpec({k}),volley=n*((s.tt||0)+(s.ion||0));if(k==='pd'||k==='monCalPD'){pointDefence+=volley;defenceBarrels+=n*s.barrels;near(s.boltTT,1e-7,1e-15);}else mainIon+=volley;}
 near(mainIon,317520,1e-8);near(pointDefence,.00005,1e-12);assert.equal(defenceBarrels,500);assert.equal(Object.values(EXPECTED).reduce((a,b)=>a+b,0),499);assert.equal(C.fitSpec({k:'quad175'}).barrels,4);assert.equal(C.fitSpec({k:'ball175QuadIon'}).barrels,4);
});

test('the actual published Mandator has clear batteries, compact foundations and balanced side ball mounts',()=>{
 const p=currentProof();assert.equal(p.passed,true,p.failures.join(', '));assert.deepEqual(counts(current()),Object.fromEntries(Object.entries(EXPECTED).sort()));assert.equal(p.muzzleCount,1050);assert.ok(p.sampledPoints>100000);
 assert.deepEqual(p.sideIonCounts,{port:7,starboard:7});assert.ok(p.rows.every(r=>r.supportBodyRatio<=1+1e-6));assert.ok(p.largestFoundations[0].supportBodyRatio<=1+1e-6);for(const r of p.rows.filter(r=>r.zone==='port'||r.zone==='starboard')){assert.equal(r.ballHousing,true);assert.equal(r.joint.passed,true);assert.equal(r.buriedAbovePlane,0);assert.deepEqual(r.buriedMuzzles,[]);assert.deepEqual(r.blockedRays,[]);}
});

function flatGun(){
 const ship=C.newShip({assembly:true,L:500,W:300,H:100},'Independent battery contact control');ship.parts=[];ship.fits=[];ship.detail=0;C.placePart(ship,'struct',[200,20,0],[260,140,40],{form:'box'},false);const placed=C.placeFit(ship,'utl',[200,40,0],[0,1,0],0,false,{mountMode:'top'});assert.ok(placed.fit,placed.err);return {ship,fit:placed.fit};
}
test('the geometry survey rejects visible burial and real tall foundations on an independent flat hull',()=>{
 const {ship,fit}=flatGun(),clean=layoutEvidence(C,ship);assert.equal(clean.checks.visibleBodiesOutsideStructure,true);assert.equal(clean.checks.muzzlesOutsideStructure,true);assert.equal(clean.checks.completeBaseFootprintsAboveStructure,true);
 fit.p[1]-=20;const buried=layoutEvidence(C,ship);assert.equal(buried.checks.visibleBodiesOutsideStructure,false);assert.ok(buried.rows[0].buriedAbovePlane>0);assert.equal(buried.checks.muzzlesOutsideStructure,false);
 const high=flatGun();high.fit.ped=high.fit.ped+30;const tower=layoutEvidence(C,high.ship);assert.equal(tower.checks.compactFoundations,false);assert.ok(tower.rows[0].supportBodyRatio>1);
});

test('an obsolete twin ion or duplicated heavy emplacement cannot pass the current layout guard',()=>{
 const wrong=plain(current()),ion=wrong.fits.find(f=>f.k==='ball175QuadIon');ion.k='ion';const changed=layoutEvidence(C,wrong);assert.equal(changed.checks.batteryCounts,false);assert.equal(changed.checks.sideSphericalIons,false);
 const duplicated=plain(current()),main=duplicated.fits.filter(f=>f.k==='utl');Object.assign(main[1],plain({...main[0],id:main[1].id}));const crowded=layoutEvidence(C,duplicated);assert.equal(crowded.checks.heavyMountsSeparated,false);assert.ok(crowded.crowdedHeavyMounts.some(pair=>pair.a===main[0].id&&pair.b===main[1].id));assert.equal(currentProof().passed,true,'the source blueprint is not mutated by the negative controls');
});

test('side ball pitch keeps the neutral pose in arc, valid rotation matrices and the same embedded centre after saving',()=>{
 for(const k of ['ball720','ball175Quad','ball175QuadIon','monCalPD']){const source=current().fits.find(f=>f.k===k),f=plain(source),a=C.REFERENCE_ASSETS[C.FITS[k].asset],g=C.authoredTurretGeometry(f),result=jointEvidence(C,f,g,a);assert.equal(result.passed,true,k);assert.equal(C.authoredTurretInArc(g,g.fw),true);near(result.embedding.diameterFraction,1/3,1e-7);assert.ok(g.restElevation>0);
  const custom=C.newShip({assembly:true,L:500,W:300,H:100},'Saved side ball control');custom.parts=[];custom.fits=[f];const loaded=C.deserialize(C.serialize(custom)),other=C.authoredTurretGeometry(loaded.fits[0]);assert.deepEqual(plain(other),plain(g),k+' saved mount and firing frame');
 }
});

test('loading the old 525-battery Mandator save preserves its authored twin guns and placement',()=>{
 const old=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'assets/source/ship-example-blueprints/mandator2.json.gz')))),before=damaging(old).map(f=>({id:f.id,k:f.k,p:f.p,assetPitch:f.assetPitch,assetYaw:f.assetYaw})),loaded=C.deserialize(plain(old)),after=damaging(loaded).map(f=>({id:f.id,k:f.k,p:f.p,assetPitch:f.assetPitch,assetYaw:f.assetYaw}));
 assert.equal(before.length,525);assert.equal(after.length,525);assert.deepEqual(plain(after),plain(before));assert.deepEqual(counts(loaded),{ion:28,pd:250,stl:44,utl:203});
});
