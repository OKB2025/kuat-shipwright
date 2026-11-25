// feed surplus as ship heat: per example, the guns with feedK>1, their surplus power at sustained fire and surplus energy per salvo,
// against the ship's heat conversion capacity and heat store (catalogue profile p.heat). read-only.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),zlib=require('node:zlib');const root=process.argv[2],cx=vm.createContext({console:{log(){},warn(){},error(){}}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),F=vm.runInContext('YardFleetData',cx),TT=4.184e21;
console.log('heat keys',JSON.stringify(F.designs.cr90.p.heat).slice(0,400));
console.log('ship | gun (count) | feedK | input W all guns | heat now W | heat if surplus stays W | surplus J per salvo | ship power W | heat conversion W | heat store J | surplus power / conversion | salvo surplus / store');
for(const [key,row] of Object.entries(F.designs)){const file=path.join(root,'data/examples',key,'design.json.gz');if(!fs.existsSync(file))continue;const d=C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(file)))),p=row.p,by=new Map();
 for(const f of d.fits){const sp=C.fitSpec(f),r=sp.gunRule;if(!r||!(r.feedK>1))continue;const n=f.aggregateCount||1,e=by.get(f.k)||{n:0,power:0,now:0,all:0,salvo:0,feedK:r.feedK};const input=(sp.power||0);e.n+=n;e.power+=input;e.now+=input*(r.heatFrac||0);const sur=(1-1/r.feedK);e.all+=input*(sur+(r.heatFrac||0));e.salvo+=(r.shotChargeTT||0)*TT*sur*(sp.barrels||1);by.set(f.k,e);}
 for(const [k,e] of by)console.log([key,k+' ('+e.n+')',e.feedK.toFixed(2),e.power.toExponential(2),e.now.toExponential(2),e.all.toExponential(2),e.salvo.toExponential(2),(p.power||0).toExponential(2),(p.heat?.cap??p.heat?.out??0).toExponential?.(2),(p.heat?.capacityJ??0).toExponential?.(2),(e.all/(p.heat?.cap||p.heat?.out||1)).toFixed(3),(e.salvo/(p.heat?.capacityJ||1)).toFixed(3)].join(' | '));
}
