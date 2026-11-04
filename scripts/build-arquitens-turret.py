#!/usr/bin/env python3
"""Derive the Arquitens quad 500 GT turret from the supplied small dual-purpose gun.

Only Python's standard library is required. The original turntable and drive
housing retain every face; photo-guided raised cradles carry four long parallel
barrels with stepped breeches and recessed circular muzzles. The native envelope
is measured on the user's 325 m Arquitens STL. Local +X is forward, +Y up, the turntable floor is Y=0.

    python scripts/build-arquitens-turret.py --json-output /tmp/arq-quad500.json
    python scripts/build-arquitens-turret.py --write-registration
    python scripts/build-arquitens-turret.py --check
"""
import argparse
import base64
import hashlib
import json
import math
from pathlib import Path
import struct
import sys
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from turret_compartment_metadata import attach_compartment

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ID = 'pd_turret_small'
ASSET_ID = 'arq_turret_quad500'
# Full main-gun envelope after the source cruiser is scaled uniformly to 325 m.
TARGET_SIZE_M = [17.8304, 5.8065, 14.1041]
PREFIX = 'Object.assign(YardReferenceData.assets,{"' + ASSET_ID + '":'


def registration_asset(path, asset_id):
    prefix = 'Object.assign(YardReferenceData.assets,{"' + asset_id + '":'
    matches = [line for line in path.read_text(encoding='utf-8').splitlines()
               if line.startswith(prefix)]
    if len(matches) != 1:
        raise ValueError('Expected exactly one registration for ' + asset_id)
    return json.loads(matches[0][len('Object.assign(YardReferenceData.assets,'):-2])[asset_id]


def bounds(points):
    return ([min(p[k] for p in points) for k in range(3)],
            [max(p[k] for p in points) for k in range(3)])


def decode(asset):
    data = base64.b64decode(asset['data'])
    n = asset['n']
    points = [[struct.unpack_from('<h', data, i * 6 + k * 2)[0]
               / 65532 * asset['size'][k] + asset['c'][k] for k in range(3)]
              for i in range(n)]
    uvs = [struct.unpack_from('<HH', data, n * 6 + i * 4) for i in range(n)]
    fmt = '<H' if asset['indexBytes'] == 2 else '<I'
    indices = [struct.unpack_from(fmt, data, n * 10 + i * asset['indexBytes'])[0]
               for i in range(asset['faces'] * 3)]
    return points, uvs, indices, data


