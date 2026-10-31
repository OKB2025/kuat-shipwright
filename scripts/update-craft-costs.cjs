#!/usr/bin/env node
// Generate the inexpensive runtime catalog from the same physical designs and
// engineering price service used by the editor. No runtime mesh/stat builds.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(process.env.KS_TEST_ROOT || path.join(__dirname, '..'));
const context = vm.createContext({console});
for (const file of ['data/reference.js', 'data/imperial2.js', 'data/fleet.js', 'js/core.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, {filename: file});
}
const {C, R} = vm.runInContext('({C:Core,R:Rts})', context);
const modelSignature = C.costModelSignature(), entries = {};
for (const key of Object.keys(C.SHIP_EXAMPLES).sort()) {
  if (!key.startsWith('craft_')) continue;
  const type = C.craftTypeOf(key);
  if (!type || !R.CRAFT[type] || entries[type]) continue;
  const ship = C.buildDesign(key), stats = C.computeStats(ship), price = C.designCost(stats);
  entries[type] = {reference: key, signature: C.costSignature({modelSignature, blueprint: C.serialize(ship)}), ...price, systems: C.cleanCraftSystems(stats.craftSystems)};
}
const catalog = {modelVersion: C.COST_MODEL.version, modelSignature, entries};
const first = '// BEGIN GENERATED CRAFT PRICES — scripts/update-craft-costs.cjs';
const last = '// END GENERATED CRAFT PRICES';
const filename = path.join(root, 'js/core.js'), source = fs.readFileSync(filename, 'utf8');
const start = source.indexOf(first), end = source.indexOf(last, start);
if (start < 0 || end < start) throw new Error('Craft price catalog markers are missing');
const block = first + '\nconst CRAFT_PRICE_CATALOG=' + JSON.stringify(catalog, null, 1) + ';\n';
if (process.argv.includes('--check')) {
  if (source.slice(start, end) !== block) {
    console.error('Craft price catalog is stale; run node scripts/update-craft-costs.cjs');
    process.exitCode = 1;
  } else console.log(`Craft price catalog verified: ${Object.keys(entries).length} blueprints, model ${catalog.modelVersion}.`);
} else {
  fs.writeFileSync(filename, source.slice(0, start) + block + source.slice(end));
  console.log(`Updated ${Object.keys(entries).length} craft prices from physical designs (model ${catalog.modelVersion}).`);
}
