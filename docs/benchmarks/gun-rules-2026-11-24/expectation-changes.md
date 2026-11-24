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
