#!/usr/bin/env python3
"""Prepare a telemetry copy of the pinned game's dogfight runner.

Usage: python3 prepare.py GAME/scripts/sim-dogfight.cjs OUTPUT/runner.cjs
Run the copy with KS_TEST_ROOT set to GAME, from a separate output directory.
"""
from pathlib import Path
import sys

source, destination = map(Path, sys.argv[1:])
runner = source.read_text()


def replace_once(old, new):
    global runner
    if runner.count(old) != 1:
        raise SystemExit(f"Expected one occurrence of {old!r} in {source}")
    runner = runner.replace(old, new)


# Use the same homogeneous anti-air stores as the previous 4v4 trial.
# craftOrdnance applies each station's actual capacity.
replace_once(
    "C.craftOrdnance(xs).flatMap",
    "C.craftOrdnance(xs,C.craftLoadout(xs).stations.map(()=>({k:'cmsl',n:99}))).flatMap",
)
# Record the shooter's actual distance from the selected target at release.
replace_once(
    "st.msl.fired++;",
    """st.msl.fired++;
  (st.launches ||= []).push({t,from:w.id,to:q.id,metres:C.len(C.sub(q.pos,w.pos))});""",
)
replace_once(
    "if(TRACE&&seed===1)frames.push({t,u:",
    """if(TRACE&&seed===24)frames.push({t,
 m:(B.missiles||[]).map(m=>({id:m.id,p:m.pos.slice(),a:m.from,b:m.target})),
 ff:B.missileLog?.ff||0,prox:B.missileLog?.prox||0,stray:B.missileLog?.stray||0,held:st.held||0,u:""",
)
replace_once("if(TRACE&&seed===1)fs.writeFileSync", "if(TRACE&&seed===24)fs.writeFileSync")
replace_once(
    "for(let s=1;s<=N;s++)R.push(run(kind,s));",
    """for(let s=21;s<21+N;s++){
 const q=run(kind,s);
 R.push(q);
 const row={seed:s,t:q.t,a:q.lostA,b:q.lostB,w:q.win,missiles:q.st.msl,
  collisions:q.st.mlog||{},held:q.st.held||0,lock:q.st.lock||{},launches:q.st.launches||[]};
 const out='seed-'+s;
 fs.mkdirSync(out,{recursive:true});
 fs.writeFileSync(out+'/result.json',JSON.stringify(row)+'\\n');
}""",
)
# Optional observer for the identity of the craft that the game actually hit.
# The plain runner uses the original VM source. The observer adds a callback
# at the existing damage record in a memory-only copy of js/core.js.
replace_once(
    "for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});",
    """const audit=process.env.KS_OBSERVE_CONTACTS==='1';
let contacts=[],bursts=[];
if(audit)cx.ksObserveImpact=(time,id,from,target,actual,friendly,n,travelled,prox)=>{
 contacts.push({time,id,from,target,actual,friendly,n,travelled,prox});
};
if(audit)cx.ksObserveBurst=(actual,from,n,energy,leaked)=>bursts.push({actual,from,n,energy,leaked});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js']){
 let source=fs.readFileSync(path.join(root,f),'utf8');
 if(audit&&f==='js/core.js'){
  const marker='log().hit+=m.n;m.hit=m.n;';
  if(source.split(marker).length!==2)throw new Error('Unexpected missile impact record');
  const observe='globalThis.ksObserveImpact(b.time,m.id,m.from,m.target,t.id,t.team===m.team,m.n,m.traveled,prox);';
  source=source.replace(marker,observe+marker);
  const shieldMarker='const lg=ctx.proxLog||null;';
  if(source.split(shieldMarker).length!==2)throw new Error('Unexpected proximity shield record');
  const shieldObserve='globalThis.ksObserveBurst(u.id,bl.src,bl.n,E,r.leaked);';
  source=source.replace(shieldMarker,shieldObserve+shieldMarker);
 }
 vm.runInContext(source,cx,{filename:f});
}""",
)
replace_once(" const q=run(kind,s);", " contacts=[];bursts=[];\n const q=run(kind,s);")
replace_once(" const out='seed-'+s;", " if(audit){row.contacts=contacts;row.bursts=bursts;}\n const out='seed-'+s;")

destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(runner)
