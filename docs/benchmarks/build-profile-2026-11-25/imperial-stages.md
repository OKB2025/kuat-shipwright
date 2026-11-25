# imperial: parts 180, fits 50, hatches 2

| stage | s | calls of the counted functions inside it |
| --- | --- | --- |
| deserialize | 0.46 | deserialize 1 |
| syncCompartments #1 | 11.10 | syncCompartments 1 |
| remount | 0.27 | remount 1 |
| syncCompartments #2 | 7.15 | syncCompartments 1 |
| publicJSON | 0.01 | publicJSON 1 |
| serialize | 0.03 | serialize 1 |
| computeStats | 58.46 | computeStats 1 |
| fleetProfile | 0.81 | fleetProfile 1 |
| computeStats again (same ship, nothing changed) | 18.45 | computeStats 1 |
| fleetGeometry (model + trial) | 15.52 | structTriangles 264, fitSpec 127, syncCompartments 1, weaponCapacitors 1, enginePaths 1, commandCompartments 1, missileCells 1, referenceHullGeometry 1 |
| turretRayContext | 0.05 | surfaceWorkingShip 1, turretRayContext 1 |

| function | calls | s inside (outermost calls) |
| --- | --- | --- |
| computeStats | 2 | 76.91 |
| syncCompartments | 3 | 29.59 |
| fleetProfile | 1 | 0.81 |
| deserialize | 1 | 0.46 |
| remount | 1 | 0.27 |
| enginePaths | 1 | 0.05 |
| weaponCapacitors | 1 | 0.04 |
| surfaceWorkingShip | 1 | 0.04 |
| missileCells | 1 | 0.04 |
| serialize | 1 | 0.03 |
| publicJSON | 1 | 0.01 |
| turretRayContext | 1 | 0.01 |
| structTriangles | 264 | 0.00 |
| fitSpec | 127 | 0.00 |
| commandCompartments | 1 | 0.00 |
| referenceHullGeometry | 1 | 0.00 |
