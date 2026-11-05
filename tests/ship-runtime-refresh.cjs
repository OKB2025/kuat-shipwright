const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {loadRuntime,exampleKeys,generateEntry,compactCatalogProfile,createPatch,mergePatches,parseArgs}=require('../scripts/update-ship-examples.cjs');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
function fixture(){
 const sources={'js/core.js':'source-sha'},calls=[],blueprint={format:'starship-yard',parts:[{k:'engine',diameter:12}]};
 const profile={profileVersion:15,name:'Physical ship',mass:30,propulsion:{massKg:30000,engines:[{id:1,ratedInputW:8e21,wattsPerNewton:2e9,valid:true,available:true}]},modules:[{k:'engine',part:1},{k:'weapon',fit:2,weaponPowerW:4e22}],grid:{P:2e22,powerPaths:[{from:'p3',to:'p1',cap:1e22,ok:true}]},heat:{v:1,src:[{id:'p1',k:'engine',st:1e23}],dis:[{id:'p4',k:'hdis',cap:3e21}],ln:[{s:0,d:0,cap:3e21}]},surface:{v:4,triangles:Array.from({length:4096},(_,i)=>i*.125),cells:[{id:'patch-1',volume:12}]}};
 const previous={key:'test',name:'Fleet display name',faction:'cis',side:'CIS',paint:'cis',p:{profileVersion:8},info:{mass:3,cost:10},air:[{type:'vulture',count:4}],ground:[{kind:'troops',count:2}]};
 const C={DESIGNS:{test:{name:'Test'}},SHIP_EXAMPLES:{test:{}},FLEET_PROFILE_VERSION:15,COST_MODEL:{version:15},costModelSignature:()=> 'cost-v15',
  buildDesign:key=>{calls.push(['build',key]);return {name:'Physical ship',paint:'cis'};},syncCompartments:()=>calls.push(['sync']),remount:()=>calls.push(['remount']),
  computeStats:()=>({mass:30,cost:100,crew:2,cls:{name:'Current class'}}),fleetProfile:()=>profile,serialize:()=>blueprint,builtinComplement:()=>null};
 const R={designInfo:(stats,p)=>({mass:stats.mass,cost:stats.cost,len:100,crew:stats.crew,profileVersion:p.profileVersion})};
 return {sources,calls,blueprint,previous,profile,C,R};
}
test('generated fleet rows use the mounted physical model and retain fleet identity and optional complement',()=>{
 const f=fixture(),entry=generateEntry(f.C,f.R,'test',f.previous,f.sources);
 assert.deepEqual(f.calls,[['build','test'],['sync'],['remount'],['sync']]);
 assert.equal(entry.name,'Fleet display name');assert.equal(entry.faction,'cis');assert.equal(entry.side,'CIS');assert.deepEqual(entry.air,f.previous.air);assert.deepEqual(entry.ground,f.previous.ground);
 assert.equal(entry.p.profileVersion,15);assert.equal(entry.info.mass,30);assert.equal(entry.info.cost,100);assert.equal(entry.cls,'Current class');assert.equal(entry.model.costVersion,15);assert.equal(entry.model.costSignature,'cost-v15');assert.match(entry.model.blueprintSha256,/^[a-f0-9]{64}$/);
 f.blueprint.parts[0].diameter=14;assert.notEqual(generateEntry(f.C,f.R,'test',f.previous,f.sources).model.blueprintSha256,entry.model.blueprintSha256);
 assert.equal(f.previous.p.profileVersion,8,'generation must not mutate the old catalogue');
});

