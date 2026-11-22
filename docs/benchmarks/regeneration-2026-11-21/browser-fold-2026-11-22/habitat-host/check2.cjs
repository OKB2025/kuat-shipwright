// Same as check.cjs, on the stored MC30c with a structure and a weapon that name an added habitation compartment as parent/host.
const fs=require('fs'),path=require('path'),zlib=require('zlib'),root=process.argv[2],{C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root),out={};
const j=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples/mc30c/design.json.gz'))));
const s0=C.deserialize(JSON.parse(JSON.stringify(j)));const S0=C.computeStats(s0);
const maxId=Math.max(...j.parts.map(p=>p.id),...(j.fits||[]).map(f=>f.id));const hid=maxId+1;
const st=j.parts.find(p=>C.isHullStructure?.(p))||j.parts[0];
j.parts.push({id:hid,k:'habitat',c:st.c.slice(),room:[6,6,6]});
j.parts.push({...JSON.parse(JSON.stringify(st)),id:hid+1,parentId:hid,parentStructureId:hid});
const f0=j.fits.find(f=>!f.float);j.fits.push({...JSON.parse(JSON.stringify(f0)),id:hid+2,host:hid,hostId:hid});
let err=null;try{const t=C.deserialize(JSON.parse(JSON.stringify(j)));out.retired=t.retiredHabitats;out.habitats=t.parts.filter(p=>p.k==='habitat').length;
 const child=t.parts.find(p=>p.id===hid+1),fit=t.fits.find(f=>f.id===hid+2);out.child=child?{parentId:child.parentId??null,parentStructureId:child.parentStructureId??null}:'dropped';out.fit=fit?{host:fit.host??null,hostId:fit.hostId??null}:'dropped';
 const S=C.computeStats(t);out.mass=[S0.mass,S.mass];out.newWarnings=(S.warnings||[]).map(w=>String(w.text||w)).filter(w=>!(S0.warnings||[]).map(x=>String(x.text||x)).includes(w));
 const back=JSON.parse(JSON.stringify(C.serialize(t)));const bc=back.parts.find(p=>p.id===hid+1),bf=back.fits.find(f=>f.id===hid+2);out.saved={child:bc?{parentId:bc.parentId??null,parentStructureId:bc.parentStructureId??null}:'dropped',fit:bf?{host:bf.host??null,hostId:bf.hostId??null}:'dropped',anyHabitatRef:JSON.stringify(back).includes(`"host":${hid}`)||JSON.stringify(back).includes(`"parentId":${hid}`)};
 out.secondRound=JSON.stringify(C.serialize(C.deserialize(JSON.parse(JSON.stringify(back)))))===JSON.stringify(back);
}catch(e){err=String(e.stack||e).slice(0,800);}out.error=err;console.log(JSON.stringify(out,null,1));
