/* ============================================================
   gfx.js — small WebGL1 renderer for the smooth-hull shipyard.
   Lofted hull mesh with crease-aware normals, solid compartment
   meshes, tiling procedural panel textures, fittings with auto
   pedestals, decal hatches, section clipping, glow, lines.
   ============================================================ */
const Gfx = (() => {
'use strict';
const C = Core;

// ---------- matrices (column-major) ----------
const M4 = {
  persp(fovy, asp, n, f) {
    const t = 1 / Math.tan(fovy / 2), nf = 1 / (n - f);
    return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) * nf, -1, 0, 0, 2 * f * n * nf, 0]);
  },
  ortho(height,asp,n,f){const w=height*asp;return new Float32Array([2/w,0,0,0,0,2/height,0,0,0,0,-2/(f-n),0,0,0,-(f+n)/(f-n),1]);},
  lookAt(e, c, u) {
    let z0 = e[0] - c[0], z1 = e[1] - c[1], z2 = e[2] - c[2];
    let l = 1 / Math.hypot(z0, z1, z2); z0 *= l; z1 *= l; z2 *= l;
    let x0 = u[1] * z2 - u[2] * z1, x1 = u[2] * z0 - u[0] * z2, x2 = u[0] * z1 - u[1] * z0;
    l = Math.hypot(x0, x1, x2); if (l) { l = 1 / l; x0 *= l; x1 *= l; x2 *= l; }
    const y0 = z1 * x2 - z2 * x1, y1 = z2 * x0 - z0 * x2, y2 = z0 * x1 - z1 * x0;
    return new Float32Array([x0, y0, z0, 0, x1, y1, z1, 0, x2, y2, z2, 0,
      -(x0 * e[0] + x1 * e[1] + x2 * e[2]), -(y0 * e[0] + y1 * e[1] + y2 * e[2]), -(z0 * e[0] + z1 * e[1] + z2 * e[2]), 1]);
  },
  mul(a, b) {
    const o = new Float32Array(16);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      let s = 0; for (let k = 0; k < 4; k++) s += a[i + k * 4] * b[k + j * 4]; o[i + j * 4] = s;
    }
    return o;
  },
  inv(m) {
    const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3], a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
    const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11], a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return null; det = 1 / det;
    return new Float32Array([
      (a11 * b11 - a12 * b10 + a13 * b09) * det, (a02 * b10 - a01 * b11 - a03 * b09) * det, (a31 * b05 - a32 * b04 + a33 * b03) * det, (a22 * b04 - a21 * b05 - a23 * b03) * det,
      (a12 * b08 - a10 * b11 - a13 * b07) * det, (a00 * b11 - a02 * b08 + a03 * b07) * det, (a32 * b02 - a30 * b05 - a33 * b01) * det, (a20 * b05 - a22 * b02 + a23 * b01) * det,
      (a10 * b10 - a11 * b08 + a13 * b06) * det, (a01 * b08 - a00 * b10 - a03 * b06) * det, (a30 * b04 - a31 * b02 + a33 * b00) * det, (a21 * b02 - a20 * b04 - a23 * b00) * det,
      (a11 * b07 - a10 * b09 - a12 * b06) * det, (a00 * b09 - a01 * b07 + a02 * b06) * det, (a31 * b01 - a30 * b03 - a32 * b00) * det, (a20 * b03 - a21 * b01 + a22 * b00) * det]);
  },
  xf(m, v) {
    const x = v[0], y = v[1], z = v[2], w = m[3] * x + m[7] * y + m[11] * z + m[15];
    return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w, (m[2] * x + m[6] * y + m[10] * z + m[14]) / w];
  },
};

// ---------- geometry buffer ----------
class Geo {
  constructor(cap) { this.cap = 0; this.icap = 0; this.n = 0; this.ni = 0; this.grow(cap || 4096, (cap || 4096) * 2); }
  grow(cap, icap) {
    if (cap > this.cap) {
      const p = new Float32Array(cap * 3), no = new Int8Array(cap * 3), uv = new Float32Array(cap * 2), c = new Uint8Array(cap * 4);
      if (this.cap) { p.set(this.pos.subarray(0, this.n * 3)); no.set(this.nor.subarray(0, this.n * 3)); uv.set(this.uv.subarray(0, this.n * 2)); c.set(this.col.subarray(0, this.n * 4)); }
      this.pos = p; this.nor = no; this.uv = uv; this.col = c; this.cap = cap;
    }
    if (icap > this.icap) {
      const ix = new Uint32Array(icap);
      if (this.icap) ix.set(this.idx.subarray(0, this.ni));
      this.idx = ix; this.icap = icap;
    }
  }
  room(v, ni) {
    const need = ni == null ? v * 2 : ni;
    if (this.n + v > this.cap || this.ni + need > this.icap) this.grow(Math.max(this.cap * 2, this.n + v + 1024), Math.max(this.icap * 2, this.ni + need + 2048));
  }
  v(x, y, z, nx, ny, nz, u, w, col, a) {
    const k = this.n++;
    this.pos[k * 3] = x; this.pos[k * 3 + 1] = y; this.pos[k * 3 + 2] = z;
    this.nor[k * 3] = nx * 127; this.nor[k * 3 + 1] = ny * 127; this.nor[k * 3 + 2] = nz * 127;
    this.uv[k * 2] = u; this.uv[k * 2 + 1] = w;
    this.col[k * 4] = col[0]; this.col[k * 4 + 1] = col[1]; this.col[k * 4 + 2] = col[2]; this.col[k * 4 + 3] = a == null ? 255 : a;
    return k;
  }
  tri(a, b, c) { this.idx[this.ni++] = a; this.idx[this.ni++] = b; this.idx[this.ni++] = c; }
}

// ---------- procedural tiling textures ----------
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const sh = (v) => { const c = Math.round(Math.max(0, Math.min(255, v))); return `rgb(${c},${c},${c})`; };
function pair(W, H) {
  const a = document.createElement('canvas'), e = document.createElement('canvas');
  a.width = e.width = W; a.height = e.height = H || W;
  const g = a.getContext('2d'), ge = e.getContext('2d'); ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H || W);
  return {a, e, g, ge};
}
function plates(g, R, S, cells, base, spread, depth) {
  const cell = S / cells;
  const plate = (x, y, w, h, d) => {
    if (d > 0 && w > 10 && h > 10 && R() < 0.6) {
      if (R() < 0.5) { const s = Math.round(w * (0.3 + R() * 0.4)); plate(x, y, s, h, d - 1); plate(x + s, y, w - s, h, d - 1); }
      else { const s = Math.round(h * (0.3 + R() * 0.4)); plate(x, y, w, s, d - 1); plate(x, y + s, w, h - s, d - 1); }
      return;
    }
    const v = base + (R() - 0.5) * spread;
    g.fillStyle = sh(v); g.fillRect(x, y, w, h);
    g.fillStyle = sh(v - 42); g.fillRect(x, y, w, 1); g.fillRect(x, y, 1, h);
    g.fillStyle = sh(v + 12); g.fillRect(x + 1, y + h - 1, w - 1, 1);
  };
  for (let i = 0; i < cells; i++) for (let j = 0; j < cells; j++) plate(i * cell, j * cell, cell, cell, depth);
}
function makeTextures() {
  const T = {}, R = rng(1977);
  { // hull: 512 px = 96 m
    const S = 512, {a, e, g, ge} = pair(S);
    plates(g, R, S, 8, 206, 13, 3);
    for (let k = 0; k < 34; k++) { const w = 6 + R() * 30, h = 4 + R() * 12, x = R() * (S - w), y = R() * (S - h); g.fillStyle = sh(178 + R() * 22); g.fillRect(x, y, w, h); g.fillStyle = sh(150); g.fillRect(x, y + h - 1, w, 1); }
    for (let k = 0; k < 3; k++) { const y = (R() * S) | 0; g.fillStyle = sh(118); g.fillRect(0, y, S, 3); g.fillStyle = sh(232); g.fillRect(0, y + 3, S, 1); }
    // Skin is non-emissive plating. Windows are explicit, wall-mounted fittings.
    T.hull = {a, e};
  }
  { // superstructure: non-emissive armor seams and maintenance panels
    const S = 256, {a, e, g, ge} = pair(S);
    plates(g, R, S, 4, 213, 9, 3);
    T.struct = {a, e};
  }
  { // hangar interior
    const S = 256, {a, e, g, ge} = pair(S);
    g.fillStyle = '#3a4148'; g.fillRect(0, 0, S, S);
    g.fillStyle = '#2b3137'; g.fillRect(12, 12, S - 24, S - 24);
    for (let k = 0; k < 5; k++) { const y = 30 + k * 46; g.fillStyle = '#5b636b'; g.fillRect(16, y, S - 32, 4); ge.fillStyle = 'rgba(200,226,255,0.6)'; ge.fillRect(16, y, S - 32, 3); }
    g.fillStyle = '#6b737b'; g.fillRect(0, 0, S, 3); g.fillRect(0, 0, 3, S); g.fillRect(0, S - 3, S, 3); g.fillRect(S - 3, 0, 3, S);
    T.hangar = {a, e};
  }
  { // open hatch: dark deck with guide lights (u along the strip)
    const S = 256, {a, e, g, ge} = pair(S);
    g.fillStyle = '#2a2f34'; g.fillRect(0, 0, S, S);
    g.fillStyle = '#353b41'; for (let k = 0; k < 8; k++) g.fillRect(k * 32, 0, 1, S);
    for (const y of [10, S - 18]) for (let x = 6; x < S; x += 32) { g.fillStyle = '#c8902f'; g.fillRect(x, y, 10, 8); ge.fillStyle = 'rgba(255,176,60,1)'; ge.fillRect(x, y, 10, 8); }
    g.fillStyle = '#4c535a'; g.fillRect(0, S / 2 - 2, S, 4);
    T.hatch = {a, e};
  }
  { // ray-shielded aperture
    const S = 256, {a, e, g, ge} = pair(S);
    g.fillStyle = '#1c3a52'; g.fillRect(0, 0, S, S);
    const gr = ge.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, 'rgba(70,170,255,0.6)'); gr.addColorStop(0.5, 'rgba(120,214,255,0.9)'); gr.addColorStop(1, 'rgba(70,170,255,0.6)');
    ge.fillStyle = gr; ge.fillRect(0, 0, S, S);
    for (let k = 0; k < 16; k++) { ge.fillStyle = 'rgba(200,244,255,0.55)'; ge.fillRect(0, k * 16 + 4, S, 2); }
    T.ray = {a, e};
  }
  { // generator: banded vents
    const S = 256, {a, e, g, ge} = pair(S);
    g.fillStyle = sh(200); g.fillRect(0, 0, S, S);
    plates(g, R, S, 4, 200, 10, 1);
    for (const y of [40, 168]) { g.fillStyle = '#3b2c22'; g.fillRect(0, y, S, 28); g.fillStyle = sh(150); g.fillRect(0, y - 2, S, 2); g.fillRect(0, y + 28, S, 2); ge.fillStyle = 'rgba(255,128,36,0.9)'; for (let x = 0; x < S; x += 16) ge.fillRect(x + 3, y + 6, 10, 16); }
    T.gen = {a, e};
  }
  { // shield projector: grid
    const S = 256, {a, e, g, ge} = pair(S);
    g.fillStyle = sh(206); g.fillRect(0, 0, S, S);
    for (let k = 0; k < 8; k++) { g.fillStyle = sh(150); g.fillRect(k * 32, 0, 2, S); g.fillRect(0, k * 32, S, 2); ge.fillStyle = 'rgba(80,255,222,0.45)'; ge.fillRect(k * 32, 0, 2, S); ge.fillRect(0, k * 32, S, 2); }
    T.shield = {a, e};
  }
  { // hyperdrive: coils (v along the axis)
    const S = 256, {a, e, g, ge} = pair(S);
    g.fillStyle = sh(186); g.fillRect(0, 0, S, S);
    for (let k = 0; k < 8; k++) { const y = k * 32; g.fillStyle = sh(110); g.fillRect(0, y + 4, S, 16); ge.fillStyle = 'rgba(176,122,255,0.55)'; ge.fillRect(0, y + 8, S, 8); }
    T.hyper = {a, e};
  }
  { // nozzle disc
    const S = 256, {a, e, g, ge} = pair(S), c = S / 2;
    g.fillStyle = '#30363d'; g.fillRect(0, 0, S, S);
    const gg = g.createRadialGradient(c, c, 2, c, c, c * 0.92); gg.addColorStop(0, '#ffffff'); gg.addColorStop(0.55, '#a8d8ff'); gg.addColorStop(1, '#22344a');
    g.fillStyle = gg; g.beginPath(); g.arc(c, c, c * 0.86, 0, Math.PI * 2); g.fill();
    const ee = ge.createRadialGradient(c, c, 2, c, c, c * 0.9); ee.addColorStop(0, 'rgba(255,255,255,1)'); ee.addColorStop(0.4, 'rgba(170,225,255,1)'); ee.addColorStop(0.85, 'rgba(60,150,255,0.8)'); ee.addColorStop(1, 'rgba(20,60,140,0)');
    ge.fillStyle = ee; ge.beginPath(); ge.arc(c, c, c * 0.9, 0, Math.PI * 2); ge.fill();
    T.nozzle = {a, e};
  }
  { // fittings: left = light panels, right = window band
    const {a, e, g, ge} = pair(256, 128);
    g.fillStyle = sh(232); g.fillRect(0, 0, 128, 128);
    for (let k = 0; k < 8; k++) { g.fillStyle = sh(214); g.fillRect(8 + R() * 90, 8 + R() * 90, 10 + R() * 20, 6 + R() * 14); }
    g.fillStyle = '#e4e6e8'; g.fillRect(128, 0, 128, 128);
    g.fillStyle = '#2b3036'; g.fillRect(128, 40, 128, 48);
    for (let k = 0; k < 12; k++) { ge.fillStyle = 'rgba(160,215,255,0.95)'; ge.fillRect(134 + k * 10, 52, 6, 22); }
    T.fits = {a, e};
  }
  return T;
}
const UV_WHITE = [0.03, 0.03, 0.47, 0.97], UV_WINDOW = [0.53, 0.05, 0.97, 0.95];

// ---------- colours ----------
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const PAINT = hex('#c6cbd0'), STRUCT_PAINT = hex('#ced2d6'), STRUCT_DARK = [112, 124, 136], STRUCT_CIS = [166, 173, 182];
// Armoured plating reads as smooth, slightly lighter panels (and steel blue in the coded view).
const PLATE_PAINT = [212, 216, 218], PLATE_DARK = [122, 134, 146], PLATE_CIS = [184, 191, 200], PLATE_CODED = [92, 128, 166];
// The Separatist fleet's light blue-grey plating (Separatist blue markings are
// structure bands; see CIS_PAINT in the core).
const HULL_CIS = [160, 167, 177], DETAIL_CIS = [122, 130, 142], PANEL_CIS = [146, 154, 166];
// Identification bands: the default navy, or the colour a structure names.
const BAND_PAINT = [55, 71, 111], bandColor = p => p.bandPaint ? hex(p.bandPaint) : BAND_PAINT;
const FC = {body: hex('#c3c8cd'), dark: hex('#3e444a'), barrel: hex('#878e95'), ring: hex('#9aa1a8'), glass: hex('#f2f4f6'), ped: hex('#a9b0b6')};
const WHITE = [255, 255, 255];

// ---------- hull loft ----------
// Hull plating is projected along the dominant axis of each face, so its seams
// run straight fore and aft on decks, flanks and cut walls alike.
function hullUV(nx, ny, nz) {
  const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
  if (ax > ay && ax > az) return p => [p[2], p[1]];
  if (ay >= az) return p => [p[0], p[2]];
  return p => [p[0], p[1]];
}
function hullTriangleMesh(g, T, col, scale) {
  const nt = Math.floor(T.length / 9); if (!nt) return; g.room(nt * 3, nt * 3);
  for (let i = 0; i < nt * 9; i += 9) {
    const a = [T[i], T[i + 1], T[i + 2]], b = [T[i + 3], T[i + 4], T[i + 5]], c = [T[i + 6], T[i + 7], T[i + 8]], n = C.cross(C.sub(b, a), C.sub(c, a)), l = Math.hypot(n[0], n[1], n[2]) || 1, uv = hullUV(n[0], n[1], n[2]), k = g.n;
    for (const p of [a, b, c]) { const q = uv(p); g.v(p[0], p[1], p[2], n[0] / l, n[1] / l, n[2] / l, q[0] / scale, q[1] / scale, col, 255); }
    g.tri(k, k + 1, k + 2);
  }
}
function v3MeshHull(ship) {
  const g0 = C.hullGeo(ship), xs = g0.xs, secs = g0.secs, N = g0.N, S = xs.length;
  const P = (i, j) => [xs[i], secs[i].Y[j], secs[i].Z[j]];
  const Q = S - 1, FN = new Float32Array(Q * N * 3), FA = new Float32Array(Q * N);
  for (let i = 0; i < Q; i++) for (let j = 0; j < N; j++) {
    const j2 = (j + 1) % N, a = P(i, j), c = P(i + 1, j2), b = P(i + 1, j), d = P(i, j2);
    const e1 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], e2 = [d[0] - b[0], d[1] - b[1], d[2] - b[2]];
    // quad normal from diagonals: (c-a) x (d-b) is outward for the CCW section order
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const l = Math.hypot(n[0], n[1], n[2]), k = (i * N + j) * 3;
    FA[i * N + j] = l / 2;
    if (l > 1e-9) { FN[k] = n[0] / l; FN[k + 1] = n[1] / l; FN[k + 2] = n[2] / l; }
  }
  const g = new Geo(Q * N * 4 + 4096), cosC = Math.cos(38 * Math.PI / 180), TS = 96;
  const vn = [0, 0, 0];
  const vnormal = (i, j, qi, qj) => {   // vertex (i,j) normal for quad (qi,qj)
    const kq = (qi * N + qj) * 3, nq0 = FN[kq], nq1 = FN[kq + 1], nq2 = FN[kq + 2];
    vn[0] = vn[1] = vn[2] = 0;
    for (const di of [-1, 0]) for (const dj of [-1, 0]) {
      const ii = i + di; if (ii < 0 || ii >= Q) continue;
      const jj = (j + dj + N) % N, k = (ii * N + jj) * 3, w = FA[ii * N + jj];
      if (w <= 1e-9) continue;
      if (FN[k] * nq0 + FN[k + 1] * nq1 + FN[k + 2] * nq2 < cosC) continue;
      vn[0] += FN[k] * w; vn[1] += FN[k + 1] * w; vn[2] += FN[k + 2] * w;
    }
    const l = Math.hypot(vn[0], vn[1], vn[2]);
    if (l < 1e-9) { vn[0] = nq0; vn[1] = nq1; vn[2] = nq2; } else { vn[0] /= l; vn[1] /= l; vn[2] /= l; }
    return vn;
  };
  for (let i = 0; i < Q; i++) for (let j = 0; j < N; j++) {
    if (FA[i * N + j] <= 1e-6) continue;
    const j2 = (j + 1) % N, base = g.n, kq = (i * N + j) * 3, uvOf = hullUV(FN[kq], FN[kq + 1], FN[kq + 2]);
    const corners = [[i, j], [i + 1, j], [i + 1, j2], [i, j2]];
    g.room(4);
    for (const [ci, cj] of corners) {
      const p = P(ci, cj), n = vnormal(ci, cj, i, j), uv = uvOf(p);
      g.v(p[0], p[1], p[2], n[0], n[1], n[2], uv[0] / TS, uv[1] / TS, PAINT, 255);
    }
    g.tri(base, base + 1, base + 2); g.tri(base, base + 2, base + 3);
  }
  // end caps
  for (const i of [0, S - 1]) {
    const s = secs[i]; if (s.area < 1e-3) continue;
    let cz = 0, cy = 0; for (let j = 0; j < N; j++) { cz += s.Z[j]; cy += s.Y[j]; } cz /= N; cy /= N;
    const nx = i === 0 ? -1 : 1, base = g.n;
    g.room(N + 1, N * 3);
    g.v(xs[i], cy, cz, nx, 0, 0, cz / TS, cy / TS, PAINT, 235);
    for (let j = 0; j < N; j++) g.v(xs[i], s.Y[j], s.Z[j], nx, 0, 0, s.Z[j] / TS, s.Y[j] / TS, PAINT, 235);
    for (let j = 0; j < N; j++) { const a = base + 1 + j, b = base + 1 + (j + 1) % N; if (i === 0) g.tri(base, a, b); else g.tri(base, b, a); }
  }
  return g;
}

