import assert from 'node:assert/strict';
import { P25ScientificDevelopmentEngine, defaultP25ScientificDevelopment } from '../src/organism/learning/P25ScientificDevelopmentEngine.ts';

const e = new P25ScientificDevelopmentEngine();
e.restore(defaultP25ScientificDevelopment());

const exp = e.recordControlledExperiment({
  name: 'policy-ablation-sandbox',
  controlLabel: 'baseline-policy',
  treatmentLabel: 'learned-policy',
  metric: 'task-success',
  controlValue: 0.42,
  treatmentValue: 0.68,
  sampleSize: 40,
  independentConditions: true,
});
assert.equal(exp.independentConditions, true);
assert.ok(exp.delta > 0);

const ev1 = e.recordEvaluation({taskId:'holdout-1',suite:'truthfulness',phase:'holdout',score01:0.92,criteriaPassed:9,criteriaTotal:10,evaluator:'external'});
const ev2 = e.recordEvaluation({taskId:'holdout-2',suite:'truthfulness',phase:'holdout',score01:0.88,criteriaPassed:9,criteriaTotal:10,evaluator:'external'});
assert.equal(ev1.evidenceLevel, 'observed');
assert.equal(ev2.criteriaPassed, 9);

const ab = e.recordAblation({module:'adaptive-policy',baselineScore01:0.82,ablatedScore01:0.57,sampleSize:20});
assert.equal(ab.changed, true);

const claim = e.upsertClaim('learned-policy improves task success', 'controlled', 'still requires longitudinal evidence');
assert.equal(claim.evidenceLevel, 'controlled');
assert.ok(claim.evidenceCount >= 1);

const campaign = e.startCampaign('prove measurable long-horizon improvement without internal self-report');
assert.equal(campaign.stage, 'design');
const completed = e.updateCampaign(campaign.id, 'completed', [exp.id, ev1.id, ev2.id, ab.id]);
assert.equal(completed.stage, 'completed');
assert.equal(completed.completedAt != null, true);

console.log('P25_SCIENTIFIC_DEVELOPMENT=PASS', JSON.stringify(e.snapshot().metrics));
