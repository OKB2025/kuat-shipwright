# 作例の組み立て済みデータの同梱

作例艦を開くときや艦隊戦に出すとき、Worker はこれまで作例の組み立て処理（`buildDesign`）を毎回最初から実行していた。大型艦では数分かかる。v24 から、組み立てを終えた設計図と計算済みの性能をゲームに同梱する。

## 同梱するもの

| データ | 置き場所 | 用途 |
| --- | --- | --- |
| 計算済みの性能（艦隊用プロファイル、諸元、価格） | `data/fleet.js` の各作例の行 | 艦隊編成・出撃画面の表示。従来どおり |
| 組み立て済みの設計図（gzip 圧縮した JSON） | `assets/prepared/<作例キー>.json.gz` | 設計図を開く・艦隊戦に出すときの読み込み |

各作例の行の `model.preparedBlueprint` に、ファイルの場所、圧縮ファイルと展開後の JSON の SHA-256、生成時の `js/core.js` の SHA-256 を記録する。

## 読み込み

- 起動後、ブラウザは同梱の設計図を背景で取得し、キャッシュに保存する（`KSAssetCache.preloadAssets`）。
- Worker は作例を開くとき、`data/reference.js`・`data/imperial2.js`・`js/core.js` の SHA-256 が記録と一致し、ファイルの SHA-256 も一致すれば、設計図を読み込むだけで済ませる（`engine.js` の `loadExample`）。組み立て処理は実行しない。
- どれかが一致しない（ソースが更新された、ファイルが壊れている、取得に失敗した）ときは、従来どおり組み立て処理を実行する。結果は変わらず、時間がかかるだけである。
- 一度開いた作例の形状と性能は、従来どおりブラウザの IndexedDB に保存され、次からはそれを使う。

形状のメッシュ（3D データ）は同梱しない。計算用のキャッシュまで含めると小型艦のゴザンティ級でも約36 MB（圧縮後5 MB）になる。メッシュは設計図から Worker が作り直す。

## 作り直し

`js/core.js`、`data/reference.js`、`data/imperial2.js` のどれかを変えると、同梱の設計図は使われなくなる。作例の変更を公開するときは、全作例を作り直す。

```sh
node scripts/update-ship-examples.cjs --patch /tmp/fleet.json --blueprints /tmp/bp
node scripts/pack-prepared-examples.cjs --patch /tmp/fleet.json --blueprints /tmp/bp
node scripts/update-ship-examples.cjs --merge /tmp/fleet.json
node scripts/update-asset-manifest.cjs
```

`pack-prepared-examples.cjs` は、設計図が作例の行の `blueprintSha256` と一致することを確かめてから圧縮する。
