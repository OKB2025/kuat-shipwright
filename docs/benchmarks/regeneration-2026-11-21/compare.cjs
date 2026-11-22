// Compares the stored example rows (data/fleet.js) of two checkouts. Usage: node compare.cjs <base fleet.js> <new fleet.js>
const vm=require('vm'),fs=require('fs');const L=f=>{const cx=vm.createContext({});vm.runInContext(fs.readFileSync(f,'utf8'),cx);return vm.runInContext('YardFleetData',cx).designs;};
const a=L(process.argv[2]),b=L(process.argv[3]),r=(v,n=4)=>v==null?'-':(+v).toPrecision(n),pc=(x,y)=>x>0&&y!=null?((y/x-1)*100).toFixed(2)+'%':'-';
console.log(['key','mass t','mass Δ','accel (fleet row; equals maximumAccelMps2 × .002, the support-limited maximum, not the rated value nor G)','accel Δ','turn rad/s','turn Δ','accuracy','accuracy Δ','volley TT','volley Δ','parts(modules)'].join('\t'));
for(const k of Object.keys(b).sort()){const x=a[k]?.p,y=b[k].p;if(!x){console.log(k+'\t(new)');continue;}
 console.log([k,r(y.propulsion?.massKg/1000),pc(x.propulsion?.massKg,y.propulsion?.massKg),r(y.accel),pc(x.accel,y.accel),r(y.turnRate),pc(x.turnRate,y.turnRate),r(y.acc),pc(x.acc,y.acc),r(y.allGunVolleyTT,6),pc(x.allGunVolleyTT,y.allGunVolleyTT),(y.modules||[]).length].join('\t'));}
