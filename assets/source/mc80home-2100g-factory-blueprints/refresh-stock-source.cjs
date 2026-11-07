// Authenticated exterior guards for engine-only refits of six stock examples.
// No constructors, statistics, routing or historical artifact writes occur here.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),P=require('./replay-ship-examples.cjs');
const ARCHIVE='assets/source/ship-example-blueprints',TOLERANCE=1e-12,SOURCE_CORE='7bc4167cae112ae764acb7cfa700e9d720a7e86f891e8fd558f2b9b1559f132e';
const SOURCES=Object.freeze({
 cr90:'967f47f07d44a959ee6039a357bdd7e6fae0507f333eded659972fb97d0f22f9',
 hammerhead:'898b5a66ac2f02fb91bbc19078d15dced295ab48493d546e1bad2da4623ee280',
 mc80home:'7aa1d1fc9355e884d1da6640d9d403894b033bf2457ab339539fe0e09cb9321a',
 mc80liberty:'dfc8144ff37cc4ccd13b6225214d228442f3c68a38ef65f6a0df5f1a8c2ae7f8',
 mc75:'ab21aae6f39781665cb9d35f0da591ddd606706da23d5d3061a89a522748da4c',
 mc30c:'222606ad156dc67a05a32ca7a8409b1ec02b4c412ffd517e4849802a4e691868'
});
// The MC75 primary is materialized before engine-only internal refitting now.
// Its 120 paid framing samples are an explicitly approved derived grid, not
// an exterior-geometry exception. Both arrays remain pinned by exact digest.
const MC75_FRAMING_SOURCE_SHA='96fe631434ad0c1abf65e79fc431449d35217299024d4e10f6e6234c36e45dbd';
const MC75_FRAMING_EXPECTED_SHA='b50b7cae4d450e1bc612cd8f518b65da239112b91cd593edc7428896384db6c9';
const MC75_FRAMING_EXPECTED=[[0.0035909874572766496,0.008338150325477795],[0.011929137782754444,0.008338150325477795],[0.020267288108232237,0.008338150325477795],[0.028605438433710034,0.008338150325477795],[0.03694358875918782,0.008338150325477795],[0.04528173908466562,0.008338150325477795],[0.053619889410143416,0.008338150325477795],[0.06195803973562121,0.008338150325477795],[0.07029619006109901,0.008338150325477795],[0.0786343403865768,0.008338150325477795],[0.0869724907120546,0.008338150325477795],[0.09531064103753238,0.008338150325477795],[0.10364879136301018,0.008338150325477795],[0.11198694168848798,0.008338150325477795],[0.12032509201396578,0.008338150325477795],[0.12866324233944357,0.008338150325477795],[0.13700139266492137,0.008338150325477795],[0.14533954299039914,0.008338150325477795],[0.15367769331587694,0.008338150325477795],[0.16201584364135474,0.008338150325477795],[0.17035399396683254,0.008338150325477795],[0.17869214429231034,0.008338150325477795],[0.18703029461778814,0.008338150325477795],[0.1953684449432659,0.008338150325477795],[0.2037065952687437,0.008338150325477795],[0.21204474559422154,0.008338150325477795],[0.22038289591969934,0.008338150325477795],[0.22872104624517708,0.008338150325477795],[0.23705919657065488,0.008338150325477795],[0.24539734689613268,0.008338150325477795],[0.2537354972216105,0.008338150325477795],[0.2620736475470883,0.008338150325477795],[0.27041179787256603,0.008338150325477795],[0.2787499481980439,0.008338150325477795],[0.2870880985235217,0.008338150325477795],[0.2954262488489995,0.008338150325477795],[0.3037643991744773,0.008338150325477795],[0.31210254949995503,0.008338150325477795],[0.32044069982543283,0.008338150325477795],[0.32877885015091063,0.008338150325477795],[0.33711700047638843,0.008338150325477795],[0.34545515080186623,0.008338150325477795],[0.35379330112734403,0.008338150325477795],[0.3621314514528218,0.008338150325477795],[0.37046960177829963,0.008338150325477795],[0.37880775210377743,0.008338150325477795],[0.38714590242925523,0.008338150325477795],[0.39548405275473303,0.008338150325477795],[0.4038222030802108,0.008338150325477795],[0.4121603534056886,0.008338150325477795],[0.4204985037311664,0.008338150325477795],[0.4288366540566442,0.008338150325477795],[0.4371748043821219,0.008338150325477795],[0.4455129547075998,0.008338150325477795],[0.4538511050330775,0.008338150325477795],[0.4621892553585554,0.008338150325477795],[0.4705274056840332,0.008338150325477795],[0.4788655560095109,0.008338150325477795],[0.4872037063349888,0.008338150325477795],[0.4955418566604665,0.008338150325477795],[0.5038800069859444,0.008338150325477795],[0.5122181573114221,0.008338150325477795],[0.5205563076368999,0.008338150325477795],[0.5288944579623778,0.008338150325477795],[0.5372326082878555,0.008338150325477795],[0.5455707586133334,0.008338150325477795],[0.5539089089388111,0.008338150325477795],[0.5622470592642889,0.008338150325477795],[0.5705852095897667,0.008338150325477795],[0.5789233599152445,0.008338150325477795],[0.5872615102407223,0.008338150325477795],[0.5955996605662001,0.008338150325477795],[0.6039378108916779,0.008338150325477795],[0.6122759612171557,0.008338150325477795],[0.6206141115426335,0.008338150325477795],[0.6289522618681113,0.008338150325477795],[0.6372904121935891,0.008338150325477795],[0.6456285625190668,0.008338150325477795],[0.6539667128445447,0.008338150325477795],[0.6623048631700224,0.008338150325477795],[0.6706430134955003,0.008338150325477795],[0.678981163820978,0.008338150325477795],[0.6873193141464559,0.008338150325477795],[0.6956574644719336,0.008338150325477795],[0.7039956147974114,0.008338150325477795],[0.7123337651228893,0.008338150325477795],[0.720671915448367,0.008338150325477795],[0.7290100657738449,0.008338150325477795],[0.7373482160993226,0.008338150325477795],[0.7456863664248004,0.008338150325477795],[0.7540245167502782,0.008338150325477795],[0.762362667075756,0.008338150325477795],[0.7707008174012338,0.008338150325477795],[0.7790389677267116,0.008338150325477795],[0.7873771180521894,0.008338150325477795],[0.7957152683776672,0.008338150325477795],[0.804053418703145,0.008338150325477795],[0.8123915690286228,0.008338150325477795],[0.8207297193541006,0.008338150325477795],[0.8290678696795782,0.008338150325477795],[0.8374060200050562,0.008338150325477795],[0.8457441703305338,0.008338150325477795],[0.8540823206560116,0.008338150325477795],[0.8624204709814896,0.008338150325477795],[0.8707586213069674,0.008338150325477795],[0.879096771632445,0.008338150325477795],[0.8874349219579228,0.008338150325477795],[0.8957730722834006,0.008338150325477795],[0.9041112226088786,0.008338150325477795],[0.9124493729343564,0.008338150325477795],[0.920787523259834,0.008338150325477795],[0.9291256735853118,0.008338150325477795],[0.9374638239107895,0.008338150325477795],[0.9458019742362676,0.008338150325477795],[0.9541401245617452,0.008338150325477795],[0.962478274887223,0.008338150325477795],[0.9708164252127007,0.008338150325477795],[0.9791545755381785,0.008338150325477795],[0.9874927258636564,0.008338150325477795],[0.9958308761891342,0.008338150325477795]];
const authenticated=new WeakMap(),sha=value=>crypto.createHash('sha256').update(value).digest('hex'),copy=value=>JSON.parse(JSON.stringify(value,(key,item)=>key.startsWith('_')?undefined:item));
function publicValue(value){if(Array.isArray(value))return value.map(publicValue);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).filter(key=>!key.startsWith('_')&&value[key]!==undefined).map(key=>[key,publicValue(value[key])]));return value;}
function stable(value){if(Array.isArray(value))return '['+value.map(stable).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).filter(key=>!key.startsWith('_')&&value[key]!==undefined).sort().map(key=>JSON.stringify(key)+':'+stable(value[key])).join(',')+'}';return JSON.stringify(value);}
function equivalent(a,b){
 if(Object.is(a,b))return true;
 if(typeof a==='number'&&typeof b==='number')return Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=Math.max(1,Math.abs(a),Math.abs(b))*TOLERANCE;
 if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,i)=>equivalent(value,b[i]));
 if(a&&b&&typeof a==='object'&&typeof b==='object'){const aa=Object.keys(a).sort(),bb=Object.keys(b).sort();return aa.length===bb.length&&aa.every((key,i)=>key===bb[i]&&equivalent(a[key],b[key]));}
 return false;
}
function differences(a,b,prefix='',limit=6,out=[]){
 if(out.length>=limit||equivalent(a,b))return out;
 if(Array.isArray(a)&&Array.isArray(b)){if(a.length!==b.length)out.push(prefix+'.length');for(let i=0;i<Math.min(a.length,b.length)&&out.length<limit;i++)differences(a[i],b[i],prefix+'['+i+']',limit,out);}
 else if(a&&b&&typeof a==='object'&&typeof b==='object')for(const key of new Set([...Object.keys(a),...Object.keys(b)])){if(out.length>=limit)break;differences(a[key],b[key],prefix+'.'+key,limit,out);}
 else out.push(prefix);return out;
}
const FIT_FIELDS=['id','k','p','a','n','tilt','yaw','pitch','roll','assetYaw','mountAxis','mountOffset','frameFlip','frameForward','localForward','host','local','localNormal','mountMode','localMount','tw','vt','ped','pedSize','width','height','depth','scale','skinAsset','skinSize','batteryZone','commandEnabled','commandDepth','commandHeight','chargeDepth','mount','legacyMissileMount','launcherCols','launcherRows','launcherEmbedded','launchYaw','launchPitch','launcherBlocked','slope','base','low','mountSupport','float','referencePlan'];
const NOZZLE_FIELDS=['id','k','c','d','dir','nozzleLength','skinAsset','skinAnchor','skinDiameter','skinAxial','skinSize','bodyLength','bodyRadius','engineLength','roll','yaw','pitch','equipmentId','tw','vt','label'];
const LAYOUT_FIELDS=['hull','hullStructureVersion','cuts','trenches','solidCuts','subs','hatches','armor','hullSkin','hullBands','paint','lights','engineGlow'];
const pick=(value,fields)=>value?Object.fromEntries(fields.filter(key=>Object.hasOwn(value,key)&&value[key]!==undefined).map(key=>[key,publicValue(value[key])])):null;
function uniqueIds(rows){return Array.isArray(rows)&&rows.every(row=>row&&Number.isSafeInteger(row.id)&&row.id>0)&&new Set(rows.map(row=>row.id)).size===rows.length;}
function sourceCounts(blueprint){return {parts:blueprint.parts.length,structures:blueprint.parts.filter(part=>part.k==='struct').length,fittings:blueprint.fits.length,nozzles:blueprint.parts.filter(part=>part.k==='engine').length,hatches:blueprint.hatches?.length||0};}
function loadSource(root,key){
 if(!Object.hasOwn(SOURCES,key))throw Error('Unsupported stock engine source: '+key);
 const directory=path.join(root,ARCHIVE),manifestPath=ARCHIVE+'/manifest.json',manifestBytes=fs.readFileSync(path.join(root,manifestPath)),manifest=JSON.parse(manifestBytes),record=manifest.models?.[key];
 if(manifest.kind!=='serialized-ship-blueprint-source-snapshots'||manifest.factorySourceSha256?.['js/core.js']!==SOURCE_CORE||record?.file!==key+'.json.gz'||record.sha256!==SOURCES[key])throw Error(key+': the known historical manifest identity changed');
 const {blueprint,raw}=P.readBlueprint(directory,key,manifest),counts=sourceCounts(blueprint);
 if(sha(raw)!==SOURCES[key]||blueprint.reference!==key||counts.parts!==record.partCount||counts.fittings!==record.fitCount||!counts.structures||!counts.nozzles||!uniqueIds([...blueprint.parts,...blueprint.fits,...(blueprint.hatches||[])]))throw Error(key+': historical source inventory is invalid');
 const inventory={structures:blueprint.parts.filter(part=>part.k==='struct').map(publicValue),fits:blueprint.fits.map(fit=>pick(fit,FIT_FIELDS)),nozzles:blueprint.parts.filter(part=>part.k==='engine').map(part=>pick(part,NOZZLE_FIELDS)),layout:pick(blueprint,LAYOUT_FIELDS)},source={key,blueprint,manifest,sourceSha256:sha(raw),inventorySha256:sha(stable(inventory)),sourceCounts:Object.freeze(counts),archive:ARCHIVE,sourceArchive:ARCHIVE+'/'+record.file,manifestPath,manifestSha256:sha(manifestBytes),sourceKind:'authenticated-historical-reference'};
 // Keep private geometry caches usable on a source copy, but reject any
 // mutation of its public authored baseline before comparison.
 authenticated.set(source,{key,canonical:sha(stable(blueprint)),manifestCanonical:sha(stable(manifest))});return Object.freeze(source);
}
function expectedSourceLayout(source,key=source?.key){
 const identity=source&&authenticated.get(source);if(!identity||identity.key!==key||sha(stable(source.blueprint))!==identity.canonical||sha(stable(source.manifest))!==identity.manifestCanonical)throw Error('Use an unchanged source returned by loadSource(root,key)');
 const blueprint=copy(source.blueprint),transforms=[];
 if(key==='mc75'){
  const primaries=blueprint.parts.filter(p=>p.k==='struct'&&p.form==='hull'&&p.primaryHull===true),part=primaries[0];
  if(primaries.length!==1||part.id!==132||sha(stable(part.hullData?.framingSamples))!==MC75_FRAMING_SOURCE_SHA||MC75_FRAMING_EXPECTED.length!==120||sha(stable(MC75_FRAMING_EXPECTED))!==MC75_FRAMING_EXPECTED_SHA)throw Error('MC75 declared framing baseline changed');
  transforms.push({kind:'derived-paid-framing-grid',partId:132,field:'hullData.framingSamples',sourceSha256:MC75_FRAMING_SOURCE_SHA,expectedSha256:MC75_FRAMING_EXPECTED_SHA,from:copy(part.hullData.framingSamples),to:copy(MC75_FRAMING_EXPECTED),scope:'Only the 120 internal paid framing samples; exact outer world triangles and owned fitting frames must independently match the raw source.'});
  part.hullData.framingSamples=copy(MC75_FRAMING_EXPECTED);
 }
 return {blueprint,transforms};
}
function normalizeStructure(part,normalizations){
 if(!part)return null;const out=publicValue(part);if(out.form==='shell'&&out.shellFlip===false){delete out.shellFlip;normalizations.push('false-shellFlip-default');}return out;
}
function posePair(C,source,actual){
 const before=pick(source,FIT_FIELDS),after=pick(actual,FIT_FIELDS),normalizations=[];if(!after)return {before,after,normalizations};
 for(const field of ['float','launcherBlocked'])for(const value of [before,after])if(value[field]===false){delete value[field];normalizations.push('false-'+field+'-default');}
 // These additions are accepted only on the command-window family whose
 // original predicates already used slope||0 and commandEnabled!==false.
 const command=source.k==='window'||source.k==='podAir'||source.k==='podBridge';
 if(command&&!Object.hasOwn(before,'slope')&&after.slope===0){delete after.slope;normalizations.push('command-slope-zero-default');}
 if(command&&!Object.hasOwn(before,'commandEnabled')&&after.commandEnabled===true){delete after.commandEnabled;normalizations.push('command-enabled-true-default');}
 const axisAlias=Array.isArray(before.tilt)?'tilt':Object.hasOwn(before,'mountAxis')?'mountAxis':Object.hasOwn(before,'a')?'a':null,sourceNormal=axisAlias?publicValue(C.fitUp(copy(source))):null;
 if(!Object.hasOwn(before,'n')&&Array.isArray(after.n)&&axisAlias&&equivalent(after.n,sourceNormal)){
  const a=copy(source),b=copy(actual);if(equivalent(publicValue(C.fitFrameOf(a)),publicValue(C.fitFrameOf(b)))&&equivalent(publicValue(C.fitAABB(a)),publicValue(C.fitAABB(b)))){delete after.n;normalizations.push('normal-from-existing-frame-equivalent-'+axisAlias);}
 }

 return {before,after,normalizations:[...new Set(normalizations)]};
}
function layoutPair(input,ship,field){
 const before=publicValue(input[field]),after=publicValue(ship[field]),normalizations=[];
 // Only an assembly-only guide header may acquire these exact historical
 // defaults. A real owned hull and every authored station remain protected.
 const guide=field==='hull'&&before?.assembly===true&&after?.assembly===true&&!input.parts.some(part=>part.k==='struct'&&part.form==='hull')&&!ship.parts.some(part=>part.k==='struct'&&part.form==='hull');
 if(guide){if(before.name==='楔形'&&!Object.hasOwn(after,'name')){delete before.name;normalizations.push('assembly-guide-preset-label-omitted');}for(const [key,value]of [['deckWidth',.52],['belt',.13]])if(!Object.hasOwn(before,key)&&after[key]===value){delete after[key];normalizations.push('assembly-guide-'+key+'-default');}}
 return {before,after,normalizations};
}
const primaryHull=p=>p?.k==='struct'&&p.form==='hull'&&p.primaryHull===true;
const hostId=value=>Number.isSafeInteger(value)?value:typeof value==='string'&&/^p[1-9][0-9]*$/.test(value)?Number(value.slice(1)):null;
const reboundHost=(value,id)=>typeof value==='string'?'p'+id:id;
function generatedPrimaryEvidence(C,ship,source,expected){
 const raw=source.blueprint,rawPrimaries=raw.parts.filter(primaryHull),actualPrimaries=ship.parts.filter(primaryHull),original=rawPrimaries[0],actual=actualPrimaries[0],planned=expected.parts.find(p=>p.id===original?.id),declaredFraming=source.key==='mc75';
 const required=!!original&&(actual?.id!==original.id||declaredFraming);
 const proof={required,accepted:false,sourceId:original?.id??null,actualId:actual?.id??null,descriptorEquivalent:false,worldTrianglesIdentical:false,ownedFits:[],ownedHatches:[]};
 if(!required)return {...proof,passed:true};
 if(!['mc80home','mc80liberty','mc75','mc30c'].includes(source.key)||rawPrimaries.length!==1||actualPrimaries.length!==1||!planned)return {...proof,passed:false};
 const withoutId=p=>{const v=publicValue(p);delete v.id;return v;};
 proof.descriptorEquivalent=equivalent(withoutId(planned),withoutId(actual));
 if(declaredFraming)proof.exactDeclaredFraming=sha(stable(actual.hullData?.framingSamples)??'<absent>')===MC75_FRAMING_EXPECTED_SHA;
 const actualFits=new Map(ship.fits.map(f=>[f.id,f]));
 for(const fit of raw.fits.filter(f=>hostId(f.host)===original.id)){
  const target=actualFits.get(fit.id),before=copy(fit);before.host=reboundHost(fit.host,actual.id);const pair=posePair(C,before,target),correctOwner=!!target&&target.host===before.host;
  let frameEquivalent=false,boundsEquivalent=false;try{if(target){frameEquivalent=equivalent(publicValue(C.fitFrameOf(copy(fit))),publicValue(C.fitFrameOf(copy(target))));boundsEquivalent=equivalent(publicValue(C.fitAABB(copy(fit))),publicValue(C.fitAABB(copy(target))));}}catch{}
  proof.ownedFits.push({id:fit.id,sourceHost:fit.host,actualHost:target?.host??null,correctOwner,localAndPoseEquivalent:equivalent(pair.before,pair.after),frameEquivalent,boundsEquivalent});
 }
 const actualHatches=new Map(ship.hatches.map(h=>[h.id,h]));
 for(const hatch of raw.hatches.filter(h=>h.hullOwner===original.id)){const target=actualHatches.get(hatch.id);proof.ownedHatches.push({id:hatch.id,sourceOwner:original.id,actualOwner:target?.hullOwner??null,correctOwner:target?.hullOwner===actual.id&&target?.hullHatch===hatch.hullHatch});}
 try{
  // Work only on copies: geometry helpers may attach private caches and sync
  // handles, and cannot be allowed to repair an invalid observed binding.
  const beforeShip=copy(raw),afterShip=copy(ship),a=C.hullStructureGeometry(beforeShip,beforeShip.parts.find(p=>p.id===original.id)).tris,b=C.hullStructureGeometry(afterShip,afterShip.parts.find(p=>p.id===actual.id)).tris,ab=Buffer.from(a.buffer,a.byteOffset,a.byteLength),bb=Buffer.from(b.buffer,b.byteOffset,b.byteLength);
  proof.sourceTriangles={values:a.length,sha256:sha(ab)};proof.actualTriangles={values:b.length,sha256:sha(bb)};proof.worldTrianglesIdentical=a.length===b.length&&ab.equals(bb);
 }catch(error){proof.geometryError=error.message;}
 proof.passed=proof.descriptorEquivalent&&proof.worldTrianglesIdentical&&(!declaredFraming||proof.exactDeclaredFraming)&&proof.ownedFits.every(r=>r.correctOwner&&r.localAndPoseEquivalent&&r.frameEquivalent&&r.boundsEquivalent)&&proof.ownedHatches.every(r=>r.correctOwner);
 if(proof.passed){
  proof.accepted=true;planned.id=actual.id;
  for(const fit of expected.fits)if(hostId(fit.host)===original.id)fit.host=reboundHost(fit.host,actual.id);
  for(const hatch of expected.hatches)if(hatch.hullOwner===original.id)hatch.hullOwner=actual.id;
 }
 return proof;
}
function layoutEvidence(C,ship,source,key=source?.key){
 const identity=source&&authenticated.get(source);if(!identity||identity.key!==key||sha(stable(source.blueprint))!==identity.canonical||sha(stable(source.manifest))!==identity.manifestCanonical)throw Error('Use an unchanged source returned by loadSource(root,key)');
 const expectedLayout=expectedSourceLayout(source,key),input=expectedLayout.blueprint,valid=!!ship&&Array.isArray(ship.parts)&&Array.isArray(ship.fits)&&Array.isArray(ship.hatches),actualParts=valid?ship.parts:[],actualFits=valid?ship.fits:[],parts=new Map(actualParts.map(part=>[part.id,part])),fits=new Map(actualFits.map(fit=>[fit.id,fit])),uniqueParts=valid&&uniqueIds(actualParts),uniqueFits=valid&&uniqueIds(actualFits),uniquePublicIds=valid&&uniqueIds([...actualParts,...actualFits,...ship.hatches]);
 const generatedPrimaryHull=valid?generatedPrimaryEvidence(C,ship,source,input):{required:false,accepted:false,passed:false},sourceParts=new Map(source.blueprint.parts.map(part=>[part.id,part]));
 const originalPartId=part=>generatedPrimaryHull.accepted&&part.id===generatedPrimaryHull.actualId?generatedPrimaryHull.sourceId:part.id;
 const structures=input.parts.filter(part=>part.k==='struct').map(part=>{
  const normalizations=[],before=normalizeStructure(sourceParts.get(originalPartId(part)),normalizations),expected=normalizeStructure(part,normalizations),after=normalizeStructure(parts.get(part.id),normalizations),unchanged=equivalent(before,after),matchesExpected=equivalent(expected,after);
  return {id:originalPartId(part),expectedId:part.id,actualId:parts.get(part.id)?.id??null,unchanged,matchesExpected,sourceSha256:sha(stable(before)),expectedSha256:sha(stable(expected)),actualSha256:sha(stable(after)),acceptedEquivalentNormalizations:[...new Set(normalizations)],differences:unchanged?[]:differences(before,after,'part#'+part.id),expectedDifferences:matchesExpected?[]:differences(expected,after,'part#'+part.id)};
 });
 const expectedFits=new Map(input.fits.map(f=>[f.id,f]));
 const fittings=source.blueprint.fits.map(fit=>{const actual=fits.get(fit.id),raw=posePair(C,fit,actual),pair=posePair(C,expectedFits.get(fit.id),actual),poseUnchanged=equivalent(raw.before,raw.after),matchesExpected=equivalent(pair.before,pair.after);let worldFrameEquivalent=false,worldBoundsEquivalent=false;try{if(actual){worldFrameEquivalent=equivalent(publicValue(C.fitFrameOf(copy(fit))),publicValue(C.fitFrameOf(copy(actual))));worldBoundsEquivalent=equivalent(publicValue(C.fitAABB(copy(fit))),publicValue(C.fitAABB(copy(actual))));}}catch{}return {id:fit.id,sourceKind:fit.k,expectedKind:fit.k,actualKind:actual?.k??null,poseUnchanged,matchesExpected,worldFrameEquivalent,worldBoundsEquivalent,kindCorrect:actual?.k===fit.k,sourcePoseSha256:sha(stable(raw.before)),expectedPoseSha256:sha(stable(pair.before)),actualPoseSha256:sha(stable(pair.after)),acceptedEquivalentNormalizations:[...new Set([...raw.normalizations,...pair.normalizations,...(generatedPrimaryHull.accepted&&hostId(fit.host)===generatedPrimaryHull.sourceId?['generated-primary-hull-identity']:[])])],differences:poseUnchanged?[]:differences(raw.before,raw.after,'fit#'+fit.id),expectedDifferences:matchesExpected?[]:differences(pair.before,pair.after,'fit#'+fit.id)};});
 const nozzles=input.parts.filter(part=>part.k==='engine').map(part=>{
  const before=pick(sourceParts.get(part.id),NOZZLE_FIELDS),expected=pick(part,NOZZLE_FIELDS),after=pick(parts.get(part.id),NOZZLE_FIELDS),unchanged=equivalent(before,after),matchesExpected=equivalent(expected,after);
  return {id:part.id,unchanged,matchesExpected,sourceAppearanceSha256:sha(stable(before)),expectedAppearanceSha256:sha(stable(expected)),actualAppearanceSha256:sha(stable(after)),differences:unchanged?[]:differences(before,after,'nozzle#'+part.id),expectedDifferences:matchesExpected?[]:differences(expected,after,'nozzle#'+part.id)};
 });
 const publicLayout=LAYOUT_FIELDS.map(field=>{
  const actual=valid?ship:{...input,parts:[]},raw=layoutPair(source.blueprint,actual,field),expected=layoutPair(input,actual,field),unchanged=valid&&equivalent(raw.before,raw.after),matchesExpected=valid&&equivalent(expected.before,expected.after);
  return {field,unchanged,matchesExpected,sourceSha256:sha(stable(raw.before)??'<absent>'),expectedSha256:sha(stable(expected.before)??'<absent>'),actualSha256:sha(stable(expected.after)??'<absent>'),acceptedEquivalentNormalizations:[...new Set([...raw.normalizations,...expected.normalizations])],differences:unchanged?[]:differences(raw.before,raw.after,field),expectedDifferences:matchesExpected?[]:differences(expected.before,expected.after,field)};
 });
 const counts={parts:actualParts.length,structures:actualParts.filter(part=>part.k==='struct').length,fittings:actualFits.length,nozzles:actualParts.filter(part=>part.k==='engine').length,hatches:valid?ship.hatches.length:0},expected=source.sourceCounts,gates={authenticatedSource:true,generatedPrimaryHullIdentity:generatedPrimaryHull.passed,referenceCorrect:valid&&ship.reference===key,uniquePublicIds,structuralLayoutPreserved:uniqueParts&&counts.structures===expected.structures&&structures.every(row=>row.matchesExpected)&&publicLayout.every(row=>row.matchesExpected),allFittingPosesPreserved:uniqueFits&&counts.fittings===expected.fittings&&fittings.every(row=>row.matchesExpected&&row.worldFrameEquivalent&&row.worldBoundsEquivalent),weaponKindsCorrect:counts.fittings===expected.fittings&&fittings.every(row=>row.kindCorrect),nozzleAppearancePreserved:uniqueParts&&counts.nozzles===expected.nozzles&&nozzles.every(row=>row.matchesExpected)};
 return {scope:'Authenticated historical structures, complete owned hull profiles/cuts, fitting kinds/poses and nozzle appearances are compared independently to both the raw archive and the expected layout. Only exact declared native transforms may change the expected layout; all fitting poses remain raw-source-owned. Engine bodies, ownership and internal engineering may change independently. Nested array lengths and global public IDs are exact; only explicitly listed geometry-neutral defaults/frame aliases and relative numeric roundoff of 1e-12 are accepted.',key,sourceArchive:source.sourceArchive,sourceSha256:source.sourceSha256,inventorySha256:source.inventorySha256,manifestSha256:source.manifestSha256,relativeTolerance:TOLERANCE,declaredTransforms:expectedLayout.transforms,generatedPrimaryHull,rawPreservation:{structures:structures.every(row=>row.unchanged),fittings:fittings.every(row=>row.poseUnchanged),nozzles:nozzles.every(row=>row.unchanged),publicLayout:publicLayout.every(row=>row.unchanged)},expectedCounts:expected,actualCounts:counts,uniqueParts,uniqueFits,structures,fits:fittings,nozzles,publicLayout,...gates,passed:Object.values(gates).every(Boolean)};
}
module.exports={loadSource,expectedSourceLayout,layoutEvidence,keys:Object.freeze(Object.keys(SOURCES))};
