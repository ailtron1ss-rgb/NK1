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

function eventBlock(eventName) {
  const header = new RegExp(`^  ${eventName}:\\s*$`, 'm').exec(WORKFLOW);
  assert.ok(header, `clean-startup workflow must declare ${eventName}`);
  const rest = WORKFLOW.slice(header.index + header[0].length);
  const nextEvent = /^  [A-Za-z_][\w-]*:\s*$/m.exec(rest);
  return nextEvent ? rest.slice(0, nextEvent.index) : rest;
}

for (const eventName of ['pull_request', 'push']) {
  test(`clean-startup smoke covers all runtime launch dependencies on ${eventName}`, () => {
    const block = eventBlock(eventName);
    assert.ok(block.includes('paths:'), `${eventName} should retain path-based triggering`);
    for (const path of REQUIRED_PATHS) {
      assert.ok(block.includes(`- "${path}"`), `${eventName} paths must include ${path}`);
    }
  });
}

test('clean-startup smoke remains manually runnable', () => {
  assert.match(WORKFLOW, /^  workflow_dispatch:\s*$/m);
});
