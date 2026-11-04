#!/usr/bin/env node
// Export the native example through the same builder and save format as the game.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),output=path.resolve(process.argv[2]||'/tmp/arquitens-native'),cx=vm.createContext({console,performance});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const {C,R,D}=vm.runInContext('({C:Core,R:Rts,D:YardFleetData.designs})',cx);
const begin=performance.now(),ship=C.buildDesign('arquitens'),built=performance.now(),stats=C.computeStats(ship),computed=performance.now(),profile=C.fleetProfile(stats,ship.name,ship),blueprint=C.serialize(ship);
const structures=ship.parts.filter(p=>p.k==='struct');
assert.ok(structures.length>1,'the example must have independent editable structural parts');
assert.ok(structures.every(p=>!['reference','mesh'].includes(p.form)&&!p.skinAsset&&!p.mesh),'the example must use native parameterized structures');
assert.equal(C.REFERENCE_ASSETS.arq_hull,undefined,'the unused imported whole hull must not be loaded');
const record={...D.arquitens,name:ship.name,p:profile,info:R.designInfo(stats,profile),paint:ship.paint};
const report={schemaVersion:1,representation:'native-parametric-parts',sourceSha256:Object.fromEntries(['js/core.js','data/reference.js','data/imperial2.js'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')])),buildMs:built-begin,statsMs:computed-built,mass:stats.mass,cost:stats.cost,accel:stats.accelG,profileVersion:profile.profileVersion,structureCount:structures.length,structureForms:[...new Set(structures.map(p=>p.form))],structureLayout:structures.map(p=>({id:p.id,label:p.label,form:p.form,center:p.c,size:p.s,loft:p.loft,outline:p.outline,mirror:p.tw})),weapons:ship.fits.map(f=>({id:f.id,kind:f.k,position:f.p,axis:f.a,float:f.float})),engines:profile.propulsion.engines};
fs.mkdirSync(output,{recursive:true});
for(const [name,value]of [['arquitens-native.blueprint.json',blueprint],['fleet-record.json',record],['build-report.json',report]])fs.writeFileSync(path.join(output,name),JSON.stringify(value,null,2)+'\n');
console.log(JSON.stringify({output,structures:structures.length,forms:report.structureForms,mass:stats.mass,cost:stats.cost,buildMs:report.buildMs,statsMs:report.statsMs}));
