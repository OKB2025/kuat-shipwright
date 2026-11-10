// v24 A reactor delivers only what its reactant feed equipment supplies (REACTANT_SUPPLY).
// Synthetic fixtures that exercise power, propulsion or heat add feed equipment sized for
// their reactors, in the first free spot next to a reactor inside the hull.
function addReactantFeed(C,ship,options={}){
 const reactors=ship.parts.filter(p=>C.isReactor(p));if(!reactors.length)return null;
 const Vgen=reactors.reduce((n,p)=>n+C.partVolume(p),0),volume=Vgen/C.REACTANT_SUPPLY.reactorPerPump*(options.margin??1.05),d=Math.cbrt(volume);
 const occupied=(()=>{try{return C.allOccupied(ship);}catch{return ship.parts;}})();
 const probe={id:-1,k:'pump',d,c:[0,0,0],autoFit:false};
 const free=c=>{probe.c=c;const b=C.partAABB(probe);if(!C.insideOriginalEnvelope(ship,c))return false;for(const q of [[b[0],b[1],b[2]],[b[3],b[4],b[5]],[b[0],b[4],b[5]],[b[3],b[1],b[2]]])if(!C.insideOriginalEnvelope(ship,q))return false;return !occupied.some(p=>p.id!==probe.id&&C.overlapParts(probe,p));};
 for(const r of reactors.slice().sort((a,b)=>C.partVolume(b)-C.partVolume(a))){
  const b=C.partAABB(r),gap=d*.6+.01;
  for(const c of [[r.c[0],r.c[1],b[5]+gap],[r.c[0],r.c[1],b[2]-gap],[r.c[0],b[4]+gap,r.c[2]],[r.c[0],b[1]-gap,r.c[2]],[b[3]+gap,r.c[1],r.c[2]],[b[0]-gap,r.c[1],r.c[2]]])
   if(free(c)){
    // A fixed high id leaves the fixture's own ids and nextId untouched.
    const used=new Set(ship.parts.map(q=>q.id));let id=990000;while(used.has(id))id++;
    const p={id,k:'pump',c:c.slice(),d,label:'反応物供給設備',autoFit:false};ship.parts.push(p);return p;
   }
 }
 if(options.required!==false)throw new Error('no room for reactant feed equipment');
 return null;
}
module.exports={addReactantFeed};
