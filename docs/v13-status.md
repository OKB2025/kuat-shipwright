# v13実装状況と今回の継続開発

対象は [統合開発指示書v13](development-spec-v13.md)。原本のSHA-256は `a0139ef3a6cdf6c0bf7bb39e0ee7fd483cc28f155c7499b4216711e8668ca561` です。84件は要求IDの数で、独立した84個の処理系ではありません。

## 監査の基準

PR #20・#21を取り込んだmain（`b3a873d`、ゲーム内容は `79910bb` と同じ）を基準に、4分野へ分けて全84 IDをソース・既存テスト・直前のブラウザ記録と照合しました。全体585件成功の記録はこの基準版の回帰結果であり、v13全受入条件の達成を示しません。ソースを読んだ確認、実行した単体テスト、実ブラウザ操作、未実施の実機試験を区別します。

最新のユーザー指示を優先します。主翼そのものの散逸機能、独立したTIE型太陽光パネル、表面装甲・設備・砲列、各艦の正面優先目標、合同任務群全体の陣形、旧外装式散逸パーツの廃止を、古いv13の表現へ戻しません。

監査時点の内訳は **実装済み12、部分実装62、未実装7、要調査2、仕様判断待ち1**。部分実装62件のうち、45件は機能コードがあり主に受入検証が不足、13件は機能の追加・接続が必要、4 IDでは具体的な不具合を再現しました。同じ不具合が複数の要求IDへ関係するため、不具合の件数とは一致しません。検証不足を新機能の欠落と同一視せず、コードがあるだけで完了にもしていません。

## 今回の実装単位

- **PLAN-013 / USERPART-003：** 四方向の頂点対称編集。左右・上下の直接の相手だけを更新して斜めの相手を取り残す経路を修正し、同じ変換と履歴へ接続しました。
- **SENS-001 / SENS-003 / SENS-004：** 実際の散逸帯域からの放射と有限の接触喪失処理。初回の厳格熱計算前に停電艦へ旧推定の放射が付く不具合と、観測艦を失うと推定座標・誤差がInfinityになる不具合を修正しました。
- **PLAN-026 / PLAN-027：** 共通航程分割。主要航路の連続区間と、一辺ごとに停止・再充填・再指示が必要な支線を同じ航路データから扱います。銀河図と作戦図の完全な一画面化とは分けています。
- **BUG-001：** 音声設定の押せる領域を44pxへ拡大し、PCの音声アイコンも拡大しました。
- **PLAN-004：** 戦闘状態の「個別：移動」等の合成ラベルを英訳。攻撃・護衛の対象名はUI語と一致してもそのまま保持します。
- **PLAN-007 / PLAN-008（v26）：** ウォーカー・戦闘車両の設計（v27 でプレイヤー設計は廃止）と、揚陸艇で降りる地上戦（演習・任務・艦隊戦から）。詳細は [地上戦](ground-combat.md)。

以下の一覧は監査時点の分類を保持し、今回の修正・検証は後段へ記録します。今回触れない62件全体やキャンペーン全12段階を完了扱いしません。

## 全84 IDの一覧

