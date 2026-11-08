# 新設計UIと構造物接続の実装状況

対象仕様は [design-placement-v1.2.md](design-placement-v1.2.md)。
骨組み重量・強度寄与・縦強度の加速／推進入力制限は保持する。
接続診断は実形状と親子参照に基づく別の診断であり、強度上限を解除しない。
外装は武装を含めすべてタップした構造物の子とする。コピーは子孫を標準で含める。
親削除時は他の実接触がない子を削除し、残存接触群を循環なく組み直す。
大量のトレンチ兵装は砲種×舷で集約し、左右の実充電区画と射撃・実給電へ接続する。
追加12条件は [トレンチ砲群の追補](design-trench-armament-addendum.md)で既存37件と分けて扱う。

その後の画面・連続配置・接触側切除・部品分類の変更は
[設計操作の追補](design-ui-refinement.md)を参照する。
以下の初版ブラウザ記録にある「詳細」「確定」は取得時点の操作であり、
現在の入口は「設置一覧」「性能」と、タップ後の自動配置に変更した。

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
|UI-03|実装済|砲塔の通常取付と、追加のノズル支持台を既存取付へ接続。支持台は実形状で接触・選択・保存を共用。|
|UI-04|実装済|`interior-placement-modes.cjs`, ブラウザのcargo/hangar選択。|
|UI-05|実装済|同上とengineCore/battery選択。固定形状の切断・縮小を拒否。|
|GEO-01|実装済|`structure-placement-modes.cjs` の既存水平屋根に加え、追補の`structure-contact-cut.cjs`と`native-structure-contact-cut.cjs`で親と重なる子だけを切除。姿勢・上面・実接触・容積を確認。|
|GEO-02|実装済|同上の面配置。法線追従、専用フィットなし。|
|GEO-03|実装済|`interior-placement-modes.cjs`, `placement-worker-integration.cjs`。要求1000／有効800m³。|
|GEO-04|実装済|同上。800m³母体への1000m³容積維持を原状保持して拒否。|
|GEO-05|部分実装|連結したcargo/fuel区画の容積維持を検証。一部機械の変形寸法は未校正で明示拒否。|
|GEO-06|実装済|`interior-placement-modes.cjs` の固定球・円筒・設備干渉と実寸維持。|
|DATA-01|実装済|`placement-worker-integration.cjs`, 保存互換試験、ブラウザ保存・Undo/Redo。追補では未計算の元入力も保存可能とし、安定ID・世代・1回のUndoを保持。未検証の新規配置から完成艦プロフィールを作らない。|
|DATA-02|実装済|旧保存に新モードを推測しない。4作例の同一保存図面で形状設定と物理値を比較。既存リポジトリ収録のユーザー図面は後述の支持台試験で使用。今回の画像から図面を検証済みとはしない。|
|PERF-01|部分実装|`design-placement-async-ui.cjs`と追補の即時配置・早期実形状選択・Worker世代試験。全艦の面調査前でも実形状をタップし、計算中の移動・削除・カメラ操作を受理。接触群の同期削除と実機性能は残課題。|
|PERF-02|実装済|既存`editor-interaction-performance.cjs`, `editor-preview-incremental.cjs`。フレーム単位の軽量更新。|
|MOBILE-01|部分実装|`design-placement-orientation.cjs` と縦横タッチharness。実iPhone/Safariは未検証。|
|I18N-01|実装済|日本語／英語辞書と実ブラウザの切替・配置失敗表示を検証。FITS追加エラーも辞書へ登録。|
|UI-06|実装済|PC・縦横タッチで、選択中の子とは異なる親を実タップし、追加元・面ID・位置の一致と保存を確認。|
|UI-07|実装済|`structure-placement-modes.cjs`, `design-root-placement-ui.cjs`。空の設計では明示したY=0作業面から実ルートを作り、設備・武装には親を要求。ブラウザ証拠は下記。|
|GEO-07|実装済|同上の4接触側と直立姿勢、`placement-curved-contact.cjs` の曲面垂直配置。|
|GEO-08|実装済|曲面・厚み試験の有限張り出し。閉領域と親範囲での接触を確認。|
|GEO-09|実装済|曲面試験の楕円体・円筒・開口・切削、厚み試験の上面／外向き面貫通拒否。複雑度上限あり。|
|GEO-10|実装済|実面へ鏡映点を補正し、親・面・接触側・姿勢を対応。実Mandatorの同じ528三角形の面を保持した実ブラウザで左右2基を確定・保存・再読込。318部品全体の計算時間切れはPERF-01へ記録。|
|ATTACH-01|実装済|構造物試験の隙間・点・辺接触拒否。新接続診断を旧AABB近接診断から分離。|
|ATTACH-02|部分実装|親の移動・回転・寸法と3世代の依存更新。同じ安定面への頂点編集後の再投影を`structure-placement-modes.cjs`で検証。任意の自由形状全体のブラウザ追従は未検証。|
|ATTACH-03|実装済|親削除時の実接触による削除・残存、同親の子同士の接触群の循環防止へ更新。面消滅では編集元を保持。|
|ATTACH-04|実装済|自己参照・循環を拒否。元図面・履歴を変更しない。|
|ATTACH-05|実装済|標準コピーは武装を含む子孫へ拡張。新ID参照と複数選択の重複排除。`browser-exterior-parenting.cjs`で親だけを選択した別艦への貼付まで確認。|
|ATTACH-06|実装済|構造物・Worker保存試験のアンカー／子孫再生成とブラウザUndo/Redo。`browser-design-edit-session.cjs`と`browser-exterior-parenting.cjs`で1回のUndo・保存・再生成を確認。|
|DATA-03|実装済|既存骨組み図面を保持。新接続診断へ旧サンプルを流用せず、既存強度には引き続き使用。|
|DATA-04|部分実装|配置モデル・ソース指紋とprofile版22で派生物を更新。旧図面から再計算し、図面なし旧snapshotは要図面／読み取り専用と明示。キャッシュ全体試験の制約は下記。|
|PHYS-01|実装済|骨組み重量と係数を保持。ノズル支持材の追加質量・HP・費用は実体積から既存材料則で集計し、重複を除く。4艦の差を追加比較へ記録。|
|PHYS-02|実装済|同上。接続診断と縦強度断面評価を別表示し、旧上限を保持する最新指示へ対応。|
|PHYS-03|実装済|同上と推進・熱試験。実給電・慣性・縦強度と実入力に従う発熱を保持。|
|PHYS-04|実装済|支持材の追加質量と熱容量・慣性・加速等を同じCoreから再計算し、機関の機能容積・定格は維持。|
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

