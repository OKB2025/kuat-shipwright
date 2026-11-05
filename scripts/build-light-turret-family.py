#!/usr/bin/env python3
"""Build the five photo-sized 200/500 GT mounts without display pedestals.

The immutable 40 TT external twin supplies the small quad's case and complete
circular DBY machinery. Other mounts are new closed gunhouses or open AA forks;
their bearing rings are intrinsic mechanisms, never exhibition support stands.
"""
import argparse
import base64
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import struct
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('heavy_turret_geometry', ROOT/'scripts/build-turret-family.py')
F = importlib.util.module_from_spec(spec)
spec.loader.exec_module(F)
ORDER = ['light_single500', 'light_twin200', 'light_quad200', 'light_single200', 'light_twin200_fast']
LIMITS = {'yaw': None, 'lo': -10*math.pi/180, 'hi': 85*math.pi/180}


def role(row, name):
    row['componentRole'] = name
    return row


def tube(m, root, tip, radius, label, muzzle_radius=None, thin_length=None):
    """A complete tube with independently photo-sized shaft, neck and lip.

    The wide stepped receiver end is not part of the measured thin shaft.
    Photographs locate that neck and the front lip directly, so neither output
    nor a fixed fraction of the full hidden breech determines its visible span.
    """
    start=m.mark();x0,y,z=root;length=tip-x0
    muzzle_radius=radius*1.1 if muzzle_radius is None else muzzle_radius
    thin_length=length*.72 if thin_length is None else thin_length
    neck=tip-thin_length;breech=neck-x0
    if breech<=0:raise ValueError('Thin shaft must leave room for its stepped breech')
    recess=max(radius*1.5,length*.035)
    cap_length=min(thin_length*.20,max(muzzle_radius*1.8,.35))
    collar0=neck+thin_length*.60;collar1=neck+thin_length*.62
    profile=[(x0,0),(x0,radius*1.7),(x0+breech*.18,radius*1.7),
             (x0+breech*.18,radius*1.5),(x0+breech*.62,radius*1.5),
             (x0+breech*.62,radius*1.3),(neck,radius),(collar0,radius),
             (collar0,radius*1.08),(collar1,radius*1.08),(collar1,radius),
             (tip-cap_length,radius),(tip-cap_length,muzzle_radius),
             (tip,muzzle_radius),(tip,radius*.66),(tip-recess,radius*.66),(tip-recess,0)]
    clean=[]
    for point in profile:
        if not clean or math.dist(point,clean[-1])>1e-10:clean.append(point)
    segments=40;rings=[]
    for x,r in clean:
        if r==0:
            rings.append([len(m.points)]);m.points.append([x,y,z]);m.uvs.append((0,32768))
        else:
            ring=[]
            for i in range(segments):
                t=2*math.pi*i/segments;ring.append(len(m.points))
                m.points.append([x,y+r*math.cos(t),z+r*math.sin(t)])
                m.uvs.append((round((x-x0)/length*65535),round(i/segments*65535)))
            rings.append(ring)
    for a,b in zip(rings,rings[1:]):
        for i in range(segments):
            j=(i+1)%segments
            if len(a)==1:m.indices.extend([a[0],b[j],b[i]])
            elif len(b)==1:m.indices.extend([a[i],a[j],b[0]])
            else:m.indices.extend([a[i],a[j],b[j],a[i],b[j],b[i]])
    return m.record(start,label,root=root,muzzle=[tip,y,z],centerM=[(x0+tip)/2,y,z],axis=[1,0,0],
        outerRadiusM=muzzle_radius,boreRadiusM=radius*.66,muzzleRecessM=recess,
        exposedStartX=neck,shaftRadiusM=radius,muzzleOuterRadiusM=muzzle_radius,
        thinShaftStartXM=neck,thinShaftLengthM=thin_length,muzzleCollarLengthM=cap_length,
        muzzleStyle='generated-recessed',caliberGT=200)


