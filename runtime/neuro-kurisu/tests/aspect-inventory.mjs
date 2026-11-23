import assert from 'node:assert/strict';
import { buildInventory, validateInventory } from '../../../tools/neurok-aspect-inventory.mjs';

const inventory = buildInventory();
const validation = validateInventory(inventory);
assert.equal(validation.ok, true, validation.errors.join('; '));
assert.equal(inventory.totals.aspects, 75);
assert.equal(inventory.totals.ownerExists, 75);
assert.equal(inventory.totals.branchesAssigned, 711);
assert.ok(inventory.totals.testsFound >= 60, `expected at least 60 aspects with tests, found ${inventory.totals.testsFound}`);
assert.equal(inventory.byReadiness['owner-missing'] ?? 0, 0);
assert.equal(inventory.aspects.find(a => a.n === 33)?.ownerStatus, 'candidate');
assert.equal(inventory.aspects.find(a => a.n === 65)?.ownerStatus, 'candidate');
assert.equal(inventory.aspects.find(a => a.n === 66)?.ownerStatus, 'candidate');
assert.ok(inventory.aspects.find(a => a.n === 13)?.testsFound > 0);
assert.ok(inventory.aspects.every(a => a.system && a.owner && a.owner !== 'UNKNOWN'));
console.log('ASPECT_INVENTORY_TEST=PASS');
console.log(JSON.stringify({ aspects: inventory.totals.aspects, owners: inventory.totals.ownerExists, tests: inventory.totals.testsFound, branches: inventory.totals.branchesAssigned, openPrs: inventory.totals.openPrs, readiness: inventory.byReadiness }));
