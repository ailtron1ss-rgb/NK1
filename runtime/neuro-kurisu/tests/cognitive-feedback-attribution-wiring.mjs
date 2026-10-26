import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { FeedbackDeliveryGuard } from '../src/organism/core/FeedbackDeliveryGuard.ts';

const core = await readFile(new URL('../src/organism/core/OrganismCore.ts', import.meta.url), 'utf8');
const b272 = await readFile(new URL('../src/organism/cognition/B272EndogenousGoalGenesis.ts', import.meta.url), 'utf8');
const b273 = await readFile(new URL('../src/organism/cognition/B273AutonomousGoalLifecycle.ts', import.meta.url), 'utf8');
const b274 = await readFile(new URL('../src/organism/cognition/B274AutonomousSkillLaboratory.ts', import.meta.url), 'utf8');
const stateMigrations = await readFile(new URL('../src/organism/persistence/StateMigrations.ts', import.meta.url), 'utf8');

function requireFeedbackGate(label, startMarker, endMarker, learnerName) {
  const start = core.indexOf(startMarker);
  assert.notEqual(start, -1, `${label}: feedback branch must remain present`);
  const end = core.indexOf(endMarker, start);
  assert.ok(end > start, `${label}: feedback branch must have an explicit end`);
  const block = core.slice(start, end);

  assert.match(block, new RegExp(`trace\\.selected\\.action === ${learnerName}GoalState\\.action`),
    `${label}: only the canonical selected action matching the generated B272 action may receive reward credit`);
  assert.match(block, new RegExp(`${learnerName}Learner\\.learnFromOutcome\\(`),
    `${label}: matched generated actions must preserve normal learning`);
  assert.match(block, new RegExp(`${learnerName}Learner\\.recordUnselectedAction\\(`),
    `${label}: a losing generated action must be finalized without action reward credit`);
  assert.ok(block.includes(`this.persisted.system.endogenousGoalGenesisB272 = ${learnerName}Learner.snapshot();`),
    `${label}: B272 terminal-decision state must be persisted after feedback`);
}

requireFeedbackGate(
  'no-world-transition feedback',
  'const b272Learning = trace.selected.action === b272GoalState.action',
  'const b273Current = this.developmentalNeural.autonomousGoalLifecycleB273.current();',
  'b272',
);
requireFeedbackGate(
  'world-transition feedback',
  'const b338Learning = trace.selected.action === b338GoalState.action',
  'const b338Lifecycle = this.developmentalNeural.autonomousGoalLifecycleB273.current();',
  'b338',
);

const unselectedStart = b272.indexOf('recordUnselectedAction(input:');
assert.notEqual(unselectedStart, -1, 'B272 must expose a terminal path for unselected candidates');
const learningStart = b272.indexOf('learnFromOutcome(input:', unselectedStart);
assert.ok(learningStart > unselectedStart, 'unselected-candidate handling must be separate from reward learning');
const unselectedMethod = b272.slice(unselectedStart, learningStart);
assert.match(unselectedMethod, /unselectedActionHistory/);
assert.match(unselectedMethod, /lastOutcomeTick/);
assert.ok(unselectedMethod.includes('this.state.rejectedGoals++'));
assert.doesNotMatch(unselectedMethod, /actionPrototypeWeights|goalWeights|goalOutcomeMemory|outcomeHistory/,
  'an unselected proposal must not train action prototypes or pollute executed-action outcome memory');

assert.ok(stateMigrations.includes('feedbackDeliveryReceipt?: unknown;'),
  'PersistedOrganism must type the receipt as an untrusted migration boundary');
assert.ok(stateMigrations.includes('feedbackDeliveryReceipt: raw.system?.feedbackDeliveryReceipt'),
  'state migration must preserve the receipt so restart cannot silently reopen feedback replay');

assert.ok(core.includes("private readonly feedbackDeliveryGuard = new FeedbackDeliveryGuard()"),
  'Core must own a feedback delivery guard');

