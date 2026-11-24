// Re-fit CRAFT_REACTOR_SCALE so each tube craft keeps the acceleration it had before the tubes came back.
const fs=require('fs'),path=require('path'),cp=require('child_process');
const REPO='/home/user/kuat-shipwright',W='/tmp/ks-verify/20261123-tubes/cal/root';
const base=JSON.parse(fs.readFileSync('/tmp/ks-verify/20261123-tubes/cmp-base.json','utf8'));
const keys=Object.keys(base).filter(k=>k!=='craft_v19');cp.execSync(`rm -rf ${W} && mkdir -p ${W} && cp -r ${REPO}/js ${REPO}/data ${REPO}/scripts ${W}/`);
const src=fs.readFileSync(path.join(REPO,'js/core.js'),'utf8');const m=/const CRAFT_REACTOR_SCALE=Object\.freeze\(\{([^\n]*)\}\);/.exec(src);
const get=(txt,k)=>+new RegExp(k+':([0-9.]+)').exec(txt)[1];
let scales={};for(const k of keys)scales[k]=get(m[1],k);
const measure=()=>{let body=m[1];for(const k of keys)body=body.replace(new RegExp('('+k+':)[0-9.]+'),'$1'+scales[k].toFixed(12));fs.writeFileSync(path.join(W,'js/core.js'),src.replace(m[0],'const CRAFT_REACTOR_SCALE=Object.freeze({'+body+'});'));
 const out=cp.execSync(`node /tmp/ks-verify/20261123-tubes/cal/meas.cjs ${W} ${keys.join(' ')}`,{maxBuffer:1e8}).toString();const r=JSON.parse(out.trim().split('\n').pop());for(const k of keys)if(typeof r[k]!=='number')throw new Error(k+' '+r[k]);return r;};
let prev={},prevS={};
for(let it=0;it<6;it++){const a=measure();const row=keys.map(k=>k+' '+scales[k].toFixed(6)+' '+a[k].toFixed(1)+'/'+base[k].accelG).join(' | ');console.log('it',it,row);
 if(keys.every(k=>Math.abs(a[k]/base[k].accelG-1)<2e-4))break;
 for(const k of keys){let e=1/3;if(prev[k]!=null&&Math.abs(scales[k]-prevS[k])>1e-9){e=Math.log(a[k]/prev[k])/Math.log(scales[k]/prevS[k]);e=1/Math.max(.3,Math.min(5,e));}
  prev[k]=a[k];prevS[k]=scales[k];scales[k]*=Math.pow(base[k].accelG/a[k],e);}}
console.log(JSON.stringify(scales));
