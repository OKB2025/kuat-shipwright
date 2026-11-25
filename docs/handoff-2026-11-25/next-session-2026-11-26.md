# 申し送り（2026-11-25 の終わり）：PR #126 の残りと、その後の PR

この文書は 2026-11-25 のセッションの終わりに書いた。前の申し送りは [../handoff-2026-11-20/next-session-2026-11-25.md](../handoff-2026-11-20/next-session-2026-11-25.md)（§2 の原則と §3・§4 の進め方は今も有効）。

常時の指示（ユーザー）：日本語で。終わったらレビューして PR を作り、マージまで進める。

読む順：
1. `CLAUDE.md`、`reference-fidelity-rules.md`
2. この文書
3. [../handoff-2026-11-20/gun-energy-model-2026-11-24.md](../handoff-2026-11-20/gun-energy-model-2026-11-24.md) の「2026-11-25 の決定」以降（砲・体当たり・GR-75 の決定の原文と、レビューの経過）
4. [README.md](README.md)（**ユーザーが自分で書いた記録。編集しない、他の文書へ書き写さない・言い換えない**）と [sensing-trial-request-2026-11-25.md](sensing-trial-request-2026-11-25.md)（索敵・追跡・カーソル・味方撃ちなどの指示の記録）

---

## 1. いまの状態

- ブランチ `claude/inspiring-faraday-kn13yq`、PR **#126（ドラフト）**、基準は main `8c4bcab`（その後 main に入ったのはユーザーの文書コミット `359d421` だけで、作業ブランチへマージ済み）。
- 版：`FLEET_PROFILE_VERSION` 28、`EXAMPLE_PROFILE_VERSION` 11（main には出ていない）。作例 49 件は `bb8b06b` で作り直した。その後の `js/core.js` の変更は戦闘の計算だけで、`update-asset-manifest --check` は通る。
- 全テスト（候補 `ab1dc78`、574 本）：失敗を含むファイルは main 166、候補 167。一覧は `docs/benchmarks/gun-rules-2026-11-24/evidence-2026-11-25/`。

### PR #126 をマージする前に残っているもの

| # | 内容 | 状態 |
| --- | --- | --- |
| 1 | `fleet-record-release`（テスト 3）：Worker が戻したハンマーヘッドの灯りが最大 1.1 mm ずれる | **原因は特定、未修正**。露出の調査が「区画の切り取り後の形があるか」で結果を変えるのに、調査のキャッシュの鍵がそれを含まない。新しく組んだ艦は常に同じ、Worker がキャッシュから戻した艦だけ違う。性能値には及ばない（見た目の灯りだけ）。main にもある仕組み。直し方 2 案と理由は `docs/benchmarks/gun-rules-2026-11-24/evidence-2026-11-25/README.md` の末尾。次の PR（砲ルールの後始末）で、どちらの遮蔽が正しいかを決めて直す |
| 2 | `fighter-interiors`（1 件）：Z-95 の加速が建造目標を超える | ユーザー決定：次の PR で「シールド等を増やして重量を上げる」 |
| 3 | 回帰レビューが求めた、保存形式・キャッシュ・Worker の高い推論量での追加確認 | 未実施 |
| 4 | 原本照合の再レビュー（求められた証拠は `evidence-2026-11-25/` に追加済み） | 未実施。原図そのものがリポジトリに無いので referenceShape は UNVERIFIED のまま残る見込み |
| 5 | ブラウザ確認：体当たり、公試の散布、砲列、実際の Worker 経由のプレビュー、タッチ操作、ユーザーが作った砲列の旧保存 | 未実施。作例を開く確認は `docs/benchmarks/gun-rules-2026-11-24/browser/README.md` |
| 6 | ユーザーの判断（§3） | 待ち |

マージは、1 の扱いが決まり、3・4 を済ませ（または残す理由を PR に書き）、ユーザーの判断を受けてから。

---

## 2. 今回入れたもの（要点。式と値は決定ログとコード）

