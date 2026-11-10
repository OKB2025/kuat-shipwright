# Claude Code 用 検証手順

CLAUDE.md から参照する、変更内容ごとの検証方法です。ここに書いたのは 2026-11-10 時点（基準 `main` = `dbe9ff9`）でリポジトリに実在する方法です。新しい検査スクリプトや CI は作っていません（「未実装の検査」を参照）。

## 共通事項

- ビルド工程・`package.json`・CI 設定（`.github/`）はない。テストは Node 組み込みの `node:test` を `node --test <file>` で直接実行する。外部 npm 依存はない（ブラウザスクリプトの `playwright` を除く）。
- 単体テスト（`tests/*.cjs`、456 件）は `vm` で `data/reference.js`、`data/imperial2.js`、`data/fleet.js`、`js/core.js` を読み込んで Core を直接呼ぶ。ブラウザ不要。
- `KS_TEST_ROOT=<別のチェックアウト>` で、別の版（例：`git worktree add /tmp/ks-base <基準コミット>`）を同じテストで検査できる。変更前後の比較に使う。
- 確認した環境：Node v22.23.4、Python 3.13.18（numpy あり、trimesh なし）、Playwright とヘッドレス Chromium（`/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`）。
- **出力先**：実行ごとに `OUT=/tmp/ks-verify/$(date +%Y%m%dT%H%M%S)-<内容>` を作り、ログ・JSON・画像をそこへ出す。多くの `scripts/*.cjs` は第2引数を省くと `docs/benchmarks/` の基準資料に書き込むので、**必ず出力先を引数で渡す**。`scripts/capture-example-figures.cjs` は `tests/helpers/example-figures.json`（期待値）を書き換えるので、意図した数値変更のときだけ使う。
- 変更前から失敗しているテストがある（下の「今回の実行結果」）。結果は必ず基準側と並べて、今回の変更による失敗かを区別する。

## ブラウザ検証の準備

```sh
python3 -m http.server 8765 --bind 127.0.0.1 &        # リポジトリ直下で
export CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome  # 既定の /usr/bin/chromium はこの環境にない
node scripts/browser-<name>.cjs http://127.0.0.1:8765/ "$OUT/<name>.json"
```

- `scripts/browser-*.cjs`（約 60 本）は `window.__yard` と `YardEngineClient.mode`（`'worker'` を要求するものが多い）を使い、実 Worker・WebGL で操作する。失敗時は出力 JSON の隣に `*.failed.jpg` を残すものがある。
- 2 本（`browser-native-mirror-hull.cjs`、`browser-responsive-placement.cjs`）は `CHROMIUM_PATH` を読まない。Playwright 既定のブラウザで動くか、実行して確認すること。
- 主な環境変数：`CHROMIUM_PATH` / `KS_CHROMIUM_PATH`、`CHROMIUM_SINGLE_PROCESS`、`REQUIRE_WORKER`、`KS_ENGINE_READY_TIMEOUT_MS`、`*_EXPECT_CORE`（期待する core.js ハッシュ）。

## 変更内容ごとのコマンド

### 数式・物理値（physics-reviewer の証拠）

| 目的 | コマンド | 入力・注意 |
| --- | --- | --- |
| 作例の計算値の回帰 | `KS_FIGURES_KEYS=<key,...> node --test tests/example-figures-regression.cjs` | 期待値は `tests/helpers/example-figures.json`。全艦は非常に長い（2 艦で約 3.5 分）。差分は `項目: 旧 → 新` で出る |
| 推進・機関 | `node --test tests/propulsion-*.cjs`、`tests/engine-core-*.cjs`、`tests/mass-calibrated-propulsion.cjs` | |
| 給電・熱・燃料 | `tests/thermal-*.cjs`、`tests/global-ship-heat.cjs`、`tests/fuel-energy-accounting.cjs`、`tests/electrical-*.cjs`、`tests/propulsion-power-heat.cjs` | |
| 性能表と Worker 価格 | `tests/craft-price-worker.cjs`、`node scripts/update-craft-costs.cjs --check` | |
| 前後比較の補助 | `scripts/compare-propulsion.cjs`、`scripts/compare-placement-physics.cjs IMMUTABLE_MAIN_ROOT OUTPUT_JSON`、`scripts/validate-reference-acceleration.cjs` | 基準側は不変のチェックアウトを用意 |

### UI・配置・親子関係・Undo/Redo・保存

| 目的 | コマンド |
| --- | --- |
| 保存・識別・再読込 | `node --test tests/local-save-store.cjs tests/design-save-identity.cjs tests/load-cache.cjs tests/saved-link-limit.cjs tests/surface-unplaced-save-core.cjs` |
| 親子関係・配置 | `tests/exterior-equipment-parenting.cjs`、`tests/design-tap-parent-ui.cjs`、`tests/design-interior-host-ui.cjs`、`tests/placement-*.cjs`、`tests/structure-placement-modes.cjs` |
| プレビュー | `tests/editor-preview-incremental.cjs`、`tests/design-native-structure-preview-ui.cjs`、`tests/structure-height-preview-*.cjs` |
| ブラウザ（配置・Undo/Redo・保存） | `scripts/browser-design-placement.cjs`、`browser-design-edit-session.cjs`、`browser-exterior-parenting.cjs`、`browser-root-placement.cjs`、`browser-interior-placement.cjs` |

`tests/*-ui.cjs` は `js/app.js` のソースを読み、DOM を模して検査する。実画面の見た目・タップ位置はブラウザスクリプトか目視が必要。

