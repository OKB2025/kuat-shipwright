const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{test}=require('node:test');
const {sourcePayload}=require('../scripts/refresh-imperial-layouts.cjs'),E=require('../scripts/stock-engine-source-evidence.cjs'),{C}=require('../scripts/update-ship-examples.cjs').loadRuntime(path.resolve(__dirname,'..')),root=path.resolve(__dirname,'..'),copy=value=>JSON.parse(JSON.stringify(value)),source=key=>E.loadSource(root,key),check=(key,edit)=>{const input=source(key),ship=copy(input.blueprint);edit?.(ship,input);return E.layoutEvidence(C,ship,input,key);};
const allRows=ship=>[...ship.parts,...ship.fits,...ship.hatches],nextId=ship=>Math.max(...allRows(ship).map(row=>row.id))+1;

test('all six authenticated native sources and ordinary save normalizations preserve the complete exterior',()=>{
 assert.deepEqual([...E.keys],['cr90','hammerhead','mc80home','mc80liberty','mc75','mc30c']);const before=fs.readFileSync(path.join(root,'assets/source/ship-example-blueprints/manifest.json')),build=C.buildDesign;C.buildDesign=()=>{throw Error('This evidence must never run a constructor');};
 try{for(const key of E.keys){const input=source(key),payload=sourcePayload(C,input.blueprint);assert.ok(payload.reactorPowerW>0);const raw=E.layoutEvidence(C,input.blueprint,input,key),expected=E.expectedSourceLayout(input,key).blueprint,loaded=C.serialize(C.deserialize(expected)),roundtrip=E.layoutEvidence(C,loaded,input,key);assert.equal(raw.passed,key!=='mc75',key+' unchanged historical source (MC75 declares a new paid grid)');assert.equal(raw.rawPreservation.structures,true);assert.equal(raw.rawPreservation.fittings,true);assert.equal(roundtrip.passed,true,key+' expected layout through production deserializer');assert.equal(raw.expectedCounts.parts,input.manifest.models[key].partCount);assert.equal(raw.expectedCounts.fittings,input.manifest.models[key].fitCount);}}
 finally{C.buildDesign=build;}assert.deepEqual(fs.readFileSync(path.join(root,'assets/source/ship-example-blueprints/manifest.json')),before,'historical provenance is read only');
});

test('new engine internals and internal engineering do not weaken or falsely fail exterior preservation',()=>{
 const result=check('cr90',ship=>{const id=nextId(ship);ship.parts.push({id,k:'engineCore',c:[40,10,0],d:3,length:5,dir:[-1,0,0],ratedInputW:1e20});for(const core of ship.parts.filter(p=>p.k==='engineCore')){core.d*=1.2;core.length=(core.length||1)*1.2;core.ratedInputW=2e20;}for(const nozzle of ship.parts.filter(p=>p.k==='engine')){nozzle.machineryId=id;nozzle.reactor=0;nozzle.nozzleShare=1;}});assert.equal(result.passed,true);assert.ok(result.actualCounts.parts>result.expectedCounts.parts);
});

test('nested hull/mesh array lengths, shape fields and structural inventories cannot drift',()=>{
 assert.equal(check('mc80home',ship=>ship.parts.find(p=>p.form==='hull').hullProfile.stations[0].push(.5)).structuralLayoutPreserved,false,'an appended station field is not a prefix match');
 assert.equal(check('mc30c',ship=>ship.parts.find(p=>p.form==='outline').outline.pop()).structuralLayoutPreserved,false);
 assert.equal(check('cr90',ship=>ship.parts.find(p=>p.k==='struct').s[0]+=.01).structuralLayoutPreserved,false);
 assert.equal(check('hammerhead',ship=>ship.parts.push({...copy(ship.parts.find(p=>p.k==='struct')),id:nextId(ship)})).structuralLayoutPreserved,false);
 assert.equal(check('mc75',ship=>ship.hull.stations.pop()).structuralLayoutPreserved,false);
 assert.equal(check('mc80liberty',ship=>ship.parts.find(p=>p.k==='struct').c[0]=NaN).structuralLayoutPreserved,false);
});

