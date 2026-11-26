import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CognitiveEventFabric } from '../src/organism/system/CognitiveEventFabric.ts';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { normalizeMetacognitiveEpisode } from '../src/organism/cognition/MetacognitiveEpisode.ts';

const stagePayload = (source, payload = {}) => ({ source, confidence01: 0.8, payload });
const stageNames = ['observation','prediction','appraisal','attention','memory','goal','plan','action','outcome','learning','self-update'];
const stageIdMap = ids => ({
  observation: ids.observation, prediction: ids.prediction, appraisal: ids.appraisal,
  attention: ids.attention, memory: ids.memory, goal: ids.goal, plan: ids.plan,
  action: ids.action, outcome: ids.outcome, learning: ids.learning,
  'self-update': ids.selfUpdate,
});
const cycleInput = (tick, decisionId, overrides = {}) => ({
  tick, ...(decisionId === undefined ? {} : { decisionId }),
  observation: stagePayload('runtime', { inputId: `input:${tick}` }),
  prediction: stagePayload('reward-model', { predictionId: `prediction:${tick}` }),
  appraisal: stagePayload('homeostatic-appraisal', { energy01: 0.7 }),
  attention: stagePayload('global-workspace', { broadcastId: `workspace:${tick}` }),
  memory: stagePayload('MemoryFabric.retrieveForCognition', { retrievedCount: 1 }),
  goal: stagePayload('canonical-goal-selection', { goalId: `goal:${tick}` }),
  plan: stagePayload('plan-engine', { stepCount: 1 }),
  action: stagePayload('organism-action-gate', { action: 'explore' }),
  outcome: stagePayload('grounded-world', { verified: true }),
  learning: stagePayload('core.feedback', { accepted: true }),
  selfUpdate: stagePayload('core.lifecycle', { continuity01: 0.9 }),
  ...overrides,
});

const fabric = new CognitiveEventFabric(256);
const decisionId = 'decision:12:canonical';
const ids = fabric.recordOperationalCycle(cycleInput(12, decisionId));
const snapshot = fabric.snapshot();
const byId = new Map(snapshot.recent.map(event => [event.id, event]));
for (const stage of stageNames) {
  const key = stage === 'self-update' ? 'selfUpdate' : stage;
  const event = byId.get(ids[key]);
  assert.ok(event, `CEF retains ${stage}`);
  assert.equal(event.payload.decisionId, decisionId, `${stage} is bound to the canonical Core decision`);
}
const lineage = fabric.verifyOperationalCycle(stageIdMap(ids));
assert.equal(lineage.decisionId, decisionId);
assert.equal(lineage.decisionLineageComplete, true);
assert.deepEqual(lineage.decisionLineageIssues, []);
assert.equal(lineage.fullComplete, true);

const tampered = structuredClone(snapshot);
tampered.recent.find(event => event.id === ids.action).payload.decisionId = 'decision:other';
const restoredFabric = new CognitiveEventFabric(256);
restoredFabric.restore(tampered);
const broken = restoredFabric.verifyOperationalCycle(stageIdMap(ids));
assert.equal(broken.decisionLineageComplete, false);
assert.ok(broken.decisionLineageIssues.includes('action:decision-id-mismatch'));
assert.equal(broken.fullComplete, false);

const conflictFabric = new CognitiveEventFabric(256);
assert.throws(() => conflictFabric.recordOperationalCycle(cycleInput(13, 'decision:A', {
  action: stagePayload('organism-action-gate', { decisionId: 'decision:B', action: 'explore' }),
})), /cognitive-cycle-decision-id-conflict/);
assert.equal(conflictFabric.snapshot().total, 0, 'identity conflict is rejected before any event is appended');

for (const [stage, field] of [['attention','attention'], ['memory','memory']]) {
  const invalidFabric = new CognitiveEventFabric(256);
  assert.throws(() => invalidFabric.recordOperationalCycle(cycleInput(15, `decision:invalid-${stage}`, {
    [field]: { ...stagePayload(stage, { invalid: true }), receipt: {} },
  })), new RegExp(`invalid-stage-owner-receipt:${stage}:`));
  assert.equal(invalidFabric.snapshot().total, 0, `invalid ${stage} receipt must not leave a partial cycle`);
}

const legacyFabric = new CognitiveEventFabric(256);
const legacyIds = legacyFabric.recordOperationalCycle(cycleInput(14, undefined));
const legacy = legacyFabric.verifyOperationalCycle(stageIdMap(legacyIds));
assert.equal(legacy.decisionLineageComplete, true);
assert.equal(legacy.decisionId, undefined);
assert.equal(legacy.fullComplete, true);

