#!/usr/bin/env node
// A section of the Death Star example through its poles and the dish axis (the plane z = 60 m, just off the
// hemispheres' vertex meridian), for the comparison with the user's cutaway drawing.
//   node scripts/stl-check/deathstar_section.cjs ROOT OUT.json [STEP_M]
// Each cell of the grid is given by Core's own containment tests: Core.inPart for every part (structures,
// the reactor, the silos, the superlaser's body, the other equipment) and Core.solidCutsContain for the ship-level
// cuts that carve structures. Codes: 0 space, 1 structure, 2 structure removed by a cut, 3 superlaser, 4 reactor,
// 5 reactant silo, 6 other equipment. KS_NO_LASER=1 leaves the superlaser out (the hole it leaves).
const fs=require('fs'),zlib=require('zlib'),path=require('path'),root=path.resolve(process.argv[2]),out=path.resolve(process.argv[3]),step=+process.argv[4]||400;
const {C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const s=C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples/deathstar/design.json.gz'))).toString('utf8')));C.syncCompartments(s);
if(process.env.KS_NO_LASER==='1')s.parts=s.parts.filter(p=>p.k!=='slaser');
const structs=s.parts.filter(p=>p.k==='struct'),laser=s.parts.filter(p=>p.k==='slaser'),gen=s.parts.filter(p=>p.k==='gen'),fuel=s.parts.filter(p=>p.k==='fuel'),other=s.parts.filter(p=>!['struct','slaser','gen','fuel'].includes(p.k));
const any=(list,q)=>list.some(p=>{try{return C.inPart(p,q);}catch(e){return false;}}),n=Math.floor(160000/step)+1,rows=[];
for(let j=0;j<n;j++){let row='';const y=160000-j*step;for(let i=0;i<n;i++){const q=[i*step,y,60];
 let c=0;if(any(laser,q))c=3;else if(any(gen,q))c=4;else if(any(fuel,q))c=5;else if(any(other,q))c=6;else if(any(structs,q))c=C.solidCutsContain(s,q,true)?2:1;row+=c;}rows.push(row);}
fs.writeFileSync(out,JSON.stringify({step,n,rows,parts:{structures:structs.length,superlaser:laser.length,reactor:gen.length,silos:fuel.length,other:other.length}}));
const count=c=>rows.reduce((a,r)=>a+r.split(String(c)).length-1,0);console.log('wrote',out,'cells',n*n,'structure',count(1),'cut',count(2),'superlaser',count(3),'reactor',count(4),'silo',count(5),'other',count(6));
