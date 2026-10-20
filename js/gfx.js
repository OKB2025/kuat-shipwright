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
const PAINT = hex('#c6cbd0'), STRUCT_PAINT = hex('#ced2d6'), STRUCT_DARK = [112, 124, 136];
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
      const uv = ids.map(([a, b]) => [a / (gr.nl - 1) * fr.L / 40, b / (gr.nw - 1) * h.w / 40]);
      let face = C.cross(C.sub(off[1], off[0]), C.sub(off[3], off[0]));
      const order = C.dot(face, h.n) >= 0 ? [0, 1, 2, 3] : [0, 3, 2, 1];
      const nn = ns.reduce((a, b) => C.add(a, b), [0, 0, 0]), nu = C.norm(nn);
      quad(g, order.map(k => off[k]), nu, order.map(k => uv[k]), WHITE, 255);
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
function frameM(f) { const fr = C.FITS[f.k].window ? C.windowFrame(f) : C.fitFrame(f.a); return [fr.fw[0], fr.fw[1], fr.fw[2], fr.up[0], fr.up[1], fr.up[2], fr.rt[0], fr.rt[1], fr.rt[2]]; }
function meshFits(ship, filter, ranges) {
  const g = new Geo(8192), body = FC.body;
  const one = (f) => {
    if(C.FITS[f.k].asset){
      // Model turrets seat on the highest point under their ring; the pedestal
      // fills down to the lowest one so they never hang over a slope or step.
      if(f.float||C.FITS[f.k].casemate||f.localMount||f.mountAxis!=null)return;
      const d=C.fitSpec(f),ph=(f.base||0)+(f.ped||0)-(f.low||0);
      if(ph>0.3)pedestal(g,frameM(f),C.fitOrigin(f),ph,d.r*.72*(f.pedSize||1),f.pedShape,FC.ped,d.r*.8);
      return;
    }
    // Command pods are the bridge drum mesh, drawn with the model fittings.
    if(C.FITS[f.k].window)return;
    const d = C.fitSpec(f), M = frameM(f), o = C.fitOrigin(f), L = d.fm, W = d.wm, h = d.hm, k = f.k;
    // pedestal from below the surface up to the mount
    const ph = f.base + f.ped - (f.low || 0);
    if (ph > 0.3) pedestal(g, M, o, ph, d.r * (d.cat === 'b' ? 0.55 : 0.72) * (f.pedSize || 1), f.pedShape, FC.ped, d.r * 0.8);
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
    if (k === 'msl') {
      box(g, M, o, 0, h * 0.5, 0, L, h, W, FC.dark);
      for (const a of [-0.22, 0.22]) for (const b of [-0.22, 0.22]) box(g, M, o, L * a, h * 1.02, W * b, L * 0.3, h * 0.08, W * 0.3, hex('#1c2024'));
      return;
    }
    if (k === 'pd') {
      cyl(g, M, o, 0, h * 0.18, 0, W * 0.42, W * 0.36, h * 0.36, 1, FC.dark, 10);
      wedge(g, M, o, -L * 0.05, h * 0.56, 0, L * 0.5, h * 0.4, W * 0.44, 0.35, body);
      for (const z of [-0.09, 0.09]) cyl(g, M, o, L * 0.36, h * 0.6, W * z, W * 0.035, W * 0.03, L * 0.5, 0, FC.barrel, 6);
      return;
    }
    if (k === 'trc') {
      cyl(g, M, o, 0, h * 0.2, 0, W * 0.42, W * 0.36, h * 0.4, 1, FC.dark, 12);
      cyl(g, M, o, 0, h * 0.66, 0, W * 0.12, W * 0.46, h * 0.5, 1, body, 16);
      cyl(g, M, o, 0, h * 0.95, 0, W * 0.05, W * 0.05, h * 0.2, 1, FC.ring, 8);
      return;
    }
    // turbolaser / ion turrets: low ring, chamfered housing, barrels
    const nb = d.barrels||2;
    cyl(g, M, o, 0, h * 0.11, 0, W * 0.47, W * 0.44, h * 0.22, 1, FC.dark, 18);
    if (k === 'ion') {
      cyl(g, M, o, -L * 0.04, h * 0.48, 0, W * 0.36, W * 0.28, h * 0.5, 1, body, 16);
      for(const zz of [-W*.14,W*.14]){cyl(g, M, o, L * 0.38, h * 0.52, zz, W * 0.07, W * 0.07, L * 0.72, 0, FC.barrel, 10);
      for (const q of [0.3, 0.5, 0.7]) cyl(g, M, o, L * q, h * 0.52, zz, W * 0.12, W * 0.12, L * 0.04, 0, FC.ring, 10);}
      return;
    }
    wedge(g, M, o, -L * 0.03, h * 0.5, 0, L * 0.7, h * 0.56, W * 0.8, 0.38, body);
    box(g, M, o, -L * 0.3, h * 0.82, W * 0.22, L * 0.12, h * 0.1, W * 0.12, FC.ring);
    const sp = W * 0.56 / nb, br = Math.max(0.25, W * (nb > 2 ? 0.03 : 0.04)), bl = L * 0.9;
    for (let q = 0; q < nb; q++) {
      const zz = (q - (nb - 1) / 2) * sp;
      cyl(g, M, o, L * 0.2 + bl / 2, h * 0.46, zz, br, br * 0.85, bl, 0, FC.barrel, 8);
      cyl(g, M, o, L * 0.2 + bl * 0.08, h * 0.46, zz, br * 1.7, br * 1.7, bl * 0.12, 0, FC.ring, 8);
    }
  };
  for (const f of ship.fits) { if (filter && !filter(f)) continue; const before = g.ni; one(f); if (ranges && g.ni > before) (ranges[f.id] || (ranges[f.id] = [])).push(['fits', before, g.ni - before]); }
  return g;
}

