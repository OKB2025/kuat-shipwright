import json,sys,collections
p=json.load(open(sys.argv[1]));nodes={n['id']:n for n in p['nodes']}
self=collections.Counter()
for s,d in zip(p['samples'],p['timeDeltas']): self[s]+=d
parent={}
for n in p['nodes']:
    for c in n.get('children',[]): parent[c]=n['id']
nm=lambda n:(n['callFrame']['functionName'] or '(anon)')+':'+str(n['callFrame']['lineNumber']+1)
src=open(sys.argv[2]).read().split('\n')
stage={}
def stage_of(nid):
    x=nid;path=[]
    while x is not None:
        n=nodes[x];cf=n['callFrame']
        if cf['url'].endswith('path.cjs') and cf['functionName']=='' and parent.get(x) is not None and nodes[parent[x]]['callFrame']['functionName']=='T':
            return cf['lineNumber']+1
        x=parent.get(x)
    return None
per=collections.defaultdict(collections.Counter);tot=collections.Counter()
for nid,t in self.items():
    st=stage_of(nid)
    if st is None: continue
    tot[st]+=t;seen=set();x=nid
    while x is not None:
        k=nm(nodes[x])
        if k not in seen: per[st][k]+=t;seen.add(k)
        x=parent.get(x)
WATCH=['syncCompartmentsRaw','surfacePatches','structuralClipBoundary','allOccupied','enginePaths','physicalEngineDriveNetwork','armoredMaterialArea','exposedSurface','turretGeometryKey','aviationPublicJSON','publicCopyOf','placementGeometryContains','weaponCapacitors','hullGeo','structuralMaterial','surfaceExposedTriangles','interiorRegionClearBox','solidSimplifyFlat','powerNetwork','computeHeat','(garbage collector)','insideOriginalEnvelope','unpiercedInStruct','engineTransmission','fitArcInfo','rayBVH','surfaceGeometryKey','syncAviation','turretCompartment','remount']
for st in sorted(tot):
    label=src[st-1].strip()[:60]
    print('\n### line %d  %.1f s  %s'%(st,tot[st]/1e6,label))
    rows=[(k,t) for k,t in per[st].items() if k.split(':')[0] in WATCH and t>2e5]
    for k,t in sorted(rows,key=lambda r:-r[1])[:16]: print('   %6.2f s  %s'%(t/1e6,k))
