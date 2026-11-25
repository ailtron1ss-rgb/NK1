import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  SourceCandidateWorkspaceV1,
  hashSourceCandidateTextV1,
} from '../src/organism/analysis/SourceCandidateWorkspace.ts';

const baseSha = '9008a8982a5173304456bee2c604bd0bc8665964';
const original = [
  { path: 'runtime/neuro-kurisu/src/example.mjs', content: 'export const value = 1;\n' },
  { path: 'README.md', content: '# NK1 baseline\n' },
];
const updated = 'export const value = 2;\n';
const newText = 'export const candidateOnly = true;\n';
const edits = [
  {
    path: 'runtime/neuro-kurisu/src/example.mjs',
    expectedBeforeSha256: hashSourceCandidateTextV1(original[0].content),
    replacement: updated,
  },
  {
    path: 'runtime/neuro-kurisu/src/candidate-only.mjs',
    expectedBeforeSha256: null,
    createIfMissing: true,
    replacement: newText,
  },
];

const accept = async request => ({
  accepted: true,
  receiptId: 'host-receipt-' + request.editSetSha256.slice(0, 24),
  baseSha: request.baseSha,
  editSetSha256: request.editSetSha256,
});

const temp = await mkdtemp(path.join(os.tmpdir(), 'nk1-source-candidate-'));
try {
  const workspace = new SourceCandidateWorkspaceV1({
    workspaceRoot: path.join(temp, 'candidates'),
    authorize: accept,
  });
  const result = await workspace.prepare({ baseSha, files: original, edits });
  assert.equal(result.created, true, result.reason);
  assert.equal(result.status, 'materialized');
  assert.equal(result.executionStatus, 'not-executed');
  assert.match(result.candidateId, /^[a-f0-9]{32}$/);
  assert.equal(await readFile(path.join(result.candidateRoot, 'runtime/neuro-kurisu/src/example.mjs'), 'utf8'), updated);
  assert.equal(await readFile(path.join(result.candidateRoot, 'runtime/neuro-kurisu/src/candidate-only.mjs'), 'utf8'), newText);
  assert.equal(await readFile(path.join(result.candidateRoot, 'README.md'), 'utf8'), original[1].content);
  const manifest = JSON.parse(await readFile(result.manifestPath, 'utf8'));
  assert.equal(manifest.status, 'materialized');
  assert.equal(manifest.executionStatus, 'not-executed');
  assert.equal(manifest.baseSha, baseSha);
  assert.equal(manifest.admissionReceiptId, 'host-receipt-' + result.editSetSha256.slice(0, 24));
  assert.equal(manifest.changedFiles.length, 2);
  assert.ok(/^[a-f0-9]{64}$/.test(manifest.beforeTreeSha256));
  assert.ok(/^[a-f0-9]{64}$/.test(manifest.candidateTreeSha256));
  assert.equal(original[0].content, 'export const value = 1;\n',
    'the caller-owned canonical snapshot must remain unchanged');

  // A content-addressed retry must never replace an already materialized candidate.
  const collision = await workspace.prepare({ baseSha, files: original, edits });
  assert.equal(collision.created, false);
  assert.equal(collision.reason, 'candidate-workspace-already-exists');
  assert.equal(await readFile(path.join(result.candidateRoot, 'runtime/neuro-kurisu/src/example.mjs'), 'utf8'), updated);

  // Input ordering must not change the content-addressed candidate identity.
  const reordered = await workspace.prepare({
    baseSha,
    files: [...original].reverse(),
    edits: [...edits].reverse(),
  });
  assert.equal(reordered.created, false);
  assert.equal(reordered.reason, 'candidate-workspace-already-exists');
  assert.equal(reordered.candidateId, result.candidateId);
} finally {
  await rm(temp, { recursive: true, force: true });
}

