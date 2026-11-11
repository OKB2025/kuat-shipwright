# 原本照合規則（STL・図面を基にした作例艦）

STL・図面・写真測定を基にした作例艦の形状、部品構成、接続・支持処理を変更するときの規則です。主担当はこの規則に沿って作業・証拠作成を行い、`reference-fidelity-reviewer` はこの規則で判定します。詳細な実行手順は [docs/claude-verification.md](docs/claude-verification.md) を参照。

## 1. 原本に基づいて原因を直す

- 「部品が浮いているので修正して」「接続エラーを消して」という指示は、原本にない支柱・棒・柱・板・台座を追加する許可ではない。
- まず原因を調べる：位置、回転、単位・縮尺、座標変換（軸の入れ替え・反転・原点）、親子関係（`host` / 親の削除・移動）、部品分割、再現漏れ（原本にあるのに測定から落ちた部位）、測定の最小体積による省略、表示処理（描画だけのずれ）、接触判定の許容差。
- 原因に対応する修正を選ぶ。例：位置ずれなら座標を直す、層の間のすき間なら原本の断面を測り直して層の範囲を正す、再現漏れなら原本にある部位を通常パーツで再現する。
- 棒・柱・板・台座を追加する、または形状を膨らませる（寸法拡大・空隙の埋め立て）場合は、**原本上の対応箇所**（座標・断面・画像で示す）か**明示的な許可**（ユーザー指示や仕様文書の該当箇所）が必要。
- 既に仕様上認められている支持材（例：仕様文書に根拠がある砲座・支持構造）は、その根拠を確認して扱う。根拠を確認せずに一括削除しない。根拠が見つからないものは「根拠不明」として記録し、個別に判断する。

## 2. 通常パーツで再現する

- 公式作例は、ユーザーが編集画面で扱える通常の編集可能パーツ（`Core.PARTS` に属し、`form` が `reference` や `mesh` でないもの、`skinAsset` に依存しないもの）で組む。
- 原本 STL 全体をそのまま表示・読み込みして外観だけ一致させる方式に置き換えない。原本からは寸法を測るだけで、三角形をゲームに入れない（`docs/cis-stl-rebuild.md`、`docs/executor-stl-rebuild.md` の方針）。

## 3. 比較基準を作業開始時に固定する

作業開始時に次を確認して記録する（作業メモまたは PR 本文）：

| 項目 | 記録する内容 |
| --- | --- |
| 原本の所在 | リポジトリ内のパス、またはリポジトリ外（ユーザー提供）であること |
| ハッシュ | SHA-256（gzip の場合は展開後の値も）。マニフェストの `source_sha256` との一致 |
| 単位・縮尺 | 原本 1 単位あたりの m、縮尺の基準（例：全長） |
| 座標軸・向き | 原本軸からゲーム座標（艦尾 x=0 で艦首へ +x、最低点からの高さ y、右舷 +z）への写像と反転 |
| 比較規則 | 断面位置、許容差、比較する指標 |
| 許可済み差異 | 省略してよい細部、仕様で認めた支持材など。根拠つき |

- 原本や許容差を確認できない場合、都合のよい値を作らない。その項目は UNVERIFIED とし、必要な資料を挙げる。
- 現在の作例や生成物（`data/examples/*/design.json.gz`、`assets/source/ship-example-blueprints/`、`tests/helpers/*.json`）を、自動的に原本の代わりにしない。それらは「現在の実装」であり、比較の対象である。
- 候補側（変更後）で変わった原本、期待値、許容差、例外、検査コードはレビュー対象。仕様変更に伴う更新には、根拠と影響を記録する。

## 4. 最終形状まで確認する

- 生成直後の途中状態だけでなく、後処理（自動接続、支持材追加、`refitShipSystems`、`ensurePrimaryHull`、`bridgeLooseStructures` など `buildDesign` の `finish` 内の処理）を通った後の形状を確認する。
- Worker が読む準備済み設計（`data/examples/<key>/design.json.gz`）と、`buildDesign` による組み直し結果が一致しているか確認する。
- 保存・再読込（`Core.serialize` / `deserialize`、ブラウザの保存）後も形状が保たれるか確認する。

### 既知の後処理：`bridgeLooseStructures`

- 現行コード：`js/core.js` の `function bridgeLooseStructures(ship)`。`buildDesign` の `finish` の最後（`ensurePrimaryHull(out)` の直後）から、すべての作例に対して呼ばれる。
- 動作：形どうしで接地していない構造物ごとに、真下（吊り下げなら真上）の接地済み構造物または船体まで、`form:'box'`、ラベル「…の接続支柱」の `struct` を `placePart` で追加する。
- 根拠文書：`docs/structure-contact-v24.md`。原本上の対応箇所は示されていない。
- 2026-11-10 時点（`dbe9ff9`）の生成物での支柱数：executor 26、munificent 4、lucrehulk 3、lh3210 3、nebulonb 2、recusant 2、recusantDn 2、mc80home 1。文書の表とは nebulonb・recusant が一致しない。
- これらの支柱は、原本にない追加物である可能性が高い。後続作業で、浮いた原因（層の間のすき間の測定、座標、省略された部位）を調べ、原因に対応して直す。
- 2026-11-10：ミュニフィセントの 4 本は、`buildMeasuredSolids` の測定行の間引き（`fairRows`）で構造物の端の断面が失われたことが原因と確認した（#306・#307・#309 は原本の連結成分・断面で、#308 は端の範囲の回復で確認）。端の行をまとめる修正で 0 本になった。ただし referenceShape・physicalValidity は全体シルエット・全部品の原本比較・保存後の確認が残っており UNVERIFIED（`docs/dev-status-2026-11.md` §2.1）。