const legacyEpisode = {
  version: 1, id: 'meta-cycle:41', cycleId: 'cycle:41', cognitiveEventId: 'cef:metacognitive:41',
  tick: 41, at: 1_798_000_000_000, parentEventIds: stageNames.map(stage => `${stage}:41`),
  belief: { summary: 'belief', confidence01: 0.72, uncertainty01: 0.28, provenance: 'inferred' },
  prediction: { summary: 'prediction', expectedOutcome01: 0.68, confidence01: 0.74, provenance: 'inferred' },
  selection: { goalId: 'goal:research', action: 'explore', rationale: ['governed utility'], consumedFeatures: { score: 0.81 } },
  outcome: { observedOutcome01: 0.51, predictionError01: 0.17, provenance: 'simulated', verified: false, independent: false },
  contradictions: [], limitations: ['simulated'],
  reflection: { status: 'not-evaluated', proposalId: null, disposition: 'none', summary: 'No correction proposed.' },
};
assert.ok(normalizeMetacognitiveEpisode(legacyEpisode), 'old episode schema remains readable');
assert.equal(normalizeMetacognitiveEpisode({ ...legacyEpisode, decisionId: 'bad\u0000id' }), null);
assert.equal(normalizeMetacognitiveEpisode({ ...legacyEpisode, decisionId })?.decisionId, decisionId);

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nk-decision-lineage-'));
const options = {
  stateFile: path.join(directory, 'organism.json'),
  worldStateFile: path.join(directory, 'world.json'),
  enableLanguage: false, autoRun: false, intervalMs: 100000,
};
let runtime;
let restoredRuntime;
try {
  runtime = new OrganismRuntime(options);
  await runtime.init();
  const result = await runtime.step('decision lineage integration check', { deliberate: true });
  const runtimeDecisionId = result.cycle.decision.id;
  assert.ok(typeof runtimeDecisionId === 'string' && runtimeDecisionId.length > 0);
  const runtimeSnapshot = runtime.cognitiveEventFabricSnapshot();
  const tick = result.cycle.state.tick;
  const cycleEvents = runtimeSnapshot.recent.filter(event => event.tick === tick && stageNames.includes(event.stage));
  assert.equal(cycleEvents.length, 11);
  assert.ok(cycleEvents.every(event => event.payload.decisionId === runtimeDecisionId));
  const runtimeVerifier = new CognitiveEventFabric(512);
  runtimeVerifier.restore(runtimeSnapshot);
  const runtimeIds = Object.fromEntries(stageNames.map(stage => [
    stage, cycleEvents.find(event => event.stage === stage)?.id,
  ]));
  const runtimeLineage = runtimeVerifier.verifyOperationalCycle(runtimeIds);
  assert.equal(runtimeLineage.decisionLineageComplete, true);
  assert.equal(runtimeLineage.decisionId, runtimeDecisionId);
  assert.equal(runtimeLineage.fullComplete, true);

  const episodeEvent = runtimeSnapshot.recent.find(event => event.tick === tick && event.stage === 'metacognitive-episode');
  assert.ok(episodeEvent);
  assert.equal(episodeEvent.payload.decisionId, runtimeDecisionId);
  assert.equal(episodeEvent.parentIds.length, 11);
  assert.ok(episodeEvent.parentIds.every(id =>
    runtimeSnapshot.recent.find(event => event.id === id)?.payload.decisionId === runtimeDecisionId));
  const storedEpisode = runtime.core.snapshot().facets.memory.eventLog
    .find(event => event.type === 'metacognitive-episode' && event.tick === tick)?.payload.episode;
  assert.ok(storedEpisode);
  assert.equal(storedEpisode.decisionId, runtimeDecisionId);
  await runtime.flush();
  await runtime.stop();
  runtime = null;

  restoredRuntime = new OrganismRuntime(options);
  await restoredRuntime.init();
  const restoredEpisode = restoredRuntime.core.snapshot().facets.memory.eventLog
    .find(event => event.type === 'metacognitive-episode' && event.tick === tick)?.payload.episode;
  assert.ok(restoredEpisode);
  assert.equal(restoredEpisode.decisionId, runtimeDecisionId);
  console.log(JSON.stringify({
    decisionId: runtimeDecisionId, stages: cycleEvents.map(event => event.stage),
    decisionLineageComplete: runtimeLineage.decisionLineageComplete,
    tamperRejected: !broken.decisionLineageComplete,
    legacyCompatible: legacy.decisionLineageComplete,
    persistedDecisionIdentity: storedEpisode.decisionId,
    restoredDecisionIdentity: restoredEpisode.decisionId,
  }, null, 2));
} finally {
  if (runtime) await runtime.stop();
  if (restoredRuntime) await restoredRuntime.stop();
  fs.rmSync(directory, { recursive: true, force: true });
}
