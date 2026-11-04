const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
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

test('the 500 GT medium quad uses four 500 GT bolts and retains its measured Arquitens envelope',()=>{
 const {spec:d,asset:a,mesh}=data();assert.equal(d.asset,'arq_turret_quad500');assert.equal(d.barrels,4);near(d.boltTT,.5,1e-12);near(d.tt,2,1e-12);near(d.power*d.cycle/C.TT,2,1e-12);
 assert.equal(a.derivedFrom,'pd_turret_small');assert.equal(a.plainMetal,true);assert.equal(a.barrels,4);assert.deepEqual(plain(a.mount),[0,0,0]);assert.deepEqual(plain(a.forward),[1,0,0]);assert.deepEqual(plain(a.up),[0,1,0]);
 vector(a.size,[17.8304,5.8065,14.1041]);vector([d.fm,d.hm,d.wm],a.size);near(C.weaponModelScale('quad500'),1,1e-12);
 const b=bounds(a,mesh,Array.from({length:a.n},(_,i)=>i));near(b[1],0);vector([b[3]-b[0],b[4]-b[1],b[5]-b[2]],a.size);assert.ok(b[0]<0&&b[3]>0,'the turntable pivot is behind the projecting muzzles');
});

test('the actual mesh has two vertical barrels on the left and two on the right',()=>{
 const {asset:a,mesh}=data();assert.ok(a.housingVertices>0&&a.housingFaces>0);
 const groups=components(mesh,a.housingVertices,a.n,a.housingFaces*3,mesh.idx.length);assert.equal(groups.length,4,'count the actual connected tubes, rather than the advertised barrel number');
 const rows=groups.map(ids=>{const b=bounds(a,mesh,ids);return {b,c:[0,1,2].map(k=>(b[k]+b[k+3])/2),s:[0,1,2].map(k=>b[k+3]-b[k])};});
 const left=rows.filter(r=>r.c[2]<0).sort((a,b)=>a.c[1]-b.c[1]),right=rows.filter(r=>r.c[2]>0).sort((a,b)=>a.c[1]-b.c[1]);assert.equal(left.length,2);assert.equal(right.length,2);
 for(const column of [left,right]){near(column[0].c[2],column[1].c[2]);near(column[0].c[0],column[1].c[0]);assert.ok(column[1].b[1]>column[0].b[4],'vertically stacked barrels must remain visibly distinct');}
 for(let i=0;i<2;i++){near(left[i].c[1],right[i].c[1]);near(left[i].c[2],-right[i].c[2]);}
 for(const row of rows){vector(row.s,rows[0].s);assert.ok(row.s[0]>row.s[1]*8&&row.s[0]>row.s[2]*8,'complete barrels extend along +X');near(row.s[1],row.s[2],.015);assert.ok(row.b[3]>10,'the muzzle must project beyond the original housing');}
 const full=components(mesh,0,a.n,0,mesh.idx.length);assert.equal(full.length,65,'all 61 original housing components plus four whole barrels remain');
});

test('physical mounting, draw vertices and selectable bounds agree in every axis and a tilted mount',()=>{
 const {asset:a}=data(),frames=[...Array.from({length:6},(_,a)=>({a})),{a:2,tilt:C.norm([.2,.93,.3])}];
 for(const frame of frames){const f={id:1,k:'quad500',p:[33,-9,21],ped:0,base:0,low:0,float:false,assetYaw:37.25,...frame},pivot=a.c.map((v,i)=>-v/a.size[i]);vector(C.referenceFitPoint(f,pivot),C.fitOrigin(f),1e-6);
  const mesh=G.meshFits({fits:[f]}),b=C.fitAABB(f);assert.equal(mesh.ni,a.faces*3);
  for(let i=0;i<mesh.ni;i++){const j=mesh.idx[i]*3;for(let k=0;k<3;k++){const v=mesh.pos[j+k];assert.ok(v>=b[k]-.0005&&v<=b[k+3]+.0005,`mount ${frame.a}: drawn vertex must be selectable`);}}
 }
});

test('editor preview and fleet trial use the same quad mesh and turntable pivot',()=>{
 const {asset:a}=data(),s=C.newShip({L:100,W:70,H:50,assembly:true},'Arquitens main battery');s.parts=[];
 const f={id:1,k:'quad500',p:[50,50,15],a:2,ped:0,base:0,low:0,float:false,assetYaw:28.5};s.fits=[f];
 const editor=G.meshFits(s),preview=G.meshPreview(s,[],[f]);assert.equal(editor.ni,a.faces*3);assert.equal(preview.previewFits.ni+preview.previewRefFits.ni,a.faces*3);
 const fleet=G.fleetGeometry(s,{trial:true}),t=fleet.turrets.find(t=>t.id===f.id);assert.ok(t);assert.equal(t.k,'quad500');assert.equal(t.barrels,4);assert.equal(fleet.meshes[t.mesh].geo.ni,a.faces*3);vector(t.pivot,C.fitOrigin(f),1e-6);
});
