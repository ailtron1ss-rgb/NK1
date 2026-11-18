import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';

const hash = char => char.repeat(64);
const candidate = {
  id: 'runtime-physics-lora-v1',
  artifactRef: 'file:adapters/runtime-physics-lora-v1.safetensors',
  artifactSha256: hash('a'),
  adapterFormat: 'lora',
  rank: 8,
  baseModelId: 'nk1-runtime-test',
  baseModelRevisionSha256: hash('c'),
  tasks: ['language'],
  competenceByTask01: { language: 0.96 },
  conflictGroup: 'runtime-physics',
  minimumConfidence01: 0.4,
  maximumResourceRisk01: 1,
  maximumUncertainty01: 1,
  maximumContextTokens: 64_000,
  trainingDatasetRef: 'dataset://runtime/train',
  owner: 'p25-runtime-test',
};
const manifest = {
  ...candidate,
  validation: {
    reportId: 'runtime-holdout-2026-11',
    reportSha256: hash('b'),
    holdoutDatasetRef: 'dataset://runtime/holdout',
    pairedSeeds: 8,
    baselineScore01: 0.70,
    adapterScore01: 0.82,
    lower95Delta01: 0.04,
    guardrailRegressionCount: 0,
  },
  signerKeyId: 'runtime-test-validator',
  signature: 'runtime-test-signature',
};

const dir = await mkdtemp(path.join(tmpdir(), 'nk-p25-runtime-'));
const stateFile = path.join(dir, 'organism.json');
const runtimes = [];
const stopped = new WeakSet();
const stopRuntime = async runtime => {
  if (runtime && !stopped.has(runtime)) {
    await runtime.stop();
    stopped.add(runtime);
  }
};
let baseCalls = 0;
let adapterCalls = 0;
const baseCallsByUser = new Map();
let lastAdapterUser = null;
let lastAdapterBaseCallsAtStart = 0;
let failAdapter = false;
let badReceipt = false;
let badBaseReceipt = false;
let stallAdapter = false;
let canonicalFallback = false;
let lastRoutingInput = null;
const baseInvoker = async request => {
  baseCalls += 1;
  const user = String(request?.user ?? '');
  baseCallsByUser.set(user, (baseCallsByUser.get(user) ?? 0) + 1);
  return { text: 'base response', backend: 'test-base', latencyMs: 3 };
};
const adapterInvoker = async (_request, selected, routingInput) => {
  adapterCalls += 1;
  lastAdapterUser = String(_request?.user ?? '');
  lastAdapterBaseCallsAtStart = baseCallsByUser.get(lastAdapterUser) ?? 0;
  lastRoutingInput = routingInput;
  assert.equal(selected.id, candidate.id);
  if (stallAdapter) {
    await new Promise((_resolve, reject) => {
      if (_request.signal?.aborted) reject(new Error('adapter-aborted-before-start'));
      else _request.signal?.addEventListener('abort', () => reject(new Error('adapter-aborted-by-timeout')), { once: true });
    });
  }
  if (failAdapter) throw new Error('synthetic-adapter-load-failure');
  if (canonicalFallback) {
    return {
      text: 'base response from canonical registry',
      backend: 'test-base',
      latencyMs: 5,
      modelId: candidate.baseModelId,
      modelRevisionSha256: candidate.baseModelRevisionSha256,
      appliedAdapterSha256: null,
      adapterApplied: false,
      adapterFallbackReason: 'p25-canonical-selection-mismatch',
    };
  }
  return {
    text: 'specialized response', backend: 'test-specialist', latencyMs: 4,
    modelId: badBaseReceipt ? 'wrong-base-model' : candidate.baseModelId,
    modelRevisionSha256: candidate.baseModelRevisionSha256,
    appliedAdapterSha256: badReceipt ? hash('z') : candidate.artifactSha256,
    adapterApplied: true,
  };
};
const makeRuntime = () => {
  const runtime = new OrganismRuntime({
  stateFile,
  worldStateFile: path.join(dir, 'world.json'),
  enableLanguage: true,
  autoRun: false,
  performanceProfile: 'mobile',
  stateStore: new MemoryStateStore(),
  worldStateStore: new MemoryStateStore(),
  journal: new BoundedOperationalJournal(),
  languageInvoker: baseInvoker,
  synapticBaseModelId: candidate.baseModelId,
  synapticBaseModelRevisionSha256: candidate.baseModelRevisionSha256,
  synapticAdapterTimeoutMs: 100,
  synapticAdapterManifestVerifier: (payload, signature, keyId) =>
    payload.includes('"reportId":"runtime-holdout-2026-11"')
      && signature === manifest.signature
      && keyId === manifest.signerKeyId,
  synapticAdapterInvoker: adapterInvoker,
  });
  runtimes.push(runtime);
  return runtime;
};

