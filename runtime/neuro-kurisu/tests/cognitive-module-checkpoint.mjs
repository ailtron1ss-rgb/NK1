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
  const checkpoint = new CognitiveModuleCheckpointStore(durable, () => 100);
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
  assert.equal(checkpoint.diagnostics().capturedAt, 100,
    'checkpoint diagnostics must report the durable capture time, not the read time');
  const durableState = durable.inspect();
  assert.equal(durableState.system.cognitiveModuleRuntime.schemaVersion, 1);
  assert.equal(durableState.system.cognitiveModuleRuntime.modules.length, 1);
  assert.equal(durableState.system.cognitiveModuleRuntime.modules[0].state.counter, 42);
  assert.deepEqual(durableState.system.cognitiveModuleRuntime.snapshotFailures, []);
  assert.equal(events.includes('quiesce'), false);
  assert.equal(events.includes('shutdown'), false);

  const restoredCheckpoint = new CognitiveModuleCheckpointStore(durable, () => 200);
  await restoredCheckpoint.load();
  assert.equal(restoredCheckpoint.diagnostics().capturedAt, 100,
    'restart diagnostics must retain the persisted module checkpoint time');
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

// A broken module snapshot must block the enclosing canonical checkpoint.
// The last durable envelope remains intact, and the in-memory diagnostic exposes
// the failed owner until a complete retry can commit a fresh generation.
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
  await assert.rejects(
    checkpoint.save(persisted()),
    /cognitive-module-checkpoint-snapshot-incomplete:memory.index/,
  );
  const afterFailure = durable.inspect();
  assert.equal(afterFailure.system.cognitiveModuleRuntime.modules[0].state.counter, 11);
  assert.deepEqual(afterFailure.system.cognitiveModuleRuntime.snapshotFailures, []);
  assert.deepEqual(checkpoint.diagnostics().snapshotFailures, [
    { id: 'memory.index', reason: 'module-snapshot-offline' },
  ]);
  assert.equal(host.list()[0].status, 'active');
  assert.equal(events.includes('quiesce'), false);
  assert.equal(events.includes('shutdown'), false);

  item.state.counter = 12;
  item.module.snapshot = () => { events.push('snapshot-recovered'); return structuredClone(item.state); };
  await checkpoint.save(persisted());
  const recovered = durable.inspect();
  assert.equal(recovered.system.cognitiveModuleRuntime.modules[0].state.counter, 12);
  assert.deepEqual(recovered.system.cognitiveModuleRuntime.snapshotFailures, []);
  assert.deepEqual(checkpoint.diagnostics().snapshotFailures, []);
  await host.stopAll();
}

console.log('COGNITIVE_MODULE_CHECKPOINT=PASS');

// Exercise the actual OrganismRuntime composition root: activation occurs after
// Core restore, flush captures live module state into the canonical store, and
// stop/restart restores the same module state without a second durable file.
{
  const { OrganismRuntime } = await import('../src/organism/core/OrganismRuntime.ts');
  const durable = backingStore();
  const stateFile = `/tmp/nk1-cognitive-module-checkpoint-${process.pid}.json`;
  const firstEvents = [];
  const firstModule = fixture(firstEvents);
  const firstHost = new CognitiveModuleRuntime({ hostApiVersion: 1, grants: {} });
  firstHost.register({ manifest: manifest('memory.runtime-integration'), factory: () => firstModule.module });
  const firstRuntime = new OrganismRuntime({
    stateFile,
    stateStore: durable,
    autoRun: false,
    enableLanguage: false,
    cognitiveModuleRuntime: firstHost,
  });
  await firstRuntime.init();
  assert.equal(firstRuntime.cognitiveModuleDiagnostics().enabled, true);
  assert.equal(firstRuntime.cognitiveModuleDiagnostics().modules[0].status, 'active');
  firstModule.state.counter = 99;
  await firstRuntime.flush();
  assert.equal(
    durable.inspect().system.cognitiveModuleRuntime.modules[0].state.counter,
    99,
  );
  await firstRuntime.stop();

  const secondEvents = [];
  const secondModule = fixture(secondEvents);
  const secondHost = new CognitiveModuleRuntime({ hostApiVersion: 1, grants: {} });
  secondHost.register({ manifest: manifest('memory.runtime-integration'), factory: () => secondModule.module });
  const secondRuntime = new OrganismRuntime({
    stateFile,
    stateStore: durable,
    autoRun: false,
    enableLanguage: false,
    cognitiveModuleRuntime: secondHost,
  });
  await secondRuntime.init();
  assert.equal(secondModule.state.counter, 99);
  assert.ok(secondEvents.indexOf('restore') < secondEvents.indexOf('initialize'));
  await secondRuntime.stop();
}

console.log('ORGANISM_RUNTIME_MODULE_INTEGRATION=PASS');



