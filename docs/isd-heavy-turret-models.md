# Shared ISD heavy-turret housing

`isd_heavy_twin` and `isd_heavy_octuple` reuse the same textured housing from
LarsH.'s [Imperial I-class Star Destroyer](https://sketchfab.com/3d-models/imperial-i-class-star-destroyer-6913bf20402a4eaea3e59109db0fbea4),
licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
The original six-barrel mesh remains in `data/reference.js` as the reproducible
source and for compatibility with existing designs.

The converter removes the six complete connected barrel components and retains
every housing face and its original atlas UVs. It fits the pedestal's lower ring
to a level plane, puts its center at the mounting origin, and rotates the barrels
to face local +X. Local +Y is up. Both assets declare `mount: [0, 0, 0]` and use
the existing reference texture atlas.

The twin has one thick barrel in each chamber. The octuple has four slimmer
barrels in each chamber, spaced 1.4 m apart. Both use copies of each chamber's
original middle barrel, preserving its full length and UVs. The twin's radial
scale is 1.3 times the source barrel; the octuple's radial scale is additionally
multiplied by `(40 / 175) ** (1 / 3)`. Their approximate diameters are 1.766 m and
1.080 m, with a shared length of 14.107 m.

The housing is the first 628 vertices and 432 triangles of both assets. Its
packed positions and UVs are byte-identical. Each following barrel has 101
vertices and 84 triangles. The twin totals 830 vertices / 600 triangles; the
octuple totals 1,436 vertices / 1,104 triangles. No decimation, triangle cutting,
or procedural replacement of the housing is used.

Both assets have the same native size `[29.679587322727336, 7.842050041807548,
29.679456059608558]` m. Their common bounds relative to the mounting origin are
`[-14.839691894187744, 0, -14.83951833786201]` to
`[14.839895428539592, 7.842050041807548, 14.839937721746548]`.
Repacking adds less than 0.313 mm of positional error. The floor remains at zero.

Regenerate the registrations in `data/imperial2.js` with the Python standard
library:

```sh
python scripts/build-isd-heavy-turrets.py
python scripts/build-isd-heavy-turrets.py --check
```

`--json-output /tmp/isd-heavy-variants.json` also exports the generated assets
for external geometry inspection. The generated metadata records the original
packed source's SHA-256, retained source vertex indices, normalization frame,
barrel scaling, and quantization error.
