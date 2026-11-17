import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';
import { BoundedOperationalJournal } from '../src/organism/persistence/BoundedOperationalJournal.ts';

async function runRuntime(enabled) {
  const dir = await mkdtemp(path.join(tmpdir(), 'nk-cognitive-neural-bridge-'));
  const requests = [];
  const runtime = new OrganismRuntime({
    stateFile: path.join(dir, 'state.json'),
    worldStateFile: path.join(dir, 'world.json'),
    enableLanguage: true,
    languageInvoker: async request => {
      requests.push(request);
      return {
        text: 'Verified local language response.',
        backend: 'cognitive-bridge-test',
        latencyMs: 1,
        ...(request.cognitiveControl ? {
          providerControlReceipt: {
            provider: 'llama.cpp',
            templateKwargsSent: true,
            featureSchema: request.cognitiveControl.featureSchema,
          },
        } : {}),
      };
    },
    stateStore: new MemoryStateStore(),
    worldStateStore: new MemoryStateStore(),
    journal: new BoundedOperationalJournal(),
    performanceProfile: 'mobile',
    cycleResultMode: 'summary',
    ...(enabled ? {} : { cognitiveToNeuralBridge: { enabled: false } }),
  });
  try {
    await runtime.init();
    await runtime.step('Please reason about this controlled test observation.', { deliberate: true });
    assert.ok(requests.length > 0, 'the runtime must reach its injected LanguageInvoker');
    if (enabled) {
      const request = requests.find(value => value.cognitiveControl);
      assert.ok(request, 'enabled runtime must attach cognitive control to LanguageRequest');
      assert.equal(request.cognitiveControl.version, 2);
      assert.equal(request.cognitiveControl.featureVector01.length, 43);
      assert.equal(request.cognitiveControl.neuralSnapshotAvailable, true);
      assert.equal(request.cognitiveControl.controlsConfigured.samplingParameters, true);
      assert.equal(request.cognitiveControl.controlsConfigured.activationSteering, false);
      const diagnostics = runtime.cognitiveToNeuralBridgeDiagnostics();
      assert.ok(diagnostics.projected > 0);
      assert.ok(diagnostics.samplingControlsConfigured > 0);
      assert.ok(diagnostics.neuralSnapshotsAvailable > 0);
      assert.equal(diagnostics.lastFeatureDimensions, 43);
      assert.equal(diagnostics.activationSteeringApplied, 0);
      assert.equal(diagnostics.residualBlockApplied, 0);
      assert.ok(diagnostics.llamaCppTemplateKwargsSent > 0);
      assert.equal(diagnostics.lastTemplateControlSchema, 'nk1-cognitive-neural-43-v2');
    } else {
      assert.ok(requests.every(value => value.cognitiveControl === undefined),
        'emergency bypass must pass requests to the provider without mutation');
      const diagnostics = runtime.cognitiveToNeuralBridgeDiagnostics();
      assert.equal(diagnostics.projected, 0);
      assert.ok(diagnostics.bypassed > 0);
      assert.equal(diagnostics.llamaCppTemplateKwargsSent, 0, 'provider receipts must not be attributed when the bridge was bypassed');
    }
  } finally {
    await runtime.stop();
    await rm(dir, { recursive:true, force:true });
  }
}

await runRuntime(true);
await runRuntime(false);
console.log('COGNITIVE_TO_NEURAL_RUNTIME_INTEGRATION_PASS');
