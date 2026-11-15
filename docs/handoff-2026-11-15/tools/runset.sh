#!/bin/sh
# usage: runset.sh <root> <outdir> <files...>
R=$1; D=$2; shift 2; mkdir -p $D; cd $R
printf '%s\n' "$@" > $D/files.txt
cat $D/files.txt | xargs -P 4 -I{} sh -c "timeout 1500 node --test tests/{} > $D/{}.tap 2>&1; echo \$? > $D/{}.exit"
for f in $(cat $D/files.txt); do echo "$f exit=$(cat $D/$f.exit) pass=$(grep -c '^ok ' $D/$f.tap) fail=$(grep -c '^not ok ' $D/$f.tap)"; done > $D/summary.txt
