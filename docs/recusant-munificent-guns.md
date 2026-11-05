# Recusant and Munificent model-cut guns

The guns described here are cut from the supplied 3D models that the two examples are measured from:

- The Recusant: "Star Wars: The Clone Wars Recusant (S3E2 style)" by lolqeeeeeeeeee, CC BY-NC 4.0.
- The Munificent: "Munificent Class Star Frigate" by SomeGuyUsingBlender, CC BY 4.0.

Each gun keeps the model's own triangles at the ship's scale. The only processing is one rigid rotation and the
ship's uniform scale. The Munificent barrels are rebuilt with the source radius profile at a lighter tessellation, to
stay within the 5,000-triangle budget. The outputs were set by the user on 2026-11-05.

| Key | Gun | Barrels × bolt | Volley | Interval | Mount |
| --- | --- | --- | ---: | ---: | --- |
| `recProw` | Recusant prow heavy turbolaser (centre barrel of the long ventral gun) | 1 × 2,000 TT | 2 PT | 15 s | fixed, bow |
| `recTwin` | Recusant turret hanging under the nose | 2 × 360 TT | 720 TT | 15 s | traversing |
| `recKeel` | Recusant pair in the nose keel above it | 2 × 360 TT | 720 TT | 15 s | fixed, bow |
| `munBow` | Munificent bow gun: round gunhouse, two stacked barrels | 2 × 2,500 TT | 5 PT | 1.6 s | fixed, bow |
| `munTwin` | Munificent ventral twin rapid-fire cannon, 9 a side, barrels outboard | 2 × 300 GT | 600 GT | 0.2 s | traversing |

The eighteen 300 GT rapid twins retain their native turret models and placements. Its 0.2 s cycle follows the existing CIS rapid-fire gun as a gameplay setting; its geometry, placement, mass and cost are retained.

All of these are ordinary guns. They have no special charge-up, but like every gun they carry charging plant.

## Fixed mounts

A fixed mount does not turn: the ship aims it. Its forward sector counts in full when the bore line is clear of
the hull (`fixedMount` in `fireArcs`).

## Intervals

The user's rule is that the new guns fire as fast as the example's crew still fits aboard. Shorter intervals feed
the guns through conduits large enough to crowd out the crew. The thresholds below are measured with
`computeStats` habitation:

- **Recusant (15 s):** habitation is 1.005 at 15 s and 0.98 at 14 s.
- **Munificent (1.6 s):** habitation is 1.49 at 1.6 s and 0.96 at 1.5 s.

## Armament changes in the examples

### Recusant light destroyer

Only the flank guns remain: the 4 heavy turbolaser cannons, the 30 dual laser cannons and the broadside casemates.
The following are left off:

- the 6 dorsal turrets
- the 5 bow-ridge cannons
- the 60 point-defence guns

New on the flank, in the round ports of the model's textured side:

- a 34 TT ball gun in each of the eight 6 m ports along the lower side
- a ball point-defence mount in the five smaller ports above them

Both are per side.

The old ventral centre fin, which stood in for the prow gun, is replaced by the gun's keel mount. The nose keel
stops at its own underside, because the pod that hung from it is now the twin turret. The dreadnought is unchanged.

### Munificent

The 2 long-range ion cannons and the remaining flank twin turbolasers are left off. The bow gun replaces the two
forward heavy turbolaser cannons, and the 18 ventral twins replace the list's twin turbolasers.

The side plates under the shells had been measured with dips at each ventral turret. They now keep their level
between the turrets. Plates take no fittings, so the turrets hang from small mounting blocks just under them.

## Rebuilding

```sh
python3 scripts/build-recusant-guns.py --check      # source: assets/source/recusant-s3e2/
python3 scripts/build-munificent-guns.py --check    # source: assets/source/munificent/ (place the supplied model there)
node --test tests/recusant-munificent-guns.cjs
```

The Munificent source model (19 MB) is not kept in the repository. The registered asset records its SHA-256.
