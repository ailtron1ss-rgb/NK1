import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const core = await readFile(new URL('../src/organism/core/OrganismCore.ts', import.meta.url), 'utf8');
const b272 = await readFile(new URL('../src/organism/cognition/B272EndogenousGoalGenesis.ts', import.meta.url), 'utf8');

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

console.log('Cognitive/B272 feedback attribution wiring: PASS');
