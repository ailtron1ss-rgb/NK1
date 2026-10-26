import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { FeedbackDeliveryGuard } from '../src/organism/core/FeedbackDeliveryGuard.ts';

const core = await readFile(new URL('../src/organism/core/OrganismCore.ts', import.meta.url), 'utf8');
const b272 = await readFile(new URL('../src/organism/cognition/B272EndogenousGoalGenesis.ts', import.meta.url), 'utf8');
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
  'const b338Learning = b338GoalSnapshot.tick === state.tick && trace.selected.action === b338GoalState.action',
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

assert.match(stateMigrations, /feedbackDeliveryReceipt\?: unknown;/,
  'PersistedOrganism must type the receipt as an untrusted migration boundary');
assert.match(stateMigrations, /feedbackDeliveryReceipt: raw\.system\?\.feedbackDeliveryReceipt/,
  'state migration must preserve the receipt so restart cannot silently reopen feedback replay');

assert.ok(core.includes("private readonly feedbackDeliveryGuard = new FeedbackDeliveryGuard()"),
  'Core must own a feedback delivery guard');

const spineStart = core.indexOf('private async feedbackSpineOnly');
const spineEnd = core.indexOf('private expectedClosureDomains', spineStart);
assert.ok(spineStart >= 0 && spineEnd > spineStart, 'spine-only feedback boundary must be discoverable');
const spineBlock = core.slice(spineStart, spineEnd);
const spineBegin = spineBlock.indexOf('this.feedbackDeliveryGuard.begin(');
const firstSpineMutation = spineBlock.indexOf('state.lastActionSuccess = success');
assert.ok(spineBegin >= 0 && spineBegin < firstSpineMutation,
  'spine-only feedback must reserve its tick before learner/state mutation');
assert.ok(spineBlock.indexOf('this.feedbackDeliveryGuard.complete(feedbackDeliveryToken)') > firstSpineMutation,
  'spine-only feedback must persist completion after successful learning');

const mainFeedbackStart = core.indexOf('async feedback(outcome:');
const mainFeedbackEnd = core.indexOf('cameraEvidenceSnapshot()', mainFeedbackStart);
assert.ok(mainFeedbackStart >= 0 && mainFeedbackEnd > mainFeedbackStart, 'main feedback boundary must be discoverable');
const mainFeedback = core.slice(mainFeedbackStart, mainFeedbackEnd);
const mainBegin = mainFeedback.indexOf('this.feedbackDeliveryGuard.begin(');
const firstMainMutation = mainFeedback.indexOf("this.persistence.revisionTokens.touch('critical-kernel'");
assert.ok(mainBegin >= 0 && mainBegin < firstMainMutation,
  'main feedback must reserve its tick before subsystem mutation');
assert.ok(mainFeedback.lastIndexOf('this.feedbackDeliveryGuard.complete(feedbackDeliveryToken)') > mainFeedback.lastIndexOf('this.persisted.facets.learning.operationalLife ='),
  'main feedback must finalize the receipt after all learner updates');
assert.ok(mainFeedback.lastIndexOf('this.feedbackDeliveryGuard.complete(feedbackDeliveryToken)') < mainFeedback.lastIndexOf('await this.checkpoint(false)'),
  'completion receipt must be included in the final checkpoint');

const b273RouteStart = mainFeedback.indexOf('const b273Learner = this.developmentalNeural.autonomousGoalLifecycleB273;');
assert.ok(b273RouteStart >= 0, 'B273 feedback must resolve its canonical learner');
const b273Route = mainFeedback.slice(b273RouteStart, b273RouteStart + 2600);
assert.ok(b273Route.includes('const b273Decision = b273Learner.snapshot();'),
  'B273 attribution must read the canonical generated decision, not a presentation snapshot');
assert.ok(b273Route.includes('b273Decision.tick === state.tick'),
  'B273 must skip reward attribution if its generated decision belongs to another tick');
assert.ok(b273Route.includes('const b273Plan = b273Decision.lastActionPlan;'),
  'B273 must validate outcomes against the exact recorded plan');
assert.ok(b273Route.includes('b273Learner.recordUnselectedAction('),
  'an action outside the canonical generated plan must be recorded without reward credit');
assert.ok(!b273Route.includes('b273Current.plan.includes(trace.selected.action)'),
  'a synthesized current() presentation plan must not be used as outcome authority');

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


console.log('Cognitive/B272 feedback attribution and exactly-once delivery: PASS');
