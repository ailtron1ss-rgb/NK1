import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { UnifiedCognitiveCycle } from '../src/organism/system/UnifiedCognitiveCycle.ts';

const fullStageIds = {
  observation: 'obs-1',
  prediction: 'pred-1',
  appraisal: 'appraisal-1',
  attention: 'attention-1',
  memory: 'memory-1',
  goal: 'goal-1',
  plan: 'plan-1',
  action: 'action-1',
  outcome: 'outcome-1',
  learning: 'learning-1',
  'self-update': 'self-update-1',
};

const fullCycle = new UnifiedCognitiveCycle();
const complete = fullCycle.evaluate({ tick: 1, stageIds: fullStageIds, parentIntegrity01: 1, mode: 'full' });
assert.equal(complete.complete, true, 'a linked eleven-stage cycle should close');
assert.equal(complete.stageCoverage01, 1);
assert.deepEqual(complete.missingStages, []);

const withoutAppraisal = { ...fullStageIds };
delete withoutAppraisal.appraisal;
const missingIntermediate = new UnifiedCognitiveCycle().evaluate({
  tick: 1, stageIds: withoutAppraisal, parentIntegrity01: 1, mode: 'full',
});
assert.equal(missingIntermediate.complete, false, 'full mode must not silently skip an intermediate stage');
assert.ok(missingIntermediate.missingStages.includes('appraisal'));
assert.equal(missingIntermediate.stageCoverage01, 10 / 11);

const duplicateIntermediate = new UnifiedCognitiveCycle().evaluate({
  tick: 1, stageIds: { ...fullStageIds, goal: fullStageIds.memory },
  parentIntegrity01: 1, mode: 'full',
});
assert.equal(duplicateIntermediate.complete, false, 'full mode must require unique identities for all stages');
assert.ok(duplicateIntermediate.missingStages.includes('memory'));
assert.ok(duplicateIntermediate.missingStages.includes('goal'));

assert.throws(() => new UnifiedCognitiveCycle().evaluate({
  tick: 1, stageIds: fullStageIds, parentIntegrity01: 1, mode: 'partial',
}), /mode must be full or operational/);

// The production runtime must opt into strict closure, while the existing
// WorkPass287 contract preserves the legacy six-stage operational default.
const runtimeSource = await readFile(new URL('../src/organism/core/OrganismRuntime.ts', import.meta.url), 'utf8');
const cycleMap = runtimeSource.match(/const cycleStageMap = \{([\s\S]*?)\};/);
assert.ok(cycleMap, 'runtime must build the explicit stage-id map');
for (const stage of ['observation', 'prediction', 'appraisal', 'attention', 'memory', 'goal', 'plan', 'action', 'outcome', 'learning', "'self-update'"]) {
  assert.ok(cycleMap[1].includes(stage), 'runtime stage map is missing ' + stage);
}
assert.match(runtimeSource, /this\.unifiedCycle\.evaluate\(\{tick:cycle\.state\.tick,stageIds:cycleStageMap,parentIntegrity01:cycleLineage\.complete \? cycleLineage\.integrity01 : 0,mode:'full'\}\)/,
  'production runtime must require full eleven-stage closure');

console.log('WorkPass332 full cognitive closure: PASS');
