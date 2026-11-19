import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CognitiveEventFabric } from '../src/organism/system/CognitiveEventFabric.ts';

const phase = name => ({ source: `workpass71-${name}`, confidence01: 0.95, payload: { phase: name } });
const recordCore = (fabric, tick) => fabric.recordOperationalCycle({
  tick,
  observation: phase('observation'),
  prediction: phase('prediction'),
  action: phase('action'),
  outcome: phase('outcome'),
  learning: phase('learning'),
  selfUpdate: phase('self-update'),
});
const recordFull = (fabric, tick) => fabric.recordOperationalCycle({
  tick,
  observation: phase('observation'),
  prediction: phase('prediction'),
  appraisal: phase('appraisal'),
  attention: phase('attention'),
  memory: phase('memory'),
  goal: phase('goal'),
  plan: phase('plan'),
  action: phase('action'),
  outcome: phase('outcome'),
  learning: phase('learning'),
  selfUpdate: phase('self-update'),
});
const toStageMap = ids => ({ ...ids, 'self-update': ids.selfUpdate });

const coreFabric = new CognitiveEventFabric(128);
const coreIds = toStageMap(recordCore(coreFabric, 1));
const core = coreFabric.verifyOperationalCycle(coreIds);
assert.equal(core.complete, true, 'legacy six-stage verdict remains available');
assert.equal(core.coreComplete, true);
assert.equal(core.fullComplete, false);
assert.deepEqual(core.fullMissingStages, ['appraisal', 'attention', 'memory', 'goal', 'plan']);
assert.ok(core.fullIntegrity01 < 1);
assert.equal(core.coreIntegrity01, 1);

const fullFabric = new CognitiveEventFabric(128);
const fullIds = toStageMap(recordFull(fullFabric, 1));
const full = fullFabric.verifyOperationalCycle(fullIds);
assert.equal(full.complete, true);
assert.equal(full.coreComplete, true);
assert.equal(full.fullComplete, true);
assert.deepEqual(full.fullMissingStages, []);
assert.deepEqual(full.fullMissingEdges, []);
assert.equal(full.fullIntegrity01, 1);
assert.equal(full.integrity01, 1);

const aliased = fullFabric.verifyOperationalCycle({ ...fullIds, appraisal: fullIds.prediction });
assert.equal(aliased.coreComplete, true);
assert.equal(aliased.fullComplete, false);
assert.ok(aliased.invalidStages.some(value => value.startsWith('appraisal:')));

const withoutPlanFabric = new CognitiveEventFabric(128);
const withoutPlan = toStageMap(withoutPlanFabric.recordOperationalCycle({
  tick: 1,
  observation: phase('observation'),
  prediction: phase('prediction'),
  appraisal: phase('appraisal'),
  attention: phase('attention'),
  memory: phase('memory'),
  goal: phase('goal'),
  action: phase('action'),
  outcome: phase('outcome'),
  learning: phase('learning'),
  selfUpdate: phase('self-update'),
}));
const missingPlan = withoutPlanFabric.verifyOperationalCycle(withoutPlan);
assert.equal(missingPlan.coreComplete, true);
assert.equal(missingPlan.fullComplete, false);
assert.ok(missingPlan.fullMissingStages.includes('plan'));
assert.ok(missingPlan.fullMissingEdges.includes('plan->goal'));
assert.ok(missingPlan.fullMissingEdges.includes('action->plan'));

const snapshot = fullFabric.snapshot();
assert.equal(snapshot.coreCycleCoverage01, 1);
assert.equal(snapshot.fullCycleCoverage01, 1);

const runtime = await readFile(new URL('../src/organism/core/OrganismRuntime.ts', import.meta.url), 'utf8');
assert.match(runtime, /coreLineageComplete:cycleLineage\.coreComplete/);
assert.match(runtime, /fullLineageComplete:cycleLineage\.fullComplete/);
assert.match(runtime, /fullIntegrity01:cycleLineage\.fullIntegrity01/);

console.log('WORKPASS71_COGNITIVE_EVENT_LINEAGE=PASS');
