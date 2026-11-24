# 砲の新規則（2026-11-24）に伴うテスト期待値の変更記録

対象：ユーザー決定（2026-11-24、docs/handoff-2026-11-20/gun-energy-model-2026-11-24.md の末尾）で意図して変えた砲の規則に合わせて、
失敗するようになったテストの期待値を書き換えたもの。表は docs/benchmarks/gun-rules-2026-11-24/table.md。

- 基準：`origin/main`（8c4bcab）の一時 worktree（/tmp/ks-verify/main-wt、作業後に削除）で同じ 11 ファイルを 1 つずつ実行し、
  失敗がブランチ側の変更によるものか、main でも起きていたものかを分けた。ログ：/tmp/ks-verify/20261124-gun-tests-main/。
- 候補：ブランチ `claude/jolly-cannon-psv61o`（47e7590 まで取り込み済み、テストのみ変更）。
- js/、data/、index.html、scripts/ は変更していない。数値の決め打ちより、新しい規則との関係（`power = gunRule.chargeRateTT × TT`、
  `cycle = gunRule.cycle`、`shotChargeTT = E × (1 + 砲身 ÷ 19 m)`、`boltTT = laserShotKt(口径)` など）で書き直した。
- 「main で失敗」は、その期待値が main でも同じく失敗していたか（その行まで到達して失敗していたか）を示す。

## 変更した期待値

