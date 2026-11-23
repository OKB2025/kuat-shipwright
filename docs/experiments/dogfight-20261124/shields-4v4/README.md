# 発生器の大きさでシールドを決める版の4対4空戦

[English report](README.en.md)

2026年11月24日（日本時間）。ゲームの試験元は `c1767627867718edd3237cdbf161f85c06e93f47`、結果を保存したブランチは `test/shield-4v4-20261124`。Xウィングに対し、TIE/lnは21勝17敗2相討ち、TIE/inは20勝20敗、TIE/Dは40勝0敗だった。以下の数値は各機種の作例をゲームのCoreで組み立てて得た。

## 勝敗と損失

| Xウィングの相手 | X勝 | TIE勝 | 相討ち | 300秒判定 | Xの損失 | TIEの損失 | 決着時間の中央値（最短～最長） |
|---|---:|---:|---:|---:|---:|---:|---:|
| TIE/ln | 17 | 21 | 2 | 0 | 124機 | 137機 | 52.00秒（40.75～235.75） |
| TIE/in | 20 | 20 | 0 | 0 | 113機 | 123機 | 35.00秒（27.25～46.75） |
| TIE/D | 0 | 40 | 0 | 0 | 160機 | 48機 | 53.375秒（36.25～85.50） |

損失は各側160機（4機×40戦）に対する合計。開始側AをXにした20戦でXは順に8・9・0勝、開始側BをXにした20戦で9・11・0勝。相討ち2戦はいずれも双方4機全滅。時間切れは撃墜数の多い側を勝ち、同数を引き分けとする設定だが、全120戦が制限時間内に決着した。各試行のシード・配置・損失と終了時刻は [trials.csv](trials.csv) にある。

## シールドと武装

航空機の補正をシールド発生器の合計体積から読む変更は `b2358936` で入り、`5fe95301` が適用を航空機に限定した。下表は空戦と同じ `fleetProfile` を渡して作った `fleetUnit` の初期シールド容量。

| 機体 | 発生器の合計体積 | 初期シールド容量（ゲーム内TNT換算） | 対空ミサイル搭載数／機 |
|---|---:|---:|---:|
| Xウィング | 0.3330 m³ | 139.64 kt | 12 |
| TIE/ln | 0 | 0 | 6 |
| TIE/in | 0 | 0 | 6 |
| TIE/D | 0.3568 m³ | 160.11 kt | 12 |

