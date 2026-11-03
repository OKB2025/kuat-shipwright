const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');

const root = path.resolve(process.env.KS_TEST_ROOT || path.join(__dirname, '..'));
const context = vm.createContext({console, performance: {now: () => 0}});
for (const file of ['data/reference.js', 'data/imperial2.js', 'data/fleet.js', 'js/core.js', 'js/gfx.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, {filename: file});
}
const {C, G} = vm.runInContext('({C: Core, G: Gfx})', context);
const plain = value => JSON.parse(JSON.stringify(value));
const near = (a, b, message) => assert.ok(Math.abs(a-b) <= Math.max(.0001, Math.abs(b)*1e-7), `${message}: ${a} != ${b}`);

function fixture() {
  const ship = C.newShip({L: 360, W: 220, H: 160, assembly: true}, 'Cosmetic armor skin');
  ship.parts = [];
  ship.fits = [];
  ship.armor = {hull: 0, cit: 0};
  ship.detail = 0;
  return ship;
}

function indexedPositions(geo, start = 0, count = geo.ni) {
  const result = [];
  for (let i = start; i < start+count; i++) {
    const k = geo.idx[i]*3;
    result.push(...geo.pos.subarray(k, k+3));
  }
  return result;
}

function triangles(positions) {
  const result = [];
  for (let i = 0; i < positions.length; i += 9) {
    // Vertex order within a triangle is immaterial to this envelope comparison.
    result.push([0, 3, 6].map(j => Array.from(positions.slice(i+j, i+j+3), x => x.toFixed(3)).join(',')).sort().join(';'));
  }
  return result.sort();
}

function physical(stats) {
  return plain(Object.fromEntries(['volume', 'mass', 'cost', 'armorMass', 'armorAvg', 'plateMass', 'plateArea', 'hp', 'crew'].map(k => [k, stats[k]])));
}

function geometry(geo) {
  return {
    n: geo.n, ni: geo.ni,
    positions: Array.from(geo.pos.subarray(0, geo.n*3)),
    normals: Array.from(geo.nor.subarray(0, geo.n*3)),
    indices: Array.from(geo.idx.subarray(0, geo.ni)),
  };
}

test('armor decoration leaves rotated structural and physical plate triangles, material bill and saved dimensions unchanged', () => {
  const ship = fixture();
  const structure = C.placePart(ship, 'struct', [95, 70, -45], [90, 65, 40], {form: 'box', yaw: 23, pitch: 17, roll: 11, paint: '#ad6743'}, false);
  const plate = C.placePart(ship, 'struct', [250, 70, 45], [85, 55, 2], {form: 'box', plate: true, plateT: .3, yaw: -19, pitch: 13, roll: 7, paint: '#547ca3'}, false);
  const stats = physical(C.computeStats(ship));
  const source = C.publicJSON(ship);
  const expected = new Map([structure, plate].map(p => [p.id, triangles(C.structTriangles(p))]));

  for (const coded of [false, true]) {
    const result = G.meshParts(ship, {coded});
    for (const [part, name] of [[structure, 'struct'], [plate, 'plate']]) {
      const geo = result.g[name];
      const spans = result.ranges[part.id].filter(r => r[0] === name);
      assert.deepEqual(triangles(spans.flatMap(([, start, count]) => indexedPositions(geo, start, count))), expected.get(part.id), 'plating must not tessellate or displace the physical solid');
      assert.equal(spans.reduce((sum, r) => sum+r[2], 0), C.structTriangles(part).length/3, 'surface decoration must add zero structural triangles');
      if (!coded) {
        const color = part.paint.slice(1).match(/../g).map(x => parseInt(x, 16));
        for (let i = 0; i < geo.n; i++) assert.deepEqual(Array.from(geo.col.subarray(i*4, i*4+3)), color, 'neutral atlas modulation must preserve the authored vertex paint');
      }
    }
  }
  G.meshPreview(ship, [structure, plate], [], {coded: false});
  G.fleetGeometry(ship);
  assert.equal(C.publicJSON(ship), source);
  assert.deepEqual(physical(C.computeStats(ship)), stats, 'a decorative skin cannot alter armor thickness, mass, protection, cost or capacities');
});

function armorFixture(thickness) {
  const ship = fixture();
  const host = C.placePart(ship, 'struct', [180, 70, 0], [140, 100, 60], {form: 'box', yaw: 29, pitch: 16, roll: 8, paint: '#967052'}, false);
  const patch = C.surfacePatches(ship).find(p => p.host === 'p'+host.id && p.face === 'top');
  assert.equal(C.setSurfaceConfig(ship, patch.id, {functionMode: 'armor', armor: {material: 'dense', thickness}, style: {density: 0}}).ok, true);
  return {ship, host, patch};
}

test('surface armor keeps its charged thickness and exact outer boundary while repaint changes only its color', () => {
  for (const thickness of [0, .4]) {
    const {ship, host, patch} = armorFixture(thickness);
    const stats = physical(C.computeStats(ship)), source = C.publicJSON(ship), first = G.meshSurfaceLayers(ship).surfaceArmor;
    const normal = C.norm(patch.normal), distance = C.dot(patch.center, normal), lift = thickness > 0 ? thickness+.01 : .012;
    assert.ok(first.ni > 0);
    let outerVertices = 0;
    for (let i = 0; i < first.n; i++) {
      const facing = Array.from(first.nor.subarray(i*3, i*3+3), x => x/127);
      if (C.dot(facing, normal) < .99) continue;
      outerVertices++;
      const position = Array.from(first.pos.subarray(i*3, i*3+3)), height = C.dot(position, normal)-distance;
      near(height, lift, 'decorative plating cannot add another physical layer above the requested armor coating');
      const projected = C.sub(position, C.mul(normal, height));
      const inward = C.add(projected, C.mul(C.norm(C.sub(patch.center, projected)), .001));
      assert.ok(C.rayTris(patch.triangles, C.add(inward, C.mul(normal, 20)), C.mul(normal, -1)), 'the authored armor footprint cannot expand');
    }
    assert.ok(outerVertices >= 6, 'the requested top armor face must actually be rendered');
    near(stats.armorMass, patch.exposedArea*thickness*C.SURFACE_MATERIALS.dense.density, 'charged armor mass');
    assert.equal(C.publicJSON(ship), source);
    const shape = geometry(first);
    host.paint = '#376aab';
    const repaintedSource = C.publicJSON(ship), repainted = G.meshSurfaceLayers(ship).surfaceArmor;
    assert.deepEqual(geometry(repainted), shape, 'changing paint must not rebuild a different physical armor shape');
    assert.notDeepEqual(Array.from(repainted.col.subarray(0, repainted.n*4)), Array.from(first.col.subarray(0, first.n*4)));
    assert.deepEqual(physical(C.computeStats(ship)), stats);
    assert.equal(C.publicJSON(ship), repaintedSource);
  }
});

const flags = geo => Array.from({length: geo.n}, (_, i) => geo.col[i*4+3]);

test('only native armor receives the plating marker, with machinery backing, solar collectors, ports and coded colors isolated', () => {
  const {ship} = armorFixture(.4);
  const ordinary = G.meshParts(ship, {coded: false});
  for (const name of ['struct', 'surfaceArmor']) {
    assert.ok(ordinary.g[name].n > 0);
    assert.ok(flags(ordinary.g[name]).every(a => a === 251), name+' must explicitly identify armor instead of inferring it from a shared mesh name');
  }
  const coded = G.meshParts(ship, {coded: true});
  for (const name of ['struct', 'surfaceArmor']) {
    assert.ok(flags(coded.g[name]).every(a => a !== 251), 'diagnostic colors must use their existing material path');
    assert.deepEqual(geometry(coded.g[name]), geometry(ordinary.g[name]));
    assert.ok(flags(ordinary.g[name]).every(a => a === 251), 'building a coded view must not mutate a cached normal material');
    assert.ok(flags(G.meshParts(ship, {coded: false}).g[name]).every(a => a === 251), 'a cached normal build must restore the same material after toggling coded view');
  }
  const equipment = fixture();
  const body = C.placePart(equipment, 'struct', [180, 70, 0], [140, 100, 60], {form: 'box'}, false);
  const faces = C.surfacePatches(equipment).filter(p => p.host === 'p'+body.id);
  assert.equal(C.setSurfaceConfig(equipment, faces.map(p => p.id), {
    functionMode: 'equipment',
    allocation: {cooling: 0, sensors: 0, habitation: 100},
    equipment: {kind: 'machinery', depth: .2},
    style: {depth: 2, density: 0, seed: 37},
  }).ok, true);
  const layers = G.meshSurfaceLayers(equipment, {}, {detail: 0, maxField: 32});
  assert.ok(layers.surfaceArmor.n > 0);
  assert.ok(flags(layers.surfaceArmor).every(a => a === 252), 'the backing and reveals share surfaceArmor storage but must not receive armor plating');
  assert.ok(flags(layers.surfaceDevices).includes(253), 'installed habitation lamps must retain their emission marker');

  const solar = fixture();
  const panel = C.placePart(solar, 'solarPanel', [180, 70, 0], [40, 60, .1], {}, false);
  const collector = G.meshParts(solar, {coded: false}).g.struct;
  assert.ok(collector.n > 0);
  assert.ok(flags(collector).every(a => a === 254), 'collector and ribs retain their own material and lighting flag');
  for (const coded of [false, true]) {
    const preview = G.meshPreview(solar, [panel], [], {coded}).preview;
    assert.ok(preview.n > 0);
    assert.ok(flags(preview).every(a => a === 254), 'dragging a collector must not turn its preview into plated armor');
  }

  const instruments = fixture();
  for (const [i, kind] of ['sensor', 'cockpit', 'astromech'].entries()) C.placePart(instruments, kind, [80+i*90, 70, 0], 12, {}, false);
  const instrumentMeshes = G.meshParts(instruments, {coded: false}).g;
  assert.ok(Object.values(instrumentMeshes).some(g => g.n > 0));
  assert.ok(Object.values(instrumentMeshes).every(g => flags(g).every(a => a !== 251)), 'instruments in a shared structural batch cannot inherit the armor pattern');

  const hull = C.newShip({L: 160, W: 100, H: 40});
  hull.parts = []; hull.fits = []; hull.detail = 0;
  const hullMesh = G.meshHull(hull);
  assert.ok(hullMesh.n > 0 && flags(hullMesh).every(a => a === 251), 'native lofted hull sides and end caps must identify their armor consistently');
});

function drawFixture() {
  const uniforms = new Map(), bound = [];
  let unit = null, draws = 0;
  const gl = new Proxy({
    uniform1f: (name, value) => uniforms.set(name, value),
    uniform1i: (name, value) => uniforms.set(name, value),
    activeTexture: value => { unit = value; },
    bindTexture: (_target, value) => bound.push({unit, value}),
    drawArrays: () => draws++,
    drawElements: () => draws++,
  }, {get: (target, key) => key in target ? target[key] : /^[A-Z_0-9]+$/.test(String(key)) ? key : () => {}});
  const renderer = Object.create(G.Renderer.prototype);
  const texture = name => ({a: name+'-color', e: name+'-emission'});
  Object.assign(renderer, {
    gl, canvas: {height: 700}, cam: {fov: .72}, off: [0, 0, 0],
    pm: {p: {}, u: new Proxy({}, {get: (_, name) => name}), a: {aPos: 0, aNor: 1, aUv: 2, aCol: 3}},
    tex: Object.fromEntries(['hull', 'struct', 'surface', 'reference', 'armor', 'fits', 'nozzle', 'gen', 'shield'].map(name => [name, texture(name)])),
    meshes: {}, lightK: 0,
    look: {L1: [0, 1, 0], L2: [1, 0, 0], C1: [1, 1, 1], C2: [0, 0, 0], sky: [1, 1, 1], gnd: [1, 1, 1], tone: 0, exp: 1},
  });
  renderer.upload = function(name, geo) { this.meshes[name] = {count: geo.ni, flat: true}; };
  const triangle = {ni: 3};
  const asset = renderer.loadFleet('armor-source-aliases', {meshes: {
    armorAlias: {source: 'struct', tex: 'struct', geo: triangle},
    machineryAlias: {source: 'surfaceDevices', tex: 'surface', geo: triangle},
    referenceAlias: {source: 'refStruct', tex: 'reference', geo: triangle},
  }});
  Object.assign(renderer.meshes, asset.meshes);
  const matrix = {VP: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], eye: [0, 100, 100]};
  return {renderer, uniforms, bound, draw(name) {
    renderer.meshes[name] ||= {count: 3, flat: true};
    uniforms.clear(); bound.length = 0; draws = 0;
    renderer.drawMesh(name, matrix, 1);
    assert.equal(draws, 1, 'armor decoration must stay in the existing mesh pass');
    return uniforms;
  }};
}

test('draw material scope and armor sampler follow native and fleet source names without adding a render pass', () => {
  const testDraw = drawFixture();
  for (const name of ['hull', 'struct', 'plate', 'surfaceArmor', 'preview', 'armorAlias']) {
    const uniforms = testDraw.draw(name);
    assert.ok(uniforms.get('uSkinScale') > 0, name+' should allow explicitly tagged armor');
    assert.equal(uniforms.get('uArmorTex'), 3, 'the atlas must be bound to a separate sampler rather than replacing machinery or reference textures');
    assert.ok(testDraw.bound.some(x => x.unit === 'TEXTURE3' && x.value === 'armor-color'));
  }
  for (const name of ['surfaceDevices', 'surfaceDetail', 'refHull', 'refStruct', 'previewRef', 'fits', 'gen', 'machineryAlias', 'referenceAlias']) {
    assert.equal(testDraw.draw(name).get('uSkinScale'), 0, name+' must retain its own material');
  }
});