| テストファイル / テスト名 | 旧期待値 | 新期待値 | 理由（ユーザー決定） | main で失敗 |
| --- | --- | --- | --- | --- |
| craft-laser-output.cjs / aircraft laser classes carry 400 / 50 / 10 kt per barrel per second（新名 …carry the shot of their bore once a second per barrel） | CRAFT_LASER_OUTPUT heavy/medium/light = 400/50/10 kt、barrelTTs = 同値 | `laserShotKt(0.30/0.17/0.12)×1e-9`（436 / 118.28 / 42.88 kt）、`CRAFT_FIRE.cycles[k] = 1`、barrelTTs = 1 発 ÷ 周期 | 航空レーザーは毎秒 1 発・1 発は口径から（CRAFT_LASER_GEOMETRY） | いいえ |
| craft-laser-output.cjs / per-shot energy is the per-second output times the firing period, barrel by barrel | 毎秒出力 400/50/10 kt、周期 [.18,.12,.12]、1 発 72/6/1.2 kt、cturret 一斉射 2.4 kt | 毎秒出力 = 口径の 1 発 ÷ 1 s、周期 [1,1,1]、1 発 = laserShotKt(口径)、cturret = 2 × 1 発 | 同上 | いいえ |
| craft-laser-output.cjs / a craft type sums every laser barrel of its fire-arc snapshot at its defined rate | 種類ごとの合計 = 砲身数 × 目録の barrelTTs、TIE/ln 2×50、X ウイング 4×50、ARC-170 2×50+2×10、V ウイング 2×2×10 kt/s、既定 2×50 | 実測砲身の作例（X ウイング 0.18 m、ARC-170 0.20 m、Z-95 0.10 m：CRAFT_LASER_EXAMPLES）は口径の 1 発で数える。X ウイング 4×laserShotKt(.18)、Z-95 2×laserShotKt(.10)、ARC-170 2×laserShotKt(.20)+2×軽、TIE/ln・既定 2×中、V ウイング 2×2×軽 | 同上＋作例機の実測砲身（ユーザー表） | いいえ（**変更後も失敗：下の「疑わしい不具合」1**） |
| craft-laser-output.cjs / fleet profile per-craft air attack averages the deployable combat craft by their actual lasers | (24×2×50 + 6×(2×50+2×10) + 2×既定)/32 kt/s | (24×craftLaserRate('tie_ln') + 6×craftLaserRate('arc170') + 2×既定)/32、tie_ln = 2×中 | 同上 | いいえ |
| craft-laser-output.cjs / fleet battle craft attack scales with the per-craft laser output and is zero for unarmed craft | airGun 2e-8 と 4e-8 TT/s で損害比 2（許容 1e-4） | airGun = 中レーザー 1 発（FLEET_AIR_GUN_BOLT = 118 kt）とその 2 倍で損害比 2（**許容 1e-2**）。2e-8/4e-8 は 10 機 × 0.25 s で 1 発の 0.4/0.8 にしかならず、どちらも整数 1 発で同じ損害になる。118 kt の弾では CR90 の区画の貫通で損害が厳密には比例しない（比 1.992） | 同上（1 発が 6 kt → 118 kt）。許容差の変更はレビュー対象 | いいえ |
| craft-laser-output.cjs / the fixed light laser claserL fires 10 kt/s per barrel like the light turret…（新名 …fires the light-class shot per barrel…） | barrelTTs 10 kt/s、boltTT 10 kt × 周期 | barrelTTs = laserShotKt(0.12)/1 s、boltTT = 同 × 周期 | 同上 | いいえ |
| craft-laser-output.cjs / a shot is the per-second output over the actual period of the arc, not the catalogue period | craftShotTT = 砲身数 × 10/50/400/10 kt × 周期、claser 0.1 s で 5 kt | 砲身数 × (口径の 1 発 ÷ 1 s) × 周期（周期 1 s も追加）、claser 0.1 s で 118 kt × 0.1、1 s で 118 kt | 同上 | いいえ |
| craft-laser-output.cjs / fleet airGun per craft equals the RTS squadron energy per second… | 2 × claserH = 2×400 kt/s、bwing = round(aa×2)×50 kt/s | 2 × claserH の毎秒出力、bwing = round(aa×2) × 中レーザーの毎秒出力 | 同上 | いいえ |
| weapon-shot-calibration.cjs / 共通の `shot()` 検査（tests 1–3 で使用） | power × cycle ÷ TT = 砲身数 × 1 発 | レーザーは同じ。ターボレーザー・イオン砲は power = chargeRateTT × TT、cycle = gunRule.cycle、power × cycle ÷ TT = 砲身数 × shotChargeTT、shotChargeTT = E × (1 + 砲身 ÷ 19 m) | 砲の電力は充電の速さ、1 発の充電は閉じ込めを含む | いいえ |
| weapon-shot-calibration.cjs / dedicated ship point defence fires 100 kt per actual barrel per shot（新名 …fires the shot of its bore…） | pd・monCalPD 1 発 1e-7 TT（100 kt） | 各砲身の口径の 1 発（pd 0.40 m = 800 kt、monCalPD 0.178 m = 133 kt）、cycle 1 s | 点防御 800 kt（0.40 m）、monCalPD 133 kt、レーザーは毎秒 1 発 | いいえ |
| weapon-shot-calibration.cjs / aircraft lasers fire their per-barrel per-second output over one period… | 1 発 = 50/400/10 kt/s × 周期、0 < 周期 < 1 | 1 発 = laserShotKt(CRAFT_LASER_GEOMETRY.bore)、周期 = 1 | 航空レーザーは毎秒 1 発・口径から | いいえ |
| weapon-shot-calibration.cjs / six native corvette weapons preserve their 500 MT and 6 MT shot energies… | 500 MT 系 1 発 0.0005 TT、single6MT・twin6MT 6e-6 TT、モデル記録 a.boltTT/volleyTT = 1 発 | 6 門すべてレーザー：1 発 = 各砲身の口径の laserShotKt（quad500MT 279、twin500MT 285、single500MT 613、sphyrnaTwin500MT 261、single6MT 117 kt、twin6MT 658 kt/1.57 MT）。モデル記録 a.boltTT は gunLegacy.boltTT（モデルの元の値。ゲームの弾ではない） | レーザーの改名と口径規則、500MT 砲は描かれた外径のレーザー（main セッションの 7efb2c9）。テスト名は旧のまま | いいえ |
| weapon-shot-calibration.cjs / existing 500 GT guns remain one thousand times the new 500 MT guns per barrel（新名 existing 500 GT guns keep their 0.5 TT shot apart from the corvette lasers） | single500/quad500 ÷ single500MT = 1000 | 500 GT 砲は 0.5 TT のターボレーザーのまま、single500MT はレーザー、比は 0.5 ÷ laserBolt(single500MT)（約 815,000） | 500MT 砲をレーザーにした決定で 1000 倍の関係は意図的になくなった | いいえ |
| weapon-shot-calibration.cjs / native 6 MT and 500 MT guns retain their actual shot yields… | twin6MT 6e-6、single6MT 6e-6、500MT 系 0.0005 | すべて laserBolt(k)、twin6MT は 658 kt・1.57 MT の 2 砲身 | 同上 | いいえ |
| weapon-shot-calibration.cjs / sub-shot electrical increments accumulate into exactly one complete fixed-laser pulse | 最後の u.energy ≈ 0（絶対許容 1e-30） | \|u.energy\| ≤ 1 発 × 1e-12（8 回の加算の丸め残り 2.6e-23 TT = 1 発の 2e-16） | 1 発が 6 kt → 118 kt。許容差の変更はレビュー対象 | いいえ |
| weapon-output-sizing.cjs / point defense adopts the photographed side-carrier model at its native scale | boltTT 1e-7、tt 2e-7、cycle 0.2 | boltTT = laserShotKt(0.40)×1e-9（800 kt）、tt = 2×boltTT、cycle = gunRule.cycle = 1 | 点防御 800 kt・毎秒 1 発 | 書き換えた行は main では通過。**このテストは main と同じ三角形数（176 ≠ 1904）の行で失敗し続ける（既存）** |
| weapon-output-sizing.cjs / retired generic guns resolve to the canonical light quad, DBY and point-defense definitions | ltl→pd 一斉射 2e-7・cycle .2、mtl→quad200 cycle .2、htl→refVen cycle 1 | ltl→pd 一斉射 2×800 kt・cycle = pd.gunRule.cycle、mtl→quad200・htl→refVen の cycle = 各 gunRule.cycle | 発射間隔は充電時間（ターボレーザー）、レーザーは 1 s | いいえ |
| weapon-preview-stats.cjs / テスト用 UI サンドボックス（tests 8, 10, 11 が使用） | designWeaponOutput と designWeaponPreviewHTML だけを app.js から読む | craftLaserOptions・craftLaserSummary・craftLaserHTML と selItem/curFit の空の代役を追加（designWeaponPreviewHTML が航空レーザーの円柱設定欄を呼ぶようになったため。期待値は変えていない） | 航空レーザーをユーザーが口径・長さ・連射速度で決める円柱部品に | いいえ |
| weapon-preview-stats.cjs / maximum input and local heat match the existing shot-energy ledger at full sustained cadence | 最大入力 = 一斉射の入力 ÷ cycle、熱 = 変換損失 ÷ cycle、射程 = 帯の射程 | ターボレーザー・イオン砲は砲身数 × shotChargeTT の入力 ÷ cycle、熱 = gunRule.heatFrac × 入力（heatFrac = 0.05 × c/(1+c)、c = 砲身 ÷ 19 m も検査）、射程 = gunRule.rangeM。レーザーは従来どおり | 発射熱は圧縮分の 5%、射程は砲自身の rangeM、電力は充電の速さ | いいえ |
| weapon-preview-stats.cjs / displaying a legacy electrical model retains its actual nameplate and waste-heat path | 熱 = power × HEAT.waste.weapon | 熱 = power × weaponWasteFrac(d)、weaponWasteFrac(d) = gunRule.heatFrac | 発射熱は圧縮分の 5% | いいえ |
| capital-turret-core.cjs / nine capital entries use physical native models and exact per-barrel gun or ion energies | power = 砲身数 × 1 発 × TT ÷ cycle（絶対許容 1e9 W） | cycle = gunRule.cycle、power = chargeRateTT × TT = 砲身数 × shotChargeTT × TT ÷ cycle（相対許容 1e-12）、shotChargeTT = E × (1 + 砲身 ÷ 19 m) | 電力は充電の速さ・閉じ込め込みの充電 | 書き換えた行は main では通過。**このテストは main と同じ `pd.boltTT ≈ .02` の行で失敗し続ける（既存。値は main 1e-7、ブランチ 8e-7）** |
| capital-turret-core.cjs / pitched native ball guns carry their physical joint, energy, electrical demand and heat owner into the fleet profile | m.gun = 720、m.power = 720 × TT ÷ eta | m.gun = 720 ÷ ball720.cycle（2.48 s）、m.power = chargeRateTT × TT ÷ eta。alphaTot・wCap・capacity・boltTT は 720 のまま | 発射間隔は充電時間、電力は充電の速さ | 書き換えた行は main では通過。**このテストは main と同じ `cleaned?.surface` の行で失敗し続ける（既存）。その後ろの `source.powerWeight ≈ 720×TT` は到達せず未確認** |
| moncal-weapons-core.cjs / new catalog ratings preserve per-barrel energy and use real native-sized gun models | monCalPD・pd 1 発 1e-7・cycle .2、monCal34/80/200/200Triple/150Ion cycle 1、quad1Rapid cycle .2、power = 砲身数 × 1 発 × TT ÷ cycle | レーザーは口径の 1 発・cycle 1、ほかは cycle = gunRule.cycle、power = 砲身数 × (レーザーは 1 発、ほかは shotChargeTT) × TT ÷ cycle、さらに power = chargeRateTT × TT | 砲の発射間隔・電力・レーザーの 1 発は砲身モデルから | いいえ |
| recusant-munificent-guns.cjs / catalog outputs follow the user (2 PT prow gun, 360 TT twins, 2.5 PT x2 bow gun, 300 GT rapid ventral twins) | power × cycle ÷ TT = 砲身数 × 1 発、munTwin cycle 0.2 | power × cycle ÷ TT = 砲身数 × shotChargeTT、cycle = gunRule.cycle、power = chargeRateTT × TT、munTwin の cycle = gunRule.cycle（1.36 s。式としては同語反復で、「速射」の数値の確認は残らない） | 同上 | いいえ |
| dual-purpose-weapons.cjs / switching automatic interception ON shares one reload and one energy debit… | 0.01 s × 22 歩（旧 pd の 1 周期 0.2 s + 2 歩）で迎撃弾が出る | 歩数 = ceil(pd.cycle ÷ 0.01) + 2（1 周期 + 2 歩、今は 102 歩）。2 か所 | 点防御は毎秒 1 発 | いいえ |
| light-turret-family.cjs / six light weapons use their requested per-barrel energies and native photo calibration | power × cycle ÷ TT = 砲身数 × 1 発、twin200Fast.cycle < twin200.cycle | cycle = gunRule.cycle、power = chargeRateTT × TT、shotChargeTT = E × (1 + 砲身 ÷ 19 m)、power × cycle ÷ TT = 砲身数 × shotChargeTT。「速射の方が間隔が短い」は外し、両連装とも cycle = 2 × shotChargeTT ÷ chargeRateTT、充電の速さは同じ、に置き換え（今は 1.45 s と 1.40 s で速射の方が遅い） | 「武装の表の新規則化を進めて。これにより中ターボレーザーの発射速度の話は解決で」：発射間隔は 1 発の充電時間 | いいえ |
| trial-guidance.cjs / KS_TURN_MASS: a craft turns as its manoeuvring thrusters swing its mass (off by default)（新名 …(on by default, off with =false)） | 既定（切り替えなし）で TIE/ln の旋回率 0.24 | `KS_TURN_MASS:false` で 0.24、既定は `KS_TURN_MASS:true` と同じで 0.24 ではない | 「旋回は質量も推力も」：KS_TURN_MASS・KS_TURN_VECTOR を既定に | いいえ |
| trial-guidance.cjs / KS_TURN_VECTOR: a light craft reverses faster when its thrust is pointed off its way (off by default)（新名 …(on by default, off with =false)） | 質量だけの比較は `{KS_TURN_MASS:true}` | 質量だけは `{KS_TURN_MASS:true, KS_TURN_VECTOR:false}`。既定（`{}`）は迎角あり・反転時間が推力の向きありと同じ、を追加 | 同上 | いいえ |

