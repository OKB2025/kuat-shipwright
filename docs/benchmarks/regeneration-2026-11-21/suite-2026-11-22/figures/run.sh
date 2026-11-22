#!/bin/bash
# per-ship run: $1=side dir, $2=checkout
side=$1; co=$2; mkdir -p $side
for k in $(cat /tmp/ks-verify/20261122-figures/keys.txt); do echo $k; done > $side/queue
run(){ k=$1; ( cd $co && KS_FIGURES_KEYS=$k NODE_OPTIONS=--max-old-space-size=3500 timeout 3000 node --test --test-name-pattern="^$k: computeStats" tests/example-figures-regression.cjs > /tmp/ks-verify/20261122-figures2/$side/$k.log 2>&1; echo $? > /tmp/ks-verify/20261122-figures2/$side/$k.exit ); }
export -f run; export side co
cat $side/queue | xargs -P 2 -I{} bash -c 'run {}'
echo done > $side/DONE
