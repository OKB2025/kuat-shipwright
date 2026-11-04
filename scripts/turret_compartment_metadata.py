"""Attach conservative, actual-mesh gunhouse cells to reproducible legacy assets."""
import base64
import copy
import hashlib
import json
from pathlib import Path


def attach_compartment(asset_id, asset):
    path = Path(__file__).resolve().parents[1] / 'assets/source/turret-legacy-compartments.json'
    source = json.loads(path.read_text(encoding='utf-8')).get(asset_id)
    if source is None:
        return asset
    factors = [value / native for value, native in zip(asset['size'], source['referenceSizeM'])]
    factors = [1 if abs(value - 1) < 1e-10 else value for value in factors]
    metadata = copy.deepcopy(source)
    if factors == [1, 1, 1]:
        packed = hashlib.sha256(base64.b64decode(asset['data'])).hexdigest()
        if packed != source['sourcePackedSha256']:
            raise ValueError('Gunhouse cells need revalidation after changing ' + asset_id)
    else:
        volume_scale = factors[0] * factors[1] * factors[2]
        for convex in metadata['convexes']:
            convex['verticesM'] = [[value * factors[k] for k, value in enumerate(point)]
                                   for point in convex['verticesM']]
            if 'volumeM3' in convex:
                convex['volumeM3'] *= volume_scale
        metadata['volumeM3'] *= volume_scale
        metadata['appliedScale'] = factors
    asset['turretCompartment'] = metadata
    return asset
