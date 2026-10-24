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

// Natural-language claims are intentionally not guessed into a field/value pair.
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
