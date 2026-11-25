// 索敵の検証（計算だけ。ゲーム本体には組み込まない）。ユーザーの指示 2026-11-25：
//   docs/handoff-2026-11-25/sensing-trial-request-2026-11-25.md
// 使い方: node scripts/sim-sensing-trial.cjs <出力先フォルダ> [場面=all] [回数=5]
//   場面: m3 | m3p | m3q | m4 | m3n | m3in（停泊中の主力艦隊と外周の哨戒：本隊が縁から進む）| j3 | j3b | j3x | j3q | j4 | j3f | j3fc | j3in（同：本隊は別の星系で待ち、偽装貨物船と偵察機が見つけたら呼ぶ）| f1 | f2 | f3 | f4 | g1 | g2 | h1 | h2 | h3 | h4（輸送艦と商船の見分け）| e2 | e3 | e3only（分派）| aLock | cLock（ロックあり）| a | a2x12 | a12x2 | b | c | c2 | c2x12 | c12x2 | d | all（コンマで複数）（下の SCENES を参照）
//   出力先は必ず引数で渡す（既定でリポジトリの中には書かない）。図を作らないときは KS_NOFIG=1。
//   KS_PAR=4 のように指定すると、場面を 4 つの子プロセスに分けて計算する（結果は同じ。場面ごとに乱数が独立しているため）。
// Core は読むだけ（性能表 YardFleetData と、既存の索敵の式 Core.sensSNR・定数 Core.SENS / EMIT / EMCON を使う）。
// 検証用に足した式はこのファイルの「純粋な関数」の節にあり、★ を付けた定数は K に 1 か所でまとめてある。
'use strict';
const fs = require('node:fs'), vm = require('node:vm'), path = require('node:path');
const root = process.env.KS_TEST_ROOT || path.resolve(__dirname, '..');
const OUT = process.argv[2], SCENE_ARG = process.argv[3] || 'all', RUNS = +(process.argv[4] || 5);
if (!OUT) { console.error('使い方: node scripts/sim-sensing-trial.cjs <出力先フォルダ> [場面=all] [回数=5]'); process.exit(2); }
const PAR = Math.max(1, +(process.env.KS_PAR || 1)), WORKER = process.env.KS_WORKER === '1', v8 = require('node:v8');
const cx = vm.createContext({console: {log() {}, warn() {}, error: console.error}});
for (const f of ['data/reference.js', 'data/imperial2.js', 'data/fleet.js', 'js/core.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), cx, {filename: f});
const C = vm.runInContext('Core', cx), F = vm.runInContext('YardFleetData', cx);

// ====================================================================================================
// 定数（★ = こちらで選んだ値。ユーザーが後から変えられるよう、ここだけに置く）
// ====================================================================================================
const KM = 1000;
const K = {
  // ---- マップ（ユーザーの指示。直径か半径かは README の「決めてもらう点」）----
  MAP_RADIUS: 50000 * KM,        // ユーザー 2026-11-25「円は半径5万まで広げて」（前は直径 20,000 km）
  MAP_HALF_HEIGHT: 20000 * KM,   // 「上下を2万キロ」を、上へ 20,000 km・下へ 20,000 km と読んだ（前は上下 5,000 km）
  PLANET_RADIUS: 6.12e6,         // ★ 惑星の半径。既存の scripts/sim-fleet-air.cjs の惑星（6,120 km）と同じにした
  PLANET_G: 9.8,                 // ★ 惑星の表面重力（Core.GRAVITY.g0 と同じ）
  SUN_DIR: [0, 0, -1],           // ★ 恒星の光が進む向き（惑星の +z 側が昼、-z 側の円柱が影）
  // ---- 時間 ----
  DT: 10,                        // ★ 時間刻み s
  LIMIT: 12 * 3600,              // ★ 1 回の計算の長さ s（12 時間。前の大きさでは 6 時間）
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
  CIVIL_TYPES: ['gr75', 'gozanti', 'cr90', 'heraklon', 'reptransport'], // 民間・非戦闘でも使われる艦種（ユーザー 2026-11-25 が挙げた 5 つ）。艦種が分かっても所属は決まらない。lh3210 など貨物が主な作例を入れるかは未定 ★
  NEUTRAL_CR90: 4,               // ★ 場面に置く中立の CR90（外交艦）の数
  NEUTRAL_CR90_XPDR: 0.8,        // ★ そのうち船籍表示を出している割合（ユーザー「基本は船籍表示されてることが多い」）。軍用の CR90 は出さない
  ESCORT_RADIUS: 50 * KM,        // ★ 敵の軍艦と分かった艦からこの距離の中にいて…
  ESCORT_WAIT: 120,              // ★ …この秒数つづけて一緒に動いていれば「軍艦と一緒に動いている」＝敵とみなす
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
  RECON_ELEV: [0, 15, -15],      // ★ 偵察の編隊が向かう上下の角度°（編隊ごとに順番に。高さ方向も探す）
  RECON_OUT_SHARE: 0.45,         // ★ 行きに使う航続の割合（残りは帰りと寄り道）
  // ---- 配置（★ すべてこちらで選んだ。README「配置の決め方」）----
  PLACE: {friendStart: 48000 * KM, friendGoal: 20000 * KM, enemyDist: [5000 * KM, 16000 * KM], enemyBearing: 60, enemyY: 4000 * KM, hideDist: [3000 * KM, 12000 * KM], hideBearing: 40, hideY: 3000 * KM,
    merchantR: [8000 * KM, 48000 * KM], merchantY: 10000 * KM, noXpdrDist: [2000 * KM, 10000 * KM], noXpdrY: 2000 * KM, rockNearFriend: 11, rockNearDist: 15000 * KM, rockNearY: 3000 * KM, rockY: 10000 * KM},
  RECON_DIVERT: 600 * KM,        // ★ 経路からこの距離までの未識別の光点は見に行く
  RECON_SEARCHED_HOLD: 900,      // ★ 行っても識別できなかった光点を、次に見に行くまでの間 s
  RECON_INVESTIGATE_QUIET: false,// ★「浮遊物（推定）」は見に行かない（場面 c2 では見に行く）
  FAST_SCOUT_RATIO: 1.5,         // ★ 速い小型艦として偵察に出せる条件：巡航が本隊の 1.5 倍以上
  SMALL_SHIP_LEN: 400,           // ★ 分派に使う「小型艦」は全長 400 m 以下
  CRUISE: C.CRUISE_SPEED_TARGET?.target ?? 0.7, // 巡航 ＝ 最高速度 × 0.7（Core.craftCruiseSpeed と同じ）
  FLEET_SPEED_SHARE: 0.7,        // ★ 艦隊は一番遅い艦の最高速度 × 0.7 で進む
  PATROL_SPEED_SHARE: 0.3,       // ★ 哨戒中の敵艦隊は一番遅い艦の最高速度 × 0.3
  PLANET_KEEPOUT: 500 * KM,      // ★ 惑星の表面からこの高さより下は飛ばない
  // ---- 停泊中の主力艦隊と外周の哨戒の場面（ユーザー 2026-11-25。数値はすべて ★。場面ごとに SCENES の anchor で上書きできる）----
  ANCHOR: {
    alt: 1000 * KM,              // ★ 主力が回る低軌道の高さ（惑星の表面から）。軌道は地図の面（高さ 0）の円 ★
    // 回る速さは置いていない：円軌道の速さ √(PLANET_G × 惑星半径² ÷ 軌道半径) を使う（高さ 1,000 km で約 7.18 km/s、1 周 約 104 分）
    mainSpacing: 20 * KM,        // ★ 主力の艦の間隔（軌道に沿って一列）
    patrolR: 30000 * KM,         // ★ 哨戒が回る輪の半径（惑星の中心から）。高さ 0
    patrolGroups: 6,             // ★ 哨戒の群の数。輪の上に等間隔、最初の向きは乱数、全群が同じ向きに回る（向きは乱数）
    patrolGroup: ['dreadnaught', 'arquitens', 'arquitens'], // ★ 1 群の編成
    limit: 36 * 3600,            // ★ この場面の 1 回の計算の長さ s（縁から惑星まで 351 m/s で約 32 時間かかるため）
    reconFlights: 6, reconSize: 4, // ★ 反乱軍の偵察：4 機 × 6 編隊（場面 a と同じ）
    posSpread: 4,                // ★ 情報が「軌道上の位置まで」のとき、編隊ごとにずらす軌道上の角度°（予測した位置を中心に 4° ＝ 約 500 km ずつ）
    fan: 120, search: 15000 * KM, // ★ 情報なしの比較（m3n）で使う扇と捜索する距離（場面 a と同じ）
    band: 600 * KM,              // ★「低軌道の帯」：主力の軌道の半径 ± これ。帯の中の接触だけを「発見」の候補にする
    // ---- 本隊は別の星系で待ち、見つけたら呼ぶ形（mode 'jump'）----
    mode: 'march',               // 'march' ＝ 本隊が縁から進む。'jump' ＝ 偽装貨物船と偵察機が探し、本隊を呼ぶ
    jumpLimit: 12 * 3600,        // ★ jump の場面の 1 回の計算の長さ s
    jumpInR: 12000 * KM,         // ★ 偽装貨物船と偵察機がハイパースペースから現れる所（惑星の中心からの距離。向きは乱数）
    freighters: ['gr75', 'gr75'], // ★ 偽装貨物船（GR-75 × 2。互いに反対側から入る）
    freighterXpdr: true,         // ★ 偽装貨物船は船籍表示を出す
    freighterPass: 8000 * KM,    // ★ 偽装貨物船の航路が惑星の中心にいちばん近づく距離（主力の軌道の 880 km 外。商船を置く範囲の内側の端と同じ）
    scouts: true,                // 偵察機を使うか
    callOn: 'confirm',           // ★ 本隊を呼ぶ基準：'confirm' ＝ 帯にいる艦を敵と確定、'blip' ＝ 帯に動力のある光点
    callDelay: 600,              // ★ 呼んでから本隊が現れるまで s（報告は即時に届くとする。跳ぶ準備と移動の時間）
    arriveBehind: 150 * KM,      // ★ 本隊が現れる位置：発見した接触の後ろ（軌道に沿って）この距離。主力と同じ軌道を同じ速さで回る
    fleetSpacing: 5 * KM,        // ★ 現れた本隊の艦の間隔
    prep: 900                    // ★ 帝国の戦闘準備（護衛の TIE の発艦など）にかかる時間の仮の値 s。準備そのものは計算しない
  }
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
    liftT: p.systems?.landingSupport || 0, fuelJ: p.fuel?.capacityJ || 0, launch: p.launch || 0,
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
// 所属の判断（艦種が分かった後）。ユーザー 2026-11-25「GR-75は一般的な輸送艦の艦種なので敵も商船と誤認する可能性もある」。
//  ・軍用にしか使われない艦種・航空機：艦種が分かれば所属の見当が付く ★（militarySide ＝ その艦種を使う陣営が相手か）
//  ・民間でも使われる艦種（K.CIVIL_TYPES）：艦種だけでは決まらない。軍艦と一緒に動いていれば敵、船籍表示があれば商船とみなす、無ければ不審
//  ・自分をロックしてきた相手は敵
// 戻り値: 'hostile' | 'civil'（商船・非敵対とみなす）| 'suspect'（不審。敵とはマークしない）| 'neutral' | 'rock' | null（艦種がまだ分からない）
function allegiance(c, t) {
  if (c.lockMark) return 'hostile';
  if (c.escortSince != null && t - c.escortSince >= K.ESCORT_WAIT) return 'hostile';
  if (!c.id) return c.xpdr === 'shown' ? 'civil' : null; // 艦種が分からなくても、船籍表示を受ければ商船とみなす
  if (c.id.kind === 'rock') return 'rock';
  if (!c.id.civilType) return c.id.militarySide ? 'hostile' : 'neutral';
  if (c.escortSince != null && t - c.escortSince >= K.ESCORT_WAIT) return 'hostile';
  if (c.xpdr === 'shown') return 'civil';
  return 'suspect';
}
// 追跡枠が足りないときの優先度（大きいほど先に枠をもらう）。★
function trackPriority(c) {
  if (c.alleg === 'hostile' && !c.id) return 100;
  if (c.id) return c.id.hostile ? (c.id.kind === 'flight' ? 60 : 100) : c.alleg === 'suspect' ? 85 : 0; // 敵と確定した艦 100、敵機 60、艦種は分かったが不審 85、商船・小惑星・中立とみなしたものは枠を返す
  switch (c.stage) { case ST.SUSPECT: return 90; case ST.POWERED: return 80; case ST.BLIP: return 70; case ST.DEBRIS: return 30; case ST.CIVIL: return 20; default: return 0; }
}
// 同時追跡数：同時交戦数（性能表の aaCh ＝ Core.shipTrackSlots。0 なら ★1）× 2。艦も航空機も同じ式。
function trackSlots(engage, n = 1) { return Math.max(K.ENGAGE_FLOOR, engage) * K.TRACK_PER_ENGAGE * n; }
// 偵察に出す機種と編隊を選ぶ（ユーザー 2026-11-25「届く機体が基本偵察機として使われるはずだ」）。機種の名前や役割では選ばない。
// 入力 stock: [{type, reach（行きに使える距離 m）, speed（巡航 m/s）, count（積んでいる機数）, home（母艦）}]、searchDist: 捜索する距離、flights・size: 編隊の数と機数
// 規則：捜索する距離まで届く機種だけを使う。届く機種の中では速い機種から ★。届く機種が無ければ、一番遠くまで届く機種で届く範囲だけ捜索する。
// 1 編隊は同じ母艦の同じ機種。積んでいる機数を超えない。出力 {flights: [{type, home, reach}], reaches: 届いたか, searchDist: 実際に捜索する距離}
function chooseRecon(stock, searchDist, flights, size) {
  const left = stock.map(x => ({...x, left: x.count})).filter(x => x.left >= size); if (!left.length) return {flights: [], reaches: false, searchDist: 0};
  let ok = left.filter(x => x.reach >= searchDist); const reaches = ok.length > 0, best = Math.max(...left.map(x => x.reach));
  if (!reaches) ok = left.filter(x => x.reach >= best * 0.999);
  ok.sort((a, b) => b.speed - a.speed || b.reach - a.reach); const out = [];
  for (let i = 0; i < flights; i++) { const x = ok.find(q => q.left >= size); if (!x) break; x.left -= size; out.push({type: x.type, home: x.home, reach: x.reach}); }
  return {flights: out, reaches, searchDist: reaches ? searchDist : best};
}
// 分派に使える艦かどうかを特性で決める（ユーザー 2026-11-25。艦種の名前では選ばない）。
// (2) 航空機を運用できる艦：性能表に載っている搭載機（Core.FLEET_AIR.roles にある機種）が 2 機以上あり、格納庫と発進能力（p.launch）がある
// (3) 速い小型艦：全長 ★400 m 以下、巡航が本隊の巡航の ★1.5 倍以上、レーダーの開口があり、航続が捜索する距離の往復に足りる
function detachRoles(tr, fleetCruise, searchDist) {
  const craft = (tr.air || []).filter(a => C.FLEET_AIR.roles[a.type]).reduce((n, a) => n + a.count, 0), hangar = tr.hangarCap || 0, launch = tr.launch || 0, cruise = tr.maxSpeed * K.CRUISE, range = cruise * tr.fuelJ / Math.max(1, tr.reactorW * K.RECON_LOAD);
  const cWhy = craft >= 2 && launch > 0 ? '' : hangar >= 2 && launch > 0 ? `格納庫（${hangar} 機ぶん）と発進能力はあるが、性能表を作れる機種の搭載機が作例に無い` : hangar > 0 ? '格納庫が 2 機ぶん未満' : '格納庫なし';
  const fWhy = tr.len > K.SMALL_SHIP_LEN ? `小型艦ではない（全長 ${K.SMALL_SHIP_LEN} m 超）` : !(tr.sens.rad > 0) ? 'レーダーなし' : cruise < fleetCruise * K.FAST_SCOUT_RATIO ? `巡航 ${Math.round(cruise)} m/s が本隊の ${K.FAST_SCOUT_RATIO} 倍（${Math.round(fleetCruise * K.FAST_SCOUT_RATIO)} m/s）に届かない` : range * K.RECON_OUT_SHARE < searchDist ? '航続が足りない' : '';
  return {carrier: {ok: !cWhy, why: cWhy, craft, hangar, launch}, fast: {ok: !fWhy, why: fWhy, cruise, range}};
}
// 目標にできる条件：枠を持って追跡中で、位置が使え、敵と印が付いている（確定、または推定を許すなら不審も）。
function targetable(c, allowPresumed) { return !!c.tracker && (c.alleg === 'hostile' || (c.id ? c.id.hostile : allowPresumed && c.stage === ST.SUSPECT)); }

// ====================================================================================================
// 特性の読み込み（艦：data/fleet.js の性能表。航空機：作例の設計から Core.fleetProfile）
// ====================================================================================================
const plain = x => JSON.parse(JSON.stringify(x)), traitCache = new Map();
function shipTraits(key) { if (!traitCache.has(key)) { const d = F.designs[key]; if (!d) throw new Error('性能表にない艦: ' + key); const p = plain(d.p), u = C.fleetUnit('t_' + key, key, p, 0); traitCache.set(key, sensingTraits(p, {name: d.name, key, hangarCap: d.info?.hangarCap || 0, engage: C.shipTrackSlots(u), air: (d.air || []).filter(a => a.count > 0).map(a => ({type: a.type, count: a.count}))})); } return traitCache.get(key); }
function craftTraits(type) { const k = 'craft:' + type; if (!traitCache.has(k)) { const role = C.FLEET_AIR.roles[type]; if (!role) throw new Error('Core.FLEET_AIR.roles にない航空機: ' + type); const xs = C.buildDesign(role.key), S = C.computeStats(xs), p = C.fleetProfile(S, xs.name, xs); traitCache.set(k, sensingTraits(p, {name: xs.name, key: role.key, type, craft: true, massKg: S.mass * 1000, engage: p.aaCh || 0, hyper: (xs.parts || []).some(q => q.k === 'hyper')})); } return traitCache.get(k); }
function reconRange(tr) { const endurance = tr.fuelJ / Math.max(1, tr.reactorW * K.RECON_LOAD), v = tr.maxSpeed * K.CRUISE; return {speed: v, endurance, range: v * endurance, reach: v * endurance * K.RECON_OUT_SHARE}; }
const reconTypesOf = keys => [...new Set(keys.flatMap(k => (shipTraits(k).air || []).map(a => a.type)))].filter(t => C.FLEET_AIR.roles[t]);

// ====================================================================================================
// 場面
// ====================================================================================================
const REBEL = ['mc75', 'mc80liberty', 'nebulonb', 'nebulonb', 'cr90'], EMPIRE = ['imperial', 'imperial', 'arquitens', 'gozanti', 'gozanti'], SMALL = ['cr90', 'cr90', 'gozanti', 'gozanti', 'gozanti'];
const MERCHANT_KEYS = ['gr75', 'gr75', 'heraklon', 'reptransport', 'reptransport', 'gozanti', 'gr75', 'lh3210']; // 中立の商船。敵・味方の輸送艦と同じ艦種が混ざる
// recon: {flights: 編隊の数, size: 1 編隊の機数, fan: 扇の半角°（360 なら全周）, search: 捜索する距離（母艦から）}。機種は chooseRecon が航続で選ぶ
const ISD3 = ['imperial', 'imperial', 'imperial'], ISD4 = ['imperial', 'imperial', 'imperial', 'imperial'];
const SCENES = {
  // 停泊中の主力艦隊（低軌道）と外周の哨戒。anchor: {main: 主力の艦, quiet: 主力が機関を絞る, intel: 反乱軍の情報 'orbit'（低軌道にいることだけ）| 'position'（開始時刻の軌道上の位置と回る向きまで）| null（なし）}
  m3: {title: '(m3) 低軌道に主力 ISD × 3（通常の放射）、外周に哨戒 6 群。反乱軍の情報：低軌道にいることだけ', layout: 'anchor', anchor: {main: ISD3, quiet: false, intel: 'orbit'}},
  m3p: {title: '(m3p) (m3) で、反乱軍の情報：開始時刻の軌道上の位置まで', layout: 'anchor', anchor: {main: ISD3, quiet: false, intel: 'position'}},
  m3q: {title: '(m3q) (m3) で、主力が機関を絞る（低放射・レーダー停止）', layout: 'anchor', anchor: {main: ISD3, quiet: true, intel: 'orbit'}},
  m4: {title: '(m4) (m3) で、主力が ISD × 4', layout: 'anchor', anchor: {main: ISD4, quiet: false, intel: 'orbit'}},
  m3n: {title: '(m3n) (m3) で、反乱軍に情報なし（場面 a と同じ動き：20,000 km まで進み、開始時に偵察機を扇に出す）', layout: 'anchor', anchor: {main: ISD3, quiet: false, intel: null}},
  m3in: {title: '(m3in) (m3) で、哨戒を内側に寄せて倍にする（輪の半径 15,000 km、12 群）', layout: 'anchor', anchor: {main: ISD3, quiet: false, intel: 'orbit', patrolR: 15000 * KM, patrolGroups: 12}},
  // 本隊は別の星系で待つ形（mode 'jump'）
  j3: {title: '(j3) 本隊は別の星系。偽装貨物船（GR-75 × 2、船籍表示あり）と偵察機（4 機 × 6）が低軌道の主力 ISD × 3 を探し、敵と確定したら本隊を呼ぶ', layout: 'anchor', anchor: {mode: 'jump', main: ISD3, quiet: false, intel: 'orbit'}},
  j3b: {title: '(j3b) (j3) で、低軌道の帯に動力のある光点を見つけた時点で本隊を呼ぶ', layout: 'anchor', anchor: {mode: 'jump', main: ISD3, quiet: false, intel: 'orbit', callOn: 'blip'}},
  j3x: {title: '(j3x) (j3) で、偽装貨物船が船籍表示を出さない', layout: 'anchor', anchor: {mode: 'jump', main: ISD3, quiet: false, intel: 'orbit', freighterXpdr: false}},
  j3q: {title: '(j3q) (j3) で、主力が機関を絞る（低放射・レーダー停止）', layout: 'anchor', anchor: {mode: 'jump', main: ISD3, quiet: true, intel: 'orbit'}},
  j4: {title: '(j4) (j3) で、主力が ISD × 4', layout: 'anchor', anchor: {mode: 'jump', main: ISD4, quiet: false, intel: 'orbit'}},
  j3f: {title: '(j3f) (j3) で、偵察機なし（偽装貨物船だけで探す）', layout: 'anchor', anchor: {mode: 'jump', main: ISD3, quiet: false, intel: 'orbit', scouts: false}},
  j3fc: {title: '(j3fc) (j3f) で、偽装貨物船の航路を主力の軌道の 100 km 外まで寄せる', layout: 'anchor', anchor: {mode: 'jump', main: ISD3, quiet: false, intel: 'orbit', scouts: false, freighterPass: 7220 * KM}},
  j3in: {title: '(j3in) (j3) で、哨戒を内側に寄せて倍にする（輪の半径 15,000 km、12 群）', layout: 'anchor', anchor: {mode: 'jump', main: ISD3, quiet: false, intel: 'orbit', patrolR: 15000 * KM, patrolGroups: 12}},
  a: {title: '(a) 偵察機あり：4 機 × 6 編隊', enemy: EMPIRE, enemyMode: 'patrol', recon: [{flights: 6, size: 4, fan: 120, search: 15000 * KM}, {flights: 8, size: 4, fan: 360, search: 15000 * KM}]},
  a2x12: {title: '(a) の編隊ちがい：12 機 × 2 編隊', enemy: EMPIRE, enemyMode: 'patrol', recon: [{flights: 2, size: 12, fan: 120, search: 15000 * KM}, {flights: 8, size: 4, fan: 360, search: 15000 * KM}]},
  a12x2: {title: '(a) の編隊ちがい：2 機 × 12 編隊', enemy: EMPIRE, enemyMode: 'patrol', recon: [{flights: 12, size: 2, fan: 120, search: 15000 * KM}, {flights: 8, size: 4, fan: 360, search: 15000 * KM}]},
  b: {title: '(b) 味方は偵察機なし（敵は (a) と同じ）', enemy: EMPIRE, enemyMode: 'patrol', recon: [null, {flights: 8, size: 4, fan: 360, search: 15000 * KM}]},
  c: {title: '(c) 敵は小型艦だけ、小惑星のそばで低放射：4 機 × 6 編隊', enemy: SMALL, enemyMode: 'hide', recon: [{flights: 6, size: 4, fan: 60, search: 12000 * KM}, null]},
  c2: {title: '(c2) (c) で「浮遊物（推定）」も見に行く', enemy: SMALL, enemyMode: 'hide', investigateQuiet: true, recon: [{flights: 6, size: 4, fan: 60, search: 12000 * KM}, null]},
  c2x12: {title: '(c) の編隊ちがい：12 機 × 2 編隊', enemy: SMALL, enemyMode: 'hide', recon: [{flights: 2, size: 12, fan: 60, search: 12000 * KM}, null]},
  c12x2: {title: '(c) の編隊ちがい：2 機 × 12 編隊', enemy: SMALL, enemyMode: 'hide', recon: [{flights: 12, size: 2, fan: 60, search: 12000 * KM}, null]},
  aLock: {title: '(aLock) (a) で、識別した敵艦に双方がロックを掛ける', lock: true, enemy: EMPIRE, enemyMode: 'patrol', recon: [{flights: 6, size: 4, fan: 120, search: 15000 * KM}, {flights: 8, size: 4, fan: 360, search: 15000 * KM}]},
  cLock: {title: '(cLock) (c) 12 機 × 2 編隊で、識別した敵艦にロックを掛ける', lock: true, enemy: SMALL, enemyMode: 'hide', recon: [{flights: 2, size: 12, fan: 60, search: 12000 * KM}, null]},
  e2: {title: '(e2) 【仮定】ネビュロン B 2 隻に偵察機を載せ替えて分派 ＋ 本隊から 4 機 × 4 編隊', enemy: EMPIRE, enemyMode: 'patrol', detach: {carrier: true, assumeTransfer: true, forward: 5000 * KM, spread: 50, search: 15000 * KM}, recon: [{flights: 4, size: 4, fan: 120, search: 15000 * KM}, {flights: 8, size: 4, fan: 360, search: 15000 * KM}]},
  e3: {title: '(e3) 速い小型艦（CR90）を偵察に分派 ＋ 本隊から 4 機 × 6 編隊', enemy: EMPIRE, enemyMode: 'patrol', detach: {fast: true, search: 15000 * KM}, recon: [{flights: 6, size: 4, fan: 120, search: 15000 * KM}, {flights: 8, size: 4, fan: 360, search: 15000 * KM}]},
  e3only: {title: '(e3only) 速い小型艦（CR90）だけで偵察（偵察機なし）', enemy: EMPIRE, enemyMode: 'patrol', detach: {fast: true, search: 15000 * KM}, recon: [null, {flights: 8, size: 4, fan: 360, search: 15000 * KM}]},
  f1: {title: '(f1) 味方の GR-75 × 3 ＋ 護衛（ネビュロン B）が敵の見張りのそばを通る。輸送艦は船籍表示を出す', layout: 'convoy', convoy: {side: 0, ships: ['gr75', 'gr75', 'gr75', 'nebulonb'], picket: ['imperial', 'arquitens'], xpdr: true, pass: [20 * KM, 45 * KM]}, recon: [null, null]},
  f2: {title: '(f2) (f1) で、輸送艦が船籍表示を出さない', layout: 'convoy', convoy: {side: 0, ships: ['gr75', 'gr75', 'gr75', 'nebulonb'], picket: ['imperial', 'arquitens'], xpdr: false, pass: [20 * KM, 45 * KM]}, recon: [null, null]},
  f3: {title: '(f3) 味方の GR-75 × 3 だけ（護衛なし）、船籍表示を出す', layout: 'convoy', convoy: {side: 0, ships: ['gr75', 'gr75', 'gr75'], picket: ['imperial', 'arquitens'], xpdr: true, pass: [20 * KM, 45 * KM]}, recon: [null, null]},
  f4: {title: '(f4) 味方の GR-75 × 3 だけ（護衛なし）、船籍表示を出さない', layout: 'convoy', convoy: {side: 0, ships: ['gr75', 'gr75', 'gr75'], picket: ['imperial', 'arquitens'], xpdr: false, pass: [20 * KM, 45 * KM]}, recon: [null, null]},
  h1: {title: '(h1) 味方の CR90 × 2 ＋ 護衛（ネビュロン B）が敵の見張りのそばを通る。CR90 は船籍表示を出さない（軍用）', layout: 'convoy', convoy: {side: 0, ships: ['cr90', 'cr90', 'nebulonb'], picket: ['imperial', 'arquitens'], xpdr: false, pass: [20 * KM, 45 * KM]}, recon: [null, null]},
  h2: {title: '(h2) 味方の CR90 × 2 だけ、船籍表示を出さない（軍用）', layout: 'convoy', convoy: {side: 0, ships: ['cr90', 'cr90'], picket: ['imperial', 'arquitens'], xpdr: false, pass: [20 * KM, 45 * KM]}, recon: [null, null]},
  h3: {title: '(h3) 味方の CR90 × 2 だけ、船籍表示を出す【仮定：外交艦を装う】', layout: 'convoy', convoy: {side: 0, ships: ['cr90', 'cr90'], picket: ['imperial', 'arquitens'], xpdr: true, pass: [20 * KM, 45 * KM]}, recon: [null, null]},
  h4: {title: '(h4) 敵の CR90 × 2 ＋ 護衛（アークワイテンス）が味方の見張りのそばを通る。CR90 は船籍表示を出さない', layout: 'convoy', convoy: {side: 1, ships: ['cr90', 'cr90', 'arquitens'], picket: ['mc80liberty', 'nebulonb'], xpdr: false, pass: [20 * KM, 45 * KM]}, recon: [null, null]},
  g1: {title: '(g1) 敵のゴザンティ × 3 ＋ 護衛（アークワイテンス）が味方の見張りのそばを通る。輸送艦は船籍表示を出す', layout: 'convoy', convoy: {side: 1, ships: ['gozanti', 'gozanti', 'gozanti', 'arquitens'], picket: ['mc80liberty', 'nebulonb'], xpdr: true, pass: [20 * KM, 45 * KM]}, recon: [null, null]},
  g2: {title: '(g2) 敵のゴザンティ × 3 だけ（護衛なし）、船籍表示を出す', layout: 'convoy', convoy: {side: 1, ships: ['gozanti', 'gozanti', 'gozanti'], picket: ['mc80liberty', 'nebulonb'], xpdr: true, pass: [20 * KM, 45 * KM]}, recon: [null, null]},
  d: {title: '(d) 双方とも偵察機なし', enemy: EMPIRE, enemyMode: 'patrol', recon: [null, null]}
};
const SIDE_NAME = ['味方（反乱同盟）', '敵（帝国）'];
const polar = (r, deg, y = 0) => [r * Math.cos(deg * Math.PI / 180), y, r * Math.sin(deg * Math.PI / 180)];
const angleOf = p => Math.atan2(p[2], p[0]) * 180 / Math.PI;

// 輸送艦の列が、相手の見張り（止まっている艦）のそばを、商船の航路に沿って通り過ぎる場面 ★
function setupConvoy(sceneKey, seed) {
  const sc = SCENES[sceneKey], cv = sc.convoy, R = rng(seed * 7919 + 13), ents = [], notes = [], P0 = polar(30000 * KM, 0), pass = R.range(cv.pass[0], cv.pass[1]);
  const mk = o => { const e = {wake: [], accelNow: 0, emcon: 'normal', radarOn: true, xpdr: false, n: 1, vel: [0, 0, 0], path: [], ...o}; ents.push(e); return e; };
  const pre = s => s ? 'B' : 'A', speed = Math.min(...cv.ships.map(k => shipTraits(k).maxSpeed)) * K.CRUISE;
  cv.ships.forEach((key, i) => { const tr = shipTraits(key), civil = K.CIVIL_TYPES.includes(key), o = [pass + (i % 2) * 2 * KM, 0, -6000 * KM - i * 2 * KM]; mk({id: pre(cv.side) + i + '_' + key, kind: 'ship', side: cv.side, key, tr, pos: add(P0, o), goal: add(P0, [o[0], 0, 40000 * KM]), speed, xpdr: civil && cv.xpdr, convoy: true}); });
  cv.picket.forEach((key, i) => mk({id: pre(1 - cv.side) + i + '_' + key, kind: 'ship', side: 1 - cv.side, key, tr: shipTraits(key), pos: add(P0, [-i * 5 * KM, 0, i * 3 * KM]), speed: 0}));
  const noX = new Map([[1, '出し忘れ'], [5, '怪しい商船']]);
  MERCHANT_KEYS.forEach((key, i) => { const tr = shipTraits(key), dir = R() < 0.5 ? -1 : 1, x = (R() < 0.5 ? -1 : 1) * R.range(60, 1500) * KM, pos = add(P0, [x, R.range(-50, 50) * KM, R.range(-8000, 8000) * KM]); mk({id: 'M' + i + '_' + key, kind: 'ship', side: 2, key, tr, pos, goal: add(pos, [0, 0, dir * 60000 * KM]), speed: tr.maxSpeed * K.CRUISE * 0.5, xpdr: !noX.has(i), xpdrWhy: noX.get(i) || null}); });
  for (let i = 0; i < 10; i++) { const d = Math.round(R.range(30, 400)); mk({id: 'R' + String(i).padStart(2, '0') + '_' + d + 'm', kind: 'rock', side: 3, key: 'rock', tr: rockTraits(d), pos: add(P0, [R.range(-1500, 1500) * KM, R.range(-200, 200) * KM, R.range(-3000, 3000) * KM]), vel: [R.range(-30, 30), 0, R.range(-30, 30)], radarOn: false}); }
  for (let i = 0; i < K.NEUTRAL_CR90; i++) { const tr = shipTraits('cr90'), dir = R() < 0.5 ? -1 : 1, x = (R() < 0.5 ? -1 : 1) * R.range(60, 1500) * KM, pos = add(P0, [x, R.range(-50, 50) * KM, R.range(-8000, 8000) * KM]), shows = R() < K.NEUTRAL_CR90_XPDR; mk({id: 'N' + i + '_cr90', kind: 'ship', side: 2, key: 'cr90', tr, pos, goal: add(pos, [0, 0, dir * 60000 * KM]), speed: tr.maxSpeed * K.CRUISE * 0.5, diplomat: true, xpdr: shows, xpdrWhy: shows ? null : '外交艦が出していない'}); }
  notes.push(`${SIDE_NAME[cv.side]}の列（${cv.ships.map(k => shipTraits(k).name).join('、')}）が ${Math.round(speed)} m/s で、${SIDE_NAME[1 - cv.side]}の見張り（${cv.picket.map(k => shipTraits(k).name).join('、')}）のそばを通る。民間でも使われる艦種の艦の船籍表示：${cv.xpdr ? '出す【仮定：商船・外交艦に紛れる】' : '出さない'}`);
  return {sc, sceneKey, seed, ents, notes, lock: false, R: rng(seed * 104729 + 7), eCentre: P0, investigateQuiet: false};
}
// ====================================================================================================
// 停泊中の主力艦隊（低軌道）と外周の哨戒の場面 ★（ユーザー 2026-11-25）
//  mode 'march'：反乱軍の本隊が縁から惑星へ進む。mode 'jump'：本隊は別の星系で待ち、偽装貨物船とハイパードライブを持つ偵察機だけが入り、見つけたら本隊を呼ぶ
//  情報（intel）は「どこを探すか・どこへ向かうか」にだけ使う。接触・追跡の枠・所属は、実際にセンサーに映るまで付かない
// ====================================================================================================
// 惑星を避けて飛ぶときの道のりの見積もり（接線 ＋ 弧 ＋ 接線）
function pathLen(P, A) { const k = K.PLANET_RADIUS + K.PLANET_KEEPOUT, d = sub(A, P), L2 = dot(d, d), t = L2 > 0 ? Math.max(0, Math.min(1, -dot(P, d) / L2)) : 0; if (len(add(P, mul(d, t))) >= k) return Math.sqrt(L2);
  const p = len(P), a = len(A), phi = Math.acos(Math.max(-1, Math.min(1, dot(P, A) / (p * a)))), arc = phi - Math.acos(Math.min(1, k / p)) - Math.acos(Math.min(1, k / a)); return Math.sqrt(Math.max(0, p * p - k * k)) + Math.sqrt(Math.max(0, a * a - k * k)) + k * Math.max(0, arc); }
function setupAnchor(sceneKey, seed) {
  const sc = SCENES[sceneKey], an = {...K.ANCHOR, ...sc.anchor}, R = rng(seed * 7919 + 13), ents = [], notes = [], P = K.PLACE, kmn = x => Math.round(x / KM).toLocaleString('en-US');
  const mk = o => { const e = {wake: [], accelNow: 0, emcon: 'normal', radarOn: true, xpdr: false, n: 1, vel: [0, 0, 0], path: [], ...o}; ents.push(e); return e; };
  const jump = an.mode === 'jump', rOrb = K.PLANET_RADIUS + an.alt, vOrb = Math.sqrt(K.PLANET_G * K.PLANET_RADIUS ** 2 / rOrb), limit = jump ? an.jumpLimit : an.limit;
  const aStart = polar(P.friendStart, 0), aSpeed = Math.min(...REBEL.map(k => shipTraits(k).maxSpeed)) * K.FLEET_SPEED_SHARE, goalR = an.intel ? rOrb : P.friendGoal;
  const fromEntry = (dist, bearingMax, yMax) => { for (let i = 0; i < 200; i++) { const b = R.range(-bearingMax, bearingMax) * Math.PI / 180, d = R.range(dist[0], dist[1]), p = [aStart[0] - d * Math.cos(b), R.range(-yMax, yMax), d * Math.sin(b)]; const rr = Math.hypot(p[0], p[2]); if (rr < K.MAP_RADIUS - 500 * KM && len(p) > K.PLANET_RADIUS + 2000 * KM) return p; } return polar(30000 * KM, 20); };
  // 反乱軍の本隊。march：縁から進む。jump：始めは星系にいない（gone）。呼ばれたら anchorStep が軌道の上に置く
  REBEL.forEach((key, i) => mk({id: 'A' + i + '_' + key, kind: 'ship', side: 0, role: 'fleet', key, tr: shipTraits(key), pos: add(aStart, [0, 0, (i - 2) * 5 * KM]), goal: jump ? null : add(polar(goalR, 0), [0, 0, (i - 2) * 5 * KM]), speed: jump ? 0 : aSpeed, ...(jump ? {gone: true, offMap: true} : {})}));
  // 帝国の主力：低軌道を一列で回る。機関を絞る場面では低放射・レーダー停止（Core.EMCON.low）
  const a0 = R.range(-180, 180) * Math.PI / 180, odir = R() < 0.5 ? -1 : 1, w = odir * vOrb / rOrb; let bi = 0;
  an.main.forEach((key, i) => { const a = a0 - odir * i * an.mainSpacing / rOrb; mk({id: 'B' + (bi++) + '_' + key, kind: 'ship', side: 1, role: 'main', key, tr: shipTraits(key), pos: [rOrb * Math.cos(a), 0, rOrb * Math.sin(a)], orbit: {r: rOrb, w, a}, emcon: an.quiet ? 'low' : 'normal', radarOn: !an.quiet, speed: vOrb}); });
  // 哨戒：輪の上に等間隔。既存の「哨戒中の敵艦隊」と同じ速さ（一番遅い艦の最高速度 × PATROL_SPEED_SHARE）
  const pPhase = R.range(0, 360), pdir = R() < 0.5 ? -1 : 1, pSpeed = Math.min(...an.patrolGroup.map(k => shipTraits(k).maxSpeed)) * K.PATROL_SPEED_SHARE;
  for (let g = 0; g < an.patrolGroups; g++) { const c = polar(an.patrolR, pPhase + g * 360 / an.patrolGroups); an.patrolGroup.forEach(key => { const off = [R.range(-1, 1) * 8 * KM, R.range(-1, 1) * 3 * KM, R.range(-1, 1) * 8 * KM]; mk({id: 'B' + (bi++) + '_' + key, kind: 'ship', side: 1, role: 'patrol', group: g, key, tr: shipTraits(key), pos: add(c, off), patrol: {r: an.patrolR, y: 0, dir: pdir, off}, speed: pSpeed}); }); }
  // 商船・小惑星・中立の CR90：ほかの場面と同じ置き方。ただし「敵の近くの 8 個」に当たる小惑星は、マップ全体に置く ★
  const noX = new Map([[1, '出し忘れ'], [5, '怪しい商船']]);
  MERCHANT_KEYS.forEach((key, i) => { const tr = shipTraits(key), near = noX.has(i), pos = near ? fromEntry(P.noXpdrDist, 60, P.noXpdrY) : polar(R.range(P.merchantR[0], P.merchantR[1]), R.range(-180, 180), R.range(-P.merchantY, P.merchantY));
    mk({id: 'M' + i + '_' + key, kind: 'ship', side: 2, key, tr, pos, xpdr: !noX.has(i), xpdrWhy: noX.get(i) || null, patrol: {r: Math.hypot(pos[0], pos[2]), y: pos[1], dir: R() < 0.5 ? -1 : 1, off: [0, 0, 0]}, speed: tr.maxSpeed * K.CRUISE * 0.5}); });
  for (let i = 0; i < 30; i++) { const d = Math.round(R.range(30, 400)), pos = i < P.rockNearFriend ? fromEntry([1000 * KM, P.rockNearDist], 70, P.rockNearY) : polar(R.range(8000, 49000) * KM, R.range(-180, 180), R.range(-P.rockY, P.rockY));
    mk({id: 'R' + String(i).padStart(2, '0') + '_' + d + 'm', kind: 'rock', side: 3, key: 'rock', tr: rockTraits(d), pos, vel: [R.range(-30, 30), 0, R.range(-30, 30)], radarOn: false}); }
  for (let i = 0; i < K.NEUTRAL_CR90; i++) { const tr = shipTraits('cr90'), pos = i % 2 === 0 ? fromEntry(P.noXpdrDist, 60, P.noXpdrY) : polar(R.range(P.merchantR[0], P.merchantR[1]), R.range(-180, 180), R.range(-P.merchantY, P.merchantY)), shows = R() < K.NEUTRAL_CR90_XPDR;
    mk({id: 'N' + i + '_cr90', kind: 'ship', side: 2, key: 'cr90', tr, pos, diplomat: true, xpdr: shows, xpdrWhy: shows ? null : '外交艦が出していない', patrol: {r: Math.hypot(pos[0], pos[2]), y: pos[1], dir: R() < 0.5 ? -1 : 1, off: [0, 0, 0]}, speed: tr.maxSpeed * K.CRUISE * 0.5}); }
  for (const e of ents) if (e.kind === 'ship') e.air = (e.tr.air || []).map(a => ({...a}));
  const A = {mode: jump ? 'jump' : 'march', intel: an.intel, quiet: !!an.quiet, rOrb, vOrb, w, a0, an, launch: null, disc: {blip: null, confirm: null}, call: null, arrive: null};
  const ringPt = a => [rOrb * Math.cos(a), 0, rOrb * Math.sin(a)], own = ents.filter(e => e.kind === 'ship' && e.side === 0);
  const flightOf = (o, i) => mk({kind: 'flight', scout: true, side: 0, role: 'scout', state: 'out', searched: new Map(), wp: 0, ...o});
  notes.push(`帝国の主力（${an.main.map(k => shipTraits(k).name.split('｜')[0]).join('、')}）：高さ ${kmn(an.alt)} km の円軌道（惑星の中心から ${kmn(rOrb)} km、${(vOrb / 1000).toFixed(2)} km/s、1 周 ${Math.round(2 * Math.PI * rOrb / vOrb / 60)} 分）、${an.quiet ? '機関を絞る（低放射・レーダー停止）' : '通常の放射'}。偵察機は出さない ★`);
  notes.push(`哨戒：${an.patrolGroup.map(k => shipTraits(k).name).join('＋')} の群 × ${an.patrolGroups}、惑星の中心から ${kmn(an.patrolR)} km の輪を ${Math.round(pSpeed)} m/s で回る。搭載機：ドレッドノート級の 12 機は機種の指定が無く性能表を作れないので、偵察機なし`);
  if (!jump && !an.intel) { // 情報なし：場面 a と同じ（開始時に、進む向きを中心にした扇へ）
    const routeFrom = (origin, headingDeg, offs, elDeg, dist) => { const el = elDeg * Math.PI / 180, bz = (headingDeg + offs) * Math.PI / 180, dir = [Math.cos(bz) * Math.cos(el), Math.sin(el), Math.sin(bz) * Math.cos(el)]; let o2 = dist; for (; o2 > 0; o2 -= 100 * KM) { const q = add(origin, mul(dir, o2)); if (Math.hypot(q[0], q[2]) <= K.MAP_RADIUS - 200 * KM && Math.abs(q[1]) <= K.MAP_HALF_HEIGHT) break; } return [add(origin, mul(dir, Math.max(o2, 100 * KM)))]; };
    const stock = own.flatMap(cv => cv.air.filter(a => C.FLEET_AIR.roles[a.type]).map(a => { const rr = reconRange(craftTraits(a.type)); return {type: a.type, reach: rr.reach, speed: rr.speed, count: a.count, home: cv}; })), pick = chooseRecon(stock, an.search, an.reconFlights, an.reconSize);
    pick.flights.forEach((s, i) => { const tr = craftTraits(s.type), rr = reconRange(tr), n = pick.flights.length, offs = n === 1 ? 0 : -an.fan + i * 2 * an.fan / (n - 1); flightOf({id: 'Af' + i + '_' + s.type + 'x' + an.reconSize, key: tr.key, type: s.type, tr, n: an.reconSize, pos: s.home.pos.slice(), home: s.home, route: routeFrom(s.home.pos, 180, offs, K.RECON_ELEV[i % K.RECON_ELEV.length], Math.min(rr.reach, pick.searchDist)), speed: rr.speed, rangeLeft: rr.range * K.RECON_RANGE_USE}); });
    notes.push(`反乱軍：情報なし。本隊は惑星の中心から ${kmn(goalR)} km まで進む。偵察は開始時に ${[...new Set(pick.flights.map(f => craftTraits(f.type).name))].join('、')} ${an.reconSize} 機 × ${pick.flights.length} 編隊を左右 ${an.fan}° の扇へ ${kmn(pick.searchDist)} km（場面 a と同じ）`);
  } else if (!jump) { // 情報あり・本隊が進む：いちばん遠くまで届く機種を選び、惑星の中心までの距離がその届く距離に入ったら発進 ★
    const stock = own.flatMap(cv => cv.air.filter(a => C.FLEET_AIR.roles[a.type]).map(a => { const rr = reconRange(craftTraits(a.type)); return {type: a.type, reach: rr.reach, speed: rr.speed, count: a.count, home: cv}; })), pick = chooseRecon(stock, Infinity, an.reconFlights, an.reconSize), n = pick.flights.length;
    A.launch = {dist: pick.searchDist, homes: [...new Set(pick.flights.map(f => f.home))], t: null, d: null};
    pick.flights.forEach((s, i) => { const tr = craftTraits(s.type), rr = reconRange(tr);
      // 向かう点：軌道だけ分かっているときは軌道の輪を等分した点。位置まで分かっているときは、着くころの予測位置（編隊ごとに少しずらす）
      const aim = pos => { if (an.intel === 'orbit') return [ringPt((i + 0.5) * 2 * Math.PI / n)]; let tArr = A.launch.t, pt = null; for (let k = 0; k < 8; k++) { pt = ringPt(a0 + w * (tArr + K.DT) + (i - (n - 1) / 2) * an.posSpread * Math.PI / 180); tArr = A.launch.t + pathLen(pos, pt) / rr.speed; } return [pt]; };
      flightOf({id: 'Af' + i + '_' + s.type + 'x' + an.reconSize, key: tr.key, type: s.type, tr, n: an.reconSize, pos: s.home.pos.slice(), home: s.home, plan: {}, routeFrom: aim, route: [], speed: rr.speed, rangeLeft: rr.range * K.RECON_RANGE_USE, gone: true, aboard: true}); });
    notes.push(`反乱軍：情報は「${an.intel === 'orbit' ? '主力は低軌道にいる（軌道上の位置は分からない）' : '主力の開始時刻の軌道上の位置と回る向きまで'}」。本隊は主力の軌道の高さ（惑星の中心から ${kmn(goalR)} km、+x 側）まで進む。偵察は ${[...new Set(pick.flights.map(f => craftTraits(f.type).name))].join('、')} ${an.reconSize} 機 × ${n} 編隊を、惑星の中心まで ${kmn(pick.searchDist)} km（届く距離）に入った時に出す。向かう点：${an.intel === 'orbit' ? '軌道の輪を ' + n + ' 等分した点' : '着くころの予測位置（編隊ごとに ' + an.posSpread + '° ずつずらす）'}`);
  } else { // 本隊は別の星系。偽装貨物船と、ハイパードライブを持つ機種の偵察機だけが跳んで来る
    const merchSpeed = k => shipTraits(k).maxSpeed * K.CRUISE * 0.5, fa = R.range(-180, 180) * Math.PI / 180, sa = R.range(-180, 180) * Math.PI / 180;
    // 偽装貨物船：惑星の中心から jumpInR の所に現れ、商船と同じ速さで、主力の軌道の少し外（中心から freighterPass）をかすめて通り過ぎる
    an.freighters.forEach((key, i) => { const a = fa + i * 2 * Math.PI / an.freighters.length, start = ringAt(an.jumpInR, a), turn = Math.asin(an.freighterPass / an.jumpInR) * (i % 2 ? -1 : 1), b = a + Math.PI + turn, dir = [Math.cos(b), 0, Math.sin(b)];
      mk({id: 'Ac' + i + '_' + key, kind: 'ship', side: 0, role: 'freighter', key, tr: shipTraits(key), pos: start, goal: add(start, mul(dir, 60000 * KM)), speed: merchSpeed(key), xpdr: !!an.freighterXpdr, disguised: true}); });
    // 偵察機：本隊の搭載機のうち、設計にハイパードライブの部品（k:"hyper"）がある機種。母艦なしで jumpInR の 1 点に現れる。跳んで帰るので、届く距離 ＝ 航続 × RECON_RANGE_USE（帰りの分を残さない）★
    const types = {}; for (const k of REBEL) for (const a of shipTraits(k).air || []) if (C.FLEET_AIR.roles[a.type]) types[a.type] = (types[a.type] || 0) + a.count;
    const stock = Object.entries(types).map(([type, count]) => { const tr = craftTraits(type), rr = reconRange(tr); return {type, count, hyper: tr.hyper, reach: rr.range * K.RECON_RANGE_USE, speed: rr.speed, home: null}; }), canJump = stock.filter(x => x.hyper), spot = ringAt(an.jumpInR, sa), n = an.scouts ? an.reconFlights : 0, used = [];
    const slots = Array.from({length: n}, (_, i) => { const a = (i + 0.5) * 2 * Math.PI / n; return {i, a, d: pathLen(spot, ringPt(a))}; }).sort((x, y) => x.d - y.d);
    for (const sl of slots) { const pick = chooseRecon(canJump, sl.d, 1, an.reconSize); if (!pick.flights.length) continue; const s = pick.flights[0], st = canJump.find(x => x.type === s.type); st.count -= an.reconSize; const tr = craftTraits(s.type), rr = reconRange(tr), dirn = sl.i % 2 ? -1 : 1;
      // 軌道の輪の 1 点へ行き、そのあと輪に沿って 30° ずつ進む（帰る母艦が無いので、航続が尽きるまで探して跳んで帰る）★
      const route = Array.from({length: 13}, (_, k) => ringPt(sl.a + dirn * k * Math.PI / 6)); used.push({type: s.type, d: sl.d, reaches: pick.reaches});
      flightOf({id: 'Af' + sl.i + '_' + s.type + 'x' + an.reconSize, key: tr.key, type: s.type, tr, n: an.reconSize, pos: spot.slice(), home: null, jump: true, route, speed: rr.speed, rangeLeft: rr.range * K.RECON_RANGE_USE}); }
    const by = {}; for (const u of used) by[u.type] = (by[u.type] || 0) + 1;
    notes.push(`反乱軍の本隊（${REBEL.map(k => shipTraits(k).name).join('、')}）は別の星系で待つ。星系に入るのは：偽装貨物船 ${an.freighters.map(k => shipTraits(k).name).join('、')}（船籍表示を${an.freighterXpdr ? '出す' : '出さない'}。惑星の中心から ${kmn(an.jumpInR)} km に現れ、${Math.round(merchSpeed(an.freighters[0]))} m/s で、中心から ${kmn(an.freighterPass)} km をかすめて通り過ぎる）${n ? '、偵察機（' + Object.entries(by).map(([t, c]) => `${craftTraits(t).name} ${an.reconSize} 機 × ${c} 編隊`).join('、') + '。母艦なしで、惑星の中心から ' + kmn(an.jumpInR) + ' km の 1 点に現れ、軌道の輪の ' + n + ' 等分点へ向かい、輪に沿って探す）' : '（偵察機なし）'}`);
    notes.push(`ハイパードライブの部品を持つ機種（設計から）：${stock.map(x => craftTraits(x.type).name + (x.hyper ? ' あり' : ' なし')).join('、')}。跳んで帰る場合の届く距離：${stock.map(x => craftTraits(x.type).name + ' ' + kmn(x.reach) + ' km').join('、')}`);
    notes.push(`本隊を呼ぶ基準：${an.callOn === 'blip' ? '低軌道の帯（軌道の半径 ± ' + kmn(an.band) + ' km）に動力のある光点を見つけた時' : '低軌道の帯にいる艦を敵と確定した時'}。呼んでから ${an.callDelay / 60} 分後に、その接触の後ろ ${kmn(an.arriveBehind)} km（同じ軌道）に現れる。帝国の戦闘準備にかかる時間の仮の値：${an.prep / 60} 分`);
  }
  return {sc, sceneKey, seed, ents, notes, lock: false, R: rng(seed * 104729 + 7), eCentre: ents.find(e => e.role === 'main').pos.slice(), investigateQuiet: K.RECON_INVESTIGATE_QUIET, anchor: A, limit};
}
function ringAt(r, a) { return [r * Math.cos(a), 0, r * Math.sin(a)]; }
// 停泊の場面の毎ステップの処理：偵察機の発進、「発見」の判定、本隊を呼ぶ・現れる。真値は使わず、反乱軍の接触の一覧だけで決める
function anchorStep(W, t) {
  const A = W.anchor, an = A.an, L = A.launch;
  if (L && L.t == null) { const d = Math.min(...L.homes.map(h => len(h.pos))); if (d <= L.dist) { L.t = t; L.d = d; for (const h of L.homes) h.launchReady = true; } }
  if (t % K.TRACK_EVERY >= K.DT) return;
  const inBand = c => c.est && Math.abs(Math.hypot(c.est[0], c.est[2]) - A.rOrb) <= an.band && Math.abs(c.est[1]) <= an.band && c.target.kind !== 'flight';
  for (const c of W.sides[0].contacts.values()) { if (!inBand(c) || c.xpdr === 'shown' || c.id?.kind === 'rock') continue; const rec = k => { if (!A.disc[k]) A.disc[k] = {t, id: c.target.id, isMain: c.target.role === 'main', est: c.est.slice(), estAt: c.estAt ?? t, precise: c.hold.rad.on || c.hold.vis.on}; };
    if (c.stage === ST.POWERED || c.stage === ST.SUSPECT || c.alleg === 'hostile') rec('blip'); if (c.alleg === 'hostile' && c.id?.kind === 'ship') rec('confirm'); }
  if (A.mode !== 'jump') return;
  const d = A.disc[an.callOn]; if (d && !A.call) A.call = {t, by: an.callOn, arriveT: t + an.callDelay};
  if (A.call && !A.arrive && t >= A.call.arriveT) { const a = Math.atan2(d.est[2], d.est[0]) + A.w * (t - K.DT - d.estAt), // 発見した時の位置の見積もりを、軌道の速さで現れる時刻まで進める（回る向きは観測で分かったものとする ★。この後の moveAll が 1 刻みぶん進める）
       sgn = Math.sign(A.w), fleet = W.ents.filter(e => e.role === 'fleet');
    fleet.forEach((e, i) => { const ai = a - sgn * (an.arriveBehind + i * an.fleetSpacing) / A.rOrb; e.pos = ringAt(A.rOrb, ai); e.orbit = {r: A.rOrb, w: A.w, a: ai}; e.gone = false; delete e.offMap; });
    A.arrive = {t, nearest: Math.min(...fleet.flatMap(e => W.ents.filter(x => x.role === 'main').map(x => len(sub(x.pos, e.pos)))))}; }
}
function setup(sceneKey, seed) {
  if (SCENES[sceneKey].layout === 'convoy') return setupConvoy(sceneKey, seed);
  if (SCENES[sceneKey].layout === 'anchor') return setupAnchor(sceneKey, seed);
  const sc = SCENES[sceneKey], R = rng(seed * 7919 + 13), ents = [];
  const mk = o => { const e = {wake: [], accelNow: 0, emcon: 'normal', radarOn: true, xpdr: false, n: 1, vel: [0, 0, 0], path: [], ...o}; ents.push(e); return e; };
  // 味方艦隊：+x 側の縁の近く（惑星の中心から 48,000 km）から入り、惑星へ向かって進む
  const P = K.PLACE, aStart = polar(P.friendStart, 0), aGoal = polar(P.friendGoal, 0), aSpeed = Math.min(...REBEL.map(k => shipTraits(k).maxSpeed)) * K.FLEET_SPEED_SHARE;
  REBEL.forEach((key, i) => mk({id: 'A' + i + '_' + key, kind: 'ship', side: 0, key, tr: shipTraits(key), pos: add(aStart, [0, 0, (i - 2) * 5 * KM]), goal: add(aGoal, [0, 0, (i - 2) * 5 * KM]), speed: aSpeed}));
  // 味方の入口から見て、進む向き（惑星の方）を中心にした方位・距離・高さで点を決める。マップの外や惑星の近くに出たら引き直す
  const fromEntry = (dist, bearingMax, yMax) => { for (let i = 0; i < 200; i++) { const b = R.range(-bearingMax, bearingMax) * Math.PI / 180, d = R.range(dist[0], dist[1]), p = [aStart[0] - d * Math.cos(b), R.range(-yMax, yMax), d * Math.sin(b)]; const rr = Math.hypot(p[0], p[2]); if (rr < K.MAP_RADIUS - 500 * KM && len(p) > K.PLANET_RADIUS + 2000 * KM) return p; } return polar(30000 * KM, 20); };
  // 敵艦隊
  const hide = sc.enemyMode === 'hide', eCentre = hide ? fromEntry(P.hideDist, P.hideBearing, P.hideY) : fromEntry(P.enemyDist, P.enemyBearing, P.enemyY), eRad = Math.hypot(eCentre[0], eCentre[2]), eY = eCentre[1], sign = R() < 0.5 ? -1 : 1;
  const eSpeed = Math.min(...sc.enemy.map(k => shipTraits(k).maxSpeed)) * K.PATROL_SPEED_SHARE;
  sc.enemy.forEach((key, i) => { const off = [R.range(-1, 1) * (hide ? 20 : 8) * KM, R.range(-1, 1) * 3 * KM, R.range(-1, 1) * (hide ? 20 : 8) * KM];
    mk({id: 'B' + i + '_' + key, kind: 'ship', side: 1, key, tr: shipTraits(key), pos: add(eCentre, off), emcon: hide ? 'low' : 'normal', radarOn: !hide, patrol: hide ? null : {r: eRad, y: eY + off[1], dir: sign, off}, speed: hide ? 0 : eSpeed}); });
  // 商船 8 隻：惑星のまわりを回る。うち 2 隻は船籍表示なし（1 隻は怪しい商船、1 隻は出し忘れ）で、味方の入口の近くに置く
  const noX = new Map([[1, '出し忘れ'], [5, '怪しい商船']]);
  MERCHANT_KEYS.forEach((key, i) => { const tr = shipTraits(key), near = noX.has(i), pos = near ? fromEntry(P.noXpdrDist, 60, P.noXpdrY) : polar(R.range(P.merchantR[0], P.merchantR[1]), R.range(-180, 180), R.range(-P.merchantY, P.merchantY));
    mk({id: 'M' + i + '_' + key, kind: 'ship', side: 2, key, tr, pos, xpdr: !noX.has(i), xpdrWhy: noX.get(i) || null, patrol: {r: Math.hypot(pos[0], pos[2]), y: pos[1], dir: R() < 0.5 ? -1 : 1, off: [0, 0, 0]}, speed: tr.maxSpeed * K.CRUISE * 0.5}); });
  // 小惑星 30 個（構造物だけの浮遊物）：8 個は敵の近く、11 個は味方の入口から 15,000 km 以内、残りはマップ全体
  for (let i = 0; i < 30; i++) { const d = Math.round(R.range(30, 400)), near = i < 8;
    const pos = near ? add(eCentre, [R.range(-1, 1) * (hide ? 25 : 300) * KM, R.range(-1, 1) * (hide ? 5 : 100) * KM, R.range(-1, 1) * (hide ? 25 : 300) * KM]) : i < 8 + P.rockNearFriend ? fromEntry([1000 * KM, P.rockNearDist], 70, P.rockNearY) : polar(R.range(8000, 49000) * KM, R.range(-180, 180), R.range(-P.rockY, P.rockY));
    mk({id: 'R' + String(i).padStart(2, '0') + '_' + d + 'm', kind: 'rock', side: 3, key: 'rock', tr: rockTraits(d), pos, vel: [R.range(-30, 30), 0, R.range(-30, 30)], radarOn: false}); }
  // 中立の CR90（外交艦）：半分は味方の入口の近く、残りはマップ全体。大半は船籍表示を出している
  for (let i = 0; i < K.NEUTRAL_CR90; i++) { const tr = shipTraits('cr90'), pos = i % 2 === 0 ? fromEntry(P.noXpdrDist, 60, P.noXpdrY) : polar(R.range(P.merchantR[0], P.merchantR[1]), R.range(-180, 180), R.range(-P.merchantY, P.merchantY)), shows = R() < K.NEUTRAL_CR90_XPDR;
    mk({id: 'N' + i + '_cr90', kind: 'ship', side: 2, key: 'cr90', tr, pos, diplomat: true, xpdr: shows, xpdrWhy: shows ? null : '外交艦が出していない', patrol: {r: Math.hypot(pos[0], pos[2]), y: pos[1], dir: R() < 0.5 ? -1 : 1, off: [0, 0, 0]}, speed: tr.maxSpeed * K.CRUISE * 0.5}); }
  // ---- 偵察（3 つの手段：本隊から偵察機／航空機を運用できる小型艦を分派／速い小型艦そのもの）----
  const notes = [], routeFrom = (origin, headingDeg, offs, elDeg, dist) => { const el = elDeg * Math.PI / 180, bz = (headingDeg + offs) * Math.PI / 180, dir = [Math.cos(bz) * Math.cos(el), Math.sin(el), Math.sin(bz) * Math.cos(el)]; let out = dist;
    for (; out > 0; out -= 100 * KM) { const q = add(origin, mul(dir, out)); if (Math.hypot(q[0], q[2]) <= K.MAP_RADIUS - 200 * KM && Math.abs(q[1]) <= K.MAP_HALF_HEIGHT) break; } return [add(origin, mul(dir, Math.max(out, 100 * KM)))]; };
  const kmn = x => Math.round(x / KM).toLocaleString('en-US');
  for (const e of ents) if (e.kind === 'ship') e.air = (e.tr.air || []).map(a => ({...a}));
  for (const side of [0, 1]) { const rc = sc.recon[side], det = side === 0 ? sc.detach : null, heading = side === 0 ? 180 : angleOf(eCentre), own = ents.filter(e => e.kind === 'ship' && e.side === side), fleetCruise = Math.min(...own.map(e => e.tr.maxSpeed)) * K.FLEET_SPEED_SHARE, search = rc?.search ?? det?.search ?? 0;
    const stockOf = ships => ships.flatMap(cv => cv.air.filter(a => C.FLEET_AIR.roles[a.type]).map(a => { const rr = reconRange(craftTraits(a.type)); return {type: a.type, reach: rr.reach, speed: rr.speed, count: a.count, home: cv}; }));
    // (3) 速い小型艦そのものを偵察に出す：艦のセンサーで探す。動かし方は偵察の編隊と同じ
    if (det?.fast) { const picks = own.filter(e => detachRoles(e.tr, fleetCruise, search).fast.ok); if (!picks.length) notes.push(`${SIDE_NAME[side]}：速い小型艦として偵察に出せる艦が無い`);
      picks.forEach((e, i) => { const rr = reconRange(e.tr), offs = picks.length === 1 ? 0 : -40 + i * 80 / (picks.length - 1); Object.assign(e, {detached: 'fast', scout: true, home: own.find(x => !picks.includes(x)), route: routeFrom(e.pos, heading, offs, 0, Math.min(rr.reach, search)), wp: 0, speed: rr.speed, rangeLeft: rr.range * K.RECON_RANGE_USE, state: 'out', searched: new Map(), goal: null});
        notes.push(`${SIDE_NAME[side]}：${e.tr.name} を偵察に分派（巡航 ${Math.round(rr.speed)} m/s、本隊は ${Math.round(fleetCruise)} m/s。${kmn(Math.min(rr.reach, search))} km 先まで行って戻る）`); }); }
    // (2) 航空機を運用できる小型艦を分派：前へ出てから偵察機を出す。作例では小型艦に搭載機が無いので、格納庫の数までの載せ替えは「仮定」
    const carriersOut = [];
    if (det?.carrier) { const picks = own.filter(e => { const r = detachRoles(e.tr, fleetCruise, search).carrier; return r.ok || (det.assumeTransfer && r.hangar >= 2); }).filter(e => e.tr.len <= K.SMALL_SHIP_LEN); if (!picks.length) notes.push(`${SIDE_NAME[side]}：航空機を運用できる小型艦が無い`);
      picks.forEach((e, i) => { const has = e.air.filter(a => C.FLEET_AIR.roles[a.type]).reduce((n, a) => n + a.count, 0);
        if (has < 2 && det.assumeTransfer) { const n = Math.min(e.tr.hangarCap, 12), donor = chooseRecon(stockOf(own.filter(x => !picks.includes(x))), search, 1, n).flights[0]; if (!donor) return; donor.home.air.find(a => a.type === donor.type).count -= n; e.air.push({type: donor.type, count: n}); notes.push(`${SIDE_NAME[side]}：【仮定】${e.tr.name}（格納庫 ${e.tr.hangarCap} 機ぶん、作例では搭載機なし）へ ${donor.home.tr.name} の ${craftTraits(donor.type).name} ${n} 機を載せ替えて分派`); }
        const offs = picks.length === 1 ? 0 : -det.spread + i * 2 * det.spread / (picks.length - 1); Object.assign(e, {detached: 'carrier', detachOffs: offs, goal: routeFrom(e.pos, heading, offs, 0, det.forward)[0], speed: e.tr.maxSpeed * K.CRUISE, launchReady: false}); carriersOut.push(e); }); }
    // 偵察機の編隊：機種は航続で選ぶ（chooseRecon）。本隊の編隊はすぐ出る。分派した艦の編隊は、艦が前へ出てから出る
    const groups = []; if (rc) groups.push({ships: own.filter(e => !e.detached), flights: rc.flights, size: rc.size, fan: rc.fan, heading, wait: null});
    for (const cv of carriersOut) { const n = cv.air.filter(a => C.FLEET_AIR.roles[a.type]).reduce((m, a) => Math.max(m, a.count), 0); if (n >= 2) groups.push({ships: [cv], flights: Math.max(1, Math.floor(n / 12)), size: Math.min(12, n), fan: 0, heading: heading + cv.detachOffs, wait: cv}); }
    let fi = 0; for (const g of groups) { const pick = chooseRecon(stockOf(g.ships), search, g.flights, g.size), flights = pick.flights, by = {}; for (const f of flights) by[f.type] = (by[f.type] || 0) + 1;
      notes.push(`${SIDE_NAME[side]}の偵察${g.wait ? '（分派した ' + g.wait.tr.name + ' から）' : ''}：捜索する距離 ${kmn(search)} km → ${flights.length ? Object.entries(by).map(([t, n]) => `${craftTraits(t).name} ${g.size} 機 × ${n} 編隊`).join('、') : '出せる機体なし'}${pick.reaches || !flights.length ? '' : `（届く機種が無いので ${kmn(pick.searchDist)} km まで）`}${flights.length < g.flights ? `（機数が足りず ${g.flights} 編隊のうち ${flights.length}）` : ''}`);
      flights.forEach((s, i) => { const tr = craftTraits(s.type), rr = reconRange(tr), n = flights.length, offs = g.fan >= 360 ? (i + 0.5) * 360 / n - 180 : (n === 1 ? 0 : -g.fan + i * 2 * g.fan / (n - 1)), plan = {heading: g.heading, offs, el: K.RECON_ELEV[i % K.RECON_ELEV.length], dist: Math.min(rr.reach, pick.searchDist)};
        s.home.air.find(a => a.type === s.type).count -= g.size;
        mk({id: (side ? 'B' : 'A') + 'f' + (fi++) + '_' + s.type + 'x' + g.size, kind: 'flight', scout: true, side, key: tr.key, type: s.type, tr, n: g.size, pos: s.home.pos.slice(), home: s.home, plan, route: routeFrom(s.home.pos, plan.heading, plan.offs, plan.el, plan.dist), wp: 0, speed: rr.speed, rangeLeft: rr.range * K.RECON_RANGE_USE, state: 'out', searched: new Map(), gone: !!g.wait, aboard: !!g.wait, routeFrom}); }); }
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
    if (e.aboard) { e.pos = e.home.pos.slice(); if (e.home.launchReady) { e.aboard = false; e.gone = false; e.launchedAt = t; e.route = e.routeFrom(e.pos, e.plan.heading, e.plan.offs, e.plan.el, e.plan.dist); } continue; }
    if (e.gone) continue; const v0 = e.vel;
    if (e.kind === 'rock') e.pos = add(e.pos, mul(e.vel, dt));
    else if (e.scout) flightStep(W, e, t, dt);
    else if (e.orbit) { e.orbit.a += e.orbit.w * dt; const np = [e.orbit.r * Math.cos(e.orbit.a), 0, e.orbit.r * Math.sin(e.orbit.a)]; e.vel = mul(sub(np, e.pos), 1 / dt); e.pos = np; } // 円軌道（推進なしで回る）
    else if (e.patrol) { const w = e.speed / e.patrol.r * e.patrol.dir, base = sub(e.pos, e.patrol.off), a = Math.atan2(base[2], base[0]) + w * dt, np = add([e.patrol.r * Math.cos(a), e.patrol.y, e.patrol.r * Math.sin(a)], e.patrol.off); e.vel = mul(sub(np, e.pos), 1 / dt); e.pos = np; }
    else if (e.goal && e.speed > 0) { const s = steer(e.pos, e.goal, e.speed, dt); e.pos = s.pos; e.vel = s.arrived ? [0, 0, 0] : s.vel; if (s.arrived) { e.goal = null; if (e.detached === 'carrier') e.launchReady = true; } }
    e.accelNow = e.orbit ? 0 : len(sub(e.vel, v0)) / dt; // ★ 軌道を回っているだけの艦は、推進による加速なしとみなす
    if (e.kind !== 'rock' && e.tr.massKg * e.n >= K.WAKE_MIN_MASS && len(e.vel) > 1 && t % K.WAKE_EVERY < dt) { e.wake.push({pos: e.pos.slice(), t, Q: gravSource(e.tr, e.accelNow, e.n)}); while (e.wake.length && t - e.wake[0].t > K.WAKE_MAX_AGE) e.wake.shift(); }
    if (t % 300 < dt) e.path.push([e.pos[0], e.pos[2]]);
  }
}
function flightStep(W, f, t, dt) {
  const side = W.sides[f.side]; let goal = null;
  if (f.state !== 'back' && f.rangeLeft < (f.jump ? 0 : len(sub(f.home.pos, f.pos)) * 1.1) + f.speed * dt * 2) { f.state = 'back'; f.investigate = null; }
  if (f.jump && f.state === 'back') { f.gone = true; f.landedAt = t; f.vel = [0, 0, 0]; return; } // 母艦なしで跳んで来た編隊は、探し終えたらその場から跳んで帰る ★
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
  if (s.arrived) { if (f.state === 'back') { if (f.kind === 'flight') { f.gone = true; f.landedAt = t; } } else if (!f.investigate) { if (f.wp < f.route.length - 1) f.wp++; else f.state = 'back'; } }
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
  const AN = W.anchor ? side.log.anchor : null, fl = {occ: false, occId: false, clut: false, seen: false}; // 停泊の場面だけ：掩蔽・重力波の乱れが効いたかの記録（乱数は使わない）
  for (const tg of W.ents) {
    if (tg.side === sideIx || tg.gone) continue;
    let c = side.contacts.get(tg.id); const sig = emission(tg.tr, tg.emcon, tg.n), sigma = tg.tr.sigma * tg.n, Q = gravSource(tg.tr, tg.accelNow, tg.n), dark = inShadow(tg.pos);
    let best = {rad: 0, heat: 0, grav: 0}, bestD = {vis: Infinity, rad: Infinity, heat: Infinity, grav: Infinity, xpdr: Infinity}, see = false, idVis = false, xpdrHeard = false, xpdrCould = false, gravAt = null, gravWake = false, quietOK = false, fixers = [], radImg = 0, irImg = 0, dMin = Infinity, dMinObs = null;
    const who = {}, alt = AN && (sideIx === 0 ? tg.role === 'main' : tg.side === 0 && tg.kind === 'ship') ? {rad: 0, heat: 0, grav: 0} : null;
    let rs = null, ri = null;
    for (const x of obsPts) { const o = x.o; let oRad = 0, oIr = 0, oSee = false, oDet = 0, oIdVis = false;
      for (const p of x.pts) { const d = len(sub(tg.pos, p)); if (d < dMin) { dMin = d; dMinObs = o; } const los = !occulted(p, tg.pos);
        // 重力波（惑星は遮らない）：本体と、残っている航跡波のうち強い方
        if (Q > 0 || tg.wake.length) { let g = gravSNR(Q, o.tr.sens.nu, d, 1, x.pd), at = tg.pos, wk = false; for (const w of tg.wake) { const gw = gravSNR(w.Q, o.tr.sens.nu, len(sub(w.pos, p)), Math.exp(-(t - w.t) / K.WAKE_TAU), x.pd); if (gw > g) { g = gw; at = w.pos; wk = true; } } if (g > best.grav) { best.grav = g; gravAt = at; gravWake = wk; bestD.grav = d; who.grav = o; } if (AN) oDet = Math.max(oDet, g); if (alt) alt.grav = Math.max(alt.grav, g * (1 + K.GRAV_PLANET_CLUTTER * (K.PLANET_RADIUS / Math.max(K.PLANET_RADIUS, x.pd)) ** 2)); }
        const s = bandSNR(sig, sigma, o.tr.sens, d, o.radarOn && los);
        // ニュートリノ（惑星は遮らない）と赤外（見通しが要る）
        const h = Math.max(s.nu, los ? s.ir : 0); if (h > best.heat) { best.heat = h; bestD.heat = d; who.heat = o; } if (AN) oDet = Math.max(oDet, h);
        if (alt) { const s2 = los ? s : bandSNR(sig, sigma, o.tr.sens, d, o.radarOn); alt.rad = Math.max(alt.rad, s2.rad); alt.heat = Math.max(alt.heat, s2.nu, s2.ir); }
        if (!los) continue;
        if (s.rad > best.rad) { best.rad = s.rad; bestD.rad = d; who.rad = o; } oRad = Math.max(oRad, s.rad); oIr = Math.max(oIr, s.ir);
        // 目視（見通しと日照が要る）
        if (!dark) { const vr = visualRanges(tg.tr.maxDim, o.tr.sens.ir); if (d <= vr.see) { see = true; oSee = true; who.vis ??= o; bestD.vis = Math.min(bestD.vis, d); } if (d <= vr.id) { idVis = true; oIdVis = true; } }
        // 船籍表示（見通しと距離）
        if (d <= K.XPDR_RANGE) { xpdrCould = true; if (tg.xpdr) { xpdrHeard = true; bestD.xpdr = Math.min(bestD.xpdr, d); } }
        if (quietJudgeable(sigma, o.tr.sens, d)) quietOK = true;
      }
      if (AN && o.role) { if (Math.max(oDet, oRad) >= K.DET_SNR || oSee) (rs ||= {})[o.role] = true; if (oRad >= K.SENS.idRad || oIdVis) (ri ||= {})[o.role] = true; }
      const fix = Math.max(oRad, oIr, oSee ? K.FIX_SNR : 0); if (fix >= K.FIX_SNR) fixers.push([o, fix]); radImg = Math.max(radImg, oRad); irImg = Math.max(irImg, oIr);
    }
    if (alt) { const now = Math.max(best.rad, best.heat, best.grav) >= K.DET_SNR; if (now) fl.seen = true; else { if (Math.max(alt.rad, alt.heat, best.grav) >= K.DET_SNR) fl.occ = true; if (Math.max(best.rad, best.heat, alt.grav) >= K.DET_SNR) fl.clut = true; } if (best.rad < K.SENS.idRad && alt.rad >= K.SENS.idRad) fl.occId = true; }
    const m = {rad: measured(best.rad, R), heat: measured(best.heat, R), grav: measured(best.grav, R)};
    if (!c) { if (!(see || xpdrHeard || m.rad >= K.DET_SNR * K.OFF_RATIO || m.heat >= K.DET_SNR * K.OFF_RATIO || m.grav >= K.DET_SNR * K.OFF_RATIO)) continue; c = newContact(tg, t); side.contacts.set(tg.id, c); }
    if (AN) { if (rs) for (const k in rs) (c.roleSeen ||= {})[k] ??= t; if (ri) for (const k in ri) (c.roleImg ||= {})[k] ??= t; }
    c.now = t; const was = {...Object.fromEntries(Object.entries(c.hold).map(([k, h]) => [k, h.on])), xpdr: c.xpdr === 'shown'};
    holdStep(c.hold.rad, m.rad, K.DET_SNR); holdStep(c.hold.heat, m.heat, K.DET_SNR); holdStep(c.hold.grav, m.grav, K.DET_SNR); c.hold.vis.on = see;
    // 船籍表示：届けば即座に分かる。届くはずの所で一定時間受けられなければ「なし」。なぜ出していないか（敵・怪しい・忘れ）は分からない
    if (xpdrHeard) { c.xpdr = 'shown'; c.xpdrSince = null; } else if (xpdrCould && (c.hold.rad.on || c.hold.heat.on || c.hold.grav.on || see)) { c.xpdrSince ??= t; if (c.xpdr !== 'shown' && t - c.xpdrSince >= K.XPDR_WAIT) c.xpdr = 'none'; } else if (c.xpdr !== 'none') c.xpdrSince = null;
    for (const k of ['vis', 'rad', 'heat', 'grav']) if (c.hold[k].on && !was[k] && c.firstBy[k] == null) { c.firstBy[k] = {t, d: bestD[k]}; if (k === 'grav' && gravWake) c.wakeFirst = true; }
    if (c.xpdr === 'shown' && !was.xpdr && c.firstBy.xpdr == null) c.firstBy.xpdr = {t, d: bestD.xpdr};
    const anyOn = c.hold.vis.on || c.hold.rad.on || c.hold.heat.on || c.hold.grav.on || c.xpdr === 'shown';
    if (anyOn && !c.first) { const k = ['vis', 'rad', 'heat', 'grav', 'xpdr'].filter(k => c.firstBy[k]?.t === t); c.first = {t, means: k, d: Math.min(...k.map(x => c.firstBy[x].d)), finder: dMinObs ? (dMinObs.kind === 'flight' ? (dMinObs.home?.detached ? '分派した艦の偵察機' : '本隊の偵察機') : dMinObs.detached ? '分派した艦' : '本隊の艦') : null}; if (AN) { const o = who[k[0]] || dMinObs; c.first.role = o?.role || null; c.first.by = o ? (o.kind === 'flight' ? '偵察機' : '艦') : null; } }
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
      if (by) c.id = {t, by, d: dMin, kind: tg.kind === 'rock' ? 'rock' : tg.kind === 'flight' ? 'flight' : 'ship', typeKey: tg.key, civilType: tg.kind === 'ship' && K.CIVIL_TYPES.includes(tg.key), militarySide: tg.side === 1 - sideIx, hostile: false, finder: dMinObs ? (dMinObs.kind === 'flight' ? (dMinObs.home?.detached ? '分派した艦の偵察機' : '本隊の偵察機') : dMinObs.detached ? '分派した艦' : '本隊の艦') : null, name: tg.tr.name || '小惑星', homeD: Math.min(...obs.filter(o => o.kind === 'ship').map(o => len(sub(o.pos, tg.pos))))}; if (by && AN) { const o = who[by] || who.rad || dMinObs; c.id.role = o?.role || null; c.id.byWho = o ? (o.kind === 'flight' ? '偵察機' : '艦') : null; } }
    const st = anyOn || c.id ? classify(c) : (c.id ? ST.ID : ST.NONE);
    if (st !== c.stage) { c.stage = st; c.stageLog.push({t, stage: st}); if (st > c.maxStage) c.maxStage = st; }
    if (c.tracker) c.trackedTime += dt;
  }
  if (AN) { if (fl.occ) AN.occLost += dt; if (fl.occId) AN.occIdLost += dt; if (fl.clut) AN.clutLost += dt; if (fl.seen) AN.seen += dt; }
}
// 所属の判断を更新する（艦種が分かった接触について）。「軍艦と一緒に動いている」は、敵の軍艦と分かった別の接触の近くに居続けること
function judgeAllegiance(W, sideIx, t) {
  const side = W.sides[sideIx], all = [...side.contacts.values()], precise = c => c.est && (c.hold.rad.on || c.hold.vis.on || c.xpdr === 'shown');
  const warships = all.filter(m => m.id && m.id.kind === 'ship' && !m.id.civilType && m.id.militarySide && precise(m));
  for (const c of all) { if (c.id?.civilType || (!c.id && c.xpdr === 'shown')) { const near = precise(c) && warships.some(m => len(sub(m.est, c.est)) <= K.ESCORT_RADIUS); if (near) c.escortSince ??= t; else if (!(c.alleg === 'hostile')) c.escortSince = null; }
    const a = allegiance(c, t); if (a !== c.alleg) { c.alleg = a; (c.allegLog ||= []).push({t, a}); if (a === 'hostile' && c.hostileT == null) { c.hostileT = t; c.hostileWhy = c.lockMark ? 'ロックされた' : !c.id || c.id.civilType ? '軍艦と一緒に動いている' : '軍用の艦種'; } if (a === 'civil' && c.civilT == null) c.civilT = t; }
    if (c.id) c.id.hostile = a === 'hostile'; }
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
    if (!x.lockMark) { x.lockMark = {t, knewBefore: knew, d}; if (x.hostileT == null) { x.hostileT = t; x.hostileWhy = 'ロックされた'; x.alleg = 'hostile'; } x.firstBy.lock = {t, d}; if (!x.first) x.first = {t, means: ['lock'], d}; }
    if (!x.id) { x.id = {t, by: 'lock', d, kind: locker.kind === 'flight' ? 'flight' : 'ship', civilType: false, militarySide: true, hostile: true, name: 'ロック元', homeD: d}; x.stage = ST.ID; x.stageLog.push({t, stage: ST.ID}); } }
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
  if (W.anchor) for (const s of W.sides) s.log.anchor = {occLost: 0, occIdLost: 0, clutLost: 0, seen: 0};
  for (let t = 0, limit = W.limit ?? K.LIMIT; t <= limit; t += K.DT) { if (W.anchor) anchorStep(W, t); moveAll(W, t, K.DT); for (const s of [0, 1]) senseSide(W, s, t, K.DT); if (t % K.TRACK_EVERY < K.DT) for (const s of [0, 1]) { judgeAllegiance(W, s, t); allocateTracks(W, s, t); } }
  return summarize(W);
}
const firstStage = (c, st) => c.stageLog.find(x => x.stage === st)?.t ?? null;
function summarize(W) {
  const out = {scene: W.sceneKey, seed: W.seed, notes: W.notes, sides: []};
  for (const s of [0, 1]) { const side = W.sides[s], rows = [];
    for (const e of W.ents) { if (e.side === s) continue; const c = side.contacts.get(e.id);
      rows.push({...(W.anchor ? {role: e.role || null, roleSeen: c?.roleSeen || {}, roleImg: c?.roleImg || {}} : {}), id: e.id, truth: e.kind === 'rock' ? '小惑星' : e.kind === 'flight' ? `${s === e.side ? '' : '敵'}機の編隊 ${e.tr.name}×${e.n}` : e.side === 2 ? `${e.diplomat ? '中立の外交艦' : '商船'} ${e.tr.name}${e.xpdr ? '' : '（船籍表示なし：' + e.xpdrWhy + '）'}` : `敵艦 ${e.tr.name}`, kind: e.kind, hostile: e.side === 1 - s, civilTruth: e.kind === 'ship' && K.CIVIL_TYPES.includes(e.key), convoy: !!e.convoy, detached: e.detached || null, merchant: e.side === 2, noXpdr: e.side === 2 && !e.xpdr,
        first: c?.first || null, firstBy: c?.firstBy || {}, wakeFirst: !!c?.wakeFirst, tPowered: c ? firstStage(c, ST.POWERED) : null, tDebris: c ? firstStage(c, ST.DEBRIS) : null, tCivil: c ? firstStage(c, ST.CIVIL) : null, tSuspect: c ? firstStage(c, ST.SUSPECT) : null, id: c?.id || null, alleg: c?.alleg || null, hostileT: c?.hostileT ?? null, hostileWhy: c?.hostileWhy || null, civilT: c?.civilT ?? null, targetT: c?.targetT ?? null, targetPresumedT: c?.targetPresumedT ?? null, lockT: c?.lockT ?? null, lockMark: c?.lockMark || null, trackedTime: c?.trackedTime || 0, dropped: c?.droppedCount || 0, finalStage: c ? c.stage : 0}); }
    const foes = rows.filter(r => r.hostile && r.kind === 'ship'), min = xs => { const v = xs.filter(x => x != null); return v.length ? Math.min(...v) : null; };
    out.sides.push({rows, log: side.log,
      tBlip: min(foes.map(r => r.first?.t)), blipMeans: (() => { const r = foes.filter(r => r.first).sort((a, b) => a.first.t - b.first.t)[0]; return r ? {means: r.first.means, d: r.first.d, wake: r.wakeFirst && r.first.means.includes('grav')} : null; })(),
      tSuspect: min(foes.map(r => r.tSuspect)), tType: min(foes.map(r => r.id?.t)), tConfirm: min(foes.map(r => r.hostileT)), tLockMarkShip: min(foes.filter(r => r.lockMark).map(r => r.lockMark.t)), confirmBy: (() => { const r = foes.filter(r => r.hostileT != null && r.id).sort((a, b) => a.hostileT - b.hostileT)[0]; return r ? {by: r.id.by, d: r.id.d, homeD: r.id.homeD, finder: r.id.finder} : null; })(), blipFinder: foes.filter(r => r.first).sort((a, b) => a.first.t - b.first.t)[0]?.first.finder || null,
      // 分派した相手の艦と、相手の本隊を、それぞれいつ見つけたか（相手から見れば「分派した艦が先に見つかったか」）
      detSeen: min(foes.filter(r => r.detached).map(r => r.first?.t)), detId: min(foes.filter(r => r.detached).map(r => r.hostileT)), mainSeen: min(foes.filter(r => !r.detached).map(r => r.first?.t)), mainId: min(foes.filter(r => !r.detached).map(r => r.hostileT)), hasDet: foes.some(r => r.detached), tTarget: min(foes.map(r => r.targetT)), tTargetPresumed: min(foes.map(r => r.targetPresumedT)),
      foes: foes.length, foesSeen: foes.filter(r => r.first).length, foesTyped: foes.filter(r => r.id).length, foesConfirmed: foes.filter(r => r.hostileT != null).length,
      // 民間でも使われる艦種の敵艦：商船とみなした数、そのうち後で敵と確定した数と、それまでの時間、最後まで商船とみなしたままの数、不審のまま
      foesAsCivil: foes.filter(r => r.civilT != null).length, foesCivilResolved: foes.filter(r => r.civilT != null && r.hostileT != null).map(r => r.hostileT - r.civilT), foesCivilEnd: foes.filter(r => r.alleg === 'civil').length, foesSuspectEnd: foes.filter(r => r.alleg === 'suspect').length, merchHostile: rows.filter(r => r.merchant && r.hostileT != null).length, rocksHostile: rows.filter(r => r.kind === 'rock' && r.hostileT != null).length, foesAsDebris: foes.filter(r => r.tDebris != null && !r.id).length,
      tLock: min(foes.map(r => r.lockT)), lockMarks: rows.filter(r => r.lockMark).map(r => ({t: r.lockMark.t, knewBefore: r.lockMark.knewBefore, who: r.truth, d: r.lockMark.d})),
      tFlightSeen: min(rows.filter(r => r.hostile && r.kind === 'flight').map(r => r.first?.t)),
      rocksSeen: rows.filter(r => r.kind === 'rock' && r.first).length, rocksId: rows.filter(r => r.kind === 'rock' && r.id).length, rocksSuspect: rows.filter(r => r.kind === 'rock' && r.tSuspect != null).length,
      merchSeen: rows.filter(r => r.merchant && r.first).length, merchCivil: rows.filter(r => r.merchant && r.tCivil != null).length, merchSuspect: rows.filter(r => r.merchant && r.tSuspect != null).length, merchSuspectNoX: rows.filter(r => r.noXpdr && r.tSuspect != null).length, merchId: rows.filter(r => r.merchant && r.id).length}); }
  out.map = {ents: W.ents.filter(e => !e.offMap).map(e => ({id: e.id, kind: e.kind, side: e.side, xpdr: e.xpdr, n: e.n, path: e.path, end: [e.pos[0], e.pos[2]], name: e.tr.name}))};
  // 敵艦が識別された瞬間の位置（図に使う）
  out.map.confirms = out.sides[0].rows.filter(r => r.hostile && r.kind === 'ship' && r.hostileT != null).map(r => ({id: r.id, t: r.hostileT}));
  if (W.anchor) { out.limit = W.limit; out.anchor = anchorResult(W, out); }
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
  let md = `| 真の姿（${SIDE_NAME[s]}には見えない） | 初探知 | 手段 | 距離 | 動力あり | 浮遊物（推定） | 船籍あり | 不審 | 艦種が分かった（手段・距離） | 所属の判断（最後） | 商船とみなした | 敵と確定（理由） | 目標にできる | 追跡した時間 |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n`;
  const AL = {hostile: '敵', civil: '商船・非敵対とみなす', suspect: '不審（所属不明）', neutral: '中立', rock: '小惑星'};
  for (const x of rows) md += `| ${x.truth} | ${hm(x.first?.t)} | ${x.first ? meansJa(x.first.means) + (x.wakeFirst && x.first.means.includes('grav') ? '（航跡波）' : '') : '見つからず'} | ${km(x.first?.d)} | ${hm(x.tPowered)} | ${hm(x.tDebris)} | ${hm(x.tCivil)} | ${hm(x.tSuspect)} | ${x.id ? hm(x.id.t) + '（' + MEANS[x.id.by] + '、' + km(x.id.d) + '）' : '—'} | ${AL[x.alleg] || '—'} | ${hm(x.civilT)} | ${x.hostileT != null ? hm(x.hostileT) + '（' + x.hostileWhy + '）' : '—'} | ${x.hostile ? hm(x.targetT) : '—'} | ${Math.round(x.trackedTime / 60)} 分 |\n`;
  return md;
}
function sceneSummary(key, runs) {
  const sc = SCENES[key]; let md = `### ${sc.title}\n\n| 種 | 味方が敵艦を：初探知（手段・距離） | 不審と判断 | 敵と確定（艦種が分かった手段・距離） | 目標にできる | 敵が味方艦を：初探知（手段・距離） | 敵と確定 | 目標にできる | 先に確定した側（差） | 確定時の自艦隊からの距離：味方→敵／敵→味方 | 攻撃隊が届く時刻（確定＋飛行）：味方／敵 | 先に攻撃隊が届く側（差） |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n`;
  const strike = (S, type) => S.tConfirm == null ? null : S.tConfirm + S.confirmBy.homeD / reconRange(craftTraits(type)).speed;
  const lead = (a, b) => a == null && b == null ? 'どちらもなし' : b == null ? '味方（敵はなし）' : a == null ? '敵（味方はなし）' : a === b ? '同時' : a < b ? `味方（${Math.round((b - a) / 60)} 分）` : `敵（${Math.round((a - b) / 60)} 分）`;
  for (const r of runs) { const [A, B] = r.sides; md += `| ${r.seed} | ${hm(A.tBlip)}${A.blipMeans ? '（' + meansJa(A.blipMeans.means) + (A.blipMeans.wake ? '・航跡波' : '') + '、' + km(A.blipMeans.d) + '）' : ''} | ${hm(A.tSuspect)} | ${hm(A.tConfirm)}${A.confirmBy ? '（' + MEANS[A.confirmBy.by] + '、' + km(A.confirmBy.d) + '）' : ''} | ${hm(A.tTarget)} | ${hm(B.tBlip)}${B.blipMeans ? '（' + meansJa(B.blipMeans.means) + (B.blipMeans.wake ? '・航跡波' : '') + '、' + km(B.blipMeans.d) + '）' : ''} | ${hm(B.tConfirm)} | ${hm(B.tTarget)} | ${lead(A.tConfirm, B.tConfirm)} | ${km(A.confirmBy?.homeD)}／${km(B.confirmBy?.homeD)} | ${hm(strike(A, 'xwing'))}／${hm(strike(B, 'tie_ln'))} | ${lead(strike(A, 'xwing'), strike(B, 'tie_ln'))} |\n`; }
  md += `\n| 種 | 味方：敵艦の艦種が分かった／敵と確定／全数 | 敵艦を商船とみなした（うち後で敵と確定／最後まで商船扱い）・最後まで不審 | 商船・小惑星を敵とした（誤認） | 敵艦を浮遊物と誤判定 | 小惑星：映った／識別／不審扱い（誤認） | 商船：映った／船籍で商船／不審扱い（うち船籍表示なし）／艦種が分かった | 熱源の取り違え | 追跡枠：最大使用（まとまり＋ロック）／1 つずつ追った場合／持ち数／空きの最小 | 枠が足りなかった割合 | 偵察が光点へ向かった回数 | 敵：味方艦の艦種が分かった／敵と確定／全数 | 敵の追跡枠：最大使用／1 つずつ追った場合／持ち数 | ロック：味方が掛けた時刻／敵が掛けた時刻 | ロック元としてマークされた相手（時刻、それまで知っていたか） |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n`;
  const lm = (S, who) => S.lockMarks.map(x => `${who}が ${x.who} を ${hm(x.t)}（${x.knewBefore ? '既に映っていた' : '知らなかった'}）`).join('；');
  for (const r of runs) { const [A, B] = r.sides; md += `| ${r.seed} | ${A.foesTyped}／${A.foesConfirmed}／${A.foes} | ${A.foesAsCivil}（${A.foesCivilResolved.length}／${A.foesCivilEnd}）・${A.foesSuspectEnd} | 商船 ${A.merchHostile}、小惑星 ${A.rocksHostile} | ${A.foesAsDebris} | ${A.rocksSeen}／${A.rocksId}／${A.rocksSuspect} | ${A.merchSeen}／${A.merchCivil}／${A.merchSuspect}（${A.merchSuspectNoX}）／${A.merchId} | ${A.log.misassoc.length} | ${A.log.trackMax}／${A.log.indivMax}／${A.log.trackCap}／${A.log.freeMin} | ${Math.round(100 * A.log.shortSteps / Math.max(1, A.log.allocs))}% | ${A.log.diverts} | ${B.foesTyped}／${B.foesConfirmed}／${B.foes} | ${B.log.trackMax}／${B.log.indivMax}／${B.log.trackCap} | ${hm(A.tLock)}／${hm(B.tLock)} | ${[lm(A, '味方'), lm(B, '敵')].filter(Boolean).join('；') || '—'} |\n`; }
  if (runs.some(r => r.sides[1].hasDet)) { md += `\n| 種 | 味方の初探知をした側 | 味方の確定をした側 | 分派した艦：敵に映った／識別された | 本隊：敵に映った／識別された | 先に敵に見つかったのは |\n| --- | --- | --- | --- | --- | --- |\n`;
    for (const r of runs) { const [A, B] = r.sides, first = B.detSeen == null && B.mainSeen == null ? 'どちらも見つからず' : B.mainSeen == null || (B.detSeen != null && B.detSeen < B.mainSeen) ? '分派した艦' : '本隊'; md += `| ${r.seed} | ${A.blipFinder || '—'} | ${A.confirmBy?.finder || '—'} | ${hm(B.detSeen)}／${hm(B.detId)} | ${hm(B.mainSeen)}／${hm(B.mainId)} | ${first} |\n`; } }
  if (sc.layout === 'convoy') { const ps = 1 - sc.convoy.side; md += `\n見張り側（${SIDE_NAME[ps]}）から見た、列の艦の判断：\n\n| 種 | 民間でも使われる艦種の艦：艦種が分かった時刻（最初） | 商船・非敵対とみなした隻数 | 敵と確定した隻数（理由） | 商船とみなしてから敵と確定するまで | 最後まで商船扱い | 最後まで不審 | 護衛を敵と確定 | 本物の商船・外交艦を敵とした数 | 本物の商船・外交艦のうち不審扱い（うち船籍表示なし） |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n`;
    for (const r of runs) { const S = r.sides[ps], tr = S.rows.filter(x => x.convoy && x.civilTruth), esc = S.rows.filter(x => x.convoy && !x.civilTruth), ty = tr.filter(x => x.id).map(x => x.id.t), res = tr.filter(x => x.civilT != null && x.hostileT != null).map(x => x.hostileT - x.civilT);
      md += `| ${r.seed} | ${ty.length ? hm(Math.min(...ty)) : '—'} | ${tr.filter(x => x.civilT != null).length}/${tr.length} | ${tr.filter(x => x.hostileT != null).length}/${tr.length}${tr.some(x => x.hostileWhy) ? '（' + [...new Set(tr.map(x => x.hostileWhy).filter(Boolean))].join('、') + '）' : ''} | ${res.length ? Math.round(Math.min(...res) / 60) + '〜' + Math.round(Math.max(...res) / 60) + ' 分' : '—'} | ${tr.filter(x => x.alleg === 'civil').length} | ${tr.filter(x => x.alleg === 'suspect').length} | ${esc.length ? hm(Math.min(...esc.map(x => x.hostileT ?? Infinity))) : '護衛なし'} | ${S.merchHostile} | ${S.merchSuspect}（${S.merchSuspectNoX}） |\n`; } }
  if (sc.layout === 'anchor') md += anchorSceneMd(key, runs);
  const notes = [...new Set(runs.flatMap(r => r.notes))]; if (notes.length) md += `\n注：${notes.join('；')}\n`;
  return md + '\n';
}
function overallRow(key, runs) { const A = runs.map(r => r.sides[0]), B = runs.map(r => r.sides[1]), n = runs.length, cnt = f => runs.filter(f).length, sum = (xs, f) => xs.reduce((s, x) => s + f(x), 0);
  const firstA = cnt(r => r.sides[0].tConfirm != null && (r.sides[1].tConfirm == null || r.sides[0].tConfirm < r.sides[1].tConfirm)), firstB = cnt(r => r.sides[1].tConfirm != null && (r.sides[0].tConfirm == null || r.sides[1].tConfirm < r.sides[0].tConfirm));
  return `| ${SCENES[key].title} | ${n} | ${cnt(r => r.sides[0].tBlip != null)}/${n}、${hm(med(A.map(x => x.tBlip)))} | ${cnt(r => r.sides[0].tConfirm != null)}/${n}、${hm(med(A.map(x => x.tConfirm)))} | ${sum(A, x => x.foesTyped)}／${sum(A, x => x.foesConfirmed)}／${sum(A, x => x.foes)} | ${cnt(r => r.sides[1].tConfirm != null)}/${n}、${hm(med(B.map(x => x.tConfirm)))} | 味方 ${firstA}・敵 ${firstB}・なし ${n - firstA - firstB} | ${sum(A, x => x.foesAsDebris)} | 小惑星 ${sum(A, x => x.rocksSuspect)}、商船 ${sum(A, x => x.merchSuspect)}（うち船籍なし ${sum(A, x => x.merchSuspectNoX)}） | ${Math.max(...A.map(x => x.log.trackMax))}／${Math.max(...A.map(x => x.log.indivMax))}／${Math.max(...A.map(x => x.log.trackCap))} |\n`; }

// ---- 停泊の場面の集計と表 ----
function anchorResult(W, out) {
  const A = W.anchor, an = A.an, [SA, SB] = out.sides, min = xs => { const v = xs.filter(x => x != null); return v.length ? Math.min(...v) : null; };
  const firstOf = rows => rows.filter(r => r.first).sort((a, b) => a.first.t - b.first.t)[0], confOf = rows => rows.filter(r => r.hostileT != null).sort((a, b) => a.hostileT - b.hostileT)[0];
  const ev = r => r ? {t: r.first.t, means: r.first.means, wake: r.wakeFirst && r.first.means.includes('grav'), d: r.first.d, role: r.first.role ?? null, by: r.first.by ?? null} : null;
  const cf = r => r ? {t: r.hostileT, by: r.id?.by ?? null, d: r.id?.d ?? null, role: r.id?.role ?? null, byWho: r.id?.byWho ?? null, why: r.hostileWhy} : null;
  const pack = rows => ({first: ev(firstOf(rows)), confirm: cf(confOf(rows)), seenBy: Object.fromEntries(['fleet', 'scout', 'freighter', 'main', 'patrol'].map(k => [k, min(rows.map(r => r.roleSeen?.[k]))]).filter(x => x[1] != null)), imgBy: Object.fromEntries(['fleet', 'scout', 'freighter', 'main', 'patrol'].map(k => [k, min(rows.map(r => r.roleImg?.[k]))]).filter(x => x[1] != null))});
  const aRows = k => SA.rows.filter(r => r.role === k), bRows = k => SB.rows.filter(r => r.role === k), fr = bRows('freighter');
  const flag = W.ents.find(e => e.role === 'fleet'), dAt = t => { if (t == null || A.mode !== 'march' || !flag.path.length) return null; const p = flag.path[Math.min(flag.path.length - 1, Math.floor(t / 300))]; return Math.hypot(p[0], p[1]); };
  const disc = k => A.disc[k] ? {t: A.disc[k].t, id: A.disc[k].id, isMain: A.disc[k].isMain, precise: A.disc[k].precise} : null;
  const res = {mode: A.mode, intel: A.intel, quiet: A.quiet, rOrb: A.rOrb, fleetSpeed: flag.speed, prep: an.prep, callOn: an.callOn, launch: A.launch ? {t: A.launch.t, d: A.launch.d} : null, disc: {blip: disc('blip'), confirm: disc('confirm')}, call: A.call, arrive: A.arrive,
    main: pack(aRows('main')), patrol: pack(aRows('patrol')),
    emp: {fleet: pack(bRows('fleet')), scout: pack(bRows('scout')), freighter: {...pack(fr), n: fr.length, civil: fr.filter(r => r.civilT != null).length, civilT: min(fr.map(r => r.civilT)), suspect: fr.filter(r => r.tSuspect != null || r.alleg === 'suspect').length, suspectT: min(fr.map(r => r.tSuspect)), typed: fr.filter(r => r.id).length, hostile: fr.filter(r => r.hostileT != null).length, endCivil: fr.filter(r => r.alleg === 'civil').length, presumedT: min(fr.map(r => r.targetPresumedT))}},
    occ: {rebel: SA.log.anchor, empire: SB.log.anchor}};
  const e = res.emp, anyFirst = min([e.fleet.first?.t, e.scout.first?.t]), anyConf = min([e.fleet.confirm?.t, e.scout.confirm?.t, e.freighter.confirm?.t]);
  // 警報：ゆるい ＝ 偵察機か本隊の光点、または貨物船を不審・敵と判断。確か ＝ 反乱軍の何かを敵と確定
  const kinds = [['偵察機の光点', e.scout.first?.t], ['貨物船を不審', e.freighter.suspectT], ['現れた本隊の光点', e.fleet.first?.t], ['偵察機を敵と確定', e.scout.confirm?.t], ['貨物船を敵と確定', e.freighter.confirm?.t], ['本隊を敵と確定', e.fleet.confirm?.t]].filter(x => x[1] != null).sort((a, b) => a[1] - b[1]);
  const firm = kinds.filter(x => x[0].endsWith('確定'))[0] || null; res.alert = {loose: kinds[0] ? {t: kinds[0][1], why: kinds[0][0]} : null, firm: firm ? {t: firm[1], why: firm[0]} : null, all: Object.fromEntries(kinds)};
  res.fleetD = {empFirst: dAt(anyFirst), empConfirm: dAt(anyConf), mainFirst: dAt(res.main.first?.t), mainConfirm: dAt(res.main.confirm?.t)}; res.empAnyFirst = anyFirst; res.empAnyConfirm = anyConf;
  return res;
}
const ROLE_JA = {main: '主力', patrol: '哨戒', fleet: '本隊の艦', scout: '偵察機', freighter: '偽装貨物船'};
const evJa = (x, who) => x ? `${hm(x.t)}（${meansJa(x.means)}${x.wake ? '・航跡波' : ''}、${km(x.d)}${who ? '、' + (ROLE_JA[x.role] || x.by || '—') : ''}）` : '—';
const cfJa = x => x ? `${hm(x.t)}（${x.by ? MEANS[x.by] + '、' + km(x.d) : x.why}、${ROLE_JA[x.role] || x.byWho || '—'}）` : '—';
const mins = s => s == null ? '—' : (Math.round(s / 60) || 0) + ' 分';
const occJa = o => `${mins(o.occLost)}／${mins(o.occIdLost)}／${mins(o.clutLost)}`;
function anchorSceneMd(key, runs) {
  const jump = runs[0].anchor.mode === 'jump'; let md = '';
  if (!jump) { md += `\n停泊中の主力と哨戒（本隊が縁から進む形）：\n\n| 種 | 偵察機の発進（時刻、本隊の惑星の中心からの距離） | 反乱軍が主力を：初探知（手段、距離、見つけた側） | 低軌道の帯に動力のある光点 | 敵と確定（手段、距離、見つけた側） | そのとき本隊は惑星の中心から | 反乱軍が哨戒を：初探知／敵と確定 | 哨戒が反乱軍を：初めて映した（艦／偵察機） | 主力が反乱軍を：初めて映した（艦／偵察機） | 帝国が反乱軍を：初探知（相手は艦）／（相手は偵察機）／何かを敵と確定 | 帝国が最初に気づいた時、本隊は惑星の中心から（主力の軌道まであと） | 反乱軍が主力を見るとき：掩蔽がなければ映っていた／像が取れていた／重力波の乱れがなければ映っていた時間 | 帝国が反乱軍の艦を見るとき：同 |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n`;
    for (const r of runs) { const a = r.anchor, e = a.emp, eta = d => d == null ? '' : `（あと ${((d - a.rOrb) / a.fleetSpeed / 3600).toFixed(1)} 時間）`;
      md += `| ${r.seed} | ${a.launch ? hm(a.launch.t) + '、' + km(a.launch.d) : '開始時'} | ${evJa(a.main.first, true)} | ${a.disc.blip ? hm(a.disc.blip.t) + (a.disc.blip.isMain ? '' : '（主力ではない）') : '—'} | ${cfJa(a.main.confirm)} | ${km(a.fleetD.mainConfirm)} | ${evJa(a.patrol.first, true)}／${cfJa(a.patrol.confirm)} | ${hm(e.fleet.seenBy.patrol)}／${hm(e.scout.seenBy.patrol)} | ${hm(e.fleet.seenBy.main)}／${hm(e.scout.seenBy.main)} | ${evJa(e.fleet.first, true)}／${evJa(e.scout.first, true)}／${hm(a.empAnyConfirm)} | ${a.empAnyFirst == null ? '—' : km(a.fleetD.empFirst) + eta(a.fleetD.empFirst)} | ${occJa(a.occ.rebel)} | ${occJa(a.occ.empire)} |\n`; } }
  else { md += `\n停泊中の主力と哨戒（本隊は別の星系で待ち、見つけたら呼ぶ形）：\n\n| 種 | 反乱軍が主力を：初探知（手段、距離、見つけた側） | 基準 1：低軌道の帯に動力のある光点 | 基準 2：敵と確定（手段、距離、見つけた側） | 本隊を呼んだ | 本隊が現れた（いちばん近い主力の艦まで） | 現れた本隊が自分のセンサーで：映した／像が取れた（現れてから） | 帝国が偵察機を：初探知（手段、距離、見つけた側）／敵と確定 | 帝国が偽装貨物船を：初探知／商船とみなした隻数／不審とした隻数（最初の時刻）／敵と確定した隻数 | 帝国が現れた本隊を：初探知／敵と確定 | 警報から本隊が現れるまで：ゆるい警報（きっかけ）／確かな警報（きっかけ） | 準備 ${runs[0].anchor.prep / 60} 分に間に合ったか：ゆるい／確か | 発見（呼ぶ基準）より前に：偵察機を敵と確定された／貨物船を不審・敵とされた | 哨戒が映した：偵察機／貨物船 | 反乱軍が主力を見るとき：掩蔽がなければ映っていた／像が取れていた／重力波の乱れがなければ映っていた時間 |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n`;
    for (const r of runs) { const a = r.anchor, e = a.emp, at = a.arrive?.t, own = t => t == null || at == null ? '—' : Math.max(0, Math.round(t - at)) + ' 秒', lead = x => x == null ? '警報なし' : at == null ? `${hm(x.t)}（${x.why}）・本隊は現れず` : (at - x.t < 0 ? `0 分（本隊が現れた後に気づいた：${x.why}、${hm(x.t)}）` : `${mins(at - x.t)}（${x.why}、${hm(x.t)}）`), ok = x => at == null ? '—' : x == null ? '警報なし' : at - x.t >= a.prep ? '間に合う' : '間に合わない', dt = a.disc[a.callOn]?.t ?? Infinity, before = t => t != null && t < dt ? 'あり（' + hm(t) + '）' : 'なし';
      md += `| ${r.seed} | ${evJa(a.main.first, true)} | ${a.disc.blip ? hm(a.disc.blip.t) + (a.disc.blip.isMain ? '' : '（主力ではない）') : '—'} | ${cfJa(a.main.confirm)} | ${hm(a.call?.t)} | ${at == null ? '—' : hm(at) + '（' + km(a.arrive.nearest) + '）'} | ${own(a.main.seenBy.fleet)}／${own(a.main.imgBy.fleet)} | ${evJa(e.scout.first, true)}／${cfJa(e.scout.confirm)} | ${evJa(e.freighter.first, true)}／${e.freighter.civil}/${e.freighter.n}／${e.freighter.suspect}/${e.freighter.n}（${hm(e.freighter.suspectT)}）／${e.freighter.hostile}/${e.freighter.n} | ${evJa(e.fleet.first, true)}／${cfJa(e.fleet.confirm)} | ${lead(a.alert.loose)}／${lead(a.alert.firm)} | ${ok(a.alert.loose)}／${ok(a.alert.firm)} | ${before(e.scout.confirm?.t)}／${before(min2(e.freighter.suspectT, e.freighter.confirm?.t))} | ${hm(e.scout.seenBy.patrol)}／${hm(e.freighter.seenBy.patrol)} | ${occJa(a.occ.rebel)} |\n`; } }
  return md;
}
const min2 = (a, b) => a == null ? b ?? null : b == null ? a : Math.min(a, b);
function anchorOverallMd(keys, allRuns) {
  const cntMed = (xs, n) => `${xs.filter(x => x != null).length}/${n}、${hm(med(xs))}`, medKm = xs => km(med(xs)), tally = xs => { const m = {}; for (const x of xs) if (x) m[x] = (m[x] || 0) + 1; return Object.entries(m).map(([k, v]) => `${k} ${v}`).join('・') || '—'; };
  const march = keys.filter(k => allRuns[k][0].anchor.mode === 'march'), jump = keys.filter(k => allRuns[k][0].anchor.mode === 'jump'); let md = '';
  if (march.length) { md += `\n### 停泊中の主力と哨戒：本隊が縁から進む形\n\n時刻は中央値（起きた回だけ）。「帯」は低軌道の帯（主力の軌道の半径 ± ${K.ANCHOR.band / KM} km）。\n\n| 場面 | 反乱軍が主力を初探知（回数、時刻） | 初探知の距離／見つけた側 | 主力を敵と確定（回数、時刻） | 確定の距離／見つけた側 | 確定時、本隊は惑星の中心から | 反乱軍が哨戒を初探知／敵と確定 | 哨戒が反乱軍を映した：艦／偵察機 | 主力が反乱軍を映した：艦／偵察機 | 帝国が反乱軍の何かを敵と確定 | 帝国が最初に気づいた時の本隊の位置（惑星の中心から） | 反乱軍が哨戒を先に見つけた | 哨戒に映らずに主力を確定 | 帝国のだれにも映らずに主力を確定 | 掩蔽が主力の探知を妨げた回（時間の中央値）／像を妨げた回 | 重力波の乱れが妨げた回（時間の中央値） |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n`;
    for (const k of march) { const rs = allRuns[k].map(r => r.anchor), n = rs.length, pSeen = a => min2(a.emp.fleet.seenBy.patrol ?? null, a.emp.scout.seenBy.patrol ?? null), eSeen = a => min2(min2(a.emp.fleet.seenBy.patrol ?? null, a.emp.scout.seenBy.patrol ?? null), min2(a.emp.fleet.seenBy.main ?? null, a.emp.scout.seenBy.main ?? null)), c = f => rs.filter(f).length;
      md += `| ${SCENES[k].title} | ${cntMed(rs.map(a => a.main.first?.t), n)} | ${medKm(rs.map(a => a.main.first?.d))}／${tally(rs.map(a => a.main.first && (ROLE_JA[a.main.first.role] || a.main.first.by)))} | ${cntMed(rs.map(a => a.main.confirm?.t), n)} | ${medKm(rs.map(a => a.main.confirm?.d))}／${tally(rs.map(a => a.main.confirm && (ROLE_JA[a.main.confirm.role] || a.main.confirm.byWho)))} | ${medKm(rs.map(a => a.fleetD.mainConfirm))} | ${cntMed(rs.map(a => a.patrol.first?.t), n)}／${cntMed(rs.map(a => a.patrol.confirm?.t), n)} | ${cntMed(rs.map(a => a.emp.fleet.seenBy.patrol), n)}／${cntMed(rs.map(a => a.emp.scout.seenBy.patrol), n)} | ${cntMed(rs.map(a => a.emp.fleet.seenBy.main), n)}／${cntMed(rs.map(a => a.emp.scout.seenBy.main), n)} | ${cntMed(rs.map(a => a.empAnyConfirm), n)} | ${medKm(rs.map(a => a.fleetD.empFirst))} | ${c(a => a.patrol.first && (pSeen(a) == null || a.patrol.first.t < pSeen(a)))}/${n} | ${c(a => a.main.confirm && (pSeen(a) == null || pSeen(a) > a.main.confirm.t))}/${n} | ${c(a => a.main.confirm && (eSeen(a) == null || eSeen(a) > a.main.confirm.t))}/${n} | ${c(a => a.occ.rebel.occLost > 0)}/${n}（${mins(med(rs.map(a => a.occ.rebel.occLost || null)))}）／${c(a => a.occ.rebel.occIdLost > 0)}/${n} | ${c(a => a.occ.rebel.clutLost > 0)}/${n}（${mins(med(rs.map(a => a.occ.rebel.clutLost || null)))}） |\n`; } }
  if (jump.length) { const prep = allRuns[jump[0]][0].anchor.prep; md += `\n### 停泊中の主力と哨戒：本隊は別の星系で待ち、見つけたら呼ぶ形\n\n時刻は中央値（起きた回だけ）。基準 1 ＝ 低軌道の帯に動力のある光点、基準 2 ＝ 低軌道の帯にいる艦を敵と確定。ゆるい警報 ＝ 帝国が偵察機か本隊を光点として映した、または貨物船を不審・敵と判断。確かな警報 ＝ 帝国が反乱軍の何かを敵と確定。準備の時間の仮の値は ${prep / 60} 分 ★。\n\n| 場面 | 反乱軍が主力を初探知（回数、時刻）／見つけた側 | 基準 1（回数、時刻。うち主力でなかった回） | 基準 2（回数、時刻）／見つけた側 | 本隊が現れた（回数、時刻） | 現れた時、いちばん近い主力の艦まで | 現れた本隊が自分で映す／像が取れるまで | 帝国が偵察機を初探知／敵と確定（回数、時刻） | 偽装貨物船（全 回 の合計）：商船とみなされた／不審とされた／敵と確定された／全数 | ゆるい警報（回数、きっかけ） | ゆるい警報から本隊が現れるまで（中央値、最小〜最大） | 準備に間に合った：ゆるい／確か（本隊が現れた回のうち） | 確かな警報から本隊が現れるまで（中央値） | 発見より前に：偵察機を敵と確定された／貨物船を不審・敵とされた | 哨戒が映した：偵察機／貨物船 | 掩蔽が主力の探知を妨げた回／像を妨げた回／重力波の乱れが妨げた回 |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n`;
    for (const k of jump) { const rs = allRuns[k].map(r => r.anchor), n = rs.length, c = f => rs.filter(f).length, arr = rs.filter(a => a.arrive), lead = (a, x) => a.arrive && x ? Math.max(0, a.arrive.t - x.t) : null, ll = rs.map(a => lead(a, a.alert.loose)).filter(x => x != null), lf = rs.map(a => lead(a, a.alert.firm)).filter(x => x != null), own = f => { const v = arr.map(a => f(a) == null ? null : Math.max(0, f(a) - a.arrive.t)); return med(v) == null ? '—' : Math.round(med(v)) + ' 秒'; }, sum = f => rs.reduce((s, a) => s + f(a), 0), dT = a => a.disc[a.callOn]?.t ?? Infinity;
      md += `| ${SCENES[k].title} | ${cntMed(rs.map(a => a.main.first?.t), n)}／${tally(rs.map(a => a.main.first && (ROLE_JA[a.main.first.role] || a.main.first.by)))} | ${cntMed(rs.map(a => a.disc.blip?.t), n)}（${c(a => a.disc.blip && !a.disc.blip.isMain)}） | ${cntMed(rs.map(a => a.disc.confirm?.t), n)}／${tally(rs.map(a => a.main.confirm && (ROLE_JA[a.main.confirm.role] || a.main.confirm.byWho)))} | ${cntMed(rs.map(a => a.arrive?.t), n)} | ${medKm(rs.map(a => a.arrive?.nearest))} | ${own(a => a.main.seenBy.fleet)}／${own(a => a.main.imgBy.fleet)} | ${cntMed(rs.map(a => a.emp.scout.first?.t), n)}／${cntMed(rs.map(a => a.emp.scout.confirm?.t), n)} | ${sum(a => a.emp.freighter.civil)}／${sum(a => a.emp.freighter.suspect)}／${sum(a => a.emp.freighter.hostile)}／${sum(a => a.emp.freighter.n)} | ${c(a => a.alert.loose)}/${n}、${tally(rs.map(a => a.alert.loose?.why))} | ${ll.length ? mins(med(ll)) + '（' + mins(Math.min(...ll)) + '〜' + mins(Math.max(...ll)) + '）' : '—'} | ${arr.filter(a => a.alert.loose && a.arrive.t - a.alert.loose.t >= prep).length}/${arr.length}／${arr.filter(a => a.alert.firm && a.arrive.t - a.alert.firm.t >= prep).length}/${arr.length} | ${lf.length ? mins(med(lf)) : '—'} | ${c(a => a.emp.scout.confirm && a.emp.scout.confirm.t < dT(a))}/${n}／${c(a => { const t = min2(a.emp.freighter.suspectT, a.emp.freighter.confirm?.t ?? null); return t != null && t < dT(a); })}/${n} | ${c(a => a.emp.scout.seenBy.patrol != null)}/${n}／${c(a => a.emp.freighter.seenBy.patrol != null)}/${n} | ${c(a => a.occ.rebel.occLost > 0)}/${n}／${c(a => a.occ.rebel.occIdLost > 0)}/${n}／${c(a => a.occ.rebel.clutLost > 0)}/${n} |\n`; } }
  // 手段ごとの映る距離（この場面に出る組み合わせ）
  const ob = [shipTraits('mc80liberty'), shipTraits('gr75'), craftTraits('xwing'), craftTraits('awing'), shipTraits('imperial'), shipTraits('arquitens'), shipTraits('dreadnaught')];
  const tg = [['ISD', shipTraits('imperial'), 'normal', 1], ['ISD（低放射）', shipTraits('imperial'), 'low', 1], ['アークワイテンス', shipTraits('arquitens'), 'normal', 1], ['ドレッドノート', shipTraits('dreadnaught'), 'normal', 1], ['MC80', shipTraits('mc80liberty'), 'normal', 1], ['GR-75', shipTraits('gr75'), 'normal', 1], ['X ウイング 4 機', craftTraits('xwing'), 'normal', 4], ['A ウイング 4 機', craftTraits('awing'), 'normal', 4]];
  md += `\n停泊の場面に出る組み合わせの映る距離（雑音なし、しきい値 SNR 1。重力波は惑星の乱れなし）：\n\n${rangesMd(ob, tg)}`;
  return md;
}
function traitsMd(keys, craftTypes) {
  let md = `| 艦・機体 | 全長×幅×高さ m | 反射断面積 m² | 反応炉出力 W | 排熱（出力×${K.WASTE_SHARE}）W | ニュートリノ：赤外の割合 | 質量 kg | 重力波の源 N（等速） | センサー開口 ν／赤外／レーダー | 同時交戦数（性能表） | 同時追跡数 | 最高速度 m/s |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n`;
  const row = tr => `| ${tr.name}${tr.craft ? '（航空機）' : ''} | ${Math.round(tr.len)}×${Math.round(tr.width)}×${Math.round(tr.height)} | ${tr.sigma.toLocaleString('en-US')} | ${tr.reactorW.toExponential(2)} | ${tr.wasteW.toExponential(2)} | ${tr.bandNu.toFixed(2)}：${tr.bandIr.toFixed(2)} | ${tr.massKg.toExponential(2)} | ${gravSource(tr, 0).toExponential(2)} | ${tr.sens.nu}／${tr.sens.ir}／${tr.sens.rad} | ${tr.engage} | ${trackSlots(tr.engage)} | ${Math.round(tr.maxSpeed)} |\n`;
  for (const k of keys) md += row(shipTraits(k)); for (const t of craftTypes) md += row(craftTraits(t));
  return md;
}
// 偵察機の届く距離（★ の見積もりの根拠つき）と、編隊の組み方ごとの捜索できる面積
function reconMd(craftTypes) {
  let md = `航続の見積もり ★：滞空 ＝ 燃料のエネルギー（p.fuel.capacityJ）÷（反応炉出力 p.grid.P × ${K.RECON_LOAD}）、巡航 ＝ 最高速度 × ${K.CRUISE}、航続 ＝ 巡航 × 滞空、届く距離（行き）＝ 航続 × ${K.RECON_OUT_SHARE}。\n\n| 機体 | 燃料 J | 反応炉出力 W | 最高速度 m/s | 巡航 m/s | 滞空 | 航続 km | 届く距離 km | 積んでいる艦（機数） |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n`;
  const kmn = x => Math.round(x / KM).toLocaleString('en-US');
  for (const t of craftTypes) { const tr = craftTraits(t), rr = reconRange(tr), stock = [...new Set([...REBEL, ...EMPIRE])].map(k => [shipTraits(k), (shipTraits(k).air || []).find(a => a.type === t)]).filter(x => x[1]).map(x => `${x[0].name} ${x[1].count}`).join('、'); md += `| ${tr.name} | ${tr.fuelJ.toExponential(2)} | ${tr.reactorW.toExponential(2)} | ${Math.round(tr.maxSpeed)} | ${Math.round(rr.speed)} | ${hm(rr.endurance)} | ${kmn(rr.range)} | ${kmn(rr.reach)} | ${stock || '—'} |\n`; }
  md += `\nマップの半径は ${kmn(K.MAP_RADIUS)} km、上下 ${kmn(K.MAP_HALF_HEIGHT)} km。積んでいても Core.FLEET_AIR.roles に無い機種（U ウイング、ラムダ級など）は性能表を作れないので候補に入れていない。\n\n`;
  // 捜索できる面積：行きの 1 本の帯（長さ ＝ 捜索する距離、幅 ＝ 横一列の幅 ＋ 両側の映る距離）× 編隊の数。帰りは同じ線をなぞるので数えない
  const solve = f => { let lo = 1, hi = 1e9; if (!(f(lo) >= 1)) return 0; for (let i = 0; i < 60; i++) { const mid = Math.sqrt(lo * hi); if (f(mid) >= 1) lo = mid; else hi = mid; } return lo; };
  const obs = craftTraits(craftTypes.includes('xwing') ? 'xwing' : craftTypes[0]), det = (tr, emcon) => { const sig = emission(tr, emcon, 1); return solve(r => { const q = bandSNR(sig, tr.sigma, obs.sens, r, true); return Math.max(q.rad, q.nu, q.ir); }); };
  const tg = [['ISD', det(shipTraits('imperial'), 'normal')], ['CR90', det(shipTraits('cr90'), 'normal')], ['ゴザンティ（低放射）', det(shipTraits('gozanti'), 'low')]], mapArea = Math.PI * K.MAP_RADIUS ** 2;
  md += `捜索できる面積（${obs.name} が偵察する場合。同じ高さの面で数えた目安。帯の幅 ＝ 横一列の幅（間隔 ${kmn(K.RECON_SPACING)} km）＋ 両側の映る距離。映る距離：${tg.map(x => x[0] + ' ' + kmn(x[1]) + ' km').join('、')}）：\n\n| 編隊 | 捜索する距離 km | 扇の広さ | 目標 | 帯の幅 km | 全編隊の帯の面積 万 km² | 扇の面積に対して | マップの円の面積に対して |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n`;
  for (const [nf, sz, fan, dist] of [[6, 4, 120, 15000 * KM], [2, 12, 120, 15000 * KM], [12, 2, 120, 15000 * KM], [6, 4, 60, 12000 * KM], [2, 12, 60, 12000 * KM], [12, 2, 60, 12000 * KM]]) for (const [name, r] of tg) { const d = Math.min(dist, reconRange(obs).reach), w = (sz - 1) * K.RECON_SPACING + 2 * r, area = nf * d * w, sector = Math.PI * d * d * (2 * fan / 360);
    md += `| ${sz} 機 × ${nf} | ${kmn(d)} | 左右 ${fan}° | ${name} | ${kmn(w)} | ${(area / 1e6 / 1e4).toFixed(0)} | ${Math.min(100, 100 * area / sector).toFixed(0)}% | ${(100 * area / mapArea).toFixed(1)}% |\n`; }
  return md;
}
// 分派に使えるかの表（作例の小型艦）
function detachMd() { const fleetCruise = Math.min(...REBEL.map(k => shipTraits(k).maxSpeed)) * K.FLEET_SPEED_SHARE, search = 15000 * KM, keys = Object.keys(F.designs).filter(k => F.designs[k].p.len <= K.SMALL_SHIP_LEN);
  let md = `本隊の巡航 ${Math.round(fleetCruise)} m/s（一番遅い艦の最高速度 × ${K.FLEET_SPEED_SHARE}）、捜索する距離 ${search / KM} km で判定。小型艦は全長 ${K.SMALL_SHIP_LEN} m 以下 ★。航続は偵察機と同じ見積もり ★。\n\n| 艦 | 全長 m | 巡航 m/s | 航続 km ★ | レーダー開口 | 性能表の搭載機（うち性能表を作れる機種） | 格納庫（info.hangarCap）| 発進能力（p.launch）| (2) 航空機を運用して分派 | (3) 速い艦として偵察 |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n`;
  for (const k of keys) { const tr = shipTraits(k), r = detachRoles(tr, fleetCruise, search), all = (F.designs[k].air || []).reduce((n, a) => n + (a.count || 0), 0); md += `| ${tr.name} | ${Math.round(tr.len)} | ${Math.round(r.fast.cruise)} | ${Math.round(r.fast.range / KM).toLocaleString('en-US')} | ${tr.sens.rad} | ${all}（${r.carrier.craft}） | ${r.carrier.hangar} | ${r.carrier.launch.toFixed(2)} | ${r.carrier.ok ? '使える' : '使えない：' + r.carrier.why} | ${r.fast.ok ? '使える' : '使えない：' + r.fast.why} |\n`; }
  return md; }
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
  s += `<circle cx="${X(0)}" cy="${g(Y(0))}" r="${pr * sc}" fill="#d0d0d0" stroke="#9c9c9c"/><text x="${X(0) - pr * sc - 8}" y="${g(Y(0)) + 4}" text-anchor="end" font-size="13" fill="${ink}">惑星（半径 ${Math.round(pr / KM).toLocaleString('en-US')} km）</text><text x="${X(0)}" y="${g(Y(-pr - 14000 * KM))}" text-anchor="middle" font-size="12" fill="${ink2}">惑星の影（目視できない）</text>`;
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
  for (const line of [`味方が敵艦を：`, `　初探知 ${hm(A0.tBlip)}`, `　敵と確定 ${hm(A0.tConfirm)}（${A0.foesConfirmed}/${A0.foes} 隻）`, `敵が味方艦を：`, `　初探知 ${hm(B0.tBlip)}`, `　敵と確定 ${hm(B0.tConfirm)}（${B0.foesConfirmed}/${B0.foes} 隻）`, `（時刻は 時:分:秒、計算は ${(r.limit ?? K.LIMIT) / 3600} 時間）`]) { s += `<text x="${lx}" y="${ly}" font-size="13" fill="${line.startsWith('　') || line.startsWith('（') ? ink2 : ink}">${line}</text>`; ly += 20; }
  const bar = 10000 * KM * sc; s += `<line x1="30" y1="${S + 12}" x2="${30 + bar}" y2="${S + 12}" stroke="${ink}" stroke-width="2"/><text x="${36 + bar}" y="${S + 17}" font-size="13" fill="${ink2}">10,000 km（上から見た図。高さの違いは描いていない。位置は計算の終わり、線は通った跡）</text>`;
  return {svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${Wd}" height="${S + 40}" font-family="'Noto Sans CJK JP','Noto Sans JP',sans-serif">${s}</svg>`, w: Wd, h: S + 40};
}

(async () => {
  const keys = SCENE_ARG === 'all' ? Object.keys(SCENES) : SCENE_ARG.split(','); for (const k of keys) if (!SCENES[k]) { console.error('場面がない: ' + k + '（' + Object.keys(SCENES).join(' | ') + '）'); process.exit(2); }
  fs.mkdirSync(OUT, {recursive: true}); const t00 = Date.now(), figs = [], allRuns = {};
  let summary = `# 索敵の検証：結果（scripts/sim-sensing-trial.cjs の出力）\n\n場面 ${keys.join(', ')}、各 ${RUNS} 回（種 1〜${RUNS}）。時刻は 時:分:秒。1 回の計算は ${K.LIMIT / 3600} 時間、刻み ${K.DT} 秒。\n\n`, overall = `| 場面 | 回数 | 味方が敵艦を初探知（回数、時刻の中央値） | 味方が敵と確定（回数、中央値） | 艦種が分かった／敵と確定／全数（合計） | 敵が味方を確定（回数、中央値） | 先に確定した側 | 敵艦を浮遊物と誤判定（合計） | 不審扱い（＝推定で敵とするなら誤認）合計 | 味方の追跡枠：最大使用／1 つずつ追った場合／持ち数 |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n`, detail = '';
  if (PAR > 1 && !WORKER) { const chunks = Array.from({length: Math.min(PAR, keys.length)}, () => []); keys.forEach((k, i) => chunks[i % chunks.length].push(k));
    await Promise.all(chunks.map(ch => new Promise((res, rej) => { const p = require('node:child_process').spawn(process.execPath, [__filename, OUT, ch.join(','), String(RUNS)], {env: {...process.env, KS_WORKER: '1', KS_PAR: '1'}, stdio: ['ignore', 'ignore', 'inherit']}); p.on('exit', c => c ? rej(new Error('子プロセスが失敗: ' + ch.join(','))) : res()); }))); }
  for (const key of keys) { const dir = path.join(OUT, key), cache = path.join(dir, 'runs.v8'), t0 = Date.now(); fs.mkdirSync(dir, {recursive: true}); let runs = [];
    if (PAR > 1 && !WORKER) { runs = v8.deserialize(fs.readFileSync(cache)); fs.unlinkSync(cache); } else for (let s = 1; s <= RUNS; s++) runs.push(run(key, s));
    if (WORKER) { fs.writeFileSync(cache, v8.serialize(runs)); continue; }
    for (const r of runs) fs.writeFileSync(path.join(dir, `run-${r.seed}.json`), JSON.stringify({scene: r.scene, seed: r.seed, notes: r.notes, sides: r.sides, ...(r.anchor ? {limit: r.limit, anchor: r.anchor} : {})}, null, 1));
    fs.writeFileSync(path.join(dir, 'timeline-seed1.md'), `# ${SCENES[key].title}：接触ごとの時系列（種 1）\n\n時刻は 時:分:秒。「真の姿」は検証の答え合わせ用で、その陣営には見えていない。\n\n## ${SIDE_NAME[0]}から見た接触\n\n${timelineMd(runs[0], 0)}\n## ${SIDE_NAME[1]}から見た接触\n\n${timelineMd(runs[0], 1)}`);
    overall += overallRow(key, runs); detail += sceneSummary(key, runs); figs.push([key, runs[0]]); allRuns[key] = runs.map(r => ({seed: r.seed, anchor: r.anchor}));
    console.log(`${key}: ${RUNS} 回、${((Date.now() - t0) / 1000).toFixed(1)} 秒`); }
  if (WORKER) return;
  const anchorKeys = keys.filter(k => SCENES[k].layout === 'anchor');
  const usedShips = [...new Set([...REBEL, ...EMPIRE, ...SMALL, ...MERCHANT_KEYS, ...(anchorKeys.length ? K.ANCHOR.patrolGroup : [])])], usedCraft = [...reconTypesOf(REBEL), ...reconTypesOf(EMPIRE)];
  const obsList = [shipTraits('mc80liberty'), shipTraits('imperial'), shipTraits('cr90'), craftTraits('xwing'), craftTraits('tie_in')];
  const tgts = [['ISD', shipTraits('imperial'), 'normal', 1], ['MC80', shipTraits('mc80liberty'), 'normal', 1], ['ネビュロンB', shipTraits('nebulonb'), 'normal', 1], ['CR90', shipTraits('cr90'), 'normal', 1], ['CR90（低放射）', shipTraits('cr90'), 'low', 1], ['ゴザンティ（低放射）', shipTraits('gozanti'), 'low', 1], ['ルクレハルク級貨物船', shipTraits('lh3210'), 'normal', 1], ['GR-75', shipTraits('gr75'), 'normal', 1], ['小惑星 100 m', rockTraits(100), 'normal', 1], ['小惑星 400 m', rockTraits(400), 'normal', 1], ...usedCraft.slice(0, 1).map(t => [craftTraits(t).name + ' 4 機', craftTraits(t), 'normal', 4])];
  const planetM = K.PLANET_G * K.PLANET_RADIUS ** 2 / 6.674e-11, mc = shipTraits('mc80liberty');
  const planetMd = `惑星（半径 ${K.PLANET_RADIUS / KM} km）を、縁から入った MC80（惑星の中心から ${K.PLACE.friendStart / KM} km）が見たとき：レーダーの SNR ${bandSNR({nu: 0, ir: 0, em: 0}, Math.PI * K.PLANET_RADIUS ** 2, mc.sens, K.PLACE.friendStart - K.PLANET_RADIUS, true).rad.toExponential(2)}（しきい値 1）、重力波の歪みの値 ${gravSNR(planetM * K.PLANET_G, mc.sens.nu, K.PLACE.friendStart, 1, 1e12).toExponential(2)}（同じ単位で、ISD が 2,000 km にいるときが約 ${gravSNR(gravSource(shipTraits('imperial'), 0), mc.sens.nu, 2000 * KM, 1, 1e12).toFixed(2)}）。`;
  if (anchorKeys.length) overall += anchorOverallMd(anchorKeys, allRuns);
  summary += `## 全体\n\n${overall}\n## 場面ごと\n\n${detail}## 使った特性（性能表から）\n\n${traitsMd(usedShips, usedCraft)}\n## 偵察機の届く距離と捜索できる面積\n\n${reconMd(usedCraft)}\n## 分派に使える小型艦（特性で判定）\n\n${detachMd()}\n## 手段ごとの映る距離（雑音なし、しきい値 SNR 1）\n\n${rangesMd(obsList, tgts)}\n${planetMd}\n\n## 定数（★ はこちらで選んだ値）\n\n\`\`\`json\n${JSON.stringify({...K, SENS: '(Core.SENS)', EMIT: '(Core.EMIT)', EMCON: '(Core.EMCON)'}, null, 1)}\n\`\`\`\n`;
  fs.writeFileSync(path.join(OUT, 'summary.md'), summary);
  if (process.env.KS_NOFIG !== '1') { const {chromium} = require('playwright'), br = await chromium.launch({args: ['--no-sandbox']});
    for (const [key, r] of figs) { const m = mapSvg(r, `${SCENES[key].title}（種 1）`), pg = await br.newPage({viewport: {width: m.w, height: m.h}, deviceScaleFactor: 1}); await pg.setContent(`<html><body style="margin:0;background:#fff">${m.svg}</body></html>`); await pg.screenshot({path: path.join(OUT, `map-${key}.png`)}); await pg.close(); }
    await br.close(); }
  console.log(`出力: ${OUT}（summary.md、<場面>/run-<種>.json、<場面>/timeline-seed1.md${process.env.KS_NOFIG === '1' ? '' : '、map-<場面>.png'}）、全体 ${((Date.now() - t00) / 1000).toFixed(1)} 秒`);
})();
