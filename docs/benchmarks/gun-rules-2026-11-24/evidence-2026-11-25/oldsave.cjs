// Saved designs made on main (its data/examples), opened by the candidate's code: node oldsave.cjs <candidateRoot> <mainRoot> key,key
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),zlib=require('node:zlib');
const [root,old,keys]=process.argv.slice(2),cx=vm.createContext({console:{log(){},warn(){},error(){}}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx);
console.log('| main の保存設計 | 読み込み | 再保存の往復 | 砲（給電区画あり／レーザー） | 給電区画の必要容積 m³ | 容積が足りない砲 | 充電に関する警告 | 旧保存の chargeScale／chargeSalvos を持つレーザー |\n|---|---|---|---|---|---|---|---|');
for(const k of keys.split(',')){try{const raw=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(old,'data/examples',k,'design.json.gz'))));
  // an older save may carry charge settings on a gun that is a laser now: add them to the first laser, as the editor could
  const lz=raw.fits.find(f=>C.FITS[f.k]?.gunRule?.kind==='laser');if(lz){lz.chargeScale=2;lz.chargeSalvos=3;}
  const s=C.deserialize(JSON.parse(JSON.stringify(raw)));C.syncCompartments(s);C.remount(s);const S=C.computeStats(s);
  const j1=JSON.stringify(C.serialize(s)),s2=C.deserialize(JSON.parse(j1));C.syncCompartments(s2);C.remount(s2);const j2=JSON.stringify(C.serialize(s2));
  const guns=s.fits.filter(f=>C.FITS[f.k]?.cat==='w'),fed=guns.filter(f=>C.needsCapacitor(f)),ci=Object.values(S.chargeInfo||{}),w=(S.warnings||[]).filter(x=>/充電|給電区画/.test(x.text)).map(x=>x.text.slice(0,60));
  const kept=s.fits.find(f=>f.id===lz?.id);
  console.log(`| ${k} | 可 | ${j1===j2?'一致':'不一致'} | ${fed.length}／${guns.length-fed.length} | ${ci.reduce((n,a)=>n+a.required,0).toFixed(0)} | ${ci.filter(a=>a.ratio<.999).length} | ${w.join(' ／ ')||'なし'} | ${lz?`読める（scale ${kept?.chargeScale}, salvos ${kept?.chargeSalvos}）、充電の記録 ${S.chargeInfo?.[lz.id]?'あり':'なし'}`:'該当なし'} |`);}
 catch(e){console.log(`| ${k} | **失敗** ${String(e).slice(0,120)} | | | | | | |`);}}
