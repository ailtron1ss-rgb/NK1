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

const initialScopeCount = beforeStop.sessionScopeCount;
assert.ok(Number.isInteger(initialScopeCount) && initialScopeCount > 0,
  'neural branch diagnostics must expose only a count of active opaque adaptation scopes');

await runtime.step('conversation alpha first turn', { conversationId: 'conversation-alpha', suppressResponse: true });
const afterAlpha = runtime.core.neuralExperienceBranchDiagnostics().testTimeNeuroplasticity;
assert.equal(afterAlpha.sessionScopeCount, initialScopeCount + 1,
  'host conversation ID was not connected to a distinct P27 adaptation scope');

await runtime.step('conversation alpha second turn', { conversationId: 'conversation-alpha', suppressResponse: true });
assert.equal(runtime.core.neuralExperienceBranchDiagnostics().testTimeNeuroplasticity.sessionScopeCount, initialScopeCount + 1,
  'the same conversation ID did not reuse its existing opaque scope');

await runtime.step('conversation beta first turn', { conversationId: 'conversation-beta', suppressResponse: true });
const afterBeta = runtime.core.neuralExperienceBranchDiagnostics().testTimeNeuroplasticity;
assert.equal(afterBeta.sessionScopeCount, initialScopeCount + 2,
  'distinct conversations inside one runtime session were not isolated');

const nfdConversation = 'cafe\u0301';
await runtime.step('unicode conversation first turn', { conversationId: nfdConversation, suppressResponse: true });
const afterNfd = runtime.core.neuralExperienceBranchDiagnostics().testTimeNeuroplasticity.sessionScopeCount;
await runtime.step('unicode conversation normalized turn', { conversationId: 'café', suppressResponse: true });
assert.equal(runtime.core.neuralExperienceBranchDiagnostics().testTimeNeuroplasticity.sessionScopeCount, afterNfd,
  'NFKC-equivalent conversation IDs did not resolve to the same scope');

const tickBeforeInvalidId = runtime.core.operationalStatusSnapshot().tick;
await assert.rejects(
  () => runtime.step('invalid conversation id', { conversationId: 'x'.repeat(257), suppressResponse: true }),
  /invalid-runtime-conversation-id/,
);
assert.equal(runtime.core.operationalStatusSnapshot().tick, tickBeforeInvalidId,
  'invalid conversation ID reached inference before it was rejected');
const neuralDiagnosticsText = JSON.stringify(runtime.core.neuralExperienceBranchDiagnostics());
for (const rawId of ['conversation-alpha', 'conversation-beta', nfdConversation, 'café']) {
  assert.equal(neuralDiagnosticsText.includes(rawId), false, 'raw host conversation ID leaked into neural diagnostics');
}

await runtime.stop();
const afterStop = runtime.core.neuralExperienceBranchDiagnostics().testTimeNeuroplasticity;
assert.equal(afterStop.contextCount, 0, 'runtime stop retained ephemeral test-time adaptation contexts');
assert.equal(afterStop.activeAdapterNorm, 0);
assert.equal(afterStop.sessionScopeCount, 0, 'runtime stop retained opaque conversation scope mappings');

console.log('P27_NEUROPLASTICITY_SESSION_LIFECYCLE=PASS', JSON.stringify({
  contextsBeforeStop: beforeStop.contextCount,
  contextsAfterStop: afterStop.contextCount,
  activeAdapterNormAfterStop: afterStop.activeAdapterNorm,
}));