## 変更していない失敗

| テストファイル / テスト名 | 状態 | 理由 |
| --- | --- | --- |
| weapon-output-sizing.cjs / point defense adopts the photographed side-carrier model at its native scale | 失敗（三角形数 176 ≠ 1904） | main でも同じ行で失敗（既存） |
| capital-turret-core.cjs / nine capital entries… | 失敗（`pd.boltTT ≈ .02`） | main でも同じ行で失敗（既存、main の値 1e-7） |
| capital-turret-core.cjs / saved profile9 surface guns recompile… | 失敗（0 !== 1） | main でも同じ（既存） |
| capital-turret-core.cjs / real profile10 saved designs rebuild… | 失敗（0 !== 1） | main でも同じ（既存） |
| capital-turret-core.cjs / pitched native ball guns… | 失敗（`cleaned?.surface`） | main でも同じ行で失敗（既存） |
| gunnery-accuracy.cjs / surface mounts share the same accuracy and retain their physical firing arcs | 失敗（0.8103 ≠ 0.8526） | main でも同じ値で失敗（既存） |
| gunnery-accuracy.cjs / the production tactical and strategic fleet clocks apply the shared 50% law once | 失敗（20.258 ≠ 21.315） | main でも同じ値で失敗（既存） |
| craft-laser-output.cjs / a craft type sums every laser barrel… | 失敗（X ウイング 4.73e-7 ≠ 5.46e-7） | 疑わしい不具合 1（下）。期待値は仕様どおりに書いた |
| light-turret-family.cjs / decoded visible shaft lengths and separate shaft/muzzle diameters follow the controlling full-sheet photograph | 失敗（0.861 ≠ 0.692） | 砲の規則ではなく 44ed7bf（0.45 m 未満の砲身を 0.45 m に太くする形状変更）による。形状・原本照合の変更なので reference-fidelity の判断が要る。触っていない |
| light-turret-family.cjs / draw, picking and physical muzzle transforms agree on every mount axis and tilted surfaces | 失敗（single200 の描画三角形が選択範囲の外） | 同じく 44ed7bf による。疑わしい不具合 2（下） |

## 疑わしい不具合（期待値で隠していない）

1. `craftLaserRate(type)`（js/core.js）が `CRAFT_LASER_EXAMPLES[type] || CRAFT_LASER_EXAMPLES[craftTypeOf(type)]` を引くが、
   CRAFT_LASER_EXAMPLES のキーは `craft_xwing`・`craft_arc170`・`craft_z95`、引く側は `xwing`・`arc170`・`z95`（craftTypeOf は `xwing` を返す）なので、
   実測砲身の上書きが種類の値に一度も効かない。X ウイングは 4 × 118.28 kt（0.17 m）= 4.73e-7 TT/s のまま（実測 0.18 m なら 5.46e-7）、
   ARC-170 と Z-95 も同様。艦隊の airGun と RTS の推定がこの値を使う。
2. 44ed7bf 以降、single200（ほか 200GT 系）の太くした砲身の頂点が `fitAABB`（選択範囲）からはみ出す。描画と選択範囲がずれている可能性がある。

## 再実行の結果（変更後、1 ファイルずつ）

ログ：/tmp/ks-verify/20261124-gun-tests-final/。報告の数値は最終実行のもの。

| ファイル | 変更前（ブランチ、通過/失敗） | main | 変更後 | 残る失敗 |
| --- | --- | --- | --- | --- |
| light-turret-family | 6/3（依頼時 8/1） | 9/0 | 7/2 | 44ed7bf の形状変更による 2 件（上） |
| weapon-output-sizing | 7/2 | 8/1 | 8/1 | 既存 1 件 |
| craft-laser-output | 2/8 | 10/0 | 9/1 | 疑わしい不具合 1 |
| weapon-shot-calibration | 4/5 | 9/0 | 9/0 | なし |
| weapon-preview-stats | 8/5 | 13/0 | 13/0 | なし |
| capital-turret-core | 8/4 | 8/4 | 8/4 | 既存 4 件（main と同じ行） |
| moncal-weapons-core | 4/1 | 5/0 | 5/0 | なし |
| recusant-munificent-guns | 2/1 | 3/0 | 3/0 | なし |
| gunnery-accuracy | 6/2 | 6/2 | 6/2 | 既存 2 件（main と同じ値、触っていない） |
| dual-purpose-weapons | 15/1 | 16/0 | 16/0 | なし |
| trial-guidance | 9/2 | 11/0 | 11/0 | なし |

## 主担当の追加（2026-11-24）

| テスト | 旧期待値 | 新期待値 | 理由 | main で失敗 |
| --- | --- | --- | --- | --- |
| light-turret-family：decoded visible shaft lengths and separate shaft/muzzle diameters follow the controlling full-sheet photograph | 砲身・砲口の直径 = 写真の画素 × m/px | 写真の値 × 資産の barrelRadiusScale（口径 0.45 m まで太くした倍率） | ユーザー決定「口径 0.45 m 未満のターボレーザーを太くする」。砲身の長さは写真のまま | いいえ |

不具合の修正（期待値は変えていない）：
- craftLaserRate／RTS の編隊の射撃が作例機の実測砲身（CRAFT_LASER_EXAMPLES、キー craft_xwing 形式）を引けていなかった → craftLaserRate と craftLaserArcs が 'craft_'+型名で引く。RTS の 1 発も craftLaserRule（口径・砲身・連射）で数える。craft-laser-output 10/10。
- 太く・長くした砲身が砲の箱（referenceFitAABB）からはみ出していた → 資産の描いた範囲（drawnExtent）で箱を作る。light-turret-family test 8 通過。

## 全テスト実行後の追加（2026-11-24、2 回目）

対象：全テストの実行結果（候補側の集計 /tmp/ks-verify/20261124-final-tests/summary.txt、基準側との比較 compare.txt。基準は `origin/main` 8c4bcab の
worktree）で、基準より失敗が増えたテスト。1 ファイルずつ作業ツリーで実行し直した（ログ：/tmp/ks-verify/20261124-testfix/）。
js/core.js・js/app.js・js/gfx.js・js/engine.js・data/ は変更していない。基準でも同じ数だけ失敗するテストは触っていない。

### 変更した期待値

