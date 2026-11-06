const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{test}=require('node:test');
const root=path.resolve(__dirname,'..'),directory=path.join(root,'assets/source/ship-example-blueprints'),manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'))),{readBlueprint,compareBlueprintInputs}=require('../scripts/replay-ship-examples.cjs'),{loadRuntime}=require('../scripts/update-ship-examples.cjs'),sha=value=>crypto.createHash('sha256').update(value).digest('hex'),plain=v=>JSON.parse(JSON.stringify(v));
let runtime;const core=()=>runtime||(runtime=loadRuntime(root).C),source=key=>readBlueprint(directory,key,manifest).blueprint,small=()=>({hull:{assembly:true,L:100,W:100,H:100},parts:[],fits:[]});

test('all 27 portable factory snapshots contain authenticated geometry and equipment, without cached physics',()=>{
 const {C}=loadRuntime(root);assert.deepEqual(Object.keys(manifest.models).sort(),Array.from(C.SHIP_SYSTEM_REFIT_KEYS).sort());assert.equal(manifest.runtimeLoaded,false);assert.equal(manifest.factorySourceSha256['js/core.js'],'7bc4167cae112ae764acb7cfa700e9d720a7e86f891e8fd558f2b9b1559f132e');
 const forbidden=new Set(['stats','profile','powerProfile','modules','surfaceMesh','propulsion','info','fleetProfile']),walk=(value,where)=>{if(Array.isArray(value)){for(const [i,v]of value.entries())walk(v,where+'['+i+']');}else if(value&&typeof value==='object')for(const [key,v]of Object.entries(value)){assert.equal(key.startsWith('_')||forbidden.has(key),false,where+'.'+key+' must not hydrate old engineering results');walk(v,where+'.'+key);}};
 for(const [key,record]of Object.entries(manifest.models)){
  const source=readBlueprint(directory,key,manifest),packed=source.fileBytes;assert.equal(packed.subarray(0,4).toString('hex'),'1f8b0800');assert.equal(packed.readUInt32LE(4),0,'gzip timestamps cannot vary between archives');assert.equal(sha(source.raw),record.sha256);assert.equal(sha(packed),record.gzipSha256);assert.equal(source.raw.length,record.uncompressedBytes);assert.equal(packed.length,record.compressedBytes);assert.equal(source.blueprint.parts.length,record.partCount);assert.equal(source.blueprint.fits.length,record.fitCount);walk(source.blueprint,key);
  assert.equal(record.factoryEvidence.originalEngineOutlets.length,source.blueprint.parts.filter(p=>p.k==='engine').length);assert.ok(record.factoryEvidence.baselinePowerW>0);
 }
});

test('window defaults are recorded without concealing an explicit command setting',()=>{
 const C=core(),before=small();before.fits=[source('mc80home').fits.find(f=>f.id===78)];const after=plain(before);after.fits[0].slope=0;after.fits[0].commandEnabled=true;const comparison=compareBlueprintInputs(C,before,after);assert.equal(comparison.rawComparison.withinTolerance,false);assert.equal(comparison.physicalInputEquivalent,true);assert.equal(comparison.acceptedEquivalentNormalizations.length,2);
 const disabled=plain(before);disabled.fits[0].commandEnabled=false;assert.equal(compareBlueprintInputs(C,disabled,after).physicalInputEquivalent,false,'an explicitly disabled command station cannot silently turn on');
 const ordinary=small();ordinary.fits=[source('imperial').fits.find(f=>f.k==='pd')];const changed=plain(ordinary);changed.fits[0].commandEnabled=true;assert.equal(compareBlueprintInputs(C,ordinary,changed).physicalInputEquivalent,false,'the exception applies only to known window equipment');
});

test('room diameter normalization requires identical real geometry and capacity',()=>{
 const C=core();for(const [key,id]of [['venator',93],['mandator2',268]]){const before=small();before.parts=[source(key).parts.find(p=>p.id===id)];const after=plain(before);after.parts[0].d=Math.cbrt(after.parts[0].room.reduce((n,v)=>n*v,1));const comparison=compareBlueprintInputs(C,before,after);assert.equal(comparison.physicalInputEquivalent,true);const proof=comparison.acceptedEquivalentNormalizations.find(p=>p.type==='room-derived-display-diameter');assert.ok(proof);assert.ok(proof.exactGeometryAndCapacity.triangleFloat32Sha256);if(id===268)assert.ok(proof.exactGeometryAndCapacity.reactorPowerW>0);else assert.ok(proof.exactGeometryAndCapacity.hangarCapacity>0);
  const expanded=plain(after);expanded.parts[0].room[2]*=1.01;expanded.parts[0].d=Math.cbrt(expanded.parts[0].room.reduce((n,v)=>n*v,1));assert.equal(compareBlueprintInputs(C,before,expanded).physicalInputEquivalent,false,'a larger actual room cannot pass as a display normalization');
  const arbitrary=plain(after);arbitrary.parts[0].d+=1;assert.equal(compareBlueprintInputs(C,before,arbitrary).physicalInputEquivalent,false,'the replacement diameter must match the exact loader formula');
 }
});

