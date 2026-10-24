import assert from 'node:assert/strict';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { EmotionAppraisalEngine } from '../src/organism/system/EmotionAppraisalEngine.ts';

const core = new OrganismCore(new MemoryStateStore(), {
  enableLanguage: false,
  performanceProfile: 'mobile',
  checkpointMinIntervalMs: 0,
  checkpointMaxDirtyCycles: 1,
});
await core.init();

await core.observe({
  text: 'WorkPass561 calibrated sensor readings; explore the stable lab signal.',
  novelty: .82,
  success: .9,
  surprise: .1,
  embodiment: {
    bodyEnergy01: .86,
    cognitiveCapacity01: .88,
    thermalStrain01: .12,
    sensoryFreshness01: .92,
    awake: true,
    battery01: .86,
    cpuLoad01: .16,
    ramPressure01: .18,
  },
});

const trace = core.snapshot().traces?.[0];
assert.ok(trace?.selected?.action, 'real Core observation must produce a selected decision');
assert.ok(
  typeof trace.emotionEpisodeId === 'string' && trace.emotionEpisodeId.length > 0,
  'decision trace must retain the emotion episode used before action selection',
);
const preActionEmotion = core.emotionAppraisalSnapshot().history.find(e => e.id === trace.emotionEpisodeId);
assert.ok(preActionEmotion, 'decision-time emotion ID must resolve to a retained appraisal episode');

await core.feedback({
  success: .88,
  reward: .72,
  surprise: .12,
  evidenceSource: 'device',
});

const restoredAffect = new EmotionAppraisalEngine();
restoredAffect.restore(core.emotionAppraisalSnapshot());
const contextual = restoredAffect.outcomeCalibration(trace.selected.action, trace.emotionEpisodeId);
assert.ok(contextual, 'real Core feedback must credit the action against its decision-time emotion');
assert.equal(contextual.attempts, 1);
assert.ok(restoredAffect.outcomeCalibration(trace.selected.action), 'legacy action-wide calibration must also be preserved');
assert.ok(restoredAffect.snapshot().history.some(e => e.id === trace.emotionEpisodeId), 'decision-time emotional provenance must persist with the affect snapshot');

const after = core.snapshot();
const b272Mismatch = after.facets?.memory?.eventLog?.some(e =>
  e.type === 'developmental-synthesis'
  && e.payload?.source === 'b272-outcome-credit-skipped'
  && e.payload?.reason === 'selected-action-mismatch'
);
console.log(JSON.stringify({
  status: 'PASS',
  test: 'workpass561-core-emotion-feedback-link',
  action: trace.selected.action,
  decisionEmotion: preActionEmotion.label,
  contextualOutcomeAttempts: contextual.attempts,
  b272MismatchWasSafelySkipped: Boolean(b272Mismatch),
}, null, 2));

core.stop?.();
