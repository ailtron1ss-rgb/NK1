import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createCodeAssimilationCandidate } from '../src/organism/learning/CodeAssimilationContracts.ts';
import { preflightCodeAssimilationArchive } from '../src/organism/learning/CodeAssimilationArchivePreflight.ts';

const sha = value => createHash('sha256').update(value).digest('hex');
const archiveDigest = sha('immutable archive bytes');
const now = 1_800_000_000_000;

function candidateFor(sourceKind = 'archive') {
  return createCodeAssimilationCandidate({
    baseRuntimeSha: 'a'.repeat(40),
    createdAt: now,
    manifest: {
      componentId: 'memory.adapter',
      componentVersion: '1.0.0',
      capabilityId: 'memory.adapter',
      interfaceVersion: '1.0.0',
      language: 'TypeScript',
      runtime: 'node>=24',
      source: {
        sourceKind,
        canonicalUri: sourceKind === 'user-upload'
          ? `user-upload://sha256/${archiveDigest}`
          : 'https://github.com/example/memory-adapter/archive/abc123.tar.gz',
        publisher: 'example-org',
        immutableRevision: sourceKind === 'git' ? 'b'.repeat(40) : sourceKind === 'package' ? '1.2.3' : 'sha256:' + archiveDigest,
        contentSha256: archiveDigest,
        treeSha256: sha('expected extracted tree'),
        retrievedAt: now - 1000,
      },
      dependencyLockFingerprint: null,
      sbomFingerprint: null,
      declaredLicenseExpression: 'MIT',
    },
  });
}

const validEntries = () => [
  { path: 'src', kind: 'directory', compressedSizeBytes: 0, uncompressedSizeBytes: 0 },
  { path: 'src/index.ts', kind: 'file', compressedSizeBytes: 100, uncompressedSizeBytes: 300 },
  { path: 'README.md', kind: 'file', compressedSizeBytes: 50, uncompressedSizeBytes: 200 },
];

function preflight(entries = validEntries(), overrides = {}) {
  const candidate = overrides.candidate ?? candidateFor();
  return preflightCodeAssimilationArchive({
    candidate,
    archiveSha256: overrides.archiveSha256 ?? archiveDigest,
    archiveBytes: overrides.archiveBytes ?? 2048,
    parserId: overrides.parserId ?? 'isolated-tar-indexer',
    parserVersion: overrides.parserVersion ?? '1.2.0',
    entries,
    ...(overrides.limits ? { limits: overrides.limits } : {}),
  });
}

assert.equal(typeof preflightCodeAssimilationArchive, 'function');

const candidate = candidateFor();
const valid = preflight(validEntries(), { candidate });
assert.equal(valid.accepted, true);
assert.equal(valid.candidateId, candidate.candidateId);
assert.equal(valid.candidateFingerprint, candidate.candidateFingerprint);
assert.equal(valid.archiveSha256, archiveDigest);
assert.equal(valid.fileCount, 2);
assert.equal(valid.directoryCount, 1);
assert.equal(valid.totalCompressedBytes, 150);
assert.equal(valid.totalUncompressedBytes, 500);
assert.deepEqual(valid.entries.map(x => x.path), ['README.md', 'src', 'src/index.ts']);
assert.match(valid.reportFingerprint, /^[a-f0-9]{64}$/);
assert.match(valid.treeFingerprint, /^[a-f0-9]{64}$/);

// Large manifests must use bounded hierarchy work, not a full scan per file.
{
  const count = 1_200;
  const entries = Array.from({ length: count }, (_, index) => ({
    path: `assimilation-complexity/${String(index).padStart(4, '0')}.ts`,
    kind: 'file',
    compressedSizeBytes: 1,
    uncompressedSizeBytes: 1,
  }));
  const originalStartsWith = String.prototype.startsWith;
  let hierarchyPrefixComparisons = 0;
  String.prototype.startsWith = function (search, position) {
    if (typeof search === 'string' && originalStartsWith.call(search, 'assimilation-complexity/')) {
      hierarchyPrefixComparisons += 1;
    }
    return originalStartsWith.call(this, search, position);
  };
  try {
    preflight(entries, { archiveBytes: 2048 });
  } finally {
    String.prototype.startsWith = originalStartsWith;
  }
  assert.ok(
    hierarchyPrefixComparisons <= count * 32,
    `archive hierarchy validation exceeded its bounded parent-depth work: ${hierarchyPrefixComparisons} comparisons for ${count} files`,
  );
}

