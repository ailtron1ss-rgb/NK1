import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

const makeRuntime = async (options = {}) => {
  const directory = await mkdtemp(join(tmpdir(), 'neurocore-stop-durability-'));
  const entries = [];
  const phases = [];
  const runtime = new OrganismRuntime({
    stateFile: join(directory, 'organism.json'),
    autoRun: false,
    enableLanguage: false,
    intervalMs: 5_000,
    journal: {
      write: async (level, event, data) => {
        phases.push(event);
        entries.push({ level, event, data });
      },
    },
  });
  runtime.core.runtimeClosureOperationalSnapshot = () => ({
    tick: 4,
    replaySignature: 'runtime-signature-4',
    continuous: { tick: 4, processed: 4 },
    memoryCount: 2,
  });
  runtime.core.setRuntimeClosure = () => {};
  runtime.core.flush = options.coreFlush ?? (async () => { phases.push('core-flush'); });
  runtime.clockScheduler.stop = () => {};
  runtime.clockScheduler.drain = async () => {};
  if (options.ledgerFlush) runtime.continuityLedger.flush = options.ledgerFlush;
  if (options.ledgerDiagnostics) runtime.continuityLedger.diagnostics = options.ledgerDiagnostics;
  if (options.ledgerClose) runtime.continuityLedger.close = options.ledgerClose;
  if (options.worldCheckpoint) runtime.checkpointWorld = options.worldCheckpoint;
  if (options.cognitiveSpine) runtime.persistCognitiveSpineSchedule = options.cognitiveSpine;
  if (options.riskAwareRecovery) runtime.persistRiskAwareRecovery = options.riskAwareRecovery;
  return { runtime, directory, entries, phases };
};

const cleanLedger = () => ({
  open: false,
  pendingLines: 0,
  pendingBytes: 0,
  recoveredTailBytes: 0,
  retentionDroppedFrames: 0,
  lastError: null,
  lastDurabilityWarning: null,
});

