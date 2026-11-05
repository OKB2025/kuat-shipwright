const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const {figuresDigest,figuresDiff}=require('./helpers/figures-digest.cjs');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance,__reportCalls:0,__forbidReport:false});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js']){
 let source=fs.readFileSync(path.join(root,file),'utf8');if(file==='js/core.js'){
  const start='function surfaceReport(ship){';assert.ok(source.includes(start));source=source.replace(start,start+"globalThis.__reportCalls++;if(globalThis.__forbidReport)throw Error('new-design setup built an unused report');");
 }vm.runInContext(source,cx,{filename:file});
}
const C=vm.runInContext('Core',cx),plain=x=>JSON.parse(JSON.stringify(x));
function authored(s){const fields=['id','authored','functionMode','powerDomain','armor','equipment','battery','style','allocation','boundArea','legacyAllocation'];return plain({hull:s.hull,armor:s.armor,version:s.surfaces.version,mode:s.surfaces.mode,legacyArmor:s.surfaces.legacyArmor,compatAllowed:s.surfaces.compatAllowed,patches:s.surfaces.patches.map(p=>Object.fromEntries(fields.filter(k=>Object.hasOwn(p,k)).map(k=>[k,p[k]])))});}
test('new hulls and craft can defer the unused report without changing authored controls or derived figures',()=>{
 for(const [kind,craft]of [['wedge',false],['block',false],['cyl',false],['block',true]]){
  const make=()=>{const s=C.newShip({...C.HULLS[kind],L:craft?18:80,W:craft?12:40,H:craft?6:24},'New design');s.armor.hull=craft?.01:.75;if(craft)s.shipClass='starfighter';return s;},eager=make(),deferred=make();
  const full=C.enableSurfaceMode(eager,true);assert.ok(full.ok&&full.report);assert.equal(eager.surfaces.mode,'strict');assert.equal(eager.surfaces.compatAllowed,false);const before=cx.__reportCalls;cx.__forbidReport=true;let lean;
  try{lean=C.enableSurfaceMode(deferred,true,{report:false});}finally{cx.__forbidReport=false;}
  assert.equal(lean.ok,true);assert.equal(Object.hasOwn(lean,'report'),false);assert.equal(cx.__reportCalls,before);assert.deepEqual(authored(deferred),authored(eager),kind+' initial authored settings');assert.equal(deferred.surfaces.legacyArmor,craft?.01:.75);
  // The normal worker derivation compiles the same aggregate ledger later.
  const A=C.computeStats(eager),B=C.computeStats(deferred);assert.deepEqual(figuresDiff(figuresDigest(A),figuresDigest(B)),[],kind+' derived figures');assert.deepEqual(JSON.parse(C.publicJSON(deferred)),JSON.parse(C.publicJSON(eager)),kind+' public state after derivation');assert.deepEqual(plain(C.surfaceReport(deferred)),plain(C.surfaceReport(eager)),kind+' worker report');
 }
});
test('report options preserve strict-only cooling and the ordinary report API',()=>{
 const s=C.newShip({...C.HULLS.block,L:40,W:30,H:15},'Strict new hull');C.enableSurfaceMode(s,true,{report:false});assert.equal(s.surfaces.mode,'strict');assert.equal(s.surfaces.compatAllowed,false);
 const before=authored(s),count=cx.__reportCalls;cx.__forbidReport=true;let denied;try{denied=C.enableSurfaceMode(s,false,{report:false});}finally{cx.__forbidReport=false;}
 assert.equal(denied.ok,false);assert.equal(s.surfaces.mode,'strict');assert.equal(cx.__reportCalls,count);assert.deepEqual(authored(s),before);
 const ordinaryDenied=C.enableSurfaceMode(s,false);assert.equal(ordinaryDenied.ok,false);assert.equal(cx.__reportCalls,count);assert.deepEqual(authored(s),before,'requesting an ordinary report cannot bypass strict cooling or mutate the design');
 const ordinary=C.enableSurfaceMode(s,true);assert.ok(ordinary.ok&&ordinary.report);assert.equal(ordinary.report.mode,'strict');
});
