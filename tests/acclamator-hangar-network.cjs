// User decisions 2026-11-16:「ハッチはここの側面に装甲壁。それ以外はない」「船全体の格納庫を繋げた単一のハッチがここ」.
// The Acclamator's only openings are a sliding armoured wall in each side of the lower common hangar, and every hangar and
// service deck reaches them. The reference-fidelity review of 2026-11-17 found the lower hangar / transfer deck seam inside the
// access tolerance by 0.1 m only (the packer separates the two rooms), so this test states the requirement on the built
// design and on the same design after saving and loading.
const assert=require('node:assert/strict'),path=require('node:path'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),{C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
function check(ship,label){
 const S=C.computeStats(ship),decks=ship.parts.filter(p=>p.k==='hangar'||p.k==='service');
 assert.ok(decks.length>=9,`${label}: hangar and service decks (${decks.length})`);
 for(const p of decks){assert.equal(S.info[p.id]?.acc,true,`${label}: ${p.label} reaches a hatch`);assert.equal(S.info[p.id]?.overlap,false,`${label}: ${p.label} overlaps nothing`);}
 assert.equal(ship.hatches.map(h=>h.face).sort().join(','),'port,stbd',`${label}: one hatch in each side, no others`);
 const bay=new Set(ship.hatches.map(h=>h.bay));assert.equal(bay.size,1,`${label}: both walls open the same hangar`);
 for(const h of ship.hatches){assert.equal(h.motion,'slide',`${label}: sliding wall`);assert.equal(S.hatchInfo?.[h.id]?.connected,true,`${label}: hatch ${h.face} connected`);}
 return S;
}
test('every Acclamator hangar and service deck reaches the two side walls, as built and after save and load',()=>{
 const built=C.buildDesign('acclamator'),a=check(built,'built'),loaded=C.deserialize(JSON.parse(JSON.stringify(C.serialize(built)))),b=check(loaded,'loaded');
 assert.equal(b.troopCapacity,a.troopCapacity);assert.ok(Math.abs(b.power/a.power-1)<1e-9,'the room-shaped main reactor keeps its output on load');
});
