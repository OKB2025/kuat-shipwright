const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx),KEYS=['mc30c','mc75','mc80home','mc80liberty'],GROUPS={mc30c:[1,4],mc75:[6,6],mc80home:[5,5],mc80liberty:[4,5]},plain=value=>JSON.parse(JSON.stringify(value)),near=(a,b,label)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=Math.max(1,Math.abs(a),Math.abs(b))*1e-9,label+': '+a+' != '+b);
function cylinderSamples(core){const f=C.frameAxis(core.dir),out=[];for(const t of [0,.125,.25,.5,.75,.875,1]){const centre=C.add(core.c,C.mul(f.u,core.length*(t-.5)));out.push(centre);for(const fraction of [.5,1])for(let j=0;j<64;j++)out.push(C.add(centre,C.add(C.mul(f.v,Math.cos(j*Math.PI/32)*core.d/2*fraction),C.mul(f.w,Math.sin(j*Math.PI/32)*core.d/2*fraction))));}return out;}
function verify(C,ship,key){
 const cores=ship.parts.filter(p=>p.k==='engineCore'),nozzles=ship.parts.filter(p=>p.k==='engine');
 assert.deepEqual(plain(cores.map(core=>nozzles.filter(n=>n.machineryId===core.id).length).sort((a,b)=>a-b)),GROUPS[key],key+' uses the physically approved compact groups');
 for(const core of cores){
  const spec=C.resolveEngineSpec(core,ship),outlets=nozzles.filter(n=>n.machineryId===core.id),volume=Math.PI*(core.d/2)**2*core.length;
  assert.equal(spec.valid,true);assert.equal(spec.machineryGradeId,'standard');near(spec.densityFactor,1,key+' ordinary density');near(spec.wasteFraction,.05,key+' actual conversion loss');near(C.partVolume(core),volume,key+' the complete paid cylinder remains installed');near(core.ratedInputW,volume*3.4e17,key+' input is bought with physical volume');
  for(const point of cylinderSamples(core))assert.equal(C.insideOriginalEnvelope(ship,point),true,key+' machinery stays inside the real hull');
  const expected=outlets[0].nozzleShare/(outlets[0].d**2);near(outlets.reduce((n,p)=>n+p.nozzleShare,0),core.ratedInputW,key+' outlets count their source exactly once');
  for(const nozzle of outlets){
   near(nozzle.nozzleShare/nozzle.d**2,expected,key+' each merged group retains diameter-squared output weights');
   const shaft=spec.ratedShaftPowerW*nozzle.nozzleShare/core.ratedInputW;
   assert.ok(shaft<=C.nozzleShaftCapacity(nozzle)*(1+1e-9),key+' the real small nozzle cannot receive a main-nozzle-sized shaft load');
  }
 }
 assert.ok(nozzles.every(n=>C.engineOwner(n,ship)?.k==='engineCore'),'every visible outlet has a real installed owner');
 return cores;
}
for(const key of KEYS)test(key+' buys its stock propulsion through installed ordinary bodies and preserves source output',()=>{
 const ship=C.SHIP_EXAMPLES[key].build({stage:'machinery'}),source=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'assets/source/ship-example-blueprints',key+'.json.gz'))));
 // Include the actual retained gun/capacitor and turret-room obstacles. Route
 // physics run on the separately audited completed factory, not this fixture.
 ship.fits=plain(source.fits);ship.nextId=Math.max(ship.nextId,...ship.parts.map(p=>p.id+1),...ship.fits.map(p=>p.id+1));ship._propulsionRoutingDeferred=true;
 const positions=new Map(ship.parts.map(p=>[p.id,plain(p.c)])),power=ship.parts.filter(C.isReactor).reduce((n,p)=>n+C.reactorPower(p),0),shield=ship.parts.filter(p=>p.k==='shield').reduce((n,p)=>n+C.shieldLoad(p),0),mouths=ship.parts.filter(p=>p.k==='engine').map(p=>({id:p.id,d:p.d,dir:plain(p.dir),mouth:C.add(p.c,C.mul(C.norm(p.dir),C.partDims(p).l/2))}));
 C.refitShipPropulsion(ship,key);verify(C,ship,key);
 const occupied=C.allOccupied(ship).filter(p=>!C.isShapePart(p)&&!C.flexibleCompartment(ship,p));
 for(const part of ship.parts.filter(p=>positions.has(p.id)&&!C.isShapePart(p)&&p.k!=='engine'&&!C.flexibleCompartment(ship,p)&&p.c.some((v,i)=>v!==positions.get(p.id)[i]))){
  for(const other of occupied)if(other.id!==part.id)assert.equal(C.overlapParts(part,other),false,key+' relocated '+part.k+' #'+part.id+' clears actual hardware/charging #'+other.id);
 }
 near(ship.parts.filter(C.isReactor).reduce((n,p)=>n+C.reactorPower(p),0),power,'actual finite reactor output remains unchanged');near(ship.parts.filter(p=>p.k==='shield').reduce((n,p)=>n+C.shieldLoad(p),0),shield,'installed shield capacity remains unchanged');
 for(const old of mouths){const p=ship.parts.find(p=>p.id===old.id);near(p.d,old.d,'the authored aperture is retained');assert.deepEqual(plain(p.dir),old.dir);const mouth=C.add(p.c,C.mul(C.norm(p.dir),C.partDims(p).l/2));for(let i=0;i<3;i++)near(mouth[i],old.mouth[i],'the authored nozzle mouth is retained');}
});
test('loading existing Mon Calamari saves preserves the machinery their owners actually saved',()=>{
 const fields=['id','k','c','d','dir','length','machineryId','ratedInputW','machineryGradeId','nozzleShare'],hardware=ship=>plain(ship.parts.filter(p=>p.k==='engine'||p.k==='engineCore').map(p=>Object.fromEntries(fields.filter(k=>Object.hasOwn(p,k)).map(k=>[k,p[k]]))));
 for(const key of KEYS){const old=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'assets/source/ship-example-blueprints',key+'.json.gz'))));assert.deepEqual(hardware(C.deserialize(plain(old))),hardware(old),key+' stock-only changes cannot resize a saved user design');}
});
const stagePrefix=process.env.KS_MONCAL_ENGINE_STAGE_PREFIX;
test('all four completed Mon Calamari examples obtain 2100 G from actual volume and completed physical mass',{skip:!stagePrefix},()=>{
 for(const key of KEYS){const directory=stagePrefix+'-'+key,ship=JSON.parse(fs.readFileSync(path.join(directory,'blueprints',key+'.json'))),audit=JSON.parse(fs.readFileSync(path.join(directory,'audit.json'))),row=audit.models.find(row=>row.key===key),cores=verify(C,ship,key),force=cores.reduce((n,p)=>n+C.partVolume(p)*1.7e8,0),g=force/(row.massT*1000*9.80665);assert.ok(Math.abs(g-2100)<=.2,key+' physical 2100 G target: '+g);near(cores.reduce((n,p)=>n+C.resolveEngineSpec(p,ship).ratedThrustN,0),force,key+' the catalogue uses the unchanged ordinary force law');}
});
