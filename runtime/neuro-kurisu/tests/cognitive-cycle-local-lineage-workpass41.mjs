import assert from 'node:assert/strict';
import { CognitiveEventFabric } from '../src/organism/system/CognitiveEventFabric.ts';
import { UnifiedCognitiveCycle } from '../src/organism/system/UnifiedCognitiveCycle.ts';

const fabric = new CognitiveEventFabric(128);
const ids = fabric.recordOperationalCycle({
  tick: 12,
  at: 1000,
  observation: { source: 'sensor', confidence01: .8 },
  prediction: { source: 'world-model', confidence01: .7 },
  action: { source: 'policy', confidence01: .75 },
  outcome: { source: 'simulator', confidence01: .6 },
  learning: { source: 'feedback', confidence01: .6 },
  selfUpdate: { source: 'self-model', confidence01: .7 },
});
const stageIds = {
  observation: ids.observation,
  prediction: ids.prediction,
  action: ids.action,
  outcome: ids.outcome,
  learning: ids.learning,
  'self-update': ids.selfUpdate,
};
assert.equal(fabric.verifyOperationalCycle(stageIds).complete, true);
assert.equal(fabric.verifyOperationalCycle(stageIds).integrity01, 1);

// An unrelated dangling parent damages global buffer integrity but not this valid cycle.
fabric.append({ tick: 11, stage: 'learning', source: 'old-corrupt-snapshot', parentIds: ['evicted-parent'], at: 900 });
assert.ok(fabric.snapshot().lineageIntegrity01 < 1);
assert.equal(fabric.verifyOperationalCycle(stageIds).complete, true);
const cycle = new UnifiedCognitiveCycle();
const evaluated = cycle.evaluate({ tick: 12, stageIds, parentIntegrity01: fabric.verifyOperationalCycle(stageIds).integrity01 });
assert.equal(evaluated.complete, true, 'historical dangling links must not poison a valid current cycle');

// Optional stages are part of the supplied trace: a wrong optional-stage identity must fail closed.
const extendedRawIds = fabric.recordOperationalCycle({
  tick: 20,
  at: 2000,
  observation: { source: 'sensor', confidence01: .8 },
  prediction: { source: 'world-model', confidence01: .7 },
  appraisal: { source: 'appraisal', confidence01: .7 },
  attention: { source: 'workspace', confidence01: .8 },
  memory: { source: 'active-memory', confidence01: .8 },
  goal: { source: 'goal-selector', confidence01: .8 },
  plan: { source: 'planner', confidence01: .8 },
  action: { source: 'policy', confidence01: .8 },
  outcome: { source: 'verified-outcome', confidence01: .8 },
  learning: { source: 'feedback', confidence01: .8 },
  selfUpdate: { source: 'self-model', confidence01: .8 },
});
const extendedStageIds = {
  ...extendedRawIds,
  'self-update': extendedRawIds.selfUpdate,
};
assert.equal(fabric.verifyOperationalCycle(extendedStageIds).complete, true);
const forgedOptionalStage = { ...extendedStageIds, plan: extendedStageIds.goal };
const rejectedOptionalStage = fabric.verifyOperationalCycle(forgedOptionalStage);
assert.equal(rejectedOptionalStage.complete, false, 'optional stages must not be ignored when supplied');
assert.ok(rejectedOptionalStage.invalidStages.some(value => value.includes('plan:expected-stage-plan')));
assert.ok(rejectedOptionalStage.missingEdges.includes('action->plan'));

// A broken current edge must still fail closed.
const action = fabric.recent(20).find(e => e.id === ids.action);
action.parentIds = action.parentIds.filter(id => id !== ids.prediction);
// Restore a deliberately corrupted snapshot through the actual persistence path.
const corrupted = new CognitiveEventFabric(128);
corrupted.restore({ ...fabric.snapshot(), recent: fabric.recent(20).map(e => e.id === ids.action ? { ...e, parentIds: e.parentIds.filter(id => id !== ids.prediction) } : e) });
const broken = corrupted.verifyOperationalCycle(stageIds);
assert.equal(broken.complete, false);
assert.ok(broken.missingEdges.includes('action->prediction'));

// Wrong stage or tick reuse cannot forge a complete cycle.
const wrongTickIds = { ...stageIds };
const extra = fabric.append({ tick: 13, stage: 'outcome', source: 'bad-cross-tick' });
wrongTickIds.outcome = extra.id;
const wrongTick = fabric.verifyOperationalCycle(wrongTickIds);
assert.equal(wrongTick.complete, false);
assert.ok(wrongTick.invalidStages.some(value => value.includes('tick-mismatch')));

// Restore must normalize corrupted snapshot fields and drop duplicate IDs instead
// of allowing them to overwrite the valid causal event map.
const sourceSnapshot = fabric.snapshot();
const latest = fabric.recent(20);
const sanitized = new CognitiveEventFabric(128);
sanitized.restore({ ...sourceSnapshot, recent: [
  ...latest,
  { ...latest[0], stage: 'made-up-stage' },
  { ...latest[0], payload: ['not', 'an', 'object'], confidence01: Number.POSITIVE_INFINITY },
  { id: latest[0].id, stage: latest[0].stage, tick: latest[0].tick, at: latest[0].at, source: 'duplicate-id', parentIds: [], confidence01: 1, payload: {} },
  null,
] });
assert.equal(new Set(sanitized.recent(128).map(event => event.id)).size, sanitized.recent(128).length);
assert.equal(sanitized.recent(128).find(event => event.id === latest[0].id)?.source, latest[0].source, 'duplicate IDs cannot replace the canonical newest event');
assert.deepEqual(sanitized.recent(128).find(event => event.id === latest[0].id)?.payload, latest[0].payload);

console.log(JSON.stringify({ pass: true, checks: 10, verifiedCycleIntegrity01: 1, unrelatedHistoricalDanglingIgnored: true, brokenCurrentEdgeRejected: true, crossTickForgeryRejected: true, restoreSanitization: true }));
