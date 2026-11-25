# 申し送り（2026-11-25）：砲ルール PR の残り作業

ブランチ `claude/jolly-cannon-psv61o`（基準 main `8c4bcab`）。PR は**まだ作っていない**。ユーザー指示は「終わったらレビューして PR を作ってマージまで進めて」「日本語で」。決定ログは `gun-energy-model-2026-11-24.md`、テスト期待値の変更記録は `docs/benchmarks/gun-rules-2026-11-24/expectation-changes.md`。

## いまの状態

このコミットには、2 回目のレビューで FAIL になった点の修正コードが入っている。**作例（data/examples・data/fleet.js）はまだこのコードで作り直していない**（作り直しは実行中に引き継ぎになった）。

### このコミットで入れた修正（未レビュー）

- 原本照合レビューの FAIL 3 件（`js/core.js` の `reshapeGunBarrels` / `decodeReference`）
  1. モン・カラマリ球形砲：図面の比を「球の輪郭（中心＋半径）から砲口まで」で当てる（前は球の内側の `exposedStartX` から。見える砲身が 3〜7% 短かった）。実測：34TT 1.000、80TT 1.550、200TT 1.750、3連装 1.450、イオン 1.500。3 連装も側面図の輪郭（x=8）基準にした（レビュー担当の式 √(R²−z²) とは違う。理由を README に書くこと）。
  2. 点防御 2 連装：太くし始める位置の手前にできた「くびれ」を埋める（`neckFill`）。実測：x 1.68 の輪が 0.152 → 0.182。
  3. 150TT イオン球：先細り区間（4.357〜9.749）は元のまま。伸ばした分は先細りの後ろに入れ、つば・砲口の凹みは砲口と一緒に前へ移す。先細りの終わり（r 0.447）からつば（r 0.491）までは 11.8 m のごく緩い広がりになる（新しい頂点は足していない）。`taperEndXM` は描いた形と一致。`tests/ion-barrel-style.cjs` は期待値変更前（833ca35）に戻して 3/0。
  - 軸方向プロファイルの実測：`/tmp/ks-verify/20261125-profiles/{main,before-fix,after-fix,after-fix2}.txt`（スクリプト `/tmp/ks-verify/prof.cjs <root> id,id`）。コンテナが消えていたら取り直して `docs/benchmarks/gun-barrels-2026-11-24/` に保存する。
- 物理レビューの FAIL / 注意
  1. 公試の (1+c) 二重計上：`js/app.js` `trialTurretState` の `costK` から `weaponChargeFactor` を外した（バンクは届くエネルギーの単位で貯まる）。`tests/capital-turret-trial.cjs` の「使った蓄電」を 700 TT に戻した（6/0）。expectation-changes.md の該当記載（2,103.7 TT）は**未修正**。
  2. 砲台の `power` の二重計上：`surfaceProfile` の `power` を `d.power × weaponInputFactor ÷ weaponCharge`（＝ d.power/eta）に。
  4. 戦闘の蓄電要求：`room × weaponInputFactor(p)`（1/eta 込み）に。
- `tests/point-defense-minimum-render.cjs`：`reshapeGunBarrels` の引数が増えたので差し込み文字列を追従（4/0）。
- 確認済みテスト（この作業ツリー）：capital-turret-trial 6/0、ion-barrel-style 3/0、moncal-turret-models 3/0、point-defense-minimum-render 4/0、capital-turret-models 18/0、light-turret-family 9/0、broadside-battery-gfx 2/0、weapon-family-models 9/3（3 件は main と同じ）。ログ `/tmp/ks-verify/20261124-dfix/*.3.log`。

## 次にやること（順番）

