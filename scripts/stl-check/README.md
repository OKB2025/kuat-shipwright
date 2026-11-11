# 作例と原本 STL の照合ツール（v24、2026-11-10）

自動支柱（`bridgeLooseStructures`）が付いた作例について、原本 STL に対応する形があるかを調べる道具です。原本の三角形はゲームに入れません。主担当が実行し、結果（ログ・画像）をレビュー担当に渡します。出力先は必ず実行ごとの別ディレクトリにしてください（`docs/benchmarks/` などの基準資料に書かない）。

| ファイル | 役割 |
| --- | --- |
| `meshio.py` | バイナリ／ASCII STL と 3MF を三角形配列として読む |
| `struts.cjs ROOT OUT.json KEY...` | 生成済み作例（`data/examples/KEY/design.json.gz`）の外接箱、接続支柱、支柱の持ち主の構造物を書き出す |
| `buildstruts.cjs ROOT KEY...` | 現在の Core で `buildDesign` し、接続支柱の数を数える（変更前後の比較用。`ROOT` に別のチェックアウトを渡す） |
| `strutcheck.py TOOLS STL KEY STRUTS.json` | 原本を作例の座標へ合わせ（STL の y→艦長 x、z→高さ、x→幅。外接箱で縮尺・原点を合わせ、艦首方向の反転は一致度で選ぶ）、支柱の柱状範囲に原本の形がどれだけあるかを測る |
| `detach.py TOOLS STL KEY STRUTS.json FLIPX [STEP]` | 支柱の持ち主に当たる原本の連結成分と、ほかの形との最小のすき間を測る（原本で元から離れているか、変換で離れたかの区別） |
| `comps_in_box.py TOOLS STL KEY STRUTS.json FLIPX x0,y0,z0,x1,y1,z1` | 指定した箱に重なる原本の連結成分を一覧する |
| `gamesection.cjs ROOT KEY x POS U0 U1 V0 V1 STEP OUT.json` | 作例の構造物を断面で塗り分ける（`BUILD=1` で生成済みファイルでなく現在の Core の `buildDesign` を使う） |
| `sectionsvg.py ...` | 原本の断面線と作例の断面を重ねた SVG を作る |
| `svg2png.cjs FILE.svg...` | SVG を PNG にする（Playwright） |
| `fairrows-audit.cjs js/core.js OUT.json` | 測定立体ごとに、旧 `fairRows`・全行の包絡・2 行の包絡（現行）でのロフト体積を比べる |
| `compvol.py TOOLS STL TOP.json` | 体積差の大きい立体について、対応する原本の連結成分（外接箱の IoU 最大）の体積と閉じているかを出す（ミュニフィセント用の写像） |

注意：外接箱による位置合わせは近似です（全長・幅・高さとも作例と 1% 以内で一致することを確認した艦だけに使う）。ルクレハルクは本来、中心球の中心で原点を合わせる（`scripts/stl-measure/luc_fit.py`）。三角形の外接箱で「柱の範囲に原本の形がある」を数えるため、斜めの面が柱の上を通るだけでも数に入る。最終判断は断面画像で行う。