def ring(m, radius):
    F.thin_turntable(m, radius)
    for row in m.components:
        row.setdefault('componentRole', 'intrinsic-bearing-ring')


def finish(m, kind, title, output, pivot, barrels, split, drive, scale=1, **extra):
    # A uniform source scale is also applied to annotations the common writer
    # does not know about; all component ranges still address actual triangles.
    for cell in m.compartments:
        if cell.get('movesWithGun') is None:
            cell['movesWithGun'] = cell.get('meshRange', {}).get('firstVertex', -1) >= split[0]
    for row in barrels:
        for key in ['shaftRadiusM','muzzleOuterRadiusM','thinShaftStartXM','thinShaftLengthM','muzzleCollarLengthM']:
            row[key]*=scale
    return F.finish(m, kind, title, output, pivot, barrels, split, drive, scale,
        nativeCalibration='light-photo-family', materialReference='ven_turret70_native',
        photoMeasurements='assets/source/light-turret-photo-measurements.json',
        jointLimits=LIMITS.copy(), source='User-supplied light turret photographs; native photo scale referenced to the 40 m ISD octuple',
        photoScaleReference={'asset': 'isd_heavy_octuple', 'lengthM': 40, 'approxMetresPerPixel': .153},
        **extra)


def build_single500():
    m = F.Mesh()
    pivot = [0, 1.2, 0]
    split = m.mark()
    sphere = F.spherical_house(m, pivot, 3.6, '500GT single complete spherical gunhouse')
    sphere.update(normalMode='sphere', normalCenterM=pivot[:], componentRole='spherical-gunhouse')
    # The circular socket and collar lie inside the ball's front hemisphere.
    role(m.cylinder([2.85, 1.2, 0], .58, 1.1, 0, 'single500 axial barrel socket', 48), 'moving-receiver')
    b = [tube(m, [2.6, 1.2, 0], 15.0, .535, '500GT ball single complete recessed barrel',
              muzzle_radius=.61,thin_length=8.9)]
    b[0]['caliberGT'] = 500
    return finish(m, 'single500', '500GT 単装ターボレーザー', .5, pivot, b, split, [],
        gunhouseElevates=True, sphereRadiusM=3.6, sphereCenterM=pivot[:],
        sphereMeshRange={k:sphere[k] for k in ['firstVertex','vertices','firstIndex','indices']},
        mountEmbedding={'diameterBelowMountFraction':1/3, 'centerHeightRadiusRatio':1/3, 'analyticCapVolumeFraction':7/27},
        photoFeatureComponents={'sphere':[sphere['label']]},
        derivation='small whole-ball single turret; the lower third of its diameter embeds in the host surface')


def aa_fork(m, pivot, width, radius, fast=False):
    """Open structural cheeks, with real air between them and no air credit."""
    begin=len(m.points)
    ring(m, width+1.0)
    for p in m.points[begin:]:p[0]+=pivot[0]
    x=pivot[0]
    role(m.box([x-1.7,.40,-width],[x+1.7,.72,width], 'AA open fork cross-foot'), 'fixed-yoke')
    for sign in [-1,1]:
        a,b=sorted([sign*(width-.15),sign*(width+.20)])
        role(m.prism([[x-1.50,.65],[x+1.25,.65],[x+.90,pivot[1]+.20],[x-.95,pivot[1]+.20]],
                     a,b,'AA open elevation fork '+str(sign)), 'fixed-yoke')
    # A short horizontal axle is the actual mechanical connection.
    role(m.cylinder(pivot, .25 if not fast else .43, width*2+.7, 2, 'AA fixed transverse trunnion axle', 40), 'fixed-bearing-axle')
    return F.drives(m, pivot[0], pivot[1], width+.12, radius, .30 if not fast else .50)


