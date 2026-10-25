import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { auditRepositoryWiring } from './verify-repository-wiring.mjs';

function write(root, relativePath, content) {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, 'utf8');
}

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nk1-repo-wiring-'));
  write(root, '.nvmrc', '24\n');
  write(root, 'package-lock.json', '{}\n');
  write(root, 'package.json', JSON.stringify({
    name: 'fixture-root',
    private: true,
    scripts: {
      audit: 'node tools/audit.mjs',
      'test:nested': 'npm --prefix runtime run test',
      'not-used': 'npm run missing-script'
    }
  }, null, 2));
  write(root, 'runtime/package.json', JSON.stringify({
    name: 'fixture-runtime',
    private: true,
    scripts: { test: 'node --test tests/test.mjs' }
  }, null, 2));
  write(root, 'tools/audit.mjs', 'export const audit = true;\n');
  write(root, 'runtime/tests/test.mjs', 'export const test = true;\n');
  write(root, 'local-action/action.yml', 'name: fixture-local-action\nruns:\n  using: composite\n  steps: []\n');
  write(root, '.github/workflows/core.yml', `name: Core validation
on:
  push:
    paths:
      - "package.json"
  pull_request:
    paths:
      - ".nvmrc"
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version-file: ".nvmrc"
          cache-dependency-path: "package-lock.json"
      - name: Run root and nested commands
        run: |
          npm run audit
          npm run test:nested
`);
  write(root, '.github/workflows/publish.yml', `name: Release publisher
on:
  workflow_run:
    workflows: ["Core validation"]
    types: [completed]
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: ./local-action
`);
  return root;
}

function withFixture(run) {
  const root = makeFixture();
  try {
    return run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('valid workflow, npm scripts, executable paths and workflow_run names pass', () => {
  withFixture(root => {
    const result = auditRepositoryWiring(root);
    assert.deepEqual(result.errors, []);
    assert.equal(result.workflowsScanned, 2);
    assert.equal(result.npmScriptsChecked, 3);
    assert.equal(result.packagesRead, 2);
  });
});

test('reports a missing executable referenced by an npm script', () => {
  withFixture(root => {
    const packagePath = path.join(root, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    pkg.scripts.audit = 'node tools/missing.mjs';
    fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2));
    const result = auditRepositoryWiring(root);
    assert.ok(result.errors.some(message => message.includes('tools/missing.mjs')));
  });
});

test('reports a missing nested npm script', () => {
  withFixture(root => {
    const workflowPath = path.join(root, '.github/workflows/core.yml');
    const workflow = fs.readFileSync(workflowPath, 'utf8').replace('npm run test:nested', 'npm run does-not-exist');
    fs.writeFileSync(workflowPath, workflow);
    const result = auditRepositoryWiring(root);
    assert.ok(result.errors.some(message => message.includes('npm script not defined') && message.includes('does-not-exist')));
  });
});

test('reports workflow_run references that no workflow declares', () => {
  withFixture(root => {
    const workflowPath = path.join(root, '.github/workflows/publish.yml');
    const workflow = fs.readFileSync(workflowPath, 'utf8').replace('Core validation', 'Missing validation workflow');
    fs.writeFileSync(workflowPath, workflow);
    const result = auditRepositoryWiring(root);
    assert.ok(result.errors.some(message => message.includes('workflow_run references missing workflow name')));
  });
});

test('reports exact file paths in workflow path filters when absent', () => {
  withFixture(root => {
    const workflowPath = path.join(root, '.github/workflows/core.yml');
    fs.writeFileSync(workflowPath, fs.readFileSync(workflowPath, 'utf8').replace('"package.json"', '"missing-contract.json"'));
    const result = auditRepositoryWiring(root);
    assert.ok(result.errors.some(message => message.includes('missing-contract.json')));
  });
});

test('detects recursive npm script wiring rather than silently accepting a cycle', () => {
  withFixture(root => {
    const packagePath = path.join(root, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    pkg.scripts.audit = 'npm run test:nested';
    pkg.scripts['test:nested'] = 'npm run audit';
    fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2));
    const result = auditRepositoryWiring(root);
    assert.ok(result.errors.some(message => message.includes('cyclic npm script reference')));
  });
});
