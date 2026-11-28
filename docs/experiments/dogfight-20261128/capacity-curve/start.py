import sys,os,json,subprocess,concurrent.futures
from pathlib import Path
game,source,out=map(Path,sys.argv[1:]);s=source.read_text()
start='function run(kind,seed){'; assert s.count(start)==1
s=s.replace(start,'''function curved(k){
 const p=prof(k),v=C.shieldGeneratorVolume(p);
 if(!(v>0)||v>=C.SHIELD_CURVE.fullGenV)return p;
 const old=C.fieldScale(p),n=Math.log(7.5*C.SHIELD_CURVE.refScale)/Math.log(C.SHIELD_CURVE.refGenV/C.SHIELD_CURVE.fullGenV);
 return {...p,shieldBuffer:p.shieldBuffer*Math.pow(v/C.SHIELD_CURVE.fullGenV,n)/old};
}
'''+start).replace('A,prof(A),0','A,curved(A),0').replace('Bk,prof(Bk),1','Bk,curved(Bk),1')
runner=out/'runner.cjs';runner.write_text(s)
def run(pair):
 a,b=pair
 for flip in (0,1):
  path=out/a/b/str(flip);path.mkdir(parents=True)
  env=dict(os.environ,KS_TEST_ROOT=str(game),KS_PLANET='1',KS_TURN_MASS='1',KS_TURN_VECTOR='1',KS_DOGFIGHT_STORES='1',KS_MISSION='air',KS_MISSILE_LOCK='1',KS_ROUND_PROFILE='1',KS_MISSILE_EVADE='1',KS_GUIDANCE='pn',KS_PN_N='3',KS_MSL_FF='1')
  if not flip:env['KS_TRACE']=str(path/'trace.json')
  with (path/'log').open('w') as f:subprocess.run(['node',str(runner),'craft_'+(b if flip else a),'craft_'+(a if flip else b),'20','4','4'],cwd=path,env=env,stdout=f,stderr=f,check=True)
 print(a,b,flush=True)
pairs=[(a,'tie_'+b) for a in ('xwing','awing') for b in ('ln','in','d','avenger')]
with concurrent.futures.ThreadPoolExecutor(4) as pool:list(pool.map(run,pairs))
