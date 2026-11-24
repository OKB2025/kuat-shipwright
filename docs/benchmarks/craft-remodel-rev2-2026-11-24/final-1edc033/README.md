# 最終コミットでの形状の証拠（形状レビュー 2026-11-24 の指摘への対応）

コミット：commit.txt。Vulture・Hyena は Rev3、ほかの 12 機は Rev2 の原本と比べた（full-diff.py をそのように直した）。

- check.log：14 機とも部品数が原本と同じ、`float` 0、`floatingFits` 空。TIE/D は cmsl×2（ユーザー「TIE/Dも発射機に変更して」、Rev2 の性能表 KUAT_14_Starfighter_Specs_Rev2.csv の TIE/D「震盪ミサイル4発」なのでミサイル発射管にした）。
- tube-protrusion.log：発射管が本体の外に出る割合（今回のコミットで再計算）。
- full-diff.txt：原本との全項目比較。14 機とヴェネターで「片側にしかない部品・装備」は 0。違いは発射管の種別・位置、薄い部品の厚みの下限、読み込み時の既存の規則（README の許可済みの差異）だけ。
- ヴェネター（full-diff.txt の venator）：部品・装備の追加なし（接続支柱なし）。違いは読み込み・組み立ての既存の処理による次のもの：
  - 構造物 #174 の切り欠き 13 個が焼き込み（bakedMesh・bakedSections）に移った（bakeAllCuts）。
  - 装備の取付台（mountSupport）の再計算、supportLift の印。
  - 6 基の砲（#128〜#133）が横方向に 0.32 m、#119・#159 が 0.0003 m 動いた（取付面への再配置）。
  - 名前が艦級名「ヴェネター級」に（ユーザー「作例の艦は全て艦級名のみで」）。
  airWings（艦載機の編成）は原本と同じ。
- venator-sha256.txt：受け取ったファイル、refs の gz、展開後の内容の SHA-256。受け取ったファイルと展開後の内容は同じ（キャッシュ項目を除く処理なし）。

ヴェネターの mesh 部品と skinAsset（ven_* 10 件）について：ユーザーの設計そのもので、「ヴェネターはこの作例を使って」の指示による。reference-fidelity-rules.md §2 の例外にヴェネターを加えるかどうかはユーザーに確認中。
