import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflow = await readFile(new URL('../../.github/workflows/nk1-avatar-neuroadaptive-dynamics.yml', import.meta.url), 'utf8');
const avatarStage = await readFile(new URL('../src/components/Avatar3DStage.tsx', import.meta.url), 'utf8');
const browserAcceptance = await readFile(new URL('./avatar-3d-browser-acceptance.mjs', import.meta.url), 'utf8');

test('concurrency is isolated per pull request or ref', () => {
  assert.match(workflow, /group:\s*nk1-avatar-neuroadaptive-dynamics-\$\{\{\s*github\.event\.pull_request\.number\s*\|\|\s*github\.ref\s*\}\}/);
});

test('asset audit and secondary vertex tests have independent path filters', () => {
  const paths = workflow.match(/paths:\s*\n([\s\S]*?)\n\s*permissions:/)?.[1] ?? '';
  assert.match(paths, /^\s*- "app\/scripts\/avatar-secondary-asset-audit\.test\.mjs"\s*$/m);
  assert.match(paths, /^\s*- "app\/scripts\/avatar-secondary-vertex-dynamics\.test\.mjs"\s*$/m);
  assert.doesNotMatch(paths, /avatar-secondary-asset-audit\.test\.mjs\s+app\/scripts/);
});

test('workflow executes the vertex dynamics regression and its own configuration guard', () => {
  const command = workflow.match(/node --experimental-strip-types --test ([^\n]+)/)?.[1] ?? '';
  assert.match(command, /app\/scripts\/avatar-secondary-vertex-dynamics\.test\.mjs/);
  assert.match(command, /app\/scripts\/avatar-neuroadaptive-workflow\.test\.mjs/);
});

test('offscreen framebuffer readback wakes exactly one explicit render frame', () => {
  assert.match(avatarStage, /avatarPixelAuditRequested==="true"/);
  assert.match(avatarStage, /addEventListener\("nk1:avatar-pixel-audit-request",onPixelAuditRequest\)/);
  assert.match(avatarStage, /removeEventListener\("nk1:avatar-pixel-audit-request",onPixelAuditRequest\)/);
  assert.match(browserAcceptance, /dispatchEvent\(new Event\("nk1:avatar-pixel-audit-request"\)\)/);
});

test('avatar normalization hides environment meshes and fits only character geometry', () => {
  assert.match(avatarStage, /resolveAvatarSceneBounds\(root\)/);
  assert.match(avatarStage, /excludedEnvironmentMeshes:\s*sourceSceneBounds\.excludedEnvironmentMeshes/);
  assert.match(avatarStage, /const bounds=sourceSceneBounds\.bounds/);
});
