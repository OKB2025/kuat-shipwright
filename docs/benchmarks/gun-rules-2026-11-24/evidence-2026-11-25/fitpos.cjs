// fits of every saved example, one root against another: node fitpos.cjs <rootA> <rootB>
const fs=require('fs'),zlib=require('zlib'),path=require('path');const [A,B]=process.argv.slice(2),L=(root,k)=>JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples',k,'design.json.gz'))));
const sig=f=>[f.k,...f.p.map(v=>v.toFixed(3)),f.a,(f.assetYaw||0).toFixed(4),(f.assetPitch||0).toFixed(4),(f.scale||1).toFixed(4),(f.base||0).toFixed(3),(f.ped||0).toFixed(3)].join(',');
let total=0;for(const k of fs.readdirSync(path.join(B,'data/examples')).filter(k=>fs.existsSync(path.join(B,'data/examples',k,'design.json.gz'))).sort()){if(!fs.existsSync(path.join(A,'data/examples',k,'design.json.gz'))){console.log(k,'not in A');continue;}
 const a=L(A,k),b=L(B,k),sa=new Map(),sb=new Map();for(const f of a.fits)sa.set(sig(f),(sa.get(sig(f))||0)+1);for(const f of b.fits)sb.set(sig(f),(sb.get(sig(f))||0)+1);
 let onlyA=0,onlyB=0;const kinds={};for(const [s,n] of sa){const d=n-(sb.get(s)||0);if(d>0){onlyA+=d;const q=s.split(',')[0];kinds[q]=(kinds[q]||0)+d;}}for(const [s,n] of sb){const d=n-(sa.get(s)||0);if(d>0)onlyB+=d;}
 const pa=a.parts.filter(p=>p.k==='struct').length,pb=b.parts.filter(p=>p.k==='struct').length;
 if(onlyA||onlyB||a.fits.length!==b.fits.length||pa!==pb){total++;console.log(k,'fits',a.fits.length+'→'+b.fits.length,'structures',pa+'→'+pb,'poses only in A',onlyA,'only in B',onlyB,JSON.stringify(kinds));}}
console.log(total,'examples differ in their fits (kind, position to 1 mm, axis, yaw, pitch, scale, base, pedestal; ids ignored)');
