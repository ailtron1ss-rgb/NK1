import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

test('stop closes and drains the continuity ledger after a canonical Core checkpoint failure', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'nk1-stop-cleanup-'));
  const stateFile = join(directory, 'organism.json');
  const runtime = new OrganismRuntime({
    stateFile,
    autoRun: false,
    enableLanguage: false,
    intervalMs: 5_000,
  });

  try {
    await runtime.init();
    await runtime.continuityLedger.record({
      at: 1_795_000_000_000,
      tick: 7,
      stage: 'shutdown-regression',
      action: 'checkpoint',
      energy01: 0.8,
      uncertainty01: 0.2,
      predictionError01: 0.1,
      selfPredictionError01: 0.1,
      identityContinuity01: 0.9,
      memoryCount: 3,
      goalCount: 1,
      stateBytes: 128,
      replaySignature: 'shutdown-cleanup-fixture',
    });
    await runtime.continuityLedger.flush();
    assert.equal(runtime.continuityLedger.diagnostics().open, true, 'fixture must own an open ledger handle');

    runtime.core.flush = async () => { throw new Error('simulated canonical core checkpoint failure'); };
    await assert.rejects(runtime.stop(), /simulated canonical core checkpoint failure/);

    assert.equal(
      runtime.continuityLedger.diagnostics().open,
      false,
      'stop must close the continuity ledger even when an earlier canonical checkpoint fails',
    );
    const persistedLines = await readFile(join(directory, 'organism.json.continuity.jsonl'), 'utf8');
    assert.match(persistedLines, /shutdown-cleanup-fixture/, 'the diagnostic ledger must be drained before it is closed');
  } finally {
    await runtime.continuityLedger.close();
    await rm(directory, { recursive: true, force: true });
  }
});
