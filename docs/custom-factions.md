# Custom factions (FACTION-001)

Players can make their own factions and choose them just like the four factions from the films: in the designer's
所属陣営, as the mission navy, and on either side of the sandbox fleet battle (player or AI). Ship designs assigned to a
faction (or to 全陣営) join that faction's ship lists and auto fleets (お任せ編成), just like the example ships.

## Where to edit

- **Faction editor**: the 陣営 tab of the fleet setup screen (サンドボックス · 任務 · カスタム). It also opens from the
  陣営を作る・編集する button under the designer's 所属陣営 (hull tab), and from the 陣営を編集 button beside the faction
  selects in the order of battle and the mission fleet screen.
- **Fields**:
  - Names: a Japanese name, an optional English name, a short name and an optional English short name.
  - Look: a colour, an emblem (ten plain generated glyphs, no real insignia) and a base style (the paint for the
    example ships it sails).
  - Place: the eras it exists in and its home system on the galaxy map.
  - Doctrine: the base faction it was copied from, AI posture, air doctrine, ship-name style, line / escort / recon
    design lists (example keys or the player's saved designs as `save:<id>`), and line ships per task force.
  - Forces: six carrier squadron types and a regiment (name, four company types, vehicles per company type).
  - Relations: ally / neutral / enemy toward every other faction.

## Data model

A definition is checked by `Rts.normalizeFactionDef`. Ids are `u_` plus 2–20 letters or digits, so they never clash
with a built-in key. `Rts.registerFaction(def)` enters the definition into the same tables the built-in factions use:

| Table | What it gets |
|---|---|
| `FACTIONS` | name, short name, colour; `custom`, `base` and the definition (`def`) |
| `CRAFT_MIX` | carrier complement |
| `DOCTRINE` | the Alliance's shield-stripping air doctrine, when chosen |
| `REGIMENT_TEMPLATES` | regiment (also used for planetary garrisons) |
| `FACTION_REL` | allies and enemies |
| `Core.DESIGN_FACTIONS` | designer list |
| `Galaxy.POWERS` | home system, eras, colour (`Galaxy.setCustomPower`) |

The app also fills the voyage tables:

- `VOY_FLEET_DOCTRINE`: the design lists.
- `VOY_ROLE_TF`: the base faction's task-force role sequence and its raid, escort and reconnaissance-in-force classes,
  with the faction's own recon list as its reconnaissance task forces.

Code that looks up a faction:

- `factionDef(id)`: the definition (built-in factions are assembled from their tables); `null` for an unknown id.
- `factionBase(id)`: the base faction. Used for whatever has no table of its own: the strategic AI temper
  (`aiPlan` ← `AI_FACTION`), carrier raids (Alliance base), convoy ships (`convoyKit` ← `CONVOY_KIT`), boarding troop
  quality and droids, droid stowage (`troopRoom`), droid garrisons and ground forces, the drill opponent, bolt colour,
  gun sounds and music.
- `factionOr(id, fallback)`: an id as stored, falling back when it is unknown.
- `rivalOf(id)`: the first enemy, else one that names it an enemy, else the base's rival; never an ally.
- `factionRelation(a, b)`: `'enemy'`, `'ally'`, `'neutral'` or `'self'`.
- `vehicleServes(key, id)`: the vehicles a faction may field.
- `isCustomFaction(id)`: true for a registered made faction.

## Saving

| Where | Format |
|---|---|
| This browser | `yard.factions.v1`: `{format:'ks-factions', version:1, factions:[def…]}` (export / import uses the same JSON) |
| Scenario JSON | `factions: [def…]` for the made factions its sides use; importing one this device lacks enters it and keeps it |
| Mission save | `factionDefs: [def…]` |
| Design | `faction: 'u_…'` (kept even where the faction is unknown; that design then serves every faction) |
| Saved-design record | `faction` (the fleet screens read it without unpacking the design) |

Old saves have none of these fields and load unchanged. An unknown faction on a scenario side falls back to the Empire
or the Alliance. Deleting a faction leaves its designs serving every faction.

## Player designs in faction lists

When the fleet screen opens, and before a new mission builds its starting fleet, the player's saved ship designs are
prepared in the background (`voyPrepareSaves`). Each then serves its 所属陣営 (or every faction, 全陣営) in
`voyServes`:

- It is listed in that faction's group of the add-ship list.
- It joins お任せ: capital ships with the line, the rest with the escorts.

Saved aircraft designs are left out; they fly from carriers instead.

## Tests

`tests/custom-factions.cjs`.
