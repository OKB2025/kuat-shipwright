#!/bin/sh
# Rebuild the three-chapter Japanese film from the archived seed-24 flight tracks.
# Usage: sh render.sh GAME_ROOT NEW_ABSOLUTE_OUTPUT_DIRECTORY
set -eu
game=$(cd "$1" && pwd)
out=$2
here=$(cd "$(dirname "$0")" && pwd)
case "$out" in /*) ;; *) echo "Use an absolute output path" >&2; exit 2;; esac
mkdir "$out"
cp "$here/renderer/replay.py" "$here/renderer/models.cjs" "$here/renderer/raster.c" "$out"
cc -O3 -shared -fPIC "$out/raster.c" -lm -o "$out/raster.so"
gzip -dc "$here/replays/tie_ln.json.gz" > "$out/model-input.json"
KS_TEST_ROOT="$game" node "$out/models.cjs" "$out/model-input.json" "$out/models"
for k in tie_ln tie_in tie_d; do
  OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python3 "$out/replay.py" "$here/replays/$k.json.gz" "$out" "$out/$k.mp4" --language ja
done
cp "$here/video.ffconcat" "$here/chapters.ffmeta" "$out"
(cd "$out" && ffmpeg -v error -f concat -safe 0 -i video.ffconcat -f ffmetadata -i chapters.ffmeta -map 0:v:0 -map_metadata 1 -map_chapters 1 -c:v copy -metadata:s:v:0 language=jpn -movflags +faststart KUAT_4v4_Mission_Load_JA.mp4)
ffmpeg -v error -xerror -i "$out/KUAT_4v4_Mission_Load_JA.mp4" -map 0:v:0 -f null -
