# 期待値の変更（2026-11-24、リモデル 9 機・発生器サイズのシールド）

CLAUDE.md の「期待値の変更はレビュー対象」に従う一覧。どれも f00cc2a では通り、この変更で作例の設計そのもの（ユーザーのリモデル）が変わったために合わなくなったもの。物理の許容差は変えていない。各テストの変更箇所に同じ理由のコメントがある。

| テスト | 前の期待値 | 後の期待値 | 根拠 |
| --- | --- | --- | --- |
| catalogue-reference-speed-ui.cjs #5 | ARC-170・BTL-B・ハイエナの注記に公表速度の文 | 14 機すべて「user's remodel design」の注記 | 作例がリモデルになり、注記が「ユーザー提供のリモデル設計…」になった（js/core.js craftRemodelDesign の登録） |
| craft-laser-output.cjs #3/#4 | ARC-170 = 重レーザー 2＋小型旋回砲塔 2（2·400+2·2·10 kt/s） | 固定レーザー 2＋固定軽レーザー 2（2·50+2·10 kt/s） | リモデルの兵装 claser #39/#40・claserL #41/#42（data/imperial2.js CRAFT_REMODEL.arc170） |
| craft-laser-output.cjs #9 | ARC-170 の艦隊値 = 前方の目標への戦術画面の値 | 艦隊値 = 前方＋後方の値 | claserL #41/#42 は尾部の後ろ向き固定砲（dir [-1,0,0]）。艦隊値は全砲の合計という定義（#3）は変えていない |
| craft-laser-output.cjs #9 | 表だけの機種の推定を Y ウイングで確認 | B ウイングで確認 | Y ウイング（BTL-A4）が作例 craft_ywing になり、表の推定を使わなくなった |
| example-saved-designs.cjs #8 | Rts.CRAFT.ywing を変えると model key が変わる | Rts.CRAFT.bwing で同じ確認 | 同上（作例になった機種の値は設計から出る） |
| craft-thermal-wings.cjs | ハイエナ・V-19・ヴァルチャー・V ウイングの放熱翼の名前と番号（旧作例） | リモデルの名前と番号（V-19 は 7〜9 の 3 枚） | 放熱翼はリモデルの部品（mesh-parts.txt・full-diff.txt で設計と一致） |
| fighter-interiors.cjs（リモデルだけ） | 定格推力 = 各機関の曲線 B の推力の和（±0.01%） | 和以下（正） | 設計者が配線した電源網の解で決まる。ARC-170 は 81%、BTL-B は 73%（反応炉がシールド・砲にも配線されている）。工場製の機体は前のまま等号 |
| fighter-interiors.cjs（リモデルだけ） | 保存された熱の経路はすべて有限の容量 | 有限、または未設定 | 設計者が描いた経路は容量なしで保存され、実行時に既定の容量（HEAT.linkK、js/core.js の normalize heat links）が入る |
| fighter-interiors.cjs | 全機の着陸の支持が足りる | V-19・V ウイング・Z-95 は足りない | V-19・Z-95 は発射管に戻した重さの分、V ウイングは設計のまま。ユーザーに報告済み、設計は変えていない |

新しいテスト：craft-gas-return.cjs、craft-shield-generator-scale.cjs、part-angle-wrap.cjs。

物理レビュー（physics-reviewer、2026-11-24）：ARC-170 の射撃範囲と B ウイングへの移し替えは妥当と判定。fighter-interiors の 3 点は、その後の変更のため再レビューの対象。

## 追加（Y ウイングの機種を BTL-A4 にしたあと）

| テスト | 変更 | 根拠 |
| --- | --- | --- |
| fleet-air-strike-flown.cjs・stray-fire-craft.cjs・fleet-air-restraint.cjs | Y ウイングの性能表を `'craft_btlb'` の文字ではなく `C.FLEET_AIR.roles.ywing.key` で作る | 高負荷レビューの指摘で FLEET_AIR.roles.ywing を craft_ywing（BTL-A4）にした。文字のままだと Y ウイングの性能表がなく、爆撃機が出ない |
| fleet-air-restraint.cjs #6（再武装） | 反乱側の格納庫の飛行隊も空にする（設定の変更） | BTL-A4 では反乱側の第 2 の Y ウイング飛行隊（6 機）が再武装の間に出撃し、帝国側は 2026-11-19 のユーザー決定（広域防空）どおり戦闘機で応じて爆撃機を出さない。規則の働きどおりで、このケースは再武装の確認 |
| part-angle-wrap.cjs | ±180 の内側（-180 を含む）は保存値のまま（30.1、-180、-179.999999） | 高負荷レビューの指摘：剰余の計算で範囲内の小数が 1e-14 ずれ、-180 が 180 になっていた |
| craft-shield-generator-scale.cjs | 戦略画面の飛行隊の機体も発生器の大きさで読む | 高負荷レビューの指摘：カタログの性能表に分類がなく、長さで読んでいた |

