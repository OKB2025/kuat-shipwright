# 3 回目のレビューで求められた証拠（2026-11-25）

候補は `ebca11b` 以降の作業ツリー（`js/core.js` の砲身の処理・`data/reference.js` は `520bcf0` から変わっていない：`barrel-code-unchanged-since-520bcf0.txt`）。基準は main `8c4bcab` の写し。

| 証拠 | ファイル | 内容 |
| --- | --- | --- |
| 全作例の砲の位置が main と同じ | `fitpos.cjs`、`fitpos-main-vs-candidate.txt` | 49 件の保存済み設計で、砲・装備の種類、位置（1 mm）、軸、旋回、俯仰、縮尺、台座、構造物の数を比べた。違う作例 0 件 |
| GR-75 の形が以前の作例と同じ | `gr75-vs-main.cjs`、`gr75-vs-main.txt` | 船体の記録は一致（項目の並び順は無視）。構造物 54 個・砲 2 基は、種類・形・中心・大きさ・輪郭・角度・名前がすべて一致（どちらか一方にしか無いもの 0）。内部の部品だけが違う（補助反応炉 3 → 0、散逸区画 10 → 4） |
| 旧保存の読み込み | `oldsave.cjs`、`old-saves-opened-by-candidate.md` | main で保存された設計 10 件を候補のコードで開いた。全件読み込める。給電区画の容積が足りない砲 0。レーザーに残った `chargeScale`・`chargeSalvos` は読めて、充電の記録は作られない。「再保存の往復」の不一致は main のコードでも同じ（今回の変更によるものではない） |
| ハンマーヘッドの装甲の範囲 | `hammer-armour.cjs`、`hammer-armour.png` | 保存済み設計を読み込み直して、装甲の区画を厚さで色分けした上面・下面・右舷の図（灰 0.2 m、橙 0.6 m。前面 2.0 m はこの 3 図に出ない）。破線が境目 x = 88 m |

## ハンマーヘッドの装甲の範囲について

- 右舷の図で、縦に広がる頭（x 約 88〜117 m）が橙になっていて、首（x 約 45〜88 m）は灰のまま。境目 x = 88 m は頭が広がり始める所に当たる。
- 境目より前の区画は 339 個中 90 個、面積 2,425 m²（全体 10,737 m²）。うち前を向いた面 335 m² が 2.0 m。
- **制限**：上面の区画 `p1:top:34`（341 m²）は、背中を x 40 m から頭の上面の縁（x 116 m）まで 1 枚で続いている。区画の中心が x 73.7 m なので「境目より後ろ」と数えられ、頭の上面の縁の部分は 0.2 m のまま（上面図で頭を囲む灰色の輪）。区画は分けられない（形を変えない）ので、この縁を厚くするには背中全体を厚くすることになる。そうしていない。
- 首の上面の 1 区画（x 83〜91 m）は中心が境目より前なので 0.6 m になっている（上面図の破線をまたぐ橙の四角）。
- 再読込の後も、境目より前の 90 区画の厚さは決めたとおり（前面 13 個 2.0 m、上 19・下 18・左舷 12・右舷 11 個 0.6 m、後面 17 個 0.2 m）。

## 全テスト（main `8c4bcab` と候補 `ab1dc78`）

- 実行：`run-tests.sh <root> <出力先> <並列数> <制限秒> <テストの一覧>`（各 `tests/*.cjs` をその木の中で `node --test` し、終了コード・合格数・失敗数・秒を 1 行ずつ記録）。main は 600 秒、候補は 700 秒の制限。
- 結果：`tests-main-8c4bcab.tsv`（570 本）、`tests-candidate-ab1dc78.tsv`（574 本）、違い `tests-main-vs-candidate.txt`。
- 失敗を含むファイル：main 166、候補 167。

| main と結果が違うテスト | main（終了コード｜合格｜失敗） | 候補 | 理由 |
| --- | --- | --- | --- |
| fleet-standoff-judge、fleet-ram-judge、gr75-user-remodel、gun-feed-physics-review | なし | 0｜6｜0、0｜6｜0、0｜4｜0、0｜4｜0 | 新しいテスト（すべて合格） |
| fleet-commit-twice | 0｜1｜0 | 0｜4｜0 | テストを 3 件追加 |
| turret-compartment-volume | 1｜13｜1 | 1｜16｜1 | テストを 3 件追加。残る 1 件は main と同じ失敗 |
| lowered-bays-capacity | 1｜1｜1 | 0｜2｜0 | 良くなった |
| fighter-interiors | 0｜14｜0 | 1｜13｜1 | **既知**：Z-95 の加速 3,406 G が目標 3,330 G を超える。ユーザー決定で次の PR で作例を直す |
| fleet-record-release | 0｜8｜0 | 1｜7｜1 | **未修正**：Worker が艦を戻す経路でハンマーヘッドの灯りが最大 1.1 mm ずれる（`restored-ship-lights-main-code.txt`。main のコードでも今の設計で再現） |
| trench-armament-combat | 1｜8｜1 | 1｜6｜3 | この実行の後に期待値 2 件を更新（砲列の充電区画はレーザーを含まない）。更新後は 8／1 で main と同じ 1 件の失敗 |
| hull-outer-surface-contact | 124（600 秒で打ち切り） | 1｜0｜1 | 候補は 521 秒で強制終了された（SIGKILL。作業プロセスの再起動と重なった）。完走していない点は main と同じ |

- 600／700 秒の制限で打ち切り：main は example-figures-regression、fleet-loadout-separation、hull-outer-surface-contact。候補は example-figures-regression、fleet-loadout-separation（mandator-example-refit は候補で完走）。
