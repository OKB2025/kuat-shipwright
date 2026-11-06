# CR90 STL model

The CR90 uses the user-supplied `3-CR90_Corvette_Standard.STL`. The original
binary file is stored with deterministic gzip compression at
`assets/source/cr90/cr90-corvette-standard.stl.gz`. Its uncompressed SHA-256 is
`a9f7b02f9089420a372154f61edf6b26037a33008499acba69274bba4ff4a5ad`.
The file arrived without an author or license; the attribution of the previous
CR90 model does not describe this source.

The original 208,425 triangles are transformed rigidly and scaled uniformly to
150 m. Source negative Y points toward the bow, source Z points upward, and
source negative X points to starboard. The resulting width is about 47.24 m
and height about 32.12 m.

The renderer retains 206,939 source triangles. Exactly 1,332 triangles belonging
to the six complete mounted guns are detached by matching the separately
supplied turret files. Another 154 flat triangles close the eleven printed
engine mouths; installed nozzle bells and glow replace these visible covers.
The original fixed sockets, nacelles, lips and other details remain.

The standard ship carries two `twin500MT` light turbolaser mounts and four
`single6MT` heavy laser mounts at their measured native socket poses. Their
complete native bases sit at the source depths. The former 200 GT weapons
and twin point-defense mounts are removed from this example.

A separate closed union provides physical hull occupancy. It is clipped to
the measured source bounds and validated after the final coordinate export:
every edge has two oppositely oriented incident faces and no triangle has zero
area. The collider has 8,046 triangles; render detail does not create reactor,
engine, shield or cooling performance.

All eleven measured mouths retain their own independent engine body and
nozzle. The ordinary stock construction installs finite electrical feeds,
mechanical transmissions and strict cooling. The preceding nominal input of
each engine is preserved; the hull asset supplies geometry only.

Reproduce the asset and measurement manifest with Blender:

```sh
blender --background --threads 4 --python scripts/import-cr90.py -- \
  --asset-output /tmp/cr90-hull-asset.json \
  --manifest-output assets/source/cr90/hull-manifest.json
```

The manifest records source hashes, uniform scale, detached triangle indices,
the six native gun poses, all eleven engine mouths, and the final collision
topology. The importer reuses the closed-union helper in
`scripts/import-sphyrna.py`.
