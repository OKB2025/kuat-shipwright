#!/bin/bash
# one setting: FIGHTR, collide(0/1)
r=$1; c=$2; h=$(( r<200 ? 100 : 200 )); env START=1000 FIGHTR=$r HOLD=$h LAGMAX=$(( r<200 ? 150 : 300 )) $( [ $c = 0 ] && echo NOCOLLIDE=1 ) node /home/user/kuat-shipwright/docs/benchmarks/gun-model-2026-11-24/laser-sim.cjs /home/user/kuat-shipwright craft_tie_in craft_xwing 10 1 1 120 > /tmp/ks-verify/20261124-range-sweep/r$r-c$c.txt 2>&1
