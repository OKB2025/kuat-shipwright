# 4v4 dogfights with the proximity fuse firing before contact

**24 November 2026, Japan time.** The X-wings won 25 of 40 against TIE/ln and 30 of 40 against TIE/in. TIE/D won all 40 against the X-wings. Each matchup used the same 20 seeds twice, swapping starting sides. The previous column below comes from the published shield trial. Its game revision was not rerun. [Previous 120 scores](https://github.com/OKB2025/kuat-shipwright/blob/24035eca0d0d3e570f21230d71e1a3d0d5e05d74/docs/experiments/dogfight-20261124/shields-4v4/trials.csv)

Tested game revision `88c74709b47083b8463db7f2a53644651b045717` on the results branch `test/missile-4v4-20261124`. The functional fuse change is `5de5468a`. The results commit contains only experiment files. From the branch, `git log -1 --format=%H -- docs/experiments/dogfight-20261124/missile-rules-4v4/README.md` identifies the published report commit. [Game source](https://github.com/OKB2025/kuat-shipwright/blob/88c74709b47083b8463db7f2a53644651b045717/js/core.js#L119460)

## Battle results

| Opponent | Previous X / TIE / draw | Revised X / TIE / draw | X-wing losses, previous → revised | TIE losses, previous → revised | Median end time, s | Revised range, s |
| --- | --- | --- | --- | --- | --- | --- |
| TIE/ln | 17 / 21 / 2 | 25 / 14 / 1 | 124 → 84 | 137 → 123 | 52 → 52.125 | 32.5–300 |
| TIE/in | 20 / 20 / 0 | 30 / 10 / 0 | 113 → 101 | 123 → 147 | 35 → 44.125 | 32.25–63.75 |
| TIE/D | 0 / 40 / 0 | 0 / 40 / 0 | 160 → 160 | 48 → 55 | 53.375 → 56.25 | 38.5–108.75 |

Losses are totals out of 160 fighters per side per matchup. 119 battles ended with one side eliminated, 0 ended in mutual destruction and 1 reached 300 seconds. A timeout awards the win to the side with more kills. Equal losses give a draw. [Seed-by-seed scores](trials.csv)

The TIE/ln battle on seed 31 (tie-first) drew at the limit with 3 X-wings and 3 TIEs lost.

## Missile launches and impacts

The game recorded **1,168 launches** and **453 impacts**. Of those impacts, 450 were on the intended opponent, 0 struck the firing craft, 3 struck a wingmate and 0 struck another enemy. A missile impact can leave its target flying. These records do not attribute fighter losses to an individual weapon. [Launches](launches.csv) · [Impact identities](impacts.csv)

| Opponent | Launches, previous → revised | Runner hits, previous → revised | Revised intended hits / launches | Proximity / direct | Revised launch distance, median (range), m | Launches beyond 1,500 m | Held checks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TIE/ln | 409 → 474 | 145 → 114 | 115 (24.3%) | 115 / 0 | 1422 (131–2955) | 230 | 29 |
| TIE/in | 328 → 290 | 130 → 125 | 125 (43.1%) | 125 / 0 | 1120 (377–2708) | 56 | 0 |
| TIE/D | 720 → 404 | 186 → 208 | 210 (52.0%) | 213 / 0 | 947 (109–2888) | 127 | 134 |

The prior runner’s hit counter is retained for comparison. This revision’s post-step runner counted 447 hits, while the damage step recorded 453. The latter supplies impact identities and hit rates. Each held check is one ready shooter withholding fire for one 0.25 s step. [Runner records](trials.csv) · [Revised launch checks](https://github.com/OKB2025/kuat-shipwright/blob/88c74709b47083b8463db7f2a53644651b045717/scripts/sim-dogfight.cjs#L14)

| Opponent | Firing side | Fired | Hit intended opponent | Hit launcher | Hit wingmate |
| --- | --- | --- | --- | --- | --- |
| TIE/ln | X-wing | 134 | 32 | 0 | 0 |
| TIE/ln | TIE/ln | 340 | 83 | 0 | 0 |
| TIE/in | X-wing | 92 | 28 | 0 | 0 |
| TIE/in | TIE/in | 198 | 97 | 0 | 0 |
| TIE/D | X-wing | 91 | 46 | 0 | 0 |
| TIE/D | TIE/D | 313 | 164 | 0 | 3 |

## What the shields did

The proximity fuse triggered on 453 of 453 recorded impacts. The shield calculation processed 453 bursts. The absorbed share is the sum of energy absorbed divided by energy delivered to that receiving side. The zero column also includes bursts on unshielded fighters. [Per-burst absorption](proximity.csv) · [Shield resolution](https://github.com/OKB2025/kuat-shipwright/blob/88c74709b47083b8463db7f2a53644651b045717/js/core.js#L118411)

| Opponent | Receiving fighter | Bursts | Fully absorbed | Partly absorbed | Zero absorbed | Share of burst energy absorbed |
| --- | --- | --- | --- | --- | --- | --- |
| TIE/ln | X-wing | 83 | 0 | 81 | 2 | 68.3% |
| TIE/ln | TIE/ln | 32 | 0 | 0 | 32 | 0.0% |
| TIE/in | X-wing | 97 | 0 | 87 | 10 | 68.4% |
| TIE/in | TIE/in | 28 | 0 | 0 | 28 | 0.0% |
| TIE/D | X-wing | 164 | 0 | 143 | 21 | 56.0% |
| TIE/D | TIE/D | 49 | 0 | 47 | 2 | 74.9% |

The test flag set used a 2.5 s lock, an 8 s reload, a 3,000 m missile range, a 0.3 rad/s turn limit, the existing guidance mode at N′ = 3 and the friendly-fire check. The launcher is excluded from collision candidates throughout flight. On these four designs the fuse radius exceeds the body radius, so a fused concussion missile detonates before it touches the model. The game applies the same fuse rule to a shot aimed directly at the centre. [Trial settings](https://github.com/OKB2025/kuat-shipwright/blob/88c74709b47083b8463db7f2a53644651b045717/js/core.js#L119329) · [Fuse and body radii](https://github.com/OKB2025/kuat-shipwright/blob/88c74709b47083b8463db7f2a53644651b045717/js/core.js#L119406) · [Game test](https://github.com/OKB2025/kuat-shipwright/blob/88c74709b47083b8463db7f2a53644651b045717/tests/craft-proximity-shield.cjs)

| Fighter | Missiles per fighter | Starting shield, game kt | Body radius, m | Fuse radius, m |
| --- | --- | --- | --- | --- |
| X-wing | 12 | 139.64 | 6.28 | 10.00 |
| TIE/ln | 6 | 0.00 | 3.64 | 10.00 |
| TIE/in | 6 | 0.00 | 4.45 | 10.00 |
| TIE/D | 12 | 160.11 | 5.15 | 10.00 |

## Results as the missile rules changed

| Game revision | Missile rule | X wins vs ln /40 | X wins vs in /40 | X wins vs D /40 | Launcher hits | Wingmate hits | Proximity bursts |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `bdc5d8c` | Launcher still eligible after release | 34 | 25 | 9 | 282 | 0 | — |
| `21a5c2f` | Launcher excluded, proximity determined by miss distance | 29 | 23 | 1 | 0 | 0 | 135 |
| `88c7470` | Fuse fires before contact on small fighters | 25 | 30 | 0 | 0 | 3 | 453 |

The same seed and initial side were used at each revision. In the final run, one Defender (unit `a2`) caused all three wingmate hits in the TIE-first seed 34 battle. It hit unit `a3` at 68.75 and 76.75 s and unit `a` at 84.75 s. The 282 self-hits in the first set were confirmed by comparing the actual recipient ID with the launcher ID. Bundled rule changes prevent attributing a specific win to any one shield interception. [Intermediate trial records](development-trials.csv)

Against TIE/D, Defender shields absorbed 74.9% of incoming missile burst energy. X-wing shields absorbed 56.0% in the same matchup. The Defenders scored 164 intended missile hits against 46 by the X-wings. Individual kill credit and the contribution of gunfire were not isolated. [Impact identities](impacts.csv) · [Absorbed energy](proximity.csv)

## English replay

| Opponent | Chapter start, video s | Battle time, s | X / TIE lost | Missiles fired | Impacts | Proximity bursts |
| --- | --- | --- | --- | --- | --- | --- |
| TIE/ln | 0.00 | 56 | 2 / 4 | 11 | 3 | 3 |
| TIE/in | 19.67 | 39.5 | 2 / 4 | 7 | 4 | 4 |
| TIE/D | 35.20 | 56 | 4 / 3 | 8 | 7 | 7 |

All three chapters use seed 24 with the X-wings starting on side A. A gold marker and trail show each active missile. The inset identifies the selected missile, its target and their separation. The tactical view, side view and 3D chase camera use the same recorded coordinates. Both teams use meshes from the game’s example designs. The replay interpolates the 0.25 s samples. Playback slows to real time around the first launch and otherwise runs at 4×. [Raw replay tracks](replays)

The attached English MP4 is 1280 × 720 at 30 fps. Its 1646 frames decoded successfully. Duration is 54.87 s. SHA-256 is `318a4b4354b04c74923549e557dcafefea67712877e4f5365944d963374447ce`.

## Verification

Missile rules, proximity shields and shield generator scaling had **15 passes and 0 failures** across 15 tests. [Missile rules, proximity shields and shield generator scaling log](targeted.tap)

Seven aircraft and fleet regression files had **42 passes and 3 failures** across 45 tests. [Seven aircraft and fleet regression files log](regression.tap)

| Failed test | Observed assertion |
| --- | --- |
| `fighter-air-superiority.cjs` | The fighter's speed during a strafing pass fell to half its listed speed or lower. |
| `fleet-air-restraint.cjs` | At the first expected launch tick, the test could not find a craft outside the hangar. |
| `fleet-air-restraint.cjs` | The Imperial example did not satisfy the test's assumption that all its hangar mouths were open bays. |

The broad regression run uses each existing test’s own settings. Its failures cover the attack-pass speed check and the Imperial hangar launch checks. Their relationship to missile changes has not been established. Several early parallel processes in the intermediate 21a5c2f run were killed under memory pressure and repeated in separate output directories. The final 120 battles used three opponent batches. The focused test files ran sequentially and the broad regression log uses four workers. On the earliest intermediate revision, a missing helper in the sparse checkout interrupted one shield test. Adding the tracked helper and rerunning all ten checks on that revision produced ten passes. Only completed trials enter the results.

Each matchup had two orientations, 20 seeds (21–40), four fighters per side, an 8 km head-on start above the planet and a 300 s limit. Each craft carried its station capacity of concussion missiles. The matching turn-mass, thrust-vector, missile evasion and lock switches were enabled. The normal generator-based shield scale was used. The 120 instrumented repeats matched the 120 plain runs, including every release, end time, loss and native counter. The repeating pass counts as a verification of the same battles.

## Reproduction

The source is pinned at `88c74709b47083b8463db7f2a53644651b045717`. Check out the results branch to obtain the three scripts in this directory. They use Python 3 and the repository’s Node simulator. Each seed gets a separate result directory. The simulator’s 8 km head-on start and its 0.25 s step are unchanged.

```sh
game=$(pwd)
report=docs/experiments/dogfight-20261124/missile-rules-4v4
out=$(mktemp -d /tmp/ks-missiles-4v4-XXXXXX)
sh "$report/run-matrix.sh" "$game" "$out/plain" plain
sh "$report/run-matrix.sh" "$game" "$out/observer" observer
python3 "$report/collect.py" "$out/plain" "$out/observer" "$out/checked"
```

The plain pass applies the same station-limited concussion loadout as the archived trials and saves the seed, score, launch distances and replay tracks. The observer pass reads the game source into memory and records each missile’s actual recipient and the energy that passes the field. The collector checks each score, ending time, launch and native counter against the plain pass before exporting any tables. The result commit contains the measurement scripts, records and report. All game code and test assertions come from the pinned revision.

```sh
node --test --test-reporter=tap --test-concurrency=1 tests/craft-missile-trial-rules.cjs tests/craft-proximity-shield.cjs tests/craft-shield-generator-scale.cjs
node --test --test-reporter=tap --test-concurrency=4 tests/fighter-air-superiority.cjs tests/fleet-air-restraint.cjs tests/fleet-air-strike-flown.cjs tests/fighter-dogfight-arcs.cjs tests/fleet-air-copy-orders.cjs tests/air-control-stated.cjs tests/point-defense-toggle-aircraft.cjs
```

To rebuild the English video, fetch the two historical experiment branches for their renderer and mesh exporter. Each chapter can be regenerated from its archived trace using NumPy, Pillow, the Noto Sans CJK fonts, a C compiler and FFmpeg.

```sh
git fetch origin test/shield-4v4-20261124 test/dogfight-ranges-20261123-b
renderer=24035eca0d0d3e570f21230d71e1a3d0d5e05d74
geometry=f977580ade4ab51cc32a0181f1a5a16a2572756e
helpers=docs/experiments/dogfight-20261124/x-wing-12v12
git show "$renderer:docs/experiments/dogfight-20261124/shields-4v4/replay.py" > "$out/replay.py"
(cd "$out" && patch -p1 < "$game/$report/replay.patch")
git show "$geometry:$helpers/models.cjs" > "$out/models.cjs"
git show "$geometry:$helpers/raster.c" > "$out/raster.c"
cc -O3 -shared -fPIC "$out/raster.c" -lm -o "$out/raster.so"
gzip -dc "$report/replays/tie_ln.json.gz" > "$out/model-input.json"
KS_TEST_ROOT="$game" node "$out/models.cjs" "$out/model-input.json" "$out/models"
for tie in tie_ln tie_in tie_d; do
  OPENBLAS_NUM_THREADS=1 python3 "$out/replay.py" "$report/replays/$tie.json.gz" "$out" "$out/$tie.mp4" --language en
done
cp "$report/video.ffconcat" "$out/video.ffconcat"
(cd "$out" && ffmpeg -f concat -safe 0 -i video.ffconcat -f ffmetadata -i "$game/$report/chapters.ffmeta" -map 0:v:0 -map_metadata 1 -map_chapters 1 -c:v copy -metadata:s:v:0 language=eng -movflags +faststart replay.mp4)
```
