#!/bin/sh
# Usage: sh reproduce.sh /absolute/new-output-directory
set -eu
game=$(pwd)
out=$1
case "$out" in /*) ;; *) exit 2;; esac
mkdir "$out"
here=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$out/tools" "$out/game/js" "$out/batches"
ln -s "$game/data" "$out/game/data"
ln -s "$game/scripts" "$out/game/scripts"
cp "$game/docs/experiments/dogfight-20261128/tools/prepare.py" "$out/tools/"
python3 "$here/observe.py" "$game" "$out"
python3 "$out/tools/prepare.py" "$game/scripts/sim-dogfight.cjs" "$out/tie_in-runner.cjs"
KS_OBSERVER="$out" KS_BATCHES="$out/batches" python3 "$here/sweep.py" "${2:-7.5}"
