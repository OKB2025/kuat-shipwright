# 全テストの実行（2026-11-22、版 7 の PR）

- 実行：`tests/*.cjs` の 553 本を 3 本ずつ（1 本 1,800 秒まで、ヒープ 6,000 MB）。対象のコミットは `34a935b`（作り直し後の証拠まで）。
- 結果：553 本中 141 本が失敗（`failed-34a935b.txt`）。比較した前回の全体実行（r8、この PR の途中の段階）は 140 本（`failed-r8.txt`）。
- 前回は通り、今回落ちたもの 2 本（どちらも直した）：
  - `worker-authored-drift`：既知のずれの一覧にあった「無関係な編集でハッチが書き換わる」が起きなくなった。この試験の決まり（直ったら一覧から消す）どおり、その項目を消した。`0d6476b` から古い一覧で落ち、版 6 の `ce7e99a` では通る。
  - `fleet-battle-determinism`：版 7 の作り直しで作例の艦（arquitens、cr90、hammerhead）が変わったため、記録と 0 刻み目から合わない（作り直し前の `4dd4fdb` でも落ちる）。最初の数値の差は arquitens の位置 x の相対 1.6e-10。記録し直し、2 回続けて同じファイル（sha256 ef3d0ef7…）。
- 前回は落ち、今回通ったもの 1 本：`ship-dock`。
- 残る 139 本は前回も落ちていたもの（この PR の前から落ちている試験を含む。棚卸しは未着手）。
- 画面の変更 2 件（`afe85d5`、`e0dba61`）は全体実行の後に入れた。その時点では関係する既存の試験を変更前後で比べ「同じ結果」と書いたが、下の最終実行で、性能表を畳む変更（`e0dba61`）が 3 本の試験を落としていたことが分かった（訂正）。

## 最終実行（2026-11-22、`5e38505`）と、この PR の前（`ce7e99a`）との比較

- 今のコード：`tests/*.cjs` 556 本を上と同じ条件で実行。142 本が失敗（`failed-5e38505.txt`）。`246a1f5` は資料だけの変更なので、試験の結果は変わらない。
- この PR の前（版 6、`ce7e99a`、作業木 `/tmp/ks-verify/20261121-abc/base`）：`failed-34a935b.txt` の 141 本を同じ条件で実行。通ったのは `fleet-battle-determinism` と `worker-authored-drift` の 2 本だけ（`base-ce7e99a-passed.txt`）。残りは落ちるか時間切れ（`base-ce7e99a-failed.txt`、2 列目が終了コード、124 は 1,800 秒の時間切れ）。
- 142 本の内訳：
  - 139 本は `ce7e99a` でも通らない。137 本は落ち、この PR の前から落ちている試験。2 本（`mandator-example-refit`、`example-figures-regression`）は `ce7e99a` で時間切れのため、下で個別に扱う。
  - 3 本は `34a935b` では通り、`e0dba61`（性能表を畳む）で落ちるようになった。原因はどれも試験の作り物の環境で、表示の期待値ではない。直した後、3 本とも単独実行で通る（ログは `/tmp/ks-verify/20261122-final-suites/fix-*.log`）。
    - `immediate-design-placement-ui`、`ui-phase1-power-bar-ui`：`designUIMetrics` だけを取り出して動かすため、新しく呼ぶ `designMetricsOpen` が無かった（ReferenceError）。試験が `designMetricsOpen` も取り出すようにした。
    - `design-continuous-placement-ui`：`bindDesignUI` が新しく `#designMetrics` にクリック処理を付けるが、作り物の部品に `addEventListener` が無かった（TypeError）。作り物を用意する部品の一覧に `#designMetrics` を足した。
  - 期待値・許容差・判定は変えていない。
- 件ごとの比較（物理レビューの指摘、`subtest-compare-5e38505-vs-ce7e99a.txt`）：両方で落ちる試験について、落ちた件の名前を `ce7e99a` と比べた。136 本は同じ件だけが落ちる。違ったのは 3 本：
  - `design-edit-session-ui`（4 件多い）と `fleet-orders-localization`（2 件多い）：上の 3 本と同じ種類の試験の作り物の不足だった（`#designMetrics` に `addEventListener` が無い、新しい `launcherVolleyTT`／`totalVolleyTT` を読み込んでいない）。試験側を同じように直し、単独で再実行すると、落ちる件が `ce7e99a` と同じになった（`/tmp/ks-verify/20261122-final-suites/fix-*.log`）。期待値は変えていない。
  - `mandator-example-refit`：`ce7e99a` 側が時間切れで、件の記録が無い（下の個別の項）。
