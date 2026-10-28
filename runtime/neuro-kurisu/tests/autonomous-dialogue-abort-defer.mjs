import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const now = Date.now();
const bootstrap = new OrganismCore(new MemoryStateStore(), { cycleResultMode: 'operational' });
await bootstrap.init();
const seed = structuredClone(bootstrap.snapshot());
seed.state.needs.socialNeed = .99;
seed.state.needs.identityCoherence = .99;
seed.state.needs.novelty = .99;
seed.state.needs.energy = .99;
seed.goals = [{
  id: 'abort-defer-goal',
  title: 'Связать инициативу с проверяемыми причинными следами',
  source: 'intrinsic',
  importance: .98,
  urgency: .92,
  progress: .12,
  status: 'active',
}];
seed.memories = [{
  id: 'abort-defer-memory',
  kind: 'pattern',
  summary: 'Самостоятельная мысль должна быть связана с сохраняемой целью и доказательством результата.',
  salience: .91,
  confidence: .86,
  source: 'abort-defer-fixture',
  evidence: ['intent', 'outcome', 'episode'],
  createdAt: now - 120_000,
}];
seed.system.autonomousSocialInitiative = {
  version: 1, cycles: 0, planned: 0, executed: 0, deferred: 0,
  reciprocity01: .5, initiative01: .6, initiatives: [],
  startedAt: now - 900_000,
  lastExternalInputAt: now - 900_000,
  lastInitiativeAt: now - 900_000,
};
const stateStore = new MemoryStateStore({ initial: seed });
let providerCalls = 0;
const runtime = new OrganismRuntime({
  stateFile: '/tmp/neuro-kurisu-autonomous-dialogue-abort-defer.json',
  stateStore,
  worldStateStore: new MemoryStateStore(),
  enableLanguage: true,
  autoRun: false,
  intervalMs: 60_000,
  sensorIntervalMs: 60_000,
  checkpointMinIntervalMs: 0,
  checkpointMaxDirtyCycles: 1,
  languageInvoker: async request => {
    providerCalls++;
    if (request.signal?.aborted) {
      const error = new Error('caller aborted proactive generation');
      error.name = 'AbortError';
      throw error;
    }
    return {
      text: 'Нужно проверить причинную связь между внутренней целью, действием и независимым результатом.',
      backend: 'autonomous-dialogue-abort-defer-test',
    };
  },
});

try {
  await runtime.init();
  const controller = new AbortController();
  controller.abort(new Error('cancel before the response can be staged'));

  await runtime.step(undefined, {
    deliberate: false,
    spontaneous: true,
    signal: controller.signal,
  });

  const state = runtime.core.snapshot().system.autonomousSocialInitiative;
  assert.ok(providerCalls >= 1, 'the cancelled request must reach the configured provider seam');
  assert.equal(state.initiatives.length, 1,
    'the scenario should stage exactly one autonomous agenda before generation is cancelled');
  assert.equal(state.initiatives[0].status, 'deferred',
    'caller cancellation must resolve the planned initiative immediately');
  assert.equal(state.deferred, 1,
    'the cancelled initiative must increment the deferred counter exactly once');
  assert.equal(await runtime.autonomousDialogueReady(), null,
    'a cancelled proactive message must never become deliverable');
  console.log('AUTONOMOUS_DIALOGUE_ABORT_DEFER=PASS', JSON.stringify({
    providerCalls,
    status: state.initiatives[0].status,
    deferred: state.deferred,
    noUndeliverablePending: true,
  }));
} finally {
  await runtime.stop().catch(() => {});
}
