/* ============================================================
   gfx.js — small WebGL1 renderer for the smooth-hull shipyard.
   Lofted hull mesh with crease-aware normals, solid compartment
   meshes, tiling procedural panel textures, fittings with auto
   pedestals, decal hatches, section clipping, glow, lines.
   ============================================================ */
const Gfx = (() => {
'use strict';
const C = Core;
const isStructuralPart = p => typeof C.isStructuralPart === 'function' ? C.isStructuralPart(p) : p?.k === 'struct';

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
// One seamless material atlas, built at renderer startup rather than while a
// design is edited. Shared, jittered cuts allow plates to join across a cell;
// the suppressed internal edges produce L-shaped and stepped interlocks.
function armorTexture() {
  const S=1024,N=24,R=rng(145141137),a=document.createElement('canvas');a.width=a.height=S;const g=a.getContext('2d'),owner=new Int16Array(N*N).fill(-1),groups=[],axis=()=>Array.from({length:N+1},(_,i)=>i===0?0:i===N?S:(i+(R()-.5)*.48)*S/N),X=axis(),Y=axis(),wrap=x=>(x+N)%N,at=(x,y)=>wrap(y)*N+wrap(x);
  const candidates=Array.from({length:N*N},(_,i)=>i);for(let i=candidates.length-1;i>0;i--){const j=Math.floor(R()*(i+1));[candidates[i],candidates[j]]=[candidates[j],candidates[i]];}
  const place=(x,y,w,h,notch)=>{const cells=[];for(let j=0;j<h;j++)for(let i=0;i<w;i++){if(notch&&i===w-1&&j===h-1)continue;if(owner[at(x+i,y+j)]>=0)return false;cells.push([wrap(x+i),wrap(y+j)]);}const id=groups.length;for(const [i,j]of cells)owner[at(i,j)]=id;groups.push({cells,tone:199+R()*18,step:R()>.58});return true;};
  for(const id of candidates){const x=id%N,y=Math.floor(id/N);if(owner[id]>=0)continue;for(let attempt=0;attempt<8;attempt++){const w=2+Math.floor(R()*4),h=1+Math.floor(R()*4);if(place(x,y,w,h,w>2&&h>1&&R()<.48))break;}}
  // Small gaps become short neighboring plates, never a second fine grid.
  for(const id of candidates)if(owner[id]<0){const x=id%N,y=Math.floor(id/N);if(!place(x,y,2,1,false)&&!place(x,y,1,2,false))place(x,y,1,1,false);}
  for(const q of groups){g.fillStyle=sh(q.tone);for(const [x,y]of q.cells)g.fillRect(X[x]-.2,Y[y]-.2,X[x+1]-X[x]+.4,Y[y+1]-Y[y]+.4);}
  // Hairline joints retain grey material rather than baking black cavities.
  // A few wider bright/dark pairs suggest overlapping armor lips.
  const edge=(a,b,q)=>{g.lineCap='butt';g.strokeStyle=sh(q.tone-35);g.lineWidth=q.step?1.6:1.05;g.beginPath();g.moveTo(...a);g.lineTo(...b);g.stroke();if(q.step){g.strokeStyle=sh(Math.min(231,q.tone+13));g.lineWidth=1.25;g.beginPath();g.moveTo(a[0]+1.45,a[1]+1.45);g.lineTo(b[0]+1.45,b[1]+1.45);g.stroke();}};
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){const id=owner[at(x,y)],q=groups[id];if(id!==owner[at(x-1,y)]){edge([X[x],Y[y]],[X[x],Y[y+1]],q);if(x===0)edge([S,Y[y]],[S,Y[y+1]],q);}if(id!==owner[at(x,y-1)]){edge([X[x],Y[y]],[X[x+1],Y[y]],q);if(y===0)edge([X[x],S],[X[x+1],S],q);}}
  for(const q of groups){if(q.cells.length<3||R()>.22)continue;const [i,j]=q.cells[Math.floor(R()*q.cells.length)],x=X[i]+(X[i+1]-X[i])*.23,y=Y[j]+(Y[j+1]-Y[j])*.24,w=8+R()*14,h=6+R()*11;g.fillStyle=sh(q.tone-5);g.fillRect(x,y,w,h);g.strokeStyle=sh(q.tone-25);g.lineWidth=.8;g.strokeRect(x,y,w,h);g.fillStyle=sh(q.tone+9);g.fillRect(x+.8,y+h-1,w-.8,.8);if(R()>.55){g.fillStyle=sh(q.tone-22);g.fillRect(x+w*.62,y+h*.3,1.2,h*.4);}}
  return {a,e:pair(2,2).e};
}
// One small deterministic, mipmapped atlas shared by all machinery bays.
// Grilles, conduits and cabinets are paint detail; no downloaded assets or
// per-device textures are required. Neutral greys retain the host paint hue.
function machineryTexture(){
 const S=256,p=pair(S),g=p.g,R=rng(73109);g.fillStyle=sh(175);g.fillRect(0,0,S,S);
 for(let row=0;row<4;row++)for(let col=0;col<8;col++){
  const x=col*32+3,y=row*64+5,w=22+R()*5,h=35+R()*17,tone=185+R()*35;
  g.fillStyle=sh(105);g.fillRect(x+2,y+3,w,h);g.fillStyle=sh(tone);g.fillRect(x,y,w,h);
  g.fillStyle=sh(tone+12);g.fillRect(x,y,w,1);g.fillStyle=sh(110);g.fillRect(x+w-2,y+2,2,h-2);
  if(R()<.65){g.fillStyle=sh(123);for(let k=5;k<h-4;k+=5)g.fillRect(x+4,y+k,w-8,2);}
  else {g.fillStyle=sh(151);g.fillRect(x+4,y+6,w-8,h*.4);g.fillStyle=sh(223);g.fillRect(x+5,y+h-7,4,2);}
  g.fillStyle=sh(125);g.fillRect(col*32,row*64+59,32,3);g.fillStyle=sh(206);g.fillRect(col*32,row*64+58,32,1);
 }
 return {a:p.a,e:pair(2,2).e};
}
function makeTextures() {
  const T = {}, R = rng(1977);
  T.armor=armorTexture();
  T.surface=machineryTexture();
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
// Deck seams are intersections with ship X/Z planes, keeping their plan-view
// directions fore-and-aft/transverse on slopes. Wall U is truly horizontal
// in the face; V remains absolute ship height, never a tilted local UV axis.
function hullUV(nx, ny, nz) {
  const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
  if (ay >= ax && ay >= az) return p => [p[0], p[2]];
  const l=Math.hypot(nx,nz)||1,ux=nz/l,uz=-nx/l;return p=>[p[0]*ux+p[2]*uz,p[1]];
}
// Vertex byte251 opts native armor into the ship-coordinate material. Other
// instruments in the same draw batch retain their original atlas and shading.
function hullTriangleMesh(g, T, col, scale=48,alpha=251) {
  const nt = Math.floor(T.length / 9); if (!nt) return; g.room(nt * 3, nt * 3);
  for (let i = 0; i < nt * 9; i += 9) {
    const a = [T[i], T[i + 1], T[i + 2]], b = [T[i + 3], T[i + 4], T[i + 5]], c = [T[i + 6], T[i + 7], T[i + 8]], n = C.cross(C.sub(b, a), C.sub(c, a)), l = Math.hypot(n[0], n[1], n[2]) || 1, uv = hullUV(n[0], n[1], n[2]), k = g.n;
    for (const p of [a, b, c]) { const q = uv(p); g.v(p[0], p[1], p[2], n[0] / l, n[1] / l, n[2] / l, q[0] / scale, q[1] / scale, col, alpha); }
    g.tri(k, k + 1, k + 2);
  }
}
function hullQuad(g,points,normal,color,scale=48,alpha=251){const uv=hullUV(...normal);quad(g,points,normal,points.map(p=>uv(p).map(x=>x/scale)),color,alpha);}
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
      g.v(p[0], p[1], p[2], n[0], n[1], n[2], uv[0] / TS, uv[1] / TS, PAINT, 251);
    }
    g.tri(base, base + 1, base + 2); g.tri(base, base + 2, base + 3);
  }
  // end caps
  for (const i of [0, S - 1]) {
    const s = secs[i]; if (s.area < 1e-3) continue;
    let cz = 0, cy = 0; for (let j = 0; j < N; j++) { cz += s.Z[j]; cy += s.Y[j]; } cz /= N; cy /= N;
    const nx = i === 0 ? -1 : 1, base = g.n;
    g.room(N + 1, N * 3);
    g.v(xs[i], cy, cz, nx, 0, 0, cz / TS, cy / TS, PAINT, 251);
    for (let j = 0; j < N; j++) g.v(xs[i], s.Y[j], s.Z[j], nx, 0, 0, s.Z[j] / TS, s.Y[j] / TS, PAINT, 251);
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
// Reuse radial samples across repeated equipment. These are draw meshes only;
// Core retains the analytic dimensions used by volume, support and picking.
const ROUND_CIRCLES=new Map();
function roundCircle(segments){
 let circle=ROUND_CIRCLES.get(segments);if(!circle){circle=Array.from({length:segments+1},(_,i)=>{const a=i/segments*Math.PI*2;return [Math.cos(a),Math.sin(a)];});ROUND_CIRCLES.set(segments,circle);}return circle;
}
function radialSegments(radius){return radius>40?24:radius>8?16:12;}
function sphere(g, c, r, col, ru, rv) {
  const nl = r > 60 ? 16 : 12, nm = nl * 2, base = g.n, circle=roundCircle(nm);
  g.room((nl + 1) * (nm + 1), nl * nm * 6);
  for (let i = 0; i <= nl; i++) {
    const th = i / nl * Math.PI, st = i===0||i===nl?0:Math.sin(th), ct = Math.cos(th);
    for (let j = 0; j <= nm; j++) {
      const n = [st * circle[j][0], ct, st * circle[j][1]];
      g.v(c[0] + n[0] * r, c[1] + n[1] * r, c[2] + n[2] * r, n[0], n[1], n[2], j / nm * ru, i / nl * rv, col, 255);
    }
  }
  for (let i = 0; i < nl; i++) for (let j = 0; j < nm; j++) {
    const a = base + i * (nm + 1) + j, b = a + 1, d = a + nm + 1, cc = d + 1;
    if(i>0)g.tri(a, b, cc);if(i+1<nl)g.tri(a, cc, d);
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
  const seg = radialSegments(rad), x0 = c[0] - l / 2, x1 = c[0] + l / 2, base = g.n, circle=roundCircle(seg);
  g.room((seg + 1) * 2, seg * 6);
  for (let k = 0; k <= seg; k++) {
    const [cy,sz] = circle[k];
    g.v(x0, c[1] + cy * rad, c[2] + sz * rad, 0, cy, sz, k / seg * ru, 0, col, 255);
    g.v(x1, c[1] + cy * rad, c[2] + sz * rad, 0, cy, sz, k / seg * ru, rv, col, 255);
  }
  for (let k = 0; k < seg; k++) { const v00 = base + k * 2, v10 = v00 + 1, v01 = v00 + 2, v11 = v00 + 3; g.tri(v00, v01, v11); g.tri(v00, v11, v10); }
  for (const [x, sgn, on] of [[x1, 1, caps.front], [x0, -1, caps.back]]) {
    if (!on) continue;
    const tg = on === true ? g : on.g, cc = on === true ? col : on.col, b = tg.n;
    tg.room(seg + 2, seg * 3);
    tg.v(x, c[1], c[2], sgn, 0, 0, 0.5, 0.5, cc, 255);
    for (let k = 0; k <= seg; k++) { const [cy,sz]=circle[k];tg.v(x, c[1] + cy * rad, c[2] + sz * rad, sgn, 0, 0, 0.5 + 0.5 * cy, 0.5 + 0.5 * sz, cc, 255); }
    for (let k = 0; k < seg; k++) { if (sgn > 0) tg.tri(b, b + 1 + k, b + 2 + k); else tg.tri(b, b + 2 + k, b + 1 + k); }
  }
}
function engineVents(ship, pt) {
  const m = C.partDims(pt), ex = [pt.c[0] - m.l / 2 - m.rad * 0.25, pt.c[1], pt.c[2]];
  if (C.inEnv(ship, ex)) return false;
  for (const q of ship.parts) if (q !== pt && !C.isShapePart(q) && C.inPart(q, ex)) return false;
  return true;
}
function baseMeshParts(ship, opt) {
  const coded = opt.coded, out = {struct: new Geo(1024), gen: new Geo(4096), shield: new Geo(4096), hyper: new Geo(2048), engine: new Geo(2048), nozzle: new Geo(512), hangar: new Geo(2048)};
  const glow = [];
  const colOf = (k) => coded ? C.PARTS[k].col : (k === 'hangar' ? [210, 214, 218] : PAINT);
  for (const pt of ship.parts) {
    const k = pt.k;
    if (C.isShapeKind(k)) { triangleMesh(out.struct,C.structTriangles(pt),STRUCT_PAINT); continue; }
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
  cyl(g, M, o, 0, -ph / 2, 0, pr * 1.18, pr, ph, 1, col, 12);
  if (ph > flare) cyl(g, M, o, 0, -ph * 0.8, 0, pr * 1.45, pr * 1.2, ph * 0.4, 1, col, 12);
}
// The automatic foundation follows the actual hull below the stationary
// turntable. Core also uses these triangles for bounds and support volume.
function turretSupportMesh(g, support) {
  const T = support?.triangles;
  if (!T?.length) return;
  g.room(T.length / 3, T.length / 3);
  for (let i = 0; i + 8 < T.length; i += 9) {
    const a = [T[i], T[i + 1], T[i + 2]], b = [T[i + 3], T[i + 4], T[i + 5]], c = [T[i + 6], T[i + 7], T[i + 8]], cross = C.cross(C.sub(b, a), C.sub(c, a));
    if (C.len(cross) < 1e-10) continue;
    const n = C.norm(cross), k = g.n;
    for (const p of [a, b, c]) g.v(p[0], p[1], p[2], n[0], n[1], n[2], 0.25, 0.5, FC.ped, 240);
    g.tri(k, k + 1, k + 2);
  }
}
const fitPedestalHeight = f => f.mountSupport ? (f.ped || 0) : (f.base || 0) + (f.ped || 0) - (f.low || 0);
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
  if(!(len>0)||!(r0>0||r1>0))return;
  seg = seg || 12;
  const circle=roundCircle(seg),slope=(r0-r1)/len,pt=(k,along,r)=>{const [c,s]=circle[k];return axis===0?[cx+along,cy+c*r,cz+s*r]:[cx+c*r,cy+along,cz+s*r];},base=g.n;
  g.room((seg+1)*2+(r0>0?seg+2:0)+(r1>0?seg+2:0),seg*12);
  for(let k=0;k<=seg;k++){
    const [c,s]=circle[k],n=mv(M,C.norm(axis===0?[slope,c,s]:[c,slope,s]));
    for(const [along,r]of [[-len/2,r0],[len/2,r1]])g.v(...mx(M,o,pt(k,along,r)),...n,.25,.5,col,240);
  }
  for(let k=0;k<seg;k++){
    const a=base+k*2,b=a+1,c=a+2,d=a+3;
    if(axis===0){if(r1>0)g.tri(a,d,b);if(r0>0)g.tri(a,c,d);}else{if(r1>0)g.tri(a,b,d);if(r0>0)g.tri(a,d,c);}
  }
  // Separate cap rings retain the hard rim while sharing their fan vertices.
  for(const [along,r,sgn]of [[len/2,r1,1],[-len/2,r0,-1]]){
    if(!(r>0))continue;const cap=g.n,n=mv(M,axis===0?[sgn,0,0]:[0,sgn,0]);
    g.v(...mx(M,o,axis===0?[cx+along,cy,cz]:[cx,cy+along,cz]),...n,.25,.5,col,240);
    for(let k=0;k<=seg;k++)g.v(...mx(M,o,pt(k,along,r)),...n,.25,.5,col,240);
    for(let k=0;k<seg;k++)if((axis===0)===(sgn>0))g.tri(cap,cap+k+1,cap+k+2);else g.tri(cap,cap+k+2,cap+k+1);
  }
}
// Ion tubes have a thick root that visibly narrows toward the muzzle. The
// small collar surrounds an annulus, inner wall and recessed bore floor.
function ionBarrel(g,M,o,root,tip,y,z,nominal,col,seg=12){
 const length=tip-root,base=nominal*2.2,r=nominal*1.25,recess=Math.min(length*.24,Math.max(r*1.5,length*.035)),collar=tip-Math.min(length*.08,Math.max(r*.8,length*.06)),profile=[[root,0],[root,base],[root+length*.18,base],[collar,r],[collar,r*1.1],[tip,r*1.1],[tip,r*.66],[tip-recess,r*.66],[tip-recess,0]],rings=profile.map(([x,r])=>r?Array.from({length:seg},(_,i)=>mx(M,o,[x,y+r*Math.cos(i/seg*Math.PI*2),z+r*Math.sin(i/seg*Math.PI*2)])):[mx(M,o,[x,y,z])]);
 for(let k=1;k<rings.length;k++){const a=rings[k-1],b=rings[k];for(let i=0;i<seg;i++){const j=(i+1)%seg,ps=a.length===1?[a[0],b[j],b[i]]:b.length===1?[a[i],a[j],b[0]]:[a[i],a[j],b[j],b[i]],n=C.norm(C.cross(C.sub(ps[1],ps[0]),C.sub(ps[2],ps[0])));
  if(ps.length===4)quad(g,ps,n,[[UV_WHITE[0],UV_WHITE[1]],[UV_WHITE[2],UV_WHITE[1]],[UV_WHITE[2],UV_WHITE[3]],[UV_WHITE[0],UV_WHITE[3]]],col,240);else{g.room(3,3);const start=g.n;for(const p of ps)g.v(...p,...n,UV_WHITE[0],UV_WHITE[1],col,240);g.tri(start,start+1,start+2);}
 }}
}
// Dome in the fitting frame: a half-ellipsoid (radius r, height ry) on its base
// ring at (cx,cy,cz), closed underneath.
function domeL(g, M, o, cx, cy, cz, r, ry, col, seg, rings) {
  seg = seg || 12; rings = rings || 4;
  const circle=roundCircle(seg),base=g.n;
  g.room((rings+1)*(seg+1)+seg+1,(rings*2+1)*seg*3);
  for(let j=0;j<=rings;j++){
    const b=j/rings*Math.PI/2,cb=j===rings?0:Math.cos(b),sb=Math.sin(b);
    for(let i=0;i<=seg;i++){
      const [ca,sa]=circle[i],p=mx(M,o,[cx+ca*cb*r,cy+sb*ry,cz+sa*cb*r]),n=mv(M,C.norm([ca*cb/r,sb/ry,sa*cb/r]));
      g.v(...p,...n,.25,.5,col,240);
    }
  }
  for(let j=0;j<rings;j++)for(let i=0;i<seg;i++){const a=base+j*(seg+1)+i,b=a+seg+1;if(j+1<rings)g.tri(a,b,b+1);g.tri(a,b+1,a+1);}
  const c = mx(M, o, [cx, cy, cz]), dn = mv(M, [0, -1, 0]);g.room(seg + 1); const b = g.n;
  g.v(c[0], c[1], c[2], dn[0], dn[1], dn[2], 0.25, 0.5, col, 240);
  for (let i = 0; i < seg; i++) { const [ca,sa]=circle[i],p=mx(M,o,[cx+ca*r,cy,cz+sa*r]);g.v(...p,...dn,.25,.5,col,240); }
  for (let i = 0; i < seg; i++) g.tri(b, b + 1 + i, b + 1 + (i + 1) % seg);
}
// A frame pitched up by ang about the local Z axis at a local origin.
function subFrame(M, o, at, ang) {
  const c = Math.cos(ang), s = Math.sin(ang), x = mv(M, [c, s, 0]), y = mv(M, [-s, c, 0]), z = mv(M, [0, 0, 1]);
  return [[x[0], x[1], x[2], y[0], y[1], y[2], z[0], z[1], z[2]], mx(M, o, at)];
}
function frameM(f) { const fr = C.FITS[f.k].window ? C.windowFrame(f) : C.fitFrameOf(f); return [fr.fw[0], fr.fw[1], fr.fw[2], fr.up[0], fr.up[1], fr.up[2], fr.rt[0], fr.rt[1], fr.rt[2]]; }
let FIT_SKIP_BODY = null, FIT_SKIP_PED = null;
const embeddedSurfaceFit=f=>!!(f?.surfacePatch&&C.FITS[f.k]?.cat==='w'&&!C.FITS[f.k]?.exposedSurfaceTurret);
// Trench groups are compact weapon records. Their occupied charging rooms
// use the interior compartment pass; the guns have no exterior model.
const noModelFit=f=>C.isTrenchBatteryGroup?.(f)===true;
function surfaceRenderFits(ship){const derived=C.surfaceDerivedFits?.(ship);if(!derived?.length)return ship.fits||[];const ids=new Set(derived.map(f=>f.id));return [...(ship.fits||[]).filter(f=>!ids.has(f.id)),...derived];}
// A surface battery is an opening in its host wall. Its visible bore stays
// behind the shallow lip; the shared Core geometry owns the actual muzzle.
function surfaceBatteryMesh(g,f,ship){
 const p=C.surfaceBatteryGeometry?.(f);if(!p||f.float||f.surfaceUnplaced)return;
 if(p.vls){
  // A VLS belongs to the equipment face: six shallow deck hatches, with no
  // freestanding launcher body above the ship's silhouette.
  const rt=C.cross(p.u,p.normal),M=[...p.u,...p.normal,...rt],w=p.width,h=p.height,lip=p.lip,paint=surfaceHostPaint(ship,{host:f.surfacePatch.split(':')[0]});
  box(g,M,p.point,0,lip*.18,0,w,lip*.36,h,surfacePaintTone(paint,.86));
  for(const x of [-w/3,0,w/3])for(const z of [-h/4,h/4]){
   box(g,M,p.point,x,lip*.48,z,w*.29,lip*.20,h*.42,FC.ring);
   box(g,M,p.point,x,lip*.61,z,w*.25,lip*.10,h*.35,FC.dark);
   box(g,M,p.point,x,lip*.68,z,w*.014,lip*.025,h*.34,FC.ring);
  }
  return;
 }
 const {point,normal:n,u,v,width:w,height:h}=p,lip=Math.max(.025,C.dot(C.sub(p.mouth,point),n)),rim=Math.min(w*.08,h*.11,.18),back=Math.min(.018,lip*.30),paint=surfaceHostPaint(ship,{host:f.surfacePatch.split(':')[0]}),at=(x,y,z)=>C.add(point,C.add(C.add(C.mul(u,x),C.mul(v,y)),C.mul(n,z))),outer=[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]],inner=[[-w/2+rim,-h/2+rim],[w/2-rim,-h/2+rim],[w/2-rim,h/2-rim],[-w/2+rim,h/2-rim]];
 quad(g,inner.map(([x,y])=>at(x,y,back)),n,UV_WHITE,[15,20,26],255);
 for(let i=0;i<4;i++){const j=(i+1)%4,a=at(...outer[i],lip),b=at(...outer[j],lip),c=at(...inner[j],back),d=at(...inner[i],back),sn=C.norm(C.cross(C.sub(b,a),C.sub(d,a)));quad(g,[a,b,c,d],sn,UV_WHITE,surfacePaintTone(paint,.86),255);}
 const rows=p.barrels>4?2:1,per=Math.ceil(Math.min(16,p.barrels||1)/rows),iw=w-rim*2,ih=h-rim*2,r=Math.max(.025,Math.min(.13,iw/(per*3.1),ih/(rows*3.2)));
 for(let i=0;i<Math.min(16,p.barrels||1);i++){const x=(i%per-(per-1)/2)*iw/per*.86,y=(Math.floor(i/per)-(rows-1)/2)*ih/(rows+1);axisFrustum(g,at(x,y,back+.002),at(x,y,back+.008),r*1.30,r*1.30,[69,78,86],true,false,8);axisFrustum(g,at(x,y,back+.009),at(x,y,back+.011),r,r,[8,12,17],true,false,8);}
}
// Compact aircraft pods and repeated ship cells use the same Core descriptor,
// including their actual muzzles, launch direction and per-round range. Craft
// keep their selected stores instead of inheriting the ship-cell payload.
function craftLaunchers(model){
 const craft=!!C.isCraft(model),L=craft&&C.craftLoadout?C.craftLoadout(model):null,ld=L?.stations?.length?C.normalizeLoad(L.stations,L.load,L.load):[],out=[];
 for(const f of surfaceRenderFits(model)){const d=C.FITS[f.k];if(!d||f.float)continue;
  if(C.isConcussionLauncher(f)){
   let launcher=C.missileLauncherSpec(f);if(!launcher)continue;
   const i=craft?(L?.stations||[]).findIndex(st=>C.isConcussionLauncher(st.fit)):-1;
   if(i>=0){const q=ld[i],o=C.ORDNANCE[q?.k];if(!o?.guided||!(q.n>0))continue;launcher={...launcher,tt:o.tt,ion:!!o.ion,kind:q.k,range:o.range,speed:o.speed,ammo:q.n,ammo0:q.n};}
   out.push(launcher);continue;
  }
  if(!craft||!d.store)continue;const i=(L?.stations||[]).findIndex(st=>st.fit===f.k),q=ld[i],o=C.ORDNANCE[q?.k];if(!o?.guided||!(q.n>0))continue;
  const fr=C.fitFrameOf(f);out.push({id:f.id,origin:C.add(C.fitOrigin(f),C.mul(fr.up,d.hm*.5)),axis:fr.fw,salvo:1,cycle:1.2,tt:o.tt,ion:!!o.ion,kind:q.k,range:o.range,speed:o.speed,ammo:q.n,ammo0:q.n});}
 return out;
}
function broadsideBatteryMesh(g,f){
 const p=C.broadsideBatteryGeometry?.(f);if(!p||f.float||f.surfaceUnplaced)return;
 const M=[...p.u,...p.normal,...p.v],o=p.point,L=p.width,W=p.height,h=p.depth,lip=p.lip,up=p.v[1]<0?-1:1;
 // Retain the casemate's armored wall frame, dark embrasure and short hood.
 // Guns stay inside the compartment; the window plane owns their emitters.
 box(g,M,o,0,h/2,0,L,h,W,FC.ring);
 box(g,M,o,0,h+lip/2,0,L*.70,lip,W*.58,[12,16,20]);
 box(g,M,o,0,h*.66,up*W*.36,L*.86,h*.68,W*.16,FC.body);
}
function concussionLauncherMesh(g,f){
 const p=C.launcherGeometry(f),[L,h,W]=p.bodySize,M=[...p.bodyFrame.fw,...p.bodyFrame.up,...p.bodyFrame.rt];
 if(p.shipLauncher){shipLauncherMesh(g,f,p);return;}
 // The body remains the aircraft's compact twin-mouth launch tube. Only the
 // hinge frame changes; supports stay in the fixed mounting frame.
 box(g,M,p.bodyCenter,0,0,0,L,h,W,FC.body);
 for(const z of [-W*.22,W*.22])cyl(g,M,p.bodyCenter,L*.49,0,z,W*.18,W*.18,L*.04,0,FC.dark,10);
 if(Math.abs(p.pitchDeg)>1e-9){
  const B=[...p.baseFrame.fw,...p.baseFrame.up,...p.baseFrame.rt],t=p.baseThickness,pivotY=C.dot(C.sub(p.pivot,p.baseOrigin),p.baseFrame.up),height=Math.max(0,pivotY-t);
  box(g,B,p.baseOrigin,0,t/2,0,L*.5,t,W*1.35,FC.ped);
  for(const z of [-W*.6,W*.6])box(g,B,p.baseOrigin,0,t+height/2,z,L*.16,height,W*.15,FC.ring);
  const axle=C.mul(p.baseFrame.rt,W*.675);axisFrustum(g,C.sub(p.pivot,axle),C.add(p.pivot,axle),W*.12,W*.12,FC.dark,true,false,12);
 }
}
// Repeated ship cells share a real open-front box. The dark rear panel and
// dividers lie behind the mouths; no solid front quad seals the launch path.
function shipLauncherMesh(g,f,p=C.launcherGeometry(f)){
 const [L,H,W]=p.bodySize,M=[...p.bodyFrame.fw,...p.bodyFrame.up,...p.bodyFrame.rt],o=p.bodyCenter,t=.035;
 box(g,M,o,-L/2+t/2,0,0,t,H,W,FC.body);
 box(g,M,o,-L/2+t+.008,0,0,.016,H-t*2,W-t*2,FC.dark);
 for(const sign of [-1,1]){box(g,M,o,0,sign*(H-t)/2,0,L,t,W,FC.body);box(g,M,o,0,0,sign*(W-t)/2,L,H-t*2,t,FC.body);}
 const rows=p.rows||1,cols=p.cols||1,ch=H/rows,cw=W/cols;
 for(let i=1;i<rows;i++)box(g,M,o,0,-H/2+i*ch,0,L,t,W-t*2,FC.ring);
 for(let i=1;i<cols;i++)box(g,M,o,0,0,-W/2+i*cw,L,H-t*2,t,FC.ring);
 for(let r=0;r<=rows;r++)box(g,M,o,L/2+.005,C.clamp(-H/2+r*ch,-(H-t)/2,(H-t)/2),0,.02,t,W,FC.ring);
 for(let c=0;c<=cols;c++)box(g,M,o,L/2+.005,0,C.clamp(-W/2+c*cw,-(W-t)/2,(W-t)/2),.02,H-t*2,t,FC.ring);
 if(!p.embedded&&p.supportHeight>0&&p.baseThickness>0){
  const rt=p.bodyFrame.rt,fw=C.norm(C.cross(p.baseFrame.up,rt)),B=[...fw,...p.baseFrame.up,...rt],base=p.baseOrigin,th=p.baseThickness,pivotY=C.dot(C.sub(p.pivot,base),p.baseFrame.up),height=Math.max(0,pivotY-th);
  box(g,B,base,0,th/2,0,L*.5,th,W*1.35,FC.ped);
  for(const z of [-W*.6,W*.6])box(g,B,base,0,th+height/2,z,L*.16,height,W*.15,FC.ring);
  const axle=C.mul(rt,W*.675);axisFrustum(g,C.sub(p.pivot,axle),C.add(p.pivot,axle),W*.12,W*.12,FC.dark,true,false,12);
 }
}
// v21 Starfighter and small-craft weapons, in the fitting's frame (x to the bow, y up from the mount).
function craftWeaponMesh(g,f){
 const d=C.fitSpec(f),M=frameM(f),o=C.fitOrigin(f),L=d.fm,W=d.wm,h=d.hm,k=f.k,B=FC.barrel,D=FC.dark,R=FC.ring,Bd=FC.body;
 if(C.isConcussionLauncher(f)){concussionLauncherMesh(g,f);return;}
 if(k==='claser'||k==='claserH'){box(g,M,o,-L*.22,h*.5,0,L*.36,h*.9,W,Bd);cyl(g,M,o,L*.2,h*.5,0,W*.3,W*.24,L*.62,0,B,8);for(const q of [.02,.24])cyl(g,M,o,L*q,h*.5,0,W*.42,W*.42,L*.05,0,R,8);cyl(g,M,o,L*.5,h*.5,0,W*.34,W*.34,L*.06,0,D,8);return;}
 if(k==='cion'){box(g,M,o,-L*.18,h*.5,0,L*.5,h,W,Bd);ionBarrel(g,M,o,-L*.03,L*.47,h*.5,0,W*.21,B);return;}
 if(k==='cturret'){cyl(g,M,o,0,h*.15,0,W*.5,W*.46,h*.3,1,D,10);domeL(g,M,o,0,h*.3,0,W*.42,h*.5,Bd,12,3);for(const zz of [-W*.14,W*.14])cyl(g,M,o,L*.38,h*.55,zz,W*.06,W*.05,L*.6,0,B,6);return;}
 if(k==='ctorp'){box(g,M,o,0,h*.5,0,L,h,W,Bd);cyl(g,M,o,L*.49,h*.5,0,W*.32,W*.32,L*.04,0,D,10);return;}
 if(k==='cbomb'){box(g,M,o,0,h*.5,0,L,h,W,D);box(g,M,o,0,h*.02,0,L*.92,h*.06,W*.9,R);box(g,M,o,0,h*.03,0,L*.02,h*.07,W*.92,D);return;}
 // v22 A wing pylon: the streamlined pylon and its ejector rack, with the stores it carries by default (two thin
 // missiles side by side, or one torpedo or bomb) hanging under it at their true size (C.ORDNANCE).
 if(k==='cpylon'){box(g,M,o,0,h*.5,0,L,h,W,Bd);box(g,M,o,0,h*.98,0,L*.7,h*.08,W*1.6,D);
  const q=f._store||(C.STORE_DEFAULT?.cpylon?{k:C.STORE_DEFAULT.cpylon[0],n:C.STORE_DEFAULT.cpylon[1]}:null),od=q&&C.ORDNANCE?.[q.k];if(!od)return;const n=Math.min(q.n,C.storeCapacity(d.store,q.k)),[rl,rd]=od.dims,zs=n>1?[-rd*.6,rd*.6]:[0];
  for(let i=0;i<n;i++){const z=zs[i]??0,y=h+rd*.55;cyl(g,M,o,-rl*.07,y,z,rd*.5,rd*.5,rl*.86,0,od.ion?R:FC.glass,10);cyl(g,M,o,rl*.43,y,z,rd*.5,rd*.08,rl*.14,0,od.ion?FC.glass:R,10);}}
}
function meshFits(ship, filter, ranges, only, paintSource=false) {
  const g = new Geo(paintSource?64:only?.length===1?128:8192), body = FC.body;
  const one = (f) => {
    if(noModelFit(f))return;
    if (!paintSource && !f.float && !FIT_SKIP_PED?.has(f.id)) turretSupportMesh(g, C.turretSupportGeometry?.(f));
    if(f.k==='broadsideBattery'){if(!FIT_SKIP_BODY?.has(f.id))broadsideBatteryMesh(g,f);return;}
    if(embeddedSurfaceFit(f)){surfaceBatteryMesh(g,f,ship);return;}
    // These small turrets share the authored guns' paint and texture pass. The
    // source-only call below still uses the same inexpensive procedural shape.
    if(!paintSource&&sharedProceduralTurret(f)){
      const d=C.fitSpec(f),ph=fitPedestalHeight(f);
      if(ph>0.3&&C.fitHasPedestal(f)&&!FIT_SKIP_PED?.has(f.id))pedestal(g,frameM(f),C.fitOrigin(f),ph,d.r*.72*(f.pedSize||1),f.pedShape,FC.ped,d.r*.8);
      return;
    }
    if(C.FITS[f.k].asset){
      // A manual pedestal sits above the automatic hull-following foundation.
      if(f.float)return;
      const d=C.fitSpec(f),ph=fitPedestalHeight(f);
      if(!d.casemate&&(f.mountSupport||!f.localMount&&f.mountAxis==null)&&ph>0.3&&C.fitHasPedestal(f)&&!FIT_SKIP_PED?.has(f.id))pedestal(g,frameM(f),C.fitOrigin(f),ph,d.r*.72*(f.pedSize||1),f.pedShape,FC.ped,d.r*.8);
      if(plainFitAsset(f)&&!familyReferenceAsset(f)&&!FIT_SKIP_BODY?.has(f.id))appendPlainFit(g,f);
      return;
    }
    // Command pods are the bridge drum mesh, drawn with the model fittings.
    if(C.FITS[f.k].window)return;
    if(C.isConcussionLauncher(f)){if(!FIT_SKIP_BODY?.has(f.id))concussionLauncherMesh(g,f);return;}
    // v21 Craft weapons sit flush on their mount (no pedestal): barrels and launchers along the bow.
    if(C.FITS[f.k].craft){if(!FIT_SKIP_BODY?.has(f.id))craftWeaponMesh(g,f);return;}
    const d = C.fitSpec(f), M = frameM(f), o = C.fitOrigin(f), L = d.fm, W = d.wm, h = d.hm, k = f.k;
    // pedestal from below the surface up to the mount
    const ph = fitPedestalHeight(f);
    if (ph > 0.3 && C.fitHasPedestal(f) && !FIT_SKIP_PED?.has(f.id)) pedestal(g, M, o, ph, d.r * (d.cat === 'b' ? 0.55 : 0.72) * (f.pedSize || 1), f.pedShape, FC.ped, d.r * 0.8);
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
    if (k === 'itl') {
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
      const up = M[7] < 0 ? -1 : 1, br = Math.max(.22*C.weaponModelScale(f), W * .05), bl = h * .62, y0 = Math.min(1.2*C.weaponModelScale(f), h * .1);
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
        if(k==='ionL')ionBarrel(g,M,o,L*.17,L*.79,h*.5,zz,W*.045,FC.barrel);
        else{cyl(g,M,o,L*.48,h*.5,zz,W*.055,W*.05,L*.62,0,FC.barrel,8);for(const q of [.3,.46,.62])cyl(g,M,o,L*q,h*.5,zz,W*.09,W*.09,L*.035,0,FC.ring,8);}
      }
      return;
    }
    // Turbolaser turrets. Many barrels (quad and up) sit in two rows.
    const big = d.r/C.weaponModelScale(f) > 14, hexBase = nb <= 3;
    cyl(g, M, o, 0, h * 0.07, 0, W * 0.5, W * 0.47, h * 0.14, 1, FC.dark, hexBase ? 6 : 10);
    cyl(g, M, o, 0, h * 0.17, 0, W * 0.41, W * 0.41, h * 0.07, 1, FC.ring, 12);
    wedge(g, M, o, -L * 0.07, h * 0.47, 0, L * 0.66, h * 0.54, W * (nb > 3 ? 0.72 : 0.8), 0.42, body);
    box(g, M, o, -L * 0.3, h * 0.8, 0, L * 0.18, h * 0.13, W * 0.34, body);
    if (big) for (const sg of [-1, 1]) box(g, M, o, -L * 0.12, h * 0.5, sg * W * 0.41, L * 0.34, h * 0.24, W * 0.04, FC.ring);
    const rows = nb > 3 ? 2 : 1, per = Math.ceil(nb / rows), sp = W * (nb > 3 ? 0.62 : 0.58) / Math.max(per, 2), br = Math.max(0.22*C.weaponModelScale(f), W * (nb > 3 ? 0.028 : nb > 2 ? 0.036 : 0.045)), bl = L * (nb > 3 ? 0.62 : 0.72);
    box(g, M, o, L * 0.27, h * 0.44, 0, L * 0.08, h * (rows > 1 ? 0.4 : 0.28), Math.min(W * 0.74, sp * per + br * 4), FC.dark);
    for (let q = 0; q < nb; q++) {
      const row = rows > 1 ? Math.floor(q / per) : 0, col = rows > 1 ? q % per : q, zz = (col - (per - 1) / 2) * sp, yy = rows > 1 ? h * (row ? 0.56 : 0.34) : h * 0.44;
      if (nb <= 3) cyl(g, M, o, L * 0.36, yy, zz, br * 1.6, br * 1.5, L * 0.12, 0, FC.ring, 8);
      cyl(g, M, o, L * 0.3 + bl / 2, yy, zz, br, br * 0.85, bl, 0, FC.barrel, nb > 3 ? 6 : 8);
      if (nb <= 3) cyl(g, M, o, L * 0.3 + bl * 0.97, yy, zz, br * 1.3, br * 1.3, bl * 0.06, 0, FC.ring, 8);
    }
  };
  for (const f of only||surfaceRenderFits(ship)) { if (filter && !filter(f)) continue; const before = g.ni; one(f); if (ranges && g.ni > before) (ranges[f.id] || (ranges[f.id] = [])).push(['fits', before, g.ni - before]); }
  return g;
}

// Selection follows the exact visible weapon mesh, including its own broad
// bounds. Empty space in a ring or between barrels is not selectable. A small
// LRU invalidates immediately after a pose or load edit.
const FIT_RAY_CACHE=new Map(),FIT_RAY_BOUNDS=new WeakMap(),FIT_RAY_SOURCES=new WeakMap();
function fitRayColdBounds(f){
 const b=C.fitAABB(f),s=C.fitSpec(f);
 if(C.FITS[f.k].asset&&C.REFERENCE_ASSETS[f.skinAsset||s.asset]){
  // The reference box already contains the complete articulated asset and
  // automatic foundation. Only its separate manual pedestal needs a union.
  const ph=fitPedestalHeight(f);
  if(!s.casemate&&(f.mountSupport||!f.localMount&&f.mountAxis==null)&&ph>.3&&C.fitHasPedestal(f)){
   const fr=C.fitFrameOf(f),o=C.fitOrigin(f),r=s.r*.72*(f.pedSize||1)*1.45;
   for(const x of [-r,r])for(const y of [-ph,0])for(const z of [-r,r])for(let a=0;a<3;a++){const v=o[a]+fr.fw[a]*x+fr.up[a]*y+fr.rt[a]*z;b[a]=Math.min(b[a],v);b[a+3]=Math.max(b[a+3],v);}
  }
  const eps=Math.max(.01,...b.map(v=>Math.abs(v)*1e-7));return b.map((v,i)=>v+(i<3?-eps:eps));
 }
 const pad=Math.max(.1,(s.fm||0)+(s.wm||0)+(s.hm||0),f.width||0,f.height||0,2*(s.r||0)*Math.max(1,Math.abs(f.pedSize||1)))+Math.abs((f.base||0)+(f.ped||0))+Math.abs(f.low||0);
 return b.map((v,i)=>v+(i<3?-pad:pad));
}
function fitRayAssetMeshes(f,model){
 const spec=C.FITS[f.k],id=f.skinAsset||spec.asset,a=C.REFERENCE_ASSETS[id];if(!spec.asset||!a||embeddedSurfaceFit(f))return null;
 // Picking needs indexed positions, never render normals, UVs or paint. Keep
 // the renderer's exact float positions and all separate support triangles.
 const body=FIT_SKIP_BODY,ped=FIT_SKIP_PED;let support;
 try{FIT_SKIP_BODY=new Set([f.id]);FIT_SKIP_PED=null;support=meshFits(model,null,null,[f]);}finally{FIT_SKIP_BODY=body;FIT_SKIP_PED=ped;}
 if(f.float)return [support];const raw=familyReferenceAsset(f)?turretRenderAsset(id)?.mesh:C.decodeReference(id);if(!raw)return [support];
 const point=plainFitAsset(f)||familyReferenceAsset(f)?fitReferenceTransform(f):v=>C.referenceFitPoint(f,v),pos=new Float32Array(raw.pos.length);
 for(let i=0;i<pos.length;i+=3)pos.set(point([raw.pos[i],raw.pos[i+1],raw.pos[i+2]]),i);
 return [support,{pos,idx:raw.idx,ni:raw.idx.length}];
}
// Core's box ray query reports entry surfaces; inside origins still need the exact mesh test.
const fitRayStartsInside=(o,b)=>o.every((v,a)=>v>=b[a]&&v<=b[a+3]);
function rayFit(o,d,f,maxT){
 if(!f||!C.FITS[f.k]||noModelFit(f)||maxT!=null&&maxT<=1e-6)return null;
 const key=JSON.stringify([f,C.fitSpec(f),f._store],(k,v)=>k.startsWith('_')?undefined:v);let known=FIT_RAY_BOUNDS.get(f);
 // Most pointer rays miss most weapons. Do not construct every visible mesh
 // merely to discover its bounds on the first hover over a large design.
 if(known?.key!==key){known={key,bounds:fitRayColdBounds(f)};FIT_RAY_BOUNDS.set(f,known);}
 if(!fitRayStartsInside(o,known.bounds)){const h=C.rayAABB(o,d,known.bounds);if(!h||maxT!=null&&h.t>=maxT)return null;}let item=FIT_RAY_CACHE.get(f);
 if(!item||item.key!==key){const model={fits:[f],parts:[],paint:'imperial'},source=FIT_RAY_SOURCES.get(f),skipBody=FIT_SKIP_BODY,skipPed=FIT_SKIP_PED;let meshes;
  if(source?.key===key)meshes=source.meshes;else{
   try{FIT_SKIP_BODY=FIT_SKIP_PED=null;meshes=fitRayAssetMeshes(f,model)||[meshFits(model,null,null,[f]),meshReferenceFits(model,null,[f])];}finally{FIT_SKIP_BODY=skipBody;FIT_SKIP_PED=skipPed;}
  }
  const T=new Float32Array(meshes.reduce((n,g)=>n+g.ni*3,0)),bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];let cursor=0;
  for(const g of meshes)for(let i=0;i<g.ni;i++){const k=g.idx[i]*3;for(let a=0;a<3;a++){const v=g.pos[k+a];T[cursor++]=v;bounds[a]=Math.min(bounds[a],v);bounds[a+3]=Math.max(bounds[a+3],v);}}
  item={key,T,bounds};FIT_RAY_BOUNDS.set(f,{key,bounds});FIT_RAY_CACHE.delete(f);FIT_RAY_CACHE.set(f,item);while(FIT_RAY_CACHE.size>48)FIT_RAY_CACHE.delete(FIT_RAY_CACHE.keys().next().value);
 }else{FIT_RAY_CACHE.delete(f);FIT_RAY_CACHE.set(f,item);}
 if(!item.T.length)return null;if(!fitRayStartsInside(o,item.bounds)){const h=C.rayAABB(o,d,item.bounds);if(!h||maxT!=null&&h.t>=maxT)return null;}return C.rayTris(item.T,o,d,maxT);
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
uniform sampler2D uTex;uniform sampler2D uEmiTex;uniform sampler2D uArmorTex;uniform vec3 uL1;uniform vec3 uL2;uniform vec3 uC1;uniform vec3 uC2;
uniform vec3 uSky;uniform vec3 uGnd;uniform vec3 uEye;uniform float uAlpha;uniform float uEmi;uniform vec3 uClip;uniform vec3 uClipLo;uniform float uClipOn;uniform vec4 uSeam;uniform float uChar;uniform float uBack;uniform float uReference;uniform float uPaint;uniform float uRefHull;uniform float uHullLength;uniform float uFlash;uniform vec4 uEmiTint;
uniform vec3 uLightCol;uniform float uLightK;uniform float uPortK;uniform vec2 uPix;uniform float uSkinScale;
uniform sampler2D uShadow;uniform mat4 uShM;uniform vec4 uShTile;uniform vec4 uShK;uniform vec2 uLook;
varying vec3 vN;varying vec2 vUv;varying vec4 vCol;varying vec3 vW;varying vec3 vS;varying vec3 vNS;
float hash12(vec2 p){vec3 q=fract(vec3(p.xyx)*0.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
vec2 plateFootprint(vec2 p){
#ifdef ARMOR_DERIVATIVES
 return max(abs(dFdx(p))+abs(dFdy(p)),vec2(0.0001));
#else
 float mpp=uPix.y>0.0?uPix.y:length(uEye-vW)*uPix.x;
 float facing=max(0.08,abs(dot(normalize(vN),normalize(uEye-vW))));
 return vec2(max(0.0001,mpp/facing));
#endif
}
vec3 filteredDeckPlate(vec3 fine,vec2 p){
 // Mipmaps integrate the actual interlocking outlines, including inspection
 // panels. A grazing footprint fades their contrast before aliasing can turn
 // the joints into a false diagonal network; the old grid never returns.
 vec2 fp=plateFootprint(p);vec3 armor=texture2D(uArmorTex,p/192.0).rgb;
 float contrast=1.0-smoothstep(3.5,16.0,max(fp.x,fp.y));
 return mix(vec3(0.815),armor,contrast);
}
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
vec3 n=normalize(vN),ns=normalize(vNS);vec2 materialUV=vUv;
bool equipmentPlain=vCol.a>248.5/255.0&&vCol.a<249.5/255.0;
bool equipmentTexture=vCol.a>249.5/255.0&&vCol.a<250.5/255.0;
bool armorSurface=vCol.a>250.5/255.0&&vCol.a<251.5/255.0;
bool plainSurface=vCol.a>251.5/255.0&&vCol.a<252.5/255.0;
// Deck/sloped panels retain ship X/Z alignment. A wall uses a truly
// horizontal tangent and absolute height, consistently across triangles.
vec2 armorP=vS.xz;if(abs(ns.y)<abs(ns.x)||abs(ns.y)<abs(ns.z))armorP=vec2(dot(vS.xz,normalize(vec2(ns.z,-ns.x))),vS.y);
vec3 tx=texture2D(uTex,materialUV).rgb;float mask=max(max(texture2D(uEmiTex,materialUV).r,texture2D(uEmiTex,materialUV).g),texture2D(uEmiTex,materialUV).b);float lit=smoothstep(0.035,0.18,mask);if(uReference>0.5&&uReference<1.5)tx=mix(tx,vec3(0.48,0.50,0.51),lit);if(uReference>0.5){bool red=tx.r>tx.g*1.35&&tx.r>tx.b*1.25;if(uPaint<0.5&&red)tx=vec3(min(0.8,tx.r*1.3));if(uPaint>1.5)tx*=uReference>1.5?mix(0.62,1.0,lit):0.62;else if(uPaint>0.5&&uRefHull>0.5&&vS.x>uHullLength*.52&&abs(vS.z)<(uHullLength-vS.x)*.065&&n.y>.4)tx*=vec3(.7,.28,.31);}
if(uSkinScale>0.0&&armorSurface)tx=filteredDeckPlate(tx,armorP);
// Vertex byte 254 marks non-habitable solar surfaces; their frame shares the same material flag.
bool solarSurface=vCol.a>253.5/255.0&&vCol.a<254.5/255.0;
bool surfacePort=vCol.a>252.5/255.0&&vCol.a<253.5/255.0;
if(surfacePort&&uPortK<=0.0)discard;
if(equipmentPlain||surfacePort)tx=vec3(1.0);
vec3 vc=uReference>0.5?vCol.rgb*2.0:vCol.rgb;vec3 base=vc*vc*tx*tx;float ao=equipmentPlain||equipmentTexture||solarSurface||surfacePort||armorSurface||plainSurface?1.0:vCol.a;
float ef=1.0;
if(!gl_FrontFacing){n=-n;ef=0.0;if(uBack<0.5){base=vec3(0.085,0.092,0.10);}else{base*=0.62;}}
vec3 amb=mix(uGnd,uSky,n.y*0.5+0.5)*ao;float d1=max(dot(n,uL1),0.0);float d2=max(dot(n,uL2),0.0);
float sh=1.0;if(uShK.x>0.5&&d1>0.0)sh=shadowK(normalize(vNS)*(gl_FrontFacing?1.0:-1.0),d1);d1*=sh;
vec3 V=normalize(uEye-vW);vec3 H=normalize(uL1+V);float sp=pow(max(dot(n,H),0.0),40.0)*0.22*ao*ef*sh;
vec3 c=base*(amb+uC1*d1*(0.6+0.4*ao)+uC2*d2*ao)+uC1*sp;vec3 e=texture2D(uEmiTex,materialUV).rgb;if(uEmiTint.w>0.5){float l=dot(e,vec3(0.3,0.5,0.2));e=mix(uEmiTint.rgb*min(1.0,l*1.3),vec3(l),smoothstep(0.86,1.0,l)*0.7);}c+=e*e*uEmi*ef;
if(uLightK>0.0&&ef>0.5&&!solarSurface){vec2 pl=shipLights(normalize(vNS));c*=1.0-0.5*pl.y;float lk=uLightK*pl.x;c=mix(c,uLightCol,clamp(lk,0.0,1.0))+uLightCol*(max(0.0,lk-1.0)*0.25);}
// Installed ports and thin-armor light points share one emissive mesh batch.
if(surfacePort&&ef>0.5)c+=vc*vc*uLightCol*uPortK*1.5;
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
// Reject only a complete uploaded mesh outside one camera clip plane. These
// are rendering bounds, not replacement geometry for selection or physics.
// Use the vertex shader's exact scale/centre/rotation/translation order so
// fleet poses, moving turrets and mirrored previews keep their visible faces.
function meshOutsideView(renderer,mesh,matrix,scale){
 const b=mesh.bb,V=matrix?.VP;if(!b||b.length!==6||!V||V.length!==16||!b.every(Number.isFinite)||b.some((v,i)=>i<3&&v>b[i+3]))return false;
 const center=renderer.modelCenter||[0,0,0],R=renderer.modelRot||(renderer.modelYaw?yawMatrix(renderer.modelYaw):MAT3_I),off=renderer.off||[0,0,0],s=scale||[1,1,1];let outside=63;
 // Include terms before cancellation: GPU float32 arithmetic can differ from
 // CPU doubles when a large local coordinate is close to the model centre.
 const ax=Math.max(Math.abs(b[0]*s[0]),Math.abs(b[3]*s[0]))+Math.abs(center[0]),ay=Math.max(Math.abs(b[1]*s[1]),Math.abs(b[4]*s[1]))+Math.abs(center[1]),az=Math.max(Math.abs(b[2]*s[2]),Math.abs(b[5]*s[2]))+Math.abs(center[2]),
  wx=Math.abs(R[0])*ax+Math.abs(R[3])*ay+Math.abs(R[6])*az+Math.abs(off[0]),wy=Math.abs(R[1])*ax+Math.abs(R[4])*ay+Math.abs(R[7])*az+Math.abs(off[1]),wz=Math.abs(R[2])*ax+Math.abs(R[5])*ay+Math.abs(R[8])*az+Math.abs(off[2]),
  slack=1e-5*Math.max(1,...[0,1,2,3].map(i=>Math.abs(V[i])*wx+Math.abs(V[4+i])*wy+Math.abs(V[8+i])*wz+Math.abs(V[12+i])));
 if(!Number.isFinite(slack))return false;
 for(let corner=0;corner<8;corner++){
  const x=b[corner&1?3:0]*s[0]-center[0],y=b[corner&2?4:1]*s[1]-center[1],z=b[corner&4?5:2]*s[2]-center[2],
   px=R[0]*x+R[3]*y+R[6]*z+off[0],py=R[1]*x+R[4]*y+R[7]*z+off[1],pz=R[2]*x+R[5]*y+R[8]*z+off[2],
   cx=V[0]*px+V[4]*py+V[8]*pz+V[12],cy=V[1]*px+V[5]*py+V[9]*pz+V[13],cz=V[2]*px+V[6]*py+V[10]*pz+V[14],cw=V[3]*px+V[7]*py+V[11]*pz+V[15];
  if(!Number.isFinite(cx+cy+cz+cw))return false;
  outside&=(cx< -cw-slack?1:0)|(cx>cw+slack?2:0)|(cy< -cw-slack?4:0)|(cy>cw+slack?8:0)|(cz< -cw-slack?16:0)|(cz>cw+slack?32:0);
  if(!outside)return false;
 }
 return true;
}
// Coruscant for the trial flights: an analytic ecumenopolis sphere drawn per
// pixel behind the ship. Lengths are in planet radii to keep float precision.
const FS_PLANET = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform mat4 uInv;uniform vec3 uEye;uniform vec3 uPC;uniform float uR;uniform vec3 uSun;uniform float uPix;uniform float uKind;uniform vec3 uAxis;uniform vec2 uRing;uniform vec4 uLook;uniform vec4 uStar;uniform vec3 uStarCol;uniform sampler2D uCorDay;uniform sampler2D uCorAux;uniform float uCorOn;varying vec2 vP;
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
// The supplied Coruscant surface: equirectangular about the planet's axis, sampled with the seam kept off the
// texture's wrap (derivatives pick the continuous longitude where they are available).
void corTex(vec3 n,out vec3 day,out vec3 aux){
 vec3 a=normalize(uAxis),e1=normalize(abs(a.y)<0.99?cross(a,vec3(0.0,1.0,0.0)):cross(a,vec3(1.0,0.0,0.0))),e2=cross(a,e1);
 float u=atan(dot(n,e2),dot(n,e1))/6.2831853+0.5,v=0.5-asin(clamp(dot(n,a),-1.0,1.0))/3.14159265;
#ifdef PDERIV
 float u2=fract(u+0.5)-0.5;if(fwidth(u2)<fwidth(u))u=u2;
#endif
 day=texture2D(uCorDay,vec2(u,v)).rgb;aux=texture2D(uCorAux,vec2(u,v)).rgb;}
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
 if(uCorOn>0.5){vec3 td,ta;corTex(n,td,ta);
  // From orbit the supplied surface shows; close in, the city grid keeps its own detail, tinted by it.
  float near=1.0-smoothstep(1500.0,9000.0,foot);vec3 tl=vec3(1.0,0.66,0.32)*ta.r*1.7;
  vec3 texc=td*(0.05+1.05*max(0.0,sun))*day+tl*night+tl*0.05*day;
  vec3 proc=dayc*(0.05+1.05*max(0.0,sun))*day*(0.5+1.4*dot(td,vec3(0.333)))+lightc*night*0.95*(0.25+2.5*ta.r);
  vec3 col=mix(texc,proc,near*0.7);
  vec3 cc=vec3(0.86,0.85,0.83)*(0.04+1.0*max(0.0,sun))*(0.15+0.85*day);return mix(col,cc,ta.g*0.85);}
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
 if(!hit){float limb=B>0.0?length(o):sqrt(max(0.0,dot(o,o)-B*B));
  // A system star seen as a disc (the red dwarf Anza at Abregado): uStar = its direction and the cosine of its
  // angular radius, uStarCol its colour. Its surface churns in slow cells and darkens toward the limb.
  if(uStar.w>0.0){float sd=dot(rd,uStar.xyz),a0=acos(clamp(uStar.w,-1.0,1.0)),a=acos(clamp(sd,-1.0,1.0));
   if(a<a0){vec3 t=normalize(cross(uStar.xyz,abs(uStar.y)<0.9?vec3(0,1,0):vec3(1,0,0))),b2=cross(uStar.xyz,t);vec2 q=vec2(dot(rd,t),dot(rd,b2))/max(1e-4,sin(a0));float mu=sqrt(max(0.0,1.0-dot(q,q)));
    vec3 sp=vec3(q*2.4,mu*2.4);float f1=fbm(sp*1.1+vec3(1.7)),f2=fbm(sp*2.6+vec3(f1*2.2,f1,0.4)),f3=fbm(sp*6.0+vec3(f2*2.5));
    vec3 sc=uStarCol*mix(0.42,1.0,smoothstep(0.25,0.8,f2))*(0.62+0.45*f1+0.2*f3)*pow(mu,0.45);gl_FragColor=vec4(1.0-exp(-sc*1.7),1.0);return;}
   float g=exp(-(a-a0)/max(1e-3,a0*0.32));gl_FragColor=vec4(uStarCol*g*0.9,g*0.8);return;}vec3 cp=B>0.0?o:o-rd*B;float glow=exp(-max(0.0,limb-1.0)*110.0)*smoothstep(-0.35,0.35,dot(normalize(cp),uSun)+0.2);
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
const MESH_TEX = {hull: 'hull', struct: 'struct', plate: 'hull', gen: 'gen', shield: 'shield', hyper: 'hyper', interior:'hyper', engine: 'hull', plant:'hull', nozzle: 'nozzle', hangar: 'hangar', hatchOpen: 'hull', hatchRay: 'ray', fits: 'fits'};
const MESH_SOURCE = {};
Object.assign(MESH_TEX,{surfaceArmor:'hull',surfaceDevices:'surface',surfaceDetail:'surface'});
for(const k of ['refHull','refStruct','refEngine','refPlant','refFits','refHatches','previewRef','previewRefFits'])MESH_TEX[k]='reference';
MESH_TEX.preview='struct';MESH_TEX.previewFits='fits';
const BACK_OWN = new Set(['gen', 'shield', 'hyper', 'engine', 'nozzle', 'hangar', 'fits', 'preview', 'previewFits']);
const REFERENCE_SHADED = new Set(['refHull','refStruct','refPlant','refFits','refHatches','previewRef','previewRefFits']);
// Meshes that carry lit ports, and the port colours a design can choose.
const LIGHT_MESHES = new Set(['hull', 'struct', 'refHull', 'refStruct']);
const SHIP_LIGHTS = {white: [1.0, 0.94, 0.82], blue: [0.34, 0.58, 1.0], warm: [1.0, 0.7, 0.4]};
const MESH_EMI = {hull: 0.9, struct: 1, gen: 1.1, shield: 0.8, hyper: 0.8, interior:0.8, engine: 0, plant:0, nozzle: 1.5, hangar: 0.6, hatchOpen: 1, hatchRay: 1, fits: 0.6};
Object.assign(MESH_EMI,{surfaceArmor:0,surfaceDevices:0,surfaceDetail:0});

for(const k of ['refHull','refStruct','refEngine','refPlant','refFits','refHatches','previewRef','previewRefFits'])MESH_EMI[k]=0;
MESH_EMI.preview=.6;MESH_EMI.previewFits=.6;
MESH_EMI.refEngine=.8;
// Export resolution follows the viewport and device density, independently of adaptive rendering.
// The cap preserves aspect ratio and bounds both GPU attachments and software depth buffers.
function captureDimensions(width,height,scale=2,dpr=1,limits={}){
 if(![1,2,4].includes(scale))throw new RangeError('撮影倍率は1・2・4から選んでください');
 const positive=(v,f)=>Number.isFinite(v)&&v>0?v:f,px=Math.min(2,positive(dpr,1))*scale;
 const w=Math.max(1,Math.round(Math.min(Number.MAX_SAFE_INTEGER,positive(width,1)*px))),h=Math.max(1,Math.round(Math.min(Number.MAX_SAFE_INTEGER,positive(height,1)*px)));
 const maxW=Math.min(8192,positive(limits.maxWidth,8192)),maxH=Math.min(8192,positive(limits.maxHeight,8192)),pixels=positive(limits.maxPixels,24000000);
 const k=Math.min(1,maxW/w,maxH/h,Math.sqrt(pixels/(w*h))),rw=Math.max(1,Math.floor(w*k)),rh=Math.max(1,Math.floor(h*k));
 return {width:rw,height:rh,limited:rw!==w||rh!==h};
}
function rendererCapture(renderer,scale){
 if(renderer.disposed||renderer.gl?.isContextLost())throw new Error('描画画面を利用できません');
 if(!renderer._lastDrawOptions)throw new Error('撮影する描画がまだありません');
 if(renderer._captureSize)throw new Error('撮影処理が実行中です');
 const source=renderer.canvas,size=renderer.captureSize(scale),doc=source.ownerDocument||(typeof document!=='undefined'?document:null);
 const output=doc?.createElement('canvas');if(!output)throw new Error('撮影用の画像を作成できません');
 output.width=size.width;output.height=size.height;const ctx=output.getContext('2d');if(!ctx)throw new Error('撮影用の画像を作成できません');
 const width=source.width,height=source.height,options=renderer._lastDrawOptions,keys=['_captureSize','_captureTime','_capturePointDpr','_lastDrawOptions','rayTime','frames','_errCheck','_frame'];
 const saved=keys.map(key=>({key,own:Object.hasOwn(renderer,key),value:renderer[key]}));let error=null;
 try{
  renderer._captureSize=size;renderer._captureTime=renderer.rayTime??7.3;renderer._capturePointDpr=size.width/Math.max(1,source.clientWidth);
  if(renderer.draw(options)!==true||renderer.gl?.isContextLost()||source.width!==size.width||source.height!==size.height)throw new Error('撮影用の描画に失敗しました');
  if(renderer.gl&&((renderer.gl.drawingBufferWidth!=null&&renderer.gl.drawingBufferWidth!==size.width)||(renderer.gl.drawingBufferHeight!=null&&renderer.gl.drawingBufferHeight!==size.height)))throw new Error('撮影用の描画領域を確保できません');
  ctx.drawImage(source,0,0);
 }catch(e){error=e;}
 finally{
  try{
   const pointDpr=saved.find(entry=>entry.key==='_capturePointDpr');if(pointDpr.own)renderer._capturePointDpr=pointDpr.value;else delete renderer._capturePointDpr;
   renderer._captureSize={width,height};renderer.resize();
   if(!renderer.disposed&&!renderer.gl?.isContextLost()&&renderer.draw(options)!==true)throw new Error('通常表示の再描画に失敗しました');
  }catch(e){if(!error)error=e;}
  finally{
   if(source.width!==width)source.width=width;if(source.height!==height)source.height=height;
   for(const entry of saved)if(entry.own)renderer[entry.key]=entry.value;else delete renderer[entry.key];
  }
 }
 if(error)throw error;return output;
}
class Renderer {
  constructor(canvas) {
    this.canvas = canvas;this.kind='webgl';this.disposed=false;this.ownedTextures=new Set();
    const gl = this.gl = canvas.getContext('webgl', {antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'default'})
      || canvas.getContext('experimental-webgl');
    if (!gl) throw new Error('WebGL が使えません');
    this.u32 = !!gl.getExtension('OES_element_index_uint');
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic') || gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
    this.armorDerivatives=!!gl.getExtension('OES_standard_derivatives');
    this.pm = compile(gl, VS_MESH, this.armorDerivatives?'#extension GL_OES_standard_derivatives : enable\n#define ARMOR_DERIVATIVES\n'+FS_MESH:FS_MESH); this.pl = compile(gl, VS_LINE, FS_LINE);
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
    // The supplied Coruscant surface (data/coruscant.js), when that file is loaded; the procedural city stays otherwise.
    this.corTex={};if(typeof Image!=='undefined'&&typeof YardReferenceData!=='undefined'&&YardReferenceData.coruscant)for(const kind of ['day','aux']){const img=new Image();img.onload=()=>{if(this.disposed||gl.isContextLost())return;let source=img;const max=Math.min(4096,gl.getParameter(gl.MAX_TEXTURE_SIZE));if(img.width>max){source=document.createElement('canvas');source.width=max;source.height=max/2;source.getContext('2d').drawImage(img,0,0,max,max/2);}this.corTex[kind]=tex(source,true);this.onTextureReady?.();};img.src=YardReferenceData.coruscant[kind];}
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
    if(geo.previewToken&&(this.u32||geo.n<65536)){uploadPreviewGeo(this,m,geo);return;}
    delete m.previewToken;delete m.previewRevision;
    // v20.2 A version and a box per mesh: the shadow map is redrawn only when a caster changes.
    m.ver = (m.ver || 0) + 1;
    const supplied=geo.bounds,validBounds=geo.boundsVertexCount===geo.n&&Array.isArray(supplied)&&supplied.length===6&&supplied.every(Number.isFinite)&&supplied.slice(0,3).every((v,a)=>v<=supplied[a+3]);
    if(validBounds)m.bb=geo.n?supplied.slice():null;
    else { const P = geo.pos, b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]; for (let i = 0; i < geo.n * 3; i += 3) for (let k = 0; k < 3; k++) { const v = P[i + k]; if (v < b[k]) b[k] = v; if (v > b[k + 3]) b[k + 3] = v; } m.bb = geo.n ? b : null; }
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
  captureSize(scale=2){
    const gl=this.gl,viewport=gl.getParameter(gl.MAX_VIEWPORT_DIMS),rb=gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),dpr=typeof window!=='undefined'?window.devicePixelRatio:1;
    return captureDimensions(this.canvas.clientWidth,this.canvas.clientHeight,scale,dpr,{maxWidth:Math.min(rb||8192,viewport?.[0]||8192),maxHeight:Math.min(rb||8192,viewport?.[1]||8192)});
  }
  capture(scale=2){return rendererCapture(this,scale);}
  resize() {
    if(this._captureSize){const {width,height}=this._captureSize;if(this.canvas.width!==width)this.canvas.width=width;if(this.canvas.height!==height)this.canvas.height=height;return;}
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
  pickSurface(px,py,ship=this.surfaceShip){const r=this.ray(px,py);return ship&&r&&typeof C.surfacePick==='function'?C.surfacePick(ship,r.o,r.d):null;}
  pickStructureSurface(px,py,ship,parentStructureId,options={}){
    const r=this.ray(px,py);if(!r)return null;
    const candidates=structureSurfaceCandidates(ship,r.o,r.d,parentStructureId,options);
    return candidates[Math.max(0,Math.trunc(options.depthIndex||0))]||null;
  }
  pickPlacementSurface(px,py,ship,options={}){
    const r=this.ray(px,py);if(!r)return null;
    const candidates=placementSurfaceCandidates(ship,r.o,r.d,options);
    return candidates[Math.max(0,Math.trunc(options.depthIndex||0))]||null;
  }
  setPlacementDiagnostics(ship,diagnostics){
    this.placementDiagnostics=diagnostics||null;
    this.setLines('placement-diagnostics',placementDiagnosticLines(ship,diagnostics));
    if(this.upload)this.upload('placement-ghost',placementGhostMesh(ship,diagnostics));
  }
  setSurfaceSelection(ship,ids=[]){this.surfaceShip=ship;this.surfaceSelection=ids.slice();this._surfaceSelection=this.surfaceSelection;this.setLines('surfaces',surfaceSelectionLines(ship,ids));}
  draw(opt={}) {
    const gl = this.gl;if(this.disposed||gl.isContextLost())return false;this.resize();
    if(this._surfaceSelection!==this.surfaceSelection)this.setSurfaceSelection(this.surfaceShip,this.surfaceSelection||[]);
    gl.colorMask(true,true,true,true);gl.depthMask(true);gl.disable(gl.SCISSOR_TEST);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0.02, 0.03, 0.045, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const m = this.matrices();
    // Shields shimmer in the animated fleet and trial views; the editor redraws
    // on demand, so it keeps one still frame of the pattern.
    this.rayTime=this._captureTime??(opt.fleet?(performance.now()/1000)%600:7.3);
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
    if(opt.fleet){this.drawFleet(m,opt);this.shTile=null;if(gl.isContextLost())return false;this._lastDrawOptions=opt;return true;}
    if (this.look.shadow && !this.noShadow) this.shTile = this.shadowDesign(opt);
    this.drawLines('grid', m, 1);
    gl.disable(gl.BLEND); gl.depthMask(true);
    const solids = ['gen', 'shield', 'hyper', 'engine', 'refEngine', 'nozzle', 'hangar'];
    if (opt.mode === 'xray') {
      gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
      for (const n of solids) this.drawMesh(n, m, 1);
      this.drawMesh('plant',m,1);this.drawMesh('refPlant',m,1);this.drawMesh('interior',m,1);this.drawMesh('preview',m,1);this.drawMesh('previewRef',m,1,0);
      gl.disable(gl.CULL_FACE); this.drawMesh('fits', m, 1);this.drawMesh('refFits', m, 1);this.drawMesh('previewFits',m,1);this.drawMesh('previewRefFits',m,1,0);
      this.drawGlow(m);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.enable(gl.CULL_FACE);
      this.drawMesh('hull', m, 0.13, 0.25); this.drawMesh('struct', m, 0.16, 0.25); this.drawMesh('plate', m, 0.16, 0.25);this.drawMesh('refHull',m,.13,0);this.drawMesh('refStruct',m,.16,0);this.drawMesh('refHatches',m,.3,0);
      for(const name of ['surfaceArmor','surfaceDevices','surfaceDetail'])this.drawMesh(name,m,.22,0);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -2);
      this.drawMesh('hatchOpen', m, 0.45);
      gl.disable(gl.POLYGON_OFFSET_FILL);
      this.drawRays(m, ['hatchRay'], 0.8);
    } else {
      const cut = opt.mode === 'cut';
      if (cut) gl.disable(gl.CULL_FACE); else { gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); }
      this.drawMesh('hull', m, 1); this.drawMesh('struct', m, 1); this.drawMesh('plate', m, 1);this.drawMesh('refHull',m,1,0);this.drawMesh('refStruct',m,1,0);this.drawMesh('refHatches',m,1,0);
      for(const name of ['surfaceArmor','surfaceDevices','surfaceDetail'])this.drawMesh(name,m,1,0);
      for (const n of solids) this.drawMesh(n, m, 1);
      this.drawMesh('preview',m,1);this.drawMesh('previewRef',m,1,0);
      if (cut){this.drawMesh('plant',m,1);this.drawMesh('refPlant',m,1);this.drawMesh('interior',m,1);}
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
    gl.disable(gl.DEPTH_TEST); this.drawLines('placement-repeat', m, 0.45);
    gl.enable(gl.DEPTH_TEST); this.drawLines('placement-repeat', m, 1);
    this.drawMesh('placement-ghost',m,.24,.5);
    gl.disable(gl.DEPTH_TEST); this.drawLines('placement-diagnostics', m, 0.35);
    gl.enable(gl.DEPTH_TEST); this.drawLines('placement-diagnostics', m, 1);
    // PLAN-013 vertex handles: always visible, brighter where unoccluded.
    gl.disable(gl.DEPTH_TEST); this.drawLines('verts', m, 0.55);
    gl.enable(gl.DEPTH_TEST); this.drawLines('verts', m, 1);
    this.drawLines('surfaces',m,1);
    gl.depthMask(true); this.shTile = null;
    // getError() stalls the GPU pipeline; sample it occasionally.
    this._errCheck=(this._errCheck||0)+1;if(this._errCheck%120===1){const error=gl.getError();if(error===gl.OUT_OF_MEMORY)throw new Error('描画メモリが不足しました');}
    if(gl.isContextLost())return false;this._lastDrawOptions=opt;return true;
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
    if(meshOutsideView(this,mm,m,this.meshScale?.[name]))return;
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
    if(meshOutsideView(this,mm,m,this.unitScl||this.meshScale?.[name]))return;
    const gl = this.gl, p = this.pm, source=MESH_SOURCE[name]||name, tx = this.tex[MESH_TEX[name] || 'hull'];
    gl.useProgram(p.p);
    const lit=this.lightK>0&&LIGHT_MESHES.has(source)&&(alpha==null||alpha>.9),ports=this.lightK>0&&source==='surfaceDevices'&&(alpha==null||alpha>.9);gl.uniform1f(p.u.uLightK,lit?this.lightK:0);gl.uniform1f(p.u.uPortK,ports?this.lightK:0);
    {const H=Math.max(1,this.canvas.height),t=2*Math.tan((this.cam.fov||.72)/2);gl.uniform2f(p.u.uPix,t/H,this.cam.ortho?t*this.cam.r/H:0);}if(lit||ports)gl.uniform3fv(p.u.uLightCol,this.lightCol);
    gl.uniformMatrix4fv(p.u.uVP, false, m.VP); gl.uniform3fv(p.u.uOff, this.off);
    gl.uniform3fv(p.u.uCenter,this.modelCenter||[0,0,0]);gl.uniformMatrix3fv(p.u.uRot,false,this.modelRot||yawMatrix(this.modelYaw||0));gl.uniform3fv(p.u.uScl,this.unitScl||this.meshScale?.[name]||[1,1,1]);gl.uniform1f(p.u.uFlash,this.unitFlash||0);
    const lk = this.look || LOOKS.flat; gl.uniform3fv(p.u.uL1, lk.L1); gl.uniform3fv(p.u.uL2, lk.L2);
    gl.uniform3fv(p.u.uC1, lk.C1); gl.uniform3fv(p.u.uC2, lk.C2); gl.uniform3fv(p.u.uSky, lk.sky); gl.uniform3fv(p.u.uGnd, lk.gnd); gl.uniform2f(p.u.uLook, lk.tone, lk.exp);
    const sht = this.shTile, SH = this.sh; if (sht && SH && sht.M && !this.unitScl) { gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, SH.t); gl.uniform1i(p.u.uShadow, 2); gl.uniformMatrix4fv(p.u.uShM, false, sht.M); gl.uniform4fv(p.u.uShTile, sht.uv); gl.uniform4f(p.u.uShK, 1, 1 / SH.size, sht.bias, sht.noff); } else gl.uniform4f(p.u.uShK, 0, 0, 0, 0);
    gl.uniform3fv(p.u.uEye, m.eye); gl.uniform1f(p.u.uAlpha, alpha);
    gl.uniform1f(p.u.uPaint,this.paint==='dark'?2:this.paint==='republic'?1:0);gl.uniform1f(p.u.uRefHull,name==='refHull'&&!this.sourceRed?1:0);gl.uniform1f(p.u.uHullLength,this.hullLength||1600);
    gl.uniform1f(p.u.uReference, REFERENCE_SHADED.has(source)||source.startsWith('refTur_')||source.startsWith('refTurBody_')?1:source==='refEngine'?2:0);
    gl.uniform1f(p.u.uSkinScale,source==='surfaceArmor'?30:source==='struct'||source==='hull'||source==='preview'?48:source==='plate'?64:0);
    // v18 Drive nozzles burn in the design's engine colour, brighter with thrust.
    const drive=source==='nozzle'||source==='refEngine',tint=drive?this.engineTint:null;gl.uniform4fv(p.u.uEmiTint,tint?[tint[0]/255,tint[1]/255,tint[2]/255,1]:[1,1,1,0]);
    gl.uniform1f(p.u.uEmi, (emi == null ? 1 : emi) * (MESH_EMI[name] == null ? 1 : MESH_EMI[name]) * (drive ? (this.engineK ?? 1) : 1));
    gl.uniform3fv(p.u.uClip, this.clip || [1e9, 1e9, 1e9]); gl.uniform3fv(p.u.uClipLo, this.clipLo || [-1e9, -1e9, -1e9]); gl.uniform1f(p.u.uClipOn, this.clip || this.clipLo ? 1 : 0); gl.uniform1f(p.u.uBack, BACK_OWN.has(source)||source.startsWith('tur_') ? 1 : 0);
    gl.uniform4fv(p.u.uSeam, this.seam || [0, 0, 1, 0]); gl.uniform1f(p.u.uChar, this.char || 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tx.a); gl.uniform1i(p.u.uTex, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tx.e); gl.uniform1i(p.u.uEmiTex, 1);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.tex.armor?.a||tx.a); gl.uniform1i(p.u.uArmorTex, 3);
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
    if (this.pplanets[pk] === undefined) { try { this.pplanets[pk] = compile(gl, VS_BG, (this.armorDerivatives ? '#extension GL_OES_standard_derivatives : enable\n#define PDERIV\n' : '') + '#define PK ' + pk + '\n' + FS_PLANET); } catch (e) { console.error(e); this.pplanets[pk] = null; } }
    const p = this.pplanets[pk]; if (!p) return;
    const inv = M4.inv(m.VP); if (!inv) return;
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(p.u.uInv, false, inv); gl.uniform3fv(p.u.uEye, m.eye); gl.uniform3fv(p.u.uPC, planet.center); gl.uniform1f(p.u.uR, planet.radius);
    gl.uniform3fv(p.u.uSun, planet.sun); gl.uniform1f(p.u.uPix, 2 * Math.tan(this.cam.fov / 2) / Math.max(1, this.canvas.height));
    gl.uniform1f(p.u.uKind, planet.kind || 0); gl.uniform3fv(p.u.uAxis, planet.axis || [0, 1, 0]); gl.uniform2fv(p.u.uRing, planet.ring || [0, 0]); if (p.u.uLook) gl.uniform4fv(p.u.uLook, planet.look || [0, 0, 0, 0]);
    const cor = pk === 0 && this.corTex?.day && this.corTex?.aux;
    if (p.u.uCorOn) gl.uniform1f(p.u.uCorOn, cor ? 1 : 0);
    if (cor) { gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D, this.corTex.day); gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D, this.corTex.aux); gl.activeTexture(gl.TEXTURE0); gl.uniform1i(p.u.uCorDay, 6); gl.uniform1i(p.u.uCorAux, 7); }
    if (p.u.uStar) gl.uniform4fv(p.u.uStar, planet.star ? [...planet.star.dir, Math.cos(planet.star.ang)] : [0, 0, 0, 0]); if (p.u.uStarCol) gl.uniform3fv(p.u.uStarCol, planet.star?.color || [0, 0, 0]);
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
    gl.uniformMatrix4fv(p.u.uVP, false, VP); gl.uniform1f(p.u.uMin, minPx * (this._capturePointDpr??Math.min(2, window.devicePixelRatio || 1)));
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
SHADOW_CASTERS.push('surfaceArmor','surfaceDevices','surfaceDetail');
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
// Electrical feeds remain physical circuits, like the other equipment's power
// links. Only the separate machinery-to-nozzle drive housings are displayed.
function isHiddenEngineFeed(p){return !!(p?.k==='machinery'&&p.transmission&&!p.drivetrain);}
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
    part(pt, c, ship) {
      if(!C.PARTS[pt.k]&&C.FITS[pt.k]){this.fit(pt,c);return;}
      if(isHiddenEngineFeed(pt))return;
      const support=pt.k==='engine'&&C.engineMountSupportGeometry?.(ship,pt);if(support?.triangles?.length||support?.tris?.length)this.triangles(support.triangles||support.tris,c);
      const weaponBody=C.superweaponShape?.(pt);if(weaponBody){this.part(weaponBody,c);return;}
      if(pt._placementGeometry){this.triangles(C.structTriangles(pt),c);return;}
      if(pt._packing?.tris){this.triangles(pt._packing.tris,c);return;}
      if(pt._packing){for(const b of pt._packing.boxes||[])this.box(b,c);return;}
      if(pt._clip?.tris){this.triangles(pt._clip.tris,c);return;}
      if(pt.k==='sensor'&&pt.skinSize&&pt.placement?.mode==='direct'&&pt.placement.parentStructureId!=null){const a=pt.skinSize,scale=pt.d/Math.max(...a),shape={k:'struct',form:'ellipsoid',c:pt.c,s:[a[0]*scale,a[2]*scale,a[1]*scale],yaw:pt.yaw||0,pitch:pt.pitch||0,roll:pt.roll||0,surfaceNormal:pt.surfaceNormal};this.triangles(C.structTriangles(shape),c);return;}
      const sh = C.PARTS[pt.k].shape;
      if(pt.k==='machinery'){for(const s of pt.segments||[pt.seg]){for(const [end,r] of [[s.a,s.r0],[s.b,s.r1]])this.circle(end,s.v,s.w,r,c,32);for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){const r=C.add(C.mul(s.v,Math.cos(a)),C.mul(s.w,Math.sin(a)));this.seg(C.add(s.a,C.mul(r,s.r0)),C.add(s.b,C.mul(r,s.r1)),c);}}return;}
      if (sh === 'sphere') { const r = pt.d / 2 * 1.02; this.circle(pt.c, [1, 0, 0], [0, 1, 0], r, c); this.circle(pt.c, [1, 0, 0], [0, 0, 1], r, c); this.circle(pt.c, [0, 1, 0], [0, 0, 1], r, c); return; }
      const skin=pt.k==='engine'&&C.engineSkinMesh(pt);
      if(skin){const f=C.frameAxis(skin.u),e0=C.add(pt.c,C.mul(skin.u,skin.t0)),e1=C.add(pt.c,C.mul(skin.u,skin.t1)),r=skin.rad*1.02;for(const e of [e0,e1])this.circle(e,f.v,f.w,r,c,32);for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){const q=C.add(C.mul(f.v,Math.cos(a)*r),C.mul(f.w,Math.sin(a)*r));this.seg(C.add(e0,q),C.add(e1,q),c);}return;}
      if(sh==='cyl'||sh==='engine'){const m=C.partDims(pt),f=C.frameAxis(pt.dir||[1,0,0]);for(const sg of [-1,1])this.circle(C.add(pt.c,C.mul(f.u,sg*m.l/2)),f.v,f.w,m.rad,c,32);for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){const r=C.add(C.mul(f.v,Math.cos(a)*m.rad),C.mul(f.w,Math.sin(a)*m.rad));this.seg(C.add(C.sub(pt.c,C.mul(f.u,m.l/2)),r),C.add(C.add(pt.c,C.mul(f.u,m.l/2)),r),c);}return;}
      if(pt.k==='solarPanel'){const H=C.foilHandles(pt);this.poly(H.points,H.edges,c);return;}
      if(pt.form==='mesh'&&pt.mesh?.f){const scale=[pt.s[0],pt.s[2],pt.s[1]],point=i=>C.worldStruct(pt,pt.mesh.v[i].map((v,k)=>v*scale[k])),seen=new Set();for(const face of pt.mesh.f)for(let i=0;i<face.length;i++){const a=face[i],b=face[(i+1)%face.length],key=Math.min(a,b)+','+Math.max(a,b);if(seen.has(key))continue;seen.add(key);this.seg(point(a),point(b),c);}return;}
      if(C.isHullStructure?.(pt)){const local=C.hullStructureShip(null,pt),g=C.hullGeo(local),world=q=>C.hullWorldPoint(pt,q),rows=pt.hullProfile.stations||[[0],[1]];for(const row of rows){const x=row[0]*pt.s[0],section=C.sampleSection(local,x);for(let i=0;i<section.Z.length;i++)this.seg(world([x,section.Y[i],section.Z[i]]),world([x,section.Y[(i+1)%section.Z.length],section.Z[(i+1)%section.Z.length]]),c);}for(let j=0;j<g.N;j+=Math.max(1,Math.floor(g.N/8)))for(let i=1;i<g.xs.length;i++)this.seg(world([g.xs[i-1],g.secs[i-1].Y[j],g.secs[i-1].Z[j]]),world([g.xs[i],g.secs[i].Y[j],g.secs[i].Z[j]]),c);return;}
      if(C.isShapePart(pt)||pt.room){const T=C.structTriangles(pt.room?C.roomShape(pt):pt);for(let i=0;i<T.length;i+=9){const a=Array.from(T.slice(i,i+3)),b=Array.from(T.slice(i+3,i+6)),d=Array.from(T.slice(i+6,i+9));this.seg(a,b,c);this.seg(b,d,c);this.seg(d,a,c);}return;}
      this.box(C.partAABB(pt), c);
    },
    cross(p, r, c) { this.seg([p[0] - r, p[1], p[2]], [p[0] + r, p[1], p[2]], c); this.seg([p[0], p[1] - r, p[2]], [p[0], p[1] + r, p[2]], c); this.seg([p[0], p[1], p[2] - r], [p[0], p[1], p[2] + r], c); },
    triangles(T,c) { for(let i=0;i+8<T.length;i+=9){const a=T.slice(i,i+3),b=T.slice(i+3,i+6),d=T.slice(i+6,i+9);this.seg(a,b,c);this.seg(b,d,c);this.seg(d,a,c);} },
    fit(f,c,ship) { const g=placementFittingMesh(ship,f);for(let i=0;i<g.ni;i+=3){const P=[0,1,2].map(j=>Array.from(g.pos.subarray(g.idx[i+j]*3,g.idx[i+j]*3+3)));this.seg(P[0],P[1],c);this.seg(P[1],P[2],c);this.seg(P[2],P[0],c);} },
    out() { return {pos: new Float32Array(pos), col: new Uint8Array(col)}; },
  };
}
function niceStep(v) { const e = Math.pow(10, Math.floor(Math.log10(v))), m = v / e; return (m < 1.5 ? 1 : m < 3.5 ? 2.5 : m < 7.5 ? 5 : 10) * e; }
function gridLines(ship, bounds) {
  const envelope = typeof C.designEnvelope === 'function' ? C.designEnvelope(ship) : ship.hull;
  const ls = lineSet(), L = envelope.L, W = Math.max(envelope.W, 40), st = niceStep(L / 14), y = bounds[1] - Math.max(8, envelope.H * 0.18);
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
  if (typeof C.shipBounds === 'function') return C.shipBounds(ship, {fits: surfaceRenderFits(ship)});
  const g = C.hullGeo(ship), b = [0, Infinity, Infinity, ship.hull.L, -Infinity, -Infinity];
  for (const s of g.secs) for (let j = 0; j < s.Y.length; j++) { b[1] = Math.min(b[1], s.Y[j]); b[4] = Math.max(b[4], s.Y[j]); b[2] = Math.min(b[2], s.Z[j]); b[5] = Math.max(b[5], s.Z[j]); }
  const rb=C.referenceHullGeometry(ship)?.bounds;if(rb)for(let k=0;k<3;k++){b[k]=Math.min(b[k],rb[k]);b[k+3]=Math.max(b[k+3],rb[k+3]);}
  // Frame the displayed bells; Core's saved-skin bounds also serve physical statistics.
  for (const pt of ship.parts) { const bounds=[(pt.k==='engine'&&C.engineSkinMesh(pt)?.b)||C.refPartBounds(pt)||C.partAABB(pt)],support=pt.k==='engine'&&C.engineMountSupportGeometry?.(ship,pt);if(support?.bounds)bounds.push(support.bounds);for(const a of bounds)for (let k = 0; k < 3; k++) { b[k] = Math.min(b[k], a[k]); b[k + 3] = Math.max(b[k + 3], a[k + 3]); } }
  for(const pt of C.enginePaths(ship)){if(isHiddenEngineFeed(pt))continue;const a=C.partAABB(pt);for(let k=0;k<3;k++){b[k]=Math.min(b[k],a[k]);b[k+3]=Math.max(b[k+3],a[k+3]);}}
  for (const f of surfaceRenderFits(ship)) { const a = C.fitAABB(f); for (let k = 0; k < 3; k++) { b[k] = Math.min(b[k], a[k]); b[k + 3] = Math.max(b[k + 3], a[k + 3]); } }
  if(ship.surfaces?.patches?.length&&typeof C.surfacePatches==='function')for(const p of C.surfacePatches(ship)){const t=p.config?.armor?.thickness||0;if(!p.exposed||!(t>0)||!ship.surfaces.patches.some(q=>q.id===p.id))continue;const T=surfaceTriangles(p);for(let i=0;i<T.length;i+=3)for(let a=0;a<3;a++){const v=T[i+a]+p.normal[a]*t;b[a]=Math.min(b[a],v);b[a+3]=Math.max(b[a+3],v);}}
  if (!isFinite(b[1])) { b[1] = 0; b[4] = ship.hull.H; b[2] = -ship.hull.W / 2; b[5] = ship.hull.W / 2; }
  return b;
}
function triangleMesh(g,T,col,scale=48,alpha=255){
  // Allocation-free flat-shaded triangles (same output as the per-vertex path).
  const nt=Math.floor(T.length/9);if(!nt)return;g.room(nt*3,nt*3);
  for(let i=0;i<nt*9;i+=9){
    const ax=T[i],ay=T[i+1],az=T[i+2],bx=T[i+3],by=T[i+4],bz=T[i+5],cx=T[i+6],cy=T[i+7],cz=T[i+8];
    const ux=bx-ax,uy=by-ay,uz=bz-az,vx=cx-ax,vy=cy-ay,vz=cz-az;let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const l=Math.hypot(nx,ny,nz)||1;if(Math.abs(l-1)>=1e-12){nx/=l;ny/=l;nz/=l;}
    const k=g.n;g.v(ax,ay,az,nx,ny,nz,ax/scale,(ay+az)/scale,col,alpha);g.v(bx,by,bz,nx,ny,nz,bx/scale,(by+bz)/scale,col,alpha);g.v(cx,cy,cz,nx,ny,nz,cx/scale,(cy+cz)/scale,col,alpha);g.tri(k,k+1,k+2);
  }
}
function axisFrustum(g,a,b,r0,r1,col,caps=true,inward=false,segments){
  const delta=C.sub(b,a),l=C.len(delta);if(!(l>1e-9)||!(r0>0||r1>0))return;
  const f=C.frameAxis(delta),N=segments||radialSegments(Math.max(r0,r1)),circle=roundCircle(N),base=g.n,p=(o,r,i)=>C.add(o,C.add(C.mul(f.v,circle[i][0]*r),C.mul(f.w,circle[i][1]*r)));
  g.room((N+1)*2+(caps?(N+2)*2:0),N*(caps?12:6));
  // Shared side rings use the analytical frustum normal. Smooth lighting keeps
  // the reduced silhouette round; cap vertices stay separate for a hard rim.
  for(let i=0;i<=N;i++){
    const n=C.mul(C.norm(C.add(C.add(C.mul(f.v,circle[i][0]),C.mul(f.w,circle[i][1])),C.mul(f.u,(r0-r1)/l))),inward?-1:1);
    g.v(...p(a,r0,i),...n,i/N*4,0,col,255);g.v(...p(b,r1,i),...n,i/N*4,l/64,col,255);
  }
  const tri=(a,b,c)=>inward?g.tri(c,b,a):g.tri(a,b,c);
  for(let i=0;i<N;i++){const a=base+i*2,b=a+1,c=a+2,d=a+3;if(r0>0)tri(a,c,d);if(r1>0)tri(a,d,b);}
  if(caps)for(const [o,r,sg]of [[a,r0,-1],[b,r1,1]]){
    if(!(r>0)||Array.isArray(caps)&&!caps[sg<0?0:1])continue;
    const cap=g.n,n=C.mul(f.u,sg);g.v(...o,...n,.5,.5,col,255);
    for(let i=0;i<=N;i++)g.v(...p(o,r,i),...n,.5,.5,col,255);
    for(let i=0;i<N;i++)if(sg<0)g.tri(cap,cap+i+2,cap+i+1);else g.tri(cap,cap+i+1,cap+i+2);
  }
}
const CANOPY_GLASS=[46,62,74],ASTRO_DOME=[120,150,196];
function v3MeshParts(ship,opt){
  C.syncCompartments(ship);
  const out={struct:new Geo(2048),plate:new Geo(1024),gen:new Geo(4096),shield:new Geo(2048),hyper:new Geo(2048),interior:new Geo(2048),engine:new Geo(2048),plant:new Geo(2048),nozzle:new Geo(512),hangar:new Geo(2048)},glow=[];
  const ranges={},glowRanges={};
  for(const p of [...ship.parts,...C.enginePaths(ship),...C.weaponCapacitors(ship),...C.missileCells(ship),...C.commandCompartments(ship)]){
    const before=geoMarks(out),start=glow.length;meshOnePart(out,p,ship,opt,glow);markRanges(ranges,p.id,before,out);if(glow.length>start)glowRanges[p.id]=[start,glow.length-start];
  }
  if(opt.habitation&&ship.autoHabitation!==false){const h=C.habitationSpace(ship),d=h.cell.map(v=>v*.2);for(const p of h.points)boxSolid(out.interior,C.sub(p,d),C.add(p,d),[104,159,124],24);
  }
  return {g:out,glow,ranges,glowRanges};
}
// One part into the group meshes (shared by the full build and the live preview).
function meshOnePart(out,p,ship,opt,glow){
    if(isHiddenEngineFeed(p))return;
    const k=p.k,d=C.PARTS[k],color=opt.info?.[p.id]?.overlap?[240,91,85]:(opt.coded?d.col:PAINT);
    if(p.surfacePatch&&p.surfaceUnplaced)return;
    // The foundation is paid, closed Core geometry shared with physical
    // contact and picking. Keep it separate from the bell's skin, dimensions
    // and luminous throat in the full model and every editor preview.
    if(k==='engine'){const support=C.engineMountSupportGeometry?.(ship,p),T=support?.triangles||support?.tris;if(T?.length)hullTriangleMesh(out.struct,T,opt.coded?C.PARTS.struct.col:p.paint?hex(p.paint):ship.paint==='dark'?STRUCT_DARK:ship.paint==='cis'?STRUCT_CIS:STRUCT_PAINT,48);}
    if(p._placementGeometry&&C.isShapePart(p)){
      const T=opt.preview?C.structTriangles(p):equipmentSkinTriangles(ship,'p'+p.id,C.structTriangles(p)),target=p.plate?out.plate:out.struct,tone=opt.coded?d.col:p.paint?hex(p.paint):p.plate?(ship.paint==='dark'?PLATE_DARK:ship.paint==='cis'?PLATE_CIS:PLATE_PAINT):(ship.paint==='dark'?STRUCT_DARK:ship.paint==='cis'?STRUCT_CIS:STRUCT_PAINT);
      hullTriangleMesh(target,T,tone,opt.preview?36:64,opt.preview?251:255);if(p.bands)structureBands(p,target,T);return;
    }
    if(C.isHullStructure?.(p)&&p.hullData?.hullSkin?.enabled&&C.hullStructureGeometry(ship,p).referenceSkin)return;
    // Drag previews use the requested envelope only; full skin cuts and CSG
    // belong to the asynchronous engine build, never to a pointer event.
    if(opt.preview&&C.isShapePart(p)&&p.form!=='reference'){hullTriangleMesh(out.struct,C.structTriangles(p),opt.coded?d.col:p.paint?hex(p.paint):k==='solarPanel'?[35,43,57]:STRUCT_PAINT,36,k==='solarPanel'?254:251);return;}
    // The common part is the actual inward equipment volume, retained in the
    // diagnostic view. Its exterior is the footprint-bound surface kit below.
    if(p.surfaceRole&&p.surfaceRole!=='weapons'&&p.surfacePatch&&!p.surfaceUnplaced){roomMesh(ship,p,out.interior,color);return;}
    if(k==='solarPanel'){
      hullTriangleMesh(out.struct,equipmentSkinTriangles(ship,'p'+p.id,C.structTriangles(p)),opt.coded?d.col:p.paint?hex(p.paint):[35,43,57],10,254);
      if(!equipmentSkinPatches(ship,'p'+p.id).length)triangleMesh(out.struct,C.aeroPanelRibs(p),[154,161,169],48,254);return;
    }
    if(k==='wing'){hullTriangleMesh(out.struct,equipmentSkinTriangles(ship,'p'+p.id,C.structTriangles(p)),opt.coded?d.col:p.paint?hex(p.paint):STRUCT_PAINT,36);return;}
    if(isStructuralPart(p)&&p.form==='reference'&&C.REFERENCE_ASSETS[p.skinAsset]?.plainMetal){
      const tone=opt.coded?d.col:p.paint?hex(p.paint):STRUCT_PAINT;
      if(!opt.preview&&ship.solidCuts?.some(c=>ship.hull.assembly||c.structures))hullTriangleMesh(out.struct,equipmentSkinTriangles(ship,'p'+p.id,C.structTriangles(p)),tone);
      else appendReference(out.struct,p.skinAsset,v=>C.referencePartPoint(p,v),null,tone,opt.preview?[]:ship.hatches.filter(h=>h.portal&&!h.referenceMouth).map(h=>C.openingBounds(ship,h)).filter(Boolean),opt.preview?[]:equipmentSkinPatches(ship,'p'+p.id));
      return;
    }
    if(isStructuralPart(p)&&(p.form==='reference'&&C.REFERENCE_ASSETS[p.skinAsset]||(p.form==='ellipsoid'&&ship.hullSkin?.enabled)))return;
    if(k==='sensor'&&p.skinAsset)return;
    if(isStructuralPart(p)&&p.plate){hullTriangleMesh(out.plate,equipmentSkinTriangles(ship,'p'+p.id,C.structTriangles(p)),opt.coded?PLATE_CODED:p.paint?hex(p.paint):ship.paint==='dark'?PLATE_DARK:ship.paint==='cis'?PLATE_CIS:PLATE_PAINT,64);if(p.bands)structureBands(p,out.plate,equipmentSkinTriangles(ship,'p'+p.id,C.structTriangles(p)));if(p.stripes&&p.form==='shell')shellStripes(p,out.plate);return;}
    if(isStructuralPart(p)){let T=equipmentSkinTriangles(ship,'p'+p.id,C.structTriangles(p));if(C.isHullStructure?.(p))T=renderHullTriangles(ship,T,p);hullTriangleMesh(out.struct,T,p.paint?hex(p.paint):ship.paint==='dark'?STRUCT_DARK:ship.paint==='cis'?STRUCT_CIS:STRUCT_PAINT);if(p.bands)structureBands(p,out.struct,T);if(p.stripes&&p.form==='shell')shellStripes(p,out.struct);if(p.arcBands&&!ship.solidCuts?.some(c=>ship.hull.assembly||c.structures))arcPaintBands(p,out.struct);return;}
    const weaponBody=C.superweaponBodyTriangles?.(p);if(weaponBody){triangleMesh(out.hyper,weaponBody,color,36);return;}
    if(p._packing){triangleMesh(out.interior,p._packing.tris,color,36);return;}
    if(p._clip&&k!=='hangar'){triangleMesh(out.interior,p._clip.tris,color,36);return;}
    if(p.boxSize){const f=p.boxFrame;box(out.interior,[...f.fw,...f.up,...f.rt],p.c,0,0,0,...p.boxSize,color);return;}
    if(k==='machinery'){machineryMesh(out,p,ship,color,opt);return;}
    if(k==='engineCore'){engineCoreMesh(out.interior,p,color);return;}
    if(k==='sensor'){sensorShell(out.struct,p,color);return;}
    // v21 A cockpit shows as tinted canopy glass where it stands out of the hull; an astromech as its dome.
    if(k==='cockpit'){const canopy=C.canopyTriangles?.(p);if(canopy)triangleMesh(out.struct,canopy,opt.coded?color:CANOPY_GLASS,36);else sphere(C.isInternal(p)?out.interior:out.struct,p.c,p.d/2,opt.coded?color:CANOPY_GLASS,10,4);return;}
    if(k==='astromech'){const r=p.d/2,u=C.norm(p.dir||[0,1,0]),h=p.d*1.05,base=C.sub(p.c,C.mul(u,h/2)),top=C.add(p.c,C.mul(u,h*.18));axisFrustum(C.isInternal(p)?out.interior:out.struct,base,top,r*.82,r*.82,opt.coded?color:[188,196,204],false);if(!C.isInternal(p))sphere(out.struct,top,r*.8,opt.coded?color:ASTRO_DOME,8,3);return;}
    if(d.shape==='sphere'){sphere(C.isInternal(p)?out.interior:k==='gen'?out.gen:out.shield,p.c,p.d/2,color,8,3);return;}
    if(d.shape==='cube'){if(p.room||p._clip){roomMesh(ship,p,k==='hangar'&&ship.hatches.some(h=>h.bay===p.id)?out.hangar:out.interior,color);}else{const r=p.d/2;boxSolid(k==='hangar'&&ship.hatches.some(h=>h.bay===p.id)?out.hangar:out.interior,C.sub(p.c,[r,r,r]),C.add(p.c,[r,r,r]),color,32);}return;}
    const m=C.partDims(p),u=C.norm(p.dir||(k==='engine'?[-1,0,0]:[1,0,0])),a=C.sub(p.c,C.mul(u,m.l/2)),b=C.add(p.c,C.mul(u,m.l/2));
    if(k==='engine'){engineBell(out,p,a,b,u,color,glow,ship);return;}
    axisFrustum(C.isInternal(p)?out.interior:out.hyper,a,b,m.rad,m.rad,color,true);

}
// Pressure housings follow the paid route's exact flat-ended cylinders.
// Recess the shell between ribs; flanges reach, but never exceed, its radius.
// Segment-local collars also join bends without an oversized spherical elbow.
function driveHousingMesh(g,s,palette){
 const length=C.len(C.sub(s.b,s.a)),radius=Math.max(s.r0,s.r1);if(!(length>1e-8)||!Number.isFinite(length)||!(radius>0)||!Number.isFinite(radius))return;
 const end=Math.min(.12,radius*.45/length),bands=length>radius*2.5?Math.max(1,Math.min(24,Math.floor(length/(radius*.85))-1)):0,stations=[[0,1],[end*.7,1],[end,.92]];
 for(let i=0;i<bands;i++){const center=end+(1-2*end)*(i+1)/(bands+1),half=Math.min((1-2*end)/(4*(bands+1)),radius*.18/length);stations.push([center-half,.92],[center-half*.55,1],[center+half*.55,1],[center+half,.92]);}
 stations.push([1-end,.92],[1-end*.7,1],[1,1]);const u=C.mul(C.sub(s.b,s.a),1/length);
 for(let i=1;i<stations.length;i++){const [lo,r0]=stations[i-1],[hi,r1]=stations[i];if(hi-lo<1e-10)continue;const a=C.add(s.a,C.mul(u,length*lo)),b=C.add(s.a,C.mul(u,length*hi)),color=r0===1&&r1===1?palette.ring:r0===.92&&r1===.92?palette.shell:palette.shoulder;
  axisFrustum(g,a,b,C.lerp(s.r0,s.r1,lo)*r0,C.lerp(s.r0,s.r1,hi)*r1,color,[i===1,i===stations.length-1],false,Math.min(20,radialSegments(radius)));
 }
}
// The body and its connectors use the occupied segments themselves. Keep ribs
// inside that envelope so inspection, picking and dimension edits agree.
function machineryMesh(out,p,ship,color,opt={}){
 if(p.transmission||p.drivetrain){for(const s of p.segments||[p.seg])if(s?.l>0){
  const external=s.exteriorEntry===true,target=external?out.engine:out.interior,diagnostic=p.ok===false?[240,91,85]:opt.coded?(p.drivetrain?[218,162,72]:[107,177,198]):null;
  if(p.drivetrain)driveHousingMesh(target,s,diagnostic?{shell:diagnostic,ring:diagnostic,shoulder:diagnostic}:{shell:[110,124,137],ring:[166,178,188],shoulder:[136,150,162]});
  else axisFrustum(target,s.a,s.b,s.r0,s.r1,diagnostic||(external?[155,165,170]:[125,137,148]),true,false,16);
 }return;}
 // A stock refit can enlarge the paid external machine beyond its original
 // visual casing. Keep that explicit body visible beside the unchanged skin.
 const owner=ship.parts.find(e=>e.id===p.nozzle),external=owner?.exposedMachinery===true&&C.equipmentSpec(owner)?.engineStyle==='exposed',target=owner?.skinAsset&&!external?out.plant:out.engine,segments=p.segments||[p.seg],body=p.machinerySegment||segments.at(-1);
 for(const s of segments)if(s!==body)axisFrustum(target,s.a,s.b,s.r0,s.r1,color,false);
 if(!body||body.l<=0)return;
 const half=Math.min(1.2,body.r1*.3,body.l*.025)/body.l,bands=Array.from({length:5},(_,i)=>[(i+.6)/5-half,(i+.6)/5+half]),ts=[0,...bands.flat(),1];
 for(let i=0;i<ts.length-1;i++){const lo=ts[i],hi=ts[i+1],a=C.add(body.a,C.mul(body.u,body.l*lo)),b=C.add(body.a,C.mul(body.u,body.l*hi));axisFrustum(target,a,b,C.lerp(body.r0,body.r1,lo),C.lerp(body.r0,body.r1,hi),i%2?[120,132,142]:color,[i===0,i===ts.length-2]);}
}
// Independent machinery uses its own position and cylinder, regardless of how
// many outlets are connected. The collars stay within its occupied envelope.
function engineCoreMesh(target,p,color){
 const m=C.partDims(p),u=C.norm(p.dir||[1,0,0]);if(!(m.l>0)||!Number.isFinite(m.l)||m.l>C.DESIGN_LIMITS.engineLength||!(m.rad>0)||!Number.isFinite(m.rad)||m.rad>C.DESIGN_LIMITS.engineDiameter||!p.c?.every(v=>Number.isFinite(v)&&Math.abs(v)<=C.DESIGN_LIMITS.coordinate)||!u.every(Number.isFinite)||C.len(u)<.99)return;
 const a=C.sub(p.c,C.mul(u,m.l/2)),half=Math.min(m.l*.025,m.rad*.18)/m.l,ts=[0,...Array.from({length:5},(_,i)=>[(i+.5)/5-half,(i+.5)/5+half]).flat(),1];
 for(let i=0;i+1<ts.length;i++){const lo=ts[i],hi=ts[i+1],rib=i%2===1,r=m.rad*(rib?1:.97);axisFrustum(target,C.add(a,C.mul(u,m.l*lo)),C.add(a,C.mul(u,m.l*hi)),r,r,rib?[117,134,145]:color,[i===0||rib,i===ts.length-2||rib],false,radialSegments(m.rad));}
}
// Index ranges per part let the editor hide a part while it previews an edit.
function geoMarks(out){const m={};for(const k in out)m[k]=out[k].ni;return m;}
function markRanges(ranges,id,before,out){for(const k in out){const n=out[k].ni-(before[k]||0);if(n>0)(ranges[id]||(ranges[id]=[])).push([k,before[k]||0,n]);}}

function hullBayCapFilter(ship,owner=null){
 const local=owner?C.hullStructureShip(ship,owner):ship,caps=[];
 for(const h of local.hatches||[]){if(!h.portal)continue;const handle=owner?ship.hatches.find(q=>q.hullOwner===owner.id&&q.hullHatch===h.id):h,bay=ship.parts.find(p=>p.id===handle?.bay&&p.k==='hangar'),b=bay&&C.openingBounds(local,h);if(b)caps.push({h,b,bay});}
 if(!caps.length)return null;
 const point=q=>owner?C.hullLocalPoint(owner,q):q,world=q=>owner?C.hullWorldPoint(owner,q):q;
 return tri=>{const q=[point(Array.from(tri.slice(0,3))),point(Array.from(tri.slice(3,6))),point(Array.from(tri.slice(6,9)))],p=[0,1,2].map(a=>(q[0][a]+q[1][a]+q[2][a])/3);return caps.some(({h,b,bay})=>{const axis=C.hatchAxes(h).axis,plane=b[axis+(h.n[axis]>0?0:3)];return q.every(v=>Math.abs(v[axis]-plane)<.001)&&p.every((v,a)=>v>=b[a]-.001&&v<=b[a+3]+.001)&&C.inPart(bay,world(C.add(p,C.mul(h.n,.05))))&&C.inPart(bay,world(C.sub(p,C.mul(h.n,.05))));});};
}
function renderHullTriangles(ship,T,owner=null){const skip=hullBayCapFilter(ship,owner);if(!skip)return T;const out=[];for(let i=0;i<T.length;i+=9){const tri=T.subarray(i,i+9);if(!skip(tri))for(const v of tri)out.push(v);}return out.length===T.length?T:Float32Array.from(out);}
function meshHull(ship){
  if(ship.hullSkin?.enabled||ship.hull.assembly)return new Geo(16);
  const equipment=equipmentSkinPatches(ship,'hull');if(!equipment.length&&!launcherRecessHost(ship,'hull')&&!ship.solidCuts?.length&&!ship.trenches?.some(t=>t.mode==='split')&&!ship.hull.stations?.length&&!ship.hatches.some(h=>h.portal)&&ship.hull.sec!=='warship')return v3MeshHull(ship);
  const skipBayCap=hullBayCapFilter(ship);
  const T=equipmentSkinTriangles(ship,'hull',C.hullGeo(ship).tris),g=new Geo(T.length/3+100),openings=ship.hatches.map(h=>C.openingBounds(ship,h)).filter(Boolean),paint=ship.paint==='dark'?[103,116,129]:ship.paint==='cis'?HULL_CIS:[189,193,192];
  for(let i=0;i<T.length;i+=9){const tri=T.slice(i,i+9),p=[(T[i]+T[i+3]+T[i+6])/3,(T[i+1]+T[i+4]+T[i+7])/3,(T[i+2]+T[i+5]+T[i+8])/3],n=C.norm(C.cross(C.sub(Array.from(tri.slice(3,6)),Array.from(tri.slice(0,3))),C.sub(Array.from(tri.slice(6)),Array.from(tri.slice(0,3)))));
    // Core closes the aperture at its sill for the material/volume model.
    // In the rendered ship that cap lies inside the real bay: its clipped
    // ceiling/walls below already close the room, so the extra sheet hides it.
    if(skipBayCap?.(tri))continue;
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
  if(!ship.solidCuts?.length&&!equipment.length)plateDetail(ship,g);return g;
}
function roomMesh(ship,p,g,col){
  if(p.placement?.pendingGeometry||p.placement?.validationFailed){triangleMesh(g,C.structTriangles(C.roomShape(p)),col,36);return;}
  let T=p._clip?.tris||C.structTriangles(C.roomShape(p));for(const h of ship.hatches.filter(h=>h.bay===p.id)){const b=C.openingBounds(ship,h);if(b)T=C.subtractBoxMesh(T,b);}
  let front=T,back=T;
  if(ship.hatches.some(h=>h.bay===p.id&&h.hullOwner)){
    // The clipped room and its owning hull share aperture walls. Retain the
    // room's inward face while the hull supplies the coincident outer face.
    const a=[],b=[];for(let i=0;i<T.length;i+=9){const tri=T.subarray(i,i+9),q=[Array.from(tri.slice(0,3)),Array.from(tri.slice(3,6)),Array.from(tri.slice(6,9))],n=C.norm(C.cross(C.sub(q[1],q[0]),C.sub(q[2],q[0]))),at=[0,1,2].map(k=>(q[0][k]+q[1][k]+q[2][k])/3),plus=C.inHull(ship,C.add(at,C.mul(n,.025))),minus=C.inHull(ship,C.sub(at,C.mul(n,.025)));if(plus||!minus)for(const v of tri)a.push(v);if(minus||!plus)for(const v of tri)b.push(v);}front=Float32Array.from(a);back=Float32Array.from(b);
  }
  triangleMesh(g,front,col,36);
  // Interior surfaces remain visible through a mouth, with a deck beneath the opening.
  const rev=Float32Array.from(back);for(let i=0;i<rev.length;i+=9)for(let j=0;j<3;j++){const a=rev[i+3+j];rev[i+3+j]=rev[i+6+j];rev[i+6+j]=a;}triangleMesh(g,rev,col.map(v=>Math.round(v*.52)),36);
}
// Surface visuals read the installed design. Detail quality changes only the
// decorative pass; armour and equipment ports are always derived from the same
// physical patches and installed common parts used by the simulation.
function surfaceTriangles(patch,exposed=true){
 // Core keeps the full semantic surface for physical armour and stable IDs.
 // Rendering uses only its camera-independent exposed fragments, including
 // an explicitly empty mask for a completely buried face.
 const T=exposed&&patch?.exposedTriangles!=null?patch.exposedTriangles:patch?.triangles;if(!T)return [];
 if(ArrayBuffer.isView(T)||typeof T[0]==='number')return Array.from(T);
 return T.flat(Infinity);
}
function equipmentSkinPatches(ship,host){
 if(ship.surfaces?.armorOnly===1)return [];
 if(!ship.surfaces?.patches?.some(p=>p.functionMode==='equipment'))return [];
 return C.surfacePatches(ship).filter(p=>p.host===host&&p.exposed&&p.config?.functionMode==='equipment');
}
// Remove only the chosen equipment skin, retaining the neighbouring roof,
// underside and split-patch armour. Payload coordinates (reference UVs) are
// interpolated with the vertices; an authored atlas is never reprojected.
function equipmentSkinCutters(patches){
 const out=[];out.bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];out.normalBounds=out.bounds.slice();out.key=poly=>poly.map(p=>p.slice(0,3).map(v=>Math.round(v*1e4)).join(',')).sort().join('|');out.exact=new Set();for(const patch of patches){const T=surfaceTriangles(patch);for(let i=0;i+8<T.length;i+=9){const q=[T.slice(i,i+3),T.slice(i+3,i+6),T.slice(i+6,i+9)],n=C.norm(C.cross(C.sub(q[1],q[0]),C.sub(q[2],q[0]))),bounds=[0,1,2].map(k=>Math.min(...q.map(p=>p[k]))).concat([0,1,2].map(k=>Math.max(...q.map(p=>p[k]))));for(let k=0;k<3;k++){out.bounds[k]=Math.min(out.bounds[k],bounds[k]);out.bounds[k+3]=Math.max(out.bounds[k+3],bounds[k+3]);out.normalBounds[k]=Math.min(out.normalBounds[k],n[k]);out.normalBounds[k+3]=Math.max(out.normalBounds[k+3],n[k]);}out.exact.add(out.key(q));out.push({q,n,bounds,planes:q.map((a,j)=>{const pn=C.norm(C.cross(C.sub(q[(j+1)%3],a),n));return {n:pn,d:C.dot(pn,a)};})});}}return out;
}
function equipmentSkinFragments(poly,cutters){
 if(cutters.exact.has(cutters.key(poly)))return [];
 let fragments=[poly];const normal=C.norm(C.cross(C.sub(poly[1],poly[0]),C.sub(poly[2],poly[0]))),lo=[0,1,2].map(k=>Math.min(...poly.map(p=>p[k]))),hi=[0,1,2].map(k=>Math.max(...poly.map(p=>p[k])));
 // Necessary conditions for any cutter to pass the exact tests below. For
 // unit normals dot>=1-1e-5 implies component distance<=sqrt(2e-5); .00448
 // rounds that bound outward. Unrelated caps/segments need no linear scan.
 for(let k=0;k<3;k++)if(hi[k]<cutters.bounds[k]-.001||lo[k]>cutters.bounds[k+3]+.001||normal[k]<cutters.normalBounds[k]-.00448||normal[k]>cutters.normalBounds[k+3]+.00448)return fragments;
 const area=p=>{let a=0;for(let i=1;i<p.length-1;i++)a+=C.len(C.cross(C.sub(p[i],p[0]),C.sub(p[i+1],p[0])));return a;};
 const side=(p,n,d,inside)=>{const out=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],da=d-C.dot(n,a),db=d-C.dot(n,b),ia=inside?da>=-1e-7:da<=1e-7,ib=inside?db>=-1e-7:db<=1e-7;if(ia)out.push(a);if(ia!==ib){const t=da/(da-db);out.push(a.map((x,k)=>x+(b[k]-x)*t));}}return out;};
 for(const c of cutters){if(Math.abs(C.dot(normal,c.n)-1)>1e-5||[0,1,2].some(k=>hi[k]<c.bounds[k]-.001||lo[k]>c.bounds[k+3]+.001)||poly.some(p=>Math.abs(C.dot(c.n,C.sub(p,c.q[0])))>.003))continue;
  const next=[];for(const original of fragments){let rest=original;for(const {n,d}of c.planes){const outside=side(rest,n,d,false);if(outside.length>=3&&area(outside)>1e-8)next.push(outside);rest=side(rest,n,d,true);if(rest.length<3)break;}}fragments=next;if(!fragments.length)break;
 }return fragments;
}
function equipmentSkinTriangles(ship,host,T){
 const patches=equipmentSkinPatches(ship,host);let result=T;
 if(patches.length){const cutters=equipmentSkinCutters(patches),out=[];for(let i=0;i+8<T.length;i+=9)for(const p of equipmentSkinFragments([Array.from(T.slice(i,i+3)),Array.from(T.slice(i+3,i+6)),Array.from(T.slice(i+6,i+9))],cutters))C.triangulateFan(p,out);result=out;}
 return C.launcherRecessTriangles?.(ship,host,result)||result;
}
function launcherRecessHost(ship,host){return !!ship?.fits?.some(f=>C.isShipLauncher?.(f)&&f.launcherEmbedded&&!f.float&&(String(f.host??'hull')===String(host)||'p'+f.host===String(host)));}
// The shared physical cutter clips world positions. Interpolate the source
// triangle's UVs for every retained point so reference textures keep their atlas.
function launcherReferenceSkin(ship,host,data){
 if(!C.launcherRecessTriangles||!launcherRecessHost(ship,host))return data;
 const vertices=[];
 for(let i=0;i<data.idx.length;i+=3){
  const ids=[data.idx[i],data.idx[i+1],data.idx[i+2]],points=ids.map(k=>Array.from(data.pos.subarray(k*3,k*3+3))),uvs=ids.map(k=>Array.from(data.uv.subarray(k*2,k*2+2))),edge0=C.sub(points[1],points[0]),edge1=C.sub(points[2],points[0]),aa=C.dot(edge0,edge0),ab=C.dot(edge0,edge1),bb=C.dot(edge1,edge1),den=aa*bb-ab*ab,T=C.launcherRecessTriangles(ship,host,points.flat());
  for(let j=0;j<T.length;j+=3){const point=Array.from(T.slice(j,j+3)),delta=C.sub(point,points[0]),da=C.dot(delta,edge0),db=C.dot(delta,edge1),b=Math.abs(den)>1e-20?(bb*da-ab*db)/den:0,c=Math.abs(den)>1e-20?(aa*db-ab*da)/den:0,a=1-b-c;vertices.push([...point,...[0,1].map(k=>uvs[0][k]*a+uvs[1][k]*b+uvs[2][k]*c)]);}
 }
 return{pos:Float32Array.from(vertices.flatMap(p=>p.slice(0,3))),uv:Float32Array.from(vertices.flatMap(p=>p.slice(3,5))),idx:Uint32Array.from(vertices.map((_,i)=>i))};
}
function equipmentReferenceSkin(data,patches){
 if(!patches.length)return data;const cutters=equipmentSkinCutters(patches),vertices=[];
 for(let i=0;i<data.idx.length;i+=3){const poly=[0,1,2].map(j=>{const k=data.idx[i+j];return [...data.pos.slice(k*3,k*3+3),...data.uv.slice(k*2,k*2+2)];});for(const p of equipmentSkinFragments(poly,cutters))for(let j=1;j<p.length-1;j++)vertices.push(p[0],p[j],p[j+1]);}
 return {pos:Float32Array.from(vertices.flatMap(p=>p.slice(0,3))),uv:Float32Array.from(vertices.flatMap(p=>p.slice(3,5))),idx:Uint32Array.from(vertices.map((_,i)=>i))};
}
const SURFACE_RECESS_DATA=new WeakMap();
function surfaceRecess(ship,patch,requested){
 const n=C.norm(patch.normal),T=surfaceTriangles(patch),recessDepth=Math.max(.02,Math.min(requested,patch.depth||requested)),backingTriangles=[],depths=new Map(),hints=new Map(),key=p=>p.map(v=>Math.round(v*1e6)).join(',');
 for(let i=0;i<T.length;i+=9){const ps=[T.slice(i,i+3),T.slice(i+3,i+6),T.slice(i+6,i+9)],center=C.mul(ps.reduce((a,b)=>C.add(a,b),[0,0,0]),1/3);for(const p of ps){const k=key(p);hints.set(k,C.add(hints.get(k)||[0,0,0],C.sub(center,p)));}}
 const hintAt=p=>{const h=hints.get(key(p))||C.sub(patch.center,p);return C.norm(C.sub(h,C.mul(n,C.dot(h,n))));};
 const depthAt=p=>{const k=key(p);if(depths.has(k))return depths.get(k);let depth=C.surfaceInwardDepth?.(ship,patch,p)??patch.depth;
  // Float32 boundary vertices can lie micrometres beyond a neighbouring cap.
  // Query from the adjacent face interior, without borrowing another host.
  if(!(depth>0))depth=C.surfaceInwardDepth?.(ship,patch,C.add(p,C.mul(hintAt(p),.001)))||0;
  const amount=Math.max(0,Math.min(recessDepth,depth-.012));depths.set(k,amount);return amount;};
 const pointAt=p=>C.sub(C.add(p,C.mul(hintAt(p),.0001)),C.mul(n,depthAt(p)));
 // Raw wedge corners can all have zero depth while their shared diagonal
 // has room for the full recess. Centroid fans retain that false ridge.
 // Refine whole passes with shared edge midpoints so adjacent triangles
 // agree; full-depth walls retain their exact original tessellation.
 let faces=[];for(let i=0;i<T.length;i+=9)faces.push([T.slice(i,i+3),T.slice(i+3,i+6),T.slice(i+6,i+9)]);
 const threshold=Math.max(.025,recessDepth*.18),midpoints=new Map(),midpoint=(a,b)=>{const ka=key(a),kb=key(b),k=ka<kb?ka+'|'+kb:kb+'|'+ka;let p=midpoints.get(k);if(!p){p=C.mul(C.add(a,b),.5);midpoints.set(k,p);}return p;};let splits=0;
 const needsRefinement=([a,b,c])=>{const ds=[depthAt(a),depthAt(b),depthAt(c)];if(Math.min(...ds)>=recessDepth-threshold)return false;
  const ps=[a,b,c];for(let j=0;j<3;j++)if(Math.abs(depthAt(midpoint(ps[j],ps[(j+1)%3]))-(ds[j]+ds[(j+1)%3])/2)>threshold)return true;
  return Math.abs(depthAt(C.mul(C.add(C.add(a,b),c),1/3))-(ds[0]+ds[1]+ds[2])/3)>threshold;};
 // At most three conforming passes and 192 four-way triangle splits.
 for(let level=0;level<3&&splits+faces.length<=192&&faces.some(needsRefinement);level++){splits+=faces.length;const next=[];for(const [a,b,c]of faces){const ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);next.push([a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]);}faces=next;}
 const frontTriangles=faces.flat(2);
 for(let i=0;i<frontTriangles.length;i+=3)backingTriangles.push(...pointAt(frontTriangles.slice(i,i+3)));
 const result={recessDepth,backingTriangles,frontTriangles,depthAt,pointAt};SURFACE_RECESS_DATA.set(backingTriangles,result);return result;
}
function surfaceBoundary(patch){
 const T=surfaceTriangles(patch),edges=new Map(),key=p=>p.map(v=>Math.round(v*1e6)).join(',');
 for(let i=0;i+8<T.length;i+=9){const p=[T.slice(i,i+3),T.slice(i+3,i+6),T.slice(i+6,i+9)];for(let j=0;j<3;j++){const a=p[j],b=p[(j+1)%3],ka=key(a),kb=key(b),k=ka<kb?ka+'|'+kb:kb+'|'+ka,q=edges.get(k);if(q)q.n++;else edges.set(k,{a,b,n:1});}}
 if(!T.length&&patch?.exposedTriangles==null&&patch?.polygon?.length>2)for(let i=0;i<patch.polygon.length;i++)edges.set(String(i),{a:patch.polygon[i],b:patch.polygon[(i+1)%patch.polygon.length],n:1});
 // Exposure clipping can leave a whole triangle edge opposite several
 // shorter edges. Exact endpoint cancellation alone makes that T-junction
 // look like an opening, extruding a false reveal through the equipment.
 const boundary=[...edges.values()].filter(e=>e.n===1);
 return surfaceUncoveredEdges(boundary,boundary,1e-6);
}
function surfaceUncoveredEdges(edges,covering,eps){
 const out=[];
 for(const e of edges){const d=C.sub(e.b,e.a),length2=C.dot(d,d),length=Math.sqrt(length2);if(length<=eps)continue;const tolerance=eps/length;let spans=[[0,1]];
  for(const f of covering){if(e===f)continue;const a=C.sub(f.a,e.a),b=C.sub(f.b,e.a),ta=C.dot(a,d)/length2,tb=C.dot(b,d)/length2,lo=Math.max(0,Math.min(ta,tb)),hi=Math.min(1,Math.max(ta,tb));if(hi-lo<=tolerance||C.len(C.sub(a,C.mul(d,ta)))>eps||C.len(C.sub(b,C.mul(d,tb)))>eps)continue;
   const next=[];for(const p of spans){if(p[0]<lo-tolerance)next.push([p[0],Math.min(p[1],lo)]);if(p[1]>hi+tolerance)next.push([Math.max(p[0],hi),p[1]]);}spans=next;if(!spans.length)break;
  }
  for(const [a,b]of spans)if(b-a>tolerance)out.push({a:C.add(e.a,C.mul(d,a)),b:C.add(e.a,C.mul(d,b))});
 }return out;
}
function surfaceSelectionLines(ship,ids){
 const out=lineSet();if(!ship||!ids?.length||typeof C.surfacePatches!=='function')return out.out();
 const selected=new Set(ids);
 for(const patch of C.surfacePatches(ship)){if(!selected.has(patch.id)||!patch.exposed)continue;const lift=C.mul(patch.normal,ship.surfaces?.armorOnly===1?.02:Math.max(.02,(patch.config?.armor?.thickness||0)+.02));
  for(const e of surfaceBoundary(patch))out.seg(C.add(e.a,lift),C.add(e.b,lift),[104,230,255,255]);
 }
 return out.out();
}
// Initial placement chooses its parent from the tapped real surface. The
// explicit-parent variant remains available for subsequent face resolution:
// its miss stays a miss. Both use Core's semantic IDs and actual triangles.
function placementParentPatches(ship,parentStructureId){
 const host=parentStructureId==null?null:parentStructureId==='hull'?'hull':'p'+parentStructureId;
 if(ship._client){
  // The renderer must never launch the full ship's exposure survey from a
  // pointer event. Use the latest Worker survey, filtered before copying any
  // descriptors; a cold/mismatched survey waits for its asynchronous result.
  const proxy=ship._geoProxy;if(!Array.isArray(proxy?.surfaces)||proxy.surfacePartitions!==undefined&&proxy.surfacePartitions!==JSON.stringify(ship.surfaces?.partitions||null))return [];
  return host?proxy.surfaces.filter(p=>p.host===host):proxy.surfaces;
 }
 const patches=C.surfacePatches(ship,true);return host?patches.filter(p=>p.host===host):patches;
}
function placementSurfaceHits(ship,o,d,parents,patches,options){
 if(!o?.every(Number.isFinite)||!d?.every(Number.isFinite)||C.len(d)<1e-12)return [];
 const direction=C.norm(d),hits=[];
 for(const patch of patches){
  if(!parents.has(patch.host)||options.surfaceId&&patch.id!==options.surfaceId)continue;
  if(!options.includeOccluded&&!patch.exposed)continue;
  const T=options.includeOccluded?patch.triangles:patch.exposedTriangles??patch.triangles;
  const hit=C.rayTris(T,o,direction,options.maxDistance);
  if(!hit||options.maxDistance!=null&&hit.t>options.maxDistance)continue;
  const parent=parents.get(patch.host),parentStructureId=parent?.id??'hull';
  hits.push({...patch,point:hit.p,p:hit.p,n:hit.n,t:hit.t,distance:hit.t,part:parent,
   kind:parent?'part':'hull',parentStructureId,hostSurfaceId:patch.id});
 }
 hits.sort((a,b)=>a.distance-b.distance||a.id.localeCompare(b.id));
 return hits;
}
function placementSurveyReady(ship){const proxy=ship?._geoProxy;return Array.isArray(proxy?.surfaces)&&(proxy.surfacePartitions===undefined||proxy.surfacePartitions===JSON.stringify(ship.surfaces?.partitions||null));}
function placementAuthoringHullKey(ship){return C.publicJSON([ship.hull,ship.cuts||[],ship.subs||[],ship.trenches||[],ship.solidCuts||[],ship.hatches||[],(ship.fits||[]).filter(f=>C.isShipLauncher(f)&&C.shipLauncherConfig(f).embedded)]);}
function placementRayBeforeBounds(o,d,b,limit){return b?.length===6&&b.every(Number.isFinite)&&(fitRayStartsInside(o,b)||((C.rayAABB(o,d,b)?.t??Infinity)<limit));}
function placementAuthoringOccluded(ship,o,d,limit,options){
 // A cold pick must not construct hundreds of weapon meshes on the input
 // thread. Warm exact meshes decide visibility; a potentially closer cold
 // mesh conservatively waits rather than selecting through its bounds.
 for(const fit of ship.fits||[]){
  if(noModelFit(fit)||!C.FITS[fit.k])continue;
  const key=JSON.stringify([fit,C.fitSpec(fit),fit._store],(k,v)=>k.startsWith('_')?undefined:v),cached=FIT_RAY_CACHE.get(fit),known=FIT_RAY_BOUNDS.get(fit),bounds=known?.key===key?known.bounds:fitRayColdBounds(fit);
  if(!placementRayBeforeBounds(o,d,bounds,limit))continue;
  if(cached?.key!==key)return true;
  if(C.rayTris(cached.T,o,d,limit))return true;
 }
 for(const part of ship.parts||[]){
  if(part.id===options.excludePartId||C.isShapePart?.(part)||isStructuralPart(part)||!C.PARTS[part.k]||!part.c)continue;
  let bounds=C.partAABB(part);
  if(part.k==='engine'){
   // The skin may extend beyond the physical cylinder. Its authored corner
   // transform is cheap; decoding/building that skin on a pointer is not.
   const appearance=C.engineAppearance?.(part)||part,asset=C.REFERENCE_ASSETS[appearance.skinAsset];
   if(asset&&C.referenceEnginePoint)for(const x of [-.50004,.50004])for(const y of [-.50004,.50004])for(const z of [-.50004,.50004]){const p=C.referenceEnginePoint(appearance,[x,y,z],asset);for(let a=0;a<3;a++){bounds[a]=Math.min(bounds[a],p[a]);bounds[a+3]=Math.max(bounds[a+3],p[a]);}}
  }
  if(!placementRayBeforeBounds(o,d,bounds,limit))continue;
  // Packed solids already have their real triangles. Ordinary primitives
  // have exact bounded ray tests; reference skins wait for their real mesh.
  const cached=part._packing?.tris||part._clip?.tris;
  if(cached){if(C.rayTris(cached,o,d,limit))return true;continue;}
  if(part.k==='engine'||part.skinAsset||part.weaponBody)return true;
  const hit=C.rayPart(o,d,part);if(hit&&hit.t<limit)return true;
 }
 return false;
}
const PLACEMENT_ACCEPTED_RAY_CACHE=new WeakMap();
const PLACEMENT_DRAFT_PREVIEWS=new WeakMap(),PLACEMENT_DRAFT_PREVIEW_RESULTS=new WeakMap();
function publishPlacementDraftPreview(ship,meshes){
 const prepared=PLACEMENT_DRAFT_PREVIEW_RESULTS.get(meshes);if(!prepared||prepared.source!==ship)return false;
 PLACEMENT_DRAFT_PREVIEWS.set(ship,prepared.entries);return true;
}
function placementRenderedDraftTriangles(ship,part){
 if(!part?.placement?.pendingGeometry||part.placement.validationFailed)return null;
 const record=PLACEMENT_DRAFT_PREVIEWS.get(ship)?.get(part.id);if(!record||record.inputKey!==C.placementPendingInputKey(part))return null;
 if(record.triangles)return record.triangles;
 const chunks=[record.value.preview,record.value.previewRef].filter(chunk=>chunk?.ni>0),count=chunks.reduce((n,chunk)=>n+chunk.ni*3,0);if(!count)return null;
 const triangles=new Float32Array(count);let cursor=0;
 for(const chunk of chunks)for(let i=0;i<chunk.ni;i++){const index=chunk.idx[i]*3;triangles[cursor++]=chunk.pos[index];triangles[cursor++]=chunk.pos[index+1];triangles[cursor++]=chunk.pos[index+2];}
 return record.triangles=triangles;
}

function placementAcceptedTriangles(ship,part){
 if(!C.placementCachedGeometryCurrent?.(ship,part))return null;
 const geometry=part._placementGeometry,key=JSON.stringify([part.c,part.yaw,part.pitch,part.roll,part.surfaceNormal]),old=PLACEMENT_ACCEPTED_RAY_CACHE.get(part);
 if(old?.geometry===geometry&&old.key===key)return old.triangles;
 const triangles=new Float64Array(geometry.local.length);for(let i=0;i<triangles.length;i+=3)triangles.set(C.worldStruct(part,Array.from(geometry.local.subarray(i,i+3))),i);
 PLACEMENT_ACCEPTED_RAY_CACHE.set(part,{geometry,key,triangles});return triangles;
}
function placementPendingBounds(part,ship){
 if(!part){const h=ship.hull;part={k:'struct',form:'hull',c:[h.L/2,h.H/2,0],s:[h.L,h.W,h.H],hullProfile:h};}
 if(!part.c?.every(Number.isFinite)||!part.s?.every(v=>Number.isFinite(v)&&v>0)||!isStructuralPart(part))return null;
 let points=[],local=null;const [l,w,h]=part.s,form=part.form||'trap';
 if(form==='mesh'&&Array.isArray(part.mesh?.v))local=part.mesh.v.map(v=>[v[0]*l,v[1]*h,v[2]*w]);
 else if(form==='reference')return C.refPartBounds?.(part)||null;
 else if(form==='hull'){
  const profile=part.hullProfile||{},rows=profile.stations||[],width=Math.max(1,profile.stern||0,profile.bowW||0,...rows.map(row=>Math.abs(row[1]||0))),height=Math.max(1,profile.bowH||0,...rows.map(row=>Math.abs(row[2]||0))),offset=Math.max(0,...rows.map(row=>Math.abs(row[3]||0)));
  for(const x of [-l/2,l/2])for(const y of [-h*(height/2+offset),h*(height/2+offset)])for(const z of [-w*width/2,w*width/2])points.push(C.worldStruct(part,[x,y,z]));
 }else if(['box','trap','wedge','cylinder','cone','dome','ellipsoid'].includes(form)){
  const angles=(part.angles||[]).map(v=>Math.abs(Math.tan(v*Math.PI/180))),x=l/2+Math.abs(part.offsetX||0)+h*Math.max(0,...angles.slice(0,2)),z=w/2+Math.abs(part.offsetZ||0)+h*Math.max(0,...angles.slice(2));
  for(const a of [-x,x])for(const b of [-h/2,h/2])for(const c of [-z,z])points.push(C.worldStruct(part,[a,b,c]));
 }else return null;
 if(local)points=local.map(point=>C.worldStruct(part,point));if(!points.length||points.some(point=>!point.every(Number.isFinite)))return null;
 const bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];for(const point of points)for(let a=0;a<3;a++){bounds[a]=Math.min(bounds[a],point[a]);bounds[a+3]=Math.max(bounds[a+3],point[a]);}return bounds;
}
function placementAuthoringHits(ship,o,d,parents,patches,options){
 const source=ship._placementSource||ship,proxy=ship._geoProxy,survey=placementSurveyReady(ship),rows=proxy?.placementBodies;
 if(!ship._client||!source._editorGeometryContext&&!PLACEMENT_DRAFT_PREVIEWS.has(source)||!o?.every(Number.isFinite)||!d?.every(Number.isFinite)||C.len(d)<1e-12)return [];
 const currentContext=ship._placementGeometryContext==null||ship._placementGeometryContext===source._editorGeometryContext,direction=C.norm(d),bodies=new Map((rows||[]).map(body=>[body.parentStructureId,body])),hits=[],unknown=[];
 for(const [host,parent]of parents){
  const id=parent?.id??'hull',body=bodies.get(id),partContext=parent?._placementResolvedGeometryContext,accepted=parent&&(currentContext||partContext!=null&&partContext===ship._placementGeometryContext)?placementAcceptedTriangles(source,parent):null,provisional=parent?placementRenderedDraftTriangles(source,parent):null,bodyCurrent=!parent?.placement?.pendingGeometry&&!parent?.placement?.validationFailed&&source._editorGeometryContext!=null&&currentContext&&body?.triangles?.length&&(!parent||parent._editorGeometryContext===source._editorGeometryContext)&&(!parent?._placementGeometry||!!accepted)&&body.sourceKey===(parent?C.publicJSON(parent):placementAuthoringHullKey(source));
  const semantic=!parent?.placement?.pendingGeometry&&!parent?.placement?.validationFailed&&source._editorGeometryContext!=null&&survey&&currentContext&&(bodyCurrent||!rows&&!accepted)&&(!parent?true:!parent._placementGeometry||!!accepted),selected=semantic?patches.filter(patch=>patch.host===host):[];
  if(selected.length){hits.push(...placementSurfaceHits(ship,o,d,new Map([[host,parent]]),selected,options));continue;}
  // A complete survey with an unchanged known parent is authoritative even
  // if that parent has no exposed patch. New accepted solids are different:
  // their real Worker geometry is useful before the next survey catches up.
  if(options.surfaceId||semantic&&bodyCurrent)continue;
  const triangles=provisional||accepted||(!survey&&bodyCurrent?body.triangles:null);
  if(triangles){const hit=C.rayTris(triangles,o,direction,options.maxDistance);if(hit)hits.push({host,point:hit.p,p:hit.p,n:hit.n,t:hit.t,distance:hit.t,part:parent,kind:parent?'part':'hull',parentStructureId:id,semanticPending:true,...(provisional?{provisional:true}:{} )});}
  else if(!semantic||!selected.length&&!bodyCurrent)unknown.push(placementPendingBounds(parent,source));
 }
 hits.sort((a,b)=>a.distance-b.distance||String(a.parentStructureId).localeCompare(String(b.parentStructureId)));
 const distance=hits[0]?.distance??options.maxDistance??Infinity;
 if(unknown.some(bounds=>!bounds||placementRayBeforeBounds(o,direction,bounds,distance)))return [];
 if(hits[0]?.semanticPending&&!options.includeOccluded&&placementAuthoringOccluded(source,o,direction,distance,options))return [];
 return hits;
}
function structureSurfaceCandidates(ship,o,d,parentStructureId,options={}){
 if(!ship||parentStructureId==null||parentStructureId===options.excludePartId)return [];
 const source=ship._placementSource||ship,parent=parentStructureId==='hull'?null:source.parts.find(p=>p.id===parentStructureId&&(C.isShapePart?.(p)||isStructuralPart(p)));
 if(parentStructureId!=='hull'&&!parent||parentStructureId==='hull'&&ship.hull.assembly)return [];
 const parents=new Map([[parent?'p'+parent.id:'hull',parent]]),patches=placementParentPatches(ship,parentStructureId);
 if(ship._client&&(Array.isArray(ship._geoProxy?.placementBodies)||!placementSurveyReady(ship)||parent?._placementGeometry||parent?.placement?.pendingGeometry))return placementAuthoringHits(ship,o,d,parents,patches,options);
 return placementSurfaceHits(ship,o,d,parents,patches,options);
}
function placementSurfaceCandidates(ship,o,d,options={}){
 if(!ship)return [];const source=ship._placementSource||ship,parents=new Map();
 if(!ship.hull.assembly&&options.excludePartId!=='hull')parents.set('hull',null);
 for(const part of source.parts)if(part.id!==options.excludePartId&&(C.isShapePart?.(part)||isStructuralPart(part)))parents.set('p'+part.id,part);
 const patches=placementParentPatches(ship);
 if(ship._client&&(Array.isArray(ship._geoProxy?.placementBodies)||!placementSurveyReady(ship)||[...parents.values()].some(part=>part?._placementGeometry||part?.placement?.pendingGeometry)))return placementAuthoringHits(ship,o,d,parents,patches,options);
 return placementSurfaceHits(ship,o,d,parents,patches,options);
}
const PLACEMENT_COLORS=Object.freeze({pending:[105,195,220,255],valid:[95,196,138,255],invalid:[236,106,92,255],disconnected:[236,106,92,255]});
const PLACEMENT_FIT_MESH_CACHE=new WeakMap();
function placementFittingMesh(ship,fit){
 const empty=()=>new Geo(16);if(!fit||!C.FITS[fit.k]||noModelFit(fit))return empty();
 const key=JSON.stringify([fit,C.fitSpec(fit),fit._store],(k,v)=>k.startsWith('_')?undefined:v),cached=PLACEMENT_FIT_MESH_CACHE.get(fit);if(cached?.key===key)return cached.mesh;
 // Use the installed-fitting mesh builders, including automatic foundations,
 // manual pedestals, authored turret joints and command pods. A fleet draw's
 // temporary skip sets must not remove a body or pedestal from the ghost.
 const model=ship||{fits:[fit],parts:[],paint:'imperial'},body=FIT_SKIP_BODY,ped=FIT_SKIP_PED,mesh=empty();let sources;
 try{FIT_SKIP_BODY=FIT_SKIP_PED=null;sources=[meshFits(model,null,null,[fit]),meshReferenceFits(model,null,[fit])];}finally{FIT_SKIP_BODY=body;FIT_SKIP_PED=ped;}
 for(const source of sources)if(source.ni)appendGeo(mesh,source);
 PLACEMENT_FIT_MESH_CACHE.set(fit,{key,mesh});FIT_RAY_SOURCES.set(fit,{key,meshes:sources});return mesh;
}
function placementDiagnosticLines(ship,diagnostics){
 const lines=lineSet();if(!ship||!diagnostics)return lines.out();
 const {parentStructureId,part,effectivePart,surfaceId,contactSide}=diagnostics;
 const item=effectivePart||part,fit=diagnostics.fit||(diagnostics.list==='fits'||diagnostics.entityKind==='fit'||item&&!C.PARTS[item.k]&&C.FITS[item.k]?item:null);
 const color=PLACEMENT_COLORS[diagnostics.status]||PLACEMENT_COLORS.pending;let selectedPatch=null;
 if(parentStructureId!=null)for(const patch of placementParentPatches(ship,parentStructureId)){
  if(patch.host!==(parentStructureId==='hull'?'hull':'p'+parentStructureId)||!patch.exposed)continue;
  const selected=patch.id===surfaceId,tone=selected?[255,202,104,255]:[115,170,240,200];if(selected)selectedPatch=patch;
  for(const edge of surfaceBoundary(patch))lines.seg(edge.a,edge.b,tone);
 }
 const preview=fit?null:effectivePart||part,T=diagnostics.effectiveTriangles;
 if(fit)lines.fit(fit,color,ship);else if(T?.length)lines.triangles(T,color);else if(preview)lines.part(preview,color,ship);
 // Only the requested contact side is emphasized. This is an orientation aid,
 // not a fabricated contact surface; connectivity is the strict Core result.
 if(preview&&contactSide&&C.isShapePart(preview)){
  const local={bottom:[0,-1,0],top:[0,1,0],fore:[1,0,0],aft:[-1,0,0],port:[0,0,-1],stbd:[0,0,1],front:[1,0,0],back:[-1,0,0],left:[0,0,-1],right:[0,0,1]}[contactSide];
  if(local||diagnostics.contactNormal||contactSide==='side'&&selectedPatch){const frame=C.structFrame(preview),normal=diagnostics.contactNormal||(local?C.add(C.add(C.mul(frame.fw,local[0]),C.mul(frame.up,local[1])),C.mul(frame.rt,local[2])):C.mul(selectedPatch.normal,-1)),triangles=T||C.structTriangles(preview);
   for(let i=0;i+8<triangles.length;i+=9){const a=triangles.slice(i,i+3),b=triangles.slice(i+3,i+6),c=triangles.slice(i+6,i+9),n=C.norm(C.cross(C.sub(b,a),C.sub(c,a)));if(C.dot(n,normal)>.5){lines.seg(a,b,[255,202,104,255]);lines.seg(b,c,[255,202,104,255]);lines.seg(c,a,[255,202,104,255]);}}
  }
 }
 if(diagnostics.contactTriangles?.length)lines.triangles(diagnostics.contactTriangles,[135,234,195,255]);
 for(const polygon of diagnostics.contactRegions||diagnostics.contact?.regions||[]){if(!Array.isArray(polygon)||polygon.length<3||!polygon.every(p=>p?.length===3&&p.every(Number.isFinite)))continue;for(let i=0;i<polygon.length;i++)lines.seg(polygon[i],polygon[(i+1)%polygon.length],[135,234,195,255]);}
 const extent=fit?C.fitAABB(fit):preview?C.partAABB(preview):null,radius=extent?Math.max(.01,Math.min(...[0,1,2].map(i=>extent[i+3]-extent[i]))*.025):.1;
 for(const p of diagnostics.contactPoints||[])if(p?.length===3&&p.every(Number.isFinite))lines.cross(p,radius,[135,234,195,255]);
 for(const p of diagnostics.disconnectedParts||[]){const item=typeof p==='object'?p:ship.parts.find(q=>q.id===p);if(item)lines.part(item,PLACEMENT_COLORS.disconnected,ship);}
 for(const f of diagnostics.disconnectedFits||[]){const item=typeof f==='object'?f:ship.fits.find(q=>q.id===f);if(item)lines.fit(item,PLACEMENT_COLORS.disconnected,ship);}
 return lines.out();
}
function placementGhostMesh(ship,diagnostics){
 const mesh=new Geo(64);if(!ship||!diagnostics||diagnostics.showMesh===false)return mesh;
 const item=diagnostics.effectivePart||diagnostics.part,fit=diagnostics.fit||(diagnostics.list==='fits'||diagnostics.entityKind==='fit'||item&&!C.PARTS[item.k]&&C.FITS[item.k]?item:null);
 if(fit){appendGeo(mesh,placementFittingMesh(ship,fit));const color=PLACEMENT_COLORS[diagnostics.status]||PLACEMENT_COLORS.pending;for(let i=0;i<mesh.n;i++)mesh.col.set(color,i*4);return mesh;}
 const p=diagnostics.effectivePart||diagnostics.part,color=(PLACEMENT_COLORS[diagnostics.status]||PLACEMENT_COLORS.pending).slice(0,3);
 const T=diagnostics.effectiveTriangles||p?._packing?.tris||p?._clip?.tris||(p&&C.isShapePart(p)?C.structTriangles(p):null);
 if(T?.length){triangleMesh(mesh,T,color,36);return mesh;}
 // Fixed machinery uses the very same part mesher as the installed model.
 // Do not substitute its clearance box for the apparatus itself.
 if(p){const groups={};for(const k of ['struct','plate','gen','shield','hyper','interior','engine','plant','nozzle','hangar'])groups[k]=mesh;meshOnePart(groups,p,ship,{coded:true,preview:false},[]);const reference=meshReferenceParts(ship,null,[p]);for(const name of ['refStruct','refEngine','refPlant'])if(reference[name].ni)appendGeo(mesh,reference[name]);for(let i=0;i<mesh.n;i++)mesh.col.set([...color,255],i*4);}
 return mesh;
}
function surfaceSeed(id,seed){let h=(seed||0)|0;for(const ch of String(id))h=Math.imul(h^ch.charCodeAt(0),16777619);return h>>>0;}
function surfaceHostPaint(ship,patch){
 const p=patch._part||(/^p\d+$/.test(patch.host)?ship.parts.find(p=>p.id===+patch.host.slice(1)):null);
 if(p?.paint)return hex(p.paint);
 if(p)return (ship.paint==='dark'?STRUCT_DARK:ship.paint==='cis'?STRUCT_CIS:STRUCT_PAINT).slice();
 return (ship.paint==='dark'?[103,116,129]:ship.paint==='cis'?HULL_CIS:PAINT).slice();
}
function surfacePaintTone(paint,factor){return paint.map(c=>Math.round(C.clamp(c*factor,0,255)));}
function surfaceEquipmentPaint(paint,color,feature,port){
 if(port)return color;
 if(/recess/.test(feature))return surfacePaintTone(paint,.52);
 const brightness=(color[0]+color[1]+color[2])/3;
 return surfacePaintTone(paint,C.clamp(.92+(brightness-113)*.0019,.79,1.04));
}
// A semantic split does not create a structural wall. Remove only the
// collinear shared interval when both siblings expose the same recessed space.
function surfaceEquipmentReveals(row,plans){
 const neighbors=plans.filter(q=>q!==row&&q.host===row.host&&q.config.functionMode==='equipment'&&Math.abs(q.visualDepth-row.visualDepth)<1e-5&&C.dot(q.patch.normal,row.patch.normal)>1-1e-6);
 return surfaceUncoveredEdges(row.boundary,neighbors.flatMap(q=>q.boundary),1e-4);
}
function surfaceLayerFrame(patch){
 const normal=C.norm(patch.normal),up=C.sub([0,1,0],C.mul(normal,normal[1])),vertical=C.len(up)>.08,v=vertical?C.norm(up):C.norm(C.sub([0,0,1],C.mul(normal,normal[2])));let u=C.norm(C.cross(v,normal));
 if(Math.abs(u[0])>.05?u[0]<0:u[2]<0)u=C.mul(u,-1);
 return {u,v,normal,vertical};
}
function surfaceLayerBases(patches){
 const out=new Map();for(const p of patches){const id=p.baseId||p.id;let b=out.get(id);if(!b){const f=surfaceLayerFrame(p);out.set(id,b={...f,minU:Infinity,maxU:-Infinity,minV:Infinity,maxV:-Infinity,minY:Infinity,maxY:-Infinity});}const T=surfaceTriangles(p,false);for(let i=0;i<T.length;i+=3){const q=T.slice(i,i+3),x=C.dot(q,b.u),y=C.dot(q,b.v);b.minU=Math.min(b.minU,x);b.maxU=Math.max(b.maxU,x);b.minV=Math.min(b.minV,y);b.maxV=Math.max(b.maxV,y);b.minY=Math.min(b.minY,q[1]);b.maxY=Math.max(b.maxY,q[1]);}}
 return out;
}
// Allocate a bounded visual budget before drawing any face. A small floor and
// area-weighted remainder keep late/short/aft faces from being starved by a
// large earlier wall. Largest-remainder rounding preserves the global cap.
function surfaceVisualShares(patches,total,floor){
 const out=new Map();if(!patches.length||!total)return out;const base=Math.min(floor,Math.floor(total/patches.length)),remaining=total-base*patches.length,weight=patches.reduce((n,p)=>n+Math.max(.001,p.exposedArea??p.area),0),fractions=[];let used=0;
 for(let i=0;i<patches.length;i++){const p=patches[i],exact=remaining*Math.max(.001,p.exposedArea??p.area)/weight,q=base+Math.floor(exact);out.set(p.id,q);used+=q;fractions.push({id:p.id,rest:exact-Math.floor(exact),i});}
 fractions.sort((a,b)=>b.rest-a.rest||a.i-b.i);for(let i=0;i<total-used;i++){const id=fractions[i%fractions.length].id;out.set(id,out.get(id)+1);}return out;
}
// Physical service cells never form visible tiles. This face-wide service field
// is neutral scenery: its shelves, cases and conduits add zero capacity. Small
// working faces are owned by the installed common device beside them, so local
// damage, selection and S-foil ownership still refer to real design entities.
function surfaceEquipmentField(ship,patch,cells,style,detail,extraBudget,fieldBudget,config,face,base){
 const frame=base||surfaceLayerFrame(patch),{u,v,normal}=frame,T=surfaceTriangles(patch),origin=patch.center,uv=p=>{const q=C.sub(p,origin);return [C.dot(q,u),C.dot(q,v),C.dot(q,normal)];},tris=[],baseHeight=base?base.maxV-base.minV:Math.sqrt(patch.area),relief=Math.max(.02,Math.min(patch.depth||30,style.depth>0?Math.min(30,style.depth):Math.min(16,Math.max(1.2,baseHeight*.16),(patch.depth||30)*.32))),recess=surfaceRecess(ship,patch,relief),frontT=recess.frontTriangles;
 for(let i=0;i+8<frontT.length;i+=9){const t=[frontT.slice(i,i+3),frontT.slice(i+3,i+6),frontT.slice(i+6,i+9)].map(p=>[...uv(p),uv(recess.pointAt(p))[2]]);t.bounds=[Math.min(...t.map(p=>p[0])),Math.min(...t.map(p=>p[1])),Math.max(...t.map(p=>p[0])),Math.max(...t.map(p=>p[1]))];tris.push(t);}
 const points=tris.flat(),lo=[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1]))],hi=[Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))],blocked=[],host=/^p\d+$/.test(patch.host)?+patch.host.slice(1):patch.host,random=rng(surfaceSeed(patch.id+'|field',style.seed)),field=[],boxes=[],devices=[],paint=surfaceHostPaint(ship,patch);
 const at=(x,y,z)=>C.add(origin,C.add(C.add(C.mul(u,x),C.mul(v,y)),C.mul(normal,z)));
 const clip=(poly,axis,limit,sign)=>{const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=(a[axis]-limit)*sign,db=(b[axis]-limit)*sign;if(da>=-1e-8)out.push(a);if((da<0)!==(db<0)){const t=da/(da-db);out.push(a.map((q,j)=>q+(b[j]-q)*t));}}return out;};
 const reserve=(b,pad=0,rotation=false)=>{if(!b?.every(Number.isFinite))return;const P=[];for(let i=0;i<8;i++)P.push(uv([b[i&1?3:0],b[i&2?4:1],b[i&4?5:2]]));if(Math.min(...P.map(p=>p[2]))>6||Math.max(...P.map(p=>p[2]))<-.1)return;let a=[Math.min(...P.map(p=>p[0]))-pad,Math.min(...P.map(p=>p[1]))-pad,Math.max(...P.map(p=>p[0]))+pad,Math.max(...P.map(p=>p[1]))+pad];if(rotation){const cx=(a[0]+a[2])/2,cy=(a[1]+a[3])/2,r=Math.max(a[2]-a[0],a[3]-a[1])*.56;a=[cx-r,cy-r,cx+r,cy+r];}blocked.push(a);};
 for(const f of surfaceRenderFits(ship))if(!f.float&&!f.surfaceUnplaced)reserve(C.fitAABB(f),embeddedSurfaceFit(f)?.12:.24,!embeddedSurfaceFit(f));
 for(const h of ship.hatches||[])reserve(C.openingBounds(ship,h),.18);
 for(const p of ship.parts||[])if(!p.surfacePatch&&['engine','nozzle','sensor'].includes(p.k))reserve(C.partAABB(p),.25);
 // Integrating clipped triangle area, rather than checking only four corners,
 // keeps even a small internal opening clear of a much larger service shelf.
 const space=b=>{if(!(b[2]>b[0]&&b[3]>b[1])||b[0]<lo[0]-1e-6||b[1]<lo[1]-1e-6||b[2]>hi[0]+1e-6||b[3]>hi[1]+1e-6||blocked.some(a=>b[2]>a[0]&&b[0]<a[2]&&b[3]>a[1]&&b[1]<a[3]))return null;let area=0,height=-Infinity,ceiling=Infinity,floor=-Infinity;
  for(const tri of tris){const a=tri.bounds;if(a[2]<b[0]||a[0]>b[2]||a[3]<b[1]||a[1]>b[3])continue;let p=tri;for(const [axis,limit,sign]of [[0,b[0],1],[0,b[2],-1],[1,b[1],1],[1,b[3],-1]]){p=clip(p,axis,limit,sign);if(p.length<3)break;}if(p.length<3)continue;let area2=0;for(let i=0;i<p.length;i++){const q=p[i],r=p[(i+1)%p.length];area2+=q[0]*r[1]-q[1]*r[0];height=Math.max(height,q[2]);ceiling=Math.min(ceiling,q[2]);floor=Math.max(floor,q[3]);}area+=Math.abs(area2)*.5;}
  if(area<(b[2]-b[0])*(b[3]-b[1])*(1-1e-6))return null;
  if(patch.exposedTriangles==null&&patch.exposedArea<patch.area*.999){for(const [x,y]of [[b[0],b[1]],[b[2],b[1]],[b[0],b[3]],[b[2],b[3]],[(b[0]+b[2])/2,(b[1]+b[3])/2]]){const p=C.add(origin,C.add(C.add(C.mul(u,x),C.mul(v,y)),C.mul(normal,height+2))),hit=C.surfacePick(ship,p,C.mul(normal,-1));if(hit?.id!==patch.id)return null;}}
  return {height,ceiling:ceiling-.012,floor:floor+.008};
 };
 const checkOwner=ship.solidCuts?.length||patch._part?.mesh||['outline','shell','arc'].includes(patch._part?.form),inside=p=>patch._part?C.inPart(patch._part,p):C.inHull(ship,p);
 const piece=(target,feature,x,y,w,h,z,d,color,ownerId=host,role=null,type='box',opts={})=>{if(target===field&&field.length>=fieldBudget)return null;const bounds=[x-w/2,y-h/2,x+w/2,y+h/2],s=space(bounds);if(!s||s.ceiling-s.floor<.006)return null;d=Math.min(d,s.ceiling-s.floor);const center=C.clamp(s.height-relief+z,s.floor+d/2,s.ceiling-d/2),q={feature,type,ownerId,role,center:at(x,y,center),u,v,normal,size:[w,h,d],bounds,color:surfaceEquipmentPaint(paint,color,feature,opts.port),...opts};
  if(checkOwner)for(const a of [-1,1])for(const b of [-1,1])for(const c of [-1,1])if(!inside(at(x+a*w/2,y+b*h/2,center+c*d/2)))return null;
  target.push(q);return q;};
 const grey=()=>{const a=Math.round(90+random()*35);return [a,a+5,a+10];};
 // Coarse face regions guide category inlays without defining real parts.
 const strata=[],pitch=C.clamp(6.4+Math.log2(Math.max(1,ship.hull.L/80))*.9,6.4,12.6),slab=C.clamp(pitch*.06,.14,.38),worldU=C.dot(origin,u),worldV=C.dot(origin,v);
 const mergeIntervals=list=>{list.sort((a,b)=>a[0]-b[0]);const out=[];for(const p of list){const q=out.at(-1);if(q&&p[0]<=q[1]+1e-5)q[1]=Math.max(q[1],p[1]);else out.push(p.slice());}return out;};
 const slice=y=>{const list=[];for(const tri of tris){const xs=[];for(let j=0;j<3;j++){const a=tri[j],b=tri[(j+1)%3];if(Math.abs(a[1]-y)<1e-7)xs.push(a[0]);if((a[1]<y)!==(b[1]<y)){const t=(y-a[1])/(b[1]-a[1]);xs.push(a[0]+(b[0]-a[0])*t);}}if(xs.length>1)list.push([Math.min(...xs),Math.max(...xs)]);}return mergeIntervals(list);};
 const band=(y,h)=>{const low=y-h/2,high=y+h/2,ys=[low+1e-5,high-1e-5,y];for(const tri of tris)for(const p of tri)if(p[1]>low&&p[1]<high)ys.push(p[1]-1e-5,p[1]+1e-5);let spans=null;for(const yy of ys){const row=slice(yy),next=[];if(spans==null){spans=row;continue;}for(const a of spans)for(const b of row){const l=Math.max(a[0],b[0]),r=Math.min(a[1],b[1]);if(r-l>.04)next.push([l,r]);}spans=mergeIntervals(next);if(!spans.length)break;}for(const q of blocked)if(q[3]>low&&q[1]<high){const next=[];for(const p of spans||[]){if(q[0]>p[0])next.push([p[0],Math.min(p[1],q[0])]);if(q[2]<p[1])next.push([Math.max(p[0],q[2]),p[1]]);}spans=next.filter(p=>p[1]-p[0]>.08);}return spans||[];};
 // Relief follows the face's own tangent frame. Even a tilted block carries
 // long, shallow horizontal courses rather than projecting deep shelves from
 // its normal. The backing and bevel facets form one opened low-poly skin.
 const deck=(feature,x,Y,w,h,back,front,color)=>{
  const y=frame.vertical?(Y-origin[1])/Math.max(.08,v[1]):Y-worldV;
  return piece(field,feature,x,y,w,h,(back+front)/2,front-back,color,host,null,'relief',{stratum:true,level:Y});
 };
 const lowLevel=base?(frame.vertical?base.minY:base.minV):lo[1]+(frame.vertical?origin[1]:worldV),highLevel=base?(frame.vertical?base.maxY:base.maxV):hi[1]+(frame.vertical?origin[1]:worldV),levels=[];
 for(let Y=Math.ceil((lowLevel+slab)/pitch)*pitch;Y<highLevel-slab;Y+=pitch)levels.push(Y);for(const Y of [lowLevel+slab/2,highLevel-slab/2])if(!levels.some(q=>Math.abs(q-Y)<slab*2))levels.push(Y);levels.sort((a,b)=>a-b);
 const floorRows=[];
 if(fieldBudget>0){
  const baseMinU=base?.minU??lo[0]+worldU,baseMaxU=base?.maxU??hi[0]+worldU,macro=C.clamp(ship.hull.L*.08,24,80),maxFloor=Math.max(levels.length,Math.floor(fieldBudget*.48));
  for(const Y of levels){const y=frame.vertical?(Y-origin[1])/Math.max(.08,v[1]):Y-worldV,extent=slab,spans=band(y,extent),R=rng(surfaceSeed((patch.baseId||patch.id)+'|floor|'+Y.toFixed(4),style.seed)),profiles=[];let a=baseMinU;
   while(a<baseMaxU-.01){const b=Math.min(baseMaxU,a+macro*(.7+R()*.7)),front=(.67+R()*.28)*relief;profiles.push([a,b,front]);a=b;}
   for(const span of spans){const parts=[];for(const profile of profiles){const a=Math.max(span[0],profile[0]-worldU)+.012,b=Math.min(span[1],profile[1]-worldU)-.012;if(b-a>.12)parts.push([a,b,profile[2]]);}if(field.length+parts.length>maxFloor&&span[1]-span[0]>.2){parts.length=0;parts.push([span[0]+.012,span[1]-.012,relief*.82]);}
    for(const [a,b,front]of parts){const q=deck('stratum-floor',(a+b)/2,Y,b-a,slab,relief*.025,front,[130,139,147]);if(q){strata.push({level:Y,width:b-a,center:q.center.slice(),front});floorRows.push({Y,y,a,b,front});}}
   }
  }
  // Long floor edges carry a narrow lip; the bays behind remain genuinely open.
  for(const p of floorRows){if(field.length>=fieldBudget*.60)break;deck('stratum-lip',(p.a+p.b)/2,p.Y+slab*.24,p.b-p.a,slab*.44,Math.max(relief*.03,p.front-.14),p.front+.025,[144,151,157]);}
  // Irregular machine banks occupy most bays near their deck fronts. Some
  // banks step far inward, leaving real recesses between the machinery itself.
  const minY=lo[1]+.12,maxY=hi[1]-.12,localPitch=frame.vertical?pitch/Math.max(.08,v[1]):pitch;
  for(let y=minY+localPitch*.49;y<maxY-localPitch*.22;y+=localPitch){const h=Math.min(localPitch*.82,maxY-y+localPitch*.28),spans=band(y,h),R=rng(surfaceSeed((patch.baseId||patch.id)+'|bay|'+Math.round((y+worldV)/localPitch),style.seed));
   for(const span of spans){let x=span[0]+.12;while(x<span[1]-.7&&field.length<fieldBudget*.86){x+=.18+R()*localPitch*.35;const w=Math.min((2.0+R()*4.2)*localPitch,span[1]-x-.14);if(w<.6)break;const ht=h*(.66+R()*.33),cy=y+(R()-.5)*(h-ht),back=relief*(.05+R()*.17),front=relief*(R()<.20?.43+R()*.19:.79+R()*.19);piece(field,'stratum-machinery',x+w/2,cy,w,ht,(back+front)/2,front-back,grey(),host,null,'box',{recess:true});
    x+=w+.18+R()*localPitch*.35;
   }}
  }
  // Broad raised plateaus interrupt the courses with larger machinery masses.
  for(let x=lo[0]+macro*.32;x<hi[0]-localPitch&&field.length<fieldBudget*.96;x+=macro*(.70+random()*.85)){const h=Math.min(localPitch*(.65+random()*.55),(hi[1]-lo[1])*.78),w=Math.min(localPitch*(2.4+random()*2.6),hi[0]-x-.12),y=lo[1]+h/2+.12+random()*Math.max(0,hi[1]-lo[1]-h-.24),back=relief*(.10+random()*.16),front=relief*(.87+random()*.11);piece(field,'stratum-core',x+w/2,y,w,h,(back+front)/2,front-back,[128,136,144],host,null,'box',{recess:true});}

 }
 if(face?.aggregate){
  // Functional paint is distributed across the generated face, not repeated
  // once per saved slot or common-network adapter. Capacity stays in Core.
  const roles=['cooling','sensors','habitation'].map(role=>({role,...face.categories?.[role]})).filter(q=>q.occupiedArea>0&&Number.isFinite(q.roleid)),cases=field.filter(q=>['stratum-machinery','stratum-core'].includes(q.feature)&&q.recess).map(q=>({q,rank:surfaceSeed(q.bounds.join('|'),style.seed)})).sort((a,b)=>a.rank-b.rank).map(p=>p.q),total=roles.reduce((n,q)=>n+q.occupiedArea,0),coverage=C.clamp(total/Math.max(.001,patch.exposedArea??patch.area),0,1),count=Math.min(96,cases.length,Math.max(roles.length,Math.round(cases.length*coverage))),weights=roles.map(()=>0);
  cells=[];for(let i=0;i<count&&roles.length;i++){let pick=i<roles.length?i:0;if(i>=roles.length){for(let j=0;j<roles.length;j++){weights[j]+=roles[j].occupiedArea/total;if(weights[j]>weights[pick])pick=j;}weights[pick]-=1;}const role=roles[pick],q=cases[i],point=q.center.slice();cells.push({id:role.roleid,aggregate:true,cell:'visual:'+role.role+':'+i,role:role.role,k:role.role==='cooling'?config.equipment.kind:role.role==='sensors'?'sensor':'habitat',point,w:q.size[0]*.85,h:q.size[1]*.85,depth:relief});}
 }
 const frontAt=b=>field.reduce((z,p)=>p.bounds[2]>b[0]&&p.bounds[0]<b[2]&&p.bounds[3]>b[1]&&p.bounds[1]<b[3]?Math.max(z,C.dot(C.sub(p.center,origin),normal)+(Math.abs(C.dot(p.u,normal))*p.size[0]+Math.abs(C.dot(p.v,normal))*p.size[1]+Math.abs(C.dot(p.normal,normal))*p.size[2])/2):z,-Infinity);
 for(const cell of cells){if(!cell.point?.every(Number.isFinite)||!(cell.w>0&&cell.h>0))continue;const point=cell.point.slice(),local=uv(point),r=rng(surfaceSeed(patch.id+'|'+cell.cell,style.seed)),hardware=[],variant=Math.floor(r()*4),item={id:cell.id,cell:cell.cell,role:cell.role,kind:cell.k||cell.kind,variant,point,center:point.slice(),u,v,normal,size:[cell.w,cell.h,cell.depth],depth:cell.depth,hardware,micro:[]};devices.push(item);
  // Guns use only the compact embedded apertures in meshFits. The surrounding
  // field leaves their actual opening clear without drawing a turret body.
  if(cell.role==='weapons')continue;
  let workLift=0,cueScale=1,cueCenter=local;const group=(w,h)=>{cueScale=cell.aggregate?Math.min(3.2,cell.w*.9/w,cell.h*.9/h):1;const W=w*cueScale,H=h*cueScale;for(let k=0;k<14;k++){const x=local[0]+(r()-.5)*Math.max(.02,cell.w-W-.04),y=local[1]+(r()-.5)*Math.max(.02,cell.h-H-.04),b=[x-W/2,y-H/2,x+W/2,y+H/2],s=space(b);if(s){workLift=Math.max(0,frontAt(b)-s.height+relief-.62);cueCenter=[x,y];return [x,y];}}return null;};
  const add=(feature,x,y,w,h,z,d,color,type='box',opts={})=>piece(hardware,feature,cueCenter[0]+(x-cueCenter[0])*cueScale,cueCenter[1]+(y-cueCenter[1])*cueScale,w*cueScale,h*cueScale,z+workLift,d,color,cell.id,cell.role,'inlay',{...opts,...(opts.radius?{radius:opts.radius*cueScale}:{})});
  if(cell.role==='cooling')for(let q=0;q<1+variant%2;q++){const w=.65+r()*1.25,h=.35+r()*.9,p=group(w,h);if(!p)continue;const [x,y]=p;add('cooling-recess',x,y,w,h,.74,.08,[60,74,85]);const count=4+Math.floor(r()*5),vertical=variant===2;for(let i=0;i<count;i++)add('cooling-grille',x+(vertical?(i/(count-1)-.5)*w*.87:0),y+(vertical?0:(i/(count-1)-.5)*h*.80),vertical?w/count*.30:w*.90,vertical?h*.90:h/count*.31,.81,.07,[127,141,151]);}
  else if(cell.role==='sensors'){const size=.55+r()*.95,p=group(size,size);if(p){const [x,y]=p;if(variant===0||variant===3)add('sensor-array',x,y,size,size,.86,.30,[139,153,164],'dish',{radius:size/2});else{add('sensor-array',x,y,size,size*(variant===1?.57:1),.76,.10,[72,90,106]);const count=variant===1?4:3;for(let i=0;i<count;i++)add('sensor-element',x+(i-(count-1)/2)*size/count*.9,y,size/count*.47,size*(variant===1?.37:.72),.84,.065,[138,154,168]);}}}
  else if(cell.role==='habitation')for(let bank=0;bank<1+variant%3;bank++){const width=1.1+r()*1.35,p=group(width,.32);if(!p)continue;const [x,y]=p;add('window-recess',x,y,width,.27,.78,.05,[46,59,70]);const count=3+Math.floor(r()*4);for(let i=0;i<count;i++){const lit=r()>.22;add('habitation-window',x+(i-(count-1)/2)*width*.84/count,y,width*.64/count,.17,.825,.025,lit?[232,218,169]:[75,84,92],'box',{port:lit});}}
 }
 // Density controls only a few large surface inlays, independently of
 // functional capacity and the continuous base relief.
 const housings=field.filter(p=>['stratum-machinery','stratum-core'].includes(p.feature)),extras=Math.min(extraBudget,Math.round(housings.length*C.clamp(style.density??0,0,1)*detail*.6));
 for(let i=0;i<extras*3&&boxes.length<extras&&housings.length;i++){const parent=housings[Math.floor(random()*housings.length)],b=parent.bounds,w=Math.min(10,(b[2]-b[0])*(.35+random()*.35)),h=Math.min(3,(b[3]-b[1])*(.25+random()*.35)),x=b[0]+w/2+random()*(b[2]-b[0]-w),y=b[1]+h/2+random()*(b[3]-b[1]-h),d=.055+random()*.12;
  const s=space([x-w/2,y-h/2,x+w/2,y+h/2]);if(s)piece(boxes,'service-detail',x,y,w,h,C.dot(C.sub(parent.center,origin),normal)+parent.size[2]/2-s.height+relief+d/2,d,grey(),host,null,'relief');
 }
 // Irregular stacked deck blocks carry the silhouette. The space between
 // them is a single recessed machinery panel, detailed by a shared texture,
 // not hundreds of individually tessellated cabinets, fins and pipes.
 const reliefFaces=[],skinBuckets=new Map(),gridSeed=patch.baseId||patch.id,targetCells=Math.max(4,Math.floor((base?.fieldBudget??fieldBudget)/28));let gridHeight=pitch,gridWidth=gridHeight*4.5;
 const axisAt=(i,axis)=>i*(axis?gridHeight:gridWidth);
 const axisIndex=(x,axis)=>Math.floor(x/(axis?gridHeight:gridWidth));
 const gridCells=()=> (axisIndex(base?.maxU??hi[0]+worldU,0)-axisIndex(base?.minU??lo[0]+worldU,0)+1)*(axisIndex(base?.maxV??hi[1]+worldV,1)-axisIndex(base?.minV??lo[1]+worldV,1)+1);
 for(let step=0;step<80&&gridCells()>targetCells;step++){const scale=Math.max(1.08,Math.sqrt(gridCells()/targetCells));gridHeight*=scale;gridWidth=gridHeight*4.5;}
 const terrain=new Map(),lengthPhase=surfaceSeed(gridSeed+'|deck-length-phase',style.seed)%5;
 const bary=(T,x,y)=>{const [a,b,c]=T,det=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(det)<1e-14)return null;const A=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/det,B=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/det,D=1-A-B;if(Math.min(A,B,D)<-1e-6)return null;return a[2]*A+b[2]*B+c[2]*D;};
 const terrainCell=(i,j)=>{const key=i+'|'+j,old=terrain.get(key);if(old)return old;
  // Each plate owns its seeded position, thickness and setback. Cell edges
  // remain on the common recessed backing, so semantic splits and clipped
  // holes cannot restart a pattern or open cracks between adjacent plates.
  const r=rng(surfaceSeed(gridSeed+'|staggered-deck|'+key,style.seed)),x0=axisAt(i,0),x1=axisAt(i+1,0),y0=axisAt(j,1),y1=axisAt(j+1,1),W=x1-x0,H=y1-y0,back=.04,peak=.28+r()*.70,
   category=((i+2*j+lengthPhase)%5+5)%5,
   width=W*(category<2?.45+r()*.20:category<4?.70+r()*.20:.92+r()*.06),thickness=H*(.78+r()*.18),cx=x0+width/2+W*.01+r()*(W-width-W*.02),cy=y0+H*.5+(r()-.5)*(H*.98-thickness),bevelX=Math.min(W*.006,.18),bevelY=H*.004,
   left=cx-width/2,right=cx+width/2,bottom=cy-thickness/2,top=cy+thickness/2,shapes=[],rect=(l,b,r,t,z)=>[[l,b,z],[r,b,z],[r,t,z],[l,t,z]],
   boundary=rect(x0,y0,x1,y1,back),shoulder=rect(left-bevelX,bottom-bevelY,right+bevelX,top+bevelY,back),front=rect(left,bottom,right,top,peak);
  const quad=(p,tone,machinery=false)=>shapes.push({points:[p[0],p[1],p[2]],tone,machinery},{points:[p[0],p[2],p[3]],tone,machinery});
  // Four large texture-backed polygons replace all small machinery models.
  // The narrow bevels are the actual upper, lower and end faces of each plate.
  for(let k=0;k<4;k++){const next=(k+1)%4;quad([boundary[k],boundary[next],shoulder[next],shoulder[k]],.75,true);quad([shoulder[k],shoulder[next],front[next],front[k]],k===0?.62:k===2?.98:.78);}
  quad(front,.86);
  const tops=[{bounds:[left,cy-H*.34,right,cy+H*.34],height:peak,kind:'deck-shoulder'}],cell={shapes,tops,bounds:[x0,y0,x1,y1]};terrain.set(key,cell);return cell;
 };
 const gridAt=(x,y)=>{const X=x+worldU,Y=y+worldV,cell=terrainCell(axisIndex(X,0),axisIndex(Y,1));for(const shape of cell.shapes){const h=bary(shape.points,X,Y);if(h!=null)return h;}return .075;};
 const hostCenter=patch._part?.c||[ship.hull.L/2,ship.hull.H/2,0],safePoints=new Map();
 const safePoint=(p,front,hint)=>{const key=p.map(v=>v.toFixed(7)).join(','),old=safePoints.get(key);if(old)return old;const float=q=>Array.from(Float32Array.from(q));let q=float(p);
  if(!inside(q)){const candidates=[C.add(p,C.mul(C.sub(hostCenter,p),1e-5)),... [hint||C.sub(patch.center,p),C.sub(patch.center,p),C.mul(normal,-1),C.sub(hostCenter,p)].map(d=>C.add(p,C.mul(C.norm(d),.003)))];let found=candidates.find(v=>inside(float(v)));
   // At an oblique CSG boundary the interpolated backing can be deeper than
   // the local material. Shorten that ray toward its actual exterior skin.
   if(!found&&front){let inner=float(hint?C.sub(C.add(front,C.mul(C.norm(hint),.005)),C.mul(normal,.0005)):C.add(front,C.mul(C.sub(hostCenter,front),1e-5)));if(!inside(inner))inner=float(C.add(front,C.mul(C.norm(C.sub(patch.center,front)),.003)));if(inside(inner)){let outer=p;for(let step=0;step<14;step++){const mid=C.mul(C.add(inner,outer),.5);if(inside(float(mid)))inner=mid;else outer=mid;}found=inner;}}
   if(found)q=float(found);
  }safePoints.set(key,q);return q;};
 // Lamps and category marks sit on the final clipped Float32 facets,
 // including tapered recesses; they never sample a smoother analytic skin.
 const skinHeight=(x,y)=>{const i=axisIndex(x+worldU,0),j=axisIndex(y+worldV,1);for(const [dx,dy]of [[0,0],[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]])for(const T of skinBuckets.get((i+dx)+'|'+(j+dy))||[]){const h=bary(T,x,y);if(h!=null)return h;}return null;};
 const clipLine=(poly,A,B,sign)=>{const out=[],distance=p=>((B[0]-A[0])*(p[1]-A[1])-(B[1]-A[1])*(p[0]-A[0]))*sign;for(let k=0;k<poly.length;k++){const a=poly[k],b=poly[(k+1)%poly.length],da=distance(a),db=distance(b);if(da>=-1e-8)out.push(a);if((da<0)!==(db<0)){const t=da/(da-db);out.push(a.map((v,j)=>v+(b[j]-v)*t));}}return out;};
 const withoutBlocked=poly=>{let list=[poly];for(const b of blocked){const next=[];for(const p of list){let rest=p;for(const [axis,limit,sign]of [[0,b[0],1],[0,b[2],-1],[1,b[1],1],[1,b[3],-1]]){const outside=clip(rest,axis,limit,-sign);if(outside.length>2)next.push(outside);rest=clip(rest,axis,limit,sign);if(rest.length<3)break;}}list=next;}return list;};
 const visibleTops=[];
 if((base?.fieldBudget??fieldBudget)>0)for(let j=axisIndex(lo[1]+worldV,1);j<=axisIndex(hi[1]+worldV,1);j++)for(let i=axisIndex(lo[0]+worldU,0);i<=axisIndex(hi[0]+worldU,0);i++){
  const cell=terrainCell(i,j);visibleTops.push(...cell.tops);for(const shape of cell.shapes){const grid=shape.points.map(p=>[p[0]-worldU,p[1]-worldV]),minX=Math.min(...grid.map(p=>p[0])),maxX=Math.max(...grid.map(p=>p[0])),minY=Math.min(...grid.map(p=>p[1])),maxY=Math.max(...grid.map(p=>p[1])),triangles=[];
   for(const t of tris){if(t.bounds[2]<minX||t.bounds[0]>maxX||t.bounds[3]<minY||t.bounds[1]>maxY)continue;let poly=t;for(let k=0;k<3;k++){poly=clipLine(poly,grid[k],grid[(k+1)%3],1);if(poly.length<3)break;}if(poly.length<3)continue;
    for(const p of withoutBlocked(poly)){const hint=C.mul(t.reduce((a,q)=>C.add(a,at(q[0],q[1],q[2])),[0,0,0]),1/3),points=p.map(q=>{const h=bary(shape.points,q[0]+worldU,q[1]+worldV)??gridAt(q[0],q[1]),front=at(q[0],q[1],q[2]);return safePoint(at(q[0],q[1],q[3]+(q[2]-q[3])*h),front,C.sub(hint,front));});for(let k=1;k<points.length-1;k++){const tri=[points[0],points[k],points[k+1]],n=C.cross(C.sub(tri[1],tri[0]),C.sub(tri[2],tri[0]));if(C.len(n)<1e-8)continue;if(C.dot(n,normal)<0)tri.reverse();triangles.push(...tri.flat());const key=i+'|'+j,bucket=skinBuckets.get(key)||[];bucket.push(tri.map(p=>uv(p)));skinBuckets.set(key,bucket);}}
   }if(triangles.length)reliefFaces.push({triangles,color:surfacePaintTone(paint,shape.tone),machinery:shape.machinery});
  }
 }
 const seatInlay=q=>{const b=q.bounds,ps=[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]]],points=ps.map(([x,y])=>{const z=skinHeight(x,y);if(z==null)return null;return safePoint(at(x,y,z+.002),at(x,y,0));});if(points.some(p=>!p))return false;q.type='inlay';q.points=points;q.center=C.mul(points.reduce((a,b)=>C.add(a,b),[0,0,0]),.25);return true;};
 for(const device of devices)device.hardware=device.hardware.filter(seatInlay);for(let i=boxes.length-1;i>=0;i--){if(!seatInlay(boxes[i]))boxes.splice(i,1);else boxes[i].color=surfacePaintTone(paint,i%3===0?.50:i%3===1?.70:.94);}
 // Navigation/service lamps belong to the skin, independently of the
 // habitation allocation. They are tiny emissive faces, never extra devices.
 const lights=[];for(const q of field)q.type='relief';
 const lampSurfaces=visibleTops.filter(q=>q.bounds[2]-q.bounds[0]>2&&q.bounds[3]-q.bounds[1]>1.2),lampCount=Math.min(192,Math.max(6,Math.round(Math.sqrt(patch.exposedArea??patch.area)/12)*6));
 for(let i=0;i<lampCount&&lampSurfaces.length;i++){
  const bank=Math.floor(i/6),r=rng(surfaceSeed(gridSeed+'|lamps|'+bank,style.seed)),q=lampSurfaces[Math.floor(r()*lampSurfaces.length)],B=q.bounds,b=[B[0]-worldU,B[1]-worldV,B[2]-worldU,B[3]-worldV],w=Math.min(.95,(b[2]-b[0])/7),h=Math.min(.65,(b[3]-b[1])/5),x=(b[0]+b[2])/2+(r()-.5)*Math.max(0,b[2]-b[0]-w*6)+(i%3-1)*w*1.8,y=(b[1]+b[3])/2+(r()-.5)*Math.max(0,b[3]-b[1]-h*3.3)+(Math.floor(i/3)%2-.5)*h*1.9,s=space([x-w/2,y-h/2,x+w/2,y+h/2]);if(!s)continue;
  const z=skinHeight(x,y);if(z==null)continue;
  if(z>s.ceiling)continue;const lamp={feature:'service-light',type:'inlay',ownerId:host,role:null,center:at(x,y,z),u,v,normal,size:[w,h,.002],bounds:[x-w/2,y-h/2,x+w/2,y+h/2],color:bank%4===0?[166,205,238]:[242,226,184],port:true};if(seatInlay(lamp))lights.push(lamp);
 }
 return {field,reliefFaces,attachmentSites:visibleTops,gridCells:gridCells(),boxes,devices,lights,paint,frame:{u,v,normal},strata,layerPitch:pitch,visualDepth:relief,functionalDepth:config.equipment.depth,recessDepth:recess.recessDepth,backingTriangles:recess.backingTriangles};
}
// Attached round machinery and small walks share the host's surface batches.
// Build them once over a base face's exposed union: a semantic split never
// chops a cylinder into capped halves or duplicates a projecting railing.
function surfaceProjectionShares(groups,budget){
 const out=new Map(groups.map(g=>[g.id,0])),limit=Math.min(groups.length*3,Math.floor(Math.max(0,budget)/40)),rank=new Map(groups.map(g=>[g.id,surfaceSeed(g.id+'|projection-quota',0)]));
 // Allocate the fractional whole-ship budget before applying the per-face
 // ceiling. Hundreds of small faces still receive a varied, bounded sample.
 // Clipping round-off counts as equal weight when a face is partitioned.
 for(let slot=0;slot<limit;slot++){let chosen=null,best=-Infinity;for(const g of groups){const count=out.get(g.id);if(count>=3)continue;const score=Math.max(.001,g.area)/(count+1),tie=chosen&&Math.abs(score-best)<=Math.max(1e-8,Math.abs(best)*1e-6);if(!chosen||score>best&&!tie||tie&&rank.get(g.id)<rank.get(chosen.id)){chosen=g;best=score;}}if(!chosen)break;out.set(chosen.id,out.get(chosen.id)+1);}return out;
}
function surfaceEquipmentProjections(ship,rows,quota){
 if(!quota||!rows.length)return;
 const first=rows[0],{u,v,normal:n}=first.frame,baseId=first.patch.baseId||first.id,seed=first.config.style?.seed,D=C.dot(first.patch.center,n),paint=first.paint,T=rows.flatMap(r=>surfaceTriangles(r.patch)),skin=rows.flatMap(r=>r.reliefFaces.flatMap(q=>q.triangles)),host=/^p\d+$/.test(first.host)?+first.host.slice(1):first.host;
 // Projecting machinery needs one actual mounting plane. Curved hull
 // collections retain their interior skin until a planar face is selected.
 let minPlane=Infinity,maxPlane=-Infinity;for(let i=0;i<T.length;i+=9){const a=T.slice(i,i+3),b=T.slice(i+3,i+6),c=T.slice(i+6,i+9),sn=C.norm(C.cross(C.sub(b,a),C.sub(c,a)));if(Math.abs(C.dot(sn,n))<.995)return;for(const p of [a,b,c]){const d=C.dot(p,n);minPlane=Math.min(minPlane,d);maxPlane=Math.max(maxPlane,d);}}if(maxPlane-minPlane>.05)return;
 const uv=p=>[C.dot(p,u),C.dot(p,v)],at=(x,y,z)=>C.add(C.add(C.mul(u,x),C.mul(v,y)),C.mul(n,D+z)),normalAt=p=>C.dot(p,n)-D,clip=(poly,axis,limit,sign)=>{const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=(a[axis]-limit)*sign,db=(b[axis]-limit)*sign;if(da>=-1e-8)out.push(a);if((da<0)!==(db<0)){const t=da/(da-db);out.push(a.map((q,j)=>q+(b[j]-q)*t));}}return out;},source=[];
 for(let i=0;i<T.length;i+=9){const q=[uv(T.slice(i,i+3)),uv(T.slice(i+3,i+6)),uv(T.slice(i+6,i+9))];q.bounds=[Math.min(...q.map(p=>p[0])),Math.min(...q.map(p=>p[1])),Math.max(...q.map(p=>p[0])),Math.max(...q.map(p=>p[1]))];source.push(q);}
 const blocked=[],occupied=[],reserve=b=>{if(!b?.every(Number.isFinite))return;const ps=[];for(let i=0;i<8;i++)ps.push([b[i&1?3:0],b[i&2?4:1],b[i&4?5:2]]);const zs=ps.map(normalAt);if(Math.min(...zs)>5||Math.max(...zs)<-1)return;const q=ps.map(uv);blocked.push([Math.min(...q.map(p=>p[0]))-.2,Math.min(...q.map(p=>p[1]))-.2,Math.max(...q.map(p=>p[0]))+.2,Math.max(...q.map(p=>p[1]))+.2]);};
 for(const f of surfaceRenderFits(ship))if(!f.float&&!f.surfaceUnplaced)reserve(C.fitAABB(f));for(const h of ship.hatches||[])reserve(C.openingBounds(ship,h));
 for(const p of ship.parts||[])if(p.id!==host&&!p.surfacePatch&&['sensor','engine','nozzle'].includes(p.k))reserve(C.partAABB(p));
 const fits=b=>{if(!(b[2]>b[0]&&b[3]>b[1])||[...blocked,...occupied].some(a=>b[2]>a[0]&&b[0]<a[2]&&b[3]>a[1]&&b[1]<a[3]))return false;let area=0;
  for(const t of source){if(t.bounds[2]<b[0]||t.bounds[0]>b[2]||t.bounds[3]<b[1]||t.bounds[1]>b[3])continue;let p=t;for(const [axis,limit,sign]of [[0,b[0],1],[0,b[2],-1],[1,b[1],1],[1,b[3],-1]]){p=clip(p,axis,limit,sign);if(p.length<3)break;}for(let k=1;k<p.length-1;k++)area+=Math.abs((p[k][0]-p[0][0])*(p[k+1][1]-p[0][1])-(p[k][1]-p[0][1])*(p[k+1][0]-p[0][0]))/2;
  }return area>=(b[2]-b[0])*(b[3]-b[1])*(1-2e-5);
 };
 const sites=new Map();for(const row of rows)for(const site of row.attachmentSites||[]){if(site.height<.15)continue;const key=site.bounds.map(x=>x.toFixed(5)).join('|');if(!sites.has(key))sites.set(key,{...site,key,rank:surfaceSeed(baseId+'|attached|'+key,seed)});}
 const candidates=[...sites.values()].sort((a,b)=>a.rank-b.rank),order=['turbine','round-housing','catwalk'],shift=quota<3?surfaceSeed(baseId+'|attachment-kind',seed)%3:0,kinds=order.slice(shift).concat(order.slice(0,shift));let placed=0;
 for(const kind of kinds){if(placed>=quota)break;if(kind==='catwalk'&&Math.abs(n[1])>.55)continue;
  for(const site of candidates){const b=site.bounds,W=b[2]-b[0],H=b[3]-b[1],x=(b[0]+b[2])/2,y=(b[1]+b[3])/2;if(W<5||H<3)continue;
   const hit=C.rayTris(skin,at(x,y,12),C.mul(n,-1));if(!hit)continue;const anchor=hit.p,z=normalAt(anchor),batches=[];
   const batch=(factor,build)=>{const color=surfacePaintTone(paint,factor),g=new Geo(128);build(g,color);const triangles=[];for(let j=0;j<g.ni;j++){const k=g.idx[j]*3;triangles.push(g.pos[k],g.pos[k+1],g.pos[k+2]);}if(triangles.length)batches.push({triangles,color});};
   const boxAt=(g,c,a,out,w,d,h,col)=>box(g,[...a,...out,...C.cross(a,out)],c,0,0,0,w,d,h,col);
   let center=anchor,axis=n,dimensions,catwalkWidth=null,attachmentReach=0,maxAttachmentReach=0;
   if(kind==='turbine'){
    const radius=Math.min(2.8,H*.20,W*.11),length=Math.min(19,W*.70);if(radius<.7||length<5)continue;const cz=Math.min(.15,Math.max(-.18,z+radius*.42));attachmentReach=Math.max(0,cz-radius*.6-z);maxAttachmentReach=Math.min(2,radius*.8);if(attachmentReach>maxAttachmentReach)continue;center=at(x,y,cz);axis=u;dimensions=[length,radius*2,radius*2];
    batch(.88,(g,col)=>{const profiles=[[-.5,.72],[-.38,1],[.34,1],[.5,.78]];for(let k=1;k<profiles.length;k++)axisFrustum(g,C.add(center,C.mul(u,length*profiles[k-1][0])),C.add(center,C.mul(u,length*profiles[k][0])),radius*profiles[k-1][1],radius*profiles[k][1],col,false,false,8);});
    batch(.97,(g,col)=>{for(const t of [-.27,.18])axisFrustum(g,C.add(center,C.mul(u,length*t-radius*.055)),C.add(center,C.mul(u,length*t+radius*.055)),radius*1.08,radius*1.08,col,false,false,8);});
    batch(.66,(g,col)=>{for(const side of [-1,1]){const end=C.add(center,C.mul(u,length*.5*side)),f=C.frameAxis(u),outer=radius*(side<0?.72:.78),inner=outer*.52,point=(r,t)=>C.add(end,C.add(C.mul(f.v,r*Math.cos(t)),C.mul(f.w,r*Math.sin(t))));for(let k=0;k<8;k++){const a=k*Math.PI/4,b=(k+1)*Math.PI/4,ps=[point(outer,a),point(outer,b),point(inner,b),point(inner,a)];if(side<0)ps.reverse();hullQuad(g,ps,C.mul(u,side),col,30);}const cap=C.sub(end,C.mul(u,side*radius*.14));for(let k=0;k<8;k++){const a=C.sub(point(inner,k*Math.PI/4),C.mul(u,side*radius*.14)),b=C.sub(point(inner,(k+1)*Math.PI/4),C.mul(u,side*radius*.14)),ps=[cap,a,b];if(C.dot(C.cross(C.sub(a,cap),C.sub(b,cap)),C.mul(u,side))<0)ps.reverse();triangleMesh(g,ps.flat(),col,30);}}});
    batch(.77,(g,col)=>{for(const t of [-.28,.28]){const foot=C.add(at(x,y,(z+cz-radius*.6)/2),C.mul(u,length*t));boxAt(g,foot,u,n,length*.12,Math.max(.15,cz-radius*.6-z),radius*.65,col);}});
   }else if(kind==='round-housing'){
    const radius=Math.min(4.1,W*.25,H*.32);if(radius<.9)continue;const top=Math.max(.65,z+Math.min(2.6,radius*.85)),lift=top-z;attachmentReach=lift;maxAttachmentReach=Math.min(3.5,radius*1.5);if(lift>maxAttachmentReach)continue;center=at(x,y,z+lift*.5);dimensions=[radius*2,radius*2,lift];
    const rings=[[0,.70],[.25,1],[.78,.74],[1,.28]],point=(level,r,t)=>at(x+radius*r*Math.cos(t),y+radius*r*Math.sin(t),z+lift*level);
    batch(.92,(g,col)=>{for(let j=1;j<rings.length;j++)for(let k=0;k<10;k++){const a=k*Math.PI/5,b=(k+1)*Math.PI/5,ps=[point(...rings[j-1],a),point(...rings[j-1],b),point(...rings[j],b),point(...rings[j],a)],sn=C.norm(C.cross(C.sub(ps[1],ps[0]),C.sub(ps[2],ps[0]))),radial=C.add(C.mul(u,Math.cos((a+b)/2)),C.mul(v,Math.sin((a+b)/2))),flip=C.dot(sn,radial)<0;hullQuad(g,flip?ps.reverse():ps,flip?C.mul(sn,-1):sn,col,30);}for(let k=0;k<10;k++){const a=point(1,.28,k*Math.PI/5),b=point(1,.28,(k+1)*Math.PI/5),c=at(x,y,top),T=[c,a,b];if(C.dot(C.cross(C.sub(a,c),C.sub(b,c)),n)<0)T.reverse();triangleMesh(g,T.flat(),col,30);}});
   }else{
    // A walk is horizontal in ship space. Only a short one-metre lip lies
    // outside the hull; its web brackets reach back to the real recessed wall.
    const horizontal=C.norm([n[0],0,n[2]]),k=C.dot(n,horizontal),width=Math.min(20,W*.72),depth=1.05,thick=.16,up=[0,1,0],back=C.add(anchor,C.mul(horizontal,(-.035-z)/k)),front=C.add(back,C.mul(horizontal,depth));if(width<6||H<4)continue;attachmentReach=Math.max(0,(-.035-z)/k);maxAttachmentReach=depth*2;if(attachmentReach>maxAttachmentReach)continue;catwalkWidth=depth;center=C.add(back,C.mul(horizontal,depth/2));axis=u;dimensions=[width,depth,1.05];
    batch(.88,(g,col)=>boxAt(g,C.sub(center,[0,thick/2,0]),u,horizontal,width,depth,thick,col));
    batch(.79,(g,col)=>{const railY=.95;boxAt(g,C.add(front,[0,railY,0]),u,horizontal,width,.075,.075,col);for(let k=0;k<5;k++)boxAt(g,C.add(C.add(front,C.mul(u,width*(k/4-.5))),[0,railY/2,0]),u,horizontal,.085,.085,railY,col);});
    batch(.72,(g,col)=>{for(const t of [-.38,0,.38]){const offset=C.mul(u,width*t),a=C.add(C.sub(anchor,[0,1.25,0]),offset),b=C.add(C.sub(back,[0,thick,0]),offset),c=C.add(C.sub(front,[0,thick,0]),offset),e=C.mul(u,.085),A=C.sub(a,e),B=C.sub(b,e),Q=C.sub(c,e),a2=C.add(a,e),b2=C.add(b,e),c2=C.add(c,e);const centroid=C.mul(C.add(C.add(a,b),c),1/3);for(const [ps,wanted]of [[[A,Q,B],C.mul(u,-1)],[[a2,b2,c2],u]]){if(C.dot(C.cross(C.sub(ps[1],ps[0]),C.sub(ps[2],ps[0])),wanted)<0)ps.reverse();triangleMesh(g,ps.flat(),col,30);}for(const ps of [[A,B,b2,a2],[B,Q,c2,b2],[Q,A,a2,c2]]){const sn=C.norm(C.cross(C.sub(ps[1],ps[0]),C.sub(ps[2],ps[0]))),mid=C.mul(ps.reduce((a,b)=>C.add(a,b),[0,0,0]),.25),flip=C.dot(sn,C.sub(mid,centroid))<0;hullQuad(g,flip?ps.reverse():ps,flip?C.mul(sn,-1):sn,col,30);}}});
   }
   const triangles=batches.flatMap(q=>q.triangles);if(!triangles.length)continue;const points=[];for(let i=0;i<triangles.length;i+=3)points.push(triangles.slice(i,i+3));const P=points.map(uv),footprint=[Math.min(...P.map(p=>p[0])),Math.min(...P.map(p=>p[1])),Math.max(...P.map(p=>p[0])),Math.max(...P.map(p=>p[1]))];if(!fits(footprint))continue;
   const normalRange=[Math.min(...points.map(normalAt)),Math.max(...points.map(normalAt))],maxOutset=kind==='catwalk'?1.65:kind==='turbine'?3.2:3.0;if(normalRange[1]>maxOutset+.001)continue;
   const bounds=[0,1,2].map(k=>Math.min(...points.map(p=>p[k]))).concat([0,1,2].map(k=>Math.max(...points.map(p=>p[k])))),row=rows.find(r=>C.rayTris(r.triangles,at(x,y,12),C.mul(n,-1)))||first,id=baseId+'|'+kind+'|'+site.key;
   (row.projections||(row.projections=[])).push({id,kind,ownerId:host,baseId,patchId:row.id,anchor:anchor.slice(),center,axis,u,v,normal:n,footprint,bounds,normalRange,maxOutset,dimensions,catwalkWidth,attachmentReach,maxAttachmentReach,batches,triangles});occupied.push(footprint);placed++;break;
  }
 }
}

const SURFACE_VISUAL_CACHE=new Map(),SURFACE_MESH_CACHE=new Map();
function surfaceVisualKey(ship,opt={}){
 const nativeParts=(ship.parts||[]).filter(p=>!p.surfacePatch),nativeFits=(ship.fits||[]).filter(f=>!f.surfacePatch),geometry=C.surfaceRenderKey?.(ship)||[ship.hull,ship.hullSkin,ship.cuts,ship.trenches,ship.subs,ship.solidCuts,ship.hatches,nativeParts,nativeFits,ship.surfaces];
 return JSON.stringify([geometry,ship.paint,ship.lights,ship.surfaces?.armorOnly,nativeParts.map(p=>[p.id,p.paint]),ship.detail,opt.detail??ship.detail??1,opt.maxDetails??1800,opt.maxField??12000,!!opt.coded],(k,v)=>k[0]==='_'?undefined:v);
}
function surfaceCachePut(cache,key,value,limit){cache.delete(key);cache.set(key,value);while(cache.size>limit)cache.delete(cache.keys().next().value);return value;}
const THIN_ARMOR_LIGHT_CACHE=new Map();
// Tiny emissive quads sit on the original skin; armor thickness is inward.
// Sampling the exposed fragments keeps holes and buried walls unlit. This is
// one bounded mesh batch, with no additional scene lights or draw calls.
function thinArmorLights(ship,key){
 if(!ship||ship.lights==='off'||typeof C.surfacePatches!=='function')return [];
 const baseline=ship.surfaces?.armorOnly===1?(ship.surfaces.legacyArmor??ship.armor?.hull??0):ship.armor?.hull??0;
 if(baseline>.3&&!ship.surfaces?.patches?.some(p=>p.functionMode==='equipment'||p.armor?.thickness>=0&&p.armor.thickness<=.3))return [];
 key=key||surfaceVisualKey(ship);const found=THIN_ARMOR_LIGHT_CACHE.get(key);if(found)return found;
 const out=[],parts=ship.parts||[],blockers=[],hostCounts=new Map(),hostFaces=new Map();
 const patches=C.surfacePatches(ship).filter(patch=>{const host=patch._part||parts.find(p=>'p'+p.id===patch.host),config=patch.config||C.surfaceConfig(ship,patch.id),t=config.functionMode==='equipment'?0:config.armor?.thickness??baseline,visible=(patch.host==='hull'||isStructuralPart(host))&&patch.exposed&&(patch.exposedArea??patch.area)>0&&t>=0&&t<=.3;if(visible){const id=host?.id??'hull';hostFaces.set(id,(hostFaces.get(id)||0)+1);}return visible;}).sort((a,b)=>a.id.localeCompare(b.id)),faceBudget=Math.max(1,Math.floor(640/Math.max(1,patches.length)));
 for(const p of parts)if(!C.isShapePart(p)&&!p.surfaceUnplaced&&!p.surfacePatch){const b=C.partAABB(p);if(b?.every(Number.isFinite))blockers.push({b});}
 for(const f of surfaceRenderFits(ship))if(!f.surfaceUnplaced){const b=C.fitAABB(f);if(b?.every(Number.isFinite))blockers.push({b});}
 for(const h of ship.hatches||[]){const b=C.openingBounds(ship,h);if(b?.every(Number.isFinite))blockers.push({b});}
 for(const patch of patches){
  if(out.length>=640)break;const host=patch._part||parts.find(p=>'p'+p.id===patch.host);
  if(patch.host!=='hull'&&!isStructuralPart(host)||!patch.exposed||!(patch.exposedArea??patch.area))continue;
  const config=patch.config||C.surfaceConfig(ship,patch.id),thickness=config.functionMode==='equipment'?0:config.armor?.thickness??ship.armor?.hull??0;
  if(!(thickness>=0&&thickness<=.3))continue;
  const T=surfaceTriangles(patch),triangles=[],weights=[];let area=0;
  for(let i=0;i+8<T.length;i+=9){const a=T.slice(i,i+3),b=T.slice(i+3,i+6),c=T.slice(i+6,i+9),normal=C.cross(C.sub(b,a),C.sub(c,a)),ar=C.len(normal)/2;if(!(ar>1e-8))continue;area+=ar;triangles.push({a,b,c,normal:C.norm(normal)});weights.push(area);}
  if(!(area>.04))continue;
  const own=host?.id??'hull',random=rng(surfaceSeed(patch.id+'|thin-armor-lights',271828)),count=Math.min(32,faceBudget,Math.max(1,Math.floor(128/hostFaces.get(own))),640-out.length,128-(hostCounts.get(own)||0),Math.max(1,Math.ceil(area/600))),radius=C.clamp(Math.sqrt(area)/150,.035,.55);
  let placed=0;
  for(let attempt=0;attempt<count*8&&placed<count;attempt++){
   const at=random()*area,index=Math.max(0,weights.findIndex(w=>at<=w)),{a,b,c,normal}=triangles[index],s=Math.sqrt(random()),t=random(),point=C.add(C.add(C.mul(a,1-s),C.mul(b,s*(1-t))),C.mul(c,s*t)),u=C.norm(C.sub(b,a)),v=C.norm(C.cross(normal,u)),lift=C.mul(normal,.02);
   if(blockers.some(q=>point.every((n,i)=>n>=q.b[i]-radius&&n<=q.b[i+3]+radius)))continue;
   const edgeDistance=(a,b)=>C.len(C.cross(C.sub(b,a),C.sub(point,a)))/Math.max(1e-9,C.len(C.sub(b,a))),r=Math.min(radius,Math.min(edgeDistance(a,b),edgeDistance(b,c),edgeDistance(c,a))*.45);
   if(r<.012)continue;const points=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>C.add(C.add(point,lift),C.add(C.mul(u,x*r),C.mul(v,y*r))));
   out.push({id:patch.id+'|light|'+placed,patch:patch.id,host:own,point:C.add(point,lift),normal,points});placed++;
  }
  hostCounts.set(own,(hostCounts.get(own)||0)+placed);
 }
 return surfaceCachePut(THIN_ARMOR_LIGHT_CACHE,key,out,4);
}
function surfaceVisualPlan(ship,opt={},key){
 if(ship.surfaces?.armorOnly===1)return [];
 if(!ship?.surfaces?.patches?.length)return [];
 key=key||surfaceVisualKey(ship,opt);const found=SURFACE_VISUAL_CACHE.get(key);if(found){SURFACE_VISUAL_CACHE.delete(key);SURFACE_VISUAL_CACHE.set(key,found);return found;}
 return surfaceCachePut(SURFACE_VISUAL_CACHE,key,surfaceBuildVisualPlan(ship,opt),4);
}
function surfaceBuildVisualPlan(ship,opt={}){
 if(!ship?.surfaces?.patches?.length||typeof C.surfacePatches!=='function')return [];
 const configured=new Set(ship.surfaces.patches.map(p=>p.id)),detail=C.clamp(opt.detail??ship.detail??1,0,2),cap=Math.max(0,Math.floor(opt.maxDetails??1800)),out=[];
 const equipmentReports=new Map((C.surfaceRenderFaces?C.surfaceRenderFaces(ship):ship.surfaces.patches.some(p=>p.functionMode==='equipment')?C.surfaceReport(ship).patches:[]).map(p=>[p.id,p])),patches=C.surfacePatches(ship),eligible=patches.filter(p=>configured.has(p.id)&&p.exposed&&(p.exposedArea??p.area)>0&&p.config?.functionMode==='equipment'),fieldShares=surfaceVisualShares(eligible,Math.max(0,Math.floor(opt.maxField??12000)),30),detailShares=surfaceVisualShares(eligible,cap,4);let budget=cap;
 const layerBases=surfaceLayerBases(patches),fieldGroups=new Map();
 for(const p of eligible){const id=p.baseId||p.id,group=fieldGroups.get(id)||{id,area:0};group.area+=p.exposedArea??p.area;fieldGroups.set(id,group);}
 const groupShares=surfaceVisualShares([...fieldGroups.values()],Math.max(0,Math.floor(opt.maxField??12000)),30);
 for(const [id,budget]of groupShares){const base=layerBases.get(id);if(base)base.fieldBudget=budget;}
 for(const patch of patches){
  if(!configured.has(patch.id)||!patch.exposed||!(patch.exposedArea??patch.area))continue;
  const config=patch.config||C.surfaceConfig(ship,patch.id),style=config.style||{},normal=C.norm(patch.normal),u=C.norm(patch.u),v=C.norm(patch.v),T=surfaceTriangles(patch),triangles=[],weights=[];let area=0;
  for(let i=0;i+8<T.length;i+=9){const a=T.slice(i,i+3),b=T.slice(i+3,i+6),c=T.slice(i+6,i+9),ar=C.len(C.cross(C.sub(b,a),C.sub(c,a)))/2;if(!(ar>1e-10))continue;area+=ar;triangles.push([a,b,c]);weights.push(area);}
  if(!triangles.length)continue;
  const random=rng(surfaceSeed(patch.id,style.seed)),density=C.clamp(style.density??0,0,1),size=C.clamp(Math.sqrt(area)/18,.04,6),n=Math.min(budget,Math.ceil(Math.sqrt(area)*density*detail*2)),boxes=[],devices=[];
  if(config.functionMode==='equipment'){
   const report=equipmentReports.get(patch.id),cells=report?.cells||[...ship.parts,...ship.fits].filter(p=>p.surfacePatch===patch.id&&!p.surfaceUnplaced&&p.surfaceRole).map(p=>({id:p.id,cell:p.surfaceCell,role:p.surfaceRole,k:p.k,point:p.surfacePoint,footprint:p.surfaceFootprint,w:p.surfaceFootprint?.[0],h:p.surfaceFootprint?.[1],depth:p.surfaceDepth}));
   const plan=surfaceEquipmentField(ship,patch,cells,style,detail,Math.min(budget,detailShares.get(patch.id)||0),fieldShares.get(patch.id)||0,config,report,layerBases.get(patch.baseId||patch.id));budget-=plan.boxes.length;
   out.push({id:patch.id,host:patch.host,patch,config,triangles:T,boundary:surfaceBoundary(patch),...plan});continue;
  }
  if(config.functionMode==='armor'){out.push({id:patch.id,host:patch.host,patch,config,triangles:T,boundary:surfaceBoundary(patch),paint:surfaceHostPaint(ship,patch),boxes,devices});continue;}
  // Project both endpoints of an obstruction's box onto this patch's frame.
  // No ornament may cover an actual muzzle, opening or nozzle.
  const blocked=[];
  const reserve=(b,pad=0)=>{if(!b||!b.every(Number.isFinite))return;const points=[];for(let i=0;i<8;i++)points.push([b[i&1?3:0],b[i&2?4:1],b[i&4?5:2]]);const n0=Math.min(...points.map(p=>C.dot(C.sub(p,patch.center),normal))),n1=Math.max(...points.map(p=>C.dot(C.sub(p,patch.center),normal)));if(n0>size*4||n1< -size*4)return;blocked.push([Math.min(...points.map(p=>C.dot(C.sub(p,patch.center),u)))-pad,Math.min(...points.map(p=>C.dot(C.sub(p,patch.center),v)))-pad,Math.max(...points.map(p=>C.dot(C.sub(p,patch.center),u)))+pad,Math.max(...points.map(p=>C.dot(C.sub(p,patch.center),v)))+pad]);};
  for(const f of surfaceRenderFits(ship))reserve(C.fitAABB(f),size*1.3);
  for(const h of ship.hatches||[])reserve(C.openingBounds(ship,h),size*1.2);
  for(const p of ship.parts||[])if(p.k==='engine'||p.k==='nozzle'||p.surfacePatch===patch.id)reserve(C.partAABB(p),size);
  const free=(p,r)=>{const d=C.sub(p,patch.center),x=C.dot(d,u),y=C.dot(d,v);return !blocked.some(b=>x+r>b[0]&&x-r<b[2]&&y+r>b[1]&&y-r<b[3]);};
  for(let i=0;i<n*4&&boxes.length<n;i++){
   const ar=random()*area;let ti=weights.findIndex(w=>ar<=w);if(ti<0)ti=weights.length-1;const [a,b,c]=triangles[ti],s=Math.sqrt(random()),t=random(),point=C.add(C.add(C.mul(a,1-s),C.mul(b,s*(1-t))),C.mul(c,s*t)),width=size*(.45+random()*.55),height=size*(.25+random()*.35),depth=size*(.12+random()*.25);
   // Test the footprint against the whole semantic patch. Tessellation edges
   // are not physical obstructions, while a cutout or patch boundary is.
   if(!free(point,Math.max(width,height)))continue;
   const reach=Math.max(2,patch.depth||0),corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>C.add(point,C.add(C.mul(u,x*width*.6),C.mul(v,y*height*.6))));if(corners.some(q=>!C.rayTris(T,C.add(q,C.mul(normal,reach)),C.mul(normal,-1))))continue;
   const lift=(config.armor?.thickness||0)+.015,center=C.add(point,C.mul(normal,lift+depth/2));boxes.push({center,u,v,normal,size:[width,height,depth],rounded:style.kind==='rounded',color:style.kind==='slab'?[143,151,160]:style.kind==='machinery'?[99,119,128]:[120,133,143]});
  }
  for(const p of ship.parts||[]){if(p.surfacePatch!==patch.id||p.surfaceUnplaced||!(p.surfaceCell!=null))continue;const b=C.partAABB(p),span=C.sub(b.slice(3),b.slice(0,3)),width=p.surfaceFootprint?.[0]||Math.max(.02,Math.min(...span.filter(x=>x>0))),height=p.surfaceFootprint?.[1]||width;
   const point=Array.isArray(p.surfacePoint)?p.surfacePoint:C.sub(p.c,C.mul(normal,C.dot(C.sub(p.c,patch.center),normal))),kind=p.k==='radiator'?'radiator':p.k==='hdis'?'hdis':'machinery';devices.push({id:p.id,kind,center:C.add(point,C.mul(normal,(config.armor?.thickness||0)+.025)),u,v,normal,size:[width,height,Math.max(.025,Math.min(width,height)*.035)]});
  }
  const legacy=equipmentReports.get(patch.id);if(legacy?.aggregate)for(const role of ['cooling','sensors','habitation']){const category=legacy.categories?.[role];if(!(category?.occupiedArea>0)||!Number.isFinite(category.roleid))continue;
   // Old mixed armour/equipment faces retain one interface per common role,
   // without restoring every legacy reservation as an editable part/model.
   const r=rng(surfaceSeed(patch.id+'|legacy-interface|'+role,style.seed)),width=Math.min(6,Math.sqrt(category.occupiedArea)*.45,(patch._max[0]-patch._min[0])*.6),height=Math.min(width*.6,(patch._max[1]-patch._min[1])*.6),depth=Math.max(.025,Math.min(width,height)*.035);
   for(let attempt=0;attempt<32;attempt++){const ar=r()*area,index=Math.max(0,weights.findIndex(w=>ar<=w)),[a,b,c]=triangles[index],s=Math.sqrt(r()),t=r(),point=C.add(C.add(C.mul(a,1-s),C.mul(b,s*(1-t))),C.mul(c,s*t));if(!free(point,Math.max(width,height)*.55))continue;const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>C.add(point,C.add(C.mul(u,x*width*.55),C.mul(v,y*height*.55))));if(corners.some(q=>!C.rayTris(T,C.add(q,C.mul(normal,Math.max(2,patch.depth))),C.mul(normal,-1))))continue;
    devices.push({id:category.roleid,role,aggregate:true,kind:role==='cooling'?config.equipment.kind:'machinery',center:C.add(point,C.mul(normal,(config.armor?.thickness||0)+.025+depth/2)),u,v,normal,size:[width,height,depth]});break;
   }
  }
  budget-=boxes.length;out.push({id:patch.id,host:patch.host,patch,config,triangles:T,boundary:surfaceBoundary(patch),boxes,devices});
 }
 const projectionGroups=new Map();for(const row of out)if(row.config.functionMode==='equipment'){row.revealBoundary=surfaceEquipmentReveals(row,out);const id=row.patch.baseId||row.id,group=projectionGroups.get(id)||[];group.push(row);projectionGroups.set(id,group);}
 const projectionQuotas=surfaceProjectionShares([...fieldGroups.values()],opt.maxField??12000);for(const [id,rows]of projectionGroups)surfaceEquipmentProjections(ship,rows,projectionQuotas.get(id)||0);
 return out;
}
function meshSurfaceLayers(ship,ranges={},opt={}){
 const key=surfaceVisualKey(ship,opt),found=SURFACE_MESH_CACHE.get(key),merge=rows=>{for(const [id,spans]of Object.entries(rows))for(const row of spans)(ranges[id]||(ranges[id]=[])).push(row.slice());};
 if(found){SURFACE_MESH_CACHE.delete(key);SURFACE_MESH_CACHE.set(key,found);merge(found.ranges);return {...found.meshes};}
 const localRanges={},meshes=buildSurfaceLayers(ship,localRanges,opt,key);surfaceCachePut(SURFACE_MESH_CACHE,key,{meshes,ranges:localRanges},2);merge(localRanges);return {...meshes};
}
function buildSurfaceLayers(ship,ranges,opt,key){
 const armor=new Geo(64),devices=new Geo(64),detail=new Geo(64),plans=surfaceVisualPlan(ship,opt,key);
 const addBox=(g,item,col)=>{const {center:c,u,normal:n,size:s}=item;box(g,[...u,...n,...C.cross(u,n)],c,0,0,0,s[0],s[2],s[1],col||item.color);};
 const addHardware=(g,item)=>{const begin=g.n,{center:c,u,v,normal:n,size:s}=item;
  if(item.type==='inlay'){
   const p=(x,y)=>C.add(c,C.add(C.mul(u,x),C.mul(v,y))),ps=item.points?item.points.slice():[p(-s[0]/2,-s[1]/2),p(s[0]/2,-s[1]/2),p(s[0]/2,s[1]/2),p(-s[0]/2,s[1]/2)];if(C.dot(C.cross(C.sub(ps[1],ps[0]),C.sub(ps[2],ps[0])),n)<0)ps.reverse();hullQuad(g,ps,n,item.color,30,249);
  }else addBox(g,item);
  if(item.port)for(let i=begin;i<g.n;i++)g.col[i*4+3]=253;
 };
 const record=(id,name,g,start,metadata)=>{if((Number.isFinite(id)||id==='hull'&&metadata?.projection)&&g.ni>start)(ranges[id]||(ranges[id]=[])).push(metadata?[name,start,g.ni-start,metadata]:[name,start,g.ni-start]);};
 for(const row of plans){const start=[armor.ni,devices.ni,detail.ni],{patch,config}=row,n=C.norm(patch.normal),thickness=config.functionMode==='equipment'?0:config.armor?.thickness||0,material=config.armor?.material,paint=row.paint||surfaceHostPaint(ship,patch),col=surfacePaintTone(paint,material==='dense'?.94:material==='light'?1.02:1);
  // Equipment is the opened structure itself: the selected outer skin is
  // replaced by an inward backing, with reveal walls under its armour caps.
  if(config.functionMode==='equipment'){
   // Byte252 keeps machinery backing/reveals on their existing material even
   // though they share a draw batch with true armored faces (byte251).
   hullTriangleMesh(armor,row.backingTriangles,surfacePaintTone(paint,.52),30,252);const recess=SURFACE_RECESS_DATA.get(row.backingTriangles)||surfaceRecess(ship,patch,row.recessDepth);
   for(const e of row.revealBoundary||row.boundary){const a=recess.pointAt(e.a),b=recess.pointAt(e.b),sn=C.norm(C.cross(n,C.sub(e.b,e.a)));hullQuad(armor,[e.a,e.b,b,a],sn,surfacePaintTone(paint,.85),30,252);}
  }else if(config.functionMode==='armor'&&thickness===0){const lift=C.mul(n,.012);hullTriangleMesh(armor,row.triangles.map((q,i)=>q+lift[i%3]),col,30);}
  if(thickness>0){const lift=C.mul(n,thickness+.01),T=row.triangles.map((q,i)=>q+lift[i%3]);hullTriangleMesh(armor,T,col,30);for(const e of row.boundary){const a=C.add(e.a,lift),b=C.add(e.b,lift),sn=C.norm(C.cross(C.sub(b,a),n));hullQuad(armor,[e.a,e.b,b,a],sn,col,30);}}
  if(config.functionMode==='equipment'){
   const host=/^p\d+$/.test(row.host)?+row.host.slice(1):row.host==='hull'?'hull':null,a=devices.ni,b=detail.ni;for(const q of row.reliefFaces||[]){const start=devices.n;triangleMesh(devices,q.triangles,q.color,30,q.machinery?250:249);if(q.machinery)for(let i=start;i<devices.n;i++){const p=Array.from(devices.pos.slice(i*3,i*3+3));devices.uv[i*2]=C.dot(p,row.frame.u)/30;devices.uv[i*2+1]=C.dot(p,row.frame.v)/30;}}for(const q of row.lights||[])addHardware(devices,q);for(const q of row.boxes)addHardware(detail,q);record(host,'surfaceDevices',devices,a);record(host,'surfaceDetail',detail,b);
   for(const q of row.projections||[]){const start=devices.ni;for(const batch of q.batches)triangleMesh(devices,batch.triangles,batch.color,30,249);record(host,'surfaceDevices',devices,start,{projection:true,id:q.id,kind:q.kind,ownerId:q.ownerId,baseId:q.baseId,patchId:q.patchId,anchor:q.anchor,center:q.center,axis:q.axis,normal:q.normal,footprint:q.footprint,bounds:q.bounds,normalRange:q.normalRange,maxOutset:q.maxOutset,dimensions:q.dimensions,catwalkWidth:q.catwalkWidth,attachmentReach:q.attachmentReach,maxAttachmentReach:q.maxAttachmentReach});}
   for(const item of row.devices){const a=devices.ni;for(const q of item.hardware)addHardware(devices,q);record(item.id,'surfaceDevices',devices,a);}
   if(/^p\d+$/.test(row.host))record(+row.host.slice(1),'surfaceArmor',armor,start[0]);continue;
  }
  for(const item of row.devices){addBox(devices,item,surfacePaintTone(paint,.92));const strips=Math.max(2,Math.min(12,Math.floor(item.size[1]/Math.max(.04,item.size[0]*.12))));for(let i=0;i<strips;i++){const c=C.add(item.center,C.add(C.mul(item.v,(i/(strips-1)-.5)*item.size[1]*.78),C.mul(item.normal,item.size[2]*.6)));addBox(devices,{...item,center:c,size:[item.size[0]*.8,item.size[1]/strips*.25,item.size[2]*.35]},surfacePaintTone(paint,.52));}}
  for(const item of row.boxes)if(item.rounded){const half=C.mul(item.u,item.size[0]/2);axisFrustum(detail,C.sub(item.center,half),C.add(item.center,half),item.size[2]/2,item.size[2]/2,item.color,true,false,8);}else addBox(detail,item);
  if(/^p\d+$/.test(row.host)){const id=+row.host.slice(1);for(const [name,g,i]of [['surfaceArmor',armor,0],['surfaceDevices',devices,1],['surfaceDetail',detail,2]])if(g.ni>start[i])(ranges[id]||(ranges[id]=[])).push([name,start[i],g.ni-start[i]]);}
 }
 for(const lamp of thinArmorLights(ship,key)){const start=devices.ni;quad(devices,lamp.points,lamp.normal,UV_WHITE,WHITE,253);record(lamp.host,'surfaceDevices',devices,start);}
 for(const g of [devices,detail])for(let i=3;i<g.n*4;i+=4)if(g.col[i]===255)g.col[i]=249;
 if(opt.coded)for(let i=3;i<armor.n*4;i+=4)if(armor.col[i]===251)armor.col[i]=255;
 return {surfaceArmor:armor,surfaceDevices:devices,surfaceDetail:detail};
}
function meshParts(ship,opt){
  const result=v3MeshParts(ship,opt);Object.assign(result.g,meshReferenceParts(ship,result.ranges));const g=result.g.struct,detail=ship.detail??1,managed=ship.surfaces?.armorOnly!==1&&ship.surfaces?.patches?.some(p=>p.functionMode==='equipment')?C.surfacePatches(ship).filter(p=>p.config?.functionMode==='equipment'):[];
  if(detail){
    // Deck edging and repeating stiffeners make scale legible; the editor controls their pitch.
    for(const p of ship.parts.filter(isStructuralPart)){const before=g.ni;try{structDetailFor(p);}finally{const n=g.ni-before;if(n>0)(result.ranges[p.id]||(result.ranges[p.id]=[])).push(['struct',before,n]);}}
    function structDetailFor(p){
      if(launcherRecessHost(ship,'p'+p.id))return;
      if(ship.solidCuts?.some(c=>ship.hull.assembly||c.structures))return;
      if(p.form==='reference'||p.plate)return;
      if(p.form==='ellipsoid'){if(!ship.hullSkin?.enabled)bulbDetail(p,g);return;}
      if(p.form==='dome'||p.form==='cylinder'||p.form==='cone')return;
      structuralDetail(p,g,Math.max(1,ship.hull.L/3200),managed.filter(q=>q.host==='p'+p.id));const T=C.structTriangles(p),col=p.paint?hex(p.paint):ship.paint==='dark'?[92,103,114]:ship.paint==='cis'?DETAIL_CIS:[156,163,166];
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
  routeBuriedApparatus(ship,result);
  Object.assign(result.g,meshSurfaceLayers(ship,result.ranges,{coded:!!opt.coded}));
  if(opt.coded)for(const g of Object.values(result.g))for(let i=3;i<g.n*4;i+=4)if(g.col[i]===251)g.col[i]=255;
  return result;
}
// Open machinery scenery must not reveal coloured bodies that are still
// enclosed by the original ship. Keep these bodies in the diagnostic mesh;
// genuinely exposed apparatus, structures and hangar mouths remain exterior.
function routeBuriedApparatus(ship,result){
 const native=new Set(['struct','gen','shield','hyper','engine','nozzle','refStruct','refEngine']),remove=new Map(),moved=[];
 for(const p of ship.parts||[]){if(C.isShapePart(p)||p.surfacePatch||p.k==='hangar')continue;const spans=(result.ranges[p.id]||[]).filter(([name,,count])=>native.has(name)&&count>0);if(!spans.length)continue;let enclosed=true;
  for(const [name,start,count]of spans){const g=result.g[name],seen=new Set();for(let i=start;i<start+count&&enclosed;i++){const k=g.idx[i];if(seen.has(k))continue;seen.add(k);const point=[0,1,2].map(a=>g.pos[k*3+a]+g.nor[k*3+a]/127*.001);if(!C.insideOriginalEnvelope(ship,point))enclosed=false;}
   // Vertices on separate pieces of a concave envelope cannot hide a bridge
   // spanning an actual external gap between them.
   for(let i=start;i<start+count&&enclosed;i+=3){const point=[0,1,2].map(a=>(g.pos[g.idx[i]*3+a]+g.pos[g.idx[i+1]*3+a]+g.pos[g.idx[i+2]*3+a])/3);if(!C.insideOriginalEnvelope(ship,point))enclosed=false;}if(!enclosed)break;
  }if(!enclosed)continue;
  for(const span of spans){const [name,start,count]=span,g=result.g[name],inside=result.g.interior,begin=inside.ni;inside.room(count,count);
   for(let i=start;i<start+count;i+=3){const base=inside.n;for(let j=0;j<3;j++){const k=g.idx[i+j],col=Array.from(g.col.subarray(k*4,k*4+3),v=>name.startsWith('ref')?Math.min(255,v*2):v);inside.v(...g.pos.subarray(k*3,k*3+3),...Array.from(g.nor.subarray(k*3,k*3+3),v=>v/127),g.uv[k*2],g.uv[k*2+1],col,g.col[k*4+3]);}inside.tri(base,base+1,base+2);}
   (remove.get(name)||remove.set(name,[]).get(name)).push([start,count]);moved.push({id:p.id,range:['interior',begin,count]});
  }
 }
 for(const [name,spans]of remove){const g=result.g[name],drop=new Uint8Array(g.ni),prefix=new Uint32Array(g.ni+1);for(const [start,count]of spans)drop.fill(1,start,start+count);for(let i=0;i<g.ni;i++)prefix[i+1]=prefix[i]+!drop[i];for(let i=0;i<g.ni;i++)if(!drop[i])g.idx[prefix[i]]=g.idx[i];g.ni=prefix[prefix.length-1];
  for(const id in result.ranges)result.ranges[id]=result.ranges[id].flatMap(r=>r[0]!==name?[r]:prefix[r[1]+r[2]]>prefix[r[1]]?[[name,prefix[r[1]],prefix[r[1]+r[2]]-prefix[r[1]]]]:[]);
 }
 for(const q of moved)(result.ranges[q.id]||(result.ranges[q.id]=[])).push(q.range);
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
function appendGeo(target,g){
 // Cached meshes already contain the packed GPU attributes. Copy their active
 // ranges directly instead of unpacking every normal/colour into temporary
 // arrays and packing the same values again through Geo.v.
 target.room(g.n,g.ni);const base=target.n;
 target.pos.set(g.pos.subarray(0,g.n*3),base*3);
 target.nor.set(g.nor.subarray(0,g.n*3),base*3);
 target.uv.set(g.uv.subarray(0,g.n*2),base*2);
 target.col.set(g.col.subarray(0,g.n*4),base*4);
 for(let i=0;i<g.ni;i++)target.idx[target.ni+i]=base+g.idx[i];
 target.n+=g.n;target.ni+=g.ni;
}
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
 const hasSkin=!!C.REFERENCE_ASSETS[C.engineAppearance(p)?.skinAsset],r=p.d/2,on=!p.placement?.pendingGeometry&&!p.placement?.validationFailed&&C.engineVented(ship,p)&&!!C.reactorFor(ship,p),f=C.frameAxis(u),throat=C.clamp(p.throatRatio??.34,.18,.8),tip=C.add(a,C.mul(u,C.len(C.sub(b,a))*.16));
 if(!hasSkin){
 axisFrustum(out.engine,a,b,r*.6,r,color,false);
 // The inside of the bell must face inward; reversing the axis alone is insufficient.
 axisFrustum(out.engine,b,tip,r*.94,r*throat,[53,67,76],false,true);
 // (v21 ribs and collar scale down with a small engine, so they do not stand out of a craft's hull)
 for(let i=0;i<20;i++){const angle=i/20*Math.PI*2,radial=C.add(C.mul(f.v,Math.cos(angle)),C.mul(f.w,Math.sin(angle)));axisFrustum(out.engine,C.add(a,C.mul(radial,r*.62)),C.add(b,C.mul(radial,r*1.015)),Math.min(Math.max(.25,r*.016),r*.05),Math.min(Math.max(.25,r*.018),r*.05),[105,117,125],false);}
 axisFrustum(out.engine,C.sub(b,C.mul(u,Math.min(.6,r*.15))),C.add(b,C.mul(u,Math.min(.6,r*.15))),r*1.02,r*1.02,[170,180,184],false);
 }
 const g=on?out.nozzle:out.engine,N=radialSegments(r*throat);g.room(N+2,N*3);const base=g.n;g.v(...tip,...u,.5,.5,on?WHITE:[33,42,47],255);
 for(let i=0;i<=N;i++){const t=i/N*Math.PI*2,q=C.add(tip,C.add(C.mul(f.v,Math.cos(t)*r*throat),C.mul(f.w,Math.sin(t)*r*throat)));g.v(...q,...u,.5+.5*Math.cos(t),.5+.5*Math.sin(t),on?WHITE:[33,42,47],255);}for(let i=0;i<N;i++)g.tri(base,base+i+1,base+i+2);
 if(on)glow.push(...C.add(b,C.mul(u,r*(hasSkin ? .5 : .12))),r*.8);
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
   if(ps.every(Boolean)&&!opening&&!red){const n=C.norm(C.cross(C.sub(ps[3],ps[0]),C.sub(ps[1],ps[0]))),order=sign>0?[0,3,2,1]:[0,1,2,3];quad(g,order.map(i=>ps[i]),C.mul(n,sign),[[0,0],[0,1],[1,1],[1,0]],[val,val+3,val+4],251);
    // Narrow, non-repeating joints rather than isolated checkerboard squares.
    for(const edge of [[ps[0],ps[1]],[ps[1],ps[2]]]){const [a,b]=edge,v=C.norm(C.cross(C.sub(b,a),n)),q=[a,b,C.add(b,C.mul(v,.38)),C.add(a,C.mul(v,.38))].map(p=>C.add(p,[0,sign*.06,0]));quad(g,sign>0?q:q.reverse(),C.mul(n,sign),UV_WHITE,[143,152,158],255);}
   }
   z=z1;
  }x=x1;
 }}
}
function structuralDetail(p,g,ds=1,managed=[]){
 if(p.skin==='plain'||p.s[2]<10||p.s[0]<30)return;
 const T=C.structTriangles(p),service=p.skin==='service';
 const owned=(point,normal)=>managed.some(p=>C.dot(p.normal,normal)>.98&&Math.abs(C.dot(C.sub(point,p.center),p.normal))<1&&C.rayTris(surfaceTriangles(p),C.add(point,C.mul(p.normal,2)),C.mul(p.normal,-1)));
 // Mechanical bays on the walls are actual shallow geometry, with no glass or emission.
 for(let i=0;i<T.length;i+=9){const a=Array.from(T.slice(i,i+3)),b=Array.from(T.slice(i+3,i+6)),c=Array.from(T.slice(i+6,i+9)),n=C.norm(C.cross(C.sub(b,a),C.sub(c,a)));
  if(Math.abs(n[1])>.6)continue;
  const fw=C.norm(C.cross([0,1,0],n)),up=C.norm(C.cross(n,fw)),M=[...fw,...n,...up],q=[a,b,c].map(v=>[C.dot(v,fw),C.dot(v,up)]),step=(service?12:34)*ds;
  const minX=Math.min(...q.map(v=>v[0])),maxX=Math.max(...q.map(v=>v[0])),minY=Math.min(...q.map(v=>v[1])),maxY=Math.max(...q.map(v=>v[1]));
  const inside=(x,y)=>{const cross=(a,b)=>(b[0]-a[0])*(y-a[1])-(b[1]-a[1])*(x-a[0]),v=[cross(q[0],q[1]),cross(q[1],q[2]),cross(q[2],q[0])];return v.every(v=>v>=.5)||v.every(v=>v<=-.5);};
  for(let y=Math.ceil(minY/(23*ds))*(23*ds)+7;y<maxY-2;y+=23*ds)for(let x=Math.ceil(minX/step)*step+3;x<maxX-2;x+=step){const seed=(Math.sin(x*17.1+y*12.7)+1)/2,w=step*(.4+seed*.32),ht=(service?12+seed*10:5+seed*3)*ds;if(![[x-w/2,y-ht/2],[x+w/2,y-ht/2],[x+w/2,y+ht/2],[x-w/2,y+ht/2]].every(([x,y])=>inside(x,y)))continue;
   const o=C.add(C.add(C.mul(fw,x),C.mul(up,y)),C.mul(n,C.dot(a,n)+.12));
   if(owned(o,n))continue;
   if(service){box(g,M,o,0,.28,0,w,.55,ht,[155,166,172]);box(g,M,o,w*.12,.9,ht*.1,w*.54,1.3,ht*.58,[184,192,197]);if(seed>.35){for(const xx of [-w*.31,-w*.20]){const start=C.add(o,C.add(C.mul(fw,xx),C.mul(up,-ht*.4))),end=C.add(start,C.mul(up,ht*.8));axisFrustum(g,C.add(start,C.mul(n,1)),C.add(end,C.mul(n,1)),.43,.43,[111,127,137],false,false,8);}}}
   else if(seed>.45)box(g,M,o,0,.28,0,w,.55,ht,[192,199,202]);
  }
 }
 // Roof plate edges are intersections with ship X/Z planes. They stay
 // fore-and-aft/transverse in plan view even on a doubly tilted structure.
 for(let i=0;i<T.length;i+=9){const tri=[Array.from(T.slice(i,i+3)),Array.from(T.slice(i+3,i+6)),Array.from(T.slice(i+6,i+9))],n=C.norm(C.cross(C.sub(tri[1],tri[0]),C.sub(tri[2],tri[0])));if(n[1]<.6||owned(C.mul(tri.reduce((a,b)=>C.add(a,b),[0,0,0]),1/3),n))continue;
  const xs=tri.map(q=>q[0]),zs=tri.map(q=>q[2]),pitchX=68*ds,pitchZ=46*ds;
  for(let x=Math.floor(Math.min(...xs)/pitchX)*pitchX;x<Math.max(...xs);x+=pitchX)for(let z=Math.floor(Math.min(...zs)/pitchZ)*pitchZ;z<Math.max(...zs);z+=pitchZ){const R=rng(surfaceSeed(x+'|'+z,37)),l=(17+R()*23)*ds,w=(12+R()*21)*ds,dx=8*ds+R()*7*ds,dz=5*ds+R()*6*ds;let poly=tri;for(const [axis,lim,sign]of [[0,x+dx,true],[0,x+dx+l,false],[2,z+dz,true],[2,z+dz+w,false]])poly=C.clipPoly(poly,axis,lim,sign);if(poly.length<3)continue;const out=[];C.triangulateFan(poly.map(q=>C.add(q,C.mul(n,.23))),out);hullTriangleMesh(g,out,[200,205,208],48);}
 }
}
function bulbDetail(p,g){
 if(p.skin==='plain')return;const point=(a,b,e=.25)=>C.worldStruct(p,[(p.s[0]/2+e)*Math.sin(a)*Math.cos(b),(p.s[2]/2+e)*Math.cos(a),(p.s[1]/2+e)*Math.sin(a)*Math.sin(b)]);
 for(let row=1;row<12;row++)for(let col=0;col<32;col++){const a=row/12*Math.PI,b=col/32*Math.PI*2,a1=a+.005,b1=(col+1)/32*Math.PI*2,ps=[point(a,b),point(a1,b),point(a1,b1),point(a,b1)],n=C.norm(C.sub(ps[0],p.c));quad(g,[ps[3],ps[2],ps[1],ps[0]],n,UV_WHITE,[157,168,174],255);}
 for(let col=0;col<16;col++)for(let row=0;row<24;row++){const a=row/24*Math.PI,a1=(row+1)/24*Math.PI,b=col/16*Math.PI*2,ps=[point(a,b),point(a1,b),point(a1,b+.006),point(a,b+.006)],n=C.norm(C.sub(ps[0],p.c));quad(g,[ps[3],ps[2],ps[1],ps[0]],n,UV_WHITE,[157,168,174],255);}
}

function sensorShell(g,p,color){
 const rigid=p.placement?.mode==='direct'&&p.placement.parentStructureId!=null,size=p.skinSize||[p.d,p.d,p.d],scale=p.d/Math.max(...size),point=q=>rigid?C.worldStruct(p,q.map((n,i)=>n*size[i]*scale/p.d)):C.add(p.c,q);
 const phi=(1+Math.sqrt(5))/2,v=[[-1,phi,0],[1,phi,0],[-1,-phi,0],[1,-phi,0],[0,-1,phi],[0,1,phi],[0,-1,-phi],[0,1,-phi],[phi,0,-1],[phi,0,1],[-phi,0,-1],[-phi,0,1]].map(C.norm);
 const faces=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
 const draw=(a,b,c,depth)=>{if(depth){const ab=C.norm(C.add(a,b)),bc=C.norm(C.add(b,c)),ca=C.norm(C.add(c,a));draw(a,ab,ca,depth-1);draw(ab,b,bc,depth-1);draw(ca,bc,c,depth-1);draw(ab,bc,ca,depth-1);return;}const center=C.mul(C.add(C.add(a,b),c),1/3),f=.96,T=[a,b,c].flatMap(q=>point(C.mul(C.add(center,C.mul(C.sub(q,center),f)),p.d/2)));triangleMesh(g,T,color.map(x=>Math.round(x*(.92+Math.abs(center[1])*.07))),30);};
 for(const f of faces)draw(...f.map(i=>v[i]),2);
}

function structureBands(p,g,T=C.structTriangles(p)){for(let i=0;i<T.length;i+=9){const world=[Array.from(T.slice(i,i+3)),Array.from(T.slice(i+3,i+6)),Array.from(T.slice(i+6,i+9))],poly=world.map(q=>C.localStruct(p,q)),n=C.norm(C.cross(C.sub(world[1],world[0]),C.sub(world[2],world[0])));for(const [a,b] of p.bands){const q=C.clipPoly(C.clipPoly(poly,0,(a-.5)*p.s[0],true),0,(b-.5)*p.s[0],false).map(v=>C.add(C.worldStruct(p,v),C.mul(n,.3))),out=[];C.triangulateFan(q,out);triangleMesh(g,out,bandColor(p),42);}}}

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
function plainFitAsset(f){return C.REFERENCE_ASSETS[f.skinAsset||C.FITS[f.k]?.asset]?.plainMetal;}
function familyReferenceAsset(f){const id=f.skinAsset||C.FITS[f.k]?.asset,a=C.REFERENCE_ASSETS[id];return id!=='isd_heavy_octuple'&&C.FITS[f.k]?.cat==='w'&&a&&['imperial-photo-family','light-photo-family','capital-photo-family','moncal-photo-family','point-defense-photo','cis-photo-family'].includes(a.nativeCalibration)?a:null;}
function sharedProceduralTurret(f){return ['pd','ionL','cturret'].includes(f.k)&&!C.FITS[f.k]?.asset;}
// The supplied FBX has no texture atlas. Keep its indexed normals and geometry,
// but render it with the ordinary fitting metal in the editor and fleet alike.
// A fitting's reference transform is affine for its complete static pose.
// Resolve the frame, archive levelling and pitch once instead of rebuilding
// those vectors and trigonometric terms for every decoded vertex.
function fitReferenceTransform(f){
 const origin=C.referenceFitPoint(f,[0,0,0]),x=C.sub(C.referenceFitPoint(f,[1,0,0]),origin),y=C.sub(C.referenceFitPoint(f,[0,1,0]),origin),z=C.sub(C.referenceFitPoint(f,[0,0,1]),origin);
 return v=>[origin[0]+v[0]*x[0]+v[1]*y[0]+v[2]*z[0],origin[1]+v[0]*x[1]+v[1]*y[1]+v[2]*z[1],origin[2]+v[0]*x[2]+v[1]*y[2]+v[2]*z[2]];
}
const PLAIN_FIT_CACHE=new WeakMap();
function appendPlainFit(g,f){
 const key=JSON.stringify([f,C.fitSpec(f)],(k,v)=>k.startsWith('_')?undefined:v);let item=PLAIN_FIT_CACHE.get(f);
 if(!item||item.key!==key){const id=f.skinAsset||C.FITS[f.k].asset,mesh=new Geo(C.REFERENCE_ASSETS[id].n);appendReference(mesh,id,fitReferenceTransform(f),null,FC.body);
  // These models have no fitting atlas. Keep their UVs within its metal panel,
  // so triangle interiors cannot sample the separate dark window band.
  for(let i=0;i<mesh.n;i++){mesh.uv[i*2]=UV_WHITE[0]+C.clamp(mesh.uv[i*2],0,1)*(UV_WHITE[2]-UV_WHITE[0]);mesh.uv[i*2+1]=UV_WHITE[1]+C.clamp(mesh.uv[i*2+1],0,1)*(UV_WHITE[3]-UV_WHITE[1]);}
  item={key,mesh};PLAIN_FIT_CACHE.set(f,item);}
 appendGeo(g,item.mesh);
}
// Every gun uses the existing ISD octuple's paint. Keep the original octuple
// untouched; recolor only cached draw copies, never decoded or archived assets.
const FAMILY_REFERENCE_CACHE=new WeakMap();
// Drawing uses a separate, cached copy of the authored geometry. The original
// reference remains the authority for dimensions, equipment space and physics.
// Preserve every barrel profile station; only circular sampling is reduced.
const TURRET_RENDER_ASSET_CACHE=new WeakMap();
function turretDrawCompact(pos,uv,indices){
 const used=new Set(indices),map=new Int32Array(pos.length/3).fill(-1),P=[],U=[];
 for(let i=0;i<map.length;i++)if(used.has(i)){map[i]=P.length/3;P.push(pos[i*3],pos[i*3+1],pos[i*3+2]);U.push(uv[i*2],uv[i*2+1]);}
 return {pos:Float32Array.from(P),uv:Float32Array.from(U),idx:Uint32Array.from(indices,i=>map[i]),sourceVertexMap:map};
}
function turretDrawPart(a,raw,row){
 const first=row.firstVertex,last=first+row.vertices,start=row.firstIndex,end=start+row.indices;
 if(![first,last,start,end].every(Number.isInteger)||first<0||last>a.n||start<0||end>raw.idx.length||start%3||end%3)return null;
 const idx=Array.from(raw.idx.subarray(start,end),i=>i-first);if(idx.some(i=>i<0||i>=row.vertices))return null;
 return {pos:raw.pos.slice(first*3,last*3),uv:raw.uv.slice(first*2,last*2),idx};
}
function turretDrawSphere(a,row,ns=20,nl=10){
 const range=a.sphereMeshRange,c=a.sphereCenterM,R=a.sphereRadiusM;
 if(row.normalMode!=='sphere'||!range||row.firstIndex!==range.firstIndex||row.indices!==range.indices||!(R>0)||!Array.isArray(c)||c.length!==3||!c.every(Number.isFinite))return null;
 // Complete balls only: clipped domes and their hard floors keep their exact
 // authored surfaces. Smooth radial normals are applied after the fit pose.
 if(Number.isFinite(row.floorYM))return null;
 const pos=[],uv=[],idx=[];
 const vertex=(x,y,z,u,v)=>{pos.push((x-a.c[0])/a.size[0],(y-a.c[1])/a.size[1],(z-a.c[2])/a.size[2]);uv.push(u,v);};
 vertex(c[0],c[1]-R,c[2],.5,0);
 for(let j=1;j<nl;j++){const t=-Math.PI/2+Math.PI*j/nl;for(let i=0;i<ns;i++){const p=i*Math.PI*2/ns;vertex(c[0]+R*Math.cos(t)*Math.cos(p),c[1]+R*Math.sin(t),c[2]+R*Math.cos(t)*Math.sin(p),i/ns,j/nl);}}
 const top=pos.length/3;vertex(c[0],c[1]+R,c[2],.5,1);
 for(let i=0;i<ns;i++)idx.push(0,1+(i+1)%ns,1+i);
 for(let j=0;j<nl-2;j++){const b=1+j*ns,n=b+ns;for(let i=0;i<ns;i++){const k=(i+1)%ns;idx.push(b+i,b+k,n+k,b+i,n+k,n+i);}}
 for(let i=0;i<ns;i++)idx.push(1+(nl-2)*ns+i,1+(nl-2)*ns+(i+1)%ns,top);
 for(let i=0;i<idx.length;i+=3){const t=idx[i+1];idx[i+1]=idx[i+2];idx[i+2]=t;}
 return {pos:Float32Array.from(pos),uv:Float32Array.from(uv),idx:Uint32Array.from(idx)};
}
function turretDrawClosed(mesh){
 const edges=new Map(),keys=Array.from({length:mesh.pos.length/3},(_,i)=>Array.from(mesh.pos.subarray(i*3,i*3+3)).join(','));
 for(let i=0;i<mesh.idx.length;i+=3){const t=Array.from(mesh.idx.slice(i,i+3),j=>keys[j]);for(let j=0;j<3;j++){const x=t[j],y=t[(j+1)%3];if(x===y)return false;const k=x<y?x+'|'+y:y+'|'+x;edges.set(k,(edges.get(k)||0)+1);}}
 return edges.size>0&&[...edges.values()].every(n=>n===2);
}
function turretDrawBarrel(a,raw,row,barrel){
 if(!barrel||!Array.isArray(barrel.root)||!Array.isArray(barrel.axis)||Math.abs(barrel.axis[0]-1)>1e-5||Math.abs(barrel.axis[1])+Math.abs(barrel.axis[2])>1e-5)return null;
 const mesh=turretDrawPart(a,raw,row);if(!mesh||!turretDrawClosed(mesh))return null;
 const tol=Math.max(...a.size)/65532*2.2,cy=barrel.root[1],cz=barrel.root[2],points=Array.from({length:row.vertices},(_,i)=>[0,1,2].map(k=>mesh.pos[i*3+k]*a.size[k]+a.c[k])),map=Int32Array.from(points,(_,i)=>i),rings=[];
 // The generated barrels store their profile in axial order. An unfamiliar
 // imported mesh deliberately falls back to its original draw geometry.
 for(let first=0;first<points.length;){
  const p=points[first],radius=Math.hypot(p[1]-cy,p[2]-cz);let end=first+1;
  while(end<points.length&&Math.abs(points[end][0]-p[0])<=tol&&Math.abs(Math.hypot(points[end][1]-cy,points[end][2]-cz)-radius)<=tol)end++;
  const n=end-first;if(radius<=tol){if(n!==1)return null;rings.push({first,end,n});first=end;continue;}
  if(n<8||n%4)return null;
  const angles=Array.from({length:n},(_,j)=>({id:first+j,angle:(Math.atan2(points[first+j][2]-cz,points[first+j][1]-cy)+Math.PI*2)%(Math.PI*2)})).sort((x,y)=>x.angle-y.angle);
  for(let j=0;j<n;j++){const gap=(angles[(j+1)%n].angle-angles[j].angle+Math.PI*2)%(Math.PI*2);if(Math.abs(gap-Math.PI*2/n)>Math.max(.012,tol/Math.max(radius,tol)*4))return null;}
  const byColumn=new Map();for(const v of angles){const column=Math.round(v.angle*n/(Math.PI*2))%n,error=Math.abs(Math.atan2(Math.sin(v.angle-column*Math.PI*2/n),Math.cos(v.angle-column*Math.PI*2/n)));if(byColumn.has(column)||error>Math.max(.012,tol/Math.max(radius,tol)*4))return null;byColumn.set(column,v);}
  if(n>12){const target=n===16?8:12,keep=new Set();for(let j=0;j<target;j++)keep.add(Math.round(j*n/target)%n);
   // Always retain the original four silhouette extrema, even for a ring
   // whose angular origin differs from the standard generated profile.
   for(const column of [0,n/4,n/2,n*3/4])keep.add(column);
   for(const [column,v]of byColumn){let best=0,distance=Infinity;for(const q of keep){const d=Math.min((column-q+n)%n,(q-column+n)%n);if(d<distance||d===distance&&q<best){distance=d;best=q;}}map[v.id]=byColumn.get(best).id;}
  }
  rings.push({first,end,n});first=end;
 }
 if(rings.length<3||!map.some((v,i)=>v!==i))return null;
 const indices=[],seen=new Set();for(let i=0;i<mesh.idx.length;i+=3){const t=[map[mesh.idx[i]],map[mesh.idx[i+1]],map[mesh.idx[i+2]]];if(new Set(t).size<3)continue;const min=Math.min(...t),j=t.indexOf(min),key=[t[j],t[(j+1)%3],t[(j+2)%3]].join(',');if(!seen.has(key)){seen.add(key);indices.push(...t);}}
 const result=turretDrawCompact(mesh.pos,mesh.uv,indices);if(result.idx.length>=mesh.idx.length||!turretDrawClosed(result))return null;
 return result;
}
// Point defence is a tiny repeated silhouette at ship scale. Keep the two
// side-mounted lasers or the three-port ball, but omit rails, collars and
// decorative rings from its cached draw copy. The full source still defines
// equipment, charging space, muzzle axes and saved designs.
function turretMinimumPointDefense(a,raw,id){
 if(!['pd_twin_side_laser','moncal_pd_triple'].includes(id))return null;
 const pos=[],uv=[],idx=[],components=[],barrels=[],world=p=>p.map((v,k)=>(v-a.c[k])/a.size[k]);
 const add=(row,mesh)=>{const firstVertex=pos.length/3,firstIndex=idx.length;pos.push(...mesh.pos);uv.push(...mesh.uv);for(const i of mesh.idx)idx.push(firstVertex+i);const next={...row,firstVertex,vertices:mesh.pos.length/3,firstIndex,indices:mesh.idx.length};components.push(next);return next;};
 const bounds=row=>{const b=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];for(let i=row.firstVertex;i<row.firstVertex+row.vertices;i++)for(let k=0;k<3;k++){const v=raw.pos[i*3+k]*a.size[k]+a.c[k];b[k]=Math.min(b[k],v);b[k+3]=Math.max(b[k+3],v);}return b;};
 const mesh=(points,faces)=>({pos:Float32Array.from(points.flatMap(world)),uv:Float32Array.from(points.flatMap(()=>[.5,.5])),idx:Uint32Array.from(faces.flat())});
 const box=(row,b)=>{const [x,y,z,X,Y,Z]=b,P=[[x,y,z],[X,y,z],[X,Y,z],[x,Y,z],[x,y,Z],[X,y,Z],[X,Y,Z],[x,Y,Z]];return add(row,mesh(P,[[0,3,2],[0,2,1],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[3,7,6],[3,6,2],[0,4,7],[0,7,3],[1,2,6],[1,6,5]]));};
 const cylinder=(row,axis,b)=>{const u=(axis+1)%3,v=(axis+2)%3,c=[0,1,2].map(k=>(b[k]+b[k+3])/2),r=(b[u+3]-b[u])/2,P=[],F=[],N=6;
  for(const end of [b[axis],b[axis+3]])for(let i=0;i<N;i++){const p=c.slice(),t=i/N*Math.PI*2;p[axis]=end;p[u]+=Math.cos(t)*r;p[v]+=Math.sin(t)*r;P.push(p);}
  for(let i=0;i<N;i++){const j=(i+1)%N;F.push([i,j,N+j],[i,N+j,N+i]);}for(let i=1;i<N-1;i++)F.push([0,i+1,i],[N,N+i,N+i+1]);return add(row,mesh(P,F));};
 const barrel=b=>{if(!b.root?.every(Number.isFinite)||!b.muzzle?.every(Number.isFinite)||!b.axis?.every(Number.isFinite)||Math.abs(b.axis[0]-1)>1e-8||Math.abs(b.axis[1])+Math.abs(b.axis[2])>1e-8||!(b.outerRadiusM>b.boreRadiusM&&b.boreRadiusM>0&&b.muzzleRecessM>0))return false;
  const P=[],F=[],N=4,rings=[[b.root[0],b.outerRadiusM],[b.muzzle[0],b.outerRadiusM],[b.muzzle[0],b.boreRadiusM],[b.muzzle[0]-b.muzzleRecessM,b.boreRadiusM]];
  for(const [x,r]of rings)for(let i=0;i<N;i++){const t=i/N*Math.PI*2;P.push([x,b.root[1]+r*Math.cos(t),b.root[2]+r*Math.sin(t)]);}
  for(let ring=0;ring<3;ring++)for(let i=0;i<N;i++){const j=(i+1)%N,x=ring*N+i,y=ring*N+j,X=x+N,Y=y+N;F.push([x,y,Y],[x,Y,X]);}F.push([0,3,2],[0,2,1],[12,13,14],[12,14,15]);barrels.push(add(b,mesh(P,F)));return true;};
 let elevationIndexStart=0,elevationVertexStart=0,sphereMeshRange;
 if(id==='moncal_pd_triple'){
  const sphere=a.components.find(r=>r.normalMode==='sphere'),part=sphere&&turretDrawSphere(a,sphere,8,4);if(!part||a.barrelCenters?.length!==3)return null;sphereMeshRange=add(sphere,part);
 }else{
  const byRole=role=>a.components.filter(r=>r.componentRole===role),base=byRole('intrinsic-bearing-ring')[0],body=byRole('fixed-gunhouse')[0],axles=byRole('fixed-transverse-axle'),bearings=byRole('moving-bearing'),receivers=byRole('moving-side-laser-receiver'),rails=byRole('moving-top-rail');
  if(!base||!body||axles.length!==2||bearings.length!==2||receivers.length!==2||a.barrelCenters?.length!==2)return null;
  cylinder(base,1,bounds(base));box(body,bounds(body));for(const r of axles)box(r,bounds(r));elevationIndexStart=idx.length;elevationVertexStart=pos.length/3;
  for(let i=0;i<2;i++){const b=bounds(receivers[i]),rail=rails[i];if(rail)b[4]=Math.max(b[4],bounds(rail)[4]);cylinder(bearings[i],2,bounds(bearings[i]));box(receivers[i],b);}
 }
 for(const b of a.barrelCenters)if(!barrel(b))return null;
 const mapRange=row=>{const next=components.find(c=>c.label===row.label);return next?{...row,firstVertex:next.firstVertex,vertices:next.vertices,firstIndex:next.firstIndex,indices:next.indices}:row;};
 const asset={...a,n:pos.length/3,faces:idx.length/3,components,barrelCenters:barrels,elevationIndexStart,elevationVertexStart,housingVertices:elevationVertexStart,housingFaces:elevationIndexStart/3,drivePivots:(a.drivePivots||[]).map(mapRange),renderOnly:true,minimumPointDefense:true};
 if(sphereMeshRange)asset.sphereMeshRange=sphereMeshRange;delete asset.data;delete asset.dataFrom;
 return {asset,mesh:{pos:Float32Array.from(pos),uv:Float32Array.from(uv),idx:Uint32Array.from(idx)},source:{vertices:a.n,faces:a.faces},reduced:true};
}
function turretRenderAsset(id){
 const source=C.REFERENCE_ASSETS[id];if(!source)return null;let result=TURRET_RENDER_ASSET_CACHE.get(source);if(result)return result;
 const raw=C.decodeReference(id);if(!raw)return null;
 const original=()=>({asset:source,mesh:raw,source:{vertices:source.n,faces:source.faces},reduced:false});
 const pointDefense=turretMinimumPointDefense(source,raw,id);if(pointDefense){TURRET_RENDER_ASSET_CACHE.set(source,pointDefense);return pointDefense;}
 if(id==='isd_heavy_octuple'||!['imperial-photo-family','light-photo-family','capital-photo-family','moncal-photo-family','point-defense-photo','cis-photo-family'].includes(source.nativeCalibration)||!source.components?.length){result=original();TURRET_RENDER_ASSET_CACHE.set(source,result);return result;}
 const rows=source.components.slice().sort((x,y)=>x.firstIndex-y.firstIndex||y.indices-x.indices),partition=[];let end=0;
 // Some authored houses also record a parent component around several small
 // cells. Draw those triangles once while retaining every nested metadata row.
 for(const row of rows){if(row.firstIndex<end){if(row.firstIndex+row.indices>end){result=original();TURRET_RENDER_ASSET_CACHE.set(source,result);return result;}continue;}partition.push(row);end=row.firstIndex+row.indices;}
 const pos=[],uv=[],idx=[],mapped=new Map(),rangeKey=r=>r.firstIndex+':'+r.indices,indexBoundary=new Map([[0,0]]),vertexBoundary=new Map([[0,0]]);let cursor=0,changed=false;
 for(const row of partition){
  if(row.firstIndex!==cursor){result=original();TURRET_RENDER_ASSET_CACHE.set(source,result);return result;}
  const barrel=(source.barrelCenters||[]).find(b=>b.firstIndex===row.firstIndex&&b.indices===row.indices),replacement=turretDrawSphere(source,row)||turretDrawBarrel(source,raw,row,barrel),part=replacement||turretDrawPart(source,raw,row);
  if(!part){result=original();TURRET_RENDER_ASSET_CACHE.set(source,result);return result;}
  const mesh=turretDrawCompact(part.pos,part.uv,part.idx),firstVertex=pos.length/3,firstIndex=idx.length,range={firstVertex,vertices:mesh.pos.length/3,firstIndex,indices:mesh.idx.length};
  pos.push(...mesh.pos);uv.push(...mesh.uv);for(const i of mesh.idx)idx.push(firstVertex+i);mapped.set(rangeKey(row),range);cursor+=row.indices;indexBoundary.set(row.firstIndex,firstIndex);indexBoundary.set(cursor,idx.length);vertexBoundary.set(row.firstVertex,firstVertex);vertexBoundary.set(row.firstVertex+row.vertices,pos.length/3);changed=changed||!!replacement;
  if(!replacement)for(const nested of rows){if(nested===row||nested.firstIndex<row.firstIndex||nested.firstIndex+nested.indices>cursor)continue;const lo=nested.firstVertex-row.firstVertex,hi=lo+nested.vertices;if(lo<0||hi>mesh.sourceVertexMap.length)continue;const used=Array.from(mesh.sourceVertexMap.subarray(lo,hi)).filter(i=>i>=0);if(!used.length)continue;const r={firstVertex:firstVertex+used[0],vertices:used.length,firstIndex:firstIndex+nested.firstIndex-row.firstIndex,indices:nested.indices};mapped.set(rangeKey(nested),r);indexBoundary.set(nested.firstIndex,r.firstIndex);indexBoundary.set(nested.firstIndex+nested.indices,r.firstIndex+r.indices);vertexBoundary.set(nested.firstVertex,r.firstVertex);vertexBoundary.set(nested.firstVertex+nested.vertices,r.firstVertex+r.vertices);}
 }
 if(cursor!==raw.idx.length||!indexBoundary.has(source.elevationIndexStart)){result=original();TURRET_RENDER_ASSET_CACHE.set(source,result);return result;}
 if(!changed){result=original();TURRET_RENDER_ASSET_CACHE.set(source,result);return result;}
 const remap=value=>{if(Array.isArray(value))return value.map(remap);if(!value||typeof value!=='object')return value;const range=mapped.get(rangeKey(value)),next={...value};if(range)Object.assign(next,range);for(const k of Object.keys(next))if(next[k]&&typeof next[k]==='object')next[k]=remap(next[k]);return next;};
 const asset={...source,n:pos.length/3,faces:idx.length/3,components:source.components.map(remap),barrelCenters:(source.barrelCenters||[]).map(remap),sphereMeshRange:source.sphereMeshRange&&remap(source.sphereMeshRange),drivePivots:(source.drivePivots||[]).map(remap),fixedDriveShoulders:(source.fixedDriveShoulders||[]).map(remap),machineryMeshRanges:(source.machineryMeshRanges||[]).map(remap),elevationIndexStart:indexBoundary.get(source.elevationIndexStart),elevationVertexStart:vertexBoundary.get(source.elevationVertexStart)??0,renderOnly:true};
 delete asset.data;delete asset.dataFrom;
 result={asset,mesh:{pos:Float32Array.from(pos),uv:Float32Array.from(uv),idx:Uint32Array.from(idx)},source:{vertices:source.n,faces:source.faces},reduced:true};TURRET_RENDER_ASSET_CACHE.set(source,result);return result;
}
// Interior non-emissive texel matching the area-weighted original octuple roof
// (2048px atlas). One sample avoids stretching panel rectangles into camouflage.
const TURRET_PAINT_UV=[.046142578125,.153564453125];
function applyTurretPaint(mesh){const color=refTone('isd_heavy_octuple');for(let i=0;i<mesh.n;i++){mesh.uv[i*2]=TURRET_PAINT_UV[0];mesh.uv[i*2+1]=TURRET_PAINT_UV[1];mesh.col.set(color,i*4);mesh.col[i*4+3]=255;}}
const PROCEDURAL_TURRET_PAINT_CACHE=new WeakMap();
function appendProceduralTurret(g,f){const key=JSON.stringify([f,C.fitSpec(f)],(k,v)=>k.startsWith('_')?undefined:v);let item=PROCEDURAL_TURRET_PAINT_CACHE.get(f);
 if(!item||item.key!==key){const body=FIT_SKIP_BODY,ped=FIT_SKIP_PED;let mesh;
  try{FIT_SKIP_BODY=null;FIT_SKIP_PED=new Set([f.id]);mesh=meshFits({fits:[f]},null,null,[f],true);}finally{FIT_SKIP_BODY=body;FIT_SKIP_PED=ped;}
  applyTurretPaint(mesh);item={key,mesh};PROCEDURAL_TURRET_PAINT_CACHE.set(f,item);}appendGeo(g,item.mesh);
}
function appendFamilyReference(g,f){
 const id=f.skinAsset||C.FITS[f.k].asset,render=turretRenderAsset(id),a=render.asset,key=JSON.stringify([f,C.fitSpec(f)],(k,v)=>k.startsWith('_')?undefined:v);let item=FAMILY_REFERENCE_CACHE.get(f);
 if(!item||item.key!==key){const mesh=new Geo(a.n),raw=render.mesh,point=fitReferenceTransform(f);appendReference(mesh,id,point,null,WHITE,[],[],null,null,render);applyTurretPaint(mesh);
  for(const part of a.components||[]){if(part.normalMode!=='sphere'||!Array.isArray(part.normalCenterM)||part.normalCenterM.length!==3||!part.normalCenterM.every(Number.isFinite))continue;
   const c=part.normalCenterM.map((v,k)=>(v-a.c[k])/a.size[k]),center=point(c),up=C.norm(C.sub(point([c[0],c[1]+1/a.size[1],c[2]]),center)),eps=Math.max(.002,(a.maxQuantizationErrorM||0)*3);
   for(let i=part.firstVertex;i<part.firstVertex+part.vertices;i++){const v=Array.from(raw.pos.subarray(i*3,i*3+3)),n0=Array.from(mesh.nor.subarray(i*3,i*3+3));
    // The cap has its own duplicated vertices: preserve its hard lower rim,
    // while the coincident vertices on the curved dome receive radial normals.
    if(Number.isFinite(part.floorYM)&&Math.abs(v[1]*a.size[1]+a.c[1]-part.floorYM)<=eps&&C.dot(n0,up)<-63.5)continue;
    const n=C.norm(C.sub(point(v),center));for(let j=0;j<3;j++)mesh.nor[i*3+j]=n[j]*127;}}
  for(const part of a.components||[]){if(part.normalMode!=='ellipsoid'||!Array.isArray(part.normalCenterM)||!Array.isArray(part.normalRadiiM)||part.normalCenterM.length!==3||part.normalRadiiM.length!==3||!part.normalCenterM.every(Number.isFinite)||!part.normalRadiiM.every(v=>Number.isFinite(v)&&v>0))continue;
   const c=part.normalCenterM,worldCenter=point(c.map((v,k)=>(v-a.c[k])/a.size[k]));
   // A flattened cast shell follows the ellipsoid gradient. Only explicitly
   // marked curved faces are smoothed; armor cuts and socket caps stay sharp.
   for(let i=part.firstVertex;i<part.firstVertex+part.vertices;i++){
    const gradient=c.map((v,k)=>(raw.pos[i*3+k]*a.size[k]+a.c[k]-v)/(part.normalRadiiM[k]**2)),tip=c.map((v,k)=>(v+gradient[k]-a.c[k])/a.size[k]),n=C.norm(C.sub(point(tip),worldCenter));
    for(let j=0;j<3;j++)mesh.nor[i*3+j]=n[j]*127;
   }}
  mesh.drawElevationIndexStart=a.elevationIndexStart;item={key,mesh};FAMILY_REFERENCE_CACHE.set(f,item);}
 if(g.ni===0)g.drawElevationIndexStart=item.mesh.drawElevationIndexStart;
 appendGeo(g,item.mesh);
}
function appendReference(g,id,point,filter,color=WHITE,cuts=[],skinPatches=[],ship=null,host=null,drawAsset=null){
 const a=drawAsset?.asset||C.REFERENCE_ASSETS[id],d=drawAsset?.mesh||C.decodeReference(id);if(!a||!d)return;if(!a.plainMetal)color=refTone(id,color);
 const pos=new Float32Array(d.pos.length),nor=new Float32Array(d.pos.length),indices=[];
 for(let i=0;i<d.pos.length;i+=3)pos.set(point([d.pos[i],d.pos[i+1],d.pos[i+2]],a),i);
 // The common uncut reference keeps every source index. Accumulate the
 // same area-weighted normals directly in the packed arrays; allocating
 // three point arrays and two vector arrays per triangle dominates dense
 // capital-ship previews.
 if(!filter&&!cuts.length&&!skinPatches.length&&!launcherRecessHost(ship,host)){
  for(let i=0;i<d.idx.length;i+=3){const a=d.idx[i]*3,b=d.idx[i+1]*3,c=d.idx[i+2]*3,ux=pos[b]-pos[a],uy=pos[b+1]-pos[a+1],uz=pos[b+2]-pos[a+2],vx=pos[c]-pos[a],vy=pos[c+1]-pos[a+1],vz=pos[c+2]-pos[a+2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
   nor[a]+=nx;nor[a+1]+=ny;nor[a+2]+=nz;nor[b]+=nx;nor[b+1]+=ny;nor[b+2]+=nz;nor[c]+=nx;nor[c+1]+=ny;nor[c+2]+=nz;
  }
  g.room(a.n,d.idx.length);const base=g.n;
  for(let i=0;i<a.n;i++){const k=i*3,nx=nor[k],ny=nor[k+1],nz=nor[k+2],length=Math.hypot(nx,ny,nz)||1,unit=Math.abs(length-1)<1e-12;g.v(pos[k],pos[k+1],pos[k+2],unit?nx:nx/length,unit?ny:ny/length,unit?nz:nz/length,d.uv[i*2],d.uv[i*2+1],color,255);}
  for(let i=0;i<d.idx.length;i+=3)g.tri(base+d.idx[i],base+d.idx[i+1],base+d.idx[i+2]);return;
 }
 for(let i=0;i<d.idx.length;i+=3){const ids=[d.idx[i],d.idx[i+1],d.idx[i+2]];
  if(filter&&!filter(ids.map(k=>[d.pos[k*3],d.pos[k*3+1],d.pos[k*3+2]]),a))continue;
  indices.push(...ids);const [A,B,D]=ids.map(k=>Array.from(pos.subarray(k*3,k*3+3))),n=C.cross(C.sub(B,A),C.sub(D,A));for(const k of ids)for(let j=0;j<3;j++)nor[k*3+j]+=n[j];
 }
 if(cuts.length||skinPatches.length||launcherRecessHost(ship,host)){let d2={pos,uv:d.uv,idx:Uint32Array.from(indices)};for(const b of cuts)d2=C.clipReferenceBox(d2,b);indexedReference(g,launcherReferenceSkin(ship,host,equipmentReferenceSkin(d2,skinPatches)),color);return;}
 g.room(a.n,indices.length);const base=g.n;
 for(let i=0;i<a.n;i++){const n=C.norm(Array.from(nor.subarray(i*3,i*3+3)));g.v(...pos.subarray(i*3,i*3+3),...n,d.uv[i*2],d.uv[i*2+1],color,255);}
 for(let i=0;i<indices.length;i+=3)g.tri(base+indices[i],base+indices[i+1],base+indices[i+2]);
}
function indexedReference(g,d,color=REF_ONE){
 const normal=new Float32Array(d.pos.length);for(let i=0;i<d.idx.length;i+=3){const ids=Array.from(d.idx.subarray(i,i+3)),[a,b,c]=ids.map(k=>Array.from(d.pos.subarray(k*3,k*3+3))),n=C.cross(C.sub(b,a),C.sub(c,a));for(const k of ids)for(let j=0;j<3;j++)normal[k*3+j]+=n[j];}
 g.room(d.pos.length/3,d.idx.length);const base=g.n;for(let i=0;i<d.pos.length/3;i++)g.v(...d.pos.subarray(i*3,i*3+3),...C.norm(Array.from(normal.subarray(i*3,i*3+3))),d.uv[i*2],d.uv[i*2+1],color,255);
 for(let i=0;i<d.idx.length;i+=3)g.tri(base+d.idx[i],base+d.idx[i+1],base+d.idx[i+2]);
}
function meshReferenceHull(ship){const g=new Geo(16),d=C.referenceHullGeometry(ship);if(d)indexedReference(g,launcherReferenceSkin(ship,'hull',equipmentReferenceSkin(d,equipmentSkinPatches(ship,'hull'))),refTone(ship.hullSkin?.asset||(ship.reference==='imperial'?'isd_hull':'ven_hull')));return g;}
function appendEngineSplit(outside,inside,ship,p){
 const entry=C.engineHullEntry(ship,p),d=C.engineSkinMesh(p);if(!d)return;
 if(entry==null){indexedReference(outside,d,refTone(d.skinAsset));return;}
 const forward=C.mul(C.norm(p.dir||[-1,0,0]),-1),polys=[[],[]];
 for(let i=0;i<d.idx.length;i+=3){const poly=[];for(let j=0;j<3;j++){const k=d.idx[i+j],q=Array.from(d.pos.subarray(k*3,k*3+3));poly.push([C.dot(C.sub(q,p.c),forward),...q,d.uv[k*2],d.uv[k*2+1]]);}
  for(let side=0;side<2;side++){const clipped=C.clipPoly(poly,0,entry,!!side);for(let j=1;j<clipped.length-1;j++)polys[side].push(clipped[0],clipped[j],clipped[j+1]);}
 }
 for(let side=0;side<2;side++){const verts=polys[side],data={pos:Float32Array.from(verts.flatMap(v=>v.slice(1,4))),uv:Float32Array.from(verts.flatMap(v=>v.slice(4))),idx:Uint32Array.from(verts.map((v,i)=>i))};indexedReference(side?inside:outside,data,refTone(d.skinAsset));}
}
function meshReferenceParts(ship,ranges,only,opt={}){
 const refStruct=new Geo(16),refEngine=new Geo(16),refPlant=new Geo(16),out={refStruct,refEngine,refPlant};
 const one=(p,a)=>{
  if(p.k==='engine'){if(opt.preview){const d=C.engineSkinMesh(p);if(d)indexedReference(refEngine,d,refTone(d.skinAsset));}else appendEngineSplit(refEngine,refPlant,ship,p);return;}
  if(isStructuralPart(p)&&!opt.preview&&ship.solidCuts?.some(c=>ship.hull.assembly||c.structures)){p._solidCutShip=ship;hullTriangleMesh(refStruct,equipmentSkinTriangles(ship,'p'+p.id,C.structTriangles(p)),(p.paint?hex(p.paint):[205,211,216]).map(v=>Math.round(v/2)),40);return;}
  if(isStructuralPart(p)){appendReference(refStruct,p.skinAsset,v=>C.referencePartPoint(p,v),null,p.paint?hex(p.paint):WHITE,opt.preview?[]:ship.hatches.filter(h=>h.portal&&!h.referenceMouth).map(h=>C.openingBounds(ship,h)).filter(Boolean),opt.preview?[]:equipmentSkinPatches(ship,'p'+p.id),opt.preview?null:ship,'p'+p.id);return;}
  const size=p.skinSize||a.size,scale=p.d/Math.max(...size),r=(p.yaw||0)*Math.PI/180,rigid=p.placement?.mode==='direct'&&p.placement.parentStructureId!=null;
  appendReference(refStruct,p.skinAsset,v=>{const x=v[0]*size[0]*scale,y=v[1]*size[1]*scale,z=v[2]*size[2]*scale;return rigid?C.worldStruct(p,[x,y,z]):C.add(p.c,[x*Math.cos(r)-z*Math.sin(r),y,x*Math.sin(r)+z*Math.cos(r)]);});
 };
 for(const p of only||ship.parts){if(p._placementGeometry&&C.isShapePart(p))continue;if(C.isHullStructure?.(p)){const data=p.hullData?.hullSkin?.enabled?C.hullStructureGeometry(ship,p).referenceSkin:null;if(data){const before=geoMarks(out);indexedReference(refStruct,data,refTone(data.asset||p.hullData.hullSkin.asset));if(ranges)markRanges(ranges,p.id,before,out);}continue;}const a=C.REFERENCE_ASSETS[(p.k==='engine'?C.engineAppearance(p):p)?.skinAsset];if(!a||isStructuralPart(p)&&a.plainMetal)continue;const before=geoMarks(out);one(p,a);if(ranges)markRanges(ranges,p.id,before,out);}
 return {refStruct,refEngine,refPlant};
}
function meshReferenceFits(ship,ranges,only){
  const g=new Geo(16);for(const f of only||surfaceRenderFits(ship)){const d=C.FITS[f.k];if(noModelFit(f)||embeddedSurfaceFit(f)||!(d.asset||d.pod||sharedProceduralTurret(f))||f.float&&!sharedProceduralTurret(f)||plainFitAsset(f)&&!familyReferenceAsset(f))continue;const before=g.ni;
  if(sharedProceduralTurret(f))appendProceduralTurret(g,f);else if(familyReferenceAsset(f))appendFamilyReference(g,f);else if(d.pod)appendReference(g,C.POD_ASSET,v=>C.podPoint(f,v));else appendReference(g,f.skinAsset||d.asset,v=>C.referenceFitPoint(f,v));
  if(ranges&&g.ni>before)(ranges[f.id]||(ranges[f.id]=[])).push(['refFits',before,g.ni-before]);
 }return g;
}
// Live preview of edited parts and fittings, built in the editor from their
// requested shapes while the engine recomputes clipped, merged geometry.
const PREVIEW_SHIPS=new WeakMap(),PREVIEW_PARTS=new WeakMap(),PREVIEW_PLACEMENT_GEOMETRY_IDS=new WeakMap();
let previewPlacementGeometryId=0;
const previewKey=value=>JSON.stringify(value,(k,v)=>k.startsWith('_')?undefined:v);
function previewPlacementGeometry(part){return part._placementGeometry&&C.placementCachedGeometryInputCurrent?.(part)?part._placementGeometry:null;}
function previewPlacementGeometryKey(part){const geometry=previewPlacementGeometry(part);if(!geometry)return 0;let id=PREVIEW_PLACEMENT_GEOMETRY_IDS.get(geometry);if(!id){id=++previewPlacementGeometryId;PREVIEW_PLACEMENT_GEOMETRY_IDS.set(geometry,id);}return id;}
// The editor supplies the same authored proxy used by pending picking. The
// fallback also retains the local hull cache instead of cloning it per frame.
function previewRequestedPart(p){
 const key=previewKey(p),geometry=previewPlacementGeometry(p),old=PREVIEW_PARTS.get(p);if(old?.key===key&&old.geometry===geometry)return old.part;
 const part={...p,_placementGeometry:geometry||undefined,_packing:undefined,_clip:undefined,_solidCutShip:undefined,_apertures:undefined,_pierced:undefined};PREVIEW_PARTS.set(p,{key,geometry,part});return part;
}
function compactPreviewGeo(g){const bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];for(let i=0;i<g.n*3;i++){const a=i%3;bounds[a]=Math.min(bounds[a],g.pos[i]);bounds[a+3]=Math.max(bounds[a+3],g.pos[i]);}return {n:g.n,ni:g.ni,pos:g.pos.slice(0,g.n*3),nor:g.nor.slice(0,g.n*3),uv:g.uv.slice(0,g.n*2),col:g.col.slice(0,g.n*4),idx:g.idx.slice(0,g.ni),bounds:g.n?bounds:null};}
function compactPreviewMeshes(value){const out={glow:value.glow};for(const k of ['preview','previewRef','previewFits','previewRefFits'])out[k]=compactPreviewGeo(value[k]);return out;}
function previewFitBounds(f,key,meshes){
 if(FIT_SKIP_BODY?.has(f.id)||FIT_SKIP_PED?.has(f.id))return;
 const bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];for(const g of [meshes.previewFits,meshes.previewRefFits])for(let i=0;i<g.n*3;i++){const a=i%3;bounds[a]=Math.min(bounds[a],g.pos[i]);bounds[a+3]=Math.max(bounds[a+3],g.pos[i]);}
 if(bounds.every(Number.isFinite)){FIT_RAY_BOUNDS.set(f,{key,bounds});FIT_RAY_SOURCES.set(f,{key,meshes:[meshes.previewFits,meshes.previewRefFits]});}
}
function buildPreviewMeshes(ship,parts,fits,opt={}){
 const g=new Geo(2048),out={struct:g,plate:g,gen:g,shield:g,hyper:g,interior:g,engine:g,plant:g,nozzle:g,hangar:g},glow=[];
 // Requested internal envelopes can extend outside the ship. Keep their editor
 // outlines until the engine returns the clipped solid, in every view mode.
 // Surface-role volumes are diagnostic too, even when backed by an adapter.
 const plain=parts.filter(p=>(p.placement?.pendingGeometry||p.placement?.validationFailed||p.k==='engineCore'||!C.isInternal(p))&&!(p.surfaceRole&&p.surfaceRole!=='weapons'&&p.surfacePatch)).map(p=>(opt.requestedPart||previewRequestedPart)(p));
 for(const p of plain)meshOnePart(out,p,ship,{coded:!!opt.coded,preview:true},glow);
 const engines=new Set(plain.filter(p=>p.k==='engine'&&!p.placement?.pendingGeometry&&!p.placement?.validationFailed).map(p=>p.id));
 if(engines.size){const replacements=new Map(plain.map(p=>[p.id,p])),model={...ship,parts:ship.parts.map(p=>replacements.get(p.id)||p)};for(const p of plain)if(!model.parts.some(q=>q.id===p.id))model.parts.push(p);for(const p of C.engineMachineryPaths(model))if(engines.has(p.nozzle))meshOnePart(out,p,model,{coded:!!opt.coded,preview:true},glow);}
 if(opt.coded)for(let i=3;i<g.n*4;i+=4)if(g.col[i]===251)g.col[i]=255;
 const ref=meshReferenceParts(ship,null,plain,{preview:true}),refG=new Geo(64);for(const k of ['refStruct','refEngine','refPlant'])if(ref[k].ni)appendGeo(refG,ref[k]);
 const fitG=fits.length?meshFits(ship,null,null,fits):new Geo(16),refFitG=fits.length?meshReferenceFits(ship,null,fits):new Geo(16);
 return {preview:g,previewRef:refG,previewFits:fitG,previewRefFits:refFitG,glow};
}
// Keep the unchanged draft on screen while adding only the newly edited
// geometry. Initial large designs must not be triangulated again per gun.
const PREVIEW_GROUPS=['preview','previewRef','previewFits','previewRefFits'];
function previewRanges(ranges){const out=[];for(const [start,count]of ranges.sort((a,b)=>a[0]-b[0])){if(!count)continue;const last=out[out.length-1];if(last&&last[0]+last[1]>=start)last[1]=Math.max(last[1],start+count-last[0]);else out.push([start,count]);}return out;}
function uploadPreviewGeo(renderer,m,g){
 const gl=renderer.gl,count=g.previewActiveIndices===0?0:g.ni;
 if(m.previewToken===g.previewToken&&m.previewRevision===g.previewRevision){if(m.count!==count){m.count=count;m.ver=(m.ver||0)+1;}return;}
 const full=m.previewToken!==g.previewToken||m.previewCap!==g.cap||m.previewIcap!==g.icap||m.previewRevision!==g.previewFromRevision;
 for(const [key,width]of [['pos',3],['nor',3],['uv',2],['col',4]]){const source=g[key];if(!full&&!g.previewVertices.length)continue;gl.bindBuffer(gl.ARRAY_BUFFER,m[key]);if(full)gl.bufferData(gl.ARRAY_BUFFER,source,gl.DYNAMIC_DRAW);else for(const [start,length]of g.previewVertices)gl.bufferSubData(gl.ARRAY_BUFFER,start*width*source.BYTES_PER_ELEMENT,source.subarray(start*width,(start+length)*width));}
 if(full||g.previewIndices.length){gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.idx);if(full)gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,renderer.u32?g.idx:Uint16Array.from(g.idx),gl.DYNAMIC_DRAW);else for(const [start,length]of g.previewIndices)gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER,start*(renderer.u32?4:2),renderer.u32?g.idx.subarray(start,start+length):Uint16Array.from(g.idx.subarray(start,start+length)));}
 m.flat=false;m.type=renderer.u32?gl.UNSIGNED_INT:gl.UNSIGNED_SHORT;m.count=count;m.bb=g.previewBounds;m.ver=(m.ver||0)+1;m.previewToken=g.previewToken;m.previewRevision=g.previewRevision;m.previewCap=g.cap;m.previewIcap=g.icap;
}
function incrementalPreviewMeshes(cache,entries,glow){
 let state=cache.incremental;
 // A finished full draft followed by one edited gun must not keep millions
 // of obsolete degenerate indices in the small overlay.
 if(state&&state.size>32&&entries.length<state.size/4)state=null;
 if(!state){state={groups:{},blocks:{},size:0};for(const name of PREVIEW_GROUPS){const g=new Geo(64);g.previewToken={};g.previewRevision=0;g.previewFromRevision=-1;g.previewVertices=[];g.previewIndices=[];g.previewBounds=null;g.previewActiveIndices=0;state.groups[name]=g;state.blocks[name]=new Map();}cache.incremental=state;}
 state.size=entries.length;
 for(const name of PREVIEW_GROUPS){const g=state.groups[name],blocks=state.blocks[name],seen=new Set(),vertices=[],indices=[],retire=b=>{g.idx.fill(b.base,b.first,b.first+b.count);indices.push([b.first,b.count]);b.active=false;};
  for(const entry of entries){const chunk=entry.value[name];if(!chunk.ni)continue;seen.add(entry.token);let block=blocks.get(entry.token);if(block?.active&&block.geo===chunk)continue;
   if(!block||block.n!==chunk.n||block.count!==chunk.ni){if(block?.active)retire(block);block={base:g.n,first:g.ni,n:chunk.n,count:chunk.ni};appendGeo(g,chunk);blocks.set(entry.token,block);}else{for(const [key,width]of [['pos',3],['nor',3],['uv',2],['col',4]])g[key].set(chunk[key],block.base*width);for(let i=0;i<chunk.ni;i++)g.idx[block.first+i]=block.base+chunk.idx[i];}
   block.geo=chunk;block.active=true;vertices.push([block.base,chunk.n]);indices.push([block.first,chunk.ni]);
  }
  for(const [token,block]of blocks)if(block.active&&!seen.has(token))retire(block);
  if(vertices.length||indices.length){g.previewFromRevision=g.previewRevision;g.previewRevision++;g.previewVertices=previewRanges(vertices);g.previewIndices=previewRanges(indices);const bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];let active=0;for(const block of blocks.values())if(block.active){active+=block.count;const b=block.geo.bounds;if(b)for(let a=0;a<3;a++){bounds[a]=Math.min(bounds[a],b[a]);bounds[a+3]=Math.max(bounds[a+3],b[a+3]);}}g.previewActiveIndices=active;g.previewBounds=active?bounds:null;}
 }
 return {...state.groups,glow};
}
function clearPreviewCache(ship){
 for(const f of ship?.fits||[])FIT_RAY_SOURCES.delete(f);PREVIEW_SHIPS.delete(ship);PLACEMENT_DRAFT_PREVIEWS.delete(ship);
}
// Keep unchanged draft chunks and GPU buffers while the worker builds. New
// or edited items take priority; the remaining initial draft fills while idle.
function meshPreview(ship,parts,fits,opt={}){
 parts=parts.filter(p=>!isHiddenEngineFeed(p));
 let cache=PREVIEW_SHIPS.get(ship);if(!cache){cache={parts:new Map(),fits:new Map(),visible:new Map(),contextVersion:0,environmentVersion:0};PREVIEW_SHIPS.set(ship,cache);}
 const revision=opt.progressive&&Number.isFinite(opt.revision)?opt.revision:null,stamp=revision==null?null:revision+':'+!!opt.coded+':'+parts.length+':'+fits.length;
 let plan=stamp!=null&&cache.plan?.stamp===stamp?cache.plan:null;
 // A Worker may replace only derived fitting data while public input and the
 // caller's revision stay equal. Reuse unchanged plans without hashing meshes.
 if(plan&&!parts.every((p,i)=>{const old=plan.placementInputs?.[i];return old?.part===p&&old.geometry===p._placementGeometry&&old.self===p._placementSelfKey&&old.request===p._placementRequestKey;}))plan=null;
 if(!plan){const context=previewKey([ship.paint,ship.detail,ship.reference,ship.hullSkin,ship.hatches,ship.armor]);if(cache.context!==context){cache.context=context;cache.contextVersion++;}
  const engineParts=parts.filter(p=>p.k==='engine'),needsEnvironment=engineParts.length||parts.some(p=>p.room||p.k==='machinery');
  if(needsEnvironment){const key=previewKey([ship.hull,ship.cuts,ship.subs,ship.trenches,ship.solidCuts,ship.parts]);if(cache.environment!==key){cache.environment=key;cache.environmentVersion++;}}
  const tasks=[],add=(token,key,store,id,build,after,sourceParts)=>tasks.push({token,key,store,id,build,after,sourceParts});
  for(const p of parts)if(p.k!=='engine'){const id=p.id??p,key=previewKey([p,!!opt.coded,cache.contextVersion,p.room||p.k==='machinery'?cache.environmentVersion:0,previewPlacementGeometryKey(p)]);add(p.id==null?p:'p'+id,key,cache.parts,id,()=>buildPreviewMeshes(ship,[p],[],opt),null,[p]);}
  if(engineParts.length){const key=previewKey([engineParts,!!opt.coded,cache.contextVersion,cache.environmentVersion]);add('engines',key,cache.parts,'engines',()=>buildPreviewMeshes(ship,engineParts,[],opt),null,engineParts);}
  for(const f of fits){const geometryKey=JSON.stringify([f,C.fitSpec(f),f._store],(k,v)=>k.startsWith('_')?undefined:v),key=geometryKey+':'+cache.contextVersion+':'+!!FIT_SKIP_BODY?.has(f.id)+':'+!!FIT_SKIP_PED?.has(f.id),id=f.id??f;add(f.id==null?f:'f'+id,key,cache.fits,id,()=>buildPreviewMeshes(ship,[],[f],opt),value=>previewFitBounds(f,geometryKey,value));}
  const current=new Map(tasks.map(task=>[task.token,task]));for(const [token,value]of cache.visible)if(current.get(token)?.key!==value.key)cache.visible.delete(token);
  const partIds=new Set(ship.parts.map(p=>p.id??p)),fitIds=new Set(ship.fits.map(f=>f.id??f));for(const id of cache.parts.keys())if(id!=='engines'&&!partIds.has(id))cache.parts.delete(id);for(const id of cache.fits.keys())if(!fitIds.has(id))cache.fits.delete(id);
  plan={stamp,tasks,current,placementInputs:parts.map(part=>({part,geometry:part._placementGeometry,self:part._placementSelfKey,request:part._placementRequestKey}))};cache.plan=plan;
 }
 const urgentParts=opt.priorityParts||[],urgentFits=opt.priorityFits||[],urgent=new Set();
 if(urgentParts.length+urgentFits.length<=8){for(const p of urgentParts)urgent.add(p.k==='engine'?'engines':p.id==null?p:'p'+p.id);for(const f of urgentFits)urgent.add(f.id==null?f:'f'+f.id);}
 const clock=()=>typeof performance!=='undefined'?performance.now():Date.now(),deadline=clock()+Math.max(0,opt.budgetMs??6),tasks=plan.tasks.filter(task=>!cache.visible.has(task.token)).sort((a,b)=>Number(urgent.has(b.token))-Number(urgent.has(a.token)));let processed=0;
 for(const task of tasks){const priority=urgent.has(task.token);if(opt.progressive&&!priority&&(opt.deferBackground||processed>=8||processed>0&&clock()>=deadline))continue;let item=task.store.get(task.id);if(item?.key!==task.key){if(task.sourceParts&&opt.canMeshPart&&!task.sourceParts.every(opt.canMeshPart))continue;item={key:task.key,value:compactPreviewMeshes(task.build()),placementPendingInputKey:task.sourceParts?.length===1&&task.sourceParts[0].placement?.pendingGeometry?C.placementPendingInputKey(task.sourceParts[0]):null};task.store.set(task.id,item);if(task.after)task.after(item.value);}cache.visible.set(task.token,{token:task.token,key:task.key,value:item.value});processed++;}
 const entries=plan.tasks.map(task=>cache.visible.get(task.token)).filter(Boolean),glow=[];for(const entry of entries)if(entry.value.glow?.length)for(const n of entry.value.glow)glow.push(n);
 let result;if(opt.incremental)result=incrementalPreviewMeshes(cache,entries,glow);else{
  const groups={};for(const k of PREVIEW_GROUPS){groups[k]=new Geo(64);groups[k].bounds=null;}
  for(const entry of entries)for(const k of PREVIEW_GROUPS)if(entry.value[k].ni){
   const g=groups[k],block=entry.value[k];appendGeo(g,block);
   // Keep the exact bounds already measured for each cached geometry block.
   // Catalogue cameras must include manual pedestals outside a turret's body.
   if(block.bounds){if(!g.bounds)g.bounds=block.bounds.slice();else for(let a=0;a<3;a++){g.bounds[a]=Math.min(g.bounds[a],block.bounds[a]);g.bounds[a+3]=Math.max(g.bounds[a+3],block.bounds[a+3]);}}
  }
  result={...groups,glow};
 }
 if(opt.placementDraftPickable){
  const visible=new Map();for(const task of plan.tasks){if(task.sourceParts?.length!==1)continue;const part=ship.parts.find(part=>part.id===task.id),item=task.store.get(task.id),entry=cache.visible.get(task.token);if(!part?.placement?.pendingGeometry||part.placement.validationFailed||!item?.placementPendingInputKey||entry?.value!==item.value||item.placementPendingInputKey!==C.placementPendingInputKey(part)||!(item.value.preview.ni||item.value.previewRef.ni))continue;visible.set(part.id,{inputKey:item.placementPendingInputKey,value:item.value});}
  PLACEMENT_DRAFT_PREVIEW_RESULTS.set(result,{source:ship,entries:visible});
 }
 if(opt.progressive)result.pending=entries.length<plan.tasks.length;return result;
}

function meshReferenceHatches(ship,owned=false){
 const g=new Geo(16);
 for(const h of ship.hatches){if(!h.skinAsset||h._doorDetached||h.hullOwner&&!owned)continue;const bay=ship.parts.find(p=>p.id===h.bay)||(owned?{c:h.skinBayAnchor||[0,0,0]}:null);if(!bay)continue;const delta=C.sub(bay.c,h.skinBayAnchor||bay.c),open=h.open??0,side=h.face==='port'?-1:1,spec=C.slidingHatchSpec(ship,h),mid=spec?(spec.b[spec.slideAxis]+spec.b[spec.slideAxis+3])/2:0;
  appendReference(g,h.skinAsset,(v,a)=>{const p=v.map((n,i)=>n*a.size[i]+a.c[i]+delta[i]);if(spec)p[spec.slideAxis]+=Math.sign(p[spec.slideAxis]-mid)*spec.travel*open;else if(h.face==='top'||h.face==='bottom')p[2]+=Math.sign(p[2]-delta[2])*a.size[2]*.52*open;else p[0]-=a.size[0]*open;return p;},(v,a)=>(!['port','stbd'].includes(h.face)||v.reduce((s,q)=>s+q[2],0)*side>0)&&(!h._slideSide||!spec||h._slideSide*(v.reduce((s,q)=>s+q[spec.slideAxis]*a.size[spec.slideAxis]+a.c[spec.slideAxis]+delta[spec.slideAxis],0)/3-mid)>=0));
 }
 // Ventral approach bay belongs to the hull skin; its doors are independently operated.
 if(!ship._referenceDoorOnly&&ship.hullSkin?.enabled&&ship.reference==='venator')appendReference(g,'ven_bay',(v,a)=>v.map((n,i)=>n*a.size[i]+a.c[i]));
 if(!owned)for(const p of ship.parts.filter(q=>C.isHullStructure?.(q))){const part=meshReferenceHatches(C.hullStructureShip(ship,p),true),origin=C.hullWorldPoint(p,[0,0,0]);for(let i=0;i<part.n;i++){const point=C.hullWorldPoint(p,Array.from(part.pos.subarray(i*3,i*3+3))),normal=C.norm(C.sub(C.hullWorldPoint(p,Array.from(part.nor.subarray(i*3,i*3+3),v=>v/127)),origin));part.pos.set(point,i*3);part.nor.set(normal.map(v=>v*127),i*3);}if(p.hullMirrorZ)for(let i=0;i<part.ni;i+=3)[part.idx[i+1],part.idx[i+2]]=[part.idx[i+2],part.idx[i+1]];appendGeo(g,part);}
 return g;
}

// A blueprint is uploaded once and reused by every ship in the fleet.
Renderer.prototype.prepareFleet=function(key,ship){
 this.fleetCache=this.fleetCache||new Map();if(this.fleetCache.has(key))return this.fleetCache.get(key);
 return this.loadFleet(key,fleetGeometry(ship));
};
// Rigid S-foil articulation uses the original design coordinates, including a custom hinge.
// The same transform is used by the renderers and by the trial's weapon aiming code.
function foilTransform(foil,d){
 const fraction=Number.isFinite(d)?C.clamp(d,0,1):1,a=((foil.stow??0)-(foil.open??15))*(1-fraction)*(foil.sg??1)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),axis=foil.axis||'x';
 const rot=axis==='y'?[c,0,-s,0,1,0,s,0,c]:axis==='z'?[c,s,0,-s,c,0,0,0,1]:[1,0,0,0,c,s,0,-s,c],pivot=foil.pivot||[0,0,0];
 const direction=v=>mat3Point(rot,v),point=v=>C.add(pivot,direction(C.sub(v,pivot)));
 return {rot,point,direction};
}
function fleetTurretList(asset,unit){
 if(unit.turrets)return unit.turrets;if(!asset.surfaceTurrets)return [];
 return (asset.turrets||[]).filter(t=>t.mesh).flatMap(t=>{const foil=asset.foils?.find(f=>f.id===t.foilId),X=foil?foilTransform(foil,unit.foils?.[foil.id]):null,part=(mesh,pivot)=>({mesh,pivot:X?X.point(pivot):pivot,restPivot:pivot,rot:X?X.rot:MAT3_I});return t.bodyMesh?[part(t.bodyMesh,t.bodyPivot),part(t.mesh,t.pivot)]:[part(t.mesh,t.pivot)];});
}
function mat3Point(R,v){return [R[0]*v[0]+R[3]*v[1]+R[6]*v[2],R[1]*v[0]+R[4]*v[1]+R[7]*v[2],R[2]*v[0]+R[5]*v[1]+R[8]*v[2]];}
function fleetFoilPose(asset,unit,foil,center=asset.center){
 const T=foilTransform(foil,unit.foils?.[foil.id]),R=unit.rot||yawMatrix(unit.yaw||0),sx=unit.stretch||1,S=[sx,0,0,0,1,0,0,0,1],p=foil.pivot;
 const offset=mat3Point(R,[p[0]*sx-center[0],p[1]-center[1],p[2]-center[2]]);
 return {off:C.add(unit.pos,offset),center:p,rot:mat3Mul(R,mat3Mul(S,T.rot))};
}
function fleetFoilMoving(asset,unit){return (asset.foils||[]).some(f=>Math.abs(((f.stow??0)-(f.open??15)))*(1-(Number.isFinite(unit.foils?.[f.id])?C.clamp(unit.foils[f.id],0,1):1))>1e-8);}
// Compact a partition of indexed triangles without changing its normals or materials.
function geoIndices(source,indices){
 const out=new Geo(Math.max(1,Math.min(source.n,indices.length))),vertices=new Map();
 for(const old of indices){let next=vertices.get(old);if(next==null){out.room(1,1);next=out.n++;vertices.set(old,next);out.pos.set(source.pos.subarray(old*3,old*3+3),next*3);out.nor.set(source.nor.subarray(old*3,old*3+3),next*3);out.uv.set(source.uv.subarray(old*2,old*2+2),next*2);out.col.set(source.col.subarray(old*4,old*4+4),next*4);}else out.room(0,1);out.idx[out.ni++]=next;}
 return out;
}
function splitFoilGeometry(meshes,ranges,foils,owners){
 const byMesh=new Map();
 for(const [id,rows] of Object.entries(ranges)){const owner=owners.get(Number(id));if(owner==null)continue;for(const [name,start,count] of rows){if(!meshes[name]?.geo?.ni)continue;if(!byMesh.has(name))byMesh.set(name,[]);byMesh.get(name).push({owner,start,count});}}
 for(const [name,rows] of byMesh){const original=meshes[name],g=original.geo,ownerAt=new Int32Array(g.ni),partitions=new Map();
  for(const row of rows)for(let i=row.start;i<Math.min(g.ni,row.start+row.count);i++)if(!ownerAt[i])ownerAt[i]=row.owner+1;
  const stationary=[];for(let i=0;i<g.ni;i+=3){const owner=ownerAt[i]-1,indices=owner<0?stationary:(partitions.get(owner)||(()=>{const a=[];partitions.set(owner,a);return a;})());indices.push(g.idx[i],g.idx[i+1],g.idx[i+2]);}
  meshes[name]={...original,geo:geoIndices(g,stationary)};
  for(const [owner,indices] of partitions){const foil=foils[owner],key='foil_'+foil.id+'_'+name;foil.meshes.push(key);foil.kinds[key]=name;meshes[key]={geo:geoIndices(g,indices),tex:original.tex||MESH_TEX[name]||'hull',emi:original.emi??MESH_EMI[name]??0,source:name};}
 }
}
// Fleet geometry is built by the background engine; the renderer only uploads it.
function fleetGeometry(ship,opts){
 const sliding=ship.hatches.some(h=>C.isSlidingHatch(ship,h)),model=sliding?C.surfaceRenderClone(ship):ship;
 if(sliding)for(const h of model.hatches)if(C.isSlidingHatch(model,h)){h.open=1;h._doorDetached=true;}
 const meshes={},b=shipBounds(ship),center=Array.isArray(opts?.center)&&opts.center.length===3&&opts.center.every(Number.isFinite)?opts.center.slice():[(b[0]+b[3])/2,(b[1]+b[4])/2,(b[2]+b[5])/2],doors=[],rays=[],put=(name,geo,tex,emi)=>{meshes[name]={geo,tex,emi};};
 const owners=new Map(),foils=model.parts.filter(C.isFoil).map((wing,i)=>{const members=C.wingMembers(model,wing),frame=C.foilFrame(model,wing),partIds=[],fitIds=[];for(const p of [wing,...members.structs,...members.parts])if(!owners.has(p.id)){owners.set(p.id,i);partIds.push(p.id);}for(const f of members.fits)if(!owners.has(f.id)){owners.set(f.id,i);fitIds.push(f.id);}return {id:wing.id,pivot:frame.pv,axis:frame.ax,sg:frame.sg,open:wing.wing.open,stow:wing.wing.stow,T:wing.wing.T,partIds,fitIds,meshes:[],kinds:{},glow:[]};});
 if(model.surfaces?.patches?.length&&typeof C.surfacePatches==='function'){const patches=new Map(C.surfacePatches(model).map(p=>[p.id,p]));for(const [kind,list]of [['part',model.parts],['fit',surfaceRenderFits(model)]])for(const q of list){const host=patches.get(q.surfacePatch)?.host,owner=/^p\d+$/.test(host||'')?owners.get(+host.slice(1)):null;if(owner==null||owners.has(q.id))continue;owners.set(q.id,owner);foils[owner][kind==='part'?'partIds':'fitIds'].push(q.id);}}
 for(const row of surfaceVisualPlan(model)){const owner=/^p\d+$/.test(row.host)?owners.get(+row.host.slice(1)):null;if(owner==null)continue;for(const item of row.devices){if(owners.has(item.id))continue;owners.set(item.id,owner);foils[owner].partIds.push(item.id);}}
 put('hull',meshHull(model));const parts=meshParts(model,{coded:false});for(const name of ['struct','plate','surfaceArmor','surfaceDevices','surfaceDetail','refStruct','gen','shield','hyper','engine','refEngine','nozzle','hangar'])if(parts.g[name]&&(!name.startsWith('surface')||parts.g[name].ni))put(name,parts.g[name]);
 const h=meshHatches(model);put('hatchOpen',h.open);put('hatchRay',h.ray);put('refHatches',meshReferenceHatches(model));put('refHull',meshReferenceHull(model));
 const surfaceTurrets=!!model.surfaces,ranges=parts.ranges,turrets=opts?.trial||surfaceTurrets?trialTurrets(model,put,ranges):null,launchers=opts?.trial?[...surfaceRenderFits(model).filter(f=>C.FITS[f.k].msl&&!C.isConcussionLauncher(f)&&!f.float).map(f=>{const d=C.fitSpec(f),up=C.fitUp(f),port=C.surfaceBatteryGeometry?.(f);return {id:f.id,origin:port?port.mouth:C.add(C.fitOrigin(f),C.mul(up,d.hm)),axis:port?port.normal:up,salvo:8,cycle:20,tt:(d.msl||80)/8,ion:!!C.FITS[f.k].ionMsl};}),...craftLaunchers(model)]:null,targetRadius=C.clamp((b[3]-b[0])*.05,40,500);if(!turrets){put('fits',meshFits(model,null,ranges));put('refFits',meshReferenceFits(model,ranges));}else{put('trialTarget',trialTargetMesh(targetRadius),'fits',.6);for(const t of turrets){const owner=owners.get(t.id);if(owner!=null)t.foilId=foils[owner].id;}}
 for(const hatch of model.hatches){const spec=C.slidingHatchSpec(model,hatch);if(!spec)continue;
  if(hatch.k==='ray'){const name='slideRay_'+hatch.id;put(name,meshHatches({...model,hatches:[{...hatch,_rayOnly:true,_rayInset:5}]}).ray,'ray',1);rays.push({name});}
  if(hatch.skinAsset){for(const side of [-1,1]){const name='refSlideDoor_'+hatch.id+'_'+(side<0?'l':'r');put(name,meshReferenceHatches({...model,_referenceDoorOnly:true,hatches:[{...hatch,open:0,_doorDetached:false,_slideSide:side}]}),'reference',0);doors.push({name,axis:spec.slideAxis,side,travel:spec.travel});}}
  else for(const panel of C.slidingHatchPanels(model,hatch)){const name='slideDoor_'+hatch.id+'_'+(panel.side<0?'l':'r');put(name,meshSlidingHatchPanel(model,hatch,panel),null,0);doors.push({name,axis:panel.axis,side:panel.side,travel:panel.travel});}
 }
 for(const launcher of launchers||[]){const owner=owners.get(launcher.id);if(owner!=null)launcher.foilId=foils[owner].id;}
 const eyes=opts?.trial?trialEyes(ship,b,meshes):null;splitFoilGeometry(meshes,ranges,foils,owners);
 const glowOwners=new Int32Array(parts.glow.length);for(const [id,[start,count]] of Object.entries(parts.glowRanges||{})){const owner=owners.get(Number(id));if(owner!=null)glowOwners.fill(owner+1,start,start+count);}
 const glow=[];for(let i=0;i<parts.glow.length;i+=4)(glowOwners[i]?foils[glowOwners[i]-1].glow:glow).push(...parts.glow.slice(i,i+4));
 return {meshes,doors,rays,foils,center,glow,bounds:b,paint:ship.paint,lights:ship.lights,engine:ship.engineGlow||null,reference:ship.reference,length:b[3]-b[0],turrets,surfaceTurrets,launchers,targetRadius,eyes};
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
 const bay=C.broadsideBatteryGeometry?.(f);if(bay)return {pivot:bay.pivot,axis:bay.v,fw:bay.normal};
 const embedded=C.surfaceBatteryGeometry?.(f);if(embedded)return {pivot:embedded.pivot,axis:embedded.v,fw:embedded.normal};
 if(d.asset&&f.skinAsset&&f.skinAsset!==d.asset){const k=skinTurretPose(f);if(k)return k;return null;}
 if(d.fixed)return {pivot:C.fitOrigin(f),axis:C.fitUp(f),fw:fr.fw};
 if(d.casemate)return {pivot:C.fitOrigin(f),axis:[0,1,0],fw:C.AXES[f.a]};
 if(d.asset){const y=(f.assetYaw||0)*Math.PI/180;return {pivot:C.fitOrigin(f),axis:fr.up,fw:C.norm(C.add(C.mul(fr.fw,Math.cos(y)),C.mul(fr.rt,Math.sin(y))))};}
 return {pivot:C.fitOrigin(f),axis:fr.up,fw:fr.fw};
}
const TRIAL_BARRELS={pd:2,ltl:4,mtl:3,htl:2,stl:2,utl:2,ion:2,ionL:2};
function trialTurrets(model,put,ranges){
 const list=surfaceRenderFits(model).filter(trialTurretFit),turning=new Set(list.filter(f=>!noModelFit(f)&&!embeddedSurfaceFit(f)&&!C.FITS[f.k].casemate&&!C.FITS[f.k].fixed).map(f=>f.id)),out=[];
 FIT_SKIP_BODY=turning;try{put('fits',meshFits(model,null,ranges));}finally{FIT_SKIP_BODY=null;}
 put('refFits',meshReferenceFits(model,ranges,surfaceRenderFits(model).filter(f=>!turning.has(f.id))));
 const all=new Set(surfaceRenderFits(model).map(f=>f.id)),poses=new Map(),bulk=new Map(list.some(noModelFit)?(C.bulkTrenchGroups?.(model)||[]).map(row=>[row.id,row]):[]);
 for(const f of list){if(noModelFit(f))continue;const p=turretPose(f);if(p)poses.set(f.id,p);}
 for(const f of list)if(!noModelFit(f)&&!poses.has(f.id))poses.set(f.id,mirroredTurretPose(f,list,poses)||(()=>{const fr=C.fitFrameOf(f);return {pivot:C.fitOrigin(f),axis:fr.up,fw:fr.fw};})());
 for(const f of list){
  if(noModelFit(f)){
   const row=bulk.get(f.id),muzzles=(row?.muzzles||[]).slice(0,8).map(p=>Array.isArray(p)?p:p.p||p.point).filter(p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)).map(p=>p.slice());if(row?.valid===false||!muzzles.length)continue;
   const d=C.fitSpec(f),spec=C.FITS[f.k],fr=C.fitFrameOf(f),volleyTT=Math.max(0,d.tt||0)+Math.max(0,d.ion||0);
   // One logical firing descriptor represents the group. Bounded muzzle
   // effects do not expand its counted barrels into thousands of models.
   out.push({id:f.id,k:f.k,name:spec.short||spec.name,trenchAggregate:true,noModel:true,aggregateCount:row.count??f.aggregateCount,aggregateBarrels:d.barrels||1,volleyTT,mesh:null,broadsideBattery:true,muzzles,rowSpan:row.rowSpan,pivot:muzzles[0].slice(),axis:fr.up,fw:fr.fw,origin:muzzles[0].slice(),mount:fr.up,r:d.r,hm:0,embedded:true,fixed:true,casemate:true,barrels:muzzles.length,cycle:d.cycle||2.5,tt:volleyTT,ion:!!d.ion&&!d.tt,rate:C.turretRate(f),power:d.power||0,cap:C.needsCapacitor(f)});continue;
  }
  const d=C.fitSpec(f),spec=C.FITS[f.k],pose=poses.get(f.id),axis=C.norm(pose.axis),fw=C.norm(C.sub(pose.fw,C.mul(axis,C.dot(pose.fw,axis)))),rot=turning.has(f.id);
  let mesh=null,bodyMesh=null,authored=null;const g=C.authoredTurretGeometry?.(f);if(rot){if(sharedProceduralTurret(f)||spec.asset&&(!plainFitAsset(f)||g)){const plain=plainFitAsset(f)&&!familyReferenceAsset(f),geo=plain?new Geo(16):meshReferenceFits(model,null,[f]),tex=plain?'fits':'reference',emi=plain?.6:null;if(plain)appendPlainFit(geo,f);mesh=(plain?'tur_':'refTur_')+f.id;const split=Number.isInteger(geo.drawElevationIndexStart)?geo.drawElevationIndexStart:g?.indexStart;
   if(Number.isInteger(split)&&split>=0&&split<geo.ni&&split%3===0){authored=g;bodyMesh=(plain?'turBody_':'refTurBody_')+f.id;put(bodyMesh,geoIndices(geo,geo.idx.subarray(0,split)),tex,emi);put(mesh,geoIndices(geo,geo.idx.subarray(split,geo.ni)),tex,emi);}else put(mesh,geo,tex,emi);
  }else{mesh='tur_'+f.id;FIT_SKIP_PED=all;try{put(mesh,meshFits(model,x=>x===f),'fits',.6);}finally{FIT_SKIP_PED=null;}}}
  const embedded=C.surfaceBatteryGeometry?.(f),bay=C.broadsideBatteryGeometry?.(f);out.push({id:f.id,k:f.k,name:spec.short||spec.name,mesh,...(authored?{authored,bodyMesh,bodyPivot:authored.yawPivot}:{}),...(bay?{broadsideBattery:true,muzzles:bay.muzzles.map(p=>p.slice())}:{}),pivot:authored?.elevationPivot||pose.pivot,axis:authored?.axis||axis,fw:authored?.fw||fw,origin:authored?.elevationPivot||C.turretOrigin(f),mount:C.fitUp(f),r:d.r,hm:embedded?embedded.height:d.hm,embedded:!!embedded,fixed:!!spec.fixed,portWidth:bay?.width??embedded?.width,portHeight:bay?.height??embedded?.height,port:bay?{width:bay.width,height:bay.height,depth:bay.depth}:embedded?{width:embedded.width,height:embedded.height,depth:embedded.depth}:undefined,casemate:bay?true:embedded?false:!!(spec.casemate||spec.fixed),barrels:d.barrels||(spec.fixed?1:TRIAL_BARRELS[f.k]||2),cycle:d.cycle||2.5,tt:d.tt||0,ion:!!d.ion&&!d.tt,rate:C.turretRate(f),power:d.power||0,cap:C.needsCapacitor(f)});
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
 const L=Math.max(.01,b[3]-b[0]),seat=ship.parts.filter(p=>p.k==='cockpit').sort((p,q)=>q.c[0]-p.c[0])[0],HULL=['hull','refHull'],SHELL=[...HULL,'struct','refStruct','plate'],z=(b[2]+b[5])/2,craft=C.isCraft(ship),near=C.clamp(L*.004,.1,6);
 let cockpit=null,bridge=null,top=null;
 // A canopy standing proud of the hull puts the eye on top of it (clear of the hull and the canopy's own
 // frame); a cockpit sunk in the hull (a TIE's ball) looks out through it, the hull's inside being unseen.
 if(seat){const r=C.clamp((seat.d||1.6)/2,.2,4),[sx,sy,sz]=seat.c,hull=meshTopsAt(meshes,HULL,[sx],sz)[0];let y=sy+r*.3;
  if(sy+r>hull)y=Math.max(y,Math.min(Math.max(hull,meshTopsAt(meshes,SHELL,[sx],sz)[0]),sy+r*2.5)+Math.max(.05,r*.1));
  cockpit={pos:[sx+r*.15,y,sz],near:C.clamp(r*.4,.1,1),kind:'cockpit'};}
 try{const pods=[...surfaceRenderFits(ship).filter(f=>C.FITS[f.k]?.pod&&!f.float),...C.intrinsicCommandFits(ship)].filter(f=>C.FITS[f.k]?.role==='bridge').sort((f,g)=>g.p[1]-f.p[1]||g.p[0]-f.p[0]);
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
 try{for(const [name,m] of Object.entries(data.meshes)){if(m.tex)MESH_TEX[name]=m.tex;if(m.emi!=null)MESH_EMI[name]=m.emi;if(m.source)MESH_SOURCE[name]=m.source;if(m.geo)this.upload(name,m.geo);}
  const asset={meshes,doors:data.doors,rays:data.rays,foils:data.foils||[],turrets:data.turrets||[],surfaceTurrets:!!data.surfaceTurrets,center:data.center,glow:data.glow||[],bounds:data.bounds,paint:data.paint,lights:data.lights,engine:data.engine||null,reference:data.reference,length:data.length};this.fleetCache.set(key,asset);return asset;}
 catch(e){for(const m of Object.values(meshes))for(const k of ['pos','nor','uv','col','idx'])this.gl.deleteBuffer(m[k]);throw e;}finally{this.meshes=old;}
};
Renderer.prototype.pruneFleet=function(keys){if(!this.fleetCache)return;for(const [k,a] of this.fleetCache)if(!keys.has(k)){for(const m of Object.values(a.meshes))for(const n of ['pos','nor','uv','col','idx'])this.gl.deleteBuffer(m[n]);this.fleetCache.delete(k);}};
Renderer.prototype.drawFleet=function(m,opt){
 const gl=this.gl,old=this.meshes,off=this.off,shields=[];gl.disable(gl.BLEND);gl.depthMask(true);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);this.clip=null;
 // Distant ships draw only their outer shell, and specks or ships behind the eye are skipped.
 const eye=this.eye(),vd=(()=>{const t=this.cam.target||[0,0,0],d=[t[0]-eye[0],t[1]-eye[1],t[2]-eye[2]],l=Math.hypot(...d)||1;return [d[0]/l,d[1]/l,d[2]/l];})(),focal=this.canvas.height/(2*Math.tan((this.cam.fov||.72)/2)),SHELL=['hull','struct','plate','surfaceArmor','refHull','refStruct'],FULL=['hull','struct','plate','surfaceArmor','surfaceDevices','surfaceDetail','refHull','refStruct','refHatches','gen','shield','hyper','engine','refEngine','nozzle','hangar'],OUTER=FULL.filter(n=>!['gen','shield','hyper','hangar'].includes(n));this.lodSkipped=0;
 // v20.2 Key-light shadows for the ships largest on screen (not pieces of wrecks or ships in a jump).
 let shadows=null;if(this.look?.shadow&&!this.noShadow){const c=[];for(const u of opt.fleet){if(u.dead||u.hidden||u.clip||Math.abs((u.stretch||1)-1)>.02)continue;const a=this.fleetCache?.get(u.key);if(!a?.bounds||fleetFoilMoving(a,u))continue;const L=a.length||300,rx=u.pos[0]-eye[0],ry=u.pos[1]-eye[1],rz=u.pos[2]-eye[2],px=L/Math.max(1,Math.hypot(rx,ry,rz))*focal;if(px>=140&&rx*vd[0]+ry*vd[1]+rz*vd[2]>=-L)c.push({u,a,px});}if(c.length)shadows=this.shadowFleet(c);}
 try{for(const u of opt.fleet){if(u.dead||u.hidden)continue;const a=this.fleetCache?.get(u.key);if(!a)continue;this.shTile=shadows?.get(u)||null;
  const L=(a.length||300)*(u.stretch||1),rx=u.pos[0]-eye[0],ry=u.pos[1]-eye[1],rz=u.pos[2]-eye[2],dist=Math.hypot(rx,ry,rz),px=L/Math.max(1,dist)*focal,ahead=rx*vd[0]+ry*vd[1]+rz*vd[2];
  if(opt.lod&&(px<2.2||ahead<-L)){this.lodSkipped++;continue;}const lod=opt.lod&&px<44&&(!u.turrets||a.surfaceTurrets);
  this.meshes=a.meshes;this.off=u.pos;this.modelCenter=u.center||a.center;this.modelYaw=u.yaw||0;this.modelRot=u.rot||null;this.paint=a.paint||'neutral';
  this.engineTint=a.engine&&a.engine!=='blue'?C.engineGlowRGB(a.engine):null;this.engineK=u.wreck?0:.3+.95*C.clamp(u.glow??.6,0,1);
  // A piece of a broken ship: the part of the model inside its box, turned about its own centre, scorched, its torn edges glowing.
  this.clip=u.clip?u.clip.hi:null;this.clipLo=u.clip?u.clip.lo:null;this.seam=u.seam||null;this.char=u.char||0;if(u.clip)gl.disable(gl.CULL_FACE);this.setLights(a.lights);this.sourceRed=a.reference==='venator';this.hullLength=a.length;const R=u.rot||yawMatrix(this.modelYaw),rv=v=>[R[0]*v[0]+R[3]*v[1]+R[6]*v[2],R[1]*v[0]+R[4]*v[1]+R[7]*v[2],R[2]*v[0]+R[5]*v[1]+R[8]*v[2]];
  // A ship dropping out of (or into) hyperspace is drawn stretched along its
  // own length with the bow held in place, and washed toward blue-white.
  const sx=u.stretch||1;this.unitScl=sx!==1?[sx,1,1]:null;this.unitFlash=u.flash||0;if(sx!==1&&a.bounds)this.modelCenter=[a.center[0]+a.bounds[3]*(sx-1),a.center[1],a.center[2]];const center=this.modelCenter;
  // From its own cockpit a ship hides the compartments inside its hull (u.noInner).
  for(const n of lod?SHELL:u.noInner?OUTER:FULL)this.drawMesh(n,m,1);
  // Each moving group is uploaded once in the deployed frame. Its hinge transform
  // rotates its surface normals with its vertices and is independent for every ship.
  for(const foil of a.foils||[]){const pose=fleetFoilPose(a,u,foil,center),scale=this.unitScl;this.off=pose.off;this.modelCenter=pose.center;this.modelRot=pose.rot;this.unitScl=null;
   for(const name of foil.meshes){const source=foil.kinds?.[name]||MESH_SOURCE[name]||name;if((lod?SHELL:u.noInner?OUTER:FULL).includes(source))this.drawMesh(name,m,1);}
   if(!lod){gl.disable(gl.CULL_FACE);for(const name of foil.meshes)if(['fits','refFits'].includes(foil.kinds?.[name]||MESH_SOURCE[name]))this.drawMesh(name,m,1);gl.enable(gl.CULL_FACE);}
   this.off=u.pos;this.modelCenter=center;this.modelRot=u.rot||null;this.unitScl=scale;
  }
  if(lod||u.wreck){if(u.wreck&&!lod){gl.disable(gl.CULL_FACE);this.drawMesh('fits',m,1);this.drawMesh('refFits',m,1);}this.unitScl=null;this.unitFlash=0;this.clip=this.clipLo=this.seam=null;this.char=0;gl.enable(gl.CULL_FACE);continue;}
  const open=opt.mode==='review'?0:C.clamp(u.hatchOpen??0,0,1);for(const door of a.doors||[]){const delta=[0,0,0];delta[door.axis]=door.side*door.travel*open;const q=rv(delta);this.off=[u.pos[0]+q[0],u.pos[1]+q[1],u.pos[2]+q[2]];this.drawMesh(door.name,m,1,0);}this.off=u.pos;
  gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(-1,-2);this.drawMesh('hatchOpen',m,1);gl.disable(gl.POLYGON_OFFSET_FILL);shields.push({u,a,names:['hatchRay',...(open>0?(a.rays||[]).map(r=>r.name):[])]});gl.disable(gl.CULL_FACE);this.drawMesh('fits',m,1);this.drawMesh('refFits',m,1);
  if(!lod&&sx<1.02){for(const t of fleetTurretList(a,u)){const q=rv([t.pivot[0]-a.center[0],t.pivot[1]-a.center[1],t.pivot[2]-a.center[2]]);this.off=[u.pos[0]+q[0],u.pos[1]+q[1],u.pos[2]+q[2]];this.modelCenter=t.restPivot||(a.turrets||[]).find(rest=>rest.mesh===t.mesh)?.pivot||t.pivot;this.modelRot=mat3Mul(R,t.rot);this.drawMesh(t.mesh,m,1);}this.off=u.pos;this.modelCenter=center;this.modelRot=u.rot||null;}
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
  const R=u.rot||yawMatrix(u.yaw||0),t=C.clamp(u.glow??.6,0,1),rgb=C.engineGlowRGB(a.engine),al=Math.min(255,70+170*t),sk=.6+4.4*t*t,pl=t>.25?(t-.25)/.75:0;
  for(const group of [{glow:a.glow},...(a.foils||[]).map(f=>({glow:f.glow,T:foilTransform(f,u.foils?.[f.id])}))]){const aft=mat3Point(R,group.T?group.T.direction([-1,0,0]):[-1,0,0]);for(let i=0;i<(group.glow||[]).length;i+=4){const p=group.glow.slice(i,i+3),q=group.T?group.T.point(p):p,x=q[0]-a.center[0],y=q[1]-a.center[1],z=q[2]-a.center[2],px=u.pos[0]+R[0]*x+R[3]*y+R[6]*z,py=u.pos[1]+R[1]*x+R[4]*y+R[7]*z,pz=u.pos[2]+R[2]*x+R[5]*y+R[8]*z,sz=group.glow[i+3];
   gp.push(px,py,pz);gc.push(rgb[0],rgb[1],rgb[2],al);gs.push(sz*sk);
   if(pl>0)for(let j=1;j<=4;j++){const d=sz*j*(.8+2.4*pl);gp.push(px+aft[0]*d,py+aft[1]*d,pz+aft[2]*d);gc.push(rgb[0],rgb[1],rgb[2],Math.round(235*pl*(1-.18*j)));gs.push(sz*sk*(1-.17*j));}}}}
 this.setPoints('fleetGlow',new Float32Array(gp),new Uint8Array(gc),new Float32Array(gs));gl.blendFunc(gl.ONE,gl.ONE);this.drawPoints('fleetGlow',m,[0,0,0],1,2,false);if(opt.planet||opt.hyper||opt.sky){if(!opt.hyper&&!opt.noDust)this.drawPoints('trialDust',m,[0,0,0],1,1,false);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);this.drawLines('trialBeams',m,1);gl.blendFunc(gl.ONE,gl.ONE);this.drawPoints('trialFx',m,[0,0,0],1,2,false);this.drawPoints('trialBolts',m,[0,0,0],1,2,false);if(!opt.hyper)this.drawPoints('trialCraft',m,[0,0,0],1,2,false);}
 gl.depthMask(true);
};

function meshSolidCutter(c){
  const mesh=new Geo(64),ls=lineSet();
  if(!c)return {mesh,lines:ls.out()};
  const T=C.solidCutDisplayTriangles?C.solidCutDisplayTriangles(c):C.solidCutTriangles(c),edges=new Map(),color=[246,137,97];
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
  this.kind='compat';this.disposed=false;this.meshes={};this.lines={};this.points={};this.fleetCache=new Map();
  this.off=[0,0,0];this.cam={th:.85,ph:1.05,r:1500,target:[0,0,0],fov:.72};this.frames=0;
 }
 upload(name,g){this.meshes[name]={geo:g,count:g.previewActiveIndices===0?0:g.ni};}
 setLines(name,data){this.lines[name]=data;}
 setPoints(name,pos,col,size){this.points[name]={pos,col,size};}
 setGlow(list,rgb){const c=rgb||[110,185,255],pos=[],col=[],size=[];for(let i=0;i<list.length;i+=4){pos.push(...list.slice(i,i+3));col.push(c[0],c[1],c[2],150);size.push(list[i+3]);}this.setPoints('glow',pos,col,size);}
 captureSize(scale=2){return captureDimensions(this.canvas.clientWidth,this.canvas.clientHeight,scale,typeof window!=='undefined'?window.devicePixelRatio:1,{maxPixels:4000000});}
 capture(scale=2){return rendererCapture(this,scale);}
 resize(){if(this._captureSize){const {width,height}=this._captureSize;if(this.canvas.width!==width)this.canvas.width=width;if(this.canvas.height!==height)this.canvas.height=height;return;}const w=Math.max(1,Math.round(this.canvas.clientWidth)),h=Math.max(1,Math.round(this.canvas.clientHeight)),scale=Math.min(1,Math.sqrt(420000/(w*h)));const rw=Math.max(1,Math.round(w*scale)),rh=Math.max(1,Math.round(h*scale));if(this.canvas.width!==rw||this.canvas.height!==rh){this.canvas.width=rw;this.canvas.height=rh;}}
 eye(){return Renderer.prototype.eye.call(this);}
 matrices(){return Renderer.prototype.matrices.call(this);}
 ray(x,y){return Renderer.prototype.ray.call(this,x,y);}
 project(p){return Renderer.prototype.project.call(this,p);}
 pickSurface(x,y,ship=this.surfaceShip){return Renderer.prototype.pickSurface.call(this,x,y,ship);}
 pickStructureSurface(x,y,ship,parentStructureId,options={}){return Renderer.prototype.pickStructureSurface.call(this,x,y,ship,parentStructureId,options);}
 pickPlacementSurface(x,y,ship,options={}){return Renderer.prototype.pickPlacementSurface.call(this,x,y,ship,options);}
 setPlacementDiagnostics(ship,diagnostics){return Renderer.prototype.setPlacementDiagnostics.call(this,ship,diagnostics);}
 setSurfaceSelection(ship,ids=[]){return Renderer.prototype.setSurfaceSelection.call(this,ship,ids);}
 dispose(){this.disposed=true;this.meshes={};this.lines={};this.points={};this.fleetCache.clear();}
 prepareFleet(key,ship){
  if(this.fleetCache.has(key))return this.fleetCache.get(key);
  const model=C.deserialize(C.serialize(ship));C.syncCompartments(model);
  return this.loadFleet(key,fleetGeometry(model));
 }
 loadFleet(key,data){
  if(this.fleetCache.has(key))return this.fleetCache.get(key);
  const meshes={},extra=[];
  for(const [name,m] of Object.entries(data.meshes)){if(!m.geo)continue;const item={geo:m.geo,count:m.geo.ni};if(name.startsWith('slideDoor')||name.startsWith('refSlideDoor'))extra.push({name,...item});else meshes[name]=item;}
  const asset={meshes,extra,foils:data.foils||[],turrets:data.turrets||[],surfaceTurrets:!!data.surfaceTurrets,center:data.center,bounds:data.bounds,length:data.length,glow:data.glow||[],lights:data.lights};this.fleetCache.set(key,asset);return asset;
 }
 pruneFleet(keys){for(const key of this.fleetCache.keys())if(!keys.has(key))this.fleetCache.delete(key);}
 draw(opt={}){
  if(this.disposed)return false;this.resize();const w=this.canvas.width,h=this.canvas.height,ctx=this.ctx,m=this.matrices();
  if(this._surfaceSelection!==this.surfaceSelection)this.setSurfaceSelection(this.surfaceShip,this.surfaceSelection||[]);
  const image=ctx.createImageData(w,h),pixels=image.data,depth=new Float32Array(w*h);depth.fill(Infinity);
  for(let y=0;y<h;y++){const t=y/h;for(let x=0;x<w;x++){const k=(y*w+x)*4;pixels[k]=Math.round(10-4*t);pixels[k+1]=Math.round(17-5*t);pixels[k+2]=Math.round(25-7*t);pixels[k+3]=255;}}
  this._frame={w,h,m,pixels,depth};this.portColor=opt.lights==='off'?null:SHIP_LIGHTS[opt.lights]||SHIP_LIGHTS.white;
  const external=['hull','struct','plate','surfaceArmor','surfaceDevices','surfaceDetail','refHull','refStruct','refHatches','gen','shield','hyper','engine','refEngine','nozzle','hangar','fits','refFits','hatchOpen','hatchRay','preview','previewRef','previewFits','previewRefFits'];
  const inside=['plant','refPlant','interior'];
  if(opt.fleet){const eye=this.eye(),focal=h/(2*Math.tan((this.cam.fov||.72)/2)),shell=new Set(['hull','struct','plate','surfaceArmor','refHull','refStruct']);this.lodSkipped=0;for(const unit of opt.fleet){
   if(unit.dead||unit.hidden)continue;const a=this.fleetCache.get(unit.key);if(!a)continue;this.portColor=a.lights==='off'?null:SHIP_LIGHTS[a.lights]||SHIP_LIGHTS.white;
   const px=(a.length||a.bounds?.[3]-a.bounds?.[0]||300)*focal/Math.max(1,C.len(C.sub(unit.pos,eye)));if(opt.lod&&px<2.2){this.lodSkipped++;continue;}const lod=opt.lod&&px<44&&(!unit.turrets||a.surfaceTurrets),names=lod?external.filter(n=>shell.has(n)):external;
   const R=unit.rot||yawMatrix(unit.yaw||0),sx=unit.stretch||1,center=sx!==1&&a.bounds?[a.center[0]+a.bounds[3]*(sx-1),a.center[1],a.center[2]]:unit.center||a.center;
   const base={off:unit.pos,center:[center[0]/sx,center[1],center[2]],rot:mat3Mul(R,[sx,0,0,0,1,0,0,0,1])};
   for(const name of names)this.rasterMesh(a.meshes[name]?.geo,name,name==='hatchRay'?.5:1,null,base);
   if(!lod)for(const e of a.extra||[])this.rasterMesh(e.geo,e.name.startsWith('ref')?'refFits':'hull',1,null,base);
   for(const foil of a.foils||[]){const pose=fleetFoilPose(a,unit,foil,center);for(const name of foil.meshes){const source=foil.kinds?.[name]||name;if(names.includes(source))this.rasterMesh(a.meshes[name]?.geo,source,1,null,pose);}}
   if(!lod)for(const t of fleetTurretList(a,unit)){const v=C.sub(t.pivot,a.center),rest=t.restPivot||(a.turrets||[]).find(q=>q.mesh===t.mesh)?.pivot||t.pivot;
    this.rasterMesh(a.meshes[t.mesh]?.geo,t.mesh.startsWith('ref')?'refFits':'fits',1,null,{off:C.add(unit.pos,mat3Point(R,v)),center:rest,rot:mat3Mul(R,t.rot)});
   }
   for(const t of unit.targets||[])this.rasterMesh(a.meshes.trialTarget?.geo,'fits',1,null,{off:t.pos,center:[0,0,0],rot:t.rot||MAT3_I});
  }}
  else {
   const clip=opt.mode==='cut'?opt.clip:null,translucent=new Set(['hull','struct','plate','surfaceArmor','surfaceDevices','surfaceDetail','refHull','refStruct','refHatches','hatchOpen','hatchRay']);
   if(opt.mode==='xray'){
    for(const name of [...external.filter(n=>!translucent.has(n)),...inside])this.rasterMesh(this.meshes[name]?.geo,name,1,clip);
    for(const name of external.filter(n=>translucent.has(n)))this.rasterMesh(this.meshes[name]?.geo,name,.20,clip);
   }else for(const name of [...external,...(opt.mode==='cut'?inside:[])])this.rasterMesh(this.meshes[name]?.geo,name,name==='hatchRay'?.5:1,clip);
   this.rasterMesh(this.meshes.cutter?.geo,'cutter',.28,null);
   this.rasterMesh(this.meshes['placement-ghost']?.geo,'placement-ghost',.24,null);
  }
  ctx.putImageData(image,0,0);
  for(const name of opt.fleet?['fleetGrid','fleetOrders','fleetShots',...(opt.planet||opt.hyper||opt.sky?['trialBeams']:[])]:['grid',...(opt.mode==='cut'?['section']:[]),'ghost','placement-repeat','placement-diagnostics','cutter','verts','surfaces'])this.paintLines(name,name==='grid'||name==='fleetGrid'||name==='surfaces'||name==='trialBeams');
  delete this._frame;this.frames++;this._lastDrawOptions=opt;return true;
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
   const portFace=name==='surfaceDevices'&&g.col[ai+3]===253&&g.col[bi+3]===253&&g.col[ci+3]===253;if(portFace&&!this.portColor)continue;
   const port=portFace&&this.portColor,light=Math.max(.24,Math.min(1.15,.48+wx*.20+wy*.48+wz*.12)),color=[0,1,2].map(j=>Math.min(255,Math.max(0,(g.col[ai+j]+g.col[bi+j]+g.col[ci+j])/3*(port?Math.max(light,this.portColor[j]):light)*colScale)));
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

return {meshPreview, clearPreviewCache, publishPlacementDraftPreview, isHiddenEngineFeed, rayFit, turretRenderAsset, fleetGeometry, foilTransform, captureDimensions, Renderer, CompatRenderer, meshSolidCutter, meshReferenceHull, meshReferenceFits, meshReferenceHatches, meshReferenceParts, sectionLines, meshHull, meshParts, meshHatches, meshFits, gridLines, shipBounds, lineSet, M4, Geo, thinArmorLights, surfaceVisualPlan, meshSurfaceLayers, surfaceSelectionLines, structureSurfaceCandidates, placementSurfaceCandidates, placementDiagnosticLines, placementGhostMesh, placementFittingMesh};
})();

