const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance,__snapshotCalls:{},__forbidSnapshot:false});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js']){
 let source=fs.readFileSync(path.join(root,file),'utf8');if(file==='js/core.js')for(const fn of ['craftPowerProfile','craftGunMounts']){
  const pattern=new RegExp('function '+fn+'\\(([^)]*)\\)\\{');assert.match(source,pattern);source=source.replace(pattern,(s,args)=>s+`globalThis.__snapshotCalls.${fn}=(globalThis.__snapshotCalls.${fn}||0)+1;if(globalThis.__forbidSnapshot)throw Error('summary built ${fn}');`);
 }vm.runInContext(source,cx,{filename:file});
}
const C=vm.runInContext('Core',cx),plain=x=>JSON.parse(JSON.stringify(x));
test('the editor combat summary retains every displayed value and skips both tactical snapshots',()=>{
 const s=C.newShip({L:20,W:12,H:6},'Summary fighter');s.shipClass='starfighter';s.fits=[{id:1,k:'claser',p:[5,3,0],a:0,ped:0,base:0,low:0,float:false},{id:2,k:'ctorp',p:[5,3,1],a:0,ped:0,base:0,low:0,float:false}];s.nextId=3;
 const stats=C.computeStats(s);cx.__snapshotCalls={};const full=C.craftCombat(s,stats);assert.ok(full.powerProfile&&Array.isArray(full.fireArcs));assert.equal(cx.__snapshotCalls.craftPowerProfile,1);assert.equal(cx.__snapshotCalls.craftGunMounts,1);
 cx.__forbidSnapshot=true;let summary;try{summary=C.craftCombat(s,stats,{summaryOnly:true});}finally{cx.__forbidSnapshot=false;}
 const expected=plain(full);delete expected.powerProfile;delete expected.fireArcs;assert.deepEqual(plain(summary),expected);assert.equal(cx.__snapshotCalls.craftPowerProfile,1);assert.equal(cx.__snapshotCalls.craftGunMounts,1);assert.equal(summary.stations.length,1);assert.ok(summary.ord.length>0);
 const again=C.craftCombat(s,stats);assert.ok(again.powerProfile&&Array.isArray(again.fireArcs),'ordinary combat snapshots remain complete');
});