| ID | 監査時状態 | 未完了の種類 | 実装根拠・検証／残る境界 |
| --- | --- | --- | --- |
| BUG-001 | 部分実装 | コードあり・主に受入不足 | index.html .icon-btn / .snd-btn / .title-snd / 音声設定・ミュートは他の設定ボタンと同じ枠を使うがPC36px（狭幅32px）。専用のクリック領域・実ブラウザ受入検証が未確認。 |
| BAL-001 | 要調査 | 実機／比較調査が不足 | `Rts.DOCTRINE/AI_STRATEGY`、設計値・共通費用は存在。共和国対CISの性能／編成／AIを入れ替える固定シード対照試験と調整根拠は未確認。強弱を断定しない。 |
| AI-001 | 部分実装 | コードあり・主に受入不足 | `tfRange/groupStations/moveShips/tfAutoForm` が任務群距離・隊形追従・損傷離脱と回避を共用。新しい各艦正面優先は `tests/fleet-independent-engagement.cjs`。大規模の混成艦隊で全旋回・再編・乱戦抑制の検収は残る。 |
| PERF-001 | 部分実装 | コードあり・主に受入不足 | `scripts/benchmark-surface-systems.cjs` と `docs/surface-systems.md` に110隻共通戦闘CPUと別のSwiftShader描画測定。幾何BVH・照会キャッシュ・描画LODあり。戦略AI／衝突／センサーを同時に走らせる比較測定、実機GPU・長時間メモリは未検収。 |
| UI-001 | 部分実装 | コードあり・主に受入不足 | app.js selPick / selSync / editTap / bindEdit / 3Dと配置済み一覧が st.multi / st.sel を共有、Shift追加解除・タッチ複数・PAD action が同じ経路。全操作形態を横断した専用回帰は未整備。 |
| UI-002 | 部分実装 | コードあり・主に受入不足 | app.js xfPlan / xfCheck / dragSelStart-Move-End / xfCommit / 数値XYZ・ドラッグ・相対位置維持・干渉プレビュー・Undo の実装あり。表面コピー回帰は既存だが一般複数区画の端末横断受入は未確認。 |
| UI-003 | 部分実装 | コードあり・主に受入不足 | app.js xfPlan(kind=align) / xfUnits / xfBox / XYZ、両端固定、実AABBの隙間均等・負隙間警告・プレビューあり。異寸法/入れ子/対称を組み合わせた専用受入回帰なし。 |
| UI-004 | 部分実装 | コードあり・主に受入不足 | app.js xfPlan(kind=rotate) / xfPartOut / xfFitOut / XYZ、個別/全体中心、プレビューあり。turret-rotation-transform.cjs が砲塔の実メッシュ・Z/Y followers を検証。一般形状/グループ操作の全組合せは未確認。 |
| UI-005 | 部分実装 | コードあり・主に受入不足 | app.js editListHTML / edGroupRows / edItemRow / edFocus / 配置済み一覧、カテゴリ折畳、階層、選択同期とスクロールあり。左右配置や390pxでの一覧全機能の受入記録は未確認。 |
| UI-006 | 部分実装 | コードあり・主に受入不足 | app.js renderInspBar / bindInspBar; index.html .inspbar / 設計中常時表示、正常/情報/警告/エラー件数、対象選択、狭幅折畳あり。全配置工程・PADでの受入は未確認。 |
| UI-007 | 部分実装 | コードあり・主に受入不足 | app.js editGroup / editUngroup / edLeaves / selEntities; core.js normalizeGroups / 設計内入れ子、分解後子を維持、変換・複製・保存あり。明示登録のみ USERPART 化。surface-copy-ui などがグループ付き複製を検証するが一般階層の専用回帰不足。 |
| UI-008 | 実装済み | 検証済み範囲あり | app.js editRenderPanel / renderPanel / editOpsHTML / 配置カタログと配置済み編集一覧は別タブ。unified-palette.cjs、surface-editor-ui.cjs 等の実生成UI回帰があり、表面ブラウザ確認でも両タブを操作。 |
| PLAN-001 | 実装済み | 検証済み範囲あり | core.js designCraftSnapshot / cleanDesignCraft / craftCombat; app.js voyEmbarkedDesignOptions / voyPickEmbarkedDesign / 艦船と機体は共通の設計・保存、設計snapshotを編成し格納寸法/ハッチから発艦・戦闘。embarked-design-core/storage/ui/models/rts と craft-systems-runtime の既存回帰、docs/embarked-designs.md。 |
| PLAN-002 | 実装済み | 検証済み範囲あり | `Core.designCost`、`Rts.craftPrice/shipCost/fleetCost/scenarioCosts` を全陣営で共用。`voyCostLine/voyShipCostHTML`、設計・編成に費用表示。`tests/craft-cost-parity.cjs`、12設計モデル8カタログ検査に根拠。キャンペーン査定はPLAN-024で別途未完。 |
| PLAN-003 | 部分実装 | コードあり・主に受入不足 | `voyEdOb/voyCtgHTML/voyTgHTML` と共通編成、`normalizeScenario/scenarioWorld`・JSON入出力、配置・勝利条件・固定シードあり。編成は両陣営で自作設計を使用可。全配置項目と固定シードによる戦闘全経過の保存再現を実ブラウザで未検収。 |
| PLAN-004 | 部分実装 | コードあり・主に受入不足 | js/i18n.js / js/lang-en.js; app canvas/text wrappers / 日英切替・辞書・ユーザー名維持・各画面の多数回帰あり。ただし前回ブラウザで既存見出し「個別：移動」がENに残る事実があり、アプリ全固定文言ゼロは未達。 |
| PLAN-005 | 部分実装 | 機能の追加・接続が必要 | `Core.FITS`、`fitSpec`（core.js:3645）、`turretRate`、充電設備・共通電力熱、砲塔回転UI・複合パーツ保存。既存 `turret-rotation-*`、`surface-energy-*` が関連基盤を検証 / 武装は定義済み種類の選択・倍率変更。砲身／加速装置／砲基部／旋回装置を組み合わせた独自武装定義、その重量からの旋回能力、再使用カタログは未接続 |
| PLAN-006 | 部分実装 | 機能の追加・接続が必要 | `EQUIPMENT` の露出／内蔵エンジン、`resizeEngine`・`engineRating`（core.js:3909〜）、`equipmentInfo`・`changeEngineSize`（app.js:4754〜）、共通 `assemblyCapture/Place` / 寸法・向き・給電と推力等を編集でき、複合パーツとして再利用する基盤はある。独自エンジン専用の設計保存・能力比較の一巡は未検証。性能係数・構成自由度は限定された2系統 |
| PLAN-007 | 部分実装 | 機能の追加・接続が必要 | `VEHICLE_TYPES`・`groundStatus`・`stowLoad`、艦隊編成の連隊／大隊／中隊編集、`tractorTick` の移乗兵力（core.js:14028）。`fleet-loadout-separation.cjs` は配置所有・輸送を検証 / 地表上の展開・移動・射撃・地上勝敗・航空支援の実戦処理は見当たらない。現状は輸送／編成／拿捕兵力 / **v26：** `Ground`（core.js）に地上戦を実装。艦の連隊の中隊・車両小隊が揚陸艇の積載で段階的に降下し、地形・射線・遮蔽・制圧・航空支援・目標と損害で勝敗。任務（制宙権確保後の「揚陸作戦」）と艦隊戦（`Ground.orderLanding`、艦隊戦の時計で自動決着）へ接続。演習（PLAN-025段階7）あり。[地上戦](ground-combat.md) |
| PLAN-008 | 未実装 | 要求機能が未実装 | 既存車両の種類・寸法指定と輸送はあるが、共通設計の `SHIP_CLASSES`（core.js:842〜）は艦／航空機のみ / ウォーカー／車両の設計プラットフォーム、歩行／走行、プレイヤー設計機を地上戦へ投入する入口がない / **v26：** `platform: walker|vehicle` の設計（`ks-vehicle` 版1）、車体・走行・装甲・共通兵装（`fitSpec` の倍率）・乗員・動力から性能と共通費用を算出。保存・書き出し、既存車両種別の作例、`Rts.VEHICLES` 登録で中隊に搭載し地上戦へ投入。形状は手続き生成の2D図（3D編集は未接続） |
| PLAN-009 | 未実装 | 要求機能が未実装 | 構造材による大形形状と艦と同じ装備基盤は再利用可能 / station専用のプラットフォーム・固定配置／移動制約・運用・作例入口がない。推進器を外した艦を専用ステーション実装と同一視しない |
| PLAN-010 | 部分実装 | コードあり・主に受入不足 | core.js parseMeshFile / parseOBJ / parseSTL / parseGLTF / meshImportPart; app.js importFile / placeImportedMesh / OBJ、STL、embedded glTF/GLBを編集可能な struct.mesh へ変換、単位/前後/上/縮尺、修復警告、機能自動生成なし。外部形式別→切削/XYZ編集→保存の専用受入回帰は未整備。 |
| PLAN-011 | 部分実装 | 機能の追加・接続が必要 | `campaignNew/normalizeCampaign/campaignAdvance`（core.js:15520〜15531）と3スロット保存、stage・system・funds・budget・designs・yard・fleet・flags・log / コメントが明示する通りデータ契約のみ。段階達成を生む実際のシナリオ、世界状態の復元、継続プレイは未接続。キャンペーンテストも未確認 |
| PLAN-012 | 仕様判断待ち | 方式未確定・未実装 | 同じ艦隊／コスト／設計を両陣営に使うサンドボックス基盤はある / 対人同期／ホスト／切断復帰／再同期は未実装。ソースにWebSocket／RTCPeerConnection等の対戦接続処理なし。v13自体が同期方式等を未決定としている |
| PLAN-013 | 部分実装 | 具体的不具合を再現 | core.js meshMoveVertices / meshEditCheck; app.js veCommit / veFollow / XYZ座標、選択頂点同時移動、面押出、ドラッグ面、対称、Undo の実装あり。実際の veCommit で4方向対称の斜め兄弟だけ更新されず、1m移動時に1mの不一致を再現（本監査後に修正着手）。 |
| PLAN-014 | 部分実装 | コードあり・主に受入不足 | `Core.heatNetwork/heatSolve/heatTick`、`heatStats`。実砲列の電力損失・共通熱源と実冷却は `surface-energy-ion.cjs`、共通戦闘ブラウザ検証で確認。 / 専用／共用経路の100→60→200流量制約、冗長経路再配分を単独の受入テストとして固定していない。手動リンクは保存APIが中心。 |
| PLAN-015 | 部分実装 | 機能の追加・接続が必要 | `SUPERWEAPONS` と `superweaponStats`（core.js:9937〜）、実入力・効率・蓄積上限・初期率、共通熱・電力・兵器収支。`surface-energy-ion.cjs` が実充電・停電を検証 / オナガー／マレボランス型の既定2種で固定寸法。通常武装と同じ部品構成から独自ハイパーウェポンを作って保存する設計操作はない |
| PLAN-016 | 部分実装 | コードあり・主に受入不足 | `superweaponStats`、`heatNetwork`の指定炉起点、`heatProfileOf/heatFail`、`superweaponCharge/Discharge`。部分充電・実出力・共通廃熱は `surface-energy-ion.cjs` / `surface-manual-runtime.cjs`。 / 致命過熱時の直結炉爆発と周囲区画波及の独立回帰／実ブラウザ検証が不足。旧互換設計は明示的な自動冷却を維持。 |
| PLAN-017 | 部分実装 | コードあり・主に受入不足 | `heatTick`の制限→停止→失敗、`heatFail/heatBlast`の武装電力区画と直結炉の異なる損傷先、`secOk`経路断線。 / 冗長経路・手動停止・停止遅延・失敗から各損傷先への連鎖を直接検証する専用テストがない。 |
| PLAN-018 | 部分実装 | 機能の追加・接続が必要 | タイトルのサンドボックス→任務／設計、キャンペーン→初めから／続きから（index.html:1385〜）、`campSlots/campSave/campTitleRender/campPanelHTML`（app.js:12749〜） / どちらのcampaignボタンも同じ準備中説明欄を開く（app.js:4065）。実際の新規開始・続行・拠点への遷移はない |
| PLAN-019 | 未実装 | 要求機能が未実装 | `CAMPAIGN_STAGES` にassign/helm名。既存の公試・直接操縦・3D飛行は再利用可能 / 24BBY、イータ級シャトル、赤いドレッドノート4隻、旗艦着艦、演習宙域への誘導はシナリオ化されていない |
| PLAN-020 | 未実装 | 要求機能が未実装 | `voyTutStart`（app.js:12007〜）と `VTUT_STEPS` は既存サンドボックス艦隊戦チュートリアル / 既存内容はヴェネター＋ドレッドノート2隻対ミュニフィセント2隻で、4対4の第55任務群ではない。演習出力／非爆沈撃破認定／キャンペーン戦果保存がない |
| PLAN-021 | 部分実装 | 機能の追加・接続が必要 | 任務の `msDockShip/msBattleDone/msReportHTML`、修理・回航・結果・銀河図・編成は存在（app.js:12644,12811,13022） / 現行MS任務はキャンペーン状態機械と別。序章での基地接近・入港を進行条件にして補給→演習結果→拠点へ進む接続とフラグ保存はない |
| PLAN-022 | 未実装 | 要求機能が未実装 | MS任務に捕獲艦の改装待ち・就役待ちがあるが、一般の修理／回航処理 / 議長特別予算、2隻選択・予算承認・図面指定改修、根本船体編集の禁止、代替2隻受領はない。`blockedHullControl`（app.js:8217）は冒頭でfalseを返す |
| PLAN-023 | 部分実装 | 機能の追加・接続が必要 | 任務巡回・星図・交戦・`tractorOk/tractorTick/captureShip`（core.js:14007〜）・捕獲艦の編入は存在 / 専用哨戒経路、国籍不明艦の警告後先制、非爆沈の保護された敵、帰投達成による新造解禁、ルーサン上限は未接続。既存捕獲の一般機能を序章完成としない |
| PLAN-024 | 未実装 | 要求機能が未実装 | 共通 `designCost/fleetCost` とcampaign.budget の保存枠のみ / 政治・戦果に基づく3区分査定、承認額の計画単位保持、再設計時の再抽選防止、予算超過建造禁止、特別予算と通常要求の分離は実処理なし |
| PLAN-025 | 未実装 | 要求機能が未実装 | サンドボックスの艦隊戦／設計チュートリアルは存在 / 12段階のキャンペーン導線、地上実戦、車両操作・独自装備・ステーション設計の操作演習はない。テキストの予定一覧は受入条件を満たさない |
| PLAN-026 | 部分実装 | 機能の追加・接続が必要 | `Galaxy.path/EDGES`、`Rts.routePath/LANE` は主要／支線を区別し距離・旅行時間へ反映。しかし `Rts.orderJump`、`trialJumpTo`、戦略 `msJumpSeconds` は支線を含む複数legを一回で直行し、星系ごとの強制停止・再指示なし。今回の最優先候補。 |
| PLAN-027 | 部分実装 | 機能の追加・接続が必要 | `Galaxy.theater/area` と `Rts.makeSector` が銀河地図から地域・星系・航路を導出。`galMapHTML`、作戦図 `voyDrawOps` は別UIで、ズームを通じた同一空間操作への完全統合は未完成。PLAN-026の移動ルール共通化が先。 |
| FORM-001 | 実装済み | 検証済み範囲あり | `groupStations/tfSlots/tfWake/moveShips` が基準位置＋ローカルスロットから協調追従。CTGも `ctgStations` で任務群内部形状を維持。`tests/fleet-ctg-formation.cjs` は実R.tickによる移動・隊形・別命優先を検証。 |
| FORM-002 | 部分実装 | コードあり・主に受入不足 | `sustainSpeed/groupStations/ctgStations` は最遅艦・損傷・給電と速度命令を参照。CTGの1400対700m/sと低速命令は既存テストあり。単体関数の停電時速度0も監査プローブで確認。損傷／混合電力制約を組み合わせた長時間追従の専用検収は残る。 |
| FORM-003 | 部分実装 | コードあり・主に受入不足 | `groupStations` は陣形外周半径・艦の旋回率・スロット距離から減速・回頭。単縦／単横／斜行で方向別の必要移動距離・所要時間を比較する受入テストは未確認。 |
| FORM-004 | 部分実装 | コードあり・主に受入不足 | `TURN_MODES` と `turnModeOf/groupStations/tfWake`、`voyFormHTML/voyTurn` に自動・維持・順次・一斉・転換・最短・安全の全方式あり。全方式の実艦軌跡・衝突・役割維持は専用テスト未検収。 |
| FORM-005 | 部分実装 | コードあり・主に受入不足 | `tfSlots(assignSlots)`、`tf.reform`、減速・追従により移動しながら再編。旗艦スロットは固定、他役割は適合スコアによる優先。進路変更中の全再編方式・役割固定の検収は残る。 |
| FORM-006 | 部分実装 | 機能の追加・接続が必要 | `voyFedRender/Action/Bind` にドラッグ・数値・複数選択・等間隔・反転・回転・スケール・複製。設計共通Undo/Redoへの接続は見当たらず、陣形エディターのタッチ／ゲームパッド一巡も未検収。 |
| FORM-007 | 部分実装 | コードあり・主に受入不足 | `normalizeFormation/groupSlots` のXYZ・role/size/prio/hdg、エディターの上面／側面投影あり。`formationCheck` は適用艦寸法で近接警告。異艦型適用・全操作形態の3Dスロット検収は残る。 |
| FORM-008 | 部分実装 | コードあり・主に受入不足 | `voyFormStore/Put/Del`、陣形JSON、シナリオ `formations` と `tpl:`参照を保持。CTG/任務群陣形JSONは既存テスト。任意3Dテンプレートの全属性・別任務群共有・壊れた入力の独立検収は残る。 |
| FORM-009 | 部分実装 | コードあり・主に受入不足 | `tfRange/groupStations` が任務群共通目的、`moveShips` が局所追従・回避・損傷離脱。新しい各艦射撃目標と別命優先は既存テスト。混成大型艦の位置保持・近接乱戦抑制の長時間比較は未検収。 |
| FORM-010 | 部分実装 | コードあり・主に受入不足 | `tfAutoForm` に90秒クールダウン・20%ヒステリシス・再編距離コスト、既存共通 `tfSlots` へ接続。交戦中自動転換が適切な条件で発火し振動しないことの専用動作試験は未確認。 |
| EDIT-001 | 部分実装 | コードあり・主に受入不足 | core.js SOLID_CUT_SHAPES / compiledSolidCut / solidCutPieces / box/prism/trapezoid/wedge/cylinder/ellcyl/cone/frustum/sphere/ellipsoid/capsule/torus/poly を列挙し実ジオメトリを生成。各形状の繰返し切削・負荷・閉曲面の網羅受入なし。 |
| EDIT-002 | 部分実装 | コードあり・主に受入不足 | app.js solidCutPanelHTML / veObject / veCommit; core.js solidCutToPoly / solidCutFromLocal / カッターを多面体へ変換しXYZ頂点、姿勢・寸法、スナップ・履歴を共通頂点欄で操作。カッターは凸包近似と明示。凹多面体の厳密CSGは対象外、全操作の受入未確認。 |
| EDIT-003 | 部分実装 | コードあり・主に受入不足 | core.js applySolidCuts / solidClipOutside / solidConvexCaps / solidCutThinWalls / 繰返し切削のキャップ・厚み診断、表示/容積/衝突共通化。surface-compat が切削実形状コピー/未配置化を検証。全曲面/極薄壁/非多様体への保証は未検証。 |
| EDIT-004 | 部分実装 | コードあり・主に受入不足 | app.js cutPresets / cutPresetSave / cutPresetLoad / cutPresetImport / ローカルv1形状プリセットとJSON入出力・削除がある。編集形状→登録→再利用→切削の実ブラウザ/専用回帰が未確認。 |
| SBOX-001 | 部分実装 | コードあり・主に受入不足 | PLAN-003と同じ共通敵編成UI・シナリオ処理。両軍で追加・複製・削除・設計選択・編成・AI・配置を保持。全保存／再実行操作の実ブラウザ検収は未確認。 |
| SBOX-002 | 実装済み | 検証済み範囲あり | 艦艇選択を勢力から独立させ、共通 `voyAllDesigns/battleOrbat/createWorld` へ渡す。`tests/fleet-ctg-formation.cjs` はrebel陣営へimperial設計を投入した実worldを使用。自作機・自作艦の編成保存も既存回帰あり。 |
| SBOX-003 | 部分実装 | コードあり・主に受入不足 | `SCENARIO_FORMAT ks-scenario/v1`、`normalizeScenario/scenarioJSON/scenarioFromJSON/scenarioWorld`、`voyScenarioImport/Export` に別保存単位あり。固定シードと全編成・配置・AI・勝利条件を含む同一戦闘全経過の再現比較は未検収。 |
| SBOX-004 | 部分実装 | 機能の追加・接続が必要 | シナリオ `sides` は2〜8陣営のリスト、`createWorld/checkResult` は配列を処理。UIは明示的に2陣営まで。3陣営以上の実戦・配置・索敵・勝敗を専用テストした根拠は未確認。 |
| ENG-001 | 実装済み | 検証済み範囲あり | `fleetPowerStep/powerFactor/powerDomainProfile`、同じ `heatNetwork`へ各消費種別を登録。`surface-energy-ion.cjs` / `surface-energy-review.cjs`と実戦ブラウザで電源遮断・独立電源・主補助炉共通停止を確認。 / 電源管理の基本経路は検証済み。新機能の追加時もこの共通処理へ接続する。 |
| ENG-002 | 実装済み | 検証済み範囲あり | 共通TT/J定数、`weaponEnergy`、入力／射出／損失、シールド／イオン収支、`heatAccrue`と実冷却入力。上記2テスト＋手動運用テストの収支検査、110隻CPU試験。 / 数値係数はゲーム用仮定。全旧効果指数の物理エネルギー化は行わず互換性を維持。 |
| ENG-003 | 実装済み | 検証済み範囲あり | `hdis`は通常部品、容積・質量・給電・接続を共通集計。厳格モードの有限冷却・無負荷時入力0・停電時処理停止を `surface-energy-ion.cjs` で確認。 / 高負荷故障連鎖の受入はPLAN-017に紐づける。 |
| ENG-004 | 部分実装 | コードあり・主に受入不足 | 独立の旧外装散逸パーツは最新指示で廃止。`surfaceSync`の面内蔵hdis、主翼・太陽光パネルが共通散逸ノードへ登録され局所損傷可能。`surface-model-core.cjs` / `direct-thermal-wing-core.cjs`。 / 外装専用品を復活させない。装甲で覆った全種装置の露出／遮蔽組合せを網羅した受入は未完。 |
| ENG-005 | 2026-11-12 に置き換え | 検証済み範囲あり | ユーザー決定により grade 制約と外殻放熱を廃止。低出力翼（`radiator`）は面積当たり能力が低い変換放出面で、炉廃熱も受ける（`direct-thermal-wing-core.cjs`、`heat-converters.cjs`）。[heat-converters.md](heat-converters.md) |
| ENG-006 | 部分実装 | 機能の追加・接続が必要 | `normalizeLinks`と`ship.links`のpower/heat別容量、`heatNetwork`、`surfacePowerStep`。複合パーツ／対称で内部リンクと外部ポート保持は `surface-compat.cjs`。 / 一般的な手動ネットワーク作図UI、導管実体の容積・質量、リンク単位の細かな損傷は限定的。経路は自動接続中心で将来拡張可。 |
| ENG-007 | 部分実装 | コードあり・主に受入不足 | `heatTick`の局所ストレージ、負荷抑制・遅延停止・再起動・燃損、`heatFail`。実砲列の過熱制限と被害状態は共通HUDへ接続。 / PLAN-017と同じ重大過熱受入テスト不足。別の故障エンジンを作る必要はない。 |
| WING-001 | 実装済み | 検証済み範囲あり | `wing`専用パーツ、薄い六角形翼断面、サイズ・前後翼端・後退／前進／デルタ／ダブルデルタ、面積による性能。`dedicated-aero-core.cjs` / `wing-planform-core.cjs` / `wing-planform-ui.cjs`。 / v13の「装置のない翼に散逸を付けない」は、最新ユーザーの翼自体を散逸面とする方針へ読み替える。 |
| WING-002 | 部分実装 | コードあり・主に受入不足 | `wingMembers/wingMap`で内部機器・構造・兵装を同じ可動群へ所属。`runtime-foils-core.cjs` / `surface-compat.cjs`でリンク・搭載機器の追従とコピー保持。 / 薄い翼内の複数設備の必要容積・可動機構・補強の全組合せ検証は未完。 |
| WING-003 | 実装済み | 検証済み範囲あり | `foilFrame/foilPose/foilSweep/foilStep`、回転起点の頂点・辺指定、時間／角度・固着・干渉検査、戦闘中の指示。`foil-pivot*.cjs` / `runtime-foils*.cjs`と今回の実戦ブラウザで追従・発射位置一致。 / 実機ゲームパッドの受入はPADへ。 |
| WING-004 | 部分実装 | コードあり・主に受入不足 | `heatTick`のcs/fo展開係数、`emitBands`は実used流量からのみ放射。`direct-thermal-wing-core.cjs`で装置損傷の能力低下、実戦描画で機構追従を確認。 / 同じ実処理量で開閉しても放射が能力比例で勝手に増えないことの専用受入テストが不足。 |
| SENS-001 | 部分実装 | 具体的不具合を再現 | `emitBands`と`Rts.unitSig`が実散逸帯域・排気・能動放射を分離。無負荷冷却の放射0は `surface-energy-ion.cjs`。 / **確認した不具合**：初回heat solve前の厳格・停電艦にもunitSigが旧noGrid推定の放射を生成。0.4秒の公開APIプローブで再現。 |
| SENS-002 | 部分実装 | コードあり・主に受入不足 | `sensorSuite/sensSNR`がnu/IR/EM/radarを別計算、radarは断面積から計算しnuと混同しない。部品band保存、UIあり。 / 帯域専用機・距離減衰・電源遮断・複数観測艦融合の専用動作テストは未整備。 |
| SENS-003 | 部分実装 | 具体的不具合を再現 | `sensorTick`の推定位置と誤差、`voyContact/voyFoeName`と地図の誤差円。 / **確認した不具合**：既存stage4接触の信号喪失時、候補観測艦が無いとerrとestがInfinityになり地図／AIへ流れる。公開APIで再現。 |
| SENS-004 | 部分実装 | コードあり・主に受入不足 | `sensStageCap`、段階ごとのdwell、nu単独で概略位置に制限、追跡／識別／射撃条件を `sensorTick/contactStage`と戦闘射撃が利用。 / 同一updateでの段階飛越禁止、喪失・再捕捉、時間刻みの独立回帰テストが無い。 |
| SENS-005 | 部分実装 | コードあり・主に受入不足 | `EMCON` normal/low/high/emerg、低放射の出力・radar制限、`heatTick`で蓄熱限界解除。`voySensHTML`の共通命令。 / モード変更・低放射限界・復電・無負荷Sフォイル展開を通す専用検証と実ブラウザ操作が未完。 |
| USERPART-001 | 部分実装 | コードあり・主に受入不足 | app.js userPartRegister / userPartRegisterHTML; core.js assemblyCapture / 複数選択から明示登録し、名前/カテゴリ/説明/原点/取付向き/preview/子/ポートを保持。surface-compat と runtime-foils-core が実captureを検証。登録UI全経路の受入記録不足。 |
| USERPART-002 | 部分実装 | コードあり・主に受入不足 | app.js userParts / userPartImport / userPartsWrite / bindUserParts / カタログ・検索・複製・改名・削除・JSONの実装あり。normalizeAssemblyTemplate の公開読込回帰はあるがカタログ全操作の実ブラウザ受入は未確認。 |
| USERPART-003 | 部分実装 | 具体的不具合を再現 | core.js assemblyPlace / assemblyMirrorFit / mirrorPart / vmirrorPart; app.js xf* / veCommit / 通常選択・移動・回転・複製・分解と左右設置、配置後上下ミラーを共有。surface-compat / surface-y-mirror / turret-rotation-transform の実形状回帰あり。頂点編集4方向対称の未追従を確認。 |
| USERPART-004 | 部分実装 | コードあり・主に受入不足 | core.js assemblyCapture / assemblyPlace / assemblyIssues / netLinks / networkPorts / 子IDと内部/外部の給電・熱リンクを再採番し通常の部品として集計。surface-compat が接続/未接続警告と生成装置の重複防止を検証。全設備種類・二基の推力/質量/発熱総合受入は未確認。 |
| USERPART-005 | 実装済み | 検証済み範囲あり | core.js assemblyPlace; app.js editUngroup / user template delete / 配置は独立した子データを持つ設計グループ。テンプレート削除は配置実体を消さず、子編集/分解と保存が可能。surface-compat / surface-copy-ui / runtime-foils-core が独立ID、元データ不変、再読込を検証。 |
| USERPART-006 | 部分実装 | コードあり・主に受入不足 | core.js normalizeAssemblyTemplate / serialize / deserialize / assemblyIssues / v1テンプレート、既存v3設計の読込・検査とポート警告あり。surface-compat が繰返し正規化、ID、実切削、未配置、512件境界と原子的拒否を検証。長期旧バージョンfixture全種/バックアップ復旧は未検証。 |
| PAD-001 | 部分実装 | コードあり・主に受入不足 | app.js KSInput rawPads / onConnect / onDisconnect / releaseAll / frame / Gamepad APIポーリング/接続イベント、切断時解除、操作対象指定あり。前回表面ブラウザで仮想standard padを実polling経由確認。切断/再接続・多台同時の専用回帰は未整備。 |
| PAD-002 | 部分実装 | コードあり・主に受入不足 | app.js KSInput profileFor / sane / startCapture / diagInput / save / 非標準ボタン/軸再割当、deadzone/感度/反転/永続profileを持つ。実装ありだが設定再読込と非標準全割当の動作検証が未確認。 |
| PAD-003 | 部分実装 | コードあり・主に受入不足 | app.js PAD_HOST / padContext / padScope / virtual cursor/focus / 設計、タイトル、編成、地図、操艦、観戦と汎用DOMフォーカスへ同じpress/analogを接続。表面の仮想PAD操作は検証済み。全画面/頂点/切削/陣形/登録の操作完遂は未確認。 |
| PAD-004 | 要調査 | 実機／比較調査が不足 | docs/PAD-004_checklist_ja.md / PC/iOS/Androidおよび標準padの実機記録表は未記入。OS pairing→ブラウザ→ゲーム内入力の実機検証をソフトウェア仮想入力で代替完了としない。 |
| PAD-005 | 部分実装 | コードあり・主に受入不足 | app.js KSInput openDiag / apiStatus / diagBuild / diagFrame; docs/PAD-004_checklist_ja.md / APIなし/非secure/未検出/認識を分け、ID・mapping・各軸/ボタンlive表示・日本語/英語を実装。ALG-MOGPADSCN実機のB/軸割当とOS別試験は未実施。 |

