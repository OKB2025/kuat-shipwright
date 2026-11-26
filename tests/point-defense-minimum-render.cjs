const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(__dirname,'..'),cx=vm.createContext({console,performance}),sha=v=>crypto.createHash('sha256').update(v).digest('hex'),plain=v=>JSON.parse(JSON.stringify(v));
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),kinds=['pd','monCalPD'],draw=k=>G.turretRenderAsset(C.FITS[k].asset),fit=(k,pose={})=>({id:1,k,p:[100,50,-30],a:2,ped:0,base:0,low:0,slope:0,float:false,assetYaw:0,...pose});
const hashArray=a=>sha(Buffer.from(a.buffer,a.byteOffset,a.byteLength)),near=(a,b,e=1e-5)=>assert.ok(Math.abs(a-b)<=e,a+' != '+b);
function partTriangles(mesh,row){const T=[];for(let i=row.firstIndex;i<row.firstIndex+row.indices;i++)T.push(...mesh.pos.subarray(mesh.idx[i]*3,mesh.idx[i]*3+3));return Float32Array.from(T);}
function geometryTriangles(g){const T=[];for(let i=0;i<g.ni;i+=3)T.push(Array.from(g.idx.subarray(i,i+3),j=>Array.from(g.pos.subarray(j*3,j*3+3))).flat().join(','));return T;}

test('minimum PD uses fixed explicit budgets, exact whole extents and one cached asset without changing the physical model',()=>{
 for(const [k,faces,vertices,barrels]of [['pd',176,108,2],['monCalPD',132,74,3]]){
  const id=C.FITS[k].asset,a=C.REFERENCE_ASSETS[id],source=C.decodeReference(id),saved=JSON.stringify(a),sourceHashes=[source.pos,source.uv,source.idx].map(hashArray),spec=plain(C.fitSpec({k})),r=draw(k);
  assert.equal(r.asset.minimumPointDefense,true);assert.equal(r.asset.faces,faces);assert.equal(r.asset.n,vertices);assert.equal(r.mesh.idx.length,faces*3);assert.equal(new Set(r.mesh.idx).size,vertices);assert.equal(r.asset.barrelCenters.length,barrels);assert.equal(draw(k),r);
  assert.equal(r.asset.housingVertices,r.asset.elevationVertexStart);assert.equal(r.asset.housingFaces*3,r.asset.elevationIndexStart);for(const p of r.asset.drivePivots){assert.ok(p.firstVertex+p.vertices<=vertices);assert.ok(p.firstIndex+p.indices<=faces*3);}
  for(let axis=0;axis<3;axis++){const values=Array.from({length:r.asset.n},(_,i)=>r.mesh.pos[i*3+axis]),old=Array.from({length:a.n},(_,i)=>source.pos[i*3+axis]);near(Math.min(...values),Math.min(...old),1e-7);near(Math.max(...values),Math.max(...old),1e-7);}
  assert.equal(JSON.stringify(a),saved);assert.deepEqual([source.pos,source.uv,source.idx].map(hashArray),sourceHashes);assert.deepEqual(plain(C.fitSpec({k})),spec);/* 2026-11-24 gun rules: the shot of the laser's bore (pd 0.40 m 800 kt, monCalPD 0.178 m 133 kt; was 100 kt) */assert.equal(spec.gunRule.kind,'laser');near(spec.boltTT,C.laserShotKt(spec.gunRule.boreM)/C.KT_PER_TT,1e-18);assert.equal(Math.round(spec.boltTT*C.KT_PER_TT),k==='pd'?800:133);assert.equal(spec.barrels,barrels);
 }
});

