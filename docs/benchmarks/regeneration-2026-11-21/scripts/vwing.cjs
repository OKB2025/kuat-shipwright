// V-wing power allocation: committed design at <ref> and the working-tree design under the current core. usage: node vwing.cjs <ref> [key]
const zlib=require('zlib'),fs=require('fs'),cp=require('child_process'),path=require('path');const root=process.cwd();const {C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const ref=process.argv[2],k=process.argv[3]||'craft_vwing';const L=b=>C.deserialize(JSON.parse(zlib.gunzipSync(b)));
const out={};for(const [tag,s] of [['old',L(cp.execSync(`git show ${ref}:data/examples/${k}/design.json.gz`,{maxBuffer:1e9}))],['new',L(fs.readFileSync(`data/examples/${k}/design.json.gz`))]]){const S=C.computeStats(s);
 const o={power:S.power,draw:S.draw,shieldP:S.shieldP,shieldPct:S.shieldPct,shieldTarget:S.shieldTarget,weaponBudget:S.weaponBudget,actualInputW:S.actualInputW,thrust:S.thrust,dissipatorPower:S.dissipatorPower,heat:S.heat&&{lim:S.heat.lim,limit:S.heat.limit,ratio:S.heat.ratio},craftSystems:S.craftSystems&&Object.fromEntries(Object.entries(S.craftSystems).filter(([q,v])=>typeof v!=='object')),parts:s.parts.map(p=>[p.id,p.k,+C.partVolume(p).toFixed(3)])};
 const num={};for(const [q,v] of Object.entries(S))if(typeof v==='number')num[q]=v;o.num=num;out[tag]=o;}
const keys=Object.keys(out.new.num).filter(q=>out.old.num[q]!==out.new.num[q]&&Math.abs(out.new.num[q]/out.old.num[q]-1)>1e-6);
console.log('numeric diffs',keys.map(q=>q+' '+out.old.num[q].toPrecision(6)+' → '+out.new.num[q].toPrecision(6)).join('\n'));
console.log('draw old',JSON.stringify(out.old.draw));console.log('draw new',JSON.stringify(out.new.draw));
const pv=o=>Object.fromEntries(o.parts.map(p=>[p[0],p]));const a=pv(out.old),b=pv(out.new);for(const id of new Set([...Object.keys(a),...Object.keys(b)]))if(JSON.stringify(a[id])!==JSON.stringify(b[id]))console.log('part',id,JSON.stringify(a[id]),'→',JSON.stringify(b[id]));
