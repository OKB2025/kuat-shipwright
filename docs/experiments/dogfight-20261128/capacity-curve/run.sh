#!/bin/sh
# From the root of the results branch: sh path/to/run.sh /absolute/new-directory
set -eu
game=$(pwd)
out=$1
case "$out" in /*) ;; *) exit 2;; esac
mkdir "$out"
here=$(cd "$(dirname "$0")" && pwd)
prior="$game/docs/experiments/dogfight-20261128"
mkdir -p "$out/tools" "$out/game/js"
ln -s "$game/data" "$out/game/data"
ln -s "$game/scripts" "$out/game/scripts"
cp "$prior/tools/prepare.py" "$out/tools/"
python3 "$prior/x-shield/observe.py" "$game" "$out"
python3 - "$out/game/js/core.js" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1]);s=p.read_text();marker='combatAdd(inc,u,c.point,{direct:tt,shot:tt},null,other.id);'
assert s.count(marker)==1
s=s.replace(marker,'inc._crash=(inc._crash||0)+tt;'+marker).replace("direct?'direct':beam?", "direct?(o._crash===o.direct?'collision':'direct'):beam?")
p.write_text(s)
PY
python3 "$out/tools/prepare.py" "$game/scripts/sim-dogfight.cjs" "$out/observer.cjs"
python3 "$here/start.py" "$out/game" "$out/observer.cjs" "$out"
python3 "$here/collect.py" "$out"
