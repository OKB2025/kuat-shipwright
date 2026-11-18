const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance:{now:()=>0}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),plain=v=>JSON.parse(JSON.stringify(v));
const near=(a,b,e=3e-5)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`),vector=(a,b,e)=>a.forEach((n,i)=>near(n,b[i],e));
const fit=(pitch=0,frame={a:2})=>({id:1,k:'cmsl',p:[13,-7,23],ped:0,base:0,low:0,float:false,launchPitch:pitch,...frame});
function vertices(g){const out=[];for(let i=0;i<g.ni;i++){const at=g.idx[i]*3;out.push(Array.from(g.pos.subarray(at,at+3)));}return out;}
function fixture(){const s=C.newShip({L:100,W:60,H:50,assembly:true},'Shared missile launchers');s.parts=[];s.fits=[];s.armor={hull:0,cit:0};s.nextId=1;const body=C.placePart(s,'struct',[50,20,0],[80,40,30],{form:'box'},false);return {s,body};}

test('legacy concussion pods retain the canonical compact aircraft fitting',()=>{
 assert.equal(C.canonicalWeaponKind('msl'),'cmsl');assert.equal(C.FITS.msl,C.FITS.cmsl,'the legacy spelling must not retain a separate large weapon');
 assert.ok(!Object.keys(C.FITS).includes('msl'),'the duplicate ship fitting is not a catalogue entry');
 const d=C.FITS.cmsl;vector([d.fm,d.hm,d.wm],[1.2,.45,.45],1e-12);assert.equal(d.store.slots,6);assert.equal(C.ORDNANCE.cmsl.tt,C.ordnanceBody(.5,5,.5).tt);
 const f=fit(),spec=C.missileLauncherSpec(f);assert.equal(spec.kind,'cmsl');assert.equal(spec.salvo,1);near(spec.cycle,1.2,1e-12);near(spec.tt,C.ORDNANCE.cmsl.tt,1e-12);assert.equal(spec.ammo,6);assert.equal(spec.ammo0,6);
 assert.equal(C.isConcussionLauncher(f),true);assert.equal(C.isConcussionLauncher('msl'),true);assert.equal(C.isConcussionLauncher('itl'),false);
 const b=C.fitAABB(f);assert.ok(Math.max(b[3]-b[0],b[4]-b[1],b[5]-b[2])<1.3,'a 12 metre external ship launcher cannot remain behind the shared fitting');
 const old={...f,k:'msl',mount:'ext'},native=G.meshFits({fits:[f]}),legacy=G.meshFits({fits:[old]});assert.equal(legacy.ni,native.ni);assert.deepEqual(Array.from(legacy.pos.subarray(0,legacy.n*3)),Array.from(native.pos.subarray(0,native.n*3)),'a still-live legacy spelling must draw the same compact aircraft model');
});

test('automatic supports keep angled pods above the deck in every mount frame and match selection geometry',()=>{
 const frames=[...Array.from({length:6},(_,a)=>({a})),{a:2,tilt:C.norm([.24,.91,-.34])}];
 for(const frame of frames){const zero=fit(0,frame),zeroMesh=G.meshFits({fits:[zero]});
  for(const angle of [-90,-60,-30,0,30,60,90]){
   const f=fit(angle,frame),before=plain(f),g=C.launcherGeometry(f),mesh=G.meshFits({fits:[f]}),b=C.fitAABB(f);assert.ok(g&&mesh.ni>0);assert.deepEqual(plain(f),before,'reading launch geometry leaves the mounting point and normal unchanged');
   vector(C.fitOrigin(f),f.p,1e-10);vector(g.baseOrigin,f.p,1e-10);vector(g.axis,g.bodyFrame.fw,1e-10);vector(C.missileLauncherSpec(f).axis,g.axis,1e-10);vector(C.missileLauncherSpec(f).origin,g.origin,1e-10);
   near(C.dot(g.axis,g.baseFrame.up),Math.sin(angle*Math.PI/180),1e-10);near(C.dot(g.axis,g.baseFrame.fw),Math.cos(angle*Math.PI/180),1e-10);
   const shown=vertices(mesh);for(const p of shown){assert.ok(C.dot(C.sub(p,g.baseOrigin),g.baseFrame.up)>=-5e-5,`pitch${angle} frame${frame.a}: geometry penetrates its deck`);for(let k=0;k<3;k++)assert.ok(p[k]>=b[k]-5e-5&&p[k]<=b[k+3]+5e-5,`pitch${angle} frame${frame.a}: drawn vertex lies outside selectable bounds`);}
   if(angle===0){near(g.supportHeight,0,1e-12);near(C.dot(C.sub(g.bodyCenter,g.baseOrigin),g.baseFrame.up),C.FITS.cmsl.hm/2,1e-10);}
   else{assert.ok(g.supportHeight>0);assert.ok(mesh.ni>zeroMesh.ni,'raising the pod creates real support triangles');assert.ok(shown.some(p=>C.dot(C.sub(p,g.baseOrigin),g.baseFrame.up)<.06),'the support reaches the attachment plane');}
   for(const p of g.muzzles)for(let k=0;k<3;k++)assert.ok(p[k]>=b[k]-5e-5&&p[k]<=b[k+3]+5e-5,'physical muzzle is in the same envelope');
  }
 }
});

test('picking follows a changed launch angle rather than retaining the old compact box',()=>{
 const f=fit(0),g=C.launcherGeometry(f),first=G.rayFit(C.add(g.bodyCenter,C.mul(g.bodyFrame.up,3)),C.mul(g.bodyFrame.up,-1),f);assert.ok(first);
 f.launchPitch=90;const raised=C.launcherGeometry(f),hit=G.rayFit(C.add(raised.bodyCenter,C.mul(raised.bodyFrame.up,3)),C.mul(raised.bodyFrame.up,-1),f);assert.ok(hit,'the newly vertical housing remains selectable');
 const origin=[f.p[0]+.51,f.p[1]+.12,f.p[2]+3],direction=[0,0,-1];assert.equal(G.rayFit(origin,direction,f),null,'the old horizontal nose is empty after the launcher stands vertically');
 f.launchPitch=-45;const down=C.launcherGeometry(f),next=G.rayFit(C.add(down.bodyCenter,C.mul(down.bodyFrame.up,3)),C.mul(down.bodyFrame.up,-1),f);assert.ok(next);assert.ok(Number.isFinite(next.t));
});

test('trial launch descriptors use the same pitched muzzle and direction on ships and aircraft',()=>{
 for(const craft of [false,true])for(const angle of [-60,35,90]){
  const s=craft?C.newShip({L:20,W:12,H:8,assembly:true},'Compact aircraft fixture'):fixture().s;if(craft){s.parts=[];s.fits=[];s.nextId=1;C.placePart(s,'struct',[10,1,0],[16,10,2],{form:'box'},false);s.shipClass='starfighter';}assert.equal(C.isCraft(s),craft);const f=fit(angle);f.id=s.nextId++;f.p=craft?[10,2,2]:[50,35,7];s.fits=[f];assert.equal(C.isCraft(s),craft,'the actual geometry fits its intended class');
  const a=G.fleetGeometry(s,{trial:true}),rows=a.launchers.filter(l=>l.id===f.id),g=C.launcherGeometry(f);assert.equal(rows.length,1,'a common launcher must not be duplicated by ship and aircraft launch paths');const row=rows[0];
  vector(row.origin,g.origin);vector(row.axis,g.axis);assert.equal(row.kind,'cmsl');assert.equal(row.salvo,1);assert.equal(row.ammo,6);near(row.tt,C.ORDNANCE.cmsl.tt,1e-12);
 }
});

test('retired equipment-surface VLS settings do not create hidden launcher inventory',()=>{
 const {s,body}=fixture(),patch=C.surfacePatches(s).find(p=>p.host==='p'+body.id&&p.face==='top');assert.ok(patch);
 const r=C.setSurfaceConfig(s,patch.id,{functionMode:'equipment',allocation:{cooling:100,sensors:0,habitation:0},equipment:{limit:0},battery:{weapon:'cmsl',count:2,spacing:1}});assert.equal(r.ok,true,r.why);
 assert.equal(C.surfaceDerivedFits(s).length,0);assert.equal(s.fits.length,0);C.syncCompartments(s);assert.equal(C.missileCells(s).length,0);assert.equal(s.surfaces.armorOnly,1,'the face ledger carries armor without automatic equipment');
});

test('saved manually authored VLS fittings remain flush and reserve their actual missile volume',()=>{
 const {s,body}=fixture(),patch=C.surfacePatches(s).find(p=>p.host==='p'+body.id&&p.face==='top');
 for(const [x,z]of [[45,-4],[55,4]]){const r=C.placeFit(s,'cmsl',[x,35,z],patch.normal,0,false,{localMount:true,tilt:true});assert.ok(!r.err,r.err);Object.assign(r.fit,{surfacePatch:patch.id,surfaceCell:'manual-vls-'+r.fit.id,surfaceRole:'weapons',surfacePoint:r.fit.p.slice(),surfaceFootprint:[1.2,.45],surfaceDepth:1.2,n:patch.normal.slice(),tilt:patch.normal.slice(),localMount:true,launchPitch:70});}
 const loaded=C.deserialize(C.serialize(s));assert.equal(loaded.surfaces,undefined,'manually authored fittings do not require a retired automatic equipment ledger');assert.equal(loaded.fits.length,2);
 for(const f of loaded.fits){C.mountFit(loaded,f);assert.equal(f.float,false);assert.equal(C.isSurfaceVLS(f),true);const g=C.surfaceBatteryGeometry(f),launch=C.missileLauncherSpec(f);assert.equal(g.vls,true);vector(launch.axis,g.normal,1e-10);vector(launch.origin,g.mouth,1e-10);assert.equal(launch.ammo,6);
  const mesh=G.meshFits(loaded,null,null,[f]);assert.ok(mesh.ni>0);for(const p of vertices(mesh))assert.ok(C.dot(C.sub(p,g.point),g.normal)<=.12,'a legacy hatch cannot draw an external box or angled stand');
 }
 C.syncCompartments(loaded);const cells=C.missileCells(loaded),status=C.missileStatus(loaded);assert.equal(cells.length,2);const most=1.2*.45*(C.FITS.cmsl.store.len+.1)+1e-9;for(const cell of cells){const v=C.partVolume(cell);assert.ok(v>0&&v<=most);assert.ok(cell.requiredVolume>0&&cell.requiredVolume<=most);near(status[cell.weaponId].ratio,1,1e-8);}
});