- レーザーは砲身だけ、ターボレーザーとイオン砲は給電区画（砲 1 門あたり最小 50 m³）。`weaponChargeSpec`、`exampleSeatRoom`（作例の砲座の決め方は元の規則に固定）。
- CR-90：単装 100 MT、4 連装 200 GT。ハンマーヘッド：2 連装 200 MT。`GUN_RULES.turbolaserShot`。
- 砲身が最低コイル長より短い・口径が 0.45 m より細い砲の給電の割り増し `feedK`（★ 数え方はこちらの選択）。
- 間合い：`fleetStandoffDistances / fleetStandoffJudge / fleetStandoff`。散布：`gunSpreadRange`。
- 体当たり：`RAM`、`ramPlate`、`ramShare`、`fleetRamJudge`、`fleetRamStep`。ハンマーの装甲：`SPHYRNA_HAMMER`、`setStructureFaceArmor`。
- 砲座ごとの入力係数 `mount.inputK`（`surfacePowerStep` は入力 TT で持つ）。
- GR-75：`GR75_REMODEL`（`data/imperial2.js`）。反応炉の参照切れは `reactorFor` が最寄りから給電。
- 索敵の検証（ゲーム未接続）：`scripts/sim-sensing-trial.cjs`、`docs/benchmarks/sensing-trial-2026-11-25/`。

---

## 3. ユーザーに判断をもらう点（報告済みか・未報告か）

砲・艦隊戦（PR #126 の本文にも書いた）：
1. 給電の割り増しで余分に入れた電力の行き先（今は熱になるのが 5% だけ）。
2. CR-90 の 200 GT が同型艦のシールドを 1 斉射で抜けること。
3. 設計の兵装消費 `Dw` と砲座の定格入力の合計の 5% の差（main からある）を直すか。
4. 対空の評価値（レーザー以外の砲が 2〜5 倍）を戻すか。
5. 次の PR の順（勧め：真値漏れ＋索敵 → 間合い・行動プリセットの統合）。

索敵（`docs/benchmarks/sensing-trial-2026-11-25/README.md` §12 の 14 項目。大きいもの）：
- 半径 50,000 km では今のセンサーと偵察機でほとんど何も見つからない。届く距離・速度・航続・跳躍・事前情報のどれで釣り合わせるか。
- 「上下を2万キロ」は上下それぞれ 20,000 km でよいか。
- 同時交戦数が 0 の艦（MC75・MC80 など）の追跡の枠。
- 民間でも使われる艦種（GR-75、ゴザンティ、CR90、ヘラクロン級、共和国輸送船）を「不審」のまま推定で敵とみなしてよいか、商船を装えるか。
- 航空機を運用できる小型艦が作例に無い（分派の偵察）。

---

## 4. その後の PR（記録済みの指示）

| 内容 | 指示のある場所 |
| --- | --- |
| 艦のレーザーのガス槽（砲塔部の大きさで決まる、使い切ると再装填）、Z-95 の質量増 | 決定ログ「2026-11-25 の決定」 |
| 点防御は自動のみ（オン・オフ）、砲の種類ごとの選択、ロック、追跡している目標にだけカーソル、共有された追跡 | `sensing-trial-request-2026-11-25.md`、`README.md`（ユーザーの記録） |
| 味方撃ち：張り付いた目標を砲撃から外す、砲撃開始で離脱、損害を許容して飛ばす、防空を機体に任せる（AI に選択肢を持たせる） | `sensing-trial-request-2026-11-25.md` |
| 索敵の実装、新しいマップ（中心の惑星、半径 50,000 km、上下 20,000 km） | 同上、`docs/benchmarks/sensing-trial-2026-11-25/README.md` §13・§14 |
| 戦略マップ専用の移動の廃止（3D 視点の統合時）。体当たりと通り抜けはそのとき戦略マップにも入る | 決定ログ |
| ゴザンティ同士・ハンマーヘッド対レーザーだけの艦が決着しない件、灯りのずれの原因 | `docs/benchmarks/gun-rules-2026-11-24/fleet/README.md`、§1 の 1 |
| 以前からの予定（砲ルールの後始末 B、B2、C、D、E、F2） | 前の申し送り §6 |

---

## 5. 道具と置き場所

- スクラッチパッドはコンテナが作り直されると消える。残したものはすべて `docs/benchmarks/` にある。
- main の写しでテストを流す：`git worktree add <dir> 8c4bcab` → `KS_TEST_ROOT=<dir> node --test tests/<name>.cjs`。全テストの回し方は `evidence-2026-11-25/run-tests.sh`。
- 艦隊戦：`docs/benchmarks/gun-rules-2026-11-24/fleet/saved.cjs`（保存設計から性能表を作る。カタログ用の `data/fleet.js` は砲座を持たないので使わない）、`small.cjs`。
- 生成の順：`update-craft-costs` → `refresh-examples` → `update-asset-manifest`（行のモデルキーが機体価格表のハッシュを含むため）。
- ブラウザ：`docs/benchmarks/gun-rules-2026-11-24/browser/`（`emblem.cjs`、`claser-new.cjs`、`examples-open.cjs`）。作例 1 隻を開くのに 10 分ほどかかる。