## 5. 全体と局所を確認する

- 全体シルエット（側面・平面・正面）に加え、変更部位の拡大画像、必要な断面・空隙の比較、部品の追加・削除・変形の差分（ID、`k`、`form`、`c`、`s`、ラベル）を確認する。
- 平均一致度や全体の重なり率だけで合格にしない。局所で原本にない形が増えていないかを見る。
- 正しく分割された通常パーツ同士の内部境界（継ぎ目）を、余計な外形と取り違えない。外形の比較は外側の表面で行う。

## 6. 物理値への影響を確認する

- 追加・削除・変形による質量、体積、強度、加速度、熱容量、価格などの変化を `Core.computeStats` の前後比較で確認する（`tests/example-figures-regression.cjs`、`scripts/capture-example-figures.cjs`）。
- 接続エラーや `groundingStats` の警告が消えたことだけで修正完了としない。
- 物理値が変わったら `physics-reviewer` にも確認を依頼する。

## 7. 判定（4 項目）

各項目を PASS / FAIL / UNVERIFIED で判定する。

| 項目 | 内容 |
| --- | --- |
| partConstraints | 通常の編集可能パーツだけで再現しているか。部品制約（種類、`form`、寸法上限、親子関係）を満たすか |
| referenceShape | 原本形状と許可済み差異に適合するか。原本にない追加・膨張・埋め立てがないか |
| physicalValidity | 修正後の接地・接続の扱いと、物理値の変化が妥当か |
| evidenceValidity | 正しい原本（ハッシュ一致）、正しい対象版（コミット）、正しい規則、実際の実行結果で検証されているか |

- 原本や計測結果が足りない場合は該当項目を UNVERIFIED とし、必要な資料・測定を具体的に示す。
- 設定導入の完了と、個別作例の形状検証の完了は別のもの。原本不足は個別作例の判定を UNVERIFIED にするが、他の作業を止める理由にはならない。

## 8. 原本の所在（2026-11-10 時点）

リポジトリ内にある原本（SHA-256）：

| ファイル | SHA-256 | 対応する作例・用途 |
| --- | --- | --- |
| `assets/source/arquitens.stl` | `e0c6b655…f108`（`arquitens-manifest.json` と一致） | アークイテンス級 |
| `assets/source/arquitens_turret.stl` | `60dc892a…06aa` | アークイテンス級の砲塔 |
| `assets/source/sphyrna-hull.stl` | `51721654…6a25`（`sphyrna-hull-manifest.json` と一致） | ハンマーヘッド級（スフィルナ改装） |
| `assets/source/cr90/cr90-corvette-standard.stl.gz` | 展開後 `a9f7b02f…a5ad`（`cr90/hull-manifest.json` と一致） | CR90 |
| `assets/source/corvette-weapons/*.STL` | 各ファイル（`cr90/hull-manifest.json` 参照） | CR90・ハンマーヘッドの武装 |

注：`corvette-weapons/6-HammerheadClassCorvette-2.STL` は `sphyrna-hull.stl` と同一ハッシュ。

2026-11-10 にユーザーから受け取った原本：

| ファイル | SHA-256（展開後） | 対応する作例 |
| --- | --- | --- |
| `assets/source/cis-stl/Recusant.stl.gz` | `63c28bfa515c465a63fda41cfbc522276304ae5faf8b89cfe90608dc9e726d8f`（`cis-stl/manifest.json`） | レキューザント級・弩級 |
| `assets/source/cis-stl/CIS_Munificent_D.stl.gz` | `2e56f66a02697db0b4a6b044c6dfb7055b46fb16c627fe7806d18b980367a1f3` | ミュニフィセント級 |
| `assets/source/cis-stl/Lucre_Combined_HD.stl.gz` | `75c286e6d727a5c5d2de924622d481c7b8f2993285eed206d93c42885f89b1df` | ルクレハルク級・LH-3210 |
| エグゼクター（7 分割、リポジトリ外） | `docs/dev-status-2026-11.md` §4 | エグゼクター級。3D 印刷用の分割部品で、各部品が別の座標（mm）。組み立ての位置合わせが必要 |

以前の測定に使ったファイルのハッシュは記録がないため、同一ファイルかは未確認（外接箱は作例と 1% 以内で一致）。照合ツールは `scripts/stl-check/`。

リポジトリにない原本（文書・スクリプトに名前だけある）：`Executor_Complete.stl`、`Recusant.stl`、`CIS_Munificent_D.stl`、`Invisible_Hand.stl`、`Lucre_Combined_HD.stl`、`Acclamator.stl`、`MC30CFrigate.STL`、`MandatorIIClassDreadnaught.STL`、`onager_fixed.stl`、`Malevolence.stl` など。CIS 3 隻の原本は上の表のとおり受け取った。エグゼクターは分割原本の組み立てが済むまで UNVERIFIED。測定値は `js/core.js` に埋め込まれたデータブロックと `scripts/stl-measure/` の手順だけが残っている。nebulonb と mc80home は、STL を基にしたという記録自体を `docs/` で確認できていない（参照資料の種類から未確認）。
