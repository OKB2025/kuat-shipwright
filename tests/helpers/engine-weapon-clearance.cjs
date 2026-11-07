// Independent survey of enlarged machinery against actual authored gun meshes
// and complete neutral firing rays. No constructor or statistics calculation.
function engineWeaponClearance(C,ship,options={}){
 const casings=ship.parts.filter(p=>p.k==='engine'&&C.equipmentSpec(p)?.engineStyle==='exposed'&&C.engineSkinMesh(p)),bodies=[...ship.parts.filter(p=>p.k==='engineCore'),...C.engineMachineryPaths(ship),...casings],bounds=new Map(bodies.map(p=>[p,p.k==='engine'?C.engineSkinMesh(p).b:C.partAABB(p)])),failures=[],samples=new Map();let checkedVertices=0,checkedRays=0;
 let hullMaskedRays=0;
 const inside=(p,q)=>C.inPart(p,q),overlap=(a,b)=>a.every((v,i)=>i>=3||v<b[i+3]-.005&&a[i+3]>b[i]+.005);
 for(const f of ship.fits){
  const d=C.fitSpec(f);if(d.msl||!((d.tt||0)+(d.ion||0)>0))continue;
  const g=C.authoredTurretGeometry(f);if(!g)continue;
  const assetId=f.skinAsset||d.asset,a=C.REFERENCE_ASSETS[assetId];if(!a)continue;
  const box=C.fitAABB(f),near=bodies.filter(p=>overlap(box,bounds.get(p)));
  if(near.length){
   let vertices=samples.get(assetId);if(!vertices){
    const m=C.decodeReference(assetId),ids=new Set();
    for(const row of a.components||[])for(const j of [0,.2,.4,.6,.8,1])ids.add(row.firstVertex+Math.floor((row.vertices-1)*j));
    for(const b of a.barrelCenters||[])for(let j=0;j<b.vertices;j+=Math.max(1,Math.ceil(b.vertices/32)))ids.add(b.firstVertex+j);
    vertices=[...ids].map(i=>Array.from(m.pos.subarray(i*3,i*3+3)));samples.set(assetId,vertices);
   }
   for(const p of vertices){const q=C.referenceFitPoint(f,p);checkedVertices++;for(const body of near)if(inside(body,q)){failures.push({gun:f.id,body:body.id,kind:'gun-mesh-inside-engine',point:q});break;}}
  }
  for(const muzzle of g.muzzles){
   const origin=C.add(muzzle,C.mul(g.fw,.02)),hull=options.ignoreHullMasked?C.rayEnv(ship,origin,g.fw,{structOnly:true}):null;
   if(hull)hullMaskedRays++;
   for(const body of bodies){checkedRays++;const hit=C.rayPart(origin,g.fw,body);
    if(inside(body,muzzle)||hit&&hit.t>0&&(!hull||hit.t<=hull.t+1e-5))failures.push({gun:f.id,body:body.id,kind:'engine-blocks-neutral-fire',muzzle,distance:hit?.t});
   }
  }
 }
 return {passed:failures.length===0,bodies:bodies.length,casings:casings.length,checkedVertices,checkedRays,hullMaskedRays,scope:options.ignoreHullMasked?'Actual gun meshes, engine bodies and authored casings; neutral fire before its first existing hull obstruction. An engine behind an already obstructing hull does not reduce that firing arc.':'Actual gun meshes, engine bodies, authored casings and complete neutral firing rays.',failures};
}
module.exports={engineWeaponClearance};
