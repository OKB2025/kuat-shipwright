const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const C=vm.runInContext('Core',context),plain=x=>JSON.parse(JSON.stringify(x));
function fixture(){
 const s=C.newShip({L:100,W:40,H:20,plan:'rect',sec:'rect'},'Surface compatibility');s.hull.assembly=true;
 s.parts=[{id:1,k:'struct',form:'box',c:[50,15,60],s:[60,30,36],taper:0}];s.fits=[];s.nextId=2;
 C.enableSurfaceMode(s,true);const patch=C.surfacePatches(s).find(p=>p.host==='p1'&&p.face==='port');
 const result=C.setSurfaceConfig(s,[patch.id],{armor:{material:'dense',thickness:.7},equipment:{kind:'hdis',count:1,depth:2},battery:{weapon:'claser',count:3,spacing:1,angle:23},style:{kind:'machinery',depth:.2,density:.8,seed:71}});
 assert.equal(result.ok,true);assert.equal(s.fits.filter(f=>f.surfacePatch===patch.id).length,3);return {s,patch};
}
function empty(){const s=C.newShip({L:500,W:400,H:200,plan:'rect',sec:'rect'},'Destination');s.hull.assembly=true;s.parts=[];s.fits=[];return s;}
function devices(s){return [...s.parts,...s.fits].filter(p=>p.surfacePatch).map(p=>({id:p.id,patch:p.surfacePatch,cell:p.surfaceCell,k:p.k}));}

test('copying a surface host includes each real owned device once and retains its complete surface settings',()=>{
 const {s,patch}=fixture(),copy=C.surfaceCopySelection(s,{parts:[1],fits:s.fits.map(f=>f.id)});
 assert.equal(copy.parts.length,2);assert.equal(copy.fits.length,3);assert.equal(new Set([...copy.parts,...copy.fits].map(p=>p.id)).size,5);
 const record=copy.surfaces.patches.find(p=>p.id===patch.id);assert.deepEqual(plain(record),plain(C.surfaceConfig(s,patch.id)));assert.ok(copy.surfaces.patches.length>=6,'effective armour on the other faces must accompany the host');
 record.style.seed=99;copy.parts[0].c[0]=999;assert.equal(C.surfaceConfig(s,patch.id).style.seed,71);assert.equal(s.parts[0].c[0],50);
});

test('a generated gun copied on its own becomes independent rather than retaining another host ownership',()=>{
 const {s}=fixture(),gun=s.fits[0],copy=C.surfaceCopySelection(s,{parts:[],fits:[gun.id]});
 assert.equal(copy.fits.length,1);assert.equal(copy.surfaces,null);assert.equal(copy.fits[0].surfacePatch,undefined);assert.equal(copy.fits[0].surfaceCell,undefined);assert.equal(gun.surfacePatch!==undefined,true);
});

test('user-part capture and repeated normalization preserve local surface IDs and real physical children',()=>{
 const {s}=fixture(),captured=C.assemblyCapture(s,{parts:[1],fits:[]},{name:'Battery section'});assert.ok(captured.template);const first=C.normalizeAssemblyTemplate(plain(captured.template)),second=C.normalizeAssemblyTemplate(plain(first));
 assert.equal(first.parts.length,2);assert.equal(first.fits.length,3);assert.deepEqual(plain(first.surfaces),plain(second.surfaces));assert.deepEqual(devices(first),devices(second));
 const ids=new Set(first.parts.map(p=>'p'+p.id));for(const p of first.surfaces.patches)assert.ok(ids.has(p.id.split(':')[0]));for(const p of [...first.parts,...first.fits].filter(p=>p.surfacePatch))assert.ok(first.surfaces.patches.some(q=>q.id===p.surfacePatch));
});

