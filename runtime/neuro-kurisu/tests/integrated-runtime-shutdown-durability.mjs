import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

const makeRuntime = async (options = {}) => {
  const directory = await mkdtemp(join(tmpdir(), 'nk1-integrated-stop-'));
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
  if (options.ledgerFlush) {
    runtime.continuityLedger.flush = async () => {
      phases.push('ledger-flush');
      return options.ledgerFlush();
    };
  }
  if (options.ledgerDiagnostics) {
    runtime.continuityLedger.diagnostics = options.ledgerDiagnostics;
  }
  if (options.ledgerClose) {
    runtime.continuityLedger.close = options.ledgerClose;
  }
  return { runtime, directory, entries, phases };
};

const diagnostics = (warning = null) => () => ({
  open: true,
  pendingLines: 0,
  pendingBytes: 0,
  recoveredTailBytes: 0,
  retentionDroppedFrames: 0,
  lastError: null,
  lastDurabilityWarning: warning,
});

test('stop reports partial durability when ContinuityLedger flush rejects', async () => {
  const { runtime, directory, entries } = await makeRuntime({
    ledgerFlush: async () => { throw new Error('injected-continuity-flush-failure'); },
    ledgerClose: async () => {},
  });
  try {
    await runtime.stop();
    const stop = entries.find(entry => entry.event === 'runtime.stop.partial');
    assert.ok(stop, 'shutdown must not claim durability after a failed journal flush');
    assert.equal(stop.level, 'warn');
    assert.equal(stop.data.overall, 'partial');
    assert.equal(stop.data.durability.continuityLedger, 'failed');
    assert.equal(entries.some(entry => entry.event === 'runtime.stop.durable'), false);
  } finally {
    await runtime.continuityLedger.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('stop reports partial durability when ledger compaction cannot sync its directory entry', async () => {
  const { runtime, directory, entries } = await makeRuntime({
    ledgerFlush: async () => {},
    ledgerDiagnostics: diagnostics('directory-fsync-failed'),
    ledgerClose: async () => {},
  });
  try {
    await runtime.stop();
    const stop = entries.find(entry => entry.event === 'runtime.stop.partial');
    assert.ok(stop, 'a directory durability warning must not be reported as a complete checkpoint');
    assert.equal(stop.data.durability.continuityLedger, 'failed');
    assert.equal(stop.data.overall, 'partial');
  } finally {
    await runtime.continuityLedger.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('stop emits the full durability receipt only after the continuity ledger flush', async () => {
  const { runtime, directory, entries, phases } = await makeRuntime({
    ledgerFlush: async () => {},
    ledgerDiagnostics: diagnostics(null),
    ledgerClose: async () => {},
  });
  // This fixture models a successful canonical Core commit. A no-op flush alone
  // must not be mistaken for a committed envelope in the production boundary.
  const committedEnvelope = { generation: 1, checkpointId: 'shutdown-test-envelope-0001' };
  runtime.core.systemSnapshot = () => ({ runtimeCheckpointEnvelope: committedEnvelope });
  runtime.core.validateRuntimeCheckpointEnvelope = value => value === committedEnvelope
    ? { ok: true, envelope: committedEnvelope, snapshots: { cognitiveHealth: null } }
    : { ok: false, reason: 'fixture-envelope-not-committed' };
  try {
    await runtime.stop();
    const stop = entries.find(entry => entry.event === 'runtime.stop.durable');
    assert.ok(stop, 'successful canonical and diagnostic saves should retain the durable event');
    assert.equal(stop.data.overall, 'durable');
    assert.equal(stop.data.durability.core, 'durable');
    assert.equal(stop.data.durability.world, 'durable');
    assert.equal(stop.data.durability.continuityLedger, 'durable');
    assert.ok(
      phases.indexOf('ledger-flush') >= 0 &&
      phases.indexOf('ledger-flush') < phases.indexOf('runtime.stop.durable'),
      'the final success receipt must be written after the continuity flush',
    );
    assert.equal(entries.some(entry => entry.event === 'runtime.stop.partial'), false);
  } finally {
    await runtime.continuityLedger.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('stop closes and drains ContinuityLedger when canonical Core flush fails', async () => {
  const { runtime, directory } = await makeRuntime({
    coreFlush: async () => { throw new Error('injected-canonical-core-failure'); },
  });
  try {
    const makeFrame = (tick, signature) => ({
      at: 1_800_000_000_000 + tick,
      tick,
      stage: 'shutdown-regression',
      action: 'reflect',
      energy01: 0.8,
      uncertainty01: 0.2,
      predictionError01: 0.1,
      selfPredictionError01: 0.1,
      identityContinuity01: 0.99,
      memoryCount: 3,
      goalCount: 1,
      stateBytes: 128,
      replaySignature: signature,
    });
    await runtime.continuityLedger.record(makeFrame(1, 'already-flushed'));
    await runtime.continuityLedger.flush();
    await runtime.continuityLedger.record(makeFrame(2, 'buffered-before-stop'));
    assert.equal(runtime.continuityLedger.diagnostics().pendingLines, 1);
    await assert.rejects(runtime.stop(), /injected-canonical-core-failure/);
    assert.equal(runtime.continuityLedger.diagnostics().open, false);
    assert.equal(runtime.continuityLedger.diagnostics().pendingLines, 0);
    const persisted = await readFile(join(directory, 'organism.continuity.jsonl'), 'utf8');
    assert.match(persisted, /already-flushed/);
    assert.match(persisted, /buffered-before-stop/);
  } finally {
    await runtime.continuityLedger.close();
    await rm(directory, { recursive: true, force: true });
  }
});

console.log('INTEGRATED_RUNTIME_SHUTDOWN_DURABILITY=PASS');
