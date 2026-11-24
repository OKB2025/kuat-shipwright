# 制空任務の新しい搭載で行った4対4空戦

2026年11月24日（日本時間）。試験したゲームは [`9a08fb0`](https://github.com/OKB2025/kuat-shipwright/commit/9a08fb059026371dbd2e2f2d4a5d9386ce3b69f9)、結果の共有先は [`test/mission-load-4v4-20261124`](https://github.com/OKB2025/kuat-shipwright/tree/test/mission-load-4v4-20261124/docs/experiments/dogfight-20261124/mission-load-4v4)。前回欄はゲーム版 [`88c7470`](https://github.com/OKB2025/kuat-shipwright/commit/88c74709b47083b8463db7f2a53644651b045717) の[公開済み120戦](https://github.com/OKB2025/kuat-shipwright/blob/09dbd7435fff9e5272ec5b90ee24d9463c9e08e5/docs/experiments/dogfight-20261124/missile-rules-4v4/trials.csv)を読み込んだ。今回集計した交戦は120。[共有先の最終コミット](https://github.com/OKB2025/kuat-shipwright/commits/test/mission-load-4v4-20261124)。

## 勝敗・損失・終了時刻

各組み合わせ40戦、各陣営のべ160機。勝敗欄は Xウイング勝／TIE勝／引き分けの順。時刻はシミュレーション内の秒。

| 相手 | 前回の勝敗 | 今回の勝敗 | X勝率 | X損失 前回→今回 | TIE損失 前回→今回 | 終了中央値 前回→今回 | 今回の最短～最長 |
|---|---|---|---|---|---|---|---|
| TIE/ln | 25 / 14 / 1 | 32 / 7 / 1 | 80.0% | 84 → 110 | 123 → 150 | 52.125 → 63.25 | 48.25～300 |
| TIE/in | 30 / 10 / 0 | 20 / 20 / 0 | 50.0% | 101 → 128 | 147 → 138 | 44.125 → 58.25 | 38.75～73.5 |
| TIE/D | 0 / 40 / 0 | 14 / 25 / 1 | 35.0% | 160 → 134 | 55 → 106 | 56.25 → 75.125 | 33.75～300 |

| 相手 | Xを出発側Aにした20戦（X/TIE/分） | Xを出発側Bにした20戦（X/TIE/分） | 同条件で前回と勝者が変わった戦数 | 敵編隊全滅 | 相討ち | 300秒打ち切り |
|---|---|---|---|---|---|---|
| TIE/ln | 13 / 6 / 1 | 19 / 1 / 0 | 15 | 39 | 0 | 1 |
| TIE/in | 9 / 11 / 0 | 11 / 9 / 0 | 18 | 40 | 0 | 0 |
| TIE/D | 9 / 11 / 0 | 5 / 14 / 1 | 15 | 38 | 0 | 2 |

300秒に達した場合は敵機を多く撃墜した側の判定勝ち。同数は引き分け。両編隊が同じステップで全滅した戦いは相討ちとして記録し、勝敗表の引き分けに含めた。

- TIE/ln、x-first、シード30。X損失3、TIE損失3、引き分け。
- TIE/D、tie-first、シード34。X損失3、TIE損失3、引き分け。
- TIE/D、tie-first、シード40。X損失2、TIE損失3、Xウイング勝ち。

今回の40戦では、TIE/lnはXに7勝しており、Xが大きく優勢という試験目標に沿う。TIE/inは20勝20敗で、目標の「Xが少し優勢」までは確認できなかった。TIE/Dは25勝14敗1分で優勢を保った。

[全120戦のスコア](trials.csv)・[照合済みの戦闘ログ120件](runs.jsonl.gz)

## 制空任務で実際に搭載した兵装

シミュレーターのプロファイルと同じ作例に `Core.missionOrdnance(design, "air")` を適用し、シミュレーターが持つ弾種と個数に一致することを確認した。

| 機体 | 前回の1機分 | 今回の1機分 | 搭載位置 | センサー数 | 初期シールド（ゲーム内 kt） |
|---|---|---|---|---|---|
| Xウイング | 震盪 ×12 | 対レーダー ×6 | 発射管 | 1 | 139.64 |
| TIE/ln | 震盪 ×6 | 熱源 ×3 | 発射管 | 0 | 0.00 |
| TIE/in | 震盪 ×6 | 熱源 ×3 | 発射管 | 0 | 0.00 |
| TIE/D | 震盪 ×12 | 熱源 ×12 | 翼下 | 1 | 160.11 |

今回のXが積む対レーダーミサイル `rmsl` は発射時にレーダーロックか受動を選ぶ。同一の在庫を使う。TIEの熱源ミサイルは `cmsl`。試験開始時点で最後に加わった2コミットは対艦任務の搭載変更で、今回指定した任務は `air`。比較する前回ゲーム版からは任務搭載、発射判断、実際の機体作例なども更新されている。

[実測プロファイル](profiles.json)・[ゲームの搭載選択](https://github.com/OKB2025/kuat-shipwright/blob/9a08fb059026371dbd2e2f2d4a5d9386ce3b69f9/js/core.js#L122220)・[シミュレーターの搭載・発射](https://github.com/OKB2025/kuat-shipwright/blob/9a08fb059026371dbd2e2f2d4a5d9386ce3b69f9/scripts/sim-dogfight.cjs#L7)・[前回からの変更](https://github.com/OKB2025/kuat-shipwright/compare/88c74709b47083b8463db7f2a53644651b045717...9a08fb059026371dbd2e2f2d4a5d9386ce3b69f9)

## ミサイルの発射と命中

発射数は実際に飛行体が生成された回数。命中はゲームのダメージ処理で受け手が特定できた件数。狙った相手への命中率は「指定した敵に命中／発射」で計算した。現行の試験設定で射程上限は3,000 m。全2,354発の実測発射距離は41.3～2,999.0 mだった。 全120戦で524発が命中し、指定した敵に523発、僚機に1発、自機に0発。前回の全命中は1,168発中453発。

| 相手 | 発射 前回→今回 | 全命中 前回→今回 | 今回の指定敵／別の敵／僚機／自機 | 近接／直撃 | 今回の発射距離 中央値（最短～最長）m | 最初の発射までの中央値 秒 |
|---|---|---|---|---|---|---|
| TIE/ln | 474 → 574 | 115 → 131 | 131 / 0 / 0 / 0 | 131 / 0 | 1269（109～2903） | 9.5 |
| TIE/in | 290 → 489 | 125 → 102 | 102 / 0 / 0 / 0 | 102 / 0 | 1367（185～2997） | 7.75 |
| TIE/D | 404 → 1291 | 213 → 291 | 290 / 0 / 1 / 0 | 291 / 0 | 1240（41～2999） | 2.375 |

| 対戦相手 | 発射側 | 発射モード | 発射 | 指定敵命中 | 指定敵命中率 | 味方命中 | 別の敵に命中 |
|---|---|---|---|---|---|---|---|
| TIE/ln | Xウイング | レーダーロック | 132 | 38 | 28.8% | 0 | 0 |
| TIE/ln | TIE/ln | 熱源 | 442 | 93 | 21.0% | 0 | 0 |
| TIE/in | Xウイング | レーダーロック | 98 | 49 | 50.0% | 0 | 0 |
| TIE/in | TIE/in | 熱源 | 391 | 53 | 13.6% | 0 | 0 |
| TIE/D | Xウイング | 受動 | 557 | 122 | 21.9% | 0 | 0 |
| TIE/D | Xウイング | レーダーロック | 86 | 23 | 26.7% | 0 | 0 |
| TIE/D | TIE/D | 熱源 | 648 | 145 | 22.4% | 1 | 0 |

発射後に機体が残って戦闘を継続することがある。1発の命中と1機の撃墜を別々に集計した。以下の砲撃イベントはゲームが射撃を記録した回数で、命中した砲弾数や撃墜への寄与はこのログから特定できない。

| 対戦相手 | X／TIEの砲撃イベント | 熱源終末ロスト | レーダー誘導喪失 | 受動誘導喪失 | 射線の味方により発射を保留したステップ |
|---|---|---|---|---|---|
| TIE/ln | 4819 / 11383 | 38 | 32 | 0 | 1 |
| TIE/in | 3452 / 11688 | 7 | 4 | 0 | 0 |
| TIE/D | 5699 / 9536 | 64 | 20 | 256 | 78 |

対TIE/Dで指定した敵への命中は、前回のXが46発、Dが164発から、今回のXが145発、Dも145発になった。Xの145命中のうち122発は受動発射で、センサーを持たないTIE/ln・TIE/in相手の受動発射は0発。Xの初期シールド139.64 ktとDの160.11 ktは前回と同じ。機体損失もXが160→134、Dが55→106に動いた。味方への1命中はD戦のX出発側A、シード34、72.5秒で、Dの僚機 `b2` の熱源弾が `b` に当たった。

[発射別の距離・弾種・モード](launches.csv)・[各命中の実際の受け手](impacts.csv)・[近接炸裂ごとのシールド吸収](proximity.csv)

## 映像

3戦ともシード24、Xウイングを出発側Aにした戦闘。0.25秒刻みの座標と機体姿勢から、上面・側面と3D追尾映像を再構成した。両陣営の3Dはこの版の作例から `Gfx.fleetGeometry` で出力した。3D窓ではカメラ前方奥行き2,500 m未満の機体をメッシュ描画し、遠い機体の位置を枠で示す。黄色の航跡は実際に飛行したミサイル。追跡欄は弾のID、発射機、目標、発射モード、目標との距離を示す。最初の発射付近を等速、そのほかを4倍速で再生する。

| 動画の開始位置 | 対戦相手 | ゲーム内終了 秒 | X／TIE生存 | 発射／全命中 |
|---|---|---|---|---|
| 0:00.0 | TIE/ln | 56.25 | 2 / 0 | 13 / 2 |
| 0:19.8 | TIE/in | 68.5 | 0 / 1 | 12 / 2 |
| 0:42.6 | TIE/D | 54 | 2 / 0 | 24 / 6 |

動画はH.264、1280×720、30 fps。1853フレームを全編デコードして照合した。同梱のスクリプトで独立に再生成したMP4もSHA-256が一致した。再生時間 61.77 秒。

[動画のチェックサム・チャプター](video.json)・[TIE/lnの軌跡](replays/tie_ln.json.gz)・[TIE/inの軌跡](replays/tie_in.json.gz)・[TIE/Dの軌跡](replays/tie_d.json.gz)

## 既存テスト

| 試験群 | 前回の公開記録（合格／全数） | 今回（合格／全数） | 今回の失敗 |
|---|---|---|---|
| ミサイル・シールド（今回は任務搭載・誘導も含む） | 15/15 | 38/38 | 0 |
| 航空・艦隊の指定7ファイル | 42/45 | 43/45 | 2 |

| 航空・艦隊テスト | 前回 合格／全数 | 今回 合格／全数 |
|---|---|---|
| `air-control-stated.cjs` | 3 / 3 | 3 / 3 |
| `fighter-air-superiority.cjs` | 7 / 8 | 8 / 8 |
| `fighter-dogfight-arcs.cjs` | 5 / 5 | 5 / 5 |
| `fleet-air-copy-orders.cjs` | 8 / 8 | 8 / 8 |
| `fleet-air-restraint.cjs` | 11 / 13 | 11 / 13 |
| `fleet-air-strike-flown.cjs` | 4 / 4 | 4 / 4 |
| `point-defense-toggle-aircraft.cjs` | 4 / 4 | 4 / 4 |

- 格納庫開口部からの発艦間隔・出現位置。前回の記録でも同じ検査が失敗。 検査名 `craft come out of the hangar mouths at the rate the mouths give, and appear just outside a mouth`。
- インペリアル級が2～3秒で12機を発艦する検査。前回の記録でも同じ検査が失敗。 検査名 `the Imperial class passes twelve craft through its hangar mouths in two to three seconds`。

- 戦闘機が艦を掃射するときの通過速度。前回は失敗、今回は合格。

各テストは元の期待値・許容差で実行した。再実行のコマンドは以下の通り。

```sh
node --test --test-reporter=tap --test-concurrency=1 tests/craft-missile-trial-rules.cjs tests/craft-proximity-shield.cjs tests/craft-shield-generator-scale.cjs tests/missile-seekers-torpedo-flight.cjs tests/trial-guidance.cjs
node --test --test-reporter=tap --test-concurrency=1 tests/fighter-air-superiority.cjs tests/fleet-air-restraint.cjs tests/fleet-air-strike-flown.cjs tests/fighter-dogfight-arcs.cjs tests/fleet-air-copy-orders.cjs tests/air-control-stated.cjs tests/point-defense-toggle-aircraft.cjs
```

[ミサイル・シールド試験ログ](targeted.tap)・[航空・艦隊の回帰試験ログ](regression.tap)

## 再現条件と集計の照合

惑星上空160 km、両編隊の先頭どうしが8 kmの対向開始。シード21～40を両方の出発側で各1回使った。1シードの2方向は組になっており、40通りの異なる乱数を使ったものとして統計推定していない。ゲームの0.25秒刻み・300秒上限を使用。付属の `run.sh` にすべてのフラグを記載した。

通常実行ではゲームのコアをそのまま読み込む。観測用の再実行では同じコアのダメージ記録箇所に読取り用コールバックをメモリ上で追加した。120件すべてで終了時刻、両陣営の損失、全発射の時刻・対象・モード・距離、砲撃イベント、ゲームのカウンターが一致した。再実行はサンプル数に加えていない。

実験用ブランチのルートから以下を実行する。出力先は実行ごとに新設する。

```sh
set -eu
experiment=docs/experiments/dogfight-20261124/mission-load-4v4
out=$(mktemp -d /tmp/ks-verify-mission4.XXXXXX)
sh "$experiment/run.sh" "$PWD" "$out"
python3 "$experiment/collect.py" "$out/runs" "$out/audit" "$out/report"
git log -1 --format=%H -- "$experiment/README.md"
```

追加したコードはシード選択・記録用の [prepare.py](prepare.py)、[実行スクリプト](run.sh)、[照合・CSV出力](collect.py)、[リプレイ描画の差分](replay.patch)。日本語の[描画コード](renderer/replay.py)とメッシュ出力を同梱。NumPy、Pillow、Noto Sans CJK、Cコンパイラ、FFmpegを含む環境で `sh "$experiment/render.sh" "$PWD" "$out/movie"` を実行すると、3章をまとめたMP4を生成する。[映像の再生成](render.sh)。ゲーム本体・作例・テストの変更は0件。

今回の比較では機体作例、搭載数・弾種、発射判断が同時に更新されている。今回の勝敗差から単一の変更やAI連携の寄与を切り分けることはできない。対象は制空任務の4対4で、対艦任務の新しい搭載は既存の搭載テストで確認した。艦隊戦での命中率・撃沈率は今回の母集団に含めていない。
