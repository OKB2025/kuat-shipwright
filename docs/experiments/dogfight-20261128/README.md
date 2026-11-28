# 制空任務の4対4（2026-11-28）
ゲーム版 `790afd4a4344e2bd329fcecffd652fb0be722556`。各40戦でシード21～40を双方の開始側から使用。惑星あり、8 km対向、制空任務搭載、300秒制限。通常空戦シミュレーターを使用。拡張索敵マップと空戦の接続は試験していない。

|相手|X勝／TIE勝／分|損失 X／TIE|終了中央値 秒|ミサイル発射／命中|
|---|---|---|---:|---|
|TIE/ln|40／0／0|0／160|61.75|452／160|
|TIE/in|5／35／0|151／84|84.375|466／89|
|TIE/D|14／26／0|129／110|71.25|1369／363|

全120戦で片側が全滅。命中はコアの衝突記録。TIE/lnは任務で選ばれたミサイルが0発で、砲撃イベントも全40戦で0回。TIE/inは熱源弾2発、TIE/Dは対レーダー弾8発、Xは対レーダー弾6発を1機ごとに搭載。砲撃がなかった理由と個々の撃墜の原因は未検証。

[全戦の記録](trials.csv)・[前回の記録](https://github.com/OKB2025/kuat-shipwright/blob/72a32a5b3410c4c3c1dddab7673e0cf3e1806bcb/docs/experiments/dogfight-20261124/mission-load-4v4/trials.csv)

再現はリポジトリのルートから以下を実行する。

```sh
out=$(mktemp -d)
sh docs/experiments/dogfight-20261128/tools/run.sh "$PWD" "$out"
python3 docs/experiments/dogfight-20261128/collect.py "$out"
```
