# エグゼクター：分割原本の組み立てと自動支柱の照合（2026-11-10）

ユーザー提供の 3D 印刷用分割原本（Bow_1.3mf、Bow_2.3mf、Mid_ship_A__C.stl、Mid_ship_B.stl、Bridge_section.stl、Stern_1_Update.stl、Stern_2.3mf。リポジトリ外、ハッシュは `docs/dev-status-2026-11.md`）を組み立て、作例と照合する。作業ディレクトリは環境変数 `KS_EXE_WORK`（実行ごとに別のディレクトリ）。Python は numpy・Pillow、`restore*.py`・`gaps.py`・`lateral.py`・`footscan.py` は shapely（検証用。ゲームの依存ではない）。

| 手順 | コマンド |
| --- | --- |
| 1. 組み立て（切断面の一致で平行移動を求める） | `python3 -I assemble.py UPLOAD_DIR $KS_EXE_WORK/assembled` → 各継ぎ目の IoU を表示 |
| 2. ゲーム座標へ | `python3 -I to_game.py`（`stl-exe-game.npy`） |
| 3. 作例の機関 | `node -e` で作例の `k==='engine'` の位置・ノズル長・本体長を `engines-detail.json` に、`partAABB` を `engines.json` に書き出す |
| 4. 原本の機関外殻（外に出ている長さと半径） | `python3 -I nacelle2.py`（`nacelles.json`。艦首側の機関筒の穴を外殻と誤認しないよう、外殻が続く最初の区間だけを使う） |
| 5. 船体の測点の当てはめ | `node hull0.cjs ROOT $KS_EXE_WORK/hull0`、`python3 -I fitstations.py`（`stations-fit.json`、原本−機関空間の内側に収め、トレンチ範囲は舷側帯と幅を保つ）、`node hull0.cjs ROOT $KS_EXE_WORK/hullfit1 stations-fit.json`、断面図 `hulldraw.py` |
| 6. 船体の外の構造物 | `python3 -I body60.py`（60 m の帯、原本−当てはめた船体−機関の空間−トレンチ開口の外側−艦橋の範囲）、`python3 -I seat60.py`（斜めの甲板へ届かせる） |
| 7. 組み立てと確認 | `node eval.cjs ROOT OUT.json`（支柱・接地・警告・機関の露出・加速）、`node prop.cjs ROOT OUT.json`（機関ごとの入力・推力・電源） |
| 8. 断面画像 | `gamesection.cjs`・`sectionsvg_exe.py`・`../svg2png.cjs` |

shapely が要るのは `gaps.py`・`restore_lib.py`・`nacelle2.py`・`hullfit.py`・`fitstations.py`・`body60.py`・`seat60.py`。

組み立ての結果（2026-11-10）：外形 196.77 × 581.57 × 51.14 mm、32.67 m/mm で全長 19,000 m・幅 6,428 m・高さ 1,671 m。継ぎ目の一致度（切断面の重なり）は翼 0.983、艦橋 0.973、艦首 0.941・0.997、艦尾 0.773（Stern_2 の前面が相手より縦に大きい）・0.985。回転はなく平行移動だけ。

2026-11-10 の最初の修正（浮いた段丘の下だけを補う `EXECUTOR_RESTORED_TERRACES`）は、船体の当てはめ直しと構造物の作り直しに置き換えた。
