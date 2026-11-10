# 次のセッションへの引き継ぎ：自動支柱・接続処理と STL 参照形状の調査・修正

## 開始手順

1. 作業元を選ぶ。
   - 設定用 PR が**未マージ**なら、ブランチ `claude/kuat-shipwright-claude-setup-u9sok1`（設定コミット `__SETUP_COMMIT__` 以降）から新しいセッションを開始する。
   - **マージ済み**なら、設定を取り込んだ最新の `main` から開始する。
2. 主担当を Fable 5.2 / medium に切り替える。次の 2 つを**別々のメッセージ**で送る。

   ```
   /model claude-fable-5-2
   ```

   ```
   /effort medium
   ```

   文書に書いただけでは切り替わらないので、切り替わったかをセッション情報で確認する。難しい原因調査では必要に応じて `/effort high` にする。
3. 下の依頼文をそのまま貼る。

---

## 依頼文（そのまま貼る）

KUAT SHIPWRIGHT（OKB2025/kuat-shipwright）の作例艦で、現行コードの自動支柱・接続処理（`bridgeLooseStructures`）と、STL 参照形状の扱いを調査し、原因に対応して修正してください。

### 最初に読むもの

1. `CLAUDE.md`
2. `reference-fidelity-rules.md`（全文。この作業はこの規則に従う）
3. `docs/claude-verification.md`（検証コマンドと既知の失敗）
4. `docs/structure-contact-v24.md`、`docs/cis-stl-rebuild.md`、`docs/executor-stl-rebuild.md`、`scripts/stl-measure/README.md`

作業開始時に、ブランチ・コミット・未コミット差分を確認し、基準コミットを記録してください。

### 確認済みの関連コードと生成経路（設定導入時点、`dbe9ff9`）

- `js/core.js` の `function bridgeLooseStructures(ship)`：形どうしで接地していない構造物ごとに、真下（吊り下げなら真上）の接地済み構造物・船体まで `form:'box'`、ラベル「…の接続支柱」の `struct` を `placePart` で追加する。接触の許容差は全長の 0.1%（0.5〜3 m）、ギャップ上限 `max(60, 高さ×4)`。
- 呼び出し元：`buildDesign(key)` の `finish` の最後（`refitShipSystems` → `ensurePrimaryHull` → `bridgeLooseStructures`）。すべての作例に適用される。
- 接触判定：`groundingStats(ship, S)`（`js/core.js`）。
- 生成経路：`buildDesign` → `scripts/refresh-examples.cjs`（`scripts/example-files.cjs`、`scripts/update-ship-examples.cjs`）→ `data/examples/<key>/design.json.gz` と `data/examples/manifest.json`、`data/fleet.js`。Worker（`js/engine.js` の `loadExample`）は、ソースの SHA-256 が一致すれば準備済み設計を読み、不一致なら `buildDesign` で組み直す。IndexedDB の `k:<key>` キャッシュもある。
- `assets/source/ship-example-blueprints/*.json.gz` は `data/examples/` とは内容が異なる別資料（用途を確認すること）。
- 生成物中の支柱数：executor 26/322、munificent 4/301、lucrehulk 3/232、lh3210 3/238、nebulonb 2/80、recusant 2/372、recusantDn 2/364、mc80home 1/90。`docs/structure-contact-v24.md` の表と nebulonb・recusant が一致しない。

### 原本・図面・測定資料

- リポジトリ内：`assets/source/arquitens.stl`、`arquitens_turret.stl`、`sphyrna-hull.stl`、`cr90/cr90-corvette-standard.stl.gz`、`corvette-weapons/*.STL`（ハッシュは reference-fidelity-rules.md §8）。
- リポジトリにない：支柱が付く艦の原本 `Executor_Complete.stl`、`CIS_Munificent_D.stl`、`Lucre_Combined_HD.stl`、`Recusant.stl`。nebulonb・mc80home は原本の種類自体が未確認。測定値は `js/core.js` のデータブロックと `scripts/stl-measure/` の手順だけ。
- 原本がない艦は、ユーザーに提供を依頼し、受け取るまで referenceShape を UNVERIFIED とする。現在の作例や生成物を原本の代わりにしない。

### 要求

- 原本にない支持材（棒・柱・板・台座）を追加したり、形状を膨らませたり、空隙を埋めたりして「浮き」を消さない。
- 浮いた原因（層の間のすき間の測定、座標・単位・軸変換、親子関係、部品分割、測定の最小体積で省いた部位、判定の許容差、表示）を作例・部品ごとに特定し、原因に対応して直す。
- 既存の正当な支持材を一括削除しない。各支柱について、原本上の対応箇所・仕様上の根拠の有無を調べ、個別に扱う。`bridgeLooseStructures` 自体を変える・外す場合は、すべての作例への影響を一覧にする。
- 通常の編集可能パーツによる再現を保つ。原本 STL を丸ごと表示する方式にしない。
- 期待値・許容差・検査コードを変える場合は、根拠と影響を記録する。

### 変更後に必要な確認

- 対象作例について、変更前後の部品差分（追加・削除・変形）と支柱数。
- 全体シルエット（側面・平面・正面）と変更部位の拡大画像、必要な断面・空隙の比較。原本がある艦は原本と、ない艦は変更前の作例と比較し、後者は「原本照合ではない」と明記する。
- `KS_FIGURES_KEYS=<対象> node --test tests/example-figures-regression.cjs` などで質量・強度・加速度・熱容量の前後比較（現行 main で munificent・nebulonb が既に不一致なので、基準側の結果も並べる）。
- `node --test tests/structure-contact*.cjs tests/native-structure-contact-cut.cjs tests/external-engine-enclosure.cjs` と `groundingStats` の結果。
- `buildDesign` の結果と再生成した `data/examples/<key>/design.json.gz` の一致、`node scripts/update-asset-manifest.cjs --check`。
- 保存・再読込（`serialize`/`deserialize`、ブラウザでの保存）後の形状。
- ログと画像は実行ごとに別ディレクトリへ出し、`docs/benchmarks/` の既存資料を上書きしない。

### レビューと判定

- `reference-fidelity-reviewer` を中心に独立レビューを受ける。物理値が変われば `physics-reviewer`、保存・Worker・生成物に触れれば `regression-reviewer` も呼ぶ。
- 依頼には、要求と変更範囲、基準・候補のコミット、原本の所在とハッシュ、比較規則・許可済み差異、差分、実行コマンド・ログ・数値・画像のパス、未実行項目と理由を含める。
- 作例ごとに partConstraints / referenceShape / physicalValidity / evidenceValidity を PASS / FAIL / UNVERIFIED で報告する。

### 完了地点

作業ブランチへコミット・push し、Draft PR を作成する。最終報告に、作例ごとの 4 項目判定、残った UNVERIFIED と必要な資料、未実行の確認を含める。
