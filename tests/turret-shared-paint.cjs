const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console}),gfxSource=fs.readFileSync(path.join(root,'js/gfx.js'),'utf8');
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',context),plain=o=>JSON.parse(JSON.stringify(o)),uv=[.046142578125,.153564453125],color=[143,150,155],modeled=Object.entries(C.FITS).filter(([,f])=>f.cat==='w'&&f.asset&&['imperial-photo-family','light-photo-family','capital-photo-family','moncal-photo-family','point-defense-photo','cis-photo-family'].includes(C.REFERENCE_ASSETS[f.asset]?.nativeCalibration)).map(([k])=>k),procedural=['cturret'];
const fitting=(k,id=1,extra={})=>({id,k,p:[60,50,0],a:k==='quad70Side'?4:2,base:0,ped:0,low:0,float:false,...extra});
function paint(g,label){assert.ok(g.n>0,label+' has visible vertices');for(let i=0;i<g.n;i++){assert.equal(g.uv[i*2],uv[0],label+' u');assert.equal(g.uv[i*2+1],uv[1],label+' v');for(let j=0;j<3;j++)assert.equal(g.col[i*4+j],color[j],label+' reference color');assert.equal(g.col[i*4+3],255,label+' keeps normal reference shading');}}
function exact(g,h,fields=['pos','nor','idx']){assert.equal(g.n,h.n);assert.equal(g.ni,h.ni);for(const field of fields){const n=field==='idx'?g.ni:g.n*(field==='uv'?2:field==='col'?4:3);assert.deepEqual(Array.from(g[field].slice(0,n)),Array.from(h[field].slice(0,n)),field);}}
function shipWith(fits){const s=C.newShip({assembly:true,L:240,W:200,H:80},'Shared turret paint');s.parts=[];s.fits=fits;s.detail=0;return s;}
function renderer(){const calls=[],reference={a:{texture:'reference-paint'},e:{texture:'reference-emission'}},fits={a:{texture:'generic-fittings'},e:{texture:'generic-emission'}},r=Object.create(G.Renderer.prototype);Object.assign(r,{calls,gl:new Proxy({},{get:(_t,key)=>key==='uniform1f'?(name,value)=>calls.push([name,value]):key==='bindTexture'?(_target,texture)=>calls.push(['texture',texture?.texture]):()=>{}}),meshes:{},pm:{p:{},u:new Proxy({},{get:(_t,key)=>key}),a:{aPos:0,aNor:1,aUv:2,aCol:3}},tex:{reference,fits,hull:fits},canvas:{width:100,height:100},cam:{fov:.72,r:100},off:[0,0,0],upload(name,geo){this.meshes[name]={count:geo.ni};}});return r;}
function drawMaterial(r,name,paintName='imperial'){r.calls.length=0;r.paint=paintName;r.drawMesh(name,{VP:[],eye:[0,0,100]},1);assert.ok(r.calls.some(([name,value])=>name==='uReference'&&value===1),name+' uses the reference shader color scale');assert.ok(r.calls.some(([name,value])=>name==='texture'&&value==='reference-paint'),name+' binds the actual reference atlas');assert.ok(r.calls.some(([name,value])=>name==='uPaint'&&value===(paintName==='dark'?2:paintName==='republic'?1:0)),name+' shares the same ship-paint policy');}

test('all modeled turrets share ISD paint while the original octuple remains byte exact',()=>{
 assert.equal(modeled.length,32);assert.equal(C.CAPITAL_TURRET_KEYS.length,9);
 for(const k of modeled){const f=fitting(k),id=C.FITS[k].asset,source=C.decodeReference(id),rawUV=Array.from(source.uv),rawPos=Array.from(source.pos),mesh=G.meshReferenceFits({fits:[f]});assert.equal(mesh.ni,source.idx.length,k+' keeps every authored triangle');assert.equal(G.meshFits({fits:[f]}).ni,0,k+' does not duplicate its body');
  if(k==='oct40'){assert.deepEqual(Array.from(mesh.uv.slice(0,mesh.n*2)),rawUV);for(let i=0;i<mesh.n;i++)assert.deepEqual(Array.from(mesh.col.slice(i*4,i*4+3)),color);}
  else paint(mesh,k);
  for(let i=0;i<mesh.n;i++){const target=C.referenceFitPoint(f,Array.from(source.pos.slice(i*3,i*3+3)));for(let j=0;j<3;j++)assert.ok(Math.abs(mesh.pos[i*3+j]-target[j])<.00002,k+' paint does not change geometry');}
  exact(mesh,G.meshReferenceFits({fits:[f]}),['pos','nor','idx','uv','col']);assert.deepEqual(Array.from(source.uv),rawUV,k+' source UVs are immutable');assert.deepEqual(Array.from(source.pos),rawPos,k+' decoded geometry is immutable');
 }
});

