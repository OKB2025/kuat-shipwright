const fs=require('fs'),zlib=require('zlib'),root=process.argv[2],{C}=require(root+'/scripts/update-ship-examples.cjs').loadRuntime(root);
for(const key of process.argv.slice(3)){const raw=JSON.parse(zlib.gunzipSync(fs.readFileSync('/home/user/kuat-shipwright/data/examples/'+key+'/design.json.gz')));const s=C.deserialize(raw.design||raw.ship||raw);const S=C.computeStats(s);
 const bays=s.parts.filter(p=>p.k==='hangar').map(p=>[p.id,C.aviationSurfaceContacts(s,p).filter(q=>q.contact).map(q=>q.face+':'+Math.round(q.area)).join('/')]);
 console.log(key,JSON.stringify({mass:S.mass,accel:S.accel,hatches:s.hatches.length,open:s.hatches.map(h=>+(C.hatchOpenArea(s,h)||0).toFixed(1)),err:s.parts.filter(p=>p._interiorPlacementError).length}),JSON.stringify(bays).slice(0,500));}
