import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';

/**
 * Aspect 01 — Unified Cognitive Core.
 *
 * This is an execution-path regression, not an architecture diagram: it boots the
 * canonical OrganismRuntime, drives real cycles, and asserts that every stage from
 * perception to reflection is present, causally linked, and produces the artifact
 * the next stage consumes. It also pins the lifecycle contracts that were broken
 * on the source branch:
 *   1. one canonical reality-evidence ledger owner (no runtime shadow ledger),
 *   2. a cycle can still be closed after a restart between perception and outcome,
 *   3. duplicate outcome delivery cannot double-learn.
 */

const CYCLE_STAGES = ['observation', 'prediction', 'appraisal', 'attention', 'memory', 'goal', 'plan', 'action', 'outcome', 'learning', 'self-update'];
const EXTERNAL_TEXT = 'Check the calibration record and confirm the measured drift.';
const FOLLOW_UP_TEXT = 'What did we establish about the calibration record drift?';

const makeRuntime = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nk-aspect01-'));
  return new OrganismRuntime({
    stateFile: path.join(root, 'organism.json'),
    intervalMs: 60_000,
    enableLanguage: false,
    autoRun: false,
    stateStore: new MemoryStateStore(),
    worldStateStore: new MemoryStateStore(),
    journal: new BoundedOperationalJournal(),
    checkpointMinIntervalMs: 0,
    checkpointMaxDirtyCycles: 1,
    enableLifelongLearning: true,
    performanceProfile: 'balanced',
  });
};

const eventsForTick = (snapshot, tick) => snapshot.recent.filter(event => event.tick === tick && CYCLE_STAGES.includes(event.stage));

/**
 * Walk the cycle as one connected feedforward chain instead of trusting stage
 * presence: each stage must cite the previous stage's event as a parent.
 */
const assertConnectedChain = (snapshot, tick, label) => {
  const events = eventsForTick(snapshot, tick);
  const chain = [];
  for (const stage of CYCLE_STAGES) {
    const previous = chain.at(-1);
    const matches = events.filter(event => event.stage === stage && (!previous || event.parentIds.includes(previous.id)));
    assert.ok(matches.length > 0, `${label}: stage "${stage}" is missing or is not causally linked to "${previous?.stage ?? 'the observation'}" at tick ${tick}`);
    chain.push(matches[0]);
  }
  return chain;
};

// ---------------------------------------------------------------- end-to-end run
const runtime = makeRuntime();
await runtime.init();

const first = await runtime.step(EXTERNAL_TEXT);
const captureAfterFirst = {
  emotion: runtime.core.emotionAppraisalSnapshot(),
  grounding: runtime.core.realityGroundingSnapshot(),
  predictions: runtime.core.predictionLedgerSnapshot(),
  consciousness: runtime.core.consciousnessSnapshot(),
};
const second = await runtime.step(EXTERNAL_TEXT);
const captureAfterSecond = {
  emotion: runtime.core.emotionAppraisalSnapshot(),
  grounding: runtime.core.realityGroundingSnapshot(),
  predictions: runtime.core.predictionLedgerSnapshot(),
  consciousness: runtime.core.consciousnessSnapshot(),
};
const steps = [first, second];
const captures = [captureAfterFirst, captureAfterSecond];

assert.equal(first.cycle.state.tick, 1, 'the first runtime step must execute cycle 1');
assert.equal(second.cycle.state.tick, 2, 'the second runtime step must execute cycle 2');

const coreFabric = runtime.core.cognitiveEventFabricSnapshot();
const runtimeFabric = runtime.cognitiveEventFabricSnapshot();

