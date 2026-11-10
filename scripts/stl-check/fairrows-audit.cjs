// Per measured solid: lofted volume with the old fairRows, the all-rows envelope (first fix) and the two-row envelope (current), from the data blocks in js/core.js.
const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');const grab=n=>{const i=src.indexOf('const '+n+'=')+n.length+7;let d=0,j=i;for(;j<src.length;j++){if(src[j]=='{')d++;else if(src[j]=='}'){d--;if(!d)break;}}return JSON.parse(src.slice(i,j+1));};
const gapOf=r=>Math.max(.01,(r.at(-1)[0]-r[0][0])*.003),env=(sel,x)=>[x,Math.min(...sel.map(r=>r[1])),Math.max(...sel.map(r=>r[2])),Math.min(...sel.map(r=>r[3])),Math.max(...sel.map(r=>r[4]))];
const inner=(rows,gap,out,x1)=>{for(const r of rows.slice(1,-1))if(r[0]-out.at(-1)[0]>=gap&&x1-r[0]>=gap)out.push(r);return out;};
const OLD=rows=>{const x1=rows.at(-1)[0],g=gapOf(rows);const o=inner(rows,g,[rows[0]],x1);o.push(rows.at(-1));return o;};
const MK=two=>rows=>{const x0=rows[0][0],x1=rows.at(-1)[0],g=gapOf(rows),head=rows.filter(r=>r[0]-x0<g),tail=rows.filter(r=>x1-r[0]<g&&r[0]-x0>=g),pick=a=>two?[a[0],a.at(-1)]:a;const o=inner(rows,g,[head.length>1?env(pick(head),x0):rows[0]],x1);o.push(tail.length>1?env(pick(tail),x1):rows.at(-1));return o;};
// Exact volume of a loft of box sections with linear bounds between rows.
const vol=rows=>{let v=0;for(let i=0;i+1<rows.length;i++){const a=rows[i],b=rows[i+1],L=b[0]-a[0];if(L<=0)continue;const w0=a[2]-a[1],w1=b[2]-b[1],h0=a[4]-a[3],h1=b[4]-b[3];v+=L*(w0*h0/3+w1*h1/3+(w0*h1+w1*h0)/6);}return v;};
const report={};
for(const [name,key] of [['MUNI','munificent'],['RECU','recusant'],['PROV','providence'],['LUCR','lucrehulk']]){const D=grab(name),rows=[];let t={old:0,all:0,two:0};
 D.parts.forEach((p,i)=>{const r=p.rows.slice().sort((a,b)=>a[0]-b[0]),k=p.mirror?2:1,o=vol(OLD(r))*k,a=vol(MK(false)(r))*k,b=vol(MK(true)(r))*k;t.old+=o;t.all+=a;t.two+=b;rows.push({part:i+1,old:+o.toFixed(1),allEnvelope:+a.toFixed(1),twoRow:+b.toFixed(1),diffTwo:+(b-o).toFixed(1),allMinusTwo:+(a-b).toFixed(1),mirror:!!p.mirror});});
 rows.sort((x,y)=>Math.abs(y.diffTwo)-Math.abs(x.diffTwo));report[key]={units:name==='MUNI'||name==='LUCR'?'m (rows as stored)':'rows before scale K',totals:Object.fromEntries(Object.entries(t).map(([k,v])=>[k,+v.toFixed(1)])),changedParts:rows.filter(r=>Math.abs(r.diffTwo)>1e-6).length,flangeLike:rows.filter(r=>r.allMinusTwo>1e-3).length,top:rows.slice(0,10)};}
fs.writeFileSync(process.argv[3],JSON.stringify(report,null,1));for(const [k,v] of Object.entries(report))console.log(k,JSON.stringify(v.totals),'changed',v.changedParts,'all-row envelope > two-row in',v.flangeLike,'parts');
