// What lies between #183 and #181 of the stored Providence near the probe point that connects them under the new rule:
// for sample points in a box around the probe point, which compartment (non-structure part) contains them, or none.
// usage: node gap183.cjs [key] [a] [b] [qx,qy,qz] [hx,hy,hz]
const zlib=require('zlib'),fs=require('fs'),path=require('path');const {C}=require(path.join(process.cwd(),'scripts/update-ship-examples.cjs')).loadRuntime(process.cwd());
const [key='providence',ia='183',ib='181',qs='313.4,140.59,45.45',hs='10,3,1.2']=process.argv.slice(2);const q=qs.split(',').map(Number),h=hs.split(',').map(Number);
const s=C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(`data/examples/${key}/design.json.gz`))));C.computeStats(s);
const rooms=s.parts.filter(p=>!['hull','struct'].includes(p.k));const count=new Map();let n=0;
for(let x=-h[0];x<=h[0];x+=1)for(let y=-h[1];y<=h[1];y+=.25)for(let z=-h[2];z<=h[2];z+=.3){n++;const pt=[q[0]+x,q[1]+y,q[2]+z];const hit=rooms.filter(p=>C.inPart(p,pt)).map(p=>p.id+':'+p.k);const k=hit.length?hit.join('+'):'none';count.set(k,(count.get(k)||0)+1);}
console.log(`${key} #${ia}-#${ib} around ${q} ±${h}: ${n} samples`);for(const [k,v] of [...count].sort((a,b)=>b[1]-a[1]))console.log(' ',k,v);
const by=Object.fromEntries(['183','181'].map(i=>[i,s.parts.find(p=>String(p.id)===i)]));
for(const y of [-3,-2,-1,-.5,0,.5,1,2,3])console.log(' y',(q[1]+y).toFixed(2),'in183',C.inPart(by['183'],[q[0],q[1]+y,q[2]]),'in181',C.inPart(by['181'],[q[0],q[1]+y,q[2]]));