try {
  let runtime = makeRuntime();
  await runtime.init();

  const initial = await runtime.step('Check the supplied facts and answer cautiously.', { deliberate: false });
  assert.equal(initial.language?.text, 'base response');
  assert.equal(baseCalls, 1);
  assert.equal(adapterCalls, 0, 'no adapter can route before a candidate is registered and validated');

  await runtime.registerSynapticAdapterCandidate(candidate);
  await runtime.activateSynapticAdapter(manifest);
  assert.equal(runtime.synapticMatrixSnapshot().adapters[0].status, 'active');

  const specialized = await runtime.step('Solve this physics reasoning question.', { deliberate: false });
  assert.equal(specialized.language?.text, 'specialized response');
  assert.equal(adapterCalls, 1);
  assert.equal(baseCalls, 1, 'successful specialist inference must not also invoke the base model');

  // The host canonical #936 registry can refuse this exact P25-selected ID and
  // return a base response itself. P25 must not retry base a second time or
  // record a specialist execution failure for a policy/registry disagreement.
  const adapterCallsBeforeCanonicalFallback = adapterCalls;
  const failuresBeforeCanonicalFallback = runtime.synapticMatrixSnapshot().adapters[0].consecutiveFailures;
  const fallbackCountBeforeCanonicalFallback = runtime.synapticMatrixSnapshot().metrics.canonicalRegistryFallbacks;
  canonicalFallback = true;
  const canonicalBase = await runtime.step('Exercise canonical registry mismatch fallback.', { deliberate: false });
  canonicalFallback = false;

  assert.equal(canonicalBase.language?.text, 'base response from canonical registry');
  assert.equal(adapterCalls, adapterCallsBeforeCanonicalFallback + 1,
    'the P25 adapter executor must return the canonical base fallback for the selected request');
  assert.equal(baseCallsByUser.get(lastAdapterUser) ?? 0, lastAdapterBaseCallsAtStart,
    'P25 must not re-send the same specialist request to the base invoker after canonical executor fallback');
  assert.equal(runtime.synapticMatrixSnapshot().adapters[0].status, 'active',
    'canonical selection mismatch must not disable a healthy P25 candidate');
  assert.equal(runtime.synapticMatrixSnapshot().adapters[0].consecutiveFailures, failuresBeforeCanonicalFallback,
    'canonical selection mismatch must not count as an adapter execution failure');
  assert.equal(runtime.synapticMatrixSnapshot().metrics.canonicalRegistryFallbacks, fallbackCountBeforeCanonicalFallback + 1,
    'canonical selection mismatch must be recorded as a safe base fallback');
  assert.equal(lastRoutingInput?.baseModelId, candidate.baseModelId);
  assert.equal(lastRoutingInput?.baseModelRevisionSha256, candidate.baseModelRevisionSha256);
  assert.ok(lastRoutingInput?.contextTokens > 0, 'P25 must pass its bounded context estimate to the canonical host adapter');

  const adapterCallsBeforeTimeout = adapterCalls;
  stallAdapter = true;
  const timedOut = await runtime.step('Force a non-responsive adapter loader to exceed its deadline.', { deliberate: false });
  stallAdapter = false;
  assert.equal(timedOut.language?.text, 'base response');
  assert.equal(adapterCalls, adapterCallsBeforeTimeout + 1);
  assert.equal(baseCallsByUser.get(lastAdapterUser) ?? 0, lastAdapterBaseCallsAtStart + 1,
    'adapter timeout must invoke the base model exactly once for the timed-out adapter prompt');
  assert.equal(runtime.synapticMatrixSnapshot().adapters[0].consecutiveFailures, 1);
  await runtime.activateSynapticAdapter(manifest);

  const adapterCallsBeforeBadBaseReceipt = adapterCalls;
  badBaseReceipt = true;
  const rejectedBaseReceipt = await runtime.step('Reject a specialist response for the wrong base-model identity.', { deliberate: false });
  assert.equal(rejectedBaseReceipt.language?.text, 'base response');
  assert.equal(adapterCalls, adapterCallsBeforeBadBaseReceipt + 1);
  assert.equal(baseCallsByUser.get(lastAdapterUser) ?? 0, lastAdapterBaseCallsAtStart + 1,
    'wrong base-model attestation must execute the original base invoker exactly once for the selected prompt');
  assert.equal(runtime.synapticMatrixSnapshot().adapters[0].consecutiveFailures, 1);

  badBaseReceipt = false;
  await runtime.activateSynapticAdapter(manifest);
  const adapterCallsBeforeBadDigest = adapterCalls;
  badReceipt = true;
  const rejectedReceipt = await runtime.step('Reject a specialist response that attests the wrong weight digest.', { deliberate: false });
  assert.equal(rejectedReceipt.language?.text, 'base response');
  assert.equal(adapterCalls, adapterCallsBeforeBadDigest + 1);
  assert.equal(baseCallsByUser.get(lastAdapterUser) ?? 0, lastAdapterBaseCallsAtStart + 1,
    'wrong adapter weight attestation must execute the original base invoker exactly once for the selected prompt');
  assert.equal(runtime.synapticMatrixSnapshot().adapters[0].consecutiveFailures, 1,
    'explicit signed reactivation resets the consecutive-failure streak before the next execution');

  badReceipt = false;
  await runtime.activateSynapticAdapter(manifest);
  failAdapter = true;
  const recovered = await runtime.step('Recover from an adapter loader exception.', { deliberate: false });
  assert.equal(recovered.language?.text, 'base response');
  assert.equal(adapterCalls, 5);
  assert.equal(baseCalls, 5, 'adapter loader failure must execute the original base invoker exactly once');
  assert.equal(runtime.synapticMatrixSnapshot().adapters[0].consecutiveFailures, 1,
    'the explicit activation immediately before this call resets the prior failure streak');

  await stopRuntime(runtime);
  runtime = makeRuntime();
  await runtime.init();
  assert.equal(runtime.synapticMatrixSnapshot().adapters[0].status, 'active',
    'a valid signed activation receipt must survive restart when the host verifier remains available');

  await runtime.disableSynapticAdapter(candidate.id);
  assert.equal(runtime.synapticMatrixSnapshot().adapters[0].status, 'disabled');
  const disabled = await runtime.step('Confirm the disabled profile cannot intercept this request.', { deliberate: false });
  assert.equal(disabled.language?.text, 'base response');
  assert.equal(adapterCalls, 5);

  // Re-enablement is an explicit operator action and must present a fresh,
  // trusted manifest again; it is never triggered by ordinary routing.
  failAdapter = false;
  badReceipt = false;
  badBaseReceipt = false;
  await runtime.activateSynapticAdapter(manifest);
  const reactivated = await runtime.step('Use the explicitly reactivated specialist.', { deliberate: false });
  assert.equal(reactivated.language?.text, 'specialized response');
  assert.equal(adapterCalls, 6);
  // UTF-8-heavy prompts must not slip through a chars/4 estimate and exceed
  // the specialist's declared context window.
  const contextCycle = {
    state: { needs: { energy: 0.9, cognitiveLoad: 0.1, uncertainty: 0.1 } },
    decision: { selected: { confidence: 0.95 } },
  };
  const beforeContextAdapterCalls = adapterCalls;
  const beforeContextBaseCalls = baseCalls;
  const contextGuarded = await runtime.invokeLanguageWithSynapticMatrix(
    'language',
    { system: '', user: '💡'.repeat(20_000), maxTokens: 1 },
    contextCycle,
    baseInvoker,
  );
  assert.equal(contextGuarded.text, 'base response');
  assert.equal(adapterCalls, beforeContextAdapterCalls,
    'a UTF-8 prompt whose byte upper bound exceeds the profile context must bypass the adapter');
  assert.equal(baseCalls, beforeContextBaseCalls + 1);

  // Cancelling from the caller must abort the host adapter, avoid base retry,
  // and leave the adapter's failure/cooldown counters unchanged.
  const beforeCancelAdapterCalls = adapterCalls;
  const beforeCancelBaseCalls = baseCalls;
  const beforeCancelFailures = runtime.synapticMatrixSnapshot().adapters[0].consecutiveFailures;
  const caller = new AbortController();
  stallAdapter = true;
  const cancelledCall = runtime.invokeLanguageWithSynapticMatrix(
    'language',
    { system: 'test system', user: 'caller cancellation test', maxTokens: 16, signal: caller.signal },
    contextCycle,
    baseInvoker,
  );
  const cancellationTimer = setTimeout(() => caller.abort(new Error('caller-cancelled')), 10);
  await assert.rejects(cancelledCall);
  clearTimeout(cancellationTimer);
  stallAdapter = false;
  assert.equal(adapterCalls, beforeCancelAdapterCalls + 1);
  assert.equal(baseCalls, beforeCancelBaseCalls,
    'a caller-cancelled request must not be retried against the base model');
  assert.equal(runtime.synapticMatrixSnapshot().adapters[0].consecutiveFailures, beforeCancelFailures,
    'caller cancellation must not count as an adapter execution failure');

  await stopRuntime(runtime);

  console.log('P25_ADAPTIVE_SYNAPTIC_MATRIX_RUNTIME=PASS');
} finally {
  await Promise.allSettled(runtimes.map(stopRuntime));
  await rm(dir, { recursive: true, force: true });
}
