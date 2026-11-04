# Supplied point-defense turret

`assets/source/turret-small-1.fbx` is the supplied `Turret-Small-1.fbx`, retained
unchanged. `pd-turret-manifest.json` records its SHA-256, conversion settings,
geometry counts and packed-data SHA-256. Its provenance is user supplied; it is
separate from the licensed reference ship models.

The converter retains all 29,060 triangles. The 14,644 source vertices become
25,049 indexed vertices because the FBX face-corner normal boundaries remain
separate. There is no decimation. The source has a plain material and no texture
image; the renderer uses the existing fitting metal material rather than a ship
texture atlas.

The import rotates Blender's barrel direction `-Y` to game `+X` and Blender `+Z`
to game `+Y`, retaining triangle winding. The turntable center and lowest point
form the mounting origin. The stored mesh has a 9 m length; weapon calibration
applies a uniform size factor at rendering and placement time.

Regenerate with Blender 4.1 or newer from the repository root:

```sh
blender --background --python scripts/import-pd-turret.py -- \
  assets/source/turret-small-1.fbx /tmp/pd-turret.json \
  --metadata-output assets/source/pd-turret-manifest.json \
  --reference-data data/reference.js
node --test tests/point-defense-model.cjs
```

The asset registration is appended to `data/reference.js`, so the editor, worker
and existing test loaders all receive the same model. The existing saved fitting
key `pd` is preserved. `meshFits` supplies the model for the editor, previews,
selection and moving trial turrets; `meshReferenceFits` omits it to avoid drawing
it twice or using a mismatched atlas. Source mounting transforms also determine
its placement bounds.
