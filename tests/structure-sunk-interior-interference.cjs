// A structure sunk into the hull (減り込み配置) over interior equipment is not a clash (user rule
// 2026-11-12: a structure adds material to the hull body, the interior is the hull plus its attached
// structures). Report 2026-11-12: mirrored ellipsoid structures sunk into a cigar hull's sides were
// refused with placement-interference because six legacy repulsors without placement metadata were
// counted as fixed exterior equipment. Exterior equipment still clashes (design-placement-v1.2.md
// 「配置と保存の契約」: exterior propulsion, weapons and command inherit the interference rules).
const assert=require('node:assert/strict'),fs=require('node:fs'),zlib=require('node:zlib'),path=require('node:path'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'));
const saved=()=>JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'fixtures/sunk-structure-interference-2026-11-12.json.gz'))).toString('utf8'));
const SUNK=[100,101],LEGACY=[90,91,92,93,94,95];
const grounding=ship=>{const S={warnings:[]};C.groundingStats(ship,S);return S;};
const reload=(ship,options)=>C.deserialize(JSON.parse(C.publicJSON(C.serialize(ship))),options);
function assertRecovered(ship,label){
 const S=grounding(ship);
 for(const id of SUNK){const p=ship.parts.find(q=>q.id===id),meta=p.placement;
  assert.equal(p._placementError,undefined,`${label} #${id}: ${p._placementError}`);
  assert.ok(!meta.validationFailed&&!meta.repairRequired&&!meta.pendingGeometry,`${label} #${id}: ${meta.repairReason}`);
  assert.equal(meta.repairReason,undefined,label);
  const d=S.placementDiagnostics.find(x=>x.partId===id);assert.equal(d.connected,true,label+' #'+id+' '+JSON.stringify(d));assert.equal(d.code,null,label);
  assert.ok(!S.ungrounded.parts.includes(id),label+': no red frame');
  assert.equal(C.placementContact(ship,p,ship.parts[0]).connected,true,label+': touches the hull');}
 assert.ok(!S.warnings.some(w=>/interference/.test(w.code||'')),label+': '+JSON.stringify(S.warnings));
 return S;
}
// Re-solve a structure at its saved pose against `ship` (the solve a reload runs for a stored repair).
function resolveAt(ship,source){
 const meta={...source.placement};for(const key of ['validationFailed','repairRequired','repairReason','validationSourceKey','pendingGeometry'])delete meta[key];
 const input={...JSON.parse(C.publicJSON(source)),placement:meta};delete input.tw;
 return C.solvePlacement(ship,input,{...meta,keepTransform:true,geometryRevision:meta.geometryRevision||0,parentGeometryRevision:0});
}
const without=(raw,ids)=>{const o=JSON.parse(JSON.stringify(raw));o.parts=o.parts.filter(p=>!ids.includes(p.id));for(const p of o.parts)if(ids.includes(p.tw))delete p.tw;return o;};

test('the reported design: the saved placement-interference refusal recovers on load (live, reload, deferred)',()=>{
 const raw=saved();for(const id of SUNK){const m=raw.parts.find(p=>p.id===id).placement;assert.equal(m.validationFailed,true);assert.equal(m.repairReason,'placement-interference');}
 const ship=C.deserialize(raw);assertRecovered(ship,'load');
 const again=reload(ship);assertRecovered(again,'save/reload');
 const deferred=reload(ship,{deferPlacementGeometry:true}),r=C.refreshPlacementGeometry(deferred);assert.equal(r.ok,true,JSON.stringify(r.failed));assertRecovered(deferred,'deferred reload');
 // The interior equipment around them stays valid.
 for(const p of ship.parts.filter(p=>!C.isShapePart(p)))assert.equal(p._placementError,undefined,`#${p.id} ${p.k}: ${p._placementError}`);
 assert.ok(Number.isFinite(C.computeStats({...ship,_cache:null}).mass));
});

