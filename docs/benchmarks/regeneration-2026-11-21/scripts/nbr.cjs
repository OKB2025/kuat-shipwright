// usage: node nbr.cjs <key> <id...> — aviation compartments that aviationConnected joins to each id (and whether via reach)
const zlib=require('zlib'),fs=require('fs'),path=require('path');const root=process.cwd();const {C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const [k,...ids]=process.argv.slice(2);const s=C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(`data/examples/${k}/design.json.gz`))));C.computeStats(s);
const av=s.parts.filter(p=>['hangar','dock'].includes(p.k)||p.k==='stow'||/格納|収納|ラック/.test(p.label||''));
for(const id of ids.map(Number)){const a=s.parts.find(p=>p.id===id);console.log(id,a.label,'packed',!!a._packing,'->',av.filter(b=>b!==a&&C.aviationConnected(a,b)).map(b=>b.id+':'+b.k+(b._packing?'(packed)':'')).join(' '));}
