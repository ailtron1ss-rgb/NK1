import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { deflateRawSync } from 'node:zlib';
import { createCodeAssimilationCandidate } from '../src/organism/learning/CodeAssimilationContracts.ts';
import { extractCodeAssimilationArchive } from '../src/organism/learning/CodeAssimilationArchiveExtraction.ts';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();
const crc32 = value => {
  let crc = 0xffffffff;
  for (const byte of value) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

function makeZip(entries) {
  const locals = [];
  const centrals = [];
  const offsets = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.path, 'utf8');
    const data = Buffer.from(entry.data ?? '');
    const method = entry.method ?? 8;
    const compressed = method === 8 ? deflateRawSync(data) : data;
    const crc = crc32(data);
    const flags = entry.flags ?? 0x0800;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, compressed);
    offsets.push({ localOffset: offset, dataOffset: offset + 30 + name.length, path: entry.path });
    offset += local.length + name.length + compressed.length;

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4); // Unix host, version 2.0
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt32LE(0, 38);
    const fileMode = entry.mode ?? 0x81a4; // regular file, 0644
    central.writeUInt32LE((fileMode << 16) >>> 0, 38);
    central.writeUInt32LE(offsets.at(-1).localOffset, 42);
    centrals.push(central, name);
  }
  const centralBytes = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return { bytes: Buffer.concat([...locals, centralBytes, end]), offsets };
}

function candidateFor(archive) {
  const digest = sha256(archive);
  return createCodeAssimilationCandidate({
    baseRuntimeSha: 'a'.repeat(40),
    createdAt: 1_800_000_000_000,
    manifest: {
      componentId: 'archive.extraction-fixture',
      componentVersion: '1.0.0',
      capabilityId: 'archive.extract',
      interfaceVersion: '1.0.0',
      language: 'TypeScript',
      runtime: 'node>=22',
      source: {
        sourceKind: 'user-upload',
        canonicalUri: `user-upload://sha256/${digest}`,
        publisher: 'local-fixture',
        immutableRevision: digest,
        contentSha256: digest,
        treeSha256: sha256('fixture-tree'),
        retrievedAt: 1_799_999_999_000,
      },
      dependencyLockFingerprint: null,
      sbomFingerprint: null,
      declaredLicenseExpression: 'MIT',
    },
  });
}

const extract = archive => extractCodeAssimilationArchive({
  candidate: candidateFor(archive),
  archiveBytes: archive,
  parserId: 'nk1-zip',
  parserVersion: '1.0.0',
});

// Valid stored and deflated files are read back from an immutable in-memory quarantine snapshot.
{
  const zip = makeZip([
    { path: 'README.md', data: '# quarantined source\n', method: 0 },
    { path: 'src/module.ts', data: 'export const answer = 42;\n', method: 8 },
  ]);
  const result = extract(zip.bytes);
  assert.equal(result.accepted, true);
  assert.equal(result.schemaVersion, 1);
  assert.deepEqual(result.filePaths, ['README.md', 'src/module.ts']);
  assert.equal(result.files.length, 2);
  assert.equal(result.preflight.entryCount, 2);
  assert.equal(Buffer.from(result.readFile('README.md')).toString('utf8'), '# quarantined source\n');
  assert.equal(Buffer.from(result.readFile('src/module.ts')).toString('utf8'), 'export const answer = 42;\n');
  assert.equal(result.readFile('../outside.ts'), null);
  const firstRead = result.readFile('src/module.ts');
  firstRead[0] ^= 0xff;
  assert.equal(Buffer.from(result.readFile('src/module.ts')).toString('utf8'), 'export const answer = 42;\n');
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.files), true);
  assert.match(result.extractionFingerprint, /^[a-f0-9]{64}$/);
}

// The exact source archive digest is rechecked before any extraction occurs.
{
  const zip = makeZip([{ path: 'source.ts', data: 'const safe = true;\n', method: 0 }]);
  const candidate = candidateFor(zip.bytes);
  const changed = Buffer.from(zip.bytes);
  changed[zip.offsets[0].dataOffset] ^= 1;
  assert.throws(() => extractCodeAssimilationArchive({
    candidate, archiveBytes: changed, parserId: 'nk1-zip', parserVersion: '1.0.0',
  }), /archive-digest-mismatch/);
}

// Central-directory path policy is applied to actual archive names, not caller-supplied metadata.
for (const path of ['../escape.ts', '/absolute.ts', 'C:/drive.ts', 'src\\\\escape.ts']) {
  const zip = makeZip([{ path, data: 'x', method: 0 }]);
  assert.throws(() => extract(zip.bytes), /path-(traversal|absolute|backslash)/, path);
}

// Unix symlinks and unsupported compression/encryption are rejected before content is exposed.
{
  const zip = makeZip([{ path: 'link.ts', data: 'target', method: 0, mode: 0xa1ff }]);
  assert.throws(() => extract(zip.bytes), /non-regular-entry-forbidden/);
}
{
  const zip = makeZip([{ path: 'secret.ts', data: 'secret', method: 0, flags: 0x0801 }]);
  assert.throws(() => extract(zip.bytes), /encrypted-entry-forbidden/);
}
{
  const zip = makeZip([{ path: 'unsupported.ts', data: 'x', method: 12 }]);
  assert.throws(() => extract(zip.bytes), /compression-method-unsupported/);
}

// Actual expanded bytes must satisfy the central-directory size and CRC, not merely its declaration.
{
  const zip = makeZip([{ path: 'checksum.txt', data: 'verified payload', method: 0 }]);
  const corrupt = Buffer.from(zip.bytes);
  corrupt[zip.offsets[0].dataOffset] ^= 1;
  assert.throws(() => extract(corrupt), /crc-mismatch/);
}

// Duplicate and case-folded aliases cannot become distinct workspace files.
{
  const zip = makeZip([
    { path: 'src/Module.ts', data: 'a', method: 0 },
    { path: 'src/module.ts', data: 'b', method: 0 },
  ]);
  assert.throws(() => extract(zip.bytes), /duplicate-casefold-path/);
}

console.log(JSON.stringify({
  ok: true,
  suite: 'code-assimilation-archive-extraction-workpass658',
  cases: 7,
}));
