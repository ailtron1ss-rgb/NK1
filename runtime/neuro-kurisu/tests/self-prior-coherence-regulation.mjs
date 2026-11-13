import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SelfPriorDensityModel, SELF_PRIOR_REPRESENTATION_ID } from '../src/organism/cognition/SelfPriorDensityModel.ts';
import { IntrinsicMotivationEngine } from '../src/organism/cognition/IntrinsicMotivationEngine.ts';
import { IntrinsicMotivationGoalCoupling } from '../src/organism/cognition/IntrinsicMotivationGoalCoupling.ts';
import { B272EndogenousGoalGenesis } from '../src/organism/cognition/B272EndogenousGoalGenesis.ts';

const vector = (value) => new Array(16).fill(value);
const prior = new SelfPriorDensityModel(16);
for (let tick = 1; tick <= 32; tick += 1) {
  const familiar = prior.observe(vector(0), tick);
  assert.equal(familiar.mismatch01, 0);
}
const firstNovel = prior.observe(vector(1), 33);
assert.ok(firstNovel.confidence01 > 0.95);
assert.ok(firstNovel.mismatch01 > 0.7, 'a novel self-state must produce a strong pre-update prediction error');
let adapted = firstNovel;
for (let tick = 34; tick <= 133; tick += 1) adapted = prior.observe(vector(1), tick);
assert.ok(adapted.mismatch01 < 0.3, 'a persistent new self-state must eventually become familiar');
assert.ok(prior.snapshot().mean.every(value => value > 0.9));
assert.equal(prior.snapshot().sampleCount, 133);
assert.equal(prior.snapshot().representationId, SELF_PRIOR_REPRESENTATION_ID);

// A single extreme observation is resisted and must not be mistaken for a regime shift.
const transient = new SelfPriorDensityModel(16);
for (let tick = 1; tick <= 32; tick += 1) transient.observe(vector(0), tick);
const outlier = transient.observe(vector(4), 33);
assert.ok(outlier.mismatch01 > 0.9);
assert.equal(transient.snapshot().highMismatchStreak, 1);
const returnToBaseline = transient.observe(vector(0), 34);
assert.ok(returnToBaseline.mismatch01 < 0.2);
assert.equal(transient.snapshot().highMismatchStreak, 0);
assert.ok(Math.abs(transient.snapshot().mean[0]) < 0.05,
  'an isolated outlier must not rewrite the learned self-prior');

// Persistent gradual drift should trigger the bounded regime-shift adapter rather
// than remain permanently surprising or force a return to an obsolete identity.
const drifting = new SelfPriorDensityModel(16);
for (let tick = 1; tick <= 32; tick += 1) drifting.observe(vector(0), tick);
let driftPrediction;
for (let tick = 1; tick <= 100; tick += 1) driftPrediction = drifting.observe(vector(tick * 0.01), 32 + tick);
assert.ok(drifting.snapshot().highMismatchStreak >= 5,
  'persistent self-state drift must activate the regime-shift adapter');
assert.ok(drifting.snapshot().mean[0] > 0.85,
  'the learned self-prior must follow a persistent legitimate drift');
assert.ok(driftPrediction.mismatch01 < 0.5,
  'the adapted prior must keep gradual drift below runaway surprise');

// A sparse one-coordinate change is measured less strongly than a full-vector shift.
const oneAxis = new SelfPriorDensityModel(16);
for (let tick = 1; tick <= 32; tick += 1) oneAxis.observe(vector(0), tick);
const oneAxisVector = vector(0);
oneAxisVector[0] = 1;
const oneAxisMismatch = oneAxis.observe(oneAxisVector, 33);
assert.ok(oneAxisMismatch.mismatch01 > 0);
assert.ok(oneAxisMismatch.mismatch01 < firstNovel.mismatch01);

// State is representation-bound. A changed latent basis cannot inherit stale moments.
const differentBasis = new SelfPriorDensityModel(16, 'b270-self-latent-v2');
differentBasis.restore(prior.snapshot());
assert.equal(differentBasis.snapshot().sampleCount, 0);
assert.equal(differentBasis.snapshot().representationId, 'b270-self-latent-v2');
const legacyVersion = new SelfPriorDensityModel(16);
legacyVersion.restore({ ...prior.snapshot(), version: 2 });
assert.equal(legacyVersion.snapshot().sampleCount, 0,
  'pre-v3 snapshots without regime-shift state must reset rather than fabricate continuity');

// Restore rejects accessors, proxies, sparse vectors and inconsistent counters without executing getters.
let getterInvoked = false;
const accessorSnapshot = Object.create(null);
Object.defineProperty(accessorSnapshot, 'version', {
  get() { getterInvoked = true; throw new Error('getter must not run'); },
});
const hostileRestore = new SelfPriorDensityModel(16);
hostileRestore.restore(accessorSnapshot);
assert.equal(getterInvoked, false);
assert.equal(hostileRestore.snapshot().sampleCount, 0);
const proxyRestore = new SelfPriorDensityModel(16);
proxyRestore.restore(new Proxy({}, { getPrototypeOf() { throw new Error('proxy trap'); } }));
assert.equal(proxyRestore.snapshot().sampleCount, 0);
const sparseMean = new Array(16);
const sparseRestore = new SelfPriorDensityModel(16);
sparseRestore.restore({
  ...prior.snapshot(),
  mean: sparseMean,
});
assert.equal(sparseRestore.snapshot().sampleCount, 0);
const forgedCounter = new SelfPriorDensityModel(16);
forgedCounter.restore({
  ...prior.snapshot(),
  sampleCount: 24,
  effectiveSamples: 0,
});
assert.equal(forgedCounter.snapshot().sampleCount, 0);

