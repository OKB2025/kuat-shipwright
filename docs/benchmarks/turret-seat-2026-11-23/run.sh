O=/tmp/ks-verify/20261123-turretoverlap; cd /home/user/kuat-shipwright
for k in $(ls data/examples); do [ -f data/examples/$k/design.json.gz ] || continue
 for side in head; do R=$([ $side = base ] && echo $O/base || echo $PWD); NODE_OPTIONS=--max-old-space-size=6000 timeout 1200 node $O/bases.cjs $R $k > $O/b-$side-$k.json 2>$O/b-$side-$k.err || echo "$k $side FAILED"; done
 node -e "const a=JSON.parse(require('fs').readFileSync('$O/b-base-$k.json')),b=JSON.parse(require('fs').readFileSync('$O/b-head-$k.json'));const m=new Map(a.map(x=>[x[0],x]));const ch=b.filter(x=>{const y=m.get(x[0]);return !y||Math.abs(y[2]-x[2])>1e-3||y[3]!==x[3];}).map(x=>{const y=m.get(x[0]);return x[1]+'#'+x[0]+' '+(y?y[2]:'?')+'→'+x[2]+(y&&y[3]!==x[3]?' float '+y[3]+'→'+x[3]:'');});console.log('$k',b.length,'lift',b.filter(x=>x[4]).length,'changed',ch.length,ch.slice(0,8).join('; '))" 2>&1 | head -1
done; echo DONE
