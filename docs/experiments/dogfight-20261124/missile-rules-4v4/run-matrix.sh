#!/bin/sh
# Run one complete set to a fresh absolute output directory.
# Usage: sh run-matrix.sh GAME_ROOT OUTPUT {plain|observer}
set -eu
game=$(cd "$1" && pwd)
out=$2
mode=$3
case "$out" in /*) ;; *) echo 'output must be an absolute path' >&2; exit 2;; esac
case "$mode" in plain) observe=0;; observer) observe=1;; *) exit 2;; esac
if [ -e "$out" ]; then echo "output already exists: $out" >&2; exit 2; fi
mkdir -p "$out"
here=$(cd "$(dirname "$0")" && pwd)
python3 "$here/prepare.py" "$game/scripts/sim-dogfight.cjs" "$out/runner.cjs"
export KS_TEST_ROOT="$game" KS_PLANET=1 KS_TURN_MASS=1 KS_TURN_VECTOR=1
export KS_DOGFIGHT_STORES=1 KS_MISSILE_LOCK=1 KS_ROUND_PROFILE=1 KS_MISSILE_EVADE=1
export KS_GUIDANCE=pn KS_PN_N=3 KS_MSL_FF=1 KS_OBSERVE_CONTACTS="$observe"
unset KS_CRAFT_SHIELD KS_LOCK_REACT KS_MSL_RANGE KS_MSL_TURN KS_MSL_RELOAD KS_LOCK_S KS_TORP_RANGE KS_FF_DEBUG KS_TRACE
for opponent in tie_ln tie_in tie_d; do
  for side in x-first tie-first; do
    dir="$out/$opponent/$side"
    mkdir -p "$dir/seed-24"
    if [ "$side" = x-first ]; then
      a=craft_xwing
      b=craft_$opponent
      if [ "$mode" = plain ]; then export KS_TRACE="$dir/seed-24/trace.json"; fi
    else
      a=craft_$opponent
      b=craft_xwing
      unset KS_TRACE
    fi
    (cd "$dir" && node "$out/runner.cjs" "$a" "$b" 20 4 4 > simulator.log 2>&1)
  done
done
