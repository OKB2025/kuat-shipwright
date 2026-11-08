# Read-only baseline diagnosis: three propulsion test files

Date: 2026-11-08. No production source or repository test file was edited during this diagnosis.

All seven failures are already present on baseline `48cfbede2a5b333961601c57a18549ccf77fee8b` and latest main `d5dedb7de6b2fdc63bb28f3c41b86f3ab691b697`. The mass-dependent motion changes introduce no additional failures in these three files. The surface-power failures are stale engine/thermal fixture contracts, not a missing new throttle command or a new motion regression.

## Method and raw evidence

Exact baseline source, three exact test files, and their three data dependencies were extracted with `git archive` into isolated directories:

- `/workspace/scratch/mass-motion-baseline-48cf`
- `/workspace/scratch/mass-motion-baseline-d5dedb7`

All three unchanged test-file hashes match the current branch and both baselines:

| File | SHA-256 |
| --- | --- |
| fighter-propulsion-planning.cjs | 98ea0c1a05df1841e5bc31550d09ce5fa8cdd85813d3c1ec0c9ce2fb7eb19282 |
| propulsion-model.cjs | 56df73235509853dc557a5f80d1b1f478860d40bea493466028cc0c94dfc597b |
| propulsion-surface-power.cjs | 5bd8c31e11ef9148020338bca0b4fc02619e5d34a0ea38e2c869b299fb8dbcc4 |

Full unchanged-file command run in the current branch and first baseline archive:

```sh
node --test --test-reporter=tap tests/fighter-propulsion-planning.cjs tests/propulsion-model.cjs tests/propulsion-surface-power.cjs
```

| File | Current pass/fail | 48cfbede pass/fail |
| --- | ---: | ---: |
| fighter-propulsion-planning.cjs | 6 / 1 | 6 / 1 |
| propulsion-model.cjs | 11 / 1 | 11 / 1 |
| propulsion-surface-power.cjs | 3 / 5 | 3 / 5 |
| Total | 20 / 7 | 20 / 7 |

- Full current log: `/workspace/scratch/mass-motion-three-current.tap`, 27 tests, 20 pass, 7 fail; 141546.946ms.
- Full 48cfbede log: `/workspace/scratch/mass-motion-three-baseline.tap`, 27 tests, 20 pass, 7 fail; 131700.829ms.
- Original 48-file matrix: `/workspace/scratch/mass-dependent-propulsion-final.tap`.

To avoid rebuilding every stock fighter again, all seven failing cases were then selected from the same exact files on both archived baselines:

```sh
node --test --test-reporter=tap --test-name-pattern='real architecture-two|integrated nozzle edits|fleet charging|direct surface charging|repeated charging|accepted surface charge heats' tests/fighter-propulsion-planning.cjs tests/propulsion-model.cjs tests/propulsion-surface-power.cjs
```

- 48cfbede targeted log: `/workspace/scratch/mass-motion-three-baseline-targeted.tap`, exact same 7 failures, 3387.513ms.
- Latest d5dedb7 main targeted log: `/workspace/scratch/mass-motion-three-latest-main-targeted.tap`, exact same 7 failures, 2389.710ms.
- Latest main full 27-case command was not rerun; the expensive stock-fighter pass is unnecessary to establish these seven failures are also preexisting there.

Current production Core SHA after the full run was `142b0461dde53f4c7e0c068e5c594c9e9c3c41f340ba017f062e23838c70c761`; another authorized hatch agent was making separate changes during this period. The exact failure messages also match the already-finished original frozen 48-file matrix.

## Exact failures and causes

The failure messages below are identical in the current full log, 48cfbede full log, and latest-main targeted log.

