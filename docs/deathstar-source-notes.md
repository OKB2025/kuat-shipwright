# Death Star source measurements (2026-11-15)
Source: user upload deathstar_1_5_10_5.stl (outside the repo), sha256 a1f8083fc9e9dea893769e24150fd6ce204a6a923d7b53cdf88584dd5cb82e1c, binary STL, 586,498 triangles.
Frame: sphere centre (0.19, 0.18, 160.0) STL units, median radius 160.75 units; z is the polar axis (bbox z 0..320).
Scale: 160 km diameter / 321.5 units = 497.7 m per unit.
Dish: axis latitude +27.0 deg, longitude -174.5 deg; rim at 21 deg from the axis; flat floor within about 6 deg; depth 22.3 units (11.1 km) at the centre (radius 138.4).
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
| Reactor core | radius 10.4 km | radius 8 km, **not changed**: at 10.4 km the reactor's power and waste heat double |
| Amplifier bulb | 11.6 km to 29.4 km, 4.4 km at its widest | the same |
| Neck | 29.4 km to 33.5 km, 2 km in radius | the same |
| Works between neck and housing | 33.5 km to 52.7 km, growing to 9.4 km in radius | three steps: 5.2, 7.2 and 9.4 km |
| Housing behind the dish | begins 52.7 km out, as wide as the dish | begins 52.7 km out, to the dish rim less 300 m; its back stands on the floor of the wide well |
| Dish floor | 69.2 km out | 68.9 km (the STL's value; the STL governs the outside) |
| Dish | a cone, 22 km in radius, 23° above the equator | the STL's dish: 27.4 km in radius (rim 20° from its axis), 27°, its section measured (below) |
| Column through the poles | about 13 km in radius above the core, narrower below | reactant silos: 12 km × 46 km above, 8 km × 40 km below |

Wells: only the housing has one (as wide as the dish, from 52.7 km out; the hole the station shows without its
superlaser). The stepped works, the neck and the bulb are embedded in the station's structure, as on the drawing;
an earlier version gave them wells of their own (up to 4.6 km wider than the body), which left the weapon touching
nothing. Known difference kept: a 300 m ring between the housing and the wall of its well, down to the well's floor
(not on the STL or the drawing; it lets the part be taken out and put back).

The superlaser's body is made in its own frame (the dish axis along x) and pitched up 27°, so the weapon's axis is
the dish axis. Before this the body had no rotation and the beam left level, along the station's x.

### Skin

The station's paint is `station` (`ship.paint`, also offered in the designer's 外板スキン list). The mesh shader draws it
on the outer skin of the sphere whose centre and radius follow from the hull length: rows of plating blocks nine
degrees of latitude high, a different number of blocks in each row, lighter lanes between, each block divided
again into panels, and window lights on some blocks. Faces under the skin that look outward (the dish, the trench
floor) carry rings of equal depth. On the skin the shader shades with the sphere's own normal, so the 40 × 16
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
| Dish, 0..6° from its axis | +4; −400..+262 | +10; −358..+336 |
| Dish, 6..12° | −269; −1049..+471 | +12; −761..+580 |
| Dish, 12..20° | −1079; −2012..−339 | +119; −850..+862 |
| Dish rim zone, 20..22° | −140; −739..+314 | +100; −248..+449 |
| Equatorial trench floor | −262; −626..−235 | the same |
| Equatorial trench width (more than 1.6 km below the sphere) | example 1.79 km, STL 2.21 km (−0.90°..+0.68°) | the same |

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
  places. The 274 guns stand on the plain surface. To be put right with the baking of cuts (handoff §4.2), when the
  station's cuts are rebuilt anyway.
- The two hemispheres are half-ellipsoids (base radius 79,995 m, height 79,100 m), not parts of one sphere: that is
  how the 1.8 km equatorial gap is made from two dome structures. The skin is a median 140 m outside the STL.
- The equatorial trench is 0.4 km narrower than the STL's and its floor about 260 m lower (the STL's trench is not
  symmetric about the equator).
- A 300 m ring between the superlaser's housing and its well (above).
