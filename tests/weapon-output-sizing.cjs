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
const near = (actual, expected, label, relative = 2e-6) => assert.ok(
  Math.abs(actual-expected) <= Math.max(2e-5, Math.abs(expected)*relative),
  `${label}: ${actual} != ${expected}`
);
const volume = size => size.reduce((product, value) => product*value, 1);
const fitting = (k, extra = {}) => ({id: 1, k, p: [0, 0, 0], a: 2, ped: 0, base: 0, low: 0, ...extra});
const dimensions = d => [d.fm, d.hm, d.wm];

function meshBounds(geo) {
  const result = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  assert.ok(geo.ni > 0, 'the renderer emitted indexed geometry');
  for (let i = 0; i < geo.ni; i++) {
    const offset = geo.idx[i]*3;
    for (let axis = 0; axis < 3; axis++) {
      const value = geo.pos[offset+axis];
      assert.ok(Number.isFinite(value), 'rendered positions are finite');
      result[axis] = Math.min(result[axis], value);
      result[axis+3] = Math.max(result[axis+3], value);
    }
  }
  return result;
}
function referenceBounds(f) {
  // Photo derivatives retain plainMetal source metadata while their copied
  // machinery now correctly uses the reference atlas. Inspect both actual
  // render outputs rather than guessing a material route from that old flag.
  const meshes = [G.meshFits({fits: [f]}), G.meshReferenceFits({fits: [f]})].filter(g => g.ni > 0);
  assert.ok(meshes.length > 0, 'the renderer emitted the fitting');
  const boxes = meshes.map(meshBounds);
  return [0, 1, 2].map(a => Math.min(...boxes.map(b => b[a])))
    .concat([0, 1, 2].map(a => Math.max(...boxes.map(b => b[a+3]))));
}
const span = bounds => [0, 1, 2].map(axis => bounds[axis+3]-bounds[axis]);

test('DBY-827 and the canonical eight-barrel turret retain their authored size as independent anchors', () => {
  for (const [k, barrels, volleyTT] of [['refVen', 2, 140], ['oct40', 8, 320]]) {
    const f = fitting(k), sizing = C.weaponSizing(f), rendered = span(referenceBounds(f));
    near(C.weaponModelScale(f), 1, `${k} anchor scale`);
    near(sizing.factor, 1, `${k} sizing scale`);
    assert.equal(sizing.barrels, barrels);
    near(sizing.volleyTT, volleyTT, `${k} anchor energy`);
    for (let axis = 0; axis < 3; axis++) near(sizing.sourceSize[axis], rendered[axis], `${k} source axis ${axis}`);
    near(sizing.sourceVolume, volume(rendered), `${k} source envelope volume`);
    near(sizing.targetVolume, sizing.sourceVolume, `${k} anchor target`);
  }
});

test('the photographed family and medium quad retain their own native size anchors', () => {
  const cases=[['single500',1,.5],['single200',1,.2],['twin200',2,.4],['twin200Fast',2,.4],['quad200',4,.8],['quad500',4,2],['single40',1,40],['quad40Ion',4,160],['twin40Dome',2,80],['twin40',2,80],['triple40',3,120],['oct40',8,320],['refVen',2,140],['triple70',3,210],['quad70Side',4,280],['stl',2,350],['ion',2,350],['triple175',3,525],['quad175',4,700],['ball175TripleIon',3,525],['ball175Quad',4,700],['ball175QuadIon',4,700],['ball720',1,720],['utl',2,1440]];
  for(const [k,barrels,volleyTT]of cases){
    // Independent photograph-ratio tests cover the chosen proportions. Here
    // the packed rendered mesh must agree with its published native size.
    const length=C.REFERENCE_ASSETS[C.FITS[k].asset].size[0];
    const f=fitting(k,k==='quad70Side'?{a:4}:{}),sizing=C.weaponSizing(f),rendered=span(referenceBounds(f));
    assert.equal(C.FITS[k].barrels,barrels);near(sizing.volleyTT,volleyTT,`${k} explicit salvo`);near(C.weaponModelScale(f),1,`${k} native photo scale`);near(sizing.factor,1,`${k} native sizing factor`);near(sizing.targetVolume,sizing.sourceVolume,`${k} native target volume`);near(rendered[k==='quad70Side'?2:0],length,`${k} photographed forward length`);
    for(let axis=0;axis<3;axis++)near(sizing.sourceSize[axis],[C.FITS[k].fm,C.FITS[k].hm,C.FITS[k].wm][axis],`${k} canonical native axis${axis}`);
    assert.match(sizing.calibration,/photo/i,`${k} is explicitly calibrated to the family photograph`);
  }
  const photo=JSON.parse(fs.readFileSync(path.join(root,'assets/source/turret-photo-measurements.json'),'utf8')),twinPhoto=photo.profile40.twin40;
  near(C.FITS.twin40.fm/C.FITS.oct40.fm,twinPhoto.physicalTargetsM.wholeLength/photo.anchor.metres,'40 TT twin-to-octuple measured photo ratio',twinPhoto.relativeTolerance);near(C.FITS.refVen.tt,140,'DBY-827 remains a 140 TT salvo');near(C.FITS[C.canonicalWeaponKind('refSide')].tt,80,'legacy side-twin inventory keeps its80 TT salvo');
});