| テストファイル / テスト名 | 旧期待値 | 新期待値 | 理由（ユーザー決定） | main で失敗 |
| --- | --- | --- | --- | --- |
| arquitens-turret.cjs / the medium quad keeps its existing 500 GT energy and key while adopting the new STL/photo native size | `power × cycle ÷ TT = 2`（4 門 × 0.5 TT） | 1 発は 0.5 TT のまま（`gunRule.shotKt`）、`shotChargeTT = 0.5 × (1 + 砲身 ÷ 19 m)`、`cycle = gunRule.cycle`、`power × cycle ÷ TT = 4 × shotChargeTT`（今は 3.61） | 砲の電力は充電の速さ、1 発の充電は閉じ込めを含む | いいえ |
| broadside-battery-gfx.cjs / fleet descriptors use articulated balls and the same physical muzzle as design geometry | 80TT 単装球（monCal80）の `t.cycle = 1` | `t.cycle = FITS.monCal80.gunRule.cycle`、かつ `= shotChargeTT ÷ chargeRateTT`（今は 1.549 s）。`t.tt = 80` はそのまま | 発射間隔は 1 発の充電時間 | いいえ |
| capital-turret-models.cjs / all nine capital weapons use their native physical models, requested barrel energies and real triangle budgets | `power × cycle ÷ TT = 門数 × 1 発` | 1 発は表の値のまま（`gunRule.shotKt`）、`shotChargeTT = 1 発 × (1 + 砲身 ÷ 19 m)`、`cycle = gunRule.cycle`、`power = chargeRateTT × TT`、`power × cycle ÷ TT = 門数 × shotChargeTT` | 同上 | いいえ |
| capital-turret-models.cjs / adding capital weapons preserves all fourteen unaffected 40/70TT and 200/500GT model payloads and metadata | 14 資産の記録（`_` で始まるキャッシュを除く）の SHA-256 | **ハッシュ値は 14 個とも変えていない。** 200GT 系 4 資産（light_twin200・light_quad200・light_single200・light_twin200_fast）は読み込み時に砲身を太くした記録（barrelRadiusScale・drawnExtent、砲身の半径 × 倍率）を持つので、その分を取り除いた写しでハッシュを取る（半径 ÷ 倍率で元のハッシュに一致することを確認）。加えて、この 4 資産だけが変形されること、口径がちょうど 0.45 m になること、砲身の長さは変えていないこと（barrelExposedScale なし）、倍率が 1〜1.3 であることを検査 | 口径 0.45 m 未満のターボレーザーを 0.45 m に太くする（44ed7bf）。元データ（data の payload・UV・室・関節）は変えていない | いいえ |
| capital-turret-trial.cjs / actual capital trial fire samples independent shared dispersion at each physical muzzle without changing shot energy | 散布の射程 = 40,000 m（公試共通の TRIAL_GUN.range）、弾の寿命 ≤ 40,000 ÷ 4,500 s | 散布の射程 = `FITS.ball175Quad.gunRule.rangeM`（今は 54,481 m）で、公試の砲の `reach` と同じ。寿命 ≤ その射程 ÷ 4,500 s。1 斉射 700 TT はそのまま | 射程は砲ごとの rangeM（保持距離 + 171 m の減衰） | いいえ |
| capital-turret-trial.cjs / a real RTS carrier spool keeps its manually piloted physical guns fireable before departure | 4 発で使った蓄電 = 700 TT | 撃ち出した量は 700 TT のまま、使った蓄電 = 700 × `weaponChargeFactor(ball175Quad)`（= 1 + 砲身 38.1 m ÷ 19 m = 3.005、2,103.7 TT）。係数が 1 + 砲身 ÷ 19 であることも検査 | ターボレーザーは E × (1 + c) を充電して E を撃つ（公試・戦闘とも） | いいえ |
| combat-point-defense-targeting.cjs / the real RTS missile step leaves missiles alone when only ordinary guns are installed | 敵艦を 5 km に置き、triple40・single500MT・single6MT のどれも敵艦を撃ち続ける | 射程が 5 km 以下の砲（レーザーであることも検査）は敵艦を自分の射程の 0.6 倍の距離に置く。single6MT は 117 kt の中レーザーで射程約 1.67 km なので約 1.0 km。ミサイルの位置と「ミサイルを迎撃しない」「敵艦は撃つ」の検査はそのまま | single6MT は中レーザー（射程 860 m + 125 × (砲身 − 1) × ln(kt)） | いいえ |
| craft-shield-generator-scale.cjs / a generator of the X-wing remodel size gives the X-wing field whatever the hull length | X ウイングの発生器で `CRAFT_SHIELD.refScale`（3e-6） | `SHIELD_CURVE.refScale`（6.158e-6）。曲線の X ウイングの点が 6.158e-6 であること、発生器の容積が旧定義と同じことも検査 | 「シールドはヴェネターとXウイングをつなぐ曲線で決まるはずだ」「実際の被弾距離で」（X ウイングの点 6.158e-6） | いいえ |
| craft-shield-generator-scale.cjs / a generator twice as wide stands for a craft twice as long, a smaller one for a shorter craft | 容積 8 倍の発生器 = 全長 26.8 m の航空機の曲線の値（3e-6 × 2^E） | 発生器の容積の曲線：`refScale × 8^EXP` = `(8 × refGenV ÷ fullGenV)^EXP`（EXP = ln(refScale) ÷ ln(refGenV ÷ fullGenV)）。「容積 8 倍 = 長さ 2 倍」「小さい発生器は小さい」「localShield も数える」はそのまま | 同上（発生器の容積で決める一本の曲線） | いいえ |
| craft-shield-generator-scale.cjs / without generator modules the hull length is used, and ships of blendLen and over keep their curve（新名 …; with generators, ships and craft of any length read the one generator-volume curve） | 全長 100 m 以上の機体と艦（コルベット）は発生器があっても全長の曲線のまま（艦は元のまま）。全長 1,000 m は発生器 1e-3 m³ でも 1 | 発生器があれば全長・艦種によらず発生器の容積の曲線（1 m³、0.01 m³ の値で検査）。発生器のない全長 1,000 m は 1、ヴェネターの発生器（61,561.1 m³）で 1、その 4 倍でも 1 を超えない。発生器なしは全長の規則（lengthFieldScale）のまま | 同上（艦も航空機も同じ一本の曲線、ヴェネターの発生器でほぼ補正なし） | いいえ |
| craft-shield-generator-scale.cjs / the examples: A-wing above, Z-95 below their length rule, X-wing unchanged（新名 …X-wing at the X-wing point of the curve） | X ウイングは全長の規則の値の 1% 以内 | X ウイングは曲線の X ウイングの点（6.158e-6）の 1% 以内。A ウイングは全長の規則より上・Z-95 は下、はそのまま。3 機とも発生器の容積の曲線の値であること、Z-95 < A ウイング < X ウイング（発生器の容積の順）を追加 | 同上 | いいえ |
| design-placement-catalog-ui.cjs / the catalogue offers one landing and targeting entry while retaining legacy saved definitions（新名 the catalogue offers the craft repulsorlift again, one targeting entry, and retains legacy saved definitions） | landingGear・targetComputer・vls はカタログに出ず、選んでも struct のまま | landingGear はカタログに出て選べる（名前は「リパルサーリフト」、repulsor の名前は「重力制御装置」も検査）。targetComputer・vls は従来どおり出ない | 部品 landingGear を「リパルサーリフト」として再掲載、repulsor は「重力制御装置」 | いいえ |

### テストの土台の変更（期待値は変えていない）

| テストファイル | 変更 | 理由 |
| --- | --- | --- |
| design-placement-catalog-ui.cjs（テスト 2 が `craftLaserHTML is not defined`） | app.js から読む関数に craftLaserOptions・craftLaserSummary・craftLaserHTML を追加 | designWeaponPreviewHTML が航空レーザーの円柱設定欄を呼ぶようになった |

### 英語の表示（js/lang-en.js）

