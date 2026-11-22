// usage: node hatchcmp.cjs <ref> <keys...> — per hatch: surface flag, openArea, hatchGrid area, cut box, contact mode/area; ref design vs working tree, same current core
const zlib=require('zlib'),fs=require('fs'),cp=require('child_process'),path=require('path');const root=process.cwd();const {C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const [ref,...keys]=process.argv.slice(2);const L=b=>C.deserialize(JSON.parse(zlib.gunzipSync(b)));
for(const k of keys){for(const [tag,s] of [['ref',L(cp.execSync(`git show ${ref}:data/examples/${k}/design.json.gz`,{maxBuffer:1e9}))],['now',L(fs.readFileSync(`data/examples/${k}/design.json.gz`))]]){const S=C.computeStats(s);
 const surf=(s.primaryHull?.attachments||s.parts.find(p=>p.k==='hull'&&p.attachments)?.attachments||[]).filter(a=>a.surface&&a.bay);
 console.log(k,tag,'launch',S.launch,'openA',S.openA,'rayA',S.rayA,'surfAtt',surf.length);
 for(const h of s.hatches){const bay=s.parts.find(p=>p.id===h.bay);const c=bay&&C.aviationContact?.(s,bay,h.face);console.log('  ',h.id,h.bay,h.face,'openArea',h.openArea,'grid',C.hatchGrid(s,h).area.toFixed(1),'contact',c?.mode,c?.area?.toFixed?.(1));}}}