## PR初版の検証記録

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

## PR初版の物理比較（ノズル支持台追加前）

[4艦の全比較値とソース指紋](benchmarks/placement-physics-comparison.json)。
変更していないmainで作成・保存した同一図面を使用し、PR初版 `2bd4123` のCoreで4艦すべての
質量・骨組み・HP・装甲重量・価格・定格推力・上限・実入力・発熱・熱容量の
記録した物理値が**丸め前まで完全一致**した。係数の差も0件。
基準値の再利用はソースと図面の全checksumを検証し、当時のCoreで計算を再実行した。後続のノズル支持材追加後の値は別記録を使う。

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

## 実面補正と支持台の先行検証（履歴）

2026-11-08の追加指示に対応する。旧大型鏡映失敗は記録を残し、原因を実面から9.5909mm浮く反転座標と特定した。
選択面の許容差2.4mmに対して、実接点へ補正した候補は同じ厳密判定に合格する。
`design-mirrored-surface-ui.cjs`と`fit-placement-native-mirror.cjs`は実Mandator船体を使い、
対応面のp/n採用、姿勢維持、左右の配置・保存復元、探索失敗時の未確定を確認する。

ノズル支持台は、既存リポジトリの
`assets/source/imperial-ii-user-layout/imperial-ii-upload.json`と隣接manifestを出典として55/56/57を検証する。
これは以前に収録された編集可能図面であり、今回の画像そのものを再構築・検証したものではない。
ベル位置・寸法・方向と機器設定を保ち、共有する閉じた実メッシュを通常表示・色分け・ゴースト・選択へ使う。
支持材の重複を除いた質量を0.3t/m³の既存材料則で加算し、構造材としてHP・費用も集計する。機関の機能容積・定格を増やさない。
この追加質量による物理差はPR初版の「4艦完全一致」と区別する。骨組み重量と既存制限の式・係数は維持する。

最終版のコマンド・ソース指紋・結果は [追加検証一覧](benchmarks/placement-followup-validation.json)。以下の先行試験は各記録のソース指紋・実施時点へ対応する。
4辺化と集約砲群の導入前に、新規23ファイル216件と既存reference-sublight8件の**224件が成功**した。指定関連11ファイルは95成功・22失敗で、
失敗名は変更していないmainと一致。対象キャッシュ2件も成功。追加した2つの支持形状エラーの英訳とmanifestを別途確認した。

