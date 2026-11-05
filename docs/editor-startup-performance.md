# 設計画面を開く処理の改善

新規作成と作例の読み込みを、実際のタイトル画面から計測する。単純な部品展示だけでは、船体の表面調査や区画計算による停止を再現できない。

## 確認した原因と修正

- 保存艦をメニューの裏で先に計算し、新規作成や別の作例がその完了待ちになっていた。下書きの設計データは保持し、「途中から設計」を選んだ場合だけ準備を開始する。
- 作例の組立済み状態に画面側の保存用IDが追加されると、ワーカーが別の設計と判断してキャッシュを捨てていた。画面の保存IDを保持したまま、計算用状態からだけ除外する。実際の形状変更は引き続き再計算する。
- 表示していない表面タブの選択更新が、全船体の露出面調査を画面側で実行していた。表面編集を使う場合だけ更新し、ワーカーの面データが届くまでは選択を保持して待つ。
- 新規作成が、利用しない表面レポートまで同期生成していた。作成時は設定だけを準備し、派生レポートはワーカーで計算する。
- 最初の描画データを返す前に、面選択用の全表面調査を強制していた。設計画面からの要求では先に船体を表示し、その後に面データと性能を返す。途中で新しい編集が届いた場合は古い調査を省く。
- 性能欄の表示用データを作るだけでも、戦闘用の電力・射界スナップショットを再生成していた。表示要約では不要なスナップショットを省き、保存・出撃時の通常APIは保つ。
- 閉じた格納庫ハッチを持つ艦でも、閉状態の複製を作って装甲面積を再計算していた。実際に開いているハッチがなければ、同じ閉状態の面積を再利用する。
- キャッシュ済みの砲室を参照する際も座標変換をやり直し、描画用の頂点コピーでは全頂点を一度展開していた。キャッシュを先に確認し、描画バッファを直接コピーする。

表面タブは面データの到着後に操作可能になる。船体の選択やカメラ操作を、その面調査と性能計算の完了まで待たせない。古い世代の面データは新しい設計へ適用しない。

## 検証

[タイトル画面からの実測](benchmarks/editor-startup-profile.json) は、新規作成・保存艦の再開・作例を実際のボタンから開いた記録である。主な計測値は以下の通り。クリックから形状が画面へ反映されるまでを測り、性能計算の完了とは分ける。

| 操作 | 修正前 | 修正後 |
| --- | ---: | ---: |
| 新規作成（下書きなし） | 2.68秒 | 1.74秒 |
| 新規作成（未選択のヴェネター下書きあり） | 16.16秒 ※ | 1.38秒 |
| ヴェネター作例 | 39.97秒 | 25.74秒 |
| アーキテンス作例 | 全体未計測 | 1.70秒 |

※ 下書きありの修正前値は、共通の描画・計算改善を適用した後、下書きの準備を遅らせる修正を入れる前の原因切り分け測定。未修正のmainと同一条件の対比ではない。アーキテンスの修正前は全体時間を記録しておらず、描画前のワーカー内の面調査だけで約6秒かかっていたことを個別に確認した。

保存艦の裏計算を止めると、新しい空の設計に保存艦の待ち時間が加わらなくなる。新規作成と作例では、性能値の到着前でもカメラを動かせること、アーキテンスでは表面タブの面選択まで確認した。最終のドラッグ保留・パトロール再開・読み込み失敗時の復帰修正については、計測時の入力ハッシュを保持し、最終ソースで新規作成とアーキテンスを追加確認した記録を分けている。

最終ソースの追加確認では、保存艦ありの新規作成は最初の描画フレームまで1.68秒、アーキテンスは形状反映1.54秒・最初の描画フレーム2.11秒だった。アーキテンスの表面選択テストは、最初の試行でテスト側の一時的な折り畳み展開が画面更新に上書きされたため、画面の通常の開閉ボタンを使う手順に修正して再確認した。最初の試行も別の記録として残す。

大型作例の初回生成そのものには引き続き時間がかかる。ヴェネターの約26秒の大半は、既存の区画交差計算と機関の較正である。アーキテンスも性能値の完了は約19秒で、先に表示された船体を操作しながら待つ。今回の実測を、すべての作例や実機端末が即時に開く保証とはしない。

[メッシュコピーの比較](benchmarks/geometry-copy-performance.json) は、修正前のコピー方法と同じ形状を比較し、位置・法線・UV・色・インデックスの全バッファが一致することを確認する。砲塔の形状を簡略化して速度を上げる変更ではない。

[Coreの数値保持の記録](benchmarks/editor-core-correctness.json) では、修正前の実コードと修正後でヴェネターの数値ダイジェストが同一であることを確認した。新規設計の表面設定も、ワーカーで派生データを計算した後は通常経路と一致する。既存の古い数値フィクスチャの不一致はこの記録に分けて記載し、フィクスチャ自体は変更しない。

```sh
node scripts/benchmark-geometry-copy.cjs
node --test --test-concurrency=2 tests/geometry-copy-performance.cjs \
  tests/turret-projection-cache.cjs tests/closed-hatch-armor-area.cjs \
  tests/craft-combat-summary.cjs tests/surface-mode-enable-report.cjs \
  tests/editor-draft-preparation.cjs tests/editor-built-state-reuse.cjs \
  tests/editor-deferred-surfaces.cjs tests/surface-editor-ui.cjs \
  tests/surface-worker-report-ui.cjs tests/editor-interaction-performance.cjs \
  tests/design-save-identity.cjs tests/turret-compartment-volume.cjs \
  tests/engine-edit-scheduling.cjs tests/surface-aggregate-engine.cjs \
  tests/surface-engine-geometry.cjs
```

実ブラウザの計測にはPlaywrightとChromiumが必要。リポジトリでローカルHTTPサーバーをポート8876で起動し、別のターミナルから実行する。Chromiumの実行ファイルは `CHROMIUM_PATH` で指定できる。クリック処理が返った時刻だけで測らず、実際の入力時刻から最初の形状描画と性能計算完了を分けて記録する。

```sh
node scripts/browser-editor-startup-profile.cjs --case new --strict-sources
node scripts/browser-editor-startup-profile.cjs --case new --mobile --cpu 4 --strict-sources
node scripts/browser-editor-startup-profile.cjs --case arquitens --surface-smoke --strict-sources
node scripts/browser-editor-startup-profile.cjs --case venator --strict-sources
node scripts/browser-editor-startup-profile.cjs --case new --draft /tmp/venator.json --expect-lazy-draft --strict-sources
node scripts/browser-editor-startup-profile.cjs --case continue --draft /tmp/venator.json --expect-lazy-draft --strict-sources
```

CPU制限はブラウザの合成条件であり、実機のGPUや回線速度を表すものではない。各計測は空のブラウザ環境で順番に実行し、実装9ファイルのハッシュも記録する。