const spineStart = core.indexOf('private async feedbackSpineOnly');
const spineEnd = core.indexOf('private expectedClosureDomains', spineStart);
assert.ok(spineStart >= 0 && spineEnd > spineStart, 'spine-only feedback boundary must be discoverable');
const spineBlock = core.slice(spineStart, spineEnd);
const spineBegin = spineBlock.indexOf('this.beginFeedbackDelivery(');
const firstSpineMutation = spineBlock.indexOf('state.lastActionSuccess = success');
assert.ok(spineBegin >= 0 && spineBegin < firstSpineMutation,
  'spine-only feedback must reserve its tick before learner/state mutation');
assert.ok(spineBlock.indexOf('this.completeFeedbackDelivery(feedbackDeliveryToken)') > firstSpineMutation,
  'spine-only feedback must persist completion after successful learning');

const mainFeedbackStart = core.indexOf('async feedback(outcome:');
const mainFeedbackEnd = core.indexOf('cameraEvidenceSnapshot()', mainFeedbackStart);
assert.ok(mainFeedbackStart >= 0 && mainFeedbackEnd > mainFeedbackStart, 'main feedback boundary must be discoverable');
const mainFeedback = core.slice(mainFeedbackStart, mainFeedbackEnd);
const mainBegin = mainFeedback.indexOf('this.beginFeedbackDelivery(');
const firstMainMutation = mainFeedback.indexOf("this.persistence.revisionTokens.touch('critical-kernel'");
assert.ok(mainBegin >= 0 && mainBegin < firstMainMutation,
  'main feedback must reserve its tick before subsystem mutation');
assert.ok(mainFeedback.lastIndexOf('this.completeFeedbackDelivery(feedbackDeliveryToken)') > mainFeedback.lastIndexOf('this.persisted.facets.learning.operationalLife ='),
  'main feedback must finalize the receipt after all learner updates');
assert.ok(mainFeedback.lastIndexOf('this.completeFeedbackDelivery(feedbackDeliveryToken)') < mainFeedback.lastIndexOf('await this.checkpoint(false)'),
  'completion receipt must be included in the final checkpoint');

const guard = new FeedbackDeliveryGuard();
const input = { tick: 17, decisionId: 'decision-17', action: 'reflect', previousReceipt: null };
const reservation = guard.begin(input);
assert.throws(
  () => guard.begin({ ...input, decisionId: 'different-decision' }),
  /already in progress/,
  'concurrent feedback for the same organism tick must fail closed',
);
const receipt = guard.complete(reservation);
assert.deepEqual(receipt, {
  version: 1, tick: 17, decisionId: 'decision-17', action: 'reflect', status: 'completed',
});
assert.throws(
  () => guard.begin({ ...input, previousReceipt: receipt }),
  /already been finalized/,
  'replay after a completed feedback delivery must be rejected',
);
assert.throws(
  () => guard.begin({ ...input, previousReceipt: { version: 7, tick: 17, decisionId: 'forged', action: 'wait', status: 'completed' } }),
  /malformed/,
  'a malformed current-tick receipt must not disable the replay guard',
);
assert.throws(
  () => guard.begin({ ...input, previousReceipt: { decisionId: 'missing-tick', action: 'wait', status: 'completed', version: 1 } }),
  /malformed/,
  'a malformed receipt without a tick must fail closed rather than being ignored',
);
assert.throws(
  () => guard.begin({ ...input, tick: 16, previousReceipt: receipt }),
  /future tick/,
  'feedback cannot regress behind a future persisted receipt',
);
const nextTick = guard.begin({ ...input, tick: 18, previousReceipt: receipt });
assert.equal(guard.complete(nextTick).tick, 18, 'the next organism tick must accept a new outcome');

