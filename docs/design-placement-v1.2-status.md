# 新設計UIと構造物接続の実装状況

対象仕様は [design-placement-v1.2.md](design-placement-v1.2.md)。
骨組み重量・強度寄与・縦強度の加速／推進入力制限は保持する。
接続診断は実形状と親子参照に基づく別の診断であり、強度上限を解除しない。
外装は武装を含めすべてタップした構造物の子とする。コピーは子孫を標準で含める。
親削除時は他の実接触がない子を削除し、残存接触群を循環なく組み直す。

## 変更の接続先

- `index.html`, `js/design-ui.css`, `js/app.js`: 全面3D、実諸元、下部メニューとドロワー。
  既存部品選択・編集・Undo/Redo・詳細機能を共有する。
- `js/core.js`: 部品能力、元形状と親・面・接触側、外装成形と実接触、
  内装交差・容積保持・固定機器検証、コピー参照、保存後の形状再生成。
- `js/gfx.js`: タップ先の構造物の実面を選択し、親・接触側・実形状ゴーストを描画する。
  クライアントの選択はWorkerの面スナップショットを使う。
- `js/engine.js`: 設計本体を変更しない配置検証ジョブ、取消・世代照合、
  有効形状の転送と依存更新。既存inline経路も同じCoreを使用する。
- `js/lang-en.js`: 新UI、接続・幾何・機能制約エラーの英訳。

## 37件の受入条件と証拠

「実装済」は記載した試験の成立を表す。すべての自由形状・端末での網羅検証を意味しない。
ブラウザ・数値・性能の観測条件と未検証範囲は以下の検証記録へ記載する。

|ID|状況|証拠と範囲|
|---|---|---|
|UI-01|実装済|`browser-design-placement.cjs` のPC・縦横タッチ3条件。外装／内装切替、カメラ保持、既存機能への詳細導線。|
|UI-02|実装済|`structure-placement-modes.cjs`, `design-placement-catalog-ui.cjs`。外装構造物3方式。|
|UI-03|実装済|同上とブラウザの砲塔選択。通常取付を既存経路で検証。|
|UI-04|実装済|`interior-placement-modes.cjs`, ブラウザのcargo/hangar選択。|
|UI-05|実装済|同上とengineCore/battery選択。固定形状の切断・縮小を拒否。|
|GEO-01|実装済|`structure-placement-modes.cjs` の楔上の水平屋根、実接触、容積。|
|GEO-02|実装済|同上の面配置。法線追従、専用フィットなし。|
|GEO-03|実装済|`interior-placement-modes.cjs`, `placement-worker-integration.cjs`。要求1000／有効800m³。|
|GEO-04|実装済|同上。800m³母体への1000m³容積維持を原状保持して拒否。|
|GEO-05|部分実装|連結したcargo/fuel区画の容積維持を検証。一部機械の変形寸法は未校正で明示拒否。|
|GEO-06|実装済|`interior-placement-modes.cjs` の固定球・円筒・設備干渉と実寸維持。|
|DATA-01|実装済|`placement-worker-integration.cjs`, 保存互換試験、ブラウザ保存・Undo/Redo。実Workerで適用・取消・通常保存の拒否・下書き保全・1回のUndoを確認。|
|DATA-02|実装済|旧保存に新モードを推測しない。4作例の同一保存図面で形状設定と物理値を比較。使用できるユーザー図面はなく、画像から検証済みとはしない。|
|PERF-01|部分実装|`design-placement-async-ui.cjs`, Worker世代試験。大型艦の初回semantic面データ未準備時は配置拒否。接触群の同期削除と実機性能は残課題。|
|PERF-02|実装済|既存`editor-interaction-performance.cjs`, `editor-preview-incremental.cjs`。フレーム単位の軽量更新。|
|MOBILE-01|部分実装|`design-placement-orientation.cjs` と縦横タッチharness。実iPhone/Safariは未検証。|
|I18N-01|実装済|日本語／英語辞書と実ブラウザの切替・配置失敗表示を検証。FITS追加エラーも辞書へ登録。|
|UI-06|実装済|PC・縦横タッチで、選択中の子とは異なる親を実タップし、追加元・面ID・位置の一致と保存を確認。|
|UI-07|実装済|`structure-placement-modes.cjs`, `design-root-placement-ui.cjs`。空の設計では明示したY=0作業面から実ルートを作り、設備・武装には親を要求。ブラウザ証拠は下記。|
|GEO-07|実装済|同上の4接触側と直立姿勢、`placement-curved-contact.cjs` の曲面垂直配置。|
|GEO-08|実装済|曲面・厚み試験の有限張り出し。閉領域と親範囲での接触を確認。|
|GEO-09|実装済|曲面試験の楕円体・円筒・開口・切削、厚み試験の上面／外向き面貫通拒否。複雑度上限あり。|
|GEO-10|部分実装|構造物・曲面試験の左右上下鏡映、親・面・法線・接触側の対応は成功。大型艦の武装鏡映ペアは厳密面検証で未成立、原因未特定。|
|ATTACH-01|実装済|構造物試験の隙間・点・辺接触拒否。新接続診断を旧AABB近接診断から分離。|
|ATTACH-02|部分実装|親の移動・回転・寸法と3世代の依存更新。同じ安定面への頂点編集後の再投影を`structure-placement-modes.cjs`で検証。任意の自由形状全体のブラウザ追従は未検証。|
|ATTACH-03|実装済|親削除時の実接触による削除・残存、同親の子同士の接触群の循環防止へ更新。面消滅では編集元を保持。|
|ATTACH-04|実装済|自己参照・循環を拒否。元図面・履歴を変更しない。|
|ATTACH-05|実装済|標準コピーは武装を含む子孫へ拡張。新ID参照と複数選択の重複排除。`browser-exterior-parenting.cjs`で親だけを選択した別艦への貼付まで確認。|
|ATTACH-06|実装済|構造物・Worker保存試験のアンカー／子孫再生成とブラウザUndo/Redo。`browser-design-edit-session.cjs`と`browser-exterior-parenting.cjs`で1回のUndo・保存・再生成を確認。|
|DATA-03|実装済|既存骨組み図面を保持。新接続診断へ旧サンプルを流用せず、既存強度には引き続き使用。|
|DATA-04|部分実装|配置モデル版と実行ソース指紋で旧派生物を無効化。キャッシュ全体試験の環境制約は下記。|
|PHYS-01|実装済|`placement-physics-preserved.cjs` と同一保存図面4艦比較。重量・HP・装甲・価格を保持。|
|PHYS-02|実装済|同上。接続診断と縦強度断面評価を別表示し、旧上限を保持する最新指示へ対応。|
|PHYS-03|実装済|同上と推進・熱試験。実給電・慣性・縦強度と実入力に従う発熱を保持。|
|PHYS-04|実装済|同上。質量・熱容量・慣性・ハイパードライブ等を既存共通モデルで維持。|
|PHYS-05|実装済|同上。構造維持装置のID・設定・現行の強度寄与を保持。|
|PERF-03|実装済|`placement-worker-generations.cjs`, `design-placement-async-ui.cjs`, 実Core統合試験。取消・親変更・旧結果を照合。|

