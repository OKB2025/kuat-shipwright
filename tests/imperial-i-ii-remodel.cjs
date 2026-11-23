// 2026-11-23 The Imperial I / II examples are the user's 1,600 m remodels (docs/handoff-2026-11-20/refs/), replacing the
// earlier supplied layout (IMPERIAL_USER_LAYOUT; this file was tests/imperial-i-ii-layout.cjs and checked that layout's 26
// structures and 51 fitting poses, which no longer exist — an expectation change for review). User: 「そのままパーツを部品化
// して」: the design is taken as it is; only the bridge body, the ISD-72x domes with their posts and the centre antenna
// (now a tractor beam control unit, I and II types) become equipment parts, and lines to removed nodes are dropped.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),{C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const source=k=>JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'docs/handoff-2026-11-20/refs/imperial-'+k+'-1600m-remodel-2026-11-23.json.gz'))));
const BRIDGE=[578,579,582,583,711,712,713,714,715,716,717,718,721,722],ANTENNA={imperial:[726,727,732,733,734,735,736],imperial2:[726,727]};
for(const [key,k,name,tractor] of [['imperial','i','インペリアルI級','isdTractorI'],['imperial2','ii','インペリアルII級','isdTractorII']])test(name+' is the user remodel with the bridge, sensors and tractor control made into parts',()=>{
 const raw=source(k),ship=C.SHIP_EXAMPLES[key].build(),drop=new Set([...BRIDGE,...ANTENNA[key],724,725]);
 assert.equal(C.SHIP_EXAMPLES[key].name,name);assert.equal(ship.name,name+'｜重砲戦艦');assert.equal(ship.reference,key);assert.ok(!C.SHIP_SYSTEM_REFIT_KEYS.includes(key),'the design is used as given, without the system refit');
 const eq=[...ship.parts.filter(p=>p.equipmentId).map(p=>p.equipmentId+':'+p.skinAsset)].sort();assert.deepEqual(eq.slice(),['isdBridge:isd_bridge','isdSensor:isd_sensor_port','isdSensor:isd_sensor_stbd',tractor+':'+(key==='imperial'?'isd_tractor_i':'isd_tractor_ii')].sort());
 assert.equal(ship.parts.find(p=>p.id===50).equipmentId,'isdBridge','the bridge body keeps its id');
 const kept=raw.parts.filter(p=>!drop.has(p.id)&&p.id!==50).map(p=>p.id),ids=new Set(ship.parts.map(p=>p.id));for(const id of kept)assert.ok(ids.has(id),'part #'+id+' is kept');for(const id of drop)assert.ok(!ids.has(id),'part #'+id+' became equipment');
 assert.deepEqual([...ship.fits.map(f=>f.id)].sort((a,b)=>a-b),raw.fits.map(f=>f.id).sort((a,b)=>a-b),'every gun and fitting is kept');
 const nodes=new Set([...ship.parts.map(p=>'p'+p.id),...ship.fits.map(f=>'f'+f.id)]);assert.equal((ship.links||[]).filter(l=>!nodes.has(l.from)||!nodes.has(l.to)).length,0,'no line to a missing node (the source has p65 → f39)');
 assert.equal(ship.links.length,raw.links.length-1);
});
