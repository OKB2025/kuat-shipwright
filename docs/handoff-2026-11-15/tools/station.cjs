const path=require('path'),root=path.resolve(process.argv[2]);const {C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
console.log('classes',C.SHIP_CLASSES.map(c=>c.id).join(','),'limits ship',C.SHIP_LIMITS.length,'station',C.designLimitsFor('station').length);
console.log('auto class 50 km:',C.shipClassFor(50000).id,'| kept station 50 km:',C.shipClassFor(50000,'station').id,'| station 500 m:',C.shipClassFor(500,'station').id);
for(const L of [160000,2e6]){const t0=Date.now();const s=C.newShip({...C.HULLS.sphere,L,W:L,H:L},'station '+L,'station');
 let S;try{S=C.computeStats(s);}catch(e){console.log('L',L,'computeStats error',e.message.slice(0,200));continue;}
 console.log('L',L,'class',C.shipClassOf(s).id,'hull',JSON.stringify(s.hull.L),'envelope',JSON.stringify(C.designEnvelope(s)),'mass t',S.mass?.toExponential(3),'vol',S.volume?.toExponential?.(3)??S.V?.toExponential?.(3),'time',((Date.now()-t0)/1000).toFixed(1)+'s','warnings',(S.warnings||[]).length);
 const back=C.deserialize(JSON.parse(JSON.stringify(C.serialize(s))));console.log('  round trip L',back.hull.L,'class',back.shipClass,'envelope',JSON.stringify(C.designEnvelope(back)));
 const asShip=JSON.parse(JSON.stringify(C.serialize(s)));delete asShip.shipClass;const b2=C.deserialize(asShip);console.log('  without the class L',b2.hull.L);}
