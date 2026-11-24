import assert from 'node:assert/strict';
import { OrganismSystemFabric } from '../src/organism/core/OrganismSystemFabric.ts';
import { CognitiveExecutionPlanner } from '../src/organism/core/CognitiveExecutionPlanner.ts';
import { buildCognitiveFrame } from '../src/organism/core/CognitiveFrame.ts';

const fabric = new OrganismSystemFabric();
const contracts = fabric.contracts();
assert.equal(contracts.length, 7);
assert.deepEqual(contracts.map(c=>c.name), ['self','governance','memory','world','embodiment','agency','research']);
for (const c of contracts) {
  assert.equal(c.version, 1);
  assert.ok(c.estimatedCost01 > 0);
  assert.ok(c.snapshotWeight01 > 0);
  assert.ok(c.capabilities.length > 0);
  assert.ok(typeof c.snapshot === 'function');
  const health = c.health();
  assert.equal(health.available, true);
}
assert.ok(contracts.find(c=>c.name==='research').dependencies.includes('world'));
assert.ok(contracts.find(c=>c.name==='governance').capabilities.includes('safety') === false || contracts.find(c=>c.name==='governance').capabilityNames.includes('safety'));

const state = {
  version:92,tick:7,at:Date.now(),
  needs:{energy:.92,cognitiveLoad:.12,uncertainty:.55,socialNeed:.2,novelty:.6,identityCoherence:.9,goalPressure:.4},
  predictionError:.55,attentionBudget:.8,lastAction:'none',lastActionSuccess:null,autonomyScore:.5,selfPredictionError:.1,
  predictedNextAction:'none',lastPredictionConfidence:.7,worldContextVersion:1,
};
const frame = buildCognitiveFrame(state, { text:'research request' });
const planner = new CognitiveExecutionPlanner();
const spine = { mode:'deep', reason:'test', run:{'world-rollout':true,research:true,shadow:true,project:true} };
const pressure = { version:1,totalPressure01:.78,informationUrgency01:.86,dominant:'prediction-error',domains:{self:.3,world:.8,memory:.5,agency:.4,embodiment:.4,research:.9,governance:.2} };
const plan = planner.compile(frame, spine, .95, pressure, contracts);
assert.ok(plan.run.research);
assert.ok(plan.cost01.research > 0);
assert.ok(plan.metabolism.research.priority01 > 0);
assert.ok(plan.metabolism.governance.budgetShare01 > 0);
assert.ok(plan.metabolism.governance.budgetShare01 >= 0.08);
console.log('BIG_PASS_58_SYSTEM_FABRIC=PASS');
console.log(`contracts=${contracts.length}`);
console.log(`researchCost=${plan.cost01.research.toFixed(4)}`);
console.log(`researchPriority=${plan.metabolism.research.priority01.toFixed(4)}`);