test('point defense adopts the photographed side-carrier model at its native scale', () => {
 const f=fitting('pd'),d=C.FITS.pd,sizing=C.weaponSizing(f),a=C.REFERENCE_ASSETS[d.asset];
 assert.equal(d.asset,'pd_twin_side_laser');assert.equal(d.barrels,2);assert.equal(d.boltTT,1e-7);assert.equal(d.tt,2e-7);assert.equal(d.cycle,.2);assert.equal(d.aa,6);assert.equal(d.dualPurpose,true);
 near(d.power,d.tt*C.TT/d.cycle,'PD continuous electrical demand');near(sizing.factor,1,'PD photo scale');assert.equal(sizing.calibration,'point-defense-photo');
 const triangles=(G.meshFits({fits:[f]}).ni+G.meshReferenceFits({fits:[f]}).ni)/3;
 assert.equal(triangles,a.faces);assert.ok(triangles>0&&triangles<=5000,'PD remains within the modeled turret budget');
 const rendered=span(referenceBounds(f));for(let axis=0;axis<3;axis++){near(sizing.sourceSize[axis],a.size[axis],'native source axis'+axis);near(rendered[axis],a.size[axis],'visible source axis'+axis);}near(d.r,Math.max(a.size[0],a.size[2])/2,'native swept radius');
});

test('retired generic guns resolve to the canonical light quad, DBY and point-defense definitions', () => {
  for (const [k, canonical, salvo, barrels, cycle] of [
    ['ltl', 'pd', 2e-7, 2, .2], ['mtl', 'quad200', .8, 4, .2],
    ['htl', 'refVen', 140, 2, 1]
  ]) {
    const d = C.fitSpec(fitting(k));
    assert.equal(C.canonicalWeaponKind(k), canonical);
    assert.equal(d, C.FITS[canonical], `${k} shares the complete canonical definition`);
    assert.equal(Object.keys(C.FITS).includes(k), false, `${k} is absent from the catalog`);
    near(Math.max(d.tt || 0, d.ion || 0), salvo, `${k} canonical salvo`,Math.max(1e-18,Math.abs(salvo)*1e-9));
    assert.equal(d.barrels, barrels, `${k} canonical barrels`);
    assert.equal(d.cycle, cycle, `${k} canonical cycle`);
  }
  near(C.FITS.oct40.tt, 320, 'the canonical octuple keeps its 320 TT rating');
  near(C.FITS.stl.tt, 350, 'the canonical heavy twin keeps its 350 TT rating');
});

test('aircraft weapons, fixed launchers, missiles, tractors and bridge equipment keep their existing dimensions', () => {
  const excluded = {
    claser: [2.6, .32, .32], claserH: [3.6, .5, .5],
    cturret: [1.3, .7, 1.3], ctorp: [1.4, .5, .5], cmsl: [1.2, .45, .45],
    cbomb: [2.4, .7, 1.2], cpylon: [1.2, .2, .16], msl: [1.2, .45, .45],
    itl: [12, 3, 12], trc: [16, 8, 16], brS: [34, 22, 26]
  };
  for (const [k, expected] of Object.entries(excluded)) {
    near(C.weaponModelScale(fitting(k)), 1, `${k} excluded scale`);
    assert.deepEqual(plain(dimensions(C.FITS[k])), expected, `${k} unchanged dimensions`);
  }
});

