# English interface and raid fixes

Choose **English** or **日本語** in the title screen footer or the **Designs** menu.
The choice takes effect immediately and is remembered on this browser. The first
visit uses Japanese for a Japanese browser language and English otherwise.
If browser storage is unavailable, switching still works for the current page.

The English interface covers the main design tools, component search, fleet
organization, operations controls, combat messages, and both tutorials. In English mode, search
accepts English component names as well as Japanese names. Numbers use English
thousands/millions/billions/trillions abbreviations in English mode.

Saved designs, identifiers, ship names entered by the user, input values, and
simulation rules retain their original values. Unknown text falls back to its
Japanese source; some detailed example descriptions and historical source notes
are not translated yet. This is an English interface, not a complete translation
of every reference document in the application.

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

The 11 automated tests cover the real custom-craft save/load/registration path,
raid recall and missile progression, invalid hyperdrive values, language
defaults and persistence, blocked storage, dynamic translations, canvas text
measurement, and translation-template arguments. All five raid regression
tests reproduce failures against the unmodified base and pass after the fix.

Browser checks cover desktop and mobile layouts, both language selectors,
language persistence after reload, English component search, fleet setup,
the 3D fleet tutorial, operations controls, and unchanged design data across
language switches. Recorded music assets were not downloaded for these checks;
audio playback is outside their coverage.

## Maintaining translations

`js/lang-en.js` contains the display catalog. `terms` holds standalone names;
`messages` holds complete sentences and templates with numbered placeholders
such as `{0}`. Preserve every placeholder when adding a translation.

`js/i18n.js` localizes changed DOM subtrees and the app's own canvas contexts.
Use `data-l10n-skip` or `translate="no"` for content that must remain verbatim.
Application logic that reads a rendered label must use `KSI18n.sourceText()`
instead of treating its translation as an internal identifier. Number formatting
belongs in the app's locale-aware formatting helpers.
