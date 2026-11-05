#!/usr/bin/env python3
"""Reconstruct the user's CIS 1TT four-barrel rapid-fire mount.

The photo shows two outboard circular elevation bearings, a compact lower
machinery housing and four long stepped cannons. This is a native 35 m assembly,
slightly larger than the existing 500GT quad; caliber does not shrink the mesh.
The housing/yoke is fixed and the bearing wheels, receiver and complete guns
share an elevation partition. There is no photograph display stand.
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
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('cis_rapid_helpers',ROOT/'scripts/build-turret-family.py')
F=importlib.util.module_from_spec(spec);spec.loader.exec_module(F)
ASSET='cis_rapid_quad1'


def role(row,value):
    row['componentRole']=value
    return row


def build():
    m=F.Mesh();pivot=[0,9,0]
    F.thin_turntable(m,6,40)
    # Closed low machinery case is intrinsic equipment, not a display plinth.
    house=F.bevel_house(m,[[-8,.48],[2,.48],[3,1.6],[1.5,3.2],[-7,3.2],[-8,2.2]],11.4,
                       'closed lower armored machinery case')
    role(house,'fixed-armored-machinery-case')
    # Reserve the front half for the drive machinery. Only the rear closed
    # source-derived cell contributes charging room.
    m.compartments.clear()
    cell=F.Mesh();cell.box([-7.2,.7,-4.9],[-3.4,2.8,4.9],'rear charging cell',True)
    room=cell.compartments[0];room.pop('meshRange')
    room.update(conservative=True,sourceClosure='closed box within lower armored machinery case',
                sourceMeshRange={k:house[k] for k in ['firstVertex','vertices','firstIndex','indices']})
    m.compartments.append(room)
    for sign in [-1,1]:
        lo,hi=sorted([sign*8.3,sign*9.4])
        row=m.prism([[-4,1.5],[3,1.5],[1.7,9.8],[-1.8,9.8]],lo,hi,
                    'fixed sloping bearing yoke '+str(sign))
        role(row,'fixed-bearing-yoke')
        role(m.cylinder([0,9,sign*8.15],.9,2.2,2,
                        'fixed transverse bearing axle '+str(sign),24),'fixed-bearing-axle')
        role(m.box([-7,3.2,sign*3.5-.7],[-3.2,3.6,sign*3.5+.7],
                   'rear machinery access cover '+str(sign)),'fixed-access-cover')
    split=m.mark()
    drives=[]
    for sign in [-1,1]:
        center=[0,9,sign*6.15]
        wheel=role(m.cylinder(center,4.5,2.7,2,'large circular elevation wheel '+str(sign),40),
                   'moving-circular-elevation-wheel')
        wheel.update(centerM=center,axis=[0,0,1],radiusM=4.5,
                     caseOuterSideM=9.4,innerFaceAbsZM=4.8,outerFaceAbsZM=7.5,
                     caseSideClearanceM=.8)
        drives.append(wheel)
        for radius,depth,z,label in [(3.65,.22,7.55,'concentric bearing face'),
                                     (2.6,.18,7.72,'recessed circular bearing cover'),
                                     (1.65,.32,7.9,'central axle cover')]:
            role(m.cylinder([0,9,sign*z],radius,depth,2,label+' '+str(sign),32),
                 'moving-bearing-cover')
        # Short radial plates retain the photographed segmented wheel rim.
        for i in range(12):
            t=2*math.pi*i/12;radial=[math.cos(t),math.sin(t)];tangent=[-radial[1],radial[0]]
            vertices=[]
            for z in [sign*7.5,sign*7.68]:
                for r,u in [(3.9,-.25),(4.65,-.25),(4.65,.25),(3.9,.25)]:
                    vertices.append([r*radial[0]+u*tangent[0],9+r*radial[1]+u*tangent[1],z])
            role(m.convex(vertices,[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]],
                          'radial wheel reinforcement '+str(sign)+' '+str(i+1)),
                 'moving-radial-wheel-reinforcement')
    role(m.box([-3.7,5.1,-4.8],[2.2,12.9,4.8],'common quad recoil receiver'),
         'moving-recoil-receiver')
    barrels=[]
    for y in [6.5,11.5]:
        for z in [-3.1,3.1]:
            row=role(m.barrel(-2,27,y,z,.9,'complete 1TT rapid-fire barrel '+str(len(barrels)+1),
                              bore_ratio=.61,segments=20),'moving-complete-barrel')
            row.update(shaftRadiusM=.9,fullBarrelLengthM=29,radialSegments=20,
                       muzzleStyle='modeled-recessed',barrelStyle='cis-long-stepped-cannon')
            barrels.append(row)
    a=F.finish(m,'quad1Rapid','1TT 4連装ラピッドファイア砲',1,pivot,barrels,split,drives,1,
        source='User-supplied CIS capital-ship gun photograph; parametric reconstruction',
        nativeCalibration='cis-photo-family',materialReference='isd_heavy_octuple',
        weaponRole='turbolaser',jointLimits={'yaw':None,'lo':-10*math.pi/180,'hi':85*math.pi/180},
        noSupportPedestal=True,supportStandHeightM=0,
        photoFeatureComponents={'circularBearings':[r['label'] for r in drives],
                               'quadCannons':[r['label'] for r in barrels],
                               'lowerCase':[house['label']]},
        comparison={'referenceAsset':'arq_turret_quad500','referenceSizeM':[28.5,9.2,11.79109375],
                    'constraint':'native envelope at least as large along every dimension'},
        derivation='four complete stepped cannons and recoil receiver between two large circular side bearings; low integral armored case with fixed outboard bearing yoke')
    return {ASSET:a}


def decode(a):
    raw=base64.b64decode(a['data']);n=a['n'];b=a['indexBytes']
    points=[[struct.unpack_from('<h',raw,i*6+k*2)[0]/65532*a['size'][k]+a['c'][k]
             for k in range(3)]for i in range(n)]
    indices=[struct.unpack_from('<H'if b==2 else '<I',raw,n*10+i*b)[0]
             for i in range(a['faces']*3)]
    return raw,points,indices


def validate(assets):
    a=assets[ASSET];raw,P,I=decode(a)
    if a['faces']>5000:raise ValueError('CIS mount exceeds 5000 real triangles')
    if len(raw)!=a['n']*10+a['faces']*3*a['indexBytes']:raise ValueError('Invalid packed mesh length')
    if min(I)<0 or max(I)>=a['n']:raise ValueError('Index out of bounds')
    if len(set(I))!=a['n']:raise ValueError('Orphaned vertices')
    if any(a['size'][i]<n for i,n in enumerate(a['comparison']['referenceSizeM'])):
        raise ValueError('CIS mount is smaller than quad500')
    if len(a['barrelCenters'])!=4 or len(a['muzzlePoints'])!=4:raise ValueError('Expected four complete guns')
    if a['housingFaces']<=0 or a['elevationIndexStart']<=0:raise ValueError('Missing fixed and moving partitions')
    if any(sum(v*v for v in F.cross(F.sub(P[I[j+1]],P[I[j]]),F.sub(P[I[j+2]],P[I[j]])))<1e-20
           for j in range(0,len(I),3)):raise ValueError('Degenerate packed triangle')
    normals=[[0,0,0]for _ in P]
    for j in range(0,len(I),3):
        tri=I[j:j+3];N=F.cross(F.sub(P[tri[1]],P[tri[0]]),F.sub(P[tri[2]],P[tri[0]]))
        for i in tri:normals[i]=[normals[i][k]+N[k] for k in range(3)]
    if any(F.dot(n,n)==0 for n in normals):raise ValueError('Zero vertex normal')
    for c in a['turretCompartment']['convexes']:
        edges={}
        for A,B,C in c['faces']:
            for u,v in [(A,B),(B,C),(C,A)]:edges[tuple(sorted((u,v)))]=edges.get(tuple(sorted((u,v))),0)+1
        if set(edges.values())!={2}:raise ValueError('Open charging cell')
        if F.triangle_volume(c['verticesM'],c['faces'])<=0:raise ValueError('Empty charging cell')
    bores=[]
    for row in a['barrelCenters']:
        start=row['firstIndex'];end=start+row['indices'];pts=[P[i]for i in set(I[start:end])]
        tip=row['muzzle'][0];floor=tip-row['muzzleRecessM']
        if min(abs(p[0]-floor)for p in pts)>.002:raise ValueError('Missing recessed bore floor')
        if row['firstIndex']<a['elevationIndexStart']:raise ValueError('Barrel belongs to fixed partition')
        bores.append({'label':row['label'],'recessM':row['muzzleRecessM'],'completeMovingGun':True})
    return {'actualTriangles':a['faces'],'polygonLimit':5000,'physicalBarrels':4,
            'dimensionsLargerThanQuad500':True,'closedChargingVolumeM3':a['turretCompartment']['volumeM3'],
            'fixedAndMovingPartitions':True,'zeroNormalVertices':0,'modeledBores':bores,
            'packedSha256':hashlib.sha256(raw).hexdigest()}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--json-output',type=Path,default=ROOT.parent/'scratch/cis-rapid-asset.json')
    parser.add_argument('--metadata-output',type=Path,default=ROOT/'assets/source/cis-rapid-turret-manifest.json')
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args();assets=build();validation=validate(assets)
    if args.check:
        current=F.registry(ROOT/'data/reference.js');current.update(F.registry(ROOT/'data/imperial2.js'))
        if current.get(ASSET)!=assets[ASSET]:raise SystemExit('CIS rapid-fire asset registration is stale')
    else:
        args.json_output.parent.mkdir(parents=True,exist_ok=True)
        args.json_output.write_text(json.dumps(assets,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
        metadata={'schemaVersion':1,'source':'User-provided CIS rapid-fire cannon photograph',
                  'order':[ASSET],'validation':validation,
                  'assets':{k:{n:v for n,v in a.items() if n!='data'}for k,a in assets.items()}}
        args.metadata_output.write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:{'size':a['size'],'faces':a['faces'],'barrels':a['barrels'],
                        'gunhouseVolumeM3':a['turretCompartment']['volumeM3']}for k,a in assets.items()},indent=2))


if __name__=='__main__':main()
