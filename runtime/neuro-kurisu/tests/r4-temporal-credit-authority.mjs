import assert from 'node:assert/strict';
import { CanonicalTemporalCreditAuthority } from '../src/organism/learning/CanonicalTemporalCreditAuthority.ts';

const authority = new CanonicalTemporalCreditAuthority({ gamma01: .88, lambda01: .82, maxHorizonTicks: 8 });
for (const [tick, id, action, context] of [
  [1, 'd1', 'explore', 'e0|c0|u3|n3|g2|s1'],
  [2, 'd2', 'verify',  'e1|c0|u2|n2|g2|s1'],
  [3, 'd3', 'respond', 'e2|c1|u1|n1|g2|s2'],
]) {
  authority.registerDecision({ decisionId:id, tick, action, contextKey:context, predicted01:.4, at:tick });
}
const resolved = authority.resolveOutcome({
  decisionId:'d3', tick:4, reward01:.95, predictionError01:.45,
  verified01:1, independent01:1, autonomous01:1, at:4,
});
assert.equal(resolved.assignments.length, 3);
assert.equal(new Set(resolved.assignments.map(a => a.contextKey)).size, 3);
const byId = Object.fromEntries(resolved.assignments.map(a => [a.decisionId, a]));
assert.equal(byId.d1.delayTicks, 3);
assert.equal(byId.d2.delayTicks, 2);
assert.equal(byId.d3.delayTicks, 1);
assert(byId.d1.eligibility01 < byId.d2.eligibility01);
assert(byId.d2.eligibility01 < byId.d3.eligibility01);
assert(byId.d1.creditedReward01 <= byId.d3.creditedReward01 + 1e-9);
assert(resolved.assignments.every(a => a.outcomeCount >= 1 && a.causalConfidence01 > 0));
assert.equal(resolved.openDecisions, 0);

const diag = authority.diagnostics();
assert.equal(diag.registeredDecisions, 3);
assert.equal(diag.resolvedDecisions, 3);
assert.equal(diag.delayedAssignments, 3);

console.log('R4_TEMPORAL_CREDIT_AUTHORITY_PASS', JSON.stringify({
  assignments: resolved.assignments.map(a => ({ id:a.decisionId, delay:a.delayTicks, eligibility:Number(a.eligibility01.toFixed(4)), credit:Number(a.creditedReward01.toFixed(4)) })),
  diagnostics: diag,
}));
