const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');
const root = path.resolve(process.env.KS_TEST_ROOT || path.join(__dirname, '..'));
const context = vm.createContext({console, performance: {now: () => 12345}});
for (const file of ['data/reference.js', 'data/imperial2.js', 'data/fleet.js', 'js/core.js', 'js/gfx.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, {filename: file});
}
const {C, G} = vm.runInContext('({C:Core,G:Gfx})', context);
const plain = value => JSON.parse(JSON.stringify(value));
const I = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const VP = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const apply = (R, p) => [R[0]*p[0]+R[3]*p[1]+R[6]*p[2], R[1]*p[0]+R[4]*p[1]+R[7]*p[2], R[2]*p[0]+R[5]*p[1]+R[8]*p[2]];
function near(actual, expected, message = 'vector') {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-6, `${message} [${i}]: ${value} != ${expected[i]}`));
}
function fixture() {
  const ship = C.newShip({assembly: true, L: 100, W: 30, H: 20});
  ship.detail = 0;
  ship.parts = [
    {id: 1, k: 'struct', form: 'box', c: [50, 15, 15], s: [20, 20, 2], wing: C.normalizeWing({foil: true, axis: 'x', pivot: [50, 15, 5], stow: 0, open: 90, T: 2})},
    {id: 2, k: 'struct', form: 'box', c: [50, 15, 23], s: [4, 4, 4]},
    {id: 3, k: 'struct', form: 'box', c: [10, 10, 0], s: [10, 10, 10]},
  ];
  ship.fits = ['claser', 'cturret', 'msl'].map((k, i) => ({id: 5+i, k, p: [45+i*5, 16, 20], n: [0, 1, 0], a: 2, base: 0, ped: 0, low: 0, host: 1}));
  ship.nextId = 10;
  return ship;
}
function triangles(g) {
  const result = [];
  for (let i = 0; i < g.ni; i += 3) result.push(Array.from(g.idx.slice(i, i+3)).map(index =>
    [...g.pos.slice(index*3, index*3+3), ...g.nor.slice(index*3, index*3+3)]).flat().join(','));
  return result;
}

test('public foil transforms match arbitrary-pivot core poses at endpoints and halfway on all axes', () => {
  for (const axis of ['x', 'y', 'z']) {
    const ship = fixture(), wing = ship.parts[0];
    wing.wing.axis = axis;
    const frame = C.foilFrame(ship, wing), foil = {pivot: frame.pv, sg: frame.sg, axis, ...wing.wing};
    const point = [63.25, 19.5, -8.75], direction = [0, 1, 0];
    for (const d of [0, .5, 1]) {
      const transform = G.foilTransform(foil, d), angle = wing.wing.stow + (wing.wing.open-wing.wing.stow)*d;
      near(transform.point(point), C.foilAt(frame, wing, point, angle));
      near(transform.point(foil.pivot), foil.pivot, 'hinge stays fixed');
      near(C.sub(transform.point(C.add(point, direction)), transform.point(point)), transform.direction(direction), 'normals use the same rotation');
      assert.ok(Math.abs(C.len(transform.direction(direction))-1) < 1e-9);
    }
    near(G.foilTransform(foil).point(point), point, 'missing fraction preserves design pose');
    near(G.foilTransform(foil, -10).point(point), G.foilTransform(foil, 0).point(point));
    near(G.foilTransform(foil, 10).point(point), point);
  }
});

test('geometry partitions wing, carried structures and fittings without duplicate deployed triangles', () => {
  const ship = fixture(), beforeParts = G.meshParts(ship, {coded: false}), beforeFits = G.meshFits(ship);
  const geometry = G.fleetGeometry(ship), foil = geometry.foils[0];
  assert.deepEqual(plain(foil.partIds), [1, 2]);
  assert.deepEqual(plain(foil.fitIds), [5, 6, 7]);
  near(foil.pivot, [50, 15, 5]);
  for (const [source, original] of [['struct', beforeParts.g.struct], ['fits', beforeFits]]) {
    const partitioned = [geometry.meshes[source].geo, ...foil.meshes.filter(name => foil.kinds[name] === source).map(name => geometry.meshes[name].geo)];
    assert.deepEqual(partitioned.flatMap(triangles).sort(), triangles(original).sort(), `${source} triangles and normals are preserved once`);
  }
  const stationary = geometry.meshes.struct.geo;
  for (let i = 2; i < stationary.n*3; i += 3) assert.ok(stationary.pos[i] <= 5, 'the deployed wing is absent from the static mesh');
  assert.equal(geometry.meshes.fits.geo.ni, 0);
  const trial = G.fleetGeometry(fixture(), {trial: true});
  assert.equal(trial.turrets.find(t => t.id === 6).foilId, 1);
  assert.equal(trial.launchers.find(l => l.id === 7).foilId, 1);
  assert.ok(trial.meshes.tur_6.geo.ni > 0, 'turning turret is separate from its moving pedestal');
});

