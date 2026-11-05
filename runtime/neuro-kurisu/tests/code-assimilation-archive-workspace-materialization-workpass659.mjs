import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, statSync, writeFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createCodeAssimilationCandidate } from '../src/organism/learning/CodeAssimilationContracts.ts';
import { extractCodeAssimilationArchive } from '../src/organism/learning/CodeAssimilationArchiveExtraction.ts';

const module = await import('../src/organism/learning/CodeAssimilationArchiveWorkspace.ts').catch(() => ({}));
assert.equal(
  typeof module.materializeCodeAssimilationArchiveWorkspace,
  'function',
  'verified in-memory extraction must have a bounded disposable-workspace materializer',
);
const { materializeCodeAssimilationArchiveWorkspace } = module;

const sha256 = value => createHash('sha256').update(value).digest('hex');
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let crc = n;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
    }
    table[n] = crc >>> 0;
  }
  return table;
})();
const crc32 = bytes => {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

function makeStoredZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.path, 'utf8');
    const data = Buffer.from(entry.data, 'utf8');
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
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, data);

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
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt32LE((0x81a4 << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + data.length;
  }
  const centralBytes = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralBytes, end]);
}

function extractFixture() {
  const archive = makeStoredZip([
    { path: 'README.md', data: '# candidate source\n' },
    { path: 'src/organism/entry.ts', data: 'export const safe = true;\n' },
  ]);
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

// Real filesystem integration: only verified regular files are materialized, with private modes.
{
  const extraction = extractFixture();
  const workspace = await materializeCodeAssimilationArchiveWorkspace({ extraction });
  try {
    assert.deepEqual(workspace.filePaths, ['README.md', 'src/organism/entry.ts']);
    assert.equal(
      Buffer.from(await readFile(workspace.resolveFile('src/organism/entry.ts'))).toString('utf8'),
      'export const safe = true;\n',
    );
    assert.equal((statSync(workspace.resolveFile('src/organism/entry.ts')).mode & 0o777), 0o600);
    assert.equal((statSync(workspace.rootPath).mode & 0o077), 0);
    assert.equal(
      Buffer.from(await workspace.readFile('README.md')).toString('utf8'),
      '# candidate source\n',
    );
    const copy = await workspace.readFile('src/organism/entry.ts');
    copy[0] ^= 0xff;
    assert.equal(
      Buffer.from(await workspace.readFile('src/organism/entry.ts')).toString('utf8'),
      'export const safe = true;\n',
      'readFile must return detached bytes, never a mutable backing buffer',
    );
    assert.match(workspace.workspaceFingerprint, /^[a-f0-9]{64}$/);
    assert.equal(Object.isFrozen(workspace), true);
  } finally {
    const root = workspace.rootPath;
    await workspace.cleanup();
    await workspace.cleanup();
    assert.equal(existsSync(root), false, 'cleanup must be idempotent and remove the disposable tree');
  }
}

// A changed file on disk is detected instead of being returned as trusted candidate content.
{
  const workspace = await materializeCodeAssimilationArchiveWorkspace({ extraction: extractFixture() });
  try {
    writeFileSync(workspace.resolveFile('README.md'), 'tampered\n');
    await assert.rejects(
      workspace.readFile('README.md'),
      /workspace-file-integrity-mismatch/,
    );
  } finally {
    await workspace.cleanup();
  }
}

// Extraction payload bytes are re-hashed before any workspace is created.
{
  const extraction = extractFixture();
  const altered = Object.freeze({
    ...extraction,
    readFile(path) {
      const original = extraction.readFile(path);
      if (path !== 'README.md' || !original) return original;
      original[0] ^= 0xff;
      return original;
    },
  });
  await assert.rejects(
    materializeCodeAssimilationArchiveWorkspace({ extraction: altered }),
    /workspace-payload-digest-mismatch/,
  );
}

// A failed second payload read must not leave a partially materialized workspace.
{
  const extraction = extractFixture();
  const interrupted = Object.freeze({
    ...extraction,
    readFile(path) {
      if (path === 'src/organism/entry.ts') throw new Error('fixture-read-interrupted');
      return extraction.readFile(path);
    },
  });
  await assert.rejects(
    materializeCodeAssimilationArchiveWorkspace({ extraction: interrupted }),
    /fixture-read-interrupted/,
  );
}

console.log(JSON.stringify({
  ok: true,
  suite: 'code-assimilation-archive-workspace-materialization-workpass659',
  cases: 4,
}));
