import assert from 'node:assert/strict';
import { UnifiedCognitiveCycle } from '../src/organism/system/UnifiedCognitiveCycle.ts';
import { CORE_CYCLE_STAGES, FULL_COGNITIVE_CYCLE_STAGES } from '../src/organism/system/CycleCompletenessPolicy.ts';

const ids = stages => Object.fromEntries(stages.map((stage, index) => [stage, `tick-event-${index + 1}-${stage}`]));
const completeInput = (tick, stageIds) => ({
  tick, stageIds, parentIntegrity01: 1,
  coreLineageComplete: true, fullLineageComplete: true, fullIntegrity01: 1,
});

const cycle = new UnifiedCognitiveCycle();
const coreOnly = cycle.evaluate({
  tick: 1, stageIds: ids(CORE_CYCLE_STAGES), parentIntegrity01: 1,
  coreLineageComplete: true, fullLineageComplete: false, fullIntegrity01: 6 / 11,
});
assert.equal(coreOnly.coreComplete, true);
assert.equal(coreOnly.fullComplete, false);
assert.equal(coreOnly.complete, false, 'complete remains the strict full-cycle alias');
assert.equal(coreOnly.coreStageCoverage01, 1);
assert.equal(coreOnly.stageCoverage01, 6 / 11);
assert.deepEqual(coreOnly.missingStages, ['appraisal', 'attention', 'memory', 'goal', 'plan']);

const full = cycle.evaluate(completeInput(2, ids(FULL_COGNITIVE_CYCLE_STAGES)));
assert.equal(full.coreComplete, true);
assert.equal(full.fullComplete, true);
assert.equal(full.complete, true);
assert.equal(full.stageCoverage01, 1);
assert.deepEqual(full.missingStages, []);

const counterfeit = cycle.evaluate({ ...completeInput(3, ids(FULL_COGNITIVE_CYCLE_STAGES)), fullLineageComplete: false });
assert.equal(counterfeit.coreComplete, true);
assert.equal(counterfeit.fullComplete, false, 'eleven IDs without CEF full-lineage proof are not full completion');

const duplicateIds = ids(FULL_COGNITIVE_CYCLE_STAGES);
duplicateIds.memory = duplicateIds.observation;
const duplicate = cycle.evaluate(completeInput(4, duplicateIds));
assert.equal(duplicate.coreComplete, false);
assert.equal(duplicate.fullComplete, false);
assert.equal(duplicate.duplicatedIds.length, 1);

assert.throws(() => cycle.evaluate(completeInput(2, ids(FULL_COGNITIVE_CYCLE_STAGES))), /strictly increase/);
assert.throws(() => cycle.evaluate({ tick: 5, stageIds: null, parentIntegrity01: 1 }), /stageIds/);
assert.throws(() => cycle.evaluate({ tick: 5, stageIds: {}, parentIntegrity01: Infinity }), /parentIntegrity01/);
assert.throws(() => cycle.evaluate({ ...completeInput(5, ids(FULL_COGNITIVE_CYCLE_STAGES)), fullIntegrity01: 2 }), /fullIntegrity01/);

const persisted = cycle.snapshot();
assert.equal(persisted.version, 2);
assert.equal(persisted.cycles, 4);
assert.equal(persisted.coreCompleteCycles, 3);
assert.equal(persisted.fullCompleteCycles, 1);
assert.equal(persisted.completeCycles, 1);
assert.equal(persisted.incompleteCycles, 3);
assert.equal(persisted.meanCoreStageCoverage01, 1);
assert.ok(persisted.meanStageCoverage01 < 1);

const restored = new UnifiedCognitiveCycle();
restored.restore(persisted);
assert.deepEqual(restored.snapshot(), persisted);
const leaked = restored.snapshot();
leaked.lastMissingStages.push('goal');
assert.equal(restored.snapshot().lastMissingStages.includes('goal'), false);

const migratedV1 = new UnifiedCognitiveCycle();
migratedV1.restore({
  version: 1, cycles: 10, completeCycles: 7, incompleteCycles: 3, brokenLineages: 2,
  meanStageCoverage01: 0.95, meanCausalContinuity01: 0.9, lastTick: 100,
  lastComplete: true, lastMissingStages: [],
});
const migrated = migratedV1.snapshot();
assert.equal(migrated.version, 2);
assert.equal(migrated.cycles, 10);
assert.equal(migrated.coreCompleteCycles, 7, 'v1 completions are preserved only as core history');
assert.equal(migrated.fullCompleteCycles, 0, 'v1 counters cannot prove strict eleven-stage lineage');
assert.equal(migrated.completeCycles, 0);
assert.equal(migrated.incompleteCycles, 10);
assert.equal(migrated.lastCoreComplete, true);
assert.equal(migrated.lastFullComplete, false);
assert.deepEqual(migrated.lastMissingStages, [...FULL_COGNITIVE_CYCLE_STAGES]);
assert.equal(migrated.meanCoreStageCoverage01, 0.95);
assert.equal(migrated.meanStageCoverage01, 0);

const inconsistent = new UnifiedCognitiveCycle();
inconsistent.restore({
  version: 2, cycles: 10, coreCompleteCycles: 2, fullCompleteCycles: 8,
  completeCycles: 8, incompleteCycles: 999, brokenLineages: 50, lastTick: 2,
  lastCoreComplete: true, lastFullComplete: true,
  lastCoreMissingStages: [], lastMissingStages: [],
});
const reconciled = inconsistent.snapshot();
assert.equal(reconciled.coreCompleteCycles, 8);
assert.equal(reconciled.fullCompleteCycles, 8);
assert.equal(reconciled.incompleteCycles, 2);
assert.equal(reconciled.brokenLineages, 2);
assert.equal(reconciled.lastComplete, true);

const malformed = new UnifiedCognitiveCycle();
malformed.restore({ version: 2, cycles: NaN, coreCompleteCycles: 99, fullCompleteCycles: 99, lastTick: Infinity, lastMissingStages: ['unknown-stage'] });
assert.equal(malformed.snapshot().cycles, 0);
assert.equal(malformed.snapshot().fullCompleteCycles, 0);
assert.deepEqual(malformed.snapshot().lastMissingStages, [...FULL_COGNITIVE_CYCLE_STAGES]);
assert.throws(() => malformed.restore({ version: 3 }), /version/);

console.log('WORKPASS71_UNIFIED_CYCLE_COMPLETENESS=PASS');
