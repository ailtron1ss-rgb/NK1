import assert from 'node:assert/strict';
import {
  B306AutonomousInitiativeVerificationLedger,
  defaultB306AutonomousInitiativeState,
} from '../src/organism/system/B306AutonomousInitiativeVerificationLedger.ts';

const ledger = new B306AutonomousInitiativeVerificationLedger();
ledger.restore(defaultB306AutonomousInitiativeState());

const first = ledger.observeDecision({
  tick: 7,
  externalInput: false,
  autonomousAllowed: true,
  initiative01: .9,
  agendaCreated: true,
  selectedAction: 'explore',
  selectedKernelBias01: .2,
  counterfactualSelectedScore01: .42,
  counterfactualBestAlternativeScore01: .73,
});
assert.equal(first.changed, true, 'fixture must contain a causally influenced decision');

ledger.observeDecision({
  tick: 8,
  externalInput: false,
  autonomousAllowed: true,
  initiative01: .45,
  agendaCreated: false,
  selectedAction: 'wait',
  selectedKernelBias01: .01,
  counterfactualSelectedScore01: .81,
  counterfactualBestAlternativeScore01: .3,
});

const unmatched = ledger.observeOutcome({ tick: 9, outcome01: .99, selectedAction: 'explore' });
assert.equal(unmatched.accepted, false, 'unknown tick must not be credited to an initiative');
assert.equal(unmatched.reason, 'unmatched-decision');

const wrongAction = ledger.observeOutcome({ tick: 7, outcome01: .99, selectedAction: 'wait' });
assert.equal(wrongAction.accepted, false, 'a different action must not inherit the outcome');
assert.equal(wrongAction.reason, 'action-mismatch');

const bound = ledger.observeOutcome({ tick: 7, outcome01: .82, selectedAction: 'explore' });
assert.equal(bound.accepted, true, 'out-of-order outcome should bind to its exact decision');
assert.equal(bound.causal, true);
assert.equal(bound.tick, 7);

const duplicate = ledger.observeOutcome({ tick: 7, outcome01: .99, selectedAction: 'explore' });
assert.equal(duplicate.accepted, false, 'the same decision cannot consume multiple outcomes');
assert.equal(duplicate.reason, 'duplicate-outcome');

const legacy = ledger.observeOutcome(.4);
assert.equal(legacy.accepted, true, 'legacy scalar call remains compatible for the latest decision');
assert.equal(legacy.tick, 8);
const legacyDuplicate = ledger.observeOutcome(.99);
assert.equal(legacyDuplicate.accepted, false, 'legacy retries cannot overwrite the latest decision outcome');

const metrics = ledger.diagnostics();
assert.equal(metrics.outcomes, 2, 'only two matched outcomes should be counted');
assert.equal(metrics.causallyInfluencedOutcomes, 1, 'only a causally influenced matched decision contributes to the causal denominator');
assert.equal(metrics.successfulCausalOutcomes, 1);
assert.equal(metrics.causalSuccessRate01, 1);
assert.equal(metrics.causalOutcomeCoverage01, .5);

const restored = new B306AutonomousInitiativeVerificationLedger();
restored.restore(ledger.snapshot());
const restoredMetrics = restored.diagnostics();
assert.equal(restoredMetrics.causallyInfluencedOutcomes, 1, 'causal outcome denominator must survive restore');
assert.equal(restoredMetrics.causalSuccessRate01, 1, 'causal success rate must survive restore');

const legacySnapshot = defaultB306AutonomousInitiativeState();
legacySnapshot.causallyInfluencedDecisions = 4;
legacySnapshot.successfulCausalOutcomes = 1;
const migrated = new B306AutonomousInitiativeVerificationLedger();
migrated.restore(legacySnapshot);
assert.equal(migrated.diagnostics().causallyInfluencedOutcomes, 4, 'older snapshots need a conservative denominator migration');

console.log(JSON.stringify({
  pass: 'B306_DECISION_OUTCOME_ATTRIBUTION',
  matchedOutcomes: metrics.outcomes,
  causalOutcomes: metrics.causallyInfluencedOutcomes,
  causalSuccessRate01: metrics.causalSuccessRate01,
  coverage01: metrics.causalOutcomeCoverage01,
}, null, 2));
