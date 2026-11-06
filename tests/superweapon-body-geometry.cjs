const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),ctx=vm.createContext({console,performance:{now:()=>0}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',ctx),plain=v=>JSON.parse(JSON.stringify(v));
const near=(a,b,e=3e-5)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=e,`${a} != ${b}`),vector=(a,b,e)=>a.forEach((n,i)=>near(n,b[i],e));
function chamber(){const mesh={v:[],f:[]},s=[100,100,100];for(const [lo,hi]of [[[-10,-2,-2],[10,2,2]],[[-8,-3,8],[8,3,16]]]){const n=mesh.v.length;mesh.v.push(...[[lo[0],lo[1],lo[2]],[hi[0],lo[1],lo[2]],[hi[0],hi[1],lo[2]],[lo[0],hi[1],lo[2]],[lo[0],lo[1],hi[2]],[hi[0],lo[1],hi[2]],[hi[0],hi[1],hi[2]],[lo[0],hi[1],hi[2]]].map(p=>p.map(v=>v/100)));mesh.f.push(...[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]].map(f=>f.map(i=>i+n)));}return {s,mesh};}
function part(){return C.normalizeSuperweapon({id:1,k:'sbeam',c:[100,40,20],weaponBody:chamber(),weaponMuzzle:[10,0,0]});}
function empty(){const s=C.newShip({L:300,W:180,H:100,sec:'rect',plan:'rect',assembly:true},'Physical cannon chambers');s.parts=[];s.fits=[];s.hatches=[];s.links=[];s.armor={hull:0,cit:0};s.detail=0;s.nextId=2;return s;}
function points(p){const T=C.superweaponBodyTriangles(p),out=[];for(let i=0;i<T.length;i+=3)out.push(Array.from(T.slice(i,i+3)));return out;}
function meshMatches(p,source,transform){const expected=source.map(transform),actual=points(p);assert.equal(actual.length,expected.length);for(const v of actual)assert.ok(expected.some(q=>Math.hypot(...v.map((n,i)=>n-q[i]))<4e-5),`missing transformed point ${v}`);}
function rotate(v,axis,a){const c=Math.cos(a),s=Math.sin(a);return axis===0?[v[0],c*v[1]-s*v[2],s*v[1]+c*v[2]]:axis===1?[c*v[0]+s*v[2],v[1],-s*v[0]+c*v[2]]:[c*v[0]-s*v[1],s*v[0]+c*v[1],v[2]];}

test('paid cannon volume and picking follow both solids while the intervening gap stays empty',()=>{
 const p=part();near(C.partVolume(p),1088);near(C.partBuildCost(p),1088*C.PARTS.sbeam.cost);vector(C.partAABB(p),[90,37,18,110,43,36]);assert.ok(C.partDims(p).r>=Math.hypot(10,3,16));
 assert.equal(C.inPart(p,[100,40,20]),true);assert.equal(C.inPart(p,[100,40,32]),true);assert.equal(C.inPart(p,[100,40,25]),false);
 const room={id:2,k:'hangar',c:[100,40,32],room:[4,4,4],d:4,autoFit:false};assert.equal(C.overlapParts(p,room),true,'the wing machinery is occupied, not decoration');room.c=[100,40,25];assert.equal(C.overlapParts(p,room),false,'its bounding box must not become a solid box');
 const hit=C.rayPart([100,60,32],[0,-1,0],p);assert.ok(hit);near(hit.t,17);vector(hit.p,[100,43,32]);
 assert.ok(C.volSamples(p).some(q=>q[2]>28),'sampling includes the separate wing chamber');
});

test('a muzzle stays on the barrel when the paid machinery grows off to one side',()=>{
 const p=part(),s=empty();s.parts=[p];vector(C.superweaponMuzzle(p),[110,40,20]);vector(C.superweaponAxis(p),[1,0,0]);assert.equal(C.superweaponOpen(s,p),true);
 const wider=chamber();wider.s[1]=200;p.weaponBody=wider;vector(C.superweaponMuzzle(p),[110,40,20]);vector(C.partAABB(p),[90,37,16,110,43,52]);assert.equal(C.superweaponOpen(s,p),true);
 s.parts.push({id:2,k:'gen',c:[111,40,20],d:4});assert.equal(C.superweaponOpen(s,p),false,'a real obstruction at the independent barrel muzzle blocks firing');
});