for (const [index, step] of steps.entries()) {
  const tick = step.cycle.state.tick;
  const captured = captures[index];
  const chain = assertConnectedChain(coreFabric, tick, 'core fabric');
  assert.deepEqual(chain.map(event => event.stage), CYCLE_STAGES, `core ledger must record the canonical stage order at tick ${tick}`);

  // The runtime operational envelope verifies the same cycle through its own
  // event contract; a complete core cycle that the envelope reports as broken
  // would mean the two owners disagree about the same execution.
  const envelope = assertConnectedChain(runtimeFabric, tick, 'runtime fabric');
  const envelopeIds = { observation: envelope[0].id, prediction: envelope[1].id, appraisal: envelope[2].id, attention: envelope[3].id, memory: envelope[4].id, goal: envelope[5].id, plan: envelope[6].id, action: envelope[7].id, outcome: envelope[8].id, learning: envelope[9].id, 'self-update': envelope[10].id };
  const envelopeLineage = runtime.cognitiveEventFabric.verifyOperationalCycle(envelopeIds);
  assert.equal(envelopeLineage.complete, true, `runtime cycle envelope must be complete at tick ${tick}: ${JSON.stringify(envelopeLineage)}`);

  // PERCEPTION: explicit user text is an external observation, not a model guess.
  const observation = chain[0];
  assert.equal(observation.external, true, 'user text must be recorded as an external observation');
  assert.equal(observation.payload.hasText, true, 'the observation stage must carry the perceived text');

  // APPRAISAL: the emotion/needs appraisal for this exact tick exists before attention.
  const appraisal = chain[2];
  for (const key of ['energy01', 'cognitiveLoad01', 'uncertainty01', 'novelty01', 'socialNeed01', 'goalPressure01']) {
    assert.equal(Number.isFinite(Number(appraisal.payload[key])), true, `appraisal must expose finite ${key}`);
  }
  const emotion = captured.emotion;
  assert.equal(emotion.lastTick, tick, 'the persisted emotion appraisal must have advanced for this tick');
  assert.equal(typeof emotion.lastLabel, 'string', 'the appraisal stage must produce a labelled affective state');

  // ATTENTION: the workspace broadcast that was actually used by the decision.
  const attention = chain[3];
  assert.equal(attention.payload.broadcastId, step.cycle.workspace.broadcastId, 'the attention stage must record the broadcast the decision consumed');
  assert.equal(Number.isFinite(Number(attention.payload.attentionBudget01)), true, 'attention budget must be finite');

  // MEMORY: retrieval evidence and the memory context handed to consumers are two
  // different sets and must both be reconcilable with the cycle result.
  const memory = chain[4];
  assert.equal(memory.payload.retrievedCount, memory.payload.retrievedMemoryIds.length, 'retrievedCount must match the recorded retrieval ids');
  assert.equal(memory.payload.exposedCount, step.cycle.memories.length, 'exposedCount must match the memory context returned to consumers');
  assert.deepEqual(memory.payload.exposedMemoryIds, step.cycle.memories.map(item => item.id).slice(0, 12), 'the exposed memory ids must match the cycle memory context');
  assert.equal(envelope[4].payload.cycleMemoryCount, step.cycle.memories.length, 'the runtime envelope must record the same cycle memory context');

  // MOTIVATION -> GOAL: the selected goal is a real external goal, not an empty slot.
  const goal = chain[5];
  assert.equal(goal.payload.selectedGoalId, step.cycle.decision.selected?.goalId ?? null, 'the goal stage must record the goal that actually drove the decision');
  assert.ok(Array.isArray(goal.payload.activeGoalIds) && goal.payload.activeGoalIds.length > 0, 'an external request must create an active goal');
  assert.ok(step.cycle.goals.some(item => item.id === goal.payload.selectedGoalId), 'the selected goal must be resolved from the cycle goal set');

  // PLANNING: the core records the governed candidate selection that produced the
  // action; the runtime envelope records the executable world plan for that action.
  const plan = chain[6];
  assert.ok(Number(plan.payload.candidateCount) >= 1, 'the plan stage must consider at least one candidate');
  assert.equal(plan.payload.selectedAction, step.cycle.decision.selected?.action, 'the plan stage must name the selected candidate action');
  assert.ok(plan.payload.candidateActions.includes(plan.payload.selectedAction), 'the selected action must come from the recorded candidate set');
  assert.ok(Number(envelope[6].payload.stepCount) >= 1, 'the runtime envelope plan must contain at least one executable step');
  assert.equal(envelope[6].payload.nextAction, step.worldAction, 'the runtime plan must name the world action that was executed');

  // ACTION: the core records the internal policy action; the runtime envelope
  // records the embodied action that actually executed for it.
  const action = chain[7];
  assert.equal(action.payload.action, step.cycle.decision.selected?.action, 'the core action stage must record the internal policy action');
  assert.equal(envelope[7].payload.internalAction, step.cycle.decision.selected?.action, 'the runtime envelope must cite the same internal policy action');
  assert.equal(envelope[7].payload.action, step.embodiedAction.action, 'the runtime envelope must record the embodied action that executed');

  // OUTCOME VERIFICATION: the physical/shadow consequence is assessed, not assumed.
  const outcome = chain[8];
  assert.deepEqual(outcome.parentIds.slice(0, 1), [action.id], 'the outcome must be verified against the action it follows');
  assert.equal(Number.isFinite(Number(outcome.payload.surprise)), true, 'the outcome must carry a finite surprise signal');
  assert.ok(outcome.source === 'simulator' || outcome.source === 'device', `unexpected outcome source: ${outcome.source}`);
  const grounding = captured.grounding;
  assert.equal(grounding.last?.tick, tick, 'reality grounding must resolve the outcome for this tick');
  assert.ok(['external', 'simulation'].includes(grounding.last.source), 'grounding must classify the outcome source');
  assert.equal(Number.isFinite(Number(grounding.last.verified01)), true, 'grounding must expose verified01');
  assert.equal(Number.isFinite(Number(grounding.last.independent01)), true, 'grounding must expose independent01');
  assert.equal(grounding.last.reason.length > 0, true, 'grounding must explain why the outcome was accepted');

  // LEARNING: the core records the prediction error that was learned from; the
  // runtime envelope binds that learning to the grounded reality source.
  const learning = chain[9];
  assert.equal(Number.isFinite(Number(learning.payload.predictionError)), true, 'the learning stage must carry the learned prediction error');
  assert.equal(Number.isFinite(Number(learning.payload.uncertainty)), true, 'the learning stage must carry residual uncertainty');
  assert.equal(envelope[9].payload.realitySource, grounding.last.source, 'runtime learning must consume the grounded result, not a caller-provided label');
  const resolved = captured.predictions.resolved.filter(row => row.tick === tick);
  assert.ok(resolved.length > 0, 'the reward prediction for this cycle must be resolved by the outcome');
  assert.ok(resolved.every(row => Number.isFinite(Number(row.error01))), 'resolved predictions must carry a finite error');

  // REFLECTION / SELF-UPDATE: the cycle closes into identity state that the next
  // cycle starts from. The core records identity coherence, the runtime envelope
  // records the persisted continuity value.
  const selfUpdate = chain[10];
  assert.equal(Number.isFinite(Number(selfUpdate.payload.identityCoherence)), true, 'self-update must carry identity coherence');
  assert.equal(Number(selfUpdate.payload.identityCoherence), Number(step.cycle.state.needs.identityCoherence), 'self-update must record the live identity coherence value');
  assert.equal(Number.isFinite(Number(envelope[10].payload.identityContinuity01)), true, 'the runtime envelope must record identity continuity');
}

