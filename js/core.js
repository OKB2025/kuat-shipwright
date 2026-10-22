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
    // A trench that follows the side band keeps to each section's band centre.
    const yc=c.chine&&sb.edge!=null?sb.edge:sb.ybot+(sb.ytop-sb.ybot)*c.level, ht=Math.min(c.height,(sb.ytop-sb.ybot)*.8);
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
// Triangle arrays passed here are cached, immutable meshes; a bounding box
// per array lets rays skip every structure they cannot reach.
const RAY_TRI_BOUNDS = new WeakMap();
function rayTrisBounds(T) {
  let b = RAY_TRI_BOUNDS.get(T); if (b) return b;
  b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let i = 0; i < T.length; i += 3) for (let a = 0; a < 3; a++) { const v = T[i + a]; if (v < b[a]) b[a] = v; if (v > b[a + 3]) b[a + 3] = v; }
  const pad = 1e-3 + 1e-6 * Math.max(b[3] - b[0], b[4] - b[1], b[5] - b[2], 0);
  for (let a = 0; a < 3; a++) { b[a] -= pad; b[a + 3] += pad; }
  RAY_TRI_BOUNDS.set(T, b); return b;
}
function rayMissesBox(o, d, b, maxT) {
  let t0 = 0, t1 = maxT == null ? Infinity : maxT;
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-12) { if (o[a] < b[a] || o[a] > b[a + 3]) return true; continue; }
    let ta = (b[a] - o[a]) / d[a], tb = (b[a + 3] - o[a]) / d[a];
    if (ta > tb) { const q = ta; ta = tb; tb = q; }
    if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 > t1) return true;
  }
  return false;
}
function rayTris(T, o, d, maxT) {
  if (T.length > 36 && typeof T === 'object' && rayMissesBox(o, d, rayTrisBounds(T), maxT)) return null;
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
// A weapon set with 「面に合わせる」 on a sloped face stands on that face's
// normal (f.tilt) instead of the nearest axis; f.a stays the nearest axis for
// mirroring and labels. Faces within 4° of an axis keep the axis.
const TILT_MIN = Math.cos(4 * Math.PI / 180);
function fitTilt(n) {
  const u = norm(n); let best = -2; for (const x of AXES) best = Math.max(best, dot(x, u));
  return best >= TILT_MIN ? null : u;
}
function fitUp(f) { return f.tilt || AXES[f.mountAxis ?? f.a]; }
function fitFrameOf(f) {
  if (!f.tilt) return fitFrame(f.a);
  const up = f.tilt, base = fitFrame(f.a);
  let fw = sub(base.fw, mul(up, dot(base.fw, up)));
  if (len(fw) < 1e-3) fw = sub(base.rt, mul(up, dot(base.rt, up)));
  fw = norm(fw);
  return {up, fw, rt: cross(fw, up)};
}
function baseMountFit(ship, f) {
  const d = fitSpec(f), fr = fitFrameOf(f), R = d.r, big = f.localMount||d.casemate ? Math.max(2,Math.min(6,R*.25)) : Math.max(ship.hull.H, ship.hull.W, 200) * 2;
  const h0 = rayEnv(ship, add(f.p, mul(fr.up, big)), mul(fr.up, -1), {maxT: big * 2,structOnly:true});
  delete f._onPlate;
  if (!h0) { f.float = true; f.base = 0; f.low = 0; f.slope = 0; return f; }
  if (h0.part?.plate) { f.float = true; f._onPlate = true; f.base = 0; f.low = 0; f.slope = 0; return f; }
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
function baseFitOrigin(f) { const fr = fitFrameOf(f); return add(f.p, mul(fr.up, f.base + f.ped)); }
function baseFitAABB(f) {
  const d = fitSpec(f), fr = fitFrameOf(f), o = fitOrigin(f), R = d.r * Math.max(1.05, (f.pedSize || 1) * (f.pedShape === 'trap' ? 1.4 : 1.1));
  const top = add(o, mul(fr.up, d.hm)), bot = add(f.p, mul(fr.up, f.low || 0));
  if (f.tilt) { const pts = []; for (const c of [top, bot]) for (const a of [-R, R]) for (const b of [-R, R]) pts.push(add(c, add(mul(fr.fw, a), mul(fr.rt, b)))); return [0, 1, 2].map(i => Math.min(...pts.map(p => p[i]))).concat([0, 1, 2].map(i => Math.max(...pts.map(p => p[i])))); }
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
  const d = fitSpec(f), fr = fitFrameOf(f), o = d.casemate?casemateMuzzle(f):add(fitOrigin(f), mul(fr.up, d.hm * 0.7));
  const maxT = ship.hull.L * 2.2 + 400, offs = [-0.55, 0, 0.55];
  return SECTORS.map(S => {
    let free = 0;
    for (const a of offs) for (const b of offs) {
      const dir = norm([S.d[0] + a * S.u[0] + b * S.v[0], S.d[1] + a * S.u[1] + b * S.v[1], S.d[2] + a * S.u[2] + b * S.v[2]]);
      const facing=dot(dir,fitUp(f));
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
function turretOrigin(f){const d=fitSpec(f),fr=fitFrameOf(f);return d.casemate?casemateMuzzle(f):add(fitOrigin(f),mul(fr.up,d.hm*0.7));}
function turretClear(ship,f,dir,ctx){
  // Guns may depress about 10° below their mounting plane; the hull still blocks.
  const d=fitSpec(f),facing=dot(dir,fitUp(f));
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
  const tilt = options.tilt && d.cat === 'w' && !options.localMount && !d.casemate ? fitTilt(n) : null;
  const f = mountFit(ship, {id: nid(ship), k, p: p.slice(), a, ped: ped == null ? 2 : ped,...(options.localMount?{localMount:true}:{}),...(tilt?{tilt,n:tilt.slice()}:{})});
  if (f.float) return {err: f._onPlate ? '装甲外板には武装・装備を取り付けられません' : '取り付ける面が見つかりません'};
  const clash = fitClash(ship, f); if (clash) return {err: clash};
  ship.fits.push(f);
  if (mirror && Math.abs(f.p[2]) > d.r) {
    const am = a === 4 ? 5 : a === 5 ? 4 : a;
    const g = mountFit(ship, {id: nid(ship), k, p: mirrorP(f.p), a: am, ped: f.ped,...(f.localMount?{localMount:true}:{}),...(f.tilt?{tilt:mirrorP(f.tilt),n:mirrorP(f.tilt)}:{})});
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
  let exposedArea = 0, critExp = 0, critN = 0, critProt = 0, genExpFrac = 0, floating = 0, overlap = 0, citArea = 0, plateA = 0, plateAT = 0, plateM = 0;
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
    if (pt.k === 'struct' && pt.plate) {
      // The outer plateT of the exposed skin is armour; behind it, light framing.
      const t = plateThickness(pt), skin = unclippedPartArea(pt) * expF, armV = Math.min(V, skin * t), m = (V - armV) * .05 + armV * K.armorDens;
      plateA += skin; plateAT += skin * t; plateM += armV * K.armorDens;
      Vstruct += V; structOut += V * (1 - fH); hpSum += (V - armV) * .05 * 1.5; cost += V * d.cost + armV * 30; crew += V * d.crew / 1000;
      const b = structBox(pt);
      { const k0 = binOf(b.x0), k1 = binOf(b.x1), nk = k1 - k0 + 1; for (let k = k0; k <= k1; k++) { strA[k] += b.w * b.h * (1 - b.tp * 0.5) * .12; bins[k] += m / nk; } }
      continue;
    }
    if (pt.k === 'struct') {
      // A light structure (an open framework or a lightly built hull extension,
      // like a freighter's cargo ring) weighs and holds a quarter of a solid one.
      const lf = pt.light ? .25 : 1, vOut = V * (1 - fH), m = (V*.08 + vOut*(K.structDens-.08)) * lf;
      Vstruct += V; structOut += vOut; hpSum += m * 1.5; cost += V * d.cost * lf; crew += V * d.crew / 1000;
      const b = structBox(pt);
      // The whole mass goes into the bins the structure spans (those beyond the hull's own length fold into the end bins).
      { const k0 = binOf(b.x0), k1 = binOf(b.x1), nk = k1 - k0 + 1; for (let k = k0; k <= k1; k++) { strA[k] += b.w * b.h * (1 - b.tp * 0.5) * .12 * lf; bins[k] += m / nk; } }
      continue;
    }
    const m = V * d.dens; hpSum += m * d.hp; cost += V * d.cost; crew += V * d.crew / 1000; Vint += V * newHull/Math.max(1,vs.length);
    const ab = partAABB(pt), k0 = binOf(ab[0]), k1 = binOf(ab[3]), span = k1 - k0 + 1;
    for (let k = k0; k <= k1; k++) {bins[k]+=m/span;hullBins[k]-=V*newHull/Math.max(1,vs.length)*K.hullDens/span;} accepted.push(pt); { const pad = Math.max(ab[3] - ab[0], ab[4] - ab[1], ab[5] - ab[2]) * .05; acceptedBounds.push([ab[0] - pad, ab[1] - pad, ab[2] - pad, ab[3] + pad, ab[4] + pad, ab[5] + pad]); }
    if (V > 0 && fE < 0.02 && expF > 0.98 && !attachedEngine(ship,pt)) { floating++; info[pt.id].floating = true; }
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
  const alpha = [0, 0, 0, 0, 0, 0], ionS = [0, 0, 0, 0, 0, 0], alphaRate=[0,0,0,0,0,0],ionRate=[0,0,0,0,0,0],aaArc=[0,0,0,0,0,0],bandRate={long:[0,0,0,0,0,0],mid:[0,0,0,0,0,0],close:[0,0,0,0,0,0]};
  let alphaTot = 0, ionTot = 0, aa = 0, mslSalvo = 0, tractors = 0, wPower = 0, bPower = 0, bridges = 0, sensor = 0, viewSum = 0, floatFits = 0, plateFits = 0, pedVol = 0;
  const commandInfo=commandStatus(ship,invalid),fitInfo = {};
  for (const f of ship.fits) {
    const raw=fitSpec(f),cr=needsCapacitor(f)?(chargeInfo[f.id]?.ratio||0):1,d={...raw,power:raw.power*cr,tt:(raw.tt||0)*cr,ion:(raw.ion||0)*cr};
    if (f.float) { floatFits++; if (f._onPlate) plateFits++; }
    const ph = Math.max(0, f.base + f.ped - (f.low || 0)), pr = d.r * 0.8, pv = Math.PI * pr * pr * ph; pedVol += pv;
    const m = d.mass + pv * 0.3; crew += d.crew; cost += d.cost;
    bins[binOf(f.p[0])] += m;
    if (d.cat === 'w') {
      if(f.float)continue;
      wPower += d.power;
      if (d.tt || d.ion || d.aa) {
        const arc = fireArcs(ship, f, hf, obst); fitInfo[f.id] = arc;
        const mean = arc.reduce((a, b) => a + b, 0) / 6;
        const br = bandRate[fitBand(FITS[f.k] || d)];
        for (let k = 0; k < 6; k++) { if (d.tt){alpha[k] += d.tt * arc[k];alphaRate[k]+=d.tt*arc[k]/(d.cycle||K.cycle);br[k]+=d.tt*arc[k]/(d.cycle||K.cycle);}if (d.ion){ionS[k] += d.ion * arc[k];ionRate[k]+=d.ion*arc[k]/(d.cycle||K.cycle);}if (d.aa) aaArc[k] += d.aa * arc[k]; }
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
  // The exposed skin is also binned along the length and by facing (bow, stern,
  // starboard, port, dorsal, ventral) with the plate thickness over it: the
  // armour zones the battles load and penetrate.
  const [skX0, skX1] = shipSpan(ship);let skY0 = Infinity, skY1 = -Infinity;for (const sc of g.secs) for (const y of sc.Y) { if (y < skY0) skY0 = y; if (y > skY1) skY1 = y; }
  const skin = {x0: skX0, x1: skX1, n: 40, yc: Number.isFinite(skY0) ? (skY0 + skY1) / 2 : 0, a: new Float64Array(240), t: new Float64Array(240)};
  const area = exposedSurface(ship,occupied,skin);
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
    mass: M, armorMass: armHull + armCit + plateM, dims: [xmax - xmin, zmax * 2, ymax - ymin], ybox: [ymin, ymax], hullLen: ship.hull.core ? Math.max(L, xmax - xmin) : L,
    skin: {x0: skin.x0, x1: skin.x1, n: skin.n, a: Array.from(skin.a, v => Math.round(v)), t: Array.from(skin.t, v => Math.round(v * 10) / 10)},
    power: P, xISD: P / ISD_W, draw: {weapons: Dw, shields: Ds, engines: De, hotel: Dh, ray: Dr, jump: Dj},
    rc, coreRate,weaponBudget,chargeInfo, rm, jumpOK, thrust, aThrust, aStruct, aEff, accelG: aEff / G0, thrustG: aThrust / G0, structG: aStruct / G0,
    weakAt: worstX, cutSection: cut, structLimited: aStruct < aThrust, MGLT: Math.round(aEff / G0 / 30),
    engN, ventEng, Veng, hyperEffectiveVolume, hyperClass: hyperEffectiveVolume > 0 ? clamp(K.hyperK * M / hyperEffectiveVolume, 0.5, 30) : null,
    shieldP, shieldPct, shieldCapacity:shieldCapacity*coreRate, shieldTarget:ship.shieldTarget||1, armorHull: ship.armor.hull, armorCit: cit, armorAvg: ship.armor.hull + (area > 0 ? plateAT / area : 0), armorPlate: plateA > 0 ? plateAT / plateA : 0, plateArea: plateA, plateShare: area > 0 ? Math.min(1, plateA / area) : 0, plateMass: plateM,
    slots, aviation, deployableSlots:aviation.deployableCount, launch, launchTime: launch > 0 && aviation.deployableCount > 0 ? aviation.deployableCount / launch : null, Vhang, Vacc, openA, rayA, deadHatch,
    alphaRate,ionRate,aaArc,bandRate,alpha, alphaTot, alphaBest, alphaMean, ionBest: Math.max(...ionS), ionMean: ionS.reduce((a, b) => a + b, 0) / 6, ionTot, aa, mslSalvo, tractors,
    arcEff: alphaTot > 0 ? alphaBest / alphaTot : 0,
    commandInfo, bridges, view, accuracy, sensor, protectedFrac, critExpo: expo, genExpFrac, vuln,
    hp: hpSum * K.hpPerT + (armHull + armCit + plateM) * 0.2 * K.hpPerT, crew: Math.round(crew), habit, cost,
    floating, floatFits, plateFits, overlap, info, fitInfo, hatchInfo, pedVol,
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
  else if (S.accelG >= 3000) role = '高速'; else if ((S.armorAvg ?? S.armorHull) >= 1.2) role = '重装'; else role = '砲戦';
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
  if (S.floatFits - (S.plateFits || 0) > 0) add2('bad', `取り付け面を失った装備が ${S.floatFits - (S.plateFits || 0)} 基あります。`);
  if (S.plateFits) add2('bad', `装甲外板の上に置かれた装備が ${S.plateFits} 基あります。装甲外板には武装・装備を取り付けられません。`);
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
  return {name, hp: Math.max(1, S.hp), dr: 1 / (1 + (S.armorAvg ?? S.armorHull)), crit: 1 + 0.7 * S.vuln,
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
// Armoured outer plating (装甲外板): a structure whose exposed skin is armour of
// thickness plateT. Its inside is still part of the ship; nothing can be mounted on it.
const PLATE = {def: 1.0, min: 0.2, max: 6};
const plateThickness = p => clamp(Number.isFinite(p?.plateT) ? p.plateT : PLATE.def, PLATE.min, PLATE.max);
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
addComp('battery','パワーセル','cube',0.45,[226,189,77],'power','電力の蓄積設備。戦闘ではシールドへの給電を肩代わりし、炉の出力を推進や兵装に回している間もシールドを再生させます。満充電のシールドの余剰給電で充電され、イオン砲の被弾で奪われます。',{def:30});
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
const BRIDGE_BODY_COMMAND={isd_bridge:{role:'bridge',at:[.5,-.0374,0]},isdh_bridge:{role:'bridge',at:[.5,-.025,0]},exe_bridge:{role:'bridge',at:[.375,-.085,0]},ven_bridge_stbd:{role:'bridge',at:[.5,-.207,0]},ven_bridge_port:{role:'air',at:[.5,-.207,0]}};
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
function exposedSurface(ship,occupied,skin){
  const g=hullGeo(ship),structs=ship.parts.filter(p=>p.k==='struct'),physical=[...structs,...occupied],eps=.12;
  const bounds=physical.map(q=>[q,partAABB(q)]);const inside=(p,skip)=>bounds.some(([q,b])=>q!==skip&&p[0]>=b[0]&&p[0]<=b[3]&&p[1]>=b[1]&&p[1]<=b[4]&&p[2]>=b[2]&&p[2]<=b[5]&&inPart(q,p));let area=0;
  const addMesh=(T,owner)=>{let result=0;const extra=owner?.plate?plateThickness(owner):0;for(let i=0;i<T.length;i+=9){const a=[T[i],T[i+1],T[i+2]],b=[T[i+3],T[i+4],T[i+5]],c=[T[i+6],T[i+7],T[i+8]],n=cross(sub(b,a),sub(c,a)),sz=len(n)/2;if(sz<1e-8)continue;const p=add(mul(add(add(a,b),c),1/3),mul(norm(n),eps));if((owner&&inHull(ship,p))||inside(p,owner))continue;result+=sz;if(skin)skinAdd(skin,(a[0]+b[0]+c[0])/3,n,sz,extra);}return result;};
  area+=addMesh(g.tris,null);for(const p of structs)area+=addMesh(structTriangles(p),p);
  for(const p of occupied){if(p.boxSize||isInternal(p))continue;const ss=surfSamples(p,eps);let ex=0;for(const q of ss)if(!inHull(ship,q)&&!inside(q,p))ex++;const a=partArea(p)*ex/Math.max(1,ss.length);area+=a;if(skin&&a>0&&p.c)skinAdd(skin,p.c[0],[0,p.c[1]-skin.yc,p.c[2]],a,0);}
  return area;
}
// One piece of exposed skin into the survey: its length bin and the face its
// normal points out of (the order of the fire sectors: bow, stern, starboard,
// port, dorsal, ventral).
function skinAdd(sk,x,n,a,extra){const i=clamp(Math.floor((x-sk.x0)/Math.max(1e-6,sk.x1-sk.x0)*sk.n),0,sk.n-1),ax=Math.abs(n[0]),ay=Math.abs(n[1]),az=Math.abs(n[2]),f=ax>=ay&&ax>=az?(n[0]>0?0:1):az>=ay?(n[2]>0?2:3):(n[1]>0?4:5);sk.a[i*6+f]+=a;sk.t[i*6+f]+=a*extra;}
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
  // Command pods belong to exposed structure walls, never hull skins, roofs or armoured plating.
  const valid=h?.part?.k==='struct'&&!h.part.plate&&Math.abs(dot(h.n,structFrame(h.part).up))<.65;
  if(h?.part?.plate)f._onPlate=true;else delete f._onPlate;
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
  const f=make(p,n);if(f.float)return {err:f._onPlate?'装甲外板には艦橋ポッドを取り付けられません。外板のない構造物の壁に取り付けてください':'艦橋ポッドは構造物・艦橋本体の側面や前後の壁に取り付けてください。船体・甲板・天井には取り付けられません'};
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
  s.trenches=(Array.isArray(o.trenches)?o.trenches:[]).slice(0,30).map(c=>({id:ident(c.id),side:['both','port','stbd'].includes(c.side)?c.side:'both',from:number(c.from,0,.99,.1),to:number(c.to,.01,1,.9),level:number(c.level,.1,.9,.5),height:number(c.height,1,500,14),depth:number(c.depth,1,800,20),taper:c.mode==='split'?false:c.taper!==false,...(c.mode==='split'?{mode:'split'}:{}),...(c.chine===true&&c.mode!=='split'?{chine:true}:{})}));
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
  if(Object.hasOwn(SHIP_EXAMPLES,key)){const s=SHIP_EXAMPLES[key].build();s.reference=s.reference||key;return finish(s);}
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
function partLabel(p){return p.label||equipmentSpec(p)?.name||(p.k==='struct'&&p.plate?'装甲外板':PARTS[p.k]?.name)||'区画';}
// Default stations for the section table: they fall on the plan's own corners.
function planStations(h){if(h.plan==='arrow'){const m=clamp(h.maxAt??.3,.05,.9);return [0,m/2,m,m+(1-m)/3,m+(1-m)*2/3,1];}if(h.plan==='rect')return [0,.35,.7,.8,.9,1];return [0,.2,.4,.6,.8,1];}
function profileAt(h,t){
  if(!h.stations?.length)return [t,planW(h,t),planH(h,t,planW(h,t)),0,h.deckWidth??.52,h.keelWidth??0,h.belt??.13,h.chineHeight??.5];
  const a=h.stations;let i=0;while(i<a.length-2&&t>a[i+1][0])i++;
  const u=clamp((t-a[i][0])/Math.max(1e-6,a[i+1][0]-a[i][0]),0,1);
  // Optional 7th/8th entries: the side band's share of this section's depth
  // and its height. A stern wall or a constant-height band changes them
  // station by station.
  return [t,lerp(a[i][1],a[i+1][1],u),lerp(bowStation(h,i)?a[i][1]:a[i][2],bowStation(h,i+1)?a[i+1][1]:a[i+1][2],u),lerp(a[i][3]??0,a[i+1][3]??0,u),lerp(a[i][4]??h.deckWidth??.52,a[i+1][4]??h.deckWidth??.52,u),lerp(a[i][5]??h.keelWidth??0,a[i+1][5]??h.keelWidth??0,u),lerp(a[i][6]??h.belt??.13,a[i+1][6]??h.belt??.13,u),lerp(a[i][7]??h.chineHeight??.5,a[i+1][7]??h.chineHeight??.5,u)];
}
function sectionBase(hp,x){
  if(hp.assembly)return {t:x/hp.L,pw:0,ph:0,hw:0,h:0,yc:0,poly:[[0,0],[0,0],[0,0],[0,0]],ell:null,ytop:0,ybot:0,E:0};
  if(!hp.stations?.length&&hp.sec!=='warship')return v3SectionBase(hp,x);
  const t=clamp(x/hp.L,0,1),[,pw,ph,dy,dw,kw,bw,cw]=profileAt(hp,t),hw=hp.W*pw/2,h=hp.H*ph,yc=hp.H*(.5+dy),top=yc+h/2,bot=yc-h/2;
  const deck=clamp(dw,0,.98),belt=clamp(bw??hp.belt??.13,.02,.98),edge=bot+h*clamp(cw??hp.chineHeight??.5,.2,.8),keel=clamp(kw??hp.keelWidth??0,0,.98);
  let poly;
  if(hp.sec==='warship')poly=[[-hw*keel,bot],[hw*keel,bot],[hw,Math.max(bot,edge-h*belt/2)],[hw,Math.min(top,edge+h*belt/2)],[hw*deck,top],[-hw*deck,top],[-hw,Math.min(top,edge+h*belt/2)],[-hw,Math.max(bot,edge-h*belt/2)]];
  else {const s=v3SectionBase({...hp,stations:null,W:hp.W*pw,H:h,plan:'rect',bowW:1,bowH:1},0);if(s.ell)return {...s,t,pw,ph,hw,h,yc,ytop:top,ybot:bot};poly=s.poly.map(q=>[q[0],q[1]+yc-h/2]);}
  return {t,pw,ph,hw,h,yc,poly,ell:null,ytop:top,ybot:bot,E:hw,edge:hp.sec==='warship'?edge:undefined};
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
// While a stats pass or a batch of fittings is placed, structure shapes stay
// fixed, so each part's unpierced mesh is looked up once instead of
// re-deriving its cache key for every point and ray test.
let STRUCT_FREEZE=null;
function withFrozenStructures(fn){if(STRUCT_FREEZE)return fn();STRUCT_FREEZE=new Map();try{return fn();}finally{STRUCT_FREEZE=null;}}
function unpiercedStructTriangles(p){
  if(STRUCT_FREEZE){let t=STRUCT_FREEZE.get(p);if(!t){t=liveUnpiercedStructTriangles(p);STRUCT_FREEZE.set(p,t);}return t;}
  return liveUnpiercedStructTriangles(p);
}
function liveUnpiercedStructTriangles(p){
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
  for(const q of made){for(const a of ['autoFit','engineLength','equipmentId','customEquipment','arcBands','bands','arcInner','arcStart','arcSweep','label','length','corner','aftWidth','foreWidth','paint','bodyLength','bodyRadius','ribSpacing','nozzleLength','throatRatio','wallInset','ridge','deckSlope','skin','skinAsset','skinAxial','skinAnchor','skinDiameter','skinSize','airRole','pitch','roll','surfaceNormal'])if(opt[a]!=null)q[a]=opt[a];if(q.k==='struct'&&opt.plate){q.plate=true;q.plateT=plateThickness(opt);}if(q.k==='struct'&&opt.light&&!opt.plate)q.light=true;if(opt.outline)q.outline=opt.outline.map(a=>[a[0],a[1]*(q===p?1:-1)]);if(opt.loft)q.loft=opt.loft.map(a=>a.length>4?[...a.slice(0,4),a[4]*(q===p?1:-1)]:a.slice());if(q!==p&&q.form==='arc')q.arcStart=((-(p.arcStart??30)-(p.arcSweep??300)+540)%360)-180;if(opt.surfaceNormal)q.surfaceNormal=q===p?opt.surfaceNormal.slice():mirrorP(opt.surfaceNormal);if(q!==p&&opt.roll!=null)q.roll=-opt.roll;if(opt.room)setRoomSize(q,opt.room);if(opt.yaw!=null&&q.k!=='struct')q.yaw=q===p?opt.yaw:-opt.yaw;}
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
function computeStats(ship){return withFrozenStructures(()=>{syncCompartments(ship);ship._lockedCache=cache(ship);try{const s=v3ComputeStats(ship);s.sensorVolume=ship.parts.filter(p=>p.k==='sensor'||p.k==='scanner').reduce((n,p)=>n+partVolume(p),0);return hatchMotionStats(ship,layoutStats(ship,groundingStats(ship,outfittingStats(ship,s))));}finally{delete ship._lockedCache;}});}
// Port-light colours a design may carry (the renderer holds the tints).
const SHIP_LIGHT_KINDS=['white','blue','warm','off'];
function serialize(ship){const o=v3Serialize(ship);o.groundForces=normalizeGroundForces(ship.groundForces);for(const k of ['paint','lights','detail','reference','hullSkin','autoHabitation','hullLocked','shipClass'])if(ship[k]!=null)o[k]=JSON.parse(JSON.stringify(ship[k]));return o;}
function deserialize(o){
  const s=v3Deserialize(o),finite=(v,lo,hi,d)=>Number.isFinite(v)?clamp(v,lo,hi):d;
  if(Array.isArray(o.hull?.stations)&&o.hull.stations.length>=2&&o.hull.stations.length<=32){const a=o.hull.stations.map((p,i)=>{const r=[finite(p?.[0],0,1,i/(o.hull.stations.length-1)),finite(p?.[1],.005,1.5,1),finite(p?.[2],.005,1.5,1)];if(p?.length>3)r.push(finite(p[3],-.5,.8,0));if(p?.length>4)r.push(finite(p[4],0,.98,.52));if(p?.length>5)r.push(finite(p[5],0,.98,0));if(p?.length>6)r.push(finite(p[6],.02,.98,.13));if(p?.length>7)r.push(finite(p[7],.2,.8,.5));return r;}).sort((a,b)=>a[0]-b[0]);if(a.some((p,i)=>i&&p[0]-a[i-1][0]<.001))throw new Error('船体断面の位置が重複しています');a[0][0]=0;a.at(-1)[0]=1;s.hull.stations=a;}
  if(SHIP_CLASSES.some(c=>c.id===o.shipClass))s.shipClass=o.shipClass;
  if(SHIP_LIGHT_KINDS.includes(o.lights))s.lights=o.lights;
  s.autoHabitation=o.autoHabitation!==false;s.hullLocked=o.hullLocked!==false;s.hull.assembly=!!o.hull?.assembly;if(o.hull?.core===true)s.hull.core=true;if(o.hull?.bowFree===true)s.hull.bowFree=true;normalizeBow(s.hull);
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
    if(p.k==='struct'&&q.plate===true){p.plate=true;p.plateT=plateThickness(q);}if(p.k==='struct'&&q.light===true&&!p.plate)p.light=true;
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
  s.paint=['republic','neutral','dark','cis'].includes(o.paint)?o.paint:'neutral';s.detail=finite(o.detail,0,2,1);if(o.reference)s.reference=String(o.reference).slice(0,80);for(const h of s.hatches){const q=o.hatches.find(q=>q.id===h.id);if(q.motion==='fixed')h.motion='fixed';else if(q.motion==='slide'||isSlidingHatch(s,h))h.motion='slide';}if(REFERENCE_ASSETS[o.hullSkin?.asset]?.kind==='hull'&&o.hullSkin.base?.hull){const b=o.hullSkin.base,valid=[b.hull.L,b.hull.W,b.hull.H].every(v=>Number.isFinite(v)&&v>0&&v<=4000)&&Array.isArray(b.hull.stations)&&b.hull.stations.length>=2&&b.hull.stations.length<=64&&b.hull.stations.every(a=>Array.isArray(a)&&a.length>=3&&a.every(Number.isFinite))&&Array.isArray(b.trenches)&&b.trenches.length<=30&&Array.isArray(b.cuts)&&b.cuts.length<=50;if(valid){s.hullSkin=JSON.parse(JSON.stringify(o.hullSkin));s.hullSkin.enabled=!!o.hullSkin.enabled;}}for(const f of s.fits){const q=o.fits.find(q=>q.id===f.id);if(q.localMount)f.localMount=true;if(Array.isArray(q.tilt)&&q.tilt.length===3&&q.tilt.every(Number.isFinite)&&len(q.tilt)>.5&&FITS[f.k].cat==='w'&&!FITS[f.k].casemate&&!f.localMount){f.tilt=norm(q.tilt);if(!f.n)f.n=f.tilt.slice();}if(typeof q.batteryZone==='string')f.batteryZone=q.batteryZone.slice(0,40);if(FITS[f.k].window){f.commandEnabled=q.commandEnabled!==false;if(q.commandDepth!=null)f.commandDepth=finite(q.commandDepth,2,200,12);if(q.commandHeight!=null)f.commandHeight=finite(q.commandHeight,2,80,8);}if(Number.isFinite(q.chargeSalvos))f.chargeSalvos=finite(q.chargeSalvos,1,20,1);if(Number.isFinite(q.chargeDepth))f.chargeDepth=finite(q.chargeDepth,1,500,10);if(Number.isFinite(q.chargeScale))f.chargeScale=finite(q.chargeScale,.25,4,1);if(Number.isFinite(q.assetYaw))f.assetYaw=finite(q.assetYaw,-180,180,0);if(Number.isFinite(q.scale))f.scale=finite(q.scale,.25,4,1);if(Number.isInteger(q.mountAxis)&&q.mountAxis>=0&&q.mountAxis<=5)f.mountAxis=q.mountAxis;if(Number.isFinite(q.mountOffset))f.mountOffset=finite(q.mountOffset,-50,50,0);if(REFERENCE_ASSETS[q.skinAsset])f.skinAsset=q.skinAsset;}for(const h of s.hatches){const q=o.hatches.find(q=>q.id===h.id);if(q.referenceMouth)h.referenceMouth=true;if(REFERENCE_ASSETS[q.skinAsset]){h.skinAsset=q.skinAsset;if(Array.isArray(q.skinBayAnchor)&&q.skinBayAnchor.length===3&&q.skinBayAnchor.every(Number.isFinite))h.skinBayAnchor=q.skinBayAnchor.slice();}}migrateAviationSurfaces(s,o);migrateAviation(s,o);s.groundForces=normalizeGroundForces(o.groundForces);
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
function openingSurfacePoint(ship,h,x,v){const {axis:ax,longAxis:l,widthAxis:u}=hatchAxes(h);if(h.surface){const bay=ship.parts.find(p=>p.id===h.bay);let hit=bay&&aviationSurfaceHit(ship,bay,h,x,v);if(!hit&&bay&&(h._surfaceMode!==undefined?h._surfaceMode:aviationContact(ship,bay,h.face).mode)==='face')hit=aviationFaceHit(ship,bay,h,x,v);return hit?add(hit.p,mul(h.n,.9)):null;}const p=[0,0,0],skin=originalSurface(ship,x,ax,v,h.n[ax]);if(skin==null)return null;p[l]=x;p[u]=v;p[ax]=skin+h.n[ax]*.9;return p;}

// Plating just outside an opening (the ray-shield halo). Unlike
// openingSurfacePoint it does not require the point to belong to the bay.
// A mouth inside a recess is reached from the open space in front of it.
function openingRimPoint(ship,h,x,v){if(!h.surface)return openingSurfacePoint(ship,h,x,v);const env=aviationEnvelope(ship);if(!env.bvh)return null;const {axis,longAxis,widthAxis}=hatchAxes(h),sign=h.n[axis],o=[0,0,0],d=[0,0,0];o[longAxis]=x;o[widthAxis]=v;d[axis]=-sign;
 const b=openingBounds(ship,h);if(b){o[axis]=b[axis+(sign>0?3:0)]+sign*.5;if(!insideOriginalEnvelope(ship,o)){const hit=rayBVH(env.bvh,o,d);if(hit)return add(hit.p,mul(h.n,.9));}}
 o[axis]=env.bounds[axis+(sign>0?3:0)]+sign*2;const hit=rayBVH(env.bvh,o,d);return hit?add(hit.p,mul(h.n,.9)):null;}
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
 const hull=(k,x,zf,under,scale)=>{const z=zf*sectionBase(ship.hull,x).hw,h=rayEnv(ship,[x,under?-1000:1000,z],[0,under?1:-1,0]);if(!h)return null;const r=placeFit(ship,k,h.p,h.n,0,false);if(r.fit&&scale)r.fit.scale=scale;if(r.fit&&needsCapacitor(r.fit))r.fit.chargeDepth=14;return r.fit||null;};
 if(key==='imperial'){
  for(const x of [200,470])for(const z of [-160,160])gun('htl',x,z);
  for(const x of [360,420,480])for(const z of [-60,60])gun('triple40',x,z);
  for(const z of [-110,110])gun('triple40',560,z);gun('triple40',600,0);
  // The ISD-I weapon plan beyond the main batteries: ion batteries along the
  // dorsal edges, missile launchers on the centre line (fore, amidships, aft
  // under the keel), tractor projectors round the ventral hangar and point
  // defence lasers along the lower hull. zf is a share of the half-width there.
  for(const x of [640,880,1120])for(const zf of [-.74,.74])hull('ion',x,zf,false,.8);
  for(const x of [700,980,1260])hull('msl',x,0,false);
  for(const x of [380,1230])hull('msl',x,0,true);
  for(const [x,zf] of [[740,.42],[1010,.62],[1140,.34]])for(const sg of [-1,1])hull('trc',x,sg*zf,true);
  for(const x of [430,660,1170,1330])for(const zf of [-.62,.62])hull('pd',x,zf,true);
  // Broadside batteries along the side trench, from the hangar to the bow.
  trenchBattery(ship,Array.from({length:16},(_,i)=>260+i*72),'casemateMid');
 }
 if(key==='acclamator'){
  for(const f of ship.fits)if(f.k==='ltl')f.k='quad200';
  gunsDeck(ship,'pd',[.16,.36,.58],[.88],null,false,0);
 }
 if(key==='venator'||key==='acclamator')for(const x of key==='venator'?[250,285]:[445,545])for(const z of key==='venator'?[-150,150]:[-50,50])gun('msl',x,z);
 // Venator: tractor projectors under the fore hull, for recovering disabled ships and taking prizes.
 if(key==='venator')for(const [x,zf] of [[620,.4],[860,.34]])for(const sg of [-1,1])hull('trc',x,sg*zf,true);
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
const REFERENCE_TONE=Object.freeze({"bridge_pod":[1.064,1.108,1.132],"ven_hull":[0.98,1.009,1.04],"ven_tower_port":[0.965,0.998,1.036],"ven_tower_stbd":[0.965,0.998,1.036],"ven_bridge_port":[0.941,0.973,1.013],"ven_bridge_stbd":[0.941,0.973,1.013],"ven_spine":[0.945,0.978,1.013],"ven_outer_port":[1.131,1.142,1.153],"ven_outer_stbd":[1.131,1.142,1.153],"ven_inner_port":[1.127,1.138,1.148],"ven_inner_stbd":[1.127,1.138,1.148],"ven_upper_port":[1.13,1.141,1.151],"ven_upper_stbd":[1.13,1.141,1.151],"ven_aux_port":[1.098,1.109,1.119],"ven_aux_stbd":[1.098,1.109,1.119],"ven_turret":[1.097,1.173,1.236],"ven_turret_0":[1.097,1.173,1.236],"ven_turret_1":[1.097,1.173,1.236],"ven_turret_2":[1.097,1.173,1.236],"ven_turret_3":[1.097,1.173,1.236],"ven_turret_4":[1.097,1.173,1.236],"ven_turret_5":[1.097,1.173,1.236],"ven_turret_6":[1.097,1.173,1.236],"ven_turret_7":[1.097,1.173,1.236],"ven_side_gun":[0.952,0.961,0.969],"ven_side_port":[0.952,0.961,0.969],"ven_side_stbd":[0.952,0.961,0.969],"isd_hull":[1.037,1.081,1.107],"isd_support":[1.052,1.094,1.12],"isd_citadel":[1.082,1.131,1.161],"isd_bridge":[1.064,1.108,1.132],"isd_engine_0":[1.032,1.087,1.122],"isd_engine_1":[1.042,1.096,1.131],"isd_engine_3":[1.042,1.101,1.136],"isd_engine_4":[1.042,1.101,1.136],"isd_mast":[1.128,1.186,1.224],"isd_sensor_port":[1.017,1.062,1.087],"isd_engine_2":[1.032,1.087,1.122],"isd_engine_5":[1.042,1.101,1.136],"isd_engine_6":[1.042,1.101,1.136],"isd_sensor_stbd":[1.017,1.062,1.087],"isd_turret":[1.118,1.173,1.208],"isd_turret_0":[1.118,1.173,1.208],"isd_turret_1":[1.118,1.173,1.208],"isd_turret_2":[1.118,1.173,1.208],"isd_turret_3":[1.118,1.173,1.208],"isd_turret_4":[1.118,1.173,1.205],"isd_turret_5":[1.118,1.173,1.205],"isd_turret_6":[1.118,1.173,1.205],"isd_turret_7":[1.118,1.173,1.205],"isd2_octuple":[0.877,0.886,0.894],"isd2_casemate":[0.877,0.886,0.894],"isdh_turret":[1.208,1.217,1.196],"isdh_bridge":[1.172,1.172,1.142],"exe_bridge":[1.172,1.172,1.142],"exe_sensor_port":[1.155,1.162,1.141],"exe_sensor_stbd":[1.155,1.162,1.141],"isdh_sensor_port":[1.155,1.162,1.141],"isdh_sensor_stbd":[1.155,1.162,1.141],"isdh_mast":[1.193,1.201,1.182],"isdh_engine_main":[1.048,1.055,1.035],"isdh_engine_aux":[1.102,1.107,1.085]});
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
 if(!ven){ship.parts=ship.parts.filter(p=>!['sensor','scanner'].includes(p.k)&&!['中央通信マスト','通信アレイ横桁'].includes(p.label));for(const id of ['isdh_sensor_port','isdh_sensor_stbd','isdh_mast']){const a=REFERENCE_ASSETS[id],p=placePart(ship,'sensor',a.c,Math.max(...a.size),{label:a.title,skinAsset:id});p.skinSize=a.size.slice();}}
 attachReferenceBridges(ship);
 // One independently selectable skin follows each real nozzle, including its barrel.
 const engines=ship.parts.filter(p=>p.k==='engine');
 for(const e of engines){let asset;if(ven){const sg=e.c[2]<0?'port':'stbd',z=Math.abs(e.c[2]);asset='ven_'+(e.d>40?(z<80?'inner':'outer'):z<55?'upper':'aux')+'_'+sg;}else{const src=LEGACY_ENGINES[e.d>70?'isdhMain':'isdhAux'];asset=src.assets[0];e.skinAsset=asset;e.skinAnchor=src.anchor.slice();e.skinDiameter=src.d;continue;}e.skinAsset=asset;e.skinAnchor=e.c.slice();e.skinDiameter=e.d;if(ven)e.bodyRadius=.36;}
 // Heataker's eight heavy mounts stand in the wells of the battery decks; the
 // forward pair are the ion batteries. They keep the level, bow-facing pose.
 if(!ven)for(let i=0;i<4;i++)for(const sg of [-1,1]){const x=281.76+62.36*i,z=sg*215.58,h=rayEnv(ship,[x,900,z],[0,-1,0],{structOnly:true});if(!h)throw new Error('作例の主砲座がありません');const r=placeFit(ship,i===3?'refIonH':'refISDh',h.p,h.n,0,false);if(!r.fit)throw new Error('作例の主砲座: '+r.err);}
 // Preserve every source turret, including its individual pose and mount height.
 const idsGun=ven?Array.from({length:8},(_,i)=>prefix+'_turret_'+i):[];if(ven)idsGun.push('ven_side_port','ven_side_stbd');
 for(const id of idsGun){const a=REFERENCE_ASSETS[id];if(!a)continue;const type=ven?(id.includes('side')?'refSide':'refVen'):(a.c[0]>450?'refIon':'refISD'),p=[a.c[0],a.c[1]-a.size[1]/2,a.c[2]],mountAxis=id.includes('side')?(a.c[2]<0?5:4):2,up=AXES[mountAxis],h=rayEnv(ship,add(p,mul(up,1200)),mul(up,-1),{structOnly:true});
  ship.fits.push({id:ship.nextId++,k:type,p:p.slice(),a:2,ped:0,base:0,low:0,float:false,skinAsset:id,assetYaw:0,mountAxis,mountOffset:h?dot(sub(p,h.p),up):0});
 }
 if(ven){const top=ship.hatches.find(h=>h.face==='top'),flight=ship.parts.find(p=>p.id===top?.bay);if(top&&flight){const bottom=openBay(ship,flight,'bottom','open');bottom.motion='slide';bottom.open=0;top.motion='slide';top.open=0;}}
 for(const f of ship.fits)if(FITS[f.k].asset)f.chargeDepth=14;

 delete ship._building;remount(ship);
}
for(const [key,base,asset,name] of [['refVen','htl','ven_turret','DBY-827 連装重ターボレーザー'],['refISD','stl','isd_turret','6連装重ターボレーザー'],['refIon','ion','isd_turret','ISD-I 重イオン連装'],['refSide','mtl','ven_side_gun','ヴェネター舷側砲'],['refISDh','stl','isdh_turret','ISD-I 八連装重ターボレーザー砲塔'],['refIonH','ion','isdh_turret','ISD-I 八連装重イオン砲塔']]){const a=REFERENCE_ASSETS[asset];FITS[key]={...FITS[base],key,name,short:name,asset,fm:a.size[0],wm:a.size[2],hm:a.size[1],r:Math.max(a.size[0],a.size[2])/2};}
Object.assign(FITS.refVen,{short:'DBY-827',source:null,evidence:'名称は指定設定・性能は従来設定',desc:'DBY-827 連装重ターボレーザー。2門×70 TT。'});
// Correct the displayed barrel count without tripling existing designs' damage,
// electrical demand or charging rooms. This is a game conversion, not a new
// per-barrel energy claimed by the reference workbook.
Object.assign(FITS.refISD,{short:'6連装重TL',barrels:6,boltTT:FITS.refISD.tt/6,source:null,evidence:'連装数は指定設定・砲身威力はゲーム用換算',desc:'6門で合計350 TT（1門あたり約58.33 TT）。'});
// Heataker's ISD-I mount: two four-barrel housings on one turntable. The total
// stays the 2×175 TT of the reference battery; the barrel split is a conversion.
Object.assign(FITS.refISDh,{short:'8連装重TL',barrels:8,boltTT:FITS.refISDh.tt/8,source:null,evidence:'砲身数はモデル準拠・砲身威力はゲーム用換算',desc:'8門で合計350 TT（1門あたり43.75 TT）。2基の4連装砲室を1つの旋回台に載せたインペリアルI級の重砲塔。'});
Object.assign(FITS.refIonH,{short:'8連装重イオン',barrels:8,boltTT:FITS.refIonH.ion/8,source:null,evidence:'砲身数はモデル準拠・砲身威力はゲーム用換算',desc:'8門で合計350 TT相当のイオン砲。重砲塔と同じ旋回台の前部砲塔。'});

function sensorShape(p){return memoShape(p,'_sensorShape',sensorShapeRaw);}
function sensorShapeRaw(p){const a=p.skinSize||[p.d,p.d,p.d],scale=p.d/Math.max(...a);return {k:'struct',form:'ellipsoid',c:p.c,s:[a[0]*scale,a[2]*scale,a[1]*scale],yaw:p.yaw||0};}

function mountReferenceFit(ship,f){
 // Newly placed model turrets use the same slope-fitting pedestal on all faces.
 // Authored example poses keep their explicit mountAxis and offset.
  if(f.localMount||FITS[f.k].casemate||f.mountAxis==null)return baseMountFit(ship,f);
 const up=AXES[f.mountAxis??f.a],h=rayEnv(ship,add(f.p,mul(up,Math.max(ship.hull.H,ship.hull.W)*2)),mul(up,-1),{structOnly:true});f.float=!h||!!h.part?.plate;if(h?.part?.plate)f._onPlate=true;else delete f._onPlate;f.base=0;f.low=0;f.slope=0;if(h&&!h.part?.plate)f.p=add(h.p,mul(up,f.mountOffset||0));return f;
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
function referenceFitPoint(f,v){const id=f.skinAsset||FITS[f.k].asset,a=REFERENCE_ASSETS[id],r=referenceFitYaw(f)*Math.PI/180,k=f.scale||1,R=!f.skinAsset&&!a.mount&&!FITS[f.k].casemate?levelMatrix(id):null,q=R?(()=>{const p=[v[0]*a.size[0],v[1]*a.size[1],v[2]*a.size[2]],b=REFERENCE_LEVEL[id].base;return [0,1,2].map(i=>(R[i][0]*p[0]+R[i][1]*p[1]+R[i][2]*p[2]-b[i])*k);})():a.mount?v.map((n,i)=>(n*a.size[i]+a.c[i]-a.mount[i])*k):[v[0]*a.size[0]*k,(v[1]+.5)*a.size[1]*k,v[2]*a.size[2]*k],[x,y,z]=q,fr=FITS[f.k].casemate?{fw:AXES[f.a],up:[0,1,0],rt:cross(AXES[f.a],[0,1,0])}:fitFrameOf(f),o=fitOrigin(f);return add(o,add(add(mul(fr.fw,x*Math.cos(r)-z*Math.sin(r)),mul(fr.up,y)),mul(fr.rt,x*Math.sin(r)+z*Math.cos(r))));}
function referenceFitAABB(f){const points=[];for(const x of [-.5,.5])for(const y of [-.5,.5])for(const z of [-.5,.5])points.push(referenceFitPoint(f,[x,y,z]));if(!FITS[f.k].casemate&&!f.localMount&&f.mountAxis==null&&(f.low||0)<0)points.push(add(f.p,mul(fitFrameOf(f).up,f.low)));return [0,1,2].map(i=>Math.min(...points.map(p=>p[i]))).concat([0,1,2].map(i=>Math.max(...points.map(p=>p[i]))));}

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
 for(const p of ship.parts.filter(p=>labels.includes(p.label))){const id=ven?(p.c[2]<0?'ven_bridge_port':'ven_bridge_stbd'):'isdh_bridge',a=REFERENCE_ASSETS[id];p.c=a.c.slice();p.s=[a.size[0],a.size[2],a.size[1]];p.form='reference';p.skinAsset=id;p.label=a.title;delete p.loft;delete p.angles;delete p.paint;
  for(const f of ship.fits.filter(f=>f.host===p.id)){const z=ven?p.c[2]:30,h=rayPart([p.c[0]+p.s[0],ven?234:368,z],[-1,0,0],p);if(h){f.p=h.p;f.n=h.n;delete f.host;delete f.local;delete f.localNormal;mountFit(ship,f);}}
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
 // Heataker ISD-I bells. Their nozzle length and anchor follow the internal
 // engine law (set below), so the source geometry is drawn unscaled.
 isdhMain:{name:'ISD-I 主推進エンジン（ベル型）',k:'engine',group:'power',d:94.8,bodyRadius:.5,assets:['isdh_engine_main'],anchor:[19,109.003,0],mouth:19},
 isdhAux:{name:'ISD-I 補助推進エンジン（ベル型）',k:'engine',group:'power',d:51.66,bodyRadius:.5,assets:['isdh_engine_aux'],anchor:[31.9,76.367,109.639],mouth:31.9},
};
const EQUIPMENT = {
 exposedTurbine:{...LEGACY_ENGINES.venInner,name:'タービン露出型エンジン',engineStyle:'exposed',bodyLength:176,assets:Object.values(LEGACY_ENGINES).filter(d=>d.assets[0].startsWith('ven_')).flatMap(d=>d.assets)},
 internalTurbine:{...LEGACY_ENGINES.isdMain,name:'タービン内蔵型エンジン',engineStyle:'internal',bodyLength:168,assets:Object.values(LEGACY_ENGINES).filter(d=>/^isdh?_/.test(d.assets[0])).flatMap(d=>d.assets)},
 isdBridge:{name:'インペリアル級 艦橋本体',k:'struct',group:'bridge',assets:['isd_bridge']},
 venAirBridge:{name:'ヴェネター 航空指揮艦橋本体',k:'struct',group:'bridge',assets:['ven_bridge_port'],mirror:'venNavBridge'},
 venNavBridge:{name:'ヴェネター 航行艦橋本体',k:'struct',group:'bridge',assets:['ven_bridge_stbd'],mirror:'venAirBridge'},
 isdSensor:{name:'ISD 球形センサー',k:'sensor',group:'support',assets:['isd_sensor_port','isd_sensor_stbd']},
 isdMast:{name:'ISD 通信マスト',k:'sensor',group:'support',assets:['isd_mast']},
 isdhBridge:{name:'インペリアルI級 艦橋本体（ハンマーヘッド）',k:'struct',group:'bridge',assets:['isdh_bridge']},
 isdhSensor:{name:'インペリアルI級 標的追跡ドーム',k:'sensor',group:'support',assets:['isdh_sensor_port','isdh_sensor_stbd']},
 isdhMast:{name:'インペリアルI級 通信アンテナ',k:'sensor',group:'support',assets:['isdh_mast']},
 exeBridge:{name:'エグゼクター級 艦橋本体',k:'struct',group:'bridge',assets:['exe_bridge']},
 exeSensor:{name:'エグゼクター級 標的追跡ドーム',k:'sensor',group:'support',assets:['exe_sensor_port','exe_sensor_stbd']}
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
for(const id of ['isdhMain','isdhAux']){const e=LEGACY_ENGINES[id];e.nozzleLength=engineBaseline('internal',e.d,'nozzleLength');e.anchor[0]=e.mouth+e.nozzleLength/2;e.thrust=engineBaseline('internal',e.d,'thrust');e.power=engineBaseline('internal',e.d,'power');}

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
 const key=JSON.stringify(ship.fits.map(f=>[f.id,f.k,f.p,f.a,f.tilt,f.mountAxis,f.mountOffset,f.float,f.scale,f.chargeDepth,f.chargeScale,f.chargeSalvos]));
 if(ship._capacitors?.key===key)return ship._capacitors.parts;
 const parts=ship.fits.filter(f=>needsCapacitor(f)&&!f.float).map(f=>{
  const q=weaponChargeSpec(f),scale=f.scale||1,V=q.targetVolume*(f.chargeScale??1),depth=12*scale,side=Math.sqrt(V/depth),up=fitUp(f),fr=frameAxis(up),offset=(f.chargeDepth??(depth/2+4))+(f.mountOffset||0);
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
  // The ISD-I's forward hull narrows quickly: hangar decks flank the ventral
  // bay inboard of the side trench, with the corps quartered above the bay.
  room('hangar','中央航空機移送路',[742.9,97,0],[89.8,112,32],{airRole:'flight'});
  for(const sg of [-1,1]){
   room('hangar',(sg<0?'左舷':'右舷')+'航空機格納庫',[850,113,sg*124],[180,54,26],{airRole:'storage'});
   room('hangar','主ベイ・格納庫連絡甲板',[850,100,sg*92.3],[180,8.6,16],{airRole:'flight'});
   room('service','航空機整備・補給区画',[985,112,sg*110],[80,40,22]);
   room('crew','城郭下層の居住甲板',[430,205,sg*70],[140,56,20],{foreWidth:.8});
   part('inertial','城郭内の分散慣性制御器',[330,185,sg*150],34,{length:160});
   room('integrity','上段構造維持フィールド幹線',[850,112,sg*162],[170,16,16]);
  }
  for(const p of ship.parts)if(p.k==='shield')p.d=54;
  // One embarked corps of four regiments (9,216 troops) and one prefabricated
  // garrison base with its 484 support staff: 9,700 embarked in all.
  for(const [x,sg,n] of [[880,-1,1],[880,1,2],[1000,-1,3],[1000,1,4]])room('troops',`軍団兵員区画・第${n}連隊（2,304名）`,[x,128,sg*40],[97,20,14.2518]);
  room('troops','プレハブ駐屯基地の支援要員区画（484名）',[700,125,-110],[44,12,11.0003]);
  room('cargo','プレハブ駐屯基地（分解収納）',[700,125,110],[97,20,15]);
  const bridge=ship.parts.find(p=>p.skinAsset==='isdh_bridge');
  if(bridge){const hit=rayPart([bridge.c[0]+bridge.s[0],366,80],[-1,0,0],bridge);if(hit){const r=placeFit(ship,'podAir',hit.p,hit.n,0,false);if(r.fit){r.fit.width=12;r.fit.height=4.8;}}}
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
 else if(SHIP_EXAMPLES[key]?.airWings?.length)ship.airWings=SHIP_EXAMPLES[key].airWings.map(w=>({...w}));
 else ship.airWings=smallAircraftWings(key==='venator'?420:capacity);
 for(const p of ship.parts){delete p.aircraftType;delete p.berths;}
 ship.groundForces=normalizeGroundForces(SHIP_EXAMPLES[key]?.groundForces||{
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
  const h=ven?{L:1137,W:548,H:110,chineHeight:.60,belt:.28,bowFree:true,stations:[[0,0.071,0.015,0.01,0.5],[0.035,0.076,0.74,0.02,0.65],[0.181,0.106,0.96,0.018,0.6],[0.206,1,0.9745,0.00091,0,0.18,0.249,0.5098],[0.251,1,0.9845,0.0059,0,0.18,0.251,0.5115],[0.378,0.857836,0.814545,-0.012727,0.3],[0.44,0.788433,0.774545,-0.012727,0.32],[0.519,0.7,0.774545,0.007273,0.24],[0.5277,0.69261,0.95075,0.05354,0.0,0.0,0.25566,0.52196],[0.54793,0.66895,0.925,0.06023,0.0,0.0,0.26162,0.51987],[0.55145,0.63513,0.95606,0.0619,0.0,0.0,0.24567,0.51555],[0.56376,0.62263,0.90711,0.06642,0.0,0.0,0.29614,0.51677],[0.56728,0.64632,0.89452,0.07099,0.0,0.0,0.27208,0.51288],[0.58223,0.62883,0.88185,0.07638,0.0,0.0,0.27441,0.51037],[0.58399,0.59774,0.91887,0.07942,0.0,0.0,0.25623,0.50446],[0.60246,0.58214,0.84758,0.08148,0.0,0.0,0.31291,0.50974],[0.60598,0.60239,0.83489,0.08533,0.0,0.0,0.30171,0.50585],[0.635,0.56293,0.79707,0.09509,0.0,0.0,0.30993,0.49856],[0.6394,0.53143,0.82338,0.09085,0.0,0.0,0.293,0.50907],[0.71064,0.45005,0.70866,0.09822,0.0,0.0,0.33809,0.52071],[0.71856,0.46247,0.65647,0.09556,0.0,0.0,0.37165,0.52763],[0.7423,0.43842,0.62945,0.10438,0.0,0.0,0.39466,0.5234],[0.81003,0.36444,0.57773,0.12886,0.0,0.0,0.42308,0.50893],[0.87335,0.28734,0.51039,0.14223,0.0,0.0,0.47782,0.50653],[0.99472,0.14377,0.38028,0.17666,0.0,0.0,0.65777,0.48409],[0.99824,0.12029,0.37209,0.17968,0.0,0.0,0.72458,0.47761],[1.0,0.10855,0.36799,0.18119,0.0,0.0,0.75799,0.47436]]}:acc?{L:752,W:460,H:116,stations:[[0,.15,.45],[.07,.60,.64],[.19,1,1],[.30,.87,.94],[.62,.48,.63],[.92,.12,.24],[1,.018,.14]]}:{L:1600,W:868.4,H:213.4,start:10.6/1600,chineHeight:.493,keelWidth:0,bowFree:true,stations:[[0.0,0.005,0.95178,0.01145,0,0,0.9824],[0.00675,0.005,0.95178,0.01145,0,0,0.9824],[0.01981,0.19198,0.9628,0.01312,0,0,0.8047],[0.02981,0.33754,0.95384,0.01328,0,0,0.6835],[0.04419,0.54678,0.94098,0.0135,0,0,0.5054],[0.07531,1.0,0.91312,0.01399,0,0,0.1052],[0.42681,0.61492,0.59856,0.01943,0,0,0.1565],[0.42981,0.57255,0.59603,0.0194,0,0,0.2034],[0.43569,0.5661,0.59109,0.01933,0,0,0.2039],[0.445,0.59489,0.58326,0.01922,0,0,0.1573],[0.58869,0.43759,0.46407,0.01675,0,0,0.1994],[0.59381,0.39291,0.45984,0.01665,0,0,0.2652],[0.71262,0.26278,0.36186,0.01432,0,0,0.3346],[0.71756,0.29664,0.35779,0.01422,0,0,0.2573],[0.87169,0.1285,0.22816,0.01253,0,0,0.4022],[0.95419,0.03851,0.15871,0.01167,0,0,0.5787],[0.9843,0.0051,0.13277,0.01167,0,0,0.6929],[0.98531,0.005,0.13216,0.01167,0,0,0.8345],[1.0,0.005,0.1282,0.01167,0,0,0.8595]]};
  // Venator: aft stations keep the earlier fit; the forward hull from x≈600 m
  // is measured from A308 Digital's model (taller bow, own side-band height).
  const s=newShip({...h,plan:'wedge',sec:'warship',bowW:.02,bowH:.2,stern:1,deckWidth:ven?.26:acc?.48:.12,belt:ven?.28:.15},ven?'ヴェネター級｜双塔航空母艦':acc?'アクラメイター級｜強襲揚陸艦':'インペリアルI級｜重砲戦艦');
  if(!ven&&!acc){s.hull.deckWidth=0;for(const row of s.hull.stations)row[4]=0;}
  s.paint=ven?'republic':'neutral';s.detail=1;s.reference=key;s.armor=ven?{hull:.45,cit:.45}:acc?{hull:.3,cit:.35}:{hull:.6,cit:.45};s.keel='light';s.shieldTarget=1;s._building=true;
  const part=(k,label,c,d,opt={})=>placePart(s,k,c,d,{label,...opt});
  const structure=(label,c,size,opt={})=>part('struct',label,c,size,{form:'chamfer',corner:.12,taper:.14,...opt});
  const room=(k,label,c,size,opt={})=>part(k,label,c,40,{room:size,...opt});
  const pod=(cap,k,width=16)=>{const hit=rayPart([cap.c[0]+cap.s[0],cap.c[1],cap.c[2]],[-1,0,0],cap);if(hit){const r=placeFit(s,k,hit.p,hit.n,0,false);if(r.fit){r.fit.width=width;r.fit.height=Math.round(width*4)/10;}}};
  const engine=(r,label,x,y,z,d,bl)=>part('engine',label,[x,y,z],d,{reactor:r.id,dir:[-1,0,0],bodyLength:bl,bodyRadius:.5});
  if(ven){
    s.cuts.push({id:s.nextId++,type:'planTrapezoid',side:'both',from:.251,to:.519,innerFrom:.378,innerTo:.440,remainingWidth:.493});
    const loft=(name,c,sz,rows,opt={})=>structure(name,c,sz,{form:'loft',loft:rows,corner:.07,...opt});
    // Command tower measured from A308 Digital's model: a raised base with the
    // turret sponsons, a raked central spine, the main block and its wide foot,
    // and two thin stalks that carry the bridges.
    const flat=(label,pts,top,bottom,cz=0,opt={})=>{const xs=pts.map(p=>p[0]),x0=Math.min(...xs),x1=Math.max(...xs),L=x1-x0,cx=(x0+x1)/2,w=2*Math.max(...pts.map(p=>Math.abs(p[1]-cz)));return structure(label,[cx,(top+bottom)/2,cz],[L,w,top-bottom],{form:'outline',outline:pts.map(([x,z])=>[(x-cx)/L,(z-cz)/w]),corner:0,taper:0,...opt});};
    flat('指揮塔基部の上部甲板',[[262.4,-45.5],[470.6,-45.7],[470.5,-42],[590.9,-42],[590.9,42],[470.5,42],[470.6,45.7],[262.4,45.5]],120.9,92);
    flat('指揮塔基部の舷側段',[[256,-53.3],[470.6,-53.4],[470.6,53.4],[256,53.3]],115.3,92);
    flat('前部砲座の基部甲板',[[470.6,-53.3],[584.5,-53.3],[584.5,53.3],[470.6,53.3]],110.8,92);
    for(const sg of [-1,1])for(const [a0,a1,b0,b1] of [[283.9,324.1,292.3,315.9],[347,387.2,355.3,379],[414,456.5,422.4,447.4],[482.1,523.4,490.8,514.9]])flat('重砲塔間の防護壁',[[a0,sg*53.3],[a1,sg*53.3],[b1,sg*71.3],[b0,sg*71.3]],107,92,sg*62.3);
    const spineX=[222,234,246,258,270,282,294,390,414,438,462,486,510,523],spineY=[113.7,124.4,138.5,162.8,192.2,198.8,205.1,189.3,181.1,167.2,153.4,139.7,127.6,121];
    loft('指揮塔の中央稜線',[372.5,154.5,0],[301,22.8,101],spineX.map((x,i)=>[(x-222)/301,1,(spineY[i]-104)/101,0]));
    loft('指揮塔の主塔体',[372,145.7,0],[180,58.6,83.4],[[0,1,1,0],[.6,1,1,0],[.6667,1,.905,0],[.7333,1,.78,0],[.8,1,.683,0],[.8667,1,.532,0],[.9333,1,.41,0],[1,1,.285,0]]);
    loft('指揮塔の下部張出し',[362,139.5,0],[136,83.8,71],[[0,1,.72,0],[.09,1,1,0],[.71,1,.98,0],[.79,1,.7,0],[.88,1,.48,0],[1,1,.26,0]],{wallInset:.17});
    for(const z of [-24.9,24.9]){
      loft(z<0?'航空指揮塔':'航行指揮塔',[348,204.75,z],[108,8.8,49.5],[[0,1,.93,0],[.11,1,.98,0],[.778,1,1,0],[.889,1,.7,0],[1,1,.05,0]],{corner:.1});
      loft(z<0?'航空指揮所の長形外殻':'航行艦橋の長形外殻',[355,238,z*1.075],[148,28,28],[[0,1,1,0],[1,1,1,0]],{corner:.1});
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
    // Measured from Heataker's ISD-I. Every terrace roof lies in the hull's
    // own plane family y = A − 0.0578·x − 0.191·|z|: the decks step down toward
    // the bow and the sides with the plating, and each wall drops into the hull.
    const hullTop=(x,z)=>{const b=sectionBase(s.hull,clamp(x,0,s.hull.L)),hw=Math.max(1e-6,b.hw);return b.ytop-(b.ytop-b.poly[3][1])*Math.min(1,Math.abs(z)/hw);};
    const hullBottom=(x,z)=>{const b=sectionBase(s.hull,clamp(x,0,s.hull.L)),hw=Math.max(1e-6,b.hw);return b.ybot+(b.poly[2][1]-b.ybot)*Math.min(1,Math.abs(z)/hw);};
    const probe=(pts,f)=>{let m=-Infinity;for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];for(const u of [0,.25,.5,.75])m=Math.max(m,f(lerp(a[0],b[0],u),lerp(a[1],b[1],u)));}return m;};
    // An outline slab whose top (or, below the hull, bottom) face is the plane
    // A ∓ sx·x ∓ sz·|z|. Its depth reaches `sink` metres past the plating.
    const slab=(label,pts,{A,sx=.0578,sz=.191,below=false,sink=8,skin='service',cz=0}={})=>{
      const xs=pts.map(p=>p[0]),x0=Math.min(...xs),x1=Math.max(...xs),L=x1-x0,cx=(x0+x1)/2,w=2*Math.max(...pts.map(p=>Math.abs(p[1]-cz)));
      const face=(x,z)=>below?A+sx*x+sz*Math.abs(z):A-sx*x-sz*Math.abs(z),gap=probe(pts,(x,z)=>below?hullBottom(x,z)-face(x,z):face(x,z)-hullTop(x,z)),H=Math.max(4,gap)+sink;
      return structure(label,[cx,below?A+sx*cx+H/2:A-sx*cx-H/2,cz],[L,w,H],{form:'outline',outline:pts.map(([x,z])=>[(x-cx)/L,(z-cz)/w]),deckSlope:(below?1:-1)*Math.atan(sx)*180/Math.PI,ridge:(below?-1:1)*sz*w/2,skin,corner:0,taper:0});};
    const roof=(label,A,pts,opt={})=>slab(label,pts,{A,...opt});
    roof('上部城郭 第2甲板群',262.39,[[42.9,-25.8],[79.5,-174],[479.7,-174],[492.2,-153.7],[617.7,-153.7],[619.4,0],[617.7,153.7],[492.2,153.7],[479.7,174],[79.5,174],[42.9,25.8]]);
    roof('上部城郭 第1甲板群',296.31,[[66.6,0],[93.6,-109],[503.5,-109],[504.7,0],[503.5,109],[93.6,109]]);
    roof('上部城郭 第1甲板の前端区画',281.64,[[501.7,-94.9],[591.6,-94.9],[592.6,0],[591.6,94.9],[501.7,94.9],[502.8,0]]);
    roof('上部城郭の舷側段',251,[[109.5,-187],[497.9,-187],[497.9,187],[109.5,187]]);
    roof('艦尾舷側の台座甲板',244.27,[[97,-166.1],[113.9,-234.7],[243.9,-234.7],[244.7,-166.1],[244.7,166.1],[243.9,234.7],[113.9,234.7],[97,166.1]]);
    roof('前部城郭',240.52,[[613.2,-141.5],[751.4,-106.1],[780.6,0],[751.4,106.1],[613.2,141.5]]);
    // The raised battery decks carry the eight heavy mounts in their wells.
    roof('重砲塔甲板',222.16,[[191.5,-164.4],[235.8,-356.3],[518.6,-277.7],[535.5,-164.4],[535.5,164.4],[518.6,277.7],[235.8,356.3],[191.5,164.4]],{sx:.0581,sz:.1994,skin:'armor',sink:6});
    roof('前部甲板の装甲板',217.33,[[931.4,0],[938.3,-92],[973,-85.4],[978,-78.5],[989.3,-76.3],[994.3,-81.4],[1054.6,-69.9],[1059.6,-62.9],[1092.6,-56.6],[1097.6,-61.7],[1137.3,-54.1],[1144.5,0],[1137.3,54.1],[1097.6,61.7],[1092.6,56.6],[1059.6,62.9],[1054.6,69.9],[994.3,81.4],[989.3,76.3],[978,78.5],[973,85.4],[938.3,92]],{sink:5,skin:'armor'});
    const ridgeBlock=structure('前部甲板の中央稜線区画',[811,167.4,0],[122.2,19.2,25.2],{form:'loft',loft:[[0,1,1,0],[.83,1,1,0],[1,1,.06,0]],corner:.08,skin:'armor'});pod(ridgeBlock,'podHangar',10);
    // Ventral keel armour, side blisters and the reactor bulb.
    slab('腹部竜骨装甲板',[[434.8,-43.3],[469.8,-87.7],[564.6,-87.6],[596.7,-43.2],[596.8,-48.1],[625.6,-48.1],[696,-67.3],[695.9,-62.4],[703.4,-54.6],[730.6,-60.8],[738.2,-74],[776.2,-84.4],[780.1,-89.2],[780.1,89.2],[776.2,84.4],[738.2,74],[730.6,60.8],[703.4,54.6],[695.9,62.4],[696,67.3],[625.6,48.1],[596.8,48.1],[596.7,43.2],[564.6,87.6],[469.8,87.7],[434.8,43.3],[326.3,43.5],[80.1,139],[72.3,143.7],[60,93.9],[99.3,78.6],[99.3,-78.6],[60,-93.9],[72.3,-143.7],[80.1,-139],[326.3,-43.5]],{A:-2.87,sx:.0615,sz:.2245,below:true,sink:7,skin:'armor'});
    for(const sg of [-1,1])slab('舷側下面の張出し',[[242.4,sg*314],[337.5,sg*287.6],[337.5,sg*321.1],[242.4,sg*347.5]],{A:77.86,sx:0,sz:0,below:true,skin:'armor',cz:sg*317.55});
    // The visible ventral bulb is the armored envelope of this actual power plant.
    structure('腹部主炉の球状装甲殻',[515.6,92.3,0],[184.7,184.6,184.6],{form:'ellipsoid',skin:'armor'});
    const r=part('gen','主動力発生炉（腹部球状装甲内）',[515.6,85,0],ISD_PLANT.main);
    // Command tower: a raked neck carrying the hammerhead bridge.
    structure('艦橋支持塔',[123.4,293.85,0],[219.6,64.2,181.5],{form:'loft',loft:[[0,1,.1427,0],[.1835,.9,1,0],[.7391,.9,1,0],[1,1,.1427,0]],wallInset:.2,corner:.05,skin:'armor'});
    structure('横長指揮艦橋の装甲外殻',[151.6,363.6,0],[144.3,288.3,62.2],{corner:.09,skin:'service'});
    // The stern is a V-groove under the plating overhangs: its walls lean back
    // from the engine line (x≈130, y≈110) to the chevron edge, so the bells
    // stand clear of the hull as on the model.
    for(const [y,rot] of [[177.5,0],[42.5,180]])s.solidCuts.push({id:s.nextId++,shape:'wedge',c:[60,y,0],s:[140,760,135],rotation:[rot,0,0],mirror:false,structures:false});
    // Bells sit in the chevron stern; the internal engine law sets nozzle and body.
    const em=LEGACY_ENGINES.isdhMain,ea=LEGACY_ENGINES.isdhAux;
    for(const z of [-213.65,0,213.65]){const e=engine(r,'主イオン機関・ベル型ノズル',em.anchor[0],em.anchor[1],z,em.d,engineBaseline('internal',em.d,'body'));e.nozzleLength=em.nozzleLength;}
    for(const z of [-109.639,109.639])for(const y of [76.367,141.633]){const e=engine(r,'上下二段の補助イオン機関',ea.anchor[0],y,z,ea.d,engineBaseline('internal',ea.d,'body'));e.nozzleLength=ea.nozzleLength;}
    part('hyper','主ハイパードライブ',[150,250,0],42,{length:110});
    part('aux','予備機関反応炉',[290,245,0],ISD_PLANT.backup);
    part('inertial','主慣性制御設備',[240,200,0],30,{length:65});
    for(const z of [-1,1]){
      part('fuel','反応物サイロ群',[640,110,z*46],46,{dir:[0,1,0],length:82});
      room('pump','炉用供給・冷却ポンプ室',[620,112,z*100],[30,24,40]);
      part('shield','舷側シールド発生器',[411,110,z*235],42);
      part('aux','副動力炉',[253,118,z*290],ISD_PLANT.auxiliary);
      room('battery','砲塔パワーセル・弾庫',[375,133,z*205],[170,26,26]);
      room('firecontrol','重砲旋回・射撃管制機構',[360,130,z*245],[60,20,22]);
      room('crew','城郭内の居住甲板',[300,235,z*70],[200,60,23],{foreWidth:.8});
      room('cargo','液体・原材料貯蔵庫',[1230,108,z*45],[130,24,18],{foreWidth:.5});
      room('integrity','舷側構造・動力幹線',[650,118,z*200],[200,18,20],{foreWidth:.85});
      part('localShield','前部補助防御発生器',[1320,110,z*28],16);
    }
    const bay=room('hangar','主腹部ドッキング・航空機発着ベイ',[882.7,82,0],[188.8,175,60]);openBay(s,bay,'bottom');
    const small=room('hangar','前方シャトル格納庫',[1073.5,82,0],[53.2,70,40]);openBay(s,small,'bottom','ray');
    gunsDeck(s,'pd',[.14,.24,.36,.47,.58,.69,.81],[.84],null,false,0);
  }
  s.trenches.push(ven||acc?{id:s.nextId++,side:'both',from:ven?.207:.15,to:.94,level:ven?.60:.51,height:ven?18:10,depth:ven?8:11,taper:true,...(ven?{chine:true}:{})}:{id:s.nextId++,side:'both',from:.0669,to:.985,level:.493,height:19.6,depth:16,taper:false});
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
const EXECUTOR_BLUEPRINT={"exactCredit":"This work is based on \"Star Wars - Executor Super Star Destroyer\" (https://sketchfab.com/3d-models/star-wars-executor-super-star-destroyer-df018bc2cecc4a5182fde06ddc9b1496) by Admiral_Forever (https://sketchfab.com/Admiral_Forever) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)","dimensions":{"length":19000,"width":5603.25844,"heightIncludingSourceBridge":1413.82448,"coordinate":"X=0 aft, X=19000 bow, Y=0 model bottom, Z=0 centerplane"},"cityTerraces":[{"y":[838.7,902.6],"m":1,"k":0,"o":[1080.0,210.0,1080.0,430.0,1400.0,430.0,1400.0,190.0,1300.0,190.0,1300.0,210.0]},{"y":[537.8,648.8],"m":0,"k":0,"o":[1760.0,-430.0,1760.0,-350.0,2380.0,-350.0,2380.0,-210.0,2160.0,-170.0,2160.0,170.0,2380.0,210.0,2380.0,350.0,1760.0,350.0,1760.0,430.0,3400.0,430.0,3400.0,590.0,4240.0,590.0,4480.0,650.0,4480.0,790.0,5160.0,790.0,5160.0,930.0,5020.0,990.0,5160.0,1010.0,5160.0,1270.0,5340.0,1270.0,5340.0,1570.0,5420.0,1650.0,6620.0,1510.0,6620.0,1130.0,6240.0,1130.0,6240.0,1030.0,6760.0,1030.0,6720.0,1450.0,7360.0,1450.0,7360.0,1210.0,7780.0,1210.0,7780.0,1110.0,8040.0,1190.0,9120.0,1110.0,9180.0,1030.0,10800.0,810.0,10780.0,690.0,11340.0,710.0,11340.0,630.0,11660.0,670.0,12360.0,510.0,12360.0,730.0,12620.0,730.0,12640.0,510.0,12540.0,450.0,13860.0,250.0,13940.0,110.0,14360.0,90.0,14360.0,-90.0,13940.0,-110.0,13860.0,-250.0,12540.0,-450.0,12640.0,-510.0,12620.0,-730.0,12360.0,-730.0,12360.0,-510.0,11660.0,-670.0,11340.0,-630.0,11340.0,-710.0,10780.0,-690.0,10800.0,-810.0,9180.0,-1030.0,9120.0,-1110.0,8260.0,-1190.0,7780.0,-1110.0,7780.0,-1210.0,7360.0,-1210.0,7360.0,-1450.0,6720.0,-1450.0,6760.0,-1030.0,6240.0,-1030.0,6240.0,-1130.0,6620.0,-1130.0,6620.0,-1510.0,5640.0,-1570.0,5560.0,-1650.0,5340.0,-1570.0,5340.0,-1270.0,5160.0,-1270.0,5160.0,-1010.0,5020.0,-990.0,5160.0,-930.0,5160.0,-790.0,4480.0,-790.0,4480.0,-650.0,4240.0,-590.0,3400.0,-590.0,3400.0,-430.0]},{"y":[726.0,789.9],"m":1,"k":0,"o":[2620.0,770.0,2620.0,950.0,2660.0,950.0,2660.0,970.0,2960.0,970.0,2960.0,750.0,2700.0,750.0,2700.0,770.0]},{"y":[695.3,735.3],"m":1,"k":0,"o":[3780.0,730.0,3780.0,990.0,3820.0,990.0,3820.0,1010.0,4700.0,1010.0,4700.0,990.0,4840.0,990.0,4840.0,930.0,4120.0,930.0,4120.0,730.0]},{"y":[524.8,561.3],"m":1,"k":0,"o":[5060.0,1570.0,5060.0,1630.0,5080.0,1630.0,5080.0,1730.0,5100.0,1730.0,5100.0,1790.0,5120.0,1790.0,5120.0,1850.0,5140.0,1850.0,5160.0,1970.0,5200.0,1990.0,5220.0,2090.0,5240.0,2090.0,5240.0,2130.0,5260.0,2130.0,5280.0,2210.0,5340.0,2210.0,5340.0,2110.0,5320.0,2110.0,5300.0,1970.0,5280.0,1970.0,5280.0,1890.0,5240.0,1870.0,5220.0,1770.0,5200.0,1770.0,5200.0,1710.0,5140.0,1670.0,5120.0,1570.0]},{"y":[517.0,575.0],"m":1,"k":0,"o":[5800.0,1730.0,5800.0,1990.0,5960.0,1990.0,5960.0,1730.0]},{"y":[467.9,505.4],"m":1,"k":0,"o":[6560.0,2290.0,6560.0,2390.0,6740.0,2390.0,6740.0,2270.0]},{"y":[487.5,590.8],"m":1,"k":0,"o":[7460.0,1810.0,7460.0,1970.0,7720.0,1970.0,7720.0,1810.0]},{"y":[498.1,591.0],"m":1,"k":0,"o":[8480.0,1410.0,8480.0,1610.0,8860.0,1610.0,8860.0,1410.0]},{"y":[511.3,583.6],"m":1,"k":0,"o":[10800.0,1030.0,10800.0,1210.0,11180.0,1210.0,11180.0,1030.0]},{"y":[549.1,588.5],"m":1,"k":0,"o":[11820.0,710.0,11820.0,770.0,12060.0,770.0,12060.0,610.0,11980.0,610.0,11980.0,630.0,11940.0,630.0,11900.0,690.0]},{"y":[527.8,565.3],"m":1,"k":0,"o":[13220.0,430.0,13220.0,490.0,13260.0,490.0,13260.0,510.0,13280.0,510.0,13280.0,530.0,13300.0,530.0,13340.0,590.0,13380.0,590.0,13380.0,610.0,13500.0,610.0,13500.0,430.0]},{"y":[515.8,564.1],"m":1,"k":0,"o":[14680.0,190.0,14680.0,350.0,15040.0,350.0,15040.0,190.0]},{"y":[461.4,518.1],"m":1,"k":0,"o":[15880.0,510.0,15880.0,570.0,15920.0,570.0,15920.0,590.0,16020.0,590.0,16020.0,510.0,15980.0,510.0,15980.0,490.0,15900.0,490.0,15900.0,510.0]},{"y":[460.7,518.0],"m":1,"k":0,"o":[16280.0,430.0,16280.0,510.0,16400.0,510.0,16400.0,490.0,16420.0,490.0,16420.0,430.0]},{"y":[463.5,508.2],"m":1,"k":0,"o":[17200.0,110.0,17200.0,230.0,17220.0,230.0,17240.0,270.0,17460.0,270.0,17460.0,110.0]},{"y":[515.1,526.3],"m":1,"k":1,"o":[15880.0,510.0,15880.0,570.0,15980.0,590.0,15980.0,530.0,16000.0,530.0,15980.0,490.0,15900.0,490.0,15900.0,510.0]},{"y":[515.0,526.1],"m":1,"k":1,"o":[16280.0,430.0,16280.0,510.0,16360.0,510.0,16360.0,490.0,16380.0,490.0,16380.0,430.0]},{"y":[558.3,583.5],"m":1,"k":1,"o":[5060.0,1570.0,5060.0,1630.0,5080.0,1630.0,5080.0,1730.0,5100.0,1730.0,5100.0,1790.0,5120.0,1790.0,5120.0,1850.0,5140.0,1850.0,5160.0,1970.0,5200.0,1990.0,5220.0,2090.0,5300.0,2110.0,5300.0,2050.0,5320.0,2050.0,5320.0,2030.0,5300.0,2030.0,5300.0,1970.0,5280.0,1970.0,5280.0,1890.0,5240.0,1870.0,5220.0,1770.0,5200.0,1770.0,5200.0,1710.0,5140.0,1670.0,5120.0,1570.0]},{"y":[562.3,579.4],"m":1,"k":1,"o":[13220.0,430.0,13220.0,490.0,13260.0,490.0,13280.0,530.0,13480.0,530.0,13480.0,510.0,13500.0,510.0,13500.0,430.0]},{"y":[561.1,578.1],"m":1,"k":1,"o":[14680.0,190.0,14680.0,290.0,15020.0,290.0,15020.0,270.0,15040.0,270.0,15040.0,190.0]},{"y":[580.5,607.3],"m":1,"k":2,"o":[5060.0,1570.0,5060.0,1630.0,5080.0,1630.0,5080.0,1730.0,5100.0,1730.0,5100.0,1790.0,5120.0,1790.0,5140.0,1910.0,5240.0,1930.0,5240.0,1910.0,5260.0,1910.0,5260.0,1870.0,5240.0,1870.0,5240.0,1830.0,5220.0,1830.0,5200.0,1710.0,5140.0,1670.0,5120.0,1570.0]},{"y":[587.8,606.0],"m":1,"k":1,"o":[7460.0,1810.0,7460.0,1930.0,7720.0,1930.0,7720.0,1810.0]},{"y":[588.0,606.3],"m":1,"k":1,"o":[8480.0,1410.0,8480.0,1550.0,8500.0,1550.0,8500.0,1570.0,8820.0,1570.0,8820.0,1550.0,8860.0,1550.0,8860.0,1410.0]},{"y":[580.6,599.0],"m":1,"k":1,"o":[10800.0,1030.0,10800.0,1070.0,10860.0,1070.0,10860.0,1090.0,11140.0,1090.0,11140.0,1070.0,11180.0,1070.0,11180.0,1030.0]},{"y":[604.3,630.2],"m":1,"k":3,"o":[5060.0,1570.0,5060.0,1630.0,5080.0,1630.0,5080.0,1730.0,5100.0,1730.0,5120.0,1770.0,5180.0,1770.0,5180.0,1730.0,5200.0,1730.0,5200.0,1710.0,5140.0,1670.0,5120.0,1570.0]},{"y":[645.8,688.8],"m":0,"k":1,"o":[1760.0,-430.0,1760.0,-350.0,2380.0,-350.0,2380.0,-210.0,2160.0,-170.0,2160.0,170.0,2380.0,210.0,2380.0,350.0,1760.0,350.0,1760.0,430.0,3400.0,430.0,3400.0,590.0,4240.0,590.0,4480.0,650.0,4480.0,790.0,5160.0,790.0,5160.0,930.0,5020.0,990.0,5160.0,1010.0,5160.0,1270.0,5380.0,1270.0,5380.0,1530.0,6620.0,1510.0,6620.0,1130.0,6240.0,1130.0,6240.0,1030.0,6760.0,1030.0,6720.0,1410.0,7360.0,1410.0,7360.0,1210.0,7780.0,1210.0,7780.0,1110.0,9120.0,1110.0,9120.0,1010.0,9420.0,1010.0,9420.0,830.0,10360.0,710.0,10420.0,510.0,11280.0,530.0,11360.0,370.0,11440.0,530.0,11520.0,450.0,11840.0,530.0,11840.0,450.0,12740.0,330.0,13460.0,330.0,13600.0,50.0,13820.0,50.0,13820.0,-50.0,13560.0,-90.0,13460.0,-330.0,12740.0,-330.0,11840.0,-450.0,11840.0,-530.0,11780.0,-450.0,11440.0,-530.0,11360.0,-370.0,11280.0,-530.0,10420.0,-510.0,10360.0,-710.0,9420.0,-830.0,9420.0,-1010.0,9120.0,-1010.0,9120.0,-1110.0,7780.0,-1110.0,7780.0,-1210.0,7360.0,-1210.0,7360.0,-1410.0,6720.0,-1410.0,6760.0,-1030.0,6240.0,-1030.0,6240.0,-1130.0,6620.0,-1130.0,6620.0,-1510.0,6500.0,-1530.0,5380.0,-1530.0,5380.0,-1270.0,5160.0,-1270.0,5160.0,-1010.0,5020.0,-990.0,5160.0,-930.0,5160.0,-790.0,4480.0,-790.0,4480.0,-650.0,4240.0,-590.0,3400.0,-590.0,3400.0,-430.0]},{"y":[685.8,705.3],"m":0,"k":2,"o":[1760.0,-430.0,1760.0,-350.0,2380.0,-350.0,2380.0,-210.0,2160.0,-170.0,2160.0,170.0,2380.0,210.0,2380.0,350.0,1760.0,350.0,1760.0,430.0,3400.0,430.0,3400.0,590.0,4240.0,590.0,4480.0,650.0,4480.0,790.0,5160.0,790.0,5160.0,930.0,5020.0,990.0,5160.0,1010.0,5160.0,1270.0,5380.0,1270.0,5380.0,1530.0,6620.0,1490.0,6620.0,1150.0,6240.0,1150.0,6240.0,1030.0,6880.0,1030.0,6880.0,1170.0,6720.0,1170.0,6720.0,1390.0,7360.0,1390.0,7360.0,1190.0,7680.0,1070.0,9080.0,1070.0,9080.0,830.0,9960.0,830.0,9960.0,690.0,10360.0,690.0,10420.0,510.0,10940.0,510.0,11360.0,370.0,11440.0,530.0,11520.0,450.0,11840.0,530.0,11840.0,450.0,12520.0,430.0,12760.0,290.0,13480.0,290.0,13600.0,70.0,13480.0,-290.0,12760.0,-290.0,12520.0,-430.0,11840.0,-450.0,11840.0,-530.0,11780.0,-450.0,11440.0,-530.0,11360.0,-370.0,10940.0,-510.0,10420.0,-510.0,10360.0,-690.0,9960.0,-690.0,9960.0,-830.0,9080.0,-830.0,9080.0,-1070.0,7680.0,-1070.0,7360.0,-1190.0,7360.0,-1390.0,6720.0,-1390.0,6720.0,-1170.0,6880.0,-1170.0,6880.0,-1030.0,6240.0,-1030.0,6240.0,-1150.0,6620.0,-1150.0,6620.0,-1490.0,6500.0,-1530.0,5380.0,-1530.0,5380.0,-1270.0,5160.0,-1270.0,5160.0,-1010.0,5020.0,-990.0,5160.0,-930.0,5160.0,-790.0,4480.0,-790.0,4480.0,-650.0,4240.0,-590.0,3400.0,-590.0,3400.0,-430.0]},{"y":[685.8,708.9],"m":0,"k":2,"o":[13620.0,-50.0,13620.0,50.0,13820.0,50.0,13820.0,-50.0]},{"y":[702.3,725.9],"m":0,"k":3,"o":[1760.0,-430.0,2380.0,-350.0,2380.0,-210.0,2160.0,-170.0,2160.0,170.0,2380.0,210.0,2380.0,350.0,1760.0,430.0,3400.0,430.0,3400.0,590.0,5160.0,790.0,5160.0,930.0,5020.0,930.0,5160.0,1010.0,5160.0,1270.0,5720.0,1270.0,5720.0,1430.0,6520.0,1430.0,6520.0,1210.0,6240.0,1190.0,6240.0,1030.0,7200.0,1030.0,7220.0,1190.0,7420.0,1190.0,7700.0,890.0,7960.0,1050.0,8180.0,810.0,8280.0,990.0,8920.0,990.0,8880.0,610.0,9040.0,770.0,9420.0,650.0,9420.0,810.0,9580.0,810.0,9740.0,650.0,10380.0,650.0,10420.0,510.0,10940.0,510.0,11300.0,330.0,12160.0,430.0,12160.0,210.0,12340.0,150.0,13060.0,110.0,13060.0,250.0,13200.0,250.0,13580.0,70.0,13560.0,-110.0,13200.0,-250.0,13060.0,-250.0,13060.0,-110.0,12340.0,-150.0,12160.0,-210.0,12160.0,-430.0,11300.0,-330.0,10940.0,-510.0,10420.0,-510.0,10380.0,-650.0,9740.0,-650.0,9580.0,-810.0,9420.0,-810.0,9420.0,-650.0,9040.0,-770.0,8880.0,-610.0,8920.0,-990.0,8280.0,-990.0,8180.0,-810.0,7960.0,-1050.0,7700.0,-890.0,7420.0,-1190.0,7220.0,-1190.0,7200.0,-1030.0,6240.0,-1030.0,6240.0,-1190.0,6520.0,-1210.0,6520.0,-1430.0,5160.0,-1270.0,5160.0,-1010.0,5020.0,-990.0,5160.0,-790.0,4480.0,-790.0,4440.0,-630.0,3400.0,-590.0,3400.0,-430.0]},{"y":[702.3,720.7],"m":1,"k":3,"o":[12280.0,230.0,12280.0,310.0,12360.0,310.0,12360.0,430.0,12520.0,430.0,12520.0,310.0,12560.0,310.0,12560.0,230.0]},{"y":[702.3,735.2],"m":1,"k":3,"o":[12680.0,230.0,12680.0,310.0,12760.0,310.0,12760.0,230.0]},{"y":[722.9,759.7],"m":0,"k":4,"o":[1760.0,-430.0,1760.0,-350.0,2380.0,-350.0,2380.0,-210.0,2160.0,-170.0,2160.0,170.0,2380.0,210.0,2380.0,350.0,1760.0,350.0,1760.0,430.0,3400.0,430.0,3400.0,590.0,4240.0,590.0,4480.0,650.0,4480.0,790.0,5160.0,790.0,5160.0,930.0,5020.0,930.0,5160.0,990.0,5160.0,1270.0,6240.0,1270.0,6240.0,1030.0,7540.0,1050.0,7700.0,890.0,7780.0,890.0,7780.0,1050.0,7960.0,1050.0,8180.0,810.0,8280.0,810.0,8280.0,990.0,8920.0,990.0,8920.0,850.0,8840.0,850.0,8880.0,490.0,8960.0,510.0,9040.0,770.0,9420.0,650.0,9420.0,810.0,9580.0,810.0,9740.0,650.0,10380.0,650.0,10380.0,510.0,10940.0,510.0,10980.0,410.0,11300.0,410.0,11300.0,330.0,11360.0,410.0,12160.0,410.0,12160.0,210.0,12780.0,130.0,12780.0,-130.0,12160.0,-210.0,12160.0,-410.0,11360.0,-410.0,11300.0,-330.0,11300.0,-410.0,10980.0,-410.0,10940.0,-510.0,10380.0,-510.0,10380.0,-650.0,9740.0,-650.0,9580.0,-810.0,9420.0,-810.0,9420.0,-650.0,9040.0,-770.0,8960.0,-510.0,8880.0,-490.0,8840.0,-850.0,8920.0,-850.0,8920.0,-990.0,8280.0,-990.0,8280.0,-810.0,8180.0,-810.0,7960.0,-1050.0,7780.0,-1050.0,7780.0,-890.0,7540.0,-1050.0,6240.0,-1030.0,6240.0,-1270.0,5160.0,-1270.0,5160.0,-990.0,5020.0,-990.0,5160.0,-930.0,5160.0,-790.0,4480.0,-790.0,4480.0,-650.0,4240.0,-590.0,3400.0,-590.0,3400.0,-430.0]},{"y":[732.3,758.5],"m":1,"k":1,"o":[3780.0,730.0,3780.0,990.0,4840.0,990.0,4840.0,930.0,4120.0,930.0,4120.0,730.0]},{"y":[717.7,758.5],"m":1,"k":4,"o":[12380.0,270.0,12380.0,410.0,12500.0,410.0,12500.0,270.0]},{"y":[722.9,758.5],"m":1,"k":4,"o":[13060.0,110.0,13060.0,250.0,13200.0,250.0,13200.0,110.0]},{"y":[756.7,780.1],"m":0,"k":5,"o":[1760.0,-430.0,1760.0,-350.0,2380.0,-350.0,2380.0,-210.0,2160.0,-170.0,2160.0,170.0,2380.0,210.0,2380.0,350.0,1760.0,350.0,1760.0,430.0,3400.0,430.0,3400.0,590.0,4240.0,590.0,4480.0,650.0,4480.0,790.0,5200.0,790.0,5200.0,1230.0,6200.0,1230.0,6200.0,1030.0,7540.0,1050.0,7620.0,890.0,7780.0,890.0,7780.0,1050.0,7960.0,1050.0,8180.0,810.0,8280.0,810.0,8280.0,990.0,8920.0,990.0,8840.0,490.0,9060.0,510.0,9040.0,770.0,9300.0,710.0,9400.0,510.0,9520.0,730.0,9640.0,730.0,9700.0,610.0,10180.0,610.0,10180.0,490.0,10940.0,510.0,10980.0,330.0,11540.0,330.0,11540.0,130.0,11660.0,130.0,11660.0,370.0,11900.0,370.0,11900.0,230.0,12760.0,130.0,12760.0,-130.0,11900.0,-230.0,11900.0,-370.0,11660.0,-370.0,11660.0,-130.0,11540.0,-130.0,11540.0,-330.0,10980.0,-330.0,10940.0,-510.0,10180.0,-490.0,10180.0,-610.0,9700.0,-610.0,9640.0,-730.0,9520.0,-730.0,9400.0,-510.0,9300.0,-710.0,9040.0,-770.0,9060.0,-510.0,8840.0,-490.0,8920.0,-990.0,8280.0,-990.0,8280.0,-810.0,8180.0,-810.0,7960.0,-1050.0,7780.0,-1050.0,7780.0,-890.0,7620.0,-890.0,7540.0,-1050.0,6200.0,-1030.0,6200.0,-1230.0,5200.0,-1230.0,5200.0,-790.0,4480.0,-790.0,4480.0,-650.0,4240.0,-590.0,3400.0,-590.0,3400.0,-430.0]},{"y":[755.5,795.8],"m":1,"k":2,"o":[3780.0,730.0,3780.0,970.0,4120.0,970.0,4120.0,730.0]},{"y":[755.5,781.7],"m":1,"k":5,"o":[13080.0,130.0,13080.0,230.0,13180.0,230.0,13180.0,130.0]},{"y":[777.1,804.9],"m":0,"k":6,"o":[1760.0,-430.0,1760.0,-350.0,2380.0,-350.0,2380.0,-210.0,2160.0,-170.0,2160.0,170.0,2380.0,210.0,2380.0,350.0,1760.0,350.0,1760.0,430.0,3400.0,430.0,3400.0,590.0,4240.0,590.0,4480.0,630.0,4480.0,790.0,5200.0,790.0,5200.0,1230.0,6200.0,1230.0,6200.0,990.0,7520.0,1050.0,7600.0,890.0,7780.0,890.0,7780.0,1050.0,7960.0,1050.0,8180.0,810.0,8600.0,870.0,8840.0,790.0,8840.0,490.0,9060.0,510.0,9020.0,750.0,9200.0,770.0,9400.0,510.0,9620.0,510.0,9520.0,730.0,9640.0,730.0,9680.0,610.0,10180.0,610.0,10180.0,490.0,10980.0,490.0,10980.0,330.0,11540.0,330.0,11540.0,-330.0,10980.0,-330.0,10980.0,-490.0,10180.0,-490.0,10180.0,-610.0,9680.0,-610.0,9640.0,-730.0,9520.0,-730.0,9620.0,-510.0,9400.0,-510.0,9200.0,-770.0,9020.0,-750.0,9060.0,-510.0,8840.0,-490.0,8840.0,-790.0,8600.0,-870.0,8180.0,-810.0,7960.0,-1050.0,7780.0,-1050.0,7780.0,-890.0,7600.0,-890.0,7520.0,-1050.0,6200.0,-990.0,6200.0,-1230.0,5200.0,-1230.0,5200.0,-790.0,4480.0,-790.0,4480.0,-630.0,4240.0,-590.0,3400.0,-590.0,3400.0,-430.0]},{"y":[777.1,804.9],"m":0,"k":6,"o":[11660.0,-210.0,11660.0,210.0,11680.0,210.0,11680.0,350.0,11880.0,350.0,11880.0,250.0,11900.0,250.0,11900.0,230.0,12340.0,210.0,12340.0,150.0,12380.0,150.0,12380.0,130.0,12760.0,130.0,12760.0,-130.0,12380.0,-130.0,12380.0,-150.0,12340.0,-150.0,12340.0,-210.0,11900.0,-230.0,11900.0,-250.0,11880.0,-250.0,11880.0,-350.0,11680.0,-350.0,11680.0,-210.0]},{"y":[801.9,859.1],"m":0,"k":7,"o":[1760.0,-430.0,1760.0,-350.0,2380.0,-350.0,2380.0,-210.0,2160.0,-170.0,2160.0,170.0,2380.0,210.0,2380.0,350.0,1760.0,350.0,1760.0,430.0,3400.0,430.0,3400.0,590.0,4480.0,590.0,4480.0,790.0,5720.0,850.0,5680.0,1210.0,5880.0,1210.0,6000.0,1150.0,6000.0,1050.0,6100.0,1050.0,6080.0,590.0,6400.0,590.0,6380.0,910.0,6580.0,910.0,6800.0,690.0,7360.0,730.0,7520.0,510.0,7900.0,490.0,7900.0,590.0,7520.0,590.0,7520.0,890.0,7780.0,890.0,7780.0,1050.0,7960.0,1050.0,8180.0,810.0,8440.0,810.0,8440.0,870.0,8660.0,810.0,8660.0,650.0,8480.0,650.0,8540.0,430.0,9060.0,510.0,9040.0,770.0,9380.0,630.0,9400.0,510.0,10160.0,490.0,10160.0,130.0,9920.0,110.0,9920.0,-110.0,10160.0,-130.0,10160.0,-490.0,9400.0,-510.0,9380.0,-630.0,9040.0,-770.0,9060.0,-510.0,8540.0,-430.0,8480.0,-650.0,8660.0,-650.0,8660.0,-810.0,8600.0,-870.0,8180.0,-810.0,7960.0,-1050.0,7780.0,-1050.0,7780.0,-890.0,7520.0,-890.0,7520.0,-590.0,7900.0,-590.0,7900.0,-490.0,7520.0,-510.0,7360.0,-730.0,6800.0,-690.0,6580.0,-910.0,6380.0,-910.0,6400.0,-590.0,6080.0,-590.0,6100.0,-1050.0,6000.0,-1050.0,6000.0,-1150.0,5880.0,-1210.0,5680.0,-1210.0,5720.0,-850.0,4480.0,-790.0,4480.0,-590.0,3400.0,-590.0,3400.0,-430.0]},{"y":[801.9,822.7],"m":1,"k":7,"o":[7360.0,890.0,7360.0,1030.0,7520.0,1030.0,7520.0,890.0]},{"y":[801.9,831.7],"m":0,"k":7,"o":[10180.0,-230.0,10180.0,230.0,10320.0,230.0,10320.0,370.0,10380.0,370.0,10380.0,410.0,10820.0,410.0,10820.0,370.0,10860.0,370.0,10860.0,350.0,10900.0,350.0,10900.0,310.0,10940.0,310.0,10940.0,230.0,11020.0,230.0,11020.0,310.0,11540.0,310.0,11540.0,30.0,11080.0,30.0,11080.0,-30.0,11540.0,-30.0,11540.0,-310.0,11020.0,-310.0,11020.0,-230.0,10940.0,-230.0,10940.0,-310.0,10900.0,-310.0,10900.0,-350.0,10820.0,-370.0,10820.0,-410.0,10380.0,-410.0,10380.0,-370.0,10320.0,-370.0,10320.0,-230.0]},{"y":[801.9,835.5],"m":0,"k":7,"o":[11660.0,-210.0,11660.0,210.0,11700.0,210.0,11700.0,310.0,11720.0,310.0,11720.0,330.0,11800.0,330.0,11800.0,290.0,11860.0,290.0,11860.0,250.0,11900.0,250.0,11900.0,210.0,12340.0,210.0,12340.0,150.0,12380.0,150.0,12380.0,130.0,12460.0,130.0,12460.0,110.0,12500.0,110.0,12500.0,90.0,12600.0,90.0,12600.0,70.0,12640.0,70.0,12640.0,-70.0,12600.0,-70.0,12600.0,-90.0,12500.0,-90.0,12500.0,-110.0,12460.0,-110.0,12460.0,-130.0,12380.0,-130.0,12380.0,-150.0,12340.0,-150.0,12340.0,-210.0,11900.0,-210.0,11900.0,-250.0,11860.0,-250.0,11860.0,-290.0,11800.0,-290.0,11800.0,-330.0,11720.0,-330.0,11720.0,-310.0,11700.0,-310.0,11700.0,-210.0]},{"y":[828.7,863.7],"m":0,"k":8,"o":[10220.0,-210.0,10220.0,210.0,10320.0,210.0,10320.0,370.0,10460.0,350.0,10480.0,250.0,10580.0,250.0,10580.0,210.0,10940.0,210.0,10940.0,-210.0,10580.0,-210.0,10580.0,-250.0,10480.0,-250.0,10460.0,-350.0,10400.0,-350.0,10400.0,-370.0,10320.0,-370.0,10320.0,-210.0]},{"y":[828.7,855.9],"m":1,"k":8,"o":[10800.0,230.0,10800.0,310.0,10820.0,310.0,10820.0,330.0,10900.0,330.0,10900.0,310.0,10940.0,310.0,10940.0,230.0]},{"y":[828.7,857.7],"m":1,"k":8,"o":[11140.0,90.0,11140.0,250.0,11240.0,250.0,11240.0,310.0,11340.0,310.0,11340.0,290.0,11380.0,290.0,11400.0,250.0,11460.0,250.0,11460.0,170.0,11500.0,170.0,11500.0,150.0,11520.0,150.0,11520.0,70.0,11460.0,70.0,11460.0,50.0,11380.0,50.0,11380.0,90.0]},{"y":[832.5,856.3],"m":0,"k":8,"o":[11660.0,-210.0,11660.0,210.0,11700.0,210.0,11700.0,310.0,11720.0,310.0,11720.0,330.0,11800.0,330.0,11800.0,290.0,11860.0,290.0,11860.0,250.0,11900.0,250.0,11900.0,210.0,12340.0,210.0,12340.0,110.0,12420.0,110.0,12420.0,90.0,12480.0,90.0,12480.0,70.0,12500.0,70.0,12500.0,-70.0,12480.0,-70.0,12480.0,-90.0,12420.0,-90.0,12420.0,-110.0,12340.0,-110.0,12340.0,-210.0,11900.0,-210.0,11900.0,-250.0,11860.0,-250.0,11860.0,-290.0,11800.0,-290.0,11800.0,-330.0,11720.0,-330.0,11720.0,-310.0,11700.0,-310.0,11700.0,-210.0]},{"y":[856.1,882.3],"m":0,"k":8,"o":[1760.0,-390.0,2380.0,-350.0,2380.0,-210.0,2160.0,-170.0,2160.0,170.0,2380.0,210.0,2380.0,350.0,1760.0,390.0,3400.0,410.0,3400.0,590.0,4480.0,590.0,4480.0,790.0,6080.0,850.0,6080.0,590.0,6340.0,570.0,6380.0,910.0,6580.0,910.0,6700.0,750.0,6800.0,750.0,6800.0,590.0,6980.0,590.0,6980.0,370.0,7340.0,370.0,7360.0,570.0,7900.0,490.0,7920.0,650.0,8080.0,650.0,8080.0,730.0,7900.0,790.0,7900.0,950.0,8040.0,950.0,8120.0,810.0,8480.0,810.0,8480.0,490.0,8680.0,250.0,8740.0,470.0,9040.0,490.0,9140.0,670.0,9260.0,670.0,9280.0,530.0,9420.0,490.0,10160.0,490.0,10160.0,130.0,9920.0,110.0,9920.0,-110.0,10160.0,-130.0,10160.0,-490.0,9420.0,-490.0,9280.0,-530.0,9260.0,-670.0,9140.0,-670.0,9080.0,-510.0,8740.0,-470.0,8680.0,-250.0,8480.0,-490.0,8480.0,-810.0,8120.0,-810.0,8040.0,-950.0,7900.0,-950.0,7900.0,-790.0,8080.0,-730.0,8080.0,-650.0,7900.0,-630.0,7900.0,-490.0,7360.0,-570.0,7340.0,-370.0,6980.0,-370.0,6980.0,-590.0,6800.0,-590.0,6800.0,-750.0,6700.0,-750.0,6580.0,-910.0,6380.0,-910.0,6340.0,-570.0,6080.0,-590.0,6080.0,-850.0,5320.0,-850.0,5320.0,-790.0,4480.0,-790.0,4480.0,-590.0,3400.0,-590.0,3400.0,-410.0]},{"y":[856.1,887.7],"m":1,"k":8,"o":[5800.0,950.0,5800.0,1110.0,5960.0,1110.0,5960.0,1050.0,6020.0,1050.0,6020.0,890.0,5880.0,890.0,5880.0,950.0]},{"y":[860.7,874.5],"m":0,"k":9,"o":[10220.0,-210.0,10220.0,210.0,10940.0,210.0,10940.0,-210.0]},{"y":[860.7,880.3],"m":1,"k":9,"o":[10320.0,290.0,10320.0,370.0,10460.0,350.0,10460.0,310.0,10480.0,310.0,10480.0,230.0,10340.0,230.0,10340.0,290.0]},{"y":[854.7,882.9],"m":1,"k":9,"o":[11240.0,230.0,11240.0,310.0,11340.0,310.0,11340.0,290.0,11380.0,290.0,11380.0,250.0,11420.0,250.0,11420.0,150.0,11260.0,150.0,11260.0,230.0]},{"y":[853.3,890.0],"m":0,"k":9,"o":[11660.0,-210.0,11660.0,210.0,11760.0,210.0,11760.0,270.0,11840.0,270.0,11880.0,210.0,12340.0,210.0,12340.0,-210.0,11880.0,-210.0,11840.0,-270.0,11760.0,-270.0,11760.0,-210.0]},{"y":[879.3,905.4],"m":0,"k":9,"o":[2160.0,-170.0,2160.0,170.0,2380.0,190.0,2380.0,330.0,2700.0,330.0,2700.0,410.0,3400.0,410.0,3400.0,590.0,4480.0,590.0,4480.0,790.0,5320.0,790.0,5320.0,850.0,6080.0,850.0,6080.0,590.0,6240.0,570.0,6400.0,590.0,6400.0,710.0,6500.0,730.0,6500.0,790.0,6660.0,790.0,6660.0,750.0,6800.0,750.0,6800.0,590.0,6980.0,590.0,6980.0,350.0,7360.0,350.0,7360.0,550.0,7500.0,550.0,7500.0,510.0,7580.0,490.0,8220.0,510.0,8540.0,490.0,8540.0,330.0,8660.0,330.0,8680.0,250.0,8740.0,250.0,8740.0,470.0,9080.0,490.0,9080.0,590.0,9280.0,590.0,9280.0,490.0,10160.0,490.0,10160.0,130.0,9760.0,90.0,9780.0,-110.0,10160.0,-130.0,10160.0,-490.0,9280.0,-490.0,9280.0,-590.0,9080.0,-590.0,9080.0,-490.0,8740.0,-470.0,8740.0,-250.0,8680.0,-250.0,8660.0,-330.0,8540.0,-330.0,8540.0,-490.0,8220.0,-510.0,7580.0,-490.0,7500.0,-510.0,7500.0,-550.0,7360.0,-550.0,7360.0,-350.0,6980.0,-350.0,6980.0,-590.0,6800.0,-590.0,6800.0,-750.0,6660.0,-750.0,6660.0,-790.0,6500.0,-790.0,6500.0,-730.0,6400.0,-710.0,6400.0,-590.0,6240.0,-570.0,6080.0,-590.0,6080.0,-850.0,5320.0,-850.0,5320.0,-790.0,4480.0,-790.0,4480.0,-590.0,3400.0,-590.0,3400.0,-410.0,2700.0,-410.0,2700.0,-330.0,2380.0,-330.0,2380.0,-190.0]},{"y":[884.7,908.6],"m":1,"k":9,"o":[5800.0,950.0,5800.0,1090.0,5960.0,1090.0,5960.0,950.0]},{"y":[879.3,908.6],"m":1,"k":9,"o":[7900.0,790.0,7900.0,930.0,7920.0,930.0,7920.0,950.0,8020.0,950.0,8020.0,930.0,8040.0,930.0,8040.0,790.0]},{"y":[871.5,911.9],"m":0,"k":10,"o":[10280.0,-150.0,10280.0,150.0,10320.0,150.0,10320.0,170.0,10420.0,170.0,10420.0,150.0,10840.0,150.0,10840.0,-150.0,10420.0,-150.0,10420.0,-170.0,10320.0,-170.0,10320.0,-150.0]},{"y":[879.9,904.3],"m":1,"k":10,"o":[11280.0,190.0,11280.0,250.0,11300.0,250.0,11300.0,270.0,11380.0,270.0,11380.0,170.0]},{"y":[887.0,911.9],"m":0,"k":10,"o":[11720.0,-150.0,11720.0,150.0,11960.0,150.0,11960.0,190.0,12060.0,190.0,12060.0,170.0,12100.0,170.0,12100.0,150.0,12280.0,150.0,12280.0,90.0,12320.0,90.0,12320.0,-90.0,12280.0,-90.0,12280.0,-150.0,12100.0,-150.0,12100.0,-170.0,12060.0,-170.0,12060.0,-190.0,11960.0,-190.0,11960.0,-150.0]},{"y":[902.4,921.0],"m":0,"k":10,"o":[2160.0,-130.0,2160.0,130.0,2320.0,130.0,2320.0,190.0,2380.0,190.0,2380.0,330.0,2700.0,330.0,2700.0,410.0,3400.0,410.0,3400.0,590.0,4480.0,590.0,4480.0,770.0,5360.0,770.0,5360.0,810.0,6040.0,810.0,6040.0,590.0,6340.0,570.0,6500.0,590.0,6500.0,790.0,6660.0,790.0,6660.0,750.0,6740.0,710.0,6740.0,590.0,6980.0,590.0,6980.0,350.0,6480.0,350.0,6480.0,270.0,7140.0,270.0,7140.0,350.0,7360.0,350.0,7360.0,490.0,8220.0,510.0,8540.0,490.0,8540.0,330.0,8660.0,330.0,8680.0,250.0,8820.0,250.0,8820.0,150.0,8880.0,150.0,8880.0,490.0,10160.0,490.0,10140.0,130.0,9780.0,110.0,9760.0,70.0,9540.0,70.0,9540.0,130.0,8920.0,130.0,8920.0,-130.0,9540.0,-130.0,9540.0,-70.0,9760.0,-70.0,9780.0,-110.0,10140.0,-130.0,10160.0,-490.0,8880.0,-490.0,8880.0,-150.0,8820.0,-150.0,8820.0,-250.0,8680.0,-250.0,8660.0,-330.0,8540.0,-330.0,8540.0,-490.0,8220.0,-510.0,7360.0,-490.0,7360.0,-350.0,7140.0,-350.0,7140.0,-270.0,6480.0,-270.0,6480.0,-350.0,6980.0,-350.0,6980.0,-590.0,6740.0,-590.0,6740.0,-710.0,6660.0,-750.0,6660.0,-790.0,6500.0,-790.0,6500.0,-590.0,6340.0,-570.0,6040.0,-590.0,6040.0,-810.0,5360.0,-810.0,5360.0,-770.0,4480.0,-770.0,4480.0,-590.0,3400.0,-590.0,3400.0,-410.0,2700.0,-410.0,2700.0,-330.0,2380.0,-330.0,2380.0,-190.0,2320.0,-190.0,2320.0,-130.0]},{"y":[908.9,932.0],"m":0,"k":11,"o":[10320.0,-170.0,10320.0,170.0,10420.0,170.0,10420.0,110.0,10440.0,110.0,10440.0,90.0,10500.0,90.0,10500.0,-90.0,10440.0,-90.0,10440.0,-110.0,10420.0,-110.0,10420.0,-170.0]},{"y":[908.9,933.3],"m":0,"k":11,"o":[11740.0,-130.0,11740.0,-50.0,11760.0,-50.0,11740.0,130.0,11880.0,130.0,11880.0,150.0,11960.0,150.0,11960.0,190.0,12060.0,190.0,12060.0,170.0,12100.0,170.0,12100.0,150.0,12220.0,150.0,12220.0,110.0,12320.0,90.0,12320.0,-90.0,12220.0,-110.0,12220.0,-150.0,12100.0,-150.0,12100.0,-170.0,12060.0,-170.0,12060.0,-190.0,11960.0,-190.0,11960.0,-150.0,11880.0,-150.0,11880.0,-130.0]},{"y":[918.0,951.3],"m":0,"k":11,"o":[2160.0,-70.0,2160.0,70.0,2260.0,70.0,2260.0,90.0,2320.0,90.0,2320.0,190.0,2380.0,190.0,2380.0,330.0,2700.0,330.0,2700.0,410.0,3400.0,410.0,3400.0,590.0,3780.0,590.0,3780.0,570.0,3840.0,570.0,3840.0,590.0,4480.0,590.0,4480.0,750.0,5880.0,750.0,5880.0,670.0,6000.0,670.0,6000.0,590.0,6240.0,590.0,6240.0,570.0,6980.0,570.0,6980.0,350.0,6480.0,350.0,6480.0,230.0,7120.0,230.0,7120.0,270.0,7140.0,270.0,7140.0,350.0,7360.0,350.0,7360.0,490.0,7540.0,490.0,7540.0,510.0,7580.0,510.0,7580.0,490.0,7920.0,490.0,7920.0,510.0,8540.0,490.0,8540.0,130.0,8360.0,130.0,8360.0,-130.0,8540.0,-130.0,8540.0,-490.0,8220.0,-490.0,8220.0,-510.0,7920.0,-510.0,7920.0,-490.0,7580.0,-490.0,7580.0,-510.0,7540.0,-510.0,7540.0,-490.0,7360.0,-490.0,7360.0,-350.0,7140.0,-350.0,7140.0,-270.0,7120.0,-270.0,7120.0,-230.0,6480.0,-230.0,6480.0,-350.0,6980.0,-350.0,6980.0,-570.0,6240.0,-570.0,6240.0,-590.0,6000.0,-590.0,6000.0,-670.0,5880.0,-670.0,5880.0,-750.0,4480.0,-750.0,4480.0,-590.0,3840.0,-590.0,3840.0,-570.0,3780.0,-570.0,3780.0,-590.0,3400.0,-590.0,3400.0,-410.0,2700.0,-410.0,2700.0,-330.0,2380.0,-330.0,2380.0,-190.0,2320.0,-190.0,2320.0,-90.0,2260.0,-90.0,2260.0,-70.0]},{"y":[918.0,959.5],"m":1,"k":11,"o":[6500.0,650.0,6500.0,790.0,6660.0,790.0,6660.0,650.0,6640.0,650.0,6640.0,630.0,6520.0,630.0,6520.0,650.0]},{"y":[918.0,958.9],"m":0,"k":11,"o":[8480.0,-110.0,8480.0,110.0,8580.0,110.0,8580.0,190.0,8600.0,190.0,8600.0,210.0,8760.0,210.0,8760.0,190.0,8780.0,190.0,8780.0,150.0,8920.0,150.0,8920.0,-150.0,8780.0,-150.0,8780.0,-190.0,8760.0,-190.0,8760.0,-210.0,8600.0,-210.0,8600.0,-190.0,8580.0,-190.0,8580.0,-110.0]},{"y":[918.0,949.5],"m":1,"k":11,"o":[9200.0,310.0,9200.0,470.0,9380.0,470.0,9380.0,410.0,9440.0,410.0,9440.0,270.0,9300.0,270.0,9300.0,310.0]},{"y":[918.0,962.7],"m":1,"k":11,"o":[9520.0,170.0,9520.0,270.0,9540.0,270.0,9540.0,290.0,9680.0,290.0,9680.0,350.0,9840.0,350.0,9840.0,310.0,9920.0,310.0,9920.0,350.0,10020.0,350.0,10020.0,310.0,10100.0,310.0,10100.0,250.0,10140.0,250.0,10140.0,150.0,10040.0,150.0,10040.0,130.0,9960.0,130.0,9960.0,110.0,9780.0,110.0,9760.0,70.0,9540.0,70.0,9540.0,170.0]},{"y":[929.0,948.3],"m":1,"k":12,"o":[10360.0,50.0,10360.0,110.0,10440.0,110.0,10440.0,90.0,10480.0,90.0,10480.0,30.0,10380.0,30.0,10380.0,50.0]},{"y":[930.3,954.9],"m":1,"k":12,"o":[11900.0,30.0,11900.0,90.0,11980.0,90.0,11980.0,70.0,12000.0,70.0,12000.0,10.0]},{"y":[930.3,954.1],"m":1,"k":12,"o":[12020.0,70.0,12020.0,150.0,12100.0,150.0,12100.0,130.0,12120.0,130.0,12120.0,50.0,12040.0,50.0,12040.0,70.0]},{"y":[930.3,956.1],"m":1,"k":12,"o":[12180.0,30.0,12180.0,110.0,12260.0,110.0,12280.0,10.0]},{"y":[948.3,1000.9],"m":0,"k":12,"o":[2160.0,-30.0,2160.0,30.0,2320.0,30.0,2320.0,190.0,2380.0,190.0,2380.0,330.0,3560.0,330.0,3560.0,450.0,3800.0,450.0,3800.0,350.0,3940.0,350.0,3940.0,550.0,4680.0,550.0,4680.0,370.0,4880.0,370.0,4880.0,570.0,4900.0,570.0,4900.0,590.0,5100.0,590.0,5100.0,570.0,5560.0,570.0,5560.0,590.0,5680.0,590.0,5680.0,750.0,5880.0,750.0,5880.0,670.0,6000.0,670.0,6000.0,590.0,6180.0,590.0,6180.0,570.0,6480.0,570.0,6480.0,170.0,6520.0,170.0,6520.0,30.0,6480.0,30.0,6480.0,-30.0,6520.0,-30.0,6520.0,-170.0,6480.0,-170.0,6480.0,-570.0,6180.0,-570.0,6180.0,-590.0,6000.0,-590.0,6000.0,-670.0,5880.0,-670.0,5880.0,-750.0,5680.0,-750.0,5680.0,-590.0,5560.0,-590.0,5560.0,-570.0,5100.0,-570.0,5100.0,-590.0,4900.0,-590.0,4900.0,-570.0,4880.0,-570.0,4880.0,-370.0,4680.0,-370.0,4680.0,-550.0,3940.0,-550.0,3940.0,-350.0,3800.0,-350.0,3800.0,-450.0,3560.0,-450.0,3560.0,-330.0,2380.0,-330.0,2380.0,-190.0,2320.0,-190.0,2320.0,-30.0]},{"y":[948.3,982.9],"m":0,"k":12,"o":[7120.0,-270.0,7120.0,270.0,7140.0,270.0,7140.0,350.0,7400.0,350.0,7400.0,450.0,7920.0,450.0,7920.0,490.0,7940.0,490.0,7940.0,510.0,8120.0,510.0,8120.0,450.0,8500.0,450.0,8500.0,170.0,8140.0,150.0,8140.0,130.0,7960.0,130.0,7960.0,170.0,7900.0,170.0,7900.0,-170.0,7960.0,-170.0,7960.0,-130.0,8140.0,-130.0,8140.0,-150.0,8500.0,-170.0,8500.0,-450.0,8120.0,-450.0,8120.0,-510.0,7940.0,-510.0,7940.0,-490.0,7920.0,-490.0,7920.0,-450.0,7400.0,-450.0,7400.0,-350.0,7140.0,-350.0,7140.0,-270.0]},{"y":[955.9,975.2],"m":0,"k":12,"o":[8480.0,-110.0,8480.0,110.0,8580.0,110.0,8580.0,190.0,8600.0,190.0,8600.0,210.0,8760.0,210.0,8760.0,190.0,8780.0,190.0,8780.0,150.0,8840.0,150.0,8840.0,130.0,8860.0,130.0,8860.0,-130.0,8840.0,-130.0,8840.0,-150.0,8780.0,-150.0,8780.0,-190.0,8760.0,-190.0,8760.0,-210.0,8600.0,-210.0,8600.0,-190.0,8580.0,-190.0,8580.0,-110.0]},{"y":[946.5,971.7],"m":1,"k":12,"o":[9220.0,330.0,9220.0,450.0,9240.0,450.0,9240.0,470.0,9340.0,470.0,9340.0,450.0,9360.0,450.0,9360.0,330.0]},{"y":[959.7,978.2],"m":1,"k":12,"o":[9540.0,70.0,9540.0,170.0,9560.0,170.0,9560.0,190.0,9600.0,190.0,9600.0,230.0,9680.0,230.0,9680.0,350.0,9840.0,350.0,9840.0,290.0,9900.0,290.0,9900.0,170.0,9880.0,170.0,9880.0,150.0,9760.0,150.0,9760.0,90.0,9740.0,90.0,9740.0,70.0]},{"y":[959.7,982.9],"m":1,"k":12,"o":[9940.0,130.0,9940.0,250.0,9980.0,250.0,9980.0,290.0,10080.0,290.0,10080.0,250.0,10140.0,250.0,10140.0,150.0]},{"y":[979.9,1015.8],"m":0,"k":13,"o":[7120.0,-270.0,7120.0,270.0,7140.0,270.0,7140.0,350.0,8040.0,370.0,8060.0,410.0,8200.0,410.0,8200.0,370.0,8300.0,370.0,8300.0,250.0,8280.0,250.0,8280.0,190.0,8160.0,190.0,8160.0,150.0,8140.0,150.0,8140.0,130.0,7960.0,130.0,7960.0,250.0,7900.0,250.0,7900.0,-250.0,7960.0,-250.0,7960.0,-130.0,8140.0,-130.0,8140.0,-150.0,8160.0,-150.0,8160.0,-190.0,8280.0,-190.0,8280.0,-250.0,8300.0,-250.0,8300.0,-370.0,8200.0,-370.0,8200.0,-410.0,8060.0,-410.0,8040.0,-370.0,7140.0,-350.0,7140.0,-270.0]},{"y":[972.2,999.5],"m":0,"k":13,"o":[8580.0,-190.0,8580.0,-30.0,8600.0,-30.0,8600.0,30.0,8580.0,30.0,8580.0,190.0,8600.0,190.0,8600.0,210.0,8760.0,210.0,8760.0,190.0,8780.0,190.0,8780.0,130.0,8840.0,130.0,8840.0,-130.0,8780.0,-130.0,8780.0,-190.0,8760.0,-190.0,8760.0,-210.0,8600.0,-210.0,8600.0,-190.0]},{"y":[975.2,1000.5],"m":1,"k":13,"o":[9600.0,130.0,9600.0,210.0,9680.0,210.0,9680.0,190.0,9720.0,190.0,9720.0,150.0,9680.0,150.0,9680.0,130.0]},{"y":[975.2,1001.5],"m":1,"k":13,"o":[9680.0,210.0,9680.0,350.0,9820.0,350.0,9820.0,210.0]},{"y":[979.9,1003.8],"m":1,"k":13,"o":[9980.0,210.0,9980.0,290.0,10060.0,290.0,10060.0,250.0,10100.0,250.0,10100.0,230.0,10060.0,230.0,10060.0,190.0,10000.0,190.0,10000.0,210.0]},{"y":[997.9,1029.3],"m":0,"k":13,"o":[2380.0,-310.0,2380.0,-70.0,3040.0,-70.0,3040.0,70.0,2380.0,70.0,2380.0,310.0,2400.0,310.0,2400.0,330.0,3560.0,330.0,3560.0,450.0,3800.0,450.0,3800.0,350.0,3980.0,350.0,3980.0,510.0,4640.0,510.0,4640.0,370.0,4780.0,350.0,4780.0,370.0,4880.0,370.0,4880.0,570.0,4900.0,570.0,4900.0,590.0,5100.0,590.0,5100.0,570.0,5120.0,570.0,5120.0,530.0,5720.0,530.0,5740.0,570.0,5800.0,570.0,5800.0,630.0,5960.0,630.0,5960.0,590.0,6020.0,590.0,6020.0,570.0,6040.0,570.0,6040.0,530.0,6440.0,530.0,6440.0,210.0,6480.0,210.0,6480.0,170.0,6520.0,170.0,6520.0,30.0,6480.0,30.0,6480.0,-30.0,6520.0,-30.0,6520.0,-170.0,6480.0,-170.0,6480.0,-210.0,6440.0,-210.0,6440.0,-530.0,6040.0,-530.0,6040.0,-570.0,6020.0,-570.0,6020.0,-590.0,5960.0,-590.0,5960.0,-630.0,5800.0,-630.0,5800.0,-570.0,5740.0,-570.0,5720.0,-530.0,5120.0,-530.0,5120.0,-570.0,5100.0,-570.0,5100.0,-590.0,4900.0,-590.0,4900.0,-570.0,4880.0,-570.0,4880.0,-370.0,4780.0,-370.0,4780.0,-350.0,4640.0,-370.0,4640.0,-510.0,3980.0,-510.0,3980.0,-350.0,3800.0,-350.0,3800.0,-450.0,3560.0,-450.0,3560.0,-330.0,2400.0,-330.0,2400.0,-310.0]},{"y":[1012.8,1026.6],"m":0,"k":14,"o":[7120.0,-270.0,7120.0,270.0,7660.0,270.0,7660.0,370.0,8040.0,370.0,8060.0,410.0,8200.0,410.0,8200.0,370.0,8300.0,370.0,8300.0,250.0,7900.0,250.0,7900.0,-250.0,8300.0,-250.0,8300.0,-370.0,8200.0,-370.0,8200.0,-410.0,8060.0,-410.0,8040.0,-370.0,7660.0,-370.0,7660.0,-270.0]},{"y":[996.5,1023.9],"m":1,"k":14,"o":[8600.0,50.0,8600.0,170.0,8620.0,170.0,8620.0,190.0,8740.0,190.0,8740.0,170.0,8760.0,170.0,8760.0,50.0,8740.0,50.0,8740.0,30.0,8620.0,30.0,8620.0,50.0]},{"y":[1026.3,1054.7],"m":0,"k":14,"o":[2380.0,-310.0,2380.0,-90.0,2400.0,-90.0,2400.0,-70.0,3600.0,-70.0,3600.0,70.0,2400.0,70.0,2400.0,90.0,2380.0,90.0,2380.0,310.0,3560.0,310.0,3560.0,450.0,3800.0,450.0,3800.0,350.0,4320.0,350.0,4320.0,430.0,4340.0,430.0,4340.0,450.0,4560.0,450.0,4560.0,430.0,4580.0,430.0,4580.0,350.0,4880.0,350.0,4880.0,570.0,4900.0,570.0,4900.0,590.0,5100.0,590.0,5100.0,570.0,5120.0,570.0,5120.0,490.0,5260.0,490.0,5260.0,470.0,5280.0,470.0,5280.0,390.0,5360.0,390.0,5380.0,350.0,5500.0,350.0,5500.0,110.0,5400.0,110.0,5400.0,-110.0,5500.0,-110.0,5500.0,-350.0,5380.0,-350.0,5360.0,-390.0,5280.0,-390.0,5280.0,-470.0,5260.0,-470.0,5260.0,-490.0,5120.0,-490.0,5120.0,-570.0,5100.0,-570.0,5100.0,-590.0,4900.0,-590.0,4900.0,-570.0,4880.0,-570.0,4880.0,-350.0,4580.0,-350.0,4580.0,-430.0,4560.0,-430.0,4560.0,-450.0,4340.0,-450.0,4340.0,-430.0,4320.0,-430.0,4320.0,-350.0,3800.0,-350.0,3800.0,-450.0,3560.0,-450.0,3560.0,-310.0]},{"y":[1026.3,1087.3],"m":1,"k":14,"o":[5560.0,310.0,5560.0,450.0,6200.0,450.0,6200.0,310.0]},{"y":[1026.3,1114.5],"m":0,"k":14,"o":[5580.0,-210.0,5580.0,210.0,6480.0,210.0,6480.0,170.0,6520.0,170.0,6520.0,30.0,6480.0,30.0,6480.0,-30.0,6520.0,-30.0,6520.0,-170.0,6480.0,-170.0,6480.0,-210.0]},{"y":[1026.3,1063.4],"m":1,"k":14,"o":[5800.0,490.0,5800.0,630.0,5960.0,630.0,5960.0,490.0,5900.0,490.0,5900.0,470.0,5880.0,470.0,5880.0,490.0]},{"y":[1023.6,1059.6],"m":0,"k":15,"o":[7120.0,-250.0,7120.0,250.0,7740.0,250.0,7740.0,210.0,7760.0,210.0,7760.0,-210.0,7740.0,-210.0,7740.0,-250.0]},{"y":[1051.7,1093.4],"m":0,"k":15,"o":[3560.0,-450.0,3560.0,-190.0,3600.0,-190.0,3600.0,190.0,3560.0,190.0,3560.0,450.0,3800.0,450.0,3800.0,350.0,4320.0,350.0,4320.0,430.0,4340.0,430.0,4340.0,450.0,4560.0,450.0,4560.0,430.0,4580.0,430.0,4580.0,350.0,4880.0,350.0,4880.0,570.0,4900.0,570.0,4900.0,590.0,5100.0,590.0,5100.0,570.0,5120.0,570.0,5120.0,490.0,5260.0,490.0,5260.0,470.0,5280.0,470.0,5280.0,390.0,5360.0,390.0,5380.0,350.0,5500.0,350.0,5500.0,110.0,5360.0,110.0,5360.0,-110.0,5500.0,-110.0,5500.0,-350.0,5380.0,-350.0,5360.0,-390.0,5280.0,-390.0,5280.0,-470.0,5260.0,-470.0,5260.0,-490.0,5120.0,-490.0,5120.0,-570.0,5100.0,-570.0,5100.0,-590.0,4900.0,-590.0,4900.0,-570.0,4880.0,-570.0,4880.0,-350.0,4580.0,-350.0,4580.0,-430.0,4560.0,-430.0,4560.0,-450.0,4340.0,-450.0,4340.0,-430.0,4320.0,-430.0,4320.0,-350.0,3800.0,-350.0,3800.0,-450.0]},{"y":[1090.4,1108.7],"m":0,"k":16,"o":[3600.0,-190.0,3600.0,190.0,3620.0,190.0,3620.0,210.0,3720.0,210.0,3720.0,310.0,3900.0,310.0,3900.0,290.0,3920.0,290.0,3920.0,230.0,4080.0,230.0,4080.0,-230.0,3920.0,-230.0,3920.0,-290.0,3900.0,-290.0,3900.0,-310.0,3720.0,-310.0,3720.0,-210.0,3620.0,-210.0,3620.0,-190.0]},{"y":[1090.4,1113.8],"m":0,"k":16,"o":[4320.0,-430.0,4320.0,-210.0,4340.0,-210.0,4340.0,-190.0,4380.0,-190.0,4380.0,190.0,4340.0,190.0,4340.0,210.0,4320.0,210.0,4320.0,430.0,4340.0,430.0,4340.0,450.0,4560.0,450.0,4560.0,430.0,4580.0,430.0,4580.0,350.0,4740.0,350.0,4740.0,230.0,4860.0,230.0,4860.0,-230.0,4740.0,-230.0,4740.0,-350.0,4580.0,-350.0,4580.0,-430.0,4560.0,-430.0,4560.0,-450.0,4340.0,-450.0,4340.0,-430.0]},{"y":[1090.4,1111.2],"m":1,"k":16,"o":[4920.0,110.0,4920.0,350.0,5020.0,350.0,5020.0,430.0,5040.0,430.0,5040.0,450.0,5220.0,450.0,5220.0,390.0,5360.0,390.0,5360.0,370.0,5380.0,370.0,5380.0,150.0,5160.0,150.0,5140.0,110.0]},{"y":[1105.7,1126.8],"m":0,"k":17,"o":[3600.0,-190.0,3600.0,190.0,3620.0,190.0,3620.0,210.0,3720.0,210.0,3720.0,310.0,3900.0,310.0,3900.0,290.0,3920.0,290.0,3920.0,230.0,4000.0,230.0,4000.0,30.0,3840.0,30.0,3840.0,-30.0,4000.0,-30.0,4000.0,-230.0,3920.0,-230.0,3920.0,-290.0,3900.0,-290.0,3900.0,-310.0,3720.0,-310.0,3720.0,-210.0,3620.0,-210.0,3620.0,-190.0]},{"y":[1110.8,1132.0],"m":0,"k":17,"o":[4380.0,-210.0,4380.0,210.0,4480.0,210.0,4480.0,290.0,4500.0,290.0,4500.0,310.0,4680.0,310.0,4680.0,230.0,4860.0,230.0,4860.0,-230.0,4680.0,-230.0,4680.0,-310.0,4500.0,-310.0,4500.0,-290.0,4480.0,-290.0,4480.0,-210.0]},{"y":[1108.2,1128.4],"m":1,"k":17,"o":[4920.0,110.0,4920.0,350.0,5020.0,350.0,5020.0,430.0,5040.0,430.0,5040.0,450.0,5220.0,450.0,5220.0,390.0,5300.0,390.0,5300.0,190.0,5160.0,190.0,5160.0,130.0,5140.0,130.0,5140.0,110.0]},{"y":[1123.8,1154.0],"m":1,"k":18,"o":[3720.0,90.0,3720.0,310.0,3900.0,310.0,3900.0,290.0,3920.0,290.0,3920.0,210.0,3980.0,210.0,3980.0,50.0,3820.0,50.0,3820.0,90.0]},{"y":[1129.0,1150.1],"m":0,"k":18,"o":[4380.0,-210.0,4380.0,210.0,4480.0,210.0,4480.0,290.0,4500.0,290.0,4500.0,310.0,4680.0,310.0,4680.0,230.0,4780.0,230.0,4780.0,30.0,4620.0,30.0,4620.0,-30.0,4780.0,-30.0,4780.0,-230.0,4680.0,-230.0,4680.0,-310.0,4500.0,-310.0,4500.0,-290.0,4480.0,-290.0,4480.0,-210.0]},{"y":[1125.4,1154.2],"m":1,"k":18,"o":[5020.0,250.0,5020.0,430.0,5040.0,430.0,5040.0,450.0,5200.0,450.0,5200.0,430.0,5220.0,430.0,5220.0,370.0,5280.0,370.0,5280.0,350.0,5300.0,350.0,5300.0,210.0,5120.0,210.0,5120.0,250.0]},{"y":[1151.0,1181.2],"m":1,"k":19,"o":[3720.0,130.0,3720.0,270.0,3740.0,270.0,3740.0,290.0,3900.0,290.0,3900.0,110.0,3740.0,110.0,3740.0,130.0]},{"y":[1147.1,1177.2],"m":1,"k":19,"o":[4480.0,110.0,4480.0,290.0,4500.0,290.0,4500.0,310.0,4660.0,310.0,4660.0,290.0,4680.0,290.0,4680.0,210.0,4760.0,210.0,4760.0,50.0,4600.0,50.0,4600.0,90.0,4500.0,90.0,4500.0,110.0]},{"y":[1151.2,1179.9],"m":1,"k":19,"o":[5040.0,270.0,5040.0,430.0,5200.0,430.0,5200.0,270.0]},{"y":[1174.2,1204.4],"m":1,"k":20,"o":[4500.0,110.0,4500.0,270.0,4520.0,270.0,4520.0,290.0,4660.0,290.0,4660.0,270.0,4680.0,270.0,4680.0,130.0,4660.0,130.0,4660.0,110.0]}],"engines":[{"component":14,"mouth":[2708.758,340.5295,0.0],"direction":[-1,0,0],"diameter":309.573,"bodyForwardEndX":6191.446,"sourceBodyLength":3482.688,"nozzleExposedLength":773.9307,"provenance":"measured 12-sided tubular source geometry; muzzle is a dark flat source disk, use normal game nozzle"},{"component":17,"mouth":[2940.937,348.269,-386.96549999999996],"direction":[-1,0,0],"diameter":309.573,"bodyForwardEndX":6423.625,"sourceBodyLength":3482.688,"nozzleExposedLength":773.9307,"provenance":"measured 12-sided tubular source geometry; muzzle is a dark flat source disk, use normal game nozzle"},{"component":18,"mouth":[2940.937,348.269,386.96549999999996],"direction":[-1,0,0],"diameter":309.573,"bodyForwardEndX":6423.625,"sourceBodyLength":3482.688,"nozzleExposedLength":773.9307,"provenance":"measured 12-sided tubular source geometry; muzzle is a dark flat source disk, use normal game nozzle"},{"component":46,"mouth":[4101.833,332.79,-773.931],"direction":[-1,0,0],"diameter":263.13599999999997,"bodyForwardEndX":6539.715,"sourceBodyLength":2437.8820000000005,"nozzleExposedLength":773.9307,"provenance":"measured 12-sided tubular source geometry; muzzle is a dark flat source disk, use normal game nozzle"},{"component":47,"mouth":[4101.833,332.79,773.931],"direction":[-1,0,0],"diameter":263.13599999999997,"bodyForwardEndX":6539.715,"sourceBodyLength":2437.8820000000005,"nozzleExposedLength":773.9307,"provenance":"measured 12-sided tubular source geometry; muzzle is a dark flat source disk, use normal game nozzle"},{"component":52,"mouth":[4334.012,363.7475,-1044.8065000000001],"direction":[-1,0,0],"diameter":263.13699999999994,"bodyForwardEndX":6771.894,"sourceBodyLength":2437.8820000000005,"nozzleExposedLength":773.9307,"provenance":"measured 12-sided tubular source geometry; muzzle is a dark flat source disk, use normal game nozzle"},{"component":53,"mouth":[4334.012,363.7475,1044.8065000000001],"direction":[-1,0,0],"diameter":263.13699999999994,"bodyForwardEndX":6771.894,"sourceBodyLength":2437.8820000000005,"nozzleExposedLength":773.9307,"provenance":"measured 12-sided tubular source geometry; muzzle is a dark flat source disk, use normal game nozzle"},{"component":152,"mouth":[5185.337,162.5255,-1276.9859999999999],"direction":[-1,0,0],"diameter":263.137,"bodyForwardEndX":6578.412,"sourceBodyLength":1393.0749999999998,"nozzleExposedLength":773.9307,"provenance":"measured 12-sided tubular source geometry; muzzle is a dark flat source disk, use normal game nozzle"},{"component":153,"mouth":[5185.337,162.5255,1276.9859999999999],"direction":[-1,0,0],"diameter":263.137,"bodyForwardEndX":6578.412,"sourceBodyLength":1393.0749999999998,"nozzleExposedLength":773.9307,"provenance":"measured 12-sided tubular source geometry; muzzle is a dark flat source disk, use normal game nozzle"},{"component":156,"mouth":[5224.033,185.7435,-1509.165],"direction":[-1,0,0],"diameter":263.137,"bodyForwardEndX":6617.108,"sourceBodyLength":1393.0749999999998,"nozzleExposedLength":773.9307,"provenance":"measured 12-sided tubular source geometry; muzzle is a dark flat source disk, use normal game nozzle"},{"component":157,"mouth":[5224.033,185.7435,1509.165],"direction":[-1,0,0],"diameter":263.137,"bodyForwardEndX":6617.108,"sourceBodyLength":1393.0749999999998,"nozzleExposedLength":773.9307,"provenance":"measured 12-sided tubular source geometry; muzzle is a dark flat source disk, use normal game nozzle"},{"component":160,"mouth":[5262.729,201.222,-1741.344],"direction":[-1,0,0],"diameter":263.136,"bodyForwardEndX":6655.805,"sourceBodyLength":1393.076,"nozzleExposedLength":773.9307,"provenance":"measured 12-sided tubular source geometry; muzzle is a dark flat source disk, use normal game nozzle"},{"component":161,"mouth":[5262.729,201.222,1741.344],"direction":[-1,0,0],"diameter":263.136,"bodyForwardEndX":6655.805,"sourceBodyLength":1393.076,"nozzleExposedLength":773.9307,"provenance":"measured 12-sided tubular source geometry; muzzle is a dark flat source disk, use normal game nozzle"}],"bridge":{"asset":"exe_bridge","domes":["exe_sensor_port","exe_sensor_stbd"],"tower":{"c":[5842,1172.5,0],"s":[240,192,155],"note":"stacked fin legs under the bridge, x 5722-5962, |z|<=96, from the city roof (~1099) to the bridge keel (1246)"}},"hull":{"L":19000,"W":5603.258,"H":1000.0,"sec":"warship","plan":"wedge","deckWidth":0,"keelWidth":0,"belt":0.132,"chineHeight":0.587,"bowFree":true,"stations":[[0.000658,0.015616,0.01375,0.349776,0.0,0.0,0.02,0.5],[0.007237,0.171774,0.151249,0.349776,0.0,0.0,0.02,0.5],[0.008553,0.193906,0.170804,0.349362,0.0,0.0,0.02,0.500006],[0.033553,0.226915,0.205961,0.324159,0.0,0.0,0.02,0.502706],[0.034868,0.228652,0.241414,0.306086,0.0,0.0,0.02,0.576752],[0.115132,0.334627,0.345042,0.229787,0.0,0.0,0.02,0.555799],[0.196711,0.442339,0.497544,0.143671,0.0,0.0,0.02,0.557392],[0.203289,0.451026,0.528848,0.127377,0.0,0.0,0.02,0.570936],[0.215132,0.466662,0.562033,0.109647,0.0,0.0,0.083958,0.538502],[0.225658,0.48056,0.56222,0.108555,0.0,0.0,0.209462,0.460037],[0.2375,0.496196,0.569998,0.103548,0.0,0.0,0.278952,0.41363],[0.261184,0.714613,0.627843,0.092641,0.0,0.0,0.112482,0.390908],[0.278289,0.877019,0.554624,0.031181,0.0,0.0,0.021422,0.441108],[0.290132,0.989453,0.497815,-0.02987,0.0,0.0,0.02,0.492472],[0.291447,0.999713,0.708932,-0.144069,0.0,0.0,0.128819,0.586351],[0.495395,0.713928,0.554211,-0.134595,0.0,0.0,0.164782,0.593365],[0.598026,0.570114,0.548496,-0.087566,0.0,0.0,0.166498,0.508596],[0.599342,0.568296,0.541444,-0.083773,0.0,0.0,0.168667,0.501703],[0.601974,0.564726,0.44672,-0.037819,0.0,0.0,0.204432,0.399193],[0.603289,0.562942,0.42474,-0.027533,0.0,0.0,0.215011,0.369759],[0.742763,0.368761,0.259946,-0.03054,0.0,0.0,0.351318,0.298761],[0.761184,0.343066,0.235984,-0.03409,0.0,0.0,0.386991,0.29337],[0.7625,0.341237,0.374123,-0.103804,0.0,0.0,0.244101,0.556006],[0.866447,0.196723,0.274669,-0.104994,0.0,0.0,0.332486,0.580616],[0.917763,0.125381,0.203105,-0.094231,0.0,0.0,0.449639,0.556028],[0.944079,0.088795,0.161899,-0.086345,0.0,0.0,0.564078,0.521582],[0.963816,0.061355,0.128563,-0.079061,0.0,0.0,0.710341,0.470516],[0.970395,0.052209,0.098571,-0.067125,0.0,0.0,0.926482,0.340458],[0.979605,0.039404,0.115811,-0.079911,0.0,0.0,0.788558,0.474612],[0.999474,0.011781,0.108225,-0.083441,0.0,0.0,0.843833,0.505451]],"bowW":0.011781,"bowH":0.108225,"keel":"std"},"trench":{"from":0.2952,"to":0.9848,"height":80,"depth":32,"note":"source trench back walls (rounded boxes) span x 5608-18712 between the upper plate tip (y 462.8) and the lower hull tip (y 371.5)"},"ventralTerraces":[{"y":[706.4,763.4],"m":1,"k":0,"o":[640.0,210.0,640.0,310.0,660.0,310.0,660.0,330.0,780.0,330.0,780.0,350.0,880.0,350.0,880.0,370.0,1080.0,390.0,1080.0,430.0,1320.0,430.0,1320.0,450.0,1440.0,450.0,1440.0,470.0,1560.0,470.0,1560.0,490.0,1660.0,490.0,1660.0,510.0,1760.0,510.0,1760.0,530.0,1880.0,530.0,1880.0,550.0,2000.0,550.0,2000.0,570.0,2060.0,570.0,2060.0,510.0,2000.0,510.0,2000.0,490.0,1900.0,490.0,1900.0,470.0,1800.0,470.0,1800.0,450.0,1720.0,450.0,1720.0,430.0,1620.0,430.0,1620.0,410.0,1540.0,410.0,1540.0,390.0,1400.0,370.0,1400.0,190.0,1080.0,190.0,1080.0,290.0,1020.0,290.0,1020.0,270.0,920.0,270.0,920.0,250.0,820.0,250.0,820.0,230.0,720.0,230.0,720.0,210.0]},{"y":[293.1,461.1],"m":0,"k":0,"o":[3940.0,-370.0,3940.0,-110.0,4180.0,-110.0,4180.0,110.0,3940.0,110.0,3940.0,370.0,4220.0,370.0,4220.0,430.0,4480.0,430.0,4480.0,790.0,4760.0,830.0,4780.0,1190.0,5160.0,1170.0,5160.0,970.0,5080.0,970.0,5080.0,890.0,4940.0,890.0,4940.0,790.0,5300.0,770.0,5300.0,1750.0,5340.0,1750.0,5340.0,2210.0,5460.0,2210.0,5480.0,2150.0,5560.0,2150.0,5560.0,2030.0,5520.0,2030.0,5520.0,1970.0,5580.0,1970.0,5580.0,1890.0,5660.0,1890.0,5660.0,1710.0,5520.0,1710.0,5500.0,830.0,5520.0,690.0,5640.0,690.0,5640.0,610.0,5520.0,610.0,5500.0,70.0,5520.0,-610.0,5640.0,-610.0,5640.0,-690.0,5520.0,-690.0,5500.0,-830.0,5520.0,-1710.0,5660.0,-1710.0,5660.0,-1890.0,5580.0,-1890.0,5580.0,-1970.0,5520.0,-1970.0,5520.0,-2030.0,5560.0,-2030.0,5560.0,-2150.0,5480.0,-2150.0,5460.0,-2210.0,5340.0,-2210.0,5340.0,-1750.0,5300.0,-1750.0,5300.0,-770.0,4940.0,-790.0,4940.0,-890.0,5080.0,-890.0,5080.0,-970.0,5160.0,-970.0,5160.0,-1170.0,4780.0,-1190.0,4760.0,-830.0,4480.0,-790.0,4480.0,-430.0,4220.0,-430.0,4220.0,-370.0]},{"y":[461.8,508.6],"m":1,"k":0,"o":[4020.0,430.0,4020.0,610.0,4040.0,610.0,4060.0,790.0,4100.0,790.0,4100.0,830.0,4280.0,830.0,4280.0,850.0,4300.0,850.0,4300.0,890.0,4340.0,890.0,4340.0,910.0,4360.0,910.0,4360.0,950.0,4440.0,950.0,4420.0,810.0,4380.0,790.0,4380.0,750.0,4360.0,750.0,4340.0,670.0,4320.0,670.0,4320.0,650.0,4240.0,590.0,4240.0,550.0,4220.0,550.0,4200.0,510.0,4160.0,510.0,4160.0,470.0,4120.0,470.0,4120.0,450.0,4080.0,450.0,4080.0,430.0]},{"y":[151.0,220.7],"m":1,"k":0,"o":[6520.0,810.0,6520.0,890.0,7960.0,890.0,7960.0,1090.0,8220.0,1090.0,8220.0,770.0,7960.0,770.0,7960.0,810.0]},{"y":[284.0,328.1],"m":1,"k":0,"o":[6720.0,1850.0,6720.0,1990.0,6740.0,1990.0,6740.0,2010.0,6780.0,2010.0,6800.0,2050.0,6840.0,2050.0,6840.0,2070.0,6920.0,2090.0,6920.0,2110.0,6980.0,2110.0,6980.0,1850.0]},{"y":[185.9,272.3],"m":1,"k":0,"o":[9500.0,690.0,9500.0,1170.0,9760.0,1170.0,9760.0,690.0]},{"y":[333.0,367.8],"m":0,"k":0,"o":[11360.0,-170.0,11400.0,-70.0,11360.0,170.0,11440.0,170.0,11400.0,390.0,11460.0,390.0,11460.0,510.0,11400.0,510.0,11400.0,690.0,11620.0,690.0,11620.0,630.0,11740.0,630.0,11740.0,550.0,11800.0,550.0,11820.0,610.0,11960.0,610.0,11980.0,550.0,12080.0,550.0,12080.0,470.0,12320.0,490.0,12340.0,410.0,12640.0,410.0,12640.0,370.0,12720.0,370.0,12720.0,290.0,12820.0,290.0,12820.0,350.0,13220.0,330.0,13220.0,270.0,13440.0,290.0,13440.0,230.0,13540.0,230.0,13540.0,150.0,13600.0,150.0,13600.0,250.0,13740.0,250.0,13740.0,190.0,13840.0,190.0,13840.0,250.0,13980.0,250.0,13980.0,190.0,14220.0,210.0,14140.0,370.0,13720.0,510.0,13720.0,570.0,14200.0,510.0,14480.0,270.0,14480.0,-270.0,14200.0,-510.0,13980.0,-550.0,13720.0,-570.0,13720.0,-510.0,14140.0,-370.0,14220.0,-210.0,13980.0,-190.0,13980.0,-250.0,13840.0,-250.0,13840.0,-190.0,13740.0,-190.0,13740.0,-250.0,13600.0,-250.0,13600.0,-150.0,13540.0,-150.0,13540.0,-230.0,13440.0,-230.0,13440.0,-290.0,13220.0,-270.0,13220.0,-330.0,12980.0,-310.0,12980.0,-350.0,12820.0,-350.0,12820.0,-290.0,12720.0,-290.0,12720.0,-370.0,12640.0,-370.0,12640.0,-410.0,12340.0,-410.0,12320.0,-490.0,12080.0,-470.0,12080.0,-550.0,11980.0,-550.0,11960.0,-610.0,11820.0,-610.0,11800.0,-550.0,11740.0,-550.0,11740.0,-630.0,11620.0,-630.0,11620.0,-690.0,11400.0,-690.0,11400.0,-510.0,11460.0,-510.0,11460.0,-390.0,11400.0,-390.0,11440.0,-170.0]},{"y":[334.3,381.3],"m":1,"k":0,"o":[11420.0,970.0,11420.0,1210.0,11440.0,1210.0,11440.0,1350.0,11520.0,1350.0,11520.0,1330.0,11800.0,1330.0,11800.0,1310.0,11900.0,1310.0,11900.0,1290.0,12300.0,1290.0,12300.0,1270.0,12420.0,1270.0,12420.0,1250.0,12500.0,1250.0,12500.0,1230.0,12600.0,1230.0,12600.0,1210.0,12700.0,1210.0,12700.0,1190.0,12820.0,1190.0,12820.0,1170.0,13020.0,1150.0,13020.0,1130.0,13120.0,1130.0,13120.0,1110.0,13220.0,1110.0,13220.0,1090.0,13360.0,1090.0,13360.0,1070.0,13620.0,1050.0,13620.0,1030.0,13740.0,1030.0,13740.0,1010.0,13860.0,1010.0,13860.0,990.0,13980.0,990.0,13980.0,970.0,14100.0,970.0,14100.0,950.0,14200.0,950.0,14200.0,930.0,14420.0,910.0,14420.0,890.0,14460.0,890.0,14460.0,810.0,14480.0,810.0,14480.0,590.0,14460.0,590.0,14460.0,510.0,14340.0,510.0,14340.0,530.0,14200.0,530.0,14200.0,550.0,14080.0,550.0,14080.0,570.0,13960.0,570.0,13960.0,590.0,13840.0,590.0,13840.0,610.0,13720.0,610.0,13720.0,630.0,13600.0,630.0,13600.0,650.0,13260.0,670.0,13260.0,690.0,13060.0,690.0,13060.0,710.0,12880.0,710.0,12880.0,730.0,12780.0,730.0,12780.0,750.0,12680.0,750.0,12680.0,770.0,12440.0,790.0,12440.0,810.0,12360.0,810.0,12360.0,830.0,12240.0,830.0,12240.0,850.0,11980.0,870.0,11980.0,890.0,11880.0,890.0,11880.0,910.0,11760.0,910.0,11760.0,930.0,11620.0,930.0,11620.0,950.0,11480.0,950.0,11480.0,970.0]},{"y":[311.9,356.8],"m":0,"k":0,"o":[17060.0,-50.0,17060.0,50.0,17140.0,50.0,17140.0,30.0,18120.0,30.0,18120.0,-30.0,17140.0,-30.0,17140.0,-50.0]},{"y":[359.7,394.1],"m":1,"k":0,"o":[18400.0,50.0,18400.0,110.0,18420.0,110.0,18420.0,130.0,18520.0,110.0,18520.0,50.0,18480.0,50.0,18480.0,30.0,18420.0,30.0,18420.0,50.0]},{"y":[684.1,709.4],"m":1,"k":1,"o":[940.0,270.0,940.0,370.0,980.0,370.0,980.0,390.0,1080.0,390.0,1080.0,430.0,1320.0,430.0,1320.0,450.0,1440.0,450.0,1440.0,470.0,1560.0,470.0,1560.0,490.0,1660.0,490.0,1660.0,510.0,1760.0,510.0,1760.0,530.0,1880.0,530.0,1880.0,550.0,2000.0,550.0,2000.0,570.0,2060.0,570.0,2060.0,510.0,2000.0,510.0,2000.0,490.0,1900.0,490.0,1900.0,470.0,1800.0,470.0,1800.0,450.0,1720.0,450.0,1720.0,430.0,1620.0,430.0,1620.0,410.0,1540.0,410.0,1540.0,390.0,1400.0,370.0,1400.0,190.0,1080.0,190.0,1080.0,290.0]},{"y":[629.8,687.1],"m":1,"k":2,"o":[1080.0,190.0,1080.0,430.0,1400.0,430.0,1400.0,190.0]},{"y":[666.0,687.1],"m":1,"k":2,"o":[1580.0,410.0,1580.0,490.0,1660.0,490.0,1660.0,510.0,1760.0,510.0,1760.0,530.0,1880.0,530.0,1880.0,550.0,2000.0,550.0,2000.0,570.0,2060.0,570.0,2060.0,510.0,2000.0,510.0,2000.0,490.0,1900.0,490.0,1900.0,470.0,1800.0,470.0,1800.0,450.0,1720.0,450.0,1720.0,430.0,1620.0,430.0,1620.0,410.0]},{"y":[434.4,464.8],"m":1,"k":1,"o":[4020.0,430.0,4020.0,590.0,4040.0,590.0,4040.0,630.0,4060.0,630.0,4060.0,650.0,4140.0,710.0,4140.0,750.0,4160.0,750.0,4200.0,810.0,4280.0,830.0,4280.0,850.0,4300.0,850.0,4300.0,890.0,4340.0,890.0,4340.0,910.0,4360.0,910.0,4360.0,950.0,4440.0,950.0,4420.0,810.0,4380.0,790.0,4380.0,750.0,4360.0,750.0,4340.0,670.0,4320.0,670.0,4320.0,650.0,4240.0,590.0,4240.0,550.0,4220.0,550.0,4200.0,510.0,4160.0,510.0,4160.0,470.0,4120.0,470.0,4120.0,450.0,4080.0,450.0,4080.0,430.0]},{"y":[412.2,437.4],"m":1,"k":2,"o":[4020.0,430.0,4020.0,490.0,4060.0,510.0,4060.0,550.0,4100.0,550.0,4100.0,590.0,4160.0,630.0,4160.0,670.0,4200.0,670.0,4200.0,710.0,4260.0,750.0,4260.0,790.0,4280.0,790.0,4280.0,810.0,4300.0,810.0,4300.0,830.0,4320.0,830.0,4320.0,850.0,4400.0,910.0,4400.0,950.0,4440.0,950.0,4420.0,810.0,4380.0,790.0,4380.0,750.0,4360.0,750.0,4340.0,670.0,4320.0,670.0,4320.0,650.0,4240.0,590.0,4240.0,550.0,4220.0,550.0,4200.0,510.0,4160.0,510.0,4160.0,470.0,4120.0,470.0,4120.0,450.0,4080.0,450.0,4080.0,430.0]},{"y":[306.2,336.0],"m":0,"k":1,"o":[11360.0,-170.0,11360.0,-110.0,11400.0,-70.0,11400.0,70.0,11360.0,110.0,11360.0,170.0,11440.0,170.0,11400.0,390.0,11460.0,390.0,11460.0,510.0,11400.0,510.0,11400.0,690.0,11620.0,690.0,11620.0,630.0,11740.0,630.0,11740.0,550.0,11800.0,550.0,11820.0,610.0,11960.0,610.0,11980.0,550.0,12080.0,550.0,12080.0,470.0,12320.0,490.0,12340.0,410.0,12640.0,410.0,12640.0,370.0,12720.0,370.0,12720.0,290.0,12820.0,290.0,12820.0,350.0,12980.0,350.0,12980.0,310.0,13220.0,330.0,13220.0,270.0,13440.0,290.0,13440.0,230.0,13540.0,230.0,13540.0,150.0,13600.0,150.0,13600.0,250.0,13740.0,250.0,13740.0,190.0,13840.0,190.0,13840.0,250.0,13980.0,250.0,13980.0,190.0,14200.0,210.0,14200.0,170.0,14280.0,170.0,14280.0,110.0,14340.0,110.0,14340.0,-110.0,14280.0,-110.0,14280.0,-170.0,14200.0,-170.0,14200.0,-210.0,13980.0,-190.0,13980.0,-250.0,13840.0,-250.0,13840.0,-190.0,13740.0,-190.0,13740.0,-250.0,13600.0,-250.0,13600.0,-150.0,13540.0,-150.0,13540.0,-230.0,13440.0,-230.0,13440.0,-290.0,13220.0,-270.0,13220.0,-330.0,12980.0,-310.0,12980.0,-350.0,12820.0,-350.0,12820.0,-290.0,12720.0,-290.0,12720.0,-370.0,12640.0,-370.0,12640.0,-410.0,12340.0,-410.0,12320.0,-490.0,12080.0,-470.0,12080.0,-550.0,11980.0,-550.0,11960.0,-610.0,11820.0,-610.0,11800.0,-550.0,11740.0,-550.0,11740.0,-630.0,11620.0,-630.0,11620.0,-690.0,11400.0,-690.0,11400.0,-510.0,11460.0,-510.0,11460.0,-390.0,11400.0,-390.0,11440.0,-170.0]},{"y":[311.9,337.3],"m":1,"k":1,"o":[11420.0,970.0,11420.0,1210.0,11440.0,1210.0,11440.0,1250.0,11460.0,1250.0,11460.0,1230.0,11600.0,1230.0,11600.0,1210.0,11760.0,1210.0,11760.0,1190.0,11960.0,1190.0,11960.0,1170.0,12140.0,1170.0,12140.0,1150.0,12300.0,1150.0,12300.0,1130.0,12460.0,1130.0,12460.0,1110.0,12820.0,1090.0,12820.0,1070.0,13040.0,1050.0,13040.0,1030.0,13120.0,1030.0,13120.0,1010.0,13240.0,1010.0,13240.0,990.0,13320.0,990.0,13320.0,970.0,13400.0,970.0,13400.0,950.0,13520.0,950.0,13520.0,930.0,13620.0,930.0,13620.0,910.0,13720.0,910.0,13720.0,890.0,13820.0,890.0,13820.0,870.0,13920.0,870.0,13920.0,850.0,14020.0,850.0,14020.0,830.0,14120.0,830.0,14120.0,810.0,14220.0,810.0,14220.0,790.0,14320.0,790.0,14320.0,770.0,14480.0,750.0,14480.0,590.0,14460.0,590.0,14460.0,610.0,14260.0,610.0,14260.0,630.0,14040.0,630.0,14040.0,650.0,13620.0,670.0,13620.0,690.0,13060.0,690.0,13060.0,710.0,12880.0,710.0,12880.0,730.0,12780.0,730.0,12780.0,750.0,12680.0,750.0,12680.0,770.0,12440.0,790.0,12440.0,810.0,12360.0,810.0,12360.0,830.0,12240.0,830.0,12240.0,850.0,11980.0,870.0,11980.0,890.0,11880.0,890.0,11880.0,910.0,11760.0,910.0,11760.0,930.0,11620.0,930.0,11620.0,950.0,11480.0,950.0,11480.0,970.0]},{"y":[252.6,336.0],"m":0,"k":1,"o":[14460.0,-270.0,14460.0,270.0,14480.0,270.0,14480.0,-270.0]},{"y":[280.5,309.2],"m":0,"k":2,"o":[11360.0,-170.0,11360.0,-110.0,11400.0,-70.0,11400.0,70.0,11360.0,110.0,11360.0,170.0,11440.0,170.0,11440.0,250.0,11400.0,290.0,11400.0,390.0,11460.0,390.0,11460.0,510.0,11400.0,510.0,11400.0,690.0,11620.0,690.0,11620.0,630.0,11740.0,630.0,11740.0,550.0,11800.0,550.0,11820.0,610.0,11960.0,610.0,11980.0,550.0,12080.0,550.0,12080.0,470.0,12320.0,490.0,12340.0,410.0,12640.0,410.0,12640.0,370.0,12720.0,370.0,12720.0,290.0,12820.0,290.0,12820.0,350.0,12980.0,350.0,12980.0,310.0,13220.0,330.0,13220.0,270.0,13440.0,290.0,13440.0,230.0,13540.0,230.0,13540.0,150.0,13600.0,150.0,13600.0,250.0,13740.0,250.0,13740.0,190.0,13840.0,190.0,13840.0,250.0,13980.0,250.0,13980.0,190.0,14080.0,190.0,14080.0,50.0,13900.0,50.0,13900.0,-50.0,14080.0,-50.0,14080.0,-190.0,13980.0,-190.0,13980.0,-250.0,13840.0,-250.0,13840.0,-190.0,13740.0,-190.0,13740.0,-250.0,13600.0,-250.0,13600.0,-150.0,13540.0,-150.0,13540.0,-230.0,13440.0,-230.0,13440.0,-290.0,13220.0,-270.0,13220.0,-330.0,12980.0,-310.0,12980.0,-350.0,12820.0,-350.0,12820.0,-290.0,12720.0,-290.0,12720.0,-370.0,12640.0,-370.0,12640.0,-410.0,12340.0,-410.0,12320.0,-490.0,12080.0,-470.0,12080.0,-550.0,11980.0,-550.0,11960.0,-610.0,11820.0,-610.0,11800.0,-550.0,11740.0,-550.0,11740.0,-630.0,11620.0,-630.0,11620.0,-690.0,11400.0,-690.0,11400.0,-510.0,11460.0,-510.0,11460.0,-390.0,11400.0,-390.0,11400.0,-290.0,11440.0,-250.0,11440.0,-170.0]},{"y":[286.1,314.9],"m":0,"k":1,"o":[17060.0,-50.0,17060.0,50.0,17140.0,50.0,17140.0,30.0,17640.0,30.0,17640.0,10.0,17720.0,10.0,17720.0,-10.0,17640.0,-10.0,17640.0,-30.0,17140.0,-30.0,17140.0,-50.0]},{"y":[270.9,296.1],"m":0,"k":1,"o":[3940.0,-370.0,3940.0,-110.0,4180.0,-110.0,4180.0,110.0,3940.0,110.0,3940.0,370.0,4220.0,370.0,4220.0,430.0,4580.0,410.0,4620.0,810.0,4760.0,830.0,4780.0,1190.0,5160.0,1170.0,5160.0,970.0,5080.0,970.0,5080.0,890.0,4940.0,890.0,4940.0,790.0,5060.0,790.0,5060.0,590.0,4940.0,570.0,4940.0,510.0,5280.0,490.0,5280.0,610.0,5320.0,610.0,5300.0,1750.0,5340.0,1750.0,5340.0,2210.0,5460.0,2210.0,5480.0,2150.0,5560.0,2150.0,5560.0,2030.0,5520.0,2030.0,5520.0,1970.0,5580.0,1970.0,5580.0,1890.0,5660.0,1890.0,5660.0,1710.0,5520.0,1710.0,5500.0,830.0,5520.0,690.0,5640.0,690.0,5640.0,610.0,5520.0,610.0,5500.0,70.0,5520.0,-610.0,5640.0,-610.0,5640.0,-690.0,5520.0,-690.0,5500.0,-830.0,5520.0,-1710.0,5660.0,-1710.0,5660.0,-1890.0,5580.0,-1890.0,5580.0,-1970.0,5520.0,-1970.0,5520.0,-2030.0,5560.0,-2030.0,5560.0,-2150.0,5480.0,-2150.0,5460.0,-2210.0,5340.0,-2210.0,5340.0,-1750.0,5300.0,-1750.0,5320.0,-610.0,5280.0,-610.0,5280.0,-490.0,4940.0,-510.0,4940.0,-570.0,5060.0,-590.0,5060.0,-790.0,4940.0,-790.0,4940.0,-890.0,5080.0,-890.0,5080.0,-970.0,5160.0,-970.0,5160.0,-1170.0,4780.0,-1190.0,4760.0,-830.0,4620.0,-810.0,4580.0,-410.0,4220.0,-430.0,4220.0,-370.0]},{"y":[264.0,287.0],"m":1,"k":1,"o":[6720.0,1850.0,6720.0,1970.0,6980.0,1970.0,6980.0,1850.0]},{"y":[257.3,283.5],"m":0,"k":3,"o":[11360.0,-170.0,11360.0,-110.0,11400.0,-70.0,11400.0,70.0,11360.0,110.0,11360.0,170.0,11440.0,170.0,11440.0,250.0,11400.0,290.0,11400.0,390.0,11460.0,390.0,11460.0,510.0,11400.0,510.0,11400.0,690.0,11620.0,690.0,11620.0,630.0,11740.0,630.0,11740.0,550.0,11800.0,550.0,11820.0,610.0,11960.0,610.0,11980.0,550.0,12080.0,550.0,12080.0,470.0,12320.0,490.0,12340.0,410.0,12640.0,410.0,12640.0,370.0,12720.0,370.0,12720.0,270.0,12820.0,270.0,12820.0,350.0,12980.0,350.0,12980.0,310.0,13220.0,330.0,13220.0,270.0,13440.0,290.0,13440.0,230.0,13540.0,230.0,13540.0,150.0,13620.0,150.0,13620.0,-150.0,13540.0,-150.0,13540.0,-230.0,13440.0,-230.0,13440.0,-290.0,13220.0,-270.0,13220.0,-330.0,12980.0,-310.0,12980.0,-350.0,12820.0,-350.0,12820.0,-270.0,12720.0,-270.0,12720.0,-370.0,12640.0,-370.0,12640.0,-410.0,12340.0,-410.0,12320.0,-490.0,12080.0,-470.0,12080.0,-550.0,11980.0,-550.0,11960.0,-610.0,11820.0,-610.0,11800.0,-550.0,11740.0,-550.0,11740.0,-630.0,11620.0,-630.0,11620.0,-690.0,11400.0,-690.0,11400.0,-510.0,11460.0,-510.0,11460.0,-390.0,11400.0,-390.0,11400.0,-290.0,11440.0,-250.0,11440.0,-170.0]},{"y":[265.0,283.5],"m":1,"k":3,"o":[13700.0,50.0,13700.0,190.0,13840.0,190.0,13840.0,50.0]},{"y":[273.5,289.1],"m":0,"k":2,"o":[17060.0,-30.0,17060.0,30.0,17160.0,30.0,17160.0,10.0,17220.0,10.0,17220.0,-10.0,17160.0,-10.0,17160.0,-30.0]},{"y":[204.3,273.9],"m":0,"k":2,"o":[3940.0,-370.0,3940.0,-110.0,4180.0,-110.0,4180.0,110.0,3940.0,110.0,3940.0,370.0,4220.0,370.0,4220.0,430.0,4580.0,410.0,4580.0,610.0,4620.0,610.0,4620.0,810.0,4640.0,830.0,4760.0,830.0,4780.0,1190.0,5160.0,1170.0,5160.0,970.0,5080.0,970.0,5080.0,890.0,4940.0,890.0,4940.0,790.0,5060.0,790.0,5060.0,590.0,5040.0,570.0,4940.0,570.0,4940.0,510.0,5280.0,490.0,5280.0,610.0,5320.0,610.0,5300.0,1450.0,5480.0,1450.0,5500.0,1370.0,5520.0,1370.0,5520.0,890.0,5500.0,890.0,5520.0,690.0,5640.0,690.0,5640.0,610.0,5520.0,610.0,5520.0,70.0,5500.0,70.0,5500.0,-70.0,5520.0,-70.0,5520.0,-610.0,5640.0,-610.0,5640.0,-690.0,5520.0,-690.0,5520.0,-830.0,5500.0,-830.0,5500.0,-890.0,5520.0,-890.0,5520.0,-1370.0,5500.0,-1370.0,5500.0,-1430.0,5480.0,-1450.0,5300.0,-1450.0,5320.0,-610.0,5280.0,-610.0,5280.0,-490.0,4940.0,-510.0,4940.0,-570.0,5040.0,-570.0,5060.0,-590.0,5060.0,-790.0,4940.0,-790.0,4940.0,-890.0,5080.0,-890.0,5080.0,-970.0,5160.0,-970.0,5160.0,-1170.0,4780.0,-1190.0,4760.0,-830.0,4640.0,-830.0,4620.0,-810.0,4620.0,-610.0,4580.0,-610.0,4580.0,-410.0,4220.0,-430.0,4220.0,-370.0]},{"y":[229.6,273.9],"m":1,"k":2,"o":[5300.0,1550.0,5300.0,1750.0,5340.0,1750.0,5340.0,1850.0,5320.0,1850.0,5320.0,2010.0,5480.0,2010.0,5480.0,1970.0,5580.0,1970.0,5580.0,1890.0,5660.0,1890.0,5660.0,1710.0,5520.0,1710.0,5520.0,1490.0,5420.0,1490.0,5420.0,1550.0]},{"y":[243.0,273.9],"m":1,"k":2,"o":[5420.0,2030.0,5420.0,2150.0,5560.0,2150.0,5560.0,2030.0]},{"y":[232.8,260.3],"m":0,"k":4,"o":[11360.0,-170.0,11360.0,-110.0,11380.0,-110.0,11380.0,-70.0,11400.0,-70.0,11400.0,70.0,11380.0,70.0,11380.0,110.0,11360.0,110.0,11360.0,170.0,11440.0,170.0,11440.0,250.0,11420.0,250.0,11420.0,290.0,11400.0,290.0,11400.0,390.0,11460.0,390.0,11460.0,510.0,11400.0,510.0,11400.0,690.0,11620.0,690.0,11620.0,630.0,11740.0,630.0,11740.0,550.0,11800.0,550.0,11800.0,590.0,11820.0,590.0,11820.0,610.0,11960.0,610.0,11960.0,590.0,11980.0,590.0,11980.0,550.0,12080.0,550.0,12080.0,470.0,12160.0,470.0,12160.0,490.0,12320.0,490.0,12320.0,470.0,12340.0,470.0,12340.0,410.0,12440.0,410.0,12440.0,290.0,12560.0,290.0,12560.0,250.0,12660.0,250.0,12660.0,90.0,12500.0,90.0,12500.0,130.0,12420.0,130.0,12420.0,-130.0,12500.0,-130.0,12500.0,-90.0,12660.0,-90.0,12660.0,-250.0,12560.0,-250.0,12560.0,-290.0,12440.0,-290.0,12440.0,-410.0,12340.0,-410.0,12340.0,-470.0,12320.0,-470.0,12320.0,-490.0,12160.0,-490.0,12160.0,-470.0,12080.0,-470.0,12080.0,-550.0,11980.0,-550.0,11980.0,-590.0,11960.0,-590.0,11960.0,-610.0,11820.0,-610.0,11820.0,-590.0,11800.0,-590.0,11800.0,-550.0,11740.0,-550.0,11740.0,-630.0,11620.0,-630.0,11620.0,-690.0,11400.0,-690.0,11400.0,-510.0,11460.0,-510.0,11460.0,-390.0,11400.0,-390.0,11400.0,-290.0,11420.0,-290.0,11420.0,-250.0,11440.0,-250.0,11440.0,-170.0]},{"y":[239.2,260.3],"m":1,"k":4,"o":[12760.0,70.0,12760.0,210.0,12780.0,210.0,12780.0,230.0,12820.0,230.0,12820.0,350.0,12980.0,350.0,12980.0,310.0,13040.0,310.0,13040.0,330.0,13220.0,330.0,13220.0,270.0,13320.0,270.0,13320.0,110.0,13160.0,110.0,13160.0,170.0,13080.0,170.0,13080.0,150.0,12920.0,150.0,12920.0,70.0]},{"y":[240.5,260.3],"m":1,"k":4,"o":[13380.0,70.0,13380.0,230.0,13540.0,230.0,13540.0,70.0]},{"y":[239.1,255.6],"m":0,"k":2,"o":[14460.0,-250.0,14460.0,250.0,14480.0,250.0,14480.0,-250.0]},{"y":[212.5,232.6],"m":1,"k":3,"o":[5320.0,1850.0,5320.0,2010.0,5480.0,2010.0,5480.0,1970.0,5580.0,1970.0,5580.0,1890.0,5660.0,1890.0,5660.0,1710.0,5340.0,1690.0,5340.0,1850.0]},{"y":[212.1,235.8],"m":0,"k":5,"o":[11360.0,-170.0,11360.0,-110.0,11380.0,-110.0,11380.0,-70.0,11400.0,-70.0,11400.0,70.0,11380.0,70.0,11380.0,110.0,11360.0,110.0,11360.0,170.0,11440.0,170.0,11440.0,250.0,11420.0,250.0,11420.0,290.0,11400.0,290.0,11400.0,390.0,11540.0,390.0,11540.0,350.0,11620.0,350.0,11620.0,410.0,11780.0,410.0,11780.0,370.0,11860.0,370.0,11860.0,290.0,11920.0,290.0,11920.0,550.0,12080.0,550.0,12080.0,350.0,12140.0,350.0,12140.0,170.0,12380.0,170.0,12380.0,-170.0,12140.0,-170.0,12140.0,-350.0,12080.0,-350.0,12080.0,-550.0,11920.0,-550.0,11920.0,-290.0,11860.0,-290.0,11860.0,-370.0,11780.0,-370.0,11780.0,-410.0,11620.0,-410.0,11620.0,-350.0,11540.0,-350.0,11540.0,-390.0,11400.0,-390.0,11400.0,-290.0,11420.0,-290.0,11420.0,-250.0,11440.0,-250.0,11440.0,-170.0]},{"y":[212.4,235.8],"m":1,"k":5,"o":[11440.0,510.0,11440.0,690.0,11620.0,690.0,11620.0,630.0,11740.0,630.0,11740.0,450.0,11560.0,450.0,11560.0,510.0]},{"y":[187.3,207.3],"m":0,"k":3,"o":[3940.0,-350.0,3940.0,-110.0,4180.0,-110.0,4180.0,110.0,3940.0,110.0,3940.0,350.0,4220.0,350.0,4220.0,430.0,4580.0,410.0,4580.0,610.0,4620.0,610.0,4620.0,810.0,4640.0,830.0,4760.0,830.0,4760.0,1010.0,4880.0,1010.0,4880.0,1090.0,4980.0,1090.0,4980.0,1170.0,5160.0,1170.0,5160.0,970.0,5080.0,970.0,5080.0,890.0,4940.0,890.0,4940.0,790.0,5060.0,790.0,5060.0,590.0,5040.0,570.0,4940.0,570.0,4940.0,510.0,5280.0,490.0,5280.0,610.0,5320.0,610.0,5320.0,810.0,5300.0,810.0,5320.0,1190.0,5420.0,1190.0,5420.0,1370.0,5520.0,1370.0,5520.0,890.0,5500.0,890.0,5520.0,690.0,5640.0,690.0,5640.0,610.0,5520.0,610.0,5520.0,70.0,5500.0,70.0,5500.0,-70.0,5520.0,-70.0,5520.0,-610.0,5640.0,-610.0,5640.0,-690.0,5520.0,-690.0,5520.0,-830.0,5500.0,-830.0,5500.0,-890.0,5520.0,-890.0,5520.0,-1370.0,5420.0,-1370.0,5420.0,-1190.0,5320.0,-1190.0,5320.0,-1010.0,5300.0,-1010.0,5320.0,-610.0,5280.0,-610.0,5280.0,-490.0,4940.0,-510.0,4940.0,-570.0,5040.0,-570.0,5060.0,-590.0,5060.0,-790.0,4940.0,-790.0,4940.0,-890.0,5080.0,-890.0,5080.0,-970.0,5160.0,-970.0,5160.0,-1170.0,4980.0,-1170.0,4980.0,-1090.0,4880.0,-1090.0,4880.0,-1010.0,4760.0,-1010.0,4760.0,-830.0,4640.0,-830.0,4620.0,-810.0,4620.0,-610.0,4580.0,-610.0,4580.0,-410.0,4220.0,-430.0,4220.0,-350.0]},{"y":[181.9,215.5],"m":1,"k":4,"o":[5320.0,1850.0,5320.0,2010.0,5480.0,2010.0,5480.0,1970.0,5580.0,1970.0,5580.0,1790.0,5420.0,1790.0,5420.0,1850.0]},{"y":[187.3,215.1],"m":0,"k":6,"o":[11360.0,-170.0,11360.0,-110.0,11380.0,-110.0,11380.0,-70.0,11400.0,-70.0,11400.0,70.0,11380.0,70.0,11380.0,110.0,11360.0,110.0,11360.0,170.0,12200.0,170.0,12200.0,-170.0]},{"y":[196.6,215.1],"m":1,"k":6,"o":[11480.0,210.0,11480.0,350.0,11620.0,350.0,11620.0,210.0]},{"y":[199.4,215.4],"m":1,"k":6,"o":[11560.0,450.0,11560.0,630.0,11740.0,630.0,11740.0,450.0]},{"y":[190.9,215.1],"m":1,"k":6,"o":[11720.0,210.0,11720.0,370.0,11860.0,370.0,11860.0,210.0]},{"y":[159.4,190.3],"m":0,"k":4,"o":[3940.0,-350.0,3940.0,-110.0,4180.0,-110.0,4180.0,110.0,3940.0,110.0,3940.0,350.0,4220.0,350.0,4220.0,430.0,4460.0,430.0,4460.0,410.0,4580.0,410.0,4580.0,610.0,4620.0,610.0,4620.0,810.0,4640.0,810.0,4640.0,830.0,4760.0,830.0,4760.0,1010.0,4880.0,1010.0,4880.0,1090.0,5060.0,1090.0,5060.0,1070.0,5080.0,1070.0,5080.0,890.0,4940.0,890.0,4940.0,790.0,5060.0,790.0,5060.0,590.0,5040.0,590.0,5040.0,570.0,4940.0,570.0,4940.0,510.0,5280.0,490.0,5280.0,610.0,5320.0,610.0,5320.0,810.0,5300.0,810.0,5320.0,1190.0,5520.0,1190.0,5520.0,890.0,5500.0,890.0,5500.0,830.0,5520.0,830.0,5520.0,690.0,5640.0,690.0,5640.0,610.0,5520.0,610.0,5520.0,70.0,5500.0,70.0,5500.0,-70.0,5520.0,-70.0,5520.0,-610.0,5640.0,-610.0,5640.0,-690.0,5520.0,-690.0,5520.0,-830.0,5500.0,-830.0,5500.0,-890.0,5520.0,-890.0,5520.0,-1190.0,5320.0,-1190.0,5320.0,-1010.0,5300.0,-1010.0,5320.0,-610.0,5280.0,-610.0,5280.0,-490.0,4940.0,-510.0,4940.0,-570.0,5040.0,-570.0,5040.0,-590.0,5060.0,-590.0,5060.0,-790.0,4940.0,-790.0,4940.0,-890.0,5080.0,-890.0,5080.0,-1070.0,5060.0,-1070.0,5060.0,-1090.0,4880.0,-1090.0,4880.0,-1010.0,4760.0,-1010.0,4760.0,-830.0,4640.0,-830.0,4640.0,-810.0,4620.0,-810.0,4620.0,-610.0,4580.0,-610.0,4580.0,-410.0,4460.0,-410.0,4460.0,-430.0,4220.0,-430.0,4220.0,-350.0]},{"y":[163.2,188.9],"m":1,"k":1,"o":[9500.0,690.0,9500.0,970.0,9520.0,970.0,9520.0,990.0,9760.0,990.0,9760.0,690.0]},{"y":[162.2,190.3],"m":0,"k":7,"o":[11360.0,-170.0,11360.0,-110.0,11380.0,-110.0,11380.0,-70.0,11400.0,-70.0,11400.0,70.0,11380.0,70.0,11380.0,110.0,11360.0,110.0,11360.0,170.0,11860.0,170.0,11860.0,-170.0]},{"y":[144.8,162.4],"m":0,"k":5,"o":[3940.0,-350.0,3940.0,-130.0,4180.0,-130.0,4180.0,130.0,3940.0,130.0,3940.0,350.0,4220.0,350.0,4220.0,430.0,4460.0,430.0,4460.0,410.0,4580.0,410.0,4580.0,610.0,4720.0,610.0,4720.0,690.0,4820.0,690.0,4820.0,790.0,5060.0,790.0,5060.0,590.0,5040.0,590.0,5040.0,570.0,4940.0,570.0,4940.0,510.0,5280.0,490.0,5280.0,610.0,5320.0,610.0,5300.0,1010.0,5420.0,1010.0,5420.0,1070.0,5440.0,1070.0,5440.0,1090.0,5520.0,1090.0,5520.0,890.0,5500.0,890.0,5500.0,830.0,5520.0,830.0,5520.0,690.0,5640.0,690.0,5640.0,610.0,5520.0,610.0,5520.0,70.0,5500.0,70.0,5500.0,-70.0,5520.0,-70.0,5520.0,-610.0,5640.0,-610.0,5640.0,-690.0,5520.0,-690.0,5520.0,-830.0,5500.0,-830.0,5500.0,-890.0,5520.0,-890.0,5520.0,-1090.0,5440.0,-1090.0,5440.0,-1070.0,5420.0,-1070.0,5420.0,-1010.0,5300.0,-1010.0,5320.0,-610.0,5280.0,-610.0,5280.0,-490.0,4940.0,-510.0,4940.0,-570.0,5040.0,-570.0,5040.0,-590.0,5060.0,-590.0,5060.0,-790.0,4820.0,-790.0,4820.0,-690.0,4720.0,-690.0,4720.0,-610.0,4580.0,-610.0,4580.0,-410.0,4460.0,-410.0,4460.0,-430.0,4220.0,-430.0,4220.0,-350.0]},{"y":[137.4,154.0],"m":1,"k":1,"o":[6520.0,810.0,6520.0,890.0,7920.0,890.0,7920.0,870.0,7940.0,870.0,7940.0,830.0,7920.0,830.0,7920.0,810.0]},{"y":[137.1,154.0],"m":1,"k":1,"o":[7960.0,770.0,7960.0,1090.0,8200.0,1090.0,8200.0,1070.0,8220.0,1070.0,8220.0,770.0]},{"y":[143.4,166.2],"m":1,"k":2,"o":[9500.0,690.0,9500.0,790.0,9760.0,790.0,9760.0,690.0]},{"y":[144.6,165.2],"m":0,"k":8,"o":[11360.0,-170.0,11360.0,-110.0,11380.0,-110.0,11380.0,-70.0,11400.0,-70.0,11400.0,70.0,11380.0,70.0,11380.0,110.0,11360.0,110.0,11360.0,170.0,11540.0,170.0,11540.0,-170.0]},{"y":[114.5,147.8],"m":0,"k":6,"o":[4180.0,-190.0,4180.0,190.0,4220.0,190.0,4220.0,430.0,4460.0,430.0,4460.0,410.0,4580.0,410.0,4580.0,610.0,4720.0,610.0,4720.0,690.0,4940.0,690.0,4940.0,510.0,5280.0,490.0,5280.0,610.0,5320.0,610.0,5320.0,830.0,5520.0,830.0,5520.0,690.0,5640.0,690.0,5640.0,610.0,5520.0,610.0,5520.0,70.0,5500.0,70.0,5500.0,-70.0,5520.0,-70.0,5520.0,-610.0,5640.0,-610.0,5640.0,-690.0,5520.0,-690.0,5520.0,-830.0,5320.0,-830.0,5320.0,-610.0,5280.0,-610.0,5280.0,-490.0,4940.0,-510.0,4940.0,-690.0,4720.0,-690.0,4720.0,-610.0,4580.0,-610.0,4580.0,-410.0,4460.0,-410.0,4460.0,-430.0,4220.0,-430.0,4220.0,-190.0]},{"y":[112.0,140.4],"m":1,"k":2,"o":[6520.0,810.0,6520.0,890.0,7220.0,890.0,7220.0,870.0,7240.0,870.0,7240.0,830.0,7180.0,830.0,7180.0,810.0]},{"y":[111.6,140.1],"m":1,"k":2,"o":[7960.0,770.0,7960.0,950.0,8220.0,950.0,8220.0,770.0]},{"y":[96.9,117.5],"m":0,"k":7,"o":[4180.0,-190.0,4180.0,190.0,4340.0,190.0,4340.0,290.0,4460.0,290.0,4460.0,390.0,4480.0,390.0,4480.0,410.0,4680.0,410.0,4680.0,390.0,4700.0,390.0,4700.0,170.0,4680.0,170.0,4680.0,150.0,4580.0,150.0,4580.0,50.0,4560.0,50.0,4560.0,30.0,4420.0,30.0,4420.0,-30.0,4560.0,-30.0,4560.0,-50.0,4580.0,-50.0,4580.0,-150.0,4680.0,-150.0,4680.0,-170.0,4700.0,-170.0,4700.0,-390.0,4680.0,-390.0,4680.0,-410.0,4480.0,-410.0,4480.0,-390.0,4460.0,-390.0,4460.0,-290.0,4340.0,-290.0,4340.0,-190.0]},{"y":[83.6,117.5],"m":0,"k":7,"o":[4800.0,-270.0,4800.0,-30.0,5040.0,-30.0,5040.0,-110.0,5180.0,-110.0,5180.0,-130.0,5200.0,-130.0,5200.0,-230.0,5280.0,-230.0,5280.0,230.0,5200.0,230.0,5200.0,130.0,5180.0,130.0,5180.0,110.0,5040.0,110.0,5040.0,30.0,4800.0,30.0,4800.0,270.0,4840.0,270.0,4840.0,510.0,5280.0,490.0,5280.0,610.0,5420.0,610.0,5420.0,690.0,5640.0,690.0,5640.0,610.0,5520.0,610.0,5520.0,70.0,5500.0,70.0,5500.0,-70.0,5520.0,-70.0,5520.0,-610.0,5640.0,-610.0,5640.0,-690.0,5420.0,-690.0,5420.0,-610.0,5280.0,-610.0,5280.0,-490.0,4840.0,-510.0,4840.0,-270.0]},{"y":[95.8,114.6],"m":1,"k":3,"o":[7960.0,770.0,7960.0,810.0,7980.0,810.0,7980.0,830.0,8200.0,830.0,8200.0,810.0,8220.0,810.0,8220.0,770.0]},{"y":[61.6,99.9],"m":1,"k":8,"o":[4340.0,50.0,4340.0,290.0,4560.0,290.0,4560.0,270.0,4580.0,270.0,4580.0,50.0,4560.0,50.0,4560.0,30.0,4360.0,30.0,4360.0,50.0]},{"y":[56.0,86.6],"m":0,"k":8,"o":[4800.0,-270.0,4800.0,-30.0,5040.0,-30.0,5040.0,-110.0,5180.0,-110.0,5180.0,-130.0,5200.0,-130.0,5200.0,-230.0,5280.0,-230.0,5280.0,230.0,5200.0,230.0,5200.0,130.0,5180.0,130.0,5180.0,110.0,5040.0,110.0,5040.0,30.0,4800.0,30.0,4800.0,270.0,4960.0,270.0,4960.0,350.0,4980.0,350.0,4980.0,370.0,5080.0,370.0,5080.0,470.0,5100.0,470.0,5100.0,490.0,5300.0,490.0,5300.0,470.0,5320.0,470.0,5320.0,230.0,5420.0,230.0,5420.0,290.0,5440.0,290.0,5440.0,310.0,5520.0,310.0,5520.0,70.0,5500.0,70.0,5500.0,-70.0,5520.0,-70.0,5520.0,-310.0,5440.0,-310.0,5440.0,-290.0,5420.0,-290.0,5420.0,-230.0,5320.0,-230.0,5320.0,-470.0,5300.0,-470.0,5300.0,-490.0,5100.0,-490.0,5100.0,-470.0,5080.0,-470.0,5080.0,-370.0,4980.0,-370.0,4980.0,-350.0,4960.0,-350.0,4960.0,-270.0]},{"y":[67.3,86.6],"m":1,"k":8,"o":[5420.0,470.0,5420.0,690.0,5640.0,690.0,5640.0,610.0,5520.0,610.0,5520.0,470.0]},{"y":[38.4,59.0],"m":1,"k":9,"o":[4960.0,130.0,4960.0,350.0,4980.0,350.0,4980.0,370.0,5180.0,370.0,5180.0,350.0,5200.0,350.0,5200.0,130.0,5180.0,130.0,5180.0,110.0,4980.0,110.0,4980.0,130.0]},{"y":[44.9,59.0],"m":0,"k":9,"o":[5280.0,-230.0,5280.0,230.0,5420.0,230.0,5420.0,290.0,5440.0,290.0,5440.0,310.0,5520.0,310.0,5520.0,70.0,5500.0,70.0,5500.0,-70.0,5520.0,-70.0,5520.0,-310.0,5440.0,-310.0,5440.0,-290.0,5420.0,-290.0,5420.0,-230.0]}],"measured":"Hull stations, trench, city and ventral terraces re-measured in v12.18 from the source mesh: 25 m terrace levels traced from a 20 m heightmap."};

// Construction examples: every hull/terrace is a normal editable solid. Only
// independently reusable fittings use source model geometry.
const DREADNOUGHT_EXAMPLES={
 imperial2:{name:'インペリアルII級',length:1600,author:'Daniel',source:'https://sketchfab.com/3d-models/star-wars-imperial-ii-star-destroyer-b8bd2d35f7604670ab85242c06c6d280',note:'八連装主砲8基・補助重砲13基・左右トレンチ砲。航空隊は格納区画の実容積に従い、主機は旧作例の物理寸法を保持します。船体・段状甲板は通常部品、艦橋は既存ISD本体です。'},
 executor:{name:'エグゼクター級',length:19000,author:'Admiral_Forever',source:'https://sketchfab.com/3d-models/star-wars-executor-super-star-destroyer-df018bc2cecc4a5182fde06ddc9b1496',note:'船体断面・舷側トレンチ・都市段丘・腹部構造と13基の機関を原型モデルから実測して構成。艦橋本体と標的追跡ドームは原型の形状です。左右の上下甲板・中央・トレンチを武装化。搭載機は50個飛行隊・3,600機、主機クラス2.0、出力はインペリアル級200隻分。'}
};
// Keep the old ISD-II builder and model provenance available to saved designs;
// only the Executor remains in the public example catalog.
DESIGNS.executor={name:DREADNOUGHT_EXAMPLES.executor.name,hull:{L:DREADNOUGHT_EXAMPLES.executor.length}};
{
 const a=REFERENCE_ASSETS.isd2_octuple;
 Object.assign(FITS.oct40,{name:'8連装重ターボレーザー',asset:'isd2_octuple',fm:a.size[0],wm:a.size[2],hm:a.size[1],r:Math.max(a.size[0],a.size[2])/2,source:STATS_SOURCE,evidence:'指定表 Ships!S34',desc:'8門×40 TT。独立した砲塔・旋回台・装甲囲い。上面・下面・トレンチ壁へ取り付けられます。'});
}
if(REFERENCE_ASSETS.isd2_casemate){const a=REFERENCE_ASSETS.isd2_casemate;FITS.casemate40={...FITS.oct40,key:'casemate40',name:'八連装ケースメイト重砲',short:'舷側ケースメイト砲',asset:'isd2_casemate',casemate:true,r:Math.max(a.size[1],a.size[2])/2,fm:a.size[0],wm:a.size[2],hm:a.size[1],desc:'8門×40 TT。側壁に砲口を外向きに装着。左右±65°・上下±20°の範囲から船体の遮蔽を差し引きます。充電装置は壁の内側です。'};}
// Casemate guns set into a wall: an armoured port flush with the plating, a
// ball mantlet and twin barrels. The gun house and its charging gear sit inside
// the hull; only the port and the barrels show. Short ranged (the broadside
// band), they give the most fire for the power.
const CASEMATE_BASE={cat:'w',casemate:true,barrels:2,aa:.2,evidence:'口径・連射速度はゲーム用設定'};
FITS.casemateMid={...CASEMATE_BASE,key:'casemateMid',name:'連装ケースメイト中砲',short:'ケースメイト中砲',boltTT:16,tt:32,cycle:1.1,power:32*TT,fm:9,wm:7,hm:12,r:4.5,mass:1400,crew:8,cost:180e3,desc:'トレンチや舷側の壁に埋め込む連装砲（2門×16 TT）。砲郭と充電装置は船体の内側にあり、外には装甲砲門と砲身だけが出る。射程は約9 kmと短いが、同じ電力で長射程砲の約1.8倍の砲火を出せる。左右±65°・上下±20°、船体で遮蔽される方向は射撃不可。'};
FITS.casemateLight={...CASEMATE_BASE,key:'casemateLight',name:'連装ケースメイト軽砲',short:'ケースメイト軽砲',boltTT:.4,tt:.8,cycle:.25,power:.8*TT,fm:6,wm:5,hm:8,r:3,mass:300,crew:3,cost:40e3,aa:1.2,desc:'壁に埋め込む連装の軽砲（2門×400 GT）。小型艦艇と戦闘機向け。左右±65°・上下±20°、船体で遮蔽される方向は射撃不可。'};
// Where a casemate's barrels end: model casemates by their asset, the others at their muzzles.
function casemateMuzzle(f){const d=fitSpec(f);return d.asset?referenceFitPoint(f,[.5,0,0]):add(fitOrigin(f),mul(fitUp(f),d.hm*.85));}
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
   const b=sectionBase(s.hull,x),y=c.chine&&b.edge!=null?b.edge:b.ybot+b.h*c.level,dep=Math.min(b.hw*.8,c.depth*(c.taper?b.pw:1)),z=sg*(b.hw-dep),up=[0,0,sg];
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
 const b=EXECUTOR_BLUEPRINT,s=newShip(JSON.parse(JSON.stringify(b.hull)),'エグゼクター級｜超大型指揮戦艦');s._building=true;s.reference='executor';s.detail=1;s.paint='neutral';s.lights='blue';s.keel='light';s.armor={hull:1.2,cit:1};s.shieldTarget=1;
 const {part,solid,room,gun,trench}=dreadnoughtTools(s);
 // The side trench runs between the upper plate tip and the lower hull tip.
 s.trenches.push({id:s.nextId++,side:'both',from:b.trench.from,to:b.trench.to,level:.5,height:b.trench.height,depth:b.trench.depth,taper:false,chine:true});
 // City and ventral blocks are nested flat-topped terraces traced from the
 // source model. Each is an ordinary outline structure standing on the one
 // below it; off-centre terraces are placed as mirrored pairs.
 const terrace=(d,name,paint,skin)=>{
  const P=[];for(let i=0;i<d.o.length;i+=2)P.push([d.o[i],d.o[i+1]]);
  const xs=P.map(p=>p[0]),zs=P.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),z0=Math.min(...zs),z1=Math.max(...zs),cx=(x0+x1)/2,cz=(z0+z1)/2,[y0,y1]=d.y;
  return placePart(s,'struct',[cx,(y0+y1)/2,cz],[x1-x0,z1-z0,y1-y0],{label:name(cx,cz),form:'outline',outline:P.map(([x,z])=>[(x-cx)/(x1-x0),(z-cz)/(z1-z0)]),corner:0,taper:0,skin,paint},!!d.m);
 };
 for(const d of b.cityTerraces)terrace(d,cx=>d.k===0?(cx<3600?'後部城郭の基部甲板':'都市基部区画'):d.k<4?'中央都市区画':'都市上層区画',d.k%2?'#8a9197':'#80888e','service');
 for(const d of b.ventralTerraces)terrace(d,(cx,cz)=>cx<6500?'機関区画の腹部構造':cx>11000&&cx<15000?(Math.abs(cz)>520?'前部腹部の竜骨張出し':'腹部ドッキング区画'):'腹部の装甲区画','#7a8288','armor');
 // Command tower: ordinary support structure under the source bridge body.
 const tw=b.bridge.tower;solid('艦橋支持塔',tw.c.slice(),tw.s.slice(),{form:'chamfer',corner:.06,skin:'service'});
 const bo=equipmentOptions('exeBridge'),ba=REFERENCE_ASSETS[b.bridge.asset],br=part('struct',bo.label,ba.c.slice(),bo.s,bo);
 {const h=rayPart([br.c[0]+br.s[0],br.c[1]-14,br.c[2]+80],[-1,0,0],br);if(h){const r=placeFit(s,'podAir',h.p,h.n,0,false);if(r.fit){r.fit.width=14;r.fit.height=5.6;}}}
 for(const id of b.bridge.domes){const a=REFERENCE_ASSETS[id];part('sensor',a.title,a.c.slice(),Math.max(...a.size),{skinAsset:id,skinSize:a.size.slice(),equipmentId:'exeSensor'});}
 const r=part('gen','中央主動力炉',[7400,550,0],620);
 for(const e of b.engines){const opts=equipmentOptions('exposedTurbine'),p=part('engine','長胴タービン露出型エンジン',[e.mouth[0]+e.diameter*.20,e.mouth[1],e.mouth[2]],e.diameter*.8,{...opts,d:e.diameter*.8,reactor:r.id,dir:[-1,0,0],engineLength:e.sourceBodyLength});resizeEngine(p,e.diameter*.8,e.sourceBodyLength);}
 for(const sg of [-1,1]){
  // Distributed internal plants share the reactor volume with the main plant.
  part('aux','分散補助炉',[9050,450,sg*600],520);
  part('shield','舷側シールド主発生器',[8200,400,sg*1200],220);
  part('shield','前部シールド発生器',[13000,420,sg*700],120);
  part('fuel','主反応物サイロ',[8650,380,sg*350],180,{length:450,dir:[0,1,0]});
  room('pump','主炉供給・冷却区画',[8300,400,sg*600],[260,180,160]);
  room('integrity','縦通構造維持幹線',[10400,480,sg*850],[1600,230,150]);
  part('inertial','主慣性補償装置',[10100,380,sg*450],300,{length:800});
  room('hangar',(sg<0?'左舷':'右舷')+'航空機格納庫',[12000,410,sg*400],[292.480170941796,360,120],{airRole:'storage'});
  room('hangar','中央発着ベイへの移送路',[12000,410,sg*185],[1500,70,100],{airRole:'flight'});
  room('service','航空整備・補給施設',[13700,440,sg*450],[650,250,90]);
  room('cargo','輸送・物資集積区画',[15000,420,sg*350],[600,180,70]);
 }
 const bay=room('hangar','中央腹部ドッキングベイ',[12000,330,0],[1700,300,250],{airRole:'dock'});openBay(s,bay,'bottom','ray');
 // One embarked army of four corps (36,864 troops) and four prefabricated
 // garrison bases, each with 484 support staff: 38,800 embarked in all.
 for(const [x,sg,n] of [[6500,-1,1],[6500,1,2],[9500,-1,3],[9500,1,4]])room('troops',`兵団兵員区画・第${n}軍団（9,216名）`,[x,420,sg*1300],[200,40,13.8241]);
 for(const [x,sg,n] of [[7200,-1,1],[7200,1,2],[8800,-1,3],[8800,1,4]]){room('troops',`第${n}プレハブ駐屯基地の支援要員区画（484名）`,[x,420,sg*1300],[44,12,11.0003]);room('cargo',`プレハブ駐屯基地 ${n}（分解収納）`,[x+(n<3?200:-200),420,sg*1300],[97,20,15]);}
 part('hyper','主ハイパードライブ',[9700,400,0],190,{length:650});
 // Parallel deck lanes preserve free spaces between real charging plants.
 // Fittings only: the hull, hatches and structures stay fixed, as in remount().
 syncAviationSurfaces(s);s._lockedCache=cache(s);
 try{withFrozenStructures(()=>{
  for(const axis of [2,3])for(const sg of [-1,1])for(let i=0;i<20;i++){
   const x=5900+i*530,hw=sectionBase(s.hull,x).hw;
   for(const fraction of [.60,.73,.84])gun(i%4===0?'ion':'oct40',x,sg*hw*fraction,axis,(sg<0?'port-':'stbd-')+(axis===2?'upper':'lower'));
  }
  for(let i=0;i<17;i++)for(const z of [-280,0,280])gun(i%3===0?'triple40':'oct40',6500+i*410,z,2,'central');
  trench(Array.from({length:32},(_,i)=>5900+i*355),FITS.casemate40?'casemate40':'oct40',1);
 });}finally{delete s._lockedCache;}
 delete s._building;adoptEquipment(s,true);remount(s);calibrateReferenceRatings(s);return s;
}
// Broadside batteries. In a trench they sit on its inner wall (the trench of
// the design, or the first one); without one, on the outer side wall met by a
// ray in from the beam at height y. Mounts that would land on armour plating
// or float are left out.
function trenchBattery(s,xs,k='casemateMid',opt={}){
 const c=s.trenches[opt.trench||0],out=[];if(!c)return out;
 for(const x of xs)for(const sg of [-1,1]){
  const b=sectionBase(s.hull,x);if(!(b.hw>0))continue;const y=c.chine&&b.edge!=null?b.edge:b.ybot+b.h*c.level,dep=Math.min(b.hw*.8,c.depth*(c.taper?b.pw:1)),z=sg*(b.hw-dep),up=[0,0,sg];
  const h=rayEnv(s,add([x,y,z],mul(up,3)),mul(up,-1),{maxT:6,structOnly:true});if(!h)continue;
  const f={id:s.nextId++,k,p:h.p,a:sg>0?4:5,ped:0,base:0,low:0,float:false,localMount:true,scale:opt.scale||1,chargeDepth:opt.chargeDepth||18,batteryZone:sg<0?'port-trench':'stbd-trench'};
  mountFit(s,f);if(f.float){s.nextId--;continue;}s.fits.push(f);out.push(f);}
 return out;
}
// A battery position clear of the mounts already on the hull (their bases and
// the turrets on their pedestals), moved a little fore or aft where one is in the way.
function batteryPoint(s,x,find,k){
 const r=(FITS[k]?.r||4)+3;
 for(const dx of [0,16,-16,32,-32,48,-48]){
  const h=find(x+dx);if(!h)continue;let ok=true;
  for(const f of s.fits){const d=FITS[f.k];if(!d)continue;const R=(d.r||4)*(f.scale||1)+r,top=add(f.p,mul(fitUp(f),(f.ped||0)+(d.hm||0)*.5));if(len(sub(f.p,h.p))<R*1.25||len(sub(top,h.p))<R*1.25){ok=false;break;}}
  if(ok)return h;
 }
 return null;
}
function sideBattery(s,xs,y,k='casemateMid',opt={}){
 const out=[];
 for(const x of xs)for(const sg of [-1,1]){
  // y: a height, or a share of the hull's own height there ('level').
  const find=xx=>{const yy=typeof y==='number'?y:(()=>{const b=sectionBase(s.hull,xx);return b.ybot+b.h*(opt.level??.5);})();
   const h=rayEnv(s,[xx,yy,sg*20000],[0,0,-sg],{structOnly:!!opt.structOnly});if(!h||Math.abs(h.p[2])<1)return null;
   return s.parts.find(p=>p.k==='struct'&&p.plate&&inStruct(p,sub(h.p,[0,0,sg*.5])))?null:h;};
  const h=batteryPoint(s,x,find,k);if(!h)continue;
  const f={id:s.nextId++,k,p:h.p,a:sg>0?4:5,ped:0,base:0,low:0,float:false,localMount:true,scale:opt.scale||1,chargeDepth:opt.chargeDepth||14,batteryZone:sg<0?'port-side':'stbd-side'};
  mountFit(s,f);if(f.float){s.nextId--;continue;}s.fits.push(f);out.push(f);}
 return out;
}
function dreadnoughtDesign(key){if(key!=='executor')throw new Error('設計見本が見つかりません');return executorDesign();}
// Model-measured example ships, one file each in src/ships/ (inserted below at
// build time). Each registers {key,name,side,role,length,author,source,license,
// note,build}; build() returns a finished ship made of ordinary parts.
const SHIP_EXAMPLES={};
function registerShipExample(d){
 if(!d||typeof d.key!=='string'||typeof d.build!=='function')throw new Error('作例の登録が不正です');
 SHIP_EXAMPLES[d.key]=d;DESIGNS[d.key]={name:d.name,hull:{L:d.length}};return d;
}
// Measured-section helpers for those builders (absolute metres, x bow, y up,
// z starboard). Rows are [x, zMin, zMax, yMin, yMax]; the bounding box of the
// rows sets the part's centre and size.
function shipKit(s){
 const put=(label,c,size,opt={},mirror=false)=>placePart(s,'struct',c,size,{label,skin:'armor',...opt},!!mirror);
 const loftX=(label,rows,opt={},mirror=false)=>{
  rows=rows.slice().sort((a,b)=>a[0]-b[0]);
  const x0=rows[0][0],x1=rows.at(-1)[0],z0=Math.min(...rows.map(r=>r[1])),z1=Math.max(...rows.map(r=>r[2])),y0=Math.min(...rows.map(r=>r[3])),y1=Math.max(...rows.map(r=>r[4]));
  const L=Math.max(2,x1-x0),W=Math.max(2,z1-z0),H=Math.max(2,y1-y0),cz=(z0+z1)/2;
  // Sizes raised to the 2 m minimum stay centred on the measured span.
  const bx=(x0+x1)/2-L/2,by=(y0+y1)/2-H/2;
  const loft=rows.map(r=>[clamp((r[0]-bx)/L,0,1),clamp((r[2]-r[1])/W,.02,2),clamp((r[4]-by)/H,.03,1.5),clamp((r[3]-by)/H,0,.97),clamp(((r[1]+r[2])/2-cz)/(W/2),-2,2)]);
  for(const r of loft)if(r[3]>=r[2]-.005)r[3]=Math.max(0,r[2]-.01);
  return put(label,[(x0+x1)/2,(y0+y1)/2,cz],[L,W,H],{form:opt.round?'roundloft':'loft',loft,corner:opt.corner??.08,...opt},mirror);
 };
 const box=(label,lo,hi,opt={},mirror=false)=>put(label,[(lo[0]+hi[0])/2,(lo[1]+hi[1])/2,(lo[2]+hi[2])/2],[hi[0]-lo[0],hi[2]-lo[2],hi[1]-lo[1]],{form:'chamfer',corner:opt.corner??.06,...opt},mirror);
 const ellipsoid=(label,c,size,opt={},mirror=false)=>put(label,c,size,{form:'ellipsoid',...opt},mirror);
 const slab=(label,pts,y0,y1,opt={},mirror=false)=>{
  const xs=pts.map(p=>p[0]),zs=pts.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),z0=Math.min(...zs),z1=Math.max(...zs),cx=(x0+x1)/2,cz=(z0+z1)/2;
  return put(label,[cx,(y0+y1)/2,cz],[x1-x0,z1-z0,y1-y0],{form:'outline',outline:pts.map(([x,z])=>[(x-cx)/(x1-x0),(z-cz)/(z1-z0)]),corner:0,taper:0,...opt},mirror);
 };
 const ring=(label,c,outerX,outerZ,thick,opt={})=>put(label,c,[outerX*2,outerZ*2,thick],{form:'arc',arcInner:opt.inner??.65,arcStart:opt.start??30,arcSweep:opt.sweep??300,...opt},false);
 return {put,loftX,box,ellipsoid,slab,ring};
}
// ---- src/ships/cr90.js ----
// CR90 corvette, measured from "Star Wars: CR-90" by Daniel (DanielAndersson)
// on Sketchfab, CC BY 4.0. Ship frame: x from the stern (0) to the bow (150 m),
// y up from the lowest point, z to starboard. The hull is a single rod, the
// round spine tube; engines, engine block, radar drum, bracing plates, turret
// section and the hammerhead are ordinary structures measured from the model.
{
const CR90_WHITE='#d9d7d0',CR90_RED='#a1373a',CR90_DARK='#4f565d',CR90_THROAT='#2b3238';
// A thin flat plate through 3D corner points (x,y,z): the plane comes from
// the corners and the outline is the corners projected into it.
function cr90Plate(s,label,pts,thick,opt={},mirror=false){
 let n=[0,0,0];for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];n[0]+=(a[1]-b[1])*(a[2]+b[2]);n[1]+=(a[2]-b[2])*(a[0]+b[0]);n[2]+=(a[0]-b[0])*(a[1]+b[1]);}
 n=norm(n);if(n[1]<0)n=mul(n,-1);
 let fw=sub([1,0,0],mul(n,n[0]));if(len(fw)<.001)fw=sub([0,0,1],mul(n,n[2]));fw=norm(fw);const rt=norm(cross(fw,n));
 const c0=mul(pts.reduce((a,b)=>add(a,b),[0,0,0]),1/pts.length),uv=pts.map(p=>[dot(sub(p,c0),fw),dot(sub(p,c0),rt)]);
 const u0=Math.min(...uv.map(q=>q[0])),u1=Math.max(...uv.map(q=>q[0])),v0=Math.min(...uv.map(q=>q[1])),v1=Math.max(...uv.map(q=>q[1]));
 const c=add(c0,add(mul(fw,(u0+u1)/2),mul(rt,(v0+v1)/2))),L=Math.max(.5,u1-u0),W=Math.max(.5,v1-v0);
 return placePart(s,'struct',c,[L,W,thick],{label,skin:'plain',form:'outline',outline:uv.map(q=>[(q[0]-(u0+u1)/2)/L,(q[1]-(v0+v1)/2)/W]),corner:0,taper:0,surfaceNormal:n,...opt},mirror);
}
// A prism along x with an exact cross-section polygon [[z,y],...]. With
// sym the points are a half profile (z >= 0) from top centre to bottom centre.
function cr90Prism(s,label,x0,x1,poly,opt={},sym=true,mirror=false){
 const pts=sym?poly.concat(poly.slice(1,-1).reverse().map(([z,y])=>[-z,y])):poly;
 const ys=pts.map(p=>p[1]),zs=pts.map(p=>p[0]),y0=Math.min(...ys),y1=Math.max(...ys),z0=Math.min(...zs),z1=Math.max(...zs),cy=(y0+y1)/2,cz=(z0+z1)/2;
 // pitch -90: local x is world -y, local y is world x, local z is world z.
 return placePart(s,'struct',[(x0+x1)/2,cy,cz],[y1-y0,z1-z0,x1-x0],{label,skin:'armor',form:'outline',outline:pts.map(([z,y])=>[(cy-y)/(y1-y0),(z-cz)/(z1-z0)]),corner:0,taper:0,pitch:-90,...opt},mirror);
}
// An elliptical-section loft along z (yaw 90): rows [z, xMin, xMax, yMin, yMax].
function cr90RoundZ(s,label,rows,opt={},mirror=false){
 rows=rows.slice().sort((a,b)=>a[0]-b[0]);
 const z0=rows[0][0],z1=rows.at(-1)[0],X0=Math.min(...rows.map(r=>r[1])),X1=Math.max(...rows.map(r=>r[2])),Y0=Math.min(...rows.map(r=>r[3])),Y1=Math.max(...rows.map(r=>r[4]));
 const L=z1-z0,W=X1-X0,H=Y1-Y0,cx=(X0+X1)/2;
 const loft=rows.map(r=>[(r[0]-z0)/L,(r[2]-r[1])/W,(r[4]-Y0)/H,(r[3]-Y0)/H,-((r[1]+r[2])/2-cx)/(W/2)]);
 return placePart(s,'struct',[cx,(Y0+Y1)/2,(z0+z1)/2],[L,W,H],{label,skin:'armor',form:'roundloft',yaw:90,loft,...opt},mirror);
}
registerShipExample({
 key:'cr90',name:'CR90コルベット',side:'反乱同盟',role:'コルベット',length:150,
 title:'Star Wars: CR-90',author:'Daniel',authorUrl:'https://sketchfab.com/DanielAndersson',
 source:'https://sketchfab.com/3d-models/star-wars-cr-90-60e26a508ca84126b30f01461f60086e',license:'CC-BY-4.0',
 credit:'This work is based on "Star Wars: CR-90" (https://sketchfab.com/3d-models/star-wars-cr-90-60e26a508ca84126b30f01461f60086e) by Daniel (https://sketchfab.com/DanielAndersson) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)',
 note:'150 m・11基の機関・連装ターボレーザー6基。背骨の円筒1本を船体とし、外形は原型モデルから実測した構造物',
 // Suggested embarked forces (buildDesign's finish() does not read these yet).
 groundForces:[{name:'反乱同盟艦隊兵小隊',kind:'troops',count:60}],
 build(){
  // Rod hull: the 12.4 m spine tube. Inside the centre engine it narrows to a
  // thread so the nozzle stays open, and it slims again through the neck.
  const s=newShip({L:150,W:20,H:14,sec:'ellipse',plan:'rect',bowW:1,bowH:1,stern:1,keel:'light',bowFree:true,stations:[
   [0,.005,.007,.5],[.05,.005,.007,.5],[.062,.33,.47,.5],[.145,.33,.47,.5],[.149,.26,.37,.5],[.168,.26,.37,.5],[.174,.35,.5,.5],[.229,.35,.5,.5],[.255,.62,.886,.5],
   [.765,.62,.886,.5],[.79,.45,.64,.5],[.81,.4,.57,.5],[.825,.31,.443,.5],[.85,.33,.47,.5],[.88,.41,.586,.5],[.9,.49,.7,.5],[.92,.5,.71,.5],[.98,.5,.71,.5],[1,.25,.3,.5]]},'CR90コルベット');
  s._building=true;s.paint='neutral';s.detail=1;s.keel='light';s.armor={hull:.13,cit:.13};s.shieldTarget=1;
  const k=shipKit(s),part=(kind,label,c,d,opt={},mirror=false)=>placePart(s,kind,c,d,{label,...opt},mirror),room=(kind,label,c,size,opt={},mirror=false)=>part(kind,label,c,30,{room:size,...opt},mirror);
  const W={paint:CR90_WHITE},R={paint:CR90_RED},D={paint:CR90_DARK};
  // Engines: 11 nozzles in rows of 4, 3 and 4. Each long nozzle runs inside a
  // boxy casing; the dark throat plate closes the casing behind the bell.
  const ENG=[[23.6,18.85],[23.6,6.35],[14.15,12.45],[14.15,0],[4.85,18.85],[4.85,6.35]];
  const CASE=[[8,4.75,4.55],[21.5,4.75,4.55],[22.3,5.2,2.8],[25.2,5.2,2.8],[26,3.7,3.7],[35,3.6,3.5]];
  for(const [y,z] of ENG){
   k.loftX('機関ナセル外殻',CASE.map(([x,hz,hy])=>[x,z-hz,z+hz,y-hy,y+hy]),{corner:.2,skin:'service',...W},z>0);
   k.loftX('機関ノズル奥の遮熱板',[[7.95,z-3.3,z+3.3,y-3.3,y+3.3],[9.95,z-3.3,z+3.3,y-3.3,y+3.3]],{round:true,skin:'plain',paint:CR90_THROAT},z>0);
   // Ribbed nozzle sleeve (also the stern's longitudinal strength).
   for(const sg of z>0?[-1,1]:[1])placePart(s,'struct',[4,y,sg*z],[8.9,8.9,8],{label:'機関ノズル外筒',form:'arc',arcInner:.88,arcStart:0,arcSweep:360,pitch:-90,skin:'plain',...D},false);
  }
  // Engine block: central box with C-shaped side brackets, measured at x 38.
  cr90Prism(s,'機関ブロック',34.4,44.4,[[0,27],[7.5,27],[10.2,26.3],[10.2,24.8],[22.4,24.6],[22.6,19],[21.2,18],[19.3,17],[17.8,16],[17.8,12.3],[19.3,11.2],[21.2,10.2],[22.6,9.3],[22.4,3.9],[10.2,3.8],[10.2,1.8],[7.5,1],[0,1]],{skin:'service',...W});
  k.box('機関ブロック前面の枠',[44,4.4,-9.6],[46,23.8,9.6],{corner:.08,...W});
  // Radar drum across the spine with its red rims, mount and sensors.
  k.put('レーダー・ドラム',[60.25,14.2,0],[29.8,12.2,12.2],{form:'roundloft',yaw:90,loft:[[0,1,1,0],[1,1,1,0]],...W});
  for(const sg of [-1,1])placePart(s,'struct',[60.25,14.2,sg*14.95],[11.6,11.6,2],{label:'ドラム端の赤帯',form:'arc',arcInner:.78,arcStart:0,arcSweep:360,roll:90,skin:'plain',...R},false);
  k.box('ドラム支持架',[54.6,4,-3.6],[65.6,24.4,3.6],{corner:.08,...W});
  k.ellipsoid('背部センサードーム',[60.4,24.6,0],[8.8,8.8,5.2],{skin:'plain',...W});
  k.box('アンテナ支持腕',[60,26,-1.1],[63.4,29.5,1.1],{corner:.1,skin:'plain',...D});
  k.loftX('通信アンテナ皿',[[62.2,-4.6,4.6,27.4,32.5],[64.2,-4.6,4.6,27.4,32.5]],{round:true,skin:'plain',...D});
  k.box('腹部センサー',[56.4,1.6,-4.1],[64.5,4.6,4.1],{corner:.15,skin:'plain',...W});
  // Bracing plates (an X seen from the bow) and the red horizontal side plates.
  cr90Plate(s,'上部筋交い板',[[44,15.6,4.6],[44,20,9.2],[57,20.1,9.8],[57,15.6,5.2]],2,W,true);
  cr90Plate(s,'下部筋交い板',[[44,12.4,4.6],[44,8,9.2],[57,7.9,9.8],[57,12.4,5.2]],2,W,true);
  cr90Plate(s,'上部X字補強板',[[60,14.4,4],[60,19.7,12.4],[95,22.4,.6],[82,18.4,.4]],2,W,true);
  cr90Plate(s,'下部X字補強板',[[60,13.6,4],[60,8.3,12.4],[95,5.6,.6],[82,9.6,.4]],2,W,true);
  k.slab('側面赤帯板',[[62,3.4],[80,3.4],[94,3.4],[94,12.4],[80,8.6],[62,8.6]],13.1,15.1,{skin:'plain',...R},true);
  // Turret section: belt, roof and keel as measured; tapered ends.
  cr90Prism(s,'主船体（砲塔区画）',94,112.5,[[0,23.1],[1.5,23],[2.2,22],[3.1,21],[4,20],[5.1,19],[7.7,18],[10.5,17],[13.4,16.5],[13.5,13],[13,12],[12.2,10.5],[11.6,9.6],[4.6,9.2],[3.8,8],[3.2,7],[2.2,6],[.8,5],[0,4.8]],W);
  k.loftX('砲塔区画の後端',[[91.8,-6,6,7.5,20.8],[94.1,-13.5,13.5,5.2,23]],{corner:.3,...W});
  k.loftX('砲塔区画の前端',[[112.4,-13.5,13.5,5,23.1],[115.5,-11.2,11.2,6,22],[118,-8.4,8.4,8.6,19.5]],{corner:.3,...W});
  k.box('背部砲塔台座',[95.7,16.4,3],[110.3,21.3,11.4],{corner:.12,...W},true);
  k.box('脱出ポッド列',[94.5,8.5,8.6],[111.7,10.5,12.4],{corner:.2,skin:'plain',...D},true);
  k.box('連装砲塔の支柱',[114.5,3.3,-3.9],[122.3,24.9,3.9],{corner:.2,...W});
  k.box('前部背鰭',[121.5,16,-1.5],[142.4,22.6,1.5],{corner:.2,...W});
  // Hammerhead: a barrel across the bow with red end bands and the cockpit slot.
  const HEAD=[[0,137,149.2,7.3,20.8],[2.5,137,149,7.5,20.6],[5,137.3,148.6,8.2,20.2],[8,138,147.9,8.9,19.6],[10,138.6,147.5,9.6,19.4],[11,138.9,147.2,10,18.5],[12.3,140,146.6,11.2,16.8],[12.75,141.2,146.5,13,15]];
  cr90RoundZ(s,'ハンマーヘッド（艦首区画）',HEAD.slice(1).map(([z,...r])=>[-z,...r]).concat(HEAD),W);
  cr90RoundZ(s,'艦首両端の赤帯',[[9.4,138.3,147.74,9.27,19.58],[10,138.48,147.62,9.48,19.52],[11,138.78,147.32,9.88,18.62],[12.1,139.7,146.82,10.86,17.24]],R,true);
  k.box('艦橋窓',[147.35,14.9,-4.6],[149.35,17,4.6],{corner:.15,skin:'plain',paint:CR90_THROAT});
  // Machinery. Reactors fill the engine block, the spine, the radar drum and
  // the turret section; each nozzle draws on the block reactor nearest it.
  const gen=part('gen','主反応炉',[39.6,14,0],10.6);
  const auxS=part('aux','機関補助炉',[39.4,14,13.9],7.2,{},true),auxP=s.parts.find(p=>p.id===auxS.tw);
  for(const z of [-17,17])part('aux','分散補助炉',[39.4,21.8,z],5);
  room('cargo','貨物区画（機関ブロック下部）',[39.4,6.6,16.3],[9,11,4.6],{},true);
  part('aux','補助反応炉（背骨）',[50,14,0],8.4);
  part('aux','補助反応炉（レーダー・ドラム）',[60.25,14.2,10.6],7,{},true);
  part('aux','補助反応炉（砲塔区画）',[103,14,0],10.6);
  for(const [y,z] of ENG)for(const sg of z>0?[-1,1]:[1]){const outer=Math.abs(z)>10;part('engine','亜光速機関',[6.4,y,sg*z],8,{dir:[-1,0,0],nozzleLength:12.8,bodyLength:2,bodyRadius:.4,reactor:outer?(sg>0?auxS.id:auxP.id):gen.id});}
  room('pump','反応物供給設備',[39.4,21.8,0],[6,6,4]);
  part('hyper','ハイパードライブ',[60.25,14.2,0],5,{length:10,dir:[0,0,1]});
  part('inertial','慣性制御装置',[72.5,14,0],8,{length:12});
  room('integrity','構造維持装置',[83,14,0],[8,8,8]);
  part('fuel','反応物サイロ',[89.6,14,0],8,{length:4});
  room('troops','兵員区画',[103,13.2,9.6],[16,5,4.8],{},true);
  part('shield','シールド発生器',[143,14,6.5],7,{},true);
  room('command','指揮所',[143.5,14,0],[7,5,6]);
  // Armament (canon: two dual and four single turbolasers): light turrets on
  // the turret blocks, the two dual turrets on the column ahead (dorsal and
  // ventral) and four point-defence guns for fighters and missiles.
  const gun=(kind,x,z,axis,scale,zone)=>{const up=AXES[axis],h=rayEnv(s,[x,axis===3?-500:500,z],mul(up,-1),{structOnly:true});if(!h)throw new Error('CR90の砲座がありません: '+x+','+z);const f={id:s.nextId++,k:kind,p:h.p,a:axis,ped:0,base:0,low:0,float:false,scale,chargeDepth:4,batteryZone:zone};mountFit(s,f);s.fits.push(f);return f;};
  syncAviationSurfaces(s);s._lockedCache=cache(s);
  try{withFrozenStructures(()=>{
   for(const x of [99,107.2])for(const z of [-7.4,7.4])gun('ltl',x,z,2,.5,z<0?'port':'stbd');
   gun('mtl',118.4,0,2,.44,'dorsal');gun('mtl',118.4,0,3,.44,'ventral');
   for(const z of [-6.5,6.5])gun('pd',142.5,z,2,.45,'bow');
   for(const z of [-16,16])gun('pd',39.4,z,3,.45,'stern');
  });}finally{delete s._lockedCache;}
  delete s._building;remount(s);return s;
 }
});
}

// ---- src/ships/dreadnaught.js ----
// Dreadnaught-class heavy cruiser, measured from flannelandfilm's Sketchfab
// model scaled to 600 m (x0.98620). Ship frame: x stern 0 -> bow 600, y up
// from the keel of the main hull, z starboard.
registerShipExample({
 key:'dreadnaught',name:'ドレッドノート級重巡洋艦',side:'銀河帝国',role:'重巡洋艦',length:600,
 author:'flannelandfilm (https://sketchfab.com/flannelandfilm)',
 source:'https://sketchfab.com/3d-models/star-wars-dreadnaught-class-heavy-cruiser-14e6ad1266104dec96541b17000925f2',
 license:'CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)',
 credit:'This work is based on "Star Wars Dreadnaught-Class Heavy Cruiser" (https://sketchfab.com/3d-models/star-wars-dreadnaught-class-heavy-cruiser-14e6ad1266104dec96541b17000925f2) by flannelandfilm (https://sketchfab.com/flannelandfilm) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)',
 note:'旧共和国の設計を帝国軍が改装した全長600 mの重巡洋艦。八角断面の船体を2 m毎の断面測定から28断面で合わせ、艦首下部の楕円体、舷側の砲塔ブリスター、腹部の機関区画、6基の機関ハウジングを構造物で再現。四連レーザー8基・ターボレーザー10基（舷側ブリスター）・点防御砲4基・舷側の連装ケースメイト砲10基（甲板上の砲は見やすい数に減らしています）、兵員3,000名、貨物9,000 t、TIE戦闘機1個中隊（12機）。',
 build(){
  const s=newShip({L:600,W:96.566,H:90.242,sec:'warship',plan:'rect',bowFree:true,stern:1,
   stations:[[0,.7746,.20722,.00697,.97,.97,.9,.5],[.01767,.7746,.20722,.00697,.97,.97,.9,.5],[.01883,.7746,.47206,.13939,.845,.97,.455,.232],[.02667,.7746,.47206,.13939,.845,.97,.455,.232],[.02783,.7746,.71585,.0175,.845,.89,.319,.485],[.0309,.7746,.71585,.0175,.845,.89,.319,.485],[.032,.76927,.32936,.00663,.85211,.98,.05496,.48305],[.03333,.94473,.33074,.00732,.83898,.87978,.05496,.46924],[.04333,.98077,.33142,.00759,.75014,.79305,.05027,.43731],[.04667,.96781,.92353,.03824,.62644,.60826,.04255,.43637],[.19,.96678,.97457,-.0127,.68011,.68693,.02,.44862],[.26667,.86769,.82318,.01702,.69207,.75659,.04345,.42505],[.31,.69987,.65566,-.00628,.68985,.75983,.04373,.44786],[.35667,.76556,.6551,-.0067,.69354,.74928,.02057,.45374],[.36,.7664,.70716,-.03176,.69354,.68506,.02057,.48435],[.37667,.77352,.71799,-.03303,.6859,.67452,.02,.48922],[.40333,.76586,.61325,-.02545,.7399,.75519,.04788,.48224],[.61333,.76128,.70109,-.02,.69461,.74403,.04723,.48075],[.63,.76833,.63184,.01649,.68643,.76857,.04358,.40911],[.66,.77321,.63164,.0166,.68467,.76397,.04358,.40884],[.66333,.79922,.58944,.03769,.65036,.73863,.03659,.32874],[.67667,.82028,.66797,.07834,.6963,.62375,.04188,.29443],[.68,.82287,.50415,.1648,.7111,.98,.04188,.2],[.71333,.82423,.55544,.19045,.68793,.98,.02,.2],[.86667,.81029,.53139,.17893,.7164,.98,.02,.2],[.93667,.70861,.38687,.10616,.77618,.98,.02,.2],[.97333,.60168,.21541,.02042,.84234,.98,.02,.2],[1,.42669,.05399,-.05613,.96441,.98,.03793,.51014]]},'ドレッドノート級重巡洋艦');
  s._building=true;s.paint='neutral';s.detail=1;s.keel='std';s.armor={hull:.48,cit:.35};
  const k=shipKit(s),part=(kind,label,c,d,opt={},mirror=false)=>placePart(s,kind,c,d,{label,...opt},mirror),room=(kind,label,c,size,opt={},mirror=false)=>part(kind,label,c,30,{room:size,...opt},mirror);
  // Six engine housings in three rows; the main hull's flanged stern starts at x 19.
  k.box('中段機関ハウジング',[0,35.4,.7],[50.4,56.1,38.2],{corner:.16,skin:'service'},true);
  k.box('上段機関ハウジング',[10.7,62.4,1],[53.4,80,32.6],{corner:.16,skin:'service'},true);
  k.box('下段機関ハウジング',[16.7,13.4,1],[61.9,32,34.5],{corner:.16,skin:'service'},true);
  // The bow overlaps a rounded lower hull, an ellipsoid measured slice by slice.
  k.ellipsoid('艦首下部の円胴',[485.5,38.9,0],[182.6,70,67.7]);
  // Flanking machinery modules hanging below the waist.
  // Their walls lean outward with the hull's lower flank (a parallelogram section).
  for(const [x0,x1] of [[182.4,212.1],[209.7,239.4],[236.9,265.9]])k.put('舷側の機関モジュール',[(x0+x1)/2,24.9,31.15],[x1-x0,13.7,40],{form:'trap',angles:[0,0,15.8,-15.8],skin:'service',paint:'#7c8478'},true);
  // Weapon and shield blisters along the flanks.
  for(const [c,size] of [[[304.1,59.3,31.2],[37.8,22.1,13.7]],[[344.1,47.4,30.4],[37.8,22.1,13.7]],[[378,59.3,29.3],[37.8,22.1,13.7]],[[340.2,67,23.8],[30.2,17.7,11]],[[424.2,49.6,35.5],[31.3,18.3,11.4]]])k.ellipsoid('舷側ブリスター',c,size,{paint:'#949ca4'},true);
  // Armoured dorsal superstructure over the forward hull: the command decks.
  k.box('背部装甲甲板',[290,72.4,-26],[345,74.6,26],{corner:.04});
  k.loftX('背部装甲上部構造',[[342,-25.8,25.8,73.4,78.8],[355,-25.8,25.8,73.4,78.8],[355.5,-25.8,25.8,73.4,83.6],[396,-25.8,25.8,73.4,83.6]],{corner:.06,skin:'service',paint:'#808a7e'});
  // Dorsal and ventral sensor masts.
  k.box('背部センサー支柱',[223,72,-3],[229.5,84,3],{corner:.15});
  k.box('腹部センサー支柱',[224.4,2,-3],[230.8,12,3],{corner:.15});
  part('sensor','背部走査アンテナ',[226.3,89.4,0],13);
  part('sensor','腹部走査アンテナ',[227.6,-3.3,0],13);
  // Power: one main reactor amidships aft feeds twelve turbines, two per housing.
  const r=part('gen','主反応炉',[112,44,0],49.5);
  for(const [x,y,zs,d] of [[0,45.75,[10.4,29.1],17],[10.7,71.2,[8.9,24.7],15],[16.7,22.7,[9.4,26.1],16]])for(const z of zs){
   const o=equipmentOptions('internalTurbine'),e=placePart(s,'engine',[x,y,z],d,{...o,label:'主推進機関',d,reactor:r.id,dir:[-1,0,0]},true);
   for(const q of s.parts.filter(q=>q.id===e.id||q.id===e.tw)){resizeEngine(q,d);q.c[0]=x-1+q.nozzleLength/2;}
  }
  for(const sg of [-1,1]){
   part('shield','舷側シールド発生器',[300,44,sg*14],13.4);
   part('fuel','反応物サイロ',[150,44,sg*16],12,{dir:[0,1,0],length:30});
   room('troops',(sg<0?'左舷':'右舷')+'兵員区画（1,500名）',[440,52,sg*18],[62,16,18.2]);
   room('cargo',(sg<0?'左舷':'右舷')+'中央貨物倉',[269,44,sg*16],[42,18,24]);
  }
  room('pump','反応物供給・冷却区画',[150,25,0],[12,10,10]);
  room('crew','乗員居住区画',[152.5,70,0],[35,28,16]);
  part('hyper','主ハイパードライブ（クラス2）',[190,44,0],18,{length:20.6,dir:[1,0,0]});
  part('inertial','主慣性補償装置',[226,52,0],22,{length:38,dir:[1,0,0]});
  room('integrity','縦通構造維持幹線',[520,62,0],[60,16,12]);
  room('cargo','前部腹部貨物倉',[520,40,0],[60,30,18]);
  room('command','背部装甲指揮甲板（艦橋）',[372,72,0],[40,30,12]);
  room('service','格納庫前方の航空整備・補給区画',[384.5,30.25,0],[25,44,16.5]);
  const bay=room('hangar','腹部戦闘機格納庫（TIE 1個中隊）',[347,32.2,0],[50,44,38.4],{airRole:'mixed'});openBay(s,bay,'bottom','ray');
  delete s._building;
  // Armament (Legends): 20 quad laser cannons (6 bow, 7 port, 7 starboard),
  // 10 turbolaser cannons in the flank blisters, 10 laser cannons (5 bow, 5 stern).
  syncAviationSurfaces(s);s._lockedCache=cache(s);
  try{withFrozenStructures(()=>{
   const up=(k,x,z,opt={})=>{const h=rayEnv(s,[x,400,z],[0,-1,0],{structOnly:true});if(!h)throw new Error('作例の砲座がありません: '+x+','+z);const f={id:s.nextId++,k,p:h.p,a:2,ped:0,base:0,low:0,float:false,...opt};mountFit(s,f);s.fits.push(f);return f;};
   const side=(k,x,y,sg,opt={})=>{const h=rayEnv(s,[x,y,sg*300],[0,0,-sg],{structOnly:true});if(!h)throw new Error('作例の舷側砲座がありません: '+x+','+y);const f={id:s.nextId++,k,p:h.p,a:sg>0?4:5,ped:0,base:0,low:0,float:false,...opt};mountFit(s,f);s.fits.push(f);return f;};
   // Quad laser cannons: a pair at the bow and three a side along the deck edge (v15 keeps the deck readable).
   for(const x of [482])for(const sg of [-1,1])up('quad200',x,sg*18,{batteryZone:'bow'});
   for(const sg of [-1,1]){const zone=sg<0?'port':'stbd';for(const [x,z] of [[80,22],[278,22],[408,22]])up('quad200',x,sg*z,{batteryZone:zone});}
   for(const sg of [-1,1])for(const [x,y] of [[304.1,59.3],[344.1,47.4],[378,59.3],[340.2,67],[424.2,49.6]])side('htl',x,y,sg,{batteryZone:sg<0?'port':'stbd'});
   for(const [x,z] of [[545,-14],[545,14]])up('pd',x,z,{batteryZone:'bow'});
   for(const [x,z] of [[30,-16],[30,16]])up('pd',x,z,{batteryZone:'stern'});
  });}finally{delete s._lockedCache;}
  adoptEquipment(s,true);remount(s);
  // Broadside batteries along the flanks (v14): short-ranged, the most fire for the power.
  sideBattery(s,[120,200,280,360,440],null,'casemateMid',{level:.5});remount(s);return s;
 }
});

// ---- src/ships/gozanti.js ----
// Imperial Gozanti-class cruiser, measured from "Star Wars: Gozanti-Class
// Cruiser" by Daniel (DanielAndersson) on Sketchfab, CC BY 4.0. Ship frame:
// x from the stern (0) to the bow (63.8 m), y up from the lowest point, z to
// starboard. The hull is a single rod, the dorsal spine and nose; the delta
// wing, engine pods, docking clamps and fittings are ordinary structures.
{
const GZ_GREY='#8c9297',GZ_LIGHT='#a3a8ac',GZ_DARK='#4b5258',GZ_GLASS='#2b3238';
// A prism along x with an exact cross-section polygon [[z,y],...], split into
// pieces no longer than its height for the longitudinal-strength bins.
function gzPrismX(s,label,x0,x1,pts,opt={}){
 const ys=pts.map(p=>p[1]),zs=pts.map(p=>p[0]),y0=Math.min(...ys),y1=Math.max(...ys),z0=Math.min(...zs),z1=Math.max(...zs),cy=(y0+y1)/2,cz=(z0+z1)/2;
 // Pieces stay at least 2 m long (the loader's minimum structure size).
 const n=Math.max(1,Math.min(Math.ceil((x1-x0)/(y1-y0)-1e-9),Math.floor((x1-x0)/2))),dx=(x1-x0)/n;
 for(let i=0;i<n;i++)placePart(s,'struct',[x0+dx*(i+.5),cy,cz],[y1-y0,z1-z0,dx],{label,skin:'armor',form:'outline',outline:pts.map(([z,y])=>[(cy-y)/(y1-y0),(z-cz)/(z1-z0)]),corner:0,taper:0,pitch:-90,...opt},false);
}
registerShipExample({
 key:'gozanti',name:'ゴザンティ級巡洋艦',side:'銀河帝国',role:'巡洋艦（輸送・護衛）',length:63.8,
 title:'Star Wars: Gozanti-Class Cruiser',author:'Daniel',authorUrl:'https://sketchfab.com/DanielAndersson',
 source:'https://sketchfab.com/3d-models/star-wars-gozanti-class-cruiser-6a587e545b1c48bea95480b49458ac63',license:'CC-BY-4.0',
 credit:'This work is based on "Star Wars: Gozanti-Class Cruiser" (https://sketchfab.com/3d-models/star-wars-gozanti-class-cruiser-6a587e545b1c48bea95480b49458ac63) by Daniel (https://sketchfab.com/DanielAndersson) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)',
 note:'63.8 m・三角翼と2基の主機・腹部のドッキング・クランプ。背骨と艦首を1本の船体とし、外形は原型モデルから実測した構造物',
 // The model's TIE fighters / walker ride on external clamps; the yard counts
 // only internal hangar volume, so none are embarked by default.
 build(){
  // Rod hull: the dorsal spine, a trapezoid narrowing upwards, widening into
  // the nose. Rows [x, half width, y bottom, y top]; deck .55 of the keel.
  const ROD=[[0,1,6.6,9],[3,1.2,3.7,9],[13,1.6,2.2,9.8],[15,2,4,10.4],[20,3.3,4.5,9.8],[44,3.9,4.5,9.8],[46.5,4.85,3.8,9.8],[50,4.1,3.8,9.4],[54,3.2,3.8,9.1],[58,2.5,2.2,8.9],[62,1.8,1.5,8.4],[63.8,1.8,1.5,6.2]];
  const W=20,H=10,stations=ROD.map(([x,hw,y0,y1])=>[x/63.8,hw*2/W,(y1-y0)/H,(y0+y1)/2/H-.5,.55,.98,.1,.2]);
  const s=newShip({L:63.8,W,H,sec:'warship',plan:'rect',bowW:1,bowH:1,stern:1,keel:'std',bowFree:true,deckWidth:.55,keelWidth:.98,belt:.1,chineHeight:.2,stations},'ゴザンティ級巡洋艦');
  s._building=true;s.paint='neutral';s.detail=1;s.keel='std';s.armor={hull:.12,cit:.05};s.shieldTarget=.45;
  const k=shipKit(s),part=(kind,label,c,d,opt={},mirror=false)=>placePart(s,kind,c,d,{label,...opt},mirror),room=(kind,label,c,size,opt={},mirror=false)=>part(kind,label,c,30,{room:size,...opt},mirror);
  const G={paint:GZ_GREY},L={paint:GZ_LIGHT},D={paint:GZ_DARK};
  // Delta wing: flat upper deck with a V-shaped ventral keel beneath it.
  k.slab('三角翼',[[14.4,-14.7],[18,-14.7],[30,-9.9],[46.6,-9.75],[46.6,9.75],[30,9.9],[18,14.7],[14.4,14.7]],2.75,4.75,{skin:'armor',...G});
  // Ventral V keel under the wing, three planform steps measured from the model.
  for(const [x0,x1,o] of [[15,24,12],[24,32,10.7],[32,46.6,9.7]]){const half=[[0,3.4],[o,3.4],[o,3],[7.5,2.2],[3.6,1.4],[0,1.4]];gzPrismX(s,'腹部竜骨',x0,x1,half.concat(half.slice(1,-1).reverse().map(([z,y])=>[-z,y])),L);}
  k.loftX('艦首下部竜骨',[[45.5,-2.8,2.8,.8,4],[54,-2.4,2.4,1.2,4],[58,-2.4,2.4,1.5,4],[60,-1.6,1.6,1.8,3.6]],{corner:.25,...G});
  // Engine pods at the wing's trailing corners, and the tail boom's nozzle.
  k.loftX('主機ポッド',[[14.6,9.7-2.65,9.7+2.65,1,6.3],[21.3,9.7-2.55,9.7+2.55,1.1,6.2],[22.6,9.7-1.6,9.7+1.6,2,5.3]],{round:true,...G},true);
  for(const sg of [-1,1])placePart(s,'struct',[14,3.65,sg*9.7],[5.6,5.6,2],{label:'主機ノズル外筒',form:'arc',arcInner:.82,arcStart:0,arcSweep:360,pitch:-90,skin:'plain',...D},false);
  // Dorsal fittings: gun tower, sensor dish, side blocks ahead of the wing root.
  k.box('背部砲塔基部',[13.6,9.4,-1],[17.2,11.4,1],{corner:.2,...D});
  k.box('腹部砲塔基部',[13.6,.4,-1],[17.2,2.4,1],{corner:.2,...D});
  k.box('センサー皿の支柱',[25.9,8.6,1.5],[27.9,10.6,3.5],{corner:.2,skin:'plain',...D});
  k.loftX('センサー皿',[[26.9,1,4.1,10,12.8],[28.9,1,4.1,10,12.8]],{round:true,skin:'plain',...D});
  k.box('前部側方区画',[41.8,5.2,3],[47,8.2,5.85],{corner:.12,...G},true);
  k.loftX('艦首の肩部',[[46.4,-4.85,4.85,3.8,7.6],[50,-4.1,4.1,3.8,7.5],[54,-3.2,3.2,3.8,7]],{corner:.06,...G});
  // Docking clamps for carried fighters beneath the wing.
  for(const z of [-5.8,5.8])k.box('ドッキング・クランプ',[30.6,.3,z-1],[40.4,2.3,z+1],{corner:.15,skin:'plain',...D});
  k.box('クランプ支持架',[30,1.5,-6.8],[41,3.5,6.8],{corner:.1,skin:'plain',...D});
  k.loftX('艦橋窓',[[52.4,-3.45,3.45,5.4,7.4],[62.7,-1.9,1.9,5.4,7.4]],{corner:.2,skin:'plain',paint:GZ_GLASS});
  // Machinery.
  const gen=part('gen','主反応炉',[34,4.4,0],5.6);
  part('aux','補助反応炉',[24,5.4,0],5.2);
  for(const sg of [-1,1])part('engine','主機',[17.9,3.65,sg*9.7],4.4,{dir:[-1,0,0],nozzleLength:9,bodyLength:2,bodyRadius:.4,reactor:gen.id});
  part('aux','補助反応炉（艦首）',[51.4,6.5,0],4.2);
  part('inertial','慣性制御装置',[28.9,6.8,0],4,{length:3.5,dir:[1,0,0]});
  room('pump','反応物供給設備',[39.5,7.35,0],[4,4,4]);
  part('fuel','反応物サイロ',[44,3.3,0],4,{length:4,dir:[0,0,1]});
  part('shield','シールド発生器',[40,3.3,0],4);
  room('integrity','構造維持装置',[43.9,7.4,0],[4,4,4]);
  part('hyper','ハイパードライブ',[48.2,6.4,0],4,{length:2,dir:[1,0,0]});
  room('command','艦橋',[55.5,5.6,0],[4,4,4]);
  // Armament: twin dorsal and ventral laser turrets aft, point defence forward.
  const gun=(kind,x,z,axis,scale,zone)=>{const up=AXES[axis],h=rayEnv(s,[x,axis===3?-100:100,z],mul(up,-1),{structOnly:true});if(!h)throw new Error('ゴザンティ級の砲座がありません: '+x+','+z);const f={id:s.nextId++,k:kind,p:h.p,a:axis,ped:0,base:0,low:0,float:false,scale,chargeDepth:1.5,batteryZone:zone};mountFit(s,f);s.fits.push(f);return f;};
  syncAviationSurfaces(s);s._lockedCache=cache(s);
  try{withFrozenStructures(()=>{
   gun('ltl',15.4,0,2,.3,'dorsal');gun('ltl',15.4,0,3,.3,'ventral');
   for(const z of [-7,7])gun('pd',36,z,2,.35,'wing');
   gun('pd',52,0,2,.35,'bow');gun('pd',50,0,3,.35,'bow');
  });}finally{delete s._lockedCache;}
  delete s._building;remount(s);return s;
 }
});
}

// ---- src/ships/gr75.js ----
// GR-75 medium transport, measured from "Star Wars: GR-75 Medium Transport"
// by Daniel (DanielAndersson) on Sketchfab, CC BY 4.0. Ship frame: x from
// the stern (0) to the bow (90 m), y up from the lowest point, z to starboard.
// The armoured upper shell is an ordinary fitted hull (station table); the
// open cargo cradle beneath it, the engines and the cockpit are structures.
{
const GR_HULL='#b9b6ad',GR_DARK='#4a5056',GR_RACK='#3b4146',GR_THROAT='#2b3238';
const GR_CARGO={red:'#9b3d39',green:'#4b6a3f',brown:'#8a5a33',grey:'#8e9396'};
// A prism along x with an exact cross-section polygon [[z,y],...], split into
// pieces no longer than its height for the longitudinal-strength bins.
// zscale(x) narrows a piece's section towards the centreline (bilge taper).
function grPrismX(s,label,x0,x1,pts,opt={},mirror=false,zscale=null){
 const n=Math.max(1,Math.ceil((x1-x0)/(Math.max(...pts.map(p=>p[1]))-Math.min(...pts.map(p=>p[1])))-1e-9)),dx=(x1-x0)/n;let first=null;
 for(let i=0;i<n;i++){
  const k=zscale?zscale(x0+dx*(i+.5)):1,q=pts.map(([z,y])=>[z*k,y]);
  const ys=q.map(p=>p[1]),zs=q.map(p=>p[0]),y0=Math.min(...ys),y1=Math.max(...ys),z0=Math.min(...zs),z1=Math.max(...zs),cy=(y0+y1)/2,cz=(z0+z1)/2;
  const p=placePart(s,'struct',[x0+dx*(i+.5),cy,cz],[y1-y0,z1-z0,dx],{label,skin:'armor',form:'outline',outline:q.map(([z,y])=>[(cy-y)/(y1-y0),(z-cz)/(z1-z0)]),corner:0,taper:0,pitch:-90,...opt},mirror);first=first||p;
 }
 return first;
}
registerShipExample({
 key:'gr75',name:'GR-75中型輸送船',side:'反乱同盟',role:'輸送船',length:90,
 title:'Star Wars: GR-75 Medium Transport',author:'Daniel',authorUrl:'https://sketchfab.com/DanielAndersson',
 source:'https://sketchfab.com/3d-models/star-wars-gr-75-medium-transport-071b158d02c044ee9b431aeb28b85b6a',license:'CC-BY-4.0',
 credit:'This work is based on "Star Wars: GR-75 Medium Transport" (https://sketchfab.com/3d-models/star-wars-gr-75-medium-transport-071b158d02c044ee9b431aeb28b85b6a) by Daniel (https://sketchfab.com/DanielAndersson) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)',
 note:'90 m・装甲殻の下に開いた貨物架。上部殻を通常船体（断面表）とし、貨物架・機関・操縦室は原型モデルから実測した構造物',
 build(){
  // Upper shell: a domed section (warship section with a full-width keel and
  // a narrow deck) measured every 4 m; its underside stays flat at y 6.6.
  const SHELL=[[0,3.43,7.15,8.95],[5,5.34,6.5,8.93],[9,6.36,6.54,8.92],[13,7.11,6.62,9.3],[17,7.91,6.62,9.88],[21,8.7,6.64,10.44],[25,9.4,6.66,11.05],[29,10.21,6.68,11.6],[33,10.91,6.67,12.19],[37,11.74,6.67,12.77],[41,12.43,6.67,13.27],[45,12.73,6.68,13.91],[49,13.24,6.68,14.31],[53,13.68,6.68,14.64],[57,13.78,6.68,14.71],[61,13.58,6.69,14.59],[65,13.52,6.6,14.5],[69,12.85,6.79,14.13],[73,12.2,6.75,13.81],[77,10.1,7.4,13.06],[81,8.89,7.8,12.43],[85,6.62,7.84,10.98],[88,4.6,7.7,9.8],[90,2.2,7.9,9]];
  const W=27.6,H=10,stations=SHELL.map(([x,hw,y0,y1])=>[x/90,hw*2/W,(y1-y0)/H,(y0+y1)/2/H-.5,.36,.97,.12,.2]);
  const s=newShip({L:90,W,H,sec:'warship',plan:'rect',bowW:1,bowH:1,stern:1,keel:'std',bowFree:true,deckWidth:.36,keelWidth:.97,belt:.12,chineHeight:.2,stations},'GR-75中型輸送船');
  s._building=true;s.paint='neutral';s.detail=1;s.keel='std';s.armor={hull:.12,cit:.06};s.shieldTarget=1;
  const k=shipKit(s),part=(kind,label,c,d,opt={},mirror=false)=>placePart(s,kind,c,d,{label,...opt},mirror),room=(kind,label,c,size,opt={},mirror=false)=>part(kind,label,c,30,{room:size,...opt},mirror);
  const P={paint:GR_HULL},D={paint:GR_DARK};
  // Dorsal engine ridges along the shell and the raised cockpit pod.
  k.loftX('背部上部構造',[[6,-2.8,2.8,7.8,13.6],[9,-2.8,2.8,8,14.4],[30,-2.8,2.8,9.2,14.6],[40,-2.5,2.5,10.2,14.6],[46,-1.2,1.2,12.6,14.6]],{corner:.18,...P});
  for(const [z,y1,x1] of [[4.6,12.4,40],[7.2,11.2,36]])k.loftX('背部機関フィン',[[12.4,z-1.1,z+1.1,7.4,y1],[16,z-1.15,z+1.15,7.6,y1],[x1-6,z-1,z+1,9.4,y1+.4],[x1,z-.5,z+.5,11,y1+.1]],{corner:.3,...P},true);
  k.box('操縦室の支柱',[18.4,13.7,-1],[21.4,15.7,1],{corner:.2,skin:'plain',...D});
  k.ellipsoid('操縦室',[20.2,16.3,0],[7,4,4.2],{skin:'plain',...P});
  k.loftX('操縦室の窓',[[21.1,-1.3,1.3,15.85,17.85],[23.1,-1.1,1.1,16,17.7]],{corner:.3,skin:'plain',paint:GR_THROAT});
  // Ventral engine housing and the three ventral nozzles' sleeves.
  k.loftX('腹部機関収容部',[[13,-6.3,6.3,2.6,6.6],[20,-6.4,6.4,3.2,7.2],[25,-7.2,7.2,3.6,7.4],[30,-7.2,7.2,2.5,7.4],[38,-7.2,7.2,4,7.2],[42.3,-6,6,5.5,7]],{corner:.25,skin:'service',...P});
  // Cargo cradle: dark rack between the curved bilge walls, with containers.
  k.loftX('貨物架',[[39.3,-7.4,7.4,.6,6.8],[74,-7.4,7.4,.55,6.8],[77,-7,7,2.7,7],[81,-6,6,4.5,7.4],[86.9,-4,4,6.1,7.8]],{corner:.04,skin:'plain',paint:GR_RACK});
  const BILGE=[[5.6,.3],[7.5,.8],[9.3,1.8],[10.8,3],[12,4.2],[12.8,5.3],[13.5,6.8],[12.8,6.8],[12.2,5.4],[11.4,4.3],[10.2,3.2],[8.8,2.1],[7.2,1.3],[5.6,.95]];
  grPrismX(s,'下部舷側殻',40,73,BILGE,P,true,x=>x<52?.83+.17*(x-40)/12:x>64?1-.12*(x-64)/9:1);
  grPrismX(s,'下部舷側殻（後部）',27,40,[[7,1.6],[8.6,2.5],[9.6,3.6],[10.4,4.8],[11.2,6.8],[10.6,6.8],[9.9,4.9],[9.1,3.8],[8.1,2.8],[6.8,2.1]],P,true,x=>.86+.1*(x-27)/13);
  grPrismX(s,'下部舷側殻（前部）',73,77,[[7.6,1.6],[9.2,2.4],[10.4,3.6],[11.2,5],[11.9,6.8],[11.2,6.8],[10.6,5.1],[9.8,3.8],[8.8,2.9],[7.4,2.2]],P,true,()=>.93);
  for(const [x0,x1,y0,y1,z0,z1,c] of [[43.1,46,0.4,3.1,-1.7,1.7,'grey'],[46.2,48.8,2.9,4.9,7.9,10.5,'red'],[46.4,49.9,4.1,6.1,-11.6,-9.6,'green'],[48.9,52.7,2.8,7.5,2.7,10.5,'grey'],[51.7,54.3,2.9,4.9,-10.5,-7.9,'brown'],[54.3,57.8,0.8,2.8,-4.6,4.6,'green'],[57.55,59.55,2.65,4.65,-7.3,-2.7,'red'],[59.3,62,0.4,3.1,-1.7,4.7,'brown'],[62.4,67.6,2.8,4.8,3.7,10.5,'brown'],[65.2,67.6,2.8,4.8,-10.5,-7.9,'red'],[67.6,70.2,0.4,3.1,-4.7,4.8,'red'],[69.85,71.85,5.45,7.45,-9.8,9.8,'brown'],[71.9,74.4,0.4,3,-4.7,-0.3,'green'],[73.1,75.6,2.8,4.8,-6.2,6.2,'grey'],[76.2,79.8,3.4,6.4,-6.6,6.6,'green'],[80,85.2,5.95,7.95,-3.8,3.8,'brown']])
   k.box('貨物コンテナ',[x0,y0,z0],[x1,y1,z1],{corner:.05,skin:'plain',paint:GR_CARGO[c]});
  // Machinery. The aft reactor straddles the shell and the engine housing and
  // feeds every nozzle; two forward reactors carry the shields and hotel load.
  const gen=part('gen','主反応炉',[30.5,7.3,0],8.2);
  part('aux','補助反応炉',[47,10.2,0],6.8);
  part('aux','補助反応炉（前部）',[55,10.6,0],7.9);
  part('aux','補助反応炉（貨物架）',[66.5,3.7,0],5.6);
  for(const [x,y,z,d,l] of [[8,3.7,0,4.4,15],[11,4.5,4.4,4,14]])for(const sg of z>0?[-1,1]:[1]){
   placePart(s,'struct',[x+1.6,y,sg*z],[d+.9,d+.9,3.2],{label:'機関ノズル外筒',form:'arc',arcInner:.84,arcStart:0,arcSweep:360,pitch:-90,skin:'plain',...D},false);
   part('engine','亜光速機関',[x+l/2,y,sg*z],d,{dir:[-1,0,0],nozzleLength:l,bodyLength:2,bodyRadius:.4,reactor:gen.id});
  }
  // Blue running lights on the dorsal fins' aft faces (the model's glow panels).
  for(const z of [4.6,7.2])k.box('背部フィンの航行灯',[11.9,8.4,z-1],[13.9,10.4,z+1],{corner:.25,skin:'plain',paint:'#5f8ff0'},true);
  room('pump','反応物供給設備',[38.5,9.5,0],[5,6,4]);
  room('integrity','構造維持装置',[47,9,6.6],[8,4,4],{},true);
  part('fuel','反応物サイロ',[63,10.4,0],5.4,{length:8,dir:[1,0,0]});
  part('shield','シールド発生器',[64,9.2,6],5.6,{},true);
  part('hyper','ハイパードライブ',[71,10.2,0],4,{length:2,dir:[1,0,0]});
  part('inertial','慣性制御装置',[72.6,3.8,0],5.4,{length:5.2,dir:[1,0,0]});
  room('cargo','貨物区画（貨物架）',[52,3.7,0],[22,13,5]);
  room('command','操縦・指揮区画',[23,9.2,0],[4,4,4]);
  // Four twin laser cannons for close defence.
  const gun=(kind,x,z,axis,scale,zone)=>{const up=AXES[axis],h=rayEnv(s,[x,axis===3?-200:200,z],mul(up,-1),{structOnly:true});if(!h)throw new Error('GR-75の砲座がありません: '+x+','+z);const f={id:s.nextId++,k:kind,p:h.p,a:axis,ped:0,base:0,low:0,float:false,scale,chargeDepth:2,batteryZone:zone};mountFit(s,f);s.fits.push(f);return f;};
  syncAviationSurfaces(s);s._lockedCache=cache(s);
  try{withFrozenStructures(()=>{for(const x of [58,74])for(const z of [-6,6])gun('pd',x,z,2,.45,x<70?'dorsal':'bow');});}finally{delete s._lockedCache;}
  delete s._building;remount(s);return s;
 }
});
}

// ---- src/ships/heraklon.js ----
// Heraklon-class transport (Star Wars: The Old Republic), measured from
// Daniel's Sketchfab model at its own metric scale (272.4 m). Ship frame:
// x stern 0 -> bow 272.4, y up from the keel, z starboard. The hull is a
// single slender rod hidden in the spine; every visible body is a structure.
registerShipExample({
 key:'heraklon',name:'ヘラクロン級輸送艦',side:'銀河共和国',role:'輸送艦（貨物・旅客）',length:272.4,
 author:'Daniel (https://sketchfab.com/DanielAndersson)',
 source:'https://sketchfab.com/3d-models/star-wars-heraklon-class-transport-c1d686a791194ab680524094813cde17',
 license:'CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)',
 credit:'This work is based on "Star Wars: Heraklon-class Transport" (https://sketchfab.com/3d-models/star-wars-heraklon-class-transport-c1d686a791194ab680524094813cde17) by Daniel (https://sketchfab.com/DanielAndersson) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)',
 note:'サドン・シップライト社のフリゲート型輸送艦。旧共和国が広く用いた非武装の貨客船。細い棒状の船体を背骨に、幅広の機関区画、艦尾の艦橋楼、細い連結部、前部の大型貨物区画をすべて構造物で組み、左舷のドッキングベイにシャトル2機。旅客450名（三段寝台）、貨物倉が艦内の大半を占める。',
 build(){
  // [t, width, depth, centre]: a 10 m rod at y 37 that drops into the engine
  // block at the stern and tapers out inside the sloped bow.
  const s=newShip({L:272.4,W:20,H:30,sec:'ellipse',plan:'rect',bowFree:true,stern:1,
   stations:[[0,.05,.0333,.0333],[.015786,.5,.2667,.0333],[.047724,.5,.3333,.7333],[.954479,.5,.3333,.7333],[1,.025,.0167,.35]]},'ヘラクロン級輸送艦');
  s._building=true;s.paint='neutral';s.detail=1;s.keel='light';s.armor={hull:.2,cit:0};
  const k=shipKit(s),part=(kind,label,c,d,opt={},mirror=false)=>placePart(s,kind,c,d,{label,...opt},mirror),room=(kind,label,c,size,opt={},mirror=false)=>part(kind,label,c,30,{room:size,...opt},mirror);
  const dark='#454a50',yellow='#b8a14a';
  // ---- Stern engine block: a broad V-bottomed body under a shallow roof.
  k.put('艦尾機関区画（V字船底）',[34.75,14.25,0],[69.5,102.6,15.5],{form:'trap',angles:[0,0,70,70],roll:180,skin:'service'});
  k.put('艦尾機関区画の上甲板',[34.75,24.05,0],[69.5,102.6,4.1],{form:'trap',angles:[0,0,70,70]});
  // Bridge castle with its sloped aft face, hip roof and windowed cabin.
  k.loftX('艦尾艦橋楼',[[4.8,-11.5,11.5,25.2,25.6],[12,-11.5,11.5,25.2,54.5],[49,-11.5,11.5,25.2,54.5],[49.8,-11.5,11.5,25.2,53.7]],{corner:.04});
  k.put('艦橋楼の寄棟屋根',[30.9,57.1,0],[37.8,23,5.7],{form:'trap',angles:[54.5,50,33,33]});
  const cabin=k.put('艦橋キャビン',[31.65,63.85,0],[22.7,14,8.7],{form:'trap',angles:[19,19,8.5,8.5],skin:'service'});
  k.put('艦橋楼の基部補強',[27.5,27.85,0],[43,34,5.3],{form:'trap',angles:[0,0,44,44]});
  // ---- Narrow spine between the engine block and the cargo section.
  k.loftX('後部連結胴',[[46,-8.8,8.8,25.2,52.9],[113.5,-8.8,8.8,25.2,52.9]],{corner:.1});
  k.loftX('連結胴の下部竜骨',[[65.7,-5.15,5.15,20.4,25.6],[169.7,-5.15,5.15,12.7,25.6]],{corner:.1,paint:dark});
  k.loftX('前部連結胴',[[113.5,-6.1,6.1,23,50.2],[137.5,-6.1,6.1,23,50.2]],{corner:.08,paint:dark});
  k.loftX('連結胴の黄色い接続部',[[119.8,-5.4,5.4,19.7,37.6],[137,-8.6,8.6,19.7,37.6]],{corner:.06,paint:yellow});
  k.loftX('貨物区画下の黄色い接続部',[[137,-8.6,8.6,19.7,27.5],[168,-11.5,11.5,19.7,27.5]],{corner:.06,paint:yellow});
  // ---- Forward cargo and passenger section: a tapering tower over a lower hold.
  k.put('前部貨物区画・後端',[148.4,38.45,0],[23.2,34.8,28.5],{form:'trap',angles:[0,0,11.8,11.8]});
  k.put('前部貨物区画・主部',[181.5,40.95,0],[43,45,33.5],{form:'trap',angles:[8.5,6.8,13.1,13.1]});
  k.put('前部貨物区画・中部',[220,39.1,0],[34,35.4,29.8],{form:'trap',angles:[0,0,11.8,11.8]});
  k.put('前部貨物区画・艦首',[254.7,39.5,0],[35.4,35.8,30.6],{form:'trap',angles:[0,24.6,12.4,12.4]});
  k.box('艦首の展望キャビン',[246.8,54.4,-10.6],[261.9,59.4,10.6],{corner:.1,skin:'service'});
  k.box('貨物区画の中央帯',[167,18.1,-13.25],[268.5,24.5,13.25],{corner:.04,paint:dark});
  k.put('下部貨物倉・後部',[183.95,9.55,0],[39.1,47.2,17.9],{form:'trap',angles:[6.7,0,10.4,10.4],roll:180});
  k.put('下部貨物倉・前部',[226.75,11.15,0],[46.5,36.4,14.7],{form:'trap',angles:[0,0,11.5,11.5],roll:180});
  k.loftX('下部貨物倉・艦首',[[250,-17.9,17.9,5.2,18.5],[260,-17.5,17.5,7.4,18.5],[266,-17.3,17.3,9.8,18.5],[270,-17.1,17.1,12.7,18.5],[272,-17.1,17.1,16.5,18.5]],{corner:.12});
  // ---- Machinery. Eight turbines across the rear face of the engine block.
  const r=part('gen','主反応炉',[30,18.6,0],22.6);
  for(const [z,y,d] of [[12,16.5,9],[21.5,18.3,9],[30.5,20,8],[38.2,21.5,6]]){
   const o=equipmentOptions('exposedTurbine'),e=placePart(s,'engine',[0,y,z],d,{...o,label:'艦尾主推進機関',d,reactor:r.id,dir:[-1,0,0]},true);
   for(const q of s.parts.filter(q=>q.id===e.id||q.id===e.tw)){resizeEngine(q,d,engineBaseline('exposed',d,'length'));q.c[0]=-.5+q.nozzleLength/2;}
  }
  part('shield','偏向シールド発生器',[58,15.2,0],11.8);
  part('hyper','ハイパードライブ（クラス2）',[90,37,0],8,{length:18,dir:[1,0,0]});
  part('fuel','反応物サイロ',[58,18,-24],7,{dir:[1,0,0],length:12},true);
  room('pump','反応物供給設備',[44,16,-18],[6,5,5],{},true);
  part('inertial','慣性補償装置',[60,40,0],10.5,{length:26,dir:[1,0,0]});
  room('integrity','構造維持装置',[124,37,0],[14,10,11]);
  room('troops','旅客・兵員区画（三段寝台450名）',[30,40.5,0],[32,18,9.4]);
  room('crew','乗員居住区画',[30,49.5,0],[30,18,6]);
  room('cargo','主貨物倉（右舷）',[190.25,37.5,11],[15.5,10,22]);
  room('service','シャトル整備・補給区画',[174.5,37.5,11],[15,10,20]);
  room('cargo','中部貨物倉',[220,36.5,0],[30,24,21]);
  room('cargo','艦首貨物倉',[248,37,0],[18,24,20]);
  room('cargo','下部貨物倉（後部）',[184,9.5,0],[34,36,13]);
  room('cargo','下部貨物倉（前部）',[226,11.5,0],[34,28,11]);
  const bay=room('hangar','左舷ドッキングベイ（シャトル2機）',[182,38.6,-5.6],[32,22,20],{airRole:'mixed'});openBay(s,bay,'port','ray');
  delete s._building;
  // Bridge pod on the windowed front of the cabin.
  {const h=rayPart([cabin.c[0]+40,cabin.c[1],0],[-1,0,0],cabin);if(h){const f=placeFit(s,'podBridge',h.p,h.n,0,false);if(f.fit){f.fit.width=10;f.fit.height=4;mountFit(s,f.fit);}}}
  adoptEquipment(s,true);remount(s);return s;
 }
});

// ---- src/ships/lucrehulk.js ----
// Lucrehulk-class battleship (droid control ship), measured from "Lucrehulk" by
// Professor E12^2 on Sketchfab (CC BY 4.0). Ship frame: x from the stern (0)
// to the bow (3,170 m), y up from the lowest point, z to starboard. The hull is
// the core sphere (elliptical sections; a thin keel line runs fore and aft of
// it). The C-shaped ring is an arc structure open at the bow; the engine block,
// the spine to the core, the three drive nacelles, the forward arm claws and
// the keel spike under the core are ordinary structures.
{
const LUCR={"W":640.0,"H":660.0,"st":[[0.0,0.005,0.005,0.1258],[0.40418,0.005,0.005,0.1258],[0.40618,0.0596,0.0585,0.1258],[0.41633,0.4328,0.4249,0.1258],[0.42648,0.5957,0.5849,0.1258],[0.43663,0.709,0.6962,0.1258],[0.44678,0.7942,0.7799,0.1258],[0.45692,0.8598,0.8442,0.1258],[0.46707,0.9099,0.8935,0.1258],[0.47722,0.9471,0.9299,0.1258],[0.48737,0.9728,0.9552,0.1258],[0.49752,0.9878,0.97,0.1258],[0.50767,0.9928,0.9748,0.1258],[0.51781,0.9878,0.97,0.1258],[0.52796,0.9728,0.9552,0.1258],[0.53811,0.9471,0.9299,0.1258],[0.54826,0.9099,0.8935,0.1258],[0.55841,0.8598,0.8442,0.1258],[0.56856,0.7942,0.7799,0.1258],[0.5787,0.709,0.6962,0.1258],[0.58885,0.5957,0.5849,0.1258],[0.599,0.4328,0.4249,0.1258],[0.60915,0.0596,0.0585,0.1258],[0.61115,0.005,0.005,0.1258],[1.0,0.005,0.005,0.1258]],"loft":{"engineBlock":[[-1057.59,-38.12,38.12,258.17,258.3],[-1047.31,-38.12,38.12,232.62,258.45],[-1044.74,-101.01,101.01,226.2,533.75],[-1024.18,-232.65,232.65,174.85,551.2],[-1021.61,-516.8,516.8,168.43,553.39],[-959.92,-614.97,614.97,164.21,598.04],[-913.66,-682.41,682.41,164.21,610.89],[-769.73,-602.9,602.9,164.21,636.15],[-669.49,-550.99,550.99,164.21,641.61],[-664.35,-548.35,548.35,154.29,641.6],[-633.51,-532.5,532.5,157.37,641.55],[-612.95,-521.94,521.94,164.21,641.51],[-540.98,-484.96,484.96,164.21,634.15],[-538.41,-483.64,483.64,177.02,632.54],[-502.43,-465.15,465.15,177.93,610.06],[-499.86,-463.83,463.83,178.04,306.06],[-451.02,-438.74,438.74,180.14,306.06],[-448.45,-103.13,103.13,180.25,306.06],[-363.64,-111.15,111.15,190.23,306.06],[-317.37,-115.53,115.53,247.79,306.06],[-286.53,-118.44,118.44,305.96,306.06]],"spine":[[-448.07,-177.87,177.87,252.68,557.13],[-284.64,-173.66,173.66,255.14,554.66],[-165.03,-129.62,129.62,278.82,530.84],[55.68,-129.62,129.62,279.07,530.84],[57.36,-129.62,129.62,386.93,435.91]],"nacelleC":[[-1263.28,-86.94,86.94,321.87,495.74],[-1258.67,-90.85,90.85,317.96,499.65],[-1250.39,-86.8,86.8,322.0,495.61],[-987.09,-86.8,86.8,322.0,495.61]],"nacelleS":[[-1263.28,223.87,397.75,321.87,495.74],[-1258.67,219.96,401.66,317.96,499.65],[-1250.39,224.01,397.61,322.0,495.61],[-987.09,224.01,397.61,322.0,495.61]],"claw":[[997.45,736.29,736.5,229.03,597.2],[1011.35,716.88,775.1,206.14,620.1],[1014.13,712.98,1208.95,202.9,623.33],[1175.36,461.88,1096.06,186.67,639.56],[1192.04,412.28,1084.38,186.67,639.57],[1194.82,366.78,1082.44,186.67,639.56],[1239.3,348.23,1043.83,186.75,639.49],[1283.77,288.32,999.35,186.77,639.46],[1342.15,264.83,940.98,195.05,631.19],[1414.42,295.36,855.26,211.26,614.97],[1425.54,311.39,839.38,234.78,591.46],[1436.66,339.27,823.5,327.59,498.64],[1442.22,353.22,815.56,334.32,496.93],[1445.0,416.66,811.59,340.16,496.93],[1495.04,428.7,751.49,334.61,499.78],[1517.28,435.06,750.19,329.14,505.25],[1520.06,437.2,745.39,328.45,505.94],[1522.83,437.87,740.59,296.82,537.57],[1542.29,416.35,706.99,298.66,535.73],[1620.13,432.94,579.05,334.92,499.47],[1664.6,442.42,535.23,359.43,474.96],[1667.38,468.06,532.49,370.39,465.63],[1706.3,490.11,494.15,405.42,430.6],[1709.08,461.28,461.88,370.92,474.52],[1739.66,439.04,479.01,370.92,474.52],[1820.27,394.02,420.27,370.92,474.52],[1823.05,396.79,418.24,370.92,474.52],[1825.83,400.12,416.22,399.4,446.04],[1831.39,412.06,412.2,401.98,443.46]],"sphereKeel":[[-27.5,-25.76,25.76,297.06,297.13],[137.7,-25.76,25.76,56.68,297.13],[221.54,-25.76,25.76,56.68,297.13]]},"rooms":[["hangar","右舷アーム 艦載機ラック（ドロイド・スターファイター）",[1150.7,415,725],[39.4,649.4,349.4],"storage"],["hangar","右舷アーム 艦載機ラック（ドロイド・スターファイター） 2",[1110.7,420,745],[39.4,689.4,319.4],"storage"],["hangar","右舷アーム 艦載機ラック（ドロイド・スターファイター） 3",[1270.7,415,665],[39.4,529.4,389.4],"storage"],["hangar","右舷アーム 艦載機ラック（ドロイド・スターファイター） 4",[1230.7,410,695],[39.4,589.4,339.4],"storage"],["hangar","右舷アーム 艦載機ラック（ドロイド・スターファイター） 5",[1070.7,415,770],[39.4,739.4,269.4],"storage"],["hangar","右舷アーム 艦載機ラック（ドロイド・スターファイター） 6",[1308.45,415,640],[34.89,479.4,389.4],"storage"],["hangar","左舷アーム 艦載機ラック（ドロイド・スターファイター）",[1150.7,415,-725],[39.4,649.4,349.4],"storage"],["hangar","左舷アーム 艦載機ラック（ドロイド・スターファイター） 2",[1110.7,420,-745],[39.4,689.4,319.4],"storage"],["hangar","左舷アーム 艦載機ラック（ドロイド・スターファイター） 3",[1270.7,415,-665],[39.4,529.4,389.4],"storage"],["hangar","左舷アーム 艦載機ラック（ドロイド・スターファイター） 4",[1230.7,410,-695],[39.4,589.4,339.4],"storage"],["hangar","左舷アーム 艦載機ラック（ドロイド・スターファイター） 5",[1070.7,415,-770],[39.4,739.4,269.4],"storage"],["hangar","左舷アーム 艦載機ラック（ドロイド・スターファイター） 6",[1308.45,415,-640],[34.89,479.4,389.4],"storage"],["service","航空整備・補給区画",[-539.3,525,0],[59.4,1739.4,149.4]],["service","航空整備・補給区画 2",[-940.09,270,0],[57.82,999.4,199.4]],["vehicle","MTT・AAT 格納区画",[-999.3,270,0],[19.4,879.4,199.4]],["vehicle","地上装甲車両の長期保管ガレージ（格納甲板床下）",[-979.3,270,0],[19.4,939.4,199.4]],["troops","兵員収容区画（B1バトル・ドロイド）",[-1000.57,435,-155],[56.86,229.4,129.4]],["cargo","貨物ベイ",[-944.3,520,0],[49.4,999.4,139.4]],["cargo","貨物ベイ 2",[-1160,350,0],[58.89,99.4,19.4]],["cargo","貨物ベイ 3",[-1239.3,410,-380],[19.4,19.4,59.4]],["cargo","大規模弾薬庫",[-899.3,270,0],[19.4,1139.4,199.4]],["integrity","主ドロイド制御コンピューター支援システム（構造維持）",[-895.57,530,0],[26.86,1139.4,159.4]],["integrity","主ドロイド制御コンピューター支援システム（構造維持） 2",[-1190,410,-240],[19.4,19.4,59.4]],["pump","パイロット炉燃料ポンプ・圧力安定装置",[-1039.3,415,-155],[19.4,229.4,109.4]]]};
const LUC_AIR=[{id:'air-1',name:'ヴァルチャー級ドロイド・スターファイター',size:1,count:1500},{id:'air-2',name:'C-9979 上陸艇',size:200,count:50}];
const LUC_GROUND=[{id:'ground-1',name:'B1バトル・ドロイド',kind:'troops',count:139000},{id:'ground-2',name:'MTT 大型兵員輸送車',kind:'vehicle',size:8,count:550},{id:'ground-3',name:'AAT 装甲強襲戦車',kind:'vehicle',size:1,count:6250}];
const LUC_TAN='#a89a7c',LUC_BROWN='#8f8268',LUC_STEEL='#6f7a86',LUC_DARK='#5f646b';
function lucrehulkBuild(opt={}){
 const D=LUCR,DX=-1289.3,X=v=>v+DX,R=320,L=2*R;
 // The base hull is the core ship: a sphere 640 m across (measured from the model;
 // canon gives about 696 m), centred 413 m above the lowest point of the ring.
 // Everything else, the C-ring, aft block, arms, claws and towers, is structure.
 const st=[];for(let i=0;i<=24;i++){const t=(1-Math.cos(Math.PI*i/24))/2,r=Math.max(.005,Math.sqrt(Math.max(0,1-(2*t-1)**2)));st.push([+t.toFixed(5),+r.toFixed(4),+r.toFixed(4),+(413/L-.5).toFixed(4)]);}
 const s=newShip({L,W:L,H:L,sec:'ellipse',plan:'ellipse',bowW:1,bowH:1,stern:1,bowFree:true,stations:st,keel:'light'},'ルクレハルク級');
 s.hull.core=true;s.shipClass='battlecruiser';
 s._building=true;s.reference='lucrehulk';s.paint='cis';s.lights='warm';s.detail=1;s.armor={hull:.46,cit:.4};s.shieldTarget=1;
 const k=shipKit(s),part=(kind,label,c,d,o={})=>placePart(s,kind,c,d,{label,...o});
 const loft=(name,label,paint,o={},mirror=false)=>k.loftX(label,D.loft[name],{paint,corner:.12,...o},mirror);
 const col=(label,x,z,y0,y1,w,paint,o={},mirror=false)=>k.box(label,[x-w/2,y0,z-w/2],[x+w/2,y1,z+w/2],{paint,corner:.2,...o},mirror);
 const dish=(label,c,d,t,paint,mirror=false)=>k.ellipsoid(label,c,[t,d,d],{paint},mirror);
 // The ring, arms, spine and aft block are a converted freighter's light
 // construction (light structures: a quarter of the mass and strength of solid ones).
 // The ring: outer radius 1,403 m about the core axis, inner radius ratio 0.535,
 // 428 m deep, open ±25° at the bow.
 k.ring('環状船体（C字リング）',[X(1611),418,0],1403,1403,428,{inner:.535,start:25,sweep:310,paint:LUC_TAN,light:true});
 loft('engineBlock','艦尾ブロック（主反応炉・主推進区画）',LUC_BROWN,{corner:.2,light:true});
 loft('spine','中央脊柱（コアシップ接続部）',LUC_TAN,{corner:.25,light:true});
 loft('nacelleC','主推進機関スラスト・チャンバー（中央）',LUC_STEEL,{round:true});
 loft('nacelleS','主推進機関スラスト・チャンバー（舷側）',LUC_STEEL,{round:true},true);
 loft('claw','主ドッキング・クロー',LUC_BROWN,{corner:.2,light:true},true);
 k.box('主ドッキング・クロー先端',[X(3105),404,403],[X(3170),440,421],{paint:LUC_BROWN,corner:.3},true);
 loft('sphereKeel','コアシップ下部の着陸脚基部',LUC_DARK,{corner:.1});
 // ---- aft dorsal signal transmitter platform and its towers ----
 k.box('信号送信プラットフォーム',[X(560),600,-150],[X(860),652,150],{paint:LUC_BROWN,corner:.1});
 for(const z of [-60,60])col('予備制御信号送信塔',X(650),z,640,880,16,LUC_STEEL);
 col('予備制御信号送信塔',X(760),0,640,850,16,LUC_STEEL);
 for(const z of [-115,115])col('送信塔アンテナ',X(700),z,640,820,6,LUC_DARK);
 for(const x of [600,700,810])col('高エネルギー送信塔',X(x),-30,640,790,10,LUC_STEEL);
 col('主センサー・レクテナ支柱',X(820),60,640,700,14,LUC_DARK);
 dish('主センサー・レクテナ',[X(820),720,60],90,12,LUC_STEEL);
 for(const z of [-95,95])dish('補助センサー・レクテナ',[X(600),670,z],40,8,LUC_STEEL);
 // ---- ring top near the core: deflector shield generator housing and projectors ----
 k.ellipsoid('偏向シールド発生器ハウジング',[X(960),575,0],[140,150,80],{paint:LUC_TAN});
 for(const z of [-380,380])k.ellipsoid('偏向シールド投射器',[X(830),592,z],[40,40,30],{paint:LUC_STEEL});
 // ---- core ship: control bridge tower on top ----
 col('コアシップ管制ブリッジ塔',X(1609),0,700,790,44,LUC_TAN);
 col('ブリッジ塔頂部アンテナ',X(1609),0,780,900,4,LUC_DARK);
 // ---- forward arms: receiver station, forward control tower, rectenna, tractor housings ----
 // (each seated on the arm's top or underside where the tapering arm still carries it)
 for(const sg of [1,-1]){
  k.ellipsoid('ドロイド信号受信ステーション',[X(2639),632,sg*850],[70,70,36],{paint:LUC_STEEL});
  col('前部管制塔',X(2539),sg*930,630,710,30,LUC_TAN);
  dish('予備センサー・レクテナ',[X(2789),573,sg*600],40,8,LUC_STEEL);
  k.ellipsoid('主トラクター・ビーム発生器',[X(2950),470,sg*560],[90,70,90],{paint:LUC_DARK});
  k.ellipsoid('ドッキング・トラクター・ビーム収納部',[X(3040),349,sg*455],[70,50,60],{paint:LUC_DARK});
 }
 // ---- forward arms: three hangar zones a side, portals on the inner faces facing the gap ----
 const docks=[];
 for(const [x,zone] of [[2650,'外側格納庫（第1区画）'],[2520,'中間格納庫（第2区画）'],[2390,'内側格納庫（第3区画）']])for(const sg of [1,-1]){
  const d=part('hangar',(sg>0?'右舷アーム ':'左舷アーム ')+zone+'・主格納庫口',[X(x),418,sg*300],30,{room:[100,200,400],airRole:'mixed'});
  openBay(s,d,sg>0?'port':'stbd','open');docks.push(d);}
 if(opt.stage==='dock'){delete s._building;return s;}
 // ---- core ship: centersphere reactor and power generator assemblies in the lower half ----
 const r=part('gen','コア中央球反応炉・発電機集合体',[X(1609),290,0],240);
 // ---- aft block: port and starboard main reactors; the drive thrust chambers draw on the core plant ----
 for(const sg of [1,-1])part('aux',sg>0?'右舷主反応炉（艦尾ブロック）':'左舷主反応炉（艦尾ブロック）',[X(640),470,sg*420],150);
 const eo=equipmentOptions('exposedTurbine');
 for(const [z,rr] of [[-311,r],[0,r],[311,r]]){const d=136,nl=engineBaseline('exposed',d,'nozzleLength'),len=engineBaseline('exposed',d,'length')*1.5;const p=placePart(s,'engine',[X(nl/2),409,z],d,{...eo,label:z?'舷側主推進機関':'中央主推進機関',d,reactor:rr.id,dir:[-1,0,0],engineLength:len},false);resizeEngine(p,d,len);}
 // ---- deflector shield generators under the housing; hyperdrive; inertial units; fuel ----
 for(const sg of [-1,1])part('shield','偏向シールド発生器',[X(960),500,sg*70],80);
 part('hyper','主ハイパードライブ',[X(520),565,0],73.5,{length:180});
 for(const sg of [-1,1])part('inertial','慣性補償装置',[X(1250),418,sg*1080],170,{length:160,dir:[1,0,0]});
 for(const sg of [-1,1])part('fuel','パイロット炉燃料タンク',[X(1611),418,sg*1250],70,{length:200,dir:[0,1,0]});
 // ---- core ship interior: droid control computer core, monitoring stations, repulsorlifts ----
 part('command','ドロイド制御コンピューター・コア',[X(1609),470,0],30,{room:[90,90,70]});
 for(const sg of [-1,1])part('command','制御コンピューター・コア配電監視ステーション',[X(1609),470,sg*120],30,{room:[60,50,40]});
 part('repulsor','コアシップ着陸用リパルサーリフト',[X(1609),140,0],140,{dir:[0,1,0],length:30});
 if(opt.stage==='machinery'){delete s._building;return s;}
 // Heavy guns keep their charging plant wholly inside the envelope and clear of
 // machinery: the plant is pushed deeper until all its corners are enclosed.
 let solidList=null;
 const plantFits=f=>{if(!needsCapacitor(f))return true;const q=weaponChargeSpec(f),depth=12*(f.scale||1),side=Math.sqrt(q.targetVolume/depth),up=fitUp(f),fr=frameAxis(up);solidList=solidList||allOccupied(s).map(p=>({p,b:partAABB(p)}));
  for(const cd of [10,13,16,20,24,28,33,38,44]){const c=sub(f.p,mul(up,cd+(f.mountOffset||0)));let ok=true;
   for(const a of [-.5,0,.5])for(const b of [-.5,0,.5])for(const e of [-.5,0,.5]){const pt=add(c,add(mul(up,a*depth),add(mul(fr.v,b*side),mul(fr.w,e*side))));if(!insideOriginalEnvelope(s,pt)||solidList.some(o=>pt.every((v,i)=>v>=o.b[i]&&v<=o.b[i+3])&&inPart(o.p,pt))){ok=false;break;}}
   if(ok){f.chargeDepth=cd;return true;}}return false;};
 // One fitting cast onto the outermost surface along its axis. Armour plates take
 // no fittings, so a probe that lands on a plate (or finds no surface) is refused.
 const tryMount=(kind,p,axis,zone,o={})=>{const f={id:s.nextId++,k:kind,p:p.slice(),a:axis,ped:0,base:0,low:0,float:false,batteryZone:zone,...o};mountFit(s,f);const why=f._onPlate?'plate':f.float?'float':!plantFits(f)?'plant':'';if(opt.dbg)opt.dbg.push([kind,zone,p.map(Math.round).join(','),why||'ok',f.p.map(Math.round).join(',')]);if(why){s.nextId--;return null;}return f;};
 const clearOf=(f,list)=>list.every(g=>Math.hypot(f.p[0]-g.p[0],f.p[1]-g.p[1],f.p[2]-g.p[2])>=((FITS[f.k]?.fm||10)+(FITS[g.k]?.fm||10))*.5+2);
 // n fittings over candidate stations: dorsal ('top') and ventral ('bottom') rows
 // take |z| offsets and mount as mirrored pairs (0 = centreline); 'beam' rows take
 // heights and mount one a side. Stations on plates or crowding others are skipped.
 const spread=(kind,n,mode,zone,xs,offs,o={})=>{let got=0;
  for(const off of offs)for(const x of xs){if(got>=n)break;
   const ps=mode==='beam'?[[[x,off,400],4],[[x,off,-400],5]]:(off?[1,-1]:[1]).map(sg=>[[x,0,sg*off],mode==='top'?2:3]);
   if(got+ps.length>n)continue;const fs=[];
   for(const [p,a] of ps){const f=tryMount(kind,p,a,zone+(ps.length>1?(p[2]>0?'-stbd':'-port'):''),o);if(!f||!clearOf(f,s.fits.concat(fs)))break;fs.push(f);}
   if(fs.length<ps.length)continue;s.fits.push(...fs);got+=fs.length;}
  if(got<n)throw new Error('作例の砲座が不足しています: '+kind+' '+zone+' '+got+'/'+n);};
 const range=(a,b,st)=>{const r=[];for(let x=a;x<=b+1e-6;x+=st)r.push(x);return r;};
 // Pods seat on the first wall hit among a few probe heights.
 const pod=(kind,host,o,dir,w,h)=>{let err='取付面がありません';for(const dy of [0,-4,4,-8,8,-12,12,-16,16])for(const dz of [0,-6,6,-12,12]){const q0=[o[0],o[1]+dy,o[2]+(dir[2]?0:dz)];const hit=rayPart(q0,dir,host);if(!hit)continue;const r=placeFit(s,kind,hit.p,hit.n,0,false);if(r.fit){r.fit.width=w;r.fit.height=h;r.fit.commandDepth=7;r.fit.commandHeight=5;return r.fit;}err=r.err;}throw new Error('艦橋ポッド '+kind+': '+err);};

 const claw=s.parts.find(p=>p.label==='主ドッキング・クロー'&&p.c[2]>0),btower=s.parts.find(p=>p.label==='コアシップ管制ブリッジ塔');
 pod('podBridge',btower,[X(1609),750,60],[0,0,-1],14,5);
 pod('podAir',claw,[X(2800),418,-200],[0,0,1],14,5);
 syncAviationSurfaces(s);s._lockedCache=cache(s);
 try{withFrozenStructures(()=>{
  // 42 quad laser batteries: fourteen typical triple quad laser batteries along the ring's equator
  for(let g=0;g<7;g++){const a0=42+g*20;spread('quad200',6,'beam','midline-'+(g+1),[a0-4,a0,a0+4].map(a=>X(1611)+1403*Math.cos(a*Math.PI/180)),[418,430,406,442,394]);}
  // transmitter platform defence artillery
  spread('pd',4,'top','platform-defence',range(X(570),X(850),30),[130,100]);
  // main tractor beam generators and multiple tractor beam projectors on the forward arms
  spread('trc',6,'beam','arm-tractor',range(X(2860),X(3060),20),[470,430,510,390]);
 });}finally{delete s._lockedCache;}
 if(opt.stage==='fitted'){delete s._building;return s;}

 if(opt.stage==='shape'){delete s._building;return s;}
 for(const [kind,label,c,size,role,mirror] of D.rooms||[]){const o={room:size};if(typeof role==='string')o.airRole=role;placePart(s,kind,c,30,{label,...o},mirror===1||role===1);}
 s.airWings=LUC_AIR.map(r=>({...r}));s.groundForces=normalizeGroundForces(LUC_GROUND);
 delete s._building;adoptEquipment(s,true);remount(s);calibrateReferenceRatings(s);syncCompartments(s);
 return s;

}
registerShipExample({
 key:'lucrehulk',name:'ルクレハルク級',side:'独立星系連合',role:'環状母艦（ドロイド司令船）',length:3170,
 title:'Lucrehulk',author:'Professor E12^2',authorUrl:'https://sketchfab.com/profanity2009',
 source:'https://sketchfab.com/3d-models/lucrehulk-8bb11e0ad31e4b23b1783e10242c5115',license:'CC BY 4.0',
 credit:'This work is based on "Lucrehulk" (https://sketchfab.com/3d-models/lucrehulk-8bb11e0ad31e4b23b1783e10242c5115) by Professor E12^2 (https://sketchfab.com/profanity2009) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)',
 note:'基本船体は直径 640 m の球形のコアシップ（モデルから実測、公式は約 696 m）で、C 字形の環状船体・艦尾ブロック・前部アームとドッキング・クロー・各種の塔はすべて構造物（全長 3,170 m）。コアシップの中心にドロイド制御コンピューター・コアと配電監視ステーション、下半分にコア中央球反応炉・発電機集合体、底部に着陸用リパルサーリフト、頂部に管制ブリッジ塔。艦尾背部の信号送信プラットフォームに予備制御信号送信塔・送信塔アンテナ・主／補助センサー・レクテナ・高エネルギー送信塔と防衛砲、前部アームにドロイド信号受信ステーション・前部管制塔・予備センサー・レクテナ・主トラクター・ビーム発生器とドッキング用トラクター・ビーム収納部、環状船体上部に偏向シールド発生器ハウジングと投射器。各アームの内側面に外側・中間・内側の 3 区画の主格納庫口、ドロイド・スターファイターのラック、MTT・AAT 格納区画、格納甲板床下の長期保管ガレージ、貨物ベイ、大規模弾薬庫。艦尾ブロックに左右の主反応炉と主推進機関スラスト・チャンバー。兵装は環状船体の赤道に沿った三連四連レーザー砲台 14 群（計 42 基）。ヴァルチャー 1,500 機、C-9979 上陸艇 50 隻、B1 バトル・ドロイド 13 万 9,000 体、MTT 550 両、AAT 6,250 両。ハイパードライブ・クラス 2、加速約 1,300 G はゲーム上の設定値。Sketchfab の 3D モデル（Professor E12^2 作、CC BY 4.0）を実測。',
 airWings:LUC_AIR,groundForces:LUC_GROUND,
 build:lucrehulkBuild
});
}

// ---- src/ships/munificent.js ----
// Munificent-class star frigate, measured from "Munificent Class Star Frigate"
// by SomeGuyUsingBlender on Sketchfab (CC BY 4.0). Ship frame: x from the
// stern (0) to the bow (825 m), y up from the lowest point, z to starboard.
// The hull is a single slender rod (elliptical section) along the spine; the
// forward dome halves and centre dome, the forward core and keel, the command
// tower, the neck, the broad wing, the two hyperwave transceiver masts, the
// aft dorsal shells and the drive section are ordinary structures.
{
const MUNI={"loft":{"aftShell":[[0.0,15.52,15.64,108.89,109.02],[8.81,13.6,23.38,108.58,116.35],[10.58,13.85,26.92,108.12,117.13],[14.98,13.96,28.84,108.73,118.61],[15.86,13.99,36.0,103.85,118.91],[27.32,13.58,41.75,106.84,122.49],[38.78,13.61,45.29,108.42,125.41],[39.66,13.52,50.26,102.41,125.66],[57.29,14.65,54.22,108.19,129.66],[59.93,14.41,57.88,106.61,130.37],[66.1,15.06,56.15,107.14,130.39],[84.61,15.63,61.27,106.9,133.61],[85.49,15.63,66.81,107.04,133.7],[95.19,15.63,63.64,108.0,133.89],[117.22,15.63,67.61,108.3,137.1],[118.1,15.63,72.5,101.61,137.26],[148.07,15.63,77.77,100.86,139.94],[150.71,15.63,74.5,106.87,140.04],[152.48,15.63,78.97,103.63,140.41],[159.53,15.63,74.72,106.69,140.79],[200.95,15.63,76.68,107.37,142.1],[201.83,15.63,67.67,112.98,142.14],[204.48,15.63,56.87,112.98,142.25],[229.15,15.63,56.87,112.97,142.04],[230.04,15.63,71.95,112.97,142.07],[247.66,15.63,68.64,113.02,142.81],[248.54,15.63,56.16,113.99,142.84],[258.24,15.63,36.53,124.76,143.25],[259.12,15.63,34.59,125.73,133.69],[264.41,15.63,15.83,131.62,131.68]],"aftCore":[[85.65,-33.43,33.43,90.01,127.1],[92.7,-36.34,36.34,87.67,129.71],[94.82,-37.15,37.15,74.6,132.17],[115.98,-39.18,39.18,67.73,134.06],[121.62,-48.02,48.02,66.42,136.18],[132.9,-40.01,40.01,64.94,134.06],[141.36,-48.58,48.58,63.33,134.06],[147.0,-41.06,41.06,63.21,135.05],[158.29,-50.06,50.06,61.61,135.05],[162.52,-41.06,41.06,60.52,135.05],[166.04,-41.06,41.06,58.73,135.05],[168.86,-51.0,51.0,58.73,132.03],[174.5,-51.41,51.41,54.48,135.83],[177.32,-41.9,41.9,54.48,135.83],[182.26,-42.48,42.48,54.48,144.56],[185.79,-51.68,51.68,53.92,144.27],[198.48,-43.66,43.66,54.31,148.17],[207.65,-51.18,51.18,54.33,147.73],[256.3,-40.25,40.25,62.97,150.35],[257.71,-40.25,40.25,68.56,150.35],[258.42,-40.25,40.25,84.62,150.35],[271.82,-31.43,31.43,91.09,150.35],[272.52,-14.33,14.33,122.33,150.35],[280.28,-14.33,14.33,122.71,150.36],[280.98,-30.25,30.25,52.48,150.36],[290.86,-30.24,30.24,47.3,136.7],[291.56,-11.71,11.71,86.58,135.29],[296.5,-5.5,5.5,90.93,125.43],[297.2,-0.45,0.45,93.65,94.66]],"aftSide":[[196.94,78.58,79.08,116.85,117.77],[197.57,75.8,79.08,115.22,120.94],[198.19,69.12,79.08,112.62,126.87],[200.36,56.33,79.56,103.53,137.96],[202.85,41.55,79.5,101.92,144.64],[205.03,26.69,79.32,101.85,145.42],[222.12,25.04,80.43,100.05,144.15],[223.36,25.01,81.13,97.51,145.1],[224.92,25.0,80.01,99.37,144.35],[226.47,25.02,79.06,101.38,144.55],[244.5,22.91,76.82,102.57,146.59],[248.54,12.73,76.04,102.37,148.14],[250.4,8.27,75.87,102.86,148.59],[268.43,6.74,71.3,106.56,148.65],[279.93,6.54,62.38,106.65,144.17],[287.7,7.67,48.24,107.06,132.94],[289.25,8.22,36.8,107.2,125.93],[289.56,8.38,34.38,107.23,122.54],[289.87,8.63,31.97,107.26,116.48],[290.18,16.56,22.02,113.93,116.05]],"mastUp":[[183.49,-8.87,7.75,142.53,142.58],[183.99,-8.81,7.67,142.68,143.16],[184.49,-10.8,9.73,141.6,143.81],[188.99,-11.62,11.35,141.6,149.62],[189.24,-11.62,11.45,141.6,203.15],[189.74,-11.62,11.62,141.6,203.15],[189.99,-11.62,11.62,141.6,210.97],[191.24,-11.62,11.62,141.6,210.97],[191.49,-11.62,11.62,141.6,214.9],[236.24,-12.33,12.36,141.6,214.9],[236.49,-12.33,12.36,141.6,210.97],[237.24,-12.33,12.36,141.6,210.97],[237.49,-11.62,11.62,141.6,203.15],[238.24,-11.62,11.62,141.6,203.15],[238.49,-11.62,11.62,141.6,167.43],[239.74,-11.62,11.62,141.6,155.88],[241.61,-11.62,11.62,141.6,141.98]],"mastDown":[[183.49,-8.87,7.75,72.32,72.37],[183.99,-8.81,7.67,71.74,72.22],[184.49,-10.8,9.73,71.09,73.3],[188.99,-11.62,11.35,65.28,73.3],[189.24,-11.62,11.45,11.75,73.3],[189.74,-11.62,11.62,11.75,73.3],[189.99,-11.62,11.62,3.93,73.3],[191.24,-11.62,11.62,3.93,73.3],[191.49,-11.62,11.62,0.0,73.3],[236.24,-12.33,12.36,0.0,73.3],[236.49,-12.33,12.36,3.93,73.3],[237.24,-12.33,12.36,3.93,73.3],[237.49,-11.62,11.62,11.75,73.3],[238.24,-11.62,11.62,11.75,73.3],[238.49,-11.62,11.62,47.46,73.3],[239.74,-11.62,11.62,59.01,73.3],[241.61,-11.62,11.62,72.92,73.3]],"neck":[[281.5,-38.12,38.12,102.89,128.64],[287.37,-38.12,38.12,102.87,132.43],[288.27,-38.12,38.12,102.87,135.77],[300.46,-38.12,38.12,104.57,135.77],[302.27,-38.12,38.12,106.8,135.77],[302.72,-38.12,38.12,102.84,135.77],[303.17,-38.12,38.12,102.84,141.61],[305.43,-38.12,38.12,102.84,140.48],[306.78,-38.12,38.12,102.83,145.18],[324.39,-38.12,38.12,104.52,146.18],[326.64,-38.12,38.12,107.31,146.31],[327.1,-38.12,38.12,102.83,146.34],[346.06,-38.12,38.12,102.83,147.41],[346.51,-38.12,38.12,102.83,145.44],[346.96,-38.12,38.12,102.83,137.91],[348.76,-38.12,38.12,105.04,139.37],[349.22,-38.12,38.12,105.6,135.18],[350.57,-38.12,38.12,107.27,135.18],[351.02,-38.12,38.12,102.83,135.18],[351.47,-38.12,38.12,102.83,139.37],[372.24,-38.12,38.12,104.44,139.97],[374.49,-38.12,38.12,107.23,139.97],[374.95,-38.12,38.12,102.83,139.97],[398.42,-38.12,38.12,104.95,139.97],[410.16,-38.12,38.12,111.8,139.37],[410.61,-38.12,38.12,111.81,135.18],[412.41,-38.12,38.12,111.82,135.18],[414.67,-38.12,38.12,111.83,130.59],[416.93,-38.12,38.12,111.85,128.64]],"keelAft":[[274.82,-5.25,5.25,67.67,79.88],[279.99,-6.43,6.43,67.66,105.1],[282.94,-30.25,30.25,47.3,106.01],[291.07,-30.24,30.24,47.3,105.11],[292.54,-7.68,7.68,67.64,105.46],[296.24,-30.43,30.43,47.21,106.01],[304.36,-30.81,30.81,46.92,105.41],[305.84,-9.52,9.52,67.62,106.01],[310.27,-31.42,31.42,46.51,106.01],[317.65,-32.27,32.27,45.93,106.01],[319.13,-11.34,11.34,67.6,106.01],[324.3,-33.17,33.17,45.27,100.05],[332.42,-34.29,34.29,44.43,106.01],[334.64,-13.49,13.49,67.57,106.01],[339.81,-35.31,35.31,43.61,105.11],[348.67,-36.51,36.51,42.62,88.91],[350.89,-15.71,15.71,67.54,104.96],[355.32,-37.32,37.32,41.92,106.01],[365.66,-38.45,38.45,40.86,106.01],[367.14,-17.95,17.95,67.52,106.01],[375.26,-37.71,37.71,40.36,104.96],[384.12,-39.93,39.93,39.35,105.11],[385.6,-20.5,20.5,67.48,105.11],[392.98,-40.25,40.25,38.91,106.01],[402.58,-40.48,40.48,38.56,82.08],[404.06,-23.04,23.04,67.45,81.34],[494.16,-5.25,5.25,54.97,58.92],[496.38,-5.25,5.25,56.96,57.05]],"coreFwd":[[404.16,-0.28,0.28,93.79,93.88],[411.28,-10.05,10.05,89.86,96.03],[414.84,-15.7,15.7,86.23,109.36],[419.58,-23.3,23.3,75.87,111.4],[432.63,-21.17,21.17,75.88,111.0],[439.75,-20.0,20.0,75.88,115.31],[478.91,-13.96,13.96,75.89,114.34],[491.96,-16.18,16.18,71.64,110.54],[524.0,-16.18,16.18,75.47,112.69],[548.91,-15.63,15.63,73.52,112.69],[550.1,-25.05,25.05,71.75,112.69],[560.78,-28.23,28.23,68.89,110.12],[603.5,-28.21,28.21,68.27,110.13],[607.06,-28.21,28.21,72.49,110.13],[608.24,-27.93,27.93,56.77,110.13],[617.73,-19.76,19.76,56.02,110.13],[618.92,-13.46,13.46,55.99,110.13],[622.48,-13.46,13.46,56.99,112.12],[623.67,-13.46,13.46,74.62,112.09],[630.79,-12.02,12.02,76.38,111.95],[635.53,-9.2,9.2,89.97,111.85],[642.65,-9.39,9.39,92.15,111.66],[645.03,-9.44,9.44,96.47,111.57],[679.44,-6.33,6.33,97.36,109.72],[757.75,-0.95,0.95,102.88,104.25],[760.12,-0.02,0.02,104.06,104.09]],"keelFwd":[[401.92,-0.21,0.21,43.21,43.27],[410.21,-27.07,27.07,37.5,53.2],[411.39,-37.16,37.16,37.53,54.23],[419.68,-38.83,38.83,37.74,54.01],[420.87,-28.46,28.46,37.66,53.98],[437.44,-26.66,26.66,38.25,53.62],[438.63,-35.37,35.37,38.94,53.74],[444.55,-33.15,33.15,39.31,53.91],[445.73,-27.42,27.42,39.41,54.07],[449.28,-31.29,31.29,41.5,53.48],[456.39,-22.79,22.79,42.8,53.99],[467.05,-20.5,20.5,48.08,54.53],[472.97,-4.24,4.24,51.42,72.0],[474.15,-2.66,2.66,42.66,72.0],[475.34,-7.81,7.81,42.66,72.0],[476.52,-12.51,12.51,42.66,72.0],[477.7,-15.34,15.34,34.82,72.0],[483.62,-27.58,27.58,35.01,72.0],[484.81,-37.98,37.98,35.05,72.0],[500.2,-41.45,41.45,35.43,72.0],[502.57,-30.32,30.32,35.47,72.0],[555.85,-29.52,29.52,36.32,72.0],[557.04,-38.96,38.96,36.34,72.0],[607.95,-30.64,30.64,39.01,72.0],[612.69,-29.28,29.28,39.17,72.0],[616.24,-34.41,34.41,39.3,72.0],[665.98,-25.21,25.21,45.48,72.0],[744.13,-12.33,12.33,52.79,72.0],[757.15,-0.1,0.1,56.02,72.0]],"tower":[[644.23,-6.3,6.3,153.84,153.94],[653.26,-8.35,8.35,144.38,162.83],[655.35,-8.18,8.16,142.04,167.02],[658.82,-6.85,6.85,137.54,167.3],[663.33,-7.61,7.61,134.69,172.49],[663.68,-7.61,7.61,135.0,172.1],[664.03,-7.61,7.61,135.31,204.78],[665.07,-7.61,7.61,136.23,204.76],[665.77,-11.85,11.85,136.85,207.74],[677.57,-17.03,17.02,148.52,212.09],[680.7,-16.92,16.91,151.23,215.49],[693.9,-17.46,17.34,161.09,215.49],[703.62,-17.17,17.04,167.29,209.55],[714.39,-15.88,15.88,170.04,209.55],[722.03,-15.65,15.65,173.2,208.63],[728.97,-17.22,17.22,177.12,208.63],[729.32,-16.92,16.92,181.4,208.63],[735.92,-16.03,16.03,181.76,207.74],[740.09,-12.79,12.79,184.1,204.78],[740.43,-12.52,12.52,188.52,204.79],[742.17,-11.17,11.17,188.57,201.95],[742.52,-10.9,10.9,188.58,196.72],[744.6,-9.28,9.28,188.64,196.73],[744.95,-9.01,9.01,188.65,191.04],[748.42,-5.92,5.92,190.41,190.86]],"towerBase":[[609.81,-2.88,3.82,156.59,156.59],[611.25,-2.79,3.72,156.59,156.61],[611.54,-2.77,3.71,156.59,159.89],[611.83,-2.75,3.69,156.6,159.89],[612.12,-22.54,22.25,130.4,159.89],[632.96,-22.9,22.25,130.4,161.83],[633.54,-22.9,22.25,130.4,159.87],[637.6,-23.8,23.14,129.74,157.09],[658.44,-23.8,23.14,129.74,157.09],[678.7,-22.9,22.25,131.28,156.61],[679.28,-20.91,20.27,131.28,156.6],[687.1,-20.91,20.27,131.28,156.29],[688.83,-19.85,19.11,132.13,160.23],[692.89,-19.86,19.13,132.13,161.27],[694.62,-20.92,20.28,131.28,155.79],[694.91,-20.91,20.28,131.28,155.76],[695.2,-20.91,20.27,137.9,155.73],[695.49,-2.5,3.45,152.86,155.72],[696.65,-2.59,3.53,154.66,155.68]],"domeFins":[[468.31,32.21,65.57,101.81,108.09],[468.77,32.21,71.42,101.81,112.21],[469.22,32.22,72.39,92.55,112.2],[480.98,32.37,72.25,91.17,112.08],[481.44,35.82,39.93,91.16,92.76],[483.25,35.87,39.9,91.15,91.42],[493.2,32.91,73.51,101.11,111.51],[493.66,32.94,74.49,91.85,111.5],[505.88,33.77,74.93,90.49,111.37],[506.33,37.02,41.44,90.48,90.91],[518.1,34.48,77.04,99.98,110.8],[518.55,34.5,77.07,91.14,110.8],[529.86,34.93,77.79,89.82,110.68],[530.31,34.95,76.88,100.27,110.67],[542.53,34.99,76.95,99.28,110.1],[542.99,34.99,77.88,90.44,110.1],[553.85,34.97,77.7,90.33,109.98],[554.3,34.97,77.7,99.16,109.98],[566.52,34.71,72.72,99.0,103.16],[566.97,34.68,76.42,99.0,107.93],[567.43,34.66,77.32,89.74,107.92],[578.29,34.16,76.54,89.63,107.81],[578.74,34.14,76.51,98.46,107.8],[591.41,33.39,74.39,98.3,108.7],[591.86,33.36,75.28,89.04,108.69],[602.73,32.76,74.22,88.92,108.58],[603.18,32.74,74.17,96.87,108.58],[603.63,32.72,73.2,98.17,108.57],[604.08,32.75,73.16,102.29,108.57]],"dome":[[407.88,-31.49,31.49,119.75,121.87],[409.27,-54.65,54.65,109.18,136.36],[412.05,-71.91,71.91,108.95,147.78],[425.95,-93.62,93.62,108.52,164.97],[452.37,-108.03,108.03,106.17,169.96],[501.03,-115.21,115.21,100.71,162.67],[503.81,-118.02,118.02,95.25,163.68],[512.16,-115.48,115.48,100.9,162.59],[534.4,-115.74,115.74,101.63,161.23],[555.26,-111.96,111.96,105.53,158.52],[602.53,-110.22,110.22,105.53,157.2],[606.71,-114.74,114.74,104.1,156.63],[608.1,-108.14,108.14,105.53,156.4],[619.22,-112.32,112.32,100.25,155.97],[655.37,-105.56,105.56,101.15,152.37],[658.15,-98.26,98.26,101.9,151.87],[698.47,-94.92,94.92,100.5,146.5],[701.25,-97.64,97.64,101.15,146.19],[704.03,-89.27,89.27,101.79,147.07],[737.4,-81.94,81.94,109.9,142.68],[741.58,-83.47,83.47,109.33,141.79],[767.99,-73.62,73.62,102.3,135.72],[769.38,-66.43,66.43,110.94,135.32],[786.07,-61.79,61.79,107.89,131.07],[802.75,-52.76,52.76,104.28,125.83],[804.14,-42.23,42.23,111.39,125.36],[811.1,-40.06,40.06,110.24,122.98],[825.0,-23.83,23.83,111.63,111.77]],"wingTip":[[302.64,158.82,159.13,123.15,130.24],[303.64,157.47,164.05,123.15,130.82],[304.64,158.91,169.22,123.15,130.82],[312.39,158.91,209.03,123.15,130.86],[322.14,158.25,209.04,124.43,131.04],[328.89,157.42,208.15,125.54,131.06],[330.64,158.25,207.05,124.62,131.05],[334.39,158.25,208.15,124.62,131.06],[334.89,158.91,208.15,123.15,131.06],[335.14,158.91,208.15,123.15,129.09],[336.89,158.91,208.15,123.15,129.12],[337.14,158.91,208.15,123.15,131.94],[347.89,158.91,209.02,123.15,131.98],[348.14,158.91,209.02,123.15,129.13],[349.39,158.91,209.02,123.15,129.13],[349.64,157.59,209.02,123.15,129.13],[350.33,158.8,209.02,123.15,129.13]]},"rooms":[["cargo","貨物庫（旧通貨・貴金属保管庫）",[564,132.5,0.5],[5.4,110.4,50.4]],["integrity","張力場発生器（構造維持）",[157.3,123.5,-35.5],[200,14.4,8.4]],["integrity","張力場発生器（構造維持） 2",[46.5,113,-29.5],[56.4,8.4,5.4]],["pump","反応物供給設備",[52.08,116,27.5],[55.56,14.4,5.4]],["troops","兵員収容区画（停止保管ドロイド）",[597,131,-1],[59.4,107.4,47.4]],["troops","兵員収容区画（停止保管ドロイド） 2",[714,125,0.5],[65.4,86.4,29.4]],["troops","兵員収容区画（停止保管ドロイド） 3",[547.5,132.5,0.5],[26.4,110.4,50.4]],["troops","兵員収容区画（停止保管ドロイド） 4",[561,117.5,71],[173.4,29.4,20.4]],["troops","兵員収容区画（停止保管ドロイド） 5",[561,117.5,-71.5],[179.4,26.4,20.4]],["troops","兵員収容区画（停止保管ドロイド） 6",[202.5,123.5,48.5],[134.4,32.4,20.4]],["troops","兵員収容区画（停止保管ドロイド） 7",[453,131,35],[47.4,41.4,41.4]],["troops","兵員収容区画（停止保管ドロイド） 8",[453,129.5,-37],[47.4,41.4,38.4]],["troops","兵員収容区画（停止保管ドロイド） 9",[654,122,-35.5],[53.4,38.4,35.4]],["troops","兵員収容区画（停止保管ドロイド） 10",[654,122,36.5],[53.4,38.4,35.4]],["troops","兵員収容区画（停止保管ドロイド） 11",[544.5,48.5,0.5],[122.4,38.4,14.4]],["troops","兵員収容区画（停止保管ドロイド） 12",[214.5,173,0.5],[44.4,20.4,71.4]],["troops","兵員収容区画（停止保管ドロイド） 13",[460.5,158,0.5],[62.4,86.4,11.4]],["troops","兵員収容区画（停止保管ドロイド） 14",[195,122,-52],[149.4,17.4,23.4]],["troops","兵員収容区画（停止保管ドロイド） 15",[214.5,35,0.5],[38.4,20.4,65.4]],["troops","兵員収容区画（停止保管ドロイド） 16",[766.5,122,-1],[38.4,65.4,17.4]],["troops","兵員収容区画（停止保管ドロイド） 17",[331.5,125,-1],[20.4,59.4,35.4]],["troops","兵員収容区画（停止保管ドロイド） 18",[421.5,128,0.5],[14.4,74.4,35.4]],["troops","兵員収容区画（停止保管ドロイド） 19",[328.5,129.5,-68.5],[56.4,74.4,8.4]],["troops","兵員収容区画（停止保管ドロイド） 20",[328.5,129.5,66.5],[56.4,74.4,8.4]],["troops","兵員収容区画（停止保管ドロイド） 21",[367.5,122,-1],[20.4,59.4,29.4]],["troops","兵員収容区画（停止保管ドロイド） 22",[528,134,63.5],[185.4,14.4,11.4]],["troops","兵員収容区画（停止保管ドロイド） 23",[144,86,0.5],[77.4,32.4,11.4]],["troops","兵員収容区画（停止保管ドロイド） 24",[522,134,-65.5],[167.4,14.4,11.4]],["troops","兵員収容区画（停止保管ドロイド） 25",[142.97,120.5,23],[75.34,17.4,14.4]]]};
const MUN_AIR=[];
const MUN_GROUND=[{id:'ground-1',name:'B1バトル・ドロイド（停止保管）',kind:'troops',count:150000}];
const MUN_TAN='#a89a7c',MUN_BROWN='#8f8268',MUN_STEEL='#6f7a86',MUN_DARK='#5f646b',MUN_PLATE='#d2d4cf',MUN_BLUE='#5f7f9f';
function munificentBuild(opt={}){
 const D=MUNI,L=825,SZ=1.061,Z=v=>v*SZ;
 // The rod: 24 m wide, 15 m deep, centred 100 m above the keel line.
 const rod=(t,f)=>[t,f,Math.max(.005,.1*f),100/150-.5];
 const s=newShip({L,W:24,H:150,sec:'ellipse',plan:'rect',bowW:.5,bowH:.5,stern:1,bowFree:true,stations:[rod(0,.03),rod(.1,.03),rod(.106,1),rod(.92,1),rod(.926,.03),rod(1,.03)],keel:'light'},'ミュニフィセント級スター・フリゲート');
 s._building=true;s.reference='munificent';s.paint='cis';s.lights='warm';s.detail=1;s.armor={hull:.33,cit:.35};s.shieldTarget=1;
 const k=shipKit(s),part=(kind,label,c,d,o={})=>placePart(s,kind,c,d,{label,...o});
 const loft=(name,label,paint,o={},mirror=false)=>k.loftX(label,D.loft[name],{paint,corner:.12,...o},mirror);
 // The great curved armour shells over the reactors and forward hull are plates:
 // nothing mounts on them, so the guns sit on the dorsal spine, keels, masts and wings.
 loft('dome','前部湾曲装甲殻',MUN_PLATE,{corner:.45,wallInset:.28,plate:true,plateT:.42});
 k.loftX('背部縦通材（軽ターボレーザー砲座）',D.loft.dome.filter(r=>r[0]>=430&&r[0]<=700).map(r=>[r[0],-7,7,r[4]-3,r[4]+4]),{paint:MUN_STEEL,corner:.2});
 loft('coreFwd','前部中央船体',MUN_BROWN,{corner:.2});
 loft('keelFwd','前部腹部竜骨',MUN_BROWN,{corner:.35});
 loft('towerBase','司令塔基部',MUN_BROWN,{corner:.15});
 loft('tower','司令塔・長距離センサー',MUN_STEEL,{corner:.25});
 loft('domeFins','装甲殻下部の舷側装甲板',MUN_BLUE,{corner:.1,plate:true,plateT:.36},true);
 loft('neck','中央連結部',MUN_TAN,{corner:.2});
 // The broad wing: inner and outer planform plates (measured outline), thinner outboard.
 k.slab('中央翼（内翼）',[[289.4,0],[298.2,-100],[357.7,-100],[371.6,0],[357.7,100],[298.2,100]].map(([x,z])=>[x,Z(z)]),123,135.5,{paint:MUN_TAN});
 k.slab('中央翼（外翼）',[[298.2,100],[302.6,149.8],[312,182],[350,182],[352,141.3],[357.7,100]].map(([x,z])=>[x,Z(z)]),124.5,132,{paint:MUN_TAN},true);
 loft('wingTip','中央翼の翼端板',MUN_STEEL,{corner:.08},true);
 loft('keelAft','中央竜骨・肋材',MUN_BROWN,{corner:.35});
 loft('mastUp','背部ハイパーウェーブ送受信マスト',MUN_STEEL,{corner:.1});
 loft('mastDown','腹部ハイパーウェーブ送受信マスト',MUN_STEEL,{corner:.1});
 loft('aftCore','機関区画',MUN_BROWN,{round:true});
 loft('aftSide','機関区画の舷側装甲殻',MUN_PLATE,{corner:.2,plate:true,plateT:.36},true);
 loft('aftShell','艦尾背部装甲殻（放熱器・シールド・ヒートシンク）',MUN_PLATE,{round:true,plate:true,plateT:.36},true);
 // DK cutaway layout. No hangar: the frigate carries no fighter complement.
 if(opt.stage==='dock'){delete s._building;return s;}
 // ---- middle: twin main reactors under the armour shells (either can run the ship alone) ----
 const r=part('gen','第一主反応炉',[505,129,Z(27)],54);
 part('aux','第二主反応炉',[505,129,Z(-27)],54);
 // ---- stern: energy cells feeding the seven ion drive thrusters ----
 const ra=part('aux','艦尾エネルギー・セル',[215,104,0],64);
 const eo=equipmentOptions('exposedTurbine');
 const engine=(label,mouth,y,z,d,body,mirror)=>{const nl=engineBaseline('exposed',d,'nozzleLength'),len=engineBaseline('exposed',d,'length')*body/engineBaseline('exposed',d,'body');const p=placePart(s,'engine',[mouth+nl/2,y,z],d,{...eo,label,d,reactor:ra.id,dir:[-1,0,0],engineLength:len},false);resizeEngine(p,d,len);if(mirror){const q=placePart(s,'engine',[mouth+nl/2,y,-z],d,{...eo,label,d,reactor:ra.id,dir:[-1,0,0],engineLength:len},false);resizeEngine(q,d,len);}return p;};
 engine('上部イオン・ドライブ・スラスター',82,123,0,36,150,false);
 engine('舷側イオン・ドライブ・スラスター',82,99,Z(28),40,150,true);
 engine('下部イオン・ドライブ補助スラスター',82,74,Z(12),18,120,true);
 engine('最下部イオン・ドライブ補助スラスター',82,58,Z(7),13,95,true);
 // ---- stern ray-shield generator, mid deflector; hyperdrive units at the mast base ----
 part('shield','艦尾レイ・シールド発生器',[262,128,0],22);
 part('shield','偏向シールド発生器',[452,134,0],28);
 part('hyper','ハイパードライブ・ユニット（送受信マスト基部）',[300,126,0],32,{length:41.5});
 for(const sg of [-1,1])part('fuel','超高密度反応物タンク',[350,124,Z(sg*12)],14,{length:24,dir:[0,1,0]});
 // ---- inertial compensators and tensor fields along the longitudinal spines ----
 part('inertial','慣性補償装置（前部縦通材）',[653,129,0],30,{length:52});
 part('inertial','慣性補償装置（中央縦通材）',[395,122,0],22,{length:30});
 if(opt.stage==='machinery'){delete s._building;return s;}
 // Heavy guns keep their charging plant wholly inside the envelope and clear of
 // machinery: the plant is pushed deeper until all its corners are enclosed.
 let solidList=null;
 const plantFits=f=>{if(!needsCapacitor(f))return true;const q=weaponChargeSpec(f),depth=12*(f.scale||1),side=Math.sqrt(q.targetVolume/depth),up=fitUp(f),fr=frameAxis(up);solidList=solidList||allOccupied(s).map(p=>({p,b:partAABB(p)}));
  for(const cd of [10,13,16,20,24,28,33,38,44]){const c=sub(f.p,mul(up,cd+(f.mountOffset||0)));let ok=true;
   for(const a of [-.5,0,.5])for(const b of [-.5,0,.5])for(const e of [-.5,0,.5]){const pt=add(c,add(mul(up,a*depth),add(mul(fr.v,b*side),mul(fr.w,e*side))));if(!insideOriginalEnvelope(s,pt)||solidList.some(o=>pt.every((v,i)=>v>=o.b[i]&&v<=o.b[i+3])&&inPart(o.p,pt))){ok=false;break;}}
   if(ok){f.chargeDepth=cd;return true;}}return false;};
 // One fitting cast onto the outermost surface along its axis. Armour plates take
 // no fittings, so a probe that lands on a plate (or finds no surface) is refused.
 const tryMount=(kind,p,axis,zone,o={})=>{const f={id:s.nextId++,k:kind,p:p.slice(),a:axis,ped:0,base:0,low:0,float:false,batteryZone:zone,...o};mountFit(s,f);const why=f._onPlate?'plate':f.float?'float':!plantFits(f)?'plant':'';if(opt.dbg)opt.dbg.push([kind,zone,p.map(Math.round).join(','),why||'ok',f.p.map(Math.round).join(',')]);if(why){s.nextId--;return null;}return f;};
 const clearOf=(f,list)=>list.every(g=>Math.hypot(f.p[0]-g.p[0],f.p[1]-g.p[1],f.p[2]-g.p[2])>=((FITS[f.k]?.fm||10)+(FITS[g.k]?.fm||10))*.5+2);
 // n fittings over candidate stations: dorsal ('top') and ventral ('bottom') rows
 // take |z| offsets and mount as mirrored pairs (0 = centreline); 'beam' rows take
 // heights and mount one a side. Stations on plates or crowding others are skipped.
 const spread=(kind,n,mode,zone,xs,offs,o={})=>{let got=0;
  for(const off of offs)for(const x of xs){if(got>=n)break;
   const ps=mode==='beam'?[[[x,off,400],4],[[x,off,-400],5]]:(off?[1,-1]:[1]).map(sg=>[[x,0,sg*off],mode==='top'?2:3]);
   if(got+ps.length>n)continue;const fs=[];
   for(const [p,a] of ps){const f=tryMount(kind,p,a,zone+(ps.length>1?(p[2]>0?'-stbd':'-port'):''),o);if(!f||!clearOf(f,s.fits.concat(fs)))break;fs.push(f);}
   if(fs.length<ps.length)continue;s.fits.push(...fs);got+=fs.length;}
  if(got<n)throw new Error('作例の砲座が不足しています: '+kind+' '+zone+' '+got+'/'+n);};
 const range=(a,b,st)=>{const r=[];for(let x=a;x<=b+1e-6;x+=st)r.push(x);return r;};
 // Pods seat on the first wall hit among a few probe heights.
 const pod=(kind,host,o,dir,w,h)=>{let err='取付面がありません';for(const dy of [0,-4,4,-8,8,-12,12,-16,16])for(const dz of [0,-6,6,-12,12]){const q0=[o[0],o[1]+dy,o[2]+(dir[2]?0:dz)];const hit=rayPart(q0,dir,host);if(!hit)continue;const r=placeFit(s,kind,hit.p,hit.n,0,false);if(r.fit){r.fit.width=w;r.fit.height=h;r.fit.commandDepth=7;r.fit.commandHeight=5;return r.fit;}err=r.err;}throw new Error('艦橋ポッド '+kind+': '+err);};

 const tower=s.parts.find(p=>p.label==='司令塔・長距離センサー');
 pod('podBridge',tower,[800,195,0],[-1,0,0],12,5);
 pod('podCombat',tower,[705,195,Z(80)],[0,0,-1],12,5);
 syncAviationSurfaces(s);s._lockedCache=cache(s);
 try{withFrozenStructures(()=>{
  // 2 heavy turbolaser cannons on the prow elevation mounts, ventral bow
  spread('stl',2,'beam','prow-heavy',range(600,740,8).reverse(),[70,62,78,86,54]);
  // 2 long-range ion cannons under the bow
  spread('ion',2,'beam','bow-ion',range(560,740,8).reverse(),[70,62,78,86,54]);
  // 26 twin turbolaser cannons on the flanks below the shells and on the keels
  spread('mtl',6,'beam','twin',range(290,750,40),[82,64,72,56,46,92]);
  // 20 light turbolaser turrets on top: the dorsal spine and the central neck
  spread('ltl',6,'top','dorsal-light',range(290,690,48),[0,Z(18)]);
  // 38 point-defence laser cannons: lower mast and transceiver mast, wings, stern
  spread('pd',6,'beam','mast-pd',range(188,238,14),[20,38,56,165,180]);
  spread('pd',6,'top','wing-pd',range(295,365,14),[Z(60),Z(100),Z(140),Z(170),Z(40)]);
 });}finally{delete s._lockedCache;}
 if(opt.stage==='fitted'){delete s._building;return s;}

 if(opt.stage==='shape'){delete s._building;return s;}
 for(const [kind,label,c,size,role,mirror] of D.rooms||[]){const o={room:size};if(typeof role==='string')o.airRole=role;placePart(s,kind,c,30,{label,...o},mirror===1||role===1);}
 s.airWings=MUN_AIR.map(r=>({...r}));s.groundForces=normalizeGroundForces(MUN_GROUND);
 delete s._building;adoptEquipment(s,true);remount(s);
 // Broadside batteries along the flanks (v14): short-ranged, the most fire for the power.
 sideBattery(s,[250,350,450],null,'casemateMid',{level:.45});remount(s);syncCompartments(s);
 return s;

}
registerShipExample({
 key:'munificent',name:'ミュニフィセント級スター・フリゲート',side:'独立星系連合',role:'通信フリゲート',length:825,
 title:'Munificent Class Star Frigate',author:'SomeGuyUsingBlender',authorUrl:'https://sketchfab.com/SomeGuyUsingBlender',
 source:'https://sketchfab.com/3d-models/munificent-class-star-frigate-966265e37e61433b919ba640a12a33f5',license:'CC BY 4.0',
 credit:'This work is based on "Munificent Class Star Frigate" (https://sketchfab.com/3d-models/munificent-class-star-frigate-966265e37e61433b919ba640a12a33f5) by SomeGuyUsingBlender (https://sketchfab.com/SomeGuyUsingBlender) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)',
 note:'DK の断面図の配置と寸法（全長 825 m・幅 426 m・高さ 243 m）に合わせ、Sketchfab の 3D モデル（SomeGuyUsingBlender 作、CC BY 4.0）の実測形状を幅方向に 1.061 倍して組み直した銀行グループのフリゲート。主反応炉を覆う前部湾曲装甲殻（厚さ 0.35 m）、艦尾背部と機関区画の装甲殻、舷側の青い装甲板は装甲外板で、武装は背部縦通材・中央連結部・竜骨・翼・送受信マストに載せる。艦尾にイオン・ドライブ・スラスターとエネルギー・セル、レイ・シールド発生器、送受信マスト基部にハイパードライブ・ユニット、中央に双子の主反応炉と超高密度反応物タンク、艦首側の縦通材に慣性補償装置、艦首下部に居住・兵員区画と旧保管庫の貨物区画。兵装は艦首の重ターボレーザー砲 2 基、長距離イオン砲 2 基、連装ターボレーザー砲 6 基（三連中砲塔で代表）、軽ターボレーザー砲塔 6 基、点防御レーザー砲 12 基、舷側の連装ケースメイト砲 6 基（原典の砲塔数から、見た目と火力を同級の艦に揃えて減らしています）。格納庫は持たず、停止保管バトル・ドロイド 15 万体を積む。加速約 2,300 G、ハイパードライブ・クラス 1。公式の乗員は 200。',
 airWings:MUN_AIR,groundForces:MUN_GROUND,
 build:munificentBuild
});
}

// ---- src/ships/nebulonb.js ----
// EF76 Nebulon-B escort frigate, measured from "Star Wars: Nebulon B Frigate"
// by Daniel (DanielAndersson) on Sketchfab, CC BY 4.0. Ship frame: x from
// the stern (0) to the bow (300 m), y up from the lowest point, z to
// starboard. The hull is a single rod, the connecting spar; the engine block,
// the forward hull, the lower tower and the fittings are ordinary structures.
{
const NB_WHITE='#d3d4d1',NB_GREY='#b9bcbd',NB_DARK='#565d63',NB_THROAT='#2b3238';
// A prism along an axis with an exact cross-section polygon. With sym the
// points are a half profile (second coordinate >= 0 side omitted) mirrored.
// The prism is split into pieces no longer than its height, because the
// longitudinal-strength bins read a part's unrotated box.
function nbPrismX(s,label,x0,x1,poly,opt={},sym=true,mirror=false){
 const pts=sym?poly.concat(poly.slice(1,-1).reverse().map(([z,y])=>[-z,y])):poly;
 const ys=pts.map(p=>p[1]),zs=pts.map(p=>p[0]),y0=Math.min(...ys),y1=Math.max(...ys),z0=Math.min(...zs),z1=Math.max(...zs),cy=(y0+y1)/2,cz=(z0+z1)/2;
 const n=Math.max(1,Math.ceil((x1-x0)/(y1-y0)-1e-9)),dx=(x1-x0)/n;let first=null;
 // pitch -90: local x is world -y, local y is world x, local z is world z.
 for(let i=0;i<n;i++){const p=placePart(s,'struct',[x0+dx*(i+.5),cy,cz],[y1-y0,z1-z0,dx],{label,skin:'armor',form:'outline',outline:pts.map(([z,y])=>[(cy-y)/(y1-y0),(z-cz)/(z1-z0)]),corner:0,taper:0,pitch:-90,...opt},mirror);first=first||p;}
 return first;
}
// A thin flat plate through 3D corner points (x,y,z).
function nbPlate(s,label,pts,thick,opt={},mirror=false){
 let n=[0,0,0];for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];n[0]+=(a[1]-b[1])*(a[2]+b[2]);n[1]+=(a[2]-b[2])*(a[0]+b[0]);n[2]+=(a[0]-b[0])*(a[1]+b[1]);}
 n=norm(n);if(n[1]<0)n=mul(n,-1);
 let fw=sub([1,0,0],mul(n,n[0]));if(len(fw)<.001)fw=sub([0,0,1],mul(n,n[2]));fw=norm(fw);const rt=norm(cross(fw,n));
 const c0=mul(pts.reduce((a,b)=>add(a,b),[0,0,0]),1/pts.length),uv=pts.map(p=>[dot(sub(p,c0),fw),dot(sub(p,c0),rt)]);
 const u0=Math.min(...uv.map(q=>q[0])),u1=Math.max(...uv.map(q=>q[0])),v0=Math.min(...uv.map(q=>q[1])),v1=Math.max(...uv.map(q=>q[1]));
 const c=add(c0,add(mul(fw,(u0+u1)/2),mul(rt,(v0+v1)/2))),L=Math.max(.5,u1-u0),W=Math.max(.5,v1-v0);
 return placePart(s,'struct',c,[L,W,thick],{label,skin:'plain',form:'outline',outline:uv.map(q=>[(q[0]-(u0+u1)/2)/L,(q[1]-(v0+v1)/2)/W]),corner:0,taper:0,surfaceNormal:n,...opt},mirror);
}
// A loft standing on the y axis (pitch 90): rows [y, zMin, zMax, xMin, xMax].
function nbLoftY(s,label,rows,opt={},mirror=false){
 rows=rows.slice().sort((a,b)=>a[0]-b[0]);
 const y0=rows[0][0],y1=rows.at(-1)[0],Z0=Math.min(...rows.map(r=>r[1])),Z1=Math.max(...rows.map(r=>r[2])),X0=Math.min(...rows.map(r=>r[3])),X1=Math.max(...rows.map(r=>r[4]));
 const L=y1-y0,W=Z1-Z0,H=X1-X0,cz=(Z0+Z1)/2;
 // pitch 90: local x is world y, local y is world -x, local z is world z.
 const loft=rows.map(r=>[(r[0]-y0)/L,(r[2]-r[1])/W,(X1-r[3])/H,(X1-r[4])/H,((r[1]+r[2])/2-cz)/(W/2)]);
 return placePart(s,'struct',[(X0+X1)/2,(y0+y1)/2,cz],[L,W,H],{label,skin:'armor',form:opt.round?'roundloft':'loft',loft,corner:opt.corner??.1,pitch:90,...opt},mirror);
}
// An elliptical-section loft along z (yaw 90): rows [z, xMin, xMax, yMin, yMax].
function nbRoundZ(s,label,rows,opt={},mirror=false){
 rows=rows.slice().sort((a,b)=>a[0]-b[0]);
 const z0=rows[0][0],z1=rows.at(-1)[0],X0=Math.min(...rows.map(r=>r[1])),X1=Math.max(...rows.map(r=>r[2])),Y0=Math.min(...rows.map(r=>r[3])),Y1=Math.max(...rows.map(r=>r[4]));
 const L=z1-z0,W=X1-X0,H=Y1-Y0,cx=(X0+X1)/2;
 const loft=rows.map(r=>[(r[0]-z0)/L,(r[2]-r[1])/W,(r[4]-Y0)/H,(r[3]-Y0)/H,-((r[1]+r[2])/2-cx)/(W/2)]);
 return placePart(s,'struct',[cx,(Y0+Y1)/2,(z0+z1)/2],[L,W,H],{label,skin:'armor',form:'roundloft',yaw:90,loft,...opt},mirror);
}
registerShipExample({
 key:'nebulonb',name:'ネビュロンB護衛フリゲート',side:'反乱同盟',role:'フリゲート',length:300,
 title:'Star Wars: Nebulon B Frigate',author:'Daniel',authorUrl:'https://sketchfab.com/DanielAndersson',
 source:'https://sketchfab.com/3d-models/star-wars-nebulon-b-frigate-1986f7b0dee647b3b2374eb80dbd1faf',license:'CC-BY-4.0',
 credit:'This work is based on "Star Wars: Nebulon B Frigate" (https://sketchfab.com/3d-models/star-wars-nebulon-b-frigate-1986f7b0dee647b3b2374eb80dbd1faf) by Daniel (https://sketchfab.com/DanielAndersson) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)',
 note:'300 m・連結桁で結ぶ機関ブロックと前部船体・7基の機関。連結桁1本を船体とし、外形は原型モデルから実測した構造物',
 // Suggested embarked forces (buildDesign's finish() does not read these yet).
 groundForces:[{name:'反乱同盟艦隊兵中隊',kind:'troops',count:75}],
 build(){
  // Rod hull: the 13 m connecting spar from the engine block to the bow. It is
  // a thread behind the block so the stern face stays open between engines.
  const s=newShip({L:300,W:60,H:100,sec:'rect',plan:'rect',bowW:1,bowH:1,stern:1,keel:'heavy',bowFree:true,stations:[
   [0,.005,.005,.5335],[.03,.005,.005,.5335],[.04,.22,.086,.5335],[.95,.22,.086,.5335],[.985,.14,.07,.5335],[1,.033,.03,.5335]]},'ネビュロンB護衛フリゲート');
  s._building=true;s.paint='neutral';s.detail=1;s.keel='heavy';s.armor={hull:.17,cit:.17};s.shieldTarget=1;
  const k=shipKit(s),part=(kind,label,c,d,opt={},mirror=false)=>placePart(s,kind,c,d,{label,...opt},mirror),room=(kind,label,c,size,opt={},mirror=false)=>part(kind,label,c,30,{room:size,...opt},mirror);
  const W={paint:NB_WHITE},G={paint:NB_GREY},D={paint:NB_DARK};
  // Engine block: the measured section (wide shoulders, tapering keel),
  // its sloped forward face, the top rails, the dorsal pod and the tower.
  const BLOCK=[[0,111.3],[29.2,111],[30.8,109.5],[32.5,108],[34.2,106.5],[35,105],[35.6,102],[36.2,99],[36.4,97.5],[36,96],[33,93],[30,90],[27,87],[24,84],[21,81],[19.4,79.5],[18,78],[17,76.5],[15.4,73.5],[13.9,70.5],[12.3,67.5],[10.8,64.5],[9.2,61.5],[7,60.8],[0,60.8]];
  nbPrismX(s,'機関ブロック',10.4,52.2,BLOCK,{skin:'service',...W});
  nbPrismX(s,'機関ブロック前面の上部',52,57.2,[[0,111.3],[29.2,111],[32.5,108],[35,105],[36.2,99],[36.4,97.5],[33,93],[27,87],[21,81],[18.7,78],[0,78]],W);
  k.box('上面の側部レール',[10,110.4,16.5],[50.5,114.2,24],{corner:.15,...G},true);
  k.loftX('背部ポッド',[[19.5,-3.5,3.5,108,114.5],[25,-7.2,7.2,107.4,115.8],[30,-8.4,8.4,107.4,116.2],[40,-9,9,107.4,117],[50,-8.4,8.4,107.4,116.2],[55,-8,8,107.4,116.2],[60,-6.4,6.4,107.4,115.4],[62.5,-4,4,107.4,113]],{round:true,...W});
  k.box('背部砲塔塔（右舷）',[34.6,106,14.3],[51,122.2,24.7],{corner:.12,...W});
  k.loftX('背部砲塔塔の上部',[[35.5,15.1,23.5,121.5,128.5],[40,15.1,23.5,121.5,131],[45,15.1,23.5,121.5,131.4],[51,15.1,23.5,121.5,127]],{corner:.25,...W});
  // Lower drum and the two static-discharge vanes beneath the block.
  nbRoundZ(s,'腹部ドラム',[[-13.3,37.8,50.5,58,71],[13.3,37.8,50.5,58,71]],W);
  nbPlate(s,'静電放出翼',[[43.5,67.5,14.2],[43.5,67.5,26],[50.5,55.3,25.8],[63.1,33.4,15.6],[63.1,33.4,14.2]],2,G,true);
  // Spar root brace and keel under the spar.
  k.loftX('連結桁の基部',[[52,-2.9,2.9,94.6,105],[56,-5.3,5.3,87.4,105],[63.5,-5.3,5.3,87.4,105],[67,-4.4,4.4,89.2,105],[70.5,-2.9,2.9,96.6,105],[84,-2.9,2.9,96.6,105],[86,-2,2,98.6,105]],{corner:.15,...W});
  // Forward hull: lens section (prism), dorsal superstructure, bow and the
  // stepped aft end where it meets the spar.
  const FORE=[[0,117.4],[5.7,117],[10.4,116.2],[13.3,114],[16.3,111],[19.3,108],[21.6,105],[21.6,102],[21.2,99],[17.3,96],[13.3,93],[11.7,90],[11,88.2],[0,88]];
  nbPrismX(s,'前部船体',190,258,FORE,W);
  k.loftX('前部船体の後端',[[164,-6.8,6.8,97,108.4],[172,-9.8,9.8,93.5,109.8],[180,-12.5,12.5,92.6,115],[188,-13.8,13.8,91.7,116.5],[190.4,-21,21,90.8,117]],{corner:.3,...W});
  k.loftX('艦首',[[257.8,-21.6,21.6,86,117.4],[262,-16.3,16.3,86,117],[272,-15.3,15.3,87,117.4],[280,-14.4,14.4,92.8,114.4],[288,-12.6,12.6,95.4,112],[295,-8.4,8.4,97.3,110.6],[300,-2.4,2.4,101,107]],{corner:.32,...W});
  k.loftX('背部上部構造',[[213,-4,4,115,118.6],[218,-7.9,7.9,115,122.3],[224,-7.9,7.9,115,124.5],[246,-7.9,7.9,115,124.5],[252,-5.4,5.4,115,120.6],[258,-4,4,115,118.8],[266,-1.6,1.6,115,119.2]],{corner:.3,...W});
  k.ellipsoid('背部センサードーム',[200.5,117.6,0],[14,7.6,5],{skin:'plain',...W});
  // Communication masts: a cluster of four on the port side and two small ones aft.
  for(const [x,z,y0,y1,r] of [[233.5,-12,115,167,1],[235.3,-14,115,165,1],[236.9,-11.2,115,162,1],[239,-12.4,115,160,1],[203.4,0,118,138.9,1],[206.4,0,118,136.5,1]])k.put('通信マスト',[x,(y0+y1)/2,z],[r*2,r*2,y1-y0],{form:'cylinder',skin:'plain',...G});
  // Lower tower: a tapering core with its stacked fore-and-aft pods.
  nbLoftY(s,'下部船体の柱',[[2.5,-3.6,3.6,231,260],[9,-4.2,4.2,228,267],[30,-6.1,6.1,226,269],[60,-8.7,8.7,226,269],[87,-11,11,215,272]],W);
  for(const [y0,y1,x0,x1,hz,label] of [[11.5,21.5,208.6,270.8,5.4,'下部格納ポッド'],[26.5,37,222.8,274.2,6.6,'下部区画ポッド'],[41.5,55.5,221.7,268.6,8.2,'下部区画ポッド'],[62.5,84.5,213,272,14.3,'上部区画ポッド'],[83,93,199.5,280,13.4,'前部船体の腹部']])
   k.ellipsoid(label,[(x0+x1)/2,(y0+y1)/2,0],[x1-x0,hz*2,y1-y0],W);
  // Engines: seven nozzles (4-2-1) in ribbed sleeves on the block's aft face.
  const ENG=[[99.6,22],[99.6,9.6],[78.8,14.6],[68,0]];
  for(const [y,z] of ENG){
   for(const sg of z>0?[-1,1]:[1])placePart(s,'struct',[5.4,y,sg*z],[11.6,11.6,10.8],{label:'機関ノズル外筒',form:'arc',arcInner:.86,arcStart:0,arcSweep:360,pitch:-90,skin:'plain',...D},false);
   k.loftX('機関ノズル奥の遮熱板',[[10.3,z-4.4,z+4.4,y-4.4,y+4.4],[12.3,z-4.4,z+4.4,y-4.4,y+4.4]],{round:true,skin:'plain',paint:NB_THROAT},z>0);
  }
  // Machinery: reactor, drives and supply in the engine block; hangar, troops
  // and structural field in the forward hull; shields and bridge in the bow.
  const gen=part('gen','主反応炉',[44,97,0],24);
  for(const [y,z] of ENG)for(const sg of z>0?[-1,1]:[1])part('engine','亜光速機関',[15,y,sg*z],10,{dir:[-1,0,0],nozzleLength:30,bodyLength:2,bodyRadius:.4,reactor:gen.id});
  room('pump','反応物供給設備',[44,64.5,0],[14,6,4]);
  part('fuel','反応物サイロ',[46,70,7],6,{length:16,dir:[1,0,0]},true);
  part('inertial','慣性制御装置',[48.5,104,24],10,{length:17,dir:[1,0,0]},true);
  // Hangar across the forward hull's widest band, open to port and starboard
  // behind ray shields; servicing deck below it.
  const bay=room('hangar','格納庫',[224,103,0],[60,42.6,8.8],{airRole:'storage'});
  openBay(s,bay,'port','ray');openBay(s,bay,'stbd','ray');
  room('service','航空整備・補給区画',[224,93.3,0],[50,20,9]);
  room('integrity','構造維持装置',[242.5,73.5,0],[30,14,10]);
  room('troops','兵員区画',[248,31.75,0],[28,9,7]);
  room('cargo','貨物区画',[246,47,0],[30,12,10]);
  part('hyper','ハイパードライブ',[247,60.5,0],9,{length:13,dir:[0,1,0]});
  part('shield','シールド発生器',[270,103,8],10,{},true);
  room('command','艦橋',[284,108,0],[10,8,6]);
  // Armament (12 turbolasers, 12 laser cannons, 2 tractor beams).
  const gun=(kind,x,z,axis,scale,zone)=>{const up=AXES[axis],h=rayEnv(s,[x,axis===3?-600:600,z],mul(up,-1),{structOnly:true});if(!h)throw new Error('ネビュロンBの砲座がありません: '+x+','+z);const f={id:s.nextId++,k:kind,p:h.p,a:axis,ped:0,base:0,low:0,float:false,scale,chargeDepth:6,batteryZone:zone};mountFit(s,f);s.fits.push(f);return f;};
  syncAviationSurfaces(s);s._lockedCache=cache(s);
  try{withFrozenStructures(()=>{
   // Twelve turbolasers on the dorsal decks, the rails and the bow.
   for(const x of [228,242])for(const z of [-4.5,4.5])gun('mtl',x,z,2,.45,'fore-dorsal');
   for(const z of [-4,4])gun('mtl',213,z,2,.45,'fore-dorsal');
   for(const x of [16,46])for(const z of [-20.25,20.25])gun('mtl',x,z,2,.45,'aft-'+(z<0?'port':'stbd'));
   gun('mtl',258,0,2,.45,'fore-dorsal');gun('mtl',276,0,2,.45,'bow');
   // Twelve laser cannons under the forward hull, the bow and the block.
   for(const [x,z] of [[200,17],[222,17],[244,17],[270,12]])for(const sg of [-1,1])gun('pd',x,sg*z,3,.6,'fore-ventral');
   for(const x of [22,40])for(const z of [-16,16])gun('pd',x,z,3,.6,'aft-ventral');
   gun('trc',286,0,3,.6,'bow');gun('trc',30,0,3,.6,'stern');
  });}finally{delete s._lockedCache;}
  delete s._building;remount(s);return s;
 }
});
}

// ---- src/ships/providence.js ----
// Providence-class carrier/destroyer, measured from "Star Wars: The Clone Wars
// Providence" by lolqeeeeeeeeee on Sketchfab (CC BY-NC 4.0). Ship frame: x from
// the stern (0) to the bow (1,088 m), y up from the lowest point, z to
// starboard. The hull is fitted to the main body (aft hangar section and the
// forward prow); the dorsal shell, spine, command tower, bridge, ventral fin,
// forward ventral pod and the three engine housings are ordinary structures.
{
const PROV={"W":202.635,"H":111.36,"st":[[0.0,0.079,0.0083,0.6358,0.8,0.8,0.5,0.5],[0.00956,0.0987,0.0083,0.6492,0.8,0.8,0.5,0.5],[0.12813,0.0987,0.0083,0.6492,0.8,0.8,0.5,0.5],[0.12923,0.7067,0.6333,0.3667,0.9186,0.552,0.65,0.61],[0.16912,0.7852,0.6917,0.3875,0.9405,0.5223,0.52,0.46],[0.19118,0.883,0.725,0.3958,0.8551,0.5163,0.38,0.48],[0.21048,0.9192,0.7333,0.4083,0.8374,0.6317,0.27,0.56],[0.21875,0.9298,0.75,0.4083,0.8298,0.5937,0.3,0.55],[0.28217,0.9824,0.7833,0.4167,0.8206,0.6001,0.34,0.56],[0.33456,0.9763,0.7833,0.4167,0.8338,0.5915,0.39,0.55],[0.3704,0.9734,0.7667,0.4167,0.8287,0.6207,0.33,0.56],[0.39246,0.9545,0.75,0.4167,0.8333,0.6226,0.34,0.55],[0.41176,0.9041,0.7333,0.4083,0.8645,0.4664,0.56,0.49],[0.43658,0.8513,0.6833,0.4,0.882,0.4757,0.55,0.5],[0.45588,0.7484,0.6333,0.3917,0.8317,0.4661,0.68,0.57],[0.45864,0.7192,0.575,0.4125,0.8256,0.6262,0.73,0.55],[0.4614,0.7012,0.6917,0.4792,0.4669,0.6304,0.59,0.44],[0.47518,0.5748,0.675,0.4875,0.5771,0.4686,0.5,0.44],[0.48621,0.6543,0.6917,0.4792,0.5184,0.3364,0.21,0.28],[0.6682,0.7396,0.7083,0.4875,0.5904,0.3186,0.29,0.28],[0.78952,0.6907,0.7,0.4833,0.6297,0.3193,0.26,0.27],[0.85846,0.5813,0.65,0.475,0.5627,0.3635,0.22,0.26],[0.92463,0.2311,0.4167,0.425,0.6844,0.4825,0.27,0.27],[0.96048,0.0932,0.2333,0.3917,0.3833,0.1111,0.02,0.51],[0.96324,0.0857,0.1,0.45,0.3569,0.9702,0.02,0.2],[0.99632,0.0403,0.1167,0.4167,0.6298,0.8266,0.46,0.31],[1.0,0.0204,0.15,0.4,0.9518,0.9747,0.93,0.48]],"loft":{"deck":[[0.0,-21.64,21.64,125.18,127.72],[10.43,-41.26,41.26,127.14,133.48],[76.89,-53.75,53.75,126.71,145.34],[121.19,-63.12,63.12,122.5,153.18],[139.44,-64.74,64.74,116.79,155.93],[260.63,-77.97,77.97,144.08,167.49],[269.76,-77.97,77.97,144.43,167.78],[277.57,-74.57,74.57,144.75,168.03],[427.44,-74.76,74.76,143.44,162.41],[489.99,-59.38,59.38,135.14,149.14],[521.27,-41.57,41.57,126.94,136.58]],"spine":[[121.3,-12.72,12.72,171.49,178.63],[127.79,-17.6,17.6,171.49,178.63],[148.19,-17.95,17.95,171.49,178.63],[150.04,-23.2,23.2,160.09,178.63],[404.97,-27.89,27.89,163.88,178.63],[430.0,-28.35,28.35,160.88,178.63],[446.69,-23.71,23.71,158.87,178.63],[455.96,-29.75,29.75,157.24,178.63],[482.84,-28.96,28.96,148.71,178.63],[490.26,-18.47,18.47,146.24,178.63],[492.11,-16.41,16.41,145.64,145.78]],"aftKeel":[[62.43,-0.24,0.24,67.84,67.89],[70.93,-38.12,38.12,63.17,68.01],[115.93,-40.98,40.98,61.63,69.96],[116.18,-60.8,60.8,61.62,127.02],[125.68,-68.73,68.73,61.3,129.07],[135.93,-70.8,70.8,62.43,131.33],[136.93,-71.0,71.0,69.31,131.54],[137.18,-68.18,68.18,72.75,124.98],[139.35,-68.18,68.18,72.75,124.98]],"tower":[[109.68,-8.16,8.16,306.39,306.5],[120.33,-11.3,11.3,283.43,306.58],[140.35,-13.77,13.77,240.3,303.63],[155.26,-13.77,13.77,208.34,282.07],[193.59,-10.77,10.77,177.94,227.02],[215.32,-8.16,8.16,178.03,196.27],[280.06,-8.16,8.16,178.03,178.04]],"bridge":[[81.9,-18.18,18.18,305.99,309.15],[84.15,-18.18,18.18,305.99,310.24],[88.9,-18.18,18.18,305.99,317.9],[93.9,-18.18,18.18,305.99,318.37],[96.65,-18.18,18.18,305.99,321.95],[164.9,-17.51,17.51,305.99,321.95],[169.65,-15.54,15.54,305.99,321.21],[174.15,-11.45,11.45,305.99,317.9],[177.08,-4.49,4.49,305.99,317.9]],"mast":[[90.45,-4.25,4.25,317.41,317.5],[95.2,-4.25,4.25,317.41,324.03],[106.45,-4.25,4.25,317.41,324.03],[106.7,-1.38,1.38,289.0,295.21],[106.95,-1.38,1.38,288.99,347.02],[111.7,-1.38,1.38,288.91,337.61],[118.45,-1.38,1.38,288.8,322.28],[118.7,-1.38,1.38,288.8,290.53],[118.95,-1.38,1.38,288.79,289.39],[129.7,-2.98,2.98,321.7,324.08],[157.2,-2.98,2.98,321.7,325.09],[160.45,-2.98,2.98,321.7,332.48],[162.45,-2.98,2.98,321.7,331.17],[163.2,-2.98,2.98,321.7,324.08],[165.79,-2.98,2.98,321.7,321.78]],"vfin":[[214.29,-4.17,4.17,60.23,60.26],[246.99,-5.3,5.3,38.85,59.84],[253.58,-6.93,6.93,34.53,59.79],[270.07,-6.93,6.93,23.73,59.64],[299.47,-10.71,10.71,0.42,59.27],[315.13,-10.71,10.71,1.32,14.78],[324.2,-10.71,10.71,5.75,11.73]],"vpod":[[662.63,-0.07,0.07,67.33,67.39],[669.46,-9.15,9.15,62.21,68.66],[678.33,-18.19,18.19,57.14,75.86],[722.0,-33.27,33.27,48.66,75.86],[786.15,-42.09,42.09,43.69,75.86],[840.74,-42.88,42.88,43.24,75.86],[881.0,-36.89,36.89,46.61,75.86],[909.66,-27.04,27.04,52.15,75.86],[928.08,-14.7,14.7,59.1,75.86],[935.59,-0.1,0.1,67.31,67.39]],"ridge":[[708.45,-2.4,2.4,148.71,150.82],[710.94,-2.4,2.4,148.71,152.99],[740.83,-2.4,2.4,148.71,152.99],[744.56,-4.37,4.37,148.71,154.5],[759.5,-3.83,3.83,148.71,152.99],[762.62,-4.37,4.37,148.71,154.5],[780.05,-3.83,3.83,148.66,152.93],[781.92,-7.96,7.96,148.66,154.3],[786.9,-7.96,7.96,148.66,154.3],[788.77,-3.85,3.85,148.66,152.93],[857.26,-3.83,3.83,147.38,152.68],[865.35,-8.25,8.25,146.87,154.43],[885.27,-8.34,8.34,145.98,158.35],[921.38,-7.0,7.0,143.73,156.76],[923.88,-7.38,7.38,143.7,156.0],[935.08,-9.65,9.65,141.45,158.26],[938.2,-15.4,15.4,141.41,158.26],[948.78,-15.05,15.05,149.36,158.26],[953.14,-11.23,11.23,150.34,155.78],[957.5,-7.46,7.46,151.81,154.31]],"plate":[[488.2,-14.99,14.99,143.83,152.8],[488.97,-15.0,15.0,143.85,154.37],[633.88,-17.21,17.21,146.58,154.37],[639.26,-13.16,13.16,146.58,152.8],[641.95,-10.66,10.66,149.96,152.8]],"box83":[[453.71,-11.29,11.29,174.11,180.5],[484.46,-16.49,16.49,167.42,182.06],[491.46,-14.15,14.15,145.88,179.42],[501.71,-10.72,10.72,145.88,175.55],[501.96,-10.64,10.64,167.93,175.45],[505.28,-9.55,9.55,167.93,174.21]],"rail":[[270.15,-6.64,6.64,178.5,180.39],[292.77,-6.64,6.64,178.5,180.39],[295.33,-8.07,8.07,178.45,181.72],[302.99,-6.64,6.64,178.5,180.39],[305.55,-8.07,8.07,178.45,181.72],[308.1,-8.07,8.07,178.45,181.72],[310.66,-6.64,6.64,178.5,180.39],[316.86,-6.64,6.64,178.5,180.39],[319.41,-8.07,8.07,178.45,181.72],[327.81,-6.64,6.64,178.5,180.39],[330.36,-8.07,8.07,178.45,181.72],[341.67,-6.64,6.64,178.5,180.39],[344.23,-8.07,8.07,178.45,181.72],[357.0,-6.64,6.64,178.5,180.39],[363.93,-8.07,8.07,178.45,181.72],[366.49,-6.64,6.64,178.5,180.39],[375.61,-6.64,6.64,178.5,180.39],[378.17,-8.07,8.07,178.45,181.72],[380.72,-8.07,8.07,178.45,181.72],[383.28,-6.64,6.64,178.5,180.39],[387.29,-6.64,6.64,178.5,180.39],[389.84,-8.07,8.07,178.45,181.72],[392.4,-8.07,8.07,178.45,181.72],[394.95,-6.64,6.64,178.5,180.39],[416.12,-6.64,6.64,178.5,180.39]],"towerBase":[[102.91,-6.37,6.37,149.23,149.27],[116.91,-6.37,6.37,150.98,161.18],[121.41,-19.1,19.1,151.49,164.2],[194.41,-19.1,19.1,159.63,162.89]],"aftFin":[[27.14,-2.03,2.03,161.51,161.91],[27.64,-2.03,2.03,158.82,161.91],[38.14,-2.03,2.03,156.76,161.89],[38.39,-8.52,8.52,156.71,161.89],[39.64,-8.52,8.52,156.47,161.89],[46.14,-8.52,8.52,138.49,161.88],[68.89,-8.52,8.52,141.94,161.53],[71.64,-8.52,8.52,142.36,159.3],[71.89,-2.03,2.03,142.39,159.11],[88.31,-2.03,2.03,145.82,145.87]],"engC":[[41.4,-12.99,12.99,101.53,125.39],[53.81,-12.99,12.99,101.53,125.39],[58.87,-13.64,13.64,101.53,128.81],[63.17,-16.64,16.64,101.53,128.81],[69.25,-16.64,16.64,100.97,128.81],[71.02,-16.64,16.64,98.12,128.81],[142.67,-16.67,16.67,98.12,128.81]],"engS":[[60.82,25.92,60.78,87.93,120.28],[73.32,25.92,60.78,87.93,120.28],[80.32,20.92,60.78,86.97,121.23],[86.07,20.92,60.78,83.33,124.87],[94.07,20.92,61.3,83.33,124.87],[96.82,20.92,65.78,83.33,124.88],[148.27,20.92,65.78,83.29,124.92]],"engLow":[[82.04,-8.86,8.86,97.81,98.74],[88.54,-12.38,12.38,92.22,98.74],[116.79,-14.87,14.87,87.81,98.74],[117.04,-27.85,27.85,87.69,98.74],[128.54,-36.26,36.26,79.45,98.74],[140.61,-36.24,36.24,79.49,98.74]],"engKeel":[[105.41,-3.18,3.18,85.4,97.37],[110.16,-4.0,4.0,83.97,97.37],[110.41,-6.92,6.92,76.91,97.37],[139.79,-6.92,6.92,72.4,97.37]],"pipeS":[[28.05,20.62,27.31,84.23,90.44],[30.31,20.62,27.31,84.23,90.44],[30.87,19.91,28.03,83.58,91.11],[46.1,19.91,28.03,83.58,91.11],[60.76,21.42,26.27,85.36,89.95],[65.27,19.92,25.25,87.44,93.78],[77.96,15.33,20.61,98.41,104.36],[81.62,14.82,19.67,101.0,105.5],[140.84,14.82,19.67,100.99,105.5]],"nozC":[[10.27,-10.2,10.2,104.12,122.79],[36.52,-11.91,11.91,102.55,124.37],[41.91,-10.21,10.21,104.12,122.79]],"nozS":[[18.61,29.72,57.0,91.46,116.78],[54.36,27.46,59.25,89.38,118.87],[61.5,29.71,57.01,91.45,116.79]],"nozSrim":[[15.31,36.2,50.9,87.54,120.22],[16.81,34.46,52.64,87.45,120.32],[17.06,28.12,58.98,87.45,120.33],[24.06,28.29,58.82,87.06,120.78],[26.06,34.19,52.91,86.96,120.91],[41.31,36.18,50.92,86.15,121.88],[41.5,36.2,50.9,86.14,119.95]]},"rooms":[["hangar","上部格納甲板（天井ラックの艦載機）",[353,139.71,0.5],[155.4,128.4,41.7],"storage"],["hangar","上部格納甲板（天井ラックの艦載機） 2",[353,129.21,-73],[155.4,17.4,20.7],"storage"],["hangar","上部格納甲板（天井ラックの艦載機） 3",[351.5,129.21,74],[152.4,17.4,20.7],"storage"],["hangar","上部格納甲板（天井ラックの艦載機） 4",[350,124.71,-86.5],[119.4,8.4,11.7],"storage"],["hangar","下部格納甲板（艦載機ラック）",[353,95.01,0.5],[155.4,176.4,17.7],"storage"],["hangar","下部格納甲板（艦載機ラック） 2",[348.5,98.01,-92.5],[122.4,8.4,11.7],"storage"],["hangar","下部格納甲板（艦載機ラック） 3",[347,98.01,93.5],[95.4,8.4,11.7],"storage"],["service","艦載機整備・ドロイド整備甲板",[462.5,117.36,-1],[62.4,101.4,56.4]],["service","艦載機整備・ドロイド整備甲板 2",[308.46,73.86,-31],[102.32,41.4,23.4]],["service","艦載機整備・ドロイド整備甲板 3",[261.5,117.36,48.5],[8.4,38.4,92.4]],["vehicle","MTT・装甲車両格納区画（重量物昇降台）",[621.5,136.86,0.5],[236.4,68.4,17.4]],["vehicle","MTT・装甲車両格納区画（重量物昇降台） 2",[581,105.36,32],[173.4,29.4,44.4]],["vehicle","MTT・装甲車両格納区画（重量物昇降台） 3",[581,103.86,-34],[173.4,29.4,41.4]],["vehicle","MTT・装甲車両格納区画（重量物昇降台） 4",[827,133.86,-1],[83.4,83.4,23.4]],["vehicle","MTT・装甲車両格納区画（重量物昇降台） 5",[365.59,73.86,30.5],[126.58,38.4,23.4]],["vehicle","MTT・装甲車両格納区画（重量物昇降台） 6",[306.5,168.36,-1],[8.4,47.4,14.4]],["cargo","貨物・物資庫",[148.24,139.86,0.5],[15.87,104.4,29.4]],["integrity","構造維持装置",[203.49,103.86,-65.5],[120.37,8.4,47.4]],["integrity","構造維持装置 2",[143,94.86,0.5],[5.4,50.4,17.4]],["pump","反応物供給設備",[177.34,136.86,57.5],[74.07,8.4,17.4]],["troops","停止保管バトル・ドロイド収容区画",[749,97.86,-46],[113.4,35.4,35.4]],["troops","停止保管バトル・ドロイド収容区画 2",[749,99.36,45.5],[113.4,32.4,38.4]],["troops","停止保管バトル・ドロイド収容区画 3",[932,117.36,0.5],[59.4,56.4,32.4]],["troops","停止保管バトル・ドロイド収容区画 4",[683,112.86,-1],[95.4,35.4,29.4]],["troops","停止保管バトル・ドロイド収容区画 5",[807.5,63.36,0.5],[176.4,56.4,8.4]],["troops","停止保管バトル・ドロイド収容区画 6",[422,76.86,-31],[119.4,41.4,17.4]],["troops","停止保管バトル・ドロイド収容区画 7",[869,99.36,36.5],[65.4,32.4,38.4]],["troops","停止保管バトル・ドロイド収容区画 8",[270.5,126.36,9.5],[8.4,110.4,80.4]],["troops","停止保管バトル・ドロイド収容区画 9",[869,99.36,-37],[65.4,29.4,38.4]],["troops","停止保管バトル・ドロイド収容区画 10",[528.5,112.86,-1],[68.4,35.4,29.4]],["troops","停止保管バトル・ドロイド収容区画 11",[398,171.36,0.5],[173.4,44.4,8.4]],["troops","停止保管バトル・ドロイド収容区画 12",[453.5,109.86,63.5],[44.4,26.4,47.4]],["troops","停止保管バトル・ドロイド収容区画 13",[209,169.86,-1],[113.4,41.4,11.4]],["troops","停止保管バトル・ドロイド収容区画 14",[612.5,94.86,54.5],[158.4,14.4,23.4]],["troops","停止保管バトル・ドロイド収容区画 15",[453.5,111.36,-64],[44.4,23.4,50.4]],["troops","停止保管バトル・ドロイド収容区画 16",[633.5,78.36,21.5],[404.4,14.4,8.4]],["troops","停止保管バトル・ドロイド収容区画 17",[219.5,106.86,68],[74.4,11.4,59.4]],["troops","停止保管バトル・ドロイド収容区画 18",[824,109.86,-1],[71.4,29.4,23.4]],["troops","停止保管バトル・ドロイド収容区画 19",[659,78.36,-20.5],[353.4,14.4,8.4]],["troops","停止保管バトル・ドロイド収容区画 20",[762.5,142.86,0.5],[44.4,86.4,11.4]],["troops","停止保管バトル・ドロイド収容区画 21",[611,94.86,-55],[161.4,11.4,23.4]],["troops","停止保管バトル・ドロイド収容区画 22",[885.5,136.86,-1],[32.4,71.4,17.4]],["troops","停止保管バトル・ドロイド収容区画 23",[284,73.86,35],[35.4,47.4,23.4]],["troops","停止保管バトル・ドロイド収容区画 24",[240.5,106.86,-76],[68.4,11.4,41.4]],["troops","停止保管バトル・ドロイド収容区画 25",[534.5,148.86,0.5],[206.4,26.4,5.4]],["troops","停止保管バトル・ドロイド収容区画 26",[927.5,91.86,-28],[50.4,35.4,17.4]],["troops","停止保管バトル・ドロイド収容区画 27",[734,93.36,65],[257.4,5.4,20.4]],["troops","停止保管バトル・ドロイド収容区画 28",[929,91.86,27.5],[53.4,32.4,17.4]],["troops","停止保管バトル・ドロイド収容区画 29",[164,142.86,-2.5],[11.4,110.4,23.4]],["troops","停止保管バトル・ドロイド収容区画 30",[738.5,121.86,-41.5],[92.4,26.4,11.4]],["troops","停止保管バトル・ドロイド収容区画 31",[348.5,82.86,-67],[152.4,29.4,5.4]],["troops","停止保管バトル・ドロイド収容区画 32",[776,127.86,45.5],[167.4,8.4,17.4]],["troops","停止保管バトル・ドロイド収容区画 33",[615.5,88.86,-14.5],[242.4,8.4,11.4]],["troops","停止保管バトル・ドロイド収容区画 34",[737,91.86,-67],[239.4,5.4,17.4]],["troops","停止保管バトル・ドロイド収容区画 35",[713,105.36,23],[47.4,11.4,44.4]],["troops","停止保管バトル・ドロイド収容区画 36",[243.5,105.36,80],[62.4,11.4,32.4]]]};
const PROV_AIR=[{id:'air-1',name:'ヴァルチャー級ドロイド・スターファイター',size:1,count:120},{id:'air-2',name:'ドロイド・トライファイター',size:1,count:120}];
const PROV_GROUND=[{id:'ground-1',name:'B1バトル・ドロイド（停止保管）',kind:'troops',count:162000},{id:'ground-2',name:'MTT 大型兵員輸送車',kind:'vehicle',size:8,count:160},{id:'ground-3',name:'AAT 装甲強襲戦車',kind:'vehicle',size:1,count:100},{id:'ground-4',name:'IG-227 ヘイルファイア級ドロイド戦車',kind:'vehicle',size:1,count:60},{id:'ground-5',name:'OG-9 ホームワールド・スパイダー・ドロイド',kind:'vehicle',size:2,count:60},{id:'ground-6',name:'LM-432 クラブ・ドロイド',kind:'vehicle',size:.5,count:60}];
const PROV_TAN='#a89a7c',PROV_BROWN='#8f8268',PROV_STEEL='#6f7a86',PROV_DARK='#5f646b',PROV_PLATE='#aaa28e',PROV_RED='#6f4637';
function providenceBuild(opt={}){
 const D=PROV,L=1088,SY=.928,Y=v=>v*SY;
 const s=newShip({L,W:D.W,H:D.H,sec:'warship',plan:'wedge',deckWidth:0,keelWidth:0,belt:.13,chineHeight:.5,bowFree:true,stations:D.st.map(a=>a.slice()),keel:'light'},'プロヴィデンス級空母／駆逐艦');
 s._building=true;s.reference='providence';s.paint='cis';s.lights='warm';s.detail=1;s.armor={hull:.65,cit:.35};s.shieldTarget=1;
 const k=shipKit(s),part=(kind,label,c,d,o={})=>placePart(s,kind,c,d,{label,...o});
 const loft=(name,label,paint,o={},mirror=false)=>k.loftX(label,D.loft[name],{paint,corner:.12,...o},mirror);
 // ---- structures (measured loft sections) ----
 // The flowing curved panelling is armour plate: the dorsal shell over the hangar
 // decks, the central dorsal plate and the forward ventral bulge. Nothing mounts on it.
 loft('deck','背部湾曲装甲殻（格納甲板上部）',PROV_PLATE,{corner:.22,plate:true,plateT:.95});
 loft('spine','背部中央稜線',PROV_BROWN,{corner:.1});
 loft('aftKeel','艦尾下部の機関台座',PROV_BROWN,{corner:.15});
 loft('tower','ウィザーズ・タワー（司令塔・ターボシャフト）',PROV_TAN,{corner:.14});
 loft('towerBase','司令塔の基部',PROV_BROWN,{corner:.1});
 loft('bridge','改装通信・センサー・ポッド（展望甲板）',PROV_STEEL,{corner:.18});
 loft('mast','タワー頂部の通信・センサー・マスト',PROV_DARK,{corner:.05});
 loft('vfin','腹部安定翼と下部センサー',PROV_TAN,{corner:.1});
 loft('vpod','前部腹部の湾曲装甲（厚い主船体下部）',PROV_RED,{round:true,plate:true,plateT:.72});
 loft('ridge','艦首上部の艦橋稜線',PROV_BROWN,{corner:.1});
 loft('plate','中央背面の装甲板',PROV_RED,{corner:.1,plate:true,plateT:.72});
 loft('box83','背面の機器区画',PROV_BROWN,{corner:.1});
 loft('rail','背面の通信レール',PROV_DARK,{corner:.05});
 loft('aftFin','艦尾背面の小翼',PROV_TAN,{corner:.08});
 loft('engC','中央機関ハウジング',PROV_STEEL,{round:true});
 loft('engS','舷側機関ハウジング',PROV_STEEL,{round:true},true);
 loft('engLow','機関下部の補機架台',PROV_BROWN,{corner:.12});
 loft('engKeel','機関下部の竜骨',PROV_BROWN,{corner:.1});
 loft('pipeS','機関間の導管',PROV_DARK,{round:true},true);
 // ---- aft half: the expansive hangar decks in the measured through-slot (open on both beams) ----
 const dock=part('hangar','後部格納甲板（舷側貫通発着口）',[353,Y(120),0],30,{room:[156,206,15],airRole:'mixed'});
 openBay(s,dock,'port','open');openBay(s,dock,'stbd','open');
 if(opt.stage==='dock'){delete s._building;return s;}
 // ---- stern: auxiliary reactor for the radial ion drives; port-side hyperdrive module ----
 const ra=part('aux','艦尾補助炉',[216,Y(120),0],100);
 const eo=equipmentOptions('exposedTurbine');
 const engine=(label,mouth,y,z,d,body,mirror)=>{const nl=engineBaseline('exposed',d,'nozzleLength'),len=engineBaseline('exposed',d,'length')*body/engineBaseline('exposed',d,'body');const p=placePart(s,'engine',[mouth+nl/2,y,z],d,{...eo,label,d,reactor:ra.id,dir:[-1,0,0],engineLength:len},mirror);resizeEngine(p,d,len);return p;};
 engine('中央主機（ヌビアン・クレヴェルド4放射状イオン機関）',10.3,Y(122.3),0,34,engineBaseline('exposed',34,'body'),false);
 engine('舷側主機（ヌビアン・クレヴェルド4放射状イオン機関）',18.6,Y(112.2),43.35,54,engineBaseline('exposed',54,'body'),true);
 part('hyper','左舷ハイパードライブ・モジュール',[240,Y(160),-60],24,{length:70});
 // ---- bow: main and subsidiary reactors, the deflector shield generator network,
 //      the hyperdrive reactant silo and compressed reactant tank; mid: inertial compensator ----
 part('gen','主反応炉（艦首）',[760,Y(116),0],56);
 part('aux','副反応炉（艦首）',[880,Y(114),0],40);
 for(const sg of [-1,1])part('shield','偏向シールド発生器網',[820,Y(114),sg*30],28);
 for(const sg of [-1,1])part('fuel','ハイパードライブ反応物サイロ／圧縮反応物タンク',[680,Y(114),sg*36],22,{length:30,dir:[0,1,0]});
 part('inertial','慣性補償装置',[600,Y(118),0],34,{length:70});
 if(opt.stage==='machinery'){delete s._building;return s;}
 // Heavy guns keep their charging plant wholly inside the envelope and clear of
 // machinery: the plant is pushed deeper until all its corners are enclosed.
 let solidList=null;
 const plantFits=f=>{if(!needsCapacitor(f))return true;const q=weaponChargeSpec(f),depth=12*(f.scale||1),side=Math.sqrt(q.targetVolume/depth),up=fitUp(f),fr=frameAxis(up);solidList=solidList||allOccupied(s).map(p=>({p,b:partAABB(p)}));
  for(const cd of [10,13,16,20,24,28,33,38,44]){const c=sub(f.p,mul(up,cd+(f.mountOffset||0)));let ok=true;
   for(const a of [-.5,0,.5])for(const b of [-.5,0,.5])for(const e of [-.5,0,.5]){const pt=add(c,add(mul(up,a*depth),add(mul(fr.v,b*side),mul(fr.w,e*side))));if(!insideOriginalEnvelope(s,pt)||solidList.some(o=>pt.every((v,i)=>v>=o.b[i]&&v<=o.b[i+3])&&inPart(o.p,pt))){ok=false;break;}}
   if(ok){f.chargeDepth=cd;return true;}}return false;};
 // One fitting cast onto the outermost surface along its axis. Armour plates take
 // no fittings, so a probe that lands on a plate (or finds no surface) is refused.
 const tryMount=(kind,p,axis,zone,o={})=>{const f={id:s.nextId++,k:kind,p:p.slice(),a:axis,ped:0,base:0,low:0,float:false,batteryZone:zone,...o};mountFit(s,f);const why=f._onPlate?'plate':f.float?'float':!plantFits(f)?'plant':'';if(opt.dbg)opt.dbg.push([kind,zone,p.map(Math.round).join(','),why||'ok',f.p.map(Math.round).join(',')]);if(why){s.nextId--;return null;}return f;};
 const clearOf=(f,list)=>list.every(g=>Math.hypot(f.p[0]-g.p[0],f.p[1]-g.p[1],f.p[2]-g.p[2])>=((FITS[f.k]?.fm||10)+(FITS[g.k]?.fm||10))*.5+2);
 // n fittings over candidate stations: dorsal ('top') and ventral ('bottom') rows
 // take |z| offsets and mount as mirrored pairs (0 = centreline); 'beam' rows take
 // heights and mount one a side. Stations on plates or crowding others are skipped.
 const spread=(kind,n,mode,zone,xs,offs,o={})=>{let got=0;
  for(const off of offs)for(const x of xs){if(got>=n)break;
   const ps=mode==='beam'?[[[x,off,400],4],[[x,off,-400],5]]:(off?[1,-1]:[1]).map(sg=>[[x,0,sg*off],mode==='top'?2:3]);
   if(got+ps.length>n)continue;const fs=[];
   for(const [p,a] of ps){const f=tryMount(kind,p,a,zone+(ps.length>1?(p[2]>0?'-stbd':'-port'):''),o);if(!f||!clearOf(f,s.fits.concat(fs)))break;fs.push(f);}
   if(fs.length<ps.length)continue;s.fits.push(...fs);got+=fs.length;}
  if(got<n)throw new Error('作例の砲座が不足しています: '+kind+' '+zone+' '+got+'/'+n);};
 const range=(a,b,st)=>{const r=[];for(let x=a;x<=b+1e-6;x+=st)r.push(x);return r;};
 // Pods seat on the first wall hit among a few probe heights.
 const pod=(kind,host,o,dir,w,h)=>{let err='取付面がありません';for(const dy of [0,-4,4,-8,8,-12,12,-16,16])for(const dz of [0,-6,6,-12,12]){const q0=[o[0],o[1]+dy,o[2]+(dir[2]?0:dz)];const hit=rayPart(q0,dir,host);if(!hit)continue;const r=placeFit(s,kind,hit.p,hit.n,0,false);if(r.fit){r.fit.width=w;r.fit.height=h;r.fit.commandDepth=7;r.fit.commandHeight=5;return r.fit;}err=r.err;}throw new Error('艦橋ポッド '+kind+': '+err);};

 const ridge=s.parts.find(p=>p.label==='艦首上部の艦橋稜線'),obs=s.parts.find(p=>p.label==='改装通信・センサー・ポッド（展望甲板）'),box83=s.parts.find(p=>p.label==='背面の機器区画');
 pod('podBridge',ridge,[930,Y(162),40],[0,0,-1],12,5);
 pod('podCombat',obs,[130,Y(338),60],[0,0,-1],14,5);
 pod('podAir',box83,[560,Y(180),0],[-1,0,0],14,5);
 syncAviationSurfaces(s);s._lockedCache=cache(s);
 try{withFrozenStructures(()=>{
  // Quad turbolaser turrets (heavy), ventral: the main battery. (Canon lists 14; v15 keeps the
  // visible batteries to a readable number and the firepower in line with ships of its size.)
  spread('htl',10,'bottom','ventral-quad',range(330,1040,26),[60,45,75,30,88]);
  // 2 ion cannons at the bow
  spread('ion',2,'top','bow-ion',range(950,1050,8).reverse(),[18,24,12,30]);
  // Dual laser cannon turrets along the sides of the bow
  spread('ltl',12,'beam','side-laser',range(540,1020,15),[Y(130),Y(116),Y(104),Y(142)]);
  // Proton torpedo banks along the bow sides and dorsal (each bank a row of tubes)
  spread('msl',8,'beam','side-torpedo',range(545,1020,28),[Y(124),Y(110),Y(136),Y(98)]);
  spread('msl',6,'top','dorsal-torpedo',range(545,1010,40),[14,28,0,42,56]);
  // Point-defence ion cannons: ventral and dorsal-aft
  spread('pd',6,'bottom','ventral-pd',range(300,980,60),[70,85,55]);
  spread('pd',2,'top','dorsal-aft-pd',range(280,500,24),[0,20]);
  // tractor beam projectors, ventral
  spread('trc',4,'bottom','tractor',range(500,960,25),[55,70,40,85]);
 });}finally{delete s._lockedCache;}
 if(opt.stage==='fitted'){delete s._building;return s;}

 if(opt.stage==='shape'){delete s._building;return s;}
 // ---- compartments packed into the measured hull and structures ----
 for(const [kind,label,c,size,role,mirror] of D.rooms){const o={room:size};if(typeof role==='string')o.airRole=role;placePart(s,kind,c,30,{label,...o},mirror===1||role===1);}
 // Canon complement: 120 Vulture droids, 120 droid tri-fighters, 10 Hyena bombers;
 // HMP gunships and Sheathipede shuttles are a game setting. 48,247 troops.
 s.airWings=PROV_AIR.map(r=>({...r}));s.groundForces=normalizeGroundForces(PROV_GROUND);
 delete s._building;adoptEquipment(s,true);remount(s);
 // Broadside batteries along the flanks (v14): short-ranged, the most fire for the power.
 sideBattery(s,[420,520,620,720,820,920],null,'casemateMid',{level:.45});remount(s);syncCompartments(s);
 return s;

}
registerShipExample({
 key:'providence',name:'プロヴィデンス級空母／駆逐艦',side:'独立星系連合',role:'空母／駆逐艦',length:1088,
 title:'Star Wars: The Clone Wars Providence',author:'lolqeeeeeeeeee',authorUrl:'https://sketchfab.com/lolqeeeeeeeeee',
 source:'https://sketchfab.com/3d-models/star-wars-the-clone-wars-providence-8d27764a7d254fd7948557daf6d7ccdc',license:'CC BY-NC 4.0',
 credit:'This work is based on "Star Wars: The Clone Wars Providence" (https://sketchfab.com/3d-models/star-wars-the-clone-wars-providence-8d27764a7d254fd7948557daf6d7ccdc) by lolqeeeeeeeeee (https://sketchfab.com/lolqeeeeeeeeee) licensed under CC-BY-NC-4.0 (http://creativecommons.org/licenses/by-nc/4.0/)',
 note:'DK の断面図（インヴィジブル・ハンド）の配置と寸法（全長 1,088 m・幅 198 m・塔を含む高さ 347 m）に合わせ、Sketchfab の 3D モデル（lolqeeeeeeeeee 作、CC BY-NC 4.0）の実測形状を高さ方向に 0.928 倍して組み直した独立星系連合の空母／駆逐艦。格納甲板上部の背部湾曲装甲殻、中央背面の装甲板、前部腹部の湾曲装甲は装甲外板（厚さ 0.6〜0.8 m）で、武装は載せない。艦首上部に艦橋、艦首に主反応炉・副反応炉・偏向シールド発生器網・ハイパードライブ反応物サイロ、中央に慣性補償装置、後半部に格納甲板（艦載機ラック、MTT と装甲車両の格納区画、整備甲板）、艦尾上部にウィザーズ・タワー（改装通信・センサー・ポッド）、艦尾に補助炉・放射状イオン機関・左舷ハイパードライブ・モジュール。兵装は主砲の重ターボレーザー砲塔 10 基、二連レーザー砲 12 基、イオン砲 2 基、点防御イオン砲 8 基、プロトン魚雷発射機 14 基（発射管の列を1基で代表）、トラクター・ビーム投射機 4 基、舷側の連装ケースメイト砲 12 基（原典の砲塔数から、見た目と火力を同級の艦に揃えて減らしています）。艦載機はトライファイター 120 機とヴァルチャー 120 機、MTT 160 両と装甲ドロイド車両 280 両（AAT・ヘイルファイア・OG-9・LM-432）。停止保管ドロイドは DK では最大 150 万体だが、船内に収まる 16 万 2,000 体とした。加速約 2,560 G、ハイパードライブ・クラス 1.5。公式の乗員は 600 体のドロイド。',
 airWings:PROV_AIR,groundForces:PROV_GROUND,
 build:providenceBuild
});
}

// ---- src/ships/recusant.js ----
// Recusant-class light destroyer, measured from "Star Wars: The Clone Wars
// Recusant (S3E2 style)" by lolqeeeeeeeeee on Sketchfab (CC BY-NC 4.0). Ship
// frame: x from the stern (0) to the bow (1,187 m), y up from the lowest point,
// z to starboard. The hull is fitted to the domed superstructure (mid dome and
// prow); a thin keel line runs aft inside the spine and the core. The central
// core under the domes, the aft spine, the aft command block, the two stern pods, the dorsal
// ridges, the ventral shell, the nose keel and the ventral fins are structures.
{
const RECU={"W":122.751,"H":140.0,"st":[[0.0,0.015,0.0107,0.0518,0.8,0.8,0.5,0.5],[0.05223,0.015,0.0107,-0.0696,0.8,0.8,0.5,0.5],[0.45358,0.015,0.0107,-0.0696,0.8,0.8,0.5,0.5],[0.45746,0.4342,0.05,0.2393,0.9384,0.98,0.02,0.2],[0.46757,0.4546,0.1786,0.325,0.4418,0.9771,0.02,0.29],[0.49284,0.5334,0.2143,0.3357,0.3949,0.9698,0.02,0.27],[0.53075,0.6949,0.2714,0.3571,0.3839,0.9754,0.02,0.2],[0.55602,0.7845,0.3,0.3786,0.3647,0.9745,0.02,0.2],[0.56613,0.8404,0.3429,0.3714,0.3616,0.9763,0.02,0.2],[0.5813,0.8435,0.3143,0.4071,0.3253,0.9778,0.02,0.2],[0.58888,0.8634,0.3214,0.4107,0.3301,0.9779,0.02,0.2],[0.59393,0.9276,0.3714,0.3857,0.3409,0.9709,0.02,0.2],[0.62426,0.9948,0.3857,0.3857,0.3124,0.9712,0.02,0.2],[0.63184,0.9602,0.3429,0.4071,0.3054,0.9735,0.02,0.2],[0.63943,0.9979,0.3786,0.3893,0.3087,0.974,0.02,0.2],[0.64448,0.9949,0.3857,0.3857,0.3124,0.9793,0.02,0.21],[0.65965,0.996,0.5429,0.2857,0.3762,0.98,0.52,0.2],[0.67734,0.9617,0.5357,0.2607,0.3704,0.98,0.65,0.2],[0.68745,0.934,0.4786,0.275,0.3595,0.98,0.56,0.2],[0.68997,0.9254,0.4214,0.2964,0.3803,0.98,0.44,0.2],[0.70008,0.883,0.5286,0.2214,0.4048,0.9288,0.11,0.51],[0.72536,0.7924,0.4214,0.1821,0.5658,0.98,0.02,0.22],[0.74052,0.7645,0.3286,0.1857,0.3499,0.9753,0.02,0.26],[0.78349,0.6951,0.2929,0.1893,0.3878,0.9771,0.02,0.24],[0.80118,0.599,0.2071,0.225,0.4094,0.9778,0.02,0.2],[0.82393,0.5647,0.2214,0.2107,0.4298,0.98,0.02,0.2],[0.8492,0.5531,0.2429,0.1857,0.3933,0.9722,0.02,0.24],[0.87447,0.5442,0.3,0.1429,0.3794,0.9752,0.02,0.24],[0.96546,0.2234,0.0857,0.0643,0.2833,0.9784,0.02,0.2],[1.0,0.0468,0.0143,0.0071,0.301,0.98,0.19,0.2]],"loft":{"domeRidge":[[585.67,-3.01,3.01,142.84,142.94],[589.71,-5.22,5.22,140.67,147.87],[601.16,-8.97,8.97,140.87,152.13],[601.83,-9.76,9.76,132.69,152.38],[604.52,-11.83,11.83,133.14,152.78],[615.3,-12.45,12.45,134.93,153.57],[617.32,-12.57,12.57,135.27,152.14],[624.05,-12.96,12.96,136.39,152.23],[625.4,-13.03,13.03,136.61,151.18],[626.07,-9.21,9.21,136.72,151.14],[707.57,-10.41,10.41,149.0,160.99],[708.91,-13.77,13.77,148.04,161.0],[769.53,-13.65,13.65,148.44,161.0],[770.2,-13.35,13.35,148.58,161.0],[770.87,-13.05,13.05,155.56,161.0],[785.69,-6.47,6.47,155.56,161.0],[787.04,-5.82,5.82,158.84,161.0],[787.71,-5.53,5.53,160.84,161.0]],"bowRidge":[[845.0,-16.19,16.19,121.31,130.33],[845.82,-16.18,16.18,111.17,130.33],[855.66,-16.02,16.02,111.17,130.61],[859.76,-15.94,15.94,111.17,133.1],[898.3,-15.28,15.28,111.17,131.53],[901.58,-15.22,15.22,111.17,130.33],[940.94,-14.14,14.14,111.17,130.33],[943.4,-11.7,11.7,111.17,130.33],[946.68,-11.7,11.7,111.17,125.79],[947.5,-11.7,11.7,111.17,121.4],[950.78,-11.7,11.7,111.17,121.4],[953.24,-11.7,11.7,111.17,117.41],[1016.38,-11.7,11.7,111.17,117.41],[1017.2,-11.7,11.7,104.94,117.41],[1040.98,-11.45,11.45,104.94,117.41],[1041.8,-11.44,11.44,104.94,121.35],[1057.38,-11.96,11.96,104.94,121.34],[1058.2,-12.18,12.18,113.46,121.34],[1060.66,-14.04,14.04,113.56,121.34],[1067.22,-14.01,14.01,113.82,121.34],[1068.04,-11.72,11.72,113.85,121.34],[1079.52,-11.56,11.56,113.86,120.79],[1083.62,-10.99,10.99,113.86,119.64],[1089.36,-7.6,7.6,114.62,117.93],[1091.0,-4.66,4.66,115.15,117.35]],"lowerShell":[[825.08,-17.96,17.96,35.62,52.8],[827.22,-17.95,17.95,35.62,52.77],[827.93,-55.67,55.67,33.03,52.76],[834.35,-55.7,55.7,29.29,52.69],[835.77,-55.7,55.7,23.38,52.67],[863.57,-55.81,55.81,17.88,53.52],[867.13,-55.82,55.82,17.88,59.43],[891.36,-55.92,55.92,15.22,59.57],[934.12,-55.94,55.94,13.26,59.81],[934.83,-47.92,47.92,17.88,59.82],[956.21,-22.72,22.72,17.88,59.94],[959.78,-20.17,20.17,23.42,59.96],[960.49,-20.17,20.17,34.27,59.96],[1016.08,-20.17,20.17,36.37,60.29],[1017.5,-20.17,20.17,41.07,60.29],[1033.9,-20.17,20.17,53.35,60.39],[1038.89,-20.17,20.17,60.35,60.42]],"noseKeel":[[1027.68,-11.3,11.3,52.86,70.56],[1047.6,-11.69,11.69,52.86,71.96],[1048.1,-11.71,11.71,43.01,72.0],[1050.09,-11.74,11.74,37.48,72.14],[1083.96,-11.91,11.91,39.31,72.74],[1087.95,-11.91,11.91,45.15,72.74],[1089.44,-11.91,11.91,48.71,72.74],[1089.94,-11.91,11.91,54.03,72.74],[1095.42,-11.83,11.83,54.56,72.47],[1100.9,-11.35,11.35,61.95,70.74],[1118.83,-9.35,9.35,62.25,70.55],[1121.32,-9.05,9.05,64.78,70.82],[1145.73,-5.94,5.94,66.29,73.33],[1173.12,-1.43,1.43,68.07,71.04],[1177.11,-0.75,0.75,70.52,70.56]],"vfinC":[[848.77,-7.74,7.74,10.98,11.03],[856.15,-7.74,7.74,4.87,11.03],[869.36,-7.74,7.74,4.45,11.03],[878.29,-7.81,7.81,1.79,11.22],[883.73,-9.05,9.05,1.78,14.29],[952.49,-8.97,8.97,1.64,13.91],[965.31,-5.26,5.26,1.62,4.74]],"vfinS":[[920.02,4.01,7.66,4.02,11.21],[920.28,3.94,10.52,3.05,11.35],[920.54,3.88,14.04,1.84,11.52],[921.07,3.73,14.83,1.37,11.86],[923.17,3.53,15.51,0.55,12.31],[928.68,3.53,15.36,0.71,12.31],[929.47,3.91,14.77,1.38,11.87],[930.78,5.45,14.13,2.12,10.08],[937.6,5.43,14.13,2.12,10.1],[939.7,3.53,14.99,1.13,12.31],[941.54,3.53,15.51,0.55,12.31],[943.64,3.53,15.51,0.0,12.31],[946.52,3.53,15.51,0.27,12.31],[948.62,3.53,15.22,0.87,12.31],[949.67,3.97,14.59,1.6,11.8],[951.51,5.6,14.13,2.12,9.92],[956.76,5.47,14.21,2.04,10.19],[957.81,5.14,15.01,1.22,10.8],[960.69,5.2,14.98,1.26,10.8],[962.27,5.65,13.6,2.42,9.8],[966.73,6.0,10.97,3.91,9.04],[987.2,5.94,11.16,3.72,9.23],[988.77,5.72,12.35,2.5,9.92],[990.08,5.72,12.94,1.89,9.92],[993.23,5.79,12.94,2.08,9.92],[996.38,6.94,12.58,5.11,9.92],[998.74,7.78,11.77,7.34,9.92]],"aftSpine":[[62.4,-11.47,11.47,76.54,76.65],[86.85,-11.47,11.47,59.23,79.42],[95.0,-11.47,11.47,58.73,79.42],[97.71,-11.47,11.47,58.56,89.63],[143.89,-11.59,11.59,61.78,87.19],[160.19,-7.41,7.41,61.78,87.17],[162.9,-19.07,19.07,61.78,87.17],[175.13,-21.36,21.36,61.78,87.16],[179.2,-21.34,21.34,48.47,87.15],[198.22,-21.26,21.26,36.41,87.13],[241.68,-16.92,16.92,37.05,87.06],[243.04,-22.54,22.54,37.07,101.53],[286.5,-24.87,24.87,37.07,112.54],[289.21,-18.02,18.02,37.07,108.73],[290.57,-18.0,18.0,53.93,108.73],[309.58,-21.21,21.21,53.93,101.44],[319.09,-21.2,21.2,53.93,101.2],[321.81,-21.19,21.19,53.93,90.5],[370.7,-20.15,20.15,37.96,83.05],[382.93,-23.07,23.07,37.96,82.63],[416.88,-24.86,24.86,48.1,80.66],[450.83,-24.86,24.86,45.73,87.16],[465.77,-24.86,24.86,48.1,92.77],[467.13,-24.86,24.86,48.1,68.3],[469.85,-14.64,14.64,48.1,57.73]],"aftUpper":[[172.04,-5.97,5.97,134.07,134.13],[174.86,-5.97,5.97,132.66,136.34],[175.56,-12.49,12.49,132.3,136.9],[194.58,-13.87,13.87,128.59,146.81],[212.19,-13.87,13.87,125.97,153.99],[225.57,-13.87,13.87,119.12,153.85],[248.11,-13.87,13.87,117.38,155.35],[248.81,-22.17,22.17,116.83,153.72],[252.34,-22.17,22.17,114.06,146.25],[258.67,-22.17,22.17,112.44,148.39],[262.2,-24.66,24.66,112.44,148.11],[263.6,-24.66,24.66,111.38,147.7],[264.31,-24.66,24.66,100.95,146.25],[278.4,-24.66,24.66,100.95,147.78],[286.14,-24.66,24.66,100.95,148.81],[296.71,-24.66,24.66,100.95,154.26],[303.75,-24.66,24.66,100.95,154.26],[305.16,-25.53,25.53,100.95,157.94],[323.47,-25.53,25.53,100.95,156.4],[327.7,-25.53,25.53,103.39,156.4],[328.4,-25.53,25.53,108.12,156.4],[347.42,-25.53,25.53,108.12,151.64],[349.53,-25.53,25.53,108.12,149.2],[350.94,-22.17,22.17,108.12,147.56],[355.17,-20.06,20.06,110.11,141.78],[357.28,-20.06,20.06,110.11,141.78],[359.39,-22.17,22.17,108.12,145.01],[375.59,-17.66,17.66,109.53,140.44],[382.63,-14.04,14.04,110.67,136.77],[383.34,-13.7,13.7,126.17,136.43]],"aftPod":[[104.63,52.87,57.88,28.95,40.77],[108.89,51.08,60.62,27.59,41.65],[109.6,49.98,61.09,22.52,47.3],[122.38,46.61,67.09,19.74,48.97],[148.66,45.08,75.53,17.9,49.09],[158.6,40.69,75.45,17.9,49.09],[174.94,40.69,78.53,15.95,49.09],[182.04,39.51,78.53,15.95,49.26],[182.75,39.04,77.6,11.72,55.63],[187.01,36.23,70.9,11.72,57.45],[192.69,35.09,70.9,11.72,59.88],[194.12,35.09,70.9,9.12,60.48],[196.96,35.09,70.9,9.12,60.52],[197.67,30.74,70.9,9.12,60.66],[198.38,22.07,70.9,9.12,64.7],[222.52,22.07,72.27,9.17,64.7],[230.34,22.07,75.37,9.18,64.7],[238.15,22.07,75.37,9.19,64.7],[239.57,22.07,77.79,9.19,64.7],[258.04,22.07,76.82,10.38,64.7],[258.75,25.86,76.82,10.38,64.7],[280.05,26.93,74.84,10.38,64.7],[286.45,26.93,70.71,11.72,64.7],[289.29,29.21,67.97,14.36,62.2],[291.42,29.21,67.97,14.36,62.2],[292.84,26.93,70.72,11.72,64.7],[304.2,27.93,68.84,13.86,63.04],[316.99,32.15,60.9,22.83,56.05],[317.7,44.09,60.48,23.29,51.16]],"core":[[449.23,-18.18,18.18,67.69,83.39],[468.4,-29.01,29.01,63.43,91.82],[472.66,-29.79,29.79,48.89,91.8],[500.34,-26.81,26.81,39.73,91.69],[508.85,-27.97,27.97,36.27,112.99],[570.6,-26.81,26.81,29.42,123.94],[591.89,-26.81,26.81,29.42,123.94],[604.67,-25.51,25.51,39.73,123.94],[608.93,-25.51,25.51,26.85,123.94],[664.29,-24.83,24.83,26.95,113.42],[668.55,-37.03,37.03,26.95,113.42],[683.45,-32.15,32.15,30.21,113.42],[711.13,-34.65,34.65,38.39,113.42],[743.07,-34.96,34.96,38.39,113.42],[764.36,-36.24,36.24,29.34,113.42],[785.65,-35.77,35.77,30.44,113.42],[804.82,-35.5,35.5,31.08,113.42],[834.63,-31.07,31.07,28.89,114.09],[836.76,-31.07,31.07,28.89,82.06],[951.73,-36.93,36.93,30.81,88.29],[953.86,-31.07,31.07,12.09,88.25],[968.77,-31.07,31.07,7.29,88.03],[973.03,-18.89,18.89,7.33,87.97],[975.16,-18.89,18.89,7.35,87.93],[977.28,-18.89,18.89,7.37,126.32],[981.54,-18.89,18.89,8.42,125.56],[983.67,-18.89,18.89,54.28,122.95],[1024.13,-18.88,18.88,54.28,131.93],[1026.26,-17.63,17.63,54.28,82.77],[1032.64,-17.63,17.63,58.98,70.32],[1062.45,-6.94,6.94,111.76,114.91],[1088.0,-5.73,5.73,113.17,113.51]]},"rooms":[["hangar","艦載機待機区画（中空構造内のラック）",[637.5,72.85,0],[104.4,47.4,45.7],"storage"],["hangar","艦載機待機区画（中空構造内のラック） 2",[823.5,84.85,-18],[56.4,23.4,69.7],"storage"],["hangar","艦載機待機区画（中空構造内のラック） 3",[823.5,84.85,18],[56.4,23.4,69.7],"storage"],["hangar","艦載機待機区画（中空構造内のラック） 4",[715.5,72.85,0],[14.4,59.4,45.7],"storage"],["hangar","艦載機待機区画（中空構造内のラック） 5",[876,83.35,-12],[47.4,11.4,66.7],"storage"],["hangar","艦載機待機区画（中空構造内のラック） 6",[876,83.35,12],[47.4,11.4,66.7],"storage"],["hangar","艦載機待機区画（中空構造内のラック） 7",[843,56.35,0],[113.4,11.4,12.7],"storage"],["hangar","艦載機待機区画（中空構造内のラック） 8",[699,57.85,0],[17.4,59.4,15.7],"storage"],["hangar","艦載機待機区画（中空構造内のラック） 9",[727.5,57.85,0],[8.4,59.4,15.7],"storage"],["service","航空整備・補給区画",[934.5,51,0],[68.4,53.4,35.4]],["service","航空整備・補給区画 2",[494.37,73.5,0],[46.14,41.4,20.4]],["service","航空整備・補給区画 3",[483,52.5,0],[11.4,29.4,8.4]],["cargo","貨物・物資庫",[269.17,78,0],[93.75,23.4,11.4]],["cargo","貨物・物資庫 2",[195,135,0],[29.4,17.4,5.4]],["integrity","構造維持装置",[280.86,67.5,0],[111.11,29.4,8.4]],["integrity","構造維持装置 2",[213,141,0],[41.4,11.4,5.4]],["pump","反応物供給設備",[242.71,133.5,0],[64.81,17.4,8.4]],["troops","居住甲板・兵員収容区画（停止保管ドロイド）",[564,70.5,0],[41.4,47.4,56.4]],["troops","居住甲板・兵員収容区画（停止保管ドロイド） 2",[405,70.5,0],[131.4,29.4,14.4]],["troops","居住甲板・兵員収容区画（停止保管ドロイド） 3",[291,100.5,0],[53.4,29.4,32.4]],["troops","居住甲板・兵員収容区画（停止保管ドロイド） 4",[660,112.5,-12],[125.4,11.4,32.4]],["troops","居住甲板・兵員収容区画（停止保管ドロイド） 5",[660,112.5,12],[125.4,11.4,32.4]],["troops","居住甲板・兵員収容区画（停止保管ドロイド） 6",[529.5,82.5,0],[20.4,53.4,38.4]],["troops","居住甲板・兵員収容区画（停止保管ドロイド） 7",[744,141,0],[83.4,41.4,11.4]],["troops","居住甲板・兵員収容区画（停止保管ドロイド） 8",[891,37.5,0],[17.4,83.4,26.4]],["troops","居住甲板・兵員収容区画（停止保管ドロイド） 9",[807,127.5,0],[53.4,47.4,14.4]],["troops","居住甲板・兵員収容区画（停止保管ドロイド） 10",[334.5,130.5,0],[26.4,35.4,38.4]],["troops","居住甲板・兵員収容区画（停止保管ドロイド） 11",[203.47,36,-37.5],[10.35,8.4,35.4]]]};
const REC_AIR=[{id:'air-1',name:'ヴァルチャー級ドロイド・スターファイター',size:1,count:66},{id:'air-2',name:'ドロイド・トライファイター',size:1,count:32}];
const REC_GROUND=[{id:'ground-1',name:'B1バトル・ドロイド（停止保管）',kind:'troops',count:40000}];
const REC_TAN='#a89a7c',REC_BROWN='#8f8268',REC_STEEL='#6f7a86',REC_DARK='#5f646b',REC_PLATE='#c9d0d8';
function recusantBuild(opt={}){
 const D=RECU,L=1187,SZ=.921,Z=v=>v*SZ;
 const s=newShip({L,W:D.W,H:D.H,sec:'warship',plan:'wedge',deckWidth:0,keelWidth:0,belt:.13,chineHeight:.5,bowFree:true,stations:D.st.map(a=>a.slice()),keel:'light'},'レキュザント級軽駆逐艦');
 s._building=true;s.reference='recusant';s.paint='cis';s.lights='warm';s.detail=1;s.armor={hull:.38,cit:.35};s.shieldTarget=1;
 const k=shipKit(s),part=(kind,label,c,d,o={})=>placePart(s,kind,c,d,{label,...o});
 const loft=(name,label,paint,o={},mirror=false)=>k.loftX(label,D.loft[name],{paint,corner:.12,...o},mirror);
 loft('core','中央船体の竜骨区画',REC_BROWN,{corner:.3});
 loft('aftSpine','艦尾脊柱',REC_TAN,{corner:.16});
 loft('aftUpper','艦尾ハイパードライブ・ブロック',REC_TAN,{corner:.16});
 loft('aftPod','イオン化室（艦尾舷側ポッド）',REC_BROWN,{round:true},true);
 loft('domeRidge','背部ドーム稜線',REC_BROWN,{corner:.1});
 loft('bowRidge','艦首背面稜線',REC_BROWN,{corner:.1});
 // Smooth armoured hull segments (they guide the circulating shields): plates, no guns.
 loft('lowerShell','前部腹部の平滑装甲セグメント',REC_PLATE,{round:true,plate:true,plateT:.72});
 {const rows=[];for(let x=885;x<=1140;x+=15){const b=sectionBase(s.hull,x);rows.push([x,-(b.hw+.8),b.hw+.8,b.ybot+b.h*.62,b.ybot+b.h+.8]);}
  k.loftX('艦首上部の平滑装甲セグメント',rows,{paint:REC_PLATE,corner:.35,plate:true,plateT:.72});}
 loft('noseKeel','艦首下部竜骨',REC_BROWN,{corner:.12});
 loft('vfinC','腹部中央安定翼',REC_STEEL,{corner:.08});
 loft('vfinS','腹部舷側安定翼',REC_STEEL,{corner:.08},true);
 // ---- mid-ship: the hollow ribbed interior that shelters fighters (open through the keel) ----
 const dock=part('hangar','艦載機待機空洞（中央部の中空構造）',[735,41,0],30,{room:[290,Z(32),18],airRole:'mixed'});
 openBay(s,dock,'bottom','open');
 if(opt.stage==='dock'){delete s._building;return s;}
 // ---- power: main reactor at the aft end of the main hull; stern plants feed the drives ----
 const r=part('gen','主反応炉（主船体後半部）',[760,89,0],72);
 const ra=part('aux','艦尾脊柱補助炉',[200,65,0],46);
 const rpS=part('aux','右舷イオン化室補助炉',[243,38,Z(55)],52),rpP=part('aux','左舷イオン化室補助炉',[243,38,Z(-55)],52);
 const eo=equipmentOptions('exposedTurbine');
 const engine=(label,mouth,y,z,d,body,reactor,mirror)=>{const nl=engineBaseline('exposed',d,'nozzleLength'),len=engineBaseline('exposed',d,'length')*body/engineBaseline('exposed',d,'body');const p=placePart(s,'engine',[mouth+nl/2,y,z],d,{...eo,label,d,reactor:reactor.id,dir:[-1,0,0],engineLength:len},mirror);resizeEngine(p,d,len);return p;};
 engine('艦尾中央スラスター',58,69,0,38,140,ra,false);
 engine('右舷ポッド・スラスター',100,35,Z(61),44,150,rpS,false);engine('左舷ポッド・スラスター',100,35,Z(-61),44,150,rpP,false);
 // ---- stern block: hyperdrive; forward: shield generators under the smooth segments ----
 part('hyper','ハイパードライブ（艦尾ブロック）',[300,130,0],21,{length:42.5});
 for(const sg of [-1,1])part('shield','偏向シールド発生器（平滑装甲セグメント内）',[930,86,Z(sg*20)],30);
 for(const sg of [-1,1])part('fuel','反応物サイロ',[700,82,Z(sg*14)],16,{length:28,dir:[0,1,0]});
 part('inertial','慣性補償装置',[1005,56,0],28,{length:60});
 if(opt.stage==='machinery'){delete s._building;return s;}
 // Heavy guns keep their charging plant wholly inside the envelope and clear of
 // machinery: the plant is pushed deeper until all its corners are enclosed.
 let solidList=null;
 const plantFits=f=>{if(!needsCapacitor(f))return true;const q=weaponChargeSpec(f),depth=12*(f.scale||1),side=Math.sqrt(q.targetVolume/depth),up=fitUp(f),fr=frameAxis(up);solidList=solidList||allOccupied(s).map(p=>({p,b:partAABB(p)}));
  for(const cd of [10,13,16,20,24,28,33,38,44]){const c=sub(f.p,mul(up,cd+(f.mountOffset||0)));let ok=true;
   for(const a of [-.5,0,.5])for(const b of [-.5,0,.5])for(const e of [-.5,0,.5]){const pt=add(c,add(mul(up,a*depth),add(mul(fr.v,b*side),mul(fr.w,e*side))));if(!insideOriginalEnvelope(s,pt)||solidList.some(o=>pt.every((v,i)=>v>=o.b[i]&&v<=o.b[i+3])&&inPart(o.p,pt))){ok=false;break;}}
   if(ok){f.chargeDepth=cd;return true;}}return false;};
 // One fitting cast onto the outermost surface along its axis. Armour plates take
 // no fittings, so a probe that lands on a plate (or finds no surface) is refused.
 const tryMount=(kind,p,axis,zone,o={})=>{const f={id:s.nextId++,k:kind,p:p.slice(),a:axis,ped:0,base:0,low:0,float:false,batteryZone:zone,...o};mountFit(s,f);const why=f._onPlate?'plate':f.float?'float':!plantFits(f)?'plant':'';if(opt.dbg)opt.dbg.push([kind,zone,p.map(Math.round).join(','),why||'ok',f.p.map(Math.round).join(',')]);if(why){s.nextId--;return null;}return f;};
 const clearOf=(f,list)=>list.every(g=>Math.hypot(f.p[0]-g.p[0],f.p[1]-g.p[1],f.p[2]-g.p[2])>=((FITS[f.k]?.fm||10)+(FITS[g.k]?.fm||10))*.5+2);
 // n fittings over candidate stations: dorsal ('top') and ventral ('bottom') rows
 // take |z| offsets and mount as mirrored pairs (0 = centreline); 'beam' rows take
 // heights and mount one a side. Stations on plates or crowding others are skipped.
 const spread=(kind,n,mode,zone,xs,offs,o={})=>{let got=0;
  for(const off of offs)for(const x of xs){if(got>=n)break;
   const ps=mode==='beam'?[[[x,off,400],4],[[x,off,-400],5]]:(off?[1,-1]:[1]).map(sg=>[[x,0,sg*off],mode==='top'?2:3]);
   if(got+ps.length>n)continue;const fs=[];
   for(const [p,a] of ps){const f=tryMount(kind,p,a,zone+(ps.length>1?(p[2]>0?'-stbd':'-port'):''),o);if(!f||!clearOf(f,s.fits.concat(fs)))break;fs.push(f);}
   if(fs.length<ps.length)continue;s.fits.push(...fs);got+=fs.length;}
  if(got<n)throw new Error('作例の砲座が不足しています: '+kind+' '+zone+' '+got+'/'+n);};
 const range=(a,b,st)=>{const r=[];for(let x=a;x<=b+1e-6;x+=st)r.push(x);return r;};
 // Pods seat on the first wall hit among a few probe heights.
 const pod=(kind,host,o,dir,w,h)=>{let err='取付面がありません';for(const dy of [0,-4,4,-8,8,-12,12,-16,16])for(const dz of [0,-6,6,-12,12]){const q0=[o[0],o[1]+dy,o[2]+(dir[2]?0:dz)];const hit=rayPart(q0,dir,host);if(!hit)continue;const r=placeFit(s,kind,hit.p,hit.n,0,false);if(r.fit){r.fit.width=w;r.fit.height=h;r.fit.commandDepth=7;r.fit.commandHeight=5;return r.fit;}err=r.err;}throw new Error('艦橋ポッド '+kind+': '+err);};

 const bow=s.parts.find(p=>p.label==='艦首背面稜線'),dome=s.parts.find(p=>p.label==='背部ドーム稜線');
 pod('podBridge',bow,[1010,122,Z(60)],[0,0,-1],12,5);
 pod('podCombat',bow,[1010,122,Z(-60)],[0,0,1],12,5);
 pod('podAir',dome,[700,150,Z(60)],[0,0,-1],12,5);
 syncAviationSurfaces(s);s._lockedCache=cache(s);
 try{withFrozenStructures(()=>{
  // 1 prow heavy turbolaser cannon at the very front
  spread('stl',1,'bottom','prow',range(1080,1170,6).reverse(),[0]);
  // 4 heavy turbolaser cannons on the forward flanks, below the smooth segments
  spread('htl',4,'beam','fwd-flank-heavy',range(860,1060,14),[66,72,60,78,54]);
  // 6 heavy turbolaser turrets on the dorsal hump
  spread('mtl',4,'top','dorsal-heavy',range(590,800,18),[Z(28),Z(20),Z(36),0]);
  // 5 turbolaser cannons on the bow ridge
  spread('mtl',3,'top','bow-ridge',range(850,1090,20),[0]);
  // 30 dual laser cannons along the mid-ship flanks
  spread('ltl',10,'beam','laser',range(470,880,36),[34,48,80,92,62]);
  // 12 dual light laser cannons and 60 point-defence laser cannons
  spread('pd',8,'bottom','ventral-pd',range(470,1010,60),[Z(14),Z(30),Z(44)]);
  spread('pd',8,'top','dorsal-pd',range(470,1080,64),[Z(40),Z(48),Z(30),Z(56)]);
  spread('pd',4,'top','aft-pd',range(150,460,60),[Z(8),Z(20)]);
  // (the pod point-defence row of earlier versions is left off)
 });}finally{delete s._lockedCache;}
 if(opt.stage==='fitted'){delete s._building;return s;}

 if(opt.stage==='shape'){delete s._building;return s;}
 for(const [kind,label,c,size,role,mirror] of D.rooms||[]){const o={room:size};if(typeof role==='string')o.airRole=role;placePart(s,kind,c,30,{label,...o},mirror===1||role===1);}
 s.airWings=REC_AIR.map(r=>({...r}));s.groundForces=normalizeGroundForces(REC_GROUND);
 delete s._building;adoptEquipment(s,true);remount(s);
 // Broadside batteries along the flanks (v14): short-ranged, the most fire for the power.
 sideBattery(s,[300,420,540,660,780,900],null,'casemateMid',{level:.5});remount(s);syncCompartments(s);
 return s;

}
registerShipExample({
 key:'recusant',name:'レキュザント級軽駆逐艦',side:'独立星系連合',role:'軽駆逐艦',length:1187,
 title:'Star Wars: The Clone Wars Recusant (S3E2 style)',author:'lolqeeeeeeeeee',authorUrl:'https://sketchfab.com/lolqeeeeeeeeee',
 source:'https://sketchfab.com/3d-models/star-wars-the-clone-wars-recusant-s3e2-style-c0abad60cab44d9197589a69e78fb6c5',license:'CC BY-NC 4.0',
 credit:'This work is based on "Star Wars: The Clone Wars Recusant (S3E2 style)" (https://sketchfab.com/3d-models/star-wars-the-clone-wars-recusant-s3e2-style-c0abad60cab44d9197589a69e78fb6c5) by lolqeeeeeeeeee (https://sketchfab.com/lolqeeeeeeeeee) licensed under CC-BY-NC-4.0 (http://creativecommons.org/licenses/by-nc/4.0/)',
 note:'DK の断面図の配置と寸法（全長 1,187 m・幅 157 m・高さ 163 m）に合わせ、Sketchfab の 3D モデル（lolqeeeeeeeeee 作、S3E2 版、CC BY-NC 4.0）の実測形状を幅方向に 0.921 倍して組み直した軽駆逐艦。艦首上部と前部腹部の平滑装甲セグメントは装甲外板（厚さ 0.6 m）で、武装は載せない。艦尾ブロックにハイパードライブとイオン化室（舷側ポッド）、主船体後端に主反応炉、中央部の中空構造に艦載機の待機空洞（腹部に開口、格納庫ではない）、下部に居住甲板、艦首側に偏向シールド発生器と慣性補償装置、艦首上部の稜線に艦橋。兵装は艦首重ターボレーザー砲 1 基、艦首側面の重ターボレーザー砲 4 基、背部の中ターボレーザー砲塔 4 基、艦首稜線のターボレーザー砲 3 基、二連レーザー砲 10 基、点防御砲 20 基、舷側の連装ケースメイト砲 12 基（原典の砲塔数から、見た目と火力を同級の艦に揃えて減らしています）。停止保管バトル・ドロイド 4 万体、空洞にヴァルチャー 66 機とトライファイター 32 機（機数はゲーム上の設定）。加速約 2,840 G、ハイパードライブ・クラス 2。公式の乗員は 300。',
 airWings:REC_AIR,groundForces:REC_GROUND,
 build:recusantBuild
});
}

// ---- src/ships/reptransport.js ----
// Republic transport (Star Wars: The Old Republic era), measured from Daniel's
// Sketchfab model. The 35.9 m source is scaled to the yard's 60 m minimum hull
// length (x1.6696); every figure below is in that scaled ship frame
// (x stern 0 -> bow 60, y up from the keel, z starboard).
registerShipExample({
 key:'reptransport',name:'共和国輸送艦',side:'銀河共和国',role:'兵員・物資輸送艦',length:60,
 author:'Daniel (https://sketchfab.com/DanielAndersson)',
 source:'https://sketchfab.com/3d-models/star-wars-republic-transport-f12eab9e4a7b47e4b3a2fe9c61d8b8e1',
 license:'CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)',
 credit:'This work is based on "Star Wars: Republic Transport" (https://sketchfab.com/3d-models/star-wars-republic-transport-f12eab9e4a7b47e4b3a2fe9c61d8b8e1) by Daniel (https://sketchfab.com/DanielAndersson) licensed under CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)',
 note:'旧共和国時代の共和国輸送艦。丸い上部船殻と下部船倉を楕円断面の船体で測り、舷側の縁、背部の操縦甲板、展望塔、艦尾の機関区画を構造物で再現。原型 35.9 m を設計局の最小船体長 60 m に拡大。',
 build(){
  // Elliptic sections fitted every 0.5 m to the upper shell and lower hold:
  // [t, width, depth, centre offset]. The first three stations run inside the
  // stern engine block, which is a structure.
  const s=newShip({L:60,W:20,H:16.118,sec:'ellipse',plan:'rect',bowFree:true,stern:1,
   stations:[[0,0.56,0.471523,0.033565],[0.023333,0.76,0.564586,0.030463],[0.086667,0.77,0.576995,0.030463],[0.123333,0.931756,0.917153,0.036835],[0.156667,0.936623,0.951241,0.021318],[0.165,0.937747,0.982476,0.006934],[0.665,0.939678,0.985324,0.005452],[0.723333,0.93576,0.968273,0.0142],[0.798333,0.891994,0.889861,0.037683],[0.856667,0.79123,0.76005,0.052868],[0.915,0.644175,0.513243,0.081705],[0.931667,0.629654,0.34559,0.09124],[0.94,0.565089,0.276085,0.121165],[0.956667,0.470837,0.239326,0.10899],[0.981667,0.312419,0.128081,0.071071],[0.996667,0.15067,0.047275,0.033771],[1,0.06592,0.020482,0.029334]]},'共和国輸送艦');
  s._building=true;s.paint='republic';s.detail=1;s.keel='light';s.armor={hull:.12,cit:0};
  const k=shipKit(s),part=(kind,label,c,d,opt={})=>placePart(s,kind,c,d,{label,...opt}),room=(kind,label,c,size,opt={})=>part(kind,label,c,30,{room:size,...opt});
  // Rim of the upper shell: the widest line of the ship, following the plan of
  // the rounded nose. Its first row reaches 10.2 m so the 2 m minimum height of
  // a structure maps every row exactly.
  k.loftX('上部船殻の舷側リム',[[4.35,-10.2,10.2,8.2,10.2],[44,-10.25,10.25,8.2,9.6],[46,-10.18,10.18,8.2,9.62],[48,-9.94,9.94,8.2,9.65],[50,-9.53,9.53,8.2,9.65],[52,-8.91,8.91,8.2,9.6],[54,-8.03,8.03,8.2,9.55],[55,-7.47,7.47,8.2,9.5],[56,-6.8,6.8,8.22,9.4],[57,-5.99,5.99,8.22,9.3],[58,-4.97,4.97,8.22,9.15],[59,-3.53,3.53,8.22,8.95],[59.5,-2.47,2.47,8.25,8.85],[60,-.8,.8,8.3,8.75]],{corner:.3,paint:'#e9e6df'});
  // Dorsal flight deck with its sloped, windowed front.
  const deck=k.loftX('背部操縦甲板',[[6.66,-3.54,3.54,15.2,17.78],[19,-3.54,3.54,15.2,17.78],[20.9,-3.1,3.1,15.2,17.78],[29.4,-3.1,3.1,15.2,17.78],[31.7,-2.4,2.4,15.2,15.6]],{corner:.08,skin:'service'});
  // Observation cupola over the aft end of the deck.
  k.loftX('展望塔の基部',[[7.75,-1.95,1.95,17.5,17.8],[7.8,-1.95,1.95,17.5,20],[12.4,-1.95,1.95,17.5,20],[12.8,-1.95,1.95,17.5,17.8]],{corner:.1});
  k.loftX('展望塔の頂部',[[8,-2.84,2.84,19.6,20.1],[8.3,-2.84,2.84,19.6,20.75],[8.8,-2.84,2.84,19.6,21.2],[9.5,-2.84,2.84,19.6,21.5],[10.4,-2.84,2.84,19.6,21.6],[11.3,-2.84,2.84,19.6,21.5],[12,-2.84,2.84,19.6,21.2],[12.5,-2.84,2.84,19.6,20.75],[12.8,-2.84,2.84,19.6,20.1]],{corner:.1,paint:'#d8d6d0'});
  // Stern engine block and the stepped housings above and below it.
  k.box('艦尾機関ブロック',[.9,3.66,-8.08],[8.7,13.41,8.08],{corner:.14,skin:'service'});
  k.box('艦尾上部の段',[1.67,12.8,-5.3],[6.9,14.8,5.3],{corner:.1});
  k.box('艦尾上部の機器筐体',[4.97,14.29,-2.14],[7.4,16.67,2.14],{corner:.1});
  k.box('艦尾下部の乗降ランプ',[2,.9,-4.5],[10,3.7,4.5],{corner:.12,skin:'service'});
  k.box('艦尾下部の機器筐体',[4.8,2.38,-5.74],[9.9,4.8,5.74],{corner:.1});
  // Equipment diameters stay at the yard's 4 m minimum so saved copies load unchanged.
  // Power and drive: two internal turbines in the stern block feed from one
  // reactor amidships; the lower hold carries the troop bay and cargo.
  const r=part('gen','主反応炉',[23,10.5,0],9.4);
  {const o=equipmentOptions('internalTurbine'),d=7,e=placePart(s,'engine',[.35+d*.25,8.55,3.6],d,{...o,label:'艦尾主推進機関',d,reactor:r.id,dir:[-1,0,0]},true);
   for(const q of s.parts.filter(q=>q.id===e.id||q.id===e.tw)){resizeEngine(q,d);q.c[0]=.35+q.nozzleLength/2;}}
  part('shield','偏向シールド発生器',[31,9.6,0],4.8);
  part('hyper','ハイパードライブ（クラス1）',[37.4,9.2,0],4,{length:4,dir:[1,0,0]});
  part('fuel','反応物サイロ',[13,3.3,0],4,{dir:[0,1,0],length:3});
  room('pump','反応物供給設備',[8.8,3.1,0],[3,3,3]);
  part('inertial','慣性補償装置',[45,9.4,0],4,{length:6.4,dir:[1,0,0]});
  room('integrity','構造維持装置',[51.4,9.4,0],[4.6,4,3.2]);
  room('command','操縦室（背部操縦甲板）',[25,15.7,0],[8,5.4,4]);
  room('troops','下部兵員室',[28,3.6,0],[18,9.2,4]);
  room('cargo','下部貨物倉',[42.5,4.2,0],[9,8,4]);
  room('crew','上部乗員区画',[47,12.2,0],[6,8,3.4]);
  delete s._building;
  // One dorsal laser turret ahead of the deck, scaled to the source's turret.
  {const h=rayEnv(s,[41.1,60,0],[0,-1,0],{structOnly:true});const f={id:s.nextId++,k:'pd',p:h.p,a:2,ped:0,base:0,low:0,float:false,scale:.35};mountFit(s,f);s.fits.push(f);}
  adoptEquipment(s,true);remount(s);return s;
 }
});


// Fleet exercises use metres and seconds; tactical acceleration/turn/range are
// explicit game rules. A turn is solved from shared snapshots, never unit order.
const FLEET_RULES={step:.25,seconds:20,maxShips:12,range:40000,initialDistance:60000,engagementDistance:14000,formationGap:6000,accelScale:.002,maxSpeed:2400,maxAltitude:15000,maxCoordinate:2000000};
// ---------- gun ranges, power and armour rules (v14) ----------
// Every gun belongs to a range band. Heavy turbolasers and ion cannons reach
// furthest; light turrets have a middle reach; broadside batteries (the
// casemates and side guns in the trenches) hit hardest for their power but
// only close in, so ships with strong broadsides close and turn their beam to
// the enemy. Hit chance falls with distance over each band's own reach.
const GUN_BANDS={long:{name:'長射程',range:40000},mid:{name:'中射程',range:22000},close:{name:'舷側・近距離',range:9000}};
function fitBand(d){if(!d)return 'mid';if(d.band)return d.band;if(d.casemate||d.key==='refSide')return 'close';if(d.ion)return 'long';const tt=d.tt||0,bolt=d.boltTT??(d.barrels?tt/d.barrels:tt);if(tt>=100||bolt>=30)return 'long';if(bolt>=.1)return 'mid';return 'close';}
// Hit chance falls with distance the same for every gun; the band only sets
// how far a gun reaches and what its fire costs in stored energy per TT:
// broadside batteries give the most fire for the power, so a ship whose
// reactor cannot feed every gun does best close in with its beam turned.
const bandFall=d=>clamp(1-.72*d/GUN_BANDS.long.range,.2,1);
// Gun and ion fire (TT/s at full rate, before power and accuracy) u brings to
// bear on t at distance d, the energy that fire costs (TT/s) and the hit factor.
function fleetFire(u,t,d){
 const p=u.p,B=p.gunBands;let gun=0,ion=0,cost=0;
 if(B){for(const k in GUN_BANDS){if(d>GUN_BANDS[k].range||!B[k])continue;const g=fleetArc(u,t,B[k]);gun+=g;cost+=g*COMBAT.bandCost[k];}}
 else if(d<=GUN_BANDS.long.range){gun=fleetArc(u,t,p.gunArcs);cost=gun;}
 if(d<=GUN_BANDS.long.range){ion=fleetArc(u,t,p.ionArcs);cost+=ion;}
 return {gun,ion,cost,fall:bandFall(d)};
}
// The longest reach among the bands a ship actually carries.
function fleetReach(p){const B=p.gunBands;if(!B)return GUN_BANDS.long.range;let r=0;for(const k in GUN_BANDS)if(B[k]&&B[k].some(v=>v>0))r=Math.max(r,GUN_BANDS[k].range);if((p.ionArcs||[]).some(v=>v>0))r=Math.max(r,GUN_BANDS.long.range);return r||GUN_BANDS.mid.range;}
// Best-arc fire a profile lands at a distance (TT/s), as far as its reactor can
// feed the guns in reach (for choosing where to fight).
function bandFireAt(p,d){
 const B=p.gunBands,best=a=>a?Math.max(...a):0;let gun=0,cost=0;
 if(B){for(const k in GUN_BANDS)if(d<=GUN_BANDS[k].range){const g=best(B[k]);gun+=g;cost+=g*COMBAT.bandCost[k];}}else if(d<=GUN_BANDS.long.range){gun=best(p.gunArcs);cost=gun;}
 if(d<=GUN_BANDS.long.range){const i=best(p.ionArcs);gun+=i;cost+=i;}
 const budget=p.grid?.P>0?p.grid.P*.9/TT:Infinity,fed=cost>0?Math.min(1,budget/cost):0;return gun*fed*bandFall(d);
}
// Where u wants to fight t: the distance that best weighs its own fire against
// the target's, never closer than the two hulls allow.
const STANDOFFS=[6500,8500,12000,16000,21000,27000,34000,39000],standoffCache=new WeakMap();
function fleetStandoff(u,t){
 const floor=(u.p.len+(t?.p.len||0))*.7;if(!t)return Math.max(floor,14000);
 // Depends only on the two designs: worked out once per pair.
 let m=standoffCache.get(u.p);if(!m)standoffCache.set(u.p,m=new WeakMap());const hit=m.get(t.p);if(hit!=null)return hit;
 let best=null,bs=-Infinity;for(const d of STANDOFFS){if(d<floor)continue;const mine=bandFireAt(u.p,d),theirs=bandFireAt(t.p,d),sc=mine-.8*theirs+d*1e-9;if(sc>bs){bs=sc;best=d;}}
 const r=best??Math.max(floor,14000);m.set(t.p,r);return r;
}
// A ship that lands more fire with its beam than with its bow at its fighting
// distance (as far as its reactor can feed the guns that bear) turns its side
// to the enemy there: +1 starboard, -1 port, 0 bow-on.
function arcFireAt(p,k,d){const B=p.gunBands;let gun=0,cost=0;if(B){for(const b in GUN_BANDS)if(d<=GUN_BANDS[b].range){const g=B[b][k]||0;gun+=g;cost+=g*COMBAT.bandCost[b];}}else if(d<=GUN_BANDS.long.range){gun=p.gunArcs?.[k]||0;cost=gun;}if(d<=GUN_BANDS.long.range){const i=p.ionArcs?.[k]||0;gun+=i;cost+=i;}const budget=p.grid?.P>0?p.grid.P*.9/TT:Infinity;return cost>0?gun*Math.min(1,budget/cost):0;}
const broadsideCache=new WeakMap();
function fleetBroadside(p,d=GUN_BANDS.close.range*.75){if(!p.gunBands)return 0;let m=broadsideCache.get(p);if(!m)broadsideCache.set(p,m=new Map());const k=Math.round(d/250);if(m.has(k))return m.get(k);const fore=arcFireAt(p,0,d),st=arcFireAt(p,2,d),po=arcFireAt(p,3,d),side=Math.max(st,po),r=side>fore*1.1&&side>0?(st>=po?1:-1):0;m.set(k,r);return r;}
// The heading for u fighting t at distance d with standoff sd: bow-on while
// closing, then the beam toward the target, angled in or out to hold distance.
function fleetHeading(u,t,d,sd){
 const side=fleetBroadside(u.p,sd);if(!side||d>sd*1.6)return null;
 const bearing=Math.atan2(t.pos[2]-u.pos[2],t.pos[0]-u.pos[0]),err=clamp((d-sd)/sd,-1,1);
 // The beam faces the target when the bow points 90° off the bearing; steer up to 50° in or out of that.
 return bearing-side*(Math.PI/2-err*.87);
}
// Power each step. Weapons, shields and engines share the reactor: engines at
// full thrust take most of it, so a ship manoeuvring hard can hardly fire, and
// shields recharge only on the power they are given. Ion damage chokes output.
function fleetPowerStep(u,s,t,raw,dt){
 const p=u.p,g=p.grid,o=u.order;
 const mode=o.power==='auto'||!POWER_MODES[o.power]?fleetAutoPower(u,t,raw>0):o.power,M=POWER_MODES[mode];u.mode=mode;
 const cap=(p.wCap||0)*s.weapon,nominalShield=g?g.Ds*s.shield:0;
 if(!g){u.load=.7;u.engF=1;u.shF=1;u.pw=null;return raw>0?1:0;}
 const P=g.P*s.reactor*(1-COMBAT.ionReactor*(u.ionK||0)),regen=u.shield<u.shieldMax*.999||u.underFire||(u.bank||0)<(u.bankMax||0)*.999,man=u.out?0:clamp(u.maneuver||0,0,1);
 const full=Math.min(P*COMBAT.engineCap,g.De*COMBAT.engineDraw)*s.engine;
 // A disabled ship's shield generators fail with it: its shields fade.
 const want={engines:u.out?0:full*(.06+.94*man),shields:u.out?0:nominalShield*(regen?M.shields:1),weapons:u.out?0:Math.min(g.Dw*s.weapon*M.weapons,TT*(raw+Math.max(0,cap-u.energy)/dt))};
 const got=powerSplit(P,g.fixed,want,mode);u.load=P>0?got.load:0;u.engF=want.engines>0?got.engines/want.engines:1;u.shF=nominalShield>0?got.shields/nominalShield:0;
 u.pw={P,eng:got.engines,sh:got.shields,wpn:got.weapons,wantEng:want.engines,wantSh:want.shields,wantWpn:want.weapons};
 const avail=u.energy+got.weapons*dt/TT,spend=Math.min(avail,raw*dt),fire=raw>0?spend/(raw*dt):0;u.energy=clamp(avail-spend,0,cap);return fire;
}
const COMBAT={
 tau:30,            // s: armour sheds its load (heat, stress) with this time constant
 capK:200,          // load (TT) a metre of armour holds, times the cube root of the zone's share of structure
 spall:.02,         // share of the load armour holds that still shakes the frames behind it
 hole:.35,          // plating lost per capacity's worth of load that breaks through
 minInt:.08,        // what is left of shot-through plating
 quantum:.015,      // one penetrating hit, as a share of the ship's structure
 frame:.45,         // share of a penetrating hit taken by the section's frames
 through:.6,        // energy a shot keeps after passing through a module
 maxPath:3,         // modules one penetrating hit can pass through
 engineDraw:4.5,    // engines at full thrust draw this many times their rated demand…
 engineCap:.92,     // …up to this share of reactor output
 ionShield:3, ionHull:.1, ionDrain:4, ionBank:3, ionReactor:.6, ionTau:20,
 bankRate:1,        // power cells feed the field at up to this many times the generator's rating
 fireGrow:.03, fireDC:.04, fireDmg:.5, fireCrew:.001, fireFrame:.08, fireSpread:.04,
 bandCost:{long:1,mid:.8,close:.55}   // stored energy per TT fired, by range band
};
const IGNITE={reactor:.22,fuel:.38,battery:.18,launcher:.3,hangar:.28,quarters:.14,weapon:.07,engine:.18,capacitor:.18,shield:.12,bridge:.12,hyper:.15,fire:.09,other:.1};
const FLAMMABLE={fuel:1,launcher:.9,hangar:.7,battery:.5,reactor:.4,capacitor:.3};

// ---------- combat power ----------
// Reactor output feeds the hotel load and ray shields first, then shields,
// engines and weapon charging in the order the distribution mode sets. A mode
// also sets how hard the reactor may be driven; the share of rated output it
// ends up carrying (core load) sets how likely a reactor hit is to set the
// core off, so driving weapons and shields harder makes the reactor a better
// target instead of making it the only target worth shooting.
const POWER_MODES={
 cruise:{name:'巡航',max:.8,order:['engines','shields','weapons'],weapons:1,shields:1,note:'炉を80%に抑えて推進を優先。被弾時の誘爆率が最も低い。'},
 balanced:{name:'均衡',max:1,order:['shields','engines','weapons'],weapons:1,shields:1,note:'シールド維持→推進→兵装充電の順。停止すると兵装に多く回る。'},
 weapons:{name:'兵装優先',max:1.2,order:['weapons','shields','engines'],weapons:1.25,shields:1,note:'炉を120%まで上げて兵装充電を最優先。推進が落ちる。'},
 shields:{name:'防御優先',max:1.2,order:['shields','engines','weapons'],weapons:1,shields:1.5,note:'炉を120%まで上げてシールド再生を最大1.5倍に。回避の推進を兵装より先に給電。'},
 overload:{name:'全力',max:1.4,order:['shields','engines','weapons'],weapons:1.25,shields:1.5,note:'炉を140%まで上げて推進・シールド・兵装のすべてに給電。被弾時の誘爆率が高い。'}};
function powerSplit(P,fixed,want,mode){
 const m=POWER_MODES[mode]||POWER_MODES.balanced,top=Math.max(0,P*m.max);let left=Math.max(0,top-fixed);const got={engines:0,shields:0,weapons:0};
 for(const k of m.order){const g=Math.min(left,Math.max(0,want[k]||0));got[k]=g;left-=g;}
 const draw=Math.min(top,fixed)+got.engines+got.shields+got.weapons;return {...got,draw,load:P>0?draw/P:0,short:fixed>top};
}
// 'auto' runs balanced, turns to the shields when they run low and drives the
// weapons to finish a target whose shields are down.
const POWER_AUTO_NOTE='シールドが35%を切ると防御優先、射程内で機動が小さいとき（停止・定位置）と目標のシールドが落ちたときは兵装優先、それ以外は均衡で戦います。装甲を抜かれている間は炉を100%に抑えて炉心誘爆を避けます。全力機動中は推進が出力の大半を使います。';
function fleetAutoPower(u,t,inRange){const sh=u.shieldMax>0?u.shield/u.shieldMax:1,theirs=t&&t.shieldMax>0?t.shield/t.shieldMax:1;if((u.penHot||0)>0)return 'balanced';if(sh<.35)return 'shields';const man=u.maneuver||0;if(inRange&&man<.35&&sh>.55)return 'weapons';return t&&inRange&&theirs<.25&&sh>.5&&man<.7?'weapons':'balanced';}
// Chance that one penetrating hit on a reactor sets its core off.
function coreDetonation(load){return clamp(.02+.25*Math.max(0,load-.55)**2+1.2*Math.max(0,load-1)**2,0,.6);}

// ---------- combat damage ----------
// Penetrating hits strike modules: every compartment and fitting the design
// carries. Weight is the area a module presents (exposed ones count more,
// critical ones less behind a citadel); hits is how many penetrating hits wreck
// it. The hull itself takes a share of hits that only damage structure.
const MODULE_LABEL={hull:'船体構造',reactor:'反応炉',shield:'シールド発生器',engine:'推進機関',hyper:'ハイパードライブ',hangar:'格納庫',battery:'パワーセル',fuel:'反応物サイロ',quarters:'居住区',bridge:'艦橋・指揮所',fire:'射撃管制',capacitor:'主砲充電装置',weapon:'砲塔',launcher:'ミサイル発射管',other:'その他区画'};
const MODULE_PART_KIND={gen:'reactor',aux:'reactor',shield:'shield',localShield:'shield',engine:'engine',machinery:'engine',hyper:'hyper',hangar:'hangar',service:'hangar',battery:'battery',fuel:'fuel',crew:'quarters',troops:'quarters',command:'bridge',firecontrol:'fire',capacitor:'capacitor'};
const CRIT_MODULES=new Set(['reactor','shield','hyper','fuel','battery']);
const AIM_KINDS={auto:'艦全体',reactor:'反応炉',bridge:'艦橋',weapon:'砲塔',engine:'推進機関',shield:'シールド発生器'};
const MAGAZINE_MISSILES=120,FLEET_MIN_CREW=.35;
function fleetModules(ship,S){
 const mods=[],protect=1-.4*(S.protectedFrac||0),byFit=new Map(),[X0,X1]=shipSpan(ship),L=Math.max(1,X1-X0),yb=S.ybox||[0,S.dims?.[2]||ship.hull.H||100],yc=(yb[0]+yb[1])/2,hh=Math.max(1,(yb[1]-yb[0])/2),hw=Math.max(1,(S.dims?.[1]||ship.hull.W||100)/2);
 // Where a module sits across the hull (-1…1 up and to starboard) and its size, for penetration paths and the hit replay.
 const place=(m,q,r)=>{if(q){m.y=+clamp((q[1]-yc)/hh,-1,1).toFixed(2);m.z=+clamp(q[2]/hw,-1,1).toFixed(2);}m.r=+clamp(r/L,.002,.2).toFixed(3);return m;};
 for(const f of ship.fits){const d=FITS[f.k];if(!d||f.float)continue;let k=null;
  if(d.cat==='w')k=d.msl?'launcher':'weapon';else if(d.cat==='b'&&(!d.role||d.role==='bridge'||d.role==='combat')&&(S.commandInfo?.[f.id]?.ratio??1)>0)k='bridge';if(!k)continue;
  const s=fitSpec(f);byFit.set(f.id,mods.length);
  mods.push(place({k,fit:f.id,name:d.short||d.name,w:s.fm*s.wm*1.2,hits:clamp(Math.round(Math.max(s.fm,s.wm)/24),1,4),crew:s.crew||0,size:k==='weapon'?(s.tt||0)+(s.ion||0)+(s.aa||0)*.5:1,stock:k==='launcher'?MAGAZINE_MISSILES:0,at:+clamp((f.p[0]-X0)/L,0,1).toFixed(3),pd:k==='weapon'&&(d.aa||0)>0&&!((d.tt||0)>.01)&&!d.ion,band:k==='weapon'?fitBand(d):undefined},f.p,Math.max(s.fm,s.wm)/2));}
 for(const f of intrinsicCommandFits(ship)){const d=FITS[f.k];if(!d||(d.role!=='bridge'&&d.role!=='combat')||(S.commandInfo?.[f.id]?.ratio??0)<=0)continue;mods.push(place({k:'bridge',name:d.short||d.name,w:(f.width||15)*(f.height||6)*1.2,hits:1,crew:d.crew||16,size:1,at:+clamp((f.p[0]-X0)/L,0,1).toFixed(3)},f.p,(f.width||15)/2));}
 for(const p of allOccupied(ship)){
  if(p.windowId!=null)continue;const V=partVolume(p);if(!(V>1))continue;const k=MODULE_PART_KIND[p.k]||'other';
  let w=Math.pow(V,2/3)*((p._packing?.retained??p._clip?.retained??1)<.97?1.5:1);if(CRIT_MODULES.has(k))w*=protect;
  const m={k,name:partLabel(p),w,hits:clamp(Math.round(Math.cbrt(V)/22),1,5),crew:V*(PARTS[p.k]?.crew||0)/1000,size:V,at:+clamp(((p.c?.[0]??X0+L/2)-X0)/L,0,1).toFixed(3)};
  if(k==='capacitor'&&byFit.has(p.weaponId))m.link=byFit.get(p.weaponId);mods.push(place(m,p.c,Math.cbrt(V)/2));}
 const total={};for(const m of mods)total[m.k]=(total[m.k]||0)+m.size;for(const m of mods)m.share=total[m.k]>0?m.size/total[m.k]:0;
 const rest=mods.reduce((n,m)=>n+m.w,0);mods.push({k:'hull',name:MODULE_LABEL.hull,w:Math.max(1,rest*.6),hits:Infinity,crew:0,size:1,share:1});
 return mods;
}
function fleetProfile(S,name,ship){
 const p=profile(S,name),accel=Math.max(0,S.accelG||0)*G0*FLEET_RULES.accelScale,dr=S.draw||{};
 const out={...p,embarkedSlots:Math.floor(S.slots||0),aviationSize:S.aviation?.usedSize||0,launch:S.launchPotential??p.launch,slidingHatches:S.slidingHatches||0,hatchOpenSeconds:S.slidingHatches?S.hatchOpenSeconds||4:0,hatchCloseSeconds:S.slidingHatches?S.hatchCloseSeconds||4:0,gunArcs:[...S.alphaRate],ionArcs:[...S.ionRate],aaArcs:[...(S.aaArc||[0,0,0,0,0,0])],accel,maxSpeed:accel>0?Math.min(FLEET_RULES.maxSpeed,Math.sqrt(accel*Math.max(200,p.len)*24)):0,turnRate:accel>0?clamp(.11*Math.sqrt(Math.max(1,S.accelG)/3000)*Math.sqrt(1600/Math.max(100,p.len)),.015,.24):0,width:S.dims[1],height:S.dims[2],power:S.xISD};
 // Power figures in watts; weapon energy in TT (one TT fired costs one TT stored).
 out.grid={P:S.power||0,fixed:(dr.hotel||0)+(dr.ray||0),De:dr.engines||0,Ds:dr.shields||0,Dw:dr.weapons||0};
 out.armorHull=S.armorAvg??S.armorHull??0;out.armorPlate=S.armorPlate||0;out.plateShare=S.plateShare||0;out.crewNeed=S.crew||0;
 out.wCap=ship?ship.fits.filter(f=>FITS[f.k]?.cat==='w'&&!f.float).reduce((n,f)=>{const s=fitSpec(f);return n+(needsCapacitor(f)?S.chargeInfo?.[f.id]?.storedTT||0:(s.tt||0)+(s.ion||0));},0):(S.alphaTot||0)+(S.ionTot||0);
 if(S.bandRate)out.gunBands={long:[...S.bandRate.long],mid:[...S.bandRate.mid],close:[...S.bandRate.close]};
 if(ship){out.modules=fleetModules(ship,S);const hs=hullSectionShares(ship);out.sections=hs.shares;out.sectionCuts=hs.cuts;
  // Armour zones: the exposed skin of each section and face with its thickness
  // (hull armour plus any plating over it).
  if(S.skin){const cuts=hs.cuts,sk=S.skin,n=HULL_SECTIONS*6,zA=new Array(n).fill(0),zT=new Array(n).fill(0);for(let i=0;i<sk.n;i++){const x=(i+.5)/sk.n;let si=0;while(si<cuts.length&&x>=cuts[si])si++;for(let f=0;f<6;f++){zA[si*6+f]+=sk.a[i*6+f];zT[si*6+f]+=sk.t[i*6+f];}}out.zA=zA.map(a=>Math.round(a));out.zT=zT.map((t,z)=>+((S.armorHull||0)+(zA[z]>0?t/zA[z]:0)).toFixed(2));}
  try{out.outline=shipOutline(ship,S);}catch(e){out.outline=null;}}
 return out;
}
// Top and side silhouettes of the ship (hull and structures) as small bit
// masks, for the X-ray of the hit replay.
const B64C='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function packBits(a){let s='';for(let i=0;i<a.length;i+=6){let v=0;for(let j=0;j<6;j++)if(a[i+j])v|=1<<j;s+=B64C[v];}return s;}
function unpackBits(s,n){const a=new Uint8Array(n);for(let i=0;i<s.length;i++){const v=B64C.indexOf(s[i]);for(let j=0;j<6;j++)if(v&(1<<j)&&i*6+j<n)a[i*6+j]=1;}return a;}
function shipOutline(ship,S){
 const [X0,X1]=shipSpan(ship),L=Math.max(1,X1-X0),yb=S.ybox||[0,S.dims[2]],H=Math.max(1,yb[1]-yb[0]),hw=Math.max(1,S.dims[1]/2),nx=120;
 const nz=clamp(Math.round(nx*hw*2/L),8,72),ny=clamp(Math.round(nx*H/L),6,72),top=new Uint8Array(nx*nz),side=new Uint8Array(nx*ny);
 const fill=(m,w,h,ax,ay,bx,by,cx,cy)=>{
  const gx=Math.floor((ax+bx+cx)/3),gy=Math.floor((ay+by+cy)/3);if(gx>=0&&gx<w&&gy>=0&&gy<h)m[gy*w+gx]=1;
  const d=(bx-ax)*(cy-ay)-(cx-ax)*(by-ay);if(Math.abs(d)<1e-9)return;
  const x0=Math.max(0,Math.floor(Math.min(ax,bx,cx))),x1=Math.min(w-1,Math.ceil(Math.max(ax,bx,cx))),y0=Math.max(0,Math.floor(Math.min(ay,by,cy))),y1=Math.min(h-1,Math.ceil(Math.max(ay,by,cy)));
  for(let j=y0;j<=y1;j++)for(let i=x0;i<=x1;i++){const px=i+.5,py=j+.5,u=((bx-px)*(cy-py)-(cx-px)*(by-py))/d,v=((cx-px)*(ay-py)-(ax-px)*(cy-py))/d;if(u>=-.02&&v>=-.02&&u+v<=1.04)m[j*w+i]=1;}};
 const put=T=>{for(let k=0;k<T.length;k+=9){const X=q=>(T[k+q]-X0)/L*nx,Z=q=>(T[k+q+2]+hw)/(2*hw)*nz,Y=q=>(T[k+q+1]-yb[0])/H*ny;fill(top,nx,nz,X(0),Z(0),X(3),Z(3),X(6),Z(6));fill(side,nx,ny,X(0),Y(0),X(3),Y(3),X(6),Y(6));}};
 if(!ship.hull.assembly)put(hullGeo(ship).tris);for(const p of ship.parts)if(p.k==='struct')put(structTriangles(p));
 return {nx,nz,ny,top:packBits(top),side:packBits(side)};
}
// The hull is fought as five sections from stern to bow, each holding a fifth
// of the ship's volume: the hull's own cross section plus structures and
// compartments. The cuts between them (shares of the length) follow the volume,
// so a wedge's long, thin bow is one section and its broad stern another.
const HULL_SECTIONS=5,SECTION_NAMES=['艦尾区画','後部区画','中央区画','前部区画','艦首区画'];
// The ship's extent along its length: the hull's own, or for a core hull (a
// small hull inside a larger assembly of structures, like a Lucrehulk's core
// sphere) the whole ship's, structures included.
function shipSpan(ship){const L=Math.max(1,ship.hull.L);if(!ship.hull.core)return [0,L];let x0=0,x1=L;for(const p of ship.parts){let b;try{b=partAABB(p);}catch(e){continue;}if(!b||!Number.isFinite(b[0])||!Number.isFinite(b[3]))continue;if(b[0]<x0)x0=b[0];if(b[3]>x1)x1=b[3];}return [x0,Math.max(x0+1,x1)];}
function hullSectionShares(ship){
 const [x0,x1]=shipSpan(ship),L=x1-x0,HL=Math.max(1,ship.hull.L),B=80,v=new Array(B).fill(0),put=(x,vol)=>{if(!(vol>0))return;v[clamp(Math.floor((x-x0)/L*B),0,B-1)]+=vol;};
 if(!ship.hull.assembly)for(let i=0;i<B;i++){const x=x0+(i+.5)/B*L;if(x<0||x>HL)continue;const b=sectionBase(ship.hull,x);put(x,Math.max(0,b.hw*2*b.h*.8)*L/B);}
 for(const p of ship.parts){if(p.windowId!=null)continue;let vol=0;try{vol=partVolume(p);}catch(e){vol=0;}put(p.c?.[0]??L/2,vol*(p.k==='struct'?1:.6));}
 const tot=v.reduce((a,b)=>a+b,0),cuts=[];if(!(tot>0))return {shares:new Array(HULL_SECTIONS).fill(1/HULL_SECTIONS),cuts:[.2,.4,.6,.8]};
 let acc=0,want=1;for(let i=0;i<B&&cuts.length<HULL_SECTIONS-1;i++){const before=acc;acc+=v[i]/tot;while(cuts.length<HULL_SECTIONS-1&&acc>=want/HULL_SECTIONS){const f=v[i]>0?(want/HULL_SECTIONS-before)/(v[i]/tot):1;cuts.push(+((i+clamp(f,0,1))/B).toFixed(4));want++;}}
 for(let i=1;i<cuts.length;i++)if(cuts[i]<=cuts[i-1]+.02)cuts[i]=Math.min(.99,cuts[i-1]+.02);
 return {shares:new Array(HULL_SECTIONS).fill(1/HULL_SECTIONS),cuts};
}

function fleetUnit(id,key,p,team=0){
 const shield=Math.max(0,p.shieldBuffer??p.D*K.bufferS),bank=Math.max(0,p.reserve||0),mods=p.modules||[];
 return combatInit({id,key,name:p.name,team,p,pos:[0,0,0],yaw:0,velocity:[0,0,0],hp:p.hp,shield,shieldMax:shield,bank,bankMax:bank,armor:1,energy:p.wCap||0,load:0,engF:1,crew:p.crewNeed||0,mods:mods.map(()=>1),ammo:mods.map(m=>m.stock||0),hitAcc:0,out:null,fate:null,air:0,launched:0,lost:0,hatchOpen:0,hatchTarget:0,queue:[],order:{type:'hold',fire:true,launch:false,power:'auto',aim:'auto'},dead:false});
}
function fleetFormation(units,form='line',gap=600){
 if(!units.length)return units;gap=clamp(Number(gap)||0,0,10000);
 const L=Math.max(...units.map(u=>u.p.len)),W=Math.max(...units.map(u=>u.p.width||u.p.len*.5));
 units.forEach((u,i)=>{let x=0,z=0;if(form==='column')x=-i*(L+gap);else if(form==='wedge'){const row=Math.ceil(i/2);x=-row*(L+gap);z=(i%2?1:-1)*row*(W+gap);}else if(form==='grid'){x=-Math.floor(i/3)*(L+gap);z=(i%3-1)*(W+gap);}else z=i*(W+gap);u.pos=[x,0,z];u.yaw=0;u.velocity=[0,0,0];});
 const x=units.reduce((s,u)=>s+u.pos[0],0)/units.length,z=units.reduce((s,u)=>s+u.pos[2],0)/units.length;for(const u of units){u.pos[0]-=x;u.pos[2]-=z;}return units;
}
function fleetBattle(units,combat=true){return {units,combat,turn:1,time:0,phase:'plan',seconds:FLEET_RULES.seconds,winner:null,events:[],last:null,seed:0x9e3779b9};}
function fleetOrder(b,id,order){
 const u=b.units.find(u=>u.id===id);if(b.phase!=='plan'||!u||u.dead||u.out||u.team!==0||!['hold','move','attack'].includes(order.type))return false;
 const q={...u.order,...order};if(q.type==='move'){if(!Array.isArray(q.point)||q.point.length!==3||!q.point.every(Number.isFinite))return false;q.point=q.point.map((v,i)=>clamp(v,-(i===1?FLEET_RULES.maxAltitude:FLEET_RULES.maxCoordinate),i===1?FLEET_RULES.maxAltitude:FLEET_RULES.maxCoordinate));}
 if(q.power!=='auto'&&!Object.hasOwn(POWER_MODES,q.power))q.power='auto';if(!Object.hasOwn(AIM_KINDS,q.aim))q.aim='auto';
 if(q.type==='attack'&&!b.units.some(t=>t.id===q.target&&t.team!==u.team&&!t.dead))return false;u.order=q;return true;
}
const fleetAngle=a=>Math.atan2(Math.sin(a),Math.cos(a));
function fleetArc(u,target,rates){const dx=target.pos[0]-u.pos[0],dy=target.pos[1]-u.pos[1],dz=target.pos[2]-u.pos[2],c=Math.cos(u.yaw),s=Math.sin(u.yaw),v=[dx*c+dz*s,dy,-dx*s+dz*c],weights=[Math.max(0,v[0]),Math.max(0,-v[0]),Math.max(0,v[2]),Math.max(0,-v[2]),Math.max(0,v[1]),Math.max(0,-v[1])],sum=weights.reduce((a,b)=>a+b,0);return sum?weights.reduce((a,w,i)=>a+w*(rates[i]||0),0)/sum:0;}
// Remaining capability by module kind: the intact share of each kind (1 where a
// design has none of that kind, so a missing system never limits anything).
// The module list of a design indexed once by kind (a battle asks every tick).
const FLEET_SYS_KINDS=['reactor','shield','engine','weapon','launcher','hangar','battery','fire'],fleetSysIndex=new WeakMap();
function fleetSysIdx(mods){let x=fleetSysIndex.get(mods);if(x)return x;x={kinds:FLEET_SYS_KINDS.map(k=>{const idx=[],sh=[];mods.forEach((m,i)=>{if(m.k===k){idx.push(i);sh.push(m.share);}});return {k,idx:Int32Array.from(idx),sh:Float64Array.from(sh)};}),bridge:Int32Array.from(mods.flatMap((m,i)=>m.k==='bridge'?[i]:[]))};fleetSysIndex.set(mods,x);return x;}
function fleetSystems(u){
 const mods=u.p.modules||[],um=u.mods||[],X=fleetSysIdx(mods),out={};
 for(const {k,idx,sh} of X.kinds){if(!idx.length){out[k]=1;continue;}let s=0;for(let j=0;j<idx.length;j++){const v=um[idx[j]];if(v>0)s+=sh[j]*v;}out[k]=clamp(s,0,1);}
 let br=!X.bridge.length;for(let j=0;j<X.bridge.length&&!br;j++)if(um[X.bridge[j]]>0)br=true;
 out.bridge=br;out.hasReactor=X.kinds[0].idx.length>0;out.hasBridge=X.bridge.length>0;return out;
}
const fleetCrewEff=u=>{const need=u.p.crewNeed||0;return need>0?clamp((u.crew/need-FLEET_MIN_CREW)/(1-FLEET_MIN_CREW)*.6+.4,.4,1):1;};
const fleetEffective=u=>!u.dead&&!u.out;
function fleetFrame(b,shots=[]){return {time:b.time,units:b.units.map(u=>({id:u.id,pos:[...u.pos],yaw:u.yaw,hp:u.hp,shield:u.shield,shieldMax:u.shieldMax,bank:u.bank||0,bankMax:u.bankMax||0,armor:u.armor,energy:u.energy,load:u.load,mode:u.mode,crew:u.crew,air:u.air,launched:u.launched,hatchOpen:u.hatchOpen||0,hatchTarget:u.hatchTarget||0,dead:u.dead,out:u.out,fate:u.fate,mods:u.mods?u.mods.slice():[],ammo:u.ammo?u.ammo.slice():[],fire:u.fire?u.fire.slice():[],sec:u.sec?u.sec.map(x=>x.s/x.max):[],velocity:[...u.velocity]})),shots};}
function fleetRandom(b){let t=(b.seed=(b.seed+0x6D2B79F5)|0);t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;}
// ---------- combat damage (v14) ----------
// A ship has no hit-point pool. Fire that gets past the shields loads the
// armour of the zone it lands on (one of the six faces of one of the five hull
// sections); armour sheds load over time, and load beyond what the plating can
// hold breaks through and is lost from the plating as well. What breaks through
// travels into the section as penetrating hits: each one strikes the frames and
// up to three modules behind the face, nearest first, and may start a fire.
// A section whose frames are gone collapses; two collapsed sections, or one
// amidships, break the ship. Without power, a bridge or enough crew it is out
// of the fight.
function aimShare(u,si,aim){const mods=u.p.modules||[];let a=0,t=0;for(let i=0;i<mods.length;i++){const m=mods[i];if(m.k!==aim)continue;t+=m.w;if(u.secOf[i]===si&&u.mods[i]>0)a+=m.w;}return t>0?a/t:0;}
// Zone areas, thicknesses and capacities of a profile (cached per profile).
const combatZoneCache=new WeakMap();
function combatZones(p,N=HULL_SECTIONS){
 let Z=combatZoneCache.get(p);if(Z&&Z.N===N)return Z;
 const n=N*6,A=new Array(n).fill(0),T=new Array(n).fill(p.armorHull||0);
 if(Array.isArray(p.zA)&&p.zA.length===n){for(let z=0;z<n;z++){A[z]=Math.max(0,p.zA[z]||0);T[z]=Math.max(0,p.zT?.[z]??p.armorHull??0);}}
 else{const L=Math.max(1,p.len||100),W=Math.max(1,p.width||L*.35),H=Math.max(1,p.height||L*.2),face=[W*H,W*H,L*H,L*H,L*W,L*W];for(let si=0;si<N;si++)for(let f=0;f<6;f++)A[si*6+f]=f<2?(si===(f===0?N-1:0)?face[f]:face[f]*.15):face[f]/N;}
 // What a zone's plating holds grows with its thickness and, more slowly, with
 // the bulk of the ship behind it (the cube root of its share of structure),
 // so heavy guns can break any armour given time while light guns cannot.
 const faceA=[0,0,0,0,0,0];for(let z=0;z<n;z++)faceA[z%6]+=A[z];const tot=faceA.reduce((a,b)=>a+b,0)||1,hp=Math.max(1,p.hp||1);
 const cap=A.map((a,z)=>a>0?COMBAT.capK*Math.max(.05,T[z])*Math.cbrt(Math.max(1e-3,hp*a/tot)):0);
 Z={N,n,A,T,cap,faceA,faceShare:faceA.map(a=>a/tot),area:tot};combatZoneCache.set(p,Z);return Z;
}
function combatInit(u){
 const p=u.p,mods=p.modules||[],cuts=p.sectionCuts||[.2,.4,.6,.8],shares=p.sections?.length?p.sections:new Array(HULL_SECTIONS).fill(1/HULL_SECTIONS),tot=shares.reduce((a,b)=>a+b,0)||1;
 u.sec=shares.map(s=>({max:Math.max(1,p.hp*s/tot),s:Math.max(1,p.hp*s/tot)}));u.secLost=[];
 u.secOf=mods.map(m=>{const at=m.at??.5;let i=0;while(i<cuts.length&&at>=cuts[i])i++;return Math.min(i,u.sec.length-1);});
 const n=u.sec.length*6;u.zl=new Array(n).fill(0);u.zi=new Array(n).fill(1);u.zq=new Array(n).fill(0);u.fire=new Array(u.sec.length).fill(0);u.ionK=0;u.hitLog=[];u.hp=p.hp;u.armor=1;u.armorLoad=0;
 return u;
}
// The share of fire from a point that lands on each face of t: by the bearing
// in t's frame and how much area each face shows that way.
function combatFaces(t,from){
 const Z=combatZones(t.p,t.sec?.length||HULL_SECTIONS),d=[from[0]-t.pos[0],from[1]-t.pos[1],from[2]-t.pos[2]],c=Math.cos(t.yaw||0),s=Math.sin(t.yaw||0),v0=d[0]*c+d[2]*s,v2=-d[0]*s+d[2]*c,v1=d[1];
 const w=[Math.max(0,v0)*Z.faceA[0],Math.max(0,-v0)*Z.faceA[1],Math.max(0,v2)*Z.faceA[2],Math.max(0,-v2)*Z.faceA[3],Math.max(0,v1)*Z.faceA[4],Math.max(0,-v1)*Z.faceA[5]],sum=w[0]+w[1]+w[2]+w[3]+w[4]+w[5];
 return sum>0?w.map(x=>x/sum):Z.faceShare;
}
function combatIncoming(){return {sf:0,hull:0,direct:0,ion:0,aim:{},face:[0,0,0,0,0,0],by:{},zw:null};}
// Fire from one source: amounts in TT this step; from is the source's position.
function combatAdd(inc,t,from,amt,aim,src){
 inc.sf+=amt.sf||0;inc.hull+=amt.hull||0;inc.direct+=amt.direct||0;inc.ion+=amt.ion||0;
 const w=(amt.hull||0)+(amt.direct||0)+.1*(amt.sf||0);if(!(w>0))return;const k=aim||'auto';inc.aim[k]=(inc.aim[k]||0)+w;
 if(from){const fw=combatFaces(t,from);for(let f=0;f<6;f++)inc.face[f]+=fw[f]*w;}
 if(src!=null)inc.by[src]=(inc.by[src]||0)+w;
}
function combatZoneAt(p,lp,semi){
 const N=HULL_SECTIONS,cuts=p.sectionCuts||[.2,.4,.6,.8],at=clamp((lp[0]/Math.max(1e-6,semi[0])+1)/2,0,1);let si=0;while(si<cuts.length&&at>=cuts[si])si++;
 const n=[lp[0]/semi[0]**2,lp[1]/semi[1]**2,lp[2]/semi[2]**2],ax=Math.abs(n[0]),ay=Math.abs(n[1]),az=Math.abs(n[2]),f=ax>=ay&&ax>=az?(n[0]>0?0:1):az>=ay?(n[2]>0?2:3):(n[1]>0?4:5);
 return Math.min(si,N-1)*6+f;
}
const combatTop=o=>{let best=null,bv=0;for(const k in o.by)if(o.by[k]>bv){bv=o.by[k];best=k;}return best;};
// Depth of a module behind a face of its section, 0 at the plating, 1 at the far side.
function combatDepth(u,i,f,si){
 const m=u.p.modules[i],cuts=u.p.sectionCuts||[.2,.4,.6,.8],a=si>0?cuts[si-1]:0,b=si<cuts.length?cuts[si]:1,span=Math.max(1e-3,b-a),at=m.at??.5,y=m.y??0,z=m.z??0;
 return clamp(f===0?(b-at)/span:f===1?(at-a)/span:f===2?(1-z)/2:f===3?(1+z)/2:f===4?(1-y)/2:(1+y)/2,0,1);
}
const COMBAT_FACE=['艦首','艦尾','右舷','左舷','上面','下面'];
// Damage to one module (dmg in TT; hp is its hits × the penetration quantum).
// Reactors, reactant silos and magazines may go off; anything may catch fire.
function combatModuleDamage(ctx,u,i,dmg,Q,why){
 const p=u.p,m=p.modules[i],need=p.crewNeed||0;if(!m||m.k==='hull'||!(dmg>0))return {after:u.mods[i]??0};
 const hp=Math.max(1,m.hits*Q),before=u.mods[i];if(before<=0)return {after:0};
 const frac=dmg/hp,q=Math.min(1,dmg/Q);u.mods[i]=Math.max(0,before-frac);const lost=before-u.mods[i];
 u.crew-=m.crew*lost*.7;if(m.k==='quarters')u.crew-=need*.5*m.share*lost*.6;
 const si=u.secOf[i],ev=text=>ctx.ev(u,text);
 const blast=(k,text,fate)=>{const sec=u.sec[si];sec.s-=sec.max*k;for(const j of [si-1,si+1])if(u.sec[j])u.sec[j].s-=u.sec[j].max*k*.45;u.crew-=need*Math.min(.5,k*.3);ev(text);u.fateHint=fate;u.fire[si]=Math.max(u.fire[si]||0,.85);for(const j of [si-1,si,si+1])if(u.sec[j]&&u.sec[j].s<=0&&!u.secLost.includes(j))combatSectionLost(ctx,u,j);};
 let boom=null;
 if(m.k==='reactor'&&ctx.rand()<coreDetonation(u.load)*(1.2-u.mods[i])*q){u.mods[i]=0;blast(.35+.6*m.share*(.6+u.load),`${m.name} 炉心誘爆（炉心負荷 ${Math.round(u.load*100)}%）`,'reactor');boom='reactor';}
 else if(m.k==='fuel'&&ctx.rand()<(.08+.08*u.load)*(1.2-u.mods[i])*q){u.mods[i]=0;blast(.3+.5*m.share,`${m.name} 反応物誘爆`,'fuel');boom='fuel';}
 else if(m.k==='launcher'&&u.ammo[i]>0&&ctx.rand()<.4*u.ammo[i]/MAGAZINE_MISSILES*q){const n=u.ammo[i];u.ammo[i]=0;u.mods[i]=0;blast(clamp(n*250/Math.max(1,u.sec[si].max),.2,.9),`弾薬庫誘爆（ミサイル ${Math.round(n)} 発）`,'magazine');boom='magazine';}
 let fire=false;if(why!=='fire'&&!u.secLost.includes(si)&&ctx.rand()<(IGNITE[m.k]??.1)*Math.min(1,q*1.5)){fire=!(u.fire[si]>0);u.fire[si]=Math.max(u.fire[si]||0,.3);if(fire)ev(`${SECTION_NAMES[si]||'区画'}で火災発生（${m.name}）`);}
 if(!boom&&before>0&&u.mods[i]<=0){
  if(m.k==='capacitor'&&m.link!=null&&u.mods[m.link]>0){u.mods[m.link]=0;ev(`${m.name} 破壊（${p.modules[m.link].name} 射撃不能）`);}
  else if(m.k==='reactor')ev(`${m.name} 停止（出力 −${Math.round(m.share*100)}%）`);
  else if(m.k!=='other'&&m.k!=='quarters')ev(`${m.name} 破壊`);}
 return {after:u.mods[i],fire,boom};
}
// A section whose frames are gone collapses: most of what it holds goes with it.
function combatSectionLost(ctx,u,si){
 if(u.secLost.includes(si))return;u.secLost.push(si);u.sec[si].s=0;u.fire[si]=0;const mods=u.p.modules||[],need=u.p.crewNeed||0;
 for(let i=0;i<mods.length;i++)if(u.secOf[i]===si&&mods[i].k!=='hull'&&u.mods[i]>0&&ctx.rand()<.65)u.mods[i]=0;
 u.crew-=need*u.sec[si].max/Math.max(1,u.p.hp)*.7;ctx.ev(u,`${SECTION_NAMES[si]||'区画'} 崩壊`);
}
// One penetrating hit of E TT through face f into section si: the frames take
// their share, then up to three modules behind the face, each deeper than the
// last, the shot losing energy as it passes through.
function combatPenetrate(ctx,u,si,f,E,aim,Q){
 const p=u.p,mods=p.modules||[],sec=u.sec[si],frame=E*COMBAT.frame,path=[];sec.s-=frame;let left=E-frame,minDep=-1,fire=false,boom=null;
 const cand=[];for(let i=0;i<mods.length;i++){if(u.secOf[i]!==si||mods[i].k==='hull')continue;cand.push({i,dep:combatDepth(u,i,f,si),w:mods[i].w*(u.mods[i]>0?1:.15)*(aim&&mods[i].k===aim?6:1)});}
 for(let n=0;n<COMBAT.maxPath&&left>Q*.05&&cand.length;n++){
  let tot=0;for(const c of cand){c.p=c.dep>=minDep?c.w*Math.exp(-(c.dep-Math.max(0,minDep))/.3):0;tot+=c.p;}if(!(tot>0))break;
  let r=ctx.rand()*tot,c=cand[0];for(const x of cand){r-=x.p;if(r<=0){c=x;break;}}
  const i=c.i,m=mods[i],hp=Math.max(1,m.hits*Q),before=u.mods[i],take=Math.min(left,before*hp+Q*.2),res=combatModuleDamage(ctx,u,i,take,Q,'shot');
  path.push({i,name:m.name,k:m.k,dmg:Math.round(take),before:+before.toFixed(3),after:+(u.mods[i]).toFixed(3),y:m.y??0,z:m.z??0,at:m.at??.5});
  if(res.fire)fire=true;if(res.boom)boom=res.boom;left=(left-take)*COMBAT.through;minDep=c.dep;cand.splice(cand.indexOf(c),1);
 }
 if(left>0)sec.s-=left*.5;
 if(sec.s<=0&&!u.secLost.includes(si))combatSectionLost(ctx,u,si);
 return {sec:si,face:f,E:Math.round(E),frame:Math.round(frame),path,fire,boom};
}
// Fires grow on what burns in their section and are fought by the crew; they
// wreck modules, kill crew, weaken the frames and spread to the next section.
function combatFires(ctx,u,dt,Q){
 const p=u.p,mods=p.modules||[],N=u.sec.length,dc=COMBAT.fireDC*fleetCrewEff(u)*(u.out?.6:1);
 for(let si=0;si<N;si++){
  let f=u.fire[si];if(!(f>0))continue;if(u.secLost.includes(si)){u.fire[si]=0;continue;}
  let fuel=0,all=0;const idx=[];for(let i=0;i<mods.length;i++){if(u.secOf[i]!==si||mods[i].k==='hull')continue;all+=mods[i].w;if(u.mods[i]>0){idx.push(i);fuel+=mods[i].w*(FLAMMABLE[mods[i].k]||0);}}
  const share=all>0?fuel/all:0;f=Math.min(1,f+(COMBAT.fireGrow*(.5+share*1.6)*(.4+f)-dc)*dt);
  if(f<=0){u.fire[si]=0;ctx.ev(u,`${SECTION_NAMES[si]||'区画'}の火災を鎮火`);continue;}
  u.fire[si]=f;u.sec[si].s-=f*COMBAT.fireFrame*Q*dt;u.crew-=(p.crewNeed||0)*COMBAT.fireCrew*f*dt;
  if(idx.length){let tw=0;for(const i of idx)tw+=mods[i].w;let r=ctx.rand()*tw,i=idx[0];for(const j of idx){r-=mods[j].w;if(r<=0){i=j;break;}}combatModuleDamage(ctx,u,i,f*COMBAT.fireDmg*Q*dt,Q,'fire');}
  if(f>.55)for(const j of [si-1,si+1])if(u.sec[j]&&!u.secLost.includes(j)&&!(u.fire[j]>0)&&ctx.rand()<COMBAT.fireSpread*f*dt){u.fire[j]=.2;ctx.ev(u,`火災が${SECTION_NAMES[j]||'隣の区画'}に延焼`);}
  if(u.sec[si].s<=0&&!u.secLost.includes(si))combatSectionLost(ctx,u,si);
 }
}
// The ship breaks up when two sections are gone or a midship section goes;
// it is out of the fight without power, without a bridge, or short of crew.
function combatStatus(ctx,u){
 if(u.dead)return;u.crew=Math.max(0,u.crew);let hp=0;for(const x of u.sec)hp+=Math.max(0,x.s);u.hp=hp;
 const N=u.sec.length,lost=u.secLost;
 if(lost.length>=2||lost.some(i=>i>0&&i<N-1)){u.dead=true;u.velocity=[0,0,0];u.fate=u.fateHint||'hull';u.fire=u.fire.map(()=>0);ctx.sunk(u,{reactor:'炉心誘爆',fuel:'反応物誘爆',magazine:'弾薬庫誘爆'}[u.fate]||'船体破断');return;}
 if(!u.out){const p=u.p,after=fleetSystems(u),why=after.hasReactor&&p.grid?.P>0&&after.reactor<=0?'電源喪失':after.hasBridge&&!after.bridge?'艦橋喪失':(p.crewNeed||0)>0&&u.crew<p.crewNeed*FLEET_MIN_CREW?'乗員不足':null;if(why){u.out=why;u.order={...u.order,type:'hold'};ctx.out(u,why);}}
}
// Everything that reached u this step (o, from combatIncoming): shields first,
// then the armour zones, penetrations, fires and the ship's state.
// ctx: {rand(), time, damage, ev(u,text), sunk(u,why), out(u,why), hit?(u,rec)}.
function combatResolve(ctx,u,o,dt,s){
 const p=u.p,DMG=ctx.damage??1,N=u.sec.length,Z=combatZones(p,N),Q=Math.max(1,p.hp*COMBAT.quantum);
 // Shields: the field has its own capacity; the generator's share of reactor
 // power both deflects and recharges it, and short of its upkeep the field
 // decays. Power cells are a separate bank: while the field is loaded or below
 // full they feed it (up to bankRate times the generator's rating), so a ship
 // can hold its shields while the reactor drives engines and guns until the
 // cells run dry. A full field passes its surplus feed back into the cells.
 u.shieldMax=Math.max(0,(p.shieldBuffer??p.D*K.bufferS)*s.shield);u.bankMax=Math.max(0,(p.reserve||0)*(s.battery??1));u.bank=clamp(u.bank??u.bankMax,0,u.bankMax);
 const D=p.D*s.shield,eff=D*(u.shF??1),gen0=eff*dt*DMG,decay=Math.max(0,1-(u.shF??1))*D*dt*DMG*.5,short=o.sf+(u.shieldMax-u.shield)+decay-gen0;
 const bd=short>0&&u.bank>0&&u.shieldMax>0?Math.min(u.bank,COMBAT.bankRate*D*dt*DMG,short):0;u.bank-=bd;u.bankUse=bd/Math.max(1e-6,dt);
 const gen=gen0+bd,over=Math.max(0,o.sf-gen),ab=Math.min(u.shield,over),leak=over-ab,had=u.shield>0,next=u.shield-ab+Math.max(0,gen-o.sf)-decay;
 if(next>u.shieldMax&&u.bank<u.bankMax)u.bank=Math.min(u.bankMax,u.bank+(next-u.shieldMax));
 u.shield=clamp(next,0,u.shieldMax);u.underFire=o.sf>0;u.shRate=(gen-decay)/Math.max(1e-6,dt);if(had&&u.shield<=0&&u.shieldMax>0)ctx.ev(u,'シールド消失');
 // Ion fire reaching the hull drains the stored charge and chokes the reactor for a while.
 if(o.ion>0&&leak>0){const il=leak*Math.min(1,COMBAT.ionShield*o.ion/Math.max(1e-9,o.sf)),was=u.ionK||0;u.energy=Math.max(0,u.energy-il*COMBAT.ionDrain);u.bank=Math.max(0,(u.bank||0)-il*COMBAT.ionDrain*COMBAT.ionBank);if(u.manual)u.ionDrained=(u.ionDrained||0)+il*COMBAT.ionDrain;u.ionK=Math.min(1,was+il/Math.max(1,p.hp*.15));if(was<.3&&u.ionK>=.3)ctx.ev(u,'イオン被弾：蓄電を喪失・反応炉出力低下');}
 u.ionK=(u.ionK||0)*Math.exp(-dt/COMBAT.ionTau);if(u.penHot>0)u.penHot=Math.max(0,u.penHot-dt);
 // Armour: the hull hit spreads over the faces by bearing and over the sections
 // by area (more on the sections holding an aimed-at system).
 const hullHit=leak*(o.sf>0?o.hull/o.sf:0)+o.direct;
 if(!(hullHit>0)&&!u.hot){if(u.fire.some(f=>f>0))combatFires(ctx,u,dt,Q);combatStatus(ctx,u);return;}
 const load=new Array(Z.n).fill(0),aims=Object.entries(o.aim),aimTot=aims.reduce((n,[,v])=>n+v,0);
 let spread=hullHit;
 if(hullHit>0&&o.zw){const zt=o.zw.reduce((a,b)=>a+b,0),fz=zt>0?Math.min(1,zt/Math.max(zt,aimTot)):0;if(fz>0){for(let z=0;z<Z.n&&z<o.zw.length;z++)if(o.zw[z]>0)load[z]+=hullHit*fz*o.zw[z]/zt;spread=hullHit*(1-fz);}}
 if(spread>0){const ft=o.face.reduce((a,b)=>a+b,0),fw=ft>0?o.face.map(v=>v/ft):Z.faceShare,al=aims.length?aims:[['auto',1]],at=aims.length?aimTot:1;
  for(let f=0;f<6;f++){const hf=spread*fw[f];if(!(hf>0))continue;
   for(const [k,v] of al){const kind=k==='auto'?null:k,ws=[];let W=0;for(let si=0;si<N;si++){const a=Z.A[si*6+f],w=a>0&&!u.secLost.includes(si)?a*(kind?1+4*aimShare(u,si,kind):1):0;ws.push(w);W+=w;}if(!(W>0))continue;for(let si=0;si<N;si++)if(ws[si]>0)load[si*6+f]+=hf*(v/at)*ws[si]/W;}}}
 const dec=Math.exp(-dt/COMBAT.tau);let recs=0,aSum=0,iSum=0,worst=0;
 for(let z=0;z<Z.n;z++){
  if(!(Z.cap[z]>0))continue;let L=u.zl[z]*dec+load[z];const cap=Z.cap[z]*u.zi[z];
  if(L>cap){const E=L-cap;L=cap;u.zi[z]=Math.max(COMBAT.minInt,u.zi[z]-E/Z.cap[z]*COMBAT.hole);u.zq[z]+=E;}
  u.zl[z]=L;aSum+=Z.A[z];iSum+=Z.A[z]*u.zi[z];worst=Math.max(worst,L/Math.max(1e-9,Z.cap[z]*u.zi[z]));
  if(load[z]>0){const si=Math.floor(z/6);u.sec[si].s-=load[z]*COMBAT.spall;if(u.sec[si].s<=0&&!u.secLost.includes(si))combatSectionLost(ctx,u,si);}
  while(u.zq[z]>=Q&&!u.dead){u.zq[z]-=Q;const si=Math.floor(z/6),f=z%6;if(u.secLost.includes(si))continue;let r=ctx.rand()*(aimTot||1),aim=null;for(const [k,v] of aims){r-=v;if(r<=0){aim=k==='auto'?null:k;break;}}
   const rec=combatPenetrate(ctx,u,si,f,Q,aim,Q);u.penHot=8;if(recs++<3){rec.t=Math.round(ctx.time*10)/10;rec.src=combatTop(o);rec.thick=+Z.T[z].toFixed(2);rec.integrity=+u.zi[z].toFixed(2);u.hitLog.push(rec);if(u.hitLog.length>24)u.hitLog.shift();ctx.hit?.(u,rec);}
   combatStatus(ctx,u);}
 }
 u.armor=aSum>0?iSum/aSum:1;u.armorLoad=worst;u.hot=worst>.003||hullHit>0;
 if(!u.dead)combatFires(ctx,u,dt,Q);
 combatStatus(ctx,u);
}
// Fire handed in from outside the model (a piloted ship's bolts), or a whole
// incoming record (x.face present), added into o for target t.
function combatMerge(o,t,x){
 if(!x)return o;o.sf+=x.sf||0;o.hull+=x.hull||0;o.direct+=x.direct||0;o.ion+=x.ion||0;const w=(x.hull||0)+(x.direct||0)+.1*(x.sf||0);
 for(const [k,v] of Object.entries(x.aim&&Object.keys(x.aim).length?x.aim:{auto:w}))o.aim[k]=(o.aim[k]||0)+v;
 if(Array.isArray(x.face))for(let f=0;f<6;f++)o.face[f]+=x.face[f]||0;else if(x.from&&w>0){const fw=combatFaces(t,x.from);for(let f=0;f<6;f++)o.face[f]+=fw[f]*w;}
 if(x.zw){o.zw=o.zw||new Array(x.zw.length).fill(0);for(let z=0;z<x.zw.length;z++)o.zw[z]+=x.zw[z]||0;}
 if(x.by)for(const k in x.by)o.by[k]=(o.by[k]||0)+x.by[k];else if(x.src!=null&&w>0)o.by[x.src]=(o.by[x.src]||0)+w;return o;
}
// Copies of a unit's combat state (for the fleet screen's planning copies).
function combatClone(u){return {sec:(u.sec||[]).map(x=>({...x})),secLost:[...(u.secLost||[])],secOf:u.secOf,zl:(u.zl||[]).slice(),zi:(u.zi||[]).slice(),zq:(u.zq||[]).slice(),fire:(u.fire||[]).slice(),hitLog:(u.hitLog||[]).slice()};}
const fleetIntegrity=u=>{if(!u.sec?.length)return clamp((u.hp??1)/Math.max(1,u.p?.hp||1),0,1);let s=0,m=0;for(const x of u.sec){s+=Math.max(0,x.s);m+=x.max;}return m>0?s/m:0;};
// ---------- hulls as boxes (v17) ----------
// For collisions and lines of fire a hull is a box of its length, height and
// beam, turned by its yaw. Mass decides who gives way in a collision; a design
// without a recorded mass is weighed by its volume.
function hullHalf(p){const L=Math.max(10,p?.len||100);return [L*.5,Math.max(4,(p?.height||L*.2)*.5),Math.max(4,(p?.width||L*.35)*.5)];}
function hullMass(u){const m=u.info?.mass;if(m>0)return m;const h=hullHalf(u.p);return h[0]*h[1]*h[2]*.4;}
// Where a hull point lies in the ship's own frame (x ahead, y up, z starboard).
function hullLocal(u,pt){const c=Math.cos(u.yaw||0),s=Math.sin(u.yaw||0),dx=pt[0]-u.pos[0],dy=pt[1]-u.pos[1],dz=pt[2]-u.pos[2];return [dx*c+dz*s,dy,-dx*s+dz*c];}
// Overlap of two hull boxes: the depth and unit normal (from a toward z) of
// the shallowest way apart — along one of the boxes' four horizontal axes, or
// up — and a point between them where they meet. Null when they do not touch.
function hullOverlap(a,z){
 const ha=hullHalf(a.p),hz=hullHalf(z.p),dx=z.pos[0]-a.pos[0],dy=z.pos[1]-a.pos[1],dz=z.pos[2]-a.pos[2];
 const oy=ha[1]+hz[1]-Math.abs(dy);if(oy<=0)return null;
 const ra=Math.hypot(ha[0],ha[2]),rz=Math.hypot(hz[0],hz[2]);if(dx*dx+dz*dz>=(ra+rz)*(ra+rz))return null;
 const ca=Math.cos(a.yaw||0),sa=Math.sin(a.yaw||0),cz=Math.cos(z.yaw||0),sz=Math.sin(z.yaw||0);
 const ext=(h,c,s,x,y)=>Math.abs(c*x+s*y)*h[0]+Math.abs(-s*x+c*y)*h[2];
 let best=oy,n=[0,dy>=0?1:-1,0],ea=ha[1],ez=hz[1];
 for(const [x,y] of [[ca,sa],[-sa,ca],[cz,sz],[-sz,cz]]){const pa=ext(ha,ca,sa,x,y),pz=ext(hz,cz,sz,x,y),d=dx*x+dz*y,o=pa+pz-Math.abs(d);if(o<=0)return null;if(o<best){best=o;const sg=d>=0?1:-1;n=[x*sg,0,y*sg];ea=pa;ez=pz;}}
 const k=ea/Math.max(1e-6,ea+ez);
 return {depth:best,n,point:[a.pos[0]+dx*k,a.pos[1]+dy*k,a.pos[2]+dz*k]};
}
// Whether the segment a→b passes through u's hull box (scaled by k).
function hullSegment(u,a,b,k=1){
 const h=hullHalf(u.p),p=hullLocal(u,a),q=hullLocal(u,b);let t0=0,t1=1;
 for(let i=0;i<3;i++){const e=h[i]*k,d=q[i]-p[i];if(Math.abs(d)<1e-9){if(p[i]<-e||p[i]>e)return false;continue;}let lo=(-e-p[i])/d,hi=(e-p[i])/d;if(lo>hi){const t=lo;lo=hi;hi=t;}if(lo>t0)t0=lo;if(hi<t1)t1=hi;if(t0>t1)return false;}
 return true;
}
// The first ship of u's own side lying across its line of fire to t (its box
// a little shrunk: guns along a hull can fire past the edge of another).
function fireBlocker(list,u,t,k=.82){
 const a=u.pos,b=t.pos,d=sub(b,a),L=len(d);if(L<1)return null;const dx=d[0]/L,dy=d[1]/L,dz=d[2]/L;
 for(const x of list){if(x===u||x===t||x.team!==u.team||x.dead||x.absent)continue;const h=hullHalf(x.p),r=Math.hypot(h[0],h[1],h[2])*k,rx=x.pos[0]-a[0],ry=x.pos[1]-a[1],rz=x.pos[2]-a[2],s=rx*dx+ry*dy+rz*dz;if(s<-r||s>L+r)continue;const px=rx-dx*s,py=ry-dy*s,pz=rz-dz*s;if(px*px+py*py+pz*pz>r*r)continue;if(hullSegment(x,a,b,k))return x;}
 return null;
}
// Ships of u's own side close to its target take a share of the fire that
// misses it: the closer and the larger, the more (nothing beyond a few hulls).
function fireStray(list,u,t,dist){
 const out=[],R=Math.max(500,dist*.02+t.p.len*.7);let tot=0;
 for(const x of list){if(x===u||x===t||x.team!==u.team||x.dead||x.absent)continue;const h=hullHalf(x.p),gap=len(sub(x.pos,t.pos))-Math.max(h[0],h[2])*.5;if(gap>R)continue;
  const k=.22*clamp(1-gap/R,0,1)*clamp(Math.max(h[0],h[2])/Math.max(1,t.p.len*.5),.25,1.4);if(k>.004){out.push({x,k});tot+=k;}}
 if(tot>.4)for(const e of out)e.k*=.4/tot;
 return out;
}
// Hulls that touch are pushed apart along the shallowest way, the lighter
// moving more; a flown ship's share comes back as u.bump for its flight
// model. fixed(u) marks hulls the model must not move. Returns the contacts.
const HULL_HIT={k:.0011,min:2,max:.45,restitution:.15};
function hullCollide(list,opts={}){
 const out=[],give=(u,dp,dv)=>{if(u.manual){const b=u.bump||(u.bump={dp:[0,0,0],dv:[0,0,0],vn:0});for(let i=0;i<3;i++){b.dp[i]+=dp[i];b.dv[i]+=dv[i];}return;}u.pos=add(u.pos,dp);u.velocity=add(u.velocity||[0,0,0],dv);};
 for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
  const a=list[i],z=list[j];if(opts.skip&&opts.skip(a,z))continue;const c=hullOverlap(a,z);if(!c)continue;
  const ma=hullMass(a),mz=hullMass(z),ia=opts.fixed?.(a)?0:1/ma,iz=opts.fixed?.(z)?0:1/mz,sum=ia+iz;if(!(sum>0))continue;
  const va=a.velocity||[0,0,0],vz=z.velocity||[0,0,0],vn=(vz[0]-va[0])*c.n[0]+(vz[1]-va[1])*c.n[1]+(vz[2]-va[2])*c.n[2];
  give(a,mul(c.n,-c.depth*ia/sum),[0,0,0]);give(z,mul(c.n,c.depth*iz/sum),[0,0,0]);
  if(vn<0){const J=-(1+HULL_HIT.restitution)*vn/sum;give(a,[0,0,0],mul(c.n,-J*ia));give(z,[0,0,0],mul(c.n,J*iz));}
  if(a.manual&&a.bump)a.bump.vn=Math.max(a.bump.vn,-vn);if(z.manual&&z.bump)z.bump.vn=Math.max(z.bump.vn,-vn);
  out.push({a,z,point:c.point,n:c.n,vn:Math.max(0,-vn),ma,mz});
 }
 return out;
}
// The damage one hull takes in a collision (TT, as direct hits on the armour
// zone where it was struck): closing speed times the other's share of the
// mass, so a corvette that rams a star destroyer breaks and barely marks it.
function hullImpact(inc,u,other,c){
 if(!(c.vn>HULL_HIT.min))return 0;const mu=u===c.a?c.ma:c.mz,mo=u===c.a?c.mz:c.ma,frac=Math.min(HULL_HIT.max,HULL_HIT.k*(c.vn-HULL_HIT.min)*2*mo/(mu+mo)),tt=frac*Math.max(1,u.p.hp||1);if(!(tt>0))return 0;
 const z=combatZoneAt(u.p,hullLocal(u,c.point),hullHalf(u.p));combatAdd(inc,u,c.point,{direct:tt},null,other.id);
 const n=(u.sec?.length||HULL_SECTIONS)*6;if(!inc.zw)inc.zw=new Array(n).fill(0);if(z<n)inc.zw[z]+=tt;return tt;
}
// A disabled ship without power is pulled down toward the planet: it sinks
// ever faster with its bow dropping (fall.pitch) until it burns up.
const HULL_FALL={g:.6,depth:60000,pitch:.55};
function hullFall(u,dt,rand=Math.random){
 const f=u.fall||(u.fall={t:0,pitch:0,roll:(rand()-.5)*.5,spin:(rand()-.5)*.02});f.t+=dt;
 const k=Math.max(0,1-.05*dt),v=u.velocity||[0,0,0];u.velocity=[v[0]*k,v[1]-HULL_FALL.g*dt,v[2]*k];u.pos=add(u.pos,mul(u.velocity,dt));
 f.pitch=Math.min(HULL_FALL.pitch,f.pitch+.006*dt);u.yaw=(u.yaw||0)+f.spin*dt;return u.pos[1]<-HULL_FALL.depth;
}
// A ship turning carries its way round with its bow: the velocity turns with
// the hull, so it never slides along sideways.
function hullCarve(u,dy){if(!dy||!u.velocity)return;const c=Math.cos(dy),s=Math.sin(dy),x=u.velocity[0],z=u.velocity[2];u.velocity[0]=x*c-z*s;u.velocity[2]=x*s+z*c;}
// Ships keep clear of one another: one closing on another eases off and
// passes above or below it. Returns the change to the wanted velocity.
function hullAvoid(u,list,want){
 const h=hullHalf(u.p),r0=Math.hypot(h[0],h[2]),f=[Math.cos(u.yaw||0),Math.sin(u.yaw||0)];let up=0,slow=0;
 for(const x of list){if(x===u||x.dead||x.absent||x.towedBy===u.id||u.towedBy===x.id)continue;const hx=hullHalf(x.p),r=(r0+Math.hypot(hx[0],hx[2]))*1.12,dx=u.pos[0]-x.pos[0],dz=u.pos[2]-x.pos[2],d2=dx*dx+dz*dz;if(d2>r*r)continue;
  const dy=u.pos[1]-x.pos[1],clear=(h[1]+hx[1])*2.2;if(Math.abs(dy)>clear)continue;const d=Math.sqrt(d2)||1,k=1-d/r;
  up+=(Math.abs(dy)>1?Math.sign(dy):String(u.id)<String(x.id)?1:-1)*k*(1-Math.abs(dy)/clear);
  const toward=-(dx*f[0]+dz*f[1])/d;if(toward>0)slow=Math.max(slow,k*toward);}
 if(!up&&!slow)return want;const vs=Math.min((u.p.maxSpeed||100)*.5,160);
 return [want[0]*(1-.85*slow),want[1]+clamp(up,-1,1)*vs,want[2]*(1-.85*slow)];
}
// opts.rules overrides ranges for close-in battles; opts.extra adds damage dealt
// outside the model (a piloted ship's bolts). A unit with manual set is flown
// and fought by the player: the model only resolves the damage it takes. An
// absent unit (still in hyperspace) takes no part at all.
function fleetTick(b,dt,opts={}){
 const RULES=opts.rules||FLEET_RULES,DMG=RULES.damage??1;
 const alive=b.units.filter(u=>!u.dead&&!u.absent).sort((a,b)=>String(a.id).localeCompare(String(b.id))),before=alive.map(u=>({...u,pos:[...u.pos],velocity:[...u.velocity]})),byId=new Map(before.map(u=>[u.id,u])),sys=new Map(alive.map(u=>[u.id,fleetSystems(u)]));
 for(const u of alive){const o=u.order,t=byId.get(o.target),old=byId.get(u.id),s=sys.get(u.id);
  if(u.manual)continue;
  if(u.out){if(opts.gravity){u.velocity=[...old.velocity];u.pos=[...old.pos];if(hullFall(u,dt,()=>fleetRandom(b))&&!u.dead){u.dead=true;u.fate='fall';u.fire=(u.fire||[]).map(()=>0);b.events.push({time:b.time+dt,text:`${u.name}：大気圏に落下して喪失`,id:u.id,sunk:true});}}else{u.velocity=mul(old.velocity,Math.max(0,1-.03*dt));u.pos=add(old.pos,mul(u.velocity,dt));}u.maneuver=0;continue;}
  // Courses are planned on the engines' rated thrust (acc0); the reactor share they get (engF) decides what they deliver.
  const acc0=u.p.accel*s.engine*(.6+.4*fleetIntegrity(u)),acc=acc0*clamp(u.engF??1,0,1.2);let dest=o.type==='move'?o.point:o.type==='attack'&&t?t.pos:null;let want=[0,0,0];const v0=[...old.velocity];
  if(dest){
   // Attacking ships close to the distance their guns favour; broadside ships turn their beam to the target there.
   // A ship never backs away to open the range (it could not fire while running): closer in, it holds where it is.
   const delta=sub(dest,old.pos),d=len(delta),attack=o.type==='attack',floor=attack?(u.p.len+(t?.p.len||0))*.7:0,stop=attack?Math.min(fleetStandoff(u,t),Math.max(floor,d)):0,head=attack?fleetHeading(old,t,d,stop):null,yaw=head??Math.atan2(delta[2],delta[0]),err=fleetAngle(yaw-u.yaw),dy=clamp(err,-u.p.turnRate*dt,u.p.turnRate*dt);u.yaw+=dy;{const c=Math.cos(dy),sn=Math.sin(dy),x=v0[0],z=v0[2];v0[0]=x*c-z*sn;v0[2]=x*sn+z*c;}
   const signed=attack?d-stop:d,remaining=attack?Math.max(0,Math.abs(signed)-(head!=null?600:2500)):Math.max(0,signed),direction=attack&&signed<0&&head==null?-1:1,speed=Math.min(u.p.maxSpeed*(head!=null?.4:1),Math.sqrt((attack?1:2)*acc0*remaining))*Math.max(.08,Math.cos(err));
   if(d>1){want=mul(norm(delta),speed*direction);const hor=Math.hypot(want[0],want[2])*direction;want[0]=Math.cos(u.yaw)*hor;want[2]=Math.sin(u.yaw)*hor;}}
  want=hullAvoid(old,before,want);
  const dv=sub(want,v0),n=len(dv),step=Math.min(n,acc*dt);u.velocity=add(v0,mul(dv,step/Math.max(1e-9,n)));u.pos=add(old.pos,mul(u.velocity,dt));u.pos[1]=clamp(u.pos[1],-15000,15000);
  u.maneuver=acc0>0?clamp(n/(acc0*dt),0,1):0;
  if(o.type==='move'&&len(sub(dest,u.pos))<Math.max(10,acc*dt*dt)&&len(u.velocity)<acc*dt*2){u.pos=[...dest];u.velocity=[0,0,0];}
 }
 // Hulls that meet are pushed apart, and the impact damages both (v17).
 const contacts=opts.collide===false?[]:hullCollide(alive.filter(u=>!u.dead));
 const incoming=new Map(alive.map(u=>[u.id,combatIncoming()])),shots=[];b.bumps=[];
 for(const c of contacts){hullImpact(incoming.get(c.a.id),c.a,c.z,c);hullImpact(incoming.get(c.z.id),c.z,c.a,c);if(c.vn>HULL_HIT.min){b.bumps.push({a:c.a.id,z:c.z.id,point:c.point,vn:c.vn});if(c.vn>5)b.events.push({time:b.time+dt,text:`${c.a.name}と${c.z.name}が衝突（相対速度 ${Math.round(c.vn)} m/s）`,id:c.a.id});}}
 for(const [id,x] of opts.extra||[]){const inc=incoming.get(id),t=alive.find(v=>v.id===id);if(inc&&t)combatMerge(inc,t,x);}
 for(const u of alive){const o=u.order,p=u.p,s=sys.get(u.id),crewEff=fleetCrewEff(u);
  if(u.manual)continue;
  let t=null,raw=0,F=null,distance=0;const enemies=alive.filter(x=>x.team!==u.team),live=enemies.filter(fleetEffective),pool=live.length?live:enemies,reach=fleetReach(p);
  if(b.combat&&!u.out&&o.fire!==false){const explicit=pool.find(x=>x.id===o.target)||enemies.find(x=>x.id===o.target),nearest=()=>pool.slice().sort((a,z)=>len(sub(a.pos,u.pos))-len(sub(z.pos,u.pos))||String(a.id).localeCompare(String(z.id)))[0]||null;
   t=explicit||nearest();if(t&&len(sub(t.pos,u.pos))>reach){const n=nearest();t=n&&len(sub(n.pos,u.pos))<=reach?n:null;}
   // A ship of our own across the line of fire: another target in reach with a clear line, or hold fire.
   u.blocked=null;if(t){const bl=fireBlocker(alive,u,t);if(bl){const alt=pool.filter(x=>x!==t&&len(sub(x.pos,u.pos))<=reach&&!fireBlocker(alive,u,x)).sort((a,z)=>len(sub(a.pos,u.pos))-len(sub(z.pos,u.pos))||String(a.id).localeCompare(String(z.id)))[0]||null;if(!alt)u.blocked=bl.id;t=alt;}}
   if(t){distance=len(sub(t.pos,u.pos));F=fleetFire(u,t,distance);raw=F.cost*s.weapon;}}
  const fire=fleetPowerStep(u,s,t&&byId.get(t.id),raw,dt);
  if(!b.combat||u.out)continue;
  const requested=o.launch===true&&u.launched<p.slots&&p.launch>0,sliding=(p.slidingHatches||0)>0,oldOpen=clamp(u.hatchOpen||0,0,1);u.hatchTarget=sliding&&requested?1:0;
  const hatchSeconds=u.hatchTarget?(p.hatchOpenSeconds||4):(p.hatchCloseSeconds||4);u.hatchOpen=sliding?clamp(oldOpen+(u.hatchTarget?1:-1)*dt/hatchSeconds,0,1):0;
  const launchDt=requested?(sliding?Math.max(0,dt-(1-oldOpen)*(p.hatchOpenSeconds||4)):dt):0;
  if(launchDt>0){const n=Math.min(p.slots-u.launched,p.launch*s.hangar*crewEff*launchDt);if(n>0){u.launched+=n;u.queue.push([b.time+dt-launchDt+25,n]);}if(u.launched>=p.slots-1e-9){u.launched=p.slots;u.hatchTarget=0;}}
  while(u.queue.length&&u.queue[0][0]<=b.time)u.air+=u.queue.shift()[1];
  if(!t)continue;const aim=o.aim&&o.aim!=='auto'?o.aim:null;
  const hit=p.acc*F.fall*crewEff*(.6+.4*s.fire)*(aim?.8:1),gun=F.gun*s.weapon*fire*hit,ion=F.ion*s.weapon*fire*hit;
  // Missiles draw on each intact launcher's magazine.
  let msl=0;if(p.msl>0&&distance<=GUN_BANDS.long.range*1.5){const tubes=(p.modules||[]).map((m,i)=>m.k==='launcher'&&u.mods[i]>0&&u.ammo[i]>0?i:-1).filter(i=>i>=0),total=(p.modules||[]).filter(m=>m.k==='launcher').length;
   if(!total)msl=p.msl/20*crewEff;else if(tubes.length){let fired=0;for(const i of tubes){const n=Math.min(u.ammo[i],8/20*dt);u.ammo[i]-=n;fired+=n;}msl=p.msl/(total*8)*fired/dt*crewEff;}
   msl*=1-.7*t.p.aa/(t.p.aa+p.msl*.5+1e-9);}
  // Aircraft attrition also reads the common pre-damage snapshot.
  const airEnemy=enemies.reduce((v,e)=>v+byId.get(e.id).air,0),fd=u.air*.6*(1-.5*airEnemy/(u.air+airEnemy+1));
  const loss=Math.min(u.air,(t.p.aa*.012+airEnemy*.012/enemies.length)*dt);u.air-=loss;u.lost+=loss;
  const hd=dt*DMG;combatAdd(incoming.get(t.id),t,u.pos,{sf:(gun+COMBAT.ionShield*ion+.5*msl+.3*fd)*hd,hull:(gun+COMBAT.ionHull*ion+.5*msl+.3*fd)*hd,direct:(.5*msl+.7*fd)*hd,ion:ion*hd},aim,u.id);
  // What misses may strike a ship of our own close to the target.
  const miss=Math.max(0,1-hit);if(miss>0&&F.gun+F.ion>0)for(const {x,k} of fireStray(alive,u,t,distance)){const g2=F.gun*s.weapon*fire*miss*k,i2=F.ion*s.weapon*fire*miss*k;if(!(g2+i2>0))continue;combatAdd(incoming.get(x.id),x,u.pos,{sf:(g2+COMBAT.ionShield*i2)*hd,hull:(g2+COMBAT.ionHull*i2)*hd,ion:i2*hd},null,u.id);x.ffTaken=(x.ffTaken||0)+(g2+i2)*hd;shots.push({from:u.id,to:x.id,team:u.team,ion:i2>g2,gun:(g2+i2)*dt,msl:0,ff:true});}
  if(gun+ion+msl+fd>0)shots.push({from:u.id,to:t.id,team:u.team,ion:ion>gun,gun:(gun+ion)*dt,msl:msl*dt});
 }
 const time=b.time+dt,ctx={rand:()=>fleetRandom(b),time,damage:DMG,ev:(u,text)=>b.events.push({time,text:u.name+'：'+text,id:u.id}),sunk:(u,why)=>b.events.push({time,text:`${u.name}：撃沈（${why}）`,id:u.id,sunk:true}),out:(u,why)=>b.events.push({time,text:`${u.name}：戦闘不能（${why}）`,id:u.id}),hit:opts.onHit};
 for(const u of alive)combatResolve(ctx,u,incoming.get(u.id),dt,fleetSystems(u));
 b.time+=dt;return shots;
}
// AI ships attack the nearest enemy still able to fight, with automatic power
// distribution.
function fleetAiOrders(work){
 for(const u of work.units.filter(u=>u.team===1&&!u.dead&&!u.out)){const enemies=work.units.filter(t=>t.team===0&&!t.dead).sort((a,z)=>(!!a.out-!!z.out)||len(sub(a.pos,u.pos))-len(sub(z.pos,u.pos))||String(a.id).localeCompare(String(z.id)));
  const near=enemies[0];u.order={type:enemies.length?'attack':'hold',target:near?.id,fire:true,launch:true,power:'auto',aim:'auto'};}
}
function fleetCommit(b){
 if(b.phase!=='plan'||b.winner!==null||!b.units.some(u=>u.team===0&&fleetEffective(u)))return null;
 const seconds=clamp(Number(b.seconds)||FLEET_RULES.seconds,5,30),work={...b,units:b.units.map(u=>({...u,pos:[...u.pos],velocity:[...u.velocity],order:JSON.parse(JSON.stringify(u.order)),queue:u.queue.map(q=>[...q]),mods:(u.mods||[]).slice(),ammo:(u.ammo||[]).slice(),...combatClone(u)})),events:[]};
 fleetAiOrders(work);
 const frames=[fleetFrame(work)];for(let t=0;t<seconds;t+=FLEET_RULES.step){const shots=fleetTick(work,FLEET_RULES.step);frames.push(fleetFrame(work,shots));if(b.combat){const teams=[0,1].map(k=>work.units.some(u=>u.team===k&&fleetEffective(u)));if(!teams[0]||!teams[1]){work.winner=teams[0]?0:teams[1]?1:-1;break;}}}
 b.phase='execute';b.last={frames,units:work.units,events:work.events,winner:work.winner,time:work.time,duration:work.time-b.time,seed:work.seed};return b.last;
}
function fleetFinish(b){if(b.phase!=='execute'||!b.last)return false;b.units=b.last.units;b.time=b.last.time;b.winner=b.last.winner;if(b.last.seed!=null)b.seed=b.last.seed;b.events.push(...b.last.events);b.events=b.events.slice(-80);b.turn++;b.phase=b.winner!==null?'finished':'plan';return true;}
function fleetSample(result,elapsed){const fs=result.frames,t=fs[0].time+clamp(elapsed,0,result.duration);let i=Math.min(fs.length-2,Math.max(0,Math.floor((t-fs[0].time)/FLEET_RULES.step))),a=fs[i],b=fs[i+1]||a,q=clamp((t-a.time)/Math.max(1e-9,b.time-a.time),0,1),L=(x,y)=>lerp(x??0,y??x??0,q);return {time:t,shots:b.shots,units:a.units.map((u,k)=>{const v=b.units[k],w=q>=1?v:u;return {...u,pos:u.pos.map((x,j)=>lerp(x,v.pos[j],q)),velocity:u.velocity.map((x,j)=>lerp(x,v.velocity[j],q)),yaw:u.yaw+fleetAngle(v.yaw-u.yaw)*q,hp:L(u.hp,v.hp),shield:L(u.shield,v.shield),shieldMax:L(u.shieldMax,v.shieldMax),bank:L(u.bank,v.bank),bankMax:L(u.bankMax,v.bankMax),armor:L(u.armor,v.armor),energy:L(u.energy,v.energy),load:L(u.load,v.load),crew:L(u.crew,v.crew),air:L(u.air,v.air),launched:L(u.launched,v.launched),hatchOpen:L(u.hatchOpen,v.hatchOpen),hatchTarget:q>0?v.hatchTarget:u.hatchTarget,dead:w.dead,out:w.out,fate:w.fate,mode:w.mode,mods:w.mods,ammo:w.ammo,fire:w.fire,sec:w.sec};})};}

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
// ---------- grounding ----------
// Every part must touch the hull, or touch a chain of parts that does. Contact
// is tested with surface samples pushed slightly outward (into whatever the
// part rests on). Fittings follow the surface they were mounted on.
function groundingStats(ship,S){
 const parts=ship.parts.filter(p=>p.id>0),tol=clamp(ship.hull.L*.001,1.5,6),hullOK=!ship.hull.assembly;
 const box=new Map(),samples=new Map();
 for(const p of parts){try{const b=partAABB(p);box.set(p.id,[b[0]-tol,b[1]-tol,b[2]-tol,b[3]+tol,b[4]+tol,b[5]+tol]);}catch(e){}}
 const sm=p=>{let a=samples.get(p.id);if(!a){try{a=surfSamples(p,tol);}catch(e){a=[];}if(a.length>180){const k=a.length/180;a=Array.from({length:180},(_,i)=>a[Math.floor(i*k)]);}samples.set(p.id,a);}return a;};
 const safeIn=(p,q)=>{try{return inPart(p,q);}catch(e){return false;}};
 // Hull mesh corners inside a part's padded box catch contact along edges and
 // stern faces that sparse surface samples can step over.
 let hv=null;if(hullOK){try{const T=hullGeo(ship).tris||[];hv=T;}catch(e){hv=null;}}
 const hullCorner=p=>{const b=box.get(p.id);if(!hv||!b)return false;for(let i=0;i<hv.length;i+=3){const x=hv[i],y=hv[i+1],z=hv[i+2];if(x>=b[0]&&x<=b[3]&&y>=b[1]&&y<=b[4]&&z>=b[2]&&z<=b[5])return true;}return false;};
 const touchesHull=p=>{if(!hullOK)return false;if(p.k==='engine'&&attachedEngine(ship,p))return true;let vs=[];try{vs=volSamples(p);}catch(e){}const st=Math.max(1,Math.floor(vs.length/80));for(let i=0;i<vs.length;i+=st)if(inHull(ship,vs[i]))return true;for(const q of sm(p))if(inHull(ship,q))return true;return hullCorner(p);};
 const near=(a,b)=>{const A=box.get(a.id),B=box.get(b.id);return !!A&&!!B&&A[0]<=B[3]&&B[0]<=A[3]&&A[1]<=B[4]&&B[1]<=A[4]&&A[2]<=B[5]&&B[2]<=A[5];};
 // Two parts whose padded bounding boxes overlap are treated as touching: the
 // check is meant to catch parts left out in space, never to reject a fit-up.
 const touch=(a,b)=>near(a,b);
 const grounded=new Set();for(const p of parts)if(touchesHull(p))grounded.add(p.id);
 if(!hullOK&&parts.length){const big=parts.reduce((a,b)=>partVolume(b)>partVolume(a)?b:a);grounded.add(big.id);}
 let pending=parts.filter(p=>!grounded.has(p.id)),changed=true;
 while(changed&&pending.length){changed=false;const g=parts.filter(p=>grounded.has(p.id));for(const p of pending)if(g.some(q=>touch(p,q))){grounded.add(p.id);g.push(p);changed=true;}pending=pending.filter(p=>!grounded.has(p.id));}
 const loose=pending.map(p=>p.id),looseSet=new Set(loose),looseFits=[];
 for(const f of ship.fits){if(f.float)continue;const up=FITS[f.k]?.window?(f.n||AXES[f.a]):fitUp(f),probes=[tol,tol*3,(f.mountOffset||0)+tol,Math.max(0,f.base||0)+(f.ped||0)+tol].map(d=>sub(f.p,mul(up,d)));
  if(hullOK&&probes.some(q=>inHull(ship,q)))continue;let onGround=false,onLoose=false;
  for(const p of parts){const b=box.get(p.id);if(!b)continue;for(const q of probes){if(q[0]<b[0]||q[0]>b[3]||q[1]<b[1]||q[1]>b[4]||q[2]<b[2]||q[2]>b[5]||!safeIn(p,q))continue;if(looseSet.has(p.id))onLoose=true;else onGround=true;}if(onGround)break;}
  if(!onGround&&onLoose)looseFits.push(f.id);}
 S.ungrounded={parts:loose,fits:looseFits};
 if(S.floating){const n=parts.filter(p=>S.info?.[p.id]?.floating&&!looseSet.has(p.id)).length;S.warnings=S.warnings.filter(w=>!/浮いている区画/.test(w.text));if(n)S.warnings.unshift({lv:'bad',text:`船体から離れて浮いている区画が ${n} 個あります。`});}
 if(loose.length)S.warnings.unshift({lv:'bad',code:'ungrounded',text:`接地していない部品が ${loose.length} 個あります。船体にも、船体につながる構造物・区画にも接していません。動かして接するようにしてください。`});
 if(looseFits.length)S.warnings.unshift({lv:'bad',code:'ungrounded',text:`接地していない構造物の上に取り付けた装備が ${looseFits.length} 基あります。`});
 return S;
}
function inspectionTargets(ship,S,w){
 if(w.code==='ungrounded')return [...(S.ungrounded?.parts||[]).map(id=>({list:'parts',id})),...(S.ungrounded?.fits||[]).map(id=>({list:'fits',id}))];
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
// Second look for faces the outside test cannot see: a recess cut into the hull
// in front of the face (so the skin seen from outside is not the one the face
// meets), a surface crossing the far half of the compartment, or a compartment
// set just inside the skin. The ray starts in the open space in front of the
// face, so the surface it meets is the one the opening would actually pierce.
const AVIATION_STANDOFF=1.5;
function aviationFaceHit(ship,p,h,t,v,envelope=aviationEnvelope(ship)){
 if(!envelope.bvh)return null;const {axis,longAxis,widthAxis}=hatchAxes(h),sign=h.n[axis],pb=partAABB({...p,_packing:null}),face=sign>0?pb[axis+3]:pb[axis];
 const o=[0,0,0],d=[0,0,0];o[longAxis]=t;o[widthAxis]=v;o[axis]=face+sign*(AVIATION_STANDOFF+.5);d[axis]=-sign;
 if(insideOriginalEnvelope(ship,o))return null;
 const hit=rayBVH(envelope.bvh,o,d);if(!hit)return null;const gap=(hit.p[axis]-face)*sign;
 if(gap>AVIATION_STANDOFF)return null;
 // A surface beyond the face needs the compartment right behind it; one inside
 // the compartment must belong to it.
 if(gap>=0){const q=o.slice();q[axis]=face-sign*.05;if(!unclippedInPart(p,q))return null;}
 else if(!unclippedInPart(p,sub(hit.p,mul(h.n,.02))))return null;
 return hit;
}
function aviationContact(ship,p,face,envelope=aviationEnvelope(ship)){
 const existing=ship.hatches.find(h=>h.bay===p.id&&h.face===face),h={n:aviationFaceNormal(face),aperture:existing?.aperture??.85,sill:existing?.sill??.5},key=envelope.key+aviationPublicJSON([p.c,p.room,p.d,p.yaw,p.pitch,p.roll,p.surfaceNormal,p.outline,p.corner,p.aftWidth,p.foreWidth,p.deckSlope,p.ridge,h]);
 let cache=AVIATION_CONTACT_CACHE.get(p);if(!cache){cache=new Map();AVIATION_CONTACT_CACHE.set(p,cache);}const old=cache.get(face);if(old?.key===key)return old;
 const b=aviationFiniteBounds(p,h),{axis}=hatchAxes(h);
 let value=aviationContactScan(ship,p,h,b,(t,v)=>aviationSurfaceHit(ship,p,h,t,v,envelope));
 if(!value.bounds){
  const alt=aviationContactScan(ship,p,h,b,(t,v)=>aviationFaceHit(ship,p,h,t,v,envelope));
  if(alt.bounds){
   // The mouth reaches from the skin it pierces to the sill, measured over the
   // part of the compartment that lies behind that skin.
   const sign=h.n[axis],pb=partAABB({...p,_packing:null}),faceAt=sign>0?pb[axis+3]:pb[axis],thick=pb[axis+3]-pb[axis],f=sign>0?1-(h.sill??.5):(h.sill??.5);
   let deep=0,gap=0;for(const hit of alt.hits){const dd=(faceAt-hit.p[axis])*sign;deep=Math.max(deep,dd);gap=Math.max(gap,-dd);}
   const reach=Math.min(thick,deep+(thick-deep)*f),bb=alt.bounds;
   if(sign>0){bb[axis]=faceAt-reach;bb[axis+3]=faceAt+gap+.3;}else{bb[axis]=faceAt-gap-.3;bb[axis+3]=faceAt+reach;}
   value={...alt,mode:'face'};
  }
 }
 value={key,face,label:AVIATION_SURFACE_FACES[face],contact:!!value.bounds,area:value.bounds?value.area:0,bounds:value.bounds,mode:value.bounds?value.mode||'outside':null};cache.set(face,value);return value;
}
// Samples the face on a grid and keeps the largest contiguous rectangle where
// every corner and centre meets a surface belonging to the compartment.
function aviationContactScan(ship,p,h,b,hitAt){
 const {longAxis,widthAxis}=hatchAxes(h),nu=24,nv=16,points=[],valid=[],mid=(b[widthAxis]+b[widthAxis+3])/2;
 const point=(i,j)=>{const t=lerp(b[longAxis],b[longAxis+3],i/nu),v=mid+(j/nv*2-1)*openingHalf(b,t,widthAxis),hit=hitAt(t,v);return {t,v,hit};};
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
 const hits=[];if(bounds)for(let i=best.i0;i<=best.i1;i++)for(let j=best.j0;j<=best.j1;j++){const q=points[index(i,j)];if(q.hit)hits.push(q.hit);}
 return {bounds,area,hits};
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
 const envelope=aviationEnvelope(ship);for(const h of ship.hatches.filter(h=>h.surface)){const p=ship.parts.find(p=>p.id===h.bay&&p.k==='hangar'),contact=p&&aviationContact(ship,p,h.face,envelope);h._surfaceBounds=contact?.bounds?.slice()||null;h._surfaceMode=contact?.mode||null;h._surfaceArea=contact?.area||0;if(!h._surfaceBounds)continue;const b=h._surfaceBounds,{axis,longAxis,widthAxis}=hatchAxes(h),mid=(b[widthAxis]+b[widthAxis+3])/2;h.a=[0,0,0];h.b=[0,0,0];for(const q of [h.a,h.b]){q[axis]=b[axis+(h.n[axis]>0?3:0)];q[widthAxis]=mid;}h.a[longAxis]=b[longAxis];h.b[longAxis]=b[longAxis+3];h.w=b[widthAxis+3]-b[widthAxis];}
 const signature=JSON.stringify(ship.hatches.filter(h=>h.surface).map(h=>[h.id,h.k,h._surfaceBounds]));if(ship._aviationSurfaceKey!==signature){ship._aviationSurfaceKey=signature;for(const key of ['_cache','_portalGeo','_solidHull','_referenceHull','_armoredMaterial','_interiorKey'])delete ship[key];}
 }finally{delete ship._aviationSyncing;}
}


return {PLATE,plateThickness,shipSpan,HULL_SECTIONS,SECTION_NAMES,hullSectionShares,SHIP_LIGHT_KINDS,SHIP_EXAMPLES,registerShipExample,shipKit,fitTilt,fitUp,fitFrameOf,openingRimPoint,surfSamples,groundingStats,turretRayContext,turretClear,turretOrigin,turretRate,GROUND_LIMITS,GROUND_PRESETS,GROUND_VEHICLE_VOLUME,normalizeGroundForces,groundStatus,planStations,bridgeBodyRole,podPoint,podDepth,intrinsicCommandFits,POD_ASSET,BRIDGE_BODY_COMMAND,REFERENCE_TONE,engineSkinMesh,referenceFitYaw,rayTris,vmirrorPlane,vmirrorPoint,vmirrorPart,SHIP_CLASSES,shipClassFor,PUBLIC_LISTS,publicJSON,patchShip,patchItem,cache,AIRCRAFT_CLEARANCE,aircraftFitsBay,AVIATION_SIZE_VOLUME,AIR_WING_LIMITS,hangarCapacity,normalizeAirWings,aviationStatus,AVIATION_SURFACE_FACES,hatchAxes,aviationSurfaceContacts,setAviationSurfaceMode,syncAviationSurfaces,aviationHatchActive,isSlidingHatch,slidingHatchSpec,slidingHatchPanels,hatchOpenArea,ISD_HYPER_BASELINE,HYPER_CLASS_COEFFICIENT,HYPER_POWER_DENSITY,ISD_SHIELD_VOLUME,SHIELD_BUFFER_SECONDS,SHIELD_ENERGY_DENSITY,SHIELD_POWER_DENSITY,REACTOR_POWER_DENSITY,SOLID_CUT_SHAPES,normalizeSolidCut,mirrorSolidCut,solidCutTriangles,solidCutBounds,solidCutContains,solidCutsContain,applySolidCuts,solidPartCutContains,solidStructVolume,solidCutIntersectsShip,flexibleCompartment,hardConflicts,weaponChargeSpec,DREADNOUGHT_EXAMPLES,DESIGN_LIMITS,ALIGNMENTS,alignedPosition,alignPart,replacementShape,replacementOptions,replacePart,COMMAND_ROLES,commandCompartments,commandStatus,habitationSpace,inspectionTargets,planCutEdge,normalizePlanCut,structFrame,alignStructure,FLEET_RULES,POWER_MODES,POWER_AUTO_NOTE,fleetAutoPower,AIM_KINDS,MODULE_LABEL,FLEET_MIN_CREW,powerSplit,coreDetonation,fleetModules,fleetSystems,fleetCrewEff,fleetEffective,fleetProfile,fleetUnit,fleetIntegrity,trenchBattery,sideBattery,fleetFire,fleetReach,fleetStandoff,fleetHeading,fleetBroadside,fleetPowerStep,bandFireAt,fitBand,GUN_BANDS,COMBAT,combatInit,combatIncoming,combatAdd,combatMerge,combatResolve,combatZones,combatClone,combatZoneAt,COMBAT_FACE,unpackBits,fleetFormation,fleetBattle,fleetOrder,fleetArc,fleetTick,hullHalf,hullMass,hullLocal,hullOverlap,hullSegment,fireBlocker,fireStray,hullCollide,hullImpact,HULL_HIT,HULL_FALL,hullFall,hullCarve,hullAvoid,fleetCommit,fleetFinish,fleetSample,fleetFrame,normalizeBow,bowStation,engineHullEntry,ENGINE_BASELINES,engineBaseline,resizeEngine,parametricEngine,engineRating,sourceEngine,EQUIPMENT,equipmentSpec,equipmentOptions,enforceEquipment,customizeEquipment,adoptEquipment,HYPERDRIVE_REFERENCE,hyperCapacity,arcParameters,arcPoint,arcTriangles,inArc,SEPARATIST_EXAMPLES,STATS_SOURCE,SHIP_REFERENCE,PART_RATINGS,reactorPower,nozzleThrust,nozzleDemand,shieldLoad,partRatingKeys,validOutline,outlinePoints,outlineArea,outlineTriangles,AVIATION_ROLES,CHARGE_TT_M3,aircraftCapacity,aviationConnected,needsCapacitor,weaponCapacitors,refitReferenceInterior,clipReferenceBox, referenceEnginePoint, fitSpec, WEAPON_NOTES, referenceFitPoint, REFERENCE_ASSETS, decodeReference, referencePartPoint, referenceHullGeometry, refPartBounds, attachReferenceSkin, syncCompartments, isInternal, openingHalf, openingPlanes, clipOpening, ISD_PLANT, ISD_REACTOR_VOLUME, loftProfile, loftRing, fitRoomToEnvelope, insideOriginalEnvelope, clipPoly, triangulateFan, originalSurface, originalInHull:v3InHull, openingSurfacePoint, profileAt, roomShape, openingBounds, subtractBoxMesh, openingInterior, openBay, setRoomSize, partLabel, meshVolume, STRUCT_SHAPES, GROUPS, enginePaths, allOccupied, reactorFor, isReactor, inRoute, inStruct, structTriangles, worldStruct, localStruct, frameAxis, windowFrame, windowBay, engineVented, mirrorPart, conflicts, overlapParts, volSamples, exposedSurface,
  TT, G0, ISD_W, K, PARTS, FITS, HULLS, SECTIONS, KEELS, SECTORS, CLASSES, DESIGNS, AXES, AXNAME, ARMOR_MAX,
  newShip, sectionBase, sampleSection, planW, planH, hullGeo, heightfield, inHull, inEnv, inPart, partDims, partVolume, partArea, partAABB, structBox,
  rayEnv, rayPart, rayAABB, raySphere, mountFit, remount, fitFrame, fitOrigin, fitAABB, fitClash, fireArcs, placePart, placeFit, removeItem, twinOf,
  hatchGrid, hatchFrame, fillHangars, keelAt, computeStats, serialize, deserialize, buildDesign, profile, simulate,
  clamp, lerp, add, sub, mul, dot, cross, norm, len, mirrorP};
})();
if (typeof module !== 'undefined') module.exports = Core;

/* ============================================================
   rts.js — fleet operations in real time (v13).
   A sector of star systems; task groups that jump between them at
   the pace of their slowest hyperdrive; battles fought in each
   system by ships whose state is their hull sections and modules
   rather than a hit-point pool; squadrons with wing orders and
   missile salvos that point defence can shoot down. One game
   clock runs the operational map and every battle. No DOM.
   ============================================================ */
const Rts = (() => {
'use strict';
const C = Core, TT = C.TT;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, hyp = Math.hypot;
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = a => hyp(a[0], a[1], a[2]);
const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const angle = a => Math.atan2(Math.sin(a), Math.cos(a));

// ---------- rules ----------
// Distances in metres inside a system, light years between systems; time in
// seconds of one shared game clock.
const TICK = .25;
const RULES = {
 range: 40000, engage: 14000, missileRange: 60000, pdRange: 6000, damage: .7,
 arrive: 70000,           // a group drops out this far from the system's centre, on its line of approach
 withdrawSpool: 45,       // seconds to spool a hyperdrive and plot a jump
 hyperRate: .6,           // light years per second at hyperdrive class 1 on a trunk route (branch lines at half)
 minTrip: 20,             // shortest time in hyperspace
 minLeg: 8, hop: 15,      // shortest leg; re-plotting at each station passed
 detectLy: 90,            // long-range detection per unit of sensor rating
 wakeLy: 120,             // a reversion from hyperspace is felt this far away
 reportDelay: 120,        // inhabited worlds report fleets in their system after this long
 dwell: 180,              // the AI searches a system this long before moving on
 contactTTL: 1800,        // a contact not refreshed for half an hour is dropped
 aiStrategic: 30, aiTactical: 2, detectEvery: 2,
 pdMissile: .012, pdCraft: .0015, dogfight: .02, missileTT: 10,
 craftRearm: 60, launchPerSize: 1,
 maxSquadSize: 36
};
const CAPITAL_LENGTH = 900;   // star destroyers and up count against the 24-ship limit

// ---------- small craft ----------
// Speeds in m/s; aa is air-to-air strength, strike the TT one craft delivers on
// an attack run, armor how much punishment it takes; size in hangar units.
const CRAFT = {
 tie_ln:   {name: 'TIE/ln 戦闘機', short: 'TIE/ln', side: 'empire', role: 'fighter', speed: 2100, aa: 1.0, strike: 10, armor: .6, size: 1, crew: 1},
 tie_in:   {name: 'TIE/IN インターセプター', short: 'TIE/IN', side: 'empire', role: 'interceptor', speed: 2500, aa: 1.3, strike: 10, armor: .65, size: 1, crew: 1},
 tie_sa:   {name: 'TIE/sa ボマー', short: 'TIE/sa', side: 'empire', role: 'bomber', speed: 1800, aa: .35, strike: 380, armor: .9, size: 1.2, crew: 1},
 lambda:   {name: 'ラムダ級シャトル', short: 'ラムダ', side: 'empire', role: 'transport', speed: 1500, aa: .2, strike: 0, armor: 1.4, size: 3, crew: 6},
 xwing:    {name: 'T-65 Xウイング', short: 'Xウイング', side: 'rebel', role: 'fighter', speed: 2000, aa: 1.25, strike: 160, armor: 1.2, size: 1, crew: 1},
 ywing:    {name: 'BTL Yウイング', short: 'Yウイング', side: 'rebel', role: 'bomber', speed: 1600, aa: .55, strike: 300, armor: 1.5, size: 1.2, crew: 2},
 awing:    {name: 'RZ-1 Aウイング', short: 'Aウイング', side: 'rebel', role: 'interceptor', speed: 2600, aa: 1.35, strike: 12, armor: .9, size: 1, crew: 1},
 bwing:    {name: 'A/SF-01 Bウイング', short: 'Bウイング', side: 'rebel', role: 'bomber', speed: 1800, aa: .7, strike: 520, armor: 1.6, size: 1.5, crew: 1},
 vwing:    {name: 'アルファ3 Vウイング', short: 'Vウイング', side: 'republic', role: 'interceptor', speed: 2300, aa: 1.1, strike: 10, armor: .8, size: 1, crew: 1},
 arc170:   {name: 'ARC-170 スターファイター', short: 'ARC-170', side: 'republic', role: 'fighter', speed: 1900, aa: .9, strike: 220, armor: 1.4, size: 1.4, crew: 3},
 eta2:     {name: 'イータ2 アクティス', short: 'イータ2', side: 'republic', role: 'interceptor', speed: 2500, aa: 1.3, strike: 10, armor: .8, size: 1, crew: 1},
 btlb:     {name: 'BTL-B Yウイング', short: 'Yウイング', side: 'republic', role: 'bomber', speed: 1600, aa: .55, strike: 300, armor: 1.5, size: 1.2, crew: 2},
 laat:     {name: 'LAAT/i ガンシップ', short: 'LAAT', side: 'republic', role: 'transport', speed: 1300, aa: .4, strike: 12, armor: 1.6, size: 2.5, crew: 4},
 vulture:  {name: 'ヴァルチャー級ドロイド', short: 'ヴァルチャー', side: 'cis', role: 'fighter', speed: 2000, aa: .8, strike: 10, armor: .55, size: .8, crew: 0},
 tri:      {name: 'ドロイド・トライファイター', short: 'トライ', side: 'cis', role: 'interceptor', speed: 2200, aa: 1.15, strike: 14, armor: .7, size: 1, crew: 0},
 hyena:    {name: 'ハイエナ級ボマー', short: 'ハイエナ', side: 'cis', role: 'bomber', speed: 1700, aa: .4, strike: 330, armor: .8, size: 1.2, crew: 0}
};
const ROLE_NAME = {fighter: '戦闘', interceptor: '迎撃', bomber: '爆撃', transport: '輸送'};
// A carrier's default complement, by faction: one wing of six squadrons per 72 units.
const CRAFT_MIX = {
 empire: ['tie_ln', 'tie_ln', 'tie_ln', 'tie_ln', 'tie_in', 'tie_sa'],
 rebel: ['xwing', 'xwing', 'awing', 'ywing', 'ywing', 'bwing'],
 republic: ['vwing', 'vwing', 'eta2', 'arc170', 'arc170', 'btlb'],
 cis: ['vulture', 'vulture', 'vulture', 'tri', 'hyena', 'hyena']
};
const FACTIONS = {
 empire: {name: '銀河帝国', short: '帝国', color: '#9fb6c6'},
 rebel: {name: '反乱同盟', short: '同盟', color: '#e48a6a'},
 republic: {name: '銀河共和国', short: '共和国', color: '#d65a5a'},
 cis: {name: '独立星系連合', short: '分離主義', color: '#c7a76a'}
};
const SIDE_OF = {'銀河帝国': 'empire', '反乱同盟': 'rebel', '銀河共和国': 'republic', '独立星系連合': 'cis'};

// ---------- ground forces ----------
// Companies of 144 (four platoons of 36), four to a battalion, four battalions
// to a regiment of 2,304, as in the clone army's order of battle. Vehicles are
// held by companies; size is in vehicle-bay units of 600 m³.
const VEHICLES = {
 atat: {name: 'AT-AT', side: 'empire', size: 8, crew: 5, note: '全地形装甲トランスポート'},
 atst: {name: 'AT-ST', side: 'empire', size: 1, crew: 2, note: '全地形偵察トランスポート'},
 tx130: {name: 'TX-130 ホバータンク', side: 'republic', size: 1.5, crew: 2, note: 'ファイター・タンク'},
 atte: {name: 'AT-TE', side: 'republic', size: 2, crew: 7, note: '全地形戦術攻撃トランスポート'},
 juggernaut: {name: 'A6 ジャガーノート', side: 'republic', size: 6, crew: 2, note: 'ターボ・タンク'},
 t47: {name: 'T-47 エアスピーダー', side: 'rebel', size: .6, crew: 2, note: 'スノースピーダー'},
 t2b: {name: 'T2-B 反重力戦車', side: 'rebel', size: 1.4, crew: 2, note: 'リパルサー戦車'},
 aat: {name: 'AAT 装甲強襲戦車', side: 'cis', size: 2, crew: 4, note: '装甲強襲戦車'},
 mtt: {name: 'MTT 兵員輸送車', side: 'cis', size: 6, crew: 2, note: '大型兵員輸送車'},
 speeder: {name: '74-Z スピーダーバイク', side: 'any', size: .1, crew: 1, note: '偵察用'},
 apc: {name: '装甲兵員輸送車', side: 'any', size: 1, crew: 2, note: '汎用'}
};
const COMPANY_TROOPS = 144, BATTALION_COMPANIES = 4, REGIMENT_BATTALIONS = 4;
const COMPANY_TYPES = {infantry: '歩兵中隊', armor: '機甲中隊', walker: '歩行機中隊', recon: '偵察中隊', support: '支援中隊'};
// Regiment templates: company types and vehicles per company type, by faction.
const REGIMENT_TEMPLATES = {
 empire: {name: 'ストームトルーパー連隊', companies: ['infantry', 'infantry', 'walker', 'recon'], vehicles: {walker: {atat: 1, atst: 1}, recon: {speeder: 6, atst: 1}}},
 rebel: {name: '同盟軍歩兵連隊', companies: ['infantry', 'infantry', 'armor', 'recon'], vehicles: {armor: {t2b: 2}, recon: {t47: 2, speeder: 4}}},
 republic: {name: 'クローン・トルーパー連隊', companies: ['infantry', 'infantry', 'armor', 'walker'], vehicles: {armor: {tx130: 2}, walker: {atte: 1}}},
 cis: {name: 'バトル・ドロイド連隊', companies: ['infantry', 'infantry', 'armor', 'armor'], vehicles: {armor: {aat: 2}}}
};

// ---------- random ----------
function rng(seed) { let t = seed >>> 0; return () => { t = (t + 0x6D2B79F5) | 0; let x = Math.imul(t ^ t >>> 15, t | 1); x ^= x + Math.imul(x ^ x >>> 7, x | 61); return ((x ^ x >>> 14) >>> 0) / 4294967296; }; }

// ---------- the sector ----------
// A battle area is a square about 500 light years on a side on one of the
// galaxy's major hyperspace routes (the white lines of the galaxy map). The
// route crosses it as the main trunk; on either side lie the inhabited and
// empty systems no galaxy map names, joined to the trunk and to each other by
// branch lines. Fleets travel only along these lanes: fast on the trunk, slower
// on the branches.
const MAP_LY = 500, GRID_COLS = 'ABCDEFGHIJKLMNOPQRSTUVW';
const LANE = {trunk: {name: '主要幹線', f: 1}, branch: {name: '支線', f: .5}};
const REGIONS = {
 kuat: {name: 'クワット宙域', grid: 'M-10', note: 'コレリアン・ラン沿い、クワット星系を中心とする一辺500光年の宙域',
  routes: [{name: 'コレリアン・ラン', pts: [[-.03, .3], [.2, .36], [.4, .44], [.52, .48], [.58, .6], [.57, .8], [.6, 1.03]], ends: ['コルサント方面', 'コレリア方面']}],
  named: [{name: 'クワット', at: [.52, .48], kind: 'shipyard', pop: 4, note: 'クワット・ドライブ・ヤードの造船星系。惑星を軌道造船リングが取り巻く', planet: {kind: 1, ring: [1.16, 1.25], radius: 5.2e6}}]},
 corellia: {name: 'コレリア宙域', grid: 'M-11', note: 'コレリアン・ランとコレリアン交易スパインが分かれるコレリア星系の周辺',
  routes: [{name: 'コレリアン・ラン', pts: [[.46, -.03], [.47, .2], [.5, .4], [.52, .5], [.66, .64], [.82, .8], [1.03, .96]], ends: ['クワット・コルサント方面', 'ライロス方面']},
   {name: 'コレリアン交易スパイン', pts: [[.52, .5], [.5, .68], [.46, .85], [.44, 1.03]], ends: ['', 'ナントゥーン方面']}],
  named: [{name: 'コレリア', at: [.52, .5], kind: 'capital', pop: 5, note: 'コレリア星系。造船と交易の中心で、コレリアン・ランと交易スパインの起点', planet: {kind: 2, radius: 6.1e6}}]}
};
const SECTOR_DEFS = REGIONS;
const NAME_A = ['ヴェ', 'ドル', 'ケー', 'サル', 'ミラ', 'トー', 'ネム', 'アル', 'ゼン', 'フィ', 'ロウ', 'カ', 'イス', 'ベル', 'オル', 'ヤン', 'テシ', 'グラ', 'ハル', 'ルーメ', 'シャ', 'コル', 'ナー', 'ジェ', 'タル', 'ウラ'];
const NAME_B = ['ラス', 'ミン', 'リス', 'ドア', 'ナイ', 'セル', 'カント', 'ヴィア', 'ロン', 'ティス', 'マール', 'ガ', 'ゼア', 'ニス', 'オス', 'ル', 'ダン', 'リム', 'デン', 'ノール', 'ザ', 'ヘイム'];
const segDist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy, t = l2 > 0 ? clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2, 0, 1) : 0; return hyp(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t); };
const segCross = (a, b, c, d) => { const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };
function makeSector(key = 'kuat', seed = 13) {
 if (!REGIONS[key]) key = 'kuat';
 const def = REGIONS[key], R = rng(seed), size = MAP_LY, systems = [], edges = [], used = new Set(), code = def.grid.replace('-', '');
 const col = GRID_COLS.indexOf(def.grid.split('-')[0]), row = +def.grid.split('-')[1];
 const nameOf = () => { for (let k = 0; k < 80; k++) { const n = NAME_A[Math.floor(R() * NAME_A.length)] + NAME_B[Math.floor(R() * NAME_B.length)]; if (!used.has(n)) { used.add(n); return n; } } return '無名'; };
 const kinds = ['habitable', 'habitable', 'industrial', 'outpost', 'mining', 'barren', 'barren', 'barren', 'gas', 'gas', 'ice', 'ice', 'nebula'];
 const planetOf = k => ({kind: k === 'habitable' ? 2 : k === 'gas' ? 3 : k === 'ice' ? 4 : 5, radius: (k === 'gas' ? 4e7 : 3e6 + R() * 4e6)});
 const add = (pos, o) => { const s = {id: systems.length, pos, ...o}; systems.push(s); return s; };
 const near = (p, d) => systems.find(s => hyp(s.pos[0] - p[0], s.pos[1] - p[1]) < d);
 const inMap = p => p[0] >= 6 && p[0] <= size - 6 && p[1] >= 6 && p[1] <= size - 6;
 // Named worlds of the galaxy map first.
 for (const m of def.named) { used.add(m.name); add([m.at[0] * size, m.at[1] * size], {name: m.name, kind: m.kind, pop: m.pop, major: true, trunk: true, note: m.note, planet: m.planet}); }
 // The trunk: stations along each route every 45-75 ly, the named worlds among them.
 const routes = def.routes.map(r => ({name: r.name, ends: r.ends, pts: r.pts.map(p => [p[0] * size, p[1] * size]), nodes: []}));
 for (const r of routes) {
  const segs = [];let L = 0;for (let i = 1; i < r.pts.length; i++) { const l = hyp(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]); segs.push({a: r.pts[i - 1], b: r.pts[i], l0: L, l}); L += l; }
  const at = d => { const g = segs.find(q => d <= q.l0 + q.l) || segs[segs.length - 1], t = clamp((d - g.l0) / g.l, 0, 1); return [g.a[0] + (g.b[0] - g.a[0]) * t, g.a[1] + (g.b[1] - g.a[1]) * t]; };
  const along = p => { let best = 0, bd = Infinity; for (const g of segs) for (let k = 0; k <= 20; k++) { const q = [g.a[0] + (g.b[0] - g.a[0]) * k / 20, g.a[1] + (g.b[1] - g.a[1]) * k / 20], dd = hyp(q[0] - p[0], q[1] - p[1]); if (dd < bd) { bd = dd; best = g.l0 + g.l * k / 20; } } return {d: best, off: bd}; };
  const marks = [];
  for (const s of systems) { const q = along(s.pos); if (q.off < 8) marks.push({d: q.d, s}); }
  for (let d = 8 + R() * 14; d < L - 6; d += 45 + R() * 30) { const p = at(d); if (!inMap(p) || near(p, 34)) continue; const inh = R() < .72, k = inh ? ['habitable', 'industrial', 'outpost', 'habitable'][Math.floor(R() * 4)] : ['barren', 'gas', 'ice'][Math.floor(R() * 3)];
   const s = add(p, {name: inh ? nameOf() : `${code}-${String(100 + systems.length * 7 + Math.floor(R() * 7)).padStart(3, '0')}`, kind: k, pop: inh ? (k === 'habitable' ? 2 + Math.floor(R() * 2) : 1) : 0, major: false, trunk: true, planet: planetOf(k)}); marks.push({d, s}); }
  marks.sort((a, b) => a.d - b.d);r.nodes = [...new Set(marks.map(m => m.s.id))];
  for (let i = 1; i < r.nodes.length; i++) edges.push({a: r.nodes[i - 1], b: r.nodes[i], kind: 'trunk', route: r.name});
  r.len = L;
 }
 const trunkSegs = edges.map(e => [systems[e.a].pos, systems[e.b].pos]);
 // Systems off the route: inhabited and empty worlds no galaxy map names.
 const want = systems.length + (def.extra || 34);let tries = 0;
 while (systems.length < want && tries++ < 8000) {
  const p = [(.03 + .94 * R()) * size, (.03 + .94 * R()) * size];
  if (near(p, 34) || trunkSegs.some(([a, b]) => segDist(p, a, b) < 22)) continue;
  const k = kinds[Math.floor(R() * kinds.length)], inh = ['habitable', 'industrial', 'outpost', 'mining'].includes(k);
  add(p, {name: inh ? nameOf() : `${code}-${String(100 + systems.length * 7 + Math.floor(R() * 7)).padStart(3, '0')}`, kind: k, pop: k === 'habitable' ? 2 + Math.floor(R() * 2) : inh ? 1 : 0, major: false, trunk: false, planet: planetOf(k)});
 }
 // Branch lines: the relative neighbourhood graph of all systems, without links
 // between trunk stations, links across the trunk or links over 110 ly.
 const D = (i, j) => hyp(systems[i].pos[0] - systems[j].pos[0], systems[i].pos[1] - systems[j].pos[1]), n = systems.length, cand = [];
 const linked = new Set(edges.map(e => Math.min(e.a, e.b) * 4096 + Math.max(e.a, e.b)));
 for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
  const d = D(i, j);if (d > 110 || linked.has(i * 4096 + j)) continue;if (systems[i].trunk && systems[j].trunk) continue;
  let ok = true;for (let k = 0; k < n && ok; k++) if (k !== i && k !== j && Math.max(D(i, k), D(j, k)) < d) ok = false;if (!ok) continue;
  if (edges.some(e => e.a !== i && e.b !== i && e.a !== j && e.b !== j && segCross(systems[i].pos, systems[j].pos, systems[e.a].pos, systems[e.b].pos))) continue;
  cand.push({a: i, b: j, kind: 'branch', d});
 }
 const all = edges.concat(cand.map(({a, b, kind}) => ({a, b, kind})));
 const conn = es => { const adj = Array.from({length: n}, () => []); for (const e of es) { adj[e.a].push(e.b); adj[e.b].push(e.a); } const seen = new Set([0]), q = [0]; while (q.length) { const x = q.pop(); for (const y of adj[x]) if (!seen.has(y)) { seen.add(y); q.push(y); } } return seen.size === n; };
 // Join any island to the network by its shortest link, then thin the mesh into lines.
 for (let guard = 0; !conn(all) && guard < 60; guard++) {
  const adj = Array.from({length: n}, () => []);for (const e of all) { adj[e.a].push(e.b); adj[e.b].push(e.a); }
  const seen = new Set([0]), q = [0];while (q.length) { const x = q.pop(); for (const y of adj[x]) if (!seen.has(y)) { seen.add(y); q.push(y); } }
  let best = null;for (let i = 0; i < n; i++) if (!seen.has(i)) for (const j of seen) { if (systems[i].trunk && systems[j].trunk) continue; const d = D(i, j); if (!best || d < best.d) best = {a: i, b: j, d}; }
  if (!best) break;all.push({a: best.a, b: best.b, kind: 'branch'});
 }
 const order = all.filter(e => e.kind === 'branch').map(e => [e, R()]).sort((x, y) => x[1] - y[1]).map(x => x[0]);
 for (const e of order) { if (R() > .34) continue; const rest = all.filter(x => x !== e); const deg = id => rest.filter(x => x.a === id || x.b === id).length; if (deg(e.a) && deg(e.b) && conn(rest)) all.splice(all.indexOf(e), 1); }
 for (const e of all) e.len = D(e.a, e.b);
 for (const s of systems) { s.star = s.star || ['黄色矮星', '橙色矮星', '赤色矮星', '白色星', '青色巨星'][Math.floor(R() * 5)]; s.inhabited = s.pop > 0; s.links = []; }
 all.forEach((e, i) => { e.id = i; systems[e.a].links.push(i); systems[e.b].links.push(i); });
 return {key, name: def.name, grid: def.grid, note: def.note, col, row, size, systems, edges: all, routes: routes.map(r => ({name: r.name, ends: r.ends, pts: r.pts, nodes: r.nodes})), paths: new Map()};
}
const sysDistance = (S, a, b) => { const p = S.systems[a].pos, q = S.systems[b].pos; return hyp(p[0] - q[0], p[1] - q[1]); };
// The quickest way along the lanes from a to b (Dijkstra on the time a light
// year takes on each kind of lane): the systems passed and the legs flown.
function routePath(S, a, b) {
 if (a == null || b == null) return null;const key = a * 4096 + b, hit = S.paths?.get(key);if (hit !== undefined) return hit;
 const n = S.systems.length, dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), via = new Int32Array(n).fill(-1), done = new Uint8Array(n);dist[a] = 0;
 for (;;) { let u = -1, du = Infinity; for (let i = 0; i < n; i++) if (!done[i] && dist[i] < du) { du = dist[i]; u = i; } if (u < 0 || u === b) break; done[u] = 1;
  for (const ei of S.systems[u].links) { const e = S.edges[ei], v = e.a === u ? e.b : e.a, c = du + e.len / LANE[e.kind].f + 6; if (c < dist[v]) { dist[v] = c; prev[v] = u; via[v] = ei; } } }
 let out = null;if (dist[b] < Infinity) { const path = [b], legs = [];for (let x = b; x !== a; x = prev[x]) { path.unshift(prev[x]); legs.unshift(S.edges[via[x]]); } out = {path, legs, cost: dist[b], ly: legs.reduce((s, e) => s + e.len, 0)}; }
 if (S.paths) S.paths.set(key, out);return out;
}
const routeCost = (S, a, b) => a === b ? 0 : routePath(S, a, b)?.cost ?? Infinity;
// Seconds in hyperspace along a path at hyperdrive class hc (lower is faster):
// each lane at its own speed, a short re-plot at every station passed.
function pathSeconds(route, hc) { if (!route) return Infinity; let t = 0; for (const e of route.legs) t += Math.max(RULES.minLeg, e.len / (RULES.hyperRate * LANE[e.kind].f / Math.max(.25, hc))); return Math.max(RULES.minTrip, t + RULES.hop * Math.max(0, route.legs.length - 1)); }
function tripSeconds(d, hc) { return Math.max(RULES.minTrip, d / (RULES.hyperRate / Math.max(.25, hc))); }
const KIND_NAME = {capital: '首都星系', shipyard: '造船星系', habitable: '居住星系', industrial: '工業星系', outpost: '前哨基地', mining: '採掘星系', barren: '無人星系', gas: 'ガス巨星系', ice: '氷惑星系', nebula: '星雲'};

// ---------- designs and units ----------
// info: what the operational layer needs beyond the fleet profile.
function designInfo(S, p, extra = {}) {
 return {len: p.len, hyper: S.jumpOK ? S.hyperClass : null, sensor: S.sensor || 0, crew: S.crew || 0, troopCap: S.troopCapacity || 0,
  vehicleCap: (S.vehicleSizeCapacity || 0) + Math.floor((S.cargoCapacity || 0) / 600), slotCap: S.slots || 0, mass: S.mass || 0, cost: S.cost || 0,
  capital: p.len >= CAPITAL_LENGTH, ...extra};
}
// Personnel and supplies a ship draws from the fleet's allowance: its crew,
// pilots and embarked troops; provisions for them and stores by tonnage.
function unitDemand(info, air = 0, troops = 0) {
 const people = (info.crew || 0) + air + troops;
 return {people, supply: Math.round(people * .4 + (info.mass || 0) * .0005)};
}
function makeUnit(w, side, design, name, group) {
 const p = design.p, base = C.fleetUnit('u' + (w.nextId++), design.key, p, side);
 // Hull sections, armour zones and fires come from the core's combat state (C.combatInit).
 const u = Object.assign(base, {name: name || p.name, side, team: side, design: design.key, info: design.info, group, sys: null, order: {type: 'group', fire: true, power: 'auto', aim: 'auto'}, jump: null, squads: [], status: 'ready', kills: 0, dmgDone: 0, arrived: 0});
 w.units.set(u.id, u); return u;
}
const unitStruct = u => { let s = 0, m = 0; for (const x of u.sec) { s += Math.max(0, x.s); m += x.max; } return m > 0 ? s / m : 0; };
const alive = u => u && !u.dead && u.status !== 'withdrawn' && u.status !== 'rear';
const fighting = u => alive(u) && !u.out;
// A rough fighting value used by the AI and the strength readouts.
function unitStrength(u) {
 const p = u.p, sx = C.fleetSystems(u), health = unitStruct(u) * (u.out ? .15 : 1);
 const fire = (p.gunBest || 0) + .5 * (p.ionBest || 0) + .2 * (p.aa || 0) + 2 * (p.msl || 0);
 const tough = Math.sqrt(Math.max(1, p.hp) * Math.max(1, (p.shieldBuffer ?? p.D * 10) + 1)) * .02;
 return Math.sqrt(Math.max(1, fire * sx.weapon) * tough) * health + (p.slots || 0) * 4 * (sx.hangar ?? 1);
}

// ---------- the world ----------
// opts.sides: [{faction, name, ai}] ; opts.fleets[side] is an order of battle:
// {ctgs: [{name, tgs: [{name, formation, ships: [{design, name, air, ground, troops}]}]}]}
// (a flat list of ships with task-group numbers is still accepted).
function normalizeOrbat(raw) {
 if (raw && Array.isArray(raw.ctgs)) return raw;
 const by = new Map();for (const e of raw || []) { const k = e.tg || 1; if (!by.has(k)) by.set(k, []); by.get(k).push(e); }
 return {ctgs: [{name: '第1合同任務群', tgs: [...by.entries()].sort((a, b) => a[0] - b[0]).map(([k, ships]) => ({name: `第${k}任務群`, formation: 'abreast', ships}))}]};
}
function createWorld(opts) {
 const sector = opts.sector || makeSector(opts.region || 'kuat', opts.seed || 13);
 const w = {seed: opts.seed || 13, rand: rng((opts.seed || 13) * 7919 + 17), time: 0, acc: 0, nextId: 1, sector, mode: opts.mode || 'fleet',
  sides: (opts.sides || [{faction: 'empire', ai: false}, {faction: 'rebel', ai: true}]).map((s, i) => ({id: i, faction: s.faction, name: s.name || FACTIONS[s.faction]?.name || ('陣営' + i), ai: !!s.ai, contacts: new Map(), seen: new Map(), start: null, lost: 0, captured: 0, initial: 0, ended: null})),
  units: new Map(), groups: new Map(), ctgs: new Map(), squads: new Map(), wings: new Map(), missiles: [], battles: new Map(), events: [], designs: new Map(), timers: {ai: 0, det: 0, tac: 0}, result: null};
 for (const d of opts.designs || []) w.designs.set(d.key, d);
 // The sides start at the two ends of the main route; home is the stations nearest by lane.
 const r0 = sector.routes[0], ends = [r0.nodes[r0.nodes.length - 1], r0.nodes[0]];
 w.sides.forEach((sd, i) => { const st = ends[i % 2]; sd.start = st; sd.home = sector.systems.map(x => x.id).sort((a, b) => routeCost(sector, st, a) - routeCost(sector, st, b)).slice(0, 4); });
 for (const [i, raw] of (opts.fleets || []).entries()) {
  const sd = w.sides[i];if (!sd) continue;const ob = normalizeOrbat(raw);
  ob.ctgs.forEach((c, ci) => {
   const home = sd.home[ci % sd.home.length] ?? sd.start, ctg = makeCtg(w, i, c.name || `第${ci + 1}合同任務群`);
   (c.tgs || []).forEach((t, ti) => {
    const g = makeGroup(w, i, t.name || `第${ci + 1}${ti + 1}任務群`, home);g.ctg = ctg.id;g.formation = FORMATIONS[t.formation] ? t.formation : 'abreast';
    for (const e of t.ships || []) { const d = w.designs.get(e.design); if (!d) continue; const u = makeUnit(w, i, d, e.name, g.id); g.units.push(u.id); u.sys = g.sys; u.troops = e.troops || 0; u.ground = e.ground || null; for (const q of e.air || []) addSquad(w, u, q); }
    if (!g.units.length) { w.groups.delete(g.id); return; }
    ctg.tgs.push(g.id);g.flag = g.units.slice().sort((a, b) => w.units.get(b).p.len - w.units.get(a).p.len)[0];g.units.sort((a, b) => (b === g.flag) - (a === g.flag));
    deployGroup(w, g, null, ctg.tgs.length - 1);
   });
   if (!ctg.tgs.length) w.ctgs.delete(ctg.id);
  });
  sd.initial = [...w.units.values()].filter(u => u.side === i).reduce((n, u) => n + unitStrength(u), 0);
 }
 for (const sd of w.sides) seeSystem(w, sd.id, sd.start);
 supplyInit(w);
 return w;
}
function makeCtg(w, side, name) { const c = {id: 'c' + (w.nextId++), side, name, tgs: []}; w.ctgs.set(c.id, c); return c; }
function makeGroup(w, side, name, sys) {
 const g = {id: 'g' + (w.nextId++), side, name, units: [], sys, transit: null, spool: null, flag: null, formation: 'abreast', ctg: null, order: {type: 'auto'}, created: w.time};
 w.groups.set(g.id, g); return g;
}
// The combined task group a group belongs to (null for detachments).
const ctgOf = (w, g) => g?.ctg ? w.ctgs.get(g.ctg) || null : null;
// Squadrons fly in wings (飛行隊); a wing is the unit that takes orders and moves.
// Each carrier's squadrons form wings of up to six unless the order of battle says otherwise.
function addSquad(w, u, q) {
 const c = CRAFT[q.craft];if (!c) return null;const n = clamp(Math.round(q.n || 12), 1, RULES.maxSquadSize);
 let wing = q.wing && w.wings.get(q.wing);
 if (!wing) {const no = q.wingNo || 1, id = q.wing || ('w-' + u.id + '-' + no);wing = w.wings.get(id);if (!wing) {wing = {id, side: u.side, no, name: q.wingName || `${u.name} 第${no}飛行隊`, group: q.groupName || '', squads: [], order: {type: 'auto'}, home: u.id, phase: 'docked'};w.wings.set(id, wing);}}
 const s = {id: 's' + (w.nextId++), side: u.side, name: q.name || `${c.short}中隊`, craft: q.craft, n, n0: n, home: u.id, wing: wing.id, slot: wing.squads.length, state: 'docked', sys: u.sys, pos: [...u.pos], vel: [0, 0, 0], h: [1, 0, 0], t: 0, runs: 0, kills: 0, target: null};
 w.squads.set(s.id, s);wing.squads.push(s.id);u.squads.push(s.id);return s;
}
// ---- formations ----
// Offsets of each ship from the guide in the group's frame (x ahead, z to
// starboard), the guide first; the spacing grows with the largest hull.
const FORMATIONS = {abreast: '横陣', column: '単縦陣', echelon: '梯陣', wedge: '楔形陣', ring: '輪形陣'};
function formationOffsets(kind, members) {
 const n = members.length, gap = Math.max(2600, ...members.map(u => u.p.len * 1.6)), out = [];
 for (let i = 0; i < n; i++) {
  const k = Math.ceil(i / 2), sg = i % 2 ? 1 : -1;let x = 0, z = 0;
  if (kind === 'column') x = -i * gap * 1.1;
  else if (kind === 'echelon') { x = -i * gap * .72; z = i * gap * .72; }
  else if (kind === 'wedge') { x = -k * gap * .8; z = sg * k * gap * .8; }
  else if (kind === 'ring') { if (i) { const a = (i - 1) / Math.max(1, n - 1) * Math.PI * 2; x = Math.cos(a) * gap * 1.35; z = Math.sin(a) * gap * 1.35; } }
  else z = sg * k * gap;
  out.push([x, 0, z]);
 }
 return out;
}
const frameVec = (fw, o) => { const f = norm([fw[0], 0, fw[2]]), r = [-f[2], 0, f[0]]; return [f[0] * o[0] + r[0] * o[2], o[1], f[2] * o[0] + r[2] * o[2]]; };
// Ships take station in the system in their group's formation, facing along the
// lane they came in by (or toward the system from the edge of the map); groups
// arriving together stand side by side.
function deployGroup(w, g, fromSys, slot = null) {
 const S = w.sector.systems, sys = S[g.sys];let dir;
 if (fromSys != null) { const a = S[fromSys].pos, b = sys.pos, d = norm([a[0] - b[0], 0, a[1] - b[1]]); dir = d; }
 else { const nb = sys.links.map(ei => w.sector.edges[ei]).map(e => S[e.a === sys.id ? e.b : e.a]).sort((p, q) => routeCost(w.sector, q.id, w.sides[g.side === 0 ? 1 : 0].start) - routeCost(w.sector, p.id, w.sides[g.side === 0 ? 1 : 0].start))[0], c = nb ? nb.pos : [w.sector.size / 2, w.sector.size / 2], d = norm([c[0] - sys.pos[0], 0, c[1] - sys.pos[1]]); dir = len(d) > 0 ? d : [1, 0, 0]; }
 const us = g.units.map(id => w.units.get(id)).filter(alive), fw = scale(dir, -1), side = [-dir[2], 0, dir[0]], dist = fromSys != null ? RULES.arrive : 30000;
 if (slot == null) { slot = 0; for (const h of w.groups.values()) if (h !== g && h.side === g.side && h.sys === g.sys && !h.transit) slot++; }
 const width = Math.max(9000, ...us.map(u => u.p.len * 1.6)) * Math.max(2, Math.min(5, us.length)), shift = (slot % 2 ? 1 : -1) * Math.ceil(slot / 2) * (width + 6000);
 const offs = formationOffsets(g.formation, us), base = add(scale(dir, dist), side, shift);
 us.forEach((u, i) => { const o = frameVec(fw, offs[i]); u.pos = add(add(base, o), [(w.rand() - .5) * 600, (w.rand() - .5) * 1600, (w.rand() - .5) * 600]); u.yaw = Math.atan2(fw[2], fw[0]); u.velocity = [0, 0, 0]; u.sys = g.sys; u.arrived = w.time;
  for (const id of u.squads) { const s = w.squads.get(id); if (s && s.state === 'docked') { s.sys = g.sys; s.pos = [...u.pos]; } } });
 g.holdPos = null;
}
// Events carry a running number, so readers keep their place while old ones are dropped.
function event(w, text, o = {}) { w.events.push({n: w.evN = (w.evN || 0) + 1, t: w.time, text, ...o}); if (w.events.length > 400) w.events.splice(0, w.events.length - 400); }

// ---------- operational layer ----------
// A group can jump when every ship able to fight still has a hyperdrive; ships
// without one are left behind in a group of their own, unless a ship of the
// group holds them in a tractor beam (they ride along).
function towedIn(w, g) { const out = new Set(); for (const id of g.units) { const u = w.units.get(id); if (alive(u) && u.tractor?.lock && u.tractor.mode === 'tow') out.add(u.tractor.target); } return out; }
// The group's hyperdrive class (its slowest drive), or null while a disabled
// ship holds it (until recovered or scuttled) or no ship of it can jump. Ships
// whose hyperdrive is gone are left behind when it jumps.
function groupHyper(w, g) {
 let worst = 0;const towed = towedIn(w, g);
 for (const id of g.units) { const u = w.units.get(id); if (!alive(u) || towed.has(id)) continue; if (u.out) return null; const hc = unitHyper(u); if (hc == null) continue; worst = Math.max(worst, hc); }
 return worst || null;
}
// Disabled ships of a group not in a tow: the group cannot jump while it has any.
function groupDisabled(w, g) { const towed = towedIn(w, g), out = []; for (const id of g.units) { const u = w.units.get(id); if (alive(u) && u.out && !towed.has(id)) out.push(u); } return out; }
// Ships the group would leave behind on a jump: their hyperdrive is gone.
function groupStay(w, g) { const towed = towedIn(w, g); return g.units.map(id => w.units.get(id)).filter(u => alive(u) && !u.out && !towed.has(u.id) && unitHyper(u) == null); }
// A ship's hyperdrive class while any of its hyperdrive modules survives
// (wrecked units slow it in proportion), or null.
function unitHyper(u) {
 const hc = u.info?.hyper;if (hc == null) return null;const mods = u.p.modules || [];let has = 0, left = 0;
 mods.forEach((m, i) => { if (m.k !== 'hyper') return; has += m.share; left += m.share * Math.max(0, u.mods[i]); });
 if (!has) return hc;if (left <= 1e-6) return null;return hc / clamp(left / has, .25, 1);
}
const inBattleGroup = (w, g) => g.units.some(id => { const u = w.units.get(id); return alive(u) && w.battles.has(u.sys); });
// A jump is plotted along the lanes. The reactor goes to the hyperdrive for the
// spool: the guns fall silent, and the spool stands still while any ship of the
// group is taking fire.
function orderJump(w, gid, dest) {
 const g = w.groups.get(gid);if (!g || g.transit || g.sys == null || dest == null || dest === g.sys || !w.sector.systems[dest]) return {ok: false, why: '移動できません'};
 const route = routePath(w.sector, g.sys, dest);if (!route) return {ok: false, why: '航路がありません'};
 const held = groupDisabled(w, g);
 if (held.length) { if (!w.sides[g.side].ai) return {ok: false, why: `航行不能艦があります（${held.map(u => u.name).join('・')}）：回収するか自沈させてください`, held: held.map(u => u.id)}; for (const u of held) aiDisposeDisabled(w, u); }
 const towed = towedIn(w, g), stay = g.units.filter(id => { const u = w.units.get(id); return alive(u) && unitHyper(u) == null && !towed.has(id); });
 if (stay.length && stay.length === g.units.filter(id => alive(w.units.get(id))).length) return {ok: false, why: 'ハイパードライブが使えません'};
 if (stay.length) { const h = makeGroup(w, g.side, g.name + '（残置）', g.sys); h.units = stay; h.ctg = null; g.units = g.units.filter(id => !stay.includes(id)); for (const id of stay) w.units.get(id).group = h.id; h.flag = stay[0]; event(w, `${g.name}：ハイパードライブを失った艦を残置`, {side: g.side}); }
 const hc = groupHyper(w, g), inBattle = inBattleGroup(w, g), slow = towed.size ? 1.25 : 1;
 g.spool = {t: 0, need: inBattle ? RULES.withdrawSpool : 8, dest, route, trip: pathSeconds(route, hc) * slow, hc, blocked: false};
 // Craft out get the spool time to land; any still out when the ship jumps are left behind.
 for (const wing of w.wings.values()) if (g.units.includes(wing.home)) { wing.recall = true; for (const sid of wing.squads) { const s = w.squads.get(sid); if (s && s.state === 'out') s.state = 'return'; } }
 for (const id of g.units) { const u = w.units.get(id); if (alive(u)) u.jump = {phase: 'spool', t: 0, dest}; }
 return {ok: true, eta: g.spool.need + g.spool.trip, hc};
}
function cancelJump(w, gid) { const g = w.groups.get(gid); if (!g || !g.spool) return; g.spool = null; for (const id of g.units) { const u = w.units.get(id); if (u) u.jump = null; } for (const wing of w.wings.values()) if (g.units.includes(wing.home)) wing.recall = false; }
// Seconds until a group would arrive at dest if ordered now.
function etaTo(w, gid, dest) {
 const g = w.groups.get(gid);if (!g) return null;const hc = groupHyper(w, g);if (hc == null) return null;
 const from = g.transit ? g.transit.to : g.sys;if (from === dest) return g.transit ? g.transit.t1 - w.time : 0;
 const route = routePath(w.sector, from, dest);if (!route) return null;
 return (g.transit ? g.transit.t1 - w.time : 0) + (inBattleGroup(w, g) ? RULES.withdrawSpool : 8) + pathSeconds(route, hc) * (towedIn(w, g).size ? 1.25 : 1);
}
function departGroup(w, g) {
 const sp = g.spool;g.spool = null;const from = g.sys;
 // Ships held in a tractor beam by a ship of the group go along, joining it.
 for (const id of [...towedIn(w, g)]) { const t = w.units.get(id); if (!t || g.units.includes(id)) continue; const old = w.groups.get(t.group); if (old) old.units = old.units.filter(x => x !== id); g.units.push(id); t.group = g.id; }
 // Craft aboard go along; craft still out are left behind.
 for (const id of g.units) { const u = w.units.get(id); if (!alive(u)) continue; u.jump = null; u.sys = null; u.velocity = [0, 0, 0];
  for (const sid of u.squads) { const s = w.squads.get(sid); if (!s) continue; if (s.state === 'docked') s.sys = null; else if (s.state !== 'lost') craftLostBehind(w, s, from); } }
 for (const wing of w.wings.values()) if (g.units.includes(wing.home)) { wing.recall = false; wing.phase = 'docked'; }
 // Leg by leg, each at its lane's speed.
 const r = sp.route, total = r.legs.reduce((t, e) => t + e.len / LANE[e.kind].f, 0) || 1;let t = w.time;
 const legs = r.legs.map((e, i) => { const d = sp.trip * (e.len / LANE[e.kind].f) / total, L = {a: r.path[i], b: r.path[i + 1], t0: t, t1: t + d}; t += d; return L; });
 g.transit = {from, to: sp.dest, path: r.path, legs, t0: w.time, t1: w.time + sp.trip, hc: sp.hc};g.sys = null;
 event(w, `${g.name} が ${w.sector.systems[from].name} からハイパースペースへ（${w.sector.systems[sp.dest].name}まで ${Math.round(sp.trip / 60)} 分${r.legs.length > 1 ? `・${r.legs.length - 1} 星系経由` : ''}）`, {side: g.side, sys: from});
 // Enemies in the system see the departure and its heading.
 for (const sd of w.sides) if (sd.id !== g.side && sidePresent(w, sd.id, from)) noteContact(w, sd.id, g, {sys: sp.dest, transit: true, heading: sp.dest, eta: g.transit.t1});
}
function arriveGroup(w, g) {
 const tr = g.transit;g.transit = null;g.sys = tr.to;g.arrivedAt = w.time;deployGroup(w, g, tr.path?.[tr.path.length - 2] ?? tr.from);
 for (const id of g.units) { const u = w.units.get(id); if (!alive(u)) continue; u.warp = {t: 0}; for (const sid of u.squads) { const s = w.squads.get(sid); if (s && s.state === 'docked') { s.sys = g.sys; s.pos = [...u.pos]; } } }
 // A tower and its charge come out of hyperspace side by side.
 for (const id of g.units) { const u = w.units.get(id); if (alive(u) && u.tractor?.lock) { const t = w.units.get(u.tractor.target); if (t && t.group === g.id) { t.pos = add(u.pos, frameVec([Math.cos(u.yaw), 0, Math.sin(u.yaw)], [-(u.p.len + t.p.len) * .45, 0, (u.p.width || u.p.len * .4) + 300])); t.yaw = u.yaw; } } }
 seeSystem(w, g.side, g.sys);
 event(w, `${g.name} が ${w.sector.systems[g.sys].name} に到着`, {side: g.side, sys: g.sys});
 // Reverting to realspace leaves a disturbance other fleets nearby can read.
 for (const sd of w.sides) { if (sd.id === g.side) continue; let near = false; for (const u of w.units.values()) if (u.side === sd.id && alive(u) && u.sys != null && sysDistance(w.sector, u.sys, g.sys) <= RULES.wakeLy) { near = true; break; } if (near) noteContact(w, sd.id, g, {sys: g.sys, exact: sidePresent(w, sd.id, g.sys)}); }
}
// Where a group in hyperspace is on the map: along the leg it is flying.
function groupMapPos(w, g) {
 const S = w.sector;if (g.sys != null) return S.systems[g.sys].pos;const tr = g.transit;if (!tr) return [0, 0];
 const L = (tr.legs || []).find(l => w.time <= l.t1) || tr.legs?.[tr.legs.length - 1];if (!L) { const a = S.systems[tr.from].pos, b = S.systems[tr.to].pos, f = clamp((w.time - tr.t0) / Math.max(1, tr.t1 - tr.t0), 0, 1); return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; }
 const a = S.systems[L.a].pos, b = S.systems[L.b].pos, f = clamp((w.time - L.t0) / Math.max(1e-6, L.t1 - L.t0), 0, 1);return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}
const sidePresent = (w, side, sys) => { for (const u of w.units.values()) if (u.side === side && u.sys === sys && alive(u)) return true; return false; };
function seeSystem(w, side, sys) { w.sides[side].seen.set(sys, w.time); }
// ---- detection ----
// Ships see everything in their own system and, with long-range sensors,
// groups in systems within a few hundred light years. Groups in hyperspace
// cannot be seen; a departure is seen by enemies present.
function detect(w) {
 const S = w.sector;
 for (const sd of w.sides) {
  const eyes = [];for (const u of w.units.values()) if (u.side === sd.id && alive(u) && u.sys != null) eyes.push(u);
  const reach = new Map();for (const u of eyes) { const r = RULES.detectLy * (u.info?.sensor || 0) * (u.out ? .3 : 1); reach.set(u.sys, Math.max(reach.get(u.sys) || 0, r)); }
  for (const g of w.groups.values()) {
   if (g.side === sd.id || g.sys == null) continue;const us = g.units.map(id => w.units.get(id)).filter(alive);if (!us.length) continue;
   let seen = reach.has(g.sys), exact = seen;
   if (!seen) for (const [sys, r] of reach) if (r > 0 && sysDistance(S, sys, g.sys) <= r) { seen = true; break; }
   // Traffic control and informants on inhabited worlds report fleets in their system.
   if (!seen && S.systems[g.sys].inhabited && w.time - (g.arrivedAt ?? g.created) >= RULES.reportDelay) seen = true;
   if (seen) noteContact(w, sd.id, g, {sys: g.sys, exact});
  }
  for (const [gid, c] of sd.contacts) if (w.time - c.time > RULES.contactTTL) sd.contacts.delete(gid);
 }
}
function noteContact(w, side, g, o) {
 const us = g.units.map(id => w.units.get(id)).filter(alive), sd = w.sides[side], had = sd.contacts.get(g.id);
 const c = {gid: g.id, sys: o.sys, time: w.time, ships: us.length, capital: us.filter(u => u.info?.capital).length, strength: us.reduce((n, u) => n + unitStrength(u), 0), exact: !!o.exact, transit: !!o.transit, eta: o.eta || null, names: o.exact ? us.map(u => u.name) : null};
 sd.contacts.set(g.id, c);
 if (!had || had.sys !== c.sys) event(w, o.transit ? `敵部隊のハイパースペース航跡：${w.sector.systems[o.sys].name}方面へ` : `敵艦隊を探知：${w.sector.systems[o.sys].name}（${c.ships} 隻）`, {side, sys: o.sys, contact: true});
}

// ---------- battles ----------
// A system with ships of both sides is a battle. Ships fight as in the fleet
// model, with three additions: hull sections that break, squadrons that fly
// their wing's orders, and missile salvos that point defence can thin out.
function systemUnits(w, sys) { const out = []; for (const u of w.units.values()) if (u.sys === sys && alive(u)) out.push(u); return out; }
function updateBattles(w) {
 const bySys = new Map();
 for (const u of w.units.values()) { if (!alive(u) || u.sys == null) continue; let a = bySys.get(u.sys); if (!a) bySys.set(u.sys, a = new Set()); a.add(u.side); }
 for (const [sys, sides] of bySys) if (sides.size > 1 && !w.battles.has(sys)) { w.battles.set(sys, {sys, t0: w.time, log: [], sides: [...sides]}); event(w, `${w.sector.systems[sys].name}で交戦開始`, {sys, battle: true}); }
 for (const [sys, b] of w.battles) { const sides = bySys.get(sys); if (!sides || sides.size < 2) { w.battles.delete(sys); const win = sides ? [...sides][0] : null; event(w, `${w.sector.systems[sys].name}の戦闘終結${win != null ? '：' + w.sides[win].name + 'が宙域を確保' : ''}`, {sys, battle: true, end: true, winner: win}); for (const s of w.squads.values()) if (s.sys === sys && s.state === 'out') s.state = 'return'; } }
}
const blog = (w, sys, text, u) => { const b = w.battles.get(sys); const e = {n: w.evN = (w.evN || 0) + 1, t: w.time, text, side: u?.side, id: u?.id}; if (b) { b.log.push(e); if (b.log.length > 120) b.log.shift(); } w.events.push({...e, sys, combat: true}); if (w.events.length > 400) w.events.shift(); };

// Firepower (guns, missiles, carried craft) against what is left to destroy.
function targetValue(a) { const p = a.p, fire = (p.gunBest || 0) + .5 * (p.ionBest || 0) + .2 * (p.aa || 0) + 2 * (p.msl || 0) + (p.slots || 0) * 4 + 1; return fire / (Math.max(1, p.hp || 0) * Math.max(.05, unitStruct(a)) + Math.max(0, a.shield || 0) + 1); }
// Orders inside a battle. Ships follow their task group ('group'): the group's
// order, or on 自動交戦 the target its guide picks. A ship may also be given an
// order of its own (hold, move, attack, or 'auto' to pick its own target).
function bestTarget(w, us, from, side, worth, keep) {
 const foes = us.filter(t => t.side !== side && alive(t));if (!foes.length) return null;
 let tgt = null, best = Infinity, bestOut = true;
 for (const a of foes) { const out = !!a.out; if (out && !bestOut) continue; const dx = a.pos[0] - from.pos[0], dy = a.pos[1] - from.pos[1], dz = a.pos[2] - from.pos[2], sc = Math.sqrt(dx * dx + dy * dy + dz * dz) * (a.info?.capital === from.info?.capital ? 1 : 1.6) * worth.get(a.id) * (keep === a.id ? .75 : 1); if ((bestOut && !out) || sc < best) { tgt = a; best = sc; bestOut = out; } }
 return tgt;
}
function tacticalOrders(w, sys, us) {
 const worth = new Map(us.map(a => [a.id, Math.pow(1 / Math.max(1e-12, targetValue(a)), .35)]));
 const groups = new Map();for (const u of us) { const g = w.groups.get(u.group); if (g) groups.set(g.id, g); }
 for (const g of groups.values()) {
  // A group's ordered target that can no longer fight: back to engaging.
  if (g.order.type === 'attack') { const t = w.units.get(g.order.target); if (!t || !fighting(t) || t.side === g.side) g.order = {type: 'auto'}; }
  const ai = w.sides[g.side].ai || g.order.type === 'auto';if (!ai) continue;
  const members = g.units.map(id => w.units.get(id)).filter(u => u && u.sys === sys && fighting(u) && !u.manual && !u.jump);if (!members.length) continue;
  const guide = members.find(u => u.id === g.flag) || members[0], tgt = bestTarget(w, us, guide, g.side, worth, g.auto?.target);
  g.auto = tgt ? {type: 'attack', target: tgt.id} : {type: 'hold'};
 }
 for (const u of us) {
  if (u.manual || u.out || u.jump) continue;const side = w.sides[u.side];
  // Badly damaged AI ships with a hyperdrive leave.
  if (side.ai && unitStruct(u) < .28 && unitHyper(u) != null && !u.leaving) { u.leaving = true; aiWithdrawUnit(w, u); continue; }
  if (u.order.type !== 'auto') continue;
  const tgt = bestTarget(w, us, u, u.side, worth, u.auto?.target);u.auto = tgt ? {type: 'attack', target: tgt.id} : {type: 'hold'};
 }
}
function groupOrder(w, g) { if (!g) return {type: 'hold'}; return g.order.type === 'auto' ? (g.auto || {type: 'hold'}) : g.order; }
function effectiveOrder(u, w) {
 if (u.order.type === 'auto') return u.auto || {type: 'hold'};
 if (u.order.type !== 'group') return u.order;
 const g = w && w.groups.get(u.group);return g ? groupOrder(w, g) : (u.auto || {type: 'hold'});
}
// Stations of the ships following their group: the guide (flagship) takes the
// group's position — its fighting station off the target, the point ordered,
// or where it stood when told to hold — and the rest their places in the
// formation around it, the formation facing the target or the way it moves.
function groupStations(w, sys, us, byId) {
 const plan = new Map(), groups = new Map();
 for (const u of us) { if (u.manual || u.out || u.jump || u.warp || u.towedBy || u.order.type !== 'group') continue; const g = w.groups.get(u.group); if (!g) continue; let a = groups.get(g.id); if (!a) groups.set(g.id, a = {g, m: []}); a.m.push(u); }
 for (const {g, m} of groups.values()) {
  m.sort((a, b) => g.units.indexOf(a.id) - g.units.indexOf(b.id));const gi = m.findIndex(u => u.id === g.flag);if (gi > 0) m.unshift(m.splice(gi, 1)[0]);
  const guide = m[0], o = groupOrder(w, g), offs = formationOffsets(g.formation, m), vmax = Math.min(...m.map(u => u.p.maxSpeed || 1e9));
  let anchor, fw, t = null, sd = 0;
  if (o.type === 'attack' && (t = byId.get(o.target)) && t.sys === sys) {
   const dist = len(sub(t.pos, guide.pos));sd = Math.min(C.fleetStandoff(guide, t), Math.max((guide.p.len + t.p.len) * .7, dist));
   anchor = attackStation(guide, t, sd);fw = norm([t.pos[0] - guide.pos[0], 0, t.pos[2] - guide.pos[2]]);
  } else if (o.type === 'move' && o.point) { t = null; anchor = o.point; fw = o.dir || norm([o.point[0] - guide.pos[0], 0, o.point[2] - guide.pos[2]]); }
  else { t = null; if (!g.holdPos || g.holdSys !== sys) { g.holdPos = [...guide.pos]; g.holdFw = [Math.cos(guide.yaw), 0, Math.sin(guide.yaw)]; g.holdSys = sys; } anchor = g.holdPos; fw = g.holdFw; }
  if (!(len(fw) > 0)) fw = [Math.cos(guide.yaw), 0, Math.sin(guide.yaw)];
  m.forEach((u, i) => plan.set(u.id, {dest: add(anchor, frameVec(fw, offs[i])), target: t, sd, fw, guide: i === 0, vmax, attack: !!t}));
 }
 return plan;
}
// ---- tractor beams ----
// A ship with tractor projectors locks onto a disabled ship within reach and
// carries it: a friendly ship to be towed out (also through hyperspace), or an
// enemy ship whose shields are down, which boarders take after a while.
const tractorReach = (u, t) => 2500 + (u.p.len + t.p.len) * .5;
function tractorOk(u, t, mode) { if (!u || !t || u === t || !alive(u) || !alive(t) || u.out || !(u.p.trac > 0)) return false; if (mode === 'tow') return t.side === u.side && !!t.out; return t.side !== u.side && !!t.out && !(t.shield > 1); }
function releaseTractor(w, u, why) { const tr = u.tractor;if (!tr) return;const t = w.units.get(tr.target);if (t && t.towedBy === u.id) t.towedBy = null;u.tractor = null;if (why && u.sys != null) blog(w, u.sys, `${u.name}：牽引ビームを解除（${why}）`, u); }
function captureShip(w, u, t) {
 const old = t.side, g = w.groups.get(u.group), og = w.groups.get(t.group);
 if (og) og.units = og.units.filter(x => x !== t.id);t.origSide = t.origSide ?? old;t.side = u.side;t.team = u.team;t.captured = true;t.order = {type: 'group', fire: false, power: 'auto', aim: 'auto'};
 if (g) { g.units.push(t.id); t.group = g.id; }
 for (const sid of t.squads) { const q = w.squads.get(sid); if (q && q.state === 'docked') { q.state = 'lost'; q.n = 0; } }
 w.sides[old].lost++;w.sides[u.side].captured = (w.sides[u.side].captured || 0) + 1;u.tractor.mode = 'tow';u.tractor.progress = 1;
 blog(w, u.sys, `${u.name}：${t.name}を拿捕`, u);event(w, `${t.name} を拿捕（${u.name}）`, {side: u.side, sys: u.sys, captured: true});
}
function tractorTick(w, u, dt) {
 const tr = u.tractor, t = w.units.get(tr?.target);if (!tr) return;
 if (!t || t.dead || u.dead || u.out || t.sys !== u.sys || u.sys == null) { releaseTractor(w, u, !t || t.dead ? '目標を失った' : '牽引艦が損傷'); return; }
 if (!tr.lock) {
  if (!tractorOk(u, t, tr.mode)) { releaseTractor(w, u, '条件を満たさない'); return; }
  if (!w.battles.has(u.sys) || len(sub(t.pos, u.pos)) <= tractorReach(u, t)) { if (t.towedBy && t.towedBy !== u.id) { releaseTractor(w, u, '他艦が牽引中'); return; } tr.lock = true; t.towedBy = u.id; const c = Math.cos(-u.yaw), s = Math.sin(-u.yaw), d = sub(t.pos, u.pos); tr.off = [d[0] * c - d[2] * s, d[1], d[0] * s + d[2] * c]; if (!w.battles.has(u.sys)) tr.off = [-(u.p.len + t.p.len) * .45, 0, (u.p.width || u.p.len * .4) + 300]; tr.dyaw = t.yaw - u.yaw; blog(w, u.sys, `${u.name}：${t.name}を牽引ビームで捕捉`, u); }
  return;
 }
 t.pos = add(u.pos, frameVec([Math.cos(u.yaw), 0, Math.sin(u.yaw)], tr.off));t.velocity = [...u.velocity];t.yaw = u.yaw + (tr.dyaw || 0);
 if (tr.mode === 'capture' && t.side !== u.side) {
  if (t.shield > 1 && !t.out) { releaseTractor(w, u, '目標が復旧'); return; }
  const boarders = (u.troops || 0) + (u.crew || 0) * .04, defenders = (t.crew || 0) * .25, rate = clamp((boarders + 50) / (defenders + 100), .1, 3) / 90;
  tr.progress = (tr.progress || 0) + rate * dt;if (tr.progress >= 1) captureShip(w, u, t);
 }
}
function battleTick(w, sys, dt) {
 const us = systemUnits(w, sys), byId = new Map(us.map(u => [u.id, u])), sysOf = new Map(us.map(u => [u.id, C.fleetSystems(u)]));
 const DMG = RULES.damage, inc = new Map(us.map(u => [u.id, C.combatIncoming()])), plan = groupStations(w, sys, us, byId);
 // --- movement (as in the fleet model; arriving ships hang still for a moment after reversion)
 for (const u of us) {
  if (u.manual) continue;const s = sysOf.get(u.id);
  if (u.warp) { u.warp.t += dt; if (u.warp.t > 1) delete u.warp; continue; }
  if (u.towedBy) continue;
  // Disabled: the planet pulls it down until it burns up (C.hullFall), unless a beam holds it.
  if (u.out) { if (C.hullFall(u, dt, w.rand)) lostToGravity(w, sys, u); continue; }
  // Courses are planned on the engines' rated thrust (acc0); the reactor share they actually get (engF) decides what they deliver.
  const load = u.tractor?.lock ? (() => { const t = byId.get(u.tractor.target); return t ? u.info.mass / Math.max(1, u.info.mass + (t.info?.mass || 0)) : 1; })() : 1;
  const acc0 = u.p.accel * s.engine * (.6 + .4 * unitStruct(u)) * load, acc = acc0 * clamp(u.engF ?? 1, 0, 1.2);
  let dest = null, head = null, speedCap = u.p.maxSpeed, near = 2000, attack = false;
  if (u.jump) {
   // Spooling the hyperdrive: no fire, and the ship opens the range from the enemy.
   let cx = 0, cz = 0, n = 0;for (const x of us) if (x.side !== u.side && fighting(x)) { cx += x.pos[0]; cz += x.pos[2]; n++; }
   if (n) { const away = norm([u.pos[0] - cx / n, 0, u.pos[2] - cz / n]); dest = add(u.pos, scale(away, 30000)); head = Math.atan2(away[2], away[0]); }
  } else if (u.tractor && !u.tractor.lock && byId.get(u.tractor.target)) {
   const t = byId.get(u.tractor.target), d = sub(u.pos, t.pos), l = len(d) || 1;dest = add(t.pos, scale(d, tractorReach(u, t) * .55 / l));attack = true;
  } else {
   const pl = plan.get(u.id), o = effectiveOrder(u, w);
   if (pl) {
    dest = pl.dest;speedCap = pl.guide ? pl.vmax : pl.vmax * 1.12;attack = pl.attack;
    const t = pl.target, dd = len(sub(dest, u.pos));
    if (dd > near) head = null;
    else if (t) { const d = len(sub(t.pos, u.pos)); head = pl.guide ? C.fleetHeading(u, t, d, pl.sd) : (C.fleetBroadside(u.p, pl.sd) && d < pl.sd * 1.6 ? Math.atan2(t.pos[2] - u.pos[2], t.pos[0] - u.pos[0]) - C.fleetBroadside(u.p, pl.sd) * Math.PI / 2 : Math.atan2(t.pos[2] - u.pos[2], t.pos[0] - u.pos[0])); }
    else head = Math.atan2(pl.fw[2], pl.fw[0]);
   } else {
    const t = byId.get(o.target), at = o.type === 'attack' && t, sd = at ? Math.min(C.fleetStandoff(u, t), Math.max((u.p.len + t.p.len) * .7, len(sub(t.pos, u.pos)))) : 0;
    dest = o.type === 'move' ? o.point : at ? attackStation(u, t, sd) : null;attack = !!at;
    if (at) head = C.fleetHeading(u, t, len(sub(t.pos, u.pos)), sd);
   }
  }
  let want = [0, 0, 0], turned = 0;
  // A ship blocked from its target by one of its own climbs or dives off the line of fire.
  if (dest && u.dodge && w.time < u.dodge.until) dest = [dest[0], clamp(dest[1] + u.dodge.dy, -15000, 15000), dest[2]];
  if (dest) {
   const delta = sub(dest, u.pos), d = len(delta), yaw = head ?? Math.atan2(delta[2], delta[0]), err = angle(yaw - u.yaw), dy = clamp(err, -u.p.turnRate * dt, u.p.turnRate * dt);u.yaw += dy;turned = dy;u.broadside = head != null && attack;
   // What the ship carries turns with its bow (it does not slide sideways through a turn).
   C.hullCarve(u, dy);
   const remaining = Math.max(0, d - (attack ? 400 : 150));
   // Closing on a ship that may be closing too, plan to stop with half the deceleration.
   const speed = Math.min(speedCap * (u.broadside && d < near ? .4 : 1), Math.sqrt((attack ? 1 : 2) * acc0 * remaining)) * Math.max(.08, Math.cos(err));
   if (d > 1) {
    // Near its station a ship only closes on it when the station lies ahead (it does not wander off chasing a point abeam).
    const hd = hyp(delta[0], delta[2]), ahead = hd > 1 ? (delta[0] * Math.cos(u.yaw) + delta[2] * Math.sin(u.yaw)) / hd : 1;
    want = scale(norm(delta), speed);const hor = hyp(want[0], want[2]) * (d < near ? clamp(ahead, 0, 1) : 1);want[0] = Math.cos(u.yaw) * hor;want[2] = Math.sin(u.yaw) * hor;
   }
  }
  want = C.hullAvoid(u, us, want);
  u.turnK = clamp(turned / Math.max(1e-6, u.p.turnRate * dt), -1, 1);
  const y0 = u.pos[1], dv = sub(want, u.velocity), n = len(dv), step = Math.min(n, acc * dt);u.velocity = add(u.velocity, scale(dv, step / Math.max(1e-9, n)));u.pos = add(u.pos, u.velocity, dt);
  // The battle is fought in a band of altitude; a ship that went below it (to take a falling ship in tow) climbs back on its own.
  const tow = u.tractor ? w.units.get(u.tractor.target) : null, floor = tow ? Math.min(-15000, tow.pos[1] - 3000) : y0 < -15000 ? y0 : -15000;
  u.pos[1] = clamp(u.pos[1], floor, 15000);if (u.pos[1] < -15000 && !tow && u.velocity[1] < 40) u.velocity[1] = Math.min(u.velocity[1] + acc * dt, 40);
  u.maneuver = acc0 > 0 ? clamp(n / (acc0 * dt), 0, 1) : 0;
  const o = effectiveOrder(u, w);if (u.order.type === 'move' && o.point && len(sub(o.point, u.pos)) < Math.max(10, acc * dt * dt) && len(u.velocity) < acc * dt * 2) { u.pos = [...o.point]; u.velocity = [0, 0, 0]; }
 }
 // Hulls that meet are pushed apart, and the impact damages both (C.hullCollide).
 const contacts = C.hullCollide(us.filter(u => !u.warp), {skip: (a, z) => a.towedBy === z.id || z.towedBy === a.id, fixed: u => !!u.towedBy});
 for (const c of contacts) { C.hullImpact(inc.get(c.a.id), c.a, c.z, c); C.hullImpact(inc.get(c.z.id), c.z, c.a, c); if (c.vn > C.HULL_HIT.min) { c.a.lastBump = c.z.lastBump = {t: w.time, point: c.point, vn: c.vn, a: c.a.id, z: c.z.id}; if (c.vn > 5 && w.time - (c.a.bumpLog || -99) > 6) { c.a.bumpLog = w.time; blog(w, sys, `${c.a.name}と${c.z.name}が衝突（相対速度 ${Math.round(c.vn)} m/s）`, c.a); } } }
 for (const u of us) if (u.tractor) tractorTick(w, u, dt);
 // --- gunnery and power
 for (const u of us) {
  if (u.manual || u.warp) continue;const o = effectiveOrder(u, w), p = u.p, s = sysOf.get(u.id), crewEff = C.fleetCrewEff(u), reach = C.fleetReach(p);
  const foes = us.filter(x => x.side !== u.side && !x.warp), live = foes.filter(x => !x.out), pool = live.length ? live : foes;
  // Guns fire by range band: the ordered target if any band reaches it, else the nearest enemy in reach.
  // A ship spooling its hyperdrive has its reactor on the drive and does not fire.
  let t = null, raw = 0, F = null, distance = 0;
  u.blocked = null;
  if (!u.out && !u.jump && u.order.fire !== false) { t = byId.get(o.target); if (!t || t.side === u.side || t.warp) t = nearestOf(pool, u.pos); if (t && len(sub(t.pos, u.pos)) > reach) { const n = nearestOf(pool, u.pos); t = n && len(sub(n.pos, u.pos)) <= reach ? n : null; }
   // A ship of our own across the line of fire: another target in reach with a clear line, or hold fire and move off the line.
   if (t) { const bl = C.fireBlocker(us, u, t); if (bl) { let alt = null, bd = Infinity; for (const x of pool) { if (x === t) continue; const dd = len(sub(x.pos, u.pos)); if (dd <= reach && dd < bd && !C.fireBlocker(us, u, x)) { alt = x; bd = dd; } } if (!alt) { u.blocked = bl.id; if (!u.dodge || w.time > u.dodge.until) { const dy = u.pos[1] - bl.pos[1], sg = Math.abs(dy) > 200 ? Math.sign(dy) : (String(u.id).charCodeAt(String(u.id).length - 1) & 1 ? 1 : -1); u.dodge = {dy: sg * Math.max(900, ((u.p.height || u.p.len * .2) + (bl.p.height || bl.p.len * .2)) * 1.4), until: w.time + 25}; } } t = alt; } }
   if (t) { distance = len(sub(t.pos, u.pos)); F = C.fleetFire(u, t, distance); raw = F.cost * s.weapon; } }
  u.firingAt = t ? t.id : null;u.lastShot = null;
  const fire = C.fleetPowerStep(u, s, t, raw, dt);
  if (!t || u.out) continue;
  const aim = u.order.aim && u.order.aim !== 'auto' ? u.order.aim : null;
  const hit = p.acc * F.fall * crewEff * (.6 + .4 * s.fire) * (aim ? .8 : 1), gun = F.gun * s.weapon * fire * hit, ion = F.ion * s.weapon * fire * hit;
  const x = inc.get(t.id), hd = dt * DMG, dealt = (gun + ion) * hd;C.combatAdd(x, t, u.pos, {sf: (gun + C.COMBAT.ionShield * ion) * hd, hull: (gun + C.COMBAT.ionHull * ion) * hd, ion: ion * hd}, aim, u.id);
  u.dmgDone += dealt;u.shots = (u.shots || 0) + (gun + ion) * dt;if (gun + ion > 0) u.lastShot = {to: t.id, gun: (gun + ion) * dt, ion: ion > gun};
  // What misses may strike a ship of our own close to the target (friendly fire).
  const miss = Math.max(0, 1 - hit);
  if (miss > 0 && F.gun + F.ion > 0) for (const {x, k} of C.fireStray(us, u, t, distance)) { const g2 = F.gun * s.weapon * fire * miss * k, i2 = F.ion * s.weapon * fire * miss * k; if (!(g2 + i2 > 0)) continue; C.combatAdd(inc.get(x.id), x, u.pos, {sf: (g2 + C.COMBAT.ionShield * i2) * hd, hull: (g2 + C.COMBAT.ionHull * i2) * hd, ion: i2 * hd}, null, u.id); x.ffTaken = (x.ffTaken || 0) + (g2 + i2) * hd; if (u.lastShot) u.lastShot.ff = {to: x.id, gun: (g2 + i2) * dt}; if (w.time - (x.ffLog || -99) > 20) { x.ffLog = w.time; blog(w, sys, `${x.name}：味方の${u.name}の流れ弾を受けた`, x); } }
 }
 // --- missiles: launch, flight, point defence, impact
 for (const u of us) {
  if (u.manual || u.out || u.warp || u.jump || !(u.p.msl > 0)) continue;const o = effectiveOrder(u, w), want = byId.get(o.target);
  let t = want && want.side !== u.side && !want.warp ? want : null;if (!t) { let bd = Infinity; for (const x of us) { if (x.side === u.side || x.warp || x.out) continue; const d = len(sub(x.pos, u.pos)); if (d < bd) { bd = d; t = x; } } }
  if (!t || len(sub(t.pos, u.pos)) > RULES.missileRange) continue;
  const mods = u.p.modules || [];u.mslT = (u.mslT || 0) - dt;if (u.mslT > 0) continue;u.mslT = 20;
  const tubes = mods.map((m, i) => m.k === 'launcher' && u.mods[i] > 0 && u.ammo[i] >= 8 ? i : -1).filter(i => i >= 0), total = mods.filter(m => m.k === 'launcher').length;
  let n = 0;if (!total) n = Math.round(u.p.msl / 10);else for (const i of tubes) { u.ammo[i] -= 8; n += 8; }
  if (n > 0) w.missiles.push({id: 'm' + (w.nextId++), side: u.side, sys, from: u.id, target: t.id, n, pos: add(u.pos, [0, u.p.height ? u.p.height * .3 : 50, 0]), vel: scale(norm(sub(t.pos, u.pos)), 220), s: 220, life: 45});
 }
 for (const m of w.missiles) {
  if (m.sys !== sys || m.n <= 0) continue;const t = byId.get(m.target);if (!t) { m.life = 0; continue; }
  const rel = sub(t.pos, m.pos), d = len(rel);m.s = Math.min(2600, m.s + 650 * dt);m.vel = scale(norm(add(rel, t.velocity || [0, 0, 0], d / Math.max(300, m.s))), m.s);m.pos = add(m.pos, m.vel, dt);m.life -= dt;
  // Every enemy ship within reach adds its point defence, weighted by the arc facing the salvo.
  let kill = 0;for (const x of us) { if (x.side === m.side || x.warp || x.manual) continue; const r = len(sub(m.pos, x.pos)); if (r > RULES.pdRange + x.p.len * .5) continue; kill += RULES.pdMissile * pdToward(x, m.pos) * sysOf.get(x.id).weapon * C.fleetCrewEff(x) * dt; }
  if (kill > 0) { const k = Math.min(m.n, kill * (1 + (w.rand() - .5) * .4)); m.n -= k; m.downed = (m.downed || 0) + k; }
  if (m.n < .5) { m.n = 0; continue; }
  if (d < Math.max(300, t.p.len * .4)) { const tt = m.n * RULES.missileTT * DMG; C.combatAdd(inc.get(t.id), t, m.pos, {sf: .5 * tt, hull: .5 * tt, direct: .5 * tt}, null, m.from); m.hit = m.n; m.n = 0; const src = byId.get(m.from); if (src) src.dmgDone += tt; }
  else if (m.life <= 0) m.n = 0;
 }
 w.missiles = w.missiles.filter(m => m.n > 0 && m.life > 0 || m.sys !== sys);
 // --- small craft
 craftTick(w, sys, us, byId, sysOf, inc, dt);
 // --- damage to hulls and modules
 const ctx = combatCtx(w, sys);for (const u of us) applyDamage(w, sys, u, inc.get(u.id), dt, sysOf.get(u.id), ctx);
}
// Where a ship attacks from: level with its target, or below it when its
// batteries bear best upward (dorsal mounts), above when they bear downward.
// The station is at fighting range on the line from the target toward the ship.
function attackStation(u, t, sd) {
 const a = u.p.gunArcs || [], side = Math.max(a[2] || 0, a[3] || 0, a[0] || 0), up = a[4] || 0, dn = a[5] || 0;
 const range = sd || C.fleetStandoff(u, t), k = up > side * 1.15 && up >= dn ? -.6 : dn > side * 1.15 ? .6 : 0;
 const dx = u.pos[0] - t.pos[0], dz = u.pos[2] - t.pos[2], h = hyp(dx, dz) || 1, hd = range / Math.sqrt(1 + k * k);
 return [t.pos[0] + dx / h * hd, clamp(t.pos[1] + k * hd, -15000, 15000), t.pos[2] + dz / h * hd];
}
// Point-defence rating a ship brings to bear toward a point (its arc share).
function pdToward(u, pt) {
 const a = u.p.aaArcs;if (!a || !(a[0] > 0 || a[1] > 0 || a[2] > 0 || a[3] > 0 || a[4] > 0 || a[5] > 0)) return u.p.aa || 0;
 const dx = pt[0] - u.pos[0], dy = pt[1] - u.pos[1], dz = pt[2] - u.pos[2], c = Math.cos(u.yaw), s = Math.sin(u.yaw), vx = dx * c + dz * s, vz = -dx * s + dz * c;
 const w0 = vx > 0 ? vx : 0, w1 = vx < 0 ? -vx : 0, w2 = vz > 0 ? vz : 0, w3 = vz < 0 ? -vz : 0, w4 = dy > 0 ? dy : 0, w5 = dy < 0 ? -dy : 0, sum = w0 + w1 + w2 + w3 + w4 + w5 || 1;
 return (w0 * (a[0] || 0) + w1 * (a[1] || 0) + w2 * (a[2] || 0) + w3 * (a[3] || 0) + w4 * (a[4] || 0) + w5 * (a[5] || 0)) / sum;
}
// The nearest of a list of ships to a point (null for none).
function nearestOf(list, p) { let best = null, bd = Infinity; for (const x of list) { const dx = x.pos[0] - p[0], dy = x.pos[1] - p[1], dz = x.pos[2] - p[2], d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; best = x; } } return best; }
// A wing on automatic orders covers its carrier (the AI's wings get the AI's orders).
function wingOrder(w, wing) { const o = wing?.order || {type: 'standby'}; if (o.type !== 'auto') return o; return wing.auto || {type: 'escort', target: wing.home}; }
// The bearing in a ship's frame from which an attack run comes in.
const APPROACH = {bow: [1, 0, 0], stern: [-1, 0, 0], stbd: [0, 0, 1], port: [0, 0, -1], above: [0, 1, 0], below: [0, -1, 0]};
const APPROACH_NAME = {bow: '艦首', stern: '艦尾', stbd: '右舷', port: '左舷', above: '上方', below: '下方'};
const shipToWorld = (u, v) => { const c = Math.cos(u.yaw), s = Math.sin(u.yaw); return [v[0] * c - v[2] * s, v[1], v[0] * s + v[2] * c]; };

// Squadrons fly as their wing (飛行隊): the wing's squadrons launch together at
// the hangar's rate, form up off the carrier, then fly the wing's order as one
// formation — strike runs from the bearing ordered, combat air patrol or
// escort — and return together to rearm. Dogfights and point defence still
// wear each squadron down by itself.
const WING_PHASE = {docked: '艦内', form: '発艦・集合', go: '進撃', run: '攻撃航過', egress: '離脱', on: '任務中', return: '帰還'};
function craftTick(w, sys, us, byId, sysOf, inc, dt) {
 const sq = [];for (const s of w.squads.values()) if (s.sys === sys && s.state !== 'lost' && s.state !== 'stranded') sq.push(s);
 if (!sq.length) return;
 const wings = new Map();for (const s of sq) { const wg = w.wings.get(s.wing); if (!wg) continue; let a = wings.get(wg.id); if (!a) wings.set(wg.id, a = {wing: wg, list: []}); a.list.push(s); }
 // Where each wing's aircraft are (for wings hunting each other).
 const centres = [];
 for (const {wing, list} of wings.values()) { let x = 0, y = 0, z = 0, n = 0; for (const s of list) if (s.state === 'out' && s.n > 0) { x += s.pos[0] * s.n; y += s.pos[1] * s.n; z += s.pos[2] * s.n; n += s.n; } if (n > 0) { wing.c = [x / n, y / n, z / n]; wing.nOut = n; centres.push(wing); } else { wing.c = null; wing.nOut = 0; } }
 for (const {wing, list} of wings.values()) {
  const home = byId.get(wing.home), o = wingOrder(w, wing), active = w.battles.has(sys) && home && !home.out && !home.jump && !wing.recall && ['strike', 'cap', 'escort'].includes(o.type);
  for (const s of list) {
   if (s.state === 'docked') { if (home) s.pos = [...home.pos]; if (s.t > 0) s.t -= dt; continue; }
   if (s.state === 'return') { if (!home || home.dead || home.sys !== sys) { s.state = 'lost'; s.n = 0; continue; } if (len(sub(home.pos, s.pos)) < Math.max(400, home.p.len * .5)) { s.state = 'docked'; s.t = RULES.craftRearm; s.runs = 0; continue; } steer(s, home.pos, CRAFT[s.craft].speed, dt); }
  }
  const out = list.filter(s => s.state === 'out' && s.n > 0);
  if (!active) { for (const s of out) s.state = 'return'; wing.phase = list.some(s => s.state === 'return') ? 'return' : 'docked'; continue; }
  // Launch: the wing's rearmed squadrons go out one after another at the carrier's hangar rate.
  const ready = list.filter(s => s.state === 'docked' && !(s.t > 0) && s.n > 0);
  if (ready.length && !out.length && wing.phase !== 'form') { wing.phase = 'form'; wing.formT = w.time; }
  if (ready.length && wing.phase === 'form') {
   const rate = Math.max(.05, (home.p.launch || 1) * (sysOf.get(home.id)?.hangar ?? 1));home.launchQ = home.launchQ || 0;
   if (home.launchQ > 0) home.launchQ -= dt;
   else { const s = ready[0], c = CRAFT[s.craft]; home.launchQ = s.n * c.size / rate; s.state = 'out'; s.pos = add(home.pos, [0, -home.p.height * .3 || -60, 0]); s.h = [Math.cos(home.yaw), 0, Math.sin(home.yaw)]; s.runs = 0; s.ran = false; s.launched = w.time; }
  }
  if (!out.length) continue;
  // Form up off the carrier's beam until the wing is out (or a minute and a half has passed).
  const lead = out.slice().sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0))[0], hd = norm([lead.h[0], 0, lead.h[2]]);
  if (wing.phase === 'form') { const rally = add(home.pos, shipToWorld(home, [0, 1200, (home.p.width || home.p.len * .4) + 3500])); const gathered = out.every(s => len(sub(s.pos, rally)) < 3000); if ((!ready.length && gathered) || w.time - (wing.formT || 0) > 90) wing.phase = o.type === 'strike' ? 'go' : 'on'; else { steerWing(out, rally, hd, dt, 1); continue; } }
  if (wing.phase === 'docked' || wing.phase === 'return') wing.phase = o.type === 'strike' ? 'go' : 'on';
  let goal = null, engageR = 0, tight = 1;
  if (o.type === 'strike') {
   const t = byId.get(o.target);if (!t || t.dead || t.side === wing.side) { for (const s of out) s.state = 'return'; wing.phase = 'return'; continue; }
   if (wing.phase === 'on') wing.phase = 'go';
   const ap = APPROACH[o.approach] || APPROACH.bow, ip = add(t.pos, shipToWorld(t, scale(ap, 12000 + t.p.len * .6))), c = wing.c || lead.pos;
   if (wing.phase === 'go') { goal = ip; if (len(sub(ip, c)) < 2500) { wing.phase = 'run'; for (const s of out) s.ran = false; } }
   else if (wing.phase === 'run') { goal = t.pos; tight = .45;
    // Attack run: each squadron releases (bombers) or strafes (fighters) as it passes the target.
    for (const s of out) if (!s.ran && len(sub(t.pos, s.pos)) < Math.max(900, t.p.len * .45)) { const c2 = CRAFT[s.craft], tt = s.n * c2.strike * RULES.damage, x = inc.get(t.id); if (x) C.combatAdd(x, t, s.pos, {sf: .7 * tt, hull: .7 * tt, direct: .3 * tt}, o.aim && o.aim !== 'auto' ? o.aim : null, s.home); s.ran = true; s.runs++; s.dmg = (s.dmg || 0) + tt; }
    if (out.every(s => s.ran) || len(sub(t.pos, c)) < Math.max(700, t.p.len * .3)) { wing.phase = 'egress'; wing.egress = add(t.pos, shipToWorld(t, scale(ap, -9000 - t.p.len * .5))); } }
   else { goal = wing.egress || ip; if (len(sub(goal, c)) < 2500) { if (out.some(s => CRAFT[s.craft].role === 'bomber')) { for (const s of out) s.state = 'return'; wing.phase = 'return'; continue; } wing.phase = 'go'; } }
   engageR = out.every(s => CRAFT[s.craft].role === 'bomber') ? 0 : 3000;
  } else if (o.type === 'cap') { goal = o.point || home.pos; engageR = (o.radius || 15000) + 4000; }
  else { const e = byId.get(o.target) || home; goal = add(e.pos, [0, e.p.height * .8 || 300, 0]); engageR = 9000; }
  // Wings hunt enemy wings near their goal (patrol, escort) or near themselves (strike escorts).
  if (engageR > 0 && wing.phase !== 'run') { const ref = o.type === 'strike' ? (wing.c || lead.pos) : goal; let best = null, bd = engageR * engageR; for (const e of centres) { if (e.side === wing.side || !e.c) continue; const dx = e.c[0] - ref[0], dy = e.c[1] - ref[1], dz = e.c[2] - ref[2], d2 = dx * dx + dy * dy + dz * dz; if (d2 < bd) { bd = d2; best = e; } } wing.engaged = best ? best.id : null; if (best) { goal = best.c; tight = .6; } } else wing.engaged = null;
  steerWing(out, goal, hd, dt, tight);
 }
 // Dogfights: a squadron is worn down by the air-to-air strength of every
 // enemy squadron in the 4.5 km cube around it (cells of 1.5 km, summed per
 // side), so a swarm of thousands costs no more than a handful.
 const air = sq.filter(s => s.state === 'out' && s.n > 0), N = air.length, nS = w.sides.length, DFC = 1500, cells = new Map(), near = new Map(), key = (i, j, k) => ((i & 1023) << 20) | ((j & 1023) << 10) | (k & 1023);
 const P = new Float64Array(N * 3), side = new Int8Array(N), soft = new Float64Array(N), cellOf = new Int32Array(N), loss = new Float64Array(N);
 for (let n = 0; n < N; n++) { const s = air[n], c = CRAFT[s.craft], x = s.pos[0], y = s.pos[1], z = s.pos[2], kk = key(Math.floor(x / DFC), Math.floor(y / DFC), Math.floor(z / DFC));P[n * 3] = x;P[n * 3 + 1] = y;P[n * 3 + 2] = z;side[n] = s.side;soft[n] = 1 / c.armor;cellOf[n] = kk;let e = cells.get(kk); if (!e) cells.set(kk, e = new Float64Array(nS)); e[s.side] += s.n * c.aa; }
 for (let n = 0; n < N; n++) {
  const kk = cellOf[n];let e = near.get(kk);
  if (!e) { e = new Float64Array(nS); const i = Math.floor(P[n * 3] / DFC), j = Math.floor(P[n * 3 + 1] / DFC), k = Math.floor(P[n * 3 + 2] / DFC); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) { const q = cells.get(key(i + a, j + b, k + c)); if (q) for (let t = 0; t < nS; t++) e[t] += q[t]; } near.set(kk, e); }
  let foe = 0;for (let t = 0; t < nS; t++) if (t !== side[n]) foe += e[t];
  if (foe > 0) { loss[n] = RULES.dogfight * foe * soft[n] * dt; air[n].dogfight = w.time; }
 }
 // Point defence on craft near enemy ships.
 for (const x of us) {
  if (x.warp || x.manual) continue;const k = RULES.pdCraft * sysOf.get(x.id).weapon * C.fleetCrewEff(x) * dt, lim2 = (RULES.pdRange + x.p.len * .5) ** 2, px = x.pos[0], py = x.pos[1], pz = x.pos[2], a = x.p.aaArcs, arcs = a && (a[0] > 0 || a[1] > 0 || a[2] > 0 || a[3] > 0 || a[4] > 0 || a[5] > 0), cy = Math.cos(x.yaw), sy = Math.sin(x.yaw), flat = x.p.aa || 0, xs = x.side;
  if (!(k > 0) || !(arcs || flat > 0)) continue;
  const a0 = arcs ? a[0] || 0 : 0, a1 = arcs ? a[1] || 0 : 0, a2 = arcs ? a[2] || 0 : 0, a3 = arcs ? a[3] || 0 : 0, a4 = arcs ? a[4] || 0 : 0, a5 = arcs ? a[5] || 0 : 0;
  for (let n = 0; n < N; n++) { if (side[n] === xs) continue; const dx = P[n * 3] - px, dy = P[n * 3 + 1] - py, dz = P[n * 3 + 2] - pz; if (dx * dx + dy * dy + dz * dz > lim2) continue;
   let r = flat;if (arcs) { const vx = dx * cy + dz * sy, vz = -dx * sy + dz * cy, w0 = vx > 0 ? vx : 0, w1 = vx < 0 ? -vx : 0, w2 = vz > 0 ? vz : 0, w3 = vz < 0 ? -vz : 0, w4 = dy > 0 ? dy : 0, w5 = dy < 0 ? -dy : 0; r = (w0 * a0 + w1 * a1 + w2 * a2 + w3 * a3 + w4 * a4 + w5 * a5) / (w0 + w1 + w2 + w3 + w4 + w5 || 1); }
   loss[n] += k * r * soft[n]; } }
 for (let n = 0; n < N; n++) { if (!(loss[n] > 0)) continue; const s = air[n], k = Math.min(s.n, loss[n] * (1 + (w.rand() - .5) * .5)); s.n -= k; s.lostN = (s.lostN || 0) + k; if (s.n < .5) { s.n = 0; s.state = 'lost'; blog(w, sys, `${s.name} 全滅`, {side: s.side}); } }
}
// A wing's squadrons in a loose vee behind the leader, each heading for its place.
function steerWing(out, goal, hd, dt, tight = 1) {
 const right = [-hd[2], 0, hd[0]], vmin = Math.min(...out.map(s => CRAFT[s.craft].speed));
 for (const s of out) { const k = s.slot ?? 0, row = Math.ceil(k / 2), sg = k % 2 ? 1 : -1, off = add(scale(hd, -row * 420 * tight), right, sg * row * 520 * tight), g = add(goal, off), lag = len(sub(g, s.pos)); steer(s, g, Math.min(CRAFT[s.craft].speed, vmin * (lag > 1500 ? 1.15 : 1)), dt); }
}
function steer(s, goal, speed, dt) {
 const d = sub(goal, s.pos), l = len(d);if (l < 1) return;const want = scale(d, 1 / l), c = clamp(dot(s.h, want), -1, 1), ang = Math.acos(c), maxA = 1.3 * dt;
 if (ang > 1e-4) { const k = Math.min(1, maxA / ang); s.h = norm(add(scale(s.h, 1 - k), want, k)); }
 const v = Math.min(speed, l / dt);s.vel = scale(s.h, v);s.pos = add(s.pos, s.vel, dt);
}

// ---- damage: the core's combat model (shields, armour zones, penetrations, fires) ----
function combatCtx(w, sys) {
 return {rand: () => w.rand(), time: w.time, damage: RULES.damage,
  ev: (u, text) => blog(w, sys, u.name + '：' + text, u),
  sunk: (u, why) => shipLost(w, sys, u, `${u.name}：撃沈（${why}）`, `${u.name} 撃沈（${why}）`),
  out: (u, why) => { blog(w, sys, `${u.name}：戦闘不能（${why}）`, u); event(w, `${u.name} 戦闘不能（${why}）`, {side: u.side, sys}); },
  hit: (u, rec) => { if (w.onHit) w.onHit(u, rec, sys); }};
}
// A ship lost for good: logged, counted, and its craft aboard lost with it.
function shipLost(w, sys, u, text, ev) {
 blog(w, sys, text, u);event(w, ev || text, {side: u.side, sys, sunk: true});w.sides[u.side].lost++;
 for (const id of u.squads) { const s = w.squads.get(id); if (s && s.state === 'docked') { s.state = 'lost'; s.lostN = (s.lostN || 0) + s.n; s.n = 0; } }
 if (u.tractor) releaseTractor(w, u);if (u.towedBy) { const t = w.units.get(u.towedBy); if (t) releaseTractor(w, t); u.towedBy = null; }
}
function lostToGravity(w, sys, u) { u.dead = true;u.fate = 'fall';u.velocity = [0, 0, 0];u.fire = u.fire.map(() => 0);shipLost(w, sys, u, `${u.name}：大気圏に落下して喪失`, `${u.name} 喪失（航行不能のまま大気圏に落下）`); }
// Craft still out when their carrier jumps cannot follow it into hyperspace:
// the squadron is written off with every craft in it.
function craftLostBehind(w, s, sys) {
 const n = Math.ceil(s.n);s.lostN = (s.lostN || 0) + s.n;s.n = 0;s.state = 'lost';
 if (n > 0) { blog(w, sys, `${s.name}：母艦がハイパースペースに入り帰還できず全機喪失（${n} 機）`, {side: s.side}); event(w, `${s.name} 全機喪失（母艦の離脱に間に合わず）`, {side: s.side, sys}); }
}
// Out of battle, craft still in the air fly home and land; those whose carrier
// is gone from the system are lost.
function craftIdle(w, dt) {
 for (const s of w.squads.values()) {
  if (s.sys == null || w.battles.has(s.sys)) continue;
  if (s.state === 'stranded') { craftLostBehind(w, s, s.sys); continue; }
  if (s.state === 'out') s.state = 'return';if (s.state !== 'return') continue;
  const home = w.units.get(s.home);
  if (!home || !alive(home) || home.sys !== s.sys) { craftLostBehind(w, s, s.sys); continue; }
  if (len(sub(home.pos, s.pos)) < Math.max(400, home.p.len * .5)) { s.state = 'docked'; s.t = RULES.craftRearm; s.runs = 0; const wg = w.wings.get(s.wing); if (wg && wg.squads.every(id => w.squads.get(id)?.state !== 'out' && w.squads.get(id)?.state !== 'return')) wg.phase = 'docked'; continue; }
  steer(s, home.pos, CRAFT[s.craft].speed, dt);
 }
}
// Disabled ships keep falling out of battle too.
function driftTick(w, dt) {
 for (const u of w.units.values()) { if (!alive(u) || !u.out || u.sys == null || u.towedBy || w.battles.has(u.sys)) continue; if (C.hullFall(u, dt, w.rand)) lostToGravity(w, u.sys, u); }
}
function applyDamage(w, sys, u, o, dt, s, ctx) {
 // Damage dealt outside the battle model (the bolts of a piloted ship) arrives here.
 if (u.extra) { C.combatMerge(o, u, u.extra); u.extra = null; }
 C.combatResolve(ctx || combatCtx(w, sys), u, o, dt, s);
}
// ---------- disabled ships: scuttle or recover (v17) ----------
// A disabled ship holds its task group in place until it is dealt with:
// scuttled (the crew taken off, the hulk destroyed), or recovered — taken in
// tow by a ship with a tractor beam, or, out of battle and with a supply line
// to the system, sent back by the fleet train to the yards, from which it
// returns repaired at the side's starting system.
function orderScuttle(w, id) {
 const u = w.units.get(id);if (!u || !alive(u) || u.sys == null) return {ok: false, why: '自沈させられません'};
 if (!u.out) return {ok: false, why: '自沈させられるのは航行不能艦だけです'};
 const sys = u.sys;u.dead = true;u.fate = 'scuttle';u.fire = u.fire.map(() => 0);
 shipLost(w, sys, u, `${u.name}：乗員を退艦させて自沈`, `${u.name} 自沈`);
 return {ok: true};
}
function recoverCheck(w, u) {
 if (!u || !alive(u) || u.sys == null) return '回収できません';
 if (!u.out) return '回収できるのは航行不能艦だけです';
 if (w.battles.has(u.sys)) return '戦闘中の星系からは後送できません（牽引ビームでの回収はできます）';
 if (!(supplyAt(w, u.side, u.sys) > 0)) return '補給線が届いていないため後送できません';
 return null;
}
const rearSeconds = u => Math.round(900 + 2700 * clamp(1 - unitStruct(u) + (u.secLost?.length || 0) * .15, 0, 1));
function orderRecover(w, id) {
 const u = w.units.get(id), why = recoverCheck(w, u);if (why) return {ok: false, why};
 const from = u.sys, g = w.groups.get(u.group), dur = rearSeconds(u);
 if (g) { g.units = g.units.filter(x => x !== u.id); if (g.flag === u.id) g.flag = g.units.find(x => fighting(w.units.get(x))) || g.units[0] || null; }
 if (u.towedBy) { const t = w.units.get(u.towedBy); if (t) releaseTractor(w, t); u.towedBy = null; }
 u.status = 'rear';u.rear = {from, at: w.time, back: w.time + dur, group: g?.name || ''};u.sys = null;u.group = null;u.velocity = [0, 0, 0];u.fall = null;u.supplyNeed = null;
 for (const sid of u.squads) { const q = w.squads.get(sid); if (q && q.state === 'docked') q.sys = null; }
 blog(w, from, `${u.name}：後方へ回収（修理後に復帰）`, u);event(w, `${u.name} を後方へ回収（約 ${Math.round(dur / 60)} 分で修理を終えて復帰）`, {side: u.side, sys: from});
 return {ok: true, eta: dur};
}
// Back from the yards: hull, systems, plating, crew and magazines restored.
function rearTick(w) {
 for (const u of w.units.values()) {
  if (u.status !== 'rear' || u.dead || w.time < u.rear.back) continue;
  const p = u.p, sd = w.sides[u.side], home = sd.start;C.combatInit(u);
  u.mods = u.mods.map(() => 1);u.ammo = (p.modules || []).map(m => m.stock || 0);u.crew = p.crewNeed || 0;u.out = null;u.fate = null;u.fateHint = null;u.fall = null;u.load = 0;u.energy = p.wCap || 0;
  u.shield = u.shieldMax = Math.max(0, p.shieldBuffer ?? p.D * C.K.bufferS);u.bank = u.bankMax = Math.max(0, p.reserve || 0);u.status = 'ready';
  const g = makeGroup(w, u.side, `${u.name}（修理完了）`, home);g.units = [u.id];g.flag = u.id;u.group = g.id;u.sys = home;u.order = {type: 'group', fire: true, power: 'auto', aim: 'auto'};deployGroup(w, g, null);
  for (const sid of u.squads) { const q = w.squads.get(sid); if (q && q.state === 'docked') { q.sys = home; q.pos = [...u.pos]; } }
  if (sd.brain) sd.brain.det.push(g.id);
  delete u.rear;event(w, `${u.name} が修理を終えて ${w.sector.systems[home].name} で戦列に復帰`, {side: u.side, sys: home});
 }
}
// The AI deals with its disabled ships: sent to the rear when a supply line
// reaches them out of battle, otherwise scuttled once their group must move.
function aiDisposeDisabled(w, u) { if (!u || !alive(u) || !u.out || u.towedBy) return; if (!recoverCheck(w, u)) orderRecover(w, u.id); else orderScuttle(w, u.id); }

// ---------- supply (v17) ----------
// A side's fleet train brings materiel up the lanes from its home systems.
// What it can hand out per second is the fleet's recovery capacity (回復力),
// shared by every ship drawing on it: a ship far down the line costs more of
// it for what it receives, and a system cut off from home by enemy ships gets
// nothing. Out of battle, ships draw on it to reload missiles, make good lost
// craft, mend sections, systems and plating, and — in a home system, where the
// yards are — to replace destroyed systems and lost crew.
const SUPPLY = {rate: .02 / 60, step: 1, lines: 5, missile: 1.5, craft: 12, crew: .25, repair: .3, intake: .003, lineCost: 1500};
const unitSupplyOf = u => u.supplyBase ?? (u.supplyBase = Math.max(50, unitDemand(u.info || {}, 0, 0).supply));
const modWeight = new WeakMap();
function modTotal(p) { let t = modWeight.get(p); if (t == null) { t = 0; for (const m of p.modules || []) if (m.k !== 'hull') t += m.w || 0; t = Math.max(1e-9, t); modWeight.set(p, t); } return t; }
function supplyInit(w) {
 for (const sd of w.sides) {
  let cap = 0;for (const u of w.units.values()) { if (u.side !== sd.id || u.dead) continue; const air = airTotals(u.squads.map(id => w.squads.get(id)).filter(Boolean).map(s => ({craft: s.craft, n: s.n0}))).crew; cap += unitDemand(u.info || {}, air, u.troops || 0).supply; }
  sd.supply = {cap, rate: cap * SUPPLY.rate, lines: new Map(), foe: new Set(), want: 0, flow: 0, ratio: 1, need: 0, acc: 0};
 }
 supplyLines(w);
}
// The lines: from each home system not held by the enemy, along the lanes, but
// never through a system where enemy ships are. Efficiency falls with distance.
function supplyLines(w) {
 const S = w.sector, n = S.systems.length;
 for (const sd of w.sides) {
  if (!sd.supply) continue;const foe = new Set();for (const u of w.units.values()) if (u.side !== sd.id && alive(u) && !u.out && u.sys != null) foe.add(u.sys);
  const dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), done = new Uint8Array(n);
  for (const h of sd.home) if (!foe.has(h)) dist[h] = 0;
  for (;;) { let x = -1, dx = Infinity; for (let i = 0; i < n; i++) if (!done[i] && dist[i] < dx) { dx = dist[i]; x = i; } if (x < 0) break; done[x] = 1; if (foe.has(x)) continue;
   for (const ei of S.systems[x].links) { const e = S.edges[ei], y = e.a === x ? e.b : e.a, c = dx + e.len / LANE[e.kind].f + 6; if (c < dist[y]) { dist[y] = c; prev[y] = x; } } }
  const lines = new Map();for (let i = 0; i < n; i++) if (dist[i] < Infinity && !foe.has(i)) lines.set(i, {eff: dist[i] === 0 ? 1 : clamp(1.05 - dist[i] / SUPPLY.lineCost, .35, 1), prev: prev[i], cost: dist[i], home: dist[i] === 0});
  sd.supply.lines = lines;sd.supply.foe = foe;
 }
}
const supplyAt = (w, side, sys) => w.sides[side]?.supply?.lines.get(sys)?.eff || 0;
// What a ship lacks, in tonnes of materiel, by kind.
function supplyNeeds(w, u, ln) {
 const p = u.p, mods = p.modules || [], base = unitSupplyOf(u), yard = !!ln?.home, out = {total: 0, ammo: 0, craft: 0, hull: 0, mods: 0, plate: 0, crew: 0, parts: 0};
 for (let i = 0; i < mods.length; i++) if (mods[i].k === 'launcher' && u.mods[i] > 0 && (mods[i].stock || 0) > u.ammo[i]) out.ammo += (mods[i].stock - u.ammo[i]) * SUPPLY.missile;
 for (const sid of u.squads) { const q = w.squads.get(sid); if (!q || !(q.n0 > 0) || (q.state !== 'docked' && q.state !== 'lost')) continue; const miss = q.n0 - q.n; if (miss > .01) out.craft += miss * SUPPLY.craft * (CRAFT[q.craft]?.size || 1); }
 const hp = Math.max(1, p.hp);let sec = 0;for (let i = 0; i < u.sec.length; i++) if (!u.secLost.includes(i)) sec += Math.max(0, u.sec[i].max - Math.max(0, u.sec[i].s));out.hull = sec / hp * base * SUPPLY.repair;
 const W = modTotal(p);let dm = 0, dd = 0;
 for (let i = 0; i < mods.length; i++) { const m = mods[i]; if (m.k === 'hull' || u.secLost.includes(u.secOf[i])) continue; const v = u.mods[i]; if (v > 0 && v < 1) dm += (1 - v) * (m.w || 0); else if (v <= 0 && yard) dd += m.w || 0; }
 out.mods = dm / W * base * SUPPLY.repair * .5;out.parts = dd / W * base * SUPPLY.repair;
 const Z = C.combatZones(p, u.sec.length);let pl = 0;for (let z = 0; z < Z.n; z++) if (u.zi[z] < 1) pl += (1 - u.zi[z]) * Z.A[z];out.plate = pl / Math.max(1, Z.area) * base * SUPPLY.repair * .3;
 if (yard) out.crew = Math.max(0, (p.crewNeed || 0) - u.crew) * SUPPLY.crew;
 out.total = out.ammo + out.craft + out.hull + out.mods + out.parts + out.plate + out.crew;if (out.total < .5) out.total = 0;
 return out;
}
// t tonnes handed to a ship: crew, missiles, craft, then repairs.
function supplyGive(w, u, nd, t) {
 if (!(t > 0)) return;const p = u.p, mods = p.modules || [];
 const use = (want, f) => { if (!(want > 0) || !(t > 0)) return; const k = Math.min(1, t / want); t -= want * k; f(k); };
 use(nd.crew, k => { u.crew = Math.min(p.crewNeed || 0, u.crew + Math.max(0, (p.crewNeed || 0) - u.crew) * k); });
 use(nd.ammo, k => { for (let i = 0; i < mods.length; i++) if (mods[i].k === 'launcher' && u.mods[i] > 0) u.ammo[i] = Math.min(mods[i].stock || 0, u.ammo[i] + Math.max(0, (mods[i].stock || 0) - u.ammo[i]) * k); });
 use(nd.craft, k => { for (const sid of u.squads) { const q = w.squads.get(sid); if (!q || !(q.n0 > 0) || (q.state !== 'docked' && q.state !== 'lost')) continue; q.n = Math.min(q.n0, q.n + (q.n0 - q.n) * k); if (q.state === 'lost' && q.n >= 1) { q.state = 'docked'; q.sys = u.sys; q.pos = [...u.pos]; q.t = RULES.craftRearm; } } });
 use(nd.mods, k => { for (let i = 0; i < mods.length; i++) { const v = u.mods[i]; if (v > 0 && v < 1 && !u.secLost.includes(u.secOf[i])) u.mods[i] = Math.min(1, v + (1 - v) * k); } });
 use(nd.hull, k => { let hp = 0; for (let i = 0; i < u.sec.length; i++) { const x = u.sec[i]; if (!u.secLost.includes(i)) x.s = Math.min(x.max, Math.max(0, x.s) + (x.max - Math.max(0, x.s)) * k); hp += Math.max(0, x.s); } u.hp = hp; });
 use(nd.plate, k => { const Z = C.combatZones(p, u.sec.length);let a = 0, s = 0; for (let z = 0; z < u.zi.length; z++) { if (u.zi[z] < 1) u.zi[z] = Math.min(1, u.zi[z] + (1 - u.zi[z]) * k); a += Z.A[z] || 0; s += (Z.A[z] || 0) * u.zi[z]; } u.armor = a > 0 ? s / a : 1; });
 use(nd.parts, k => { for (let i = 0; i < mods.length; i++) if (u.mods[i] <= 0 && mods[i].k !== 'hull' && !u.secLost.includes(u.secOf[i])) u.mods[i] = Math.max(.02, k); });
 // A disabled ship whose power, bridge and crew are restored is back in the fight.
 if (u.out) { const sx = C.fleetSystems(u), why = sx.hasReactor && p.grid?.P > 0 && sx.reactor <= 0 ? '電源喪失' : sx.hasBridge && !sx.bridge ? '艦橋喪失' : (p.crewNeed || 0) > 0 && u.crew < p.crewNeed * C.FLEET_MIN_CREW ? '乗員不足' : null;
  if (!why) { u.out = null; u.fall = null; u.order = {...u.order, type: 'group'}; blog(w, u.sys, `${u.name}：修理を終えて戦列に復帰`, u); event(w, `${u.name} が修理を終えて戦列に復帰`, {side: u.side, sys: u.sys}); } }
}
function supplyTick(w, dt) {
 if ((w.timers.sup = (w.timers.sup ?? 0) - dt) <= 0) { w.timers.sup = SUPPLY.lines; supplyLines(w); }
 for (const sd of w.sides) {
  const sp = sd.supply;if (!sp) continue;sp.acc += dt;if (sp.acc < SUPPLY.step) continue;const st = sp.acc;sp.acc = 0;
  const asks = [];let want = 0, need = 0;
  for (const u of w.units.values()) {
   if (u.side !== sd.id) continue;if (!alive(u) || u.sys == null || u.jump) { u.supplyNeed = null; continue; }
   const ln = sp.lines.get(u.sys), nd = supplyNeeds(w, u, ln);u.supplyNeed = nd;if (!nd.total) continue;need += nd.total;
   if (!ln || w.battles.has(u.sys)) continue;
   const take = Math.min(nd.total, Math.max(5, unitSupplyOf(u) * SUPPLY.intake) * st);asks.push({u, nd, take});want += take / ln.eff;
  }
  const avail = sp.rate * st, r = want > avail ? avail / want : 1;
  for (const a of asks) supplyGive(w, a.u, a.nd, a.take * r);
  const k = Math.min(1, st / 8);sp.want += (want / st - sp.want) * k;sp.flow += (Math.min(want, avail) / st - sp.flow) * k;sp.ratio += ((want > 0 ? r : 1) - sp.ratio) * k;sp.need = need;
 }
}

// ---------- AI ----------
// The opposing commander splits its fleet into a main body, a detachment and
// scouts; scouts search systems not seen lately, and the main body moves to
// strike any group it can outmatch, gathering the detachment to arrive together.
function aiWithdrawUnit(w, u) {
 const g = w.groups.get(u.group);if (!g) return;const safe = safeSystem(w, u.side, u.sys);if (safe == null) return;
 // A lone damaged ship leaves in a group of its own.
 const h = makeGroup(w, u.side, `${u.name}（撤退）`, u.sys);g.units = g.units.filter(id => id !== u.id);h.units = [u.id];u.group = h.id;orderJump(w, h.id, safe);
}
function safeSystem(w, side, from) {
 const sd = w.sides[side], danger = new Set([...sd.contacts.values()].map(c => c.sys));
 const cands = w.sector.systems.filter(s => s.id !== from && !danger.has(s.id) && routeCost(w.sector, from, s.id) < Infinity).sort((a, b) => routeCost(w.sector, from, a.id) - routeCost(w.sector, from, b.id));
 const homeFirst = cands.filter(s => sd.home.includes(s.id));return (homeFirst[0] || cands[0])?.id ?? null;
}
function aiSetup(w, side) {
 const sd = w.sides[side];if (sd.brain) return;
 const strength = g => g.units.map(id => w.units.get(id)).filter(fighting).reduce((n, u) => n + unitStrength(u), 0);
 const gs = [...w.groups.values()].filter(g => g.side === side && g.units.some(id => alive(w.units.get(id)))), us = gs.flatMap(g => g.units).map(id => w.units.get(id)).filter(alive);
 // Fast small ships with long-range sensors scout alone; the task groups keep their formations
 // and form a main body (about two thirds of the strength) and a detachment.
 const scouts = us.filter(u => !u.info.capital && u.info.hyper != null && u.info.hyper <= 2).sort((a, b) => (a.info.hyper - b.info.hyper) || (b.info.sensor - a.info.sensor)).slice(0, Math.max(1, Math.round(us.length * .1)));
 const sc = scouts.map(u => { const g = w.groups.get(u.group); if (g) { g.units = g.units.filter(x => x !== u.id); if (g.flag === u.id) g.flag = g.units[0] || null; } const h = makeGroup(w, side, `${u.name} 偵察隊`, u.sys); h.units = [u.id]; h.flag = u.id; u.group = h.id; return h.id; });
 const tgs = gs.filter(g => g.units.length).sort((a, b) => strength(b) - strength(a)), main = [], det = [];let sm = 0, sdt = 0;
 for (const g of tgs) { if (sm <= sdt * 2) { main.push(g.id); sm += strength(g); } else { det.push(g.id); sdt += strength(g); } }
 for (const g of gs) if (!g.units.length) w.groups.delete(g.id);
 sd.brain = {main, det, scouts: sc, plan: null};
}
function aiStrategic(w, side) {
 const sd = w.sides[side];aiSetup(w, side);const A = sd.brain, S = w.sector;
 for (const g of [...w.groups.values()]) if (g.side === side && g.sys != null && !w.battles.has(g.sys)) for (const u of groupDisabled(w, g)) aiDisposeDisabled(w, u);
 const live = id => { const g = w.groups.get(id); return g && g.units.some(u => alive(w.units.get(u))) ? g : null; }, body = ids => (Array.isArray(ids) ? ids : ids ? [ids] : []).map(live).filter(Boolean);
 const strength = g => g.units.map(id => w.units.get(id)).filter(fighting).reduce((n, u) => n + unitStrength(u), 0);
 const busy = gs => gs.some(g => g.transit || g.spool || g.waitJump), here = gs => { const n = new Map(); for (const g of gs) if (g.sys != null) n.set(g.sys, (n.get(g.sys) || 0) + g.units.length); return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null; };
 // A body jumps together: groups that would arrive first wait for the slowest.
 const bodyJump = (gs, dest) => { const etas = gs.filter(g => !g.transit && !g.spool && !g.waitJump && g.sys != null && g.sys !== dest).map(g => ({g, eta: etaTo(w, g.id, dest)})).filter(x => x.eta != null); if (!etas.length) return false; const last = Math.max(...etas.map(x => x.eta)); for (const x of etas) { if (last - x.eta > 45) x.g.waitJump = {dest, at: w.time + last - x.eta}; else orderJump(w, x.g.id, dest); } return true; };
 const contacts = [...sd.contacts.values()].filter(c => !c.transit).sort((a, b) => b.time - a.time);
 // Scouts: the nearest system (by lane) not seen for the longest.
 for (const id of A.scouts || []) { const g = live(id); if (!g || g.transit || g.spool || w.battles.has(g.sys) || w.time - (g.arrivedAt ?? -1e9) < RULES.dwell * .6) continue; const stale = S.systems.filter(s => s.id !== g.sys).map(s => ({s, age: w.time - (sd.seen.get(s.id) ?? -1e9), d: routeCost(S, g.sys, s.id)})).filter(x => x.d < Infinity).sort((a, b) => (b.age > 600) - (a.age > 600) || a.d - b.d)[0]; if (stale) orderJump(w, g.id, stale.s.id); }
 const main = body(A.main), det = body(A.det), mine = main.concat(det);
 // Break off a battle going badly; otherwise join or reinforce battles where our ships fight.
 for (const [sys] of w.battles) { if (!sidePresent(w, side, sys)) continue; const us = systemUnits(w, sys), ours = us.filter(u => u.side === side && fighting(u)).reduce((n, u) => n + unitStrength(u), 0), theirs = us.filter(u => u.side !== side && fighting(u)).reduce((n, u) => n + unitStrength(u), 0);
  const there = mine.filter(g => g.sys === sys && !g.spool && !g.transit);
  if (ours < theirs * .45 && theirs > 0) { const safe = safeSystem(w, side, sys); if (safe != null) for (const g of there) { orderJump(w, g.id, safe); event(w, `${g.name} が撤退を開始`, {side}); } continue; }
  for (const g of mine) if (!g.transit && !g.spool && !g.waitJump && g.sys !== sys && !w.battles.has(g.sys)) { const eta = etaTo(w, g.id, sys); if (eta != null && eta < 900) orderJump(w, g.id, sys); } }
 // Strike the nearest fresh contact we outmatch, the whole fleet arriving together.
 // A commander kept from battle for an hour grows bolder about the odds.
 if ([...w.battles.keys()].some(sys => sidePresent(w, side, sys))) A.lastBattle = w.time;
 const fresh = contacts.filter(c => w.time - c.time < 900), ours = mine.reduce((n, g) => n + strength(g), 0), odds = w.time - (A.lastBattle ?? 0) > 3600 ? .85 : 1.15;
 const danger = new Set(fresh.filter(c => c.strength * odds >= ours).map(c => c.sys)), at = here(main), idle = main.length && !busy(main) && at != null && !w.battles.has(at);
 if (fresh.length && idle) {
  const lead = main.find(g => g.sys === at), prey = fresh.filter(c => c.sys !== at && ours > c.strength * odds).map(c => ({c, eta: etaTo(w, lead.id, c.sys)})).filter(x => x.eta != null).sort((a, b) => a.eta - b.eta)[0];
  if (prey) { bodyJump(mine.filter(g => !w.battles.has(g.sys)), prey.c.sys); A.plan = {sys: prey.c.sys, at: w.time}; }
  else if (det.length && !busy(det) && here(det) !== at) bodyJump(det, at);
 }
 // Nothing to strike: the main body sweeps along the lanes toward the enemy's end,
 // through the systems not seen for longest and round any force too strong for it;
 // the detachment keeps one lane-hop away.
 if (idle && !(A.plan && w.time - A.plan.at < RULES.dwell) && w.time - Math.max(...main.map(g => g.arrivedAt ?? -1e9)) > RULES.dwell) {
  const far = w.sides.find(x => x.id !== side), goal = far ? far.start : at;
  const cand = S.systems.filter(x => x.id !== at && !danger.has(x.id)).map(x => { const d = routeCost(S, at, x.id), toward = routeCost(S, x.id, goal) < routeCost(S, at, goal) - 20, seen = sd.seen.get(x.id), age = seen == null ? 1e9 : w.time - seen; return {x, score: (toward ? 0 : 120) + d + (age < 3600 ? 350 : 0) - (x.inhabited ? 30 : 0) - (x.trunk ? 20 : 0)}; }).filter(c => c.score < Infinity).sort((a, b) => a.score - b.score)[0];
  if (cand) { bodyJump(main, cand.x.id); A.moved = w.time; if (det.length && !busy(det) && !det.some(g => w.battles.has(g.sys))) { const near = S.systems.filter(x => x.id !== cand.x.id && routeCost(S, x.id, cand.x.id) < 160).sort((a, b) => (w.time - (sd.seen.get(b.id) ?? -1e9)) - (w.time - (sd.seen.get(a.id) ?? -1e9)))[0]; bodyJump(det, (near || cand.x).id); } }
 }
 // Carriers in battle send their wings: fighters to cover the fleet, bombers at the biggest enemy.
 for (const wing of w.wings.values()) { if (wing.side !== side) continue; const home = w.units.get(wing.home); if (!home || !alive(home) || !w.battles.has(home.sys)) { wing.auto = null; continue; } aiWing(w, wing, home); }
}
// AI wings: mostly-bomber wings strike the largest enemy from its weakest
// point-defence arc; the rest cover their carrier.
function aiWing(w, wing, home) {
 const sqs = wing.squads.map(id => w.squads.get(id)).filter(s => s && s.state !== 'lost'), bombers = sqs.filter(s => CRAFT[s.craft].role === 'bomber').length;
 const foes = systemUnits(w, home.sys).filter(u => u.side !== home.side && fighting(u)).sort((a, b) => b.p.len - a.p.len);if (!foes.length) return;
 const cur = wing.auto;if (cur && (cur.type !== 'strike' || fighting(w.units.get(cur.target)))) return;
 if (bombers > 0 || (wing.no || 1) % 2 === 0) wing.auto = {type: 'strike', target: foes[0].id, approach: weakestApproach(foes[0])};
 else wing.auto = {type: 'escort', target: home.id};
}
function weakestApproach(t) { return Object.keys(APPROACH).sort((a, b) => pdToward(t, add(t.pos, shipToWorld(t, scale(APPROACH[a], 9000)))) - pdToward(t, add(t.pos, shipToWorld(t, scale(APPROACH[b], 9000)))))[0]; }

// ---------- the clock ----------
// maxN caps the ticks run in one call; time that could not be run is dropped,
// so a heavy battle slows the clock instead of stalling the screen.
function step(w, dt, maxN = 4000) {
 if (w.result) return 0;w.acc += dt;let n = 0;
 while (w.acc >= TICK && n < maxN) { w.acc -= TICK; n++; tick(w, TICK); if (w.result) break; }
 if (w.acc > TICK) w.acc = TICK;return n;
}
function tick(w, dt) {
 w.time += dt;
 for (const g of w.groups.values()) {
  if (g.transit && w.time >= g.transit.t1) arriveGroup(w, g);
  if (g.waitJump && w.time >= g.waitJump.at && !g.transit && !g.spool) { const d = g.waitJump.dest; g.waitJump = null; if (g.sys != null && g.sys !== d) orderJump(w, g.id, d); }
  // The spool stands still while any ship of the group is under fire (the reactor cannot feed the drive and the shields at once).
  if (g.spool) { const blocked = g.units.some(id => { const u = w.units.get(id); return alive(u) && !u.out && u.sys != null && w.battles.has(u.sys) && u.underFire; }); g.spool.blocked = blocked; if (!blocked) g.spool.t += dt; for (const id of g.units) { const u = w.units.get(id); if (u?.jump) { u.jump.t = g.spool.t; u.jump.blocked = blocked; } } if (g.spool.t >= g.spool.need) departGroup(w, g); }
 }
 updateBattles(w);
 if ((w.timers.det -= dt) <= 0) { w.timers.det = RULES.detectEvery; detect(w); }
 if ((w.timers.tac -= dt) <= 0) { w.timers.tac = RULES.aiTactical; for (const [sys] of w.battles) tacticalOrders(w, sys, systemUnits(w, sys)); }
 if ((w.timers.ai -= dt) <= 0) { w.timers.ai = RULES.aiStrategic; for (const sd of w.sides) if (sd.ai) aiStrategic(w, sd.id); }
 for (const [sys] of w.battles) battleTick(w, sys, dt);
 for (const u of w.units.values()) if (u.tractor && alive(u) && u.sys != null && !w.battles.has(u.sys)) tractorTick(w, u, dt);
 // Out of battle, shields recharge and docked craft rearm.
 for (const u of w.units.values()) if (alive(u) && u.sys != null && !w.battles.has(u.sys)) { if (u.out) { u.shield = Math.max(0, u.shield - u.shieldMax * .02 * dt); u.underFire = false; continue; } const gain = (u.p.D || 0) * dt * .5, room = u.shieldMax - u.shield; u.shield = Math.min(u.shieldMax, u.shield + gain); if (gain > room && u.bank < u.bankMax) u.bank = Math.min(u.bankMax, u.bank + gain - Math.max(0, room)); u.underFire = false; if (u.warp) { u.warp.t += dt; if (u.warp.t > 1) delete u.warp; } }
 for (const s of w.squads.values()) if (s.state === 'docked' && s.t > 0 && !w.battles.has(s.sys)) s.t -= dt;
 craftIdle(w, dt);driftTick(w, dt);supplyTick(w, dt);rearTick(w);
 checkResult(w);
}
// The fleet battle ends when one side has lost three quarters of its fighting
// value (sunk, disabled or fled) or has no ship left able to fight.
function checkResult(w) {
 if (w.mode !== 'fleet' || w.result) return;
 // Ships at the yards count for half of what they will bring back.
 const rear = u => u.status === 'rear' && !u.dead;
 const now = w.sides.map(sd => [...w.units.values()].filter(u => u.side === sd.id && (fighting(u) || rear(u))).reduce((n, u) => n + unitStrength(u) * (rear(u) ? .5 : 1), 0));
 w.sides.forEach((sd, i) => sd.now = now[i]);
 const broken = w.sides.map((sd, i) => now[i] < sd.initial * .25 || ![...w.units.values()].some(u => u.side === sd.id && (fighting(u) || rear(u))));
 if (broken.some(Boolean)) { const winner = broken[0] && broken[1] ? -1 : broken[0] ? 1 : 0; w.result = {winner, time: w.time}; event(w, winner < 0 ? '両軍とも戦闘力を失いました' : `${w.sides[winner].name}の勝利`, {result: true}); }
}

// ---------- player orders ----------
// Ships: 'group' (follow the task group), or an order of their own.
function orderUnit(w, id, o) {
 const u = w.units.get(id);if (!u || !alive(u) || w.sides[u.side].ai) return false;
 if (o.type && !['group', 'auto', 'hold', 'move', 'attack'].includes(o.type)) return false;
 if (o.type === 'attack' && !w.units.has(o.target)) return false;
 u.order = {...u.order, ...o};if (o.type && o.type !== 'attack') delete u.order.target;if (o.type && o.type !== 'move') delete u.order.point;return true;
}
// Task groups: 自動交戦 (auto), hold, move (point), attack (target); the formation;
// power and aim for every ship of the group. Ships on orders of their own rejoin.
function orderGroup(w, gid, o) {
 const g = w.groups.get(gid);if (!g || w.sides[g.side].ai) return false;
 if (o.formation) { if (!FORMATIONS[o.formation]) return false; g.formation = o.formation; }
 if (o.type) {
  if (!['auto', 'hold', 'move', 'attack'].includes(o.type)) return false;
  if (o.type === 'attack') { const t = w.units.get(o.target); if (!t || t.side === g.side) return false; }
  const guide = w.units.get(g.flag) || g.units.map(id => w.units.get(id)).find(fighting);
  g.order = {type: o.type, target: o.target, point: o.point, dir: o.type === 'move' && o.point && guide ? norm([o.point[0] - guide.pos[0], 0, o.point[2] - guide.pos[2]]) : null};g.holdPos = null;
  for (const id of g.units) { const u = w.units.get(id); if (u && alive(u)) u.order = {...u.order, type: 'group'}; delete u?.order.target; delete u?.order.point; }
 }
 for (const k of ['power', 'aim', 'fire']) if (o[k] != null) for (const id of g.units) { const u = w.units.get(id); if (u && alive(u)) u.order[k] = o[k]; }
 return true;
}
// A combined task group's order goes to each of its task groups; on a move the
// groups keep station side by side across the line of advance.
function orderCtg(w, cid, o) {
 const c = w.ctgs.get(cid);if (!c || w.sides[c.side].ai) return false;
 const gs = c.tgs.map(id => w.groups.get(id)).filter(g => g && g.units.some(id => fighting(w.units.get(id))));let ok = false;
 if (o.type === 'move' && o.point) { const lead = w.units.get(gs[0]?.flag), dir = lead ? norm([o.point[0] - lead.pos[0], 0, o.point[2] - lead.pos[2]]) : [1, 0, 0]; gs.forEach((g, i) => { const k = Math.ceil(i / 2), sg = i % 2 ? 1 : -1, off = frameVec(dir, [0, 0, sg * k * 16000]); ok = orderGroup(w, g.id, {...o, point: add(o.point, off)}) || ok; }); return ok; }
 for (const g of gs) ok = orderGroup(w, g.id, o) || ok;return ok;
}
// Jumps for a whole combined task group: each group by its own lanes, those
// that would arrive first waiting so that all come out of hyperspace together.
function orderCtgJump(w, cid, dest, together = true) {
 const c = w.ctgs.get(cid);if (!c || w.sides[c.side].ai) return {ok: false, why: '命令できません'};
 const gs = c.tgs.map(id => w.groups.get(id)).filter(g => g && !g.transit && g.sys != null && g.sys !== dest && g.units.some(id => alive(w.units.get(id))));
 if (!gs.length) return {ok: false, why: '移動できる任務群がありません'};
 const etas = gs.map(g => ({g, eta: etaTo(w, g.id, dest)})).filter(x => x.eta != null);if (!etas.length) return {ok: false, why: 'ハイパードライブが使えません'};
 const last = Math.max(...etas.map(x => x.eta));let n = 0;
 for (const x of etas) { if (together && last - x.eta > 30) { x.g.waitJump = {dest, at: w.time + (last - x.eta)}; n++; continue; } const r = orderJump(w, x.g.id, dest); if (r.ok) n++; }
 return {ok: n > 0, eta: last, n};
}
function orderTractor(w, id, mode, target) {
 const u = w.units.get(id), t = w.units.get(target);if (!u || w.sides[u.side].ai) return {ok: false, why: '命令できません'};
 if (mode === 'release') { releaseTractor(w, u, '命令'); return {ok: true}; }
 if (!(u.p.trac > 0)) return {ok: false, why: 'トラクター・ビーム投射機がありません'};
 if (!t || t.sys !== u.sys) return {ok: false, why: '目標が同じ星系にいません'};
 if (!tractorOk(u, t, mode)) return {ok: false, why: mode === 'tow' ? '牽引できるのは戦闘不能の味方艦です' : '拿捕できるのはシールドを失った戦闘不能の敵艦です'};
 if (t.towedBy && t.towedBy !== u.id) return {ok: false, why: 'ほかの艦が牽引しています'};
 releaseTractor(w, u);u.tractor = {target: t.id, mode, lock: false, progress: 0};return {ok: true};
}
function orderWing(w, id, o) {
 const wing = w.wings.get(id);if (!wing || w.sides[wing.side].ai) return false;
 if (!['auto', 'standby', 'strike', 'cap', 'escort'].includes(o.type)) return false;
 if (o.type === 'strike' && !(w.units.get(o.target)?.side !== wing.side)) return false;
 wing.order = {...o};if (o.type === 'standby') for (const sid of wing.squads) { const s = w.squads.get(sid); if (s && s.state === 'out') s.state = 'return'; }
 else if (['go', 'run', 'egress', 'on'].includes(wing.phase)) wing.phase = o.type === 'strike' ? 'go' : 'on';
 return true;
}
function splitGroup(w, gid, ids, name) {
 const g = w.groups.get(gid);if (!g || g.transit || g.spool) return null;const take = ids.filter(id => g.units.includes(id));if (!take.length || take.length === g.units.length) return null;
 const h = makeGroup(w, g.side, name || g.name + '分遣隊', g.sys);h.units = take;h.ctg = g.ctg;h.formation = g.formation;g.units = g.units.filter(id => !take.includes(id));for (const id of take) w.units.get(id).group = h.id;h.flag = take[0];if (!take.includes(g.flag)) {} else g.flag = g.units[0];
 const c = ctgOf(w, g);if (c) c.tgs.push(h.id);return h;
}
function mergeGroups(w, a, b) {
 const g = w.groups.get(a), h = w.groups.get(b);if (!g || !h || g === h || g.side !== h.side || g.sys == null || g.sys !== h.sys || g.transit || h.transit || g.spool || h.spool) return false;
 for (const id of h.units) { g.units.push(id); w.units.get(id).group = g.id; } w.groups.delete(h.id);for (const c of w.ctgs.values()) c.tgs = c.tgs.filter(x => x !== h.id);return true;
}

// ---------- order of battle ----------
// Default complements for a ship from its hangar and troop space.
// Squadrons of twelve (larger for the biggest carriers), six to a wing.
function defaultAir(info, faction) {
 const mix = CRAFT_MIX[faction] || CRAFT_MIX.empire, cap = Math.floor(info.slotCap || 0), out = [];let used = 0, k = 0;
 const per = cap > 900 ? RULES.maxSquadSize : 12;
 while (k < 400) { const craft = mix[k % mix.length], c = CRAFT[craft], n = Math.min(per, Math.floor((cap - used) / c.size)); if (n < 4) break; out.push({craft, n, name: `第${out.length + 1}${ROLE_NAME[c.role]}中隊`, wingNo: Math.floor(out.length / 6) + 1}); used += n * c.size; k++; }
 return out;
}
function defaultGround(info, faction) {
 const tpl = REGIMENT_TEMPLATES[faction] || REGIMENT_TEMPLATES.empire, per = COMPANY_TROOPS * BATTALION_COMPANIES * REGIMENT_BATTALIONS, n = Math.floor((info.troopCap || 0) / per);
 return Array.from({length: n}, (_, i) => makeRegiment(faction, `第${i + 1}${tpl.name}`));
}
function makeRegiment(faction, name) {
 const tpl = REGIMENT_TEMPLATES[faction] || REGIMENT_TEMPLATES.empire;
 return {name, faction, battalions: Array.from({length: REGIMENT_BATTALIONS}, (_, b) => ({name: `第${b + 1}大隊`, companies: tpl.companies.map((type, c) => ({name: `${'ABCD'[c]}中隊（${COMPANY_TYPES[type]}）`, type, troops: COMPANY_TROOPS, vehicles: {...(tpl.vehicles[type] || {})}}))}))};
}
function regimentTotals(r) { const t = {troops: 0, vehicles: {}, size: 0}; for (const b of r.battalions || []) for (const c of b.companies || []) { t.troops += c.troops || 0; for (const [k, n] of Object.entries(c.vehicles || {})) { if (!VEHICLES[k]) continue; t.vehicles[k] = (t.vehicles[k] || 0) + n; t.size += VEHICLES[k].size * n; } } return t; }
function airTotals(list) { let n = 0, size = 0, crew = 0; for (const q of list || []) { const c = CRAFT[q.craft]; if (!c) continue; n += q.n; size += q.n * c.size; crew += q.n * c.crew; } return {n, size, crew}; }

return {RULES, TICK, CRAFT, CRAFT_MIX, ROLE_NAME, FACTIONS, SIDE_OF, VEHICLES, COMPANY_TYPES, REGIMENT_TEMPLATES, COMPANY_TROOPS, CAPITAL_LENGTH, MAP_LY, GRID_COLS, SECTOR_DEFS, REGIONS, LANE, KIND_NAME, APPROACH, APPROACH_NAME, FORMATIONS, WING_PHASE,
 rng, makeSector, sysDistance, routePath, routeCost, pathSeconds, tripSeconds, designInfo, unitDemand, createWorld, normalizeOrbat, makeUnit, makeGroup, makeCtg, ctgOf, addSquad, step, tick, detect, orderJump, cancelJump, etaTo, groupMapPos, orderUnit, orderGroup, orderCtg, orderCtgJump, orderTractor, orderWing, splitGroup, mergeGroups,
 systemUnits, unitStruct, unitStrength, unitHyper, groupHyper, groupDisabled, groupStay, orderScuttle, orderRecover, recoverCheck, rearSeconds, SUPPLY, supplyAt, supplyLines, supplyNeeds, unitSupplyOf, alive, fighting, pdToward, effectiveOrder, groupOrder, formationOffsets, tractorReach, tractorOk, defaultAir, defaultGround, makeRegiment, regimentTotals, airTotals, battleTick};
})();
