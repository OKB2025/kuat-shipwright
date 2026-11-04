# Dense equipment blocks and reliable source loading

The post-#37 screenshot still read as shelves. Investigation found two separate issues; neither a fetched JavaScript file nor isolated shape assertions alone verified the user's on-screen result.

## Geometry

#37's block fronts covered only about 28–30% of the two relevant forward Imperial castle faces. The remaining textured wall dominated the facade. The new arrangement uses a narrower cell aspect ratio, thicker blocks (78–96% of vertical pitch), short/medium/long width bands, and smaller vertical gaps. Deterministic fore/aft offsets and longitudinal shifts remain. Machinery still uses the existing small shared texture, without extra assets or draw batches.

Functional equipment depth, capacity, power, costs, IDs and saved designs are unchanged. Explicit visual depth remains authoritative. Host clipping, openings, semantic splits, reload determinism and ownership are preserved.

## Loading

Live #37 source bytes matched its commit. However, unversioned source requests allowed ten-minute HTTP caching, the worker loaded a separate set of files, and persistent geometry identity was computed from force-cache reads. This is a confirmed stale/mixed-source risk, not proof of the user's particular browser state.

The new bootstrap conditionally revalidates each source once and shares its exact bytes between the page and worker. Persistent-cache identity is derived from those bytes. Existing design saves are not cleared. See [source delivery](source-delivery.md) for fallback behavior and initial-document caveats.

## Verification and limits

- Integrated focused suite: 79/79 passed (delivery, persistent cache, geometry, editing, saving, projections and boundaries).
- Independent source-loading review: no blocker; the actual concatenated worker emitted `ready`.
- Containment: 44,493 emitted vertices checked in three synthetic shapes, zero outside-host vertices; source design unchanged.
- Three additional surface-worker UI test failures reproduce on unchanged main (missing `engineSelectionDrivers` fixture); not caused by this patch.
- Paired warm geometry CPU measurements and all samples are in [benchmark data](benchmarks/dense-deck-performance.json). Box median 29.91→31.32 ms; terraces 174.31→210.54 ms, on a shared CPU with concurrent verification. These are not browser FPS or app-load timings. Box triangles 6,056→6,979; terraces 24,582→24,185. Increased visual density is not a universal performance improvement.
- Real browser/WebGL verification remains unavailable in this executor. Offline previews show actual emitted geometry, not app shader/texture/shadow appearance or the user's saved blueprint. The user's precise cached/unsaved state is unknown.

No merge or deployment is included in this revision.

## Offline comparison of actual Imperial geometry

These are CPU renders of emitted geometry for the same forward castle faces configured with functional depth 1 m and automatic visual depth. They omit app textures, shaders, shadows and weapons, and are not screenshots of the user's saved blueprint.

- [Before: #37 front view](images/decks-37-front-offline.png)
- [After: dense front view](images/dense-decks-front-offline.png)
- [After: dense oblique view](images/dense-decks-oblique-offline.png)

Broad blank roof caps above the configured faces remain ordinary armor structures. They are not the generated equipment decks.

Measured actual emitted forward-face block coverage increased from 27.89% to 61.08% (p1) and 29.64% to 63.47% (p6). Median non-sliver connected front heights increased from 5.49 to 8.67 m and 5.33 to 8.60 m, respectively. Short/medium widths remain varied. Surface batches increased from 5,420 to 6,382 triangles (+17.75%) and used typed-array bytes from 639,672 to 754,968 (+18.02%); unchanged hull/structure batches are excluded. See [Imperial geometry metrics](benchmarks/dense-deck-imperial.json).

A repeat paired CPU run measured box 38.98→38.10 ms and terraces 234.29→253.35 ms (+8.1%). Both runs are retained rather than selecting only the faster sample: [repeat data](benchmarks/dense-deck-performance-repeat.json). Shared-host timing varies; the denser appearance carries some geometry/CPU cost.

Optional all-vertical-face whole-Imperial exports exceeded Node's default ~2 GB heap limit for both #37 and this revision. They were stopped. The completed paired two-forward-face geometry checks remain valid; this is not a full-ship browser memory benchmark.

The Imperial pair uses density 0 to isolate the block shape. All 17,736 checked new non-lamp surface-device vertices remain inside their original hosts (108 lamp vertices excluded from that check). This supplements, rather than replaces, the synthetic containment test above.
