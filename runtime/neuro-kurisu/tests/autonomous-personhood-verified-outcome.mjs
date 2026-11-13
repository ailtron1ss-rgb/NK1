import assert from 'node:assert/strict';
import { AutonomousPersonhoodKernel } from '../src/organism/system/AutonomousPersonhoodKernel.ts';

function createLearningMission(tick = 1) {
  const kernel = new AutonomousPersonhoodKernel();
  const plan = kernel.plan({
    tick,
    at: tick * 1000,
    externalInput: false,
    energy01: 0.8,
    thermal01: 0.1,
    uncertainty01: 0.95,
    goalPressure01: 0.9,
    novelty01: 0.3,
    identity01: 0.9,
    homeostaticPressure01: 0.1,
    predictionError01: 0.9,
    activeGoals: 0,
    activeProject: false,
    recoveryPressure01: 0.1,
  });
  assert.equal(plan.agendaItem?.mode, 'learning', 'fixture must produce a learning agenda item');
  kernel.recordDecision(true, 0.9, { tick, at: tick * 1000 + 1, action: 'verify' });
  return { kernel, agendaId: plan.agendaItem.id, tick };
}

{
  const { kernel } = createLearningMission();
  assert.equal(kernel.recordVerifiedOutcome({
    tick: 1, action: 'verify', success01: 0.95, at: 1100, verified: false,
  }), false, 'an unverified prediction must not receive consequence credit');
  assert.equal(kernel.summary().consequenceUpdates, 0);
  assert.equal(kernel.summary().activeAgenda, 1);
}

{
  const { kernel } = createLearningMission();
  assert.equal(kernel.recordVerifiedOutcome({
    tick: 1, action: 'explore', success01: 0.95, at: 1100, verified: true,
  }), false, 'outcome must match the exact action that was selected');
  assert.equal(kernel.summary().consequenceUpdates, 0);
  assert.equal(kernel.recordVerifiedOutcome({
    tick: 1, action: 'verify', success01: 0.95, at: 1200, verified: true,
  }), true, 'the matching verified outcome must be credited');
  assert.equal(kernel.summary().consequenceUpdates, 1);
  assert.equal(kernel.snapshot().agenda[0].status, 'completed');
}

{
  const { kernel } = createLearningMission();
  assert.equal(kernel.recordVerifiedOutcome({
    tick: 1, action: 'verify', success01: 0.1, at: 1100, verified: true,
  }), true);
  assert.equal(kernel.snapshot().agenda[0].status, 'abandoned',
    'a matching, verified failed action must abandon the commitment rather than complete it');
}

{
  const { kernel } = createLearningMission();
  kernel.recordDecision(true, 0.9, { tick: 2, at: 2001, action: 'explore' });
  assert.equal(kernel.recordVerifiedOutcome({
    tick: 2, action: 'explore', success01: 0.99, at: 2100, verified: true,
  }), true, 'the decision result is attributable even when arbitration selected a different action');
  assert.equal(kernel.snapshot().agenda[0].status, 'active',
    'an unrelated action must not complete a learning commitment');
  assert.equal(kernel.summary().consequenceUpdates, 1);
}

{
  const { kernel } = createLearningMission();
  const pendingSnapshot = kernel.snapshot();
  const restoredPending = new AutonomousPersonhoodKernel();
  restoredPending.restore(pendingSnapshot);
  assert.equal(restoredPending.recordVerifiedOutcome({
    tick: 1, action: 'verify', success01: 0.9, at: 1100, verified: true,
  }), true, 'an in-flight autonomous decision must survive restore');
  const creditedSnapshot = restoredPending.snapshot();
  const restoredCredited = new AutonomousPersonhoodKernel();
  restoredCredited.restore(creditedSnapshot);
  assert.equal(restoredCredited.recordVerifiedOutcome({
    tick: 1, action: 'verify', success01: 0.99, at: 1200, verified: true,
  }), false, 'restored outcome receipts must reject replay');
  assert.equal(restoredCredited.summary().consequenceUpdates, 1);
}

{
  const kernel = new AutonomousPersonhoodKernel();
  kernel.recordDecision(false, 0.9, { tick: 4, at: 4001, action: 'verify' });
  assert.equal(kernel.recordVerifiedOutcome({
    tick: 4, action: 'verify', success01: 1, at: 4100, verified: true,
  }), false, 'externally prompted decisions must not be attributed as self-authored initiative');
  assert.equal(kernel.summary().consequenceUpdates, 0);
}

console.log('AUTONOMOUS_PERSONHOOD_VERIFIED_OUTCOME=PASS');


// The real core must create an autonomous decision receipt and close it only at the
// canonical feedback boundary, where a verified postcondition is available.
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

{
  const store = new MemoryStateStore();
  const config = {
    enableLanguage: false,
    checkpointMinIntervalMs: 0,
    checkpointMaxDirtyCycles: 1,
    cycleResultMode: 'operational',
    performanceProfile: 'mobile',
    enableWorldModel: true,
    enableSelfProjects: true,
    enableAgencyModel: true,
    enableLifelongLearning: true,
  };
  const core = new OrganismCore(store, config);
  await core.init();
  let attributed = false;
  for (let i = 0; i < 16 && !attributed; i += 1) {
    await core.autonomousHeartbeat(200000 + i * 12000);
    const before = core.systemSnapshot().autonomousPersonhood;
    const pending = before.pendingDecisions?.at(-1);
    if (!pending) continue;
    await core.feedback({ success: 0.9, evidenceSource: 'device', notes: 'authoritative device postcondition fixture' });
    const after = core.systemSnapshot().autonomousPersonhood;
    if (after.lastOutcomeTick === pending.tick && after.lastOutcomeAction === pending.action) {
      assert.equal(after.consequenceUpdates, before.consequenceUpdates + 1,
        'a verified self-authored action must update the personhood outcome ledger');
      await core.feedback({ success: 0.99, evidenceSource: 'device', notes: 'duplicate delivery fixture' });
      const replayed = core.systemSnapshot().autonomousPersonhood;
      assert.equal(replayed.consequenceUpdates, after.consequenceUpdates,
        'duplicate feedback for the same decision must not be credited twice');
      attributed = true;
    }
  }
  assert.ok(attributed, 'the unified OrganismCore must route at least one autonomous action outcome to personhood');
  await core.flush();
  const persisted = core.systemSnapshot().autonomousPersonhood;
  const restored = new OrganismCore(store, config);
  await restored.init();
  const restoredState = restored.systemSnapshot().autonomousPersonhood;
  assert.equal(restoredState.consequenceUpdates, persisted.consequenceUpdates,
    'verified personhood outcome receipts must survive runtime restore');
  assert.equal(restoredState.lastOutcomeTick, persisted.lastOutcomeTick);
}

console.log('AUTONOMOUS_PERSONHOOD_CORE_FEEDBACK_INTEGRATION=PASS');
