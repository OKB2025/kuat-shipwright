#!/usr/bin/env node
// Radii of the Death Star example's outer surface along given directions, for the comparison with the source STL
// (scripts/stl-check/deathstar_compare.py). Reads data/examples/deathstar/design.json.gz.
//   node scripts/stl-check/deathstar_rays.cjs ROOT DIRS.json OUT.json
// DIRS.json (written by deathstar_compare.py dirs): {sets:{name:[[label..., [dx,dy,dz]], ...]}} in the station frame:
// centre (R, R, 0), y the polar axis, the dish axis in the x-y plane 27 degrees above +x. Each row comes back with
// the radius of the first surface met from outside appended (structures as carved, and the superlaser's body).
const fs=require('fs'),zlib=require('zlib'),path=require('path'),root=path.resolve(process.argv[2]),dirs=JSON.parse(fs.readFileSync(process.argv[3],'utf8')),out=path.resolve(process.argv[4]);
const {C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const s=C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples/deathstar/design.json.gz'))).toString('utf8')));C.syncCompartments(s);
const R=80000,C0=[R,R,0],rad=Math.PI/180,T=[];
for(const p of s.parts){if(p.k==='struct'){p._solidCutShip=s;T.push(C.structTriangles(p));}else if(p.k==='slaser')T.push(C.superweaponBodyTriangles(p));}
const radius=d=>{const o=C0.map((c,i)=>c+d[i]*(R+5000)),back=d.map(v=>-v);let best=null;for(const t of T){const h=C.rayTris(t,o,back);if(h&&(!best||h.t<best.t))best=h;}return best?R+5000-best.t:null;};
const sets={};for(const [name,rows] of Object.entries(dirs.sets))sets[name]=rows.map(r=>[...r,radius(r[r.length-1])]);
fs.writeFileSync(out,JSON.stringify({R,triangles:T.map(t=>t.length/9),sets}));
console.log('wrote',out,'triangles',T.map(t=>t.length/9).join('+'));
