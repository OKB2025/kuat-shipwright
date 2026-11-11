import json,sys
src,body,out=sys.argv[1:4];s=open(src,encoding='utf8').read();B=json.load(open(body))
i=s.index('const EXECUTOR_BODY_STRUCTURES=')+len('const EXECUTOR_BODY_STRUCTURES=');j=s.index(';\n',i)
s=s[:i]+json.dumps([{k:b[k] for k in ('y','m','o','t','b','tri') if k in b} for b in B],separators=(',',':'))+s[j:];open(out,'w',encoding='utf8').write(s);print('body',len(B))