1. `node scripts/refresh-examples.cjs --jobs 3 > /tmp/ks-verify/<日時>-refresh/refresh.log`（全 49 隻、1〜1.5 時間。実行中は `js/core.js` を触らない）。終わったら `node scripts/update-craft-costs.cjs`（＋`--check`）、`node scripts/update-asset-manifest.cjs`（＋`--check`）、コミット、push。
2. 証拠の取り直し（どれも最終コミットで）：
   - 艦ごとの比較 `docs/benchmarks/gun-barrels-2026-11-24/ships.md`：`node /tmp/ks-verify/shipcmp.cjs <root> <out.json> <keys>`（保存済み設計→`Core.deserialize(JSON.parse(...))`→`computeStats`。スクリプトが消えていたら ships.md の説明から作り直す）。GR-75 と作例機も表に入れる。
   - 砲の比較画像 `before-after.png`：`node docs/benchmarks/gun-barrels-2026-11-24/shots.cjs <root> <outdir>` を main 写しと候補で実行して montage。レビュー担当は「同じ縮尺の真横図」「艦に載せた拡大」も求めている。
   - README（gun-barrels）を今回の 3 修正に合わせて書き直す。
   - 砲の表 `node docs/benchmarks/gun-rules-2026-11-24/table.cjs "$PWD" > <tmp>` は現行 table.md と差分なし（確認済み。規則の砲身長は図面の砲口位置ではなく表の値）。
3. 変更したテストと、砲・公試・艦隊に関係するテストを最終ツリーで実行し直す。全 570 本の前回結果：main と同数で失敗 154 本、head だけ増 49 本 → 切り分け後に残るのは fighter-interiors 12（下記）と main 由来の既存失敗だけ。`example-figures-regression` はメモリ不足で完走していない。
4. 艦隊戦の再計測（`/tmp/ks-verify/20261124-fleet2/sim.cjs`。WEAR の目印は `wear:.05/*` に直す）：砲台 power の修正と wear .05 の後、艦のみ・艦載機ありの両方。前回は艦のみ 513 s（wear .05）。
5. 3 担当へ再レビュー（3 回目）。差分の作り方：`git diff -U0 8c4bcab HEAD -- js/core.js` から価格表の数値行を除く。回帰担当は Opus/high の追加確認を要求している（保存形式・同期キー・キャッシュ）。
6. ドラフト PR（基準 main）→ `subscribe_pr_activity` → マージ。

## レビュー判定の現状（2 回目、候補 833ca35）

- regression-reviewer：UNVERIFIED。指摘への対応：機体レーザーのブラウザ確認を実施し PASS 相当の記録あり（`docs/benchmarks/gun-rules-2026-11-24/browser/`：スライダー→左右対の同期→Undo 2 段→Redo→確定→自動保存→再読込で保持、エラー 0）。読込の口径・長さの上限を編集画面と同じ .40 m / 10 m に揃えた（ee7bbfe）。未確認：エンブレム移動バー、旧保存のエンブレム向き、新規配置時のスライダー、Worker 経由プレビュー。
- reference-fidelity-reviewer：referenceShape FAIL・evidenceValidity FAIL（上の 3 修正と証拠の取り直しで対応中）、physicalValidity UNVERIFIED（長い砲身の旋回・俯仰時の干渉は未調査、subjugator 質量 +0.2% 未調査）。
- physics-reviewer：FAIL（公試の二重計上 → 修正済み・未再レビュー）。

## ユーザーに報告して判断をもらう点（最終報告に必ず入れる）

1. ハイパーイオン砲の充電：指示は「2 倍」だが、反応炉出力を超えるため `min(P×2, 反応炉/n)` で頭打ち（568 s → 約 682 s）。充電中は反応炉出力の 100% を取るので、サブジュゲイターでシールド・機関に電力が残らない可能性（未確認）。
2. シールド損耗 wear .05（こちらで選んだ値）：被弾中は上限の削れ（5%）がシールド自体の減り（4.5%）を上回り、シールドが下がった上限に張り付く。艦のみの艦隊戦 612 s（.04）→ 513 s（.05）。
3. 対空評価値：点防御が 1 発/秒になった結果、レーザー以外の砲の aa が 2〜5 倍（oct40 0.69→2.18 など）。艦載機との戦いへの影響は未計測。
4. Z-95：レーザーが口径 0.10 m の円柱になり 1.2 t → 0.152 t、加速 3,406 G が建造目標 3,330 G を超える（`fighter-interiors` テスト 12 は失敗のまま）。
5. エンブレムの向き：旧保存では向きが変わる（移行なし）。
6. 機体（部隊）の命中散布は帯の射程基準に戻した（X ウイングが停止中の TIE を落とせなかった）。同じ射程の艦のレーザー（CR-90 など）は自分の射程基準のまま＝部隊の種類で分けている。
7. (1+c) は艦全体の平均を全砲台に掛けている（点防御レーザーだけ撃つと入力が多すぎる）。`bandFireAt`（交戦距離の見積り）の費用に充電係数が入っていない。どちらも未修正。
8. ISD が艦載機ありで 86 s で電力喪失する件は main との比較未実施。

