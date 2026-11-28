from pathlib import Path
import csv,json,sys,statistics,collections
s=Path(sys.argv[1]);rows=[];summ=[]
for a in ('xwing','awing'):
 for b in ('tie_ln','tie_in','tie_d','tie_avenger'):
  sub=[]
  for flip in (0,1):
   for seed in range(21,41):
    q=json.loads((s/a/b/str(flip)/f'seed-{seed}'/'result.json').read_text());u,v=(q['b'],q['a']) if flip else (q['a'],q['b'])
    row=dict(allied=a,tie=b,flip=flip,seed=seed,lost=u,tie_lost=v,win='allied' if u<v else 'tie' if v<u else 'draw',sec=q['t'],timeout=int(q['w']=='none'))
    for side,letter,loss in [('allied','b' if flip else 'a',u),('tie','a' if flip else 'b',v)]:
     causes=collections.Counter(e['cause'] for e in q['fatal'] if e['id'][0]==letter);assert sum(causes.values())==loss,(a,b,flip,seed,causes,loss)
     for c in ('gun','missile','collision'):row[side+'_'+c]=causes[c]
     row[side+'_other']=loss-sum(causes[c] for c in ('gun','missile','collision'))
    sub.append(row)
  rows.extend(sub); cnt=collections.Counter(x['win'] for x in sub)
  q=[a,b,*[cnt[c] for c in ('allied','tie','draw')],*[sum(x[c] for x in sub) for c in ('lost','tie_lost','timeout','allied_gun','allied_missile','allied_collision','allied_other','tie_gun','tie_missile','tie_collision','tie_other')],statistics.median(x['sec'] for x in sub)];summ.append(q);print(q)
def save(name,head,rows):
 with (s/name).open('w') as f:
  w=csv.writer(f,lineterminator='\n');w.writerow(head);w.writerows(rows)
save('trials.csv',rows[0].keys(),[r.values() for r in rows]);save('summary.csv','allied tie allied_wins tie_wins draws lost tie_lost timeout allied_gun allied_missile allied_collision allied_other tie_gun tie_missile tie_collision tie_other median_s'.split(),summ)