test('the paint texel lies on the original ISD roof and shares its real shader inputs',()=>{
 const anchor=G.meshReferenceFits({fits:[fitting('oct40')]}),bary=(p,a,b,c)=>{const d=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(d)<1e-12)return null;const u=((b[1]-c[1])*(p[0]-c[0])+(c[0]-b[0])*(p[1]-c[1]))/d,v=((c[1]-a[1])*(p[0]-c[0])+(a[0]-c[0])*(p[1]-c[1]))/d;return [u,v,1-u-v];};let roof=null;
 for(let i=0;i<anchor.ni;i+=3){const ids=Array.from(anchor.idx.slice(i,i+3)),weights=bary(uv,...ids.map(j=>Array.from(anchor.uv.slice(j*2,j*2+2))));if(weights?.every(v=>v>=0&&v<=1)&&ids.every(j=>anchor.nor[j*3+1]>125)){roof={ids,weights};break;}}
 assert.ok(roof,'shared sample belongs to an actual upward-facing source roof triangle');for(let c=0;c<3;c++){const v=roof.ids.reduce((sum,id,j)=>sum+roof.weights[j]*anchor.col[id*4+c],0);assert.ok(Math.abs(v-color[c])<1e-8,'sample keeps the source roof color scale');}
 // These production shader equations consume the shared UV, vertex color and
 // material uniform. Identical inputs use the same albedo and lighting law;
 // no special color branch or alternate testing shader is involved.
 assert.match(gfxSource,/vec3 tx=texture2D\(uTex,materialUV\)\.rgb/);assert.match(gfxSource,/vec3 vc=uReference>0\.5\?vCol\.rgb\*2\.0:vCol\.rgb;vec3 base=vc\*vc\*tx\*tx/);
 for(const k of [...modeled.filter(k=>k!=='oct40'),...procedural]){const g=G.meshReferenceFits({fits:[fitting(k)]});paint(g,k);for(const rgb of [[127,126,124],[40,60,80],[235,236,237]])for(let c=0;c<3;c++){const native=(color[c]/255*2)**2*(rgb[c]/255)**2,draw=(g.col[c]/255*2)**2*(rgb[c]/255)**2;assert.equal(draw,native,k+' follows the ISD shader albedo equation');}}
});

test('procedural turrets preserve their shapes, exact picking, ranges, cache invalidation and previews',()=>{
 for(const k of procedural)for(const pose of [{a:2},{a:4,assetYaw:37.25},{a:2,tilt:C.norm([.2,.95,.3]),assetYaw:-52,scale:1.3}]){const f=fitting(k,7,pose),ship=shipWith([f]),source=G.meshFits(ship,null,null,[f],true),ranges={},g=G.meshReferenceFits(ship,ranges);paint(g,k);exact(g,source);assert.equal(G.meshFits(ship).ni,0);assert.deepEqual(plain(ranges),{'7':[['refFits',0,g.ni]]});
  const preview=G.meshPreview(ship,[],[f]);assert.equal(preview.previewFits.ni,0);exact(preview.previewRefFits,g,['pos','nor','idx','uv','col']);
  const tri=Array.from(g.idx.slice(0,3)),points=tri.map(i=>Array.from(g.pos.slice(i*3,i*3+3))),center=C.mul(points.reduce((sum,p)=>C.add(sum,p),[0,0,0]),1/3),normal=C.norm(C.cross(C.sub(points[1],points[0]),C.sub(points[2],points[0]))),origin=C.add(center,C.mul(normal,100)),dir=C.mul(normal,-1),all=new Float32Array(g.ni*3);for(let i=0;i<g.ni;i++)all.set(g.pos.slice(g.idx[i]*3,g.idx[i]*3+3),i*3);assert.ok(C.rayTris(all,origin,dir)!=null);assert.deepEqual(plain(G.rayFit(origin,dir,f)),plain(C.rayTris(all,origin,dir)),k+' picks the exact visible triangles');
  const old=Array.from(g.pos.slice(0,g.n*3));f.p[0]+=13;const changed=G.meshReferenceFits(ship);paint(changed,k);assert.notDeepEqual(Array.from(changed.pos.slice(0,changed.n*3)),old,k+' invalidates its cached posed copy');for(let i=0;i<g.n;i++)assert.ok(Math.abs(changed.pos[i*3]-g.pos[i*3]-13)<.00003);
 }
});

