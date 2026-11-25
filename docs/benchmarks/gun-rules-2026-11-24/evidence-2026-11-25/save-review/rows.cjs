const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=process.argv[2],cx=vm.createContext({console:{log(){},warn(){},error(){}}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),F=vm.runInContext('YardFleetData',cx),key=C.profileModelKey();
let ok=0,bad=[],noInputK=[];for(const [k,r] of Object.entries(F.designs)){if(r.model?.modelKey===key)ok++;else bad.push(k+':'+(r.model?.modelKey||'none').slice(0,40));const ms=r.p?.surface?.mounts||[];if(ms.length&&ms.some(m=>!(m.inputK>0)))noInputK.push(k);if(r.p?.profileVersion!==C.FLEET_PROFILE_VERSION)bad.push(k+' pv '+r.p?.profileVersion);}
console.log('modelKey',key.slice(0,60),'rows matching',ok,'of',Object.keys(F.designs).length,'mismatch',JSON.stringify(bad),'rows with mounts lacking inputK',JSON.stringify(noInputK));
console.log('surface rows',Object.entries(F.designs).filter(([k,r])=>r.model?.surface).map(([k])=>k).join(','));
