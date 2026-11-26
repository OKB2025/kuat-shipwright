# テストの期待値の変更記録（2026-11-25、機体レーザーの式・ノズル・ガスの単位・点防御砲・機体の作り直し）

- 対象の木：ブランチ `claude/inspiring-faraday-kn13yq`、`dfbb136c`（未コミットの `tests/*.cjs` の変更）。
- 比較の基準：変更前 `ab1dc78`（`../evidence-2026-11-25/tests-candidate-ab1dc78.tsv`）。途中の時点 `168700c`（機体レーザーの式を変える前）の全テストの結果とも比べた。
- 変更したのは `tests/*.cjs` とこの記録だけ。`js/`・`data/`・`scripts/`・`index.html` は変えていない。skip・削除・許容差の拡大はしていない。
- 根拠の原文は同じフォルダの `README.md`。各テストの変更箇所には `2026-11-25 expectation changed …` または `2026-11-25 fixture changed …` のコメントで、根拠と旧値を書いた。
- 実行は 1 本ずつ `timeout <秒> node --test tests/<名前>.cjs`（全作例の作り直しが同時に動いていた）。

## 根拠にした決定

| 記号 | 決定（ユーザーの言葉） | 値の変わり方 |
| --- | --- | --- |
| 1 | 「では0.3を800kt、0.05を50ktと扱い0.02まで口径を指定できるように」「面積比例で」「800ktで上限をつけるとは言ってない」 | 機体レーザーの 1 発：`C.laserShotKt(口径)` → `C.craftLaserKt(口径) = 50 + 750×(口径² − 0.05²)÷(0.30² − 0.05²)`。0.17 m 118.28 → 276.29 kt、0.12 m 42.88 → 152 kt、0.30 m 436 → 800 kt、0.40 m は 1,400 kt。艦のレーザー（`C.laserShotKt`）は変わらない |
| 2 | 「ノズルそのままは発射速度を上げられるが上げるほど命中率は下がるしガスも使う」 | 当たるエネルギー（`C.craftLaserRate`、`energy.gun`）は、毎秒 1 発を超える分に `hitK = 1/√(毎秒の発射数)` を掛ける。0.25 秒間隔は 4 × 0.5 = 2 倍 |
| 3 | （1 に伴う実装の決め）ガスの「レーザー 1 単位」は式が変わる前の標準 118.28 kt/秒に固定（`C.CRAFT_LASER_UNIT_KT`、`C.CRAFT_LASER_UNIT_W`、`C.LASER_GAS_TT_M3 = 3000 × 118.28e-9`） | `laserUnits` = 出力 ÷ 118.28 kt/秒。中レーザー 1 門・毎秒 1 発は 1 → 2.336 単位 |
| 4 | 「Xウィング型のアンテナっぽいノズルをつけるとロックオン標的に対して数度動いて当てれるようになる」「複数設置してある同じ射撃速度のレーザーは端から順に射撃していくように」 | `js/app.js` に `trialTrackBolt`・`trialPilotFiringOrder`・`gunFiringSequence` が増えた（テストの土台：抜き出す関数を足す） |
| A | 「点防御は1門0.1で約15秒間持続射撃でき、その後リチャージに30秒で」「カートリッジごと交換してる」 | 点防御砲（`pd`、`monCalPD`）の `cycle` 1 → 0.3 秒（平均）、`power` 3.33 倍、`gunRule` に `fireS` 0.1・`burstS` 15・`rechargeS` 30・`burstVolleys` 150。公試では 0.1 秒ごとに撃つ。1 発の威力は同じ |
| B | 「0.1秒で15秒間射撃できる量の発射ガス区画を作って」 | 点防御砲は `C.needsCapacitor` が true、充電の行が出る。ガスの容積は `pd` 0.676 m³、`monCalPD` 0.169 m³（砲塔の中に収まる）。溝の砲列の充電区画の列に加わる。点防御でない艦のレーザーは区画なしのまま |
| C | 「航空機はこっちで作り直す」 | 機体の作例はユーザーの 16 機の設計（`docs/handoff-2026-11-20/refs/aircraft-refit-16-specs-2026-11-25.csv`） |