def aa_receiver(m, pivot, low, high, width, label):
    x0,y0=low;x1,y1=high
    row=role(m.prism([[x0,y0+.25],[x0+.25,y0],[x1-.35,y0], [x1,y0+.35],
                      [x1,y1-.25],[x1-.35,y1],[x0+.45,y1],[x0,y1-.35]],
                     -width,width,label), 'moving-receiver')
    # Cap the rear with a compact breech and a visible loading tray.
    role(m.box([x0-.30,y0+.15,-width*.82],[x0+.40,y1-.15,width*.82],label+' breech cover'), 'moving-breech')
    F.ribs(m,x0+.6,4,.42,y1,-width*.8,width*.8,.10)
    return row


def build_single200():
    m=F.Mesh();pivot=[-2.2,2.85,0]
    drive=aa_fork(m,pivot,.95,1.2)
    # Only this genuinely enclosed electrical cabinet contributes room.
    cabinet=role(m.box([-1.4,.72,-.53],[.0,1.33,.53],'single200 enclosed lower electrical cabinet',True),'fixed-electrical-case')
    split=m.mark()
    receiver=aa_receiver(m,pivot,[-3.5,2.05],[1.5,3.7],.55,'single200 exposed AA breech')
    # Long recoil cylinders above the tube and a narrow lateral linkage give
    # the open mechanism the high-angle gun silhouette in the supplied sketch.
    role(m.cylinder([1.2,3.72,0],.24,5.2,0,'single200 upper hydraulic recoil cylinder',32),'moving-recoil')
    role(m.cylinder([3.0,3.72,0],.12,5.1,0,'single200 recoil piston',32),'moving-recoil')
    role(m.prism([[-1.5,2.0],[-.5,1.90],[1.2,2.65],[.7,2.9]],-.68,.68,'single200 cradle below barrel'),'moving-cradle')
    b=[tube(m,[-.8,3.75,0],16.4,.305,'200GT AA single complete recessed barrel',
            muzzle_radius=.385,thin_length=12.2)]
    return finish(m,'single200','200GT 単装高射ターボレーザー',.2,pivot,b,split,drive,
        mount=[pivot[0],0,0],photoFeatureComponents={'case':[cabinet['label']],'receiver':[receiver['label']],
            'wheel':[r['label'] for r in drive]}, openYoke=True,
        derivation='open single AA mount with exposed breech, high-angle fork, recoil cylinders and a long slender barrel')


def build_fast200():
    m=F.Mesh();pivot=[-1.6,4.8,0]
    drive=aa_fork(m,pivot,2.8,3.9,True)
    cabinet=role(m.box([-2.0,.72,-1.45],[.2,1.35,1.45],'fast200 enclosed lower electrical cabinet',True),'fixed-electrical-case')
    split=m.mark()
    receiver=aa_receiver(m,pivot,[-4.2,2.9],[4.9,8.6],2.28,'fast200 enlarged exposed two-level receiver')
    # Two independent feeds/recoil rails share one elevating block. The upper
    # and lower roots (and muzzles) are visibly staggered by 1.2 m fore/aft.
    rows=[(3.4,6.45,19.1),(4.6,4.25,20.3)]
    b=[]
    for i,(x,y,tip) in enumerate(rows):
        role(m.box([-1.8,y-.55,-.65],[x+1.0,y+.55,.65],'fast200 individual recoil trough '+str(i+1)), 'moving-receiver')
        role(m.cylinder([x-.2,y+.58,0],.25,6.0,0,'fast200 recoil cylinder '+str(i+1),32),'moving-recoil')
        b.append(tube(m,[x,y,0],tip,.305,'200GT staggered fast barrel '+str(i+1),
                      muzzle_radius=.385,thin_length=9.6))
    role(m.box([-2.1,8.6,-1.9],[2.2,9.1,1.9],'fast200 upper feed and maintenance cover'),'moving-feed-cover')
    return finish(m,'twin200Fast','200GT 上下2連装速射ターボレーザー',.2,pivot,b,split,drive,
        mount=[pivot[0],0,0],photoFeatureComponents={'case':[cabinet['label']],'receiver':[receiver['label']],
            'wheel':[r['label'] for r in drive]}, openYoke=True,
        staggeredBarrels={'axis':'vertical','foreAftOffsetM':1.2,'verticalSeparationM':2.2,'barrelLengthsM':[15.7,15.7]},
        derivation='enlarged single-AA base and circular elevation drives, with two vertically stacked fore/aft-staggered complete barrels')


