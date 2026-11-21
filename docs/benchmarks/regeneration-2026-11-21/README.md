# 作例の再生成（2026-11-21、PR #122）

計算モデルの版 `EXAMPLE_PROFILE_VERSION` を 5 → 6 に上げ、全 47 件を再生成した（`node scripts/refresh-examples.cjs --keys <47 件> --jobs 3`）。最終の再生成はコミット `e3eef22`。この PR で一度入れた「閉じた空洞は船内」の規則と「面の奥行きを隣の構造物へ延ばす」変更は、どちらも取り下げた後の状態。

- 前後比較（基準は #121 のマージ `690d66d`）：
  - `base-690d66d-vs-regenerated.tsv`：質量・加速・旋回・命中・斉射・モジュール数（`node compare.cjs <基準の data/fleet.js> data/fleet.js`）。
  - `all-numbers.txt`：各艦の性能行のすべての数値（`node compare-all.cjs <基準> <新>`。ハッシュ・署名・id は除く）。
- `all-numbers.txt` の比較は、ハッシュ・署名・id の項目だけを名前で除いて、電力系統（`grid`）と軸の容量（`shaft*`）を含むすべての数値を比べる（物理の再レビューで、最初の版の除外条件が `grid` と `shaft*` まで落としていたと指摘されたので直した）。長さの違う配列は、共通する部分も比べる。
- 艦 29 隻のうち 18 隻は、すべての数値が基準と一致。
- imperial、imperial2、mc30c、mc75、mc80home、onager、providenceDn、reptransport、venator は 1〜8 個の数値が相対差 6.5e-15 以下（電力路の長さなどの丸め）。
- 艦以外の作例（機体 18 件など）は設計ファイルだけで、性能行は無い。機体の価格表は `node scripts/update-craft-costs.cjs --check` が通る（12 件、モデル 17）。
- mandator2 は新しいモデル（`docs/benchmarks/mandator2-rebuild-2026-11-21/`）。
- **subjugator**：モジュール 2,173 → 2,146。リパルサーリフト区画の分け方が変わった（「分散リパルサーリフト 3／4」の 55 区画が、「5」の 28 区画になった）。リフトの支持は相対差 3.7e-7、加速・旋回の相対差は 3e-10 以下、兵装・命中・斉射は同じ。設計ファイルは基準から書き換わっているが、この PR の最初の再生成（`ee143b6`）から最終まで同じ内容。原因は未特定（この艦の組み上げは 35〜44 分かかる）。
- 設計ファイルが書き換わった主な理由は、保存形式から部品と武装の「載っている本体」を落としたこと（段階 D）。形・位置・寸法は変えていない。

## 版 7 の再生成（2026-11-21、#122 の次の PR）

`EXAMPLE_PROFILE_VERSION` 6 → 7（区画の切り取りを面をつないで行う `clipCompartmentByMesh`）。この PR のほかの変更（ハッチを区画と外板の重なりで決める・台形の扉を保つ、下面の格納庫 3 隻を外板まで下げる、マンデイター II の砲を面に合わせて傾ける、居住区の廃止、機体の価格表）も含めて、全 47 件を `node scripts/refresh-examples.cjs --jobs 3` で作り直した（63 分、コミット `5932bb8`）。

- 比較の基準：作り直す前の `data/fleet.js`（`2153ee3` で書いたもの。`5b0e157` まで変わっていない）。
  - `v7-vs-v6.tsv`：`node compare.cjs <基準> data/fleet.js`
  - `v7-all-numbers.txt`：`node compare-all.cjs <基準> data/fleet.js`。29 隻のうち全数値一致は mc30c、reptransport の 2 隻。
  - `v7-stats/<key>.txt`：`node stats-diff.cjs <key>`（`5b0e157` の設計と作り直した設計を、同じ現行の計算で比べる。相対差 1e-4 を超える項目）。
- 主な差（質量・定格の加速。ほかの 26 隻は ±0.35% 以内）：
  - venator：質量・加速とも ±0.00%（途中の版で起きた −6% の船体容積は、台形の扉を保つ修正で解消。`docs/benchmarks/hatch-overlap-2026-11-21/README.md`）。
  - recusantDn：質量 +0.65%、加速 +1.64%。慣性補償の支え +1.97%、構造維持の支え −3.32%（`v7-stats/recusantDn.txt`）。部屋の数は慣性補償 167 → 133、構造維持 17 → 82、リパルサー 36 → 9。切り取りが変わって機器の入り方が変わったためと見ているが、**個々の原因は確かめていない**。
  - lucrehulk：開口面積 +54%（312,800 → 481,187 m²。重なりの判定で格納庫の開口が広がった）、発艦の速さ +54%、被弾しやすさ（`vuln`）+12%、構造維持の支え −8.7%。
  - gozanti：価格 −69%（531,841 → 164,344）。リパルサーの区画が 107 個 → 2 個にまとまり、区画ごとの固定費が減った（`costBy.systems` 381,564 → 14,065）。リフトの支え +5%。
  - 区画の数の変化はほかの艦にもある（munificent のリパルサー 53 → 4、慣性補償 52 → 112、deathstar の構造維持 120 → 17 など）。面をつないで切り取ると、細かい断片に分かれなくなるため。
- `node scripts/update-asset-manifest.cjs --check`、`node scripts/update-craft-costs.cjs --check` はどちらも通る。