test('assembly guide defaults and default shield control leave the physical design explicit',()=>{
 const C=core(),before=source('cr90'),after=plain(before);delete after.hull.name;after.hull.deckWidth=.52;after.hull.belt=.13;const comparison=compareBlueprintInputs(C,before,after);assert.equal(comparison.physicalInputEquivalent,true);assert.ok(comparison.acceptedEquivalentNormalizations.some(p=>p.type==='unused-assembly-guide-preset-label'));
 const authored=plain(before);authored.hull.name='Custom authored name';assert.equal(compareBlueprintInputs(C,authored,after).physicalInputEquivalent,false,'an arbitrary author label is not a preset default');
 const owned=small();owned.parts=[{id:1,k:'struct',form:'hull'}];const changed=plain(owned);changed.hull.deckWidth=.52;assert.equal(compareBlueprintInputs(C,owned,changed).physicalInputEquivalent,false,'a real hull cannot be treated as an unused guide');
 const shield=small(),normal=plain(shield);normal.shieldTarget=1;assert.equal(compareBlueprintInputs(C,shield,normal).physicalInputEquivalent,true);shield.shieldTarget=.8;assert.equal(compareBlueprintInputs(C,shield,normal).physicalInputEquivalent,false);
});

test('a normal alias must match the existing authored tilt and preserve its frame and bounds',()=>{
 const C=core(),before=small();before.fits=[source('arquitens').fits.find(f=>f.tilt&&!Object.hasOwn(f,'n'))];assert.ok(before.fits[0]);const after=plain(before);after.fits[0].n=after.fits[0].tilt.slice();const comparison=compareBlueprintInputs(C,before,after);assert.equal(comparison.physicalInputEquivalent,true);assert.equal(comparison.acceptedEquivalentNormalizations[0].type,'normal-from-existing-tilt');const changed=plain(after);changed.fits[0].n[0]+=.01;assert.equal(compareBlueprintInputs(C,before,changed).physicalInputEquivalent,false);
});

test('only a false shell default may disappear',()=>{
 const C=core(),before=small();before.parts=[source('munificent').parts.find(p=>p.id===3)];const after=plain(before);delete after.parts[0].shellFlip;assert.equal(compareBlueprintInputs(C,before,after).physicalInputEquivalent,true);const flipped=plain(before);flipped.parts[0].shellFlip=true;assert.equal(compareBlueprintInputs(C,flipped,after).physicalInputEquivalent,false);
});

test('support roundoff requires bounded world ULPs and identical world Float32 geometry',()=>{
 const C=core(),before=small();before.fits=[source('mandator2').fits[368]];const fit=before.fits[0];assert.ok(fit.mountSupport);const ulp=2**(Math.floor(Math.log2(Math.max(1,...fit.p.map(Math.abs))))-52),shift=multiple=>{const after=plain(before),f=after.fits[0],delta=multiple*ulp;f.base+=delta;f.low+=delta;f.mountSupport.top+=delta;for(const poly of f.mountSupport.polys)for(const point of poly)point[2]+=delta;return after;};
 const comparison=compareBlueprintInputs(C,before,shift(2));assert.equal(comparison.rawComparison.withinTolerance,false);assert.equal(comparison.physicalInputEquivalent,true);const proof=comparison.acceptedEquivalentNormalizations.find(p=>p.type==='derived-support-roundoff');assert.ok(proof.worldFloat32Sha256);assert.ok(proof.maximumWorldUlps<=4);assert.equal(compareBlueprintInputs(C,before,shift(8)).physicalInputEquivalent,false,'larger changes are not hidden merely because the renderer rounds them');
});

