import assert from 'node:assert/strict';
import { CognitiveModuleCheckpointStore } from '../src/organism/core/CognitiveModuleCheckpointStore.ts';
import { CognitiveModuleRuntime } from '../src/organism/core/CognitiveModuleRuntime.ts';

function backingStore() {
  let value = null;
  return {
    async load() { return value ? structuredClone(value) : null; },
    async save(next) { value = structuredClone(next); },
    inspect() { return value ? structuredClone(value) : null; },
  };
}

function manifest(id) {
  return {
    schemaVersion: 1,
    id,
    version: '1.0.0',
    runtimeApiVersion: 1,
    stateSchemaVersion: 1,
    dependencies: [],
    capabilities: [],
  };
}

function fixture(events) {
  const state = { counter: 0 };
  return {
    state,
    module: {
      initialize() { events.push('initialize'); },
      health() { return { healthy: true }; },
      snapshot() { events.push('snapshot'); return structuredClone(state); },
      restore(value) { events.push('restore'); Object.assign(state, value); },
      quiesce() { events.push('quiesce'); },
      resume() { events.push('resume'); },
      shutdown() { events.push('shutdown'); },
    },
  };
}

function persisted() {
  return {
    schemaVersion: 1,
    state: {},
    goals: [],
    traces: [],
    memories: [],
    worldModel: {},
    facets: {},
    system: { release: 'test', organismCore: 'test', schemaVersion: 1 },
  };
}

// The canonical organism store is the only durable writer. Module envelopes
// live under PersistedOrganism.system and survive a complete host reconstruction.
{
  const durable = backingStore();
  const checkpoint = new CognitiveModuleCheckpointStore(durable);
  await checkpoint.load();
  const events = [];
  const firstModule = fixture(events);
  const firstHost = new CognitiveModuleRuntime({
    hostApiVersion: 1,
    grants: {},
    stateStore: checkpoint.moduleStateStore,
    clock: () => 100,
  });
  firstHost.register({ manifest: manifest('memory.autobiography'), factory: () => firstModule.module });
  checkpoint.bindSnapshotProvider(() => firstHost.snapshotAll());
  await firstHost.activateAll();
  firstModule.state.counter = 42;

  await checkpoint.save(persisted());
  const durableState = durable.inspect();
  assert.equal(durableState.system.cognitiveModuleRuntime.schemaVersion, 1);
  assert.equal(durableState.system.cognitiveModuleRuntime.modules.length, 1);
  assert.equal(durableState.system.cognitiveModuleRuntime.modules[0].state.counter, 42);
  assert.deepEqual(durableState.system.cognitiveModuleRuntime.snapshotFailures, []);
  assert.equal(events.includes('quiesce'), false);
  assert.equal(events.includes('shutdown'), false);

  const restoredCheckpoint = new CognitiveModuleCheckpointStore(durable);
  await restoredCheckpoint.load();
  const restoredEvents = [];
  const restoredModule = fixture(restoredEvents);
  const restoredHost = new CognitiveModuleRuntime({
    hostApiVersion: 1,
    grants: {},
    stateStore: restoredCheckpoint.moduleStateStore,
    clock: () => 200,
  });
  restoredHost.register({ manifest: manifest('memory.autobiography'), factory: () => restoredModule.module });
  await restoredHost.activateAll();
  assert.equal(restoredModule.state.counter, 42);
  assert.ok(restoredEvents.indexOf('restore') < restoredEvents.indexOf('initialize'));
  await restoredHost.stopAll();
}

// A broken module snapshot must not block the organism checkpoint or erase the
// last good module envelope. The failure is made visible in checkpoint metadata.
{
  const durable = backingStore();
  const checkpoint = new CognitiveModuleCheckpointStore(durable);
  await checkpoint.load();
  const events = [];
  const item = fixture(events);
  const host = new CognitiveModuleRuntime({
    hostApiVersion: 1,
    grants: {},
    stateStore: checkpoint.moduleStateStore,
    clock: () => 300,
  });
  host.register({ manifest: manifest('memory.index'), factory: () => item.module });
  checkpoint.bindSnapshotProvider(() => host.snapshotAll());
  await host.activateAll();
  item.state.counter = 11;
  await checkpoint.save(persisted());

  item.module.snapshot = () => { events.push('snapshot-failed'); throw new Error('module-snapshot-offline'); };
  await checkpoint.save(persisted());
  const afterFailure = durable.inspect();
  assert.equal(afterFailure.system.cognitiveModuleRuntime.modules[0].state.counter, 11);
  assert.deepEqual(afterFailure.system.cognitiveModuleRuntime.snapshotFailures, [
    { id: 'memory.index', reason: 'module-snapshot-offline' },
  ]);
  assert.equal(host.list()[0].status, 'active');
  assert.equal(events.includes('quiesce'), false);
  assert.equal(events.includes('shutdown'), false);
  await host.stopAll();
}

console.log('COGNITIVE_MODULE_CHECKPOINT=PASS');
