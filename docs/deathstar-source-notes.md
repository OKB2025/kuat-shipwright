# Death Star source measurements (2026-11-15)
Source: user upload deathstar_1_5_10_5.stl (outside the repo), sha256 a1f8083fc9e9dea893769e24150fd6ce204a6a923d7b53cdf88584dd5cb82e1c, binary STL, 586,498 triangles.
Frame: sphere centre (0.19, 0.18, 160.0) STL units, median radius 160.75 units; z is the polar axis (bbox z 0..320).
Scale: 160 km diameter / 321.5 units = 497.7 m per unit.
Dish: axis latitude +27.0 deg, longitude -174.5 deg; depth 22.3 units (11.1 km) at the centre (radius 138.4). First reading (superseded by the section measured below): rim at 21 deg from the axis, flat floor within about 6 deg. Measured section: rim at 20 deg, level to about 2 deg, then close to a cone.
Equatorial trench: |latitude| <= about 0.6 deg (about 3.6 units = 1.8 km wide), 6.4 units (3.2 km) deep (radius 154.3).
Surface relief: about +-1 unit. No meridian trenches in the STL (the user asks for several, fighter-sized: an explicit addition).

## Further references supplied by the user (2026-11-15, second set)

None of these files is in the repository; the hashes identify the uploads.

