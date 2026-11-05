#!/usr/bin/env node
// Refresh only examples whose recipe uses the replaced 200/500 GT guns.
// Legacy unrelated profiles intentionally retain their stale version so the
// normal runtime worker can rebuild them before fleet use.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),args=process.argv.slice(2),value=flag=>{const i=args.indexOf(flag);return i<0?null:args[i+1];};
const allKeys=['acclamator','arquitens','dreadnaught','lucrehulk','lh3210'],keys=value('--keys')?.split(',').filter(Boolean)||allKeys,outDir=path.resolve(value('--output-dir')||'/tmp/kuat-light-turret-profiles'),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
assert.ok(keys.length&&new Set(keys).size===keys.length&&keys.every(k=>allKeys.includes(k)),'--keys must select unique affected example keys');
function assetHashes(){const x=vm.createContext({});for(const f of ['data/reference.js','data/imperial2.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),x);const a=vm.runInContext('({...YardReferenceData.assets,...YardImperial2Data.assets})',x);return Object.fromEntries(Object.entries(a).map(([k,v])=>[k,hash(JSON.stringify(v))]));}
function runtime(){const cx=vm.createContext({console,performance});for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});return vm.runInContext('({C:Core,R:Rts,D:YardFleetData})',cx);}
function worker(key){
 assert.ok(allKeys.includes(key));const {C,R,D}=runtime(),begin=performance.now(),ship=C.buildDesign(key),built=performance.now();
 C.syncCompartments(ship);C.remount(ship);C.syncCompartments(ship);const stats=C.computeStats(ship),computed=performance.now();
 const {figuresDigest}=require(path.join(root,'tests/helpers/figures-digest.cjs')),digest=figuresDigest(stats),profile=C.fleetProfile(stats,ship.name,ship),profiled=performance.now(),record={...D.designs[key],name:ship.name,p:profile,info:R.designInfo(stats,profile),paint:ship.paint};
 assert.equal(profile.profileVersion,C.FLEET_PROFILE_VERSION);assert.ok(profile.profileVersion>=8);
 const affectedFits=ship.fits.filter(f=>['quad200','quad500'].includes(f.k));const expected={acclamator:12,arquitens:4,dreadnaught:20,lucrehulk:42,lh3210:0};assert.equal(affectedFits.length,expected[key]);
 const report={key,generatedSourceSha256:Object.fromEntries(['js/core.js','data/reference.js','data/imperial2.js'].map(f=>[f,hash(fs.readFileSync(path.join(root,f)))])),assetDependencySha256:Object.fromEntries((key==='arquitens'?['arq_turret_quad500']:['light_quad200']).map(k=>[k,assetHashes()[k]])),buildMs:built-begin,statsMs:computed-built,profileMs:profiled-computed,totalMs:profiled-begin,mass:stats.mass,cost:stats.cost,accelG:stats.accelG,profileVersion:profile.profileVersion,affectedFits:affectedFits.map(f=>({id:f.id,kind:f.k,position:f.p,axis:f.a,float:!!f.float})),warnings:stats.warnings?.map(w=>({level:w.lv,code:w.code,text:w.text}))||[]};
 const result={record,digest,report};
 if(key==='arquitens'){
  const structures=ship.parts.filter(p=>p.k==='struct');assert.ok(structures.every(p=>!['reference','mesh'].includes(p.form)&&!p.skinAsset&&!p.mesh));
  result.blueprint=C.serialize(ship);result.arquitensBuildReport={schemaVersion:1,representation:'native-parametric-parts',sourceSha256:Object.fromEntries(['js/core.js','data/reference.js','data/imperial2.js'].map(f=>[f,hash(fs.readFileSync(path.join(root,f)))])),buildMs:built-begin,statsMs:computed-built,mass:stats.mass,cost:stats.cost,accel:stats.accelG,profileVersion:profile.profileVersion,structureCount:structures.length,structureForms:[...new Set(structures.map(p=>p.form))],structureLayout:structures.map(p=>({id:p.id,label:p.label,form:p.form,center:p.c,size:p.s,loft:p.loft,outline:p.outline,mirror:p.tw})),weapons:ship.fits.map(f=>({id:f.id,kind:f.k,position:f.p,axis:f.a,float:f.float})),engines:profile.propulsion.engines};
 }
 fs.mkdirSync(outDir,{recursive:true});fs.writeFileSync(path.join(outDir,key+'.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(report));
}
async function main(){
 const inputs=Object.fromEntries(['js/core.js','data/reference.js','data/imperial2.js','data/fleet.js'].map(f=>[f,hash(fs.readFileSync(path.join(root,f)))]));
 fs.mkdirSync(outDir,{recursive:true});let next=0;async function queue(){while(next<keys.length){const key=keys[next++];console.log('Building '+key);await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[__filename,'--worker',key,'--output-dir',outDir],{cwd:root,env:process.env,stdio:['ignore','inherit','inherit']});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(key+' worker failed '+code)));});}}
 await Promise.all([queue(),queue()]);
 for(const [file,sha]of Object.entries(inputs))assert.equal(hash(fs.readFileSync(path.join(root,file))),sha,file+' changed during generation; rerun before applying results');
 const fleetPath=path.join(root,'data/fleet.js'),fleetText=fs.readFileSync(fleetPath,'utf8'),cx=vm.createContext({});vm.runInContext(fleetText,cx);const fleet=vm.runInContext('YardFleetData',cx),before=JSON.parse(JSON.stringify(fleet.designs)),figPath=path.join(root,'tests/helpers/example-figures.json'),figures=JSON.parse(fs.readFileSync(figPath,'utf8')),beforeFigures=JSON.parse(JSON.stringify(figures.ships));
 const results=keys.map(k=>JSON.parse(fs.readFileSync(path.join(outDir,k+'.json'),'utf8')));
 for(let i=0;i<keys.length;i++){fleet.designs[keys[i]]=results[i].record;figures.ships[keys[i]]=results[i].digest;}
 const unaffected=Object.keys(fleet.designs).filter(k=>!keys.includes(k));for(const key of unaffected)assert.equal(JSON.stringify(fleet.designs[key]),JSON.stringify(before[key]),key+' unrelated cached record changed');for(const key of Object.keys(figures.ships).filter(k=>!keys.includes(k)))assert.equal(JSON.stringify(figures.ships[key]),JSON.stringify(beforeFigures[key]),key+' unrelated figure digest changed');
 const reportPath=path.join(root,'docs/benchmarks/light-turret-profile-refresh.json'),previous=fs.existsSync(reportPath)?JSON.parse(fs.readFileSync(reportPath,'utf8')):null,baselinePath=value('--provenance-baseline'),baseline=baselinePath?JSON.parse(fs.readFileSync(path.resolve(baselinePath),'utf8')):null,currentAssets=assetHashes(),priorAssets=baseline?.assetRegistrySha256||previous?.assetRegistrySha256,retained=allKeys.filter(k=>!keys.includes(k));
 const changedAssets=priorAssets?Object.keys({...priorAssets,...currentAssets}).filter(k=>priorAssets[k]!==currentAssets[k]):null;
 if(retained.length){
  assert.ok(previous&&priorAssets,'A subset refresh requires existing per-asset provenance, or --provenance-baseline for an older report');
  assert.ok(changedAssets.every(k=>k==='arq_turret_quad500')&&retained.every(k=>k!=='arquitens'),'Only Arquitens may be recomputed after a quad500-only asset correction');
  for(const f of ['js/core.js','data/imperial2.js'])assert.equal(inputs[f],(baseline?.sourceSha256||previous.sourceSha256)[f],f+' changed; do a full affected-example refresh');
 }
 const latestSources=Object.fromEntries(['js/core.js','data/reference.js','data/imperial2.js'].map(f=>[f,inputs[f]])),rows=new Map((previous?.examples||[]).map(r=>[r.key,{...r,generatedSourceSha256:r.generatedSourceSha256||previous.sourceSha256,assetDependencySha256:r.assetDependencySha256||Object.fromEntries((r.key==='arquitens'?['arq_turret_quad500']:['light_quad200']).map(k=>[k,priorAssets?.[k]]))}]));
 for(const r of results)rows.set(r.report.key,r.report);
 for(const k of allKeys)assert.ok(rows.has(k),'Missing prior report row for '+k);
 const firstPass=previous&&!previous.refreshPasses?[{recomputedExamples:previous.affectedExamples,sourceSha256:previous.sourceSha256,method:'Initial full affected-example refresh'}]:null;
 const refreshPass={date:new Date().toISOString(),recomputedExamples:keys,retainedAffectedExamples:retained,sourceSha256:latestSources,changedAssetIds:changedAssets,retentionProof:retained.length?{coreAndImperial2Unchanged:true,otherRegisteredAssetsUnchanged:true,unchangedAssetCount:Object.keys(currentAssets).length-changedAssets.length,retainedRecordSha256:Object.fromEntries(retained.map(k=>[k,hash(JSON.stringify(fleet.designs[k]))])),retainedDigestSha256:Object.fromEntries(retained.map(k=>[k,hash(JSON.stringify(figures.ships[k]))]))}:null};
 const unrelated=Object.keys(fleet.designs).filter(k=>!allKeys.includes(k));
 const report={schemaVersion:2,date:new Date().toISOString(),status:'PASS',profileVersion:results[0].report.profileVersion,changedKinds:['quad200','quad500'],newKinds:['single500','single200','twin200','twin200Fast'],affectedExamples:allKeys,indirectDependency:{key:'lh3210',reason:'Its freighter recipe removes quad200 and credits fm*wm*hm to cargo rooms; the new gun envelope changes hold length even though no quad guns remain.'},sourceSha256:latestSources,sourceHashScope:'Top-level hashes describe the latest refresh pass; each example retains the hashes of its own generation inputs.',assetRegistrySha256:currentAssets,unaffectedCachedRecords:{count:unrelated.length,keys:unrelated,byteIdenticalJSON:true,versionMetadataCarriedForward:false,reason:'Unrelated legacy records were already missing profileVersion; they remain subject to the existing runtime lazy-refresh gate rather than receiving an unverified new version.'},unaffectedFigureDigests:{count:Object.keys(figures.ships).length-allKeys.length,byteIdenticalJSON:true},lastPassUnchangedRecords:{count:unaffected.length,keys:unaffected,byteIdenticalJSON:true},method:'Each selected example is built by Core.buildDesign, synchronized/remounted, computed once, then serialized into both fleetProfile/designInfo and figuresDigest. Two independent worker processes maximum. Subset retention requires unchanged Core, Imperial2 and every registered asset except the corrected quad500.',refreshPasses:[...(previous?.refreshPasses||firstPass||[]),refreshPass],examples:allKeys.map(k=>rows.get(k))};
 const arq=results.find(r=>r.report.key==='arquitens');
 if(args.includes('--apply')){
  const match=fleetText.match(/const YardFleetData=\{.*\};/);assert.ok(match);fs.writeFileSync(fleetPath,fleetText.replace(match[0],'const YardFleetData='+JSON.stringify(fleet)+';'));
  figures.ships=Object.fromEntries(Object.keys(figures.ships).sort().map(k=>[k,figures.ships[k]]));fs.writeFileSync(figPath,JSON.stringify(figures)+'\n');
  if(arq){fs.writeFileSync(path.join(root,'docs/examples/arquitens-native.blueprint.json'),JSON.stringify(arq.blueprint,null,2)+'\n');fs.writeFileSync(path.join(root,'docs/benchmarks/arquitens-native-build.json'),JSON.stringify(arq.arquitensBuildReport,null,2)+'\n');}
  fs.writeFileSync(path.join(root,'docs/benchmarks/light-turret-profile-refresh.json'),JSON.stringify(report,null,2)+'\n');
 }else fs.writeFileSync(path.join(outDir,'refresh-report.json'),JSON.stringify(report,null,2)+'\n');
 console.log('PASS: '+keys.length+' affected profiles/digests; '+unaffected.length+' unrelated cached records untouched.');
}
if(value('--worker'))worker(value('--worker'));else main().catch(e=>{console.error(e);process.exitCode=1;});