craft-systems-localization.cjs のテスト 1・4 が、新しい日本語の文（リパルサーリフトの説明、支持質量の警告）に英訳がなく失敗していた。
js/lang-en.js の末尾に `<gun-rules-2026-11-24-catalog>` の区画を足した（既存の項目は消していない）。`git diff 8c4bcab -- js/core.js js/app.js js/gfx.js js/engine.js index.html` で
増えた日本語の文字列を拾い、英訳のないものを足した：
- 砲の名前・略称・説明（GUN_RULE_LABELS の 9 門）、「中レーザー」「中レーザー砲」（用語）。
- 航空レーザー 4 種（claser・claserL・claserH・cturret）の説明と出典の文、円柱設定欄（レーザー砲身（円柱）・口径・連射速度・注記・「{0} 発/秒」・「1発 {0}・射程 {1}・定格入力 {2} kt/秒（1門）」・操作名「レーザー砲身を調整」）。
- 重力制御装置（用語と部品の説明、作例の部品名 5 つ、「重力制御装置喪失」「重力制御装置喪失：撃墜」）、リパルサーリフト（旧 着陸脚）の説明、支持質量の警告（{0}・{1} の型）。
- エンブレムの移動（「塗装・エンブレムを移動」、英語表示のときの aria-label「Fore/Aft X を減らす」ほか 6 つ）。
確認：上の差分から拾った文字列のうち英訳が残らないのは、連結の一部だけの「喪失：撃墜」（表示は「リパルサーリフト喪失：撃墜」「重力制御装置喪失：撃墜」で、どちらも英訳あり）のみ。
「800kt 点防御2連装 ×2」のように後ろへ「×2」を付けた形は main の「100kt 点防御2連装 ×2」でも英訳されず、今回も足していない（既存）。

### 変更した期待値（続き：航空レーザー・コルベットの砲・リパルサー）