test('does not emit a durable receipt when the continuity journal flush fails', async () => {
  const { runtime, directory, entries } = await makeRuntime({
    ledgerFlush: async () => { throw new Error('injected-continuity-flush-failure'); },
    ledgerDiagnostics: cleanLedger,
    ledgerClose: async () => {},
  });
  try {
    await assert.rejects(runtime.stop(), /injected-continuity-flush-failure/);
    const stop = entries.find(entry => entry.event === 'runtime.stop.partial');
    assert.ok(stop);
    assert.equal(stop.level, 'warn');
    assert.equal(stop.data.overall, 'partial');
    assert.equal(stop.data.durability.continuityLedger, 'failed');
    assert.equal(entries.some(entry => entry.event === 'runtime.stop.durable'), false);
  } finally {
    await runtime.continuityLedger.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('preserves the original continuity journal close failure without adding a duplicate generic error', async () => {
  const { runtime, directory, entries } = await makeRuntime({
    ledgerFlush: async () => {},
    ledgerDiagnostics: cleanLedger,
    ledgerClose: async () => { throw new Error('injected-continuity-close-failure'); },
  });
  try {
    await assert.rejects(runtime.stop(), /injected-continuity-close-failure/);
    const stop = entries.find(entry => entry.event === 'runtime.stop.partial');
    assert.ok(stop);
    assert.equal(stop.data.overall, 'partial');
    assert.equal(stop.data.durability.continuityLedger, 'failed');
    assert.equal(entries.some(entry => entry.event === 'runtime.stop.durable'), false);
  } finally {
    await runtime.continuityLedger.close().catch(() => {});
    await rm(directory, { recursive: true, force: true });
  }
});

test('a directory durability warning produces a partial shutdown receipt', async () => {
  const { runtime, directory, entries } = await makeRuntime({
    ledgerFlush: async () => {},
    ledgerDiagnostics: () => ({ ...cleanLedger(), lastDurabilityWarning: 'directory-fsync-failed' }),
    ledgerClose: async () => {},
  });
  try {
    await assert.rejects(runtime.stop(), /continuity-ledger-durability-unconfirmed/);
    const stop = entries.find(entry => entry.event === 'runtime.stop.partial');
    assert.ok(stop);
    assert.equal(stop.data.durability.continuityLedger, 'failed');
  } finally {
    await runtime.continuityLedger.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('a cognitive-spine sidecar failure produces a partial durability receipt', async () => {
  const { runtime, directory, entries } = await makeRuntime({
    ledgerFlush: async () => {},
    ledgerDiagnostics: cleanLedger,
    ledgerClose: async () => {},
    cognitiveSpine: async () => false,
  });
  try {
    await assert.rejects(runtime.stop(), /cognitive-spine-durability-unconfirmed/);
    const stop = entries.find(entry => entry.event === 'runtime.stop.partial');
    assert.ok(stop);
    assert.equal(stop.data.durability.core, 'durable');
    assert.equal(stop.data.durability.cognitiveSpine, 'failed');
    assert.equal(stop.data.durability.riskAwareRecovery, 'durable');
    assert.equal(stop.data.durability.continuityLedger, 'durable');
    assert.equal(entries.some(entry => entry.event === 'runtime.stop.durable'), false);
  } finally {
    await runtime.continuityLedger.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('a risk-aware recovery sidecar failure produces a partial durability receipt', async () => {
  const { runtime, directory, entries } = await makeRuntime({
    ledgerFlush: async () => {},
    ledgerDiagnostics: cleanLedger,
    ledgerClose: async () => {},
    riskAwareRecovery: async () => false,
  });
  try {
    await assert.rejects(runtime.stop(), /risk-aware-recovery-durability-unconfirmed/);
    const stop = entries.find(entry => entry.event === 'runtime.stop.partial');
    assert.ok(stop);
    assert.equal(stop.data.durability.core, 'durable');
    assert.equal(stop.data.durability.cognitiveSpine, 'durable');
    assert.equal(stop.data.durability.riskAwareRecovery, 'failed');
    assert.equal(stop.data.durability.continuityLedger, 'durable');
    assert.equal(entries.some(entry => entry.event === 'runtime.stop.durable'), false);
  } finally {
    await runtime.continuityLedger.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('the complete durability receipt is emitted only after Core, world and ledger persistence', async () => {
  const { runtime, directory, entries, phases } = await makeRuntime({
    ledgerFlush: async () => { phases.push('ledger-flush'); },
    ledgerDiagnostics: cleanLedger,
    ledgerClose: async () => { phases.push('ledger-close'); },
  });
  try {
    await runtime.stop();
    const stop = entries.find(entry => entry.event === 'runtime.stop.durable');
    assert.ok(stop);
    assert.equal(stop.data.overall, 'durable');
    assert.equal(stop.data.durability.core, 'durable');
    assert.equal(stop.data.durability.world, 'durable');
    assert.equal(stop.data.durability.continuityLedger, 'durable');
    assert.ok(phases.indexOf('ledger-flush') < phases.indexOf('runtime.stop.durable'));
    assert.ok(phases.indexOf('ledger-close') < phases.indexOf('runtime.stop.durable'));
    assert.equal(entries.some(entry => entry.event === 'runtime.stop.partial'), false);
  } finally {
    await runtime.continuityLedger.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('Core flush failure still closes the ledger and reports partial durability', async () => {
  const { runtime, directory, entries, phases } = await makeRuntime({
    coreFlush: async () => { phases.push('core-flush'); throw new Error('injected-core-flush-failure'); },
    ledgerFlush: async () => { phases.push('ledger-flush'); },
    ledgerDiagnostics: cleanLedger,
    ledgerClose: async () => { phases.push('ledger-close'); },
  });
  try {
    await assert.rejects(runtime.stop(), /injected-core-flush-failure/);
    const stop = entries.find(entry => entry.event === 'runtime.stop.partial');
    assert.ok(stop);
    assert.equal(stop.data.durability.core, 'failed');
    assert.equal(stop.data.durability.continuityLedger, 'durable');
    assert.ok(phases.includes('ledger-close'));
    assert.equal(entries.some(entry => entry.event === 'runtime.stop.durable'), false);
  } finally {
    await runtime.continuityLedger.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('world checkpoint failure cannot be hidden by a successful Core and ledger flush', async () => {
  const { runtime, directory, entries } = await makeRuntime({
    ledgerFlush: async () => {},
    ledgerDiagnostics: cleanLedger,
    ledgerClose: async () => {},
    worldCheckpoint: async () => { throw new Error('injected-world-checkpoint-failure'); },
  });
  try {
    await assert.rejects(runtime.stop(), /injected-world-checkpoint-failure/);
    const stop = entries.find(entry => entry.event === 'runtime.stop.partial');
    assert.ok(stop);
    assert.equal(stop.data.durability.core, 'durable');
    assert.equal(stop.data.durability.world, 'failed');
    assert.equal(stop.data.durability.continuityLedger, 'durable');
  } finally {
    await runtime.continuityLedger.close();
    await rm(directory, { recursive: true, force: true });
  }
});

console.log('RUNTIME_STOP_DURABILITY=PASS');