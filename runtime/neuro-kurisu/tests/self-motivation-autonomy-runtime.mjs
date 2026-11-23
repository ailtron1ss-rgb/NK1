import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const core = new OrganismCore(new MemoryStateStore(), {
  performanceProfile: 'mobile',
  cycleResultMode: 'operational',
});
await core.init();

try {
  // A real external turn must create an evidence-derived receipt, not a retrospective string.
  await core.observe({
    text: 'verify the current state of the switch before changing anything',
    novelty: .5, uncertainty: .55, reward: .6, success: .6, surprise: .2,
  }, 'operational');
  const firstReceipt = core.autonomousDecisionReceipt();
  assert.ok(firstReceipt, 'a real observe cycle must record a decision receipt');
  assert.equal(firstReceipt.source, 'external');
  assert.equal(firstReceipt.trigger, 'external-user-turn');
  assert.ok(Object.keys(firstReceipt.driveContributions).length >= 6);
  assert.ok(firstReceipt.candidates.length >= 1);
  assert.ok(firstReceipt.safety.reason.length > 0);
  assert.equal(firstReceipt.outcome, undefined, 'an open receipt must not invent an outcome');

  await core.feedback({ reward: .72, success: .74, surprise: .18 });
  const closedReceipt = core.autonomousDecisionReceiptForTick(firstReceipt.tick);
  assert.ok(closedReceipt?.outcome, 'feedback must attach observed outcome');
  assert.ok(closedReceipt.outcome.success01 > 0);

  await core.observe({}, 'operational');
  const endogenous = core.autonomousDecisionReceipt();
  assert.ok(endogenous);
  assert.equal(endogenous.source, 'endogenous');

  const explanation = core.explainAutonomousDecision(closedReceipt.tick);
  assert.ok(explanation);
  assert.match(explanation.answer, /Outcome: success/);
  assert.match(explanation.answer, /Learning consequence not yet recorded|Learning:/);
  const diagnostics = core.autonomousDecisionReceiptDiagnostics();
  assert.ok(diagnostics.created >= 2);
  assert.ok(diagnostics.closed >= 1);

  const snapshot = core.snapshot();
  assert.ok(snapshot.system?.autonomousDecisionReceipts, 'receipts must be included in system persistence');
  assert.ok(snapshot.system.autonomousDecisionReceipts.receipts.length >= 2,
    'public snapshot must project the current bounded receipt log rather than omit it');
  const restored = new OrganismCore(
    new MemoryStateStore({ initial: snapshot }),
    { performanceProfile: 'mobile', cycleResultMode: 'operational' },
  );
  await restored.init();
  try {
    const afterRestart = restored.autonomousDecisionReceiptForTick(closedReceipt.tick);
    assert.ok(afterRestart);
    assert.equal(afterRestart.selectedAction, closedReceipt.selectedAction);
    assert.ok(afterRestart.outcome);
    assert.match(restored.explainAutonomousDecision(closedReceipt.tick).answer, /Outcome: success/);
  } finally {
    await restored.stop?.();
  }
  console.log(`SELF_MOTIVATION_DECISION_RECEIPTS=PASS created=${diagnostics.created} closed=${diagnostics.closed}`);
} finally {
  await core.stop?.();
}
