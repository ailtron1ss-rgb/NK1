import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';
import { FileStateStore } from '../src/organism/persistence/FileStateStore.ts';
import { WorldEnvironment } from '../src/organism/world/WorldEnvironment.ts';
import { CognitiveImmuneSystem } from '../src/organism/cognition/CognitiveImmuneSystem.ts';
import { validateRuntimeCheckpointEnvelope } from '../src/organism/system/RuntimeCheckpointEnvelope.ts';

const owners = ['world', 'openLoop', 'cognitiveSpine', 'riskAwareRecovery', 'cognitiveHealth'];

function faultingStore(filePath, owner) {
  const backing = new FileStateStore(filePath);
  let failNext = false;
  return {
    backing,
    store: {
      load: () => backing.load(),
      save: async (value) => {
        if (failNext) {
          failNext = false;
          throw new Error(`injected-${owner}-projection-failure`);
        }
        return backing.save(value);
      },
    },
    failOnce() { failNext = true; },
  };
}

async function runOwnerFailure(owner) {
  const directory = await mkdtemp(path.join(os.tmpdir(), `nk-runtime-checkpoint-${owner}-`));
  const stateFile = path.join(directory, 'organism.json');
  const worldStateFile = path.join(directory, 'world.json');
  const stores = {
    world: faultingStore(worldStateFile, 'world'),
    openLoop: faultingStore(path.join(directory, 'open-loops.json'), 'openLoop'),
    cognitiveSpine: faultingStore(path.join(directory, 'cognitive-spine.json'), 'cognitiveSpine'),
    riskAwareRecovery: faultingStore(path.join(directory, 'risk-aware-recovery.json'), 'riskAwareRecovery'),
    cognitiveHealth: faultingStore(path.join(directory, 'cognitive-health.json'), 'cognitiveHealth'),
  };
  const journalEvents = [];
  const journal = { write: async (level, event, data) => journalEvents.push({ level, event, data }) };
  let runtime;
  try {
    await stores.world.backing.save(new WorldEnvironment().persisted());
    runtime = new OrganismRuntime({
      stateFile,
      worldStateFile,
      enableLanguage: false,
      autoRun: false,
      cognitiveHealthSystem: new CognitiveImmuneSystem(),
      worldStateStore: stores.world.store,
      openLoopStore: stores.openLoop.store,
      cognitiveSpineStore: stores.cognitiveSpine.store,
      riskAwareRecoveryStore: stores.riskAwareRecovery.store,
      cognitiveHealthStore: stores.cognitiveHealth.store,
      journal,
    });
    await runtime.init();

    // Not every owner changes in this scenario; compare each failed sidecar to
    // its own pre-failure state rather than assuming all snapshots differ.
    const sidecarBeforeFailure = await stores[owner].backing.load();
    runtime.environment.commit(runtime.environment.simulate('move'));
    stores[owner].failOnce();
    const obligation = await runtime.registerOpenLoop({
      title: `projection failure ${owner}`,
      description: 'The accepted obligation must survive a sidecar projection failure',
      kind: 'task',
      owner: 'user',
      accepted: true,
      source: `runtime-checkpoint-fault-matrix:${owner}`,
    });
    assert.ok(obligation?.id, `${owner}: Core commit must still return the accepted obligation`);

    const committed = JSON.parse(await readFile(stateFile, 'utf8'));
    const envelope = committed.system?.runtimeCheckpointEnvelope;
    assert.ok(envelope, `${owner}: failed projection must not invalidate the canonical Core commit`);
    const validation = validateRuntimeCheckpointEnvelope(envelope);
    assert.equal(validation.ok, true, `${owner}: Core must contain one complete, verifiable generation`);
    assert.ok(validation.snapshots.openLoop.records.some(record => record.id === obligation.id),
      `${owner}: accepted OpenLoop mutation must be inside the canonical generation`);

    const diagnostic = runtime.runtimeCheckpointDiagnostics();
    assert.ok(Array.isArray(diagnostic.projectionFailures),
      'runtime diagnostics must expose the pending per-owner projection failures');
    assert.ok(diagnostic.projectionFailures.some(item => item.owner === owner && item.generation === envelope.generation),
      `${owner}: diagnostics must retain the failed projection and its generation`);
    assert.ok(journalEvents.some(item => item.event === 'runtime.checkpoint-envelope.projection-failed' && item.data?.owner === owner),
      `${owner}: projection failure must be logged without exposing raw owner payloads`);
    assert.deepEqual(await stores[owner].backing.load(), sidecarBeforeFailure,
      `${owner}: the injected failure must leave the sidecar exactly at its pre-failure state`);

    // The next normal Core checkpoint must retry pending projections, not treat a
    // failed write as a successful sidecar checkpoint or wait for process restart.
    runtime.core.markRuntimeCheckpointDirty();
    await runtime.core.flush();
    const retried = JSON.parse(await readFile(stateFile, 'utf8'));
    const retriedValidation = validateRuntimeCheckpointEnvelope(retried.system?.runtimeCheckpointEnvelope);
    assert.equal(retriedValidation.ok, true, `${owner}: retried generation must remain valid`);
    assert.deepEqual(await stores[owner].backing.load(), retriedValidation.snapshots[owner],
      `${owner}: retry must rebuild the failed projection from the committed generation`);
    assert.equal(runtime.runtimeCheckpointDiagnostics().projectionFailures.length, 0,
      `${owner}: successful retry must clear the outstanding projection failure`);

    console.log(JSON.stringify({
      owner,
      failedProjectionRecorded: true,
      canonicalGenerationSurvived: envelope.generation,
      retryGeneration: retriedValidation.envelope.generation,
      projectionRepaired: true,
    }));
  } finally {
    if (runtime) await runtime.stop().catch(() => {});
    await rm(directory, { recursive: true, force: true });
  }
}