## 期待値を変えたもの

| ファイル | テスト | 旧 → 新 | 決定 |
| --- | --- | --- | --- |
| `craft-laser-output` | 1「aircraft laser classes carry the shot of their bore…」 | 級の 1 発 `C.laserShotKt(口径)`（重 436・中 118.28・軽 42.88 kt）→ `C.craftLaserKt(口径)`（800・276.29・152 kt）。`near(…medium,118.28)` → 276.29。式そのもの（0.05 m 50 kt、0.30 m 800 kt、0.40 m 1,400 kt、0.02 m で下げ止まり）と、艦の式が 0.17 m で 118.28 kt のままであることの確認を足した | 1 |
| 同 | 2・7・8（共通の `shotTT`） | `shotTT = C.laserShotKt(口径)` → `C.craftLaserKt(口径)`。8 の文言「118 kt」→「276 kt」 | 1 |
| 同 | 3「a craft type sums every laser barrel…」 | X ウイング `4×laserShotKt(.18)` → `4×craftLaserKt(.18)`、Z-95 `2×laserShotKt(.10)` → `2×craftLaserKt(.10)`、ARC-170 の 0.20 m も同じ。0.25 秒間隔の機体（TIE/ln・ARC-170・V ウイング、全機の合計の式）に `hitK = 0.5` を掛けた（TIE/ln 946 → 1105 kt/秒）。**規則だけ直した。機体ごとの口径・門数・連射は保存済みの価格表から読むので、作り直し待ち（下）** | 1・2 |
| 同 | 4「fleet profile per-craft air attack…」 | TIE/ln `2×118.28×4` = 946 kt/秒 → `2×276.29×4×0.5` = 1105 kt/秒（同じく価格表に依存） | 1・2 |
| 同 | 10「a version-1 design craft snapshot…」 | `laserUnits` 8（= 2 門 × 4 発/秒）→ `2×4×276.29÷118.28` = 18.69。`CRAFT_LASER_UNIT_KT` = 118.28 の確認を足した（`C.buildDesign('craft_tie_ln')` でその場で組む） | 1・3 |
| `fighter-pilot-guns` | 3「each pilot pulse is the shot of its bore…」 | 1 発 `C.laserShotKt(0.17)` 118.28 kt → `C.craftLaserKt(0.17)` 276.29 kt | 1 |
| `cturret-aa-trial` | 2「changing the turret's rate of fire…」 | 1 発 `C.laserShotKt(0.12)` 42.88 kt → `C.craftLaserKt(0.12)` 152 kt | 1 |
| `small-weapons-ui` | 4「dedicated PD and aircraft cards…」 | 表示：`claser` 118.28 kt → 276.29 kt、`claserH` 436 kt → 800 kt、`cturret` 1 砲身 42.88 kt・一斉射 85.76 kt → 152 kt・304 kt。口径との照合は機体だけ `C.craftLaserKt` に。`pd`・`monCalPD` は変えていない | 1 |
| `weapon-shot-calibration` | 2「aircraft lasers fire their per-barrel…」 | 1 発 `C.laserShotKt(口径)` → `C.craftLaserKt(口径)`（276.29・800・152 kt） | 1 |
| 同 | 1（共通の `shot`） | 値は同じ `3000 × 118.28e-9`。文言「3000 s of one 0.17 m laser a cubic metre」→「3000 s of one laser-gas unit a cubic metre」、`CRAFT_LASER_UNIT_KT` = 118.28 の確認を足した | 3 |
| `dual-purpose-weapons` | 15「a twin gun in rapid fire keeps barrels ÷ cycle shots a second…」 | 10 秒の発射数 `2 ÷ cycle × 10`（約 66）→ `2 ÷ fireS(0.1) × 10`（約 198。実測 199） | A |
| 同 | 16「after a second without energy a rapid-fire gun resumes one barrel at a time」 | 4 砲身で 1 フレーム（1/30 秒）の発射数「1 以下」→「2 以下かつ 4 未満」（0.1 秒 ÷ 4 = 0.025 秒ごとで定常 1.33 発/フレーム。実測 2,1,1,2,…）。10 フレームの合計が定常の数を超えない確認を足した。「止まっていた分をまとめて撃たない」という検査の意味は同じ | A |
| `moncal-weapons-core` | 1「new catalog ratings preserve per-barrel energy…」 | `monCalPD`・`pd` の `cycle` 1 → 0.3 秒（`0.1×(15+30)÷15`）。`gunRule` の `fireS`・`burstS`・`rechargeS`・`burstVolleys`（150）の確認を足した | A |
| 同 | 3「charging is backed by closed physical rooms…; a laser has none」 | `pd`：`needsCapacitor` false → true、充電の行 なし → あり（必要容積 0.676 m³、砲塔の中に収まる）。充電部品が増えないのは同じ。`twin6MT` は区画なしの確認を足した | B |
| `ship-engineering-pass` | 2「capital engineering enters the shared surface model once…」 | `needsCapacitor({k:'pd'})` false → true（土台の前提の確認。土台の砲 `quad200` と期待値は同じ） | B |
| `trench-armament-dreadnoughts` | 1・2（executor、mandator2） | 充電区画の列が持つ砲の種類 1（ターボレーザーだけ）→ 2（`pd` と `utl`）。貯蔵量の照合：「列の容積 × `CHARGE_TT_M3`」→「種類ごとの容積 × それぞれの密度（ガスは `LASER_GAS_TT_M3`）」（executor：288000.24 TT、旧式は 288033.8） | B |
| `example-point-defense-stations` | 2・4（mc30c、munificent）「PD lasers carry no feed compartment…」→ 題を「…carry a firing-gas compartment inside the gunhouse with a charging entry, and no charging part」に | 点防御砲ごとに `needsCapacitor` false → true、充電の割り当て・行 なし → あり（`pd` 0.676 m³、`monCalPD` 0.169 m³）。充電部品なしは同じ。「区画を持つ砲にレーザーは無い」→「区画を持つレーザーは点防御だけ」 | A・B |
| `moncal-reference-armament` | 3・6（mc80home、mc80liberty）「…and none for its lasers」 | `monCalPD`：`needsCapacitor` false → true、充電の行 なし → あり（満充填、貯蔵 = 一斉射 × 150） | B |
| `named-example-armament` | 4・5・6（Venator、Nebulon B、Acclamator。共通の `verify`） | 点防御レーザー：`needsCapacitor` false → true、充電の行 なし → あり（満充填、貯蔵 = 一斉射 × 150、容積 = 15 秒分のガス）。充電部品なしは同じ。点防御でないレーザーは今までどおり | A・B |
| `weapon-snapshot-migration` | 1・2 | `craft.gun` 328 → 327、`oct40.aa` 2.179405854 → 0.653821756（対空の係数は点防御砲の `旋回 × 砲身 ÷ cycle = 6` で決めているので、`cycle` 1 → 0.3 秒で 0.3 倍） | A |
| `fighter-interiors` | 8・10・12（craft_v19、craft_vwing、craft_z95） | `landingReady` false → true（作り直した 3 機は着陸装置が足りている。全機 true） | C |

