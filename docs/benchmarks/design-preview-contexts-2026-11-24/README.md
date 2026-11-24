# 設計画面で部品を見ていくと落ちる（2026-11-24）

ユーザー：「部品を置こうといろんな部品を見てたら落ちた」（新規設計、何も載せていない状態）。

- 原因：部品を選ぶたびに設計ドロワーが描き直され、部品の実形状プレビュー（`#designPartPreview`）の canvas が新しくなる。そのたびに `new Gfx.Renderer(canvas)` で WebGL コンテキストを作り、古いものは buffer を消すだけでコンテキストを離していなかった。ブラウザの上限（デスクトップの Chrome で 16、スマートフォンはもっと少ない）を超えると、最も古いコンテキスト＝3D 表示（`#cv`）が失われる。
- 再現（修正前、parts.cjs、デスクトップ Chrome）：部品を 17 個見たところで「Too many active WebGL contexts. Oldest context will be lost.」、最初に失われたのは `cv`。55 個で作られたコンテキスト 45。
- 修正：プレビューの描画器を 1 つだけ持ち、新しい canvas の位置に前の canvas を差し替えて使い回す（js/app.js designUISchedulePreview）。前の部品のメッシュは `Renderer.drop` で消す。`Renderer.dispose` は `WEBGL_lose_context` でコンテキストもすぐ離す（js/gfx.js）。
- 修正後：部品 55 個でコンテキスト 2（3D 表示とプレビュー）、失われたもの 0。毎回 GC した後のヒープは 130〜138 MB で増えない。プレビューの画像：preview.png。
- 実行：`node parts.cjs <repo> <outdir> 60`（出力は /tmp/ks-verify/20261124-newdesign-crash/）。

## テストとレビュー

- 通過：weapon-support-preview 8/8、design-continuous-placement-ui 7/7、design-native-structure-preview-ui 3/3、example-files 6/6。
- 失敗（main 8c4bcab でも同じテスト名で失敗。変更前から）：screenshot-renderer 4（Renderer の decals 未定義）、surface-exposure-review 5、design-edit-session-ui 2（親の削除で子孫を隠す試験。親子関係は #122 で撤廃済みで、期待している個数が今の挙動と合わない。プレビューとは無関係）、design-info-duplicate-carousel-ui 1。
- regression-reviewer：PASS（条件付き）。指摘 1「部品がないとき前の部品の絵が残る」→ そのときはプレビューを隠すように直した。指摘 2（失敗時の注記の重複）は変更前からの挙動で今回は変えない。指摘 3 は修正不要。Opus/high の追加レビューは不要との判断。
