const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance:{now:()=>0}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),plain=v=>JSON.parse(JSON.stringify(v)),near=(a,b,label)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<.001,`${label}: ${a} != ${b}`);
function fixture(flag){
 const source=C.sourceEngine({skinAsset:'ven_inner_port'}),p={...C.equipmentOptions('exposedTurbine'),id:2,k:'engine',c:[80,90,15],dir:[-1,0,0],d:source.d,skinAsset:'ven_inner_port',skinAnchor:source.anchor.slice(),skinDiameter:source.d};
 C.resizeEngine(p,source.d,C.engineBaseline('exposed',source.d,'length'));
 Object.assign(p,{reactor:1,busFeed:true,propulsionModelVersion:1,driveProfileId:'standard',machineryGradeId:'standard',machineryShape:'cylinder',machineryLengthM:180,machineryRadiusM:42,machineryOffsetM:p.nozzleLength/2,machineryFeedRadiusM:.1,legacyCoolingInputW:0});
 p.ratedInputW=Math.PI*p.machineryRadiusM**2*p.machineryLengthM*C.PROPULSION.referenceInputDensity;if(flag!==undefined)p.exposedMachinery=flag;
 const s=C.newShip({assembly:true,L:600,W:300,H:200},'Visible enlarged external machine');s.parts=[{id:1,k:'gen',c:[420,90,15],d:20},p];s.fits=[];s.detail=0;s.nextId=3;s.links=[{kind:'power',from:'p1',to:'p2',cap:p.ratedInputW}];s.armor={hull:0,cit:0};return s;
}
const owner=s=>s.parts.find(p=>p.id===2),machine=s=>C.engineMachineryPaths(s).find(p=>p.nozzle===2);
function rows(mesh,id){return (mesh.ranges[id]||[]).flatMap(([layer,start,count])=>{const g=mesh.g[layer],out=[];for(let i=start;i<start+count;i++){const k=g.idx[i];out.push({layer,p:Array.from(g.pos.subarray(k*3,k*3+3)),n:Array.from(g.nor.subarray(k*3,k*3+3))});}return out;});}
function buffer(g){return {pos:Array.from(g.pos.subarray(0,g.n*3)),nor:Array.from(g.nor.subarray(0,g.n*3)),uv:Array.from(g.uv.subarray(0,g.n*2)),col:Array.from(g.col.subarray(0,g.n*4)),idx:Array.from(g.idx.subarray(0,g.ni))};}
function assertBody(mesh,body,layer,ship){
 const points=rows(mesh,body.id);assert.ok(points.length>0);assert.deepEqual(new Set(points.map(p=>p.layer)),new Set([layer]));
 const b=C.partAABB(body),s=body.machinerySegment,along=[],radius=[];
 for(const row of points){assert.ok(row.p.every(Number.isFinite)&&row.n.every(Number.isFinite));assert.ok(row.p.every((v,a)=>v>=b[a]-.001&&v<=b[a+3]+.001),'rendered machine stays in its paid occupied bounds');const delta=C.sub(row.p,s.a),t=C.dot(delta,s.u);along.push(t);radius.push(C.len(C.sub(delta,C.mul(s.u,t))));}
 near(Math.min(...along),0,'physical machine inlet');near(Math.max(...along),s.l,'physical machine outlet');near(Math.max(...radius),s.r1,'physical machine radius');
 const midpoint=C.add(s.a,C.mul(s.u,s.l/2)),origin=C.add(midpoint,C.mul(s.v,s.r1+10)),hit=C.rayPart(origin,C.mul(s.v,-1),body);assert.ok(hit&&hit.t<10.001,'the visible enlarged body has a real selectable occupied surface');
 const bounds=G.shipBounds(ship);assert.ok(b.every((v,a)=>a<3?v>=bounds[a]-.001:v<=bounds[a]+.001),'camera bounds contain the actual external machine');
}

test('only explicit exposed machines leave the diagnostic plant layer; complete source casings and other draw layers stay identical',()=>{
 const old=fixture(),visible=fixture(true),a=G.meshParts(old,{coded:false}),b=G.meshParts(visible,{coded:false}),body=machine(old),shown=machine(visible);
 assertBody(a,body,'plant',old);assertBody(b,shown,'engine',visible);assert.deepEqual(rows(a,body.id).map(({p,n})=>({p,n})),rows(b,shown.id).map(({p,n})=>({p,n})),'classification moves the same physical mesh');
 assert.deepEqual(Array.from(C.engineSkinMesh(owner(old)).pos),Array.from(C.engineSkinMesh(owner(visible)).pos));
 for(const layer of Object.keys(a.g).filter(k=>k!=='plant'&&k!=='engine'))assert.deepEqual(buffer(b.g[layer]),buffer(a.g[layer]),layer+' remains unchanged');
 for(const flag of [false,'true',1]){const s=fixture(flag),mesh=G.meshParts(s,{coded:false});assert.ok(mesh.ranges[machine(s).id].every(([name])=>name==='plant'),'legacy and non-boolean values retain the existing diagnostic layer');}
});