test('each minimum component is closed, outward-wound, nondegenerate and retains the real hollow muzzle floor',()=>{
 for(const k of kinds){const a=C.REFERENCE_ASSETS[C.FITS[k].asset],r=draw(k);
  for(const row of r.asset.components){const edges=new Map();let volume=0;
   for(let i=row.firstIndex;i<row.firstIndex+row.indices;i+=3){const ids=Array.from(r.mesh.idx.subarray(i,i+3)),P=ids.map(j=>Array.from(r.mesh.pos.subarray(j*3,j*3+3))),n=C.cross(C.sub(P[1],P[0]),C.sub(P[2],P[0]));assert.ok(C.len(n)>1e-12,k+' '+row.label+' real triangle');volume+=C.dot(P[0],C.cross(P[1],P[2]))/6;
    for(let j=0;j<3;j++){const x=ids[j],y=ids[(j+1)%3],key=Math.min(x,y)+':'+Math.max(x,y),v=edges.get(key)||[0,0];v[0]++;v[1]+=x<y?1:-1;edges.set(key,v);}}
   assert.ok(volume>0,k+' '+row.label+' outward closed volume');for(const [count,direction]of edges.values()){assert.equal(count,2,k+' closed component edge');assert.equal(direction,0,k+' consistent face winding');}
  }
  for(const [i,b]of r.asset.barrelCenters.entries()){const old=a.barrelCenters[i];for(const field of ['root','muzzle','axis','outerRadiusM','boreRadiusM','muzzleRecessM'])assert.deepEqual(plain(b[field]),plain(old[field]));assert.equal(b.indices/3,28);const normalized=q=>q.map((v,j)=>(v-a.c[j])/a.size[j]),T=partTriangles(r.mesh,b),mouth=normalized(b.muzzle),rear=normalized(C.sub(b.muzzle,C.mul(b.axis,b.muzzleRecessM))),direction=C.norm(C.sub(mouth,rear)),hit=C.rayTris(T,C.add(mouth,C.mul(direction,.02)),C.mul(direction,-1));assert.ok(hit,k+' open bore');near(hit.t,C.len(C.sub(mouth,rear))+.02,1e-6);}
 }
});

test('minimum PD static, articulated and picking geometry agree for upper, lower and side-mounted poses',()=>{
 for(const k of kinds)for(const pose of [{a:2,assetYaw:23},{a:3},{a:4,assetPitch:90},{a:5,assetYaw:17,tilt:C.norm([.2,0,-.98])}]){
  const f=fit(k,pose);if(k==='pd')delete f.assetPitch;const s=C.newShip({assembly:true,L:200,W:100,H:70},'Minimum PD pose');s.parts=[];s.fits=[f];s.hatches=[];s.detail=0;C.fitSpec(f);const before=C.publicJSON(f),reference=G.meshReferenceFits(s),fleet=G.fleetGeometry(s,{trial:true}),turret=fleet.turrets.find(t=>t.id===f.id),body=fleet.meshes[turret.bodyMesh].geo,moving=fleet.meshes[turret.mesh].geo,r=draw(k);
  assert.equal(body.ni,r.asset.elevationIndexStart);assert.equal(body.ni+moving.ni,r.asset.faces*3);assert.deepEqual([...geometryTriangles(body),...geometryTriangles(moving)].sort(),geometryTriangles(reference).sort());assert.equal(turret.barrels,k==='pd'?2:3);assert.equal(C.publicJSON(f),before);
  const a=C.REFERENCE_ASSETS[C.FITS[k].asset],world=q=>C.referenceFitPoint(f,q.map((v,j)=>(v-a.c[j])/a.size[j]));for(const b of a.barrelCenters){const mouth=world(b.muzzle),rear=world(C.sub(b.muzzle,C.mul(b.axis,b.muzzleRecessM))),axis=C.norm(C.sub(mouth,rear)),hit=G.rayFit(C.add(mouth,C.mul(axis,.05)),C.mul(axis,-1),f);assert.ok(hit,k+' posed muzzle remains selectable');near(hit.t,C.len(C.sub(mouth,rear))+.05,.0001);}
 }
});

