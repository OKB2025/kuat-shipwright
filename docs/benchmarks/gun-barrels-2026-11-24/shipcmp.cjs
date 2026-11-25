// saved design → Core.deserialize → computeStats: parts, fits, interference, loose, mass, the guns' combined box, feed compartments, warnings.
// usage: node shipcmp.cjs <root> <out.json> [key,key,...]   (default: every example)
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),zlib=require('node:zlib');
const root=path.resolve(process.argv[2]),out=process.argv[3],cx=vm.createContext({console:{log(){},warn(){},error(){}}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),dir=path.join(root,'data/examples'),keys=process.argv[4]?process.argv[4].split(','):fs.readdirSync(dir).filter(k=>fs.existsSync(path.join(dir,k,'design.json.gz'))).sort();
const cnt=v=>Array.isArray(v)?v.length:typeof v==='number'?v:v&&typeof v==='object'?Object.keys(v).length:v==null?null:String(v);
const res=fs.existsSync(out)?JSON.parse(fs.readFileSync(out,'utf8')):{};
for(const k of keys){if(res[k])continue;const t0=Date.now();try{const s=C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir,k,'design.json.gz')))));const S=C.computeStats(s);
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];let guns=0;const kinds={};for(const f of s.fits){const d=C.FITS[f.k];if(!d||d.cat!=='w')continue;guns++;kinds[f.k]=(kinds[f.k]||0)+1;const b=C.fitAABB?.(f);if(b)for(let i=0;i<3;i++){lo[i]=Math.min(lo[i],b[i]);hi[i]=Math.max(hi[i],b[i+3]);}}
  const ci=Object.values(S.chargeInfo||{}),W=(S.warnings||[]).map(w=>(w.lv||'')+':'+String(w.text||'').slice(0,90));
  res[k]={name:s.name,parts:s.parts.length,fits:s.fits.length,guns,kinds,interference:cnt(S.overlap),loose:cnt(S.floating),looseFits:cnt(S.floatFits),mass:S.mass,power:S.power,accel:S.accel??S.acceleration??null,gunBox:[lo.map(v=>+v.toFixed(2)),hi.map(v=>+v.toFixed(2))],feed:{n:ci.length,required:+ci.reduce((n,a)=>n+a.required,0).toFixed(1),volume:+ci.reduce((n,a)=>n+a.volume,0).toFixed(1),short:ci.filter(a=>a.ratio<.999).length},warnings:W,statKeys:Object.keys(S).filter(x=>/interf|loose|float|unsupp|overlap/i.test(x)),seconds:Math.round((Date.now()-t0)/1000)};}
 catch(e){res[k]={error:String(e).slice(0,300)};}
 fs.writeFileSync(out,JSON.stringify(res,null,1));process.stderr.write(k+' '+JSON.stringify(res[k]).slice(0,160)+'\n');}