// The runtime operational envelope and the core cycle must agree about how many
// complete cycles happened; two independent counters that disagree would let the
// organism claim completeness it cannot prove.
const runtimeCycles = runtime.unifiedCognitiveCycleSnapshot();
const coreCycles = runtime.core.unifiedCognitiveCycleSnapshot();
assert.equal(runtimeCycles.cycles, 2, 'the runtime must evaluate both cycles');
assert.equal(coreCycles.cycles, 2, 'the core cycle owner must evaluate both cycles');
assert.equal(runtimeCycles.completeCycles, 2, 'both cycles must be complete');
assert.equal(coreCycles.completeCycles, 2, 'both cycles must be complete in the core owner');
assert.equal(runtimeCycles.brokenLineages, 0, 'no lineage may break in a healthy cycle');
assert.equal(coreCycles.brokenLineages, 0, 'no lineage may break in a healthy cycle');


// ------------------------------------------------------- reflection -> memory loop
const beforeReflectionMemory = steps[1].cycle.memories.length;
const reflection = await runtime.sleepConsolidate();
assert.ok(reflection.memories.length >= 1, 'reflection must consolidate at least one episode memory');
const p47 = runtime.core.p47Snapshot();
assert.ok(p47.ingestedEvents > 0, 'reflection must ingest the canonical event log');
assert.ok(p47.lastReflectionAt > 0, 'reflection must record when it ran');
assert.ok(p47.compressions >= 1, 'reflection must compact the temporal memory graph');

