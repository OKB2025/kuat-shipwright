const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(path.resolve(__dirname,'..'));
const app=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
function fn(name){const start=new RegExp('function '+name+'\\s*\\(').exec(app);assert.ok(start,name);for(let i=app.indexOf('}',start.index);i>=0;i=app.indexOf('}',i+1)){const source=app.slice(start.index,i+1);try{new vm.Script(source);return source;}catch{}}assert.fail('complete '+name);}
function draft(shape,parent={id:1,k:'struct',form:'box',c:[0,0,0],s:[30,20,10]},template=null){
 const ship=C.newShip({assembly:true,L:30,W:20,H:10},'Native canopy draft');ship.parts=[parent];ship.fits=[];ship.nextId=2;
 const hit={kind:'structure',p:C.worldStruct(parent,[0,5,4]),n:C.structFrame(parent).up};
 const context=vm.createContext({C,ship,st:{part:'cockpit',canopyGeometry:shape,alignment:'none'},activeEquipment:()=>null,pSize:()=>1.6,activeTemplate:()=>template,designPlacementActive:()=>false});
 for(const name of ['extentAlong','unalignedPartPreview','partPreview'])vm.runInContext(fn(name),context);
 context.hit=hit;const part=vm.runInContext('partPreview(hit)',context);
 return {ship,parent,hit,part};
}
function checkSurface(row){
 const {ship,parent,hit,part}=row,n=C.norm(hit.n),tris=C.canopyTriangles(part),distances=[];
 for(let i=0;i<tris.length;i+=3)distances.push(C.dot(C.sub(Array.from(tris.slice(i,i+3)),hit.p),n));
 assert.ok(Math.abs(Math.min(...distances))<1e-5,'actual draft geometry rests on the tapped plane');
 const result=C.solvePlacement(ship,part,{mode:'direct',parentStructureId:parent.id,hit,geometryRevision:1});
 assert.equal(result.ok,true,result.error);assert.equal(result.contact.connected,true);
 assert.equal(C.acceptPlacementResult(ship,result).ok,true);
 const copy=C.deserialize(C.serialize(ship)),saved=copy.parts.find(p=>p.k==='cockpit');
 for(let i=0;i<3;i++)assert.ok(Math.abs(saved.c[i]-part.c[i])<=1e-9*Math.max(1,Math.abs(part.c[i])),'strict placement preserves the native preview pose within coordinate precision');
 assert.deepEqual(JSON.parse(JSON.stringify(saved.canopy)),JSON.parse(JSON.stringify(part.canopy)),'real dimensions survive strict placement and reload');
 assert.equal(C.placementDiagnostics(copy).find(p=>p.partId===saved.id).connected,true);
}
test('native catalogue drafts seat short and tall canopy shapes using their real dimensions',()=>{
 for(const form of ['box','trap','ellipsoid'])for(const height of [1,4])checkSurface(draft({form,size:[4,2,height],taper:.15}));
});
test('native canopy drafts use the actual rotated parent surface rather than the default sphere extent',()=>{
 for(const form of ['box','trap','ellipsoid'])checkSurface(draft({form,size:[4,2,1],taper:.15},{id:1,k:'struct',form:'box',c:[50,12,-7],s:[30,20,10],pitch:18,roll:12,yaw:24}));
});
test('copied canopy geometry uses its own shape when the current catalogue size differs',()=>{
 const template={data:{k:'cockpit',d:8,seats:2,suit:true,canopy:{form:'box',size:[5,2,1],taper:0}}};
 const row=draft({form:'ellipsoid',size:[1.6,1.6,1.6],taper:0},undefined,template);
 assert.deepEqual(JSON.parse(JSON.stringify(row.part.canopy)),template.data.canopy);
 checkSurface(row);
});
