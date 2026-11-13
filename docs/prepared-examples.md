# 作例は保存データ（設計と戦闘に分割した生成ファイル）

ユーザーの決定（2026-11-12）：作例は、ユーザーが作った艦と同じ普通の保存データとして扱う。

- `js/core.js` のハッシュと結び付けない。
- 実行時に `buildDesign` で組み直さない。`buildDesign` は作成用のスクリプトでだけ使う。
- 性能値などの派生データは、ユーザー艦と同じく「設計の中身＋計算方式の版番号」でキャッシュする。

## ファイル

| ファイル | 内容 | 用途 |
| --- | --- | --- |
| `data/examples/<作例キー>/design.json.gz` | 作例の保存設計（gzip 圧縮した JSON）。艦艇 28 隻のほか、艦載機と旧作例も含む | 設計を開く・艦隊戦に出すときの読み込み |
| `data/examples/<作例キー>/combat.json` | 艦隊用プロファイル、諸元、価格（カタログの行）。艦艇だけ | 艦隊編成・出撃画面の表示、費用上限 |
| `data/examples/manifest.json` | 船ごと・設計と戦闘ごとの SHA-256（schema 2。ソースのハッシュは持たない） | ファイルの検査 |
| `data/fleet.js` | 上の 3 つから組み立てたカタログ（`YardFleetData.designs` と `blueprints`） | ゲームが読み込むファイル |

## 読み込み

- Worker は、作例の保存設計を、ユーザーの保存データと同じ手順で開く（`engine.js` の `loadExample`）。
  - ファイルと中身の SHA-256 を検査する。
  - `deserialize` してから、読み込み手順（`syncCompartments`、`remount`）を通す。
- ファイルが無い・壊れている場合はエラー（`example-missing`、`example-unreadable`）になる。`buildDesign` で組み直すことはしない。
- `crypto.subtle` と `DecompressionStream` が無い環境（https でない配信や古いブラウザ）では、作例を開けない。

## 性能値の扱い

- **行の計算**：`combat.json` の行は、保存設計を読み込み直して、ゲームの Worker と同じ経路で計算する（`generateEntryFromBlueprint`。作成時の構造物の固定 `withFrozenStructures` は使わない）。
- **行の古さの判定**：ページは、行の `model` の版番号（`profileVersion`、`costVersion`、`costSignature`、`exampleProfileVersion`）と `blueprintSha256` で判断する（`app.js` の `voyCostStale`）。戦闘に使うプロファイルは、Worker が計算し直す（`catalogOnly`）。
- **派生データのキャッシュ（IndexedDB `ks-derived`）**：表示値とプロファイルを、次の 2 つをキーにして保存し、リリースをまたいで再利用する。
  - 計算方式のキー：`Core.profileModelKey()` に、`data/reference.js` と `data/imperial2.js` のハッシュ、`engine.js` の表示用の加工の本文のハッシュを足したもの。
  - 設計の中身：作例は `jsonSha256`、ユーザー設計は設計 JSON の SHA-256。
- **`profileModelKey()` の中身**
  - `FLEET_PROFILE_VERSION`、`COST_MODEL.version`、費用の署名、`EXAMPLE_PROFILE_VERSION`
  - ほかの計算方式の版番号（運動抵抗、兵装、亜光速、機関、配置、トレンチ、表面）
  - 部品表（PARTS、FITS）、艦載機の価格カタログ、Rts の艦載機の射撃率のハッシュ
- 参照データのハッシュが無い環境（inline エンジンなど）や、キーが作れない場合は、派生データのキャッシュを使わない。

## 計算方式を変えたとき（版番号）

表のハッシュに入らない計算の変更で、変わっていない設計の計算値が変わるものは、版番号を上げなければならない。対象は、`computeStats`、`fleetProfile`、費用・推進・電力・熱・燃料・乗員・装甲・表面・兵装の計算式です。

1. `Core.EXAMPLE_PROFILE_VERSION`（または `FLEET_PROFILE_VERSION`、`COST_MODEL.version`）を上げる。
2. 行を作り直す（下の「更新」）。
3. 艦載機の価格カタログを作り直し、検査する：`node scripts/update-craft-costs.cjs`、`--check`。カタログが古いと、その艦載機は戦闘で動かず撃たない（加速度 0、兵装の電力 0。実行時に組み直す逃げ道は無い）。

上げ忘れは `tests/example-profile-version.cjs` が見つける。保存設計から行を計算し直し、版番号が同じなのに数値が違えば失敗する。

- 既定は小さい 2 隻（gr75、cr90。約 1 分）。
- リリース前には全艦で実行する（約 20 分）：`KS_PROFILE_VERSION_KEYS=<28 隻をカンマで区切る> node --test tests/example-profile-version.cjs`

## 更新（作成用）

作例の形や性能を意図して変えたとき、または計算方式の版番号を上げたときに実行する。

```sh
node scripts/refresh-examples.cjs            # 全作例（--keys a,b で一部、--jobs で同時数）
node scripts/update-asset-manifest.cjs
node scripts/update-asset-manifest.cjs --check
node scripts/example-files.cjs --check
```

`refresh-examples.cjs` は、各作例を別のプロセスで作る。

- 設計は、作成用の `buildDesign` で組み立て、統計を計算した後に保存する。
- 艦艇の行は、その保存設計を読み込み直して計算する。
- 内容が変わった側のファイルだけを書き換え、最後に `data/fleet.js` を組み立て直す。
- ソースのハッシュには依存しない。`js/core.js` を変えただけでは、作例を作り直す必要はない。

## 以前の形式

- 2026-11-12 まで：設計図と行に、検証に使ったソース（`data/reference.js`、`data/imperial2.js`、`js/core.js`）の SHA-256 を記録していた（manifest schema 1）。一致しなければ、Worker が `buildDesign` で組み直していた。
- v24 の途中まで：設計図を `assets/prepared/<作例キー>.json.gz` に置いていた。