function canvas() {
  let image;
  const element = {width: 32, height: 32, clientWidth: 32, clientHeight: 32, getContext: () => ({
    createImageData: (w, h) => ({data: new Uint8ClampedArray(w*h*4)}), putImageData: value => {image = value;},
  })};
  const outputs = [];
  element.ownerDocument = {createElement: () => {const output = {getContext: () => ({drawImage: () => {output.pixels = image?.data.slice();}})};outputs.push(output);return output;}};
  return {element, outputs, pixel: () => Array.from(image.data.slice((element.width*(element.height>>1)+(element.width>>1))*4, (element.width*(element.height>>1)+(element.width>>1))*4+3))};
}
function gpu(data) {
  const calls = [], points = {}, r = Object.create(G.Renderer.prototype), {element} = canvas();
  r.canvas = element;
  r.gl = new Proxy({}, {get: (target, key) => key === 'isContextLost' ? () => false : () => {}});
  r.off = [99, 88, 77];r.meshes = {designer: {}};r.cam = {target: [0, 0, 0], fov: .72};r.look = {shadow: false};
  r.eye = () => [0, 0, 100];r.upload = function(name, geo) {this.meshes[name] = {count: geo.ni, geo};};
  r.drawMesh = function(name) {if (this.meshes[name]?.count) calls.push({name, off: [...this.off], center: [...this.modelCenter], rot: [...(this.modelRot || I)]});};
  r.setLights = r.drawRays = r.drawLines = r.drawPoints = () => {};
  r.setPoints = (name, pos) => {points[name] = pos;};
  const asset = r.loadFleet('test', data);
  return {r, calls, points, asset};
}
function placed(call, vertex) {return C.add(call.off, apply(call.rot, C.sub(vertex, call.center)));}

test('WebGL draws each ship at its current fraction, restores state and moves wing-engine glow', () => {
  const geometry = G.fleetGeometry(fixture()), foil = geometry.foils[0];
  foil.glow = [53, 17, 23, 1];
  const {r, calls, points, asset} = gpu(geometry), originalMeshes = r.meshes, originalOff = r.off;
  const rotation = [0, 1, 0, -1, 0, 0, 0, 0, 1];
  const unit = {key: 'test', pos: [10, 20, 30], rot: rotation, foils: {1: .5}, glow: 0};
  r.drawFleet({VP, eye: r.eye()}, {fleet: [unit]});
  const moving = calls.find(c => c.name === 'foil_1_struct'), vertex = [54, 15, 22], T = G.foilTransform(foil, .5);
  near(placed(moving, vertex), C.add(unit.pos, apply(rotation, C.sub(T.point(vertex), asset.center))));
  near(apply(moving.rot, [0, 1, 0]), apply(rotation, T.direction([0, 1, 0])));
  near(points.fleetGlow.slice(0, 3), C.add(unit.pos, apply(rotation, C.sub(T.point([53, 17, 23]), asset.center))));
  assert.equal(calls.filter(c => c.name === 'foil_1_struct').length, 1);
  assert.equal(r.meshes, originalMeshes);assert.equal(r.off, originalOff);assert.equal(r.modelCenter, null);assert.equal(r.modelRot, null);assert.equal(r.unitScl, null);
  calls.length = 0;r.drawFleet({VP, eye: r.eye()}, {fleet: [{...unit, foils: {1: 0}}, {...unit, pos: [100, 20, 30], foils: {1: 1}}]});
  const poses = calls.filter(c => c.name === 'foil_1_struct');assert.equal(poses.length, 2);
  near(placed(poses[1], vertex), C.add([100, 20, 30], apply(rotation, C.sub(vertex, asset.center))), 'other ships retain their own deployment');
  assert.notDeepEqual(plain(poses[0].rot), plain(poses[1].rot));
});