test('a sunk structure over legacy repulsors without placement metadata is not refused',()=>{
 const ship=C.deserialize(without(saved(),SUNK)),source=saved().parts.find(p=>p.id===100);
 for(const id of LEGACY)assert.equal(ship.parts.find(p=>p.id===id).placement,undefined,'legacy, no placement record');
 const r=resolveAt(ship,source);assert.equal(r.ok,true,r.code+' '+r.error);
 const hit=LEGACY.filter(id=>C.overlapParts(r.part,ship.parts.find(p=>p.id===id)));assert.ok(hit.length>=3,'the structure really overlaps the repulsors: '+hit);
 // Only the repulsors: the same structure over the legacy parts alone.
 const only=C.deserialize(without(saved(),[...SUNK,72,75,82,83,86,87,88,89]));const r2=resolveAt(only,source);assert.equal(r2.ok,true,r2.code+' '+r2.error);
 assert.ok(LEGACY.some(id=>C.overlapParts(r2.part,only.parts.find(p=>p.id===id))));
 // Other legacy interior kinds without metadata (a reactor) are interior equipment too.
 const raw=without(saved(),[...SUNK,72,75,82,83,86,87,88,89]);for(const p of raw.parts)if(LEGACY.includes(p.id)){const keep={id:p.id,k:'gen',c:p.c,d:4};for(const key of Object.keys(p))delete p[key];Object.assign(p,keep);}
 const gens=C.deserialize(raw),r3=resolveAt(gens,source);assert.equal(r3.ok,true,'legacy gen: '+r3.code);assert.ok(LEGACY.some(id=>C.overlapParts(r3.part,gens.parts.find(p=>p.id===id))),'overlaps the legacy reactors');
});

test('a sunk structure over direct and clip interior equipment is not refused',()=>{
 const ship=C.deserialize(without(saved(),[...SUNK,...LEGACY])),source=saved().parts.find(p=>p.id===100);
 const r=resolveAt(ship,source);assert.equal(r.ok,true,r.code+' '+r.error);
 const over=ship.parts.filter(p=>!C.isShapePart(p)&&C.overlapParts(r.part,p)),modes=new Set(over.map(p=>p.placement?.mode));
 assert.ok(modes.has('direct')&&modes.has('clip'),'overlaps both direct and clip interior equipment: '+over.map(p=>p.id+':'+p.placement?.mode));
 C.acceptPlacementResult(ship,r);const done=C.refreshPlacementGeometry(ship);assert.equal(done.ok,true,JSON.stringify(done.failed));
 for(const p of over){const q=ship.parts.find(x=>x.id===p.id);assert.equal(q._placementError,undefined,`#${q.id} ${q.k} (${q.placement.mode}): ${q._placementError}`);}
});

test('exterior equipment under the structure still clashes (placement-interference)',()=>{
 const source=saved().parts.find(p=>p.id===100);
 // A legacy shield projector without placement metadata was mounted outside: still a clash.
 for(const k of ['sensor','engine','shield']){
  // Replace the legacy repulsors under the structure with exterior equipment at the same spot.
  const raw=without(saved(),SUNK);for(const p of raw.parts)if(LEGACY.includes(p.id)){const keep={id:p.id,k,c:p.c,d:3};if(k==='engine')keep.dir=[-1,0,0];for(const key of Object.keys(p))delete p[key];Object.assign(p,keep);}
  const ship=C.deserialize(raw),r=resolveAt(ship,source);assert.equal(r.ok,false,k);assert.equal(r.code,'placement-interference',k+': '+r.code);
 }
 // A saved interference over exterior equipment is re-checked on load and stays refused (no red-frame loss of the record).
 const raw=saved();for(const p of raw.parts)if(LEGACY.includes(p.id)){const keep={id:p.id,k:'sensor',c:p.c,d:3};for(const key of Object.keys(p))delete p[key];Object.assign(p,keep);}
 const ship=C.deserialize(raw);for(const id of SUNK){const p=ship.parts.find(q=>q.id===id);assert.equal(p._placementError,'placement-interference','#'+id);assert.equal(p.placement.repairRequired,true);}
});
