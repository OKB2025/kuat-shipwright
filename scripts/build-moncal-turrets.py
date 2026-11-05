#!/usr/bin/env python3
"""Build diagram-sized Mon Calamari ball turrets and the twin side-laser PD.

Dimensions are estimates from the user's annotated 1300m/1200m ship drawings,
not an energy-to-volume scaling. The third image defines the Home One weapons;
the fourth defines Liberty. The fifth/sixth define the separate twin PD's two
side-mounted laser mechanisms. Blank photograph display cylinders are omitted.
"""
import argparse
import base64
import importlib.util
import json
import math
from pathlib import Path
import struct
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]

def module(name, file):
    spec = importlib.util.spec_from_file_location(name, ROOT/'scripts'/file)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result

F = module('moncal_mesh_helpers', 'build-turret-family.py')
B = module('moncal_clip_helpers', 'build-capital-ball-turrets.py')
VARIANTS = [
    ('moncal_pd_triple', 'monCalPD', 'モン・カラマリ 3連装点防御', .02, 3, 3.6, False),
    ('moncal_single34', 'monCal34', 'モン・カラマリ 34TT単装球形砲', 34, 1, 6, False),
    ('moncal_single80', 'monCal80', 'モン・カラマリ 80TT単装球形砲', 80, 1, 8, False),
    ('moncal_single200', 'monCal200', 'モン・カラマリ 200TT単装球形砲', 200, 1, 10, False),
    ('moncal_triple200', 'monCal200Triple', 'モン・カラマリ 200TT三連装球形砲', 200, 3, 16, False),
    ('moncal_single150_ion', 'monCal150Ion', 'モン・カラマリ 150TT単装球形イオン砲', 150, 1, 11, True),
]

def mesh_range(row):
    return {k: row[k] for k in ['firstVertex','vertices','firstIndex','indices']}

def ball(key, kind, title, output, guns, diameter, ion):
    m=F.Mesh();R=diameter/2;center=[0,R/3,0];split=m.mark()
    sphere=F.spherical_house(m,center,R,'diagram-sized spherical gunhouse')
    sphere.update(componentRole='spherical-gunhouse',normalMode='sphere',normalCenterM=center[:])
    gross=m.compartments.pop()
    # The rear closed spherical cap is available room. The whole forward
    # section remains reserved for guns, receivers and their traversing drives.
    V,T=B.clipped_closed_cell((gross['verticesM'],gross['faces']),0,-R*.15,True)
    m.compartments.append({'label':'rear spherical charging chamber','verticesM':V,'faces':T,
        'volumeM3':F.triangle_volume(V,T),'movesWithGun':True,'conservative':True,
        'sourceSphereMeshRange':mesh_range(sphere),
        'sourceClosure':'actual closed spherical cap behind the gun/receiver reserve',
        'reservedMachinerySeparation':{'axis':0,'boundM':-R*.15,'side':'below'}})
    receiver=m.cylinder([R*.84,center[1],0],R*.33,R*.17,0,'inset circular gun receiver',32)
    receiver['componentRole']='moving-receiver'
    # Three small parallel ports are visible on the diagrams. All variants
    # retain a true spherical case instead of the former broadside window.
    offsets=[0] if guns==1 else [-R*.19,0,R*.19]
    radius=R*(.045 if guns==3 else .065)
    barrels=[]
    for i,z in enumerate(offsets):
        fn=m.ion_barrel if ion else m.barrel
        row=fn(R*.56,R*1.85,center[1],z,radius,'complete spherical gun '+str(i+1),segments=16)
        row['componentRole']='moving-complete-barrel';barrels.append(row)
    a=F.finish(m,kind,title,output,center,barrels,split,[],1,
        source='User-provided annotated Mon Calamari ship drawings; parametric reconstruction',
        nativeCalibration='moncal-photo-family',materialReference='isd_heavy_octuple',
        weaponRole='ion' if ion else 'point-defense' if kind=='monCalPD' else 'turbolaser',
        gunhouseElevates=True,sphereRadiusM=R,sphereCenterM=center[:],
        sphereMeshRange=mesh_range(sphere),ballCaseDimensionsM=[diameter]*3,
        grossSphereVolumeM3=gross['volumeM3'],
        reservedInternalMachineryVolumeM3=gross['volumeM3']-sum(c['volumeM3']for c in m.compartments),
        mountEmbedding={'diameterBelowMountFraction':1/3,'centerHeightRadiusRatio':1/3,
                        'analyticCapVolumeFraction':7/27},
        jointLimits={'yaw':None,'lo':-math.pi/2,'hi':math.pi/2},
        dimensionEvidence='Estimated from annotated ship drawings at 1300m Home One / 1200m Liberty scale',
        assumption='PD bolt energy retains the existing 20GT setting; physical ball sizes estimated from drawings')
    a['turretCompartment'].update(grossHousingVolumeM3=gross['volumeM3'],conservative=True,
        excludes=['forward gun/receiver/drive reserve','barrels','display stand'])
    return a

