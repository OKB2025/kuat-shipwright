const fs=require('fs'),path=require('path'),zlib=require('zlib');const root=process.cwd();const {C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const raw=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples/imperial/design.json.gz'))));const b=C.deserialize(raw);C.syncCompartments(b);
console.log('before',b.hatches.map(h=>JSON.stringify({id:h.id,area:C.hatchGrid(b,h).area,openArea:h.openArea})).join(' '));
C.bakeAllCuts(b);console.log('after bake',b.hatches.map(h=>JSON.stringify({id:h.id,owner:h.hullOwner,bay:h.bay,face:h.face,surface:h.surface})).join(' '));
C.syncCompartments(b);console.log('after sync',b.hatches.map(h=>JSON.stringify({id:h.id,owner:h.hullOwner,bay:h.bay,face:h.face,surface:h.surface,area:C.hatchGrid(b,h).area})).join(' '));console.log('own local',JSON.stringify(b.parts.find(p=>p.bakedMesh).hullData.hatches.map(h=>h.id)));
