import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { RuntimeClosureLedger } from '../src/organism/system/RuntimeClosureLedger.ts';
import { CausalDomainClosureLedger } from '../src/organism/system/CausalDomainClosureLedger.ts';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

// A failed cycle remains failed even when a successful durability receipt is emitted
// for the same tick after the failure record.
const runtimeLedger = new RuntimeClosureLedger();
const failure = runtimeLedger.fail({ at: Date.now(), tick: 7, reason: 'fixture-aborted' });
assert.equal(failure.phase, 'failure');
assert.equal(failure.status, 'FAIL');
assert.equal(runtimeLedger.snapshot().lastBehaviorHash, failure.behaviorHash, 'failure fingerprint must replace stale successful behavior hash');
runtimeLedger.durable({ at: Date.now(), tick: 7, stateTick: 7, replaySignature: 'fixture-signature', continuousTick: 7, continuityProcessed: 7 });
runtimeLedger.durable({ at: Date.now(), tick: 7, stateTick: 7, replaySignature: 'fixture-signature-2', continuousTick: 7, continuityProcessed: 7 });
runtimeLedger.restoreVerification({ at: Date.now(), tick: 7, previousDurableHash: 'previous-hash', replaySignature: 'fixture-signature-2', continuousTick: 7, processed: 7 });
assert.equal(runtimeLedger.diagnostics().lastStatus, 'FAIL', 'durability and restore bookkeeping must not mask the failure');
assert.equal(runtimeLedger.snapshot().lastBehaviorHash, failure.behaviorHash, 'restore bookkeeping must preserve the failed cycle fingerprint');
const contradictoryRuntimeRestore = new RuntimeClosureLedger();
contradictoryRuntimeRestore.restore({
  version: 1, checks: 0, passes: 0, degraded: 0, failures: 0, lastTick: 7,
  lastStatus: 'PASS', lastBehaviorHash: 'forged-success-hash', lastDurableHash: '',
  records: runtimeLedger.snapshot().records,
});
assert.equal(contradictoryRuntimeRestore.diagnostics().lastStatus, 'FAIL', 'restored summary must not promote a retained failure record');
assert.equal(contradictoryRuntimeRestore.snapshot().lastBehaviorHash, failure.behaviorHash);

// A normal step can itself fail its closure checks; durability must not turn it green.
const failedStepLedger = new RuntimeClosureLedger();
const failedStep = failedStepLedger.step({ at: Date.now(), previousTick: 0, stateTick: 1, cycleTick: 2, continuousTick: 1, processed: 1, previousProcessed: 0, continuity01: .72, energy01: .8, uncertainty01: .2, identityContinuity01: .9, predictionError01: .1, action: 'observe' });
assert.equal(failedStep.status, 'FAIL');
failedStepLedger.durable({ at: Date.now(), tick: 1, stateTick: 1, replaySignature: 'fixture-signature', continuousTick: 1, continuityProcessed: 1 });
assert.equal(failedStepLedger.diagnostics().lastStatus, 'FAIL');
const recoveredStep = failedStepLedger.step({ at: Date.now(), previousTick: 1, stateTick: 2, cycleTick: 2, continuousTick: 2, processed: 2, previousProcessed: 1, continuity01: .72, energy01: .8, uncertainty01: .2, identityContinuity01: .9, predictionError01: .1, action: 'observe' });
assert.equal(recoveredStep.status, 'PASS');
assert.equal(failedStepLedger.diagnostics().lastStatus, 'PASS', 'a new step may replace the prior cycle status');

// A missing unified-cognition stage is a terminal failure even when the surrounding runtime checks align.
const incompleteCognitive = new RuntimeClosureLedger();
const incompleteStep = incompleteCognitive.step({
  at: Date.now(), previousTick: 0, stateTick: 1, cycleTick: 1, continuousTick: 1,
  processed: 1, previousProcessed: 0, continuity01: .8, energy01: .8, uncertainty01: .2,
  identityContinuity01: .9, predictionError01: .1, action: 'observe',
  cognitiveCycleComplete: false, cognitiveCycleTick: 1, missingCognitiveStages: ['outcome'],
});
assert.equal(incompleteStep.status, 'FAIL');
assert.ok(incompleteStep.checks.some((check) => check.name === 'unified-cognitive-cycle-complete' && !check.ok));

