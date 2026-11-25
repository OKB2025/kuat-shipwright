// Axial radius profile of a gun model's first barrel, as drawn (after Core's reshaping), and the seen barrel over the ball's diameter.
// usage: node prof.cjs <root> <assetId,assetId,...>   (prints markdown)
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(process.argv[2]),ids=process.argv[3].split(','),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),A=C.REFERENCE_ASSETS,dec=C.decodeReference,FITS=C.FITS;
const fitOf=id=>Object.entries(FITS).find(([k,d])=>d&&d.asset===id)?.[0];
for(const id of ids){const a=A[id];if(!a){console.log('## '+id+': no such asset');continue;}const d=dec(id),b=a.barrelCenters?.[0];if(!b){console.log('## '+id+': no barrel record');continue;}
 const X=v=>a.c[0]+d.pos[v*3]*a.size[0],R=v=>Math.hypot(a.c[1]+d.pos[v*3+1]*a.size[1]-b.root[1],a.c[2]+d.pos[v*3+2]*a.size[2]-b.root[2]);
 const rings=new Map();for(let v=b.firstVertex;v<b.firstVertex+b.vertices;v++){const x=Math.round(X(v)*1000)/1000,r=R(v),q=rings.get(x)||{n:0,max:0,min:Infinity};q.n++;q.max=Math.max(q.max,r);q.min=Math.min(q.min,r);rings.set(x,q);}
 const xs=[...rings.keys()].sort((p,q)=>p-q),fk=fitOf(id),fit=fk?FITS[fk]:null,exit=a.sphereRadiusM>0&&Array.isArray(a.sphereCenterM)?a.sphereCenterM[0]+a.sphereRadiusM:null,front=b._sourceFront??b.exposedStartX??b.root[0];
 console.log(`## ${id}${fk?' (FITS.'+fk+')':''}`);
 console.log(`- model box size (m): ${a.size.map(v=>v.toFixed(3)).join(' x ')}; barrel vertices ${b.vertices}; radius scale ${a.barrelRadiusScale??1}; exposed scale ${(a.barrelExposedScale??1).toFixed(4)}`);
 console.log(`- exposedStartX ${front.toFixed(3)} m; muzzle x ${b.muzzle[0].toFixed(3)} m; outer radius ${b.outerRadiusM?.toFixed(4)??'-'} m; bore radius ${b.boreRadiusM?.toFixed(4)??'-'} m${b.taperEndXM!=null?`; taper ${b.taperStartXM?.toFixed(3)}..${b.taperEndXM.toFixed(3)} m`:''}`);
 if(exit!=null)console.log(`- ball: centre x ${a.sphereCenterM[0].toFixed(3)} m, radius ${a.sphereRadiusM.toFixed(3)} m, outline at x ${exit.toFixed(3)} m; fit width wm ${fit?.wm} m; seen barrel (outline to muzzle) ${(b.muzzle[0]-exit).toFixed(3)} m = ${((b.muzzle[0]-exit)/(fit?.wm||NaN)).toFixed(4)} x wm = ${((b.muzzle[0]-exit)/(2*a.sphereRadiusM)).toFixed(4)} x ball diameter`);
 console.log('\n| x (m) | vertices | outer radius (m) | inner radius (m) |\n|---|---|---|---|');
 for(const x of xs){const q=rings.get(x);console.log(`| ${x.toFixed(3)} | ${q.n} | ${q.max.toFixed(4)} | ${q.min.toFixed(4)} |`);}
 console.log('');}