test('all gun poses, native axes, mount offsets, reference-plan arrays and weapon kinds stay protected',()=>{
 assert.equal(check('cr90',ship=>ship.fits[0].p[0]+=.01).allFittingPosesPreserved,false);
 assert.equal(check('cr90',ship=>ship.fits[0].mountAxis+=1).allFittingPosesPreserved,false);
 for(const field of ['frameFlip','frameForward','localForward']){const result=check('cr90',ship=>{ship.fits[0][field]=field==='frameFlip'?true:[0,0,1];});assert.equal(result.allFittingPosesPreserved,false,field+' is a physical orientation field');if(field==='frameFlip')assert.equal(result.fits[0].worldFrameEquivalent,false,'the observed real frame also catches the 180-degree flip');}
 assert.equal(check('hammerhead',ship=>ship.fits[0].mountOffset+=.1).allFittingPosesPreserved,false);
 assert.equal(check('mc80home',ship=>ship.fits.find(f=>f.referencePlan).referencePlan.push(0)).allFittingPosesPreserved,false);
 assert.equal(check('mc80liberty',ship=>ship.fits.find(f=>f.referencePlan).referencePlan[0]+=.1).allFittingPosesPreserved,false);
 assert.equal(check('mc75',ship=>ship.fits[0].k='pd').weaponKindsCorrect,false);
 assert.equal(check('mc30c',ship=>ship.fits.push({...copy(ship.fits[0]),id:nextId(ship)})).allFittingPosesPreserved,false);
});

test('nozzle appearance changes and global ID collisions are rejected even when machinery may change',()=>{
 for(const change of [p=>p.d+=.01,p=>p.c[0]+=.01,p=>p.nozzleLength*=1.01,p=>p.skinAsset='forged-native-bell'])assert.equal(check('hammerhead',ship=>change(ship.parts.find(p=>p.k==='engine'))).nozzleAppearancePreserved,false);
 const result=check('cr90',ship=>ship.parts.push({id:ship.fits[0].id,k:'engineCore',c:[40,10,0],d:2,length:2}));assert.equal(result.uniquePublicIds,false);assert.equal(result.passed,false);
});

test('only exact known defaults and independently frame-equivalent aliases are admitted',()=>{
 const input=source('cr90'),ship=copy(input.blueprint),fit=ship.fits[0];delete fit.float;fit.n=copy(C.fitUp(fit));delete ship.hull.name;ship.hull.deckWidth=.52;ship.hull.belt=.13;const alias=E.layoutEvidence(C,ship,input,'cr90');assert.equal(alias.passed,true);assert.ok(alias.fits[0].acceptedEquivalentNormalizations.includes('normal-from-existing-frame-equivalent-mountAxis'));
 fit.n=[1,0,0];assert.equal(E.layoutEvidence(C,ship,input,'cr90').passed,false,'a different normal is not an alias');
 assert.equal(check('cr90',s=>s.hull.belt=.14).structuralLayoutPreserved,false);assert.equal(check('hammerhead',s=>s.hull.name='Other authored name').structuralLayoutPreserved,false);
 const enabled=check('mc80home',s=>{const f=s.fits.find(f=>f.k==='podAir');f.commandEnabled=true;f.slope=0;delete f.float;});assert.equal(enabled.passed,true);
 assert.equal(check('mc80home',s=>s.fits.find(f=>f.k==='podAir').commandEnabled=false).passed,false);assert.equal(check('mc80home',s=>s.fits.find(f=>f.k==='podAir').slope=.01).passed,false);
});

test('a copied, mutated, mismatched or manifest-replaced baseline cannot authorize its own changes',()=>{
 const input=source('cr90');assert.throws(()=>E.layoutEvidence(C,copy(input.blueprint),copy(input),'cr90'),/loadSource/);assert.throws(()=>E.layoutEvidence(C,copy(input.blueprint),input,'mc75'),/loadSource/);input.blueprint.parts[0].s[0]+=.1;assert.throws(()=>E.layoutEvidence(C,copy(input.blueprint),input,'cr90'),/loadSource/);assert.throws(()=>source('imperial'),/Unsupported/);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'stock-engine-source-auth-')),archive=path.join(dir,'assets/source/ship-example-blueprints');try{fs.mkdirSync(archive,{recursive:true});for(const file of ['manifest.json','cr90.json.gz'])fs.copyFileSync(path.join(root,'assets/source/ship-example-blueprints',file),path.join(archive,file));assert.equal(E.loadSource(dir,'cr90').key,'cr90');const manifest=JSON.parse(fs.readFileSync(path.join(archive,'manifest.json')));manifest.models.cr90.sha256='0'.repeat(64);fs.writeFileSync(path.join(archive,'manifest.json'),JSON.stringify(manifest));assert.throws(()=>E.loadSource(dir,'cr90'),/historical manifest identity/);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});