## 土台（fixture）を変えたもの（期待値は同じ）

| ファイル | 変更 | 決定 |
| --- | --- | --- |
| `capital-turret-trial`、`cturret-aa-trial`、`dual-purpose-weapons`、`fighter-pilot-damage`、`fighter-pilot-guns`、`heavy-laser-aa-trial`、`trial-craft-systems`、`trench-armament-manual-fire`、`trial-manual-threat-targeting` | `js/app.js` から抜き出す範囲に `trialTrackBolt`・`trialPilotFiringOrder`・`gunFiringSequence` を足した（`trialTrackBolt is not defined` の解消）。最後の 2 本は変更前から別の理由（`trialSystemsUnit is not defined`）で落ちていて、失敗の数は変更前と同じ | 4 |
| `coruscant-trial-start` | `trialReset` と一緒に `trialPilotFiringOrder`・`gunFiringSequence` を抜き出す | 4 |
| `fighter-pilot-guns` | 土台の機体の `laserUnits` 1 → `FITS.claser.power ÷ CRAFT_LASER_UNIT_W`（2.336。「中レーザー 1 門・毎秒 1 発の機体」という意味は同じ）。4 番のテストの手持ちの電力 1e-5 → 1e-4 TT（276.29 kt × 80 発 = 2.2e-5 TT が 1e-5 TT に収まらない） | 1・3 |
| `fighter-pilot-damage` | 土台の機体の `laserUnits` 1 → 2.336、手持ちの電力 1e-5 → 1e-4 TT（重レーザー 800 kt × 25 発 = 2e-5 TT とガス 169 秒分が、1e-5 TT・100 秒分に収まらず 12 発で止まっていた） | 1・3 |
| `trial-craft-systems` | 土台の機体の `laserUnits` 2 → `2 × FITS.claser.power ÷ CRAFT_LASER_UNIT_W`（4.67。「中レーザー 2 門の機体」）。旧値では 1 発が手持ちのガス 1 秒分を超えて撃てなかった | 3 |