| File and line | Exact case name | Failure |
| --- | --- | --- |
| fighter-propulsion-planning.cjs:61 (assertion :80) | a real architecture-two engine and paid feed retain planning limits while actual watts, force and heat follow the allocation | `the electrical feed is installed physical hardware`; expected true, actual false |
| propulsion-model.cjs:24 (assertion :26) | integrated nozzle edits retain body dimensions and rating while keeping the body attached | `a reactor moved outside the hull cannot earn a free outside transmission route`; expected connected=false, actual true |
| propulsion-surface-power.cjs:18 (assertion :21) | fleet charging respects each isolated source and a 100 TT/s shared engine/cooling trunk | `first domain accepted charge: 79.99999999999999 != 10` |
| propulsion-surface-power.cjs:18 (assertion :21) | fleet charging respects each isolated source and a 90 TT/s shared engine/cooling trunk | `first domain accepted charge: 69.99999999999999 != 0` |
| propulsion-surface-power.cjs:27 (assertion :29) | direct surface charging uses the same per-module grants and does not borrow unused charge | `total electrical weapon grant: 180 != 110` |
| propulsion-surface-power.cjs:39 (assertion :42) | repeated charging cannot spend one allocated module input a second time | `value: 180 != 110` |
| propulsion-surface-power.cjs:46 (assertion :49) | accepted surface charge heats only its actual funding reactors, including cooling consumption | `Cannot read properties of undefined (reading '3')` from `u.ht.st[3]` |

### Two electrical-transmission assertions

Already on main, `engineTransmission` is electrical `model:'source-distance'`, `ENGINE_TRANSMISSION_VERSION=4`. It explicitly generates no solid, routing grid, volume, cable mass, or damageable cable module. Electrical links use actual endpoint distance and finite capacity, with efficiency `exp(-1e-5*length)`. Therefore electrical feed volume is exactly 0, and moving a reactor outside the hull changes the distance/loss but does not reject a numerical electrical link just because a physical cable route would leave the hull. Mechanical shafts remain physical under `engineDriveRoutes`.

The existing `tests/engine-transmission.cjs` verifies these current main contracts explicitly: zero route volume/mass/cost/parts at lines17-25, no obstacle-driven electrical routing at33-34, and distance/loss changes on movement at37. Thus the two diagnosed assertions are old physical-electrical-routing expectations; neither failing function was changed by the mass-motion patch.

### Four surface power/charging failures

The fixture in `propulsion-surface-power.cjs` creates an engine with only rated input, watts-per-newton, direction, and validity flags; it omits `driveProfileId` and usable physical machinery volume (`effectiveMachineryVolumeM3`/`machineryVolumeM3`, or derived normal input). Current main's `engineOperatingPoint` requires a valid drive coefficient and positive physical operating volume. `getEngineInputLimit` consequently returns input limit 0 with `invalid-drive-profile` and `drive-capacity` in both snapshots. An authored `valid:true` flag cannot bypass the missing physical engine contract.

A diagnostic evaluated the original fixture without executing its tests and inspected the actual Core requests and allocator. Script: `/workspace/scratch/mass-motion-three-diagnose.cjs`; raw output: `/workspace/scratch/mass-motion-three-diagnose.jsonl`.

Identical current/48cfbede results:

- `u.maneuver=1`, `u.velocity=[0,0,0]`: full thrust is explicitly requested by the fixture. New direct-throttle semantics are irrelevant here, and drag-holding demand is 0 at rest.
- Engine request limit=0 and actual engine input=0, rather than the fixture's assumed 70TT/s.
- Cooling remains allocated at20TT/s in both snapshots; cooling is not silently lost.
- 100TT/s first-domain trunk: 80TT/s remain for the first weapon bank, instead of expected10TT/s.
- 90TT/s first-domain trunk: 70TT/s remain, instead of expected0.
- Direct allocation therefore grants180TT/s total weapons, instead of110; the same missing70TT/s engine draw explains all four charging failures.

This is a fixture that needs valid real engine metadata if it is intended to verify a 70TT/s engine consuming shared source/trunk capacity. It is not evidence of electrical grant double spending in the new patch.

### Surface per-source heat failure

The last assertion reads the removed local source-store array `u.ht.st`. Main already uses a common heat reservoir, `u.ht.qJ`, with separate actual-input ledgers; `heatInit` does not create `st`. `heatOf` only accepts and removes it when migrating an old thermal snapshot. Both diagnosed snapshots report `heatHasSt:false` and `heatHasQJ:true`. The test needs current common-reservoir/actual reactor-energy ledger assertions rather than restored obsolete source stores.

## Scope

No source or test edits, test suppression, or coefficient changes were made. This report diagnoses the seven requested failures only; it does not claim the other five failures in the 48-file matrix passed. Parent is separately coordinating those cases. No user blueprint data was copied into repository files or this report.
