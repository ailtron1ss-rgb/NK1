import assert from 'node:assert/strict';
import { createCognitiveModuleRuntimePersistence } from '../src/organism/core/CognitiveModuleRuntimePersistence.ts';

function manifest(id) {
  return {
    schemaVersion: 1, id, version: '1.0.0', runtimeApiVersion: 1,
    stateSchemaVersion: 1, dependencies: [], capabilities: [],
  };
}

function moduleFixture(state) {
  return {
    initialize() {},
    health: () => ({ healthy: true }),
    snapshot: () => ({ value: state.value }),
    restore: snapshot => { state.value = snapshot.value; },
    quiesce() {},
    resume() {},
    shutdown() {},
  };
}

function memoryDelegate(seed = null) {
  let saved = seed ? structuredClone(seed) : null;
  return {
    async load() { return saved ? structuredClone(saved) : null; },
    async save(value) { saved = structuredClone(value); },
    read() { return saved ? structuredClone(saved) : null; },
  };
}

// Active module snapshots are projected into the same canonical organism save.
{
  const delegate = memoryDelegate();
  const state = { value: 41 };
  const host = createCognitiveModuleRuntimePersistence(
    delegate,
    [{ manifest: manifest('memory.autobiography'), factory: () => moduleFixture(state) }],
    { clock: () => 1234 },
  );
  await host.activateAll();
  await host.stateStore.save({ system: {}, tick: 7 });
  const saved = delegate.read();
  assert.equal(saved.tick, 7);
  assert.equal(saved.system.cognitiveModuleRuntime.schemaVersion, 1);
  assert.equal(saved.system.cognitiveModuleRuntime.modules.length, 1);
  assert.equal(saved.system.cognitiveModuleRuntime.modules[0].moduleId, 'memory.autobiography');
  assert.deepEqual(saved.system.cognitiveModuleRuntime.modules[0].state, { value: 41 });
  assert.equal(saved.system.cognitiveModuleRuntime.modules[0].capturedAt, 1234);
  await host.stopAll();
}

// A fresh host restores module state only after the canonical checkpoint is loaded.
{
  const delegate = memoryDelegate({
    system: {
      cognitiveModuleRuntime: {
        schemaVersion: 1,
        capturedAt: 1234,
        modules: [{
          schemaVersion: 1, moduleId: 'memory.autobiography', moduleVersion: '1.0.0',
          stateSchemaVersion: 1, capturedAt: 1234, state: { value: 88 },
        }],
        snapshotFailures: [],
      },
    },
  });
  const state = { value: 0 };
  const host = createCognitiveModuleRuntimePersistence(
    delegate,
    [{ manifest: manifest('memory.autobiography'), factory: () => moduleFixture(state) }],
  );
  await host.stateStore.load();
  await host.activateAll();
  assert.equal(state.value, 88);
  await host.stopAll();
}

// A module snapshot failure is visible in the same canonical checkpoint;
// it does not silently replace the previous module snapshot or fail Core save.
{
  const delegate = memoryDelegate();
  const host = createCognitiveModuleRuntimePersistence(delegate, [{
    manifest: manifest('memory.unavailable'),
    factory: () => ({
      initialize() {}, health: () => true, snapshot() { throw new Error('snapshot-unavailable'); },
      restore() {}, quiesce() {}, resume() {}, shutdown() {},
    }),
  }]);
  await host.activateAll();
  await host.stateStore.save({ system: {}, tick: 8 });
  const saved = delegate.read();
  assert.equal(saved.tick, 8);
  assert.deepEqual(saved.system.cognitiveModuleRuntime.snapshotFailures, [{
    id: 'memory.unavailable', reason: 'snapshot-unavailable',
  }]);
  await host.stopAll();
}

console.log('COGNITIVE_MODULE_RUNTIME_PERSISTENCE=PASS');