## 期待値を変えなかった失敗（決定で説明できない、または規則の検査）

| ファイル | テスト | 内容 |
| --- | --- | --- |
| `craft-laser-output` | 6「fleet battle craft attack scales with the per-craft laser output…」 | `craft damage is proportional to airGun: 2.279779296006968`（許容 1%）。機体の 1 発（`FLEET_AIR_GUN_BOLT`）が 118 → 276 kt になり、試験の 2 点（毎秒 1 発と 2 発）が CR90 の受ける損害の非線形な範囲に入った。エネルギーあたりの損害：0.4〜1.5 発/秒で 0.341〜0.349、2 発/秒で 0.394、4 発/秒で 0.475。1% に収まる 2 点が無いので、許容差を広げずに残した |
| `fighter-interiors` | 9（craft_vulture） | `curve B cannot lift craft_vulture above its flat-5% construction target: 3900.0069828105443 > 3600`。ユーザーの設計は 3,900 G、建造目標 `C.CRAFT_INTERIOR_TARGETS.craft_vulture.g` は 3,600 G。規則の検査なので変えていない |
| `tie-ln-reactor-calibration` | 3「saved custom larger reactors … gain actual acceleration」 | `the new factory calibration is not a runtime G cap`。作り直した TIE/ln は、反応炉を 2% 大きくすると定格加速度が 4000.04 → 3991.48 G に下がる（質量 15.155 → 15.184 t。機関の定格入力は増えない）。「大きい反応炉は加速度が上がる」という検査なので変えていない。1・2 は変更前から失敗 |
| `craft-example-systems` | 3「the same opt-in installer supports a user copy without a reference flag and is idempotent」 | `User interceptor：レーザーガス供給槽 2 の設置場所がありません`（`C.installCraftSystems`、js/core.js:118578）。A ウイングの写しに標準の装備を入れ直す検査。A ウイングは 0.12 m × 2 門・0.1 秒間隔で、レーザーの単位が `2×10×42.88÷118.28` = 7.25 → `2×10×152÷118.28` = 25.7 になり、ガス槽の容積が 3.5 倍になって機内に置けない。`168700c` では合格していた。期待値は変えていない |
| `catalogue-reference-speed-ui` | 5「current example notes translate nozzle ownership…」 | `craft_tie_ln` の作例の説明文（2026-11-25 の新しい文）の英訳が `js/lang-en.js` に無く、日本語のまま返る。訳の登録漏れ（実装側） |

## 作り直し待ちで確定していないもの

