# 弾の飛行（段階 2）と Worker の再開：最終の確認（2026-11-28）

## 艦どうしの撃ち合い：発射した弾を最後まで追う

`scripts/shipduel.cjs`：5 seeds。2 隻とも静止した状態で始めるので、発射時の速度は「0＋発射機の向きに 200 m/s」になる。

| 組み合わせ | 基準 790afd4a | 推力の向きの修正前 | 68ae0a06 |
| --- | --- | --- | --- |
| mc75 対 インペリアル級、9 km | 93.1% | 88.1% | 88.1% |
| mandator2 対 インペリアル級、40 km（ミサイル） | 15.6% | 23.1% | 20.8% |
| mandator2 対 インペリアル級、40 km（魚雷） | 15.6% | 0% | 0% |
| providence 対 venator、9 km | 98.8% | 96.2% | 96.4% |
| arquitens 対 cr90、9 km | 100% | 100% | 100% |

- 推力の向きの修正は、静止した艦では効かない（艦の速度が 0 で、推力の向きと速度の向きが一致するため）。この表の差は、ほぼ乱数による。
- mc75 の 93% → 88% は、推力の向きの修正の前から出ていた値で、修正の影響ではない。
- **mandator2 の魚雷が 0% の理由**（`mandator2-torp-why.txt`）：
  - 5 seeds とも、インペリアル級は 104 秒で砲撃によって撃沈された。
  - そのとき、魚雷 72 発はすべて飛行中だった。最も近い魚雷でも 23.3 km 先で、速さは 133 m/s だった。
  - 仕様（発射時は母艦の速度＋200 m/s。魚雷は速度の維持に推進剤を使う）どおりに静止した艦から撃つと、魚雷は 40 km を 3 分以上かけて進む。そのため、砲撃の決着に間に合わない。
  - 変更前は、艦の魚雷を 1,200 m/s で出していた。

## Worker を落としたときの再開（ブラウザ）

`scripts/browser-worker-crash.cjs`。ヘッドレス Chromium、Worker モード、cr90 の下書き。

手順：
1. 編集画面の計算が終わるまで待つ。
2. 設計の更新を受けている Worker を terminate し、error イベントを起こす。

結果（`browser-worker-crash-cr90.json`）：
- 新しい Worker が起動し、設計全体の update が 1 回送られた。その結果、計算待ち（`eng.waiting`）が解けた。
- その後の編集（艦名を変える）も、新しい Worker で計算された。
- 公試は始まり、タイトルには戻らなかった（`browser-worker-crash-trial.png`）。
- ページのエラーは 0 件。コンソールに出たのは、意図して起こした `engine worker failed crash test (out of memory)` の 1 件だけ。

## 作例の性能値は変わっていないか（物理レビュー、2026-11-28）

`tests/example-figures-regression.cjs` は、記録してある基準の値（`tests/helpers/example-figures.json`）が古い。このため、変更前（790afd4a）でもこの版でも、どの作例も一致しない。さらに大きい艦は、時間切れかメモリ不足で止まる。このテストでは、「この変更で性能値が変わっていない」ことを確かめられない。

### 変更前とこの版を直接比べた

- 方法：`scripts/figures-digest-of.cjs` で 40 隻それぞれの性能値の要約を作り、`scripts/figures-digest-compare.cjs` で比べた。
  - 要約は、テストと同じ `buildDesign` → `syncCompartments` → `remount` → `syncCompartments` → `computeStats` → `figuresDigest` で作る。
  - 作ったのは、変更前（790afd4a）とこの版（8eaccd62）の両方。
- 結果（`figures-790afd4a-vs-8eaccd62.tsv`）：40 隻すべて同じ（`figuresDiff` が空）。
- 計算の時間：デススター級とマンデイター II 級は各 25〜30 分かかった。大きい艦は、1 隻ずつ 11 GB のヒープで計算した。

### 同梱した計算済みの数字

- 方法：`scripts/prepared-vs-computed.cjs` で、表面の区画を持つ 29 隻すべてを確かめた。
  - Worker が計算済みの数字を読めないようにして計算させ（`profileSrc: computed`）、その結果を同梱の数字と全項目で比べた。
- 結果（`prepared-vs-computed-all.jsonl`）：29 隻すべてで、数値の相対差の最大は 0、数値以外の差は 0。