// ---------- solid parts ----------
function quad(g, p, n, uv, col, a) {   // p: 4 corners CCW from outside
  g.room(4); const b = g.n;
  for (let k = 0; k < 4; k++) g.v(p[k][0], p[k][1], p[k][2], n[0], n[1], n[2], uv[k][0], uv[k][1], col, a);
  g.tri(b, b + 1, b + 2); g.tri(b, b + 2, b + 3);
}
function sphere(g, c, r, col, ru, rv) {
  const nl = r > 60 ? 28 : 20, nm = nl * 2, base = g.n;
  g.room((nl + 1) * (nm + 1), nl * nm * 6);
  for (let i = 0; i <= nl; i++) {
    const th = i / nl * Math.PI, st = Math.sin(th), ct = Math.cos(th);
    for (let j = 0; j <= nm; j++) {
      const ph = j / nm * Math.PI * 2, n = [st * Math.cos(ph), ct, st * Math.sin(ph)];
      g.v(c[0] + n[0] * r, c[1] + n[1] * r, c[2] + n[2] * r, n[0], n[1], n[2], j / nm * ru, i / nl * rv, col, 255);
    }
  }
  for (let i = 0; i < nl; i++) for (let j = 0; j < nm; j++) {
    const a = base + i * (nm + 1) + j, b = a + 1, d = a + nm + 1, cc = d + 1;
    g.tri(a, b, cc); g.tri(a, cc, d);
  }
}
function boxSolid(g, lo, hi, col, us) {   // axis-aligned box; us = metres per texture repeat (0 = one per face)
  const [x0, y0, z0] = lo, [x1, y1, z1] = hi;
  const F = [
    [[[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0], [1, 2]],
    [[[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], [2, 1]],
    [[[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], [0, 1, 0], [2, 0]],
    [[[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], [0, 2]],
    [[[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], [0, 1]],
    [[[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]], [0, 0, -1], [1, 0]],
  ];
  for (const [p, n, ax] of F) {
    const uv = p.map(q => us ? [q[ax[0]] / us, q[ax[1]] / us] : [(q[ax[0]] - lo[ax[0]]) / (hi[ax[0]] - lo[ax[0]] || 1), (q[ax[1]] - lo[ax[1]]) / (hi[ax[1]] - lo[ax[1]] || 1)]);
    quad(g, p, n, uv, col, 255);
  }
}
function frustum(g, pt, col) {   // struct box with taper toward the top
  const b = C.structBox(pt), k = 1 - b.tp, cx = pt.c[0], cz = pt.c[2], TS = 48;
  const B = [[cx - b.l / 2, b.y0, cz - b.w / 2], [cx + b.l / 2, b.y0, cz - b.w / 2], [cx + b.l / 2, b.y0, cz + b.w / 2], [cx - b.l / 2, b.y0, cz + b.w / 2]];
  const T = [[cx - b.l / 2 * k, b.y1, cz - b.w / 2 * k], [cx + b.l / 2 * k, b.y1, cz - b.w / 2 * k], [cx + b.l / 2 * k, b.y1, cz + b.w / 2 * k], [cx - b.l / 2 * k, b.y1, cz + b.w / 2 * k]];
  const face = (p) => {
    const e1 = C.sub(p[1], p[0]), e2 = C.sub(p[3], p[0]), n = C.norm(C.cross(e1, e2));
    const u = C.norm(e1), uv = p.map(q => [C.dot(C.sub(q, p[0]), u) / TS, (q[1] - b.y0) / TS]);
    quad(g, p, n, uv, col, 255);
  };
  face([B[0], T[0], T[1], B[1]]);   // -z
  face([B[1], T[1], T[2], B[2]]);   // +x
  face([B[2], T[2], T[3], B[3]]);   // +z
  face([B[3], T[3], T[0], B[0]]);   // -x
  quad(g, [T[0], T[3], T[2], T[1]], [0, 1, 0], [T[0], T[3], T[2], T[1]].map(q => [q[0] / TS, q[2] / TS]), col, 255);
  quad(g, [B[0], B[1], B[2], B[3]], [0, -1, 0], [B[0], B[1], B[2], B[3]].map(q => [q[0] / TS, q[2] / TS]), col, 255);
}
function cylX(g, c, rad, l, col, ru, rv, caps) {   // cylinder along X; caps: {front:true, back:true}
  const seg = rad > 40 ? 48 : 32, x0 = c[0] - l / 2, x1 = c[0] + l / 2, base = g.n;
  g.room((seg + 1) * 2, seg * 6);
  for (let k = 0; k <= seg; k++) {
    const a = k / seg * Math.PI * 2, cy = Math.cos(a), sz = Math.sin(a);
    g.v(x0, c[1] + cy * rad, c[2] + sz * rad, 0, cy, sz, k / seg * ru, 0, col, 255);
    g.v(x1, c[1] + cy * rad, c[2] + sz * rad, 0, cy, sz, k / seg * ru, rv, col, 255);
  }
  for (let k = 0; k < seg; k++) { const v00 = base + k * 2, v10 = v00 + 1, v01 = v00 + 2, v11 = v00 + 3; g.tri(v00, v01, v11); g.tri(v00, v11, v10); }
  for (const [x, sgn, on] of [[x1, 1, caps.front], [x0, -1, caps.back]]) {
    if (!on) continue;
    const tg = on === true ? g : on.g, cc = on === true ? col : on.col, b = tg.n;
    tg.room(seg + 2, seg * 3);
    tg.v(x, c[1], c[2], sgn, 0, 0, 0.5, 0.5, cc, 255);
    for (let k = 0; k <= seg; k++) { const a = k / seg * Math.PI * 2; tg.v(x, c[1] + Math.cos(a) * rad, c[2] + Math.sin(a) * rad, sgn, 0, 0, 0.5 + 0.5 * Math.cos(a), 0.5 + 0.5 * Math.sin(a), cc, 255); }
    for (let k = 0; k < seg; k++) { if (sgn > 0) tg.tri(b, b + 1 + k, b + 2 + k); else tg.tri(b, b + 2 + k, b + 1 + k); }
  }
}
function engineVents(ship, pt) {
  const m = C.partDims(pt), ex = [pt.c[0] - m.l / 2 - m.rad * 0.25, pt.c[1], pt.c[2]];
  if (C.inEnv(ship, ex)) return false;
  for (const q of ship.parts) if (q !== pt && q.k !== 'struct' && C.inPart(q, ex)) return false;
  return true;
}
function baseMeshParts(ship, opt) {
  const coded = opt.coded, out = {struct: new Geo(1024), gen: new Geo(4096), shield: new Geo(4096), hyper: new Geo(2048), engine: new Geo(2048), nozzle: new Geo(512), hangar: new Geo(2048)};
  const glow = [];
  const colOf = (k) => coded ? C.PARTS[k].col : (k === 'hangar' ? [210, 214, 218] : PAINT);
  for (const pt of ship.parts) {
    const k = pt.k;
    if (k === 'struct') { frustum(out.struct, pt, coded ? STRUCT_PAINT : STRUCT_PAINT); continue; }
    if (k === 'gen') { sphere(out.gen, pt.c, pt.d / 2, coded ? [255, 214, 176] : PAINT, 8, 3); continue; }
    if (k === 'shield') { sphere(out.shield, pt.c, pt.d / 2, coded ? [190, 255, 244] : PAINT, 12, 6); continue; }
    if (k === 'hangar') { const h = pt.d / 2; boxSolid(out.hangar, [pt.c[0] - h, pt.c[1] - h, pt.c[2] - h], [pt.c[0] + h, pt.c[1] + h, pt.c[2] + h], colOf(k), 0); continue; }
    const m = C.partDims(pt);
    if (k === 'hyper') { cylX(out.hyper, pt.c, m.rad, m.l, coded ? [222, 206, 255] : PAINT, 6, 4, {front: true, back: true}); continue; }
    if (k === 'engine') {
      const vents = engineVents(ship, pt), body = coded ? C.PARTS.engine.col : PAINT;
      cylX(out.engine, pt.c, m.rad, m.l, body, Math.max(1, Math.round(m.rad * 2 * Math.PI / 96)), m.l / 96, {front: true, back: vents ? {g: out.nozzle, col: WHITE} : {g: out.engine, col: [70, 76, 84]}});
      // nozzle collar
      cylX(out.engine, [pt.c[0] - m.l / 2 - m.rad * 0.04, pt.c[1], pt.c[2]], m.rad * 1.04, m.rad * 0.08, [120, 128, 136], 1, 0.1, {front: false, back: false});
      if (vents) glow.push(pt.c[0] - m.l / 2 - m.rad * 0.35, pt.c[1], pt.c[2], m.rad * 2.8);
    }
  }
  return {g: out, glow};
}
function meshKeel(ship) {
  const g = new Geo(2048), L = ship.hull.L, n = 64, col = [96, 118, 138];
  for (let i = 0; i < n; i++) {
    const x0 = L * i / n, x1 = L * (i + 1) / n, k = C.keelAt(ship, (x0 + x1) / 2);
    if (!k) continue;
    boxSolid(g, [x0, k.y0, -k.w / 2], [x1, k.y1, k.w / 2], col, 48);
  }
  return g;
}

// ---------- hatches (decals) ----------
function v3MeshHatches(ship) {
  const out = {open: new Geo(2048), ray: new Geo(2048)};
  for (const h of ship.hatches) {
    const gr = C.hatchGrid(ship, h), g = h.k === 'ray' ? out.ray : out.open, fr = C.hatchFrame(h);
    const at = (i, j) => gr.pts[i * gr.nw + j], nat = (i, j) => gr.nrm[i * gr.nw + j];
    for (let i = 0; i + 1 < gr.nl; i++) for (let j = 0; j + 1 < gr.nw; j++) {
      const ids = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]], ps = ids.map(([a, b]) => at(a, b));
      if (ps.some(p => !p)) continue;
      const ns = ids.map(([a, b]) => nat(a, b));
      if (ns.some(n => C.dot(n, h.n) < 0.3)) continue;
      const off = ps.map((p, k) => C.add(p, C.mul(ns[k], 0.6)));
      // A shielded strip has no real opening: FS_RAY darkens the plating under it
      // (vertex alpha 128) and lights a rim from the distance to its border.
      const ray = h.k === 'ray', R = C.clamp(Math.min(fr.L, h.w) * .1, 2.5, 12);
      const uv = ids.map(([a, b]) => ray ? [Math.min(1, Math.min(Math.min(a, gr.nl - 1 - a) / (gr.nl - 1) * fr.L, Math.min(b, gr.nw - 1 - b) / (gr.nw - 1) * h.w) / R), 0] : [a / (gr.nl - 1) * fr.L / 40, b / (gr.nw - 1) * h.w / 40]);
      let face = C.cross(C.sub(off[1], off[0]), C.sub(off[3], off[0]));
      const order = C.dot(face, h.n) >= 0 ? [0, 1, 2, 3] : [0, 3, 2, 1];
      const nn = ns.reduce((a, b) => C.add(a, b), [0, 0, 0]), nu = C.norm(nn);
      quad(g, order.map(k => off[k]), nu, order.map(k => uv[k]), ray ? RAY_FIELD_COL : WHITE, ray ? 128 : 255);
    }
  }
  return out;
}

// ---------- fittings geometry (original designs, sized in metres) ----------
function mx(M, o, p) { return [o[0] + M[0] * p[0] + M[3] * p[1] + M[6] * p[2], o[1] + M[1] * p[0] + M[4] * p[1] + M[7] * p[2], o[2] + M[2] * p[0] + M[5] * p[1] + M[8] * p[2]]; }
function mv(M, n) { return [M[0] * n[0] + M[3] * n[1] + M[6] * n[2], M[1] * n[0] + M[4] * n[1] + M[7] * n[2], M[2] * n[0] + M[5] * n[1] + M[8] * n[2]]; }
// Turret pedestal below the mount origin: round (a flared drum) or trapezoid
// (a square frustum aligned with the hull axis). pr is the top radius.
function pedestal(g, M, o, ph, pr, shape, col, flare) {
  if (shape === 'trap') {
    const t = pr, b = pr * 1.35, P = (x, y, z) => mx(M, o, [x, y, z]);
    const top = [[-t, 0, -t], [t, 0, -t], [t, 0, t], [-t, 0, t]].map(q => P(...q)), bot = [[-b, -ph, -b], [b, -ph, -b], [b, -ph, b], [-b, -ph, b]].map(q => P(...q));
    const face = (ps) => { const n = C.norm(C.cross(C.sub(ps[1], ps[0]), C.sub(ps[2], ps[0]))); g.room(4, 6); const k = g.n; for (const q of ps) g.v(q[0], q[1], q[2], n[0], n[1], n[2], 0.25, 0.5, col, 240); g.tri(k, k + 1, k + 2); g.tri(k, k + 2, k + 3); };
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; face([bot[i], bot[j], top[j], top[i]]); }
    face([top[3], top[2], top[1], top[0]]); face([bot[0], bot[1], bot[2], bot[3]]);
    return;
  }
  cyl(g, M, o, 0, -ph / 2, 0, pr * 1.18, pr, ph, 1, col, 20);
  if (ph > flare) cyl(g, M, o, 0, -ph * 0.8, 0, pr * 1.45, pr * 1.2, ph * 0.4, 1, col, 20);
}
function box(g, M, o, cx, cy, cz, sx, sy, sz, col, uvr) {
  const uv = uvr || UV_WHITE;
  const P = (x, y, z) => mx(M, o, [cx + x * sx / 2, cy + y * sy / 2, cz + z * sz / 2]);
  const quads = [
    [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1], [1, 0, 0]], [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, 0, 0]],
    [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1], [0, 1, 0]], [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1], [0, -1, 0]],
    [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1], [0, 0, 1]], [[-1, -1, -1], [-1, 1, -1], [1, 1, -1], [1, -1, -1], [0, 0, -1]],
  ];
  const uvs = [[uv[0], uv[1]], [uv[0], uv[3]], [uv[2], uv[3]], [uv[2], uv[1]]];
  for (const q of quads) {
    g.room(4); const n = mv(M, q[4]), b = g.n;
    for (let k = 0; k < 4; k++) { const p = P(q[k][0], q[k][1], q[k][2]); g.v(p[0], p[1], p[2], n[0], n[1], n[2], uvs[k][0], uvs[k][1], col, 240); }
    g.tri(b, b + 1, b + 2); g.tri(b, b + 2, b + 3);
  }
}
// wedge: box whose front-top edge is chamfered (local +X front); chamfer = fraction of length
function wedge(g, M, o, cx, cy, cz, sx, sy, sz, ch, col) {
  const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2, z0 = cz - sz / 2, z1 = cz + sz / 2, xc = x1 - sx * ch, yc = y0 + sy * 0.35;
  const pts = {a: [x0, y0, z0], b: [x1, y0, z0], c: [x1, yc, z0], d: [xc, y1, z0], e: [x0, y1, z0], A: [x0, y0, z1], B: [x1, y0, z1], Cc: [x1, yc, z1], D: [xc, y1, z1], E: [x0, y1, z1]};
  const T = (k) => mx(M, o, pts[k]);
  const face = (ks) => {
    const p = ks.map(T), n = C.norm(C.cross(C.sub(p[1], p[0]), C.sub(p[2], p[0])));
    g.room(p.length, (p.length - 2) * 3); const b = g.n;
    for (const q of p) g.v(q[0], q[1], q[2], n[0], n[1], n[2], 0.25, 0.5, col, 240);
    for (let k = 1; k + 1 < p.length; k++) g.tri(b, b + k, b + k + 1);
  };
  face(['a', 'e', 'd', 'c', 'b']);      // -z side (pentagon)
  face(['A', 'B', 'Cc', 'D', 'E']);     // +z side
  face(['e', 'E', 'D', 'd']);           // top
  face(['d', 'D', 'Cc', 'c']);          // chamfer
  face(['c', 'Cc', 'B', 'b']);          // front
  face(['a', 'b', 'B', 'A']);           // bottom
  face(['a', 'A', 'E', 'e']);           // back
}
// cylinder along local axis (0 = X, 1 = Y)
function cyl(g, M, o, cx, cy, cz, r0, r1, len, axis, col, seg) {
  seg = seg || 12;
  const pt = (a, along, r) => { const c = Math.cos(a) * r, s = Math.sin(a) * r; return axis === 0 ? [cx + along, cy + c, cz + s] : [cx + c, cy + along, cz + s]; };
  const nrm = (a) => axis === 0 ? [0, Math.cos(a), Math.sin(a)] : [Math.cos(a), 0, Math.sin(a)];
  for (let k = 0; k < seg; k++) {
    const a0 = k / seg * Math.PI * 2, a1 = (k + 1) / seg * Math.PI * 2;
    const p = [pt(a0, -len / 2, r0), pt(a0, len / 2, r1), pt(a1, len / 2, r1), pt(a1, -len / 2, r0)].map(q => mx(M, o, q));
    const n0 = mv(M, nrm(a0)), n1 = mv(M, nrm(a1));
    g.room(4); const b = g.n, u = 0.25, v = 0.5;
    g.v(p[0][0], p[0][1], p[0][2], n0[0], n0[1], n0[2], u, v, col, 240);
    g.v(p[1][0], p[1][1], p[1][2], n0[0], n0[1], n0[2], u, v, col, 240);
    g.v(p[2][0], p[2][1], p[2][2], n1[0], n1[1], n1[2], u, v, col, 240);
    g.v(p[3][0], p[3][1], p[3][2], n1[0], n1[1], n1[2], u, v, col, 240);
    if (axis === 0) { g.tri(b, b + 2, b + 1); g.tri(b, b + 3, b + 2); } else { g.tri(b, b + 1, b + 2); g.tri(b, b + 2, b + 3); }
    for (const [end, r, sgn] of [[len / 2, r1, 1], [-len / 2, r0, -1]]) {
      if (r <= 0) continue;
      const cc = mx(M, o, axis === 0 ? [cx + end, cy, cz] : [cx, cy + end, cz]);
      const q0 = mx(M, o, pt(a0, end, r)), q1 = mx(M, o, pt(a1, end, r)), nn = mv(M, axis === 0 ? [sgn, 0, 0] : [0, sgn, 0]);
      g.room(3); const c0 = g.n;
      g.v(cc[0], cc[1], cc[2], nn[0], nn[1], nn[2], u, v, col, 240);
      g.v(q0[0], q0[1], q0[2], nn[0], nn[1], nn[2], u, v, col, 240);
      g.v(q1[0], q1[1], q1[2], nn[0], nn[1], nn[2], u, v, col, 240);
      if ((axis === 0) === (sgn > 0)) g.tri(c0, c0 + 1, c0 + 2); else g.tri(c0, c0 + 2, c0 + 1);
    }
  }
}
// Dome in the fitting frame: a half-ellipsoid (radius r, height ry) on its base
// ring at (cx,cy,cz), closed underneath.
function domeL(g, M, o, cx, cy, cz, r, ry, col, seg, rings) {
  seg = seg || 12; rings = rings || 4;
  const P = (a, b) => [cx + Math.cos(a) * Math.cos(b) * r, cy + Math.sin(b) * ry, cz + Math.sin(a) * Math.cos(b) * r];
  const N = (a, b) => C.norm([Math.cos(a) * Math.cos(b) / r, Math.sin(b) / ry, Math.sin(a) * Math.cos(b) / r]);
  for (let j = 0; j < rings; j++) {
    const b0 = j / rings * Math.PI / 2, b1 = (j + 1) / rings * Math.PI / 2;
    for (let i = 0; i < seg; i++) {
      const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2, q = [[a0, b0], [a0, b1], [a1, b1], [a1, b0]];
      g.room(4); const b = g.n;
      for (const [a, e] of q) { const p = mx(M, o, P(a, e)), n = mv(M, N(a, e)); g.v(p[0], p[1], p[2], n[0], n[1], n[2], 0.25, 0.5, col, 240); }
      g.tri(b, b + 1, b + 2); g.tri(b, b + 2, b + 3);
    }
  }
  const c = mx(M, o, [cx, cy, cz]), dn = mv(M, [0, -1, 0]);g.room(seg + 1); const b = g.n;
  g.v(c[0], c[1], c[2], dn[0], dn[1], dn[2], 0.25, 0.5, col, 240);
  for (let i = 0; i < seg; i++) { const p = mx(M, o, P(i / seg * Math.PI * 2, 0)); g.v(p[0], p[1], p[2], dn[0], dn[1], dn[2], 0.25, 0.5, col, 240); }
  for (let i = 0; i < seg; i++) g.tri(b, b + 1 + i, b + 1 + (i + 1) % seg);
}
// A frame pitched up by ang about the local Z axis at a local origin.
function subFrame(M, o, at, ang) {
  const c = Math.cos(ang), s = Math.sin(ang), x = mv(M, [c, s, 0]), y = mv(M, [-s, c, 0]), z = mv(M, [0, 0, 1]);
  return [[x[0], x[1], x[2], y[0], y[1], y[2], z[0], z[1], z[2]], mx(M, o, at)];
}
function frameM(f) { const fr = C.FITS[f.k].window ? C.windowFrame(f) : C.fitFrameOf(f); return [fr.fw[0], fr.fw[1], fr.fw[2], fr.up[0], fr.up[1], fr.up[2], fr.rt[0], fr.rt[1], fr.rt[2]]; }
let FIT_SKIP_BODY = null, FIT_SKIP_PED = null;
// v22 A craft's launch tubes and pylons fly in the trial with their default stores (the お任せ loadout): each
// press of the missile button fires one round from every station still loaded, along the bow.
function craftLaunchers(model){
 if(!C.craftLoadout||!C.isCraft(model))return [];const L=C.craftLoadout(model);if(!L?.stations?.length)return [];const ld=C.normalizeLoad(L.stations,L.load,L.load),out=[];
 for(const f of model.fits){const d=C.FITS[f.k];if(!d?.store||f.float)continue;const i=L.stations.findIndex(st=>st.fit===f.k),q=ld[i],o=C.ORDNANCE[q?.k];if(!o?.guided||!(q.n>0))continue;
  const fr=C.fitFrameOf(f);out.push({id:f.id,origin:C.add(C.fitOrigin(f),C.mul(fr.up,d.hm*.5)),axis:fr.fw,salvo:1,cycle:1.2,tt:o.tt,ion:!!o.ion,kind:q.k,ammo:q.n,ammo0:q.n});}
 return out;
}
// v21 Starfighter and small-craft weapons, in the fitting's frame (x to the bow, y up from the mount).
function craftWeaponMesh(g,f){
 const d=C.fitSpec(f),M=frameM(f),o=C.fitOrigin(f),L=d.fm,W=d.wm,h=d.hm,k=f.k,B=FC.barrel,D=FC.dark,R=FC.ring,Bd=FC.body;
 if(k==='claser'||k==='claserH'){box(g,M,o,-L*.22,h*.5,0,L*.36,h*.9,W,Bd);cyl(g,M,o,L*.2,h*.5,0,W*.3,W*.24,L*.62,0,B,8);for(const q of [.02,.24])cyl(g,M,o,L*q,h*.5,0,W*.42,W*.42,L*.05,0,R,8);cyl(g,M,o,L*.5,h*.5,0,W*.34,W*.34,L*.06,0,D,8);return;}
 if(k==='cion'){box(g,M,o,-L*.18,h*.5,0,L*.5,h,W,Bd);cyl(g,M,o,L*.22,h*.5,0,W*.36,W*.3,L*.5,0,B,10);for(const q of [.08,.2,.32])cyl(g,M,o,L*q,h*.5,0,W*.47,W*.47,L*.04,0,R,10);return;}
 if(k==='cturret'){cyl(g,M,o,0,h*.15,0,W*.5,W*.46,h*.3,1,D,10);domeL(g,M,o,0,h*.3,0,W*.42,h*.5,Bd,12,3);for(const zz of [-W*.14,W*.14])cyl(g,M,o,L*.38,h*.55,zz,W*.06,W*.05,L*.6,0,B,6);return;}
 if(k==='ctorp'||k==='cmsl'){box(g,M,o,0,h*.5,0,L,h,W,Bd);for(const zz of (k==='ctorp'?[0]:[-W*.22,W*.22]))cyl(g,M,o,L*.49,h*.5,zz,W*(k==='ctorp'?.32:.18),W*(k==='ctorp'?.32:.18),L*.04,0,D,10);return;}
 if(k==='cbomb'){box(g,M,o,0,h*.5,0,L,h,W,D);box(g,M,o,0,h*.02,0,L*.92,h*.06,W*.9,R);box(g,M,o,0,h*.03,0,L*.02,h*.07,W*.92,D);return;}
 // v22 A wing pylon: the streamlined pylon and its ejector rack, with the stores it carries by default (two thin
 // missiles side by side, or one torpedo or bomb) hanging under it at their true size (C.ORDNANCE).
 if(k==='cpylon'){box(g,M,o,0,h*.5,0,L,h,W,Bd);box(g,M,o,0,h*.98,0,L*.7,h*.08,W*1.6,D);
  const q=f._store||(C.STORE_DEFAULT?.cpylon?{k:C.STORE_DEFAULT.cpylon[0],n:C.STORE_DEFAULT.cpylon[1]}:null),od=q&&C.ORDNANCE?.[q.k];if(!od)return;const n=Math.min(q.n,C.storeCapacity(d.store,q.k)),[rl,rd]=od.dims,zs=n>1?[-rd*.6,rd*.6]:[0];
  for(let i=0;i<n;i++){const z=zs[i]??0,y=h+rd*.55;cyl(g,M,o,-rl*.07,y,z,rd*.5,rd*.5,rl*.86,0,od.ion?R:FC.glass,10);cyl(g,M,o,rl*.43,y,z,rd*.5,rd*.08,rl*.14,0,od.ion?FC.glass:R,10);}}
}
function meshFits(ship, filter, ranges) {
  const g = new Geo(8192), body = FC.body;
  const one = (f) => {
    if(C.FITS[f.k].asset){
      // Model turrets seat on the highest point under their ring; the pedestal
      // fills down to the lowest one so they never hang over a slope or step.
      if(f.float||C.FITS[f.k].casemate||f.localMount||f.mountAxis!=null)return;
      const d=C.fitSpec(f),ph=(f.base||0)+(f.ped||0)-(f.low||0);
      if(ph>0.3&&!FIT_SKIP_PED?.has(f.id))pedestal(g,frameM(f),C.fitOrigin(f),ph,d.r*.72*(f.pedSize||1),f.pedShape,FC.ped,d.r*.8);
      return;
    }
    // Command pods are the bridge drum mesh, drawn with the model fittings.
    if(C.FITS[f.k].window)return;
    // v21 Craft weapons sit flush on their mount (no pedestal): barrels and launchers along the bow.
    if(C.FITS[f.k].craft){if(!FIT_SKIP_BODY?.has(f.id))craftWeaponMesh(g,f);return;}
    const d = C.fitSpec(f), M = frameM(f), o = C.fitOrigin(f), L = d.fm, W = d.wm, h = d.hm, k = f.k;
    // pedestal from below the surface up to the mount
    const ph = f.base + f.ped - (f.low || 0);
    if (ph > 0.3 && !FIT_SKIP_PED?.has(f.id)) pedestal(g, M, o, ph, d.r * (d.cat === 'b' ? 0.55 : 0.72) * (f.pedSize || 1), f.pedShape, FC.ped, d.r * 0.8);
    if (FIT_SKIP_BODY?.has(f.id)) return;
    if (d.cat === 'b') {
      const WIN = UV_WINDOW;
      if (k === 'brS') {
        wedge(g, M, o, 0, h * 0.25, 0, L, h * 0.5, W, 0.25, body);
        wedge(g, M, o, -L * 0.08, h * 0.68, 0, L * 0.7, h * 0.36, W * 0.72, 0.3, body);
        box(g, M, o, L * 0.25, h * 0.62, 0, L * 0.05, h * 0.12, W * 0.66, FC.glass, WIN);
        box(g, M, o, -L * 0.28, h * 0.95, 0, L * 0.06, h * 0.2, L * 0.06, FC.dark);
      } else if (k === 'brT') {
        wedge(g, M, o, 0, h * 0.07, 0, L, h * 0.14, W, 0.3, body);
        box(g, M, o, -L * 0.06, h * 0.42, 0, L * 0.56, h * 0.6, W * 0.46, body);
        box(g, M, o, -L * 0.12, h * 0.42, 0, L * 0.4, h * 0.56, W * 0.6, body);
        wedge(g, M, o, L * 0.02, h * 0.79, 0, L * 0.86, h * 0.14, W * 1.08, 0.18, body);
        box(g, M, o, L * 0.38, h * 0.79, 0, L * 0.08, h * 0.05, W * 1.0, FC.glass, WIN);
        box(g, M, o, -L * 0.22, h * 0.9, 0, L * 0.34, h * 0.08, W * 0.54, body);
        box(g, M, o, -L * 0.3, h * 0.99, 0, L * 0.04, h * 0.14, L * 0.04, FC.dark);
        cyl(g, M, o, -L * 0.1, h * 0.95, 0, W * 0.09, W * 0.13, h * 0.02, 1, FC.ring, 12);
      } else {
        wedge(g, M, o, 0, h * 0.09, 0, L, h * 0.18, W, 0.25, body);
        wedge(g, M, o, -L * 0.04, h * 0.3, 0, L * 0.84, h * 0.24, W * 0.8, 0.3, body);
        box(g, M, o, -L * 0.07, h * 0.54, 0, L * 0.62, h * 0.26, W * 0.56, body);
        wedge(g, M, o, L * 0.02, h * 0.76, 0, L * 0.86, h * 0.16, W * 0.98, 0.2, body);
        box(g, M, o, L * 0.39, h * 0.77, 0, L * 0.08, h * 0.06, W * 0.9, FC.glass, WIN);
        box(g, M, o, -L * 0.24, h * 0.9, 0, L * 0.28, h * 0.12, W * 0.4, body);
        box(g, M, o, -L * 0.32, h * 1.0, -W * 0.12, L * 0.03, h * 0.12, L * 0.03, FC.dark);
        box(g, M, o, -L * 0.32, h * 1.0, W * 0.12, L * 0.03, h * 0.18, L * 0.03, FC.dark);
      }
      return;
    }
    // Weapons after the turret kit: hexagonal bases, wedge housings with a
    // mantlet and sleeved barrels, ion domes with coiled barrels, angled
    // missile boxes, dish projectors and ball-mounted point defence.
    if (k === 'msl' || k === 'itl') {
      // v18 VLS: a flush armoured deck plate over the cells, two rows of hatches.
      if (C.missileMount(f) === 'vls') {
        box(g, M, o, 0, h * 0.2, 0, L * 0.94, h * 0.4, W * 0.94, FC.body);
        box(g, M, o, 0, h * 0.42, 0, L * 0.86, h * 0.06, W * 0.86, FC.ring);
        for (const a of [-0.31, -0.105, 0.105, 0.31]) for (const b of [-0.2, 0.2]) box(g, M, o, L * a, h * 0.5, W * b, L * 0.17, h * 0.1, W * 0.32, FC.dark);
        return;
      }
      cyl(g, M, o, 0, h * 0.3, 0, W * 0.34, W * 0.3, h * 0.6, 1, FC.dark, 8);
      const [Mp, op] = subFrame(M, o, [0, h * 0.95, 0], 0.32);
      box(g, Mp, op, 0, 0, 0, L * 0.78, h * 0.9, W * 0.82, FC.body);
      box(g, Mp, op, -L * 0.36, 0, 0, L * 0.1, h * 0.7, W * 0.6, FC.ring);
      for (const a of [-0.27, 0, 0.27]) for (const b of [-0.2, 0.2]) cyl(g, Mp, op, L * 0.4, h * b, W * a, W * 0.085, W * 0.085, L * 0.04, 0, FC.dark, 6);
      return;
    }
    if (k === 'pd') {
      cyl(g, M, o, 0, h * 0.12, 0, W * 0.44, W * 0.4, h * 0.24, 1, FC.dark, 6);
      domeL(g, M, o, 0, h * 0.24, 0, W * 0.33, h * 0.5, body, 10, 3);
      box(g, M, o, L * 0.12, h * 0.5, 0, L * 0.12, h * 0.2, W * 0.36, FC.dark);
      for (const z of [-0.1, 0.1]) cyl(g, M, o, L * 0.42, h * 0.52, W * z, W * 0.04, W * 0.032, L * 0.5, 0, FC.barrel, 6);
      return;
    }
    if (k === 'trc') {
      cyl(g, M, o, 0, h * 0.16, 0, W * 0.46, W * 0.42, h * 0.32, 1, FC.dark, 8);
      cyl(g, M, o, 0, h * 0.42, 0, W * 0.16, W * 0.2, h * 0.24, 1, FC.ring, 10);
      cyl(g, M, o, 0, h * 0.66, 0, W * 0.2, W * 0.5, h * 0.26, 1, body, 16);
      cyl(g, M, o, 0, h * 0.8, 0, W * 0.5, W * 0.46, h * 0.04, 1, FC.ring, 16);
      cyl(g, M, o, 0, h * 0.8, 0, W * 0.3, W * 0.28, h * 0.05, 1, FC.dark, 12);
      cyl(g, M, o, 0, h * 0.9, 0, W * 0.05, W * 0.03, h * 0.2, 1, FC.barrel, 6);
      return;
    }
    const nb = d.barrels || 2;
    if (d.casemate) {
      // A gun port in the wall: an armoured frame barely proud of the plating, a
      // dark embrasure under a short hood, a ball mantlet and twin barrels.
      const up = M[7] < 0 ? -1 : 1, br = Math.max(.22, W * .05), bl = h * .62, y0 = Math.min(1.2, h * .1);
      box(g, M, o, 0, y0 * .4, 0, L, y0 * .8, W, FC.ring);
      box(g, M, o, 0, y0 * .82, 0, L * .7, y0 * .1, W * .58, FC.dark);
      box(g, M, o, 0, y0 * 1.1, up * W * .36, L * .86, y0 * 1.2, W * .16, FC.body);
      cyl(g, M, o, 0, y0 * 1.1, 0, W * .25, W * .22, y0 * 1.4, 1, FC.body, 12);
      for (const xx of [-L * .15, L * .15]) {
        cyl(g, M, o, xx, y0 * 1.6 + bl / 2, 0, br, br * .85, bl, 1, FC.barrel, 8);
        cyl(g, M, o, xx, y0 * 1.6 + bl * .97, 0, br * 1.35, br * 1.35, bl * .06, 1, FC.ring, 8);
      }
      return;
    }
    if (k === 'ion' || k === 'ionL' || k === 'nk7') {
      cyl(g, M, o, 0, h * 0.09, 0, W * 0.5, W * 0.46, h * 0.18, 1, FC.dark, 6);
      cyl(g, M, o, 0, h * 0.2, 0, W * 0.4, W * 0.4, h * 0.06, 1, FC.ring, 12);
      domeL(g, M, o, -L * 0.04, h * 0.22, 0, W * 0.38, h * 0.66, body, 14, 4);
      for (const zz of [-W * 0.13, W * 0.13]) {
        cyl(g, M, o, L * 0.48, h * 0.5, zz, W * 0.055, W * 0.05, L * 0.62, 0, FC.barrel, 8);
        for (const q of [0.3, 0.46, 0.62]) cyl(g, M, o, L * q, h * 0.5, zz, W * 0.09, W * 0.09, L * 0.035, 0, FC.ring, 8);
      }
      return;
    }
    // Turbolaser turrets. Many barrels (quad and up) sit in two rows.
    const big = d.r > 14, hexBase = nb <= 3;
    cyl(g, M, o, 0, h * 0.07, 0, W * 0.5, W * 0.47, h * 0.14, 1, FC.dark, hexBase ? 6 : 10);
    cyl(g, M, o, 0, h * 0.17, 0, W * 0.41, W * 0.41, h * 0.07, 1, FC.ring, 12);
    wedge(g, M, o, -L * 0.07, h * 0.47, 0, L * 0.66, h * 0.54, W * (nb > 3 ? 0.72 : 0.8), 0.42, body);
    box(g, M, o, -L * 0.3, h * 0.8, 0, L * 0.18, h * 0.13, W * 0.34, body);
    if (big) for (const sg of [-1, 1]) box(g, M, o, -L * 0.12, h * 0.5, sg * W * 0.41, L * 0.34, h * 0.24, W * 0.04, FC.ring);
    const rows = nb > 3 ? 2 : 1, per = Math.ceil(nb / rows), sp = W * (nb > 3 ? 0.62 : 0.58) / Math.max(per, 2), br = Math.max(0.22, W * (nb > 3 ? 0.028 : nb > 2 ? 0.036 : 0.045)), bl = L * (nb > 3 ? 0.62 : 0.72);
    box(g, M, o, L * 0.27, h * 0.44, 0, L * 0.08, h * (rows > 1 ? 0.4 : 0.28), Math.min(W * 0.74, sp * per + br * 4), FC.dark);
    for (let q = 0; q < nb; q++) {
      const row = rows > 1 ? Math.floor(q / per) : 0, col = rows > 1 ? q % per : q, zz = (col - (per - 1) / 2) * sp, yy = rows > 1 ? h * (row ? 0.56 : 0.34) : h * 0.44;
      if (nb <= 3) cyl(g, M, o, L * 0.36, yy, zz, br * 1.6, br * 1.5, L * 0.12, 0, FC.ring, 8);
      cyl(g, M, o, L * 0.3 + bl / 2, yy, zz, br, br * 0.85, bl, 0, FC.barrel, nb > 3 ? 6 : 8);
      if (nb <= 3) cyl(g, M, o, L * 0.3 + bl * 0.97, yy, zz, br * 1.3, br * 1.3, bl * 0.06, 0, FC.ring, 8);
    }
  };
  for (const f of ship.fits) { if (filter && !filter(f)) continue; const before = g.ni; one(f); if (ranges && g.ni > before) (ranges[f.id] || (ranges[f.id] = [])).push(['fits', before, g.ni - before]); }
  return g;
}

