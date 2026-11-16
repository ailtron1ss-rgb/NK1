import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { scanNeuroForgeProject } from '../src/organism/research/neuroforge/NeuroForgeScanner.ts';
import { analyzeNeuroForge } from '../src/organism/research/neuroforge/NeuroForgeEngine.ts';

async function makeProject(root, files) {
  for (const [relativePath, content] of Object.entries(files)) {
    const target = path.join(root, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, 'utf8');
  }
}

async function withTempRoot(run) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nk1-neuroforge-'));
  try {
    return await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('donor scanner builds a deterministic provenance inventory without exposing credential values', async () => {
  await withTempRoot(async root => {
    const donorRoot = path.join(root, 'temporal-donor');
    await makeProject(donorRoot, {
      'LICENSE': 'MIT License\n\nPermission is hereby granted, free of charge, to any person obtaining a copy.\n',
      'README.md': '# Temporal workflow engine\nDurable workflow orchestration and retry-safe execution.\n',
      'package.json': JSON.stringify({
        name: 'temporal-donor',
        version: '1.2.3',
        dependencies: { '@temporalio/client': '^1.10.0' },
      }),
      'src/workflow.ts': [
        "import { proxyActivities } from '@temporalio/workflow';",
        'export async function durableWorkflow() { return proxyActivities({}); }',
      ].join('\n'),
      'tests/workflow.test.ts': 'import { test } from "node:test";\ntest("workflow", () => {});\n',
      '.env': 'API_TOKEN=NEUROFORGE_TEST_SECRET_DO_NOT_EMIT\n',
    });

    const first = await scanNeuroForgeProject(donorRoot, { projectId: 'temporal-donor' });
    const second = await scanNeuroForgeProject(donorRoot, { projectId: 'temporal-donor' });

    assert.equal(first.rootLicense.spdxId, 'MIT');
    assert.equal(first.projectVersion, '1.2.3');
    assert.ok(first.stats.testFiles >= 1);
    assert.ok(first.dependencies.includes('@temporalio/client'));
    assert.ok(first.externalImports.includes('@temporalio/workflow'));
    assert.ok(first.securityFindings.some(row => row.kind === 'credential-file'));
    assert.equal(first.snapshotSha256, second.snapshotSha256);
    assert.equal(JSON.stringify(first).includes('NEUROFORGE_TEST_SECRET_DO_NOT_EMIT'), false);
  });
});

test('NeuroForge identifies a donor capability gap but never authorizes code reuse automatically', async () => {
  await withTempRoot(async root => {
    const baselineRoot = path.join(root, 'nk1-runtime');
    const donorRoot = path.join(root, 'temporal-donor');
    await makeProject(baselineRoot, {
      'memory/MemoryOS2.ts': 'export class MemoryOS2 { retrieveMemory() {} }\n',
      'system/ActionGateway.ts': 'export class ActionGateway { executeTool() {} }\n',
    });
    await makeProject(donorRoot, {
      'LICENSE': 'MIT License\nPermission is hereby granted.\n',
      'README.md': '# Temporal durable workflow orchestration\n',
      'package.json': JSON.stringify({ name: 'temporal-donor', dependencies: { '@temporalio/client': '^1.10.0' } }),
      'src/workflow.ts': 'export async function durableWorkflow() { return "checkpoint retry"; }\n',
      'tests/workflow.test.ts': 'export const testWorkflow = true;\n',
    });

    const baseline = await scanNeuroForgeProject(baselineRoot, { projectId: 'nk1-runtime' });
    const donor = await scanNeuroForgeProject(donorRoot, { projectId: 'temporal-donor' });
    const report = analyzeNeuroForge({ baseline, donors: [donor] });
    const proposal = report.proposals.find(row => row.capabilityId === 'durable-workflows');

    assert.ok(proposal, 'expected a durable-workflows proposal');
    assert.equal(proposal.gapClass, 'candidate-gap');
    assert.equal(proposal.copyAllowed, false);
    assert.equal(proposal.promotionStatus, 'blocked');
    assert.ok(proposal.blockingReasons.includes('human-license-review-required'));
    assert.ok(proposal.evidence.donorFiles.some(file => file === 'src/workflow.ts'));
    assert.equal(report.codeCopied, false);
    assert.equal(report.donorCodeExecuted, false);
  });
});

test('scanner rejects a missing source root instead of returning an empty successful inventory', async () => {
  await withTempRoot(async root => {
    await assert.rejects(
      () => scanNeuroForgeProject(path.join(root, 'missing-source-root')),
      /source-root-must-be-a-real-directory/,
    );
  });
});

test('scanner records symlink omissions and detects unquoted secret assignments without exposing values', async () => {
  await withTempRoot(async root => {
    const donorRoot = path.join(root, 'donor');
    await makeProject(donorRoot, {
      'src/config.ts': 'export const API_TOKEN = abcdef1234567890_SECRET_VALUE;\\n',
    });
    const outside = path.join(root, 'outside.ts');
    await writeFile(outside, 'export const external = true;\\n', 'utf8');
    await symlink(outside, path.join(donorRoot, 'src', 'external.ts'));

    const manifest = await scanNeuroForgeProject(donorRoot, { projectId: 'donor' });

    assert.ok(manifest.stats.skippedFiles >= 1);
    assert.ok(manifest.warnings.some(value => value.includes('symlink-skipped')));
    const secret = manifest.securityFindings.find(row => row.kind === 'possible-secret-assignment');
    assert.ok(secret);
    assert.equal(JSON.stringify(manifest).includes('abcdef1234567890_SECRET_VALUE'), false);
  });
});

test('NeuroForge CLI writes a review bundle and exits successfully for a valid donor root', async () => {
  await withTempRoot(async root => {
    const baselineRoot = path.join(root, 'nk1-runtime');
    const donorRoot = path.join(root, 'donors');
    const donor = path.join(donorRoot, 'temporal-donor');
    const outputRoot = path.join(root, 'output');
    await mkdir(donorRoot, { recursive: true });
    await makeProject(baselineRoot, {
      'memory/MemoryOS2.ts': 'export class MemoryOS2 { retrieveMemory() {} }\n',
    });
    await writeFile(path.join(donorRoot, 'README.md'), '# Collected donor sources\\n', 'utf8');
    await makeProject(donor, {
      'LICENSE': 'MIT License\nPermission is hereby granted.\n',
      'README.md': '# Temporal durable workflow engine\n',
      'package.json': JSON.stringify({ name: 'temporal-donor', version: '1.0.0' }),
      'src/workflow.ts': 'export function durableWorkflow() { return "retry"; }\n',
    });

    await makeProject(path.join(donorRoot, 'mem0-donor'), {
      'LICENSE': 'Apache License, Version 2.0\\n',
      'pyproject.toml': '[project]\\nname = "mem0-donor"\\n',
      'src/memory.py': 'def retrieve_memory():\\n    return None\\n',
    });

    const cliPath = path.resolve('scripts/neuroforge.mjs');
    const run = spawnSync(process.execPath, [
      '--experimental-strip-types',
      cliPath,
      'analyze',
      '--baseline', baselineRoot,
      '--donors', donorRoot,
      '--out', outputRoot,
    ], { encoding: 'utf8' });

    assert.equal(run.status, 0, 'CLI failed:\n' + run.stderr + '\n' + run.stdout);
    const report = JSON.parse(await readFile(path.join(outputRoot, 'neuroforge-report.json'), 'utf8'));
    assert.equal(report.donors.length, 2);
    assert.equal(report.codeCopied, false);
    assert.ok(report.proposals.some(row => row.capabilityId === 'durable-workflows'));
    assert.ok((await readFile(path.join(outputRoot, 'summary.md'), 'utf8')).includes('NeuroForge'));
  });
});
