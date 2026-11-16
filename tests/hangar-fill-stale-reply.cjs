// Audit 2026-11-16 (fillHangarsRemote): the Worker's auto-fill reply is for the design as it was sent; an edit, Undo or
// a different ship made while waiting must not be overwritten by it.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return app.slice(a,b);}
function setup(){
 const log=[],ctx=vm.createContext({console,log,JSON});let reply;
 vm.runInContext(`const C={publicJSON:x=>JSON.stringify(x),patchShip:(s,n)=>{log.push('patched');Object.assign(s,n);}};let ship={name:'A',parts:[1]};const st={size:{hangar:1},fill:[0,0],mirror:false},eng={gen:1},undoStack=[],redoStack=[];let lastOp='';
  const snap=()=>JSON.stringify(ship),showBusyOverlay=()=>{},hideBusyOverlay=()=>{},toast=m=>log.push('toast:'+m),touch=()=>{},scheduleStats=()=>{},updateUndo=()=>{},autosave=()=>{},renderPanel=()=>{},esc=String;
  let resolveReply;const YardEngineClient={request:()=>new Promise(r=>{resolveReply=r;})};`,ctx);
 vm.runInContext(section('async function fillHangarsRemote()','\n// ---------- persistence'),ctx);
 return {ctx,log,run:c=>vm.runInContext(c,ctx)};
}
test('an edit made while waiting is kept and the stale reply is discarded',async()=>{
 const t=setup(),done=t.run('fillHangarsRemote()');t.run("undoStack.push(JSON.stringify(ship));ship.parts=[1,2]");t.run("resolveReply({result:3,state:JSON.stringify({name:'A',parts:[1,9,9,9]})})");await done;
 assert.deepEqual(JSON.parse(t.run('JSON.stringify(ship.parts)')),[1,2]);assert.ok(!t.log.includes('patched'));assert.ok(t.log.some(m=>/破棄/.test(m)));assert.equal(t.run('undoStack.length'),1,'only the edit itself, no auto-fill entry');
});
test('another ship opened while waiting is not overwritten',async()=>{
 const t=setup(),done=t.run('fillHangarsRemote()');t.run("ship={name:'B',parts:[5]}");t.run("resolveReply({result:3,state:JSON.stringify({name:'A',parts:[1,9]})})");await done;
 assert.equal(t.run('ship.name'),'B');assert.ok(!t.log.includes('patched'));
});
test('an unchanged design takes the reply as before',async()=>{
 const t=setup(),done=t.run('fillHangarsRemote()');t.run("resolveReply({result:2,state:JSON.stringify({name:'A',parts:[1,7,7]})})");await done;
 assert.ok(t.log.includes('patched'));assert.equal(t.run('undoStack.length'),1);assert.equal(t.run('lastOp'),'格納庫を自動充填');
});
test('the engine adopting computed fields while waiting is not an edit: the reply is still applied',async()=>{
 const t=setup(),done=t.run('fillHangarsRemote()');t.run("ship.surfaces={adopted:true}");t.run("resolveReply({result:2,state:JSON.stringify({name:'A',parts:[1,7,7]})})");await done;
 assert.ok(t.log.includes('patched'));assert.equal(t.run('undoStack.length'),1);
});
test('an Undo made while waiting discards the reply',async()=>{
 const t=setup();t.run("undoStack.push('old')");const done=t.run('fillHangarsRemote()');t.run("redoStack.push(undoStack.pop())");t.run("resolveReply({result:2,state:JSON.stringify({name:'A',parts:[1,7]})})");await done;
 assert.ok(!t.log.includes('patched'));
});