|検証|結果と証拠|
|---|---|
|PC・縦横タッチ|[3条件成功](benchmarks/design-placement-followup-browser.json)。実Worker・実ボタン・構造物／武装・Undo/Redo・日英切替。|
|鏡映の実船体面|[実ブラウザ成功](benchmarks/design-placement-mirror-native-hull.json)。親1154の形状・姿勢を保持して他317設備を除外し、同じ面528三角形を使用。約9.59mm補正→実確定2基→実保存画面からの読込で新設計オブジェクト・最新Workerを確認。|
|318部品の全艦|[300秒の候補待ちで時間切れ](benchmarks/design-placement-large-mirror-confirmed.json)。確定2基追加は未検証。別の180秒試行では直後の画像に「配置可能」が見えたが、こちらも確定済みとは数えない。|
|既存ノズル55/56/57|[合成した検証記録](benchmarks/nozzle-support-browser.json)。実支持形状・設定維持、支持台のみを実タップして55を選択、X+1の取消、実設計オブジェクト置換と最新Workerを待った保存・再読込の4段階が成功。|
|支持台なしの陰性対照|[別の実Workerブラウザ試験成功](benchmarks/nozzle-support-negative-browser.json)。3ノズルを実外形から横へ離し、支持形状なし・浮遊警告ありを確認。既存の有効な伝達軸経路による接地は維持。|

ノズルの最初の通し試験は「支持台なしなら必ず未接地」という誤ったassertで停止した。
[元のPARTIAL記録](benchmarks/nozzle-support-browser-positive.json)には、成功した4段階と失敗をそのまま保持する。
旧版2bd4123・現行の両方で、p173→55／p174→56／p175→57の有効な伝達路が船体178へ接続するため、
浮遊警告と全システムの接地判定は別になる。runtimeを変えずに試験条件を訂正し、独立した陰性対照で3基を再確認した。
合成記録を、元の1回の通し試験がすべて成功したという意味にはしない。

再実行: `node scripts/browser-native-mirror-hull.cjs`、
`KS_SUPPORT_WAIT_MS=300000 node scripts/browser-nozzle-support.cjs`、
`KS_SUPPORT_WAIT_MS=300000 node scripts/browser-nozzle-support-negative.cjs`。
陰性対照専用scriptは、保存したpositive記録のfixture・runtime hashと保存時の最新Worker世代も照合する。
全艦の再現は `KS_PROFILE_PAIR_COUNT=1 KS_PROFILE_WAIT_SURFACES=1 KS_PROFILE_VALIDATION_TIMEOUT_MS=300000 KS_PROFILE_URL=http://127.0.0.1:8000 node scripts/browser-responsive-placement.cjs hull`。

画像: [ノズル55の実支持台選択](benchmarks/nozzle-support-browser.nozzle-55-close.jpg)、
[実船体の鏡映2基](benchmarks/design-placement-mirror-native-hull.png)。
共有CPU・SwiftShaderの機能検証であり、隔離した時間・FPS比較ではない。
実図面の取消後の計算確定は単独試行で約116秒、並列試行で約193秒、厳密な保存再読込の計算は約116秒だった。
取消操作そのものは受理して元位置へ戻り、後着結果で巻き戻されない。長いCore計算はPERF-01の残課題とする。
旧15msの再読込は実オブジェクト置換を待てていなかったため、読込完了の証拠には使用しない。

## ノズル支持材4辺化後の4艦比較

[移行比較](benchmarks/nozzle-support-physics-comparison.json)は4艦とも成功。
支持台の根元は4辺とし、実親面の折れ目に必要な分割は維持する。
収録図面の55／56／57では268→28、276→34、258→18三角形、単純な平面・斜面では12三角形。
旧円周多分割の支持キャッシュはアルゴリズムのキー変更で再生成する。ベル本体・噴射口は変更しない。
基準はPR初版2bd4123、同じ保存図面、同じ初期健全状態・balanced・maneuver=1・0.25秒の電力配分。
基準のソースと図面checksumを照合して既測値を再利用し、新Coreの計算は再実行した。
質量差＝重複を除いた支持材質量、HP・価格・熱容量差＝既存材料／共通物理則の結果を検証し、全変化をJSONへ残す。


|艦|支持材（m³）|追加質量（t）|骨組み重量差（t）|実加速 前→後（m/s²）|
|---|---:|---:|---:|---:|
|インペリアルI|108,419.210|32,525.763|0|22,531.638 → 22,516.774|
|インペリアルII|108,419.210|32,525.763|0|22,531.382 → 22,516.521|
|ヴェネター|0.000|0.000|0|29,373.358 → 29,373.358|
|CR90|0.000|0.000|0|0.000 → 0.000|

