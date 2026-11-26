import assert from 'node:assert/strict';
import * as organismApi from '../src/organism/index.ts';
import { CognitiveModuleCheckpointStore } from '../src/organism/core/CognitiveModuleCheckpointStore.ts';

const CognitiveModuleRuntime = organismApi.CognitiveModuleRuntime;
assert.equal(
  typeof CognitiveModuleRuntime,
  'function',
  'the canonical organism API must expose the lifecycle-managed cognitive module runtime',
);

function manifest(id, overrides = {}) {
  return {
    schemaVersion: 1,
    id,
    version: '1.0.0',
    runtimeApiVersion: 1,
    stateSchemaVersion: 1,
    dependencies: [],
    capabilities: [],
    ...overrides,
  };
}

function memoryStore(seed = []) {
  const rows = new Map(seed.map(row => [row.moduleId, structuredClone(row)]));
  return {
    rows,
    async load(moduleId) {
      const row = rows.get(moduleId);
      return row ? structuredClone(row) : null;
    },
    async save(envelope) {
      rows.set(envelope.moduleId, structuredClone(envelope));
    },
  };
}

function moduleFixture(id, events, options = {}) {
  const state = { value: options.initialValue ?? 0 };
  const contextLog = [];
  return {
    state,
    contextLog,
    module: {
      initialize(context) {
        events.push(`initialize:${id}`);
        contextLog.push(context);
        if (options.failInitialize) throw new Error('fixture-init-failure');
      },
      health() {
        return { healthy: options.healthy !== false };
      },
      snapshot() {
        events.push(`snapshot:${id}`);
        return structuredClone(state);
      },
      restore(snapshot) {
        events.push(`restore:${id}`);
        Object.assign(state, snapshot);
      },
      migrateState(snapshot, fromVersion, toVersion) {
        events.push(`migrate:${id}:${fromVersion}->${toVersion}`);
        return { ...snapshot, value: Number(snapshot.value ?? 0) + 1 };
      },
      quiesce() {
        events.push(`quiesce:${id}`);
      },
      resume() {
        events.push(`resume:${id}`);
      },
      shutdown() {
        events.push(`shutdown:${id}`);
      },
    },
  };
}

function runtime(options = {}) {
  return new CognitiveModuleRuntime({
    hostApiVersion: 1,
    grants: {},
    ...options,
  });
}

function statusOf(host, id) {
  return host.list().find(row => row.manifest.id === id)?.status;
}

async function expectReject(promise, pattern) {
  await assert.rejects(promise, error => {
    assert.match(String(error?.message ?? error), pattern);
    return true;
  });
}

// A module is code already trusted by the host. The registry only receives a
// factory; it never loads, evaluates, or executes a path supplied by a manifest.
{
  const host = runtime();
  const events = [];
  const fixture = moduleFixture('memory.index', events);
  host.register({ manifest: manifest('memory.index'), factory: () => fixture.module });
  assert.equal(statusOf(host, 'memory.index'), 'registered');
  assert.deepEqual(host.list().map(row => row.manifest.id), ['memory.index']);
  assert.equal(events.length, 0, 'registration must not execute the module factory');
}

// Invalid identity/version metadata and duplicate IDs must be rejected before
// the factory is ever called.
{
  const host = runtime();
  let factoryCalls = 0;
  const factory = () => {
    factoryCalls += 1;
    return moduleFixture('invalid', []).module;
  };
  assert.throws(
    () => host.register({ manifest: manifest('../escape'), factory }),
    /invalid-module-id/,
  );
  assert.throws(
    () => host.register({ manifest: manifest('memory.index', { version: 'latest' }), factory }),
    /invalid-module-version/,
  );
  host.register({ manifest: manifest('memory.index'), factory });
  assert.throws(
    () => host.register({ manifest: manifest('memory.index'), factory }),
    /duplicate-module-id/,
  );
  assert.equal(factoryCalls, 0);
}

