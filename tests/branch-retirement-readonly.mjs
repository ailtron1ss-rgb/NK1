import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scriptPath = path.join(root, 'tools/retire-cognitive-branch-refs.mjs');
const fixturePath = path.join(root, 'tests/fixtures/mock-branch-retirement-github-api.mjs');
const workflowPath = path.join(root, '.github/workflows/nk1-cognitive-branch-retirement.yml');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nk1-branch-retirement-readonly-'));
const methodsPath = path.join(tempDir, 'methods.json');

try {
  const result = spawnSync(process.execPath, [
    '--import', fixturePath,
    scriptPath,
  ], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      GITHUB_REPOSITORY: 'ailtron1ss-rgb/NK1',
      GITHUB_REF: 'refs/heads/workpass70-source',
      GITHUB_SHA: '54f9ec7c1ea81b71d0f0cf6d8c3e6395c4f96441',
      GH_TOKEN: 'offline-test-token',
      NK1_BRANCH_RETIREMENT_METHOD_LOG: methodsPath,
    },
  });
  assert.equal(result.status, 0, `read-only audit failed:\n${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /READ-ONLY/);
  assert.match(result.stdout, /Deleted: 0/);

  const requests = JSON.parse(fs.readFileSync(methodsPath, 'utf8'));
  assert.ok(requests.length > 0, 'the audit should exercise its GitHub read path');
  assert.ok(requests.every((request) => request.method === 'GET'), 'the utility must never issue a write request');

  const script = fs.readFileSync(scriptPath, 'utf8');
  assert.doesNotMatch(script, /\bDELETE\b/);
  assert.doesNotMatch(script, /refPath\s*=/);

  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^\s+push:/m, 'the candidate audit must not run automatically on source pushes');
  assert.match(workflow, /contents:\s*read/);
  assert.doesNotMatch(workflow, /contents:\s*write/);

  console.log(JSON.stringify({
    ok: true,
    apiRequests: requests.length,
    methods: [...new Set(requests.map((request) => request.method))],
    automaticPushTrigger: false,
    repositoryWritePermission: false,
    deletedRefs: 0,
  }));
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}
