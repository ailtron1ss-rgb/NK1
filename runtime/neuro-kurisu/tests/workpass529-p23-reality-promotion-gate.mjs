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

const engineSource = await readFile(new URL('../src/organism/learning/P23LearningEngine.ts', import.meta.url), 'utf8');
const start = engineSource.indexOf('approveRealityCorroboratedSkillCandidate(');
assert.notEqual(start, -1, 'P23 must expose the consequential reality-corroborated promotion path');
const end = engineSource.indexOf('\n  approveVerifiedSkillCandidate(', start);
assert.ok(end > start, 'P23 reality gate must remain a distinct method');
const gate = engineSource.slice(start, end);
assert.match(gate, /ledger instanceof RealityEvidenceLedger/, 'only the canonical ledger type is accepted');
assert.match(gate, /independentPromotionAllowed!==true/, 'the stronger independent-promotion signal is mandatory');
assert.match(gate, /qualifiedIndependentExternalSources<2/, 'two confidence-qualified independent sources are mandatory');
assert.ok(gate.indexOf('independentPromotionAllowed') < gate.indexOf('approveIndependentlyEvaluatedSkillCandidate('),
  'reality corroboration must be checked before the existing approval path');
assert.match(gate, /approveIndependentlyEvaluatedSkillCandidate\(/,
  'the reality gate must retain the independent evaluation, signed evidence, and store approval path');

console.log('WORKPASS529_P23_REALITY_PROMOTION_GATE=PASS one-source-blocked two-independent-qualified-sources-required canonical-ledger-and-existing-gates-preserved');