// A module cannot obtain capabilities merely by declaring them. The host grant
// is checked before creation/initialization, and the context only exposes the
// granted set.
{
  const host = runtime({ grants: { 'world.sensor': ['world.read'] } });
  const events = [];
  const granted = moduleFixture('world.sensor', events);
  let forbiddenFactoryCalls = 0;
  host.register({
    manifest: manifest('world.sensor', { capabilities: ['world.read', 'camera.capture'] }),
    factory: () => {
      forbiddenFactoryCalls += 1;
      return granted.module;
    },
  });
  await expectReject(host.activate('world.sensor'), /capability-not-granted:camera\.capture/);
  assert.equal(forbiddenFactoryCalls, 0);
  assert.equal(statusOf(host, 'world.sensor'), 'failed');
  assert.equal(events.length, 0);
}

// Dependencies activate before dependents and stop in reverse order. A
// dependency cannot be stopped while an active module still depends on it.
{
  const events = [];
  const host = runtime();
  const core = moduleFixture('core.memory', events);
  const search = moduleFixture('memory.search', events);
  host.register({ manifest: manifest('memory.search', { dependencies: ['core.memory'] }), factory: () => search.module });
  host.register({ manifest: manifest('core.memory'), factory: () => core.module });
  assert.deepEqual(host.topologicalOrder(), ['core.memory', 'memory.search']);
  await host.activateAll();
  assert.deepEqual(events.filter(x => x.startsWith('initialize:')), ['initialize:core.memory', 'initialize:memory.search']);
  assert.equal(statusOf(host, 'core.memory'), 'active');
  assert.equal(statusOf(host, 'memory.search'), 'active');
  await expectReject(host.deactivate('core.memory'), /active-dependent:memory\.search/);
  await host.stopAll();
  assert.deepEqual(
    events.filter(x => x.startsWith('shutdown:')),
    ['shutdown:memory.search', 'shutdown:core.memory'],
  );
  assert.equal(statusOf(host, 'memory.search'), 'stopped');
  assert.equal(statusOf(host, 'core.memory'), 'stopped');
}

// Missing dependencies and cycles must be rejected before any factory or
// initialize method is run.
{
  const missing = runtime();
  const events = [];
  const dependent = moduleFixture('plan.engine', events);
  missing.register({
    manifest: manifest('plan.engine', { dependencies: ['world.model'] }),
    factory: () => dependent.module,
  });
  await expectReject(missing.activateAll(), /missing-module-dependency:plan\.engine:world\.model/);
  assert.equal(events.length, 0);

  const cyclic = runtime();
  cyclic.register({ manifest: manifest('cycle.a', { dependencies: ['cycle.b'] }), factory: () => moduleFixture('cycle.a', []).module });
  cyclic.register({ manifest: manifest('cycle.b', { dependencies: ['cycle.a'] }), factory: () => moduleFixture('cycle.b', []).module });
  assert.throws(() => cyclic.topologicalOrder(), /module-dependency-cycle/);
}

// State is saved after quiesce and before shutdown, then restored before the
// module becomes active in a new host instance.
{
  const store = memoryStore();
  const firstEvents = [];
  const first = runtime({ stateStore: store });
  const firstFixture = moduleFixture('memory.autobiography', firstEvents);
  first.register({ manifest: manifest('memory.autobiography'), factory: () => firstFixture.module });
  await first.activate('memory.autobiography');
  firstFixture.state.value = 41;
  const envelope = await first.deactivate('memory.autobiography');
  assert.equal(envelope.state.value, 41);
  assert.equal(store.rows.get('memory.autobiography').state.value, 41);
  assert.ok(firstEvents.indexOf('quiesce:memory.autobiography') < firstEvents.indexOf('snapshot:memory.autobiography'));
  assert.ok(firstEvents.indexOf('snapshot:memory.autobiography') < firstEvents.indexOf('shutdown:memory.autobiography'));

  const secondEvents = [];
  const second = runtime({ stateStore: store });
  const secondFixture = moduleFixture('memory.autobiography', secondEvents);
  second.register({ manifest: manifest('memory.autobiography'), factory: () => secondFixture.module });
  await second.activate('memory.autobiography');
  assert.equal(secondFixture.state.value, 41);
  assert.ok(secondEvents.indexOf('restore:memory.autobiography') < secondEvents.indexOf('initialize:memory.autobiography'));
}

