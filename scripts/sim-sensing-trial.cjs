// 索敵の検証（計算だけ。ゲーム本体には組み込まない）。ユーザーの指示 2026-11-25：
//   docs/handoff-2026-11-25/sensing-trial-request-2026-11-25.md
// 使い方: node scripts/sim-sensing-trial.cjs <出力先フォルダ> [場面=all] [回数=5]
//   場面: aLock | cLock（ロックあり）| a | a2x12 | a12x2 | b | c | c2 | c2x12 | c12x2 | d | all（コンマで複数）（下の SCENES を参照）
//   出力先は必ず引数で渡す（既定でリポジトリの中には書かない）。図を作らないときは KS_NOFIG=1。
// Core は読むだけ（性能表 YardFleetData と、既存の索敵の式 Core.sensSNR・定数 Core.SENS / EMIT / EMCON を使う）。
// 検証用に足した式はこのファイルの「純粋な関数」の節にあり、★ を付けた定数は K に 1 か所でまとめてある。
'use strict';
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const root = process.env.KS_TEST_ROOT || path.resolve(__dirname, '..');
const OUT = process.argv[2], SCENE_ARG = process.argv[3] || 'all', RUNS = +(process.argv[4] || 5);
if (!OUT) { console.error('使い方: node scripts/sim-sensing-trial.cjs <出力先フォルダ> [場面=all] [回数=5]'); process.exit(2); }
const cx = vm.createContext({console: {log() {}, warn() {}, error: console.error}});
for (const f of ['data/reference.js', 'data/imperial2.js', 'data/fleet.js', 'js/core.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), cx, {filename: f});
const C = vm.runInContext('Core', cx), F = vm.runInContext('YardFleetData', cx);

// ====================================================================================================
// 定数（★ = こちらで選んだ値。ユーザーが後から変えられるよう、ここだけに置く）
// ====================================================================================================
const KM = 1000;
const K = {
  // ---- マップ（ユーザーの指示。直径か半径かは README の「決めてもらう点」）----
  MAP_RADIUS: 10000 * KM,        // 「2万キロ」を直径 20,000 km と読んだ → 半径 10,000 km
  MAP_HALF_HEIGHT: 5000 * KM,    // 上へ 5,000 km・下へ 5,000 km
  PLANET_RADIUS: 6.12e6,         // ★ 惑星の半径。既存の scripts/sim-fleet-air.cjs の惑星（6,120 km）と同じにした
  PLANET_G: 9.8,                 // ★ 惑星の表面重力（Core.GRAVITY.g0 と同じ）
  SUN_DIR: [0, 0, -1],           // ★ 恒星の光が進む向き（惑星の +z 側が昼、-z 側の円柱が影）
  // ---- 時間 ----
  DT: 10,                        // ★ 時間刻み s
  LIMIT: 6 * 3600,               // ★ 1 回の計算の長さ s（6 時間）
  // ---- 既存の式をそのまま使う部分（Core から読む。ここでは変えていない）----
  SENS: C.SENS,                  // レーダー・ニュートリノ・赤外の基準距離、識別に要る SNR（idRad 20、idIr 40）、方位誤差 errK
  EMIT: C.EMIT,                  // 排熱の種類ごとのニュートリノ・赤外の割合
  EMCON: C.EMCON,                // 放射管制（低放射：排熱の放出 0.1 倍、レーダー停止）
  // ---- 探知の判定 ----
  DET_SNR: 1,                    // ★ 光点として映るしきい値（Core.SENS.snr[1]「微弱反応」と同じ 1）
  FIX_SNR: 3,                    // ★ 位置が使える（追跡できる）しきい値（Core.SENS.trackBand と同じ 3）
  NOISE_SIGMA: 0.3,              // ★ 雑音：測った SNR ＝ 真の SNR × exp(正規乱数 × 0.3)
  LOOKS_ON: 2,                   // ★ しきい値を 2 回続けて超えたら「映った」
  LOOKS_OFF: 3,                  // ★ しきい値の 0.7 倍を 3 回続けて下回ったら「消えた」
  OFF_RATIO: 0.7,                // ★（Core.SENS.drop と同じ 0.7）
  // ---- 排熱 ----
  WASTE_SHARE: 0.05,             // ★ 排熱 ＝ 反応炉出力 p.grid.P × 0.05（Core の旧式の見積もり .05×P、energyModel.eta 0.95 と同じ割合）
  // ---- 目視 ----
  VIS_SEE_K: 300,                // ★ 目視で点として見える距離 ＝ 最大寸法 × 300 × √(観測側の赤外・光学の開口)
  VIS_ID_K: 150,                 // ★ 目視で艦種と所属が分かる距離 ＝ 最大寸法 × 150 × √(開口)
  // ---- 重力波 ----
  GRAV_QREF: 5e11,               // ★ N。この強さの源が…
  GRAV_RREF: 2000 * KM,          // ★ …この距離で、開口 1 の観測者に SNR 1（ISD が等速で 2,000 km になるよう選んだ）
  GRAV_STANDING_G: 9.8,          // ★ 艦内の人工重力として常に制御している加速度 m/s²（源の強さ Q ＝ 質量 ×（これ ＋ 今の加速度））
  GRAV_PLANET_CLUTTER: 3,        // ★ 惑星の近くの雑音：雑音 ×(1 ＋ 3 ×(惑星半径 ÷ 惑星中心までの距離)²)
  WAKE_EVERY: 120,               // ★ 航跡波を残す間隔 s
  WAKE_TAU: 900,                 // ★ 航跡波が 1/e に薄れる時間 s
  WAKE_MAX_AGE: 2700,            // ★ これより古い航跡波は消す s
  WAKE_MIN_MASS: 1e7,            // ★ kg。これより軽いもの（航空機）は航跡波を残さない
  // ---- 船籍表示 ----
  XPDR_RANGE: 5000 * KM,         // ★ 船籍表示が届く距離（見通しが要る）
  XPDR_WAIT: 60,                 // ★ 届くはずの所で 60 秒受けられなければ「船籍表示なし」と判断
  // ---- 分類 ----
  QUIET_WAIT: 120,               // ★ 追跡中に 120 秒、あるはずの熱が見えなければ「浮遊物（推定）」
  QUIET_TYPICAL_W_PER_M2: 4.6e16,// ★ 「この大きさの船ならこのくらいの排熱」の目安 W/m²（作例艦の排熱 ÷ 反射断面積から）
  QUIET_MARGIN: 0.3,             // ★ 目安の 0.3 倍でも映るはずの距離でだけ「熱なし」と言える
  QUIET_NEED_SNR: 2,             // ★ そのとき要る SNR
  MOVE_SPEED: 100,               // ★ 追跡中のレーダー光点がこの速さ m/s より速く動いていれば「動力あり」（小惑星は 42 m/s 以下で置いている）
  MISASSOC_HOLD: 300,            // ★ 熱源を別の光点に取り違えたとき、その印が残る時間 s
  // ---- 追跡枠 ----
  TRACK_PER_ENGAGE: 2,           // ユーザーの指示：同時追跡数 ＝ 同時交戦数 × 2
  ENGAGE_FLOOR: 1,               // ★ 性能表の同時交戦数（aaCh）が 0 の艦は 1 とみなす（Core.AA_CHANNELS.base ＝ 近接の 1 枠）
  FLIGHT_PER_SLOT: 4,            // 航空機は 4 機で 1 枠（docs/fleet-orders.md、Core.AA_CHANNELS.flight）
  GROUP_RADIUS: 50 * KM,         // ★ この距離の中に固まっている光点は「ひとまとまり」として 1 枠で追跡する（ユーザーの記録 2026-11-25 §2：艦隊単位の追跡）
  LOCK_SLOTS: 1,                 // ★ ロックは 1 目標ごとに個別で、1 枠を使う（同 §2・§3）
  TRACK_EVERY: 30,               // ★ 枠の割り当てをやり直す間隔 s
  // ---- 偵察（ユーザーの指示：既存の航空機、2〜12 機の編隊）----
  RECON_SPACING: 100 * KM,       // ★ 編隊の中の機体の間隔（横一列）
  RECON_LOAD: 0.5,               // ★ 航続の見積もり：燃料のエネルギー ÷（反応炉出力 × 0.5）
  RECON_RANGE_USE: 0.9,          // ★ 航続のうち使う割合（残りは予備）
  RECON_LANES: [7300 * KM, 9000 * KM], // ★ 偵察の編隊が沿って飛ぶ帯の半径（編隊ごとに交互）
  RECON_LEG_DEG: 15,             // ★ 帯の上の経由点の間隔（惑星の中心から見た角度）
  RECON_DIVERT: 600 * KM,        // ★ 経路からこの距離までの未識別の光点は見に行く
  RECON_SEARCHED_HOLD: 900,      // ★ 行っても識別できなかった光点を、次に見に行くまでの間 s
  RECON_INVESTIGATE_QUIET: false,// ★「浮遊物（推定）」は見に行かない（場面 c2 では見に行く）
  CRUISE: C.CRUISE_SPEED_TARGET?.target ?? 0.7, // 巡航 ＝ 最高速度 × 0.7（Core.craftCruiseSpeed と同じ）
  FLEET_SPEED_SHARE: 0.7,        // ★ 艦隊は一番遅い艦の最高速度 × 0.7 で進む
  PATROL_SPEED_SHARE: 0.3,       // ★ 哨戒中の敵艦隊は一番遅い艦の最高速度 × 0.3
  PLANET_KEEPOUT: 500 * KM       // ★ 惑星の表面からこの高さより下は飛ばない
};
const MEANS = {vis: '目視', rad: 'レーダー', heat: 'ニュートリノ・熱', grav: '重力波', xpdr: '船籍表示', lock: 'ロックされた'};
const STAGE = ['未探知', '不明の光点', '浮遊物（推定）', '動力のある船', '商船・非敵対（船籍表示あり）', '不審（船籍表示なし）', '識別済'];
const ST = {NONE: 0, BLIP: 1, DEBRIS: 2, POWERED: 3, CIVIL: 4, SUSPECT: 5, ID: 6};

// ====================================================================================================
// 純粋な関数（後で Core へ移せる形。乱数や時刻は引数で受ける）
// ====================================================================================================
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = a => Math.hypot(a[0], a[1], a[2]), unit = a => { const l = len(a); return l > 0 ? mul(a, 1 / l) : [0, 0, 0]; };
function rng(seed) { let s = seed >>> 0; const r = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; r.gauss = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r()); r.range = (a, b) => a + (b - a) * r(); return r; }

// 性能表 → 索敵に使う特性。艦も航空機も小惑星も同じ形にして、同じ式へ通す。
function sensingTraits(p, extra = {}) {
  const L = p.len || 0, W = p.width || L * 0.4, H = p.height || L * 0.25;
  const dis = p.heat?.dis || [], capSum = dis.reduce((n, d) => n + (d.cap || 0), 0);
  let nu = 0, ir = 0;
  if (capSum > 0) for (const d of dis) { const b = K.EMIT.band[d.k] || K.EMIT.band.integral; nu += b[0] * d.cap / capSum; ir += b[1] * d.cap / capSum; } else { nu = K.EMIT.band.integral[0]; ir = K.EMIT.band.integral[1]; }
  const P = p.grid?.P || 0;
  return {
    len: L, width: W, height: H, maxDim: Math.max(L, W, H),
    sigma: p.sigma > 0 ? p.sigma : Math.round((L * H + W * H + L * W) / 3), // 反射断面積 m²（Core の unitSigma と同じ式）
    reactorW: P, wasteW: P * K.WASTE_SHARE, disCapW: capSum, bandNu: nu, bandIr: ir,
    sens: {nu: p.sens?.nu || 0, ir: p.sens?.ir || 0, rad: p.sens?.rad || 0},
    massKg: p.propulsion?.massKg || extra.massKg || 0, accel: p.accel || 0, maxSpeed: p.maxSpeed || 0,
    liftT: p.systems?.landingSupport || 0, fuelJ: p.fuel?.capacityJ || 0,
    engage: extra.engage ?? 0, ...extra
  };
}
// 構造物だけの浮遊物（小惑星）。動力・センサーなし。
function rockTraits(d) { return {len: d, width: d, height: d, maxDim: d, sigma: Math.round(d * d), reactorW: 0, wasteW: 0, disCapW: 0, bandNu: 0, bandIr: 0, sens: {nu: 0, ir: 0, rad: 0}, massKg: 2500 * d * d * d * 0.52, accel: 0, maxSpeed: 0, liftT: 0, fuelJ: 0, engage: 0, rock: true}; }
// 今の放射（W）。n は編隊の機数、emcon は放射管制。
function emission(tr, emcon, n = 1) { const cap = K.EMCON[emcon]?.cap ?? 1, w = Math.min(tr.wasteW * cap, tr.disCapW > 0 ? tr.disCapW * cap : Infinity) * n; return {nu: w * tr.bandNu, ir: w * tr.bandIr, em: 0}; }
// 重力波の源の強さ（N）：質量 ×（常に制御している人工重力 ＋ 今の加速度）。動力のないものは 0。
function gravSource(tr, accelNow, n = 1) { return tr.reactorW > 0 ? tr.massKg * n * (K.GRAV_STANDING_G + Math.abs(accelNow || 0)) : 0; }
// 重力波の SNR：1/r²。航跡波は decay（0〜1）を掛ける。観測者が惑星に近いほど雑音が増える。
function gravSNR(Q, aperture, r, decay, obsPlanetDist) { const clutter = 1 + K.GRAV_PLANET_CLUTTER * (K.PLANET_RADIUS / Math.max(K.PLANET_RADIUS, obsPlanetDist)) ** 2; return (Q / K.GRAV_QREF) * (K.GRAV_RREF / Math.max(1, r)) ** 2 * aperture * decay / clutter; }
// レーダー・ニュートリノ・赤外は既存の Core.sensSNR をそのまま呼ぶ（受動 1/r²、能動 1/r⁴）。
function bandSNR(sig, sigma, sens, r, radarOn) { return C.sensSNR(sig, sigma, {nu: sens.nu, ir: sens.ir, em: 0, rad: sens.rad}, r, radarOn ? 1 : 0); }
// 目視：点として見える距離、艦種が分かる距離。
function visualRanges(tgtMaxDim, obsIr) { const a = Math.sqrt(Math.max(0, obsIr)); return {see: tgtMaxDim * K.VIS_SEE_K * a, id: tgtMaxDim * K.VIS_ID_K * a}; }
// 見通し：線分 a–b が惑星に遮られるか。
function occulted(a, b) { const d = sub(b, a), L2 = dot(d, d); if (!(L2 > 0)) return false; const t = Math.max(0, Math.min(1, -dot(a, d) / L2)), q = add(a, mul(d, t)); return len(q) < K.PLANET_RADIUS; }
// 惑星の影（恒星の光が当たらない円柱）の中か。
function inShadow(pos) { const along = dot(pos, K.SUN_DIR); if (along <= 0) return false; const perp = sub(pos, mul(K.SUN_DIR, along)); return len(perp) < K.PLANET_RADIUS; }
// 雑音つきの測定値。
function measured(snr, r) { return snr > 0 ? snr * Math.exp(r.gauss() * K.NOISE_SIGMA) : 0; }
// しきい値の出入り（続けて超えたら映る、続けて下回ったら消える）。h = {on, up, down}
function holdStep(h, value, thr) { if (value >= thr) { h.up++; h.down = 0; if (!h.on && h.up >= K.LOOKS_ON) h.on = true; } else { h.up = 0; if (value < thr * K.OFF_RATIO) { h.down++; if (h.on && h.down >= K.LOOKS_OFF) h.on = false; } } return h.on; }
// 「この大きさの船なら熱が映るはず」か：熱なしと言ってよい距離にいるか。
function quietJudgeable(sigma, sens, r) { const w = K.QUIET_TYPICAL_W_PER_M2 * sigma * K.QUIET_MARGIN, s = bandSNR({nu: w * 0.8, ir: w * 0.15, em: 0}, 0, sens, r, false); return Math.max(s.nu, s.ir) >= K.QUIET_NEED_SNR; }
// 分類の段階：今ある情報（c）から決める。
function classify(c) {
  if (c.id) return ST.ID;
  if (c.xpdr === 'shown') return ST.CIVIL;
  const powered = c.hold.heat.on || c.hold.grav.on || c.moving || c.falseHeatUntil > c.now;
  if (powered && c.xpdr === 'none') return ST.SUSPECT;
  if (powered) return ST.POWERED;
  if (c.quiet) return ST.DEBRIS;
  return c.hold.rad.on || c.hold.vis.on ? ST.BLIP : ST.NONE;
}
// 追跡枠が足りないときの優先度（大きいほど先に枠をもらう）。★
function trackPriority(c) {
  if (c.id) return c.id.hostile ? (c.id.kind === 'flight' ? 60 : 100) : 0; // 識別済の敵艦 100、敵機 60、識別済の非敵（商船・小惑星・中立）は枠を返す
  switch (c.stage) { case ST.SUSPECT: return 90; case ST.POWERED: return 80; case ST.BLIP: return 70; case ST.DEBRIS: return 30; case ST.CIVIL: return 20; default: return 0; }
}
// 同時追跡数：同時交戦数（性能表の aaCh ＝ Core.shipTrackSlots。0 なら ★1）× 2。艦も航空機も同じ式。
function trackSlots(engage, n = 1) { return Math.max(K.ENGAGE_FLOOR, engage) * K.TRACK_PER_ENGAGE * n; }
// 目標にできる条件：枠を持って追跡中で、位置が使え、敵と印が付いている（確定、または推定を許すなら不審も）。
function targetable(c, allowPresumed) { return !!c.tracker && (c.id ? c.id.hostile : allowPresumed && c.stage === ST.SUSPECT); }

// ====================================================================================================
// 特性の読み込み（艦：data/fleet.js の性能表。航空機：作例の設計から Core.fleetProfile）
// ====================================================================================================
const plain = x => JSON.parse(JSON.stringify(x)), traitCache = new Map();
function shipTraits(key) { if (!traitCache.has(key)) { const d = F.designs[key]; if (!d) throw new Error('性能表にない艦: ' + key); const p = plain(d.p), u = C.fleetUnit('t_' + key, key, p, 0); traitCache.set(key, sensingTraits(p, {name: d.name, key, engage: C.shipTrackSlots(u), air: (d.air || []).filter(a => a.count > 0).map(a => ({type: a.type, count: a.count}))})); } return traitCache.get(key); }
function craftTraits(type) { const k = 'craft:' + type; if (!traitCache.has(k)) { const role = C.FLEET_AIR.roles[type]; if (!role) throw new Error('Core.FLEET_AIR.roles にない航空機: ' + type); const xs = C.buildDesign(role.key), S = C.computeStats(xs), p = C.fleetProfile(S, xs.name, xs); traitCache.set(k, sensingTraits(p, {name: xs.name, key: role.key, type, craft: true, massKg: S.mass * 1000, engage: p.aaCh || 0})); } return traitCache.get(k); }
function reconRange(tr) { const endurance = tr.fuelJ / Math.max(1, tr.reactorW * K.RECON_LOAD), v = tr.maxSpeed * K.CRUISE; return {speed: v, endurance, range: v * endurance}; }

// ====================================================================================================
// 場面
// ====================================================================================================
const REBEL = ['mc75', 'mc80liberty', 'nebulonb', 'nebulonb', 'cr90'], EMPIRE = ['imperial', 'imperial', 'arquitens', 'gozanti', 'gozanti'], SMALL = ['cr90', 'cr90', 'gozanti', 'gozanti', 'gozanti'];
const MERCHANT_KEYS = ['gr75', 'gr75', 'gr75', 'reptransport', 'reptransport', 'gozanti', 'gr75', 'lh3210'];
// recon: {types: 使う機種（母艦の搭載機から、この順に）, flights: 編隊の数, size: 1 編隊の機数, fan: 扇の半角°（360 なら全周）}
const SCENES = {
  a: {title: '(a) 偵察機あり：4 機 × 6 編隊', enemy: EMPIRE, enemyMode: 'patrol', recon: [{types: ['awing', 'xwing'], flights: 6, size: 4, fan: 120}, {types: ['tie_ln'], flights: 8, size: 4, fan: 360}]},
  a2x12: {title: '(a) の編隊ちがい：12 機 × 2 編隊', enemy: EMPIRE, enemyMode: 'patrol', recon: [{types: ['awing', 'xwing'], flights: 2, size: 12, fan: 120}, {types: ['tie_ln'], flights: 8, size: 4, fan: 360}]},
  a12x2: {title: '(a) の編隊ちがい：2 機 × 12 編隊', enemy: EMPIRE, enemyMode: 'patrol', recon: [{types: ['awing', 'xwing'], flights: 12, size: 2, fan: 120}, {types: ['tie_ln'], flights: 8, size: 4, fan: 360}]},
  b: {title: '(b) 味方は偵察機なし（敵は (a) と同じ）', enemy: EMPIRE, enemyMode: 'patrol', recon: [null, {types: ['tie_ln'], flights: 8, size: 4, fan: 360}]},
  c: {title: '(c) 敵は小型艦だけ、小惑星のそばで低放射：4 機 × 6 編隊', enemy: SMALL, enemyMode: 'hide', recon: [{types: ['awing', 'xwing'], flights: 6, size: 4, fan: 60}, null]},
  c2: {title: '(c2) (c) で「浮遊物（推定）」も見に行く', enemy: SMALL, enemyMode: 'hide', investigateQuiet: true, recon: [{types: ['awing', 'xwing'], flights: 6, size: 4, fan: 60}, null]},
  c2x12: {title: '(c) の編隊ちがい：12 機 × 2 編隊', enemy: SMALL, enemyMode: 'hide', recon: [{types: ['awing', 'xwing'], flights: 2, size: 12, fan: 60}, null]},
  c12x2: {title: '(c) の編隊ちがい：2 機 × 12 編隊', enemy: SMALL, enemyMode: 'hide', recon: [{types: ['awing', 'xwing'], flights: 12, size: 2, fan: 60}, null]},
  aLock: {title: '(aLock) (a) で、識別した敵艦に双方がロックを掛ける', lock: true, enemy: EMPIRE, enemyMode: 'patrol', recon: [{types: ['awing', 'xwing'], flights: 6, size: 4, fan: 120}, {types: ['tie_ln'], flights: 8, size: 4, fan: 360}]},
  cLock: {title: '(cLock) (c) 12 機 × 2 編隊で、識別した敵艦にロックを掛ける', lock: true, enemy: SMALL, enemyMode: 'hide', recon: [{types: ['awing', 'xwing'], flights: 2, size: 12, fan: 60}, null]},
  d: {title: '(d) 双方とも偵察機なし', enemy: EMPIRE, enemyMode: 'patrol', recon: [null, null]}
};
const SIDE_NAME = ['味方（反乱同盟）', '敵（帝国）'];
const polar = (r, deg, y = 0) => [r * Math.cos(deg * Math.PI / 180), y, r * Math.sin(deg * Math.PI / 180)];
const angleOf = p => Math.atan2(p[2], p[0]) * 180 / Math.PI;

function setup(sceneKey, seed) {
  const sc = SCENES[sceneKey], R = rng(seed * 7919 + 13), ents = [];
  const mk = o => { const e = {wake: [], accelNow: 0, emcon: 'normal', radarOn: true, xpdr: false, n: 1, vel: [0, 0, 0], path: [], ...o}; ents.push(e); return e; };
  // 味方艦隊：+x の縁から入り、惑星へ向かって半径 7,500 km の点まで進んで止まる
  const aStart = polar(9800 * KM, 0), aGoal = polar(7500 * KM, 0), aSpeed = Math.min(...REBEL.map(k => shipTraits(k).maxSpeed)) * K.FLEET_SPEED_SHARE;
  REBEL.forEach((key, i) => mk({id: 'A' + i + '_' + key, kind: 'ship', side: 0, key, tr: shipTraits(key), pos: add(aStart, [0, 0, (i - 2) * 5 * KM]), goal: add(aGoal, [0, 0, (i - 2) * 5 * KM]), speed: aSpeed}));
  // 敵艦隊
  const sign = R() < 0.5 ? -1 : 1, hide = sc.enemyMode === 'hide';
  const eAng = sign * (hide ? R.range(5, 20) : R.range(40, 110)), eRad = (hide ? R.range(7300, 9300) : R.range(7500, 9000)) * KM, eY = R.range(-500, 500) * KM, eCentre = polar(eRad, eAng, eY);
  const eSpeed = Math.min(...sc.enemy.map(k => shipTraits(k).maxSpeed)) * K.PATROL_SPEED_SHARE;
  sc.enemy.forEach((key, i) => { const off = [R.range(-1, 1) * (hide ? 20 : 8) * KM, R.range(-1, 1) * 3 * KM, R.range(-1, 1) * (hide ? 20 : 8) * KM];
    mk({id: 'B' + i + '_' + key, kind: 'ship', side: 1, key, tr: shipTraits(key), pos: add(eCentre, off), emcon: hide ? 'low' : 'normal', radarOn: !hide, patrol: hide ? null : {r: eRad, y: eY + off[1], dir: -sign, off}, speed: hide ? 0 : eSpeed}); });
  // 商船 8 隻：軌道に沿って動く。うち 2 隻は船籍表示なし（1 隻は怪しい商船、1 隻は出し忘れ）
  const noX = new Map([[1, '出し忘れ'], [5, '怪しい商船']]);
  MERCHANT_KEYS.forEach((key, i) => { const tr = shipTraits(key), near = noX.has(i), ang = near ? R.range(-50, 50) : R.range(-180, 180), r = (near ? K.RECON_LANES[i % K.RECON_LANES.length] / KM + R.range(-300, 300) : R.range(7000, 9800)) * KM, y = near ? R.range(-100, 100) * KM : R.range(-500, 500) * KM; // 船籍表示なしの 2 隻は、味方の偵察が通る帯の近く（入口から ±50°）に置く ★
    mk({id: 'M' + i + '_' + key, kind: 'ship', side: 2, key, tr, pos: polar(r, ang, y), xpdr: !noX.has(i), xpdrWhy: noX.get(i) || null, patrol: {r, y, dir: R() < 0.5 ? -1 : 1, off: [0, 0, 0]}, speed: tr.maxSpeed * K.CRUISE * 0.5}); });
  // 小惑星 30 個（構造物だけの浮遊物）：うち 8 個は敵の近くにかためる
  for (let i = 0; i < 30; i++) { const d = Math.round(R.range(30, 400)), near = i < 8;
    const pos = near ? add(eCentre, [R.range(-1, 1) * (hide ? 25 : 300) * KM, R.range(-1, 1) * (hide ? 5 : 100) * KM, R.range(-1, 1) * (hide ? 25 : 300) * KM]) : polar(R.range(6800, 9900) * KM, R.range(-180, 180), R.range(-500, 500) * KM);
    mk({id: 'R' + String(i).padStart(2, '0') + '_' + d + 'm', kind: 'rock', side: 3, key: 'rock', tr: rockTraits(d), pos, vel: [R.range(-30, 30), 0, R.range(-30, 30)], radarOn: false}); }
  // 偵察の編隊：母艦の搭載機から。機数が足りなければ編隊を減らす（積んでいる数を超えない）
  const notes = [];
  for (const side of [0, 1]) { const rc = sc.recon[side]; if (!rc) continue;
    const carriers = ents.filter(e => e.kind === 'ship' && e.side === side), stock = [];
    for (const type of rc.types) for (const cv of carriers) for (const a of cv.tr.air || []) if (a.type === type) stock.push({type, home: cv, left: a.count});
    const flights = [];
    for (let i = 0; i < rc.flights; i++) { const want = rc.types[i % rc.types.length], s = stock.find(x => x.type === want && x.left >= rc.size) || stock.find(x => x.left >= rc.size); if (!s) { notes.push(`${SIDE_NAME[side]}：搭載機が足りず、編隊は ${flights.length} 個`); break; } s.left -= rc.size; flights.push(s); }
    flights.forEach((s, i) => { const tr = craftTraits(s.type), rr = reconRange(tr), n = flights.length;
      // 扇形：母艦から見た方位を等間隔に割り振り、惑星を回り込む帯（半径 7,300 km と 9,000 km を交互）に沿って、割り振られた方位まで進んで戻る
      const homeAng = angleOf(s.home.pos), offs = rc.fan >= 360 ? (i + 0.5) * 360 / n - 180 : (n === 1 ? 0 : -rc.fan + i * 2 * rc.fan / (n - 1)), lane = K.RECON_LANES[i % K.RECON_LANES.length], route = [];
      for (let a = Math.min(K.RECON_LEG_DEG, Math.abs(offs)); ; a = Math.min(a + K.RECON_LEG_DEG, Math.abs(offs))) { route.push(polar(lane, homeAng + Math.sign(offs || 1) * a, s.home.pos[1])); if (a >= Math.abs(offs) - 1e-9) break; }
      mk({id: (side ? 'B' : 'A') + 'f' + i + '_' + s.type + 'x' + rc.size, kind: 'flight', side, key: tr.key, type: s.type, tr, n: rc.size, pos: s.home.pos.slice(), home: s.home, route, wp: 0, speed: rr.speed, rangeLeft: rr.range * K.RECON_RANGE_USE, state: 'out', searched: new Map()}); });
  }
  return {sc, sceneKey, seed, ents, notes, lock: !!sc.lock, R: rng(seed * 104729 + 7), eCentre, investigateQuiet: sc.investigateQuiet ?? K.RECON_INVESTIGATE_QUIET};
}

// ====================================================================================================
// 動き
// ====================================================================================================
function steer(pos, goal, speed, dt) { // 目的地へ向かう。惑星の近くでは内向きの成分を捨てて回り込む
  const to = sub(goal, pos), d = len(to); if (d <= speed * dt) return {pos: goal.slice(), vel: mul(unit(to), d / dt), arrived: true};
  let dir = unit(to); const keep = K.PLANET_RADIUS + K.PLANET_KEEPOUT, rr = len(pos);
  const closest = (() => { const t = Math.max(0, Math.min(1, -dot(pos, to) / dot(to, to))); return len(add(pos, mul(to, t))); })();
  if (closest < keep) { const rad = unit(pos), inward = dot(dir, rad); let tan = sub(dir, mul(rad, inward)); if (len(tan) < 1e-6) tan = [-rad[2], 0, rad[0]]; tan = unit(tan);
    const push = rr < keep ? 0.5 : rr < keep * 1.15 ? 0 : -0.35; dir = unit(add(tan, mul(rad, push))); }
  const vel = mul(dir, speed); return {pos: add(pos, mul(vel, dt)), vel, arrived: false};
}
function moveAll(W, t, dt) {
  for (const e of W.ents) {
    if (e.gone) continue; const v0 = e.vel;
    if (e.kind === 'rock') e.pos = add(e.pos, mul(e.vel, dt));
    else if (e.kind === 'flight') flightStep(W, e, t, dt);
    else if (e.patrol) { const w = e.speed / e.patrol.r * e.patrol.dir, base = sub(e.pos, e.patrol.off), a = Math.atan2(base[2], base[0]) + w * dt, np = add([e.patrol.r * Math.cos(a), e.patrol.y, e.patrol.r * Math.sin(a)], e.patrol.off); e.vel = mul(sub(np, e.pos), 1 / dt); e.pos = np; }
    else if (e.goal && e.speed > 0) { const s = steer(e.pos, e.goal, e.speed, dt); e.pos = s.pos; e.vel = s.arrived ? [0, 0, 0] : s.vel; if (s.arrived) e.goal = null; }
    e.accelNow = len(sub(e.vel, v0)) / dt;
    if (e.kind !== 'rock' && e.tr.massKg * e.n >= K.WAKE_MIN_MASS && len(e.vel) > 1 && t % K.WAKE_EVERY < dt) { e.wake.push({pos: e.pos.slice(), t, Q: gravSource(e.tr, e.accelNow, e.n)}); while (e.wake.length && t - e.wake[0].t > K.WAKE_MAX_AGE) e.wake.shift(); }
    if (t % 300 < dt) e.path.push([e.pos[0], e.pos[2]]);
  }
}
function flightStep(W, f, t, dt) {
  const side = W.sides[f.side]; let goal = null;
  if (f.state !== 'back' && f.rangeLeft < len(sub(f.home.pos, f.pos)) * 1.1 + f.speed * dt * 2) { f.state = 'back'; f.investigate = null; }
  if (f.state !== 'back') {
    // 見に行く光点を選ぶ：未識別で、船籍表示がなく、ほかの編隊が向かっていないもの。不審 → 動力あり → 不明の順、近い順
    const cur = f.investigate && side.contacts.get(f.investigate);
    if (cur && (cur.id || cur.xpdr === 'shown' || cur.stage === ST.NONE || !cur.est)) { side.claims.delete(f.investigate); f.investigate = null; }
    if (!f.investigate) { let best = null, bestScore = -Infinity;
      for (const c of side.contacts.values()) { if (c.id || c.xpdr === 'shown' || !c.est || c.stage === ST.NONE || c.target.kind === 'flight') continue; if (c.stage === ST.DEBRIS && !W.investigateQuiet) continue; if (side.claims.has(c.target.id)) continue; if ((f.searched.get(c.target.id) ?? -Infinity) > t) continue;
        const d = len(sub(c.est, f.pos)); if (d > K.RECON_DIVERT) continue; const score = (c.stage === ST.SUSPECT ? 3 : c.stage === ST.POWERED ? 2 : c.stage === ST.BLIP ? 1 : 0) * 1e9 - d; if (score > bestScore) { bestScore = score; best = c; } }
      if (best) { f.investigate = best.target.id; side.claims.set(best.target.id, f.id); side.log.diverts++; } }
    const c = f.investigate && side.contacts.get(f.investigate);
    if (c) { goal = c.est; if (len(sub(c.est, f.pos)) < 3 * KM) { f.searched.set(c.target.id, t + K.RECON_SEARCHED_HOLD); side.claims.delete(c.target.id); f.investigate = null; goal = f.route[f.wp]; } } else goal = f.route[f.wp];
  } else goal = f.home.pos;
  const s = steer(f.pos, goal, f.speed, dt); f.rangeLeft -= len(sub(s.pos, f.pos)); f.pos = s.pos; f.vel = s.vel;
  if (s.arrived) { if (f.state === 'back') { f.gone = true; f.landedAt = t; } else if (!f.investigate) { if (f.wp < f.route.length - 1) f.wp++; else f.state = 'back'; } }
}
// 編隊の機体の位置（横一列）。観測者としては 1 機ずつ、相手から見た目標としては編隊で 1 つ。
function observerPoints(e) { if (e.kind !== 'flight' || e.n === 1) return [e.pos]; const v = unit([e.vel[0], 0, e.vel[2]]), lat = len(v) > 0 ? [-v[2], 0, v[0]] : [0, 0, 1], out = []; for (let i = 0; i < e.n; i++) out.push(add(e.pos, mul(lat, (i - (e.n - 1) / 2) * K.RECON_SPACING))); return out; }

// ====================================================================================================
// 索敵：各陣営は真値を使わず、自分のセンサーに映ったものだけで接触（光点）の一覧を作る
// ====================================================================================================
function newContact(target, t) { return {target, now: t, hold: {vis: {on: false, up: 0, down: 0}, rad: {on: false, up: 0, down: 0}, heat: {on: false, up: 0, down: 0}, grav: {on: false, up: 0, down: 0}}, xpdr: 'unknown', xpdrSince: null, quiet: false, quietSince: null, falseHeatUntil: -Infinity, id: null, stage: ST.NONE, est: null, err: Infinity, tracker: null, fixers: [], first: null, firstBy: {}, stageLog: [], maxStage: 0, trackedTime: 0, wakeFirst: false}; }
function senseSide(W, sideIx, t, dt) {
  const side = W.sides[sideIx], R = W.R, obs = W.ents.filter(e => e.side === sideIx && !e.gone && e.kind !== 'rock');
  const obsPts = obs.map(o => ({o, pts: observerPoints(o), pd: 0})); for (const x of obsPts) x.pd = len(x.o.pos);
  for (const tg of W.ents) {
    if (tg.side === sideIx || tg.gone) continue;
    let c = side.contacts.get(tg.id); const sig = emission(tg.tr, tg.emcon, tg.n), sigma = tg.tr.sigma * tg.n, Q = gravSource(tg.tr, tg.accelNow, tg.n), dark = inShadow(tg.pos);
    let best = {rad: 0, heat: 0, grav: 0}, bestD = {vis: Infinity, rad: Infinity, heat: Infinity, grav: Infinity, xpdr: Infinity}, see = false, idVis = false, xpdrHeard = false, xpdrCould = false, gravAt = null, gravWake = false, quietOK = false, fixers = [], radImg = 0, irImg = 0, dMin = Infinity;
    for (const x of obsPts) { const o = x.o; let oRad = 0, oIr = 0, oSee = false;
      for (const p of x.pts) { const d = len(sub(tg.pos, p)); dMin = Math.min(dMin, d); const los = !occulted(p, tg.pos);
        // 重力波（惑星は遮らない）：本体と、残っている航跡波のうち強い方
        if (Q > 0 || tg.wake.length) { let g = gravSNR(Q, o.tr.sens.nu, d, 1, x.pd), at = tg.pos, wk = false; for (const w of tg.wake) { const gw = gravSNR(w.Q, o.tr.sens.nu, len(sub(w.pos, p)), Math.exp(-(t - w.t) / K.WAKE_TAU), x.pd); if (gw > g) { g = gw; at = w.pos; wk = true; } } if (g > best.grav) { best.grav = g; gravAt = at; gravWake = wk; bestD.grav = d; } }
        const s = bandSNR(sig, sigma, o.tr.sens, d, o.radarOn && los);
        // ニュートリノ（惑星は遮らない）と赤外（見通しが要る）
        const h = Math.max(s.nu, los ? s.ir : 0); if (h > best.heat) { best.heat = h; bestD.heat = d; }
        if (!los) continue;
        if (s.rad > best.rad) { best.rad = s.rad; bestD.rad = d; } oRad = Math.max(oRad, s.rad); oIr = Math.max(oIr, s.ir);
        // 目視（見通しと日照が要る）
        if (!dark) { const vr = visualRanges(tg.tr.maxDim, o.tr.sens.ir); if (d <= vr.see) { see = true; oSee = true; bestD.vis = Math.min(bestD.vis, d); } if (d <= vr.id) idVis = true; }
        // 船籍表示（見通しと距離）
        if (d <= K.XPDR_RANGE) { xpdrCould = true; if (tg.xpdr) { xpdrHeard = true; bestD.xpdr = Math.min(bestD.xpdr, d); } }
        if (quietJudgeable(sigma, o.tr.sens, d)) quietOK = true;
      }
      const fix = Math.max(oRad, oIr, oSee ? K.FIX_SNR : 0); if (fix >= K.FIX_SNR) fixers.push([o, fix]); radImg = Math.max(radImg, oRad); irImg = Math.max(irImg, oIr);
    }
    const m = {rad: measured(best.rad, R), heat: measured(best.heat, R), grav: measured(best.grav, R)};
    if (!c) { if (!(see || xpdrHeard || m.rad >= K.DET_SNR * K.OFF_RATIO || m.heat >= K.DET_SNR * K.OFF_RATIO || m.grav >= K.DET_SNR * K.OFF_RATIO)) continue; c = newContact(tg, t); side.contacts.set(tg.id, c); }
    c.now = t; const was = {...Object.fromEntries(Object.entries(c.hold).map(([k, h]) => [k, h.on])), xpdr: c.xpdr === 'shown'};
    holdStep(c.hold.rad, m.rad, K.DET_SNR); holdStep(c.hold.heat, m.heat, K.DET_SNR); holdStep(c.hold.grav, m.grav, K.DET_SNR); c.hold.vis.on = see;
    // 船籍表示：届けば即座に分かる。届くはずの所で一定時間受けられなければ「なし」。なぜ出していないか（敵・怪しい・忘れ）は分からない
    if (xpdrHeard) { c.xpdr = 'shown'; c.xpdrSince = null; } else if (xpdrCould && (c.hold.rad.on || c.hold.heat.on || c.hold.grav.on || see)) { c.xpdrSince ??= t; if (c.xpdr !== 'shown' && t - c.xpdrSince >= K.XPDR_WAIT) c.xpdr = 'none'; } else if (c.xpdr !== 'none') c.xpdrSince = null;
    for (const k of ['vis', 'rad', 'heat', 'grav']) if (c.hold[k].on && !was[k] && c.firstBy[k] == null) { c.firstBy[k] = {t, d: bestD[k]}; if (k === 'grav' && gravWake) c.wakeFirst = true; }
    if (c.xpdr === 'shown' && !was.xpdr && c.firstBy.xpdr == null) c.firstBy.xpdr = {t, d: bestD.xpdr};
    const anyOn = c.hold.vis.on || c.hold.rad.on || c.hold.heat.on || c.hold.grav.on || c.xpdr === 'shown';
    if (anyOn && !c.first) { const k = ['vis', 'rad', 'heat', 'grav', 'xpdr'].filter(k => c.firstBy[k]?.t === t); c.first = {t, means: k, d: Math.min(...k.map(x => c.firstBy[x].d))}; }
    // 位置の見積もり：レーダー・目視・船籍表示があれば正確。受動だけなら誤差つき（方位誤差 errK ÷ √SNR × 距離）
    c.fixers = fixers; const precise = c.hold.rad.on || c.hold.vis.on || c.xpdr === 'shown';
    if (precise) { c.est = tg.pos.slice(); c.err = 100; c.estAt = t; }
    else if (c.hold.heat.on || c.hold.grav.on) { const byHeat = c.hold.heat.on && m.heat >= m.grav, snr = Math.max(byHeat ? m.heat : m.grav, 0.25), d = byHeat ? bestD.heat : bestD.grav, err = d * K.SENS.errK / Math.sqrt(snr), at = byHeat ? tg.pos : (gravAt || tg.pos);
      if (c.estAt == null || t - c.estAt >= 120 || !(Math.abs(err - c.err) < c.err * 0.3)) { c.est = add(at, [R.gauss() * err * 0.5, R.gauss() * err * 0.15, R.gauss() * err * 0.5]); c.err = err; c.estAt = t;
        // 取り違え：誤差の範囲に別のレーダー光点（未識別）があると、熱源をそちらの光点のものと読んでしまう
        if (c.hold.heat.on) { let near = null, nd = Infinity; for (const x of side.contacts.values()) { if (x === c || x.id || !x.hold.rad.on || x.xpdr === 'shown') continue; const dd = len(sub(x.target.pos, c.est)); if (dd < err && dd < nd) { nd = dd; near = x; } } if (near) { if (!(near.falseHeatUntil > t)) side.log.misassoc.push({t, heatOf: tg.id, onto: near.target.id}); near.falseHeatUntil = t + K.MISASSOC_HOLD; } } } }
    else if (!anyOn) { /* 何も映っていない：最後の位置のまま残す */ }
    if (c.tracker && c.hold.rad.on && len(tg.vel) > K.MOVE_SPEED) { if (!c.moving) c.movingT = t; c.moving = true; }
    // 「浮遊物（推定）」：追跡中に、あるはずの熱が一定時間見えない（船籍表示もない）
    if (c.tracker && c.hold.rad.on && !c.moving && !c.hold.heat.on && !c.hold.grav.on && !(c.falseHeatUntil > t) && c.xpdr !== 'shown' && quietOK) { c.quietSince ??= t; if (t - c.quietSince >= K.QUIET_WAIT) c.quiet = true; } else { c.quietSince = null; if (c.hold.heat.on || c.hold.grav.on || c.xpdr === 'shown') c.quiet = false; }
    // 識別：目視で近づく（枠は不要）か、追跡中にレーダーの像（SNR 20）・赤外の像（SNR 40）
    if (!c.id) { const by = idVis ? 'vis' : c.tracker && measured(radImg, R) >= K.SENS.idRad ? 'rad' : c.tracker && measured(irImg, R) >= K.SENS.idIr ? 'heat' : null;
      if (by) c.id = {t, by, d: dMin, kind: tg.kind === 'rock' ? 'rock' : tg.kind === 'flight' ? 'flight' : tg.side === 2 ? 'merchant' : 'warship', hostile: tg.side === 1 - sideIx, name: tg.tr.name || '小惑星', homeD: Math.min(...obs.filter(o => o.kind === 'ship').map(o => len(sub(o.pos, tg.pos))))}; }
    const st = anyOn || c.id ? classify(c) : (c.id ? ST.ID : ST.NONE);
    if (st !== c.stage) { c.stage = st; c.stageLog.push({t, stage: st}); if (st > c.maxStage) c.maxStage = st; }
    if (c.tracker) c.trackedTime += dt;
  }
}
// 追跡枠の割り当て（艦隊で共有）。ユーザーの記録 docs/handoff-2026-11-25/README.md に合わせた形：
//  ・見つけた光点を 1 つずつ追い続けない。近くに固まっている光点は「ひとまとまり」として 1 枠で追跡する（§2）
//  ・ロックは個別の指定で、1 目標に 1 枠（§2）。残りの枠は対空・迎撃のために空けておく（§3。迎撃そのものは計算していない）
//  ・ロックされた側は、それまで知らなかった相手でも、ロック元を必ず敵とマークする（§1）
function allocateTracks(W, sideIx, t) {
  const side = W.sides[sideIx], plats = W.ents.filter(e => e.side === sideIx && !e.gone && e.kind !== 'rock'), free = new Map(plats.map(p => [p.id, trackSlots(p.tr.engage, p.n)]));
  const cap = [...free.values()].reduce((a, b) => a + b, 0), list = [...side.contacts.values()].filter(c => c.stage !== ST.NONE || c.id).map(c => ({c, pr: trackPriority(c)})).filter(x => x.pr > 0 && x.c.fixers.length && x.c.est).sort((a, b) => b.pr - a.pr);
  let used = 0, dropped = 0, groups = 0; for (const c of side.contacts.values()) c.tracker = null;
  const done = new Set();
  for (const {c: seed} of list) { if (done.has(seed)) continue; const members = [seed]; done.add(seed);
    for (let i = 0; i < members.length; i++) for (const {c} of list) if (!done.has(c) && len(sub(c.est, members[i].est)) <= K.GROUP_RADIUS) { done.add(c); members.push(c); }
    const cand = members.flatMap(m => m.fixers).filter(([o]) => !o.gone && (free.get(o.id) || 0) >= 1).sort((a, b) => b[1] - a[1])[0];
    if (cand) { free.set(cand[0].id, free.get(cand[0].id) - 1); used++; groups++; for (const m of members) { m.tracker = cand[0].id; m.groupSize = members.length; } } else { dropped++; for (const m of members) m.droppedCount = (m.droppedCount || 0) + 1; } }
  // ロック：識別して敵と分かった艦へ、追跡している艦・編隊が個別に掛ける（場面で lock を有効にしたときだけ ★）
  let locks = 0;
  if (W.lock) for (const {c} of list) { if (!(c.id?.hostile && c.id.by !== 'lock' && c.target.kind === 'ship' && c.tracker)) { c.locked = c.locked && null; continue; }
    const by = c.fixers.filter(([o]) => !o.gone && (free.get(o.id) || 0) >= K.LOCK_SLOTS).sort((a, b) => b[1] - a[1])[0]; if (!by) continue; free.set(by[0].id, free.get(by[0].id) - K.LOCK_SLOTS); used += K.LOCK_SLOTS; locks++; c.lockT ??= t;
    // 掛けられた側：ロック元の位置が分かり、敵とマークする
    const other = W.sides[c.target.side], locker = by[0]; let x = other.contacts.get(locker.id); const knew = !!(x && (x.first || x.id)); if (!x) { x = newContact(locker, t); other.contacts.set(locker.id, x); }
    x.est = locker.pos.slice(); x.err = 100; x.estAt = t; const d = len(sub(locker.pos, c.target.pos));
    if (!x.lockMark) { x.lockMark = {t, knewBefore: knew, d}; x.firstBy.lock = {t, d}; if (!x.first) x.first = {t, means: ['lock'], d}; }
    if (!x.id) { x.id = {t, by: 'lock', d, kind: locker.kind === 'flight' ? 'flight' : 'warship', hostile: true, name: 'ロック元', homeD: d}; x.stage = ST.ID; x.stageLog.push({t, stage: ST.ID}); } }
  const indiv = [...side.contacts.values()].filter(c => c.tracker).length;
  side.log.trackCap = Math.max(side.log.trackCap, cap); side.log.trackMax = Math.max(side.log.trackMax, used); side.log.trackWant = Math.max(side.log.trackWant, used + dropped); side.log.indivMax = Math.max(side.log.indivMax, indiv + locks); side.log.groupMax = Math.max(side.log.groupMax, groups); side.log.lockMax = Math.max(side.log.lockMax, locks); side.log.freeMin = Math.min(side.log.freeMin, cap - used); if (dropped) side.log.shortSteps++; side.log.allocs++;
  // 目標にできるようになった時刻
  for (const c of side.contacts.values()) { if (c.targetT == null && targetable(c, false)) c.targetT = t; if (c.targetPresumedT == null && targetable(c, true)) c.targetPresumedT = t; }
}

// ====================================================================================================
// 1 回の計算と集計
// ====================================================================================================
function run(sceneKey, seed) {
  const W = setup(sceneKey, seed); W.sides = [0, 1].map(() => ({contacts: new Map(), claims: new Map(), log: {misassoc: [], diverts: 0, trackMax: 0, trackWant: 0, trackCap: 0, shortSteps: 0, allocs: 0, indivMax: 0, groupMax: 0, lockMax: 0, freeMin: Infinity}}));
  for (let t = 0; t <= K.LIMIT; t += K.DT) { moveAll(W, t, K.DT); for (const s of [0, 1]) senseSide(W, s, t, K.DT); if (t % K.TRACK_EVERY < K.DT) for (const s of [0, 1]) allocateTracks(W, s, t); }
  return summarize(W);
}
const firstStage = (c, st) => c.stageLog.find(x => x.stage === st)?.t ?? null;
function summarize(W) {
  const out = {scene: W.sceneKey, seed: W.seed, notes: W.notes, sides: []};
  for (const s of [0, 1]) { const side = W.sides[s], rows = [];
    for (const e of W.ents) { if (e.side === s) continue; const c = side.contacts.get(e.id);
      rows.push({id: e.id, truth: e.kind === 'rock' ? '小惑星' : e.kind === 'flight' ? `${s === e.side ? '' : '敵'}機の編隊 ${e.tr.name}×${e.n}` : e.side === 2 ? `商船 ${e.tr.name}${e.xpdr ? '' : '（船籍表示なし：' + e.xpdrWhy + '）'}` : `敵艦 ${e.tr.name}`, kind: e.kind, hostile: e.side === 1 - s, merchant: e.side === 2, noXpdr: e.side === 2 && !e.xpdr,
        first: c?.first || null, firstBy: c?.firstBy || {}, wakeFirst: !!c?.wakeFirst, tPowered: c ? firstStage(c, ST.POWERED) : null, tDebris: c ? firstStage(c, ST.DEBRIS) : null, tCivil: c ? firstStage(c, ST.CIVIL) : null, tSuspect: c ? firstStage(c, ST.SUSPECT) : null, id: c?.id || null, targetT: c?.targetT ?? null, targetPresumedT: c?.targetPresumedT ?? null, lockT: c?.lockT ?? null, lockMark: c?.lockMark || null, trackedTime: c?.trackedTime || 0, dropped: c?.droppedCount || 0, finalStage: c ? c.stage : 0}); }
    const foes = rows.filter(r => r.hostile && r.kind === 'ship'), min = xs => { const v = xs.filter(x => x != null); return v.length ? Math.min(...v) : null; };
    out.sides.push({rows, log: side.log,
      tBlip: min(foes.map(r => r.first?.t)), blipMeans: (() => { const r = foes.filter(r => r.first).sort((a, b) => a.first.t - b.first.t)[0]; return r ? {means: r.first.means, d: r.first.d, wake: r.wakeFirst && r.first.means.includes('grav')} : null; })(),
      tSuspect: min(foes.map(r => r.tSuspect)), tConfirm: min(foes.map(r => r.id?.t)), tLockMarkShip: min(foes.filter(r => r.lockMark).map(r => r.lockMark.t)), confirmBy: (() => { const r = foes.filter(r => r.id).sort((a, b) => a.id.t - b.id.t)[0]; return r ? {by: r.id.by, d: r.id.d, homeD: r.id.homeD} : null; })(), tTarget: min(foes.map(r => r.targetT)), tTargetPresumed: min(foes.map(r => r.targetPresumedT)),
      foes: foes.length, foesSeen: foes.filter(r => r.first).length, foesConfirmed: foes.filter(r => r.id).length, foesAsDebris: foes.filter(r => r.tDebris != null && !r.id).length,
      tLock: min(foes.map(r => r.lockT)), lockMarks: rows.filter(r => r.lockMark).map(r => ({t: r.lockMark.t, knewBefore: r.lockMark.knewBefore, who: r.truth, d: r.lockMark.d})),
      tFlightSeen: min(rows.filter(r => r.hostile && r.kind === 'flight').map(r => r.first?.t)),
      rocksSeen: rows.filter(r => r.kind === 'rock' && r.first).length, rocksId: rows.filter(r => r.kind === 'rock' && r.id).length, rocksSuspect: rows.filter(r => r.kind === 'rock' && r.tSuspect != null).length,
      merchSeen: rows.filter(r => r.merchant && r.first).length, merchCivil: rows.filter(r => r.merchant && r.tCivil != null).length, merchSuspect: rows.filter(r => r.merchant && r.tSuspect != null).length, merchSuspectNoX: rows.filter(r => r.noXpdr && r.tSuspect != null).length, merchId: rows.filter(r => r.merchant && r.id).length}); }
  out.map = {ents: W.ents.map(e => ({id: e.id, kind: e.kind, side: e.side, xpdr: e.xpdr, n: e.n, path: e.path, end: [e.pos[0], e.pos[2]], name: e.tr.name}))};
  // 敵艦が識別された瞬間の位置（図に使う）
  out.map.confirms = out.sides[0].rows.filter(r => r.hostile && r.kind === 'ship' && r.id).map(r => ({id: r.id, t: r.id.t}));
  return out;
}

// ====================================================================================================
// 出力（Markdown の表、JSON、上から見た図）
// ====================================================================================================
const hm = t => t == null ? '—' : `${Math.floor(t / 3600)}:${String(Math.floor(t % 3600 / 60)).padStart(2, '0')}:${String(Math.round(t % 60)).padStart(2, '0')}`;
const km = d => d == null || !Number.isFinite(d) ? '—' : Math.round(d / KM).toLocaleString('en-US') + ' km';
const med = xs => { const v = xs.filter(x => x != null).sort((a, b) => a - b); return v.length ? v[Math.floor((v.length - 1) / 2)] : null; };
const meansJa = ks => ks.map(k => MEANS[k]).join('＋');
function timelineMd(r, s) {
  const rows = r.sides[s].rows.slice().sort((a, b) => (a.first?.t ?? 1e12) - (b.first?.t ?? 1e12));
  let md = `| 真の姿（${SIDE_NAME[s]}には見えない） | 初探知 | 手段 | 距離 | 動力あり | 浮遊物（推定） | 船籍あり | 不審 | 識別（手段・距離） | 目標にできる | 追跡した時間 |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n`;
  for (const x of rows) md += `| ${x.truth} | ${hm(x.first?.t)} | ${x.first ? meansJa(x.first.means) + (x.wakeFirst && x.first.means.includes('grav') ? '（航跡波）' : '') : '見つからず'} | ${km(x.first?.d)} | ${hm(x.tPowered)} | ${hm(x.tDebris)} | ${hm(x.tCivil)} | ${hm(x.tSuspect)} | ${x.id ? hm(x.id.t) + '（' + MEANS[x.id.by] + '、' + km(x.id.d) + '）' : '—'} | ${x.hostile ? hm(x.targetT) : '—'} | ${Math.round(x.trackedTime / 60)} 分 |\n`;
  return md;
}
function sceneSummary(key, runs) {
  const sc = SCENES[key]; let md = `### ${sc.title}\n\n| 種 | 味方が敵艦を：初探知（手段・距離） | 不審と判断 | 識別＝敵と確定（手段・距離） | 目標にできる | 敵が味方艦を：初探知（手段・距離） | 識別＝敵と確定 | 目標にできる | 先に確定した側（差） | 確定時の自艦隊からの距離：味方→敵／敵→味方 | 攻撃隊が届く時刻（確定＋飛行）：味方／敵 | 先に攻撃隊が届く側（差） |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n`;
  const strike = (S, type) => S.tConfirm == null ? null : S.tConfirm + S.confirmBy.homeD / reconRange(craftTraits(type)).speed;
  const lead = (a, b) => a == null && b == null ? 'どちらもなし' : b == null ? '味方（敵はなし）' : a == null ? '敵（味方はなし）' : a === b ? '同時' : a < b ? `味方（${Math.round((b - a) / 60)} 分）` : `敵（${Math.round((a - b) / 60)} 分）`;
  for (const r of runs) { const [A, B] = r.sides; md += `| ${r.seed} | ${hm(A.tBlip)}${A.blipMeans ? '（' + meansJa(A.blipMeans.means) + (A.blipMeans.wake ? '・航跡波' : '') + '、' + km(A.blipMeans.d) + '）' : ''} | ${hm(A.tSuspect)} | ${hm(A.tConfirm)}${A.confirmBy ? '（' + MEANS[A.confirmBy.by] + '、' + km(A.confirmBy.d) + '）' : ''} | ${hm(A.tTarget)} | ${hm(B.tBlip)}${B.blipMeans ? '（' + meansJa(B.blipMeans.means) + (B.blipMeans.wake ? '・航跡波' : '') + '、' + km(B.blipMeans.d) + '）' : ''} | ${hm(B.tConfirm)} | ${hm(B.tTarget)} | ${lead(A.tConfirm, B.tConfirm)} | ${km(A.confirmBy?.homeD)}／${km(B.confirmBy?.homeD)} | ${hm(strike(A, 'xwing'))}／${hm(strike(B, 'tie_ln'))} | ${lead(strike(A, 'xwing'), strike(B, 'tie_ln'))} |\n`; }
  md += `\n| 種 | 味方：敵艦を識別／全数 | 敵艦を浮遊物と誤判定 | 小惑星：映った／識別／不審扱い（誤認） | 商船：映った／船籍で商船／不審扱い（うち船籍なしの 2 隻）／識別 | 熱源の取り違え | 追跡枠：最大使用（まとまり＋ロック）／1 つずつ追った場合／持ち数／空きの最小 | 枠が足りなかった割合 | 偵察が光点へ向かった回数 | 敵：味方艦を識別／全数 | 敵の追跡枠：最大使用／1 つずつ追った場合／持ち数 | ロック：味方が掛けた時刻／敵が掛けた時刻 | ロック元としてマークされた相手（時刻、それまで知っていたか） |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n`;
  const lm = (S, who) => S.lockMarks.map(x => `${who}が ${x.who} を ${hm(x.t)}（${x.knewBefore ? '既に映っていた' : '知らなかった'}）`).join('；');
  for (const r of runs) { const [A, B] = r.sides; md += `| ${r.seed} | ${A.foesConfirmed}/${A.foes} | ${A.foesAsDebris} | ${A.rocksSeen}／${A.rocksId}／${A.rocksSuspect} | ${A.merchSeen}／${A.merchCivil}／${A.merchSuspect}（${A.merchSuspectNoX}）／${A.merchId} | ${A.log.misassoc.length} | ${A.log.trackMax}／${A.log.indivMax}／${A.log.trackCap}／${A.log.freeMin} | ${Math.round(100 * A.log.shortSteps / Math.max(1, A.log.allocs))}% | ${A.log.diverts} | ${B.foesConfirmed}/${B.foes} | ${B.log.trackMax}／${B.log.indivMax}／${B.log.trackCap} | ${hm(A.tLock)}／${hm(B.tLock)} | ${[lm(A, '味方'), lm(B, '敵')].filter(Boolean).join('；') || '—'} |\n`; }
  const notes = [...new Set(runs.flatMap(r => r.notes))]; if (notes.length) md += `\n注：${notes.join('；')}\n`;
  return md + '\n';
}
function overallRow(key, runs) { const A = runs.map(r => r.sides[0]), B = runs.map(r => r.sides[1]), n = runs.length, cnt = f => runs.filter(f).length, sum = (xs, f) => xs.reduce((s, x) => s + f(x), 0);
  const firstA = cnt(r => r.sides[0].tConfirm != null && (r.sides[1].tConfirm == null || r.sides[0].tConfirm < r.sides[1].tConfirm)), firstB = cnt(r => r.sides[1].tConfirm != null && (r.sides[0].tConfirm == null || r.sides[1].tConfirm < r.sides[0].tConfirm));
  return `| ${SCENES[key].title} | ${n} | ${cnt(r => r.sides[0].tBlip != null)}/${n}、${hm(med(A.map(x => x.tBlip)))} | ${cnt(r => r.sides[0].tConfirm != null)}/${n}、${hm(med(A.map(x => x.tConfirm)))} | ${sum(A, x => x.foesConfirmed)}/${sum(A, x => x.foes)} | ${cnt(r => r.sides[1].tConfirm != null)}/${n}、${hm(med(B.map(x => x.tConfirm)))} | 味方 ${firstA}・敵 ${firstB}・なし ${n - firstA - firstB} | ${sum(A, x => x.foesAsDebris)} | 小惑星 ${sum(A, x => x.rocksSuspect)}、商船 ${sum(A, x => x.merchSuspect)}（うち船籍なし ${sum(A, x => x.merchSuspectNoX)}） | ${Math.max(...A.map(x => x.log.trackMax))}／${Math.max(...A.map(x => x.log.indivMax))}／${Math.max(...A.map(x => x.log.trackCap))} |\n`; }

function traitsMd(keys, craftTypes) {
  let md = `| 艦・機体 | 全長×幅×高さ m | 反射断面積 m² | 反応炉出力 W | 排熱（出力×${K.WASTE_SHARE}）W | ニュートリノ：赤外の割合 | 質量 kg | 重力波の源 N（等速） | センサー開口 ν／赤外／レーダー | 同時交戦数（性能表） | 同時追跡数 | 最高速度 m/s |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n`;
  const row = tr => `| ${tr.name}${tr.craft ? '（航空機）' : ''} | ${Math.round(tr.len)}×${Math.round(tr.width)}×${Math.round(tr.height)} | ${tr.sigma.toLocaleString('en-US')} | ${tr.reactorW.toExponential(2)} | ${tr.wasteW.toExponential(2)} | ${tr.bandNu.toFixed(2)}：${tr.bandIr.toFixed(2)} | ${tr.massKg.toExponential(2)} | ${gravSource(tr, 0).toExponential(2)} | ${tr.sens.nu}／${tr.sens.ir}／${tr.sens.rad} | ${tr.engage} | ${trackSlots(tr.engage)} | ${Math.round(tr.maxSpeed)} |\n`;
  for (const k of keys) md += row(shipTraits(k)); for (const t of craftTypes) md += row(craftTraits(t));
  md += `\n偵察機の速度と航続（★ 航続 ＝ 燃料のエネルギー ÷（反応炉出力 × ${K.RECON_LOAD}）× 巡航速度）：\n\n| 機体 | 巡航 m/s（最高×${K.CRUISE}） | 滞空 | 航続 km | 母艦の搭載数（性能表） |\n| --- | --- | --- | --- | --- |\n`;
  for (const t of craftTypes) { const tr = craftTraits(t), rr = reconRange(tr), stock = [...new Set([...REBEL, ...EMPIRE])].map(k => [shipTraits(k), (shipTraits(k).air || []).find(a => a.type === t)]).filter(x => x[1]).map(x => `${x[0].name} ${x[1].count}`).join('、'); md += `| ${tr.name} | ${Math.round(rr.speed)} | ${hm(rr.endurance)} | ${Math.round(rr.range / KM).toLocaleString('en-US')} | ${stock || '—'} |\n`; }
  return md;
}
// 手段ごとの「映る距離」の早見表（雑音なし、しきい値 SNR 1）
function rangesMd(observers, targets) {
  const solve = f => { let lo = 1, hi = 1e9; if (!(f(lo) >= 1)) return 0; for (let i = 0; i < 60; i++) { const mid = Math.sqrt(lo * hi); if (f(mid) >= 1) lo = mid; else hi = mid; } return lo; };
  let md = `| 観測する側 → 目標 | レーダー | ニュートリノ・熱 | 重力波（等速） | 目視：点 | 目視：識別 | レーダーの像で識別 |\n| --- | --- | --- | --- | --- | --- | --- |\n`;
  for (const o of observers) for (const [tname, tr, emcon, n] of targets) { const sig = emission(tr, emcon, n), sg = tr.sigma * n, v = visualRanges(tr.maxDim, o.sens.ir);
    md += `| ${o.name} → ${tname} | ${km(solve(r => bandSNR(sig, sg, o.sens, r, true).rad))} | ${km(solve(r => { const s = bandSNR(sig, sg, o.sens, r, false); return Math.max(s.nu, s.ir); }))} | ${km(solve(r => gravSNR(gravSource(tr, 0, n), o.sens.nu, r, 1, 1e12)))} | ${km(v.see)} | ${km(v.id)} | ${km(solve(r => bandSNR(sig, sg, o.sens, r, true).rad / K.SENS.idRad))} |\n`; }
  return md;
}
function mapSvg(r, title) {
  const S = 1040, Wd = S + 300, c = S / 2, sc = (S / 2 - 40) / (K.MAP_RADIUS), X = x => c + x * sc, Y = z => c - z * sc, col = {0: '#257de0', 1: '#f47230', 2: '#00b894', 3: '#8a8a8a'}, ink = '#191919', ink2 = '#666666';
  let s = `<rect width="${Wd}" height="${S + 40}" fill="#ffffff"/><text x="20" y="28" font-size="18" font-weight="bold" fill="${ink}">${title}</text>`;
  const g = y => y + 40;
  s += `<circle cx="${X(0)}" cy="${g(Y(0))}" r="${K.MAP_RADIUS * sc}" fill="#f9f9f9" stroke="#bdbdbd" stroke-width="1.5"/>`;
  // 惑星の影（-z 側が昼なら影は +z … SUN_DIR の向きへ伸びる）
  const sx = K.SUN_DIR[0], sz = K.SUN_DIR[2], L = K.MAP_RADIUS * 1.0, pr = K.PLANET_RADIUS; const px = -sz, pz = sx;
  s += `<clipPath id="mapclip"><circle cx="${X(0)}" cy="${g(Y(0))}" r="${K.MAP_RADIUS * sc}"/></clipPath><polygon clip-path="url(#mapclip)" points="${[[px * pr, pz * pr], [px * pr + sx * L, pz * pr + sz * L], [-px * pr + sx * L, -pz * pr + sz * L], [-px * pr, -pz * pr]].map(p => X(p[0]) + ',' + g(Y(p[1]))).join(' ')}" fill="#e3e3e3"/>`;
  s += `<circle cx="${X(0)}" cy="${g(Y(0))}" r="${pr * sc}" fill="#d0d0d0" stroke="#9c9c9c"/><text x="${X(0)}" y="${g(Y(0)) - 4}" text-anchor="middle" font-size="15" fill="${ink}">惑星（半径 ${Math.round(pr / KM).toLocaleString('en-US')} km）</text><text x="${X(0)}" y="${g(Y(0)) + 16}" text-anchor="middle" font-size="12" fill="${ink2}">レーダーには巨大な光点</text><text x="${X(0)}" y="${g(Y(-pr - 900 * KM))}" text-anchor="middle" font-size="12" fill="${ink2}">惑星の影（目視できない）</text>`;
  const confirmed = new Set(r.map.confirms.map(x => x.id));
  for (const e of r.map.ents) { const pts = e.path.map(p => X(p[0]).toFixed(1) + ',' + g(Y(p[1])).toFixed(1)).join(' '), [ex, ez] = e.kind === 'flight' ? (e.path.at(-1) || e.end) : e.end, x = X(ex), y = g(Y(ez));
    if (e.kind === 'flight') { s += `<polyline points="${pts}" fill="none" stroke="${col[e.side]}" stroke-width="1.2" stroke-opacity=".75" stroke-dasharray="${e.side ? '5 3' : 'none'}"/>`; continue; }
    if (e.kind === 'rock') { s += `<path d="M${x - 4},${y} L${x},${y - 4} L${x + 4},${y} L${x},${y + 4}Z" fill="${col[3]}"/>`; continue; }
    if (e.path.length > 1) s += `<polyline points="${pts}" fill="none" stroke="${col[e.side]}" stroke-width="2.5"/>`;
    if (e.side === 2) s += e.xpdr ? `<rect x="${x - 5}" y="${y - 5}" width="10" height="10" fill="${col[2]}" stroke="#fff" stroke-width="1.5"/>` : `<rect x="${x - 5}" y="${y - 5}" width="10" height="10" fill="#fff" stroke="${col[2]}" stroke-width="2.5"/>`;
    else if (e.side === 1) s += `<path d="M${x},${y - 8} L${x + 7},${y + 6} L${x - 7},${y + 6}Z" fill="${col[1]}" stroke="#fff" stroke-width="1.5"/>` + (confirmed.has(e.id) ? `<circle cx="${x}" cy="${y}" r="13" fill="none" stroke="${ink}" stroke-width="1.5"/>` : '');
    else s += `<circle cx="${x}" cy="${y}" r="6" fill="${col[0]}" stroke="#fff" stroke-width="1.5"/>`; }
  const A = r.map.ents.find(e => e.side === 0 && e.kind === 'ship'), B = r.map.ents.find(e => e.side === 1 && e.kind === 'ship');
  if (A) s += `<text x="${X(A.end[0]) + 12}" y="${g(Y(A.end[1])) - 10}" font-size="13" fill="${ink}">味方艦隊</text>`;
  if (B) s += `<text x="${X(B.end[0]) + 14}" y="${g(Y(B.end[1])) - 12}" font-size="13" fill="${ink}">敵艦隊</text>`;
  // 凡例
  let ly = 90; const lx = S + 10, leg = (mark, text) => { s += mark(lx + 12, ly) + `<text x="${lx + 34}" y="${ly + 4}" font-size="13" fill="${ink}">${text}</text>`; ly += 26; };
  leg((x, y) => `<circle cx="${x}" cy="${y}" r="6" fill="${col[0]}"/>`, '味方の艦（太線は航跡）');
  leg((x, y) => `<line x1="${x - 10}" y1="${y}" x2="${x + 12}" y2="${y}" stroke="${col[0]}" stroke-width="1.2"/>`, '味方の偵察編隊の経路');
  leg((x, y) => `<path d="M${x},${y - 8} L${x + 7},${y + 6} L${x - 7},${y + 6}Z" fill="${col[1]}"/>`, '敵の艦');
  leg((x, y) => `<line x1="${x - 10}" y1="${y}" x2="${x + 12}" y2="${y}" stroke="${col[1]}" stroke-width="1.2" stroke-dasharray="5 3"/>`, '敵の偵察編隊の経路');
  leg((x, y) => `<path d="M${x},${y - 8} L${x + 7},${y + 6} L${x - 7},${y + 6}Z" fill="${col[1]}"/><circle cx="${x}" cy="${y}" r="13" fill="none" stroke="${ink}" stroke-width="1.5"/>`, '味方が敵と識別した艦');
  ly += 6;
  leg((x, y) => `<rect x="${x - 5}" y="${y - 5}" width="10" height="10" fill="${col[2]}"/>`, '商船（船籍表示あり）');
  leg((x, y) => `<rect x="${x - 5}" y="${y - 5}" width="10" height="10" fill="#fff" stroke="${col[2]}" stroke-width="2.5"/>`, '商船（船籍表示なし）');
  leg((x, y) => `<path d="M${x - 4},${y} L${x},${y - 4} L${x + 4},${y} L${x},${y + 4}Z" fill="${col[3]}"/>`, '小惑星（浮遊物）');
  const A0 = r.sides[0], B0 = r.sides[1]; ly += 14;
  for (const line of [`味方が敵艦を：`, `　初探知 ${hm(A0.tBlip)}`, `　敵と確定 ${hm(A0.tConfirm)}（${A0.foesConfirmed}/${A0.foes} 隻）`, `敵が味方艦を：`, `　初探知 ${hm(B0.tBlip)}`, `　敵と確定 ${hm(B0.tConfirm)}（${B0.foesConfirmed}/${B0.foes} 隻）`, `（時刻は 時:分:秒、計算は ${K.LIMIT / 3600} 時間）`]) { s += `<text x="${lx}" y="${ly}" font-size="13" fill="${line.startsWith('　') || line.startsWith('（') ? ink2 : ink}">${line}</text>`; ly += 20; }
  const bar = 2000 * KM * sc; s += `<line x1="30" y1="${S + 12}" x2="${30 + bar}" y2="${S + 12}" stroke="${ink}" stroke-width="2"/><text x="${36 + bar}" y="${S + 17}" font-size="13" fill="${ink2}">2,000 km（上から見た図。位置は計算の終わり、線は通った跡）</text>`;
  return {svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${Wd}" height="${S + 40}" font-family="'Noto Sans CJK JP','Noto Sans JP',sans-serif">${s}</svg>`, w: Wd, h: S + 40};
}

(async () => {
  const keys = SCENE_ARG === 'all' ? Object.keys(SCENES) : SCENE_ARG.split(','); for (const k of keys) if (!SCENES[k]) { console.error('場面がない: ' + k + '（' + Object.keys(SCENES).join(' | ') + '）'); process.exit(2); }
  fs.mkdirSync(OUT, {recursive: true}); const t00 = Date.now(), figs = [];
  let summary = `# 索敵の検証：結果（scripts/sim-sensing-trial.cjs の出力）\n\n場面 ${keys.join(', ')}、各 ${RUNS} 回（種 1〜${RUNS}）。時刻は 時:分:秒。1 回の計算は ${K.LIMIT / 3600} 時間、刻み ${K.DT} 秒。\n\n`, overall = `| 場面 | 回数 | 味方が敵艦を初探知（回数、時刻の中央値） | 味方が敵と確定（回数、中央値） | 識別した敵艦／全数（合計） | 敵が味方を確定（回数、中央値） | 先に確定した側 | 敵艦を浮遊物と誤判定（合計） | 不審扱い（＝推定で敵とするなら誤認）合計 | 味方の追跡枠：最大使用／1 つずつ追った場合／持ち数 |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n`, detail = '';
  for (const key of keys) { const runs = [], t0 = Date.now(); for (let s = 1; s <= RUNS; s++) runs.push(run(key, s));
    const dir = path.join(OUT, key); fs.mkdirSync(dir, {recursive: true});
    for (const r of runs) fs.writeFileSync(path.join(dir, `run-${r.seed}.json`), JSON.stringify({scene: r.scene, seed: r.seed, notes: r.notes, sides: r.sides}, null, 1));
    fs.writeFileSync(path.join(dir, 'timeline-seed1.md'), `# ${SCENES[key].title}：接触ごとの時系列（種 1）\n\n時刻は 時:分:秒。「真の姿」は検証の答え合わせ用で、その陣営には見えていない。\n\n## ${SIDE_NAME[0]}から見た接触\n\n${timelineMd(runs[0], 0)}\n## ${SIDE_NAME[1]}から見た接触\n\n${timelineMd(runs[0], 1)}`);
    overall += overallRow(key, runs); detail += sceneSummary(key, runs); figs.push([key, runs[0]]);
    console.log(`${key}: ${RUNS} 回、${((Date.now() - t0) / 1000).toFixed(1)} 秒`); }
  const usedShips = [...new Set([...REBEL, ...EMPIRE, ...SMALL, ...MERCHANT_KEYS])], usedCraft = ['awing', 'xwing', 'tie_ln'].filter(t => traitCache.has('craft:' + t));
  const obsList = [shipTraits('mc80liberty'), shipTraits('imperial'), shipTraits('cr90'), ...usedCraft.filter(t => t !== 'xwing').map(craftTraits)];
  const tgts = [['ISD', shipTraits('imperial'), 'normal', 1], ['MC80', shipTraits('mc80liberty'), 'normal', 1], ['ネビュロンB', shipTraits('nebulonb'), 'normal', 1], ['CR90', shipTraits('cr90'), 'normal', 1], ['CR90（低放射）', shipTraits('cr90'), 'low', 1], ['ゴザンティ（低放射）', shipTraits('gozanti'), 'low', 1], ['ルクレハルク級貨物船', shipTraits('lh3210'), 'normal', 1], ['GR-75', shipTraits('gr75'), 'normal', 1], ['小惑星 100 m', rockTraits(100), 'normal', 1], ['小惑星 400 m', rockTraits(400), 'normal', 1], ...usedCraft.slice(0, 1).map(t => [craftTraits(t).name + ' 4 機', craftTraits(t), 'normal', 4])];
  const planetM = K.PLANET_G * K.PLANET_RADIUS ** 2 / 6.674e-11, mc = shipTraits('mc80liberty');
  const planetMd = `惑星（半径 ${K.PLANET_RADIUS / KM} km）を、縁から入った MC80（惑星の中心から 9,800 km）が見たとき：レーダーの SNR ${bandSNR({nu: 0, ir: 0, em: 0}, Math.PI * K.PLANET_RADIUS ** 2, mc.sens, 9800 * KM - K.PLANET_RADIUS, true).rad.toExponential(2)}（しきい値 1）、重力波の歪みの値 ${gravSNR(planetM * K.PLANET_G, mc.sens.nu, 9800 * KM, 1, 1e12).toExponential(2)}（同じ単位で、ISD が 2,000 km にいるときが約 ${gravSNR(gravSource(shipTraits('imperial'), 0), mc.sens.nu, 2000 * KM, 1, 1e12).toFixed(2)}）。`;
  summary += `## 全体\n\n${overall}\n## 場面ごと\n\n${detail}## 使った特性（性能表から）\n\n${traitsMd(usedShips, usedCraft)}\n## 手段ごとの映る距離（雑音なし、しきい値 SNR 1）\n\n${rangesMd(obsList, tgts)}\n${planetMd}\n\n## 定数（★ はこちらで選んだ値）\n\n\`\`\`json\n${JSON.stringify({...K, SENS: '(Core.SENS)', EMIT: '(Core.EMIT)', EMCON: '(Core.EMCON)'}, null, 1)}\n\`\`\`\n`;
  fs.writeFileSync(path.join(OUT, 'summary.md'), summary);
  if (process.env.KS_NOFIG !== '1') { const {chromium} = require('playwright'), br = await chromium.launch({args: ['--no-sandbox']});
    for (const [key, r] of figs) { const m = mapSvg(r, `${SCENES[key].title}（種 1）`), pg = await br.newPage({viewport: {width: m.w, height: m.h}, deviceScaleFactor: 1}); await pg.setContent(`<html><body style="margin:0;background:#fff">${m.svg}</body></html>`); await pg.screenshot({path: path.join(OUT, `map-${key}.png`)}); await pg.close(); }
    await br.close(); }
  console.log(`出力: ${OUT}（summary.md、<場面>/run-<種>.json、<場面>/timeline-seed1.md${process.env.KS_NOFIG === '1' ? '' : '、map-<場面>.png'}）、全体 ${((Date.now() - t00) / 1000).toFixed(1)} 秒`);
})();
