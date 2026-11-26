/**
 * P53 promotion gate: developmental policy change is only promotable on sealed,
 * independent holdout evidence. Repetition of one evaluation input set, or a
 * holdout value derived from the shadow inputs, must never unlock promotion.
 */
import assert from 'node:assert/strict';
import { P53DevelopmentalSelfModificationLab } from '../src/organism/developmental/P53DevelopmentalSelfModificationLab.ts';

const strongSignals = { predictionError01: .3, selfPredictionError01: .2, uncertainty01: .2, identityContinuity01: .94, grounding01: .9, causalAlignment01: .9 };

// 1. No holdout at all: never promotable, however good the signals are.
const labNoHoldout = new P53DevelopmentalSelfModificationLab();
const a = labNoHoldout.propose({ tick: 12, at: 1, predictionError01: .78, selfPredictionError01: .7, uncertainty01: .8, novelty01: .5, attention01: .4, identityContinuity01: .92 });
assert.ok(a);
let last = null;
for (let i = 0; i < 6; i += 1) last = labNoHoldout.test(a.id, strongSignals);
assert.equal(last?.status, 'testing', 'unverified holdout must never become promotable');
assert.equal(last?.holdoutVerified, false);
assert.equal(last?.holdout01, 0);
assert.equal(last?.evidenceCount, 1, 'repeating one input set is one piece of evidence, not six');
assert.equal(labNoHoldout.promote(a.id)?.status, 'testing', 'promote() must refuse unverified evidence');

// 2. periodic() does not self-promote on accumulated repetitions.
const labPeriodic = new P53DevelopmentalSelfModificationLab();
const periodicInput = { tick: 12, at: 1, predictionError01: .78, selfPredictionError01: .7, uncertainty01: .8, novelty01: .5, attention01: .4, identityContinuity01: .92, grounding01: .9, causalAlignment01: .9, learningAllocation01: .7, strategyAbstraction01: .7 };
let proposal = null;
for (let tick = 12; tick <= 120; tick += 12) {
  const out = labPeriodic.periodic({ ...periodicInput, tick, at: tick });
  if (out.proposal) proposal ??= out.proposal;
}
assert.ok(proposal, 'periodic() still proposes candidates');
assert.equal(labPeriodic.snapshot().promotions, 0, 'periodic() must not promote without sealed holdout evidence');

// 3. A holdout derived from the shadow inputs is rejected as non-independent.
const labFake = new P53DevelopmentalSelfModificationLab();
const b = labFake.propose({ tick: 12, at: 1, predictionError01: .78, selfPredictionError01: .7, uncertainty01: .8, novelty01: .5, attention01: .4, identityContinuity01: .92 });
const fake = labFake.test(b.id, { ...strongSignals, holdout: { observed01: .95, fingerprint: 'shadow-copy', independent: false } });
assert.equal(fake?.holdoutVerified, false);
assert.equal(fake?.status, 'testing');

// 4. Sealed independent holdout evidence unlocks promotion, and only once per fingerprint.
const labVerified = new P53DevelopmentalSelfModificationLab();
const c = labVerified.propose({ tick: 12, at: 1, predictionError01: .78, selfPredictionError01: .7, uncertainty01: .8, novelty01: .5, attention01: .4, identityContinuity01: .92 });
const holdout = { observed01: .95, fingerprint: 'holdout-manifest-sha256-abc', independent: true };
const first = labVerified.test(c.id, { ...strongSignals, holdout });
assert.equal(first?.holdoutVerified, true);
assert.equal(first?.status, 'promotable');
assert.equal(first?.evidenceCount, 1);
const repeat = labVerified.test(c.id, { ...strongSignals, holdout });
assert.equal(repeat?.evidenceCount, 1, 'identical holdout fingerprint must not add a second evidence row');
assert.equal(repeat?.status, 'promotable', 'a promotable candidate is not demoted by a repeated measurement');
const promoted = labVerified.promote(c.id, 2);
assert.equal(promoted?.status, 'promoted');
assert.ok(labVerified.snapshot().activeKnobProfile[promoted.knob] !== .5, 'promotion moves the bounded knob profile');

// 5. Restoring a legacy snapshot treats old candidates as unverified (fail closed).
const labRestore = new P53DevelopmentalSelfModificationLab();
labRestore.restore({ candidates: [{ ...promoted, holdoutVerified: undefined, evidenceFingerprints: undefined, status: 'promotable' }] });
const restored = labRestore.snapshot().candidates[0];
assert.equal(restored.holdoutVerified, false);
assert.deepEqual(restored.evidenceFingerprints, []);
assert.equal(labRestore.promote(restored.id)?.status, 'promotable', 'legacy promote request cannot pass the gate');

console.log('p53 independent holdout gate PASS');
