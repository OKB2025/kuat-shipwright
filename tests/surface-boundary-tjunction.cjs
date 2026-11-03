const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx);

test('native apparatus masking retains real aperture reveals without extruding triangulation T-junctions',()=>{
 const s=C.newShip({L:300,W:180,H:160,assembly:true},'Masked apparatus boundary');s.parts=[];s.fits=[];s.armor={hull:0,cit:0};s.detail=0;
 const host=C.placePart(s,'struct',[120,70,0],[160,100,100],{form:'box',skin:'plain'},false);
 for(const [k,c,d]of [['gen',[120,70,-42],12],['sensor',[75,70,-42],10],['gen',[165,70,-52],12],['sensor',[100,70,-55],10]])s.parts.push({id:s.nextId++,k,c,d});
 const patch=C.surfacePatches(s).find(p=>p.host==='p'+host.id&&p.face==='port');
 assert.equal(C.setSurfaceConfig(s,patch.id,{functionMode:'equipment',allocation:{cooling:100,sensors:0,habitation:0},equipment:{kind:'hdis',depth:1},battery:{count:0},style:{depth:16,density:0,seed:37}}).ok,true);
 const saved=C.publicJSON(s),row=G.surfaceVisualPlan(s).find(p=>p.id===patch.id),T=row.triangles,n=row.patch.normal;
 assert.ok(T.length>18,'native apparatus must produce the actual subdivided exposure mask');
 const contains=p=>!!C.rayTris(T,C.add(p,n),C.mul(n,-1)),sides=(a,b)=>{const length=C.len(C.sub(b,a)),m=C.mul(C.add(a,b),.5),left=C.mul(C.norm(C.cross(n,C.sub(b,a))),Math.min(.0002,length*.01));return [contains(C.add(m,left)),contains(C.sub(m,left))];};
 let outer=0,aperture=0;
 for(const e of row.boundary){
  const length=C.len(C.sub(e.b,e.a));if(length<.001)continue;
  assert.deepEqual(sides(e.a,e.b),[true,false],'oriented boundary must separate exposed surface from empty space');
  const m=C.mul(C.add(e.a,e.b),.5);if(Math.abs(m[0]-40)<.001||Math.abs(m[0]-200)<.001||Math.abs(m[1]-20)<.001||Math.abs(m[1]-120)<.001)outer+=length;else aperture+=length;
 }
 assert.ok(Math.abs(outer-520)<.001,'all four real outer borders must remain');assert.ok(aperture>20,'native apparatus aperture borders must remain');
 const g=G.meshSurfaceLayers(s,{}).surfaceArmor;let reveals=0;
 for(let i=0;i<g.ni;i+=3){
  const p=[0,1,2].map(j=>Array.from(g.pos.slice(g.idx[i+j]*3,g.idx[i+j]*3+3))),z=p.map(q=>q[2]);if(Math.max(...z)-Math.min(...z)<.001||Math.min(...z)<-50.001||Math.max(...z)>-33.999)continue;
  // Reveal vertices project to one physical surface boundary. Inspect the
  // actual emitted triangles, allowing the backing's 0.1 mm inward nudge
  // and Float32 upload rounding at the edges of tiny aperture fragments.
  const projected=p.map(q=>[q[0],q[1],-50]),distance=(q,e)=>{const d=C.sub(e.b,e.a),t=C.clamp(C.dot(C.sub(q,e.a),d)/C.dot(d,d),0,1);return C.len(C.sub(q,C.add(e.a,C.mul(d,t))));};
  assert.ok(row.revealBoundary.some(e=>projected.every(q=>distance(q,e)<.00015)),'actual reveal triangle crosses an internal triangulation edge');reveals++;
 }
 assert.ok(reveals>8,'native apertures and real outer borders must emit reveal triangles');
 const lines=G.surfaceSelectionLines(s,[patch.id]);assert.ok(lines.pos.length>0);
 for(let i=0;i<lines.pos.length;i+=6){const a=Array.from(lines.pos.slice(i,i+3)),b=Array.from(lines.pos.slice(i+3,i+6));a[2]=b[2]=-50;if(C.len(C.sub(b,a))>.001){const q=sides(a,b);assert.notEqual(q[0],q[1],'selection highlight contains an internal triangulation edge');}}
 assert.equal(C.publicJSON(s),saved,'boundary generation must not alter the saved vessel');
});
