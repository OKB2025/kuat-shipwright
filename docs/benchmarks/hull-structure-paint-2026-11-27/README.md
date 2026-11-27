# 船体構造物の塗色（2026-11-27）

ユーザーの指示：「船体構造物にも構造物と同じ塗色が出来るように」

## 原因
- 構造物の塗色の欄（`構造物の塗色`）は、配置タブで構造物を選んだときの部品の編集欄（`partEditor`）にしかなかった。
- 船体構造物を編集する「船体の形状加工」（船体タブ）には、基本の部品編集欄（`basePartEditor`）しか出していなかった。このため、塗色の欄がなかった。
- 描画は、もともと船体構造物の三角形に `p.paint` を使っていた（`js/gfx.js` の `renderHullTriangles` の行）。参照モデルの外板（`hullSkin`）を使う船体だけは、`p.paint` を使っていなかった。

## 変更
- `js/app.js`
  - `structPaintHTML(p)` を追加した。船体タブで、船体の部品編集欄の後に置く。
  - 欄は対象の部品の id を持つ（`data-partpaint-id`）。ほかの部品を選んでいても、その船体構造物に塗る。
  - 「標準の色に戻す」も付けた。
- `js/gfx.js`：参照モデルの外板にも `p.paint` を使う（`refTone` の基準色）。

## ブラウザでの確認（ヘッドレス Chromium、エンジンは inline）
- `probe.cjs`：実際の操作の流れで確認した。船体をタップ → 情報カードの「編集」→「船体の形状加工」で、`船体構造物の塗色` の欄が表示される（`4-real-flow-hull-context.jpg`）。
- `hulltab.cjs`：赤（#ff2020）を選ぶと、船体が赤で描かれる。画面中央の平均色は次のとおり（`result.json`）。
  - 変更前：(89.7, 95.4, 101.5)
  - 赤にした後：(98, 39.9, 43.1)
- 元に戻す（Ctrl+Z）・やり直し（Ctrl+Y）、保存形式での往復、「標準の色に戻す」も確認した。
- Worker モードでも同じ結果になった（`result-worker.json`。`mode: worker`）。
  - 最初の確認が inline だったのは、core.js を変えたあとソースのマニフェストが古く、ページがソースを検証できなかったため（コンソール「engine worker unavailable, running inline: source snapshot unavailable」）。
  - `node scripts/update-asset-manifest.cjs` で更新したあとは Worker で動いた。
- 回帰レビュー（2026-11-27）の指摘を反映した。
  - 船体構造物は鏡像にできる（`hullMirrorZ`）ので、左右対称がオンのときは双子も塗る（`paintPartById`、通常の構造物の `editSel` と同じ扱い）。
  - 編集できない部品は塗らない。色は小文字で保存する。
  - テストは `tests/hull-structure-paint.cjs` の 5 番。
- 未確認：参照モデルの外板を持つ船体での表示。作例艦で、船体構造物の参照外板（`hullData.hullSkin.enabled`）を使うものは 0 件だった（data/examples を全件調べた）。塗らない場合の色は、`refTone` の既定値（WHITE）と同じで、今までと変わらない。