| テストファイル / テスト名 | 旧期待値 | 新期待値 | 理由（ユーザー決定） | main で失敗 |
| --- | --- | --- | --- | --- |
| equipment-taxonomy.cjs / unmarked landing gear retains mechanical support without acquiring repulsor support（新名 …and lifts as a repulsorlift of its volume） | landingGear 1 m³ の `repulsorSupport = 0` | 同じ容積の repulsor 部品と同じ 1 m³ あたりの支持（`repulsor の repulsorSupport ÷ 容積 × landingGear の容積`、今は 70）。接地の支持 300 と容積 1 はそのまま | landingGear は航空機のリパルサーリフトで、浮揚の支持に数える | いいえ |
| equipment-taxonomy.cjs / equipment replacement offers the unified catalogue while retaining an existing hidden legacy kind | landingGear・targetComputer・vls は交換候補に出ない | landingGear は交換候補に出る（名前「リパルサーリフト」も検査）。targetComputer・vls は出ない。既存の landingGear・targetComputer を開いても、自分以外の隠し種類（targetComputer・vls）は出ない | landingGear を「リパルサーリフト」として再掲載 | いいえ |
| example-weapon-families.cjs / curated CIS model-cut gun yields, cadences and native variant branches are retained | recProw・recTwin・recKeel の cycle 15、munBow 1.6、munTwin 0.2 | 表の値は `gunLegacy.cycle` に残る（15／15／15／1.6／0.2）。`cycle = gunRule.cycle = 門数 × shotChargeTT ÷ chargeRateTT`、`shotChargeTT = 1 発 × (1 + 砲身 ÷ 19 m)` | 発射間隔は 1 発の充電時間 | この行は main では通過。**このテストは main と同じ後ろの行（`0 !== 10`）で失敗し続ける（既存）** |
| example-weapon-families.cjs / CR90 native light/heavy guns and the Dreadnaught armament from the user design retain their distinct rosters | twin500MT の 1 発 0.0005 TT、single6MT 6e-6 TT | どちらもレーザーで、1 発 = 各砲身の `laserShotKt(口径)` の平均（twin500MT 0.247 m・285 kt、single6MT 0.169 m・117 kt。口径の実測値でも 1% 以内で検査）。門数の検査はそのまま | 500MT 系は描かれた口径のレーザー、CR-90 の砲は中レーザー | いいえ |
| example-weapon-families.cjs / Sphyrna uses two native bow twin heavy lasers and one aft twin light turbolaser | 艦首の twin6MT 1 発 6e-6 TT、艦尾の sphyrnaTwin500MT 0.0005 TT | twin6MT は 2 砲身が 658 kt・1,566 kt で boltTT はその平均、sphyrnaTwin500MT は 261 kt のレーザー。配置・門数の検査はそのまま（テスト名は旧のまま） | スフィルナの砲身ごとの威力、500MT 系はレーザー | いいえ |
| fighter-pilot-guns.cjs / each pilot pulse retains its catalogue shot energy and gas cost when the firing cadence changes（新名 each pilot pulse is the shot of its bore, and energy and gas follow the shots fired when the rate of fire changes） | 既定の周期 0.08〜0.18 s、6 秒で 40 発以上。周期を 0.6 s に書き換えると 1 発 = 毎秒出力 × 0.6 s（craftShotTT）、ガスも 0.6 s 分 | 既定は毎秒 1 発（cycle = 1 = CRAFT_FIRE.cycles.claser、6 秒で 5〜6 発）、1 発 = `laserShotKt(0.17)`。連射速度は fit の rateHz：rateHz 4 で cycle 0.25、1 発は同じ、電力・ガスは発射数に比例（1 発につき claser.cycle = 1 s 分のガス） | 航空レーザーは口径で 1 発・毎秒 1 発、連射速度はユーザーが決め、ガス・電力は発射数に比例 | いいえ |
| fighter-pilot-guns.cjs / normal and coarse frame steps keep the pulse stream steady without saving up idle shots | 既定の砲で 8 秒 60 発以上、刻み 0.016／0.04／0.1 s で ±1 発・±3% | 連射速度 10 発/秒（rateHz 10、fit の上限）の砲で同じ検査（60 発以上、±1 発、±3% はそのまま）。引き金を離した後・電力切れ後に溜めない検査は既定の砲のまま | 同上（既定は毎秒 1 発になり、8 秒で 8 発） | いいえ |
| fighter-pilot-guns.cjs / several fixed guns stagger their pulses and the pilot trigger does not wait for a capital salvo | 4 門が 0.12 s（0.01 s × 12 歩）のうちに 1 門ずつ撃つ | 1 周期が 1 s になったので 0.01 s × 100 歩のうちに 1 門ずつ（[1,1,1,1] はそのまま） | 毎秒 1 発 | いいえ |
| fighter-pilot-guns.cjs / all pilot weapon types share short cycles while a rotating turret still tracks the reticle（新名 pilot lasers fire once a second by default and at the fit's rate of fire, …） | claser・claserH の cycle ≤ 0.22 s | cycle = 1（= CRAFT_FIRE.cycles）、rateHz 5 の fit で 0.2 | 同上 | いいえ |
| fighter-pilot-guns.cjs / actual aircraft model barrels and tiny affordability limits preserve complete physical shots | cturret の 2 門目は 1 歩（周期 × 0.6）進めた後に `trial.bolts` に 2 発ある | 弾を発射の時点で集める（0.016 s 刻みで周期 × 0.6 進め、出た弾 2 発の 1 発と砲身の間隔を検査。値は同じ）。軽レーザーの弾は射程 860 m（0.19 s）で消えるので、0.6 s 後の一覧には残らない | レーザーの射程 860 m + 125 × (砲身 − 1) × ln(kt) | いいえ |
| fighter-pilot-damage.cjs / テストの土台 `reset(key, cycle)` → `reset(key, rateHz)` | 砲塔の cycle を直接 0.5／0.7 s に書き換えて遅くする | fit の rateHz を指定する（cycle = 1 ÷ rateHz であることも検査） | 連射速度は fit の rateHz | いいえ |
| fighter-pilot-damage.cjs / actual catalogue pulses retain their per-shot fighter and missile hit probabilities at different cadences | 速い側 = 既定（0.12／0.18 s）、遅い側 = 0.5／0.7 s。速い側は `秒数 ÷ 遅い周期 × 3` 発より多い | 速い側 = rateHz 4、遅い側 = 既定の毎秒 1 発（5〜7 発、1 発は同じ）。速い側は `秒数 × 3` 発より多い。1 発あたりの命中確率が両方で同じ、の検査はそのまま | 同上 | いいえ |
| fighter-pilot-damage.cjs / practice-target hit weight scales with the emitted pulse energy rather than the new bolt count | 同じ組み合わせ | 速い側 rateHz 4、遅い側 既定。重みの検査はそのまま | 同上 | いいえ |
| fighter-pilot-damage.cjs / missile direct hits keep their existing guaranteed kill while laser misses still do no damage | 最初の 0.25 s に出た弾を使う | 最初の 1 s に出た弾を使う（毎秒 1 発なので 0.25 s では出ない） | 同上 | いいえ |
| fighter-laser-visuals.cjs / fixed fighter lasers stream along their barrels, without snapping toward an offset target | 既定の機首 2 門が 1 秒に 15〜18 発、寿命の違う弾が 9 種類以上 | 既定の機首 2 門は 1 秒に 2 発（2 門は同時に撃たない）。周期 0.12 s を持つ 2 門（連射速度を上げた砲）で元の検査（15〜18 発、描画の刻みによらない、9 種類以上）を残した | 毎秒 1 発 | いいえ |
| fighter-laser-visuals.cjs / a large nearby formation stays within both the per-frame and total bolt limits | 200 機の既定の砲で 2 秒後の弾が 900〜1,100 | 200 機に周期 0.12 s の 2 門を持たせて同じ検査（毎秒 1 発だと 2 秒で 800 発で上限に届かない） | 同上 | いいえ |
| fighter-laser-arcs.cjs / a live custom aircraft carries its actual fitted barrel directions into an embarked blueprint snapshot | 艦首面（a:0）に付けた claserH の向き [0,1,0]、真上の目標に撃てる | 2 門とも [1,0,0]（fitFrameOf の fw も検査）。正面の目標に撃て、真上・真後ろには撃てない | 航空レーザーは正面向きにだけ配置 | いいえ |
| heavy-laser-aa-trial.cjs / single6MT keeps its 6 MT shot for manual fire and does not automatically intercept（新名 …fires the laser shot of its bore (117 kt) on the manual trigger…） | 1 発 6e-6 TT | 1 発 = `laserShotKt(口径)`（117 kt）、弾・消費電力もその値。自動迎撃しない検査はそのまま | CR-90 の砲は中レーザー | いいえ |
| heavy-laser-aa-trial.cjs / corvette light turbolasers preserve traverse and 500 MT barrels while requiring the manual trigger（新名 the corvette guns once rated 500 MT …fire the laser shot of their bores…） | 1 発 0.0005 TT、蓄電 1 TT から引く | 1 発 = 各砲の口径の値（613／285／279／261 kt）。蓄電は 1e-5 TT（1 TT から 0.3〜0.6 MT を引くと差の丸め 1e-16 が許容差（相対 1e-10、変更なし）を超えるため） | 500MT 系は描かれた口径のレーザー | いいえ |
| heavy-laser-aa-trial.cjs / dedicated twin and spherical PD packets retain 100 kt per physical barrel while intercepting（新名 …carry the laser shot of their bores (800 kt, 133 kt)…） | 1 門 1e-7 TT | pd 800 kt、monCalPD 133 kt（`laserShotKt(口径)`） | 点防御 800 kt、球状 PD 133 kt | いいえ |
| mandator-battery-layout.cjs / the archived v23 Mandator combines the batteries without changing main/ion or per-barrel PD energy | pd・monCalPD の 1 門 1e-7 TT、点防御の一斉射の合計 0.00005 TT（500 門 × 100 kt） | 1 門 = `laserShotKt(口径)`（pd 800 kt、monCalPD 133 kt）、合計 = 160 × pd.tt + 60 × monCalPD.tt（約 0.00028 TT）。主砲・イオン 317,520 TT、門数 500、基数 499 はそのまま | 点防御 800 kt、球状 PD 133 kt | 基準側の結果は未着（比較の実行待ち）。失敗の値 `8e-7 != 1e-7` は砲の規則によるもの |
| weapon-catalog-migration.cjs / one canonical catalog describes the heavy twin, octuple and generic ion gun | stl・oct40 の `power = tt × TT ÷ cycle` | `cycle = gunRule.cycle`、`power = chargeRateTT × TT`、`shotChargeTT = 1 発 × (1 + 砲身 ÷ 19 m)`、`power × cycle ÷ TT = 門数 × shotChargeTT` | 電力は充電の速さ、1 発の充電は閉じ込めを含む | いいえ |
| trench-armament-combat.cjs / port and starboard rows use the real opening, range and bounded per-muzzle obstruction rather than one center ray（ほか、同じ `target()` を使うテスト 4・7・8） | 目標を中心線から 8 km（艦首側の目標は 12 km）に置き、溝の 34TT 単装球（monCal34）の列が撃つ | 目標を 4 km（艦首側 7 km）に置く。monCal34 は保持距離 4.4 km・射程 7.4 km（砲身 10.3 m が最低コイル長 9.65 m をわずかに超えるだけ）。4 km が保持距離の内、7 km が射程の内、射程が 8 km 未満であること、8 km では撃たないことも検査。開口・遮蔽・弾の配分の検査はそのまま | ターボレーザーの射程は保持距離（コイル長）+ 171 m の減衰 | いいえ（テスト 9 の失敗は main と同じ・既存） |
| trench-armament-combat.cjs / actual reactor input charges empty shared banks and funds firing and weapon waste heat through one ledger | 武装の熱 = `HEAT.waste.weapon × 入力 × dt`（入力の 5%） | 武装の熱 = `profile.weaponWaste × 入力 × dt`、`weaponWaste = monCal34 の gunRule.heatFrac = 0.05 × c ÷ (1 + c)`（c = 砲身 ÷ 19 m、今は 0.0176）。ほかの帳簿の検査はそのまま | 「艦内に行く熱は圧縮分のエネルギーの5%で」 | いいえ |
| small-weapons-ui.cjs / catalog cards display total volleys while each weapon preview shows its per-barrel rating | 一斉射の表示：quad500MT 2 GT、twin500MT 1 GT、single500MT 500 MT、single6MT 6 MT、twin6MT 12 MT、sphyrnaTwin500MT 1 GT | 1.12 MT、570.33 kt、613.23 kt、116.9 kt、2.22 MT、521.83 kt（各砲身の `laserShotKt(口径)` の合計を fTT で表示した値と一致することも検査） | コルベットの砲は描かれた口径のレーザー | いいえ |
| small-weapons-ui.cjs / dedicated PD and aircraft cards show calibrated per-shot units and the removed ion gun stays out of the catalog | 1 発：pd・monCalPD 100 kt、claser 6 kt、claserH 72 kt、cturret 1.2 kt。一斉射 200／300／6／72／2.4 kt | 1 発：800 kt、133.13 kt、118.28 kt、436 kt、42.88 kt。一斉射 1.6 MT、399.38 kt、118.28 kt、436 kt、85.76 kt。プレビューの 1 発 = `laserShotKt(口径)`（0.40／実測／0.17／0.30／0.12 m） | レーザーの 1 発は口径から、毎秒 1 発 | いいえ |
| shield-deflection.cjs / missiles, bombs and craft strike the hull; ion ordnance works on the ship without the field（新名 missiles and bombs strike the hull, craft lasers meet the field unless fired from inside it; …） | core.js に `direct:(msl+fd)*hd`（搭載機の射撃 fd は常に直接損害） | シールドの外からは `air:fd*hd`（シールドに当たる）と `direct:msl*hd`、シールドの内側からは `direct:(gun+msl+fd)*hd`、搭載機の射撃は `sf`・`hull` として FLEET_AIR_GUN_BOLT の弾で数える、の 3 つの記述を検査。ほかの検査はそのまま | 「シールドに当たる場合はシールドに防がれる。スレスレを飛行してシールドの内側に入ると直接ダメージ」 | いいえ |
| twin40-turret.cjs / the two photographed 40 TT twins have distinct houses while DBY-827 remains a 70 TT twin | `power × cycle ÷ TT = 80` | `shotChargeTT = 40 × (1 + 砲身 ÷ 19 m)`、`cycle = gunRule.cycle`、`power = chargeRateTT × TT`、`power × cycle ÷ TT = 2 × shotChargeTT` | 電力は充電の速さ、1 発の充電は閉じ込めを含む | いいえ |
| weapon-family-models.cjs / all nine photographed weapons keep distinct regular models, barrel counts, energies and native scales | `power × cycle ÷ TT = 門数 × 1 発` | 同上の関係（1 発は表の値のまま） | 同上 | 書き換えた行は main では通過。このファイルの残り 3 件の失敗は main と同じ（既存） |
| venator-side70.cjs / the restored side weapon has its own 70 TT-per-barrel identity without upgrading old 40 TT inventory | `power = 140 × TT ÷ cycle` | `cycle = gunRule.cycle`、`power = chargeRateTT × TT`、`shotChargeTT = 70 × (1 + 砲身 ÷ 19 m)`、`power × cycle ÷ TT = 2 × shotChargeTT` | 同上 | いいえ |
| weapon-family-retirement.cjs / the spherical four-barrel40TT ion gun has one160TT ion salvo and no turbolaser output | quad40Ion の cycle 1、power 160 TT/s | 表の値は `gunLegacy.cycle = 1`。`shotChargeTT = 40 × (1 + 砲身 ÷ 19 m)`、充電の速さ = 0.00062 TT/s/m³ ×（砲塔の容積 fm×wm×hm + 既定の充電容積）、`cycle = gunRule.cycle = 4 × shotChargeTT ÷ chargeRateTT`（今は 50.6 s）、`power = chargeRateTT × TT` | イオン砲の充電の速さは容積から、間隔は充電時間だけ | いいえ |
| weapon-family-retirement.cjs / the actual engineering and fleet mount keep spherical ion damage separate from gun damage | 砲台の `m.ion = 160`（TT/s）、`m.cycle = 1` | `m.ion = 160 ÷ gunRule.cycle`、`m.cycle = gunRule.cycle`。斉射 160・1 発 40・4 門はそのまま | 同上 | いいえ |
| weapon-family-retirement.cjs / retired overlapping weapons migrate to current types while retaining saved fitting identity and settings | twin40・quad40Ion の cycle 1 | `gunLegacy.cycle = 1`、`cycle = gunRule.cycle` | 発射間隔は充電時間 | いいえ |
| point-defense-toggle.cjs / OFF stops actual missile interception for both installed PD families without silencing aimed ship fire | 敵艦を 5 km に置き、pd・monCalPD とも敵艦を撃つ | 射程が 5 km 以下の砲は敵艦を射程の 0.6 倍に置く（monCalPD は射程約 1.7 km なので約 1.0 km。pd は射程 5.04 km で 5 km のまま）。「迎撃を切るとミサイルを撃たない」「敵艦は撃つ」はそのまま | レーザーの射程 860 m + 125 × (砲身 − 1) × ln(kt) | 基準側の結果は未着。失敗は monCalPD の射程による |
| point-defense-minimum-render.cjs / minimum PD uses fixed explicit budgets, exact whole extents and one cached asset without changing the physical model | pd・monCalPD の 1 門 1e-7 TT | 1 門 = `laserShotKt(口径)`（800 kt、133 kt）。三角形・頂点数、範囲、元データのハッシュの検査はそのまま | 点防御 800 kt、球状 PD 133 kt | 基準側の結果は未着 |
| point-defense-minimum-render.cjs / all 42 non-PD authored draw meshes remain byte-identical to the merged rendering baseline | 42 資産の描画メッシュ（pos・uv・idx）のハッシュが基準資料（tests/helpers/non-pd-render-geometry.json）と一致 | **基準資料は変えていない。** 読み込み時の砲身の変形（reshapeGunBarrels）をメモリ上でだけ無効にした 2 つ目のゲームの写しで、42 資産すべてが基準資料と一致することを検査（保存されたモデルと描画処理は元のまま）。実際のゲームでは、変形しない資産は従来どおり基準と一致、変形する資産（200GT 系 4 種とモン・カラマリの球形砲 5 種のうち基準資料にあるもの）は uv・idx が基準と一致し、pos は砲身の頂点範囲の中だけが変わっていることを 1 頂点ずつ検査。変形される資産がこの 9 種以外にないことも検査 | 口径 0.45 m 未満のターボレーザーを太くする、モン・カラマリの球形砲の砲身を図面の比に伸ばす | 基準側の結果は未着。失敗は `light_quad200 unchanged pos`（変形した資産の頂点） |

