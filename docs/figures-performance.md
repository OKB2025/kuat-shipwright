# Design figures: speed (v13 PERF)

`Core.computeStats` (the design figures every designer open, trial without a cached record and fleet build of a
custom design waits for) became 10–50× slower when the structural-material and exposed-surface systems landed.
The time is in three passes over the same geometry:

- `structuralMaterial`: the incremental union of every structure with the hull. Each join clips the accumulated
  boundary against the new solid and the solid against the boundary; every distinct triangle plane is sliced
  (`solidSliceSegments` → `solidSimplifySegments`) through the other mesh.
- `surfacePatches` / `exposedSurface`: each patch triangle's plane is sliced through every occluding mesh whose box
  it crosses.
- `structuralCoincidentTriangles`: coplanar sheets of earlier structures (cheap since the coplanar bins).

The model and its results are unchanged: `tests/example-figures-regression.cjs` compares the full figures of every
example ship (mass, volumes, materials, surfaces and armour, power and heat ledger, propulsion, warnings, …) with
digests recorded from `origin/main` 7a63e61 before these changes, within a relative tolerance of 1e-9. All of the
changes below reproduce the former arithmetic exactly; the digests match bit for bit on all 39 buildable examples.

## What changed (`js/core.js`)

1. **Slice index** (`solidSliceIndex`). Boxes over runs of 16 consecutive triangles in a binary tree, per immutable
   typed mesh. A slice skips runs lying wholly on one side of the plane (margin 1e-10 of the coordinates, far above
   the rounding of the vertex distances) or outside the asked u-range, and walks the rest in their original order.
2. **Allocation-free slicing and merging** (`solidSliceSegments`, `solidSimplifyFlat`). The same operations in
   scalars into a flat buffer; points merged on the same rounded grid through an open-addressing table; neighbour
   lists keep the Set's insertion order, so queue, merges and output order are unchanged.
3. **Deferred sections** (`surfaceFarVerdict`). Most triangles of a solid lie well inside or well outside the other
   surface. Against a mesh of 256 triangles or more (structures) and for every occluder (surfaces) a plane's full
   section is made only when one of its triangles comes near. For the others the section is sliced only over the
   triangle's u-range: if no edge comes within 1000 eps of it, the full computation would keep it whole or drop it
   whole, decided by the even-odd count of edges below it in every gap between edge ends (all gaps must agree and
   every count be even; otherwise, and for thin triangles, the full section is made as before). An occluder whose
   box misses the triangle's box is skipped. In the Gozanti about three quarters of the planes never need their
   full section.
4. **Smaller exact rewrites**: per-triangle reduction of the section edges to those over the triangle in
   `surfaceExposeTriangle`, a sorted sweep in `surfaceExposureCrossings`, numeric keys in the coplanar bins,
   scalar `structuralMeshVolume`.
5. **Builtins as locals** at the top of Core, Galaxy, Rts and Ground. In Node's vm contexts (the tests and the
   data scripts) every free global lookup goes through the context's interceptor, about ten times slower than the
   arithmetic around it; in a page or worker these are the same objects.

## Timings

See the report in the PR / branch notes for the per-example table (Node vm as the tests run it, Node main context as
a browser worker runs it) and the browser loading paths.

## Remaining

The first join pass (the accumulated boundary against a small solid) and the simplification of the planes that do
need full sections dominate what is left. A content-keyed cache across ship objects and the reuse of the union
prefix after an edit of one structure (both exact) are the next steps if editing large designs needs it.