| ファイル | テスト | 理由 |
| --- | --- | --- |
| `craft-laser-output` | 3・4・9 | 機体ごとの口径・門数・連射を `C.CRAFT_PRICE_CATALOG`（保存済みの価格表）から読む。規則（式と `hitK`）だけ直して今の価格表で合格しているが、作り直しのあと機体ごとの行（例：V ウイングは 0.12 m × 4 門の設計）を確かめ直す |
| `reference-sublight-speeds` | 7「built-in reference speed overlays preserve the catalogue…」 | 価格表の `powerProfile.grid.De` が今の Core の計算と合わない（2103402416338782700 と 2154992084400223200）。触っていない。9 は変更前から失敗 |
| `lowered-bays-capacity` | 2（onager） | `data/examples/onager/design.json.gz` を読む。`storage 0`。触っていない |
| `craft-cost-parity` | 全体 | 価格表に依存。変更前でも 479 秒かかり、2 分の打ち切りでは走らない |

## 直したあとの結果（終了コード/合格/失敗。1 本ずつ実行、全作例の作り直しと同時）

| テスト | 変更前 `ab1dc78` | `168700c` | 今 | 残っている失敗 |
| --- | --- | --- | --- | --- |
| `capital-turret-trial` | 0/6/0 | 0/6/0 | 0/6/0 | |
| `coruscant-trial-start` | 0/2/0 | 1/0/2 | 0/2/0 | |
| `craft-laser-output` | 0/10/0 | 0/10/0 | 1/9/1 | 6（上の表） |
| `cturret-aa-trial` | 0/4/0 | 0/4/0 | 0/4/0 | |
| `dual-purpose-weapons` | 0/16/0 | 1/14/2 | 0/16/0 | |
| `fighter-pilot-damage` | 0/3/0 | 0/3/0 | 0/3/0 | |
| `fighter-pilot-guns` | 0/9/0 | 0/9/0 | 0/9/0 | |
| `heavy-laser-aa-trial` | 0/4/0 | 0/4/0 | 0/4/0 | |
| `moncal-weapons-core` | 0/5/0 | 1/3/2 | 0/5/0 | |
| `ship-engineering-pass` | 0/2/0 | 1/1/1 | 0/2/0 | |
| `small-weapons-ui` | 0/5/0 | 0/5/0 | 0/5/0 | |
| `trench-armament-dreadnoughts` | 0/2/0 | 1/0/2 | 0/2/0 | |
| `trial-craft-systems` | 0/8/0 | 0/8/0 | 0/8/0 | |
| `weapon-shot-calibration` | 0/9/0 | 0/9/0 | 0/9/0 | |
| `weapon-snapshot-migration` | 1/4/3 | 1/2/5 | 1/4/3 | 5・6・7（変更前から） |
| `trench-armament-manual-fire` | 1/1/3 | 1/1/3 | 1/1/3 | 変更前から（`trialSystemsUnit is not defined`） |
| `trial-manual-threat-targeting` | 1/2/12 | 1/2/12 | 1/2/12 | 変更前から（同上） |
| `example-point-defense-stations` | 1/3/1 | 1/1/3 | 1/3/1（46 秒） | 3（munificent の点防御 14 !== 38、変更前から） |
| `moncal-reference-armament` | 0/6/0 | 1/4/2 | 0/6/0（91 秒） | |
| `named-example-armament` | 1/5/1 | 1/2/4 | 1/5/1（264 秒） | 3（ISD `1050 != 350`、変更前から） |
| `fighter-interiors` | 1/13/1 | 1/10/4 | 1/13/1（182 秒） | 9（craft_vulture。変更前の 1 件は craft_z95 で、それは解消） |
| `tie-ln-reactor-calibration` | 1/1/2 | 1/0/3 | 1/0/3 | 1・2（変更前から）、3（上の表） |
| `catalogue-reference-speed-ui` | 0/5/0 | 1/4/1 | 1/4/1 | 5（上の表） |
| `reference-sublight-speeds` | 1/9/1 | 1/8/2 | 1/8/2 | 7（作り直し待ち）、9（変更前から） |
| `craft-example-systems` | 0/3/0 | 0/3/0 | 1/2/1 | 3（上の表） |
| `strategic-ai` | 0/7/0（447 秒） | 時間切れ | 0/7/0（463 秒、1 本だけで実行） | |

