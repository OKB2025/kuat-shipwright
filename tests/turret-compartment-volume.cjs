const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance:{now:()=>0}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js']){let source=fs.readFileSync(path.join(root,file),'utf8');if(file==='js/core.js'&&process.env.KS_TURRET_COMPARTMENT_PATCH)source=require(process.env.KS_TURRET_COMPARTMENT_PATCH)(source);vm.runInContext(source,cx,{filename:file});}
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),plain=v=>JSON.parse(JSON.stringify(v)),near=(a,b,eps=1e-5)=>assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`);
const faces=[[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[0,3,7,4],[1,5,6,2]],box=(L,H,W,offset=[0,0,0])=>({verticesM:[[-1,0,-1],[1,0,-1],[1,1,-1],[-1,1,-1],[-1,0,1],[1,0,1],[1,1,1],[-1,1,1]].map(v=>[v[0]*L/2+offset[0],v[1]*H+offset[1],v[2]*W/2+offset[2]]),faces});
let serial=0;
function register(solids,{metadata=true}={}){
 const key='volumeTest'+(++serial),barrel=box(30,.5,.5,[20,.5,0]),all=[...solids,barrel],points=all.flatMap(q=>q.verticesM),low=[0,1,2].map(i=>Math.min(...points.map(p=>p[i]))),high=[0,1,2].map(i=>Math.max(...points.map(p=>p[i]))),size=high.map((v,i)=>v-low[i]),center=high.map((v,i)=>(v+low[i])/2),indices=[];let offset=0;
 for(const q of all){const center=q.verticesM.reduce((s,p)=>s.map((v,i)=>v+p[i]/q.verticesM.length),[0,0,0]);for(const row of q.faces){let ids=row.slice(),a=q.verticesM[ids[0]],n=C.cross(C.sub(q.verticesM[ids[1]],a),C.sub(q.verticesM[ids[2]],a));if(C.dot(n,C.sub(center,a))>0)ids.reverse();for(let j=1;j+1<ids.length;j++)indices.push(offset+ids[0],offset+ids[j],offset+ids[j+1]);}offset+=q.verticesM.length;}
 const data=Buffer.alloc(points.length*10+indices.length*2);points.forEach((p,i)=>p.forEach((v,k)=>data.writeInt16LE(Math.round((v-center[k])/size[k]*65532),i*6+k*2)));indices.forEach((v,i)=>data.writeUInt16LE(v,points.length*10+i*2));
 C.REFERENCE_ASSETS[key]={kind:'fit',plainMetal:true,n:points.length,faces:indices.length/3,indexBytes:2,size,c:center,mount:[0,0,0],forward:[1,0,0],up:[0,1,0],data:data.toString('base64'),...(metadata?{turretCompartment:{version:1,role:'gunhouse',convexes:solids}}:{})};
 C.FITS[key]={...C.FITS.pd,key,asset:key,tt:5,boltTT:2.5,barrels:2,power:5*C.TT,cycle:1,mass:100,crew:1,cost:1000,fm:size[0],hm:size[1],wm:size[2],r:Math.max(size[0],size[2])/2,weaponSizing:{factor:1,sourceSize:size,sourceVolume:size.reduce((a,b)=>a*b,1)}};
 return key;
}
function fixture(solids=[box(10,2,5)],options={}){const key=register(solids,options),s=C.newShip({L:100,W:100,H:30,assembly:true},'Gunhouse volume fixture');s.parts=[];C.placePart(s,'struct',[50,-10,0],[100,100,20],{form:'box',corner:0},false);const f={id:s.nextId++,k:key,p:[50,0,0],a:2,ped:0,base:0,low:0,float:false};s.fits.push(f);return {s,f,key};}
function status(s,f){C.syncCompartments(s);return C.chargingStatus(s,new Set())[f.id];}

test('only the closed gunhouse contributes usable volume, excluding barrels and empty envelope corners',()=>{
 const {s,f}=fixture([{verticesM:[[0,0,0],[10,0,0],[0,6,0],[0,0,10]],faces:[[0,2,1],[0,1,3],[0,3,2],[1,2,3]]}]),a=C.turretCompartment(s,f);near(a.housingVolume,100);near(a.externalVolume,100);near(a.housingUsed,100);near(a.internalRequired,0);assert.ok(C.fitSpec(f).fm*C.fitSpec(f).wm*C.fitSpec(f).hm>1000,'the visible barrel and empty tetrahedron envelope are much larger than the actual room');
});

test('embedded gunhouse volume is subtracted from the real union of overlapping hull structures',()=>{
 const {s,f}=fixture();for(let i=0;i<2;i++)C.placePart(s,'struct',[50,.5,0],[10,5,1],{form:'box',corner:0},false);const a=C.turretCompartment(s,f);near(a.housingVolume,100);near(a.externalVolume,50);near(a.embeddedVolume,50);near(a.internalRequired,0);const q=status(s,f);near(q.externalUsed,50);near(q.embeddedUsed,50);near(q.internalVolume,0);near(q.internalOccupiedVolume,50);near(q.volume,100);near(q.storedTT,5);
});

test('embedded gunhouse remains occupied even when its exterior already houses the whole bank',()=>{
 const {s,f}=fixture([box(10,10,10)]);C.placePart(s,'struct',[50,.5,0],[10,10,1],{form:'box',corner:0},false);const cargo=C.placePart(s,'cargo',[50,.5,0],4,{room:[4,4,.5]},false),q=status(s,f),room=C.allOccupied(s).find(p=>p.turretRoom);near(q.externalVolume,900);near(q.embeddedVolume,100);near(q.housingUsed,100);near(q.internalRequired,0);near(q.internalOccupiedVolume,100);assert.ok(room);near(C.partVolume(room),100);assert.ok(C.inPart(room,[50,.5,0]));assert.ok(!C.inPart(room,[50,-.5,0]),'the reservation is the clipped intrusion, not its envelope');assert.equal(C.overlapParts(room,cargo),false,'the flexible cargo must move out of the weapon-owned intrusion');
});

test('embedded house equipment counts once before reserving the remaining bank below deck',()=>{
 const {s,f,key}=fixture([box(10,3,5)]);C.FITS[key].tt=27.5;C.FITS[key].boltTT=13.75;C.FITS[key].power=27.5*C.TT;C.placePart(s,'struct',[50,1,0],[10,5,2],{form:'box',corner:0},false);const q=status(s,f);near(q.required,550);near(q.externalUsed,50);near(q.embeddedUsed,100);near(q.housingUsed,150);near(q.internalRequired,400);near(q.internalVolume,400);near(q.internalOccupiedVolume,500);near(q.volume,550);near(q.storedTT,27.5);
});

test('coincident closed house pieces are counted once and open or missing metadata receives no credit',()=>{
 const repeated=fixture([box(10,2,5),box(10,2,5)]);near(C.turretCompartment(repeated.s,repeated.f).housingVolume,100);
 const missing=fixture([box(10,2,5)],{metadata:false});near(C.turretCompartment(missing.s,missing.f).externalVolume,0);near(status(missing.s,missing.f).internalVolume,100);
 const open=box(10,2,5);open.faces=faces.slice(1);const invalid=fixture([open]);near(C.turretCompartment(invalid.s,invalid.f).externalVolume,0);near(status(invalid.s,invalid.f).internalVolume,100);
});

test('a larger external house reduces the reserved internal depth without increasing stored energy',()=>{
 const small=fixture([box(5,1,5)]),large=fixture([box(10,1,5)]),full=fixture([box(10,3,5)]),a=status(small.s,small.f),b=status(large.s,large.f),c=status(full.s,full.f);near(a.internalRequired,75);near(b.internalRequired,50);near(c.internalRequired,0);assert.ok(C.weaponCapacitors(large.s)[0].boxSize[1]<C.weaponCapacitors(small.s)[0].boxSize[1]);assert.equal(C.weaponCapacitors(full.s).length,0);for(const q of [a,b,c]){near(q.required,100);near(q.volume,100);near(q.storedTT,5);near(q.ratio,1);}
});

test('all ordinary powered guns share compartment accounting while launchers, craft and tractors remain excluded',()=>{
 for(const k of ['pd','quad500','twin40','ltl','ionL'])assert.equal(C.needsCapacitor({k}),true,k);
 for(const k of ['claser','cturret','cmsl','itl','trc'])assert.equal(C.needsCapacitor({k}),false,k);
});

test('gunhouse overlap follows the actual wall mount frame and authored yaw',()=>{
 const {s,f}=fixture();f.p=[100,-10,0];f.a=0;const outside=C.turretCompartment(s,f);near(outside.externalVolume,100);f.p=[99,-10,0];const embedded=C.turretCompartment(s,f);near(embedded.externalVolume,50);f.p=[100,-10,0];f.assetYaw=90;near(C.turretCompartment(s,f).externalVolume,100);
});

test('explicit salvo and allocation settings survive saving without a size-derived energy bonus',()=>{
 const {s,f}=fixture([box(10,3,5)]);f.chargeSalvos=3;f.chargeScale=2;const before=status(s,f);near(before.required,300);near(before.plannedVolume,600);near(before.housingUsed,150);near(before.internalRequired,450);near(before.storedTT,30);const loaded=C.deserialize(C.serialize(s)),after=status(loaded,loaded.fits[0]);for(const k of ['required','plannedVolume','housingUsed','internalRequired','internalVolume','volume','storedTT'])near(after[k],before[k]);assert.ok(!C.serialize(loaded).parts.some(p=>p.k==='capacitor'),'derived room reservations are recomputed from ordinary saved fittings');
});

test('planned or stale bank boxes never report unallocated volume as operational capacity',()=>{
 const {s,f}=fixture([box(5,1,5)]);status(s,f);f.chargeSalvos=2;let q=C.turretCompartment(s,f);assert.equal(q.allocationPending,true);near(q.internalVolume,0);C.weaponCapacitors(s);q=C.turretCompartment(s,f);assert.equal(q.allocationPending,true);near(q.internalVolume,0);q=status(s,f);assert.equal(q.allocationPending,false);near(q.internalVolume,175);near(q.storedTT,10);
});

test('normal guns project to uneven exterior decks without automatic risers, while manual supports remain explicit',()=>{
 const {s}=fixture();s.fits=[];C.placePart(s,'struct',[60,1,0],[10,20,2],{form:'box',corner:0},false);const f={id:s.nextId++,k:'pd',p:[50,-15,0],a:2,ped:0,base:8,low:-4,slope:12,float:false};C.mountFit(s,f);assert.ok(!f.float,'normal turret station rays still project to the exterior from approximate coordinates');near(f.p[1],0);for(const key of ['base','low','slope','ped'])near(f[key],0);near(C.len(C.sub(C.fitOrigin(f),f.p)),0);
 f.ped=3;C.mountFit(s,f);near(C.dot(C.sub(C.fitOrigin(f),f.p),C.fitUp(f)),3);for(const key of ['base','low','slope'])near(f[key],0);s.fits=[f];const loaded=C.deserialize(C.serialize(s));near(loaded.fits[0].ped,3);near(loaded.fits[0].base,0);
 const missile={id:s.nextId++,k:'cmsl',p:[20,0,0],a:2,ped:0,base:0,low:0,float:false,launchPitch:45};const g=C.launcherGeometry(missile);assert.ok(g.supportHeight>0,'the separately requested missile angle mechanism is retained');
});

test('bank hardware mass and cost stay constant when the same equipment moves into an external gunhouse',()=>{
 const a=fixture([box(5,1,5)]),b=fixture([box(10,3,5)]);const A=C.computeStats(a.s),B=C.computeStats(b.s);near(A.chargingTotalVolume,100);near(B.chargingTotalVolume,100);near(A.mass,B.mass);near(A.chargingHardwareMass,B.chargingHardwareMass);near(A.chargingHardwareCost,B.chargingHardwareCost);near(A.costBy.weapons,B.costBy.weapons);near(A.chargeInfo[a.f.id].storedTT,B.chargeInfo[b.f.id].storedTT);
});

test('destroying the turret removes its external bank capacity and prevents stored-charge firing',()=>{
 const {s,f}=fixture();s.surfaces={version:C.SURFACE_VERSION,mode:'strict',patches:[]};const S=C.computeStats(s),p=C.fleetProfile(S,s.name,s),u=C.fleetUnit('house-bank','fixture',p,0),m=p.surface.mounts.find(m=>m.id===f.id);assert.ok(m);near(m.housingCapacity,5);u.energy=5;u.surfaceBanks={[f.id]:5};u.mods[m.module]=0;assert.equal(C.surfaceSpend(u,f.id,1).ok,false);near(C.surfaceMountEnergy(u,f.id),0);
});

test('an oversized exterior gunhouse retains the same finite bank and charges only through the shared power budget',()=>{
 const {s,f}=fixture([box(20,3,10)]);C.placePart(s,'gen',[20,-10,0],4,{},false);s.surfaces={version:C.SURFACE_VERSION,mode:'strict',patches:[]};const S=C.computeStats(s),p=C.fleetProfile(S,s.name,s),u=C.fleetUnit('charged-house','fixture',p,0),m=p.surface.mounts.find(m=>m.id===f.id);near(p.wCap,5);near(m.capacity,5);near(m.housingCapacity,5);u.energy=0;u.surfaceBanks={[f.id]:0};assert.ok(p.grid.P>0);const request=p.grid.P*.1,allocation=C.allocateShipPower(u,C.fleetSystems(u),{weapons:request,throttle:0,deferHeat:true},1,'balanced');assert.ok(allocation.got.weapons>0&&allocation.got.weapons<=request);const charged=C.surfaceManualCharge(u,allocation.got.weapons,1),expected=allocation.got.weapons/C.TT*p.energyModel.eta;assert.ok(charged>0);near(charged,expected,expected*1e-9);near(C.surfaceMountEnergy(u,f.id),charged,expected*1e-9);assert.ok(charged<=m.capacity,'a large visible gunhouse cannot create unrequested energy capacity');
});