const afterReflection = await runtime.step(FOLLOW_UP_TEXT);
const afterTick = afterReflection.cycle.state.tick;
assert.ok(afterReflection.cycle.memories.length >= 1, 'after reflection the next cycle must retrieve consolidated experience');
const afterMemoryEvent = eventsForTick(runtime.core.cognitiveEventFabricSnapshot(), afterTick).find(event => event.stage === 'memory');
assert.ok(afterMemoryEvent.payload.retrievedCount >= 1, 'the memory stage must report the retrieved experience it passed forward');
assert.ok(afterReflection.cycle.memories.length >= beforeReflectionMemory, 'reflection must not reduce the cycle memory context');

// ------------------------------------------------------------ single ledger owner
const canonicalLedger = runtime.realityEvidenceLedgerSnapshot();
assert.deepEqual(runtime.core.realityEvidenceLedgerSnapshot(), canonicalLedger, 'the runtime must read the canonical ledger, not a second copy');
const observationRows = canonicalLedger.recent.filter(row => row.claim.startsWith('observation:'));
assert.ok(observationRows.length >= 1, 'user perception must survive in the canonical reality-evidence ledger');
assert.ok(observationRows.every(row => row.realityClass === 'user-reported'), 'user text must be classified as user-reported evidence');
assert.ok(canonicalLedger.recent.some(row => row.claim.startsWith('action-consequence:')), 'the runtime consequence must be recorded in the same ledger');
assert.ok(canonicalLedger.recent.some(row => row.claim === 'cognitive-cycle-completeness'), 'cycle completeness evidence must be recorded in the same ledger');
assert.ok(canonicalLedger.externalCount >= 1, 'external/user evidence must not be dropped from the canonical ledger');

await runtime.stop();


// ------------------------------------------------------------- determinism control
const twin = makeRuntime();
await twin.init();
const twinFirst = await twin.step(EXTERNAL_TEXT);
const twinSecond = await twin.step(EXTERNAL_TEXT);
for (const [index, step] of [twinFirst, twinSecond].entries()) {
  const original = steps[index];
  assert.equal(step.cycle.state.tick, original.cycle.state.tick, 'deterministic control must execute the same ticks');
  assert.equal(step.cycle.decision.selected?.action, original.cycle.decision.selected?.action, `deterministic control diverged in the internal action at tick ${index + 1}`);
  assert.equal(step.worldAction, original.worldAction, `deterministic control diverged in the world action at tick ${index + 1}`);
  assert.equal(step.embodiedAction.action, original.embodiedAction.action, `deterministic control diverged in the embodied action at tick ${index + 1}`);
  const originalStages = assertConnectedChain(coreFabric, index + 1, 'original run').map(event => event.stage);
  const twinStages = assertConnectedChain(twin.core.cognitiveEventFabricSnapshot(), index + 1, 'deterministic control').map(event => event.stage);
  assert.deepEqual(twinStages, originalStages, `deterministic control diverged in the stage sequence at tick ${index + 1}`);
}
const twinCycles = twin.unifiedCognitiveCycleSnapshot();
assert.equal(twinCycles.completeCycles, runtimeCycles.completeCycles, 'deterministic control must close the same number of complete cycles');
await twin.stop();

