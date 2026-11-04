# Staggered equipment decks

Follow-up to #33, based on the supplied reference and the current Allegiance
screenshot. This replaces continuous, equally spaced rails with longer separate
plates. Machinery remains a shared texture between the decks.

## Shape

- Plate thickness is 10–15.5% of the local row pitch, versus the previous 4% lip.
- Each plate has a seeded length, longitudinal start, vertical level and normal
  setback. Neighboring levels overlap in plan while their leading edges sit at
  different depths. The main flat face stays horizontal in the host's local
  surface frame rather than becoming a long slanted connecting rail.
- Long spans cover 88–97% of a coarse cell. Gaps are narrow and irregular, avoiding
  the short disconnected-bar appearance of the first experiment.
- Top, bottom and end faces are actual shallow bevel geometry. The surrounding
  recessed machinery plane is clipped to the same holes and host envelope.
- Randomness is keyed by the saved style seed and base face. Reloading and
  semantic split/merge do not move the plates. No new saved fields are introduced.

## Cost and independence

Each cell has at most 18 source triangles, with a coarser shared face budget
than #33. Machinery uses the same 256px atlas, the same draw batches and the same
material flags. No new image downloads or per-plate meshes/textures are added.
The simulation, capacity, power, prices and functional IDs are unchanged.

The branch starts at main `63be541`. Production edits are only in `js/gfx.js`;
Arquitens ship data, model assets, UI and simulation are not edited. Ongoing
Arquitens work is neither reset nor rebased. No merge or deployment is authorized
by this revision request.

## Validation limits

Actual browser rendering remains unverified in this executor: Chromium's required
socket access is blocked, and the separate browser cannot reach the local HTTP
preview. Offline previews rasterize the actual emitted triangles but omit the
application's texture/shader/shadow appearance. They are not app screenshots.
Geometry counts are measured; no FPS or full-app loading speedup is claimed.

## Measured comparison with #33

The same four saved fixtures were measured on main `63be541` and this revision.
Counts below include the emitted scene geometry, not only the deck surfaces.

| Fixture | Triangles before → after | Used bytes before → after |
| --- | ---: | ---: |
| Box | 5,422 → 5,463 (+0.8%) | 428,646 → 433,323 |
| Wedge | 1,926 → 1,920 (−0.3%) | 154,926 → 154,530 |
| Tall overlap stress | 28,252 → 21,556 (−23.7%) | 2,503,236 → 1,880,724 |
| Broad terraces | 25,770 → 24,841 (−3.6%) | 2,141,946 → 2,056,467 |

All four fixtures preserve mass, cost and saved source. The box fixture's actual
plate thickness is 0.884–1.322 m, up from 0.351 m; differences in plate levels,
ends and setbacks are measured from emitted triangles, not feature metadata.

Twenty independent split/merge cases cover five seeds, both split axes and two
budgets, each sampled by 81 rays. Maximum split difference was 0.0000321 m;
merge restored the original heights exactly. The focused renderer/projection
suite passes 20 tests, including the new thick/staggered/reload acceptance test.

Independent review passes 34 targeted tests. The broad surface, armor, save,
engine geometry/power and load-cache run has 348 tests: 330 pass, 17 fail,
1 GPU test skipped. All 17 failures reproduce on unchanged main `63be541`
(74-test baseline subset: 57 pass, 17 fail). This is not an all-green suite claim;
none of these unrelated core/UI baseline failures is changed in this branch.
