import assert from 'node:assert/strict';
import { CognitiveEventFabric } from '../src/organism/system/CognitiveEventFabric.ts';

// Verify the canonical 11-phase chain independently of the full organism runtime.
const fabric = new CognitiveEventFabric(128);
const phaseIds = fabric.recordOperationalCycle({
  tick: 700,
  observation: { payload: { observation: 'signal' } },
  prediction: { payload: { prediction: 'expected' } },
  appraisal: { payload: { appraisal: 'uncertain' } },
  attention: { payload: { attention: 'focused' } },
  memory: { payload: { memory: 'recalled' } },
  goal: { payload: { goal: 'investigate' } },
  plan: { payload: { plan: 'compare' } },
  action: { payload: { action: 'measure' } },
  outcome: { payload: { outcome: 'observed' } },
  learning: { payload: { learning: 'update' } },
  selfUpdate: { payload: { selfUpdate: 'integrated' } },
});
const stageIds = { ...phaseIds, 'self-update': phaseIds.selfUpdate };
const completeCycle = fabric.verifyOperationalCycle(stageIds);
assert.equal(completeCycle.complete, true, 'a fully linked eleven-phase cycle should verify');
assert.deepEqual(completeCycle.missingStages, []);
assert.deepEqual(completeCycle.invalidStages, []);
assert.deepEqual(completeCycle.missingEdges, []);

// An explicitly supplied optional stage is not decorative: it must preserve
// both causal parent edges even when all mandatory phases are well-formed.
const detachedAppraisal = fabric.append({
  tick: 700,
  stage: 'appraisal',
  source: 'regression-detached-appraisal',
  parentIds: [],
  payload: { appraisal: 'detached' },
});
const detachedCycle = fabric.verifyOperationalCycle({ ...stageIds, appraisal: detachedAppraisal.id });
assert.equal(detachedCycle.complete, false, 'optional stages without causal parents must fail verification');
assert.ok(detachedCycle.missingEdges.includes('appraisal->observation'));
assert.ok(detachedCycle.missingEdges.includes('appraisal->prediction'));
console.log('COGNITIVE_EVENT_FABRIC_OPTIONAL_STAGE_CAUSALITY=PASS');