- 先に直した 2 本（`fleet-battle-determinism`、`worker-authored-drift`）は今のコードで通る。
- 個別に確かめたもの：
  - `onager-fixed-axis-runtime`：両方とも 12 件中 1 件（11 番「RTS の結果時計…」）だけ落ちる。同じ失敗なので、この PR の前からのもの。
  - `mandator-example-refit`：今のコードでは 5 件中 2 件が落ちる（2 番 `full single-volley storage for gun 8649`、5 番 シールド処理）。`34a935b` でも同じ 2 件が同じ文面で落ちる（`/tmp/ks-verify/20261122-suite/out/mandator-example-refit.log`）。ただし砲を傾けたのは `5087a2d`（ビルダー）で、`34a935b` は傾けたあとの作り直し `b0b99bf` を含む。したがってこの比較からは、傾けたことが原因かどうかは言えない（訂正：先の版で「傾きによるものではない」と書いたのは誤り。`cffa5d4` は証拠と注記を足しただけのコミット）。試験の中の 2026-11-20 の注記（傾ける前）には、quad175 48 基がすべて 0.823 で落ちていたとあり、以前から落ちていた可能性は高い。`ce7e99a`（版 6、砲を傾ける前）で時間を 6,000 秒に延ばして再実行すると、同じ 2 件が同じ文面（2 番は `full single-volley storage for gun 8649`）で落ち、3 件が通る（`mandator-example-refit-ce7e99a.log`）。したがってこの 2 件はこの PR の前からの失敗で、傾けたことによるものではない。試験の注記（2026-11-20）にあるとおり、quad175 の蓄えの不足は次に作例を作り直すときに直す予定のまま残っている。なお、マンデイターの `evidence.json` の充電の値（quad175 の最小 1）は、`syncCompartments` をせずに `computeStats` で測ったもので、試験（`syncCompartments` のあと `shipRefitMeasure`）とは測り方が違う。結果が食い違う理由は調べていない。
  - `example-figures-regression`：まとめて流すと両方とも 1,800 秒・7,000 秒で時間切れ（この試験は全作例が終わるまで何も出さない）。作例を 1 隻ずつ分けて流し直した（`figures/run.sh`、1 隻 3,000 秒まで、2 並列）。結果は `figures/head-exit-diffcount.tsv`・`figures/base-exit-diffcount.tsv`（作例、終了コード、合わない項目の行数。1 回目と 2 回目の呼び出しの両方を数える）。
    - 41 隻のうち 40 隻は、`ce7e99a` でも今の版でも記録（`tests/helpers/example-figures.json`、最後に記録したのは `fc88f3c`）と合わない。mandator2 は両方とも 3,000 秒で時間切れ（**比べられていない**）。この試験は PR の前から通らない。記録が古いためで、この PR の差は、この試験の合否では見分けられない。
    - 今の版のほうが合わない項目が多い作例がある。大きいのは機体（例：tie_ln 2 → 49 行、vulture 2 → 51 行、tie_in 1 → 47 行）。理由を調べた（`figures/craft/c.cjs`・`d.cjs`）：
      - 保存した設計と、組み直した設計（`buildDesign`、`remount` の後も）の数値は、両方の版で一致する。
      - `ce7e99a` の設計ファイルを、`ce7e99a` のコードと今のコードで計算すると、tie_ln の定格の加速は 30,571.1 → 33,272.6 m/s²（+8.8%）、発電の容積（`Vgen`）は 0.169 → 0.2018（+19%）、vulture は 25,023.4 → 28,678.1（+14.6%）。設計ファイルは同じなので、計算の側の変更による差。
      - この PR で `js/core.js` を変えた 18 個のコミットを順に当てると、変わるのは `f191196`（区画の切り取りを面をつないで行う `clipCompartmentByMesh`。版 7 の中心の変更）だけ。
      - 切り取った容積が正しいかを、区画の定義（区画の形の中で、かつ `insideOriginalEnvelope`）のモンテカルロ（1 室 10⁶ 点）と比べた（`figures/clip-mc/`）。6 機・11 室で、面をつなぐ切り取りは定義より 0.0〜1.2% 小さく（区画の形のメッシュ自体の角の分。tie_ln #9 で −0.7%）、外板の外に残る容積は見つからない（外側の判定は 1 室 20,000 点で、当たったのは vwing #28 の 1 点だけ。当たらなかった室で言える上限は、区画の容積の約 0.1%）。前の格子の切り取りは 6〜21% 小さかった。前の方法が小さな区画を削りすぎていたためで、版 7 の値のほうが正しい（物理レビュー PASS、2026-11-22）。艦の区画は調べていない。
      - 作例の記録（`../README.md` の「機体：定格・最大の加速は tie_ln +3.16%」）は、`stats-diff.cjs` で**今のコードのまま**設計だけを比べた値。計算の側の変更を含む版 6 → 版 7 の差は、tie_ln で 30,571.1 → 34,324.8（+12.3%）、vulture で 25,023.4 → 28,585.4（+14.2%）、tie_in で 30,085.7 → 31,780.2（+5.6%）。
    - 記録（`example-figures.json`）は書き換えていない。PR の前から全作例で合わないので、書き換えるなら全 41 隻を記録し直す別の作業になる（`scripts/capture-example-figures.cjs`）。
