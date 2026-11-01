import assert from 'node:assert/strict';
import { UserModelEvidenceModel } from '../src/organism/cognition/UserModelEvidenceModel.ts';

const model = new UserModelEvidenceModel();
const recorded = model.recordExplicit({
  key: 'response.style',
  domain: 'interaction-style',
  value: 'detailed',
  tick: 10,
  evidenceRef: 'user-explicit:style:10',
  explicit: true,
  sensitivity: 'low-risk',
});
assert.equal(recorded.accepted, true);
assert.equal(model.confirmedValue('response.style', 'interaction-style'), 'detailed');

const conflict = model.recordExplicit({
  key: 'response.style',
  domain: 'interaction-style',
  value: 'concise',
  tick: 11,
  evidenceRef: 'user-explicit:style:11',
  explicit: true,
  sensitivity: 'low-risk',
});
assert.equal(conflict.status, 'disputed');

model.observeBehavior({
  key: 'response.style',
  domain: 'interaction-style',
  value: 'concise',
  tick: 11,
  observationRef: 'behavior:style:12',
  sensitivity: 'low-risk',
});

const forgotten = model.forgetExplicit({
  key: 'response.style',
  domain: 'interaction-style',
  tick: 13,
  evidenceRef: 'user-explicit:forget-style:13',
  explicit: true,
});
assert.deepEqual(forgotten, {
  accepted: true,
  removed: true,
  key: 'response.style',
  domain: 'interaction-style',
});
assert.equal(model.confirmedValue('response.style', 'interaction-style'), null);
assert.equal(model.snapshot().claims.length, 0);
assert.equal(model.snapshot().candidates.length, 0);

// Both the original assertion and the forget command survive restart as replay guards.
const restored = new UserModelEvidenceModel();
restored.restore(model.snapshot());
assert.equal(restored.confirmedValue('response.style', 'interaction-style'), null);
assert.equal(restored.recordExplicit({
  key: 'response.style',
  domain: 'interaction-style',
  value: 'detailed',
  tick: 14,
  evidenceRef: 'user-explicit:style:10',
  explicit: true,
  sensitivity: 'low-risk',
}).reason, 'duplicate-evidence');
assert.equal(restored.forgetExplicit({
  key: 'response.style',
  domain: 'interaction-style',
  tick: 15,
  evidenceRef: 'user-explicit:forget-style:13',
  explicit: true,
}).reason, 'duplicate-evidence');

// A fresh explicit statement may intentionally re-establish the preference.
assert.equal(restored.recordExplicit({
  key: 'response.style',
  domain: 'interaction-style',
  value: 'concise',
  tick: 16,
  evidenceRef: 'user-explicit:style:16',
  explicit: true,
  sensitivity: 'low-risk',
}).status, 'confirmed');
assert.equal(restored.confirmedValue('response.style', 'interaction-style'), 'concise');

assert.equal(restored.forgetExplicit({
  key: 'response.style',
  domain: 'interaction-style',
  tick: 17,
  evidenceRef: '',
  explicit: true,
}).reason, 'missing-evidence');
assert.equal(restored.forgetExplicit({
  key: '__proto__',
  domain: 'interaction-style',
  tick: 18,
  evidenceRef: 'invalid:key',
  explicit: false,
}).reason, 'invalid-input');

console.log('UserModel explicit forgetting, restart persistence and replay protection: all assertions passed');
