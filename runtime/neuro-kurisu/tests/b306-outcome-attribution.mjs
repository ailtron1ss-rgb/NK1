import assert from 'node:assert/strict';
import { B306AutonomousInitiativeVerificationLedger } from '../src/organism/system/B306AutonomousInitiativeVerificationLedger.ts';

const ledger = new B306AutonomousInitiativeVerificationLedger();
const decision = (tick, selected, alternative) => ledger.observeDecision({
  tick,
  externalInput: false,
  autonomousAllowed: true,
  initiative01: .8,
  agendaCreated: tick === 101,
  selectedAction: 'explore',
  selectedKernelBias01: .2,
  counterfactualSelectedScore01: selected,
  counterfactualBestAlternativeScore01: alternative,
});

decision(101, .30, .80); // without the autonomy kernel the alternative would win
decision(102, .72, .24); // without the kernel the selected action still wins

const olderOutcome = ledger.observeOutcome(.91, 101);
assert.deepEqual(olderOutcome, { matched: true, tick: 101, counterfactualChanged: true });
let diagnostics = ledger.diagnostics();
assert.equal(diagnostics.outcomes, 1);
assert.equal(diagnostics.recent.find(row => row.tick === 101)?.outcome01, .91);
assert.equal(diagnostics.recent.find(row => row.tick === 102)?.outcome01, null);
assert.equal(diagnostics.successfulCausalOutcomes, 1);

// Replays must not overwrite a completed decision or manufacture extra successes.
const duplicate = ledger.observeOutcome(.99, 101);
assert.equal(duplicate.matched, false);
diagnostics = ledger.diagnostics();
assert.equal(diagnostics.outcomes, 1);
assert.equal(diagnostics.successfulCausalOutcomes, 1);
assert.equal(diagnostics.recent.find(row => row.tick === 101)?.outcome01, .91);

// A later outcome can still be attached to its own decision.
const newerOutcome = ledger.observeOutcome(.25, 102);
assert.deepEqual(newerOutcome, { matched: true, tick: 102, counterfactualChanged: false });
assert.equal(ledger.diagnostics().outcomes, 2);
assert.equal(ledger.diagnostics().recent.find(row => row.tick === 102)?.outcome01, .25);

// Unknown, malformed, or evicted decision ticks are not attributed to the latest row.
assert.equal(ledger.observeOutcome(.8, 999).matched, false);
assert.equal(ledger.observeOutcome(.8, -1).matched, false);
assert.equal(ledger.diagnostics().outcomes, 2);

// The existing Core feedback path uses the implicit latest-decision form.
const corePathLedger = new B306AutonomousInitiativeVerificationLedger();
corePathLedger.observeDecision({
  tick: 201, externalInput: false, autonomousAllowed: true, initiative01: .7,
  agendaCreated: true, selectedAction: 'verify', selectedKernelBias01: .15,
  counterfactualSelectedScore01: .35, counterfactualBestAlternativeScore01: .7,
});
assert.equal(corePathLedger.observeOutcome(.74).matched, true);
assert.equal(corePathLedger.observeOutcome(.99).matched, false);
assert.equal(corePathLedger.diagnostics().outcomes, 1);
assert.equal(corePathLedger.diagnostics().successfulCausalOutcomes, 1);
assert.equal(corePathLedger.diagnostics().recent[0].outcome01, .74);

console.log('B306_OUTCOME_ATTRIBUTION=PASS');
