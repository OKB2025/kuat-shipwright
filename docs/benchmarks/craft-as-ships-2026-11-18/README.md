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
