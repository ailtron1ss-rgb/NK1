import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { RealityEvidenceLedger } from '../src/organism/system/RealityEvidenceLedger.ts';

const ledger = new RealityEvidenceLedger();
ledger.record({
  eventId: 'reality-gate-source-a',
  tick: 1,
  at: 1000,
  realityClass: 'device-observation',
  claim: 'device reports stable temperature',
  confidence01: 0.91,
  independenceKey: 'sensor-a',
  parentIds: [],
});
const oneSource = ledger.claimAssessment('device reports stable temperature');
assert.equal(oneSource.promotionAllowed, true, 'one strong source may ground a claim');
assert.equal(oneSource.independentPromotionAllowed, false, 'one source must not qualify for consequential promotion');

ledger.record({
  eventId: 'reality-gate-source-b',
  tick: 2,
  at: 2000,
  realityClass: 'external-observation',
  claim: 'device reports stable temperature',
  confidence01: 0.88,
  independenceKey: 'provider-b',
  parentIds: [],
});
const twoSources = ledger.claimAssessment('device reports stable temperature');
assert.equal(twoSources.qualifiedIndependentExternalSources, 2);
assert.equal(twoSources.independentPromotionAllowed, true);

// A qualified external observation for the opposite value of the same explicit
// field must veto promotion, even when the target claim has two agreeing sources.
ledger.record({
  eventId: 'reality-gate-contradictory-source',
  tick: 3,
  at: 3000,
  realityClass: 'device-observation',
  claim: 'temperature: unstable',
  confidence01: 0.89,
  independenceKey: 'sensor-c',
  parentIds: [],
});
const disputed = ledger.claimAssessment('temperature: stable');
assert.equal(disputed.contradictionDetected, true, 'explicit field/value disagreement must be surfaced');
assert.equal(disputed.independentContradictionSources, 1);
assert.equal(disputed.independentPromotionAllowed, false, 'contradictory external evidence must veto promotion');
assert.equal(disputed.promotionReason, 'qualified-external-contradiction-detected');

// A low-confidence contradictory report is retained but must not veto by itself.
ledger.record({
  eventId: 'reality-gate-low-confidence-contradiction',
  tick: 4,
  at: 4000,
  realityClass: 'external-observation',
  claim: 'temperature: frozen',
  confidence01: 0.42,
  independenceKey: 'sensor-d',
  parentIds: [],
});
assert.equal(ledger.claimAssessment('temperature: stable').independentPromotionAllowed, false,
  'the earlier qualified contradiction must continue to veto promotion');
assert.equal(ledger.claimAssessment('temperature: stable').independentContradictionSources, 1,
  'low-confidence contradictory reports must not inflate qualified contradiction sources');

// The veto must survive persistence/restore rather than existing only in transient memory.
const restored = new RealityEvidenceLedger();
restored.restore(ledger.snapshot());
const restoredDispute = restored.claimAssessment('temperature: stable');
assert.equal(restoredDispute.contradictionDetected, true);
assert.equal(restoredDispute.independentPromotionAllowed, false);
assert.equal(restoredDispute.promotionReason, 'qualified-external-contradiction-detected');

// A different field is not a contradiction, and natural-language claims are
// intentionally not guessed into a field/value pair.
ledger.record({
  eventId: 'reality-gate-unrelated-field',
  tick: 5,
  at: 5000,
  realityClass: 'device-observation',
  claim: 'humidity: high',
  confidence01: 0.96,
  independenceKey: 'sensor-e',
  parentIds: [],
});
assert.equal(ledger.claimAssessment('temperature: stable').contradictionDetected, true,
  'unrelated fields must not erase an existing qualified contradiction');
assert.equal(ledger.claimAssessment('device reports stable temperature').contradictionDetected, false);

const engineSource = await readFile(new URL('../src/organism/learning/P23LearningEngine.ts', import.meta.url), 'utf8');
const start = engineSource.indexOf('approveRealityCorroboratedSkillCandidate(');
assert.notEqual(start, -1, 'P23 must expose the consequential reality-corroborated promotion path');
const end = engineSource.indexOf('\n  approveVerifiedSkillCandidate(', start);
assert.ok(end > start, 'P23 reality gate must remain a distinct method');
const gate = engineSource.slice(start, end);
assert.match(gate, /ledger instanceof RealityEvidenceLedger/, 'only the canonical ledger type is accepted');
assert.match(gate, /independentPromotionAllowed!==true/, 'the stronger independent-promotion signal is mandatory');
assert.match(gate, /qualifiedIndependentExternalSources<2/, 'two confidence-qualified independent sources are mandatory');
assert.match(gate, /candidatePayloadFingerprint:string/, 'the gate must require an exact candidate payload fingerprint');
assert.match(gate, /staged\.payloadFingerprint!==candidatePayloadFingerprint/, 'unrelated or stale candidate payloads must be rejected');
assert.match(gate, /evaluation\?\.payloadFingerprint!==candidatePayloadFingerprint/, 'the evaluated payload must equal the corroborated payload');
assert.match(gate, /staged\.status!=='shadow'/, 'only a currently staged shadow candidate may use the gate');
assert.ok(gate.indexOf('independentPromotionAllowed') < gate.indexOf('approveIndependentlyEvaluatedSkillCandidate('),
  'reality corroboration must be checked before the existing approval path');
assert.match(gate, /approveIndependentlyEvaluatedSkillCandidate\(/,
  'the reality gate must retain the independent evaluation, signed evidence, and store approval path');

console.log('WORKPASS529_P23_REALITY_PROMOTION_GATE=PASS one-source-blocked two-independent-qualified-sources-required canonical-ledger-and-existing-gates-preserved');