## 残る仕様課題と限界

- `pump`、`hdis`、`inertial`、`integrity` の変形に必要な機械寸法は未校正。
  全体がそのまま収まる場合は配置できるが、根拠のない切断・再構成は拒否する。
- ハッチと結びついた格納庫の再配置は、現行の開口・クリアランス条件を保持できない場合に拒否する。
  新しい開口や機能を自動生成しない。
- 容積維持は既存の有限探索を使用する。空間が存在しても、連結性・機能条件・保守的境界判定・探索上限で
  成立を証明できない場合は、理由を表示して配置しない。
- 複雑な自由形状は閉領域・自己交差・厚み・計算量の検証に失敗する場合がある。
  描画面で隙間を隠したり、容量だけを成功値へ固定したりしない。
- 旧120断面の評価による低い加速上限や0Gは残り得る。
  これは今回保持する既存強度計算で、新しい「実接触が成立した」という診断とは異なる。
- 親削除時の接触群の再構成は同期処理であり、接触する子が多いとメインスレッドを占有する。
  具体的な計測値は`benchmarks/parent-deletion.json`。PERF-01は部分実装として扱う。
- 実Safari・実iPhoneは未検証。Chromiumのタッチ画面とSwiftShaderによる観測を代用検証済みと記すにとどめる。

## 数値許容差の選定範囲

`Core.PLACEMENT_TOLERANCES`を共有し、UIのピクセル数を物理接触へ使わない。
`structure-placement-modes.cjs`で0.01／1／100倍、座標原点0／50,000mを組み合わせ、
接触と実際の隙間を区別すること、楔の容積を確認した。曲面・鏡映・開口・厚みは各専用試験で確認した。
これを部品機能に必要な実寸や、新しい強度・防御係数として扱わない。

