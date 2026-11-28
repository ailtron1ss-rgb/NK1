import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inflateRawSync } from 'node:zlib';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

test('a forced runtime flush commits one v2 envelope in the canonical Core checkpoint', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'nk1-runtime-checkpoint-revival-'));
  const stateFile = path.join(directory, 'organism.json');
  const runtime = new OrganismRuntime({
    stateFile,
    autoRun: false,
    enableLanguage: false,
    intervalMs: 5_000,
  });

  try {
    await runtime.init();
    await runtime.flush();

    const persisted = JSON.parse(await readFile(stateFile, 'utf8'));
    const envelope = persisted.system?.runtimeCheckpointEnvelope;

    assert.ok(envelope, 'the canonical Core file must contain a runtime checkpoint envelope after a forced flush');
    assert.equal(envelope.version, 2, 'new checkpoints must use the v2 manifest-bound schema');
    assert.equal(envelope.coreTick, persisted.state.tick,
      'the envelope and Core snapshot must be committed at the same logical tick');
    const worldPayload = JSON.parse(inflateRawSync(Buffer.from(envelope.owners.world.payloadBase64, 'base64')).toString('utf8'));
    assert.equal(envelope.worldTick, worldPayload.snapshot.tick,
      'the envelope must bind the captured World tick');

    const expectedOwners = ['cognitiveHealth', 'cognitiveSpine', 'openLoop', 'riskAwareRecovery', 'world'];
    assert.deepEqual(Object.keys(envelope.ownerHashes).sort(), expectedOwners,
      'one complete generation must carry all five runtime-owned state snapshots');
    assert.match(envelope.manifestHash, /^[a-f0-9]{64}$/,
      'the envelope manifest must be SHA-256 bound');
    assert.equal(envelope.journalOffset.version, 1,
      'the same checkpoint must include the durable OperationalJournal cursor');
    assert.equal(runtime.runtimeCheckpointDiagnostics().generation, envelope.generation,
      'runtime diagnostics must report the committed generation');
  } finally {
    await runtime.stop().catch(() => {});
    await rm(directory, { recursive: true, force: true });
  }
});
