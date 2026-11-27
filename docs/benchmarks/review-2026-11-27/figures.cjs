// Figures the reviews of 2026-11-27 asked for: the X-wing's mass with the nozzle part against its twelve structures, the B-wing's guns that
// carry the nozzle in the user's own design, and the TIE Avenger's power and heat at the rates asked for against all guns at 4 a second.
// usage: node figures.cjs <root>   (prints a report; the caller saves it)
const path=require('path'),fs=require('fs'),root=path.resolve(process.argv[2]||'.'),{C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const raw=f=>C.deserialize(JSON.parse(fs.readFileSync(path.join(root,'docs/handoff-2026-11-20/refs',f),'utf8'))),n=(x,d=4)=>Number.isFinite(x)?+x.toFixed(d):x;
const row=(label,S)=>console.log(label.padEnd(40),'mass',n(S.mass,5),'t | cost',Math.round(S.cost),'| power',n(S.power,6),'| heat',JSON.stringify(S.heat&&typeof S.heat==='object'?Object.fromEntries(Object.entries(S.heat).filter(([k,v])=>typeof v==='number').slice(0,6).map(([k,v])=>[k,n(v,6)])):S.heat),'| bad/warn',S.warnings.filter(w=>w.lv==='bad'||w.lv==='warn').length);
const nozzles=s=>s.fits.filter(f=>f.nozzle==='track').map(f=>({id:f.id,bore:f.boreM,mass:n(C.trackNozzleMass(f.boreM),7),cost:Math.round(C.trackNozzleCost(f.boreM))}));
console.log('== X-wing');const xr=raw('xwing-refit-2026-11-27.json'),xe=C.buildDesign('craft_xwing'),XR=C.computeStats(xr),XE=C.computeStats(xe),xn=nozzles(xe),xm=xn.reduce((a,q)=>a+q.mass,0);
row('user design (12 structures, + nozzle part)',XR);row('example (nozzle part, no structures)',XE);console.log('nozzles',JSON.stringify(xn),'total',n(xm,7));
console.log('user design less the nozzle parts (the user table figure)',n(XR.mass-xm,5),'| example - that',n(XE.mass-(XR.mass-xm),6),'t');
const sm=s=>{const r=C.structuralMaterial(s);return {extension:n(r.extension,6),entries:r.entries.length};};console.log('structural material: user design',JSON.stringify(sm(xr)),'example',JSON.stringify(sm(xe)));
console.log('== B-wing');const be=C.buildDesign('craft_bwing'),BE=C.computeStats(be),bn=nozzles(be);row('example',BE);console.log('nozzles',JSON.stringify(bn),'total mass',n(bn.reduce((a,q)=>a+q.mass,0),7),'cost',bn.reduce((a,q)=>a+q.cost,0),'| user table 17.302 t, 167446');
console.log('== TIE Avenger');const ae=C.buildDesign('craft_tie_avenger'),AE=C.computeStats(ae),a4=C.buildDesign('craft_tie_avenger');for(const f of a4.fits)if(f.k==='claser')f.rateHz=4;const A4=C.computeStats(a4);
const rates=s=>{const c={};for(const f of s.fits)if(f.k==='claser')c[f.rateHz]=(c[f.rateHz]||0)+1;return JSON.stringify(c);};row('example '+rates(ae),AE);row('all lasers at 4 a second '+rates(a4),A4);
for(const S of [AE,A4])console.log(' alpha',n(S.alpha,6),'alphaTot',n(S.alphaTot,6),'weaponBudget',n(S.weaponBudget,6),'autoPower',n(S.autoPower,6),'warnings:',S.warnings.filter(w=>w.lv==='bad'||w.lv==='warn').map(w=>w.text).join(' / ').slice(0,300));