test('serialization retains machinery solids, the muzzle, orientation, paid mass and cost',()=>{
 const p=part(),s=empty();Object.assign(p,{yaw:17,pitch:-9,roll:14});s.parts=[p];const volume=C.partVolume(p),cost=C.partBuildCost(p),T=points(p),m=C.superweaponMuzzle(p),axis=C.superweaponAxis(p),stats=C.computeStats(s),saved=plain(C.serialize(s)),loaded=C.deserialize(saved),q=loaded.parts.find(x=>x.id===1),again=C.computeStats(loaded);
 assert.ok(q.weaponBody);assert.deepEqual(plain(q.weaponMuzzle),[10,0,0]);near(C.partVolume(q),volume,.001);near(C.partBuildCost(q),cost,.01);vector(C.superweaponMuzzle(q),m);vector(C.superweaponAxis(q),axis);meshMatches(q,T,v=>v);near(again.mass,stats.mass,.001);near(again.cost,stats.cost,1);
 for(const bad of [{s:[100,0,100],mesh:chamber().mesh},{s:[100,100,100],mesh:{...chamber().mesh,f:chamber().mesh.f.slice(1)}}]){const input=plain(saved);input.parts[0].weaponBody=bad;assert.throws(()=>C.deserialize(input),/超兵器/);}
});

test('both mirrors preserve the exact reflected machinery and muzzle at arbitrary orientation',()=>{
 const p=part(),s=empty();Object.assign(p,{yaw:17,pitch:-9,roll:14});s.parts=[p];const T=points(p),m=C.superweaponMuzzle(p),axis=C.superweaponAxis(p);
 const h=C.mirrorPart(p,s);meshMatches(h,T,C.mirrorP);vector(C.superweaponMuzzle(h),C.mirrorP(m));vector(C.superweaponAxis(h),C.mirrorP(axis));near(C.partVolume(h),C.partVolume(p),.001);
 const v=C.vmirrorPart(p,s);meshMatches(v,T,q=>C.vmirrorPoint(s,q));vector(C.superweaponMuzzle(v),C.vmirrorPoint(s,m));vector(C.superweaponAxis(v),[axis[0],-axis[1],axis[2]]);near(C.partVolume(v),C.partVolume(p),.001);
});

for(const axis of [0,1,2])test('rotational arrays carry the complete chamber and separate muzzle around axis '+axis,()=>{
 const p=part(),s=empty();Object.assign(p,{yaw:17,pitch:-9,roll:14});s.parts=[p];const T=points(p),m=C.superweaponMuzzle(p),dir=C.superweaponAxis(p),result=C.placeRotationalCopies(s,{parts:[1],fits:[]},{center:[0,0,0],axis,count:4});assert.equal(result.ok,true,result.error);
 const check=ship=>result.copies.forEach((copy,i)=>{const q=ship.parts.find(x=>x.id===copy.parts[0]),a=(i+1)*Math.PI/2;meshMatches(q,T,v=>rotate(v,axis,a));vector(C.superweaponMuzzle(q),rotate(m,axis,a));vector(C.superweaponAxis(q),rotate(dir,axis,a));});check(s);check(C.deserialize(plain(C.serialize(s))));
});

test('the rendered chamber uses the same triangles as collision and selectable bounds',()=>{
 const p=part(),s=empty();s.parts=[p];const before=C.partVolume(p),T=C.superweaponBodyTriangles(p),mesh=G.meshParts(s,{coded:true}),g=mesh.g.hyper;assert.equal(g.ni,T.length/3);assert.ok(mesh.ranges[p.id].some(([kind])=>kind==='hyper'));const b=C.partAABB(p);for(let i=0;i<g.ni;i++){const at=g.idx[i]*3;for(let a=0;a<3;a++)assert.ok(g.pos[at+a]>=b[a]-1e-5&&g.pos[at+a]<=b[a+3]+1e-5);}near(C.partVolume(p),before);
});

