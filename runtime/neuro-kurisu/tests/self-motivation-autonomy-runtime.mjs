import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

// ---- Phase 5: real-cycle decision receipts ---------------------------------

const core = new OrganismCore(new MemoryStateStore(), { performanceProfile: 'mobile', cycleResultMode: 'operational' });
await core.init();

// A first external turn records a receipt from the real decision inputs.
await core.observe({ text: 'verify the current state of the switch before changing anything', novelty: .5, uncertainty: .55, reward: .6, success: .6, surprise: .2 }, 'operational');
const firstReceipt = core.autonomousDecisionReceipt();
assert.ok(firstReceipt, 'a real observe cycle must record a decision receipt');
assert.equal(firstReceipt.source, 'external', 'a user turn must be recorded as an external cycle');
assert.equal(firstReceipt.trigger, 'external-user-turn', 'the trigger must name the external turn');
assert.ok(Object.keys(firstReceipt.driveContributions).length >= 6, 'the receipt must record the drive snapshot');
assert.ok(firstReceipt.candidates.length >= 1, 'the receipt must record the considered candidates');
assert.ok(firstReceipt.safety.reason.length > 0, 'the receipt must record a safety decision');
assert.equal(firstReceipt.outcome, undefined, 'a just-opened receipt must not claim an outcome yet');

// Feedback closes the receipt with the real outcome.
await core.feedback({ reward: .72, success: .74, surprise: .18 });
const closedReceipt = core.autonomousDecisionReceiptForTick(firstReceipt.tick);
assert.ok(closedReceipt?.outcome, 'feedback must close the receipt with the observed outcome');
assert.ok(closedReceipt.outcome.success01 > 0, 'the closed receipt must carry a real success value');

// A second, purely endogenous cycle must be recorded as such.
await core.observe({}, 'operational');
const endogenousReceipt = core.autonomousDecisionReceipt();
assert.ok(endogenousReceipt, 'an endogenous cycle must also record a receipt');
assert.equal(endogenousReceipt.source, 'endogenous', 'an empty observation must be recorded as endogenous');

// Explainability comes from records, and the record survives a restart.
const explanation = core.explainAutonomousDecision(closedReceipt.tick);
assert.ok(explanation, 'a stored receipt must be explainable');
assert.match(explanation.answer, /Outcome: success/, 'the explanation must include the real outcome');
const diagnostics = core.autonomousDecisionReceiptDiagnostics();
assert.ok(diagnostics.created >= 2, 'each cycle must create a receipt');
assert.ok(diagnostics.closed >= 1, 'feedback must close at least one receipt');

const snapshot = core.snapshot();
assert.ok(snapshot.system?.autonomousDecisionReceipts, 'receipts must persist in the system facet');

const restored = new OrganismCore(new MemoryStateStore({ initial: snapshot }), { performanceProfile: 'mobile', cycleResultMode: 'operational' });
await restored.init();
const restoredReceipt = restored.autonomousDecisionReceiptForTick(closedReceipt.tick);
assert.ok(restoredReceipt, 'a persisted receipt must survive restore');
assert.equal(restoredReceipt.selectedAction, closedReceipt.selectedAction, 'the restored receipt must match the original decision');
assert.ok(restoredReceipt.outcome, 'the restored receipt must retain the recorded outcome');
const restoredExplanation = restored.explainAutonomousDecision(closedReceipt.tick);
assert.match(restoredExplanation.answer, /Outcome: success/, 'the restored receipt must remain explainable');

// ---- Phase 4: delivery policy through the core ----------------------------

const policyCore = new OrganismCore(new MemoryStateStore(), { performanceProfile: 'mobile', cycleResultMode: 'operational' });
await policyCore.init();
assert.equal(policyCore.autonomousInitiativeDeliveryPolicy().consentGranted, true, 'consent must default to granted');
policyCore.setAutonomousInitiativeConsent(false);
assert.equal(policyCore.autonomousInitiativeDeliveryPolicy().consentGranted, false, 'revoking consent must take effect');
policyCore.setAutonomousInitiativeQuietHours({ enabled: true, startHourUtc: 22, endHourUtc: 8 });
assert.equal(policyCore.autonomousInitiativeDeliveryPolicy().quietHoursEnabled, true, 'quiet hours must be configurable');
const policySnapshot = policyCore.snapshot();
const policyRestored = new OrganismCore(new MemoryStateStore({ initial: policySnapshot }), { performanceProfile: 'mobile', cycleResultMode: 'operational' });
await policyRestored.init();
assert.equal(policyRestored.autonomousInitiativeDeliveryPolicy().consentGranted, false, 'revoked consent must survive a restart');
assert.equal(policyRestored.autonomousInitiativeDeliveryPolicy().quietStartHourUtc, 22, 'quiet hours must survive a restart');

console.log(`SELFMOTIVATION_AUTONOMY_RUNTIME=PASS receipts=${diagnostics.created} closed=${diagnostics.closed} selected=${closedReceipt.selectedAction}`);
