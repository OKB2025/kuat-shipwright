const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
function runtime(){
 const context=vm.createContext({console});context.surveyCount=0;
 for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js']){
  let source=fs.readFileSync(path.join(root,file),'utf8');
  if(file==='js/core.js')source=source.replace('function surfacePatches(ship,structuralOnly=false,defaultsOnly=false){','function surfacePatches(ship,structuralOnly=false,defaultsOnly=false){globalThis.surveyCount++;');
  vm.runInContext(source,context,{filename:file});
 }
 return {C:vm.runInContext('Core',context),context};
}
function fixture(C){
 const ship=C.newShip({L:160,W:100,H:80,assembly:true},'Empty equipment ledger');ship.parts=[];ship.fits=[];ship.armor={hull:0,cit:0};
 const host=C.placePart(ship,'struct',[80,40,0],[100,60,40],{form:'box'});
 C.placePart(ship,'gen',[80,40,0],8);ship.surfaces=C.normalizeSurfaces({mode:'strict',armorOnly:1,legacyArmor:.1,patches:[]});
 return {ship,host};
}
test('an empty equipment ledger does not survey every face to derive zero devices',()=>{
 const {C,context}=runtime(),{ship}=fixture(C);context.surveyCount=0;
 assert.equal(C.allOccupied(ship).length,1);assert.equal(C.surfaceDerivedFits(ship).length,0);
 const saved=C.serialize(ship);assert.equal(saved.surfaces.patches.length,0);assert.equal(context.surveyCount,0);
 const first=C.surfaceWorkingShip(ship),reactor=ship.parts.find(p=>p.k==='gen');reactor.c[0]+=3;
 const second=C.surfaceWorkingShip(ship);assert.notEqual(second,first);assert.equal(second.parts.find(p=>p.id===reactor.id).c[0],83);assert.equal(context.surveyCount,0);
 const stats=C.computeStats(ship);assert.ok(context.surveyCount>0,'physical armor and final face reports still perform the real survey');assert.ok(stats.mass>0&&stats.power>0);
});
test('authored face armor still surveys its real face and survives save/load',()=>{
 const {C,context}=runtime(),{ship,host}=fixture(C),patch=C.surfacePatches(ship).find(p=>p.host==='p'+host.id&&p.exposed),before=C.computeStats(ship);
 const configured=C.setSurfaceConfig(ship,patch.id,{functionMode:'armor',armor:{material:'standard',thickness:.3}});assert.equal(configured.ok,true);
 ship.parts.find(p=>p.k==='gen').c[0]+=1;context.surveyCount=0;C.surfaceDerivedFits(ship);assert.ok(context.surveyCount>0,'a nonempty ledger follows the normal face path');
 const stats=C.computeStats(ship);assert.ok(stats.mass>before.mass);const loaded=C.deserialize(C.serialize(ship)),after=C.computeStats(loaded);
 assert.equal(after.mass,stats.mass);assert.equal(C.surfaceConfig(loaded,patch.id).armor.thickness,.3);
});
