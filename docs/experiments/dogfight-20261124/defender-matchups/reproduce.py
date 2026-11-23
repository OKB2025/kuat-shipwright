"""Run a single published cell: python reproduce.py SOURCE N MODE OPPONENT A OUT.
A is d (Defender starts on A) or o (opponent starts on A). Use a fresh OUT.
Example: python reproduce.py /path/to/5cdf219 12 xnobracket xwing d /tmp/ks-verify/run001
"""
import json
import os
from pathlib import Path
import subprocess
import sys

source, number, mode, opponent, side, output = sys.argv[1:]
source = Path(source).resolve()
out = Path(output).resolve()
out.mkdir(parents=True, exist_ok=False)
here = Path(__file__).resolve().parent
runner = (here.parent / 'x-wing-12v12/matrix.cjs').read_text()
core = (source / 'js/core.js').read_text()

def replace_once(text, old, new):
    if text.count(old) != 1:
        raise ValueError(f'Unexpected source version at {old[:65]}')
    return text.replace(old, new)

signature = 'function dogfightAim(u,t,st,dt,mates=null){'
if mode in ('off','doff','xoff'):
    guard = {'off':'','doff':"if(u.key==='craft_tie_d')",'xoff':"if(u.key==='craft_xwing')"}[mode]
    core = replace_once(core, signature, signature + guard + 'mates=null;')
elif mode == 'xnobracket':
    core = replace_once(core,'if(mate&&g.aspect>',"if(u.key!=='craft_xwing'&&mate&&g.aspect>")
elif mode == 'xnorole':
    core = replace_once(core,'if(mate){const gm=dogfightGeometry',"if(mate&&u.key!=='craft_xwing'){const gm=dogfightGeometry")
elif mode == 'max12':
    unfold='.flatMap(x=>Array(x.n).fill(x.kind))'
    runner=replace_once(runner,unfold,unfold+'.slice(0,12)')
elif mode == 'guns':
    runner = replace_once(runner,"({k:'cmsl',n:99})","({k:'cmsl',n:0})")
elif mode == 'span':
    step = (900 if int(number)==12 else 3300)/(int(number)-1)
    runner = runner.replace('300*i',f'{step!r}*i')
elif mode == 'shield':
    tag = 'const B=C.fleetBattle([...as,...bs],true);'
    runner = replace_once(runner, tag, """const all=as.concat(bs),x=all.find(u=>u.key==='craft_xwing'),def=all.find(u=>u.key==='craft_tie_d');
 const ratio=def.shieldMax/x.shieldMax;
 for(const u of all)if(u.key==='craft_xwing'){
  u.p={...u.p,shieldBuffer:(u.p.shieldBuffer??u.p.D*C.K.bufferS)*ratio};u.shield=u.shieldMax=def.shieldMax;
 }
 """ + tag)
elif mode != 'on':
    raise ValueError(mode)
(out/'js').mkdir()
(out/'js/core.js').write_text(core)
(out/'data').symlink_to(source/'data', target_is_directory=True)
(out/'sim.cjs').write_text(runner)
env = dict(os.environ,KS_TEST_ROOT=str(out),ROWS=str(out/'runs.jsonl'),KS_TRACE='',KS_GUIDANCE='pn',KS_PN_N='3')
for flag in ['KS_PLANET','KS_TURN_MASS','KS_TURN_VECTOR','KS_DOGFIGHT_STORES','KS_MISSILE_LOCK','KS_ROUND_PROFILE','KS_MISSILE_EVADE']:
    env[flag]='1'
pair = ['craft_'+opponent,'craft_tie_d']
if side=='d':
    pair.reverse()
with (out/'stdout').open('w') as stdout:
    subprocess.run(['node',str(out/'sim.cjs'),*pair,'20',number,number],env=env,stdout=stdout,check=True)
