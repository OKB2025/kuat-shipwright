"""Deterministic, source-endpoint mesh reduction using Python's standard library.

Quadric face planes prioritize planar triangulation, with boundary constraints,
link-condition checks, normal-flip rejection and locked bounding extrema. No
source point is moved: retained corners use an original position and UV. The
reported plane RMS is a collapse heuristic, not a Hausdorff-distance guarantee.
"""
import heapq
import math

def reduce_component(points, triangles, target, max_rms=.001, min_triangle_altitude=.002):
    positions=[];lookup={};mapping=[];origins=[]
    for i,p in enumerate(points):
        key=tuple(p)
        if key not in lookup:lookup[key]=len(positions);positions.append(p);origins.append([])
        v=lookup[key];mapping.append(v);origins[v].append(i)
    faces={};incident=[set()for _ in positions];quadrics=[[0.]*10 for _ in positions];counts=[0 for _ in positions]
    def normal(tri, minimum_altitude=0):
        a,b,c=[positions[v]for v in tri];u=[b[k]-a[k]for k in range(3)];v=[c[k]-a[k]for k in range(3)]
        n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];L=math.sqrt(sum(x*x for x in n))
        longest=max(math.dist(a,b),math.dist(b,c),math.dist(c,a))
        # A nearly collinear source triangle can collapse to a line when the
        # final whole-turret Int16 coordinates are packed. Reject that edge
        # collapse, preserving another adjacent source face instead of later
        # deleting visible cladding and leaving an isolated zero-normal fan.
        return [x/L for x in n] if L>1e-12 and L>=minimum_altitude*longest else None
    def addplane(v,n,d,weight=1):
        a,b,c=n;Q=[a*a,a*b,a*c,a*d,b*b,b*c,b*d,c*c,c*d,d*d]
        for i,q in enumerate(Q):quadrics[v][i]+=q*weight
        counts[v]+=weight
    for i,source in enumerate(triangles):
        tri=[mapping[v]for v in source];n=normal(tri)
        if len(set(tri))<3 or n is None:continue
        faces[i]=(tri,n,source)
        for v in tri:incident[v].add(i);addplane(v,n,-sum(n[k]*positions[v][k]for k in range(3)))
    alive=[True for _ in positions];versions=[0 for _ in positions]
    locked=set()
    for k in range(3):
        locked.add(min(range(len(positions)),key=lambda v:positions[v][k]));locked.add(max(range(len(positions)),key=lambda v:positions[v][k]))
    edges={}
    for i,(tri,n,source)in faces.items():
        for u,v in zip(tri,tri[1:]+tri[:1]):edges.setdefault(tuple(sorted([u,v])),[]).append(i)
    for (u,v),F in edges.items():
        if len(F)!=1:continue
        n=faces[F[0]][1];e=[positions[v][k]-positions[u][k]for k in range(3)];b=[e[1]*n[2]-e[2]*n[1],e[2]*n[0]-e[0]*n[2],e[0]*n[1]-e[1]*n[0]];L=math.sqrt(sum(x*x for x in b))
        if not L:continue
        b=[x/L for x in b]
        for w in [u,v]:addplane(w,b,-sum(b[k]*positions[u][k]for k in range(3)),100)
    def qcost(Q,p):
        x,y,z=p;return max(0,Q[0]*x*x+2*Q[1]*x*y+2*Q[2]*x*z+2*Q[3]*x+Q[4]*y*y+2*Q[5]*y*z+2*Q[6]*y+Q[7]*z*z+2*Q[8]*z+Q[9])
    heap=[]
    def push(a,b):
        if a==b or not alive[a]or not alive[b]:return
        a,b=sorted([a,b]);Q=[x+y for x,y in zip(quadrics[a],quadrics[b])];N=counts[a]+counts[b]
        opts=[(qcost(Q,positions[k]),k,j)for k,j in [(a,b),(b,a)]if j not in locked]
        if not opts:return
        error,keep,drop=min(opts);edge=sum((positions[a][k]-positions[b][k])**2 for k in range(3))
        heapq.heappush(heap,(error/max(1,N),edge,keep,drop,versions[keep],versions[drop]))
    for a,b in edges:push(a,b)
    collapsed=0;max_error=0.
    while len(faces)>target and heap:
        err,edge,keep,drop,vk,vd=heapq.heappop(heap)
        if not alive[keep]or not alive[drop]or versions[keep]!=vk or versions[drop]!=vd:continue
        if err>max_rms*max_rms:break
        shared=incident[keep]&incident[drop]
        if not shared or len(shared)>2:continue
        def adjacent(v):return {j for f in incident[v]for j in faces[f][0]if j!=v}
        common=adjacent(keep)&adjacent(drop);opposite={v for i in shared for v in faces[i][0]if v not in [keep,drop]}
        if common!=opposite:continue
        updates={};valid=True
        for i in incident[drop]-shared:
            tri,oldn,source=faces[i];new=[keep if v==drop else v for v in tri];n=normal(new,min_triangle_altitude)
            if n is None or sum(a*b for a,b in zip(n,oldn))<.25:valid=False;break
            updates[i]=(new,oldn,source)
        if not valid:continue
        for i in shared:
            tri,_,_=faces.pop(i)
            for v in tri:incident[v].discard(i)
        for i,record in updates.items():faces[i]=record;incident[keep].add(i)
        incident[drop].clear();alive[drop]=False
        quadrics[keep]=[a+b for a,b in zip(quadrics[keep],quadrics[drop])];counts[keep]+=counts[drop]
        versions[keep]+=1;versions[drop]+=1;collapsed+=1;max_error=max(max_error,math.sqrt(err))
        for v in adjacent(keep):push(keep,v)
    return positions,origins,list(faces.values()),{'sourceTriangles':len(triangles),'triangles':len(faces),'collapses':collapsed,'maxCollapsePlaneRmsM':max_error,'maxAllowedCollapsePlaneRmsM':max_rms,'minNewTriangleAltitudeSourceM':min_triangle_altitude}
