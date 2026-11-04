# Thin deck equipment surfaces

The equipment facade now reads as overlapping thin deck edges with recessed
machinery bays, following the supplied stacked-deck references. It replaces the
previous upright cabinet and nested-fin terrain, without changing the equipment
configuration, functional capacity, costs, reservations, targeting, or save schema.

## Rendering

- The deck silhouette is real face-aligned geometry. Narrow outer lips alternate
  with broad recessed bays; neighboring segments vary their projection while
  sharing exact endpoints. Sloped faces use the existing local surface frame.
- Machinery detail is a shared deterministic 256×256 neutral texture containing
  cabinets, grilles and service conduits. It is generated once at renderer startup,
  mipmapped, and uses no external image requests. The black emissive texture is
  only 2×2. The incremental GPU texture cost is about 0.33 MiB with mipmaps.
- Byte 250 selects the textured machinery material; byte 249 keeps deck edges,
  sparse round attachments and functional markings plain. Existing armor, solar
  and service-light flags retain their separate behavior. Equipment textures use
  the base-face tangent coordinates, including bow/stern and tilted faces.
- The coarse grid is bounded per base face. At most ten source triangles per cell
  replace the previous 18-triangle grid plus nested motifs. Existing clipping can
  subdivide these triangles at openings and visible host boundaries.
- A few low-poly round housings, turbines and walks remain on deck shoulders.
  Their existing bounded attachment budgets and owner ranges remain intact.

## Compatibility

The visual change is confined to `js/gfx.js` plus rendering tests and this report.
It does not edit the weapon catalog, UI, core simulation, worker, or ship data.
PR #32's weapon-consolidation files are not modified. The engine/price work is
not rebased, reset, or overwritten. This branch must not be merged or deployed
without the user's separate approval.

The clipping, semantic split/merge, host containment, rounded attachment ranges,
foil ownership, caching and serialization tests remain the acceptance criteria.
One old aesthetic test requiring upright cabinet masses is intentionally replaced
by checks of actual thin ledge depth, repeated bands and textured bay coverage.

## Verification and limits

The final profile passes 44 focused surface/armor/ownership tests on main
`36c18a9`, and another 9 surface-model tests. Applied in an isolated checkout of
PR #32 (`dd9ef12`), 76 surface, weapon-model/migration and save tests pass. The
patch applies cleanly to both refs. No branch belonging to that work was changed.

The final broad rendering/surface run completed 321 passes, 9 failures and one
skipped GPU test (331 tests). All nine failures also reproduce on the unchanged
baseline.

A full regression run during development completed 924 passes, 16 failures and
one skipped GPU test. Thirteen failures reproduce on the unchanged baseline
(UI harness, historical equipment/weapon fixtures and a symmetry fixture); one
new deck aesthetic assertion was corrected and passes on the final profile.
Two craft test files aborted under the concurrent run and are not claimed as
passes. This is not an all-green full-suite claim.

Actual Chromium/WebGL validation is still pending: the local browser cannot
create its required sockets. The separate browser cannot reach the executor's
HTTP preview, and file URLs are unsupported. Geometry-only CPU previews were
inspected, including a box and six-part terraces; these show actual generated
triangles, not the application shader, textures, shadows or editor UI. No GPU
frame-rate, full application loading-speed or final texture appearance claim
is made. The Canvas2D compatibility renderer retains plain shaded bays.

Reproduce geometry measurements without changing saved designs:

```
node scripts/benchmark-thin-decks.cjs /path/to/source /tmp/deck-metrics.json
```

The runner reports script initialization and fresh-deserialized mesh generation
samples, used geometry bytes and functional invariants. Measurements taken while
other tests were active are not reliable evidence of an elapsed-time speedup.
The shared texture adds about 0.33 MiB once, so a small single-face design can use
more total GPU memory even while its geometry becomes smaller; multi-face designs
amortize that shared texture cost.

Final same-fixture results (baseline `a18dece`; counts include actual clipping):

| Fixture | Machinery triangles, before → after | Used mesh bytes, before → after |
| --- | ---: | ---: |
| Box, 2 faces | 8,215 → 5,080 (−38.2%) | 718,635 → 428,646 |
| Wedge, 1 face | 2,849 → 1,885 (−33.8%) | 244,416 → 154,926 |
| Tall overlap stress, 17 faces | 30,037 → 25,581 (−14.8%) | 2,913,702 → 2,503,236 |
| Broad terraces, 17 faces | 35,060 → 23,486 (−33.0%) | 3,213,522 → 2,141,946 |

Used buffers count 27 bytes per vertex (Float32 position/UV, Int8 normal,
Uint8 color) and 4 bytes per index, excluding spare allocation and shared textures.
Fixture hashes, unchanged saved source and functional checks are recorded in
`docs/benchmarks/thin-deck-equipment.json`.
