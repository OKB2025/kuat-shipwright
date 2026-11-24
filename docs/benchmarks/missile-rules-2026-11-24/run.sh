#!/bin/sh
# $1 config (old|new) $2 a $3 b $4 tag
cd /home/user/kuat-shipwright
BASE="KS_TURN_MASS=1 KS_TURN_VECTOR=1 KS_DOGFIGHT_STORES=1 KS_GUIDANCE=pn KS_MISSILE_EVADE=1 KS_MISSILE_LOCK=1 KS_ROUND_PROFILE=1"
if [ "$1" = old ]; then X="KS_LOCK_S=1 KS_MSL_RELOAD=4 KS_MSL_TURN=0.6 KS_MSL_RANGE=1500"; else X="KS_MSL_FF=1"; fi
env $BASE $X timeout 7000 node scripts/sim-dogfight.cjs $2 $3 20 4 4 > ${OUT:?set OUT}/$1-$4.log 2>&1
echo "$1 $4 $?"