前回の試験版 `5cdf219` の記録はXが139.05 kt、Dが49.36 kt。今回はDがXより14.7%大きい。対Xの同じ4対4・同シード・両側配置で、Dの勝数は39勝から40勝、自軍の損失は73機から48機に減った。この間にはレーザーガスの消費や発射管の配置にも変更があり、この25機の差のうちシールドだけに由来する機数は未測定。旧版は再実行せず公表済み記録を照合した。[今回の機体値](profiles.json) · [前回の機体値](https://github.com/OKB2025/kuat-shipwright/blob/f977580ade4ab51cc32a0181f1a5a16a2572756e/docs/experiments/dogfight-20261124/defender-matchups/profiles.txt) · [前回の4対4](https://github.com/OKB2025/kuat-shipwright/blob/f977580ade4ab51cc32a0181f1a5a16a2572756e/docs/experiments/dogfight-20261124/defender-matchups/summary.csv)

| 相手 | ミサイル発射 | 命中として集計 | 射程等で終了 | 目標を先に喪失 | 終了時までに内訳が確定しない弾 |
|---|---:|---:|---:|---:|---:|
| TIE/ln | 409 | 145 | 193 | 54 | 17 |
| TIE/in | 328 | 130 | 125 | 60 | 13 |
| TIE/D | 720 | 186 | 375 | 132 | 27 |

各カード40戦の両陣営合計。命中・失効・目標喪失は既存シミュレーターの弾追跡カウンター。最終列は発射数と確定済み3分類の差で、命中への加算はしていない。

## 条件とリプレイ

惑星あり、先頭機間8 kmからの対向、4機ずつ、刻み0.25秒、上限300秒。シード21～40を各カードで共用し、同シードで陣営の初期配置を入れ替えた。対空兵装を全機とも収容上限まで震盪ミサイルに統一。旋回質量・推力ベクトル・ミサイル使用・ロック・弾種別射程・ミサイル回避を有効、既存の比例誘導を航法定数3で使用。追加のシールド倍率は設定していない。

動画はどの相手もシード24、Xが開始側A。全試行に含まれる3戦で、勝敗を見ての選び直しはしていない。上面・側面・3Dは同じ記録を使い、3Dの両陣営の機体はこの版の `Gfx.fleetGeometry` が作った作例モデル。黄の点と線は飛翔中のミサイルの記録位置と航跡。機体の姿勢・位置は刻みの間を補間し、最初のミサイル発射の前後は等速、そのほかは4倍速。録画用カメラの切り替えは戦闘に影響しない。

| 対戦 | 動画の決着時刻 | 撃墜されたX／TIE | 結果 | 発射数 |
|---|---:|---:|---|---:|
| X 対 TIE/ln | 48.75秒 | 2／4 | X勝利 | 9 |
| X 対 TIE/in | 36.25秒 | 3／4 | X勝利 | 11 |
| X 対 TIE/D | 57.00秒 | 4／2 | D勝利 | 20 |

添付MP4は1280×720、30 fps、52.53秒。章の開始時刻はTIE/lnが0秒、TIE/inが17.90秒、TIE/Dが32.60秒。全1,576フレームのデコードを確認した。ファイル名は `KUAT_4v4_Shield_Replay.mp4`、SHA-256は `fd54906b12b7a96ab22c81fd531e384c684b45fcf0ff6e007c29ba147422912a`。

[3戦の飛行・ミサイル記録](replays) · [動画描画コード](replay.py)

## 再現

下記は作業ブランチのチェックアウトで実行する。既存の `scripts/sim-dogfight.cjs` にミサイル統一、シードの選択、各戦の結果・弾位置の記録を加えた前回の計測スクリプトを再使用した。ゲーム計算は今回のソースを読む。前回のコミットが手元にない場合は `git fetch origin test/dogfight-ranges-20261123-b` で取得できる。

```sh
src=$(pwd)
out=$(mktemp -d /tmp/ks-shield4-XXXXXX)
old=f977580ade4ab51cc32a0181f1a5a16a2572756e
helpers=docs/experiments/dogfight-20261124/x-wing-12v12
report=docs/experiments/dogfight-20261124/shields-4v4
git show "$old:$helpers/matrix.cjs" > "$out/matrix.cjs"
export KS_TEST_ROOT="$src" KS_PLANET=1 KS_TURN_MASS=1 KS_TURN_VECTOR=1
export KS_DOGFIGHT_STORES=1 KS_MISSILE_LOCK=1 KS_ROUND_PROFILE=1 KS_MISSILE_EVADE=1
export KS_GUIDANCE=pn KS_PN_N=3
unset KS_CRAFT_SHIELD KS_LOCK_REACT KS_MSL_RANGE KS_TORP_RANGE
for tie in tie_ln tie_in tie_d; do
  for side in x-first tie-first; do
    dir="$out/$tie/$side"
    mkdir -p "$dir"
    if [ "$side" = x-first ]; then
      a=craft_xwing
      b=craft_$tie
      export KS_TRACE="$dir/trace.json"
    else
      a=craft_$tie
      b=craft_xwing
      unset KS_TRACE
    fi
    ROWS="$dir/rows.jsonl" node "$out/matrix.cjs" "$a" "$b" 20 4 4 > "$dir/stdout.log"
  done
done
node --test tests/craft-shield-generator-scale.cjs
```

描画にはPython 3、NumPy、Pillow、Noto Sans CJK、Cコンパイラ、FFmpegを使用した。

```sh
git show "$old:$helpers/models.cjs" > "$out/models.cjs"
git show "$old:$helpers/raster.c" > "$out/raster.c"
cc -O3 -shared -fPIC "$out/raster.c" -lm -o "$out/raster.so"
node "$out/models.cjs" "$out/tie_d/x-first/trace.json" "$out/models"
for tie in tie_ln tie_in tie_d; do
  OPENBLAS_NUM_THREADS=1 python3 "$report/replay.py" "$report/replays/$tie.json.gz" "$out" "$out/$tie.mp4"
done
```

全6組のシミュレーターが終了コード0。新シールドの既存テストは4件中4件成功。各映像について終了時刻・損失数を対応する試行の行と照合した。[テスト出力](shield-tests.tap)
