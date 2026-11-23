# 速度差を使う空戦AIと対空ミサイルの統一

対象 8bf82e1。TIE/in 対 TIE/ln、各4機、惑星あり、8 km対向、シード21–40の配置交換、300秒まで。レーザー併用、両機とも震盪ミサイル6発。前試験の魚雷搭載ではinが22勝18敗。

実装は速い機体の速度指令に両機の巡航速度差を加え、自機巡航速度で頭打ちにする。適用先は航空機同士の格闘戦の追尾・旋回。最高速度はin 1,893、ln 1,789 m/s。速度は交戦開始から終了までの生存機・各0.25秒のサンプル平均。

| AI | A側 | in勝 | ln勝 | 相討ち | 損失 in/ln | 平均速度 in/ln (m/s) | ミサイル発射/命中記録 |
|---|---|---:|---:|---:|---|---|---|
|off|in|5|15|0|73/52|563/494|105/26|
|off|ln|7|11|2|69/55|567/500|118/32|
|on|in|6|13|1|73/50|569/493|114/26|
|on|ln|7|12|1|70/53|555/490|113/30|
|reaccel|in|5|15|0|75/49|558/484|108/27|
|reaccel|ln|6|14|0|72/48|556/468|129/27|

再現は対象コミットに missile-trials.patch を適用し、on条件のみ speed-ai.patch も適用する。KS_PLANET、KS_TURN_MASS、KS_TURN_VECTOR、KS_DOGFIGHT_STORES、KS_MISSILE_LOCK、KS_ROUND_PROFILE、KS_MISSILE_EVADE は1、KS_GUIDANCE=pn。RESULTSは条件ごとに新しいJSONLパス。node scripts/sim-dogfight.cjs craft_tie_in craft_tie_ln 20 4 4 と、機種順を逆にした条件を実行。

reaccel は上の速度差補正に加え、目標が機首方向から水平面で90度より後ろにいる間、速い機体が巡航速度へ戻す指令を出す。基準コードに reaccel.patch 単独を適用する。識別条件はこのゲームの試験用に置いた。fighter-dogfight-arcs.cjs はこの版で5件合格。全体平均速度は、生存時間や戦闘経過によっても変わる。