// State schema upgrades are module-owned and explicit. No implicit coercion or
// silent discard is permitted.
{
  const seeded = {
    schemaVersion: 1,
    moduleId: 'memory.index',
    moduleVersion: '1.0.0',
    stateSchemaVersion: 1,
    capturedAt: 100,
    state: { value: 9 },
  };
  const store = memoryStore([seeded]);
  const events = [];
  const host = runtime({ stateStore: store });
  const fixture = moduleFixture('memory.index', events);
  const restore = fixture.module.restore.bind(fixture.module);
  fixture.module.restore = (state, schemaVersion) => {
    events.push(`restore-schema:memory.index:${schemaVersion}`);
    return restore(state, schemaVersion);
  };
  host.register({
    manifest: manifest('memory.index', { stateSchemaVersion: 2 }),
    factory: () => fixture.module,
  });
  await host.activate('memory.index');
  assert.equal(fixture.state.value, 10);
  assert.ok(events.includes('migrate:memory.index:1->2'));
  assert.ok(events.includes('restore:memory.index'));
  assert.ok(events.includes('restore-schema:memory.index:2'));
}

{
  const seeded = {
    schemaVersion: 1,
    moduleId: 'memory.index',
    moduleVersion: '1.0.0',
    stateSchemaVersion: 1,
    capturedAt: 100,
    state: { value: 9 },
  };
  const host = runtime({ stateStore: memoryStore([seeded]) });
  host.register({
    manifest: manifest('memory.index', { stateSchemaVersion: 2 }),
    factory: () => ({
      initialize() {}, health: () => ({ healthy: true }), snapshot: () => ({}),
      restore() {}, quiesce() {}, resume() {}, shutdown() {},
    }),
  });
  await expectReject(host.activate('memory.index'), /module-state-migration-required/);
  assert.equal(statusOf(host, 'memory.index'), 'failed');
}

// A failed durable write must resume the still-running module and must never
// report a successful stop.
{
  const events = [];
  const store = {
    async load() { return null; },
    async save() { throw new Error('disk-full'); },
  };
  const host = runtime({ stateStore: store });
  const fixture = moduleFixture('memory.index', events);
  host.register({ manifest: manifest('memory.index'), factory: () => fixture.module });
  await host.activate('memory.index');
  await expectReject(host.deactivate('memory.index'), /module-state-save-failed/);
  assert.equal(statusOf(host, 'memory.index'), 'active');
  assert.ok(events.includes('resume:memory.index'));
  assert.ok(!events.includes('shutdown:memory.index'));
}

{
  const host = runtime();
  const events = [];
  const healthy = moduleFixture('world.model', events, { healthy: true });
  const degraded = moduleFixture('speech.input', events, { healthy: false });
  host.register({ manifest: manifest('world.model'), factory: () => healthy.module });
  host.register({ manifest: manifest('speech.input'), factory: () => degraded.module });
  await host.activateAll();
  const health = await host.health();
  assert.equal(health.ok, false);
  assert.deepEqual(health.modules.filter(row => !row.healthy).map(row => row.id), ['speech.input']);
  await host.stopAll();
}

// A module sees only capabilities it both requested and the host granted;
// unrelated host grants must not leak into its runtime context.
{
  const host = runtime({ grants: { 'memory.index': ['memory.read', 'world.admin'] } });
  const events = [];
  const fixture = moduleFixture('memory.index', events);
  host.register({
    manifest: manifest('memory.index', { capabilities: ['memory.read'] }),
    factory: () => fixture.module,
  });
  await host.activate('memory.index');
  assert.deepEqual(fixture.contextLog[0].grantedCapabilities, ['memory.read']);
  assert.equal(fixture.contextLog[0].hasCapability('world.admin'), false);
  await host.stopAll();
}