def components(points, indices):
    parent = list(range(len(points)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def join(a, b):
        a, b = find(a), find(b)
        if a != b:
            parent[a] = b

    for a, b, c in zip(indices[::3], indices[1::3], indices[2::3]):
        join(a, b)
        join(b, c)
    coincident = {}
    for i, p in enumerate(points):
        key = tuple(p)
        if key in coincident:
            join(i, coincident[key])
        else:
            coincident[key] = i
    result = {}
    for i in range(len(points)):
        result.setdefault(find(i), []).append(i)
    return sorted(result.values(), key=min)


def append_box(points, uvs, indices, low, high):
    """A small hard-edged cradle block; all faces stay in the moving group."""
    x0, y0, z0 = low
    x1, y1, z1 = high
    corners = [(x0,y0,z0),(x1,y0,z0),(x1,y1,z0),(x0,y1,z0),
               (x0,y0,z1),(x1,y0,z1),(x1,y1,z1),(x0,y1,z1)]
    faces = [(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)]
    for face in faces:
        first = len(points)
        points.extend([list(corners[i]) for i in face])
        uvs.extend([(0,0),(65535,0),(65535,65535),(0,65535)])
        indices.extend([first,first+1,first+2,first,first+2,first+3])


def append_barrel(points, uvs, indices, profile, y, z, segments=40):
    """Revolve one closed X/r section, including a real recessed inner bore.

    Outer walls run forward, turn inward across the annular muzzle, and return
    along the inner wall to the recessed bore floor. No front disk fills it.
    """
    rings = []
    x_min, x_max = min(p[0] for p in profile), max(p[0] for p in profile)
    for x, radius in profile:
        if radius == 0:
            rings.append([len(points)])
            points.append([x,y,z])
            uvs.append((round((x-x_min)/(x_max-x_min)*65535),32768))
        else:
            ring = []
            for k in range(segments):
                t = 2*math.pi*k/segments
                ring.append(len(points))
                points.append([x,y+radius*math.cos(t),z+radius*math.sin(t)])
                uvs.append((round((x-x_min)/(x_max-x_min)*65535),round(k/segments*65535)))
            rings.append(ring)
    for first, second in zip(rings, rings[1:]):
        for k in range(segments):
            j = (k+1) % segments
            if len(first) == 1:
                indices.extend([first[0],second[j],second[k]])
            elif len(second) == 1:
                indices.extend([first[k],first[j],second[0]])
            else:
                indices.extend([first[k],first[j],second[j],first[k],second[j],second[k]])


def build(reference, size=TARGET_SIZE_M):
    source = registration_asset(reference, SOURCE_ID)
    points, uv, indices, source_data = decode(source)
    groups = components(points, indices)
    barrels = []
    for group in groups:
        low, high = bounds([points[i] for i in group])
        if len(group) == 1824 and high[0]-low[0] > 6 and high[1]-low[1] < .7:
            barrels.append(group)
    if len(groups) != 63 or len(barrels) != 2:
        raise ValueError('PD source must retain 63 components and two intact barrels')
    barrel_set = {i for group in barrels for i in group}
    housing = [i for i in range(len(points)) if i not in barrel_set]
    housing_set = set(housing)
    housing_faces = [indices[i:i+3] for i in range(0,len(indices),3) if indices[i] in housing_set]
    if any(any(v not in housing_set for v in tri) for tri in housing_faces):
        raise ValueError('A barrel is attached to a housing triangle')
    # Preserve every original housing face and the same native envelope. The
    # high, long parallel tubes are new geometry informed by the user's photos.
    factors = [size[k]/source['size'][k] for k in range(3)]
    out_points = [[points[i][k]*factors[k] for k in range(3)] for i in housing]
    out_uv = [uv[i] for i in housing]
    mapping = {v:i for i,v in enumerate(housing)}
    out_indices = [mapping[i] for tri in housing_faces for i in tri]
    source_housing_vertices = len(out_points)
    source_housing_faces = len(out_indices)//3
    sx, sy, sz = [size[k]/TARGET_SIZE_M[k] for k in range(3)]
    radial_scale = min(sy,sz)
    # The two original circular side bearings define the actual common axis.
    drive_bounds = [bounds([points[i] for i in groups[j]]) for j in [3,4]]
    drive_centres = [[(lo[k]+hi[k])/2*factors[k] for k in range(3)] for lo,hi in drive_bounds]
    elevation_pivot = [(drive_centres[0][k]+drive_centres[1][k])/2 for k in range(3)]
    elevation_vertex_start = len(out_points)
    elevation_index_start = len(out_indices)
    barrel_sides = []
    for group in sorted(barrels,key=lambda g:sum(points[i][2] for i in g)/len(g)):
        lo,hi = bounds([points[i] for i in group])
        barrel_sides.append(('left' if lo[2]+hi[2] < 0 else 'right',(lo[2]+hi[2])/2*factors[2]))
    # A bearing arm and two upright cheeks connect the raised pair to each side
    # drive. The frame leaves a visible gap between the long exposed tubes.
    for _,z in barrel_sides:
        sg = 1 if z > 0 else -1
        blocks = [([-.8,3.40,z/sz-.37],[ -.42,5.55,z/sz+.37]),
                  ([1.42,3.40,z/sz-.37],[1.75,5.55,z/sz+.37]),
                  ([.0,3.40,min(sg*2.95,z/sz-.37)],[1.42,3.78,max(sg*2.95,z/sz+.37)])]
        for low,high in blocks:
            append_box(out_points,out_uv,out_indices,
                       [low[0]*sx,low[1]*sy,low[2]*sz],
                       [high[0]*sx,high[1]*sy,high[2]*sz])
    housing_vertices = len(out_points)
    housing_face_count = len(out_indices)//3
    base_low,_ = bounds(out_points)
    muzzle_x = base_low[0]+size[0]
    barrel_root = min(points[i][0] for i in barrels[0])*factors[0]
    outer_radius = .17*radial_scale
    bore_radius = .115*radial_scale
    recess = .45*sx
    # Constant-diameter exposed shanks replace the old needle-like final taper.
    # The small breech steps and two narrow collars keep all four tubes legible.
    profile = [(barrel_root,0),(barrel_root,.38*radial_scale),
               (-.90*sx,.42*radial_scale),(1.35*sx,.42*radial_scale),
               (1.35*sx,.46*radial_scale),(1.65*sx,.46*radial_scale),
               (1.65*sx,.30*radial_scale),(2.05*sx,.30*radial_scale),
               (2.05*sx,.27*radial_scale),(2.24*sx,.27*radial_scale),
               (2.45*sx,outer_radius),(6.10*sx,outer_radius),
               (6.10*sx,.19*radial_scale),(6.28*sx,.19*radial_scale),
               (6.28*sx,outer_radius),(muzzle_x,outer_radius),
               (muzzle_x,bore_radius),(muzzle_x-recess,bore_radius),
               (muzzle_x-recess,0)]
    barrel_metadata = []
    for side,z in barrel_sides:
        for row,y in [('lower',4.0*sy),('upper',5.1*sy)]:
            first_vertex,first_index = len(out_points),len(out_indices)
            append_barrel(out_points,out_uv,out_indices,profile,y,z)
            lo,hi = bounds(out_points[first_vertex:])
            barrel_metadata.append({'side':side,'row':row,'firstVertex':first_vertex,
                'vertices':len(out_points)-first_vertex,'firstIndex':first_index,
                'indices':len(out_indices)-first_index,'faces':(len(out_indices)-first_index)//3,
                'centerM':[(lo[k]+hi[k])/2 for k in range(3)],
                'root':[barrel_root,y,z],'muzzle':[muzzle_x,y,z],'axis':[1,0,0],
                'outerRadiusM':outer_radius,'boreRadiusM':bore_radius,'muzzleRecessM':recess,
                'exposedStartX':2.45*sx,'breechRadiusM':.46*radial_scale})
    low,high = bounds(out_points)
    actual_size = [b-a for a,b in zip(low,high)]
    if any(abs(actual_size[k]-size[k]) > .002 for k in range(3)):
        raise ValueError('Photo geometry must retain the requested native envelope')
    center = [(a+b)/2 for a,b in zip(low,high)]
    n = len(out_points)
    index_bytes = 2 if n < 65536 else 4
    packed = bytearray()
    for point in out_points:
        for k in range(3):
            packed.extend(struct.pack('<h',round((point[k]-center[k])/actual_size[k]*65532)))
    for pair in out_uv:
        packed.extend(struct.pack('<HH',*pair))
    for i in out_indices:
        packed.extend(struct.pack('<H' if index_bytes == 2 else '<I',i))
    max_error = max(math.dist(point,[struct.unpack_from('<h',packed,i*6+k*2)[0]
                        /65532*actual_size[k]+center[k] for k in range(3)])
                        for i,point in enumerate(out_points))
    asset = {'title':'500GT 4連装中型ターボレーザー砲塔','kind':'fit','plainMetal':True,
        'source':'Turret-Small-1.fbx (user supplied), photo-guided raised quad mount',
        'derivedFrom':SOURCE_ID,'n':n,'faces':len(out_indices)//3,'indexBytes':index_bytes,
        'c':center,'size':actual_size,'mount':[0,0,0],'forward':[1,0,0],'up':[0,1,0],
        'barrels':4,'layout':'two raised parallel vertical barrels on each side',
        'bounds':[low,high],'sourcePackedSha256':hashlib.sha256(source_data).hexdigest(),
        'sourceHousingVertices':source_housing_vertices,'sourceHousingFaces':source_housing_faces,
        'housingVertices':housing_vertices,'housingFaces':housing_face_count,
        'barrelVertices':barrel_metadata[0]['vertices'],'barrelFaces':barrel_metadata[0]['faces'],
        'barrelCenters':barrel_metadata,'axisScale':factors,'barrelRadialScale':radial_scale,
        'elevationPivot':elevation_pivot,'elevationAxis':[0,0,1],'barrelAxis':[1,0,0],
        'muzzlePoints':[row['muzzle'] for row in barrel_metadata],
        'elevationVertexStart':elevation_vertex_start,'elevationIndexStart':elevation_index_start,
        'elevationRanges':[{'firstVertex':elevation_vertex_start,'vertexCount':n-elevation_vertex_start}],
        'drivePivots':drive_centres,'maxQuantizationErrorM':max_error,
        'modifications':'Original PD housing and turntable faces retained. New physically connected '
            'raised pair cradles carry four long, constant-diameter barrels with stepped breeches '
            'and real recessed circular muzzles, based on the supplied photographs. '
            'The entire appended cradle/barrel group elevates about the original side-drive axis.',
        'data':base64.b64encode(packed).decode('ascii')}
    return attach_compartment(ASSET_ID, asset)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--reference-data', type=Path, default=ROOT / 'data/reference.js')
    parser.add_argument('--json-output', type=Path)
    parser.add_argument('--metadata-output', type=Path)
    parser.add_argument('--length', type=float, default=TARGET_SIZE_M[0])
    parser.add_argument('--height', type=float, default=TARGET_SIZE_M[1])
    parser.add_argument('--width', type=float, default=TARGET_SIZE_M[2])
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--write-registration', action='store_true')
    args = parser.parse_args()
    size = [args.length, args.height, args.width]
    if any(not math.isfinite(v) or v <= 0 for v in size):
        parser.error('Dimensions must be finite and positive')
    asset = build(args.reference_data, size)
    registration = 'Object.assign(YardReferenceData.assets,' + json.dumps({ASSET_ID: asset},
                        ensure_ascii=False, separators=(',', ':')) + ');'
    if args.json_output:
        args.json_output.parent.mkdir(parents=True, exist_ok=True)
        args.json_output.write_text(json.dumps(asset, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    metadata = {k: v for k, v in asset.items() if k != 'data'}
    metadata['packedSha256'] = hashlib.sha256(base64.b64decode(asset['data'])).hexdigest()
    if args.metadata_output:
        args.metadata_output.parent.mkdir(parents=True, exist_ok=True)
        args.metadata_output.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    if args.check:
        current = registration_asset(args.reference_data, ASSET_ID)
        if current != asset:
            raise SystemExit('Arquitens quad turret registration is stale')
    if args.write_registration:
        lines = args.reference_data.read_text(encoding='utf-8').splitlines()
        found = [i for i, line in enumerate(lines) if line.startswith(PREFIX)]
        if len(found) > 1:
            raise ValueError('Multiple quad turret registrations')
        if found:
            lines[found[0]] = registration
        else:
            lines.append(registration)
        args.reference_data.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(json.dumps(metadata, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
