const path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(path.resolve(__dirname,'..'));
const plain=value=>JSON.parse(C.publicJSON(value));
function legacyShip(kind){
 const ship=C.newShip({assembly:true,L:30,W:20,H:10},'Old exterior shield attachment');
 const parent={id:1,k:'struct',form:'box',c:[0,0,0],s:[30,20,10]},part={id:2,k:kind,c:[0,5.5,4],d:1},source=plain(part);
 // The previous exterior-direct format: local anchors are metres, not
 // normalized dimensions. It remains a saved compatibility input only.
 part.placement={modelVersion:C.PLACEMENT_MODEL_VERSION,mode:'direct',parentStructureId:1,geometryRevision:1,parentGeometryRevision:0,
  parentLocalAnchor:[0,5.5,4],surfaceAnchor:[0,5,4],contactNormal:[0,1,0],contactLocalNormal:[0,1,0],
  rigidPose:{offset:[0,.5,0],forward:[1,0,0],up:[0,1,0]},requestedGeometry:source};
 ship.parts=[parent,part];ship.fits=[];ship.nextId=3;return C.deserialize(C.serialize(ship));
}
function poseNear(actual,expected){for(let i=0;i<3;i++)assert.ok(Math.abs(actual[i]-expected[i])<1e-7,actual+' vs '+expected);}
for(const kind of ['shield','localShield'])test('legacy '+kind+' keeps its exterior attachment when the parent moves and rotates',()=>{
 const ship=legacyShip(kind),parent=ship.parts[0],part=ship.parts[1],original=C.partVolume(part);
 assert.equal(C.placementCapability(part).space,'interior','new catalogue classification remains interior');
 assert.equal(C.isInternal(part),false,'the old exterior sphere is not implicitly clipped');
 parent.c[0]+=5;let changed=C.updatePlacementChildren(ship,parent.id);assert.equal(changed.ok,true,JSON.stringify(changed));poseNear(part.c,[5,5.5,4]);
 parent.pitch=18;parent.roll=12;parent.yaw=24;changed=C.updatePlacementChildren(ship,parent.id);assert.equal(changed.ok,true,JSON.stringify(changed));
 poseNear(part.c,C.worldStruct(parent,[0,5.5,4]));assert.equal(C.partVolume(part),original);
 const copy=C.deserialize(C.serialize(ship)),saved=copy.parts.find(p=>p.id===2);poseNear(saved.c,part.c);
 assert.equal(saved.placement.parentStructureId,1);assert.equal(saved.placement.hostId,undefined);
 assert.equal(C.placementDiagnostics(copy).find(row=>row.partId===2).connected,true);
 assert.equal(C.placementCapability(saved).space,'interior');
});
test('legacy shield copying remaps references and keeps the compatibility attachment after reload',()=>{
 const ship=legacyShip('shield'),parent=plain(ship.parts[0]),part=plain(ship.parts[1]);parent.id=11;parent.c[0]=50;part.id=12;part.c[0]=50;
 const copy={...ship,parts:[parent,part],fits:[],nextId:13};
 C.remapPlacementCopy(part,new Map([[1,11],[2,12]]),{sourceParts:ship.parts,targetParts:copy.parts,point:p=>[p[0]+50,p[1],p[2]]});
 const restored=C.deserialize(C.serialize(copy)),owner=restored.parts.find(p=>p.id===11),child=restored.parts.find(p=>p.id===12);
 assert.equal(child.placement.parentStructureId,11);owner.c[0]+=3;assert.equal(C.updatePlacementChildren(restored,11).ok,true);poseNear(child.c,[53,5.5,4]);
 assert.equal(C.placementDiagnostics(restored).find(row=>row.partId===12).connected,true);
});
test('new shield requests cannot reuse the old exterior compatibility relationship',()=>{
 const ship=legacyShip('shield'),part={id:-1,k:'shield',c:[5,5.5,4],d:1};
 const result=C.solvePlacement(ship,part,{mode:'direct',parentStructureId:1,hit:{p:[5,5,4],n:[0,1,0]}});
 // User decision 2026-11-11: interior equipment is checked against the ship interior without a named host,
 // so the outside-the-hull request is refused as outside rather than as a missing host.
 assert.equal(result.ok,false);assert.equal(result.code,'fixed-outside');
 assert.equal(C.placementCapability(part).space,'interior');
});
