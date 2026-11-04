# Irregular stacked-block equipment decks

Follow-up to #35. The new screenshot still showed long rails crossing most of
the selected face. This revision deliberately replaces that visual rhythm with
short and medium blocks, more vertical mass, and much larger fore/aft steps.

## Layout

- A seeded five-cell mix includes two short, two medium and one longer run.
  Their lengths are 26–43%, 48–68% and 73–88% of a narrower coarse cell. The
  plate starts vary independently; they need not reach either edge of the face.
- Thickness is 40–66% of row pitch, versus 10–15.5% in #35. Random vertical
  placement keeps the blocks within their cell while allowing closely stacked
  tiers with overlapping plan spans.
- Plate fronts occupy 28–98% of the recess depth, against a backing at 4%,
  instead of #35's narrow 62–98% band and 30% backing. The wider depth range
  produces distinct foreground and background blocks with broad visible tops.
- Automatic visual depth is doubled: 16% of face height, bounded to 16 m and
  32% of host depth. Explicit nonzero visual depths remain authoritative.
  Functional equipment depth, capacity, mass, power and prices are unchanged.
- Seed, host/base-face coordinates and cell indices fully determine the layout.
  Reload, semantic split/merge and cosmetic detail changes do not reshuffle it.

## Performance and isolation

The geometry remains at 18 source triangles per cell under the same bounded
face budget. Machinery still uses the shared 256 px texture and existing draw
batches. There are no new assets, network requests or per-block textures.
The length-category seed is computed once per face rather than per cell.

This is a separate branch based on main `5ea2e7e`; only the generic equipment
renderer, its tests and this report are changed. Arquitens assets, ship data,
weapon models, UI and core simulation are untouched. No merge or deployment is
authorized by this refinement request.

## Visual verification limits

The supplied screenshot and reference were inspected. Offline comparisons use
actual emitted triangles, but do not reproduce the application's texture,
shader or shadows. They are explicitly labelled as geometry-only, not app
screenshots. The local Chromium socket restriction remains unresolved, so no
actual browser appearance, FPS or full-application loading-speed claim is made.

## Measurements and tests

On the same box fixture with explicit visual depth 4 m, emitted front lengths
change from 93–102 m to 14–46 m. Median thickness changes from 1.11 m to 4.38 m;
front-to-front depth spread changes from 1.39 m to 2.73 m. With automatic visual
depth on the 100 m-tall box, depth spread is 10.94 m versus 2.77 m before. These are
measured connected facets, not feature labels. Explicit 4 m is deliberately still
shallower than automatic mode: the renderer never silently overrides that value.

| Same fixture | Total triangles before →  after | Used bytes before →  after |
| --- | ---: | ---: |
| Box | 5,463 → 6,056 (+10.9%) | 433,323 → 488,364 |
| Wedge | 1,920 → 2,141 (+11.5%) | 154,530 → 174,921 |
| Tall overlapping structure | 21,556 → 18,351 (−14.9%) | 1,880,724 → 1,581,903 |
| Broad terraces | 24,841 → 24,582 (−1.0%) | 2,056,467 → 2,028,978 |

Small designs therefore use somewhat more geometry; larger ones can use less.
This is not a blanket speedup. Raw CPU samples are retained in the benchmark
report, but concurrent work prevents treating them as isolated performance data.
All four fixtures retain saved source, native parts/fits, functional mass and cost.

The final focused suite passes 21 tests, including actual short/medium fronts,
substantial thickness/setbacks and authoritative explicit depth. Independent
review passes 44 targeted assertions and 20 seeded split/merge cases (81 rays per
state). Automatic-depth containment checks cover 40,548 emitted vertices with no
escaped host vertices. The broad 349-test run has 331 passes, 17 failures and 1 GPU
skip. All 17 failures reproduce on unchanged main (74-test subset: 57 pass, 17 fail).

A follow-up warm ABBA measurement alternated baseline/final builds in one
process after two warmups per version, with fresh deserialization before each
of eight samples per version. Median geometry generation was 27.27 → 26.83 ms
on the box and 202.73 → 186.75 ms on terraces. No large intrinsic slowdown
appeared in this limited check; shared-container contention still applies, and
these are not FPS or full-ship startup results. Both the initial raw samples and
the paired samples are retained in `docs/benchmarks/`.

A real-derived Imperial-class upper-castle fixture was also inspected using six
actual source structures. Its long rail rows are replaced by shorter thick
stepped chunks. This is not the user's saved ship or a complete application
screenshot: unrelated hull and fittings are omitted from the isolated view.
