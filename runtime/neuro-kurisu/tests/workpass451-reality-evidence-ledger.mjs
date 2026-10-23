import assert from 'node:assert/strict';
import { RealityEvidenceLedger } from '../src/organism/system/RealityEvidenceLedger.ts';

const ledger = new RealityEvidenceLedger(128);
const first = ledger.record({
  tick: 12, at: 1200, realityClass: 'external-observation',
  claim: 'The front camera observed a door open.',
  confidence01: 0.91, independenceKey: 'device:camera-front', parentIds: ['decision:12'],
});
const totalAfterFirst = ledger.snapshot().total;
const replay = ledger.record({
  tick: 12, at: 1200, realityClass: 'external-observation',
  claim: 'The front camera observed a door open.',
  confidence01: 0.91, independenceKey: 'device:camera-front', parentIds: ['decision:12'],
});
assert.deepEqual(replay, first, 'identical evidence identity must be idempotent');
assert.equal(ledger.snapshot().total, totalAfterFirst);
assert.equal(ledger.claimAssessment(first.claim).externalSamples, 1);
assert.equal(ledger.claimAssessment(first.claim).independentExternalSources, 1);

// A simulator result remains separately classified and cannot be silently
// counted as an external observation of the same proposition.
ledger.record({
  tick: 13, at: 1300, realityClass: 'simulator',
  claim: first.claim, confidence01: 0.99, independenceKey: 'sim:planner',
});
const assessment = ledger.claimAssessment(first.claim);
assert.equal(assessment.externalSamples, 1);
assert.equal(assessment.simulationSamples, 1);
assert.equal(assessment.externalConfidence01, 0.91);
assert.equal(assessment.simulationConfidence01, 0.99);

// Malformed records fail closed instead of being coerced into plausible facts.
assert.throws(() => ledger.record({
  tick: -1, at: 1400, realityClass: 'external-observation',
  claim: 'Invalid tick', confidence01: 0.9, independenceKey: 'device:bad',
}), /reality-evidence-input-invalid/);
assert.throws(() => ledger.record({
  tick: 14, at: 1400, realityClass: 'external-observation',
  claim: 'Invalid confidence', confidence01: Number.NaN, independenceKey: 'device:bad',
}), /reality-evidence-input-invalid/);
let inputGetterCalls = 0;
const hostileInput = { tick: 15, at: 1500, realityClass: 'external-observation',
  claim: 'hostile', confidence01: 0.9, independenceKey: 'device:hostile' };
Object.defineProperty(hostileInput, 'claim', {
  enumerable: true, configurable: true, get() { inputGetterCalls++; return 'forged'; },
});
assert.throws(() => ledger.record(hostileInput), /reality-evidence-boundary-rejected/);
assert.equal(inputGetterCalls, 0);

// Restore validates each record and reconstructs only the declared contract.
const restored = new RealityEvidenceLedger();
restored.restore({
  version: 1, total: Number.POSITIVE_INFINITY,
  recent: [
    first,
    { ...first, id: 'invalid-score', confidence01: Number.POSITIVE_INFINITY },
    { ...first, id: 'unknown-class', realityClass: 'simulator-ish' },
    { ...first },
  ],
});
assert.equal(restored.snapshot().total, 1, 'invalid totals fall back to retained data size and duplicate IDs are collapsed');
assert.equal(restored.snapshot().recent.length, 1);
assert.equal(restored.snapshot().recent[0].id, first.id);

let restoreGetterCalls = 0;
const hostileState = {};
Object.defineProperty(hostileState, 'recent', {
  enumerable: true, get() { restoreGetterCalls++; return [first]; },
});
const clean = new RealityEvidenceLedger();
clean.restore(hostileState);
assert.equal(restoreGetterCalls, 0);
assert.equal(clean.snapshot().recent.length, 0);
assert.equal(clean.snapshot().total, 0);

console.log('WORKPASS451_REALITY_EVIDENCE_LEDGER=PASS deterministicIdentity=true idempotentReplay=true realityClassSeparated=true malformedEvidenceRejected=true hostileAccessorsRejected=true restoreQuarantinesInvalidRows=true');