def build_twin200():
    m=F.Mesh();ring(m,4.25)
    raw=F.Mesh()
    raw.prism([[-8.2,.4],[8.2,.4],[9.3,1.5],[7.1,3.8],[-6.8,3.8],[-8.2,2.5]],
              -4.2,4.2,'twin200 lower high-angle armored case',True)
    raw.prism([[-7.8,3.8],[-7.8,5.3],[-6.1,6.3],[-2.2,6.3],[6.7,3.8]],
              -3.8,3.8,'twin200 canted upper high-angle armor',True)
    # Clear the real elevating receiver sweep; the visible closed side/floor
    # cells retain armor volume while the central air opening has no credit.
    labels=[]
    for cell in raw.compartments:
        for i,(V,T) in enumerate(F.convex_without_box((cell['verticesM'],cell['faces']),[-5.1,.72,-3.2],[9.4,7.0,3.2])):
            row=role(m.convex(V,T,cell['label']+' frame '+str(i),True),'fixed-gunhouse')
            labels.append(row['label'])
    pivot=[0,4.4,0]
    drive=F.drives(m,0,4.4,2.65,1.45,.45)
    role(m.cylinder(pivot,.40,7.5,2,'twin200 fixed transverse trunnion shaft',40),'fixed-bearing-axle')
    split=m.mark()
    hood=role(m.prism([[-3.25,3.4],[-3.25,5.8],[-2.3,6.9],[1.8,6.9],[3.2,5.9],[3.2,3.4]],
                     -2.95,2.95,'twin200 elevating high-angle center hood'),'moving-armored-hood')
    F.ribs(m,-2.3,5,.8,6.9,-2.3,2.3,.10)
    b=[]
    for z in [-.85,.85]:
        role(m.box([-.8,4.4,z-.46],[2.0,5.8,z+.46],'twin200 individual enclosed recoil receiver '+str(z)),'moving-receiver')
        b.append(tube(m,[1.2,5.15,z],15.7,.305,'200GT horizontal high-angle barrel '+str(z),
                      muzzle_radius=.305,thin_length=11.5))
    return finish(m,'twin200','200GT 左右2連装高角ターボレーザー',.2,pivot,b,split,drive,
        photoFeatureComponents={'case':labels,'receiver':[hood['label']],'wheel':[r['label'] for r in drive]},
        horizontalPair=True,derivation='enclosed canted high-angle gunhouse, central elevating armored hood and two horizontal complete barrels')


