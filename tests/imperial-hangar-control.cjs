const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict'),{test}=require('node:test'),{C}=require('../scripts/update-ship-examples.cjs').loadRuntime(path.join(__dirname,'..'));
const copy=x=>JSON.parse(JSON.stringify(x)),intersects=(a,b)=>a.slice(0,3).every((x,i)=>x<b[i+3]&&a[i+3]>b[i]);
for(const key of ['imperial','imperial2'])test(key+' hangar-control pod moves to the castle wall and keeps every gun fixed',()=>{
 const source=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'..','assets/source',key+'-2300g-factory-blueprints',key+'.json.gz')))),s=C.deserialize(source),f=s.fits.find(f=>f.k==='podHangar'),before=copy(f),guns=copy(s.fits.filter(f=>C.FITS[f.k]?.cat==='w'));
 C.relocateImperialHangarControl(s);assert.equal(f.id,before.id);assert.equal(f.width,before.width);assert.equal(f.height,before.height);assert.equal(f.commandEnabled,before.commandEnabled);assert.equal(f.host,14);assert.equal(f.float,false);assert.ok(Math.abs(f.p[0]-650)<1e-6&&Math.abs(f.p[1]-238)<1e-6&&f.p[2]>120);
 assert.deepEqual(copy(s.fits.filter(f=>C.FITS[f.k]?.cat==='w')),guns);for(const gun of s.fits.filter(f=>C.FITS[f.k]?.cat==='w'))assert.equal(intersects(C.fitAABB(f),C.fitAABB(gun)),false,'actual gun bounds '+gun.id);
 const again=C.deserialize(C.serialize(s)),saved=again.fits.find(p=>p.id===f.id);C.mountFit(again,saved);assert.equal(saved.float,false);assert.equal(saved.host,14);assert.ok(saved.p.every((x,i)=>Math.abs(x-f.p[i])<1e-6));
});
