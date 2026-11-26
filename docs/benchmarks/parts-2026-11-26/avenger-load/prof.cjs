const fs=require('fs');const p=JSON.parse(fs.readFileSync(process.argv[2]));const byId=new Map(p.nodes.map(n=>[n.id,n]));const self=new Map();const dt=p.timeDeltas;let total=0;
for(let i=0;i<p.samples.length;i++){const n=byId.get(p.samples[i]),k=n.callFrame.functionName||'(anon)';self.set(k,(self.get(k)||0)+(dt[i]||0));total+=dt[i]||0;}
// inclusive by function (unique per stack)
const parent=new Map();for(const n of p.nodes)for(const c of n.children||[])parent.set(c,n.id);const incl=new Map();
for(let i=0;i<p.samples.length;i++){const seen=new Set();let id=p.samples[i];while(id!=null){const k=byId.get(id).callFrame.functionName||'(anon)';if(!seen.has(k)){seen.add(k);incl.set(k,(incl.get(k)||0)+(dt[i]||0));}id=parent.get(id);}}
const top=(m,n)=>[...m].sort((a,b)=>b[1]-a[1]).slice(0,n).map(([k,v])=>(v/1e6).toFixed(1).padStart(7)+' s  '+k).join('\n');
console.log('total',(total/1e6).toFixed(1),'s\n-- self\n'+top(self,22)+'\n-- inclusive\n'+top(incl,40));
