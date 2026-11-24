// The gun table as the game computes it (Core.FITS[k].gunRule). usage: node table.cjs <repo> > table.md
const path=require('path');const {C}=require(path.join(process.argv[2],'scripts/update-ship-examples.cjs')).loadRuntime(process.argv[2]);
const f=x=>x>=1e3?(+(x/1e3).toPrecision(3))+' PT':x>=1?(+x.toPrecision(3))+' TT':x>=1e-3?(+(x*1e3).toPrecision(3))+' GT':x>=1e-6?(+(x*1e6).toPrecision(3))+' MT':(+(x*1e9).toPrecision(3))+' kt',km=m=>(m/1e3).toFixed(1)+' km',sec=x=>x>=10?x.toFixed(0)+' s':x.toFixed(2)+' s';
const rows=Object.entries(C.FITS).filter(([,d])=>d.gunRule).map(([k,d])=>({k,d,r:d.gunRule})).sort((a,b)=>(b.d.boltTT||0)-(a.d.boltTT||0));
const kinds={laser:'レーザー',turbolaser:'ターボレーザー',ion:'イオン砲'};
console.log('| 砲 | 種類 | 門 | 1 発 | 口径 | 砲身 | 最低コイル | 100% 距離 | 射程 | 1 門の間隔 | 一斉射の間隔 | 火力/秒 | 前の火力/秒 | 発射熱（入力の割合） |');
console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for(const {k,d,r} of rows){const L=d.gunLegacy,per=r.perBarrel?r.perBarrel.map(b=>f(b.kt/1e9)).filter((v,i,a)=>a.indexOf(v)===i).join('／'):f(d.boltTT);
 console.log(`| ${d.short||d.name}（${k}） | ${kinds[r.kind]} | ${d.barrels} | ${per} | ${r.perBarrel?r.perBarrel.map(b=>b.bore.toFixed(3)).filter((v,i,a)=>a.indexOf(v)===i).join('／'):r.boreM.toFixed(2)} m | ${r.perBarrel?r.perBarrel.map(b=>b.length.toFixed(1)).filter((v,i,a)=>a.indexOf(v)===i).join('／'):r.barrelM.toFixed(1)} m | ${r.leastCoilM!=null?r.leastCoilM.toFixed(1)+' m':'—'} | ${r.holdM>0?km(r.holdM):'—'} | ${km(r.rangeM)} | ${sec(r.intervalS)} | ${sec(d.cycle)} | ${f((d.tt||d.ion)/d.cycle)} | ${f((L.tt||L.ion)/L.cycle)} | ${r.heatFrac!=null?(r.heatFrac*100).toFixed(2)+'%':'5%（従来）'} |`);}
