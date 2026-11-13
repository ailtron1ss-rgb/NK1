import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {
  auditSourceAssimilation,
  REQUIRED_ARCHIVE_SOURCES,
  SOURCE_ASSIMILATION_ADAPTERS,
} from '../scripts/audit-source-assimilation.mjs';

const repositoryRoot = await mkdtemp(path.join(tmpdir(), 'nk1-source-assimilation-'));
try {
  const files = new Map();
  for (const adapter of SOURCE_ASSIMILATION_ADAPTERS) {
    for (const item of adapter.groups) {
      const key = item.file;
      const prior = files.get(key) ?? [];
      files.set(key, [...prior, ...item.needles]);
    }
  }
  for (const [file, needles] of files) {
    const target = path.join(repositoryRoot, 'runtime', 'neuro-kurisu', file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, [...new Set(needles)].join('\n') + '\n');
  }

  const register = [
    ...REQUIRED_ARCHIVE_SOURCES,
    'Polyform Shield',
    'CC BY 4.0',
    'корневой LICENSE',
  ].join('\n');
  const registerPath = path.join(repositoryRoot, 'docs', 'SOURCE_ASSIMILATION_REGISTER_2026-11-13_RU.md');
  await mkdir(path.dirname(registerPath), { recursive: true });
  await writeFile(registerPath, register);

  const clean = await auditSourceAssimilation(repositoryRoot);
  assert.equal(clean.summary.gaps, 0, 'complete static fixture must pass');
  assert.equal(clean.summary.adaptersComplete, SOURCE_ASSIMILATION_ADAPTERS.length);
  assert.equal(clean.summary.contractTestFilesPresent, clean.summary.contractTestFilesExpected);
  assert.equal(clean.summary.sourceNamesPresent, REQUIRED_ARCHIVE_SOURCES.length);
  assert.equal(clean.summary.executedTests, false, 'static audit must never claim tests were executed');

  const hexisComposition = path.join(repositoryRoot, 'runtime', 'neuro-kurisu', 'src/organism/core/OrganismSystemFabric.ts');
  const originalComposition = await readFile(hexisComposition, 'utf8');
  await writeFile(hexisComposition, originalComposition.replace('new HexisAdaptationFabric()', 'new DetachedHexisAdapter()'));
  const broken = await auditSourceAssimilation(repositoryRoot);
  assert.ok(broken.summary.gaps > 0, 'removing a composition edge must be detected');
  const hexis = broken.adapters.find(adapter => adapter.id === 'hexis');
  assert.equal(hexis.status, 'GAP');
  assert.ok(hexis.groups.find(item => item.id === 'system-composition')?.missing.includes('new HexisAdaptationFabric()'));

  await writeFile(hexisComposition, originalComposition);
  await writeFile(registerPath, register.replace('CAMEL OWL', 'unlicensed-source-placeholder'));
  const missingSource = await auditSourceAssimilation(repositoryRoot);
  assert.ok(missingSource.sourceRegister.missingSources.includes('CAMEL OWL'));

  console.log('SOURCE_ASSIMILATION_AUDIT_TEST=PASS');
} finally {
  await rm(repositoryRoot, { recursive: true, force: true });
}
