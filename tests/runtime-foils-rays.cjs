const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const engine=fs.readFileSync(path.join(root,'js/engine.js'),'utf8'),run=code=>vm.runInContext(code,context),plain=v=>JSON.parse(JSON.stringify(v));
run('const C=Core;const messages=[];const post=message=>messages.push(message);');
run(engine.slice(engine.indexOf('let trialHold = null;'),engine.indexOf('// Built fleet ships')));
const C=run('Core');
function near(a,b,message='vector'){assert.equal(a.length,b.length);a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-6,`${message}[${i}]: ${v} != ${b[i]}`));}
function fixture(axis='x'){
 const ship=C.newShip({L:40,W:20,H:10,assembly:true}),wing={id:1,k:'struct',form:'box',c:[20,20,15],s:[4,10,2],wing:C.normalizeWing({foil:true,axis,open:90,stow:0,T:1,pivot:[20,20,10]})};
 const gun={id:2,k:'claser',p:[5,20,15],a:2,n:[0,1,0],base:0,ped:0,localMount:true};gun.p[1]-=C.fitSpec(gun).hm*.7;ship.parts.push(wing);ship.fits.push(gun);ship.nextId=3;
 const hold={ship,ctx:C.turretRayContext(ship),fits:new Map(ship.fits.map(f=>[f.id,f]))};return {ship,wing,gun,hold};
}
function pose(hold,foils){context.hold=hold;context.foils=foils;return run('trialRayPose(hold,foils)');}
function rays(hold,job){context.hold=hold;context.job=job;run('trialHold=hold;handleTrialRays(job);');return run('messages.at(-1)');}

test('runtime clearance switches from blocked to clear when an authored wing folds away from the ray',()=>{
 const {hold,wing,gun}=fixture(),baseJSON=C.publicJSON(hold.ship),baseHF=hold.ctx.hf,baseObstacles=hold.ctx.obst;
 const open=rays(hold,{id:10,ids:[gun.id],dirs:[1,0,0],foils:{[wing.id]:1}}),closed=rays(hold,{id:11,ids:[gun.id],dirs:[1,0,0],foils:{[wing.id]:0}});
 assert.equal(open.ready,true);assert.deepEqual(Array.from(open.clear),[0]);assert.deepEqual(Array.from(closed.clear),[1]);assert.equal(closed.id,11);
 assert.equal(C.publicJSON(hold.ship),baseJSON);assert.equal(hold.ctx.hf,baseHF);assert.equal(hold.ctx.obst,baseObstacles);
});

test('posed roots use the custom pivot, and matching posed fit objects rebuild origins, normals and bounds',()=>{
 const {ship,wing,gun,hold}=fixture();wing.wing.members={fits:[gun.id],parts:[]};gun._testCache={stale:true};gun.base=.2;gun.ped=.1;
 const before=C.publicJSON(ship),frame=C.foilFrame(ship,wing),origin=C.turretOrigin(gun),result=pose(hold,{[wing.id]:0}),copy=result.fits.get(gun.id);
 assert.notEqual(result.ship,ship);assert.notEqual(result.ctx,hold.ctx);assert.notEqual(copy,gun);assert.equal(copy._testCache,undefined);
 near(copy.p,C.foilAt(frame,wing,gun.p,0));near(copy.n,[0,0,1]);near(C.fitUp(copy),[0,0,1]);near(C.turretOrigin(copy),C.foilAt(frame,wing,origin,0),'rigid muzzle origin');
 assert.equal(result.ctx.obst.find(o=>o.fit?.id===gun.id).fit,copy,'self-obstacle checks use the same posed fitting object');
 const root=result.ship.parts.find(p=>p.id===wing.id);assert.equal(root.form,'mesh');near(root.c,[20,15,10]);assert.equal(root._solidCutShip,result.ship);assert.equal(C.publicJSON(ship),before);
});

test('carried cylinders and boxes rotate their physical axes with the runtime foil',()=>{
 const {ship,wing,hold}=fixture('y'),engine={id:3,k:'engine',c:[21,20,15],d:1,dir:[-1,0,0]},box={id:4,k:'battery',c:[19,20,15],d:2,room:[2,4,1],yaw:23,surfaceNormal:[0,1,0]};
 ship.parts.push(engine,box);wing.wing.members={parts:[3,4],fits:[]};const sourceFrame=C.structFrame(box),frame=C.foilFrame(ship,wing),rotate=v=>C.sub(C.foilAt(frame,wing,C.add(frame.pv,v),0),frame.pv),result=pose(hold,{[wing.id]:0});
 near(result.ship.parts.find(p=>p.id===engine.id).dir,rotate(engine.dir));const posedBox=result.ship.parts.find(p=>p.id===box.id),posedFrame=C.structFrame(posedBox);near(posedFrame.fw,rotate(sourceFrame.fw));near(posedFrame.up,rotate(sourceFrame.up));
 near(posedBox.c,C.foilAt(frame,wing,box.c,0));assert.equal(box.yaw,23);
});

test('fully deployed, absent and malformed fractions reuse the exact base context; known numeric fractions clamp',()=>{
 const {hold}=fixture();
 for(const value of [undefined,null,{}, {'1':1}, {'999':0}, {'1':NaN}, {'1':Infinity}, {'1':'0'}, {'1':{}}, Object.create({'1':0}), {'1':2}])assert.equal(pose(hold,value),hold);
 assert.equal(pose(hold,{'1':-10}),pose(hold,{'1':0}));
});

test('pose cache reuses identical deployment states and bounds memory to three private contexts',()=>{
 const {hold}=fixture(),first=pose(hold,{'1':.1});assert.equal(pose(hold,{'1':.1,'999':0}),first);pose(hold,{'1':.2});pose(hold,{'1':.3});assert.equal(hold.poses.size,3);pose(hold,{'1':.4});assert.equal(hold.poses.size,3);assert.ok(!Array.from(hold.poses.values()).includes(first));
});

test('invalid or stale fit IDs and ray directions fail closed without accepting design data from the caller',()=>{
 const {hold,gun}=fixture();let result=rays(hold,{ids:[gun.id,999,'2',gun.id,gun.id],dirs:[1,0,0,1,0,0,1,0,0,0,0,0,NaN,0,1],foils:{'1':0,'999':0}});assert.deepEqual(Array.from(result.clear),[1,0,0,0,0]);
 result=rays(hold,{ids:'invalid',dirs:null});assert.equal(result.clear.length,0);
 result=rays(hold,{ids:new Uint32Array([gun.id]),dirs:new Float32Array([1,0,0]),foils:{'1':0}});assert.deepEqual(Array.from(result.clear),[1]);
 result=rays(null,{ids:[gun.id],dirs:[1,0,0],foils:{'1':0}});assert.equal(result.ready,false);assert.deepEqual(Array.from(result.clear),[0]);
});