def build_quad200():
    m=F.Mesh();context=F.common_photo40_case(m)
    cover=F.restore_twin_case_cover(m,context)
    # Use precisely the same external-twin case, closed cover and conservative
    # real-room closures. Its copied two original barrels are never imported.
    m.compartments=[]
    for source in context['raw'].compartments:
        for i,(V,T) in enumerate(F.convex_without_box((source['verticesM'],source['faces']),[1.7,6.8,-6.6],[3.3,8.4,6.6])):
            m.compartments.append({'label':source['label']+' usable external-drive room '+str(i),
                'verticesM':V,'faces':T,'volumeM3':F.triangle_volume(V,T),'conservative':True,
                'sourceMeshRange':{'firstVertex':0,'vertices':len(m.points),'firstIndex':0,'indices':len(m.indices)}})
    pivot=[2.5,7.6,0]
    drive,zs=F.complete_photo_drives(m,pivot,6.5,6.5,'quad200 external complete circular trunnion')
    axle=role(m.cylinder(pivot,.70,17.2,2,'quad200 fixed cross-case drive shaft',48),'fixed-bearing-axle')
    split=m.mark();b=[];receivers=[]
    for z in zs:
        receiver=role(m.prism([[1.5,5.75],[6.0,5.75],[7.0,6.3],[7.0,8.9],[6.0,9.45],[1.5,9.45]],
                              z-1.35,z+1.35,'quad200 external central two-level receiver '+str(z)),'moving-receiver')
        receivers.append(receiver['label'])
        for y in [6.45,8.75]:
            b.append(tube(m,[1.8333333333333333,y,z],18.5,.27/.65,
                          '200GT central external quad barrel '+str(len(b)+1),
                          muzzle_radius=.27/.65,thin_length=7.8/.65))
    scale=.65
    shared=context['shared']
    return finish(m,'quad200','200GT 4連装ターボレーザー',.2,pivot,b,split,drive,scale,
        derivedFrom='ven_turret',externalMounts=True,internalBarrels=0,fullCircularBases=True,
        parentAsset='family_twin40_box',parentUniformScale=scale,
        sharedCase={**shared,'boundsM':[[x*scale for x in row] for row in shared['boundsM']],
            'recoilBayBoundsM':[[x*scale for x in row] for row in shared['recoilBayBoundsM']]},
        parentCase={'geometrySha256':shared['geometrySha256'],'unscaledBoundsM':shared['boundsM'],
                    'meshRange':shared['meshRange'],'coverLabel':cover['label']},
        photoFeatureComponents={'case':context['labels'],'mainCase':context['labels'],
            'wheel':[r['label'] for r in drive],'receiver':receivers,'axle':[axle['label']]},
        centralBarrelRows={'verticalOffsetFromElevationPivotM':[-1.15*scale,1.15*scale],
            'centredOnElevationBearing':True},
        derivation='exact uniformly reduced 40TT external twin case with two new centrally clustered barrels on each complete external circular mount')


def build():
    return dict(zip(ORDER,[build_single500(),build_twin200(),build_quad200(),build_single200(),build_fast200()]))


def decode(a):
    data=base64.b64decode(a['data']);n=a['n'];width=a['indexBytes']
    points=[[struct.unpack_from('<h',data,i*6+k*2)[0]/65532*a['size'][k]+a['c'][k]
             for k in range(3)] for i in range(n)]
    indices=[struct.unpack_from('<H' if width==2 else '<I',data,n*10+i*width)[0]
             for i in range(a['faces']*3)]
    return points,indices


def row_triangles(row,points,indices):
    return [[points[v] for v in indices[i:i+3]]
            for i in range(row['firstIndex'],row['firstIndex']+row['indices'],3)]


def point_on_triangle(p,tri,tolerance=.002):
    a,b,c=tri;u=F.sub(b,a);v=F.sub(c,a);n=F.cross(u,v);nn=F.dot(n,n)
    if nn<1e-16:return False
    w=F.sub(p,a)
    if abs(F.dot(w,n))/math.sqrt(nn)>tolerance:return False
    uu,uv,vv,wu,wv=F.dot(u,u),F.dot(u,v),F.dot(v,v),F.dot(w,u),F.dot(w,v)
    denominator=uv*uv-uu*vv
    if abs(denominator)<1e-16:return False
    s=(uv*wv-vv*wu)/denominator;t=(uv*wu-uu*wv)/denominator
    epsilon=tolerance/max(.01,math.sqrt(max(uu,vv)))
    return s>=-epsilon and t>=-epsilon and s+t<=1+epsilon


def surfaces_touch(left,right,points,indices):
    A=row_triangles(left,points,indices);B=row_triangles(right,points,indices)
    bbox=lambda triangle:F.bounds(triangle)
    B=[(t,bbox(t)) for t in B]
    for a in A:
        low,high=bbox(a)
        for b,(lo,hi) in B:
            if any(high[k]<lo[k]-.002 or low[k]>hi[k]+.002 for k in range(3)):continue
            if any(point_on_triangle(p,b) for p in a) or any(point_on_triangle(p,a) for p in b):return True
            for tri,target in [(a,b),(b,a)]:
                for i in range(3):
                    direction=F.sub(tri[(i+1)%3],tri[i])
                    distance=F.ray_triangle(tri[i],direction,*target)
                    if distance is not None and -.0001<=distance<=1.0001:return True
    return False


