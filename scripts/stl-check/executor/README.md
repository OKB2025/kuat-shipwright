# エグゼクター：分割原本の組み立てと自動支柱の照合（2026-11-10）

ユーザー提供の 3D 印刷用分割原本（Bow_1.3mf、Bow_2.3mf、Mid_ship_A__C.stl、Mid_ship_B.stl、Bridge_section.stl、Stern_1_Update.stl、Stern_2.3mf。リポジトリ外、ハッシュは `docs/dev-status-2026-11.md`）を組み立て、作例と照合する。作業ディレクトリは環境変数 `KS_EXE_WORK`（実行ごとに別のディレクトリ）。Python は numpy・Pillow、`restore*.py`・`gaps.py`・`lateral.py`・`footscan.py` は shapely（検証用。ゲームの依存ではない）。

| 手順 | コマンド |
| --- | --- |
| 1. 組み立て（切断面の一致で平行移動を求める） | `python3 -I assemble.py UPLOAD_DIR $KS_EXE_WORK/assembled` → 各継ぎ目の IoU を表示 |
| 2. ゲーム座標へ | `python3 -I to_game.py`（`stl-exe-game.npy`） |
| 3. 作例の三角形 | `node gametris.cjs ROOT executor $KS_EXE_WORK/game-exe`（`BUILD=1` で現在の Core から組み立て） |
| 4. 支柱の上下の部品 | `node owners.cjs ROOT $KS_EXE_WORK/owners.json`（`BUILD=1` 同上）。機関の箱は `engines.json`（README 末尾） |
| 5. 支柱の柱の原本の中身（交差の偶奇） | `python3 -I column.py`（`column.json`） |
| 6. 浮いた段丘の下に原本の中身を補う外形板 | `python3 -I restore2.py`（`restored2.json`、支柱ごとの報告 `restored2-report.json`） |
| 7. 原本でも離れている段丘の確認 | `lateral.py`、`footscan.py`、`plategap.py` |
| 8. 断面画像 | `node gamesection.cjs ROOT executor x POS U0 U1 V0 V1 STEP OUT.json` と `python3 -I sectionsvg_exe.py x POS U0 U1 V0 V1 OUT.json OUT.svg 題名`、`../svg2png.cjs` |
| 9. 機関ごとの体積・推力 | `node engvol.cjs ROOT OUT.json` |

組み立ての結果（2026-11-10）：外形 196.77 × 581.57 × 51.14 mm、32.67 m/mm で全長 19,000 m・幅 6,428 m・高さ 1,671 m。継ぎ目の一致度（切断面の重なり）は翼 0.983、艦橋 0.973、艦首 0.941・0.997、艦尾 0.773（Stern_2 の前面が相手より縦に大きい）・0.985。回転はなく平行移動だけ。

`engines.json` は `node -e` で作例の `k==='engine'` 部品の `partAABB` を書き出したもの（restore2 は機関の箱から 30 m 離す）。
