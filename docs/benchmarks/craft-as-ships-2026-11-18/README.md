# 小型機を設計した小型艦として飛ばす（第 1 段：公試）の検証記録（2026-11-18）

仕様と既定値は [../../craft-as-ships.md](../../craft-as-ships.md)。基準は `main` = e8d3dfe。

## テスト

| 記録 | 内容 |
| --- | --- |
| `tests/full-534-working-tree.exit-codes.txt` | 全 534 本を作業ツリーで実行（2 並列、1 本 20 分の制限）。失敗 156 本。実行中に `js/core.js`・`js/app.js` を直しているので、前半は修正前のコードを含む |
| `tests/main-e8d3dfe-failing-156.exit-codes.txt` | 上で失敗した 156 本を、変更前の `main` で実行 |
| `tests/rerun-269-e946cc7.exit-codes.txt` | 失敗 156 本＋艦隊戦・公試・入渠・小型機まわり、計 269 本を e946cc7 で再実行（4 並列）。失敗 154 本 |
| `tests/craft-as-ships.log` | 新しいテスト 12 件（最終コード） |

- 失敗した項目（`not ok` の題名と合否の数）を `main` と突き合わせた。違ったのは次の 5 本で、すべて今回の変更が原因、修正済み。
  - `load-sizes`、`source-manifest`：`index.html` の読み込みサイズ表とマニフェストが古かった（更新して合格）。
  - `coruscant-trial-start`：`trialReset` 単体を動かすテスト。足した呼び出しを、操縦を移したことがあるときだけにした。
  - `fleet-profile-refresh`：`trialStart` の要求の書き方を読むテスト。要求の書き方を元に戻し、通し番号だけ足した。
  - `fleet-loadout-separation`：4 並列の再実行で SIGKILL。単独では合格（`main` でも合格）。
- それ以外の失敗（151 本）は、`main` でも同じ項目が同じ数だけ失敗している。
- `example-figures-regression` は 20 分の制限で時間切れ。`main` 側は実行していない（未確認）。
- `tests/fleet-battle-determinism.cjs` は合格（基準資料は変更していない）。`node scripts/update-asset-manifest.cjs --check` は通る。

## ブラウザ

`browser/result.json`（`scripts/browser-trial-wing.cjs`、headless Chromium、7eeac66）：MC80 リバティで X ウイングを発艦 → CR90（静止目標）へ航過 → 帰還・収容 → 再発艦 → 操縦を移す → 全開 6 秒 → 母艦へ戻る → 操縦中の機体を失って母艦へ戻る → 操縦中に再開始。PASS、ページエラー 0。画面は `browser/1-menu.png`、`2-attack.png`、`4-flying-craft.png`。

## 未確認

- 切り替えの最中に再開始・終了・ジャンプを重ねる場面（コードの修正だけ。ブラウザでもテストでも作っていない）。
- 追加レビューのあとの修正（7eeac66、e946cc7 以降）の再レビュー。
- スマートフォン幅、英語表示、戦略マップからの操艦・パトロール・観戦でボタンが出ないこと。
- 作例の再生成はしていない（`fleetProfile`・`computeStats` には触れていない）。

## 航空機を含む艦隊戦と、対艦攻撃の取り直し（2026-11-19、9bcbd02 ＋ `scripts/sim-fleet-air.cjs`）

ゲーム本体（`js/`）は変えていない。割り当て・進路・投下・搭載はスクリプトの中だけにある。発艦は省き、機体は母艦の横を飛んでいる状態から始める。再武装はしない。

| 記録 | コマンド | 内容 |
| --- | --- | --- |
| `fleet/isd2-vs-rebel5.txt` | `node scripts/sim-fleet-air.cjs 3` | インペリアル I ×2 対 MC75・MC80 リバティ・ネビュロン B ×2・CR90。艦載機は `data/fleet.js` の搭載どおり全機（205 単位）。80 km から、爆撃機は 2 進路 |
| `fleet/isd2-vs-rebel5-tie-zone.txt` | `TIE=zone node scripts/sim-fleet-air.cjs 3` | 同じ。迎撃側は艦の近くを点防御に任せる |
| `fleet/isd2-vs-rebel5-no-craft.txt` | `KS_WING=0 node scripts/sim-fleet-air.cjs 3` | 航空機なし（艦だけ）の比較 |
| `strike/imperial-routes-1-9bcbd02.txt` | `node scripts/sim-strike.cjs 3` | 進路 1 本を 9bcbd02 で取り直したもの。`imperial-parts-tie-run.txt`（893ea90 の時点）と結果が違う |
| `trial-pd-first/` | 下記 | **試し**。点防御のエネルギーを砲より先に取っておく 1 行の変更（`core.diff`）をスクラッチの写しに当てて同じコマンドを実行。変更はリポジトリに入れていない |

