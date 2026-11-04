# ISD heavy-turret models

`oct40` uses the existing normal eight-barrel ISD turret: the low round model
that was already registered as `isd_heavy_octuple`. Its original 1,436 vertices,
1,104 triangles, eight barrels, housing details, UVs, and connection topology are
preserved. The entire model receives one uniform scale of approximately
1.347727634, producing a native size of 40.000000 × 10.568948 × 39.999823 m.

The immutable input is
[isd-heavy-octuple-original.json](../assets/source/isd-heavy-octuple-original.json).
The [family manifest](../assets/source/turret-family-manifest.json) records its
packed hash, source vertex mapping, preserved topology, UVs, and size transform.
The scale follows the main-battery proportions in the supplied 1,600 m ISD
photograph, with about ±10% photographic measurement uncertainty.

## Common source housing and the 350 TT twin

The normal eight-barrel model and `isd_heavy_twin` derive from the textured
housing in LarsH.'s
[Imperial I-class Star Destroyer](https://sketchfab.com/3d-models/imperial-i-class-star-destroyer-6913bf20402a4eaea3e59109db0fbea4),
licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
The original six-barrel mesh remains in `data/reference.js` as a reproducible
source and for compatibility with saved designs.

The earlier converter removed all six connected barrel components while
retaining the housing faces and atlas UVs. It normalized the lower mounting
ring, placed its center at the mounting origin, and made local +X forward and
+Y up. The heavy twin copies each chamber's original middle barrel at a radial
scale of 1.3. It has two thick barrels approximately 1.766 m in diameter and
14.107 m long, totaling 830 vertices and 600 triangles.

`stl` remains 175 TT × 2, or 350 TT. Its model and its output-based size
correction remain unchanged. The normal eight-barrel variant originally used
the same retained housing with eight narrower barrels; that exact eight-barrel
asset is now uniformly enlarged. A newly designed octuple house is not used.
The two variants therefore retain their source relationship while having
different current dimensions and usable volumes.

The twin's uncorrected native size is approximately
29.679587 × 7.842050 × 29.679456 m. This historical envelope also preserves the
generic eight-barrel density used to size unrelated weapons. Enlarging the
current `oct40` does not silently enlarge those weapons.

## Gunhouse volume and articulation

The current normal eight-barrel house provides 534.642859 m³ of conservative
usable space, defined by 24 closed cells contained within the actual housing.
These are the retained house cells enlarged with the model. The original
350 TT twin's native house cells provide 218.402382 m³ before its runtime size
correction. Barrels, drive mechanisms, open rotating-ring space, and external
supports receive no capacity.

Housing space holds charging equipment first. A standard 320 TT salvo needs
6,400 m³, so the current normal octuple requires approximately 5,865.357 m³ of
additional internal equipment. Any house portion embedded in the hull also
remains occupied hull space. It is never counted again as free space or as a
second charging bank. See [compartment accounting](turret-family-and-compartments.md).

The fixed/moving mesh partition adds articulation without changing the source
shape. Source barrel caps are retained; the converter does not invent new
recessed bores on the 40 TT barrels. Rendering, muzzle positions, picking,
mechanical limits, and line-of-fire checks share the same motion transform.

The nine-model [weapon family](turret-family-and-compartments.md) derives its
other 40 TT guns from the complete normal-octuple gun and drive components.
The 70 TT family uses the original DBY-827 source geometry and its full-length
12.87965 m barrels. The triple has the same 9.997709 m overall height as the
DBY twin. Its closed hexagonal rear house reaches maximum width at 77% of the
house length from rear to front and tapers toward the rear. A complete,
detailed 3-gun pod projects 9 m ahead of the rear house; the barrel roots are
clustered at lateral offsets of −3.2, 0, and +3.2 m. The house and forward pod
provide 5,416.385980 m³ of usable space, sufficient for the standard 210 TT
salvo's 4,200 m³ bank. Whole-mesh checks at −10°, 0°, 20°, 55°, and 85° permit
the normal −10° to +85° elevation range. The wall-only quad retains ±20° pitch
and ±65° traverse. The [current family document](turret-family-and-compartments.md)
contains dimensions, volumes, and the accepted model views.

## Regeneration and checks

```sh
python3 scripts/build-turret-family.py --check
python3 scripts/build-isd-heavy-turrets.py --check
node --test tests/isd-heavy-turret-models.cjs tests/weapon-family-models.cjs \
  tests/weapon-output-sizing.cjs tests/turret-compartment-volume.cjs
```

`build-isd-heavy-turrets.py` retains the legacy twin conversion and obtains the
current octuple from the family generator. `--json-output` exports both assets
for inspection. Metadata records source hashes, normalized frames, preserved
source vertex/face correspondence, barrel ranges, and closed gunhouse cells.
The regression checks verify the unchanged source topology and one uniform
size transform, the complete original eight-barrel geometry, and compartment
volumes contained by actual housing geometry.
