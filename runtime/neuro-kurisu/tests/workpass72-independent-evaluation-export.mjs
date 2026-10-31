import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { buildIndependentEvaluationEvidenceBundle, independentEvidenceDigest } from '../src/organism/system/IndependentEvaluationEvidence.ts';

const stages = ['observation','prediction','appraisal','attention','memory','goal','plan','action','outcome','learning','self-update'];
const ids = Object.fromEntries(stages.map((stage, index) => [stage, `event-${index + 1}`]));
const parents = {
  observation: [],
  prediction: [ids.observation],
  appraisal: [ids.observation, ids.prediction],
  attention: [ids.appraisal, ids.prediction],
  memory: [ids.attention, ids.observation],
  goal: [ids.appraisal, ids.memory],
  plan: [ids.goal, ids.prediction],
  action: [ids.plan, ids.prediction, ids.observation],
  outcome: [ids.action, ids.prediction],
  learning: [ids.outcome, ids.action],
  'self-update': [ids.learning, ids.outcome],
};
const fullEvents = stages.map((stage, index) => ({
  id: ids[stage], tick: 41, at: 1000 + index, stage,
  source: 'private-source-that-must-not-leak', parentIds: parents[stage],
  external: stage === 'observation' || stage === 'outcome', confidence01: 0.875,
  payload: { text: 'private-user-message-must-not-leak', claim: 'private-factual-claim' },
}));
const tick42Ids = Object.fromEntries(stages.map((stage, index) => [stage, `event-42-${index + 1}`]));
const tick42Parents = {
  observation: [],
  prediction: [tick42Ids.observation],
  appraisal: [tick42Ids.observation, tick42Ids.prediction],
  attention: [tick42Ids.appraisal, tick42Ids.prediction],
  memory: [tick42Ids.attention, tick42Ids.observation],
  goal: [tick42Ids.appraisal, tick42Ids.memory],
  plan: [tick42Ids.goal, tick42Ids.prediction],
  action: [tick42Ids.plan, tick42Ids.prediction, tick42Ids.observation],
  outcome: [tick42Ids.action, tick42Ids.prediction],
  learning: [tick42Ids.outcome, tick42Ids.action],
  'self-update': [tick42Ids.learning, tick42Ids.outcome],
};
const incompleteEvents = stages
  .filter(stage => stage !== 'plan')
  .map((stage, index) => ({
    ...fullEvents.find(event => event.stage === stage),
    id: tick42Ids[stage],
    tick: 42,
    at: 2000 + index,
    parentIds: tick42Parents[stage],
  }));
const realityEvidence = {
  version: 1, total: 3, externalCount: 2, simulatorCount: 1, independentSources: 2,
  recent: [
    { id:'r1',tick:41,at:1001,realityClass:'external-observation',claim:'private claim',confidence01:.9,independenceKey:'secret-camera-a',parentIds:[] },
    { id:'r2',tick:41,at:1002,realityClass:'device-observation',claim:'private claim',confidence01:.8,independenceKey:'secret-device-b',parentIds:[] },
    { id:'r3',tick:41,at:1003,realityClass:'simulator',claim:'private claim',confidence01:.7,independenceKey:'secret-sim-c',parentIds:[] },
  ],
};
const bundle = buildIndependentEvaluationEvidenceBundle({
  events:[...fullEvents,...incompleteEvents], eventTotal:22, eventBuffered:22,
  realityEvidence,
  cycleCounters:{version:2,cycles:2,coreCompleteCycles:2,fullCompleteCycles:1,completeCycles:1,incompleteCycles:1,brokenLineages:0,meanCoreStageCoverage01:1,meanStageCoverage01:.5,meanCausalContinuity01:.9,lastTick:42,lastCoreComplete:true,lastFullComplete:false,lastComplete:false,lastCoreMissingStages:[],lastMissingStages:['plan']},
  exportedAtMs:2000,
});
assert.equal(bundle.schemaVersion, 'nk1.independent-evaluation-evidence.v2');
assert.equal(bundle.cycles.length, 2);
assert.equal(bundle.timeline.cycleCount, 2);
assert.equal(bundle.timeline.algorithm, 'sha256-canonical-json-v1');
assert.equal(bundle.cycles[0].sequenceIndex, 0);
assert.equal(bundle.cycles[0].previousChainDigest, null);
assert.equal(bundle.cycles[1].sequenceIndex, 1);
assert.equal(bundle.cycles[1].previousChainDigest, bundle.cycles[0].chainDigest);
assert.equal(bundle.timeline.headDigest, bundle.cycles[1].chainDigest);
assert.equal(bundle.cycles[0].events.length, 11);
assert.equal(bundle.cycles[1].events.length, 10);
assert.equal(bundle.realityEvidence.classes['external-observation'], 1);
assert.equal(bundle.realityEvidence.classes['simulator'], 1);
assert.equal(bundle.bundleDigest, independentEvidenceDigest(Object.fromEntries(Object.entries(bundle).filter(([key]) => key !== 'bundleDigest'))));
const serialized = JSON.stringify(bundle);
for (const secret of ['private-user-message','private-factual-claim','private claim','private-source-that-must-not-leak','secret-camera-a','secret-device-b','secret-sim-c']) {
  assert.equal(serialized.includes(secret), false, `raw sensitive field leaked: ${secret}`);
}
const output = process.argv[2] || '/tmp/nk1-workpass72-evidence.json';
writeFileSync(output, JSON.stringify(bundle, null, 2) + '\n', 'utf8');
console.log(`WORKPASS72_INDEPENDENT_EVIDENCE_EXPORT=PASS cycles=${bundle.cycles.length} events=${bundle.eventWindow.exportedOperationalEvents} digest=${bundle.bundleDigest}`);