### Worker・非同期・キャッシュ

| 目的 | コマンド |
| --- | --- |
| 世代管理・古い結果の破棄 | `node --test tests/placement-worker-generations.cjs tests/placement-worker-priority.cjs tests/placement-worker-integration.cjs tests/editor-worker-snapshots.cjs` |
| 準備済み設計・キャッシュ | `tests/prepared-ship-cache.cjs`、`tests/structural-survey-cache.cjs`、`tests/surface-client-cache-core.cjs`、`tests/startup-preload.cjs` |
| 実 Worker | `scripts/browser-prepared-ship-cache.cjs`、`browser-full-placement-latency.cjs`、`browser-mass-drag-throttle.cjs` |

### 作例形状・STL（reference-fidelity-reviewer の証拠）

| 目的 | コマンド・方法 | 入力 |
| --- | --- | --- |
| 原本ハッシュ | `sha256sum assets/source/<file>`（gz は `zcat … \| sha256sum`）とマニフェストの `source_sha256` を比較 | リポジトリ内の原本のみ（reference-fidelity-rules.md §8） |
| 原本との寸法照合（実装済みの例） | `node --test tests/arquitens-model.cjs`（STL の屋根高さを直接測る）、`tests/corvette-stl-provenance.cjs`、`tests/light-ship-engine-layout.cjs` | arquitens.stl、cr90、sphyrna |
| 接地・接触判定 | `tests/structure-contact.cjs`、`tests/structure-contact-cut.cjs`、`tests/native-structure-contact-cut.cjs`、`tests/external-engine-enclosure.cjs` | 判定ロジックだけ。原本一致は見ない |
| 生成物の整合 | `node scripts/update-asset-manifest.cjs --check`、`scripts/audit-ship-examples.cjs`、`scripts/replay-ship-examples.cjs` | |
| 生成物の再生成 | `node scripts/refresh-examples.cjs --keys <a,b>` | `data/examples/`・`data/fleet.js`・マニフェストを書き換える。意図した変更のときだけ |
| STL 測定 | `scripts/stl-measure/*.py`（README 参照）、`scripts/import-*.py`、`scripts/analyze-arquitens-reference.py` | スクリプト内に原本パスが直書き。多くの原本はリポジトリにない |
| 支持材の数 | 生成物の `parts` からラベル「接続支柱」を数える（下の例） | |
| 画像 | `scripts/browser-ship-examples.cjs`、`scripts/browser-arquitens.cjs` | 比較画像の視点は固定されていない |

支持材の数え方（主担当が Bash で実行）：

```sh
node -e "const fs=require('fs'),z=require('zlib');for(const k of fs.readdirSync('data/examples')){const f='data/examples/'+k+'/design.json.gz';if(!fs.existsSync(f))continue;const j=JSON.parse(z.gunzipSync(fs.readFileSync(f)));const n=j.parts.filter(q=>/接続支柱/.test(q.label||'')).length;if(n)console.log(k,n,'/',j.parts.length)}"
```

## 自動化の状況

| 区分 | 内容 |
| --- | --- |
| 自動化済み | Core の計算・保存・Worker 世代管理の単体テスト、作例の計算値ダイジェスト、生成物マニフェストの整合、arquitens/cr90/sphyrna の一部寸法照合、ブラウザ操作スクリプト（手動起動） |
| 目視が必要 | 作例の全体シルエットと局所形状、支持材が原本にあるかの判断、継ぎ目と余計な外形の区別、タッチ操作の感触 |
| 未実装 | 汎用の STL 対 作例の形状比較（断面・空隙・ハウスドルフ距離など）、比較画像の固定視点撮影、`bridgeLooseStructures` の追加物を一覧・差分化する検査、CI による強制実行（`.github/workflows/` なし）、全テストを一度に回す入口 |

## 今回（設定導入時）の実行結果

出力先：`/tmp/claude-0/…/scratchpad/verify-20261110T140235/`（セッション内の一時領域。リポジトリには含めない）。基準 `dbe9ff9`。

| コマンド | 結果 |
| --- | --- |
| `node --test tests/external-engine-enclosure.cjs tests/arquitens-model.cjs` | 15 件中 12 成功・**3 失敗**（arquitens-model：部品数 期待 94／実際 270、推進ポッド内機関が船体外、全長 325.6 ≠ 325）。変更前（main）からの失敗で、テストと生成物のどちらが仕様に合っているかは未判断 |
| `KS_FIGURES_KEYS=munificent,nebulonb node --test tests/example-figures-regression.cjs` | 6 件中 4 成功・**2 失敗**（munificent の MGLT 0 → 24.59 など、期待値ダイジェストが最新の core.js と不一致）。意図した変更か不具合かは未判断 |
| `node --test tests/structure-contact.cjs tests/corvette-stl-provenance.cjs tests/local-save-store.cjs tests/placement-worker-generations.cjs tests/design-save-identity.cjs tests/prepared-ship-cache.cjs` | 45 件すべて成功 |
| `node scripts/update-asset-manifest.cjs --check` | 成功 |
| `scripts/browser-root-placement.cjs`（CHROMIUM_PATH 指定） | ページ起動は成功、**スクリプトが失敗**：`[data-design-category="equipment"]` が現行 UI にない（分類が Structures / Propulsion / Weapons / Command and communications / User Parts に変わっている）。スクリプトの陳腐化 |
| 全テスト・全ブラウザスクリプト・作例の再生成 | 未実行（時間とスコープのため） |
