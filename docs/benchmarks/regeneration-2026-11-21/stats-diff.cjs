// Statistics of one example, computed by the current js/core.js from the committed design (git HEAD) and from the working-tree design; prints fields whose relative difference exceeds 1e-4. usage: node stats-diff.cjs <key> [base ref, default HEAD]
const zlib=require('zlib'),fs=require('fs'),cp=require('child_process'),path=require('path');
const root=process.cwd();const {C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const k=process.argv[2],ref=process.argv[3]||"HEAD";const load=raw=>{const w=JSON.parse(C.publicJSON(C.deserialize(raw)));return C.computeStats(w);};
const o=load(JSON.parse(zlib.gunzipSync(cp.execSync(`git show ${ref}:data/examples/${k}/design.json.gz`,{maxBuffer:1e9})))),n=load(JSON.parse(zlib.gunzipSync(fs.readFileSync(`data/examples/${k}/design.json.gz`))));
const rows=[];for(const q of Object.keys(n)){if(typeof n[q]==='number'&&typeof o[q]==='number'&&n[q]!==o[q]){const r=o[q]?n[q]/o[q]-1:Infinity;if(Math.abs(r)>1e-4)rows.push([q,o[q],n[q],r]);}}
rows.sort((a,b)=>Math.abs(b[3])-Math.abs(a[3]));for(const r of rows.slice(0,40))console.log(r[0].padEnd(28),(+r[1]).toPrecision(6),(+r[2]).toPrecision(6),(r[3]*100).toFixed(2)+'%');
for(const q of ['massBreakdown','massParts','massItems','breakdown'])if(n[q])console.log(q,JSON.stringify(n[q]).slice(0,800));
