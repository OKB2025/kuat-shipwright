# KUAT SHIPWRIGHT — Claude Code 開発ルール

ブラウザで動く艦船設計・戦闘ゲーム。ビルド工程も `package.json` もない静的サイトです（`index.html`、`js/*.js`、`data/*.js`）。
計算の本体は `js/core.js`、Worker 側は `js/engine.js` が同じ Core を使います。作例艦は `data/examples/<key>/design.json.gz`（準備済み設計）と `data/fleet.js`（性能表）に生成済みで、ソースのハッシュが一致しないと Worker は `Core.buildDesign` で組み直します。

## 常時守ること

- 作業開始時に、ブランチ、`git log -1`、未コミット差分を確認する。指定がなければ最新の `origin/main` を基準にする。
- 既存の実装・資料を読んでから判断する。過去の説明だけで「未実装」と決めない。**仕様**（`docs/` の設計文書・ユーザー指示）、**現在の実装**、**過去の監査結果**（`docs/benchmarks/`）を区別し、現在の挙動を無条件に正しい仕様とみなさない。
- 既存テストの期待値、原本ファイル、許容差、例外、検査コードを変更したら、それはレビュー対象の変更として扱う。根拠と影響を記録し、自動的に新しい正解にしない。
- 検証で作るログ・画像・JSON は、実行ごとに別ディレクトリ（スクラッチパッドまたは `/tmp/ks-verify/<日時>-<内容>/`）へ出す。多くのスクリプトは既定で `docs/benchmarks/` や `tests/helpers/` の基準資料へ書くため、**出力先を必ず引数で指定する**。基準資料を更新するのは、それ自体が意図した変更のときだけ。
- 依存関係やゲーム本体を、検証のためだけに作り替えない。既存の `tests/`・`scripts/` を優先する（一覧と使い方は [docs/claude-verification.md](docs/claude-verification.md)）。
- 未実行・証拠不足を「成功」と報告しない。実行できなかった項目は理由と一緒に書く。
- 文書や設定を書いただけで、検査・CI・モデル切り替えが実現したとは報告しない。

## STL・図面を基にした作例艦を変更するとき

作例艦（`SHIP_EXAMPLES`、`buildDesign`、`data/examples/`、`assets/source/`、`scripts/stl-measure/`、`bridgeLooseStructures` などの後処理）の形状・部品構成・接続処理を変えるときは、作業前に必ず [reference-fidelity-rules.md](reference-fidelity-rules.md) を読み、その規則に従う。要点：

- 「浮いている」「接続エラー」を、原本にない棒・柱・板・台座の追加や形状の膨張で消さない。原因（位置・回転・単位・座標変換・親子関係・分割・再現漏れ・表示）を特定して直す。
- 公式作例は通常の編集可能パーツで再現する。原本 STL を丸ごと表示する方式にしない。
- 判定は partConstraints / referenceShape / physicalValidity / evidenceValidity の 4 項目で行う。

## 担当の呼び分け

主担当（このセッション）が、実装・統合・テスト実行・ブラウザ操作・スクリーンショット・STL 解析・ハッシュ計算・形状測定を行う。レビュー担当（`.claude/agents/`）は Read / Grep / Glob だけを持ち、主担当が用意したコードと証拠を独立に確認する。

| 変更内容 | 呼ぶレビュー担当 |
| --- | --- |
| 数式、単位、質量・推力・抗力・給電・発熱・排熱・燃料、性能値の受け渡し | `physics-reviewer` |
| プレビュー、配置、親子関係、Undo/Redo、保存・再読込、Worker、UI 応答 | `regression-reviewer` |
| STL・図面を基にした作例形状、支持材・接続処理、部品の追加・削除・変形 | `reference-fidelity-reviewer`（物理値が変わるなら `physics-reviewer` も） |

- 変更に関係する担当だけを呼ぶ。指摘は主担当が統合し、大きな共通ファイル（`js/core.js` など）の編集は主担当が行う。
- レビュー担当は主会話の履歴を知らない前提で、依頼には次を必ず含める：要求と変更範囲／基準側・候補側のコミットまたは差分の識別情報／基準の規則・参照資料・許可済み差異／差分テキストや対象ファイル／実行コマンド・ログ・数値・比較画像のパス／未実行項目とその理由。
- 判定は PASS / FAIL / UNVERIFIED。UNVERIFIED を PASS に読み替えない。
- `regression-reviewer` が保存形式や複雑な非同期処理について追加レビューを求めたら、主担当が Opus / high で追加確認する（`physics-reviewer` か一般エージェントに high で依頼、または主担当自身が high で確認）。

### 主担当のモデル運用（セッション側で選ぶ）

- 初回セットアップ、通常の機能追加、小規模修正：Opus 5.5 / medium。
- 作例生成、接続処理、原本照合、複数の仕組みにまたがる大改修：Fable 5.2 / medium（`/model claude-fable-5-2` と `/effort medium` を別々のメッセージで送る）。
- 難しい原因調査・整合性検証では、必要に応じて high。
- この文書に書いてあるだけでは切り替わらない。実際のモデルはセッション情報で確認する。
- レビュー担当のモデルは各定義ファイルの frontmatter で個別に固定している（`inherit` は使わない）。全員のモデルや推論量を一括固定する環境変数は新設しない。

## 完了条件

1. 変更範囲に対応する既存テスト・スクリプトを実行し、コマンドと結果（失敗を含む）を記録した。変更前から失敗していたものは、変更前の結果と並べて示した。
2. UI・Worker・保存に触れたら、ブラウザでの確認または未実施の理由を記録した。
3. 作例形状に触れたら、reference-fidelity-rules.md の 4 項目判定と比較証拠をそろえた。
4. 関係するレビュー担当の判定を受け、FAIL を解消するか、残す理由を記録した。UNVERIFIED は不足証拠と一緒に報告した。
5. 生成物（`data/examples/`、`data/fleet.js`、マニフェスト）を更新したら、`node scripts/update-asset-manifest.cjs --check` が通ることを確認した。
6. コミットし、作業ブランチへ push した。