// Optional module startup faults must not take the canonical organism offline.
// The module host rolls back its own partial activation; OrganismRuntime keeps
// Core available and exposes the degraded module health to the host.
{
  const { OrganismRuntime } = await import('../src/organism/core/OrganismRuntime.ts');
  const durable = backingStore();
  const events = [];
  const broken = fixture(events);
  broken.module.initialize = () => {
    events.push('initialize-failed');
    throw new Error('optional-module-init-failure');
  };
  const host = new CognitiveModuleRuntime({ hostApiVersion: 1, grants: {} });
  host.register({ manifest: manifest('optional.visual-index'), factory: () => broken.module });
  const organism = new OrganismRuntime({
    stateFile: `/tmp/nk1-module-optional-init-${process.pid}.json`,
    stateStore: durable,
    autoRun: false,
    enableLanguage: false,
    cognitiveModuleRuntime: host,
  });

  await assert.doesNotReject(
    organism.init(),
    'an optional module initialization failure must not block the canonical organism',
  );
  assert.equal(organism.cognitiveModuleDiagnostics().enabled, true);
  assert.equal(organism.cognitiveModuleDiagnostics().modules[0].status, 'failed');
  assert.match(
    organism.cognitiveModuleDiagnostics().activationError ?? '',
    /optional-module-init-failure/,
  );
  const health = await organism.cognitiveModuleHealth();
  assert.equal(health.ok, false);
  assert.equal(organism.core.operationalStatusSnapshot().tick, 0);
  await organism.stop();
}


// Corrupt module-extension metadata is quarantined without failing the
// canonical organism-store load. Modules fail closed on their own restore path;
// subsequent Core checkpoints preserve the quarantined extension payload.
{
  const durable = backingStore();
  const damaged = persisted();
  damaged.system.cognitiveModuleRuntime = {
    schemaVersion: 99,
    modules: [],
  };
  await durable.save(damaged);

  const checkpoint = new CognitiveModuleCheckpointStore(durable);
  const loaded = await checkpoint.load();
  assert.ok(loaded, 'canonical organism state must load despite optional-module metadata corruption');
  assert.equal(loaded.system.cognitiveModuleRuntime.schemaVersion, 99);
  assert.match(checkpoint.diagnostics().checkpointLoadError ?? '', /checkpoint-invalid/);

  const events = [];
  const host = new CognitiveModuleRuntime({
    hostApiVersion: 1,
    grants: {},
    stateStore: checkpoint.moduleStateStore,
  });
  const item = fixture(events);
  host.register({ manifest: manifest('memory.restore-quarantine'), factory: () => item.module });
  checkpoint.bindSnapshotProvider(() => host.snapshotAll());
  await assert.rejects(
    host.activateAll(),
    /cognitive-module-checkpoint-restore-failed/,
    'a module must not initialize from a silently discarded corrupt checkpoint',
  );
  assert.equal(host.list()[0].status, 'failed');

  await checkpoint.save(loaded);
  assert.equal(
    durable.inspect().system.cognitiveModuleRuntime.schemaVersion,
    99,
    'ordinary Core checkpointing must preserve quarantined module metadata for recovery',
  );
}


// Even when a module repeatedly fails snapshot during stop, the runtime must
// close its continuity ledger. The final durable error and module shutdown
// error are both surfaced, rather than leaking the ledger on an early throw.
{
  const { OrganismRuntime } = await import('../src/organism/core/OrganismRuntime.ts');
  const durable = backingStore();
  const events = [];
  const broken = fixture(events);
  broken.module.snapshot = () => { throw new Error('module-stop-snapshot-offline'); };
  const host = new CognitiveModuleRuntime({ hostApiVersion: 1, grants: {} });
  host.register({ manifest: manifest('memory.stop-failure'), factory: () => broken.module });
  const organism = new OrganismRuntime({
    stateFile: `/tmp/nk1-module-stop-failure-${process.pid}.json`,
    stateStore: durable,
    autoRun: false,
    enableLanguage: false,
    cognitiveModuleRuntime: host,
  });
  await organism.init();

  const ledger = organism.continuityLedger;
  let flushCalls = 0;
  let closeCalls = 0;
  ledger.flush = async () => { flushCalls += 1; };
  ledger.close = async () => { closeCalls += 1; };

  await assert.rejects(
    organism.stop(),
    error => {
      assert.ok(error instanceof AggregateError,
        'both the failed module stop and failed canonical checkpoint must be preserved');
      assert.match(error.errors[0]?.message ?? '', /module-stop-incomplete/);
      assert.match(error.errors[1]?.message ?? '', /cognitive-module-checkpoint-snapshot-incomplete/);
      return true;
    },
  );
  assert.equal(flushCalls, 1, 'continuity ledger must be flushed despite checkpoint failure');
  assert.equal(closeCalls, 1, 'continuity ledger must always be closed after stop attempt');
}