// Order does not change normalized tree identity.
{
  const a = preflight(validEntries(), { candidate });
  const b = preflight(validEntries().reverse(), { candidate });
  assert.equal(a.treeFingerprint, b.treeFingerprint);
  assert.equal(a.reportFingerprint, b.reportFingerprint);
}

// Archive hash must match the candidate's immutable source digest.
assert.throws(() => preflight(validEntries(), { candidate, archiveSha256: 'f'.repeat(64) }), /archive-digest-mismatch/);
assert.throws(() => preflight(validEntries(), { candidate: candidateFor('git') }), /source-kind-not-archive/);
assert.throws(() => preflight(validEntries(), { candidate: candidateFor('package') }), /source-kind-not-archive/);

// Traversal, absolute, platform-specific and ambiguous paths are rejected.
for (const badPath of [
  '../escape.txt',
  'src/../../escape.txt',
  '/etc/passwd',
  '//server/share/file',
  'C:/Windows/system.ini',
  'C:\\Windows\\system.ini',
  'src//double.ts',
  'src/./relative.ts',
  'src/../escape.ts',
  'src/file.ts:stream',
  'src/trailing./file.ts',
  'src/trailing /file.ts',
  'src/CON.txt',
  'src/NUL',
  'src/with?wildcard.ts',
  'src/with*wildcard.ts',
  'src/with\\backslash.ts',
]) {
  assert.throws(
    () => preflight([{ path: badPath, kind: 'file', compressedSizeBytes: 1, uncompressedSizeBytes: 1 }]),
    /path/,
    badPath,
  );
}

// Unicode/case normalization collisions cannot silently overwrite files.
{
  const entries = [
    { path: 'src/Ａ.ts', kind: 'file', compressedSizeBytes: 1, uncompressedSizeBytes: 1 },
    { path: 'src/A.ts', kind: 'file', compressedSizeBytes: 1, uncompressedSizeBytes: 1 },
  ];
  assert.throws(() => preflight(entries), /duplicate-normalized-path/);
}
{
  const entries = [
    { path: 'src/Readme.md', kind: 'file', compressedSizeBytes: 1, uncompressedSizeBytes: 1 },
    { path: 'src/README.md', kind: 'file', compressedSizeBytes: 1, uncompressedSizeBytes: 1 },
  ];
  assert.throws(() => preflight(entries), /duplicate-casefold-path/);
}
{
  const entries = [
    { path: 'src', kind: 'file', compressedSizeBytes: 1, uncompressedSizeBytes: 1 },
    { path: 'src/index.ts', kind: 'file', compressedSizeBytes: 1, uncompressedSizeBytes: 1 },
  ];
  assert.throws(() => preflight(entries), /file-parent-conflict/);
}
{
  const entries = [
    { path: 'src', kind: 'directory', compressedSizeBytes: 0, uncompressedSizeBytes: 0 },
    { path: 'src/index.ts', kind: 'file', compressedSizeBytes: 1, uncompressedSizeBytes: 1 },
    { path: 'src/index.ts/child', kind: 'file', compressedSizeBytes: 1, uncompressedSizeBytes: 1 },
  ];
  assert.throws(() => preflight(entries), /file-parent-conflict/);
}

// Non-regular archive entries are never accepted for extraction into a code workspace.
for (const kind of ['symlink', 'hardlink', 'fifo', 'block-device', 'character-device', 'socket', 'unknown']) {
  assert.throws(
    () => preflight([{ path: 'src/link', kind, compressedSizeBytes: 0, uncompressedSizeBytes: 0 }]),
    /(entry-kind|non-regular)/,
    kind,
  );
}

