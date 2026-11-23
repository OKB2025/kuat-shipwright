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