|数値|実装値と用途|
|---|---|
|座標・接触距離の基本ε|`max(1e-6m, extent × 3e-7, coordinateMagnitude × Number.EPSILON × 64)`。形状スケールと浮動小数点精度へ対応。|
|容積相対誤差|`1e-3`。容積維持の数値検証。空間内包・連結性・干渉条件は別途必須。|
|接触面積|`max(ε², max(1m, extent)² × 1e-10)`。点・辺接触を有効な面接触へ変換しない。|
|数値上の最小厚み|`max(4ε, extent × 1e-5, 指定したfitSettings.minThickness)`。部品固有の機能寸法検証も保持。|

自由形状や未校正の機械への一般的な保証ではない。成立を証明できない形は理由を返して拒否する。

## 基準で確認した既存の失敗

基準は変更していない `7217097da06c5873c017460f18edc24dcf775069` の別チェックアウト。
失敗を無視した総合成功や、すべての既存試験が通ったという扱いにはしない。

|試験|基準結果・原因の範囲|
|---|---|
|仕様で指定された関連11ファイル|117件中95成功・22失敗。propulsion-editor-uiの19件はVM側の`$`未定義、surface-exposure-coreの2件とturret-compartment-volumeの1件も同一失敗。|
|source-delivery.cjs|15件中4成功・11失敗。Worker起動文字列と依存ファイルに対する旧テスト前提。変更前も同じ失敗。|
|load-cache.cjs全体|基準・変更版ともプロセスがSIGKILLで終了。全体合格とは判定しない。|
|propulsion-model.cjs|12件中11成功。炉を船外へ移動する1条件の接続期待値が変更前も不一致。|
|fighter-interiors.cjs|14件中2成功。12機種の既存目標加速期待値が変更前も同じ値で不一致。|

## 最終検証記録

基準mainは `7217097da06c5873c017460f18edc24dcf775069`。最終確認時もremote mainは同じだった。
コマンドとソースSHA-256は [design-placement-validation.json](benchmarks/design-placement-validation.json)。

- 新規18ファイルのNode試験: **183件成功、失敗0**。
- 指定関連11ファイル: **117件中95成功、22失敗**。変更していないmainと失敗22件の名称がすべて一致。
- `node --test --test-name-pattern='lite models|a trial of the design' tests/load-cache.cjs`: **2件成功**。
  全体のSIGKILLを解消したという意味ではない。
- `node scripts/update-asset-manifest.cjs --check`、変更したJSと試験・スクリプトの構文検査、`git diff --check`を実施。

各ブラウザ試験は `http://127.0.0.1:8000/` に実アプリを起動し、実Workerを必須として実行した。
図面fixtureとカメラの準備以外は、実際のボタン・ポインタ／タッチ・確定操作を使う。
幾何・描画・Workerの差し替えや成功値の注入は行っていない。

|再実行コマンド|記録・結果|
|---|---|
|`node scripts/browser-design-placement.cjs`|[PC・縦横タッチ3条件成功](benchmarks/design-placement-browser.json)。実タップ先・面・位置、武装、Undo/Redo、保存形式、日英切替。|
|`node scripts/browser-interior-placement.cjs`|[内装4条件成功](benchmarks/interior-placement-browser.json)。切り取りの実容積・深さ、容積維持失敗、固定機器の拒否／成功と保存復元。|
|`node scripts/browser-design-edit-session.cjs`|[編集5条件成功](benchmarks/design-edit-session-browser.json)。適用、取消、別部品選択、複製・削除の取消、下書き保全と1回のUndo。|
|`node scripts/browser-exterior-parenting.cjs`|[接続3条件成功](benchmarks/exterior-parenting-browser.json)。孤立する子・武装の削除、接触兄弟・武装の残存、別艦へ子孫付き貼付。|
|`node scripts/browser-root-placement.cjs`|[初回ルート成功](benchmarks/root-placement-browser.json)。空面へ設備／武装は拒否、構造物だけ親なしで確定し、実保存画面から再読込。|
|`node scripts/benchmark-parent-deletion.cjs`|[削除処理の単回観測](benchmarks/parent-deletion.json)。接触する子100個で約132ms。ブラウザ入力遅延や上限値の測定ではない。|