test('placing a mirrored surface assembly remaps host IDs, faces, barrel directions and stable device cells',()=>{
 const {s}=fixture(),template=C.normalizeAssemblyTemplate(plain(C.assemblyCapture(s,{parts:[1],fits:[]},{name:'Battery section'}).template)),target=empty(),result=C.assemblyPlace(target,template,[200,30,80],{mirror:true});assert.equal(result.groups.length,2);
 const hosts=result.parts.filter(p=>p.k==='struct'),a=hosts.find(p=>p.c[2]>0),b=hosts.find(p=>p.c[2]<0);assert.ok(a&&b);const ownA=target.fits.filter(f=>f.surfacePatch.startsWith('p'+a.id+':')),ownB=target.fits.filter(f=>f.surfacePatch.startsWith('p'+b.id+':'));
 assert.equal(ownA.length,3);assert.equal(ownB.length,3);assert.ok(ownA.every(f=>f.surfacePatch.split(':')[1]==='port'));assert.ok(ownB.every(f=>f.surfacePatch.split(':')[1]==='stbd'));
 for(const f of ownA){const g=ownB.find(q=>q.surfaceCell===f.surfaceCell);assert.ok(g);assert.ok(C.dot(C.fitFrameOf(g).fw,C.mirrorP(C.fitFrameOf(f).fw))>.999,'fixed barrel orientation must mirror with its mount');}
 const before=devices(target);C.surfaceSync(target);C.surfaceSync(target);assert.deepEqual(devices(target),before);assert.equal(new Set(devices(target).map(p=>p.id)).size,8);
});

test('split patch ranges and seeds survive mirrored user-part placement without duplicating the battery',()=>{
 const {s,patch}=fixture(),split=C.surfaceSplit(s,patch.id,'v',.3);assert.equal(split.ok,true);C.setSurfaceConfig(s,[split.ids[0]],{style:{seed:101}});C.setSurfaceConfig(s,[split.ids[1]],{style:{seed:202}});const sourcePatches=C.surfacePatches(s).filter(p=>split.ids.includes(p.id)),template=C.normalizeAssemblyTemplate(plain(C.assemblyCapture(s,{parts:[1],fits:[]},{name:'Split section'}).template));assert.equal(template.surfaces.partitions.length,1);
 const target=empty(),result=C.assemblyPlace(target,template,[200,30,80],{mirror:true});assert.equal(result.groups.length,2);assert.equal(target.surfaces.partitions.length,2);assert.equal(target.fits.length,6);assert.equal(target.parts.filter(p=>p.surfacePatch).length,2);
 const hosts=result.parts.filter(p=>p.k==='struct');for(const host of hosts){const configs=target.surfaces.patches.filter(p=>p.id.startsWith('p'+host.id+':')&&p.battery.count);assert.equal(configs.reduce((n,p)=>n+p.battery.count,0),3);assert.deepEqual(plain(configs.map(p=>p.style.seed).sort()),[101,202]);}
 const mirrored=hosts.find(p=>p.c[2]<0),destinationPatches=C.surfacePatches(target);for(const source of sourcePatches){const seed=C.surfaceConfig(s,source.id).style.seed,record=target.surfaces.patches.find(p=>p.id.startsWith('p'+mirrored.id+':')&&p.style.seed===seed),placed=destinationPatches.find(p=>p.id===record.id),expected=C.add(mirrored.c,C.mirrorP(C.sub(source.center,s.parts[0].c)));assert.ok(C.len(C.sub(placed.center,expected))<1e-5,'a split region must remain over the mirrored physical part of its host');}
 const before=devices(target);C.surfaceSync(target);assert.deepEqual(devices(target),before);
});

test('surface composite parts retain internal power and heat links and expose external network ports',()=>{
 const {s}=fixture(),fit=s.fits[0],sink=s.parts.find(p=>p.surfacePatch);s.parts.push({id:100,k:'gen',c:[300,20,60],d:2});s.nextId=101;
 s.links=[{kind:'power',from:'p100',to:'f'+fit.id,cap:1e24},{kind:'heat',from:'f'+fit.id,to:'p'+sink.id,cap:2e23}];
 const internal=C.normalizeAssemblyTemplate(plain(C.assemblyCapture(s,{parts:[1,100],fits:[]},{name:'Connected section'}).template));assert.equal(internal.netLinks.length,2);const target=empty();C.assemblyPlace(target,internal,[200,30,80]);assert.equal(target.links.length,2);for(const l of target.links){assert.ok([...target.parts,...target.fits].some(p=>p.id===+l.from.slice(1)));assert.ok([...target.parts,...target.fits].some(p=>p.id===+l.to.slice(1)));}
 const external=C.normalizeAssemblyTemplate(plain(C.assemblyCapture(s,{parts:[1],fits:[]},{name:'Port section'}).template));assert.equal(external.netLinks.length,1);assert.equal(external.networkPorts.length,1);assert.equal(external.networkPorts[0].direction,'in');const destination=empty(),placed=C.assemblyPlace(destination,external,[200,30,80]);assert.equal(placed.groups[0].assembly.networkPorts.length,1);assert.ok(C.assemblyIssues(destination).some(w=>w.code==='assembly-network-port'));
 const loaded=C.deserialize(C.serialize(destination));assert.deepEqual(plain(loaded.groups[0].assembly.networkPorts),plain(placed.groups[0].assembly.networkPorts));
});