## 保存・互換性と共通処理

変更ファイルは `js/app.js`（頂点対称・航行UI・構造を保持する状態表示）、`js/core.js`（共通航程・放射・接触）、`index.html`（音声操作領域）、`js/lang-en.js`（表示）、`scripts/benchmark-sensors.cjs`、この報告と仕様原本です。回帰は `tests/vertex-symmetry-edit.cjs`、`tests/sensor-lifecycle.cjs`、`tests/sensor-orders.cjs`、`tests/sensor-presentation.cjs`、`tests/v13-foundation-localization.cjs`、`tests/navigation-itinerary.cjs`、`tests/navigation-ui.cjs` に追加しました。既存の `tests/fighter-follow-integration.cjs` は支線停止後の追従という新ルールへ合わせ、`tests/fleet-loadout-separation.cjs` はテスト用公開フックの順序依存を除きました。

既存の設計v3・表面v1と旧設計の互換運転を維持し、84 IDを新しいゲーム保存データへ複製しません。頂点編集は既存の選択・対称・Undo/Redo、放射と接触は既存の熱・センサー、航程は既存の銀河／地域航路とジャンプ処理へ接続します。

`Core.navigationItinerary(route)` を共通の航程分割とし、`Galaxy.itinerary`／`Rts.routeItinerary` がそれぞれ既存の経路を渡します。現在の一航程と全体の最終目的地を分離し、オプションの `g.navigation`／`trial.navigation` と、保存対象の任務 `MS.navigation[tgId]` に `{version:1,final,stop,remaining,waiting}` を持たせます。航行中のstopは今回の次停止、待機中は実際の現在停止位置で、remainingは以後の停止IDです。

