import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AtomicFileSkillStorePersistence } from '../src/organism/learning/AtomicFileSkillStorePersistence.ts';

// Exercise file-store failure boundaries without pretending this replaces a
// multi-process / cross-platform crash test (those require real CI runners).
const root = mkdtempSync(join(tmpdir(), 'nk1-skill-store-failure-'));
try {
  const file = join(root, 'state', 'skills.json');
  const persistence = new AtomicFileSkillStorePersistence(file);
  const initial = persistence.read();
  assert.equal(initial.revision, 0);
  assert.equal(existsSync(file), true, 'first read atomically initializes durable state');

  const lockPath = file + '.lock';
  mkdirSync(join(root, 'state'), { recursive: true });
  const lockFd = openSync(lockPath, 'wx', 0o600);
  try {
    writeFileSync(lockFd, String(process.pid));
    assert.equal(persistence.compareAndSwap(0, {
      schemaVersion: 1, revision: 1, active: [], candidates: [],
    }), false, 'CAS fails closed while another live process owns the lock');
  } finally {
    closeSync(lockFd);
    rmSync(lockPath, { force: true });
  }

  assert.equal(persistence.compareAndSwap(0, {
    schemaVersion: 1, revision: 1, active: [], candidates: [],
  }), true, 'CAS succeeds after lock release');
  assert.equal(new AtomicFileSkillStorePersistence(file).read().revision, 1,
    'a reconstructed adapter observes the committed revision');

  // Outer arrays alone are not a valid snapshot: malformed nested skill records
  // must not be admitted after restart.
  writeFileSync(file, JSON.stringify({ schemaVersion: 1, revision: 1, active: [{}], candidates: [] }));
  assert.throws(() => persistence.read(), /invalid persisted versioned skill store snapshot/,
    'malformed active skill records fail closed');
  writeFileSync(file, JSON.stringify({ schemaVersion: 1, revision: 1, active: [], candidates: [{}] }));
  assert.throws(() => persistence.read(), /invalid persisted versioned skill store snapshot/,
    'malformed candidate lifecycle records fail closed');

  const zeros = '0'.repeat(64);
  writeFileSync(file, JSON.stringify({
    schemaVersion: 1, revision: 1,
    active: [{ skillId: 'demo', version: 1, payload: { changed: true }, payloadFingerprint: zeros, proposalId: zeros, activatedAt: 1 }],
    candidates: [],
  }));
  assert.throws(() => persistence.read(), /invalid persisted versioned skill store snapshot/,
    'payload edits cannot be hidden behind a stale active-skill fingerprint');
  writeFileSync(file, JSON.stringify({
    schemaVersion: 1, revision: 1, active: [],
    candidates: [{ candidateId: zeros, skillId: 'demo', version: 1, payload: { changed: true },
      payloadFingerprint: zeros, proposalId: zeros, proposalOutcomeFingerprint: zeros,
      baseVersion: null, previousActive: null, status: 'staged', shadowObservations: [], createdAt: 1 }],
  }));
  assert.throws(() => persistence.read(), /invalid persisted versioned skill store snapshot/,
    'payload edits cannot be hidden behind a stale candidate fingerprint');

  // CAS must reject malformed next state before it can replace durable data.
  assert.equal(persistence.compareAndSwap(1, {
    schemaVersion: 1, revision: 2, active: [{}], candidates: [],
  }), false, 'invalid nested records cannot be persisted through CAS');
  writeFileSync(file, JSON.stringify({ schemaVersion: 1, revision: 1, active: [], candidates: [] }));

  writeFileSync(file, '{"schemaVersion":1,"revision":"corrupt","active":[],"candidates":[]}');
  assert.throws(() => persistence.read(), /invalid persisted versioned skill store snapshot/,
    'corrupt schema/revision must fail closed instead of silently resetting state');

  writeFileSync(file, '{not-json');
  assert.throws(() => persistence.read(), SyntaxError,
    'malformed JSON must fail closed instead of silently overwriting state');
  console.log('P23_SKILL_STORE_FAILURE_BOUNDARIES=PASS');
} finally {
  rmSync(root, { recursive: true, force: true });
}
