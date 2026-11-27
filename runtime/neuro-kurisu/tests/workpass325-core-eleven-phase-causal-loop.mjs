import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const core = await readFile(new URL('../src/organism/core/OrganismCore.ts', import.meta.url), 'utf8');
const position = (needle) => {
  const index = core.indexOf(needle);
  assert.notEqual(index, -1, 'missing Core phase: ' + needle);
  return index;
};

const observation = position("const observationEvent = this.cognitiveRuntime.cognitiveEventFabric.append({ tick: state.tick, stage: 'observation'");
const prediction = position("const predictionEvent = this.cognitiveRuntime.cognitiveEventFabric.append({ tick: state.tick, stage: 'prediction'");
const appraisal = position("stage: 'appraisal', source: 'core.homeostatic-appraisal'");
const attention = position("stage: 'attention', source: 'core.global-workspace'");
const memory = position("stage: 'memory', source: 'core.active-memory-context'");
const goal = position("stage: 'goal', source: 'core.canonical-goal-selection'");
const plan = position("stage: 'plan', source: 'core.plan-selection'");
const action = position("stage: 'action', source: 'core.organism-policy'");

// Current and delayed outcomes share the same causal phase, but use a deliberate
// tick policy: current feedback closes the originating tick; delayed feedback
// records the real arrival tick and must not close the newer operational cycle.
const delayed = position("const delayedFeedback = Boolean(trace && trace.id !== this.persisted.traces[0]?.id);");
const decisionTick = position("const decisionCycleTick = trace?.tick ?? state.tick;");
const eventTick = position("const feedbackEventTick = delayedFeedback ? state.tick : decisionCycleTick;");
const outcome = position("const outcomeEvent = this.cognitiveRuntime.cognitiveEventFabric.append({\n            id: feedbackOutcomeEventId,\n            tick: feedbackEventTick,\n            stage: 'outcome'");
const learning = position("const learningEvent = this.cognitiveRuntime.cognitiveEventFabric.append({\n            id: `cef:learning:${feedbackEventKey.slice(0, 56)}`,\n            tick: feedbackEventTick, stage: 'learning'");
const selfUpdate = position("const selfUpdateEvent = this.cognitiveRuntime.cognitiveEventFabric.append({\n            id: `cef:self-update:${feedbackEventKey.slice(0, 48)}`,\n            tick: feedbackEventTick, stage: 'self-update'");

assert.ok(
  observation < prediction && prediction < appraisal && appraisal < attention &&
  attention < memory && memory < goal && goal < plan && plan < action &&
  action < delayed && delayed < decisionTick && decisionTick < eventTick &&
  eventTick < outcome && outcome < learning && learning < selfUpdate,
  'the canonical Core cycle must preserve eleven-stage ordering and explicit current/delayed feedback tick selection',
);
assert.ok(core.includes("const cycleStageIds = delayedFeedback ? undefined : {"),
  'a delayed outcome must not masquerade as completion of the newer active cycle');
assert.ok(core.includes("outcomeTick: state.tick, outcomeId: feedbackOutcomeId"),
  'the event must retain the actual feedback-arrival tick separately from the decision tick');
assert.ok(core.includes("this.persisted.system.delayedCognitiveOutcome = {"),
  'delayed outcome diagnostics must be persisted without clearing the newer cycle');
assert.ok(core.includes("this.cognitiveCycleAnchors = {};"),
  'the current cycle anchors may only be cleared by the current-cycle close branch');

for (const anchor of [
  "parentIds: [observationEvent.id, predictionEvent.id]",
  "parentIds: [appraisalEvent.id, predictionEvent.id]",
  "parentIds: [attentionEvent.id, observationEvent.id]",
  "parentIds: [appraisalEvent.id, memoryEvent.id]",
  "parentIds: [goalEvent.id, predictionEvent.id]",
  "parentIds: [planEvent.id, predictionEvent.id, observationEvent.id]",
]) assert.ok(core.includes(anchor), 'missing causal parent relationship: ' + anchor);

const anchorLine = core.slice(core.indexOf('private cognitiveCycleAnchors'), core.indexOf('private persisted:', core.indexOf('private cognitiveCycleAnchors')));
for (const stage of ['observation','prediction','appraisal','attention','memory','goal','plan','action']) {
  assert.ok(anchorLine.includes(stage), 'cycle anchors omit ' + stage);
}
const cycleMapStart = position('const cycleStageIds = delayedFeedback ? undefined : {');
const cycleMapEnd = core.indexOf(';', cycleMapStart);
const cycleMap = core.slice(cycleMapStart, cycleMapEnd);
for (const stage of ['observation','prediction','appraisal','attention','memory','goal','plan','action','outcome','learning']) {
  assert.ok(cycleMap.includes(stage), 'verified cycle omits phase ' + stage);
}
assert.ok(core.indexOf('verifyOperationalCycle(cycleStageIds)', cycleMapStart) > cycleMapStart);
assert.ok(core.indexOf('unifiedCognitiveCycle.evaluate({ tick: state.tick, stageIds: cycleStageIds', cycleMapStart) > cycleMapStart);

console.log('WorkPass325 Core eleven-phase causal loop: PASS');