// ------------------------------------------------ lifecycle: restart closes a cycle
const restartedCore = new OrganismCore(new MemoryStateStore(), { performanceProfile: 'balanced', cycleResultMode: 'full' });
await restartedCore.init();
const openCycle = await restartedCore.observe({ text: EXTERNAL_TEXT, novelty: .4, surprise: .3 }, 'full');
const openTick = openCycle.state.tick;
const persistedDuringOpenCycle = restartedCore.snapshot();
const timelineBefore = eventsForTick(restartedCore.cognitiveEventFabricSnapshot(), openTick);
assert.equal(timelineBefore.length, 8, 'the open cycle must persist all eight perception-to-action stages before the outcome exists');

const resumedCore = new OrganismCore(new MemoryStateStore({ initial: persistedDuringOpenCycle }), { performanceProfile: 'balanced', cycleResultMode: 'full' });
await resumedCore.init();
await resumedCore.feedback({ success: 1, reward: .7, surprise: .2, evidenceSource: 'user' });
const resumedCycles = resumedCore.unifiedCognitiveCycleSnapshot();
assert.equal(resumedCycles.cycles, 1, 'the resumed process must evaluate the interrupted cycle');
assert.equal(resumedCycles.completeCycles, 1, `a cycle interrupted before outcome verification must still close: ${JSON.stringify(resumedCycles)}`);
assert.equal(resumedCycles.brokenLineages, 0, 'a restart must not break the causal lineage of an open cycle');
assert.deepEqual(resumedCycles.lastMissingStages, [], 'a restart must not lose required stages');
const resumedFabric = resumedCore.cognitiveEventFabricSnapshot();
const resumedOutcome = resumedFabric.recent.find(event => event.tick === openTick && event.stage === 'outcome');
assert.equal(resumedOutcome.parentIds.length, 2, 'the recovered outcome must cite the recovered action and prediction');
const recoveredStages = new Set(eventsForTick(resumedFabric, openTick).map(event => event.stage));
assert.ok(CYCLE_STAGES.every(stage => recoveredStages.has(stage)), 'every stage of the interrupted cycle must survive the restart');

// ------------------------------------------- lifecycle: duplicate outcome delivery
const learningBefore = resumedCore.b365UnifiedNeuroCausalDiagnostics().learningUpdates;
const resolvedBefore = resumedCore.predictionLedgerSnapshot().resolved.length;
await resumedCore.feedback({ success: 0, reward: -1, surprise: .95, evidenceSource: 'unknown' });
assert.equal(resumedCore.unifiedCognitiveCycleSnapshot().cycles, resumedCycles.cycles, 'a duplicate outcome must not create a second cycle');
assert.equal(resumedCore.b365UnifiedNeuroCausalDiagnostics().learningUpdates, learningBefore, 'a duplicate outcome must not run the learning path twice');
assert.equal(resumedCore.predictionLedgerSnapshot().resolved.length, resolvedBefore, 'a duplicate outcome must not resolve another prediction');
assert.ok(resumedCore.snapshot().facets.memory.eventLog.some(event => event.type === 'feedback-duplicate-ignored'), 'a duplicate outcome must be recorded as an explicitly ignored delivery');

console.log(JSON.stringify({
  pass: true,
  status: 'ASPECT01_UNIFIED_COGNITIVE_CYCLE_PASS',
  stages: CYCLE_STAGES,
  cycles: { runtime: runtimeCycles, core: coreCycles },
  grounding: { source: runtime.core.realityGroundingSnapshot().last?.source },
  evidence: { total: canonicalLedger.total, externalCount: canonicalLedger.externalCount, simulatorCount: canonicalLedger.simulatorCount },
  reflection: { memories: reflection.memories.length, ingestedEvents: p47.ingestedEvents, compressions: p47.compressions },
  restartClosure: { cycles: resumedCycles.cycles, completeCycles: resumedCycles.completeCycles, brokenLineages: resumedCycles.brokenLineages },
  determinism: { ticks: steps.map(step => step.cycle.state.tick), actions: steps.map(step => step.cycle.decision.selected?.action) },
}, null, 2));

