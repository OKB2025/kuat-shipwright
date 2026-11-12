import json,sys
p,st=sys.argv[1],json.load(open(sys.argv[2]));s=open(p,encoding='utf-8').read()
i=s.index('const EXECUTOR_WEDGE_STATIONS=')+len('const EXECUTOR_WEDGE_STATIONS=');j=s.index(';',i)
open(p,'w',encoding='utf-8').write(s[:i]+json.dumps(st,separators=(',',':'))+s[j:]);print('stations set',len(st))
