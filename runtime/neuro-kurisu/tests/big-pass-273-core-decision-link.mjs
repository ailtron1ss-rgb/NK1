import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const core = new OrganismCore(new MemoryStateStore(), {
  performanceProfile: 'mobile',
  cycleResultMode: 'operational',
});
await core.init();
try {
  await core.observe({
    text: 'Please inspect the current relay state and do not change it.',
    novelty: .9,
    uncertainty: .85,
  }, 'operational');

  const externalTrace = core.snapshot().traces[0];
  assert.ok(externalTrace, 'the external turn must create a canonical decision trace');
  assert.equal(externalTrace.goalAuthorshipAdmitted, false,
    'an externally requested turn must not be admitted as an internally authored goal');
  assert.equal(externalTrace.autonomousGoalId ?? null, null,
    'the external trace must not claim ownership of an intrinsic B273 goal');
  assert.deepEqual(externalTrace.autonomousGoalPlan, ['defer'],
    'a denied B273 cycle must publish a defer plan, not a prior internal goal plan');

  const before = core.snapshot().system.autonomousGoalLifecycleB273;
  assert.equal(before.goalCreations, 0,
    'a user-requested turn at startup must not create an intrinsic B273 goal');

  await core.feedback({
    success: .98,
    reward: .95,
    surprise: .05,
    notes: 'successful result from the user-requested inspection',
  });

  const after = core.snapshot().system.autonomousGoalLifecycleB273;
  assert.deepEqual(after.goals, before.goals,
    'user-requested feedback must not advance or complete an intrinsic B273 goal');
  assert.equal(after.learningUpdates, before.learningUpdates,
    'B273 learning must ignore the user-requested trace');
  assert.equal(after.goalCreations, before.goalCreations,
    'external feedback must not increment endogenous goal creation');

  const restarted = new OrganismCore(
    new MemoryStateStore({ initial: core.snapshot() }),
    { performanceProfile: 'mobile', cycleResultMode: 'operational' },
  );
  await restarted.init();
  try {
    assert.deepEqual(
      restarted.snapshot().system.autonomousGoalLifecycleB273,
      after,
      'B273 admission and attribution state must remain durable after restart',
    );
    console.log('B273_CORE_DECISION_OUTCOME_LINK=PASS');
  } finally {
    await restarted.stop?.();
  }
} finally {
  await core.stop?.();
}
