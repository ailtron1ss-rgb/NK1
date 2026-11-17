import assert from 'node:assert/strict';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const runtime = new OrganismRuntime({
  stateFile: '/tmp/nk-p27-session-lifecycle.json',
  stateStore: new MemoryStateStore(),
  enableLanguage: false,
  autoRun: false,
  intervalMs: 30_000,
  cycleResultMode: 'operational',
  performanceProfile: 'mobile',
});

await runtime.init();
await runtime.autonomousStep();
const beforeStop = runtime.core.neuralExperienceBranchDiagnostics().testTimeNeuroplasticity;
assert.ok(beforeStop.contextCount > 0, 'real OrganismCore tick did not create a session-scoped fast context');

await runtime.stop();
const afterStop = runtime.core.neuralExperienceBranchDiagnostics().testTimeNeuroplasticity;
assert.equal(afterStop.contextCount, 0, 'runtime stop retained ephemeral test-time adaptation contexts');
assert.equal(afterStop.activeAdapterNorm, 0);

console.log('P27_NEUROPLASTICITY_SESSION_LIFECYCLE=PASS', JSON.stringify({
  contextsBeforeStop: beforeStop.contextCount,
  contextsAfterStop: afterStop.contextCount,
  activeAdapterNormAfterStop: afterStop.activeAdapterNorm,
}));