// A failure must close a pending causal cycle, preserve its reason, and never
// acquire success credit during later durable finalization.
const before = { memoryCount: 1, worldTick: 1, identityRevision: 1, agencyDecisions: 1, learningUpdates: 1, selfChangeCount: 1, lifeGraphCompleteChains: 1 };
const causal = new CausalDomainClosureLedger();
causal.begin({ tick: 2, counters: before });
const failed = causal.failPending({ reason: 'fixture-aborted', counters: before });
assert.equal(failed?.status, 'FAIL');
assert.equal(failed?.complete, false);
assert.equal(failed?.failureReason, 'fixture-aborted');
assert.equal(causal.failPending({ reason: 'duplicate-close' }), null, 'a cycle should only close once');
causal.durable({ tick: 2, stateTick: 2, replaySignature: 'fixture-signature', continuousTick: 2, processed: 2 });
const finalized = causal.finalizeDurable({ tick: 2, stateTick: 2, replaySignature: 'fixture-signature', continuousTick: 2, processed: 2 });
assert.equal(finalized?.status, 'FAIL');
assert.equal(finalized?.complete, false);
assert.equal(finalized?.score01, 0, 'durable bookkeeping must not grant causal score to a failed cycle');
assert.equal(finalized?.failureReason, 'fixture-aborted');
assert.equal(causal.snapshot().failures, 1);

// Even a cycle that previously reached normal closure must be downgraded when
// batch/checkpoint finalization subsequently fails.
const lateFailure = new CausalDomainClosureLedger();
lateFailure.begin({ tick: 1, counters: before });
const good = lateFailure.end({
  counters: { memoryCount: 2, worldTick: 2, identityRevision: 2, agencyDecisions: 2, learningUpdates: 2, selfChangeCount: 2, lifeGraphCompleteChains: 2 },
  evidence: {
    memoryChanged: true, worldChanged: true, agencyChanged: true, learningChanged: true, selfChanged: true,
    memoryWorldVerified: true, worldAgencyLearningVerified: true, causalLifeGraphChain: true,
    replaySignaturePresent: true, durableStateAligned: true, cognitiveCycleComplete: true,
  },
});
assert.equal(good?.status, 'PASS');
const downgraded = lateFailure.failLatest({ reason: 'checkpoint-failed', tick: 1 });
assert.equal(downgraded?.status, 'FAIL');
assert.equal(downgraded?.complete, false);
assert.equal(downgraded?.score01, 0);
assert.equal(downgraded?.failureReason, 'checkpoint-failed');
assert.equal(downgraded?.evidence.cognitiveCycleComplete, true, 'late failure must not rewrite the factual unified-cycle result');
assert.equal(lateFailure.snapshot().completeCycles, 0);
assert.equal(lateFailure.snapshot().failures, 1);
assert.equal(lateFailure.snapshot().meanScore01, 0);