test('a modified snapshot cannot pass the manifest checksum gate',()=>{
 const modified=JSON.parse(JSON.stringify(manifest));modified.models.imperial.canonicalSha256='0'.repeat(64);assert.throws(()=>readBlueprint(directory,'imperial',modified),/checksum mismatch/);
});

test('an exact-world support rebase preserves both meshes and rejects actual pose or topology changes',()=>{
 const C=core(),before=small();before.fits=[source('subjugator').fits.find(f=>f.id===669)];const original=before.fits[0],up=C.fitFrameOf(plain(original)).up,rebase=delta=>{const after=plain(before),fit=after.fits[0];fit.p=C.add(fit.p,C.mul(up,delta));fit.base-=delta;fit.low-=delta;fit.mountSupport.top-=delta;for(const poly of fit.mountSupport.polys)for(const point of poly)point[2]-=delta;return after;};
 const after=rebase(2.0463630789890885e-12),comparison=compareBlueprintInputs(C,before,after);assert.equal(comparison.rawComparison.withinTolerance,false);assert.equal(comparison.physicalInputEquivalent,true);const proof=comparison.acceptedEquivalentNormalizations.find(p=>p.type==='exact-world-support-rebase');assert.ok(proof);assert.ok(proof.worldDoubleSha256&&proof.worldFloat32Sha256);assert.equal(proof.supportVolumeBeforeM3,proof.supportVolumeAfterM3);assert.equal(proof.anchorComparison.withinTolerance,true);
 const moved=plain(after);moved.fits[0].p[0]+=.01;assert.equal(compareBlueprintInputs(C,before,moved).physicalInputEquivalent,false,'an actual world pose change must not pass');
 assert.equal(compareBlueprintInputs(C,before,rebase(.125)).physicalInputEquivalent,false,'a nontrivial anchor rebase fails the unchanged existing numeric check');
 const reshaped=plain(after);reshaped.fits[0].mountSupport.top+=.01;assert.equal(compareBlueprintInputs(C,before,reshaped).physicalInputEquivalent,false,'changed physical support geometry must not pass');
 const topology=plain(after);topology.fits[0].mountSupport.polys[0].push(topology.fits[0].mountSupport.polys[0].at(-1).slice());assert.equal(compareBlueprintInputs(C,before,topology).physicalInputEquivalent,false,'even an extra coincident point changes the required support topology');
 const unrelated=plain(after);unrelated.fits[0].chargeSalvos=7;assert.equal(compareBlueprintInputs(C,before,unrelated).physicalInputEquivalent,false,'unrelated blueprint fields still use the strict remaining-field comparison');
});

test('the selected fresh Executor has a separate authenticated public blueprint',()=>{
 const directory=path.join(root,'assets/source/current-factory-blueprints'),current=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'))),report=JSON.parse(fs.readFileSync(path.join(root,'docs/benchmarks/ship-examples-after.json'))),row=report.models.find(m=>m.key==='executor'),input=readBlueprint(directory,'executor',current),record=current.models.executor;
 assert.equal(current.runtimeLoaded,false);assert.equal(current.factoryGeneration.method,'fresh-factory');assert.equal(row.generation.method,'fresh-factory');assert.deepEqual(current.factorySourceSha256,report.sourceSha256);assert.equal(input.canonicalSha256,row.generation.outputCanonicalSha256);assert.equal(record.gzipSha256,row.generation.outputGzipSha256);assert.equal(record.sha256,row.generation.outputRawSha256);assert.equal(record.partCount,input.blueprint.parts.length);assert.equal(record.partCount,Object.values(row.partsByKind).reduce((n,v)=>n+v,0));assert.equal(record.fitCount,input.blueprint.fits.length);
 const forbidden=new Set(['stats','profile','powerProfile','modules','surfaceMesh','propulsion','info','fleetProfile']),walk=value=>{if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')for(const [key,v]of Object.entries(value)){assert.equal(key.startsWith('_')||forbidden.has(key),false,'the factory archive stores actual public design inputs only');walk(v);}};walk(input.blueprint);
 assert.equal(manifest.factorySourceSha256['js/core.js'],'7bc4167cae112ae764acb7cfa700e9d720a7e86f891e8fd558f2b9b1559f132e','the historical 27-source archive remains unchanged');assert.equal(report.generationMethods.savedBlueprintReplays,26);assert.equal(report.generationMethods.currentFactoryBuilds,1);assert.equal(report.portableVerification.verified,true);assert.equal(report.physicalVerification.passed,true);
});
