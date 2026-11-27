// usage: node fleetdiff.cjs <oldrev> <newrev> : every numeric/string leaf of YardFleetData that differs between the two revisions' data/fleet.js
const {execSync}=require('child_process'),vm=require('vm');const [a,b]=process.argv.slice(2);
const load=r=>{const cx=vm.createContext({});vm.runInContext(execSync(`git show ${r}:data/fleet.js`,{maxBuffer:1<<30}).toString()+';this.__D=YardFleetData;',cx);return cx.__D;};
const A=load(a),B=load(b),out=[];
const walk=(x,y,p)=>{if(JSON.stringify(x)===JSON.stringify(y))return;if(x&&y&&typeof x==='object'&&typeof y==='object'){for(const k of new Set([...Object.keys(x),...Object.keys(y)]))walk(x[k],y[k],p+'.'+k);return;}out.push([p,JSON.stringify(x)?.slice(0,60),JSON.stringify(y)?.slice(0,60)]);};
walk(A,B,'');const tally={};for(const [p] of out){const k=p.replace(/^\.designs\.[^.]+/,'.designs.*');tally[k]=(tally[k]||0)+1;}
console.log('differing leaves',out.length);for(const [k,n] of Object.entries(tally).sort((x,y)=>y[1]-x[1]))console.log(n+'\t'+k);console.log('--- samples');for(const r of out.slice(0,15))console.log(r.join('\t'));
