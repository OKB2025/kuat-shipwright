// A user-style design for edit-latency and incremental-interior checks: the
// reported アマンガ hull (tests/helpers/interior-host-amanga.json) with its two
// placed side structures, three more structures placed on the deck, and 40
// interior equipment rooms placed directly (v1.2 explicit interior placement)
// inside the primary hull.
const fs=require('node:fs'),path=require('node:path');
const KINDS=['crew','cargo','fuel','pump','aux','inertial','integrity','hdis','firecontrol','service'];
function userFixture(C,{interior=40,structures=3}={}){
 const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'interior-host-amanga.json'),'utf8'));
 raw.parts=raw.parts.filter(p=>p.id!==7);raw.nextId=10;
 const ship=C.deserialize(raw);C.refreshPlacementGeometry(ship);
 const hull=ship.parts.find(p=>p.id===1);
 for(let i=0;i<structures;i++){
  const x=90+i*60,hit0=C.rayPart([x,5000,0],[0,-1,0],hull);if(!hit0)continue;
  const hit={p:hit0.p,n:C.norm(hit0.n)},pv={id:ship.nextId,k:'struct',form:'box',c:[hit.p[0],hit.p[1]+4,hit.p[2]],s:[20,8,14]};
  const d=C.preparePlacementDraft(ship,pv,{mode:'horizontal',parentStructureId:1,hostId:1,hit,contactFit:'cut',position:pv.c.slice(),placementModelVersion:C.PLACEMENT_MODEL_VERSION,geometryRevision:1});
  if(!d.ok)throw new Error('fixture structure '+i+': '+d.error);
  ship.parts.push(d.part);ship.nextId++;C.refreshPlacementGeometry(ship);
 }
 let n=0;
 for(let x=70;x<=250&&n<interior;x+=18)for(const y of [38,52])for(const z of [-8,8]){
  if(n>=interior)break;
  const k=KINDS[n%KINDS.length],id=ship.nextId++,shape={d:7},part={id,k,c:[x,y,z],...shape};
  // Each kind uses its first editor placement mode; kinds without one (crew) stay unplaced, as in older saves.
  const mode=C.placementCapability(part).allowedModes[0];
  if(mode)part.placement={modelVersion:C.PLACEMENT_MODEL_VERSION,mode,geometryRevision:1,hostId:1,requestedGeometry:JSON.parse(JSON.stringify(part))};
  ship.parts.push(part);n++;
 }
 const s=C.deserialize(JSON.parse(C.publicJSON(C.serialize(ship))));C.refreshPlacementGeometry(s);
 return s;
}
module.exports={userFixture};
