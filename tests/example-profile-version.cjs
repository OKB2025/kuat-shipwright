// Examples are saved designs whose stored figures (data/examples/<key>/combat.json, assembled into
// data/fleet.js) stay valid while the design content and the calculation-model key are unchanged
// (Core.profileModelKey: FLEET_PROFILE_VERSION, COST_MODEL, the cost signature, EXAMPLE_PROFILE_VERSION).
// The game trusts a stored row whose model key matches, so a change to js/core.js that alters a figure of
// an unchanged design must bump one of those versions in the same change. This test recomputes the rows
// of a few small examples from their saved designs with the current code and compares them with the
// stored rows: a difference under an unchanged model key is a forgotten bump.
// KS_PROFILE_VERSION_KEYS=a,b selects other examples (default: two small ships, about a minute).
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
const G=require(path.join(root,'scripts/update-ship-examples.cjs')),F=require(path.join(root,'scripts/example-files.cjs'));
const {C,R,data}=G.loadRuntime(root);
const keys=(process.env.KS_PROFILE_VERSION_KEYS||'gr75,cr90').split(',').filter(Boolean);
const plain=x=>JSON.parse(JSON.stringify(x));
// The stored form of a freshly computed row (what scripts/refresh-examples.cjs would write).
function recomputed(key){
 const blueprint=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,F.designPath(key)))).toString('utf8'));
 const entry=G.compactCatalogEntry(G.generateEntryFromBlueprint(C,R,key,blueprint,data.designs[key],{}));
 // The row names the stored design file (scripts/refresh-examples.cjs checks sha(stable(file)) against it);
 // a deserialize/serialize round trip of that file is not byte-identical, so it is named the same way here.
 entry.model={...entry.model,blueprintSha256:F.sha(F.stable(blueprint))};
 return JSON.parse(JSON.stringify(F.combatRow(entry)));
}
// The first differing paths, for the failure message.
function differences(a,b,at='',out=[]){
 if(out.length>=8)return out;
 if(a&&b&&typeof a==='object'&&typeof b==='object'){for(const k of new Set([...Object.keys(a),...Object.keys(b)]))differences(a[k],b[k],at+'.'+k,out);return out;}
 if(JSON.stringify(a)!==JSON.stringify(b))out.push(`${at}: stored ${JSON.stringify(a)?.slice(0,60)} / now ${JSON.stringify(b)?.slice(0,60)}`);return out;
}
for(const key of keys)test(`${key}: the stored row equals a recomputation from its saved design under the same model key`,()=>{
 const stored=plain(JSON.parse(fs.readFileSync(path.join(root,F.combatPath(key)),'utf8'))),now=recomputed(key),m=stored.model||{};
 const sameModel=m.profileVersion===C.FLEET_PROFILE_VERSION&&m.costVersion===C.COST_MODEL.version&&m.costSignature===C.costModelSignature()&&m.exampleProfileVersion===C.EXAMPLE_PROFILE_VERSION;
 assert.ok(sameModel,`${key}: the stored row was computed under another model key (profile ${m.profileVersion}/${C.FLEET_PROFILE_VERSION}, cost ${m.costVersion}/${C.COST_MODEL.version}, example ${m.exampleProfileVersion}/${C.EXAMPLE_PROFILE_VERSION}); regenerate it with scripts/refresh-examples.cjs`);
 const diff=differences(stored,now);
 assert.deepEqual(diff,[],`${key}: figures changed while the model key did not. Bump Core.EXAMPLE_PROFILE_VERSION (or FLEET_PROFILE_VERSION / COST_MODEL.version) and regenerate the rows (docs/prepared-examples.md):\n `+diff.join('\n '));
});
