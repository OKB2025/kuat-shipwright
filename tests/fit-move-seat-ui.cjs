// User report 2026-11-11 (Imperial-class): moving deck turrets across the stepped / sloped deck left
// 「取り付け面を失った装備が 2 基あります」 and a ghost box off the surface. Requirements:
//  1. no parent link: the hull and every structure are one surface set for a moved fitting;
//  2. 面配置 (auto) follows the face under it, tilting to its normal;
//  3. 上面 / 下面配置 stays upright and moves parallel to the support directly below (above), keeping its mounting height;
//  4. an in-hull compartment that does not fit is reported separately and does not refuse the move;
//  5. only a real lack of surface refuses the move (the fitting stays seated where it was, it is never left floating).
// Drag and the X/Z sliders share one seat step (seatFitMove in js/app.js).
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const {C,plain,setup,exampleDesign,root}=require('./helpers/fit-move-harness.cjs');
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
// Distance from the fitting's seat point to the surface along its up axis, and the structure there.
const surface=(run,f='selItem()')=>plain(run(`(()=>{const f=${f},u=C.norm(C.fitUp(f)),h=C.rayEnv(ship,C.add(f.p,C.mul(u,4)),C.mul(u,-1),{maxT:8,structOnly:true});return h?{d:C.len(C.sub(h.p,f.p)),host:h.part?.id??'hull',n:h.n}:null;})()`));
const vertical=(run,x,z,from=1000,dir=-1)=>plain(run(`(()=>{const h=C.rayEnv(ship,[${x},${from},${z}],[0,${dir},0],{structOnly:true});return h?{y:h.p[1],part:h.part?.id,n:h.n}:null})()`));
function ship(run,parts,mount,{mirror=false,vmirror=false,ped=0,gun='stl',at=[150,0]}={}){
 run(`ship=C.newShip({L:600,W:400,H:160,assembly:true},'Fit move');ship.parts=[];ship.fits=[];ship.nextId=1;${parts};st.weaponMount=${JSON.stringify(mount)};st.mirror=${mirror};st.vmirror=${vmirror};st.ped=${ped};undoStack.length=0;redoStack.length=0`);
 const f=plain(run(mount==='bottom'?`(()=>{const h=C.rayEnv(ship,[${at[0]},-500,${at[1]}],[0,1,0],{structOnly:true});const n=weaponPlacementNormal('${gun}',h.n);const r=C.placeFit(ship,'${gun}',h.p,n,${ped},${mirror},{tilt:null,mountMode:'bottom'});if(!r.fit)throw Error(r.err);st.sel={list:'fits',id:r.fit.id};return r.fit})()`:`place('${gun}',${at[1]},${at[0]},${ped})`));
 run(`st.sel={list:'fits',id:${f.id}}`);assert.equal(f.float,false,'placed');return f;
}
const STEPS="C.placePart(ship,'struct',[150,0,0],[200,200,40],{form:'box'},false);C.placePart(ship,'struct',[350,10,0],[200,200,60],{form:'box'},false)";

