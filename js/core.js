Object.assign(YardReferenceData.assets,YardImperial2Data.assets);


/* ============================================================
   core.js — smooth-hull warship model (v2).
   Hull = lofted parametric sections with razée bevels and box
   notches; compartments are solid parts (spheres, cubes,
   cylinders, boxes). Performance model follows the spirit of
   Fractalsponge's ship design notes. No DOM.
   ============================================================ */
const Core = (() => {
'use strict';
const TT = 4.184e21, G0 = 9.80665, ISD_W = 1.0e25;
// Shared editor / persistence limits, including 19 km dreadnoughts.
const DESIGN_LIMITS=Object.freeze({length:30000,width:10000,height:5000,coordinate:60000,partSize:30000,diameter:3000,engineDiameter:1600,engineLength:10000,parts:1400,fits:2400});
// One output density for every reactor, derived from the physical volume of
// the standard Imperial main reactor and its three auxiliary reactors.
const ISD_PLANT = Object.freeze({main:151, backup:48, auxiliary:36, auxiliaryCount:2});
const ISD_REACTOR_VOLUME = Math.PI/6*(ISD_PLANT.main**3+ISD_PLANT.backup**3+ISD_PLANT.auxiliaryCount*ISD_PLANT.auxiliary**3);
const REACTOR_POWER_DENSITY = ISD_W/ISD_REACTOR_VOLUME;
// Fixed yard-wide machinery constants, normalized once to the standard ISD
// example's physical plant on 2026-10-19. These never vary by saved design.
// Hyper volume is the usable, envelope-clipped solid; ship mass is in tonnes.
const ISD_HYPER_BASELINE = Object.freeze({volume:147977.64995718058,mass:39719119.36270908,class:2});
const HYPER_CLASS_COEFFICIENT = ISD_HYPER_BASELINE.class*ISD_HYPER_BASELINE.volume/ISD_HYPER_BASELINE.mass;
const HYPER_POWER_DENSITY = 1e18*.025/HYPER_CLASS_COEFFICIENT;
const ISD_SHIELD_VOLUME = Math.PI/6*(2*54**3+2*18**3);
const SHIELD_BUFFER_SECONDS = 20;
const SHIELD_ENERGY_DENSITY = ISD_W*10/ISD_SHIELD_VOLUME;
const SHIELD_POWER_DENSITY = SHIELD_ENERGY_DENSITY/SHIELD_BUFFER_SECONDS;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return Math.abs(l-1)<1e-12?a.slice():[a[0] / l, a[1] / l, a[2] / l]; };

// Public state is every field without a leading underscore; underscore fields
// are derived caches. The editor and the background engine exchange public
// state and patch it into their own objects in place, so keyed caches survive.
const PUBLIC_LISTS=new Set(['parts','fits','hatches','cuts','subs','trenches','solidCuts','airWings','groundForces']);
const publicReplacer=(k,v)=>k&&k[0]==='_'?undefined:v;
const publicJSON=v=>JSON.stringify(v,publicReplacer);
function patchItem(old,item){for(const k of Object.keys(old))if(k[0]!=='_')delete old[k];for(const k of Object.keys(item))if(k[0]!=='_')old[k]=item[k];return old;}
function patchShip(ship,src,only){
  if(!only)for(const k of Object.keys(ship))if(k[0]!=='_'&&!Object.hasOwn(src,k))delete ship[k];
  for(const k of only||Object.keys(src)){
    if(k[0]==='_'||!Object.hasOwn(src,k))continue;
    const next=src[k],prev=ship[k];
    if(PUBLIC_LISTS.has(k)&&Array.isArray(next)&&Array.isArray(prev)){
      const old=new Map();for(const it of prev)if(it&&typeof it==='object'&&it.id!=null)old.set(it.id,it);
      ship[k]=next.map(it=>{const o=it&&typeof it==='object'&&it.id!=null?old.get(it.id):null;if(!o)return it;if(publicJSON(o)!==publicJSON(it))patchItem(o,it);return o;});
    }else if(publicJSON(prev)!==publicJSON(next))ship[k]=next;
  }
  return ship;
}

const K = {
  hullDens: 0.20, structDens: 0.40,
  genW: REACTOR_POWER_DENSITY, engN: 1.7e8, engWperN: 2.0e9, shieldW: SHIELD_POWER_DENSITY, shieldStd: 4.0e17,
  hotelW: 1.0e14, rayW: 5.0e17, hyperW: HYPER_POWER_DENSITY, hyperK: HYPER_CLASS_COEFFICIENT,
  slotM3: 15000, launchOpen: 1.0e-4, launchRay: 6.0e-5,
  armorDens: 7.8, sigma: 2.5e10, framing: 0.003, crewM3: 60, hpPerT: 0.004,
  cycle: 2.5, deflect: 1.0, bufferS: SHIELD_BUFFER_SECONDS,
};

// ---------- parts (compartments) ----------
const PARTS = {
  gen: {name: 'ジェネレーター', shape: 'sphere', dens: 0.90, hp: 0.7, crew: 0.5, cost: 8, col: [238, 140, 62], min: 10, max: 400, def: 110, crit: true,
    desc: '球形の主反応炉。直径の3乗で出力が増える。一部を船外に張り出させると体積を稼げるが露出が弱点になる。'},
  shield: {name: 'シールド発生器', shape: 'sphere', dens: 0.50, hp: 0.7, crew: 0.4, cost: 6, col: [66, 204, 186], min: 6, max: 200, def: 34, crit: true,
    desc: '球形の偏向シールド投射機。半分出せばドームになる。必要な出力は外表面積に比例。'},
  hyper: {name: 'ハイパードライブ', shape: 'cyl', dens: 0.60, hp: 0.7, crew: 0.3, cost: 6, col: [162, 134, 232], min: 8, max: 220, def: 50, ratio: 1.5, crit: true,
    desc: '円筒形の超空間航行装置。外殻内に収まる実容積と艦の質量からクラスを計算する。クラスは小さいほど高速。'},
  engine: {name: 'エンジン', shape: 'engine', dens: 0.55, hp: 0.7, crew: 0.4, cost: 4, col: [92, 174, 236], min: 6, max: 220, def: 60, ratio: 1.6,
    desc: '円筒形の亜光速エンジン。後端の噴射口が船外に出ているものだけが推力を出す。'},
  hangar: {name: '航空区画', shape: 'cube', dens: 0.05, hp: 0.4, crew: 0.4, cost: 0.4, col: [74, 88, 99], sizes: [20, 30, 45, 60, 90, 120], def: 45,
    desc: '形状を編集できる格納区画。実際のハッチへつながる飛行甲板・格納庫を通って出入りする。'},
  struct: {name: '構造物', shape: 'box', dens: 0.40, hp: 1.5, crew: 0.05, cost: 1.0, col: [201, 205, 208],
    desc: '上部構造・船台。縦強度を担い、内部の区画を覆い隠す。'},
};
const ARMOR_MAX = {hull: 3, cit: 4};

// ---------- fittings (physical sizes in metres) ----------
const FITS = {
  pd:  {cat: 'w', name: '点防御レーザー砲', short: '点防御', fm: 9, wm: 9, hm: 6, tt: 0.5, aa: 6, mass: 250, crew: 3, cost: 20e3, desc: '戦闘機とミサイルを迎撃する。'},
  ltl: {cat: 'w', name: '軽ターボレーザー四連砲塔', short: '軽TL四連', fm: 14, wm: 14, hm: 7, tt: 24, aa: 1.5, mass: 900, crew: 6, cost: 80e3, desc: '4門×6TT。小型艦の主砲、大型艦の副砲。'},
  mtl: {cat: 'w', name: '中ターボレーザー三連砲塔', short: '中TL三連', fm: 18, wm: 18, hm: 9, tt: 75, aa: 0.5, mass: 2400, crew: 10, cost: 200e3, desc: '3門×25TT。'},
  htl: {cat: 'w', name: '重ターボレーザー連装砲塔', short: '重TL連装', fm: 22, wm: 22, hm: 13, tt: 140, mass: 6000, crew: 18, cost: 500e3, desc: '2門×70TT。砲塔本体は幅22m・高さ13m級。'},
  stl: {cat: 'w', name: '大型重ターボレーザー連装砲塔', short: '大型重TL', fm: 34, wm: 34, hm: 18, tt: 350, mass: 16000, crew: 30, cost: 1.2e6, desc: '2門×175TT。スター・デストロイヤー級の主砲。'},
  utl: {cat: 'w', name: '超重ターボレーザー連装砲塔', short: '超重TL', fm: 56, wm: 56, hm: 26, tt: 1440, mass: 52000, crew: 60, cost: 6e6, desc: '2門×720TT。弩級艦向け。'},
  ion: {cat: 'w', name: 'イオン砲（連装）', short: 'イオン砲', fm: 22, wm: 22, hm: 14, ion: 120, mass: 5500, crew: 18, cost: 600e3, desc: '対シールド120TT相当。船体への損害は小さい。'},
  msl: {cat: 'w', name: 'ミサイル発射管', short: 'ミサイル', fm: 12, wm: 12, hm: 3, msl: 80, pw: 1e21, mass: 600, crew: 8, cost: 150e3, desc: '20秒ごとに8発×10TT。半分はシールドを抜ける。射界の制約なし。'},
  trc: {cat: 'w', name: 'トラクター・ビーム投射機', short: '牽引', fm: 16, wm: 16, hm: 8, trac: 1, pw: 2e22, mass: 800, crew: 6, cost: 300e3, desc: '敵艦の機動を拘束する。'},
  brS: {cat: 'b', name: '小型艦橋', short: '小型', fm: 34, wm: 26, hm: 22, sensor: 0.6, pw: 1e21, mass: 4000, crew: 30, cost: 200e3, desc: '被弾しにくいが視界が狭い。'},
  brT: {cat: 'b', name: '塔型艦橋', short: '塔型', fm: 50, wm: 44, hm: 110, sensor: 1.0, pw: 3e21, mass: 45000, crew: 120, cost: 1.5e6, desc: '高さ110m級。視界が広いが標的になりやすい。'},
  brL: {cat: 'b', name: '大型司令塔', short: '大型', fm: 70, wm: 110, hm: 150, sensor: 1.25, pw: 6e21, mass: 110000, crew: 250, cost: 4e6, desc: '旗艦向けの指揮能力。'},
};
for (const k in FITS) { const d = FITS[k]; d.key = k; d.power = d.tt ? d.tt * TT / K.cycle : d.ion ? d.ion * TT / K.cycle : (d.pw || 0); d.r = Math.max(d.fm, d.wm) / 2; }
const AXES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const AXNAME = ['艦首方向', '艦尾方向', '上向き', '下向き', '右舷向き', '左舷向き'];

// ---------- hull presets (metres) ----------
const HULLS = {
  wedge: {name: '楔形', plan: 'wedge', sec: 'rect', L: 1100, W: 540, H: 180, bowW: 0.02, bowH: 0.5, stern: 1},
  arrow: {name: '鏃形', plan: 'arrow', sec: 'roof', L: 990, W: 500, H: 190, bowW: 0, bowH: 0.45, stern: 0.6},
  block: {name: '箱形', plan: 'rect', sec: 'rect', L: 380, W: 120, H: 90, bowW: 0.55, bowH: 0.75, stern: 1},
  cyl: {name: '円筒形', plan: 'cigar', sec: 'ellipse', L: 600, W: 170, H: 170, bowW: 0.2, bowH: 1, stern: 1},
  disc: {name: '円盤形', plan: 'ellipse', sec: 'diamond', L: 630, W: 630, H: 126, bowW: 1, bowH: 1, stern: 1},
  lance: {name: '槍形', plan: 'wedge', sec: 'diamond', L: 970, W: 230, H: 130, bowW: 0.15, bowH: 0.6, stern: 1},
};
const SECTIONS = {rect: '矩形', trap: '台形', roof: '屋根形', diamond: '菱形', ellipse: '楕円'};
// Hull-size classes. The ranges set the length control of a new or edited hull;
// they are a design aid, not a limit on what can be built.
// Ship classes by overall length. Neighbouring ranges overlap (900–1,200 m,
// 2,000–2,200 m): a design keeps the class it was given while its length stays
// inside that class, otherwise the larger class that fits is used.
const SHIP_CLASSES = Object.freeze([
  {id: 'corvette', name: 'コルベット', min: 60, max: 200, def: 150, note: 'CR90 150 m・レイダー級 150 m'},
  {id: 'frigate', name: 'フリゲート', min: 200, max: 400, def: 300, note: 'ネビュロンB 300 m'},
  {id: 'cruiser', name: 'クルーザー', min: 400, max: 600, def: 500, note: '軽巡洋艦の大きさ'},
  {id: 'heavyCruiser', name: '重クルーザー', min: 600, max: 1200, def: 800, note: 'ドレッドノート級重巡洋艦 600 m'},
  {id: 'destroyer', name: 'デストロイヤー', min: 900, max: 2200, def: 1600, note: 'ヴェネター級 1,137 m・インペリアル級 1,600 m'},
  {id: 'battlecruiser', name: 'バトルクルーザー', min: 2000, max: 5000, def: 3000, note: 'アリージャンス級 2,200 m'},
  {id: 'dreadnought', name: 'ドレッドノート', min: 5000, max: 30000, def: 8000, note: 'エグゼクター級 19,000 m'},
]);
function shipClassFor(L, prefer) {
  const keep = SHIP_CLASSES.find(c => c.id === prefer);
  if (keep && L >= keep.min && L <= keep.max) return keep;
  for (let i = SHIP_CLASSES.length - 1; i >= 0; i--) { const c = SHIP_CLASSES[i]; if (L >= c.min && L <= c.max) return c; }
  return L < SHIP_CLASSES[0].min ? SHIP_CLASSES[0] : SHIP_CLASSES[SHIP_CLASSES.length - 1];
}
const KEELS = {light: {name: '軽構造', w: 0.09, h: 0.22}, std: {name: '標準', w: 0.14, h: 0.32}, heavy: {name: '重構造', w: 0.20, h: 0.42}};

function planW(hp, t) {
  switch (hp.plan) {
    case 'arrow': { const tm = clamp(hp.maxAt ?? 0.3, 0.05, 0.9); return t < tm ? lerp(hp.stern, 1, t / tm) : lerp(1, hp.bowW, (t - tm) / (1 - tm)); }
    case 'rect': return t < 0.7 ? 1 : lerp(1, hp.bowW, (t - 0.7) / 0.3);
    case 'ellipse': { const u = 2 * t - 1; return Math.sqrt(Math.max(0, 1 - u * u)); }
    case 'cigar': {
      let w = t < 0.6 ? 1 : Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.6) / 0.4, 2)));
      if (t < 0.12) w *= lerp(0.82, 1, t / 0.12);
      return Math.max(w, t > 0.6 ? hp.bowW * (1 - (t - 0.6) / 0.4) : 0);
    }
    default: return lerp(1, hp.bowW, t);
  }
}
function planH(hp, t, pw) { return (hp.plan === 'cigar' || hp.plan === 'ellipse') ? Math.max(0.3, pw) : pw; }
// The final bow stations share the hull's width/thickness ratio. Intermediate
// stations remain editable for shoulders, carrier flight decks and stern wells.
function bowStation(h,i){return !h.assembly&&!!h.stations&&!h.bowFree&&i>=h.stations.length-2;}
function normalizeBow(h){
 if(h.assembly)return h;
 if(h.stations?.length){h.stations=h.stations.map((a,i)=>{const q=a.slice();if(bowStation(h,i))q[2]=q[1];return q;});h.bowW=h.stations.at(-1)[1];}
 // Unlinked bows keep their own thickness at the tip.
 h.bowH=h.bowFree&&h.stations?.length?h.stations.at(-1)[2]:h.bowW;return h;
}

// ---------- ship ----------
function newShip(hp, name) {
  return {v: 2, name: name || '新設計艦', hull: normalizeBow(Object.assign({}, HULLS.wedge, hp || {})), keel: (hp && hp.keel) || 'std',
    hullLocked:false,autoHabitation:true,cuts: [], trenches: [], solidCuts: [], subs: [], parts: [], hatches: [], fits: [], airWings: [], groundForces: [], armor: {hull: 0.5, cit: 0}, nextId: 1, _cache: null};
}
const nid = (ship) => ship.nextId++;

// section base polygon in (z, y); y = 0 at keel
function v3SectionBase(hp, x) {
  const t = clamp(x / hp.L, 0, 1), pw = planW(hp, t), ph = planH(hp, t, pw);
  const hw = Math.max(0, hp.W / 2 * pw), h = Math.max(0, hp.H * ph);
  let poly = null, ell = null, yc;
  switch (hp.sec) {
    case 'trap': poly = [[-hw, 0], [hw, 0], [hw * 0.6, h], [-hw * 0.6, h]]; yc = h * 0.45; break;
    case 'roof': poly = [[-hw, 0], [hw, 0], [hw, h * 0.55], [0, h], [-hw, h * 0.55]]; yc = h * 0.42; break;
    case 'diamond': { const c = hp.H / 2, hh = h / 2; poly = [[0, c - hh], [hw, c], [0, c + hh], [-hw, c]]; yc = c; break; }
    case 'ellipse': ell = {a: hw, b: h / 2}; yc = hp.H / 2; break;
    default: poly = [[-hw, 0], [hw, 0], [hw, h], [-hw, h]]; yc = h / 2;
  }
  let ytop, ybot;
  if (ell) { ytop = yc + h / 2; ybot = yc - h / 2; }
  else { ytop = -1e9; ybot = 1e9; for (const p of poly) { if (p[1] > ytop) ytop = p[1]; if (p[1] < ybot) ybot = p[1]; } }
  return {t, pw, ph, hw, h, yc, poly, ell, ytop, ybot, E: hw};
}
// cutters (half-planes and rectangles) active at station x
function removersAt(ship, x, sb) {
  const out = [], hp = ship.hull;
  for (const c of ship.cuts) {
    if (x < c.from * hp.L - 1e-6 || x > c.to * hp.L + 1e-6) continue;
    if(c.type==='planTrapezoid'){const edge=planCutEdge(ship,c,x);if(edge!=null)for(const sg of c.side==='both'?[1,-1]:[c.side==='port'?-1:1])out.push({hp:true,A:[sg*edge,0],n:[sg,0]});continue;}
    const d = Math.max(0, c.prop ? c.inset * sb.pw : c.inset), sl = Math.max(0.01, c.prop ? c.slope * sb.ph : c.slope);
    if (d <= 0.01) continue;
    const sides = c.side === 'both' ? [1, -1] : c.side === 'port' ? [-1] : [1];
    const edges = c.edge === 'both' ? ['top', 'bottom'] : [c.edge];
    for (const s of sides) for (const e of edges) {
      const yk = e === 'top' ? sb.ytop : sb.ybot, ys = e === 'top' ? -1 : 1;
      const A = [s * (sb.E - d), yk], B = [s * sb.E, yk + ys * sl], Kp = [s * sb.E, yk];
      let n = [-(B[1] - A[1]), B[0] - A[0]];
      if ((Kp[0] - A[0]) * n[0] + (Kp[1] - A[1]) * n[1] < 0) n = [-n[0], -n[1]];
      const l = Math.hypot(n[0], n[1]) || 1;
      out.push({hp: true, A, n: [n[0] / l, n[1] / l]});
    }
  }
  // Carved trenches (the reference examples' envelopes) keep following plan cuts.
  for (const c of ship.trenches || []) {
    if(c.mode==='split')continue;
    if(x<c.from*hp.L || x>c.to*hp.L)continue;
    const yc=sb.ybot+(sb.ytop-sb.ybot)*c.level, ht=Math.min(c.height,(sb.ytop-sb.ybot)*.8);
    for(const sg of c.side==='both'?[1,-1]:[c.side==='port'?-1:1]){let z=sb.hw;for(const cut of ship.cuts)if(cut.type==='planTrapezoid'&&(cut.side==='both'||(cut.side==='port'?-1:1)===sg)){const edge=planCutEdge(ship,cut,x);if(edge!=null)z=Math.min(z,edge);}const dep=Math.min(z*.8,c.depth*(c.taper?sb.pw:1));out.push({rect:true,trench:true,z0:sg>0?z-dep:-z-100,z1:sg>0?z+100:-z+dep,y0:yc-ht/2,y1:yc+ht/2});}
  }
  for (const s of ship.subs) if (x >= s.b[0] && x <= s.b[3]) out.push({rect: true, z0: s.b[2], z1: s.b[5], y0: s.b[1], y1: s.b[4]});
  return out;
}
function rayPoly(poly, oz, oy, dz, dy) {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const P = poly[i], Q = poly[(i + 1) % poly.length];
    const ez = Q[0] - P[0], ey = Q[1] - P[1];
    const den = dz * ey - dy * ez; if (Math.abs(den) < 1e-12) continue;
    const t = ((P[0] - oz) * ey - (P[1] - oy) * ez) / den, s = ((P[0] - oz) * dy - (P[1] - oy) * dz) / den;
    if (t >= 0 && s >= -1e-9 && s <= 1 + 1e-9 && t < best) best = t;
  }
  return best === Infinity ? 0 : best;
}
function clampRem(rm, oz, oy, dz, dy, r) {
  if (rm.hp) {
    const f0 = (oz - rm.A[0]) * rm.n[0] + (oy - rm.A[1]) * rm.n[1];
    if (f0 >= 0) return 0;
    const dn = dz * rm.n[0] + dy * rm.n[1];
    if (dn > 1e-12) { const t = -f0 / dn; if (t < r) r = t; }
    return r;
  }
  if (oz >= rm.z0 && oz <= rm.z1 && oy >= rm.y0 && oy <= rm.y1) return 0;
  let t0 = 0, t1 = r;
  for (const [o, d, lo, hi] of [[oz, dz, rm.z0, rm.z1], [oy, dy, rm.y0, rm.y1]]) {
    if (Math.abs(d) < 1e-12) { if (o < lo || o > hi) return r; continue; }
    let a = (lo - o) / d, b = (hi - o) / d; if (a > b) { const s = a; a = b; b = s; }
    if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 > t1) return r;
  }
  return t0 < r ? t0 : r;
}
function removedBy(rm, z, y) {
  if (rm.hp) return (z - rm.A[0]) * rm.n[0] + (y - rm.A[1]) * rm.n[1] > 1e-9;
  return z > rm.z0 && z < rm.z1 && y > rm.y0 && y < rm.y1;
}
function segEnter(rm, az, ay, bz, by) {   // first point on segment a->b where it enters the remover
  if (rm.hp) {
    const fa = (az - rm.A[0]) * rm.n[0] + (ay - rm.A[1]) * rm.n[1], fb = (bz - rm.A[0]) * rm.n[0] + (by - rm.A[1]) * rm.n[1];
    const s = fa === fb ? 1 : clamp(fa / (fa - fb), 0, 1); return [az + (bz - az) * s, ay + (by - ay) * s];
  }
  const dz = bz - az, dy = by - ay; let t0 = 0, t1 = 1;
  for (const [o, d, lo, hi] of [[az, dz, rm.z0, rm.z1], [ay, dy, rm.y0, rm.y1]]) {
    if (Math.abs(d) < 1e-12) continue;
    let a = (lo - o) / d, b = (hi - o) / d; if (a > b) { const s = a; a = b; b = s; }
    if (a > t0) t0 = a; if (b < t1) t1 = b;
  }
  return [az + dz * t0, ay + dy * t0];
}
// cached station lookup for point queries
function secAt(ship, x) {
  const c = cache(ship), key = Math.round(x / ship.hull.L * 4000);
  let s = c.sec.get(key);
  if (!s) { const xx = key / 4000 * ship.hull.L; const sb = sectionBase(ship.hull, xx); s = {sb, rem: removersAt(ship, xx, sb)}; c.sec.set(key, s); }
  return s;
}
function radiusDir(s, dz, dy) {
  const sb = s.sb;
  let r;
  if (sb.ell) { const a = sb.ell.a, b = sb.ell.b; r = (a <= 1e-9 || b <= 1e-9) ? 0 : 1 / Math.sqrt((dz / a) * (dz / a) + (dy / b) * (dy / b)); }
  else r = rayPoly(sb.poly, 0, sb.yc, dz, dy);
  for (const rm of s.rem) { r = clampRem(rm, 0, sb.yc, dz, dy, r); if (r <= 0) return 0; }
  return r;
}
function v3InHull(ship,p) {
  if(ship.hull.assembly)return false;
  if(p[0]<(ship.hull.start||0)*ship.hull.L||p[0]>ship.hull.L)return false;
  const s=secAt(ship,p[0]);
  if(!(ship.trenches||[]).length){const vz=p[2],vy=p[1]-s.sb.yc,rho=Math.hypot(vz,vy);if(rho<1e-9)return radiusDir(s,0,1)>0;return rho<=radiusDir(s,vz/rho,vy/rho);}
  if(!s.profile)s.profile=sampleSection(ship,p[0]);const {Z,Y}=s.profile;
  let inside=false;for(let i=0,j=Z.length-1;i<Z.length;j=i++){if((Y[i]>p[1])!==(Y[j]>p[1])&&p[2]<(Z[j]-Z[i])*(p[1]-Y[i])/(Y[j]-Y[i])+Z[i])inside=!inside;}return inside;
}

function structBox(pt) {   // struct part geometry: centre c, size [l,w,h], taper
  const [l, w, h] = pt.s;
  return {x0: pt.c[0] - l / 2, x1: pt.c[0] + l / 2, y0: pt.c[1] - h / 2, y1: pt.c[1] + h / 2, z0: pt.c[2] - w / 2, z1: pt.c[2] + w / 2, l, w, h, tp: pt.taper || 0};
}
function baseInStruct(pt, p) {
  const b = structBox(pt);
  if (p[1] < b.y0 || p[1] > b.y1) return false;
  const f = (p[1] - b.y0) / Math.max(1e-6, b.h), sc = 1 - b.tp * f;
  return Math.abs(p[0] - pt.c[0]) <= b.l / 2 * sc && Math.abs(p[2] - pt.c[2]) <= b.w / 2 * sc;
}
function inEnv(ship, p, skip) {
  if (inHull(ship, p)) return true;
  for (const pt of ship.parts) if (pt.k === 'struct' && pt !== skip) { const b = structBounds(pt); if (p[0] >= b[0] && p[0] <= b[3] && p[1] >= b[1] && p[1] <= b[4] && p[2] >= b[2] && p[2] <= b[5] && inStruct(pt, p)) return true; }
  return false;
}

// ---------- part geometry helpers ----------
function basePartDims(pt) {
  const d = PARTS[pt.k];
  if (pt.k === 'struct') return {r: Math.hypot(pt.s[0], pt.s[1], pt.s[2]) / 2};
  if (d.shape === 'sphere') return {r: pt.d / 2};
  if (d.shape === 'cube') return {r: pt.d * 0.866, e: pt.d};
  return {r: Math.hypot(pt.d / 2, pt.d * (d.ratio || 1.5) / 2), rad: pt.d / 2, l: pt.d * (d.ratio || 1.5)};
}
function basePartVolume(pt) {
  const d = PARTS[pt.k];
  if (pt.k === 'struct') { const [l, w, h] = pt.s, k = 1 - (pt.taper || 0), A1 = l * w, A2 = l * w * k * k; return h / 3 * (A1 + A2 + Math.sqrt(A1 * A2)); }
  if (d.shape === 'sphere') return 4 / 3 * Math.PI * Math.pow(pt.d / 2, 3);
  if (d.shape === 'cube') return pt.d * pt.d * pt.d;
  const m = partDims(pt); return Math.PI * m.rad * m.rad * m.l;
}
function v3PartArea(pt) {
  const d = PARTS[pt.k];
  if (pt.k === 'struct') { const [l, w, h] = pt.s; return 2 * (l * w + l * h + w * h); }
  if (d.shape === 'sphere') return Math.PI * pt.d * pt.d;
  if (d.shape === 'cube') return 6 * pt.d * pt.d;
  const m = partDims(pt); return 2 * Math.PI * m.rad * (m.rad + m.l);
}
function baseInPart(pt, p) {
  const d = PARTS[pt.k];
  if (pt.k === 'struct') return inStruct(pt, p);
  const v = sub(p, pt.c);
  if (d.shape === 'sphere') return dot(v, v) <= pt.d * pt.d / 4;
  if (d.shape === 'cube') { const h = pt.d / 2; return Math.abs(v[0]) <= h && Math.abs(v[1]) <= h && Math.abs(v[2]) <= h; }
  const m = partDims(pt); return Math.abs(v[0]) <= m.l / 2 && v[1] * v[1] + v[2] * v[2] <= m.rad * m.rad;
}
function basePartAABB(pt) {
  const d = PARTS[pt.k];
  if (pt.k === 'struct') { const b = structBox(pt); return [b.x0, b.y0, b.z0, b.x1, b.y1, b.z1]; }
  if (d.shape === 'sphere' || d.shape === 'cube') { const h = pt.d / 2; return [pt.c[0] - h, pt.c[1] - h, pt.c[2] - h, pt.c[0] + h, pt.c[1] + h, pt.c[2] + h]; }
  const m = partDims(pt); return [pt.c[0] - m.l / 2, pt.c[1] - m.rad, pt.c[2] - m.rad, pt.c[0] + m.l / 2, pt.c[1] + m.rad, pt.c[2] + m.rad];
}
// deterministic unit samples
const VOL_S = (() => { const o = []; for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) for (let k = 0; k < 7; k++) o.push([(i + 0.5) / 7 * 2 - 1, (j + 0.5) / 7 * 2 - 1, (k + 0.5) / 7 * 2 - 1]); return o; })();
const SPH_S = (() => { const o = [], n = 96, g = Math.PI * (3 - Math.sqrt(5)); for (let i = 0; i < n; i++) { const y = 1 - (i + 0.5) / n * 2, r = Math.sqrt(1 - y * y), a = g * i; o.push([Math.cos(a) * r, y, Math.sin(a) * r]); } return o; })();
function baseVolSamples(pt) {
  const d = PARTS[pt.k], out = [];
  for (const u of VOL_S) {
    let p;
    if (pt.k === 'struct') { const b = structBox(pt); p = [pt.c[0] + u[0] * b.l / 2, pt.c[1] + u[1] * b.h / 2, pt.c[2] + u[2] * b.w / 2]; if (!inStruct(pt, p)) continue; }
    else if (d.shape === 'sphere') { if (dot(u, u) > 1) continue; p = add(pt.c, mul(u, pt.d / 2)); }
    else if (d.shape === 'cube') p = add(pt.c, mul(u, pt.d / 2));
    else { const m = partDims(pt); if (u[1] * u[1] + u[2] * u[2] > 1) continue; p = [pt.c[0] + u[0] * m.l / 2, pt.c[1] + u[1] * m.rad, pt.c[2] + u[2] * m.rad]; }
    out.push(p);
  }
  return out;
}
function baseSurfSamples(pt, inflate) {
  const d = PARTS[pt.k], e = inflate || 0, out = [];
  if (d.shape === 'sphere') { for (const u of SPH_S) out.push(add(pt.c, mul(u, pt.d / 2 + e))); return out; }
  let lo, hi;
  if (pt.k === 'struct') { const b = structBox(pt); lo = [b.x0, b.y0, b.z0]; hi = [b.x1, b.y1, b.z1]; }
  else if (d.shape === 'cube') { const h = pt.d / 2; lo = sub(pt.c, [h, h, h]); hi = add(pt.c, [h, h, h]); }
  else {
    const m = partDims(pt);
    for (let i = 0; i < 6; i++) for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; out.push([pt.c[0] + (i / 5 - 0.5) * m.l, pt.c[1] + Math.cos(a) * (m.rad + e), pt.c[2] + Math.sin(a) * (m.rad + e)]); }
    for (const sx of [-1, 1]) for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; out.push([pt.c[0] + sx * (m.l / 2 + e), pt.c[1] + Math.cos(a) * m.rad * 0.5, pt.c[2] + Math.sin(a) * m.rad * 0.5]); }
    return out;
  }
  lo = sub(lo, [e, e, e]); hi = add(hi, [e, e, e]);
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const a = (i + 0.5) / 4, b = (j + 0.5) / 4, ax = f >> 1, s = f & 1, u = (ax + 1) % 3, v = (ax + 2) % 3, p = [0, 0, 0];
    p[ax] = s ? hi[ax] : lo[ax]; p[u] = lo[u] + (hi[u] - lo[u]) * a; p[v] = lo[v] + (hi[v] - lo[v]) * b;
    out.push(p);
  }
  return out;
}

// ---------- hull geometry (loft) ----------
const SAMPLES = {warship:6, rect: 24, trap: 24, roof: 20, diamond: 16};
// Opening a trench translates the two original hull halves. The inserted
// horizontal lips and recessed vertical wall keep the opening rectangular even
// where the original wedge becomes thin. Every source edge reserves four slots
// per opening, including collapsed slots outside its extent, so loft indices
// remain stable across abrupt starts, ends, and changing hull stations.
// The opening raises the upper hull and lowers the lower hull along the whole
// length, so a trench over part of the hull leaves no step at its ends. The
// recessed slot exists only inside the trench's range and only on the
// original hull surface: faces left by cuts and notches stay flat.
function splitTrenchSection(ship,x,Z,Y,sb,probeX=x,cutMask=null,flat=false){
  const gaps=(ship.trenches||[]).filter(c=>c.mode==='split').map((c,i)=>({c,order:i,level:clamp(c.level??.5,.01,.99),height:Math.max(0,c.height||0),open:!flat&&probeX>=c.from*ship.hull.L&&probeX<=c.to*ship.hull.L})).sort((a,b)=>a.level-b.level||a.order-b.order);
  if(!gaps.length)return {Z,Y};
  // A zero-width bow still has distinct upper/lower ends after translation.
  // Use its immediately adjacent section only to classify the collapsed edges.
  let guideY=Y,guide=sb;
  if(sb.h<1e-8){const q=sampleSection(ship,clamp(x+(x>ship.hull.L/2?-1:1)*ship.hull.L*1e-5,0,ship.hull.L),{skipSplit:true});guideY=q.Y;guide=q.sb;}
  for(let i=0;i<gaps.length;i++){const g=gaps[i];g.order=i;g.y=sb.ybot+sb.h*g.level;g.gy=guide.ybot+guide.h*g.level;}
  const n=Z.length,zs=[],ys=[];
  const nextSide=(i,y)=>{for(let k=1;k<=n;k++){const d=guideY[(i+k)%n]-y;if(Math.abs(d)>1e-9)return d>0?1:-1;}return i<n/2?-1:1;};
  const shifted=(y,gy,index)=>y+gaps.reduce((sum,g)=>sum+g.height/2*(gy>g.gy+1e-9?1:gy<g.gy-1e-9?-1:nextSide(index,g.gy)),0);
  const put=(z,y)=>{zs.push(z);ys.push(y);};
  for(let j=0;j<n;j++){
    const k=(j+1)%n,dy=guideY[k]-guideY[j],up=dy>=0?1:-1;
    put(Z[j],shifted(Y[j],guideY[j],j));
    const events=gaps.map(g=>{const raw=Math.abs(dy)>1e-12?(g.gy-guideY[j])/dy:(guideY[j]>g.gy?0:1),t=clamp(raw,0,1),crossing=Math.abs(dy)>1e-12&&raw>1e-10&&raw<=1+1e-10&&(raw<1-1e-10||nextSide(k,g.gy)===up);return {g,t,crossing};}).sort((a,b)=>a.t-b.t||up*(a.g.order-b.g.order));
    for(const {g,t,crossing} of events){
      const z=lerp(Z[j],Z[k],t),y=lerp(Y[j],Y[k],t),gy=lerp(guideY[j],guideY[k],t);
      if(!crossing){const yy=shifted(y,gy,t>=1-1e-10?k:j);for(let q=0;q<4;q++)put(z,yy);continue;}
      const center=g.y+gaps.reduce((sum,q)=>sum+(q===g?0:q.height/2*(q.order<g.order?1:-1)),0),before=center-up*g.height/2,after=center+up*g.height/2;
      const onCut=cutMask&&(t<.5?cutMask[j]:cutMask[k]),selected=g.open&&!onCut&&(g.c.side==='both'||(z<0?g.c.side==='port':g.c.side==='stbd')),depth=g.height&&selected?Math.min(Math.max(0,g.c.depth||0),Math.abs(z)*.96):0,inner=z-Math.sign(z)*depth;
      put(z,before);put(inner,before);put(inner,after);put(z,after);
    }
  }
  return {Z:Float64Array.from(zs),Y:Float64Array.from(ys)};
}
function sampleSection(ship, x, options={}) {
  const sb = sectionBase(ship.hull, x), yc = sb.yc;
  let Z, Y;
  if (sb.ell) {
    const N = 96; Z = new Float64Array(N); Y = new Float64Array(N);
    for (let j = 0; j < N; j++) { const a = -Math.PI / 2 + j / N * Math.PI * 2; Z[j] = Math.cos(a) * sb.ell.a; Y[j] = yc + Math.sin(a) * sb.ell.b; }
  }
  const rem = removersAt(ship, x, sb);
  // Where a cutting plane crosses a section edge, the crossing sits in a fixed
  // sample slot of that edge at every station, so the cut corner runs as one
  // straight seam instead of hopping between slots (a saw-tooth edge).
  let exact = null;
  if (!sb.ell) {
    const k = SAMPLES[ship.hull.sec] || 24, V = sb.poly.length, N = V * k, planes = rem.filter(r => r.hp), q4 = Math.max(1, Math.round(k / 4));
    Z = new Float64Array(N); Y = new Float64Array(N); exact = new Uint8Array(N);
    for (let e = 0; e < V; e++) {
      const P = sb.poly[e], Q = sb.poly[(e + 1) % V];
      let ta = 0, tb = 1;
      for (const h of planes) {
        const fa = (P[0] - h.A[0]) * h.n[0] + (P[1] - h.A[1]) * h.n[1], fb = (Q[0] - h.A[0]) * h.n[0] + (Q[1] - h.A[1]) * h.n[1];
        if (fa <= 1e-9 && fb <= 1e-9) continue;
        if (fa > 1e-9 && fb > 1e-9) { ta = 1; tb = 0; break; }
        const t = fa / (fa - fb); if (fa > 1e-9) ta = Math.max(ta, t); else tb = Math.min(tb, t);
      }
      const head = ta > 1e-6 && ta < tb, tail = tb < 1 - 1e-6 && ta < tb, ia = head ? q4 : 0, ib = tail ? k - q4 : k;
      for (let m = 0; m < k; m++) {
        // Removed head [0,ta] → slots 0..ia, kept part [ta,tb] → ia..ib, removed tail → ib..k.
        const t0 = head ? ta : 0;
        let f = m / k;
        if (head || tail) f = ia && m <= ia ? ta * m / ia : m <= ib ? t0 + (tb - t0) * (m - ia) / (ib - ia) : tb + (1 - tb) * (m - ib) / (k - ib);
        if ((head && m === ia) || (tail && m === ib)) { f += (m === ia && head ? 1 : -1) * 1e-7; exact[e * k + m] = 1; }
        Z[e * k + m] = P[0] + (Q[0] - P[0]) * f; Y[e * k + m] = P[1] + (Q[1] - P[1]) * f;
      }
    }
  }
  let cutMask = null;
  if (rem.length) {
    const N = Z.length, oz = Z.slice(), oy = Y.slice(), who = new Int8Array(N).fill(-1);
    cutMask = new Uint8Array(N);
    for (let j = 0; j < N; j++) for (let q = 0; q < rem.length; q++) if (removedBy(rem[q], oz[j], oy[j])) { who[j] = q; break; }
    for (let j = 0; j < N; j++) {
      if (who[j] < 0) continue;
      const tr=rem[who[j]];
      if(tr.trench){Z[j]=oz[j]>0?tr.z0:tr.z1;continue;}
      cutMask[j] = 1;
      const pv = (j + N - 1) % N, nx = (j + 1) % N;
      if (who[pv] < 0 && !exact?.[pv]) { const p = segEnter(rem[who[j]], oz[pv], oy[pv], oz[j], oy[j]); Z[j] = p[0]; Y[j] = p[1]; continue; }
      if (who[nx] < 0 && !exact?.[nx]) { const p = segEnter(rem[who[j]], oz[nx], oy[nx], oz[j], oy[j]); Z[j] = p[0]; Y[j] = p[1]; continue; }
      const vz = oz[j], vy = oy[j] - yc, r0 = Math.hypot(vz, vy);
      if (r0 < 1e-9) continue;
      let r = r0; for (const rm of rem) r = clampRem(rm, 0, yc, vz / r0, vy / r0, r);
      Z[j] = vz / r0 * r; Y[j] = yc + vy / r0 * r;
    }
  }
  if(ship.cuts.some(c=>c.type==='planTrapezoid'))for(const tr of rem.filter(r=>r.trench))for(let j=0;j<Z.length;j++)if(removedBy(tr,Z[j],Y[j]))Z[j]=Z[j]>0?tr.z0:tr.z1;
  if(!options.skipSplit)({Z,Y}=splitTrenchSection(ship,x,Z,Y,sb,options.probeX??x,cutMask,!!options.flat));
  let A = 0; for (let j = 0, N = Z.length; j < N; j++) { const i2 = (j + 1) % N; A += Z[j] * Y[i2] - Z[i2] * Y[j]; }
  return {Z, Y, yc, area: Math.abs(A) / 2, sb};
}
function cache(ship) {
  if(ship._lockedCache)return ship._lockedCache;
  const key = JSON.stringify([ship.hull, ship.keel, ship.cuts, ship.subs, ship.trenches, ship.solidCuts, ship.hatches.filter(h=>h.portal), ship.parts.filter(p=>ship.hatches.some(h=>h.bay===p.id)).map(p=>[p.c,p.room,p.yaw,p.foreWidth,p.aftWidth])],(k,v)=>k.startsWith('_')&&k!=='_doorDetached'?undefined:v);
  if (!ship._cache || ship._cache.key !== key) ship._cache = {key, sec: new Map(), geo: null, hf: null, hfKey: ''};
  return ship._cache;
}
function v3HullGeo(ship, flat = false) {
  const c = cache(ship), slot = flat ? 'geoFlat' : 'geo'; if (c[slot]) return c[slot];
  if(ship.hull.assembly){const sec={Z:new Float64Array([0]),Y:new Float64Array([0]),area:0};return c.geo={xs:[0,ship.hull.L],secs:[sec,sec],N:1,tris:new Float32Array(),area:0,volume:0,caps:[]};}
  const hp = ship.hull, L = hp.L, eps = L * 2e-4, set = new Set(),hasSplits=(ship.trenches||[]).some(t=>t.mode==='split');
  const n = hp.stations?.length?64:168; for (let i = 0; i <= n; i++) set.add(L * i / n);
  const addB = (x) => { for (const v of [x - eps, x + eps]) if (v > 0 && v < L) set.add(v); };
  for (const cu of [...ship.cuts,...(ship.trenches||[])]) { addB(cu.from * L); addB(cu.to * L);if(cu.type==='planTrapezoid'){set.add(cu.from*L);set.add(cu.to*L);set.add(cu.innerFrom*L);set.add(cu.innerTo*L);} }
  for (const s of ship.subs) { addB(s.b[0]); addB(s.b[3]); }
  for(const p of hp.stations||[])set.add(p[0]*L);
  for(const h of ship.hatches.filter(h=>h.portal)){const b=openingBounds(ship,h);if(b){addB(b[0]);addB(b[3]);}}
  set.add((hp.start||0)*L);
  const splitBounds=new Set((ship.trenches||[]).filter(t=>t.mode==='split').flatMap(t=>[t.from*L,t.to*L]).filter(x=>x>(hp.start||0)*L&&x<L));
  for(const x of splitBounds)set.add(x);
  const ordered = Array.from(set).filter(x=>x>=(hp.start||0)*L).sort((a, b) => a - b),xs=[],secs=[];
  for(const x of ordered){
    if(splitBounds.has(x)){for(const side of [-1,1]){xs.push(x);secs.push(sampleSection(ship,x,{probeX:x+side*Math.max(1e-6,L*1e-9),flat}));}}
    else{xs.push(x);secs.push(sampleSection(ship,x,{flat}));}
  }
  const N = secs[0].Z.length;
  const tris = [];
  let area = 0, vol = 0;
  for (let i = 0; i + 1 < xs.length; i++) {
    vol += (secs[i].area + secs[i + 1].area) / 2 * (xs[i + 1] - xs[i]);
    for (let j = 0; j < N; j++) {
      const j2 = (j + 1) % N, a = [xs[i], secs[i].Y[j], secs[i].Z[j]], b = [xs[i + 1], secs[i + 1].Y[j], secs[i + 1].Z[j]];
      const cc = [xs[i + 1], secs[i + 1].Y[j2], secs[i + 1].Z[j2]], d = [xs[i], secs[i].Y[j2], secs[i].Z[j2]];
      if(hasSplits){if(len(cross(sub(b,a),sub(cc,a)))>2e-9)tris.push(a,b,cc);if(len(cross(sub(cc,a),sub(d,a)))>2e-9)tris.push(a,cc,d);}
      else tris.push(a, b, cc, a, cc, d);
    }
  }
  const caps = [];
  for (const i of [0, xs.length - 1]) {
    const s = secs[i]; if (s.area < 1e-3) continue;
    let cz = 0, cy = 0; for (let j = 0; j < N; j++) { cz += s.Z[j]; cy += s.Y[j]; } cz /= N; cy /= N;
    const C0 = [xs[i], cy, cz];
    if(hasSplits){
      // A recessed trench is concave: a centre fan would fill the open recess.
      const points=[];for(let j=0;j<N;j++){const p=[s.Z[j],s.Y[j]],last=points.at(-1);if(!last||Math.hypot(p[0]-last[0],p[1]-last[1])>1e-8)points.push(p);}
      if(points.length>1&&Math.hypot(points[0][0]-points.at(-1)[0],points[0][1]-points.at(-1)[1])<1e-8)points.pop();
      for(const ids of outlineEars(points))tris.push(...ids.map(j=>[xs[i],points[j][1],points[j][0]]));
    }else for (let j = 0; j < N; j++) { const j2 = (j + 1) % N; tris.push(C0, [xs[i], s.Y[j], s.Z[j]], [xs[i], s.Y[j2], s.Z[j2]]); }
    caps.push({i, c: C0});
  }
  const T = new Float32Array(tris.length * 3);
  let k = 0;
  for (let q = 0; q < tris.length; q += 3) {
    let a = tris[q], b = tris[q + 1], c2 = tris[q + 2];
    const nrm = cross(sub(b, a), sub(c2, a)), ar = len(nrm) / 2;
    if (ar < 1e-9) { b = a; c2 = a; }
    else {
      area += ar;
      const cen = [(a[0] + b[0] + c2[0]) / 3, (a[1] + b[1] + c2[1]) / 3, (a[2] + b[2] + c2[2]) / 3];
      let outw;
      if (cen[0] <= xs[0] + 1e-6 && Math.abs(nrm[0]) > len(nrm) * 0.99) outw = [-1, 0, 0];
      else if (cen[0] >= xs[xs.length - 1] - 1e-6 && Math.abs(nrm[0]) > len(nrm) * 0.99) outw = [1, 0, 0];
      else { const sb = sectionBase(hp, clamp(cen[0], 0, L)); outw = [0, cen[1] - sb.yc, cen[2]]; }
      if ((cen[0] <= xs[0]+1e-6 || cen[0] >= xs[xs.length-1]-1e-6) && dot(nrm, outw) < 0) { const t = b; b = c2; c2 = t; }
    }
    for (const v of [a, b, c2]) { T[k++] = v[0]; T[k++] = v[1]; T[k++] = v[2]; }
  }
  c[slot] = {xs, secs, N, tris: T, area, volume: vol, caps};
  return c[slot];
}

// ---------- ray casting ----------
function rayTris(T, o, d, maxT) {
  let best = maxT == null ? Infinity : maxT, hit = -1;
  for (let i = 0; i < T.length; i += 9) {
    const e1x = T[i + 3] - T[i], e1y = T[i + 4] - T[i + 1], e1z = T[i + 5] - T[i + 2];
    const e2x = T[i + 6] - T[i], e2y = T[i + 7] - T[i + 1], e2z = T[i + 8] - T[i + 2];
    const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x;
    const det = e1x * px + e1y * py + e1z * pz; if (Math.abs(det) < 1e-12) continue;
    const inv = 1 / det, tx = o[0] - T[i], ty = o[1] - T[i + 1], tz = o[2] - T[i + 2];
    const u = (tx * px + ty * py + tz * pz) * inv; if (u < 0 || u > 1) continue;
    const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
    const v = (d[0] * qx + d[1] * qy + d[2] * qz) * inv; if (v < 0 || u + v > 1) continue;
    const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
    if (t > 1e-6 && t < best) { best = t; hit = i; }
  }
  if (hit < 0) return null;
  const i = hit, n = norm(cross([T[i + 3] - T[i], T[i + 4] - T[i + 1], T[i + 5] - T[i + 2]], [T[i + 6] - T[i], T[i + 7] - T[i + 1], T[i + 8] - T[i + 2]]));
  return {t: best, n, p: add(o, mul(d, best))};
}
function rayAABB(o, d, b) {
  let t0 = 0, t1 = Infinity, ax = -1;
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-12) { if (o[a] < b[a] || o[a] > b[a + 3]) return null; continue; }
    let ta = (b[a] - o[a]) / d[a], tb = (b[a + 3] - o[a]) / d[a];
    if (ta > tb) { const q = ta; ta = tb; tb = q; }
    if (ta > t0) { t0 = ta; ax = a; }
    if (tb < t1) t1 = tb; if (t0 > t1) return null;
  }
  if (ax < 0) return null;
  const n = [0, 0, 0]; n[ax] = d[ax] > 0 ? -1 : 1;
  return {t: t0, n, p: add(o, mul(d, t0))};
}
function raySphere(o, d, c, r) {
  const oc = sub(o, c), b = dot(oc, d), cc = dot(oc, oc) - r * r, h = b * b - cc; if (h < 0) return null;
  const s = Math.sqrt(h); let t = -b - s; if (t < 1e-6) t = -b + s; if (t < 1e-6) return null;
  const p = add(o, mul(d, t)); return {t, p, n: norm(sub(p, c))};
}
function rayCyl(o, d, pt) {   // cylinder along X
  const m = partDims(pt), c = pt.c;
  let best = null;
  const oy = o[1] - c[1], oz = o[2] - c[2], A = d[1] * d[1] + d[2] * d[2], B = oy * d[1] + oz * d[2], Cc = oy * oy + oz * oz - m.rad * m.rad;
  if (A > 1e-12) { const h = B * B - A * Cc; if (h >= 0) { for (const t of [(-B - Math.sqrt(h)) / A, (-B + Math.sqrt(h)) / A]) { if (t < 1e-6) continue; const x = o[0] + d[0] * t - c[0]; if (Math.abs(x) <= m.l / 2) { const p = add(o, mul(d, t)); best = {t, p, n: norm([0, p[1] - c[1], p[2] - c[2]])}; break; } } } }
  if (Math.abs(d[0]) > 1e-12) for (const sx of [-1, 1]) { const t = (c[0] + sx * m.l / 2 - o[0]) / d[0]; if (t < 1e-6 || (best && t >= best.t)) continue; const p = add(o, mul(d, t)); if ((p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2 <= m.rad * m.rad) best = {t, p, n: [sx, 0, 0]}; }
  return best;
}
function baseRayPart(o, d, pt) {
  const sh = PARTS[pt.k].shape;
  if (sh === 'sphere') return raySphere(o, d, pt.c, pt.d / 2);
  if (sh === 'cyl' || sh === 'engine') return rayCyl(o, d, pt);
  if (pt.k === 'struct' && pt.taper > 0.01) {
    const b = partAABB(pt), h = rayAABB(o, d, b); if (!h) return null;
    const step = Math.max(0.5, Math.min(pt.s[0], pt.s[1], pt.s[2]) / 40);
    for (let t = h.t; t < h.t + len([pt.s[0], pt.s[1], pt.s[2]]); t += step) {
      const p = add(o, mul(d, t));
      if (inStruct(pt, p)) {
        let n = h.n;
        if (Math.abs(p[1] - b[4]) < step * 1.5) n = [0, 1, 0];
        else { const sb = structBox(pt), f = (p[1] - sb.y0) / sb.h, ex = sb.l / 2 * (1 - sb.tp * f), ez = sb.w / 2 * (1 - sb.tp * f), dx = Math.abs(p[0] - pt.c[0]) - ex, dz = Math.abs(p[2] - pt.c[2]) - ez;
          const sl = sb.tp * 0.5 / Math.max(1e-6, sb.h);
          n = dx > dz ? norm([Math.sign(p[0] - pt.c[0]), sl * sb.l, 0]) : norm([0, sl * sb.w, Math.sign(p[2] - pt.c[2])]); }
        return {t, p, n};
      }
    }
    return null;
  }
  return rayAABB(o, d, partAABB(pt));
}
// bounding-volume hierarchy over the hull triangles
function buildBVH(T) {
  const n = T.length / 9, idx = new Int32Array(n), cx = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { idx[i] = i; for (let a = 0; a < 3; a++) cx[i * 3 + a] = (T[i * 9 + a] + T[i * 9 + 3 + a] + T[i * 9 + 6 + a]) / 3; }
  const bb = [], L = [], R = [], S = [], C = [];
  const mk = (s, e) => {
    const id = L.length; L.push(-1); R.push(-1); S.push(s); C.push(e - s);
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let q = s; q < e; q++) { const i = idx[q]; for (let v = 0; v < 3; v++) for (let a = 0; a < 3; a++) { const x = T[i * 9 + v * 3 + a]; if (x < b[a]) b[a] = x; if (x > b[a + 3]) b[a + 3] = x; } }
    bb.push(b);
    if (e - s > 6) {
      let ax = 0, ext = -1; for (let a = 0; a < 3; a++) if (b[a + 3] - b[a] > ext) { ext = b[a + 3] - b[a]; ax = a; }
      const m = (s + e) >> 1;
      let lo = s, hi = e;
      while (hi - lo > 1) {   // quickselect: idx[m] in place along ax
        const pv = cx[idx[(lo + hi) >> 1] * 3 + ax];
        let i = lo, j = hi - 1;
        while (i <= j) {
          while (cx[idx[i] * 3 + ax] < pv) i++;
          while (cx[idx[j] * 3 + ax] > pv) j--;
          if (i <= j) { const t = idx[i]; idx[i] = idx[j]; idx[j] = t; i++; j--; }
        }
        if (m <= j) hi = j + 1; else if (m >= i) lo = i; else break;
      }
      const l = mk(s, m), r = mk(m, e); L[id] = l; R[id] = r; C[id] = 0;
    }
    return id;
  };
  mk(0, n);
  const B = new Float32Array(bb.length * 6); bb.forEach((b, i) => B.set(b, i * 6));
  return {B, L: Int32Array.from(L), R: Int32Array.from(R), S: Int32Array.from(S), C: Int32Array.from(C), idx, T};
}
function rayBVH(bvh, o, d, maxT) {
  if(!bvh.T.length)return null;
  const T = bvh.T, B = bvh.B, ix = 1 / (d[0] || 1e-30), iy = 1 / (d[1] || 1e-30), iz = 1 / (d[2] || 1e-30);
  let best = maxT == null ? Infinity : maxT, hit = -1;
  const st = [0];
  while (st.length) {
    const nd = st.pop(), k = nd * 6;
    let t1 = (B[k] - o[0]) * ix, t2 = (B[k + 3] - o[0]) * ix, tmin = Math.min(t1, t2), tmax = Math.max(t1, t2);
    t1 = (B[k + 1] - o[1]) * iy; t2 = (B[k + 4] - o[1]) * iy; tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
    t1 = (B[k + 2] - o[2]) * iz; t2 = (B[k + 5] - o[2]) * iz; tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2));
    if (tmax < Math.max(tmin, 0) - 1e-6 || tmin > best) continue;
    if (bvh.C[nd] > 0) {
      for (let q = bvh.S[nd], e = q + bvh.C[nd]; q < e; q++) {
        const i = bvh.idx[q] * 9;
        const e1x = T[i + 3] - T[i], e1y = T[i + 4] - T[i + 1], e1z = T[i + 5] - T[i + 2];
        const e2x = T[i + 6] - T[i], e2y = T[i + 7] - T[i + 1], e2z = T[i + 8] - T[i + 2];
        const px = d[1] * e2z - d[2] * e2y, py = d[2] * e2x - d[0] * e2z, pz = d[0] * e2y - d[1] * e2x;
        const det = e1x * px + e1y * py + e1z * pz; if (Math.abs(det) < 1e-12) continue;
        const inv = 1 / det, tx = o[0] - T[i], ty = o[1] - T[i + 1], tz = o[2] - T[i + 2];
        const u = (tx * px + ty * py + tz * pz) * inv; if (u < 0 || u > 1) continue;
        const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
        const v = (d[0] * qx + d[1] * qy + d[2] * qz) * inv; if (v < 0 || u + v > 1) continue;
        const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
        if (t > 1e-6 && t < best) { best = t; hit = i; }
      }
    } else { st.push(bvh.L[nd], bvh.R[nd]); }
  }
  if (hit < 0) return null;
  const i = hit, n = norm(cross([T[i + 3] - T[i], T[i + 4] - T[i + 1], T[i + 5] - T[i + 2]], [T[i + 6] - T[i], T[i + 7] - T[i + 1], T[i + 8] - T[i + 2]]));
  return {t: best, n, p: add(o, mul(d, best))};
}
function rayEnv(ship, o, d, opts) {
  opts = opts || {};
  const g = referenceHullGeometry(ship)||hullGeo(ship);
  if (!g.bvh) g.bvh = buildBVH(g.tris);
  let best = rayBVH(g.bvh, o, d, opts.maxT);
  if (best) best.kind = 'hull';
  for (const pt of ship.parts) {
    if (opts.structOnly && pt.k !== 'struct') continue;
    if (opts.skip && opts.skip === pt) continue;
    if (opts.skipSet && opts.skipSet.has(pt)) continue;
    const h = rayPart(o, d, pt);
    if (h && (!best || h.t < best.t) && (opts.maxT == null || h.t < opts.maxT)) { best = h; best.kind = 'part'; best.part = pt; }
  }
  return best;
}

// ---------- fittings mounting (auto pedestal) ----------
function fitFrame(a) {
  const up = AXES[a], fw = (a === 0 || a === 1) ? [0, 1, 0] : [1, 0, 0];
  return {up, fw, rt: cross(fw, up)};
}
function baseMountFit(ship, f) {
  const d = fitSpec(f), fr = fitFrame(f.a), R = d.r, big = f.localMount||d.casemate ? Math.max(2,Math.min(6,R*.25)) : Math.max(ship.hull.H, ship.hull.W, 200) * 2;
  const h0 = rayEnv(ship, add(f.p, mul(fr.up, big)), mul(fr.up, -1), {maxT: big * 2,structOnly:true});
  if (!h0) { f.float = true; f.base = 0; f.low = 0; f.slope = 0; return f; }
  f.float = false; f.p = h0.p;
  let hi = 0, lo = 0, miss = 0;
  for (let k = 0; k < 12; k++) {
    const a = k / 12 * Math.PI * 2, q = add(f.p, add(mul(fr.fw, Math.cos(a) * R * 0.95), mul(fr.rt, Math.sin(a) * R * 0.95)));
    const h = rayEnv(ship, add(q, mul(fr.up, big)), mul(fr.up, -1), {maxT: big * 2,structOnly:true});
    if (!h) { miss++; continue; }
    const ht = dot(sub(h.p, f.p), fr.up);
    if (ht > hi) hi = ht; if (ht < lo) lo = ht;
  }
  f.base = hi; f.low = Math.min(lo, 0) - (miss ? R * 0.5 : 0); f.slope = hi - lo;
  return f;
}
function baseFitOrigin(f) { const fr = fitFrame(f.a); return add(f.p, mul(fr.up, f.base + f.ped)); }
function baseFitAABB(f) {
  const d = fitSpec(f), fr = fitFrame(f.a), o = fitOrigin(f), R = d.r * Math.max(1.05, (f.pedSize || 1) * (f.pedShape === 'trap' ? 1.4 : 1.1));
  const top = add(o, mul(fr.up, d.hm)), bot = add(f.p, mul(fr.up, f.low || 0));
  const lo = [0, 0, 0], hi = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    if (fr.up[k] !== 0) { lo[k] = Math.min(top[k], bot[k]); hi[k] = Math.max(top[k], bot[k]); }
    else { const ext = k === 0 && d.cat === 'b' ? d.fm / 2 : k === 2 && d.cat === 'b' ? d.wm / 2 : R; lo[k] = o[k] - ext; hi[k] = o[k] + ext; }
  }
  return [lo[0], lo[1], lo[2], hi[0], hi[1], hi[2]];
}

// ---------- hatches (decals projected onto the surface) ----------
function hatchFrame(h) {
  let along = sub(h.b, h.a);
  along = sub(along, mul(h.n, dot(along, h.n)));
  let L = len(along);
  if (L < h.w * 0.5) { along = sub([1, 0, 0], mul(h.n, h.n[0])); if (len(along) < 1e-6) along = [0, 1, 0]; L = h.w; }
  const u = norm(along), v = norm(cross(h.n, u));
  return {u, v, L, o: L === h.w && len(sub(h.b, h.a)) < h.w * 0.5 ? sub(h.a, mul(u, h.w / 2)) : h.a};
}
function v3HatchGrid(ship, h) {
  const fr = hatchFrame(h), nl = clamp(Math.ceil(fr.L / 8) + 1, 2, 90), nw = clamp(Math.ceil(h.w / 8) + 1, 2, 24);
  const pts = [], nrm = [], big = Math.max(80, h.w);
  for (let i = 0; i < nl; i++) for (let j = 0; j < nw; j++) {
    const q = add(add(fr.o, mul(fr.u, fr.L * i / (nl - 1))), mul(fr.v, (j / (nw - 1) - 0.5) * h.w));
    const hit = rayEnv(ship, add(q, mul(h.n, big)), mul(h.n, -1), {maxT: big * 2.5});
    if (hit) { pts.push(hit.p); nrm.push(hit.n); } else { pts.push(null); nrm.push(null); }
  }
  return {nl, nw, pts, nrm, area: fr.L * h.w};
}

// ---------- heightfield (fast occupancy for fire arcs and bridge view) ----------
function heightfield(ship) {
  const c = cache(ship), key = JSON.stringify(ship.parts.filter(p => p.k === 'struct').map(p => [p.c,p.s,p.taper,p.form,p.angles,p.yaw,p.offsetX,p.offsetZ,p.skinAsset,p.arcInner,p.arcStart,p.arcSweep,p.loft,p.outline,p.deckSlope,p.ridge,p.foreWidth,p.aftWidth,p._apertures]));
  if (c.hf && c.hfKey === key) return c.hf;
  const g = hullGeo(ship), hp = ship.hull;
  let zmax = hp.W / 2, x0 = 0, x1 = hp.L;
  for (const pt of ship.parts) if (pt.k === 'struct') { const b = partAABB(pt); zmax = Math.max(zmax, Math.abs(b[2]), Math.abs(b[5])); x0 = Math.min(x0, b[0]); x1 = Math.max(x1, b[3]); }
  zmax += 5;
  const nx = 220, nz = 110, dx = (x1 - x0) / nx, dz = 2 * zmax / nz;
  const top = new Float32Array(nx * nz).fill(-1e9), bot = new Float32Array(nx * nz).fill(1e9);
  let si = 0;
  for (let ix = 0; !ship.solidCuts?.length && ix < nx; ix++) {
    const x = x0 + (ix + 0.5) * dx;
    if (x < 0 || x > hp.L) continue;
    while (si + 1 < g.xs.length && g.xs[si + 1] < x) si++;
    const s = g.secs[si], N = s.Z.length;
    for (let iz = 0; iz < nz; iz++) {
      const z = -zmax + (iz + 0.5) * dz;
      let tp = -1e9, bt = 1e9;
      for (let j = 0; j < N; j++) {
        const j2 = (j + 1) % N, za = s.Z[j], zb = s.Z[j2];
        if ((za - z) * (zb - z) > 0 || za === zb) continue;
        const y = s.Y[j] + (s.Y[j2] - s.Y[j]) * (z - za) / (zb - za);
        if (y > tp) tp = y; if (y < bt) bt = y;
      }
      top[ix * nz + iz] = tp; bot[ix * nz + iz] = bt;
    }
  }
  for(const pt of [...(ship.solidCuts?.length?[null]:[]),...ship.parts.filter(p=>p.k==='struct')]){
    const T=pt?structTriangles(pt):g.tris;
    for(let i=0;i<T.length;i+=9){const a=Array.from(T.slice(i,i+3)),b=Array.from(T.slice(i+3,i+6)),d=Array.from(T.slice(i+6,i+9)),det=(b[2]-d[2])*(a[0]-d[0])+(d[0]-b[0])*(a[2]-d[2]);if(Math.abs(det)<1e-9)continue;
      const ix0=Math.max(0,Math.floor((Math.min(a[0],b[0],d[0])-x0)/dx)),ix1=Math.min(nx-1,Math.floor((Math.max(a[0],b[0],d[0])-x0)/dx)),iz0=Math.max(0,Math.floor((Math.min(a[2],b[2],d[2])+zmax)/dz)),iz1=Math.min(nz-1,Math.floor((Math.max(a[2],b[2],d[2])+zmax)/dz));
      for(let ix=ix0;ix<=ix1;ix++)for(let iz=iz0;iz<=iz1;iz++){const x=x0+(ix+.5)*dx,z=-zmax+(iz+.5)*dz,u=((b[2]-d[2])*(x-d[0])+(d[0]-b[0])*(z-d[2]))/det,v=((d[2]-a[2])*(x-d[0])+(a[0]-d[0])*(z-d[2]))/det;if(u<-.0001||v<-.0001||u+v>1.0001)continue;const y=u*a[1]+v*b[1]+(1-u-v)*d[1],k=ix*nz+iz;top[k]=Math.max(top[k],y);bot[k]=Math.min(bot[k],y);}
    }
  }
  c.hf = {x0, dx, nx, zmax, dz, nz, top, bot}; c.hfKey = key;
  return c.hf;
}
function hfBlocked(hf, p) {
  const ix = Math.floor((p[0] - hf.x0) / hf.dx), iz = Math.floor((p[2] + hf.zmax) / hf.dz);
  if (ix < 0 || iz < 0 || ix >= hf.nx || iz >= hf.nz) return false;
  const k = ix * hf.nz + iz; return p[1] <= hf.top[k] && p[1] >= hf.bot[k];
}
function freeRay(hf, o, d, maxT, obst, selfFit) {
  const step = Math.min(hf.dx, hf.dz) * 0.8;
  for (let t = step; t < maxT; t += step) { const p = [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t]; if (hfBlocked(hf, p)) return false; }
  for (const ob of obst) {
    if (ob.fit === selfFit) continue;
    const h = ob.sphere ? raySphere(o, d, ob.c, ob.r) : rayAABB(o, d, ob.b);
    if (h && h.t < maxT) return false;
  }
  return true;
}
const SECTORS = [
  {key: 'fore', name: '前方', d: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1]}, {key: 'aft', name: '後方', d: [-1, 0, 0], u: [0, 1, 0], v: [0, 0, 1]},
  {key: 'stbd', name: '右舷', d: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0]}, {key: 'port', name: '左舷', d: [0, 0, -1], u: [1, 0, 0], v: [0, 1, 0]},
  {key: 'dors', name: '上方', d: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1]}, {key: 'vent', name: '下方', d: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1]},
];
function obstacles(ship) {
  const out = [];
  for (const pt of ship.parts) {
    if (pt.k === 'struct') continue;
    if (PARTS[pt.k].shape === 'sphere') out.push({sphere: true, c: pt.c, r: pt.d / 2 * 0.98});
    else { const b = partAABB(pt); out.push({b: [b[0] + 0.5, b[1] + 0.5, b[2] + 0.5, b[3] - 0.5, b[4] - 0.5, b[5] - 0.5]}); }
  }
  for (const f of ship.fits) out.push({b: fitAABB(f), fit: f});
  return out;
}
function fireArcs(ship, f, hf, obst) {
  hf = hf || heightfield(ship); obst = obst || obstacles(ship);
  const d = fitSpec(f), fr = fitFrame(f.a), o = d.casemate?referenceFitPoint(f,[.5,0,0]):add(fitOrigin(f), mul(fr.up, d.hm * 0.7));
  const maxT = ship.hull.L * 2.2 + 400, offs = [-0.55, 0, 0.55];
  return SECTORS.map(S => {
    let free = 0;
    for (const a of offs) for (const b of offs) {
      const dir = norm([S.d[0] + a * S.u[0] + b * S.v[0], S.d[1] + a * S.u[1] + b * S.v[1], S.d[2] + a * S.u[2] + b * S.v[2]]);
      const facing=dot(dir,AXES[f.mountAxis??f.a]);
      if(facing<0||d.casemate&&(facing<Math.cos(65*Math.PI/180)||Math.abs(dir[1])>Math.sin(20*Math.PI/180)))continue;
      const start=add(o,mul(dir,d.casemate?.2:d.r*1.1));
      if(f.localMount||d.casemate){
        const c=cache(ship);if(!c.trenchBVH||c.trenchBVHKey!==c.hfKey){const tris=[...hullGeo(ship).tris];for(const p of ship.parts)if(p.k==='struct')for(const n of structTriangles(p))tris.push(n);c.trenchBVH=buildBVH(Float32Array.from(tris));c.trenchBVHKey=c.hfKey;}
        if(rayBVH(c.trenchBVH,start,dir,maxT))continue;
        if(obst.some(ob=>ob.fit!==f&&(()=>{const h=ob.sphere?raySphere(start,dir,ob.c,ob.r):rayAABB(start,dir,ob.b);return h&&h.t<maxT;})()))continue;
        free++;
      }else if(freeRay(hf,start,dir,maxT,obst,f))free++;
    }
    return free / 9;
  });
}
// ---------- trial gunnery: one ray per turret and direction ----------
// Same rules as fireArcs (mount facing, casemate cone, hull heightfield,
// trench walls and other fittings) for a single direction; rays stop testing
// the heightfield once they leave the ship's bounding box.
function turretRayContext(ship){
  const hf=heightfield(ship);let ymin=1e9,ymax=-1e9;
  for(let k=0;k<hf.top.length;k++){if(hf.top[k]>ymax)ymax=hf.top[k];if(hf.bot[k]<ymin)ymin=hf.bot[k];}
  return {hf,obst:obstacles(ship),box:[hf.x0,ymin-1,-hf.zmax,hf.x0+hf.nx*hf.dx,ymax+1,hf.zmax]};
}
function boxExit(o,d,b){let t1=Infinity;for(let a=0;a<3;a++){if(Math.abs(d[a])<1e-12){if(o[a]<b[a]||o[a]>b[a+3])return 0;continue;}const ta=(b[a]-o[a])/d[a],tb=(b[a+3]-o[a])/d[a];t1=Math.min(t1,Math.max(ta,tb));}return Math.max(0,t1);}
function turretOrigin(f){const d=fitSpec(f),fr=fitFrame(f.a);return d.casemate?referenceFitPoint(f,[.5,0,0]):add(fitOrigin(f),mul(fr.up,d.hm*0.7));}
function turretClear(ship,f,dir,ctx){
  // Guns may depress about 10° below their mounting plane; the hull still blocks.
  const d=fitSpec(f),facing=dot(dir,AXES[f.mountAxis??f.a]);
  if(facing<-.17||d.casemate&&(facing<Math.cos(65*Math.PI/180)||Math.abs(dir[1])>Math.sin(20*Math.PI/180)))return false;
  const start=add(turretOrigin(f),mul(dir,d.casemate?.2:d.r*1.1)),maxT=ship.hull.L*2.2+400;
  if(f.localMount||d.casemate){
    const c=cache(ship);if(!c.trenchBVH||c.trenchBVHKey!==c.hfKey){const tris=[...hullGeo(ship).tris];for(const p of ship.parts)if(p.k==='struct')for(const n of structTriangles(p))tris.push(n);c.trenchBVH=buildBVH(Float32Array.from(tris));c.trenchBVHKey=c.hfKey;}
    if(rayBVH(c.trenchBVH,start,dir,maxT))return false;
  }else{
    const hf=ctx.hf,step=Math.min(hf.dx,hf.dz)*0.8,end=Math.min(maxT,boxExit(start,dir,ctx.box));
    for(let t=step;t<end;t+=step){const p=[start[0]+dir[0]*t,start[1]+dir[1]*t,start[2]+dir[2]*t];if(hfBlocked(hf,p))return false;}
  }
  for(const ob of ctx.obst){if(ob.fit===f)continue;const h=ob.sphere?raySphere(start,dir,ob.c,ob.r):rayAABB(start,dir,ob.b);if(h&&h.t<maxT)return false;}
  return true;
}
// Traverse speed by turret radius: a point-defence mount ~55°/s, a 30 m
// heavy turret ~12°/s, a dreadnought's 56 m mount ~5°/s.
function turretRate(f){const r=Math.max(2,fitSpec(f).r);return clamp(400/Math.pow(r,1.3),3,90);}
function bridgeView(ship, f, hf, obst) {
  const d = fitSpec(f), fr = fitFrame(f.a), o = add(fitOrigin(f), mul(fr.up, d.hm * 0.85));
  let free = 0, tot = 0;
  for (let k = 0; k < 24; k++) {
    const az = k / 24 * Math.PI * 2;
    for (const el of [-0.12, 0.04]) {
      tot++;
      const dir = norm([Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)]);
      if (freeRay(hf, add(o, mul(dir, d.r * 1.2)), dir, Math.max(800, ship.hull.L), obst, f)) free++;
    }
  }
  return free / tot;
}

// ---------- editing helpers ----------
function mirrorP(p) { return [p[0], p[1], -p[2]]; }
function twinOf(ship, item, list) { return item.tw ? list.find(q => q.id === item.tw) : null; }
function basePlacePart(ship, k, c, size, opts, mirror) {
  opts = opts || {};
  const pt = {id: nid(ship), k, c: c.slice()};
  if (k === 'struct') { pt.s = size.slice(); pt.taper = opts.taper || 0; } else pt.d = size;
  ship.parts.push(pt);
  if (mirror && Math.abs(c[2]) > Math.max(1, partDims(pt).r * 0.05)) {
    const q = JSON.parse(JSON.stringify(pt)); q.id = nid(ship); q.c = mirrorP(c); q.tw = pt.id; pt.tw = q.id; ship.parts.push(q);
  }
  return pt;
}
function basePlaceFit(ship, k, p, n, ped, mirror, options={}) {
  const d = FITS[k];
  if(ship.fits.length+(mirror?2:1)>DESIGN_LIMITS.fits)return {err:'装備数の上限は'+DESIGN_LIMITS.fits+'基です'};
  let a = 2;
  if (d.cat === 'b') { if (n[1] < 0.2) return {err: '艦橋は上向きの面に置いてください'}; }
  else { let bv = -2; for (let i = 0; i < 6; i++) { const v = dot(AXES[i], n); if (v > bv) { bv = v; a = i; } } }
  const f = mountFit(ship, {id: nid(ship), k, p: p.slice(), a, ped: ped == null ? 2 : ped,...(options.localMount?{localMount:true}:{})});
  if (f.float) return {err: '取り付ける面が見つかりません'};
  const clash = fitClash(ship, f); if (clash) return {err: clash};
  ship.fits.push(f);
  if (mirror && Math.abs(f.p[2]) > d.r) {
    const am = a === 4 ? 5 : a === 5 ? 4 : a;
    const g = mountFit(ship, {id: nid(ship), k, p: mirrorP(f.p), a: am, ped: f.ped,...(f.localMount?{localMount:true}:{})});
    if (!g.float && !fitClash(ship, g)) { g.tw = f.id; f.tw = g.id; ship.fits.push(g); }
  }
  return {fit: f};
}
function fitClash(ship, f) {
  const b = fitAABB(f), d = FITS[f.k];
  for (const g of ship.fits) {
    if (g === f) continue;
    const c = fitAABB(g);
    const ox = Math.min(b[3], c[3]) - Math.max(b[0], c[0]), oz = Math.min(b[5], c[5]) - Math.max(b[2], c[2]), oy = Math.min(b[4], c[4]) - Math.max(b[1], c[1]);
    if (ox > d.r * 0.3 && oz > d.r * 0.3 && oy > 0) return 'ほかの装備と干渉します';
  }
  return null;
}
// A client ship (the editor's copy) receives mounts and clipped volumes from
// the background engine; it never recomputes them on the interface thread.
function remount(ship) {
  if(ship._client)return;
  // Mounting never changes the hull, so one locked cache serves every fitting.
  syncAviationSurfaces(ship);const old=ship._lockedCache;ship._lockedCache=cache(ship);
  try{for (const f of ship.fits) mountFit(ship, f);}finally{if(old)ship._lockedCache=old;else delete ship._lockedCache;}
}
function removeItem(ship, listName, id, mirror) {
  const list = ship[listName], it = list.find(q => q.id === id); if (!it) return;
  const ids = new Set([id]); if (mirror && it.tw) ids.add(it.tw);
  ship[listName] = list.filter(q => !ids.has(q.id));
  if(listName==='parts')ship.hatches=ship.hatches.filter(h=>!ids.has(h.bay));
  for (const q of ship[listName]) { if (ids.has(q.tw)) delete q.tw; if (ids.has(q.vt)) delete q.vt; }
}
function keelAt(ship, x) {
  if (x < 0 || x > ship.hull.L) return null;
  const sb = sectionBase(ship.hull, x), kc = KEELS[ship.keel] || KEELS.std;
  const w = Math.min(ship.hull.W * kc.w, sb.hw * 2 * 0.8), hgt = Math.min(ship.hull.H * kc.h, sb.h * 0.8);
  if (w <= 0 || hgt <= 0) return null;
  return {w, h: hgt, y0: sb.ybot, y1: sb.ybot + hgt};
}
// pack cubes into the free interior (自動充填)
function fillHangars(ship, size, x0f, x1f, mirror, ylimit) {
  const hp = ship.hull, e = size, h = e / 2, m = Math.max(3, e * 0.06);
  let placed = 0;
  const reserved = allOccupied(ship);
  const free = (c) => {
    for (const s of [[-1, -1, -1], [1, -1, -1], [-1, 1, -1], [1, 1, -1], [-1, -1, 1], [1, -1, 1], [-1, 1, 1], [1, 1, 1], [0, 0, 0], [0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) {
      if (!inHull(ship, [c[0] + s[0] * (h + m), c[1] + s[1] * (h + m), c[2] + s[2] * (h + m)])) return false;
    }
    const bb = [c[0] - h, c[1] - h, c[2] - h, c[0] + h, c[1] + h, c[2] + h];
    for (const pt of reserved) {
      if (pt.k === 'struct') continue;
      if(pt.k==='machinery'||pt.boxSize){if(overlapParts({k:'hangar',d:e,c},pt))return false;continue;}
      const b = partAABB(pt);
      if (bb[0] < b[3] - 0.5 && bb[3] > b[0] + 0.5 && bb[1] < b[4] - 0.5 && bb[4] > b[1] + 0.5 && bb[2] < b[5] - 0.5 && bb[5] > b[2] + 0.5) {
        if (PARTS[pt.k].shape === 'sphere') { const q = [clamp(pt.c[0], bb[0], bb[3]), clamp(pt.c[1], bb[1], bb[4]), clamp(pt.c[2], bb[2], bb[5])]; if (len(sub(q, pt.c)) >= pt.d / 2) continue; }
        return false;
      }
    }
    const kb = keelAt(ship, c[0]);
    if (kb && bb[1] < kb.y1 && Math.abs(c[2]) - h < kb.w / 2) return false;
    if (ylimit != null && c[1] + h > ylimit) return false;
    return true;
  };
  const xa = hp.L * x0f, xb = hp.L * x1f, zs = [0];
  for (let z = e; z <= hp.W / 2; z += e) { zs.push(z); if (!mirror) zs.push(-z); }
  for (let x = xa + h + m; x + h <= xb; x += e) {
    const sb = sectionBase(hp, x), ymax = sb.ytop + hp.H * 0.1;
    for (const z of zs) {
      let y = sb.ybot + h + m;
      while (y + h <= ymax) {
        const c = [x, y, z];
        if (free(c) && (!mirror || z<.5 || free(mirrorP(c)))) { const before=ship.parts.length; placePart(ship, 'hangar', c, e, {}, mirror && z > 0.5); reserved.push(...ship.parts.slice(before)); placed+=ship.parts.length-before; y += e; }
        else y += e / 6;
      }
    }
  }
  return placed;
}

// ---------- performance model ----------
function baseComputeStats(ship) {
  const g = hullGeo(ship), hp = ship.hull, L = hp.L;
  const hf = heightfield(ship), obst = obstacles(ship);
  const nb = 120, bins = new Float64Array(nb), dxb = L / nb, strA = new Float64Array(nb);
  const binOf = (x) => clamp(Math.floor(x / dxb), 0, nb - 1);
  for (let i = 0; i + 1 < g.xs.length; i++) {
    const xm = (g.xs[i] + g.xs[i + 1]) / 2, v = (g.secs[i].area + g.secs[i + 1].area) / 2 * (g.xs[i + 1] - g.xs[i]);
    bins[binOf(xm)] += v * K.hullDens;
  }
  // Keep the existing longitudinal mass distribution, normalized to the
  // remaining volume of the cut shell instead of the original loft volume.
  if(ship.solidCuts?.length){const mass=bins.reduce((a,b)=>a+b,0),scale=mass>0?g.volume*K.hullDens/mass:0;for(let i=0;i<nb;i++)bins[i]*=scale;}
  const hullBins=bins.slice(); bins.fill(0);
  const occupied=allOccupied(ship), physical=[...ship.parts.filter(p=>p.k==='struct'),...occupied], accepted=[], acceptedBounds=[];
  const inAccepted=p=>{for(let i=0;i<accepted.length;i++){const b=acceptedBounds[i];if(p[0]>=b[0]-1e-4&&p[0]<=b[3]+1e-4&&p[1]>=b[1]-1e-4&&p[1]<=b[4]+1e-4&&p[2]>=b[2]-1e-4&&p[2]<=b[5]+1e-4&&inPart(accepted[i],p))return true;}return false;};
  const invalid=new Set();
  for(let i=0;i<occupied.length;i++)for(let j=i+1;j<occupied.length;j++){
    const a=occupied[i],b=occupied[j];
    if((a.k==='machinery'&&(b.id===a.reactor||b.id===a.nozzle||b.k==='machinery'))||(b.k==='machinery'&&(a.id===b.reactor||a.id===b.nozzle)))continue;
    if(overlapParts(a,b)){invalid.add(a.id);invalid.add(b.id);}
  }
  const demands=new Map();for(const e of ship.parts.filter(p=>p.k==='engine'&&!invalid.has(p.id))){const r=reactorFor(ship,e);if(r)demands.set(r.id,(demands.get(r.id)||0)+nozzleDemand(e));}
  let crew = 0, cost = 0, hpSum = 0;
  let Vgen = 0, Vsh = 0, Vhyp = 0, Veng = 0, ventEng = 0, engN = 0, Vhang = 0, Vstruct = 0, structOut = 0, Vint = 0;
  let reactorOutput=0,availableThrust=0,engineDemand=0,shieldCapacity=0,hyperEffectiveVolume=0;
  let exposedArea = 0, critExp = 0, critN = 0, critProt = 0, genExpFrac = 0, floating = 0, overlap = 0, citArea = 0;
  const info = {}, hangars = [];
  for (const pt of physical) {
    const d = PARTS[pt.k], V = partVolume(pt), vs = volSamples(pt);
    let inH = 0, inE = 0, newHull = 0;
    for (const p of vs) { const h = inHull(ship, p),material=hullMaterialContains(ship,p,h); if (material) {inH++;if(!inAccepted(p))newHull++;} if (h || inEnv(ship, p, pt)) inE++; }
    const fH = vs.length ? inH / vs.length : 0, fE = vs.length ? inE / vs.length : 0;
    const ss = surfSamples(pt); let out = 0; for (const p of ss) if (!inEnv(ship, p, pt)) out++;
    const expF = ss.length ? out / ss.length : 1, A = partArea(pt);
    info[pt.id] = {inside: fE, inHull: fH, exposed: expF, overlap:invalid.has(pt.id)};
    exposedArea += A * expF;
    if (pt.k === 'struct') {
      const vOut = V * (1 - fH), m = V*.08 + vOut*(K.structDens-.08);
      Vstruct += V; structOut += vOut; hpSum += m * 1.5; cost += V * d.cost; crew += V * d.crew / 1000;
      const b = structBox(pt);
      for (let k = binOf(b.x0); k <= binOf(b.x1); k++) { strA[k] += b.w * b.h * (1 - b.tp * 0.5) * .12; bins[k] += m * Math.min(1, dxb / Math.max(1, b.l)); }
      continue;
    }
    const m = V * d.dens; hpSum += m * d.hp; cost += V * d.cost; crew += V * d.crew / 1000; Vint += V * newHull/Math.max(1,vs.length);
    const ab = partAABB(pt), k0 = binOf(ab[0]), k1 = binOf(ab[3]), span = k1 - k0 + 1;
    for (let k = k0; k <= k1; k++) {bins[k]+=m/span;hullBins[k]-=V*newHull/Math.max(1,vs.length)*K.hullDens/span;} accepted.push(pt); { const pad = Math.max(ab[3] - ab[0], ab[4] - ab[1], ab[5] - ab[2]) * .05; acceptedBounds.push([ab[0] - pad, ab[1] - pad, ab[2] - pad, ab[3] + pad, ab[4] + pad, ab[5] + pad]); }
    if (V > 0 && fE < 0.02 && expF > 0.98 && !attachedEngine(ship,pt)) floating++;
    if (d.crit) {
      critN += V; critExp += V * expF; citArea += A;
      const sh = surfSamples(pt, 14); let deep = 0; for (const p of sh) if (inEnv(ship, p, pt)) deep++;
      critProt += V * deep / Math.max(1,sh.length);
      if (pt.k === 'gen') genExpFrac = Math.max(genExpFrac, expF);
    }
    if (invalid.has(pt.id)) continue;
    if (isReactor(pt)) {Vgen+=V;reactorOutput+=reactorPower(pt);}
    else if (pt.k === 'shield'||pt.k==='localShield') {Vsh += V;shieldCapacity+=shieldLoad(pt);}
    else if (pt.k === 'hyper') {Vhyp += V;hyperEffectiveVolume+=hyperCapacity(pt);}
    else if (pt.k === 'hangar'||pt.k==='service') { if(pt.k==='hangar')Vhang += V; hangars.push({pt, b: ab, expF, A, acc: false}); }
    else if (pt.k === 'engine') {
      engN++; Veng += V;
      const source=reactorFor(ship,pt),path=enginePaths(ship).find(r=>r.nozzle===pt.id);
      let ok=!!source&&engineVented(ship,pt)&&!invalid.has(source.id)&&(!path||!invalid.has(path.id));
      info[pt.id].vent=ok;info[pt.id].reactor=source?.id||null;
      if(ok){const cap=reactorPower(source),rate=Math.min(1,cap/Math.max(1,demands.get(source.id)));ventEng+=V;availableThrust+=nozzleThrust(pt)*rate;engineDemand+=nozzleDemand(pt)*rate;info[pt.id].powerRatio=rate;}
    }
  }
  const solids=occupied;
  overlap=invalid.size;
  for(let k=0;k<nb;k++)bins[k]+=Math.max(0,hullBins[k]);
  for (let k = 0; k < nb; k++) {
    const x = (k + 0.5) * dxb, kb = keelAt(ship, x), sbA = sectionBase(hp, x);
    let ka = kb ? kb.w * kb.h : 0;
    if (kb) for (const pt of solids) {
      const ab = partAABB(pt); if (x < ab[0] || x > ab[3]) continue;
      const oy = Math.min(ab[4], kb.y1) - Math.max(ab[1], kb.y0), oz = Math.min(ab[5], kb.w / 2) - Math.max(ab[2], -kb.w / 2);
      if (oy > 0 && oz > 0) ka -= oy * oz * (PARTS[pt.k].shape === 'sphere' ? 0.7 : 1);
    }
    strA[k] += Math.max(0, ka) + K.framing * (sbA.hw * 2 * sbA.h) + ship.armor.hull * (sbA.hw * 2 + sbA.h) * 0.3;
  }
  // hatches and hangar access
  let openA = 0, rayA = 0, rayAll = 0, deadHatch = 0;
  const hatchInfo = {};
  for (const h of ship.hatches) {
    if(!aviationHatchActive(ship,h)){hatchInfo[h.id]={connected:false,area:0};continue;}
    const grid = hatchGrid(ship, h); let connected = false;
    if (h.k === 'ray') rayAll += grid.area;
    if(h.bay){const H=hangars.find(H=>H.pt.id===h.bay);if(H){H.acc=true;connected=true;}}
    if(h.portal&&h.open===0){hatchInfo[h.id]={connected,area:0};continue;}
    for (let q = 0; q < grid.pts.length; q += 2) {
      const p = grid.pts[q]; if (!p) continue;
      for (let s = 1; s <= 6; s++) {
        const r = sub(p, mul(h.n, s * 10));
        for (const H of hangars) if (r[0] >= H.b[0] && r[0] <= H.b[3] && r[1] >= H.b[1] && r[1] <= H.b[4] && r[2] >= H.b[2] && r[2] <= H.b[5] && inPart(H.pt,r)) { H.acc = true; connected = true; }
      }
    }
    hatchInfo[h.id] = {connected, area: grid.area};
    if (connected) { if (h.k === 'ray') rayA += grid.area; else openA += grid.area; } else deadHatch++;
  }
  // A room touching the hull is not an opening. Only a real hatch seeds access.
  let changed = true;
  while (changed) {
    changed = false;
    for (const a of hangars) if (a.acc) for (const b of hangars) if (!b.acc) {
      if (aviationConnected(a.pt,b.pt)) { b.acc = true; changed = true; }
    }
  }
  let Vacc = 0; for (const H of hangars) { info[H.pt.id].acc = H.acc; if (H.acc&&H.pt.k==='hangar') Vacc += partVolume(H.pt); }
  const aviation=aviationStatus(ship,info),slots=aviation.embarkedCount,chargeInfo=chargingStatus(ship,invalid);
  // fittings
  const alpha = [0, 0, 0, 0, 0, 0], ionS = [0, 0, 0, 0, 0, 0], alphaRate=[0,0,0,0,0,0],ionRate=[0,0,0,0,0,0];
  let alphaTot = 0, ionTot = 0, aa = 0, mslSalvo = 0, tractors = 0, wPower = 0, bPower = 0, bridges = 0, sensor = 0, viewSum = 0, floatFits = 0, pedVol = 0;
  const commandInfo=commandStatus(ship,invalid),fitInfo = {};
  for (const f of ship.fits) {
    const raw=fitSpec(f),cr=needsCapacitor(f)?(chargeInfo[f.id]?.ratio||0):1,d={...raw,power:raw.power*cr,tt:(raw.tt||0)*cr,ion:(raw.ion||0)*cr};
    if (f.float) floatFits++;
    const ph = Math.max(0, f.base + f.ped - (f.low || 0)), pr = d.r * 0.8, pv = Math.PI * pr * pr * ph; pedVol += pv;
    const m = d.mass + pv * 0.3; crew += d.crew; cost += d.cost;
    bins[binOf(f.p[0])] += m;
    if (d.cat === 'w') {
      if(f.float)continue;
      wPower += d.power;
      if (d.tt || d.ion || d.aa) {
        const arc = fireArcs(ship, f, hf, obst); fitInfo[f.id] = arc;
        const mean = arc.reduce((a, b) => a + b, 0) / 6;
        for (let k = 0; k < 6; k++) { if (d.tt){alpha[k] += d.tt * arc[k];alphaRate[k]+=d.tt*arc[k]/(d.cycle||K.cycle);}if (d.ion){ionS[k] += d.ion * arc[k];ionRate[k]+=d.ion*arc[k]/(d.cycle||K.cycle);} }
        if (d.tt) alphaTot += d.tt; if (d.ion) ionTot += d.ion; if (d.aa) aa += d.aa * Math.min(1, mean * 1.6);
      }
      if (d.msl) mslSalvo += d.msl; if (d.trac) tractors++;
    } else if(!f.float && (!d.window || d.role==='bridge'||d.role==='combat')) {
      const effective=d.window?(commandInfo[f.id]?.ratio||0):1;if(effective<=0)continue;
      bridges++; bPower += d.power*effective;
      const vw = bridgeView(ship, f, hf, obst)*effective; fitInfo[f.id] = vw; viewSum += vw; sensor += d.sensor * (0.5 + 0.5 * vw)*effective;
    }
  }
  // Model bridge bodies command from their own drum or window band.
  for(const f of intrinsicCommandFits(ship)){const d=FITS[f.k];if(d.role!=='bridge'&&d.role!=='combat')continue;const effective=commandInfo[f.id]?.ratio||0;if(effective<=0)continue;bridges++;bPower+=d.power*effective;const vw=bridgeView(ship,f,hf,obst)*effective;fitInfo[f.id]=vw;viewSum+=vw;sensor+=d.sensor*(0.5+0.5*vw)*effective;}
  for(const p of ship.parts)if(p.k==='command'&&!invalid.has(p.id)){const ratio=clamp(partVolume(p)/Math.max(1,unclippedPartVolume(p)),0,1);if(ratio<=0)continue;bridges++;sensor+=.7*ratio;viewSum+=.7*ratio;bPower+=4e20*ratio;}
  // armour
  const area = exposedSurface(ship,occupied);
  const armorArea=armoredMaterialArea(ship,area),armHull = ship.armor.hull * armorArea * K.armorDens, armCit = ship.armor.cit * citArea * K.armorDens;
  let perSum = 0; const per = new Float64Array(nb);
  for (let k = 0; k < nb; k++) { const sb = sectionBase(hp, (k + 0.5) * dxb); per[k] = sb.hw * 2 + sb.h * 2; perSum += per[k]; }
  for (let k = 0; k < nb; k++) bins[k] += perSum > 0 ? armHull * per[k] / perSum : 0;
  for (const pt of ship.parts) if (PARTS[pt.k].crit) bins[binOf(pt.c[0])] += ship.armor.cit * partArea(pt) * K.armorDens;
  const M = bins.reduce((a, b) => a + b, 0);
  hpSum += Math.max(0, g.volume - Vint) * K.hullDens;
  cost += g.volume * 0.6 + (ship.armor.hull * armorArea + ship.armor.cit * citArea) * 30;
  crew += g.volume * 0.3 / 1000 + slots * 3;
  // power
  const P = reactorOutput, thrust = availableThrust;
  const De = engineDemand, Ds = Vsh>0 ? area*K.shieldStd*(ship.shieldTarget||1) : 0, Dw = wPower;
  const Dh = (g.volume + Vstruct) * K.hotelW + bPower, Dr = rayAll * K.rayW, Dj = hyperEffectiveVolume * K.hyperW;
  const coreNeed=Ds+.35*De+Dh+Dr,coreRate=coreNeed>0?Math.min(1,P/coreNeed):1,weaponBudget=Math.max(0,P-coreNeed),rc=Dw>0?Math.min(1,weaponBudget/Dw):1;
  const needM = De + 0.5 * Ds + Dh + Dr, rm = needM > 0 ? Math.min(1, P / needM) : 1;
  const jumpOK = hyperEffectiveVolume > 0 && P >= Dj + Dh + 0.3 * Ds;
  const aThrust = M > 0 ? rm * thrust / (M * 1000) : 0;
  let mAft = 0, worst = Infinity, worstX = null, cut = false;
  for (let k = 0; k + 1 < nb; k++) {
    mAft += bins[k];
    const dem = Math.min(mAft, M - mAft); if (dem <= M * 0.01) continue;
    const A2 = Math.min(strA[k], strA[k + 1]); if (A2 <= 1e-6) cut = true;
    const r = A2 / dem; if (r < worst) { worst = r; worstX = (k + 1) * dxb; }
  }
  const aStruct = worst === Infinity ? 1e9 : K.sigma * worst / 1000;
  const aEff = Math.min(aThrust, aStruct);
  const shieldP = Math.min(coreRate * Ds,Vsh*K.shieldW), shieldPct = area > 0 ? shieldP / area / K.shieldStd : 0;
  const launch = openA * K.launchOpen + rayA * K.launchRay;
  const alphaBest = Math.max(...alpha), alphaMean = alpha.reduce((a, b) => a + b, 0) / 6;
  const cit = ship.armor.cit, protectedFrac = critN ? critProt / critN : 1, expo = critN ? critExp / critN : 0;
  const vuln = clamp(0.45 * (1 - protectedFrac) + 0.35 * expo / (1 + cit) + 0.2 * Math.min(1, openA / Math.max(1, area) * 8), 0, 1);
  const view = bridges ? viewSum / bridges : 0;
  const accuracy = bridges ? clamp(0.45 + 0.35 * Math.min(1, sensor) + 0.1 * Math.min(2, bridges) / 2, 0.3, 0.92) : 0.3;
  const volume = g.volume + structOut;
  const habit = crew > 0 ? Math.max(0, g.volume - Vint) * 0.5 / (crew * K.crewM3) : 9;
  let ymin = Infinity, ymax = -Infinity, zmax = 0, xmin = 0, xmax = L;
  for (const s of g.secs) for (let j = 0; j < s.Y.length; j++) { ymin = Math.min(ymin, s.Y[j]); ymax = Math.max(ymax, s.Y[j]); zmax = Math.max(zmax, Math.abs(s.Z[j])); }
  for (const pt of ship.parts) { const b = partAABB(pt); xmin = Math.min(xmin, b[0]); xmax = Math.max(xmax, b[3]); ymin = Math.min(ymin, b[1]); ymax = Math.max(ymax, b[4]); zmax = Math.max(zmax, Math.abs(b[2]), Math.abs(b[5])); }
  for (const f of ship.fits) { const b = fitAABB(f); ymin = Math.min(ymin, b[1]); ymax = Math.max(ymax, b[4]); zmax = Math.max(zmax, Math.abs(b[2]), Math.abs(b[5])); }
  const rb=referenceHullGeometry(ship)?.bounds;if(rb){xmin=Math.min(xmin,rb[0]);ymin=Math.min(ymin,rb[1]);zmax=Math.max(zmax,Math.abs(rb[2]),Math.abs(rb[5]));xmax=Math.max(xmax,rb[3]);ymax=Math.max(ymax,rb[4]);}
  for(const p of ship.parts){const b=refPartBounds(p);if(b){xmin=Math.min(xmin,b[0]);ymin=Math.min(ymin,b[1]);zmax=Math.max(zmax,Math.abs(b[2]),Math.abs(b[5]));xmax=Math.max(xmax,b[3]);ymax=Math.max(ymax,b[4]);}}
  const S = {
    volume, area, VS: area > 0 ? volume / area : 0, hullVolume: ship.hull.assembly?volume:g.volume, hullArea: ship.hull.assembly?area:g.area,
    mass: M, armorMass: armHull + armCit, dims: [xmax - xmin, zmax * 2, ymax - ymin], hullLen: L,
    power: P, xISD: P / ISD_W, draw: {weapons: Dw, shields: Ds, engines: De, hotel: Dh, ray: Dr, jump: Dj},
    rc, coreRate,weaponBudget,chargeInfo, rm, jumpOK, thrust, aThrust, aStruct, aEff, accelG: aEff / G0, thrustG: aThrust / G0, structG: aStruct / G0,
    weakAt: worstX, cutSection: cut, structLimited: aStruct < aThrust, MGLT: Math.round(aEff / G0 / 30),
    engN, ventEng, Veng, hyperEffectiveVolume, hyperClass: hyperEffectiveVolume > 0 ? clamp(K.hyperK * M / hyperEffectiveVolume, 0.5, 30) : null,
    shieldP, shieldPct, shieldCapacity:shieldCapacity*coreRate, shieldTarget:ship.shieldTarget||1, armorHull: ship.armor.hull, armorCit: cit, armorAvg: ship.armor.hull,
    slots, aviation, deployableSlots:aviation.deployableCount, launch, launchTime: launch > 0 && aviation.deployableCount > 0 ? aviation.deployableCount / launch : null, Vhang, Vacc, openA, rayA, deadHatch,
    alphaRate,ionRate,alpha, alphaTot, alphaBest, alphaMean, ionBest: Math.max(...ionS), ionMean: ionS.reduce((a, b) => a + b, 0) / 6, ionTot, aa, mslSalvo, tractors,
    arcEff: alphaTot > 0 ? alphaBest / alphaTot : 0,
    commandInfo, bridges, view, accuracy, sensor, protectedFrac, critExpo: expo, genExpFrac, vuln,
    hp: hpSum * K.hpPerT + (armHull + armCit) * 0.2 * K.hpPerT, crew: Math.round(crew), habit, cost,
    floating, floatFits, overlap, info, fitInfo, hatchInfo, pedVol,
    frac: {gen: Vgen / Math.max(1, ship.hull.assembly?volume:g.volume), engine: Veng / Math.max(1, ship.hull.assembly?volume:g.volume), hyper: Vhyp / Math.max(1, ship.hull.assembly?volume:g.volume), shield: Vsh / Math.max(1, ship.hull.assembly?volume:g.volume), hangar: Vhang / Math.max(1, ship.hull.assembly?volume:g.volume), struct: Vstruct / Math.max(1, ship.hull.assembly?volume:g.volume)},
    Vgen, Vsh, Vhyp,
  };
  S.cls = classify(S);
  S.warnings = warnings(S);
  return S;
}
const CLASSES = [[0, 'コルベット'], [150, 'スター・フリゲート'], [760, '軽スター・デストロイヤー'], [2500, 'スター・デストロイヤー'],
  [5500, '重スター・デストロイヤー'], [12000, '巡洋戦艦'], [40000, 'スター・クルーザー'], [200000, 'スター・ドレッドノート']];
function classify(S) {
  let name = CLASSES[0][1]; for (const [th, nm] of CLASSES) if (S.alphaTot >= th) name = nm;
  const hf = S.hullVolume > 0 ? S.Vacc / S.hullVolume : 0;
  let role;
  if (hf >= 0.22) role = '航宙母艦'; else if (hf >= 0.09) role = '打撃空母';
  else if (S.alphaTot <= 0) role = S.slots > 0 ? '支援艦' : '非武装';
  else if (S.accelG >= 3000) role = '高速'; else if (S.armorHull >= 1.2) role = '重装'; else role = '砲戦';
  return {name, role, hangarFrac: hf};
}
function warnings(S) {
  const w = [], add2 = (lv, text) => w.push({lv, text});
  if (S.Vgen <= 0) add2('bad', 'ジェネレーターがありません。出力ゼロでは何も動きません。');
  if (S.engN === 0) add2('bad', 'エンジンがありません。');
  else if (S.ventEng <= 0) add2('bad', 'どのエンジンも噴射口が船内に埋まっています。後端を船外に出してください。');
  else if (S.ventEng < S.Veng * 0.999) add2('warn', '噴射口が塞がったエンジンがあります（推力に寄与しません）。');
  if (S.bridges === 0) add2('bad', '艦橋がありません。命中率が大きく落ちます。');
  if (S.floating) add2('bad', `船体から離れて浮いている区画が ${S.floating} 個あります。`);
  if (S.floatFits) add2('bad', `取り付け面を失った装備が ${S.floatFits} 基あります。`);
  if (S.overlap) add2('warn', `重なり合っている区画があります（${S.overlap} 区画）。`);
  if (S.cutSection) add2('bad', '竜骨と構造物が途切れた断面があります。縦強度がゼロです。');
  if (S.Vgen > 0 && S.coreRate < 0.999) add2('warn', `生命維持・シールド・機関への給電が不足しています（稼働率 ${Math.round(S.coreRate * 100)}%）。`);
  else if(S.Vgen>0&&S.rc<.999)add2('info',`兵装の充電速度は機械的な最大連射の ${Math.round(S.rc*100)}%。余剰電力に応じて再充電します。`);
  if (S.structLimited && S.ventEng > 0) add2('warn', `縦強度が推力に耐えられず、加速を ${Math.round(S.aStruct / Math.max(1e-9, S.aThrust) * 100)}% に抑えています。構造物を足すか質量を削ってください。`);
  if (S.Vsh <= 0) add2('warn', 'シールド発生器がありません。'); else if (S.shieldPct < (S.shieldTarget||1)*.999) add2('warn', `シールドが目標強度の ${Math.round(S.shieldPct/(S.shieldTarget||1)*100)}% です。発生器の容量と給電を確認してください。`);
  if (S.Vhyp <= 0) add2('info', 'ハイパードライブがありません（星系内専用艦）。'); else if (!S.jumpOK) add2('warn', '跳躍に必要な電力が足りません。');
  if (S.genExpFrac > 0.02) add2(S.armorCit > 0 ? 'info' : 'warn', `ジェネレーターの表面の ${Math.round(S.genExpFrac * 100)}% が露出しています。構造物で覆うか集中防御で守れます。`);
  if (S.Vhang > S.Vacc + 1) add2('warn', 'ハッチに通じていない航空区画があります。');
  if (S.deadHatch) add2('info', '航空区画につながっていないハッチがあります。');
  if (S.habit < 1) add2('warn', `居住区画が不足しています（必要量の ${Math.round(S.habit * 100)}%）。`);
  if (S.alphaTot > 0 && S.arcEff < 0.45) add2('info', `主射界に指向できる火力が ${Math.round(S.arcEff * 100)}% です。支持台を高くするか舷側に寄せると射界が開けます。`);
  return w;
}

// ---------- serialization ----------
function baseSerialize(ship) {
  const o = {format: 'starship-yard', v: 2};
  for (const k of ['name', 'hull', 'keel', 'cuts', 'subs', 'parts', 'hatches', 'fits', 'armor', 'nextId']) o[k] = ship[k];
  return JSON.parse(JSON.stringify(o));
}
function baseDeserialize(o) {
  if (!o || o.format !== 'starship-yard') throw new Error('設計図の形式が違います');
  if (o.v !== 2) throw new Error('旧形式（ブロック版）の設計図は読み込めません');
  const s = newShip(o.hull, o.name);
  for (const k of ['keel', 'cuts', 'subs', 'parts', 'hatches', 'fits', 'armor', 'nextId']) if (o[k] != null) s[k] = JSON.parse(JSON.stringify(o[k]));
  s.parts = s.parts.filter(p => PARTS[p.k]); s.fits = s.fits.filter(f => FITS[f.k]);
  let mx = 0; for (const l of [s.parts, s.hatches, s.fits, s.cuts, s.subs]) for (const q of l) mx = Math.max(mx, q.id || 0);
  s.nextId = Math.max(s.nextId || 1, mx + 1);
  return s;
}

// ---------- programmatic designs (sample and exercise opponents) ----------
function deckPoint(ship, x, z, bottom) {
  const big = ship.hull.H * 3 + 400;
  return rayEnv(ship, [x, bottom ? -big : big, z], [0, bottom ? 1 : -1, 0], {maxT: big * 3});
}
function sidePoint(ship, x, y, sgn) {
  const big = ship.hull.W * 2 + 400;
  return rayEnv(ship, [x, y, sgn * big], [0, 0, -sgn], {maxT: big * 3});
}
function gunsDeck(ship, key, ts, zfs, budget, bottom, ped) {
  let tt = 0;
  for (const t of ts) for (const zf of zfs) {
    if (budget != null && tt >= budget) return tt;
    const x = ship.hull.L * t, sb = sectionBase(ship.hull, x);
    const h = deckPoint(ship, x, zf * sb.hw, bottom); if (!h) continue;
    const r = placeFit(ship, key, h.p, h.n, ped == null ? 2 : ped, true);
    if (r.fit) tt += (FITS[key].tt || 0) * (r.fit.tw ? 2 : 1);
  }
  return tt;
}
function gunsSide(ship, key, ts, yf) {
  for (const t of ts) {
    const x = ship.hull.L * t, sb = sectionBase(ship.hull, x);
    const h = sidePoint(ship, x, sb.ybot + (sb.ytop - sb.ybot) * yf, 1); if (h) placeFit(ship, key, h.p, h.n, 1, true);
  }
}
function sternEngines(ship, specs) {
  for (const [zf, yf, d] of specs) {
    const sb = sectionBase(ship.hull, 0), l = d * PARTS.engine.ratio;
    placePart(ship, 'engine', [l / 2 - l * 0.32, sb.ybot + (sb.ytop - sb.ybot) * yf, zf * sb.hw], d, {}, true);
  }
}
function superstructure(ship, t0, t1, wf, h, taper) {
  const x0 = ship.hull.L * t0, x1 = ship.hull.L * t1, xm = (x0 + x1) / 2, sb = sectionBase(ship.hull, xm);
  const hit = deckPoint(ship, xm, 0), y = hit ? hit.p[1] : sb.ytop, sink = Math.min(h * 0.5, 30);
  return placePart(ship, 'struct', [xm, y + h / 2 - sink, 0], [x1 - x0, ship.hull.W * wf, h], {taper: taper || 0}, false);
}
function hatchStrip(ship, t0, t1, w, k, bottom, zf) {
  const za = zf ? zf * sectionBase(ship.hull, ship.hull.L * t0).hw : 0, zb = zf ? zf * sectionBase(ship.hull, ship.hull.L * t1).hw : 0;
  const pa = deckPoint(ship, ship.hull.L * t0, za, bottom), pb = deckPoint(ship, ship.hull.L * t1, zb, bottom);
  if (!pa || !pb) return;
  const h = {id: nid(ship), k, a: pa.p, b: pb.p, n: pa.n, w};
  ship.hatches.push(h);
  if (zf) { const m = {id: nid(ship), k, a: mirrorP(pa.p), b: mirrorP(pb.p), n: mirrorP(pa.n), w, tw: h.id}; h.tw = m.id; ship.hatches.push(m); }
}
function hyperAft(ship, d, y) {
  let x1 = 0; for (const p of ship.parts) if (p.k === 'engine' && Math.abs(p.c[2]) < 1) x1 = Math.max(x1, partAABB(p)[3]);
  const l = d * PARTS.hyper.ratio; return placePart(ship, 'hyper', [x1 + l / 2 + 6, y, 0], d, {}, false);
}
function powerTT(ship, frac) {return frac*ship.parts.filter(isReactor).reduce((n,p)=>n+reactorPower(p),0)*K.cycle/TT;}
const DESIGNS = {
  sample: {name: '試作駆逐艦 SY-01', hull: {plan: 'arrow', sec: 'roof', L: 880, W: 440, H: 160, bowW: 0, bowH: 0.45, stern: 0.65, keel: 'std'}, build(s) {
    s.cuts.push({id: nid(s), side: 'both', edge: 'top', inset: 70, slope: 60, from: 0.05, to: 1, prop: true});
    sternEngines(s, [[0, 0.5, 70], [0.42, 0.5, 52], [0.75, 0.45, 34]]);
    placePart(s, 'gen', [s.hull.L * 0.24, 118, 0], 120, {}, false);
    const st = superstructure(s, 0.15, 0.33, 0.32, 84, 0.2);
    hyperAft(s, 44, 60);
    placePart(s, 'shield', [s.hull.L * 0.13, 55, 115], 34, {}, true);
    s.armor = {hull: 0.45, cit: 0.6};
    fillHangars(s, 30, 0.42, 0.68, true, 72);
    hatchStrip(s, 0.45, 0.66, 50, 'ray', true, 0.42);
    const bh = deckPoint(s, st.c[0] + st.s[0] * 0.18, 0); if (bh) placeFit(s, 'brT', bh.p, bh.n, 2, false);
    const tt = powerTT(s, 0.55);
    let used = gunsDeck(s, 'htl', [0.38, 0.48, 0.58, 0.68], [0.5], tt * 0.7, false, 3);
    used += gunsDeck(s, 'mtl', [0.30, 0.42, 0.54, 0.66, 0.78], [0.82], tt - used, false, 3);
    gunsDeck(s, 'ltl', [0.8, 0.87], [0], Math.max(0, tt - used), false, 2);
    gunsSide(s, 'pd', [0.2, 0.34, 0.5, 0.64, 0.78], 0.25);
  }},
  frigate: {name: '哨戒艦', hull: {plan: 'rect', sec: 'rect', L: 320, W: 90, H: 72, bowW: 0.5, bowH: 0.7, stern: 1, keel: 'std'}, build(s) {
    s.cuts.push({id: nid(s), side: 'both', edge: 'both', inset: 16, slope: 22, from: 0, to: 1, prop: false});
    sternEngines(s, [[0, 0.5, 30], [0.55, 0.5, 18]]);
    placePart(s, 'gen', [s.hull.L * 0.27, 40, 0], 56, {}, false);
    hyperAft(s, 18, 36);
    placePart(s, 'shield', [s.hull.L * 0.36, 40, 22], 16, {}, true);
    const st = superstructure(s, 0.2, 0.34, 0.3, 18, 0.2);
    const bh = deckPoint(s, st.c[0], 0); if (bh) placeFit(s, 'brS', bh.p, bh.n, 1, false);
    s.armor = {hull: 0.2, cit: 0};
    gunsDeck(s, 'ltl', [0.45, 0.6, 0.75], [0], powerTT(s, 0.6), false, 1);
    gunsSide(s, 'pd', [0.25, 0.5, 0.75], 0.5);
  }},
  destroyer: {name: '軽駆逐艦', hull: {plan: 'wedge', sec: 'rect', L: 1050, W: 520, H: 170, bowW: 0.02, bowH: 0.5, stern: 1, keel: 'std'}, build(s) {
    s.cuts.push({id: nid(s), side: 'both', edge: 'top', inset: 60, slope: 60, from: 0, to: 1, prop: true});
    sternEngines(s, [[0, 0.5, 80], [0.38, 0.5, 64], [0.7, 0.45, 40]]);
    placePart(s, 'gen', [s.hull.L * 0.22, 112, 0], 160, {}, false);
    const st = superstructure(s, 0.12, 0.3, 0.2, 60, 0.2);
    hyperAft(s, 56, 85);
    placePart(s, 'shield', [s.hull.L * 0.1, 80, 150], 38, {}, true);
    s.armor = {hull: 0.5, cit: 0.5};
    fillHangars(s, 45, 0.36, 0.56, true);
    hatchStrip(s, 0.36, 0.6, 50, 'open', false, 0);
    const bh = deckPoint(s, st.c[0], 0); if (bh) placeFit(s, 'brT', bh.p, bh.n, 2, false);
    const tt = powerTT(s, 0.55);
    const used = gunsDeck(s, 'htl', [0.2, 0.3, 0.4, 0.5, 0.6], [0.62], tt * 0.75, false, 3);
    gunsDeck(s, 'mtl', [0.46, 0.56, 0.66, 0.76], [0.35], tt - used, false, 3);
    gunsSide(s, 'pd', [0.2, 0.35, 0.5, 0.65], 0.3);
  }},
  carrier: {name: '打撃空母', hull: {plan: 'wedge', sec: 'trap', L: 1080, W: 520, H: 180, bowW: 0.08, bowH: 0.6, stern: 1, keel: 'std'}, build(s) {
    sternEngines(s, [[0, 0.5, 80], [0.4, 0.5, 60], [0.7, 0.45, 40]]);
    placePart(s, 'gen', [s.hull.L * 0.2, 100, 0], 140, {}, false);
    const st = superstructure(s, 0.1, 0.26, 0.22, 60, 0.2);
    hyperAft(s, 54, 90);
    placePart(s, 'shield', [s.hull.L * 0.09, 80, 140], 38, {}, true);
    s.armor = {hull: 0.45, cit: 0.4};
    fillHangars(s, 45, 0.28, 0.86, true);
    hatchStrip(s, 0.3, 0.84, 80, 'open', false, 0);
    hatchStrip(s, 0.35, 0.75, 70, 'ray', true, 0.5);
    const bh = deckPoint(s, st.c[0], 0); if (bh) placeFit(s, 'brT', bh.p, bh.n, 2, false);
    const tt = powerTT(s, 0.45);
    const used = gunsDeck(s, 'htl', [0.3, 0.45, 0.6], [0.7], tt * 0.6, false, 4);
    gunsDeck(s, 'ltl', [0.36, 0.5, 0.64, 0.78], [0.82], tt - used, false, 3);
    gunsSide(s, 'pd', [0.2, 0.32, 0.44, 0.56, 0.68, 0.8], 0.3);
  }},
  heavy: {name: '重駆逐艦', hull: {plan: 'wedge', sec: 'roof', L: 1600, W: 860, H: 280, bowW: 0.02, bowH: 0.45, stern: 1, keel: 'heavy'}, build(s) {
    sternEngines(s, [[0, 0.5, 130], [0.36, 0.5, 100], [0.66, 0.45, 70]]);
    placePart(s, 'gen', [s.hull.L * 0.22, 170, 0], 250, {}, false);
    const st = superstructure(s, 0.1, 0.32, 0.22, 90, 0.25);
    hyperAft(s, 86, 140);
    placePart(s, 'shield', [s.hull.L * 0.1, 120, 240], 54, {}, true);
    s.armor = {hull: 1.0, cit: 1.0};
    fillHangars(s, 60, 0.42, 0.58, true, 130);
    hatchStrip(s, 0.44, 0.56, 80, 'ray', true, 0.4);
    const bh = deckPoint(s, st.c[0] + st.s[0] * 0.2, 0); if (bh) placeFit(s, 'brL', bh.p, bh.n, 2, false);
    const tt = powerTT(s, 0.62);
    let used = gunsDeck(s, 'stl', [0.14, 0.24, 0.34, 0.44, 0.54, 0.64], [0.55], tt * 0.75, false, 4);
    used += gunsDeck(s, 'mtl', [0.4, 0.5, 0.6, 0.7, 0.8], [0.25], tt - used, false, 3);
    gunsDeck(s, 'ion', [0.36], [0.3], null, false, 3);
    gunsSide(s, 'pd', [0.2, 0.32, 0.44, 0.56, 0.68], 0.25);
  }},
  bc: {name: '巡洋戦艦', hull: {plan: 'arrow', sec: 'roof', L: 2880, W: 1350, H: 480, bowW: 0, bowH: 0.5, stern: 0.7, keel: 'heavy'}, build(s) {
    sternEngines(s, [[0, 0.5, 220], [0.4, 0.5, 180], [0.72, 0.45, 120]]);
    placePart(s, 'gen', [s.hull.L * 0.25, 260, 0], 520, {}, false);
    const st = superstructure(s, 0.12, 0.38, 0.24, 220, 0.25);
    hyperAft(s, 150, 240);
    placePart(s, 'shield', [s.hull.L * 0.1, 200, 380], 84, {}, true);
    s.armor = {hull: 1.0, cit: 1.5};
    const bh = deckPoint(s, st.c[0] + st.s[0] * 0.2, 0); if (bh) placeFit(s, 'brL', bh.p, bh.n, 3, false);
    const tt = powerTT(s, 0.62);
    let used = gunsDeck(s, 'utl', [0.36, 0.46, 0.56, 0.66], [0.4], tt * 0.5, false, 4);
    used += gunsDeck(s, 'stl', [0.16, 0.24, 0.32, 0.6, 0.7, 0.78], [0.62], tt * 0.85 - used, false, 4);
    gunsDeck(s, 'stl', [0.3, 0.45, 0.6], [0.4], tt - used, true, 4);
    gunsSide(s, 'pd', [0.2, 0.3, 0.4, 0.5, 0.6, 0.7], 0.35);
  }},
};
function baseBuildDesign(key) { const d = DESIGNS[key], s = newShip(d.hull, d.name); s.keel = d.hull.keel || 'std'; d.build(s); return s; }

// ---------- engagement simulation ----------
function baseProfile(S, name) {
  return {name, hp: Math.max(1, S.hp), dr: 1 / (1 + S.armorHull), crit: 1 + 0.7 * S.vuln,
    D: S.shieldP / TT * K.deflect, gunBest: S.alphaBest, gunMean: S.alphaMean, ionBest: S.ionBest, ionMean: S.ionMean,
    msl: S.mslSalvo, aa: S.aa, rc: S.rc, acc: S.accuracy, agility: clamp(S.accelG / 3000, 0.08, 0.9),
    trac: S.tractors, slots: Math.floor(S.deployableSlots??S.aviation?.deployableCount??S.slots), launch: S.launch, len: S.hullLen, cls: S.cls};
}
function simulate(A, B, tmax) {
  tmax = tmax || 900;
  const sd = [A, B].map(p => ({p, hp: p.hp, buf: (p.shieldBuffer??p.D*K.bufferS)+(p.reserve||0), buf0: (p.shieldBuffer??p.D*K.bufferS)+(p.reserve||0), launched: 0, queue: [], air: 0, lostF: 0, shDown: false, half: false, allOut: false}));
  const frames = [], events = [], ev = (t, k, text) => events.push({t, side: k, text});
  let end = 0;
  for (let t = 1; t <= tmax; t++) {
    const out = [null, null];
    for (let k = 0; k < 2; k++) {
      const X = sd[k], Y = sd[1 - k], p = X.p, health = 0.35 + 0.65 * Math.max(0, X.hp) / p.hp;
      const w = clamp(p.agility - 0.06 * Y.p.trac, 0.06, 0.9);
      const gun = (w * (p.gunRateBest??p.gunBest/K.cycle) + (1 - w) * (p.gunRateMean??p.gunMean/K.cycle)) * p.rc * p.acc * health;
      const ion = (w * (p.ionRateBest??p.ionBest/K.cycle) + (1 - w) * (p.ionRateMean??p.ionMean/K.cycle)) * p.rc * p.acc * health;
      let msl = 0; if (p.msl > 0 && t % 20 === 8) { const icpt = 0.7 * Y.p.aa / (Y.p.aa + p.msl * 0.5 + 1e-9); msl = p.msl * (1 - icpt) * health; }
      if (p.slots > 0 && X.launched < p.slots) { const n = Math.min(p.slots - X.launched, p.launch * health); X.launched += n; X.queue.push([t + 25, n]); if (!X.allOut && X.launched >= p.slots - 1e-6) { X.allOut = true; ev(t, k, '全機発艦完了'); } }
      while (X.queue.length && X.queue[0][0] <= t) X.air += X.queue.shift()[1];
      out[k] = {gun, ion, msl};
    }
    const air0 = [sd[0].air, sd[1].air], hpf = sd.map(X => 0.35 + 0.65 * Math.max(0, X.hp) / X.p.hp), loss = [0, 0];
    for (let k = 0; k < 2; k++) {
      const Y = sd[1 - k], mine = air0[k], theirs = air0[1 - k], esc = mine + theirs > 0 ? theirs / (mine + theirs) : 0;
      out[k].fd = mine * (1 - 0.5 * esc) * 0.6;
      loss[k] = Math.min(mine, Y.p.aa * 0.012 * hpf[1 - k] + 0.012 * theirs);
    }
    for (let k = 0; k < 2; k++) { sd[k].air -= loss[k]; sd[k].lostF += loss[k]; }
    for (let k = 0; k < 2; k++) {
      const Y = sd[1 - k], o = out[k];
      const sf = o.gun + 2 * o.ion + 0.5 * o.msl + 0.3 * o.fd, direct = 0.5 * o.msl + 0.7 * o.fd;
      let leak = 0;
      if (sf > Y.p.D) { const over = sf - Y.p.D, ab = Math.min(over, Y.buf); Y.buf -= ab; leak = over - ab; } else Y.buf = Math.min(Y.buf0, Y.buf + (Y.p.D - sf));
      const hs = sf > 0 ? (o.gun + 0.2 * o.ion + 0.5 * o.msl + 0.3 * o.fd) / sf : 0;
      Y.hp -= (leak * hs + direct) * Y.p.dr * Y.p.crit;
      if (!Y.shDown && Y.buf0 > 0 && Y.buf <= 1e-6) { Y.shDown = true; ev(t, 1 - k, 'シールド飽和'); }
      if (Y.shDown && Y.buf > Y.buf0 * 0.5) Y.shDown = false;
      if (!Y.half && Y.hp < Y.p.hp * 0.5) { Y.half = true; ev(t, 1 - k, '船体損傷 50%'); }
    }
    const snap = () => frames.push({t, s: sd.map(X => ({hp: Math.max(0, X.hp) / X.p.hp, sh: X.buf0 > 0 ? X.buf / X.buf0 : 0, air: Math.round(X.air)}))});
    if (t % 4 === 0 || t === 1) snap();
    if (sd[0].hp <= 0 || sd[1].hp <= 0) { end = t; for (let k = 0; k < 2; k++) if (sd[k].hp <= 0) ev(t, k, '撃沈'); snap(); break; }
  }
  const r = sd.map(X => Math.max(0, X.hp) / X.p.hp);
  let winner = -1;
  if (sd[0].hp <= 0 && sd[1].hp > 0) winner = 1; else if (sd[1].hp <= 0 && sd[0].hp > 0) winner = 0;
  else if (!end) winner = Math.abs(r[0] - r[1]) < 0.05 ? -1 : (r[0] > r[1] ? 0 : 1);
  return {frames, events, winner, t: end || tmax, decided: !!end, remain: r, lost: sd.map(X => Math.round(X.lostF))};
}

// Yard v3: editable envelopes, derived machinery and compartment accounting.
const STRUCT_SHAPES = {box:'直方体',trap:'台形',wedge:'楔形',cylinder:'円筒',cone:'円錐台',dome:'ドーム'};
const GROUPS = {power:'動力・推進',support:'防御・船体維持',air:'航空・輸送',command:'指揮・生活',shape:'構造'};
Object.assign(PARTS.gen,{name:'主反応炉',group:'power',desc:'主動力源。ノズルを置くと、その間の推進機関を自動生成します。'});
Object.assign(PARTS.engine,{name:'汎用ノズル',group:'power',ratio:0.32,desc:'炉との間を機関として自動占有。接続炉・向き・口径を調整できます。'});
Object.assign(PARTS.hyper,{group:'power'});
Object.assign(PARTS.shield,{group:'support',name:'広域シールド発生器'});
Object.assign(PARTS.hangar,{group:'air',min:10,max:180,desc:'航空機の格納区画。自動充填は炉・推進機関・主要区画を避けます。'});
Object.assign(PARTS.struct,{group:'shape',desc:'機関を包む外殻と支持構造。形状と前後左右の傾斜を指定できます。'});
const addComp = (k,name,shape,dens,col,group,desc,extra={}) => PARTS[k]={name,shape,dens,col,group,desc,hp:0.65,crew:0.2,cost:1,min:8,max:240,def:40,ratio:1.5,...extra};
addComp('aux','補助反応炉','sphere',0.9,[243,187,91],'power','主反応炉と同じ容積あたりの出力を持つ補助炉。独立したノズルの接続先にもできます。',{def:48,crit:true});
addComp('fuel','反応物サイロ','cyl',0.25,[183,135,85],'power','反応物を貯蔵。搭載量と出力から巡航時の持続時間を算出します。',{def:55,crit:true,ratio:2});
addComp('pump','反応物供給設備','cube',0.3,[197,155,95],'power','ポンプ・弁・供給設備。搭載量に応じて燃料供給能力を確保します。',{def:24});
addComp('battery','パワーセル','cube',0.45,[226,189,77],'power','電力の蓄積設備。戦闘時のシールド予備エネルギーを増やします。',{def:30});
addComp('localShield','局所シールド発生器','sphere',0.5,[82,192,164],'support','広域発生器とともに防御出力を担います。',{def:20,crit:true});
addComp('inertial','慣性制御装置','cyl',0.4,[134,158,211],'support','艦の質量に応じた慣性制御能力。足りない場合は警告します。',{def:44});
addComp('integrity','構造維持装置','cube',0.45,[127,156,177],'support','構造維持フィールドを支える装置。艦体規模との適合を確認できます。',{def:36});
addComp('repulsor','リパルサーリフト','cyl',0.35,[112,199,202],'support','着陸・揚陸を補助する設備。搭載した艦の質量から支持能力を表示。',{def:40});
addComp('service','航空整備・補給区画','cube',0.1,[79,140,162],'air','航空機の整備・補給能力を確保します。格納庫とは別に空間を使います。',{def:60});
addComp('vehicle','車両格納・整備区画','cube',0.12,[119,147,91],'air','揚陸車両を収容。航空機の搭載数とは別に計上します。',{def:60});
addComp('cargo','貨物・物資庫','cube',0.18,[157,137,111],'air','貨物搭載量を確保する区画。',{def:45});
addComp('crew','居住区','cube',0.08,[127,163,132],'command','乗員の居住空間。収容可能人数を独立して計算します。',{def:60});
addComp('troops','兵員収容区画','cube',0.09,[163,172,114],'command','揚陸兵員の収容空間。',{def:60});
addComp('command','無窓式指揮室','cube',0.22,[180,178,213],'command','艦内へ置ける航行・戦闘指揮室。艦橋ポッドや艦橋本体がなくても指揮できます。',{def:24});
addComp('firecontrol','射撃管制・砲機構区画','cube',0.38,[192,118,113],'support','砲の管制と甲板下機構。武装規模に対して設備量を点検します。',{def:24});
addComp('machinery','自動推進機関','route',0.55,[87,164,205],'power','炉とノズルの間に自動生成される機関。',{def:30,min:1});
// Command pods: the drum of the Imperial-class bridge, as a part of its own.
// They seat on the side, fore or aft walls of a structure and keep a command
// compartment behind that wall. Old window rows load as pods.
const POD_ASSET='bridge_pod',POD_KEYS={bridge:'podBridge',air:'podAir',hangar:'podHangar',combat:'podCombat'},LEGACY_WINDOWS={winBridge:'podBridge',winAir:'podAir',winHangar:'podHangar',winCombat:'podCombat'};
for(const [k,name,role,col] of [['podBridge','艦橋ポッド','bridge',[172,223,247]],['podAir','航空指揮ポッド','air',[142,229,192]],['podHangar','格納庫管制ポッド','hangar',[236,192,104]],['podCombat','戦闘指揮ポッド','combat',[218,174,245]]]) {
  FITS[k]={key:k,cat:'b',window:true,pod:true,role,name,short:name.replace('ポッド',''),fm:16,wm:6.4,hm:0.8,r:9,sensor:role==='bridge'?0.8:0.4,power:4e20,mass:900,crew:16,cost:80000,col,desc:'インペリアル級艦橋の円筒形指揮ポッド。構造物・艦橋本体の側面や前後の壁に取り付け、背後に指揮区画を自動確保します。取り付け先の移動に追従します。'};
}
// Model bridge bodies carry their command role themselves; the view is
// measured from the drum on their fore face (both models have one).
const BRIDGE_BODY_COMMAND={isd_bridge:{role:'bridge',at:[.5,-.0374,0]},ven_bridge_stbd:{role:'bridge',at:[.5,-.207,0]},ven_bridge_port:{role:'air',at:[.5,-.207,0]}};
function bridgeBodyRole(p){const d=p?.k==='struct'&&p.form==='reference'&&BRIDGE_BODY_COMMAND[p.skinAsset];if(!d)return null;return ['bridge','air','hangar','combat'].includes(p.commandRole)?p.commandRole:d.role;}
function podDepth(f){const a=REFERENCE_ASSETS[POD_ASSET];return (f.width||FITS[f.k].fm)*a.size[0]/a.size[2];}
function podPoint(f,v){const fr=windowFrame(f),w=f.width||FITS[f.k].fm,h=f.height||FITS[f.k].wm;return add(f.p,add(add(mul(fr.up,(v[0]+.5)*podDepth(f)),mul(fr.rt,-v[1]*h)),mul(fr.fw,-v[2]*w)));}
function intrinsicCommandFits(ship){
 const out=[];
 for(const p of ship.parts){const role=bridgeBodyRole(p);if(!role||p.commandEnabled===false)continue;const d=BRIDGE_BODY_COMMAND[p.skinAsset],at=[d.at[0]*p.s[0],d.at[1]*p.s[2],d.at[2]*p.s[1]],q=worldStruct(p,at),n=norm(sub(worldStruct(p,add(at,[1,0,0])),q)),k=POD_KEYS[role],scale=p.s[1]/REFERENCE_ASSETS[p.skinAsset].size[2];
  out.push({id:-300000-p.id,k,p:q,n,a:AXES.reduce((i,x,j)=>dot(x,n)>dot(AXES[i],n)?j:i,0),ped:0,base:0,low:0,width:15.3*scale,height:6.2*scale,host:p.id,intrinsic:true,_wallUp:structFrame(p).up});}
 return out;
}
function isReactor(p){return p.k==='gen'||p.k==='aux';}
function reactorFor(ship,p){
  const rs=ship.parts.filter(isReactor);
  if(p.reactor===0)return null;
  if(p.reactor!=null)return rs.find(r=>r.id===p.reactor)||null;
  return rs.sort((a,b)=>len(sub(a.c,p.c))-len(sub(b.c,p.c)))[0]||null;
}
function frameAxis(axis){const u=norm(axis),v=norm(cross(Math.abs(u[1])<0.9?[0,1,0]:[0,0,1],u));return {u,v,w:cross(u,v)};}
function v3EnginePaths(ship){
  const ps=ship.parts.filter(p=>isReactor(p)||p.k==='engine'),key=JSON.stringify(ps);
  if(ship._engines?.key===key)return ship._engines.paths;
  const paths=[];
  for(const e of ps.filter(p=>p.k==='engine')){
    const r=reactorFor(ship,e);if(!r)continue;
    const dir=norm(e.dir||[-1,0,0]),b=sub(e.c,mul(dir,e.d*0.16)),u=norm(sub(b,r.c));
    const a=add(r.c,mul(u,r.d*0.49)),l=len(sub(b,a));if(l<1)continue;
    const seg={a,b,l,r0:Math.min(r.d*0.23,e.d*0.4),r1:e.d*0.49,...frameAxis(sub(b,a))};
    paths.push({id:-e.id,k:'machinery',c:mul(add(a,b),0.5),d:e.d,seg,reactor:r.id,nozzle:e.id});
  }
  ship._engines={key,paths};return paths;
}
function inRoute(seg,p){const q=sub(p,seg.a),t=dot(q,seg.u)/seg.l;if(t<0||t>1)return false;const r=lerp(seg.r0,seg.r1,t);return dot(q,q)-(t*seg.l)**2<=r*r+1e-7;}
function windowFrame(f){const up=norm(f.n||AXES[f.a]),vertical=norm(sub(f._wallUp||[0,1,0],mul(up,dot(f._wallUp||[0,1,0],up))));const fw=len(vertical)>.01?norm(cross(vertical,up)):[1,0,0];return {up,fw,rt:cross(fw,up)};}
function windowBay(f){const fr=windowFrame(f),w=f.width||FITS[f.k].fm,h=f.height||FITS[f.k].wm;const depth=f.commandDepth??12,height=f.commandHeight??Math.max(8,h+3);return {id:-100000-f.id,k:'command',c:sub(f.p,mul(fr.up,1+depth/2)),d:1,boxFrame:fr,boxSize:[w,depth,height],windowId:f.id};}
function allOccupied(ship){return [...ship.parts.filter(p=>p.k!=='struct'),...enginePaths(ship),...weaponCapacitors(ship),...commandCompartments(ship)];}
function localStruct(pt,p){const q=sub(p,pt.c);if(!pt.surfaceNormal&&!pt.pitch&&!pt.roll){const a=(pt.yaw||0)*Math.PI/180;return [q[0]*Math.cos(a)+q[2]*Math.sin(a),q[1],-q[0]*Math.sin(a)+q[2]*Math.cos(a)];}const f=structFrame(pt);return [dot(q,f.fw),dot(q,f.up),dot(q,f.rt)];}
function worldStruct(pt,p){if(!pt.surfaceNormal&&!pt.pitch&&!pt.roll){const a=(pt.yaw||0)*Math.PI/180;return add(pt.c,[p[0]*Math.cos(a)-p[2]*Math.sin(a),p[1],p[0]*Math.sin(a)+p[2]*Math.cos(a)]);}const f=structFrame(pt);return add(pt.c,add(add(mul(f.fw,p[0]),mul(f.up,p[1])),mul(f.rt,p[2])));}
function structLimits(pt,t){
  const [l,w,h]=pt.s,ang=pt.angles||null,base=pt.taper||0;
  let x0=-l/2,x1=l/2,z0=-w/2,z1=w/2;
  if(ang){x0+=Math.tan(ang[0]*Math.PI/180)*h*t;x1-=Math.tan(ang[1]*Math.PI/180)*h*t;z0+=Math.tan(ang[2]*Math.PI/180)*h*t;z1-=Math.tan(ang[3]*Math.PI/180)*h*t;}
  else {x0*=1-base*t;x1*=1-base*t;z0*=1-base*t;z1*=1-base*t;}
  if(pt.form==='box'||pt.form==='cylinder'||pt.form==='dome'){x0=-l/2;x1=l/2;z0=-w/2;z1=w/2;}
  if(pt.form==='wedge'){x0=-l/2;x1=l/2-l*t;z0=-w/2;z1=w/2;}
  const ox=(pt.offsetX||0)*t,oz=(pt.offsetZ||0)*t;
  if(pt.form!=='wedge'&&x1-x0<l*.03){const c=(x1+x0)/2;x0=c-l*.015;x1=c+l*.015;}
  if(z1-z0<w*.03){const c=(z1+z0)/2;z0=c-w*.015;z1=c+w*.015;}
  return [x0+ox,x1+ox,z0+oz,z1+oz];
}
function v3InStruct(pt,p){
  const q=localStruct(pt,p),h=pt.s[2],t=(q[1]+h/2)/h;if(t<0||t>1)return false;
  const [x0,x1,z0,z1]=structLimits(pt,t),nx=(q[0]-(x0+x1)/2)/((x1-x0)/2),nz=(q[2]-(z0+z1)/2)/((z1-z0)/2);
  if(['cylinder','cone','dome'].includes(pt.form))return nx*nx+nz*nz<=(pt.form==='dome'?1-t*t:1)+1e-9;
  return q[0]>=x0&&q[0]<=x1&&q[2]>=z0&&q[2]<=z1;
}
function v3StructTriangles(pt){
  const key=JSON.stringify([pt.c,pt.s,pt.taper,pt.form,pt.angles,pt.surfaceNormal,pt.pitch,pt.roll,pt.yaw,pt.offsetX,pt.offsetZ]);
  if(pt._geom?.key===key)return pt._geom.tris;
  const round=['cylinder','cone','dome'].includes(pt.form),n=round?40:4,levels=pt.form==='dome'?16:1,rings=[],tri=[];
  for(let j=0;j<=levels;j++){const t=j/levels,[x0,x1,z0,z1]=structLimits(pt,t),y=(t-.5)*pt.s[2],r=pt.form==='dome'?Math.sqrt(Math.max(0,1-t*t)):1;
    const ring=[];for(let i=0;i<n;i++){if(round){const a=i/n*Math.PI*2;ring.push(worldStruct(pt,[(x0+x1)/2+Math.cos(a)*(x1-x0)/2*r,y,(z0+z1)/2+Math.sin(a)*(z1-z0)/2*r]));}else ring.push(worldStruct(pt,[[x0,y,z0],[x1,y,z0],[x1,y,z1],[x0,y,z1]][i]));}rings.push(ring);
  }
  const push=(a,b,c)=>{let nn=cross(sub(b,a),sub(c,a)),cen=mul(add(add(a,b),c),1/3);if(dot(nn,sub(cen,pt.c))<0)[b,c]=[c,b];tri.push(...a,...b,...c);};
  for(let j=0;j<levels;j++)for(let i=0;i<n;i++){const k=(i+1)%n;push(rings[j][i],rings[j+1][i],rings[j+1][k]);push(rings[j][i],rings[j+1][k],rings[j][k]);}
  for(const j of [0,levels]){const c=mul(rings[j].reduce((a,b)=>add(a,b),[0,0,0]),1/n);for(let i=0;i<n;i++)push(c,rings[j][i],rings[j][(i+1)%n]);}
  pt._geom={key,tris:Float32Array.from(tri)};return pt._geom.tris;
}
function structVolume(pt){let v=0;const T=structTriangles(pt);for(let i=0;i<T.length;i+=9){const a=sub(Array.from(T.slice(i,i+3)),pt.c),b=sub(Array.from(T.slice(i+3,i+6)),pt.c),c=sub(Array.from(T.slice(i+6,i+9)),pt.c);v+=dot(a,cross(b,c))/6;}return Math.abs(v);}
function cylinderLocal(pt,p){const q=sub(p,pt.c),f=frameAxis(pt.dir||[1,0,0]);return [dot(q,f.u),dot(q,f.v),dot(q,f.w)];}
function v3PartDims(pt){if(pt.k==='machinery')return {r:pt.seg.l/2+Math.max(pt.seg.r0,pt.seg.r1),l:pt.seg.l,rad:pt.seg.r1};if(pt.boxSize)return {r:len(pt.boxSize)/2};return basePartDims(pt);}
function v3PartVolume(pt){if(pt.k==='struct')return structVolume(pt);if(pt.k==='machinery'){const s=pt.seg;return Math.PI*s.l/3*(s.r0*s.r0+s.r0*s.r1+s.r1*s.r1);}if(pt.boxSize)return pt.boxSize.reduce((a,b)=>a*b,1);return basePartVolume(pt);}
function v3InPart(pt,p){
  if(pt.k==='struct')return inStruct(pt,p);if(pt.k==='machinery')return inRoute(pt.seg,p);
  if(pt.boxSize){const q=sub(p,pt.c),f=pt.boxFrame;return Math.abs(dot(q,f.fw))<=pt.boxSize[0]/2&&Math.abs(dot(q,f.up))<=pt.boxSize[1]/2&&Math.abs(dot(q,f.rt))<=pt.boxSize[2]/2;}
  const sh=PARTS[pt.k].shape;if(sh==='cyl'||sh==='engine'){const q=cylinderLocal(pt,p),m=partDims(pt);return Math.abs(q[0])<=m.l/2&&q[1]*q[1]+q[2]*q[2]<=m.rad*m.rad;}
  return baseInPart(pt,p);
}
function v3PartAABB(pt){
  if(pt.k==='struct'){const T=structTriangles(pt),old=pt._aabb;if(old&&old.T===T)return old.b.slice();const b=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];for(let i=0;i<T.length;i++) {const a=i%3;if(T[i]<b[a])b[a]=T[i];if(T[i]>b[a+3])b[a+3]=T[i];}pt._aabb={T,b:b.slice()};return b;}
  if(pt.k==='machinery'){const s=pt.seg,r=Math.max(s.r0,s.r1);return [0,1,2].map(a=>Math.min(s.a[a],s.b[a])-r).concat([0,1,2].map(a=>Math.max(s.a[a],s.b[a])+r));}
  if(pt.boxSize){const f=pt.boxFrame,e=[0,1,2].map(a=>Math.abs(f.fw[a])*pt.boxSize[0]/2+Math.abs(f.up[a])*pt.boxSize[1]/2+Math.abs(f.rt[a])*pt.boxSize[2]/2);return sub(pt.c,e).concat(add(pt.c,e));}
  const sh=PARTS[pt.k].shape;if(sh==='cyl'||sh==='engine'){const m=partDims(pt),u=norm(pt.dir||[1,0,0]),e=u.map(a=>Math.abs(a)*m.l/2+Math.sqrt(1-a*a)*m.rad);return sub(pt.c,e).concat(add(pt.c,e));}
  return basePartAABB(pt);
}
function v3VolSamples(pt){if(!pt.boxSize&&pt.k!=='struct'&&pt.k!=='machinery'&&!pt.dir)return baseVolSamples(pt);const b=partAABB(pt),out=[];for(const u of VOL_S){const p=[0,1,2].map(a=>(b[a]+b[a+3])/2+u[a]*(b[a+3]-b[a])/2);if(inPart(pt,p))out.push(p);}return out;}
// Model-skinned engines are hit and outlined by their drawn skin, turbine
// body included, not only by the short nozzle cylinder that sets thrust.
const SKIN_MESH=new WeakMap();
function engineSkinMesh(p){
  if(p.k!=='engine'||!REFERENCE_ASSETS[p.skinAsset])return null;
  const key=JSON.stringify([p.c,p.d,p.dir,p.skinAsset,p.skinAnchor,p.skinDiameter,p.skinAxial,p.nozzleLength,p.bodyLength,p.engineLength,p.equipmentId]),old=SKIN_MESH.get(p);if(old&&old.key===key)return old;
  const a=REFERENCE_ASSETS[p.skinAsset],dd=decodeReference(p.skinAsset);if(!dd)return null;
  const u=norm(p.dir||[-1,0,0]),pos=new Float32Array(dd.pos.length),T=new Float32Array(dd.idx.length*3),b=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];let t0=Infinity,t1=-Infinity,rad=0;
  for(let i=0;i<dd.pos.length;i+=3){const q=referenceEnginePoint(p,[dd.pos[i],dd.pos[i+1],dd.pos[i+2]],a);pos.set(q,i);for(let k=0;k<3;k++){if(q[k]<b[k])b[k]=q[k];if(q[k]>b[k+3])b[k+3]=q[k];}const r=sub(q,p.c),t=dot(r,u);if(t<t0)t0=t;if(t>t1)t1=t;const rr=len(sub(r,mul(u,t)));if(rr>rad)rad=rr;}
  for(let i=0;i<dd.idx.length;i++)T.set(pos.subarray(dd.idx[i]*3,dd.idx[i]*3+3),i*3);
  const m={key,T,b,u,t0,t1,rad};SKIN_MESH.set(p,m);return m;
}
function v3RayPart(o,d,pt){
  if(pt.k==='struct')return rayTris(structTriangles(pt),o,d);
  if(pt.k==='engine'&&pt.skinAsset){const m=engineSkinMesh(pt);if(m){const inside=o.every((v,i)=>v>=m.b[i]&&v<=m.b[i+3]),cyl=v3RayPart(o,d,{...pt,skinAsset:null});if(!inside&&!rayAABB(o,d,m.b))return cyl;const h=rayTris(m.T,o,d);return h&&(!cyl||h.t<cyl.t)?h:cyl;}}
  const sh=PARTS[pt.k].shape;if((sh==='cyl'||sh==='engine')&&pt.dir){const f=frameAxis(pt.dir),q=sub(o,pt.c),lo=[dot(q,f.u),dot(q,f.v),dot(q,f.w)],ld=[dot(d,f.u),dot(d,f.v),dot(d,f.w)],h=rayCyl(lo,ld,{...pt,c:[0,0,0],dir:null});if(!h)return null;return {t:h.t,p:add(o,mul(d,h.t)),n:add(add(mul(f.u,h.n[0]),mul(f.v,h.n[1])),mul(f.w,h.n[2]))};}
  return baseRayPart(o,d,pt);
}
function boxesOverlap(a,b,tol=0){return a[0]<b[3]-tol&&a[3]>b[0]+tol&&a[1]<b[4]-tol&&a[4]>b[1]+tol&&a[2]<b[5]-tol&&a[5]>b[2]+tol;}
function overlapParts(a,b){
  const A=partAABB(a),B=partAABB(b);if(!boxesOverlap(A,B,.1))return false;
  if(PARTS[a.k].shape==='cube'&&PARTS[b.k].shape==='cube'&&!a.boxSize&&!b.boxSize&&!a.room&&!b.room&&!isInternal(a)&&!isInternal(b))return true;
  const lo=[0,1,2].map(k=>Math.max(A[k],B[k])),hi=[0,1,2].map(k=>Math.min(A[k+3],B[k+3]));
  for(let i=0;i<5;i++)for(let j=0;j<5;j++)for(let k=0;k<5;k++){const p=[i,j,k].map((v,a)=>lo[a]+(hi[a]-lo[a])*(v+.5)/5);if(inPart(a,p)&&inPart(b,p))return true;}
  return false;
}
function conflicts(ship,pt,ignore=[]){return allOccupied(ship).filter(q=>q.id!==pt.id&&!ignore.includes(q.id)&&q.k!=='struct'&&!(pt.k==='engine'&&q.k==='machinery'&&q.nozzle===pt.id)&&overlapParts(pt,q));}
function engineVented(ship,e){const m=partDims(e),u=norm(e.dir||[-1,0,0]),p=add(e.c,mul(u,m.l/2+Math.max(1,m.rad*.2)));if(inEnv(ship,p))return false;return !ship.parts.some(q=>q!==e&&q.k!=='struct'&&inPart(q,p));}
function mirrorPart(p,ship){const q=JSON.parse(JSON.stringify(p,(k,v)=>k.startsWith('_')?undefined:v));q.c=mirrorP(p.c);delete q._geom;if(q.dir)q.dir=mirrorP(q.dir);if(q.yaw)q.yaw=-q.yaw;if(q.surfaceNormal)q.surfaceNormal=mirrorP(q.surfaceNormal);if(q.roll)q.roll=-q.roll;if(q.angles)[q.angles[2],q.angles[3]]=[q.angles[3],q.angles[2]];if(q.offsetZ)q.offsetZ=-q.offsetZ;if(q.form==='arc')q.arcStart=((-(p.arcStart??30)-(p.arcSweep??300)+540)%360)-180;if(q.loft)q.loft=q.loft.map(a=>a.length>4?[...a.slice(0,4),-a[4]]:a);if(q.outline)q.outline=q.outline.map(a=>[a[0],-a[1]]);if(q.reactor){const r=ship.parts.find(x=>x.id===q.reactor);if(r?.tw)q.reactor=r.tw;}if(q.aviationSurfaces){const a=q.aviationSurfaces;[a.port,a.stbd]=[a.stbd||'none',a.port||'none'];}mirrorEquipment(p,q);return q;}
function v3PlacePart(ship,k,c,size,opts={},mirror=false){
  if(!Object.hasOwn(PARTS,k)||(k==='machinery'||k==='capacitor'))throw new Error('配置できない部品です');
  if(ship.parts.length+(mirror&&Math.abs(c[2])>1?2:1)>DESIGN_LIMITS.parts)throw new Error('区画数の上限は'+DESIGN_LIMITS.parts+'個です');
  const p={id:ship.nextId,k,c:c.slice()};if(k==='struct'){p.s=size.slice();p.taper=opts.taper||0;p.form=opts.form||'trap';p.angles=opts.angles?.slice();p.yaw=opts.yaw||0;p.offsetX=opts.offsetX||0;p.offsetZ=opts.offsetZ||0;}else p.d=size;
  if(k==='engine'){p.dir=(opts.dir||[-1,0,0]).slice();if(opts.reactor!=null)p.reactor=opts.reactor;}
  if(opts.dir)p.dir=norm(opts.dir);
  if(k==='struct'){if(opts.surfaceNormal)p.surfaceNormal=norm(opts.surfaceNormal);p.pitch=opts.pitch||0;p.roll=opts.roll||0;}
  const made=[p];if(mirror&&Math.abs(c[2])>Math.max(1,partDims(p).r*.05)){const q=mirrorPart(p,ship);q.id=p.id+1;q.tw=p.id;p.tw=q.id;made.push(q);}
  if(!opts.allowOverlap&&!ship._building&&k!=='struct'){
    for(const q of made)if(conflicts(ship,q).length)throw new Error('機関・区画の占有範囲と干渉します。位置か大きさを変えてください');
    if(made.length===2&&overlapParts(made[0],made[1]))throw new Error('左右の部品が重なります。中心線から離してください');
  }
  ship.nextId+=made.length;ship.parts.push(...made);return p;
}
function exposedSurface(ship,occupied){
  const g=hullGeo(ship),structs=ship.parts.filter(p=>p.k==='struct'),physical=[...structs,...occupied],eps=.12;
  const bounds=physical.map(q=>[q,partAABB(q)]);const inside=(p,skip)=>bounds.some(([q,b])=>q!==skip&&p[0]>=b[0]&&p[0]<=b[3]&&p[1]>=b[1]&&p[1]<=b[4]&&p[2]>=b[2]&&p[2]<=b[5]&&inPart(q,p));let area=0;
  const addMesh=(T,owner)=>{let result=0;for(let i=0;i<T.length;i+=9){const a=[T[i],T[i+1],T[i+2]],b=[T[i+3],T[i+4],T[i+5]],c=[T[i+6],T[i+7],T[i+8]],n=cross(sub(b,a),sub(c,a)),sz=len(n)/2;if(sz<1e-8)continue;const p=add(mul(add(add(a,b),c),1/3),mul(norm(n),eps));if((owner&&inHull(ship,p))||inside(p,owner))continue;result+=sz;}return result;};
  area+=addMesh(g.tris,null);for(const p of structs)area+=addMesh(structTriangles(p),p);
  for(const p of occupied){if(p.boxSize||isInternal(p))continue;const ss=surfSamples(p,eps);let ex=0;for(const q of ss)if(!inHull(ship,q)&&!inside(q,p))ex++;area+=partArea(p)*ex/Math.max(1,ss.length);}
  return area;
}
function engineeringStats(ship,S){
  const routes=enginePaths(ship),real=ship.parts.filter(p=>p.k!=='struct'),bad=new Set(),info=S.info;
  for(const r of routes)for(const p of real){if(p.id===r.reactor||p.id===r.nozzle)continue;if(overlapParts(r,p)){bad.add(p.id);if(info[p.id])info[p.id].overlap=true;}}
  const volumes={};for(const p of real)if(!info[p.id]?.overlap)volumes[p.k]=(volumes[p.k]||0)+partVolume(p);
  const v=k=>volumes[k]||0;
  S.engineVolume=routes.reduce((n,p)=>n+partVolume(p),0);S.engineLinks=routes.length;S.engineConflicts=bad.size;S.unconnected=real.filter(p=>p.k==='engine'&&!reactorFor(ship,p)).length;
  S.fuelVolume=v('fuel');S.fuelHours=S.power>0?v('fuel')*1.2e25/(S.power*.25)/3600:0;
  S.supplyRatio=S.Vgen>0?Math.min(1,v('pump')*70/S.Vgen):0;
  S.batteryEnergy=v('battery')*5e21;S.inertialSupport=v('inertial')*120;S.integritySupport=v('integrity')*180;S.repulsorSupport=v('repulsor')*70;
  S.crewCapacity=Math.floor(v('crew')/24);S.troopCapacity=Math.floor(v('troops')/12);S.vehicleCapacity=Math.floor(v('vehicle')/600);S.vehicleSizeCapacity=v('vehicle')/GROUND_VEHICLE_VOLUME;S.cargoCapacity=v('cargo')*.4;S.serviceCapacity=Math.floor(v('service')/1500);
  S.airControl=Object.values(S.commandInfo).filter(c=>c.role==='air'&&c.ratio>=.5).length;S.hangarControl=Object.values(S.commandInfo).filter(c=>c.role==='hangar'&&c.ratio>=.5).length;
  // Field-strength gain is a common game coefficient, not a class-name override.
  S.bareStructAccel=S.aStruct;S.aStruct*=1+12*Math.min(1,S.integritySupport/Math.max(1,S.mass));S.structLimited=S.aStruct<S.aThrust;S.aEff=Math.min(S.aThrust,S.aStruct)*Math.min(1,S.inertialSupport/Math.max(1,S.mass));S.accelG=S.aEff/G0;S.structG=S.aStruct/G0;S.MGLT=Math.round(S.accelG/30);
  S.habit=S.crew?S.crewCapacity/S.crew:1;S.supportVolumes=volumes;
  S.warnings=warnings(S).filter(w=>!w.text.startsWith('居住区画'));
  if(S.unconnected)S.warnings.push({lv:'bad',text:`炉に接続されていないノズルが ${S.unconnected} 基あります。`});
  if(bad.size)S.warnings.push({lv:'bad',text:`自動推進機関と ${bad.size} 区画が干渉しています。重複区画は稼働しません。`});
  if(S.Vgen>0&&S.supplyRatio<1)S.warnings.push({lv:'warn',text:`反応物供給能力 ${Math.round(S.supplyRatio*100)}%。サイロと供給設備を確認してください。`});
  if(S.power>0&&!S.fuelVolume)S.warnings.push({lv:'warn',text:'反応物サイロがありません。継続運転用の燃料を確保してください。'});
  S.ground=groundStatus(ship,S);if(S.ground.troops.used>S.ground.troops.capacity)S.warnings.push({lv:'warn',code:'ground-troops',text:`地上部隊の兵員 ${S.ground.troops.used.toLocaleString()} 名が、兵員収容区画の ${S.ground.troops.capacity.toLocaleString()} 名を超えています。`});if(S.ground.vehicles.used>S.ground.vehicles.capacity+1e-6)S.warnings.push({lv:'warn',code:'ground-vehicles',text:`地上部隊の車両がサイズ ${Math.round(S.ground.vehicles.used*10)/10} で、車両格納・整備区画の容量 ${Math.round(S.ground.vehicles.capacity*10)/10} を超えています。`});
  if(S.inertialSupport<S.mass)S.warnings.push({lv:'warn',text:'慣性制御装置の対応質量が不足しています。'});
  if(S.integritySupport<S.mass)S.warnings.push({lv:'warn',text:'構造維持装置の対応質量が不足しています。'});
  if(S.habit<1)S.warnings.push({lv:'warn',text:`居住区の収容 ${S.crewCapacity.toLocaleString()} 名／必要乗員 ${S.crew.toLocaleString()} 名。`});
  if(S.slots>S.serviceCapacity)S.warnings.push({lv:'warn',text:`航空整備能力 ${S.serviceCapacity} 機分／搭載 ${Math.floor(S.slots)} 機。`});
  if(S.slots>0&&!S.airControl)S.warnings.push({lv:'info',text:'航空指揮ポッド（航空指揮所）を設置すると艦載機の管制を分担できます。'});
  return S;
}

function v3SurfSamples(pt,inflate=0){
  if(pt.k==='struct'){const T=structTriangles(pt),out=[];for(let i=0;i<T.length;i+=9){const a=Array.from(T.slice(i,i+3)),b=Array.from(T.slice(i+3,i+6)),c=Array.from(T.slice(i+6,i+9)),n=norm(cross(sub(b,a),sub(c,a)));out.push(add(mul(add(add(a,b),c),1/3),mul(n,inflate)));}return out;}
  if(pt.k==='machinery'){const s=pt.seg,out=[];for(let i=0;i<=8;i++)for(let j=0;j<16;j++){const t=i/8,a=j/16*Math.PI*2,r=lerp(s.r0,s.r1,t)+inflate;out.push(add(add(s.a,mul(s.u,t*s.l)),add(mul(s.v,Math.cos(a)*r),mul(s.w,Math.sin(a)*r))));}return out;}
  if(pt.boxSize)return volSamples(pt);
  if(pt.dir){const f=frameAxis(pt.dir);return baseSurfSamples({...pt,c:[0,0,0],dir:null},inflate).map(p=>add(pt.c,add(add(mul(f.u,p[0]),mul(f.v,p[1])),mul(f.w,p[2]))));}
  return baseSurfSamples(pt,inflate);
}
function mountFit(ship,f){
  if(FITS[f.k]?.asset)return mountReferenceFit(ship,f);
  if(!FITS[f.k]?.window)return baseMountFit(ship,f);
  let p=f.p,n=f.n||AXES[f.a],host=f.host?ship.parts.find(q=>q.id===f.host):null,h=null;
  if(f.host&&!host){f.float=true;return f;}
  if(host&&f.local){const local=[f.local[0]*host.s[0],f.local[1]*host.s[2],f.local[2]*host.s[1]];p=worldStruct(host,local);const normal=f.localNormal?worldStruct({...host,c:[0,0,0]},[f.localNormal[0]/host.s[0],f.localNormal[1]/host.s[2],f.localNormal[2]/host.s[1]]):sub(p,host.c),out=norm(normal),far=f.localNormal?8:len(host.s)+10;h=rayPart(add(p,mul(out,far)),mul(out,-1),host);if(h)h.part=host;}
  else h=rayEnv(ship,add(p,mul(n,4)),mul(n,-1),{maxT:12,structOnly:true});
  // Command pods belong to exposed structure walls, never hull skins or roofs.
  const valid=h?.part?.k==='struct'&&Math.abs(dot(h.n,structFrame(h.part).up))<.65;
  f.float=!valid;f.base=0;f.low=0;f.ped=0;
  if(!valid)return f;f.p=h.p;f.n=h.n;f._wallUp=structFrame(h.part).up;
  if(h.part?.k==='struct'&&!f.local){f.host=h.part.id;const q=localStruct(h.part,f.p);f.local=[q[0]/h.part.s[0],q[1]/h.part.s[2],q[2]/h.part.s[1]];const nn=localStruct({...h.part,c:[0,0,0]},f.n);f.localNormal=[nn[0]*h.part.s[0],nn[1]*h.part.s[2],nn[2]*h.part.s[1]];}
  return f;
}
function fitOrigin(f){if(FITS[f.k]?.window)return add(f.p,mul(f.n||AXES[f.a],(f.intrinsic?0:podDepth(f))+.45));return baseFitOrigin(f);}
function fitAABB(f){
  if(FITS[f.k]?.asset)return referenceFitAABB(f);
  if(!FITS[f.k]?.window)return baseFitAABB(f);
  const fr=windowFrame(f),w=f.width||FITS[f.k].fm,h=f.height||FITS[f.k].wm,depth=podDepth(f),c=add(f.p,mul(fr.up,depth/2)),e=[0,1,2].map(a=>Math.abs(fr.fw[a])*w/2+Math.abs(fr.rt[a])*h/2+Math.abs(fr.up[a])*depth/2);
  return sub(c,e).concat(add(c,e));
}
function placeFit(ship,k,p,n,ped,mirror,options={}){
  if(FITS[k]?.casemate){if(Math.abs(n[1])>.65)return {err:'ケースメイト砲はトレンチ内壁・船体や構造の側壁に配置してください'};options={...options,localMount:true};}
  if(!FITS[k]?.window)return basePlaceFit(ship,k,p,n,ped,mirror,options);
  if(ship.fits.length+(mirror?2:1)>DESIGN_LIMITS.fits)return {err:'装備数の上限は'+DESIGN_LIMITS.fits+'基です'};
  const make=(p,n)=>mountFit(ship,{id:ship.nextId++,k,p:p.slice(),n:n.slice(),a:AXES.reduce((i,x,j)=>dot(x,n)>dot(AXES[i],n)?j:i,0),ped:0,width:FITS[k].fm,height:FITS[k].wm});
  const f=make(p,n);if(f.float)return {err:'艦橋ポッドは構造物・艦橋本体の側面や前後の壁に取り付けてください。船体・甲板・天井には取り付けられません'};
  if(fitClash(ship,f))return {err:'別のポッド・装備と重なっています'};
  const bay=windowBay(f);if(hardConflicts(ship,bay).length)return {err:'ポッドの背後の指揮区画が機関と干渉します'};
  ship.fits.push(f);
  if(mirror&&Math.abs(p[2])>FITS[k].r){const q=make(mirrorP(p),mirrorP(n));if(!q.float&&!fitClash(ship,q)&&!hardConflicts(ship,windowBay(q)).length){f.tw=q.id;q.tw=f.id;ship.fits.push(q);}}
  return {fit:f};
}
function v3ComputeStats(ship){return engineeringStats(ship,baseComputeStats(ship));}
function v3Serialize(ship){
  const o={format:'starship-yard',v:3};for(const k of ['name','hull','keel','cuts','trenches','solidCuts','subs','parts','hatches','fits','armor','nextId','shieldTarget'])o[k]=ship[k];o.airWings=normalizeAirWings(ship.airWings);
  // Old performance multipliers have no place in new saves. Physical
  // dimensions and positions survive unchanged, including on legacy imports.
  return JSON.parse(JSON.stringify(o,(k,v)=>k.startsWith('_')||LEGACY_PERFORMANCE_FACTORS.has(k)||k==='aircraftType'||k==='berths'?undefined:v));
}
function v3Deserialize(o){
  if(!o||o.format!=='starship-yard'||![2,3].includes(o.v))throw new Error('航宙艦設計局 v2/v3 の設計図を選んでください');
  const number=(n,lo,hi,def)=>Number.isFinite(n)?clamp(n,lo,hi):def;
  const vec=(x,def=[0,0,0])=>Array.isArray(x)&&x.length===3?x.map((n,i)=>number(n,-DESIGN_LIMITS.coordinate,DESIGN_LIMITS.coordinate,def[i])):def.slice();
  const s=newShip({},String(o.name||'読み込んだ設計').slice(0,60)),h=o.hull||{};
  s.hull={plan:['wedge','arrow','rect','cigar','ellipse'].includes(h.plan)?h.plan:'wedge',sec:Object.hasOwn(SECTIONS,h.sec)?h.sec:'rect',L:number(h.L,60,DESIGN_LIMITS.length,1100),W:number(h.W,20,DESIGN_LIMITS.width,540),H:number(h.H,10,DESIGN_LIMITS.height,180),bowW:number(h.bowW,0,1,.02),bowH:number(h.bowH,.1,1,.5),stern:number(h.stern,.2,1,1)};
  s.keel=Object.hasOwn(KEELS,o.keel)?o.keel:'std';s.armor={hull:number(o.armor?.hull,0,3,.5),cit:number(o.armor?.cit,0,4,0)};s.shieldTarget=number(o.shieldTarget,.1,3,1);
  if(!Array.isArray(o.parts)||o.parts.length>DESIGN_LIMITS.parts||!Array.isArray(o.fits)||o.fits.length>DESIGN_LIMITS.fits)throw new Error('区画数または装備数が上限を超えています');
  const ids=new Set();let mx=0;
  const ident=x=>{if(!Number.isInteger(x)||x<=0||ids.has(x))throw new Error('部品IDが不正または重複しています');ids.add(x);mx=Math.max(mx,x);return x;};
  s.parts=o.parts.filter(p=>p&&Object.hasOwn(PARTS,p.k)&&!['machinery','capacitor'].includes(p.k)).map(p=>{
    const q={id:ident(p.id),k:p.k,c:vec(p.c)};if(p.k==='struct'){q.s=vec(p.s,[100,100,50]).map(v=>clamp(v,2,DESIGN_LIMITS.partSize));q.taper=number(p.taper,0,.95,0);q.form=Object.hasOwn(STRUCT_SHAPES,p.form)?p.form:'trap';if(Array.isArray(p.angles))q.angles=[0,1,2,3].map(i=>number(p.angles[i],-60,70,0));q.yaw=number(p.yaw,-180,180,0);q.offsetX=number(p.offsetX,-2000,2000,0);q.offsetZ=number(p.offsetZ,-2000,2000,0);}else q.d=number(p.d,4,DESIGN_LIMITS.diameter,PARTS[p.k].def||40);
    if(p.dir)q.dir=norm(vec(p.dir,[-1,0,0]));if(p.k==='engine'){if(!q.dir)q.dir=[-1,0,0];if(o.v===2)q.c[0]-=q.d*.64;if(Number.isInteger(p.reactor)&&p.reactor>=0)q.reactor=p.reactor;}if(Number.isInteger(p.tw))q.tw=p.tw;if(Number.isInteger(p.vt))q.vt=p.vt;return q;
  });
  s.fits=o.fits.filter(f=>f&&(Object.hasOwn(FITS,f.k)||Object.hasOwn(LEGACY_WINDOWS,f.k))).map(f=>{const legacy=LEGACY_WINDOWS[f.k],q={id:ident(f.id),k:legacy||f.k,p:vec(f.p),a:Math.floor(number(f.a,0,5,2)),ped:number(f.ped,0,500,0),base:0,low:0,slope:0};if(f.n)q.n=norm(vec(f.n,[1,0,0]));if(f.host)q.host=f.host;if(f.local)q.local=vec(f.local);if(f.localNormal)q.localNormal=vec(f.localNormal);if(legacy){q.width=clamp(Math.round(number(f.width,8,160,32)/2),6,60);q.height=Math.round(q.width*4)/10;q.legacyWindow=true;}else if(FITS[q.k].window){q.width=number(f.width,6,60,FITS[q.k].fm);q.height=number(f.height,3,30,FITS[q.k].wm);}else{if(f.width!=null)q.width=number(f.width,.01,DESIGN_LIMITS.partSize,FITS[q.k].fm);if(f.height!=null)q.height=number(f.height,.01,DESIGN_LIMITS.partSize,FITS[q.k].wm);}if(f.tw)q.tw=f.tw;if(Number.isInteger(f.vt))q.vt=f.vt;if(f.pedShape==='trap')q.pedShape='trap';if(Number.isFinite(f.pedSize))q.pedSize=number(f.pedSize,.4,3,1);return q;});
  s.cuts=(Array.isArray(o.cuts)?o.cuts:[]).slice(0,50).map(c=>c.type==='planTrapezoid'?normalizePlanCut({id:ident(c.id),side:['both','port','stbd'].includes(c.side)?c.side:'both',from:number(c.from,0,.96,.25),to:number(c.to,.03,1,.52),innerFrom:number(c.innerFrom,0,1,.38),innerTo:number(c.innerTo,0,1,.44),remainingWidth:number(c.remainingWidth,.03,.98,.493)}):({id:ident(c.id),side:['both','port','stbd'].includes(c.side)?c.side:'both',edge:['top','bottom','both'].includes(c.edge)?c.edge:'top',inset:number(c.inset,0,1000,20),slope:number(c.slope,1,1000,30),from:number(c.from,0,.99,0),to:number(c.to,.01,1,1),prop:!!c.prop}));
  s.trenches=(Array.isArray(o.trenches)?o.trenches:[]).slice(0,30).map(c=>({id:ident(c.id),side:['both','port','stbd'].includes(c.side)?c.side:'both',from:number(c.from,0,.99,.1),to:number(c.to,.01,1,.9),level:number(c.level,.1,.9,.5),height:number(c.height,1,500,14),depth:number(c.depth,1,800,20),taper:c.mode==='split'?false:c.taper!==false,...(c.mode==='split'?{mode:'split'}:{})}));
  if(o.solidCuts!=null&&(!Array.isArray(o.solidCuts)||o.solidCuts.length>32))throw new Error('立体切削は32箇所までです');
  s.solidCuts=(o.solidCuts||[]).map(c=>{if(!c||typeof c!=='object')throw new Error('立体切削の形式が不正です');return normalizeSolidCut({...c,id:ident(c.id)});});
  s.subs=(Array.isArray(o.subs)?o.subs:[]).slice(0,50).filter(q=>Array.isArray(q.b)&&q.b.length===6).map(q=>({id:ident(q.id),b:q.b.map(n=>number(n,-DESIGN_LIMITS.coordinate,DESIGN_LIMITS.coordinate,0)),...(q.structures?{structures:true}:{})}));
  s.hatches=(Array.isArray(o.hatches)?o.hatches:[]).slice(0,80).map(q=>({id:ident(q.id),k:q.k==='ray'?'ray':'open',a:vec(q.a),b:vec(q.b),n:norm(vec(q.n,[0,1,0])),w:number(q.w,4,DESIGN_LIMITS.width,40),tw:q.tw}));
  for(const q of [...s.parts,...s.fits]){if(q.tw&&!ids.has(q.tw))delete q.tw;if(q.vt&&!ids.has(q.vt))delete q.vt;}
  for(const p of s.parts)if(p.k==='struct')p._solidCutShip=s;
  s.nextId=mx+1;return s;
}
function buildDesign(key){
  const finish=s=>{s.hullLocked=true;return initializeAviation(s,key);};
  if(Object.hasOwn(DREADNOUGHT_EXAMPLES,key))return finish(dreadnoughtDesign(key));
  if(['venator','imperial'].includes(key))return finish(referenceDesign(key));
  const d=DESIGNS[key];if(!d)throw new Error('設計見本が見つかりません');
  const s=newShip(d.hull,d.name);s.keel=d.hull.keel||'std';s._building=true;d.build(s);delete s._building;return finish(s);
}

function profile(S,name){const p=baseProfile(S,name);p.gunRateBest=Math.max(...S.alphaRate);p.gunRateMean=S.alphaRate.reduce((a,b)=>a+b,0)/6;p.ionRateBest=Math.max(...S.ionRate);p.ionRateMean=S.ionRate.reduce((a,b)=>a+b,0)/6;p.shieldBuffer=S.shieldCapacity/TT;p.reserve=(S.batteryEnergy||0)/TT;return p;}

// Parametric shipbuilding: station lofts, shaped rooms, engine bodies and physical bay mouths.
addComp('scanner','指向性通信・走査アレイ','cyl',.15,[93,110,119],'support','方向を持つ通信・索敵機器。直径、長さ、向きを設定できます。',{def:18,ratio:.25});
SECTIONS.warship='装甲楔形（舷側帯付き）';
STRUCT_SHAPES.chamfer='切隅・平面台形';
STRUCT_SHAPES.loft='断面ロフト・傾斜甲板';
STRUCT_SHAPES.ellipsoid='球・楕円体（腹部装甲）';
addComp('sensor','センサー・標的追跡装置','sphere',.18,[166,178,185],'support','シールドとは別の索敵・標的追跡機器。外殻やマストに配置します。',{def:16});
function partLabel(p){return p.label||equipmentSpec(p)?.name||PARTS[p.k]?.name||'区画';}
// Default stations for the section table: they fall on the plan's own corners.
function planStations(h){if(h.plan==='arrow'){const m=clamp(h.maxAt??.3,.05,.9);return [0,m/2,m,m+(1-m)/3,m+(1-m)*2/3,1];}if(h.plan==='rect')return [0,.35,.7,.8,.9,1];return [0,.2,.4,.6,.8,1];}
function profileAt(h,t){
  if(!h.stations?.length)return [t,planW(h,t),planH(h,t,planW(h,t)),0,h.deckWidth??.52,h.keelWidth??0];
  const a=h.stations;let i=0;while(i<a.length-2&&t>a[i+1][0])i++;
  const u=clamp((t-a[i][0])/Math.max(1e-6,a[i+1][0]-a[i][0]),0,1);
  return [t,lerp(a[i][1],a[i+1][1],u),lerp(bowStation(h,i)?a[i][1]:a[i][2],bowStation(h,i+1)?a[i+1][1]:a[i+1][2],u),lerp(a[i][3]??0,a[i+1][3]??0,u),lerp(a[i][4]??h.deckWidth??.52,a[i+1][4]??h.deckWidth??.52,u),lerp(a[i][5]??h.keelWidth??0,a[i+1][5]??h.keelWidth??0,u)];
}
function sectionBase(hp,x){
  if(hp.assembly)return {t:x/hp.L,pw:0,ph:0,hw:0,h:0,yc:0,poly:[[0,0],[0,0],[0,0],[0,0]],ell:null,ytop:0,ybot:0,E:0};
  if(!hp.stations?.length&&hp.sec!=='warship')return v3SectionBase(hp,x);
  const t=clamp(x/hp.L,0,1),[,pw,ph,dy,dw,kw]=profileAt(hp,t),hw=hp.W*pw/2,h=hp.H*ph,yc=hp.H*(.5+dy),top=yc+h/2,bot=yc-h/2;
  const deck=clamp(dw,0,.98),belt=clamp(hp.belt??.13,.02,.6),edge=bot+h*clamp(hp.chineHeight??.5,.2,.8),keel=clamp(kw??hp.keelWidth??0,0,.98);
  let poly;
  if(hp.sec==='warship')poly=[[-hw*keel,bot],[hw*keel,bot],[hw,Math.max(bot,edge-h*belt/2)],[hw,Math.min(top,edge+h*belt/2)],[hw*deck,top],[-hw*deck,top],[-hw,Math.min(top,edge+h*belt/2)],[-hw,Math.max(bot,edge-h*belt/2)]];
  else {const s=v3SectionBase({...hp,stations:null,W:hp.W*pw,H:h,plan:'rect',bowW:1,bowH:1},0);if(s.ell)return {...s,t,pw,ph,hw,h,yc,ytop:top,ybot:bot};poly=s.poly.map(q=>[q[0],q[1]+yc-h/2]);}
  return {t,pw,ph,hw,h,yc,poly,ell:null,ytop:top,ybot:bot,E:hw};
}
// Rooms and sensors are measured through a struct-like shape. The shape object
// is reused while the part is unchanged so its triangle caches survive.
function shapeSig(p){const j=a=>a?a.join(','):'';let s=j(p.c)+'|'+p.d+'|'+j(p.room)+'|'+(p.yaw||0)+'|'+(p.pitch||0)+'|'+(p.roll||0)+'|'+j(p.surfaceNormal)+'|'+(p.corner??'')+'|'+(p.aftWidth??'')+'|'+(p.foreWidth??'')+'|'+(p.deckSlope||0)+'|'+(p.ridge||0)+'|'+j(p.skinSize);if(p.outline)s+='|'+p.outline.map(j).join(';');return s;}
function memoShape(p,slot,make){const sig=shapeSig(p),old=p[slot];if(old&&old.sig===sig)return old.shape;const s=make(p);p[slot]={sig,shape:s};return s;}
// Bounds of the unpierced solid. Every inStruct() point lies inside them.
function structBounds(p){const T=unpiercedStructTriangles(p),old=p._structBounds;if(old&&old.T===T)return old.b;const b=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];for(let i=0;i<T.length;i++){const a=i%3;if(T[i]<b[a])b[a]=T[i];if(T[i]>b[a+3])b[a+3]=T[i];}const pad=Math.max(b[3]-b[0],b[4]-b[1],b[5]-b[2])*.05+1e-4;for(let a=0;a<3;a++){b[a]-=pad;b[a+3]+=pad;}p._structBounds={T,b};return b;}
function roomShape(p){return memoShape(p,'_roomShape',roomShapeRaw);}
function roomShapeRaw(p){const orientation={surfaceNormal:p.surfaceNormal,pitch:p.pitch||0,roll:p.roll||0};if(p.outline)return {...orientation,k:'struct',c:p.c,s:p.room||[p.d,p.d,p.d],form:'outline',outline:p.outline,deckSlope:p.deckSlope||0,ridge:p.ridge||0,yaw:p.yaw||0};return {...orientation,k:'struct',c:p.c,s:p.room||[p.d,p.d,p.d],form:'chamfer',corner:p.corner??0,aftWidth:p.aftWidth??1,foreWidth:p.foreWidth??1,yaw:p.yaw||0,taper:0};}
function setRoomSize(p,size){p.room=size.map(x=>clamp(x,4,DESIGN_LIMITS.partSize));p.d=Math.cbrt(p.room.reduce((a,b)=>a*b,1));}
function chamferRing(p,t){
  const [x0,x1,z0,z1]=structLimits(p,t),m=(z0+z1)/2,w=(z1-z0)/2,a=clamp(p.aftWidth??1,.03,2),f=clamp(p.foreWidth??1,.03,2),c=clamp(p.corner??.12,0,.45),dx=(x1-x0)*c;
  const at=x=>m-w*lerp(a,f,(x-x0)/(x1-x0));const bt=x=>m+w*lerp(a,f,(x-x0)/(x1-x0));
  return [[x0,at(x0)+w*a*c],[x0+dx,at(x0+dx)],[x1-dx,at(x1-dx)],[x1,at(x1)+w*f*c],[x1,bt(x1)-w*f*c],[x1-dx,bt(x1-dx)],[x0+dx,bt(x0+dx)],[x0,bt(x0)-w*a*c]];
}
function unpiercedStructTriangles(p){
  if(p.form==='arc')return arcTriangles(p);
  if(p.form==='outline')return outlineTriangles(p);
  if(p.form==='reference')return referenceTriangles(p);
  if(p.form==='ellipsoid')return ellipsoidTriangles(p);
  if(p.form==='loft'||p.form==='roundloft')return loftTriangles(p);
  if(p.form!=='chamfer')return v3StructTriangles(p);
  const key=JSON.stringify([p.c,p.s,p.angles,p.taper,p.surfaceNormal,p.pitch,p.roll,p.yaw,p.corner,p.aftWidth,p.foreWidth,p.offsetX,p.offsetZ]);if(p._shape?.key===key)return p._shape.t;
  const rings=[0,1].map(t=>chamferRing(p,t).map(([x,z])=>worldStruct(p,[x,(t-.5)*p.s[2],z]))),out=[];
  const put=(a,b,c)=>{if(dot(cross(sub(b,a),sub(c,a)),sub(mul(add(add(a,b),c),1/3),p.c))<0)[b,c]=[c,b];out.push(...a,...b,...c);};
  for(let i=0;i<8;i++){const j=(i+1)%8;put(rings[0][i],rings[1][i],rings[1][j]);put(rings[0][i],rings[1][j],rings[0][j]);}
  for(let j=0;j<2;j++){const c=mul(rings[j].reduce((a,b)=>add(a,b),[0,0,0]),1/8);for(let i=0;i<8;i++)put(c,rings[j][i],rings[j][(i+1)%8]);}
  p._shape={key,t:Float32Array.from(out)};return p._shape.t;
}
function unpiercedInStruct(p,q){
  if(p.form==='arc')return inArc(p,q);
  if(p.form==='outline')return inOutline(p,q);
  if(p.form==='reference')return inReferenceStructure(p,q);
  if(p.form==='ellipsoid'){const v=localStruct(p,q);return (v[0]*2/p.s[0])**2+(v[1]*2/p.s[2])**2+(v[2]*2/p.s[1])**2<=1+1e-9;}
  if(p.form==='loft'||p.form==='roundloft'){const v=localStruct(p,q),t=v[0]/p.s[0]+.5;if(t<0||t>1)return false;const row=loftProfile(p,t);if(p.form==='roundloft'){const hw=row[1]*p.s[1]/2,b=(row[3]-.5)*p.s[2],top=(row[2]-.5)*p.s[2];return ((v[2]-(row[4]||0)*p.s[1]/2)/hw)**2+((v[1]-(top+b)/2)/((top-b)/2))**2<=1+1e-9;}const ring=loftRing(p,row);return pointInRing(v[2],v[1],ring.map(q=>[q[2],q[1]]));}
  if(p.form!=='chamfer')return v3InStruct(p,q);
  const v=localStruct(p,q),t=(v[1]+p.s[2]/2)/p.s[2];if(t<0||t>1)return false;
  const ring=chamferRing(p,t);let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>v[2])!==(b[1]>v[2])&&v[0]<(b[0]-a[0])*(v[2]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;
}
function enginePaths(ship){
  const ps=ship.parts.filter(p=>isReactor(p)||p.k==='engine'),key=JSON.stringify(ps,(k,v)=>k.startsWith('_')?undefined:v);if(ship._engines4?.key===key)return ship._engines4.paths;
  const paths=[];
  const segment=(a,b,r0,r1)=>({a,b,r0,r1,l:len(sub(b,a)),...frameAxis(sub(b,a))});
  for(const e of ps.filter(p=>p.k==='engine')){
    const r=reactorFor(ship,e);if(!r)continue;
    const dir=norm(e.dir||[-1,0,0]),b=sub(e.c,mul(dir,partDims(e).l/2)),d=len(sub(b,r.c));
    const bl=parametricEngine(e)?Math.max(2,e.bodyLength):clamp(e.bodyLength??e.d*2.2,2,Math.max(2,d*.62)),joint=sub(b,mul(dir,bl));
    const u=norm(sub(joint,r.c)),a=add(r.c,mul(u,r.d*.49));if(len(sub(a,b))<1)continue;
    const rad=e.d*(e.bodyRadius??.52),segments=[segment(a,joint,Math.min(r.d*.2,e.d*.29),rad*.78),segment(joint,b,rad*.78,rad)].filter(s=>s.l>.1);
    const seg=segment(a,b,segments[0].r0,rad);
    paths.push({id:-e.id,k:'machinery',c:mul(add(a,b),.5),d:e.d,seg,segments,reactor:r.id,nozzle:e.id});
  }
  ship._engines4={key,paths};return paths;
}
function partDims(p){if(p.room)return {r:len(p.room)/2,e:p.room[0]};if((p.k==='engine'&&p.nozzleLength)||(p.length&&PARTS[p.k].shape==='cyl')){const l=p.k==='engine'?p.nozzleLength:p.length;return {r:Math.hypot(p.d,l)/2,l,rad:p.d/2};}return v3PartDims(p);}
function unclippedPartVolume(p){if(p.k==='sensor'&&p.skinSize){const a=sensorShape(p).s;return Math.PI*a[0]*a[1]*a[2]/6;}if(p.k==='struct'&&(p._apertures?.length||p._solidCutShip?.solidCuts?.length))return solidStructVolume(p);if(p.room)return structVolume(roomShape(p));if(p.segments)return p.segments.reduce((v,s)=>v+Math.PI*s.l/3*(s.r0*s.r0+s.r0*s.r1+s.r1*s.r1),0);return v3PartVolume(p);}
function unclippedPartArea(p){if(p.boxSize){const [a,b,c]=p.boxSize;return 2*(a*b+b*c+c*a);}if(p.k==='sensor'&&p.skinSize)return unclippedPartArea(sensorShape(p));if(p.room||p.k==='struct'){const t=p.room?structTriangles(roomShape(p)):structTriangles(p);let a=0;for(let i=0;i<t.length;i+=9)a+=len(cross(sub(Array.from(t.slice(i+3,i+6)),Array.from(t.slice(i,i+3))),sub(Array.from(t.slice(i+6,i+9)),Array.from(t.slice(i,i+3)))))/2;return a;}if(p.segments)return p.segments.reduce((a,s)=>a+Math.PI*(s.r0+s.r1)*Math.hypot(s.l,s.r1-s.r0),0);return v3PartArea(p);}
function unclippedInPart(p,q){if(p.k==='sensor'&&p.skinSize)return inStruct(sensorShape(p),q);if(p.room)return inStruct(roomShape(p),q);if(p.segments)return p.segments.some(s=>inRoute(s,q));return v3InPart(p,q);}
function partAABB(p){if(p._packing)return p._packing.bounds.slice();if(p.k==='sensor'&&p.skinSize)return v3PartAABB(sensorShape(p));if(p.room)return v3PartAABB(roomShape(p));if(p.segments){const b=p.segments.map(seg=>v3PartAABB({...p,segments:null,seg}));return [0,1,2].map(i=>Math.min(...b.map(x=>x[i]))).concat([3,4,5].map(i=>Math.max(...b.map(x=>x[i]))));}return v3PartAABB(p);}
function unclippedVolSamples(p){if(p.k==='sensor'&&p.skinSize)return v3VolSamples(sensorShape(p));if(p.room)return v3VolSamples(roomShape(p));if(p.segments)return p.segments.flatMap(seg=>v3VolSamples({...p,segments:null,seg}));if(p.k==='struct'&&p._apertures?.some(m=>m.slide)){const T=structTriangles(p),b=solidMeshBounds(p._solidGeometry?.material||p._pierced?.material||T);if(!b.every(Number.isFinite))return [];return VOL_S.map(u=>[0,1,2].map(a=>(b[a]+b[a+3])/2+u[a]*(b[a+3]-b[a])/2)).filter(q=>inStruct(p,q));}return v3VolSamples(p);}
function unclippedSurfSamples(p,e=0){if(p.k==='sensor'&&p.skinSize)return v3SurfSamples(sensorShape(p),e);if(p.room)return v3SurfSamples(roomShape(p),e);if(p.segments)return p.segments.flatMap(seg=>v3SurfSamples({...p,segments:null,seg},e));return v3SurfSamples(p,e);}
function unclippedRayPart(o,d,p){if(p.k==='sensor'&&p.skinSize)return rayTris(structTriangles(sensorShape(p)),o,d);if(p.room)return rayTris(structTriangles(roomShape(p)),o,d);return v3RayPart(o,d,p);}
function placePart(ship,k,c,size,opt={},mirror=false){
  if(Object.hasOwn(EQUIPMENT,opt.equipmentId)&&EQUIPMENT[opt.equipmentId].k===k)opt={...equipmentOptions(opt.equipmentId),...opt};
  // Shape properties must be present during collision checking, including mirror checks.
  const old=ship._building;ship._building=true;let p;
  try{p=v3PlacePart(ship,k,c,size,opt,mirror);}finally{ship._building=old;}
  const made=ship.parts.filter(q=>q.id===p.id||q.id===p.tw);
  for(const q of made){for(const a of ['autoFit','engineLength','equipmentId','customEquipment','arcBands','bands','arcInner','arcStart','arcSweep','label','length','corner','aftWidth','foreWidth','paint','bodyLength','bodyRadius','ribSpacing','nozzleLength','throatRatio','wallInset','ridge','deckSlope','skin','skinAsset','skinAxial','skinAnchor','skinDiameter','skinSize','airRole','pitch','roll','surfaceNormal'])if(opt[a]!=null)q[a]=opt[a];if(opt.outline)q.outline=opt.outline.map(a=>[a[0],a[1]*(q===p?1:-1)]);if(opt.loft)q.loft=opt.loft.map(a=>a.length>4?[...a.slice(0,4),a[4]*(q===p?1:-1)]:a.slice());if(q!==p&&q.form==='arc')q.arcStart=((-(p.arcStart??30)-(p.arcSweep??300)+540)%360)-180;if(opt.surfaceNormal)q.surfaceNormal=q===p?opt.surfaceNormal.slice():mirrorP(opt.surfaceNormal);if(q!==p&&opt.roll!=null)q.roll=-opt.roll;if(opt.room)setRoomSize(q,opt.room);if(opt.yaw!=null&&q.k!=='struct')q.yaw=q===p?opt.yaw:-opt.yaw;}
  for(const q of made){enforceEquipment(q);if(q.k==='struct')q._solidCutShip=ship;}
  if(made.length===2&&equipmentSpec(p)){const q=made.find(q=>q!==p),id=q.id,tw=q.tw;Object.assign(q,mirrorPart(p,ship),{id,tw});}
  for(const q of made)if(isInternal(q))q._envelope=ship;
  if(!old&&!opt.allowOverlap&&k!=='struct'&&made.some(q=>hardConflicts(ship,q,made.map(x=>x.id)).length||(made.length>1&&!flexibleCompartment(ship,made[0])&&!flexibleCompartment(ship,made[1])&&overlapParts(made[0],made[1])))){
    ship.parts=ship.parts.filter(q=>!made.includes(q));ship.nextId-=made.length;throw new Error('機関・区画の占有範囲と干渉します。位置か大きさを変えてください');
  }
  return p;
}
// Split polygons against a plane. Keeping fragments outside all six planes cuts a real opening.
function clipPoly(poly,ax,v,positive){
  const out=[],dist=p=>(p[ax]-v)*(positive?1:-1);
  for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=dist(a),db=dist(b),ia=da>=-1e-7,ib=db>=-1e-7;if(ia)out.push(a);if(ia!==ib){const t=da/(da-db);out.push(a.map((q,k)=>lerp(q,b[k],t)));}}
  return out;
}
function triangulateFan(poly,out){for(let i=1;i+1<poly.length;i++){if(len(cross(sub(poly[i],poly[0]),sub(poly[i+1],poly[0])))>1e-7)out.push(...poly[0],...poly[i],...poly[i+1]);}}
function subtractBoxMesh(T,b){
  const out=[];
  for(let i=0;i<T.length;i+=9){let poly=[Array.from(T.slice(i,i+3)),Array.from(T.slice(i+3,i+6)),Array.from(T.slice(i+6,i+9))];
    if([0,1,2].some(a=>Math.max(...poly.map(p=>p[a]))<b[a]||Math.min(...poly.map(p=>p[a]))>b[a+3])){out.push(...T.slice(i,i+9));continue;}
    for(const {n,d} of openingPlanes(b)){const outside=clipGeneral(poly,mul(n,-1),-d);triangulateFan(outside,out);poly=clipGeneral(poly,n,d);if(poly.length<3)break;}
  }
  return Float32Array.from(out);
}
function openingBounds(ship,h){
  if(!h.portal)return null;
  if(h.surface)return aviationOpeningBounds(ship,h);
  if(h.bay){const p=ship.parts.find(p=>p.id===h.bay);if(!p)return null;const b=partAABB(p),axis=h.face==='port'||h.face==='stbd'?2:1,positive=h.face!=='bottom'&&h.face!=='port';
    const m=Math.max(ship.hull.W,ship.hull.H)*2;
    const inner=lerp(b[axis],b[axis+3],h.sill??.5);b[axis+(positive?0:3)]=inner;b[axis+(positive?3:0)]=p.c[axis]+(positive?m:-m);
    // Narrow openings within a bay preserve a visible frame and side wall.
    const u=axis===1?2:1,mid=p.c[u],half=(b[u+3]-b[u])*(h.aperture??.85)/2;b[u]=mid-half;b[u+3]=mid+half;b[0]+=2;b[3]-=2;
    if(axis===1&&p.room&&Math.abs(p.yaw||0)<.01){const w=p.room[1]*(h.aperture??.85)/2,a=p.aftWidth??1,f=p.foreWidth??1;const hw=x=>w*lerp(a,f,clamp((x-p.c[0])/p.room[0]+.5,0,1));b.push(hw(b[0]),hw(b[3]));}return b;
  }
  return h.cut?.slice()||null;
}
function inBox(p,b){return openingPlanes(b).every(({n,d})=>dot(n,p)<d-1e-6);}
function openingHalf(b,x,axis=2){return b.length>6&&axis===2?lerp(b[6],b[7],clamp((x-b[0])/(b[3]-b[0]),0,1)):(b[axis+3]-b[axis])/2;}
function openingPlanes(b){const planes=[];for(let a=0;a<3;a++)for(const sign of [-1,1]){const n=[0,0,0];n[a]=sign;let d=sign*b[a+(sign>0?3:0)];if(a===2&&b.length>6){const slope=(b[7]-b[6])/(b[3]-b[0]),mid=(b[2]+b[5])/2;n[0]=-slope;d=sign*mid+b[6]-slope*b[0];}planes.push({n,d});}return planes;}
function clipOpening(poly,b){for(const {n,d} of openingPlanes(b))poly=clipGeneral(poly,n,d);return poly;}
function doorFragments(poly,b,axis,open){const out=[],{longAxis:a,widthAxis:u}=hatchAxes(axis),mid=(b[u]+b[u+3])/2,hw=openingHalf(b,b[a],u)*open,slope=(openingHalf(b,b[a+3],u)*open-hw)/(b[a+3]-b[a]);for(const sign of [-1,1]){const n=[0,0,0];n[a]=-slope;n[u]=sign;const d=sign*mid+hw-slope*b[a];triangulateFan(clipGeneral(poly,mul(n,-1),-d),out);}return out;}
// Sliding doors are two rigid halves of the closed roof. Their outline is never
// scaled: a single transverse translation uncovers the tapered opening.
function isSlidingHatch(ship,h){return !!h.portal&&(h.motion==='slide'||h.motion!=='fixed'&&ship.reference==='venator'&&['top','bottom','port','stbd'].includes(h.face));}
function slidingHatchSpec(ship,h){
 if(!isSlidingHatch(ship,h))return null;const b=openingBounds(ship,h);if(!b)return null;
 const {axis,longAxis,widthAxis:slideAxis}=hatchAxes(h),travel=Math.max(openingHalf(b,b[longAxis],slideAxis),openingHalf(b,b[longAxis+3],slideAxis));
 return {b,axis,slideAxis,travel,open:clamp(h.open??0,0,1),seconds:4};
}
function slidingPanelsFromMesh(base,b,axis){
 const {widthAxis:u}=hatchAxes(axis),mid=(b[u]+b[u+3])/2,parts=[[],[]];
 for(let i=0;i<base.length;i+=9){let poly=[Array.from(base.slice(i,i+3)),Array.from(base.slice(i+3,i+6)),Array.from(base.slice(i+6,i+9))];
  if([0,1,2].some(a=>Math.max(...poly.map(p=>p[a]))<b[a]||Math.min(...poly.map(p=>p[a]))>b[a+3]))continue;
  poly=clipOpening(poly,b);for(let side=0;side<2;side++)triangulateFan(clipPoly(poly,u,mid,!!side),parts[side]);
 }
 return parts.map(p=>Float32Array.from(p));
}
function translatedSlidingPanels(base,b,axis,open){
 const {longAxis:a,widthAxis:u}=hatchAxes(axis),travel=Math.max(openingHalf(b,b[a],u),openingHalf(b,b[a+3],u)),panels=slidingPanelsFromMesh(base,b,axis),out=new Float32Array(panels[0].length+panels[1].length);let at=0;
 for(let side=0;side<2;side++){out.set(panels[side],at);const offset=(side?1:-1)*travel*clamp(open,0,1);for(let i=at+u;i<at+panels[side].length;i+=3)out[i]+=offset;at+=panels[side].length;}
 return out;
}
const SLIDING_PANEL_CACHE=new WeakMap();
function slidingHatchPanels(ship,h){
 const spec=slidingHatchSpec(ship,h);if(!spec||h.skinAsset)return [];const base=v3HullGeo(ship).tris,structures=ship.parts.filter(p=>p.k==='struct').map(p=>({p,base:unpiercedStructTriangles(p)}));
 const key=JSON.stringify([spec.b,ship.solidCuts,ship.subs]),cached=SLIDING_PANEL_CACHE.get(h);if(cached?.base===base&&cached.key===key&&structures.every((q,i)=>cached.structures[i]===q.base)&&structures.length===cached.structures.length)return cached.panels;
 const pieces=slidingPanelsFromMesh(base,spec.b,spec.axis).map(a=>[a]);
 for(const q of structures){if(!boxesOverlap(partAABB(q.p),spec.b))continue;const parts=slidingPanelsFromMesh(q.base,spec.b,spec.axis);for(let side=0;side<2;side++)pieces[side].push(parts[side]);}
 const panels=pieces.map((parts,i)=>{let tris=new Float32Array(parts.reduce((n,p)=>n+p.length,0)),at=0;for(const part of parts){tris.set(part,at);at+=part.length;}if(ship.solidCuts?.length)tris=applySolidCuts(ship,tris);return {hatchId:h.id,side:i?1:-1,axis:spec.slideAxis,travel:spec.travel,tris};});
 SLIDING_PANEL_CACHE.set(h,{key,base,structures:structures.map(q=>q.base),panels});return panels;
}
function hatchOpenArea(ship,h,opening=h.open??1){
 const b=openingBounds(ship,h);if(!b)return h.portal?0:v3HatchGrid(ship,h).area;
 const {longAxis:l,widthAxis:u}=hatchAxes(h),a=openingHalf(b,b[l],u),z=openingHalf(b,b[l+3],u),L=b[l+3]-b[l],open=clamp(opening,0,1);
 if(!isSlidingHatch(ship,h))return L*(a+z)*open;
 const travel=Math.max(a,z)*open,lo=Math.min(a,z),hi=Math.max(a,z);if(travel<=lo)return 2*L*travel;if(travel>=hi)return L*(a+z);
 const q=(travel-lo)/(hi-lo);return 2*L*((lo+travel)*q/2+travel*(1-q));
}
function hatchMotionStats(ship,S){
 const slides=ship.hatches.filter(h=>isSlidingHatch(ship,h)&&aviationHatchActive(ship,h));S.slidingHatches=slides.length;S.hatchOpenSeconds=slides.length?4:0;S.hatchCloseSeconds=slides.length?4:0;
 S.launchPotential=S.launch+slides.filter(h=>S.hatchInfo[h.id]?.connected).reduce((n,h)=>n+(hatchOpenArea(ship,h,1)-hatchOpenArea(ship,h))*(h.k==='ray'?K.launchRay:K.launchOpen),0);return S;
}
// A thin moving roof does not fill the hangar void with hull material. Keeping
// material occupancy separate from the current visible envelope also prevents
// doors from changing the mass of neighbouring structures and compartments.
function hullMaterialContains(ship,p,inside=inHull(ship,p)){if(ship.hatches.some(h=>{if(!isSlidingHatch(ship,h))return false;const b=openingBounds(ship,h);return b&&inBox(p,b);}))return false;return inside;}
function armoredMaterialArea(ship,currentArea){
 if(!ship.hatches.some(h=>isSlidingHatch(ship,h)))return currentArea;
 const state=serialize(ship);for(const h of state.hatches)if(isSlidingHatch(state,h))h.open=0;
 const key=JSON.stringify(state,(k,v)=>k==='airWings'?undefined:v);if(ship._armoredMaterial?.key===key)return ship._armoredMaterial.area;
 // The closed-door copy is rebuilt from scratch so the result never depends on
 // edit history; one locked cache serves the whole surface survey.
 const closed=state;
 syncCompartments(closed);const old=closed._lockedCache;closed._lockedCache=cache(closed);let area;
 try{area=exposedSurface(closed,allOccupied(closed));}finally{if(old)closed._lockedCache=old;else delete closed._lockedCache;}
 ship._armoredMaterial={key,area};return area;
}
function inHull(ship,p){if(solidCutsContain(ship,p))return false;if(!v3InHull(ship,p))return false;return !ship.hatches.some(h=>{const b=openingBounds(ship,h);if(!b||!inBox(p,b))return false;const {axis:ax,longAxis:l,widthAxis:u}=hatchAxes(h),mid=(b[u]+b[u+3])/2,spec=slidingHatchSpec(ship,h),half=spec?Math.min(openingHalf(b,p[l],u),spec.travel*spec.open):openingHalf(b,p[l],u)*(h.open??1);if(Math.abs(p[u]-mid)>=half){const skin=openingSurfacePoint(ship,h,p[l],p[u]);if(skin&&Math.abs(p[ax]-skin[ax])<1.9)return false;}return true;});}
function openBay(ship,bay,face='top',kind='open'){
  if(!Object.hasOwn(AVIATION_SURFACE_FACES,face))face='top';const n=aviationFaceNormal(face),{axis,longAxis,widthAxis}=hatchAxes({n}),sg=n[axis];
  const b=partAABB(bay),a=bay.c.slice(),end=bay.c.slice();a[longAxis]=b[longAxis]+2;end[longAxis]=b[longAxis+3]-2;a[axis]=end[axis]=b[axis+(sg>0?3:0)];
  const h={id:ship.nextId++,k:kind,a,b:end,n,w:b[widthAxis+3]-b[widthAxis],bay:bay.id,portal:true,surface:true,face,open:1,aperture:.85};bay.aviationSurfaces={...bay.aviationSurfaces,[face]:kind};ship.hatches.push(h);return h;
}
// Inner faces of the aperture are clipped to the original envelope; no fictitious solid block fills the mouth.
function openingInterior(ship,b){
  const out=[];
  for(let ax=0;ax<3;ax++)for(const end of [0,1]){const u=(ax+1)%3,v=(ax+2)%3,plane=b[ax+end*3],nu=Math.min(120,Math.max(1,Math.ceil((b[u+3]-b[u])/18))),nv=Math.min(100,Math.max(1,Math.ceil((b[v+3]-b[v])/18)));
    if(plane<0&&ax===0||plane>ship.hull.L&&ax===0)continue;
    const point=(i,j)=>{const p=[0,0,0];p[ax]=plane;p[u]=lerp(b[u],b[u+3],i/nu);p[v]=lerp(b[v],b[v+3],j/nv);if(b.length>6){const mid=(b[2]+b[5])/2,ratio=(p[2]-mid)/((b[5]-b[2])/2);p[2]=mid+ratio*openingHalf(b,p[0]);}return p;};
    for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){const q=[point(i,j),point(i+1,j),point(i+1,j+1),point(i,j+1)];
      for(const ids of [[0,1,2],[0,2,3]]){let poly=ids.map(k=>q[k]),cut=[];for(let k=0;k<3;k++){const a=poly[k],z=poly[(k+1)%3],ia=v3InHull(ship,a),ib=v3InHull(ship,z);if(ia)cut.push(a);if(ia!==ib){let lo=0,hi=1;for(let s=0;s<18;s++){const m=(lo+hi)/2,p=a.map((c,k)=>lerp(c,z[k],m));if(v3InHull(ship,p)===ia)lo=m;else hi=m;}cut.push(a.map((c,k)=>lerp(c,z[k],(lo+hi)/2)));}}
      if(cut.length>2){const n=cross(sub(cut[1],cut[0]),sub(cut[2],cut[0]));if(n[ax]*(end?-1:1)<0)cut.reverse();triangulateFan(cut,out);}}
    }
  }
  return Float32Array.from(out);
}
function meshVolume(T){let sum=0;for(let i=0;i<T.length;i+=9)sum+=dot(Array.from(T.slice(i,i+3)),cross(Array.from(T.slice(i+3,i+6)),Array.from(T.slice(i+6,i+9))))/6;return Math.abs(sum);}
function uncutSolidHullGeo(ship,flat=false){
  syncAviationSurfaces(ship);
  const g=v3HullGeo(ship,flat),mouths=ship.hatches.map(h=>({h,b:openingBounds(ship,h)})).filter(x=>x.b),bs=mouths.map(x=>x.b);
  for(const p of ship.parts.filter(p=>p.k==='struct'))p._apertures=mouths.map(({h,b})=>({b,open:h.open??1,axis:hatchAxes(h).axis,slide:isSlidingHatch(ship,h),detached:!!h._doorDetached})).concat(ship.subs.filter(c=>ship.hull.assembly||c.structures).map(c=>({b:c.b,open:1,axis:1})));
  if(!bs.length)return g;
  const key=JSON.stringify([cache(ship).key,bs,flat]),slot=flat?'_portalGeoFlat':'_portalGeo';if(ship[slot]?.key===key)return ship[slot].g;
  let T=g.tris;
  for(const b of bs){const cuts=subtractBoxMesh(T,b),walls=openingInterior(ship,b),joined=new Float32Array(cuts.length+walls.length);joined.set(cuts);joined.set(walls,cuts.length);T=joined;}
  if(!ship.trenches?.some(t=>t.mode==='split'))for(const cut of ship.subs)T=subtractBoxMesh(T,cut.b);
  let area=0;for(let i=0;i<T.length;i+=9)area+=len(cross(sub(Array.from(T.slice(i+3,i+6)),Array.from(T.slice(i,i+3))),sub(Array.from(T.slice(i+6,i+9)),Array.from(T.slice(i,i+3)))))/2;
  const secs=g.secs.map((s,i)=>{let poly=Array.from(s.Z,(z,j)=>[g.xs[i],s.Y[j],z]),removed=0;for(const b of bs){if(g.xs[i]<b[0]||g.xs[i]>b[3])continue;const p=clipOpening(poly,b);let ar=0;for(let j=0;j<p.length;j++){const n=p[(j+1)%p.length];ar+=p[j][2]*n[1]-n[2]*p[j][1];}removed+=Math.abs(ar)/2;}return {...s,area:Math.max(0,s.area-removed)};});
  let volume=0;for(let i=0;i<g.xs.length-1;i++)volume+=(secs[i].area+secs[i+1].area)/2*(g.xs[i+1]-g.xs[i]);
  const materialTris=T;
  for(const h of ship.hatches.filter(h=>h.portal)){const doors=doorMesh(ship,h,g.tris);if(doors.length){const joined=new Float32Array(T.length+doors.length);joined.set(T);joined.set(doors,T.length);T=joined;}}
  const result={...g,tris:T,materialTris,secs,area,volume};ship[slot]={key,g:result};return result;
}
function hatchGrid(ship,h){
  const b=openingBounds(ship,h);if(!b)return h.portal?{nl:0,nw:0,pts:[],nrm:[],area:0}:v3HatchGrid(ship,h);
  const {axis,longAxis:l,widthAxis:u}=hatchAxes(h),pts=[],nrm=[];
  for(let i=0;i<5;i++)for(let j=0;j<3;j++){const p=[0,0,0];p[l]=lerp(b[l],b[l+3],i/4);p[u]=(b[u]+b[u+3])/2+(j-1)*openingHalf(b,p[l],u);p[axis]=h.n[axis]>0?b[axis]:b[axis+3];pts.push(p);nrm.push(h.n);}
  return {nl:5,nw:3,pts,nrm,area:hatchOpenArea(ship,h)};
}
function computeStats(ship){syncCompartments(ship);ship._lockedCache=cache(ship);try{const s=v3ComputeStats(ship);s.sensorVolume=ship.parts.filter(p=>p.k==='sensor'||p.k==='scanner').reduce((n,p)=>n+partVolume(p),0);return hatchMotionStats(ship,layoutStats(ship,outfittingStats(ship,s)));}finally{delete ship._lockedCache;}}
function serialize(ship){const o=v3Serialize(ship);o.groundForces=normalizeGroundForces(ship.groundForces);for(const k of ['paint','detail','reference','hullSkin','autoHabitation','hullLocked','shipClass'])if(ship[k]!=null)o[k]=JSON.parse(JSON.stringify(ship[k]));return o;}
function deserialize(o){
  const s=v3Deserialize(o),finite=(v,lo,hi,d)=>Number.isFinite(v)?clamp(v,lo,hi):d;
  if(Array.isArray(o.hull?.stations)&&o.hull.stations.length>=2&&o.hull.stations.length<=32){const a=o.hull.stations.map((p,i)=>{const r=[finite(p?.[0],0,1,i/(o.hull.stations.length-1)),finite(p?.[1],.005,1.5,1),finite(p?.[2],.005,1.5,1)];if(p?.length>3)r.push(finite(p[3],-.5,.8,0));if(p?.length>4)r.push(finite(p[4],0,.98,.52));if(p?.length>5)r.push(finite(p[5],0,.98,0));return r;}).sort((a,b)=>a[0]-b[0]);if(a.some((p,i)=>i&&p[0]-a[i-1][0]<.001))throw new Error('船体断面の位置が重複しています');a[0][0]=0;a.at(-1)[0]=1;s.hull.stations=a;}
  if(SHIP_CLASSES.some(c=>c.id===o.shipClass))s.shipClass=o.shipClass;
  s.autoHabitation=o.autoHabitation!==false;s.hullLocked=o.hullLocked!==false;s.hull.assembly=!!o.hull?.assembly;if(o.hull?.bowFree===true)s.hull.bowFree=true;normalizeBow(s.hull);
  s.hull.deckWidth=finite(o.hull?.deckWidth,0,.98,.52);s.hull.belt=finite(o.hull?.belt,.02,.45,.13);
  if(o.hull?.start!=null)s.hull.start=finite(o.hull.start,0,.6,0);
  for(const k of ['chineHeight','keelWidth'])if(o.hull?.[k]!=null)s.hull[k]=finite(o.hull[k],k==='chineHeight'?.2:0,k==='chineHeight'?.95:.98,k==='chineHeight'?.5:0);
  if(o.hull?.maxAt!=null)s.hull.maxAt=finite(o.hull.maxAt,.05,.9,.3);
  for(const p of s.parts){const q=o.parts.find(q=>q.id===p.id);for(const [k,lo,hi,d] of [['arcInner',.05,.95,.65],['arcStart',-180,180,30],['arcSweep',5,360,300]])if(q[k]!=null)p[k]=finite(q[k],lo,hi,d);if(q.label)p.label=String(q.label).slice(0,80);if(Array.isArray(q.room)&&q.room.length===3&&PARTS[p.k].shape==='cube')setRoomSize(p,q.room.map((v,i)=>finite(v,4,DESIGN_LIMITS.partSize,40)));
    for(const k of ['aftWidth','foreWidth'])if(q[k]!=null)p[k]=finite(q[k],.03,2,1);
    if(q.loft){if(!Array.isArray(q.loft)||q.loft.length<2||q.loft.length>32)throw new Error('ロフト断面は2〜32個にしてください');p.loft=q.loft.map(a=>[finite(a?.[0],0,1,0),finite(a?.[1],.02,2,1),finite(a?.[2],.03,1.5,1),finite(a?.[3],0,1,0),...(a?.length>4?[finite(a[4],-2,2,0)]:[])]).sort((a,b)=>a[0]-b[0]);if(p.loft.some((a,i)=>a[3]>=a[2]||(i&&a[0]-p.loft[i-1][0]<.002)))throw new Error('ロフトの断面位置か上下寸法が不正です');p.loft[0][0]=0;p.loft.at(-1)[0]=1;}
    if(Array.isArray(q.skinAxial)&&q.skinAxial.length===3&&q.skinAxial.every(v=>Number.isFinite(v)&&v>0&&v<=10000))p.skinAxial=q.skinAxial.slice();
    if(q.engineLength!=null)p.engineLength=finite(q.engineLength,4,DESIGN_LIMITS.engineLength,100);
    for(const k of ['nozzleLength','throatRatio','wallInset'])if(q[k]!=null)p[k]=finite(q[k],k==='nozzleLength'?2:0,k==='nozzleLength'?DESIGN_LIMITS.engineDiameter:1,k==='throatRatio'?.38:0);
    if(q.outline){if(!validOutline(q.outline)||q.outline.some(a=>a.some(v=>Math.abs(v)>2)))throw new Error('輪郭が交差しているか、頂点が不正です');p.outline=q.outline.map(a=>a.slice());}if(q.deckSlope!=null)p.deckSlope=finite(q.deckSlope,-60,60,0);
    if(q.ridge!=null)p.ridge=finite(q.ridge,-1000,1000,0);
    if(['armor','service','plain'].includes(q.skin))p.skin=q.skin;
    if(REFERENCE_ASSETS[q.skinAsset]){p.skinAsset=q.skinAsset;for(const k of ['skinAnchor','skinSize'])if(Array.isArray(q[k])&&q[k].length===3&&q[k].every(Number.isFinite))p[k]=q[k].slice();if(Number.isFinite(q.skinDiameter))p.skinDiameter=finite(q.skinDiameter,1,1000,p.d);}
    if(p.k==='hangar'&&Object.hasOwn(AVIATION_ROLES,q.airRole))p.airRole=q.airRole;
    if(Array.isArray(q.arcBands)&&q.arcBands.length<=12&&q.arcBands.every(a=>Array.isArray(a)&&a.length===2&&a.every(Number.isFinite)&&a[0]>=0&&a[1]<=1&&a[0]<a[1]))p.arcBands=q.arcBands.map(a=>a.slice());
    if(Array.isArray(q.bands)&&q.bands.length<=12&&q.bands.every(a=>Array.isArray(a)&&a.length===2&&a.every(Number.isFinite)&&a[0]>=0&&a[1]<=1&&a[0]<a[1]))p.bands=q.bands.map(a=>a.slice());
    if(p.k==='struct'||p.room){if(Array.isArray(q.surfaceNormal)&&q.surfaceNormal.length===3&&q.surfaceNormal.every(Number.isFinite)&&len(q.surfaceNormal)>.001)p.surfaceNormal=norm(q.surfaceNormal);if(q.pitch!=null)p.pitch=finite(q.pitch,-180,180,0);if(q.roll!=null)p.roll=finite(q.roll,-180,180,0);}
    if(q.corner!=null)p.corner=finite(q.corner,0,.45,.12);if(q.length!=null)p.length=finite(q.length,2,DESIGN_LIMITS.partSize,p.d*1.5);if(q.bodyLength!=null)p.bodyLength=finite(q.bodyLength,2,DESIGN_LIMITS.engineLength,p.d*2.2);if(q.bodyRadius!=null)p.bodyRadius=finite(q.bodyRadius,.3,.8,.52);if(q.yaw!=null)p.yaw=finite(q.yaw,-180,180,0);if(p.dir&&len(p.dir)<.1)p.dir=[-1,0,0];if(/^#[0-9a-f]{6}$/i.test(q.paint))p.paint=q.paint;if(q.ribSpacing!=null)p.ribSpacing=finite(q.ribSpacing,0,100,12);
  }
  for(const p of s.parts){const q=o.parts.find(q=>q.id===p.id);if(q.customEquipment===true)p.customEquipment=true;if(typeof q.autoFit==='boolean')p.autoFit=q.autoFit;if(((Object.hasOwn(EQUIPMENT,q.equipmentId)&&EQUIPMENT[q.equipmentId].k===p.k)||(p.k==='engine'&&Object.hasOwn(LEGACY_ENGINES,q.equipmentId))))p.equipmentId=q.equipmentId;}
  adoptEquipment(s);
  for(const h of s.hatches){const q=o.hatches.find(q=>q.id===h.id);if(h.tw==null)delete h.tw;if(q.portal){h.portal=true;h.face=Object.hasOwn(AVIATION_SURFACE_FACES,q.face)?q.face:'top';if(q.surface)h.surface=true;h.open=finite(q.open,0,1,1);h.aperture=finite(q.aperture,.1,1,.85);if(q.sill!=null)h.sill=finite(q.sill,0,1,.5);if(s.parts.some(p=>p.id===q.bay&&p.k==='hangar'))h.bay=q.bay;else if(Array.isArray(q.cut)&&q.cut.length===6&&q.cut.every(Number.isFinite))h.cut=q.cut.map(v=>clamp(v,-DESIGN_LIMITS.coordinate,DESIGN_LIMITS.coordinate));}}
  s.paint=['republic','neutral','dark'].includes(o.paint)?o.paint:'neutral';s.detail=finite(o.detail,0,2,1);if(o.reference)s.reference=String(o.reference).slice(0,80);for(const h of s.hatches){const q=o.hatches.find(q=>q.id===h.id);if(q.motion==='fixed')h.motion='fixed';else if(q.motion==='slide'||isSlidingHatch(s,h))h.motion='slide';}if(REFERENCE_ASSETS[o.hullSkin?.asset]?.kind==='hull'&&o.hullSkin.base?.hull){const b=o.hullSkin.base,valid=[b.hull.L,b.hull.W,b.hull.H].every(v=>Number.isFinite(v)&&v>0&&v<=4000)&&Array.isArray(b.hull.stations)&&b.hull.stations.length>=2&&b.hull.stations.length<=64&&b.hull.stations.every(a=>Array.isArray(a)&&a.length>=3&&a.every(Number.isFinite))&&Array.isArray(b.trenches)&&b.trenches.length<=30&&Array.isArray(b.cuts)&&b.cuts.length<=50;if(valid){s.hullSkin=JSON.parse(JSON.stringify(o.hullSkin));s.hullSkin.enabled=!!o.hullSkin.enabled;}}for(const f of s.fits){const q=o.fits.find(q=>q.id===f.id);if(q.localMount)f.localMount=true;if(typeof q.batteryZone==='string')f.batteryZone=q.batteryZone.slice(0,40);if(FITS[f.k].window){f.commandEnabled=q.commandEnabled!==false;if(q.commandDepth!=null)f.commandDepth=finite(q.commandDepth,2,200,12);if(q.commandHeight!=null)f.commandHeight=finite(q.commandHeight,2,80,8);}if(Number.isFinite(q.chargeSalvos))f.chargeSalvos=finite(q.chargeSalvos,1,20,1);if(Number.isFinite(q.chargeDepth))f.chargeDepth=finite(q.chargeDepth,1,500,10);if(Number.isFinite(q.chargeScale))f.chargeScale=finite(q.chargeScale,.25,4,1);if(Number.isFinite(q.assetYaw))f.assetYaw=finite(q.assetYaw,-180,180,0);if(Number.isFinite(q.scale))f.scale=finite(q.scale,.25,4,1);if(Number.isInteger(q.mountAxis)&&q.mountAxis>=0&&q.mountAxis<=5)f.mountAxis=q.mountAxis;if(Number.isFinite(q.mountOffset))f.mountOffset=finite(q.mountOffset,-50,50,0);if(REFERENCE_ASSETS[q.skinAsset])f.skinAsset=q.skinAsset;}for(const h of s.hatches){const q=o.hatches.find(q=>q.id===h.id);if(q.referenceMouth)h.referenceMouth=true;if(REFERENCE_ASSETS[q.skinAsset]){h.skinAsset=q.skinAsset;if(Array.isArray(q.skinBayAnchor)&&q.skinBayAnchor.length===3&&q.skinBayAnchor.every(Number.isFinite))h.skinBayAnchor=q.skinBayAnchor.slice();}}migrateAviationSurfaces(s,o);migrateAviation(s,o);s.groundForces=normalizeGroundForces(o.groundForces);
  // Old window rows on a model bridge repeat the role the body now carries.
  for(const p of s.parts){const q=o.parts.find(q=>q.id===p.id);if(bridgeBodyRole(p)){if(['bridge','air','hangar','combat'].includes(q.commandRole))p.commandRole=q.commandRole;if(q.commandEnabled===false)p.commandEnabled=false;}}
  const dropped=new Set(s.fits.filter(f=>f.legacyWindow&&bridgeBodyRole(s.parts.find(p=>p.id===f.host))===FITS[f.k].role).map(f=>f.id));
  s.fits=s.fits.filter(f=>!dropped.has(f.id));for(const f of s.fits){delete f.legacyWindow;if(dropped.has(f.tw))delete f.tw;}
  return s;
}

function pointInRing(x,y,ring){let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
function loftProfile(p,t){const a=p.loft||[[0,p.aftWidth??1,1,0],[1,p.foreWidth??1,1,0]];let i=0;while(i<a.length-2&&t>a[i+1][0])i++;const u=clamp((t-a[i][0])/(a[i+1][0]-a[i][0]),0,1);return [t,...[1,2,3,4].map(k=>lerp(a[i][k]??0,a[i+1][k]??0,u))];}
function loftRing(p,row){const [t,w,h,floor=0]=row,[L,W,H]=p.s,x=(t-.5)*L,b=(floor-.5)*H,top=(h-.5)*H,hw=w*W/2,bevel=Math.min(hw*.45,(top-b)*.45,Math.min(W,H)*(p.corner??.08)),inset=clamp(p.wallInset??0,0,.8)*hw;
 if(p.form==='roundloft')return Array.from({length:32},(_,j)=>{const a=j/32*Math.PI*2;return [x,(top+b)/2+Math.sin(a)*(top-b)/2,Math.cos(a)*hw+(row[4]||0)*W/2];});
 return [[-hw+bevel,b],[0,b],[hw-bevel,b],[hw,b+bevel],[hw-inset,top-bevel],[hw-inset-bevel,top],[0,top],[-hw+inset+bevel,top],[-hw+inset,top-bevel],[-hw,b+bevel]].map(([z,y])=>[x,y-(p.ridge||0)*Math.abs(z)/(W/2),z+(row[4]||0)*W/2]);}
function loftTriangles(p){const key=JSON.stringify([p.c,p.s,p.form,p.loft,p.surfaceNormal,p.pitch,p.roll,p.yaw,p.corner,p.aftWidth,p.foreWidth,p.wallInset,p.ridge]);if(p._loft?.key===key)return p._loft.tris;const rows=p.loft||[[0,p.aftWidth??1,1,0],[1,p.foreWidth??1,1,0]],local=rows.map(a=>loftRing(p,a)),rings=local.map(r=>r.map(q=>worldStruct(p,q))),T=[],N=rings[0].length;
 for(let j=0;j<rings.length-1;j++)for(let i=0;i<N;i++){const k=(i+1)%N;T.push(...rings[j][i],...rings[j+1][i],...rings[j+1][k],...rings[j][i],...rings[j+1][k],...rings[j][k]);}
 // Each half of a crowned section is convex. Cap them independently so the
 // end faces never span the empty space below the centre ridge.
 for(const j of [0,rings.length-1])for(const side of [false,true]){const ring=clipPoly(local[j],2,(rows[j][4]||0)*p.s[1]/2,side).map(q=>worldStruct(p,q));if(ring.length<3)continue;const c=mul(ring.reduce((a,b)=>add(a,b),[0,0,0]),1/ring.length);for(let i=0;i<ring.length;i++){const k=(i+1)%ring.length;T.push(...c,...ring[j===0?i:k],...ring[j===0?k:i]);}}
 p._loft={key,tris:Float32Array.from(T)};return p._loft.tris;}
function openingSurfacePoint(ship,h,x,v){const {axis:ax,longAxis:l,widthAxis:u}=hatchAxes(h);if(h.surface){const bay=ship.parts.find(p=>p.id===h.bay),hit=bay&&aviationSurfaceHit(ship,bay,h,x,v);return hit?add(hit.p,mul(h.n,.9)):null;}const p=[0,0,0],skin=originalSurface(ship,x,ax,v,h.n[ax]);if(skin==null)return null;p[l]=x;p[u]=v;p[ax]=skin+h.n[ax]*.9;return p;}

function originalSurface(ship,x,axis,value,sign){
  if(ship.hull.assembly){const o=[x,0,0],d=[0,0,0];o[axis]=sign*12000;o[axis===1?2:1]=value;d[axis]=-sign;let hit=null;for(const p of ship.parts.filter(p=>p.k==='struct')){const h=rayTris(unpiercedStructTriangles(p),o,d);if(h&&(!hit||h.t<hit.t))hit=h;}return hit?hit.p[axis]:null;}
  if(x<(ship.hull.start||0)*ship.hull.L||x>ship.hull.L)return null;const s=sampleSection(ship,x),out=[];
  for(let i=0;i<s.Z.length;i++){const j=(i+1)%s.Z.length,a=axis===1?s.Z[i]:s.Y[i],b=axis===1?s.Z[j]:s.Y[j];if(Math.abs(b-a)<1e-7)continue;const t=(value-a)/(b-a);if(t>=-1e-7&&t<=1+1e-7)out.push(axis===1?lerp(s.Y[i],s.Y[j],t):lerp(s.Z[i],s.Z[j],t));}
  return out.length?(sign>0?Math.max(...out):Math.min(...out)):null;
}
function doorMesh(ship,h,base){
  const b=openingBounds(ship,h),open=h.open??1;if(!b||h._doorDetached)return new Float32Array();
  if(isSlidingHatch(ship,h))return translatedSlidingPanels(base,b,hatchAxes(h).axis,open);
  if(open>=.999)return new Float32Array();
  const {axis:ax,widthAxis:u}=hatchAxes(h),mid=(b[u]+b[u+3])/2,half=(b[u+3]-b[u])/2*open,out=[];
  for(let i=0;i<base.length;i+=9){let poly=[Array.from(base.slice(i,i+3)),Array.from(base.slice(i+3,i+6)),Array.from(base.slice(i+6,i+9))];
    if([0,1,2].some(a=>Math.max(...poly.map(p=>p[a]))<b[a]||Math.min(...poly.map(p=>p[a]))>b[a+3]))continue;
    poly=clipOpening(poly,b);out.push(...doorFragments(poly,b,ax,open));
  }
  return Float32Array.from(out);
}
function clipGeneral(poly,normal,d){const out=[],distance=p=>d-dot(normal,p);for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=distance(a),db=distance(b),ia=da>=-1e-6,ib=db>=-1e-6;if(ia)out.push(a);if(ia!==ib){const t=da/(da-db);out.push(a.map((v,k)=>lerp(v,b[k],t)));}}return out;}
function convexCutCaps(T,b){
  const planes=[];for(let i=0;i<T.length;i+=9){const a=Array.from(T.slice(i,i+3)),n=norm(cross(sub(Array.from(T.slice(i+3,i+6)),a),sub(Array.from(T.slice(i+6,i+9)),a))),d=dot(a,n);if(len(n)<.1||planes.some(p=>Math.abs(dot(p.n,n)-1)<1e-5&&Math.abs(p.d-d)<1e-4))continue;planes.push({n,d});}
  const out=[];for(let ax=0;ax<3;ax++)for(const end of [0,1]){const u=(ax+1)%3,v=(ax+2)%3;let poly=[[0,0],[1,0],[1,1],[0,1]].map(([i,j])=>{const p=[0,0,0];p[ax]=b[ax+end*3];p[u]=b[u+i*3];p[v]=b[v+j*3];if(b.length>6){const mid=(b[2]+b[5])/2;p[2]=mid+(p[2]-mid)/((b[5]-b[2])/2)*openingHalf(b,p[0]);}return p;});for(const p of planes){poly=clipGeneral(poly,p.n,p.d);if(poly.length<3)break;}if(poly.length>2){const n=cross(sub(poly[1],poly[0]),sub(poly[2],poly[0]));if(n[ax]*(end?-1:1)<0)poly.reverse();triangulateFan(poly,out);}}
  return Float32Array.from(out);
}
function structDoorSkin(T,m){
  if(m.detached)return new Float32Array();if(m.slide)return translatedSlidingPanels(T,m.b,m.axis,m.open);
  if(m.open>=.999)return new Float32Array();const out=[],b=m.b,{widthAxis:u}=hatchAxes(m.axis),mid=(b[u]+b[u+3])/2,half=(b[u+3]-b[u])/2*m.open;
  for(let i=0;i<T.length;i+=9){const poly=clipOpening([Array.from(T.slice(i,i+3)),Array.from(T.slice(i+3,i+6)),Array.from(T.slice(i+6,i+9))],b);out.push(...doorFragments(poly,b,m.axis,m.open));}return Float32Array.from(out);
}
function uncutSolidStructTriangles(p){
  const base=unpiercedStructTriangles(p),ms=p._apertures;if(!ms?.length)return base;
  const key=JSON.stringify(ms);if(p._pierced?.base===base&&p._pierced.key===key)return p._pierced.t;
  const bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];for(let i=0;i<base.length;i++){const a=i%3;bounds[a]=Math.min(bounds[a],base[i]);bounds[a+3]=Math.max(bounds[a+3],base[i]);}
  let material=base;const doors=[];for(const m of ms){if(!boxesOverlap(bounds,m.b))continue;const a=subtractBoxMesh(material,m.b),cap=['arc','roundloft','outline','loft'].includes(p.form)?solidCutCaps(p,m.b):convexCutCaps(base,m.b),out=new Float32Array(a.length+cap.length);out.set(a);out.set(cap,a.length);material=out;doors.push(structDoorSkin(base,m));}
  const T=new Float32Array(material.length+doors.reduce((n,a)=>n+a.length,0));T.set(material);let off=material.length;for(const door of doors){T.set(door,off);off+=door.length;}p._pierced={base,key,t:T,material};return T;
}
function inStruct(p,q){return !solidPartCutContains(p,q)&&unpiercedInStruct(p,q)&&!(p._apertures||[]).some(m=>inBox(q,m.b));}
function insideOriginalEnvelope(ship,q){if(ship.subs.some(c=>(ship.hull.assembly||c.structures)&&inBox(q,c.b)))return false;if(!solidCutsContain(ship,q)&&v3InHull(ship,q))return true;if(solidCutsContain(ship,q,true))return false;const bounds=ship._clipEnvelope?.structs;return bounds?bounds.some(({p,b})=>q.every((v,i)=>v>=b[i]-.01&&v<=b[i+3]+.01)&&unpiercedInStruct(p,q)):ship.parts.some(p=>p.k==='struct'&&unpiercedInStruct(p,q));}
function fitRoomToEnvelope(ship,p){
  if(!p.room)throw new Error('長さ・幅・高さを持つ区画を選んでください');
  const initial=p.room.slice();
  const fits=q=>{const T=unpiercedStructTriangles(roomShape(q)),seen=new Set();for(let i=0;i<T.length;i+=3){const a=Array.from(T.slice(i,i+3)),key=a.map(v=>v.toFixed(3)).join(',');if(seen.has(key))continue;seen.add(key);const at=add(q.c,mul(sub(a,q.c),.997));if(!insideOriginalEnvelope(ship,at))return false;}return true;};
  for(let i=0;i<=36;i++){const scale=Math.pow(.96,i),q={...p,room:initial.map(x=>Math.max(4,x*scale))};if(fits(q)){setRoomSize(p,q.room.map(x=>Math.round(x*100)/100));return scale;}}
  throw new Error('中心点を外殻内へ移動してから再調整してください');
}

// A closed ellipsoidal envelope: the same surface drives rendering, containment,
// ray picking, armor area and editable reactor-bulge geometry.
function ellipsoidTriangles(p){
 const key=JSON.stringify([p.c,p.s,p.surfaceNormal,p.pitch,p.roll,p.yaw]);if(p._ellipse?.key===key)return p._ellipse.t;
 const T=[],N=48,M=24,point=(i,j)=>{const a=i/M*Math.PI,b=j/N*Math.PI*2;return worldStruct(p,[p.s[0]/2*Math.sin(a)*Math.cos(b),p.s[2]/2*Math.cos(a),p.s[1]/2*Math.sin(a)*Math.sin(b)]);};
 const put=(a,b,c)=>{if(len(cross(sub(b,a),sub(c,a)))<1e-7)return;if(dot(cross(sub(b,a),sub(c,a)),sub(a,p.c))<0)[b,c]=[c,b];T.push(...a,...b,...c);};
 for(let i=0;i<M;i++)for(let j=0;j<N;j++){const a=point(i,j),b=point(i+1,j),c=point(i+1,j+1),d=point(i,j+1);put(a,b,c);put(a,c,d);}
 p._ellipse={key,t:Float32Array.from(T)};return p._ellipse.t;
}

// Internal systems retain their requested dimensions; their usable solid is clipped
// by the hull and structural envelope. External machinery and fittings stay free.
const INTERNAL_PARTS=new Set(['aux','hyper','fuel','pump','battery','hangar','inertial','integrity','repulsor','crew','troops','vehicle','cargo','service','command','firecontrol']);
function isInternal(p){return INTERNAL_PARTS.has(p.k);}
function inPart(p,q){return p._packing?packingContains(p,q):unclippedInPart(p,q)&&(!p._envelope||!isInternal(p)||insideOriginalEnvelope(p._envelope,q));}
function partVolume(p){return p._packing?p._packing.volume:p._clip?p._clip.volume:unclippedPartVolume(p);}
function partArea(p){return p._packing?p._packing.area:p._clip?p._clip.area:unclippedPartArea(p);}
function volSamples(p){return p._packing?packingSamples(p):unclippedVolSamples(p).filter(q=>!p._envelope||!isInternal(p)||insideOriginalEnvelope(p._envelope,q));}
function surfSamples(p,e=0){
 if(!p._packing&&!p._clip)return unclippedSurfSamples(p,e);
 const clip=p._packing||p._clip;
 if(!clip.surfaceSamples){
  const T=clip.tris,out=[],count=Math.min(384,T.length/9),step=clip.area/Math.max(1,count);let cumulative=0,target=step/2;
  // Equal-area samples keep shield/protection estimates independent of the
  // tessellation density and avoid scanning thousands of faces on every edit.
  for(let i=0;i<T.length&&out.length<count;i+=9){
   const a=Array.from(T.slice(i,i+3)),b=Array.from(T.slice(i+3,i+6)),c=Array.from(T.slice(i+6,i+9)),n=cross(sub(b,a),sub(c,a)),area=len(n)/2;
   cumulative+=area;if(area<1e-10)continue;
   while(target<cumulative&&out.length<count){out.push({c:mul(add(add(a,b),c),1/3),n:norm(n)});target+=step;}
  }
  clip.surfaceSamples=out;
 }
 return clip.surfaceSamples.map(q=>add(q.c,mul(q.n,e)));
}
function rayPart(o,d,p){return p._packing?rayTris(p._packing.tris,o,d):p._clip?rayTris(p._clip.tris,o,d):unclippedRayPart(o,d,p);}
function syncCompartments(ship){
 if(ship._client)return;
 syncAviationSurfaces(ship);
 for(const p of ship.parts)if(p.k==='struct')p._solidCutShip=ship;
 const envelopeKey=JSON.stringify([ship.hull,ship.cuts,ship.subs,ship.trenches,ship.solidCuts,ship.parts.filter(p=>p.k==='struct')],(k,v)=>k.startsWith('_')?undefined:v);
 const interiorKey=envelopeKey+JSON.stringify([ship.parts,ship.fits,ship.hatches],(k,v)=>k.startsWith('_')?undefined:v);
 if(ship._interiorKey===interiorKey)return;
 const occupied=allOccupied(ship);for(const p of occupied){delete p._packing;delete p._packingGroup;}
 if(ship._clipEnvelope?.key!==envelopeKey)ship._clipEnvelope={key:envelopeKey,structs:ship.parts.filter(p=>p.k==='struct').map(p=>({p,b:partAABB({...p,_apertures:null})}))};
 const oldLock=ship._lockedCache;ship._lockedCache=cache(ship);
 try{for(const p of [...ship.parts,...weaponCapacitors(ship),...commandCompartments(ship)]){if(!isInternal(p))continue;p._envelope=ship;
   const key=envelopeKey+JSON.stringify(p,(k,v)=>k.startsWith('_')?undefined:v);if(p._clipKey===key)continue;
   delete p._clip;const v=unclippedPartVolume(p),samples=unclippedSurfSamples(p).concat(unclippedVolSamples(p),[p.c]);
   // Also probe long edges to catch a hull shoulder/notch between vertices.
   const b=partAABB(p);for(let ix=0;ix<=12;ix++)for(const iy of [0,.5,1])for(const iz of [0,.5,1]){const q=[lerp(b[0],b[3],ix/12),lerp(b[1],b[4],iy),lerp(b[2],b[5],iz)];if(unclippedInPart(p,q))samples.push(q);}
   if(samples.some(q=>!insideOriginalEnvelope(ship,q))){const tris=clipCompartmentMesh(ship,p,b),volume=meshVolume(tris);let area=0;for(let i=0;i<tris.length;i+=9){const a=Array.from(tris.slice(i,i+3)),c=Array.from(tris.slice(i+6,i+9)),bb=Array.from(tris.slice(i+3,i+6));area+=len(cross(sub(bb,a),sub(c,a)))/2;}p._clip={tris,volume:Math.min(v,volume),area,requestedVolume:v,retained:v?Math.min(1,volume/v):0};}
   p._clipKey=key;
 }integrateCompartments(ship,occupied);ship._interiorKey=interiorKey;}finally{if(oldLock)ship._lockedCache=oldLock;else delete ship._lockedCache;}
}
function clipCompartmentMesh(ship,p,b){
 // Marching tetrahedra with bisected boundary edges. This closes the cut faces
 // and gives the renderer, capacity and mass one shared clipped solid.
 const span=[0,1,2].map(i=>b[i+3]-b[i]),step=Math.max(...span)/28,pad=.04,ns=span.map(v=>Math.max(4,Math.min(40,Math.ceil(v/Math.max(.5,step))+2))),[nx,ny,nz]=ns,pts=[],inside=[];
 const index=(x,y,z)=>(x*(ny+1)+y)*(nz+1)+z,solid=q=>unclippedInPart(p,q)&&insideOriginalEnvelope(ship,q);
 for(let x=0;x<=nx;x++)for(let y=0;y<=ny;y++)for(let z=0;z<=nz;z++){const q=[x/nx,y/ny,z/nz].map((v,i)=>lerp(b[i]-pad,b[i+3]+pad,v));pts.push(q);inside.push(solid(q));}
 const edges=new Map(),T=[],tetra=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
 const edge=(a,b)=>{const key=a<b?a+':'+b:b+':'+a;if(edges.has(key))return edges.get(key);const A=pts[a],B=pts[b];let lo=0,hi=1;for(let i=0;i<13;i++){const t=(lo+hi)/2,q=A.map((v,k)=>lerp(v,B[k],t));if(solid(q)===inside[a])lo=t;else hi=t;}const q=A.map((v,k)=>lerp(v,B[k],(lo+hi)/2));edges.set(key,q);return q;};
 for(let x=0;x<nx;x++)for(let y=0;y<ny;y++)for(let z=0;z<nz;z++){
  const cube=[[x,y,z],[x+1,y,z],[x+1,y+1,z],[x,y+1,z],[x,y,z+1],[x+1,y,z+1],[x+1,y+1,z+1],[x,y+1,z+1]].map(a=>index(...a));
  if(cube.every(i=>inside[i])||cube.every(i=>!inside[i]))continue;
  for(const ts of tetra){const ids=ts.map(i=>cube[i]),a=ids.filter(i=>inside[i]),b=ids.filter(i=>!inside[i]);if(!a.length||!b.length)continue;
   const poly=[];for(const i of a)for(const j of b)poly.push(edge(i,j));const center=mul(poly.reduce((s,q)=>add(s,q),[0,0,0]),1/poly.length),direction=norm(sub(mul(b.reduce((s,i)=>add(s,pts[i]),[0,0,0]),1/b.length),mul(a.reduce((s,i)=>add(s,pts[i]),[0,0,0]),1/a.length))),f=frameAxis(direction);
   poly.sort((p,q)=>Math.atan2(dot(sub(p,center),f.v),dot(sub(p,center),f.w))-Math.atan2(dot(sub(q,center),f.v),dot(sub(q,center),f.w)));
   if(dot(cross(sub(poly[1],poly[0]),sub(poly[2],poly[0])),direction)<0)poly.reverse();triangulateFan(poly,T);
  }
 }
 return Float32Array.from(T);
}

// Flexible internal rooms share a packing group but keep separate functions and
// volume budgets. The derived solids are disjoint; no capacity is counted twice.
// Anchored flight decks, windows and physical machinery retain their geometry.
function flexibleCompartment(ship,p){
 return isInternal(p)&&PARTS[p.k]?.shape==='cube'&&p.autoFit!==false&&!p.windowId&&!ship.hatches.some(h=>h.bay===p.id)&&!(p.k==='hangar'&&['flight','dock'].includes(p.airRole));
}
function hardConflicts(ship,p,ignore=[]){return conflicts(ship,p,ignore).filter(q=>!flexibleCompartment(ship,p)&&!flexibleCompartment(ship,q));}
function packingBounds(boxes,c=[0,0,0]){return boxes.length?[0,1,2].map(i=>Math.min(...boxes.map(b=>b[i]))).concat([3,4,5].map(i=>Math.max(...boxes.map(b=>b[i])))):c.concat(c);}
function boxVolume(b){return (b[3]-b[0])*(b[4]-b[1])*(b[5]-b[2]);}
function packingContains(p,q){return p._packing.boxes.some(b=>q.every((v,i)=>v>=b[i]-1e-8&&v<=b[i+3]+1e-8));}
function packingSamples(p){
 const a=p._packing;if(a.samples)return a.samples;const out=[],N=192,step=a.volume/N;let total=0,target=step/2;
 for(const b of a.boxes){total+=boxVolume(b);while(out.length<N&&target<total){const n=out.length+1;out.push([0,1,2].map(i=>lerp(b[i],b[i+3],.1+.8*((n*[.61803398875,.41421356237,.73205080757][i])%1))));target+=step;}}
 return a.samples=out;
}
function mergePackingBoxes(boxes){
 // Merge complete face neighbours to keep the derived geometry compact.
 let result=boxes;for(let pass=0;pass<3;pass++)for(let axis=0;axis<3;axis++){
  const groups=new Map(),other=[0,1,2].filter(i=>i!==axis);
  for(const b of result){const key=other.flatMap(i=>[b[i],b[i+3]]).map(v=>v.toFixed(7)).join(',');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(b);}
  result=[];for(const list of groups.values()){list.sort((a,b)=>a[axis]-b[axis]);let prev=null;for(const b of list){if(prev&&Math.abs(prev[axis+3]-b[axis])<1e-7)prev[axis+3]=b[axis+3];else{prev=b.slice();result.push(prev);}}}
 }return result;
}
function packingMesh(boxes){
 const T=[];let area=0;
 for(const b of boxes)for(let ax=0;ax<3;ax++)for(const side of [0,1]){
  const u=(ax+1)%3,v=(ax+2)%3,plane=b[ax+3*side],normal=[0,0,0];normal[ax]=side?1:-1;
  let rects=[[b[u],b[v],b[u+3],b[v+3]]];
  for(const other of boxes){if(other===b||Math.abs(other[ax+(side?0:3)]-plane)>1e-7)continue;
   const next=[];for(const r of rects){const x0=Math.max(r[0],other[u]),y0=Math.max(r[1],other[v]),x1=Math.min(r[2],other[u+3]),y1=Math.min(r[3],other[v+3]);
    if(x0>=x1-1e-8||y0>=y1-1e-8){next.push(r);continue;}
    for(const q of [[r[0],r[1],x0,r[3]],[x1,r[1],r[2],r[3]],[x0,r[1],x1,y0],[x0,y1,x1,r[3]]])if(q[2]-q[0]>1e-8&&q[3]-q[1]>1e-8)next.push(q);
   }rects=next;if(!rects.length)break;
  }
  for(const r of rects){const ps=[[r[0],r[1]],[r[2],r[1]],[r[2],r[3]],[r[0],r[3]]].map(([a,c])=>{const q=[0,0,0];q[ax]=plane;q[u]=a;q[v]=c;return q;});if(!side)ps.reverse();triangulateFan(ps,T);area+=(r[2]-r[0])*(r[3]-r[1]);}
 }return {tris:Float32Array.from(T),area};
}
function packingObstacleHits(p,b,bounds){
 if(!boxesOverlap(bounds,b,1e-7))return false;
 if(p._packing)return p._packing.boxes.some(a=>boxesOverlap(a,b,1e-7));
 if(PARTS[p.k]?.shape==='sphere'&&!p.room){const q=p.c.map((x,i)=>clamp(x,b[i],b[i+3]));return dot(sub(q,p.c),sub(q,p.c))<(p.d/2+.001)**2;}
 // Bounds of fixed rooms and machinery are deliberately conservative. Packing
 // cannot carve through an engine, an airway or a source model's hidden solid.
 return true;
}
function packFlexibleVolume(ship,p,volume,obstacles,clashes){
 const original=partAABB(p),dims=[0,1,2].map(i=>original[i+3]-original[i]);
 const unit=Math.cbrt(Math.max(volume,1)/384),cell=dims.map(d=>Math.max(.25,Math.min(d/3,Math.max(unit/4,Math.min(unit*4,d/8)))));
 const longest=dims.indexOf(Math.max(...dims));cell[longest]*=Math.max(1,volume/(2048*cell.reduce((a,b)=>a*b,1)));const dv=cell.reduce((a,b)=>a*b,1);
 const origin=p.c.slice(),escape=Math.max(0,...clashes.map(q=>{const b=partAABB(q);return Math.max(0,Math.min(...[0,1,2].flatMap(i=>[origin[i]-b[i],b[i+3]-origin[i]])));}));
 const radius=Math.max(Math.cbrt(Math.max(volume,1))*3,Math.max(...dims)*.65,escape+Math.cbrt(Math.max(volume,1))*2),R=cell.map(c=>Math.ceil(radius/c));
 const region=origin.map((v,i)=>v-radius-cell[i]).concat(origin.map((v,i)=>v+radius+cell[i]));
 const near=obstacles.map(p=>({p,b:partAABB(p)})).filter(x=>boxesOverlap(x.b,region));
 const mouths=ship.hatches.map(h=>openingBounds(ship,h)).filter(b=>b&&boxesOverlap(b,region));
 const cuts=ship.subs.filter(q=>ship.hull.assembly||q.structures).map(q=>q.b).filter(b=>boxesOverlap(b,region));
 const coord=(i,j,k)=>origin.map((v,a)=>v+[i,j,k][a]*cell[a]),bounds=(i,j,k)=>{const c=coord(i,j,k);return c.map((v,a)=>v-cell[a]/2).concat(c.map((v,a)=>v+cell[a]/2));};
 const cache=new Map(),key=(i,j,k)=>i+','+j+','+k;
 const valid=(i,j,k)=>{
  const id=key(i,j,k);if(cache.has(id))return cache.get(id);let ok=false;
  if(Math.abs(i)<=R[0]&&Math.abs(j)<=R[1]&&Math.abs(k)<=R[2]){const b=bounds(i,j,k);ok=!near.some(x=>packingObstacleHits(x.p,b,x.b))&&!mouths.some(q=>boxesOverlap(q,b))&&!cuts.some(q=>boxesOverlap(q,b));
   if(ok)for(const x of [0,.5,1])for(const y of [0,.5,1])for(const z of [0,.5,1]){if(!insideOriginalEnvelope(ship,[x,y,z].map((t,a)=>lerp(b[a],b[a+3],t)))){ok=false;break;}}
  }cache.set(id,ok);return ok;
 };
 const heap=[],seen=new Set();
 const push=(ijk,parent=null)=>{const id=key(...ijk);if(seen.has(id)||ijk.some((v,i)=>Math.abs(v)>R[i]))return;seen.add(id);const item={ijk,parent,cost:ijk.reduce((n,v,i)=>n+(v*cell[i])**2,0)};let i=heap.length;heap.push(item);while(i){const j=(i-1)>>1;if(heap[j].cost<=item.cost)break;heap[i]=heap[j];i=j;}heap[i]=item;};
 const pop=()=>{const out=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let j=i*2+1;if(j+1<heap.length&&heap[j+1].cost<heap[j].cost)j++;if(heap[j].cost>=last.cost)break;heap[i]=heap[j];i=j;}heap[i]=last;}return out;};
 const neighbours=([i,j,k])=>[[i-1,j,k],[i+1,j,k],[i,j-1,k],[i,j+1,k],[i,j,k-1],[i,j,k+1]];
 let boxes=[],retained=0,visits=0;const finished=new Set();
 // A tiny pocket near the anchor must not hide a larger neighbouring space.
 // Try separate connected regions, retaining one region rather than scattering
 // a functional room into disconnected cells.
 for(let attempt=0;attempt<12&&visits<36000&&retained<volume-1e-7;attempt++){
  heap.length=0;seen.clear();push([0,0,0]);
  for(const {b} of near)for(let axis=0;axis<3;axis++)for(const side of [0,1]){const q=origin.slice();q[axis]=b[axis+side*3]+(side?1:-1)*cell[axis]*.501;push(q.map((v,i)=>Math.round((v-origin[i])/cell[i])));}
  let seed=null,search=0;
  while(heap.length&&search++<6000&&visits++<36000){const {ijk}=pop();if(valid(...ijk)&&!finished.has(key(...ijk))){seed=ijk;break;}for(const q of neighbours(ijk))push(q);}
  if(!seed)break;heap.length=0;seen.clear();push(seed);const cells=[];let used=0;
  while(heap.length&&used<volume-1e-7&&visits++<36000){const {ijk,parent}=pop();if(!valid(...ijk)||finished.has(key(...ijk)))continue;finished.add(key(...ijk));
   const b=bounds(...ijk),take=Math.min(dv,volume-used);
   if(take<dv-1e-7){const axis=parent?ijk.findIndex((v,i)=>v!==parent[i]):0,sg=parent?Math.sign(ijk[axis]-parent[axis]):1,length=take/(dv/cell[axis]);if(sg>0)b[axis+3]=b[axis]+length;else b[axis]=b[axis+3]-length;}
   cells.push(b);used+=take;for(const q of neighbours(ijk))push(q,ijk);
  }
  if(used>retained){boxes=cells;retained=used;}
 }
 const merged=mergePackingBoxes(boxes),mesh=packingMesh(merged);
 return {...mesh,boxes:merged,bounds:packingBounds(merged,origin),volume:retained,requestedVolume:volume,retained:volume?retained/volume:1,cell,limited:retained<volume*.999999,searchLimited:visits>=36000};
}
function integrateCompartments(ship,occupied){
 for(const p of occupied){delete p._packing;delete p._packingGroup;}
 const flexible=occupied.filter(p=>flexibleCompartment(ship,p));
 // Preserve existing large rooms before adapting the smaller room or charger.
 flexible.sort((a,b)=>(a.k==='capacitor')-(b.k==='capacitor')||unclippedPartVolume(b)-unclippedPartVolume(a)||a.id-b.id);
 const fixed=occupied.filter(p=>!flexibleCompartment(ship,p)),accepted=fixed.slice(),parent=new Map(occupied.map(p=>[p.id,p.id]));
 const root=id=>{while(parent.get(id)!==id)id=parent.get(id);return id;},union=(a,b)=>{a=root(a);b=root(b);if(a!==b)parent.set(Math.max(a,b),Math.min(a,b));};
 for(const p of flexible){
  const clashes=accepted.filter(q=>overlapParts(p,q)),target=unclippedPartVolume(p),clipped=p.k==='capacitor'&&partVolume(p)<target*.999999;
  if(clashes.length||clipped){p._packing=packFlexibleVolume(ship,p,target,accepted,clashes);for(const q of clashes)union(p.id,q.id);}
  accepted.push(p);
 }
 const groups=new Map();for(const p of occupied){const id=root(p.id);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(p);}
 ship._packingGroups=[];for(const members of groups.values())if(members.some(p=>p._packing)){
  const group={ids:members.map(p=>p.id),volume:members.reduce((n,p)=>n+partVolume(p),0),requestedVolume:members.reduce((n,p)=>n+(p._packing?.requestedVolume??partVolume(p)),0)};
  ship._packingGroups.push(group);for(const p of members)p._packingGroup=group;
 }
}

// Numeric snapshot of the user-selected public workbook, Ships tab, 2026-10-19.
// Empty source cells remain unknown. These are design-table values, not a claim
// that every number is an official Lucasfilm specification.
const STATS_SOURCE='https://docs.google.com/spreadsheets/d/12qGT-gtWGjBujsUjyXWbcBm59N84-NSH/htmlview';
// Main-drive classes explicitly specified by the user, separate from the sheet.
const HYPERDRIVE_REFERENCE={
 imperial:{class:2},
 imperial2:{class:2},
 venator:{class:1},
 executor:{class:2}
};
const SHIP_REFERENCE={
 // Executor formation is the user's explicit setting; aircraftText remains the workbook's original text.
 executor:{name:'Executor',row:4,power:2e27,shieldSeconds:10,shieldLoad:2e28,accelG:3300,sustainedTT:478011.4723,aircraftText:'Y e s（機数未記載）',aircraft:3600,aircraftFormation:'50個飛行隊',aircraftPerSquadron:72,armament:'未記載。作例の武装数はゲーム用設定'},
 lucrehulk:{name:'Lucrehulk',row:111,power:5e25,shieldSeconds:10,shieldLoad:5e26,sustainedTT:5e25/TT,derivedShield:true,aircraftText:'未記載',armament:'未記載（作例の兵装・搭載数はゲーム用仮設定）'},
 imperial:{name:'Imperator I',row:35,power:1e25,shieldSeconds:10,shieldLoad:1e26,accelG:3300,sustainedTT:2390.057361,alphaPT:4.44,aircraftText:'1 wing',aircraft:72,armament:'12×175 TT + 4×175 TT ion + 8×70 TT + 27×40 TT'},
 imperial2:{name:'Imperator II',row:34,power:1e25,shieldSeconds:10,shieldLoad:1e26,accelG:3300,sustainedTT:2390.057361,alphaPT:4.2,aircraftText:'1 wing',aircraft:72,armament:'64×40 TT + 8×70 TT + 27×40 TT'},
 venator:{name:'Venator',row:43,power:3.6e24,shieldSeconds:10,shieldLoad:3.6e25,accelG:3000,sustainedTT:860.4206501,alphaPT:1.28,aircraftText:'6 wings',aircraft:420,launchers:4,armament:'16×70 TT + 2×2×40 TT'},
 acclamator:{name:'Acclamator I',row:51,power:2e23,shieldSeconds:10,shieldLoad:2e24,shieldFraction:.35,accelG:3500,sustainedTT:47.80114723,aircraftText:'1 wing (dropship)',launchers:4,armament:'12×4×200 GT + 24 PD HLC'}
};
// Kept as empty compatibility APIs. Equipment performance has no editable
// per-part ratings; old fields are discarded rather than converted into size.
const PART_RATINGS=Object.freeze({});
const LEGACY_PERFORMANCE_FACTORS=new Set(['reactorFactor','genFactor','thrustFactor','driveFactor','hyperFactor','shieldLoadFactor']);
function reactorPower(p){return isReactor(p)?partVolume(p)*REACTOR_POWER_DENSITY:0;}
function nozzleThrust(p){return parametricEngine(p)?engineRating(p,'thrust'):partVolume(p)*K.engN;}
function nozzleDemand(p){return parametricEngine(p)?engineRating(p,'power'):nozzleThrust(p)*K.engWperN;}
function shieldLoad(p){return partVolume(p)*SHIELD_ENERGY_DENSITY;}
function hyperCapacity(p){return partVolume(p);}
function partRatingKeys(){return [];}
function completeReferenceArmament(ship){
 const key=ship.reference;
 const gun=(k,x,z)=>{const h=rayEnv(ship,[x,1000,z],[0,-1,0],{structOnly:true});if(!h)throw new Error('作例の砲座がありません');const r=placeFit(ship,k,h.p,h.n,0,false);if(!r.fit)throw new Error('作例の砲座: '+r.err);if(needsCapacitor(r.fit))r.fit.chargeDepth=14;return r.fit;};
 if(key==='imperial'){
  for(const x of [200,470])for(const z of [-160,160])gun('htl',x,z);
  for(const x of [360,420,480])for(const z of [-60,60])gun('triple40',x,z);
  for(const z of [-110,110])gun('triple40',560,z);gun('triple40',600,0);
 }
 if(key==='acclamator'){
  for(const f of ship.fits)if(f.k==='ltl')f.k='quad200';
  gunsDeck(ship,'pd',[.16,.36,.58],[.88],null,false,0);
 }
 if(key==='venator'||key==='acclamator')for(const x of key==='venator'?[250,285]:[445,545])for(const z of key==='venator'?[-150,150]:[-50,50])gun('msl',x,z);
 remount(ship);return ship;
}

// Reserve physical machinery in a NEW example. Loading or editing a saved
// design never recalibrates its dimensions or forces its original performance.
function calibrateReferenceRatings(ship){
 const ref=SHIP_REFERENCE[ship.reference];if(!ref)return;
 sizeReferenceReactors(ship);
 sizeReferenceMachinery(ship);
 syncCompartments(ship);
 for(const p of ship.parts)for(const k of LEGACY_PERFORMANCE_FACTORS)delete p[k];
 if(ref.shieldFraction!=null){const S=computeStats(ship);ship.shieldTarget=ref.shieldFraction*ref.power/(S.area*K.shieldStd);}
 return ship;
}

// Reference examples reserve real reactor volume once, during construction.
// Later size edits and saved designs use the same ordinary volume calculation.
function sizeReferenceReactors(ship){
 const ref=SHIP_REFERENCE[ship.reference],reactors=ship.parts.filter(isReactor);
 if(!ref||!reactors.length)return ship;
 syncCompartments(ship);
 const primary=reactors.find(p=>p.k==='gen')||reactors[0],others=reactors.filter(p=>p!==primary),target=ref.power/REACTOR_POWER_DENSITY;
 const otherVolume=others.reduce((n,p)=>n+partVolume(p),0),remaining=target-otherVolume;
 if(remaining<=0)throw new Error('作例の補助炉が目標出力を超えています');
 const d=Math.cbrt(remaining*6/Math.PI);
 if(Math.abs(d-primary.d)>1e-9)primary.d=d;
 return ship;
}

// Physical dimensions for new reference examples. Hyperdrive diameters are
// solved against each complete layout, including the device's own mass and
// hull clipping. Normal editing never retunes a drive or overrides its class.
const PRESET_HYPERDRIVE_DIMENSIONS={
 imperial:[42.04170881567254,110],
 imperial2:[39.67677084288428,110],
 venator:[20.667587239856722,160],
 executor:[216.5562479155547,650]
};
function sizeReferenceMachinery(ship){
 const ref=SHIP_REFERENCE[ship.reference];if(!ref)return ship;
 const shields=ship.parts.filter(p=>p.k==='shield'||p.k==='localShield'),volume=shields.reduce((n,p)=>n+partVolume(p),0);
 if(ref.shieldLoad>0&&volume>0){const scale=Math.cbrt(ref.shieldLoad/(SHIELD_ENERGY_DENSITY*volume));if(Math.abs(scale-1)>1e-12)for(const p of shields)p.d*=scale;}
 const dims=PRESET_HYPERDRIVE_DIMENSIONS[ship.reference],drive=ship.parts.find(p=>p.k==='hyper');
 if(dims&&drive){drive.d=dims[0];drive.length=dims[1];}
 return ship;
}

// Weapon energies are per bolt, never watts. Source status is part of the data.
const WEAPON_NOTES={
 secutor:'https://fractalsponge.net/secutor-redux-wip1/#wpd-comm-46274_46272',
 bellator:'https://fractalsponge.net/bellator-class-star-dreadnought-redux/#wpd-comm-42854_42851',
 vindicator:'https://fractalsponge.net/vindicator-class-star-frigate-4k/',
 compellor:'https://fractalsponge.net/compellor-class-star-cruiser-redux/',
 design:'https://fractalsponge.net/star-wars-ship-design-technical-notes-1/',
 spreadsheet:STATS_SOURCE
};
const calibers={
 pd:{barrels:2,boltTT:.000001,cycle:.2,evidence:'ゲーム用仮定',desc:'2門×1 MT。艦載機とミサイルを迎撃する速射砲。'},
 ltl:{barrels:4,boltTT:.02,cycle:.5,evidence:'ゲーム用仮定',desc:'4門×20 GT。小型艦と艦載機に向く速射の軽砲。'},
 mtl:{barrels:3,boltTT:.2,cycle:.2,evidence:'指定表 Ships!S51など',source:STATS_SOURCE,desc:'3門×200 GT。三連装の中型砲。'},
 htl:{barrels:2,boltTT:70,cycle:1,evidence:'作者明記',source:WEAPON_NOTES.secutor,desc:'2門×70 TT。連装の重ターボレーザー。'},
 stl:{barrels:2,boltTT:175,cycle:1,evidence:'指定表 Ships!S35',source:STATS_SOURCE,desc:'2門×175 TT。インペリアル級の主砲と同じ口径の重砲。'},
 utl:{barrels:2,boltTT:720,cycle:1,evidence:'作者明記',source:WEAPON_NOTES.bellator,desc:'2門×720 TT。ドレッドノート級の超重砲。'},
 ion:{barrels:2,boltTT:175,cycle:1,evidence:'指定表 Ships!S35',source:STATS_SOURCE,desc:'2門×175 TT相当のイオン砲。'}
};
for(const [k,s] of Object.entries(calibers)){const d=FITS[k];Object.assign(d,s);if(k==='ion')d.ion=s.barrels*s.boltTT;else d.tt=s.barrels*s.boltTT;d.power=(d.tt||d.ion||0)*TT/s.cycle;d.rateEvidence='連射間隔はゲーム用仮定';}
FITS.oct40={...FITS.stl,key:'oct40',name:'8連装重ターボレーザー',short:'8連装重TL',barrels:8,boltTT:40,tt:320,cycle:1,power:320*TT,evidence:'作者明記（口径）',source:WEAPON_NOTES.secutor,desc:'8門×40 TT。八連装の重ターボレーザー。',fm:30,wm:30,hm:13,r:15};
FITS.triple40={...FITS.htl,key:'triple40',name:'三連40 TTターボレーザー',short:'三連40 TT',barrels:3,boltTT:40,tt:120,power:120*TT,source:STATS_SOURCE,evidence:'指定表 Ships!S34–S35',desc:'3門×40 TT。ISDの9基27門の補助重砲を構成します。',fm:20,wm:20,hm:9,r:10};
FITS.quad200={...FITS.ltl,key:'quad200',name:'四連200 GTターボレーザー',short:'四連200 GT',barrels:4,boltTT:.2,tt:.8,cycle:.2,power:.8*TT/.2,source:STATS_SOURCE,evidence:'指定表 Ships!S51',desc:'4門×200 GT。アクラメイターIの12基48門の中型砲。'};
for(const k of ['msl','trc']){FITS[k].evidence='ゲーム用仮定';/* assumption noted in evidence only */}
function fitSpec(f){const d=FITS[f.k],s=f.scale||1;if(s===1)return d;const k=s*s*s;return {...d,fm:d.fm*s,wm:d.wm*s,hm:d.hm*s,r:d.r*s,mass:d.mass*k,crew:Math.ceil(d.crew*k),cost:d.cost*k,tt:d.tt?d.tt*k:undefined,ion:d.ion?d.ion*k:undefined,power:d.power*k,aa:d.aa?d.aa*s*s:undefined};}

// Licensed mesh skins and reusable modules. Internal systems remain independent.
const REFERENCE_ASSETS=YardReferenceData.assets;
// Per-model colour balance. The source models were textured separately, so
// their average tones differ (warm turrets, dark engine bells). Each factor
// brings an asset's mean texture colour to one shared neutral hull grey;
// engines keep half of their extra darkness. Measured from the atlas.
const REFERENCE_TONE=Object.freeze({"bridge_pod":[1.064,1.108,1.132],"ven_hull":[0.98,1.009,1.04],"ven_tower_port":[0.965,0.998,1.036],"ven_tower_stbd":[0.965,0.998,1.036],"ven_bridge_port":[0.941,0.973,1.013],"ven_bridge_stbd":[0.941,0.973,1.013],"ven_spine":[0.945,0.978,1.013],"ven_outer_port":[1.131,1.142,1.153],"ven_outer_stbd":[1.131,1.142,1.153],"ven_inner_port":[1.127,1.138,1.148],"ven_inner_stbd":[1.127,1.138,1.148],"ven_upper_port":[1.13,1.141,1.151],"ven_upper_stbd":[1.13,1.141,1.151],"ven_aux_port":[1.098,1.109,1.119],"ven_aux_stbd":[1.098,1.109,1.119],"ven_turret":[1.097,1.173,1.236],"ven_turret_0":[1.097,1.173,1.236],"ven_turret_1":[1.097,1.173,1.236],"ven_turret_2":[1.097,1.173,1.236],"ven_turret_3":[1.097,1.173,1.236],"ven_turret_4":[1.097,1.173,1.236],"ven_turret_5":[1.097,1.173,1.236],"ven_turret_6":[1.097,1.173,1.236],"ven_turret_7":[1.097,1.173,1.236],"ven_side_gun":[0.952,0.961,0.969],"ven_side_port":[0.952,0.961,0.969],"ven_side_stbd":[0.952,0.961,0.969],"isd_hull":[1.037,1.081,1.107],"isd_support":[1.052,1.094,1.12],"isd_citadel":[1.082,1.131,1.161],"isd_bridge":[1.064,1.108,1.132],"isd_engine_0":[1.032,1.087,1.122],"isd_engine_1":[1.042,1.096,1.131],"isd_engine_3":[1.042,1.101,1.136],"isd_engine_4":[1.042,1.101,1.136],"isd_mast":[1.128,1.186,1.224],"isd_sensor_port":[1.017,1.062,1.087],"isd_engine_2":[1.032,1.087,1.122],"isd_engine_5":[1.042,1.101,1.136],"isd_engine_6":[1.042,1.101,1.136],"isd_sensor_stbd":[1.017,1.062,1.087],"isd_turret":[1.118,1.173,1.208],"isd_turret_0":[1.118,1.173,1.208],"isd_turret_1":[1.118,1.173,1.208],"isd_turret_2":[1.118,1.173,1.208],"isd_turret_3":[1.118,1.173,1.208],"isd_turret_4":[1.118,1.173,1.205],"isd_turret_5":[1.118,1.173,1.205],"isd_turret_6":[1.118,1.173,1.205],"isd_turret_7":[1.118,1.173,1.205],"isd2_octuple":[0.877,0.886,0.894],"isd2_casemate":[0.877,0.886,0.894]});
function decodeReference(id){
 const a=REFERENCE_ASSETS[id];if(!a)return null;if(a._decoded)return a._decoded;
 // Identical meshes are stored once; a copy names its source with dataFrom.
 const s=a.data??REFERENCE_ASSETS[a.dataFrom].data,alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',table=new Int16Array(128);for(let i=0;i<alphabet.length;i++)table[alphabet.charCodeAt(i)]=i;
 const bytes=new Uint8Array(Math.floor(s.length*3/4)-(s.endsWith('==')?2:s.endsWith('=')?1:0));let at=0;
 for(let i=0;i<s.length;i+=4){const v=(table[s.charCodeAt(i)]<<18)|(table[s.charCodeAt(i+1)]<<12)|(table[s.charCodeAt(i+2)]<<6)|table[s.charCodeAt(i+3)];if(at<bytes.length)bytes[at++]=v>>16;if(at<bytes.length)bytes[at++]=v>>8;if(at<bytes.length)bytes[at++]=v;}
 const dv=new DataView(bytes.buffer),pos=new Float32Array(a.n*3),uv=new Float32Array(a.n*2),idx=new Uint32Array(a.faces*3);
 for(let i=0;i<pos.length;i++)pos[i]=dv.getInt16(i*2,true)/65532;
 for(let i=0;i<uv.length;i++)uv[i]=dv.getUint16(a.n*6+i*2,true)/65535;
 for(let i=0;i<idx.length;i++)idx[i]=a.indexBytes===2?dv.getUint16(a.n*10+i*2,true):dv.getUint32(a.n*10+i*4,true);
 a._decoded={pos,uv,idx};return a._decoded;
}
STRUCT_SHAPES.reference='艦橋本体';
function referencePartPoint(p,v){return worldStruct(p,[v[0]*p.s[0],v[1]*p.s[2],v[2]*p.s[1]]);}
function referenceTriangles(p){
 const a=REFERENCE_ASSETS[p.skinAsset];if(!a?.collider)return v3StructTriangles({...p,form:'box'});
 const key=JSON.stringify([p.skinAsset,p.c,p.s,p.surfaceNormal,p.pitch,p.roll,p.yaw]);if(p._refShape?.key===key)return p._refShape.tris;
 const T=a.collider,out=new Float32Array(T.length);for(let i=0;i<T.length;i+=3)out.set(referencePartPoint(p,T.slice(i,i+3)),i);
 const bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];for(let i=0;i<out.length;i++){const k=i%3;bounds[k]=Math.min(bounds[k],out[i]);bounds[k+3]=Math.max(bounds[k+3],out[i]);}p._refShape={key,tris:out,bounds};return out;
}
function inReferenceStructure(p,q){
 const bound=refPartBounds(p);if(bound&&q.some((v,i)=>v<bound[i]-.001||v>bound[i+3]+.001))return false;
 const T=referenceTriangles(p);if(!REFERENCE_ASSETS[p.skinAsset]?.collider)return v3InStruct({...p,form:'box'},q);
 const s=p._refShape;if(q.some((v,i)=>v<s.bounds[i]-.001||v>s.bounds[i+3]+.001))return false;s.bvh||=buildBVH(T);let o=q.slice(),hits=0,dist=0;const d=[.937426,.202719,.283022],max=len(p.s)*3;
 for(let i=0;i<40;i++){const h=rayBVH(s.bvh,o,d);if(!h||dist>max)break;hits++;dist+=h.t+.001;o=add(h.p,mul(d,.001));}return hits%2===1;
}
function engineAxialScales(p,a){
 const source=sourceEngine(p),spec=equipmentSpec(p);if(!source)return [1,1];
 if(!spec?.engineStyle)return p.skinAxial?[p.skinAxial[1]*p.d/p.skinAxial[0],p.skinAxial[2]*p.d/p.skinAxial[0]]:[p.d/(p.skinDiameter||p.d),p.d/(p.skinDiameter||p.d)];
 const nscale=p.nozzleLength/source.nozzleLength,lo=a.c[0]-a.size[0]/2-(p.skinAnchor||a.c)[0],hi=lo+a.size[0];
 const targetLength=a.size[0]*p.engineLength/engineBaseline(spec.engineStyle,source.d,'length');
 const bscale=spec.engineStyle==='exposed'?(lo*nscale+targetLength-p.nozzleLength/2)/(hi-source.nozzleLength/2):p.bodyLength/engineBaseline('internal',source.d,'body');
 return [nscale,bscale];
}
function referenceEnginePoint(p,v,a){
 const q=v.map((n,i)=>n*a.size[i]+a.c[i]-(p.skinAnchor||a.c)[i]),scale=p.d/(p.skinDiameter||p.d),u=mul(norm(p.dir||[-1,0,0]),-1),source=sourceEngine(p);
 let axial=q[0]*scale;
 if(source&&(parametricEngine(p)||p.skinAxial)){const [ns,bs]=engineAxialScales(p,a),collar=source.nozzleLength/2;axial=q[0]<=collar?q[0]*ns:collar*ns+(q[0]-collar)*bs;}
 let z=norm(cross(u,[0,1,0]));if(len(z)<.01)z=[0,0,1];const y=norm(cross(z,u));
 return add(p.c,add(mul(u,axial),mul(add(mul(y,q[1]),mul(z,q[2])),scale)));
}
// Find the hull/structure wall along the turbine axis. A missing shell leaves
// the engine visible; it is never hidden merely because it has an internal style.
function engineHullEntry(ship,p){
 if(equipmentSpec(p)?.engineStyle!=='internal')return null;
 const u=mul(norm(p.dir||[-1,0,0]),-1),point=t=>add(p.c,mul(u,t));
 const begin=p.nozzleLength/2,end=begin+p.bodyLength;
 const inside=t=>insideOriginalEnvelope(ship,point(t));
 if(inside(begin))return begin;
 const steps=Math.max(16,Math.ceil(p.bodyLength/4));let prev=begin;
 for(let i=1;i<=steps;i++){const t=lerp(begin,end,i/steps);if(inside(t)){let lo=prev,hi=t;for(let j=0;j<18;j++){const mid=(lo+hi)/2;if(inside(mid))hi=mid;else lo=mid;}return (lo+hi)/2;}prev=t;}
 return null;
}
function refPartBounds(p){const a=REFERENCE_ASSETS[p.skinAsset];if(!a)return null;const points=[];for(const x of [-.5,.5])for(const y of [-.5,.5])for(const z of [-.5,.5]){const v=[x,y,z];if(p.k==='engine')points.push(referenceEnginePoint(p,v,a));else if(p.k==='struct')points.push(referencePartPoint(p,v));else{const size=p.skinSize||a.size,k=p.d/Math.max(...size);points.push(worldStruct({...p,c:p.c},v.map((n,i)=>n*size[i]*k)));}}return [0,1,2].map(i=>Math.min(...points.map(p=>p[i]))).concat([0,1,2].map(i=>Math.max(...points.map(p=>p[i]))));}
function referenceHullGeometry(ship){
 if(ship._client)return ship._geoProxy?.ref||null;
 const skin=ship.hullSkin;if(!skin?.enabled)return null;const a=REFERENCE_ASSETS[skin.asset];if(!a)return null;
 const key=JSON.stringify([ship.hull,ship.trenches,ship.cuts,ship.subs,ship.hatches],(k,v)=>k.startsWith('_')&&k!=='_doorDetached'?undefined:v);if(ship._referenceHull?.key===key)return ship._referenceHull;
 const d=decodeReference(skin.asset),pos=new Float32Array(d.pos.length),base=skin.base,same=JSON.stringify([ship.hull,ship.trenches,ship.cuts])===JSON.stringify([base.hull,base.trenches,base.cuts]),profiles=new Map();
 const radius=(sec,dy,dz)=>{let best=0;for(let i=0;i<sec.Z.length;i++){const j=(i+1)%sec.Z.length,ay=sec.Y[i]-sec.yc,az=sec.Z[i],by=sec.Y[j]-sec.yc,bz=sec.Z[j],ey=by-ay,ez=bz-az,det=dy*ez-dz*ey;if(Math.abs(det)<1e-8)continue;const t=(ay*ez-az*ey)/det,u=(ay*dz-az*dy)/det;if(t>0&&u>=0&&u<=1)best=Math.max(best,t);}return best;};
 const baseline={...newShip(base.hull),trenches:base.trenches,cuts:base.cuts};
 for(let i=0;i<d.pos.length;i+=3){const v=[0,1,2].map(k=>d.pos[i+k]*a.size[k]+a.c[k]);if(!same){const x=v[0],X=x/base.hull.L*ship.hull.L,k=Math.round(x*10);let pr=profiles.get(k);if(!pr){const b=sampleSection(baseline,x),c=sampleSection(ship,X);b.yc=sectionBase(base.hull,x).yc;c.yc=sectionBase(ship.hull,X).yc;pr=[b,c];profiles.set(k,pr);}const [b,c]=pr,dy=v[1]-b.yc,dz=v[2],r0=radius(b,dy,dz),r1=radius(c,dy,dz),ratio=r0>1e-6?r1/r0:1;v[0]=X;v[1]=c.yc+dy*ratio;v[2]=dz*ratio;}pos.set(v,i);}
 let surface={pos,uv:d.uv,idx:d.idx};for(const cut of ship.subs)surface=clipReferenceBox(surface,cut.b);for(const h of ship.hatches)if(h.portal&&!h.skinAsset&&!h.referenceMouth){const b=openingBounds(ship,h);if(b)surface=clipReferenceBox(surface,b);}
 const tris=new Float32Array(surface.idx.length*3);for(let i=0;i<surface.idx.length;i++)tris.set(surface.pos.subarray(surface.idx[i]*3,surface.idx[i]*3+3),i*3);
 const bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];for(let i=0;i<surface.pos.length;i++){const k=i%3;bounds[k]=Math.min(bounds[k],surface.pos[i]);bounds[k+3]=Math.max(bounds[k+3],surface.pos[i]);}ship._referenceHull={key,...surface,tris,bounds};return ship._referenceHull;
}
function attachReferenceSkin(ship){
 const key=ship.reference;if(!['imperial','venator'].includes(key))return;
 const ven=key==='venator',prefix=ven?'ven':'isd';
 // Hull and superstructure are editable construction parts, never a model overlay.
 delete ship.hullSkin;
 ship.fits=ship.fits.filter(f=>FITS[f.k].cat!=='w'||f.k==='pd');
 ship._building=true;
 if(!ven){ship.parts=ship.parts.filter(p=>!['sensor','scanner'].includes(p.k)&&!['中央通信マスト','通信アレイ横桁'].includes(p.label));for(const id of ['isd_sensor_port','isd_sensor_stbd','isd_mast']){const a=REFERENCE_ASSETS[id],p=placePart(ship,'sensor',a.c,Math.max(...a.size),{label:a.title,skinAsset:id});p.skinSize=a.size.slice();}}
 attachReferenceBridges(ship);
 // One independently selectable skin follows each real nozzle, including its barrel.
 const engines=ship.parts.filter(p=>p.k==='engine');
 for(const e of engines){let asset;if(ven){const sg=e.c[2]<0?'port':'stbd',z=Math.abs(e.c[2]);asset='ven_'+(e.d>40?(z<80?'inner':'outer'):z<55?'upper':'aux')+'_'+sg;}else{const centers=[[137,-234],[137,0],[137,234],[93,-117],[181,-117],[93,117],[181,117]],j=centers.reduce((best,v,i)=>(v[0]-e.c[1])**2+(v[1]-e.c[2])**2<(centers[best][0]-e.c[1])**2+(centers[best][1]-e.c[2])**2?i:best,0);asset='isd_engine_'+j;}e.skinAsset=asset;e.skinAnchor=e.c.slice();e.skinDiameter=e.d;if(ven)e.bodyRadius=.36;}
 // Preserve every source turret, including its individual pose and mount height.
 const idsGun=Array.from({length:8},(_,i)=>prefix+'_turret_'+i);if(ven)idsGun.push('ven_side_port','ven_side_stbd');
 for(const id of idsGun){const a=REFERENCE_ASSETS[id];if(!a)continue;const type=ven?(id.includes('side')?'refSide':'refVen'):(a.c[0]>450?'refIon':'refISD'),p=[a.c[0],a.c[1]-a.size[1]/2,a.c[2]],mountAxis=id.includes('side')?(a.c[2]<0?5:4):2,up=AXES[mountAxis],h=rayEnv(ship,add(p,mul(up,1200)),mul(up,-1),{structOnly:true});
  ship.fits.push({id:ship.nextId++,k:type,p:p.slice(),a:2,ped:0,base:0,low:0,float:false,skinAsset:id,assetYaw:0,mountAxis,mountOffset:h?dot(sub(p,h.p),up):0});
 }
 if(ven){const top=ship.hatches.find(h=>h.face==='top'),flight=ship.parts.find(p=>p.id===top?.bay);if(top&&flight){const bottom=openBay(ship,flight,'bottom','open');bottom.motion='slide';bottom.open=0;top.motion='slide';top.open=0;}}
 for(const f of ship.fits)if(FITS[f.k].asset)f.chargeDepth=14;

 delete ship._building;remount(ship);
}
for(const [key,base,asset,name] of [['refVen','htl','ven_turret','DBY-827 連装重ターボレーザー'],['refISD','stl','isd_turret','6連装重ターボレーザー'],['refIon','ion','isd_turret','ISD-I 重イオン連装'],['refSide','mtl','ven_side_gun','ヴェネター舷側砲']]){const a=REFERENCE_ASSETS[asset];FITS[key]={...FITS[base],key,name,short:name,asset,fm:a.size[0],wm:a.size[2],hm:a.size[1],r:Math.max(a.size[0],a.size[2])/2};}
Object.assign(FITS.refVen,{short:'DBY-827',source:null,evidence:'名称は指定設定・性能は従来設定',desc:'DBY-827 連装重ターボレーザー。2門×70 TT。'});
// Correct the displayed barrel count without tripling existing designs' damage,
// electrical demand or charging rooms. This is a game conversion, not a new
// per-barrel energy claimed by the reference workbook.
Object.assign(FITS.refISD,{short:'6連装重TL',barrels:6,boltTT:FITS.refISD.tt/6,source:null,evidence:'連装数は指定設定・砲身威力はゲーム用換算',desc:'6門で合計350 TT（1門あたり約58.33 TT）。'});

function sensorShape(p){return memoShape(p,'_sensorShape',sensorShapeRaw);}
function sensorShapeRaw(p){const a=p.skinSize||[p.d,p.d,p.d],scale=p.d/Math.max(...a);return {k:'struct',form:'ellipsoid',c:p.c,s:[a[0]*scale,a[2]*scale,a[1]*scale],yaw:p.yaw||0};}

function mountReferenceFit(ship,f){
 // Newly placed model turrets use the same slope-fitting pedestal on all faces.
 // Authored example poses keep their explicit mountAxis and offset.
  if(f.localMount||FITS[f.k].casemate||f.mountAxis==null)return baseMountFit(ship,f);
 const up=AXES[f.mountAxis??f.a],h=rayEnv(ship,add(f.p,mul(up,Math.max(ship.hull.H,ship.hull.W)*2)),mul(up,-1),{structOnly:true});f.float=!h;f.base=0;f.low=0;f.slope=0;if(h)f.p=add(h.p,mul(up,f.mountOffset||0));return f;
}
// Source turrets were extracted in the pose they had on their ship. A newly
// placed copy turns by this much so that, at yaw 0, its barrels face the bow.
const REFERENCE_FORWARD_YAW={ven_turret:89.7,isd_turret:-85,ven_side_gun:74.5};
// Deck turrets also kept the tilt of the hull face they sat on (the ISD
// turrets about 13°). The broadside gun keeps its pose: its barrels were level. up: the source base-plane normal; base: the bottom-centre of the
// turntable after levelling. A new copy is levelled about that point.
const REFERENCE_LEVEL={"isd_turret":{"up":[0.06811,0.97392,0.21645],"base":[0.132,-2.892,0.421]},"ven_turret":{"up":[0.02532,0.99968,0.00055],"base":[0.015,-4.985,1.401]}};
const LEVEL_MATRIX=new Map();
function levelMatrix(id){
  if(LEVEL_MATRIX.has(id))return LEVEL_MATRIX.get(id);const L=REFERENCE_LEVEL[id];let R=null;
  if(L){const u=norm(L.up),v=cross(u,[0,1,0]),sn=len(v),c=u[1];if(sn>1e-9){const K=[[0,-v[2],v[1]],[v[2],0,-v[0]],[-v[1],v[0],0]],K2=K.map((r,i)=>[0,1,2].map(j=>r[0]*K[0][j]+r[1]*K[1][j]+r[2]*K[2][j])),f=(1-c)/(sn*sn);R=[0,1,2].map(i=>[0,1,2].map(j=>(i===j?1:0)+K[i][j]+K2[i][j]*f));}else R=[[1,0,0],[0,1,0],[0,0,1]];}
  LEVEL_MATRIX.set(id,R);return R;
}
function referenceFitYaw(f){return FITS[f.k].casemate?0:(f.assetYaw||0)+(f.skinAsset?0:REFERENCE_FORWARD_YAW[FITS[f.k].asset]||0);}
function referenceFitPoint(f,v){const id=f.skinAsset||FITS[f.k].asset,a=REFERENCE_ASSETS[id],r=referenceFitYaw(f)*Math.PI/180,k=f.scale||1,R=!f.skinAsset&&!a.mount&&!FITS[f.k].casemate?levelMatrix(id):null,q=R?(()=>{const p=[v[0]*a.size[0],v[1]*a.size[1],v[2]*a.size[2]],b=REFERENCE_LEVEL[id].base;return [0,1,2].map(i=>(R[i][0]*p[0]+R[i][1]*p[1]+R[i][2]*p[2]-b[i])*k);})():a.mount?v.map((n,i)=>(n*a.size[i]+a.c[i]-a.mount[i])*k):[v[0]*a.size[0]*k,(v[1]+.5)*a.size[1]*k,v[2]*a.size[2]*k],[x,y,z]=q,fr=FITS[f.k].casemate?{fw:AXES[f.a],up:[0,1,0],rt:cross(AXES[f.a],[0,1,0])}:fitFrame(f.a),o=fitOrigin(f);return add(o,add(add(mul(fr.fw,x*Math.cos(r)-z*Math.sin(r)),mul(fr.up,y)),mul(fr.rt,x*Math.sin(r)+z*Math.cos(r))));}
function referenceFitAABB(f){const points=[];for(const x of [-.5,.5])for(const y of [-.5,.5])for(const z of [-.5,.5])points.push(referenceFitPoint(f,[x,y,z]));if(!FITS[f.k].casemate&&!f.localMount&&f.mountAxis==null&&(f.low||0)<0)points.push(add(f.p,mul(fitFrame(f.a).up,f.low)));return [0,1,2].map(i=>Math.min(...points.map(p=>p[i]))).concat([0,1,2].map(i=>Math.max(...points.map(p=>p[i]))));}

function clipReferenceBox(d,b){
 const pp=[],uv=[],idx=[];
 const put=poly=>{for(let j=1;j<poly.length-1;j++)for(const q of [poly[0],poly[j],poly[j+1]]){idx.push(pp.length/3);pp.push(...q.slice(0,3));uv.push(...q.slice(3));}};
 for(let i=0;i<d.idx.length;i+=3){const tri=Array.from(d.idx.subarray(i,i+3),k=>[...d.pos.subarray(k*3,k*3+3),...d.uv.subarray(k*2,k*2+2)]);if([0,1,2].some(a=>tri.every(q=>q[a]<b[a]||q[a]>b[a+3])&&(tri.every(q=>q[a]<b[a])||tri.every(q=>q[a]>b[a+3])))){put(tri);continue;}let inside=tri;
  for(const [ax,v,positive] of [[0,b[0],true],[0,b[3],false],[1,b[1],true],[1,b[4],false],[2,b[2],true],[2,b[5],false]]){put(clipPoly(inside,ax,v,!positive));inside=clipPoly(inside,ax,v,positive);if(!inside.length)break;}
 }
 return {pos:Float32Array.from(pp),uv:Float32Array.from(uv),idx:Uint32Array.from(idx)};
}

Object.assign(FITS.refSide,{barrels:2,boltTT:40,tt:80,cycle:1,power:80*TT,source:STATS_SOURCE,desc:'2門×40 TT。舷側の連装砲。',evidence:'指定表 Ships!S43'});

function attachReferenceBridges(ship){
 const ven=ship.reference==='venator',labels=ven?['航空指揮所の長形外殻','航行艦橋の長形外殻']:['横長指揮艦橋の装甲外殻'];
 for(const p of ship.parts.filter(p=>labels.includes(p.label))){const id=ven?(p.c[2]<0?'ven_bridge_port':'ven_bridge_stbd'):'isd_bridge',a=REFERENCE_ASSETS[id];p.c=a.c.slice();p.s=[a.size[0],a.size[2],a.size[1]];p.form='reference';p.skinAsset=id;p.label=a.title;delete p.loft;delete p.angles;delete p.paint;
  for(const f of ship.fits.filter(f=>f.host===p.id)){const z=ven?p.c[2]:30,h=rayPart([p.c[0]+p.s[0],ven?234:433,z],[-1,0,0],p);if(h){f.p=h.p;f.n=h.n;delete f.host;delete f.local;delete f.localNormal;mountFit(ship,f);}}
 }
 const extra=ven?['指揮所屋上レール','前部通信架台','屋上機器筐体','傾斜通信・走査アレイ']:['艦橋の庇・上部装甲','艦橋の下部装甲縁','標的追跡アレイの支持架台','艦橋上の長形機器'];
 ship.parts=ship.parts.filter(p=>!extra.includes(p.label));
}

// Two parametric engine families; old product IDs are retained only for migration.
const LEGACY_ENGINES = {
 isdMain:{name:'ISD 主推進エンジン',k:'engine',group:'power',d:112,nozzleLength:64,bodyRadius:.5,thrust:374447550285105.6,power:8.727272727272728e23,assets:['isd_engine_0','isd_engine_1','isd_engine_2'],anchor:[80,137,-234]},
 isdAux:{name:'ISD 補助推進エンジン',k:'engine',group:'power',d:56,nozzleLength:28,bodyRadius:.5,thrust:40955200812433.42,power:9.545454545454544e22,assets:['isd_engine_3','isd_engine_4','isd_engine_5','isd_engine_6'],anchor:[90.5,93,-117]},
 venInner:{name:'ヴェネター 内側主機',k:'engine',group:'power',d:48,nozzleLength:24,bodyRadius:.36,thrust:49438595781462.336,power:2.6769081813780854e23,assets:['ven_inner_port','ven_inner_stbd'],anchor:[53,42,-54]},
 venOuter:{name:'ヴェネター 外側主機',k:'engine',group:'power',d:45,nozzleLength:24,bodyRadius:.36,thrust:43451890823550.88,power:2.352751331289333e23,assets:['ven_outer_port','ven_outer_stbd'],anchor:[112,50,-106]},
 venUpper:{name:'ヴェネター 上部補助機',k:'engine',group:'power',d:21,nozzleLength:10,bodyRadius:.36,thrust:3942856759914.8027,power:2.1349039857995803e22,assets:['ven_upper_port','ven_upper_stbd'],anchor:[164,87,-41]},
 venAux:{name:'ヴェネター 舷側補助機',k:'engine',group:'power',d:18,nozzleLength:10,bodyRadius:.36,thrust:2896792721570.0586,power:1.5685008875262218e22,assets:['ven_aux_port','ven_aux_stbd'],anchor:[189,71,-74]},
};
const EQUIPMENT = {
 exposedTurbine:{...LEGACY_ENGINES.venInner,name:'タービン露出型エンジン',engineStyle:'exposed',bodyLength:176,assets:Object.values(LEGACY_ENGINES).filter(d=>d.assets[0].startsWith('ven_')).flatMap(d=>d.assets)},
 internalTurbine:{...LEGACY_ENGINES.isdMain,name:'タービン内蔵型エンジン',engineStyle:'internal',bodyLength:168,assets:Object.values(LEGACY_ENGINES).filter(d=>d.assets[0].startsWith('isd_')).flatMap(d=>d.assets)},
 isdBridge:{name:'インペリアル級 艦橋本体',k:'struct',group:'bridge',assets:['isd_bridge']},
 venAirBridge:{name:'ヴェネター 航空指揮艦橋本体',k:'struct',group:'bridge',assets:['ven_bridge_port'],mirror:'venNavBridge'},
 venNavBridge:{name:'ヴェネター 航行艦橋本体',k:'struct',group:'bridge',assets:['ven_bridge_stbd'],mirror:'venAirBridge'},
 isdSensor:{name:'ISD 球形センサー',k:'sensor',group:'support',assets:['isd_sensor_port','isd_sensor_stbd']},
 isdMast:{name:'ISD 通信マスト',k:'sensor',group:'support',assets:['isd_mast']}
};
const EQUIPMENT_MIRRORS={isd_engine_0:'isd_engine_2',isd_engine_2:'isd_engine_0',isd_engine_3:'isd_engine_5',isd_engine_5:'isd_engine_3',isd_engine_4:'isd_engine_6',isd_engine_6:'isd_engine_4'};
for(const [id,d] of Object.entries(EQUIPMENT)){
 d.id=id;const a=REFERENCE_ASSETS[d.assets[0]];
 if(d.k==='struct')d.s=[a.size[0],a.size[2],a.size[1]];
 if(d.k==='sensor')d.d=Math.max(...a.size);
 if(d.assets.length===2){EQUIPMENT_MIRRORS[d.assets[0]]=d.assets[1];EQUIPMENT_MIRRORS[d.assets[1]]=d.assets[0];}
 if(d.mirror)EQUIPMENT_MIRRORS[d.assets[0]]=EQUIPMENT[d.mirror].assets[0];
}
for(const family of ['inner','outer','upper','aux']){EQUIPMENT_MIRRORS['ven_'+family+'_port']='ven_'+family+'_stbd';EQUIPMENT_MIRRORS['ven_'+family+'_stbd']='ven_'+family+'_port';}
function equipmentSpec(p){
 const d=Object.hasOwn(EQUIPMENT,p?.equipmentId)?EQUIPMENT[p.equipmentId]:null;
 return d&&d.k===p.k&&(p.k!=='struct'||p.form==='reference')?d:null;
}
function parametricEngine(p){return p?.k==='engine'&&!!equipmentSpec(p)?.engineStyle;}
function equipmentOptions(id){
 if(!Object.hasOwn(EQUIPMENT,id))throw new Error('機器の規格が見つかりません');
 const d=EQUIPMENT[id],asset=d.assets[0],a=REFERENCE_ASSETS[asset];
 return {equipmentId:id,k:d.k,label:d.name,skinAsset:asset,...(d.k==='struct'?{form:'reference',s:d.s.slice(),taper:0}:d.k==='sensor'?{d:d.d,skinSize:a.size.slice()}:{d:d.d,nozzleLength:d.nozzleLength,bodyLength:d.bodyLength,bodyRadius:d.bodyRadius,engineLength:a.size[0],skinDiameter:d.d,skinAnchor:d.anchor.slice()})};
}
function enforceEquipment(p){
 const d=equipmentSpec(p);if(!d)return;
 if(d.k==='engine')resizeEngine(p,p.d,p.engineLength);
 if(!d.assets.includes(p.skinAsset)){
  const defaults=equipmentOptions(d.id);p.skinAsset=defaults.skinAsset;
  if(d.k==='engine')p.skinAnchor=defaults.skinAnchor;
  if(d.k==='sensor')p.skinSize=defaults.skinSize;
 }
}
// Vertical symmetry mirrors across the hull's mid-depth at each station.
function vmirrorPlane(ship,x){const hp=ship.hull;if(hp.assembly)return hp.H/2;const b=sectionBase(hp,clamp(x,0,hp.L));if(b.ell)return b.yc;let lo=Infinity,hi=-Infinity;for(const q of b.poly||[]){if(q[1]<lo)lo=q[1];if(q[1]>hi)hi=q[1];}return Number.isFinite(lo)&&hi>lo?(lo+hi)/2:(b.yc??hp.H/2);}
function vmirrorPoint(ship,p){const y0=vmirrorPlane(ship,p[0]);return [p[0],2*y0-p[1],p[2]];}
function vmirrorPart(p,ship){
 const q=JSON.parse(JSON.stringify(p,(k,v)=>k.startsWith('_')?undefined:v));delete q.tw;delete q.vt;
 q.c=vmirrorPoint(ship,p.c);if(q.dir)q.dir=[q.dir[0],-q.dir[1],q.dir[2]];
 if(q.aviationSurfaces){const a=q.aviationSurfaces;[a.top,a.bottom]=[a.bottom||'none',a.top||'none'];}
 if(p.k==='struct'){
  // A vertical reflection equals a 180° roll of the left-right reflected shape.
  if(q.angles)[q.angles[2],q.angles[3]]=[q.angles[3],q.angles[2]];if(q.offsetZ)q.offsetZ=-q.offsetZ;
  if(q.form==='arc')q.arcStart=((-(p.arcStart??30)-(p.arcSweep??300)+540)%360)-180;
  if(q.loft)q.loft=q.loft.map(a=>a.length>4?[...a.slice(0,4),-a[4]]:a);if(q.outline)q.outline=q.outline.map(a=>[a[0],-a[1]]);
  if(q.surfaceNormal){q.surfaceNormal=[q.surfaceNormal[0],-q.surfaceNormal[1],q.surfaceNormal[2]];if(q.yaw)q.yaw=-q.yaw;if(q.roll)q.roll=-q.roll;}
  else{q.pitch=-(q.pitch||0);q.roll=((180-(q.roll||0))%360+540)%360-180;}
 }else{if(q.pitch)q.pitch=-q.pitch;if(q.roll)q.roll=-q.roll;if(q.surfaceNormal)q.surfaceNormal=[q.surfaceNormal[0],-q.surfaceNormal[1],q.surfaceNormal[2]];}
 return q;
}
function mirrorEquipment(p,q){
 const d=equipmentSpec(p);if(!d&&!EQUIPMENT_MIRRORS[p.skinAsset])return;
 if(d?.mirror)q.equipmentId=d.mirror;
 q.skinAsset=EQUIPMENT_MIRRORS[p.skinAsset]||p.skinAsset;
 if(q.skinAnchor&&q.skinAsset!==p.skinAsset)q.skinAnchor=mirrorP(p.skinAnchor);
 if(d&&p.label===d.name)q.label=EQUIPMENT[q.equipmentId].name;
}
function customizeEquipment(p){
 // The old engine conversion created hidden performance multipliers. Keep
 // its API callable for integrations, but retain the engine and its size law.
 if(p?.k==='engine')return p;
 const d=equipmentSpec(p);if(!d)return;
 delete p.equipmentId;
 if(p.label===d.name)p.label=d.name+'（汎用規格）';
 // Explicit conversion must survive loading without being adopted again.
 p.customEquipment=true;
}
// Baseline dimensions and ratings are sampled from the unchanged example
// engines. Log interpolation is continuous; outside the reference range the
// same shape grows uniformly. Length gives diminishing thrust returns.
const ENGINE_BASELINES={
 exposed:[['venAux',64],['venUpper',86],['venOuter',140],['venInner',176]].map(([id,body])=>({...LEGACY_ENGINES[id],body,length:REFERENCE_ASSETS[LEGACY_ENGINES[id].assets[0]].size[0]})),
 internal:[['isdAux',128],['isdMain',168]].map(([id,body])=>({...LEGACY_ENGINES[id],body,length:REFERENCE_ASSETS[LEGACY_ENGINES[id].assets[0]].size[0]}))
};
function engineBaseline(style,diam,key){
 const rows=ENGINE_BASELINES[style],d=Math.max(1,diam),ends=d<rows[0].d?rows[0]:d>rows.at(-1).d?rows.at(-1):null;
 if(ends)return ends[key]*Math.pow(d/ends.d,['thrust','power'].includes(key)?3:1);
 let i=0;while(i<rows.length-2&&d>rows[i+1].d)i++;
 const a=rows[i],b=rows[i+1],t=Math.log(d/a.d)/Math.log(b.d/a.d);return a[key]*Math.pow(b[key]/a[key],t);
}
function resizeEngine(p,diam=p.d,length=p.engineLength){
 const d=equipmentSpec(p);if(!d?.engineStyle)return p;
 p.d=Number.isFinite(diam)?clamp(diam,6,DESIGN_LIMITS.engineDiameter):d.d;
 const baseLength=engineBaseline(d.engineStyle,p.d,'length');
 p.engineLength=d.engineStyle==='exposed'?(Number.isFinite(length)?clamp(length,engineBaseline('exposed',p.d,'nozzleLength')*1.5,DESIGN_LIMITS.engineLength):baseLength):baseLength;
 p.nozzleLength=engineBaseline(d.engineStyle,p.d,'nozzleLength');
 p.bodyLength=engineBaseline(d.engineStyle,p.d,'body')*(d.engineStyle==='exposed'?p.engineLength/baseLength:1);
 p.bodyRadius=d.bodyRadius;
 delete p.thrustFactor;delete p.driveFactor;return p;
}
function engineRating(p,key){
 const d=equipmentSpec(p),base=engineBaseline(d.engineStyle,p.d,key);
 return base*(d.engineStyle==='exposed'?Math.cbrt((p.engineLength||engineBaseline('exposed',p.d,'length'))/engineBaseline('exposed',p.d,'length')):1);
}
function sourceEngine(p){return Object.values(LEGACY_ENGINES).find(d=>d.assets.includes(p.skinAsset));}
function adoptEquipment(ship,standardExample=false){
 for(const p of ship.parts){
  const legacy=Object.hasOwn(LEGACY_ENGINES,p.equipmentId)?LEGACY_ENGINES[p.equipmentId]:null;
  if(legacy){
   p.equipmentId=legacy.assets[0].startsWith('ven_')?'exposedTurbine':'internalTurbine';
   p.engineLength=engineBaseline(EQUIPMENT[p.equipmentId].engineStyle,legacy.d,'length');
   if(p.label===legacy.name)p.label=EQUIPMENT[p.equipmentId].name;
  }
  if(equipmentSpec(p)){enforceEquipment(p);continue;}
  if(p.customEquipment)continue;
  const d=Object.values(EQUIPMENT).find(d=>d.k===p.k&&d.assets.includes(p.skinAsset)&&(p.k!=='struct'||p.form==='reference'));
  if(!d)continue;
  if(p.k==='engine'){
   const a=sourceEngine(p);if(!a||Math.abs(p.d-a.d)>.0001||Math.abs((p.nozzleLength||p.d*.32)-a.nozzleLength)>.0001||Math.abs((p.bodyRadius??.52)-a.bodyRadius)>.0001||Math.abs((p.skinDiameter||p.d)-a.d)>.0001)continue;
   // Recognize an old standard engine by its real geometry. Missing rating
   // fields must never cause a stretched or reshaped save to be reset.
   if(!standardExample){
    if(p.engineLength!=null&&Math.abs(p.engineLength-engineBaseline(d.engineStyle,p.d,'length'))>.0001)continue;
    if(p.bodyLength!=null&&Math.abs(p.bodyLength-engineBaseline(d.engineStyle,p.d,'body'))>.0001)continue;
    if(p.skinAxial&&p.skinAxial.slice(1).some(v=>Math.abs(v*p.d/p.skinAxial[0]-1)>.0001))continue;
   }
   p.engineLength=engineBaseline(d.engineStyle,p.d,'length');
  }
  p.equipmentId=d.id;
  if(!p.label||p.label===REFERENCE_ASSETS[p.skinAsset].title)p.label=d.name;
  enforceEquipment(p);
 }
 return ship;
}

// Editable concave footprints with continuous sloping/crowned decks.
STRUCT_SHAPES.outline='輪郭多角形・傾斜甲板';
const DEFAULT_OUTLINE=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]];
function outlinePoints(p){return p.outline||DEFAULT_OUTLINE;}
function outlineCross(a,b,c){return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);}
function outlineArea(P){return P.reduce((a,p,i)=>a+p[0]*P[(i+1)%P.length][1]-p[1]*P[(i+1)%P.length][0],0)/2;}
function validOutline(P){
 if(!Array.isArray(P)||P.length<3||P.length>96||P.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite))||Math.abs(outlineArea(P))<.00001)return false;
 for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length];if(Math.hypot(a[0]-b[0],a[1]-b[1])<.000001)return false;for(let j=i+2;j<P.length;j++){if(i===0&&j===P.length-1)continue;const c=P[j],d=P[(j+1)%P.length];if(outlineCross(a,b,c)*outlineCross(a,b,d)<-1e-12&&outlineCross(c,d,a)*outlineCross(c,d,b)<-1e-12)return false;}}
 return true;
}
function outlineEars(P){
 const ids=P.map((_,i)=>i);if(outlineArea(P)<0)ids.reverse();const out=[];let guard=P.length**2;
 while(ids.length>3&&guard--){let found=false;for(let k=0;k<ids.length;k++){const a=ids[(k+ids.length-1)%ids.length],b=ids[k],c=ids[(k+1)%ids.length];if(outlineCross(P[a],P[b],P[c])<=1e-10)continue;
  if(ids.some(i=>i!==a&&i!==b&&i!==c&&outlineCross(P[a],P[b],P[i])>=-1e-10&&outlineCross(P[b],P[c],P[i])>=-1e-10&&outlineCross(P[c],P[a],P[i])>=-1e-10))continue;
  out.push([a,b,c]);ids.splice(k,1);found=true;break;}
  if(!found){const k=ids.findIndex((b,i)=>Math.abs(outlineCross(P[ids[(i+ids.length-1)%ids.length]],P[b],P[ids[(i+1)%ids.length]]))<1e-10);if(k<0)break;ids.splice(k,1);}
 }
 if(ids.length===3)out.push(ids.slice());return out;
}
function outlineElevation(p,x,z){return x*Math.tan((p.deckSlope||0)*Math.PI/180)-(p.ridge||0)*Math.abs(z)/(p.s[1]/2);}
function outlineTriangles(p){
 const key=JSON.stringify([p.c,p.s,p.surfaceNormal,p.pitch,p.roll,p.yaw,p.outline,p.deckSlope,p.ridge]);if(p._outline?.key===key)return p._outline.tris;
 let P=outlinePoints(p).map(q=>q.slice());if(outlineArea(P)<0)P.reverse();const out=[],[L,W,H]=p.s,point=(x,z,top)=>worldStruct(p,[x,outlineElevation(p,x,z)+(top?.5:-.5)*H,z]);
 // Split each cap triangle at the ridge so no triangle bridges a concavity.
 for(const ids of outlineEars(P))for(const side of [false,true]){const tri=ids.map(i=>[P[i][0]*L,0,P[i][1]*W]),poly=clipPoly(tri,2,0,side);for(let i=1;i+1<poly.length;i++){const v=[poly[0],poly[i],poly[i+1]];for(const top of [false,true]){const q=(top?v.slice().reverse():v).map(a=>point(a[0],a[2],top));triangulateFan(q,out);}}}
 for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length],seg=[a];if(a[1]*b[1]<0){const t=-a[1]/(b[1]-a[1]);seg.push([lerp(a[0],b[0],t),0]);}seg.push(b);for(let j=0;j+1<seg.length;j++){const u=seg[j],v=seg[j+1],A=point(u[0]*L,u[1]*W,false),B=point(v[0]*L,v[1]*W,false),C=point(v[0]*L,v[1]*W,true),D=point(u[0]*L,u[1]*W,true);out.push(...A,...C,...B,...A,...D,...C);}}
 p._outline={key,tris:Float32Array.from(out)};return p._outline.tris;
}
function inOutline(p,q){const v=localStruct(p,q),h=outlineElevation(p,v[0],v[2]);return Math.abs(v[1]-h)<=p.s[2]/2+1e-7&&pointInRing(v[0]/p.s[0],v[2]/p.s[1],outlinePoints(p));}

// Reusable, closed solids for split hulls, curved armor and annular ships.
STRUCT_SHAPES.roundloft='楕円断面ロフト';
STRUCT_SHAPES.arc='環状・円弧船体';
function arcParameters(p){return {inner:clamp(p.arcInner??.65,.05,.95),start:(p.arcStart??30)*Math.PI/180,sweep:clamp(p.arcSweep??300,5,360)*Math.PI/180};}
function arcPoint(p,a,b){const {inner}=arcParameters(p),r=(1+inner)/2+(1-inner)/2*Math.cos(b);return worldStruct(p,[Math.cos(a)*r*p.s[0]/2,Math.sin(b)*p.s[2]/2,Math.sin(a)*r*p.s[1]/2]);}
function inArc(p,q){const v=localStruct(p,q),{inner,start,sweep}=arcParameters(p),x=v[0]*2/p.s[0],z=v[2]*2/p.s[1],r=Math.hypot(x,z),a=((Math.atan2(z,x)-start)%(2*Math.PI)+2*Math.PI)%(2*Math.PI);return a<=sweep+1e-8&&((r-(1+inner)/2)/((1-inner)/2))**2+(v[1]*2/p.s[2])**2<=1+1e-8;}
function arcTriangles(p){
 const key=JSON.stringify([p.c,p.s,p.surfaceNormal,p.pitch,p.roll,p.yaw,p.arcInner,p.arcStart,p.arcSweep]);if(p._arc?.key===key)return p._arc.t;
 const {inner,start,sweep}=arcParameters(p),N=Math.max(4,Math.ceil(sweep/Math.PI*48)),M=20,T=[],P=(i,j)=>arcPoint(p,start+i/N*sweep,j/M*2*Math.PI);
 for(let i=0;i<N;i++)for(let j=0;j<M;j++){const a=P(i,j),b=P(i+1,j),c=P(i+1,j+1),d=P(i,j+1);T.push(...a,...c,...b,...a,...d,...c);}
 if(sweep<Math.PI*2-1e-8)for(const i of [0,N]){const a=start+i/N*sweep,o=worldStruct(p,[Math.cos(a)*(1+inner)*p.s[0]/4,0,Math.sin(a)*(1+inner)*p.s[1]/4]);for(let j=0;j<M;j++)T.push(...o,...P(i,i===0?j+1:j),...P(i,i===0?j:j+1));}
 p._arc={key,t:Float32Array.from(T)};return p._arc.t;
}
// A concave solid cannot be capped by intersecting all face planes. Sample the
// cut plane against actual occupancy instead, retaining ring holes and gaps.
function solidCutCaps(p,b){
 const bounds=partAABB({...p,_apertures:null}),out=[],inside=q=>unpiercedInStruct(p,q);
 for(let ax=0;ax<3;ax++)for(const end of [0,1]){const plane=b[ax+end*3];if(plane<bounds[ax]||plane>bounds[ax+3])continue;const u=(ax+1)%3,v=(ax+2)%3,lo=[Math.max(b[u],bounds[u]),Math.max(b[v],bounds[v])],hi=[Math.min(b[u+3],bounds[u+3]),Math.min(b[v+3],bounds[v+3])];if(hi.some((n,i)=>n<=lo[i]))continue;const nx=Math.min(64,Math.max(2,Math.ceil((hi[0]-lo[0])/12))),ny=Math.min(64,Math.max(2,Math.ceil((hi[1]-lo[1])/12))),point=(x,y)=>{const q=[0,0,0];q[ax]=plane;q[u]=lerp(lo[0],hi[0],x/nx);q[v]=lerp(lo[1],hi[1],y/ny);return q;};
 for(let x=0;x<nx;x++)for(let y=0;y<ny;y++){const q=[point(x,y),point(x+1,y),point(x+1,y+1),point(x,y+1)];for(const ids of [[0,1,2],[0,2,3]]){const poly=ids.map(i=>q[i]),cut=[];for(let j=0;j<3;j++){const a=poly[j],c=poly[(j+1)%3],ia=inside(a);if(ia)cut.push(a);if(ia!==inside(c)){let l=0,h=1;for(let k=0;k<15;k++){const t=(l+h)/2;if(inside(a.map((v,i)=>lerp(v,c[i],t)))===ia)l=t;else h=t;}cut.push(a.map((v,i)=>lerp(v,c[i],(l+h)/2)));}}if(cut.length>2){if(cross(sub(cut[1],cut[0]),sub(cut[2],cut[0]))[ax]*(end?-1:1)<0)cut.reverse();triangulateFan(cut,out);}}}
 }return Float32Array.from(out);
}

// Aviation uses and per-turret charging plants. Capacity calculations live in
// aviation.js and use one shared density for every aircraft and ship.
const AVIATION_ROLES={storage:'機体格納',flight:'飛行・移送甲板',dock:'ドッキング区画',mixed:'格納・発着兼用'};
// Charging plant volume per teraton of salvo (raised from 0.08 so the below-deck
// plant reads in proportion to the turret above it).
const CHARGE_TT_M3=.05;
addComp('capacitor','主砲充電装置','cube',.45,[220,161,73],'power','砲の威力・門数・斉射備蓄分の容積を自動確保。周辺区画と干渉すると、必要容積を保って空き空間に形を組み替えます。',{crew:.08,def:16});
INTERNAL_PARTS.add('capacitor');
function needsCapacitor(f){return FITS[f.k]?.cat==='w'&&(FITS[f.k].casemate||Math.max(fitSpec(f).tt||0,fitSpec(f).ion||0)>=10);}
function weaponChargeSpec(f){const d=fitSpec(f),barrels=Math.max(1,d.barrels||1),boltTT=Math.max(d.tt||0,d.ion||0)/barrels,salvos=clamp(f.chargeSalvos??1,1,20),volleyTT=boltTT*barrels;return {barrels,boltTT,salvos,volleyTT,volleyVolume:volleyTT/CHARGE_TT_M3,targetVolume:volleyTT*salvos/CHARGE_TT_M3};}
function weaponCapacitors(ship){
 const key=JSON.stringify(ship.fits.map(f=>[f.id,f.k,f.p,f.a,f.mountAxis,f.mountOffset,f.float,f.scale,f.chargeDepth,f.chargeScale,f.chargeSalvos]));
 if(ship._capacitors?.key===key)return ship._capacitors.parts;
 const parts=ship.fits.filter(f=>needsCapacitor(f)&&!f.float).map(f=>{
  const q=weaponChargeSpec(f),scale=f.scale||1,V=q.targetVolume*(f.chargeScale??1),depth=12*scale,side=Math.sqrt(V/depth),up=AXES[f.mountAxis??f.a],fr=frameAxis(up),offset=(f.chargeDepth??(depth/2+4))+(f.mountOffset||0);
  return {id:-200000-f.id,k:'capacitor',label:partLabel({label:FITS[f.k].short})+' #'+f.id+' 充電装置',c:sub(f.p,mul(up,offset)),d:Math.cbrt(V),boxFrame:{fw:fr.v,up:fr.u,rt:fr.w},boxSize:[side,depth,side],weaponId:f.id,requiredVolume:q.volleyVolume,targetVolume:q.targetVolume,nominalTT:q.volleyTT,barrels:q.barrels,boltTT:q.boltTT,salvos:q.salvos};
 });
 ship._capacitors={key,parts};return parts;
}
function aviationConnected(a,b){
 const A=partAABB(a),B=partAABB(b),tol=1.5;
 if([0,1,2].some(k=>A[k]>B[k+3]+tol||B[k]>A[k+3]+tol))return false;
 const lo=[0,1,2].map(k=>Math.max(A[k],B[k])),hi=[0,1,2].map(k=>Math.min(A[k+3],B[k+3]));
 const near=(p,q)=>inPart(p,q)||[0,1,2].some(ax=>[-1,1].some(sg=>{const r=q.slice();r[ax]+=sg*tol;return inPart(p,r);}));
 const connected=q=>near(a,q)&&near(b,q);
 for(let i=0;i<5;i++)for(let j=0;j<5;j++)for(let k=0;k<5;k++)if(connected([i,j,k].map((v,ax)=>lerp(lo[ax],hi[ax],(v+.5)/5))))return true;
 // Sloping shared walls can lie between box-grid samples. Probe the actual
 // compartment faces as well, still requiring material on both sides.
 for(const p of [a,b])if(p.room){const T=unpiercedStructTriangles(roomShape(p));for(let i=0;i<T.length;i+=9){const q=[0,1,2].map(k=>(T[i+k]+T[i+3+k]+T[i+6+k])/3);if(connected(q))return true;}}

 return false;
}
function attachedEngine(ship,p){const r=reactorFor(ship,p);return p.k==='engine'&&r&&volSamples(r).some(q=>insideOriginalEnvelope(ship,q));}
function chargingStatus(ship,invalid){const byFit={};for(const p of weaponCapacitors(ship)){const V=partVolume(p),ratio=invalid.has(p.id)?0:clamp(V/Math.max(.0001,p.requiredVolume),0,1),capacityRatio=invalid.has(p.id)?0:clamp(V/Math.max(.0001,p.targetVolume),0,1);byFit[p.weaponId]={id:p.id,volume:V,required:p.targetVolume,ratio,capacityRatio,storedTT:V*CHARGE_TT_M3,blocked:invalid.has(p.id)};}return byFit;}
function outfittingStats(ship,S){
 S.aviation=S.aviation||aviationStatus(ship,S.info);S.storageCapacity=S.aviation.capacity;
 S.aviationVolume=ship.parts.filter(p=>p.k==='hangar'||p.k==='service').reduce((n,p)=>n+partVolume(p),0);
 S.flightVolume=ship.parts.filter(p=>p.k==='hangar'&&['flight','dock'].includes(p.airRole)).reduce((n,p)=>n+partVolume(p),0);
 S.chargingVolume=weaponCapacitors(ship).reduce((n,p)=>n+partVolume(p),0);
 S.chargingCount=weaponCapacitors(ship).length;
 S.heavyAlpha=ship.fits.filter(f=>Math.max(fitSpec(f).tt||0,fitSpec(f).ion||0)>=10).reduce((n,f)=>n+Math.max(fitSpec(f).tt||0,fitSpec(f).ion||0)*(S.chargeInfo[f.id]?.ratio||0),0);
 const broken=Object.values(S.chargeInfo).filter(x=>x.capacityRatio<.999);
 if(broken.length)S.warnings.push({lv:'warn',code:'charging',text:`主砲充電装置 ${broken.length} 基の必要容積を確保できません。自動統合の範囲内に空間を空けるか、構造を追加してください。`});
 const tooLarge=S.aviation.wings.filter(w=>w.count>0&&w.tooLarge);
 if(tooLarge.length)S.warnings.push({lv:'warn',code:'air-size',text:`航空隊 ${tooLarge.length} 隊の機体サイズが最大格納区画の上限を超えています。格納庫を大きくするか、機体サイズを小さくしてください。`});
 if(S.aviation.overflowSize>AVIATION_EPSILON)S.warnings.push({lv:'warn',code:'air-capacity',text:`航空隊の要求が格納容量を ${Math.ceil(S.aviation.overflowSize*100)/100} サイズ超えています。入力した編成は保持し、収まる機数のみ搭載します。`});
 if(S.aviation.deployableCount<S.aviation.embarkedCount)S.warnings.push({lv:'info',code:'air-access',text:`搭載機 ${S.aviation.embarkedCount-S.aviation.deployableCount} 機は、対応するサイズの発着路付き格納区画を確保できないため発艦できません。`});
 S.cls=classify(S);return S;
}
function refitReferenceInterior(ship){
 const key=ship.reference;if(!['imperial','venator','acclamator'].includes(key))return;
 const ven=key==='venator',acc=key==='acclamator';ship._building=true;
 const room=(k,label,c,size,opt={})=>placePart(ship,k,c,40,{room:size,label,...opt});
 const part=(k,label,c,d,opt={})=>placePart(ship,k,c,d,{label,...opt});
 const remove=ids=>{ship.parts=ship.parts.filter(p=>!ids.includes(p.id));ship.hatches=ship.hatches.filter(h=>!ids.includes(h.bay));};
 if(ven){
  // The broad forward hull is a carrier complex, not only the thin central slit.
  remove(ship.parts.filter(p=>['service','cargo','localShield'].includes(p.k)&&p.c[0]>590).map(p=>p.id));
  for(const p of ship.parts.filter(p=>p.k==='hangar'))p.airRole=p.label.includes('飛行')?'flight':'dock';
  const flight=ship.parts.find(p=>p.k==='hangar'&&p.airRole==='flight');
  // The central aviation volume extends from the hold floor to the sloping roof.
  flight.c[1]=61;flight.label='中央連続飛行・移送甲板';setRoomSize(flight,[530,84,106]);
  for(const h of ship.hatches.filter(h=>h.bay===flight.id))h.sill=42/106; // A flat flight deck at Y=50 m, below the forward roof but above the keel.
  const ventral=ship.parts.find(p=>p.label==='腹部ドッキングベイ');if(ventral){ventral.c[0]=545;ventral.c[1]=24;setRoomSize(ventral,[94,80,48]);}
  const stages=[[592,730,'storage'],[730,805,'service'],[805,940,'storage'],[940,1122,'storage']];
  for(let i=0;i<stages.length;i++){const [x0,x1,role]=stages[i],edge=x=>flight.room[1]/2*lerp(flight.aftWidth??1,flight.foreWidth??1,clamp((x-flight.c[0])/flight.room[0]+.5,0,1)),ia=edge(x0)+.12,ib=edge(x1)+.12,w=300-Math.min(ia,ib),mid=(300+Math.min(ia,ib))/2;
   for(const sg of [-1,1]){const outline=[[-.5,sg*(ia-mid)/w],[.5,sg*(ib-mid)/w],[.5,sg*(300-mid)/w],[-.5,sg*(300-mid)/w]],label=sg<0?'左舷':'右舷',cx=(x0+x1)/2;
    if(role==='service'){
     // Three editable deck slices preserve the maintenance space around the
     // side-turret capacitor; only its middle-height footprint needs a notch.
     room('service',label+'航空整備甲板・下層',[cx,26,sg*mid],[x1-x0,w,38],{outline});
     room('service',label+'航空整備甲板・上層',[cx,85,sg*mid],[x1-x0,w,52],{outline});
     const notch=[[x0,ia],[x1,ib],[x1,300],[770,300],[770,100],[756,100],[756,300],[x0,300]].map(([x,z])=>[(x-cx)/(x1-x0),sg*(z-mid)/w]);
     room('service',label+'航空整備甲板・舷側充電装置の周囲',[cx,52,sg*mid],[x1-x0,w,14],{outline:notch});
    }else room('hangar',label+'前部航空格納甲板 '+(i+1),[cx,59,sg*mid],[x1-x0,w,104],{outline,airRole:'storage'});
   }
  }
  for(const p of ship.parts){if(p.k==='shield')p.d=42;if(p.k==='integrity')setRoomSize(p,[85,20,24]);}
  for(const sg of [-1,1])part('inertial','舷側慣性制御設備',[360,55,sg*108],22,{length:100});
  for(const p of ship.parts)if(p.k==='crew'){p.c[1]=65;setRoomSize(p,[70,50,42]);}
  // One embarked clone regiment: four battalions of 576, 2,304 troops.
  for(const [x,sg,n] of [[455,-1,1],[455,1,2],[505,-1,3],[505,1,4]])room('troops',`クローン連隊・第${n}大隊（576名）`,[x,60,sg*120],[48,16,9.0002]);
  part('struct','主炉の球状装甲・構造被覆',[350,80,0],[104,104,104],{form:'ellipsoid',skin:'armor'});
 }else if(!acc){
  remove(ship.parts.filter(p=>p.k==='service').map(p=>p.id));
  for(const p of ship.parts.filter(p=>p.k==='hangar'))p.airRole='dock';
  room('hangar','中央航空機移送路',[728,97,0],[74,112,32],{airRole:'flight'});
  for(const sg of [-1,1]){
   room('hangar',(sg<0?'左舷':'右舷')+'航空機格納庫',[830,138,sg*158.904019230952],[120,65.8080384619041,32],{airRole:'storage'});
   room('hangar','主ベイ・格納庫連絡甲板',[830,138,sg*108],[120,36,22],{airRole:'flight'});
   room('service','航空機整備・補給区画',[940,143,sg*150],[96,48,30]);
   room('crew','城郭下層の居住甲板',[460,227,sg*85],[152,80,23],{foreWidth:.8});
   part('inertial','城郭内の分散慣性制御器',[330,235,sg*170],36,{length:160});
   room('integrity','上段構造維持フィールド幹線',[650,131,sg*230],[200,18,22]);
  }
  for(const p of ship.parts)if(p.k==='shield')p.d=54;
  // One embarked corps of four regiments (9,216 troops) and one prefabricated
  // garrison base with its 484 support staff: 9,700 embarked in all.
  for(const [x,sg,n] of [[890,-1,1],[890,1,2],[1000,-1,3],[1000,1,4]])room('troops',`軍団兵員区画・第${n}連隊（2,304名）`,[x,120,sg*110],[97,20,14.2518]);
  room('troops','プレハブ駐屯基地の支援要員区画（484名）',[780,120,-110],[44,12,11.0003]);
  room('cargo','プレハブ駐屯基地（分解収納）',[780,120,110],[97,20,15]);
  const bridge=ship.parts.find(p=>p.label==='横長指揮艦橋の装甲外殻');
  if(bridge){const hit=rayPart([bridge.c[0]+bridge.s[0],427,80],[-1,0,0],bridge);if(hit){const r=placeFit(ship,'podAir',hit.p,hit.n,0,false);if(r.fit){r.fit.width=12;r.fit.height=4.8;}}}
 }else{
  for(const p of ship.parts){if(p.k==='shield')p.d=33;if(p.k==='crew')setRoomSize(p,[85,35,34]);if(p.k==='service')setRoomSize(p,[110,28,16]);}
  for(const sg of [-1,1])part('inertial','分散慣性制御設備',[225,109,sg*68],24,{length:40});
 }
 delete ship._building;remount(ship);syncCompartments(ship);return ship;
}

// One size unit is the usable storage volume of the current Venator example
// divided by its specified 420 units. The density is shared by every ship;
// aircraft type, assigned berths and per-ship multipliers cannot change it.
const AVIATION_SIZE_VOLUME=7019.524102603107;
const AIR_WING_LIMITS=Object.freeze({rows:200,minSize:1,maxSize:1000000,maxCount:100000,nameLength:60});
const AVIATION_EPSILON=1e-6;
function hangarCapacity(p){
 if(p.k!=='hangar'||['flight','dock'].includes(p.airRole))return 0;
 const volume=partVolume(p);return Number.isFinite(volume)?Math.max(0,volume)/AVIATION_SIZE_VOLUME:0;
}
// Compatibility for integrations that previously asked for a hangar's number
// of aircraft. This now returns a size budget, including fractional units.
function aircraftCapacity(p){return hangarCapacity(p);}
// Embarked ground forces. Troops are counted against the troop bays (12 m³ a
// soldier); vehicles against the vehicle bays, one size unit per 600 m³.
const GROUND_LIMITS=Object.freeze({rows:100,maxCount:1000000,maxSize:1000,minSize:.05,nameLength:60});
const GROUND_VEHICLE_VOLUME=600;
const GROUND_PRESETS=Object.freeze([{name:'歩兵部隊',kind:'troops',size:1},{name:'AT-AT 全地形装甲トランスポート',kind:'vehicle',size:8},{name:'AT-TE 全地形戦術攻撃トランスポート',kind:'vehicle',size:2},{name:'AT-ST 全地形偵察トランスポート',kind:'vehicle',size:1},{name:'装甲兵員輸送車',kind:'vehicle',size:1},{name:'74-Z スピーダーバイク',kind:'vehicle',size:.1}]);
function normalizeGroundForces(rows){
 if(!Array.isArray(rows))return [];
 const ids=new Set();
 return rows.slice(0,GROUND_LIMITS.rows).filter(r=>r&&typeof r==='object'&&!Array.isArray(r)).map((r,i)=>{
  let id=typeof r.id==='string'&&/^[A-Za-z0-9_-]{1,40}$/.test(r.id)?r.id:'ground-'+(i+1);
  if(ids.has(id)){let n=1;while(ids.has(id+'-'+n))n++;id=id+'-'+n;}ids.add(id);
  const kind=r.kind==='vehicle'?'vehicle':'troops',size=kind==='troops'?1:Number.isFinite(r.size)?Math.round(clamp(r.size,GROUND_LIMITS.minSize,GROUND_LIMITS.maxSize)*100)/100:1;
  const count=Number.isFinite(r.count)?Math.floor(clamp(r.count,0,GROUND_LIMITS.maxCount)):0;
  const name=(typeof r.name==='string'?r.name:'').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,GROUND_LIMITS.nameLength)||(kind==='troops'?'歩兵部隊 ':'車両隊 ')+(i+1);
  return {id,name,kind,size,count};
 });
}
function groundStatus(ship,S){
 const rows=normalizeGroundForces(ship.groundForces),cap={troops:S?.troopCapacity||0,vehicle:S?.vehicleSizeCapacity||0},left={...cap},used={troops:0,vehicle:0};
 const out=rows.map(r=>{const need=r.size*r.count;used[r.kind]+=need;const fit=r.kind==='troops'?Math.min(r.count,Math.max(0,Math.floor(left.troops))):Math.min(r.count,Math.max(0,Math.floor((left.vehicle+1e-9)/r.size)));left[r.kind]-=fit*r.size;return {...r,embarked:fit,unembarked:r.count-fit};});
 return {rows:out,troops:{used:used.troops,capacity:cap.troops,embarked:out.filter(r=>r.kind==='troops').reduce((n,r)=>n+r.embarked,0)},vehicles:{used:used.vehicle,capacity:cap.vehicle,count:out.filter(r=>r.kind==='vehicle').reduce((n,r)=>n+r.count,0),embarked:out.filter(r=>r.kind==='vehicle').reduce((n,r)=>n+r.embarked,0)}};
}
function normalizeAirWings(rows){
 if(!Array.isArray(rows))return [];
 const ids=new Set();
 return rows.slice(0,AIR_WING_LIMITS.rows).filter(r=>r&&typeof r==='object'&&!Array.isArray(r)).map((r,i)=>{
  let id=typeof r.id==='string'&&/^[A-Za-z0-9_-]{1,40}$/.test(r.id)?r.id:'air-'+(i+1);
  if(ids.has(id)){let suffix=1;while(ids.has('air-'+(i+1)+'-'+suffix))suffix++;id='air-'+(i+1)+'-'+suffix;}ids.add(id);
  const size=Number.isFinite(r.size)?Math.round(clamp(r.size,AIR_WING_LIMITS.minSize,AIR_WING_LIMITS.maxSize)*100)/100:1;
  const count=Number.isFinite(r.count)?Math.floor(clamp(r.count,0,AIR_WING_LIMITS.maxCount)):0;
  const name=(typeof r.name==='string'?r.name:'').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,AIR_WING_LIMITS.nameLength)||'航空隊 '+(i+1);
  return {id,name,size,count};
 });
}
// A game-scale size-1 aircraft needs a 12 m × 10 m × 5 m clear box.
// Storage/service volume and geometric clearance are separate restrictions.
// This bounded corner-sampling test is conservative, not a packing optimizer.
const AIRCRAFT_CLEARANCE=Object.freeze([12,10,5]);
const AIRCRAFT_FIT_CACHE=new WeakMap();
function aircraftFitsBay(p,size){
 if(p?.k!=='hangar'||!Number.isFinite(size)||size<1)return false;
 const shape=roomShape(p),need=AIRCRAFT_CLEARANCE.map(v=>v*Math.cbrt(size));
 if(need.some((v,i)=>v>shape.s[i]+1e-6))return false;
 const key=JSON.stringify([p.c,p.room,p.d,p.yaw,p.pitch,p.roll,p.outline,p.foreWidth,p.aftWidth,p.corner,p._clipKey,p._packing?.key,partVolume(p)]);
 let cache=AIRCRAFT_FIT_CACHE.get(p);if(cache?.key!==key){cache={key,sizes:new Map()};AIRCRAFT_FIT_CACHE.set(p,cache);}if(cache.sizes.has(size))return cache.sizes.get(size);
 const half=[need[0]/2,need[2]/2,need[1]/2],space=[shape.s[0]/2-half[0],shape.s[2]/2-half[1],shape.s[1]/2-half[2]],steps=[0,-.5,.5,-.999,.999];
 const corners=[];for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])corners.push([x*half[0]*.99999,y*half[1]*.99999,z*half[2]*.99999]);
 let fits=false;outer:for(const x of steps)for(const y of [0,-.8,.8])for(const z of steps){const c=[x*space[0],y*space[1],z*space[2]];if(!inPart(p,worldStruct(shape,c)))continue;if(corners.every(v=>inPart(p,worldStruct(shape,add(c,v))))){fits=true;break outer;}}
 cache.sizes.set(size,fits);return fits;
}
function aviationStatus(ship,info){
 const bays=ship.parts.filter(p=>p.k==='hangar'&&!info?.[p.id]?.overlap).map(p=>({id:p.id,capacity:hangarCapacity(p),connected:!!info?.[p.id]?.acc})).filter(p=>p.capacity>0);
 const rawCapacity=bays.reduce((n,p)=>n+p.capacity,0),rawConnected=bays.filter(p=>p.connected).reduce((n,p)=>n+p.capacity,0);
 // Fractions from adjoining storage areas contribute to the common budget.
 // A whole aircraft must still be smaller than at least one real compartment.
 const capacity=Math.floor(rawCapacity+AVIATION_EPSILON),connectedCapacity=Math.floor(rawConnected+AVIATION_EPSILON);
 const maxAircraftSize=Math.max(0,...bays.map(p=>p.capacity)),connectedMaxAircraftSize=Math.max(0,...bays.filter(p=>p.connected).map(p=>p.capacity));
 let storageLeft=capacity,connectedLeft=connectedCapacity,usedSize=0,embarkedSize=0,deployableSize=0,requestedCount=0,embarkedCount=0,deployableCount=0;
 const wings=normalizeAirWings(ship.airWings).map(row=>{
  const fits=bays.filter(b=>b.capacity+AVIATION_EPSILON>=row.size&&aircraftFitsBay(ship.parts.find(p=>p.id===b.id),row.size));
  const tooLarge=!fits.length,blocked=!fits.some(b=>b.connected);
  const embarked=tooLarge?0:Math.min(row.count,Math.max(0,Math.floor((storageLeft+AVIATION_EPSILON)/row.size)));
  const deployable=blocked?0:Math.min(embarked,Math.max(0,Math.floor((connectedLeft+AVIATION_EPSILON)/row.size)));
  const requestedSize=row.size*row.count,stored=embarked*row.size,active=deployable*row.size;
  storageLeft=Math.max(0,storageLeft-stored);connectedLeft=Math.max(0,connectedLeft-active);
  usedSize+=requestedSize;embarkedSize+=stored;deployableSize+=active;requestedCount+=row.count;embarkedCount+=embarked;deployableCount+=deployable;
  return {...row,usedSize:requestedSize,embarkedSize:stored,deployableSize:active,embarked,deployable,unembarked:row.count-embarked,undeployable:embarked-deployable,tooLarge,blocked};
 });
 return {capacity,connectedCapacity,rawCapacity,rawConnectedCapacity:rawConnected,maxAircraftSize,connectedMaxAircraftSize,usedSize,embarkedSize,deployableSize,remainingSize:Math.max(0,capacity-usedSize),freeSize:storageLeft,overflowSize:Math.max(0,usedSize-capacity),requestedCount,embarkedCount,deployableCount,wings,bays};
}
function smallAircraftWings(count,name='小型機航空隊'){
 const rows=[];let remaining=Math.max(0,Math.floor(count));
 while(remaining>0&&rows.length<AIR_WING_LIMITS.rows){const n=Math.min(remaining,AIR_WING_LIMITS.maxCount),i=rows.length+1;rows.push({id:'air-'+i,name:i===1?name:name+' '+i,size:1,count:n});remaining-=n;}
 return rows;
}
function initializeAviation(ship,key){
 syncCompartments(ship);
 const capacity=aviationStatus(ship).capacity;
 if(key==='executor')ship.airWings=Array.from({length:50},(_,i)=>({id:'air-'+(i+1),name:'第'+(i+1)+'飛行隊',size:1,count:72}));
 else ship.airWings=smallAircraftWings(key==='venator'?420:capacity);
 for(const p of ship.parts){delete p.aircraftType;delete p.berths;}
 ship.groundForces=normalizeGroundForces({
  venator:[{id:'ground-1',name:'クローン・トルーパー連隊',kind:'troops',count:2304}],
  imperial:[{id:'ground-1',name:'ストームトルーパー軍団（4個連隊）',kind:'troops',count:9216},{id:'ground-2',name:'プレハブ駐屯基地の支援要員',kind:'troops',count:484}],
  executor:[{id:'ground-1',name:'ストームトルーパー兵団（4個軍団）',kind:'troops',count:36864},{id:'ground-2',name:'プレハブ駐屯基地4基の支援要員',kind:'troops',count:1936}]
 }[key]||[]);
 return ship;
}
function migrateAviation(ship,source){
 if(source.airWings==null&&Array.isArray(source.airWing))source={...source,airWings:source.airWing};
 if(source.airWings!=null){
  if(!Array.isArray(source.airWings)||source.airWings.length>AIR_WING_LIMITS.rows)throw new Error('航空隊は200隊以内の一覧にしてください');
  ship.airWings=normalizeAirWings(source.airWings);
 }else{
  const oldStorage=(source.parts||[]).filter(p=>p?.k==='hangar'&&!['flight','dock'].includes(p.airRole));
  const assigned=oldStorage.filter(p=>p.berths!=null);
  if(assigned.length){
   const count=assigned.reduce((n,p)=>n+(Number.isFinite(p.berths)?Math.max(0,Math.floor(p.berths)):0),0);
   if(source.reference==='executor'&&count===3600)ship.airWings=Array.from({length:50},(_,i)=>({id:'air-'+(i+1),name:'第'+(i+1)+'飛行隊',size:1,count:72}));
   else ship.airWings=smallAircraftWings(count,'引継ぎ航空隊');
  }else{syncCompartments(ship);ship.airWings=smallAircraftWings(aviationStatus(ship).capacity);}
 }
 for(const p of ship.parts){delete p.aircraftType;delete p.berths;}
 return ship;
}

// Authored compartment layouts. Every visible form is an editable hull, structure, room or fitting.
function referenceDesign(key){
  const ven=key==='venator',acc=key==='acclamator';
  const h=ven?{L:1137,W:548,H:110,chineHeight:.60,belt:.28,stations:[[0,.071,.015,.01,.50],[.035,.076,.74,.02,.65],[.181,.106,.96,.018,.6],[.206,1,.96,.018,.26],[.251,1,.90,0,.26],[.378,.493,.84,0,.30],[.440,.493,.80,0,.32],[.519,.700,.80,.02,.24],[.545,.674,.78,.03,.24],[.748,.433,.56,.047,.26],[.989,.156,.345,.045,.65],[1,.108,.34,.05,.68]]}:acc?{L:752,W:460,H:116,stations:[[0,.15,.45],[.07,.60,.64],[.19,1,1],[.30,.87,.94],[.62,.48,.63],[.92,.12,.24],[1,.018,.14]]}:{L:1600,W:1050,H:250,start:.075,chineHeight:.51,keelWidth:0,stations:[[0,1,1,.04,.08],[.075,1,1,.04,.08],[.18,.88,.9,.04,.09],[.36,.68,.72,.04,.12],[.56,.46,.51,.04,.16],[.78,.23,.30,.04,.22],[.96,.035,.13,.04,.36],[1,.008,.08,.04,.48]]};
  if(ven)for(const row of h.stations){if(row[0]>.251&&row[0]<.519)row[1]=lerp(1,.700,(row[0]-.251)/(.519-.251));if(row[0]>=.206&&row[0]<=.545){row[2]-=2.8/h.H;row[3]-=1.4/h.H;}}
  const s=newShip({...h,plan:'wedge',sec:'warship',bowW:.02,bowH:.2,stern:1,deckWidth:ven?.26:acc?.48:.12,belt:ven?.28:.15},ven?'ヴェネター級｜双塔航空母艦':acc?'アクラメイター級｜強襲揚陸艦':'インペリアルI級｜重砲戦艦');
  if(!ven&&!acc){s.hull.deckWidth=0;for(const row of s.hull.stations)row[4]=0;}
  s.paint=ven?'republic':'neutral';s.detail=1;s.reference=key;s.armor={hull:.3,cit:.35};s.keel='light';s.shieldTarget=1;s._building=true;
  const part=(k,label,c,d,opt={})=>placePart(s,k,c,d,{label,...opt});
  const structure=(label,c,size,opt={})=>part('struct',label,c,size,{form:'chamfer',corner:.12,taper:.14,...opt});
  const room=(k,label,c,size,opt={})=>part(k,label,c,40,{room:size,...opt});
  const pod=(cap,k,width=16)=>{const hit=rayPart([cap.c[0]+cap.s[0],cap.c[1],cap.c[2]],[-1,0,0],cap);if(hit){const r=placeFit(s,k,hit.p,hit.n,0,false);if(r.fit){r.fit.width=width;r.fit.height=Math.round(width*4)/10;}}};
  const engine=(r,label,x,y,z,d,bl)=>part('engine',label,[x,y,z],d,{reactor:r.id,dir:[-1,0,0],bodyLength:bl,bodyRadius:.5});
  if(ven){
    s.cuts.push({id:s.nextId++,type:'planTrapezoid',side:'both',from:.251,to:.519,innerFrom:.378,innerTo:.440,remainingWidth:.493});
    const loft=(name,c,sz,rows,opt={})=>structure(name,c,sz,{form:'loft',loft:rows,corner:.07,...opt});
    loft('中央背骨・機関区装甲',[408,112,0],[366,114,28],[[0,1,.72,0],[.42,1,1,0],[1,.62,.22,0]]);
    loft('双塔間の反応炉被覆',[350,124,0],[180,106,48],[[0,1,.5,0],[.43,1,1,0],[1,.7,.12,0]]);
    for(const z of [-26,26]){
      loft(z<0?'航空指揮塔・傾斜支持構造':'航行指揮塔・傾斜支持構造',[392,166,z],[264,29,130],[[0,1,.06,0],[.15,1,1,0],[.48,.84,1,0],[1,.65,.035,0]],{wallInset:.12});
      const cap=loft(z<0?'航空指揮所の長形外殻':'航行艦橋の長形外殻',[350,236,z],[156,32,20],[[0,.95,1,.15],[.78,1,1,0],[1,.65,.55,.1]],{corner:.11});
      structure('指揮所屋上レール',[335,247,z],[120,18,3],{foreWidth:.85,corner:.12});
      structure('前部通信架台',[392,245,z],[20,19,7],{form:'box'});
      part('scanner','傾斜通信・走査アレイ',[361,247,z],10,{dir:[.7,.7,0],length:5});
      for(const x of [307,327,347])structure('屋上機器筐体',[x,250,z],[13,12,3],{form:'box'});
    }
    const r=part('gen','主反応炉（双塔基部）',[350,80,0],100);
    for(const sg of [-1,1]){
      const inner=engine(r,'主機関・長い内舷ノズル',53,42,sg*54,48,176);inner.nozzleLength=24;
      const outer=engine(r,'主機関・外舷ノズル',112,50,sg*106,45,140);outer.nozzleLength=24;
      const upper=engine(r,'上段補助スラスター',164,87,sg*41,21,86);upper.nozzleLength=10;
      const side=engine(r,'上段外舷スラスター',189,71,sg*74,18,64);side.nozzleLength=10;
      part('fuel','主反応物サイロ',[439,68,sg*25],28,{dir:[0,1,0],length:72});
      room('pump','反応物ポンプ・弁室',[405,74,sg*47],[24,18,22]);
      // Reserve the reference output inside the existing stern shoulders. The
      // remaining volume sets the main reactor without enlarging its armor.
      part('aux','補助反応炉',[272,54,sg*175],56);
      part('shield','区域偏向シールド発生器',[310,61,sg*207],27);
      room('battery','艦尾パワーセル庫',[270,67,sg*220],[36,24,20]);
      room('crew','上部居住甲板',[545,71,sg*105],[70,50,24],{foreWidth:.85});
      room('integrity','舷側動力・構造維持幹線',[365,56,sg*138],[85,13,14]);
      room('service','航空整備・給油甲板',[683,67,sg*95],[100,65,24],{foreWidth:.8});
      const bay=room('hangar','側方ドッキング・戦闘機格納庫',[471,54,sg*115],[64,44,50]);const mouth=openBay(s,bay,sg<0?'port':'stbd','ray');mouth.aperture=.90;
      room('cargo','前部補給倉庫',[900,62,sg*70],[120,34,22],{foreWidth:.6});
      part('localShield','前部局所シールド',[960,60,sg*53],12);
      part('repulsor','腹部リパルサー',[405,24,sg*69],18,{dir:[0,1,0],length:10});
    }
    part('hyper','細長い尾部ハイパードライブ',[120,72,0],23,{length:160});
    part('inertial','艦尾主慣性圧縮器',[228,95,0],14,{length:30});
    const flight=room('hangar','先細り中央連続飛行甲板',[857,63,0],[530,84,26],{foreWidth:.15});const hatch=openBay(s,flight,'top');hatch.aperture=.95;hatch.motion='slide';hatch.open=0;
    const ventral=room('hangar','腹部ドッキングベイ',[568,36,0],[140,80,24],{foreWidth:.8});openBay(s,ventral,'bottom','ray');
    const control=structure('格納口管制室外殻',[576,110,50],[25,17,12]);pod(control,'podHangar',10);
    for(const x of [336,401,469,536])for(const z of [-76,76]){const hit=rayEnv(s,[x,400,z],[0,-1,0]);if(hit)placeFit(s,'htl',hit.p,hit.n,0,false);}
    gunsDeck(s,'mtl',[.67],[.92],null,false,0);gunsDeck(s,'pd',[.23,.31,.42,.57,.69,.79,.9],[.86],null,false,0);
  }else if(acc){
    structure('機関区上部テラス',[247,111,0],[280,180,36],{foreWidth:.55,angles:[6,22,14,14]});
    structure('中央兵站上部甲板',[407,112,0],[270,136,23],{foreWidth:.55,angles:[0,12,14,14]});
    structure('艦尾ハイパードライブ尾部',[65,94,0],[130,57,40],{foreWidth:1.25,aftWidth:.44,corner:.12});
    structure('指揮塔支持構造',[218,138,0],[65,48,54],{angles:[6,10,6,6],foreWidth:.9});
    const cap=structure('無窓式戦闘・航行艦橋外殻',[221,166,0],[123,55,18],{corner:.24,foreWidth:.75});
    structure('走査機器ハウジング',[213,178,0],[80,32,7],{corner:.25});
    room('command','無窓式航行・戦闘指揮室',[221,166,0],[50,30,10]);
    part('sensor','コニングタワー走査機器',[185,178,0],10);
    const r=part('gen','テラス内蔵主反応炉',[252,75,0],84);
    for(const sign of [-1,1]){engine(r,'主推進機関',22,61,sign*94,58,126);engine(r,'補助推進機関',5,106,sign*38,23,60);}
    part('hyper','尾部ハイパードライブ',[50,96,0],26,{length:100});
    part('inertial','尾部慣性補償装置',[141,102,0],22,{length:45});
    for(const z of [-1,1]){
      part('fuel','反応物凝縮サイロ',[392,75,z*26],39,{dir:[0,1,0],length:52});
      room('pump','反応物制御バルブ',[339,70,z*29],[30,28,28]);
      part('aux','補助反応炉',[165,65,z*145],23);
      part('shield','区域シールド節点',[267,64,z*150],24);
      room('crew','主居住甲板',[300,94,z*70],[85,35,15]);
      room('troops','大隊兵員収容甲板',[480,69,z*63],[130,45,24],{foreWidth:.65});
      room('vehicle','重車両整備庫',[332,55,z*96],[110,48,24],{foreWidth:.85});
      room('service','ガンシップ整備レール',[480,88,z*47],[110,28,12],{foreWidth:.7});
      const bay=room('hangar','前方揚陸・降下艇格納庫',[570,66,z*28],[110,36,26],{foreWidth:.5});openBay(s,bay,'bottom','ray');
      part('repulsor','着陸支持リパルサー',[295,28,z*85],22,{dir:[0,1,0],length:12});
      room('integrity','縦通構造維持幹線',[245,82,z*115],[140,12,12]);
      room('battery','パワーセル',[180,94,z*75],[25,18,16]);
    }
    const logistics=room('hangar','兵站受入ベイ',[470,72,0],[100,18,30]);openBay(s,logistics,'top');
    gunsDeck(s,'ltl',[.20,.30,.42,.54,.66,.78],[.74],null,false,0);
    gunsDeck(s,'pd',[.25,.48,.68],[.88],null,false,0);
  }else{
    const loft=(name,c,sz,rows,opt={})=>structure(name,c,sz,{form:'loft',loft:rows,corner:.06,...opt});
    // The main hull ends ahead of the engines. Separate upper/lower stern plates
    // leave a genuine engine well instead of putting nozzles on a solid aft wall.
    loft('艦尾上部の張出し装甲',[66,248,0],[132,1050,18],[[0,.025,.8,0],[1,1,1,0]],{ridge:108,corner:0});
    loft('艦尾下部の張出し装甲',[66,8,0],[132,1050,16],[[0,.025,1,0],[1,1,.65,0]],{ridge:-108,corner:0});
    // Unequal terraces taper down toward the bow; their floors join the hull.
    const deck=(label,half,intercept,height)=>{const x0=half[0][0],x1=half.at(-1)[0],w=Math.max(...half.map(a=>a[1]))*2,cx=(x0+x1)/2,points=half.map(([x,z])=>[x,-z]).concat(half.slice().reverse().map(([x,z])=>[x,z]));
      const clean=points.filter((p,i)=>!i||Math.hypot(p[0]-points[i-1][0],p[1]-points[i-1][1])>.01);if(clean[0][0]===clean.at(-1)[0]&&clean[0][1]===clean.at(-1)[1])clean.pop();
      return structure(label,[cx,intercept-.079*cx-height/2,0],[x1-x0,w,height],{form:'outline',outline:clean.map(([x,z])=>[(x-cx)/(x1-x0),z/w]),deckSlope:-4.517,ridge:w*.102,skin:'service'});};
    deck('上部城郭 第1甲板群',[[142,212],[266,210],[279,219],[335,219],[341,216],[406,216],[413,223],[518,223],[530,212],[530,175],[622,129],[714,109],[744,0]],313,48);
    deck('上部城郭 第2甲板群',[[72,0],[117,180],[491,179],[497,174],[627,174]],339,34);
    deck('上部城郭 第3甲板群',[[126,0],[157,137],[502,136],[508,0]],377,42);
    for(const sg of [-1,1])structure('舷側重砲列の装甲砲座甲板',[383,181.2,sg*244],[340,78,22],{form:'outline',outline:[[-.5,-.34],[-.47,-.5],[.45,-.5],[.5,-.3],[.5,.3],[.45,.5],[-.47,.5],[-.5,.34]],deckSlope:-4.0,skin:'armor'});
    loft('司令塔・後方傾斜支持壁',[141,340,0],[258,62,184],[[0,.82,.025,0],[.76,1,1,0],[1,.9,1,0]],{wallInset:.10,skin:'armor'});
    structure('艦橋前部支持幹',[260,381,0],[90,76,100],{foreWidth:.87,angles:[4,9,5,5],skin:'armor'});
    const cap=structure('横長指揮艦橋の装甲外殻',[270,428,0],[136,288,38],{corner:.09,aftWidth:.98,foreWidth:1,angles:[0,7,0,0],skin:'service'});
    structure('艦橋の庇・上部装甲',[269,449,0],[141,294,5],{corner:.11});
    structure('艦橋の下部装甲縁',[270,408,0],[139,292,5],{corner:.11});
    for(const z of [-108,108]){structure('標的追跡アレイの支持架台',[282,456,z],[22,23,14],{form:'cylinder',skin:'service'});part('sensor','トラクタービーム標的追跡アレイ',[282,473,z],40);}
    structure('中央通信マスト',[284,477,0],[10,9,32],{form:'box'});structure('通信アレイ横桁',[284,486,0],[14,90,4],{form:'box'});
    for(const z of [-37,37])structure('艦橋上の長形機器',[274,459,z],[62,21,15],{foreWidth:.65,skin:'service'});
    // The visible ventral bulb is the armored envelope of this actual power plant.
    structure('腹部主炉の球状装甲殻',[434,85,0],[156,156,156],{form:'ellipsoid',skin:'armor'});
    const r=part('gen','主動力発生炉（腹部球状装甲内）',[434,85,0],ISD_PLANT.main);
    for(const z of [-234,0,234]){const e=engine(r,'主イオン機関・拡張ノズル',80,137,z,112,168);e.nozzleLength=64;e.throatRatio=.30;}
    for(const z of [-117,117])for(const y of [93,181]){const e=engine(r,'上下二段の補助イオン機関',90.5,y,z,56,128);e.nozzleLength=28;e.throatRatio=.34;}
    // Editable longitudinal deck armor breaks up the broad, sloping wedge.
    for(const [x,l,w] of [[938,206,177],[1113,138,130],[1253,112,87],[1372,95,52],[1470,72,27]]){const y=sectionBase(s.hull,x).ytop;loft('艦首中央の縦通装甲',[x,y-1,0],[l,w,14],[[0,1,1,0],[.84,.76,.8,0],[1,.55,.35,0]],{ridge:9});}
    part('hyper','主ハイパードライブ',[150,252,0],42,{length:110});
    part('aux','予備機関反応炉',[280,282,0],ISD_PLANT.backup);
    part('inertial','主慣性制御設備',[309,233,85],30,{length:65});
    for(const z of [-1,1]){
      part('fuel','反応物サイロ群',[558,113,z*46],46,{dir:[0,1,0],length:82});
      room('pump','炉用供給・冷却ポンプ室',[508,127,z*88],[30,24,40]);
      part('shield','舷側シールド発生器',[411,101,z*254],42);
      part('aux','副動力炉',[253,137,z*323],ISD_PLANT.auxiliary);
      room('battery','砲塔パワーセル・弾庫',[466,154,z*185],[165,43,25]);
      room('firecontrol','重砲旋回・射撃管制機構',[356,200,z*256],[60,34,22]);
      room('crew','城郭内の居住甲板',[460,260,z*85],[152,80,23],{foreWidth:.8});
      room('service','航空機整備・燃料補給庫',[870,137,z*165],[200,70,36],{foreWidth:.8});
      room('cargo','液体・原材料貯蔵庫',[1230,132,z*75],[140,40,24],{foreWidth:.5});
      room('integrity','舷側構造・動力幹線',[650,103,z*186],[200,18,22],{foreWidth:.85});
      part('localShield','前部補助防御発生器',[1320,135,z*35],18);
    }
    const bay=room('hangar','主腹部ドッキング・航空機発着ベイ',[935,100,0],[340,180,62]);openBay(s,bay,'bottom');
    const small=room('hangar','前方シャトル格納庫',[1172,109.5,0],[130,60,59]);openBay(s,small,'bottom','ray');
    room('hangar','航空機移送・発進甲板',[650,93,0],[82,116,35]);
    const ctl=structure('飛行甲板管制室外殻',[812,167,0],[32,30,13]);pod(ctl,'podHangar',12);
    for(const x of [293,354,415,478])for(const z of [-256,256]){const hit=rayEnv(s,[x,600,z],[0,-1,0]);if(hit)placeFit(s,x===478?'ion':'stl',hit.p,hit.n,0,false);}gunsDeck(s,'pd',[.14,.24,.36,.47,.58,.69,.81],[.84],null,false,0);
  }
  s.trenches.push({id:s.nextId++,side:'both',from:ven?.207:acc?.15:.077,to:.94,level:ven?.60:.51,height:ven?18:acc?10:17,depth:ven?8:acc?11:12,taper:true});
  if(acc)for(const p of s.parts.filter(p=>p.room))fitRoomToEnvelope(s,p);
  delete s._building;remount(s);attachReferenceSkin(s);refitReferenceInterior(s);completeReferenceArmament(s);adoptEquipment(s,true);
  if(ven)for(const hatch of s.hatches)if(hatch.portal){hatch.motion='slide';hatch.open=0;}
  calibrateReferenceRatings(s);return s;
}
// This shared catalog drives design, fleet and review selectors. Retired
// builders remain callable for older integrations, but are not selectable.
Object.assign(DESIGNS,{
 venator:{name:'ヴェネター級',hull:{L:1137}},
 imperial:{name:'インペリアルI級',hull:{L:1600}}
});

// Measured proportions from the four supplied models. Hulls are authored,
// editable solids; no complete source-ship mesh or baked windows is displayed.
const SEPARATIST_EXAMPLES={
 munificent:{name:'ミュニフィセント級',role:'通信フリゲート',length:825,width:401.4,height:242.5,author:'SomeGuyUsingBlender',source:'https://sketchfab.com/3d-models/munificent-class-star-frigate-966265e37e61433b919ba640a12a33f5',license:'CC BY 4.0'},
 recusant:{name:'レキュザント級',role:'軽駆逐艦',length:1187,width:170.5,height:187.1,author:'lolqeeeeeeeeee',source:'https://sketchfab.com/3d-models/star-wars-the-clone-wars-recusant-s3e2-style-c0abad60cab44d9197589a69e78fb6c5',license:'CC BY-NC 4.0'},
 providence:{name:'プロヴィデンス級',role:'航空駆逐艦',length:1088,width:202.7,height:373.9,author:'lolqeeeeeeeeee',source:'https://sketchfab.com/3d-models/star-wars-the-clone-wars-providence-8d27764a7d254fd7948557daf6d7ccdc',license:'CC BY-NC 4.0'},
 lucrehulk:{name:'ルクレハルク級',role:'環状母艦',length:3170,width:2806.7,height:735.1,author:'Professor E12^2',source:'https://sketchfab.com/3d-models/lucrehulk-8bb11e0ad31e4b23b1783e10242c5115',license:'CC BY 4.0'}
};
// Separatist, ISD-II and Acclamator builders were withdrawn from the examples.
// Their provenance tables stay so older saved designs keep their credits.

// Measured layout, not source triangle meshes. See README for attribution.
const EXECUTOR_BLUEPRINT={"exactCredit":"This work is based on \"Star Wars - Executor Super Star Destroyer\" (https://sketchfab.com/3d-models/star-wars-executor-super-star-destroyer-df018bc2cecc4a5182fde06ddc9b1496) by Admiral_Forever (https://sketchfab.com/Admiral_Forever) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)","dimensions":{"length":19000,"width":5603.25844,"heightIncludingSourceBridge":1413.82448,"coordinate":"X=0 aft, X=19000 bow, Y=0 model bottom, Z=0 centerplane"},"cityTerraces":[{"component":1283,"label":"中央都市区画","form":"outline","c":[3536.8645,808.758,0.0],"s":[1061.663,404.968,472.098],"outline":[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],"paint":"#858c92","skin":"service","roofY":1044.807,"sourceBottomFanPivotDiscarded":true},{"component":1281,"label":"中央都市区画","form":"outline","c":[4310.7945,808.758,-386.9655],"s":[733.315,295.517,472.098],"outline":[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],"paint":"#858c92","skin":"service","roofY":1044.807,"sourceBottomFanPivotDiscarded":true},{"component":1282,"label":"中央都市区画","form":"outline","c":[4310.7945,808.758,386.9655],"s":[733.315,295.517,472.098],"outline":[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],"paint":"#858c92","skin":"service","roofY":1044.807,"sourceBottomFanPivotDiscarded":true},{"component":1284,"label":"中央都市区画","form":"outline","c":[4697.76,828.106,0.0],"s":[1390.026,459.684,510.794],"outline":[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],"paint":"#858c92","skin":"service","roofY":1083.503,"sourceBottomFanPivotDiscarded":true},{"component":1279,"label":"中央都市区画","form":"outline","c":[5703.8695,750.713,-696.538],"s":[733.315,295.518,356.008],"outline":[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],"paint":"#858c92","skin":"service","roofY":928.717,"sourceBottomFanPivotDiscarded":true},{"component":1280,"label":"中央都市区画","form":"outline","c":[5703.8695,750.713,696.538],"s":[733.315,295.518,356.008],"outline":[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],"paint":"#858c92","skin":"service","roofY":928.717,"sourceBottomFanPivotDiscarded":true},{"component":1277,"label":"中央都市区画","form":"outline","c":[5703.87,657.8415,-1006.11],"s":[1061.662,514.416,278.615],"outline":[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],"paint":"#858c92","skin":"service","roofY":797.149,"sourceBottomFanPivotDiscarded":true},{"component":1278,"label":"中央都市区画","form":"outline","c":[5703.87,657.8415,1006.11],"s":[1061.662,514.416,278.615],"outline":[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],"paint":"#858c92","skin":"service","roofY":797.149,"sourceBottomFanPivotDiscarded":true},{"component":1295,"label":"中央都市区画","form":"outline","c":[5781.263,773.931,-386.9655],"s":[1390.026,350.235,510.794],"outline":[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],"paint":"#858c92","skin":"service","roofY":1029.328,"sourceBottomFanPivotDiscarded":true},{"component":1296,"label":"中央都市区画","form":"outline","c":[5781.263,773.931,386.9655],"s":[1390.026,350.235,510.794],"outline":[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],"paint":"#858c92","skin":"service","roofY":1029.328,"sourceBottomFanPivotDiscarded":true},{"component":1301,"label":"指揮塔支持柱","form":"outline","c":[5804.4805,1017.719,0.0],"s":[273.631,207.956,534.012],"outline":[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],"paint":"#858c92","skin":"service","roofY":1284.725,"sourceBottomFanPivotDiscarded":true},{"component":1273,"label":"中央都市区画","form":"outline","c":[5936.049,557.2305,-1393.0755],"s":[1171.112,350.235,278.615],"outline":[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],"paint":"#858c92","skin":"service","roofY":696.538,"sourceBottomFanPivotDiscarded":true},{"component":1274,"label":"中央都市区画","form":"outline","c":[5936.049,557.2305,1393.0755],"s":[1171.112,350.235,278.615],"outline":[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],"paint":"#858c92","skin":"service","roofY":696.538,"sourceBottomFanPivotDiscarded":true},{"component":1304,"label":"中央都市区画","form":"outline","c":[6036.66,901.629,0.0],"s":[875.61,383.08,425.662],"outline":[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],"paint":"#858c92","skin":"service","roofY":1114.46,"sourceBottomFanPivotDiscarded":true},{"component":1297,"label":"中央都市区画","form":"outline","c":[6709.98,677.1895,-851.324],"s":[1006.946,350.234,255.397],"outline":[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],"paint":"#858c92","skin":"service","roofY":804.888,"sourceBottomFanPivotDiscarded":true},{"component":1298,"label":"中央都市区画","form":"outline","c":[6709.98,677.1895,851.324],"s":[1006.946,350.234,255.397],"outline":[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],"paint":"#858c92","skin":"service","roofY":804.888,"sourceBottomFanPivotDiscarded":true},{"component":1299,"label":"中央都市区画","form":"outline","c":[6709.98,816.497,0.0],"s":[350.234,459.684,255.398],"outline":[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],"paint":"#858c92","skin":"service","roofY":944.196,"sourceBottomFanPivotDiscarded":true},{"component":1302,"label":"中央都市区画","form":"outline","c":[6965.3765,754.5825,-464.3585],"s":[985.059,437.797,224.439],"outline":[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],"paint":"#858c92","skin":"service","roofY":866.802,"sourceBottomFanPivotDiscarded":true},{"component":1303,"label":"中央都市区画","form":"outline","c":[6965.3765,754.5825,464.3585],"s":[985.059,437.797,224.439],"outline":[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],"paint":"#858c92","skin":"service","roofY":866.802,"sourceBottomFanPivotDiscarded":true},{"component":1289,"label":"中央都市区画","form":"outline","c":[7739.3075,673.3195,-735.2345],"s":[437.797,273.631,371.487],"outline":[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],"paint":"#858c92","skin":"service","roofY":859.063,"sourceBottomFanPivotDiscarded":true},{"component":1290,"label":"中央都市区画","form":"outline","c":[7739.3075,673.3195,735.2345],"s":[437.797,273.631,371.487],"outline":[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],"paint":"#858c92","skin":"service","roofY":859.063,"sourceBottomFanPivotDiscarded":true},{"component":1271,"label":"中央都市区画","form":"outline","c":[7948.269,816.497,-309.5725],"s":[1171.112,350.235,332.79],"outline":[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],"paint":"#858c92","skin":"service","roofY":982.892,"sourceBottomFanPivotDiscarded":true},{"component":1272,"label":"中央都市区画","form":"outline","c":[7948.269,816.497,309.5725],"s":[1171.112,350.235,332.79],"outline":[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],"paint":"#858c92","skin":"service","roofY":982.892,"sourceBottomFanPivotDiscarded":true},{"component":1275,"label":"中央都市区画","form":"outline","c":[8025.6625,580.4485,-928.717],"s":[2156.171,350.234,278.615],"outline":[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],"paint":"#858c92","skin":"service","roofY":719.756,"sourceBottomFanPivotDiscarded":true},{"component":1276,"label":"中央都市区画","form":"outline","c":[8025.6625,580.4485,928.717],"s":[2156.171,350.234,278.615],"outline":[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],"paint":"#858c92","skin":"service","roofY":719.756,"sourceBottomFanPivotDiscarded":true},{"component":1287,"label":"中央都市区画","form":"outline","c":[8281.059,684.9285,-657.8415],"s":[383.08,273.631,394.705],"outline":[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],"paint":"#858c92","skin":"service","roofY":882.281,"sourceBottomFanPivotDiscarded":true},{"component":1288,"label":"中央都市区画","form":"outline","c":[8281.059,684.9285,657.8415],"s":[383.08,273.631,394.705],"outline":[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],"paint":"#858c92","skin":"service","roofY":882.281,"sourceBottomFanPivotDiscarded":true},{"component":1285,"label":"中央都市区画","form":"outline","c":[9519.3485,704.277,-309.572],"s":[1258.675,328.348,433.402],"outline":[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],"paint":"#858c92","skin":"service","roofY":920.978,"sourceBottomFanPivotDiscarded":true},{"component":1286,"label":"中央都市区画","form":"outline","c":[9519.3485,704.277,309.572],"s":[1258.675,328.348,433.402],"outline":[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],"paint":"#858c92","skin":"service","roofY":920.978,"sourceBottomFanPivotDiscarded":true},{"component":1305,"label":"中央都市区画","form":"outline","c":[9519.3485,599.796,-657.841],"s":[875.609,328.348,224.44],"outline":[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],"paint":"#858c92","skin":"service","roofY":712.016,"sourceBottomFanPivotDiscarded":true},{"component":1306,"label":"中央都市区画","form":"outline","c":[9519.3485,599.796,657.841],"s":[875.609,328.348,224.44],"outline":[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],"paint":"#858c92","skin":"service","roofY":712.016,"sourceBottomFanPivotDiscarded":true},{"component":1312,"label":"中央都市区画","form":"outline","c":[9519.3485,770.061,0.0],"s":[766.145,437.798,224.44],"outline":[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],"paint":"#858c92","skin":"service","roofY":882.281,"sourceBottomFanPivotDiscarded":true},{"component":1310,"label":"中央都市区画","form":"outline","c":[10525.4585,700.407,-309.572],"s":[875.609,328.348,224.44],"outline":[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],"paint":"#858c92","skin":"service","roofY":812.627,"sourceBottomFanPivotDiscarded":true},{"component":1311,"label":"中央都市区画","form":"outline","c":[10525.4585,700.407,309.572],"s":[875.609,328.348,224.44],"outline":[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],"paint":"#858c92","skin":"service","roofY":812.627,"sourceBottomFanPivotDiscarded":true},{"component":1300,"label":"中央都市区画","form":"outline","c":[10579.6335,781.67,0.0],"s":[788.047,459.684,185.744],"outline":[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],"paint":"#858c92","skin":"service","roofY":874.542,"sourceBottomFanPivotDiscarded":true},{"component":1308,"label":"中央都市区画","form":"outline","c":[11276.171,719.756,-170.2645],"s":[525.36,306.461,201.222],"outline":[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],"paint":"#858c92","skin":"service","roofY":820.367,"sourceBottomFanPivotDiscarded":true},{"component":1309,"label":"中央都市区画","form":"outline","c":[11276.171,719.756,170.2645],"s":[525.36,306.461,201.222],"outline":[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],"paint":"#858c92","skin":"service","roofY":820.367,"sourceBottomFanPivotDiscarded":true},{"component":1313,"label":"中央都市区画","form":"outline","c":[11995.927,789.409,0.0],"s":[656.696,383.08,201.222],"outline":[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],"paint":"#858c92","skin":"service","roofY":890.02,"sourceBottomFanPivotDiscarded":true},{"component":1307,"label":"中央都市区画","form":"outline","c":[12537.6785,719.7555,0.0],"s":[437.797,251.728,170.265],"outline":[[-0.5,-0.5],[0.5,-0.5],[0.5,0.5],[-0.5,0.5]],"paint":"#858c92","skin":"service","roofY":804.888,"sourceBottomFanPivotDiscarded":true}],"engines":[{"component":14,"mouth":[2708.758,340.5295,0.0],"direction":[-1,0,0],"diameter":309.573,"bodyForwardEndX":6191.446,"sourceBodyLength":3482.688,"nozzleExposedLength":773.9307,"provenance":"measured 12-sided tubular source geometry; muzzle is a dark flat source disk, use normal game nozzle"},{"component":17,"mouth":[2940.937,348.269,-386.96549999999996],"direction":[-1,0,0],"diameter":309.573,"bodyForwardEndX":6423.625,"sourceBodyLength":3482.688,"nozzleExposedLength":773.9307,"provenance":"measured 12-sided tubular source geometry; muzzle is a dark flat source disk, use normal game nozzle"},{"component":18,"mouth":[2940.937,348.269,386.96549999999996],"direction":[-1,0,0],"diameter":309.573,"bodyForwardEndX":6423.625,"sourceBodyLength":3482.688,"nozzleExposedLength":773.9307,"provenance":"measured 12-sided tubular source geometry; muzzle is a dark flat source disk, use normal game nozzle"},{"component":46,"mouth":[4101.833,332.79,-773.931],"direction":[-1,0,0],"diameter":263.13599999999997,"bodyForwardEndX":6539.715,"sourceBodyLength":2437.8820000000005,"nozzleExposedLength":773.9307,"provenance":"measured 12-sided tubular source geometry; muzzle is a dark flat source disk, use normal game nozzle"},{"component":47,"mouth":[4101.833,332.79,773.931],"direction":[-1,0,0],"diameter":263.13599999999997,"bodyForwardEndX":6539.715,"sourceBodyLength":2437.8820000000005,"nozzleExposedLength":773.9307,"provenance":"measured 12-sided tubular source geometry; muzzle is a dark flat source disk, use normal game nozzle"},{"component":52,"mouth":[4334.012,363.7475,-1044.8065000000001],"direction":[-1,0,0],"diameter":263.13699999999994,"bodyForwardEndX":6771.894,"sourceBodyLength":2437.8820000000005,"nozzleExposedLength":773.9307,"provenance":"measured 12-sided tubular source geometry; muzzle is a dark flat source disk, use normal game nozzle"},{"component":53,"mouth":[4334.012,363.7475,1044.8065000000001],"direction":[-1,0,0],"diameter":263.13699999999994,"bodyForwardEndX":6771.894,"sourceBodyLength":2437.8820000000005,"nozzleExposedLength":773.9307,"provenance":"measured 12-sided tubular source geometry; muzzle is a dark flat source disk, use normal game nozzle"},{"component":152,"mouth":[5185.337,162.5255,-1276.9859999999999],"direction":[-1,0,0],"diameter":263.137,"bodyForwardEndX":6578.412,"sourceBodyLength":1393.0749999999998,"nozzleExposedLength":773.9307,"provenance":"measured 12-sided tubular source geometry; muzzle is a dark flat source disk, use normal game nozzle"},{"component":153,"mouth":[5185.337,162.5255,1276.9859999999999],"direction":[-1,0,0],"diameter":263.137,"bodyForwardEndX":6578.412,"sourceBodyLength":1393.0749999999998,"nozzleExposedLength":773.9307,"provenance":"measured 12-sided tubular source geometry; muzzle is a dark flat source disk, use normal game nozzle"},{"component":156,"mouth":[5224.033,185.7435,-1509.165],"direction":[-1,0,0],"diameter":263.137,"bodyForwardEndX":6617.108,"sourceBodyLength":1393.0749999999998,"nozzleExposedLength":773.9307,"provenance":"measured 12-sided tubular source geometry; muzzle is a dark flat source disk, use normal game nozzle"},{"component":157,"mouth":[5224.033,185.7435,1509.165],"direction":[-1,0,0],"diameter":263.137,"bodyForwardEndX":6617.108,"sourceBodyLength":1393.0749999999998,"nozzleExposedLength":773.9307,"provenance":"measured 12-sided tubular source geometry; muzzle is a dark flat source disk, use normal game nozzle"},{"component":160,"mouth":[5262.729,201.222,-1741.344],"direction":[-1,0,0],"diameter":263.136,"bodyForwardEndX":6655.805,"sourceBodyLength":1393.076,"nozzleExposedLength":773.9307,"provenance":"measured 12-sided tubular source geometry; muzzle is a dark flat source disk, use normal game nozzle"},{"component":161,"mouth":[5262.729,201.222,1741.344],"direction":[-1,0,0],"diameter":263.136,"bodyForwardEndX":6655.805,"sourceBodyLength":1393.076,"nozzleExposedLength":773.9307,"provenance":"measured 12-sided tubular source geometry; muzzle is a dark flat source disk, use normal game nozzle"}],"bridge":{"sourceBodyBounds":[[5765.785,1246.029,-201.075],[6036.66,1385.336,201.075]],"sourceBodyCenter":[5901.2225,1315.6825,0],"towerTop":1284.725,"supportXRange":[5667.665,5941.296],"supportZRange":[-103.978,103.978],"existingAsset":"isd_bridge","existingNaturalSizeXYZ":[149.356031,90.916789,285.180807],"recommendation":"Use current ISD body at natural size; keep X≈5901, Z0; choose its bottom at source support seat around Y1246–1285, extend normal structure support to its underside. Do not scale bridge by whole-ship length."},"cityFoundation":{"sourceComponent":6,"sections":[{"x":2167.006,"t":0.11405294736842105,"width":309.572,"top":975.153,"bottom":611.405,"edgeY":[897.76,897.76]},{"x":4720.978,"t":0.24847252631578948,"width":1393.076,"top":926.395,"bottom":616.823,"edgeY":[771.609,771.609]},{"x":5456.212,"t":0.287169052631579,"width":3173.116,"top":712.016,"bottom":402.444,"edgeY":[557.23,557.23]},{"x":11686.355,"t":0.6150713157894737,"width":1315.682,"top":746.069,"bottom":451.976,"edgeY":[599.022,599.022]},{"x":12073.32,"t":0.6354378947368421,"width":1160.896,"top":735.234,"bottom":456.619,"edgeY":[595.927,595.927]},{"x":13118.126,"t":0.6904276842105264,"width":773.93,"top":650.102,"bottom":526.273,"edgeY":[588.187,588.187]},{"x":13892.057,"t":0.7311608947368421,"width":464.358,"top":595.927,"bottom":580.448,"edgeY":[588.187,588.187]},{"x":14046.843,"t":0.7393075263157896,"width":0.0,"top":588.187,"bottom":588.187,"edgeY":[588.187,588.187]}],"maxWidth":3173.116,"xRange":[2167.006,14046.843],"notes":"Shallow double-crowned central spine under all city blocks. A generic variable-width diamond loft best matches it; ordinary loft approximation may be buried by terraces."},"ventralForwardKeel":{"sourceComponent":2091,"sections":[{"x":14472.505,"t":0.7617107894736842,"width":1346.64,"top":441.141,"bottom":208.961,"edgeY":[317.312,325.051]},{"x":17219.96,"t":0.9063136842105263,"width":557.23,"top":506.925,"bottom":274.745,"edgeY":[390.835,390.835]},{"x":17761.711,"t":0.9348268947368421,"width":309.572,"top":503.055,"bottom":301.833,"edgeY":[402.444,402.444]},{"x":18071.283,"t":0.9511201578947368,"width":185.744,"top":470.55,"bottom":315.764,"edgeY":[393.157,393.157]},{"x":18419.552,"t":0.9694501052631579,"width":0.0,"top":359.878,"bottom":359.878,"edgeY":[359.878,359.878]}]},"hull":{"L":19000,"W":5603.258,"H":1000.0,"sec":"warship","plan":"wedge","deckWidth":0,"keelWidth":0,"belt":0.14,"chineHeight":0.58,"stations":[[0.0,0.005,0.005,0.349776,0],[0.008146684210526316,0.19337035703156985,0.170264,0.3497760000000001,0],[0.19755599999999998,0.4434562891803305,0.5019870000000001,0.14569849999999995,0],[0.23828921052631577,0.49723750004015527,0.569473,0.10373650000000001,0],[0.2912423684210526,1.0,0.710468,-0.144766,0],[0.5987779999999999,0.569060714320133,0.547943,-0.08672050000000003,0],[0.6191446315789474,0.5414364285920799,0.5288109999999999,-0.08489449999999998,0],[0.7556008421052631,0.3508287499879535,0.35984,-0.09327999999999997,0],[0.94,0.063,0.063,-0.082851,0],[1,0.005,0.005,-0.082851,0]],"bowW":0.005,"bowH":0.005,"keel":"std"}};

// Construction examples: every hull/terrace is a normal editable solid. Only
// independently reusable fittings use source model geometry.
const DREADNOUGHT_EXAMPLES={
 imperial2:{name:'インペリアルII級',length:1600,author:'Daniel',source:'https://sketchfab.com/3d-models/star-wars-imperial-ii-star-destroyer-b8bd2d35f7604670ab85242c06c6d280',note:'八連装主砲8基・補助重砲13基・左右トレンチ砲。航空隊は格納区画の実容積に従い、主機は旧作例の物理寸法を保持します。船体・段状甲板は通常部品、艦橋は既存ISD本体です。'},
 executor:{name:'エグゼクター級',length:19000,author:'Admiral_Forever',source:'https://sketchfab.com/3d-models/star-wars-executor-super-star-destroyer-df018bc2cecc4a5182fde06ddc9b1496',note:'13基の機関と中央都市甲板を実測して構成。左右の上下甲板・中央・トレンチを武装化。搭載機は50個飛行隊・3,600機、主機クラス2.0、出力はインペリアル級200隻分。'}
};
// Keep the old ISD-II builder and model provenance available to saved designs;
// only the Executor remains in the public example catalog.
DESIGNS.executor={name:DREADNOUGHT_EXAMPLES.executor.name,hull:{L:DREADNOUGHT_EXAMPLES.executor.length}};
{
 const a=REFERENCE_ASSETS.isd2_octuple;
 Object.assign(FITS.oct40,{name:'8連装重ターボレーザー',asset:'isd2_octuple',fm:a.size[0],wm:a.size[2],hm:a.size[1],r:Math.max(a.size[0],a.size[2])/2,source:STATS_SOURCE,evidence:'指定表 Ships!S34',desc:'8門×40 TT。独立した砲塔・旋回台・装甲囲い。上面・下面・トレンチ壁へ取り付けられます。'});
}
if(REFERENCE_ASSETS.isd2_casemate){const a=REFERENCE_ASSETS.isd2_casemate;FITS.casemate40={...FITS.oct40,key:'casemate40',name:'八連装ケースメイト重砲',short:'舷側ケースメイト砲',asset:'isd2_casemate',casemate:true,r:Math.max(a.size[1],a.size[2])/2,fm:a.size[0],wm:a.size[2],hm:a.size[1],desc:'8門×40 TT。側壁に砲口を外向きに装着。左右±65°・上下±20°の範囲から船体の遮蔽を差し引きます。充電装置は壁の内側です。'};}
if(FITS.casemate40)FITS.casemateLight={...FITS.casemate40,key:'casemateLight',name:'八連装ケースメイト軽砲',short:'ケースメイト軽砲',boltTT:.2,tt:1.6,cycle:.2,power:8*TT,evidence:'口径・連射速度はゲーム用設定',desc:'側壁に取り付ける8門×200 GTの軽砲。八連装砲架を転用。左右±65°・上下±20°、船体で遮蔽される方向は射撃不可。'};
function dreadnoughtTools(s){
 const part=(k,label,c,d,opt={})=>placePart(s,k,c,d,{label,...opt});
 const solid=(label,c,size,opt={})=>part('struct',label,c,size,{form:'chamfer',corner:.08,skin:'armor',...opt});
 const room=(k,label,c,size,opt={})=>part(k,label,c,30,{room:size,...opt});
 const outline=(label,P,top,height,slope=0,ridge=0,opt={})=>{
  const x0=Math.min(...P.map(p=>p[0])),x1=Math.max(...P.map(p=>p[0])),z0=Math.min(...P.map(p=>p[1])),z1=Math.max(...P.map(p=>p[1])),cx=(x0+x1)/2,cz=(z0+z1)/2;
  return solid(label,[cx,top-height/2,cz],[x1-x0,z1-z0,height],{form:'outline',outline:P.map(([x,z])=>[(x-cx)/(x1-x0),(z-cz)/(z1-z0)]),deckSlope:slope,ridge,...opt});
 };
 const symmetric=(half)=>half.map(([x,z])=>[x,-z]).concat(half.slice().reverse().map(([x,z])=>[x,z])).filter((p,i,a)=>!(i&&p[0]===a[i-1][0]&&p[1]===a[i-1][1])).filter((p,i,a)=>i!==a.length-1||p[0]!==a[0][0]||p[1]!==a[0][1]);
 const gun=(k,x,z,axis=2,zone='upper',opt={})=>{
  const up=AXES[axis],o=[x,axis===3?-5000:5000,z],h=rayEnv(s,o,mul(up,-1),{structOnly:true});
  if(!h)throw new Error('作例の砲座がありません: '+zone+' '+x+','+z);
  const f={id:s.nextId++,k,p:h.p,a:axis,ped:0,base:0,low:0,float:false,chargeDepth:18,batteryZone:zone,...opt};mountFit(s,f);s.fits.push(f);return f;
 };
 const trench=(xs,k='oct40',scale=1)=>{
  const c=s.trenches[0];
  for(const x of xs)for(const sg of [-1,1]){
   const b=sectionBase(s.hull,x),y=b.ybot+b.h*c.level,dep=Math.min(b.hw*.8,c.depth*(c.taper?b.pw:1)),z=sg*(b.hw-dep),up=[0,0,sg];
   const h=rayEnv(s,add([x,y,z],mul(up,3)),mul(up,-1),{maxT:6,structOnly:true});
   if(!h)throw new Error('トレンチの内壁がありません: '+x);
   const f={id:s.nextId++,k,p:h.p,a:sg>0?4:5,ped:0,base:0,low:0,float:false,localMount:true,scale,chargeDepth:24,batteryZone:sg<0?'port-trench':'stbd-trench'};
   mountFit(s,f);s.fits.push(f);
  }
 };
 const bridge=(center)=>{
  const e=equipmentOptions('isdBridge'),p=part('struct','インペリアル級 艦橋本体',center,e.s,e);
  {const h=rayPart([p.c[0]+p.s[0],p.c[1]+2,p.c[2]+80],[-1,0,0],p);if(h){const r=placeFit(s,'podAir',h.p,h.n,0,false);if(r.fit){r.fit.width=14;r.fit.height=5.6;}}}
  const base=REFERENCE_ASSETS.isd_bridge.c;
  for(const id of ['isd_sensor_port','isd_sensor_stbd','isd_mast']){const a=REFERENCE_ASSETS[id],q=part('sensor',a.title,add(center,sub(a.c,base)),Math.max(...a.size),{skinAsset:id,skinSize:a.size.slice(),equipmentId:id==='isd_mast'?'isdMast':'isdSensor'});}
  return p;
 };
 return {part,solid,room,outline,symmetric,gun,trench,bridge};
}
function executorDesign(){
 const b=EXECUTOR_BLUEPRINT,s=newShip(JSON.parse(JSON.stringify(b.hull)),'エグゼクター級｜超大型指揮戦艦');s._building=true;s.reference='executor';s.detail=1;s.paint='neutral';s.keel='light';s.armor={hull:.3,cit:.35};s.shieldTarget=1;
 const {part,solid,room,outline,symmetric,gun,trench,bridge}=dreadnoughtTools(s);
 s.trenches.push({id:s.nextId++,side:'both',from:.294,to:.91,level:.58,height:70,depth:72,taper:false});
 const rows=b.cityFoundation.sections,x0=rows[0].x,x1=rows.at(-1).x,top=Math.max(...rows.map(r=>r.top)),bot=Math.min(...rows.map(r=>r.bottom)),H=top-bot;
 solid('中央都市を支える多断面の背骨',[(x0+x1)/2,(top+bot)/2,0],[x1-x0,b.cityFoundation.maxWidth,H],{form:'loft',loft:rows.map(r=>[(r.x-x0)/(x1-x0),Math.max(.02,r.width/b.cityFoundation.maxWidth),Math.max(.03,(r.top-bot)/H),Math.max(0,(r.bottom-bot)/H-.004)]),ridge:55,corner:0,skin:'service',paint:'#858c92'});
 for(const d of b.cityTerraces)solid(d.label,d.c.slice(),d.s.slice(),{form:'outline',outline:d.outline.map(p=>p.slice()),paint:d.paint,skin:d.skin});
 // Individual buildings create depth at the model's city-block scale. They
 // are selectable normal structures, not a baked decorative overlay.
 for(let i=0;i<b.cityTerraces.length;i++){const t=b.cityTerraces[i];if(t.s[0]<160||t.s[1]<100)continue;for(let j=0;j<3;j++){
  const x=t.c[0]+(j-1)*t.s[0]*.22,z=t.c[2]+((i%3)-1)*Math.min(36,t.s[1]*.16),h=14+(i*7+j*11)%45;
  if(!pointInRing((x-t.c[0])/t.s[0],(z-t.c[2])/t.s[1],t.outline))continue;
  solid('都市上層の機器・甲板ブロック',[x,t.roofY+h/2,z],[Math.min(120,t.s[0]*.2),Math.min(60,t.s[1]*.26),h],{form:'box',skin:'service',paint:i%2?'#929a9e':'#77828a'});
 }}
 // A natural-size shared ISD bridge sits on ordinary support structure.
 solid('中央司令塔の傾斜支持構造',[5800,1135,0],[285,205,280],{form:'loft',loft:[[0,.8,.2,0],[.75,1,1,0],[1,.7,.9,0]],skin:'service'});
 solid('艦橋支持座',[5901,1268,0],[150,90,38],{form:'box'});bridge([5901,1328,0]);
 const r=part('gen','中央主動力炉',[7600,360,0],680);
 solid('主炉腹部の球状装甲',[7600,360,0],[700,700,700],{form:'ellipsoid'});
 for(const e of b.engines){const opts=equipmentOptions('exposedTurbine'),p=part('engine','長胴タービン露出型エンジン',[e.mouth[0]+e.diameter*.20,e.mouth[1],e.mouth[2]],e.diameter*.8,{...opts,d:e.diameter*.8,reactor:r.id,dir:[-1,0,0],engineLength:e.sourceBodyLength});resizeEngine(p,e.diameter*.8,e.sourceBodyLength);}
 for(const sg of [-1,1]){
  // These clipped internal plants provide the extra physical output volume
  // while preserving the authored main-reactor bulb and exterior silhouette.
  part('aux','分散補助炉',[9050,360,sg*600],620);
  part('shield','舷側シールド主発生器',[8200,375,sg*1700],220);
  part('shield','前部シールド発生器',[13000,390,sg*700],120);
  part('fuel','主反応物サイロ',[8650,350,sg*350],180,{length:450,dir:[0,1,0]});
  room('pump','主炉供給・冷却区画',[8300,390,sg*600],[260,180,160]);
  room('integrity','縦通構造維持幹線',[10400,480,sg*850],[1600,230,150]);
  part('inertial','主慣性補償装置',[10100,350,sg*450],300,{length:800});
  room('hangar',(sg<0?'左舷':'右舷')+'航空機格納庫',[12000,395,sg*400],[292.480170941796,360,120],{airRole:'storage'});
  room('hangar','中央発着ベイへの移送路',[12000,395,sg*185],[1500,70,100],{airRole:'flight'});
  room('service','航空整備・補給施設',[13700,430,sg*450],[650,250,90]);
  room('cargo','輸送・物資集積区画',[15000,405,sg*350],[600,180,70]);
 }
 const bay=room('hangar','中央腹部ドッキングベイ',[12000,277.5,0],[1700,300,355],{airRole:'dock'});openBay(s,bay,'bottom','ray');
 // One embarked army of four corps (36,864 troops) and four prefabricated
 // garrison bases, each with 484 support staff: 38,800 embarked in all.
 for(const [x,sg,n] of [[6500,-1,1],[6500,1,2],[9500,-1,3],[9500,1,4]])room('troops',`兵団兵員区画・第${n}軍団（9,216名）`,[x,420,sg*1300],[200,40,13.8241]);
 for(const [x,sg,n] of [[7200,-1,1],[7200,1,2],[8800,-1,3],[8800,1,4]]){room('troops',`第${n}プレハブ駐屯基地の支援要員区画（484名）`,[x,420,sg*1300],[44,12,11.0003]);room('cargo',`プレハブ駐屯基地 ${n}（分解収納）`,[x+(n<3?200:-200),420,sg*1300],[97,20,15]);}
 part('hyper','主ハイパードライブ',[9700,400,0],190,{length:650});
 // Parallel deck lanes preserve free spaces between real charging plants.
 for(const axis of [2,3])for(const sg of [-1,1])for(let i=0;i<20;i++){
  const x=5900+i*530,hw=sectionBase(s.hull,x).hw;
  for(const fraction of [.60,.73,.84])gun(i%4===0?'ion':'oct40',x,sg*hw*fraction,axis,(sg<0?'port-':'stbd-')+(axis===2?'upper':'lower'));
 }
 for(let i=0;i<17;i++)for(const z of [-280,0,280]){const x=6500+i*410;const f=gun(i%3===0?'triple40':'oct40',x,z,2,'central');if(x===7730&&z===280)f.chargeDepth=55;if(x===10190&&z===0){f.p[0]+=35;mountFit(s,f);f.chargeDepth=30;}}
 trench(Array.from({length:32},(_,i)=>5900+i*355),FITS.casemate40?'casemate40':'oct40',1);
 delete s._building;adoptEquipment(s,true);remount(s);calibrateReferenceRatings(s);return s;
}
function dreadnoughtDesign(key){if(key!=='executor')throw new Error('設計見本が見つかりません');return executorDesign();}

// Fleet exercises use metres and seconds; tactical acceleration/turn/range are
// explicit game rules. A turn is solved from shared snapshots, never unit order.
const FLEET_RULES={step:.25,seconds:20,maxShips:12,range:150000,initialDistance:120000,engagementDistance:75000,formationGap:6000,accelScale:.002,maxSpeed:2400,maxAltitude:15000,maxCoordinate:2000000};
function fleetProfile(S,name){
 const p=profile(S,name),accel=Math.max(0,S.accelG||0)*G0*FLEET_RULES.accelScale;
 return {...p,embarkedSlots:Math.floor(S.slots||0),aviationSize:S.aviation?.usedSize||0,launch:S.launchPotential??p.launch,slidingHatches:S.slidingHatches||0,hatchOpenSeconds:S.slidingHatches?S.hatchOpenSeconds||4:0,hatchCloseSeconds:S.slidingHatches?S.hatchCloseSeconds||4:0,gunArcs:[...S.alphaRate],ionArcs:[...S.ionRate],accel,maxSpeed:accel>0?Math.min(FLEET_RULES.maxSpeed,Math.sqrt(accel*Math.max(200,p.len)*24)):0,turnRate:accel>0?clamp(.11*Math.sqrt(Math.max(1,S.accelG)/3000)*Math.sqrt(1600/Math.max(100,p.len)),.015,.24):0,width:S.dims[1],height:S.dims[2],power:S.xISD};
}
function fleetUnit(id,key,p,team=0){const shield=Math.max(0,(p.shieldBuffer??p.D*K.bufferS)+(p.reserve||0));return {id,key,name:p.name,team,p,pos:[0,0,0],yaw:0,velocity:[0,0,0],hp:p.hp,shield,shieldMax:shield,air:0,launched:0,lost:0,hatchOpen:0,hatchTarget:0,queue:[],order:{type:'hold',fire:true,launch:false},dead:false};}
function fleetFormation(units,form='line',gap=600){
 if(!units.length)return units;gap=clamp(Number(gap)||0,0,10000);
 const L=Math.max(...units.map(u=>u.p.len)),W=Math.max(...units.map(u=>u.p.width||u.p.len*.5));
 units.forEach((u,i)=>{let x=0,z=0;if(form==='column')x=-i*(L+gap);else if(form==='wedge'){const row=Math.ceil(i/2);x=-row*(L+gap);z=(i%2?1:-1)*row*(W+gap);}else if(form==='grid'){x=-Math.floor(i/3)*(L+gap);z=(i%3-1)*(W+gap);}else z=i*(W+gap);u.pos=[x,0,z];u.yaw=0;u.velocity=[0,0,0];});
 const x=units.reduce((s,u)=>s+u.pos[0],0)/units.length,z=units.reduce((s,u)=>s+u.pos[2],0)/units.length;for(const u of units){u.pos[0]-=x;u.pos[2]-=z;}return units;
}
function fleetBattle(units,combat=true){return {units,combat,turn:1,time:0,phase:'plan',seconds:FLEET_RULES.seconds,winner:null,events:[],last:null};}
function fleetOrder(b,id,order){
 const u=b.units.find(u=>u.id===id);if(b.phase!=='plan'||!u||u.dead||u.team!==0||!['hold','move','attack'].includes(order.type))return false;
 const q={...u.order,...order};if(q.type==='move'){if(!Array.isArray(q.point)||q.point.length!==3||!q.point.every(Number.isFinite))return false;q.point=q.point.map((v,i)=>clamp(v,-(i===1?FLEET_RULES.maxAltitude:FLEET_RULES.maxCoordinate),i===1?FLEET_RULES.maxAltitude:FLEET_RULES.maxCoordinate));}
 if(q.type==='attack'&&!b.units.some(t=>t.id===q.target&&t.team!==u.team&&!t.dead))return false;u.order=q;return true;
}
const fleetAngle=a=>Math.atan2(Math.sin(a),Math.cos(a));
function fleetArc(u,target,rates){const dx=target.pos[0]-u.pos[0],dy=target.pos[1]-u.pos[1],dz=target.pos[2]-u.pos[2],c=Math.cos(u.yaw),s=Math.sin(u.yaw),v=[dx*c+dz*s,dy,-dx*s+dz*c],weights=[Math.max(0,v[0]),Math.max(0,-v[0]),Math.max(0,v[2]),Math.max(0,-v[2]),Math.max(0,v[1]),Math.max(0,-v[1])],sum=weights.reduce((a,b)=>a+b,0);return sum?weights.reduce((a,w,i)=>a+w*(rates[i]||0),0)/sum:0;}
function fleetFrame(b,shots=[]){return {time:b.time,units:b.units.map(u=>({id:u.id,pos:[...u.pos],yaw:u.yaw,hp:u.hp,shield:u.shield,air:u.air,launched:u.launched,hatchOpen:u.hatchOpen||0,hatchTarget:u.hatchTarget||0,dead:u.dead,velocity:[...u.velocity]})),shots};}
function fleetTick(b,dt){
 const alive=b.units.filter(u=>!u.dead).sort((a,b)=>String(a.id).localeCompare(String(b.id))),before=alive.map(u=>({...u,pos:[...u.pos],velocity:[...u.velocity]})),byId=new Map(before.map(u=>[u.id,u]));
 for(const u of alive){const o=u.order,t=byId.get(o.target);let dest=o.type==='move'?o.point:o.type==='attack'&&t?t.pos:null;const old=byId.get(u.id),acc=u.p.accel*(.35+.65*u.hp/u.p.hp);let want=[0,0,0];
  if(dest){const delta=sub(dest,old.pos),d=len(delta),yaw=Math.atan2(delta[2],delta[0]),err=fleetAngle(yaw-u.yaw);u.yaw+=clamp(err,-u.p.turnRate*dt,u.p.turnRate*dt);const attack=o.type==='attack',stop=attack?Math.max(FLEET_RULES.engagementDistance,(u.p.len+(t?.p.len||0))*1.3):0,signed=attack?d-stop:d,remaining=attack?Math.max(0,Math.abs(signed)-2500):Math.max(0,signed),direction=attack&&signed<0?-1:1,speed=Math.min(u.p.maxSpeed,Math.sqrt(2*acc*remaining))*Math.max(.08,Math.cos(err));if(d>1){want=mul(norm(delta),speed*direction);const hor=Math.hypot(want[0],want[2])*direction;want[0]=Math.cos(u.yaw)*hor;want[2]=Math.sin(u.yaw)*hor;}}
  const dv=sub(want,old.velocity),n=len(dv);u.velocity=add(old.velocity,mul(dv,Math.min(1,acc*dt/Math.max(1e-9,n))));u.pos=add(old.pos,mul(u.velocity,dt));u.pos[1]=clamp(u.pos[1],-15000,15000);
  if(o.type==='move'&&len(sub(dest,u.pos))<Math.max(10,acc*dt*dt)&&len(u.velocity)<acc*dt*2){u.pos=[...dest];u.velocity=[0,0,0];}
 }
 // Resolve close approaches symmetrically. Hull damage from ramming is not modelled.
 for(let i=0;i<alive.length;i++)for(let j=i+1;j<alive.length;j++){const a=alive[i],z=alive[j],d=sub(z.pos,a.pos),dist=len(d),r=(a.p.len+z.p.len)*.24;if(dist<r){const v=dist>1e-6?mul(d,1/dist):[0,0,1],push=mul(v,(r-dist)/2);a.pos=sub(a.pos,push);z.pos=add(z.pos,push);a.velocity=mul(a.velocity,.8);z.velocity=mul(z.velocity,.8);}}
 const incoming=new Map(alive.map(u=>[u.id,{sf:0,hull:0,direct:0}])),shots=[];
 if(b.combat)for(const u of alive){const o=u.order,p=u.p,health=.35+.65*u.hp/p.hp;
  const requested=o.launch===true&&u.launched<p.slots&&p.launch>0,sliding=(p.slidingHatches||0)>0,oldOpen=clamp(u.hatchOpen||0,0,1);u.hatchTarget=sliding&&requested?1:0;
  const hatchSeconds=u.hatchTarget?(p.hatchOpenSeconds||4):(p.hatchCloseSeconds||4);u.hatchOpen=sliding?clamp(oldOpen+(u.hatchTarget?1:-1)*dt/hatchSeconds,0,1):0;
  const launchDt=requested?(sliding?Math.max(0,dt-(1-oldOpen)*(p.hatchOpenSeconds||4)):dt):0;
  if(launchDt>0){const n=Math.min(p.slots-u.launched,p.launch*health*launchDt);if(n>0){u.launched+=n;u.queue.push([b.time+dt-launchDt+25,n]);}if(u.launched>=p.slots-1e-9){u.launched=p.slots;u.hatchTarget=0;}}
  while(u.queue.length&&u.queue[0][0]<=b.time)u.air+=u.queue.shift()[1];
  const enemies=alive.filter(t=>t.team!==u.team),explicit=enemies.find(t=>t.id===o.target),t=explicit||enemies.sort((a,z)=>len(sub(a.pos,u.pos))-len(sub(z.pos,u.pos))||String(a.id).localeCompare(String(z.id)))[0];
  if(!t||o.fire===false)continue;const distance=len(sub(t.pos,u.pos));if(distance>FLEET_RULES.range)continue;
  const fall=clamp(1-.72*distance/FLEET_RULES.range,.2,1),hit=p.acc*p.rc*health*fall,gun=fleetArc(u,t,p.gunArcs)*hit,ion=fleetArc(u,t,p.ionArcs)*hit,msl=(p.msl||0)/20*health*(1-.7*t.p.aa/(t.p.aa+p.msl*.5+1e-9));
  // Aircraft attrition also reads the common pre-damage snapshot.
  const airEnemy=enemies.reduce((v,e)=>v+byId.get(e.id).air,0),fd=u.air*.6*(1-.5*airEnemy/(u.air+airEnemy+1));
  const loss=Math.min(u.air,(t.p.aa*.012+airEnemy*.012/enemies.length)*dt);u.air-=loss;u.lost+=loss;
  const inc=incoming.get(t.id);inc.sf+=(gun+2*ion+.5*msl+.3*fd)*dt;inc.hull+=(gun+.2*ion+.5*msl+.3*fd)*dt;inc.direct+=(.5*msl+.7*fd)*dt;
  if(gun+ion+msl+fd>0)shots.push({from:u.id,to:t.id,team:u.team,ion:ion>gun});
 }
 for(const u of alive){const o=incoming.get(u.id),diss=u.p.D*dt,over=Math.max(0,o.sf-diss),ab=Math.min(u.shield,over);u.shield=clamp(u.shield+Math.max(0,diss-o.sf)-ab,0,u.shieldMax);u.hp=Math.max(0,u.hp-((over-ab)*(o.sf?o.hull/o.sf:0)+o.direct)*u.p.dr*u.p.crit);if(u.hp<=0){u.dead=true;u.velocity=[0,0,0];b.events.push({time:b.time+dt,text:u.name+'：撃沈',id:u.id});}}
 b.time+=dt;return shots;
}
function fleetCommit(b){
 if(b.phase!=='plan'||b.winner!==null||!b.units.some(u=>u.team===0&&!u.dead))return null;
 const seconds=clamp(Number(b.seconds)||FLEET_RULES.seconds,5,30),work={...b,units:b.units.map(u=>({...u,pos:[...u.pos],velocity:[...u.velocity],order:JSON.parse(JSON.stringify(u.order)),queue:u.queue.map(q=>[...q])})),events:[]};
 for(const u of work.units.filter(u=>u.team===1&&!u.dead)){const enemies=work.units.filter(t=>t.team===0&&!t.dead).sort((a,z)=>len(sub(a.pos,u.pos))-len(sub(z.pos,u.pos))||String(a.id).localeCompare(String(z.id)));u.order={type:enemies.length?'attack':'hold',target:enemies[0]?.id,fire:true,launch:true};}
 const frames=[fleetFrame(work)];for(let t=0;t<seconds;t+=FLEET_RULES.step){const shots=fleetTick(work,FLEET_RULES.step);frames.push(fleetFrame(work,shots));if(b.combat){const teams=[0,1].map(k=>work.units.some(u=>u.team===k&&!u.dead));if(!teams[0]||!teams[1]){work.winner=teams[0]?0:teams[1]?1:-1;break;}}}
 b.phase='execute';b.last={frames,units:work.units,events:work.events,winner:work.winner,time:work.time,duration:work.time-b.time};return b.last;
}
function fleetFinish(b){if(b.phase!=='execute'||!b.last)return false;b.units=b.last.units;b.time=b.last.time;b.winner=b.last.winner;b.events.push(...b.last.events);b.events=b.events.slice(-80);b.turn++;b.phase=b.winner!==null?'finished':'plan';return true;}
function fleetSample(result,elapsed){const fs=result.frames,t=fs[0].time+clamp(elapsed,0,result.duration);let i=Math.min(fs.length-2,Math.max(0,Math.floor((t-fs[0].time)/FLEET_RULES.step))),a=fs[i],b=fs[i+1]||a,q=clamp((t-a.time)/Math.max(1e-9,b.time-a.time),0,1);return {time:t,shots:b.shots,units:a.units.map((u,k)=>{const v=b.units[k];return {...u,pos:u.pos.map((x,j)=>lerp(x,v.pos[j],q)),velocity:u.velocity.map((x,j)=>lerp(x,v.velocity[j],q)),yaw:u.yaw+fleetAngle(v.yaw-u.yaw)*q,hp:lerp(u.hp,v.hp,q),shield:lerp(u.shield,v.shield,q),air:lerp(u.air,v.air,q),launched:lerp(u.launched||0,v.launched||0,q),hatchOpen:lerp(u.hatchOpen||0,v.hatchOpen||0,q),hatchTarget:q>0?v.hatchTarget:u.hatchTarget,dead:q>=1?v.dead:u.dead};})};}

// A structure's local +Y may follow any contacted face, including the underside.
// Heading, pitch and roll are applied in that local frame; mirrors stay proper
// rotations by reflecting the local Z axis as well as the world Z axis.
function structFrame(p){
 const key=JSON.stringify([p.surfaceNormal,p.yaw,p.pitch,p.roll]);if(p._frame?.key===key)return p._frame.value;
 let up=norm(p.surfaceNormal||[0,1,0]),fw=sub([1,0,0],mul(up,up[0]));if(len(fw)<.001)fw=sub([0,0,1],mul(up,up[2]));fw=norm(fw);let rt=norm(cross(fw,up));
 const y=(p.yaw||0)*Math.PI/180,pr=(p.pitch||0)*Math.PI/180,rr=(p.roll||0)*Math.PI/180;
 const f0=add(mul(fw,Math.cos(y)),mul(rt,Math.sin(y)));rt=add(mul(fw,-Math.sin(y)),mul(rt,Math.cos(y)));fw=f0;
 const f1=add(mul(fw,Math.cos(pr)),mul(up,Math.sin(pr)));up=add(mul(fw,-Math.sin(pr)),mul(up,Math.cos(pr)));fw=f1;
 const u1=add(mul(up,Math.cos(rr)),mul(rt,Math.sin(rr)));rt=add(mul(up,-Math.sin(rr)),mul(rt,Math.cos(rr)));up=u1;const value={fw,up,rt};p._frame={key,value};return value;
}
function alignStructure(p,hit,mode='horizontal'){
 if(p.k!=='struct')return p;const q={...p,c:[0,0,0]};if(mode==='surface'&&hit.kind!=='section')q.surfaceNormal=norm(hit.n);else delete q.surfaceNormal;
 if(hit.kind==='section'){q.c=hit.p.slice();return q;}
 const n=norm(hit.n),T=structTriangles(q);let low=Infinity;for(let i=0;i<T.length;i+=3)low=Math.min(low,T[i]*n[0]+T[i+1]*n[1]+T[i+2]*n[2]);q.c=add(hit.p,mul(n,Number.isFinite(low)?-low:0));return q;
}

// Remove a trapezoid in plan view from an otherwise unchanged wedge section.
// Unlike narrowing the station, this preserves the original deck/keel slopes.
function planCutEdge(ship,c,x){const L=ship.hull.L,t=x/L,a=c.from,b=c.to;if(t<a||t>b)return null;const left=clamp(c.innerFrom??lerp(a,b,.35),a+.0001,b-.0002),right=clamp(c.innerTo??lerp(a,b,.7),left+.0001,b-.0001),inner=ship.hull.W*clamp(c.remainingWidth??.5,.03,.98)/2,outerA=sectionBase(ship.hull,a*L).hw,outerB=sectionBase(ship.hull,b*L).hw;return t<left?lerp(outerA,inner,(t-a)/(left-a)):t>right?lerp(inner,outerB,(t-right)/(b-right)):inner;}
function normalizePlanCut(c){c.type='planTrapezoid';c.from=clamp(Number(c.from)||0,0,.96);c.to=clamp(Number(c.to)||1,c.from+.03,1);c.innerFrom=clamp(Number(c.innerFrom)||lerp(c.from,c.to,.35),c.from+.01,c.to-.02);c.innerTo=clamp(Number(c.innerTo)||lerp(c.from,c.to,.7),c.innerFrom+.01,c.to-.01);c.remainingWidth=clamp(Number(c.remainingWidth)||.5,.03,.98);return c;}

// Shared layout operations. X is fore/aft, Y vertical, Z port/starboard.
GROUPS.weapons='武装';
const ALIGNMENTS={none:'自由配置',axis:'中心線（Y＝高さの半分・Z＝0）',horizontal:'上下中心面（Y＝高さの半分）',vertical:'左右中心面（Z＝0）',longitudinal:'前後中央面（X＝全長の半分）'};
function alignedPosition(ship,c,mode){const q=c.slice();if(mode==='axis'||mode==='horizontal')q[1]=ship.hull.H/2;if(mode==='axis'||mode==='vertical')q[2]=0;if(mode==='longitudinal')q[0]=ship.hull.L/2;return q;}
function alignPart(ship,p,mode,mirror=true){
 if(!p||!Object.hasOwn(ALIGNMENTS,mode))return;
 const q={...p,c:alignedPosition(ship,p.c,mode)},t=mirror&&ship.parts.find(t=>t.id===p.tw),center=t&&Math.abs(q.c[2])<.001;
 const m=t&&!center?{...mirrorPart(q,ship),id:t.id,tw:p.id}:null,ignore=[p.id,t?.id];
 if(p.k!=='struct'&&(hardConflicts(ship,q,ignore).length||(m&&hardConflicts(ship,m,ignore).length)))throw new Error('整列先で別の区画と干渉します。先に配置を調整してください');
 p.c=q.c;if(m)Object.assign(t,m);if(center){removeItem(ship,'parts',t.id,false);delete p.tw;}
 if(!mirror&&p.tw){const pair=ship.parts.find(t=>t.id===p.tw);if(pair)delete pair.tw;delete p.tw;}
 return p;
}
function replacementShape(p){
 if(!p||['machinery','capacitor','engine'].includes(p.k))return null;
 if(p.k==='struct')return p.form==='box'?'cube':p.form==='ellipsoid'&&Math.max(...p.s)-Math.min(...p.s)<.01?'sphere':null;
 if(p.skinAsset&&!(p.k==='sensor'&&(equipmentSpec(p)?.id==='isdSensor'||p.skinAsset.startsWith('isd_sensor_'))))return null;
 return ['sphere','cube','cyl'].includes(PARTS[p.k]?.shape)?PARTS[p.k].shape:null;
}
function replacementOptions(p){const shape=replacementShape(p);return shape?Object.keys(PARTS).filter(k=>!['machinery','capacitor','engine'].includes(k)&&(k==='struct'?['sphere','cube'].includes(shape):PARTS[k].shape===shape)):[];}
function replacePart(ship,p,k,mirror=true){
 if(!replacementOptions(p).includes(k))throw new Error('同じ基本形状の設備を選んでください');
 if(k===p.k)return p;
 const list=[p,...(mirror?ship.parts.filter(q=>q.id===p.tw):[])],made=list.map(old=>{
  if(!replacementOptions(old).includes(k))throw new Error('左右の部品の形状が一致していません');
  const q={id:old.id,k,c:old.c.slice(),...(old.tw?{tw:old.tw}:{})};
  for(const key of ['autoFit','yaw','dir','pitch','roll','surfaceNormal'])if(old[key]!=null)q[key]=Array.isArray(old[key])?old[key].slice():old[key];
  const shape=replacementShape(old);
  if(k==='struct'){q.s=old.room?.slice()||[old.d,old.d,old.d];q.form=shape==='sphere'?'ellipsoid':'box';q.taper=0;}
  else if(old.k==='struct'){q.d=Math.cbrt(old.s[0]*old.s[1]*old.s[2]);if(shape==='cube'){q.room=old.s.slice();q.d=Math.max(...q.room);}}
  else{q.d=old.d;for(const key of ['room','outline','corner','foreWidth','aftWidth','deckSlope','ridge','length'])if(old[key]!=null)q[key]=JSON.parse(JSON.stringify(old[key]));}
  if(k==='hangar')q.airRole='mixed';
  if(isInternal(q))q._envelope=ship;
  return q;
 });
 const removed=new Set(list.map(q=>q.id));
 // Validate against a prospective ship, including changed reactor routes and shell.
 const trial={...ship,parts:ship.parts.map(q=>made.find(m=>m.id===q.id)||q),hatches:ship.hatches.filter(h=>k==='hangar'||!removed.has(h.bay))};
 delete trial._clipEnvelope;delete trial._engines4;delete trial._commands;
 for(const q of made)if(isInternal(q))q._envelope=trial;
 for(const q of made)if(q.k!=='struct'&&hardConflicts(trial,q,Array.from(removed)).length)throw new Error('交換後の区画が機関や指揮室と干渉します');
 if(made.length>1&&k!=='struct'&&!flexibleCompartment(trial,made[0])&&!flexibleCompartment(trial,made[1])&&overlapParts(made[0],made[1]))throw new Error('交換後の左右の区画が重なります');
 for(const old of list){const q=made.find(q=>q.id===old.id);for(const key of Object.keys(old))delete old[key];Object.assign(old,q);if(isInternal(old))old._envelope=ship;}
 ship.hatches=trial.hatches;
 if(!mirror&&p.tw){const t=ship.parts.find(q=>q.id===p.tw);if(t)delete t.tw;delete p.tw;}
 return p;
}

const COMMAND_ROLES={bridge:'航行・艦隊指揮',combat:'戦闘指揮',air:'航空指揮',hangar:'格納庫管制'};
function commandCompartments(ship){
 const fs=ship.fits.filter(f=>FITS[f.k]?.window&&!f.float&&f.commandEnabled!==false);
 const key=JSON.stringify(fs,(k,v)=>k.startsWith('_')?undefined:v)+JSON.stringify(fs.map(f=>f._wallUp));
 if(ship._commands?.key===key)return ship._commands.parts;
 const parts=fs.map(f=>{const p=windowBay(f);p.commandRole=FITS[f.k].role;p.host=f.host;p.label=COMMAND_ROLES[p.commandRole]+'区画';p.requiredVolume=p.boxSize.reduce((a,b)=>a*b,1);return p;});
 ship._commands={key,parts};return parts;
}
function commandStatus(ship,invalid=new Set()){
 const byFit={};for(const p of commandCompartments(ship)){const volume=partVolume(p),ratio=invalid.has(p.id)?0:clamp(volume/Math.max(1,p.requiredVolume),0,1);byFit[p.windowId]={id:p.id,volume,required:p.requiredVolume,ratio,host:p.host,role:p.commandRole,blocked:invalid.has(p.id)};}
 // A model bridge body is its own command space.
 for(const f of intrinsicCommandFits(ship)){const ok=!invalid.has(f.host);byFit[f.id]={id:f.id,volume:0,required:0,ratio:ok?1:0,host:f.host,role:FITS[f.k].role,blocked:!ok,intrinsic:true};}
 return byFit;
}

// Spatial integration of the envelope UNION, minus the occupancy UNION. This
// avoids adding overlapping structures twice or counting equipment outside it.
// Residual decks were already included in hull mass/hotel load; assigning their
// purpose does not create extra material or change installed engine ratings.
function habitationSpace(ship){
 const key=JSON.stringify([ship.hull,ship.cuts,ship.subs,ship.trenches,ship.solidCuts,ship.parts,ship.fits,ship.hatches,ship.keel],(k,v)=>k.startsWith('_')?undefined:v);
 if(ship._habitation?.key===key)return ship._habitation;
 const boxes=ship.parts.filter(p=>p.k==='struct').map(partAABB);
 if(!ship.hull.assembly){const secs=hullGeo(ship).secs;let lo=Infinity,hi=-Infinity;for(const s of secs)for(const y of s.Y){if(y<lo)lo=y;if(y>hi)hi=y;}boxes.push([0,lo,-ship.hull.W/2,ship.hull.L,hi,ship.hull.W/2]);}
 if(!boxes.length)return {volume:0,envelopeVolume:0,step:0,points:[],cell:[1,1,1]};
 const b=[0,1,2].map(i=>Math.min(...boxes.map(b=>b[i]))).concat([3,4,5].map(i=>Math.max(...boxes.map(b=>b[i])))),span=[0,1,2].map(i=>Math.max(.01,b[i+3]-b[i]));
 const step=Math.cbrt(span.reduce((a,b)=>a*b,1)/36000),ns=span.map((v,i)=>clamp(Math.ceil(v/step),8,[140,70,100][i])),cell=span.map((v,i)=>v/ns[i]),dv=cell.reduce((a,b)=>a*b,1);
 const bodies=allOccupied(ship).map(p=>({p,b:partAABB(p)})),mouths=ship.hatches.map(h=>openingBounds(ship,h)).filter(Boolean),points=[];let n=0,envelope=0;
 for(let i=0;i<ns[0];i++){
  const x=b[0]+(i+.5)*cell[0],row=bodies.filter(q=>x>=q.b[0]&&x<=q.b[3]),holes=mouths.filter(q=>x>=q[0]&&x<=q[3]),keel=ship.hull.assembly?null:keelAt(ship,x);
  for(let j=0;j<ns[1];j++)for(let k=0;k<ns[2];k++){
   const q=[x,b[1]+(j+.5)*cell[1],b[2]+(k+.5)*cell[2]];
   if(!insideOriginalEnvelope(ship,q))continue;envelope++;
   if(keel&&q[1]>=keel.y0&&q[1]<=keel.y1&&Math.abs(q[2])<=keel.w/2)continue;
   if(holes.some(h=>inBox(q,h)))continue;
   if(row.some(r=>q[1]>=r.b[1]&&q[1]<=r.b[4]&&q[2]>=r.b[2]&&q[2]<=r.b[5]&&inPart(r.p,q)))continue;
   n++;points.push(q);
  }
 }
 return ship._habitation={key,volume:n*dv,envelopeVolume:envelope*dv,step,cell,points};
}
function layoutStats(ship,S){
 const h=habitationSpace(ship);S.autoHabitationVolume=ship.autoHabitation===false?0:h.volume;S.unassignedVolume=h.volume;
 S.explicitCrewCapacity=S.crewCapacity;S.autoCrewCapacity=Math.floor(S.autoHabitationVolume/24);S.crewCapacity+=S.autoCrewCapacity;S.habit=S.crew?S.crewCapacity/S.crew:1;
 S.commandVolume=[...commandCompartments(ship),...ship.parts.filter(p=>p.k==='command')].reduce((n,p)=>n+partVolume(p),0);
 S.warnings=S.warnings.filter(w=>!w.text.startsWith('居住区'));
 if(S.habit<1)S.warnings.push({lv:'warn',code:'habitation',text:`居住区の収容 ${S.crewCapacity.toLocaleString()} 名／必要乗員 ${S.crew.toLocaleString()} 名。`});
 for(const [id,c] of Object.entries(S.commandInfo))if(c.ratio<.95)S.warnings.push({lv:'warn',code:'command-room',fitId:+id,text:`${COMMAND_ROLES[c.role]}区画 #${id} は${c.blocked?'他区画と干渉':'外殻内の容積が不足'}しています（有効 ${Math.round(c.ratio*100)}%）。`});
 for(const p of ship.parts.filter(p=>p.k==='command')){const ratio=clamp(partVolume(p)/Math.max(1,unclippedPartVolume(p)),0,1);if(ratio<.95)S.warnings.push({lv:'warn',code:'command-room',partId:p.id,text:`無窓式指揮室 #${p.id} は外殻内の容積が不足しています（有効 ${Math.round(ratio*100)}%）。`});}
 for(const p of ship.parts)if(p._packing?.limited)S.warnings.push({lv:'warn',code:'packing-space',partId:p.id,text:`${partLabel(p)} #${p.id} の自動統合後の容積が不足しています（${Math.round(p._packing.retained*100)}%）。近くの空間を空けるか構造を追加してください。`});
 S.warnings=S.warnings.map(w=>({...w,targets:inspectionTargets(ship,S,w)}));return S;
}
function inspectionTargets(ship,S,w){
 const target=(p)=>p.windowId?{list:'fits',id:p.windowId}:p.weaponId?{list:'fits',id:p.weaponId}:p.nozzle?{list:'parts',id:p.nozzle}:{list:'parts',id:p.id};
 const parts=(pred,fallback)=>{const a=allOccupied(ship).filter(pred).map(target);return a.length?a:[{part:fallback}];};
 const txt=w.text;
 if(w.partId)return [{list:'parts',id:w.partId}];
 if(w.fitId)return [{list:'fits',id:w.fitId}];
 if(w.code==='charging')return ship.fits.filter(f=>S.chargeInfo[f.id]?.capacityRatio<.999).map(f=>({list:'fits',id:f.id}));
 if(w.code==='air-capacity'||w.code==='air-size')return [{tab:'launch'},...parts(p=>p.k==='hangar'&&hangarCapacity(p)>0,'hangar')];
 if(w.code==='air-access')return [{tab:'launch'},...parts(p=>p.k==='hangar'&&!S.info[p.id]?.acc,'hangar')];
 if(/居住/.test(txt))return [{tab:'systems',section:'habitation'},...parts(p=>p.k==='crew','crew')];
 if(/重なり|干渉/.test(txt))return parts(p=>S.info[p.id]?.overlap,'struct');
 if(/浮いている区画/.test(txt))return parts(p=>S.info[p.id]?.inside<.02&&S.info[p.id]?.exposed>.98&&!attachedEngine(ship,p),'struct');
 if(/取り付け面/.test(txt))return ship.fits.filter(f=>f.float).map(f=>({list:'fits',id:f.id}));
 if(/ノズル|エンジン|噴射口/.test(txt))return parts(p=>p.k==='engine'&&(!reactorFor(ship,p)||!S.info[p.id]?.vent),'engine');
 if(/艦橋/.test(txt))return [{tab:'bridge',section:'command'}];
 if(/航空指揮所/.test(txt))return [{tab:'bridge',window:'podAir'}];
 if(/航空整備/.test(txt))return parts(p=>p.k==='service','service');
 if(/ハッチに通じていない/.test(txt))return parts(p=>p.k==='hangar'&&!S.info[p.id]?.acc,'hangar');
 if(/ハッチ/.test(txt))return ship.hatches.filter(h=>!S.hatchInfo[h.id]?.connected).map(h=>({list:'hatches',id:h.id}));
 if(/供給能力/.test(txt))return parts(p=>p.k==='pump','pump');
 if(/サイロ/.test(txt))return parts(p=>p.k==='fuel','fuel');
 if(/慣性制御/.test(txt))return parts(p=>p.k==='inertial','inertial');
 if(/構造維持/.test(txt))return parts(p=>p.k==='integrity','integrity');
 if(/断面|縦強度/.test(txt))return [{tab:'hull'},...parts(p=>p.k==='struct','struct')];
 if(/給電/.test(txt))return parts(isReactor,'gen');
 if(/シールド/.test(txt))return [...parts(p=>p.k==='shield'||p.k==='localShield','shield'),{tab:'armor'}];
 if(/ハイパードライブ|跳躍/.test(txt))return parts(p=>p.k==='hyper','hyper');
 if(/露出/.test(txt))return [...parts(isReactor,'gen'),{part:'struct'},{tab:'armor'}];
 if(/射界|兵装の充電/.test(txt))return [{tab:'arm'},...ship.fits.filter(f=>FITS[f.k].cat==='w').map(f=>({list:'fits',id:f.id}))];
 if(/ジェネレーター|給電/.test(txt))return parts(isReactor,'gen');
 return [{tab:'systems'}];
}

// Editable convex cutting solids. Their displayed facets, point tests and closed
// subtraction all use the same planes, including rotation and mirrored cuts.
const SOLID_CUT_SHAPES=Object.freeze({box:'直方体',wedge:'楔形',cylinder:'円柱',ellipsoid:'球・楕円体'});
const SOLID_CUT_CACHE=new WeakMap();
function normalizeSolidCut(input={}){
 input=input&&typeof input==='object'?input:{};
 const finite=(v,lo,hi,fallback)=>v!=null&&Number.isFinite(Number(v))?clamp(Number(v),lo,hi):fallback;
 const c={shape:Object.hasOwn(SOLID_CUT_SHAPES,input.shape)?input.shape:'box',c:[0,1,2].map(i=>finite(input.c?.[i],-DESIGN_LIMITS.coordinate,DESIGN_LIMITS.coordinate,0)),s:[0,1,2].map(i=>finite(input.s?.[i],1,DESIGN_LIMITS.partSize,100)),rotation:[0,1,2].map(i=>finite(input.rotation?.[i],-180,180,0)),mirror:input.mirror===true,structures:input.structures===true};
 if(Number.isSafeInteger(input.id)&&input.id>0)c.id=input.id;
 return c;
}
function mirrorSolidCut(input){const c=normalizeSolidCut(input);c.c[2]*=-1;c.rotation[0]*=-1;c.rotation[1]*=-1;c.mirror=false;return c;}
function solidCutRotation(q,v){
 const [rx,ry,rz]=q.rotation.map(a=>a*Math.PI/180),sx=Math.sin(rx),cx=Math.cos(rx),sy=Math.sin(ry),cy=Math.cos(ry),sz=Math.sin(rz),cz=Math.cos(rz);
 const a=[v[0],v[1]*cx-v[2]*sx,v[1]*sx+v[2]*cx],b=[a[0]*cy+a[2]*sy,a[1],-a[0]*sy+a[2]*cy];
 return [b[0]*cz-b[1]*sz,b[0]*sz+b[1]*cz,b[2]];
}
function solidCutInstance(q){
 const [L,W,H]=q.s,faces=[],world=p=>add(q.c,solidCutRotation(q,p)),points=[];
 if(q.shape==='box'){
  const v=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(a=>[a[0]*L/2,a[1]*H/2,a[2]*W/2]);
  for(const ids of [[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[0,3,7,4],[1,5,6,2]])faces.push(ids.map(i=>v[i]));
 }else if(q.shape==='wedge'){
  const v=[[-L/2,-H/2,-W/2],[L/2,-H/2,-W/2],[-L/2,H/2,-W/2],[-L/2,-H/2,W/2],[L/2,-H/2,W/2],[-L/2,H/2,W/2]];
  for(const ids of [[0,1,2],[3,5,4],[0,3,4,1],[0,2,5,3],[1,4,5,2]])faces.push(ids.map(i=>v[i]));
 }else if(q.shape==='cylinder'){
  const N=32,rings=[-1,1].map(s=>Array.from({length:N},(_,i)=>{const a=i/N*Math.PI*2;return [Math.cos(a)*L/2,s*H/2,Math.sin(a)*W/2];}));
  faces.push(rings[0],rings[1]);for(let i=0;i<N;i++)faces.push([rings[0][i],rings[0][(i+1)%N],rings[1][(i+1)%N],rings[1][i]]);
 }else{
  const N=20,M=10,p=(i,j)=>{if(i===0)return [0,H/2,0];if(i===M)return [0,-H/2,0];const a=i/M*Math.PI,b=j/N*Math.PI*2;return [L/2*Math.sin(a)*Math.cos(b),H/2*Math.cos(a),W/2*Math.sin(a)*Math.sin(b)];};
  for(let i=0;i<M;i++)for(let j=0;j<N;j++)faces.push(i===0?[p(0,j),p(1,j),p(1,j+1)]:i===M-1?[p(i,j),p(M,j),p(i,j+1)]:[p(i,j),p(i+1,j),p(i+1,j+1),p(i,j+1)]);
 }
 const center=q.shape==='wedge'?world([-L/6,-H/6,0]):q.c,T=[],planes=[];
 for(let poly of faces){poly=poly.map(world);let n=norm(cross(sub(poly[1],poly[0]),sub(poly[2],poly[0])));if(dot(n,sub(poly[0],center))<0){poly.reverse();n=mul(n,-1);}const d=dot(n,poly[0]);planes.push({n,d,poly});triangulateFan(poly,T);for(const p of poly)points.push(p);}
 const bounds=[0,1,2].map(i=>Math.min(...points.map(p=>p[i]))).concat([0,1,2].map(i=>Math.max(...points.map(p=>p[i]))));
 return {q,planes,bounds,tris:Float32Array.from(T)};
}
function compiledSolidCut(input){
 const q=normalizeSolidCut(input),key=JSON.stringify(q),cached=SOLID_CUT_CACHE.get(input);if(cached?.key===key)return cached;
 const instances=[solidCutInstance(q)];if(q.mirror){const m=mirrorSolidCut(q);if(JSON.stringify([m.c,m.rotation])!==JSON.stringify([q.c,q.rotation]))instances.push(solidCutInstance(m));}
 const data={key,instances};SOLID_CUT_CACHE.set(input,data);return data;
}
function solidCutTriangles(c,includeMirror=true){const instances=compiledSolidCut(c).instances;if(!includeMirror||instances.length===1)return instances[0].tris;const T=new Float32Array(instances.reduce((s,q)=>s+q.tris.length,0));let i=0;for(const q of instances){T.set(q.tris,i);i+=q.tris.length;}return T;}
function solidCutBounds(c,includeMirror=true){const a=compiledSolidCut(c).instances;if(!includeMirror||a.length===1)return a[0].bounds.slice();return [0,1,2].map(i=>Math.min(...a.map(q=>q.bounds[i]))).concat([3,4,5].map(i=>Math.max(...a.map(q=>q.bounds[i]))));}
function solidCutContains(c,p){return compiledSolidCut(c).instances.some(q=>p.every((v,i)=>v>q.bounds[i]-1e-7&&v<q.bounds[i+3]+1e-7)&&q.planes.every(a=>dot(a.n,p)<a.d-1e-7));}
function solidCutsContain(ship,p,structures=false){
 if(!ship.solidCuts?.length)return false;
 const data=cache(ship);if(!data.solidCutInstances)data.solidCutInstances=ship.solidCuts.flatMap(c=>compiledSolidCut(c).instances.map(q=>({...q,structures:c.structures})));
 return data.solidCutInstances.some(q=>(!structures||ship.hull.assembly||q.structures)&&p.every((v,i)=>v>q.bounds[i]-1e-7&&v<q.bounds[i+3]+1e-7)&&q.planes.every(a=>dot(a.n,p)<a.d-1e-7));
}
function solidPartCutContains(p,q){const s=p._solidCutShip;return !!s&&solidCutsContain(s,q,true);}
function solidMeshBounds(T){const b=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];for(let i=0;i<T.length;i++){const a=i%3;b[a]=Math.min(b[a],T[i]);b[a+3]=Math.max(b[a+3],T[i]);}return b;}
function solidBoundsOverlap(a,b,e=0){return a[0]<b[3]-e&&a[3]>b[0]+e&&a[1]<b[4]-e&&a[4]>b[1]+e&&a[2]<b[5]-e&&a[5]>b[2]+e;}
function solidMeshArea(T){let area=0;for(let i=0;i<T.length;i+=9)area+=len(cross([T[i+3]-T[i],T[i+4]-T[i+1],T[i+5]-T[i+2]],[T[i+6]-T[i],T[i+7]-T[i+1],T[i+8]-T[i+2]]))/2;return area;}
// Join collinear slice edges before capping. This avoids copying all of the
// hull's longitudinal subdivisions into an otherwise flat rectangular cut.
function solidSimplifySegments(segments,eps){
 const nodes=[],index=new Map(),node=p=>{const k=p.map(v=>Math.round(v/eps)).join(',');let i=index.get(k);if(i==null){i=nodes.length;index.set(k,i);nodes.push({p,edges:new Set()});}return i;};
 for(const [a,b] of segments){const i=node(a),j=node(b);if(i!==j){nodes[i].edges.add(j);nodes[j].edges.add(i);}}
 const queue=nodes.map((_,i)=>i);for(let k=0;k<queue.length;k++){
  const i=queue[k],n=nodes[i];if(n.edges.size!==2)continue;const [a,b]=Array.from(n.edges),A=nodes[a].p,B=nodes[b].p,P=n.p,u=[A[0]-P[0],A[1]-P[1]],v=[B[0]-P[0],B[1]-P[1]],lu=Math.hypot(...u),lv=Math.hypot(...v);
  if(u[0]*v[0]+u[1]*v[1]>=0||Math.abs(u[0]*v[1]-u[1]*v[0])>eps*(lu+lv))continue;
  nodes[a].edges.delete(i);nodes[b].edges.delete(i);n.edges.clear();nodes[a].edges.add(b);nodes[b].edges.add(a);queue.push(a,b);
 }
 const out=[];nodes.forEach((n,i)=>{for(const j of n.edges)if(j>i)out.push([n.p,nodes[j].p]);});return out;
}
// Slice from the side that remains after subtraction. Treat vertices exactly
// on the plane as lying on the cutter side, which also handles coplanar faces.
function solidSliceSegments(T,plane,u,v,origin,eps){
 const segments=[],project=p=>[dot(sub(p,origin),u),dot(sub(p,origin),v)],n=plane.n,d=plane.d;
 for(let i=0;i<T.length;i+=9){
  const ds=[0,3,6].map(k=>T[i+k]*n[0]+T[i+k+1]*n[1]+T[i+k+2]*n[2]-d),side=ds.map(x=>x>eps);if(side.every(Boolean)||side.every(x=>!x))continue;
  const pts=[];for(let k=0;k<3;k++){const j=(k+1)%3;if(side[k]===side[j])continue;const a=i+k*3,b=i+j*3,t=clamp(ds[k]/(ds[k]-ds[j]),0,1);pts.push([lerp(T[a],T[b],t),lerp(T[a+1],T[b+1],t),lerp(T[a+2],T[b+2],t)]);}
  if(pts.length===2&&len(sub(pts[1],pts[0]))>eps)segments.push(pts.map(project));
 }
 return solidSimplifySegments(segments,eps);
}
function solidSegmentY(edge,x){const [a,b]=edge;return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);}
function solidSegmentCrossX(a,b,eps){
 const p=a[0],q=b[0],r=[a[1][0]-p[0],a[1][1]-p[1]],s=[b[1][0]-q[0],b[1][1]-q[1]],cross2=(x,y)=>x[0]*y[1]-x[1]*y[0],det=cross2(r,s);if(Math.abs(det)<eps*eps)return null;
 const delta=[q[0]-p[0],q[1]-p[1]],t=cross2(delta,s)/det,z=cross2(delta,r)/det;return t>=0&&t<=1&&z>=0&&z<=1?p[0]+r[0]*t:null;
}
// Even-odd intervals preserve concave sections, disconnected pieces and holes
// from earlier cuts. Slab boundaries include every edge crossing, so the caps
// meet the surviving shell exactly instead of approximating it with a grid.
function solidConvexCaps(T,instance,eps){
 const out=[];
 for(const plane of instance.planes){
  const f=frameAxis(plane.n),u=f.v,v=f.w,origin=plane.poly[0],project=p=>[dot(sub(p,origin),u),dot(sub(p,origin),v)],poly=plane.poly.map(project),faceEdges=poly.map((p,i)=>[p,poly[(i+1)%poly.length]]),xmin=Math.min(...poly.map(p=>p[0])),xmax=Math.max(...poly.map(p=>p[0]));
  const segments=solidSliceSegments(T,plane,u,v,origin,eps).filter(e=>Math.max(e[0][0],e[1][0])>xmin+eps&&Math.min(e[0][0],e[1][0])<xmax-eps&&Math.abs(e[1][0]-e[0][0])>eps);if(!segments.length)continue;
  const events=poly.map(p=>p[0]);for(const e of segments){for(const p of e)if(p[0]>xmin&&p[0]<xmax)events.push(p[0]);for(const edge of faceEdges){const x=solidSegmentCrossX(e,edge,eps);if(x!=null&&x>xmin&&x<xmax)events.push(x);}}
  events.sort((a,b)=>a-b);const xs=events.filter((x,i)=>!i||x-events[i-1]>eps),hits=(edges,x)=>edges.filter(e=>Math.min(e[0][0],e[1][0])<x&&Math.max(e[0][0],e[1][0])>x).map(e=>({edge:e,y:solidSegmentY(e,x)})).sort((a,b)=>a.y-b.y),world=(x,y)=>{const p=add(origin,add(mul(u,x),mul(v,y)));return plane.poly.find(q=>len(sub(q,p))<eps*4)||p;};
  for(let i=0;i<xs.length-1;i++){
   const a=xs[i],b=xs[i+1];if(b-a<=eps)continue;const x=(a+b)/2,h=hits(segments,x),bounds=hits(faceEdges,x);if(bounds.length<2)continue;
   for(let j=0;j+1<h.length;j+=2){const lo=h[j].y>bounds[0].y?h[j]:bounds[0],hi=h[j+1].y<bounds.at(-1).y?h[j+1]:bounds.at(-1);if(hi.y-lo.y<=eps)continue;const cap=[world(a,solidSegmentY(lo.edge,a)),world(a,solidSegmentY(hi.edge,a)),world(b,solidSegmentY(hi.edge,b)),world(b,solidSegmentY(lo.edge,b))];triangulateFan(cap,out);}
  }
 }
 return out;
}
function subtractSolidInstance(T,instance,capT=T){
 if(!T.length||!solidBoundsOverlap(solidMeshBounds(T),instance.bounds))return T;
 const out=[],bounds=instance.bounds,eps=Math.max(1e-7,Math.max(...bounds.map(Math.abs))*1e-9),planes=instance.planes;
 for(let i=0;i<T.length;i+=9){
  const a=[T[i],T[i+1],T[i+2]],b=[T[i+3],T[i+4],T[i+5]],c=[T[i+6],T[i+7],T[i+8]];
  if([0,1,2].some(k=>Math.max(a[k],b[k],c[k])<bounds[k]-eps||Math.min(a[k],b[k],c[k])>bounds[k+3]+eps)||planes.some(p=>dot(p.n,a)>p.d+eps&&dot(p.n,b)>p.d+eps&&dot(p.n,c)>p.d+eps)){out.push(...a,...b,...c);continue;}
  let poly=[a,b,c];for(const p of planes){const ds=poly.map(v=>dot(p.n,v)-p.d);if(ds.every(d=>d<=eps))continue;if(ds.every(d=>d>=-eps)){triangulateFan(poly,out);poly=[];break;}triangulateFan(clipGeneral(poly,mul(p.n,-1),-p.d),out);poly=clipGeneral(poly,p.n,p.d);if(poly.length<3)break;}
 }
 for(const n of solidConvexCaps(capT,instance,Math.max(eps,1e-6)))out.push(n);
 return Float32Array.from(out);
}
// capT: the same body without trench slots. Its cross-section caps each cut,
// so a cut through a trench leaves a flat face that closes the slot.
function applySolidCuts(ship,T,structures=false,capT=null){
 if(!ship.solidCuts?.length||!T.length)return T;
 let result=T,caps=capT;for(const c of ship.solidCuts){if(structures&&!ship.hull.assembly&&!c.structures)continue;for(const q of compiledSolidCut(c).instances){const next=subtractSolidInstance(result,q,caps||result);if(caps)caps=subtractSolidInstance(caps,q);result=next;}}return result;
}
function slotlessHull(ship,which){if(!ship.trenches?.some(t=>t.mode==='split'&&t.depth>0))return null;const g=uncutSolidHullGeo(ship,true);return which==='material'?(g.materialTris||g.tris):g.tris;}
function solidCutIntersectsShip(ship,c){
 const g=hullGeo(ship),targets=[{tris:g.tris,inside:p=>inHull(ship,p)}];
 if(ship.hull.assembly||c.structures)for(const p of ship.parts)if(p.k==='struct')targets.push({tris:structTriangles(p),inside:q=>inStruct(p,q)});
 for(const target of targets){if(!target.tris.length)continue;const bounds=solidMeshBounds(target.tris);
  for(const q of compiledSolidCut(c).instances){if(!solidBoundsOverlap(bounds,q.bounds,1e-6))continue;
   const center=q.q.shape==='wedge'?add(q.q.c,solidCutRotation(q.q,[-q.q.s[0]/6,-q.q.s[2]/6,0])):q.q.c;if(target.inside(center))return true;
   for(let i=0;i<target.tris.length;i+=9){let poly=[Array.from(target.tris.slice(i,i+3)),Array.from(target.tris.slice(i+3,i+6)),Array.from(target.tris.slice(i+6,i+9))];if([0,1,2].some(a=>Math.max(...poly.map(p=>p[a]))<q.bounds[a]||Math.min(...poly.map(p=>p[a]))>q.bounds[a+3]))continue;
    for(const plane of q.planes){poly=clipGeneral(poly,plane.n,plane.d-1e-5);if(poly.length<3)break;}if(poly.length>2&&len(cross(sub(poly[1],poly[0]),sub(poly[2],poly[0])))>1e-7)return true;
   }
  }
 }
 return false;
}
// Until the engine has delivered geometry, a client ship has an empty hull:
// interface queries stay instant instead of rebuilding the loft here.
const CLIENT_EMPTY_GEO=new WeakMap();
function clientEmptyGeo(ship){let g=CLIENT_EMPTY_GEO.get(ship);if(!g){const sec={Z:new Float64Array([0]),Y:new Float64Array([0]),area:0};g={xs:[0,ship.hull.L],secs:[sec,sec],N:1,tris:new Float32Array(),area:0,volume:0,caps:[],pending:true};CLIENT_EMPTY_GEO.set(ship,g);}return g;}
function hullGeo(ship){
 if(ship._client)return ship._geoProxy?.hull||clientEmptyGeo(ship);
 const g=uncutSolidHullGeo(ship);for(const p of ship.parts)if(p.k==='struct')p._solidCutShip=ship;
 if(!ship.solidCuts?.length||!g.tris.length)return g;
 const key=JSON.stringify(ship.solidCuts),old=ship._solidHull;if(old?.base===g&&old.key===key)return old.g;
 const tris=applySolidCuts(ship,g.tris,false,slotlessHull(ship));
 // Existing hulls report a station-integrated volume. Keep that baseline and
 // apply the remaining fraction from the same closed mesh before/after the cut.
 const material=g.materialTris||g.tris,cutMaterial=material===g.tris?tris:applySolidCuts(ship,material,false,slotlessHull(ship,'material')),remaining=meshVolume(cutMaterial)/Math.max(1e-9,meshVolume(material)),result=tris===g.tris?g:{...g,tris,materialTris:cutMaterial,area:solidMeshArea(tris),volume:g.volume*clamp(remaining,0,1),bvh:null};ship._solidHull={base:g,key,g:result};return result;
}
function structTriangles(p){
 const base=uncutSolidStructTriangles(p),ship=p._solidCutShip;if(!ship?.solidCuts?.some(c=>ship.hull.assembly||c.structures)){delete p._solidGeometry;return base;}
 const key=JSON.stringify([ship.hull.assembly,ship.solidCuts]),old=p._solidGeometry;if(old?.base===base&&old.key===key)return old.tris;
 const materialBase=p._apertures?.length?p._pierced.material:base,material=applySolidCuts(ship,materialBase,true);let tris=material;
 if(materialBase!==base){const doors=base.slice(materialBase.length),fragments=[];for(let i=0;i<doors.length;i+=9){let polys=[[Array.from(doors.slice(i,i+3)),Array.from(doors.slice(i+3,i+6)),Array.from(doors.slice(i+6,i+9))]];for(const c of ship.solidCuts){if(!ship.hull.assembly&&!c.structures)continue;for(const q of compiledSolidCut(c).instances){const next=[];for(let poly of polys)for(const plane of q.planes){const outside=clipGeneral(poly,mul(plane.n,-1),-plane.d);if(outside.length>2)next.push(outside);poly=clipGeneral(poly,plane.n,plane.d);if(poly.length<3)break;}polys=next;}}for(const poly of polys)triangulateFan(poly,fragments);}tris=new Float32Array(material.length+fragments.length);tris.set(material);tris.set(fragments,material.length);}
 p._solidGeometry={base,key,tris,material};return tris;
}
function solidStructVolume(p){const T=structTriangles(p);return meshVolume(p._solidGeometry?.material||(p._apertures?.length?p._pierced.material:T));}

// Aviation openings belong to a compartment face. A finite compartment must
// reach the first exterior shell on that face; it never drills a remote roof.
const AVIATION_SURFACE_FACES=Object.freeze({top:'上面',bottom:'腹面',port:'左舷',stbd:'右舷',fore:'艦首',aft:'艦尾'});
const AVIATION_ENVELOPE_CACHE=new WeakMap(),AVIATION_CONTACT_CACHE=new WeakMap();
function hatchAxes(h){const axis=typeof h==='number'?h:[0,1,2].reduce((a,i)=>Math.abs(h.n?.[i]||0)>Math.abs(h.n?.[a]||0)?i:a,0);return {axis,longAxis:axis===0?2:0,widthAxis:axis===1?2:1};}
function aviationFaceNormal(face){return face==='fore'?[1,0,0]:face==='aft'?[-1,0,0]:face==='top'?[0,1,0]:face==='bottom'?[0,-1,0]:face==='stbd'?[0,0,1]:[0,0,-1];}
function aviationPublicJSON(value){return JSON.stringify(value,(k,v)=>k.startsWith('_')?undefined:v);}
function aviationEnvelope(ship){
 const locked=ship._lockedCache&&AVIATION_ENVELOPE_CACHE.get(ship);if(locked)return locked;
 const structures=ship.parts.filter(p=>p.k==='struct'),key=aviationPublicJSON([ship.hull,ship.cuts,ship.subs,ship.trenches,ship.solidCuts,structures]);
 const old=AVIATION_ENVELOPE_CACHE.get(ship);if(old?.key===key)return old;
 const raw={};for(const [k,v] of Object.entries(ship))if(!k.startsWith('_'))raw[k]=v;raw.hatches=[];raw.parts=[];
 let hull=v3HullGeo(raw).tris;for(const c of ship.subs||[])hull=subtractBoxMesh(hull,c.b);hull=applySolidCuts(raw,hull);
 const sources=[hull];for(const p of structures){let tris=unpiercedStructTriangles(p);for(const c of ship.subs||[])if(ship.hull.assembly||c.structures)tris=subtractBoxMesh(tris,c.b);sources.push(applySolidCuts(raw,tris,true));}
 const tris=new Float32Array(sources.reduce((n,a)=>n+a.length,0));let off=0;for(const source of sources){tris.set(source,off);off+=source.length;}
 const value={key,tris,bounds:solidMeshBounds(tris),bvh:tris.length?buildBVH(tris):null};AVIATION_ENVELOPE_CACHE.set(ship,value);return value;
}
function aviationFiniteBounds(p,h){
 const {axis,longAxis,widthAxis}=hatchAxes(h),positive=h.n[axis]>0,b=partAABB({...p,_packing:null}),inner=lerp(b[axis],b[axis+3],h.sill??.5),pad=.04;
 b[axis+(positive?0:3)]=inner;b[axis+(positive?3:0)]+=positive?pad:-pad;
 const mid=(b[widthAxis]+b[widthAxis+3])/2,half=(b[widthAxis+3]-b[widthAxis])*(h.aperture??.85)/2;b[widthAxis]=mid-half;b[widthAxis+3]=mid+half;
 const rim=Math.min(2,(b[longAxis+3]-b[longAxis])*.025);b[longAxis]+=rim;b[longAxis+3]-=rim;
 if(axis===1&&p.room&&!p.outline&&!p.surfaceNormal&&![p.yaw,p.pitch,p.roll].some(v=>Math.abs(v||0)>.001)){const w=p.room[1]*(h.aperture??.85)/2,at=x=>w*lerp(p.aftWidth??1,p.foreWidth??1,clamp((x-p.c[0])/p.room[0]+.5,0,1));b.push(at(b[0]),at(b[3]));}
 return b;
}
function aviationSurfaceHit(ship,p,h,t,v,envelope=aviationEnvelope(ship)){
 if(!envelope.bvh)return null;const {axis,longAxis,widthAxis}=hatchAxes(h),sign=h.n[axis],o=[0,0,0],d=[0,0,0];o[longAxis]=t;o[widthAxis]=v;o[axis]=envelope.bounds[axis+(sign>0?3:0)]+sign*2;d[axis]=-sign;
 const hit=rayBVH(envelope.bvh,o,d);if(!hit)return null;
 // Test both sides of a coincident boundary to keep exact contact stable. The
 // inward point must still belong to the compartment, including its rotation.
 const point=sub(hit.p,mul(h.n,.02));if(!unclippedInPart(p,point))return null;
 const b=aviationFiniteBounds(p,h);if(hit.p[axis]<b[axis]-.05||hit.p[axis]>b[axis+3]+.05)return null;
 return hit;
}
function aviationContact(ship,p,face,envelope=aviationEnvelope(ship)){
 const existing=ship.hatches.find(h=>h.bay===p.id&&h.face===face),h={n:aviationFaceNormal(face),aperture:existing?.aperture??.85,sill:existing?.sill??.5},key=envelope.key+aviationPublicJSON([p.c,p.room,p.d,p.yaw,p.pitch,p.roll,p.surfaceNormal,p.outline,p.corner,p.aftWidth,p.foreWidth,p.deckSlope,p.ridge,h]);
 let cache=AVIATION_CONTACT_CACHE.get(p);if(!cache){cache=new Map();AVIATION_CONTACT_CACHE.set(p,cache);}const old=cache.get(face);if(old?.key===key)return old;
 const b=aviationFiniteBounds(p,h),{axis,longAxis,widthAxis}=hatchAxes(h),nu=24,nv=16,points=[],valid=[],mid=(b[widthAxis]+b[widthAxis+3])/2;
 const point=(i,j)=>{const t=lerp(b[longAxis],b[longAxis+3],i/nu),v=mid+(j/nv*2-1)*openingHalf(b,t,widthAxis),hit=aviationSurfaceHit(ship,p,h,t,v,envelope);return {t,v,hit};};
 for(let i=0;i<=nu;i++)for(let j=0;j<=nv;j++){const q=point(i,j);points.push(q);valid.push(!!q.hit);}
 const index=(i,j)=>i*(nv+1)+j,cells=Array.from({length:nu},(_,i)=>Array.from({length:nv},(_,j)=>valid[index(i,j)]&&valid[index(i+1,j)]&&valid[index(i,j+1)]&&valid[index(i+1,j+1)]&&!!point(i+.5,j+.5).hit));
 // Select a contiguous uncovered rectangle. This keeps a covering structure or
 // a concavity from opening an unrelated face inside the bay's bounding box.
 let best=null;for(let start=0;start<nu;start++){const columns=Array(nv).fill(true);for(let end=start;end<nu;end++){for(let j=0;j<nv;j++)columns[j]=columns[j]&&cells[end][j];let left=0;for(let j=0;j<=nv;j++){if(j<nv&&columns[j])continue;if(j>left){const score=(end-start+1)*(j-left);if(!best||score>best.score)best={i0:start,i1:end+1,j0:left,j1:j,score};}left=j+1;}}}
 let bounds=null,area=0;if(best){const q=best,t0=lerp(b[longAxis],b[longAxis+3],q.i0/nu),t1=lerp(b[longAxis],b[longAxis+3],q.i1/nu);bounds=b.slice();bounds[longAxis]=t0;bounds[longAxis+3]=t1;
  if(q.j0+q.j1===nv&&b.length>6){const f=(q.j1-q.j0)/nv;bounds[6]=openingHalf(b,t0,widthAxis)*f;bounds[7]=openingHalf(b,t1,widthAxis)*f;const half=Math.max(bounds[6],bounds[7]);bounds[widthAxis]=mid-half;bounds[widthAxis+3]=mid+half;area=(t1-t0)*(bounds[6]+bounds[7]);}
  else{const lows=[],highs=[];for(let i=q.i0;i<=q.i1;i++){const t=lerp(b[longAxis],b[longAxis+3],i/nu),half=openingHalf(b,t,widthAxis);lows.push(mid+(q.j0/nv*2-1)*half);highs.push(mid+(q.j1/nv*2-1)*half);}bounds.length=6;bounds[widthAxis]=Math.max(...lows);bounds[widthAxis+3]=Math.min(...highs);area=(t1-t0)*Math.max(0,bounds[widthAxis+3]-bounds[widthAxis]);}
  if(area<.1)bounds=null;
 }
 const value={key,face,label:AVIATION_SURFACE_FACES[face],contact:!!bounds,area:bounds?area:0,bounds};cache.set(face,value);return value;
}
function aviationSurfaceContacts(ship,p){if(p?.k!=='hangar')return [];const env=aviationEnvelope(ship);return Object.keys(AVIATION_SURFACE_FACES).map(face=>{const c=aviationContact(ship,p,face,env);return {face,label:c.label,contact:c.contact,area:c.area,kind:p.aviationSurfaces?.[face]||ship.hatches.find(h=>h.bay===p.id&&h.face===face)?.k||'none'};});}
function aviationOpeningBounds(ship,h){const p=ship.parts.find(p=>p.id===h.bay&&p.k==='hangar');if(!p)return null;if(ship._aviationSyncing||ship._lockedCache)return h._surfaceBounds||null;return aviationContact(ship,p,h.face).bounds?.slice()||null;}
function aviationHatchActive(ship,h){return h.surface?!!openingBounds(ship,h):!h.portal||!!openingBounds(ship,h);}
function setAviationSurfaceMode(ship,p,face,kind){
 if(p?.k!=='hangar'||!Object.hasOwn(AVIATION_SURFACE_FACES,face)||!['none','open','ray'].includes(kind))return null;
 p.aviationSurfaces={...p.aviationSurfaces,[face]:kind};let h=ship.hatches.find(q=>q.bay===p.id&&q.face===face);
 if(kind==='none'){ship.hatches=ship.hatches.filter(q=>q.bay!==p.id||q.face!==face);return null;}
 if(!h){const n=aviationFaceNormal(face);h={id:ship.nextId++,k:kind,a:p.c.slice(),b:p.c.slice(),n,w:4,bay:p.id,portal:true,surface:true,face,open:1,aperture:.85};if(ship.reference==='venator'){h.motion='slide';h.open=0;}ship.hatches.push(h);}
 h.k=kind;h.surface=true;syncAviationSurfaces(ship);return h;
}
function migrateAviationSurfaces(ship,source=ship){
 ship._aviationMigrated=true;
 for(const p of ship.parts.filter(p=>p.k==='hangar')){const raw=source.parts?.find(q=>q.id===p.id)?.aviationSurfaces;if(raw&&typeof raw==='object'){p.aviationSurfaces={};for(const face of Object.keys(AVIATION_SURFACE_FACES))if(['none','open','ray'].includes(raw[face]))p.aviationSurfaces[face]=raw[face];}}
 // Retain a legacy opening's operating state when its owning bay still exists.
 // A detached decal can only migrate onto an actually contacted aviation face.
 const standalone=ship.hatches.filter(h=>!h.bay);for(const h of standalone){const face=Object.keys(AVIATION_SURFACE_FACES).reduce((a,f)=>dot(aviationFaceNormal(f),h.n)>dot(aviationFaceNormal(a),h.n)?f:a,'top'),center=mul(add(h.a,h.b),.5);let best=null;
  for(const p of ship.parts.filter(p=>p.k==='hangar')){const c=aviationContact(ship,p,face);if(!c.contact)continue;const b=c.bounds,{axis,longAxis,widthAxis}=hatchAxes({n:aviationFaceNormal(face)});if(center[longAxis]<b[longAxis]-1||center[longAxis]>b[longAxis+3]+1||center[widthAxis]<b[widthAxis]-1||center[widthAxis]>b[widthAxis+3]+1)continue;const distance=Math.abs(center[axis]-p.c[axis]);if(!best||distance<best.distance)best={p,face,distance};}
  if(best&&!ship.hatches.some(q=>q!==h&&q.bay===best.p.id&&q.face===best.face)){h.bay=best.p.id;h.face=best.face;h.portal=true;h.surface=true;h.open??=1;h.aperture??=.85;delete h.cut;}else ship.hatches=ship.hatches.filter(q=>q!==h);
 }
 for(const p of ship.parts.filter(p=>p.k==='hangar')){const ports=source.parts?.find(q=>q.id===p.id)?.airPorts;if(!ports||typeof ports!=='object')continue;
  for(const [face,port] of Object.entries(ports)){if(!Object.hasOwn(AVIATION_SURFACE_FACES,face)||!port||!['none','open','ray'].includes(port.mode))continue;if(p.aviationSurfaces?.[face]!=null)continue;setAviationSurfaceMode(ship,p,face,port.mode);const h=ship.hatches.find(q=>q.bay===p.id&&q.face===face);if(h){h.motion=port.door?'slide':'fixed';h.open=port.door&&Number.isFinite(port.open)?clamp(port.open,0,1):1;}}
 }
 syncAviationSurfaces(ship);
}
function syncAviationSurfaces(ship){
 // A locked cache means the caller has already synchronised the openings.
 if(ship._client||ship._lockedCache)return;
 if(!ship.hatches.length&&ship._aviationSurfaceKey==null&&!ship.parts.some(p=>p.k==='hangar'&&Object.values(p.aviationSurfaces||{}).some(k=>k==='open'||k==='ray')))return;
 if(ship._aviationSyncing)return;if(!ship._aviationMigrated&&ship.hatches.some(h=>!h.bay)){migrateAviationSurfaces(ship);return;}ship._aviationSyncing=true;
 try{ship.hatches=ship.hatches.filter(h=>!h.surface||ship.parts.some(p=>p.id===h.bay&&p.k==='hangar'));for(const p of ship.parts.filter(p=>p.k==='hangar')){
  p.aviationSurfaces||={};for(const h of ship.hatches.filter(h=>h.bay===p.id&&Object.hasOwn(AVIATION_SURFACE_FACES,h.face))){if(p.aviationSurfaces[h.face]==null)p.aviationSurfaces[h.face]=h.k;h.surface=true;}
  for(const [face,kind] of Object.entries(p.aviationSurfaces)){if(!Object.hasOwn(AVIATION_SURFACE_FACES,face))continue;if(kind==='none'){ship.hatches=ship.hatches.filter(h=>h.bay!==p.id||h.face!==face);continue;}let h=ship.hatches.find(h=>h.bay===p.id&&h.face===face);if(!h){h={id:ship.nextId++,k:kind,a:p.c.slice(),b:p.c.slice(),n:aviationFaceNormal(face),w:4,bay:p.id,portal:true,surface:true,face,open:ship.reference==='venator'?0:1,aperture:.85};if(ship.reference==='venator')h.motion='slide';ship.hatches.push(h);}h.k=kind;h.portal=true;h.surface=true;h.n=aviationFaceNormal(face);}
 }
 const envelope=aviationEnvelope(ship);for(const h of ship.hatches.filter(h=>h.surface)){const p=ship.parts.find(p=>p.id===h.bay&&p.k==='hangar'),contact=p&&aviationContact(ship,p,h.face,envelope);h._surfaceBounds=contact?.bounds?.slice()||null;h._surfaceArea=contact?.area||0;if(!h._surfaceBounds)continue;const b=h._surfaceBounds,{axis,longAxis,widthAxis}=hatchAxes(h),mid=(b[widthAxis]+b[widthAxis+3])/2;h.a=[0,0,0];h.b=[0,0,0];for(const q of [h.a,h.b]){q[axis]=b[axis+(h.n[axis]>0?3:0)];q[widthAxis]=mid;}h.a[longAxis]=b[longAxis];h.b[longAxis]=b[longAxis+3];h.w=b[widthAxis+3]-b[widthAxis];}
 const signature=JSON.stringify(ship.hatches.filter(h=>h.surface).map(h=>[h.id,h.k,h._surfaceBounds]));if(ship._aviationSurfaceKey!==signature){ship._aviationSurfaceKey=signature;for(const key of ['_cache','_portalGeo','_solidHull','_referenceHull','_armoredMaterial','_interiorKey'])delete ship[key];}
 }finally{delete ship._aviationSyncing;}
}


return {turretRayContext,turretClear,turretOrigin,turretRate,GROUND_LIMITS,GROUND_PRESETS,GROUND_VEHICLE_VOLUME,normalizeGroundForces,groundStatus,planStations,bridgeBodyRole,podPoint,podDepth,intrinsicCommandFits,POD_ASSET,BRIDGE_BODY_COMMAND,REFERENCE_TONE,engineSkinMesh,referenceFitYaw,rayTris,vmirrorPlane,vmirrorPoint,vmirrorPart,SHIP_CLASSES,shipClassFor,PUBLIC_LISTS,publicJSON,patchShip,patchItem,cache,AIRCRAFT_CLEARANCE,aircraftFitsBay,AVIATION_SIZE_VOLUME,AIR_WING_LIMITS,hangarCapacity,normalizeAirWings,aviationStatus,AVIATION_SURFACE_FACES,hatchAxes,aviationSurfaceContacts,setAviationSurfaceMode,syncAviationSurfaces,aviationHatchActive,isSlidingHatch,slidingHatchSpec,slidingHatchPanels,hatchOpenArea,ISD_HYPER_BASELINE,HYPER_CLASS_COEFFICIENT,HYPER_POWER_DENSITY,ISD_SHIELD_VOLUME,SHIELD_BUFFER_SECONDS,SHIELD_ENERGY_DENSITY,SHIELD_POWER_DENSITY,REACTOR_POWER_DENSITY,SOLID_CUT_SHAPES,normalizeSolidCut,mirrorSolidCut,solidCutTriangles,solidCutBounds,solidCutContains,solidCutsContain,applySolidCuts,solidPartCutContains,solidStructVolume,solidCutIntersectsShip,flexibleCompartment,hardConflicts,weaponChargeSpec,DREADNOUGHT_EXAMPLES,DESIGN_LIMITS,ALIGNMENTS,alignedPosition,alignPart,replacementShape,replacementOptions,replacePart,COMMAND_ROLES,commandCompartments,commandStatus,habitationSpace,inspectionTargets,planCutEdge,normalizePlanCut,structFrame,alignStructure,FLEET_RULES,fleetProfile,fleetUnit,fleetFormation,fleetBattle,fleetOrder,fleetArc,fleetTick,fleetCommit,fleetFinish,fleetSample,fleetFrame,normalizeBow,bowStation,engineHullEntry,ENGINE_BASELINES,engineBaseline,resizeEngine,parametricEngine,engineRating,sourceEngine,EQUIPMENT,equipmentSpec,equipmentOptions,enforceEquipment,customizeEquipment,adoptEquipment,HYPERDRIVE_REFERENCE,hyperCapacity,arcParameters,arcPoint,arcTriangles,inArc,SEPARATIST_EXAMPLES,STATS_SOURCE,SHIP_REFERENCE,PART_RATINGS,reactorPower,nozzleThrust,nozzleDemand,shieldLoad,partRatingKeys,validOutline,outlinePoints,outlineArea,outlineTriangles,AVIATION_ROLES,CHARGE_TT_M3,aircraftCapacity,aviationConnected,needsCapacitor,weaponCapacitors,refitReferenceInterior,clipReferenceBox, referenceEnginePoint, fitSpec, WEAPON_NOTES, referenceFitPoint, REFERENCE_ASSETS, decodeReference, referencePartPoint, referenceHullGeometry, refPartBounds, attachReferenceSkin, syncCompartments, isInternal, openingHalf, openingPlanes, clipOpening, ISD_PLANT, ISD_REACTOR_VOLUME, loftProfile, loftRing, fitRoomToEnvelope, insideOriginalEnvelope, clipPoly, triangulateFan, originalSurface, originalInHull:v3InHull, openingSurfacePoint, profileAt, roomShape, openingBounds, subtractBoxMesh, openingInterior, openBay, setRoomSize, partLabel, meshVolume, STRUCT_SHAPES, GROUPS, enginePaths, allOccupied, reactorFor, isReactor, inRoute, inStruct, structTriangles, worldStruct, localStruct, frameAxis, windowFrame, windowBay, engineVented, mirrorPart, conflicts, overlapParts, volSamples, exposedSurface,
  TT, G0, ISD_W, K, PARTS, FITS, HULLS, SECTIONS, KEELS, SECTORS, CLASSES, DESIGNS, AXES, AXNAME, ARMOR_MAX,
  newShip, sectionBase, sampleSection, planW, planH, hullGeo, heightfield, inHull, inEnv, inPart, partDims, partVolume, partArea, partAABB, structBox,
  rayEnv, rayPart, rayAABB, raySphere, mountFit, remount, fitFrame, fitOrigin, fitAABB, fitClash, fireArcs, placePart, placeFit, removeItem, twinOf,
  hatchGrid, hatchFrame, fillHangars, keelAt, computeStats, serialize, deserialize, buildDesign, profile, simulate,
  clamp, lerp, add, sub, mul, dot, cross, norm, len, mirrorP};
})();
if (typeof module !== 'undefined') module.exports = Core;
