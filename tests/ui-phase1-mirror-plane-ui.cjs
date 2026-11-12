// UI phase 1 (2026-11-12) item 1c: the symmetry toggles say ON/OFF in words, and the symmetry plane is drawn
// in 3D as faint lines (no transparent surface pass) while placement is armed or a toggle is on.
// The left/right plane follows the hull being cut: a mirrored cut on a hull off the centreline mirrors about
// that hull's own centreline (Core.hullMirrorIsWorldMirror / solidCutWorldPieces), so the plane is drawn there.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),run=s=>vm.runInContext(s,cx);
function section(a,b){const i=app.indexOf(a),j=app.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return app.slice(i,j);}
const C=run('Core'),G=run('Gfx');
const points=out=>Array.from({length:out.pos.length/3},(_,i)=>[out.pos[i*3],out.pos[i*3+1],out.pos[i*3+2]]);
function offCentre(){
 const s=C.newShip({L:200,W:32,H:32,plan:'cigar',sec:'ellipse'},'plane');s.fits=[];C.ensurePrimaryHull(s);
 const hull=s.parts[0],h2=JSON.parse(C.publicJSON(hull));h2.id=s.nextId++;h2.c=[hull.c[0],hull.c[1],hull.c[2]+20];h2.yaw=10;delete h2.primaryHull;h2.label='H2';h2.hullData={...h2.hullData,solidCuts:[],subs:[]};s.parts.push(h2);
 s._cache=null;C.refreshPlacementGeometry(s);return {s,H2:s.parts.find(q=>q.label==='H2'),primary:s.parts.find(q=>q.primaryHull)};
}

test('the left/right plane is world z=0, drawn as lines over the ship bounds',()=>{
 const {s}=offCentre(),b=[-10,-20,-30,210,20,40],out=G.symmetryPlaneLines(s,b,{mirror:true});
 const P=points(out);assert.ok(P.length>=28,'a grid of segments');assert.ok(P.every(p=>Math.abs(p[2])<1e-9),'every point on z=0');
 const xs=P.map(p=>p[0]);assert.ok(Math.min(...xs)<-10&&Math.max(...xs)>210,'spans the ship with a margin');
 assert.equal(out.col.length,P.length*4);assert.ok([...out.col].filter((_,i)=>i%4===3).every(a=>a<=150),'faint: alpha at most 150/255');
 assert.equal(G.symmetryPlaneLines(s,b,{}).pos.length,0,'nothing without a toggle');
});

test('a mirrored cut on an off-centre hull draws that hull\'s own centreline, not world z=0',()=>{
 const {s,H2,primary}=offCentre();assert.equal(C.hullMirrorIsWorldMirror(H2),false);assert.equal(C.hullMirrorIsWorldMirror(primary),true);
 const P=points(G.symmetryPlaneLines(s,null,{mirror:true,hull:H2}));
 assert.ok(P.length>0);for(const p of P)assert.ok(Math.abs(C.hullLocalPoint(H2,p)[2])<1e-3,'on the hull centreline plane (float32 positions)');
 assert.ok(P.some(p=>Math.abs(p[2])>5),'off world z=0');
 // The cut mirrors exactly across the plane drawn: a point and its hull-frame mirror are symmetric about it.
 const q=[110,16,-5],w=C.hullWorldPoint(H2,q),m=C.hullWorldPoint(H2,[q[0],q[1],-q[2]]),mid=w.map((v,i)=>(v+m[i])/2);assert.ok(Math.abs(C.hullLocalPoint(H2,mid)[2])<1e-6);
});

test('the top/bottom plane follows the vertical mirror of Core',()=>{
 const {s}=offCentre(),P=points(G.symmetryPlaneLines(s,[0,-16,-16,200,16,16],{vmirror:true}));assert.ok(P.length>0);
 for(const p of P.slice(0,40)){const y=C.vmirrorPart({k:'_symmetryPlane',c:[p[0],0,0]},s).c[1]/2;assert.ok(Math.abs(p[1]-y)<1e-3,'on the vertical symmetry plane at x '+p[0]);}
});

test('the editor shows the planes while armed or a toggle is on, uses the cutter hull and draws them in their own line layer',()=>{
 const state=section('function symmetryPlaneState(','function refreshSymmetryPlanes(');
 run(`var ship=null,view={setLines(){}},fleet={mode:'design'},trial={on:false},shot={on:false},st={mirror:false,vmirror:false},armed=false,cutterHull=null,currentTool='part';
  function designPlacementActive(){return armed;}function tool(){return currentTool;}function cutterMirrorHull(q){return cutterHull;}${state}`);
 cx.inputShip=offCentre().s;run('ship=inputShip');
 assert.equal(run('symmetryPlaneState()'),null,'hidden with nothing armed or toggled');
 run('armed=true');assert.deepEqual(JSON.parse(JSON.stringify(run('symmetryPlaneState()'))),{mirror:true,vmirror:false,faint:true,hull:null},'armed: the centreline, faint');
 run('armed=false;st.vmirror=true');assert.equal(run('symmetryPlaneState().vmirror'),true);assert.equal(run('symmetryPlaneState().mirror'),false);
 run('st.vmirror=false;currentTool="solid";st.solidCutter={mirror:true};cutterHull={id:7}');assert.equal(run('symmetryPlaneState().hull.id'),7,'the cutter hull centreline');
 run('trial.on=true');assert.equal(run('symmetryPlaneState()'),null,'never in a trial');
 const gfx=fs.readFileSync(path.join(root,'js/gfx.js'),'utf8');assert.match(gfx,/this\.drawLines\('symmetry', m, 0\.45\)/);assert.match(app,/flushLivePreview\(\);refreshSymmetryPlanes\(\);/);
});

test('the symmetry buttons carry ON/OFF text',()=>{
 assert.match(html,/id="chipMirror"[^]*?<span class="tr-state" data-symmetry-state>ON<\/span>/);assert.match(html,/id="chipVMirror"[^]*?data-symmetry-state>OFF</);
 const hud=section('function syncHud()','\n}\n');assert.match(hud,/s\.textContent = on \? 'ON' : 'OFF'/);assert.match(hud,/`\$\{name\}: \$\{on \? 'ON' : 'OFF'\}`/);
 assert.match(section('function designUISymmetryHTML(','function designUIHatchesHTML('),/左右対称: ON':'左右対称: OFF'/);
});
