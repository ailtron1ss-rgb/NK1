import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { MemoryOS2 } from '../src/organism/developmental/MemoryOS2.ts';
import { MemoryFabric } from '../src/organism/memory/MemoryFabric.ts';
import { EventLog } from '../src/organism/memory/EventSourcing.ts';
import { MultiTimescaleMemory } from '../src/organism/memory/MultiTimescaleMemory.ts';
import { MemorySubstrateCoordinator } from '../src/organism/developmental/MemorySubstrateCoordinator.ts';
import { UnifiedMemorySystem } from '../src/organism/developmental/UnifiedMemorySystem.ts';
import { P62MemoryFabric } from '../src/organism/memory/P62MemoryFabric.ts';
import { SemanticMemoryGraph } from '../src/organism/memory/SemanticMemoryGraph.ts';

const hash = value => createHash('sha256').update(value).digest('hex');
const fingerprint = value => hash('fixture:' + value);
const base = {
  memoryId: 'memory:episodic:fixture-01',
  taskKeyHash: fingerprint('task-1'),
  holdoutFingerprint: fingerprint('immutable-holdout-v1'),
  contextFingerprint: fingerprint('context-v1'),
  readerFingerprint: fingerprint('reader-v1:model+prompt+decode+budget'),
  scorerFingerprint: fingerprint('scorer-v1'),
  fillerFingerprint: fingerprint('same-filler-v1'),
  insertionPosition: 512, seed: 7, replicate: 0,
  formationCostTokens: 44, storageBytes: 320, at: 5_000,
};

function createFabric() {
  return new MemoryFabric(
    new MemoryOS2(), new EventLog(), new MultiTimescaleMemory(),
    new MemorySubstrateCoordinator(), new UnifiedMemorySystem(),
    new P62MemoryFabric(), new SemanticMemoryGraph(),
  );
}

const fabric = createFabric();
const beforeSize = fabric.canonicalSize();
const probe = fabric.registerTaskConditionedUtilityProbe(base);
assert.equal(probe.accepted, true);
const unverified = fabric.resolveTaskConditionedUtilityProbe({
  probeId: probe.probe.id, withMemoryScore01: .9, withoutMemoryScore01: .6,
  withMemoryInputTokens: 200, withoutMemoryInputTokens: 120,
  withMemoryOutputTokens: 35, withoutMemoryOutputTokens: 30,
  withMemoryRetrievalLatencyMs: 6, withoutMemoryRetrievalLatencyMs: 0,
  independentVerified: false, validationAt: 5_050,
});
assert.equal(unverified.accepted, true);
assert.equal(unverified.aggregate, null);
assert.equal(fabric.taskConditionedUtilityDiagnostics().pending, 1);

const verified = fabric.resolveTaskConditionedUtilityProbe({
  probeId: probe.probe.id, withMemoryScore01: .9, withoutMemoryScore01: .6,
  withMemoryInputTokens: 200, withoutMemoryInputTokens: 120,
  withMemoryOutputTokens: 35, withoutMemoryOutputTokens: 30,
  withMemoryRetrievalLatencyMs: 6, withoutMemoryRetrievalLatencyMs: 0,
  independentVerified: true, validationAt: 5_100,
});
assert.equal(verified.accepted, true);
assert.ok(Math.abs(verified.outcome.delta01 - .3) < 1e-12);
assert.equal(fabric.canonicalSize(), beforeSize);
assert.equal(fabric.inspect().taskConditionedUtility.resolved, 1);

const snapshot = fabric.snapshot();
assert.equal(snapshot.taskConditionedUtility.resolved, 1);
const restored = createFabric();
restored.restore(snapshot);
const query = {
  memoryId: base.memoryId, taskKeyHash: base.taskKeyHash, holdoutFingerprint: base.holdoutFingerprint,
  contextFingerprint: base.contextFingerprint, readerFingerprint: base.readerFingerprint,
  scorerFingerprint: base.scorerFingerprint, fillerFingerprint: base.fillerFingerprint,
};
assert.deepEqual(restored.taskConditionedUtilityEvidence(query), fabric.taskConditionedUtilityEvidence(query));
assert.equal(restored.taskConditionedUtilityDiagnostics().resolved, 1);

console.log('MEMORY_TASK_CONDITIONED_UTILITY_RUNTIME_WIRING=PASS');
