#!/bin/bash
# runlist.sh <root> <outdir> <jobs> <timeout-s> <listfile of tests/x.cjs> : appends to <outdir>/summary.tsv
root=$1; out=$2; jobs=$3; to=$4; list=$5; mkdir -p "$out/logs"; cd "$root" || exit 1
cat "$list" | xargs -P "$jobs" -I{} bash -c '
f={}; n=$(basename $f .cjs); t0=$(date +%s)
timeout '"$to"' node --test --test-reporter=tap "$f" > "'"$out"'/logs/$n.log" 2>&1; rc=$?
p=$(grep -E "^# pass " "'"$out"'/logs/$n.log" | tail -1 | cut -d" " -f3); fl=$(grep -E "^# fail " "'"$out"'/logs/$n.log" | tail -1 | cut -d" " -f3)
printf "%s\t%s\t%s\t%s\t%s\n" "$n" "$rc" "${p:-?}" "${fl:-?}" "$(( $(date +%s)-t0 ))" >> "'"$out"'/summary.tsv"'
