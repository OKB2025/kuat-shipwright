import csv,json,statistics,sys
from pathlib import Path
from collections import Counter
o=Path(sys.argv[1]);rows=[]; summaries=[]
for k in ['tie_ln','tie_in','tie_d']:
 group=[]
 for side in ['x-first','tie-first']:
  for seed in range(21,41):
   q=json.loads((o/'runs'/k/side/f'seed-{seed}'/'result.json').read_text());x,y=(q['a'],q['b']) if side=='x-first' else (q['b'],q['a'])
   assert seed==q['seed'] and len(q['launches'])==q['missiles']['fired']
   group.append(dict(tie=k,side=side,seed=seed,x_lost=x,tie_lost=y,winner='X' if x<y else 'TIE' if y<x else 'draw',seconds=q['t'],timeout=int(q['w']=='none'),fired=q['missiles']['fired'],hit=q['collisions'].get('hit',0),friendly=q['collisions'].get('ff',0)))
 rows+=group
 summaries.append([k,dict(Counter(r['winner'] for r in group)),*[sum(r[f] for r in group) for f in ['x_lost','tie_lost','timeout','fired','hit','friendly']],statistics.median(r['seconds'] for r in group),[[r['seed'],r['side'],r['x_lost'],r['tie_lost']] for r in group if r['timeout']]])
with (o/'trials.csv').open('w') as f:
 w=csv.DictWriter(f,fieldnames=rows[0],lineterminator='\n');w.writeheader();w.writerows(rows)
print(json.dumps(summaries))
