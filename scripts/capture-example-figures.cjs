#!/usr/bin/env node
// Records the design figures (Core.computeStats) of the example ships as compact digests for
// tests/example-figures-regression.cjs. Run it only when a change is meant to alter the figures.
// usage: node scripts/capture-example-figures.cjs [keys...]   (KS_TEST_ROOT selects another checkout)
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),out=path.join(__dirname,'..','tests','helpers','example-figures.json');
const {figuresDigest}=require('../tests/helpers/figures-digest.cjs'),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const C=vm.runInContext('Core',context),all=[...['venator','imperial','executor'],...Object.keys(C.SHIP_EXAMPLES)];
const keys=process.argv.slice(2).length?process.argv.slice(2):all;
const data=fs.existsSync(out)?JSON.parse(fs.readFileSync(out,'utf8')):{version:1,ships:{}};
for(const key of keys){const t=Date.now(),s=C.buildDesign(key);C.syncCompartments(s);C.remount(s);C.syncCompartments(s);data.ships[key]=figuresDigest(C.computeStats(s));console.log(key,Date.now()-t,'ms');}
data.ships=Object.fromEntries(Object.keys(data.ships).sort().map(k=>[k,data.ships[k]]));
fs.writeFileSync(out,JSON.stringify(data)+'\n');console.log('wrote',out,Object.keys(data.ships).length,'ships');
