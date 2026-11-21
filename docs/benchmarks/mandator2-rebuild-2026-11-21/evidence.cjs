// Evidence for the Mandator II rebuilt on the user's second exterior model (2026-11-21). Reads the stored example
// (data/examples/mandator2/design.json.gz) and the source file; computes the statistics (slow: about a quarter of an hour).
// usage: node evidence.cjs <output.json>
const fs=require('fs'),zlib=require('zlib'),path=require('path'),crypto=require('crypto'),root=path.resolve(__dirname,'../../..'),{C}=require(root+'/scripts/update-ship-examples.cjs').loadRuntime(root);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),r=v=>typeof v==='number'?+v.toPrecision(7):v;
const gz=fs.readFileSync(root+'/data/examples/mandator2/design.json.gz'),raw=zlib.gunzipSync(gz),design=JSON.parse(raw),srcRaw=zlib.gunzipSync(fs.readFileSync(root+'/assets/source/mandator2-user-exterior/mandator2-user-exterior.json.gz')),source=JSON.parse(srcRaw);
const out={design:{sha256:sha(raw),bytes:raw.length},source:{sha256:sha(srcRaw),bytes:srcRaw.length,structures:source.parts.filter(p=>p.k==='struct').length,sensors:source.parts.filter(p=>p.k==='sensor').length}};
// exterior kept as given
{const byId=new Map(design.parts.map(p=>[p.id,p])),differing=[];for(const p of source.parts){const q=byId.get(p.id);if(!q){differing.push([p.id,'missing']);continue;}const keys=[...new Set([...Object.keys(p),...Object.keys(q)])].filter(k=>!same(p[k],q[k]));if(keys.length)differing.push([p.id,keys.join()]);}
 const ids=new Set(source.parts.map(p=>p.id)),added=design.parts.filter(p=>!ids.has(p.id)),kinds={};for(const p of added)kinds[p.k]=(kinds[p.k]||0)+1;out.exterior={hullEqual:same(design.hull,source.hull),partsCompared:source.parts.length,differing,addedByKind:kinds,addedStructures:added.filter(p=>p.k==='struct').map(p=>[p.id,p.label]),cuts:(design.cuts||[]).length,trenches:(design.trenches||[]).length,solidCuts:(design.solidCuts||[]).length};}
const t0=Date.now(),s=C.deserialize(JSON.parse(raw)),S=C.computeStats(s);out.seconds=Math.round((Date.now()-t0)/1000);
out.stats={mass:r(S.mass),power:r(S.power),cost:S.cost,accel:r(S.accel),maxAccelG:r(S.maxAccelG??S.accelG),turn:r(S.turn),shieldCapacity:r(S.shieldCapacity),floatingFits:(S.ungrounded?.floatingFits||[]).length,looseParts:(S.ungrounded?.parts||[]).length,overlaps:Object.values(S.info).filter(i=>i.overlap).length,warnings:(S.warnings||[]).map(w=>[w.lv,w.text.slice(0,110)])};
for(const k of Object.keys(S))if(/accel|thrust|speed|heat|cool|dissip/i.test(k)&&typeof S[k]==='number')out.stats[k]=r(S[k]);
const fk={};for(const f of s.fits)fk[f.k]=(fk[f.k]||0)+1;out.fits=fk;
const charge={};for(const f of s.fits){const c=S.chargeInfo?.[f.id];if(!c)continue;const e=charge[f.k]||(charge[f.k]={n:0,min:Infinity,blocked:0});e.n++;e.min=Math.min(e.min,c.ratio??1);if(c.blocked)e.blocked++;}out.charge=charge;
// interior layout
const box=p=>{try{return C.partAABB(p).map(v=>Math.round(v));}catch(e){return null;}};
out.layout=s.parts.filter(p=>['gen','aux','hyper','fuel','pump','hdis','shield','inertial','integrity','command','cargo','automation','hangar','service'].includes(p.k)).map(p=>({id:p.id,k:p.k,label:p.label,box:box(p),volume:Math.round(C.partVolume(p,s)),inside:r(S.info[p.id]?.inside),inHull:r(S.info[p.id]?.inHull),overlap:!!S.info[p.id]?.overlap}));
out.liftRooms={n:s.parts.filter(p=>p.k==='repulsor').length,support:r(S.craftSystems?.landingSupport),mass:r(S.mass)};
// engines
const R=C.engineDriveRoutes(s);out.engines=s.parts.filter(p=>p.k==='engine').map(n=>{const b=s.parts.find(p=>p.id===n.machineryId),route=R.routes.find(x=>x.to==='p'+n.id),ax=C.norm(n.dir||[-1,0,0]),d=b?C.sub(b.c,n.c):null,along=d?C.dot(d,ax):null,off=d?C.len(C.sub(d,C.mul(ax,along))):null,vol=b?Math.PI*(b.d/2)**2*b.length:0,normal=vol*C.PROPULSION.referenceInputDensity;
 return {nozzle:n.id,label:n.label,nozzleAt:n.c.map(Math.round),body:b?.id,bodyLabel:b?.label,bodyAt:b?.c.map(Math.round),bodyD:b&&Math.round(b.d),bodyLength:b&&Math.round(b.length),offAxisM:off==null?null:+off.toFixed(1),ratedInputW:b?.ratedInputW,normalRatingW:normal,ratedOverNormal:b?+(b.ratedInputW/normal).toFixed(4):null,requestedW:n.ratedInputW,bodyInside:r(S.info[b?.id]?.inside),bodyInHull:r(S.info[b?.id]?.inHull),route:route?{ok:route.ok,reason:route.reason,lengthM:Math.round(route.length),capacityShare:+(route.capacityW/route.requestedCapacityW).toFixed(4),radiusM:+(+route.radius).toFixed(1)}:null,usable:S.info[n.id]?.vent};});
fs.writeFileSync(process.argv[2],JSON.stringify(out,null,1));console.log('written',process.argv[2],out.seconds+'s');
