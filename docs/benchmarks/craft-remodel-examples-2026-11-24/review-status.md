# レビューの判定と残した項目（2026-11-24、ブランチ claude/jolly-cannon-psv61o）

## 判定

| レビュー | 対象 | 判定 | 対応 |
| --- | --- | --- | --- |
| physics-reviewer（1 回目） | 0930978 | FAIL（指摘 1〜14） | 1〜10・13 を直した（expectation-changes.md「物理レビュー…への対応」） |
| physics-reviewer（2 回目） | dd96e9c | FAIL（対空の枠が戻らない、公試の再装填） | 8b21468・523a1e8 で直した |
| physics-reviewer（3 回目） | 523a1e8 | PASS | 注意 3 件は下に記録 |
| regression-reviewer | 0930978 → dd96e9c | UNVERIFIED → UNVERIFIED | FLEET_PROFILE_VERSION 26、作例 49 隻の組み直し、公試のリセットの不具合を直した。追加の Opus/high を実施 |
| 追加（Opus/high） | 88f2ea3 | A（保存・キャッシュ互換）PASS、B（公試の非同期）FAIL | B1〜B6 を 523a1e8 で直した |
| 追加（Opus/high）2〜3 回目 | 523a1e8、1e62253 | FAIL（操縦中の機体、ジャンプで全快、拒否・取り消しで標的が戻らない／到着直後の次のジャンプ、座標系の傾き） | 1e62253、db74683 で直した（戦闘を引き継ぎ、標的は超空間に入るとき外す、到着点に座標系を置き直す） |
| 追加（Opus/high）4 回目 | db74683 | PASS（指摘 3 件：取り消しで随伴艦が消えたまま、到着時の隊形の向き、無視されるジャンプ命令の表示） | 3 件とも直した（この次のコミット。ブラウザで再確認、trial-jump-check.log） |
| reference-fidelity-reviewer | 0930978 → dd96e9c | evidenceValidity FAIL → partConstraints FAIL（ヴェネターの mesh） | 証拠を最終コミットで作り直した（final-1edc033）。ユーザー「進めて」でヴェネターの mesh を §2 の例外に追加（8b21468）。ven_* はカタログの機関「タービン露出型エンジン」の見た目で通常の装備 |

## 残した項目（理由）

- 点防御の出力の合計の数値確認（物理 UNVERIFIED）：小さな試験の組み立てで迎撃が起きず、コードの確認だけ。艦隊戦の点防御の試験（point-defense-toggle、fleet-missiles-arrive）は通る。
- 手動発射を押したフレームに再装填のタイマーが dt だけ二重に進む（物理の注意、1〜2%）：影響が小さいので次の PR で直す。
- absent の艦の対空の枠が戻った最初の 1 ステップだけ古い値（物理の注意）：同上。
- センサーの定義の給電の扱い、RTS の戦闘に艦のミサイルの規則（誘導の種類・枠）が届いていない（物理の注意 7・8）：RTS は別の仕組みで、今回の範囲外。
- 作例の数値の比較（example-figures-regression）：時間切れで実行できない（基準側も同じ）。mandator-example-refit はメモリ不足（基準側も同じ）。
- ヴェネターの取付台（mountSupport）の再計算・切り欠きの焼き込み・6 基の砲の 0.32 m の再配置、厚みの下限 0.02 m：読み込み・組み立ての既存の規則（README の許可済みの差異）。比較画像は撮っていない。
- CLAUDE.md の「Worker が組み直す」と engine.js の実態（example-unreadable）の食い違い：今回の変更の範囲外。CLAUDE.md は変えていない。
- 全テスト：289eeaa で 568 本（例外 2 本は未実行）。新たな失敗 3 本のうち 2 本はマニフェストの更新漏れで直し、1 本はメモリ不足（単独で通過）。その後の変更（公試・対空の枠）は関連 18 本で確認（/tmp/ks-verify/20261124-fixes2/）。
