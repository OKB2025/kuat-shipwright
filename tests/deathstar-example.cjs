// The Death Star example (user requests 2026-11-15): the superlaser follows the user's cutaway drawing and fires along
// the dish axis, the polar column is the reactant silos, and the station carries the plated 'station' skin.
// The measurements are in docs/deathstar-source-notes.md.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),{test}=require('node:test');
const root=process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'),{C}=require('../scripts/update-ship-examples.cjs').loadRuntime(root);
const raw=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples/deathstar/design.json.gz'))).toString('utf8')),ship=C.deserialize(raw.design||raw.ship||raw);
const R=80000,C0=[R,R,0],rad=Math.PI/180,ax=[Math.cos(27*rad),Math.sin(27*rad),0],laser=ship.parts.find(p=>p.k==='slaser');
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],sub=(a,b)=>a.map((v,i)=>v-b[i]);
test('the superlaser fires along the dish axis from the focus, 8 km outside the sphere',()=>{
 assert.ok(laser,'a superlaser');const a=C.superweaponAxis(laser),m=C.superweaponMuzzle(laser);
 assert.ok(Math.hypot(...sub(a,ax))<1e-9,`axis ${a}`);assert.ok(Math.hypot(...sub(m,C0.map((c,i)=>c+ax[i]*(R+8000))))<1,`muzzle ${m}`);
});
test('its body has the bulb, the neck, the stepped works and the housing of the cutaway drawing',()=>{
 const T=C.superweaponBodyTriangles(laser),widest=(k0,k1)=>{let r=0;for(let i=0;i<T.length;i+=3){const d=sub([T[i],T[i+1],T[i+2]],C0),k=dot(d,ax);if(k<k0||k>k1)continue;r=Math.max(r,Math.sqrt(Math.max(0,dot(d,d)-k*k)));}return r;};
 const near=(v,want,tol,what)=>assert.ok(Math.abs(v-want)<=tol,`${what}: ${Math.round(v)} against ${want}`);
 near(widest(8300,11500),1500,60,'throat at the core');near(widest(12000,29000),4400,60,'bulb');near(widest(29600,33600),2000,60,'neck');
 near(widest(34000,37900),5200,60,'first step');near(widest(38100,44900),7200,60,'second step');near(widest(45100,52900),9400,60,'third step');
 near(widest(53200,60000),R*Math.sin(21*rad)-300,60,'housing, the dish rim less 300 m');
});
test('the polar column is two reactant silos, and the reactor core keeps its 8 km radius',()=>{
 const silos=ship.parts.filter(p=>p.k==='fuel');assert.equal(silos.length,2);for(const s of silos){assert.ok(Math.abs(s.c[0]-R)<1&&Math.abs(s.c[2])<1,'on the polar axis');}
 assert.ok(silos.some(s=>s.c[1]>R)&&silos.some(s=>s.c[1]<R),'one above and one below the core');
 const core=ship.parts.find(p=>p.k==='gen');assert.equal(core.d,16000);assert.ok(!C.computeStats(ship).warnings.some(w=>/反応物サイロがありません/.test(w.text)));
});
test('the station skin is kept through save and load, and an unknown paint still falls back',()=>{
 assert.equal(ship.paint,'station');const d=JSON.parse(JSON.stringify(C.serialize(ship)));assert.equal(C.deserialize(d).paint,'station');
 d.paint='no-such-paint';assert.equal(C.deserialize(d).paint,'neutral');
});
