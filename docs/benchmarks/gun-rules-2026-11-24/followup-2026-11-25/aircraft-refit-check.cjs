// The user's 16 refit craft: build each example and compare its mass and acceleration with the user's table (機体諸元.csv).
const fs=require('fs'),vm=require('vm'),path=require('path');const root=process.argv[2],csv=process.argv[3];const cx=vm.createContext({console:{log(){},warn(){},error(){}}});for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx);const C=vm.runInContext('Core',cx);
const rows=fs.readFileSync(csv,'utf8').replace(/^﻿/,'').trim().split(/\r?\n/).map(l=>l.split(','));const head=rows.shift(),col=n=>head.indexOf(n),by=new Map(rows.map(r=>[r[0],r]));
const KEYS=Object.keys(C.SHIP_EXAMPLES).filter(k=>/^craft_/.test(k));
console.log('example | name | mass t (table) | accel G (table 設計) | lasers bore,length,rate × n | warnings (warn+)');
for(const key of KEYS){let line;try{const t0=Date.now(),ship=C.buildDesign(key),S=C.computeStats(ship),r=by.get(ship.name);
 const las=new Map();for(const f of ship.fits)if(C.CRAFT_LASER_GEOMETRY[f.k]){const g=C.craftLaserRule(f),id=g.boreM+','+g.barrelM+','+(1/g.rateHz).toFixed(2)+'s';las.set(id,(las.get(id)||0)+(C.FITS[f.k].barrels||1));}
 const warns=(S.warnings||S.issues||[]).filter(w=>(w.level||w.t||w[0])==='warn'||(w.level||w.t||w[0])==='error').length;
 line=[key,ship.name,(S.mass??S.massT??0).toFixed(3)+' ('+(r?r[col('新版重量 t')]:'—')+')',((S.propulsion?.ratedAccelMps2??0)/C.G0).toFixed(0)+' ('+(r?r[col('設計加速度 G')]:'—')+')',[...las].map(([k,n])=>k+' × '+n).join('; '),warns,((Date.now()-t0)/1000).toFixed(0)+' s'].join(' | ');}catch(e){line=key+' | ERROR '+String(e.message).slice(0,200);}
 console.log(line);}
