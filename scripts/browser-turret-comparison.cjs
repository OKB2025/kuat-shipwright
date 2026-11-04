#!/usr/bin/env node
// Compatibility entry point: the old two-turret comparison is superseded by
// the current eight-model photo-reference family. Historical reports remain
// under docs/benchmarks; new runs use the shared current-family verifier.
process.env.WEAPON_FAMILY_EXPECT_CORE ||= process.env.TURRET_EXPECT_CORE;
require('./browser-weapon-family.cjs');
