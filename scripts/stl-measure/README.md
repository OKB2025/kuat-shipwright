# STL measurement scripts (Separatist examples, v24)

These scripts measured the supplied STL models into the data blocks of the
Recusant, Munificent, Providence and Lucrehulk examples
(see [docs/cis-stl-rebuild.md](../../docs/cis-stl-rebuild.md)). Only
measurements leave them: no triangle of a model is written to the game.

- `load.py` reads a binary or ASCII STL.
- `refit.py` places a model in the ship frame (`Mesh`) and cuts plane sections.
- `comps.py` splits a model into its connected solids.
- `tolofts.py` turns each solid into x-loft rows, pairing mirrored twins.
- `contours.py` turns a solid into stacked plan-contour slabs.
- `fit_ship.py` fits hull stations to chosen solids and lofts the rest
  (used for the Providence: `PROV`, axes `1,2,0`, flip `-1,1,1`, 1,088 m).
- `rec_fit2.py` and `luc_fit.py` are the Recusant and Lucrehulk measurements.
- `apply.py` writes the measured blocks into `js/core.js`.

The STL paths and the scratch output directory are written into the scripts
as they were used; point them at the supplied files to measure again.

## Executor (v24)

`Executor_Complete.stl` (see [docs/executor-stl-rebuild.md](../../docs/executor-stl-rebuild.md)):

- `executor_frame.py STL out.png` places the model in the ship frame (axes `1,2,0`, flip `-1,1,-1`,
  19,000 m; x from the stern), saves the triangles as `out.png.npy` and draws the stern and the
  aft-facing faces.
- `executor_engines.py X...` cuts cross-sections at the given x and lists the circular loops
  (engine tubes) with their centre and radius.
- `executor_fit.py [band] [min area]` chooses 30 hull stations on the measured plan and height
  profile, fits the warship octagon at each, and turns everything outside that hull into 40 m
  horizontal outline layers (city and ventral terraces).