任務の保存version 1は維持し、古いデータでnavigationがなければ空として読み込みます。ローカル／クラウドの復元は `MS.at` と共通の実航路から残航程を検証・再構築します。ライブRTS／公試の独立した新保存形式は追加しません。旧来の長いspool／transitを読む防御処理は、現在位置を移動させず、未通過の停止までの一航程へ整理します。

個艦の状態欄と観戦HUDの対象艦名は、実際の対象参照から `translate="no"` のHTML要素として描画します。名前が「移動」や「移動 · 牽引中」でも、表示用語や状態の区切りと取り違えません。既存の翻訳器と日本語ソースの復元を再利用し、艦艇・艦隊保存形式を変更しません。観戦の艦→航空隊→同じ艦という切替でも、HTML／テキスト表示のキャッシュを切り替えて元の状態欄を復元します。

## 検証記録

- 今回の全体回帰：`node --test tests/*.cjs` は637件を実行し、636件成功、1件失敗でした（659.30秒）。失敗は `fleet-loadout-separation.cjs` のテスト用 `shipRole` 公開フックが、Rtsのreturn内の新しい公開関数の順序に追従していなかったためです。本体の公開APIや役割判定を変更せず、`CAMPAIGN_FORMAT` を含むreturnを一意に検出するテスト補助へ修正しました。該当1件を再実行して成功し、さらに作例全組立の2件を除いた同ファイル8件と、陣形・独立交戦・艦隊命令の関連23件がすべて成功しました。除いた作例2件は先の全体実行で成功済みです。全体637件を修正後に一括再実行したという報告ではありません。
- 実ブラウザの基盤検証：日本語・英語、1100pxと390pxのChromiumで、キャンバスから四方向頂点を編集し、世界頂点の最大誤差は約7.1e-15mでした。Undo/Redo各1回と公開保存形式での再読込を確認しました。390pxはタッチ入力と既存の横向き回転表示を使用し、物理スマートフォンの検証とは区別します。
- 音声操作：タイトルの設定領域は日本語102×44px／英語140×44px、PC上部アイコンは44×44pxでした。クリック／タッチ後の `KSAudio` のミュート状態変化を確認しました。実際に音が聞こえるかの音響出力試験は含みません。この範囲でBUG-001を完了とします。
- 実ブラウザのセンサー表示：厳格設計の無負荷放射は全帯域0。喪失後に実目標を1e9m動かしても、保持推定座標 `[4900,0,2950]` を維持し、誤差は300mから4285mへ拡大しました。有限の誤差円と自動縮尺、推定位置での選択、不正推定の非描画、有効期限での消失を確認しました。JavaScript例外・描画エラーはありませんでした。原記録は `v13-foundations-summary.json` と対応するブラウザログです。
- 四方向頂点編集：新規6件と関連24件、合計30件成功。`veSymmetryPeers/veCommit/veFollow` を通して、実際のUndo/Redo、公開保存読込、複合パーツの登録・配置、配置オフセット、表面ID／設定・Sフォイルの起点、壊れた対称参照の循環を確認しました。修正前のソースでは、元形状と斜めの対称相手の実頂点照合が失敗することも確認しています。PLAN-013／USERPART-003全体は引き続き部分実装で、表に挙げた他の操作形態・形状受入は別です。
- 放射・センサー：`tests/sensor-lifecycle.cjs` の新規11件と関連58件を検証しました。実散逸帯域を一度だけ参照し、初回計算前や停電中に架空の熱放射を作らず、停止済み排気と実残留熱を分けます。喪失接触は有限座標と上限付き誤差、20秒の有効期限を保持し、未観測の古い高段階接触で新規射撃しません。弱い再捕捉、段階の進行、帯域と電力、観測候補の等距離時の安定ID順も検証しました。
- 推定位置の表示・操作：戦術図の描画・自動縮尺・選択・中央合わせ、攻撃／牽引命令、射撃エフェクトと超兵器のビーム／パルス／リングも、同じ接触位置の方針へ接続します。失った接触を実際の敵位置へ吸い付ける別経路を残さないようにし、専用の表示回帰6件を追加しました。
- 喪失目標への移動命令：`perceivedOrder/rememberedAttack` を `groupOrder/effectiveOrder` と戦術AIへ共有し、元の攻撃意図を保持しつつ、精密追跡を失った間は有限の保持推定へ移動するか待機します。`tests/sensor-orders.cjs` の6件は実際の `Rts.tick` を使い、同じ保持情報で実目標位置だけが異なる2世界の位置・速度・任務群目的地が一致し、新規射撃・命中・ミサイルがなく、不正推定なら待機、再捕捉で元の攻撃へ戻ることを確認しました。
- 航程：共通／RTS10件、公試・戦略任務UI6件、既存関連17件の合計33件が成功しました。主要航路の連続ジャンプ、支線停止・再指示、途中到着で勝手に最終目的地へ進まないこと、最終目的地と今回の停止の表示、ローカル／クラウド任務保存の検証・再読込を含みます。粗い初回更新でも旧航行の未通過区間を判定できるよう、時計を進める前の時刻で正規化し、過去の航程へ巻き戻しません。
- 静的監査：全84 ID。上表に実装先、既存回帰、未検証の受入境界を記載。
- 基準版の回帰：585件成功、価格カタログ12設計・モデル8が一致。前回の110隻CPU／描画測定は [表面機能の開発報告](surface-systems.md) を参照。
- 今回の翻訳：実際の `voyUnitState` と観戦HUD setter、既存DOMローカライザーを使い、移動・待機・進路・攻撃・護衛・牽引／拿捕表示、状態末尾と同じ対象名、HTMLエスケープ、日英切替とデータ不変を単体検証。実際の航程／待機UI生成、観戦の艦→航空隊→同じ艦への切替と既存のi18n・艦隊／艦隊命令・HUD・地図回帰を含めて、最終36件が成功しました。実ブラウザで見つかった「次の必須停止まで進む（今回の移動 1時間59分）」という合成ボタンの英訳漏れも修正し、実際の `msBattlePanel/msDur` で中間停止／最終目的地の2方式と5種類の時間を生成して検証しました。この追加1件の単独再実行も成功しています。これは先の全体637件の後に行った追補です。独立レビューでも名前表示の新規5件と既存i18n6件が成功しました。
- 実ブラウザの手動／RTS航行：日英とも、クワット→コルサントをオルデラン・ブレンタル・コルサントの各航程へ分け、毎回の明示指示で充填が0から始まり、到着後は次の指示を待つことを確認しました。作戦図でも支線の2辺経路は中間星系で実際に停止し、幹線の2辺経路は途中停止せず最終星系へ進みました。
- 実ブラウザの戦略任務：日英とも実際のボタンから最初のオルデラン停止へ進み、ローカル保存→ページ再読込→「続きから」で同じ停止位置・最終目的地・残航程を復元しました。英語の390px表示でも、時間を含む次航程ボタンが英語になり、次の指示でブレンタルへ進むことを確認しました。この試験は中間停止・保存復元・再指示までで、戦略任務の最終目的地に到達して戦闘を開始するブラウザ経路は未検証です。
- 実ブラウザの名前・観戦状態：個艦／任務群／作戦図／敵艦のカードで、4種類の状態文に似た艦名とHTML特殊文字を保持し、実際の牽引／移乗攻撃の状態はその外側で英訳しました。日英の往復でも同じ名前を保持しました。観戦HUDは実際の更新関数へ制御した艦／航空隊データを渡すDOM試験で、艦→Xウイング隊→同じ艦の表示・保護要素を復元しました。航空隊の飛行物理を検証した試験ではありません。
- 最終ブラウザ記録は `v13-browser-combined-summary.json`、英語の追補ログは `v13-strategic-labels-final-en.log`。各確認でJavaScript例外・描画エラーはなく、Chromiumを終了しています。実行していないPC/iOS/Androidやコントローラーの実機試験は、仮想入力・390px表示で完了扱いしません。
- 静的検査：変更したJavaScriptの構文・差分を検査しました。`node scripts/update-craft-costs.cjs --check` も成功し、価格カタログ12設計・費用モデル8が一致しました。仕様原本は元ファイルのSHA-256との一致を確認し、3〜5行のMarkdown改行用の末尾空白3箇所をそのまま保持しました。この原本以外を対象とする差分検査に問題はありません。

