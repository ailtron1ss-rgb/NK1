import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { FileHostObservationNonceStore } from '../src/organism/system/FileHostObservationNonceStore.ts';

const root = await mkdtemp(join(tmpdir(), 'nk1-host-nonce-store-'));
const baseKey = (overrides = {}) => ({
  issuerId: 'nk1-android-host',
  deviceId: 'android-test-01',
  sessionId: 'session-2026-11-27-a',
  nonce: 'nonce-abcdefghijklmnopqrstuvwxyz-01',
  receiptDigest: 'a'.repeat(64),
  retainUntil: 2_000,
  ...overrides,
});

try {
  {
    let now = 1_000;
    const directoryPath = join(root, 'restart');
    const first = new FileHostObservationNonceStore({ directoryPath, now: () => now });
    assert.equal(await first.consume(baseKey()), true);
    const restarted = new FileHostObservationNonceStore({ directoryPath, now: () => now });
    assert.equal(await restarted.consume(baseKey()), false);
    assert.equal(await restarted.hasConsumed(baseKey()), true);
    assert.equal(await restarted.hasConsumed(baseKey({ receiptDigest: 'b'.repeat(64) })), false);
    assert.equal(await restarted.hasConsumed(baseKey({ retainUntil: 2_001 })), false);
  }

  {
    const directoryPath = join(root, 'concurrent');
    const stores = Array.from({ length: 12 }, () => new FileHostObservationNonceStore({ directoryPath }));
    const results = await Promise.all(stores.map((store) => store.consume(baseKey({
      nonce: 'nonce-single-winner-concurrency-01',
      receiptDigest: 'c'.repeat(64),
      retainUntil: Date.now() + 60_000,
    }))));
    assert.equal(results.filter(Boolean).length, 1);
    assert.equal(results.filter((value) => value === false).length, 11);
  }

  {
    const directoryPath = join(root, 'clock-rollback');
    let now = 1_000;
    const store = new FileHostObservationNonceStore({ directoryPath, now: () => now });
    const key = baseKey({ nonce: 'nonce-clock-high-water-00000001', retainUntil: 2_000 });
    assert.equal(await store.consume(key), true);
    now = 2_500;
    assert.equal(await store.hasConsumed(key), false);
    now = 1_500;
    const restarted = new FileHostObservationNonceStore({ directoryPath, now: () => now });
    assert.equal(await restarted.hasConsumed(key), false);
    assert.equal(await restarted.consume(key), false);
  }

  {
    const directoryPath = join(root, 'corrupt-clock');
    const markerDay = new Date().toISOString().slice(0, 10);
    await mkdir(join(directoryPath, 'clock-days'), { recursive: true });
    await writeFile(join(directoryPath, 'clock-days', markerDay), '{"version":1,"day":"forged","createdAt":0}', { mode: 0o600 });
    const corrupt = new FileHostObservationNonceStore({ directoryPath });
    await assert.rejects(corrupt.consume(baseKey()), /nonce-store-clock-marker-invalid/);
  }

  {
    const directoryPath = join(root, 'invalid-keys');
    const store = new FileHostObservationNonceStore({ directoryPath });
    await assert.rejects(store.consume(baseKey({ nonce: 'short' })), /nonce-store-key-invalid/);
    await assert.rejects(store.hasConsumed(baseKey({ receiptDigest: 'not-a-digest' })), /nonce-store-key-invalid/);
    let getterInvoked = false;
    const accessorKey = baseKey();
    Object.defineProperty(accessorKey, 'nonce', { get() { getterInvoked = true; return 'nonce-accessor-must-not-run-01'; } });
    await assert.rejects(store.consume(accessorKey), /nonce-store-key-invalid/);
    assert.equal(getterInvoked, false);
    let proxyTrapInvoked = false;
    const proxyKey = new Proxy(baseKey(), { ownKeys() { proxyTrapInvoked = true; throw new Error('proxy trap'); } });
    await assert.rejects(store.consume(proxyKey), /nonce-store-key-invalid/);
    assert.equal(proxyTrapInvoked, false);
  }

  {
    const directoryPath = join(root, 'tampered-records');
    const key = baseKey({ nonce: 'nonce-tampered-record-0000001', retainUntil: Date.now() + 60_000 });
    const digest = createHash('sha256').update(JSON.stringify([key.issuerId, key.deviceId, key.sessionId, key.nonce])).digest('hex');
    const shard = join(directoryPath, 'nonces', digest.slice(0, 2));
    await mkdir(shard, { recursive: true });
    await writeFile(join(shard, digest + '.json'), '{"version":1,"tupleDigest":"forged"}', { mode: 0o600 });
    const tampered = new FileHostObservationNonceStore({ directoryPath });
    await assert.rejects(tampered.consume(key), /nonce-store-record-invalid/);
  }
  if (process.platform !== 'win32') {
    {
      const directoryPath = join(root, 'insecure-directory');
      await mkdir(directoryPath, { recursive: true, mode: 0o755 });
      const insecure = new FileHostObservationNonceStore({ directoryPath });
      await assert.rejects(insecure.consume(baseKey({
        nonce: 'nonce-insecure-directory-mode-0001',
        retainUntil: Date.now() + 60_000,
      })), /nonce-store-directory-permissions-invalid/,
      'a pre-existing world/group-accessible nonce directory must be rejected');
    }
    {
      const directoryPath = join(root, 'insecure-clock-file');
      const day = new Date().toISOString().slice(0, 10);
      await mkdir(join(directoryPath, 'clock-days'), { recursive: true, mode: 0o700 });
      await mkdir(join(directoryPath, 'clock-timestamps'), { recursive: true, mode: 0o700 });
      await mkdir(join(directoryPath, 'nonces'), { recursive: true, mode: 0o700 });
      await writeFile(join(directoryPath, 'clock-days', day),
        JSON.stringify({ version: 1, day, createdAt: Date.now() }), { mode: 0o644 });
      const insecure = new FileHostObservationNonceStore({ directoryPath });
      await assert.rejects(insecure.consume(baseKey({
        nonce: 'nonce-insecure-file-mode-0000001',
        retainUntil: Date.now() + 60_000,
      })), /nonce-store-file-permissions-invalid/,
      'a pre-existing world-readable clock marker must be rejected');
    }
  }

  console.log('FILE_HOST_OBSERVATION_NONCE_STORE=PASS restart+race+digest+clock+corruption+tamper');
} finally {
  await rm(root, { recursive: true, force: true });
}
