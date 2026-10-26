# English interface and raid fixes

Choose **English** or **日本語** in the title screen footer or the **Designs** menu.
The choice takes effect immediately and is remembered on this browser. The first
visit uses Japanese for a Japanese browser language and English otherwise.
If browser storage is unavailable, switching still works for the current page.

The English interface covers the main design tools, component search, fleet
organization, operations controls, combat messages, and both tutorials. The
mission map includes English names and descriptions for all 84 systems, regions,
trade routes, eras and theaters, including patrol and fleet-battle mission cards.
Map label placement measures the displayed text when switching languages or zooming.
The piloting HUD includes full ship-class descriptions, helm orders, heading,
pitch and roll, gunnery readiness, reactor load, power-allocation menus, civilian
traffic brackets, hyperspace phases, damage reports, superweapon states and
battle results. Dynamic slider descriptions are localized for screen readers.
HUD layout measures translated labels; long damage reports scroll within the
space between the top controls and the helm pad.
In English mode, search
accepts English component names as well as Japanese names. Numbers use English
thousands/millions/billions/trillions abbreviations in English mode.

Default ship names and numbered formations display in English in the order of
battle without rewriting their saved Japanese names. New manual name edits are
marked as custom and retained verbatim, including after reloading. Existing names
that exactly match a default name are displayed using that name's translation;
older saves do not record whether those names were manually entered.

Saved designs, identifiers and simulation rules retain their original values.
Unknown text falls back to its
Japanese source; some detailed example descriptions and historical source notes
are not translated yet. This is an English interface, not a complete translation
of every reference document in the application.

## Military terminology

The game's formation hierarchy uses **Combined Task Force (CTF-1)** containing
**Task Forces (TF-11, TF-12, …)**. These terms also apply to orders, tutorials,
mission preparation and map abbreviations. Internal save keys remain unchanged.

Air formations containing several squadrons use **Air Wing**; their component
units use **Squadron**. Ground units use **Company**, **Battalion** and **Regiment**.
Other corrected terms include **Combat Air Patrol**, **Full Salvo**, **Line Ahead**,
**Line Abreast**, **Echelon**, **Wedge** and **Circular Formation**.
Helm orders use **Full Ahead**, **Astern**, **Hard to Port**, **Midships** and
**Hard to Starboard**. Flight attitude uses **Pitch** and **Roll**, while hull
geometry retains **Slope**. Compact armor indicators use B/A/S/P/D/V for
bow, aft, starboard, port, dorsal and ventral; tooltips spell out each face.

## Raid fixes

- Custom craft keep their valid hyperdrive class in saved air-wing snapshots and
  when registered for fleet battles. Hyperdrive-equipped designs can therefore
  pass the inter-system raid check after saving and loading.
- Recalling a raid keeps combat running until its craft leave the target system.
  Missiles already in flight continue to resolve after the last squadron leaves.
  Missiles whose targets are destroyed or leave the system are discarded.

Older custom-craft snapshots that have already lost the hyperdrive field cannot
recover it automatically. Re-add the craft from its original saved design to
create a new snapshot. Missing, non-finite, zero, and negative hyperdrive classes
remain unable to jump.

## Validation

From the repository root, run with a recent Node.js release (tested with 24.22.1):

```sh
node --test tests/*.cjs
```

The 25 automated tests cover the real custom-craft save/load/registration path,
raid recall and missile progression, invalid hyperdrive values, language
defaults and persistence, blocked storage, dynamic translations, canvas text
measurement, translation-template arguments, all map data and composed mission
labels, generated ship names, custom-name preservation and TF/CTF terminology.
HUD regressions exercise the actual generated interface for all built-in ship
designs, every civilian class/name combination with intact and damaged markers,
all hyperspace phases, damage flags, power modes, battle-result variants and
slider descriptions across language switches. Orbit labels cover every system,
including shipyard rings, and all twelve loading tips are translated.

The Canvas2D fallback also has regression coverage for mesh drawing and fleet
lighting under full ship rotation. These tests reproduce the undefined `cs`
variable crash in the previous renderer; normals now use the same rotation
matrix as vertices, including pitch and roll.
All five raid regression
tests reproduce failures against the unmodified base and pass after the fix.

Browser checks cover desktop and mobile layouts, both language selectors,
language persistence after reload, English component search, fleet setup,
the 3D fleet tutorial, operations controls, and unchanged design data across
language switches. Recorded music assets were not downloaded for these checks;
audio playback is outside their coverage.

The map/fleet follow-up checks all 84 systems in both mission modes, both eras,
desktop and mobile map layouts, all four factions' default names, language
switches without saved-name changes, and a custom ship name across loadout,
mission preparation and page reload.

The piloting follow-up checks patrol and battle HUDs at 1536×706, 844×390 and
390×844, helm/camera/gunnery/power commands, damage states and result panels,
and Onager/Subjugator superweapon charging, ready, firing, cooling and damaged
states. The checks inspect text and accessible attributes for untranslated
Japanese, and verify that damage cards fit between the controls and helm pad.

## Maintaining translations

`js/lang-en.js` contains the display catalog. `terms` holds standalone names;
`messages` holds complete sentences and templates with numbered placeholders
such as `{0}`. Preserve every placeholder when adding a translation.

`js/i18n.js` localizes changed DOM subtrees and the app's own canvas contexts.
Use `data-l10n-skip` or `translate="no"` for content that must remain verbatim.
Application logic that reads a rendered label must use `KSI18n.sourceText()`
instead of treating its translation as an internal identifier. Number formatting
belongs in the app's locale-aware formatting helpers.