test('unsaved undefined object fields follow JSON absence while null and nested array lengths remain strict',()=>{
 assert.equal(check('cr90',ship=>{ship.parts.find(p=>p.k==='struct').optionalUnset=undefined;ship.fits[0].n=undefined;ship.parts.find(p=>p.k==='engine').skinAsset=undefined;}).passed,true);
 assert.equal(check('cr90',ship=>ship.parts.find(p=>p.k==='struct').optionalUnset=null).passed,false);
 assert.equal(check('mc80home',ship=>ship.parts.find(p=>p.form==='hull').hullProfile.stations[0].push(undefined)).passed,false);
});


test('the expected-layout API returns an independent authenticated clone without guessed geometry exceptions',()=>{
 const input=source('mc80home'),expected=E.expectedSourceLayout(input,'mc80home');assert.deepEqual(expected.blueprint,input.blueprint);assert.notEqual(expected.blueprint,input.blueprint);assert.deepEqual(expected.transforms,[]);const original=E.layoutEvidence(C,expected.blueprint,input,'mc80home');assert.deepEqual(original.rawPreservation,{structures:true,fittings:true,nozzles:true,publicLayout:true});for(const row of original.structures)assert.equal(row.sourceSha256,row.expectedSha256);for(const row of original.nozzles)assert.equal(row.sourceAppearanceSha256,row.expectedAppearanceSha256);expected.blueprint.parts[0].c[0]+=1;const forged=E.layoutEvidence(C,expected.blueprint,input,'mc80home');assert.equal(forged.passed,false,'a caller cannot authorize its own transform by mutating the returned clone');const row=forged.structures.find(r=>r.id===expected.blueprint.parts[0].id);assert.equal(row.unchanged,false);assert.equal(row.matchesExpected,false);assert.equal(row.sourceSha256,row.expectedSha256);assert.notEqual(row.actualSha256,row.sourceSha256);assert.throws(()=>E.expectedSourceLayout(input,'cr90'),/loadSource/);
});

