import os,json,sys,subprocess,concurrent.futures,collections
from pathlib import Path
k=Path(os.environ['KS_OBSERVER']);root=Path(os.environ['KS_BATCHES'])
s=(k/'tie_in-runner.cjs').read_text();mark='const b=bs[0];';assert s.count(mark)==1
s=s.replace('function run(kind,seed){', '''function scaled(k){const p=prof(k);return k==='craft_xwing'?{...p,shieldBuffer:p.shieldBuffer*Number(process.env.XSHIELD)}:p;}
function run(kind,seed){''').replace('A,prof(A),0','A,scaled(A),0').replace('Bk,prof(Bk),1','Bk,scaled(Bk),1').replace(mark,mark+'''if(seed===21)fs.writeFileSync('capacity.json',JSON.stringify([a.shieldMax,b.shieldMax]));''')
runner=root/'runner.cjs';runner.write_text(s)
def one(scale):
 ds=root/str(scale);ds.mkdir(); rows=[]
 for flip in (0,1):
  d=ds/str(flip);d.mkdir(); a,b='craft_xwing','craft_tie_in'
  if flip:a,b=b,a
  env=dict(os.environ,KS_TEST_ROOT=str(k/'game'),KS_PLANET='1',KS_TURN_MASS='1',KS_TURN_VECTOR='1',KS_DOGFIGHT_STORES='1',KS_MISSION='air',KS_MISSILE_LOCK='1',KS_ROUND_PROFILE='1',KS_MISSILE_EVADE='1',KS_GUIDANCE='pn',KS_PN_N='3',KS_MSL_FF='1',XSHIELD=str(scale))
  with (d/'log').open('w') as f:subprocess.run(['node',str(runner),a,b,'20','4','4'],cwd=d,env=env,stdout=f,stderr=f,check=True)
  for i in range(21,41):
   q=json.loads((d/f'seed-{i}/result.json').read_text());x,t=(q['b'],q['a']) if flip else (q['a'],q['b']); causes=collections.Counter(e['cause'] for e in q['fatal'] if e['id'].startswith('b' if flip else 'a'));assert sum(causes.values())==x
   rows.append(dict(scale=scale,flip=flip,seed=i,x=x,t=t,gun=causes['gun'],msl=causes['missile'],other=x-causes['gun']-causes['missile'],w='X' if x<t else 'T' if t<x else 'draw',sec=q['t']))
 (ds/'rows.json').write_text(json.dumps(rows));print(scale,[sum(v[n] for v in rows) for n in ('gun','msl','other','x','t')],dict(collections.Counter(v['w'] for v in rows)),flush=True)
with concurrent.futures.ThreadPoolExecutor(4) as pool:list(pool.map(one,map(float,sys.argv[1:])))
