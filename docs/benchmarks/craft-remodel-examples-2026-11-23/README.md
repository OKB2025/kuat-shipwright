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