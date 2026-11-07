const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(__dirname,'..'),G=require('../scripts/update-ship-examples.cjs'),{readBlueprint}=require('../scripts/replay-ship-examples.cjs'),{engineWeaponClearance}=require('./helpers/engine-weapon-clearance.cjs'),{C}=G.loadRuntime(root);
test('machinery clearance rejects a real engine body placed in the neutral gun ray',()=>{
 const s=C.newShip({assembly:true,L:500,W:300,H:100},'Independent machine/gun clearance');s.parts=[];s.fits=[];s.detail=0;
 C.placePart(s,'struct',[200,20,0],[260,140,40],{form:'box'},false);const r=C.placeFit(s,'utl',[200,40,0],[0,1,0],0,false,{mountMode:'top'});assert.ok(r.fit,r.err);
 assert.equal(engineWeaponClearance(C,s).passed,true);
 const g=C.authoredTurretGeometry(r.fit),c=C.add(g.muzzles[0],C.mul(g.fw,30)),body={id:999,k:'engineCore',c,d:16,length:20,dir:g.fw,autoFit:false};s.parts.push(body);
 const blocked=engineWeaponClearance(C,s);assert.equal(blocked.passed,false);assert.ok(blocked.failures.some(f=>f.kind==='engine-blocks-neutral-fire'));
 body.c=C.add(c,[0,100,0]);assert.equal(engineWeaponClearance(C,s).passed,true);
});
test('a fitted replacement skin is surveyed using its own actual housing vertices',()=>{
 const s=C.newShip({assembly:true,L:500,W:300,H:100},'Replacement skin clearance');s.parts=[];s.fits=[];s.detail=0;
 C.placePart(s,'struct',[200,20,0],[260,140,40],{form:'box'},false);const r=C.placeFit(s,'utl',[200,40,0],[0,1,0],0,false,{mountMode:'top'});assert.ok(r.fit,r.err);
 const f=r.fit;f.skinAsset=C.FITS.ball720.asset;const a=C.REFERENCE_ASSETS[f.skinAsset],m=C.decodeReference(f.skinAsset),i=a.components[0].firstVertex,q=C.referenceFitPoint(f,Array.from(m.pos.subarray(i*3,i*3+3)));
 s.parts.push({id:999,k:'engineCore',c:q,d:.1,length:.1,dir:[1,0,0],autoFit:false});const proof=engineWeaponClearance(C,s);assert.equal(proof.passed,false);assert.ok(proof.failures.some(f=>f.kind==='gun-mesh-inside-engine'));
});
test('current layout audits distinguish an existing hull mask from a new machinery obstruction',()=>{
 const s=C.newShip({assembly:true,L:500,W:300,H:100},'Existing gun mask');s.parts=[];s.fits=[];s.detail=0;
 C.placePart(s,'struct',[200,20,0],[260,140,40],{form:'box'},false);const r=C.placeFit(s,'utl',[200,40,0],[0,1,0],0,false,{mountMode:'top'});assert.ok(r.fit,r.err);
 const g=C.authoredTurretGeometry(r.fit),wall=C.placePart(s,'struct',C.add(g.muzzles[0],C.mul(g.fw,20)),[3,30,30],{form:'box'},false),body={id:999,k:'engineCore',c:C.add(g.muzzles[0],C.mul(g.fw,50)),d:8,length:10,dir:g.fw,autoFit:false};s.parts.push(body);
 assert.equal(engineWeaponClearance(C,s).passed,false,'the strict historical survey remains available');const masked=engineWeaponClearance(C,s,{ignoreHullMasked:true});assert.equal(masked.passed,true);assert.ok(masked.hullMaskedRays>0);
 s.parts=s.parts.filter(p=>p!==wall);assert.equal(engineWeaponClearance(C,s,{ignoreHullMasked:true}).passed,false,'machinery in an otherwise clear ray is still rejected');
});
test('the published military examples keep enlarged engines clear of actual gun meshes and neutral shots',()=>{
 const report=JSON.parse(fs.readFileSync(path.join(root,'docs/benchmarks/military-engine-acceleration-refit.json')));assert.equal(report.physicalVerification.passed,true);
 for(const key of report.allKeys){const directory=path.join(root,'assets/source',key+'-military-acceleration-factory-blueprints'),manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'))),{blueprint}=readBlueprint(directory,key,manifest),ship=C.deserialize(blueprint),proof=engineWeaponClearance(C,ship);assert.equal(proof.passed,true,key+': '+JSON.stringify(proof.failures.slice(0,5)));assert.ok(proof.bodies>0,key+' actual machinery is surveyed');}
});
