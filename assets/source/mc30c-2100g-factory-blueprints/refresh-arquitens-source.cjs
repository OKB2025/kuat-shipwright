// Independent source and occupied-pod checks for the native Arquitens example.
// This module reads authored solids only; it never builds a factory or routes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const P=require('./replay-ship-examples.cjs');
const ARCHIVE='assets/source/ship-example-blueprints',SOURCE=ARCHIVE+'/arquitens.json.gz',PODS=Object.freeze([[78,49],[80,54],[82,59]]),TOLERANCE=1e-12;
const sha=value=>crypto.createHash('sha256').update(value).digest('hex'),copy=value=>JSON.parse(JSON.stringify(publicValue(value)));
function stable(value){if(Array.isArray(value))return '['+value.map(stable).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).filter(k=>!k.startsWith('_')).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';return JSON.stringify(value);}
function publicValue(value){if(Array.isArray(value))return value.map(publicValue);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).filter(k=>!k.startsWith('_')).map(k=>[k,publicValue(value[k])]));return value;}
function equivalent(a,b){
 if(Object.is(a,b))return true;
 if(typeof a==='number'&&typeof b==='number')return Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=Math.max(1,Math.abs(a),Math.abs(b))*TOLERANCE;
 if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>equivalent(v,b[i]));
 if(a&&b&&typeof a==='object'&&typeof b==='object'){const ka=Object.keys(a).sort(),kb=Object.keys(b).sort();return ka.length===kb.length&&ka.every((k,i)=>k===kb[i]&&equivalent(a[k],b[k]));}
 return false;
}
function loadSource(root){
 const directory=path.join(root,ARCHIVE),manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
 if(!manifest.models?.arquitens)throw Error('The authenticated historical Arquitens manifest entry is missing');
 const {blueprint,raw}=P.readBlueprint(directory,'arquitens',manifest);
 return {blueprint,manifest,sourceSha256:sha(raw),inventorySha256:null,archive:ARCHIVE,sourceArchive:SOURCE,manifestPath:ARCHIVE+'/manifest.json',sourceKind:'authenticated-historical-reference'};
}
const FIT_FIELDS=['id','p','a','n','tilt','assetYaw','host','local','localNormal','mountMode','localMount','frameFlip','frameForward','localForward','tw','ped','pedSize','width','height','commandEnabled','mount','slope','base','low','mountSupport','chargeDepth','float'];
const NOZZLE_FIELDS=['id','k','c','d','dir','nozzleLength','skinAsset','skinAnchor','skinDiameter','skinAxial','bodyLength','bodyRadius','engineLength','roll','equipmentId'];
const pick=(value,fields)=>value?Object.fromEntries(fields.filter(k=>Object.hasOwn(value,k)).map(k=>[k,publicValue(value[k])])):null;
function normalizeStructure(part){if(!part)return null;const out=publicValue(part);if(out.form==='shell'&&out.shellFlip===false)delete out.shellFlip;return out;}
function posePair(C,source,actual){
 const a=pick(source,FIT_FIELDS),b=pick(actual,FIT_FIELDS),normalizations=[];if(!b)return {source:a,actual:b,normalizations};
 for(const value of [a,b])if(value.float===false)delete value.float;
 if(!Object.hasOwn(a,'n')&&Array.isArray(a.tilt)&&Object.hasOwn(b,'n')&&equivalent(b.n,a.tilt)){
  const before=C.fitFrameOf(copy(source)),after=C.fitFrameOf(copy(actual)),beforeBounds=C.fitAABB(copy(source)),afterBounds=C.fitAABB(copy(actual));
  if(equivalent(publicValue(before),publicValue(after))&&equivalent(publicValue(beforeBounds),publicValue(afterBounds))){delete b.n;normalizations.push('normal-from-existing-tilt');}
 }
 return {source:a,actual:b,normalizations};
}
function layoutEvidence(C,ship,source){
 const input=source.blueprint,sourceStructures=input.parts.filter(p=>p.k==='struct'),actualStructures=ship.parts.filter(p=>p.k==='struct'),parts=new Map(ship.parts.map(p=>[p.id,p])),actualFits=new Map(ship.fits.map(f=>[f.id,f])),uniqueParts=parts.size===ship.parts.length,uniqueFits=actualFits.size===ship.fits.length;
 const structures=sourceStructures.map(part=>{const before=normalizeStructure(part),after=normalizeStructure(parts.get(part.id)),unchanged=equivalent(before,after);return {id:part.id,sourceSha256:sha(stable(before)),actualSha256:sha(stable(after)),unchanged,matchesExpected:unchanged};});
 const fits=input.fits.map(fit=>{const actual=actualFits.get(fit.id),poses=posePair(C,fit,actual),worldFrameEquivalent=!!actual&&equivalent(publicValue(C.fitFrameOf(copy(fit))),publicValue(C.fitFrameOf(copy(actual)))),worldBoundsEquivalent=!!actual&&equivalent(publicValue(C.fitAABB(copy(fit))),publicValue(C.fitAABB(copy(actual)))),poseUnchanged=equivalent(poses.source,poses.actual)&&worldFrameEquivalent&&worldBoundsEquivalent;return {id:fit.id,sourceKind:fit.k,expectedKind:fit.k,actualKind:actual?.k??null,sourcePoseSha256:sha(stable(poses.source)),actualPoseSha256:sha(stable(poses.actual)),acceptedEquivalentNormalizations:poses.normalizations,worldFrameEquivalent,worldBoundsEquivalent,poseUnchanged,kindCorrect:actual?.k===fit.k};});
 const nozzles=input.parts.filter(p=>p.k==='engine').map(part=>{const before=pick(part,NOZZLE_FIELDS),after=pick(parts.get(part.id),NOZZLE_FIELDS);return {id:part.id,unchanged:equivalent(before,after),sourceAppearanceSha256:sha(stable(before)),actualAppearanceSha256:sha(stable(after))};});
 const publicLayout=['cuts','trenches','solidCuts','subs','hatches','armor'].map(field=>({field,unchanged:equivalent(publicValue(input[field]),publicValue(ship[field]))}));
 const gates={structuralLayoutPreserved:uniqueParts&&sourceStructures.length===75&&actualStructures.length===75&&structures.every(row=>row.unchanged)&&publicLayout.every(row=>row.unchanged),allFittingPosesPreserved:uniqueFits&&input.fits.length===17&&ship.fits.length===17&&fits.every(row=>row.poseUnchanged),weaponKindsCorrect:fits.length===17&&fits.every(row=>row.kindCorrect),nozzleAppearancePreserved:nozzles.length===3&&ship.parts.filter(p=>p.k==='engine').length===3&&nozzles.every(row=>row.unchanged)};
 return {scope:'The authenticated historical native design retains all 75 structures, all 17 fitting poses and kinds, and all three authored bell appearances. Only false shell/float defaults, an independently frame-equivalent normal alias and relative numeric roundoff of 1e-12 are accepted. New machinery and internal engineering remain independent of these exterior guards.',sourceArchive:source.sourceArchive||SOURCE,sourceSha256:source.sourceSha256,inventorySha256:null,relativeTolerance:TOLERANCE,uniqueParts,uniqueFits,structures,fits,nozzles,publicLayout,...gates,passed:Object.values(gates).every(Boolean)};
}
function podEvidence(C,ship){
 const nozzles=ship.parts.filter(p=>p.k==='engine'),cores=ship.parts.filter(p=>p.k==='engineCore'),parts=new Map(ship.parts.map(p=>[p.id,p])),rows=PODS.map(([nozzleId,podId])=>{
  const nozzle=parts.get(nozzleId),pod=parts.get(podId),core=nozzle?C.engineOwner(nozzle,ship):null,valid=!!core&&core.k==='engineCore'&&!core.room&&!core.boxSize&&!core.segments&&Array.isArray(core.c)&&core.c.length===3&&core.c.every(Number.isFinite)&&Array.isArray(core.dir)&&core.dir.length===3&&core.dir.every(Number.isFinite)&&Math.hypot(...core.dir)>0&&Number.isFinite(core.d)&&core.d>0&&Number.isFinite(core.length)&&core.length>0,podValid=pod?.k==='struct'&&pod.form==='roundloft';let sampledPoints=0,outsideSamples=0;const outsideExamples=[];
  if(valid&&podValid){const frame=C.frameAxis(core.dir),radius=core.d/2;for(const t of [0,.125,.25,.5,.75,.875,1]){const centre=C.add(core.c,C.mul(frame.u,core.length*(t-.5))),samples=[centre];for(const fraction of [.5,1])for(let j=0;j<96;j++)samples.push(C.add(centre,C.add(C.mul(frame.v,Math.cos(j*Math.PI/48)*radius*fraction),C.mul(frame.w,Math.sin(j*Math.PI/48)*radius*fraction))));for(const point of samples){sampledPoints++;if(!C.inStruct(pod,point)){outsideSamples++;if(outsideExamples.length<4)outsideExamples.push(point);}}}}
  const nozzleIds=core?nozzles.filter(p=>p.machineryId===core.id).map(p=>p.id):[];return {nozzleId,podId,coreId:core?.id??null,positionM:core?.c??null,diameterM:core?.d??null,lengthM:core?.length??null,axis:core?.dir??null,nozzleIds,independentOwner:valid&&nozzleIds.length===1&&nozzleIds[0]===nozzleId,bodyInsidePod:valid&&podValid&&sampledPoints===1351&&outsideSamples===0,sampledPoints,outsideSamples,outsideExamples};
 });
 const validCount=nozzles.length===3&&cores.length===3&&parts.size===ship.parts.length,independentNozzleOwners=validCount&&new Set(rows.map(row=>row.coreId)).size===3&&rows.every(row=>row.independentOwner);
 const allBodiesInsidePods=independentNozzleOwners&&rows.length===3&&rows.every(row=>row.bodyInsidePod);
 return {scope:'Every complete paid cylindrical engine is independently sampled against its own unchanged native round-loft nacelle: seven axial sections, each centre and two circular rings of 96 points. No hull union, nozzle or another pod can stand in for its containing bulge.',expectedNozzlePodPairs:PODS.map(row=>row.slice()),rows,independentNozzleOwners,allBodiesInsidePods,passed:allBodiesInsidePods&&independentNozzleOwners};
}
module.exports={loadSource,layoutEvidence,podEvidence};
