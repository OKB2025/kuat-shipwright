// 2026-11-21: the Providence's rear hangar deck was widened to the skin so its side openings are where the deck meets the
// skin (extendBayToSkin). That moved the packing of an overlapping rack deck, which had been the only link between the rear
// deck and the upper hangar deck: the upper deck's packing cells are 5.2 m tall and stop 4.4 m above the rear deck, below
// the 1.5 m contact tolerance. aviationConnected now allows a gap of one packing cell between packed compartments.
// This test states the requirement on the stored example: every hangar compartment reaches a hatch, and no
// "unconnected aviation compartment" warning appears.
const assert=require('node:assert/strict'),fs=require('node:fs'),zlib=require('node:zlib'),path=require('node:path'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),{C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);

test('Providence: every hangar compartment of the stored example reaches a hatch',()=>{
 const ship=C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples/providence/design.json.gz'))))),S=C.computeStats(ship);
 const hangars=ship.parts.filter(p=>p.k==='hangar');
 assert.ok(hangars.length>=10,`hangar compartments (${hangars.length})`);
 for(const p of hangars)assert.equal(S.info[p.id]?.acc,true,`${p.label} #${p.id} reaches a hatch`);
 assert.ok(S.Vacc>=S.Vhang-1,`connected hangar volume ${S.Vacc} of ${S.Vhang}`);
 assert.ok(!(S.warnings||[]).some(w=>String(w.text||w).includes('ハッチに通じていない航空区画')),'no unconnected-compartment warning');
});

test('Providence: the side openings of the rear hangar deck are where the deck meets the skin',()=>{
 const ship=C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples/providence/design.json.gz')))));
 const side=ship.hatches.filter(h=>h.bay===24);
 assert.deepEqual(side.map(h=>h.face).sort(),['port','stbd']);
 for(const h of side){const a=C.hatchGrid(ship,h).area;assert.ok(a>1000,`${h.face} opening ${a} m²`);}
});