| Use (user's words) | File | sha256 | What was taken from it |
| --- | --- | --- | --- |
| 「断面は写真」 | cutaway drawing, 550 × 550 px (`IMG_7162.webp`) | not recorded (image pasted into the session) | proportions of the superlaser and the polar column, below |
| 「スキンはGLB」 | `death_star_-_star_wars.glb` (Sketchfab, SebastianSosnowski, **CC BY-NC-ND 4.0**) | `21894740…370b58f` | looked at only; see "Skin" |
| 「エフェクトは動画」 | three screen recordings of film scenes (`.mov`, 3.7 s, 4.8 s, 6.3 s) | `0afe4ead…`, `ef3d3586…`, `be9ba191…` | looked at only; see "Firing effect". The sound track is not used |
| shape (as before) | `deathstar_1_5_10_5.stl` | `a1f8083f…1e1c` (same file as the first upload) | sphere, dish, equatorial trench |

### Cutaway drawing

Scale: the sphere is 540 px across, so 296 m a pixel at 160 km. Distances are along the dish axis from the centre.

| Feature on the drawing | Measured | In the example |
| --- | --- | --- |
| Reactor core | radius 10.4 km | radius 8 km, **not changed**: at 10.4 km the reactor's power and waste heat double. Approved by the user, 2026-11-15:「反応炉はそのままで」 |
| Amplifier bulb | 11.6 km to 29.4 km, 4.4 km at its widest | the same |
| Neck | 29.4 km to 33.5 km, 2 km in radius | the same |
| Works between neck and housing | 33.5 km to 52.7 km, growing to 9.4 km in radius | three steps: 5.2, 7.2 and 9.4 km |
| Housing behind the dish | begins 52.7 km out, as wide as the dish | begins 52.7 km out, as wide as the dish; it fills its well (back on the well's floor, side against its wall) |
| Dish floor | 69.2 km out | 68.9 km (the STL's value; the STL governs the outside) |
| Dish | a cone, 22 km in radius, 23° above the equator | the STL's dish: 27.4 km in radius (rim 20° from its axis), 27°, its section measured (below) |
| Column through the poles | about 13 km in radius above the core, narrower below (radius read by eye; the ends were not measured) | reactant silos: 12 km × 46 km above, 8 km × 40 km below (lengths set by eye) |

Wells: only the housing has one (as wide as the dish, from 52.7 km out; the hole the station shows without its
superlaser). The stepped works, the neck and the bulb are embedded in the station's structure, as on the drawing;
an earlier version gave them wells of their own (up to 4.6 km wider than the body), which left the weapon touching
nothing. A 300 m ring was at first left between the housing and the wall of its well; it was on neither the STL nor
the drawing and was removed (reference review): the housing fills its well.

The superlaser's body is made in its own frame (the dish axis along x) and pitched up 27°, so the weapon's axis is
the dish axis. Before this the body had no rotation and the beam left level, along the station's x.

### Skin

The station's paint is `station` (`ship.paint`, also offered in the designer's 外板スキン list). The mesh shader draws it
on the outer skin of the sphere whose centre and radius follow from the hull length: rows of plating blocks nine
degrees of latitude high, a different number of blocks in each row, lighter lanes between, each block divided
again into panels, and window lights on some blocks. Faces under the skin that look outward (the dish, the trench
floor) carry rings of equal depth. On the skin the shader shades with the sphere's own normal, so the
facets of the two domes no longer show (the outline is still a polygon).

The pattern was written for this game. No texture, mesh or other data from the GLB is in the repository; its
licence does not allow derivatives.

### Firing effect

After the first recording: eight green tributary beams leave emitters round the inside of the dish one after
another (0.09 s apart), meet at the focus in front of the dish, the focus swells, and after one second the main beam
leaves the focus. `slaserFx` in `js/app.js` gives the timing; the trial view draws it (`swFxPoints`,
`trialSwBeamLines`), the fleet map draws a green line with a fan at the firing ship. The sound `superlaser` is
synthesized.

The full shot on a planet, after the third recording (trial flight only, no battle): a beam that meets the planet
with no ship before it holds on the surface for 1.2 s, then the planet flashes white, a fireball swells from it, a
bright ring runs out across the beam's line and glowing debris flies apart (`planetBlastPoints`). The planet is
far beyond the view's far plane, so each sprite is drawn nearer on its own line of sight, reduced in proportion.
The planet stays destroyed until the flight is restarted.

Not built yet: the strike of the 2 ZT ship setting on a planet's surface (the second recording).

## Comparison with the STL (2026-11-15)

Cutaway drawing used above: `180f8226-image.webp`, sha256 `bafd47de1fbda64be589378e5a4e63ed0ad833605c7171679fdf5dfb56df72d2` (the upload of `IMG_7162.webp`).

Tools: `scripts/stl-check/deathstar_compare.py` and `scripts/stl-check/deathstar_rays.cjs` (usage in the Python
file). Both sides give the distance of the first surface from the station's centre along the same directions: the
example from its carved structures and the superlaser's body, the STL from its triangles. Sets: the section through
the poles and the dish axis (0.25° steps), sixteen azimuths about the dish axis (0.5° steps out to 24°), a section
across the equatorial trench (0.02° steps), and a 4° grid over the sphere. Output of the runs of this session:
`/tmp/ks-verify/20261115-stlcmp2` (before the changes below) and `/tmp/ks-verify/20261115-stlcmp4` (after); these
directories are not kept.

Example minus STL, in metres (median; 5%..95%):

| Zone | Before | After |
| --- | --- | --- |
| Skin, 4° grid (outside the dish, off the equator) | −70; −882..+373 (6 samples beyond 1.5 km) | +140; −220..+496 (none beyond 1.5 km) |
| Skin along the section through the poles and the dish axis | +37; −1043..+451 | +155; −206..+480 |
| Dish, 0..6° from its axis | +4; −400..+262 | +10; −358..+336 |
| Dish, 6..12° | −269; −1049..+471 | +12; −761..+580 |
| Dish, 12..20° | −1079; −2012..−339 | +119; −850..+862 |
| Dish rim zone, 20..22° | −140; −739..+314 | +100; −248..+449 |
| Just outside the rim, 22..24° | +19; −276..+439 | +144; −104..+547 |
| Equatorial trench floor | −262; −626..−235 | the same |
| Skin beside the equatorial trench, 1..3° | +84; −56..+337 | +306; +175..+554 |
| Equatorial trench width (more than 1.6 km below the sphere) | example 1.79 km, STL 2.21 km (−0.90°..+0.68°) | the same |

Three zones moved outward (the section's skin, just outside the rim, beside the trench): with the finer domes the
surface follows the half-ellipsoid, which stands up to 185 m outside the sphere, where the coarse facets had lain
inside it. The spread (5%..95%) is narrower in each of them. No tolerance was fixed before the comparison; the
figures are given as measured.

The STL's own relief is about ±0.5 km (one unit), which is the spread that remains.

What was changed after the first comparison:

- **Dish section.** The STL's dish is not a spherical bowl: its rim is 20° from the axis (the earlier 21° was a
  coarse reading), the floor is level to about 2° and it then rises close to a cone. The example's bowl now follows
  the medians of the sixteen azimuths (`DS.dish` in `js/core.js`): 0° 68,901 m, 2° 68,988, 4° 69,280, 6° 69,758,
  8° 70,191, 10° 71,445, 12° 72,568, 14° 74,282, 16° 76,339, 18° 77,556, 19° 78,899, 20° 80,000 (distance from the
  centre). The dish is 54.72 km across; the superlaser's 53 ZT is tied to that diameter (`SW_COMBAT.slaser.refD`,
  was 57.4 km).
- **Polar caps.** The dome form had 40 sides and 16 levels at equal heights, so its last level ran 20° to the pole
  and lay up to 1.3 km under the STL. A dome larger than any part of an ordinary ship (30 km) now has 96 sides and
  32 levels at equal angles (`structTriangles`); ordinary domes are unchanged.

Known differences that remain:

- **Meridian trenches (the user's addition, not on the STL) are mostly not there.** Measured on the carved
  hemispheres before the tessellation change: the surface on a trench's meridian and 0.12° beside it differed by
  0.0–0.2 m at latitudes 5°–50° and 70°, and by 84 m at 60° only (`/tmp/ks-verify/20261115-ds2/meridian2.log`). The
  trench is a torus about the true sphere (radii 79,880–80,000 m); the hemispheres are half-ellipsoids standing
  900 m off the centre (up to +185 m outside the sphere at mid latitudes), so the torus meets the surface in few
  places. The 276 guns (138 heavy turbolasers, 138 point defence; an earlier count of 274 was from PR #110) stand on the plain surface. User decision 2026-11-15:「作例の説明文はそのままで焼き込みの時に直す」:
  the example's note keeps "子午線トレンチ 8 本（幅 120 m）" and the trenches are put right when the cuts are baked
  (handoff §4.2). Baking alone does not make them appear: the cut has to follow the hemispheres' actual surface (a
  ring on the half-ellipsoid's meridian for each hemisphere, or hemispheres on the true sphere), and the guns and
  the exhaust port are to be set in the trench then.
- The two hemispheres are half-ellipsoids (base radius 79,995 m, height 79,100 m), not parts of one sphere: that is
  how the 1.8 km equatorial gap is made from two dome structures. The skin is a median 140 m outside the STL.
- The equatorial trench is 0.4 km narrower than the STL's and its floor about 260 m lower (the STL's trench is not
  symmetric about the equator).

## Evidence gathered on the final design (2026-11-15)

Stored design `data/examples/deathstar/design.json.gz`, sha256 `4cf18ae2126bfdc6…12ab3fbe`, at commit `02a9add`.

- **Same shape stored, loaded again and built afresh.** `scripts/stl-check/deathstar_rays.cjs` with `KS_SOURCE`
  `stored`, `roundtrip` (the stored design saved and loaded once more) and `build` (`Core.buildDesign`): over the
  6,485 directions of the comparison the largest difference is 0.000000 m and no direction changes between a hit
  and a miss.
- **STL comparison repeated on this design** (after the 300 m ring was removed): the figures of the table above
  are unchanged.
- **Section through the poles and the dish axis**, `scripts/stl-check/deathstar_section.cjs` (each 400 m cell
  classified by `Core.inPart` and the carved structures): `docs/handoff-2026-11-15/evidence/deathstar-section.png`
  and `deathstar-section-without-superlaser.png` (blue structure, red superlaser, pink reactor, violet reactant
  silos, green other equipment, black space). Beside the user's cutaway drawing the bulb, the neck, the three
  steps, the housing and the dish lie in the same order and proportions, the silos stand on the polar axis above
  and below the core, and without the superlaser the housing's well is the only hole. The drawing itself is not in
  the repository.
- **Parts of the stored design** (224): 2 dome and 1 cylinder structures, 1 reactor, 2 reactant silos, 1 superlaser
  (with a weapon body), 5 engines, 5 engine cores, 6 hangars, 1 command room, 2 shield generators, 1 hyperdrive,
  13 heat converters, 7 inertial and 134 integrity units, 43 pumps; fittings: 138 heavy turbolasers and 138 point
  defence mounts; cuts: 1 cylinder (the housing's well) and 4 torus (the meridian trenches). Every part kind is in
  `Core.PARTS`; no part has the form `reference` or `mesh` or a skin asset.
- **The superlaser's weapon body** is a body of revolution made from the measured rows (no triangle of the STL),
  held on the part as `weaponBody`, the way the Onager's beam is. That the dish and the works down to the core are
  one weapon part is the user's decision (2026-11-15:「スーパーレーザーはレンズの皿の部分、中心に繋がる構造物も含めて武装扱い」,
  「皿をスーパーレーザーの部品として外見に出る部分に」). Its section cannot be edited in the designer, only its size.
- **Browser, Worker mode, no page error** (screens under `/tmp/ks-verify/20261115-final`, not kept): the designer
  with the superlaser taken out shows the well as an open hole; the trial flight fires (tributaries, focus, main
  beam) with the skin drawn; the planet shot destroys the planet.

## The heat shortfall in combat: cause (2026-11-15, corrected)

The designer showed about 1.24e30 W of waste heat in combat against 1.14e30 W of converters. A first reading put
this on the wiring loss; that was wrong (physics review, third round). The design statistics (`heatStats`,
`heatLoads`) estimated a superweapon's charging draw as its share of the reactor (0.6 × 1.12e31 W) and counted
12% of that, 8.09e29 W, as charging heat. The superlaser actually charges at `chargeW`, 2.9e27 W (a full charge
takes 24 hours), which the battle and the converter sizing use. The statistics now take the smaller of the two
(`swDraw`); for the Onager's and the Subjugator's beams, which charge at their share, nothing changes.

After the change, combat preset: 4.1e29 W of heat (of which the wiring loss is 2.9e29 W) against 1.14e30 W of
converters, which the systems refit sized for the full shot's firing loss (7.39e29 W, counted in the battle, not in
the design's presets). No shortfall is shown. The wiring loss is still left out of the refit's sizing (it counts
only the propulsion feed); that is now a margin question, not a shortfall, and is noted for the full regeneration.

## Known differences found in the third reference review (2026-11-15)

- **Poles.** The STL's z range is 0..320 units, so its polar radius is 160 units against a median radius of 160.75:
  the model is about 370 m flatter at the poles than the example (which is 80,000 m there). Shown as the flat
  +380 m bands near 90° and 270° of `section-diff.png`. Not reproduced.
- **Equatorial trench.** Measured on the STL at seven longitudes away from the dish (61°..314°, 0.02° steps; more
  than 1.6 km below the local skin): width 1.68..2.01 km, median 1.98 km; centre 0.00..0.11° south, median 0.10°
  south; floor 76,847..76,939 m from the centre, median 76,854 m (depth below the local skin 2.76..2.83 km). The
  example had 1.8 km and its floor at 76,800 m, from the first, coarse reading (the single section at 93.3° that
  gave 2.21 km took its edges from a looser threshold). Put right: width 1.98 km and floor at 76,850 m. The centre
  stays on the equator (0.1°, 140 m, kept so that the two hemispheres stay equal).
- **Tolerances.** None were fixed before the comparison. Whether the measured differences are accepted is the
  user's decision; until then referenceShape stays unverified.