## その他

- `scripts/mandator-layout-evidence.cjs` の `pdVolley` 検査は FITS の値と比べる式にした（検査としては弱い。レビュー指摘あり）。
- コミットの末尾：`Co-Authored-By` と `Claude-Session` の 2 行（セッションの指示に従う）。force-push・amend はしない。`js/` か `index.html` を変えたら必ずマニフェスト更新と `--check`。
- 検証出力は `/tmp/ks-verify/<日時>-<内容>/`。main の写しは `/tmp/ks-verify/20261124-final-tests/basewt`（消えていたら `git worktree add <dir> 8c4bcab`）。

## 今後の PR の実装計画

順番は勧める順。各 PR は CLAUDE.md の完了条件（テスト実行と記録、関係するレビュー担当の判定、生成物を変えたらマニフェスト検査）で閉じる。「状態」は 2026-11-25 時点でこの部屋が把握している範囲で、`README.md` §1 の表には古い記載が残っている（削りの焼き込み・溝によらない砲列は main に入っている）。**着手時に必ず main のコードで実装済みかどうかを確かめる。**

### PR A：砲ルール（いまのブランチ。上の「次にやること」を終えてマージ）

範囲は確定済み（冒頭と `gun-energy-model-2026-11-24.md` の「2026-11-24 の決定」）。新しい機能は足さない。残りは作例の作り直し、証拠の取り直し、再レビュー、PR 作成、マージだけ。

### PR B：砲ルールの後始末（小さい。PR A の直後）

PR A でレビューが「注意」とし、ユーザー判断待ちまたは未修正で残したもの。ユーザーの回答を受けてから着手する。

1. 充電係数 (1+c) を砲台ごとに持つ（いまは艦全体の平均を全砲台に掛ける）。`surfaceProfile` の砲台に `rule.shotChargeTT` を持たせ、`surfacePowerStep`・`surfaceManualCharge`・点防御の `inputEquivalentJ` で砲台ごとの係数を使う。担当：physics。
2. `bandFireAt`（交戦距離の見積り）の費用に `weaponInputFactor` を掛け、散布の基準も `fleetFire` と揃える。担当：physics。
3. 命中散布の基準を「部隊の種類」ではなく「砲の種類」で分ける（短射程のレーザーは艦でも機体でも同じ基準）。ユーザーに方針を確認してから。
4. 対空評価値 `deriveAntiAir` の正規化（点防御 1 発/秒で他の砲が 2〜5 倍になった件）：ユーザーの判断で、旧来の釣り合いに戻すか現状を採るか。戻す場合は基準の発射間隔を定数で持つ。艦載機ありの艦隊戦で前後を測る。
5. Z-95 の加速超過：機体レーザーの質量の決め方（円柱の体積比）を、型の既定の円柱との比に直すか、建造目標側を直すか。口径・長さを明示した砲と旧データ（明示なし）で質量が違う不連続も同時に解消する。
6. ハイパーイオン砲の充電の上限（反応炉出力で頭打ち）と、充電中に艦の電力が残るかの確認。
7. エンブレムの向きの旧保存からの移行（入れるかどうかはユーザー判断）。
8. `scripts/mandator-layout-evidence.cjs` の `pdVolley` 検査を独立した期待値に戻す。
9. 作例機（X ウイング・ARC-170・Z-95）のレーザー円柱の原本照合画像、長くした砲身の旋回・俯仰時の干渉確認、subjugator 質量 +0.2% の原因。

版を上げて全作例を作り直す変更（1・4・5）は 1 回にまとめる。

### PR C：戦闘の損傷の見た目と部位破壊（作業一覧 #6 の残り）

「中・軽ターボレーザーを遅く」は PR A の充電時間で解決済み。残りは損傷の表現と、区画・装備ごとの破壊。