### 今回の判定

| ID | 今回の結果 | 継続する境界 |
| --- | --- | --- |
| BUG-001 | 完了：押せる領域・PCアイコン拡大と実クリックを確認 | 実音響出力・OS別音声は本IDの今回の検証外 |
| PLAN-013 / USERPART-003 | 四方向頂点追従と配置位置保持の不具合を修正 | ID全体は部分実装。一般形状・全操作形態の受入は一覧のとおり |
| SENS-001〜004 | 初期帯域・接触モデルの受入範囲を実装・検証。センサー／命令／艦隊の最終43件も成功 | SENS-005のモード全負荷試験と長時間実機は残る。全体回帰は上記のとおり |
| PLAN-004 | 個別命令・対象名の構造を保持する英訳を修正 | アプリ全固定文言の残存ゼロという受入は未完。観戦欄の一部英語ではシールド／乗員間の中点が二重に見える表示上の問題が残る |
| PLAN-026 / PLAN-027 | 共通航程・通常ジャンプの支線停止・表示・保存を実装 | PLAN-026は部分実装。行政的な回航・曳航・改修の `dock.until` タイマーは抽象処理のまま。複数停止を要する遠隔攻撃は明示拒否し、帰還／随伴は停止と再充填を伴う追従を使用。経路探索は従来の重み付き最短経路で、停止の準備時間を含む全体最短ETAの最適化は未実装。地図UIの完全統合はPLAN-027で継続 |

