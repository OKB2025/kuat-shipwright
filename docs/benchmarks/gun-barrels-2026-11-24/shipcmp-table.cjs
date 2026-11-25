const a=require(process.argv[2]),b=require(process.argv[3]),keys=Object.keys(b).sort(),f=v=>v==null?'—':String(v),box=q=>q.gunBox?q.gunBox[0].join(', ')+' ／ '+q.gunBox[1].join(', '):'—';
const rows=[],notes=[];
for(const k of keys){const x=a[k],y=b[k];if(!x||x.error||y.error){rows.push(`| ${k} | ${x?.error||y.error||'main に無い'} |`);continue;}
 const kinds=JSON.stringify(x.kinds)===JSON.stringify(y.kinds)?'同じ':'変化',wOld=new Set(x.warnings),wNew=y.warnings.filter(w=>!wOld.has(w)),wGone=x.warnings.filter(w=>!new Set(y.warnings).has(w));
 rows.push(`| ${k} | ${x.parts}→${y.parts} | ${x.fits}→${y.fits} | ${f(x.interference)}→${f(y.interference)} | ${f(x.loose)}→${f(y.loose)} | ${f(x.looseFits)}→${f(y.looseFits)} | ${(y.mass/x.mass).toFixed(4)} | ${x.feed.n}→${y.feed.n} | ${x.feed.required}→${y.feed.required} | ${y.feed.short} | ${JSON.stringify(x.gunBox)===JSON.stringify(y.gunBox)?'同じ':'変化'} | ${wNew.length}／${wGone.length} |`);
 if(JSON.stringify(x.gunBox)!==JSON.stringify(y.gunBox))notes.push(`- ${k} 砲の外形：${box(x)} → ${box(y)}`);
 for(const w of wNew)notes.push(`- ${k} 新しい警告：${w}`);for(const w of wGone)notes.push(`- ${k} 消えた警告：${w}`);}
console.log('| 作例 | 部品 | 装備 | 干渉 | 浮き（構造物） | 浮き（装備） | 質量比 | 給電区画を持つ砲 | 給電区画の必要容積 m³ | 容積が足りない砲 | 砲の外形の箱 | 警告 増／減 |\n|---|---|---|---|---|---|---|---|---|---|---|---|');console.log(rows.join('\n'));console.log('\n'+notes.join('\n'));
