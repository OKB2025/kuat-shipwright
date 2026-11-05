# 球状砲塔・点防御・CIS速射砲

ユーザー提供のモン・カラマリ艦の配置図と砲塔参考写真を基にした武装更新。MC80の種類別基数と配置座標は [配置資料](moncal-reference-armament.md) に記載する。

| キー | 武装 | 球径または全長（m） | 一斉射（TT相当） | 周期（秒） |
| --- | --- | ---: | ---: | ---: |
| `monCalPD` | 球状PD 3連装 | 球径3.6 | 0.06 | 0.2 |
| `monCal34` | 34TT単装 | 球径6 | 34 | 1 |
| `monCal80` | 80TT単装 | 球径8 | 80 | 1 |
| `monCal200` | 200TT単装 | 球径10 | 200 | 1 |
| `monCal200Triple` | 200TT三連装 | 球径16 | 600 | 1 |
| `monCal150Ion` | 150TT単装イオン | 球径11 | 150（イオンのみ） | 1 |
| `pd` | 左右レーザー型2連装PD | 全長9 | 0.04 | 0.2 |
| `quad1Rapid` | CIS 1TT四連装ラピッドファイア | 全長35 | 4 | 0.2 |

球径は画像の灰色の砲塔図形からの推定値。ペンの囲みの大きさや出力の立方根で一律に拡大しない。球体の下側約1/3が取付面へ入り、球体・砲基部・砲身は一緒に旋回・俯仰する。左右角・上下角、照準、砲口、選択範囲、射線は既存の共通変換を使う。

通常PDは5枚目上段中央と6枚目の参考に合わせ、中央の機器ケース、左右の軸受、側面レーザー砲を持つ。展示用の長い円筒台は除外する。CIS砲は7枚目の左右の大きな円形砲基部と上下2門ずつの砲身を再現し、既存500GT四連装の全長28.5mを上回る35mとする。固定部と可動部を分け、実際の砲身から発射する。新モデルはすべて5,000三角形以内。

PDの1門20GTは既存PDの設定を引き継ぐ。発射周期、対空値、質量、乗員、費用はゲーム用仮定であり、図の明記値とは区別する。イオン相当値は通常損傷へ加算しない。砲室の閉じたセルから内部充電容積を算出し、不足する充電装置は船内に配置する。

旧「側面砲列区画」と小型艦用 `ionL` はカタログから廃止する。旧設計の砲列は原則34TT単装球、70TT設定は80TT単装球、旧イオン型と `ionL` は150TT単装イオン球へ移行する。配置ID・座標・取付法線・対称リンク・給電設定を保持し、黒い砲門や旧モデルを復活させない。艦載機用 `cion` は継続する。MC30cの28基も実寸で配置し直す。MC30cの船内機器付近とホーム・ワンの薄いローブ先端では充電装置の固定深度を調整し、砲塔の必要容量を減らさずに全量を船内へ確保する。艦隊プロファイル版は13に更新し、旧集計を再利用しない。

表面台帳に保持された新系列の武装も外面に球状／実砲塔モデルを表示し、旧砲列の浅い窓へ戻さない。既存の廃止済み表面自動装備の読み込み方針は従来どおり。

- [球状砲塔の実描画比較](images/moncal-ball-family.png)
- [PD・CIS砲と既存500GT砲の実描画比較](images/moncal-pd-cis-comparison.png)
- [球状・PDモデルの生成記録](../assets/source/moncal-turret-manifest.json)
- [CISモデルの生成記録](../assets/source/cis-rapid-turret-manifest.json)

```sh
python3 scripts/build-moncal-turrets.py --check
python3 scripts/build-cis-rapid-turret.py --check
node --test tests/moncal-*.cjs tests/broadside-battery-*.cjs \
  tests/weapon-catalog-migration.cjs tests/weapon-output-sizing.cjs \
  tests/dual-purpose-weapons.cjs tests/turret-shared-paint.cjs
node scripts/browser-moncal-weapons.cjs
```
