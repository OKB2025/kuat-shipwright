const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console,performance:{now:()=>0}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',context),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),plain=v=>JSON.parse(JSON.stringify(v));
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return app.slice(a,b);}
vm.runInContext("const C=Core,st={weaponMount:'auto'},ship=C.newShip({L:400,W:300,H:120,plan:'rect',sec:'rect'});const publicCopy=o=>JSON.parse(JSON.stringify(o,(k,v)=>k&&k[0]==='_'?undefined:v));",context);
for(const [start,end]of [['function weaponTiltMode(','function weaponPlacementNormal('],['function seatFit(','function moveFitTo('],['const r6=','function xfPartOut('],['function xfFitForward(','// UI-002/003/004']])vm.runInContext(section(start,end),context);
const run=s=>vm.runInContext(s,context),near=(a,b,eps=1e-6)=>{assert.equal(a.length,b.length);a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<eps,`${a} != ${b}`));};
function fixture(k,yaw){context.testKind=k;context.testYaw=yaw;return run("(()=>{const h=C.rayEnv(ship,[200,1000,50],[0,-1,0],{structOnly:true});const f={id:1,k:testKind,p:h.p.slice(),n:[0,1,0],a:2,ped:0,base:0,low:0,float:false};if(testYaw!=null)f.assetYaw=testYaw;C.mountFit(ship,f);return f;})()");}
function turn(f,axis,angle,followers=[]){context.testFit=f;context.testFollowers=followers;context.testAxis=axis;context.testAngle=angle;return run("(()=>{const d={list:'fits',it:testFit,fol:testFollowers},R=xfRot(testAxis,testAngle);return {R,rows:xfRows([d],[{drivers:[d]}],()=>({pt:p=>p.slice(),R})).rows};})()");}
function heading(f){context.testHeadingFit=f;return run('xfFitForward(testHeadingFit)');}

test('the edit rotation operation changes turret heading and the actual procedural and model meshes once',()=>{
 for(const k of ['htl','pd','cturret','stl','oct40']){
  const f=fixture(k,17.5),before=plain(f),a=turn(f,1,90),o=a.rows[0].out;near(heading(o),a.R(heading(f)));assert.deepEqual(plain(f),before,'preview leaves original unchanged');
  const origin=C.fitOrigin(f),target=C.fitOrigin(o),apply=p=>C.add(target,a.R(C.sub(p,origin)));
  if(C.FITS[k].asset){for(const v of [[.5,.2,.1],[-.25,.5,-.5]])near(C.referenceFitPoint(o,v),apply(C.referenceFitPoint(f,v)),1e-5);}
  else{const source=G.meshFits({fits:[f]}),dest=G.meshFits({fits:[o]});assert.equal(source.n,dest.n);for(let i=0;i<source.n;i++)near(Array.from(dest.pos.slice(i*3,i*3+3)),apply(Array.from(source.pos.slice(i*3,i*3+3))),4e-5);}
 }
});

test('tilted turret mounts preserve their full transformed heading when changing rotation axes',()=>{
 for(const k of ['htl','cturret','stl','oct40'])for(const axis of [0,1,2])for(const angle of [15,73]){
  const f=fixture(k,31.25),a=turn(f,axis,angle),o=a.rows[0].out;near(C.fitUp(o),a.R(C.fitUp(f)));near(heading(o),a.R(heading(f)));
 }
});

test('linked left-right and top-bottom turret followers keep the reflected heading after edit rotation',()=>{
 for(const k of ['htl','stl','oct40'])for(const axis of [0,1,2]){
  const f=fixture(k,23.5),followers=[{it:{...plain(f),id:2,p:C.mirrorP(f.p),assetYaw:-23.5},z:true,y:false},{it:{...plain(f),id:3,p:C.vmirrorPoint(run('ship'),f.p),a:3,n:[0,-1,0],assetYaw:-23.5},z:false,y:true},{it:{...plain(f),id:4,p:C.mirrorP(C.vmirrorPoint(run('ship'),f.p)),a:3,n:[0,-1,0],assetYaw:23.5},z:true,y:true}],a=turn(f,axis,41,followers),fw=a.R(heading(f));
  for(let i=0;i<followers.length;i++){const l=followers[i],o=a.rows[i+1].out;let v=fw;if(l.y)v=[v[0],-v[1],v[2]];if(l.z)v=C.mirrorP(v);near(heading(o),v);}
 }
});

test('translation and an unchanged rotation do not add zero-angle metadata to old turret saves',()=>{
 const f=fixture('htl');context.testFit=f;
 const shifted=run("(()=>{const d={list:'fits',it:testFit,fol:[]};return xfRows([d],[{drivers:[d]}],()=>({pt:p=>C.add(p,[2,0,0]),R:null})).rows[0].out;})()");
 assert.equal(Object.hasOwn(shifted,'assetYaw'),false);assert.equal(Object.hasOwn(turn(f,1,0).rows[0].out,'assetYaw'),false);near(heading(shifted),heading(f));
 const old=fixture('htl',17.123456789),same=turn(old,1,0).rows[0].out;assert.equal(same.assetYaw,old.assetYaw);
});

test('fixed guns and casemates keep their existing heading metadata during generic edit rotation',()=>{
 for(const k of ['claser','casemateMid']){const f=fixture(k,19.125),o=turn(f,1,43).rows[0].out;assert.equal(C.fitCanRotate(o),false);assert.equal(o.assetYaw,f.assetYaw);}
});
