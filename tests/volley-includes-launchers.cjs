// 2026-11-22 (user: 「性能の火力には艦搭載のミサイル/魚雷も含んで」): the performance tab's volley figure and the radar firepower count one
// salvo of every ship-mounted missile/torpedo launcher next to the guns; craft keep the gun-only figure. allGunVolleyTT stays gun-only.
const assert=require('node:assert/strict'),fs=require('node:fs'),zlib=require('node:zlib'),path=require('node:path'),vm=require('node:vm'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),{C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
function helpers(ship){const c=vm.createContext({C,ship});const a=app.indexOf('function launcherVolleyTT('),b=app.indexOf('function bar(',a);assert.ok(a>=0&&b>a);vm.runInContext(app.slice(a,b),c);return c;}
const load=k=>C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,`data/examples/${k}/design.json.gz`)))));
test('ship: volley = guns + one salvo of the ship launchers (not the 20-second rate in mslSalvo)',()=>{
 const ship=load('mc30c'),S=C.computeStats(ship),h=helpers(ship);
 const launchers=ship.fits.filter(f=>C.isShipLauncher(f));assert.equal(launchers.length,8,'mc30c carries eight launchers');
 const one=launchers.reduce((n,f)=>n+C.fitSpec(f).msl,0);
 assert.ok(Math.abs(one-8*C.fitSpec(launchers[0]).msl)<1e-12);
 assert.ok(S.mslSalvo>one*10,`mslSalvo is a 20-second rate (${S.mslSalvo} against one salvo ${one})`);
 assert.equal(h.gunVolleyTT(S),S.allGunVolleyTT);
 assert.ok(Math.abs(h.launcherVolleyTT(S)-one)<1e-12,`one salvo ${h.launcherVolleyTT(S)} = ${one}`);
 assert.ok(Math.abs(h.totalVolleyTT(S)-(S.allGunVolleyTT+one))<1e-12);
});
test('craft: launcher value is a 20-second rate and is not added',()=>{
 const ship=load('craft_xwing'),S=C.computeStats(ship),h=helpers(ship);
 assert.ok(C.isCraft(ship));assert.equal(h.launcherVolleyTT(S),0);assert.equal(h.totalVolleyTT(S),h.gunVolleyTT(S));
});
test('performance-tab sites use the total',()=>{
 for(const s of ['<i>一斉射</i><b>${fTT(totalVolleyTT(M))}','一斉射 ${fTT(totalVolleyTT(M))}','<dd>${fTT(totalVolleyTT(S))}','(S.alphaBest + launcherVolleyTT(S))'])assert.ok(app.includes(s),s);
});
