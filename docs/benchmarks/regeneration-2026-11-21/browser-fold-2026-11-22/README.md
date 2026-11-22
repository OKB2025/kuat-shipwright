# 性能表を畳んだ状態の持ち越し（ブラウザ、2026-11-22）

- 対象：`e66a502`（作業木 `/home/user/kuat-shipwright` を `python3 -m http.server 8765` で配信）。Chromium（Playwright、swiftshader）、1280×900、実際の Worker。
- 手順（`check.cjs`）：MC30c を開く → 性能表の見出しを押して畳む → 別の作例（CR90）を開く → 保存ボタン（`#btnSave`）で保存 → MC30c を開く → 保存一覧の「開く」（`[data-load]`）で CR90 の保存を開く → 見出しを押して開く。
- 結果（`result.json`）：畳んだあとの全段階で `data-open="0"`、`aria-expanded="false"`、行 0、`localStorage['yard.designMetricsOpen']="0"`。最後に押すと `data-open="1"`、行 7 に戻る。ページのエラー 0。
- 再読み込み後も畳んだままになることは、先に確認した（`/tmp/ks-verify/20261122-metrics-browser/result.json`）。
- 見出しのクリック処理は `#designMetrics` に 1 回だけ付く（`bindDesignUI`）。`designUIMetrics` は中身を書き換えるだけで要素を作り直さないので、二重に付くことはない。最後の 1 回のクリックで開いた（2 回分の切り替えなら畳んだまま）ことも、これと合う。

## 保存した設計の裏での準備（実際の Worker、`user-preload/`）

- 手順：CR90 を開いて保存 → ページを読み直す → `ks-preload-progress` を記録（タイトル画面のまま操作しない）。
- 結果（`result.json`）：準備の列は 42 件（保存 1 + 作例 41）。最初に準備したのは保存した設計（`save:<id>-<savedAt>`）で、5 秒で `ready 1`・`failed 0`。準備側の Worker は、保存できなかった結果を失敗として数えるので（`asset-cache.js` の `cacheSaved` の確認）、`ready 1` は結果が保存されたことを示す。保存の時点で `prepareSavedCombat` が同じ設計を準備済みのため、読み直し後はほぼ待たずに終わったと見ている（作り直しの時間は測っていない）。
- ページのエラー 0。

## 廃止した居住設備区画を本体とする子（`habitat-host/`）

- 旧形式の保存を想定し、保存済みの MC30c に居住設備区画（id 328）を足し、その区画を `parentId`・`parentStructureId` に書いた構造物と、`host`・`hostId` に書いた武装を足して読み込んだ（`check2.cjs`）。
- 結果（`out2.json`）：区画は外れ（`retiredHabitats 1`）、構造物の親の記録は読み込みで消える。武装はメモリの中で `host 328` が残るが、保存には書かれない（`host`・`hostId` とも null、保存データに 328 を指す記録なし）。統計は例外なく計算でき、2 回目の保存往復は同一。
- `host` の残り方は居住設備区画に限らない：存在しない id（5555）を書いた武装でも同じく残る（`check3.cjs`、`out3.json`）。#121 の「保存に本体を書かない」以来の振る舞いで、この PR の変更ではない。
- 足した部品（構造物と武装の写し）のため、質量（207,389 → 202,945 t）と熱の警告 1 件が変わった。この変化の原因は調べていない。確かめたのは、例外が出ないことと保存に参照が残らないことだけ。
