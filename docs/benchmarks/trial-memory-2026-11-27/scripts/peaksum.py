import re,sys
stage=None;peak={};order=[]
for line in open(sys.argv[1]):
    m=re.match(r'### BEGIN (\S+)',line)
    if m: stage=m.group(1);order.append(stage);peak[stage]=0;continue
    if line.startswith('### END') or line.startswith('### maxRSS'): print(line.strip()); continue
    m=re.search(r'([\d.]+) \(([\d.]+)\) -> ([\d.]+) \(([\d.]+)\) MB',line)
    if m and stage: peak[stage]=max(peak[stage],float(m.group(1)),float(m.group(2)))
for s in order: print(f'{s}: peak heap before collections {peak[s]:.0f} MB (committed)')
