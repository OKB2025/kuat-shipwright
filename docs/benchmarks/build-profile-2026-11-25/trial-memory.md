# imperial: parts 180, fits 50
| stage | s | heap in use MB (before / after collection) | resident MB | typed arrays MB |
| --- | --- | --- | --- | --- |
| deserialize | 0.3 | 199 / 184 | 323 | 5 |
| remount | 0.3 | 198 / 186 | 332 | 8 |
| syncCompartments | 10.2 | 340 / 203 | 517 | 12 |
| computeStats | 59.5 | 438 / 225 | 1018 | 67 |
| fleetProfile | 0.8 | 258 / 249 | 1003 | 54 |
| fleetGeometry (model + trial) | 19.4 | 350 / 251 | 1023 | 68 |
| turretRayContext | 0.1 | 270 / 251 | 1005 | 68 |

peak resident 1023 MB; heap limit 8048 MB
geometry model: typed arrays 13 MB, triangles 227869
geometry trial: typed arrays 13 MB, triangles 227869
profile JSON 40 MB; stats JSON 49 MB; public state 1 MB

# venator: parts 269, fits 58
| stage | s | heap in use MB (before / after collection) | resident MB | typed arrays MB |
| --- | --- | --- | --- | --- |
| deserialize | 0.5 | 200 / 187 | 331 | 6 |
| remount | 1.0 | 212 / 189 | 346 | 10 |
| syncCompartments | 13.2 | 324 / 209 | 504 | 18 |
| computeStats | 48.8 | 300 / 293 | 1052 | 75 |
| fleetProfile | 1.3 | 346 / 326 | 1060 | 75 |
| fleetGeometry (model + trial) | 21.4 | 435 / 328 | 1088 | 98 |
| turretRayContext | 0.1 | 333 / 328 | 1062 | 98 |

peak resident 1088 MB; heap limit 8048 MB
geometry model: typed arrays 22 MB, triangles 358739
geometry trial: typed arrays 22 MB, triangles 358739
profile JSON 54 MB; stats JSON 65 MB; public state 1 MB

