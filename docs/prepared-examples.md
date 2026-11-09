# 作例の生成ファイル（船ごと・設計と戦闘に分割）

作例艦を開くときや艦隊戦に出すとき、Worker はこれまで作例の組み立て処理（`buildDesign`）を毎回最初から実行していた。大型艦では数分かかる。v24 から、組み立てを終えた設計図と計算済みの性能をゲームに同梱する。生成ファイルは船ごとに分け、さらに「設計」と「戦闘」に分ける。

## ファイル

| ファイル | 内容 | 用途 |
| --- | --- | --- |
| `data/examples/<作例キー>/design.json.gz` | 組み立て済みの設計図（gzip 圧縮した JSON） | 設計図を開く・艦隊戦に出すときの読み込み |
| `data/examples/<作例キー>/combat.json` | 艦隊用プロファイル、諸元、価格（カタログの行） | 艦隊編成・出撃画面の表示、戦闘 |
| `data/examples/manifest.json` | 船ごと・設計と戦闘ごとの SHA-256 と、検証に使ったモデルのソース（`data/reference.js`・`data/imperial2.js`・`js/core.js`）の SHA-256 | 有効判定 |
| `data/fleet.js` | 上の3つから組み立てたカタログ | ゲームが読み込むファイル |

`combat.json` には、変わりやすい記録（ソースの SHA-256 と設計図の場所）を入れない。それらは `manifest.json` が持つ。ソースが変わっても艦の結果が同じなら、船ごとのファイルは書き換わらない。

## 読み込み

- 起動後、ブラウザは同梱の設計図を背景で取得し、キャッシュに保存する（`KSAssetCache.preloadAssets`）。
- Worker は作例を開くとき、設計図に記録したソースの SHA-256（`preparedBlueprint.sourceSha256`）が現在の `data/reference.js`・`data/imperial2.js`・`js/core.js` と一致し、ファイルの SHA-256 も一致すれば、設計図を読み込むだけで済ませる（`engine.js` の `loadExample`）。
- どれかが一致しないときは、従来どおり組み立て処理を実行する。結果は変わらず、時間がかかるだけである。

形状のメッシュ（3D データ）は同梱しない。メッシュは設計図から Worker が作り直す。

## 更新

`js/core.js`、`data/reference.js`、`data/imperial2.js` のどれかを変えたら、作例を更新する。

```sh
node scripts/refresh-examples.cjs            # 全作例（--keys a,b で一部、--jobs で同時数）
node scripts/update-asset-manifest.cjs
```

`refresh-examples.cjs` は各艦を別のプロセスで組み立て、設計図と戦闘データを保存済みのファイルと比べる。

- 内容が変わった側（設計または戦闘）のファイルだけを書き換える。
- 変わらない側は、`manifest.json` のソースの記録だけを現在のものに更新する。
- 最後に `data/fleet.js` を組み立て直す。

ロジックだけの変更（例：ジャンプの判定）では、どの艦の結果も変わらない。そのため、書き換わるのは `manifest.json` と `data/fleet.js` だけになる。確認のための組み立ては全艦で行う。

`node scripts/example-files.cjs --check` は、`data/fleet.js` が船ごとのファイルと一致することを確かめる（`tests/example-files.cjs`）。

## 以前の形式

v24 の途中までは、設計図を `assets/prepared/<作例キー>.json.gz` に置き、カタログは `data/fleet.js` だけを生成していた（`scripts/pack-prepared-examples.cjs`）。`node scripts/example-files.cjs --migrate` で一度だけ新しい形式に分け、以前のファイルとスクリプトは削除した。
