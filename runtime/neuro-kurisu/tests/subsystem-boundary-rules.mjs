import assert from 'node:assert/strict';
import { FROZEN_CROSS_SUBSYSTEM_EDGES, DOMAIN_SUBSYSTEMS, newCrossSubsystemEdges, edgeKey, isDomain } from '../scripts/lib/subsystem-boundary-rules.mjs';

// The ratchet only passes when every observed edge is already frozen, and it
// fails the instant a genuinely new domain->domain edge appears.
const frozen = [...FROZEN_CROSS_SUBSYSTEM_EDGES];
assert.ok(frozen.length >= 40, 'frozen baseline must not silently shrink');
assert.deepEqual(newCrossSubsystemEdges(frozen), [], 'known edges must pass');

const fresh = newCrossSubsystemEdges([...frozen, 'core -> verification', 'world -> learning']);
assert.deepEqual(fresh, ['core -> verification', 'world -> learning'], 'new edges must be reported, sorted');

assert.equal(isDomain('memory'), true);
assert.equal(isDomain('index'), false, 'barrel file is not a domain');
assert.equal(edgeKey('core', 'system'), 'core -> system');
assert.equal(new Set(DOMAIN_SUBSYSTEMS).size, DOMAIN_SUBSYSTEMS.length, 'domains must be unique');

// A domain edge that shares a prefix with a real domain must still be rejected.
assert.equal(isDomain('systemx'), false, 'prefix match must not count as a domain');

console.log(JSON.stringify({ pass: true, suite: 'subsystem-boundary-rules', frozenEdges: frozen.length }));
