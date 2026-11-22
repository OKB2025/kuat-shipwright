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
  - `example-figures-regression`：両方とも 1,800 秒で時間切れ。比べられていない（UNVERIFIED）。
