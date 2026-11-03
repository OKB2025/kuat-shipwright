const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance:{now:()=>0}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),plain=v=>JSON.parse(JSON.stringify(v)),roles=['weapons','cooling','sensors','habitation'];
function fixture({weapon='pd',onlyWeapons=false,depth=3,foil=false,face='port'}={}){
 const s=C.newShip({L:240,W:160,H:100,assembly:true},'Embedded surface renderer');s.parts=[];s.fits=[];s.armor={hull:0,cit:0};s.detail=1;
 const p=C.placePart(s,foil?'wing':'struct',[100,50,0],foil?[112,80,8]:[160,100,80],foil?{}:{form:'box'},false);if(foil)p.wing=C.normalizeWing({...p.wing,foil:true,axis:'x',open:10,stow:50});
 const patch=C.surfacePatches(s).find(q=>q.host==='p'+p.id&&q.face===(foil?'top':face));assert.ok(patch?.exposed);
 const result=C.setSurfaceConfig(s,patch.id,{functionMode:'equipment',allocation:{cooling:35,sensors:15,habitation:50},battery:{weapon,count:2,spacing:1},equipment:{kind:'hdis',depth,...(onlyWeapons?{limit:0}:{})},style:{kind:'machinery',density:.8,seed:97}});assert.equal(result.ok,true,result.why);return {ship:s,body:p,patch:C.surfacePatches(s).find(q=>q.id===patch.id)};
}
function vertices(g,spans){const seen=new Set(),out=[];for(const [,a,n]of spans)for(let i=a;i<a+n;i++){const k=g.idx[i];if(!seen.has(k)){seen.add(k);out.push(Array.from(g.pos.slice(k*3,k*3+3)));}}return out;}
const same=(a,b)=>assert.ok(C.len(C.sub(a,b))<1e-6),median=a=>{a=a.slice().sort((a,b)=>a-b);return a[Math.floor(a.length/2)];};

test('procedural and referenced surface weapons render only their shallow wall ports while manual guns remain',()=>{
 for(const weapon of ['pd','refVen']){const {ship,patch}=fixture({weapon,onlyWeapons:true}),f=C.surfaceDerivedFits(ship).find(q=>q.surfacePatch===patch.id&&!q.float);assert.ok(f,weapon);
  const ranges={},ports=G.meshFits(ship,null,ranges),p=C.surfaceBatteryGeometry(f),points=vertices(ports,(ranges[f.id]||[]).filter(q=>q[0]==='fits'));assert.ok(points.length>0,weapon+' port missing');
  for(const point of points){const q=C.sub(point,p.point);assert.ok(C.dot(q,p.normal)>=-.001&&C.dot(q,p.normal)<=p.lip+.001,weapon+' has exterior barrel or turret geometry');assert.ok(Math.abs(C.dot(q,p.u))<=p.width/2+.001);assert.ok(Math.abs(C.dot(q,p.v))<=p.height/2+.001);}
  assert.equal(G.meshReferenceFits(ship,null,C.surfaceDerivedFits(ship).filter(q=>q.surfacePatch)).ni,0,'referenced turret must not be drawn as a second body');
  const manual={...f,id:ship.nextId++,p:C.add(f.p,[0,30,0]),surfacePatch:undefined,surfaceCell:undefined,surfacePoint:undefined,surfaceUnplaced:undefined};ship.fits.push(manual);
  assert.equal(C.surfaceBatteryGeometry(manual),null);assert.ok((C.FITS[weapon].asset?G.meshReferenceFits(ship,null,[manual]):G.meshFits(ship,q=>q.id===manual.id)).ni>0,weapon+' independent gun was hidden');
 }
});

test('fleet and preview paths keep port identity and muzzle without creating hidden animated turret meshes',()=>{
 const {ship,patch}=fixture(),before=C.publicJSON(ship),fits=C.surfaceDerivedFits(ship).filter(f=>f.surfacePatch===patch.id&&!f.float),asset=G.fleetGeometry(ship,{trial:true});assert.ok(fits.length>0);
 for(const f of fits){const p=C.surfaceBatteryGeometry(f),t=asset.turrets.find(t=>t.id===f.id);assert.ok(t?.embedded);assert.equal(t.mesh,null);assert.ok(C.len(t.axis)>.99&&C.len(t.fw)>.99&&Math.abs(C.dot(t.axis,t.fw))<1e-7);same(t.fw,p.normal);same(t.origin,p.mouth);assert.equal(t.portWidth,p.width);assert.equal(t.portHeight,p.height);assert.ok(!asset.meshes['tur_'+f.id]&&!asset.meshes['refTur_'+f.id]);}
 const preview=G.meshPreview(ship,[],fits);assert.ok(preview.previewFits.ni>0);assert.equal(preview.previewRefFits.ni,0);assert.equal(C.publicJSON(ship),before);
});

