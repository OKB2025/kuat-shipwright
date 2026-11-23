const fs=require('fs'),path=require('path'),zlib=require('zlib');const root=process.argv[2];const {C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
for(const k of process.argv.slice(3)){try{const s=C.buildDesign(k),S=C.computeStats(s);const st=C.craftStations(s,S);
 let src=null;try{src=JSON.parse(fs.readFileSync(path.join('/home/user/kuat-shipwright',C.SHIP_EXAMPLES[k].source),'utf8'));}catch{}
 console.log(k,s.name,'parts',s.parts.length,src?'(src '+src.parts.length+')':'','fits',s.fits.length,'mass',S.mass.toFixed(2),'accelG',S.accelG.toFixed(0),'len',(C.fleetProfile(S,s.name,s).len||0).toFixed(1),'stations',st.map(x=>x.fit+'x'+x.count).join('+'),'float',s.fits.filter(f=>f.float).length,'floatingFits',JSON.stringify(S.ungrounded?.floatingFits||[]),'floatFits',S.floatFits);
 for(const w of S.warnings)console.log('   ',(w.text||w).slice(0,120));}catch(e){console.log(k,'ERR',e.stack.split('\n').slice(0,3).join(' | '));}}