走らせていないもの：`craft-cost-parity`（2 分で打ち切り。変更前 479 秒）、`fleet-loadout-separation`・`example-figures-regression`（変更前から 700 秒で時間切れ）、`hull-outer-surface-contact`（変更前 521 秒で失敗 1 件、`168700c` は 900 秒で時間切れ）、`lowered-bays-capacity`（作り直し待ちのため走らせ直していない。`168700c` の記録は 1/1/1）。

## 2026-11-26 に足したぶん（ガス交換・カートリッジ・弾の寸法・ラピッドファイア砲の砲身）

砲・弾に関係するテスト 54 本を `8c452d6` の手前で 1 本ずつ実行し（作例は作り直す前）、前回（`tests-d95d6d6.tsv`）は通っていて今回落ちた 9 本を切り分けた。

| テスト | 旧 | 新 | 根拠 |
| --- | --- | --- | --- |
| `light-turret-family` | 上下 2 連装速射の `chargeRateTT` ＝ 高角 2 連装と同じ（0.1698 TT/秒） | 充電中の速さ（`chargeRatePeakTT`）が同じ。平均（`chargeRateTT`）は速射のほうが低い（0.0981）。カートリッジ 40 発 | 「1発ごとに基本は交換／充電にプラスする形で／速射砲系はカートリッジ」「200GT縦2連も速射砲」 |
| `weapon-shot-calibration` | ターボレーザーの `chargeRateTT` ＝ 給電の速さの式 | `chargeRatePeakTT` ＝ 同じ式。`chargeRateTT × cycle` ＝ 砲身数 × 1 発の充電 | 同上（平均と充電中を分けた） |
| `ion-power-cut` | 魚雷 0.0895／ミサイル 0.0471／爆弾 0.1885 TT、表の寸法は旧（長さ 1.3 m 以下・0.2 t 未満） | 0.000725／0.000153／0.000424 TT、表の寸法・質量は弾そのもの | 「ミサイルを0.12×0.9 魚雷を0.18×1 爆弾は0.3の球」「弾の寸法は威力も変える」 |
| `missile-launcher-geometry` | ミサイル 0.0471 TT（1 m × 4 m） | 0.000153 TT（0.12 m × 0.9 m） | 同上 |
| `missile-seekers-torpedo-flight` | Y ウイングの爆弾 16 発 | 64 発 | 「爆弾倉の数は増える／爆弾倉のサイズによる」 |
| `point-defense-minimum-render` | 作り替える型は 9 つ。作り替え関数を署名の全文で探す | ラピッドファイア砲を加えて 10。関数は名前と引数の終わりで探す（検査コードの変更） | 「1TTのラビット砲は砲身を今の1/2に」 |

期待値ではなく実装を直したもの：

- `moncal-turret-models`・`authored-render-budget`：砲身を縮めたラピッドファイア砲で、砲口のくぼみの記録（`muzzleRecessM`）が元の深さのままだった（描いた形は 2.35 → 1.41 m）。記録を描いた形に合わせた（`reshapeGunBarrels`）。

古い生成物が原因で、作り直しのあとに確かめるもの：

- `craft-as-ships`（点防御が機体に当たらない）：`data/fleet.js` の性能表の版が古いと、自動防御用の読み替えで点防御が外れる（`automaticDefenseProfile`）。
- `lowered-bays-capacity`（オナガー級の収容 0 機）：点防御に新しく付いたコンデンサーが、作り直す前の保存設計では格納庫の位置（479, 61, ±174）に置かれて「重なり」になる。Worker と同じ読み込み順（`remount` → `syncCompartments`）では 18 機。
- `placement-early-pick` は単独で実行すると 12 本とも通った（前回の失敗は再現せず）。

## 2026-11-26 に足したぶん（レーザー砲の統合・中空の筒・B ウイングの作例）

