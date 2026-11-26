# 期待値を変えたテスト（PR #128）

基準は PR #127 の最終結果（`docs/benchmarks/gun-rules-2026-11-24/followup-2026-11-25/tests-final-2026-11-26.tsv`、575 本・失敗 169）。
全テスト（581 本）の結果は `tests-full-2026-11-26.tsv`（列：名前、終了コード、通過、失敗、秒）。この全実行のあとで直した 17 本と関係する 8 本の再実行は `tests-rerun-25-2026-11-26.tsv`。

## 全テストの結果

- 全実行（生成物の作り直しの直後）：失敗 182 本。基準より悪くなったもの 17 本、良くなったもの 3 本（`craft-pylons-bomb-bay`、`hull-outer-surface-contact`、`ship-repulsorlift`）、新しいテスト 6 本（すべて通過）。
- 17 本のうち 2 本は実際の不具合で、直した：
  - `fleet-commit-twice`：同じ計画を 2 回確定すると結果が変わった。溜まったイオン（`ionSt`）と弾の端数（`roundAcc`）が計画の写しに含まれず、元の計画の値が動いていた（`combatClone`）。
  - `structure-refusal-recheck-worker`：Worker の質量が通常の読み込みより大きかった。Worker が受け取った状態から廃止部品（リパルサーリフト）を取り除いていなかった（`js/engine.js` の `applyState`）。
- 14 本は、ユーザーの決定で規則が変わったことによる期待値の変更（下の表）。
- 1 本（`fighter-interiors`）は悪化のまま残した：機体が軽くなり（降着装置が無くなった）、建造目標の加速度を超える機体が 8 機から 9 機に増えた。機体の作例の作り直し（ユーザーが行う）で解消する。期待値は変えていない。
- 再実行した 25 本は、`fighter-interiors` を除いて基準と同じか、基準より良い。
- **全実行のあとに core・engine を直しているので、直したあとの状態での全テストはやり直していない。** 直したのは戦闘の状態の写しと射撃の記録だけで、設計の数字には触れていない（`example-files.cjs --check` は通過）。

## 期待値を変えたテスト

| テスト | 変えたもの（前 → 後） | 理由 |
| --- | --- | --- |
| `ship-repulsorlift` | 全面的に書き直し（作例の艦が質量ぶんの区画を持つ・区画が重ならない・船体の中にある・保存で戻る → 部品が無い・質量に合わせて質量と価格と電力が足される・保存の部品は読み込みで取り除かれる） | リパルサーリフトを部品にしない（ユーザー 2026-11-26） |
| `equipment-taxonomy` | 3 件を 1 件に置き換え（降着装置 300 t/m³・リパルサー 70 t/m³・印付きで両方 → 読み込みで取り除かれ、質量どおりに支えられる）。置き換えの選択肢に降着装置が出る → 出ない | 同上 |
| `design-placement-catalog-ui` | 降着装置が一覧に出て選べる → 出ない。支援の一覧にリパルサーがある → 無い（慣性制御はある） | 同上 |
| `craft-systems-localization` | 不足の警告 7 件 → 6 件 | 同上（支持質量の不足が無くなった） |
| `craft-systems-core` | 装置の電力の差＝部品の電力 → ＋リパルサーリフトの自動の電力の差（許容 1e-12 → 1e-9） | 同上 |
| `craft-systems-ui` | 表示に支持質量の値を足した | 同上 |
| `structure-sunk-interior-interference` | 保存データの 6 個のリパルサーを、同じ形の別の内部装置（慣性制御）として読む | 同上（読み込みで取り除かれるため。確かめる規則は同じ） |
| `gr75-user-remodel` | 部品 77 個 → 75 個（リパルサーリフト 2 個を除く） | 同上 |
| `structure-material-core`・`structure-overlap-review`・`structure-face-armor-core`・`engine-mount-support`・`turret-slope-support-core` | 質量の比較で、リパルサーリフトの自動のぶん（`S.repulsorlift.mass`）を除いて比べる。価格は自動のぶんを足して比べる | 同上（質量が 1 ÷ (1 − 0.0012833) 倍になる） |
| `structure-copy-placement`・`hull-structure`・`structure-material-core` | 写し n 個の価格＝1 個の n 倍 → n 倍 − 取付費 3,500 ×（n − 1） | 同上（取付費は設計ごとに 1 回） |
| `ion-power-cut` | 4 件を削除し 1 件に置き換え（給電の 1/3 が熱に変わる → その関数が無いこと） | イオン系の置き換え（ユーザー 2026-11-25〜26） |
| `surface-energy-ion` | 2 TT が全部その場で熱・機材は無傷 → その場の熱＋溜まった分＝ 2 TT、抜け終わると熱は 2 TT、止まった機材は時間で戻る | 同上 |
| `surface-energy-review`・`surface-query-performance` | イオンの記録の範囲 `'heat'` → `'parts'` | 同上 |
| `shield-deflection` | ソースの照合の式（イオン弾の処理の呼び出し方） | 同上 |
| `surface-systems-localization` | 説明文の英訳の照合 `shared-grid protection` → `stops for a while` | 同上 |
| `craft-pylons-bomb-bay` | パイロン：ミサイル 6・魚雷 3・爆弾 2 → 1・1・3 | ユーザー 2026-11-26「パイロンは一つあたりミサイル、魚雷一つ、爆弾は3個で」 |
| `missile-launcher-geometry` | 機体の発射機の弾数 3 → 1 ＋ 弾薬庫に入った数 | ユーザー 2026-11-26（発射器 1 発＋弾薬庫） |
| `missile-seekers-torpedo-flight` | X ウイング `rmslx6` → `rmslx4`、TIE/ln `cmslx3` → `cmslx2`、ハイエナ `cmslx6,cmslx6` → `cmslx4,cmslx6` | 同上（保存済みの魚雷発射管は 1 発＋弾薬庫 1 発） |
| `dual-purpose-weapons`・`combat-point-defense-targeting`・`point-defense-toggle`・`surface-energy-review` | 「次の 1 歩で当たった量が 0 より大きい」→「弾を撃った・当たった・次の弾へ端数を持ち越した」 | ユーザー 2026-11-26「命中する砲弾のみを1発1発シミュレーションする」（1 歩で弾が出ない・当たらないことがある） |

## 前から落ちていて、今回も落ちているもの（主なもの）

`fleet-battle-determinism`（基準の取り直しが要る。乱数を引く回数がまた変わった）、`gunnery-accuracy` 2 件、`fighter-interiors`、`fleet-air-restraint`、`heat-running`、`reference-sublight-speeds`、`example-figures-regression` ほか。一覧は tsv。
