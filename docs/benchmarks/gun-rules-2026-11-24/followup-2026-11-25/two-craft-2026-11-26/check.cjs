// The user's B-wing and droid tri-fighter (2026-11-26): build each example and compare with the design's own verifiedModel figures. read-only.
const fs=require('fs'),vm=require('vm'),path=require('path');const root=process.argv[2];const cx=vm.createContext({console:{log(){},warn(){},error(){}}});for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx);const C=vm.runInContext('Core',cx);
for(const [key,file] of [['craft_bwing','bwing-2026-11-26.json'],['craft_tri','tri-fighter-2026-11-26.json']]){const src=JSON.parse(fs.readFileSync(path.join(root,'docs/handoff-2026-11-20/refs',file),'utf8')),V=src.credits.verifiedModel;
 try{const t0=Date.now(),ship=C.buildDesign(key),S=C.computeStats(ship),ex=C.SHIP_EXAMPLES[key];
 console.log('## '+key+' — '+ship.name+' ('+((Date.now()-t0)/1000).toFixed(0)+' s)');
 console.log('example: '+JSON.stringify({name:ex.name,side:ex.side,role:ex.role,craftType:ex.craftType,length:ex.length,source:ex.source}));
 console.log('mass t: '+(S.mass??0).toFixed(4)+' (design file: '+V.massT+')');
 console.log('acceleration G: '+((S.propulsion?.ratedAccelMps2??0)/C.G0).toFixed(0)+' (design file: '+V.accelerationG+')');
 console.log('cost: '+Math.round(S.cost??S.price??0)+' (design file: '+V.costCredits+')');
 console.log('size m: '+JSON.stringify([S.len,S.width,S.height].map(v=>v==null?null:+v.toFixed(2)))+' parts '+ship.parts.length+' (file '+src.parts.length+') fits '+ship.fits.length+' (file '+src.fits.length+')');
 for(const f of ship.fits){const o=src.fits.find(x=>x.id===f.id);if(C.CRAFT_LASER_GEOMETRY[f.k]){const g=C.craftLaserRule(f);console.log('  laser '+f.id+' '+f.k+' file bore '+o?.boreM+' m → bore '+g.boreM.toFixed(4)+' m, '+(C.craftLaserKt(g.boreM)).toFixed(1)+' kt, barrel '+g.barrelM+' m, '+g.rateHz+' /s — '+(o?.label||''));}else console.log('  '+f.k+' '+f.id+' (file '+(o?.k||'—')+') '+(o?.label||''));}
 console.log('ordnance: '+JSON.stringify(C.craftOrdnance(ship).map(o=>o.kind+'x'+o.n))+'; strike '+JSON.stringify(C.missionOrdnance(ship,'strike').map(o=>o.kind+'x'+o.n))+'; air '+JSON.stringify(C.missionOrdnance(ship,'air').map(o=>o.kind+'x'+o.n)));
 const W=(S.warnings||[]);console.log('warnings '+W.length+': '+W.map(w=>typeof w==='string'?w:(w.level||w.t||'')+':'+(w.text||w.msg||w.m||JSON.stringify(w))).join(' / ').slice(0,900));
 }catch(e){console.log('## '+key+' ERROR '+(e.stack||e.message).slice(0,600));}}