// The causal ledger must use the unified cycle's explicit contract result as a hard gate.
const incompleteCausal = new CausalDomainClosureLedger();
incompleteCausal.begin({ tick: 3, counters: before });
const incompleteRecord = incompleteCausal.end({
  counters: { memoryCount: 2, worldTick: 2, identityRevision: 2, agencyDecisions: 2, learningUpdates: 2, selfChangeCount: 2, lifeGraphCompleteChains: 2 },
  evidence: {
    memoryChanged: true, worldChanged: true, agencyChanged: true, learningChanged: true, selfChanged: true,
    memoryWorldVerified: true, worldAgencyLearningVerified: true, causalLifeGraphChain: true,
    replaySignaturePresent: true, durableStateAligned: true, cognitiveCycleComplete: false,
  },
});
assert.equal(incompleteRecord?.status, 'FAIL');
assert.equal(incompleteRecord?.complete, false);
assert.equal(incompleteRecord?.score01, 0);
incompleteCausal.durable({ tick: 3, stateTick: 3, replaySignature: 'fixture-signature', continuousTick: 3, processed: 3 });
const incompleteFinal = incompleteCausal.finalizeDurable({ tick: 3, stateTick: 3, replaySignature: 'fixture-signature', continuousTick: 3, processed: 3 });
assert.equal(incompleteFinal?.status, 'FAIL');
assert.equal(incompleteFinal?.complete, false);
assert.equal(incompleteFinal?.score01, 0);
const restoredIncompleteCausal = new CausalDomainClosureLedger();
restoredIncompleteCausal.restore({ ...incompleteCausal.snapshot(), lastStatus: 'PASS' });
assert.equal(restoredIncompleteCausal.snapshot().lastStatus, 'FAIL', 'restored summary must not promote a retained incomplete cognitive cycle');
assert.equal(restoredIncompleteCausal.snapshot().recent[0]?.evidence.cognitiveCycleComplete, false);
const restoredIncompleteFinal = restoredIncompleteCausal.finalizeDurable({ tick: 3, stateTick: 3, replaySignature: 'fixture-signature-after-restart', continuousTick: 3, processed: 3 });
assert.equal(restoredIncompleteFinal?.status, 'FAIL', 'restart must not promote an incomplete cognitive cycle');
assert.equal(restoredIncompleteFinal?.score01, 0);

