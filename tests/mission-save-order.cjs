// Audit 2026-11-16 (msWrite race): a newer mission save must never be dropped because an older write finished first,
// an older write finishing last must not overwrite the newer one, and a page-exit flush covers writes still in flight.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return app.slice(a,b);}
function setup(){
 const writes=[],pending=[],ctx=vm.createContext({console,setTimeout:()=>1,clearTimeout:()=>{},Date,JSON,Math,writes,pending});
 vm.runInContext(`let MS={n:0};const MS_KEY='m',msUI={warned:false,cloud:{}};const msNormalize=()=>{},msCloudPush=()=>{},toast=m=>writes.push('toast:'+m);
  const LS={set:(k,v)=>{writes.push(v);return true;}};const pack=st=>new Promise(r=>pending.push(()=>r('packed:'+st.n)));`,ctx);
 vm.runInContext(section('let msSaveT = 0','// The artifact'),ctx);
 return {ctx,writes,pending,run:c=>vm.runInContext(c,ctx)};
}
const tick=()=>new Promise(r=>setImmediate(r));
test('an older write finishing first does not drop the newer save',async()=>{
 const t=setup();t.run('MS.n=1');const a=t.run('msWrite()');t.run('MS={n:2}');const b=t.run('msWrite()');
 t.pending[0]();await a;t.pending[1]();await b;await tick();assert.equal(t.writes.at(-1),'packed:2');assert.ok(!t.writes.some(w=>String(w).startsWith('toast:')));
});
test('an older write finishing last does not overwrite the newer save',async()=>{
 const t=setup();t.run('MS.n=1');const a=t.run('msWrite()');t.run('MS={n:2}');const b=t.run('msWrite()');
 t.pending[1]();await b;t.pending[0]();await a;await tick();assert.deepEqual([...t.writes],['packed:2']);
});
test('a page-exit flush covers writes still in flight',async()=>{
 const t=setup();t.run('MS.n=1');const a=t.run('msWrite()');t.run('MS={n:3};msFlush()');assert.equal(t.writes.at(-1),'{"n":3}');
 t.pending[0]();await a;await tick();assert.equal(t.writes.at(-1),'{"n":3}','the stale write after the flush is skipped');
 const b=t.run('msWrite()');t.pending[1]();await b;assert.equal(t.writes.at(-1),'packed:3','a later save still writes');
});