async function invalidEnvelopeMustNotUseLegacySidecars() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'nk-runtime-invalid-envelope-'));
  const stateFile = path.join(directory, 'organism.json');
  const worldStateFile = path.join(directory, 'world.json');
  const world = new FileStateStore(worldStateFile);
  const journal = { write: async () => {} };
  let writer;
  try {
    await world.save(new WorldEnvironment().persisted());
    const createRuntime = () => new OrganismRuntime({
      stateFile,
      worldStateFile,
      enableLanguage: false,
      autoRun: false,
      cognitiveHealthSystem: new CognitiveImmuneSystem(),
      worldStateStore: world,
      journal,
    });
    writer = createRuntime();
    await writer.init();
    writer.environment.commit(writer.environment.simulate('move'));
    await writer.registerOpenLoop({
      title: 'invalid envelope guard',
      description: 'A corrupt canonical generation must not fall back to independent sidecars',
      kind: 'task', owner: 'user', accepted: true, source: 'runtime-checkpoint-invalid-envelope-test',
    });
    await writer.stop().catch(() => {});
    writer = null;
    const validPersisted = JSON.parse(await readFile(stateFile, 'utf8'));
    assert.ok(validPersisted.system?.runtimeCheckpointEnvelope, 'test setup must produce a canonical envelope');
    const hashMismatch = structuredClone(validPersisted.system.runtimeCheckpointEnvelope);
    hashMismatch.ownerHashes.world = '0'.repeat(64);
    const invalidCases = [
      { label: 'owner hash mismatch', envelope: hashMismatch },
      { label: 'explicit null', envelope: null },
      { label: 'string envelope', envelope: 'not-a-checkpoint-envelope' },
      { label: 'array envelope', envelope: [] },
      { label: 'numeric envelope', envelope: 42 },
    ];

    for (const invalidCase of invalidCases) {
      const corruptedPersisted = structuredClone(validPersisted);
      corruptedPersisted.system.runtimeCheckpointEnvelope = invalidCase.envelope;
      await writeFile(stateFile, JSON.stringify(corruptedPersisted));
      await world.save({
        ...new WorldEnvironment().persisted(),
        snapshot: { ...new WorldEnvironment().snapshot(), location: 'poisoned-legacy-sidecar' },
      });

      // A present but invalid canonical generation must reject before the legacy
      // owner sidecars can be applied.
      const rejectedRuntime = createRuntime();
      await assert.rejects(
        rejectedRuntime.init(),
        /runtime-checkpoint-envelope-present-but-unrecoverable:/,
        `${invalidCase.label}: a present but invalid envelope must fail initialization rather than restore mixed legacy sidecars`,
      );
      assert.notEqual(rejectedRuntime.environment.snapshot().location, 'poisoned-legacy-sidecar',
        `${invalidCase.label}: legacy World sidecar must not apply while a canonical envelope is present`);
    }
    console.log(JSON.stringify({
      invalidEnvelopeRejected: invalidCases.map(item => item.label),
      legacySidecarFallbackBlocked: true,
    }));
  } finally {
    if (writer) await writer.stop().catch(() => {});
    await rm(directory, { recursive: true, force: true });
  }
}

for (const owner of owners) await runOwnerFailure(owner);
await invalidEnvelopeMustNotUseLegacySidecars();
console.log('runtime-checkpoint-projection-fault-matrix: PASS (5 owners + 5 malformed-envelope cases)');
