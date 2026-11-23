# X-wings versus TIE fighters in 4v4 combat with the revised shield system

**The TIE Defender won all 40 battles against the X-wing.** The TIE interceptor split its series 20–20. The standard TIE fighter won 21, lost 17, and fought to mutual destruction twice.

The simulator used game revision `c1767627867718edd3237cdbf161f85c06e93f47`. This English edition presents the 120 battles recorded on November 24, 2026 (Japan time), on branch `test/shield-4v4-20261124`. [Results for every battle](trials.csv)

## Results

| X-wing opponent | X-wing wins | TIE wins | Mutual destruction | X-wings lost | TIEs lost | Median battle time | Range |
|---|---:|---:|---:|---:|---:|---:|---:|
| TIE/ln fighter | 17 | 21 | 2 | 124 | 137 | 52.00 s | 40.75–235.75 s |
| TIE/in interceptor | 20 | 20 | 0 | 113 | 123 | 35.00 s | 27.25–46.75 s |
| TIE/D Defender | 0 | 40 | 0 | 160 | 48 | 53.375 s | 36.25–85.50 s |

Losses are totals out of 160 fighters per side in each series. In both TIE/ln draws, all eight fighters were destroyed. All 120 battles ended before the 300-second limit. At that limit the scoring rule awards the win to the side with more kills and records a draw if kills are equal.

Four X-wings met four TIEs head-on with 8 km between the lead fighters. Each pairing used seeds 21–40 twice, swapping starting sides for the second run. Starting on side A, the X-wings won 8, 9 and 0 battles against the fighter, interceptor and Defender, respectively. Starting on side B, they won 9, 11 and 0.

## Shields and loadouts

| Fighter | Combined shield-generator volume | Starting shield capacity (in-game TNT equivalent) | Concussion missiles per fighter |
|---|---:|---:|---:|
| X-wing | 0.3330 m³ | 139.64 kt | 12 |
| TIE/ln fighter | 0 | 0 | 6 |
| TIE/in interceptor | 0 | 0 | 6 |
| TIE/D Defender | 0.3568 m³ | 160.11 kt | 12 |

The revised system bases the fighter shield multiplier on total generator volume. Commit `b2358936` introduced the calculation and `5fe95301` limited it to craft. Starting capacities come from the same flight-ready units that the simulator creates. The trials used the default shield multiplier. [Measured fighter profiles](profiles.json)

