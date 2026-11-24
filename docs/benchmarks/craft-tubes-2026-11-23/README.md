# 航空機の発射管の復活（2026-11-23）

ユーザー：「パイロンではなく発射装置に戻して案Bに」「発射管を復活」。v24（11/10）でパイロンに変えた航空機の魚雷発射管・震盪ミサイル発射管を元に戻した。

- `convertCraftOrdnance` は発射管をパイロンに変えない（爆弾倉の装備は従来どおり爆弾倉区画になる）。魚雷発射管を部品一覧に戻した。
- 正史の弾数は発射管の弾数に戻した（`CRAFT_LOADOUT`、v24 直前のもの。ハイエナ級は爆弾倉なし）。
- 案B：船体・構造物に発射管の長さより浅く埋まった発射管は、発射口の前が開いていれば取り付いているとみなす（`craftLauncher`、`craftGunAutoSink`、`craftMuzzleBlocked`）。
- 発射管はパイロンより重い（魚雷発射管 1 t・ミサイル発射管 0.8 t、パイロン 0.05 t）。前回の v24 と同じく、各機の反応炉の縮尺 `CRAFT_REACTOR_SCALE` を合わせ直して加速度を保った（cal.cjs、meas.cjs）。V-19 は縮尺 0.550〜0.552・0.574 以上で内部に散逸設備が入りきらず生成できないため、目標近くの 0.5689 にした。

## 作例の数値（cmp.cjs：変更前 → 変更後）

| 作例 | 質量 t | 加速 G | 価格 | 兵装庫・弾 | 警告数 |
| --- | --- | --- | --- | --- | --- |
| craft_arc170 | 47.422 → 48.415 | 541.8 → 541.8 | 236723 → 243666 | cpylonx1 ptorp3 → ctorpx1 ptorp6 | 4 → 4 |
| craft_awing | 10.829 → 12.412 | 1594.4 → 1594.4 | 150608 → 159047 | cpylonx2 cmsl12 → cmslx2 cmsl12 | 2 → 2 |
| craft_btlb | 76.283 → 78.279 | 592.4 → 592.4 | 200840 → 212524 | cbombx1+cpylonx2 bomb8+ptorp6 → ctorpx2+cbombx1 ptorp12+bomb8 | 2 → 2 |
| craft_hyena | 25.052 → 28.59 | 862 → 862 | 159865 → 178713 | cpylonx2+cpylonx2 ptorp6+cmsl12 → ctorpx2+cmslx2 ptorp6+cmsl12 | 3 → 3 |
| craft_tie_sa | 41.247 → 42.29 | 1297.8 → 1297.8 | 141597 → 148520 | cbombx1+cpylonx1 bomb8+ptorp3 → ctorpx1+cbombx1 ptorp4+bomb8 | 4 → 4 |
| craft_v19 | 15.578 → 17.198 | 1492.1 → 1492 | 133509 → 142435 | cpylonx2 cmsl12 → cmslx2 cmsl12 | 4 → 5 |
| craft_vulture | 8.197 → 11.04 | 1243.1 → 1243.1 | 102563 → 121077 | cpylonx2+cpylonx1 etorp4+cmsl2 → ctorpx2+cmslx1 etorp4+cmsl2 | 4 → 5 |
| craft_xwing | 29.991 → 32.027 | 1284.5 → 1284.5 | 152699 → 163645 | cpylonx2 ptorp6 → ctorpx2 ptorp6 | 6 → 6 |
| craft_z95 | 26.68 → 28.26 | 953.1 → 953.1 | 134698 → 143668 | cpylonx2 cmsl12 → cmslx2 cmsl12 | 3 → 4 |
## 残っている警告（質量が増えた結果）

- V-19：慣性制御装置の対応質量が不足。
- ヴァルチャー級：慣性制御装置の対応質量が不足、ドロイド・ブレインの自動統合後の容積不足（40%）。
- Z-95：姿勢制御の対応質量が不足（27.4 t／機体 28.2 t）。
いずれも作例の生成処理での機器の大きさ合わせが必要。未対応。

## 試験

- tests/craft-pylons-bomb-bay.cjs：期待値を変更（発射管は発射管のまま読み込む・作例は発射管を持つ）。埋まった発射管の試験を追加。5/5 通過。
- tests/design-placement-catalog-ui.cjs：期待値を変更（魚雷発射管を部品一覧に出す）。10/10 通過。
- 変更前から失敗：embarked-design-rts 3、ground-combat 1、reference-sublight-speeds 1、weapon-flush-bounds-core 1、weapon-output-sizing 1（変更前後で同じ項目）。
- sim-dogfight は設計の既定の弾（発射管の魚雷を含む）を撃つ。x-ln-4v4-tube.log：リモデルの X ウイングと TIE/ln、どちらも発射管、2 戦。
