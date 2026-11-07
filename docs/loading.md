# Loading paths and completed ship cache

Where the time goes when a design is opened, flown or shown in a fleet battle, and what is cached.

## Costs (example ships)
- `buildDesign` of an example: ISD ~10–20 s, Venator ~18–30 s, Executor ~3 min (on the dev machine).
- `computeStats` (figures): since the structural-material and exposed-surface work it dominated (Gozanti ~85–110 s
  on the dev machine before v13 PERF). The slice index, deferred plane sections and exact rewrites of
  [figures-performance.md](figures-performance.md) cut it several-fold without changing a figure; an edit of one
  structure reuses the union of the structures before it and the patches it cannot reach.
- `fleetGeometry`: ~1 s for most ships; a Venator ~12 s (its sliding hangar doors make a fresh copy whose
  compartments are derived again).

## What is cached
- **Disk cache of builds** (`js/engine.js`, IndexedDB `ks-built`): per example key (`k:imperial`, `k:imperial#cis`)
  or serialized-design hash (`d:…`): the settled public state, native machinery/shape caches, complete statistics,
  display/catalogue projections, fleet combat profile and serialized blueprint. Canonical blueprint aliases reuse
  the original record, including its meshes. An exact input/serialized-blueprint check rejects hash collisions.
- **Completed meshes**: every generated fleet and piloted model is saved, including its typed vertex/index buffers,
  bounds, doors, S-foils, turrets and launcher metadata. There is no generation-time threshold or quarter-budget
  per-model exclusion. A warm fleet request reads the figures and completed model; it does not call
  `syncCompartments`, `remount`, `computeStats`, `fleetProfile` or `fleetGeometry`. A piloted request restores its
  native shape graph for turret-ray queries without re-deriving compartments.
- **Commit before transfer**: a build record, aliases and newly generated mesh are committed in one IndexedDB
  transaction before the Worker transfers mesh buffers or resolves the request. The stored copy therefore survives
  buffer detachment and an immediate subsequent visit. Storage failures return the ordinary completed ship with
  `cacheSaved:false`; they do not turn a successful blueprint save into an error.
- **Validity and budgets**: each record uses the SHA-256 identity of the exact startup source snapshot (reference
  and model data, core, gfx, engine). Updated calculation/render sources invalidate obsolete records. Budgets are
  120 build records / 256 MB and 64 model records / 512 MB, least recently used first. Estimates include native
  cache graphs and unique typed-array buffers. A full cache or browser eviction can require another build. Without
  IndexedDB or a verified source stamp the engine follows the ordinary build path.
- **Save preparation**: saving an editable blueprint queues background preparation of both fleet and piloted
  models for that captured blueprint, even if the editor switches designs meanwhile. Preparation does not replace
  the active trial's turret-ray context. It is skipped when persistent caching is unavailable.
- **Lite models**: a fleet battle's units carry the examples' precomputed profiles (`data/fleet.js`), so their 3D
  models are requested with `lite:true` and the engine skips the figures; a later caller that needs them asks with
  `statsOnly`. A flown battle ship that is an example starts with the precomputed profile, its figures follow.
- **Trial of the drawing board**: the engine reuses the figures the editor already has (same design, no edit since).
- **Warm-up**: the fleet-battle setup screen prepares its sortie's models, the mission patrol panel its flagship (with
  figures) and escorts, one at a time and only while that screen is open; `fleetAsset` shares requests in flight.

Tests: `tests/prepared-ship-cache.cjs`, `tests/design-save-identity.cjs`, `tests/load-cache.cjs`,
`tests/editor-worker-snapshots.cjs`, `tests/fleet-profile-refresh.cjs`, `tests/worker-geometry-bounds.cjs`.

Browser verification: `scripts/browser-prepared-ship-cache.cjs` uses an actual browser Worker, native IndexedDB,
both actual model variants and transferred buffers across a page reload. It compares complete statistics/combat
profiles and SHA-256 hashes of every mesh buffer; it does not replace storage or calculation APIs. Results are in
`docs/benchmarks/prepared-ship-cache-browser.json`. On the small structural fixture in Chromium 131, initial fleet
preparation took 293.3 ms and the reload took 33.2 ms in the Worker. These are fixture measurements, not capital-ship
timings. Save-button capture/preparation behavior is covered separately by `tests/design-save-identity.cjs`.
