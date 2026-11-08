const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(__dirname,'..'),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),{C}=require('../scripts/update-ship-examples.cjs').loadRuntime(root);
function fn(name){const start=new RegExp('function '+name+'\\s*\\(').exec(app);assert.ok(start,name);for(let end=app.indexOf('}',start.index);end>=0;end=app.indexOf('}',end+1)){const code=app.slice(start.index,end+1);try{new vm.Script(code);return code;}catch{}}assert.fail(name);}
function draft(mode,hit,side){
 const ship=C.newShip({L:1600,W:1183.6,H:268,assembly:true},'Native structure preview'),context=vm.createContext({C,ship,hit,
  st:{part:'struct',structSize:[180,110,60],structForm:'trap',structTaper:.25,structAngles:[0,0,0,0],structYaw:0,structPitch:0,structRoll:0,alignment:'none',surfaceMode:'horizontal'},
  designUI:{mode,contactSide:side},designPlacementActive:()=>true,designCapability:p=>C.placementCapability(p),activeEquipment:()=>null,activeTemplate:()=>null,isSponsonPlacement:()=>false,isAeroKind:()=>false});
 for(const name of ['designStructureCutPreview','unalignedPartPreview','partPreview'])vm.runInContext(fn(name),context);
 return {ship,part:vm.runInContext('partPreview(hit)',context)};
}
const p=[699.6640014648436,217.79897259080803,-11.240281189640882],n=[.07002539854871913,.9793948653727103,-.1894258198864763];
test('the actual native Imperial horizontal trap draft intersects its tapped skin without a whole-body normal lift',()=>{
 const hit={kind:'part',parentStructureId:178,p:p.slice(),n:n.slice()},row=draft('horizontal',hit),part=row.part;
 assert.deepEqual(Array.from(part.c),[p[0],p[1]+18,p[2]]);assert.ok(part.c[1]-part.s[2]/2<hit.p[1],'the raw bottom overlaps the tapped parent for the child-only cut');
 assert.equal(part.pitch,0);assert.equal(part.roll,0);assert.equal(part.surfaceNormal,undefined);
 const parent={id:178,k:'struct',form:'box',c:[p[0],p[1]-5,p[2]],s:[400,400,10]};row.ship.parts=[parent];row.ship.nextId=179;
 const prepared=C.preparePlacementDraft(row.ship,{...part,id:179},{mode:'horizontal',contactFit:'cut',position:part.c.slice(),parentStructureId:178,hit});
 assert.equal(prepared.ok,true,prepared.error);assert.deepEqual(Array.from(prepared.part.c),Array.from(part.c));assert.equal(prepared.part.placement.contactOffset[1],18);assert.equal(prepared.part.placement.pendingGeometry,true);
});
test('vertical drafts use the horizontal contact direction and retain the tapped height for all contact sides',()=>{
 const hit={kind:'part',p:p.slice(),n:C.norm([.4,.3,.8])},axis=C.norm([hit.n[0],0,hit.n[2]]);
 for(const side of ['fore','aft','port','stbd']){const part=draft('vertical',hit,side).part,depth=['fore','aft'].includes(side)?180:110;
  assert.equal(part.c[1],hit.p[1]);for(const i of [0,2])assert.ok(Math.abs(part.c[i]-hit.p[i]-axis[i]*depth*.3)<1e-10);
  assert.equal(part.pitch,0);assert.equal(part.roll,0);assert.equal(part.surfaceNormal,undefined);
  const local={fore:[1,0,0],aft:[-1,0,0],port:[0,0,-1],stbd:[0,0,1]}[side],f=C.structFrame(part),world=C.add(C.mul(f.fw,local[0]),C.mul(f.rt,local[2]));assert.ok(C.dot(world,axis)<-.999999,'the selected side faces the parent');
 }
});
test('underside horizontal and surface drafts keep their separate frame contracts',()=>{
 const hit={kind:'part',p:p.slice(),n:C.mul(n,-1)},underside=draft('horizontal',hit,'top').part;assert.deepEqual(Array.from(underside.c),[p[0],p[1]-18,p[2]]);
 const surface=draft('surface',{...hit,n:n.slice()}).part;assert.ok(C.dot(C.structFrame(surface).up,n)>.999999,'surface mode still follows the selected normal');
 const T=C.structTriangles(surface),distance=[];for(let i=0;i<T.length;i+=3)distance.push(C.dot(C.sub(Array.from(T.slice(i,i+3)),p),n));assert.ok(Math.abs(Math.min(...distance))<1e-4,'surface mode retains its existing whole-body mounting contract');
});
