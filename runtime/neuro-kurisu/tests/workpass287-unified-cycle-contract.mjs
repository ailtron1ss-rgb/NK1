import assert from 'node:assert/strict';
import { UnifiedCognitiveCycle } from '../src/organism/system/UnifiedCognitiveCycle.ts';
import { CORE_CYCLE_STAGES, FULL_COGNITIVE_CYCLE_STAGES } from '../src/organism/system/CycleCompletenessPolicy.ts';

const makeIds = stages => Object.fromEntries(stages.map((stage, index) => [stage, `workpass287-${index}-${stage}`]));
const cycle = new UnifiedCognitiveCycle();
const core = cycle.evaluate({
  tick: 1,
  stageIds: makeIds(CORE_CYCLE_STAGES),
  parentIntegrity01: 1,
  coreLineageComplete: true,
  fullLineageComplete: false,
  fullIntegrity01: 6 / 11,
});
assert.equal(core.coreComplete, true);
assert.equal(core.fullComplete, false);
assert.equal(core.complete, false);
assert.deepEqual(core.coreMissingStages, []);
assert.deepEqual(core.missingStages, ['appraisal', 'attention', 'memory', 'goal', 'plan']);

const full = cycle.evaluate({
  tick: 2,
  stageIds: makeIds(FULL_COGNITIVE_CYCLE_STAGES),
  parentIntegrity01: 1,
  coreLineageComplete: true,
  fullLineageComplete: true,
  fullIntegrity01: 1,
});
assert.equal(full.coreComplete, true);
assert.equal(full.fullComplete, true);
assert.equal(full.complete, true);
assert.deepEqual(full.missingStages, []);

const duplicate = makeIds(FULL_COGNITIVE_CYCLE_STAGES);
duplicate.attention = duplicate.appraisal;
const duplicateResult = cycle.evaluate({
  tick: 3, stageIds: duplicate, parentIntegrity01: 1,
  coreLineageComplete: true, fullLineageComplete: false, fullIntegrity01: 0.9,
});
assert.equal(duplicateResult.fullComplete, false);
assert.equal(duplicateResult.duplicatedIds.length, 1);
assert.throws(() => cycle.evaluate({
  tick: 2, stageIds: makeIds(FULL_COGNITIVE_CYCLE_STAGES), parentIntegrity01: 1,
}), /strictly increase/);

const migrated = new UnifiedCognitiveCycle();
migrated.restore({
  version: 1, cycles: 4, completeCycles: 3, incompleteCycles: 1,
  lastTick: 12, lastComplete: true, lastMissingStages: [],
});
assert.equal(migrated.snapshot().version, 2);
assert.equal(migrated.snapshot().coreCompleteCycles, 3);
assert.equal(migrated.snapshot().fullCompleteCycles, 0);
assert.equal(migrated.snapshot().lastCoreComplete, true);
assert.equal(migrated.snapshot().lastFullComplete, false);

const malformed = new UnifiedCognitiveCycle();
malformed.restore({ version: 2, cycles: NaN, fullCompleteCycles: 999, lastTick: Infinity });
assert.equal(malformed.snapshot().cycles, 0);
assert.equal(malformed.snapshot().lastComplete, false);
assert.throws(() => malformed.restore({ version: 3 }), /version/);

console.log('WorkPass287/71 unified cognitive-cycle contract: PASS');
