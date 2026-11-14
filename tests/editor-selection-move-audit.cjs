// Audit 2026-11-14, item 5: a weapon selected together with the body it sits on is moved with the selection.
// It used to be skipped ("a pod rides its wall"); since stage C a weapon no longer follows its body, so it was left behind.
// The editor's own transform functions (r6 .. xfRows) are taken from js/app.js as they are; seatFit is a stand-in that
// only writes the position and normal. Not a browser check. Fails on the editor code before 4133105 (weapon row missing).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
function setup(){const box=vm.createContext({console,performance:{now:()=>0}}),run=s=>vm.runInContext(s,box);for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])run(fs.readFileSync(path.join(root,f),'utf8'));
 run(`const C=Core;let ship=C.newShip({L:200,W:60,H:40,assembly:true},'Selection move');const publicCopy=x=>JSON.parse(C.publicJSON(x)),seatFit=(g,q,m)=>{g.p=q.slice();g.n=C.norm(m);};`);
 const a=app.indexOf('const r6=v=>'),b=app.indexOf('function xfPlan(',a);assert.ok(a>=0&&b>a);run(app.slice(a,b));return run;}
test('a weapon selected with its body is moved by the same amount as the body',()=>{const r=setup();
 r(`const body={id:5,k:'struct',form:'box',c:[20,25,0],s:[20,10,20]},gun={id:6,k:'quad500',host:5,a:2,n:[0,1,0],p:[20,30,0]};ship.parts.push(body);ship.fits=[gun];
  const drivers=[{list:'parts',it:body,fol:[]},{list:'fits',it:gun,fol:[]}],units=[{drivers}],dv=[0,0,-3];
  var out=xfRows(drivers,units,()=>({pt:p=>C.add(p,dv),R:null}));`);
 const rows=JSON.parse(r(`JSON.stringify(out.rows.map(x=>({list:x.list,id:x.it.id,c:x.out.c,p:x.out.p})))`));
 assert.deepEqual(rows.map(x=>x.list+x.id),['parts5','fits6']);assert.deepEqual(rows[0].c,[20,25,-3]);assert.deepEqual(rows[1].p,[20,30,-3]);});