画面: [PCパネル](benchmarks/design-placement-browser.desktop-drawer.jpg)、
[スマホ縦ゴースト](benchmarks/design-placement-browser.touch-portrait-ghost.jpg)、
[スマホ横パネル](benchmarks/design-placement-browser.touch-landscape-drawer.jpg)、
[親子コピー後](benchmarks/exterior-parenting-browser.jpg)、
[初回ルートの保存後](benchmarks/root-placement-browser.saved.jpg)。

大型艦の操作・メモリ比較は別の計測記録へ対応させる。
新しい検証・確定段階と旧操作では処理の範囲が違うため、単純な高速化率を宣言しない。
実Safari・実iPhone、継続負荷でのメモリ上限、機械部品すべての変形条件は未検証／未確定。
これらを残した**ドラフトPR**として引き渡し、37件全体の検収完了とはしない。
mainへのマージ、公開、係数の再調整、作例の再設計は行わない。

## 大型艦の操作とメモリの観測

[比較の解釈](benchmarks/design-placement-large-comparison.json)、
[mainの観測](benchmarks/design-placement-large-before.json)、
[変更版の初回配置失敗](benchmarks/design-placement-large-after.json)。
入力はchecksumを検証した8kmマンダトールの318部品。元の535武装は外し、3組6基の新規配置を試す条件。
全武装付き完成艦の検証や、画像しかないユーザー図面の検証ではない。

初回のfast authoring準備直後は、厳密な面選択に使うsemantic surface proxyがまだ届かず、
実canvas内のタップでも配置を開始できなかった。drawerを閉じ、実RAFを待った再試行でも同じで、
この試行は**ERROR・6基中0基**として記録する。新しい配置方式の完了や成功したWorker候補検証には数えない。
実際の背景計算中にカメラ角度は変化し、設計世代・武装数は変化しなかった。

mainは6基配置後のカメラ操作往復約19.94秒、変更版の配置拒否後は約7.46秒。
canvas寸法、操作契約、計算段階が違い、main観測の一部は別ブラウザ試験と重なったため、
この値から高速化率や合格FPSを求めない。
JS heapの観測はmainのfixture設定後約94.0MB・撮影時約110.0MB、変更版設定後約103.6MB。
変更版の同じ完了段階の値はなく、メモリ改善・ピーク・リーク率・Worker全体・GPUメモリは未検証。

補足として[面データ到着後の配置](benchmarks/design-placement-large-ready.json)も記録した。
4019面が追加待ち約36秒で届き、実タップは親1154の面へ到達し、候補は実Workerの検証中になった。
この間もカメラ角度は変化し、武装数・設計世代は不変だった。
その後、最初の鏡映ペア候補が「指定した取付位置は追加元の実形状の面上にありません」と拒否され、
6基の配置は未完了。原候補と鏡映候補のどちらが拒否されたか、形状・数値精度等の原因は未特定であり、
接触条件を緩めて成功扱いにはしない。これも大型艦の検収合格には数えない。

## 同一保存図面の物理比較

[4艦の全比較値とソース指紋](benchmarks/placement-physics-comparison.json)。
変更していないmainで作成・保存した同一図面を使用し、最終Coreの4艦すべてで
質量・骨組み・HP・装甲重量・価格・定格推力・上限・実入力・発熱・熱容量の
記録した物理値が**丸め前まで完全一致**した。係数の差も0件。
基準値の再利用はソースと図面の全checksumを検証し、最終Coreの計算は再実行した。

|艦|総質量（t）前＝後|骨組み（t）前＝後|profile定格加速（m/s²）前＝後|実給電時加速（m/s²）前＝後|熱容量（J）前＝後|
|---|---:|---:|---:|---:|---:|
|インペリアルI|49,269,361.527|3,284,025.079|22,566.447|22,531.638|1.573220e+24|
|インペリアルII|49,278,999.962|3,284,025.079|22,566.193|22,531.382|1.573528e+24|
|ヴェネター|12,049,994.507|518,639.734|29,419.859|29,373.358|3.847684e+23|
|CR90|45,122.475|0.000|20,594.968|0.000|1.440806e+21|

実給電条件は初期健全状態、balanced、maneuver=1、0.25秒の電力配分1回。
平衡温度・連続運転時間・損傷状態全体の実測ではない。CR90の実入力・実加速0も基準と同じ結果であり、
給電を検証済みとして有効化したり、推力だけを増やしたりしていない。
再現: `node scripts/compare-placement-physics.cjs IMMUTABLE_MAIN_ROOT OUTPUT_JSON`。
比較用mainを変更せず、両Coreで同じ保存図面から再計算する。
