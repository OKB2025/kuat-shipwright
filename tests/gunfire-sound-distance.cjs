// User request 2026-11-16「砲撃音は距離によって音を小さくして」: a ship's gunfire is at full volume only within the spread of
// the ship (0.8 km + 0.3 of its length) and falls with distance to nothing at five lengths (20 km at least).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),cx=vm.createContext({clamp:(x,a,b)=>Math.min(b,Math.max(a,x))});
const grab=(a,b)=>{const i=app.indexOf(a),j=app.indexOf(b,i);assert.ok(i>=0&&j>i,a);return app.slice(i,j);};
vm.runInContext(grab('const smooth','\n')+'\n'+grab('const atten','\n')+'\n'+grab('function sndGunRange','\nfunction sndAt'),cx);
const gain=(len,d)=>vm.runInContext(`(()=>{const r=sndGunRange(${len});return atten(${d},r.near,r.far);})()`,cx);
test('the range grows with the ship, but much less than before',()=>{
 const isd=vm.runInContext('sndGunRange(1600)',cx),ex=vm.runInContext('sndGunRange(19000)',cx);
 assert.deepEqual([isd.near,isd.far],[1280,20000]);assert.deepEqual([ex.near,ex.far],[6500,95000]);
});
test('gunfire grows quieter with distance and is silent past its far limit',()=>{
 for(const len of [150,1600,19000]){let prev=1.01;for(const d of [100,3000,8000,15000,30000,60000,120000]){const g=gain(len,d);assert.ok(g<=prev+1e-12,`${len} m ship at ${d} m: ${g} after ${prev}`);prev=g;}}
 assert.equal(gain(1600,1000),1);assert.ok(gain(1600,8700)<.12,'an ISD 8.7 km off: '+gain(1600,8700));assert.equal(gain(1600,20000),0);
 assert.ok(gain(19000,28000)<.4,'an Executor 28 km off is no longer at full volume: '+gain(19000,28000));
});
