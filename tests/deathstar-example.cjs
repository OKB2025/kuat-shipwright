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
 // every ring of the body: its distance from the centre along the dish axis and its radius, to the nearest 10 m
 const T=C.superweaponBodyTriangles(laser),rings=new Set();for(let i=0;i<T.length;i+=3){const d=sub([T[i],T[i+1],T[i+2]],C0),k=dot(d,ax);rings.add(Math.round(k/10)*10+':'+Math.round(Math.sqrt(Math.max(0,dot(d,d)-k*k))/10)*10);}
 const rim=Math.round(R*Math.sin(20*rad)/10)*10;/* the rim is 20 degrees from the dish axis on the source model; the housing fills its well */
 for(const [k,r,what] of [[10600,1500,'throat at the core'],[11600,1500,'throat'],[20500,4400,'bulb at its widest'],[29400,2000,'neck'],[33800,2000,'neck end'],[33800,5200,'first step'],[38000,5200,'first step end'],[38000,7200,'second step'],[45000,7200,'second step end'],[45000,9400,'third step'],[52700,9400,'third step end, on the floor of the wide well'],[52700,rim,'housing, as wide as the dish']])
  assert.ok(rings.has(k+':'+r),`${what}: no ring at ${k} m with radius ${r} m`);
});
test('the superlaser rests on the station and the command room is clear of its well',()=>{
 const S=C.computeStats(ship);assert.deepEqual(JSON.parse(JSON.stringify(S.ungrounded.parts)),[]);assert.ok(!S.info?.[laser.id]?.floating,'the superlaser touches the floor of its well');assert.ok(!S.warnings.some(w=>/浮いている区画|接地していない部品/.test(w.text)));
});
test('the polar column is two reactant silos, and the reactor core has the 10.4 km radius of the cutaway drawing',()=>{
 const silos=ship.parts.filter(p=>p.k==='fuel');assert.equal(silos.length,2);for(const s of silos){assert.ok(Math.abs(s.c[0]-R)<1&&Math.abs(s.c[2])<1,'on the polar axis');}
 assert.ok(silos.some(s=>s.c[1]>R)&&silos.some(s=>s.c[1]<R),'one above and one below the core');
 const core=ship.parts.find(p=>p.k==='gen');assert.equal(core.d,20800);/* user decision 2026-11-17「炉心は断面図の大きさ、残りは補助炉」: 10.4 km radius (before: 8 km, 「反応炉はそのままで」) */assert.ok(!C.computeStats(ship).warnings.some(w=>/反応物サイロがありません/.test(w.text)));
});
test('the station skin is kept through save and load, and an unknown paint still falls back',()=>{
 assert.equal(ship.paint,'station');const d=JSON.parse(JSON.stringify(C.serialize(ship)));assert.equal(C.deserialize(d).paint,'station');
 d.paint='no-such-paint';assert.equal(C.deserialize(d).paint,'neutral');
});
// User decision 2026-11-15「艦隊カタログには入れるが今はまだ艦隊編成の時に引っ張れないようにして」.
test('the Death Star is in the fleet catalogue but is not offered when a fleet is put together',()=>{
 const cx=require('node:vm').createContext({console,performance});for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])require('node:vm').runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
 const row=require('node:vm').runInContext('YardFleetData',cx).designs.deathstar;assert.ok(row,'a catalogue row');assert.equal(row.faction,'empire');assert.equal(row.cls,'バトルステーション');assert.equal(row.p.sw.length,1);assert.equal(row.p.sw[0].k,'slaser');assert.equal(row.p.sw[0].initialCharge,1,'it arrives charged');
 assert.equal(C.exampleFleetHidden('deathstar'),true);assert.equal(C.exampleFleetHidden('deathstar#2'),true);assert.equal(C.exampleFleetHidden('onager'),false);assert.equal(C.exampleFleetHidden('no-such-key'),false);
 // the three lists a fleet is put together from leave hidden examples out (the fleet screen's source list, the campaign's designs, the patrol escorts)
 const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
 // 2026-11-18 expectation changed (user decision「公試だけ出す」): the source list takes a flag, and only the trial's spawn list asks for hidden examples.
 assert.ok(app.includes("Object.entries(C.DESIGNS).filter(([k])=>all||!C.exampleFleetHidden(k))"));assert.ok(app.includes("function fleetOptions(all=false)"));assert.equal(app.split("fleetOptions(true)").length-1,1,'only one caller asks for hidden examples');assert.ok(app.includes("<select data-spawn-source aria-label=\"出す艦\">${fleetOptions(true)"),'and it is the trial spawn list');assert.ok(app.includes("if (!C.exampleFleetHidden(d.key)) out.push({key: d.key,"));assert.ok(app.includes("Object.values(YardFleetData?.designs || {}).filter(d => !C.exampleFleetHidden(d.key))"));assert.ok(app.includes("if(C.exampleFleetHidden(source)){"));
});
// Physics re-review 2026-11-15: the figures the superlaser's fixes depend on, read from the stored design.
test('the stored design is strict, its dish gives 53 ZT, and its exhaust port takes the full shot\'s loss',()=>{
 const S=C.computeStats(ship),p=C.fleetProfile(S,ship.name,ship),w=S.superweapons[0];assert.equal(ship.surfaces?.mode,'strict');assert.equal(p.energyModel.version,1);
 assert.equal(laser.d,C.SUPERWEAPONS.slaser.d);assert.equal(laser.d,C.SW_COMBAT.slaser.refD);assert.ok(Math.abs(laser.d-2*R*Math.sin(20*rad))<10,'the dish diameter is the measured rim');
 assert.equal(w.Emax,5.3e10);assert.equal(w.chargeT,86400);assert.equal(w.initialCharge,1);assert.equal(p.sw[0].initialCharge,1);
 const loss=C.HEAT.swShot*w.Emax*C.TT/C.SW_COMBAT.slaser.beamT,port=ship.parts.filter(q=>/^集中排熱口/.test(q.label||''));assert.equal(port.length,1);
 const cap=C.dissipatorCap(port[0],S);assert.ok(cap>=loss&&cap<=loss*1.2,`exhaust port ${cap} W against the full shot's loss ${loss} W`);
});
test('a station-size dome has 96 sides and 32 levels; an ordinary dome keeps 40 sides and 16 levels',()=>{
 // triangles: two a side for every level, and a fan of one a side on the base and on the top
 const tris=s=>C.structTriangles({id:1,k:'struct',form:'dome',c:[0,0,0],s}).length/9,count=(sides,levels)=>sides*2*levels+2*sides;
 assert.equal(tris([20000,20000,10000]),count(40,16));assert.equal(tris([40000,40000,20000]),count(96,32));
});
