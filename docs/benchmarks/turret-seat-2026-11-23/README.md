# 砲塔の台座の規則（2026-11-23）：全作例の台座の高さの比較

`bases.cjs` で各作例を読み込み（keepFitPose で再搭載）、兵装の台座の高さ `base` と浮きを、PR 基準の直前（c84c359）と候補で比べた（`run.sh`）。

- `compare-without-supportlift.log`：新しい規則だけを入れた段階。7 艦 27 基の台座が変わった（レキュサント弩級の砲塔 90 m → 4.7 m など、重なった構造物の中へ沈む）。
- `compare-supportlift.log`：旧規則で重なった構造物の上に立っていた砲塔に `supportLift` を付けて高さを保った段階。全 47 作例で変化 0 基、`supportLift` 27 基。