- 先に読む：`js/core.js` の `fleetSystems`・`modules`（部位の健全度）、`js/gfx.js` の艦の描画、艦隊戦と公試の被弾処理。README §5 付近と「リフトと戦闘の損傷を繋ぐ」（§1「その後」）。
- 進め方：(1) 既にある部位の健全度（砲・シールド・機関・射撃管制）を整理して、何が壊れると何が起きるかの表を作る。(2) 被弾位置から部位を決める規則を決める（いまの規則を確かめてから）。(3) 見た目（焦げ・穴・火花・消灯）は描画だけの変更にして、性能には触れない。(4) リパルサーリフト／重力制御装置の損傷を戦闘の損傷に繋ぐ。
- 範囲が未決なので、着手時に案を 1 つ勧めてユーザーに確認する。担当：physics（損傷の効果）、regression（描画・Worker）。

### PR D：見た目の改善（`visual-look-request-2026-11-24.md`）

ユーザー依頼：追跡目標に対する相対的な動きでぶれるモーションブラー（流し撮り）、鋭い太陽光、質感。

1. 現状の調査：`js/gfx.js` の描画経路（後処理の有無、影、色の扱い）と、スマートフォンでの描画時間。
2. 太陽光とトーンマッピング：平行光を強く、環境光を弱く、鏡面反射と縁の反射。明暗差が飽和しない曲線。ここまでで 1 回ユーザーに画面を見せる。
3. ブルーム：明るい部分（エンジン・弾・爆発・太陽）だけ。
4. モーションブラー：物体ごとの速度バッファ（追跡目標に対する相対速度）→ 後処理。設定で切れるようにし、低性能端末では既定で切る。
5. 証拠：同じ場面・同じカメラの前後画像、描画時間の前後（`tests/authored-render-budget.cjs`、`procedural-render-budget.cjs`）。参考画像は著作物なのでリポジトリに入れない。担当：regression。

物理値には触れないので作例の作り直しは不要のはず（描画用メッシュを変えた場合だけマニフェスト更新）。

### PR E：区画の切り取り・自作艦の戦闘用データ・居住設備区画の廃止（README §7・§9）

**着手前に main で実装状況を確かめる**（§9 に「版 7」の決定があり、一部は入っている可能性が高い）。未実装の分だけ行う。

- 区画の切り取りを面のつなぎ合わせに揃える（`clipCompartmentMesh` の格子方式をやめる）。容積がわずかに変わるので全作例の作り直しと性能比較が要る。
- 自作艦も完成時に戦闘用データ（性能表・表示用の値・3D モデル）を保存に組み込む。原則「作例とユーザー設計に差をつけない」。値の出どころは保存後に Worker で計算した値（編集中の差分計算の値は長く残る場所に書かない）。
- 居住設備区画 `habitat` を一覧から外し、古い設計では読込時に外して通知（`RETIRED_PARTS`）。
- 担当：regression（保存形式・キャッシュ・Worker。Opus/high の追加確認が要る範囲）、physics（容積・性能）。

### PR F：敵 AI の真値漏れ・索敵・マップ拡大・ジャンプ・航空指揮（README §4、表の #124）

大きいので 2 本に分ける：(F1) 真値漏れの修正＋索敵システム、(F2) マップ拡大＋ジャンプの到着と離脱＋航空指揮を艦隊戦の画面に繋ぐ。決定済みの規則は README §4 にある（未発見の敵は制限として表示しない、急停止は艦ごと、など）。F1 を先に。担当：physics（探知の式）、regression（UI・Worker）。

### その後（README §1「その後」・§5・§8）

- インターディクター（§5。予測線の精度、投射の距離・時間・電力などは着手時に案を出す）。
- 台座の張り出し、小惑星。
- 残っている既知の問題：管制数 3 での反撃の遅れ、伝達路が塞がれたときの探索の遅さ、マンデイター II の点防御と大型ランチャーの数、設計画面の「通常航行」と排熱の設計条件の食い違い、艦でリフト不足の警告が出ない。
- main でも落ちているテスト約 154 本の棚卸し（今回の全実行で一覧が取れている：この文書の PR A の節と、切り分け担当の報告にある分類）。原因ごとに「テストが古い／土台が足りない／実バグ」に分け、PR の合間に少しずつ減らす。`example-figures-regression` がメモリ不足で完走しない件も含む。
