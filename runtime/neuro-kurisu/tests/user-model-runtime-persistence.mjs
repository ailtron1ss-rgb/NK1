import assert from 'node:assert/strict';
import { SelfSubsystemRuntime } from '../src/organism/core/SelfSubsystemRuntime.ts';

const first = new SelfSubsystemRuntime();
const write = first.userModelEvidence.recordExplicit({
  key: 'response.style', domain: 'interaction-style', value: 'concise',
  tick: 12, evidenceRef: 'runtime-turn:12', explicit: true, sensitivity: 'low-risk',
});
assert.equal(write.accepted, true);

const projected = first.snapshot();
assert.equal(projected.userModelEvidence.claims[0].value, 'concise');

const restored = new SelfSubsystemRuntime();
restored.restoreFromPersisted({ advanced: { userModelEvidence: projected.userModelEvidence } });
assert.deepEqual(restored.userModelEvidence.snapshot(), projected.userModelEvidence);

const changed = restored.userModelEvidence.recordExplicit({
  key: 'response.style', domain: 'interaction-style', value: 'detailed',
  tick: 13, evidenceRef: 'runtime-turn:13', explicit: true, sensitivity: 'low-risk',
});
assert.equal(changed.status, 'disputed');
assert.equal(restored.userModelEvidence.snapshot().claims[0].value, 'concise');
console.log('UserModel SelfSubsystemRuntime persistence: all assertions passed');
