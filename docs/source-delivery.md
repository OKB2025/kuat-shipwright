# Reload-safe source delivery

The public site was serving the exact `#37` renderer bytes on 4 November 2026.
The bootstrap nevertheless used unversioned sources with the default HTTP
cache policy, and the file worker fetched its own copies. GitHub Pages serves
these files with `Cache-Control: max-age=600`, so a refreshed page could continue
using an older renderer. Its persistent-build fingerprint also refetched source
URLs with `force-cache` rather than identifying the bytes actually executed.
This is a confirmed delivery risk, not proof of the user's particular browser
cache state. There is no service worker or active embedded renderer bundle.

## Startup contract

- Fetch each `KS_FILES` data/code source once with `cache: 'no-cache'`. This requests
  conditional revalidation; it does **not** mean `no-store`. Unchanged responses
  can reuse cached bytes through HTTP 304 responses.
- Run those exact Blob objects in the page, and compose the background worker
  from the same reference/model/core/gfx/engine blobs. The worker no longer
  separately imports the unversioned `worker.js` dependencies.
- Hash the actual startup snapshot once. Give its identity to both engines
  before they execute. Persistent build/mesh records use this identity without
  another network fetch. Changed source bytes invalidate old derived records;
  unchanged bytes keep warm-cache reuse. Saved ships are not deleted or reset.
- If workers are unavailable or `?inline` is selected, run the verified page
  snapshot inline and keep the same persistent-cache identity.
- Without fetch, after a fetch failure, or when page Blob scripts are refused,
  use the existing plain-script compatibility path. HTTP script fallbacks get
  one fresh per-load query token. They run inline, any already-started snapshot
  worker is retired, and persistent caching is disabled for that session because
  the actual executed source identity is no longer verifiable. This uncommon
  path can download extra bytes. `file://` script paths are unchanged.
- If SHA-256 is unavailable, rendering still works and persistent caching is
  disabled. No forced page reload or user-data purge is used.

## Static Pages and future merges

No generated hash manifest, hashed source copies, build step, GitHub Actions
workflow, or Pages setting is required. Source changes are detected at runtime.
The `KS_FILES` declaration, language catalog URLs and its progress-size metadata
are not modified. Missing or stale size metadata cannot disable revalidation.
Independent source changes such as `#36` therefore do not require regeneration.
A page already open before an update still needs a normal reload to execute new
code; this change does not hot-swap code inside an active design session. The
first release also needs the browser to fetch the updated HTML bootstrap: an
already-cached old HTML document cannot gain this behavior by itself. A hard
reload or a fresh document URL can establish that first update without deleting
saved designs; subsequent launches use the new source revalidation contract.

## Verification

Run:

```
node --test tests/source-delivery.cjs tests/load-cache.cjs
```

The delivery test executes the actual HTML bootstrap in a browser-like VM with
an old cached renderer and current server responses. It verifies revalidation,
ordered page execution, exact worker/page byte parity, stable/changed source
identities, missing size metadata, worker rejection, inline mode, streaming and
non-streaming fetches, script/fetch failure, an already-started worker being
retired, `file://`, and missing cryptography. The cache suite executes the real
engine against an IndexedDB test double, including a gfx-only identity change
and preserving records when startup identity is unavailable.

These are deterministic runtime-contract tests, not a claim of actual browser
GPU, network-304, or FPS verification.
