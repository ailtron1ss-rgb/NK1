import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const core = await readFile(new URL('../src/organism/core/OrganismCore.ts', import.meta.url), 'utf8');
const position = (needle) => { const index = core.indexOf(needle); assert.notEqual(index, -1, 'missing Core phase: ' + needle); return index; };

const observation = position("stage: 'observation'");
const prediction = position("stage: 'prediction'");
const appraisal = position("stage: 'appraisal', source: 'core.homeostatic-appraisal'");
const attention = position("stage: 'attention', source: 'core.global-workspace'");
const memory = position("stage: 'memory', source: 'core.active-memory-context'");
const goal = position("stage: 'goal', source: 'core.canonical-goal-selection'");
const plan = position("stage: 'plan', source: 'core.plan-selection'");
const action = position("stage: 'action', source: 'core.organism-policy'");
const outcome = position("stage: 'outcome'");
const learning = position("stage: 'learning'");
const selfUpdate = position("stage: 'self-update'");
assert.ok(observation < prediction && prediction < appraisal && appraisal < attention && attention < memory && memory < goal && goal < plan && plan < action && action < outcome && outcome < learning && learning < selfUpdate, 'the canonical Core cycle must preserve the eleven-phase ordering');

for (const anchor of [
  "parentIds: [observationEvent.id, predictionEvent.id]",
  "parentIds: [appraisalEvent.id, predictionEvent.id]",
  "parentIds: [attentionEvent.id, observationEvent.id]",
  "parentIds: [appraisalEvent.id, memoryEvent.id]",
  "parentIds: [goalEvent.id, predictionEvent.id]",
  "parentIds: [planEvent.id, predictionEvent.id, observationEvent.id]",
]) assert.ok(core.includes(anchor), 'missing causal parent relationship: ' + anchor);

const anchorLine = core.slice(core.indexOf('private cognitiveCycleAnchors'), core.indexOf('private persisted:', core.indexOf('private cognitiveCycleAnchors')));
for (const stage of ['observation','prediction','appraisal','attention','memory','goal','plan','action']) assert.ok(anchorLine.includes(stage), 'cycle anchors omit ' + stage);
const cycleMapStart = position('const cycleStageIds = { observation: this.cognitiveCycleAnchors.observation');
const cycleMapEnd = core.indexOf(';', cycleMapStart);
const cycleMap = core.slice(cycleMapStart, cycleMapEnd);
for (const stage of ['appraisal','attention','memory','goal','plan']) assert.ok(cycleMap.includes(stage + ': this.cognitiveCycleAnchors.' + stage), 'verified cycle omits optional phase ' + stage);
assert.ok(core.indexOf('verifyOperationalCycle(cycleStageIds)', cycleMapStart) > cycleMapStart);
assert.ok(core.indexOf('unifiedCognitiveCycle.evaluate({ tick: state.tick, stageIds: cycleStageIds', cycleMapStart) > cycleMapStart);

console.log('WorkPass325 Core eleven-phase causal loop: PASS');