test('static shadow tiles are skipped for a moving hinge and retained for the design pose', () => {
  const {r} = gpu(G.fleetGeometry(fixture()));let shadowCalls = 0;r.canvas.height = 512;r.look.shadow = true;r.shadowFleet = () => {shadowCalls++;return null;};
  r.drawFleet({VP, eye: r.eye()}, {fleet: [{key: 'test', pos: [0, 0, 0], foils: {1: .5}}]});
  assert.equal(shadowCalls, 0, 'avoid a deployed-position ghost shadow');
  r.drawFleet({VP, eye: r.eye()}, {fleet: [{key: 'test', pos: [0, 0, 0], foils: {1: 1}}]});
  assert.equal(shadowCalls, 1);
});

test('both renderers use the original turret mesh pivot with an already-posed aiming frame', () => {
  const data = G.fleetGeometry(fixture(), {trial: true}), foil = data.foils[0], turret = data.turrets.find(t => t.id === 6), T = G.foilTransform(foil, .5);
  const unit = {key: 'test', pos: [10, 20, 30], rot: I, foils: {1: .5}, turrets: [{mesh: turret.mesh, pivot: T.point(turret.pivot), rot: T.rot}]};
  const g = gpu(data);g.r.drawFleet({VP, eye: g.r.eye()}, {fleet: [unit]});
  const c = new G.CompatRenderer(canvas().element), calls = [];c.matrices = () => ({VP});c.paintLines = () => {};c.loadFleet('test', data);
  c.rasterMesh = (geo, name, alpha, clip, transform) => {if (geo === data.meshes[turret.mesh].geo) calls.push(transform);};c.draw({fleet: [unit]});
  const vertex = C.add(turret.pivot, [1, 2, 3]), expected = C.add(unit.pos, C.sub(T.point(vertex), data.center));
  near(placed(g.calls.find(call => call.name === turret.mesh), vertex), expected, 'GPU turret');
  near(placed(calls[0], vertex), expected, 'software turret');
});

test('software normals and captures follow the current articulated pose without duplicating meshes', () => {
  const {element, pixel} = canvas(), r = new G.CompatRenderer(element);r.matrices = () => ({VP});r.paintLines = () => {};
  const geo = {n: 3, ni: 3, pos: new Float32Array([-.5,-.5,0,.5,-.5,0,0,.5,0]), nor: new Int8Array([127,0,0,127,0,0,127,0,0]), col: new Uint8Array([100,100,100,255,100,100,100,255,100,100,100,255]), idx: new Uint16Array([0,1,2])};
  const foil = {id: 1, pivot: [0,0,0], axis: 'z', sg: 1, open: 0, stow: 90, meshes: ['foil_1_fits'], kinds: {foil_1_fits: 'fits'}};
  const data = {center: [0,0,0], meshes: {foil_1_fits: {geo}}, foils: [foil], glow: []}, asset = r.loadFleet('test', data);
  assert.equal(asset.extra.length, 0, 'foil meshes must not enter the generic extra-mesh path');
  const unit = {key: 'test', pos: [0,0,0], foils: {1: 1}}, originalMeshes = r.meshes, originalOff = r.off;
  r.draw({fleet: [unit]});assert.deepEqual(pixel(), [68,68,68]);
  unit.foils = {1: 0};r.draw({fleet: [unit]});assert.deepEqual(pixel(), [96,96,96], 'rotated normals receive upward light');
  unit.foils = {1: .5};const options = {fleet: [unit]};r.draw(options);const before = pixel();
  const output = r.capture(2);assert.equal(output.width, 64);assert.equal(output.height, 64);
  assert.deepEqual(Array.from(output.pixels.slice((32*64+32)*4, (32*64+32)*4+3)), before);
  assert.deepEqual(pixel(), before);assert.equal(r._lastDrawOptions, options);assert.equal(r.meshes, originalMeshes);assert.equal(r.off, originalOff);assert.equal(Object.hasOwn(r, '_frame'), false);
});

test('prepareFleet and loadFleet retain articulation metadata in both renderer implementations', () => {
  const data = G.fleetGeometry(fixture()), g = gpu(data), c = new G.CompatRenderer(canvas().element);
  assert.equal(g.asset.foils, data.foils);assert.equal(c.loadFleet('test', data).foils, data.foils);
  assert.equal(g.r.prepareFleet('prepared', fixture()).foils.length, 1);
  assert.equal(c.prepareFleet('prepared', fixture()).foils.length, 1);
});