- `trial-pd-first/` の実行：`js/core.js` に `core.diff` を当てた写しと `data/` を置いた場所を `KS_TEST_ROOT` に指定し、`AXES=1|2|3 node sim-strike.cjs 3` と `node sim-fleet-air.cjs 3`。
- 計測用の写し（点防御が給電を得た回数と、艦の `energy` を数える行を足したもの）での実行は記録に残していない。数値は [../../damage-penetration.md](../../damage-penetration.md) の同日の節にある。
- 未実施：既存テスト（ゲーム本体を変えていないため）、ブラウザ確認、レビュー。`node scripts/update-asset-manifest.cjs --check` は通る。

## 2026-11-19 後半の記録（`2026-11-19-later/`）

各記録は、その時点のコードで取ったもの。いまのコードで再現するとは限らない。結果の読み取りは [../../damage-penetration.md](../../damage-penetration.md) の「6 回目」の節にある。

実行コマンド：
- 対艦攻撃：`[TACTIC=suppress] [DIVE=1] AXES=<1|2> node scripts/sim-strike.cjs 3`
- 艦隊戦：`[KS_PRESS=0] node scripts/sim-fleet-air.cjs 3`
- 空戦：`node scripts/sim-dogfight.cjs craft_xwing craft_tie_ln 6 8 4`

| 記録 | 条件 | コマンド |
| --- | --- | --- |
| `r8/h0.5/` | 点防御の命中の係数 0.5（出力 6%、射程 5 km、決戦 AI・艦橋の規則あり） | `AXES=1|2 node scripts/sim-strike.cjs 3`、`node scripts/sim-fleet-air.cjs 3` |
| `r8/h0.35/` | 命中の係数だけ 0.35 に変えた写しで実行した試し | 同上 |
| `r9/` | 係数 0.5、決戦を挑まない艦隊戦 | `KS_PRESS=0 node scripts/sim-fleet-air.cjs 3` |
| `r10/` | 弾の変更（魚雷・ミサイル・爆弾の寸法と係数 0.03）のあと、イオンなし | `AXES=1|2 node scripts/sim-strike.cjs 3`、`node scripts/sim-fleet-air.cjs 3` |
| `r12/` | r10 と同じ条件で、イオン弾頭あり | 同上 |
| `r14/` | センサー全損で対空が 25% 残る版。戦術なし（`plain-*`）と制圧（`suppress-*`） | `[TACTIC=suppress] AXES=1|2 node scripts/sim-strike.cjs 3` |
| `r17/` | 砲の対空がセンサー不要の版。主担当の読み違いの版で、採用していない | `[TACTIC=suppress] AXES=1|2 node scripts/sim-strike.cjs 3`、`node scripts/sim-fleet-air.cjs 3` |
| `r18/` | 対空の最終形（追尾センサーを載せた艦だけ、砲の対空もセンサーを通す） | r17 と同じ |
| `r22/` | 3 次元の飛行を直したあと。制圧のみ・急降下＋制圧・急降下のみの対艦攻撃（`suppress-1`、`dive-suppress-1|2`、`dive-2`）と、空戦 X ウイング 4 対 TIE/ln 8（`dogfight-4v8`） | `[TACTIC=suppress] [DIVE=1] AXES=1|2 node scripts/sim-strike.cjs 3`、`node scripts/sim-dogfight.cjs craft_xwing craft_tie_ln 6 8 4` |

- `r8/h0.5/` の係数 0.85 の列は、同じ節の `after-decisions-e99aac1/` の数値である。
- 係数 0.35 の試しの写しはリポジトリに入れていない。
