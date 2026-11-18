const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),root=process.argv[2]||path.resolve(__dirname,'../../..'),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx);
const F=vm.runInContext('YardFleetData',cx),rows=[];
for(const [k,d] of Object.entries(F.designs)){const p=d.p,g=p.grid;if(!g||!p.heat)continue;const cap=p.heat.dis.reduce((a,x)=>a+(x.cap||0),0),fixed=g.fixed||0,Wp=Math.max(0,Math.min(g.Dw,g.P-fixed));if(!(Wp>0))continue;
 const budget=cap*.97-(1+.04)*fixed; // hotel heat + reactor loss on it
 const w=budget/Wp-.04,fr=x=>Math.max(0,Math.min(1,budget/((x+.04)*Wp)));
 rows.push({k,len:Math.round(p.len),'Dw/P':+(g.Dw/g.P).toFixed(2),'cap/P%':+(cap/g.P*100).toFixed(1),'needed w%':+(w*100).toFixed(1),'fire@25':+fr(.25).toFixed(2),'@10':+fr(.10).toFixed(2),'@8':+fr(.08).toFixed(2),'@6':+fr(.06).toFixed(2),'@5':+fr(.05).toFixed(2),'@3':+fr(.03).toFixed(2)});}
rows.sort((a,b)=>b.len-a.len);console.table(rows);
