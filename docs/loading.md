# Loading paths (v13 LOAD)

Where the time goes when a design is opened, flown or shown in a fleet battle, and what is cached.

## Costs (example ships)
- `buildDesign` of an example: ISD ~10–20 s, Venator ~18–30 s, Executor ~3 min (on the dev machine).
- `computeStats` (figures): since the structural-material and exposed-surface work it dominates —
  Gozanti ~85–110 s, mostly `structuralMaterial` (incremental union of every structure with the hull) and
  `surfacePatches` / `exposedSurface`. Remaining hot spots: `solidSliceSegments` once per plane over the whole
  accumulated mesh, and `solidSimplifySegments`.
- `fleetGeometry`: ~1 s for most ships; a Venator ~12 s (its sliding hangar doors make a fresh copy whose
  compartments are derived again).

## What is cached
- **Disk cache of builds** (`js/engine.js`, IndexedDB `ks-built`): per example key (`k:imperial`, `k:imperial#cis`)
  or serialized-design hash (`d:…`): the public state after build and mounting, the figures, the fleet profile and the
  serialized design. Meshes are kept as well when making them took ≥ 1.5 s on that device. Every record is stamped
  with a SHA-256 of the engine's sources (reference and model data, core, gfx, engine) read back from the HTTP
  cache, so any code or data change drops old records. Limits (provisional): builds 120 records / 60 MB, meshes
  24 / 200 MB, least recently used first. No IndexedDB / file:// / blob worker: off, everything built as before.
- A record from disk is re-derived with `syncCompartments` only (its state is already mounted); figures are taken
  from the record. `ship._rayLock` makes `remount` reuse the hull mesh and structure triangles for all its rays.
- **Lite models**: a fleet battle's units carry the examples' precomputed profiles (`data/fleet.js`), so their 3D
  models are requested with `lite:true` and the engine skips the figures; a later caller that needs them asks with
  `statsOnly`. A flown battle ship that is an example starts with the precomputed profile, its figures follow.
- **Trial of the drawing board**: the engine reuses the figures the editor already has (same design, no edit since).
- **Warm-up**: the fleet-battle setup screen prepares its sortie's models, the mission patrol panel its flagship (with
  figures) and escorts, one at a time and only while that screen is open; `fleetAsset` shares requests in flight.
- **English catalog**: `js/lang-en.js` is not a page script any more. `js/i18n.js` loads it (address from the
  page's `data-catalog`) when English is chosen or is the browser's language; in Japanese nothing is downloaded,
  compiled or walked (no DOM observer).

Tests: `tests/load-cache.cjs`.