test('drag and both sliders go through the one shared seat step',()=>{
 const drag=app.slice(app.indexOf('function dragItemMove('),app.indexOf('// Seat a fitting at a point'));assert.match(drag,/seatFitMove\(f, \{hit: h\}\)/);assert.doesNotMatch(drag,/moveFitTo\(f, h\.p/);
 const slider=app.slice(app.indexOf("if(['fitX','fitZ','fitY','fitAlong'].includes(k))"));assert.match(slider.slice(0,800),/seatFitMove\(f,\{axis:ax,value:v\}\)/);
 assert.equal(app.includes('function fitSurfaceSlideTarget('),false,'the old per-host slide is folded into the seat step');
});
test('a face-following gun slides across onto a neighbouring higher structure (no parent link)',()=>{
 const run=setup(),f0=ship(run,STEPS,'auto');const host0=surface(run).host;
 run("slide('fitX',330)");const f=plain(run('selItem()')),s=surface(run);
 assert.equal(f.float,false);assert.ok(Math.abs(f.p[0]-330)<1e-6);assert.ok(s&&s.d<.05&&s.host!==host0,'seated on the other structure');
 assert.ok(Math.abs(f.p[1]-(f0.p[1]+20))<1e-6,'climbed the 20 m step: '+(f.p[1]-f0.p[1]));
 assert.equal(f.host,undefined,'no host kept');assert.equal(f.placement,undefined);
});
test('top mount on a stepped deck: upright, height follows each step, mounting height kept',()=>{
 const run=setup(),f0=ship(run,STEPS,'top',{ped:5});const fr0=plain(run('C.fitOrigin(selItem())'));
 for(const [x,dy] of [[200,0],[320,20],[420,20],[180,0]]){
  run(`slide('fitX',${x})`);const f=plain(run('selItem()'));assert.equal(f.float,false,'seated at '+x);assert.ok(Math.abs(f.p[0]-x)<1e-6);
  assert.ok(Math.abs(f.p[1]-f0.p[1]-dy)<1e-6,`height at ${x}: ${f.p[1]-f0.p[1]}`);assert.equal(f.tilt,undefined,'upright');assert.equal(f.ped,5,'mounting height kept');
  assert.ok(Math.abs(vertical(run,x,0).y-f.p[1])<1e-6,'seat is the support directly below');
  const o=plain(run('C.fitOrigin(selItem())'));assert.ok(Math.abs((o[1]-f.p[1])-(fr0[1]-f0.p[1]))<1e-6,'origin stands the same height above the support');
 }
});
// User clarification 2026-11-11: top mount moves parallel to the slope below it (height changes by slope x distance).
test('top mount on a sloped face: the slider climbs with the slope by slope x distance and keeps the mounting height',()=>{
 const run=setup(),f0=ship(run,"C.placePart(ship,'struct',[300,0,0],[560,200,80],{form:'box',pitch:12},false)",'top',{ped:4,at:[300,0]});
 const n=vertical(run,300,0).n,slope=-n[0]/n[1],h0=plain(run('C.fitOrigin(selItem())'))[1]-f0.p[1];
 run(`slide('fitX',${f0.p[0]+30})`);const f=plain(run('selItem()'));
 assert.equal(f.float,false);assert.equal(f.tilt,undefined,'stays upright');assert.ok(Math.abs(f.p[0]-f0.p[0]-30)<1e-6);
 assert.ok(Math.abs((f.p[1]-f0.p[1])-slope*30)<.05,`dy ${f.p[1]-f0.p[1]} vs slope*30 ${slope*30}`);assert.ok(Math.abs(slope*30)>3,'a real slope');
 assert.ok(Math.abs(vertical(run,f.p[0],f.p[2]).y-f.p[1])<1e-6,'on the slope directly below');
 assert.equal(f.ped,4);assert.ok(Math.abs(plain(run('C.fitOrigin(selItem())'))[1]-f.p[1]-h0)<.05,'mounting height above the surface kept');
});
test('face-following gun on a curved hull follows the curve and tilts to its normal',()=>{
 const run=setup(),f0=ship(run,"C.placePart(ship,'struct',[300,0,0],[500,200,200],{form:'ellipsoid'},false)",'auto',{at:[300,0]});
 let last=f0;for(const z of [20,45,70]){run(`slide('fitZ',${z})`);const f=plain(run('selItem()'));
  assert.equal(f.float,false,'seated at z '+z);assert.ok(Math.abs(f.p[2]-z)<.5,'reached z '+f.p[2]);assert.ok(f.p[1]<last.p[1],'goes down the curve');
  const s=surface(run);assert.ok(s&&s.d<.05);assert.ok(f.tilt&&C.dot(C.norm(f.tilt),C.norm(s.n))>.995,'tilted to the face normal');last=f;}
 assert.ok(last.tilt[2]>.3,'normal turned outward with the curve');
});
test('bottom mount moves along the underside directly above it and stays upright',()=>{
 const run=setup(),f0=ship(run,"C.placePart(ship,'struct',[300,0,0],[560,200,80],{form:'box',pitch:-10},false)",'bottom',{at:[300,0]});
 assert.ok(C.fitUp(f0)[1]<-.99);const under=vertical(run,300,0,-1000,1);assert.ok(Math.abs(under.y-f0.p[1])<1e-6);
 run(`slide('fitX',${f0.p[0]+40})`);const f=plain(run('selItem()'));assert.equal(f.float,false);assert.ok(C.fitUp(f)[1]<-.99,'still hangs upright');
 const u=vertical(run,f.p[0],f.p[2],-1000,1);assert.ok(Math.abs(u.y-f.p[1])<1e-6,'on the underside directly above');assert.ok(Math.abs(f.p[1]-f0.p[1])>3,'height followed the underside');
});
test('no surface under the gun refuses the move: it stays seated where it was, nothing floats, no Undo step',()=>{
 const run=setup(),f0=ship(run,STEPS,'auto',{mirror:true,at:[150,40]});
 for(const [id,v] of [['fitX',900],['fitZ',300],['fitX',-200]]){const shown=run(`slide('${id}',${v})`);const f=plain(run('selItem()'));
  assert.deepEqual(f.p,f0.p);assert.equal(f.float,false);assert.equal(run('ship.fits.filter(q=>q.float).length'),0);assert.equal(Number(shown),+f0.p[id==='fitX'?0:2].toFixed(3),'slider snaps back');}
 assert.equal(run('undoStack.length'),0);
 // A drag over open space is refused the same way.
 assert.equal(run("seatFitMove(selItem(),{hit:{p:[900,0,0],n:[0,1,0]}}).status"),'refused');assert.deepEqual(plain(run('selItem().p')),f0.p);
});
test('an in-hull compartment that does not fit is a separate notice and the move is still made',()=>{
 // A 3 m thin deck plate next to a deep block: the gun's charging device column below the mount leaves the hull.
 const run=setup(),f0=ship(run,"C.placePart(ship,'struct',[150,0,0],[200,200,80],{form:'box'},false);C.placePart(ship,'struct',[350,38.5,0],[200,200,3],{form:'box'},false)",'top');
 assert.deepEqual(plain(run('seatFitMove(selItem(),{axis:0,value:180})')).interior,[],'deep block: fits');
 const r=plain(run('seatFitMove(selItem(),{axis:0,value:380})'));const f=plain(run('selItem()'));
 assert.equal(r.status,'moved');assert.deepEqual(r.interior,[f.id],'separate interior notice');assert.equal(f.float,false,'still mounted');assert.ok(Math.abs(f.p[0]-380)<1e-6);
 assert.equal(run('ship.fits.filter(q=>q.float).length'),0,'not a lost-surface error');
 assert.match(app,/function fitInteriorNotice\(r\) \{ if \(r\?\.interior\?\.length\) toast\('/);
});
test('a mirror pair crosses structures together; a gap under the twin refuses the whole move',()=>{
 const run=setup(),f0=ship(run,STEPS,'auto',{mirror:true,at:[150,40]});run('st.fitPairEdit=true');assert.equal(run('ship.fits.length'),2);
 run("slide('fitX',330)");let f=plain(run('selItem()')),tw=plain(run('ship.fits.find(q=>q.id===selItem().tw)'));
 assert.equal(f.float,false);assert.equal(tw.float,false);assert.ok(Math.abs(tw.p[0]-f.p[0])<1e-6&&Math.abs(tw.p[1]-f.p[1])<1e-6&&Math.abs(tw.p[2]+f.p[2])<1e-6,'twin mirrored');
 assert.ok(surface(run,'ship.fits.find(q=>q.id===selItem().tw)').d<.05);
 // Cut away the port side of the high block: the twin would have no surface, so the pair does not move.
 run("ship.parts[1].s[1]=60;ship.parts[1].c[2]=60;ship._cache=null");const before=plain(run('ship.fits.map(q=>q.p)'));
 run("slide('fitX',360)");assert.deepEqual(plain(run('ship.fits.map(q=>q.p)')),before);assert.equal(run('ship.fits.filter(q=>q.float).length'),0);
});
test('editor-placed (anchored) guns move off their parent without parent-missing; Undo/Redo and save/reload are stable',()=>{
 const run=setup();ship(run,STEPS,'top');run('ship.fits=[];st.mirror=false');
 const placed=run(`(()=>{const r=C.solveFitPlacement(ship,{id:-1,k:'stl',p:[150,20,0],n:[0,1,0],a:2,ped:3,mountMode:'top'},{mode:'direct',hostId:ship.parts[0].id,hit:{p:[150,20,0],n:[0,1,0]}});if(!r.ok)return r.error;C.acceptPlacementResult(ship,r);st.sel={list:'fits',id:ship.fits[0].id};return 'ok'})()`);
 assert.equal(placed,'ok');const f0=plain(run('selItem()'));assert.equal(f0.host,1);assert.ok(f0.placement);assert.equal(f0.float,false);
 // An existing save that stores a host id still loads.
 const saved=run('C.serialize(ship)'),reload=plain(run(`(()=>{const s=C.deserialize(JSON.parse(${JSON.stringify(JSON.stringify(saved))}));return s.fits[0]})()`));assert.equal(!!reload.float,false);assert.equal(reload.host,1);
 run('undoStack.length=0;redoStack.length=0');const before=plain(run('ship.fits'));
 run("slide('fitX',160)");let f=plain(run('selItem()'));assert.equal(f.float,false,'same structure: no parent-missing');assert.equal(f._fitPlacementError,undefined);assert.ok(Math.abs(f.p[0]-160)<1e-6);
 run('undoStack.length=0;redoStack.length=0');
 const b2=plain(run('ship.fits'));run("slide('fitX',330)");f=plain(run('selItem()'));
 assert.equal(f.float,false,'crossed to the other structure');assert.ok(Math.abs(f.p[1]-40)<1e-6);assert.equal(f.host,undefined);assert.equal(f.placement,undefined,'no parent link after a move');assert.equal(f.ped,3);
 assert.equal(run('undoStack.length'),1,'one Undo step per move');const after=plain(run('ship.fits'));
 run('undo()');assert.deepEqual(plain(run('ship.fits')).map(q=>[q.p,q.host??null,!!q.float]),b2.map(q=>[q.p,q.host??null,!!q.float]));
 run('redo()');assert.deepEqual(plain(run('ship.fits')).map(q=>[q.p,!!q.float]),after.map(q=>[q.p,!!q.float]));
 const again=plain(run('(()=>{const s=C.deserialize(JSON.parse(JSON.stringify(C.serialize(ship))));return s.fits[0]})()'));
 assert.equal(!!again.float,false);assert.deepEqual(again.p,after[0].p,'reload keeps the seat');assert.equal(again.ped,3);
 void before;
});
test('Imperial-class reproduction: deck turrets cross steps and slopes without losing their surface',()=>{
 const run=setup();run('globalThis.__raw='+JSON.stringify(JSON.stringify(exampleDesign('imperial'))));
 const load=()=>run("ship=C.deserialize(JSON.parse(__raw));st.weaponMount='auto';st.mirror=true;st.fitPairEdit=true;undoStack.length=0;redoStack.length=0");
 const cases=[
  // [fit id, slider, delta, expected: 'moved' | 'refused'] — ids from data/examples/imperial
  [128,'fitX',-40,'moved'],[128,'fitX',40,'moved'],[128,'fitZ',10,'moved'],[129,'fitX',-20,'moved'],[129,'fitX',20,'moved'],[130,'fitX',-40,'moved'],
  [182,'fitX',40,'moved'],[182,'fitZ',25,'moved'],[184,'fitX',20,'moved'],[179,'fitX',-20,'moved'],
  [179,'fitX',40,'refused'],[179,'fitZ',25,'refused'] // beyond the bow tip / outside the narrow bow: no surface at all
 ];
 for(const [id,slider,d,want] of cases){
  load();run(`st.sel={list:'fits',id:${id}}`);const ax=slider==='fitX'?0:2,f0=plain(run('selItem()'));assert.equal(!!f0.float,false);
  run(`slide('${slider}',${f0.p[ax]+d})`);const f=plain(run('selItem()'));
  assert.equal(run('ship.fits.filter(q=>q.float).length'),0,`#${id} ${slider}${d}: no lost-surface fittings`);
  if(want==='moved'){assert.ok(Math.abs(f.p[ax]-f0.p[ax]-d)<.5,`#${id} ${slider}${d} reached ${f.p[ax]-f0.p[ax]}`);const s=surface(run);assert.ok(s&&s.d<.05,`#${id} seated`);if(f0.mountMode==='top')assert.equal(f.tilt,undefined,'top mount stays upright');assert.equal(f.ped,f0.ped);}
  else assert.deepEqual(f.p,f0.p,`#${id} ${slider}${d} refused`);
 }
 // The stepped centre-line deck: the top-mounted turret climbs the 30 m step aft.
 load();run('st.sel={list:"fits",id:128}');const y0=run('selItem().p[1]');run(`slide('fitX',${run('selItem().p[0]')-40})`);assert.ok(run('selItem().p[1]')-y0>25,'climbed the step');
});