test('new placement mirrors the complete paid chamber and rejects invalid bodies before changing the design',()=>{
 const s=empty(),body=chamber(),p=C.placePart(s,'sbeam',[100,40,25],38.2,{weaponBody:body,weaponMuzzle:[10,0,0],yaw:17,pitch:8,roll:14},true);assert.equal(s.parts.length,2);const q=s.parts.find(x=>x.id===p.tw);assert.ok(q);meshMatches(q,points(p),C.mirrorP);vector(C.superweaponMuzzle(q),C.mirrorP(C.superweaponMuzzle(p)));near(C.partVolume(q),C.partVolume(p),.001);
 const before=C.publicJSON(s),invalid=chamber();invalid.mesh.f.pop();assert.throws(()=>C.placePart(s,'sbeam',[200,40,25],38.2,{weaponBody:invalid},true),/超兵器/);assert.equal(C.publicJSON(s),before,'invalid input must not leak a part or nextId');
});

test('separate chamber components cannot cancel one another through opposite face winding',()=>{
 const p=part(),body=chamber();body.mesh.f=body.mesh.f.map((face,i)=>i>=6?face.slice().reverse():face);p.weaponBody=body;C.normalizeSuperweapon(p);near(C.partVolume(p),1088);assert.equal(C.inPart(p,[100,40,32]),true);
});

test('legacy fixed cylinders keep their original physical volume and muzzle',()=>{
 const p=C.normalizeSuperweapon({id:1,k:'sbeam',c:[900,50,20],d:1});assert.equal(C.superweaponShape(p),null);near(C.partVolume(p),Math.PI*(38.2/2)**2*665.8,.001);vector(C.superweaponMuzzle(p),[1232.9,50,20]);vector(C.superweaponAxis(p),[1,0,0]);
 const ion=C.normalizeSuperweapon({id:2,k:'hion',c:[900,50,-20],d:1});vector(C.superweaponAxis(ion),[0,0,-1]);vector(C.superweaponMuzzle(ion),[900,50,-20-C.SUPERWEAPONS.hion.length/2]);
});

test('turret firing-line tests preserve empty gaps and block the actual wing machinery',()=>{
 const p=part(),s=empty();s.parts=[p];const f={id:2,k:'pd',p:[70,40,25],a:2,ped:0,base:0,low:0},g=C.authoredTurretGeometry(f),context=C.turretRayContext(s);assert.ok(g);assert.ok(context.obst.some(o=>o.part===p));
 const clearAt=z=>C.turretClear(s,f,[1,0,0],context,g.muzzles.map(()=>[70,40,z]));assert.equal(clearAt(25),true,'a bounding box is not a solid machinery obstruction');assert.equal(clearAt(32),false,'the separate wing chamber blocks its real beam path');assert.equal(clearAt(20),false,'the barrel body blocks its real beam path');
});

test('surface exposure follows the two actual chamber footprints and refreshes when their dimensions change',()=>{
 const p=part(),s=empty();s.parts=[p,{id:2,k:'struct',c:[100,34,25],s:[50,30,12],form:'box'}];s.nextId=3;const top=()=>C.surfacePatches(s).find(row=>row.host==='p2'&&row.face==='top');near(top().exposedArea,1500-80-128,.001);
 const body=chamber();body.s[0]=50;p.weaponBody=body;near(top().exposedArea,1500-40-64,.001);
});

test('selection and ghost outlines trace the same machinery corners as the rendered solids',()=>{
 const p=part();Object.assign(p,{yaw:17,pitch:-9,roll:14});const lines=G.lineSet();lines.part(p,[255,255,0,255]);const outline=lines.out().pos,vertices=points(p);assert.equal(outline.length,2*12*6,'two box components contribute twelve real edges each');for(let i=0;i<outline.length;i+=3){const q=Array.from(outline.slice(i,i+3));assert.ok(vertices.some(v=>C.len(C.sub(v,q))<4e-5),'selection line endpoints lie on actual chamber corners');}
 const s=empty();s.parts=[p];const preview=G.meshPreview(s,[p],[],{coded:true});assert.equal(preview.preview.ni,C.superweaponBodyTriangles(p).length/3,'the same paid body appears in live previews');
});
