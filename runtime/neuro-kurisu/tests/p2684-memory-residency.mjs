import assert from 'node:assert/strict';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';

const memory = new MemoryOS2();
for (let i = 0; i < 180; i += 1) {
  memory.encode({
    kind: i % 7 === 0 ? 'identity' : 'episodic',
    content: `experience ${i} unique context laboratory transition goal ${i % 5}`,
    salience: i % 6 === 0 ? .92 : .3,
    emotionalWeight: i % 9 === 0 ? .8 : .1,
    identityRelevance: i % 7 === 0 ? .95 : .12,
    goalRelevance: i % 5 === 0 ? .74 : .18,
    socialRelevance: 0,
    predictionError: i % 4 === 0 ? .72 : .25,
    confidence: .65,
    epistemicStatus: 'belief',
    source: 'p2684-test',
    entities: [], semanticLinks: [], temporalLinks: [], causalLinks: [],
  });
}
const plan = memory.applyResidencyPlan({hotBudget:16,warmBudget:64,coldBudget:128,pressure01:.58,identityTension01:.7});
assert.equal(plan.tierCounts.hot <= 16, true);
assert.equal(plan.tierCounts.warm <= 64, true);
assert.ok(plan.tierCounts.cold > 0);
const before = memory.residencyDiagnostics();
assert.ok(before.materializedVectors < before.targetItems, 'cold tier should permit lazy vectors');

const identityIds = memory.snapshot({clone:false}).items.filter(x => x.kind === 'identity').map(x => x.id);
memory.maintain({pressure01:.95,maxItems:16});
const after = memory.snapshot({clone:false});
for (const id of identityIds) assert.ok(after.items.some(x => x.id === id), `protected identity memory lost: ${id}`);

const cold = after.items.find(x => x.residencyTier === 'cold');
if (cold) {
  assert.equal(cold.semanticVector.length, 0);
  const result = memory.retrieve(cold.content.slice(0, 48), 4);
  assert.ok(Array.isArray(result));
  const restored = memory.get(cold.id);
  assert.ok((restored?.semanticVector?.length ?? 0) > 0, 'cold vector must lazily re-materialize on retrieval');
}

console.log(JSON.stringify({
  pass: true,
  plan,
  before,
  after: memory.residencyDiagnostics(),
  retainedIdentity: identityIds.filter(id => after.items.some(x => x.id === id)).length,
}));
