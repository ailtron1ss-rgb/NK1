import assert from 'node:assert/strict';
import { CanonicalTemporalCreditAuthority } from '../src/organism/learning/CanonicalTemporalCreditAuthority.ts';

const credit = new CanonicalTemporalCreditAuthority({ maxHorizonTicks: 8 });
credit.registerDecision({ decisionId: 'decision-explore-1', tick: 1, action: 'explore', contextKey: 'room-a', predicted01: .55, at: 100 });
credit.registerDecision({ decisionId: 'decision-verify-2', tick: 2, action: 'verify', contextKey: 'room-b', predicted01: .6, at: 200 });
const exact = credit.resolveOutcome({ decisionId: 'decision-explore-1', tick: 3, reward01: .95, verified01: .95, independent01: .8, autonomous01: 1, at: 300 });
assert.deepEqual(exact.assignments.map((row) => row.decisionId), ['decision-explore-1'], 'an explicit correlation must resolve only its named decision');
let state = credit.snapshot();
assert.equal(state.pending.find((row) => row.decisionId === 'decision-explore-1')?.resolved, true);
assert.equal(state.pending.find((row) => row.decisionId === 'decision-verify-2')?.resolved, false, 'nearby decisions must not be cross-credited');
const horizon = credit.resolveOutcome({ tick: 4, reward01: .2, verified01: .9, independent01: .8, autonomous01: 1, at: 400 });
assert.deepEqual(horizon.assignments.map((row) => row.decisionId), ['decision-verify-2'], 'untargeted outcomes continue to use the configured temporal horizon');
state = credit.snapshot();
assert.equal(state.pending.find((row) => row.decisionId === 'decision-verify-2')?.resolved, true);
assert.equal(state.resolvedDecisions, 2);
assert.ok(Math.abs(horizon.assignments[0].nStepReturn01 - ((.2 + .6 * .88) / (1 + .88))) < 1e-9, 'an explicitly targeted reward for decision 1 must not leak into decision 2 return');
assert.equal(horizon.assignments[0].outcomeCount, 1, 'the neighbouring decision only sees its own untargeted horizon result');

const expired = new CanonicalTemporalCreditAuthority({ maxHorizonTicks: 2 });
expired.registerDecision({ decisionId: 'too-old', tick: 1, action: 'explore', contextKey: 'old-context', predicted01: .4, at: 100 });
const expiredResult = expired.resolveOutcome({ tick: 10, reward01: .99, verified01: 1, independent01: 1, autonomous01: 1, at: 200 });
assert.equal(expiredResult.assignments[0].reason, 'expired');
assert.equal(expiredResult.assignments[0].causalConfidence01, 0, 'expired bookkeeping must never become a learning signal');
assert.equal(expiredResult.assignments[0].eligibility01, 0);

const saturated = new CanonicalTemporalCreditAuthority({ maxHorizonTicks: 8 });
for (let i = 0; i < 65; i++) saturated.registerDecision({ decisionId: `capacity-${i}`, tick: i + 1, action: 'explore', contextKey: `ctx-${i}`, predicted01: .5, at: 100 + i });
const capacityState = saturated.snapshot();
assert.equal(capacityState.pending.length, 64);
assert.equal(capacityState.pending.some((row) => row.decisionId === 'capacity-0' && !row.resolved), false, 'bounded journal must not silently discard an unresolved decision');
assert.equal(capacityState.capacityExpiredDecisions, 1);
assert.ok(capacityState.recentAssignments.some((row) => row.decisionId === 'capacity-0' && row.reason === 'expired' && row.causalConfidence01 === 0));
console.log('BIG_PASS_121_TEMPORAL_CREDIT_TARGETING=PASS', JSON.stringify({ exactAssignments: exact.assignments.length, horizonAssignments: horizon.assignments.length, resolved: state.resolvedDecisions, rewardLeakPrevented: true, capacityExpired: capacityState.capacityExpiredDecisions }));
