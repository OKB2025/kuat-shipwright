const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
function runtime(withLayout=true){
 const cx=vm.createContext({console,performance});
 for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js']){
  let code=fs.readFileSync(path.join(root,file),'utf8');
  if(!withLayout&&file==='data/imperial2.js'){const start=code.indexOf('const IMPERIAL_USER_LAYOUT=');assert.ok(start>0);code=code.slice(0,start);}
  vm.runInContext(code,cx,{filename:file});
 }
 return {C:vm.runInContext('Core',cx),source:withLayout?vm.runInContext('IMPERIAL_USER_LAYOUT',cx):null};
}
const {C,source}=runtime(),plain=value=>value===undefined?undefined:JSON.parse(C.publicJSON(value)),normalized=C.deserialize(plain(source));
const shapes=ship=>plain(ship.parts.filter(C.isShapePart)),near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(b))*1e-8,`${a} != ${b}`);
const layoutFields=['hull','cuts','trenches','solidCuts','subs','hatches','armor','shieldTarget','surfaces','designEnvelope'];
// The only authorized structural correction removes the one-centimetre
// engine-bay sheet while keeping the upper opening boundary unchanged.
function expectedShapes(){const out=shapes(normalized),cut=out.find(p=>p.id===178).hullData.solidCuts.find(c=>c.id===2);assert.equal(cut.c[1],202.53);assert.equal(cut.s[2],127.05);cut.c[1]=202.52;cut.s[2]=127.07;return out;}

test('Imperial I and II are distinct selectable examples with the same explicit military complement',()=>{
 for(const [key,name]of [['imperial','インペリアルI級'],['imperial2','インペリアルII級']]){
  assert.equal(C.DESIGNS[key].name,name);assert.equal(C.SHIP_EXAMPLES[key].name,name);assert.equal(C.SHIP_EXAMPLES[key].side,'銀河帝国');assert.equal(C.SHIP_EXAMPLES[key].role,'重砲戦艦');assert.ok(C.SHIP_SYSTEM_REFIT_KEYS.includes(key));
  assert.equal(C.SHIP_EXAMPLES[key].build().reference,key);assert.equal(C.SHIP_EXAMPLES[key].build().name,name+'｜重砲戦艦');
 }
 assert.deepEqual(plain(C.builtinComplement('imperial2')),plain(C.builtinComplement('imperial')));
});

test('both recipes preserve the supplied structures with only the declared engine-bay seam correction',()=>{
 assert.equal(shapes(normalized).length,26);
 for(const key of ['imperial','imperial2']){
  const ship=C.SHIP_EXAMPLES[key].build();assert.deepEqual(shapes(ship),expectedShapes());
  for(const field of layoutFields)assert.deepEqual(plain(ship[field]),plain(normalized[field]),key+' keeps '+field);
  const hull=ship.parts.find(p=>p.primaryHull);assert.equal(hull.id,178);assert.equal(hull.form,'hull');
  assert.ok(!ship.parts.some(p=>[21,22,23,24,25,31,32,33,34,35].includes(p.id)),'removed gun-deck edge structures stay removed');
 }
});

test('all fifty-one supplied fitting poses are retained while only the eight I-class main gun kinds change',()=>{
 for(const key of ['imperial','imperial2']){
  const ship=C.SHIP_EXAMPLES[key].build(),expected=plain(normalized.fits);assert.equal(ship.fits.length,51);
  if(key==='imperial')for(const f of expected)if(f.id>=107&&f.id<=114)f.k=f.id<=108?'ion':'stl';
  const authored=list=>plain(list).map(f=>{if(key==='imperial'&&f.id>=107&&f.id<=114){const old=expected.find(q=>q.id===f.id);f.p=f.p.map((v,i)=>{assert.ok(Math.abs(v-old.p[i])<1e-7,'only floating-point surface projection may adjust the mount centre');return old.p[i];});for(const field of ['base','low','slope','float','mountSupport'])delete f[field];}return f;});
  assert.deepEqual(authored(ship.fits),authored(expected),key+' keeps every authored fitting pose while refreshing changed automatic supports');
  const counts=Object.fromEntries([...new Set(ship.fits.map(f=>f.k))].map(k=>[k,ship.fits.filter(f=>f.k===k).length]));
  assert.deepEqual(counts,key==='imperial'?{podHangar:1,ion:2,stl:6,podAir:1,triple40:9,pd:20,trc:10,quad70Side:2}:{podHangar:1,oct40:8,podAir:1,triple40:9,pd:20,trc:10,quad70Side:2});
  for(const id of [179,180,181,182,183,184,185,186])assert.ok(ship.fits.some(f=>f.id===id));
 }
});

