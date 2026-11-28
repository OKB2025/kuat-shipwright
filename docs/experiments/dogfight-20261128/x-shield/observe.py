from pathlib import Path
import sys
root,k=map(Path,sys.argv[1:]);s=(root/'js/core.js').read_text()
def rep(a,b):
 global s
 assert s.count(a)==1,a
 s=s.replace(a,b)
rep('function combatResolve(ctx,u,o,dt,s){','function combatResolve(ctx,u,o,dt,s){ ctx._causeInc=o;')
rep('if(u.secLost.includes(si))return;u.secLost.push(si);',"""if(u.secLost.includes(si))return;
 if(!u.secLost.length && craftUnit(u)){
 const stack=new Error().stack,o=ctx._causeInc||{},beam=Math.max(0,(o.sf||0)-(o.ion||0))>0,direct=(o.direct||0)>0;
 const cause=stack.includes('at combatBlast (')?'missile':stack.includes('at combatFires (')?'fire':stack.includes('at heatTick (')?'heat':stack.includes('at combatResolve (')?(beam&&direct?'mixed':direct?'direct':beam?'gun':'unknown'):'unknown';
 globalThis.ksFatal({id:u.id,time:ctx.time,cause,stack,beam,direct});
 }
 u.secLost.push(si);""")
(k/'game/js/core.js').write_text(s)
p=k/'tools/prepare.py';v=p.read_text();mark='destination.write_text(runner)';v=v.replace(mark,'''replace_once("let contacts=[],bursts=[];", "let contacts=[],bursts=[],fatal=[];cx.ksFatal=e=>fatal.push(e);")
replace_once("contacts=[];bursts=[];","contacts=[];bursts=[];fatal=[];")
replace_once(" const out='seed-'+s;", " row.fatal=fatal;\\n const out='seed-'+s;")
'''+mark);p.write_text(v)