const timestampOrdered = new SelfPriorDensityModel(16);
timestampOrdered.observe(vector(0), 100);
const beforeTimestampRejection = timestampOrdered.snapshot();
assert.throws(() => timestampOrdered.observe(vector(1), 99), /timestamp-out-of-order/);
assert.deepEqual(timestampOrdered.snapshot(), beforeTimestampRejection);
assert.throws(() => timestampOrdered.observe(vector(1), Number.NaN), /timestamp-must-be-finite/);
assert.deepEqual(timestampOrdered.snapshot(), beforeTimestampRejection);
assert.throws(() => timestampOrdered.observe([0, 1], 101), /dimension-mismatch/);
assert.throws(() => timestampOrdered.observe(vector(Number.NaN), 101), /finite-and-bounded/);

// Self-state prediction error is a coherence signal, not a homeostatic deficit.
const cycle = {
  tick: 1,
  selfLatent: vector(0.2),
  worldLatent: vector(0.1),
  needs: { energy01: 0.8, uncertainty01: 0.65, novelty01: 0.55, goalPressure01: 0.3, socialNeed01: 0.25 },
  traits: { curiosity: 0.8, 'truth-seeking': 0.8, 'self-reflection': 0.7, 'self-preservation': 0.7, care: 0.6, 'social-attunement': 0.55, persistence: 0.75 },
  predictionError01: 0.55,
  autobiographicalContinuity01: 0.8,
  identityContinuity01: 0.82,
  intrinsicReward01: 0.2,
  lastAction: null,
  lastReward01: 0.5,
};
const drive = {
  uncertainty: 0.9, predictionError: 0.8, novelty: 0.95, goalPressure: 0.7,
  socialNeed: 0.4, energy: 0.8, lastSuccess: 0.4, worldEvidenceQuality: 0.8,
};
const coupling = new IntrinsicMotivationGoalCoupling(
  new IntrinsicMotivationEngine(),
  new B272EndogenousGoalGenesis(),
  new SelfPriorDensityModel(16),
);
for (let tick = 1; tick <= 32; tick += 1) {
  coupling.step({ cycle: { ...cycle, tick }, drive, driveConfidence01: 1, selfObservation: vector(0), at: tick });
}
const baselineDrive = new IntrinsicMotivationEngine().update(drive);
const mismatchResult = coupling.step({
  cycle: { ...cycle, tick: 33 },
  drive,
  driveConfidence01: 1,
  selfObservation: vector(1),
  at: 33,
});
assert.ok(mismatchResult.selfPrior.mismatch01 > 0.7);
assert.ok(mismatchResult.driveState.coherence > baselineDrive.coherence,
  'self-state surprise should increase model-reconciliation pressure');
assert.equal(mismatchResult.driveState.homeostatic, baselineDrive.homeostatic,
  'identity novelty must not masquerade as an energy deficit');
assert.ok(mismatchResult.goal.predictedFutureValue01 > 0);

// Rejected ticks roll the learned self-prior back with the other two owners.
const beforeRollback = coupling.snapshot();
assert.throws(() => coupling.step({
  cycle: { ...cycle, tick: 32 },
  drive,
  driveConfidence01: 1,
  selfObservation: vector(0.5),
  at: 32,
}), /timestamp-out-of-order/);
assert.deepEqual(coupling.snapshot(), beforeRollback);
assert.throws(() => coupling.step({
  cycle: { ...cycle, tick: Number.NaN },
  drive,
  driveConfidence01: 1,
  selfObservation: vector(0.5),
  at: 34,
}), /tick/);
assert.deepEqual(coupling.snapshot(), beforeRollback);
assert.throws(() => coupling.step({
  cycle,
  drive,
  driveConfidence01: 1,
  selfObservation: [0, 1],
  at: 35,
}), /dimension-mismatch/);
assert.deepEqual(coupling.snapshot(), beforeRollback);

// The core owns this prior through the existing ConsciousnessFacet and persists it.
const coreSource = await readFile(new URL('../src/organism/core/OrganismCore.ts', import.meta.url), 'utf8');
const typesSource = await readFile(new URL('../src/organism/core/types.ts', import.meta.url), 'utf8');
const migrationSource = await readFile(new URL('../src/organism/persistence/StateMigrations.ts', import.meta.url), 'utf8');
assert.match(coreSource, /selfObservation:\s*b270PostGerminalState\.selfLatent/);
assert.match(coreSource, /selfPrior\.restore\(this\.persisted\.facets\.consciousness\.selfPrior\)/);
assert.match(coreSource, /facets\.consciousness\.selfPrior\s*=\s*this\.cognitiveRuntime\.intrinsicMotivationGoalCoupling\.selfPrior\.snapshot\(\)/);
assert.match(typesSource, /selfPrior:\s*(?:import\([^)]*\)\.)?SelfPriorDensityState/);
assert.match(migrationSource, /selfPrior:\s*defaultSelfPriorDensityState\(\)/);

console.log('SELF_PRIOR_COHERENCE_REGULATION=PASS');