// Quiesce can fail after partially suspending work. The host must ask the
// module to resume and retain the active state only when resume succeeds.
{
  const events = [];
  const fixture = moduleFixture('world.model', events);
  fixture.module.quiesce = () => {
    events.push('quiesce:world.model');
    throw new Error('quiesce-half-failed');
  };
  const host = runtime();
  host.register({ manifest: manifest('world.model'), factory: () => fixture.module });
  await host.activate('world.model');
  await expectReject(host.deactivate('world.model'), /module-quiesce-failed/);
  assert.equal(statusOf(host, 'world.model'), 'active');
  assert.ok(events.includes('resume:world.model'));
  assert.ok(!events.includes('shutdown:world.model'));
}

// Once shutdown has been entered, a thrown shutdown cannot safely be reported
// as active merely because resume was called: the module is quarantined.
{
  const events = [];
  const store = memoryStore();
  const fixture = moduleFixture('memory.index', events);
  fixture.module.shutdown = () => {
    events.push('shutdown:memory.index');
    throw new Error('shutdown-partial-failure');
  };
  const host = runtime({ stateStore: store });
  host.register({ manifest: manifest('memory.index'), factory: () => fixture.module });
  await host.activate('memory.index');
  await expectReject(host.deactivate('memory.index'), /module-shutdown-failed/);
  assert.equal(statusOf(host, 'memory.index'), 'failed');
  assert.equal(store.rows.get('memory.index').state.value, 0);
  assert.ok(!events.includes('resume:memory.index'));
}

// Snapshot serialization preserves own data keys such as "__proto__" without
// changing the clone's prototype or dropping the property.
{
  const store = memoryStore();
  const events = [];
  const fixture = moduleFixture('memory.index', events);
  const state = {};
  Object.defineProperty(state, '__proto__', {
    enumerable: true,
    configurable: true,
    writable: true,
    value: { marker: 'ordinary-data' },
  });
  fixture.module.snapshot = () => state;
  const host = runtime({ stateStore: store });
  host.register({ manifest: manifest('memory.index'), factory: () => fixture.module });
  await host.activate('memory.index');
  await host.deactivate('memory.index');
  const saved = store.rows.get('memory.index').state;
  assert.equal(Object.getPrototypeOf(saved), Object.prototype);
  assert.equal(Object.prototype.hasOwnProperty.call(saved, '__proto__'), true);
  assert.deepEqual(saved.__proto__, { marker: 'ordinary-data' });
}

// Accessor-backed snapshots are rejected without invoking getters, and the
// previously active module is resumed rather than being falsely stopped.
{
  const events = [];
  let getterInvoked = false;
  const fixture = moduleFixture('memory.index', events);
  fixture.module.snapshot = () => Object.defineProperty({}, 'secret', {
    enumerable: true,
    get() {
      getterInvoked = true;
      return 'should-not-run';
    },
  });
  const host = runtime({ stateStore: memoryStore() });
  host.register({ manifest: manifest('memory.index'), factory: () => fixture.module });
  await host.activate('memory.index');
  await expectReject(host.deactivate('memory.index'), /module-state-accessor-rejected/);
  assert.equal(getterInvoked, false);
  assert.equal(statusOf(host, 'memory.index'), 'active');
  assert.ok(events.includes('resume:memory.index'));
}

console.log('COGNITIVE_MODULE_RUNTIME=PASS');