test('all 42 non-PD authored draw meshes remain byte-identical to the merged rendering baseline',()=>{
 const baseline=require('./helpers/non-pd-render-geometry.json');assert.equal(baseline.sourceGfxSha256,'700cd51ead1815a05cca8a372540c0511171c72530fb9fd04478b3104f64d3cd');assert.equal(baseline.rows.length,42);
 // 2026-11-24 (user: turbolasers drawn below the 0.45 m least bore are thickened to it; the Mon Calamari ball guns' exposed barrels are
 // drawn out to the user's drawings): nine models are reshaped when the game loads (C reshapeGunBarrels, applied in decodeReference),
 // so their drawn positions no longer hash to the baseline. The stored models and the render pipeline are still checked byte for
 // byte against the baseline in a second copy of the game loaded with the reshape switched off (in memory only), and the reshaped
 // draw meshes are checked to differ from it only inside their barrels.
 const px=vm.createContext({console,performance});for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js']){let source=fs.readFileSync(path.join(root,file),'utf8');if(file==='js/core.js'){/* 2026-11-26 test code changed: the entry point gained an option (fullScale, the rapid-fire quad's half-length barrels), so it is found by its name and the end of its parameter list instead of its whole signature */const at=source.indexOf('function reshapeGunBarrels(id,{'),end=source.indexOf('}={}){',at);assert.ok(at>0&&end>at&&end-at<600&&source.indexOf('function reshapeGunBarrels(id,{',at+1)<0,'the reshape entry point');source=source.slice(0,end+6)+'return;'+source.slice(end+6);}vm.runInContext(source,px,{filename:file});}
 const PG=vm.runInContext('Gfx',px),RESHAPED=['light_quad200','light_twin200','light_single200','light_twin200_fast','moncal_single34','moncal_single80','moncal_single200','moncal_triple200','moncal_single150_ion','cis_rapid_quad1'/* 2026-11-26 expectation changed (user「1TTのラビット砲は砲身を今の1/2に」): the rapid-fire quad joins the reshaped models (was nine) */],seen=[];
 for(const row of baseline.rows){const r=G.turretRenderAsset(row.id),p=PG.turretRenderAsset(row.id),a=C.REFERENCE_ASSETS[row.id],reshaped=!!a&&(a.barrelRadiusScale!==undefined||a.barrelExposedScale!==undefined);
  assert.equal(p.asset.n,row.vertices,row.id);assert.equal(p.asset.faces,row.faces,row.id);for(const field of ['pos','uv','idx'])assert.equal(hashArray(p.mesh[field]),row[field],row.id+' stored model and render pipeline unchanged '+field);
  assert.equal(r.asset.n,row.vertices,row.id);assert.equal(r.asset.faces,row.faces,row.id);assert.notEqual(r.asset.minimumPointDefense,true);
  if(!reshaped){for(const field of ['pos','uv','idx'])assert.equal(hashArray(r.mesh[field]),row[field],row.id+' unchanged '+field);continue;}
  seen.push(row.id);for(const field of ['uv','idx'])assert.equal(hashArray(r.mesh[field]),row[field],row.id+' unchanged '+field);assert.notEqual(hashArray(r.mesh.pos),row.pos,row.id+' barrels are reshaped');
  const barrel=new Uint8Array(r.asset.n);for(const b of r.asset.barrelCenters){assert.ok(b.vertices>0&&b.firstVertex+b.vertices<=r.asset.n,row.id+' barrel vertex range');barrel.fill(1,b.firstVertex,b.firstVertex+b.vertices);}
  let moved=0;for(let v=0;v<r.asset.n;v++){const same=[0,1,2].every(k=>r.mesh.pos[v*3+k]===p.mesh.pos[v*3+k]);if(!same){moved++;assert.equal(barrel[v],1,row.id+' vertex '+v+' outside the barrels is unchanged');}}assert.ok(moved>0,row.id);
 }
 assert.deepEqual(seen.sort(),RESHAPED.filter(id=>baseline.rows.some(row=>row.id===id)).sort(),'only the models the user decisions name are reshaped');assert.ok(seen.length>=4);
});
