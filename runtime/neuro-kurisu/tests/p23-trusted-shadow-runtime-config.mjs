import assert from 'node:assert/strict';
import { parseTrustedShadowLearningScheduleConfig } from '../src/organism/learning/P23TrustedShadowLearningScheduler.ts';

assert.equal(parseTrustedShadowLearningScheduleConfig(undefined), undefined);
assert.equal(parseTrustedShadowLearningScheduleConfig(''), undefined);
assert.throws(() => parseTrustedShadowLearningScheduleConfig('{broken'), /valid JSON/);
assert.throws(() => parseTrustedShadowLearningScheduleConfig(JSON.stringify({ enabled: false })), /enabled configuration object/);

const base = {
  enabled: true,
  runtimeVersion: 'nk1-prod-test',
  taskId: 'heldout-task-1',
  taskVersion: 'v3',
  candidateId: 'a'.repeat(64),
  manifestFingerprint: 'b'.repeat(64),
  planFingerprint: 'c'.repeat(64),
  intervalMs: 900_000,
  initialDelayMs: 60_000,
  seedBase: 41,
  command: {
    executable: '/usr/bin/node',
    args: ['--version'],
    cwd: '/tmp',
    runRoot: '/tmp/nk1-shadow-runs',
    surviveDir: '/tmp/nk1-shadow-survive',
    timeoutMs: 30_000,
    maxOutputBytes: 65536,
    env: { NK1_TEST_MODE: '1' },
    inheritEnv: ['PATH'],
  },
};
const config = parseTrustedShadowLearningScheduleConfig(JSON.stringify(base));
assert.equal(config.enabled, true);
assert.equal(config.candidateId, 'a'.repeat(64));
assert.equal(config.command.args[0], '--version');
assert.equal(config.observationFileName, 'verified-skill-shadow-observation.json');

for (const [name, altered, message] of [
  ['no candidate', { ...base, candidateId: undefined }, /staged candidateId/],
  ['bad manifest', { ...base, manifestFingerprint: 'x' }, /SHA-256/],
  ['unsafe observation filename', { ...base, observationFileName: '../outside.json' }, /safe basename/],
  ['bad inherit-env', { ...base, command: { ...base.command, inheritEnv: ['PATH; touch /tmp/pwn'] } }, /environment variable names/],
  ['unknown property', { ...base, shell: true }, /unknown configuration fields/],
]) {
  assert.throws(() => parseTrustedShadowLearningScheduleConfig(JSON.stringify(altered)), message, name);
}
console.log('P23_TRUSTED_SHADOW_RUNTIME_CONFIG=PASS explicit opt-in and fail-closed schema validation');
