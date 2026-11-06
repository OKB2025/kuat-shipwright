#!/usr/bin/env python3
"""Restore the full archived Venator side gun in a canonical wall-mount frame.

All source vertices, triangles and UVs are retained. Only a rigid frame change
and fixed/moving vertex ordering are applied; no housing or barrel is rebuilt.
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
SOURCE_ID, ASSET_ID = 'ven_side_gun', 'ven_side70_native'

def module(file):
    spec = importlib.util.spec_from_file_location('ven_side_source_helpers', ROOT/'scripts'/file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value

B = module('build-twin40-turret.py')

def principal_axis(points):
    center = [sum(p[k] for p in points)/len(points) for k in range(3)]
    cov = [[sum((p[i]-center[i])*(p[j]-center[j]) for p in points) for j in range(3)] for i in range(3)]
    axis = [math.cos(math.radians(74.5)), 0, -math.sin(math.radians(74.5))]
    for _ in range(24):
        axis = B.unit([B.dot(row, axis) for row in cov])
    return axis

def build():
    source_assets = B.source_assets(ROOT/'data/reference.js')
    source = source_assets[SOURCE_ID]
    payload = source
    while 'data' not in payload:
        payload = source_assets[payload['dataFrom']]
    points, uvs, indices, packed = B.decode(source, payload)
    groups = B.components(points, indices)
    rows = []
    for group in groups:
        ids = set(group)
        faces = [indices[i:i+3] for i in range(0, len(indices), 3) if indices[i] in ids]
        rows.append({'group':group, 'faces':faces})
    barrels = [row for row in rows if len(row['faces']) == 350]
    if len(rows) != 6 or len(barrels) != 2:
        raise ValueError('Archived Venator gun components changed')
    axes = [principal_axis([points[i] for i in row['group']]) for row in barrels]
    forward = B.unit([sum(a[0] for a in axes), 0, sum(a[2] for a in axes)])
    up = [0, 1, 0]
    right = B.cross(forward, up)
    frame = [forward, up, right]
    turned = [[B.dot(p, axis) for axis in frame] for p in points]
    low, high = B.bounds(turned)
    origin = [low[0], (low[1]+high[1])/2, (low[2]+high[2])/2]
    local = [[p[k]-origin[k] for k in range(3)] for p in turned]
    fixed = [row for row in rows if row not in barrels]
    ordered = fixed + barrels
    mapping = [i for row in ordered for i in row['group']]
    remap = {old:new for new,old in enumerate(mapping)}
    out_points = [local[i] for i in mapping]
    out_uvs = [uvs[i] for i in mapping]
    out_indices = [remap[i] for row in ordered for face in row['faces'] for i in face]
    low, high = B.bounds(out_points)
    size = [high[k]-low[k] for k in range(3)]
    center = [(low[k]+high[k])/2 for k in range(3)]
    data = bytearray()
    for p in out_points:
        for k in range(3):
            data.extend(struct.pack('<h', round((p[k]-center[k])/size[k]*65532)))
    for uv in out_uvs:
        data.extend(struct.pack('<HH', *uv))
    for i in out_indices:
        data.extend(struct.pack('<H', i))
    quant_error = max(math.dist(p, [struct.unpack_from('<h', data, i*6+k*2)[0]/65532*size[k]+center[k] for k in range(3)]) for i,p in enumerate(out_points))
    axle = next(row for row in fixed if len(row['faces']) == 184)
    pivot = [sum(local[i][k] for i in axle['group'])/len(axle['group']) for k in range(3)]
    barrel_meta = []
    for row in barrels:
        values = [local[i] for i in row['group']]
        lo, hi = B.bounds(values)
        tip = [p for p in values if p[0] >= hi[0]-.003]
        tip_lo, tip_hi = B.bounds(tip)
        muzzle = [hi[0], (tip_lo[1]+tip_hi[1])/2, (tip_lo[2]+tip_hi[2])/2]
        radii = [math.hypot(p[1]-muzzle[1], p[2]-muzzle[2]) for p in tip]
        barrel_meta.append({'root':[lo[0],muzzle[1],muzzle[2]], 'muzzle':muzzle,
            'axis':[1,0,0], 'outerRadiusM':max(radii), 'boreRadiusM':min(radii),
            'sourceVertices':len(row['group']), 'sourceFaces':len(row['faces'])})
    components = []
    vertex, index = 0, 0
    for row in ordered:
        moving = row in barrels
        components.append({'label':'unchanged source barrel' if moving else 'unchanged source housing or shared axle',
            'firstVertex':vertex, 'vertices':len(row['group']), 'firstIndex':index,
            'indices':len(row['faces'])*3, 'movesWithGun':moving})
        vertex += len(row['group'])
        index += len(row['faces'])*3
    split_vertices = sum(len(row['group']) for row in fixed)
    split_indices = sum(len(row['faces'])*3 for row in fixed)
    asset = {'title':'70TT×2 舷側', 'kind':'fit', 'source':source.get('source',''),
        'nativeCalibration':'venator-source-side70', 'catalogKind':'venSide70',
        'c':center, 'size':size, 'n':len(out_points), 'faces':len(out_indices)//3,
        'indexBytes':2, 'data':base64.b64encode(data).decode('ascii'),
        'mount':[0,0,0], 'forward':[1,0,0], 'up':[0,1,0], 'bounds':[low,high],
        'barrels':2, 'boltTT':70, 'volleyTT':140, 'barrelCenters':barrel_meta,
        'muzzlePoints':[row['muzzle'] for row in barrel_meta],
        'barrelAxis':[1,0,0], 'elevationAxis':[0,0,1], 'traversePivot':pivot,
        'elevationPivot':pivot, 'elevationVertexStart':split_vertices,
        'elevationIndexStart':split_indices, 'housingVertices':split_vertices,
        'housingFaces':split_indices//3, 'housingFixed':True,
        'jointLimits':{'yaw':math.radians(65), 'lo':math.radians(-20), 'hi':math.radians(20)},
        'jointLimitEvidence':'Existing side/casemate simulation limits; gameplay assumption',
        'noSupportPedestal':True, 'supportStandHeightM':0,
        'sourceAsset':SOURCE_ID, 'sourcePackedSha256':hashlib.sha256(packed).hexdigest(),
        'sourceFrame':{'rotationRows':frame, 'mountPointRelativeToSourceCenterM':[
            sum(origin[j]*frame[j][k] for j in range(3)) for k in range(3)],
            'sourceCenterM':source['c']}, 'sourceVertexIndices':mapping,
        'geometryPreservation':{'sourceVertices':source['n'], 'sourceFaces':source['faces'],
            'allSourceVerticesPreserved':True, 'allSourceTrianglesPreserved':True,
            'uvsPreserved':True, 'uniformScale':1, 'removedGeometry':0},
        'turretCompartment':{'version':1, 'role':'gunhouse', 'convexes':[], 'volumeM3':0,
            'sourceClosure':'No validated closed charging cells are inferred from the archived native housing'},
        'components':components, 'maxQuantizationErrorM':quant_error,
        'polygonBudget':{'unit':'triangles', 'maximum':5000, 'countsAllFixedAndMovingGeometry':True}}
    for key in ['sourceUrl','authorUrl','license','licenseUrl']:
        if key in source:
            asset[key] = source[key]
    if len(mapping) != source['n'] or len(set(mapping)) != source['n'] or len(out_indices) != source['faces']*3:
        raise ValueError('Source geometry was lost')
    if quant_error > .001 or split_vertices != 292 or split_indices != 684:
        raise ValueError('Native side gun partition or precision changed')
    return asset

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--json-output',type=Path,default=Path('/tmp/kuat-ven-side70-assets.json'))
    parser.add_argument('--metadata-output',type=Path,default=ROOT/'assets/source/venator-side70-manifest.json')
    parser.add_argument('--check',action='store_true')
    args = parser.parse_args()
    asset = build()
    metadata = {k:v for k,v in asset.items() if k != 'data'}
    if args.check:
        registered = B.registered_asset(ROOT/'data/reference.js', ASSET_ID)
        if registered != asset:
            raise SystemExit('Venator side70 native registration is stale')
        if json.loads(args.metadata_output.read_text()) != metadata:
            raise SystemExit('Venator side70 native manifest is stale')
    else:
        args.json_output.write_text(json.dumps({ASSET_ID:asset},ensure_ascii=False,separators=(',',':'))+'\n')
        args.metadata_output.write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:metadata[k] for k in ['n','faces','size','barrels','boltTT','volleyTT','housingVertices','housingFaces','maxQuantizationErrorM']},ensure_ascii=False))

if __name__ == '__main__':
    main()
