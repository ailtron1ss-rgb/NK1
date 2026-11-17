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
      return { text: 'Verified local language response.', backend: 'cognitive-bridge-test', latencyMs: 1 };
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
      assert.equal(request.cognitiveControl.controlsApplied.samplingParameters, true);
      assert.equal(request.cognitiveControl.controlsApplied.activationSteering, false);
    } else {
      assert.ok(requests.every(value => value.cognitiveControl === undefined),
        'emergency bypass must pass requests to the provider without mutation');
    }
  } finally {
    await runtime.stop();
    await rm(dir, { recursive:true, force:true });
  }
}

await runRuntime(true);
await runRuntime(false);
console.log('COGNITIVE_TO_NEURAL_RUNTIME_INTEGRATION_PASS');
