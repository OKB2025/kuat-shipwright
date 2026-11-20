// User report 2026-11-20: a 2,200 m design with 184 structures stayed at「形状を計算中…」after two shield generators were placed.
// The drive route search (engine bodies to nozzles) tested thousands of points against the hull, and every test rebuilt the hull
// cache key with JSON.stringify because nothing held the caches during the search (loading that design took 317 s without the
// generators and did not finish in 25 minutes with them; 22 s and 230 s with the caches held). This checks that the search
// holds the caches: the hull cache key is built a few times in a search, not once for every point tested.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console:{log(){},warn(){},error(){}}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx);
test('the drive route search holds the hull caches instead of rebuilding their key at every point',()=>{
 const key=process.env.KS_ROUTE_KEY||'nebulonb',design=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'..','data/examples',key,'design.json.gz'))).toString('utf8'));
 const ship=C.deserialize(design.design||design);assert.ok(ship.parts.some(p=>p.k==='engineCore'||p.k==='engine'),'the fixture has engines');
 const J=vm.runInContext('JSON',cx),real=J.stringify;let calls=0;/* a hull cache key is the array [hull, cuts, subs, trenches, solidCuts, portal hatches, launchers, bays] */J.stringify=function(v){if(Array.isArray(v)&&v.length===8&&v[0]&&typeof v[0]==='object'&&'plan' in v[0])calls++;return real.apply(this,arguments);};
 let net;try{delete ship._engineDriveRoutes;net=C.engineDriveRoutes(ship);}finally{J.stringify=real;}
 assert.ok(net&&Array.isArray(net.routes)&&net.routes.length>0,'routes were searched: '+(net?.routes?.length));
 if(process.env.KS_ROUTE_PRINT)console.error(key,'keys built',calls,'routes',net.routes.length);assert.ok(calls<50,'hull cache keys built during the search: '+calls);
});