def twin_pd():
    m=F.Mesh()
    ring=m.cylinder([0,.12,0],2.35,.24,1,'intrinsic low traverse bearing',40)
    ring['componentRole']='intrinsic-bearing-ring'
    body=m.prism([[-2.4,.24],[.9,.24],[.8,1.35],[.3,1.85],[-1.9,1.85],[-2.4,1.4]],
                 -.95,.95,'fixed compact armored center case',True)
    body['componentRole']='fixed-gunhouse'
    for cell in m.compartments:cell['movesWithGun']=False
    pivot=[-.1,2.02,0]
    for sg in [-1,1]:
        row=m.cylinder([pivot[0],pivot[1],sg*1.1],.78,.5,2,'fixed transverse axle '+str(sg),28)
        row['componentRole']='fixed-transverse-axle'
    split=m.mark();barrels=[];drives=[]
    for sg in [-1,1]:
        z=sg*2.1
        row=m.cylinder([pivot[0],pivot[1],sg*1.52],.86,.4,2,'side circular elevating bearing '+str(sg),32)
        row.update(componentRole='moving-bearing',centerM=[pivot[0],pivot[1],sg*1.52],radiusM=.86)
        drives.append(row)
        carrier=m.prism([[-1.3,1.8],[1.35,1.8],[1.35,2.5],[.9,2.95],[-1.2,2.95],[-1.5,2.65]],
                        z-.45,z+.45,'long side laser receiver '+str(sg))
        carrier['componentRole']='moving-side-laser-receiver'
        row=m.barrel(.6,6.6,2.02,z,.105,'complete side laser barrel '+str(sg),segments=20)
        row['componentRole']='moving-complete-barrel';barrels.append(row)
        rail=m.box([-1,3,z-.36],[.95,3.12,z+.36],'side laser top rail '+str(sg))
        rail['componentRole']='moving-top-rail'
    return F.finish(m,'pd','20GT 2連装側面レーザー点防御砲',.02,pivot,barrels,split,drives,1,
        source='User-provided turret photograph (upper middle) and Osa-M structural reference; parametric reconstruction',
        nativeCalibration='point-defense-photo',materialReference='isd_heavy_octuple',
        weaponRole='point-defense',jointLimits={'yaw':None,'lo':-10*math.pi/180,'hi':85*math.pi/180},
        sideMountedLasers=True,dimensionEvidence='Existing 9m PD length retained; paired side-laser structure from references',
        photoFeatureComponents={'centerCase':[body['label']],
            'sideLaserCarriers':['long side laser receiver -1','long side laser receiver 1'],
            'twoCompleteLasers':[r['label']for r in barrels]})

def build():
    assets={row[0]:ball(*row)for row in VARIANTS}
    assets['pd_twin_side_laser']=twin_pd()
    return assets

def validate(assets):
    checks={}
    for key,a in assets.items():
        raw=base64.b64decode(a['data']);n=a['n'];b=a['indexBytes']
        I=[struct.unpack_from('<H'if b==2 else '<I',raw,n*10+i*b)[0]for i in range(a['faces']*3)]
        P=[[struct.unpack_from('<h',raw,i*6+k*2)[0]/65532*a['size'][k]+a['c'][k]for k in range(3)]for i in range(n)]
        if len(raw)!=n*10+len(I)*b or min(I)<0 or max(I)>=n:raise ValueError(key+': invalid packed mesh')
        if a['faces']>a['polygonBudget']['maximum']:raise ValueError(key+': triangle budget exceeded')
        if not a['turretCompartment']['volumeM3']>0:raise ValueError(key+': missing closed charging room')
        for j in range(0,len(I),3):
            A,B,C=[P[i]for i in I[j:j+3]]
            if F.dot(F.cross(F.sub(B,A),F.sub(C,A)),F.cross(F.sub(B,A),F.sub(C,A)))<1e-20:
                raise ValueError(key+': degenerate quantized triangle')
        bores=[]
        for row in a['barrelCenters']:
            ray=F.add(row['muzzle'],[1,0,0]);hits=[]
            for j in range(0,len(I),3):
                hit=F.ray_triangle(ray,[-1,0,0],*[P[i]for i in I[j:j+3]])
                if hit is not None and hit>0:hits.append(hit)
            if not hits or abs(min(hits)-1-row['muzzleRecessM'])>.01:
                raise ValueError(key+': recessed muzzle obstructed')
            bores.append({'recessM':row['muzzleRecessM'],'rayDistanceM':min(hits)})
        checks[key]={'triangles':a['faces'],'sizeM':a['size'],'barrels':a['barrels'],
                     'closedRoomM3':a['turretCompartment']['volumeM3'],'recessedBores':bores,
                     'quantizedDegenerateTriangles':0}
    return checks

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--json-output',type=Path,default=Path('/tmp/moncal-turret-assets.json'))
    p.add_argument('--metadata-output',type=Path,default=ROOT/'assets/source/moncal-turret-manifest.json')
    p.add_argument('--check',action='store_true');args=p.parse_args()
    assets=build();checks=validate(assets)
    manifest={'schemaVersion':1,'source':'User-provided ship drawings and PD/Osa-M references',
        'dimensionUncertainty':'Estimated physical dimensions; the annotations specify weapon energy and barrel count',
        'validation':checks,'assets':{key:{k:v for k,v in a.items()if k!='data'}for key,a in assets.items()}}
    if args.check:
        registered=F.registry(ROOT/'data/reference.js')
        stale=[key for key,a in assets.items()if registered.get(key)!=a]
        if stale:raise SystemExit('Mon Cal/PD registrations are stale: '+', '.join(stale))
        if not args.metadata_output.exists()or json.loads(args.metadata_output.read_text())!=manifest:
            raise SystemExit('Mon Cal/PD manifest is stale')
    else:
        args.json_output.parent.mkdir(parents=True,exist_ok=True)
        args.json_output.write_text(json.dumps(assets,ensure_ascii=False,separators=(',',':'))+'\n')
        args.metadata_output.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(checks,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
