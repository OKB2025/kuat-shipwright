const fs=require('fs'),path=require('path'),vm=require('vm');const root=process.argv[2];
const cx=vm.createContext({console,performance:{now:()=>0}});for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx);
for(const k of process.argv.slice(3)){const t=Date.now(),s=C.buildDesign(k);const st=s.parts.filter(p=>/接続支柱/.test(p.label||''));console.log(k,'struts',st.length,st.map(p=>p.label.replace('の接続支柱','')+'#'+p.id).join(', '),'parts',s.parts.length,(Date.now()-t)+'ms');}
