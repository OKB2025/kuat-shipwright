const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),ctx=vm.createContext({console,performance});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',ctx);
function fixture(count){
 const s=C.newShip({L:1200,W:400,H:200,sec:'rect',plan:'rect',bowW:1,bowH:1,stern:1},'Compact trench renderer');s.parts=[];s.hatches=[];s.detail=0;s.armor={hull:0,cit:0};s.trenches=[{id:1,side:'both',from:.1,to:.9,level:.5,height:40,depth:30,taper:false}];s.fits=[-1,1].map((side,i)=>({id:i+2,k:'monCal34',p:[600,100,side*170],n:[0,0,side],a:side>0?4:5,localMount:true,ped:0,base:0,low:0,float:false,trenchAggregate:true,noModel:true,aggregateCount:count,trenchRef:{hostId:'hull',trenchId:1,side:side<0?'port':'stbd'}}));s.nextId=4;return s;
}
function configuredFixture(count){
 const s=C.newShip({L:8000,W:2000,H:1000,sec:'rect',plan:'rect',bowW:1,bowH:1,stern:1},'Compact trench geometry');s.parts=[];s.fits=[];s.hatches=[];s.detail=0;s.armor={hull:0,cit:0};
 const result=C.configureTrenchArmament(s,{hostId:'hull',newTrench:{mode:'split',from:.2,to:.8,level:.5,height:400,depth:100,side:'both',taper:false},counts:[{kind:'monCal34',count:count*2}]});assert.equal(result.ok,true,result.error);assert.equal(result.report.mounts,count*2);return s;
}
function renderedVolume(g){const triangles=new Float64Array(g.ni*3);for(let i=0;i<g.ni;i++)triangles.set(g.pos.subarray(g.idx[i]*3,g.idx[i]*3+3),i*3);return C.meshVolume(triangles);}
test('compact trench records never build a gun, pedestal, ghost, selection outline or invisible exterior hit',()=>{
 for(const count of [100,10000]){const s=fixture(count);assert.ok(s.fits.every(C.isTrenchBatteryGroup));
  for(const f of s.fits){assert.equal(G.meshFits(s,null,null,[f]).ni,0);assert.equal(G.meshReferenceFits(s,null,[f]).ni,0);assert.equal(G.placementFittingMesh(s,f).ni,0);assert.equal(G.placementGhostMesh(s,{fit:f,status:'valid'}).ni,0);const lines=G.lineSet();lines.fit(f,[255,0,0,255],s);assert.equal(lines.out().pos.length,0);assert.equal(G.rayFit(C.add(f.p,C.mul(f.n,100)),C.mul(f.n,-1),f),null);}
  const preview=G.meshPreview(s,[],s.fits);assert.equal(preview.previewFits.ni,0);assert.equal(preview.previewRefFits.ni,0);assert.equal(s.fits.length,2,'the renderer does not expand a counted group into individual fittings');
 }
 const s=fixture(1),legacy={...s.fits[0]};delete legacy.trenchAggregate;delete legacy.noModel;delete legacy.aggregateCount;delete legacy.trenchRef;assert.ok(G.meshFits(s,null,null,[legacy]).ni+G.meshReferenceFits(s,null,[legacy]).ni>0,'the same ordinary weapon keeps its existing model');
});

test('100 and 10000 guns retain bounded interior charging geometry and one bounded firing descriptor per group',()=>{
 const results=[];for(const count of [100,10000]){const s=configuredFixture(count),caps=C.weaponCapacitors(s);assert.equal(caps.length,2,'each side has one aggregate charging compartment');assert.ok(caps.every(p=>p.k==='capacitor'&&p.trenchChargeRow&&p.weaponIds?.length>0));
  s._client=true;const full=G.meshParts(s,{coded:true}),interior=full.g.interior;assert.ok(interior.ni>0,'the charging spaces remain visible in the interior layer');const volume=caps.reduce((n,p)=>n+C.partVolume(p),0);assert.ok(Math.abs(renderedVolume(interior)/volume-1)<.001,'the displayed charging solids retain their actual Core volume');
  for(const name of ['struct','plate','gen','shield','hyper','engine','plant','nozzle','hangar','refStruct','refEngine'])assert.equal(full.g[name]?.ni||0,0,name+' contains no generated aggregate gun or charging-room exterior');
  assert.equal(G.meshFits(s).ni,0);assert.equal(G.meshReferenceFits(s).ni,0);const snapshot=C.publicJSON(s);const fleet=G.fleetGeometry(s,{trial:true});assert.equal(C.publicJSON(s),snapshot,'building a firing descriptor cannot expand or change the stored fittings');assert.equal(fleet.turrets.length,2);
  for(const row of fleet.turrets){assert.equal(row.noModel,true);assert.equal(row.mesh,null);assert.equal(row.trenchAggregate,true);assert.equal(row.aggregateCount,count);assert.ok(row.muzzles.length>0&&row.muzzles.length<=8);assert.equal(row.barrels,row.muzzles.length);assert.ok(row.aggregateBarrels>=count);assert.ok(row.volleyTT>0);}
  assert.ok(!Object.entries(fleet.meshes).some(([name,mesh])=>/^(tur_|refTur_|turBody_|refTurBody_)/.test(name)&&mesh.geo.ni>0),'fleet and trial views build no per-gun geometry');
  for(const cap of caps){const lines=G.lineSet();lines.part(cap,[255,0,0,255]);assert.ok(lines.out().pos.length>0,'the real charging compartment remains selectable in the interior');const b=C.partAABB(cap),o=[b[0]-10,(b[1]+b[4])/2,(b[2]+b[5])/2];assert.ok(C.rayPart(o,[1,0,0],cap),'interior picking uses the actual aggregate compartment');}
  results.push({vertices:interior.n,indices:interior.ni,fitRows:s.fits.length,rooms:caps.length,descriptorRows:fleet.turrets.length,exteriorVertices:Object.values(fleet.meshes).reduce((n,m)=>n+(m.geo?.n||0),0),volumes:caps.map(C.partVolume)});
 }
 assert.equal(results[1].vertices,results[0].vertices);assert.equal(results[1].indices,results[0].indices);assert.equal(results[1].fitRows,results[0].fitRows);assert.equal(results[1].rooms,results[0].rooms);assert.equal(results[1].descriptorRows,results[0].descriptorRows);assert.equal(results[1].exteriorVertices,results[0].exteriorVertices,'100 times as many guns adds no exterior vertices');for(let i=0;i<2;i++)assert.ok(Math.abs(results[1].volumes[i]/results[0].volumes[i]-100)<1e-5,'aggregate energy storage still reserves 100 times the real interior volume');
});
