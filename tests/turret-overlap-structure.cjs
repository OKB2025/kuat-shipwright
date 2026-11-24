// 2026-11-23 A structure laid over a turret's seat does not lift the turret (user: 「構造物が上に重なる時に砲塔の取り付け面まで
// 上に上がってしまう仕様も改善して」). The base stands on the seat's own body (the hull and its hull pieces, or the structure it is
// placed on); another structure counts only where its face is at or below the seat. Before the change the base of the
// frigate's point-defence turret #13 rose from 1.434 m to the 5 m top of a box laid half over its footprint.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),{C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const load=k=>{const s=C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples',k,'design.json.gz')))));C.syncCompartments(s);C.remount(s,{keepFitPose:true});return s;};
const box=(s,c,size)=>({id:s.nextId++,k:'struct',form:'trap',taper:0,yaw:0,offsetX:0,offsetZ:0,pitch:0,roll:0,corner:0,c,s:[size,size,size],label:'重なる構造物'});

test('a structure over part of the footprint leaves the turret base where it was',()=>{
 const s=load('frigate'),f=s.fits.find(q=>q.mountSupport&&!q.float),fr=C.fitFrameOf(f),R=C.fitSpec(f).r,base=f.base,low=f.low;
 s.parts.push(box(s,C.add(f.p,C.add(C.mul(fr.fw,R*.9),C.mul(fr.up,2))),6));s._cache=null;C.syncCompartments(s);C.remount(s,{keepFitPose:true});
 const g=s.fits.find(q=>q.id===f.id);assert.equal(g.float,false);assert.ok(Math.abs(g.base-base)<1e-6,`base ${g.base} (was ${base})`);assert.ok(Math.abs(g.low-low)<1e-6);
});

test('a turret placed on a structure still stands on that structure',()=>{
 const s=load('frigate'),f=s.fits.find(q=>q.mountSupport&&!q.float),fr=C.fitFrameOf(f),top=C.add(f.p,C.mul(fr.up,20)),b=box(s,C.add(top,C.mul(fr.up,-6)),12);
 s.parts.push(b);s._cache=null;C.syncCompartments(s);const g=s.fits.find(q=>q.id===f.id);g.p=top.slice();C.remount(s,{keepFitPose:true});
 assert.equal(g.float,false,'seated on the box top');assert.ok(Math.abs(g.base)<1e-3,`flat top: base ${g.base}`);
});

test('a design saved under the older rule keeps a turret that stood on an overlapping structure where it was',()=>{
 const s=load('frigate'),f=s.fits.find(q=>q.mountSupport&&!q.float),fr=C.fitFrameOf(f),R=C.fitSpec(f).r;
 s.parts.push(box(s,C.add(f.p,C.add(C.mul(fr.fw,R*.9),C.mul(fr.up,2))),6));const o=JSON.parse(JSON.stringify(C.serialize(s)));assert.equal(o.turretSupportRule,2);
 delete o.turretSupportRule;for(const q of o.fits)delete q.supportLift;/* as saved before 2026-11-23 */
 const old=C.deserialize(o);C.syncCompartments(old);C.remount(old,{keepFitPose:true});const g=old.fits.find(q=>q.id===f.id);
 assert.equal(g.supportLift,true);assert.ok(Math.abs(g.base-5)<1e-3,`kept on the box top: ${g.base}`);assert.equal(old.fits.filter(q=>q.supportLift).length,1,'only the turret the box lifted');
 const again=C.deserialize(JSON.parse(JSON.stringify(C.serialize(old))));C.syncCompartments(again);C.remount(again,{keepFitPose:true});assert.ok(Math.abs(again.fits.find(q=>q.id===f.id).base-5)<1e-3,'saved and loaded');
 const h=again.fits.find(q=>q.id===f.id);delete h.supportLift;C.remount(again,{keepFitPose:true});assert.ok(Math.abs(h.base-f.base)<1e-6,'seated again on its own surface');
});
