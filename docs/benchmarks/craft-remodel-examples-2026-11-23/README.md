# 航空機の作例をユーザーのリモデルに置き換え（2026-11-23）

ユーザー：「リモデルで作例を揃える」。X ウイング・TIE/ln・TIE/in・A ウイングをリモデル設計そのままで組み、TIE/D を新しい作例にした（`CRAFT_REMODEL`＝data/imperial2.js、`craftRemodelDesign`）。
- 設計：docs/handoff-2026-11-20/refs/ の x-wing-remodel-2026-11-23.json、tie-ln-remodel-2026-11-23.json、tie-in-remodel-2026-11-23c.json、a-wing-remodel-2026-11-23.json、tie-d-remodel-2026-11-23c.json。
- 変えたこと：発射管（リモデル内の魚雷発射管構造物・ミサイル弾倉）の中のパイロンを発射管にした（X ウイング 2、TIE/ln 1、TIE/in 1、A ウイング 4 は震盪ミサイル発射管）。TIE/D のパイロン 2 基は発射管の中ではないのでそのまま。
- 作例の組み立てで内部の改装（反応炉の縮尺）・機体システムの設置・操縦席の位置合わせは行わない。部品数は設計と同じ（check.cjs：138・63・75・96・85）。浮いた装備なし。
- TIE/D は戦略画面の機種表にないので、価格表（CRAFT_PRICE_CATALOG）には載らない（価格は設計から計算）。

## 数値（cmp：置き換え前 → 後）

| 作例 | 質量 t | 加速 G | 価格 | 兵装庫・弾 | 警告数 |
| --- | --- | --- | --- | --- | --- |
| craft_xwing | 32.027 → 32.396 | 1284.5 → 1255.4 | 163645 → 175600 | ctorpx2 ptorp6 → ctorpx2 ptorp6 | 6 → 1 |
| craft_tie_ln | 10.908 → 15.172 | 1480.8 → 1421.1 | 88832 → 145855 |   → ctorpx1 ptorp3 | 4 → 2 |
| craft_tie_in | 17.162 → 19.904 | 1371.5 → 1555.5 | 101004 → 172949 |   → ctorpx1 ptorp3 | 4 → 2 |
| craft_awing | 12.412 → 13.596 | 1594.4 → 1504.2 | 159047 → 164400 | cmslx2 cmsl12 → cmslx4 cmsl24 | 2 → 1 |
| craft_tie_d | - → 24.101 | - → 1861.5 | - → 255485 | -  → cpylonx2 cmsl4 | - → 0 |

## 形状の照合（part-diff.txt）

作例の生成（scripts/update-ship-examples.cjs）は、リモデルではゲームの読み込みと同じく装備の位置を設計のまま保つ（`keepFitPose`、`Core.isCraftRemodel`）。最初の生成では TIE/ln・TIE/in の顎のレーザー #404/#405 が操縦ポッドの下面へ 0.34 m 付け直されていたため修正した。
照合結果：部品・装備は全機で設計と一致。違いは許可済みの「発射管内のパイロン→発射管」と、TIE/ln・TIE/in の部品 #432 の厚み 0.018 m → 0.02 m（読み込み時の部品寸法の下限）だけ。回転の未設定と 0 の違いは除いた。

## 発射管を構造物の中へ（2026-11-23「構造物の中へ沈める」）

発射管の本体（魚雷発射管 1.4×0.5×0.5 m、ミサイル発射管 1.2×0.45×0.45 m）はパイロン（0.2 m 高）より大きく、パイロンの位置のままでは機体の外へ出ていた（tube-protrusion.cjs：X ウイング 99%、TIE 98%、A ウイング 41〜42%）。
- X ウイング #46/#47 と TIE/ln・TIE/in #430：本体の中心を魚雷発射管構造物（#162/#165、#431）の軸に合わせ、発射口を構造物の前面の直後（口の前が開く最初の位置、5 mm 刻みで探索）に置いた。案B で取り付く（めり込み 0.395 m・0.435 m、発射管の長さ 1.4 m 未満）。
- A ウイング #27/#28/#47/#48：管の構造物がないので、口が開いたままの最深まで（さらに 4〜6 cm）沈めた。
- 外に出ている割合（tube-protrusion.log）：X ウイング 38%、TIE 28%、A ウイング 30〜34%。残りは本体が構造物（直径 0.29〜0.39 m）より太い分。
- 位置の探索：/tmp/ks-verify/20261123-sink/sink.cjs・sink-awing.cjs（結果は data/imperial2.js の CRAFT_REMODEL に反映、part-diff.txt に前後の位置）。

## 証拠

- part-diff.py・part-diff.txt：ゲームが読む data/examples/<key>/design.json.gz と設計ファイルの部品・装備の比較。違いは発射管への変更とその位置、TIE の #432 の厚み 0.018→0.02 m（読み込み時の部品寸法の下限 0.02 m、js/core.js deserialize の clamp）だけ。
- check.cjs・check.log：buildDesign の部品数・質量・加速・警告。
- hashes.txt：設計ファイルと受け取ったファイル（キャッシュを除く前）の SHA-256。
- 生成：scripts/refresh-examples.cjs --keys craft_xwing,craft_tie_ln,craft_tie_in,craft_awing,craft_tie_d、update-craft-costs.cjs --check、update-asset-manifest.cjs --check（通過）。
- 未実施：ブラウザでの表示・保存再読込の確認、比較画像。