### センサーの分離負荷測定：110隻

Linux x64、Node v24.19.0、Xeon Platinum 8370C 2.80GHz、論理CPU 3の同じコンテナで、修正前後を対計測しました。2陣営110隻、共有プロファイル1種、各艦3モジュール、配置500m間隔・両軍40km離隔、各帯域のセンサー開口0.7、能動センサー有効です。共通 `emitBands` に処理熱1e24Wを与える制御条件を使い、熱シミュレーターを別に作りません。

ウォームアップ1走査後、2秒刻み24走査＝ゲーム内48秒。`unitSig` の放射生成と、候補抽出・近傍観測艦選択・帯域別SNR・接触段階更新を含む `sensorTick` を別々に測定しました。2640接触更新・34320回のSNR評価があり、最終110接触は精密捕捉段階かつ有限値でした。

| 指標 | 修正前 | 修正後 |
| --- | ---: | ---: |
| 全走査の壁時計・平均 | 49.14ms | 49.30ms |
| 全走査の壁時計・中央値 | 47.77ms | 48.79ms |
| 全走査の壁時計・P95 | 55.95ms | 53.98ms |
| 全走査の壁時計・最大 | 69.26ms | 58.05ms |
| 全走査のプロセスCPU時間・平均 | 51.78ms | 50.78ms |
| 全走査のプロセスCPU時間・最大 | 74.72ms | 60.68ms |
| 放射生成のみの壁時計・平均 | 3.27ms | 3.32ms |

