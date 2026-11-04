import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createCodeAssimilationCandidate } from '../src/organism/learning/CodeAssimilationContracts.ts';
import { extractCodeAssimilationArchive } from '../src/organism/learning/CodeAssimilationArchiveExtraction.ts';
import { materializeCodeAssimilationArchive } from '../src/organism/learning/CodeAssimilationArchiveWorkspace.ts';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let crc = n;
    for (let k = 0; k < 8; k += 1) crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
    table[n] = crc >>> 0;
  }
  return table;
})();
const crc32 = value => {
  let crc = 0xffffffff;
  for (const byte of value) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

function makeStoredZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.path, 'utf8');
    const isDirectory = entry.kind === 'directory';
    const data = Buffer.from(isDirectory ? '' : (entry.data ?? ''));
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    const mode = isDirectory ? 0x41ed : 0x81a4;
    central.writeUInt32LE((mode << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += local.length + name.length + data.length;
  }
  const centralBytes = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBytes, end]);
}

function extractionFor(entries) {
  const archive = makeStoredZip(entries);
  const digest = sha256(archive);
  const candidate = createCodeAssimilationCandidate({
    baseRuntimeSha: 'a'.repeat(40),
    createdAt: 1_800_000_000_000,
    manifest: {
      componentId: 'archive.workspace-fixture',
      componentVersion: '1.0.0',
      capabilityId: 'archive.workspace',
      interfaceVersion: '1.0.0',
      language: 'TypeScript',
      runtime: 'node>=22',
      source: {
        sourceKind: 'user-upload',
        canonicalUri: `user-upload://sha256/${digest}`,
        publisher: 'local-fixture',
        immutableRevision: digest,
        contentSha256: digest,
        treeSha256: sha256('workspace-fixture-tree'),
        retrievedAt: 1_799_999_999_000,
      },
      dependencyLockFingerprint: null,
      sbomFingerprint: null,
      declaredLicenseExpression: 'MIT',
    },
  });
  return extractCodeAssimilationArchive({
    candidate,
    archiveBytes: archive,
    parserId: 'nk1-zip',
    parserVersion: '1.0.0',
  });
}

const tempWorkspaceNames = () => readdirSync(os.tmpdir())
  .filter(name => name.startsWith('nk1-code-assimilation-'))
  .sort();

// Materialized output is readable, private, hash-verifiable, and removed by its owner.
{
  const extraction = extractionFor([
    { path: 'src/', kind: 'directory' },
    { path: 'src/index.ts', data: 'export const answer = 42;\n' },
    { path: 'docs/readme.txt', data: 'quarantined only\n' },
  ]);
  const workspace = materializeCodeAssimilationArchive(extraction);
  try {
    assert.deepEqual(workspace.files.map(file => file.path), ['docs/readme.txt', 'src/index.ts']);
    assert.equal(readFileSync(path.join(workspace.rootDirectory, 'src/index.ts'), 'utf8'), 'export const answer = 42;\n');
    assert.equal(readFileSync(path.join(workspace.rootDirectory, 'docs/readme.txt'), 'utf8'), 'quarantined only\n');
    assert.equal(lstatSync(workspace.rootDirectory).isDirectory(), true);
    assert.equal(lstatSync(workspace.rootDirectory).isSymbolicLink(), false);
    assert.deepEqual(workspace.verifyIntegrity(), { verified: true, filesChecked: 2 });

    writeFileSync(path.join(workspace.rootDirectory, 'src/index.ts'), 'tampered\n');
    assert.throws(() => workspace.verifyIntegrity(), /file-digest-mismatch/);
  } finally {
    workspace.cleanup();
    workspace.cleanup();
  }
  assert.equal(existsSync(workspace.rootDirectory), false);
}

// A copied/fabricated extraction-shaped object cannot mint a trusted workspace.
{
  const extraction = extractionFor([{ path: 'safe.ts', data: 'trusted bytes' }]);
  const forged = Object.freeze({
    schemaVersion: extraction.schemaVersion,
    accepted: extraction.accepted,
    preflight: extraction.preflight,
    filePaths: extraction.filePaths,
    files: extraction.files,
    extractionFingerprint: extraction.extractionFingerprint,
    readFile: extraction.readFile,
  });
  const before = tempWorkspaceNames();
  assert.throws(() => {
    const unintended = materializeCodeAssimilationArchive(forged);
    unintended.cleanup();
  }, /extraction-not-authenticated/);
  assert.deepEqual(tempWorkspaceNames(), before);
}

// An OS-level path-component failure after directory creation rolls back the whole temp workspace.
{
  const longSegment = 'x'.repeat(260) + '.ts';
  const extraction = extractionFor([
    { path: 'partial/', kind: 'directory' },
    { path: `partial/${longSegment}`, data: 'payload' },
  ]);
  const before = tempWorkspaceNames();
  assert.throws(() => materializeCodeAssimilationArchive(extraction), /materialization-failed/);
  assert.deepEqual(tempWorkspaceNames(), before);
}

console.log(JSON.stringify({
  ok: true,
  suite: 'code-assimilation-archive-workspace-workpass659',
  cases: 3,
}));
