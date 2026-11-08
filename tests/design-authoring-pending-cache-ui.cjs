const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),{C}=require('../scripts/update-ship-examples.cjs').loadRuntime(root);
const raw=value=>JSON.stringify(value,(key,item)=>key.startsWith('_')?undefined:item);
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return source.slice(a,b);}
function fixture({failed=false}={}){
 const ship=C.newShip({L:60,W:40,H:10,assembly:true},'Pending authoring cache');
 ship.parts=[{id:1,k:'struct',form:'box',c:[0,0,0],s:[40,40,10]}];ship.fits=[];ship.nextId=2;ship.saveId='pending-authoring-source';
 const input={id:ship.nextId++,k:'struct',form:'box',c:[failed?1000:0,6,0],s:[8,8,4]},prepared=C.preparePlacementDraft(ship,input,{mode:'horizontal',position:input.c.slice(),contactFit:'cut',parentStructureId:1,geometryRevision:1,hit:{p:[0,5,0],n:[0,1,0],face:'top',kind:'part'}});
 assert.equal(prepared.ok,true);ship.parts.push(prepared.part);
 if(failed){C.refreshPlacementGeometry(ship);assert.equal(ship.parts[1].placement.validationFailed,true,'the real Core solver produces the failed source metadata');}
 ship._client=true;
 const eng={gen:4,adoptedGen:3,geoGen:3,statsGen:3,designGen:1,ready:true},context=vm.createContext({console,C,ship,eng,S:null,view:{},meshStore:{},dirty:{},editorBounds:{},editorCraft:{},editorPartsRevision:0,requestDraw(){}});
 vm.runInContext('function enginePending(){return eng.adoptedGen<eng.gen;}',context);
 vm.runInContext(section('const requestedParts =','function enginePickParts('),context);
 return{ship,eng,context,run:text=>vm.runInContext(text,context),part:ship.parts[1]};
}
function authoringPacket(ship,gen){
 const sourceState=raw(ship),worker=JSON.parse(sourceState),parts={};
 for(const part of worker.parts){part._solidCutShip=worker;C.structTriangles(part);const cache={};for(const[key,value]of Object.entries(part))if(key.startsWith('_')&&key!=='_solidCutShip')cache[key]=value;cache._solidCutShip={$r:'ship'};parts[part.id]=cache;}
 return structuredClone({type:'authoringGeometry',gen,sourceState,caches:{ship:{},items:{parts,fits:{},hatches:{}},geoProxy:{hull:C.hullGeo(worker),ref:C.referenceHullGeometry(worker)}}});
}
for(const failed of [false,true])test(`${failed?'failed':'pending'} immediate parts accept an authoring cache packet without confusing draft proxies with owned-hull records`,()=>{
 const f=fixture({failed}),part=f.part,id=part.id,before=raw(f.ship),stage=C.placementDraftStatus(f.ship),statsGen=f.eng.statsGen,adoptedGen=f.eng.adoptedGen;
 f.context.part=part;
 const proxy=f.run('requestedPart(part)');
 assert.notEqual(proxy,part);assert.equal(f.run('requestedParts.records.has(part.id)'),false,'immediate draft proxies use their separate WeakMap');
 f.context.packet=authoringPacket(f.ship,f.eng.gen);
 assert.equal(f.run('onEngineAuthoringGeometry(packet)'),true,'the actual authored mesh packet must not require an owned-hull record for a draft');
 assert.equal(f.ship.parts[1],part,'the live editable object and its stable ID survive cache adoption');assert.equal(part.id,id);assert.equal(raw(f.ship),before,'an authoring packet changes only derived fields');
 assert.equal(f.run('requestedPart(part).id'),id);assert.equal(f.run('requestedParts.records.has(part.id)'),false);
 assert.equal(C.placementDraftStatus(f.ship).ready,false,'rendering the requested mesh does not validate its contact or performance');
 assert.deepEqual(C.placementDraftStatus(f.ship).pending,stage.pending);assert.deepEqual(C.placementDraftStatus(f.ship).failed,stage.failed);
 assert.equal(f.eng.statsGen,statsGen);assert.equal(f.eng.adoptedGen,adoptedGen);assert.equal(f.run('S'),null);
 assert.equal(part.placement[failed?'validationFailed':'pendingGeometry'],true);
});
