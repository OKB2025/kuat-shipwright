#!/bin/sh
# Usage: sh run.sh GAME_ROOT NEW_OUTPUT_DIRECTORY [tie_ln|tie_in|tie_d]
set -eu
game=$(cd "$1" && pwd)
out=$2
here=$(cd "$(dirname "$0")" && pwd)
case "$out" in /*) ;; *) echo "Use an absolute output path" >&2; exit 2;; esac
mkdir -p "$out"
export KS_TEST_ROOT="$game" KS_PLANET=1 KS_TURN_MASS=1 KS_TURN_VECTOR=1 KS_DOGFIGHT_STORES=1
export KS_MISSION=air KS_MISSILE_LOCK=1 KS_ROUND_PROFILE=1 KS_MISSILE_EVADE=1 KS_GUIDANCE=pn KS_PN_N=3 KS_MSL_FF=1
unset KS_CRAFT_SHIELD KS_LOCK_REACT KS_MSL_RANGE KS_MSL_TURN KS_MSL_RELOAD KS_LOCK_S KS_TORP_RANGE KS_FF_DEBUG KS_TRACE
for opponent in ${3:-tie_ln tie_in tie_d}; do
  case "$opponent" in tie_ln|tie_in|tie_d) ;; *) exit 2;; esac
  runner="$out/$opponent-runner.cjs"
  if [ -e "$runner" ]; then echo "This opponent already has an output directory" >&2; exit 2; fi
  python3 "$here/prepare.py" "$game/scripts/sim-dogfight.cjs" "$runner"
  for mode in runs; do
    for side in x-first tie-first; do
      dir="$out/$mode/$opponent/$side"
      mkdir -p "$dir/seed-24"
      unset KS_TRACE
      if [ "$side" = x-first ]; then a=craft_xwing; b=craft_$opponent; else a=craft_$opponent; b=craft_xwing; fi
      if [ "$mode" = runs ]; then
        export KS_OBSERVE_CONTACTS=0
        if [ "$side" = x-first ]; then export KS_TRACE="$dir/seed-24/trace.json"; fi
      else
        export KS_OBSERVE_CONTACTS=1
      fi
      (cd "$dir" && node "$runner" "$a" "$b" 20 4 4 > simulator.log 2>&1)
      touch "$dir/complete"
    done
  done
done

