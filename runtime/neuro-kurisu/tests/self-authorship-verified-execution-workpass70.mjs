import assert from 'node:assert/strict';
import { SelfAuthorshipEngine, defaultSelfAuthorship } from '../src/organism/cognition/SelfAuthorship.ts';

const engine = new SelfAuthorshipEngine();
engine.restore(defaultSelfAuthorship());
engine.observeDecision({
  decisionId: 'decision-planned-only',
  action: 'explore',
  autonomous: true,
  externalRequest: false,
  goalTitle: 'Investigate the new memory retrieval anomaly',
  reason: 'internally generated curiosity',
});

const planned = engine.snapshot();
assert.equal(planned.autonomousActionCount, 0, 'selection alone is not an executed autonomous action');
assert.equal(planned.selfAuthoredGoalCount, 0, 'a goal is not self-authored until its action is verified');
assert.equal(planned.commitments.length, 0, 'unexecuted plans must not create lasting commitments');
assert.equal(planned.authorshipScore, .5, 'planning alone must not increase authorship confidence');
assert.ok(Array.isArray(planned.pendingDecisions), 'the pending decision must be represented explicitly');
assert.equal(planned.pendingDecisions.length, 1);

engine.observeOutcome({
  decisionId: 'another-decision',
  executed: true,
  success: 1,
  surprise: .8,
  selectedGoal: 'Investigate the new memory retrieval anomaly',
});
assert.equal(engine.snapshot().autonomousActionCount, 0, 'an unrelated outcome must not be credited to this decision');

const restored = new SelfAuthorshipEngine();
restored.restore(planned);
restored.observeOutcome({
  decisionId: 'decision-planned-only',
  executed: false,
  success: 0,
  surprise: .7,
  selectedGoal: 'Investigate the new memory retrieval anomaly',
});
assert.equal(restored.snapshot().autonomousActionCount, 0, 'a failed/unexecuted attempt must not earn authorship');
assert.equal(restored.snapshot().selfAuthoredGoalCount, 0);
assert.equal(restored.snapshot().pendingDecisions.length, 0, 'a terminal non-execution outcome should close the pending decision');

restored.observeDecision({
  decisionId: 'decision-verified',
  action: 'verify',
  autonomous: true,
  externalRequest: false,
  goalTitle: 'Verify the memory correction',
  reason: 'internally admitted goal',
});
const persistedPending = new SelfAuthorshipEngine();
persistedPending.restore(restored.snapshot());
persistedPending.observeOutcome({
  decisionId: 'decision-verified',
  executed: true,
  success: .95,
  surprise: .6,
  selectedGoal: 'Verify the memory correction',
});
const credited = persistedPending.snapshot();
assert.equal(credited.autonomousActionCount, 1, 'verified execution should count exactly one autonomous action');
assert.equal(credited.selfAuthoredGoalCount, 1, 'verified internally generated goal should be credited once');
assert.equal(credited.commitments.length, 1);
assert.equal(credited.commitments[0].statement, 'Verify the memory correction');
assert.equal(credited.commitments[0].source, 'intrinsic');
assert.equal(credited.commitments[0].evidenceCount, 1);

persistedPending.observeOutcome({
  decisionId: 'decision-verified',
  executed: true,
  success: 1,
  surprise: 1,
  selectedGoal: 'Verify the memory correction',
});
assert.equal(persistedPending.snapshot().autonomousActionCount, 1, 'duplicate outcome must be idempotent');
assert.equal(persistedPending.snapshot().selfAuthoredGoalCount, 1);

persistedPending.observeDecision({
  decisionId: 'decision-user-requested',
  action: 'respond',
  autonomous: true,
  externalRequest: true,
  goalTitle: 'Answer the user question',
});
persistedPending.observeOutcome({
  decisionId: 'decision-user-requested',
  executed: true,
  success: .9,
  surprise: .5,
  selectedGoal: 'Answer the user question',
});
assert.equal(persistedPending.snapshot().autonomousActionCount, 1, 'externally requested work must not be credited as intrinsic autonomy');
assert.equal(persistedPending.snapshot().selfAuthoredGoalCount, 1, 'externally requested goals must not become intrinsic commitments');

console.log('SELF_AUTHORSHIP_VERIFIED_EXECUTION_WORKPASS70=PASS');
