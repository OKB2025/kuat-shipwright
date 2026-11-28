// usage: node digest.cjs <root> <key> <out.json> : the figures digest (tests/helpers/figures-digest.cjs of <root>) of an example, built as tests/example-figures-regression.cjs does
const fs=require('fs'),path=require('path'),vm=require('vm');const [root,key,out]=process.argv.slice(2);
const {figuresDigest}=require(path.join(root,'tests/helpers/figures-digest.cjs'));const cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),s=C.buildDesign(key);C.syncCompartments(s);C.remount(s);C.syncCompartments(s);
fs.writeFileSync(out,JSON.stringify(figuresDigest(C.computeStats(s))));
