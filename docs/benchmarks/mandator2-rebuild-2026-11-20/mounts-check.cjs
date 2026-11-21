// Seating residuals of the Mandator II battery (measured mount position against the stored fitting) and the pairing of the
// point defence bases. Reads js/core.js (MAN2_MOUNTS) and data/examples/mandator2/design.json.gz; computes no statistics.
// usage: node mounts-check.cjs <output.json>
const fs=require('fs'),zlib=require('zlib'),path=require('path'),root=path.resolve(__dirname,'../../..'),core=fs.readFileSync(root+'/js/core.js','utf8');
const at=core.indexOf('MAN2_MOUNTS=')+12;let i=at,d=0;for(;;i++){if(core[i]==='{')d++;else if(core[i]==='}'&&!--d)break;}const M=JSON.parse(core.slice(at,i+1)),des=JSON.parse(zlib.gunzipSync(fs.readFileSync(root+'/data/examples/mandator2/design.json.gz')));
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]),plan=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]),r=v=>+v.toFixed(2),R={};
const residual=(name,k,targets,filter=()=>true)=>{const fits=des.fits.filter(f=>f.k===k&&filter(f)),rows=[];for(const t of targets){let best=null;for(const f of fits){const e=plan(f.p,t);if(!best||e<best.plan)best={id:f.id,plan:e,dy:f.p[1]-t[1],p:f.p.map(r)};}rows.push({target:t.map(r),fit:best?.id,plan:r(best?.plan??NaN),dy:r(best?.dy??NaN),at:best?.p});}
 const ps=rows.map(x=>x.plan).sort((a,b)=>a-b);R[name]={targets:targets.length,fits:fits.length,planMedian:ps[ps.length>>1],planMax:ps[ps.length-1],dyMin:Math.min(...rows.map(x=>x.dy)),dyMax:Math.max(...rows.map(x=>x.dy)),distinctFits:new Set(rows.map(x=>x.fit)).size,worst:rows.slice().sort((a,b)=>b.plan-a.plan).slice(0,3),rows};};
const both=L=>L.flatMap(p=>Math.abs(p[2])>1?[p,[p[0],p[1],-p[2],...p.slice(3)]]:[p]);
residual('utl dorsal','utl',both(M.utl).map(p=>p.slice(0,3)),f=>f.mountMode!=='bottom');
residual('quad175 dorsal','quad175',both(M.quad175).map(p=>p.slice(0,3)),f=>f.mountMode!=='bottom');
residual('ion ball','ball175QuadIon',both(M.ion).map(p=>p.slice(0,3)));
for(const k of ['utl','quad175'])residual(k+' ventral',k,both(M.ventral.filter(q=>q[0]===k).map(q=>[q[1],q[2],q[3]])),f=>f.mountMode==='bottom');
// point defence: greedy pairing as the builder does it, and the largest pairing possible under the same rule (≤260 m, normals within acos .9)
const B=M.pd,dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],ok=(i,j)=>dot(B[i].slice(3),B[j].slice(3))>=.9&&dist(B[i],B[j])<=260,cand=[];for(let a=0;a<B.length;a++)for(let b=a+1;b<B.length;b++)if(ok(a,b))cand.push([dist(B[a],B[b]),a,b]);cand.sort((x,y)=>x[0]-y[0]||x[1]-y[1]||x[2]-y[2]);
const used=new Set(),pairs=[];for(const [e,a,b] of cand){if(used.has(a)||used.has(b))continue;used.add(a);used.add(b);pairs.push([a,b,r(e)]);}
const left=B.map((b,i)=>i).filter(i=>!used.has(i));
// largest pairing: augmenting search over a small general graph (65 bases), by exhaustive improvement of the greedy result
const adj=B.map((_,a)=>B.map((_,b)=>b).filter(b=>b!==a&&ok(a,b)));let mate=new Array(B.length).fill(-1);for(const [a,b] of pairs){mate[a]=b;mate[b]=a;}
const tryAug=()=>{for(const s of mate.map((m,i)=>m<0?i:-1).filter(i=>i>=0)){const seen=new Set([s]);const dfs=(u)=>{for(const v of adj[u]){if(seen.has(v))continue;seen.add(v);const w=mate[v];if(w<0){mate[u]=v;mate[v]=u;return true;}if(seen.has(w))continue;seen.add(w);if(dfs(w)){mate[u]=v;mate[v]=u;return true;}}return false;};if(dfs(s))return true;}return false;};while(tryAug());
const fits=des.fits.filter(f=>f.k==='pd');
R.pointDefence={bases:B.length,greedyPairs:pairs.length,leftAfterGreedy:left.map(i=>({i,at:B[i].slice(0,3),n:B[i].slice(3),nearest:r(Math.min(...B.map((b,j)=>j===i?Infinity:dist(b,B[i])))),partners:adj[i].length,freePartners:adj[i].filter(j=>!used.has(j)).length})),pairsBySearch:mate.filter(m=>m>=0).length/2,note:'the search is a simple augmenting-path search, a lower bound of the largest pairing',storedFits:fits.length,
 pairsWithoutFit:pairs.map(([a,b,e])=>{const m=[0,1,2].map(x=>(B[a][x]+B[b][x])/2),near=Math.min(...fits.map(f=>plan(f.p,m)));return {a,b,gap:e,mid:m.map(r),nearestFit:r(near)};}).filter(x=>x.nearestFit>30)};
// launchers
R.launchers=des.fits.filter(f=>f.k==='shipMsl').map(f=>({id:f.id,p:f.p.map(r),n:f.n.map(r),cols:f.launcherCols,rows:f.launcherRows,embedded:f.launcherEmbedded}));
fs.writeFileSync(process.argv[2],JSON.stringify(R,null,1));const brief=Object.fromEntries(Object.entries(R).map(([k,v])=>[k,v.rows?{...v,rows:undefined}:v]));console.log(JSON.stringify(brief,null,0));