function reboundPrimary(key){
 const input=source(key),ship=E.expectedSourceLayout(input,key).blueprint,primary=ship.parts.find(p=>p.primaryHull),old=primary.id,id=nextId(ship)+20;primary.id=id;
 for(const fit of ship.fits)if(fit.host===old)fit.host=id;
 for(const hatch of ship.hatches)if(hatch.hullOwner===old)hatch.hullOwner=id;
 return {input,ship,primary,old,id};
}
test('a generated primary ID alias requires exact world skin and correct owned bindings without rewriting reused IDs',()=>{
 const {input,ship,primary,old,id}=reboundPrimary('mc80home');ship.parts.push({id:old,k:'engineCore',c:[40,10,0],d:3,length:5,dir:[-1,0,0],ratedInputW:1e20});
 const result=E.layoutEvidence(C,ship,input);assert.equal(result.passed,true);assert.equal(result.generatedPrimaryHull.accepted,true);assert.equal(result.generatedPrimaryHull.sourceId,old);assert.equal(result.generatedPrimaryHull.actualId,id);assert.equal(result.generatedPrimaryHull.worldTrianglesIdentical,true);assert.ok(result.generatedPrimaryHull.ownedFits.length>50);assert.ok(result.generatedPrimaryHull.ownedFits.every(f=>f.correctOwner&&f.frameEquivalent&&f.boundsEquivalent));
 const row=result.structures.find(r=>r.id===old);assert.equal(row.unchanged,false);assert.equal(row.matchesExpected,true);assert.notEqual(row.sourceSha256,row.expectedSha256);assert.equal(result.rawPreservation.fittings,false);assert.ok(result.fits.some(f=>!f.poseUnchanged&&f.matchesExpected));
 const bad=copy(ship),fit=bad.fits.find(f=>f.host===id);fit.host=old;assert.equal(E.layoutEvidence(C,bad,input).passed,false,'a recycled internal ID cannot own the hull fitting');
 const cut=copy(ship);cut.parts.find(p=>p.id===id).hullData.cuts.push({x:.5});assert.equal(E.layoutEvidence(C,cut,input).passed,false,'a new ID cannot hide geometry edits');
 const duplicate=copy(ship);duplicate.parts.find(p=>p.id===old).primaryHull=true;duplicate.parts.find(p=>p.id===old).k='struct';duplicate.parts.find(p=>p.id===old).form='hull';assert.equal(E.layoutEvidence(C,duplicate,input).generatedPrimaryHull.passed,false);
 const wrongHatch=copy(ship);wrongHatch.hatches[0].hullOwner=old;assert.equal(E.layoutEvidence(C,wrongHatch,input).passed,false);
 const bitChanged=copy(ship);bitChanged.parts.find(p=>p.id===id).c[2]+=1e-13;const bitProof=E.layoutEvidence(C,bitChanged,input);assert.equal(bitProof.generatedPrimaryHull.descriptorEquivalent,true);assert.equal(bitProof.generatedPrimaryHull.worldTrianglesIdentical,false);assert.equal(bitProof.passed,false,'bit-identical world geometry is stricter than the numerical descriptor comparison');
 assert.equal(input.blueprint.parts.find(p=>p.primaryHull).id,old);assert.equal(primary.id,id);
});
test('the MC75 paid framing exception is an exact pinned array and never an exterior or fitting exception',()=>{
 const {input,ship,primary,old}=reboundPrimary('mc75'),expected=E.expectedSourceLayout(input),declared=expected.transforms[0],result=E.layoutEvidence(C,ship,input);
 assert.equal(declared.field,'hullData.framingSamples');assert.equal(declared.from.length,120);assert.equal(declared.to.length,120);assert.equal(declared.sourceSha256,'96fe631434ad0c1abf65e79fc431449d35217299024d4e10f6e6234c36e45dbd');assert.equal(declared.expectedSha256,'b50b7cae4d450e1bc612cd8f518b65da239112b91cd593edc7428896384db6c9');assert.equal(result.passed,true);assert.equal(result.generatedPrimaryHull.worldTrianglesIdentical,true);assert.equal(result.generatedPrimaryHull.exactDeclaredFraming,true);assert.equal(result.rawPreservation.structures,false);assert.equal(input.blueprint.parts.find(p=>p.id===old).hullData.framingSamples[0][0],declared.from[0][0]);
 const perturbed=copy(ship);perturbed.parts.find(p=>p.id===primary.id).hullData.framingSamples[0][0]+=1e-14;const denied=E.layoutEvidence(C,perturbed,input);assert.equal(denied.generatedPrimaryHull.descriptorEquivalent,true,'ordinary float tolerance alone would accept this drift');assert.equal(denied.generatedPrimaryHull.exactDeclaredFraming,false);assert.equal(denied.passed,false,'the declared literal/digest admits no extra array changes');
 const gun=copy(ship);gun.fits[0].p[0]+=.01;assert.equal(E.layoutEvidence(C,gun,input).passed,false);
 const outer=copy(ship);outer.parts.find(p=>p.id===primary.id).hullProfile.stations[0][1]*=1.0001;assert.equal(E.layoutEvidence(C,outer,input).passed,false);
});

test('live runtime objects with cyclic private caches retain the same strict primary identity evidence',()=>{
 const {input,ship,id}=reboundPrimary('mc80home'),live=C.deserialize(ship),primary=live.parts.find(p=>p.id===id);C.syncCompartments(live);C.hullStructureGeometry(live,primary);primary._solidCutShip=live;live._cycle=live;live.fits[0]._ownerCache=live;
 const proof=E.layoutEvidence(C,live,input);assert.equal(proof.passed,true);assert.equal(proof.generatedPrimaryHull.worldTrianglesIdentical,true);assert.equal(primary._solidCutShip,live,'copying for the independent proof cannot mutate actual caches');
 live.fits.find(f=>f.host===id).host=input.blueprint.parts.find(p=>p.primaryHull).id;assert.equal(E.layoutEvidence(C,live,input).passed,false,'private-cache sanitizing cannot repair a wrong observed binding');
});
