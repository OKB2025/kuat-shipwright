const fs=require('fs'),path=require('path'),zlib=require('zlib');const root='/home/user/kuat-shipwright';const {C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const load=k=>k.endsWith('.json')?C.deserialize(JSON.parse(fs.readFileSync(k,'utf8'))):C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples',k,'design.json.gz')))));
for(const k of process.argv.slice(2)){const s=load(k);C.syncCompartments(s);C.remount(s,{keepFitPose:true});C.syncCompartments(s);const S=C.computeStats(s);
 const ws=(S.warnings||[]).map(w=>typeof w==='string'?w:(w.msg||w.text||JSON.stringify(w)).slice(0,90));
 const keys=Object.keys(S).filter(x=>/acc|thrust|g$|G/i.test(x)).slice(0,12);
 console.log('==',path.basename(k),s.name,'mass t',(S.mass).toFixed(1),keys.map(x=>x+'='+(typeof S[x]==='number'?S[x].toPrecision(4):'')).join(' '));
 console.log('  fits',s.fits.map(f=>f.k+'#'+f.id+(f.float?'(FLOAT)':'')+(f.host!=null?'@'+f.host:'')).join(' '));
 for(const w of ws)console.log('  warn',w);}
