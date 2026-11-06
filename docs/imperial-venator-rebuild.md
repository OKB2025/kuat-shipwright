# Imperial I and Venator examples, rebuilt on the supplied models

The Imperial I layout was subsequently updated from the user's Imperial II blueprint, and Imperial II was added as a separate example. See [the current Imperial I/II layout](imperial-i-ii-user-layout.md). The measurements and checks below record the earlier model rebuild.

Both examples were rebuilt on 2026-11-06 from the models the user supplied:

- **Imperial I:** "Imperial I-class Star Destroyer" by LarsH, CC BY 4.0, measured at a length of 1,600 m.
- **Venator:** "Venator-Class Star Destroyer" by A308 Digital, CC BY 4.0, measured at a length of 1,137 m.

Only measurements are taken from the models. Hulls, decks and towers are ordinary editable parts. The model's own
geometry is used only for the separate fittings that were already registered from these models: the ISD bridge, its
sensor spheres and mast, and the Venator bridges, engines and guns.

## How the hulls are built

The user set two rules for this rebuild:

- The side widths are carved out of the wedge. They are not made by editing the stations.
- The hull height is nearly straight. Superstructure is never mistaken for hull height.

In both ships the stations carry only the wedge itself:

- a straight half-width line;
- straight top and bottom lines;
- a side belt of constant height.

The stations are spaced only so that the belt keeps that height. Everything else is cut away or built on top:

| Feature | Imperial I | Venator |
| --- | --- | --- |
| Half-width | 591.8 − 0.3637·x | 358.07 − 0.2812·x, from the stern wall at x = 234 m |
| Side belt | y 116.5–155.5 m | y 46.5–73.4 m |
| Top plating | y = 270 − 0.0715·x − 0.1935·\|z\| | Straight from the belt to the centre line. The centre top is 114 m to x = 533 m, then falls 0.06 m per metre |
| Bottom plating | y = 2 + 0.0715·x + 0.1935·\|z\| | The keel line rises to 3 m at x = 570 m, then 0.080 m per metre to x = 800 m and 0.052 m per metre beyond |
| Plan cuts | Stern chevron (box) and ten stepped side-lip notches (yawed boxes) | Wing tips and the waist (two plan trapezoids), the flat stern wall between the nacelles (box) and four forward lip notches (yawed boxes) |
| Other cuts | The stern groove under the plating overhangs (two convex polyhedra) | — |
| Side trench | 29.5 m tall and 13.8 m deep. Inside the notches its floor stays 26.7 m and 24.5 m from the uncut edge | 20 m tall. 6.7 m deep at the wings, 11.5, 9 and 6 m deep forward. On the waist's slanted faces it is the taller recess between the lips |

### Imperial I structures

- **Decks:** every terrace roof is a level of the plating plane family. The levels are 272.3, 277, 278.4, 281.9, 285.3,
  300, 313, 338, 364 and 377. Each outline was traced on the model at its own level.
- **Ventral:** the keel armour, the side pads, the forward blister and the reactor dome.
- **Command tower:** rebuilt as a raked loft. The bridge is LarsH's own bridge (`isd_bridge`). It matches the model
  exactly, so the Heataker bridge, whose height differs, is no longer used.

### Venator structures

- **Tail boom:** the tail behind the stern wall is now a loft.
- **Kept from the earlier rebuild:** the tower, bridges, engines and deck structures. These were already measured
  from A308 Digital's model in this frame.
- **Centre strips:** the raised strip down the centre of the deck, and its counterpart on the keel, are the flight
  deck's closed doors. The sliding hatches draw them.

## Armament

The armament is unchanged except as follows:

- **Imperial I heavy wells:** the eight wells move to the model's turret centres: x = 292.8, 353.9, 414.9 and
  477.7 m, z = ±255.7 m. The aft pair are the ion twins.
- **Imperial I centre-line triples:** the three triples on the centre line stand at x = 752 and 780 m on the ridge,
  and at x = 845 m in the groove ahead of it.
- **Venator trench guns:** the two guns at the model's side-gun station, x = 763 m, are now the 70TT×2 side mounts
  (`venSide70`), as the user asked. They were 40 TT twins.

## Systems kept at their reference values

- **Hyperdrive class:** the drive is re-solved against each new layout, so the classes stay at the reference values:
  Imperial I class 2, Venator class 1.
- **Aircraft capacity:** the ISD's main bay keeps its earlier storage volume behind the model's 169 × 142 m mouth.
- **Venator charging:** the maintenance deck slot that houses the side guns' chargers moves to their mount height.

## Checks

```sh
node --test tests/named-example-armament.cjs tests/capital-turret-core.cjs
```