fleet-air-restraint.cjs の #4・#13 は変更前（f00cc2a）から失敗している（suite-comparison.txt）。
| craft-proximity-shield.cjs #3 | 中心を通る弾は機体に当たり、シールドを素通りする | 信管の届く範囲より小さい機体には、中心を狙った弾も手前で炸裂し、シールドに当たる | ユーザー「近接信管なんだから当たる前に爆発するべきでは？」（2026-11-24）。信管の範囲（10 m か全長の 0.4 倍）より大きい機体だけが直撃を受ける |
| reference-sublight-speeds.cjs #7 | 価格表の機種 12 | 13 | BTL-A4 Y ウイング（craft_ywing）が新しい作例として価格表に入った |
| trial-guidance.cjs #5 | 熱源（震盪）ミサイルが発射機の照準の間だけ誘導される | 対レーダーミサイルのレーダーロック発射が、機首 30° の内に目標を保つ間だけ誘導される | ユーザー「レーダーロック発射、機首から30°で長距離発射する時…熱源は背面を取った方が当たりやすい」（2026-11-24）。熱源は自分で熱を追う |
| trial-guidance.cjs #6 | 魚雷は機体より 150 m/s 速く出て到達距離で止まる（試験の弾道） | 機体の速さで出て、距離で減速し、航空機にはまっすぐ飛ぶ | ユーザー「魚雷の誘導装置は艦艇クラスの重量にしか反応できない…」（2026-11-24） |
| trial-guidance.cjs #7・#9・#10 | ミサイルの射程 1,500 m、ロック 1 秒 | 射程 3,000 m（既定）、ロック時間は KS_LOCK_S=1 で固定して確かめる | ユーザー「ミサイルロックまでの時間を作る」「射程を伸ばして」（2026-11-24） |
| craft-missile-trial-rules.cjs 魚雷 | 600 m/s を超えない | 機体の速さで出る | 同上（発射機の慣性で進む） |
| missile-seekers-torpedo-flight.cjs（選び方・艦へのパッシブ） | 熱源は砲の照準（15°）、パッシブは 60° の内、艦へは探知ドームか点防御 | 熱源は 60°、パッシブは全方向、艦へは自機を捕捉しているセンサー | ユーザー「熱源は自分の中心から60°範囲…対レーダーは360°…自機を捕捉してるセンサーにパッシブ」（2026-11-24） |
| craft-missile-trial-rules.cjs ロック | ロックする機体は X ウイング | TIE/ln | レーダーロックはセンサーを持つ機体だけ（同上）。X ウイングはセンサーを持たない |
| missile-seekers-torpedo-flight.cjs・craft-missile-trial-rules.cjs・trial-guidance.cjs（ロック・パッシブ） | ロック・パッシブの機体は TIE/ln、センサーのない機体は X ウイング | ロック・パッシブの機体は TIE/D、センサーのない機体は TIE/ln・TIE/in。X ウイングの制空はレーダー誘導 6 | ユーザーの Rev2「むしろTIE/lnとinのセンサーを外した」、X ウイングに前方捕捉センサー追加、「レーダーパッシブにもセンサーが必要になるように」（2026-11-24） |
| missile-launcher-runtime.cjs #12・missile-launcher-range.cjs #11 | 航空機の発射管 1 基にミサイル 6 発、A ウイング計 12 発 | 1 基 3 発、A ウイング 6 発 | ユーザー「ミサイルは発射機あたりに3発」（2026-11-24） |
| fleet-missiles-arrive.cjs #8・missile-launcher-range.cjs #5・dual-purpose-weapons.cjs #11/#13（設定） | 撃つ艦はセンサーなしで 12〜30 km から撃てた | 撃つ艦に ISD-72x と同じ容積のドームを持たせた（捕捉枠 4） | ユーザー「艦の発射機のミサイルは艦の至近まではレーダー誘導のみ（センサーと捕捉枠が必要）」「ISD-72xのサイズで4枠」（2026-11-24）。各試験の主題（届く距離・着弾・防空の割り振り）はそのまま |
| point-defense-toggle.cjs #2 | 対空交戦枠を使うと枠の数より減る | 枠 0 の艦は至近の 1 枠を持つので、その 1 枠より減る | ユーザー「枠は対空交戦枠と同一」「対空交戦枠もセンサー外容積で」（2026-11-24） |
| point-defense-toggle-aircraft.cjs #4（設定） | 撃つ艦はセンサーなしで 12 km から撃てた | 撃つ艦に ISD-72x と同じ容積のドーム | 同上・艦のミサイルのレーダー誘導 |
| ship-missile-guidance.cjs（設定） | — | 試験用の性能表を新しい規則の版（trackModel）にした | 古い性能表は保存した対空交戦枠をそのまま使うため |
