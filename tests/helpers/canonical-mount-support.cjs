// Remounting may reorder polygons and introduce round-off far below model
// precision. Normalize only placement geometry to 1 nanometre; retain every
// setting, polygon vertex and winding. Weapon energy/counts are never rounded.
const coordinate=v=>Array.isArray(v)?v.map(coordinate):typeof v==='number'&&Number.isFinite(v)?Math.round(v*1e9)/1e9:v;
function canonicalMountSupport(s){
 if(!s||!Array.isArray(s.polys))return s;
 const polygon=p=>{if(!Array.isArray(p)||!p.length)return p;p=coordinate(p);const rotations=p.map((_,i)=>p.slice(i).concat(p.slice(0,i)));rotations.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));return rotations[0];};
 return {...s,top:coordinate(s.top),polys:s.polys.map(polygon).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))};
}
function canonicalWeaponPlacement(raw){const copy={...raw};for(const key of ['p','n','tilt','local','localNormal','frameForward','localForward'])if(copy[key])copy[key]=coordinate(copy[key]);if(copy.mountSupport)copy.mountSupport=canonicalMountSupport(copy.mountSupport);return copy;}
module.exports={canonicalMountSupport,canonicalWeaponPlacement};
// Source blueprints round public coordinates to ten significant digits. Test
// their physical poses with the same 1 micrometre tolerance as muzzle checks.
function mountSupportEquivalent(a,b,tolerance=1e-6){
 if(a==null||b==null)return a===b;
 if(!Array.isArray(a.polys)||!Array.isArray(b.polys)||a.polys.length!==b.polys.length)return false;
 const descriptor=x=>JSON.stringify(Object.fromEntries(Object.entries(x).filter(([k])=>!['top','polys'].includes(k)).sort(([a],[b])=>a.localeCompare(b))));
 if(descriptor(a)!==descriptor(b)||!Number.isFinite(a.top)||!Number.isFinite(b.top)||Math.abs(a.top-b.top)>tolerance)return false;
 const close=(x,y)=>Array.isArray(x)&&Array.isArray(y)&&x.length===y.length&&x.every((v,i)=>Number.isFinite(v)&&Number.isFinite(y[i])&&Math.abs(v-y[i])<=tolerance),same=(p,q)=>p.length===q.length&&p.some((_,start)=>p.every((v,i)=>close(v,q[(i+start)%q.length]))),remaining=b.polys.slice();
 for(const p of a.polys){const i=remaining.findIndex(q=>same(p,q));if(i<0)return false;remaining.splice(i,1);}return true;
}
module.exports.mountSupportEquivalent=mountSupportEquivalent;