// ---------- WebGL ----------
const VS_MESH = `attribute vec3 aPos;attribute vec3 aNor;attribute vec2 aUv;attribute vec4 aCol;
uniform mat4 uVP;uniform vec3 uOff;uniform vec3 uCenter;uniform float uYaw;uniform vec3 uScl;varying vec3 vN;varying vec2 vUv;varying vec4 vCol;varying vec3 vW;varying vec3 vS;
void main(){float c=cos(uYaw),s=sin(uYaw);vec3 a=aPos*uScl-uCenter;vec3 p=vec3(c*a.x-s*a.z,a.y,s*a.x+c*a.z)+uOff;vW=p;vS=aPos;vN=vec3(c*aNor.x-s*aNor.z,aNor.y,s*aNor.x+c*aNor.z);vUv=aUv;vCol=aCol;gl_Position=uVP*vec4(p,1.0);}`;
const FS_MESH = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uTex;uniform sampler2D uEmiTex;uniform vec3 uL1;uniform vec3 uL2;uniform vec3 uC1;uniform vec3 uC2;
uniform vec3 uSky;uniform vec3 uGnd;uniform vec3 uEye;uniform float uAlpha;uniform float uEmi;uniform vec3 uClip;uniform float uClipOn;uniform float uBack;uniform float uReference;uniform float uPaint;uniform float uRefHull;uniform float uHullLength;
varying vec3 vN;varying vec2 vUv;varying vec4 vCol;varying vec3 vW;varying vec3 vS;
void main(){
if(uClipOn>0.5&&(vS.x>uClip.x||vS.y>uClip.y||vS.z>uClip.z))discard;
vec3 n=normalize(vN);vec3 tx=texture2D(uTex,vUv).rgb;float mask=max(max(texture2D(uEmiTex,vUv).r,texture2D(uEmiTex,vUv).g),texture2D(uEmiTex,vUv).b);float lit=smoothstep(0.035,0.18,mask);if(uReference>0.5&&uReference<1.5)tx=mix(tx,vec3(0.48,0.50,0.51),lit);if(uReference>0.5){bool red=tx.r>tx.g*1.35&&tx.r>tx.b*1.25;if(uPaint<0.5&&red)tx=vec3(min(0.8,tx.r*1.3));if(uPaint>1.5)tx*=uReference>1.5?mix(0.62,1.0,lit):0.62;else if(uPaint>0.5&&uRefHull>0.5&&vS.x>uHullLength*.52&&abs(vS.z)<(uHullLength-vS.x)*.065&&n.y>.4)tx*=vec3(.7,.28,.31);}
vec3 vc=uReference>0.5?vCol.rgb*2.0:vCol.rgb;vec3 base=vc*vc*tx*tx;float ao=vCol.a;
float ef=1.0;
if(!gl_FrontFacing){n=-n;ef=0.0;if(uBack<0.5){base=vec3(0.085,0.092,0.10);}else{base*=0.62;}}
vec3 amb=mix(uGnd,uSky,n.y*0.5+0.5)*ao;float d1=max(dot(n,uL1),0.0);float d2=max(dot(n,uL2),0.0);
vec3 V=normalize(uEye-vW);vec3 H=normalize(uL1+V);float sp=pow(max(dot(n,H),0.0),40.0)*0.22*ao*ef;
vec3 c=base*(amb+uC1*d1*(0.6+0.4*ao)+uC2*d2*ao)+uC1*sp;vec3 e=texture2D(uEmiTex,vUv).rgb;c+=e*e*uEmi*ef;
gl_FragColor=vec4(sqrt(c),uAlpha);}`;
const VS_LINE = `attribute vec3 aPos;attribute vec4 aCol;uniform mat4 uVP;uniform vec3 uOff;varying vec4 vC;
void main(){vC=aCol;gl_Position=uVP*vec4(aPos+uOff,1.0);}`;
const FS_LINE = `precision mediump float;varying vec4 vC;uniform float uA;void main(){gl_FragColor=vec4(vC.rgb,vC.a*uA);}`;
const VS_PT = `attribute vec3 aPos;attribute vec4 aCol;attribute float aSize;uniform mat4 uVP;uniform vec3 uOff;uniform float uScale;uniform float uMin;varying vec4 vC;
void main(){vC=aCol;vec4 p=uVP*vec4(aPos+uOff,1.0);gl_Position=p;gl_PointSize=uScale>0.0?max(uMin,aSize*uScale/max(p.w,0.001)):aSize*uMin;}`;
const FS_PT = `precision mediump float;varying vec4 vC;void main(){float d=length(gl_PointCoord-vec2(0.5))*2.0;float a=1.0-smoothstep(0.0,1.0,d);a*=a;gl_FragColor=vec4(vC.rgb*a*vC.a,1.0);}`;
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
const MESH_TEX = {hull: 'hull', struct: 'struct', keel: 'struct', gen: 'gen', shield: 'shield', hyper: 'hyper', interior:'hyper', engine: 'hull', plant:'hull', nozzle: 'nozzle', hangar: 'hangar', hatchOpen: 'hull', hatchRay: 'ray', fits: 'fits'};
for(const k of ['refHull','refStruct','refEngine','refPlant','refFits','refHatches','previewRef','previewRefFits'])MESH_TEX[k]='reference';
MESH_TEX.preview='struct';MESH_TEX.previewFits='fits';
const BACK_OWN = new Set(['gen', 'shield', 'hyper', 'engine', 'nozzle', 'hangar', 'keel', 'fits', 'preview', 'previewFits']);
const REFERENCE_SHADED = new Set(['refHull','refStruct','refPlant','refFits','refHatches','previewRef','previewRefFits']);
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
    for(const p of [this.pm,this.pl,this.pp,this.pb])if(p?.p)gl.deleteProgram(p.p);
    for(const t of this.ownedTextures||[])gl.deleteTexture(t);if(this.bgBuf)gl.deleteBuffer(this.bgBuf);
  }
  upload(name, geo) {
    const gl = this.gl;
    let m = this.meshes[name];
    if (!m) m = this.meshes[name] = {pos: gl.createBuffer(), nor: gl.createBuffer(), uv: gl.createBuffer(), col: gl.createBuffer(), idx: gl.createBuffer(), count: 0};
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
  setGlow(list) {   // flat [x,y,z,size,...]
    const n = list.length / 4, pos = new Float32Array(n * 3), col = new Uint8Array(n * 4), size = new Float32Array(n);
    for (let k = 0; k < n; k++) { pos[k * 3] = list[k * 4]; pos[k * 3 + 1] = list[k * 4 + 1]; pos[k * 3 + 2] = list[k * 4 + 2]; size[k] = list[k * 4 + 3]; col[k * 4] = 110; col[k * 4 + 1] = 185; col[k * 4 + 2] = 255; col[k * 4 + 3] = 150; }
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
    this.setPoints('stars', pos, col, size);
  }
  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr)), h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
  }
  eye() {
    const c = this.cam, s = Math.sin(c.ph);
    return [c.target[0] + c.r * s * Math.cos(c.th), c.target[1] + c.r * Math.cos(c.ph), c.target[2] + c.r * s * Math.sin(c.th)];
  }
  matrices() {
    const w = this.canvas.width, h = this.canvas.height, c = this.cam;
    const e = this.eye();
    const up = Math.abs(Math.sin(c.ph)) < 1e-3 ? [Math.cos(c.th + Math.PI), 0, Math.sin(c.th + Math.PI)] : [0, 1, 0];
    const P = c.ortho?M4.ortho(2*c.r*Math.tan(c.fov/2),w/h,Math.max(.5,c.r*.02),c.r*8+6000):M4.persp(c.fov, w / h, Math.max(0.5, c.r * 0.02), c.r * 8 + 6000);
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
    this.paint=opt.paint||'neutral';this.hullLength=opt.hullLength||1600;this.sourceRed=opt.reference==='venator';this.meshScale=opt.fleet?null:opt.meshScale||null;this.hidden=opt.fleet?null:opt.hidden||null;
    this.clip = opt.mode === 'cut' ? opt.clip : null;
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
    gl.useProgram(this.pb.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bgBuf); gl.enableVertexAttribArray(this.pb.a.aP); gl.vertexAttribPointer(this.pb.a.aP, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3); gl.disableVertexAttribArray(this.pb.a.aP);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    const e = m.eye;
    this.drawPoints('stars', m, [e[0], e[1], e[2]], this.cam.r * 6 + 3000, 1, true);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    if(opt.fleet){this.drawFleet(m,opt);return true;}
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
      this.drawMesh('hull', m, 0.13, 0.25); this.drawMesh('struct', m, 0.16, 0.25);this.drawMesh('refHull',m,.13,0);this.drawMesh('refStruct',m,.16,0);this.drawMesh('refHatches',m,.3,0);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -2);
      this.drawMesh('hatchOpen', m, 0.45); this.drawMesh('hatchRay', m, 0.45);
      gl.disable(gl.POLYGON_OFFSET_FILL);
    } else {
      const cut = opt.mode === 'cut';
      if (cut) gl.disable(gl.CULL_FACE); else { gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); }
      this.drawMesh('hull', m, 1); this.drawMesh('struct', m, 1);this.drawMesh('refHull',m,1,0);this.drawMesh('refStruct',m,1,0);this.drawMesh('refHatches',m,1,0);
      for (const n of solids) this.drawMesh(n, m, 1);
      this.drawMesh('preview',m,1);this.drawMesh('previewRef',m,1,0);
      if (cut){this.drawMesh('keel', m, 1);this.drawMesh('plant',m,1);this.drawMesh('refPlant',m,1);this.drawMesh('interior',m,1);}
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -2);
      this.drawMesh('hatchOpen', m, 1); this.drawMesh('hatchRay', m, 1);
      gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.disable(gl.CULL_FACE); this.drawMesh('fits', m, 1);this.drawMesh('refFits', m, 1);this.drawMesh('previewFits',m,1);this.drawMesh('previewRefFits',m,1,0);
      this.drawGlow(m);
    }
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.CULL_FACE); gl.depthMask(false);
    if (opt.mode === 'cut') this.drawLines('section', m, 1);
    const cutterClip=this.clip;this.clip=null;
    this.drawMesh('cutter',m,.24,.5);
    gl.disable(gl.DEPTH_TEST);this.drawLines('cutter',m,.38);
    gl.enable(gl.DEPTH_TEST);this.drawLines('cutter',m,1);this.clip=cutterClip;
    gl.disable(gl.DEPTH_TEST); this.drawLines('ghost', m, 0.35);
    gl.enable(gl.DEPTH_TEST); this.drawLines('ghost', m, 1);
    gl.depthMask(true);
    // getError() stalls the GPU pipeline; sample it occasionally.
    this._errCheck=(this._errCheck||0)+1;if(this._errCheck%120===1){const error=gl.getError();if(error===gl.OUT_OF_MEMORY)throw new Error('描画メモリが不足しました');}
    if(gl.isContextLost())return false;return true;
  }
  drawGlow(m) {
    const gl = this.gl; gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
    this.drawPoints('glow', m, this.off, 1, 2, false);
    gl.depthMask(true); gl.disable(gl.BLEND);
  }
  drawMesh(name, m, alpha, emi) {
    const mm = this.meshes[name]; if (!mm || !mm.count) return;
    const gl = this.gl, p = this.pm, tx = this.tex[MESH_TEX[name] || 'hull'];
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(p.u.uVP, false, m.VP); gl.uniform3fv(p.u.uOff, this.off);
    gl.uniform3fv(p.u.uCenter,this.modelCenter||[0,0,0]);gl.uniform1f(p.u.uYaw,this.modelYaw||0);gl.uniform3fv(p.u.uScl,this.meshScale?.[name]||[1,1,1]);
    gl.uniform3fv(p.u.uL1, L1); gl.uniform3fv(p.u.uL2, L2);
    gl.uniform3fv(p.u.uC1, [1.05, 1.0, 0.94]); gl.uniform3fv(p.u.uC2, [0.22, 0.30, 0.42]);
    gl.uniform3fv(p.u.uSky, [0.30, 0.34, 0.40]); gl.uniform3fv(p.u.uGnd, [0.10, 0.11, 0.13]);
    gl.uniform3fv(p.u.uEye, m.eye); gl.uniform1f(p.u.uAlpha, alpha);
    gl.uniform1f(p.u.uPaint,this.paint==='dark'?2:this.paint==='republic'?1:0);gl.uniform1f(p.u.uRefHull,name==='refHull'&&!this.sourceRed?1:0);gl.uniform1f(p.u.uHullLength,this.hullLength||1600);
    gl.uniform1f(p.u.uReference, REFERENCE_SHADED.has(name)?1:name==='refEngine'?2:0);
    gl.uniform1f(p.u.uEmi, (emi == null ? 1 : emi) * (MESH_EMI[name] == null ? 1 : MESH_EMI[name]));
    gl.uniform3fv(p.u.uClip, this.clip || [1e9, 1e9, 1e9]); gl.uniform1f(p.u.uClipOn, this.clip ? 1 : 0); gl.uniform1f(p.u.uBack, BACK_OWN.has(name) ? 1 : 0);
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
function v3MeshParts(ship,opt){
  C.syncCompartments(ship);
  const out={struct:new Geo(2048),gen:new Geo(4096),shield:new Geo(2048),hyper:new Geo(2048),interior:new Geo(2048),engine:new Geo(2048),plant:new Geo(2048),nozzle:new Geo(512),hangar:new Geo(2048)},glow=[];
  const ranges={};
  for(const p of [...ship.parts,...C.enginePaths(ship),...C.weaponCapacitors(ship),...C.commandCompartments(ship)]){
    const before=geoMarks(out);meshOnePart(out,p,ship,opt,glow);markRanges(ranges,p.id,before,out);
  }
  if(opt.habitation&&ship.autoHabitation!==false){const h=C.habitationSpace(ship),d=h.cell.map(v=>v*.46);for(const p of h.points)boxSolid(out.interior,C.sub(p,d),C.add(p,d),[104,159,124],24);}
  return {g:out,glow,ranges};
}
// One part into the group meshes (shared by the full build and the live preview).
function meshOnePart(out,p,ship,opt,glow){
    const k=p.k,d=C.PARTS[k],color=opt.info?.[p.id]?.overlap?[240,91,85]:(opt.coded?d.col:PAINT);
    if(k==='struct'&&(p.form==='reference'&&C.REFERENCE_ASSETS[p.skinAsset]||(p.form==='ellipsoid'&&ship.hullSkin?.enabled)))return;
    if(k==='sensor'&&p.skinAsset)return;
    if(k==='struct'){triangleMesh(out.struct,C.structTriangles(p),p.paint?hex(p.paint):ship.paint==='dark'?STRUCT_DARK:STRUCT_PAINT);if(p.bands)structureBands(p,out.struct);if(p.arcBands&&!ship.solidCuts?.some(c=>ship.hull.assembly||c.structures))arcPaintBands(p,out.struct);return;}
    if(p._packing){triangleMesh(out.interior,p._packing.tris,color,36);return;}
    if(p._clip&&k!=='hangar'){triangleMesh(out.interior,p._clip.tris,color,36);return;}
    if(p.boxSize){const f=p.boxFrame;box(out.interior,[...f.fw,...f.up,...f.rt],p.c,0,0,0,...p.boxSize,color);return;}
    if(k==='machinery'){const target=ship.parts.find(e=>e.id===p.nozzle)?.skinAsset?out.plant:out.engine;for(const s of p.segments||[p.seg])axisFrustum(target,s.a,s.b,s.r0,s.r1,color,false);const s=p.segments?.at(-1)||p.seg;for(let i=0;i<5;i++){const t=(i+.6)/5,at=C.add(s.a,C.mul(s.u,s.l*t));axisFrustum(target,C.sub(at,C.mul(s.u,1.2)),C.add(at,C.mul(s.u,1.2)),s.r1*1.06,s.r1*1.06,[120,132,142],false);}return;}
    if(k==='sensor'){sensorShell(out.struct,p,color);return;}
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
  const T=C.hullGeo(ship).tris,g=new Geo(T.length/3+100),openings=ship.hatches.map(h=>C.openingBounds(ship,h)).filter(Boolean),paint=ship.paint==='dark'?[103,116,129]:[189,193,192];
  for(let i=0;i<T.length;i+=9){const tri=T.subarray(i,i+9),p=[(T[i]+T[i+3]+T[i+6])/3,(T[i+1]+T[i+4]+T[i+7])/3,(T[i+2]+T[i+5]+T[i+8])/3],n=C.norm(C.cross(C.sub(Array.from(tri.slice(3,6)),Array.from(tri.slice(0,3))),C.sub(Array.from(tri.slice(6)),Array.from(tri.slice(0,3)))));
    let color=paint;
    if(openings.some(b=>p.every((v,a)=>v>=b[a]-.1&&v<=b[a+3]+.1)&&[0,1,2].some(a=>[b[a],b[a+3]].some(v=>Math.abs(T[i+a]-v)<.1&&Math.abs(T[i+3+a]-v)<.1&&Math.abs(T[i+6+a]-v)<.1))))color=[48,60,67];
    hullTriangleMesh(g,tri,color,42);
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
      if(p.form==='reference')return;
      if(p.form==='ellipsoid'){if(!ship.hullSkin?.enabled)bulbDetail(p,g);return;}
      if(p.form==='dome'||p.form==='cylinder'||p.form==='cone')return;
      structuralDetail(p,g,Math.max(1,ship.hull.L/3200));const T=C.structTriangles(p),col=p.paint?hex(p.paint):ship.paint==='dark'?[92,103,114]:[156,163,166];
      if(p.ribSpacing){const spacing=Math.max(5,p.ribSpacing),[l,w,h]=p.s;
        for(let x=-l/2+spacing;x<l/2-spacing;x+=spacing)for(const sg of [-1,1]){
          const local=[x,-h*.1,sg*w*.5],c=C.worldStruct(p,local);if(p.form==='box'){const f=C.structFrame(p);box(g,[...f.fw,...f.up,...f.rt],c,0,0,0,1.3,h*.64,1.6,col);}
        }
      }
      // Slim rim seated on the upper contour. Each segment follows the actual chamfered/sloped wall.
      if(!['loft','roundloft','arc','outline'].includes(p.form)&&p.s[2]>8&&p.s[0]>30){const pts=[];for(let i=0;i<T.length;i+=3){const q=Array.from(T.slice(i,i+3));if(C.localStruct(p,q)[1]>p.s[2]/2-.1&&!pts.some(a=>C.len(C.sub(a,q))<.1))pts.push(q);}if(pts.length>3){const hull=convexRim(pts.map(q=>C.localStruct(p,q))).map(q=>C.worldStruct(p,q));pts.length=0;pts.push(...hull);const center=pts.reduce((a,b)=>C.add(a,C.mul(b,1/pts.length)),[0,0,0]);pts.sort((a,b)=>Math.atan2(C.localStruct(p,a)[2],C.localStruct(p,a)[0])-Math.atan2(C.localStruct(p,b)[2],C.localStruct(p,b)[0]));for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];if(C.len(C.sub(a,b))>5)axisFrustum(g,C.add(a,C.mul(C.structFrame(p).up,.25)),C.add(b,C.mul(C.structFrame(p).up,.25)),.55,.55,[110,118,124],false);}}
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
  const g=new Geo(panel.tris.length/3+100),T=panel.tris,offset=[0,0,0],edges=new Map(),face=ship.paint==='republic'&&h.face==='top'?[132,48,56]:ship.paint==='dark'?[103,116,129]:[174,180,184];offset[panel.axis]=panel.side*panel.travel*C.clamp(open,0,1);
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
      if(h.k==='ray'&&open>0&&(!h._doorDetached||h._rayOnly)){const mid=(b[u]+b[u+3])/2,slide=C.slidingHatchSpec(ship,h),half=x=>slide?Math.min(C.openingHalf(b,x,u),slide.travel*open):C.openingHalf(b,x,u)*open,h0=half(x0),h1=half(x1),ps=[sample(x0,mid-h0),sample(x1,mid-h1),sample(x1,mid+h1),sample(x0,mid+h0)];if(ps.every(Boolean))quad(out.ray,ps.map(p=>h._rayInset?C.sub(p,C.mul(h.n,h._rayInset)):p),h.n,[[0,0],[1,0],[1,1],[0,1]],WHITE,255);}
      // Landing deck centerline and bay-side guidance lamps, located down inside the mouth.
      if(axis===1&&h.n[1]>0){const zmid=(b[2]+b[5])/2,y=b[1]+.5;boxSolid(g,[x0,y,zmid-.4],[x1-2,y+.18,zmid+.4],[218,183,94],8);for(const z of [zmid-C.openingHalf(b,x0)+2,zmid+C.openingHalf(b,x0)-2])boxSolid(g,[x0+2,y,z-.4],[x0+3,y+.7,z+.4],[140,206,214],2);}
    }
    if(C.isSlidingHatch(ship,h)&&!h._doorDetached)for(const panel of C.slidingHatchPanels(ship,h))appendGeo(out.open,meshSlidingHatchPanel(ship,h,panel,open));
  }
  return out;
}

function convexRim(points){const a=points.slice().sort((p,q)=>p[0]-q[0]||p[2]-q[2]),cross=(o,a,b)=>(a[0]-o[0])*(b[2]-o[2])-(a[2]-o[2])*(b[0]-o[0]),lo=[],hi=[];for(const p of a){while(lo.length>1&&cross(lo.at(-2),lo.at(-1),p)<=.001)lo.pop();lo.push(p);}for(const p of a.slice().reverse()){while(hi.length>1&&cross(hi.at(-2),hi.at(-1),p)<=.001)hi.pop();hi.push(p);}return lo.slice(0,-1).concat(hi.slice(0,-1));}

function engineBell(out,p,a,b,u,color,glow,ship){
 const r=p.d/2,on=C.engineVented(ship,p)&&!!C.reactorFor(ship,p),f=C.frameAxis(u),throat=C.clamp(p.throatRatio??.34,.18,.8),tip=C.add(a,C.mul(u,C.len(C.sub(b,a))*.16));
 if(!p.skinAsset){
 axisFrustum(out.engine,a,b,r*.6,r,color,false);
 // The inside of the bell must face inward; reversing the axis alone is insufficient.
 axisFrustum(out.engine,b,tip,r*.94,r*throat,[53,67,76],false,true);
 for(let i=0;i<20;i++){const angle=i/20*Math.PI*2,radial=C.add(C.mul(f.v,Math.cos(angle)),C.mul(f.w,Math.sin(angle)));axisFrustum(out.engine,C.add(a,C.mul(radial,r*.62)),C.add(b,C.mul(radial,r*1.015)),Math.max(.25,r*.016),Math.max(.25,r*.018),[105,117,125],false);}
 axisFrustum(out.engine,C.sub(b,C.mul(u,.6)),C.add(b,C.mul(u,.6)),r*1.02,r*1.02,[170,180,184],false);
 }
 const g=on?out.nozzle:out.engine,N=32;g.room(N+2,N*3);const base=g.n;g.v(...tip,...u,.5,.5,on?WHITE:[33,42,47],255);
 for(let i=0;i<=N;i++){const t=i/N*Math.PI*2,q=C.add(tip,C.add(C.mul(f.v,Math.cos(t)*r*throat),C.mul(f.w,Math.sin(t)*r*throat)));g.v(...q,...u,.5+.5*Math.cos(t),.5+.5*Math.sin(t),on?WHITE:[33,42,47],255);}for(let i=0;i<N;i++)g.tri(base,base+i+1,base+i+2);
 if(on)glow.push(...C.add(b,C.mul(u,r*.12)),r*.8);
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

function structureBands(p,g){const T=C.structTriangles(p);for(let i=0;i<T.length;i+=9){const world=[Array.from(T.slice(i,i+3)),Array.from(T.slice(i+3,i+6)),Array.from(T.slice(i+6,i+9))],poly=world.map(q=>C.localStruct(p,q)),n=C.norm(C.cross(C.sub(world[1],world[0]),C.sub(world[2],world[0])));for(const [a,b] of p.bands){const q=C.clipPoly(C.clipPoly(poly,0,(a-.5)*p.s[0],true),0,(b-.5)*p.s[0],false).map(v=>C.add(C.worldStruct(p,v),C.mul(n,.3))),out=[];C.triangulateFan(q,out);triangleMesh(g,out,[55,71,111],42);}}}

function arcPaintBands(p,g){
 const {start,sweep}=C.arcParameters(p),N=Math.ceil(sweep*22),paint={...p,s:[p.s[0]+.7,p.s[1]+.7,p.s[2]+.7]},T=[];
 for(const band of p.arcBands)for(let i=0;i<N;i++)for(let j=0;j<3;j++){
  const a=start+i/N*sweep,an=start+(i+1)/N*sweep,b=C.lerp(...band,j/3)*Math.PI*2,bn=C.lerp(...band,(j+1)/3)*Math.PI*2;
  const ps=[[a,b],[a,bn],[an,bn],[an,b]].map(([a,b])=>C.arcPoint(paint,a,b));C.triangulateFan(ps,T);
 }
 let tris=Float32Array.from(T);for(const m of p._apertures||[])tris=C.subtractBoxMesh(tris,m.b);
 triangleMesh(g,tris,[55,71,111],42);
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
 try{this.upload('hull',meshHull(model));const parts=meshParts(model,{coded:false});for(const name of ['struct','refStruct','gen','shield','hyper','engine','refEngine','nozzle','hangar'])if(parts.g[name])this.upload(name,parts.g[name]);const h=meshHatches(model);this.upload('hatchOpen',h.open);this.upload('hatchRay',h.ray);this.upload('fits',meshFits(model));this.upload('refFits',meshReferenceFits(model));this.upload('refHatches',meshReferenceHatches(model));this.upload('refHull',meshReferenceHull(model));
  for(const hatch of model.hatches){const spec=C.slidingHatchSpec(model,hatch);if(!spec)continue;
   if(hatch.k==='ray'){const name='slideRay_'+hatch.id;MESH_TEX[name]='ray';MESH_EMI[name]=1;this.upload(name,meshHatches({...model,hatches:[{...hatch,_rayOnly:true,_rayInset:5}]}).ray);rays.push({name});}
   if(hatch.skinAsset){for(const side of [-1,1]){const name='refSlideDoor_'+hatch.id+'_'+(side<0?'l':'r');MESH_TEX[name]='reference';MESH_EMI[name]=0;this.upload(name,meshReferenceHatches({...model,_referenceDoorOnly:true,hatches:[{...hatch,open:0,_doorDetached:false,_slideSide:side}]}));doors.push({name,axis:spec.slideAxis,side,travel:spec.travel});}}
   else for(const panel of C.slidingHatchPanels(model,hatch)){const name='slideDoor_'+hatch.id+'_'+(panel.side<0?'l':'r');MESH_EMI[name]=0;this.upload(name,meshSlidingHatchPanel(model,hatch,panel));doors.push({name,axis:panel.axis,side:panel.side,travel:panel.travel});}
  }
  const asset={meshes,doors,rays,center,glow:parts.glow,bounds:b,paint:ship.paint,reference:ship.reference,length:ship.hull.L};this.fleetCache.set(key,asset);return asset;}catch(e){for(const m of Object.values(meshes))for(const k of ['pos','nor','uv','col','idx'])this.gl.deleteBuffer(m[k]);throw e;}finally{this.meshes=old;}
};
// Fleet geometry is built by the background engine; the renderer only uploads it.
function fleetGeometry(ship){
 const sliding=ship.hatches.some(h=>C.isSlidingHatch(ship,h)),model=sliding?C.serialize(ship):ship;
 if(sliding)for(const h of model.hatches)if(C.isSlidingHatch(model,h)){h.open=1;h._doorDetached=true;}
 const meshes={},b=shipBounds(ship),center=[(b[0]+b[3])/2,(b[1]+b[4])/2,(b[2]+b[5])/2],doors=[],rays=[],put=(name,geo,tex,emi)=>{meshes[name]={geo,tex,emi};};
 put('hull',meshHull(model));const parts=meshParts(model,{coded:false});for(const name of ['struct','refStruct','gen','shield','hyper','engine','refEngine','nozzle','hangar'])if(parts.g[name])put(name,parts.g[name]);
 const h=meshHatches(model);put('hatchOpen',h.open);put('hatchRay',h.ray);put('fits',meshFits(model));put('refFits',meshReferenceFits(model));put('refHatches',meshReferenceHatches(model));put('refHull',meshReferenceHull(model));
 for(const hatch of model.hatches){const spec=C.slidingHatchSpec(model,hatch);if(!spec)continue;
  if(hatch.k==='ray'){const name='slideRay_'+hatch.id;put(name,meshHatches({...model,hatches:[{...hatch,_rayOnly:true,_rayInset:5}]}).ray,'ray',1);rays.push({name});}
  if(hatch.skinAsset){for(const side of [-1,1]){const name='refSlideDoor_'+hatch.id+'_'+(side<0?'l':'r');put(name,meshReferenceHatches({...model,_referenceDoorOnly:true,hatches:[{...hatch,open:0,_doorDetached:false,_slideSide:side}]}),'reference',0);doors.push({name,axis:spec.slideAxis,side,travel:spec.travel});}}
  else for(const panel of C.slidingHatchPanels(model,hatch)){const name='slideDoor_'+hatch.id+'_'+(panel.side<0?'l':'r');put(name,meshSlidingHatchPanel(model,hatch,panel),null,0);doors.push({name,axis:panel.axis,side:panel.side,travel:panel.travel});}
 }
 return {meshes,doors,rays,center,glow:parts.glow,bounds:b,paint:ship.paint,reference:ship.reference,length:ship.hull.L};
}
Renderer.prototype.loadFleet=function(key,data){
 this.fleetCache=this.fleetCache||new Map();if(this.fleetCache.has(key))return this.fleetCache.get(key);
 const old=this.meshes,meshes={};this.meshes=meshes;
 try{for(const [name,m] of Object.entries(data.meshes)){if(m.tex)MESH_TEX[name]=m.tex;if(m.emi!=null)MESH_EMI[name]=m.emi;if(m.geo)this.upload(name,m.geo);}
  const asset={meshes,doors:data.doors,rays:data.rays,center:data.center,glow:data.glow,bounds:data.bounds,paint:data.paint,reference:data.reference,length:data.length};this.fleetCache.set(key,asset);return asset;}
 catch(e){for(const m of Object.values(meshes))for(const k of ['pos','nor','uv','col','idx'])this.gl.deleteBuffer(m[k]);throw e;}finally{this.meshes=old;}
};
Renderer.prototype.pruneFleet=function(keys){if(!this.fleetCache)return;for(const [k,a] of this.fleetCache)if(!keys.has(k)){for(const m of Object.values(a.meshes))for(const n of ['pos','nor','uv','col','idx'])this.gl.deleteBuffer(m[n]);this.fleetCache.delete(k);}};
Renderer.prototype.drawFleet=function(m,opt){
 const gl=this.gl,old=this.meshes,off=this.off;gl.disable(gl.BLEND);gl.depthMask(true);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);this.clip=null;
 try{for(const u of opt.fleet){if(u.dead)continue;const a=this.fleetCache?.get(u.key);if(!a)continue;this.meshes=a.meshes;this.off=u.pos;this.modelCenter=a.center;this.modelYaw=u.yaw||0;this.paint=a.paint||'neutral';this.sourceRed=a.reference==='venator';this.hullLength=a.length;
  for(const n of ['hull','struct','refHull','refStruct','refHatches','gen','shield','hyper','engine','refEngine','nozzle','hangar'])this.drawMesh(n,m,1);
  const open=opt.mode==='review'?0:C.clamp(u.hatchOpen??0,0,1),c=Math.cos(this.modelYaw),s=Math.sin(this.modelYaw);for(const door of a.doors||[]){const delta=[0,0,0];delta[door.axis]=door.side*door.travel*open;this.off=[u.pos[0]+c*delta[0]-s*delta[2],u.pos[1]+delta[1],u.pos[2]+s*delta[0]+c*delta[2]];this.drawMesh(door.name,m,1,0);}this.off=u.pos;
  gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(-1,-2);this.drawMesh('hatchOpen',m,1);this.drawMesh('hatchRay',m,1);gl.disable(gl.POLYGON_OFFSET_FILL);if(open>0)for(const ray of a.rays||[])this.drawMesh(ray.name,m,1);gl.disable(gl.CULL_FACE);this.drawMesh('fits',m,1);this.drawMesh('refFits',m,1);gl.enable(gl.CULL_FACE);
 }}finally{this.meshes=old;this.off=off;this.modelCenter=null;this.modelYaw=0;}
 gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.disable(gl.CULL_FACE);this.drawLines('fleetGrid',m,.65);gl.disable(gl.DEPTH_TEST);this.drawLines('fleetOrders',m,.8);gl.enable(gl.DEPTH_TEST);this.drawLines('fleetShots',m,1);
 const glow=[];for(const u of opt.fleet){if(u.dead)continue;const a=this.fleetCache?.get(u.key);if(!a)continue;const c=Math.cos(u.yaw),s=Math.sin(u.yaw);for(let i=0;i<a.glow.length;i+=4){const x=a.glow[i]-a.center[0],y=a.glow[i+1]-a.center[1],z=a.glow[i+2]-a.center[2];glow.push(u.pos[0]+c*x-s*z,u.pos[1]+y,u.pos[2]+s*x+c*z,a.glow[i+3]);}}
 const pos=new Float32Array(glow.length/4*3),col=new Uint8Array(glow.length),size=new Float32Array(glow.length/4);for(let i=0;i<size.length;i++){pos.set(glow.slice(i*4,i*4+3),i*3);col.set([110,185,255,150],i*4);size[i]=glow[i*4+3];}this.setPoints('fleetGlow',pos,col,size);gl.blendFunc(gl.ONE,gl.ONE);this.drawPoints('fleetGlow',m,[0,0,0],1,2,false);gl.depthMask(true);
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
 setGlow(list){const pos=[],col=[],size=[];for(let i=0;i<list.length;i+=4){pos.push(...list.slice(i,i+3));col.push(110,185,255,150);size.push(list[i+3]);}this.setPoints('glow',pos,col,size);}
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
  const external=['hull','struct','refHull','refStruct','refHatches','gen','shield','hyper','engine','refEngine','nozzle','hangar','fits','refFits','hatchOpen','hatchRay','preview','previewRef','previewFits','previewRefFits'];
  const inside=['keel','plant','refPlant','interior'];
  if(opt.fleet){for(const unit of opt.fleet){if(unit.dead)continue;const a=this.fleetCache.get(unit.key);if(!a)continue;for(const name of external)this.rasterMesh(a.meshes[name]?.geo,name,1,null,{off:unit.pos,center:a.center,yaw:unit.yaw||0});for(const e of a.extra||[])this.rasterMesh(e.geo,e.name.startsWith('ref')?'refFits':'hull',1,null,{off:unit.pos,center:a.center,yaw:unit.yaw||0});}}
  else {
   const clip=opt.mode==='cut'?opt.clip:null,translucent=new Set(['hull','struct','refHull','refStruct','refHatches','hatchOpen','hatchRay']);
   if(opt.mode==='xray'){
    for(const name of [...external.filter(n=>!translucent.has(n)),...inside])this.rasterMesh(this.meshes[name]?.geo,name,1,clip);
    for(const name of external.filter(n=>translucent.has(n)))this.rasterMesh(this.meshes[name]?.geo,name,.20,clip);
   }else for(const name of [...external,...(opt.mode==='cut'?inside:[])])this.rasterMesh(this.meshes[name]?.geo,name,1,clip);
   this.rasterMesh(this.meshes.cutter?.geo,'cutter',.28,null);
  }
  ctx.putImageData(image,0,0);
  for(const name of opt.fleet?['fleetGrid','fleetOrders','fleetShots']:['grid',...(opt.mode==='cut'?['section']:[]),'ghost','cutter'])this.paintLines(name,name==='grid'||name==='fleetGrid');
  delete this._frame;this.frames++;return true;
 }
 rasterMesh(g,name,alpha,clip,transform){
  if(!g?.ni)return;const colScale=REFERENCE_SHADED.has(name)||name==='refEngine'?2:1;const {w,h,m,pixels,depth}=this._frame,off=transform?.off||this.off,center=transform?.center||[0,0,0],yaw=transform?.yaw||0,cs=Math.cos(yaw),sn=Math.sin(yaw),M=m.VP;
  const projected=new Float32Array(g.n*4);
  for(let i=0;i<g.n;i++){let x=g.pos[i*3]-center[0],y=g.pos[i*3+1]-center[1],z=g.pos[i*3+2]-center[2];const xx=cs*x-sn*z+off[0];z=sn*x+cs*z+off[2];x=xx;y+=off[1];const cw=M[3]*x+M[7]*y+M[11]*z+M[15],k=i*4;projected[k]=((M[0]*x+M[4]*y+M[8]*z+M[12])/cw+1)*w*.5;projected[k+1]=(1-(M[1]*x+M[5]*y+M[9]*z+M[13])/cw)*h*.5;projected[k+2]=(M[2]*x+M[6]*y+M[10]*z+M[14])/cw;projected[k+3]=cw;}
  for(let t=0;t<g.ni;t+=3){
   const a=g.idx[t],b=g.idx[t+1],c=g.idx[t+2],ai=a*4,bi=b*4,ci=c*4;
   if(projected[ai+3]<=0||projected[bi+3]<=0||projected[ci+3]<=0)continue;
   if(clip&&[0,1,2].some(ax=>g.pos[a*3+ax]>clip[ax]&&g.pos[b*3+ax]>clip[ax]&&g.pos[c*3+ax]>clip[ax]))continue;
   const ax=projected[ai],ay=projected[ai+1],bx=projected[bi],by=projected[bi+1],cx=projected[ci],cy=projected[ci+1];
   const det=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);if(!Number.isFinite(det)||Math.abs(det)<.001)continue;
   if(!clip&&alpha===1&&det>0&&!['fits','refFits','hatchRay'].includes(name))continue;
   const x0=Math.max(0,Math.floor(Math.min(ax,bx,cx))),x1=Math.min(w-1,Math.ceil(Math.max(ax,bx,cx))),y0=Math.max(0,Math.floor(Math.min(ay,by,cy))),y1=Math.min(h-1,Math.ceil(Math.max(ay,by,cy)));if(x1<x0||y1<y0)continue;
   let nx=(g.nor[a*3]+g.nor[b*3]+g.nor[c*3])/381,ny=(g.nor[a*3+1]+g.nor[b*3+1]+g.nor[c*3+1])/381,nz=(g.nor[a*3+2]+g.nor[b*3+2]+g.nor[c*3+2])/381;const nxx=cs*nx-sn*nz;nz=sn*nx+cs*nz;nx=nxx;
   const light=Math.max(.24,Math.min(1.15,.48+nx*.20+ny*.48+nz*.12)),color=[0,1,2].map(j=>Math.min(255,Math.max(0,(g.col[ai+j]+g.col[bi+j]+g.col[ci+j])/3*light*colScale)));
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
