// Every numeric field of every stored example row (data/fleet.js) of two checkouts, not only the six columns of compare.cjs
// (physics review 2026-11-21). Usage: node compare-all.cjs <base fleet.js> <new fleet.js>
const vm=require('vm'),fs=require('fs');const L=f=>{const cx=vm.createContext({});vm.runInContext(fs.readFileSync(f,'utf8'),cx);return vm.runInContext('YardFleetData',cx).designs;};
const a=L(process.argv[2]),b=L(process.argv[3]);let ships=0,same=0;
for(const k of Object.keys(b).sort()){if(!a[k]){console.log(k+'\t(new)');continue;}ships++;const diffs=[];let n=0;
 const walk=(x,y,p)=>{if(typeof x==='number'&&typeof y==='number'){n++;if(x!==y){const rel=x===0?Infinity:Math.abs(y/x-1);diffs.push([rel,p,x,y]);}return;}
  if(x&&y&&typeof x==='object'&&typeof y==='object'){if(Array.isArray(x)&&Array.isArray(y)&&x.length!==y.length){diffs.push([Infinity,p+'.length',x.length,y.length]);return;}for(const q of new Set([...Object.keys(x),...Object.keys(y)])){if(/sha|hash|signature|blueprint|id$/i.test(q))continue;walk(x[q],y[q],p+'.'+q);}return;}
  if((x===undefined)!==(y===undefined))diffs.push([Infinity,p+' (present on one side)',String(x).slice(0,20),String(y).slice(0,20)]);};
 walk(a[k].p,b[k].p,'p');diffs.sort((u,v)=>v[0]-u[0]);if(!diffs.length){same++;console.log(k+'\tall '+n+' numbers equal');continue;}
 console.log(k+'\t'+diffs.length+' of '+n+' numbers differ; largest relative difference '+(diffs[0][0]===Infinity?'(structure or zero)':diffs[0][0].toExponential(2))+' at '+diffs[0][1]+'; next: '+diffs.slice(1,4).map(d=>d[1]+' '+(d[0]===Infinity?'∞':d[0].toExponential(1))).join(', '));}
console.log('ships compared '+ships+', identical in every number '+same);