// Guard the live physical-action path against cancellation that arrives after
// planning but before actuation.
const runtimeSource = await readFile(new URL('../src/organism/core/OrganismRuntime.ts', import.meta.url), 'utf8');
const abortGate = runtimeSource.indexOf("throwIfAborted(options.signal, 'before-embodied-action');");
const actionDispatch = runtimeSource.indexOf('this.embodiedActions.execute(physicalAction,');
assert.ok(abortGate >= 0 && actionDispatch > abortGate, 'the abort gate must precede embodied action dispatch');
assert.match(runtimeSource, /causalDomainClosureLedger\.failPending\(/);
assert.match(runtimeSource, /causalDomainClosureLedger\.failLatest\(/);
assert.match(runtimeSource, /runtime\.step\.aborted/);
assert.ok(runtimeSource.includes('cognitiveCycleComplete,\n          cognitiveCycleTick: unifiedCycle.lastTick'), 'runtime closure must consume the unified cycle result');
assert.ok(runtimeSource.includes('durableStateAligned: domainAfter.lastCheckpointTick === domainAfter.tick && Boolean(domainAfter.replaySignature),\n          cognitiveCycleComplete,'), 'causal closure must consume the unified cycle result');

// Exercise cancellation at both the entry boundary and the final pre-actuation boundary.
const work = await mkdtemp(path.join(tmpdir(), 'neuro-kurisu-p328-'));
const stateFile = path.join(work, 'organism.json');
let stopDurableWrites = 0;
const testJournal = { write: async (_level, event) => { if (event === 'runtime.stop.durable') stopDurableWrites += 1; } };
let runtime;
let lateController = null;
let invokerCalls = 0;
const proposalMarker = 'suggestedAction must be one of';
try {
  runtime = new OrganismRuntime({
    stateFile,
    journal: testJournal,
    intervalMs: 5_000,
    enableLanguage: true,
    autoRun: false,
    performanceProfile: 'mobile',
    languageInvoker: async (request) => {
      invokerCalls += 1;
      const proposal = request.system.includes(proposalMarker);
      if (!proposal) lateController?.abort('fixture-late-abort-before-action');
      return {
        text: proposal
          ? JSON.stringify({ summary: 'bounded test proposal', hypotheses: [], uncertainty: 0.2, suggestedAction: null, evidenceNeeded: [] })
          : 'controlled test response',
        backend: 'test-provider',
        latencyMs: 1,
      };
    },
    cycleResultMode: 'summary',
  });
  await runtime.init();
  const priorFailures = runtime.causalDomainClosureSnapshot().failures;
  // Batch admission failure is also a terminal attempted cycle, even though the
  // normal causal `begin()` path has not been reached yet.
  const originalBeginBatch = runtime.core.beginBatch.bind(runtime.core);
  runtime.core.beginBatch = async () => { throw new Error('fixture-batch-begin-failed'); };
  await assert.rejects(runtime.step(undefined, { deliberate: false }), /fixture-batch-begin-failed/);
  runtime.core.beginBatch = originalBeginBatch;
  const beginFailure = runtime.causalDomainClosureSnapshot();
  assert.equal(beginFailure.recent[0]?.status, 'FAIL');
  assert.match(beginFailure.recent[0]?.failureReason ?? '', /runtime\.batch\.begin\.failed/);
  assert.equal(runtime.runtimeClosureDiagnostics().lastStatus, 'FAIL');

  const invokersBeforeEarlyAbort = invokerCalls;
  const controller = new AbortController();
  controller.abort('fixture-abort-at-entry');
  await assert.rejects(
    runtime.step(undefined, { deliberate: false, signal: controller.signal }),
    /cognitive-cycle-aborted:step-start/,
  );
  assert.equal(invokerCalls, invokersBeforeEarlyAbort, 'an already-cancelled cycle must stop before inference');

  let embodiedDispatches = 0;
  const realEmbodiedExecute = runtime.embodiedActions.execute.bind(runtime.embodiedActions);
  runtime.embodiedActions.execute = async (...args) => {
    embodiedDispatches += 1;
    return realEmbodiedExecute(...args);
  };
  lateController = new AbortController();
  const beforeLateDispatches = embodiedDispatches;
  await assert.rejects(
    runtime.step('Exercise the cancellation boundary.', { deliberate: true, signal: lateController.signal }),
    /cognitive-cycle-aborted:before-embodied-action/,
  );
  assert.equal(lateController.signal.aborted, true, 'the controlled provider must cancel during final response generation');
  assert.equal(embodiedDispatches, beforeLateDispatches, 'late cancellation must prevent embodied-action dispatch');
  const closure = runtime.causalDomainClosureSnapshot();
  assert(closure.failures >= priorFailures + 3, 'batch-admission failure and both aborted runtime cycles must be accounted as causal failures');
  assert.equal(closure.recent[0]?.status, 'FAIL');
  assert.match(closure.recent[0]?.failureReason ?? '', /cognitive-cycle-aborted:before-embodied-action/);
  assert.equal(runtime.runtimeClosureDiagnostics().lastStatus, 'FAIL');

  await runtime.flush();
  const persisted = JSON.parse(await readFile(stateFile, 'utf8'));
  assert.equal(persisted.system?.runtimeClosure?.lastStatus, 'FAIL');
  assert.equal(persisted.system?.causalDomainClosureLedger?.lastStatus, 'FAIL');
  assert.match(persisted.system?.causalDomainClosureLedger?.recent?.[0]?.failureReason ?? '', /cognitive-cycle-aborted:before-embodied-action/);

  await Promise.all([runtime.stop(), runtime.stop()]);
  assert.equal(stopDurableWrites, 1, 'concurrent stop calls must share one durable shutdown transaction');
  runtime = null;
  const afterStop = JSON.parse(await readFile(stateFile, 'utf8'));
  assert.equal(afterStop.system?.runtimeClosure?.lastStatus, 'FAIL', 'shutdown durability must preserve the terminal runtime failure');
  assert.equal(afterStop.system?.causalDomainClosureLedger?.lastStatus, 'FAIL', 'shutdown durability must preserve the terminal causal failure');

  console.log(JSON.stringify({
    pass: true,
    status: 'P328_CLOSED_LOOP_FAILURE_CLOSURE_PASS',
    directRuntimeClosure: runtimeLedger.diagnostics().lastStatus,
    pendingCycle: finalized?.status,
    lateFinalization: downgraded?.status,
    runtimeCycle: closure.recent[0]?.status,
    persistedRuntimeClosure: persisted.system?.runtimeClosure?.lastStatus,
    persistedCausalClosure: persisted.system?.causalDomainClosureLedger?.lastStatus,
  }, null, 2));
} finally {
  await runtime?.stop().catch(() => {});
  await rm(work, { recursive: true, force: true });
}