test('save and reload are idempotent and preserve surface equipment anchors without generated duplicates',()=>{
 const {s}=fixture(),first=C.deserialize(C.serialize(s));C.surfaceSync(first);const second=C.deserialize(C.serialize(first));C.surfaceSync(second);assert.deepEqual(devices(second),devices(first));assert.deepEqual(plain(second.surfaces),plain(first.surfaces));
 for(const p of [...second.parts,...second.fits].filter(p=>p.surfacePatch)){assert.ok(p.surfacePoint?.every(Number.isFinite));assert.equal(p.surfaceFootprint.length,2);}
});

test('hidden interior faces cannot become exposed merely by selecting a compartment in an X-ray view',()=>{
 const s=empty();s.parts=[{id:1,k:'struct',form:'box',c:[100,50,50],s:[100,80,60],taper:0},{id:2,k:'service',c:[100,50,50],d:8,room:[8,8,8]}];s.nextId=3;const patches=C.surfacePatches(s).filter(p=>p.host==='p2');assert.ok(patches.length>0);assert.ok(patches.every(p=>!p.exposed));
 const result=C.setSurfaceConfig(s,[patches[0].id],{battery:{weapon:'claser',count:10,spacing:1}});assert.ok(result.ok===false||s.fits.length===0);assert.equal(s.fits.length,0);
});

test('topology changes orphan the original equipment explicitly and do not silently assign it to a new face',()=>{
 const {s,patch}=fixture(),before=devices(s);s.solidCuts.push(C.normalizeSolidCut({id:s.nextId++,shape:'box',c:[35,15,60],s:[10,30,30],structures:true}));C.surfaceSync(s);const report=C.surfaceReport(s);assert.ok(report.orphaned.some(p=>p.id===patch.id));
 assert.deepEqual(devices(s),before);assert.ok([...s.parts,...s.fits].filter(p=>p.surfacePatch).every(p=>p.surfaceUnplaced));assert.ok(report.patches.every(p=>p.id!==patch.id));
});

test('a copied host bakes its actual global cutter geometry rather than healing the cut in another design',()=>{
 const s=empty();s.parts=[{id:1,k:'struct',form:'box',c:[100,50,60],s:[60,30,36],taper:0}];s.nextId=2;s.solidCuts=[C.normalizeSolidCut({id:2,shape:'box',c:[119,50,60],s:[25,60,60],structures:true})];s.nextId=3;s.parts[0]._solidCutShip=s;
 C.enableSurfaceMode(s,true);const patch=C.surfacePatches(s).find(p=>p.host==='p1'&&p.face==='port');C.setSurfaceConfig(s,[patch.id],{armor:{material:'dense',thickness:.8},battery:{weapon:'claser',count:2,spacing:1}});const sourceVolume=C.meshVolume(C.structTriangles(s.parts[0])),whole=60*30*36;assert.ok(sourceVolume<whole*.9);
 const captured=C.assemblyCapture(s,{parts:[1],fits:[]},{name:'Cut section'});assert.ok(captured.template&&!captured.error);assert.equal(captured.template.parts.find(p=>!p.surfacePatch).form,'mesh');
 const template=C.normalizeAssemblyTemplate(plain(captured.template)),target=empty(),placed=C.assemblyPlace(target,template,[250,70,90]),host=placed.parts.find(p=>!p.surfacePatch);assert.ok(Math.abs(C.meshVolume(C.structTriangles(host))-sourceVolume)<sourceVolume*1e-5);assert.equal(target.solidCuts.length,0,'the copied geometry carries its cut without a new ship-wide cutter');
 assert.equal(target.fits.length,2);assert.ok(target.fits.every(f=>f.surfacePatch.startsWith('p'+host.id+':')));const before=devices(target);C.surfaceSync(target);assert.deepEqual(devices(target),before);
});

test('copying an already orphaned patch retains its warning and unplaced devices instead of healing the ownership',()=>{
 const {s}=fixture();s.solidCuts.push(C.normalizeSolidCut({id:s.nextId++,shape:'box',c:[119,15,60],s:[10,60,60],structures:true}));C.surfaceSync(s);assert.ok(C.surfaceReport(s).orphaned.length>0);
 const template=C.normalizeAssemblyTemplate(plain(C.assemblyCapture(s,{parts:[1],fits:[]},{name:'Orphan section'}).template));assert.ok(template.surfaces.orphaned.length>0);const target=empty(),result=C.assemblyPlace(target,template,[250,50,90]);assert.ok(result.groups.length);
 const report=C.surfaceReport(target);assert.ok(report.orphaned.length>0);assert.equal(target.fits.length,3);assert.ok(target.fits.every(f=>f.surfaceUnplaced));assert.equal(report.totals.installed,0);
});