// Active modules can checkpoint their current state without being quiesced or
// shut down. The result reports per-module capture failures without lying about
// the lifecycle state of a module that remains active.
{
  const store = memoryStore();
  const events = [];
  const host = runtime({ stateStore: store });
  const fixture = moduleFixture('memory.live-checkpoint', events);
  host.register({
    manifest: manifest('memory.live-checkpoint'),
    factory: () => fixture.module,
  });
  await host.activate('memory.live-checkpoint');
  fixture.state.value = 73;
  assert.equal(
    typeof host.snapshotAll,
    'function',
    'active cognitive modules need a non-disruptive checkpoint operation',
  );
  const result = await host.snapshotAll();
  assert.deepEqual(result, { captured: ['memory.live-checkpoint'], failed: [] });
  assert.equal(store.rows.get('memory.live-checkpoint').state.value, 73);
  assert.equal(statusOf(host, 'memory.live-checkpoint'), 'active');
  assert.ok(!events.includes('quiesce:memory.live-checkpoint'));
  assert.ok(!events.includes('shutdown:memory.live-checkpoint'));
  await host.stopAll();
}


// A canonical organism checkpoint must not commit if any active module could
// not provide a fresh snapshot. Stale module state must never masquerade as a
// complete checkpoint; the next fully successful capture may commit atomically.
{
  const delegate = {
    value: null,
    saves: 0,
    async load() { return this.value ? structuredClone(this.value) : null; },
    async save(value) {
      this.saves += 1;
      this.value = structuredClone(value);
    },
  };
  const checkpointStore = new CognitiveModuleCheckpointStore(delegate, () => 500);
  const events = [];
  const host = runtime({ stateStore: checkpointStore.moduleStateStore });
  const good = moduleFixture('memory.good', events, { initialValue: 11 });
  const flaky = moduleFixture('memory.flaky', events, { initialValue: 22 });
  const originalSnapshot = flaky.module.snapshot.bind(flaky.module);
  let failSnapshot = true;
  flaky.module.snapshot = () => {
    if (failSnapshot) throw new Error('snapshot-temporarily-unavailable');
    return originalSnapshot();
  };
  host.register({ manifest: manifest('memory.good'), factory: () => good.module });
  host.register({ manifest: manifest('memory.flaky'), factory: () => flaky.module });
  await host.activateAll();
  checkpointStore.bindSnapshotProvider(() => host.snapshotAll());

  await assert.rejects(
    checkpointStore.save({ system: {} }),
    /cognitive-module-checkpoint-snapshot-incomplete/,
    'a partial module snapshot must block the enclosing canonical checkpoint',
  );
  assert.equal(delegate.saves, 0, 'the canonical store must not commit a partial module snapshot');
  assert.equal(host.list().every(row => row.status === 'active'), true,
    'snapshot failure must not stop or quarantine otherwise active modules');

  failSnapshot = false;
  await checkpointStore.save({ system: {} });
  assert.equal(delegate.saves, 1, 'a complete retry must commit exactly once');
  const checkpoint = delegate.value.system.cognitiveModuleRuntime;
  assert.deepEqual(checkpoint.modules.map(row => row.moduleId), ['memory.flaky', 'memory.good']);
  assert.deepEqual(checkpoint.snapshotFailures, []);
  assert.equal(checkpoint.modules.find(row => row.moduleId === 'memory.flaky').state.value, 22);
  await host.stopAll();
}

console.log('COGNITIVE_MODULE_CHECKPOINT_ATOMICITY=PASS');


// The composition root may bind the canonical checkpoint adapter after the
// host is constructed but before any module activation. Rebinding after
// activation is forbidden because it could split module state across stores.
{
  const initialStore = memoryStore();
  const replacementStore = memoryStore([{
    schemaVersion: 1,
    moduleId: 'memory.bound-store',
    moduleVersion: '1.0.0',
    stateSchemaVersion: 1,
    capturedAt: 500,
    state: { value: 58 },
  }]);
  const events = [];
  const fixture = moduleFixture('memory.bound-store', events);
  const host = runtime({ stateStore: initialStore });
  host.register({ manifest: manifest('memory.bound-store'), factory: () => fixture.module });
  assert.equal(typeof host.bindStateStore, 'function', 'runtime composition must bind the canonical module state adapter');
  host.bindStateStore(replacementStore);
  await host.activate('memory.bound-store');
  assert.equal(fixture.state.value, 58);
  await expectReject(
    Promise.resolve().then(() => host.bindStateStore(initialStore)),
    /module-state-store-already-in-use/,
  );
  await host.stopAll();
}


