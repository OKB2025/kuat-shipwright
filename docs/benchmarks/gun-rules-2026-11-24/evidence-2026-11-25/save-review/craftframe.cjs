// Craft fixed lasers in main's saved craft examples: frame under main's code vs candidate's code (read-only)
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),zlib=require('node:zlib');
const [cand,main]=process.argv.slice(2);
function load(root){const cx=vm.createContext({console:{log(){},warn(){},error(){}}});for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});return vm.runInContext('Core',cx);}
const CN=load(cand),CM=load(main);
const keys=fs.readdirSync(path.join(main,'data/examples')).filter(k=>k.startsWith('craft_'));
for(const k of keys){const raw=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(main,'data/examples',k,'design.json.gz'))));
 const sm=CM.deserialize(JSON.parse(JSON.stringify(raw))),sn=CN.deserialize(JSON.parse(JSON.stringify(raw)));
 for(const f of sm.fits){if(!CN.CRAFT_LASER_GEOMETRY[f.k])continue;const g=sn.fits.find(q=>q.id===f.id);const a=CM.fitFrameOf(f),b=CN.fitFrameOf(g);
  const d=Math.acos(Math.max(-1,Math.min(1,CN.dot(a.fw,b.fw))))*180/Math.PI;
  console.log(k,f.id,f.k,'a',f.a,'assetYaw',f.assetYaw||0,'fw main',a.fw.map(v=>v.toFixed(3)).join(','),'cand',b.fw.map(v=>v.toFixed(3)).join(','),'diff°',d.toFixed(2),'bore',g.boreM,g.barrelM);}}
// synthetic: a claser fit on each mount axis
for(let a=0;a<6;a++){const f={id:1,k:'claser',a,p:[0,0,0]};const x=CM.fitFrameOf({...f}),y=CN.fitFrameOf({...f});console.log('axis',a,'main fw',x.fw.map(v=>+v.toFixed(3)),'cand fw',y.fw.map(v=>+v.toFixed(3)));}
