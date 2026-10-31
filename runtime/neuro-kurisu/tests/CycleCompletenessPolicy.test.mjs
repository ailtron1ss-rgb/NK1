import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CORE_CYCLE_STAGES,
  FULL_COGNITIVE_CYCLE_STAGES,
  evaluateCycleCompleteness,
} from '../src/organism/system/CycleCompletenessPolicy.ts';

const stageIds = stages => Object.fromEntries(stages.map((stage, index) => [stage, `event-${index + 1}-${stage}`]));
const intactLineage = { complete: true, fullComplete: true, integrity01: 1, fullIntegrity01: 1 };
const coreOnlyLineage = { complete: true, fullComplete: false, integrity01: 1, fullIntegrity01: 0.5 };

test('six-stage trace remains core-complete but cannot be full-complete', () => {
  const result = evaluateCycleCompleteness({ stageIds: stageIds(CORE_CYCLE_STAGES), lineage: intactLineage });
  assert.equal(result.coreComplete, true);
  assert.equal(result.fullComplete, false);
  assert.deepEqual(result.fullMissingStages, ['appraisal', 'attention', 'memory', 'goal', 'plan']);
  assert.equal(result.coreCoverage01, 1);
  assert.equal(result.fullCoverage01, 6 / 11);
});

test('eleven unique stages and an independently verified full lineage are full-complete', () => {
  const result = evaluateCycleCompleteness({ stageIds: stageIds(FULL_COGNITIVE_CYCLE_STAGES), lineage: intactLineage });
  assert.equal(result.coreComplete, true);
  assert.equal(result.fullComplete, true);
  assert.equal(result.fullCoverage01, 1);
  assert.equal(result.reason, 'all-eleven-stages-and-causal-lineage-verified');
});

test('stage coverage alone cannot substitute for event-fabric full-lineage verification', () => {
  const result = evaluateCycleCompleteness({ stageIds: stageIds(FULL_COGNITIVE_CYCLE_STAGES), lineage: coreOnlyLineage });
  assert.equal(result.coreComplete, true);
  assert.equal(result.fullComplete, false);
});

test('missing a core stage fails both tiers', () => {
  const ids = stageIds(FULL_COGNITIVE_CYCLE_STAGES);
  delete ids.observation;
  const result = evaluateCycleCompleteness({ stageIds: ids, lineage: intactLineage });
  assert.equal(result.coreComplete, false);
  assert.equal(result.fullComplete, false);
});

test('duplicate event IDs fail full completion and fail core when a core ID is aliased', () => {
  const ids = stageIds(FULL_COGNITIVE_CYCLE_STAGES);
  ids.memory = ids.observation;
  const result = evaluateCycleCompleteness({ stageIds: ids, lineage: intactLineage });
  assert.equal(result.coreComplete, false);
  assert.equal(result.fullComplete, false);
  assert.equal(result.duplicatedIds.length, 1);
});

test('duplicate optional-stage IDs cannot satisfy full completion', () => {
  const ids = stageIds(FULL_COGNITIVE_CYCLE_STAGES);
  ids.goal = ids.memory;
  const result = evaluateCycleCompleteness({ stageIds: ids, lineage: intactLineage });
  assert.equal(result.coreComplete, true);
  assert.equal(result.fullComplete, false);
});

test('broken core or full causal lineage fails closed', () => {
  const broken = { complete: false, fullComplete: false, integrity01: 0.4, fullIntegrity01: 0.4 };
  const result = evaluateCycleCompleteness({ stageIds: stageIds(FULL_COGNITIVE_CYCLE_STAGES), lineage: broken });
  assert.equal(result.coreComplete, false);
  assert.equal(result.fullComplete, false);
});

test('inherited properties never count as stage evidence', () => {
  const ids = Object.assign(Object.create({ observation: 'inherited-observation' }), stageIds(FULL_COGNITIVE_CYCLE_STAGES.filter(x => x !== 'observation')));
  const result = evaluateCycleCompleteness({ stageIds: ids, lineage: intactLineage });
  assert.equal(result.coreComplete, false);
  assert.equal(result.fullComplete, false);
  assert.ok(result.fullMissingStages.includes('observation'));
});

test('invalid inputs fail closed', () => {
  assert.throws(() => evaluateCycleCompleteness(null), /input must be an object/);
  assert.throws(() => evaluateCycleCompleteness({ stageIds: [], lineage: intactLineage }), /stageIds/);
  assert.throws(() => evaluateCycleCompleteness({ stageIds: {}, lineage: { ...intactLineage, fullIntegrity01: 1.1 } }), /fullIntegrity01/);
});