test('imported gun rendering, selection and collision use the same scaled geometry for every mount frame', () => {
  for (const k of ['refVen', 'oct40', 'stl', 'quad500', 'twin40']) {
    for (const a of [0, 1, 2, 3, 4, 5]) {
      for (const tilt of [null, C.norm([.2, .9, -.3])]) {
        const f = fitting(k, {a, p: [31, -7, 9], assetYaw: 37, ...(tilt ? {tilt} : {})});
        const rendered = referenceBounds(f), collision = C.fitAABB(f);
        assert.ok(collision.every(Number.isFinite), `${k} finite selection bounds`);
        for (let axis = 0; axis < 3; axis++) {
          assert.ok(rendered[axis] >= collision[axis]-1e-4, `${k} lower bound axis ${axis}, mount ${a}`);
          assert.ok(rendered[axis+3] <= collision[axis+3]+1e-4, `${k} upper bound axis ${axis}, mount ${a}`);
        }
      }
    }
  }
});

test('model calibration preserves authored pose and mount origin while scaling the whole imported model', () => {
  for (const k of ['oct40', 'stl']) {
    const f = fitting(k), sizing = C.weaponSizing(f), rendered = span(referenceBounds(f));
    for (let axis = 0; axis < 3; axis++) near(rendered[axis], sizing.sourceSize[axis]*sizing.factor, `${k} complete mesh axis ${axis}`);
    const shift = [41, -5, 3], moved = {...f, p: shift};
    const origin = C.fitOrigin(f), movedOrigin = C.fitOrigin(moved);
    const before = C.referenceFitPoint(f, [.23, -.17, .39]);
    const after = C.referenceFitPoint(moved, [.23, -.17, .39]);
    for (let axis = 0; axis < 3; axis++) {
      near(movedOrigin[axis]-origin[axis], shift[axis], `${k} mount translation`);
      near(after[axis]-before[axis], shift[axis], `${k} mesh follows mounting origin`);
    }
  }
});

