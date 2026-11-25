// Read-only round trips of the new saved fields (candidate code).
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),zlib=require('node:zlib');
const root=process.argv[2],cx=vm.createContext({console:{log(){},warn(){},error(){}}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),L=k=>JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples',k,'design.json.gz'))));
const rt=o=>C.serialize(C.deserialize(JSON.parse(JSON.stringify(o))));
// 1 aircraft laser fields
{const raw=L('craft_xwing');const s=C.deserialize(raw);const f=s.fits.find(f=>f.k==='claser');f.boreM=.33;f.barrelM=4.2;f.rateHz=2.5;
 const g=s.fits.find(f=>f.k==='claser'&&f.id!==s.fits.find(q=>q.k==='claser').id);if(g){g.boreM=.05;g.barrelM=40;g.rateHz=0.01;}
 const o1=C.serialize(s),q1=o1.fits.find(q=>q.id===f.id),o2=rt(o1),q2=o2.fits.find(q=>q.id===f.id),g2=g&&o2.fits.find(q=>q.id===g.id);
 console.log('claser saved',JSON.stringify([q1.boreM,q1.barrelM,q1.rateHz]),'after round trip',JSON.stringify([q2.boreM,q2.barrelM,q2.rateHz]),'out-of-range saved',g&&JSON.stringify([o1.fits.find(q=>q.id===g.id).boreM,o1.fits.find(q=>q.id===g.id).barrelM,o1.fits.find(q=>q.id===g.id).rateHz]),'reloaded',g2&&JSON.stringify([g2.boreM,g2.barrelM,g2.rateHz]));
 const s2=C.deserialize(JSON.parse(JSON.stringify(o2)));const r1=C.craftLaserRule(f),r2=C.craftLaserRule(s2.fits.find(q=>q.id===f.id));console.log('rule equal',JSON.stringify(r1)===JSON.stringify(r2),JSON.stringify(r2));
 console.log('example laser fields stored in candidate x-wing',JSON.stringify(raw.fits.filter(q=>q.k==='claser').map(q=>[q.id,q.boreM,q.barrelM,q.rateHz])));
 // cturret too
 const t=L('craft_vwing');const st=C.deserialize(t);const tf=st.fits.find(q=>q.k==='cturret');if(tf){tf.boreM=.25;const o=rt(C.serialize(st));console.log('cturret boreM after round trip',o.fits.find(q=>q.id===tf.id).boreM);}
 // mirror pair field: the stored JSON equal after two round trips
 console.log('x-wing serialize stable',JSON.stringify(o2)===JSON.stringify(rt(o2)));}
// 2 face armour
{const raw=L('hammerhead');const s=C.deserialize(raw);const faces=C.structureArmorFaces(s,1);const top=faces.filter(q=>q.face==='top');
 const before=new Map(s.surfaces.patches.map(p=>[p.id,C.surfaceArmor?C.surfaceArmor(p).thickness:p.armor?.thickness]));
 const r=C.setStructureFaceArmor(s,1,'top',1.3,q=>q.center[0]<30);console.log('set top armour',r.ok,r.ids?.length,r.why||'');
 const o1=C.serialize(s),o2=rt(o1);const m1=new Map(o1.surfaces.patches.map(p=>[p.id,JSON.stringify(p)])),m2=new Map(o2.surfaces.patches.map(p=>[p.id,JSON.stringify(p)]));
 let same=0,diff=0,lost=0;for(const [id,v] of m1){if(!m2.has(id))lost++;else if(m2.get(id)===v)same++;else diff++;}console.log('hammerhead patches saved',m1.size,'after round trip same',same,'changed',diff,'lost',lost,'new',[...m2.keys()].filter(k=>!m1.has(k)).length);
 const s3=C.deserialize(JSON.parse(JSON.stringify(o2)));const f3=C.structureArmorFaces(s3,1).filter(q=>r.ids.includes(q.id));console.log('reloaded thickness of set faces',[...new Set(f3.map(q=>q.thickness))].join(','),'count',f3.length);
 const raw2=L('hammerhead');console.log('example hammerhead stable after round trip',JSON.stringify(rt(raw2).surfaces)===JSON.stringify(rt(rt(raw2)).surfaces));}
// 3 GR-75
{const G=vm.runInContext('typeof GR75_REMODEL==="object"?GR75_REMODEL:null',cx);const ex=L('gr75');
 const a=rt(G),b=rt(a);console.log('GR75_REMODEL round trip stable',JSON.stringify(a)===JSON.stringify(b),'parts',G.parts.length,'->',a.parts.length,'fits',G.fits.length,'->',a.fits.length);
 const ids=o=>JSON.stringify([o.parts.map(p=>[p.id,p.k]).sort(),o.fits.map(f=>[f.id,f.k]).sort()]);console.log('example gr75 vs GR75_REMODEL same part ids/kinds',ids(ex)===ids(G),'example reference',ex.reference,'remodel reference',G.reference);
 const dang=G.parts.filter(p=>p.reactor!=null&&p.reactor!==0&&!G.parts.some(q=>q.id===p.reactor));console.log('GR75_REMODEL dangling reactor refs',JSON.stringify(dang.map(p=>[p.id,p.k,p.reactor])));
 const exd=ex.parts.filter(p=>p.reactor!=null&&p.reactor!==0&&!ex.parts.some(q=>q.id===p.reactor));console.log('example gr75 dangling reactor refs (as saved)',JSON.stringify(exd.map(p=>[p.id,p.k,p.reactor])));
 const s=C.deserialize(JSON.parse(JSON.stringify(ex)));const before=JSON.stringify(s.parts.map(p=>p.reactor));C.syncCompartments(s);C.remount(s);C.computeStats(s);const after=JSON.stringify(s.parts.map(p=>p.reactor));console.log('reactor fields unchanged by stats',before===after,'serialized keeps dangling',JSON.stringify(C.serialize(s).parts.filter(p=>exd.some(q=>q.id===p.id)).map(p=>[p.id,p.reactor])));
 for(const p of s.parts.filter(p=>exd.some(q=>q.id===p.id)))console.log(' engine',p.id,'fed by',C.reactorFor(s,p)?.id);}
