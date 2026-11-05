const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance:{now:()=>0}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),plain=v=>JSON.parse(JSON.stringify(v));
const near=(a,b,eps=3e-4)=>assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`),vector=(a,b,eps)=>a.forEach((v,i)=>near(v,b[i],eps));
function data(){const spec=C.FITS.quad500;assert.ok(spec,'the user-specified medium quad must be a reusable fitting');const asset=C.REFERENCE_ASSETS[spec.asset];assert.ok(asset,'the fitting must use a real reference mesh');return {spec,asset,mesh:C.decodeReference(spec.asset)};}
function point(a,m,i){return [0,1,2].map(k=>m.pos[i*3+k]*a.size[k]+a.c[k]);}
function bounds(a,m,ids){const b=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];for(const i of ids)point(a,m,i).forEach((v,k)=>{assert.ok(Number.isFinite(v));b[k]=Math.min(b[k],v);b[k+3]=Math.max(b[k+3],v);});return b;}
function components(mesh,start,end,indexStart,indexEnd){
 const parent=Array.from({length:end},(_,i)=>i),find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;},join=(a,b)=>{parent[find(a)]=find(b);},positions=new Map();
 for(let i=start;i<end;i++){const p=Array.from(mesh.pos.subarray(i*3,i*3+3)).join(',');if(positions.has(p))join(i,positions.get(p));else positions.set(p,i);}
 for(let i=indexStart;i<indexEnd;i+=3){const t=Array.from(mesh.idx.subarray(i,i+3));assert.ok(t.every(j=>j>=start&&j<end),'housing and barrel triangles remain separate');join(t[0],t[1]);join(t[0],t[2]);}
 const rows=new Map();for(let i=start;i<end;i++){const key=find(i);if(!rows.has(key))rows.set(key,[]);rows.get(key).push(i);}return [...rows.values()];
}
function barrelTriangles(a,mesh,row){const out=new Float32Array(row.indices*3);for(let i=0;i<row.indices;i++)point(a,mesh,mesh.idx[row.firstIndex+i]).forEach((v,k)=>out[i*3+k]=v);return out;}

test('the 500 GT medium quad uses four 500 GT bolts and retains its measured Arquitens envelope',()=>{
 const {spec:d,asset:a,mesh}=data();assert.equal(d.asset,'arq_turret_quad500');assert.equal(d.barrels,4);near(d.boltTT,.5,1e-12);near(d.tt,2,1e-12);near(d.power*d.cycle/C.TT,2,1e-12);
 assert.equal(a.derivedFrom,'pd_turret_small');assert.equal(a.plainMetal,true);assert.equal(a.barrels,4);assert.deepEqual(plain(a.mount),[0,0,0]);assert.deepEqual(plain(a.forward),[1,0,0]);assert.deepEqual(plain(a.up),[0,1,0]);
 assert.equal(C.REFERENCE_ASSETS.pd_turret_small,undefined,'the source point-defense model was removed; the derived quad keeps its own mesh');
 vector(a.size,[17.8304,5.8065,14.1041]);vector([d.fm,d.hm,d.wm],a.size);near(C.weaponModelScale('quad500'),1,1e-12);
 const b=bounds(a,mesh,Array.from({length:a.n},(_,i)=>i));near(b[1],0);vector([b[3]-b[0],b[4]-b[1],b[5]-b[2]],a.size);assert.ok(b[0]<0&&b[3]>0,'the turntable pivot is behind the projecting muzzles');
});

test('the actual mesh has four complete connected slender cylinders in vertical port/starboard pairs',()=>{
 const {asset:a,mesh}=data();assert.ok(a.sourceHousingVertices>0&&a.sourceHousingFaces>0);assert.ok(a.housingVertices>=a.sourceHousingVertices&&a.housingFaces>=a.sourceHousingFaces);
 const groups=components(mesh,a.housingVertices,a.n,a.housingFaces*3,mesh.idx.length);assert.equal(groups.length,4,'count the actual connected tubes, rather than the advertised barrel number');
 const rows=groups.map(ids=>{const b=bounds(a,mesh,ids);return {b,c:[0,1,2].map(k=>(b[k]+b[k+3])/2),s:[0,1,2].map(k=>b[k+3]-b[k])};});
 const left=rows.filter(r=>r.c[2]<0).sort((a,b)=>a.c[1]-b.c[1]),right=rows.filter(r=>r.c[2]>0).sort((a,b)=>a.c[1]-b.c[1]);assert.equal(left.length,2);assert.equal(right.length,2);
 for(const column of [left,right]){near(column[0].c[2],column[1].c[2]);near(column[0].c[0],column[1].c[0]);assert.ok(column[1].b[1]>column[0].b[4],'vertically stacked barrels must remain visibly distinct');}
 for(let i=0;i<2;i++){near(left[i].c[1],right[i].c[1]);near(left[i].c[2],-right[i].c[2]);}
 for(const row of rows){vector(row.s,rows[0].s);assert.ok(row.s[0]>row.s[1]*8&&row.s[0]>row.s[2]*8,'complete barrels extend along +X');near(row.s[1],row.s[2],.015);assert.ok(row.b[3]>10,'the muzzle must project beyond the original housing');}
 assert.equal(a.barrelCenters.length,4);
 for(const row of a.barrelCenters){assert.equal(components(mesh,row.firstVertex,row.firstVertex+row.vertices,row.firstIndex,row.firstIndex+row.indices).length,1,'each full barrel, breech and recessed muzzle is connected');const b=bounds(a,mesh,Array.from({length:row.vertices},(_,i)=>row.firstVertex+i));assert.ok((b[3]-b[0])/(2*row.outerRadiusM)>20,'the photographed exposed tubes remain slender');}
});

test('the four cylindrical shanks have real recessed muzzle openings at their declared planes',()=>{
 const {asset:a,mesh}=data();
 for(const row of a.barrelCenters){const T=barrelTriangles(a,mesh,row),axis=row.axis;vector(axis,[1,0,0],1e-9);const [x,y,z]=row.muzzle,origin=[x+1,y,z],back=C.rayTris(T,origin,[-1,0,0]),rim=C.rayTris(T,[x+1,y+(row.boreRadiusM+row.outerRadiusM)/2,z],[-1,0,0]);assert.ok(back&&rim,'both the bore cavity and its surrounding lip exist');near(rim.p[0],x,.001);near(back.p[0],x-row.muzzleRecessM,.001);assert.ok(back.t>rim.t+.1,'the bore is recessed geometry rather than a painted front cap');
  for(const distance of [.75,1.5,2.25]){const station=x-distance,vertical=C.rayTris(T,[station,y+1,z],[0,-1,0]),lateral=C.rayTris(T,[station,y,z+1],[0,0,-1]);assert.ok(vertical&&lateral);near(vertical.p[1]-y,row.outerRadiusM,.0015);near(lateral.p[2]-z,row.outerRadiusM,.0015);near(vertical.p[1]-y,lateral.p[2]-z,.0015);}
  const lip=Array.from({length:row.vertices},(_,i)=>point(a,mesh,row.firstVertex+i)).filter(p=>Math.abs(p[0]-x)<.001&&Math.abs(Math.hypot(p[1]-y,p[2]-z)-row.outerRadiusM)<.0015),angles=new Set(lip.map(p=>Math.atan2(p[2]-z,p[1]-y).toFixed(4)));assert.ok(angles.size>=24,'each muzzle has a genuinely circular ring of mesh vertices');
 }
});

test('physical mounting, draw vertices and selectable bounds agree in every axis and a tilted mount',()=>{
 const {asset:a}=data(),frames=[...Array.from({length:6},(_,a)=>({a})),{a:2,tilt:C.norm([.2,.93,.3])}];
 for(const frame of frames){const f={id:1,k:'quad500',p:[33,-9,21],ped:0,base:0,low:0,float:false,assetYaw:37.25,...frame},pivot=a.c.map((v,i)=>-v/a.size[i]);vector(C.referenceFitPoint(f,pivot),C.fitOrigin(f),1e-6);
  const mesh=G.meshFits({fits:[f]}),b=C.fitAABB(f);assert.equal(mesh.ni,a.faces*3);
  for(let i=0;i<mesh.ni;i++){const j=mesh.idx[i]*3;for(let k=0;k<3;k++){const v=mesh.pos[j+k];assert.ok(v>=b[k]-.0005&&v<=b[k+3]+.0005,`mount ${frame.a}: drawn vertex must be selectable`);}}
  const row=a.barrelCenters[0],world=p=>C.referenceFitPoint(f,p.map((v,i)=>(v-a.c[i])/a.size[i])),origin=world(C.add(row.muzzle,[1,0,0])),expected=world(C.sub(row.muzzle,[row.muzzleRecessM,0,0])),hit=G.rayFit(origin,C.norm(C.sub(expected,origin)),f);assert.ok(hit,'the visible recessed bore is selectable in every mounting frame');vector(hit.p,expected,.002);
 }
});

test('editor preview and fleet trial preserve the complete quad with separate yaw and elevation joints',()=>{
 const {asset:a}=data(),s=C.newShip({L:100,W:70,H:50,assembly:true},'Arquitens main battery');s.parts=[];
 const f={id:1,k:'quad500',p:[50,50,15],a:2,ped:0,base:0,low:0,float:false,assetYaw:28.5};s.fits=[f];
 const editor=G.meshFits(s),preview=G.meshPreview(s,[],[f]);assert.equal(editor.ni,a.faces*3);assert.equal(preview.previewFits.ni+preview.previewRefFits.ni,a.faces*3);
 const fleet=G.fleetGeometry(s,{trial:true}),t=fleet.turrets.find(t=>t.id===f.id),joint=C.authoredTurretGeometry(f);assert.ok(t&&joint);assert.equal(t.k,'quad500');assert.equal(t.barrels,4);assert.equal(fleet.meshes[t.bodyMesh].geo.ni,a.elevationIndexStart);assert.equal(fleet.meshes[t.mesh].geo.ni,a.faces*3-a.elevationIndexStart);vector(t.bodyPivot,C.fitOrigin(f),1e-6);vector(t.pivot,joint.elevationPivot,1e-6);assert.ok(C.len(C.sub(t.pivot,t.bodyPivot))>3,'elevation uses the real raised drive joint, distinct from the turntable floor');
});
