import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const probePath = fileURLToPath(new URL('./prototype-health-readiness-probe.mjs', import.meta.url));

function runProbe(input) {
  return spawnSync(process.execPath, [probePath], {
    input,
    encoding: 'utf8',
    timeout: 5_000,
  });
}

const ready = runProbe('{"ready":true}');
assert.equal(ready.error, undefined);
assert.equal(ready.status, 0, 'ready health must pass');

const notReady = runProbe('{"ready":false}');
assert.equal(notReady.error, undefined);
assert.equal(notReady.status, 1, 'not-ready health must remain retryable');

for (const [label, payload] of [['empty', ''], ['malformed', '{"ready":']]) {
  const result = runProbe(payload);
  assert.equal(result.error, undefined, label + ' probe must terminate normally');
  assert.equal(result.status, 1, label + ' health must be treated as not-ready');
  assert.equal(result.stderr, '', label + ' health must not emit an unhandled JSON parse error');
}

console.log('PROTOTYPE_HEALTH_READINESS_PROBE=PASS');