レーザーに関係するテスト 50 本を実行し、前回（`tests-d95d6d6.tsv`）より悪くなった 4 本を直した。ほかに落ちた 19 本は前回と同じ本数で、今回は触っていない。

| テスト | 旧 | 新 | 根拠 |
| --- | --- | --- | --- |
| `craft-cost-parity` | 口径を持たない固定レーザーの価格＝型の 400 | 既定の筒（0.102 m × 1 m）の価格 237.2（取付費は同じ） | 「口径 ÷ 0.75の筒の体積から口径分の体積を除く」。価格の決め方を残したのはこちらの判断 |
| `craft-seats-feed-navigation` | 浅く沈める量 0.1 m | 0.05 m（本体が 0.32 → 0.136 m になり、0.1 m 沈めると発射口が埋まる） | 同上 |
| `craft-laser-output` | 作例を持たない機種の見積もりを B ウイングで確認 | U ウイングで、RTS 側だけ確認（残る機種は輸送機で艦隊戦に出ない）。B ウイングは作例のある機種として確認 | B ウイングがユーザーの設計で作例になった |
| `weapon-snapshot-migration` 1・2 | `craft.gun` 327、`oct40.aa` 0.653821756 | 326、0.211971605（8 連装の周期にガス交換が入り 4.885 秒） | 「1発ごとに基本は交換／充電にプラスする形で」。同テストの 5・6・7 は変更前から失敗 |

## 2026-11-26：全テスト（`bc8d85a6` の木、575 本）と切り分け

結果は `tests-bc8d85a6.tsv`（名前・終了コード・通過数・失敗数・秒）。失敗 173 本（`d95d6d6` のとき 168 本）。`d95d6d6` より悪くなったのは 11 本で、次のとおり切り分けた（空中戦と熱・機関の 8 件は補助エージェントが原因を調べ、こちらで統合した。補助エージェントは未コミットの `js/core.js` を読んでいる）。

実装を直したもの：

| テスト | 原因 | 直し方 |
| --- | --- | --- |
| `craft-laser-open-muzzle` 1・3 | 筒の規則より前の保存（2026-11-23 の TIE/in・TIE/D）で、沈めた顎の砲が浮いた。本体が 0.32 → 0.136 m に細くなり砲の軸が下がったことと、長さを持たない砲の本体が 2.6 → 1 m になり砲口が船体の中に入ったことの 2 つ | 長さを持たない砲は型の本体の長さ 2.6 m を保つ（`craftLaserSpec`）。これで砲口が外に出て取り付く。（読み込み時に沈みを戻す処理も一度入れたが、その時点では沈み量がまだ読み込まれておらず働いていなかったので外した。古い保存の砲の軸は、本体が細くなったぶん下がる） |
| `stray-fire-craft` 3 | 弾の威力を下げた（ミサイル 0.047 → 0.000153 TT）結果、制圧役のミサイル 12 発ではセンサーが止まらず（追跡 0.985 が残る）、弾を撃ち尽くした制圧役が生きている間じゅう爆撃隊が 45 km で待ち続けた（渡った機体 8 → 2） | 制圧役に撃つ弾が残っていなければ爆撃隊を出す（空の指揮の待ち条件） |

期待値・検査コードを変えたもの：

| テスト | 旧 | 新 | 根拠 |
| --- | --- | --- | --- |
| `craft-cost-parity` | 既定のレーザーの価格 237.2（同日の先の変更） | 382.5（長さを持たない砲は型の 2.6 m） | 上の直しに伴う |
| `example-saved-designs` 8・`tie-ln-solar-wing` 6 | 作例を持たない機種として B ウイングを使う | U ウイング | B ウイングが作例になった |
| `reference-sublight-speeds` 7 | 価格表 13 件 | 15 件（B ウイング、トライファイター） | 同上 |
| `lowered-bays-capacity` | 保存設計を読むだけで性能を出す | ゲームと同じ順（砲を乗せてから区画を導出）で読む。読むだけだと点防御の新しい発射ガス区画が格納庫の位置に出て、オナガー級の収容が 0 になる（ゲームの順では 18） | 「区画より先に砲を乗せる形にして」、点防御の発射ガス区画 |