function oversizedSurfaceCases(){
 const baseId='hull:top:0:bounds',leaf=i=>({id:baseId+'/s'+i,range:[0,0,1,1]});
 return [
  {surfaces:{version:1,patches:Array.from({length:513},()=>({id:baseId}))},error:/表面パッチは512件までです/},
  {surfaces:{version:1,patches:[],partitions:Array.from({length:513},()=>({baseId,leaves:[leaf(0)]}))},error:/表面分割グループは512件までです/},
  {surfaces:{version:1,patches:[],partitions:[{baseId,leaves:Array.from({length:65},(_,i)=>leaf(i))}]},error:/1面の表面分割は64件までです/}
 ];
}

test('public save and import explicitly reject oversized raw surface collections without dropping data',()=>{
 for(const {surfaces,error}of oversizedSurfaceCases()){
  const s=empty(),save=plain(C.serialize(s));s.surfaces=plain(surfaces);save.surfaces=plain(surfaces);const beforeShip=JSON.stringify(s),beforeSave=JSON.stringify(save);
  assert.throws(()=>C.serialize(s),error);assert.equal(JSON.stringify(s),beforeShip);
  assert.throws(()=>C.deserialize(save),error);assert.equal(JSON.stringify(save),beforeSave);
 }
});

test('surface counts exactly at every saved limit round-trip without truncation or duplication',()=>{
 const s=empty();s.surfaces={version:1,mode:'strict',compatAllowed:false,patches:Array.from({length:512},(_,i)=>C.surfaceConfig(s,'hull:top:'+i+':bounds')),partitions:Array.from({length:512},(_,i)=>{const baseId='hull:top:'+i+':bounds',count=i===0?64:1;return {baseId,leaves:Array.from({length:count},(_,j)=>({id:baseId+'/s'+j,range:[j/count,0,(j+1)/count,1]}))};})};
 const first=plain(C.serialize(s)),second=plain(C.serialize(C.deserialize(first))),third=plain(C.serialize(C.deserialize(second)));
 assert.equal(first.surfaces.patches.length,512);assert.equal(first.surfaces.partitions.length,512);assert.equal(first.surfaces.partitions[0].leaves.length,64);assert.equal(first.surfaces.compatAllowed,false);
 assert.deepEqual(second.surfaces,first.surfaces);assert.deepEqual(third.surfaces,first.surfaces);
});

test('in-range invalid surface records retain the existing sanitizing behavior',()=>{
 const s=empty(),baseId='hull:top:0:bounds',record={id:baseId,armor:{material:'unknown',thickness:999},battery:{weapon:'unknown',count:-4},style:{seed:-3}};
 s.surfaces={version:1,patches:[null,{id:'bad'},record,plain(record)],partitions:[null,{baseId,leaves:[null,{id:'wrong/s0',range:[0,0,1,1]},{id:baseId+'/good',range:[0,0,1,1]},{id:baseId+'/overlap',range:[.2,.2,.8,.8]}]}]};
 const save=C.serialize(s);assert.equal(save.surfaces.patches.length,1);const q=save.surfaces.patches[0];assert.equal(q.armor.material,'standard');assert.equal(q.armor.thickness,100);assert.equal(q.battery.weapon,'none');assert.equal(q.battery.count,0);assert.equal(q.style.seed,0);assert.equal(save.surfaces.partitions.length,1);assert.equal(save.surfaces.partitions[0].leaves.length,1);
});

test('oversized imported surface assemblies fail validation and placement before changing the destination',()=>{
 for(const {surfaces,error}of oversizedSurfaceCases()){
  const template={format:'starship-yard-part',v:1,id:'bounds',name:'Bounds',parts:[{id:1,k:'struct',form:'box',c:[0,0,0],s:[10,10,10],taper:0}],fits:[],groups:[],surfaces:plain(surfaces)};
  assert.throws(()=>C.normalizeAssemblyTemplate(template),error);const destination=empty(),before=JSON.stringify(destination),result=C.assemblyPlace(destination,template,[100,20,30]);assert.match(result.error,error);assert.equal(JSON.stringify(destination),before);
 }
});