測定は2026-11-02 23:57:59〜23:58:01 UTC、原記録は `v13-sensor-benchmark-stable-before.json` / `v13-sensor-benchmark-stable-after.json` です。センサーサービス領域の修正後SHA-256は `9776703c363ee8267ea133b7f10de9a2e06937e43de559e9c8ba467ff08046f8`。これは同時編集されるCore全体のハッシュとは別です。

速度改善を示す数値としては扱いません。別の試行には5.57秒の壁時計外れ値が1回あり、その原記録も保持しています。その試行にプロセスCPU記録がなく原因は未確定で、CPU記録を加えた対計測では同じ長時間停止を再現していません。放射生成のみと全走査は別の測定なので加算しません。熱・給電・戦闘物理、戦略AI・移動・衝突、GPU、長時間実行・異種設計混成・モバイル実機はこの測定に含みません。再計測は `node scripts/benchmark-sensors.cjs --ships 110 --ticks 24 --output sensor-benchmark.json` を使い、修正前ソースとの比較には `--core-file` で対象Coreを指定できます。

## 残る優先作業

1. 今回の修正後も未検収の共通編集、任務群の混成艦・損傷・各旋回方式、テンプレート入出力を、代表ケースの動作検証へ進める。
2. 統合熱の輸送容量不足・冗長経路・安全停止・重大過熱の損傷先を専用受入で固定し、主翼展開と同じ実放射量の関係を検証する。
3. 共通航路の上で銀河／作戦地図の操作を統合し、戦略AI・衝突・熱・センサーを同時に動かす100隻超の比較負荷測定を行う。実機GPU・長時間メモリは別途検証する。
4. 地上戦、ウォーカー／車両、固定ステーション、独自兵装・エンジンの制作と再利用を、既存共通設計へ接続する。
5. キャンペーンは現在データ／メニューの殻。開始・続行とイベント駆動の進行から接続し、計画ごとの予算査定・改定・建造承認、その後に24BBYの各シナリオを実装する。既存MS任務やサンドボックスの教程を、序章完成と数えない。
6. PvPの同期方式、ALG-MOGPADSCNとPC/iOS/Androidの実機入力は未決定／未調査の部分を残す。実測可能な環境で記録する。
