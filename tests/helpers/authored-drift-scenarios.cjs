// Small designs and one user edit each, for checking which authored fields the design engine rewrites on
// its own (phase A1 of the "authored state is never recomputed" work, 2026-11-12). Each scenario gives the
// design before the edit and edit(state), which applies the user's edit to the adopted public state.
const plain=x=>JSON.parse(JSON.stringify(x));
function rootBox(C){
 const s=C.newShip({L:200,W:60,H:40,assembly:true},'Drift: root box');
 s.parts=[];s.fits=[];s.hatches=[];s.links=[];s.groups=[];s.nextId=1;s.autoHabitation=false;s.detail=0;s.armor={hull:0,cit:0};
 const base={id:-1,k:'struct',form:'box',c:[0,0,0],s:[120,40,20],yaw:0,pitch:0,offsetX:0,offsetZ:0};
 const r=C.commitPlacement(s,base,{mode:'horizontal',placementModelVersion:C.PLACEMENT_MODEL_VERSION});if(!r.ok)throw new Error('root: '+r.error);
 return {s,root:r.part};
}
// A box sunk 1 m into the root's deck, placed through the editor's draft path and solved by a refresh.
function sunkChild(C,s,root,mode='horizontal',contactFit='cut'){
 const hit={p:[10,10,0],n:[0,1,0]},c=[10,10+3-1,0];
 const d=C.preparePlacementDraft(s,{id:s.nextId,k:'struct',form:'box',label:'sunk',c,s:[16,8,6],yaw:0,pitch:0,offsetX:0,offsetZ:0},{mode,parentStructureId:root.id,hostId:root.id,hit,contactFit,position:c,placementModelVersion:C.PLACEMENT_MODEL_VERSION});
 if(!d.ok)throw new Error('draft: '+d.error);s.parts.push(d.part);s.nextId++;const r=C.refreshPlacementGeometry(s);if(!r.ok)throw new Error('refresh: '+JSON.stringify(r.failed));
 return s.parts.find(p=>p.label==='sunk');
}
function scenarios(C){
 return [
  {name:'root resized across, sunk child elsewhere',build(){const {s,root}=rootBox(C);sunkChild(C,s,root);return s;},
   edit(st){const r=st.parts.find(p=>p.placement?.root);r.s=[r.s[0],r.s[1]+10,r.s[2]];return st;}},
  {name:'unrelated structure moved',build(){const {s,root}=rootBox(C);sunkChild(C,s,root);s.parts.push({id:s.nextId++,k:'struct',form:'box',c:[0,60,0],s:[4,4,4]});return s;},
   edit(st){const p=st.parts.find(q=>!q.placement);p.c=[p.c[0]+3,p.c[1],p.c[2]];return st;}},
  {name:'weapon on a moved structure',build(){
    const s=C.newShip({L:300,W:200,H:100,assembly:true},'Drift: weapon');s.parts=[{id:1,k:'struct',form:'box',c:[100,10,0],s:[200,160,20]}];s.fits=[];s.hatches=[];s.links=[];s.armor={hull:0,cit:0};s.nextId=2;s.detail=0;s.autoHabitation=false;
    const r=C.solveFitPlacement(s,{id:-1,k:'pd',p:[0,0,0],n:[0,1,0],a:2,ped:.3,assetYaw:17,mountMode:'auto'},{mode:'direct',hostId:1,hit:{p:[83,20,23],n:[0,1,0]},geometryRevision:0,parentGeometryRevision:0});
    if(!r.ok)throw new Error('fit: '+r.error);const a=C.acceptFitPlacementResult(s,r);if(!a.ok)throw new Error(a.error);return s;},
   edit(st){const p=st.parts.find(q=>q.id===1);p.c=[p.c[0]+5,p.c[1],p.c[2]];return st;}},
  {name:'engine support under a turned structure',build(){
    const s=C.newShip({L:200,W:100,H:100,assembly:true},'Drift: nozzle');s.parts=[{id:1,k:'struct',form:'box',c:[50,0,0],s:[100,80,80],pitch:20}];s.fits=[];s.hatches=[];s.links=[];s.groups=[];s.nextId=2;s.autoHabitation=false;s.detail=0;
    const h=C.rayPart([-100,0,0],[1,0,0],s.parts[0]);
    const r=C.solvePlacement(s,{id:-1,k:'engine',c:[-12,0,0],d:8,nozzleLength:4,dir:[-1,0,0]},{mode:'direct',parentStructureId:1,geometryRevision:1,parentGeometryRevision:0,placementModelVersion:C.PLACEMENT_MODEL_VERSION,hit:{p:Array.from(h.p),n:Array.from(h.n)}});
    if(!r.ok)throw new Error('engine: '+r.error);const a=C.acceptPlacementResult(s,r);if(!a.ok)throw new Error(a.error);return s;},
   edit(st){st.parts.find(q=>q.id===1).pitch=28;return st;}},
 ].map(x=>({...x,plain}));
}
module.exports={scenarios,rootBox,sunkChild};