test('static editor, preview and moving fleet guns bind the same real reference material',()=>{
 for(const k of [...modeled,...procedural]){const f=fitting(k),s=shipWith([f]),preview=G.meshPreview(s,[],[f]),r=renderer();r.meshes.previewRefFits={count:preview.previewRefFits.ni};for(const shade of ['imperial','republic','dark'])drawMaterial(r,'previewRefFits',shade);
  const geometry=G.fleetGeometry(s,{trial:true}),t=geometry.turrets.find(t=>t.id===f.id);assert.ok(t?.mesh.startsWith('refTur_'),k+' has a moving reference turret');const moving=geometry.meshes[t.mesh],body=t.bodyMesh&&geometry.meshes[t.bodyMesh];assert.equal(moving.tex,'reference');assert.ok(moving.geo.ni>0);if(body?.geo.ni)assert.equal(body.tex,'reference');assert.equal(geometry.meshes.refFits.geo.ni,0);assert.equal(geometry.meshes.fits.geo.ni,0);assert.equal(moving.geo.ni+(body?.geo.ni||0),preview.previewRefFits.ni,k+' has exactly one static/moving copy of every triangle');
  r.meshes=r.loadFleet(k,geometry).meshes;for(const shade of ['imperial','republic','dark'])for(const name of [t.bodyMesh,t.mesh].filter(name=>r.meshes[name]?.count))drawMaterial(r,name,shade);if(k!=='oct40'){paint(moving.geo,k+' moving assembly');if(body?.geo.ni)paint(body.geo,k+' gunhouse');}
 }
});

test('surface-owned point defense now renders the photographed articulated gun with its actual material',()=>{
 const s=shipWith([]);s.nextId=1;s.armor={hull:0,cit:0};const body=C.placePart(s,'struct',[100,50,0],[120,100,80],{form:'box'},false),patch=C.surfacePatches(s).find(p=>p.host==='p'+body.id&&p.face==='port');assert.ok(patch);
 const f={...fitting('pd'),p:patch.center.slice(),a:5,n:patch.normal.slice(),tilt:patch.normal.slice(),surfacePatch:patch.id,surfacePoint:patch.center.slice(),surfaceCell:'legacy-pd'};s.fits=[f];
 assert.equal(C.surfaceBatteryGeometry(f),null);assert.ok(C.authoredTurretGeometry(f));assert.equal(C.authoredTurretGeometry(f).muzzles.length,2);const g=G.meshReferenceFits(s,null,[f]);assert.ok(g.ni>0);paint(g,'surface PD');assert.equal(G.meshFits(s,null,null,[f]).ni,0);const preview=G.meshPreview(s,[],[f]);assert.equal(preview.previewFits.ni,0);exact(preview.previewRefFits,g,['pos','nor','idx','uv','col']);
});

test('an explicit procedural support stays fixed and unrelated fitting colors remain unchanged',()=>{
 const f=fitting('pd',1,{ped:5}),s=shipWith([f]),support=G.meshFits(s),gun=G.meshReferenceFits(s),trial=G.fleetGeometry(s,{trial:true}),t=trial.turrets[0];assert.ok(support.ni>0);assert.equal(trial.meshes.fits.geo.ni,support.ni);assert.equal(trial.meshes[t.mesh].geo.ni+(trial.meshes[t.bodyMesh]?.geo.ni||0),gun.ni);exact(trial.meshes.fits.geo,support,['pos','nor','idx','uv','col']);
 for(const k of ['claser','claserH','cion','ctorp','cbomb','cpylon','msl','itl','trc','brS','broadsideBattery']){if(!C.FITS[k])continue;const f=fitting(k),s=shipWith([f]),a=G.meshFits(s),b=G.meshFits(s,null,null,[f],true);assert.ok(a.ni>0,k+' remains visible');exact(a,b,['pos','nor','idx','uv','col']);assert.equal(G.meshReferenceFits(s).ni,0,k+' does not enter turret paint');if(k==='broadsideBattery'){let black=0;for(let i=0;i<a.n;i++)if(a.col[i*4]===12&&a.col[i*4+1]===16&&a.col[i*4+2]===20)black++;assert.ok(black>0,'the broadside embrasure stays black');}}
});
