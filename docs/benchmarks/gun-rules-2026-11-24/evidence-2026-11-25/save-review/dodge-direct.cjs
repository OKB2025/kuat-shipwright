// Read-only: a copy made by combatClone, run through dogfightAim at a merge, changes the plan's own dodge state.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=process.argv[2],cx=vm.createContext({console:{log(){},warn(){},error(){}}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx);
const plan={id:'a',pos:[0,0,0],velocity:[200,0,0],yaw:0,p:{len:12,cls:{craft:true}},pass:{target:'b',phase:'dogfight',side:0}};
const t={id:'b',pos:[300,0,0],velocity:[-200,0,0],yaw:Math.PI,p:{len:12,cls:{craft:true}}};
// turn 1 on a copy: the dodge starts
let work={...plan,...C.combatClone(plan)};C.dogfightAim(work,t,work.pass,.1);plan.pass=JSON.parse(JSON.stringify(work.pass));/* the played turn's state becomes the plan */
const before=JSON.stringify(plan.pass);console.log('plan pass after the played turn',before);
work={...plan,...C.combatClone(plan)};C.dogfightAim(work,t,work.pass,.1);
console.log('plan pass after one commit on a copy',JSON.stringify(plan.pass),'changed:',JSON.stringify(plan.pass)!==before);