// Nested archives are quarantined rather than recursively expanded.
for (const path of ['vendor/deps.zip', 'vendor/data.tar.gz', 'vendor/packed.whl', 'fixtures/test.7z']) {
  assert.throws(
    () => preflight([{ path, kind: 'file', compressedSizeBytes: 10, uncompressedSizeBytes: 20 }]),
    /nested-archive/,
    path,
  );
}

// Resource limits reject bombs, excessive entries, excessive depth and oversized files.
assert.throws(
  () => preflight([{ path: 'large.bin', kind: 'file', compressedSizeBytes: 10, uncompressedSizeBytes: 1_000_000 }]),
  /compression-ratio/,
);
assert.throws(
  () => preflight([{ path: 'large.bin', kind: 'file', compressedSizeBytes: 1, uncompressedSizeBytes: 2_000_000 }], { limits: { maxFileBytes: 1_000_000 } }),
  /file-size-limit/,
);
assert.throws(
  () => preflight([{ path: 'src/' + Array.from({ length: 40 }, (_, i) => `d${i}`).join('/') + '/file.ts', kind: 'file', compressedSizeBytes: 1, uncompressedSizeBytes: 1 }]),
  /path-depth-limit/,
);
assert.throws(
  () => preflight(validEntries(), { limits: { maxEntries: 2 } }),
  /entry-count-limit/,
);
assert.throws(
  () => preflight(validEntries(), { limits: { maxTotalExpandedBytes: 100 } }),
  /expanded-size-limit/,
);
assert.throws(
  () => preflight(validEntries(), { archiveBytes: 100 }),
  /archive-size-mismatch/,
);
assert.throws(
  () => preflight(validEntries(), { archiveBytes: 300_000_000 }),
  /archive-size-limit/,
);

// Invalid numeric metadata and directory/file size confusion fail closed.
for (const value of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
  assert.throws(
    () => preflight([{ path: 'bad.bin', kind: 'file', compressedSizeBytes: value, uncompressedSizeBytes: 1 }]),
    /size-invalid/,
  );
}
for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
  assert.throws(
    () => preflight([{ path: 'bad.bin', kind: 'file', compressedSizeBytes: value, uncompressedSizeBytes: 1 }]),
    /input-untrusted/,
  );
}
assert.throws(
  () => preflight([{ path: 'src', kind: 'directory', compressedSizeBytes: 1, uncompressedSizeBytes: 0 }]),
  /directory-size-invalid/,
);
assert.throws(
  () => preflight([{ path: 'empty-compressed.bin', kind: 'file', compressedSizeBytes: 0, uncompressedSizeBytes: 10 }]),
  /zero-compressed-size/,
);
assert.throws(
  () => preflight([{ path: 'bad.bin', kind: 'file', compressedSizeBytes: 5000, uncompressedSizeBytes: 1 }], { archiveBytes: 2048 }),
  /archive-size-mismatch/,
);

// Archive metadata is untrusted input: getters, proxies and sparse arrays are rejected.
{
  let getterCalls = 0;
  const entry = { kind: 'file', compressedSizeBytes: 1, uncompressedSizeBytes: 1 };
  Object.defineProperty(entry, 'path', {
    enumerable: true,
    get() { getterCalls += 1; return 'safe.txt'; },
  });
  assert.throws(() => preflight([entry]), /input-untrusted/);
  assert.equal(getterCalls, 0);
}
{
  const entries = new Array(2);
  entries[1] = { path: 'safe.txt', kind: 'file', compressedSizeBytes: 1, uncompressedSizeBytes: 1 };
  assert.throws(() => preflight(entries), /input-untrusted/);
}
{
  const entries = new Proxy(validEntries(), {
    ownKeys() { throw new Error('archive-entry-proxy'); },
  });
  assert.throws(() => preflight(entries), /proxy|untrusted|plain-data/i);
}

console.log(JSON.stringify({
  ok: true,
  suite: 'code-assimilation-archive-preflight-workpass657',
  groups: 18,
  candidateId: candidate.candidateId,
  treeFingerprint: valid.treeFingerprint,
}));
