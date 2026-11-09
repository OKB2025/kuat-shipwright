import json,sys
S='/tmp/claude-0/-home-claude/9168e617-b83b-5e65-bbbf-23ebdd64786b/scratchpad/stl/'
p='/home/claude/kuat-shipwright/js/core.js';s=open(p).read()
def clean(o):
    if isinstance(o,float): return float('%.6g'%o)
    if isinstance(o,list): return [clean(x) for x in o]
    if isinstance(o,dict): return {k:clean(v) for k,v in o.items()}
    return o
def put(name,update):
    global s
    i=s.index('const '+name+'=');j=s.index('\n',i);old=s[i+len('const '+name+'='):j];D,end=json.JSONDecoder().raw_decode(old)
    D=update(D);s=s[:i]+'const '+name+'='+json.dumps(clean(D),ensure_ascii=False,separators=(',',':'))+old[end:]+s[j:]
part=lambda q:{k:q[k] for k in ('rows','mirror','round')}
R=json.load(open(S+'rec_new2.json'));put('RECU',lambda D:{**{k:v for k,v in D.items() if k!='loft'},'W':R['W'],'H':R['H'],'st':R['st'],'parts':R['parts']})
M=json.load(open(S+'mun_lofts.json'));put('MUNI',lambda D:{**{k:v for k,v in D.items() if k!='loft'},'parts':[part(q) for q in M]})
P=json.load(open(S+'prov_new.json'));put('PROV',lambda D:{**{k:v for k,v in D.items() if k!='loft'},'W':P['W'],'H':P['H'],'st':P['st'],'parts':P['parts']})
Lq=json.load(open(S+'luc_new.json'));put('LUCR',lambda D:{**{k:v for k,v in D.items() if k not in('loft','arcs')},'sphere':Lq['sphere'],'parts':Lq['parts'],'slabs':Lq['slabs'],'ringSlabs':Lq['ringSlabs']})
open(p,'w').write(s);print('applied')