test('changed I-class main guns have current physical supports before the engineering refit starts',()=>{
 const ship=C.SHIP_EXAMPLES.imperial.build();
 for(const f of ship.fits.filter(f=>f.id>=107&&f.id<=114)){
  const old=normalized.fits.find(q=>q.id===f.id),geometry=C.turretSupportGeometry(f);assert.equal(f.float,false);assert.ok(geometry?.volume>0);assert.notDeepEqual(plain(f.mountSupport),plain(old.mountSupport),'the octuple support cannot be reused for '+f.k);
  const clean=plain(f);delete clean.mountSupport;clean.base=clean.low=clean.slope=0;C.mountFit(ship,clean);
  assert.equal(f.mountSupport.version,clean.mountSupport.version);near(f.mountSupport.top,clean.mountSupport.top);assert.deepEqual(plain(f.mountSupport.polys.map(p=>p.length)),plain(clean.mountSupport.polys.map(p=>p.length)));
  f.mountSupport.polys.forEach((poly,i)=>poly.forEach((point,j)=>point.forEach((v,a)=>assert.ok(Math.abs(v-clean.mountSupport.polys[i][j][a])<1e-7,'the constructor support matches a fresh actual mount'))));near(f.base,clean.base);near(f.low,clean.low);near(f.slope,clean.slope);f.p.forEach((v,i)=>assert.ok(Math.abs(v-old.p[i])<1e-7));
 }
});

test('old individual machinery and stale circuits are retired only in the new stock recipe while nozzle mouths and plants stay authored',()=>{
 const appearance=p=>plain(Object.fromEntries(['id','c','d','dir','nozzleLength','skinAsset','skinAnchor','skinDiameter','bodyLength','bodyRadius'].filter(k=>p[k]!==undefined).map(k=>[k,p[k]]))),power=s=>s.parts.filter(C.isReactor).reduce((n,p)=>n+C.reactorPower(p),0),shield=s=>s.parts.filter(p=>p.k==='shield'||p.k==='localShield').reduce((n,p)=>n+C.shieldLoad(p),0);
 assert.equal(normalized.parts.filter(p=>p.k==='engineCore').length,7);assert.ok(normalized.links.length>0);
 for(const key of ['imperial','imperial2']){
  const ship=C.SHIP_EXAMPLES[key].build();assert.equal(ship.parts.filter(p=>p.k==='engineCore').length,0,'current stock refit must create the three shared bodies');assert.deepEqual(plain(ship.links),[]);
  assert.deepEqual(plain(ship.parts.filter(p=>p.k==='engine').map(appearance)),plain(normalized.parts.filter(p=>p.k==='engine').map(appearance)));
  assert.ok(ship.parts.filter(p=>p.k==='engine').every(p=>p.machineryId==null&&p.nozzleShare==null));near(power(ship),power(normalized));near(shield(ship),shield(normalized));near(power(ship),1e25);near(shield(ship),1e26);
  const reactorHardware=p=>{const q=plain(p);if(q.id===59)delete q.c;return q;};
  assert.deepEqual(plain(ship.parts.filter(C.isReactor).map(reactorHardware)),plain(normalized.parts.filter(C.isReactor).map(reactorHardware)),'the enlarged engine may relocate reserve reactor59 while keeping every reactor and its generating hardware');
  const reserve=ship.parts.find(p=>p.id===59);assert.equal(C.insideOriginalEnvelope(ship,reserve.c),true,'the relocated reserve reactor remains inside the real ship');
  assert.deepEqual(plain(ship.airWings),[]);assert.deepEqual(plain(ship.groundForces),[]);
 }
 // This is a new-stock construction policy, never a migration of user saves.
 const loaded=C.deserialize(plain(source));assert.equal(loaded.parts.filter(p=>p.k==='engineCore').length,7);assert.deepEqual(plain(loaded.links),plain(normalized.links));
});

test('creating either variant cannot mutate the immutable common source or another fresh recipe',()=>{
 const before=JSON.stringify(source),a=C.SHIP_EXAMPLES.imperial.build(),b=C.SHIP_EXAMPLES.imperial2.build();a.parts[0].c[0]+=100;a.fits[0].p[0]+=100;
 assert.equal(JSON.stringify(source),before);assert.deepEqual(shapes(b),expectedShapes());assert.deepEqual(plain(b.fits),plain(normalized.fits));assert.deepEqual(shapes(C.SHIP_EXAMPLES.imperial.build()),expectedShapes());
});

test('missing supplied data fails explicitly instead of reviving the obsolete Imperial II builder',()=>{
 const {C:missing}=runtime(false);for(const key of ['imperial','imperial2'])assert.throws(()=>missing.SHIP_EXAMPLES[key].build(),/配置図面がありません/);
});
