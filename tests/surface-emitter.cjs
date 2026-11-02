const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const run=s=>vm.runInContext(s,cx),plain=v=>JSON.parse(JSON.stringify(v));
run(`const C=Core,trial={battle:{E:[1,0,0,0,1,0,0,0,1]},asset:null},fleet={assets:new Map()},tv={add:(a,b,k=1)=>a.map((v,i)=>v+b[i]*k),sub:(a,b)=>a.map((v,i)=>v-b[i]),scale:(a,k)=>a.map(v=>v*k),len:a=>Math.hypot(...a),norm:a=>{const n=Math.hypot(...a)||1;return a.map(v=>v/n);}};
const trialApply=(r,v)=>[r[0]*v[0]+r[3]*v[1]+r[6]*v[2],r[1]*v[0]+r[4]*v[1]+r[7]*v[2],r[2]*v[0]+r[5]*v[1]+r[8]*v[2]],trialApplyT=(r,v)=>[C.dot(r.slice(0,3),v),C.dot(r.slice(3,6),v),C.dot(r.slice(6,9),v)],spaceRotU=(e,u)=>u.rot||e,spaceWorld=u=>u.pos,spaceHullPoint=()=>[-999,-999,-999],unitFoilDeployments=u=>u.deployments;
function fixture(){fleet.assets.clear();const mounts=[{id:1,module:0,cell:'b0',center:[10,4,0],pivot:[10,5,0],muzzle:[12,5,0],barrelLength:2,dir:[1,0,0],fixed:false},{id:2,module:1,cell:'b1',center:[-20,4,0],pivot:[-20,5,0],muzzle:[-18,5,0],barrelLength:2,dir:[1,0,0],fixed:true},{id:3,module:2,cell:'b2',center:[80,4,0],pivot:[80,5,0],muzzle:[82,5,0],barrelLength:2,dir:[1,0,0],fixed:true}],a={id:'source',key:'ship',pos:[100,20,30],p:{surface:{offset:[0,0,0],mounts}},surfaceLastFire:{cells:[{fit:1,energy:1,gun:1,ion:0},{fit:2,energy:2,gun:0,ion:2}]}},t={pos:[1100,20,30]};return {a,t};}
`);
for(const line of app.split('\n'))if(line.startsWith('function trialAxisMatrix(')||line.startsWith('const spaceAtt=new WeakMap(),m3Mul='))run(line);
const start=app.indexOf('function spaceSurfaceTurretPose('),end=app.indexOf('\nfunction spaceShots(',start);assert.ok(start>=0&&end>start);run(app.slice(start,end));

test('representative streams use only the actual typed firing cells, never an arbitrary hull point',()=>{
 const r=run(`(()=>{const {a,t}=fixture();return {laser:spaceShotEmitter(a,t,5,false),ion:spaceShotEmitter(a,t,3,true)};})()`);
 assert.equal(r.laser.fit,1);assert.equal(r.laser.cell,'b0');assert.equal(r.ion.fit,2);assert.equal(r.ion.cell,'b1');assert.equal(r.laser.unit,'source');assert.notDeepEqual(plain(r.laser.pos),[-999,-999,-999]);
});

test('a surface ship with no recorded firing cells cannot invent a cosmetic shot',()=>{
 assert.equal(run(`(()=>{const {a,t}=fixture();a.surfaceLastFire.cells=[];return spaceShotEmitter(a,t,0);})()`),null);
 assert.deepEqual(plain(run(`(()=>{const {a,t}=fixture();delete a.p.surface;return spaceShotEmitter(a,t,0).pos;})()`)),[-999,-999,-999]);
});

test('a fixed mount preserves its real muzzle and rotated barrel axis regardless of target bearing',()=>{
 const r=run(`(()=>{const {a,t}=fixture();a.rot=[0,0,-1,0,1,0,1,0,0];t.pos=[-1000,1000,0];return spaceShotEmitter(a,t,0,true);})()`);
 assert.equal(r.fixed,true);assert.deepEqual(plain(r.dir),[0,0,-1]);assert.deepEqual(plain(r.pos),[100,25,48]);
});