test('legacy surface batteries show their aperture on the outer armor face instead of behind the armor slab',()=>{
 const {ship,patch}=fixture();assert.equal(C.setSurfaceConfig(ship,patch.id,{functionMode:'legacy',armor:{material:'standard',thickness:2},battery:{weapon:'pd',count:1},equipment:{kind:'none',count:0}}).ok,true);
 const f=C.surfaceDerivedFits(ship).find(q=>q.surfacePatch===patch.id&&!q.float);assert.ok(f);const p=C.surfaceBatteryGeometry(f),ranges={},g=G.meshFits(ship,null,ranges),points=vertices(g,ranges[f.id]);assert.ok(points.length>0);
 for(const v of points){const n=C.dot(C.sub(v,f.surfacePoint),patch.normal);assert.ok(n>=2.01&&n<=2+p.lip+.001,'port is hidden by or protrudes beyond its actual armor surface');}
});

test('larger machinery is staggered in wallnormal position and depth without changing the saved design',()=>{
 const {ship,patch}=fixture({depth:3}),before=C.publicJSON(ship),row=G.surfaceVisualPlan(ship).find(p=>p.id===patch.id),housings=row.field.filter(p=>p.feature==='service-housing'),primary=housings.filter(p=>p.recess);assert.ok(primary.length>12);
 const backs=primary.map(p=>C.dot(C.sub(p.center,patch.center),patch.normal)-p.size[2]/2),fronts=primary.map(p=>C.dot(C.sub(p.center,patch.center),patch.normal)+p.size[2]/2);
 assert.ok(Math.max(...backs)-Math.min(...backs)>.8,'case backs remain on one plane');assert.ok(Math.max(...fronts)-Math.min(...fronts)>1,'case fronts lack visible depth staggering');assert.ok(fronts.every(z=>z<=.001)&&backs.every(z=>z>=-3.05),'machinery must occupy inward relief within the declared structure');assert.ok(row.field.some(p=>p.feature==='service-standoff'));
 for(const p of primary)for(const a of [-.5,.5])for(const b of [-.5,.5])for(const n of [-.5,.5]){const q=C.add(p.center,C.add(C.add(C.mul(p.u,a*p.size[0]),C.mul(p.v,b*p.size[1])),C.mul(p.normal,n*p.size[2])));assert.ok(C.inStruct(ship.parts.find(p=>p.k==='struct'&&!p.surfacePatch),q),'a visible primary case leaves its actual host');}
 assert.ok(median(primary.map(p=>Math.sqrt(p.size[0]*p.size[1])))>3,'primary machinery still reads as tiny greebles');assert.ok(row.field.some(p=>p.feature==='service-depth-conduit'),'pipe network lacks wallnormal connections between depth tiers');
 assert.equal(C.publicJSON(ship),before);const low=G.surfaceVisualPlan(ship,{detail:0}).find(p=>p.id===patch.id);assert.deepEqual(plain(low.field),plain(row.field));assert.equal(low.boxes.length,0);
});

test('embedded wall ports and depth-staggered machinery move exactly once with their S foil',()=>{
 const {ship,body}=fixture({foil:true,depth:1}),raw=G.meshFits(ship),parts=G.meshSurfaceLayers(ship,{}),asset=G.fleetGeometry(ship,{trial:true}),foil=asset.foils.find(p=>p.id===body.id);assert.ok(foil);
 for(const [kind,count]of [['fits',raw.ni],['surfaceDevices',parts.surfaceDevices.ni],['surfaceDetail',parts.surfaceDetail.ni]]){const moving=foil.meshes.filter(name=>foil.kinds[name]===kind);assert.equal(moving.length,1,kind);assert.equal(asset.meshes[moving[0]].geo.ni,count,kind+' duplicated or lost');assert.equal(asset.meshes[kind]?.geo.ni||0,0,kind+' stationary copy');}
 for(const f of C.surfaceDerivedFits(ship).filter(f=>f.surfacePatch&&!f.float)){const t=asset.turrets.find(t=>t.id===f.id);assert.ok(t?.embedded);assert.equal(t.foilId,body.id);assert.equal(t.mesh,null);}
});