const helperStart = core.indexOf('private async beginFeedbackDelivery(');
const helperEnd = core.indexOf('private async feedbackSpineOnly', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'Core must centralize durable feedback reservations');
const helperBlock = core.slice(helperStart, helperEnd);
assert.ok(core.includes("store.siblingPath('feedback-delivery-receipt.json')"),
  'file-backed runtime must use a dedicated tiny feedback receipt sidecar');
assert.ok(helperBlock.includes('await this.feedbackDeliveryReceiptStore?.save(pendingReceipt)'),
  'feedback reservation must be durable before downstream learners run');
assert.ok(helperBlock.includes('await this.feedbackDeliveryReceiptStore?.save(receipt)'),
  'completed receipt must be durable even when a full organism projection is deferred');
assert.ok(core.includes('await this.feedbackDeliveryReceiptStore.load()'),
  'Core init must restore the durable feedback receipt sidecar');

const spineObserveStart = core.indexOf('private async observeSpineOnly');
const normalObserveStart = core.indexOf('async observe(observation:', spineObserveStart);
assert.ok(spineObserveStart >= 0 && normalObserveStart > spineObserveStart,
  'spine-only observation path must be explicit');
const spineObserve = core.slice(spineObserveStart, normalObserveStart);
const recoveryCheck = spineObserve.indexOf('this.feedbackReceiptBlocksSpineOutcome()');
const spineAdvance = spineObserve.indexOf('state.tick += 1');
assert.ok(recoveryCheck >= 0 && recoveryCheck < spineAdvance,
  'recovery must intercept replay before inline feedback and still allow the cognitive tick to advance');
assert.ok(spineObserve.includes("source: 'feedback-recovery'"),
  'discarded interrupted outcomes must leave an auditable recovery event');
assert.ok(spineObserve.includes('suppressInterruptedOutcome = true'),
  'interrupted reward input must be explicitly suppressed');
assert.ok(spineObserve.includes('if (!suppressInterruptedOutcome && (observation.reward !== undefined || observation.success !== undefined))'),
  'a discarded reward must not be attached to the next selected action');

const receiptRecoveryStart = core.indexOf('private feedbackReceiptBlocksSpineOutcome()');
const receiptRecoveryEnd = core.indexOf('private async feedbackSpineOnly', receiptRecoveryStart);
assert.ok(receiptRecoveryStart >= 0 && receiptRecoveryEnd > receiptRecoveryStart,
  'spine recovery must use a bounded, separate receipt classifier');
const receiptRecovery = core.slice(receiptRecoveryStart, receiptRecoveryEnd);
assert.ok(receiptRecovery.includes("receipt.status === 'in-progress' || receipt.status === 'completed'"),
  'recovery classifier must understand both in-progress and completed durable receipts');
assert.ok(receiptRecovery.includes('if (!valid) return'),
  'corrupt receipts must suppress learning without freezing the cognitive tick');

const receiptDirectory = await mkdtemp(join(tmpdir(), 'nk1-feedback-delivery-'));
try {
  const receiptStore = new FileStateStore(join(receiptDirectory, 'receipt.json'), {
    backupEverySaves: 1, directoryFsyncEverySaves: 1, strictDirectoryFsync: true,
  });
  const pendingReceipt = {
    version: 1, tick: 27, decisionId: 'decision-27', action: 'verify', status: 'in-progress',
  };
  await receiptStore.save(pendingReceipt);
  const recoveredPending = await receiptStore.load();
  assert.deepEqual(recoveredPending, pendingReceipt, 'pending feedback reservation must survive file-store restart');
  const resumedGuard = new FeedbackDeliveryGuard();
  assert.throws(
    () => resumedGuard.begin({ tick: 27, decisionId: 'decision-27', action: 'verify', previousReceipt: recoveredPending }),
    /already in progress/,
    'a crash-recovered in-progress receipt must block replay of its tick',
  );

  const completedReceipt = { ...pendingReceipt, status: 'completed' };
  await receiptStore.save(completedReceipt);
  const recoveredCompleted = await receiptStore.load();
  assert.deepEqual(recoveredCompleted, completedReceipt, 'completed feedback receipt must survive file-store restart');
  assert.throws(
    () => resumedGuard.begin({ tick: 27, decisionId: 'decision-27', action: 'verify', previousReceipt: recoveredCompleted }),
    /already been finalized/,
    'a crash-recovered completed receipt must block replay of its tick',
  );
  const recoveryGuard = new FeedbackDeliveryGuard();
  const nextAfterInterruptedTick = recoveryGuard.begin({
    tick: 28, decisionId: 'decision-28', action: 'reflect', previousReceipt: recoveredPending,
  });
  assert.equal(recoveryGuard.complete(nextAfterInterruptedTick).tick, 28,
    'a stranded older reservation must block its own tick but not permanently disable future ticks');
} finally {
  await rm(receiptDirectory, { recursive: true, force: true });
}

