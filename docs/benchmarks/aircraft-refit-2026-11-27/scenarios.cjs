// The user's mission-loading scenarios (任務装填/*.json): read as the game reads a scenario file, then each craft row's load as the game
// keeps it (normalizeLoad against the craft design's stations), against what the user's scenario asked for. read-only.
// usage: node scenarios.cjs <root>
const fs=require('fs'),path=require('path');const root=path.resolve(process.argv[2]),{C,R}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const dir=path.join(root,'docs/handoff-2026-11-20/refs/aircraft-refit-2026-11-27/任務装填');
for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.json'))){const raw=JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));let sc;try{sc=R.scenarioFromJSON(JSON.stringify(raw));}catch(e){console.log(f,'| scenarioFromJSON ERROR',String(e.message).slice(0,200));continue;}
 console.log('== '+f+' | read: '+(sc?'yes':'no')+' | '+raw.name);
 const rows=(raw.sides||[]).flatMap(s=>s.fleet?.ctgs||[]).flatMap(c=>c.tgs||[]).flatMap(t=>t.ships||[]).flatMap(sh=>(sh.air||[]).map(a=>({ship:sh.name,...a})));
 const kept=(sc?.sides||[]).flatMap(s=>s.fleet?.ctgs||[]).flatMap(c=>c.tgs||[]).flatMap(t=>t.ships||[]).flatMap(sh=>sh.air||[]);
 rows.forEach((a,i)=>{const bp=a.design?.blueprint;let st=null,load=null;try{const s=C.deserialize(JSON.parse(JSON.stringify(bp)));C.remount(s,{keepFitPose:true});C.syncCompartments(s);st=C.craftStations(s);load=C.normalizeLoad(st,a.load);}catch(e){load='ERROR '+String(e.message).slice(0,80);}
  const sum=l=>Array.isArray(l)?l.map(x=>x.k+'×'+x.n).join(' '):String(l),asked=sum(a.load),got=sum(load),k=sum(kept[i]?.load);
  console.log('  '+(a.design?.name||a.name)+' | asked '+asked+' | kept by the scenario reader '+k+' | held to the stations '+got+(asked===got?'':'  <<< differs'));});}
