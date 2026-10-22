import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import { VerifiedOutcomeLedgerFileStore } from '../src/organism/learning/VerifiedOutcomeLedgerFileStore.ts';

const dir = await mkdtemp(path.join(os.tmpdir(), 'nk-ledger-store-'));
try {
  const file = path.join(dir, 'evidence', 'ledger.json');
  const store = new VerifiedOutcomeLedgerFileStore(file);
  const ledger = new VerifiedOutcomeLedger([{
    taskId: 'task-file', family: 'memory', split: 'holdout',
    promptFingerprint: VerifiedOutcomeLedger.fingerprintPrompt('persist memory safely'),
    verifierId: 'verifier-v1', version: '1',
  }]);
  const result = ledger.record({
    taskId: 'task-file', taskVersion: '1', method: 'baseline', seed: 11, attempt: 1,
    passed: true, authority: 'independent-verifier', verifierId: 'verifier-v1',
    evidenceRef: 'artifact://external-run/11', observedAt: 1_800_000_000_000,
  });
  assert.equal(result.accepted, true);
  await store.save(ledger);
  const restored = await store.load();
  assert.deepEqual(restored.snapshot(), ledger.snapshot(), 'disk roundtrip must preserve all evidence state');
  assert.ok((await stat(file)).isFile());
  assert.match(await readFile(file, 'utf8'), /neuro-kurisu-verified-outcome-ledger/);

  await store.save(restored);
  assert.deepEqual((await store.load()).snapshot(), ledger.snapshot(), 'repeated atomic replacement must remain readable');

  const limited = new VerifiedOutcomeLedgerFileStore(path.join(dir, 'too-small.json'), 10);
  await assert.rejects(limited.save(ledger), /size limit/);
  const corrupt = path.join(dir, 'corrupt.json');
  const corruptStore = new VerifiedOutcomeLedgerFileStore(corrupt);
  await import('node:fs/promises').then(({ writeFile }) => writeFile(corrupt, '{"bad":true}', 'utf8'));
  await assert.rejects(corruptStore.load(), /unsupported|malformed|checksum/);
  console.log('P23_VERIFIED_OUTCOME_LEDGER_FILE_STORE=PASS');
} finally {
  await rm(dir, { recursive: true, force: true });
}
