import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { lookupCameraCaptureReceipt, persistCameraCaptureReceipt, CameraCaptureOutcomeUncertainError } from '../src/organism/body/AndroidEmbodimentBridge.ts';

const root = await mkdtemp(path.join(os.tmpdir(), 'workpass45-camera-receipts-'));
const token = 'a'.repeat(64);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
try {
  // Metadata-only receipts survive restart even when the image itself is not retained.
  const captureBytes = Buffer.from('synthetic-camera-frame-for-receipt-contract');
  const noRetention = await persistCameraCaptureReceipt({
    idempotencyToken: token, cameraId: 0, retain: false, receiptDir: root,
    result: { ok: true, size: captureBytes.length, hash: sha(captureBytes) }, capturedAt: 123456,
  });
  assert.equal(noRetention.ok, true);
  assert.equal(noRetention.verified, true);
  assert.equal(noRetention.providerReceiptId, noRetention.receiptId);
  assert.equal(noRetention.retained, false);
  assert.equal(noRetention.path, undefined);
  const restored = await lookupCameraCaptureReceipt(token, 0, false, root);
  assert.equal(restored.status, 'found');
  if (restored.status === 'found') {
    assert.equal(restored.result.hash, sha(captureBytes));
    assert.equal(restored.result.capturedAt, 123456);
  }
  assert.equal((await lookupCameraCaptureReceipt(token, 1, false, root)).status, 'unknown', 'camera identity mismatch must fail closed');
  assert.equal((await lookupCameraCaptureReceipt(token, 0, true, root)).status, 'unknown', 'retention policy mismatch must fail closed');
  assert.equal((await lookupCameraCaptureReceipt('b'.repeat(64), 0, false, root)).status, 'unknown', 'missing receipt is ambiguous, not confirmed absence');

  // Exact idempotent re-persist is harmless; key reuse with a different payload is a conflict.
  const same = await persistCameraCaptureReceipt({ idempotencyToken: token, cameraId: 0, retain: false, receiptDir: root, result: { ok: true, size: captureBytes.length, hash: sha(captureBytes) }, capturedAt: 999999 });
  assert.equal(same.hash, noRetention.hash);
  await assert.rejects(
    () => persistCameraCaptureReceipt({ idempotencyToken: token, cameraId: 0, retain: false, receiptDir: root, result: { ok: true, size: captureBytes.length + 1, hash: sha(Buffer.from('changed-frame')) } }),
    error => error instanceof CameraCaptureOutcomeUncertainError && /key-conflict/.test(error.message),
  );

  // Retained image receipts are accepted only while the exact payload remains present and hash-matched.
  const token2 = 'c'.repeat(64);
  const cameraDir = path.join(root, 'neuro-kurisu-camera-fixture');
  await mkdir(cameraDir, { recursive: true });
  const imagePath = path.join(cameraDir, 'capture.jpg');
  const retainedBytes = Buffer.from([0xff, 0xd8, 0xff, 0x10, 0x20, 0x30, 0xff, 0xd9]);
  await writeFile(imagePath, retainedBytes);
  const retained = await persistCameraCaptureReceipt({ idempotencyToken: token2, cameraId: 1, retain: true, receiptDir: root, result: { ok: true, size: retainedBytes.length, hash: sha(retainedBytes), path: imagePath } });
  assert.equal(retained.retained, true);
  assert.equal((await lookupCameraCaptureReceipt(token2, 1, true, root)).status, 'found');
  await writeFile(imagePath, Buffer.from('corrupted'));
  const corrupted = await lookupCameraCaptureReceipt(token2, 1, true, root);
  assert.equal(corrupted.status, 'unknown');
  assert.match(corrupted.reason, /payload-mismatch/);

  // Damaged durable metadata is never upgraded into a provider-confirmed absence.
  const token3 = 'd'.repeat(64);
  await writeFile(path.join(root, `termux-camera-${token3}.json`), '{partial-json');
  const malformed = await lookupCameraCaptureReceipt(token3, 0, false, root);
  assert.equal(malformed.status, 'unknown');
  assert.match(malformed.reason, /invalid-json/);

  console.log(JSON.stringify({ ok: true, pass: 'workpass45-camera-receipt-store', scenarios: 5, result: 'durable receipt replay; operation-bound lookup; missing-as-unknown; conflicting key reuse; retained payload hash verification; malformed metadata fail-closed', hardwareExecuted: false }));
} finally {
  await rm(root, { recursive: true, force: true });
}