### テストの土台の変更（続き、期待値は変えていない）

| テストファイル | 変更 | 理由 |
| --- | --- | --- |
| gunnery-accuracy.cjs / `profile()`（テスト 6 mixed battery bands… が 140 ≠ 160） | ISD の性能表を写した土台から `gunBandRules`・`ionRules` を消す | 性能表が実際の砲の規則（帯ごとの射程・減衰）を持つようになり、土台が書き換える架空の帯（近距離 20 を 9 km で撃つ）と食い違う。規則のない性能表は帯の射程で撃つ（規則前の性能表と同じ扱い）。期待値 160 はそのまま。残る 2 件の失敗は main と同じ（既存） |
| moncal-weapons-ui.cjs（テスト 4 が `craftLaserHTML is not defined`） | app.js から読む区間に `function craftLaserOptions(` 〜 `function changeCraftLaser(` を追加 | designWeaponPreviewHTML が航空レーザーの円柱設定欄を呼ぶようになった。テスト 5（英語名、`monCalPD name`）は js/lang-en.js の追加で通過 |
| surface-energy-review.cjs / `battle()`（テスト 1・2 が「撃たない」） | CR90 の性能表を写した土台から `gunBandRules`・`ionRules` を消す | 性能表が CR90 の実際のレーザーの規則（射程 1.7〜4 km）を持つようになり、それが目標を探す距離を決めるため、土台の架空の砲台 2 基（規則なし・中射程帯）が 5 km の目標を撃たなくなった。規則のない性能表は帯の射程で撃つ。期待値は変えていない（10/10） |
| small-weapons-ui.cjs（テスト 5 が `craftLaserHTML is not defined`） | app.js から読む区間に `function craftLaserOptions(` 〜 `function changeCraftLaser(` を追加、`st`・`selItem`・`curFit` の代役を追加 | 同上 |
| weapon-support-preview.cjs（7 件が `Real miniature geometry must render`、原因は `craftLaserOptions is not defined`） | app.js から読む関数に craftLaserOptions を追加 | 設置前の砲の下書き（designUIFitDraft）が航空レーザーの円柱設定を持つようになった。期待値は変えていない（8/8） |
| solo-shield-recharge.cjs / `fixture()` | シールド発生器の区画の大きさを 1 m³ → `SHIELD_CURVE.fullGenV`（61,561.1 m³、補正ちょうど 1） | fieldScale が艦でも発生器の容積の曲線を読むようになり、1 m³ では 200 TT のシールドが 0.004 TT になる（2026-11-19 に全長を 1,000 m にしたのと同じ理由）。期待値は変えていない。7 件中 4 件が通過。残る 3 件は下の「疑わしい不具合」4（期待値は変えていない） |

