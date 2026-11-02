import assert from 'node:assert/strict';
import { SelfModelEngine, defaultSelfModel } from '../src/organism/cognition/SelfModelV2.ts';

const roundTrip = new SelfModelEngine().snapshot();
roundTrip.predictedAction = 'verify'; roundTrip.confidence = .83; roundTrip.actionAccuracy = .91; roundTrip.calibrationError = .12;
roundTrip.identityCoherence = .88; roundTrip.agencyBelief = .72; roundTrip.recentErrors = [.1, .2, .3];
roundTrip.preferredStrategies = ['verify', 'reflect']; roundTrip.selfConsistentAction11 = { verify: .4, reflect: -.2 };
roundTrip.identityGateAcceptedCount = 4; roundTrip.identityGateRejectedCount = 2;
roundTrip.lastIdentityGate = { accepted: true, reason: 'verified-independent-outcome-bound', at: 42, evidenceRef: 'world-transition:42' };
const restored = new SelfModelEngine(); restored.restore(roundTrip);
assert.deepEqual(restored.snapshot(), roundTrip, 'valid self-model snapshots must round-trip without drift');

let getterCalls = 0; const accessorSnapshot = {};
Object.defineProperty(accessorSnapshot, 'confidence', { enumerable: true, get() { getterCalls += 1; throw new Error('persisted getter executed'); } });
const fromAccessor = new SelfModelEngine();
assert.doesNotThrow(() => fromAccessor.restore(accessorSnapshot));
assert.equal(getterCalls, 0, 'restore must inspect descriptors without invoking getters');
assert.equal(fromAccessor.snapshot().confidence, defaultSelfModel().confidence);

const revoked = Proxy.revocable({}, {}); revoked.revoke();
const fromRevoked = new SelfModelEngine();
assert.doesNotThrow(() => fromRevoked.restore(revoked.proxy));
assert.equal(fromRevoked.snapshot().predictedAction, 'none'); assert.deepEqual(fromRevoked.snapshot().recentErrors, []);

let nestedGetterCalls = 0; const actionScores = { verify: .5, explore: Number.NaN, unknown: 99 };
Object.defineProperty(actionScores, 'rest', { enumerable: true, get() { nestedGetterCalls += 1; return 1; } });
const malformed = { predictedAction: 'launch-nuclear-subsystem', confidence: 9, actionAccuracy: -2, calibrationError: Number.POSITIVE_INFINITY,
identityCoherence: .7, agencyBelief: .6, recentErrors: [.1, , Number.NaN, 4, -.5, '0.2'],
preferredStrategies: ['verify', 7, 'reflect', 'verify', 'x'.repeat(300)], recoveryCount: -4.2, lastRecoveryAt: -1,
continuityShock01: 7, postRecoveryIntegration01: -1, goalAlignment01: Number.NaN, goalAlignmentEMA01: .8,
selfConsistentAction11: actionScores, identityGateAcceptedCount: -1, identityGateRejectedCount: 2.5,
lastIdentityGate: { accepted: 'yes', reason: 'x', at: Infinity, evidenceRef: 123 } };
const sanitized = new SelfModelEngine(); assert.doesNotThrow(() => sanitized.restore(malformed)); const clean = sanitized.snapshot();
assert.equal(nestedGetterCalls, 0); assert.equal(clean.predictedAction, 'none'); assert.equal(clean.confidence, 1);
assert.equal(clean.actionAccuracy, 0); assert.equal(clean.calibrationError, defaultSelfModel().calibrationError);
assert.deepEqual(clean.recentErrors, [.1, 1, 0]); assert.deepEqual(clean.preferredStrategies, ['verify', 'reflect']);
assert.equal(clean.recoveryCount, 0); assert.equal(clean.lastRecoveryAt, 0); assert.equal(clean.continuityShock01, 1);
assert.equal(clean.postRecoveryIntegration01, 0); assert.equal(clean.goalAlignment01, defaultSelfModel().goalAlignment01);
assert.equal(clean.selfConsistentAction11.verify, .5); assert.equal(clean.selfConsistentAction11.explore, undefined);
assert.equal(clean.selfConsistentAction11.unknown, undefined); assert.equal(clean.selfConsistentAction11.rest, undefined);
assert.equal(clean.identityGateAcceptedCount, 0); assert.equal(clean.identityGateRejectedCount, 0); assert.equal(clean.lastIdentityGate, null);
console.log('self-model-restore-integrity: PASS');