On the earlier build, `5cdf219`, the X-wing had 139.05 kt of shield capacity and the Defender had 49.36 kt. On the revised build, the Defender has **14.7% more capacity than the X-wing**. Across the same 40 seeded 4v4 starts, the Defender went from 39 wins to 40 and its losses fell from 73 to 48. Laser-gas consumption and launcher placement also changed between builds, so the comparison cannot isolate how much of the reduction came from shields alone. The earlier figures come from the published trials. [Earlier shield measurements](https://github.com/OKB2025/kuat-shipwright/blob/f977580ade4ab51cc32a0181f1a5a16a2572756e/docs/experiments/dogfight-20261124/defender-matchups/profiles.txt) · [Earlier results](https://github.com/OKB2025/kuat-shipwright/blob/f977580ade4ab51cc32a0181f1a5a16a2572756e/docs/experiments/dogfight-20261124/defender-matchups/summary.csv)

## Missile outcomes

| Opponent | Launched | Recorded hits | Expired | Target lost first | Unresolved at battle end |
|---|---:|---:|---:|---:|---:|
| TIE/ln | 409 | 145 | 193 | 54 | 17 |
| TIE/in | 328 | 130 | 125 | 60 | 13 |
| TIE/D | 720 | 186 | 375 | 132 | 27 |

Counts include both sides across 40 battles per pairing. The simulator reports hits, expiry and prior loss of the target. The final column counts launches for which it had recorded none of those three outcomes by battle end. Each fighter carried as many concussion missiles as its stations allowed. The trials used the existing missile guidance setting `pn` with its default constant of 3, together with locking, missile evasion and ammunition-specific range. Planetary gravity, mass-dependent turning and thrust vectoring were enabled. The simulator advanced in 0.25-second steps.

## Video

All three chapters show seed 24 with the X-wings starting on side A. The overhead view, altitude view and chase camera share one flight record. Both teams use the design meshes produced by the tested game's `Gfx.fleetGeometry`. Yellow markers and trails show recorded missile positions. Fighter position and attitude are interpolated between samples. Playback slows from 4× to real time around the first missile launch in each battle. [Flight and missile records](replays) · [Replay renderer](replay.py)

| Chapter starts | Opponent | Simulated battle time | X-wing survivors | TIE survivors | Missiles launched |
|---:|---|---:|---:|---:|---:|
| 0:00.00 | TIE/ln | 48.75 s | 2 | 0 | 9 |
| 0:17.90 | TIE/in | 36.25 s | 1 | 0 | 11 |
| 0:32.60 | TIE/D | 57.00 s | 0 | 2 | 20 |

The English replay is `KUAT_4v4_Shield_Replay_EN.mp4`, a 52.53-second H.264 video at 1280 × 720 and 30 frames per second. The X-wings won the TIE/ln battle shown on screen with two survivors. Across all 40 trials, the TIE/ln won four more battles than the X-wing. All 1,576 frames of the English video passed a full decode. Its SHA-256 is `00fad30032895c9f4b2b526847583785310040a01c3b943f513dd184354110d1`.

## Reproducing the results

Run these commands from the root of the test branch. The previous measurement script wraps the existing dogfight simulator to select seeds, standardize missile loads, and record individual outcomes and missile positions. It loads the revised game's Core from the current checkout. If necessary, fetch the helper commit with `git fetch origin test/dogfight-ranges-20261123-b`.

```sh
src=$(pwd)
out=$(mktemp -d /tmp/ks-shield4-XXXXXX)
old=f977580ade4ab51cc32a0181f1a5a16a2572756e
helpers=docs/experiments/dogfight-20261124/x-wing-12v12
report=docs/experiments/dogfight-20261124/shields-4v4
git show "$old:$helpers/matrix.cjs" > "$out/matrix.cjs"
export KS_TEST_ROOT="$src" KS_PLANET=1 KS_TURN_MASS=1 KS_TURN_VECTOR=1
export KS_DOGFIGHT_STORES=1 KS_MISSILE_LOCK=1 KS_ROUND_PROFILE=1 KS_MISSILE_EVADE=1
export KS_GUIDANCE=pn KS_PN_N=3
unset KS_CRAFT_SHIELD KS_LOCK_REACT KS_MSL_RANGE KS_TORP_RANGE
for tie in tie_ln tie_in tie_d; do
  for side in x-first tie-first; do
    dir="$out/$tie/$side"
    mkdir -p "$dir"
    if [ "$side" = x-first ]; then
      a=craft_xwing
      b=craft_$tie
      export KS_TRACE="$dir/trace.json"
    else
      a=craft_$tie
      b=craft_xwing
      unset KS_TRACE
    fi
    ROWS="$dir/rows.jsonl" node "$out/matrix.cjs" "$a" "$b" 20 4 4 > "$dir/stdout.log"
  done
done
node --test tests/craft-shield-generator-scale.cjs
```

The replay renderer uses Python 3, NumPy, Pillow, Noto Sans CJK, a C compiler and FFmpeg.

```sh
git show "$old:$helpers/models.cjs" > "$out/models.cjs"
git show "$old:$helpers/raster.c" > "$out/raster.c"
cc -O3 -shared -fPIC "$out/raster.c" -lm -o "$out/raster.so"
node "$out/models.cjs" "$out/tie_d/x-first/trace.json" "$out/models"
for tie in tie_ln tie_in tie_d; do
  OPENBLAS_NUM_THREADS=1 python3 "$report/replay.py" "$report/replays/$tie.json.gz" "$out" "$out/$tie.mp4" --language en
done
```

All six simulation batches exited successfully. All four shield-generator regression tests passed. The end time and losses in each replay matched the corresponding trial row. [Shield test output](shield-tests.tap)
