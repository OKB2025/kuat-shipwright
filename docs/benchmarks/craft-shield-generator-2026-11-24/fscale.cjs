const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=process.argv[2],cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),gl=C.shieldGeneratorLength||null,fs_=C.fieldScale||(p=>{/* the length-only rule of the base commit, copied */const S={refLen:13.4,refScale:3e-6,scale:1e-6,craftLen:20,blendLen:100,fullLen:1000,minLen:1},E=Math.log(S.refScale)/Math.log(S.refLen/S.fullLen),L=Math.max(S.minLen,p?.len||S.refLen);if(L>=S.fullLen)return 1;const craft=Math.log(L/S.fullLen)*E,ship=Math.log(S.scale)*(1-Math.log(L/S.craftLen)/Math.log(S.fullLen/S.craftLen));if(L<=S.craftLen)return Math.exp(craft);if(L>=S.blendLen)return Math.exp(ship);const t=Math.log(L/S.craftLen)/Math.log(S.blendLen/S.craftLen),w=t*t*(3-2*t);return Math.exp(craft*(1-w)+ship*w);});
const F=vm.runInContext('YardFleetData',cx).designs,out={};
for(const k of Object.keys(C.SHIP_EXAMPLES).filter(k=>k.startsWith('craft_'))){const s=C.buildDesign(k),S=C.computeStats(s),p={...C.craftCombat(s,S).powerProfile,cls:S.cls};
 out[k]={len:p.len,gen:gl?gl(p):null,scale:fs_(p),field:p.shieldBuffer*fs_(p)};}
for(const k of Object.keys(F).filter(k=>F[k].p&&F[k].p.len<120).concat(['nebulonb','imperial'])){const p=F[k].p;out[k]={len:p.len,gen:gl?gl(p):null,scale:fs_(p),field:p.shieldBuffer*fs_(p)};}
console.log(JSON.stringify(out));