test('edited external machinery grows in the visible mesh without moving or resizing its nozzle skin',()=>{
 const s=fixture(true),p=owner(s),saved=C.publicJSON(p),skin=Array.from(C.engineSkinMesh(p).pos),start=machine(s),a=G.meshParts(s,{coded:true});assertBody(a,start,'engine',s);
 assert.equal(C.publicJSON(p),saved,'drawing cannot alter any physical rating or dimension');p.machineryLengthM*=1.3;p.machineryRadiusM*=1.2;p.ratedInputW=Math.PI*p.machineryRadiusM**2*p.machineryLengthM*C.PROPULSION.referenceInputDensity;
 const body=machine(s),mesh=G.meshParts(s,{coded:false});assertBody(mesh,body,'engine',s);near(body.machinerySegment.l/start.machinerySegment.l,1.3,'length edit');near(body.machinerySegment.r1/start.machinerySegment.r1,1.2,'radius edit');assert.deepEqual(Array.from(C.engineSkinMesh(p).pos),skin,'the original complete nozzle/casing mesh is retained');
 const preview=G.meshPreview(s,[p],[],{coded:false});assert.ok(preview.preview.ni>0&&preview.previewRef.ni>0,'the cheap requested preview includes both machine and complete nozzle skin');const q=preview.preview,bounds=[0,1,2].map(a=>Math.min(...Array.from({length:q.n},(_,i)=>q.pos[i*3+a]))).concat([0,1,2].map(a=>Math.max(...Array.from({length:q.n},(_,i)=>q.pos[i*3+a]))));assert.ok(rows(mesh,body.id).every(({p})=>p.every((v,a)=>v>=bounds[a]-.001&&v<=bounds[a+3]+.001)),'live preview includes the complete enlarged rendered body');
});

test('saving and mirroring retain explicit exterior classification, physical geometry and unchanged nozzle mouths',()=>{
 const s=fixture(true),p=owner(s),skin=Array.from(C.engineSkinMesh(p).pos),body=plain(machine(s)),loaded=C.deserialize(plain(C.serialize(s))),copy=owner(loaded);assert.equal(copy.exposedMachinery,true);
 const mesh=G.meshParts(loaded,{coded:false});assertBody(mesh,machine(loaded),'engine',loaded);assert.deepEqual(Array.from(C.engineSkinMesh(copy).pos),skin);assert.deepEqual(plain(machine(loaded).segments),body.segments);
 for(const q of [C.mirrorPart(p,s),C.vmirrorPart(p,s)]){assert.equal(q.exposedMachinery,true);near(q.machineryLengthM,p.machineryLengthM,'mirrored machine length');near(q.machineryRadiusM,p.machineryRadiusM,'mirrored machine radius');}
 const legacy=fixture(),reloaded=C.deserialize(plain(C.serialize(legacy)));assert.equal(owner(reloaded).exposedMachinery,undefined);assert.ok(G.meshParts(reloaded,{coded:false}).ranges[machine(reloaded).id].every(([name])=>name==='plant'));
});

test('changing a flagged external engine to an internal type returns its actual machine to the diagnostic layer',()=>{
 const s=fixture(true),p=owner(s);p.propulsionModelVersion=C.PROPULSION_MODEL_VERSION;
 const exterior=G.meshParts(s,{coded:false});assertBody(exterior,machine(s),'engine',s);
 p.equipmentId='internalTurbine';C.enforceEquipment(p);assert.equal(p.exposedMachinery,true,'the saved refit flag can remain after changing equipment type');assert.equal(C.equipmentSpec(p).engineStyle,'internal');
 const internal=G.meshParts(s,{coded:false});assertBody(internal,machine(s),'plant',s);assert.equal(internal.ranges[machine(s).id].some(([layer])=>layer==='engine'),false,'an internal type cannot leave the physical body in the exterior layer');
 const loaded=C.deserialize(plain(C.serialize(s))),drawn=G.meshParts(loaded,{coded:false});assert.equal(owner(loaded).exposedMachinery,true);assert.equal(C.equipmentSpec(owner(loaded)).engineStyle,'internal');assertBody(drawn,machine(loaded),'plant',loaded);
});