def validate(assets):
    result={}
    for key,a in assets.items():
        payload=base64.b64decode(a['data']);points,indices=decode(a)
        if len(a['barrelCenters']) != a['barrels']:raise ValueError(key+' barrel count')
        if not 0 <= a['elevationVertexStart'] <= a['n']:raise ValueError(key+' moving partition')
        receivers=[r for r in a['components'] if r.get('componentRole') in
                   ['moving-receiver','moving-armored-hood','spherical-gunhouse']]
        contacts=[]
        for row in a['barrelCenters']:
            if row['firstVertex'] < a['elevationVertexStart']:raise ValueError(key+' fixed barrel')
            if row['firstIndex'] < a['elevationIndexStart']:raise ValueError(key+' fixed barrel triangles')
            if row['muzzleRecessM'] <= 0:raise ValueError(key+' missing real recessed bore')
            connected=[r['label'] for r in receivers if surfaces_touch(row,r,points,indices)]
            if not connected:raise ValueError(key+' barrel is disconnected from its moving receiver: '+row['label'])
            contacts.append({'barrel':row['label'],'touchingMovingReceivers':connected})
        # The continuous fixed shafts reach the moving mechanism at the
        # elevation axis. The same actual shaft/receiver triangles are checked;
        # both barrels and their receivers share the moving partition.
        axle_contacts=[]
        for axle in [r for r in a['components'] if r.get('componentRole')=='fixed-bearing-axle']:
            connected=[r['label'] for r in receivers if surfaces_touch(axle,r,points,indices)]
            if not connected:raise ValueError(key+' moving receiver is disconnected from its fixed trunnion')
            axle_contacts.append({'axle':axle['label'],'touchingMovingReceivers':connected})
        clearance=F.moving_case_clearance(points,indices,a,[-10,0,25,55,85])
        for cell in a['turretCompartment']['convexes']:
            V,T=cell['verticesM'],cell['faces'];edges={}
            for tri in T:
                ia,ib,ic=tri;normal=F.cross(F.sub(V[ib],V[ia]),F.sub(V[ic],V[ia]))
                if max(F.dot(normal,F.sub(p,V[ia])) for p in V)>1e-5:raise ValueError(key+' non-convex room')
                for p,q in zip(tri,tri[1:]+tri[:1]):
                    edge=tuple(sorted((p,q)));edges[edge]=edges.get(edge,0)+1
            if set(edges.values())!={2}:raise ValueError(key+' open room')
        result[key]={'barrels':a['barrels'],'faces':a['faces'],'packedSha256':hashlib.sha256(payload).hexdigest(),
            'gunhouseVolumeM3':a['turretCompartment']['volumeM3'],'sizeM':a['size'],
            'actualBarrelReceiverContacts':contacts,'actualAxleReceiverContacts':axle_contacts,
            'movingTrianglesVersusFixedHouse':clearance}
    return result


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--json-output',type=Path,default=Path('/tmp/light-turret-family-candidate.json'))
    p.add_argument('--metadata-output',type=Path,default=ROOT/'assets/source/light-turret-family-manifest.json')
    p.add_argument('--check',action='store_true')
    args=p.parse_args();assets=build();validation=validate(assets)
    if args.check:
        current=F.registry(ROOT/'data/reference.js')
        stale=[k for k,v in assets.items() if current.get(k)!=v]
        if stale:raise SystemExit('Light turret registrations are stale: '+', '.join(stale))
    else:
        args.json_output.write_text(json.dumps(assets,ensure_ascii=False,separators=(',',':'))+'\n')
        manifest={'schemaVersion':1,'calibration':'light-photo-family','order':ORDER,'validation':validation,
            'assets':{k:{x:y for x,y in v.items() if x!='data'} for k,v in assets.items()}}
        args.metadata_output.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(validation,ensure_ascii=False,indent=2))


if __name__=='__main__':main()