// Module state snapshots are bounded before they can enter the canonical checkpoint.
// An oversized snapshot must fail closed and resume the still-running module.
{
  const events = [];
  const fixture = moduleFixture('memory.oversized', events);
  fixture.module.snapshot = () => ({ payload: 'x'.repeat(4096) });
  const host = runtime({ maxStateBytes: 512 });
  host.register({ manifest: manifest('memory.oversized'), factory: () => fixture.module });
  await host.activate('memory.oversized');
  await expectReject(host.deactivate('memory.oversized'), /module-state-size-limit/);
  assert.equal(statusOf(host, 'memory.oversized'), 'active');
  assert.ok(events.includes('resume:memory.oversized'));
  assert.ok(!events.includes('shutdown:memory.oversized'));
  // The oversized state is intentionally rejected; restore a valid bounded
  // snapshot before cleanup so stopAll can exercise the normal shutdown path.
  fixture.module.snapshot = () => ({ value: fixture.state.value });
  await host.stopAll();
}


// A checkpoint snapshot already in flight must finish before lifecycle shutdown.
// Otherwise snapshotAll and deactivate can race, causing the durable adapter to
// observe an old snapshot after the module has already been stopped.
{
  const events = [];
  const store = memoryStore();
  const host = runtime({ stateStore: store });
  const fixture = moduleFixture('memory.snapshot-barrier', events);
  let releaseSnapshot;
  let notifySnapshotStarted;
  const gate = new Promise(resolve => { releaseSnapshot = resolve; });
  const started = new Promise(resolve => { notifySnapshotStarted = resolve; });
  let firstSnapshot = true;
  fixture.module.snapshot = async () => {
    if (firstSnapshot) {
      firstSnapshot = false;
      const captured = structuredClone(fixture.state);
      events.push('snapshot-barrier-start');
      notifySnapshotStarted();
      await gate;
      events.push('snapshot-barrier-end');
      return captured;
    }
    events.push('snapshot-shutdown-capture');
    return structuredClone(fixture.state);
  };

  host.register({
    manifest: manifest('memory.snapshot-barrier'),
    factory: () => fixture.module,
  });
  await host.activate('memory.snapshot-barrier');

  const checkpointing = host.snapshotAll();
  await started;
  const duplicateCheckpoint = host.snapshotAll();
  fixture.state.value = 99;
  const stopping = host.deactivate('memory.snapshot-barrier');
  await Promise.resolve();
  assert.equal(
    events.includes('quiesce:memory.snapshot-barrier'),
    false,
    'deactivate must wait while a checkpoint snapshot is in flight',
  );

  releaseSnapshot();
  const [checkpointResult, duplicateResult, stoppedEnvelope] = await Promise.all([
    checkpointing,
    duplicateCheckpoint,
    stopping,
  ]);
  assert.deepEqual(checkpointResult, { captured: ['memory.snapshot-barrier'], failed: [] });
  assert.deepEqual(duplicateResult, { captured: ['memory.snapshot-barrier'], failed: [] });
  assert.equal(events.filter(event => event === 'snapshot-barrier-start').length, 1,
    'overlapping checkpoint callers must share one capture per module');
  assert.equal(stoppedEnvelope.state.value, 99);
  assert.ok(
    events.indexOf('snapshot-barrier-end') < events.indexOf('quiesce:memory.snapshot-barrier'),
    'checkpoint snapshot must complete before quiesce begins',
  );
  assert.ok(
    events.indexOf('quiesce:memory.snapshot-barrier') < events.indexOf('snapshot-shutdown-capture'),
  );
  assert.equal(store.rows.get('memory.snapshot-barrier').state.value, 99);
  assert.equal(statusOf(host, 'memory.snapshot-barrier'), 'stopped');
}
