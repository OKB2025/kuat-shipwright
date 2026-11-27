// usage: node exdiff.cjs <oldrev> <newrev> : for each data/examples/*/design.json.gz changed between revs, list the top-level/part fields that differ (ignoring structural-record fields)
const {execSync}=require('child_process'),zlib=require('zlib');const [a,b]=process.argv.slice(2);
const files=execSync(`git diff --name-only ${a} ${b} -- 'data/examples/*/design.json.gz'`).toString().trim().split('\n').filter(Boolean);
const load=(r,f)=>JSON.parse(zlib.gunzipSync(execSync(`git show ${r}:${f}`,{maxBuffer:1<<30})).toString());
const diffKeys=(x,y,p,out,depth)=>{if(JSON.stringify(x)===JSON.stringify(y))return;if(depth>3||typeof x!=='object'||typeof y!=='object'||!x||!y){out.add(p);return;}for(const k of new Set([...Object.keys(x),...Object.keys(y)]))diffKeys(x[k],y[k],p+'.'+(Array.isArray(x)?'#':k),out,depth+1);};
for(const f of files){const o=load(a,f),n=load(b,f),out=new Set();diffKeys(o,n,'',out,0);
 const parts=(d)=>(d.ship||d).parts?.length,fits=(d)=>(d.ship||d).fits?.length;
 console.log(f.split('/')[2]+'\tparts '+parts(o)+'->'+parts(n)+'\tfits '+fits(o)+'->'+fits(n)+'\t'+[...out].slice(0,8).join(' '));}
