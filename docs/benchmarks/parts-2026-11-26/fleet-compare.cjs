// Two data/fleet.js files side by side: each design's mass, price, crew and hotel power. read-only.
// usage: node fleet-compare.cjs <old fleet.js> <new fleet.js>
const fs=require('fs'),vm=require('vm');const load=f=>{const cx=vm.createContext({});vm.runInContext(fs.readFileSync(f,'utf8'),cx);return vm.runInContext('typeof YardFleetData!=="undefined"?YardFleetData:null',cx);};
const [a,b]=process.argv.slice(2).map(load);const D=x=>x.designs||x;console.log('design | mass old t | mass new t | change % | price old | price new | change % | accel old | accel new');
for(const k of Object.keys(D(b))){const o=D(a)[k],n=D(b)[k];if(!o||!n)continue;const m=x=>x.info?.mass??x.p?.mass,c=x=>x.info?.cost??x.p?.cost,acc=x=>x.p?.accel;const pc=(x,y)=>x>0?((y/x-1)*100).toFixed(3):'';
 console.log([k,(+m(o)).toPrecision(7),(+m(n)).toPrecision(7),pc(m(o),m(n)),Math.round(c(o)),Math.round(c(n)),pc(c(o),c(n)),(+acc(o)).toPrecision(5),(+acc(n)).toPrecision(5)].join(' | '));}
