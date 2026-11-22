// Hangar connectivity of every stored example under one checkout's core: Vhang, Vacc, launch, openA, compartments without access,
// unconnected-compartment warning. usage: node conn.cjs <checkout root for core> <repo root for designs> <out.json>
const zlib=require('zlib'),fs=require('fs'),path=require('path');const [core,repo,out]=process.argv.slice(2);
const {C}=require(path.join(core,'scripts/update-ship-examples.cjs')).loadRuntime(core);const res={};
const keys=fs.readdirSync(path.join(repo,'data/examples')).filter(k=>fs.existsSync(path.join(repo,'data/examples',k,'design.json.gz'))).sort();
for(const k of keys){const raw=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(repo,'data/examples',k,'design.json.gz'))));if(!(raw.parts||[]).some(p=>['hangar','dock'].includes(p.k)))continue;
 const t=Date.now(),s=C.deserialize(raw),S=C.computeStats(s);const hang=s.parts.filter(p=>p.k==='hangar');
 res[k]={Vhang:S.Vhang,Vacc:S.Vacc,launch:S.launch,openA:S.openA,noAccess:hang.filter(p=>!S.info[p.id]?.acc).map(p=>p.id),warnUnconnected:(S.warnings||[]).some(w=>String(w.text||w).includes('ハッチに通じていない')),sec:(Date.now()-t)/1000};
 console.log(k,JSON.stringify(res[k]));fs.writeFileSync(out,JSON.stringify(res,null,1));}
