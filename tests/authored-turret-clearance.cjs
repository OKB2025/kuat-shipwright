const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(__dirname,'..'),cx=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js']){
 let source=fs.readFileSync(path.join(root,file),'utf8');
 if(file==='js/core.js'){const hook='surfaceCopyIdentity, surfaceCaptureConfig,';assert.equal(source.split(hook).length,2);source=source.replace(hook,'surfaceMountArc, '+hook);}
 vm.runInContext(source,cx,{filename:file});
}
const C=vm.runInContext('Core',cx);
function fixture(){
 const s=C.newShip({assembly:true,L:100,W:40,H:30},'Physical muzzle clearance');s.parts=[];s.fits=[];
 C.placePart(s,'struct',[50,5,0],[100,40,10],{form:'box'},false);
 const f={id:s.nextId++,k:'quad500',p:[50,10,0],a:2,ped:0,base:0,low:0,float:false};s.fits=[f];
 return {s,f,g:C.authoredTurretGeometry(f)};
}
test('a wall in front of only one real quad mouth blocks the whole volley',()=>{
 const {s,f,g}=fixture(),dir=[1,0,0];assert.equal(C.turretClear(s,f,dir,C.turretRayContext(s)),true);
 const wall=C.placePart(s,'struct',[70,g.muzzles[0][1],g.muzzles[0][2]],[.5,.5,.5],{form:'box'},false);
 assert.equal(g.muzzles.filter(p=>C.rayPart(C.add(p,C.mul(dir,.02)),dir,wall)).length,1,'the blocker must cover one distinct barrel, not an approximate central ray');
 assert.equal(C.turretClear(s,f,dir,C.turretRayContext(s)),false);
});
test('elevated mouths clear a low obstruction using their real trunnion transform',()=>{
 const {s,f,g}=fixture();C.placePart(s,'struct',[70,g.muzzles[0][1],g.muzzles[0][2]],[.5,.5,.5],{form:'box'},false);
 assert.equal(C.turretClear(s,f,[1,0,0],C.turretRayContext(s)),false);
 const pose=C.aimAuthoredTurret(g,0,Math.PI/6);assert.ok(pose.muzzles.every((p,i)=>p[1]>g.muzzles[i][1]));
 assert.equal(C.turretClear(s,f,pose.fw,C.turretRayContext(s),pose.muzzles),true);
 assert.equal(C.turretClear(s,f,pose.fw,C.turretRayContext(s)),true,'automatic direction queries derive the same physical pose');
});
test('worker mouth arrays must contain every finite physical barrel origin',()=>{
 const {s,f,g}=fixture(),ctx=C.turretRayContext(s),pose=C.aimAuthoredTurret(g,.2,.3);
 assert.equal(C.turretClear(s,f,pose.fw,ctx,pose.muzzles),true);
 assert.equal(C.turretClear(s,f,pose.fw,ctx,pose.muzzles.slice(1)),false,'a missing lower barrel cannot bypass its obstruction check');
 const invalid=pose.muzzles.map(p=>p.slice());invalid[0][0]=NaN;assert.equal(C.turretClear(s,f,pose.fw,ctx,invalid),false);
});
test('manual clearance and fleet fire share both physical elevation stops',()=>{
 const {s,f}=fixture();f.p[0]=90;const g=C.authoredTurretGeometry(f),ctx=C.turretRayContext(s),u={pos:[0,0,0],yaw:0,p:{surface:{shell:[]}}},mount={authored:g,muzzle:g.muzzles[0],gun:1,ion:0,band:'mid',arcs:[1,1,1,1,1,1]};
 for(const [degrees,allowed]of [[-11,false],[-10,true],[0,true],[85,true],[86,false]]){
  const pose=C.aimAuthoredTurret(g,0,degrees*Math.PI/180),target={pos:C.add(g.elevationPivot,C.mul(pose.fw,2000))};
  assert.equal(C.authoredTurretInArc(g,pose.fw),allowed,`${degrees} degrees: shared envelope`);
  assert.equal(C.turretClear(s,f,pose.fw,ctx,pose.muzzles),allowed,`${degrees} degrees: manual physical mouths`);
  assert.equal(C.surfaceMountArc(u,target,mount,2000)>0,allowed,`${degrees} degrees: fleet eligibility must match its rendered and emitted pose`);
 }
});
