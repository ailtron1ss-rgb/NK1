import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runArchitectureAudit } from '../scripts/audit-architecture.mjs';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function makeRuntimeFixture({ omit = [] } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nk1-completion-audit-'));
  const [owners, moduleMap] = await Promise.all([
    readFile(path.join(kitRoot, 'architecture/owners.json'), 'utf8').then(JSON.parse),
    readFile(path.join(kitRoot, 'architecture/module-map.json'), 'utf8').then(JSON.parse)
  ]);
  const required = new Set([
    ...moduleMap.requiredFiles,
    owners.compositionRoot,
    owners.runtimeEntrypoint,
    owners.cognitiveOwner,
    owners.subsystemRegistry,
    ...owners.owners.map(owner => owner.ownerFile)
  ]);
  for (const relative of required) {
    if (omit.includes(relative)) continue;
    const file = path.join(root, relative);
    await mkdir(path.dirname(file), { recursive: true });
    const isComposition = relative === owners.compositionRoot;
    const body = isComposition
      ? owners.owners.map(owner => path.basename(owner.ownerFile, path.extname(owner.ownerFile))).join('\n')
      : '// fixture';
    await writeFile(file, body);
  }
  return root;
}

test('architecture audit rejects modules labelled EXISTS when their source file is absent', async () => {
  const missingModule = 'src/organism/cognition/MetaCognitiveMonitor.ts';
  const root = await makeRuntimeFixture({ omit: [missingModule] });
  try {
    const report = await runArchitectureAudit({ root });
    assert.equal(report.pass, false);
    assert.ok(report.failures.some(item => item.startsWith('module-status-exists-but-file-missing:metacognition:')));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('architecture audit passes a complete static fixture with all EXISTS paths present', async () => {
  const root = await makeRuntimeFixture();
  try {
    const report = await runArchitectureAudit({ root });
    assert.equal(report.pass, true, report.failures.join('\n'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
