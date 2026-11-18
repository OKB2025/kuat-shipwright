#!/usr/bin/env node
// Part-level difference of every saved example design between two checkouts.
// usage: node design-part-diff.cjs <base checkout> [candidate checkout]
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const A=path.resolve(process.argv[2]),B=path.resolve(process.argv[3]||path.join(__dirname,'../../..'));
const read=(r,k)=>{const f=path.join(r,'data/examples',k,'design.json.gz');return fs.existsSync(f)?JSON.parse(zlib.gunzipSync(fs.readFileSync(f))):null;};
const keys=fs.readdirSync(path.join(B,'data/examples')).filter(k=>fs.existsSync(path.join(B,'data/examples',k,'design.json.gz'))).sort();
const J=v=>JSON.stringify(v),strip=o=>{const c={...o};return c;};
let shapeChanged=0;
for(const k of keys){const a=read(A,k),b=read(B,k);if(!a){console.log(k,'new');continue;}const out=[];
 for(const field of ['parts','fits']){const ma=new Map((a[field]||[]).map(p=>[p.id,p])),mb=new Map((b[field]||[]).map(p=>[p.id,p]));
  const added=[...mb.keys()].filter(i=>!ma.has(i)),removed=[...ma.keys()].filter(i=>!mb.has(i)),changed={};
  for(const [id,p]of mb){const q=ma.get(id);if(!q||J(p)===J(q))continue;const ks=[...new Set([...Object.keys(p),...Object.keys(q)])].filter(n=>J(p[n])!==J(q[n]));const kind=(p.k||'?');(changed[kind]||(changed[kind]={n:0,fields:new Set()})).n++;ks.forEach(n=>changed[kind].fields.add(n));
   if(field==='parts'&&(p.k==='struct'||p.form==='hull'||p.primaryHull||p.k==='engine'))shapeChanged++;}
  if(added.length||removed.length||Object.keys(changed).length)out.push(field+': +'+added.length+' -'+removed.length+' changed '+Object.entries(changed).map(([n,c])=>n+'×'+c.n+'['+[...c.fields].join(',')+']').join(' '));}
 const rest=Object.keys({...a,...b}).filter(n=>!['parts','fits'].includes(n)&&J(a[n])!==J(b[n]));if(rest.length)out.push('other fields: '+rest.join(','));
 console.log(k.padEnd(14),out.length?out.join(' | '):'identical');}
console.log('changed struct/hull/engine parts in all examples:',shapeChanged);