const b273LearnGuard = b273.slice(b273.indexOf('private assertGeneratedDecision'), b273.indexOf('  learnFromOutcome('));
assert.ok(b273LearnGuard.includes('!this.state.lastActionPlan.includes(input.action)'),
  'B273 learning must validate that the rewarded action belongs to the generated plan');
assert.ok(b273.includes('recordUnselectedAction(input:'),
  'B273 must retain bounded evidence for an unselected proposal without reward credit');

const b273PathStart = core.indexOf('const b273Current = this.developmentalNeural.autonomousGoalLifecycleB273.current();');
const b273PathEnd = core.indexOf('const b274Diag', b273PathStart);
const b273Path = core.slice(b273PathStart, b273PathEnd);
assert.ok(b273Path.includes('b273Current.plan.includes(trace.selected.action)'),
  'normal feedback must restrict B273 learning to actions offered by the generated plan');
assert.ok(b273Path.includes('b273Learner.recordUnselectedAction('),
  'normal feedback must not reward a B273 action that lost arbitration');

const b338PathStart = core.indexOf('const b338Lifecycle = this.developmentalNeural.autonomousGoalLifecycleB273.current();');
const b338PathEnd = core.indexOf('this.persisted.system.autonomousGoalLifecycleB273 = this.developmentalNeural.autonomousGoalLifecycleB273.snapshot();', b338PathStart);
const b338Path = core.slice(b338PathStart, b338PathEnd);
assert.ok(b338Path.includes('b338Lifecycle.plan.includes(trace.selected.action)'),
  'world-transition feedback must restrict B273 learning to actions offered by the generated plan');
assert.ok(b338Path.includes('b273Learner.recordUnselectedAction('),
  'world-transition feedback must record rejected B273 proposals without credit');

assert.ok(b274.includes('selectedAction:ActionKind'),
  'B274 trial contract must require evidence of the action actually selected');
const b274TrialGuard = b274.slice(b274.indexOf('observeTrial(input:'), b274.indexOf('promoteTransferred(input:'));
assert.ok(b274TrialGuard.includes('input.selectedAction!==expectedAction'),
  'B274 must reject a candidate trial whose first action was not executed');
assert.ok(b274TrialGuard.indexOf('input.selectedAction!==expectedAction') < b274TrialGuard.indexOf('this.state.realTrials++'),
  'B274 must reject attribution before counting a trial or mutating candidate quality');
assert.ok(b274TrialGuard.includes('this.state.unmatchedOutcomeCount'),
  'B274 must retain observability for outcomes not attributable to the active skill');
const b274CoreCall = core.slice(core.indexOf('const b274Trial = this.developmentalNeural.autonomousSkillLaboratoryB274.observeTrial('), core.indexOf('if (b274Trial.promoted', core.indexOf('const b274Trial = this.developmentalNeural.autonomousSkillLaboratoryB274.observeTrial(')));
assert.ok(b274CoreCall.includes('selectedAction: trace.selected.action'),
  'Core must pass the canonical selected action into B274 trial evaluation');

console.log('Cognitive/B272/B273/B274 feedback attribution and durable exactly-once delivery: PASS');