### 疑わしい不具合・判断が要るもの（期待値で隠していない。js/core.js・js/app.js・js/gfx.js・js/engine.js・scripts/ は変更していない）

番号は上の「疑わしい不具合」1・2（解決済み）の続き。

3. **craft-as-ships.cjs テスト 8（X ウイングが止まっている TIE/ln を 10 分で撃墜できない）**。艦隊戦モデル（fleetFire）の命中率が、帯の射程（近距離 9 km）ではなく砲自身の射程で散布を決めるようになった（js/core.js fleetFire の `gunHitChance(u,t,d,reach,control)`、gunDispersion は射程に反比例）。X ウイングのレーザーは射程 2,396 m なので角度の散布が 9,000 ÷ 2,396 = 3.76 倍に広がり、300 m・照準が落ち着く前で TIE への命中率は 0.98%（9 km 基準なら 13%）。加えて 1 発が 6 kt → 136 kt になり（1 発ぶん溜まるまで当たらない：combatResolve の shotAcc）、レーザーガスは 55 秒ぶん（砲が目標を向いていない刻みも減る：core.js 120434 行付近）。実測（seed 1〜8 すべて同じ）：223 刻み（55 s）撃ってガス切れ、TIE に届いた期待値は 1 発の 0.23 倍、損害 0。main では 19 s で撃墜。docs/handoff の交戦の試算（300 m で命中 50%、120 s で 43 発中 6.7 発命中）と合わない。対応案：散布の基準距離を砲の射程と切り離す（航空レーザーは 300 m で 50% など実測に合わせる）、または目標を向いていない刻みではガスを減らさない。テストは変更していない（失敗のまま）。
4. **solo-shield-recharge.cjs テスト 2・3・8（発生器の容積を直した後も残る 3 件）**。SHIELD_MODEL.wear が 0.05 になり、シールドが受け止めた量に対する「上限の減り」（5%）が「シールド自体の減り」（debit 0.25 × (1 − deflectMax 0.82) = 4.5%）を上回った。受け止めた直後からシールドは下がった上限に張り付き、被弾中の再充電では増えない。例：200 TT のシールドを 70% にする被弾（1,333 TT）で上限が 133.3 TT になり、テストの期待（70% + 再充電分 = 153 TT）に届かない（実測 133.37）。テスト 8 は払った再充電の電力（× returnK）より蓄えの増加が 0.0067 TT 少ない（上限で切られた分）。wear の値はユーザーの指示で艦隊戦の時間から決めた値なので、この副作用を受け入れるか（その場合はこの 3 件の期待値を「下がった上限まで」に書き換える）、wear を 4.5% 未満にするかの判断が要る。期待値は変えていない。
5. **fighter-pilot-guns.cjs テスト 2（艦首面・艦尾面・傾いた面に付けた航空レーザー）**。C.fitFrameOf は航空レーザーの向きを常に +X にするが、公試用の砲の記録（js/gfx.js trialTurrets、3787 行 `if(d.fixed)return {pivot:…,axis:C.fitUp(f),fw:fr.fw}` と 3812 行の `fw − axis(fw·axis)`）は取付面の法線を軸にして fw をその面へ射影するため、艦首面・艦尾面（a:0／a:1）では fw が [0,0,0]、傾いた面（tilt [0.3,0.8,0.52]）では [0.954,−0.252,−0.163] になる（上面・下面・舷側は [1,0,0]）。公試では弾の向きがゼロまたは斜めになる。対応案：gfx.js 3787 行で航空レーザー（C.CRAFT_LASER_GEOMETRY[f.k]）は軸に fr.up を使う。テストは変更していない（期待値はもともと C.fitFrameOf の fw）。
6. **turret-rotation-core.cjs テスト 2、turret-rotation-transform.cjs テスト 1（小型旋回砲塔 cturret の向き）**。fitFrameOf の「正面向きだけ」の規則（js/core.js 105169 行）が CRAFT_LASER_GEOMETRY にある cturret にも掛かり、設置時の向き（assetYaw）が効かなくなった（assetYaw 180° でも fw = [1,0,0]）。一方 fitCanRotate('cturret') は true のままで、説明も「後部銃座・上部砲塔」のまま。ユーザーの決定は円柱の航空レーザー（固定砲）を正面向きにだけ置くというもので、旋回砲塔を含むかは書かれていない。対応案：正面向きの枠を固定砲（claser・claserL・claserH）に限る。意図どおりなら fitCanRotate と説明・この 2 テストを直す。テストは変更していない。
7. **weapon-snapshot-migration.cjs テスト 1・2（328 ≠ 327）**。対空の評価値（deriveAntiAir、js/core.js 125555 行）は点防御 2連装（pd）の「旋回 × 門数 ÷ 発射間隔」が 6 になるよう係数を決める。pd の間隔が 0.2 s → 1 s になったため係数が 5 倍（0.636 → 3.18）になり、レーザー以外の砲の対空の評価値が 2〜5 倍に上がった（oct40 0.69 → 2.18、triple40 0.42 → 1.59、single500MT 0.31 → 1.54。pd・monCalPD・single6MT は同じ）。設計機の射撃値（6 + 対空 + 斉射）や区画の大きさに入る。決定にない変化なので、表の旧間隔（gunLegacy.cycle）で評価するなどの対応が要るかの判断が要る。テストは変更していない。
8. **ion-barrel-style.cjs テスト 1（150TT イオン単装球の砲身の先細り）**。砲身を図面の比に伸ばす処理（decodeReference、js/core.js 109975 行付近）は「砲室を出た先の輪を前へ送る」形で、ターボレーザーでは最初の直筒が伸びるが、イオン砲身は砲室を出た所から先細りが始まるので、先細りの区間そのものが 5.39 m → 16.07 m に伸びる（太い根元から砲口まで全体が長い円錐になる）。記録の taperEndXM（9.749）は伸ばす前のままで、描いた形（20.43）と合わない。先細りを保って直筒だけ伸ばすのか、今の形でよいのかは原本照合（reference-fidelity）の判断が要る。テストは変更していない。
9. **fighter-interiors.cjs テスト 12（Z-95 の加速 3,406 G が建造目標 3,330 G を超える）**。Z-95 のレーザーが口径 0.10 m・長さ 1.04 m の円柱になり、質量が容積比で 1 門 1.2 t → 0.152 t になった（js/core.js craftLaserSpec）。機体が 30.81 t → 28.71 t に軽くなり、定格加速が 3,152 G → 3,406 G。テストの上限（目標 × 1.001）は「機関の曲線では目標を超えない」という前提で、砲の質量の変化は想定していない。作例の調整か上限の見直しかの判断が要る。テストは変更していない。
10. **mandator-battery-layout.cjs テスト 2・4**。scripts/mandator-layout-evidence.cjs 92 行の `pdVolley: Math.abs(pdVolleyTT - .00005) < 1e-12`（点防御 500 門 × 100 kt）が旧い値のまま。新しい合計は 160 × pd.tt + 60 × monCalPD.tt = 約 0.00028 TT。scripts/ は今回の編集範囲の外なので変更していない（テスト 1 は tests/ 側で新しい値に直した）。
