import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const WORKFLOW = readFileSync(resolve(ROOT, '.github/workflows/clean-startup-smoke.yml'), 'utf8');

const REQUIRED_PATHS = [
  'tools/super-gateway.mjs',
  'tools/super-gateway-headers.mjs',
  'tools/super-gateway-headers.test.mjs',
  'tools/supervisor-preflight.mjs',
  'tools/supervisor-preflight.test.mjs',
  'tools/supervisor-exit-policy.mjs',
  'tools/supervisor-exit-policy.test.mjs',
  'tools/supervised-service-specs.test.mjs',
  'tools/toolchain-contract.mjs',
  'runtime/neuro-kurisu/scripts/typecheck-runtime.mjs',
];

function eventBlock(source, eventName) {
  const lines = source.split('\n');
  const headerIndex = lines.indexOf(`  ${eventName}:`);
  assert.ok(headerIndex >= 0, `clean-startup workflow must declare ${eventName}`);
  let nextEventIndex = -1;
  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    if (/^  [A-Za-z][A-Za-z0-9_-]*:$/.test(lines[index])) {
      nextEventIndex = index;
      break;
    }
  }
  return lines.slice(headerIndex + 1, nextEventIndex < 0 ? lines.length : nextEventIndex).join('\n');
}

function assertEventCoverage(source, eventName) {
  const block = eventBlock(source, eventName);
  assert.ok(block.includes('paths:'), `${eventName} should retain path-based triggering`);
  for (const path of REQUIRED_PATHS) {
    assert.ok(block.includes(`- "${path}"`), `${eventName} paths must include ${path}`);
  }
}

for (const eventName of ['pull_request', 'push']) {
  test(`clean-startup smoke covers all runtime launch dependencies on ${eventName}`, () => {
    assertEventCoverage(WORKFLOW, eventName);
  });
}

test('the pull_request contract fails if a required path only remains in push', () => {
  const requiredEntry = '      - "tools/supervisor-preflight.mjs"';
  const index = WORKFLOW.indexOf(requiredEntry);
  assert.notEqual(index, -1, 'fixture must include the pull_request entry before mutation');
  const withoutPullRequestEntry = WORKFLOW.slice(0, index) + WORKFLOW.slice(index + requiredEntry.length);
  assert.throws(
    () => assertEventCoverage(withoutPullRequestEntry, 'pull_request'),
    error => error instanceof Error && error.message.includes('pull_request paths must include tools/supervisor-preflight.mjs'),
    'the pull_request block must not borrow coverage from the push block',
  );
  assert.doesNotThrow(() => assertEventCoverage(withoutPullRequestEntry, 'push'));
});

test('clean-startup smoke remains manually runnable', () => {
  assert.ok(WORKFLOW.split('\n').includes('  workflow_dispatch:'));
});
