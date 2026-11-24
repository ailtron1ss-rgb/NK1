import assert from 'node:assert/strict';
import { buildReafferenceTemporalSignal } from '../src/organism/system/ReafferenceEvidenceCodec.ts';

const pending = ['decision-current'];
const match = buildReafferenceTemporalSignal({
  decisionId: 'decision-current', pendingDecisionIds: pending, sourceClass: 'device', independenceKey: 'sensor-1',
  assessment: { assessment: 'match', verified: true, confidence01: .88 },
  reconciliation: { status: 'supported', support01: .82, contradiction01: 0, independentSupportSources: 1, independentContradictionSources: 0, recommendedConfidence01: .78 },
  autonomous: true,
});
assert.equal(match.eligible, true);
assert.equal(match.reward01, 1);
assert.equal(match.direction, 'confirmed');
assert.equal(match.independent01 > .5, true);
assert.equal(buildReafferenceTemporalSignal({
  decisionId: 'decision-current', pendingDecisionIds: pending, sourceClass: 'device', independenceKey: 'sensor-1',
  assessment: { assessment: 'match', verified: true, confidence01: .95 },
  reconciliation: { status: 'supported', support01: .95, contradiction01: 0, independentSupportSources: 0, independentContradictionSources: 0, recommendedConfidence01: .91 },
}).reason, 'insufficient-independent-support', 'high confidence cannot replace an absent independent source');
assert.equal(buildReafferenceTemporalSignal({
  decisionId: 'decision-current', pendingDecisionIds: pending, sourceClass: 'device', independenceKey: 'sensor-1',
  assessment: { assessment: 'match', verified: true, confidence01: .95 },
  reconciliation: { status: 'unresolved', support01: .95, contradiction01: 0, independentSupportSources: 1, independentContradictionSources: 0, recommendedConfidence01: .91 },
}).eligible, false, 'a verified local match without supported/corroborated reconciliation is not enough');
assert.equal(buildReafferenceTemporalSignal({
  decisionId: 'execution-id-is-not-decision-id', pendingDecisionIds: pending, sourceClass: 'device', independenceKey: 'sensor-1',
  assessment: { assessment: 'match', verified: true, confidence01: .9 },
  reconciliation: { status: 'supported', support01: .9, contradiction01: 0, independentSupportSources: 1, independentContradictionSources: 0, recommendedConfidence01: .8 },
}).reason, 'decision-not-pending');
assert.equal(buildReafferenceTemporalSignal({
  decisionId: 'decision-current', pendingDecisionIds: pending, sourceClass: 'simulator', independenceKey: 'sim-1',
  assessment: { assessment: 'match', verified: true, confidence01: .99 },
  reconciliation: { status: 'supported', support01: .99, contradiction01: 0, independentSupportSources: 2, independentContradictionSources: 0, recommendedConfidence01: .95 },
}).reason, 'non-external-source');
const contradicted = buildReafferenceTemporalSignal({
  decisionId: 'decision-current', pendingDecisionIds: pending, sourceClass: 'device', independenceKey: 'sensor-1',
  assessment: { assessment: 'mismatch', verified: false, confidence01: .02 },
  reconciliation: { status: 'disputed', support01: 0, contradiction01: .88, independentSupportSources: 0, independentContradictionSources: 2, recommendedConfidence01: .82 },
});
assert.equal(contradicted.eligible, true);
assert.equal(contradicted.reward01, 0);
assert.equal(contradicted.direction, 'contradicted');
assert.equal(buildReafferenceTemporalSignal({
  decisionId: 'decision-current', pendingDecisionIds: pending, sourceClass: 'device', independenceKey: 'sensor-1',
  assessment: { assessment: 'mismatch', verified: false, confidence01: .02 },
  reconciliation: { status: 'disputed', support01: 0, contradiction01: .81, independentSupportSources: 0, independentContradictionSources: 1, recommendedConfidence01: .75 },
}).reason, 'insufficient-independent-contradiction');
assert.equal(buildReafferenceTemporalSignal({
  decisionId: 'decision-current', pendingDecisionIds: pending, sourceClass: 'device', independenceKey: 'sensor-1',
  assessment: { assessment: 'match', verified: false, confidence01: .4 },
  reconciliation: { status: 'supported', support01: .4, contradiction01: 0, independentSupportSources: 1, independentContradictionSources: 0, recommendedConfidence01: .35 },
}).eligible, false, 'unverified positive outcomes cannot enter canonical temporal credit');
console.log('BIG_PASS_123_REAFFERENCE_CODEC=PASS', JSON.stringify({ confirmed: match.eligible, contradicted: contradicted.eligible, lowEvidenceRejected: true }));
