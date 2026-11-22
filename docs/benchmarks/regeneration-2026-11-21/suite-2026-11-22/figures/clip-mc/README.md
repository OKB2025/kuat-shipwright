# Clipped room volumes of the craft: face joining (version 7) against a Monte Carlo of the definition

Asked by the physics review (2026-11-22): whether the craft generator volume change from `f191196` (`clipCompartmentByMesh`)
is (a) the grid clipper losing volume, (b) a change in which region is kept, or (c) the new clipper keeping too much.

- `clipmc.cjs <root> <key> [N]`: loads a vm copy of `js/core.js` that exposes the internal functions (game files unchanged),
  rebuilds each clipped room of the stored example with both clippers, and samples N points in the room's bounds. "mc" is
  the volume where `unclippedInPart && insideOriginalEnvelope` hold (the definition the grid clipper samples), with its
  standard error. "byMeshOutsideEnvelope" is the face-joined mesh's volume (winding number) at sampled points where
  `insideOriginalEnvelope` is false.
- `winding2.cjs`: winding-number sampling of one mesh (raw room, grid clip or face-joined clip). Used to check the sampler:
  raw room mesh of tie_ln #9 signed 0.69473, sampled 0.6952; face-joined signed 0.20181, sampled 0.2016 (200,000 points).
- `closed.cjs`, `area.cjs`: signed volume about two origins (differs by ≤1.5e-5 relative, float32), area-vector sum
  (|Σ|/area ≤ 9e-8). The meshes are closed; edges used once are T-junctions where faces are joined, so they are not
  edge-manifold.
- The first run used a linear congruential generator whose consecutive triples lie on planes; it biased the 3D sampling by
  about −4% (raw room mesh 0.6679 against 0.6947 signed). Those results were discarded; every number here uses mulberry32.

## Result (`table.tsv`, 10⁶ points per room; V-wing #28/#29 3.1×10⁵)

| room | grid clip vs mc | face-joined vs mc | face-joined outside the envelope |
| --- | --- | --- | --- |
| tie_ln #9 (generator) | −17.0% | −0.85% | 0 |
| vulture #16 | −18.0% | −0.66% | 0 |
| tie_in #10 | −9.0% | −1.23% | 0 |
| hyena #17 / #18 | −20.6% / −19.1% | −0.94% / −1.01% | 0 |
| v19 #16 / #17 | −5.9% / −5.8% | −0.65% / −0.63% | 0 |
| vwing #28 / #29 (inertial) | −9.8% / −10.2% | −0.01% / −0.05% | ≤1e-6 m³ |
| vwing #32 / #33 | −9.1% / −9.5% | −0.86% / −1.06% | 0 |

The face-joined volume is within 1.3% of the definition and below it, by about what the room's own mesh loses to faceting
(tie_ln #9: raw mesh 0.69473 against the analytic 0.69971, −0.7%). No sampled point of it lies outside the envelope except one in vwing #28. The outside test uses 20,000 points per room (n2 in the JSON), so a room with no hit bounds the outside volume at about 0.1% of its volume (95%, box × 3 / 20,000), not 1e-6 m³. The
grid clipper lost 6–21% on these small rooms. This is case (a): the version 7 figures are the better measurement.
Not checked: the ships' rooms (only the six craft with the largest figure changes were sampled).