個々の機関・機械の位置・寸法・設定・定格と、全既存係数は不変。実入力・実推力・発熱も4艦で不変だった。
I／IIの加速や縦強度上限の変化は、支持材を加えた質量を同じ既存公式へ渡した結果であり、
骨組み重量・強度係数・制限の撤廃や変更ではない。旧図面の機器や原アーカイブは書き換えない。
再現: `node scripts/compare-nozzle-support-physics.cjs BEFORE_ROOT OUTPUT_JSON`。


## 最終版: 4辺支持台とトレンチ砲群

最終コマンド・各試験のソース指紋は[検証一覧](benchmarks/placement-followup-validation.json)。
初回の選定288項目は287成功・1失敗だった。棚配置後の標本は担当する実基数で重みを持ち、
4地点が開いても50基中24基（48%）になるため、「半数の地点＝火力50%」という試験側の期待値を訂正した。
ゲームコードは変更せず、当該試験を含む9項目を再実行してすべて成功した。
選定した重複しない288項目はこれで確認済みとし、初回の失敗と再実行をJSONへ分けて記録する。

- 指定関連117項目は95成功・22失敗。変更していないmainと失敗名が一致。
- 追加のエネルギー系36項目は30成功・6失敗。mainでも同じ6件が同じエラー内容で失敗。
- 対象を絞ったキャッシュ2項目は成功。全体キャッシュ試験のSIGKILLを解消したとはしない。
- [独立検証](benchmarks/trench-independent-validation.json)は実作例の母体形状2件と非同期UI10件が成功。
  別の旧manual試験4件はmain・変更版とも失敗し、元の失敗のまま記録した。

[最終ノズル検証](benchmarks/nozzle-lowpoly-browser.json)は、認証済みの収録図面から母体178と
ノズル55／56／57・機械173／174／175・炉48の8部品を保持した実ブラウザで成功。
元の形状・位置・設定を保ち、28／34／18三角形の閉じた4辺支持台、実接触、
支持台のみのタップ選択、実保存画面による設計オブジェクトの置換と最新Workerを待った再読込を確認した。
省略した77設備と51武装を含む全艦検証とは区別する。

[最終トレンチ検証](benchmarks/trench-armament-browser.json)では、8kmの矩形試験船体を実アプリへ読み込み、
実在する炉・燃料・自動化設備を使用した。砲種別の左右合計基数を画面から111→10,021基へ変更しても、
配置済み部品4・集約砲群4・充電区画2・兵装モジュール4のままで、外装砲塔のメッシュは0だった。
これは作例艦の形を置き換えたものではなく、基数と管理量の関係を確認する機能試験用図面である。

実ボタンによるUndo/Redo、保存画面からの再読込、実給電による充電・消費、
実戦闘のトレンチ発射点・標的HP低下まで成功。390×844pxのタッチ条件では、基数入力へのフォーカスと
7個の入力・適用・取消コントロールへのスクロール到達を確認し、文書幅は390pxに収まった。
[修正前の表示崩れ](benchmarks/trench-armament-mobile-before-fix.json)はERRORのまま保持している。
両最終ブラウザ記録は実Workerを使い、配信HTTP・検証前後のソースハッシュ一致も確認した。

実作例の母体形状では、Executorの既存トレンチへPD1,000＋UTL200基、
Mandatorの新しいトレンチへPD1,000＋UTL100基を設定し、それぞれ4砲群・左右2区画で保存・再生成した。
MandatorのUTL160基は面積だけでは入っても行の高さが不足するため拒否する。
砲座の列は寸法を保持する棚配置で証明し、実在する砲座中心から最大8地点を選んで母体の実三角形へ投影する。
遮蔽は実基数の重みで評価し、実際の発射点も開いている地点から選ぶ。

砲種×舷ごとに照準・損傷を共有する集約方式で、各砲の独立した照準・被弾を再現する方式ではない。
保守的な棚配置・片舷1個の充電区画で成立を証明できない複雑な空間は拒否する。
詳しい12条件と残る範囲は[トレンチ砲群の追補](design-trench-armament-addendum.md)へ記載する。
実Safari／実iPhone、318部品全艦の候補待ち、同期の親削除という既存の残課題は維持する。

画像: [4辺のノズル支持台](benchmarks/nozzle-lowpoly-browser.jpg)、
[トレンチ砲群のPC画面](benchmarks/trench-armament-browser.jpg)、
[スマホ幅の入力画面](benchmarks/trench-armament-browser.touch-portrait.jpg)。
