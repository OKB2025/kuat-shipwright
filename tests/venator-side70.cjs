const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),plain=v=>JSON.parse(JSON.stringify(v)),near=(a,b,e=1e-8)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
function fixture(){const s=C.newShip({L:500,W:200,H:160,plan:'rect',sec:'rect',bowW:1,bowH:1,stern:1},'Native side guns');s.parts=[];s.fits=[];s.nextId=1;return s;}

test('the restored side weapon has its own 70 TT-per-barrel identity without upgrading old 40 TT inventory',()=>{
 assert.deepEqual(plain(C.VENATOR_SIDE_WEAPON_KEYS),['venSide70']);const d=C.FITS.venSide70;
 assert.equal(d.name,'70TT×2 舷側');assert.equal(d.asset,'ven_side70_native');assert.equal(d.barrels,2);assert.equal(d.boltTT,70);assert.equal(d.tt,140);assert.equal(d.ion,0);assert.equal(d.power,140*C.TT/d.cycle);assert.equal(C.weaponModelScale('venSide70'),1);assert.equal(d.wallOnly,true);assert.equal(d.casemate,false);assert.equal(d.fixed,false);assert.equal(d.housingFixed,true);assert.equal(C.weaponRoles(d).pointDefense,false);assert.equal(C.fitSpec({k:'venSide70',scale:2}).tt,140);
 for(const k of ['refSide','refVenSide']){assert.equal(C.canonicalWeaponKind(k),'twin40');assert.equal(C.FITS[C.canonicalWeaponKind(k)].tt,80);assert.equal(C.FITS[k],undefined);const old=Object.freeze({id:9,k,p:[250,80,-100],a:2,skinAsset:'ven_side_port',mountAxis:5,mountOffset:2,ped:0}),f=C.migrateWeaponFit(old);assert.equal(f.k,'twin40');assert.equal(f.a,5);assert.equal(f.skinAsset,undefined);assert.equal(f.mountAxis,undefined);assert.equal(f.mountOffset,undefined);assert.equal(old.k,k);}
 assert.equal(C.FITS.refVen.tt,140);assert.equal(C.FITS.twin40.tt,80);
});

test('all archived source vertices, oriented triangles and UVs survive the rigid side-gun wrapper',()=>{
 const a=C.REFERENCE_ASSETS.ven_side70_native,b=C.REFERENCE_ASSETS.ven_side_gun,d=C.decodeReference('ven_side70_native'),source=C.decodeReference('ven_side_gun'),map=a.sourceVertexIndices,R=a.sourceFrame.rotationRows,M=a.sourceFrame.mountPointRelativeToSourceCenterM;
 assert.equal(a.n,1044);assert.equal(a.faces,928);assert.equal(a.n,b.n);assert.equal(a.faces,b.faces);assert.equal(new Set(map).size,b.n);assert.equal(a.housingVertices,292);assert.equal(a.housingFaces,228);assert.equal(a.elevationIndexStart,684);assert.ok(a.maxQuantizationErrorM<.001);
 for(let i=0;i<a.n;i++){const p=[0,1,2].map(k=>d.pos[i*3+k]*a.size[k]+a.c[k]);for(let k=0;k<3;k++){const restored=M[k]+p.reduce((n,x,j)=>n+x*R[j][k],0),expected=source.pos[map[i]*3+k]*b.size[k];near(restored,expected,.0005);}assert.equal(d.uv[i*2],source.uv[map[i]*2]);assert.equal(d.uv[i*2+1],source.uv[map[i]*2+1]);}
 const triangles=new Map();for(let i=0;i<source.idx.length;i+=3){const key=Array.from(source.idx.slice(i,i+3)).join(',');triangles.set(key,(triangles.get(key)||0)+1);}for(let i=0;i<d.idx.length;i+=3){const key=Array.from(d.idx.slice(i,i+3),v=>map[v]).join(',');assert.ok(triangles.get(key)>0,'the wrapper retains the original face winding');triangles.set(key,triangles.get(key)-1);}assert.ok([...triangles.values()].every(n=>n===0));
 assert.equal(a.turretCompartment.volumeM3,0,'unvalidated source casing does not invent a charging room');assert.equal(a.turretCompartment.convexes.length,0);
});

test('real port and starboard placement keeps the full source housing while its two barrels articulate within the side limits',()=>{
 const ship=fixture();for(const sign of [-1,1]){const result=C.placeFit(ship,'venSide70',[250,80,sign*100],[0,0,sign],0,false);assert.ok(result.fit,result.err);const f=result.fit,g=C.authoredTurretGeometry(f);assert.equal(f.a,sign<0?5:4);assert.equal(f.ped,0);assert.equal(f.base,0);assert.equal(g.housingFixed,true);assert.equal(g.muzzles.length,2);near(g.fw[2],sign);near(g.axis[1],1);near(g.limits.yaw,65*Math.PI/180);near(g.limits.lo,-20*Math.PI/180);near(g.limits.hi,20*Math.PI/180);
  for(const yaw of [-65,0,65])for(const elevation of [-20,0,20])assert.equal(C.authoredTurretInArc(g,C.aimAuthoredTurret(g,yaw*Math.PI/180,elevation*Math.PI/180).fw),true);
  assert.equal(C.authoredTurretInArc(g,C.aimAuthoredTurret(g,66*Math.PI/180,0).fw),false);assert.equal(C.authoredTurretInArc(g,C.aimAuthoredTurret(g,0,21*Math.PI/180).fw),false);const moved=C.aimAuthoredTurret(g,.4,.2);assert.deepEqual(plain(moved.bodyRotation),[1,0,0,0,1,0,0,0,1]);assert.ok(C.len(C.sub(moved.muzzles[0],g.muzzles[0]))>1);
 }
 assert.ok(C.placeFit(ship,'venSide70',[250,160,0],[0,1,0],0,false).err,'a side mount cannot silently become a deck gun');
 const geometry=G.fleetGeometry(ship,{trial:true});assert.equal(geometry.turrets.length,2);for(const t of geometry.turrets){assert.equal(t.k,'venSide70');assert.equal(geometry.meshes[t.bodyMesh].geo.n,292);assert.equal(geometry.meshes[t.bodyMesh].geo.ni,684);assert.equal(geometry.meshes[t.mesh].geo.n,752);assert.equal(geometry.meshes[t.mesh].geo.ni,2100);assert.equal((geometry.meshes[t.bodyMesh].geo.ni+geometry.meshes[t.mesh].geo.ni)/3,928);}
 const saved=plain(C.serialize(ship)),loaded=C.deserialize(saved);for(const f of saved.fits){const q=loaded.fits.find(q=>q.id===f.id);for(const key of ['id','k','p','a','ped','base','low','localMount'])assert.deepEqual(plain(q[key]),plain(f[key]),key+' survives native fitting transport');}const canonical=plain(C.serialize(loaded));assert.deepEqual(plain(C.serialize(C.deserialize(canonical))),canonical);assert.ok(loaded.fits.every(f=>f.k==='venSide70'&&C.authoredTurretGeometry(f)?.muzzles.length===2));
});
