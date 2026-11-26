import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

async function withRuntime(options, run) {
  const directory = await mkdtemp(join(tmpdir(), 'nk1-runtime-shutdown-'));
  const entries = [];
  const worldWrites = [];
  const runtime = new OrganismRuntime({
    stateFile: join(directory, 'organism.json'),
    autoRun: false,
    enableLanguage: false,
    intervalMs: 5_000,
    worldStateStore: {
      load: async () => null,
      save: async state => { worldWrites.push(state); await options.worldSave?.(state); },
    },
    cognitiveSpineStore: {
      save: options.cognitiveSpineSave ?? (async () => {}),
    },
    riskAwareRecoveryStore: {
      save: options.riskAwareRecoverySave ?? (async () => {}),
    },
    journal: {
      write: async (level, event, data) => { entries.push({ level, event, data }); },
    },
  });

  // Isolate the shutdown contract from unrelated persistence implementations.
  runtime.core.runtimeClosureOperationalSnapshot = () => ({
    tick: 4,
    replaySignature: 'runtime-signature-4',
    continuous: { tick: 4, processed: 4 },
    memoryCount: 2,
  });
  runtime.core.setRuntimeClosure = () => {};
  runtime.core.flush = options.coreFlush ?? (async () => {});
  runtime.clockScheduler.stop = () => {};
  runtime.clockScheduler.drain = async () => {};
  runtime.continuityLedger.flush = options.continuityLedgerFlush ?? (async () => {});
  runtime.continuityLedger.close = async () => {};

  try {
    await run({ runtime, entries, worldWrites });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('stop records partial durability when an optional checkpoint sidecar fails', async () => {
  await withRuntime({
    cognitiveSpineSave: async () => { throw new Error('simulated sidecar disk failure'); },
  }, async ({ runtime, entries, worldWrites }) => {
    await runtime.stop();

    assert.equal(worldWrites.length, 1, 'world owner must still be flushed');
    const stop = entries.find(entry => entry.event === 'runtime.stop.partial');
    assert.ok(stop, 'shutdown must not claim full durability after a sidecar write failure');
    assert.equal(stop.level, 'warn');
    assert.deepEqual(stop.data.durability, {
      core: 'durable',
      world: 'durable',
      cognitiveSpine: 'failed',
      riskAwareRecovery: 'durable',
    });
    assert.equal(stop.data.overall, 'partial');
    assert.equal(entries.some(entry => entry.event === 'runtime.stop.durable'), false);
  });
});

test('stop records full durability only when core, world and both sidecars complete', async () => {
  await withRuntime({}, async ({ runtime, entries, worldWrites }) => {
    await runtime.stop();

    assert.equal(worldWrites.length, 1);
    const stop = entries.find(entry => entry.event === 'runtime.stop.durable');
    assert.ok(stop, 'fully successful shutdown should retain the durable event');
    assert.equal(stop.level, 'info');
    assert.deepEqual(stop.data.durability, {
      core: 'durable',
      world: 'durable',
      cognitiveSpine: 'durable',
      riskAwareRecovery: 'durable',
    });
    assert.equal(stop.data.overall, 'durable');
    assert.equal(entries.some(entry => entry.event === 'runtime.stop.partial'), false);
  });
});

test('stop remains fail-fast when the canonical Core flush fails', async () => {
  await withRuntime({
    coreFlush: async () => { throw new Error('simulated core disk failure'); },
  }, async ({ runtime, entries, worldWrites }) => {
    await assert.rejects(runtime.stop(), /simulated core disk failure/);
    assert.equal(worldWrites.length, 0, 'World flush must not be reported after Core durability fails');
    assert.equal(entries.some(entry => entry.event === 'runtime.stop.durable' || entry.event === 'runtime.stop.partial'), false);
  });
});

test('stop remains fail-fast when the canonical World checkpoint fails', async () => {
  await withRuntime({
    worldSave: async () => { throw new Error('simulated world disk failure'); },
  }, async ({ runtime, entries, worldWrites }) => {
    await assert.rejects(runtime.stop(), /simulated world disk failure/);
    assert.equal(worldWrites.length, 1, 'World checkpoint must be attempted');
    assert.equal(entries.some(entry => entry.event === 'runtime.stop.durable' || entry.event === 'runtime.stop.partial'), false);
  });
});

test('stop records partial durability when the diagnostic continuity ledger flush fails', async () => {
  await withRuntime({
    continuityLedgerFlush: async () => { throw new Error('simulated continuity ledger disk failure'); },
  }, async ({ runtime, entries, worldWrites }) => {
    await runtime.stop();

    assert.equal(worldWrites.length, 1, 'core and world persistence should still finish');
    const stop = entries.find(entry => entry.event === 'runtime.stop.partial');
    assert.ok(stop, 'a failed continuity ledger flush must not be reported as fully durable');
    assert.equal(stop.level, 'warn');
    assert.deepEqual(stop.data.durability, {
      core: 'durable',
      world: 'durable',
      cognitiveSpine: 'durable',
      riskAwareRecovery: 'durable',
      continuityLedger: 'failed',
    });
    assert.equal(stop.data.overall, 'partial');
    assert.equal(entries.some(entry => entry.event === 'runtime.stop.durable'), false);
  });
});
