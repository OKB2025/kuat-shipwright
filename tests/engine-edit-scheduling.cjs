const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict'), {test} = require('node:test');
const root = path.resolve(process.env.KS_TEST_ROOT || path.join(__dirname, '..'));
function setup() {
  const cx = vm.createContext({console, setTimeout, clearTimeout, structuredClone});
  for (const f of ['data/reference.js', 'data/imperial2.js', 'data/fleet.js', 'js/core.js', 'js/gfx.js', 'js/engine.js'])
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), cx, {filename: f});
  const {C, E} = vm.runInContext('({C:Core,E:YardEngine})', cx);
  const messages = [], waiting = [];
  const scope = {postMessage(msg) {
    messages.push(msg);
    for (const w of waiting.slice()) if (w.type === msg.type && w.gen === msg.gen) {
      waiting.splice(waiting.indexOf(w), 1); w.resolve(msg);
    }
  }};
  E.listenWorker(scope);
  const wait = (type, gen) => new Promise(resolve => {
    const hit = messages.find(m => m.type === type && m.gen === gen);
    if (hit) resolve(hit); else waiting.push({type, gen, resolve});
  });
  const ship = C.newShip({L:80,W:60,H:40,plan:'rect',sec:'rect'}, 'Edit scheduling');
  ship.parts = []; ship.fits = []; ship.detail = 0; ship.armor = {hull:0,cit:0};
  return {C, E, ship, messages, wait, send: data => scope.onmessage({data})};
}

test('a newer edit interrupts the old statistics quiet period', async () => {
  const {C, ship, send, wait, messages} = setup();
  const state = C.publicJSON(ship);
  send({type:'update',gen:1,state,what:['all'],reset:true,statsDelay:5000});
  await wait('geometry',1);
  let timer;
  try {
    // This arrives while the engine is waiting, just like a second slider edit.
    send({type:'update',gen:2,state,what:['view'],stats:false});
    const result = await Promise.race([wait('geometry',2),new Promise((_,reject) => {
      timer=setTimeout(() => reject(new Error('edit remained blocked behind obsolete statistics')),1500);
    })]);
    assert.equal(result.gen,2);
    assert.equal(messages.some(m=>m.type==='stats'&&m.gen===1),false);
    assert.equal(messages.some(m=>m.type==='error'),false);
  } finally { clearTimeout(timer); }
});

test('worker packets retain exposed face geometry and symbolic host references', () => {
  const {C, E, ship} = setup();
  const host = C.placePart(ship,'struct',[40,45,0],[30,20,20],{form:'box'},false);
  C.placePart(ship,'struct',[45,45,10],[20,20,20],{form:'box'},false);
  const faces = C.surfacePatches(ship), packet = structuredClone(E.packCaches(ship));
  assert.equal(packet.geoProxy.surfaces.length,faces.length);
  assert.equal(packet.geoProxy.surfacePartitions,JSON.stringify(ship.surfaces?.partitions||null));
  const face = faces.find(p=>p.host==='p'+host.id&&p.exposedArea>0&&p.exposedArea<p.area);
  assert.ok(face,'fixture must include a partially occluded face');
  const packed = packet.geoProxy.surfaces.find(p=>p.id===face.id);
  assert.deepEqual(packed._part,{$r:'parts',id:host.id});
  assert.deepEqual(packed.exposedTriangles,Array.from(face.exposedTriangles));
  assert.equal(packed.config,undefined);
  assert.ok(packed.exposedTriangles.length,'visible picking triangles must survive the general cache filter');
});
