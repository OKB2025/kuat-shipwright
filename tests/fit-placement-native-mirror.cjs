const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),{C}=require('../scripts/update-ship-examples.cjs').loadRuntime(root),archive='assets/source/ship-example-blueprints/mandator2.json.gz';
const bytes=zlib.gunzipSync(fs.readFileSync(path.join(root,archive))),manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/source/ship-example-blueprints/manifest.json'))),raw=JSON.parse(bytes);
const hash=crypto.createHash('sha256').update(bytes).digest('hex'),plain=x=>JSON.parse(C.publicJSON(x)),state=x=>C.publicJSON(x),reflect=v=>v.map((x,i)=>i===2?-x:x),near=(a,b,t=1e-8)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=t,`${a} != ${b}`),vector=(a,b,t=1e-8)=>a.forEach((x,i)=>near(x,b[i],t));
const primary={p:[4821.600024566906,452.51667353965956,290.20000526299526],n:[.03555805480321426,.9853393932621,.16685893690326697]},faceId='p1154:top:2:12e2bm3';
// Keep the authenticated native reference hull, including its real cuts and
// topology. Other apparatus is excluded to isolate surface/attachment fidelity;
// this test does not claim the entire 318-part browser scenario is accepted.
raw.fits=[];const ship=C.deserialize(raw);ship.parts=ship.parts.filter(p=>p.id===1154);ship.fits=[];ship.links=[];ship.groups=[];
const parent=ship.parts[0],patches=C.surfacePatches(ship,true),patch=patches.find(p=>p.id===faceId);
function surfaceAt(point,normal){const origin=C.add(point,C.mul(normal,.1)),direction=C.mul(normal,-1),hit=C.rayTris(patch.exposedTriangles??patch.triangles,origin,direction,.2);assert.ok(hit,'the bounded native surface ray must hit the real hull');return {p:Array.from(hit.p),n:Array.from(hit.n)};}
const reflected={p:reflect(primary.p),n:reflect(primary.n)},corrected=surfaceAt(reflected.p,reflected.n);
function solve(s,hit,extra={}){return C.solveFitPlacement(s,{id:-1,k:'utl',p:hit.p.slice(),n:[0,1,0],a:2,ped:0,mountMode:'top',...extra},{mode:'direct',hostId:1154,hostSurfaceId:faceId,hit:{p:hit.p.slice(),n:hit.n.slice()}});}

test('native mirror fixture retains authenticated Mandator geometry and the selected semantic face',()=>{
 assert.equal(hash,manifest.models.mandator2.sha256);assert.equal(parent.id,1154);assert.equal(parent.form,'hull');assert.equal(parent.s[0],8000);assert.ok(parent.hullProfile);assert.ok(parent.hullData);assert.ok(patch);assert.equal(patch.host,'p1154');assert.equal(patch.face,'top');assert.ok(patch.exposed);assert.ok(patch.exposedTriangles.length);
 const distance=C.len(C.sub(corrected.p,reflected.p));assert.ok(distance>.0095&&distance<.0097,'the actual reflected hull differs by about 9.59 mm');assert.ok(C.dot(corrected.n,reflected.n)>.9999,'the issue is position, not a reversed normal');
});

test('a reflected anchor outside the selected real face is strictly rejected without mutating the native hull',()=>{
 const s=C.deserialize(plain(C.serialize(ship))),before=state(s),result=solve(s,reflected);assert.equal(result.ok,false);assert.equal(result.code,'surface-missing');assert.equal(result.error,'指定した取付位置は追加元の実形状の面上にありません');assert.equal(state(s),before);assert.equal(s.fits.length,0);
});

test('the exact primary and corrected mirror surface points solve and commit real UTL fittings on the native hull',()=>{
 const s=C.deserialize(plain(C.serialize(ship))),anchors=[primary,corrected];
 for(const anchor of anchors){const before=state(s),result=solve(s,anchor);assert.equal(result.ok,true,result.error);assert.equal(state(s),before,'strict solving must leave the design unchanged');assert.equal(result.fit.host,1154);assert.equal(result.fit.placement.hostSurfaceId,faceId);vector(result.fit.p,anchor.p);assert.equal(result.fit.mountMode,'top');assert.equal(result.fit.tilt,undefined,'explicit upright mounting is not tilted to follow the corrected support normal');const accepted=C.acceptFitPlacementResult(s,result);assert.equal(accepted.ok,true,accepted.error);}
 assert.equal(s.fits.length,2);assert.notEqual(s.fits[0].id,s.fits[1].id);const restored=C.deserialize(plain(C.serialize(s)));assert.equal(restored.fits.length,2);restored.fits.forEach((fit,i)=>{assert.equal(fit.host,1154);assert.equal(fit.placement.hostSurfaceId,faceId);vector(fit.p,anchors[i].p);assert.equal(fit.float,false);});
});

test('surface-aligned UTL mounting follows each actual support normal rather than the raw reflected approximation',()=>{
 const s=C.deserialize(plain(C.serialize(ship)));
 for(const anchor of [primary,corrected]){const result=solve(s,anchor,{n:anchor.n.slice(),tilt:true,mountMode:'auto'});assert.equal(result.ok,true,result.error);vector(result.fit.p,anchor.p);vector(result.fit.n,anchor.n,1e-7);vector(result.fit.tilt,anchor.n,1e-7);}
});