失敗のまま残すもの（理由つき）：

| テスト | 状態 | 理由 |
| --- | --- | --- |
| `fighter-interiors`（8 件） | この PR の変更による | 砲が軽くなり、機体の加速度が建造目標の +5% を超える（A ウイング 5,319 > 5,100 など）。ユーザー「航空機の口径や性能が変わるのは許容」「次のPRのタイミングで性能を作り直した航空機を渡す」。次の PR で機体が入れ替わるまで失敗のまま |
| `fighter-air-superiority` 8 | この PR の変更で表に出た既存の不具合 | X ウイングが 35.6 → 29.7 t になり表の速度が 1,733 → 2,126 m/s、判定の「半分」が 867 → 1,063 m/s に上がった。一方、船体の下側から入る攻撃で、床に当たったときに縦の速度をゼロにする処理（`js/core.js` の RTS の編隊の更新）のため掃射の速度が 891 → 733 m/s に落ちる。直すなら速度を進行方向へ向け直す。未修正（次の PR で機体と一緒に扱う） |
| `fleet-air-restraint` 10 | この PR の変更による。**ユーザーの確認待ち** | 爆弾を 0.3 m の球にして数を爆弾倉の大きさで決めた結果、TIE ボマーは 588 発（約 249 GT）、Y ウイングは 64 発を積む。1 機あたりの攻撃の重さは反乱側 0.010・帝国側 0.063 TT で、「積み荷で先攻を決める」と帝国側が先に攻撃に出る（テストは反乱側が重いことを期待） |
| `craft-pylons-bomb-bay` 1 | この PR の変更による。**ユーザーの確認待ち** | パイロン 1 基の魚雷が 3 → 6 発（弾が小さくなったため）。パイロンの数を大きさで決めてよいかは未確認 |
| `heat-running` 5 | この PR の変更による（ガス交換） | 砲の平均の給電が下がり（MC80 の砲の要求 7.0 → 2.2 倍）、被弾の熱で絞る効果が 10% → 5.7% になった。規則どおりの動きで、しきい値 0.9 が古い。期待値の変更は物理レビューの後に行う |
| `reference-sublight-speeds` 4 | この PR の変更による（弾の寸法） | 魚雷の質量が 0.12 → 0.0254 t になり、テストが丸めた値（0.051 t）から計算し直す速度と 1e-5 ずれる。テスト側の計算の丸めの問題 |
| `fleet-air-restraint` 4・13、`mandator-example-refit` 2・5、`reference-sublight-speeds` 9、`tie-ln-solar-wing` 5 | 変更前（`d95d6d6`、main）から同じ失敗 | 今回は触っていない |

## 2026-11-26：修正後の全テスト（575 本）

結果は `tests-final-2026-11-26.tsv`。作例を作り直した後の木で実行（生成物の検査 3 つ＝マニフェスト、作例ファイルと性能表、機体の価格表は通過）。失敗 169 本（前回の実行 173 本、`d95d6d6` 168 本）。

- `d95d6d6` より悪いのは 7 本で、すべて上の表の「失敗のまま残すもの」：`fighter-interiors`（8 件）、`fighter-air-superiority` 8、`fleet-air-restraint` 10（4・13 は変更前から）、`craft-pylons-bomb-bay` 1、`heat-running` 5、`reference-sublight-speeds` 4（9 は変更前から）、`mandator-example-refit` 2・5（main でも同じ値で失敗。`d95d6d6` では別の形で失敗していた）。
- 前回の実行より悪くなったものは無い。
- `d95d6d6` では失敗していて今回通ったもの：`fleet-loadout-separation`、`lowered-bays-capacity`、`placement-early-pick`。
- 作り直した生成物（`data/examples`、`data/fleet.js`、マニフェスト）は、記録のコミットに一緒に入った（作り直しの完了後、`git add -A` で拾われたため。専用のコミットにはなっていない）。