{
  let authorizeCalls = 0;
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'nk1-source-candidate-tamper-'));
  try {
    const badFiles = [{ ...original[0], sha256: '0'.repeat(64) }];
    const workspace = new SourceCandidateWorkspaceV1({
      workspaceRoot: path.join(workspaceRoot, 'out'),
      authorize: async () => { authorizeCalls++; return { accepted: true }; },
    });
    const result = await workspace.prepare({ baseSha, files: badFiles, edits });
    assert.equal(result.created, false);
    assert.equal(result.reason, 'source-snapshot-hash-mismatch');
    assert.equal(authorizeCalls, 0, 'host admission must not run on an untrusted/tampered snapshot');
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

{
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'nk1-source-candidate-paths-'));
  try {
    const workspace = new SourceCandidateWorkspaceV1({ workspaceRoot: path.join(workspaceRoot, 'out'), authorize: accept });
    for (const badPath of ['../escape.mjs', '/absolute.mjs', 'C:\\outside.mjs', 'src\\backslash.mjs', '.git/config', 'node_modules/pkg/index.js', 'candidate-receipt.json']) {
      const result = await workspace.prepare({
        baseSha,
        files: original,
        edits: [{ path: badPath, expectedBeforeSha256: null, createIfMissing: true, replacement: 'unsafe' }],
      });
      assert.equal(result.created, false, badPath);
      assert.equal(result.reason, 'invalid-source-path', badPath);
    }
    for (const reservedPath of ['candidate-receipt.json', '.candidate-receipt-shadow.tmp']) {
      let admissionCalls = 0;
      const guarded = new SourceCandidateWorkspaceV1({
        workspaceRoot: path.join(workspaceRoot, 'reserved-' + reservedPath.length),
        authorize: async request => {
          admissionCalls += 1;
          return accept(request);
        },
      });
      const result = await guarded.prepare({
        baseSha,
        files: [...original, { path: reservedPath, content: 'must-not-shadow-the-manifest' }],
        edits,
      });
      assert.equal(result.created, false, reservedPath);
      assert.equal(result.reason, 'invalid-source-path', reservedPath);
      assert.equal(admissionCalls, 0, 'reserved source paths must be rejected before host admission');
    }

    const duplicate = await workspace.prepare({
      baseSha,
      files: original,
      edits: [
        { ...edits[0] },
        { ...edits[0], replacement: 'different content' },
      ],
    });
    assert.equal(duplicate.created, false);
    assert.equal(duplicate.reason, 'duplicate-edit-path');
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

{
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'nk1-source-candidate-admission-'));
  try {
    const rejected = new SourceCandidateWorkspaceV1({
      workspaceRoot: path.join(workspaceRoot, 'out'),
      authorize: async () => ({ accepted: false, reason: 'host-evidence-insufficient' }),
    });
    const result = await rejected.prepare({ baseSha, files: original, edits });
    assert.equal(result.created, false);
    assert.equal(result.reason, 'host-evidence-insufficient');
    assert.deepEqual(await readdir(path.join(workspaceRoot, 'out')).catch(() => []), []);

    const mismatched = new SourceCandidateWorkspaceV1({
      workspaceRoot: path.join(workspaceRoot, 'mismatch'),
      authorize: async request => ({
        accepted: true,
        receiptId: 'wrong-binding',
        baseSha: '0'.repeat(40),
        editSetSha256: request.editSetSha256,
      }),
    });
    const mismatch = await mismatched.prepare({ baseSha, files: original, edits });
    assert.equal(mismatch.created, false);
    assert.equal(mismatch.reason, 'host-admission-binding-mismatch');
    assert.deepEqual(await readdir(path.join(workspaceRoot, 'mismatch')).catch(() => []), []);
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}

console.log('SOURCE_CANDIDATE_WORKSPACE_V1=PASS');


// Portable-path aliases must be rejected before host admission. Linux accepts
// these spellings as distinct files, while common Windows/macOS filesystems may
// resolve them to the same entry (case folding / Unicode normalization).
{
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'nk1-source-candidate-portable-paths-'));
  try {
    let admissionCalls = 0;
    const guarded = new SourceCandidateWorkspaceV1({
      workspaceRoot: path.join(workspaceRoot, 'out'),
      authorize: async request => {
        admissionCalls += 1;
        return accept(request);
      },
    });
    const aliases = [
      [
        { path: 'src/Foo.ts', content: 'one' },
        { path: 'src/foo.ts', content: 'two' },
      ],
      [
        { path: 'src/café.ts', content: 'one' },
        { path: 'src/cafe\u0301.ts', content: 'two' },
      ],
    ];
    for (const files of aliases) {
      const result = await guarded.prepare({
        baseSha,
        files,
        edits: [{ path: 'src/new.ts', expectedBeforeSha256: null, createIfMissing: true, replacement: 'new' }],
      });
      assert.equal(result.created, false);
      assert.equal(result.reason, 'source-path-alias-collision');
    }
    for (const badPath of [
      'src/CON', 'src/nul.txt', 'src/LPT1.log',
      'src/stream.txt:payload', 'src/trailing-dot./file.ts',
      'src/trailing-space /file.ts',
    ]) {
      const result = await guarded.prepare({
        baseSha,
        files: original,
        edits: [{ path: badPath, expectedBeforeSha256: null, createIfMissing: true, replacement: 'unsafe' }],
      });
      assert.equal(result.created, false, badPath);
      assert.equal(result.reason, 'invalid-source-path', badPath);
    }
    const caseMismatch = await guarded.prepare({
      baseSha,
      files: original,
      edits: [{
        path: 'runtime/neuro-kurisu/src/Example.mjs',
        expectedBeforeSha256: hashSourceCandidateTextV1(original[0].content),
        replacement: 'case alias',
      }],
    });
    assert.equal(caseMismatch.created, false);
    assert.equal(caseMismatch.reason, 'source-edit-path-alias-mismatch');
    assert.equal(admissionCalls, 0, 'portable path conflicts must be rejected before host admission');
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}


// File/directory prefix collisions cannot be represented in a materialized tree.
// Reject both malformed snapshots and edits that introduce an ancestor collision.
{
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'nk1-source-candidate-ancestor-paths-'));
  try {
    let admissionCalls = 0;
    const guarded = new SourceCandidateWorkspaceV1({
      workspaceRoot: path.join(workspaceRoot, 'out'),
      authorize: async request => {
        admissionCalls += 1;
        return accept(request);
      },
    });
    const snapshotCollision = await guarded.prepare({
      baseSha,
      files: [
        { path: 'src/module', content: 'file' },
        { path: 'src/module/index.ts', content: 'child' },
      ],
      edits: [{ path: 'src/new.ts', expectedBeforeSha256: null, createIfMissing: true, replacement: 'new' }],
    });
    assert.equal(snapshotCollision.created, false);
    assert.equal(snapshotCollision.reason, 'source-path-ancestor-collision');

    const editCollision = await guarded.prepare({
      baseSha,
      files: [{ path: 'src/module/index.ts', content: 'child' }],
      edits: [{
        path: 'src/module',
        expectedBeforeSha256: null,
        createIfMissing: true,
        replacement: 'file replacing directory',
      }],
    });
    assert.equal(editCollision.created, false);
    assert.equal(editCollision.reason, 'candidate-path-ancestor-collision');
    assert.equal(admissionCalls, 0, 'unmaterializable path trees must be rejected before host admission');
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
}
