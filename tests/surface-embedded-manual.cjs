const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),cx=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const run=source=>vm.runInContext(source,cx),plain=x=>JSON.parse(JSON.stringify(x)),near=(a,b)=>a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-7,`${a} != ${b}`));
run(`const C=Core,G=Gfx,trial={R:[0,0,-1,0,1,0,1,0,0],P:[100,20,-40],craft:false,p:{},battle:{E:[1,0,0,0,1,0,0,0,1]}},fleet={assets:new Map()};
const tv={add:(a,b,k=1)=>a.map((v,i)=>v+k*b[i]),sub:(a,b)=>a.map((v,i)=>v-b[i]),scale:(a,k)=>a.map(v=>v*k),dot:(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),len:a=>Math.hypot(...a),norm:a=>{const n=Math.hypot(...a)||1;return a.map(v=>v/n);},cross:(a,b)=>C.cross(a,b)};
const trialApply=(r,v)=>[r[0]*v[0]+r[3]*v[1]+r[6]*v[2],r[1]*v[0]+r[4]*v[1]+r[7]*v[2],r[2]*v[0]+r[5]*v[1]+r[8]*v[2]],spaceRotU=(e,u)=>u.rot||e,spaceWorld=u=>u.pos,spaceHullPoint=()=>[-999,-999,-999],unitFoilDeployments=u=>u.deployments;
const TRIAL_PILOT_CYCLE=C.CRAFT_FIRE.cycles,TRIAL_GUN={range:20000};
function fixture(face='port',kind='pd',manual=false){
 const ship=C.newShip({L:180,W:100,H:80,assembly:true},'Embedded manual firing');ship.hull.assembly=true;ship.parts=[];ship.fits=[];ship.armor={hull:0,cit:0};ship.detail=0;
 const body=C.placePart(ship,'struct',[70,30,0],[100,64,48],{form:'box',yaw:19,pitch:13,roll:7},false),p=C.surfacePatches(ship).find(p=>p.host==='p'+body.id&&p.face===face);
 let fit;if(manual){const out=C.placeFit(ship,kind,p.center,p.normal,0,false,{localMount:true});if(out.err)throw Error(out.err);fit=out.fit;}
 else {const out=C.setSurfaceConfig(ship,p.id,{battery:{weapon:kind,count:1,spacing:0},equipment:{kind:'none',count:0}});if(!out.ok)throw Error(out.why);fit=C.surfaceDerivedFits(ship).find(f=>f.surfacePatch===p.id&&!f.surfaceUnplaced);}
 if(!fit)throw Error('fixture has no mounted gun');const geometry=G.fleetGeometry(ship,{trial:true}),rest=geometry.turrets.find(t=>t.id===fit.id),t=trialTurretState(rest);t.oW=trialApply(trial.R,tv.sub(t.origin,geometry.center));t.bd=tv.norm(tv.add(tv.scale(t.fw,.12),t.e2,.98));return {ship,fit,geometry,t,port:C.surfaceBatteryGeometry(fit)};
}
`);
function extract(name){const a=app.indexOf('function '+name+'('),b=app.indexOf('\n}',a)+2;assert.ok(a>=0&&b>a,name);run(app.slice(a,b));}
for(const line of app.split('\n'))if(line.startsWith('const trialBarrel=')||line.startsWith('const trialLimits=')||line.startsWith('function trialAxisMatrix(')||line.startsWith('function trialTurretState('))run(line);
extract('trialShotGeometry');
const start=app.indexOf('function spaceSurfaceTurretPose('),end=app.indexOf('\nfunction spaceShots(',start);assert.ok(start>=0&&end>start);run(app.slice(start,end));

test('actual manual-shot geometry emits at the compact port and keeps offset barrels in the wall plane',()=>{
 for(const face of ['fore','aft','top','bottom','port','stbd']){
  const r=run(`(()=>{const {t,geometry,port}=fixture('${face}'),bw=trialApply(trial.R,t.bd),shot=trialShotGeometry(t,bw),want=tv.add(trial.P,trialApply(trial.R,tv.sub(port.mouth,geometry.center))),n=trialApply(trial.R,port.normal);return {embedded:t.embedded,base:shot.base,want,sideNormal:tv.dot(shot.side,n),spread:shot.spread,width:port.width,oldAdvance:t.r*1.2};})()`);
  assert.equal(r.embedded,true);near(r.base,r.want);assert.ok(Math.abs(r.sideNormal)<1e-8,'gimballed firing must not push a barrel through the wall');assert.ok(r.spread<=r.width);assert.ok(r.oldAdvance>1,'fixture must expose the old several-metre muzzle error');
 }
});

test('wall and roof ports aim straight outward while native fixed and manual casemate limits remain distinct',()=>{
 const result=run(`(()=>{const {t,port}=fixture('top'),fixed=fixture('port','claser').t,casemate=fixture('top','casemateLight').t;return {direction:trialBarrel(t,0,0),normal:port.normal,limits:trialLimits(t),fixed:trialLimits(fixed),isFixed:fixed.fixed,oldCase:trialLimits({casemate:true}),embeddedCase:trialLimits(casemate),pilot:trialLimits({pilot:true,embedded:true})};})()`);
 near(result.direction,result.normal);assert.equal(result.limits.yaw,Math.PI/2);assert.equal(result.limits.lo,-Math.PI/2);assert.equal(result.limits.hi,Math.PI/2);
 assert.equal(result.isFixed,true);assert.deepEqual(plain(result.fixed),{yaw:0,lo:0,hi:0});assert.deepEqual(plain(result.pilot),{yaw:0,lo:0,hi:0});assert.ok(result.oldCase.yaw<Math.PI/2&&result.oldCase.hi<Math.PI/2);assert.deepEqual(plain(result.embeddedCase),plain(result.oldCase));
});

test('ordinary same-kind manual guns retain the original barrel advance and spread',()=>{
 const r=run(`(()=>{const {t,port}=fixture('top','pd',true),bw=trialApply(trial.R,t.bd),shot=trialShotGeometry(t,bw),origin=tv.add(trial.P,t.oW);return {embedded:t.embedded,port,advance:tv.dot(tv.sub(shot.base,origin),bw),spread:shot.spread,r:t.r};})()`);
 assert.equal(r.embedded,false);assert.equal(r.port,null);assert.ok(Math.abs(r.advance-r.r*1.2)<1e-8);assert.equal(r.spread,r.r*.35);
});

test('space battle representative streams use the same embedded mouth without a hidden turret length',()=>{
 const r=run(`(()=>{const {ship,fit,port}=fixture('port'),stats=C.computeStats(ship),profile=C.fleetProfile(stats,ship.name,ship),geometry=G.fleetGeometry(ship,{center:profile.surface.offset}),mount=profile.surface.mounts.find(m=>m.id===fit.id),a={id:'source',key:'embedded',pos:[120,40,60],rot:trial.R,p:profile,surfaceLastFire:{cells:[{fit:fit.id,energy:1,gun:1,ion:0}]}},target={pos:[1200,500,800]};fleet.assets.set(a.key,{geometry});const e=spaceShotEmitter(a,target,0),want=tv.add(a.pos,trialApply(a.rot,tv.sub(port.mouth,profile.surface.offset)));return {e,want,barrel:mount.barrelLength,mesh:geometry.turrets.find(t=>t.id===fit.id).mesh};})()`);
 assert.equal(r.barrel,0);assert.equal(r.mesh,null);near(r.e.pos,r.want);assert.equal(r.e.fixed,false);
});
