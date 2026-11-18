import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { sha256Stable } from '../src/organism/core/StableSerialization.ts';

class MemoryStore {
  value = null;
  async load() { return this.value ? structuredClone(this.value) : null; }
  async save(value) { this.value = structuredClone(value); }
  metrics() { return null; }
}
class Journal { async write() { return undefined; } }
const digest = value => createHash('sha256').update(value).digest('hex');
const dir = await mkdtemp(path.join(tmpdir(), 'nk-neural-jit-bridge-'));
try {
  const pendingCapture = Object.freeze({ captureHandle: 'host-local-activation-1' });
  const authenticBoundCaptures = new WeakSet();
  const bindings = [];
  let hangNextBinding = false;
  let bindAbortObserved = false;
  const adapter = {
    captureLocalInference: async () => pendingCapture,
    bindVerifiedOutcome: async (pending, context) => {
      if (hangNextBinding) {
        hangNextBinding = false;
        context.signal?.addEventListener('abort', () => { bindAbortObserved = true; }, { once: true });
        return await new Promise(() => {});
      }
      assert.equal(pending, pendingCapture, 'the exact opaque capture handle must survive until the verified outcome');
      assert.equal(context.taskFamily, 'language-response');
      assert.ok(context.verification && context.verification.externalObservation === true);
      const capture = {
        captureId: 'capture-live-1', taskFamily: context.taskFamily,
        taskFingerprint: digest('neural-jit-runtime-bridge-task-1'),
        modelFingerprint: 'a'.repeat(64), toolId: context.binding.toolId,
        executionId: context.binding.executionId, decisionId: context.binding.decisionId,
        inputFingerprint: context.inputFingerprint, seed: 17, capturedAt: Date.now(),
        inputFeatures: [0.2, 0.4, 0.1], targetResidual: [0.08, -0.04],
      };
      authenticBoundCaptures.add(capture);
      bindings.push({ capture, context });
      return capture;
    },
    verifyCapture: (capture, expected) => Boolean(capture && authenticBoundCaptures.has(capture) &&
      capture.toolId === expected.toolId && capture.executionId === expected.executionId &&
      capture.decisionId === expected.decisionId && capture.inputFingerprint === expected.inputFingerprint &&
      capture.modelFingerprint === expected.modelFingerprint),
  };
  const languageCalls = [];
  const runtime = new OrganismRuntime({
    stateFile: path.join(dir, 'organism.json'), worldStateFile: path.join(dir, 'world.json'),
    autoRun: false, enableLanguage: true,
    stateStore: new MemoryStore(), worldStateStore: new MemoryStore(), journal: new Journal(),
    neuralJitCaptureAdapter: adapter,
    languageInvoker: async request => {
      languageCalls.push(request);
      return { text: 'A grounded response.', backend: 'llama.cpp:fixture', latencyMs: 3, neuralJitCapture: pendingCapture };
    },
    phonePolicy: { mode: 'eco', baseIntervalMs: 30000, samplerIntervalMs: 60000,
      checkpointMinIntervalMs: 60000, checkpointMaxDirtyCycles: 3,
      worldCheckpointMinIntervalMs: 300000, worldCheckpointMaxDirtyCycles: 10,
      maxConsecutiveActiveCycles: 1 },
  });
  await runtime.init();
  const step = await runtime.step('Connect this local inference turn to a verified action.', { deliberate: false });
  assert.equal(languageCalls.length, 1, 'the test must cross the runtime LanguageInvoker seam');
  const traceContext = languageCalls[0].neuralJitTraceContext;
  assert.ok(traceContext && traceContext.decisionId, 'the language request must carry the exact selected decision ID');
  assert.equal(traceContext.taskFamily, 'language-response');
  assert.equal(step.cycle.decision.id, traceContext.decisionId);

  runtime.core.registerActionTool({
    id: 'fixture.neuraljit.observe', capability: 'fixture.read-only-observation', destructive: false,
    execute: async () => ({ ok: true, observed: 'state-confirmed' }),
    verify: async context => ({ verified: true, basis: 'external-postcondition', confidence01: 0.95,
      externalObservation: true, observationId: `neural-jit-observation-${context.executionId}`,
      expectedPostcondition: 'state-confirmed', observedPostcondition: 'state-confirmed' }),
  });
  const actionInput = { query: 'verify-state' };
  const execution = await runtime.executeTool('fixture.neuraljit.observe', actionInput, 'neural-jit-live-bridge', {
    decisionId: traceContext.decisionId, autonomous: true,
  });
  assert.equal(execution.outcomeClass, 'executed-verified');
  assert.equal(execution.verified, true);
  assert.equal(bindings.length, 1, 'a verified outcome must consume one pending local capture');
  assert.equal(bindings[0].context.binding.executionId, execution.executionId);
  assert.equal(bindings[0].context.binding.decisionId, traceContext.decisionId);
  assert.equal(bindings[0].context.binding.toolId, 'fixture.neuraljit.observe');
  assert.equal(bindings[0].context.inputFingerprint, sha256Stable({
    toolId: 'fixture.neuraljit.observe', input: actionInput,
    executionId: execution.executionId, decisionId: traceContext.decisionId,
  }));
  assert.equal(runtime.neuralJitDiagnostics().acceptedTraces, 1,
    'the exact trusted ActionGateway outcome must admit the bound activation capture');
  assert.equal(runtime.neuralJitDiagnostics().pendingCaptureCount, 0,
    'the pending activation handle must be consumed exactly once after a verified outcome');
  const persistedJit = JSON.parse(await readFile(path.join(dir, 'organism.json.neural-jit.json'), 'utf8'));
  assert.equal(persistedJit.acceptedTraces, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(persistedJit, 'traces'), false,
    'raw activation traces must not be persisted as durable learning authority');
  assert.equal(JSON.stringify(persistedJit).includes('sensitive-payload'), false,
    'raw tool inputs and prompts must not leak into the Neural JIT sidecar');

  const unlinkedStep = await runtime.step('Create a capture whose outcome will deliberately use another decision ID.');
  const unlinkedContext = languageCalls.at(-1).neuralJitTraceContext;
  assert.ok(unlinkedContext);
  await runtime.executeTool('fixture.neuraljit.observe', { query: 'another-state' }, 'unlinked-neural-jit-action', {
    decisionId: 'unlinked-decision-id', autonomous: true,
  });
  assert.equal(runtime.neuralJitDiagnostics().acceptedTraces, 1,
    'an outcome without the matching selected decision trace must not create a second JIT sample');
  assert.equal(runtime.neuralJitDiagnostics().pendingCaptureCount, 1,
    'unlinked capture must remain unconsumed rather than being attached to an unrelated action');

  await runtime.step('Prepare a capture for the first concurrent verified action.');
  const concurrentA = languageCalls.at(-1).neuralJitTraceContext;
  await runtime.step('Prepare a capture for the second concurrent verified action.');
  const concurrentB = languageCalls.at(-1).neuralJitTraceContext;
  const concurrentResults = await Promise.all([
    runtime.core.executeTool('fixture.neuraljit.observe', { query: 'concurrent-A' }, 'neural-jit-concurrent-A', {
      decisionId: concurrentA.decisionId, autonomous: true,
    }),
    runtime.core.executeTool('fixture.neuraljit.observe', { query: 'concurrent-B' }, 'neural-jit-concurrent-B', {
      decisionId: concurrentB.decisionId, autonomous: true, idempotencyKey: 'neural-jit-concurrent-key-B',
    }),
  ]);
  assert.ok(concurrentResults.every(row => row.verified === true), JSON.stringify(concurrentResults));
  assert.equal(runtime.neuralJitDiagnostics().acceptedTraces, 3,
    'concurrent verified receipts must serialize JIT state and retain both captures');
  assert.equal(runtime.neuralJitDiagnostics().pendingCaptureCount, 1,
    'only the deliberately unlinked capture should remain pending');
  const persistedAfterConcurrent = JSON.parse(await readFile(path.join(dir, 'organism.json.neural-jit.json'), 'utf8'));
  assert.equal(persistedAfterConcurrent.acceptedTraces, 3,
    'serialized sidecar checkpoints must not overwrite one concurrent verified trace with another');

  await runtime.step('Prepare one verified action whose shadow capture binder will hang.');
  const slowContext = languageCalls.at(-1).neuralJitTraceContext;
  hangNextBinding = true;
  const slowStart = Date.now();
  const slowExecution = await Promise.race([
    runtime.core.executeTool('fixture.neuraljit.observe', { query: 'bounded-shadow-observer' }, 'neural-jit-bounded-observer', {
      decisionId: slowContext.decisionId, autonomous: true,
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('shadow capture observer blocked the canonical action finalizer')), 3_000)),
  ]);
  assert.equal(slowExecution.outcomeClass, 'executed-verified',
    'a hung shadow adapter must not prevent the already-verified ActionGateway result from returning');
  assert.ok(Date.now() - slowStart < 3_000);
  assert.equal(bindAbortObserved, true,
    'the timed-out shadow adapter must receive cancellation');
  assert.equal(runtime.neuralJitDiagnostics().acceptedTraces, 3,
    'a late or timed-out capture binding must never be admitted after the deadline');
  assert.equal(runtime.neuralJitDiagnostics().pendingCaptureCount, 1,
    'the timed-out capture must be consumed and not retried with a later action');
  await runtime.stop();
  console.log('NEURAL_JIT_RUNTIME_BRIDGE=PASS');
} finally {
  await rm(dir, { recursive: true, force: true });
}