test('compact catalogue profiles remove only surface geometry and preserve all engineering and combat fields',()=>{
 const f=fixture(),before=JSON.parse(JSON.stringify(f.profile)),compact=compactCatalogProfile(f.profile),expected={...before,catalogOnly:true};delete expected.surface;
 assert.deepEqual(compact,expected);assert.notEqual(compact,f.profile);assert.deepEqual(f.profile,before,'compacting must not change the physical source profile');assert.ok(f.profile.surface.triangles.length>4000);assert.equal(Object.hasOwn(compact,'surface'),false);assert.equal(compact.catalogOnly,true);assert.deepEqual(compactCatalogProfile(compact),compact,'compaction is semantically idempotent');
});
test('generated compact entries keep the complete physical profile in the audit callback without mutation',()=>{
 const f=fixture(),before=JSON.parse(JSON.stringify(f.profile));let built;
 const entry=generateEntry(f.C,f.R,'test',f.previous,f.sources,{onBuilt:value=>{built=value;}});
 assert.equal(entry.p.catalogOnly,true);assert.equal(Object.hasOwn(entry.p,'surface'),false);assert.deepEqual(entry.p,compactCatalogProfile(before));assert.ok(JSON.stringify(entry).length<JSON.stringify(before).length*.3,'checkpoint entries omit the large surface payload');
 assert.equal(built.profile,f.profile,'audit receives the original full physical profile');assert.deepEqual(built.profile,before);assert.equal(built.entry,entry);assert.equal(built.blueprint,f.blueprint);assert.deepEqual(f.profile,before);assert.equal(Object.hasOwn(f.profile,'catalogOnly'),false);
});
test('legacy full-surface patches merge to the same compact entry without false conflicts or patch mutation',()=>{
 const f=fixture(),entry=generateEntry(f.C,f.R,'test',f.previous,f.sources),data={version:1,designs:{test:f.previous,unselected:{key:'unselected',p:{profileVersion:8}}}},compactPatch=createPatch(f.C,{test:entry},f.sources,'baseline-git-sha'),fullEntry={...entry,p:JSON.parse(JSON.stringify(f.profile))},fullPatch={...compactPatch,entries:{test:fullEntry}},before=JSON.parse(JSON.stringify(fullPatch));
 assert.ok(fullPatch.entries.test.p.surface);assert.equal(Object.hasOwn(fullPatch.entries.test.p,'catalogOnly'),false);const recaptured=createPatch(f.C,{test:fullEntry},f.sources,'baseline-git-sha');assert.deepEqual(recaptured.entries.test,entry,'new checkpoint creation also compacts an old full entry');assert.deepEqual(fullPatch,before);
 const fromFull=mergePatches(data,[fullPatch],f.C,f.sources),fromCompact=mergePatches(data,[compactPatch],f.C,f.sources);assert.deepEqual(fromFull,fromCompact);assert.equal(fromFull.designs.test.p.catalogOnly,true);assert.equal(Object.hasOwn(fromFull.designs.test.p,'surface'),false);assert.deepEqual(fullPatch,before,'merging must not rewrite the supplied shard');
 assert.deepEqual(mergePatches(data,[fullPatch,compactPatch],f.C,f.sources),fromCompact);assert.deepEqual(mergePatches(data,[compactPatch,fullPatch],f.C,f.sources),fromCompact);assert.deepEqual(fromFull.designs.unselected,data.designs.unselected);assert.equal(data.designs.test.p.profileVersion,8);
});
test('authoritative builtin complements replace the former cached manifest',()=>{
 const f=fixture();f.C.builtinComplement=()=>({air:[{type:'hyena',count:8}],ground:[]});const entry=generateEntry(f.C,f.R,'test',f.previous,f.sources);
 assert.deepEqual(entry.air,[{type:'hyena',count:8}]);assert.deepEqual(entry.ground,[]);
});
test('patch merges refresh only named ships, with current version and exact source checks',()=>{
 const f=fixture(),entry=generateEntry(f.C,f.R,'test',f.previous,f.sources),data={version:1,designs:{test:f.previous,unselected:{key:'unselected',p:{profileVersion:8}}}},patch=createPatch(f.C,{test:entry},f.sources,'baseline-git-sha');
 const merged=mergePatches(data,[patch],f.C,f.sources);assert.equal(merged.designs.test.p.profileVersion,15);assert.deepEqual(merged.designs.unselected,data.designs.unselected);assert.equal(data.designs.test.p.profileVersion,8);
 assert.throws(()=>mergePatches(data,[patch],f.C,{'js/core.js':'changed-source'}),/different model sources/);
 const stale=JSON.parse(JSON.stringify(patch));stale.entries.test.p.profileVersion=14;assert.throws(()=>mergePatches(data,[stale],f.C,f.sources),/Inconsistent fleet patch entry/);
 const mismatch=JSON.parse(JSON.stringify(patch));mismatch.entries.test.info.cost=101;assert.throws(()=>mergePatches(data,[patch,mismatch],f.C,f.sources),/Conflicting fleet patch entries/);
});
test('generator rejects fighter, unregistered and stale physical profiles',()=>{
 const f=fixture();f.C.SHIP_EXAMPLES.test.craft=true;assert.throws(()=>generateEntry(f.C,f.R,'test',f.previous,f.sources),/Not a selectable ship/);delete f.C.SHIP_EXAMPLES.test.craft;
 assert.throws(()=>generateEntry(f.C,f.R,'unknown',f.previous,f.sources),/Not a selectable ship/);f.C.fleetProfile=()=>({profileVersion:8});assert.throws(()=>generateEntry(f.C,f.R,'test',f.previous,f.sources),/Stale generated fleet profile/);
});
test('catalogue coverage includes all selectable named capital examples and CIS families',()=>{
 const {C,data}=loadRuntime(root),keys=exampleKeys(C,data),physical=['venator','imperial','executor',...Object.entries(C.SHIP_EXAMPLES).filter(([,d])=>!d.craft).map(([key])=>key)];
 assert.deepEqual(keys,[...new Set(physical)].sort());assert.deepEqual(Array.from(C.SHIP_SYSTEM_REFIT_KEYS).sort(),keys);for(const key of ['munificent','providence','providenceDn','recusant','recusantDn','lucrehulk','lh3210','subjugator','acclamator'])assert.ok(keys.includes(key),key);
});
test('CLI can generate independent shards or validate them without ambiguous output modes',()=>{
 assert.deepEqual(parseArgs(['--keys','imperial,venator','cr90','--patch','/tmp/profile.json']).keys,['imperial','venator','cr90']);assert.deepEqual(parseArgs(['--merge','a.json','--merge','b.json']).merges,['a.json','b.json']);
 assert.throws(()=>parseArgs(['--patch','x','--output','y']),/cannot be combined/);assert.throws(()=>parseArgs(['--merge','x','--keys','imperial']),/cannot be combined/);assert.throws(()=>parseArgs(['--keys']),/requires a value/);
});
