const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),zlib=require('node:zlib');const root=process.argv[2],cx=vm.createContext({console:{log(){},warn(){},error(){}}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx);
for(const key of process.argv.slice(3)){const d=C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples',key,'design.json.gz')))));C.syncCompartments(d);const S=C.computeStats(d);
 console.log('==',key,'power W',S.powerNominal?.toExponential(3),'Dw',S.Dw?.toExponential?.(3));
 console.log(' heat keys',Object.keys(S.heat||{}).join(','));
 console.log(' heat',JSON.stringify(S.heat,(k,v)=>typeof v==='number'?+v.toPrecision(4):Array.isArray(v)&&v.length>8?'[..'+v.length+']':v).slice(0,1500));
 const seen=new Set();for(const f of d.fits){const sp=C.fitSpec(f),r=sp.gunRule;if(!r||seen.has(f.k))continue;seen.add(f.k);const n=d.fits.filter(q=>q.k===f.k).length;
  console.log(' gun',f.k,'x'+n,'kind',r.kind,'power W',sp.power?.toExponential(3),'feedK',r.feedK,'heatFrac',r.heatFrac,'shotChargeTT',r.shotChargeTT,'shotKt',r.shotKt,'interval',r.intervalS,'chargeRateTT',r.chargeRateTT,'wasteFrac',C.weaponWasteFrac?.(sp));}
}
