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

`stl` remains 175 TT × 2, or 350 TT, but now uses the new angular naval gunhouse described in the [175 TT / 720 TT family](capital-turret-family.md). The historical `isd_heavy_twin` below remains archived source and a generic sizing-density anchor; it is no longer the displayed `stl` model. The normal eight-barrel asset and its dimensions remain unchanged.

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

The nine-model [weapon family](turret-family-and-compartments.md) uses the
normal-octuple barrel and machinery components together with complete circular
DBY drive assemblies for its other 40 TT guns.
The [independent photo measurements](../assets/source/turret-photo-measurements.json)
record source-image hashes, pixel landmarks and uncertainty. House dimensions,
wheel diameters and barrel lengths are read separately: the single retains its
long barrel above a taller case, the central twin uses a broad hemisphere, and
the box twin and triple use the same 22.5 m long, 13 m wide fixed outer
case, from Y0.4 m to Y11.4 m. The triple has a broad moving armored hood and
cradle connected to the cross-shaft, receiver and barrels. Its hood fills the
central opening at zero elevation. The two variants reserve different internal
mechanism space, so the usable charging rooms are about 2,360.400 m³ for the
twin and 884.709 m³ for the triple despite their identical fixed case. Display
plinths are excluded from the measurements and the generated models.

The 70 TT family uses the original DBY-827 source geometry and its full-length
12.87965 m barrels. The triple has the same 9.997709 m overall height as the
DBY twin. Its compact hexagonal rear house is 19.5 m long and 24 m wide,
with its maximum width about 69% of the way from rear to front. It has armor
belts, inspection panels and three rows of roof mechanisms. An 18 m wide,
7.5 m deep complete 3-gun pod projects ahead of it, with barrel roots at
lateral offsets of −3, 0 and +3 m. Whole-mesh
checks at −10°, 0°, 20°, 55°, and 85° permit the normal −10° to +85° elevation
range. The wall-only quad uses separate upper and lower carrier rails, a rear
bulkhead and a square moving four-gun assembly. The carrier's open side gap is
not credited as usable room. It retains ±20° pitch and ±65° traverse. The
[current family document](turret-family-and-compartments.md) contains final
dimensions, closed volumes and production-renderer comparison views.

All turret display copies now use the current normal octuple paint, including
DBY-827 and ion variants. Archived source colors and UVs remain unchanged,
as do the octuple itself and global lighting. See the [shared paint policy](capital-turret-family.md#共通塗装). Smooth analytic normals apply only to the generated hemisphere and
ion sphere; angular armor creases and source-component shading are retained.

## Regeneration and checks

```sh
python3 scripts/build-turret-family.py --check
python3 scripts/build-isd-heavy-turrets.py --check
node --test tests/isd-heavy-turret-models.cjs tests/weapon-family-models.cjs \
  tests/turret-photo-proportions.cjs tests/weapon-plain-metal-uv.cjs \
  tests/weapon-output-sizing.cjs tests/turret-compartment-volume.cjs
```

`build-isd-heavy-turrets.py` retains the legacy twin conversion and obtains the
current octuple from the family generator. `--json-output` exports both assets
for inspection. Metadata records source hashes, normalized frames, preserved
source vertex/face correspondence, barrel ranges, and closed gunhouse cells.
The regression checks verify the unchanged source topology and one uniform
size transform, the complete original eight-barrel geometry, and compartment
volumes contained by actual housing geometry.