// ---------- WebGL ----------
const VS_MESH = `attribute vec3 aPos;attribute vec3 aNor;attribute vec2 aUv;attribute vec4 aCol;
uniform mat4 uVP;uniform vec3 uOff;uniform vec3 uCenter;uniform mat3 uRot;uniform vec3 uScl;varying vec3 vN;varying vec2 vUv;varying vec4 vCol;varying vec3 vW;varying vec3 vS;varying vec3 vNS;
void main(){vec3 a=aPos*uScl-uCenter;vec3 p=uRot*a+uOff;vW=p;vS=aPos;vN=uRot*aNor;vNS=aNor;vUv=aUv;vCol=aCol;gl_Position=uVP*vec4(p,1.0);}`;
const FS_MESH = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uTex;uniform sampler2D uEmiTex;uniform vec3 uL1;uniform vec3 uL2;uniform vec3 uC1;uniform vec3 uC2;
uniform vec3 uSky;uniform vec3 uGnd;uniform vec3 uEye;uniform float uAlpha;uniform float uEmi;uniform vec3 uClip;uniform vec3 uClipLo;uniform float uClipOn;uniform vec4 uSeam;uniform float uChar;uniform float uBack;uniform float uReference;uniform float uPaint;uniform float uRefHull;uniform float uHullLength;uniform float uFlash;uniform vec4 uEmiTint;
uniform vec3 uLightCol;uniform float uLightK;uniform vec2 uPix;
uniform sampler2D uShadow;uniform mat4 uShM;uniform vec4 uShTile;uniform vec4 uShK;uniform vec2 uLook;
varying vec3 vN;varying vec2 vUv;varying vec4 vCol;varying vec3 vW;varying vec3 vS;varying vec3 vNS;
float hash12(vec2 p){vec3 q=fract(vec3(p.xyx)*0.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
// v20.2 The key light's shadow, from the ship's depth map seen from the light in the mesh's own
// frame (uShM), four texels blended for a clean edge; 1 lit, 0 shadowed. uShK: on, texel (atlas
// UV), depth bias, normal offset (m). The bias grows on faces turned away from the light.
float unpackD(vec4 v){return dot(v,(255.0/256.0)/vec4(16777216.0,65536.0,256.0,1.0));}
float shadowK(vec3 nl,float ndl){
 vec4 c=uShM*vec4(vS+nl*uShK.w,1.0);vec3 s=c.xyz*0.5+0.5;
 if(s.x<=0.0||s.y<=0.0||s.x>=1.0||s.y>=1.0||s.z>=1.0)return 1.0;
 float z=s.z-uShK.z*(1.0+min(4.0,sqrt(max(0.0,1.0-ndl*ndl))/max(ndl,0.05)));
 vec2 t=(uShTile.xy+s.xy*uShTile.zw)/uShK.y-0.5,f=fract(t),b=(floor(t)+0.5)*uShK.y;float e=uShK.y;
 float a0=step(z,unpackD(texture2D(uShadow,b))),a1=step(z,unpackD(texture2D(uShadow,b+vec2(e,0.0))));
 float a2=step(z,unpackD(texture2D(uShadow,b+vec2(0.0,e)))),a3=step(z,unpackD(texture2D(uShadow,b+vec2(e,e))));
 return mix(mix(a0,a1,f.x),mix(a2,a3,f.x),f.y);
}
// Ports on vertical walls (trenches, superstructure sides) in the ship's own
// frame: decks 8 m apart, ports 4 m apart, lit in clusters; unlit ports read as
// dark slots. Past the size of a pixel the ports give way to sparse lights kept
// a pixel or two wide, as distant ships look in the films. x: lit, y: dark slot.
vec2 shipLights(vec3 ns){
 float wall=1.0-smoothstep(0.28,0.42,abs(ns.y));if(wall<=0.0)return vec2(0.0);
 float u=abs(ns.z)>abs(ns.x)?vS.x:vS.z;float v=vS.y;float mpp=uPix.y>0.0?uPix.y:length(uEye-vW)*uPix.x;
 vec2 g=vec2(u/4.0,v/8.0);vec2 id=floor(g);vec2 f=fract(g);
 float blk=step(0.42,hash12(floor(vec2(u/28.0,v/24.0))+vec2(7.0,3.0)));
 float on=blk*step(0.55,hash12(id));
 float box=step(0.3,f.x)*step(f.x,0.7)*step(0.44,f.y)*step(f.y,0.56)*(1.0-smoothstep(0.35,1.1,mpp))*wall;
 vec2 G=vec2(u/34.0,v/16.0);vec2 ID=floor(G);float pb=step(0.8,hash12(ID+vec2(13.0,5.0)));vec2 ctr=(ID+vec2(0.5))*vec2(34.0,16.0);
 float r=max(1.0,mpp*1.15);float dd=length(vec2(u,v)-ctr);float far=pb*(1.0-smoothstep(r*0.45,r,dd))*smoothstep(0.5,1.6,mpp)*(1.0-smoothstep(7.0,12.0,mpp))*wall;
 return vec2(on*box*2.4+far*2.0,box*(1.0-on));
}
void main(){
if(uClipOn>0.5&&(vS.x>uClip.x||vS.y>uClip.y||vS.z>uClip.z||vS.x<uClipLo.x||vS.y<uClipLo.y||vS.z<uClipLo.z))discard;
vec3 n=normalize(vN);vec3 tx=texture2D(uTex,vUv).rgb;float mask=max(max(texture2D(uEmiTex,vUv).r,texture2D(uEmiTex,vUv).g),texture2D(uEmiTex,vUv).b);float lit=smoothstep(0.035,0.18,mask);if(uReference>0.5&&uReference<1.5)tx=mix(tx,vec3(0.48,0.50,0.51),lit);if(uReference>0.5){bool red=tx.r>tx.g*1.35&&tx.r>tx.b*1.25;if(uPaint<0.5&&red)tx=vec3(min(0.8,tx.r*1.3));if(uPaint>1.5)tx*=uReference>1.5?mix(0.62,1.0,lit):0.62;else if(uPaint>0.5&&uRefHull>0.5&&vS.x>uHullLength*.52&&abs(vS.z)<(uHullLength-vS.x)*.065&&n.y>.4)tx*=vec3(.7,.28,.31);}
vec3 vc=uReference>0.5?vCol.rgb*2.0:vCol.rgb;vec3 base=vc*vc*tx*tx;float ao=vCol.a;
float ef=1.0;
if(!gl_FrontFacing){n=-n;ef=0.0;if(uBack<0.5){base=vec3(0.085,0.092,0.10);}else{base*=0.62;}}
vec3 amb=mix(uGnd,uSky,n.y*0.5+0.5)*ao;float d1=max(dot(n,uL1),0.0);float d2=max(dot(n,uL2),0.0);
float sh=1.0;if(uShK.x>0.5&&d1>0.0)sh=shadowK(normalize(vNS)*(gl_FrontFacing?1.0:-1.0),d1);d1*=sh;
vec3 V=normalize(uEye-vW);vec3 H=normalize(uL1+V);float sp=pow(max(dot(n,H),0.0),40.0)*0.22*ao*ef*sh;
vec3 c=base*(amb+uC1*d1*(0.6+0.4*ao)+uC2*d2*ao)+uC1*sp;vec3 e=texture2D(uEmiTex,vUv).rgb;if(uEmiTint.w>0.5){float l=dot(e,vec3(0.3,0.5,0.2));e=mix(uEmiTint.rgb*min(1.0,l*1.3),vec3(l),smoothstep(0.86,1.0,l)*0.7);}c+=e*e*uEmi*ef;
if(uLightK>0.0&&ef>0.5){vec2 pl=shipLights(normalize(vNS));c*=1.0-0.5*pl.y;float lk=uLightK*pl.x;c=mix(c,uLightCol,clamp(lk,0.0,1.0))+uLightCol*(max(0.0,lk-1.0)*0.25);}
// A wreck: plating scorched in patches, and the edges where it broke glowing hot.
if(uChar>0.0){float sc=hash12(floor(vS.xz/9.0))*0.5+hash12(floor(vS.xy/23.0+vec2(3.0)))*0.5;c*=1.0-uChar*(0.45+0.4*sc);}
if(uSeam.w>0.0){float sd=min(abs(vS.x-uSeam.x),abs(vS.x-uSeam.y)),g=uSeam.w*(1.0-smoothstep(0.0,uSeam.z,sd))*(0.75+0.25*hash12(floor(vS.yz/4.0)));c=c*(1.0-0.6*g)+vec3(1.0,0.42,0.12)*g*1.6;}
c=mix(c,vec3(0.72,0.86,1.0),clamp(uFlash,0.0,1.0));
// v20.2 The lit looks roll the highlights off like film (ACES fit) so a strong key light keeps its whites.
if(uLook.x>0.5){c*=uLook.y;c=(c*(2.51*c+0.03))/(c*(2.43*c+0.59)+0.14);}
gl_FragColor=vec4(sqrt(max(c,vec3(0.0))),uAlpha);}`;
// v20.2 The shadow pass: depth seen from the key light, packed into RGBA (WebGL 1 everywhere).
const VS_SHADOW = `attribute vec3 aPos;uniform mat4 uSM;varying float vZ;void main(){vec4 p=uSM*vec4(aPos,1.0);vZ=clamp(p.z*0.5+0.5,0.0,0.99999);gl_Position=p;}`;
const FS_SHADOW = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying float vZ;void main(){vec4 r=vec4(fract(vZ*vec3(16777216.0,65536.0,256.0)),vZ);r.yzw-=r.xyz*(1.0/256.0);gl_FragColor=r*(256.0/255.0);}`;
// Ray shields: premultiplied output blended with (ONE, ONE_MINUS_SRC_ALPHA). The
// field adds a blue-white glow with drifting filaments and only lightly tints
// what lies behind; the halo (vertex alpha 0) is purely additive; a legacy
// strip (alpha ~0.5) also darkens the plating so it reads as an opening.
const FS_RAY = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec3 uEye;uniform float uTime;uniform float uAlpha;uniform vec3 uClip;uniform float uClipOn;
varying vec3 vN;varying vec2 vUv;varying vec4 vCol;varying vec3 vW;varying vec3 vS;
float h3(vec3 p){p=fract(p*0.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float vn(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.0-2.0*f);
 return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
void main(){
 if(uClipOn>0.5&&(vS.x>uClip.x||vS.y>uClip.y||vS.z>uClip.z))discard;
 float e=1.0-clamp(vUv.x,0.0,1.0);
 float flick=0.93+0.07*sin(uTime*8.0+dot(vS,vec3(0.031,0.047,0.023)));
 if(vCol.a<0.25){float g=e*e*0.5+pow(e,7.0)*0.9;gl_FragColor=vec4(mix(vec3(0.30,0.56,1.0),vec3(0.84,0.95,1.0),e*e)*g*flick*uAlpha,0.0);return;}
 vec3 n=normalize(vN),V=normalize(uEye-vW);float fr=1.0-abs(dot(n,V));fr*=fr;
 vec3 q=vS*0.045;
 float a1=vn(q+vec3(0.0,uTime*0.35,uTime*0.2)),a2=vn(q*2.3+vec3(uTime*0.5,0.0,-uTime*0.3)+a1*1.7);
 float fil=pow(1.0-abs(a2*2.0-1.0),8.0);
 float band=0.5+0.5*sin(dot(vS,vec3(0.073,0.046,0.06))-uTime*2.2),scan=0.5+0.5*sin(dot(vS,vec3(0.61,0.43,0.52))+uTime*3.0);
 float rim=e*e*0.75+pow(e,9.0)*1.5;
 float I=(0.07+0.08*a1+0.24*fil+0.05*band+0.04*scan+0.25*fr+rim)*flick;
 vec3 c=mix(vec3(0.22,0.50,1.0),vec3(0.82,0.94,1.0),clamp(rim*0.7+fil*0.5,0.0,1.0))*I;
 float cover=vCol.a<0.75?0.86:0.06+0.06*a1;
 gl_FragColor=vec4(c*uAlpha,cover*uAlpha);}`;
const VS_LINE = `attribute vec3 aPos;attribute vec4 aCol;uniform mat4 uVP;uniform vec3 uOff;varying vec4 vC;
void main(){vC=aCol;gl_Position=uVP*vec4(aPos+uOff,1.0);}`;
const FS_LINE = `precision mediump float;varying vec4 vC;uniform float uA;void main(){gl_FragColor=vec4(vC.rgb,vC.a*uA);}`;
const VS_PT = `attribute vec3 aPos;attribute vec4 aCol;attribute float aSize;uniform mat4 uVP;uniform vec3 uOff;uniform float uScale;uniform float uMin;varying vec4 vC;
void main(){vC=aCol;vec4 p=uVP*vec4(aPos+uOff,1.0);gl_Position=p;gl_PointSize=uScale>0.0?max(uMin,aSize*uScale/max(p.w,0.001)):aSize*uMin;}`;
const FS_PT = `precision mediump float;varying vec4 vC;void main(){float d=length(gl_PointCoord-vec2(0.5))*2.0;float a=1.0-smoothstep(0.0,1.0,d);a*=a;gl_FragColor=vec4(vC.rgb*a*vC.a,1.0);}`;
// Column-major rotation about +Y matching the old yaw-only transform.
function yawMatrix(t){const c=Math.cos(t),s=Math.sin(t);return [c,0,s,0,1,0,-s,0,c];}
function mat3Mul(A,B){const o=new Array(9);for(let c=0;c<3;c++)for(let r=0;r<3;r++)o[c*3+r]=A[r]*B[c*3]+A[3+r]*B[c*3+1]+A[6+r]*B[c*3+2];return o;}
const MAT3_I=[1,0,0,0,1,0,0,0,1];
// Coruscant for the trial flights: an analytic ecumenopolis sphere drawn per
// pixel behind the ship. Lengths are in planet radii to keep float precision.
const FS_PLANET = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform mat4 uInv;uniform vec3 uEye;uniform vec3 uPC;uniform float uR;uniform vec3 uSun;uniform float uPix;uniform float uKind;uniform vec3 uAxis;uniform vec2 uRing;uniform vec4 uLook;varying vec2 vP;
float h3(vec3 p){p=fract(p*0.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float vn(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.0-2.0*f);
 return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 x){float a=0.5,s=0.0;for(int i=0;i<5;i++){s+=a*vn(x);x*=2.03;a*=0.5;}return s;}
// Distance along the surface to a lattice of planes; the family nearly
// parallel to the ground is suppressed so the grid reads as streets.
float lines(vec3 q,vec3 n,float cell,float width,float foot){vec3 g=(0.5-abs(fract(q/cell)-0.5))*cell/sqrt(max(vec3(1e-4),1.0-n*n));float d=min(min(g.x,g.y),g.z);float w=max(width,foot*0.7);return (1.0-smoothstep(w*0.5,w,d))*clamp(width/w,0.0,1.0);}
// Lit or dark city blocks; below a pixel they average to their mean.
float blocks(vec3 q,vec3 n,float cell,float foot){vec3 id=floor(q/cell);float lit=smoothstep(0.5,0.95,h3(id+vec3(cell*0.013)));
 vec3 g=(0.5-abs(fract(q/cell)-0.5))*cell/sqrt(max(vec3(1e-4),1.0-n*n));float d=min(min(g.x,g.y),g.z),gap=smoothstep(cell*0.035,cell*0.075,d);
 return mix(0.2,lit*mix(0.5,1.0,gap),1.0-smoothstep(cell*0.3,cell*1.2,foot));}
// Coruscant: city blocks, arterial lanes and lit streets over the whole globe.
vec3 coruscant(vec3 n,float view,float foot,float sun,float day,float night){
 vec3 q=n*uR;
 mat3 R1=mat3(0.819,0.0,0.574,0.0,1.0,0.0,-0.574,0.0,0.819),R2=mat3(0.966,0.0,-0.259,0.0,1.0,0.0,0.259,0.0,0.966);
 vec3 q1=R1*q,n1=R1*n,q2=R2*q,n2=R2*n;
 float region=fbm(n*6.0+3.1),dens=fbm(n*30.0);
 float cluster=mix(0.5,vn(n*260.0)*0.6+vn(n*900.0+1.7)*0.4,1.0-smoothstep(2500.0,9000.0,foot));
 float density=(0.30+0.95*smoothstep(0.28,0.72,dens))*(0.55+0.7*region)*(0.3+1.4*smoothstep(0.25,0.8,cluster));
 float b1=blocks(q1,n1,2600.0,foot),b2=blocks(q1+vec3(311.0),n1,640.0,foot),b3=blocks(q2+vec3(57.0),n2,170.0,foot);
 float arter=lines(q2,n2,7000.0,140.0,foot)*mix(0.35,1.0,step(0.4,h3(floor(q2/7000.0)+vec3(5.0)))),street=lines(q1,n1,1300.0,26.0,foot);
 float lit=density*(0.55*b1+0.4*b2+0.3*b3)+arter*1.5+street*0.45*density;
 vec3 warm=mix(vec3(1.0,0.56,0.20),vec3(1.0,0.84,0.58),h3(floor(q1/2600.0)+vec3(7.0)));
 vec3 lightc=warm*lit;
 vec3 dayc=mix(vec3(0.30,0.31,0.33),vec3(0.56,0.54,0.50),0.35*b1+0.35*b2+0.3*b3)*(0.8+0.3*region);
 dayc*=1.0-0.45*arter-0.25*street;
 return dayc*(0.05+1.05*max(0.0,sun))*day+lightc*night*0.95+lightc*0.08*day;}
// Kuat: oceans, green and ochre continents, ice caps and cloud bands; the
// shipyard cities light the coasts at night.
vec3 kuat(vec3 n,float view,float foot,float sun,float day,float night,vec3 rd,vec3 sd,float wet,float cityK){
 float lat=abs(dot(n,uAxis)),cont=fbm(n*2.6+vec3(1.7)+sd)+0.32*fbm(n*8.0+vec3(4.0)+sd),land=smoothstep(0.5+wet,0.53+wet,cont),coast=smoothstep(0.47+wet,0.5+wet,cont)*(1.0-land);
 float ice=smoothstep(0.80,0.88,lat+0.06*fbm(n*11.0));
 vec3 ocean=mix(vec3(0.015,0.05,0.13),vec3(0.03,0.11,0.22),fbm(n*18.0)+coast*0.6);
 vec3 ground=mix(vec3(0.06,0.15,0.06),vec3(0.30,0.26,0.14),smoothstep(0.45,0.75,fbm(n*9.0+vec3(2.0))));
 vec3 g=mix(ocean,ground,land);g=mix(g,vec3(0.82,0.86,0.9),ice);
 float cl=smoothstep(0.52-wet,0.78-wet,fbm(n*6.0+vec3(0.0,3.0,1.0)+sd)+0.25*fbm(n*22.0));
 vec3 refl=reflect(rd,n);float spec=pow(max(0.0,dot(refl,uSun)),40.0)*(1.0-land)*(1.0-cl)*0.8;
 vec3 dayc=mix(g,vec3(0.92,0.94,0.97),cl*0.85)*(0.04+1.1*max(0.0,sun))+vec3(1.0,0.95,0.85)*spec*day;
 float city=(land+coast*1.5)*(1.0-ice)*smoothstep(0.55,0.9,vn(n*140.0))*mix(0.35,1.0,smoothstep(0.6,0.9,vn(n*420.0)))*(1.0-cl*0.7);
 return dayc*day+vec3(1.0,0.72,0.42)*city*night*0.9*cityK;}
// A gas giant: cloud bands by latitude, sheared into eddies, with pale storms.
vec3 gasGiant(vec3 n,float sun){
 float lat=dot(n,uAxis),warp=fbm(n*3.0+vec3(2.0))-0.5;
 float b=lat*7.0+warp*1.6+0.35*fbm(n*vec3(9.0,2.0,9.0)+vec3(4.0));
 float band=0.5+0.5*sin(b*6.2831853),fine=fbm(vec3(b*6.0,n.x*3.0+n.z*3.0,warp*4.0));
 vec3 col=mix(vec3(0.50,0.32,0.20),vec3(0.82,0.66,0.46),band);col=mix(col,vec3(0.93,0.88,0.76),smoothstep(0.55,0.85,fine)*0.6);
 float storm=smoothstep(0.82,0.9,fbm(n*5.0+vec3(9.0,1.0,4.0)));col=mix(col,vec3(0.95,0.9,0.82),storm*0.7);
 return col*(0.02+1.05*max(0.0,sun));}
// An ice world: snowfields, blue-grey pressure ridges and cracks, thin cloud.
vec3 iceWorld(vec3 n,float sun,float day,vec3 rd){
 float f=fbm(n*5.0+vec3(3.0)),cr=1.0-smoothstep(0.0,0.03,abs(fbm(n*14.0+vec3(2.0))-0.5));
 vec3 g=mix(vec3(0.70,0.78,0.86),vec3(0.93,0.96,1.0),smoothstep(0.35,0.7,f));g=mix(g,vec3(0.34,0.46,0.6),cr*0.65);
 float cl=smoothstep(0.62,0.86,fbm(n*7.0+vec3(5.0,1.0,2.0)));g=mix(g,vec3(0.97),cl*0.55);
 vec3 refl=reflect(rd,n);float spec=pow(max(0.0,dot(refl,uSun)),30.0)*(0.3+0.5*uLook.y)*(1.0-cl);
 g=mix(g,g*vec3(0.78,0.95,1.18)+vec3(0.0,0.03,0.06),uLook.y);
 float city=uLook.z*smoothstep(0.6,0.9,vn(n*150.0))*mix(0.3,1.0,smoothstep(0.6,0.9,vn(n*430.0)))*(1.0-cl*0.6);
 return g*(0.03+1.0*max(0.0,sun))+vec3(1.0)*spec*day+vec3(0.75,0.85,1.0)*city*(1.0-day)*0.8;}
// A barren world: dust plains, dark basalt and the rims of craters.
vec3 barren(vec3 n,float sun){
 float f=fbm(n*4.0+vec3(7.0)),m=fbm(n*11.0+vec3(1.0,9.0,3.0));
 vec3 g=mix(vec3(0.40,0.28,0.19),vec3(0.70,0.55,0.38),smoothstep(0.3,0.75,f));g=mix(g,vec3(0.20,0.17,0.15),smoothstep(0.6,0.74,m));
 vec3 q=n*16.0,fr=fract(q)-0.5;float h=h3(floor(q)),r=length(fr)*2.0,ring=step(0.62,h)*smoothstep(0.5,0.68,r)*(1.0-smoothstep(0.68,0.86,r));g*=1.0+0.4*ring-0.25*step(0.62,h)*(1.0-smoothstep(0.0,0.5,r));
 float gy=dot(g,vec3(0.33));g=uLook.y<0.5?g:uLook.y<1.5?vec3(gy)*vec3(0.95,0.97,1.02):uLook.y<2.5?vec3(gy)*vec3(0.5,0.5,0.56):g*vec3(1.25,0.62,0.55);
 return g*(0.03+1.05*max(0.0,sun));}
// v22 A desert: dune fields and mesas (palette in uLook.y: tan, pale, red, white salt over red soil).
vec3 desert(vec3 n,float sun,float day){
 vec3 sd=vec3(uLook.x*1.7,uLook.x*2.3,uLook.x*0.9);float p=uLook.y;
 float f=fbm(n*3.5+sd),d2=fbm(n*16.0+sd*2.0),dune=0.5+0.5*sin(dot(n,vec3(37.0,11.0,23.0))+d2*9.0);
 vec3 a=p<0.5?vec3(0.80,0.64,0.42):p<1.5?vec3(0.72,0.68,0.60):p<2.5?vec3(0.74,0.42,0.25):vec3(0.94,0.94,0.96);
 vec3 b=p<0.5?vec3(0.56,0.41,0.25):p<1.5?vec3(0.48,0.45,0.40):p<2.5?vec3(0.46,0.22,0.14):vec3(0.66,0.20,0.14);
 vec3 g=mix(b,a,p>2.5?smoothstep(0.27,0.34,f):smoothstep(0.3,0.7,f));g*=0.88+0.12*dune;
 float mesa=smoothstep(0.62,0.7,fbm(n*7.0+sd+vec3(3.0)));g=mix(g,b*0.72,mesa*0.6);
 float cl=smoothstep(0.72,0.9,fbm(n*6.0+vec3(1.0,4.0,2.0)+sd))*uLook.z;g=mix(g,vec3(0.95),cl);
 return g*(0.03+1.05*max(0.0,sun));}
// v22 An ocean world: open sea with shallow shelves, islands (uLook.y) and storm cloud (uLook.z).
vec3 oceanWorld(vec3 n,float sun,float day,vec3 rd){
 vec3 sd=vec3(uLook.x*1.3,uLook.x*0.7,uLook.x*2.1);
 float cont=fbm(n*3.0+sd)+0.35*fbm(n*11.0+sd),th=0.8-0.28*uLook.y,land=smoothstep(th,th+0.02,cont),shelf=smoothstep(th-0.08,th,cont)*(1.0-land);
 vec3 sea=mix(vec3(0.01,0.05,0.14),vec3(0.03,0.13,0.26),fbm(n*14.0+sd));sea=mix(sea,vec3(0.10,0.42,0.48),shelf*0.8);
 vec3 g=mix(sea,mix(vec3(0.16,0.30,0.10),vec3(0.70,0.66,0.50),smoothstep(0.0,0.02,th+0.02-cont)),land);
 float cl=smoothstep(0.6-0.22*uLook.z,0.82-0.2*uLook.z,fbm(n*5.0+vec3(2.0,0.0,5.0)+sd)+0.25*fbm(n*19.0));
 vec3 refl=reflect(rd,n);float spec=pow(max(0.0,dot(refl,uSun)),50.0)*(1.0-land)*(1.0-cl)*0.9;
 return mix(g,vec3(0.90,0.92,0.95),cl*0.9)*(0.04+1.1*max(0.0,sun))+vec3(1.0,0.95,0.85)*spec*day;}
// v22 Forest, jungle, swamp or a dark world (uLook.y), with lakes and cloud (uLook.z).
vec3 forest(vec3 n,float sun,float day,vec3 rd){
 vec3 sd=vec3(uLook.x*1.1,uLook.x*2.7,uLook.x*1.9);float v=uLook.y;
 float f=fbm(n*4.0+sd),m=fbm(n*13.0+sd*1.3),cont=fbm(n*2.2+sd)+0.3*fbm(n*7.0+sd);
 vec3 c1=v<0.5?vec3(0.05,0.17,0.06):v<1.5?vec3(0.09,0.24,0.05):v<2.5?vec3(0.11,0.14,0.07):vec3(0.04,0.05,0.10);
 vec3 c2=v<0.5?vec3(0.17,0.28,0.11):v<1.5?vec3(0.30,0.40,0.10):v<2.5?vec3(0.24,0.23,0.12):vec3(0.10,0.10,0.18);
 vec3 g=mix(c1,c2,smoothstep(0.35,0.75,f));
 if(v>0.5&&v<1.5)g=mix(g,vec3(0.45,0.26,0.34),smoothstep(0.7,0.8,m)*0.45);
 float water=1.0-smoothstep(0.3,0.33,cont);vec3 wc=v>1.5&&v<2.5?vec3(0.06,0.08,0.05):vec3(0.02,0.07,0.14);g=mix(g,wc,water);
 float swamp=v>1.5&&v<2.5?1.0:0.0;
 float cl=smoothstep(0.58-0.16*swamp-0.12*uLook.z,0.82,fbm(n*6.0+vec3(0.0,3.0,1.0)+sd)+0.2*fbm(n*20.0));
 vec3 refl=reflect(rd,n);float spec=pow(max(0.0,dot(refl,uSun)),40.0)*water*(1.0-cl)*0.6;
 vec3 cloud=swamp>0.5?vec3(0.68,0.72,0.64):vec3(0.92,0.94,0.96);
 vec3 dayc=mix(g,cloud,cl*0.85)*(0.04+1.1*max(0.0,sun))+vec3(1.0,0.95,0.85)*spec*day;
 float glow=v>2.5?smoothstep(0.62,0.9,vn(n*300.0))*(1.0-cl):0.0;
 return dayc*day+vec3(0.25,0.55,0.95)*glow*(1.0-day)*0.6;}
// v22 A volcanic world: dark crust and ash, rivers of lava glowing by day and night (uLook.y: how much).
vec3 lava(vec3 n,float sun,float day){
 vec3 sd=vec3(uLook.x*1.9,uLook.x*1.1,uLook.x*2.3);
 float f=fbm(n*5.0+sd),r=abs(fbm(n*9.0+sd*1.5)-0.5),w=0.03+0.03*uLook.y,flow=(1.0-smoothstep(0.0,w,r))*smoothstep(0.35,0.55,f);
 vec3 rock=mix(vec3(0.07,0.06,0.06),vec3(0.20,0.17,0.15),fbm(n*14.0+sd));
 float ash=smoothstep(0.7,0.88,fbm(n*6.0+vec3(4.0,1.0,2.0)+sd));vec3 g=mix(rock,vec3(0.35,0.32,0.30),ash*0.6);
 vec3 hot=mix(vec3(1.0,0.22,0.03),vec3(1.0,0.72,0.2),1.0-smoothstep(0.0,w*0.5,r))*flow;
 return g*(0.03+1.0*max(0.0,sun))+hot*(0.55+0.45*(1.0-day));}
// The colour of each kind of world's air, and how much of it there is.
vec3 airCol(){return uKind<0.5?vec3(0.30,0.52,1.0):uKind<2.5?vec3(0.35,0.62,1.0):uKind<3.5?vec3(0.86,0.66,0.42):uKind<4.5?vec3(0.62,0.80,1.0):uKind<5.5?vec3(0.82,0.52,0.30):uKind<6.5?vec3(0.88,0.72,0.52):uKind<7.5?vec3(0.34,0.60,1.0):uKind<8.5?(uLook.y>1.5&&uLook.y<2.5?vec3(0.55,0.68,0.52):vec3(0.40,0.66,0.98)):vec3(0.95,0.45,0.22);}
float airK(){return uKind>8.5?0.55:uKind>7.5?1.0:uKind>6.5?1.0:uKind>5.5?0.65:uKind>4.5?0.35:uKind>3.5?0.75:1.0;}
// The orbital shipyard ring lies in the equatorial plane: three tracks of
// docks and trusswork, ribbed by segment joints, lit by the sun and by dock lights.
vec4 ring(vec3 rp,float dist){
 float r=length(rp),u=(r-uRing.x)/(uRing.y-uRing.x);
 vec3 e1=normalize(abs(uAxis.x)<0.9?cross(uAxis,vec3(1.0,0.0,0.0)):cross(uAxis,vec3(0.0,1.0,0.0))),e2=cross(uAxis,e1);
 float ang=atan(dot(rp,e2),dot(rp,e1)),foot=dist*uR*uPix,segL=6.2831853*r*uR/180.0;
 float seg=fract(ang*180.0/6.2831853),joint=mix(1.0,smoothstep(0.0,0.03,seg)*smoothstep(1.0,0.97,seg),1.0-smoothstep(segL*0.04,segL*0.2,foot));
 float track=smoothstep(0.03,0.06,u)*(1.0-smoothstep(0.27,0.3,u))+smoothstep(0.36,0.39,u)*(1.0-smoothstep(0.61,0.64,u))+smoothstep(0.7,0.73,u)*(1.0-smoothstep(0.94,0.97,u));
 float brace=1.0-step(0.08,abs(fract(ang*1800.0/6.2831853+u*4.0)-0.5))*(1.0-smoothstep(segL*0.02,segL*0.1,foot));
 float a=clamp(track*joint*(0.75+0.25*brace)+0.12*(1.0-track)*step(0.03,u)*step(u,0.97),0.0,1.0);
 bool shadow=dot(rp,uSun)<0.0&&length(rp-uSun*dot(rp,uSun))<1.0;
 float lit=(shadow?0.04:0.25+0.75*abs(dot(uAxis,uSun)))*(0.85+0.3*vn(vec3(ang*400.0,u*20.0,0.0)));
 vec3 metal=mix(vec3(0.42,0.44,0.47),vec3(0.62,0.62,0.6),step(0.5,h3(vec3(floor(ang*720.0/6.2831853),floor(u*6.0),3.0))));
 float dots=step(0.93,h3(vec3(floor(ang*9000.0/6.2831853),floor(u*30.0),1.0)))*track*(1.0-smoothstep(segL*0.01,segL*0.05,foot))+track*0.06;
 return vec4(metal*lit+vec3(1.0,0.82,0.55)*dots*(shadow?1.0:0.35),a);}
void main(){
 vec4 a=uInv*vec4(vP,-1.0,1.0),b=uInv*vec4(vP,1.0,1.0);vec3 rd=normalize(b.xyz/b.w-a.xyz/a.w);
 vec3 o=(uEye-uPC)/uR;float B=dot(o,rd),Cc=dot(o,o)-1.0,h=B*B-Cc;
 bool hit=h>=0.0&&B<=0.0;float tp=hit?-B-sqrt(h):1e9;
 vec4 base;
 if(!hit){float limb=B>0.0?length(o):sqrt(max(0.0,dot(o,o)-B*B));vec3 cp=B>0.0?o:o-rd*B;float glow=exp(-max(0.0,limb-1.0)*110.0)*smoothstep(-0.35,0.35,dot(normalize(cp),uSun)+0.2);
  float sd=dot(rd,uSun),disc=smoothstep(0.99990,0.99996,sd)*3.0+pow(max(0.0,sd),900.0)*0.6+pow(max(0.0,sd),60.0)*0.12;
  vec3 air=airCol();glow*=airK();
  vec3 c=air*glow+vec3(1.0,0.86,0.66)*glow*pow(max(0.0,sd),6.0)+vec3(1.0,0.95,0.86)*disc;base=vec4(c,clamp(max(glow*0.9,disc),0.0,1.0));}
 else{
  vec3 n=normalize(o+rd*tp);float dist=tp*uR,view=clamp(-dot(rd,n),0.0,1.0);
  float foot=dist*uPix/max(0.12,view);
  float sun=dot(n,uSun),day=smoothstep(-0.08,0.18,sun),night=1.0-smoothstep(-0.12,0.06,sun);
  bool own=uLook.w>0.5;
  // v22 one program per kind of world (PK), so a pixel only ever runs its own world's noise
#if PK==0
  vec3 col=coruscant(n,view,foot,sun,day,night);
#elif PK==1
  vec3 col=kuat(n,view,foot,sun,day,night,rd,vec3(0.0),0.0,1.0);
#elif PK==2
  vec3 col=kuat(n,view,foot,sun,day,night,rd,own?vec3(1.0+uLook.x*5.3,3.0+uLook.x*2.1,2.0+uLook.x*7.7):vec3(5.3,2.1,7.7),own?uLook.y:0.03,own?uLook.z:1.0);
#elif PK==3
  vec3 col=gasGiant(n,sun);
#elif PK==4
  vec3 col=iceWorld(n,sun,day,rd);
#elif PK==6
  vec3 col=desert(n,sun,day);
#elif PK==7
  vec3 col=oceanWorld(n,sun,day,rd);
#elif PK==8
  vec3 col=forest(n,sun,day,rd);
#elif PK==9
  vec3 col=lava(n,sun,day);
#else
  vec3 col=barren(n,sun);
#endif
  float haze=pow(1.0-view,3.0);
  vec3 air=mix(vec3(0.05,0.07,0.13),airCol()*0.95,day);col=mix(col,air,haze*0.75*airK());
  col=1.0-exp(-col*1.25);
  base=vec4(col,1.0);}
 if(uRing.y>0.0){float dn=dot(rd,uAxis);if(abs(dn)>1e-6){float tr=-dot(o,uAxis)/dn;vec3 rp=o+rd*tr;float r=length(rp);
  if(tr>0.0&&tr<tp&&r>uRing.x&&r<uRing.y){vec4 rc=ring(rp,tr);float al=rc.a+base.a*(1.0-rc.a);vec3 pre=rc.rgb*rc.a+base.rgb*base.a*(1.0-rc.a);base=vec4(al>0.0?pre/al:vec3(0.0),al);}}}
 gl_FragColor=base;}`;
// Hyperspace: a tunnel of blue-white streaks around the direction of travel,
// drawn over the whole screen behind the ship.
const FS_HYPER = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform mat4 uInv;uniform vec3 uDir;uniform float uTime;uniform float uK;varying vec2 vP;
float h3(vec3 p){p=fract(p*0.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float vn(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.0-2.0*f);
 return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
void main(){
 vec4 a=uInv*vec4(vP,-1.0,1.0),b=uInv*vec4(vP,1.0,1.0);vec3 rd=normalize(b.xyz/b.w-a.xyz/a.w),f=normalize(uDir);
 vec3 e1=normalize(abs(f.y)<0.95?cross(f,vec3(0.0,1.0,0.0)):cross(f,vec3(1.0,0.0,0.0))),e2=cross(f,e1);
 float al=dot(rd,f),rr=length(vec2(dot(rd,e1),dot(rd,e2)))+1e-4,z=al/rr,th=atan(dot(rd,e2),dot(rd,e1))+z*0.04+uTime*0.25;
 vec2 cs=vec2(cos(th),sin(th));
 float s1=vn(vec3(cs*6.0,z*0.25+uTime*5.0)),s2=vn(vec3(cs*15.0+3.0,z*0.6+uTime*9.0)),s3=vn(vec3(cs*40.0+7.0,z*1.5+uTime*16.0));
 float st=pow(s1,3.0)*0.8+pow(s2,5.0)*1.1+pow(s3,8.0)*0.9;
 float core=exp(-max(0.0,1.0-al)*22.0),rim=smoothstep(-0.2,0.6,al);
 vec3 col=vec3(0.015,0.04,0.13)+vec3(0.12,0.32,0.95)*st*rim+vec3(0.85,0.93,1.0)*pow(st,2.4)*0.9*rim+vec3(0.65,0.82,1.0)*core;
 gl_FragColor=vec4(col*uK,uK);}`;
// The sky of the space views: a faint galactic band with dust lanes and a few
// coloured nebulae. It is painted once into an equirectangular texture (the
// square root of the colour, so the faint gradients keep their steps fine)
// and looked up per pixel from the view direction behind the stars.
const SKY_COLOR = `float h3(vec3 p){p=fract(p*0.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float vn(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.0-2.0*f);
 return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float a=0.5,s=0.0;for(int i=0;i<5;i++){s+=a*vn(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=0.5;}return s;}
vec3 skyColor(vec3 rd){
 float lat=dot(rd,uG),n1=fbm(rd*2.4),n2=fbm(rd*7.0+vec3(3.0,1.0,4.0));
 float band=exp(-lat*lat/(0.018+0.03*n1)),core=exp(-(1.0-dot(rd,uGC))*2.6);
 float dust=smoothstep(0.4,0.68,n2)*exp(-lat*lat/0.006);
 float glow=band*(0.3+0.7*n1)*(0.5+1.1*core)*(1.0-0.8*dust);
 vec3 col=vec3(0.005,0.008,0.015)+vec3(0.075,0.078,0.1)*glow+vec3(0.11,0.08,0.05)*core*band*(1.0-0.75*dust);
 return col+vec3(0.03,0.01,0.028)*smoothstep(0.56,0.86,fbm(rd*1.3+vec3(7.0)))*(0.4+0.6*n2)+vec3(0.006,0.018,0.034)*smoothstep(0.6,0.9,fbm(rd*1.8+vec3(2.0,5.0,1.0)));}`;
const SKY_HEAD = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`;
// Paints the texture: each texel's longitude and latitude give its direction.
const FS_SKYGEN = SKY_HEAD + `uniform vec3 uG;uniform vec3 uGC;varying vec2 vP;
` + SKY_COLOR + `
void main(){vec2 uv=vP*0.5+0.5;float lon=(uv.x-0.5)*6.2831853,lat=(0.5-uv.y)*3.14159265;
 gl_FragColor=vec4(sqrt(clamp(skyColor(vec3(cos(lat)*cos(lon),sin(lat),cos(lat)*sin(lon))),0.0,1.0)),1.0);}`;
const FS_SKYTEX = SKY_HEAD + `uniform mat4 uInv;uniform sampler2D uTex;uniform float uK;varying vec2 vP;
float hd(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){vec4 a=uInv*vec4(vP,-1.0,1.0),b=uInv*vec4(vP,1.0,1.0);vec3 rd=normalize(b.xyz/b.w-a.xyz/a.w);
 vec2 uv=vec2(atan(rd.z,rd.x)/6.2831853+0.5,0.5-asin(clamp(rd.y,-1.0,1.0))/3.14159265);vec3 c=texture2D(uTex,uv).rgb;
 gl_FragColor=vec4(c*c*uK+(hd(gl_FragCoord.xy)-0.5)/255.0,1.0);}`;
// Without a texture to paint into, the sky is worked out per pixel.
const FS_SKY = SKY_HEAD + `uniform mat4 uInv;uniform vec3 uG;uniform vec3 uGC;uniform float uK;varying vec2 vP;
` + SKY_COLOR + `
void main(){vec4 a=uInv*vec4(vP,-1.0,1.0),b=uInv*vec4(vP,1.0,1.0);vec3 rd=normalize(b.xyz/b.w-a.xyz/a.w);
 gl_FragColor=vec4(skyColor(rd)*uK+(h3(vec3(gl_FragCoord.xy,1.0))-0.5)/255.0,1.0);}`;
// Stars of the space views, one quad each. At rest a star is a small round
// dot; going into hyperspace each is stretched radially away from the
// direction of travel (uS, the angle added at its outer end), a streak that is
// brightest at its outer end. A great circle projects to a straight line, so
// the streak is the segment between the two projected ends, clipped in front
// of the eye. A streak only ever grows outward and stops 3.05 rad from the
// direction of travel, so the stars straight behind stay dots (v18: they used
// to be pulled out to that ring even at rest, a burst behind every ship).
const VS_STAR = `attribute vec3 aDir;attribute vec2 aCorner;attribute vec4 aCol;
uniform mat4 uVP;uniform vec3 uF;uniform float uS;uniform vec2 uRes;uniform float uPx;uniform float uK;
varying vec3 vC;varying vec3 vQ;varying vec2 vSig;
void main(){
 float m=aCol.a,c=dot(aDir,uF);vec3 r=aDir-uF*c;float rl=length(r);
 vec3 rh=rl>1e-5?r/rl:normalize(cross(uF,abs(uF.y)<0.9?vec3(0.0,1.0,0.0):vec3(1.0,0.0,0.0)));
 float phi=atan(rl,c),ph2=phi+min(uS*(0.18+phi*0.9),max(0.0,3.05-phi));vec3 hd=uF*cos(ph2)+rh*sin(ph2);
 vec4 A=uVP*vec4(aDir,0.0),B=uVP*vec4(hd,0.0);const float E=1e-3;
 if(A.w<E&&B.w<E){gl_Position=vec4(2.0,2.0,2.0,1.0);vC=vec3(0.0);vQ=vec3(0.0);vSig=vec2(1.0);return;}
 if(A.w<E)A=mix(A,B,(E-A.w)/(B.w-A.w));if(B.w<E)B=mix(B,A,(E-B.w)/(A.w-B.w));
 vec2 pa=(A.xy/A.w*0.5+0.5)*uRes,pb=(B.xy/B.w*0.5+0.5)*uRes,ax=pb-pa;float L=length(ax),Lm=3.0*length(uRes);
 if(L>Lm){ax*=Lm/L;L=Lm;}vec2 dir=L>1e-3?ax/L:vec2(1.0,0.0),per=vec2(-dir.y,dir.x);
 float st=smoothstep(0.0,1.0,uS),sig=(0.42+0.75*m*m)*uPx,halo=pow(m,8.0),ext=(3.0*sig+uPx)*(1.0+3.0*halo);
 vec2 p=(aCorner.x<0.5?pa-dir*ext:pa+ax+dir*ext)+per*ext*aCorner.y;
 vQ=vec3(dot(p-pa,dir),ext*aCorner.y,L);vSig=vec2(sig,halo);
 vec3 col=mix(aCol.rgb,vec3(0.78,0.88,1.0),0.65*st);
 vC=col*(0.15+0.9*pow(m,1.5))*(1.0+1.3*st)*uK;
 gl_Position=vec4(p/uRes*2.0-1.0,0.0,1.0);}`;
const FS_STAR = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec3 vC;varying vec3 vQ;varying vec2 vSig;
void main(){float u=vQ.x,L=vQ.z,dx=u<0.0?-u:(u>L?u-L:0.0),d2=dx*dx+vQ.y*vQ.y,s=vSig.x;
 float g=exp(-d2/(2.0*s*s))+0.1*vSig.y*exp(-d2/(32.0*s*s)),t=L>0.5?clamp(u/L,0.0,1.0):1.0;
 gl_FragColor=vec4(vC*g*mix(0.5,1.0,t),1.0);}`;
const VS_BG = `attribute vec2 aP;varying vec2 vP;void main(){vP=aP;gl_Position=vec4(aP,0.9999,1.0);}`;
const FS_BG = `precision mediump float;varying vec2 vP;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){vec2 p=vP;float r=length(p-vec2(0.45,0.35));
vec3 c=mix(vec3(0.050,0.066,0.094),vec3(0.016,0.022,0.034),clamp(r*0.75,0.0,1.0));
float r2=length(p-vec2(-0.6,-0.5));c+=vec3(0.035,0.045,0.06)*exp(-r2*r2*2.5);
c+=(h(gl_FragCoord.xy)-0.5)*0.01;gl_FragColor=vec4(c,1.0);}`;

function compile(gl, vs, fs) {
  const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}, a = {};
  const nu = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let k = 0; k < nu; k++) { const n = gl.getActiveUniform(p, k).name; u[n] = gl.getUniformLocation(p, n); }
  const na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES); for (let k = 0; k < na; k++) { const n = gl.getActiveAttrib(p, k).name; a[n] = gl.getAttribLocation(p, n); }
  return {p, u, a};
}
const MESH_TEX = {hull: 'hull', struct: 'struct', plate: 'hull', keel: 'struct', gen: 'gen', shield: 'shield', hyper: 'hyper', interior:'hyper', engine: 'hull', plant:'hull', nozzle: 'nozzle', hangar: 'hangar', hatchOpen: 'hull', hatchRay: 'ray', fits: 'fits'};
for(const k of ['refHull','refStruct','refEngine','refPlant','refFits','refHatches','previewRef','previewRefFits'])MESH_TEX[k]='reference';
MESH_TEX.preview='struct';MESH_TEX.previewFits='fits';
const BACK_OWN = new Set(['gen', 'shield', 'hyper', 'engine', 'nozzle', 'hangar', 'keel', 'fits', 'preview', 'previewFits']);
const REFERENCE_SHADED = new Set(['refHull','refStruct','refPlant','refFits','refHatches','previewRef','previewRefFits']);
// Meshes that carry lit ports, and the port colours a design can choose.
const LIGHT_MESHES = new Set(['hull', 'struct', 'refHull', 'refStruct']);
const SHIP_LIGHTS = {white: [1.0, 0.94, 0.82], blue: [0.34, 0.58, 1.0], warm: [1.0, 0.7, 0.4]};
const MESH_EMI = {hull: 0.9, struct: 1, keel: 0, gen: 1.1, shield: 0.8, hyper: 0.8, interior:0.8, engine: 0, plant:0, nozzle: 1.5, hangar: 0.6, hatchOpen: 1, hatchRay: 1, fits: 0.6};

for(const k of ['refHull','refStruct','refEngine','refPlant','refFits','refHatches','previewRef','previewRefFits'])MESH_EMI[k]=0;
MESH_EMI.preview=.6;MESH_EMI.previewFits=.6;
MESH_EMI.refEngine=.8;
class Renderer {
  constructor(canvas) {
    this.canvas = canvas;this.kind='webgl';this.disposed=false;this.ownedTextures=new Set();
    const gl = this.gl = canvas.getContext('webgl', {antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'default'})
      || canvas.getContext('experimental-webgl');
    if (!gl) throw new Error('WebGL が使えません');
    this.u32 = !!gl.getExtension('OES_element_index_uint');
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic') || gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
    this.pm = compile(gl, VS_MESH, FS_MESH); this.pl = compile(gl, VS_LINE, FS_LINE);
    this.pp = compile(gl, VS_PT, FS_PT); this.pb = compile(gl, VS_BG, FS_BG);
    const tex = (cv, repeat) => {
      const t = gl.createTexture(); this.ownedTextures.add(t);gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      const w = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, w); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, w);
      if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
      return t;
    };
    const T = makeTextures();
    this.tex = {};
    for (const k in T) this.tex[k] = {a: tex(T[k].a, k !== 'fits' && k !== 'nozzle'), e: tex(T[k].e, k !== 'fits' && k !== 'nozzle')};
    this.tex.reference={...this.tex.hull};
    if(typeof Image!=='undefined')for(const [kind,src] of [['a',YardReferenceData.atlas],['e',YardReferenceData.mask]]){const img=new Image();img.onload=()=>{if(this.disposed||gl.isContextLost())return;let source=img;const max=Math.min(2048,gl.getParameter(gl.MAX_TEXTURE_SIZE));if(img.width>max){source=document.createElement('canvas');source.width=source.height=max;source.getContext('2d').drawImage(img,0,0,max,max);}this.tex.reference[kind]=tex(source,false);this.onTextureReady?.();};img.src=src;}
    this.bgBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.bgBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.meshes = {}; this.lines = {}; this.points = {};
    this.off = [0, 0, 0];
    this.cam = {th: 0.85, ph: 1.05, r: 1500, target: [0, 0, 0], fov: 0.72};
    this.makeStars();
  }
  dispose() {
    this.disposed=true;const gl=this.gl;if(!gl||gl.isContextLost())return;
    const sets=[this.meshes,this.lines,this.points,...Array.from(this.fleetCache?.values()||[],a=>a.meshes)];
    for(const set of sets)for(const item of Object.values(set||{}))for(const k of ['pos','nor','uv','col','idx','size'])if(item[k])gl.deleteBuffer(item[k]);
    for(const p of [this.pm,this.pl,this.pp,this.pb,this.pray,...Object.values(this.pplanets||{}),this.phyper,this.psky,this.pskyt,this.pstar])if(p?.p)gl.deleteProgram(p.p);
    for(const t of this.ownedTextures||[])gl.deleteTexture(t);if(this.bgBuf)gl.deleteBuffer(this.bgBuf);
    if(this.sky)for(const k of ['dir','cor','col','idx'])gl.deleteBuffer(this.sky[k]);
    if(this.sh){gl.deleteFramebuffer(this.sh.fb);gl.deleteRenderbuffer(this.sh.rb);if(this.sh.prog?.p)gl.deleteProgram(this.sh.prog.p);}
  }
  upload(name, geo) {
    const gl = this.gl;
    let m = this.meshes[name];
    if (!m) m = this.meshes[name] = {pos: gl.createBuffer(), nor: gl.createBuffer(), uv: gl.createBuffer(), col: gl.createBuffer(), idx: gl.createBuffer(), count: 0};
    // v20.2 A version and a box per mesh: the shadow map is redrawn only when a caster changes.
    m.ver = (m.ver || 0) + 1; { const P = geo.pos, b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]; for (let i = 0; i < geo.n * 3; i += 3) for (let k = 0; k < 3; k++) { const v = P[i + k]; if (v < b[k]) b[k] = v; if (v > b[k + 3]) b[k + 3] = v; } m.bb = geo.n ? b : null; }
    m.flat = !this.u32 && geo.n >= 65536;
    if (m.flat) {
      // Clipped rooms can exceed 16-bit indices. Expand only on devices without
      // the uint-index extension, rather than silently hiding the whole group.
      for (const [key, width] of [['pos',3],['nor',3],['uv',2],['col',4]]) {
        const src = geo[key], dst = new src.constructor(geo.ni * width);
        for (let i=0;i<geo.ni;i++) for(let j=0;j<width;j++) dst[i*width+j]=src[geo.idx[i]*width+j];
        gl.bindBuffer(gl.ARRAY_BUFFER,m[key]); gl.bufferData(gl.ARRAY_BUFFER,dst,gl.STATIC_DRAW);
      }
      m.count=geo.ni; return;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, m.pos); gl.bufferData(gl.ARRAY_BUFFER, geo.pos.subarray(0, geo.n * 3), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.nor); gl.bufferData(gl.ARRAY_BUFFER, geo.nor.subarray(0, geo.n * 3), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.uv); gl.bufferData(gl.ARRAY_BUFFER, geo.uv.subarray(0, geo.n * 2), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.col); gl.bufferData(gl.ARRAY_BUFFER, geo.col.subarray(0, geo.n * 4), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.idx);
    if (this.u32 || geo.n < 65536) {
      m.type = this.u32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.u32 ? geo.idx.subarray(0, geo.ni) : Uint16Array.from(geo.idx.subarray(0, geo.ni)), gl.STATIC_DRAW);
      m.count = geo.ni;
    } else m.count = 0;
  }
  setLines(name, data) {
    const gl = this.gl;
    let l = this.lines[name]; if (!l) l = this.lines[name] = {pos: gl.createBuffer(), col: gl.createBuffer(), count: 0};
    gl.bindBuffer(gl.ARRAY_BUFFER, l.pos); gl.bufferData(gl.ARRAY_BUFFER, data.pos, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, l.col); gl.bufferData(gl.ARRAY_BUFFER, data.col, gl.DYNAMIC_DRAW);
    l.count = data.pos.length / 3;
  }
  setPoints(name, pos, col, size) {
    const gl = this.gl;
    let p = this.points[name]; if (!p) p = this.points[name] = {pos: gl.createBuffer(), col: gl.createBuffer(), size: gl.createBuffer(), count: 0};
    gl.bindBuffer(gl.ARRAY_BUFFER, p.pos); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, p.col); gl.bufferData(gl.ARRAY_BUFFER, col, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, p.size); gl.bufferData(gl.ARRAY_BUFFER, size, gl.STATIC_DRAW);
    p.count = pos.length / 3;
  }
  // v18 The design screen shows the drives lit at cruise in the design's engine
  // colour, each with a short plume aft (-x), so the colour reads at a glance.
  setGlow(list, rgb) {   // flat [x,y,z,size,...]; rgb: the design's engine colour
    const n = list.length / 4, P = 4, pos = new Float32Array(n * P * 3), col = new Uint8Array(n * P * 4), size = new Float32Array(n * P), c = rgb || [110, 185, 255];
    for (let k = 0; k < n; k++) for (let j = 0; j < P; j++) { const i = k * P + j, s0 = list[k * 4 + 3], d = j ? s0 * j * 1.6 : 0; pos[i * 3] = list[k * 4] - d; pos[i * 3 + 1] = list[k * 4 + 1]; pos[i * 3 + 2] = list[k * 4 + 2]; size[i] = s0 * 2.2 * (j ? 1 - .18 * j : 1); col[i * 4] = c[0]; col[i * 4 + 1] = c[1]; col[i * 4 + 2] = c[2]; col[i * 4 + 3] = j ? Math.round(160 * (1 - .22 * j)) : 210; }
    this.setPoints('glow', pos, col, size);
  }
  makeStars() {
    const n = 1400, pos = new Float32Array(n * 3), col = new Uint8Array(n * 4), size = new Float32Array(n), R = rng(42);
    for (let k = 0; k < n; k++) {
      const u = R() * 2 - 1, a = R() * Math.PI * 2, s = Math.sqrt(1 - u * u);
      pos[k * 3] = Math.cos(a) * s; pos[k * 3 + 1] = u; pos[k * 3 + 2] = Math.sin(a) * s;
      const b = 120 + R() * 135, tint = R();
      col[k * 4] = b * (tint < 0.2 ? 1 : 0.85); col[k * 4 + 1] = b * 0.92; col[k * 4 + 2] = b * (tint > 0.75 ? 1 : 0.88); col[k * 4 + 3] = 255;
      size[k] = R() < 0.06 ? 2.6 : 1.4;
    }
    this.setPoints('stars', pos, col, size); this.starDirs = pos; this.starCol = col;
  }
  // The space views' sky: 8000 stars on the unit sphere, two in five of them
  // crowded along the galactic band (thickest toward its core), most faint and
  // a few bright, blue-white to orange. Each star is a quad of four corners.
  makeSky() {
    const gl = this.gl, n = 8000, R = rng(1977), nrm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
    const G = nrm([0.3, 0.86, -0.41]), e1 = nrm([G[1] * 1 - G[2] * 0, G[2] * 0 - G[0] * 1, 0]), e2 = [G[1] * e1[2] - G[2] * e1[1], G[2] * e1[0] - G[0] * e1[2], G[0] * e1[1] - G[1] * e1[0]];
    const ca = 2.3, GC = nrm([e1[0] * Math.cos(ca) + e2[0] * Math.sin(ca), e1[1] * Math.cos(ca) + e2[1] * Math.sin(ca), e1[2] * Math.cos(ca) + e2[2] * Math.sin(ca)]);
    const gauss = () => { let u = 0; for (let k = 0; k < 4; k++) u += R(); return (u - 2) * 1.7; };
    const TEMP = [[.12, [.68, .78, 1]], [.45, [.85, .9, 1]], [.75, [1, .98, .95]], [.9, [1, .9, .72]], [1, [1, .72, .52]]];
    const dir = new Float32Array(n * 12), cor = new Float32Array(n * 8), col = new Uint8Array(n * 16), idx = new Uint16Array(n * 6);
    for (let k = 0; k < n; k++) {
      let d, m = Math.pow(R(), 3.2);
      if (R() < 0.4) { const th = R() < 0.5 ? ca + gauss() * 0.7 : R() * Math.PI * 2, b = gauss() * 0.09, cb = Math.cos(b), sb = Math.sin(b); d = [0, 1, 2].map(i => cb * (Math.cos(th) * e1[i] + Math.sin(th) * e2[i]) + sb * G[i]); m *= 0.8; }
      else { const u = R() * 2 - 1, a = R() * Math.PI * 2, s = Math.sqrt(1 - u * u); d = [Math.cos(a) * s, u, Math.sin(a) * s]; }
      d = nrm(d); const t = R(), c = (TEMP.find(x => t < x[0]) || TEMP[4])[1];
      for (let v = 0; v < 4; v++) { dir.set(d, (k * 4 + v) * 3); cor.set([v >> 1, v & 1 ? 1 : -1], (k * 4 + v) * 2); col.set([c[0] * 255, c[1] * 255, c[2] * 255, Math.round(m * 255)], (k * 4 + v) * 4); }
      idx.set([k * 4, k * 4 + 1, k * 4 + 2, k * 4 + 2, k * 4 + 1, k * 4 + 3], k * 6);
    }
    const buf = (target, data) => { const b = gl.createBuffer(); gl.bindBuffer(target, b); gl.bufferData(target, data, gl.STATIC_DRAW); return b; };
    this.sky = {G, GC, count: n * 6, dir: buf(gl.ARRAY_BUFFER, dir), cor: buf(gl.ARRAY_BUFFER, cor), col: buf(gl.ARRAY_BUFFER, col), idx: buf(gl.ELEMENT_ARRAY_BUFFER, idx)};
  }
  // The sky texture, painted on first use (null where it cannot be).
  skyTexture() {
    if (this.skyTex !== undefined) return this.skyTex;
    const gl = this.gl; this.skyTex = null; let fb = null, gen = null;
    try {
      if (!this.sky) this.makeSky();
      gen = compile(gl, VS_BG, FS_SKYGEN); const W = 2048, H = 1024, t = gl.createTexture(); this.ownedTextures.add(t);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('sky framebuffer incomplete');
      gl.viewport(0, 0, W, H); gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.useProgram(gen.p); gl.uniform3fv(gen.u.uG, this.sky.G); gl.uniform3fv(gen.u.uGC, this.sky.GC);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bgBuf); gl.enableVertexAttribArray(gen.a.aP); gl.vertexAttribPointer(gen.a.aP, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3); gl.disableVertexAttribArray(gen.a.aP);
      this.skyTex = t;
    } catch (e) { console.error(e); }
    finally { gl.bindFramebuffer(gl.FRAMEBUFFER, null); if (fb) gl.deleteFramebuffer(fb); if (gen) gl.deleteProgram(gen.p); gl.viewport(0, 0, this.canvas.width, this.canvas.height); }
    return this.skyTex;
  }
  // The galactic band and nebulae behind everything (sky.k dims them).
  drawSkyBg(m, sky) {
    const gl = this.gl, inv = M4.inv(m.VP); if (!inv) return false;
    if (!this.sky) this.makeSky();
    const tex = this.skyTexture(), key = tex ? 'pskyt' : 'psky';
    if (this[key] === undefined) { try { this[key] = compile(gl, VS_BG, tex ? FS_SKYTEX : FS_SKY); } catch (e) { console.error(e); this[key] = null; } }
    const p = this[key]; if (!p) return false;
    gl.useProgram(p.p); gl.uniformMatrix4fv(p.u.uInv, false, inv); gl.uniform1f(p.u.uK, sky.k ?? 1);
    if (tex) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(p.u.uTex, 0); } else { gl.uniform3fv(p.u.uG, this.sky.G); gl.uniform3fv(p.u.uGC, this.sky.GC); }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bgBuf); gl.enableVertexAttribArray(p.a.aP); gl.vertexAttribPointer(p.a.aP, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3); gl.disableVertexAttribArray(p.a.aP); return true;
  }
  // The stars, as dots or (sky.s > 0) streaks away from sky.dir; added onto the sky.
  drawStars(m, sky) {
    const gl = this.gl;
    if (this.pstar === undefined) { try { this.pstar = compile(gl, VS_STAR, FS_STAR); } catch (e) { console.error(e); this.pstar = null; } }
    const p = this.pstar; if (!p) return; if (!this.sky) this.makeSky(); const S = this.sky;
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(p.p); gl.uniformMatrix4fv(p.u.uVP, false, m.VP); gl.uniform3fv(p.u.uF, sky.dir || [1, 0, 0]); gl.uniform1f(p.u.uS, sky.s || 0);
    gl.uniform2f(p.u.uRes, this.canvas.width, this.canvas.height); gl.uniform1f(p.u.uPx, this.canvas.width / Math.max(1, this.canvas.clientWidth || this.canvas.width)); gl.uniform1f(p.u.uK, sky.stars ?? 1);
    gl.bindBuffer(gl.ARRAY_BUFFER, S.dir); gl.enableVertexAttribArray(p.a.aDir); gl.vertexAttribPointer(p.a.aDir, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, S.cor); gl.enableVertexAttribArray(p.a.aCorner); gl.vertexAttribPointer(p.a.aCorner, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, S.col); gl.enableVertexAttribArray(p.a.aCol); gl.vertexAttribPointer(p.a.aCol, 4, gl.UNSIGNED_BYTE, true, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, S.idx); gl.drawElements(gl.TRIANGLES, S.count, gl.UNSIGNED_SHORT, 0);
    gl.disableVertexAttribArray(p.a.aDir); gl.disableVertexAttribArray(p.a.aCorner); gl.disableVertexAttribArray(p.a.aCol);
  }
  resize() {
    // renderScale (≤1) lowers the resolution when a busy scene drops frames.
    const dpr = Math.min(2, window.devicePixelRatio || 1) * C.clamp(this.renderScale || 1, .4, 1);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr)), h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
  }
  eye() {
    const c = this.cam, s = Math.sin(c.ph), v = [c.r * s * Math.cos(c.th), c.r * Math.cos(c.ph), c.r * s * Math.sin(c.th)], F = c.frame;
    // An optional orbit frame (column-major 3x3) lets the trial camera follow a pitched or rolled ship.
    if (F) return [c.target[0] + F[0] * v[0] + F[3] * v[1] + F[6] * v[2], c.target[1] + F[1] * v[0] + F[4] * v[1] + F[7] * v[2], c.target[2] + F[2] * v[0] + F[5] * v[1] + F[8] * v[2]];
    return [c.target[0] + v[0], c.target[1] + v[1], c.target[2] + v[2]];
  }
  matrices() {
    const w = this.canvas.width, h = this.canvas.height, c = this.cam;
    const e = this.eye();
    const up = c.frame ? [c.frame[3], c.frame[4], c.frame[5]] : Math.abs(Math.sin(c.ph)) < 1e-3 ? [Math.cos(c.th + Math.PI), 0, Math.sin(c.th + Math.PI)] : [0, 1, 0];
    const P = c.ortho?M4.ortho(2*c.r*Math.tan(c.fov/2),w/h,Math.max(.5,c.r*.02),c.r*8+6000):M4.persp(c.fov, w / h, c.near || Math.max(0.5, c.r * 0.02), c.far || c.r * 8 + 6000);
    const V = M4.lookAt(e, c.target, up);
    return {P, V, VP: M4.mul(P, V), eye: e};
  }
  ray(px, py) {   // ray from a CSS-pixel point, in ship coordinates
    const m = this.matrices(), inv = M4.inv(m.VP); if (!inv) return null;
    const rect = this.canvas.getBoundingClientRect();
    const x = (px - rect.left) / rect.width * 2 - 1, y = 1 - (py - rect.top) / rect.height * 2;
    const a = M4.xf(inv, [x, y, -1]), b = M4.xf(inv, [x, y, 1]);
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(d[0], d[1], d[2]);
    return {o: [a[0] - this.off[0], a[1] - this.off[1], a[2] - this.off[2]], d: [d[0] / l, d[1] / l, d[2] / l]};
  }
  project(p) {
    const m = this.matrices(), q = M4.xf(m.VP, [p[0] + this.off[0], p[1] + this.off[1], p[2] + this.off[2]]);
    const rect = this.canvas.getBoundingClientRect();
    return [rect.left + (q[0] + 1) / 2 * rect.width, rect.top + (1 - q[1]) / 2 * rect.height, q[2]];
  }
  draw(opt) {
    const gl = this.gl;if(gl.isContextLost())return false;this.resize();
    gl.colorMask(true,true,true,true);gl.depthMask(true);gl.disable(gl.SCISSOR_TEST);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0.02, 0.03, 0.045, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const m = this.matrices();
    // Shields shimmer in the animated fleet and trial views; the editor redraws
    // on demand, so it keeps one still frame of the pattern.
    this.rayTime=opt.fleet?(performance.now()/1000)%600:7.3;
    this.paint=opt.paint||'neutral';this.setLights(opt.lights);this.engineTint=opt.engineGlow&&opt.engineGlow!=='blue'?C.engineGlowRGB(opt.engineGlow):null;this.engineK=1;this.hullLength=opt.hullLength||1600;this.sourceRed=opt.reference==='venator';this.meshScale=opt.fleet?null:opt.meshScale||null;this.hidden=opt.fleet?null:opt.hidden||null;
    this.clip = opt.mode === 'cut' ? opt.clip : null;
    this.look = this.pickLook(opt); this.shTile = null;
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
    // The space views (opt.sky) have their own sky: the galactic band, then the
    // stars, which the hyperspace jump stretches; the planet and the tunnel go over them.
    const sky = opt.sky && !(opt.hyper && (opt.hyper.k ?? 1) >= 1) ? opt.sky : null;
    if (!(sky && this.drawSkyBg(m, sky))) {
      gl.useProgram(this.pb.p);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bgBuf); gl.enableVertexAttribArray(this.pb.a.aP); gl.vertexAttribPointer(this.pb.a.aP, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3); gl.disableVertexAttribArray(this.pb.a.aP);
    }
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    const e = m.eye;
    if (sky) this.drawStars(m, sky);
    else if (!opt.sky && !opt.noStars && !opt.hyper) this.drawPoints('stars', m, [e[0], e[1], e[2]], this.cam.r * 6 + 3000, 1, true);
    this.planetLight = !!opt.planet; if (opt.planet) this.drawPlanet(m, opt.planet); if (opt.hyper) this.drawHyper(m, opt.hyper);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    if(opt.fleet){this.drawFleet(m,opt);this.shTile=null;return true;}
    if (this.look.shadow && !this.noShadow) this.shTile = this.shadowDesign(opt);
    this.drawLines('grid', m, 1);
    gl.disable(gl.BLEND); gl.depthMask(true);
    const solids = ['gen', 'shield', 'hyper', 'engine', 'refEngine', 'nozzle', 'hangar'];
    if (opt.mode === 'xray') {
      gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
      for (const n of solids) this.drawMesh(n, m, 1);
      this.drawMesh('keel', m, 1);this.drawMesh('plant',m,1);this.drawMesh('refPlant',m,1);this.drawMesh('interior',m,1);this.drawMesh('preview',m,1);this.drawMesh('previewRef',m,1,0);
      gl.disable(gl.CULL_FACE); this.drawMesh('fits', m, 1);this.drawMesh('refFits', m, 1);this.drawMesh('previewFits',m,1);this.drawMesh('previewRefFits',m,1,0);
      this.drawGlow(m);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.enable(gl.CULL_FACE);
      this.drawMesh('hull', m, 0.13, 0.25); this.drawMesh('struct', m, 0.16, 0.25); this.drawMesh('plate', m, 0.16, 0.25);this.drawMesh('refHull',m,.13,0);this.drawMesh('refStruct',m,.16,0);this.drawMesh('refHatches',m,.3,0);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -2);
      this.drawMesh('hatchOpen', m, 0.45);
      gl.disable(gl.POLYGON_OFFSET_FILL);
      this.drawRays(m, ['hatchRay'], 0.8);
    } else {
      const cut = opt.mode === 'cut';
      if (cut) gl.disable(gl.CULL_FACE); else { gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); }
      this.drawMesh('hull', m, 1); this.drawMesh('struct', m, 1); this.drawMesh('plate', m, 1);this.drawMesh('refHull',m,1,0);this.drawMesh('refStruct',m,1,0);this.drawMesh('refHatches',m,1,0);
      for (const n of solids) this.drawMesh(n, m, 1);
      this.drawMesh('preview',m,1);this.drawMesh('previewRef',m,1,0);
      if (cut){this.drawMesh('keel', m, 1);this.drawMesh('plant',m,1);this.drawMesh('refPlant',m,1);this.drawMesh('interior',m,1);}
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -2);
      this.drawMesh('hatchOpen', m, 1);
      gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.disable(gl.CULL_FACE); this.drawMesh('fits', m, 1);this.drawMesh('refFits', m, 1);this.drawMesh('previewFits',m,1);this.drawMesh('previewRefFits',m,1,0);
      this.drawGlow(m);
      this.drawRays(m, ['hatchRay'], 1);
    }
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.CULL_FACE); gl.depthMask(false);
    if (opt.mode === 'cut') this.drawLines('section', m, 1);
    const cutterClip=this.clip;this.clip=null;
    this.drawMesh('cutter',m,.24,.5);
    gl.disable(gl.DEPTH_TEST);this.drawLines('cutter',m,.38);
    gl.enable(gl.DEPTH_TEST);this.drawLines('cutter',m,1);this.clip=cutterClip;
    gl.disable(gl.DEPTH_TEST); this.drawLines('ghost', m, 0.35);
    gl.enable(gl.DEPTH_TEST); this.drawLines('ghost', m, 1);
    gl.depthMask(true); this.shTile = null;
    // getError() stalls the GPU pipeline; sample it occasionally.
    this._errCheck=(this._errCheck||0)+1;if(this._errCheck%120===1){const error=gl.getError();if(error===gl.OUT_OF_MEMORY)throw new Error('描画メモリが不足しました');}
    if(gl.isContextLost())return false;return true;
  }
  // Translucent pass for ray shields, after every opaque surface: depth-tested
  // but not depth-writing, pulled forward so the halo never fights the plating.
  drawRays(m, names, alpha) {
    const gl = this.gl; gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.disable(gl.CULL_FACE);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -4);
    for (const n of names) this.drawRay(n, m, alpha);
    gl.disable(gl.POLYGON_OFFSET_FILL); gl.depthMask(true); gl.disable(gl.BLEND);
  }
  drawRay(name, m, alpha) {
    const mm = this.meshes[name]; if (!mm || !mm.count) return;
    const gl = this.gl;
    if (this.pray === undefined) { try { this.pray = compile(gl, VS_MESH, FS_RAY); } catch (e) { console.error(e); this.pray = null; } }
    const p = this.pray; if (!p) { gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); this.drawMesh(name, m, 0.6 * alpha); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); return; }
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(p.u.uVP, false, m.VP); gl.uniform3fv(p.u.uOff, this.off);
    gl.uniform3fv(p.u.uCenter, this.modelCenter || [0, 0, 0]); gl.uniformMatrix3fv(p.u.uRot, false, this.modelRot || yawMatrix(this.modelYaw || 0)); gl.uniform3fv(p.u.uScl, this.meshScale?.[name] || [1, 1, 1]);
    gl.uniform3fv(p.u.uEye, m.eye); gl.uniform1f(p.u.uTime, this.rayTime || 0); gl.uniform1f(p.u.uAlpha, alpha);
    gl.uniform3fv(p.u.uClip, this.clip || [1e9, 1e9, 1e9]); gl.uniform1f(p.u.uClipOn, this.clip ? 1 : 0);
    const used = [], at = (k, buf, n, type, normd) => { const loc = p.a[k]; if (loc == null || loc < 0) return; gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, type, normd, 0, 0); used.push(loc); };
    at('aPos', mm.pos, 3, gl.FLOAT, false); at('aNor', mm.nor, 3, gl.BYTE, true); at('aUv', mm.uv, 2, gl.FLOAT, false); at('aCol', mm.col, 4, gl.UNSIGNED_BYTE, true);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mm.idx);
    if (mm.flat) gl.drawArrays(gl.TRIANGLES, 0, mm.count); else gl.drawElements(gl.TRIANGLES, mm.count, mm.type, 0);
    for (const loc of used) gl.disableVertexAttribArray(loc);
  }
  drawGlow(m) {
    const gl = this.gl; gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
    this.drawPoints('glow', m, this.off, 1, 2, false);
    gl.depthMask(true); gl.disable(gl.BLEND);
  }
  // Port lights: a colour name from the design ('off' for none; white by default).
  setLights(k){const c=k==='off'?null:SHIP_LIGHTS[k]||SHIP_LIGHTS.white;this.lightCol=c||[0,0,0];this.lightK=c?1:0;}
  drawMesh(name, m, alpha, emi) {
    const mm = this.meshes[name]; if (!mm || !mm.count) return;
    const gl = this.gl, p = this.pm, tx = this.tex[MESH_TEX[name] || 'hull'];
    gl.useProgram(p.p);
    const lit=this.lightK>0&&LIGHT_MESHES.has(name)&&(alpha==null||alpha>.9);gl.uniform1f(p.u.uLightK,lit?this.lightK:0);
    if(lit){const H=Math.max(1,this.canvas.height),t=2*Math.tan((this.cam.fov||.72)/2);gl.uniform3fv(p.u.uLightCol,this.lightCol);gl.uniform2f(p.u.uPix,t/H,this.cam.ortho?t*this.cam.r/H:0);}
    gl.uniformMatrix4fv(p.u.uVP, false, m.VP); gl.uniform3fv(p.u.uOff, this.off);
    gl.uniform3fv(p.u.uCenter,this.modelCenter||[0,0,0]);gl.uniformMatrix3fv(p.u.uRot,false,this.modelRot||yawMatrix(this.modelYaw||0));gl.uniform3fv(p.u.uScl,this.unitScl||this.meshScale?.[name]||[1,1,1]);gl.uniform1f(p.u.uFlash,this.unitFlash||0);
    const lk = this.look || LOOKS.flat; gl.uniform3fv(p.u.uL1, lk.L1); gl.uniform3fv(p.u.uL2, lk.L2);
    gl.uniform3fv(p.u.uC1, lk.C1); gl.uniform3fv(p.u.uC2, lk.C2); gl.uniform3fv(p.u.uSky, lk.sky); gl.uniform3fv(p.u.uGnd, lk.gnd); gl.uniform2f(p.u.uLook, lk.tone, lk.exp);
    const sht = this.shTile, SH = this.sh; if (sht && SH && sht.M && !this.unitScl) { gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, SH.t); gl.uniform1i(p.u.uShadow, 2); gl.uniformMatrix4fv(p.u.uShM, false, sht.M); gl.uniform4fv(p.u.uShTile, sht.uv); gl.uniform4f(p.u.uShK, 1, 1 / SH.size, sht.bias, sht.noff); } else gl.uniform4f(p.u.uShK, 0, 0, 0, 0);
    gl.uniform3fv(p.u.uEye, m.eye); gl.uniform1f(p.u.uAlpha, alpha);
    gl.uniform1f(p.u.uPaint,this.paint==='dark'?2:this.paint==='republic'?1:0);gl.uniform1f(p.u.uRefHull,name==='refHull'&&!this.sourceRed?1:0);gl.uniform1f(p.u.uHullLength,this.hullLength||1600);
    gl.uniform1f(p.u.uReference, REFERENCE_SHADED.has(name)||name.startsWith('refTur_')?1:name==='refEngine'?2:0);
    // v18 Drive nozzles burn in the design's engine colour, brighter with thrust.
    const drive=name==='nozzle'||name==='refEngine',tint=drive?this.engineTint:null;gl.uniform4fv(p.u.uEmiTint,tint?[tint[0]/255,tint[1]/255,tint[2]/255,1]:[1,1,1,0]);
    gl.uniform1f(p.u.uEmi, (emi == null ? 1 : emi) * (MESH_EMI[name] == null ? 1 : MESH_EMI[name]) * (drive ? (this.engineK ?? 1) : 1));
    gl.uniform3fv(p.u.uClip, this.clip || [1e9, 1e9, 1e9]); gl.uniform3fv(p.u.uClipLo, this.clipLo || [-1e9, -1e9, -1e9]); gl.uniform1f(p.u.uClipOn, this.clip || this.clipLo ? 1 : 0); gl.uniform1f(p.u.uBack, BACK_OWN.has(name)||name.startsWith('tur_') ? 1 : 0);
    gl.uniform4fv(p.u.uSeam, this.seam || [0, 0, 1, 0]); gl.uniform1f(p.u.uChar, this.char || 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tx.a); gl.uniform1i(p.u.uTex, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tx.e); gl.uniform1i(p.u.uEmiTex, 1);
    const at = (loc, buf, n, type, normd) => { gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, n, type, normd, 0, 0); };
    at(p.a.aPos, mm.pos, 3, gl.FLOAT, false); at(p.a.aNor, mm.nor, 3, gl.BYTE, true);
    at(p.a.aUv, mm.uv, 2, gl.FLOAT, false); at(p.a.aCol, mm.col, 4, gl.UNSIGNED_BYTE, true);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mm.idx);
    // Hidden index ranges belong to parts the editor is previewing elsewhere.
    const span = (start, count) => { if (count <= 0) return; if (mm.flat) gl.drawArrays(gl.TRIANGLES, start, count); else gl.drawElements(gl.TRIANGLES, count, mm.type, start * (mm.type === gl.UNSIGNED_INT ? 4 : 2)); };
    const hid = this.hidden && this.hidden[name];
    if (hid && hid.length) { let cur = 0; for (const [st0, n] of hid) { span(cur, st0 - cur); cur = Math.max(cur, st0 + n); } span(cur, mm.count - cur); }
    else span(0, mm.count);
    for (const k of ['aPos', 'aNor', 'aUv', 'aCol']) gl.disableVertexAttribArray(p.a[k]);
  }
  drawLines(name, m, a) {
    const l = this.lines[name]; if (!l || !l.count) return;
    const gl = this.gl, p = this.pl;
    gl.useProgram(p.p); gl.uniformMatrix4fv(p.u.uVP, false, m.VP); gl.uniform3fv(p.u.uOff, this.off); gl.uniform1f(p.u.uA, a);
    gl.bindBuffer(gl.ARRAY_BUFFER, l.pos); gl.enableVertexAttribArray(p.a.aPos); gl.vertexAttribPointer(p.a.aPos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, l.col); gl.enableVertexAttribArray(p.a.aCol); gl.vertexAttribPointer(p.a.aCol, 4, gl.UNSIGNED_BYTE, true, 0, 0);
    gl.drawArrays(gl.LINES, 0, l.count);
    gl.disableVertexAttribArray(p.a.aPos); gl.disableVertexAttribArray(p.a.aCol);
  }
  drawPlanet(m, planet) {
    const gl = this.gl;
    // v22 a program per kind of world, compiled the first time that kind is drawn
    const pk = Math.max(0, Math.min(9, Math.round(planet.kind || 0)));this.pplanets = this.pplanets || {};
    if (this.pplanets[pk] === undefined) { try { this.pplanets[pk] = compile(gl, VS_BG, '#define PK ' + pk + '\n' + FS_PLANET); } catch (e) { console.error(e); this.pplanets[pk] = null; } }
    const p = this.pplanets[pk]; if (!p) return;
    const inv = M4.inv(m.VP); if (!inv) return;
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(p.u.uInv, false, inv); gl.uniform3fv(p.u.uEye, m.eye); gl.uniform3fv(p.u.uPC, planet.center); gl.uniform1f(p.u.uR, planet.radius);
    gl.uniform3fv(p.u.uSun, planet.sun); gl.uniform1f(p.u.uPix, 2 * Math.tan(this.cam.fov / 2) / Math.max(1, this.canvas.height));
    gl.uniform1f(p.u.uKind, planet.kind || 0); gl.uniform3fv(p.u.uAxis, planet.axis || [0, 1, 0]); gl.uniform2fv(p.u.uRing, planet.ring || [0, 0]); if (p.u.uLook) gl.uniform4fv(p.u.uLook, planet.look || [0, 0, 0, 0]);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bgBuf); gl.enableVertexAttribArray(p.a.aP); gl.vertexAttribPointer(p.a.aP, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3); gl.disableVertexAttribArray(p.a.aP);
  }
  drawHyper(m, hyper) {
    const gl = this.gl;
    if (this.phyper === undefined) { try { this.phyper = compile(gl, VS_BG, FS_HYPER); } catch (e) { console.error(e); this.phyper = null; } }
    const p = this.phyper; if (!p) return;
    const inv = M4.inv(m.VP); if (!inv) return;
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(p.p); gl.uniformMatrix4fv(p.u.uInv, false, inv); gl.uniform3fv(p.u.uDir, hyper.dir); gl.uniform1f(p.u.uTime, hyper.time % 600); gl.uniform1f(p.u.uK, hyper.k ?? 1);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bgBuf); gl.enableVertexAttribArray(p.a.aP); gl.vertexAttribPointer(p.a.aP, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3); gl.disableVertexAttribArray(p.a.aP);
  }
  drawPoints(name, m, off, scale, minPx, unitSphere) {
    const pt = this.points[name]; if (!pt || !pt.count) return;
    const gl = this.gl, p = this.pp;
    gl.useProgram(p.p);
    let VP = m.VP;
    if (unitSphere) {
      const S = new Float32Array([scale, 0, 0, 0, 0, scale, 0, 0, 0, 0, scale, 0, 0, 0, 0, 1]); VP = M4.mul(m.VP, S);
      gl.uniform3fv(p.u.uOff, [off[0] / scale, off[1] / scale, off[2] / scale]);
      gl.uniform1f(p.u.uScale, 0.0);
    } else {
      gl.uniform3fv(p.u.uOff, off);
      gl.uniform1f(p.u.uScale, this.canvas.height / (2 * Math.tan(this.cam.fov / 2) * (this.cam.ortho?this.cam.r:1)));
    }
    gl.uniformMatrix4fv(p.u.uVP, false, VP); gl.uniform1f(p.u.uMin, minPx * Math.min(2, window.devicePixelRatio || 1));
    gl.bindBuffer(gl.ARRAY_BUFFER, pt.pos); gl.enableVertexAttribArray(p.a.aPos); gl.vertexAttribPointer(p.a.aPos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, pt.col); gl.enableVertexAttribArray(p.a.aCol); gl.vertexAttribPointer(p.a.aCol, 4, gl.UNSIGNED_BYTE, true, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, pt.size); gl.enableVertexAttribArray(p.a.aSize); gl.vertexAttribPointer(p.a.aSize, 1, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.POINTS, 0, pt.count);
    gl.disableVertexAttribArray(p.a.aPos); gl.disableVertexAttribArray(p.a.aCol); gl.disableVertexAttribArray(p.a.aSize);
  }
}
const L1 = C.norm([0.55, 0.9, 0.45]), L2 = C.norm([-0.6, -0.35, -0.7]);
// v20.2 Lighting looks. 'flat' keeps the even light of the x-ray and cut-away views. 'studio' (design
// screen, fleet review) is one strong key light from high on the port bow, so the deck and the faces
// forward catch it and the starboard walls fall dark, with the
// rest left nearly black; 'space' takes the system's sun as the key. Highlights roll off on film's curve.
const LOOKS = {
 flat: {L1, L2, C1: [1.05, 1.0, 0.94], C2: [0.22, 0.30, 0.42], sky: [0.30, 0.34, 0.40], gnd: [0.10, 0.11, 0.13], tone: 0, exp: 1, shadow: false},
 studio: {L1: C.norm([0.5, 0.7, -0.5]), L2: C.norm([-0.35, -0.3, 0.88]), C1: [1.8, 1.73, 1.62], C2: [0.07, 0.085, 0.11], sky: [0.065, 0.072, 0.086], gnd: [0.028, 0.03, 0.034], tone: 1, exp: 1, shadow: true},
 space: {C1: [1.95, 1.88, 1.76], C2: [0.04, 0.05, 0.065], sky: [0.035, 0.04, 0.05], gnd: [0.025, 0.025, 0.03], tone: 1, exp: 1, shadow: true},
 tunnel: {C1: [1.0, 1.15, 1.5], C2: [0.12, 0.17, 0.28], sky: [0.12, 0.17, 0.26], gnd: [0.06, 0.09, 0.15], tone: 1, exp: 1, shadow: true},
};
// Meshes that cast the key light's shadow (on the design screen; fleet assets take all their static meshes).
const SHADOW_CASTERS = ['hull', 'struct', 'plate', 'refHull', 'refStruct', 'refHatches', 'gen', 'shield', 'hyper', 'engine', 'refEngine', 'nozzle', 'hangar', 'fits', 'refFits'];
const SHADOW_SKIP = /^(hatchOpen|hatchRay|trialTarget|slideRay_|slideDoor_|refSlideDoor_|preview)/;
Renderer.prototype.pickLook = function (opt) {
 if (this.keyOverride && !(opt.fleet && (opt.planet || opt.sky || opt.hyper)) && opt.mode !== 'xray' && opt.mode !== 'cut') { const k = this.keyOverride.join(); if (this._kov?.k !== k) this._kov = {...LOOKS.studio, k, L1: C.norm(this.keyOverride)}; return this._kov; }
 if (!opt.fleet) return opt.mode === 'xray' || opt.mode === 'cut' ? LOOKS.flat : LOOKS.studio;
 if (!(opt.planet || opt.sky || opt.hyper)) return LOOKS.studio;
 const hk = opt.hyper ? (opt.hyper.k ?? 1) : 0, base = hk >= 1 ? LOOKS.tunnel : LOOKS.space, L = hk < 1 && opt.planet?.sun ? C.norm(opt.planet.sun) : LOOKS.studio.L1, key = base === LOOKS.tunnel ? 't' : L.map(v => v.toFixed(5)).join();
 if (this._look?.key !== key) this._look = {...base, key, L1: L, L2: C.norm([-L[0], -L[1] - .5, -L[2]])};
 return this._look;
};
// The shadow map: one RGBA texture (depth packed into its bytes) with a depth buffer, laid out as one
// map for the design screen or four tiles for the fleet views. Off where the GPU lacks high precision.
Renderer.prototype.shadowInit = function () {
 if (this.sh !== undefined) return this.sh; this.sh = null; const gl = this.gl;
 try {
  const hp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT); if (!hp || hp.precision < 20) return null;
  const size = Math.min(2048, gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)); if (size < 1024) return null;
  const t = gl.createTexture(); this.ownedTextures.add(t); gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  gl.bindTexture(gl.TEXTURE_2D, null); gl.activeTexture(gl.TEXTURE0);
  const rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, size, size); gl.bindRenderbuffer(gl.RENDERBUFFER, null);
  const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE; gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (!ok) { gl.deleteFramebuffer(fb); gl.deleteRenderbuffer(rb); return null; }
  this.sh = {t, rb, fb, size, prog: compile(gl, VS_SHADOW, FS_SHADOW), tiles: [], layout: null, frame: 0};
 } catch (e) { console.warn('shadows off', e); this.sh = null; }
 return this.sh;
};
Renderer.prototype.shadowLayout = function (kind) {
 const S = this.sh; if (S.layout === kind) return; S.layout = kind; const n = kind === 'one' ? 1 : 2, s = S.size / n; S.tiles = [];
 for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) S.tiles.push({x: i * s, y: j * s, s, key: null, L: null, sig: null, used: -1, M: null});
};
// Draws one tile: the casters' depth from the light L (in the ship's frame, toward the light), fitted
// to the box b. The map's long side follows the ship's length (x) where the light allows.
Renderer.prototype.shadowRender = function (tile, meshes, names, L, b, hidden) {
 const gl = this.gl, S = this.sh, p = S.prog, w = C.norm(L), X = Math.abs(w[0]) < .97 ? [1, 0, 0] : [0, 0, 1], u = C.norm(C.sub(X, C.mul(w, C.dot(X, w)))), v = C.cross(w, u);
 const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
 for (let k = 0; k < 8; k++) { const q = [k & 1 ? b[3] : b[0], k & 2 ? b[4] : b[1], k & 4 ? b[5] : b[2]], r = [C.dot(q, u), C.dot(q, v), C.dot(q, w)]; for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], r[i]); hi[i] = Math.max(hi[i], r[i]); } }
 for (let i = 0; i < 3; i++) { const pad = (hi[i] - lo[i]) * .01 + 1; lo[i] -= pad; hi[i] += pad; }
 const hu = (hi[0] - lo[0]) / 2, hv = (hi[1] - lo[1]) / 2, cu = (hi[0] + lo[0]) / 2, cv = (hi[1] + lo[1]) / 2, zr = hi[2] - lo[2];
 // Column-major: clip x, y across the light; z 0 at the side nearest the light.
 const M = new Float32Array([u[0] / hu, v[0] / hv, -2 * w[0] / zr, 0, u[1] / hu, v[1] / hv, -2 * w[1] / zr, 0, u[2] / hu, v[2] / hv, -2 * w[2] / zr, 0, -cu / hu, -cv / hv, (hi[2] + lo[2]) / zr, 1]);
 const g = 2, vs = tile.s - 2 * g;
 gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, null); gl.activeTexture(gl.TEXTURE0);
 gl.bindFramebuffer(gl.FRAMEBUFFER, S.fb); gl.viewport(tile.x, tile.y, tile.s, tile.s); gl.enable(gl.SCISSOR_TEST); gl.scissor(tile.x, tile.y, tile.s, tile.s);
 gl.colorMask(true, true, true, true); gl.depthMask(true); gl.clearColor(1, 1, 1, 1); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
 gl.viewport(tile.x + g, tile.y + g, vs, vs); gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.disable(gl.CULL_FACE); gl.disable(gl.POLYGON_OFFSET_FILL);
 gl.useProgram(p.p); gl.uniformMatrix4fv(p.u.uSM, false, M); const loc = p.a.aPos; gl.enableVertexAttribArray(loc);
 for (const n of names) { const mm = meshes[n]; if (!mm || !mm.count) continue;
  gl.bindBuffer(gl.ARRAY_BUFFER, mm.pos); gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mm.idx);
  const span = (st0, c) => { if (c <= 0) return; if (mm.flat) gl.drawArrays(gl.TRIANGLES, st0, c); else gl.drawElements(gl.TRIANGLES, c, mm.type, st0 * (mm.type === gl.UNSIGNED_INT ? 4 : 2)); };
  const hid = hidden && hidden[n]; if (hid && hid.length) { let cur = 0; for (const [s0, k] of hid) { span(cur, s0 - cur); cur = Math.max(cur, s0 + k); } span(cur, mm.count - cur); } else span(0, mm.count); }
 gl.disableVertexAttribArray(loc); gl.disable(gl.SCISSOR_TEST); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
 gl.viewport(0, 0, this.canvas.width, this.canvas.height); gl.clearColor(0.02, 0.03, 0.045, 1); gl.depthFunc(gl.LEQUAL);
 const tw = Math.max(hu, hv) * 2 / vs; tile.M = M; tile.uv = [(tile.x + g) / S.size, (tile.y + g) / S.size, vs / S.size, vs / S.size]; tile.bias = .75 * tw / zr; tile.noff = 1.25 * tw; tile.L = w;
};
// The design screen: the whole map for the ship on the stocks, redrawn only when a caster, the parts
// hidden for an edit or the light changes (a live resize keeps the last map until it is let go).
Renderer.prototype.shadowDesign = function (opt) {
 const S = this.shadowInit(); if (!S) return null; this.shadowLayout('one'); const t = S.tiles[0];
 const names = SHADOW_CASTERS.filter(n => this.meshes[n]?.count && this.meshes[n].bb); if (!names.length) return null;
 const R = this.modelRot || yawMatrix(this.modelYaw || 0), W = this.look.L1, L = [R[0] * W[0] + R[1] * W[1] + R[2] * W[2], R[3] * W[0] + R[4] * W[1] + R[5] * W[2], R[6] * W[0] + R[7] * W[1] + R[8] * W[2]];
 const sig = names.map(n => n + ':' + this.meshes[n].ver).join(',') + '|' + JSON.stringify(opt.hidden || null) + '|' + L.map(x => x.toFixed(5)).join();
 if (t.sig !== sig && !(opt.meshScale && Object.keys(opt.meshScale).length && t.M)) {
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]; for (const n of names) { const q = this.meshes[n].bb; for (let k = 0; k < 3; k++) { b[k] = Math.min(b[k], q[k]); b[k + 3] = Math.max(b[k + 3], q[k + 3]); } }
  this.shadowRender(t, this.meshes, names, L, b, opt.hidden); t.sig = sig; t.key = 'design';
 }
 return t.M ? t : null;
};
// The fleet and space views: the (up to) four ships largest on screen get a tile. A map belongs to a
// design lit from one side in its own frame, so ships of one design on one heading share it; a turning
// ship's map is redrawn when its light has moved by about half a degree (two maps a frame at most).
Renderer.prototype.shadowFleet = function (list) {
 const S = this.shadowInit(); if (!S) return null; this.shadowLayout('four'); S.frame++; const out = new Map(), W = this.look.L1; let budget = 2;
 // A battle already drawn at the lowest resolution keeps a map for the largest ship only.
 for (const c of list.sort((a, b) => b.px - a.px).slice(0, (this.renderScale || 1) <= .55 ? 1 : 4)) {
  const R = c.u.rot || yawMatrix(c.u.yaw || 0), L = [R[0] * W[0] + R[1] * W[1] + R[2] * W[2], R[3] * W[0] + R[4] * W[1] + R[5] * W[2], R[6] * W[0] + R[7] * W[1] + R[8] * W[2]];
  let best = null, bd = -2; for (const t of S.tiles) if (t.key === c.u.key && t.M) { const d = C.dot(t.L, L); if (d > bd) { bd = d; best = t; } }
  if (best && bd > .99996) { best.used = S.frame; out.set(c.u, best); continue; }
  if (budget > 0) { const t = best && best.used !== S.frame ? best : S.tiles.filter(x => x.used !== S.frame).sort((a, b) => a.used - b.used)[0];
   if (t) { const a = c.a; if (!a._casters) a._casters = Object.keys(a.meshes).filter(n => !SHADOW_SKIP.test(n)); this.shadowRender(t, a.meshes, a._casters, L, a.bounds, null); t.key = c.u.key; t.used = S.frame; budget--; out.set(c.u, t); continue; } }
  if (best && bd > .9986) { best.used = S.frame; out.set(c.u, best); }
 }
 return out;
};

// ---------- line helpers ----------
function lineSet() {
  const pos = [], col = [];
  return {
    seg(a, b, c) { pos.push(a[0], a[1], a[2], b[0], b[1], b[2]); col.push(c[0], c[1], c[2], c[3], c[0], c[1], c[2], c[3]); },
    box(b, c) {
      const P = [[b[0], b[1], b[2]], [b[3], b[1], b[2]], [b[3], b[4], b[2]], [b[0], b[4], b[2]], [b[0], b[1], b[5]], [b[3], b[1], b[5]], [b[3], b[4], b[5]], [b[0], b[4], b[5]]];
      for (const [i, j] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) this.seg(P[i], P[j], c);
    },
    poly(P, E, c) { for (const [i, j] of E) this.seg(P[i], P[j], c); },
    circle(cen, u, v, r, c, n) {
      n = n || 48; let prev = null;
      for (let k = 0; k <= n; k++) { const a = k / n * Math.PI * 2, p = [cen[0] + (u[0] * Math.cos(a) + v[0] * Math.sin(a)) * r, cen[1] + (u[1] * Math.cos(a) + v[1] * Math.sin(a)) * r, cen[2] + (u[2] * Math.cos(a) + v[2] * Math.sin(a)) * r]; if (prev) this.seg(prev, p, c); prev = p; }
    },
    part(pt, c) {
      if(pt._packing){for(const b of pt._packing.boxes)this.box(b,c);return;}
      const sh = C.PARTS[pt.k].shape;
      if (sh === 'sphere') { const r = pt.d / 2 * 1.02; this.circle(pt.c, [1, 0, 0], [0, 1, 0], r, c); this.circle(pt.c, [1, 0, 0], [0, 0, 1], r, c); this.circle(pt.c, [0, 1, 0], [0, 0, 1], r, c); return; }
      const skin=pt.k==='engine'&&C.engineSkinMesh(pt);
      if(skin){const f=C.frameAxis(skin.u),e0=C.add(pt.c,C.mul(skin.u,skin.t0)),e1=C.add(pt.c,C.mul(skin.u,skin.t1)),r=skin.rad*1.02;for(const e of [e0,e1])this.circle(e,f.v,f.w,r,c,32);for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){const q=C.add(C.mul(f.v,Math.cos(a)*r),C.mul(f.w,Math.sin(a)*r));this.seg(C.add(e0,q),C.add(e1,q),c);}return;}
      if(sh==='cyl'||sh==='engine'){const m=C.partDims(pt),f=C.frameAxis(pt.dir||[1,0,0]);for(const sg of [-1,1])this.circle(C.add(pt.c,C.mul(f.u,sg*m.l/2)),f.v,f.w,m.rad,c,32);for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){const r=C.add(C.mul(f.v,Math.cos(a)*m.rad),C.mul(f.w,Math.sin(a)*m.rad));this.seg(C.add(C.sub(pt.c,C.mul(f.u,m.l/2)),r),C.add(C.add(pt.c,C.mul(f.u,m.l/2)),r),c);}return;}
      if(pt.k==='struct'||pt.room){const T=C.structTriangles(pt.room?C.roomShape(pt):pt);for(let i=0;i<T.length;i+=9){const a=Array.from(T.slice(i,i+3)),b=Array.from(T.slice(i+3,i+6)),d=Array.from(T.slice(i+6,i+9));this.seg(a,b,c);this.seg(b,d,c);this.seg(d,a,c);}return;}
      this.box(C.partAABB(pt), c);
    },
    cross(p, r, c) { this.seg([p[0] - r, p[1], p[2]], [p[0] + r, p[1], p[2]], c); this.seg([p[0], p[1] - r, p[2]], [p[0], p[1] + r, p[2]], c); this.seg([p[0], p[1], p[2] - r], [p[0], p[1], p[2] + r], c); },
    out() { return {pos: new Float32Array(pos), col: new Uint8Array(col)}; },
  };
}
function niceStep(v) { const e = Math.pow(10, Math.floor(Math.log10(v))), m = v / e; return (m < 1.5 ? 1 : m < 3.5 ? 2.5 : m < 7.5 ? 5 : 10) * e; }
function gridLines(ship, bounds) {
  const ls = lineSet(), L = ship.hull.L, W = Math.max(ship.hull.W, 40), st = niceStep(L / 14), y = bounds[1] - Math.max(8, ship.hull.H * 0.18);
  const x0 = Math.floor(-L * 0.2 / st) * st, x1 = Math.ceil(L * 1.2 / st) * st, z1 = Math.ceil(W * 0.9 / st) * st;
  for (let x = x0; x <= x1 + 1e-6; x += st) { const major = Math.abs(Math.round(x / st)) % 4 === 0; ls.seg([x, y, -z1], [x, y, z1], [110, 170, 200, major ? 70 : 24]); }
  for (let z = -z1; z <= z1 + 1e-6; z += st) { const major = Math.abs(Math.round(z / st)) % 4 === 0; ls.seg([x0, y, z], [x1, y, z], [110, 170, 200, major ? 70 : 24]); }
  const bx = L * 1.08, a = st * 0.5;
  ls.seg([bx, y, 0], [bx + st * 1.6, y, 0], [140, 200, 225, 180]); ls.seg([bx + st * 1.6, y, 0], [bx + st * 1.6 - a, y, -a * 0.6], [140, 200, 225, 180]); ls.seg([bx + st * 1.6, y, 0], [bx + st * 1.6 - a, y, a * 0.6], [140, 200, 225, 180]);
  return ls.out();
}
function sectionLines(ship, clip) {
  const ls = lineSet(); if (!clip) return ls.out();
  const g = C.hullGeo(ship), L = ship.hull.L, col = [240, 170, 70, 255];
  const vis = (p) => p[0] <= clip[0] + 0.01 && p[1] <= clip[1] + 0.01 && p[2] <= clip[2] + 0.01;
  if (clip[0] < L && clip[0] > 0) {
    const s = C.sampleSection(ship, clip[0]), N = s.Z.length;
    for (let j = 0; j < N; j++) { const a = [clip[0], s.Y[j], s.Z[j]], b = [clip[0], s.Y[(j + 1) % N], s.Z[(j + 1) % N]]; if (vis(a) && vis(b)) ls.seg(a, b, col); }
  }
  for (const ax of [1, 2]) {
    const c = clip[ax]; if (c > 1e8) continue;
    let prev = null;
    for (let i = 0; i < g.xs.length; i++) {
      const s = g.secs[i], A = ax === 1 ? s.Y : s.Z, B = ax === 1 ? s.Z : s.Y, N = A.length, cr = [];
      for (let j = 0; j < N; j++) { const a = A[j] - c, b = A[(j + 1) % N] - c; if ((a < 0) !== (b < 0)) { const t = a / (a - b); cr.push(B[j] + (B[(j + 1) % N] - B[j]) * t); } }
      cr.sort((p, q) => p - q);
      if (prev && prev.length === cr.length) for (let k = 0; k < cr.length; k++) {
        const P = ax === 1 ? [g.xs[i - 1], c, prev[k]] : [g.xs[i - 1], prev[k], c], Q = ax === 1 ? [g.xs[i], c, cr[k]] : [g.xs[i], cr[k], c];
        if (vis(P) && vis(Q)) ls.seg(P, Q, col);
      }
      prev = cr;
    }
  }
  return ls.out();
}
function shipBounds(ship) {
  const g = C.hullGeo(ship), b = [0, Infinity, Infinity, ship.hull.L, -Infinity, -Infinity];
  for (const s of g.secs) for (let j = 0; j < s.Y.length; j++) { b[1] = Math.min(b[1], s.Y[j]); b[4] = Math.max(b[4], s.Y[j]); b[2] = Math.min(b[2], s.Z[j]); b[5] = Math.max(b[5], s.Z[j]); }
  const rb=C.referenceHullGeometry(ship)?.bounds;if(rb)for(let k=0;k<3;k++){b[k]=Math.min(b[k],rb[k]);b[k+3]=Math.max(b[k+3],rb[k+3]);}
  for (const pt of ship.parts) { const a = C.refPartBounds(pt)||C.partAABB(pt); for (let k = 0; k < 3; k++) { b[k] = Math.min(b[k], a[k]); b[k + 3] = Math.max(b[k + 3], a[k + 3]); } }
  for (const f of ship.fits) { const a = C.fitAABB(f); for (let k = 0; k < 3; k++) { b[k] = Math.min(b[k], a[k]); b[k + 3] = Math.max(b[k + 3], a[k + 3]); } }
  if (!isFinite(b[1])) { b[1] = 0; b[4] = ship.hull.H; b[2] = -ship.hull.W / 2; b[5] = ship.hull.W / 2; }
  return b;
}
function triangleMesh(g,T,col,scale=48){
  // Allocation-free flat-shaded triangles (same output as the per-vertex path).
  const nt=Math.floor(T.length/9);if(!nt)return;g.room(nt*3,nt*3);
  for(let i=0;i<nt*9;i+=9){
    const ax=T[i],ay=T[i+1],az=T[i+2],bx=T[i+3],by=T[i+4],bz=T[i+5],cx=T[i+6],cy=T[i+7],cz=T[i+8];
    const ux=bx-ax,uy=by-ay,uz=bz-az,vx=cx-ax,vy=cy-ay,vz=cz-az;let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const l=Math.hypot(nx,ny,nz)||1;if(Math.abs(l-1)>=1e-12){nx/=l;ny/=l;nz/=l;}
    const k=g.n;g.v(ax,ay,az,nx,ny,nz,ax/scale,(ay+az)/scale,col,255);g.v(bx,by,bz,nx,ny,nz,bx/scale,(by+bz)/scale,col,255);g.v(cx,cy,cz,nx,ny,nz,cx/scale,(cy+cz)/scale,col,255);g.tri(k,k+1,k+2);
  }
}
function axisFrustum(g,a,b,r0,r1,col,caps=true,inward=false,segments=32){
  const f=C.frameAxis(C.sub(b,a)),l=C.len(C.sub(b,a)),N=segments;
  const p=(o,r,t)=>C.add(o,C.add(C.mul(f.v,Math.cos(t)*r),C.mul(f.w,Math.sin(t)*r)));
  for(let i=0;i<N;i++){const t=i/N*Math.PI*2,t2=(i+1)/N*Math.PI*2,ps=[p(a,r0,t),p(a,r0,t2),p(b,r1,t2),p(b,r1,t)],n=C.norm(C.add(C.add(C.mul(f.v,Math.cos((t+t2)/2)),C.mul(f.w,Math.sin((t+t2)/2))),C.mul(f.u,(r0-r1)/l)));quad(g,inward?[ps[3],ps[2],ps[1],ps[0]]:ps,inward?C.mul(n,-1):n,[[i/N*4,0],[(i+1)/N*4,0],[(i+1)/N*4,l/64],[i/N*4,l/64]],col,255);
    if(caps)for(const [o,r,sg] of [[a,r0,-1],[b,r1,1]]){g.room(3);const k=g.n,ps2=sg<0?[o,p(o,r,t2),p(o,r,t)]:[o,p(o,r,t),p(o,r,t2)];for(const q of ps2)g.v(...q,...C.mul(f.u,sg),.5,.5,col,255);g.tri(k,k+1,k+2);}
  }
}
const CANOPY_GLASS=[46,62,74],ASTRO_DOME=[120,150,196];
function v3MeshParts(ship,opt){
  C.syncCompartments(ship);
  const out={struct:new Geo(2048),plate:new Geo(1024),gen:new Geo(4096),shield:new Geo(2048),hyper:new Geo(2048),interior:new Geo(2048),engine:new Geo(2048),plant:new Geo(2048),nozzle:new Geo(512),hangar:new Geo(2048)},glow=[];
  const ranges={};
  for(const p of [...ship.parts,...C.enginePaths(ship),...C.weaponCapacitors(ship),...C.missileCells(ship),...C.commandCompartments(ship)]){
    const before=geoMarks(out);meshOnePart(out,p,ship,opt,glow);markRanges(ranges,p.id,before,out);
  }
  if(opt.habitation&&ship.autoHabitation!==false){const h=C.habitationSpace(ship),d=h.cell.map(v=>v*.2);for(const p of h.points)boxSolid(out.interior,C.sub(p,d),C.add(p,d),[104,159,124],24);
    // Weapon conduits as tubes as thick as their cross-section: orange from the power
    // cell or reactor to each mount, yellow for the charging lines from the reactors to the cells.
    // Each run follows its route through the ship (a polyline on the free-volume grid).
    const fd=C.feedConduits(ship),tube=(k,col)=>{const P=k.path||[k.a,k.b],r=Math.max(.15,Math.sqrt(k.area/Math.PI));for(let i=1;i<P.length;i++)if(C.len(C.sub(P[i],P[i-1]))>=.5)axisFrustum(out.interior,P[i-1],P[i],r,r,col,true,false,10);};
    for(const w of fd.rows)for(const k of w.links)tube(k,[222,154,64]);for(const k of fd.charge)tube(k,[236,212,96]);}
  return {g:out,glow,ranges};
}
// One part into the group meshes (shared by the full build and the live preview).
function meshOnePart(out,p,ship,opt,glow){
    const k=p.k,d=C.PARTS[k],color=opt.info?.[p.id]?.overlap?[240,91,85]:(opt.coded?d.col:PAINT);
    if(k==='struct'&&(p.form==='reference'&&C.REFERENCE_ASSETS[p.skinAsset]||(p.form==='ellipsoid'&&ship.hullSkin?.enabled)))return;
    if(k==='sensor'&&p.skinAsset)return;
    if(k==='struct'&&p.plate){triangleMesh(out.plate,C.structTriangles(p),opt.coded?PLATE_CODED:p.paint?hex(p.paint):ship.paint==='dark'?PLATE_DARK:ship.paint==='cis'?PLATE_CIS:PLATE_PAINT,64);if(p.bands)structureBands(p,out.plate);if(p.stripes&&p.form==='shell')shellStripes(p,out.plate);return;}
    if(k==='struct'){triangleMesh(out.struct,C.structTriangles(p),p.paint?hex(p.paint):ship.paint==='dark'?STRUCT_DARK:ship.paint==='cis'?STRUCT_CIS:STRUCT_PAINT);if(p.bands)structureBands(p,out.struct);if(p.stripes&&p.form==='shell')shellStripes(p,out.struct);if(p.arcBands&&!ship.solidCuts?.some(c=>ship.hull.assembly||c.structures))arcPaintBands(p,out.struct);return;}
    if(p._packing){triangleMesh(out.interior,p._packing.tris,color,36);return;}
    if(p._clip&&k!=='hangar'){triangleMesh(out.interior,p._clip.tris,color,36);return;}
    if(p.boxSize){const f=p.boxFrame;box(out.interior,[...f.fw,...f.up,...f.rt],p.c,0,0,0,...p.boxSize,color);return;}
    if(k==='machinery'){const target=ship.parts.find(e=>e.id===p.nozzle)?.skinAsset?out.plant:out.engine;for(const s of p.segments||[p.seg])axisFrustum(target,s.a,s.b,s.r0,s.r1,color,false);const s=p.segments?.at(-1)||p.seg;for(let i=0;i<5;i++){const t=(i+.6)/5,at=C.add(s.a,C.mul(s.u,s.l*t));axisFrustum(target,C.sub(at,C.mul(s.u,Math.min(1.2,s.r1*.3))),C.add(at,C.mul(s.u,Math.min(1.2,s.r1*.3))),s.r1*1.06,s.r1*1.06,[120,132,142],false);}return;}
    if(k==='sensor'){sensorShell(out.struct,p,color);return;}
    // v21 A cockpit shows as tinted canopy glass where it stands out of the hull; an astromech as its dome.
    if(k==='cockpit'){sphere(C.isInternal(p)?out.interior:out.struct,p.c,p.d/2,opt.coded?color:CANOPY_GLASS,10,4);return;}
    if(k==='astromech'){const r=p.d/2,u=C.norm(p.dir||[0,1,0]),h=p.d*1.05,base=C.sub(p.c,C.mul(u,h/2)),top=C.add(p.c,C.mul(u,h*.18));axisFrustum(C.isInternal(p)?out.interior:out.struct,base,top,r*.82,r*.82,opt.coded?color:[188,196,204],false);if(!C.isInternal(p))sphere(out.struct,top,r*.8,opt.coded?color:ASTRO_DOME,8,3);return;}
    if(d.shape==='sphere'){sphere(C.isInternal(p)?out.interior:k==='gen'?out.gen:out.shield,p.c,p.d/2,color,8,3);return;}
    if(d.shape==='cube'){if(p.room){roomMesh(ship,p,k==='hangar'&&ship.hatches.some(h=>h.bay===p.id)?out.hangar:out.interior,color);}else{const r=p.d/2;boxSolid(k==='hangar'&&ship.hatches.some(h=>h.bay===p.id)?out.hangar:out.interior,C.sub(p.c,[r,r,r]),C.add(p.c,[r,r,r]),color,32);}return;}
    const m=C.partDims(p),u=C.norm(p.dir||(k==='engine'?[-1,0,0]:[1,0,0])),a=C.sub(p.c,C.mul(u,m.l/2)),b=C.add(p.c,C.mul(u,m.l/2));
    if(k==='engine'){engineBell(out,p,a,b,u,color,glow,ship);return;}
    axisFrustum(C.isInternal(p)?out.interior:out.hyper,a,b,m.rad,m.rad,color,true);

}
// Index ranges per part let the editor hide a part while it previews an edit.
function geoMarks(out){const m={};for(const k in out)m[k]=out[k].ni;return m;}
function markRanges(ranges,id,before,out){for(const k in out){const n=out[k].ni-(before[k]||0);if(n>0)(ranges[id]||(ranges[id]=[])).push([k,before[k]||0,n]);}}

function meshHull(ship){
  if(ship.hullSkin?.enabled||ship.hull.assembly)return new Geo(16);
  if(!ship.solidCuts?.length&&!ship.trenches?.some(t=>t.mode==='split')&&!ship.hull.stations?.length&&!ship.hatches.some(h=>h.portal)&&ship.hull.sec!=='warship')return v3MeshHull(ship);
  const T=C.hullGeo(ship).tris,g=new Geo(T.length/3+100),openings=ship.hatches.map(h=>C.openingBounds(ship,h)).filter(Boolean),paint=ship.paint==='dark'?[103,116,129]:ship.paint==='cis'?HULL_CIS:[189,193,192];
  for(let i=0;i<T.length;i+=9){const tri=T.subarray(i,i+9),p=[(T[i]+T[i+3]+T[i+6])/3,(T[i+1]+T[i+4]+T[i+7])/3,(T[i+2]+T[i+5]+T[i+8])/3],n=C.norm(C.cross(C.sub(Array.from(tri.slice(3,6)),Array.from(tri.slice(0,3))),C.sub(Array.from(tri.slice(6)),Array.from(tri.slice(0,3)))));
    let color=paint;
    if(openings.some(b=>p.every((v,a)=>v>=b[a]-.1&&v<=b[a+3]+.1)&&[0,1,2].some(a=>[b[a],b[a+3]].some(v=>Math.abs(T[i+a]-v)<.1&&Math.abs(T[i+3+a]-v)<.1&&Math.abs(T[i+6+a]-v)<.1))))color=[48,60,67];
    hullTriangleMesh(g,tri,color,42);
    // v19 painted bands across the hull's upper surface (the Invisible Hand's yellow bow stripes).
    if(ship.hullBands?.length&&n[1]>.35&&color===paint){const triangle=[Array.from(tri.slice(0,3)),Array.from(tri.slice(3,6)),Array.from(tri.slice(6,9))];for(const [x0,x1,col] of ship.hullBands){const out=[];C.triangulateFan(C.clipOpening(triangle,[ship.hull.L*x0,-10000,-10000,ship.hull.L*x1,10000,10000]).map(q=>C.add(q,C.mul(n,.16))),out);if(out.length)triangleMesh(g,out,col?hex(col):BAND_PAINT,42);}}
    if(ship.paint==='republic'&&n[1]>.5&&color===paint){
      const triangle=[Array.from(tri.slice(0,3)),Array.from(tri.slice(3,6)),Array.from(tri.slice(6,9))],h=ship.hull,start=h.L*.520,end=h.L*.996,w0=h.W*.084,w1=h.W*.014;
      const bands=[[start,-10000,-w0,end,10000,w0,w0,w1]];
      for(const sign of [-1,1])for(const t of [.222,.241,.260])bands.push([h.L*t,-10000,sign<0?-h.W*.52:h.W*.33,h.L*(t+.010),10000,sign<0?-h.W*.33:h.W*.52]);
      for(const b of bands){const red=[];C.triangulateFan(C.clipOpening(triangle,b).map(q=>C.add(q,C.mul(n,.16))),red);triangleMesh(g,red,[132,48,56],42);}
    }
  }
  if(!ship.solidCuts?.length)plateDetail(ship,g);return g;
}
function roomMesh(ship,p,g,col){
  let T=p._clip?.tris||C.structTriangles(C.roomShape(p));for(const h of ship.hatches.filter(h=>h.bay===p.id)){const b=C.openingBounds(ship,h);if(b)T=C.subtractBoxMesh(T,b);}
  triangleMesh(g,T,col,36);
  // Interior surfaces remain visible through a mouth, with a deck beneath the opening.
  const rev=Float32Array.from(T);for(let i=0;i<rev.length;i+=9)for(let j=0;j<3;j++){const a=rev[i+3+j];rev[i+3+j]=rev[i+6+j];rev[i+6+j]=a;}triangleMesh(g,rev,col.map(v=>Math.round(v*.52)),36);
}
function meshParts(ship,opt){
  const result=v3MeshParts(ship,opt);Object.assign(result.g,meshReferenceParts(ship,result.ranges));const g=result.g.struct,detail=ship.detail??1;
  if(detail){
    // Deck edging and repeating stiffeners make scale legible; the editor controls their pitch.
    for(const p of ship.parts.filter(p=>p.k==='struct')){const before=g.ni;try{structDetailFor(p);}finally{const n=g.ni-before;if(n>0)(result.ranges[p.id]||(result.ranges[p.id]=[])).push(['struct',before,n]);}}
    function structDetailFor(p){
      if(ship.solidCuts?.some(c=>ship.hull.assembly||c.structures))return;
      if(p.form==='reference'||p.plate)return;
      if(p.form==='ellipsoid'){if(!ship.hullSkin?.enabled)bulbDetail(p,g);return;}
      if(p.form==='dome'||p.form==='cylinder'||p.form==='cone')return;
      structuralDetail(p,g,Math.max(1,ship.hull.L/3200));const T=C.structTriangles(p),col=p.paint?hex(p.paint):ship.paint==='dark'?[92,103,114]:ship.paint==='cis'?DETAIL_CIS:[156,163,166];
      if(p.ribSpacing){const spacing=Math.max(5,p.ribSpacing),[l,w,h]=p.s;
        for(let x=-l/2+spacing;x<l/2-spacing;x+=spacing)for(const sg of [-1,1]){
          const local=[x,-h*.1,sg*w*.5],c=C.worldStruct(p,local);if(p.form==='box'){const f=C.structFrame(p);box(g,[...f.fw,...f.up,...f.rt],c,0,0,0,1.3,h*.64,1.6,col);}
        }
      }
      // Slim rim seated on the upper contour. Each segment follows the actual chamfered/sloped wall.
      if(!['loft','roundloft','arc','outline','shell'].includes(p.form)&&p.s[2]>8&&p.s[0]>30){const pts=[];for(let i=0;i<T.length;i+=3){const q=Array.from(T.slice(i,i+3));if(C.localStruct(p,q)[1]>p.s[2]/2-.1&&!pts.some(a=>C.len(C.sub(a,q))<.1))pts.push(q);}if(pts.length>3){const hull=convexRim(pts.map(q=>C.localStruct(p,q))).map(q=>C.worldStruct(p,q));pts.length=0;pts.push(...hull);const center=pts.reduce((a,b)=>C.add(a,C.mul(b,1/pts.length)),[0,0,0]);pts.sort((a,b)=>Math.atan2(C.localStruct(p,a)[2],C.localStruct(p,a)[0])-Math.atan2(C.localStruct(p,b)[2],C.localStruct(p,b)[0]));for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];if(C.len(C.sub(a,b))>5)axisFrustum(g,C.add(a,C.mul(C.structFrame(p).up,.25)),C.add(b,C.mul(C.structFrame(p).up,.25)),.55,.55,[110,118,124],false);}}
      }
    }
    // Service equipment and transverse frames recessed inside the side trench.
    for(const tr of (ship.hullSkin?.enabled||ship.solidCuts?.length?[]:ship.trenches||[]))for(let t=tr.from+.012;t<tr.to-.012;t+=.019/detail){const x=t*ship.hull.L,s=C.sectionBase(ship.hull,x),depth=Math.min(s.hw*.8,tr.depth*(tr.taper?s.pw:1));const y=s.ybot+s.h*tr.level;
      for(const sign of tr.side==='both'?[-1,1]:[tr.side==='port'?-1:1]){const wall=C.originalSurface(ship,x,2,y,sign);if(wall==null)continue;const z=wall+sign*1.8;if(ship.hatches.some(h=>{const b=C.openingBounds(ship,h);return b&&x>b[0]-8&&x<b[3]+8&&y>b[1]-tr.height/2&&y<b[4]+tr.height/2&&z>b[2]-8&&z<b[5]+8;}))continue;boxSolid(g,[x-1.4,y-tr.height*.34,z-1],[x+1.4,y+tr.height*.34,z+1],[92,107,114],20);const seed=Math.sin(x*.13)*.5+.5;boxSolid(g,[x+2,y-tr.height*.26,z-2],[x+5+seed*6,y+tr.height*.14,z+2],[130,137,139],20);}
    }
  }
  return result;
}
function meshSlidingHatchPanel(ship,h,panel,open=0){
  const g=new Geo(panel.tris.length/3+100),T=panel.tris,offset=[0,0,0],edges=new Map(),face=ship.paint==='republic'&&h.face==='top'?[132,48,56]:ship.paint==='dark'?[103,116,129]:ship.paint==='cis'?PANEL_CIS:[174,180,184];offset[panel.axis]=panel.side*panel.travel*C.clamp(open,0,1);
  const point=(i,lift)=>[T[i],T[i+1],T[i+2]].map((v,k)=>v+offset[k]+h.n[k]*lift),key=p=>p.map(v=>Math.round(v*1000)).join(',');
  for(let i=0;i<T.length;i+=9){const q=[0,3,6].map(j=>point(i+j,.18)),back=[0,6,3].map(j=>point(i+j,-.8));triangleMesh(g,q.flat(),face,42);triangleMesh(g,back.flat(),[93,105,113],42);
    for(let j=0;j<3;j++){const a=q[j],b=q[(j+1)%3],ak=key(a),bk=key(b),edge=ak<bk?ak+'|'+bk:bk+'|'+ak,old=edges.get(edge);if(old)old.count++;else edges.set(edge,{a,b,count:1});}
  }
  // The exposed panel edges retain thickness as the two halves slide apart.
  for(const edge of edges.values())if(edge.count===1){const a=edge.a,b=edge.b,down=C.mul(h.n,-.98),ab=C.add(a,down),bb=C.add(b,down),n=C.norm(C.cross(C.sub(b,a),down));quad(g,[a,b,bb,ab],n,UV_WHITE,[105,117,123],255);axisFrustum(g,a,b,.18,.18,[89,98,104],false);}
  return g;
}
function appendGeo(target,g){target.room(g.n,g.ni);const base=target.n;for(let i=0;i<g.n;i++)target.v(...g.pos.subarray(i*3,i*3+3),...Array.from(g.nor.subarray(i*3,i*3+3),v=>v/127),g.uv[i*2],g.uv[i*2+1],Array.from(g.col.subarray(i*4,i*4+3)),g.col[i*4+3]);for(let i=0;i<g.ni;i+=3)target.tri(base+g.idx[i],base+g.idx[i+1],base+g.idx[i+2]);}
function meshHatches(ship){
  const out=v3MeshHatches({...ship,hatches:ship.hatches.filter(h=>!h.portal&&!h.skinAsset)});
  for(const h of ship.hatches.filter(h=>h.portal&&!h.skinAsset)){
    const b=C.openingBounds(ship,h);if(!b)continue;
    const {axis,longAxis:l,widthAxis:u}=C.hatchAxes(h),step=Math.max(1,Math.ceil((b[l+3]-b[l])/16)),g=out.open,open=h.open??1;
    const sample=(x,v)=>C.openingSurfacePoint(ship,h,x,v),edges=[b[u],b[u+3]],col=ship.paint==='republic'?[138,47,54]:[173,178,179];
    for(let i=0;i<step;i++){
      const x0=C.lerp(b[l],b[l+3],i/step),x1=C.lerp(b[l],b[l+3],(i+1)/step);
      for(let side=0;side<2;side++){
        const mid=(b[u]+b[u+3])/2,sg=side?1:-1,e0=mid+sg*C.openingHalf(b,x0,u),e1=mid+sg*C.openingHalf(b,x1,u),rim=sg*2;
        const ps=[sample(x0,e0+rim),sample(x1,e1+rim),sample(x1,e1),sample(x0,e0)];if(ps.every(Boolean))quad(g,ps,h.n,UV_WHITE,col,255);

      }
      // Landing deck centerline and bay-side guidance lamps, located down inside the mouth.
      if(axis===1&&h.n[1]>0){const zmid=(b[2]+b[5])/2,y=b[1]+.5;boxSolid(g,[x0,y,zmid-.4],[x1-2,y+.18,zmid+.4],[218,183,94],8);for(const z of [zmid-C.openingHalf(b,x0)+2,zmid+C.openingHalf(b,x0)-2])boxSolid(g,[x0+2,y,z-.4],[x0+3,y+.7,z+.4],[140,206,214],2);}
    }
    if(h.k==='ray'&&open>0&&(!h._doorDetached||h._rayOnly))meshRayField(out.ray,ship,h,b,open);
    if(C.isSlidingHatch(ship,h)&&!h._doorDetached)for(const panel of C.slidingHatchPanels(ship,h))appendGeo(out.open,meshSlidingHatchPanel(ship,h,panel,open));
  }
  return out;
}
// Ray shield over an open mouth, drawn by FS_RAY. The field (vertex alpha 255)
// carries uv.x = 0 on its boundary rising to 1 one rim width inside, so the
// shader can light the emitter edge; the halo (vertex alpha 0) is a strip on the
// plating around the mouth with uv.x = 0 at the edge and 1 at its outer border.
const RAY_FIELD_COL=[150,205,255],RAY_HALO_COL=[110,180,255];
function meshRayField(g,ship,h,b,open){
  const {longAxis:l,widthAxis:u}=C.hatchAxes(h),x0=b[l],x1=b[l+3],len=x1-x0;if(!(len>0))return;
  const mid=(b[u]+b[u+3])/2,slide=C.slidingHatchSpec(ship,h),full=x=>C.openingHalf(b,x,u),half=x=>slide?Math.min(full(x),slide.travel*open):full(x)*open;
  const R=C.clamp(Math.min(len,2*Math.max(full(x0),full(x1)))*.1,2.5,12),r=Math.min(R,len/2),sample=(x,v)=>C.openingSurfacePoint(ship,h,x,v),inset=h._rayInset||0;
  const xs=[x0,x0+r],inner=len-2*r,n=Math.ceil(inner/16);for(let i=1;i<n;i++)xs.push(x0+r+inner*i/n);if(inner>1e-6)xs.push(x1-r);xs.push(x1);
  const put=(ps,ts,col,a)=>{if(ps.every(Boolean))quad(g,ps,h.n,ts.map(t=>[C.clamp(t,0,1),0]),col,a);};
  // Field: four columns across (edge, one rim width in, mirrored) at every station.
  const rows=xs.map(x=>{const hw=half(x),rr=Math.min(R,hw),dx=Math.min(x-x0,x1-x),vs=[-hw,-hw+rr,hw-rr,hw],dv=[0,rr,rr,0];return vs.map((v,j)=>{const p=sample(x,mid+v);return {p:p&&inset?C.sub(p,C.mul(h.n,inset)):p,t:Math.min(dx,dv[j])/R};});});
  for(let i=0;i+1<rows.length;i++)for(let j=0;j<3;j++){const q=[rows[i][j],rows[i+1][j],rows[i+1][j+1],rows[i][j+1]];put(q.map(o=>o.p),q.map(o=>o.t),RAY_FIELD_COL,255);}
  // Halo on the plating along both sides, across both ends and round the corners.
  // A strip that would bridge a step in the plating is left out.
  const W=C.clamp(R*1.6,4,20),rim=(x,v)=>C.openingRimPoint(ship,h,x,v),axis=C.hatchAxes(h).axis;
  const halo=(ps,ts)=>{if(!ps.every(Boolean))return;const lo=Math.min(...ps.map(p=>p[axis])),hi=Math.max(...ps.map(p=>p[axis]));if(hi-lo<=W*.9)quad(g,ps,h.n,ts.map(t=>[t,0]),RAY_HALO_COL,0);};
  for(const s of [-1,1]){
    for(let i=0;i+1<xs.length;i++){const xa=xs[i],xb=xs[i+1],ea=mid+s*full(xa),eb=mid+s*full(xb);halo([rim(xa,ea),rim(xb,eb),rim(xb,eb+s*W),rim(xa,ea+s*W)],[0,0,1,1]);}
    const x=s<0?x0:x1,hw=full(x),m=Math.max(1,Math.ceil(2*hw/16));
    for(let j=0;j<m;j++){const va=mid-hw+2*hw*j/m,vb=mid-hw+2*hw*(j+1)/m;halo([rim(x,va),rim(x,vb),rim(x+s*W,vb),rim(x+s*W,va)],[0,0,1,1]);}
    for(const c of [-1,1]){const e=mid+c*hw;halo([rim(x,e),rim(x+s*W,e),rim(x+s*W,e+c*W),rim(x,e+c*W)],[0,1,1,1]);}
  }
}

function convexRim(points){const a=points.slice().sort((p,q)=>p[0]-q[0]||p[2]-q[2]),cross=(o,a,b)=>(a[0]-o[0])*(b[2]-o[2])-(a[2]-o[2])*(b[0]-o[0]),lo=[],hi=[];for(const p of a){while(lo.length>1&&cross(lo.at(-2),lo.at(-1),p)<=.001)lo.pop();lo.push(p);}for(const p of a.slice().reverse()){while(hi.length>1&&cross(hi.at(-2),hi.at(-1),p)<=.001)hi.pop();hi.push(p);}return lo.slice(0,-1).concat(hi.slice(0,-1));}

function engineBell(out,p,a,b,u,color,glow,ship){
 const r=p.d/2,on=C.engineVented(ship,p)&&!!C.reactorFor(ship,p),f=C.frameAxis(u),throat=C.clamp(p.throatRatio??.34,.18,.8),tip=C.add(a,C.mul(u,C.len(C.sub(b,a))*.16));
 if(!p.skinAsset){
 axisFrustum(out.engine,a,b,r*.6,r,color,false);
 // The inside of the bell must face inward; reversing the axis alone is insufficient.
 axisFrustum(out.engine,b,tip,r*.94,r*throat,[53,67,76],false,true);
 // (v21 ribs and collar scale down with a small engine, so they do not stand out of a craft's hull)
 for(let i=0;i<20;i++){const angle=i/20*Math.PI*2,radial=C.add(C.mul(f.v,Math.cos(angle)),C.mul(f.w,Math.sin(angle)));axisFrustum(out.engine,C.add(a,C.mul(radial,r*.62)),C.add(b,C.mul(radial,r*1.015)),Math.min(Math.max(.25,r*.016),r*.05),Math.min(Math.max(.25,r*.018),r*.05),[105,117,125],false);}
 axisFrustum(out.engine,C.sub(b,C.mul(u,Math.min(.6,r*.15))),C.add(b,C.mul(u,Math.min(.6,r*.15))),r*1.02,r*1.02,[170,180,184],false);
 }
 const g=on?out.nozzle:out.engine,N=32;g.room(N+2,N*3);const base=g.n;g.v(...tip,...u,.5,.5,on?WHITE:[33,42,47],255);
 for(let i=0;i<=N;i++){const t=i/N*Math.PI*2,q=C.add(tip,C.add(C.mul(f.v,Math.cos(t)*r*throat),C.mul(f.w,Math.sin(t)*r*throat)));g.v(...q,...u,.5+.5*Math.cos(t),.5+.5*Math.sin(t),on?WHITE:[33,42,47],255);}for(let i=0;i<N;i++)g.tri(base,base+i+1,base+i+2);
 if(on)glow.push(...C.add(b,C.mul(u,r*(p.skinAsset?.5:.12))),r*.8);
}
// Large staggered armor plates; only thin joints are dark, never rows of windows.
function plateDetail(ship,g){
 const detail=ship.detail??1;if(!detail)return;
 const h=ship.hull,ds=Math.max(1,h.L/3200),R=rng(7103),mouths=ship.hatches.map(a=>C.openingBounds(ship,a)).filter(Boolean);
 for(const sign of [1,-1]){let x=Math.max(4,(h.start||0)*h.L+1);
 while(x<h.L-8){const l=(38+R()*67)*ds,x1=Math.min(h.L-5,x+l),hw=Math.min(C.sectionBase(h,x).hw,C.sectionBase(h,x1).hw)-2;
  for(let z=-hw;z<hw-5;){const w=(18+R()*44)*ds,z1=Math.min(hw,z+w),val=Math.round(188+R()*9);const point=(xx,zz)=>{const y=C.originalSurface(ship,xx,1,zz,sign);return y==null?null:[xx,y+sign*.22,zz];};
   const ps=[[x,z],[x1,z],[x1,z1],[x,z1]].map(([xx,zz])=>point(xx,zz));
   const opening=mouths.some(b=>x1>b[0]&&x<b[3]&&z1>b[2]-2&&z<b[5]+2&&sign*(b[1]+b[4]-h.H)>0);
   const red=ship.paint==='republic'&&((x>h.L*.52&&Math.abs((z+z1)/2)<C.sectionBase(h,x).hw*.28)||(x<h.L*.29&&x1>h.L*.22));
   if(ps.every(Boolean)&&!opening&&!red){const n=C.norm(C.cross(C.sub(ps[3],ps[0]),C.sub(ps[1],ps[0]))),order=sign>0?[0,3,2,1]:[0,1,2,3];quad(g,order.map(i=>ps[i]),C.mul(n,sign),[[0,0],[0,1],[1,1],[1,0]],[val,val+3,val+4],255);
    // Narrow, non-repeating joints rather than isolated checkerboard squares.
    for(const edge of [[ps[0],ps[1]],[ps[1],ps[2]]]){const [a,b]=edge,v=C.norm(C.cross(C.sub(b,a),n)),q=[a,b,C.add(b,C.mul(v,.38)),C.add(a,C.mul(v,.38))].map(p=>C.add(p,[0,sign*.06,0]));quad(g,sign>0?q:q.reverse(),C.mul(n,sign),UV_WHITE,[143,152,158],255);}
   }
   z=z1;
  }x=x1;
 }}
}
function structuralDetail(p,g,ds=1){
 if(p.skin==='plain'||p.s[2]<10||p.s[0]<30)return;
 const T=C.structTriangles(p),service=p.skin==='service';
 // Mechanical bays on the walls are actual shallow geometry, with no glass or emission.
 for(let i=0;i<T.length;i+=9){const a=Array.from(T.slice(i,i+3)),b=Array.from(T.slice(i+3,i+6)),c=Array.from(T.slice(i+6,i+9)),n=C.norm(C.cross(C.sub(b,a),C.sub(c,a)));
  if(Math.abs(n[1])>.6)continue;
  const fw=C.norm(C.cross([0,1,0],n)),up=C.norm(C.cross(n,fw)),M=[...fw,...n,...up],q=[a,b,c].map(v=>[C.dot(v,fw),C.dot(v,up)]),step=(service?12:34)*ds;
  const minX=Math.min(...q.map(v=>v[0])),maxX=Math.max(...q.map(v=>v[0])),minY=Math.min(...q.map(v=>v[1])),maxY=Math.max(...q.map(v=>v[1]));
  const inside=(x,y)=>{const cross=(a,b)=>(b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]),v=[cross(q[0],q[1]),cross(q[1],q[2]),cross(q[2],q[0])];return v.every(v=>v>=.5)||v.every(v=>v<=-.5);};
  for(let y=Math.ceil(minY/(23*ds))*(23*ds)+7;y<maxY-2;y+=23*ds)for(let x=Math.ceil(minX/step)*step+3;x<maxX-2;x+=step){const seed=(Math.sin(x*17.1+y*12.7)+1)/2,w=step*(.4+seed*.32),ht=(service?12+seed*10:5+seed*3)*ds;if(![[x-w/2,y-ht/2],[x+w/2,y-ht/2],[x+w/2,y+ht/2],[x-w/2,y+ht/2]].every(([x,y])=>inside(x,y)))continue;
   const o=C.add(C.add(C.mul(fw,x),C.mul(up,y)),C.mul(n,C.dot(a,n)+.12));
   if(service){box(g,M,o,0,.28,0,w,.55,ht,[155,166,172]);box(g,M,o,w*.12,.9,ht*.1,w*.54,1.3,ht*.58,[184,192,197]);if(seed>.35){for(const xx of [-w*.31,-w*.20]){const start=C.add(o,C.add(C.mul(fw,xx),C.mul(up,-ht*.4))),end=C.add(start,C.mul(up,ht*.8));axisFrustum(g,C.add(start,C.mul(n,1)),C.add(end,C.mul(n,1)),.43,.43,[111,127,137],false,false,8);}}}
   else if(seed>.45)box(g,M,o,0,.28,0,w,.55,ht,[192,199,202]);
  }
 }
 // A few large flush roof panels follow the actual tilted deck.
 const [L,W,H]=p.s,R=rng(Math.round(L*W));for(let x=-L*.4;x<L*.4;x+=(33+R()*45)*ds)for(const z of [-W*.22,0,W*.22]){const l=17+R()*23,w=Math.min(W*.14,12+R()*21),points=[[-l/2,-w/2],[l/2,-w/2],[l/2,w/2],[-l/2,w/2]].map(([dx,dz])=>{const hit=C.rayPart(C.worldStruct(p,[x+dx,H,z+dz]),C.mul(C.structFrame(p).up,-1),p);return hit?C.add(hit.p,C.mul(C.structFrame(p).up,.23)):null;});if(points.some(q=>!q))continue;const n=C.norm(C.cross(C.sub(points[3],points[0]),C.sub(points[1],points[0])));quad(g,[points[0],points[3],points[2],points[1]],n,[[0,0],[0,1],[1,1],[1,0]],[200,205,208],255);}
}
function bulbDetail(p,g){
 if(p.skin==='plain')return;const point=(a,b,e=.25)=>C.worldStruct(p,[(p.s[0]/2+e)*Math.sin(a)*Math.cos(b),(p.s[2]/2+e)*Math.cos(a),(p.s[1]/2+e)*Math.sin(a)*Math.sin(b)]);
 for(let row=1;row<12;row++)for(let col=0;col<32;col++){const a=row/12*Math.PI,b=col/32*Math.PI*2,a1=a+.005,b1=(col+1)/32*Math.PI*2,ps=[point(a,b),point(a1,b),point(a1,b1),point(a,b1)],n=C.norm(C.sub(ps[0],p.c));quad(g,[ps[3],ps[2],ps[1],ps[0]],n,UV_WHITE,[157,168,174],255);}
 for(let col=0;col<16;col++)for(let row=0;row<24;row++){const a=row/24*Math.PI,a1=(row+1)/24*Math.PI,b=col/16*Math.PI*2,ps=[point(a,b),point(a1,b),point(a1,b+.006),point(a,b+.006)],n=C.norm(C.sub(ps[0],p.c));quad(g,[ps[3],ps[2],ps[1],ps[0]],n,UV_WHITE,[157,168,174],255);}
}

function sensorShell(g,p,color){
 const phi=(1+Math.sqrt(5))/2,v=[[-1,phi,0],[1,phi,0],[-1,-phi,0],[1,-phi,0],[0,-1,phi],[0,1,phi],[0,-1,-phi],[0,1,-phi],[phi,0,-1],[phi,0,1],[-phi,0,-1],[-phi,0,1]].map(C.norm);
 const faces=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
 const draw=(a,b,c,depth)=>{if(depth){const ab=C.norm(C.add(a,b)),bc=C.norm(C.add(b,c)),ca=C.norm(C.add(c,a));draw(a,ab,ca,depth-1);draw(ab,b,bc,depth-1);draw(ca,bc,c,depth-1);draw(ab,bc,ca,depth-1);return;}const center=C.mul(C.add(C.add(a,b),c),1/3),f=.96,T=[a,b,c].flatMap(q=>C.add(p.c,C.mul(C.add(center,C.mul(C.sub(q,center),f)),p.d/2)));triangleMesh(g,T,color.map(x=>Math.round(x*(.92+Math.abs(center[1])*.07))),30);};
 for(const f of faces)draw(...f.map(i=>v[i]),2);
}

function structureBands(p,g){const T=C.structTriangles(p);for(let i=0;i<T.length;i+=9){const world=[Array.from(T.slice(i,i+3)),Array.from(T.slice(i+3,i+6)),Array.from(T.slice(i+6,i+9))],poly=world.map(q=>C.localStruct(p,q)),n=C.norm(C.cross(C.sub(world[1],world[0]),C.sub(world[2],world[0])));for(const [a,b] of p.bands){const q=C.clipPoly(C.clipPoly(poly,0,(a-.5)*p.s[0],true),0,(b-.5)*p.s[0],false).map(v=>C.add(C.worldStruct(p,v),C.mul(n,.3))),out=[];C.triangulateFan(q,out);triangleMesh(g,out,bandColor(p),42);}}}

// Paint stripes running a curved shell plate's length, just proud of its outer face.
function shellStripes(p,g){
 const rows=C.structRows(p),n=Math.max(8,Math.min(48,rows.length*6)),T=[];
 for(const [a,b] of p.stripes)for(let i=0;i<n;i++)for(let j=0;j<3;j++){
  const u0=i/n,u1=(i+1)/n,v0=a+(b-a)*j/3,v1=a+(b-a)*(j+1)/3,q=[[u0,v0],[u0,v1],[u1,v1],[u1,v0]].map(([u,v])=>C.shellPoint(p,u,v,.3)),up=C.sub(C.shellPoint(p,(u0+u1)/2,(v0+v1)/2,1.3),C.shellPoint(p,(u0+u1)/2,(v0+v1)/2,.3));
  for(const [x,y,z] of [[q[0],q[1],q[2]],[q[0],q[2],q[3]]]){const nn=C.cross(C.sub(y,x),C.sub(z,x));if(C.dot(nn,up)>=0)T.push(...x,...y,...z);else T.push(...x,...z,...y);}
 }
 triangleMesh(g,Float32Array.from(T),bandColor(p),42);
}
function arcPaintBands(p,g){
 const {start,sweep}=C.arcParameters(p),N=Math.ceil(sweep*22),paint={...p,s:[p.s[0]+.7,p.s[1]+.7,p.s[2]+.7]},T=[];
 for(const band of p.arcBands)for(let i=0;i<N;i++)for(let j=0;j<3;j++){
  const a=start+i/N*sweep,an=start+(i+1)/N*sweep,b=C.lerp(...band,j/3)*Math.PI*2,bn=C.lerp(...band,(j+1)/3)*Math.PI*2;
  const ps=[[a,b],[a,bn],[an,bn],[an,b]].map(([a,b])=>C.arcPoint(paint,a,b));C.triangulateFan(ps,T);
 }
 let tris=Float32Array.from(T);for(const m of p._apertures||[])tris=C.subtractBoxMesh(tris,m.b);
 triangleMesh(g,tris,bandColor(p),42);
}

// Indexed, textured modules from the two CC BY reference models.
// Reference meshes store half of the colour factor; the shader doubles it, so
// a model's tone correction may brighten as well as darken its texture.
const REF_ONE=[128,128,128];
function refTone(id,base=WHITE){const f=C.REFERENCE_TONE[id]||[1,1,1];return [0,1,2].map(i=>Math.max(0,Math.min(255,Math.round(base[i]/255*128*f[i]))));}
function appendReference(g,id,point,filter,color=WHITE,cuts=[]){
 const a=C.REFERENCE_ASSETS[id],d=C.decodeReference(id);if(!a||!d)return;color=refTone(id,color);
 const pos=new Float32Array(d.pos.length),nor=new Float32Array(d.pos.length),indices=[];
 for(let i=0;i<d.pos.length;i+=3)pos.set(point([d.pos[i],d.pos[i+1],d.pos[i+2]],a),i);
 for(let i=0;i<d.idx.length;i+=3){const ids=[d.idx[i],d.idx[i+1],d.idx[i+2]];
  if(filter&&!filter(ids.map(k=>[d.pos[k*3],d.pos[k*3+1],d.pos[k*3+2]]),a))continue;
  indices.push(...ids);const [A,B,D]=ids.map(k=>Array.from(pos.subarray(k*3,k*3+3))),n=C.cross(C.sub(B,A),C.sub(D,A));for(const k of ids)for(let j=0;j<3;j++)nor[k*3+j]+=n[j];
 }
 if(cuts.length){let d2={pos,uv:d.uv,idx:Uint32Array.from(indices)};for(const b of cuts)d2=C.clipReferenceBox(d2,b);indexedReference(g,d2,color);return;}
 g.room(a.n,indices.length);const base=g.n;
 for(let i=0;i<a.n;i++){const n=C.norm(Array.from(nor.subarray(i*3,i*3+3)));g.v(...pos.subarray(i*3,i*3+3),...n,d.uv[i*2],d.uv[i*2+1],color,255);}
 for(let i=0;i<indices.length;i+=3)g.tri(base+indices[i],base+indices[i+1],base+indices[i+2]);
}
function indexedReference(g,d,color=REF_ONE){
 const normal=new Float32Array(d.pos.length);for(let i=0;i<d.idx.length;i+=3){const ids=Array.from(d.idx.subarray(i,i+3)),[a,b,c]=ids.map(k=>Array.from(d.pos.subarray(k*3,k*3+3))),n=C.cross(C.sub(b,a),C.sub(c,a));for(const k of ids)for(let j=0;j<3;j++)normal[k*3+j]+=n[j];}
 g.room(d.pos.length/3,d.idx.length);const base=g.n;for(let i=0;i<d.pos.length/3;i++)g.v(...d.pos.subarray(i*3,i*3+3),...C.norm(Array.from(normal.subarray(i*3,i*3+3))),d.uv[i*2],d.uv[i*2+1],color,255);
 for(let i=0;i<d.idx.length;i+=3)g.tri(base+d.idx[i],base+d.idx[i+1],base+d.idx[i+2]);
}
function meshReferenceHull(ship){const g=new Geo(16),d=C.referenceHullGeometry(ship);if(d)indexedReference(g,d,refTone(ship.hullSkin?.asset||(ship.reference==='imperial'?'isd_hull':'ven_hull')));return g;}
function appendEngineSplit(outside,inside,ship,p){
 const entry=C.engineHullEntry(ship,p),a=C.REFERENCE_ASSETS[p.skinAsset],d=C.decodeReference(p.skinAsset);
 if(entry==null){appendReference(outside,p.skinAsset,(v,a)=>C.referenceEnginePoint(p,v,a));return;}
 const forward=C.mul(C.norm(p.dir||[-1,0,0]),-1),polys=[[],[]];
 for(let i=0;i<d.idx.length;i+=3){const poly=[];for(let j=0;j<3;j++){const k=d.idx[i+j],q=C.referenceEnginePoint(p,Array.from(d.pos.subarray(k*3,k*3+3)),a);poly.push([C.dot(C.sub(q,p.c),forward),...q,d.uv[k*2],d.uv[k*2+1]]);}
  for(let side=0;side<2;side++){const clipped=C.clipPoly(poly,0,entry,!!side);for(let j=1;j<clipped.length-1;j++)polys[side].push(clipped[0],clipped[j],clipped[j+1]);}
 }
 for(let side=0;side<2;side++){const verts=polys[side],data={pos:Float32Array.from(verts.flatMap(v=>v.slice(1,4))),uv:Float32Array.from(verts.flatMap(v=>v.slice(4))),idx:Uint32Array.from(verts.map((v,i)=>i))};indexedReference(side?inside:outside,data,refTone(p.skinAsset));}
}
function meshReferenceParts(ship,ranges,only){
 const refStruct=new Geo(16),refEngine=new Geo(16),refPlant=new Geo(16),out={refStruct,refEngine,refPlant};
 const one=(p,a)=>{
  if(p.k==='engine'){appendEngineSplit(refEngine,refPlant,ship,p);return;}
  if(p.k==='struct'&&ship.solidCuts?.some(c=>ship.hull.assembly||c.structures)){p._solidCutShip=ship;triangleMesh(refStruct,C.structTriangles(p),(p.paint?hex(p.paint):[205,211,216]).map(v=>Math.round(v/2)),40);return;}
  if(p.k==='struct'){appendReference(refStruct,p.skinAsset,v=>C.referencePartPoint(p,v),null,p.paint?hex(p.paint):WHITE,ship.hatches.filter(h=>h.portal&&!h.referenceMouth).map(h=>C.openingBounds(ship,h)).filter(Boolean));return;}
  const size=p.skinSize||a.size,scale=p.d/Math.max(...size),r=(p.yaw||0)*Math.PI/180;
  appendReference(refStruct,p.skinAsset,v=>{const x=v[0]*size[0]*scale,z=v[2]*size[2]*scale;return C.add(p.c,[x*Math.cos(r)-z*Math.sin(r),v[1]*size[1]*scale,x*Math.sin(r)+z*Math.cos(r)]);});
 };
 for(const p of only||ship.parts){const a=C.REFERENCE_ASSETS[p.skinAsset];if(!a)continue;const before=geoMarks(out);one(p,a);if(ranges)markRanges(ranges,p.id,before,out);}
 return {refStruct,refEngine,refPlant};
}
function meshReferenceFits(ship,ranges,only){
 const g=new Geo(16);for(const f of only||ship.fits){const d=C.FITS[f.k];if(!(d.asset||d.pod)||f.float)continue;const before=g.ni;
  if(d.pod)appendReference(g,C.POD_ASSET,v=>C.podPoint(f,v));else appendReference(g,f.skinAsset||d.asset,v=>C.referenceFitPoint(f,v));
  if(ranges&&g.ni>before)(ranges[f.id]||(ranges[f.id]=[])).push(['refFits',before,g.ni-before]);
 }return g;
}
// Live preview of edited parts and fittings, built in the editor from their
// requested shapes while the engine recomputes clipped, merged geometry.
function meshPreview(ship,parts,fits,opt={}){
 const g=new Geo(2048),out={struct:g,gen:g,shield:g,hyper:g,interior:g,engine:g,plant:g,nozzle:g,hangar:g},glow=[];
 const plain=parts.map(p=>({...p,_packing:undefined,_clip:undefined}));
 for(const p of plain)meshOnePart(out,p,ship,{coded:!!opt.coded},glow);
 const ref=meshReferenceParts(ship,null,plain.filter(p=>C.REFERENCE_ASSETS[p.skinAsset])),refG=new Geo(64);for(const k of ['refStruct','refEngine','refPlant'])if(ref[k].ni)appendGeo(refG,ref[k]);
 const fitG=fits.length?meshFits(ship,f=>fits.includes(f)):new Geo(16),refFitG=fits.length?meshReferenceFits(ship,null,fits):new Geo(16);
 return {preview:g,previewRef:refG,previewFits:fitG,previewRefFits:refFitG,glow};
}
function meshReferenceHatches(ship){
 const g=new Geo(16);
 for(const h of ship.hatches){if(!h.skinAsset||h._doorDetached)continue;const bay=ship.parts.find(p=>p.id===h.bay);if(!bay)continue;const delta=C.sub(bay.c,h.skinBayAnchor||bay.c),open=h.open??0,side=h.face==='port'?-1:1,spec=C.slidingHatchSpec(ship,h),mid=spec?(spec.b[spec.slideAxis]+spec.b[spec.slideAxis+3])/2:0;
  appendReference(g,h.skinAsset,(v,a)=>{const p=v.map((n,i)=>n*a.size[i]+a.c[i]+delta[i]);if(spec)p[spec.slideAxis]+=Math.sign(p[spec.slideAxis]-mid)*spec.travel*open;else if(h.face==='top'||h.face==='bottom')p[2]+=Math.sign(p[2]-delta[2])*a.size[2]*.52*open;else p[0]-=a.size[0]*open;return p;},(v,a)=>(!['port','stbd'].includes(h.face)||v.reduce((s,q)=>s+q[2],0)*side>0)&&(!h._slideSide||!spec||h._slideSide*(v.reduce((s,q)=>s+q[spec.slideAxis]*a.size[spec.slideAxis]+a.c[spec.slideAxis]+delta[spec.slideAxis],0)/3-mid)>=0));
 }
 // Ventral approach bay belongs to the hull skin; its doors are independently operated.
 if(!ship._referenceDoorOnly&&ship.hullSkin?.enabled&&ship.reference==='venator')appendReference(g,'ven_bay',(v,a)=>v.map((n,i)=>n*a.size[i]+a.c[i]));
 return g;
}

// A blueprint is uploaded once and reused by every ship in the fleet.
Renderer.prototype.prepareFleet=function(key,ship){
 this.fleetCache=this.fleetCache||new Map();if(this.fleetCache.has(key))return this.fleetCache.get(key);
 // Model copies keep designer door openings and caches untouched. An open shell
 // and closed, independent door halves are uploaded only once per blueprint.
 const sliding=ship.hatches.some(h=>C.isSlidingHatch(ship,h)),model=sliding?C.serialize(ship):ship;
 if(sliding)for(const h of model.hatches)if(C.isSlidingHatch(model,h)){h.open=1;h._doorDetached=true;}
 const old=this.meshes,meshes={},b=shipBounds(ship),center=[(b[0]+b[3])/2,(b[1]+b[4])/2,(b[2]+b[5])/2],doors=[],rays=[];this.meshes=meshes;
 try{this.upload('hull',meshHull(model));const parts=meshParts(model,{coded:false});for(const name of ['struct','plate','refStruct','gen','shield','hyper','engine','refEngine','nozzle','hangar'])if(parts.g[name])this.upload(name,parts.g[name]);const h=meshHatches(model);this.upload('hatchOpen',h.open);this.upload('hatchRay',h.ray);this.upload('fits',meshFits(model));this.upload('refFits',meshReferenceFits(model));this.upload('refHatches',meshReferenceHatches(model));this.upload('refHull',meshReferenceHull(model));
  for(const hatch of model.hatches){const spec=C.slidingHatchSpec(model,hatch);if(!spec)continue;
   if(hatch.k==='ray'){const name='slideRay_'+hatch.id;MESH_TEX[name]='ray';MESH_EMI[name]=1;this.upload(name,meshHatches({...model,hatches:[{...hatch,_rayOnly:true,_rayInset:5}]}).ray);rays.push({name});}
   if(hatch.skinAsset){for(const side of [-1,1]){const name='refSlideDoor_'+hatch.id+'_'+(side<0?'l':'r');MESH_TEX[name]='reference';MESH_EMI[name]=0;this.upload(name,meshReferenceHatches({...model,_referenceDoorOnly:true,hatches:[{...hatch,open:0,_doorDetached:false,_slideSide:side}]}));doors.push({name,axis:spec.slideAxis,side,travel:spec.travel});}}
   else for(const panel of C.slidingHatchPanels(model,hatch)){const name='slideDoor_'+hatch.id+'_'+(panel.side<0?'l':'r');MESH_EMI[name]=0;this.upload(name,meshSlidingHatchPanel(model,hatch,panel));doors.push({name,axis:panel.axis,side:panel.side,travel:panel.travel});}
  }
  const asset={meshes,doors,rays,center,glow:parts.glow,bounds:b,paint:ship.paint,lights:ship.lights,engine:ship.engineGlow||null,reference:ship.reference,length:ship.hull.L};this.fleetCache.set(key,asset);return asset;}catch(e){for(const m of Object.values(meshes))for(const k of ['pos','nor','uv','col','idx'])this.gl.deleteBuffer(m[k]);throw e;}finally{this.meshes=old;}
};
// Fleet geometry is built by the background engine; the renderer only uploads it.
function fleetGeometry(ship,opts){
 const sliding=ship.hatches.some(h=>C.isSlidingHatch(ship,h)),model=sliding?C.serialize(ship):ship;
 if(sliding)for(const h of model.hatches)if(C.isSlidingHatch(model,h)){h.open=1;h._doorDetached=true;}
 const meshes={},b=shipBounds(ship),center=[(b[0]+b[3])/2,(b[1]+b[4])/2,(b[2]+b[5])/2],doors=[],rays=[],put=(name,geo,tex,emi)=>{meshes[name]={geo,tex,emi};};
 put('hull',meshHull(model));const parts=meshParts(model,{coded:false});for(const name of ['struct','plate','refStruct','gen','shield','hyper','engine','refEngine','nozzle','hangar'])if(parts.g[name])put(name,parts.g[name]);
 const h=meshHatches(model);put('hatchOpen',h.open);put('hatchRay',h.ray);put('refHatches',meshReferenceHatches(model));put('refHull',meshReferenceHull(model));
 const turrets=opts?.trial?trialTurrets(model,put):null,launchers=opts?.trial?[...model.fits.filter(f=>C.FITS[f.k].msl&&!f.float).map(f=>{const d=C.fitSpec(f),up=C.fitUp(f);return {id:f.id,origin:C.add(C.fitOrigin(f),C.mul(up,d.hm)),axis:up,salvo:8,cycle:20,tt:(d.msl||80)/8,ion:!!C.FITS[f.k].ionMsl};}),...craftLaunchers(model)]:null,targetRadius=C.clamp(ship.hull.L*.05,40,500);if(!turrets){put('fits',meshFits(model));put('refFits',meshReferenceFits(model));}else put('trialTarget',trialTargetMesh(targetRadius),'fits',.6);
 for(const hatch of model.hatches){const spec=C.slidingHatchSpec(model,hatch);if(!spec)continue;
  if(hatch.k==='ray'){const name='slideRay_'+hatch.id;put(name,meshHatches({...model,hatches:[{...hatch,_rayOnly:true,_rayInset:5}]}).ray,'ray',1);rays.push({name});}
  if(hatch.skinAsset){for(const side of [-1,1]){const name='refSlideDoor_'+hatch.id+'_'+(side<0?'l':'r');put(name,meshReferenceHatches({...model,_referenceDoorOnly:true,hatches:[{...hatch,open:0,_doorDetached:false,_slideSide:side}]}),'reference',0);doors.push({name,axis:spec.slideAxis,side,travel:spec.travel});}}
  else for(const panel of C.slidingHatchPanels(model,hatch)){const name='slideDoor_'+hatch.id+'_'+(panel.side<0?'l':'r');put(name,meshSlidingHatchPanel(model,hatch,panel),null,0);doors.push({name,axis:panel.axis,side:panel.side,travel:panel.travel});}
 }
 return {meshes,doors,rays,center,glow:parts.glow,bounds:b,paint:ship.paint,lights:ship.lights,engine:ship.engineGlow||null,reference:ship.reference,length:ship.hull.L,turrets,launchers,targetRadius,eyes:opts?.trial?trialEyes(ship,b,meshes):null};
}
// ---------- trial turrets ----------
// Every gun turret becomes its own mesh with a pivot, a traverse axis and the
// direction its barrels point at rest; the pedestals stay with the ship.
const trialTurretFit=f=>{const d=C.FITS[f.k];return d.cat==='w'&&!!(d.tt||d.ion)&&!f.float&&!d.window;};
// Eigenvector of the largest eigenvalue of a symmetric 4x4 matrix (cyclic Jacobi).
function jacobiTop(M){
 const a=M.map(r=>r.slice()),v=[[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]];
 for(let sweep=0;sweep<50;sweep++){let off=0;for(let p=0;p<4;p++)for(let q=p+1;q<4;q++)off+=a[p][q]*a[p][q];if(off<1e-18)break;
  for(let p=0;p<4;p++)for(let q=p+1;q<4;q++){if(Math.abs(a[p][q])<1e-30)continue;const th=(a[q][q]-a[p][p])/(2*a[p][q]),t=Math.sign(th||1)/(Math.abs(th)+Math.sqrt(th*th+1)),c=1/Math.sqrt(t*t+1),s=t*c;
   for(let k=0;k<4;k++){const akp=a[k][p],akq=a[k][q];a[k][p]=c*akp-s*akq;a[k][q]=s*akp+c*akq;}
   for(let k=0;k<4;k++){const apk=a[p][k],aqk=a[q][k];a[p][k]=c*apk-s*aqk;a[q][k]=s*apk+c*aqk;}
   for(let k=0;k<4;k++){const vkp=v[k][p],vkq=v[k][q];v[k][p]=c*vkp-s*vkq;v[k][q]=s*vkp+c*vkq;}}}
 let best=0;for(let i=1;i<4;i++)if(a[i][i]>a[best][best])best=i;const q=[v[0][best],v[1][best],v[2][best],v[3][best]],l=Math.hypot(...q)||1;return q.map(x=>x/l);
}
// Least-squares rotation taking point set A onto B (Horn's quaternion method).
function hornFit(A,B){
 const n=A.length;if(!n)return null;const ma=[0,0,0],mb=[0,0,0];for(let i=0;i<n;i++)for(let k=0;k<3;k++){ma[k]+=A[i][k]/n;mb[k]+=B[i][k]/n;}
 const S=[[0,0,0],[0,0,0],[0,0,0]];for(let i=0;i<n;i++)for(let r=0;r<3;r++)for(let c=0;c<3;c++)S[r][c]+=(A[i][r]-ma[r])*(B[i][c]-mb[c]);
 const [[xx,xy,xz],[yx,yy,yz],[zx,zy,zz]]=S,N=[[xx+yy+zz,yz-zy,zx-xz,xy-yx],[yz-zy,xx-yy-zz,xy+yx,zx+xz],[zx-xz,xy+yx,-xx+yy-zz,yz+zy],[xy-yx,zx+xz,yz+zy,-xx-yy+zz]];
 const q=jacobiTop(N);
 const [w,x,y,z]=q,R=[1-2*(y*y+z*z),2*(x*y+w*z),2*(x*z-w*y),2*(x*y-w*z),1-2*(x*x+z*z),2*(y*z+w*x),2*(x*z+w*y),2*(y*z-w*x),1-2*(x*x+y*y)];// column-major
 const ap=v=>[R[0]*v[0]+R[3]*v[1]+R[6]*v[2],R[1]*v[0]+R[4]*v[1]+R[7]*v[2],R[2]*v[0]+R[5]*v[1]+R[8]*v[2]];
 let err=0;for(let i=0;i<n;i++){const a=ap(C.sub(A[i],ma));err+=C.len(C.sub(a,C.sub(B[i],mb)))**2;}
 return {R,ap,ma,mb,rms:Math.sqrt(err/n)};
}
// Example turrets keep the pose they had on the source model: fit the asset's
// canonical placement (barrels to +x, axis +y, pivot at 0) onto the instance.
function skinTurretPose(f){
 const d=C.FITS[f.k],ds=C.decodeReference(f.skinAsset),dc=C.decodeReference(d.asset);if(!ds||!dc||ds.pos.length!==dc.pos.length)return null;
 const fake={...f,skinAsset:undefined,p:[0,0,0],a:2,base:0,ped:0,low:0,assetYaw:0,mountAxis:undefined,localMount:undefined,mountOffset:0},A=[],B=[],stride=Math.max(1,Math.floor(ds.pos.length/3/600));
 for(let i=0;i<ds.pos.length/3;i+=stride){A.push(C.referenceFitPoint(fake,[dc.pos[i*3],dc.pos[i*3+1],dc.pos[i*3+2]]));B.push(C.referenceFitPoint(f,[ds.pos[i*3],ds.pos[i*3+1],ds.pos[i*3+2]]));}
 const size=Math.max(...C.REFERENCE_ASSETS[f.skinAsset].size),plain=hornFit(A,B),mir=hornFit(A.map(v=>[v[0],v[1],-v[2]]),B);
 const best=[plain&&{...plain,m:1},mir&&{...mir,m:-1}].filter(Boolean).sort((a,b)=>a.rms-b.rms)[0];if(!best||best.rms>size*.08)return null;
 const ma=best.m<0?[best.ma[0],best.ma[1],-best.ma[2]]:best.ma,pivot=C.sub(best.mb,best.ap(ma));
 return {pivot,axis:C.norm(best.ap([0,1,0])),fw:C.norm(best.ap([1,0,0]))};
}
// Mirrored source copies list their vertices in another order; they take the
// pose of the copy they mirror across the centreline.
function mirroredTurretPose(f,fits,poses){
 const a=C.REFERENCE_ASSETS[f.skinAsset];if(!a)return null;
 for(const g of fits){const b=C.REFERENCE_ASSETS[g.skinAsset],pg=poses.get(g.id);if(!b||!pg||g===f||g.k!==f.k)continue;
  if(Math.abs(a.c[0]-b.c[0])>.5||Math.abs(a.c[1]-b.c[1])>.5||Math.abs(a.c[2]+b.c[2])>.5||a.size.some((v,i)=>Math.abs(v-b.size[i])>.05))continue;
  const og=C.fitOrigin(g),of=C.fitOrigin(f),m=v=>[v[0],v[1],-v[2]],rel=C.sub(pg.pivot,og);
  return {pivot:C.add(of,m(rel)),axis:m(pg.axis),fw:m(pg.fw)};}
 return null;
}
function turretPose(f){
 const d=C.FITS[f.k],fr=C.fitFrameOf(f);
 if(d.asset&&f.skinAsset&&f.skinAsset!==d.asset){const k=skinTurretPose(f);if(k)return k;return null;}
 if(d.fixed)return {pivot:C.fitOrigin(f),axis:C.fitUp(f),fw:[1,0,0]};
 if(d.casemate)return {pivot:C.fitOrigin(f),axis:[0,1,0],fw:C.AXES[f.a]};
 if(d.asset){const y=(f.assetYaw||0)*Math.PI/180;return {pivot:C.fitOrigin(f),axis:fr.up,fw:C.norm(C.add(C.mul(fr.fw,Math.cos(y)),C.mul(fr.rt,Math.sin(y))))};}
 return {pivot:C.fitOrigin(f),axis:fr.up,fw:fr.fw};
}
const TRIAL_BARRELS={pd:2,ltl:4,mtl:3,htl:2,stl:2,utl:2,ion:2,ionL:2};
function trialTurrets(model,put){
 const list=model.fits.filter(trialTurretFit),turning=new Set(list.filter(f=>!C.FITS[f.k].casemate&&!C.FITS[f.k].fixed).map(f=>f.id)),out=[];
 FIT_SKIP_BODY=turning;try{put('fits',meshFits(model));}finally{FIT_SKIP_BODY=null;}
 put('refFits',meshReferenceFits(model,null,model.fits.filter(f=>!turning.has(f.id))));
 const all=new Set(model.fits.map(f=>f.id)),poses=new Map();
 for(const f of list){const p=turretPose(f);if(p)poses.set(f.id,p);}
 for(const f of list)if(!poses.has(f.id))poses.set(f.id,mirroredTurretPose(f,list,poses)||(()=>{const fr=C.fitFrameOf(f);return {pivot:C.fitOrigin(f),axis:fr.up,fw:fr.fw};})());
 for(const f of list){
  const d=C.fitSpec(f),spec=C.FITS[f.k],pose=poses.get(f.id),axis=C.norm(pose.axis),fw=C.norm(C.sub(pose.fw,C.mul(axis,C.dot(pose.fw,axis)))),rot=turning.has(f.id);
  let mesh=null;if(rot){if(spec.asset){mesh='refTur_'+f.id;put(mesh,meshReferenceFits(model,null,[f]),'reference',null);}else{mesh='tur_'+f.id;FIT_SKIP_PED=all;try{put(mesh,meshFits(model,x=>x===f),'fits',.6);}finally{FIT_SKIP_PED=null;}}}
  out.push({id:f.id,k:f.k,name:spec.short||spec.name,mesh,pivot:pose.pivot,axis,fw,origin:C.turretOrigin(f),mount:C.fitUp(f),r:d.r,hm:d.hm,casemate:!!(spec.casemate||spec.fixed),barrels:spec.barrels||TRIAL_BARRELS[f.k]||2,cycle:spec.cycle||2.5,tt:d.tt||0,ion:!!d.ion&&!d.tt,rate:C.turretRate(f),power:d.power||0,cap:C.needsCapacitor(f)});
 }
 return out;
}
// v21.3 Where the trial's cockpit and bridge views sit (model coordinates):
// a craft's foremost cockpit seat and a ship's bridge — the highest bridge
// drum, just clear of its face. A ship without one looks out from the top of
// its fore half; a craft without a cockpit (a droid) from its nose.
// The highest point of the named meshes straight above or below each (xs[k], z), in one pass.
function meshTopsAt(meshes,names,xs,z){
 const top=xs.map(()=>-Infinity);
 for(const n of names){const g=meshes[n]?.geo;if(!g?.ni)continue;const P=g.pos,I=g.idx;
  for(let i=0;i+2<g.ni;i+=3){const a=I[i]*3,b=I[i+1]*3,c=I[i+2]*3,ax=P[a],az=P[a+2],bx=P[b],bz=P[b+2],cx=P[c],cz=P[c+2];
   if(z<az&&z<bz&&z<cz||z>az&&z>bz&&z>cz)continue;const x0=Math.min(ax,bx,cx),x1=Math.max(ax,bx,cx);
   const d=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(d)<1e-12)continue;
   for(let k=0;k<xs.length;k++){const x=xs[k];if(x<x0||x>x1)continue;
    const u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/d,v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/d,w=1-u-v;if(u<-1e-6||v<-1e-6||w<-1e-6)continue;
    const y=u*P[a+1]+v*P[b+1]+w*P[c+1];if(y>top[k])top[k]=y;}}}
 return top;
}
function trialEyes(ship,b,meshes){
 const L=ship.hull.L,seat=ship.parts.filter(p=>p.k==='cockpit').sort((p,q)=>q.c[0]-p.c[0])[0],HULL=['hull','refHull'],SHELL=[...HULL,'struct','refStruct','plate'],z=(b[2]+b[5])/2,craft=C.isCraft(ship),near=C.clamp(L*.004,.1,6);
 let cockpit=null,bridge=null,top=null;
 // A canopy standing proud of the hull puts the eye on top of it (clear of the hull and the canopy's own
 // frame); a cockpit sunk in the hull (a TIE's ball) looks out through it, the hull's inside being unseen.
 if(seat){const r=C.clamp((seat.d||1.6)/2,.2,4),[sx,sy,sz]=seat.c,hull=meshTopsAt(meshes,HULL,[sx],sz)[0];let y=sy+r*.3;
  if(sy+r>hull)y=Math.max(y,Math.min(Math.max(hull,meshTopsAt(meshes,SHELL,[sx],sz)[0]),sy+r*2.5)+Math.max(.05,r*.1));
  cockpit={pos:[sx+r*.15,y,sz],near:C.clamp(r*.4,.1,1),kind:'cockpit'};}
 try{const pods=[...ship.fits.filter(f=>C.FITS[f.k]?.pod&&!f.float),...C.intrinsicCommandFits(ship)].filter(f=>C.FITS[f.k]?.role==='bridge').sort((f,g)=>g.p[1]-f.p[1]||g.p[0]-f.p[0]);
  const f=pods[0];if(f){const n=C.windowFrame(f).up,h=f.height||C.FITS[f.k].wm||6,out=(f.intrinsic?0:C.podDepth(f))+1+h*.1;bridge={pos:C.add(f.p,C.mul(n,out)),near:C.clamp(h*.25,.5,6),kind:'bridge'};}}catch(e){}
 // No bridge: the eye stands on the highest structure of the fore half, above
 // everything ahead of it on the centreline (fittings and turrets included).
 if(!craft&&!bridge&&!cockpit){const xs=Array.from({length:16},(_,i)=>b[0]+(b[3]-b[0])*(.5+i*.031)),deck=meshTopsAt(meshes,SHELL,xs,z),all=meshTopsAt(meshes,[...SHELL,...Object.keys(meshes).filter(n=>/^(fits|refFits|tur_|refTur_)/.test(n))],xs,z);
  const m=Math.max(...deck);let k=0;for(let i=0;i<xs.length;i++)if(deck[i]>=m-L*.002)k=i;
  const y=Math.max(...all.slice(k)),Y=Number.isFinite(y)?y:b[4];top={pos:[xs[k],Y+Math.max(.3,L*.01),z],near,kind:'top'};}
 const nose={pos:[b[3]+Math.max(.2,L*.03),(b[1]+b[4])/2,z],near,kind:'nose'};
 return {cockpit:cockpit||(craft?nose:bridge||top),bridge:bridge||cockpit||top||nose,craft};
}
function trialTargetMesh(R){
 const g=new Geo(2048),I=[1,0,0,0,1,0,0,0,1],O=[0,0,0],org=hex('#e0782e'),wht=hex('#e6e9ec'),drk=hex('#30353b');
 cyl(g,I,O,0,0,0,R*.45,R*.45,R*.9,1,wht,24);cyl(g,I,O,0,R*.62,0,R*.45,R*.12,R*.34,1,org,24);cyl(g,I,O,0,-R*.62,0,R*.12,R*.45,R*.34,1,org,24);
 cyl(g,I,O,0,0,0,R,R,R*.07,1,org,40);cyl(g,I,O,0,0,0,R*.9,R*.9,R*.09,1,drk,40);
 for(const a of [0,1])box(g,I,O,0,0,0,a?R*.1:R*1.9,R*.05,a?R*1.9:R*.1,drk);
 return g;
}
Renderer.prototype.loadFleet=function(key,data){
 this.fleetCache=this.fleetCache||new Map();if(this.fleetCache.has(key))return this.fleetCache.get(key);
 const old=this.meshes,meshes={};this.meshes=meshes;
 try{for(const [name,m] of Object.entries(data.meshes)){if(m.tex)MESH_TEX[name]=m.tex;if(m.emi!=null)MESH_EMI[name]=m.emi;if(m.geo)this.upload(name,m.geo);}
  const asset={meshes,doors:data.doors,rays:data.rays,center:data.center,glow:data.glow,bounds:data.bounds,paint:data.paint,lights:data.lights,engine:data.engine||null,reference:data.reference,length:data.length};this.fleetCache.set(key,asset);return asset;}
 catch(e){for(const m of Object.values(meshes))for(const k of ['pos','nor','uv','col','idx'])this.gl.deleteBuffer(m[k]);throw e;}finally{this.meshes=old;}
};
Renderer.prototype.pruneFleet=function(keys){if(!this.fleetCache)return;for(const [k,a] of this.fleetCache)if(!keys.has(k)){for(const m of Object.values(a.meshes))for(const n of ['pos','nor','uv','col','idx'])this.gl.deleteBuffer(m[n]);this.fleetCache.delete(k);}};
Renderer.prototype.drawFleet=function(m,opt){
 const gl=this.gl,old=this.meshes,off=this.off,shields=[];gl.disable(gl.BLEND);gl.depthMask(true);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);this.clip=null;
 // Distant ships draw only their outer shell, and specks or ships behind the eye are skipped.
 const eye=this.eye(),vd=(()=>{const t=this.cam.target||[0,0,0],d=[t[0]-eye[0],t[1]-eye[1],t[2]-eye[2]],l=Math.hypot(...d)||1;return [d[0]/l,d[1]/l,d[2]/l];})(),focal=this.canvas.height/(2*Math.tan((this.cam.fov||.72)/2)),SHELL=['hull','struct','plate','refHull','refStruct'],FULL=['hull','struct','plate','refHull','refStruct','refHatches','gen','shield','hyper','engine','refEngine','nozzle','hangar'],OUTER=FULL.filter(n=>!['gen','shield','hyper','hangar'].includes(n));this.lodSkipped=0;
 // v20.2 Key-light shadows for the ships largest on screen (not pieces of wrecks or ships in a jump).
 let shadows=null;if(this.look?.shadow&&!this.noShadow){const c=[];for(const u of opt.fleet){if(u.dead||u.hidden||u.clip||Math.abs((u.stretch||1)-1)>.02)continue;const a=this.fleetCache?.get(u.key);if(!a?.bounds)continue;const L=a.length||300,rx=u.pos[0]-eye[0],ry=u.pos[1]-eye[1],rz=u.pos[2]-eye[2],px=L/Math.max(1,Math.hypot(rx,ry,rz))*focal;if(px>=140&&rx*vd[0]+ry*vd[1]+rz*vd[2]>=-L)c.push({u,a,px});}if(c.length)shadows=this.shadowFleet(c);}
 try{for(const u of opt.fleet){if(u.dead||u.hidden)continue;const a=this.fleetCache?.get(u.key);if(!a)continue;this.shTile=shadows?.get(u)||null;
  const L=(a.length||300)*(u.stretch||1),rx=u.pos[0]-eye[0],ry=u.pos[1]-eye[1],rz=u.pos[2]-eye[2],dist=Math.hypot(rx,ry,rz),px=L/Math.max(1,dist)*focal,ahead=rx*vd[0]+ry*vd[1]+rz*vd[2];
  if(opt.lod&&(px<2.2||ahead<-L)){this.lodSkipped++;continue;}const lod=opt.lod&&px<44&&!u.turrets;
  this.meshes=a.meshes;this.off=u.pos;this.modelCenter=u.center||a.center;this.modelYaw=u.yaw||0;this.modelRot=u.rot||null;this.paint=a.paint||'neutral';
  this.engineTint=a.engine&&a.engine!=='blue'?C.engineGlowRGB(a.engine):null;this.engineK=u.wreck?0:.3+.95*C.clamp(u.glow??.6,0,1);
  // A piece of a broken ship: the part of the model inside its box, turned about its own centre, scorched, its torn edges glowing.
  this.clip=u.clip?u.clip.hi:null;this.clipLo=u.clip?u.clip.lo:null;this.seam=u.seam||null;this.char=u.char||0;if(u.clip)gl.disable(gl.CULL_FACE);this.setLights(a.lights);this.sourceRed=a.reference==='venator';this.hullLength=a.length;const R=u.rot||yawMatrix(this.modelYaw),rv=v=>[R[0]*v[0]+R[3]*v[1]+R[6]*v[2],R[1]*v[0]+R[4]*v[1]+R[7]*v[2],R[2]*v[0]+R[5]*v[1]+R[8]*v[2]];
  // A ship dropping out of (or into) hyperspace is drawn stretched along its
  // own length with the bow held in place, and washed toward blue-white.
  const sx=u.stretch||1;this.unitScl=sx!==1?[sx,1,1]:null;this.unitFlash=u.flash||0;if(sx!==1&&a.bounds)this.modelCenter=[a.center[0]+a.bounds[3]*(sx-1),a.center[1],a.center[2]];const center=this.modelCenter;
  // From its own cockpit a ship hides the compartments inside its hull (u.noInner).
  for(const n of lod?SHELL:u.noInner?OUTER:FULL)this.drawMesh(n,m,1);
  if(lod||u.wreck){if(u.wreck&&!lod){gl.disable(gl.CULL_FACE);this.drawMesh('fits',m,1);this.drawMesh('refFits',m,1);}this.unitScl=null;this.unitFlash=0;this.clip=this.clipLo=this.seam=null;this.char=0;gl.enable(gl.CULL_FACE);continue;}
  const open=opt.mode==='review'?0:C.clamp(u.hatchOpen??0,0,1);for(const door of a.doors||[]){const delta=[0,0,0];delta[door.axis]=door.side*door.travel*open;const q=rv(delta);this.off=[u.pos[0]+q[0],u.pos[1]+q[1],u.pos[2]+q[2]];this.drawMesh(door.name,m,1,0);}this.off=u.pos;
  gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(-1,-2);this.drawMesh('hatchOpen',m,1);gl.disable(gl.POLYGON_OFFSET_FILL);shields.push({u,a,names:['hatchRay',...(open>0?(a.rays||[]).map(r=>r.name):[])]});gl.disable(gl.CULL_FACE);this.drawMesh('fits',m,1);this.drawMesh('refFits',m,1);
  if(u.turrets&&sx<1.02){for(const t of u.turrets){const q=rv([t.pivot[0]-a.center[0],t.pivot[1]-a.center[1],t.pivot[2]-a.center[2]]);this.off=[u.pos[0]+q[0],u.pos[1]+q[1],u.pos[2]+q[2]];this.modelCenter=t.pivot;this.modelRot=mat3Mul(R,t.rot);this.drawMesh(t.mesh,m,1);}this.off=u.pos;this.modelCenter=center;this.modelRot=u.rot||null;}
  this.unitScl=null;this.unitFlash=0;this.clip=this.clipLo=this.seam=null;this.char=0;
  this.shTile=null;for(const t of u.targets||[]){this.off=t.pos;this.modelCenter=[0,0,0];this.modelRot=t.rot||MAT3_I;this.drawMesh('trialTarget',m,1);}
  gl.enable(gl.CULL_FACE);
 }
 // Shields go on after every hull so a translucent field never hides a ship behind it.
 for(const {u,a,names} of shields){if((u.stretch||1)!==1)continue;this.meshes=a.meshes;this.off=u.pos;this.modelCenter=a.center;this.modelYaw=u.yaw||0;this.modelRot=u.rot||null;this.drawRays(m,names,1);}
 }finally{this.shTile=null;this.meshes=old;this.off=off;this.modelCenter=null;this.modelYaw=0;this.modelRot=null;this.unitScl=null;this.unitFlash=0;this.clip=this.clipLo=this.seam=null;this.char=0;this.engineTint=null;this.engineK=1;}
 gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.disable(gl.CULL_FACE);if(!opt.planet){this.drawLines('fleetGrid',m,.65);gl.disable(gl.DEPTH_TEST);this.drawLines('fleetOrders',m,.8);gl.enable(gl.DEPTH_TEST);this.drawLines('fleetShots',m,1);}
 // v18 Drive glow: each nozzle glows in its design's engine colour, sized and
 // lit by how hard the drives burn (u.glow 0–1); above a third of full thrust a
 // plume trails aft and lengthens with it.
 const gp=[],gc=[],gs=[];for(const u of opt.fleet){if(u.dead||u.hidden||u.wreck||(u.stretch||1)>1.05)continue;const a=this.fleetCache?.get(u.key);if(!a)continue;
  const R=u.rot||yawMatrix(u.yaw||0),t=C.clamp(u.glow??.6,0,1),rgb=C.engineGlowRGB(a.engine),aft=[-R[0],-R[1],-R[2]],al=Math.min(255,70+170*t),sk=.6+4.4*t*t,pl=t>.25?(t-.25)/.75:0;
  for(let i=0;i<a.glow.length;i+=4){const x=a.glow[i]-a.center[0],y=a.glow[i+1]-a.center[1],z=a.glow[i+2]-a.center[2],px=u.pos[0]+R[0]*x+R[3]*y+R[6]*z,py=u.pos[1]+R[1]*x+R[4]*y+R[7]*z,pz=u.pos[2]+R[2]*x+R[5]*y+R[8]*z,sz=a.glow[i+3];
   gp.push(px,py,pz);gc.push(rgb[0],rgb[1],rgb[2],al);gs.push(sz*sk);
   if(pl>0)for(let j=1;j<=4;j++){const d=sz*j*(.8+2.4*pl);gp.push(px+aft[0]*d,py+aft[1]*d,pz+aft[2]*d);gc.push(rgb[0],rgb[1],rgb[2],Math.round(235*pl*(1-.18*j)));gs.push(sz*sk*(1-.17*j));}}}
 this.setPoints('fleetGlow',new Float32Array(gp),new Uint8Array(gc),new Float32Array(gs));gl.blendFunc(gl.ONE,gl.ONE);this.drawPoints('fleetGlow',m,[0,0,0],1,2,false);if(opt.planet||opt.hyper||opt.sky){if(!opt.hyper&&!opt.noDust)this.drawPoints('trialDust',m,[0,0,0],1,1,false);this.drawPoints('trialFx',m,[0,0,0],1,2,false);this.drawPoints('trialBolts',m,[0,0,0],1,2,false);if(!opt.hyper)this.drawPoints('trialCraft',m,[0,0,0],1,2,false);}
 gl.depthMask(true);
};

function meshSolidCutter(c){
  const mesh=new Geo(64),ls=lineSet();
  if(!c)return {mesh,lines:ls.out()};
  const T=C.solidCutTriangles(c),edges=new Map(),color=[246,137,97];
  triangleMesh(mesh,T,color,90);
  for(let i=0;i<T.length;i+=9){
    const p=[0,3,6].map(j=>Array.from(T.slice(i+j,i+j+3))),n=C.norm(C.cross(C.sub(p[1],p[0]),C.sub(p[2],p[0])));
    for(let j=0;j<3;j++){
      const a=p[j],b=p[(j+1)%3],ka=a.map(v=>v.toFixed(4)).join(','),kb=b.map(v=>v.toFixed(4)).join(','),key=ka<kb?ka+'|'+kb:kb+'|'+ka;
      if(!edges.has(key))edges.set(key,{a,b,n,edge:true});else {const e=edges.get(key);e.edge=Math.abs(C.dot(e.n,n))<.997;}
    }
  }
  for(const e of edges.values())if(e.edge)ls.seg(e.a,e.b,[255,169,116,255]);
  const d=Math.max(2,Math.min(...c.s)*.18);ls.cross(c.c,d,[255,221,185,255]);
  return {mesh,lines:ls.out()};
}

// Canvas2D fallback: renders the same editable meshes with a software depth
// buffer. It never substitutes a screenshot or a non-editable reference model.
class CompatRenderer {
 constructor(canvas) {
  this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});
  if(!this.ctx)throw new Error('互換描画も初期化できませんでした');
  this.kind='compat';this.meshes={};this.lines={};this.points={};this.fleetCache=new Map();
  this.off=[0,0,0];this.cam={th:.85,ph:1.05,r:1500,target:[0,0,0],fov:.72};this.frames=0;
 }
 upload(name,g){this.meshes[name]={geo:g,count:g.ni};}
 setLines(name,data){this.lines[name]=data;}
 setPoints(name,pos,col,size){this.points[name]={pos,col,size};}
 setGlow(list,rgb){const c=rgb||[110,185,255],pos=[],col=[],size=[];for(let i=0;i<list.length;i+=4){pos.push(...list.slice(i,i+3));col.push(c[0],c[1],c[2],150);size.push(list[i+3]);}this.setPoints('glow',pos,col,size);}
 resize(){const w=Math.max(1,Math.round(this.canvas.clientWidth)),h=Math.max(1,Math.round(this.canvas.clientHeight)),scale=Math.min(1,Math.sqrt(420000/(w*h)));const rw=Math.max(1,Math.round(w*scale)),rh=Math.max(1,Math.round(h*scale));if(this.canvas.width!==rw||this.canvas.height!==rh){this.canvas.width=rw;this.canvas.height=rh;}}
 eye(){return Renderer.prototype.eye.call(this);}
 matrices(){return Renderer.prototype.matrices.call(this);}
 ray(x,y){return Renderer.prototype.ray.call(this,x,y);}
 project(p){return Renderer.prototype.project.call(this,p);}
 dispose(){this.meshes={};this.lines={};this.points={};this.fleetCache.clear();}
 prepareFleet(key,ship){
  if(this.fleetCache.has(key))return this.fleetCache.get(key);
  const model=C.deserialize(C.serialize(ship));for(const h of model.hatches)if(C.isSlidingHatch(model,h))h.open=0;
  C.syncCompartments(model);const parts=meshParts(model,{coded:false}),h=meshHatches(model),b=shipBounds(model);
  const data={hull:meshHull(model),refHull:meshReferenceHull(model),...parts.g,hatchOpen:h.open,hatchRay:h.ray,fits:meshFits(model),refFits:meshReferenceFits(model),refHatches:meshReferenceHatches(model)};
  const asset={meshes:Object.fromEntries(Object.entries(data).map(([n,g])=>[n,{geo:g,count:g.ni}])),center:[(b[0]+b[3])/2,(b[1]+b[4])/2,(b[2]+b[5])/2],bounds:b,glow:parts.glow};this.fleetCache.set(key,asset);return asset;
 }
 loadFleet(key,data){
  if(this.fleetCache.has(key))return this.fleetCache.get(key);
  const meshes={},extra=[];
  for(const [name,m] of Object.entries(data.meshes)){if(!m.geo)continue;const item={geo:m.geo,count:m.geo.ni};if(name.startsWith('slideDoor')||name.startsWith('refSlideDoor'))extra.push({name,...item});else meshes[name]=item;}
  const asset={meshes,extra,center:data.center,bounds:data.bounds,glow:data.glow};this.fleetCache.set(key,asset);return asset;
 }
 pruneFleet(keys){for(const key of this.fleetCache.keys())if(!keys.has(key))this.fleetCache.delete(key);}
 draw(opt={}){
  this.resize();const w=this.canvas.width,h=this.canvas.height,ctx=this.ctx,m=this.matrices();
  const image=ctx.createImageData(w,h),pixels=image.data,depth=new Float32Array(w*h);depth.fill(Infinity);
  for(let y=0;y<h;y++){const t=y/h;for(let x=0;x<w;x++){const k=(y*w+x)*4;pixels[k]=Math.round(10-4*t);pixels[k+1]=Math.round(17-5*t);pixels[k+2]=Math.round(25-7*t);pixels[k+3]=255;}}
  this._frame={w,h,m,pixels,depth};
  const external=['hull','struct','plate','refHull','refStruct','refHatches','gen','shield','hyper','engine','refEngine','nozzle','hangar','fits','refFits','hatchOpen','hatchRay','preview','previewRef','previewFits','previewRefFits'];
  const inside=['keel','plant','refPlant','interior'];
  if(opt.fleet){for(const unit of opt.fleet){if(unit.dead)continue;const a=this.fleetCache.get(unit.key);if(!a)continue;for(const name of external)this.rasterMesh(a.meshes[name]?.geo,name,name==='hatchRay'?.5:1,null,{off:unit.pos,center:a.center,yaw:unit.yaw||0,rot:unit.rot||null});for(const e of a.extra||[])this.rasterMesh(e.geo,e.name.startsWith('ref')?'refFits':'hull',1,null,{off:unit.pos,center:a.center,yaw:unit.yaw||0,rot:unit.rot||null});const R=unit.rot||yawMatrix(unit.yaw||0);for(const t of unit.turrets||[]){const v=[t.pivot[0]-a.center[0],t.pivot[1]-a.center[1],t.pivot[2]-a.center[2]];this.rasterMesh(a.meshes[t.mesh]?.geo,t.mesh.startsWith('ref')?'refFits':'fits',1,null,{off:[unit.pos[0]+R[0]*v[0]+R[3]*v[1]+R[6]*v[2],unit.pos[1]+R[1]*v[0]+R[4]*v[1]+R[7]*v[2],unit.pos[2]+R[2]*v[0]+R[5]*v[1]+R[8]*v[2]],center:t.pivot,rot:mat3Mul(R,t.rot)});}for(const t of unit.targets||[])this.rasterMesh(a.meshes.trialTarget?.geo,'fits',1,null,{off:t.pos,center:[0,0,0],rot:t.rot||MAT3_I});}}
  else {
   const clip=opt.mode==='cut'?opt.clip:null,translucent=new Set(['hull','struct','plate','refHull','refStruct','refHatches','hatchOpen','hatchRay']);
   if(opt.mode==='xray'){
    for(const name of [...external.filter(n=>!translucent.has(n)),...inside])this.rasterMesh(this.meshes[name]?.geo,name,1,clip);
    for(const name of external.filter(n=>translucent.has(n)))this.rasterMesh(this.meshes[name]?.geo,name,.20,clip);
   }else for(const name of [...external,...(opt.mode==='cut'?inside:[])])this.rasterMesh(this.meshes[name]?.geo,name,name==='hatchRay'?.5:1,clip);
   this.rasterMesh(this.meshes.cutter?.geo,'cutter',.28,null);
  }
  ctx.putImageData(image,0,0);
  for(const name of opt.fleet?['fleetGrid','fleetOrders','fleetShots']:['grid',...(opt.mode==='cut'?['section']:[]),'ghost','cutter'])this.paintLines(name,name==='grid'||name==='fleetGrid');
  delete this._frame;this.frames++;return true;
 }
 rasterMesh(g,name,alpha,clip,transform){
  if(!g?.ni)return;const colScale=REFERENCE_SHADED.has(name)||name==='refEngine'?2:1;const {w,h,m,pixels,depth}=this._frame,off=transform?.off||this.off,center=transform?.center||[0,0,0],R=transform?.rot||yawMatrix(transform?.yaw||0),M=m.VP;
  const projected=new Float32Array(g.n*4);
  for(let i=0;i<g.n;i++){const ax=g.pos[i*3]-center[0],ay=g.pos[i*3+1]-center[1],az=g.pos[i*3+2]-center[2],x=R[0]*ax+R[3]*ay+R[6]*az+off[0],y=R[1]*ax+R[4]*ay+R[7]*az+off[1],z=R[2]*ax+R[5]*ay+R[8]*az+off[2];const cw=M[3]*x+M[7]*y+M[11]*z+M[15],k=i*4;projected[k]=((M[0]*x+M[4]*y+M[8]*z+M[12])/cw+1)*w*.5;projected[k+1]=(1-(M[1]*x+M[5]*y+M[9]*z+M[13])/cw)*h*.5;projected[k+2]=(M[2]*x+M[6]*y+M[10]*z+M[14])/cw;projected[k+3]=cw;}
  for(let t=0;t<g.ni;t+=3){
   const a=g.idx[t],b=g.idx[t+1],c=g.idx[t+2],ai=a*4,bi=b*4,ci=c*4;
   if(projected[ai+3]<=0||projected[bi+3]<=0||projected[ci+3]<=0)continue;
   if(clip&&[0,1,2].some(ax=>g.pos[a*3+ax]>clip[ax]&&g.pos[b*3+ax]>clip[ax]&&g.pos[c*3+ax]>clip[ax]))continue;
   const ax=projected[ai],ay=projected[ai+1],bx=projected[bi],by=projected[bi+1],cx=projected[ci],cy=projected[ci+1];
   const det=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);if(!Number.isFinite(det)||Math.abs(det)<.001)continue;
   if(!clip&&alpha===1&&det>0&&!['fits','refFits','hatchRay'].includes(name))continue;
   const x0=Math.max(0,Math.floor(Math.min(ax,bx,cx))),x1=Math.min(w-1,Math.ceil(Math.max(ax,bx,cx))),y0=Math.max(0,Math.floor(Math.min(ay,by,cy))),y1=Math.min(h-1,Math.ceil(Math.max(ay,by,cy)));if(x1<x0||y1<y0)continue;
   const nx=(g.nor[a*3]+g.nor[b*3]+g.nor[c*3])/381,ny=(g.nor[a*3+1]+g.nor[b*3+1]+g.nor[c*3+1])/381,nz=(g.nor[a*3+2]+g.nor[b*3+2]+g.nor[c*3+2])/381;
   // Normals follow the same full ship/turret rotation as the vertices.
   const wx=R[0]*nx+R[3]*ny+R[6]*nz,wy=R[1]*nx+R[4]*ny+R[7]*nz,wz=R[2]*nx+R[5]*ny+R[8]*nz;
   const light=Math.max(.24,Math.min(1.15,.48+wx*.20+wy*.48+wz*.12)),color=[0,1,2].map(j=>Math.min(255,Math.max(0,(g.col[ai+j]+g.col[bi+j]+g.col[ci+j])/3*light*colScale)));
   const inv=1/det,az=projected[ai+2],bz=projected[bi+2],cz=projected[ci+2];
   for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const u=((bx-x-.5)*(cy-y-.5)-(by-y-.5)*(cx-x-.5))*inv,v=((cx-x-.5)*(ay-y-.5)-(cy-y-.5)*(ax-x-.5))*inv,q=1-u-v;if(u<-.00001||v<-.00001||q<-.00001)continue;
    const z=u*az+v*bz+q*cz,ix=y*w+x;if(z< -1||z>1||z>depth[ix]+1e-6)continue;
    if(clip&&[0,1,2].some(j=>u*g.pos[a*3+j]+v*g.pos[b*3+j]+q*g.pos[c*3+j]>clip[j]))continue;
    if(alpha>=.99)depth[ix]=z;const k=ix*4;pixels[k]=pixels[k]*(1-alpha)+color[0]*alpha;pixels[k+1]=pixels[k+1]*(1-alpha)+color[1]*alpha;pixels[k+2]=pixels[k+2]*(1-alpha)+color[2]*alpha;
   }
  }
 }
 paintLines(name,depthTest=false){
  const line=this.lines[name];if(!line?.pos?.length)return;const {m,w,h,depth}=this._frame,ctx=this.ctx;
  for(let i=0;i<line.pos.length;i+=6){const a=M4.xf(m.VP,[line.pos[i]+this.off[0],line.pos[i+1]+this.off[1],line.pos[i+2]+this.off[2]]),b=M4.xf(m.VP,[line.pos[i+3]+this.off[0],line.pos[i+4]+this.off[1],line.pos[i+5]+this.off[2]]);if(!a.every(Number.isFinite)||!b.every(Number.isFinite)||a[2]<-1||a[2]>1||b[2]<-1||b[2]>1)continue;const ax=(a[0]+1)*w/2,ay=(1-a[1])*h/2,bx=(b[0]+1)*w/2,by=(1-b[1])*h/2,k=i/3*4,col=line.col;
   ctx.strokeStyle=`rgba(${col[k]},${col[k+1]},${col[k+2]},${(col[k+3]??255)/255})`;ctx.lineWidth=1;
   if(!depthTest){ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.stroke();continue;}
   const steps=Math.min(1800,Math.ceil(Math.max(Math.abs(bx-ax),Math.abs(by-ay))));ctx.beginPath();let pen=false;
   for(let s=0;s<=steps;s++){const t=s/Math.max(1,steps),x=ax+(bx-ax)*t,y=ay+(by-ay)*t,z=a[2]+(b[2]-a[2])*t,ix=Math.floor(x),iy=Math.floor(y);if(ix<0||ix>=w||iy<0||iy>=h||z>depth[iy*w+ix]+1e-6){pen=false;continue;}if(pen)ctx.lineTo(x,y);else ctx.moveTo(x,y);pen=true;}ctx.stroke();
  }
 }
}

return {meshPreview, fleetGeometry, Renderer, CompatRenderer, meshSolidCutter, meshReferenceHull, meshReferenceFits, meshReferenceHatches, meshReferenceParts, sectionLines, meshHull, meshParts, meshKeel, meshHatches, meshFits, gridLines, shipBounds, lineSet, M4, Geo};
})();