test('native gun bodies retain uniform calibration while explicit pedestal height stays fixed', () => {
  // Render the real authored meshes with only the one-time sizing pass disabled.
  // This compares whole shapes rather than reproducing the renderer's dimensions.
  const baseline = vm.createContext({console, performance: {now: () => 0}});
  for (const file of ['data/reference.js', 'data/imperial2.js', 'data/fleet.js', 'js/core.js', 'js/gfx.js']) {
    let source = fs.readFileSync(path.join(root, file), 'utf8');
    if (file === 'js/core.js') {
      const initialization = '\ninitializeWeaponSizing();\n';
      assert.equal(source.split(initialization).length, 2, 'the baseline disables exactly one sizing initialization');
      // PD's sizing pass also restores the source model's swept radius from
      // its length. Keep that unscaled source sweep in this authored baseline.
      source = source.replace(initialization, '\n/* Test baseline: keep authored weapon dimensions. */\nFITS.pd.r=4.5;\n');
    }
    vm.runInContext(source, baseline, {filename: file});
  }
  const {C: originalCore, G: originalGfx} = vm.runInContext('({C: Core, G: Gfx})', baseline);
  const complete=(gfx,f)=>{const a=gfx.meshFits({fits:[f]}),b=gfx.meshReferenceFits({fits:[f]}),pos=Float32Array.from([...a.pos.slice(0,a.n*3),...b.pos.slice(0,b.n*3)]),idx=Uint32Array.from([...a.idx.slice(0,a.ni),...Array.from(b.idx.slice(0,b.ni),i=>i+a.n)]);return {n:a.n+b.n,ni:a.ni+b.ni,pos,idx};};
  for (const k of ['pd', 'utl']) {
    for (const frame of [{a: 2}, {a: 4, tilt: C.norm([.2, .9, -.3])}]) {
      const f = fitting(k, {p: [13, -7, 11], assetYaw: 31, ...frame});
      const factor = C.weaponModelScale(f), origin = C.fitOrigin(f);
      const before = complete(originalGfx,f), after = complete(G,f);assert.ok(before.ni>0,'the complete native gun body is actually compared');
      assert.equal(after.n, before.n, `${k} keeps body topology`);
      assert.deepEqual(Array.from(after.idx.slice(0, after.ni)), Array.from(before.idx.slice(0, before.ni)), `${k} keeps triangle connectivity`);
      for (let vertex = 0; vertex < before.n; vertex++) {
        for (let axis = 0; axis < 3; axis++) {
          near(after.pos[vertex*3+axis], origin[axis]+(before.pos[vertex*3+axis]-origin[axis])*factor, `${k} uniformly scaled body vertex ${vertex}, axis ${axis}`);
        }
      }

      const lifted = {...f, base: 0, ped: 3, low: 0, pedShape: 'trap'};
      const oldLiftedOrigin = originalCore.fitOrigin(lifted), liftedOrigin = C.fitOrigin(lifted);
      assert.deepEqual(plain(liftedOrigin), plain(oldLiftedOrigin), `${k} explicit mounting height is unchanged`);
      const oldLifted = complete(originalGfx,lifted), newLifted = complete(G,lifted);
      const supportVertices = newLifted.n-after.n;
      assert.ok(supportVertices > 0, `${k} renders the requested support`);
      assert.equal(oldLifted.n-before.n, supportVertices, `${k} keeps support topology`);
      const up = C.fitUp(lifted);
      let lower = Infinity, upper = -Infinity;
      for (let vertex = 0; vertex < supportVertices; vertex++) {
        const oldPoint = Array.from(oldLifted.pos.slice(vertex*3, vertex*3+3));
        const newPoint = Array.from(newLifted.pos.slice(vertex*3, vertex*3+3));
        const delta = C.sub(oldPoint, oldLiftedOrigin), height = C.dot(delta, up);
        const radial = C.sub(delta, C.mul(up, height));
        const expected = C.add(liftedOrigin, C.add(C.mul(radial, factor), C.mul(up, height)));
        for (let axis = 0; axis < 3; axis++) near(newPoint[axis], expected[axis], `${k} support radius scales without moving height`);
        const newHeight = C.dot(C.sub(newPoint, liftedOrigin), up);
        lower = Math.min(lower, newHeight); upper = Math.max(upper, newHeight);
      }
      near(lower, -3, `${k} explicitly requested support fills three metres below the mount`);
      near(upper, 0, `${k} support still meets the mounting origin`);
      for (let vertex = 0; vertex < after.n; vertex++) {
        for (let axis = 0; axis < 3; axis++) {
          near(newLifted.pos[(vertex+supportVertices)*3+axis]-after.pos[vertex*3+axis], liftedOrigin[axis]-origin[axis], `${k} body follows explicit support height`);
        }
      }
    }
  }
});

test('standard-size normalization and save reload retain calibration without a manual fitting scale', () => {
  const ship = C.newShip({L: 240, W: 200, H: 140, assembly: true}, 'Calibrated weapon sizes');
  ship.parts = [];
  ship.fits = ['pd', 'ltl', 'refVen', 'oct40', 'stl', 'quad500', 'twin40'].map((k, index) => fitting(k, {id: index+1, p: [40+index*40, 60, 0], float: true, scale: 3}));
  const loaded = C.deserialize(C.serialize(ship));
  for (const f of loaded.fits) {
    assert.equal(Object.hasOwn(f, 'scale'), false, `${f.k} obsolete manual scale is normalized`);
    near(C.weaponModelScale(f), C.weaponModelScale(fitting(f.k)), `${f.k} canonical model size survives reload`);
    assert.deepEqual(plain(dimensions(C.fitSpec(f))), plain(dimensions(C.FITS[f.k])));
  }
  const again = C.deserialize(C.serialize(loaded));
  assert.deepEqual(plain(again.fits), plain(loaded.fits), 'repeated save/reload does not accumulate a visual scale');
});
