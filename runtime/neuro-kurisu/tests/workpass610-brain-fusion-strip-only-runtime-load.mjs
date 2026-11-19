import assert from 'node:assert/strict';
import { ClosedLoopRuntimeOrchestrator } from '../src/organism/brain_fusion/ClosedLoopRuntimeOrchestrator.ts';
import { UnifiedCognitiveLoop } from '../src/organism/brain_fusion/UnifiedCognitiveLoop.ts';
import { FullCognitiveOrganismLoop } from '../src/organism/brain_fusion/FullCognitiveOrganismLoop.ts';
import { CognitiveRuntimeBridge } from '../src/organism/brain_fusion/CognitiveRuntimeBridge.ts';
import { BrainRuntimeBridge } from '../src/organism/brain_fusion/BrainRuntimeBridge.ts';
import { MobileCognitiveResourceGuard } from '../src/organism/brain_fusion/MobileCognitiveResourceGuard.ts';

// Node 24 strip-only removes erasable types but neither erased interface names used as
// value imports nor TypeScript parameter properties. Importing the real modules here
// fails during module load if any of those regressions return.
const loadable = {
  ClosedLoopRuntimeOrchestrator,
  UnifiedCognitiveLoop,
  FullCognitiveOrganismLoop,
  CognitiveRuntimeBridge,
  BrainRuntimeBridge,
  MobileCognitiveResourceGuard,
};
for (const [name, value] of Object.entries(loadable)) {
  assert.equal(typeof value, 'function', `${name} must load as a runtime class under strip-only TypeScript`);
}

// Type-only import rewrite must keep the erased interface contract usable as a type.
const orchestrator = new ClosedLoopRuntimeOrchestrator();
const first = orchestrator.processObservation({ source: 'runtime', novelty: 1, predictionError: 1, outcomeValue: 1 });
assert.equal(first.cycle, 1);
assert.equal(first.changed, true, 'a strong first observation must register as a lifecycle change');
assert.equal(first.lifecycle.processedExperiences, 1);
const second = orchestrator.processObservation({ source: 'runtime', novelty: 1, predictionError: 1, outcomeValue: 1 });
assert.equal(second.changed, false, 'an identical observation must not report a lifecycle change');
assert.equal(orchestrator.snapshot().cycle, 2);

// Parameter-property removal must preserve constructor defaults and field assignment.
const defaultLoop = new UnifiedCognitiveLoop();
for (let i = 0; i < 300; i += 1) {
  defaultLoop.process({ id: `e${i}`, novelty: 0.5, predictionError: 0.5, importance: 0.5, timestamp: i });
}
assert.equal(defaultLoop.getHistorySize(), 256, 'default maxHistory must still bound retained history');

const boundedLoop = new UnifiedCognitiveLoop(2);
boundedLoop.process({ id: 'a', novelty: 0, predictionError: 0, importance: 0, timestamp: 1 });
boundedLoop.process({ id: 'b', novelty: 0, predictionError: 0, importance: 0, timestamp: 2 });
boundedLoop.process({ id: 'c', novelty: 0, predictionError: 0, importance: 0, timestamp: 3 });
assert.equal(boundedLoop.getHistorySize(), 2, 'explicit maxHistory must still be honoured');

const organismLoop = new FullCognitiveOrganismLoop(1);
organismLoop.step({ id: 'x', predictionError: 0.4, novelty: 0.4, reward: 0.4, stability: 1, timestamp: 1 });
organismLoop.step({ id: 'y', predictionError: 0.4, novelty: 0.4, reward: 0.4, stability: 1, timestamp: 2 });
assert.equal(organismLoop.getRecentCount(), 1, 'explicit FullCognitiveOrganismLoop limit must still be honoured');

const bridge = new CognitiveRuntimeBridge(1);
const decision = bridge.processExperience({ id: 'x', predictionError: 1, novelty: 1, reward: 1, stability: 0, timestamp: 1 });
assert.equal(bridge.getCycleCount(), 1);
assert.equal(decision.shouldConsolidate, true);
assert.equal(decision.shouldExplore, true);
assert.equal(decision.priority, 1);

const runtimeBridge = new BrainRuntimeBridge(2);
runtimeBridge.ingest({ tick: 1, source: 'a', predictionError: 1, novelty: 1, importance: 1 });
runtimeBridge.ingest({ tick: 2, source: 'b', predictionError: 1, novelty: 1, importance: 1 });
runtimeBridge.ingest({ tick: 3, source: 'c', predictionError: 1, novelty: 1, importance: 1 });
assert.equal(runtimeBridge.snapshot().events.length, 2, 'explicit maxEvents must still bound retained events');

const guard = new MobileCognitiveResourceGuard({ maxOperations: 10, maxMemoryItems: 10 });
assert.equal(guard.check({ operations: 10, memoryItems: 10, maxOperations: 0, maxMemoryItems: 0 }), true);
assert.equal(guard.check({ operations: 11, memoryItems: 0, maxOperations: 0, maxMemoryItems: 0 }), false);
assert.equal(new MobileCognitiveResourceGuard().check({ operations: 9999, memoryItems: 4999, maxOperations: 0, maxMemoryItems: 0 }), true);
assert.equal(new MobileCognitiveResourceGuard().check({ operations: 9999, memoryItems: 5001, maxOperations: 0, maxMemoryItems: 0 }), false, 'default guard limits must still apply');

console.log(JSON.stringify({ ok: true, test: 'workpass609-brain-fusion-strip-only-runtime-load' }));
