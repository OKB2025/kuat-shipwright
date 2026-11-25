// full fleet profiles from the saved designs, the way the game makes them: node saved.cjs <root> <outdir> key,key
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),zlib=require('node:zlib');
const root=process.argv[2],out=process.argv[3],keys=process.argv[4].split(','),cx=vm.createContext({console:{log(){},warn(){},error(){}}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx);fs.mkdirSync(out,{recursive:true});
for(const k of keys){const o=path.join(out,'profile-'+k+'.json');if(fs.existsSync(o))continue;const t0=Date.now(),s=C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples',k,'design.json.gz')))));C.syncCompartments(s);C.remount(s);const S=C.computeStats(s),p=C.fleetProfile(S,s.name,s);fs.writeFileSync(o,JSON.stringify(p));
 console.log(k,Math.round((Date.now()-t0)/1000)+'s','gunBest',p.gunBest,'mounts',p.surface?.mounts?.length,'weaponCharge',p.weaponCharge,'feed short',Object.values(S.chargeInfo||{}).filter(a=>a.ratio<.999).length+'/'+Object.keys(S.chargeInfo||{}).length);}