test('tracking barrels emit one real barrel length away from their pivot',()=>{
 const r=run(`(()=>{const {a,t}=fixture(),e=spaceShotEmitter(a,t,0,false);return {distance:tv.len(tv.sub(e.pos,tv.add(a.pos,a.p.surface.mounts[0].pivot))),dir:e.dir};})()`);
 assert.ok(Math.abs(r.distance-2)<1e-9);assert.ok(r.dir[0]>.999);
});

test('an S-foil emitter follows the same rigid hinge transform as the rendered gun',()=>{
 const r=run(`(()=>{const {a,t}=fixture(),m=a.p.surface.mounts[1];m.pivot=[0,1,0];m.muzzle=[0,2,0];m.dir=[0,1,0];a.deployments={foil:0};fleet.assets.set('ship',{geometry:{center:[0,0,0],turrets:[{id:2,foilId:'foil'}],foils:[{id:'foil',pivot:[0,0,0],axis:'x',open:90,stow:0,sg:1}]}});return spaceShotEmitter(a,t,0,true);})()`);
 assert.ok(Math.abs(r.pos[0]-100)<1e-9);assert.ok(Math.abs(r.pos[1]-20)<1e-9);assert.ok(Math.abs(r.pos[2]-28)<1e-9);assert.ok(Math.abs(r.dir[2]+1)<1e-9);
});

test('an older cached visual center is corrected to the same absolute design muzzle',()=>{
 const r=run(`(()=>{const {a,t}=fixture();a.p.surface.offset=[80,23.5,0];fleet.assets.set('ship',{geometry:{center:[77.8,23.4,0],turrets:[],foils:[]}});return spaceShotEmitter(a,t,0,true);})()`);
 assert.ok(Math.abs(r.pos[0]-84.2)<1e-9);assert.ok(Math.abs(r.pos[1]-25.1)<1e-9);assert.equal(r.pos[2],30);
});

test('an off-axis tracking stream starts at the exact muzzle produced by the rendered mesh pose',()=>{
 const r=run(`(()=>{const {a,t}=fixture();t.pos=[400,300,800];const rest={id:1,mesh:'gun1',pivot:[10,4,0],origin:[10,5,0],fw:[1,0,0]},asset={geometry:{center:[0,0,0],turrets:[rest],foils:[]}};fleet.assets.set('ship',asset);const emitter=spaceShotEmitter(a,t,0),pose=spaceSurfaceTurrets(a,t)[0],endpoint=tv.add(a.pos,tv.add(pose.pivot,trialApply(pose.rot,tv.add(tv.sub(rest.origin,rest.pivot),rest.fw,2)))),fw=trialApply(pose.rot,rest.fw),want=tv.norm(tv.sub(t.pos,tv.add(a.pos,rest.pivot)));return {pos:emitter.pos,endpoint,dot:C.dot(fw,want),mesh:pose.mesh};})()`);
 assert.equal(r.mesh,'gun1');assert.ok(r.dot>1-1e-9);for(let i=0;i<3;i++)assert.ok(Math.abs(r.pos[i]-r.endpoint[i])<1e-9);
});

test('a locally unpowered turret retains its servo angle while its supporting S-foil still moves',()=>{
 const r=run(`(()=>{const {a,t}=fixture();a.p.modules=[{k:'weapon',domain:'main'}];a.deployments={foil:0};const rest={id:1,mesh:'gun1',pivot:[0,1,0],origin:[0,2,0],fw:[1,0,0],foilId:'foil'},asset={geometry:{center:[0,0,0],turrets:[rest],foils:[{id:'foil',pivot:[0,0,0],axis:'x',open:90,stow:0,sg:1}]}};fleet.assets.set('ship',asset);const m=a.p.surface.mounts[0],first=spaceSurfaceTurretPose(a,t,rest,m,asset);a.gridState={local:{0:5},domains:{}};a.deployments.foil=1;const second=spaceSurfaceTurretPose(a,t,rest,m,asset);return {first:first.aim,second:second.aim,pivot:second.pivot,rot:second.rot};})()`);
 assert.deepEqual(plain(r.first),plain(r.second));assert.deepEqual(plain(r.pivot),[0,1,0]);assert.deepEqual(plain(r.rot),plain(r.second));
});
